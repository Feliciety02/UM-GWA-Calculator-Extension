(() => {
  "use strict";

  const PANEL_ID = "um-gwa-calculator";
  const EXCLUDED_ROW_CLASS = "um-gwa-excluded-row";
  const GRADING_SYS_KEY = "um-gwa-grading-system";
  let showMore = false; // kept while switching systems or recalculating

  function normalize(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    const text = normalize(value).replace(/,/g, "");
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function isExcludedCourse(courseNumber) {
    const course = normalize(courseNumber).toUpperCase();
    return (
      /^(NSTP|PAHF|PE)(?:\s|$)/.test(course) ||
      /^CAED\s*500(?:\/L)?(?:\s|$)/.test(course)
    );
  }

  function findPermanentRecordTable() {
    return [...document.querySelectorAll("table")].find((table) => {
      const headings = [...table.querySelectorAll("thead th")]
        .map((th) => normalize(th.textContent).toLowerCase())
        .join(" | ");
      return (
        headings.includes("course number") &&
        headings.includes("final grade") &&
        headings.includes("unit")
      );
    });
  }

  function getColumnIndexes(table) {
    const headers = [...table.querySelectorAll("thead th")].map((th) =>
      normalize(th.textContent).toLowerCase()
    );
    return {
      course: headers.findIndex((v) => v.includes("course number")),
      title: headers.findIndex((v) => v.includes("descriptive title")),
      grade: headers.findIndex((v) => v.includes("final grade")),
      unit: headers.findIndex((v) => v === "unit" || v.includes("unit"))
    };
  }

  /* ── Grading system helpers ── */

  function getSystem() {
    return localStorage.getItem(GRADING_SYS_KEY) || "new";
  }

  function setSystem(s) {
    localStorage.setItem(GRADING_SYS_KEY, s);
  }

  function maxGrade(sys) {
    return sys === "old" ? 5.0 : 4.0;
  }

  /* ── Conversion tables ── */

  const OLD_TABLE = [
    [100, 1.0], [99, 1.1], [98, 1.2], [97, 1.3], [96, 1.4],
    [95, 1.5], [94, 1.6], [93, 1.7], [92, 1.8], [91, 1.9],
    [90, 2.0], [89, 2.1], [88, 2.2], [87, 2.3], [86, 2.4],
    [85, 2.5], [84, 2.6], [83, 2.7], [82, 2.8], [81, 2.9],
    [80, 3.0], [79, 3.1], [78, 3.2], [77, 3.3], [76, 3.4],
    [75, 3.5]
  ];

  const NEW_TABLE = [
    [96, 4.0], [90, 3.5], [85, 3.0], [80, 2.5], [75, 2.0]
  ];

  function rawToGrade(raw, sys) {
    const table = sys === "old" ? OLD_TABLE : NEW_TABLE;
    for (const [threshold, grade] of table) {
      if (raw >= threshold) return grade;
    }
    return sys === "old" ? 5.0 : 1.0;
  }

  /* ── Read & calculate ── */

  function readCourses(table, sys) {
    const indexes = getColumnIndexes(table);
    if (Object.values(indexes).some((i) => i < 0)) return [];

    const mg = maxGrade(sys);
    let currentTerm = "Other courses";
    const courses = [];

    table.querySelectorAll("tbody tr").forEach((row) => {
      row.classList.remove(EXCLUDED_ROW_CLASS);
      const cells = [...row.querySelectorAll(":scope > td")];
      if (!cells.length) return;

      const isTermRow =
        row.classList.contains("tr-primary-marker") ||
        cells.some((c) => Number(c.getAttribute("colspan")) > 1);

      if (isTermRow) {
        currentTerm = normalize(cells[0]?.textContent) || currentTerm;
        return;
      }

      if (cells.length <= Math.max(indexes.course, indexes.title, indexes.grade, indexes.unit)) return;

      const courseNumber = normalize(cells[indexes.course]?.textContent);
      const title = normalize(cells[indexes.title]?.textContent);
      const gradeText = normalize(cells[indexes.grade]?.textContent);
      const unitText = normalize(cells[indexes.unit]?.textContent);
      const grade = parseNumber(gradeText);
      const units = parseNumber(unitText);

      if (!courseNumber && !title) return;

      let exclusionReason = "";
      if (isExcludedCourse(courseNumber)) {
        exclusionReason = "Excluded subject";
      } else if (grade === null) {
        exclusionReason = "No numeric final grade";
      } else if (grade < 1.0 || grade > mg) {
        exclusionReason = `Grade outside 1.0–${mg.toFixed(1)}`;
      } else if (units === null || units <= 0) {
        exclusionReason = "No valid units";
      }

      const excluded = Boolean(exclusionReason);
      if (excluded) {
        row.classList.add(EXCLUDED_ROW_CLASS);
        row.title = `Not included in GWA: ${exclusionReason}`;
      } else if (row.title.startsWith("Not included in GWA:")) {
        row.removeAttribute("title");
      }

      courses.push({ term: currentTerm, courseNumber, title, grade, gradeText, units, unitText, excluded, exclusionReason });
    });

    return courses;
  }

  function calculate(courses) {
    const included = courses.filter((c) => !c.excluded);
    const excluded = courses.filter((c) => c.excluded);
    const totalUnits = included.reduce((s, c) => s + c.units, 0);
    const weightedPoints = included.reduce((s, c) => s + c.grade * c.units, 0);
    const gwa = totalUnits > 0 ? weightedPoints / totalUnits : null;

    const termMap = new Map();
    included.forEach((c) => {
      const t = termMap.get(c.term) || { term: c.term, courses: 0, units: 0, wp: 0 };
      t.courses += 1;
      t.units += c.units;
      t.wp += c.grade * c.units;
      termMap.set(c.term, t);
    });

    const terms = [...termMap.values()].map((t) => ({
      ...t,
      gwa: t.units > 0 ? t.wp / t.units : null
    }));

    return { included, excluded, totalUnits, weightedPoints, gwa, terms };
  }

  /* ── Formatting ── */

  function fmt(v, d = 2) {
    return Number.isFinite(v) ? v.toFixed(d) : "—";
  }

  /* ── Rank system ── */

  function getRank(gwa, sys) {
    if (!Number.isFinite(gwa)) return { badge: "❓", title: "No Data", sub: "No grades found", cls: "rank-master" };

    if (sys === "old") {
      if (gwa <= 1.50) return { badge: "🏆", title: "Legend", sub: "Summa Cum Laude", cls: "rank-legend" };
      if (gwa <= 2.00) return { badge: "⭐", title: "Master", sub: "Magna Cum Laude", cls: "rank-master" };
      if (gwa <= 2.50) return { badge: "🎯", title: "Scholar", sub: "Cum Laude", cls: "rank-scholar" };
      if (gwa <= 3.00) return { badge: "📘", title: "Achiever", sub: "Solid performance", cls: "rank-achiever" };
      if (gwa <= 3.50) return { badge: "🎮", title: "Player", sub: "Keep pushing", cls: "rank-player" };
      if (gwa <= 4.00) return { badge: "⚡", title: "Rookie", sub: "Room to grow", cls: "rank-rookie" };
      return { badge: "🔥", title: "Struggling", sub: "Don't give up!", cls: "rank-struggling" };
    }

    if (gwa >= 3.50) return { badge: "🏆", title: "Legend", sub: "High Distinction", cls: "rank-legend" };
    if (gwa >= 3.00) return { badge: "⭐", title: "Master", sub: "Distinction", cls: "rank-master" };
    if (gwa >= 2.50) return { badge: "🎯", title: "Scholar", sub: "Very Good", cls: "rank-scholar" };
    if (gwa >= 2.00) return { badge: "📘", title: "Achiever", sub: "Good", cls: "rank-achiever" };
    if (gwa >= 1.50) return { badge: "🎮", title: "Player", sub: "Average", cls: "rank-player" };
    if (gwa > 1.00)  return { badge: "⚡", title: "Rookie", sub: "Below Average", cls: "rank-rookie" };
    return { badge: "🔥", title: "Struggling", sub: "Fail", cls: "rank-struggling" };
  }

  function progressPct(gwa, sys) {
    if (!Number.isFinite(gwa)) return 0;
    if (sys === "old") return Math.max(0, Math.min(100, ((5 - gwa) / 4) * 100));
    return Math.max(0, Math.min(100, ((gwa - 1) / 3) * 100));
  }

  /* ── UI ── */

  // Same drawing as docs/logo.svg and icons/: a calculator whose display reads "GG".
  const LOGO_SVG = `<svg class="um-logo" viewBox="0 0 128 128" aria-hidden="true">
    <rect width="128" height="128" rx="30" fill="#2563eb"/>
    <rect x="24" y="20" width="80" height="36" rx="9" fill="#fff"/>
    <text x="95" y="48" text-anchor="end" font-family="'Segoe UI', system-ui, sans-serif" font-size="30" font-weight="800" fill="#2563eb">GG</text>
    <rect x="24" y="66" width="34" height="20" rx="7" fill="#fff" fill-opacity=".35"/>
    <rect x="70" y="66" width="34" height="20" rx="7" fill="#fff" fill-opacity=".35"/>
    <rect x="24" y="94" width="34" height="20" rx="7" fill="#fff" fill-opacity=".35"/>
    <rect x="70" y="94" width="34" height="20" rx="7" fill="#fbbf24"/>
    <rect x="80" y="98" width="14" height="4" rx="2" fill="#2563eb"/>
    <rect x="80" y="106" width="14" height="4" rx="2" fill="#2563eb"/>
  </svg>`;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function buildPanel(result, table, sys) {
    document.getElementById(PANEL_ID)?.remove();

    const rank = getRank(result.gwa, sys);
    const pct = progressPct(result.gwa, sys);
    const mg = maxGrade(sys);

    const panel = el("section", null);
    panel.id = PANEL_ID;

    // Header: logo + name on the left, grading system switch on the right
    const header = el("div", "um-header",
      `${LOGO_SVG}
       <div class="um-header-text">
         <h3>GWA Gah?</h3>
         <p>UM GWA Calculator</p>
       </div>`
    );

    const sysToggle = el("div", "um-sys-toggle");
    sysToggle.setAttribute("role", "group");
    sysToggle.setAttribute("aria-label", "Grading system");
    const oldBtn = el("button", `um-sys-btn ${sys === "old" ? "active" : ""}`, "Old 1–5");
    oldBtn.type = "button";
    oldBtn.title = "Old system: 1.0–5.0, lower is better";
    oldBtn.setAttribute("aria-pressed", String(sys === "old"));
    oldBtn.addEventListener("click", () => { setSystem("old"); renderCalculator(); });
    const newBtn = el("button", `um-sys-btn ${sys === "new" ? "active" : ""}`, "New 1–4");
    newBtn.type = "button";
    newBtn.title = "New system: 1.0–4.0, higher is better";
    newBtn.setAttribute("aria-pressed", String(sys === "new"));
    newBtn.addEventListener("click", () => { setSystem("new"); renderCalculator(); });
    sysToggle.append(oldBtn, newBtn);
    header.appendChild(sysToggle);

    // The GWA itself, with its rank as a quiet tag
    const pMin = sys === "old" ? "1.00 Best" : "1.00 Fail";
    const pMax = sys === "old" ? "5.00 Fail" : "4.00 Best";
    const rankBanner = el("div", "um-rank",
      `<div class="um-rank-label">Your GWA</div>
       <div class="um-rank-row">
         <div class="um-rank-gwa">${fmt(result.gwa)}</div>
         <div class="um-rank-tag ${rank.cls}"><span class="um-rank-dot"></span>${rank.title}<span class="um-rank-sub">${rank.sub}</span></div>
       </div>`
    );

    // Progress
    const progress = el("div", "um-progress-wrap",
      `<div class="um-progress-bar"><div class="um-progress-fill" style="width:${pct}%"></div></div>
       <div class="um-progress-label"><span>${pMin}</span><span>${pMax}</span></div>`
    );

    // Stats
    const stats = el("div", "um-stats",
      `<div class="um-stat"><div class="um-stat-value">${fmt(result.totalUnits, 1)}</div><div class="um-stat-label">Units</div></div>
       <div class="um-stat"><div class="um-stat-value">${result.included.length}</div><div class="um-stat-label">Courses</div></div>
       <div class="um-stat"><div class="um-stat-value">${result.excluded.length}</div><div class="um-stat-label">Filtered</div></div>`
    );

    // Formula
    const formula = el("div", "um-formula",
      Number.isFinite(result.gwa)
        ? `<span>Σ(grade × units) ÷ Σ units</span><span>${fmt(result.weightedPoints, 2)} ÷ ${fmt(result.totalUnits, 1)} = ${fmt(result.gwa, 4)}</span>`
        : "<span>No valid courses found.</span>"
    );

    // Conversion reference
    const refDetails = el("details", "um-details");
    const refSummary = el("summary", null, `<span>Grade Reference (${sys === "old" ? "Old System" : "New System"})</span>`);
    refDetails.appendChild(refSummary);
    const refBody = el("div", "um-details-body");
    const refTable = el("table", "um-term-table");
    if (sys === "old") {
      refTable.innerHTML = `<thead><tr><th>Raw</th><th>Grade</th></tr></thead><tbody>${OLD_TABLE.map(([r, g]) => `<tr><td>${r}–${r === 100 ? "" : (OLD_TABLE.find(([rr]) => rr === r + 1) ? OLD_TABLE.find(([rr]) => rr === r + 1)[0] - 1 : 100)}</td><td>${g.toFixed(1)}</td></tr>`).join("")}<tr><td>Below 75</td><td>5.0</td></tr></tbody>`;
    } else {
      refTable.innerHTML = `<thead><tr><th>Raw</th><th>Grade</th><th>Description</th></tr></thead><tbody><tr><td>96–100</td><td>4.0</td><td>High Distinction</td></tr><tr><td>90–95</td><td>3.5</td><td>Distinction</td></tr><tr><td>85–89</td><td>3.0</td><td>Very Good</td></tr><tr><td>80–84</td><td>2.5</td><td>Good</td></tr><tr><td>75–79</td><td>2.0</td><td>Average</td></tr><tr><td>Below 75</td><td>1.0</td><td>Fail</td></tr></tbody>`;
    }
    refBody.appendChild(refTable);
    refDetails.appendChild(refBody);

    // Breakdown
    const details = el("details", "um-details");
    details.open = true;
    const detSummary = el("summary", null, `<span>Semester breakdown</span><span>${result.terms.length} terms</span>`);
    details.appendChild(detSummary);
    const body = el("div", "um-details-body");

    if (result.terms.length) {
      const tt = el("table", "um-term-table");
      tt.innerHTML = `<thead><tr><th>Term</th><th>Courses</th><th>Units</th><th>GWA</th></tr></thead><tbody>${result.terms.map((t) => `<tr><td>${t.term}</td><td>${t.courses}</td><td>${fmt(t.units, 1)}</td><td>${fmt(t.gwa)}</td></tr>`).join("")}</tbody>`;
      body.appendChild(tt);
    }

    if (result.excluded.length) {
      const exH = el("div", "um-subhead", "Not counted");
      body.appendChild(exH);
      const exList = el("ul", "um-excluded-list");
      result.excluded.forEach((c) => {
        exList.appendChild(el("li", "um-excluded-item",
          `<span class="um-excluded-course">${c.courseNumber || c.title} · ${c.gradeText || "—"}</span><span class="um-excluded-reason">${c.exclusionReason}</span>`
        ));
      });
      body.appendChild(exList);
    }

    details.appendChild(body);

    // Actions
    const actions = el("div", "um-actions");
    const copyBtn = el("button", "um-btn um-btn-secondary", "Copy GWA");
    copyBtn.type = "button";
    copyBtn.disabled = !Number.isFinite(result.gwa);
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fmt(result.gwa));
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy GWA"; }, 1200);
      } catch { copyBtn.textContent = "Failed"; }
    });

    const recalcBtn = el("button", "um-btn um-btn-primary", "Recalculate");
    recalcBtn.type = "button";
    recalcBtn.addEventListener("click", renderCalculator);
    actions.append(copyBtn, recalcBtn);

    // Note
    const note = el("div", "um-note",
      "Runs locally in your browser. This is a personal estimate, not an official university record."
    );

    // Assemble
    // Minimal by default: just the grade. Everything else sits behind "View more".
    const more = el("div", "um-more");
    more.id = `${PANEL_ID}-more`;
    more.hidden = !showMore;
    more.append(progress, stats, formula, refDetails, details, actions, note);

    const moreBtn = el("button", "um-more-btn", showMore ? "View less" : "View more");
    moreBtn.type = "button";
    moreBtn.setAttribute("aria-expanded", String(showMore));
    moreBtn.setAttribute("aria-controls", more.id);
    moreBtn.addEventListener("click", () => {
      showMore = !showMore;
      more.hidden = !showMore;
      moreBtn.textContent = showMore ? "View less" : "View more";
      moreBtn.setAttribute("aria-expanded", String(showMore));
    });

    panel.append(header, rankBanner, moreBtn, more);

    const tableContainer = table.closest(".card") || table.parentElement;
    tableContainer.parentElement.insertBefore(panel, tableContainer);
  }

  /* ── Init ── */

  function renderCalculator() {
    const table = findPermanentRecordTable();
    if (!table) return false;
    const sys = getSystem();
    const courses = readCourses(table, sys);
    if (!courses.length) return false;
    buildPanel(calculate(courses), table, sys);
    return true;
  }

  function initialize() {
    if (renderCalculator()) return;
    const observer = new MutationObserver(() => {
      if (renderCalculator()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  initialize();
})();
