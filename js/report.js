/* =========================================================================
   report.js: renders a simulation result object into HTML.

   Shared by simulator.html (which renders the report right after running
   it) and results.html (which renders the saved copy), so there is exactly
   one place to change the layout.

   Result shape is defined in api/_prompt.js and guaranteed by
   normaliseResult() in api/simulate.js.
   ========================================================================= */

const Report = (function () {
  const esc = str => CandidateUI.escape(str);
  const pct = n => Math.max(0, Math.min(100, Number(n) || 0));

  /* ------------------------------ verdict ------------------------------ */

  function verdict(r) {
    const p = r.poll_results;
    const margin = p.candidate - p.opponent;
    const lead = margin > 0 ? "leads by " + margin : margin < 0 ? "trails by " + Math.abs(margin) : "is tied";
    return `
      <div class="verdict">
        <p class="eyebrow">Projection</p>
        <p class="outcome">${esc(r.projection)}</p>
        <p class="score">${esc(r.candidate_name)} ${lead}${margin === 0 ? "" : " points"}</p>
      </div>`;
  }

  /* ------------------------------ metrics ------------------------------ */

  function metrics(r) {
    const a = r.approval_rating;
    const p = r.poll_results;
    return `
      <div class="metrics">
        <div class="card metric">
          <div class="value">${p.candidate}%</div>
          <div class="label">Your vote share</div>
        </div>
        <div class="card metric">
          <div class="value">${a.approve}%</div>
          <div class="label">Approve of ${esc(r.candidate_name)}</div>
        </div>
        <div class="card metric">
          <div class="value">${p.undecided}%</div>
          <div class="label">Still undecided</div>
        </div>
      </div>`;
  }

  /* ------------------------------- bars -------------------------------- */

  /* Bars render at width 0 with the real value parked in a data attribute,
     then get filled on the next frame so the CSS transition has something
     to animate from. */
  function bar(segments) {
    const fills = segments.map(s =>
      `<span class="${s.cls}" style="width:0" data-width="${pct(s.value)}">${s.value >= 10 ? s.value + "%" : ""}</span>`
    ).join("");
    const legend = segments.map(s =>
      `<span><i style="background:${s.swatch}"></i>${esc(s.label)} ${s.value}%</span>`
    ).join("");
    return `<div class="split">${fills}</div><div class="legend">${legend}</div>`;
  }

  function polling(r) {
    const a = r.approval_rating;
    const p = r.poll_results;
    return `
      <div class="grid grid-2">
        <div class="card card-pad">
          <h3>Poll</h3>
          ${bar([
            { cls: "seg-a", value: p.candidate, label: esc(r.candidate_name), swatch: "var(--navy)" },
            { cls: "seg-b", value: p.opponent,  label: esc(r.opponent_name),  swatch: "var(--red)" },
            { cls: "seg-c", value: p.undecided, label: "Undecided",           swatch: "var(--line-strong)" }
          ])}
        </div>
        <div class="card card-pad">
          <h3>Approval</h3>
          ${bar([
            { cls: "seg-a", value: a.approve,    label: "Approve",    swatch: "var(--navy)" },
            { cls: "seg-b", value: a.disapprove, label: "Disapprove", swatch: "var(--red)" },
            { cls: "seg-c", value: a.unsure,     label: "Not sure",   swatch: "var(--line-strong)" }
          ])}
        </div>
      </div>`;
  }

  /* ---------------------------- voter groups --------------------------- */

  function groupColumn(title, rows) {
    const body = (rows || []).map(row => {
      const v = pct(row.support);
      const tone = v >= 55 ? " high" : v <= 42 ? " low" : "";
      return `
        <div class="group-row">
          <div class="group-head"><span>${esc(row.group)}</span><b>${v}%</b></div>
          <div class="group-track${tone}"><span style="width:0" data-width="${v}"></span></div>
          ${row.note ? `<p class="group-note">${esc(row.note)}</p>` : ""}
        </div>`;
    }).join("");
    return `<div class="card card-pad"><h3>${esc(title)}</h3>${body}</div>`;
  }

  function groups(r) {
    const d = r.demographics || {};
    return `
      <h2 class="mt-3 mb-1">Voter groups</h2>
      <p class="small muted mb-2">Share of each group backing ${esc(r.candidate_name)}.</p>
      <div class="groups">
        ${groupColumn("Age", d.age)}
        ${groupColumn("Political lean", d.lean)}
        ${groupColumn("Location", d.location)}
      </div>`;
  }

  /* --------------------------- strengths / weaknesses ------------------ */

  /* Only the first two points are shown up front. The rest sit behind a
     "Show more" toggle so the page is scannable instead of a wall of text. */
  function pointList(items) {
    if (!items || !items.length) return `<p class="small muted">Nothing notable.</p>`;
    const render = p => `<li><b>${esc(p.title)}</b><p>${esc(p.detail)}</p></li>`;
    const head = items.slice(0, 2).map(render).join("");
    const rest = items.slice(2);
    const more = rest.length
      ? `<details class="more"><summary>Show ${rest.length} more</summary>
           <div class="more-body"><ul class="points">${rest.map(render).join("")}</ul></div>
         </details>`
      : "";
    return `<ul class="points">${head}</ul>${more}`;
  }

  function analysis(r) {
    return `
      <h2 class="mt-3 mb-2">Analysis</h2>
      <div class="grid grid-2">
        <div class="card card-pad">
          <h3>Strengths</h3>
          ${pointList(r.strengths)}
        </div>
        <div class="card card-pad">
          <h3>Weaknesses</h3>
          ${pointList(r.weaknesses)}
        </div>
      </div>`;
  }

  /* ------------------------------- events ------------------------------ */

  function events(r) {
    if (!r.events || !r.events.length) return "";
    const item = e => {
      const impact = Number(e.impact) || 0;
      const cls = impact > 0 ? "up" : impact < 0 ? "down" : "flat";
      const label = impact > 0 ? "+" + impact : String(impact);
      return `
        <li>
          <div class="swing ${cls}">${label}</div>
          <div>
            <b>${esc(e.headline)}</b>
            <p>${esc(e.detail)}</p>
            <span class="who">${esc(e.affected)}</span>
          </div>
        </li>`;
    };
    const head = r.events.slice(0, 3).map(item).join("");
    const rest = r.events.slice(3);
    const more = rest.length
      ? `<details class="more"><summary>Show ${rest.length} more</summary>
           <div class="more-body"><ul class="timeline">${rest.map(item).join("")}</ul></div>
         </details>`
      : "";
    return `
      <h2 class="mt-3 mb-1">Campaign events</h2>
      <p class="small muted mb-2">Moments that moved the numbers.</p>
      <div class="card card-pad"><ul class="timeline">${head}</ul>${more}</div>`;
  }

  /* ------------------------------ summary ------------------------------ */

  function summary(r) {
    const tag = r.source === "ai" ? "AI analyst" : "Offline model";
    return `
      <div class="card card-pad mt-3">
        <div class="flex-between mb-1">
          <h3 style="margin:0;">Summary</h3>
          <span class="tag">${esc(tag)}</span>
        </div>
        <p>${esc(r.analyst_summary)}</p>
      </div>`;
  }

  /* ------------------------------- render ------------------------------ */

  function render(container, result) {
    if (!container || !result) return;

    container.innerHTML =
      (result.notice ? `<div class="notice">${esc(result.notice)}</div>` : "") +
      verdict(result) +
      `<div class="mt-2">${metrics(result)}</div>` +
      `<div class="mt-2">${polling(result)}</div>` +
      groups(result) +
      analysis(result) +
      events(result) +
      summary(result) +
      `<p class="footnote">Every voter, poll and event here is invented for this simulation.
       It does not describe or predict a real election.</p>`;

    requestAnimationFrame(() => {
      container.querySelectorAll("span[data-width]").forEach(el => {
        el.style.width = el.dataset.width + "%";
      });
    });
  }

  return { render: render };
})();

window.Report = Report;
