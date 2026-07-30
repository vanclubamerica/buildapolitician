/* =========================================================================
   opponent.js: Choose Opponent page (optional step).

   Two ways to set an opponent: pick one of the 25 fictional pre-built
   politicians, or build a custom one. Both produce the same candidate
   schema the builder produces, so the simulator treats them identically.
   Leaving this page untouched is fine. The analyst invents a rival.
   ========================================================================= */

let opponent = CandidateUI.blank();

function oppEl(id) { return document.getElementById(id); }

/* ------------------------------- tabs -------------------------------- */

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");
      playBlip(480, 0.06);
    });
  });
}

/* ---------------------------- current pick ---------------------------- */

function refreshCurrentOpponent() {
  const saved = Storage.load(Storage.KEY_OPPONENT);
  const bar = oppEl("currentOpponent");
  if (saved && saved.name) {
    bar.style.display = "";
    oppEl("currentOpponentName").textContent = saved.name + ", " + (saved.party || "Independent");
  } else {
    bar.style.display = "none";
  }
  highlightSelectedRosterCard(saved);
}

function highlightSelectedRosterCard(saved) {
  document.querySelectorAll("#rosterGrid .opponent-card").forEach(card => {
    card.classList.toggle("selected", !!saved && card.dataset.id === saved.id);
  });
}

/* ------------------------------ roster ------------------------------- */

function renderRoster(filter) {
  const grid = oppEl("rosterGrid");
  const term = String(filter || "").toLowerCase().trim();
  const list = GameData.PREBUILT_POLITICIANS.filter(p =>
    !term ||
    p.name.toLowerCase().includes(term) ||
    p.party.toLowerCase().includes(term) ||
    p.occupation.toLowerCase().includes(term) ||
    p.topIssue.toLowerCase().includes(term)
  );

  oppEl("rosterMessage").textContent = term
    ? `${list.length} of ${GameData.PREBUILT_POLITICIANS.length} politicians match "${filter}".`
    : "";

  grid.innerHTML = "";
  list.forEach(p => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "opponent-card";
    card.dataset.id = p.id;
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <h4>${CandidateUI.escape(p.name)}</h4>
      <span class="candidate-party">${CandidateUI.escape(p.party)}</span>
      <p>${CandidateUI.escape(p.slogan)}</p>
      <p class="mt-1"><span class="pill">${CandidateUI.escape(p.topIssue)}</span></p>
      <p class="mt-1">Age ${CandidateUI.escape(p.age)}, ${CandidateUI.escape(p.state)}, was a ${CandidateUI.escape(p.occupation)}</p>`;
    card.addEventListener("click", () => {
      Storage.save(Storage.KEY_OPPONENT, p);
      refreshCurrentOpponent();
      playBlip(700, 0.12, "triangle");
      oppEl("rosterMessage").textContent = `${p.name} is now your opponent.`;
    });
    grid.appendChild(card);
  });

  highlightSelectedRosterCard(Storage.load(Storage.KEY_OPPONENT));
}

/* --------------------------- custom builder --------------------------- */

function updateOpponentPreview() {
  oppEl("oppPreviewCard").innerHTML = CandidateUI.cardHtml(opponent, { showAbout: true });
}

function bindOppField(id, key, isNumber) {
  const el = oppEl(id);
  if (!el) return;
  el.value = opponent[key] || "";
  el.addEventListener("input", () => {
    opponent[key] = isNumber ? Number(el.value) : el.value;
    updateOpponentPreview();
  });
}

function randomizeOpponent() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const name = GameData.generateRandomName();
  const first = name.split(" ")[0];
  const occupation = pick(GameData.OCCUPATIONS.filter(o => o.value !== "Custom")).value;
  const issue = pick(GameData.TOP_ISSUES).value;

  opponent = Object.assign(CandidateUI.blank(), {
    name: name,
    age: 35 + Math.floor(Math.random() * 40),
    party: pick(GameData.PARTIES.filter(p => p.value !== "Custom")).value,
    occupation: occupation,
    state: pick(GameData.US_STATE_LIST),
    topIssue: issue,
    slogan: GameData.generateRandomSlogan(),
    about: [
      `${name} is ${pick(GameData.RANDOM_TEMPERAMENTS)} ${occupation.toLowerCase()} with a long list of people who owe them favors.`,
      `${first} ran for office because ${pick(GameData.RANDOM_MOTIVES)}.`,
      `As a leader, ${first} ${pick(GameData.RANDOM_LEAD_STYLES)}.`,
      `Supporters find ${first} ${pick(GameData.RANDOM_VIEWS)}.`
    ].join(" "),
    logoColor: pick(GameData.LOGO_COLOR_PALETTE)
  });

  syncOpponentInputs();
  playBlip(660, 0.12, "triangle");
}

function syncOpponentInputs() {
  oppEl("oppNameInput").value = opponent.name || "";
  oppEl("oppPartyInput").value = opponent.party || "";
  oppEl("oppAgeInput").value = opponent.age || 52;
  oppEl("oppOccupationInput").value = opponent.occupation || "";
  oppEl("oppSloganInput").value = opponent.slogan || "";
  oppEl("oppAboutInput").value = opponent.about || "";
  CandidateUI.fillSelect(oppEl("oppStateSelect"), GameData.US_STATE_LIST, opponent.state);
  CandidateUI.fillSelect(oppEl("oppIssueSelect"),
    GameData.TOP_ISSUES.map(i => i.value), opponent.topIssue);
  updateOpponentPreview();
}

/* -------------------------------- init -------------------------------- */

function initOpponentPage() {
  initTabs();

  const saved = Storage.load(Storage.KEY_OPPONENT);
  if (saved && !saved.prebuilt) opponent = Object.assign(CandidateUI.blank(), saved);

  bindOppField("oppNameInput", "name");
  bindOppField("oppPartyInput", "party");
  bindOppField("oppAgeInput", "age", true);
  bindOppField("oppOccupationInput", "occupation");
  bindOppField("oppSloganInput", "slogan");
  bindOppField("oppAboutInput", "about");

  syncOpponentInputs();

  oppEl("oppStateSelect").addEventListener("change", e => {
    opponent.state = e.target.value;
    updateOpponentPreview();
  });
  oppEl("oppIssueSelect").addEventListener("change", e => {
    opponent.topIssue = e.target.value;
    updateOpponentPreview();
  });

  oppEl("oppRandomSloganBtn").addEventListener("click", () => {
    opponent.slogan = GameData.generateRandomSlogan();
    oppEl("oppSloganInput").value = opponent.slogan;
    updateOpponentPreview();
    playBlip(620, 0.08);
  });

  oppEl("oppRandomizeBtn").addEventListener("click", randomizeOpponent);

  oppEl("oppSaveBtn").addEventListener("click", () => {
    const message = oppEl("oppFormMessage");
    if (!opponent.name.trim()) {
      message.textContent = "Give your opponent a name first.";
      message.className = "form-msg error";
      return;
    }
    opponent.id = opponent.name.toLowerCase().replace(/[^a-z]+/g, "-");
    opponent.prebuilt = false;
    Storage.save(Storage.KEY_OPPONENT, opponent);
    refreshCurrentOpponent();
    message.textContent = `${opponent.name} saved.`;
    message.className = "form-msg ok";
    playBlip(720, 0.15, "triangle");
  });

  oppEl("clearOpponentBtn").addEventListener("click", () => {
    Storage.remove(Storage.KEY_OPPONENT);
    refreshCurrentOpponent();
    oppEl("rosterMessage").textContent = "Opponent cleared. The AI analyst will invent one.";
  });

  oppEl("rosterSearch").addEventListener("input", e => renderRoster(e.target.value));

  renderRoster("");
  refreshCurrentOpponent();
}

document.addEventListener("DOMContentLoaded", initOpponentPage);
