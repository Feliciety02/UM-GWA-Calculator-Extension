<p align="center">
  <img src="docs/readme-banner.svg" width="1200" alt="GWA Gah? calculator logo and name, with an example GWA of 3.60">
</p>

<h1 align="center">GWA Gah?</h1>

<p align="center">A Chrome extension that calculates your general weighted average (GWA) from your University of Mindanao Permanent Record and shows your progress in a game-inspired dashboard.</p>

<p align="center"><code>Version 2.1.0</code> &nbsp; <code>Chrome · Manifest V3</code> &nbsp; <code>Vanilla JavaScript</code> &nbsp; <code>Runs locally</code></p>

<p align="center">
  <a href="https://github.com/Feliciety02/UM-GWA-Calculator-Extension/archive/refs/heads/main.zip"><img src="docs/download-button.svg" width="216" alt="Download ZIP"></a>
  <br>
  <sub>Then follow the <a href="#install-in-chrome">3-step install</a> below. It takes about a minute.</sub>
</p>

<p align="center">
  <a href="#at-a-glance"><strong>At a glance</strong></a> &nbsp;·&nbsp;
  <a href="#app-tour"><strong>App tour</strong></a> &nbsp;·&nbsp;
  <a href="#how-it-works"><strong>How it works</strong></a> &nbsp;·&nbsp;
  <a href="#install-in-chrome"><strong>Install</strong></a> &nbsp;·&nbsp;
  <a href="#troubleshooting"><strong>Troubleshooting</strong></a>
</p>

GWA Gah? adds a calculator above the grades on the [UM Student Portal Permanent Record](https://student.umindanao.edu.ph/student/spr). It reads the grades already displayed on that page, excludes specified courses and invalid entries, then calculates a unit-weighted average. **The result is a personal estimate, not an official UM record or a determination of academic honors.**

## At a glance

<table>
  <tr>
    <td align="center" width="25%"><strong>01 · Calculate</strong><br><sub>Unit-weighted GWA from final grades</sub></td>
    <td align="center" width="25%"><strong>02 · Compare</strong><br><sub>Old and new grading system selector</sub></td>
    <td align="center" width="25%"><strong>03 · Explore</strong><br><sub>Rank, progress, and semester breakdown</sub></td>
    <td align="center" width="25%"><strong>04 · Copy</strong><br><sub>One-click GWA copy and manual refresh</sub></td>
  </tr>
</table>

The extension runs on the Permanent Record page only. It has no separate backend service, sign-in, analytics, or grade upload.

## App tour

The 3.60 in the banner is an **example value**. Your own GWA and course counts come from your Permanent Record, shown in a calculator card above the record table.

| In the calculator | What it shows |
| --- | --- |
| **Old / New toggle** | Switches between 1.0–5.0 (old, lower is better) and 1.0–4.0 (new, higher is better). The new system is selected initially; your choice is remembered in the portal's local storage. |
| **Rank and progress** | A game-inspired rank from Legend to Struggling, based on the calculated GWA. The progress bar follows the selected scale. |
| **Units, Courses, Filtered** | Totals for included units and courses, plus a count of excluded rows. |
| **Grade Reference** | An expandable lookup table for the selected grading system. |
| **Semester breakdown** | GWA, course count, and units for each term found in the record, plus reasons for excluded entries. |
| **Copy GWA / Recalculate** | Copies the two-decimal GWA or rereads the current record. |

Rank titles and descriptions are motivational labels inside the extension. They do not certify official distinctions or honors.

## How it works

```mermaid
flowchart LR
    A["UM Permanent Record table"] --> B["Read final grades and units"]
    B --> C["Filter excluded or invalid rows"]
    C --> D["Calculate unit-weighted GWA"]
    D --> E["Rank, progress, and term breakdown"]
    F["Old / New selector"] --> C
    F --> E
```

The extension uses the **numeric Final Grade** shown in the portal. It does not convert raw scores before calculating. For each included course:

```text
GWA = Σ(final grade × units) ÷ Σ(units)
```

For example, a 4.0 grade in a 3-unit course and a 3.0 grade in a 2-unit course give `(4.0 × 3 + 3.0 × 2) ÷ 5 = 3.60`. The displayed GWA is rounded to two decimal places; rank thresholds use the unrounded result.

The calculator filters out:

- Course codes such as **NSTP 1**, **PE 1**, and **PAHF 1**, plus **CAED 500** (including `CAED 500/L`).
- Rows without a numeric final grade, with a grade outside the selected system's 1.0–5.0 or 1.0–4.0 range, or without positive units.

Filtered rows are highlighted in the portal table and listed with their reason under **Semester breakdown**. The extension only recognizes a Permanent Record table with **Course Number**, **Descriptive Title**, **Final Grade**, and **Unit** columns.

## Install in Chrome

GWA Gah? is not on the Chrome Web Store, so you load it yourself. It works in Chrome and in other Chromium browsers such as Edge and Brave.

**1. Download and unzip**

[**⬇ Download the ZIP**](https://github.com/Feliciety02/UM-GWA-Calculator-Extension/archive/refs/heads/main.zip), then unzip it: on Windows, right-click the file and choose **Extract All**; on a Mac, double-click it. You get a folder named `UM-GWA-Calculator-Extension-main`. Keep it somewhere permanent, such as Documents, because the browser loads the extension from that folder every time.

**2. Load it into the browser**

| Chrome | Edge | Brave |
| --- | --- | --- |
| Go to `chrome://extensions` | Go to `edge://extensions` | Go to `brave://extensions` |

Turn on **Developer mode** (top right in Chrome and Brave, left sidebar in Edge), click **Load unpacked**, and select the `UM-GWA-Calculator-Extension-main` folder. Select the folder that directly contains [`manifest.json`](manifest.json). If the folder you picked only contains another folder with the same name, open it and select the inner one.

**3. Open your Permanent Record**

Sign in to the [UM Student Portal Permanent Record](https://student.umindanao.edu.ph/student/spr). The calculator appears above the record table once your grades load. Pin the extension from the puzzle-piece menu if you want its icon in the toolbar.

### Updating

Download the ZIP again and replace the files in your existing folder. Then click **Reload** (↻) on the extension's card in the extensions page and refresh the Permanent Record. If you cloned the repository with Git, run `git pull` instead of downloading.

## Grading systems and ranks

Select the system that applies to your record. The grade reference in the calculator helps you inspect the scale, while the actual GWA calculation uses the portal's Final Grade values.

| Rank | New system: higher is better | Old system: lower is better |
| --- | --- | --- |
| 🏆 Legend | GWA ≥ 3.50 | GWA ≤ 1.50 |
| ⭐ Master | 3.00 ≤ GWA < 3.50 | 1.50 < GWA ≤ 2.00 |
| 🎯 Scholar | 2.50 ≤ GWA < 3.00 | 2.00 < GWA ≤ 2.50 |
| 📘 Achiever | 2.00 ≤ GWA < 2.50 | 2.50 < GWA ≤ 3.00 |
| 🎮 Player | 1.50 ≤ GWA < 2.00 | 3.00 < GWA ≤ 3.50 |
| ⚡ Rookie | 1.00 < GWA < 1.50 | 3.50 < GWA ≤ 4.00 |
| 🔥 Struggling | GWA = 1.00 | 4.00 < GWA ≤ 5.00 |

## Explore the repository

| File | Purpose |
| --- | --- |
| [`manifest.json`](manifest.json) | Chrome Manifest V3 settings and Permanent Record URL match |
| [`content.js`](content.js) | Reads the record, calculates the GWA, and builds the dashboard |
| [`styles.css`](styles.css) | Calculator layout, colors, ranks, and responsive styles |
| [`icons/`](icons/) | Extension icons: a blue calculator reading "GG" |
| [`docs/logo.svg`](docs/logo.svg) | The calculator logo (source of the `icons/` PNGs) |
| [`docs/readme-banner.svg`](docs/readme-banner.svg) | README banner |
| [`docs/download-button.svg`](docs/download-button.svg) | Download ZIP button used in the README |

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Calculator does not appear | Open the Permanent Record at `/student/spr`, wait for the grades table, and refresh the page. Check that the extension is enabled in `chrome://extensions`. |
| “No valid courses found” | Confirm the selected grading system matches your record and that at least one course has a numeric final grade and positive units. Open **Semester breakdown** for filtered entries. |
| GWA differs from your expectation | Check the selected system, excluded courses, and unit values. The extension reads the portal's Final Grade values; it does not use raw scores or unposted grades. |
| Copy GWA fails | Use **Recalculate** and try again. You can also select and copy the displayed number manually. |

If the portal changes its table headings or layout, the calculator may need an update.

## Privacy and scope

The manifest injects the extension only on `https://student.umindanao.edu.ph/student/spr*`. The code reads the page's grades locally and does not send them to a server. It saves only your old/new grading system choice in that site's `localStorage`; it does not save a copy of your grades. Review [`manifest.json`](manifest.json) and [`content.js`](content.js) if you want to inspect exactly what runs.

## Contributing

Found a calculation issue, an excluded course that needs review, or a portal change? [Open an issue](https://github.com/Feliciety02/UM-GWA-Calculator-Extension/issues) with the steps to reproduce it. If you include a screenshot, hide your name, student ID, and grades first. Pull requests are welcome.

Made by [Fe Anne Malasarte](https://github.com/Feliciety02), BS Computer Science at the University of Mindanao.
