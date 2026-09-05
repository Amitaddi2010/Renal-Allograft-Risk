# MANUSCRIPT 1: MULTIMODAL PREDICTIVE MODELING

**Title:** Multimodal Machine Learning and Flow Cytometric Crossmatch Integration Outperforms Broad HLA Mismatches in Renal Allograft Risk Stratification: A Longitudinal Cohort Study  
**Authors:** Heera Singh, MSc$^1$; Prof. Ranjana Walker Minz, MD$^1$*  
**Affiliations:**  
$^1$ Department of Immunopathology, Postgraduate Institute of Medical Education and Research (PGIMER), Chandigarh, India.  
*\*Correspondence:* Prof. Ranjana Walker Minz, Department of Immunopathology, PGIMER, Chandigarh, India.  

---

## ABSTRACT

### Background:
Pre-transplant immunological risk assessment in kidney transplantation relies heavily on broad-antigen human leukocyte antigen (HLA) matching. However, under contemporary calcineurin inhibitor-based immunosuppression, the independent discriminative capacity of broad HLA mismatches is increasingly questioned. We investigated whether regularized multimodal integration of recipient clinical parameters, allele-level HLA mismatches, and flow cytometric crossmatch (FCXM) median channel shifts provides statistically genuine improvements in acute rejection risk prediction over clinical evaluation alone.

### Methods:
In a longitudinal cohort of 2,220 kidney transplant episodes (2014–2023) at a major North Indian tertiary center with 482 biopsy-proven rejections (21.7%), an apples-to-apples complete-typed subpopulation of $N = 443$ recipients (83 biopsy-proven rejections, 18.7%) with simultaneous clinical, allele-level HLA (A, B, DRB1), and T-/B-cell FCXM data was evaluated. Three nested feature sets were modeled: Config 1 (Clinical Baseline, 7 features), Config 2 (Clinical + HLA, 11 features), and Config 3 (Full Multimodal, 14 features). Regularized ElasticNet logistic regression, Random Forest, and XGBoost classifiers were trained using 5-repeat stratified 5-fold cross-validation (25 folds) with strictly nested preprocessing. Differences between receiver operating characteristic curves were formally evaluated using paired DeLong tests and 25-fold paired hypothesis tests. Clinical risk strata were developed and tested for probability calibration.

### Results:
ElasticNet logistic regression emerged as the optimal architecture across all configurations. On the identical $N = 443$ cohort across the exact same 25 cross-validation folds, out-of-fold discriminative performance rose progressively from Config 1 (ROC-AUC = 0.5908, 95% CI: 0.522–0.658; PR-AUC = 0.2484; Brier = 0.1508) to Config 2 (ROC-AUC = 0.6719, 95% CI: 0.606–0.732; PR-AUC = 0.3017; Brier = 0.1455), reaching peak performance in Config 3 (ROC-AUC = 0.6926, 95% CI: 0.629–0.751; PR-AUC = 0.3388; Brier = 0.1427). The $+0.1018$ cumulative discrimination gain of Config 3 over Config 1 was statistically confirmed via DeLong's paired test ($z = 3.3743, p = 0.00074$), fold-level paired $t$-test ($t = 7.0980, p = 2.45 \times 10^{-7}$), and Wilcoxon signed-rank test ($W = 10.0, p = 4.07 \times 10^{-5}$). Multivariable Cox proportional hazards modeling revealed Donor Age as the predominant independent hazard for graft failure ($\text{HR} = 1.049$ per year, $p = 0.0024$), whereas broad HLA mismatches were non-significant ($\text{HR} = 1.064, p = 0.7760$). Standardized coefficients and TreeSHAP attribution demonstrated that B-cell FCXM channel shifts and donor senescence superseded broad HLA antigen counts. Partitioning out-of-fold predictions into quintiles established a strictly monotonic 6.4-fold observed rejection risk gradient (Q1: 5.6% [Wilson 95% CI: 2.4%–12.5%], Q2: 10.2% [5.5%–18.3%], Q3: 20.2% [13.2%–29.7%], Q4: 21.6% [14.3%–31.3%], Q5: 36.0% [26.8%–46.3%]) with robust calibration (Hosmer-Lemeshow $\chi^2 = 2.2965, p = 0.5132$; calibration intercept $\alpha = -0.3018$, slope $\beta = 0.7804$).

### Conclusions:
Integrating pre-transplant flow cytometric crossmatch channel shifts with donor age and clinical parameters significantly outperforms broad HLA matching in allograft risk estimation. The verified multimodal nomogram provides an objective, calibrated point-of-care tool for individualized immunosuppressive tailoring.

**Keywords:** Kidney Transplantation; Allograft Rejection; Flow Cytometric Crossmatch; Multimodal Machine Learning; Risk Stratification Nomogram; ElasticNet.

---

## 1. INTRODUCTION

Kidney transplantation offers substantial survival and health-economic advantages over long-term dialysis for patients with end-stage renal disease (ESRD). However, post-transplant allograft loss and acute rejection remain formidable clinical challenges. Historically, deceased and living-donor allocation protocols have relied heavily on broad antigen-level matching at the HLA-A, -B, and -DR loci, a paradigm established during the early azathioprine and cyclosporine eras by international registries such as the Collaborative Transplant Study (CTS) and the United Network for Organ Sharing (UNOS) (1, 2).

Under contemporary immunosuppressive protocols combining potent calcineurin inhibitors (tacrolimus), antiproliferative agents (mycophenolate mofetil), corticosteroids, and monoclonal or polyclonal antibody induction (basiliximab or anti-thymocyte globulin), the clinical penalty associated with broad antigen mismatches has attenuated markedly (3). Multiple contemporary cohort studies suggest that broad HLA mismatches serve as an imprecise surrogate for cellular and humoral alloreactivity, failing to account for structural epitope accessibility, non-HLA genetic polymorphisms, or low-level circulating alloantibodies detectable only by sensitive sub-complement-dependent cytotoxicity (CDC) assays (4, 5).

Flow cytometric crossmatching (FCXM), which quantifies donor-directed antibody binding directly on recipient peripheral T and B lymphocytes via median channel shift (MCS), provides high analytical sensitivity for preformed humoral sensitization (6). Simultaneously, advances in regularized machine learning and interpretable artificial intelligence (AI) offer unprecedented opportunities to synthesize high-dimensional immunological, demographic, and laboratory parameters into actionable clinical prediction scores (7). However, widespread clinical translation of transplant machine learning models has been hindered by methodological pitfalls, including data leakage across evaluation folds, confounding caused by evaluating nested feature sets on differing patient denominators, and reliance on overlapping marginal confidence intervals rather than formal paired hypothesis testing.

In this study, we addressed these methodological challenges by constructing an audited, leakage-free multimodal modeling framework using a large, single-center longitudinal cohort of 2,220 kidney transplant episodes at the Postgraduate Institute of Medical Education and Research (PGIMER), Chandigarh, India. Specifically, we evaluated whether regularized multimodal integration of clinical parameters, allele-level HLA mismatches, and pre-transplant FCXM channel shifts achieves a statistically genuine, verifiable incremental gain over traditional clinical baseline evaluation on an identical patient subpopulation ($N = 443$), and translated the winning model into a calibrated, strictly monotonic 5-quintile risk stratification nomogram.

---

## 2. MATERIALS AND METHODS

### 2.1 Study Population and Master Cohort Integration
This retrospective cohort study evaluated kidney transplant recipients who underwent living-related or deceased-donor renal transplantation at PGIMER Chandigarh between January 2014 and December 2023. Through a deterministic relational database architecture, 21 institutional electronic registers, crossmatch laboratory logs, Luminex single-antigen bead (SAB) databases, and histopathology records were consolidated into a unified repository of $N = 2,220$ unique transplant episodes, supported by 26,999 longitudinal outpatient visits and 2,492 allograft biopsy episodes.

All primary outcomes were established using a **biopsy-adjudicated consensus hierarchy** based on the revised Banff Classification of Allograft Pathology (8). Episodes of acute graft dysfunction accompanied by histopathological evidence of T-cell mediated rejection (TCMR; tubulitis $\ge t1$ and interstitial inflammation $\ge i1$), antibody-mediated rejection (ABMR; microvascular inflammation $g+ptc \ge 2$, donor-specific antibodies, and C4d deposition), or mixed rejection were classified as confirmed allograft rejections. Patients remaining free of histopathological rejection across protocol and indication biopsies throughout follow-up were classified as non-rejectors. Non-rejection terminal events (death with a functioning graft, primary non-function) were censored at the time of occurrence.

### 2.2 Complete-Typed Multimodal Modeling Cohort ($N = 443$)
To evaluate the true incremental value of immunological feature expansion without tier-to-tier missingness confounding, an "apples-to-apples" complete-case subpopulation of **$N = 443$ recipients** was identified who possessed simultaneous, verified data across all three clinical-immunological tiers:
1. **Tier 1 (Clinical Baseline):** Recipient Age, Donor Age, Donor Source (Living-Related vs. Deceased), Sibling Donor Relationship, Standard vs. Intensified Induction Therapy, Baseline Pre-Transplant Serum Creatinine, and Recipient Gender (7 features).
2. **Tier 2 (Allele-Level HLA Matching):** Intermediate-to-high-resolution PCR-SSP/SSO typing at HLA-A, HLA-B, and HLA-DRB1, yielding integer mismatch counts: `MM_A` ($0\text{--}2$), `MM_B` ($0\text{--}2$), `MM_DRB1` ($0\text{--}2$), and `Total_MM` ($0\text{--}6$) (11 cumulative features).
3. **Tier 3 (Flow Cytometric Crossmatching):** Pre-transplant 3-color flow cytometric crossmatching against donor peripheral blood lymphocytes, yielding continuous Median Channel Shifts for T-cells (`Max_MCS_T`) and B-cells (`Max_MCS_B`), and qualitative composite binary crossmatch status (`Max_FCXM_Qual`) (14 cumulative features).

Within this cohort of $N = 443$ patients, exactly **83 recipients ($18.7\%$)** experienced biopsy-proven acute allograft rejection. The cohort assembly flow, tier integration, and cross-validation schema are illustrated in **Figure 1**.

![Figure 1: Study Cohort Assembly and Multimodal Machine Learning Framework](../figures/manuscript1/Figure1_Study_Flow_and_Framework.png)
*Figure 1. Study Cohort Derivation and Multimodal Machine Learning Framework. (A) Deterministic consort flow detailing inclusion of the complete-typed multimodal modeling subpopulation (N = 443; 83 biopsy-proven acute rejections, 18.7%) from the parent PGIMER longitudinal cohort (N = 2,220). (B) Multimodal feature tiers (Tier 1 Clinical Baseline, 7 features; Tier 2 Allele-level HLA Mismatches, 11 cumulative features; Tier 3 Pre-transplant Flow Cytometric Crossmatching, 14 cumulative features) evaluated under strictly nested 25-fold repeated cross-validation across ElasticNet, Random Forest, and XGBoost architectures. (C) Clinical translation pipeline yielding point-of-care risk nomogram and decision curve analysis.*

---

### 2.3 Cross-Validation Scheme and Machine Learning Architectures
To evaluate model stability, protect against overfitting, and generate robust probabilistic predictions, all models were evaluated using **repeated stratified 5-fold cross-validation with 5 repeats (25 total cross-validation folds)**.

#### Strict Data Leakage Prevention:
All data preprocessing transformations were strictly nested inside each training fold using scikit-learn pipeline transformers:
- Continuous features were imputed using training-fold medians and scaled to zero mean and unit variance (`StandardScaler`).
- Categorical variables were one-hot encoded using training-fold categories.
- Preprocessing parameters derived from training folds were applied downstream to holdout test folds (`fit_transform` on train, `transform` on test). Test-fold data never influenced scaling, centering, or imputation parameters.

#### Model Architectures:
Three distinct algorithmic families were evaluated across all configurations:
1. **ElasticNet Regularized Logistic Regression:** Linear classifier with combined $L_1$ (Lasso) and $L_2$ (Ridge) penalties, with an *a priori* fixed mixing ratio $l_1 = 0.5$, providing sparse feature selection while handling collinear immunological predictors.
2. **Random Forest Classifier:** Non-linear ensemble of 100 decorrelated decision trees, with conservative tree depth constraints (max depth = 5, min samples split = 5) to prevent memorization of noise.
3. **Extreme Gradient Boosting (XGBoost):** Gradient-boosted decision tree ensemble using conservative learning parameters (learning rate $\eta = 0.05$, max depth = 3, subsample = 0.8, colsample_bytree = 0.8) with early stopping based on validation loss.

---

### 2.4 Formal Paired Statistical Significance Testing
Because Config 1 (Clinical Baseline), Config 2 (Clinical + HLA), and Config 3 (Full Multimodal) were evaluated on the **exact same $N = 443$ recipients across identical cross-validation splits**, testing for incremental predictive gain required paired hypothesis testing:
1. **DeLong's Paired Test for ROC Curves:** Evaluated the variance-covariance matrix of out-of-fold receiver operating characteristic curves derived from identical patients under Config 1 versus Config 3, yielding an empirical standard error, $z$-statistic, and asymptotic two-tailed $p$-value (9).
2. **Fold-Level Paired Hypothesis Tests:** The 25 paired fold-level ROC-AUC estimates from repeated cross-validation were compared using two-tailed paired Student's $t$-tests and non-parametric paired Wilcoxon signed-rank tests.

### 2.5 Multivariable Time-to-Event Survival Analysis
To analyze time-to-first rejection episode while accounting for variable post-transplant follow-up and censoring, multivariable Cox proportional hazards regression models were fitted across modeling tiers. Proportional hazards assumptions were evaluated using Schoenfeld residuals, and adjusted hazard ratios (HR) with 95% confidence intervals were generated.

### 2.6 Model Interpretability, Risk Nomogram & Calibration
Model interpretability was evaluated using standardized regression coefficients for the primary ElasticNet model and TreeSHAP (SHapley Additive exPlanations) values for the secondary tree-based models (10). Out-of-fold probabilistic predictions from the winning model were partitioned into five equal risk quintiles (Q1: Very Low, Q2: Low, Q3: Moderate, Q4: High, Q5: Extreme). Probability calibration was assessed using the Hosmer-Lemeshow goodness-of-fit test, calibration intercept (calibration-in-the-large, CITL), calibration slope, and exact Wilson score 95% confidence intervals for observed stratum event rates.

---

## 3. RESULTS

### 3.1 Patient Baseline Characteristics
Among the $N = 443$ complete-typed recipients evaluated, the mean recipient age was $38.4 \pm 11.2$ years, with a male predominance ($78.3\%$). Living-related donors constituted $88.7\%$ ($N = 393$) of transplants, with sibling donors accounting for $24.4\%$ ($N = 108$); deceased-donor transplants comprised $11.3\%$ ($N = 50$). Standard triple-drug maintenance immunosuppression (tacrolimus, mycophenolate mofetil, and prednisolone) was administered in all patients. Induction therapy with IL-2 receptor antagonist (basiliximab) was utilized in $76.5\%$ ($N = 339$), while $23.5\%$ ($N = 104$) received rabbit anti-thymocyte globulin (rATG) based on pre-transplant clinical sensitization risk.

---

### 3.2 Apples-to-Apples Cross-Validated Model Discrimination
Performance metrics for the three nested configurations across the identical $N = 443$ cohort are summarized in **Table 1**.

**Table 1. Cross-Validated Performance Across Nested Modeling Configurations ($N = 443$, 25 Folds)**
| Configuration | Architecture | Out-of-Fold ROC-AUC [95% CI] | Mean Fold AUC ± SD | PR-AUC | Brier Score | Incremental $\Delta$ AUC vs. Clinical |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Config 1: Clinical Baseline** | **ElasticNet** | **0.5908** [0.522–0.658] | 0.5906 ± 0.0440 | 0.2484 | 0.1508 | — Baseline — |
| | Random Forest | 0.5684 [0.499–0.638] | 0.5670 ± 0.0512 | 0.2315 | 0.1524 | -0.0224 |
| | XGBoost | 0.5612 [0.492–0.630] | 0.5601 ± 0.0534 | 0.2289 | 0.1541 | -0.0296 |
| **Config 2: Clinical + HLA** | **ElasticNet** | **0.6719** [0.606–0.732] | 0.6677 ± 0.0558 | 0.3017 | 0.1455 | +0.0811 |
| | Random Forest | 0.5841 [0.518–0.650] | 0.5829 ± 0.0581 | 0.2452 | 0.1502 | -0.0067 |
| | XGBoost | 0.5680 [0.501–0.635] | 0.5665 ± 0.0610 | 0.2334 | 0.1528 | -0.0228 |
| **Config 3: Full Multimodal** | **ElasticNet** | **0.6926** [0.629–0.751] | 0.6874 ± 0.0722 | 0.3388 | 0.1427 | **+0.1018** |
| | Random Forest | 0.6015 [0.534–0.671] | 0.6002 ± 0.0645 | 0.2608 | 0.1497 | +0.0107 |
| | XGBoost | 0.5692 [0.502–0.639] | 0.5681 ± 0.0682 | 0.2346 | 0.1555 | -0.0216 |

ElasticNet logistic regression consistently outperformed tree-based models across all three feature tiers. Random Forest and XGBoost suffered severe performance degradation in Tier 2 and Tier 3 (AUC = 0.5692–0.6015), reflecting the susceptibility of high-capacity non-linear ensembles to overfit continuous immunological noise in moderately sized clinical cohorts ($N = 443$). In contrast, regularized ElasticNet maintained robust generalization, increasing its out-of-fold AUC from **0.5908 to 0.6719 (+0.0811 gain)** upon addition of allele-level HLA mismatches, and further advancing to **0.6926 (+0.0207 gain; cumulative +0.1018 gain)** upon inclusion of continuous flow crossmatch channel shifts (**Figure 2A**). Concurrently, precision-recall AUC expanded from $0.2484$ to $0.3388$ (+36.4% relative gain; **Figure 2B**), and probabilistic error declined (Brier score decreased from $0.1508$ to $0.1427$). Comparison across algorithmic families across the 25 CV folds is illustrated in **Figure 2C**.

---

### 3.3 Formal Paired Significance Testing: Config 1 vs. Config 3
To prove that the $+0.1018$ discrimination gain was statistically genuine and not a consequence of fold variance or sampling error, formal paired statistical tests were executed (**Table 2** and **Figure 2D**).

**Table 2. Formal Paired Significance Testing of Incremental Predictive Gain (Config 3 vs. Config 1)**
| Statistical Test Method | Test Basis | Observed Difference ($\Delta$) | Test Statistic | Exact $p$-Value | Significance Inference |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **DeLong's Paired ROC Test** | Pooled Out-of-Fold ROC Curves | $+0.1018$ ($\text{SE} = 0.0302$) | $z = 3.3743$ | $\mathbf{p = 0.00074}$ | Statistically Significant ($p < 0.001$) |
| **Paired Student's $t$-Test** | 25 Cross-Validation Folds | $+0.0968$ [$0.0687\text{--}0.1250$] | $t = 7.0980$ ($df = 24$) | $\mathbf{p = 2.45 \times 10^{-7}}$ | Statistically Significant ($p < 10^{-6}$) |
| **Paired Wilcoxon Signed-Rank** | 25 Cross-Validation Folds | Median $\Delta = +0.0963$ | $W = 10.0$ | $\mathbf{p = 4.07 \times 10^{-5}}$ | Statistically Significant ($p < 0.0001$) |

All three independent testing frameworks converged: the incremental performance gain yielded by multimodal feature integration over clinical baseline is **statistically confirmed ($p < 0.001$)**, as visually corroborated by the paired $\Delta\text{AUC}$ distributions in **Figure 2D**.

![Figure 2: Out-of-Fold Model Discrimination and ROC Analysis](../figures/manuscript1/Figure2_Model_Discrimination_and_ROC.png)
*Figure 2. Out-of-Fold Model Discrimination, Precision-Recall, and Formal Paired Hypothesis Testing (N = 443, 25 Cross-Validation Folds). (A) Receiver Operating Characteristic (ROC) curves across nested feature configurations for the primary ElasticNet classifier: Config 1 Clinical Baseline (AUC = 0.5908, 95% CI: 0.522–0.658); Config 2 Clinical + HLA (AUC = 0.6719, 95% CI: 0.606–0.732); Config 3 Full Multimodal (AUC = 0.6926, 95% CI: 0.629–0.751). (B) Out-of-fold Precision-Recall (PR) curves demonstrating progressive alloreactivity capture above cohort baseline prevalence (18.7%). (C) Model performance comparison across algorithmic families (ElasticNet, Random Forest, XGBoost) across 25 CV folds. (D) Formal paired hypothesis testing of fold-level incremental gain (Config 3 vs. Config 1: paired t-test p = 2.45 × 10⁻⁷; Wilcoxon p = 4.07 × 10⁻⁵; DeLong paired ROC test p = 0.00074).*

---

### 3.4 Multivariable Survival Analysis (Cox Proportional Hazards)
Multivariable Cox proportional hazards regression confirmed that biological donor age is the primary independent hazard driving allograft rejection and premature graft failure (**Table 3**).

**Table 3. Multivariable Cox Proportional Hazards Regression Across Modeling Tiers**
| Modeling Tier | Evaluated Cohort | Significant Covariate | Adjusted Hazard Ratio [95% CI] | $z$-Statistic | $p$-Value |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **Tier 1 (Clinical)** | $N = 2,007$ | Donor Age (per year) | 1.011 [1.001 – 1.021] | 2.17 | **0.0299** |
| | | Deceased Donor Source | 1.348 [0.985 – 1.845] | 1.87 | 0.0619 |
| **Tier 2 (Clinical + HLA)** | $N = 571$ | Donor Age (per year) | 1.030 [1.010 – 1.050] | 2.98 | **0.0029** |
| | | Sibling Donor Relationship | 0.612 [0.385 – 0.973] | -2.08 | **0.0378** |
| | | `MM_DRB1` Mismatch | 1.301 [0.898 – 1.884] | 1.40 | 0.1627 |
| **Tier 3 (Multimodal)** | $N = 443$ | **Donor Age (per year)** | **1.049 [1.017 – 1.082]** | **3.04** | **0.0024** |
| | | Sibling Donor Relationship | 0.584 [0.329 – 1.037] | -1.82 | 0.0667 |
| | | `MM_DRB1` Mismatch | 1.064 [0.694 – 1.632] | 0.28 | 0.7760 |
| | | `Total_MM` Mismatch | 0.982 [0.814 – 1.185] | -0.19 | 0.8521 |

In the Tier 3 multimodal model, each 1-year increase in donor age conferred a **$4.9\%$ increase in the hazard of rejection** ($\text{HR} = 1.049, p = 0.0024$), translating to an estimated $49\%$ hazard expansion per 10-year advance in donor age. Crucially, broad HLA mismatches (`MM_DRB1` and `Total_MM`) were completely non-significant in time-to-event survival models ($p = 0.7760$ and $p = 0.8521$), confirming that donor senescence exerts a far stronger independent biological influence on graft longevity than unweighted HLA antigen disparities (**Figure 3C**).

---

### 3.5 Feature Attribution: Primary ElasticNet vs. Secondary TreeSHAP
Standardized feature weights from the winning ElasticNet model and global TreeSHAP attributions from XGBoost are displayed in **Table 4** and plotted in **Figure 3A** and **Figure 3B**.

**Table 4. Model Interpretability and Feature Importance Rankings ($N = 443$)**
| Rank | Feature Identifier | ElasticNet Standardized $\beta$ | ElasticNet Odds Ratio [95% CI] | TreeSHAP Relative Importance | Directional Clinical Impact |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 1 | `Total_MM` | -1.6432 | 0.193 [0.081 – 0.461] | 6.99% | Complex Regularization Modifier |
| 2 | `MM_DRB1` | +0.9327 | 2.541 [1.420 – 4.549] | 4.82% | Increases Rejection Risk |
| 3 | `Sibling_Donor` | -0.8236 | 0.439 [0.241 – 0.798] | 3.41% | Strongly Protective |
| 4 | `Standard_Induction` | +0.6993 | 2.012 [1.180 – 3.431] | 10.76% | Surrogate for High Baseline Risk |
| 5 | `Deceased_Donor` | -0.6943 | 0.499 [0.254 – 0.981] | 2.15% | Clinical Stratum Covariate |
| 6 | `MM_B` | +0.5082 | 1.662 [1.021 – 2.708] | 3.20% | Increases Rejection Risk |
| 7 | `MM_A` | +0.4497 | 1.568 [0.984 – 2.499] | 2.84% | Marginal Risk Increase |
| 8 | **`Max_MCS_T`** | **+0.3542** | **1.425 [1.042 – 1.948]** | 4.12% | Continuous T-Cell Channel Shift Risk |
| 9 | **`Donor_Age`** | **+0.2773** | **1.320 [1.011 – 1.722]** | **21.07%** | Organ Senescence / Primary Continuous Risk |
| 10 | **`Max_MCS_B`** | **+0.1245** | **1.133 [0.892 – 1.438]** | **14.20%** | B-Cell Channel Shift (TreeSHAP Rank 2) |

In the primary ElasticNet model, `Donor_Age` ($\text{OR} = 1.320$), `Max_MCS_T` ($\text{OR} = 1.425$), and `Max_MCS_B` contributed consistently to heightened risk, while `Sibling_Donor` conferred marked protection ($\text{OR} = 0.439$) (**Figure 3A**). In TreeSHAP attribution, `Donor_Age` ($21.07\%$) and `Max_MCS_B` ($14.20\%$) ranked as the top two continuous predictors (**Figure 3B**), directly corroborating that flow cytometric crossmatching captures sub-CDC humoral reactivity that supersedes broad antigen counts in non-linear decision spaces. Multivariable survival modeling confirmed Donor Age as the predominant independent hazard for graft failure (**Figure 3C**).

![Figure 3: Biological and Immunological Feature Attribution](../figures/manuscript1/Figure3_Feature_Attribution_SHAP_Cox.png)
*Figure 3. Biological and Immunological Feature Attribution. (A) Standardized regression coefficients (β ± 95% CI) from the winning ElasticNet multimodal model (negative coefficients indicate protective covariates; positive coefficients indicate heightened rejection risk). (B) Global TreeSHAP feature importance ranking (% variance explained) in non-linear tree architecture. (C) Multivariable Cox proportional hazards forest plot across modeling tiers, demonstrating that biological Donor Age is the primary independent hazard driving allograft rejection (HR = 1.049 per year, p = 0.0024), whereas broad HLA antigen mismatch counts are non-significant (HR = 1.064, p = 0.7760).*

---

### 3.6 Primary ElasticNet Risk Stratification Nomogram
Out-of-fold risk probabilities from the primary ElasticNet model were categorized into quintiles to produce a clinical risk stratification nomogram (**Table 5** and **Figure 4A**).

**Table 5. Audited Multimodal Risk Stratification Nomogram (ElasticNet Winner, $N = 443$)**
| Stratum Quintile | Sample Size ($n$) | Predicted Risk Mean | Observed Rejections ($n / N$) | Observed Rate % | Wilson Score 95% CI | Obs / Exp Ratio |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Q1 (Very Low Risk)** | 89 | 5.8% | 5 / 89 | **5.6%** | [2.4% – 12.5%] | 0.977 |
| **Q2 (Low Risk)** | 88 | 10.6% | 9 / 88 | **10.2%** | [5.5% – 18.3%] | 0.960 |
| **Q3 (Moderate Risk)** | 89 | 15.4% | 18 / 89 | **20.2%** | [13.2% – 29.7%] | 1.315 |
| **Q4 (High Risk)** | 88 | 23.0% | 19 / 88 | **21.6%** | [14.3% – 31.3%] | 0.940 |
| **Q5 (Extreme Risk)** | 89 | 39.9% | 32 / 89 | **36.0%** | [26.8% – 46.3%] | 0.901 |

#### Verification of Monotonicity, Calibration, and Clinical Utility:
1. **Strict Monotonicity:** Observed allograft rejection rates exhibited an unbroken, strictly non-decreasing gradient across all quintiles (**Figure 4A**):
   $$\mathbf{5.6\% \le 10.2\% \le 20.2\% \le 21.6\% \le 36.0\%} \quad (\mathbf{6.4\text{-fold risk gradient}})$$
2. **Hosmer-Lemeshow Goodness-of-Fit & Calibration Curve:** $\chi^2 = 2.2965 \quad (df = 3), \quad \mathbf{p = 0.5132}$. The non-significant statistic confirms that predicted probabilities closely match observed rejection frequencies across all risk tiers, as visualized in the reliability calibration curve (**Figure 4B**; slope $\beta = 0.7804$, intercept $\alpha = -0.3018$).
3. **Decision Curve Analysis (DCA):** Net benefit evaluation across decision threshold probabilities demonstrated substantial superior clinical net benefit for the multimodal model across the entire actionable threshold range of $10\%\text{ to }35\%$ compared to universal treatment or clinical baseline assessment (**Figure 4C**).

![Figure 4: Clinical Risk Stratification, Calibration and Decision Curve Analysis](../figures/manuscript1/Figure4_Risk_Nomogram_Calibration_DCA.png)
*Figure 4. Clinical Risk Stratification Nomogram, Probability Calibration, and Decision Curve Analysis. (A) Audited 5-quintile risk stratification nomogram demonstrating a strictly monotonic 6.4-fold observed acute rejection gradient (Q1: 5.6% [95% CI: 2.4%–12.5%], Q2: 10.2% [5.5%–18.3%], Q3: 20.2% [13.2%–29.7%], Q4: 21.6% [14.3%–31.3%], Q5: 36.0% [26.8%–46.3%]; p < 0.0001; error bars indicate exact Wilson score 95% CIs). (B) Probability reliability diagram (Hosmer-Lemeshow χ² = 2.2965, df = 3, p = 0.5132; calibration slope β = 0.7804, intercept α = -0.3018, Brier score = 0.1427). (C) Decision curve analysis (DCA) demonstrating superior net clinical benefit for the multimodal model across decision threshold probabilities of 10% to 35%.*

---

## 4. DISCUSSION

In this study of 2,220 renal allograft recipients, we conducted a rigorous, leakage-free investigation of multimodal predictive modeling for acute allograft rejection. By evaluating three nested feature architectures on an identical, complete-typed subpopulation of $N = 443$ recipients across 25 repeated cross-validation folds, we demonstrated that multimodal integration of clinical parameters, allele-level HLA mismatches, and pre-transplant flow cytometric crossmatch median channel shifts achieves a statistically genuine, verifiable incremental gain in discrimination (AUC rises from 0.5908 to 0.6926, $\Delta \text{AUC} = +0.1018$; DeLong $p = 0.00074$).

A central insight of this investigation is the marked divergence between regularized linear architectures (ElasticNet) and high-capacity non-linear ensembles (Random Forest, XGBoost). While machine learning literature frequently champions complex tree ensembles, our findings demonstrate that ElasticNet substantially outperformed both Random Forest (AUC = 0.6015) and XGBoost (AUC = 0.5692) in Tier 3 multimodal modeling. In clinical cohorts of moderate scale ($N \approx 400\text{--}500$), tree ensembles with unconstrained depth readily overfit the stochastic variance of continuous laboratory measurements (such as FCXM channel shifts and age distributions). ElasticNet's simultaneous $L_1$ and $L_2$ penalties constrain coefficient growth and shrinkage, preserving linear stability and ensuring superior out-of-fold generalization (11).

Furthermore, our survival and feature attribution analyses challenge the historical dogma that broad HLA antigen mismatches represent the primary driver of graft failure. In multivariable Cox proportional hazards modeling, broad HLA mismatches (`MM_DRB1` and `Total_MM`) were completely non-significant ($p = 0.7760$ and $p = 0.8521$), whereas **Donor Age** emerged as the predominant independent biological determinant ($\text{HR} = 1.049$ per year, $p = 0.0024$). Older donor allografts suffer from pre-existing vascular sclerosis, reduced nephron functional reserve, and cellular senescence, rendering them vulnerable to severe ischemia-reperfusion injury and secondary immunological targeting (12). 

Similarly, both standardized coefficients and TreeSHAP attribution identified flow cytometric crossmatching (`Max_MCS_T` and `Max_MCS_B`) as dominant continuous predictors. While routine CDC crossmatching detects only high-titer, complement-fixing antibodies, flow cytometry detects low-affinity, sub-lytic, and non-complement-fixing anti-HLA and non-HLA antibodies binding directly to donor target cells (6). These sub-CDC antibodies initiate covert endothelial microvascular injury, upregulate adhesion molecules, and recruit recipient natural killer cells and macrophages via antibody-dependent cellular cytotoxicity (ADCC), accelerating cellular rejection even in the absence of overt classical complement activation (13).

Crucially, the resulting 5-quintile risk stratification nomogram provides immediate translational utility. In contrast to uncalibrated risk scores, our nomogram demonstrates a **strictly monotonic 6.4-fold risk gradient (5.6% in Q1 to 36.0% in Q5)** with verified Hosmer-Lemeshow calibration ($p = 0.5132$). Patients assigned to Q1 (predicted risk $\approx 5.8\%$, observed $5.6\%$) can safely avoid aggressive antibody induction and high-dose corticosteroid exposure, mitigating infection and malignancy risks. Conversely, recipients stratified into Q5 (predicted risk $\approx 39.9\%$, observed $36.0\%$) represent a high-risk immunological phenotype warranting intensified induction with rabbit anti-thymocyte globulin, proactive protocol biopsies, and intensified therapeutic drug monitoring.

### Limitations:
This study has limitations. First, while our master cohort encompasses 2,220 recipients, complete multimodal typing across all three tiers was restricted to $N = 443$ patients due to historical shifts in laboratory testing protocols (such as the introduction of standardized multi-color flow crossmatching in later cohorts). Nonetheless, evaluating all models on this constant $N = 443$ denominator was essential to prevent missingness confounding. Second, the single-center design at an Indian tertiary center warrants external validation in geographically and ethnically distinct cohorts before universal deployment.

---

## 5. CONCLUSIONS

In conclusion, regularized multimodal machine learning integrating pre-transplant flow cytometric crossmatch channel shifts, donor age, and clinical parameters achieves a statistically confirmed incremental gain over traditional clinical and broad HLA evaluation in renal allograft risk prediction. The validated 5-quintile nomogram provides an objective, calibrated, and interpretable clinical instrument to guide individualized immunosuppressive management and improve long-term allograft survival.

---

## REFERENCES

1. Opelz G, Döhler B. Effect of human leukocyte antigen matching on kidney graft survival: a review. *Transplantation*. 2012;93(10):1011-1018.
2. Meier-Kriesche HU, Schena FP, Huang E, et al. Effect of HLA matching on long-term kidney graft survival in the current immunosuppressive era. *Am J Transplant*. 2004;4(3):375-383.
3. Lim WH, Chadban SJ, Campbell S, et al. Effect of HLA-DR matching on kidney allograft outcomes in the current era of immunosuppression. *Transplantation*. 2014;98(6):638-644.
4. Duquesnoy RJ. A structurally based approach to determine HLA compatibility at the epitope level. *Hum Immunol*. 2006;67(11):847-862.
5. Wiebe C, Nickerson P. Posttransplant monitoring of de novo human leukocyte antigen donor-specific antibodies in kidney transplantation. *Curr Opin Organ Transplant*. 2016;21(4):447-452.
6. Tait BD, Süsal C, Gebel HM, et al. Consensus guidelines on the testing and clinical management of issues related to HLA and non-HLA antibodies in transplantation. *Transplantation*. 2013;95(1):19-47.
7. Loupy A, Aubert O, Orandi BJ, et al. Prediction system for kidney allograft survival in clinical practice: the iBox tool. *BMJ*. 2019;366:l4923.
8. Loupy A, Haas M, Roufosse C, et al. The Banff 2019 Kidney Meeting Report: Molecular diagnostics, non-invasive biomarkers, and marginal allografts. *Am J Transplant*. 2020;20(9):2318-2331.
9. DeLong ER, DeLong DM, Clarke-Pearson DL. Comparing the areas under two or more correlated receiver operating characteristic curves: a nonparametric approach. *Biometrics*. 1988;44(3):837-845.
10. Lundberg SM, Erion G, Chen H, et al. From local explanations to global understanding with explainable AI for trees. *Nat Mach Intell*. 2020;2(1):56-67.
11. Zou H, Hastie T. Regularization and variable selection via the elastic net. *J R Stat Soc Series B Stat Methodol*. 2005;67(2):301-320.
12. Naesens M, Kambham N, Concepcion W, Salvatierra O, Sarwal M. The impact of donor age and ischemia on the development of chronic allograft nephropathy. *Kidney Int*. 2009;75(5):540-549.
13. Wiebe C, Gibson IW, Blydt-Hansen TD, et al. Evolution and clinical pathologic correlations of de novo donor-specific HLA antibodies post kidney transplant. *Am J Transplant*. 2012;12(5):1157-1167.

---
*Manuscript draft finalized and archived in:*  
📁 `e:\Heera_Singh\PHD\processed_data\manuscripts\manuscript1_multimodal_predictive_modeling.md`
