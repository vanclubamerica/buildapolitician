/* =========================================================================
   simulator.js — the AI Election Simulator page.

   Flow:
     1. Load the saved candidate (and optional opponent) from localStorage.
     2. POST them to /api/simulate, which adds the OpenAI key server-side.
     3. If that endpoint does not exist (e.g. the site is being served from
        GitHub Pages or opened as a local file) or fails, fall back to the
        offline model in simulation-engine.js so the page always works.
     4. Save the result and hand it to report.js to render.

   The API key is never referenced here. This file has no idea what it is.
   ========================================================================= */

const API_ENDPOINT = "/api/simulate";

/* Rotating status lines while the model thinks — a request takes a few
   seconds and a static spinner feels broken. */
const STATUS_LINES = [
  "Contacting the polling analyst…",
  "Reading the candidate profile…",
  "Assembling a sample of fictional voters…",
  "Running the head-to-head matchup…",
  "Breaking results down by age, lean, and location…",
  "Writing up strengths and weaknesses…",
  "Reviewing the campaign timeline…"
];

let statusTimer = null;
let running = false;

function el(id) { return document.getElementById(id); }

/* ------------------------------ matchup ------------------------------- */

/* A stand-in card for when the student has not chosen an opponent — the
   analyst will invent one. */
function placeholderOpponent() {
  return {
    name: "AI-Chosen Opponent",
    party: "To be decided",
    slogan: "The analyst will invent a credible rival",
    age: "—", state: "—", occupation: "—", topIssue: "—",
    logoColor: "#4a5670"
  };
}

function renderMatchup(candidate, opponent) {
  el("matchupA").innerHTML = CandidateUI.cardHtml(candidate, { showAbout: false });
  el("matchupB").innerHTML = CandidateUI.cardHtml(opponent || placeholderOpponent(), { showAbout: false });
}

function renderReadiness(candidate, opponent) {
  const { done, total } = CandidateUI.completeness(candidate);
  const missing = CandidateUI.REQUIRED.filter(f => !CandidateUI.isFilled(candidate, f.key));
  const note = el("readinessNote");

  if (missing.length) {
    note.innerHTML = `Your profile is <strong>${done} of ${total}</strong> complete. Missing: ` +
      CandidateUI.escape(missing.map(m => m.label).join(", ")) +
      `. You can run it anyway, but a thin profile gets a thin report.`;
  } else {
    note.innerHTML = opponent
      ? `Profile complete, running against <strong>${CandidateUI.escape(opponent.name)}</strong>.`
      : `Profile complete. No opponent chosen, so the analyst will invent a credible one.`;
  }

  el("oppLink").textContent = opponent ? "Change Opponent" : "Choose an Opponent";
}

/* ------------------------------ thinking ------------------------------ */

function startThinking() {
  el("launchPanel").style.display = "none";
  el("resultBlock").classList.remove("active");
  el("aiThinking").classList.add("active");
  el("simError").textContent = "";

  let index = 0;
  el("aiStatus").textContent = STATUS_LINES[0];
  statusTimer = setInterval(() => {
    index = (index + 1) % STATUS_LINES.length;
    el("aiStatus").textContent = STATUS_LINES[index];
  }, 1800);
}

function stopThinking() {
  clearInterval(statusTimer);
  statusTimer = null;
  el("aiThinking").classList.remove("active");
  el("launchPanel").style.display = "";
}

/* ------------------------------- running ------------------------------ */

/* Try the serverless endpoint. Any non-JSON response (a 404 HTML page on
   GitHub Pages, for instance) counts as "no backend here". */
async function requestSimulation(candidate, opponent) {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate: candidate, opponent: opponent })
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("no-backend");
  }

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The simulator returned an error.");
  return payload;
}

function runOffline(candidate, opponent, reason) {
  const result = SimEngine.simulate({
    candidate: candidate,
    opponent: opponent,
    seed: String(Date.now())
  });
  result.notice = reason;
  return result;
}

async function runSimulation() {
  if (running) return;
  running = true;

  const candidate = Storage.load(Storage.KEY_PLAYER);
  const opponent = Storage.load(Storage.KEY_OPPONENT);
  el("runBtn").disabled = true;
  startThinking();
  playBlip(440, 0.14, "triangle");

  /* Keep the animation on screen long enough to read, even on a fast
     response — otherwise it flashes and looks like a glitch. */
  const minimumWait = new Promise(resolve => setTimeout(resolve, 1600));
  let result;

  try {
    const [payload] = await Promise.all([requestSimulation(candidate, opponent), minimumWait]);
    result = payload;
  } catch (err) {
    await minimumWait;
    result = err && err.message === "no-backend"
      ? runOffline(candidate, opponent,
          "This copy of the site is running without the AI backend, so the built-in offline model produced these numbers. Deploy to Vercel with an OPENAI_API_KEY to get the AI analyst.")
      : runOffline(candidate, opponent,
          "The AI analyst could not be reached, so the built-in offline model produced these numbers.");
  }

  result.ranAt = new Date().toISOString();
  result.candidateSnapshot = candidate;
  result.opponentSnapshot = opponent || null;
  Storage.save(Storage.KEY_RESULT, result);

  stopThinking();
  el("runBtn").disabled = false;
  el("runBtn").textContent = "⚡ Run Simulation Again";
  running = false;

  Report.render(el("reportRoot"), result);
  el("resultBlock").classList.add("active");
  el("resultBlock").scrollIntoView({ behavior: "smooth", block: "start" });

  const won = result.poll_results.candidate > result.poll_results.opponent;
  playBlip(won ? 780 : 260, 0.25, "triangle");
  if (won) launchConfetti(el("confettiLayer"), 90);
}

/* -------------------------------- init -------------------------------- */

function initSimulatorPage() {
  const candidate = Storage.load(Storage.KEY_PLAYER);
  const opponent = Storage.load(Storage.KEY_OPPONENT);

  if (!candidate || !candidate.name) {
    el("missingNotice").style.display = "block";
    el("simConsole").style.display = "none";
    return;
  }

  el("missingNotice").style.display = "none";
  el("simConsole").style.display = "block";

  renderMatchup(candidate, opponent);
  renderReadiness(candidate, opponent);

  el("runBtn").addEventListener("click", runSimulation);
  el("rerunBtn").addEventListener("click", runSimulation);
  el("printReportBtn").addEventListener("click", () => window.print());

  /* If a report was already run this session, show it straight away rather
     than making the student run it again to see it. */
  const previous = Storage.load(Storage.KEY_RESULT);
  if (previous && previous.poll_results) {
    Report.render(el("reportRoot"), previous);
    el("resultBlock").classList.add("active");
    el("runBtn").textContent = "⚡ Run Simulation Again";
  }
}

document.addEventListener("DOMContentLoaded", initSimulatorPage);
