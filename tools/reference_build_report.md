# HLA reference build report (2026-09-08)

## Class I (ABC_Antibody_Analysis_3.1.xlsb)
- Ep/Acc Mm column offset = 7; categorised columns = 117 (Counter({'Abver': 50, 'Ehi': 41, 'Elo': 26}))
- alleles extracted: 1889 (Counter({'B': 970, 'A': 587, 'C': 332}))
- validation vs cached "Acc Mm" per-allele counts: 1890 match, 0 differ

## Class II (DRDQDP_Antibody_Analysis_3.1.xlsb)
- beta chains from "UnAcc B": 666 alleles (Counter({'DRB1': 327, 'DPB1': 159, 'DQB1': 125, 'DRB3': 33, 'DRB5': 15, 'DRB4': 7})); cached (AbVer, Other) counts reproduced for 665 of 666; 1 explained by whitespace-only cells that the workbook counts as eplets: [('DPB1*105:01', {'AbV': 1})]
- alpha chains from "UnAcc A": 34 alleles (Counter({'DQA1': 21, 'DPA1': 13})); cached (AbVer, Other) counts reproduced for 34 of 34
- cross-check vs sheet B: 0 alleles only in sheet B []; 0 alleles whose eplet names differ []
- cross-check vs sheet A: 0 alleles only in sheet A []; eplets present in sheet A but never counted by the workbook: {'190T': 5, '160F': 2, '114K': 4, '127L': 3, '160V': 4, '114R': 2, '127P': 3, '190A': 1, '160A': 15, '187A': 11, '129H': 13, '175E': 9, '160D': 2, '175K': 3, '160S': 1}

## Linkage tables: DRB345DQB assoc rows = 129 (codes Counter({'B3*0202': 33, 'B4*01AC': 24, 'B3*0101': 20, 'NEG': 17, 'B3*0301': 13, 'B5*0101': 10, 'B5*0202': 6, 'B5*01CGF': 4, 'B3-0201': 2}))
- DQAB assoc rows = 103 (frequency labels Counter({'COMMON': 40, 'VERY COMMON': 35, 'RARE': 14, '': 7, 'VERY RARE': 5, 'EXTREMELY RARE': 1, 'MOST COMMON': 1}))

## IE.xlsx: Class I entries 71 (71 unique) -> 67 present in the v3.1 class I tables; absent: ['144TKH', '145KHA', '151AHA', '163LS/G']
- Class II entries 78 (76 unique) -> 63 present in the v3.1 class II tables; absent: ['30RV', '96EV', '98ES', '55R', '56L', '74S', '87Y', '116I', '125SQ', '50Q', '50R', '56EE', 'RQ70RK/R']
- cell vocabularies (unique column/eplet/category triples): class I 300, class II beta 273, class II alpha 38

## Eplet vocabularies: class I 297 eplets (Counter({'Ehi': 125, 'Elo': 96, 'Abver': 76})); class II beta 256 (Counter({'oth': 172, 'AbV': 63, 'Inter': 16, 'AbInt': 5})); class II alpha 38 (Counter({'othA': 28, 'Aver': 10}))
- class I eplets listed under more than one category (antibody-verified takes precedence): {'149AH': {'Abver': 380, 'Ehi': 380}, '150AHA': {'Abver': 38, 'Ehi': 38}, '81ALR': {'Abver': 97, 'Ehi': 97}}
- class II beta eplets under more than one category (antibody-verified takes precedence): {'140A': {'AbV': 32, 'oth': 27}, '35FV': {'AbV': 91, 'oth': 91}, '37YV': {'oth': 14, 'AbV': 137}, '56PV': {'AbV': 22, 'oth': 1}, '57D': {'AbV': 36, 'oth': 279}, '69E': {'AbV': 54, 'oth': 54}, '85VY': {'AbV': 32, 'oth': 32}, '98Q': {'AbV': 6, 'oth': 6}}

## Written hla_reference_data.js (407 KB)

## Mismatch-count validation against Dataset/Objective 1.xlsx (HLA_All_Linked, 619 pairs): 1977 locus comparisons; recorded MM reproduced by the antigen-level (first-field) rule in 1936 (97.9%), by the allele-level (two-field, distinct donor alleles) rule in 1720 (87.0%), by the haplotype rule in 1662 (84.1%). The thesis registers and the Phase 4 model therefore use antigen-level counts.
- agreement by locus (antigen rule): A 523/529, B 516/525, DRB1 510/519, DQB1 387/404
- remaining disagreement patterns: 20 x ('donor heterozygous', 'recipient heterozygous', 'recorded 2 vs antigen-level 1 / allele-level 2'); 5 x ('donor heterozygous', 'recipient homozygous', 'recorded 2 vs antigen-level 1 / allele-level 2'); 5 x ('donor homozygous', 'recipient heterozygous', 'recorded 2 vs antigen-level 1 / allele-level 1'); 5 x ('donor homozygous', 'recipient heterozygous', 'recorded 1 vs antigen-level 0 / allele-level 0'); 3 x ('donor heterozygous', 'recipient homozygous', 'recorded 0 vs antigen-level 1 / allele-level 1'); 1 x ('donor heterozygous', 'recipient homozygous', 'recorded 1 vs antigen-level 2 / allele-level 2'); 1 x ('donor homozygous', 'recipient heterozygous', 'recorded 1 vs antigen-level 0 / allele-level 1'); 1 x ('donor homozygous', 'recipient homozygous', 'recorded 1 vs antigen-level 0 / allele-level 0')
- disagreement examples (typing only): [{'locus': 'B', 'recipient': ['B*08:01', 'B*55:01'], 'donor': ['B*51:01', 'B*51:02'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 2, 'computed_haplotype': 2}, {'locus': 'B', 'recipient': ['B*08:01', 'B*55:01'], 'donor': ['B*51:01', 'B*51:02'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 2, 'computed_haplotype': 2}, {'locus': 'B', 'recipient': ['B*08:01', 'B*55:01'], 'donor': ['B*51:01', 'B*51:02'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 2, 'computed_haplotype': 2}, {'locus': 'DQB1', 'recipient': ['DQB1*03:01'], 'donor': ['DQB1*05:01', 'DQB1*05:03'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 2, 'computed_haplotype': 2}, {'locus': 'DQB1', 'recipient': ['DQB1*02:02', 'DQB1*05:01'], 'donor': ['DQB1*06:02'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 1, 'computed_haplotype': 2}, {'locus': 'DQB1', 'recipient': ['DQB1*03:01'], 'donor': ['DQB1*05:01', 'DQB1*05:03'], 'recorded': 2, 'computed_antigen': 1, 'computed_allele': 2, 'computed_haplotype': 2}]
- 40 fully concordant pairs stored as in-app self-test vectors
