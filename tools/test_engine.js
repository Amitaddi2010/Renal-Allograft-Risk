/*
 * test_engine.js — Node test harness for hla_engine.js
 *   node tools/test_engine.js
 * Loads the generated reference (tools/hla_reference_data.json) and validation vectors
 * (tools/validation_vectors.json), runs the engine self-test plus parser/algorithm unit tests,
 * writes ../hla_validation_vectors.js for the in-browser self-test, and prints a summary.
 */
const fs = require('fs');
const path = require('path');
const engine = require('../hla_engine.js');

const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'hla_reference_data.json'), 'utf8'));
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'validation_vectors.json'), 'utf8'));
engine.setReference(ref);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) pass++; else { fail++; console.log('FAIL: ' + name + (detail ? ' -> ' + detail : '')); }
}

/* ---- parser unit tests ---- */
const p = engine.parseToken;
check('A*02:01 ok', p('A*02:01').status === 'ok' && p('A*02:01').allele === 'A*02:01');
check('A*0201 4-digit', p('A*0201').allele === 'A*02:01');
check('A*02:01:01 3-field', p('A*02:01:01').allele === 'A*02:01');
check('HLA-A*02:01 prefix', p('HLA-A*02:01').allele === 'A*02:01');
check('DRB1*8:01 padding', p('DRB1*8:01').allele === 'DRB1*08:01');
check('A!26:01 typo separator', p('A!26:01').allele === 'A*26:01');
check('DRB1:11:01 colon separator', p('DRB1:11:01').allele === 'DRB1*11:01');
check('DRB1*15 low resolution', p('DRB1*15').status === 'lowres' && p('DRB1*15').suggestions.indexOf('DRB1*15:01') !== -1, JSON.stringify(p('DRB1*15')));
check('B35 serological low-res', p('B35').status === 'lowres');
check('A*24(9) parenthetical', p('A*24(9)').status === 'lowres' && p('A*24(9)').allele === 'A*24');
check('01 bare digits invalid', p('01').status === 'invalid');
check('DQA1*NA empty', p('DQA1*NA').status === 'empty');
check('DQ ambiguous', p('DQ*03:01').status === 'invalid');
check('null allele', p('A*24:02N').status === 'null');
check('unsupported allele flagged', p('A*99:99').status === 'unsupported');
check('DQA1*03::01 double colon', p('DQA1*03::01').allele === 'DQA1*03:01');

const t = engine.parseTyping('A*01:01, A*03:01, B*08:01, B*55:01, DRB1*03:01, DRB1*08:01, DQB1*02:01, DQB1*04:02');
check('parseTyping loci', Object.keys(t.alleles).sort().join() === 'A,B,DQB1,DRB1');
const t2 = engine.parseTyping('A*26:01, A*26:01, B*08:01');
check('duplicate allele -> homozygous', t2.alleles.A.length === 1 && t2.alleles.A[0].homozygous === true);
const t3 = engine.parseTyping('A*01:01 A*02:01 A*03:01');
check('excess alleles flagged', t3.alleles.A.length === 2 && t3.warnings.some(w => w.level === 'error'));

/* ---- algorithm tests against the workbook's own per-allele listing ---- */
// A*01:01 carries 36 eplets (13 AbVer, 13 Ehi, 10 Elo) per 'Acc Mm' row 4 of the ABC workbook
const gI = ref.classI;
const nameOf = (g, i) => g.eplets[g.cells[i][1]];
const catOf = (g, i) => g.categories[g.cells[i][2]];
const ids = gI.alleles['A*01:01'];
check('A*01:01 column count 36', gI.colCount['A*01:01'] === 36 && ids.length === 36, gI.colCount['A*01:01'] + '/' + ids.length);
check('A*01:01 categories 13/13/10', ids.filter(i => catOf(gI, i) === 'Abver').length === 13 && ids.filter(i => catOf(gI, i) === 'Ehi').length === 13 && ids.filter(i => catOf(gI, i) === 'Elo').length === 10);
check('A*01:01 has 44KM and 90D', ids.map(i => nameOf(gI, i)).includes('44KM') && ids.map(i => nameOf(gI, i)).includes('90D'));
// the same name with different categories on different alleles is preserved (e.g. 57D in class II)
const gB = ref.classIIB;
const cats57D = new Set(gB.cells.filter(c => gB.eplets[c[1]] === '57D').map(c => gB.categories[c[2]]));
check('57D keeps per-cell categories', cats57D.size >= 2, [...cats57D].join(','));

// identical typing -> zero mismatches everywhere
const same = engine.analyze('A*01:01, A*02:01, B*07:02, B*08:01, C*07:01, C*07:02, DRB1*15:01, DRB1*03:01, DQB1*06:02, DQB1*02:01',
                            'A*01:01, A*02:01, B*07:02, B*08:01, C*07:01, C*07:02, DRB1*15:01, DRB1*03:01, DQB1*06:02, DQB1*02:01');
check('identical typing: allele MM 0', same.allele.totalABDR === 0 && same.allele.totalAll === 0);
check('identical typing: eplet MM 0', same.eplet.overall.total === 0 && same.eplet.classI.evaluated);

// recipient homozygous A*01:01 vs donor A*01:01/A*02:01 -> class I mismatches = cells of A*02:01 absent from A*01:01 (unique names)
const one = engine.analyze('A*01:01', 'A*01:01, A*02:01', { inferLinked: false });
const a0101cells = new Set(gI.alleles['A*01:01']);
const expected = new Set(gI.alleles['A*02:01'].filter(i => !a0101cells.has(i)).map(i => nameOf(gI, i))).size;
check('cell-difference definition', one.eplet.classI.total === expected, one.eplet.classI.total + ' vs ' + expected);
const a0101 = new Set(gI.alleles['A*01:01'].map(i => nameOf(gI, i)));
check('allele-level unique rule', one.allele.perLocus.A.count === 1 && one.allele.perLocus.A.countHaplotype === 1);
const hom = engine.analyze('A*01:01, A*03:01', 'A*02:01', { inferLinked: false });
check('homozygous donor: unique 1, haplotype 2', hom.allele.perLocus.A.countUnique === 1 && hom.allele.perLocus.A.countHaplotype === 2);
// antigen-level: A*02:06 vs A*02:01 differ as alleles but not as antigens
const ant = engine.analyze('A*02:01, A*24:02, B*35:01, B*40:06', 'A*02:06, A*24:02, B*35:03, B*44:02', { inferLinked: false });
check('antigen-level A: allele 1 / antigen 0', ant.allele.perLocus.A.countUnique === 1 && ant.allele.perLocus.A.countAntigen === 0, JSON.stringify(ant.allele.perLocus.A));
check('antigen-level B: allele 2 / antigen 1', ant.allele.perLocus.B.countUnique === 2 && ant.allele.perLocus.B.countAntigen === 1 && ant.allele.perLocus.B.antigenGroups[0] === 'B*44');
check('antigen totals', ant.allele.totalAllAntigen === 1 && ant.allele.totalAll === 3);

// interlocus: a donor B eplet present on the recipient's A allele must not count
let interlocusChecked = false;
for (const bAllele of Object.keys(gI.alleles).filter(a => a.startsWith('B*')).slice(0, 200)) {
    const bset = new Set(gI.alleles[bAllele].filter(i => a0101cells.has(i)).map(i => nameOf(gI, i)));
    const shared = [...a0101].filter(e => bset.has(e));
    if (shared.length) {
        const r = engine.analyze('A*01:01', bAllele, { inferLinked: false });
        const names = new Set(r.eplet.classI.mismatched.map(e => e.name));
        check('interlocus match excluded (' + bAllele + ')', shared.every(e => !names.has(e)));
        interlocusChecked = true; break;
    }
}
check('interlocus test executed', interlocusChecked);

// IE classification: a mismatched eplet that is in IE.xlsx is flagged
const ieNames = new Set(Object.values(ref.ie.mapI).filter(Boolean));
const r2 = engine.analyze('A*01:01, B*08:01', 'A*02:01, B*07:02', { inferLinked: false });
check('IE flag consistent', r2.eplet.classI.mismatched.every(e => e.ie === ieNames.has(e.name)));
check('nonIE + IE = total', r2.eplet.classI.ie + r2.eplet.classI.nonIE === r2.eplet.classI.total);

// linkage inference
const inf = engine.analyze('DRB1*15:01, DRB1*03:01, DQB1*06:02, DQB1*02:01', 'DRB1*04:01, DRB1*07:01, DQB1*03:02, DQB1*02:02', { inferLinked: true, population: 'API' });
check('DRB345 inferred for recipient', inf.inferred.recipient.drb345.length >= 1, JSON.stringify(inf.inferred.recipient));
check('DQA1 inferred for donor', inf.inferred.donor.dqa1.length >= 1, JSON.stringify(inf.inferred.donor));
check('inferred alleles in DB', inf.inferred.recipient.drb345.every(a => a.inDb) && inf.inferred.donor.dqa1.every(a => a.inDb));

// donor locus not typed in recipient is skipped
const skip = engine.analyze('A*01:01, B*08:01', 'A*02:01, B*07:02, C*07:02', { inferLinked: false });
check('donor C skipped when recipient C untyped', skip.eplet.classI.skippedDonorLoci.includes('C'));

/* ---- self-test vectors (workbook caches + thesis allele-level records) ---- */
const st = engine.selfTest(vectors);
console.log('selfTest: pass ' + st.pass + ', fail ' + st.fail);
st.results.filter(r => !r.ok).slice(0, 10).forEach(r => console.log('  FAIL ' + r.test + ': ' + r.detail));
pass += st.pass; fail += st.fail;

/* ---- write browser self-test vectors ---- */
const out = { vectors: vectors, nodeRun: { date: new Date().toISOString(), pass: pass, fail: fail } };
fs.writeFileSync(path.join(__dirname, '..', 'hla_validation_vectors.js'),
    '/* GENERATED by tools/test_engine.js - validation vectors for the in-app self-test */\nwindow.HLA_VALIDATION = ' + JSON.stringify(out) + ';\n');

console.log('TOTAL: pass ' + pass + ', fail ' + fail);
process.exit(fail ? 1 : 0);
