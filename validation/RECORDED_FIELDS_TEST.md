# Can the recorded fields be used as predictors?

**Date:** 2026-09-10
**Script:** `../test_recorded_fields.py` (project root)
**Endpoint:** `Final_Rejection_Status`, Rejector vs Non-rejector. Death, graft loss and suspected rejection excluded, as elsewhere in the project.

The risk calculator records recipient/donor age, sex, blood group, ABO compatibility and DSA MFI but does not score them. This tests whether they *deserve* to be scored.

## Demographics — registry, N = 2,038 (482 rejectors, 23.7%)

| Field | Rejector vs non | AUC | p | Verdict |
|---|---|---|---|---|
| Recipient age | 34 vs 35 y | 0.492 | 0.618 | **No signal** |
| Donor age *(already in the model)* | 45 vs 43 y | 0.539 | **0.010** | Weak signal, already used |
| Recipient female | 21.3% vs 24.2% | — | 0.220 | No signal |
| Donor female | 23.5% vs 23.9% | — | 0.870 | No signal |
| Donor/recipient sex mismatch | 24.3% vs 22.4% | — | 0.378 | No signal |

## Blood group and DSA — linked by CR number, N = 903 (162 rejectors, 17.9%)

| Field | Rejector vs non | AUC | p | Verdict |
|---|---|---|---|---|
| Peak DSA MFI | 588 vs 599 | 0.514 | 0.618 | **No signal** |
| DSA specificities recorded | 7.5 vs 8.0 | 0.454 | 0.057 | No signal (and inverse direction) |
| DSA at or above 1000 MFI | 0 vs 0 | 0.531 | 0.115 | No signal |
| Peak MFI ≥ 1000 (binary) | 21.4% vs 16.5% | — | 0.143 | No signal |
| Peak MFI ≥ 3000 (binary) | 19.6% vs 17.5% | — | 0.692 | No signal |
| Recipient blood group O / A / B | ~8% each | — | 0.59–1.00 | No signal |
| ABO-incompatible pairing | 50.0% vs 7.5%, OR 12.27 | — | 0.033 | **Not a finding — see below** |

## The ABO result is an artefact, not a signal

It reaches p = 0.033 off a 2×2 table of **4 incompatible pairs, 2 of which rejected**. An odds ratio of 12 resting on two events is noise with a nominally significant p-value. The script now labels any table with fewer than 20 exposed or fewer than 5 events as FRAGILE rather than SIGNAL, so this cannot be misread later.

Note also a selection effect: blood group is only recorded from 2023, and that subgroup has a 7.9% rejection rate against 17.9% in the full linked set — recent transplants with shorter follow-up, so fewer observed rejections.

## Conclusion

**None of the recorded fields earns a place in the model.** Recipient age, sex, sex mismatch, blood group, ABO compatibility, peak DSA MFI and DSA burden all sit at or near chance against the biopsy-adjudicated endpoint in this cohort. The only demographic with signal is donor age, which the nomogram already uses.

The DSA result independently reproduces Objective 1c's conclusion on a different and larger sample: continuous MFI does not discriminate rejection here (Objective 1c: AUC 0.363, N = 60; this test: AUC 0.514, N = 784).

So keeping these fields as recorded context rather than model inputs was the right call, and remains so. They stay valuable for describing a case, auditing a cohort and exporting to other tools — not for changing the predicted risk.

## Two bugs found while doing this

1. **The first linkage was spurious.** Joining on the VXM `lab_no` produced 1,412 "matches" and perfectly tied groups (AUC exactly 0.500, p = 1.0000 everywhere). `lab_no` is a lab accession (`L-01`), not a CR number — the genuine overlap was zero. The extractor now carries the patient CR number.
2. **The CR key needed normalising.** The registry stores CR as a float string (`201502479034.0`); stripping non-digits absorbed the trailing zero and matched nothing. Removing the `.0` first gives 951 genuine overlapping CR numbers.
