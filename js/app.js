/* =========================================================================
   app.js: site-wide behavior shared by every page:
   theme toggle, mobile nav, storage helpers, confetti, sound toggles.
   ========================================================================= */

const Storage = {
  KEY_PLAYER: "bap_player_candidate",
  KEY_OPPONENT: "bap_opponent_candidate",
  KEY_RESULT: "bap_last_result",
  KEY_THEME: "bap_theme",
  KEY_SOUND: "bap_sound_enabled",
  KEY_MUSIC: "bap_music_enabled",

  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn("Storage save failed", e); }
  },
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { console.warn("Storage load failed", e); return null; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

/* ---------------------------- Theme toggle ---------------------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  Storage.save(Storage.KEY_THEME, theme);
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    /* The button label names the mode you would switch TO. */
    btn.textContent = theme === "dark" ? "Light" : "Dark";
  });
}

function initTheme() {
  const saved = Storage.load(Storage.KEY_THEME) || "light";
  applyTheme(saved);
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "light" ? "dark" : "light");
    });
  });
}

/* ---------------------------- Mobile nav ---------------------------- */
function initMobileNav() {
  const toggle = document.querySelector(".nav-burger");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---------------------------- Sound / music toggles ---------------------------- */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}

/* Generates a short synthesized blip so the site needs zero external audio
   files while still supporting a "sound effects" toggle. */
function playBlip(freq = 440, duration = 0.12, type = "sine") {
  if (Storage.load(Storage.KEY_SOUND) === false) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}
window.playBlip = playBlip;

/* Simple ambient "hum" loop for the background-music toggle. Built from
   oscillators only, no external audio files, keeping the project 100%
   self-contained for GitHub Pages. */
let musicNodes = null;
function startMusic() {
  const ctx = getAudioCtx();
  if (!ctx || musicNodes) return;
  const master = ctx.createGain();
  master.gain.value = 0.035;
  master.connect(ctx.destination);
  const freqs = [130.81, 164.81, 196.0];
  const oscs = freqs.map(f => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(master);
    o.start();
    return o;
  });
  musicNodes = { master, oscs };
}
function stopMusic() {
  if (!musicNodes) return;
  musicNodes.oscs.forEach(o => { try { o.stop(); } catch (e) {} });
  musicNodes.master.disconnect();
  musicNodes = null;
}

function initToggleButtons() {
  const soundBtn = document.querySelector("[data-sound-toggle]");
  const musicBtn = document.querySelector("[data-music-toggle]");

  if (soundBtn) {
    const label = on => "Sound: " + (on ? "on" : "off");
    const enabled = Storage.load(Storage.KEY_SOUND) !== false;
    soundBtn.setAttribute("aria-pressed", String(enabled));
    soundBtn.textContent = label(enabled);
    soundBtn.addEventListener("click", () => {
      const now = Storage.load(Storage.KEY_SOUND) !== false;
      Storage.save(Storage.KEY_SOUND, !now);
      soundBtn.setAttribute("aria-pressed", String(!now));
      soundBtn.textContent = label(!now);
      if (!now) playBlip(520, 0.1);
    });
  }

  if (musicBtn) {
    const label = on => "Music: " + (on ? "on" : "off");
    const enabled = Storage.load(Storage.KEY_MUSIC) === true;
    musicBtn.setAttribute("aria-pressed", String(enabled));
    musicBtn.textContent = label(enabled);
    if (enabled) {
      document.body.addEventListener("click", function starter() {
        startMusic();
        document.body.removeEventListener("click", starter);
      }, { once: true });
    }
    musicBtn.addEventListener("click", () => {
      const now = Storage.load(Storage.KEY_MUSIC) === true;
      Storage.save(Storage.KEY_MUSIC, !now);
      musicBtn.setAttribute("aria-pressed", String(!now));
      musicBtn.textContent = label(!now);
      if (!now) startMusic(); else stopMusic();
    });
  }
}

/* ---------------------------- Confetti ---------------------------- */
function launchConfetti(container, count = 90) {
  if (!container) return;
  const colors = ["#b22234", "#233c56", "#ffffff"];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.6) + "s";
    piece.style.animationDuration = (2.5 + Math.random() * 2) + "s";
    piece.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
    piece.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 5200);
  }
}
window.launchConfetti = launchConfetti;

/* =========================================================================
   CandidateUI: shared helpers used by the builder, the opponent picker,
   the simulator and the results page. Defined here so all four stay in
   sync on the candidate schema and the card markup.
   ========================================================================= */
const CandidateUI = {
  /* Every candidate everywhere uses exactly this shape. */
  blank() {
    return {
      name: "", age: 45, party: "", occupation: "", state: "Texas",
      topIssue: "", slogan: "", about: "",
      logoColor: (window.GameData && GameData.LOGO_COLOR_PALETTE[0]) || "#b22234"
    };
  },

  /* Never inject raw user text into innerHTML. */
  escape(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  sentenceCount(text) {
    return String(text || "").split(/[.!?]+/).filter(s => s.trim().length > 3).length;
  },

  initials(name) {
    const clean = String(name || "").trim();
    if (!clean) return "?";
    return clean.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  },

  ageTag(age) {
    const a = Number(age) || 0;
    if (a < 35) return "Young. Energy comes easy, credibility takes work.";
    if (a < 50) return "Mid-career. Old enough for a record, young enough for change.";
    if (a < 65) return "Experienced. Voters will ask for proof.";
    return "Veteran. Trusted by some, called out of touch by others.";
  },

  /* The candidate card, used on the builder preview, the opponent preview,
     and the simulator matchup row. */
  cardHtml(c, options) {
    const opts = options || {};
    const esc = CandidateUI.escape;
    const color = c.logoColor || "#b22234";
    const aboutBlock = opts.showAbout && c.about
      ? `<p class="candidate-about">${esc(c.about)}</p>` : "";

    return `
      <div class="candidate-card-banner" style="background:${esc(color)};"></div>
      <div class="candidate-card-body">
        <div class="candidate-avatar" style="background:${esc(color)};">${esc(CandidateUI.initials(c.name))}</div>
        <h3 class="candidate-name">${esc(c.name) || "Your candidate"}</h3>
        <div class="candidate-party">${esc(c.party) || "No party yet"}</div>
        ${c.slogan ? `<p class="candidate-slogan">${esc(c.slogan)}</p>` : ""}
        <dl class="candidate-meta">
          <dt>Age</dt><dd>${esc(c.age) || "Not set"}</dd>
          <dt>State</dt><dd>${esc(c.state) || "Not set"}</dd>
          <dt>Was a</dt><dd>${esc(c.occupation) || "Not set"}</dd>
          <dt>Runs on</dt><dd>${esc(c.topIssue) || "Not set"}</dd>
        </dl>
        ${aboutBlock}
      </div>`;
  },

  /* Renders a grid of selectable tiles. `items` may be strings or
     { value, blurb } objects. Calls onPick(value) on selection. */
  renderTiles(container, items, selected, onPick) {
    if (!container) return;
    container.innerHTML = "";
    items.forEach(item => {
      const value = typeof item === "string" ? item : item.value;
      const blurb = typeof item === "string" ? "" : (item.blurb || "");
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.setAttribute("role", "radio");
      tile.setAttribute("aria-checked", value === selected ? "true" : "false");
      tile.dataset.value = value;
      tile.innerHTML =
        `<span class="tile-name">${CandidateUI.escape(value)}</span>` +
        (blurb ? `<span class="tile-blurb">${CandidateUI.escape(blurb)}</span>` : "");
      tile.addEventListener("click", () => {
        container.querySelectorAll(".tile").forEach(t => t.setAttribute("aria-checked", "false"));
        tile.setAttribute("aria-checked", "true");
        playBlip(520, 0.06);
        onPick(value);
      });
      container.appendChild(tile);
    });
  },

  fillSelect(select, list, selected) {
    if (!select) return;
    select.innerHTML = "";
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      if (item === selected) opt.selected = true;
      select.appendChild(opt);
    });
  },

  renderSwatches(container, selected, onPick) {
    if (!container) return;
    container.innerHTML = "";
    GameData.LOGO_COLOR_PALETTE.forEach(color => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "color-swatch" + (color === selected ? " selected" : "");
      sw.style.background = color;
      sw.setAttribute("aria-label", "Campaign color " + color);
      sw.addEventListener("click", () => {
        container.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
        sw.classList.add("selected");
        onPick(color);
      });
      container.appendChild(sw);
    });
  },

  /* Which of the eight required fields are filled in. */
  REQUIRED: [
    { key: "name",       label: "Name" },
    { key: "age",        label: "Age" },
    { key: "party",      label: "Party" },
    { key: "occupation", label: "Occupation" },
    { key: "state",      label: "Home State" },
    { key: "topIssue",   label: "Top Issue" },
    { key: "slogan",     label: "Slogan" },
    { key: "about",      label: "About" }
  ],

  isFilled(c, key) {
    if (key === "age") return Number(c.age) >= 25;
    if (key === "about") return CandidateUI.sentenceCount(c.about) >= 3;
    return String(c[key] || "").trim().length > 0;
  },

  completeness(c) {
    const done = CandidateUI.REQUIRED.filter(f => CandidateUI.isFilled(c, f.key));
    return { done: done.length, total: CandidateUI.REQUIRED.length,
             pct: Math.round((done.length / CandidateUI.REQUIRED.length) * 100) };
  }
};
window.CandidateUI = CandidateUI;

/* ---------------------------- Footer year + loading screen ---------------------------- */
function initFooterYear() {
  document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });
}

function initLoadingScreen() {
  const loader = document.querySelector(".loading-screen");
  if (!loader) return;
  window.addEventListener("load", () => {
    setTimeout(() => {
      loader.classList.add("loading-screen--hidden");
      setTimeout(() => loader.remove(), 700);
    }, 450);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMobileNav();
  initToggleButtons();
  initFooterYear();
  initLoadingScreen();
});
