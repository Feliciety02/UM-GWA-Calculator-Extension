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
      course: headers.findIndex((value) => value.includes("course number")),
      title: headers.findIndex((value) => value.includes("descriptive title")),
      grade: headers.findIndex((value) => value.includes("final grade")),
      unit: headers.findIndex((value) => value === "unit" || value.includes("unit"))
    };
  }

  function readCourses(table) {
    const indexes = getColumnIndexes(table);
    if (Object.values(indexes).some((index) => index < 0)) return [];

    let currentTerm = "Other courses";
    const courses = [];

    table.querySelectorAll("tbody tr").forEach((row) => {
      row.classList.remove(EXCLUDED_ROW_CLASS);

      const cells = [...row.querySelectorAll(":scope > td")];
      if (!cells.length) return;

      const isTermRow =
        row.classList.contains("tr-primary-marker") ||
        cells.some((cell) => Number(cell.getAttribute("colspan")) > 1);

      if (isTermRow) {
        currentTerm = normalize(cells[0]?.textContent) || currentTerm;
        return;
      }

      if (cells.length <= Math.max(indexes.course, indexes.title, indexes.grade, indexes.unit)) {
        return;
      }

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

      courses.push({
        term: currentTerm,
        courseNumber,
        title,
        grade,
        gradeText,
        units,
        unitText,
        excluded,
        exclusionReason
      });
    });

    return courses;
  }

  function calculate(courses) {
    const included = courses.filter((course) => !course.excluded);
    const excluded = courses.filter((course) => course.excluded);

    const totalUnits = included.reduce((sum, course) => sum + course.units, 0);
    const weightedPoints = included.reduce(
      (sum, course) => sum + course.grade * course.units,
      0
    );
    const gwa = totalUnits > 0 ? weightedPoints / totalUnits : null;

    const termMap = new Map();
    included.forEach((course) => {
      const summary = termMap.get(course.term) || {
        term: course.term,
        courses: 0,
        units: 0,
        weightedPoints: 0
      };

      summary.courses += 1;
      summary.units += course.units;
      summary.weightedPoints += course.grade * course.units;
      termMap.set(course.term, summary);
    });

    const terms = [...termMap.values()].map((term) => ({
      ...term,
      gwa: term.units > 0 ? term.weightedPoints / term.units : null
    }));

    return {
      included,
      excluded,
      totalUnits,
      weightedPoints,
      gwa,
      terms
    };
  }

  function formatNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return "—";
    return value.toFixed(decimals);
  }

  function createMetric(label, value, helper, extraClass = "") {
    const metric = document.createElement("div");
    metric.className = `um-gwa-metric ${extraClass}`.trim();

    const labelNode = document.createElement("span");
    labelNode.className = "um-gwa-metric-label";
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.className = "um-gwa-metric-value";
    valueNode.textContent = value;

    metric.append(labelNode, valueNode);

    if (helper) {
      const helperNode = document.createElement("small");
      helperNode.textContent = helper;
      metric.append(helperNode);
    }

    return metric;
  }

  function buildPanel(result, table) {
    document.getElementById(PANEL_ID)?.remove();

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "GradeGlow GWA calculation");

    const shell = document.createElement("div");
    shell.className = "um-gwa-shell";

    const header = document.createElement("div");
    header.className = "um-gwa-header";

    const hero = document.createElement("div");
    hero.className = "um-gwa-hero";

    const brandTop = document.createElement("div");
    brandTop.className = "um-gwa-brand-top";

    const logo = document.createElement("div");
    logo.className = "um-gwa-logo";
    logo.setAttribute("aria-hidden", "true");
    logo.textContent = "GG";

    const identity = document.createElement("div");
    identity.className = "um-gwa-identity";

    const kicker = document.createElement("span");
    kicker.className = "um-gwa-kicker";
    kicker.textContent = "Yellow-blue student tool";

    const title = document.createElement("h3");
    title.textContent = "GradeGlow";

    const subtitle = document.createElement("p");
    subtitle.textContent =
      "A modern personal GWA snapshot with its own bright identity. It computes Final Grade × Unit and automatically excludes PE, NSTP, CAED 500, and grades above 5.0.";

    identity.append(kicker, title, subtitle);
    brandTop.append(logo, identity);

    const chipRow = document.createElement("div");
    chipRow.className = "um-gwa-chip-row";
    [
      `${formatNumber(result.totalUnits, 1)} included units`,
      `${result.included.length} counted courses`,
      `${result.excluded.length} filtered entries`
    ].forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "um-gwa-chip";
      chip.textContent = text;
      chipRow.append(chip);
    });

    hero.append(brandTop, chipRow);

    const actions = document.createElement("div");
    actions.className = "um-gwa-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "um-gwa-button um-gwa-button-secondary";
    copyButton.textContent = "Copy GWA";
    copyButton.disabled = !Number.isFinite(result.gwa);
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(formatNumber(result.gwa));
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = "Copy GWA";
        }, 1400);
      } catch {
        copyButton.textContent = "Copy failed";
      }
    });

    const recalculateButton = document.createElement("button");
    recalculateButton.type = "button";
    recalculateButton.className = "um-gwa-button um-gwa-button-primary";
    recalculateButton.textContent = "Recalculate";
    recalculateButton.addEventListener("click", renderCalculator);

    actions.append(copyButton, recalculateButton);
    header.append(hero, actions);

    const metrics = document.createElement("div");
    metrics.className = "um-gwa-metrics";
    metrics.append(
      createMetric("Current GWA", formatNumber(result.gwa), "Rounded to 2 decimals", "um-gwa-metric-primary"),
      createMetric("Weighted points", formatNumber(result.weightedPoints, 2), "Grade × unit total"),
      createMetric("Included units", formatNumber(result.totalUnits, 1), "Eligible academic units"),
      createMetric("Included courses", String(result.included.length), "Counted in the formula"),
      createMetric("Excluded entries", String(result.excluded.length), "Filtered automatically")
    );

    const formula = document.createElement("div");
    formula.className = "um-gwa-formula-card";

    const formulaLabel = document.createElement("span");
    formulaLabel.className = "um-gwa-formula-label";
    formulaLabel.textContent = "Calculation formula";

    const formulaText = document.createElement("p");
    formulaText.className = "um-gwa-formula";
    formulaText.textContent = Number.isFinite(result.gwa)
      ? `${formatNumber(result.weightedPoints, 2)} ÷ ${formatNumber(result.totalUnits, 1)} = ${formatNumber(result.gwa, 4)}`
      : "No valid courses were found for the calculation.";

    formula.append(formulaLabel, formulaText);

    const details = document.createElement("details");
    details.className = "um-gwa-details";
    details.open = true;

    const summary = document.createElement("summary");
    summary.innerHTML = `<span>Semester breakdown and filtered entries</span><span class="um-gwa-summary-meta">${result.terms.length} terms</span>`;
    details.append(summary);

    const detailsGrid = document.createElement("div");
    detailsGrid.className = "um-gwa-details-grid";

    const termSection = document.createElement("section");
    termSection.className = "um-gwa-card";
    const termSectionHeader = document.createElement("div");
    termSectionHeader.className = "um-gwa-card-header";
    const termTitle = document.createElement("h4");
    termTitle.textContent = "Semester rhythm";
    const termCaption = document.createElement("p");
    termCaption.textContent = "Every included term summarized in one compact view.";
    termSectionHeader.append(termTitle, termCaption);

    const termTable = document.createElement("table");
    termTable.className = "um-gwa-mini-table";
    termTable.innerHTML = "<thead><tr><th>Term</th><th>Courses</th><th>Units</th><th>GWA</th></tr></thead>";
    const termBody = document.createElement("tbody");

    result.terms.forEach((term) => {
      const row = document.createElement("tr");
      [
        term.term,
        String(term.courses),
        formatNumber(term.units, 1),
        formatNumber(term.gwa)
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      termBody.append(row);
    });

    termTable.append(termBody);
    termSection.append(termSectionHeader, termTable);

    const excludedSection = document.createElement("section");
    excludedSection.className = "um-gwa-card um-gwa-card-accent";

    const excludedHeader = document.createElement("div");
    excludedHeader.className = "um-gwa-card-header";
    const excludedTitle = document.createElement("h4");
    excludedTitle.textContent = "What GradeGlow ignored";
    const excludedCaption = document.createElement("p");
    excludedCaption.textContent = "These courses or grades were detected but not included in the GWA formula.";
    excludedHeader.append(excludedTitle, excludedCaption);

    const excludedList = document.createElement("ul");
    excludedList.className = "um-gwa-excluded-list";

    if (!result.excluded.length) {
      const item = document.createElement("li");
      item.className = "um-gwa-excluded-item";
      item.innerHTML = `<span class="um-gwa-excluded-course">None</span><span class="um-gwa-excluded-reason">All detected entries were included.</span>`;
      excludedList.append(item);
    } else {
      result.excluded.forEach((course) => {
        const item = document.createElement("li");
        item.className = "um-gwa-excluded-item";

        const courseLabel = document.createElement("span");
        courseLabel.className = "um-gwa-excluded-course";
        courseLabel.textContent = `${course.courseNumber || course.title} · ${course.gradeText || "no grade"}`;

        const reason = document.createElement("span");
        reason.className = "um-gwa-excluded-reason";
        reason.textContent = course.exclusionReason;

        item.append(courseLabel, reason);
        excludedList.append(item);
      });
    }

    excludedSection.append(excludedHeader, excludedList);

    detailsGrid.append(termSection, excludedSection);
    details.append(detailsGrid);

    const note = document.createElement("div");
    note.className = "um-gwa-note";
    note.innerHTML = `
      <strong>Heads up:</strong>
      GradeGlow runs only inside your browser, does not submit grades anywhere, and remains a personal estimate rather than an official university computation.
    `;

    shell.append(header, metrics, formula, details, note);
    panel.append(shell);

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

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 15000);
  }

  initialize();
})();
