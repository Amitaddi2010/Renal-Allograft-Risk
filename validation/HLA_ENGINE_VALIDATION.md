# HLA mismatch & eplet engine — validation record

Date: 2026-09-08
Component: `clinical_risk_calculator` tab "02 // HLA MISMATCH & EPLET ENGINE" (`hla_engine.js`, `hla_ui.js`, `hla_reference_data.js`)
Reference files integrated (copies in `reference_sources/`): `ABC_Antibody_Analysis_3.1.xlsb`, `DRDQDP_Antibody_Analysis_3.1.xlsb` (HLAMatchmaker v3.1), `IE.xlsx` (PGIMER immunogenic eplet reference).

## 1. What the software computes

Pipeline, all inside the page, triggered on every keystroke:

1. **Typing parser.** Accepts two-field alleles in the common notations (A*02:01, A*0201, HLA-A*02:01:01, DRB1*8:01, A!26:01, DRB1:11:01), for A, B, C, DRB1, DRB3/4/5, DQA1, DQB1, DPA1, DPB1. Low-resolution entries (DRB1*15, B35), unknown loci, bare digits, null alleles, more than two alleles per locus and alleles absent from the v3.1 tables are flagged with a message and, where possible, the candidate alleles.
2. **Allele-level mismatch per locus.** Distinct donor alleles absent from the recipient (0–2; haplotype variant also shown), plus **antigen-level** mismatch (first field). The antigen-level count is the one the thesis registers and the Phase 4 risk model use (section 3).
3. **Molecular (eplet) mismatch.** Every allele is the list of its workbook cells (one polymorphic position = one column, carrying one eplet name and the category the workbook assigns to that column). A donor cell is mismatched when no recipient allele of the same class carries the same cell: class I pools A/B/C, class II β pools DRB1/3/4/5, DQB1, DPB1, class II α pools DQA1/DPA1, i.e. HLAMatchmaker intra- and interlocus comparison. Load = number of unique mismatched eplet names, with antibody-verified precedence when a name occurs in two cells.
4. **Categories** carried from the workbooks: class I Abver / ElliPro-high / ElliPro-low; class II AbV / AbInt (antibody-verified interlocus) / Inter / other; α chains Aver / other.
5. **Immunogenic load.** Mismatched eplets whose name is in IE.xlsx (matched by name, case-insensitive). Non-immunogenic = total − immunogenic. Antibody-verified load is shown separately.
6. **Linkage inference (optional, on by default).** DRB3/4/5 from DRB1 (and DQB1 when typed) using the workbook's `DRB345DQB assoc` table (population-specific proportions, default API) and DQA1 from DRB1+DQB1 using `DQAB assoc`. Inferred alleles are labelled in every table and note.
7. **Dashboard.** Antigen- and allele-level totals (A+B+DRB1, A+B+DRB1+DQB1, all loci), locus-wise allele mismatch with donor-specific and corresponding recipient alleles, eplet mismatch per donor allele, locus-wise total/immunogenic/non-immunogenic/antibody-verified loads, the immunogenic eplet list, category breakdown, a result ID (hash of normalised inputs and options) and a text report. "Send to nomogram" passes the antigen-level A/B/DRB1/DQB1 counts and the class I/II eplet loads into the risk calculator.

## 2. Extraction of the reference tables (`tools/build_hla_reference.py`)

| Table | Source sheet | Extracted | Validation against the workbook's own cached counts |
|---|---|---|---|
| Class I alleles × eplets | ABC `Ep` (categories from `Acc Mm` row 1) | 1,889 alleles (A 587, B 970, C 332); 297 eplet names, 300 cells | 1,890 of 1,890 `Acc Mm` rows reproduce #TotEp / #AbvEp / #HiEp / #loEp exactly |
| Class II β alleles × eplets | DRDQDP `UnAcc B` listing | 666 alleles (DRB1 327, DRB3 33, DRB4 7, DRB5 15, DQB1 125, DPB1 159); 256 names, 273 cells | 665 of 666 reproduce AbVer/Other counts; DPB1*105:01 differs by one whitespace-only cell that the workbook's COUNTA counts as an eplet |
| Class II α alleles × eplets | DRDQDP `UnAcc A` listing | 34 alleles (DQA1 21, DPA1 13); 38 names | 34 of 34 reproduce |
| Cross-checks | sheets `B`, `A` | same allele sets; β eplet names identical; sheet A holds 15 eplet names the workbook never counts (114K, 127L, 160F, 190T, …) | documented in `tools/reference_build_report.md` |
| DRB3/4/5 linkage | `DRB345DQB assoc` | 129 haplotype rows, 9 codes (B4*01AC mapped to DRB4*01:01, B5*01CGF to DRB5*01:01) | — |
| DQA1 linkage | `DQAB assoc` | 103 rows with frequency labels | — |
| IE.xlsx | Sheet1 | 71 class I names, 76 unique class II names | 67/71 class I and 63/76 class II names exist in the v3.1 tables; absent: 144TKH, 145KHA, 151AHA, 163LS/G; 30RV, 96EV, 98ES, 55R, 56L, 74S, 87Y, 116I, 125SQ, 50Q, 50R, 56EE, RQ70RK/R |

Findings that required care: sheet B's header row labels the antibody-verified interlocus column rq75VT as "Inter"; the same eplet name can be antibody-verified on some alleles and "other" on others (57D, 37YV, 140A, 56PV), and some names sit in two columns of the same allele (35FV, 69E, 85VY, 98Q; class I 149AH, 150AHA, 81ALR). The cell-based model keeps all of this exactly as the workbooks have it.

## 3. Validation against the thesis records (`Dataset/Objective 1.xlsx`, sheet HLA_All_Linked, 619 pairs)

Recorded MM A / MM B / MM DRB1 / MM DQB1 versus the engine, 1,977 locus comparisons:

| Counting rule | Agreement |
|---|---|
| Antigen-level (distinct donor first-field antigens absent in recipient) | 1,936 (97.9%) |
| Allele-level, distinct donor alleles | 1,720 (87.0%) |
| Haplotype rule | 1,662 (84.1%) |

By locus (antigen rule): A 523/529, B 516/525, DRB1 510/519, DQB1 387/404. The remaining 41 disagreements are register inconsistencies (for example a heterozygous donor recorded as 2 mismatches where one antigen is shared). Conclusion: the thesis registers, and therefore the MM_A/MM_B/MM_DRB1/MM_DQB1/Total_MM features of the Phase 4 model, are antigen-level counts. The dashboard shows both levels and sends antigen-level counts to the nomogram.

## 4. Automated tests

`node tools/test_engine.js` — 207 checks, all passing on 2026-09-08:
- parser cases (formats, padding, typo separators, low resolution, parentheticals, null alleles, unsupported alleles, excess alleles, homozygosity);
- workbook cell counts for A*01:01 (36 cells: 13 / 13 / 10) and per-cell category preservation (57D);
- identical typing gives zero mismatches; cell-difference definition; interlocus exclusion (a donor B eplet present on recipient A is not counted); IE flag consistency; IE + non-IE = total;
- antigen- versus allele-level counting (A*02:06 vs A*02:01: allele 1 / antigen 0);
- linkage inference produces alleles present in the database; donor loci untyped in the recipient are skipped with a warning;
- self-test vectors: 88 per-allele count checks against the workbook caches, 40 thesis pairs (antigen-level MM) and 40 repeat-run reproducibility checks.

The same vectors run inside the page ("Run Self-Test" button) against `hla_validation_vectors.js`.

## 5. Known differences from the historical eplet strings in the thesis registers

The "ABC/DR/DQ MM Eplets" strings stored in `Objective 1.xlsx` use HLA Epitope Registry nomenclature (62RR, 151AHA, 163LW, 163RW, 163LS/G, 152RE, 113HN, 151AHE …). Those names do not exist in the HLAMatchmaker v3.1 tables provided, and the recorded "immunogenic" counts equal the bracketed eplets of that tool, not the IE.xlsx intersection. Re-computing 122 parseable pairs with the v3.1 tables reproduces none of the stored eplet sets exactly (21 match in count only). The engine therefore reproduces the provided workbooks, not the earlier registry-based output; loads from the two databases must not be mixed in one analysis.

## 6. 3D eplet view (pHLA3D-style)

Structures. `tools/fetch_structures.py` downloads 19 RCSB entries covering 23 common alleles (titles verified on 2026-09-08), trims them to the HLA chains plus peptide and bundles them into `hla_structures_data.js` for offline use; it also vendors 3Dmol.js 2.5.5 and, with `--phla3d`, downloads pHLA3D homology models (`https://www.phla3d.com.br/alleles/download/<allele>/1/pdb`, research-use licence, cite pHLA3D) for the alleles listed in `tools/phla3d_allele_list.txt` (the 162 alleles typed in the PGIMER registers that exist in the v3.1 tables). The viewer prefers a pHLA3D model of the exact allele, then the bundled solved structure, then RCSB online, then a same-locus template (labelled).

Eplet residue patches. `tools/build_eplet_residues.py` derives the residue positions of every eplet from the workbooks' own sequence tables (ABC `Seq`; DRDQDP `B` and `A` residue columns) and template structures (1AKJ, 1DLH, 1JK8, 3LQZ): the anchor position must carry the first residue letter of the eplet name in the carriers' consensus sequence, and each further letter is assigned to the nearest position (heavy-atom distance in the template, 4 Å then 6 Å, then a sequence window) carrying that residue. Numbering rules found in the tables: DPB1 has a two-residue deletion at aligned positions 23-24 and DPA1 lacks two N-terminal residues plus aligned position 16; locus-specific DP eplets are numbered without these, interlocus eplets (lowercase prefix) in the DR/DQ-aligned numbering; a few class I names in the 70/71 region are anchored one position after their first residue. Result (`tools/eplet_residues_report.md`): 591 eplets; anchor residue verified for 566; full patch from structure for 560, sequence window 11, anchor-shifted 13, incomplete 2, unparsed 5; 7 anchors still disagree (267QE, 70IAQ, 74EV, 98R, 61FT, 66IL, 66IT) and are shown as anchor only.

In-page check. When a structure is displayed, the residue found at every anchor position is compared with the residue letter of the eplet name; the count of agreements is reported, and a structure that agrees in fewer than half of the anchors is flagged as differently numbered or a template of another allele.

## 7. Limitations

- HLAMatchmaker assumes complete typing per class. When HLA-C or DP is untyped the corresponding eplets are not evaluated and a note is shown; donor loci that the recipient has not typed are skipped rather than over-counted.
- Linkage inference uses population proportions from the workbook (Caucasian, African, Asian/Pacific Islander, Hispanic); no North Indian table exists in the source, so inferred DRB3/4/5 and DQA1 alleles are labelled and can be overridden by typing them.
- Thirteen IE.xlsx class II names and four class I names have no counterpart in the v3.1 tables and can never be flagged.
- The engine is deterministic: identical inputs and options produce the same result ID.
