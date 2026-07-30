/* =========================================================================
   results.js — reads the last simulation saved by simulator.js and renders
   the full breakdown. The heavy lifting is in report.js; this file only
   handles the banner, the candidate card, and the page-level actions.
   ========================================================================= */

function initResultsPage() {
  const result = Storage.load(Storage.KEY_RESULT);
  const missing = document.getElementById("resultsMissing");
  const wrap = document.getElementById("resultsWrap");

  if (!result || !result.poll_results) {
    missing.style.display = "block";
    wrap.style.display = "none";
    return;
  }

  missing.style.display = "none";
  wrap.style.display = "block";

  const poll = result.poll_results;
  const margin = poll.candidate - poll.opponent;
  const won = margin > 0;
  const tied = margin === 0;

  document.getElementById("resultEyebrow").textContent = result.projection;
  document.getElementById("winnerBannerText").textContent = tied
    ? "Too Close to Call"
    : (won ? `${result.candidate_name} Wins` : `${result.opponent_name} Wins`);
  document.getElementById("winnerBannerSub").textContent =
    `${result.candidate_name} ${poll.candidate}% · ${result.opponent_name} ${poll.opponent}% · Undecided ${poll.undecided}%`;

  const candidate = result.candidateSnapshot || Storage.load(Storage.KEY_PLAYER);
  if (candidate) {
    document.getElementById("resultCandidateCard").innerHTML =
      CandidateUI.cardHtml(candidate, { showAbout: true });
  }

  if (result.ranAt) {
    const when = new Date(result.ranAt);
    document.getElementById("ranAtNote").textContent =
      "Simulation run " + when.toLocaleString() +
      (result.source === "ai" ? " by the AI analyst." : " by the offline model.");
  }

  Report.render(document.getElementById("reportRoot"), result);

  document.getElementById("printResultsBtn").addEventListener("click", () => window.print());

  document.getElementById("downloadResultsBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (result.candidate_name || "candidate").replace(/\s+/g, "-").toLowerCase() + "-simulation.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  if (won) launchConfetti(document.getElementById("confettiLayer"), 80);
}

document.addEventListener("DOMContentLoaded", initResultsPage);
