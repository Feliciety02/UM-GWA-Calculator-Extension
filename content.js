(() => {
  "use strict";

  const PANEL_ID = "um-gwa-calculator";
  const EXCLUDED_ROW_CLASS = "um-gwa-excluded-row";
  const MAX_VALID_GRADE = 5.0;

  function normalize(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
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

  function readCourses(table) {
    const indexes = getColumnIndexes(table);
    if (Object.values(indexes).some((i) => i < 0)) return [];

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
      } else if (grade <= 0 || grade > MAX_VALID_GRADE) {
        exclusionReason = `Grade outside 0.1–${MAX_VALID_GRADE.toFixed(1)}`;
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
      const t = termMap.get(c.term) || { term: c.term, courses: 0, units: 0, weightedPoints: 0 };
      t.courses += 1;
      t.units += c.units;
      t.weightedPoints += c.grade * c.units;
      termMap.set(c.term, t);
    });

    const terms = [...termMap.values()].map((t) => ({
      ...t,
      gwa: t.units > 0 ? t.weightedPoints / t.units : null
    }));

    return { included, excluded, totalUnits, weightedPoints, gwa, terms };
  }

  function fmt(value, decimals = 2) {
    if (!Number.isFinite(value)) return "—";
    return value.toFixed(decimals);
  }

  function getRank(gwa) {
    if (!Number.isFinite(gwa)) return { badge: "❓", title: "Unknown", sub: "No grades detected", cls: "rank-master", tier: 0 };
    if (gwa <= 1.50) return { badge: "🏆", title: "Legend", sub: "Summa Cum Laude track", cls: "rank-legend", tier: 6 };
    if (gwa <= 2.00) return { badge: "⭐", title: "Master", sub: "Magna Cum Laude track", cls: "rank-master", tier: 5 };
    if (gwa <= 2.50) return { badge: "🎯", title: "Scholar", sub: "Cum Laude track", cls: "rank-scholar", tier: 4 };
    if (gwa <= 3.00) return { badge: "📘", title: "Achiever", sub: "Solid performance", cls: "rank-achiever", tier: 3 };
    if (gwa <= 3.50) return { badge: "🎮", title: "Player", sub: "Keep pushing", cls: "rank-player", tier: 2 };
    if (gwa <= 4.00) return { badge: "⚡", title: "Rookie", sub: "Room to grow", cls: "rank-rookie", tier: 1 };
    return { badge: "🔥", title: "Struggling", sub: "Don't give up!", cls: "rank-struggling", tier: 0 };
  }

  function getProgressPercent(gwa) {
    if (!Number.isFinite(gwa)) return 0;
    return Math.max(0, Math.min(100, ((5 - gwa) / 4) * 100));
  }

  function buildPanel(result, table) {
    document.getElementById(PANEL_ID)?.remove();

    const rank = getRank(result.gwa);
    const pct = getProgressPercent(result.gwa);

    const panel = document.createElement("section");
    panel.id = PANEL_ID;

    // ── Header ──
    const header = document.createElement("div");
    header.className = "um-header";
    header.innerHTML = `
      <div class="um-icon">📊</div>
      <div class="um-header-text">
        <h3>UM GWA Calculator</h3>
        <p>Academic performance tracker</p>
      </div>
    `;

    // ── Rank Banner ──
    const rankBanner = document.createElement("div");
    rankBanner.className = `um-rank ${rank.cls}`;
    rankBanner.innerHTML = `
      <div class="um-rank-badge">${rank.badge}</div>
      <div class="um-rank-gwa">${fmt(result.gwa)}</div>
      <div class="um-rank-title">${rank.title}</div>
      <div class="um-rank-sub">${rank.sub}</div>
    `;

    // ── Progress Bar ──
    const progressWrap = document.createElement("div");
    progressWrap.className = "um-progress-wrap";
    progressWrap.innerHTML = `
      <div class="um-progress-label">
        <span>1.00 (Legend)</span>
        <span>5.00 (Struggling)</span>
      </div>
      <div class="um-progress-bar">
        <div class="um-progress-fill" style="width: ${pct}%"></div>
      </div>
    `;

    // ── Stats Grid ──
    const stats = document.createElement("div");
    stats.className = "um-stats";
    stats.innerHTML = `
      <div class="um-stat">
        <div class="um-stat-value">${fmt(result.totalUnits, 1)}</div>
        <div class="um-stat-label">Units</div>
      </div>
      <div class="um-stat">
        <div class="um-stat-value">${result.included.length}</div>
        <div class="um-stat-label">Courses</div>
      </div>
      <div class="um-stat">
        <div class="um-stat-value">${result.excluded.length}</div>
        <div class="um-stat-label">Filtered</div>
      </div>
    `;

    // ── Formula ──
    const formula = document.createElement("div");
    formula.className = "um-formula";
    formula.textContent = Number.isFinite(result.gwa)
      ? `${fmt(result.weightedPoints, 2)} ÷ ${fmt(result.totalUnits, 1)} = ${fmt(result.gwa, 4)}`
      : "No valid courses found.";

    // ── Details (Terms + Excluded) ──
    const details = document.createElement("details");
    details.className = "um-details";

    const summary = document.createElement("summary");
    summary.innerHTML = `<span>Semester breakdown</span><span>${result.terms.length} terms</span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "um-details-body";

    // Term table
    if (result.terms.length) {
      const termTable = document.createElement("table");
      termTable.className = "um-term-table";
      termTable.innerHTML = `
        <thead><tr><th>Term</th><th>Courses</th><th>Units</th><th>GWA</th></tr></thead>
        <tbody>${result.terms.map((t) =>
          `<tr><td>${t.term}</td><td>${t.courses}</td><td>${fmt(t.units, 1)}</td><td>${fmt(t.gwa)}</td></tr>`
        ).join("")}</tbody>
      `;
      body.appendChild(termTable);
    }

    // Excluded list
    if (result.excluded.length) {
      const exTitle = document.createElement("div");
      exTitle.style.cssText = "font-size:0.78rem;font-weight:700;margin:0.75rem 0 0.4rem;color:#64748b;";
      exTitle.textContent = "Excluded Entries";
      body.appendChild(exTitle);

      const exList = document.createElement("ul");
      exList.className = "um-excluded-list";
      result.excluded.forEach((c) => {
        const li = document.createElement("li");
        li.className = "um-excluded-item";
        li.innerHTML = `<span class="um-excluded-course">${c.courseNumber || c.title} · ${c.gradeText || "—"}</span><span class="um-excluded-reason">${c.exclusionReason}</span>`;
        exList.appendChild(li);
      });
      body.appendChild(exList);
    }

    details.appendChild(body);

    // ── Actions ──
    const actions = document.createElement("div");
    actions.className = "um-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "um-btn um-btn-secondary";
    copyBtn.textContent = "Copy GWA";
    copyBtn.disabled = !Number.isFinite(result.gwa);
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fmt(result.gwa));
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy GWA"; }, 1200);
      } catch {
        copyBtn.textContent = "Failed";
      }
    });

    const recalcBtn = document.createElement("button");
    recalcBtn.type = "button";
    recalcBtn.className = "um-btn um-btn-primary";
    recalcBtn.textContent = "Recalculate";
    recalcBtn.addEventListener("click", renderCalculator);

    actions.appendChild(copyBtn);
    actions.appendChild(recalcBtn);

    // ── Note ──
    const note = document.createElement("div");
    note.className = "um-note";
    note.textContent = "Runs locally in your browser. This is a personal estimate, not an official university record.";

    // ── Assemble ──
    panel.appendChild(header);
    panel.appendChild(rankBanner);
    panel.appendChild(progressWrap);
    panel.appendChild(stats);
    panel.appendChild(formula);
    panel.appendChild(details);
    panel.appendChild(actions);
    panel.appendChild(note);

    const tableContainer = table.closest(".card") || table.parentElement;
    tableContainer.parentElement.insertBefore(panel, tableContainer);
  }

  function renderCalculator() {
    const table = findPermanentRecordTable();
    if (!table) return false;
    const courses = readCourses(table);
    if (!courses.length) return false;
    buildPanel(calculate(courses), table);
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
