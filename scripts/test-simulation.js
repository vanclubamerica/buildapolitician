/* =========================================================================
   scripts/test-simulation.js
   Run with:  npm test     (or)  node scripts/test-simulation.js

   Checks the offline engine and the serverless handler without needing an
   OpenAI key, a browser, or a running server. If this passes, the site's
   worst case (no API key at all) is known-good.
   ========================================================================= */

"use strict";

const path = require("path");
const fs = require("fs");

const SimEngine = require(path.join(__dirname, "..", "js", "simulation-engine.js"));
const handler = require(path.join(__dirname, "..", "api", "simulate.js"));

let passed = 0;
let failed = 0;

function check(label, condition, extra) {
  if (condition) {
    passed++;
    console.log("  ok   " + label);
  } else {
    failed++;
    console.log("  FAIL " + label + (extra ? "  -> " + extra : ""));
  }
}

/* Load data.js outside a browser by evaluating it with a fake window. */
function loadGameData() {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
  const fakeWindow = {};
  new Function("window", source)(fakeWindow);
  return fakeWindow.GameData;
}

const GameData = loadGameData();

const EXAMPLE = {
  name: "John Carter",
  age: 46,
  party: "Independent",
  occupation: "Small Business Owner",
  state: "Texas",
  topIssue: "Economy",
  slogan: "Common Sense. Real Results.",
  about: "John Carter is a blunt, confident leader who believes politicians spend too much time arguing instead of solving problems. He built a successful business before entering politics and wants to bring a different approach to government. Supporters see him as honest and decisive, while critics see him as stubborn."
};

/* -------------------------- shape validation --------------------------- */

function validateShape(result, label) {
  const a = result.approval_rating;
  const p = result.poll_results;

  check(label + ": approval sums to 100", a.approve + a.disapprove + a.unsure === 100,
    String(a.approve + a.disapprove + a.unsure));
  check(label + ": poll sums to 100", p.candidate + p.opponent + p.undecided === 100,
    String(p.candidate + p.opponent + p.undecided));
  check(label + ": 4 age bands", result.demographics.age.length === 4);
  check(label + ": 4 political leans", result.demographics.lean.length === 4);
  check(label + ": 3 locations", result.demographics.location.length === 3);
  check(label + ": has strengths", result.strengths.length >= 1);
  check(label + ": has weaknesses", result.weaknesses.length >= 1);
  check(label + ": has events", result.events.length >= 1);
  check(label + ": has a summary", typeof result.analyst_summary === "string" && result.analyst_summary.length > 40);

  const allSupport = []
    .concat(result.demographics.age, result.demographics.lean, result.demographics.location)
    .map(g => g.support);
  check(label + ": every support value is 0-100", allSupport.every(v => v >= 0 && v <= 100));
  check(label + ": every group has a note",
    [].concat(result.demographics.age, result.demographics.lean, result.demographics.location)
      .every(g => typeof g.note === "string" && g.note.length > 0));
}

/* ------------------------------- tests --------------------------------- */

console.log("\ndata.js");
check("exposes 12 top issues", GameData.TOP_ISSUES.length === 12);
check("exposes 25 prebuilt politicians", GameData.PREBUILT_POLITICIANS.length === 25);
check("every prebuilt has all 8 fields", GameData.PREBUILT_POLITICIANS.every(p =>
  p.name && p.age && p.party && p.occupation && p.state && p.topIssue && p.slogan && p.about));
check("every prebuilt about is 3+ sentences", GameData.PREBUILT_POLITICIANS.every(p =>
  p.about.split(/[.!?]+/).filter(s => s.trim().length > 3).length >= 3));
check("every prebuilt topIssue is a real issue", GameData.PREBUILT_POLITICIANS.every(p =>
  GameData.TOP_ISSUES.some(i => i.value === p.topIssue)));
check("every prebuilt state is a real state", GameData.PREBUILT_POLITICIANS.every(p =>
  GameData.US_STATE_LIST.indexOf(p.state) !== -1));

console.log("\noffline engine: worked example");
validateShape(SimEngine.simulate({ candidate: EXAMPLE }), "John Carter");

console.log("\noffline engine: edge cases");
validateShape(SimEngine.simulate({ candidate: { name: "Empty Ed" } }), "almost-empty profile");
validateShape(SimEngine.simulate({
  candidate: EXAMPLE,
  opponent: GameData.PREBUILT_POLITICIANS[0]
}), "with a named opponent");

console.log("\noffline engine: determinism and variety");
const runA = SimEngine.simulate({ candidate: EXAMPLE, seed: "x" });
const runB = SimEngine.simulate({ candidate: EXAMPLE, seed: "x" });
const runC = SimEngine.simulate({ candidate: EXAMPLE, seed: "y" });
check("same seed gives the same poll",
  runA.poll_results.candidate === runB.poll_results.candidate);
check("different seed gives a different poll",
  runA.poll_results.candidate !== runC.poll_results.candidate ||
  runA.approval_rating.approve !== runC.approval_rating.approve);

console.log("\noffline engine: political neutrality");
/* The core fairness guarantee: take one profile and change NOTHING but the
   party label. The headline poll number must not move at all. What may
   move is which voter blocs start friendly: that is the point. */
const parties = ["Democrat", "Republican", "Independent", "Libertarian", "Green"];
const runs = parties.map(party =>
  SimEngine.simulate({ candidate: Object.assign({}, EXAMPLE, { party: party }), seed: "neutral" })
);
const shares = runs.map(r => r.poll_results.candidate);
const spread = Math.max.apply(null, shares) - Math.min.apply(null, shares);
check("party label alone does not move the poll at all", spread === 0,
  parties.map((p, i) => p + "=" + shares[i]).join(" "));
check("party label alone does not move approval",
  new Set(runs.map(r => r.approval_rating.approve)).size === 1);
check("party label DOES reshape the lean breakdown",
  new Set(runs.map(r => r.demographics.lean.map(g => g.support).join(","))).size === parties.length);
/* No issue is inherently worth more than another. The ONLY legitimate
   difference is whether the issue fits the candidate's old job, which is
   an explicit capped bonus rather than hidden noise. */
const issueRuns = GameData.TOP_ISSUES.map(i =>
  SimEngine.simulate({ candidate: Object.assign({}, EXAMPLE, { topIssue: i.value }), seed: "neutral" })
);
const issueShares = issueRuns.map(r => r.poll_results.candidate);
const issueSpread = Math.max.apply(null, issueShares) - Math.min.apply(null, issueShares);
check("top issue moves the poll only within the fit bonus (spread " + issueSpread + ")", issueSpread <= 5);
/* Distinct values should be few: fits and non-fits, not twelve different scores. */
check("issues fall into just a couple of tiers, not a ranking",
  new Set(issueShares).size <= 3, [...new Set(issueShares)].join(","));
/* And the fit bonus points the right way. */
const nurseHealth = SimEngine.simulate({ candidate: Object.assign({}, EXAMPLE, { occupation: "Nurse", topIssue: "Healthcare" }), seed: "fit" });
const nurseSecurity = SimEngine.simulate({ candidate: Object.assign({}, EXAMPLE, { occupation: "Nurse", topIssue: "National Security" }), seed: "fit" });
check("a nurse polls better on healthcare than on national security",
  nurseHealth.poll_results.candidate > nurseSecurity.poll_results.candidate,
  nurseHealth.poll_results.candidate + " vs " + nurseSecurity.poll_results.candidate);
check("the fit is explained in the strengths list",
  nurseHealth.strengths.concat(nurseHealth.weaknesses).some(s => /résumé/i.test(s.title)));

console.log("\noffline engine: all 25 prebuilt candidates");
let allValid = true;
GameData.PREBUILT_POLITICIANS.forEach(p => {
  const r = SimEngine.simulate({ candidate: p });
  const okApproval = r.approval_rating.approve + r.approval_rating.disapprove + r.approval_rating.unsure === 100;
  const okPoll = r.poll_results.candidate + r.poll_results.opponent + r.poll_results.undecided === 100;
  if (!okApproval || !okPoll) allValid = false;
});
check("all 25 produce totals of exactly 100", allValid);

const winners = GameData.PREBUILT_POLITICIANS
  .filter(p => SimEngine.simulate({ candidate: p }).poll_results.candidate >
               SimEngine.simulate({ candidate: p }).poll_results.opponent).length;
check("results are competitive, not a walkover (" + winners + "/25 win)", winners >= 6 && winners <= 22);

/* --------------------------- handler tests ----------------------------- */

function mockRes() {
  const res = { statusCode: 0, payload: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.payload = b; return res; };
  res.end = () => res;
  return res;
}

(async function runHandlerTests() {
  console.log("\napi/simulate.js");

  const ok = mockRes();
  await handler({ method: "POST", headers: {}, body: { candidate: EXAMPLE } }, ok);
  check("returns 200 with no API key set", ok.statusCode === 200);
  check("falls back to the offline model", ok.payload && ok.payload.source === "offline");
  check("explains the fallback to the user", typeof ok.payload.notice === "string");
  if (ok.payload && ok.payload.poll_results) validateShape(ok.payload, "handler output");

  const noName = mockRes();
  await handler({ method: "POST", headers: {}, body: { candidate: { age: 40 } } }, noName);
  check("rejects a candidate with no name", noName.statusCode === 400);

  const wrongMethod = mockRes();
  await handler({ method: "GET", headers: {} }, wrongMethod);
  check("rejects GET", wrongMethod.statusCode === 405);

  const preflight = mockRes();
  await handler({ method: "OPTIONS", headers: {} }, preflight);
  check("answers CORS preflight", preflight.statusCode === 204);

  console.log("\napi/simulate.js: response repair");
  const repaired = handler.normaliseResult({
    poll_results: { candidate: 60, opponent: 50, undecided: 10 },     // sums to 120
    approval_rating: { approve: 70, disapprove: 20, unsure: 20 },     // sums to 110
    analyst_summary: "A summary long enough to pass the minimum length requirement for validation.",
    strengths: [{ title: "a", detail: "b" }],
    weaknesses: [{ title: "c", detail: "d" }],
    demographics: { age: [{ group: "18-29", support: 250, note: "n" }] }, // out of range, missing bands
    events: [{ headline: "h", detail: "d", impact: 99, affected: "x" }],  // impact out of range
    projection: "TOTALLY MADE UP"
  }, { name: "X" }, null);

  const rp = repaired.poll_results;
  const ra = repaired.approval_rating;
  check("repairs an over-100 poll", rp.candidate + rp.opponent + rp.undecided === 100);
  check("repairs an over-100 approval", ra.approve + ra.disapprove + ra.unsure === 100);
  check("fills in missing age bands", repaired.demographics.age.length === 4);
  check("fills in missing leans", repaired.demographics.lean.length === 4);
  check("clamps out-of-range support", repaired.demographics.age.every(g => g.support <= 100));
  check("clamps out-of-range event impact", Math.abs(repaired.events[0].impact) <= 8);
  check("replaces an invalid projection", repaired.projection !== "TOTALLY MADE UP");

  console.log("\napi/simulate.js: input sanitising");
  const dirty = handler.cleanCandidate({
    name: "  Spaced   Out  ",
    about: "x".repeat(5000),
    age: "999",
    party: 12345
  });
  check("collapses whitespace in names", dirty.name === "Spaced Out");
  check("truncates a huge about field", dirty.about.length === 2000);
  check("clamps an absurd age", dirty.age === 120);
  check("drops non-string fields", dirty.party === "");

  console.log("\napi/_prompt.js: schema hygiene");
  const schema = JSON.stringify(handler.stripUnsupported(require("../api/_prompt.js").RESPONSE_SCHEMA));
  check("strips keywords OpenAI strict mode rejects", !/"minimum"|"maximum"/.test(schema));
  check("keeps enums", schema.indexOf("enum") !== -1);
  check("keeps additionalProperties:false", schema.indexOf('"additionalProperties":false') !== -1);

  console.log("\n" + (failed === 0 ? "PASS" : "FAIL") + ": " + passed + " passed, " + failed + " failed\n");
  process.exit(failed === 0 ? 0 : 1);
})();
