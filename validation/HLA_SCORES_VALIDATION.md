# HED, AAMS and EMS3D — validation record

Date: 2026-09-17
Component: tab "3 · HLA divergence & immunogenicity" (`hla_scores.js`, `hla_scores_ui.js`, `hla_scores_data.js`, `hla_ems3d_*.js`)
Replaces: the iframe page `external_tools.js` (removed), which embedded hladiv.net and the Kosmoliaptsis "HLA Algorithms" Shiny app.
Tests: `node tools/test_engine.js` (section "HED, AAMS and EMS3D").

Every statement below is either a check that the test suite or a build script runs, or a published source quoted by name. Where the published method leaves a choice open, the choice made here is stated as such.

## 1. Sources of the methods

| Score | Where the definition comes from | Status |
|---|---|---|
| HED | Pierini & Lenz, Mol Biol Evol 2018 (SourceForge project *GranthamDist*: `CalculatePairwiseDistances.pl`, `CalculateIndividualDivergence.pl`, `AAdistMatrix_Grantham.cnv`, CWD alignments); Chowell et al., Nat Med 2019 (hladiv.net) | Code read line by line; reproduced exactly (section 2) |
| AAMS | Kosmoliaptsis et al., Transplantation 2009 (class I), 2011 (class II); Am J Transplant 2016; Tambur et al. 2018; Kosmoliaptsis 2018 review; the Shiny app's own help text ("AAMS Extracellular") | No code is public; comparison sets taken from the 2016 paper; residue range not published (section 3) |
| EMS3D | Mallon et al., J Immunol 2018 (methods and supplement); Shiny app help text | No code or distance tables are public; pipeline rebuilt from the methods (section 4) |

## 2. HED

**Definition implemented.** For two alleles, the Grantham (1974) integer distance (the matrix in `AAdistMatrix_Grantham.cnv`, stored in `hla_scores_data.js`) is summed over mature residues 2–182 (class I exons 2 and 3; residue 1 is omitted because codon 1 spans the exon 1/2 boundary) and divided by the number of positions compared. A position is dropped when either residue is not one of the 20 amino-acid letters. `CalculatePairwiseDistances.pl` uses one variable both as the loop bound and as the divisor and decrements it for every dropped position, so the last *k* columns are never read when *k* positions are dropped; `hedPair()` reproduces that loop. The class I mean is (HED_A + HED_B + HED_C)/3, as HLAdiv's "Mean_HED". For DRB1 and DQB1 the Lenz class II alignment region, β residues 6–94, is used (HLAdiv.net itself is class I only).

**Checks (all pass).**

| Check | Result |
|---|---|
| The 9 worked pair values printed on hladiv.net (A3303/A3201 6.05525, B4501/B4402 4.93923, C0704/C1601 4.96685, A0201/A3101 7.51934, B4403/B4501 5.88950, C1601/C0501 4.12155, A6801/A3101 4.49171, B1301/B3503 6.74033, C0403/C0401 2.96133) | 9/9 equal to 5 decimals |
| hladiv.net example patient Pt01, Mean_HED 5.32044 | equal |
| Grantham sums re-derived from the Lenz CWD alignment (e.g. A\*01:01/A\*02:01 = 1901/181, B\*07:02/B\*44:02 = 2588/181) | 8/8 equal |
| Lenz example output, DQB1\*02:03/02:02 = 1.41573033707865 and DQB1\*03:01/05:01 = 17.4494382022472 | equal |
| Synthetic 10-column case (gap at column 2, Trp/Cys at column 10) | 0, as the Perl script returns (a straightforward loop would give 23.89) |
| Residues 2–182 of every class I allele in the IMGT 3.37.0 set that hladiv.net lists (11,308 names), against this app's IMGT 3.65.0 build | 11,281 identical; 2 differ (B\*45:05, C\*03:46 — the two alleles that carried a non-standard residue in 3.37; C\*03:46 was also corrected in a later release, so its HED against A\*01:01 is 14.64444 here versus 14.80556 from the 3.37 sequence); 25 names are no longer two-field alleles without an expression suffix in 3.65 |
| Lenz class II CWD alignment (234 DRB1/DQB1 alleles), residues 6–94 | 234/234 identical |

The HLAdiv.net allele list was matched against IMGT releases 3.31–3.41; it equals the 3.37.0 set of class I two-field alleles with complete exons 2–3 and no expression suffix (11,306 of 11,308 names, plus the two alleles above). The site does not state its IMGT version, so this is an inference from that match. Whether hladiv.net's own code keeps the Perl loop-bound behaviour could not be tested (its Shiny session could not be driven from a script); it only matters for pairs involving an allele with an undetermined residue in exons 2–3.

## 3. AAMS

**Definition implemented.** For each donor molecule the recipient does not carry (two-field level), a position counts when the donor residue is absent at that position from every recipient molecule in the comparison set (Kosmoliaptsis et al. 2016: "interlocus (HLA-A, -B, -C, or HLA-DRB1/3/4/5) or intralocus (HLA-DQA1/DQB1) amino acid sequence subtraction"). Class I pools the recipient's HLA-A, -B and -C; DR pools DRB1/3/4/5; DQ and DP are compared chain by chain within the locus and the heterodimer score is α + β. Surface accessibility is not applied (Tambur et al. 2018 and the 2018 review state that restricting to surface residues did not help). Per-locus summaries give the highest value (Kim et al., Front Immunol 2023) and the sum (Kosmoliaptsis et al. 2016).

**Choices made here, because the group has not published them.**
- Residue range: the UniProt "Topological domain: Extracellular" annotation, mapped onto IMGT numbering by locating the 12 UniProt residues that end the domain (P04439, P01889, P10321, P01911, P79483, P13762, Q30154, P01909, P01920, P20036, P04440). Class I uses 1–284 for all three loci (UniProt ends HLA-B one residue later, at a transmembrane boundary, not an indel; positions 1–284 align across A, B and C). DRB loci 1–198, DQA1 1–194, DQB1 1–198, DPA1 1–191, DPB1 1–196 (IMGT numbering).
- DQ phase: the DQA1\*01 ↔ DQB1\*05/06 pairing rule when it decides the phase; otherwise the typed order, with a switch in the tab.
- Alleles known only over exons 2–3 (IMGT 3.65: A 1,907 of 5,310; B 2,423 of 6,607; C 1,615 of 5,103; DRB1 2,207 of 2,600; DQB1 1,094 of 1,828; see `tools/build_hla_scores_reference.py` output): remaining residues are taken from the closest completely sequenced allele of the locus (fewest differences over the known residues, same first field preferred), written in lower case, and every AAMS position that relies on one is marked in the tab.

**Checks (all pass).** Textbook residues (B-80 Bw4/Bw6, C-80 KIR C1/C2, DQB1 Asp57, DRB1 86 G/V); B\*44:02 vs B\*44:03 differ at exactly one position, 156; an allele scored against itself is 0; adding a recipient allele can only lower AAMS; class I interlocus AAMS is lower than the intralocus value for the same donor allele in the test pair; identical typings produce no mismatched molecule; an unknown allele is reported, not scored silently. Two-field groups: no conflicting residues between members of any group (all loci).

Coverage of the eplet engine's allele list (HLAMatchmaker, 2,589 alleles): 2,578 have residues. The 11 without are A\*23:19, B\*07:44 and C\*03:23 (null alleles, N, in IMGT 3.65), A\*30:14 (L), A\*32:11, B\*35:65, B\*39:38, C\*03:22, DQA1\*01:07 and DRB1\*15:13 (Q; alleles with an expression suffix are left out, as on HLAdiv.net) and C\*03:12 (no longer listed under that name). The tab reports such alleles instead of scoring them.

No published per-molecule AAMS values were found to test against (the 2009 and 2011 papers are paywalled; the Shiny app's example file is served only inside a session).

## 4. EMS3D

**Published pipeline (Mallon et al. 2018) and what the build does.**

| Step | Published | This build (`tools/ems3d/build_ems3d.py`, Docker image `tools/ems3d/Dockerfile`) |
|---|---|---|
| Structure | MODELLER 9.17, 12 class I / 22 class II templates, alanine nonamer / 12-mer peptide | One template from their list per family (class I 1K5N, B\*27:09, 1.09 Å; DR 3PDO, DRB1\*01:01, 1.95 Å; DQ 1JK8, DQA1\*03:01/DQB1\*03:02, 2.4 Å; DP 4P5M, DPA1\*01:03/DPB1\*02:01, 1.7 Å); each allele threaded by residue substitution (PDBFixer), then energy-minimised with OpenMM (amber14, 1 nm cutoff) with the backbone and every unchanged heavy atom restrained; alanine peptide of the published length. MODELLER needs a licence and was not used. Template chains match their IMGT alleles with 100% identity over the mapped residues. |
| Charges | PDB2PQR, PARSE, PROPKA, pH 7.4 | same (pdb2pqr 3.7.1) |
| Potential | APBS, LPBE, 0.15 M ±1 ions, pdie 2, sdie 78, 310 K, probe 1.4 Å, 353³ grid at 0.33 Å | same settings, APBS 3.4.1 (Debian package; the Windows release zip was blocked by Microsoft Defender on the build machine), same 116 Å box, 193³ grid (0.604 Å) — see the grid check below |
| Comparison | PIPSA: Hodgkin index over the intersection of skins δ thick at σ above the vdW surface; ESD = √(2 − 2·SI) | same formula; skin 3 Å thick at 4 Å (the app's statement and the paper's figure legend; the methods text gives δ = 4, σ = 3 and reports insensitivity); evaluated on every second grid point (1.21 Å) |
| Score | min ESD over recipient class I molecules (class I) or recipient molecules of the same locus (class II) | same, in `ems3dMolecule()` |

**Deletions.** 232 of the 522 DQA1 alleles (the DQA1\*02, \*04, \*05 and \*06 groups, including DQA1\*05:01) are one residue shorter than DQA1\*01/\*03 at IMGT position 56, and so are one residue shorter than the DQA1\*03:01 chain of the 1JK8 template (C\*03:46 and two DQB1 alleles carry deletions too; no other locus in the library does). The model leaves that residue out and lets the two residues on each side of the junction move freely during relaxation, so the chain is closed rather than broken (a break would be capped by PDB2PQR with an artificial pair of charged termini). Check on DQA1\*05:01~DQB1\*02:01: chain A 180 residues, largest C–N peptide bond 1.37 Å, largest consecutive Cα–Cα distance 4.03 Å (at the junction), energy 12,812 kJ/mol against 10,574 for the unmodified template heterodimer.

**Grid density check** (`tools/ems3d/grid_check.py`; A\*02:01, A\*01:01, B\*07:02, B\*08:01, C\*07:01, all 10 pairs, same models):

| APBS grid | max \|ESD − ESD(353³)\| | seconds per molecule |
|---|---|---|
| 129³ | 0.0100 | 3.7 |
| 193³ (used) | 0.0044 | 9.5 |
| 257³ | 0.0022 | 21 |
| 353³ (published) | — | 150 (10 GB RAM per run) |

**How much of an ESD is the model rather than the sequence.** The only stochastic step in model building is where new side chains and hydrogens start before relaxation (PDBFixer's clash-clearing dynamics and OpenMM's hydrogen placement). The library is built with a fixed seed, so rebuilding it gives identical models (checked: 0.000 Å between repeat builds). The seed nevertheless picks one of many plausible side-chain arrangements, and that choice changes the surface potential:

| Check (same five class I alleles, dime 193) | Result |
|---|---|
| `relax_check.py`: PDBFixer placement only vs the relaxed models | ESD matrices differ by up to 0.089; the two models of one allele are 0.18–0.24 apart |
| `seed_check.py`: 3 random starts per allele, relaxed (vacuum, 1 nm cutoff) | same allele: median ESD 0.159 (max 0.228); different alleles: median 0.480 (min 0.209) |
| `protocol_check.py`: the same with OBC2 implicit solvent (259 s per model) | same allele 0.180 (max 0.236); different alleles 0.480 (min 0.244) |
| `protocol_check.py`: PDBFixer placement only (10 s per model) | same allele 0.170 (max 0.253); different alleles 0.474 (min 0.214) |

So single-model EMS3D carries a noise floor of roughly 0.16 ESD whichever relaxation is used; implicit solvent costs ten times more and does not reduce it, so the build uses the vacuum relaxation (25.6 s per model). Mallon et al. also used one model per allele and do not report this quantity, so it cannot be compared with their pipeline. Practical reading: differences between EMS3D values smaller than about 0.2 should not be interpreted, and published cut-offs (for example the HLA-DQ EMS3D threshold of 0.37 in Kim et al. 2023) cannot be transferred to these values. Averaging the potential over several models per molecule would lower the floor at a proportional cost; it is not done in this build.

**Distribution against the published one.** Over the whole class I library (1,880 molecules, 1,766,260 pairs) the within-locus distances sit close to the published ones, although the noise floor above means individual values are not comparable:

| Pairs within | This build: median ESD (IQR) | Mallon et al. 2018 (Supplementary Table S1) |
|---|---|---|
| HLA-A | 0.352 (0.291–0.415), n = 170,236 | 0.355 (0.293–0.456) |
| HLA-B | 0.263 (0.204–0.319), n = 467,061 | 0.313 (0.228–0.382) |
| HLA-C | 0.361 (0.286–0.419), n = 53,956 | 0.349 (0.276–0.399) |
| any one class I locus | 0.289 (0.222–0.354), n = 691,253 | 0.307 (0.219–0.379) overall, range 0.00–0.777 |

Across loci (which the paper does not tabulate) the distances are larger: median 0.471 (IQR 0.410–0.531), maximum 0.883. Thirteen pairs of differently named class I alleles have ESD exactly 0 because their models are identical: 11 pairs (e.g. A\*74:01/A\*74:02, C\*17:01/C\*17:02/C\*17:03) have identical extracellular residues 1–284 and differ only further along the protein, and 2 pairs (A\*23:01/A\*23:17, B\*07:05/B\*07:06) differ only at residue 283 or 282, beyond the 276 residues of the 1K5N template.

Class II, same comparison (every pair within the group):

| Group | This build: median ESD (IQR) | Mallon et al. 2018 (Supplementary Table S1) |
|---|---|---|
| DRB1 (326 molecules) | 0.289 (0.220–0.352) | DR 0.276 (0.214–0.332) |
| DQ (1,222 heterodimers) | 0.369 (0.305–0.428) | DQ 0.407 (0.322–0.452) |
| DP (795 heterodimers) | 0.246 (0.196–0.293) | DP 0.261 (0.190–0.319) |

Within DQ, heterodimers with a DQA1\*01 α chain are closer to each other (median 0.258) than to heterodimers with another α chain (0.401), as expected from the two DQA1 lineages. Tambur et al. (HLA 2024) name DQA1\*02:01/DQB1\*04:01 and DQA1\*02:01/DQB1\*04:02 against DQA1\*02:01/DQB1\*02:01 as the highest EMS3D values in their data (0.665 and 0.645; the α chain of the second partner is elided in the text we could read). Here the same pairs are 0.569 and 0.574, the 98th percentile of the DQ table — high in both, but not equal, as the noise floor predicts.

**Library contents** (export of the final build):

| Group (EMS3D is the minimum within it) | Molecules | Pairs | Median ESD (IQR) | Max | Smallest skin overlap |
|---|---|---|---|---|---|
| Class I (HLA-A, -B, -C together) | 1,880 | 1,766,260 | 0.410 (0.315–0.494) | 0.883 | 89% |
| DRB1 | 326 | 52,975 | 0.289 (0.220–0.352) | 0.639 | 93% |
| DRB3 | 33 | 528 | 0.239 (0.185–0.313) | 0.527 | 95% |
| DRB4 | 7 | 21 | 0.168 (0.144–0.190) | 0.230 | 94% |
| DRB5 | 15 | 105 | 0.190 (0.148–0.214) | 0.329 | 97% |
| DQ heterodimers | 1,222 | 746,031 | 0.369 (0.305–0.428) | 0.733 | 85% |
| DP heterodimers | 795 | 315,615 | 0.246 (0.196–0.293) | 0.528 | 94% |

Built 2026-09-17 from IPD-IMGT/HLA 3.65.0: 4,278 molecules scored, 76 not (all because an allele is not a suffix-free two-field allele in IMGT 3.65: A*23:19, A*30:14, A*32:11, B*07:44, B*35:65, B*39:38, C*03:12, C*03:22, C*03:23, DQA1*01:07, DRB1*15:13). The molecule set is every eplet-engine allele of A, B, C and DRB1/3/4/5, every DQA1~DQB1 heterodimer of engine alleles that follows the DQA1\*01 ↔ DQB1\*05/06 pairing rule, and DPA1\*01:03, \*02:01, \*02:02, \*03:01 or \*04:01 with every engine DPB1 allele. All 186 alleles typed in the thesis registers (`processed_data/master_registry.parquet`, columns `Recipient_HLA_Full` and `Donor_HLA_Full`) that are on the eplet engine's list occur in the library (DQ and DP alleles as part of at least one heterodimer; whether a patient's particular heterodimer is included depends on the pairing). The other 34 well-formed names in those columns are not on the engine's list, most of them obsolete or mistyped names (e.g. A\*24:01, B\*17:01, DRB1\*110:01). "Smallest skin overlap" is the lowest fraction of one molecule's skin shared with another molecule of its group, i.e. how much of the surface each Hodgkin index actually compares.

## 5. What is not claimed

- These are implementations of the published methods, not output of hladiv.net or the Cambridge Shiny app. HED values agree with hladiv.net wherever tested. AAMS and EMS3D values have not been compared molecule by molecule with the Cambridge tool, because it publishes no code, tables or example output; individual EMS3D values in particular will differ because the structural models differ.
- EMS3D molecules outside the library are reported as not scored; when only some recipient molecules are scored, the displayed value is an upper bound (≤) on the true minimum.
- None of these scores enters the locked risk model of tab 1.
