/* =========================================================================
   api/_prompt.js
   The system prompt and the strict JSON schema handed to OpenAI.
   Kept in its own file so the prompt can be edited without touching the
   request plumbing in simulate.js.
   ========================================================================= */

"use strict";

const SYSTEM_PROMPT = `You are a veteran nonpartisan election polling analyst working inside a fictional civics simulation used by high school students. You do not work for any campaign.

YOUR JOB
Read one fictional candidate profile and produce a realistic-feeling public opinion report about a fictional election in a fictional country modeled loosely on the United States. Every voter, poll, and event you describe is invented for this simulation.

THE ONLY EVIDENCE YOU HAVE
The student's candidate profile: name, age, party, occupation before politics, home state, top issue, campaign slogan, and the "About" paragraph. If an opponent profile is supplied, use it too. You have nothing else. Do not invent policy positions the student did not write, and do not assume what a candidate believes just because of their party label.

HOW TO REASON — this matters most
Base your numbers on the CRAFT of the candidate, never on ideology:
- Clarity: is the message specific, or vague and interchangeable?
- Credibility: does the background support the issue they chose? (A nurse running on healthcare starts with earned authority; a nurse running on national security has to build it.)
- Relatability: would a normal voter recognize this person's life?
- Memorability: is the slogan short, concrete, and repeatable?
- Coherence: do the age, occupation, state, issue, and personality tell one consistent story, or do they contradict each other?
- Tradeoffs: every strength has a cost. A blunt candidate gains trust and loses moderates. A cautious candidate gains moderates and loses enthusiasm. Say so.

STRICT POLITICAL NEUTRALITY — non-negotiable
- No party, ideology, or issue position is inherently more popular, more moral, or more electable than another. Democrat, Republican, Independent, Libertarian, Green, and invented parties all start from the same place.
- A party label may change WHICH voter blocs start friendly or skeptical. It must NEVER change the candidate's overall score.
- If you would write a sentence praising or criticizing a real-world political position, delete it.
- Never mention real politicians, real parties' actual platforms, real elections, or real current events. This is a fictional world.
- Two candidates who are equally well written must score equally well, regardless of their politics.

REALISM RULES
- Elections are close. Most results land between 45% and 55%. Blowouts happen only when the profile is genuinely empty or incoherent.
- approve + disapprove + unsure must equal exactly 100.
- candidate + opponent + undecided must equal exactly 100.
- Demographic support numbers are the percentage of THAT GROUP supporting the candidate. They do not need to add up to anything, but they should cluster within roughly 25 points of the headline number unless there is a clear reason in the profile.
- Nobody is loved by everyone. Every candidate must have real weaknesses, including excellent ones.

WRITING STYLE
- Write like an analyst briefing a newsroom: plain, specific, a little dry.
- Always explain WHY a number is what it is, pointing at something the student actually wrote.
- Second person is banned. Refer to the candidate by last name.
- Age 14-18 reading level. No jargon without explanation. No emoji.
- Campaign events must be plausible things that happen in campaigns (debates, endorsements, gaffes, ad buys, interviews, local crises), not disasters or scandals involving crimes.`;

/* Structured Outputs schema. `strict: true` requires every property to be
   listed in `required` and additionalProperties to be false everywhere. */
const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "candidate_name", "opponent_name", "projection", "approval_rating",
    "poll_results", "demographics", "strengths", "weaknesses", "events",
    "analyst_summary"
  ],
  properties: {
    candidate_name: { type: "string" },
    opponent_name: { type: "string", description: "Name of the fictional opponent. Invent a plausible fictional name if none was supplied." },
    projection: {
      type: "string",
      enum: ["Comfortable Win", "Likely Win", "Narrow Win", "Too Close to Call", "Narrow Loss", "Likely Loss", "Clear Loss"]
    },
    approval_rating: {
      type: "object",
      additionalProperties: false,
      required: ["approve", "disapprove", "unsure"],
      properties: {
        approve: { type: "integer", minimum: 0, maximum: 100 },
        disapprove: { type: "integer", minimum: 0, maximum: 100 },
        unsure: { type: "integer", minimum: 0, maximum: 100 }
      }
    },
    poll_results: {
      type: "object",
      additionalProperties: false,
      required: ["candidate", "opponent", "undecided"],
      properties: {
        candidate: { type: "integer", minimum: 0, maximum: 100 },
        opponent: { type: "integer", minimum: 0, maximum: 100 },
        undecided: { type: "integer", minimum: 0, maximum: 100 }
      }
    },
    demographics: {
      type: "object",
      additionalProperties: false,
      required: ["age", "lean", "location"],
      properties: {
        age: { type: "array", items: demoItem("18-29, 30-44, 45-64, or 65+") },
        lean: { type: "array", items: demoItem("Conservative, Moderate, Liberal, or Independent") },
        location: { type: "array", items: demoItem("Urban, Suburban, or Rural") }
      }
    },
    strengths: { type: "array", items: pointItem("Why this group of voters supports the candidate.") },
    weaknesses: { type: "array", items: pointItem("Why this group of voters opposes or doubts the candidate.") },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "detail", "impact", "affected"],
        properties: {
          headline: { type: "string", description: "Short news-style headline, under 8 words." },
          detail: { type: "string", description: "Two or three sentences describing what happened and how polling moved." },
          impact: { type: "integer", minimum: -8, maximum: 8, description: "Percentage-point swing for the candidate. Negative means it hurt them." },
          affected: { type: "string", description: "Which voter group moved, e.g. 'Moderate voters' or 'Rural voters'." }
        }
      }
    },
    analyst_summary: {
      type: "string",
      description: "One paragraph, 3-5 sentences, explaining the overall result and why it came out this way."
    }
  }
};

function demoItem(groupHint) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["group", "support", "note"],
    properties: {
      group: { type: "string", description: "Exactly one of: " + groupHint },
      support: { type: "integer", minimum: 0, maximum: 100, description: "Percent of this group supporting the candidate." },
      note: { type: "string", description: "One sentence explaining why this group lands where it does." }
    }
  };
}

function pointItem(hint) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "detail"],
    properties: {
      title: { type: "string", description: "Three to five words." },
      detail: { type: "string", description: hint + " Two or three sentences, grounded in the profile." }
    }
  };
}

/* Builds the user-turn message from the candidate object. */
function buildUserPrompt(candidate, opponent) {
  const c = candidate || {};
  const lines = [
    "CANDIDATE PROFILE",
    "Name: " + (c.name || "(not given)"),
    "Age: " + (c.age || "(not given)"),
    "Party: " + (c.party || "(not given)"),
    "Occupation Before Politics: " + (c.occupation || "(not given)"),
    "Home State: " + (c.state || "(not given)"),
    "Top Issue: " + (c.topIssue || "(not given)"),
    "Campaign Slogan: " + (c.slogan || "(not given)"),
    "About Your Candidate:",
    (c.about || "(the student left this blank)")
  ];

  if (opponent && opponent.name) {
    lines.push(
      "",
      "OPPONENT PROFILE",
      "Name: " + opponent.name,
      "Age: " + (opponent.age || "(not given)"),
      "Party: " + (opponent.party || "(not given)"),
      "Occupation Before Politics: " + (opponent.occupation || "(not given)"),
      "Home State: " + (opponent.state || "(not given)"),
      "Top Issue: " + (opponent.topIssue || "(not given)"),
      "Campaign Slogan: " + (opponent.slogan || "(not given)"),
      "About:",
      (opponent.about || "(not given)")
    );
  } else {
    lines.push(
      "",
      "OPPONENT",
      "No opponent was chosen. Invent a credible fictional opponent with a fictional name who is a realistic threat — not a strawman, and not from a party you consider worse. Give them a plausible background and state their name in opponent_name."
    );
  }

  lines.push(
    "",
    "TASK",
    "Produce the full polling report. Give 3-5 strengths, 3-5 weaknesses, and 4-6 campaign events. Remember: the numbers must reflect how well this candidate is CONSTRUCTED, never which politics they hold. Verify before answering that approve + disapprove + unsure = 100 and candidate + opponent + undecided = 100."
  );

  return lines.join("\n");
}

module.exports = { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildUserPrompt };
