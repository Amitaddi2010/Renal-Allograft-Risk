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
| **Primary Survival Determinant** | **HR = 1.049 / year** | Donor senescence dominates graft failure risk ($p = 0.0024$), superseding broad unweighted HLA mismatches. |

---

## 🎨 RAMRT Design System

The application is styled following the **RAMRT Design System** — an abyssal fintech terminal aesthetic:
- **Canvas:** Liquid Abyss (`#012624`) with an interactive 3D rotating bioluminescent particle sphere.
- **Surfaces:** Liquid Deep (`#011d1c`) for recessed panels and Liquid Kelp (`#003734`) for lifted feature cards.
- **Strict Elevation:** Zero drop shadows or artificial box shadows; depth is communicated through water-immersion surface tiers.
- **Typography:** Geometric display typography with tight negative tracking on headings and wide uppercase tracking on instrumentation labels.
- **Accent:** Signature Aurora Gradient (`#cbfffc` $\rightarrow$ `#fad1ff`) for primary action triggers and Lavender Phosphor (`#fde9ff`) for glowing statistical counters.
- **Responsive:** Fluid layout optimized for mobile screens (320px+), tablets, laptops, and wide monitors.

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

## 📂 Repository Structure

```
├── index.html     # Semantic RAMRT HTML terminal markup & inputs
├── styles.css     # RAMRT design tokens, responsive breakpoints & layout
├── app.js         # ElasticNet model math, 3D particle sphere & molecular canvas
├── README.md      # Documentation, clinical context & model metrics
└── .gitignore     # Git hygiene
```

---

## ⚖️ Disclaimer
*This application is intended strictly for academic evaluation, doctoral dissertation review, and research risk stratification. Clinical management decisions must always be made by a qualified transplant nephrologist and multidisciplinary team.*
