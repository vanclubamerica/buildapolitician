/* =========================================================================
   builder.js — Create Politician page.

   Keeps one `candidate` object in memory, mirrors it onto the preview card
   and the completion rail, and persists it to localStorage. Shared card /
   tile rendering lives in app.js (CandidateUI) so the opponent page and
   the simulator stay in sync with this schema.
   ========================================================================= */

let candidate = CandidateUI.blank();

/* --------------------------- section state --------------------------- */

/* Marks a step card green once its field is filled. Pure visual feedback,
   but it is what makes the page feel like a character creator rather than
   a form. */
function refreshStepStates() {
  CandidateUI.REQUIRED.forEach(field => {
    const step = document.getElementById("step-" + field.key);
    if (!step) return;
    step.classList.toggle("is-complete", CandidateUI.isFilled(candidate, field.key));
  });
}

function refreshCompletion() {
  const { done, total, pct } = CandidateUI.completeness(candidate);
  document.getElementById("completionPct").textContent = pct + "%";
  document.getElementById("completionMeter").style.width = pct + "%";

  const list = document.getElementById("checklist");
  list.innerHTML = CandidateUI.REQUIRED.map(f =>
    `<li class="${CandidateUI.isFilled(candidate, f.key) ? "done" : ""}">${f.label}</li>`
  ).join("");

  const cta = document.getElementById("toSimBtn");
  if (cta) {
    cta.textContent = done === total
      ? "⚡ Run Election Simulation →"
      : `⚡ Run Simulation (${done}/${total} done)`;
  }
}

let previewTimer = null;
function updatePreview(pop) {
  const card = document.getElementById("previewCard");
  card.innerHTML = CandidateUI.cardHtml(candidate, { showAbout: true });
  if (pop) {
    card.classList.remove("pop");
    void card.offsetWidth;            // restart the animation
    card.classList.add("pop");
  }
  refreshStepStates();
  refreshCompletion();

  /* Autosave, debounced, so a student never loses work by navigating away. */
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => Storage.save(Storage.KEY_PLAYER, candidate), 400);
}

/* ------------------------------- fields ------------------------------- */

function bindText(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = candidate[key] || "";
  el.addEventListener("input", () => {
    candidate[key] = el.value;
    updatePreview();
  });
}

function renderPartyTiles() {
  CandidateUI.renderTiles(
    document.getElementById("partyTiles"),
    GameData.PARTIES,
    partySelection(),
    value => {
      const wrap = document.getElementById("customPartyWrap");
      if (value === "Custom") {
        wrap.style.display = "";
        const input = document.getElementById("customPartyInput");
        candidate.party = input.value.trim();
        input.focus();
      } else {
        wrap.style.display = "none";
        candidate.party = value;
      }
      updatePreview(true);
    }
  );
}

/* Which party tile should read as selected — the named one, or Custom. */
function partySelection() {
  if (!candidate.party) return "";
  const known = GameData.PARTIES.some(p => p.value === candidate.party);
  return known ? candidate.party : "Custom";
}

function renderOccupationTiles() {
  const known = GameData.OCCUPATIONS.some(o => o.value === candidate.occupation);
  CandidateUI.renderTiles(
    document.getElementById("occupationTiles"),
    GameData.OCCUPATIONS,
    candidate.occupation && !known ? "Custom" : candidate.occupation,
    value => {
      const wrap = document.getElementById("customOccupationWrap");
      if (value === "Custom") {
        wrap.style.display = "";
        const input = document.getElementById("customOccupationInput");
        candidate.occupation = input.value.trim();
        input.focus();
      } else {
        wrap.style.display = "none";
        candidate.occupation = value;
      }
      updatePreview(true);
    }
  );
}

function renderIssueTiles() {
  CandidateUI.renderTiles(
    document.getElementById("issueTiles"),
    GameData.TOP_ISSUES,
    candidate.topIssue,
    value => { candidate.topIssue = value; updatePreview(true); }
  );
}

function setAge(value) {
  candidate.age = Number(value);
  document.getElementById("ageNum").textContent = candidate.age;
  document.getElementById("ageTag").textContent = CandidateUI.ageTag(candidate.age);
  document.getElementById("ageInput").value = candidate.age;
}

/* -------------------------- guided About box -------------------------- */

function renderAboutPrompts() {
  const wrap = document.getElementById("aboutPrompts");
  wrap.innerHTML = "";
  GameData.ABOUT_PROMPTS.forEach((p, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "prompt-chip";
    chip.dataset.index = index;
    chip.textContent = p.q;
    chip.title = "Add a sentence starter for this question";
    chip.addEventListener("click", () => insertStarter(p.starter));
    wrap.appendChild(chip);
  });
  markUsedPrompts();
}

/* Drops a sentence starter at the end of the textarea, with the candidate's
   own name substituted in so it reads naturally. */
function insertStarter(starter) {
  const box = document.getElementById("aboutInput");
  const name = (candidate.name || "").trim() || "This candidate";
  const text = starter.replace(/NAME/g, name);
  const current = box.value.replace(/\s+$/, "");
  const needsSpace = current.length > 0;
  box.value = current + (needsSpace ? " " : "") + text;
  candidate.about = box.value;
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
  playBlip(600, 0.07);
  updateSentenceMeter();
  updatePreview();
}

/* A prompt counts as "used" once enough sentences exist to cover it. This
   is a nudge, not a grade — students can write however they like. */
function markUsedPrompts() {
  const sentences = CandidateUI.sentenceCount(candidate.about);
  document.querySelectorAll("#aboutPrompts .prompt-chip").forEach(chip => {
    chip.classList.toggle("used", Number(chip.dataset.index) < sentences);
  });
}

function updateSentenceMeter() {
  const count = CandidateUI.sentenceCount(candidate.about);
  const dots = document.getElementById("sentenceDots");
  dots.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const dot = document.createElement("i");
    if (i < count) dot.className = i < 5 ? "filled" : "over";
    dots.appendChild(dot);
  }

  const status = document.getElementById("sentenceStatus");
  const word = count === 1 ? "sentence" : "sentences";
  if (count === 0)      { status.textContent = "0 sentences — aim for 3 to 5"; status.className = "sentence-status"; }
  else if (count < 3)   { status.textContent = `${count} ${word} — keep going, 3 is the minimum`; status.className = "sentence-status warn"; }
  else if (count <= 5)  { status.textContent = `${count} ${word} — that is the sweet spot`; status.className = "sentence-status good"; }
  else                  { status.textContent = `${count} ${word} — plenty. The analyst reads all of it.`; status.className = "sentence-status good"; }

  markUsedPrompts();
}

/* ------------------------------ actions ------------------------------ */

function showFormMessage(msg, isError) {
  const el = document.getElementById("formMessage");
  el.textContent = msg;
  el.style.color = isError ? "var(--red-400)" : "#6be089";
}

function applyCandidate(next, message) {
  candidate = Object.assign(CandidateUI.blank(), next);
  syncAllInputs();
  if (message) showFormMessage(message, false);
  playBlip(660, 0.12, "triangle");
}

/* Pushes the whole candidate object back out into every control. Called on
   load, on Surprise Me, on Load Example, and on file import. */
function syncAllInputs() {
  document.getElementById("nameInput").value = candidate.name || "";
  document.getElementById("sloganInput").value = candidate.slogan || "";
  document.getElementById("aboutInput").value = candidate.about || "";
  setAge(candidate.age);

  const knownParty = GameData.PARTIES.some(p => p.value === candidate.party);
  document.getElementById("customPartyWrap").style.display =
    (candidate.party && !knownParty) ? "" : "none";
  document.getElementById("customPartyInput").value =
    (candidate.party && !knownParty) ? candidate.party : "";

  const knownOcc = GameData.OCCUPATIONS.some(o => o.value === candidate.occupation);
  document.getElementById("customOccupationWrap").style.display =
    (candidate.occupation && !knownOcc) ? "" : "none";
  document.getElementById("customOccupationInput").value =
    (candidate.occupation && !knownOcc) ? candidate.occupation : "";

  CandidateUI.fillSelect(document.getElementById("stateSelect"), GameData.US_STATE_LIST, candidate.state);
  renderPartyTiles();
  renderOccupationTiles();
  renderIssueTiles();
  CandidateUI.renderSwatches(document.getElementById("colorSwatches"), candidate.logoColor,
    color => { candidate.logoColor = color; updatePreview(true); });
  updateSentenceMeter();
  updatePreview(true);
}

function randomizeCandidate() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const name = GameData.generateRandomName();
  const first = name.split(" ")[0];
  const occupation = pick(GameData.OCCUPATIONS.filter(o => o.value !== "Custom")).value;
  const issue = pick(GameData.TOP_ISSUES).value;

  applyCandidate({
    name: name,
    age: 30 + Math.floor(Math.random() * 45),
    party: pick(GameData.PARTIES.filter(p => p.value !== "Custom")).value,
    occupation: occupation,
    state: pick(GameData.US_STATE_LIST),
    topIssue: issue,
    slogan: GameData.generateRandomSlogan(),
    about: [
      `${name} is ${pick(GameData.RANDOM_TEMPERAMENTS)} ${occupation.toLowerCase()} from a place most politicians fly over.`,
      `${first} ran for office because ${pick(GameData.RANDOM_MOTIVES)}.`,
      `As a leader, ${first} ${pick(GameData.RANDOM_LEAD_STYLES)}.`,
      `The campaign lives and dies on ${issue.toLowerCase()}, and ${first} will not talk about much else.`,
      `Supporters find ${first} ${pick(GameData.RANDOM_VIEWS)}.`
    ].join(" "),
    logoColor: pick(GameData.LOGO_COLOR_PALETTE)
  }, "Random candidate generated. Edit anything you like.");
}

function downloadCandidate() {
  const blob = new Blob([JSON.stringify(candidate, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (candidate.name ? candidate.name.replace(/\s+/g, "-").toLowerCase() : "candidate") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------- init -------------------------------- */

function initBuilderPage() {
  const saved = Storage.load(Storage.KEY_PLAYER);
  if (saved) candidate = Object.assign(CandidateUI.blank(), saved);

  bindText("nameInput", "name");
  bindText("sloganInput", "slogan");

  document.getElementById("aboutInput").addEventListener("input", e => {
    candidate.about = e.target.value;
    updateSentenceMeter();
    updatePreview();
  });

  document.getElementById("ageInput").addEventListener("input", e => {
    setAge(e.target.value);
    updatePreview();
  });

  document.getElementById("stateSelect").addEventListener("change", e => {
    candidate.state = e.target.value;
    updatePreview(true);
  });

  document.getElementById("customPartyInput").addEventListener("input", e => {
    candidate.party = e.target.value;
    updatePreview();
  });

  document.getElementById("customOccupationInput").addEventListener("input", e => {
    candidate.occupation = e.target.value;
    updatePreview();
  });

  renderAboutPrompts();
  syncAllInputs();

  document.getElementById("randomNameBtn").addEventListener("click", () => {
    candidate.name = GameData.generateRandomName();
    document.getElementById("nameInput").value = candidate.name;
    playBlip(620, 0.08);
    updatePreview(true);
  });

  document.getElementById("randomSloganBtn").addEventListener("click", () => {
    candidate.slogan = GameData.generateRandomSlogan();
    document.getElementById("sloganInput").value = candidate.slogan;
    playBlip(620, 0.08);
    updatePreview(true);
  });

  document.getElementById("randomCandidateBtn").addEventListener("click", randomizeCandidate);

  document.getElementById("exampleBtn").addEventListener("click", () => {
    applyCandidate(GameData.EXAMPLE_CANDIDATE,
      "Loaded the example candidate. Change anything — it is only a starting point.");
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    const missing = CandidateUI.REQUIRED.filter(f => !CandidateUI.isFilled(candidate, f.key));
    Storage.save(Storage.KEY_PLAYER, candidate);
    if (missing.length) {
      showFormMessage("Saved, but still empty: " + missing.map(m => m.label).join(", ") +
        ". The simulation works best with everything filled in.", true);
    } else {
      showFormMessage("Candidate saved. Head to the Election Simulator whenever you are ready.", false);
      playBlip(720, 0.15, "triangle");
      launchConfetti(document.querySelector(".confetti-layer"), 40);
    }
  });

  document.getElementById("downloadBtn").addEventListener("click", downloadCandidate);

  document.getElementById("loadInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyCandidate(JSON.parse(reader.result), "Candidate loaded from file.");
      } catch (err) {
        showFormMessage("That file could not be read as a candidate JSON.", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset the builder? This clears every field.")) return;
    Storage.remove(Storage.KEY_PLAYER);
    Storage.remove(Storage.KEY_RESULT);
    candidate = CandidateUI.blank();
    syncAllInputs();
    showFormMessage("Builder reset.", false);
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", initBuilderPage);
