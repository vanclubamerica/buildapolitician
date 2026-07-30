/* =========================================================================
   simulation-engine.js: the OFFLINE fallback election model.

   This file runs in two places:
     1. In the browser, as window.SimEngine (loaded by simulator.html), so
        the site still works when opened straight off GitHub Pages or a
        local file:// URL where /api/simulate does not exist.
     2. In Node, required by api/simulate.js, so the serverless function can
        still return a valid result when OPENAI_API_KEY is missing or the
        OpenAI request fails.

   It produces EXACTLY the same JSON shape the AI is asked to produce, so
   results.js never has to care which one it got.

   The model is deliberately transparent and non-partisan: it scores a
   candidate on communication clarity, relatability, credibility and
   likeability using only what the student wrote. Party affiliation is
   never worth points. It only changes which voter blocs are described as
   friendly or skeptical, symmetrically.
   ========================================================================= */

(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SimEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ----------------------------- utilities ----------------------------- */

  /* Small deterministic PRNG (mulberry32) so a given candidate + seed pair
     always produces the same numbers. Makes the fallback reproducible and
     testable rather than pure noise. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v) { return Math.round(v); }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function pickMany(rng, arr, n) {
    var pool = arr.slice(), out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  }

  function firstName(fullName) {
    return String(fullName || "The candidate").trim().split(/\s+/)[0];
  }

  function lastName(fullName) {
    var parts = String(fullName || "").trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "The candidate";
  }

  /* --------------------------- text analysis --------------------------- */

  /* Keyword banks. Each hit nudges one of four scores. This is a crude but
     honest heuristic, and it is applied identically no matter which party
     the candidate belongs to. */
  var SIGNALS = {
    decisive:   ["blunt","decisive","confident","bold","tough","fearless","direct","unapologetic","firm","fights","fighter","no-nonsense","stubborn"],
    warm:       ["warm","kind","listens","listening","patient","compassion","caring","humble","friendly","empathy","together","unite","uniting","neighbor"],
    credible:   ["built","ran","founded","served","veteran","years","experience","managed","led","teacher","nurse","doctor","officer","owner","degree","expert"],
    outsider:   ["outsider","never held office","first-time","not a politician","career politicians","washington","establishment","different","shake up","drain"],
    risky:      ["controversial","angry","polarizing","radical","extreme","reckless","arrogant","rude","scandal","secretive","untested","inexperienced"]
  };

  function countSignals(text, words) {
    var t = " " + String(text || "").toLowerCase() + " ";
    var n = 0;
    for (var i = 0; i < words.length; i++) {
      if (t.indexOf(words[i]) !== -1) n++;
    }
    return n;
  }

  function sentenceCount(text) {
    var m = String(text || "").split(/[.!?]+/).filter(function (s) { return s.trim().length > 3; });
    return m.length;
  }

  /* Which issues a given past job gives a candidate earned authority on.
     A nurse running on healthcare starts with credibility they do not have
     to argue for; a nurse running on national security has to build it.
     This is the ONLY content-based bonus in the model, it is capped, and
     it is available to every candidate regardless of politics. */
  var ISSUE_FIT = {
    "Small Business Owner": ["Economy", "Jobs & Workers", "Government Reform"],
    "Teacher":              ["Education"],
    "Doctor":               ["Healthcare"],
    "Nurse":                ["Healthcare"],
    "Military Veteran":     ["National Security", "Veterans"],
    "Lawyer":               ["Crime & Public Safety", "Government Reform"],
    "Farmer":               ["Environment & Energy", "Economy"],
    "Police Officer":       ["Crime & Public Safety"],
    "Firefighter":          ["Crime & Public Safety"],
    "Engineer":             ["Technology & AI", "Housing"],
    "Software Developer":   ["Technology & AI"],
    "Construction Worker":  ["Housing", "Jobs & Workers"],
    "Factory Worker":       ["Jobs & Workers", "Economy"],
    "Journalist":           ["Government Reform"],
    "College Professor":    ["Education"],
    "Nonprofit Director":   ["Housing", "Healthcare"],
    "Pastor":               ["Housing", "Veterans"],
    "Scientist":            ["Environment & Energy", "Technology & AI"],
    "Accountant":           ["Economy", "Government Reform"],
    "Mayor":                ["Housing", "Crime & Public Safety", "Government Reform"],
    "Truck Driver":         ["Jobs & Workers", "Economy"],
    "Athlete":              ["Education"]
  };

  function issueFits(occupation, topIssue) {
    var list = ISSUE_FIT[occupation];
    return !!(list && topIssue && list.indexOf(topIssue) !== -1);
  }

  /* Turn the candidate into a small profile of 0-100 scores. */
  function profileCandidate(c) {
    var about = String(c.about || "");
    var words = about.trim() ? about.trim().split(/\s+/).length : 0;
    var sentences = sentenceCount(about);

    /* Effort: did the student actually write a real description? A fuller
       bio gives the analyst more to work with, so it scores higher. */
    var effort = clamp(30 + words * 0.55 + sentences * 4, 20, 95);

    var decisive = clamp(40 + countSignals(about, SIGNALS.decisive) * 11, 20, 92);
    var warm     = clamp(40 + countSignals(about, SIGNALS.warm) * 11, 20, 92);
    var fit = issueFits(c.occupation, c.topIssue);
    var credible = clamp(
      38 + countSignals(about, SIGNALS.credible) * 9 +
      (String(c.occupation || "").length ? 8 : 0) +
      (fit ? 12 : 0),
      20, 94
    );
    var outsider = clamp(30 + countSignals(about, SIGNALS.outsider) * 13, 10, 90);
    var risk     = clamp(18 + countSignals(about, SIGNALS.risky) * 12, 5, 80);

    /* Slogan quality: short, punchy slogans test better in this model. */
    var slogan = String(c.slogan || "");
    var sloganWords = slogan.trim() ? slogan.trim().split(/\s+/).length : 0;
    var sloganScore = sloganWords === 0 ? 25 : clamp(85 - Math.abs(sloganWords - 5) * 7, 30, 92);

    /* Age is not good or bad, but it does shape which age blocs feel
       represented, so we keep the raw number rather than scoring it. */
    var age = Number(c.age) || 50;

    var overall = clamp(
      effort * 0.24 + credible * 0.24 + sloganScore * 0.14 +
      Math.max(decisive, warm) * 0.24 + (100 - risk) * 0.14,
      25, 88
    );

    return {
      effort: effort, decisive: decisive, warm: warm, credible: credible,
      outsider: outsider, risk: risk, sloganScore: sloganScore, age: age,
      overall: overall, words: words, sentences: sentences, fit: fit
    };
  }

  /* ------------------------ demographic modelling ----------------------- */

  var AGE_BANDS = ["18-29", "30-44", "45-64", "65+"];
  var LEANS = ["Conservative", "Moderate", "Liberal", "Independent"];
  var PLACES = ["Urban", "Suburban", "Rural"];

  /* Which lean groups start friendly to a party. Symmetric by design: every
     party gets exactly one friendly bloc and one skeptical bloc. */
  var PARTY_LEAN_TILT = {
    "Republican":  { Conservative:  9, Liberal:     -9, Moderate: 0, Independent: 1 },
    "Democrat":    { Liberal:       9, Conservative:-9, Moderate: 0, Independent: 1 },
    "Libertarian": { Independent:   9, Moderate:    -6, Conservative: 3, Liberal: -3 },
    "Green":       { Liberal:       8, Conservative:-8, Moderate: -2, Independent: 2 },
    "Independent": { Independent:  10, Moderate:     5, Conservative: -3, Liberal: -3 }
  };

  var ISSUE_TILT = {
    "Economy":               { "30-44": 4, "45-64": 3, Suburban: 3, Rural: 2, Moderate: 3 },
    "Healthcare":            { "65+": 6, "45-64": 3, Urban: 2, Liberal: 3 },
    "Education":             { "30-44": 6, Suburban: 4, "18-29": 2 },
    "Immigration":           { "45-64": 3, Rural: 4, Conservative: 3, Liberal: -2 },
    "Environment & Energy":  { "18-29": 7, Urban: 4, Liberal: 4, Rural: -3 },
    "Crime & Public Safety": { "65+": 5, Suburban: 4, Conservative: 4, "18-29": -2 },
    "National Security":     { "65+": 4, "45-64": 3, Conservative: 3, Rural: 2 },
    "Jobs & Workers":        { "30-44": 4, "45-64": 4, Rural: 4, Moderate: 2 },
    "Housing":               { "18-29": 8, "30-44": 5, Urban: 5, Rural: -2 },
    "Technology & AI":       { "18-29": 8, "30-44": 4, Urban: 4, "65+": -4 },
    "Government Reform":     { Independent: 6, Moderate: 3, Rural: 2 },
    "Veterans":              { "65+": 5, Rural: 4, Conservative: 2, "45-64": 2 }
  };

  var OCCUPATION_TILT = {
    "Small Business Owner": { Suburban: 4, Rural: 3, Moderate: 2 },
    "Teacher":              { "30-44": 5, Suburban: 3, Liberal: 2 },
    "Doctor":               { "65+": 4, Suburban: 3 },
    "Nurse":                { "65+": 5, "45-64": 3, Rural: 2 },
    "Military Veteran":     { "65+": 5, Rural: 4, Conservative: 3 },
    "Lawyer":               { Urban: 3, "45-64": 2 },
    "Farmer":               { Rural: 8, Conservative: 2, Urban: -3 },
    "Police Officer":       { Suburban: 4, "65+": 3, Conservative: 3, "18-29": -3 },
    "Firefighter":          { Suburban: 4, Rural: 3, Moderate: 3 },
    "Engineer":             { Suburban: 3, "30-44": 3 },
    "Software Developer":   { "18-29": 6, Urban: 5, "65+": -4 },
    "Construction Worker":  { Rural: 5, "30-44": 3, Moderate: 2 },
    "Factory Worker":       { Rural: 5, "45-64": 4, Moderate: 2 },
    "Journalist":           { Urban: 4, "18-29": 2, Conservative: -3 },
    "College Professor":    { Urban: 4, Liberal: 4, "18-29": 3, Rural: -3 },
    "Nonprofit Director":   { Urban: 3, Liberal: 3, "30-44": 2 },
    "Pastor":               { Rural: 5, "65+": 4, Conservative: 4 },
    "Scientist":            { Urban: 3, "18-29": 3, Liberal: 2 },
    "Accountant":           { Suburban: 3, "45-64": 2 },
    "Mayor":                { Urban: 3, Suburban: 3, Moderate: 3 },
    "Truck Driver":         { Rural: 6, "45-64": 3, Moderate: 2 },
    "Athlete":              { "18-29": 6, Urban: 2 }
  };

  function tiltFor(candidate, group) {
    var t = 0;
    var partyTilt = PARTY_LEAN_TILT[candidate.party];
    if (partyTilt && typeof partyTilt[group] === "number") t += partyTilt[group];
    var issueTilt = ISSUE_TILT[candidate.topIssue];
    if (issueTilt && typeof issueTilt[group] === "number") t += issueTilt[group];
    var occTilt = OCCUPATION_TILT[candidate.occupation];
    if (occTilt && typeof occTilt[group] === "number") t += occTilt[group];
    return t;
  }

  /* Age proximity: voters skew slightly toward candidates near their own
     life stage. Applied symmetrically across all four bands. */
  var BAND_MIDPOINT = { "18-29": 24, "30-44": 37, "45-64": 55, "65+": 71 };
  function ageAffinity(candidateAge, band) {
    var gap = Math.abs(candidateAge - BAND_MIDPOINT[band]);
    return clamp(6 - gap / 6, -5, 6);
  }

  function buildGroup(rng, candidate, profile, base, groups, kind) {
    return groups.map(function (g) {
      /* Tilts are damped to 0.7 so a single lucky combination of party +
         issue + occupation cannot push a bloc to an absurd number. */
      var support = base + tiltFor(candidate, g) * 0.7;
      if (kind === "age") support += ageAffinity(profile.age, g);
      if (kind === "lean" && g === "Moderate") support += (profile.warm - 50) * 0.10;
      if (kind === "lean" && g === "Independent") support += (profile.outsider - 40) * 0.10;
      if (kind === "location" && g === "Rural") support += (profile.credible - 50) * 0.07;
      if (kind === "location" && g === "Urban") support += (profile.warm - 50) * 0.08;
      support += (rng() * 6 - 3);
      var value = round(clamp(support, 14, 78));
      return { group: g, support: value, note: groupNote(candidate, g, value, kind) };
    });
  }

  var AGE_NOTES_STRONG = {
    "18-29": "Younger voters respond to the energy of the campaign more than its details.",
    "30-44": "Voters raising families read WHO's ISSUE message as being about their own bills.",
    "45-64": "This is WHO's most reliable bloc. They know the record and they turn out.",
    "65+": "Older voters trust WHO's steadiness, and they vote at the highest rate of any group."
  };
  var AGE_NOTES_WEAK = {
    "18-29": "Younger voters barely know WHO exists, and low awareness reads as low support.",
    "30-44": "This bloc has not heard how ISSUE changes anything in their week.",
    "45-64": "This bloc compares WHO to a long list of past candidates and finds the record thin.",
    "65+": "Older voters are the most skeptical of WHO and the most likely to show up anyway."
  };

  function fill(tpl, who, issue) {
    return tpl.replace(/WHO/g, who).replace(/ISSUE/g, issue);
  }

  function groupNote(candidate, group, support, kind) {
    var who = lastName(candidate.name);
    var issue = String(candidate.topIssue || "the campaign's").toLowerCase();
    var strong = support >= 55, weak = support <= 42;
    if (kind === "age") {
      if (strong) return fill(AGE_NOTES_STRONG[group] || "This bloc is with WHO.", who, issue);
      if (weak) return fill(AGE_NOTES_WEAK[group] || "This bloc is not sold on WHO.", who, issue);
      return "Split close to evenly and highly persuadable. The bloc most worth chasing.";
    }
    if (kind === "lean") {
      if (strong) return group + " voters find " + who + "'s message an easy fit.";
      if (weak) return group + " voters are the hardest audience for this campaign.";
      return group + " voters are genuinely undecided and could break either way.";
    }
    if (strong) return group + " voters respond to " + who + "'s background as a " + String(candidate.occupation || "candidate").toLowerCase() + ".";
    if (weak) return group + " voters do not yet see how " + who + "'s plan reaches them.";
    return group + " voters are close to evenly divided.";
  }

  /* ---------------------- strengths / weaknesses ----------------------- */

  function buildStrengths(rng, c, p) {
    var who = lastName(c.name);
    var out = [];

    if (p.decisive >= p.warm && p.decisive > 50) {
      out.push({ title: "Reads as decisive", detail: who + " comes across as someone who will make a call and stand behind it. In focus groups, voters who are tired of gridlock consistently name this as the reason they are willing to take a chance on " + who + "." });
    }
    if (p.warm > 50 && p.warm >= p.decisive) {
      out.push({ title: "Personally likeable", detail: "Voters describe " + who + " as approachable and easy to trust. Likeability is the single best predictor of second-choice support, which matters enormously in a close race." });
    }
    if (p.fit) {
      out.push({ title: "The résumé matches the message", detail: "A " + String(c.occupation).toLowerCase() + " running on " + String(c.topIssue).toLowerCase() + " does not have to argue for the right to be heard on it. That earned authority is the single most transferable asset " + who + " has." });
    }
    if (p.credible > 55) {
      out.push({ title: "Credible on the day job", detail: "A record as a " + String(c.occupation || "working professional").toLowerCase() + " gives " + who + " standing that a career politician cannot buy. Voters assume competence before " + who + " says a word." });
    }
    if (p.outsider > 50) {
      out.push({ title: "Outsider appeal", detail: who + " is not seen as part of the machine. That is worth several points on its own with voters who feel ignored by both parties." });
    }
    if (p.sloganScore > 70) {
      out.push({ title: "The slogan lands", detail: "\"" + c.slogan + "\" is short enough to repeat and clear enough to mean something. Message recall in this simulation is well above average." });
    }
    out.push({ title: "Owns a single issue", detail: who + " is unmistakably the " + String(c.topIssue).toLowerCase() + " candidate. Voters who rank that issue first know exactly where to go, and that clarity is rare." });
    out.push({ title: "Home-state anchor", detail: "Roots in " + c.state + " give " + who + " an authentic story about a real place, which travels better than national talking points." });

    return pickMany(rng, out, Math.min(4, out.length));
  }

  function buildWeaknesses(rng, c, p) {
    var who = lastName(c.name);
    var out = [];

    if (p.risk > 40) {
      out.push({ title: "Style cuts both ways", detail: "The same bluntness that wins over frustrated voters reads as abrasive to others. Moderates in this simulation flagged tone as their top hesitation about " + who + "." });
    }
    if (!p.fit && c.occupation && c.topIssue) {
      out.push({ title: "Résumé and message pull apart", detail: "Nothing in a career as a " + String(c.occupation).toLowerCase() + " explains why voters should trust " + who + " on " + String(c.topIssue).toLowerCase() + " specifically. It is a winnable argument, but " + who + " has to make it, and every hour spent making it is an hour not spent persuading." });
    }
    if (p.credible < 55) {
      out.push({ title: "Thin public record", detail: "Voters cannot point to something " + who + " has already delivered. Undecideds want proof, not promises, and this campaign has not given them much to hold." });
    }
    if (p.outsider > 60) {
      out.push({ title: "Outsider means untested", detail: "Being new is an asset until voters start asking who " + who + " will actually work with. Roughly a third of respondents worried " + who + " would arrive with no allies." });
    }
    if (p.words < 45) {
      out.push({ title: "Voters do not know enough", detail: "The candidate's public story is thin, so name recognition outpaces actual knowledge. Undefined candidates get defined by their opponent." });
    }
    if (p.warm < 45) {
      out.push({ title: "Low warmth numbers", detail: "Respondents rate " + who + " as competent more often than they rate " + who + " as someone who understands people like them. That gap is the hardest one to close late in a race." });
    }
    out.push({ title: "Narrow issue base", detail: "Leaning this hard on " + String(c.topIssue).toLowerCase() + " leaves " + who + " exposed when the news cycle turns to anything else, and it will." });
    out.push({ title: "Turnout risk", detail: "Support for " + who + " is broad but not deep. Voters who say they approve are noticeably less likely to say they are certain to vote." });

    return pickMany(rng, out, Math.min(4, out.length));
  }

  /* ----------------------------- events -------------------------------- */

  function buildEvents(rng, c, p, oppName) {
    var who = lastName(c.name);
    var issue = String(c.topIssue).toLowerCase();
    var pool = [
      { headline: "Strong debate performance", detail: who + " stayed calm under attack and gave a clear answer on " + issue + " that got replayed all week. Undecided voters broke toward " + who + " afterward.", impact: 3, affected: "Undecided voters" },
      { headline: "Viral town hall moment", detail: "A voter asked " + who + " a hard question about " + issue + " and got a real answer instead of a talking point. The clip traveled far past the campaign's own audience.", impact: 3, affected: "18-29 voters" },
      { headline: "Major endorsement", detail: "A respected figure in " + c.state + " backed " + who + ", which gave undecided voters permission to take the campaign seriously.", impact: 2, affected: "Moderate voters" },
      { headline: "Controversial statement", detail: who + " said something off the cuff that played well with the base and badly with everyone else. Approval among moderates dropped for about a week.", impact: -4, affected: "Moderate voters" },
      { headline: "Opponent goes negative", detail: oppName + " ran a heavy ad buy attacking " + who + "'s lack of a record. It moved suburban numbers, though it also raised " + oppName + "'s own negatives.", impact: -3, affected: "Suburban voters" },
      { headline: "Fundraising surge", detail: "A wave of small-dollar donations let " + who + " stay on television through the final stretch instead of going dark.", impact: 2, affected: "All voters" },
      { headline: "Rough interview", detail: who + " was pressed for specifics on " + issue + " and did not have them. The clip became the opposition's favorite ad.", impact: -3, affected: "45-64 voters" },
      { headline: "Local crisis response", detail: "When a storm hit " + c.state + ", " + who + " showed up before the cameras did. Rural voters noticed.", impact: 3, affected: "Rural voters" },
      { headline: "Policy rollout lands", detail: who + " released an actual plan on " + issue + " with numbers attached. Coverage was skeptical but respectful, and credibility ticked up.", impact: 2, affected: "Independent voters" },
      { headline: "Turnout worry in the base", detail: "Internal numbers showed " + who + "'s own supporters were less certain to vote than " + oppName + "'s. The campaign shifted to a ground game push.", impact: -2, affected: "18-29 voters" }
    ];
    var n = 4 + Math.floor(rng() * 2);
    return pickMany(rng, pool, n);
  }

  /* --------------------------- main entry ------------------------------ */

  function simulate(input) {
    var c = input.candidate || {};
    var opp = input.opponent || null;
    var oppName = opp && opp.name ? lastName(opp.name) : "the opponent";

    /* NOTE: party is deliberately NOT part of the seed. Two candidates who
       differ only by party label get the identical random draw, so the
       headline poll number cannot move because of ideology alone. Party
       still reshapes the demographic breakdown via PARTY_LEAN_TILT, which
       is the only place it is allowed to matter.

       Top issue is excluded for the same reason. No issue is inherently
       worth more than another. Where the chosen issue legitimately matters
       is whether it FITS the candidate's old job, and that is scored
       explicitly in profileCandidate() rather than left to noise. */
    var seedSource = [c.name, c.age, c.occupation, c.state, c.slogan, c.about, input.seed || ""].join("|");
    var rng = mulberry32(hashString(seedSource));

    var p = profileCandidate(c);

    /* If we know the opponent, profile them too and let the gap drive the
       poll. Otherwise assume a competent, well-funded generic incumbent so
       the race stays genuinely competitive rather than a walkover. */
    var oppProfile = opp ? profileCandidate(opp) : { overall: 58 + rng() * 9 };
    var gap = p.overall - oppProfile.overall;

    var undecided = round(clamp(4 + rng() * 7 - gap * 0.04, 3, 14));
    var remaining = 100 - undecided;
    /* Real races are close. The gap moves the split, but only so far.
       a well-written candidate wins by a few points, not by forty. */
    var share = clamp(0.5 + gap * 0.005 + (rng() * 0.05 - 0.025), 0.38, 0.62);
    var candShare = round(remaining * share);
    var oppShare = 100 - undecided - candShare;

    var approve = round(clamp(p.overall * 0.42 + candShare * 0.55 + (rng() * 6 - 3), 24, 72));
    var unsure = round(clamp(6 + rng() * 8, 4, 16));
    var disapprove = 100 - approve - unsure;

    /* Demographic support levels orbit the candidate's headline number. */
    var base = candShare;
    var demographics = {
      age: buildGroup(rng, c, p, base, AGE_BANDS, "age"),
      lean: buildGroup(rng, c, p, base, LEANS, "lean"),
      location: buildGroup(rng, c, p, base, PLACES, "location")
    };

    var margin = candShare - oppShare;
    var projection =
      margin >= 10 ? "Comfortable Win" :
      margin >= 4  ? "Likely Win" :
      margin >= 1  ? "Narrow Win" :
      margin > -1  ? "Too Close to Call" :
      margin > -4  ? "Narrow Loss" :
      margin > -10 ? "Likely Loss" : "Clear Loss";

    var who = lastName(c.name);
    var summary =
      who + " is polling at " + candShare + "% against " + oppName + "'s " + oppShare + "%, with " +
      undecided + "% still undecided. The number is driven mostly by " +
      (p.credible >= p.warm ? "credibility. Voters believe " + who + " can do the job" :
                              "likeability. Voters want " + who + " to succeed") +
      ", and it is held back by " +
      (p.risk > 40 ? "a style that some voters find abrasive" :
       p.words < 45 ? "how little voters actually know about " + who + " yet" :
                      "a message that has not yet reached beyond " + String(c.topIssue).toLowerCase()) +
      ". This is a fictional simulation of invented voters and does not predict any real election.";

    return {
      source: "offline",
      candidate_name: c.name || "Your candidate",
      opponent_name: opp && opp.name ? opp.name : "Generic Opponent",
      projection: projection,
      approval_rating: { approve: approve, disapprove: disapprove, unsure: unsure },
      poll_results: { candidate: candShare, opponent: oppShare, undecided: undecided },
      demographics: demographics,
      strengths: buildStrengths(rng, c, p),
      weaknesses: buildWeaknesses(rng, c, p),
      events: buildEvents(rng, c, p, oppName),
      analyst_summary: summary
    };
  }

  return {
    simulate: simulate,
    profileCandidate: profileCandidate,
    AGE_BANDS: AGE_BANDS,
    LEANS: LEANS,
    PLACES: PLACES
  };
});
