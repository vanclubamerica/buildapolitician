/* =========================================================================
   report.js — renders a simulation result object into HTML.

   Shared by simulator.html (which renders the report right after running
   it) and results.html (which renders the saved copy). Both get identical
   output, so there is exactly one place to change the layout.

   The result object shape is defined in api/_prompt.js and guaranteed by
   api/simulate.js — see normaliseResult() there.
   ========================================================================= */

const Report = (function () {
  const esc = str => CandidateUI.escape(str);

  function pct(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }

  /* ------------------------------ headline ----------------------------- */

  function headlineHtml(r) {
    const poll = r.poll_results;
    const margin = poll.candidate - poll.opponent;
    const marginText = (margin > 0 ? "+" : "") + margin;
    const approvalNet = r.approval_rating.approve - r.approval_rating.disapprove;

    return `
      <div class="headline-grid">
        <div class="stat-tile card">
          <span class="big-num">${esc(r.projection)}</span>
          <span class="tile-label">Projection</span>
        </div>
        <div class="stat-tile card">
          <span class="big-num">${r.approval_rating.approve}%</span>
          <span class="tile-label">Approve (net ${approvalNet > 0 ? "+" : ""}${approvalNet})</span>
        </div>
        <div class="stat-tile card">
          <span class="big-num">${marginText}</span>
          <span class="tile-label">Points vs ${esc(r.opponent_name)}</span>
        </div>
        <div class="stat-tile card">
          <span class="big-num">${poll.undecided}%</span>
          <span class="tile-label">Still Undecided</span>
        </div>
      </div>`;
  }

  /* ----------------------------- split bars ---------------------------- */

  /* Bars are rendered at width:0 with the real width parked in a data
     attribute, then filled in on the next frame so the CSS transition has
     something to animate from. */
  function splitBar(segments) {
    const bars = segments.map(s =>
      `<span class="${s.cls}" style="width:0%" data-width="${pct(s.value)}">${s.value >= 8 ? s.value + "%" : ""}</span>`
    ).join("");
    const legend = segments.map(s =>
      `<span><i style="background:${s.swatch}"></i>${esc(s.label)} — ${s.value}%</span>`
    ).join("");
    return `<div class="split-bar">${bars}</div><div class="split-legend">${legend}</div>`;
  }

  function approvalHtml(r) {
    const a = r.approval_rating;
    return `
      <div class="card card-pad mb-2">
        <h3>Overall Approval Rating</h3>
        <p>Of every fictional voter surveyed, this is how many approve of ${esc(r.candidate_name)} as a person and a leader — separate from who they intend to vote for.</p>
        ${splitBar([
          { cls: "seg-approve",    value: a.approve,    label: "Approve",    swatch: "#3fa663" },
          { cls: "seg-disapprove", value: a.disapprove, label: "Disapprove", swatch: "#c8102e" },
          { cls: "seg-unsure",     value: a.unsure,     label: "Not sure",   swatch: "rgba(255,255,255,0.25)" }
        ])}
      </div>`;
  }

  function pollHtml(r) {
    const p = r.poll_results;
    return `
      <div class="card card-pad mb-2">
        <h3>Election Poll Results</h3>
        <p>If the fictional election were held today.</p>
        ${splitBar([
          { cls: "seg-candidate", value: p.candidate, label: esc(r.candidate_name), swatch: "#1f4e79" },
          { cls: "seg-opponent",  value: p.opponent,  label: esc(r.opponent_name),  swatch: "#c8102e" },
          { cls: "seg-undecided", value: p.undecided, label: "Undecided",           swatch: "rgba(255,255,255,0.25)" }
        ])}
      </div>`;
  }

  /* ---------------------------- demographics --------------------------- */

  function demoColumn(title, rows) {
    const body = (rows || []).map(row => `
      <div class="demo-row">
        <div class="demo-row-top"><span>${esc(row.group)}</span><b>${pct(row.support)}%</b></div>
        <div class="demo-track"><span style="width:0%" data-width="${pct(row.support)}"></span></div>
        ${row.note ? `<p class="demo-note">${esc(row.note)}</p>` : ""}
      </div>`).join("");
    return `<div class="card card-pad"><h3>${esc(title)}</h3>${body}</div>`;
  }

  function demographicsHtml(r) {
    const d = r.demographics || {};
    return `
      <div class="mb-2">
        <h3>Voter Breakdown</h3>
        <p>Percentage of each group supporting ${esc(r.candidate_name)}. The faint line marks 50%.</p>
        <div class="demo-columns">
          ${demoColumn("By Age", d.age)}
          ${demoColumn("By Political Lean", d.lean)}
          ${demoColumn("By Location", d.location)}
        </div>
      </div>`;
  }

  /* ------------------------ strengths + weaknesses --------------------- */

  function pointsHtml(items, direction) {
    if (!items || !items.length) return "<p>No clear signal.</p>";
    return `<ul class="point-list ${direction}">` + items.map(p => `
      <li><strong>${esc(p.title)}</strong><p>${esc(p.detail)}</p></li>`).join("") + "</ul>";
  }

  function analysisHtml(r) {
    return `
      <div class="mb-2">
        <h3>Candidate Analysis</h3>
        <div class="analysis-grid">
          <div class="card card-pad">
            <h4 style="color:#6be089;">Strengths — why voters support them</h4>
            ${pointsHtml(r.strengths, "up")}
          </div>
          <div class="card card-pad">
            <h4 style="color:var(--red-400);">Weaknesses — why voters oppose them</h4>
            ${pointsHtml(r.weaknesses, "down")}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------- events ------------------------------ */

  function eventsHtml(r) {
    if (!r.events || !r.events.length) return "";
    const items = r.events.map(e => {
      const impact = Number(e.impact) || 0;
      const cls = impact > 0 ? "up" : impact < 0 ? "down" : "flat";
      const label = impact > 0 ? "+" + impact : String(impact);
      return `
        <div class="event-item">
          <div class="event-swing ${cls}">${label}</div>
          <div>
            <h4>${esc(e.headline)}</h4>
            <p>${esc(e.detail)}</p>
            <span class="event-affected">Moved: ${esc(e.affected)}</span>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="mb-2">
        <h3>Campaign Events</h3>
        <p>Fictional moments from the campaign and how many points each one moved the polls.</p>
        <div class="event-feed">${items}</div>
      </div>`;
  }

  /* ------------------------------- summary ----------------------------- */

  function summaryHtml(r) {
    const tag = r.source === "ai"
      ? `<span class="source-tag">🤖 AI analyst${r.model ? " — " + esc(r.model) : ""}</span>`
      : `<span class="source-tag">📊 Offline model</span>`;
    return `
      <div class="card card-pad mb-2">
        <div class="flex-between" style="align-items:flex-start;">
          <h3 style="margin:0;">Analyst's Read</h3>
          ${tag}
        </div>
        <p class="mt-2" style="color:var(--text);">${esc(r.analyst_summary)}</p>
      </div>`;
  }

  /* ------------------------------- render ------------------------------ */

  function render(container, result) {
    if (!container || !result) return;
    const notice = result.notice
      ? `<div class="notice-bar">${esc(result.notice)}</div>` : "";

    container.innerHTML =
      notice +
      headlineHtml(result) +
      `<div class="mt-2"></div>` +
      approvalHtml(result) +
      pollHtml(result) +
      demographicsHtml(result) +
      analysisHtml(result) +
      eventsHtml(result) +
      summaryHtml(result) +
      `<p class="disclaimer">Every number, voter, and event above is invented by a simulation for a classroom exercise.
       Nothing here describes, predicts, or comments on a real election, a real person, or a real political party.</p>`;

    /* Fill every bar on the next frame so the CSS transitions actually run
       rather than the widths snapping into place. */
    requestAnimationFrame(() => {
      container.querySelectorAll("span[data-width]").forEach(el => {
        el.style.width = el.dataset.width + "%";
      });
    });
  }

  return { render: render };
})();

window.Report = Report;
