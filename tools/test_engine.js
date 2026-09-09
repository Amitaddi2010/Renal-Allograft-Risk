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
check('A*33:xx undetermined 2nd field', p('A*33:xx').status === 'lowres' && p('A*33:xx').allele === 'A*33');
check('B*15.XX undetermined 2nd field', p('B*15.XX').status === 'lowres' && p('B*15.XX').allele === 'B*15');
check('DRB1*15:01/03 ambiguous', p('DRB1*15:01/03').status === 'invalid' && /Ambiguous/.test(p('DRB1*15:01/03').message));
check('A*11:01:01G G group', p('A*11:01:01G').allele === 'A*11:01' && p('A*11:01:01G').status === 'ok' && p('A*11:01:01G').group === 'G');
check('DQB1*05:02:01G G group', p('DQB1*05:02:01G').allele === 'DQB1*05:02' && p('DQB1*05:02:01G').status === 'ok');
check('A*11:01P P group', p('A*11:01P').allele === 'A*11:01' && p('A*11:01P').group === 'P');
check('A*A*03:01:01:01 doubled prefix', p('A*A*03:01:01:01').allele === 'A*03:01' && p('A*A*03:01:01:01').status === 'ok');
check('DRB1*DRB1*11:01:01:01 doubled prefix', p('DRB1*DRB1*11:01:01:01').allele === 'DRB1*11:01');
check('A*24:02:01:01 four fields', p('A*24:02:01:01').allele === 'A*24:02' && !p('A*24:02:01:01').group);
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


/* ============================================================================
   Molecular mismatch layer (hla_molecular.js + hla_molecular_data.js)
   ========================================================================== */
(function molecularTests() {
    const molPath = path.join(__dirname, '..', 'hla_molecular.js');
    const dataPath = path.join(__dirname, '..', 'hla_molecular_data.js');
    if (!fs.existsSync(molPath) || !fs.existsSync(dataPath)) {
        console.log('molecular layer not present, skipped');
        return;
    }
    const mol = require(molPath);
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw.split('window.HLA_MOLECULAR = ')[1].trim().replace(/;\s*$/, ''));
    mol.setReference(data);

    // --- Grantham distances against the published matrix ---
    [['S', 'W', 177], ['C', 'W', 215], ['G', 'W', 184], ['L', 'I', 5], ['S', 'A', 99],
     ['D', 'E', 45], ['K', 'R', 26], ['F', 'Y', 22], ['A', 'V', 64], ['C', 'S', 112]
    ].forEach(function (t) {
        const got = mol.grantham(t[0], t[1]);
        check('Grantham ' + t[0] + t[1] + ' = ' + t[2],
              got !== null && Math.abs(got - t[2]) <= 1.5, 'got ' + (got === null ? 'null' : got.toFixed(1)));
    });
    check('Grantham identity is zero', mol.grantham('A', 'A') === 0);

    // --- residues at positions whose identity is textbook ---
    function residue(locus, allele, pos) {
        const L = data.loci[locus];
        const i = L.positions.indexOf(pos);
        return i === -1 ? null : L.alleles[allele][i];
    }
    check('DQB1*03:02 is non-Asp57', residue('DQB1', 'DQB1*03:02', 57) === 'A');
    check('DQB1*03:01 is Asp57', residue('DQB1', 'DQB1*03:01', 57) === 'D');
    check('B*57:01 carries Bw4-I80', residue('B', 'B*57:01', 80) === 'I');
    check('B*07:02 carries Bw6-N80', residue('B', 'B*07:02', 80) === 'N');
    check('C*04:01 is KIR C2 (K80)', residue('C', 'C*04:01', 80) === 'K');
    check('C*07:01 is KIR C1 (N80)', residue('C', 'C*07:01', 80) === 'N');
    check('DRB1*01:01 carries G86', residue('DRB1', 'DRB1*01:01', 86) === 'G');
    check('DRB1*01:02 carries V86', residue('DRB1', 'DRB1*01:02', 86) === 'V');

    // --- single-residue allele pairs give exactly one mismatch ---
    function pairMM(locus, recipient, donor) {
        const r = mol.locusMismatch(locus, [recipient], [donor]);
        return r ? r.detail : [];
    }
    let d = pairMM('B', 'B*44:02', 'B*44:03');
    check('B*44:02 vs B*44:03 differ at one position', d.length === 1, JSON.stringify(d));
    check('B*44:02 vs B*44:03 differ at position 156', d.length === 1 && d[0].position === 156);
    d = pairMM('A', 'A*02:01', 'A*02:06');
    check('A*02:01 vs A*02:06 differ at position 9', d.length === 1 && d[0].position === 9, JSON.stringify(d));

    // --- an identical pair has nothing to report ---
    const same = mol.locusMismatch('A', ['A*01:01', 'A*02:01'], ['A*01:01', 'A*02:01']);
    check('identical genotypes give zero amino-acid mismatch', same && same.aa === 0);
    check('identical genotypes give zero electrostatic load', same && same.electrostatic === 0);

    // --- mismatch is directional: donor residues absent in the recipient ---
    const fwd = mol.locusMismatch('A', ['A*01:01'], ['A*02:01']);
    const rev = mol.locusMismatch('A', ['A*02:01'], ['A*01:01']);
    check('mismatch counts are reported per direction', fwd.aa > 0 && rev.aa > 0);
    check('a homozygous recipient is broader than a heterozygous one',
          mol.locusMismatch('A', ['A*01:01'], ['A*02:01']).aa >=
          mol.locusMismatch('A', ['A*01:01', 'A*02:01'], ['A*02:01']).aa);

    // --- divergence ---
    check('homozygous divergence is zero',
          mol.locusDivergence('A', ['A*01:01', 'A*01:01']).hed === 0);
    const hedDiff = mol.locusDivergence('A', ['A*01:01', 'A*02:01']);
    check('heterozygous divergence is positive', hedDiff && hedDiff.hed > 0, JSON.stringify(hedDiff));

    // --- exposure bookkeeping ---
    let exposedOK = true, total = 0, exposedTotal = 0;
    Object.keys(data.loci).forEach(function (locus) {
        const L = data.loci[locus];
        total += L.positions.length;
        Object.keys(L.exposure).forEach(function (pos) {
            exposedTotal += 1;
            const v = L.exposure[pos];
            if (!(v >= 0 && v <= 3)) exposedOK = false;      // relative ASA, occasionally >1
        });
    });
    check('relative accessibility values are in range', exposedOK);
    check('most polymorphic positions have structural coverage', exposedTotal > total * 0.85,
          exposedTotal + ' of ' + total);
    check('exposed subset never exceeds the full count', (function () {
        const r = mol.locusMismatch('A', ['A*01:01', 'A*02:01'], ['A*24:02', 'A*03:01']);
        return r.aaExposed <= r.aa;
    })());

    // --- every allele the eplet engine supports has residues ---
    const engineAlleles = [];
    ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
        Object.keys(ref[k].alleles).forEach(function (a) { engineAlleles.push(a); });
    });
    const missing = engineAlleles.filter(function (a) {
        const locus = a.split('*')[0];
        const L = data.loci[locus];
        return !L || !L.alleles[a];
    });
    check('IMGT residues cover the engine allele list', missing.length <= 1,
          missing.length + ' missing: ' + missing.slice(0, 5).join(', '));
})();

console.log('TOTAL: pass ' + pass + ', fail ' + fail);
process.exit(fail ? 1 : 0);
