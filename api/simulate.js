/* =========================================================================
   api/simulate.js — Vercel Serverless Function.

   POST /api/simulate
   Body: { candidate: {...}, opponent: {...}|null }
   Returns: the election-simulation JSON described in api/_prompt.js

   THE API KEY NEVER LEAVES THIS FILE'S PROCESS. The browser posts the
   candidate here; this function adds the secret and talks to OpenAI. The
   key lives in the OPENAI_API_KEY environment variable, which Vercel keeps
   server-side and never ships to the client bundle.

   If OPENAI_API_KEY is missing, or OpenAI errors, or the response fails
   validation, we fall back to the local model in js/simulation-engine.js
   so the page always renders something for a classroom.
   ========================================================================= */

"use strict";

const { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildUserPrompt } = require("./_prompt.js");
const SimEngine = require("../js/simulation-engine.js");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 45000;

/* ------------------------------ rate limit ------------------------------ */
/* Serverless instances are short-lived, so this is a soft speed bump that
   stops one browser tab hammering the endpoint — not real abuse protection.
   For a school deployment that is enough. */
const RATE_LIMIT = { windowMs: 60000, max: 12 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const record = hits.get(ip) || { count: 0, start: now };
  if (now - record.start > RATE_LIMIT.windowMs) {
    record.count = 0;
    record.start = now;
  }
  record.count += 1;
  hits.set(ip, record);
  if (hits.size > 500) hits.clear();
  return record.count > RATE_LIMIT.max;
}

/* ------------------------------ sanitising ------------------------------ */

const FIELD_LIMITS = {
  name: 60, party: 60, occupation: 60, state: 60, topIssue: 60,
  slogan: 120, about: 2000
};

function cleanCandidate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  Object.keys(FIELD_LIMITS).forEach((key) => {
    const value = typeof raw[key] === "string" ? raw[key] : "";
    out[key] = value.replace(/\s+/g, " ").trim().slice(0, FIELD_LIMITS[key]);
  });
  const age = Number(raw.age);
  out.age = Number.isFinite(age) ? Math.min(120, Math.max(18, Math.round(age))) : 50;
  return out;
}

/* ------------------------- OpenAI schema cleanup ------------------------ */
/* Structured Outputs rejects some JSON Schema keywords. We keep them in
   _prompt.js because they document intent, then strip them here. */
const UNSUPPORTED = ["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength", "pattern", "format", "default"];

function stripUnsupported(node) {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;
  const out = {};
  Object.keys(node).forEach((key) => {
    if (UNSUPPORTED.indexOf(key) !== -1) return;
    out[key] = stripUnsupported(node[key]);
  });
  return out;
}

/* --------------------------- result validation -------------------------- */

const AGE_BANDS = ["18-29", "30-44", "45-64", "65+"];
const LEANS = ["Conservative", "Moderate", "Liberal", "Independent"];
const PLACES = ["Urban", "Suburban", "Rural"];

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

/* Force a three-part split to total exactly 100 without distorting it. */
function normaliseTriple(obj, keys) {
  const values = keys.map((k) => clampInt(obj[k], 0, 100, 33));
  let total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return { [keys[0]]: 34, [keys[1]]: 33, [keys[2]]: 33 };
  const scaled = values.map((v) => Math.round((v / total) * 100));
  let drift = 100 - scaled.reduce((a, b) => a + b, 0);
  let i = 0;
  while (drift !== 0) {
    const step = drift > 0 ? 1 : -1;
    if (scaled[i % 3] + step >= 0) { scaled[i % 3] += step; drift -= step; }
    i++;
    if (i > 60) break;
  }
  const result = {};
  keys.forEach((k, idx) => { result[k] = scaled[idx]; });
  return result;
}

/* Make sure every expected demographic bucket exists exactly once. */
function normaliseDemoList(list, expected, fallbackValue) {
  const byGroup = {};
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const match = expected.find(
      (e) => String(item.group || "").toLowerCase().indexOf(e.toLowerCase()) !== -1
    );
    if (match && !byGroup[match]) {
      byGroup[match] = {
        group: match,
        support: clampInt(item.support, 0, 100, fallbackValue),
        note: String(item.note || "").slice(0, 400)
      };
    }
  });
  return expected.map(
    (g) => byGroup[g] || { group: g, support: fallbackValue, note: "No clear signal from this group in the simulation." }
  );
}

function normalisePoints(list, max) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && typeof p === "object" && p.title)
    .slice(0, max)
    .map((p) => ({
      title: String(p.title).slice(0, 80),
      detail: String(p.detail || "").slice(0, 600)
    }));
}

function normaliseEvents(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && typeof e === "object" && e.headline)
    .slice(0, 6)
    .map((e) => ({
      headline: String(e.headline).slice(0, 100),
      detail: String(e.detail || "").slice(0, 600),
      impact: clampInt(e.impact, -8, 8, 0),
      affected: String(e.affected || "All voters").slice(0, 60)
    }));
}

const PROJECTIONS = ["Comfortable Win", "Likely Win", "Narrow Win", "Too Close to Call", "Narrow Loss", "Likely Loss", "Clear Loss"];

function projectionFromMargin(margin) {
  if (margin >= 10) return "Comfortable Win";
  if (margin >= 4) return "Likely Win";
  if (margin >= 1) return "Narrow Win";
  if (margin > -1) return "Too Close to Call";
  if (margin > -4) return "Narrow Loss";
  if (margin > -10) return "Likely Loss";
  return "Clear Loss";
}

/* Takes whatever the model returned and guarantees the shape the front end
   expects. Throws if the payload is too broken to repair. */
function normaliseResult(raw, candidate, opponent) {
  if (!raw || typeof raw !== "object") throw new Error("empty model response");

  const poll = normaliseTriple(raw.poll_results || {}, ["candidate", "opponent", "undecided"]);
  const approval = normaliseTriple(raw.approval_rating || {}, ["approve", "disapprove", "unsure"]);
  const margin = poll.candidate - poll.opponent;

  const demographics = raw.demographics || {};
  const summary = String(raw.analyst_summary || "").slice(0, 1500);
  if (!summary) throw new Error("model returned no summary");

  const strengths = normalisePoints(raw.strengths, 5);
  const weaknesses = normalisePoints(raw.weaknesses, 5);
  if (!strengths.length || !weaknesses.length) throw new Error("model returned no analysis");

  return {
    source: "ai",
    model: DEFAULT_MODEL,
    candidate_name: String(raw.candidate_name || candidate.name || "Your candidate").slice(0, 80),
    opponent_name: String(
      raw.opponent_name || (opponent && opponent.name) || "Generic Opponent"
    ).slice(0, 80),
    projection: PROJECTIONS.indexOf(raw.projection) !== -1 ? raw.projection : projectionFromMargin(margin),
    approval_rating: approval,
    poll_results: poll,
    demographics: {
      age: normaliseDemoList(demographics.age, AGE_BANDS, poll.candidate),
      lean: normaliseDemoList(demographics.lean, LEANS, poll.candidate),
      location: normaliseDemoList(demographics.location, PLACES, poll.candidate)
    },
    strengths: strengths,
    weaknesses: weaknesses,
    events: normaliseEvents(raw.events),
    analyst_summary: summary
  };
}

/* ------------------------------ OpenAI call ----------------------------- */

async function callOpenAI(candidate, opponent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.85,
        max_tokens: 2400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(candidate, opponent) }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "election_simulation",
            strict: true,
            schema: stripUnsupported(RESPONSE_SCHEMA)
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error("OpenAI " + response.status + ": " + body.slice(0, 300));
    }

    const payload = await response.json();
    const message = payload.choices && payload.choices[0] && payload.choices[0].message;
    if (!message || message.refusal) throw new Error("model refused: " + (message && message.refusal));
    return JSON.parse(message.content);
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------- handler ------------------------------- */

module.exports = async function handler(req, res) {
  /* Same-origin by default. Set ALLOWED_ORIGIN if the front end is hosted
     somewhere else (e.g. still on GitHub Pages). */
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many simulations in a row. Wait a minute and try again." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  const candidate = cleanCandidate(body && body.candidate);
  if (!candidate || !candidate.name) {
    res.status(400).json({ error: "A candidate with at least a name is required." });
    return;
  }
  const opponent = cleanCandidate(body && body.opponent);
  const hasOpponent = opponent && opponent.name ? opponent : null;

  if (!process.env.OPENAI_API_KEY) {
    const offline = SimEngine.simulate({ candidate: candidate, opponent: hasOpponent });
    offline.notice = "No OpenAI key is configured on the server, so this result came from the built-in offline model.";
    res.status(200).json(offline);
    return;
  }

  try {
    const raw = await callOpenAI(candidate, hasOpponent);
    res.status(200).json(normaliseResult(raw, candidate, hasOpponent));
  } catch (err) {
    console.error("[simulate] falling back to offline model:", err && err.message);
    const offline = SimEngine.simulate({ candidate: candidate, opponent: hasOpponent });
    offline.notice = "The AI analyst could not be reached, so this result came from the built-in offline model.";
    res.status(200).json(offline);
  }
};

/* Exported for the local test harness in scripts/test-api.js */
module.exports.normaliseResult = normaliseResult;
module.exports.cleanCandidate = cleanCandidate;
module.exports.stripUnsupported = stripUnsupported;
