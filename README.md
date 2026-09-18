# RAMRT // Renal Allograft Multimodal Risk Terminal

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](https://opensource.org/licenses/MIT)
[![Theme: RAMRT](https://img.shields.io/badge/Theme-RAMRT%20Abyssal%20Terminal-003734.svg)](#ramrt-design-system)
[![Model: ElasticNet](https://img.shields.io/badge/Model-ElasticNet%20Logistic%20(N%3D443)-38bdf8.svg)](#model-architecture)
[![Validation: DeLong p < 0.001](https://img.shields.io/badge/DeLong%20Test-p%20%3D%200.00074-10b981.svg)](#validation-and-audited-evidence)

An evidence-based point-of-care clinical risk nomogram and abyssal terminal interface for predicting acute kidney allograft rejection, developed from longitudinal doctoral research at the **Department of Immunopathology, Postgraduate Institute of Medical Education and Research (PGIMER), Chandigarh, India**.

---

## 🔬 Clinical & Research Background

- **Dissertation Title:** *Impact of HLA-epitope analysis and non-HLA immune regulatory genes polymorphism on graft outcome in kidney transplantation*
- **PhD Candidate:** Heera Singh, MSc
- **Doctoral Supervisor:** Prof. Ranjana Walker Minz, MD (Head, Department of Immunopathology, PGIMER)
- **Cohort Scale:** Master repository of $N = 2,220$ transplant episodes, $2,492$ biopsies, and $11,653$ crossmatch events.
- **Multimodal Complete-Typed Cohort:** $N = 443$ recipients with simultaneous clinical baseline, allele-level HLA (A, B, DRB1), and pre-transplant flow cytometric crossmatch (FCXM) data.

---

## ⚡ Key Statistical & Model Highlights

| Metric / Dimension | Value | Clinical Interpretation |
| :--- | :---: | :--- |
| **Multimodal ROC-AUC** | **0.6926** [0.629–0.751] | Superior out-of-fold discrimination evaluated across 25 repeated cross-validation folds. |
| **Incremental Predictive Gain** | **+0.1018** ($\Delta$ AUC) | Statistically confirmed improvement over clinical baseline alone (**DeLong $z = 3.3743, p = 0.00074$**; 25-fold paired $t$-test $p = 2.45 \times 10^{-7}$). |
| **Observed Risk Gradient** | **6.4-fold** ($5.6\% \rightarrow 36.0\%$) | Strictly monotonic observed rejection progression across nomogram quintiles (Q1: $5.6\% \le$ Q2: $10.2\% \le$ Q3: $20.2\% \le$ Q4: $21.6\% \le$ Q5: $36.0\%$). |
| **Calibration Goodness-of-Fit** | **$p = 0.5132$** | Hosmer-Lemeshow $\chi^2 = 2.2965$ ($df = 3$); verified probability calibration without over-optimism. |
---

## 📐 Mathematical Model Architecture & Deployment Specification

The clinical calculator implements the **audited 7-predictor specification** of the primary winning ElasticNet model from Phase 4 ($N = 443$).

### Linear Predictor Formula
$$\text{logit}(P) = \beta_0 + \beta_{\text{Donor\_Age}} \cdot z_{\text{Donor\_Age}} + \beta_{\text{Sibling}} \cdot I_{\text{Sibling}} + \beta_{\text{Deceased}} \cdot I_{\text{Deceased}} + \beta_{\text{Induction}} \cdot I_{\text{Std\_Induction}} + \beta_{\text{Total\_MM}} \cdot z_{\text{Total\_MM}} + \beta_{\text{DRB1}} \cdot z_{\text{DRB1}} + \beta_{\text{MCS\_T}} \cdot z_{\text{MCS\_T}}$$

$$\text{Probability of 1-Year Acute Rejection} = \frac{1}{1 + e^{-\text{logit}(P)}}$$

### Locked Coefficients & Standardization Parameters
*Parameters derived directly from the deployment `StandardScaler` and `LogisticRegression` fit on the complete Tier 3 cohort ($N = 443$):*

| Predictor Identifier | Type | Cohort Mean ($\mu$) | Cohort Scale ($\sigma$) | Standardized $\beta$ | Adjusted OR [95% CI] | Clinical Biological Role |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Model Intercept ($\beta_0$)** | Constant | — | — | **-2.1944** | — | Baseline log-odds at cohort mean |
| **Donor Age** | Continuous | 46.4086 yrs | 9.5739 yrs | **+0.2773** | 1.320 [1.011–1.722] | Organ senescence / primary continuous hazard |
| **Sibling Donor** | Binary | — | — | **-0.8236** | 0.439 [0.241–0.798] | Haplotype sharing / unmeasured protective matching |
| **Deceased Donor** | Binary | — | — | **-0.6943** | 0.499 [0.254–0.981] | Organ source baseline covariate |
| **Standard Induction** | Binary | — | — | **+0.6993** | 2.012 [1.180–3.431] | Basiliximab vs. lymphocyte-depleting ATG |
| **Total HLA Mismatches** | Continuous | 3.1716 | 1.7463 | **-1.6432** | 0.193 [0.081–0.461] | Complex regularization modifier |
| **HLA-DRB1 Mismatch** | Continuous | 0.8330 | 0.6438 | **+0.9327** | 2.541 [1.420–4.549] | Primary Class II cellular risk driver |
| **T-Cell Channel Shift (T-MCS)** | Continuous | 19.0308 | 42.8138 | **+0.3542** | 1.425 [1.042–1.948] | Pre-transplant flow cytometric cellular reactivity |

> [!IMPORTANT]
> **Model Simplification Disclosure:**  
> This tool uses the 7 most influential predictors from the full 31-covariate locked model; less influential factors (recipient age/sex, individual A/B-locus mismatch, B-cell crossmatch shift, FCXM dual-positivity) are held at cohort-average values. Predictions for patients who deviate substantially from cohort averages on these factors may differ from the full model.

---

## 🎨 RAMRT Design System (tokens + light/dark)

The interface follows the *data-dense dashboard* pattern: a fixed icon sidebar, a sticky top bar, KPI tiles, and dense tables — built on a three-layer token system in [`ramrt_ui.css`](ramrt_ui.css), which is loaded last and owns the visual language.

| Layer | What it holds | Example |
|---|---|---|
| **Primitives** | the brand ramps, never used directly | `--p-abyss #011314`, `--p-aqua #cbfffc`, `--p-phosphor #fde9ff` |
| **Semantic** | the roles components read, redefined per theme | `--bg`, `--surface-1/2/3`, `--text-1/2/3`, `--accent`, `--stat`, `--ok/warn/danger/info`, `--border`, `--focus`, `--shadow-1/2/3` |
| **Components** | shell, cards, KPI tiles, tables, buttons, fields, tabs, chips, disclosures, modal | `.surface-card`, `.db-sum-item`, `.table-matrix`, `.btn-aurora`, `.calc-tab-bar` |

**The palette is unchanged** — abyss/deep/kelp teals, aqua, lavender phosphor and the aurora gradient. What changed is the organisation: colours are no longer hardcoded in components (336 literals across the older stylesheets were rewritten as tokens), so a second theme is a matter of redefining one block.

**Theme mode.** A Light / Dark switch sits in the top bar ([`theme_mode.js`](theme_mode.js)). The choice is stored in `localStorage` under `ramrt-theme`; **dark is the default**, and the retired values (`system`, `abyss`, `glass`) are mapped over on first load. An inline script in `<head>` sets the theme before first paint, so there is no flash, and `<meta name="theme-color">` follows the theme. Dark is the Auros abyssal terminal; light puts the same palette on a paper canvas. The landing hero stays a dark island in both themes — the 3D helix and aurora buttons were drawn for a dark canvas — which is done by re-declaring the tokens for that subtree.

**Interface scale.** A second control in the top bar renders the desktop UI at **80%** (the default), 90% or 100% density, so the app looks the way it does at 80% browser zoom without anyone touching browser zoom. It sets `--ui-scale`, which `ramrt_ui.css` applies as `zoom` above 860px — a real re-layout, so the page still fills the window and text stays crisp. `vh` lengths are the one thing `zoom` does not adjust, so the full-height panels use `--vh`/`--vw` (pre-divided by the scale). Phones stay at 1:1 so body text never drops below the readable minimum. The choice is stored under `ramrt-ui-scale`, and browser zoom still works on top of it.

**Rules applied** (from the `ui-ux-pro-max` design skill, *Data-Dense Dashboard* style): SVG icons rather than emoji; one focus treatment (2px ring, 2px offset) on every control; 44px minimum touch targets; 150–260ms transitions on a shared easing token; 4/8px spacing rhythm; tabular figures for every number column; sticky table headers; `prefers-reduced-motion` honoured; breakpoints at 375 / 640 / 860 / 1100 / 1440.

**Contrast.** Every text token pair is checked against WCAG AA in both themes (body text 9.8:1, captions ≥5.7:1, accents ≥5.7:1, primary button label ≥6.4:1), and each view is swept in the browser for text below 4.5:1 and targets under 24px.

---

## 🚀 Quick Start & Local Execution

This frontend calculator is lightweight, fully self-contained, and requires **zero external build tools or npm dependencies**.

### Option 1: Direct Browser Access
Simply open `index.html` in any modern web browser.

### Option 2: Python HTTP Server
```bash
cd clinical_risk_calculator
python -m http.server 8080
```
Open your browser at `http://localhost:8080/`.

---

## 🧭 Using the app

- **Structure**: two pages. The **landing page** is a single hero section with an animated 3D DNA helix (`dna_hero.js`, plain 2D-canvas perspective renderer, no library; a static frame under the reduced-motion setting) and two buttons: *Open dashboard* and *Try the example pair*. The **dashboard** follows the Auros "abyssal terminal" style system (`dashboard_theme.css`: teal surface stack abyss → deep → kelp, no shadows, 16 px cards, tracked uppercase labels, lavender-phosphor statistics, aurora-gradient primary button) with a sidebar (Dashboard, Risk calculator, HLA & eplets, HED · AAMS · EMS3D, Back to site), a sticky top bar with the breadcrumb and the theme switch, a summary strip (antigen mismatches, mismatched eplets, immunogenic eplets, predicted risk) and a home page with module shortcuts, recent HLA analyses and risk estimates (saved in the browser with *Save to recent* / *Save estimate*), reference-data status and the collapsible study evidence. Deep links: `#dashboard`, `#risk`, `#hla`, `#hla-example`, `#hla-3d-example`, `#scores`, `#scores-example`. A light frosted-glass alternative (`dashboard_glass.css`) can be switched on from the help dock ("Light glass look"); the choice is remembered per browser. `tools/rebuild_views.py` regenerates the landing page, summary strip and home pane idempotently.
- **Risk calculator**: grouped inputs, a sticky results panel with the probability, risk band gauge, a "What drives this estimate" breakdown (each input's contribution to the log-odds from the locked coefficients), and collapsible band table, suggested actions and model-gain bars. Deep links: `#dashboard` (home), `#risk`, `#hla`, `#hla-example`, `#hla-grid-example`, `#hla-3d-example`. Views are rebuilt with `python tools/rebuild_views.py && python tools/splice_pane.py`.
- **Three steps**: enter recipient and donor HLA typing (HLA & eplets), read the mismatch dashboard, then press *Send to risk calculator* to carry the antigen-level mismatches and eplet loads into the risk calculator and add donor age, induction and crossmatch values.
- **Two input modes** on tab 2: *Paste typing* (any common notation, results update as you type) or *Enter by locus* (a grid with allele auto-complete from the reference database). Problems are shown in plain language with candidate alleles.
- **Dashboard**: headline counts, a per-locus glance (antigen mismatches as dots, eplet load bars with the immunogenic share in pink), a "what these numbers mean" box, and collapsible detail sections (allele-level by locus, eplets by donor allele, immunogenic eplets, method and result ID).
- **Help & glossary** button (bottom right) explains every term; **background motion** can be switched off (also follows the system reduced-motion setting).
- **Export**: copy a text report, download a CSV, or print (collapsed sections expand when printing).
- **3D view (pHLA3D-style)**: in the results, "3D view of mismatched eplets on the donor molecule" renders the chosen donor allele with every mismatched eplet patch marked (large sphere = anchor residue, small spheres = other residues of the eplet; pink immunogenic, cyan antibody-verified, grey other). Structure sources in order: a pHLA3D homology model of the exact allele in `structures/phla3d/` (fetched by `tools/fetch_structures.py --phla3d tools/phla3d_allele_list.txt` with `PHLA3D_URL_PATTERN` set; research-use licence, cite pHLA3D; served over http), the offline bundle `hla_structures_data.js` (19 RCSB entries, 23 alleles), RCSB online, or a same-locus template (labelled), plus any PDB file you load. Eplet residue patches come from `hla_eplet_residues.js` (`tools/build_eplet_residues.py`, 566/591 anchors verified against the workbook sequences). The residue at every anchor is checked against the eplet name and reported. Viewer: 3Dmol.js from `vendor/` (offline) with cdnjs fallback.
- **Deep links**: `index.html#dashboard` (risk calculator), `#hla` (HLA & eplet analysis), `#hla-example` (with a demo pair), `#hla-grid-example` (demo pair in the by-locus grid), `#hla-3d-example` (demo pair with the 3D view opened).
- The engine pane markup lives in `tools/pane_hla.html`; after editing it run `python tools/splice_pane.py`.

---

## 🧬 Integrated HLA Mismatch & Eplet Engine (tab 02)

The second calculator tab performs the complete mismatch and immunogenicity workflow inside the page, with no external calculator, spreadsheet or website:

**HLA input → allele-level mismatch → molecular / eplet mismatch → immunogenic eplet identification → total vs immunogenic load**

- **Reference database** (`hla_reference_data.js`, generated by `tools/build_hla_reference.py`): the HLAMatchmaker v3.1 workbooks `ABC_Antibody_Analysis_3.1.xlsb` (1,889 class I alleles) and `DRDQDP_Antibody_Analysis_3.1.xlsb` (666 class II β and 34 α alleles, DRB3/4/5 and DQA1 linkage tables) plus the PGIMER immunogenic eplet catalogue `IE.xlsx`. Every allele–eplet cell and category is taken verbatim from the workbooks and validated against the workbooks' own cached per-allele counts (1,890/1,890 class I, 665/666 class II β with one whitespace-cell exception, 34/34 α).
- **Input**: paste donor and recipient two-field alleles (A, B, C, DRB1, DRB3/4/5, DQA1, DQB1, DPA1, DPB1) in any common notation; calculations run automatically. Low-resolution, unsupported, duplicated or malformed entries are flagged with candidates.
- **Allele-level mismatch**: per locus, donor-specific mismatched alleles with the corresponding recipient alleles, at both the allele (two-field) and antigen (first-field) level. The thesis registers and the Phase 4 model count at the antigen level (97.9% of 1,977 recorded values reproduced), so antigen-level counts are what "Send to Nomogram" passes to tab 01.
- **Eplet mismatch**: HLAMatchmaker intra- and interlocus comparison (class I A/B/C pooled; class II DRB1/3/4/5 + DQB1 + DPB1 β chains and DQA1/DPA1 α chains pooled), loads as unique mismatched eplets, categories (antibody-verified, ElliPro high/low, interlocus, other) preserved.
- **Immunogenic load**: mismatched eplets present in IE.xlsx, shown separately from total, non-immunogenic and antibody-verified loads, per donor allele and per locus.
- **Validation**: `node tools/test_engine.js` (207 checks) and the in-page "Run Self-Test" button (workbook cell counts, thesis mismatch records, repeat-run reproducibility). Full record: `validation/HLA_ENGINE_VALIDATION.md`; extraction report: `tools/reference_build_report.md`.
- **Usability** (`ux.js`, `ux_styles.css`): a three-step guide on both the landing page and the typing tab; two input modes (paste, or enter by locus with allele autocomplete from the database); a traffic-light status line with notes and inferred alleles folded away; a summary-first dashboard (headline numbers, at-a-glance bars per locus, plain-language explanation) with collapsible detail tables; CSV and text-report export; a floating **Help & glossary** with plain-language definitions; a **background-motion toggle** that also honours the operating-system reduced-motion setting; plain-language captions and a risk-band gauge on the risk calculator. `tools/ux_text_updates.py` holds the label changes so they can be re-applied after regenerating the page.

Rebuild the database after replacing a source workbook (requires `pip install pyxlsb pandas openpyxl`):

```bash
python tools/build_hla_reference.py && node tools/test_engine.js
```

The `.xlsb` sources are kept in `reference_sources/` but excluded from git because of their size (87 MB); the generated `hla_reference_data.js` is what the page uses.

---

### Batch eplet mismatch (many pairs at once)

The **Batch** tab of the HLA module mirrors the workflow of the public HLA Eplet Registry calculator (epregistry.com.br): a donor/immunizer typing plus a list of patients, one typing per line, with a **Calculate** button and a results table (antigen mismatches, class I / class II / total eplet load, immunogenic and antibody-verified counts) and a CSV download. Up to 200 rows per run, all computed in the browser.

Three line layouts are accepted:

| Line | Meaning |
|------|---------|
| `A*01:01, A*02:01, B*08:01, ...` | one patient, compared with the donor box |
| `label \| patient typing` | as above, with a row label |
| `label \| patient typing \| donor typing` | a pre-paired row; the donor box is ignored |

Deep links: `#hla-batch` opens the empty batch tab, `#hla-batch-example` loads a worked example.

`node tools/batch_eplet.js <pairs.json> <out.csv>` runs the same computation headlessly for a whole dataset.

**Typing notations accepted.** Besides the usual forms, the parser reads IMGT **G groups** (`A*11:01:01G`) and **P groups** (`A*11:01P`) by reducing them to the two-field allele, since group members share the sequence that carries the eplets; a **doubled locus prefix** (`A*A*03:01:01:01`, produced by some exports); and an **undetermined second field** (`A*33:xx`, `B*15.XX`), reported as low resolution with candidate alleles. An **ambiguous either/or typing** (`DRB1*15:01/03`) is rejected with a message naming the alternatives rather than being guessed at.

**Note on comparability with the registry calculator.** This app computes eplet loads from the HLAMatchmaker 3.1 workbooks supplied with the thesis, not from the HLA Eplet Registry release used at epregistry.com.br. The two sources curate eplets differently, so absolute counts are not expected to match one for one; rankings and relative loads are the comparable quantities. Loci missing from a typing are skipped, so pairs typed for fewer loci carry lower loads and must not be compared with fully typed pairs.

## ✨ Motion and microinteractions

`motion.css` and `motion.js` add the interaction layer. **Landing page**: the hero title is split into words for a staggered reveal, the brand line, subtitle, buttons and meta rise in sequence, the helix fades up from a slight zoom, the status dot pulses, and the background layers drift with the pointer (parallax). The primary button carries a single light sweep on hover and its arrow leans outward; ghost buttons brighten their border.

**Dashboard usability**:

| Change | Why |
|---|---|
| Help dock collapses to one small button | The three stacked buttons covered content in the bottom-right corner |
| Focus rings on every interactive element | The app previously had almost no visible keyboard focus state |
| Skip-to-content link | Keyboard and screen-reader users can bypass the sidebar |
| Toasts for actions | *Save to recent*, *Copy report*, CSV export and batch runs gave little or no confirmation |
| Statistics count up when they change | Makes a recomputed number obvious instead of silently swapping |
| Sidebar accent bar, tab underline, card and row hover states | Makes the current position and clickable targets clear |
| Panes rise into place when switching module | Signals that the view changed |

All of it is suppressed by the operating system's reduced-motion setting and by the in-app motion toggle; values with markup (such as `3/6`) are never touched by the counter. Note that headless screenshots always render the reduced-motion state, so the animation has to be judged in a real browser.

## 🧪 Molecular mismatch beyond eplets

The HLA module also reports three measures the eplet tables cannot produce, because HLAMatchmaker carries eplets rather than residues. All are computed in the browser from IPD-IMGT/HLA protein alignments and published constants.

| Measure | In the style of | What it counts |
|---|---|---|
| **Amino-acid mismatch** | HLA-EMMA (Kramer, *HLA* 2020) | Donor residues the recipient carries on neither allele, at polymorphic positions; the solvent-accessible subset is shown separately |
| **Charge / hydropathy difference** | Kosmoliaptsis 2D scores (approximation) | Summed charge and Kyte–Doolittle differences at those accessible positions, each donor residue compared with the chemically nearest recipient residue. This is **not** EMS3D; the published AAMS and EMS3D are in tab 03 |
| **HLA evolutionary divergence (HED)** | Pierini & Lenz 2018 | Shown from tab 03's implementation (the HLAdiv.net calculation); `hla_molecular.js` keeps its older per-domain estimate for the API only |

**Data build.** `tools/fetch_imgt_alignments.py` downloads and parses the IMGT protein alignments (codon 1 is read from the file's own numbering line, so leader length is never assumed); `tools/build_molecular_reference.py` emits `hla_molecular_data.js` (0.4 MB): polymorphic positions, per-allele residues for all 2,588 alleles the eplet engine supports, per-position solvent accessibility, and the Grantham / hydropathy / charge constants. Accessibility uses Shrake–Rupley on a representative structure per locus with peptide, CD8 and TCR removed, normalised by Tien et al. 2013 maxima; a position counts as accessible at ≥ 25% relative ASA.

**Validation** (in `node tools/test_engine.js`, 248 checks): Grantham distances reproduce the published matrix at ten spot values; residues reproduce textbook positions (DQB1 Asp57, Bw4/Bw6 at B-80, KIR C1/C2 at C-80, DRB1 86 G/V); the textbook single-residue pairs B\*44:02 vs B\*44:03 and A\*02:01 vs A\*02:06 yield exactly one mismatch, at positions 156 and 9 respectively.

**Deliberately not implemented.** PIRCHE-II requires a licensed peptide–MHC binding predictor, so it cannot be reproduced honestly here; the app links out instead. ElliPro and the IEDB B-cell tools predict epitopes on any protein from structure and are not donor–recipient measures at all. These values are our own implementations and are **not numerically interchangeable** with HLA-EMMA, PIRCHE-II or the Kosmoliaptsis tools — use them for ranking within a cohort, not as a substitute for those services.

## 🧮 HLA divergence & immunogenicity scores — HED, AAMS, EMS3D (tab 03)

The third tab computes, inside the app, the scores that were previously only available from two external web tools: **HLA evolutionary divergence** (HLAdiv.net) and the Kosmoliaptsis **amino-acid mismatch score (AAMS)** and **three-dimensional electrostatic mismatch score (EMS3D)** (HLA Algorithms Shiny app). Nothing is sent to another site. Open it from the sidebar (*HED · AAMS · EMS3D*), with key `4`, or with `#scores` / `#scores-example`; *Use the pair from HLA & eplets* copies the pair typed in tab 02 (including any DRB3/4/5 or DQA1 inferred there). The AAMS, EMS3D and HED headline values also appear in tab 02's molecular block.

| Score | Published method | What the app does |
|---|---|---|
| **HED** | Pierini & Lenz, *Mol Biol Evol* 2018; Chowell et al., *Nat Med* 2019 (HLAdiv.net) | Grantham (1974) integer distance averaged over mature residues 2–182 (class I exons 2+3); positions where either allele has no determined residue are left out, with the reference script's own loop bound. Class I mean = mean of HLA-A, -B, -C. DRB1/DQB1 use the script's class II region (β 6–94). Modes: per person, pair, and the HLAdiv batch TSV (`Sample`, `HLAI` = A,A,B,B,C,C) with a TSV download in the site's column layout. |
| **AAMS** | Kosmoliaptsis et al., *Transplantation* 2009, 2011; *Am J Transplant* 2016 | For each donor molecule the recipient lacks: extracellular positions where the donor residue is absent from every recipient molecule of the comparison set — HLA-A/B/C pooled (class I), DRB1/3/4/5 pooled (DR), each chain within its locus for DQ and DP (heterodimer = α + β). Extracellular range from UniProt (class I 1–284, DRB 1–198); the Cambridge group has not published theirs. |
| **EMS3D** | Mallon et al., *J Immunol* 2018 | Electrostatic distance ESD = √(2 − 2·SI) (Hodgkin index over a 3 Å skin 4 Å above the molecular surface); EMS3D = minimum ESD to the recipient's class I molecules (class I) or to the recipient's molecules of the same locus (class II). Precomputed, like the original tool. |

DQ and DP chains are paired into heterodimers; for DQ the phase follows the DQA1\*01 ↔ DQB1\*05/06 pairing rule when that decides it, otherwise the typed order (a checkbox switches phase). Per-locus summaries give both the highest value (Kim et al. 2023) and the sum (Kosmoliaptsis et al. 2016).

**Data.** `tools/build_hla_scores_reference.py` turns the cached IPD-IMGT/HLA 3.65.0 protein alignments into `hla_scores_data.js` (0.8 MB; every two-field allele of A, B, C, DRB1/3/4/5, DQA1, DQB1, DPA1, DPB1 without an expression suffix, residues merged across each two-field group, alleles known only over exons 2–3 completed from the closest fully sequenced allele and marked in lower case — HED never uses those residues). `tools/ems3d/build_ems3d.py` builds the EMS3D library in Docker (`tools/ems3d/Dockerfile`: APBS 3.4.1, PDB2PQR/PROPKA, OpenMM, PDBFixer) and writes `hla_ems3d_meta.js` (molecule names, loaded with the page) and `hla_ems3d_I.js`, `_DR.js`, `_DQ.js`, `_DP.js` (distance tables, fetched only when a pair needs them).

```bash
py tools/build_hla_scores_reference.py
docker build -t ramrt-ems3d tools/ems3d
docker run --rm -v "$PWD:/app" ramrt-ems3d python tools/ems3d/build_ems3d.py run --set core --workers 24 --apbs-slots 4 --dime 193
docker run --rm -v "$PWD:/app" ramrt-ems3d python tools/ems3d/build_ems3d.py export --dime 193
node tools/test_engine.js
```

**EMS3D library (built 2026-09-17).** 4,278 molecules: 1,880 class I alleles, DRB1 326, DRB3 33, DRB4 7, DRB5 15, 1,222 DQA1~DQB1 heterodimers (pairing rule applied), 795 DP heterodimers (DPA1\*01:03, \*02:01, \*02:02, \*03:01, \*04:01 × every engine DPB1); 76 molecules are not scored because an allele is no longer a suffix-free two-field name in IMGT 3.65. The within-locus distances match the published distribution closely (e.g. HLA-A median 0.352 vs 0.355, DRB1 0.289 vs 0.276, DP 0.246 vs 0.261). The final build took about 6 hours of wall clock in Docker on this machine (models ~25 s each; APBS is memory-bandwidth bound, ~0.3 molecules/s in parallel); intermediate files (1.7 GB) stay in the git-ignored `tools/ems3d/work/`, so adding molecules only computes the new ones.

**Validation** is in [`validation/HLA_SCORES_VALIDATION.md`](validation/HLA_SCORES_VALIDATION.md); the key points: all nine worked HED examples on HLAdiv.net are reproduced to the last digit, as are the Lenz class II example outputs; residues 2–182 of IMGT 3.65 equal those of IMGT 3.37 (HLAdiv's allele set) for 11,281 of the 11,283 alleles present in both; the EMS3D grid density (193³ over 116 Å) differs from the published 353³ by at most 0.0044 ESD.

**How it differs from the originals.** HED: HLAdiv.net covers class I alleles of IMGT 3.37; this app accepts any IMGT 3.65 allele and adds DRB1/DQB1. AAMS: the extracellular range is UniProt's. EMS3D: Mallon et al. used MODELLER multi-template models; MODELLER needs a licence, so each allele here is threaded onto one template from their list (class I 1K5N, DR 3PDO, DQ 1JK8, DP 4P5M) and relaxed with OpenMM (backbone and unchanged residues restrained). Individual EMS3D values therefore will not equal the Cambridge tool's; molecules not in the library are reported as *not scored*, and when some recipient molecules are unscored the value is shown as an upper bound (≤).

**Precision of EMS3D.** One model fixes one arrangement of the side chains. Models of the same allele built from different random starting points differ by a median ESD of 0.16 (different alleles: 0.48), with vacuum relaxation, implicit solvent or no relaxation alike (`tools/ems3d/seed_check.py`, `protocol_check.py`). The library uses a fixed seed, so it is reproducible, but EMS3D differences below about 0.2 are within modelling noise, and published cut-offs for the Cambridge tool (e.g. HLA-DQ 0.37) do not transfer.

---

## 🔗 The external tools (PIRCHE-II, HLA-EMMA, IEDB)

**Neither PIRCHE-II nor HLA-EMMA has an open-source implementation.** Both were checked against GitHub, PyPI and the literature: PIRCHE-II is proprietary to PIRCHE AG and depends on a licensed peptide–MHC binding predictor; HLA-EMMA is a licensed download requiring registration. Nothing from either is reproduced here. Two things are provided instead.

### 1. A bridge to the real services

The HLA module has a *Send this pair to PIRCHE-II, HLA-EMMA or IEDB* panel: it formats the entered typing the way each service expects (copy or download), links out, and gives you fields to paste the returned scores back. Pasted values are stored in the browser against that pair's result ID and shown beside our own measures — so the authoritative numbers and ours sit side by side, and nothing is invented.

### 2. `tools/pirche_style.py` — an offline approximation

```bash
python tools/pirche_style.py --recipient "A*01:01,..." --donor "A*02:01,..."
python tools/pirche_style.py --pairs scratch/hla_pairs.json --out scores.csv
```

Implements the *approach* of PIRCHE-II — donor-HLA 15-mers, presentation by the recipient's own DR molecules, self-peptide subtraction — using the open TEPITOPE pocket-profile matrices (Sturniolo et al. 1999) in place of NetMHCIIpan.

**It is not PIRCHE-II and the numbers will not match published PIRCHE-II values.** Two approximations are stated in the script header: TEPITOPE matrices exist for only 10 DRB1 alleles and 1 DRB5, so a query allele is mapped to the reference it most resembles across the peptide-binding domain (TEPITOPEpan does this per pocket, which is finer); and only DR presentation is modelled. Use it as an internally consistent ranking within one cohort.

On the thesis dataset (132 pairs): **120 evaluable, median 31, IQR 24–41, range 0–60**; 12 pairs have no mappable DR allele and are reported blank rather than zero, so they cannot be averaged in as if they scored nothing.

### 3. Independent cross-check of the eplet reference

`tools/crosscheck_hlar.py` compares our eplet tables against [hlaR](https://github.com/LarsenLab/hlaR) (Emory, MIT licence, on CRAN) — the only open-source implementation of HLAMatchmaker tables. Full write-up in [`validation/HLAR_CROSSCHECK.md`](validation/HLAR_CROSSCHECK.md). Headline: allele coverage is identical, ours is a superset (hlaR ships v3, we build from v3.1), and **51 eplet names used by v3-era tools do not exist in v3.1 at all** — including `130Q` and `160D`, which appear in the thesis's own Class II catalogue. That matters for how eplet names are reported in the thesis.

## ⚖️ Eplet reference version and licensing

The HLA module can run on either of two eplet references, chosen in **Options → Eplet reference version**. The choice is remembered per browser. **v3 (hlaR, MIT) is the default**, because its licence permits commercial use and it carries the eplet names the thesis registers actually use; v3.1 remains available for reproducing the numbers this project validated against. The in-app self-test always runs against v3.1 whichever reference is selected, since the validation vectors were computed from those workbooks.

| | HLAMatchmaker **v3.1** (default) | HLAMatchmaker **v3** (hlaR) |
|---|---|---|
| Source | `ABC_/DRDQDP_Antibody_Analysis_3.1.xlsb` (not default) | [hlaR](https://github.com/LarsenLab/hlaR) 1.0.0, Emory (CRAN) |
| Licence | **None stated** | **MIT** |
| Commercial use | Not established — see below | **Permitted with attribution** |
| Distinct eplets | 297 / 256 / 38 (I / IIβ / IIα) | 141 / 168 / 33 |
| Linked-allele inference | Yes | No — linkage tables come from the unlicensed workbooks and are omitted |
| Thesis-era names (`130Q`, `160D`, `96R`, `84G`, `50Q`, `57E`) | absent | **present** |

**Why the second option exists.** The v3.1 workbooks carry no licence, no copyright notice and no terms of use anywhere in the files. Their metadata shows Rene Duquesnoy / UPMC, last modified mid-2020, and **both distribution sites are now expired parked domains** (`hlamatchmaker.net` is for sale on HugeDomains, `epitopes.net` on DropCatch). With no grant of rights published anywhere, default copyright applies: commercial use cannot be inferred from the fact that it was once a free academic download. For commercial deployment, obtain written permission from UPMC, or run on the MIT-licensed v3 tables.

**The two are not interchangeable.** On the built-in example pair, v3.1 reports 30 mismatched eplets and v3 reports 16. Switching version changes every eplet number in the app. See [`validation/HLAR_CROSSCHECK.md`](validation/HLAR_CROSSCHECK.md) for the full comparison. Note the useful side effect: the thesis registers use v3-era eplet names, so **v3 mode reproduces the thesis vocabulary that v3.1 cannot**.

Attribution required by MIT is emitted into `hla_reference_v3.js` and shown in the interface when v3 is selected. Build with `python tools/build_hlar_reference.py <dir with hlaR ref CSVs>`.

## 📂 Repository Structure

```
├── index.html                 # Semantic RAMRT HTML terminal markup & inputs (tabs 01 nomogram, 02 HLA engine, 03 HED/AAMS/EMS3D)
├── ramrt_ui.css               # Design tokens (light/dark) + the dashboard component layer
├── theme_mode.js              # System / Light / Dark switch
├── styles.css                 # Older layout layer (now reads tokens)
├── hla_styles.css             # Styles for the HLA mismatch & eplet engine pane
├── app.js                     # ElasticNet model math, 3D particle sphere & molecular canvas
├── hla_engine.js              # HLA parser, allele/antigen mismatch, eplet & immunogenic load engine (browser + Node)
├── hla_ui.js                  # Binds the engine to the dashboard, self-test, send-to-nomogram
├── hla_reference_data.js      # GENERATED reference database (HLAMatchmaker v3.1 tables + IE.xlsx)
├── hla_scores.js              # HED, AAMS and EMS3D (browser + Node)
├── hla_scores_ui.js           # Tab 03 (HED · AAMS · EMS3D)
├── hla_scores_data.js         # GENERATED IMGT extracellular residues (tools/build_hla_scores_reference.py)
├── hla_ems3d_*.js             # GENERATED EMS3D library (tools/ems3d/build_ems3d.py)
├── hla_validation_vectors.js  # GENERATED self-test vectors
├── reference_sources/         # Source workbooks (IE.xlsx tracked; .xlsb files excluded from git)
├── tools/                     # build_hla_reference.py, test_engine.js, build report, validation vectors
├── validation/                # HLA_ENGINE_VALIDATION.md
├── README.md                  # Documentation, clinical context & model metrics
└── .gitignore                 # Git hygiene
```

---

## ⚖️ Disclaimer
*This application is intended strictly for academic evaluation, doctoral dissertation review, and research risk stratification. Clinical management decisions must always be made by a qualified transplant nephrologist and multidisciplinary team.*
