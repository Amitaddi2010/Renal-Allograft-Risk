/*
 * batch_eplet.js — run the eplet engine over every donor/recipient pair in the dataset.
 *   node tools/batch_eplet.js <pairs.json> <out.csv>
 * Mirrors the epregistry.com.br workflow (donor typing vs patient typing -> non-self eplet load)
 * using the HLAMatchmaker 3.1 tables bundled with the app.
 */
const fs = require('fs'), path = require('path');
const engine = require('../hla_engine.js');
engine.setReference(JSON.parse(fs.readFileSync(path.join(__dirname, 'hla_reference_data.json'), 'utf8')));

const pairs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rows = [], errs = [];
pairs.forEach(function (p) {
    let r;
    try { r = engine.analyze(p.patient, p.donor, {}); }
    catch (e) { errs.push({ id: p.id, error: e.message }); return; }
    const E = r.eplet, A = r.allele;
    rows.push({
        id: p.id, labP: p.labP, labD: p.labD,
        antigenMM: A.totalABDRAntigen === null ? '' : A.totalABDRAntigen,
        alleleMM: A.totalABDR === null ? '' : A.totalABDR,
        epI: E.classI.evaluated ? E.classI.total : '',
        epIIB: E.classIIB.evaluated ? E.classIIB.total : '',
        epIIA: E.classIIA.evaluated ? E.classIIA.total : '',
        epTotal: E.overall.evaluated ? E.overall.total : '',
        ie: E.overall.evaluated ? E.overall.ie : '',
        abver: E.overall.evaluated ? E.overall.abver : '',
        warnings: (r.warnings || []).filter(function (w) { return w.level === 'error'; }).length,
        signature: r.signature || ''
    });
});
const cols = Object.keys(rows[0]);
fs.writeFileSync(process.argv[3], cols.join(',') + '\n' +
    rows.map(function (r) { return cols.map(function (c) { return r[c]; }).join(','); }).join('\n') + '\n');

function stats(k) {
    const v = rows.map(function (r) { return r[k]; }).filter(function (x) { return x !== ''; }).sort(function (a, b) { return a - b; });
    if (!v.length) return 'n/a';
    const sum = v.reduce(function (a, b) { return a + b; }, 0);
    return 'n=' + v.length + ' median ' + v[Math.floor(v.length / 2)] + ' mean ' + (sum / v.length).toFixed(1) + ' range ' + v[0] + '-' + v[v.length - 1];
}
console.log('pairs analysed : ' + rows.length + (errs.length ? '  (errors ' + errs.length + ')' : ''));
['antigenMM', 'epI', 'epIIB', 'epIIA', 'epTotal', 'ie', 'abver'].forEach(function (k) { console.log('  ' + k.padEnd(10) + stats(k)); });
if (errs.length) console.log(JSON.stringify(errs.slice(0, 5), null, 1));
