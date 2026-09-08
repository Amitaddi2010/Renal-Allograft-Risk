"""
ux_text_updates.py — one-off, idempotent text updates that make index.html friendlier:
plain-language labels and captions on the risk calculator, clearer tab / nav names,
a "How it works" strip on the landing page, and the UX layer script/stylesheet links.
Run from the clinical_risk_calculator folder:  python tools/ux_text_updates.py
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
p = os.path.join(APP, 'index.html')
s = io.open(p, encoding='utf-8').read()
orig = s
changed = []

missed = []
def rep(old, new, count=1, required=True):
    global s
    if old not in s and old.replace('&amp;', '&') not in s and new in s:
        return  # already applied
    for cand in (old, old.replace('&amp;', '&')):
        n = s.count(cand)
        if n:
            assert n == count, (cand[:80], n)
            s = s.replace(cand, new)
            changed.append(cand[:60])
            return
    if required:
        missed.append(old[:90])

# ---- assets
rep('<link rel="stylesheet" href="hla_styles.css?v=20260908">',
    '<link rel="stylesheet" href="hla_styles.css?v=20260908b">\n    <link rel="stylesheet" href="ux_styles.css?v=20260908">')
rep('<script src="hla_ui.js?v=20260908"></script>',
    '<script src="ux.js?v=20260908"></script>\n    <script src="hla_ui.js?v=20260908c"></script>')

# ---- navigation & tabs
rep('onclick="switchView(\'calculator\'); switchCalculatorTab(\'nomogram\'); closeNav();">CALCULATOR</button>',
    'onclick="switchView(\'calculator\'); switchCalculatorTab(\'nomogram\'); closeNav();">RISK CALCULATOR</button>')
rep('onclick="switchView(\'calculator\'); switchCalculatorTab(\'eplet\'); closeNav();">HLA &amp; EPLET ENGINE</button>',
    'onclick="switchView(\'calculator\'); switchCalculatorTab(\'eplet\'); closeNav();">HLA &amp; EPLETS</button>')
rep('<span>01 // MULTIMODAL NOMOGRAM (AUDITED)</span>', '<span>1 · Rejection risk calculator</span>')
rep('<span>02 // HLA MISMATCH &amp; EPLET ENGINE</span>', '<span>2 · HLA mismatch &amp; eplet analysis</span>')
rep('<span class="tab-badge-advisory">HLAMATCHMAKER 3.1 · IE.XLSX</span>', '<span class="tab-badge-advisory">typing → mismatches → immunogenic eplets</span>')
rep('<span>ACTIVE EVALUATION SESSION • ELASTICNET MODEL (N = 443)</span>', '<span>Risk model trained on 443 PGIMER transplant recipients</span>')
rep('<span>← Return to Research Landing</span>', '<span>← Back to overview</span>')

# ---- landing page
rep('<p class="hero-subtext">A multi-domain machine learning architecture integrating recipient non-HLA checkpoint genetics, molecular HLA eplets, and pre-transplant flow cytometric crossmatching in renal transplantation.</p>',
    '<p class="hero-subtext">Two tools from the PGIMER doctoral study: an HLA mismatch and eplet analysis that works from donor and recipient typing, and a rejection-risk calculator that combines those mismatches with donor age, induction therapy and the flow crossmatch.</p>')
rep('''                    <button type="button" class="btn-aurora" onclick="switchView('calculator')">
                        <span>Enter Calculator Dashboard</span>
                        <span>↗</span>
                    </button>
                    <button type="button" class="btn-ghost" onclick="scrollToSection('evidence-section')">
                        <span>Review Doctoral Evidence</span>
                    </button>
                </div>''',
    '''                    <button type="button" class="btn-aurora" onclick="switchView('calculator'); switchCalculatorTab('eplet');">
                        <span>Start with HLA typing</span>
                        <span>↗</span>
                    </button>
                    <button type="button" class="btn-ghost" onclick="switchView('calculator'); switchCalculatorTab('nomogram');">
                        <span>Open the risk calculator</span>
                    </button>
                    <button type="button" class="btn-ghost" onclick="scrollToSection('evidence-section')">
                        <span>See the evidence</span>
                    </button>
                </div>
                <div class="ux-steps" style="margin-top: 22px; max-width: 980px;">
                    <div class="ux-step"><div class="ux-step-num">1</div><div><div class="ux-step-title">Enter donor and recipient HLA typing</div><div class="ux-step-text">Paste alleles or type them by locus; results appear as you type.</div></div></div>
                    <div class="ux-step"><div class="ux-step-num">2</div><div><div class="ux-step-title">Review mismatches and immunogenic eplets</div><div class="ux-step-text">Antigen and allele mismatches, eplet loads and IE-catalogue eplets in one dashboard.</div></div></div>
                    <div class="ux-step"><div class="ux-step-num">3</div><div><div class="ux-step-title">Estimate rejection risk</div><div class="ux-step-text">Send the counts to the risk calculator and add donor age, induction and crossmatch values.</div></div></div>
                </div>''')

# ---- landing statistics ribbon
rep('<span class="stat-label">MULTIMODAL ROC-AUC [0.629–0.751]</span>', '<span class="stat-label">MODEL ACCURACY, AUC (95% CI 0.63–0.75)</span>')
rep('<span class="stat-label">INCREMENTAL GAIN (DELONG P &lt; 0.001)</span>', '<span class="stat-label">AUC GAIN FROM HLA + CROSSMATCH DATA (P &lt; 0.001)</span>')
rep('<span class="stat-label">MONOTONIC RISK GRADIENT (5.6% → 36.0%)</span>', '<span class="stat-label">REJECTION RATE, LOWEST TO HIGHEST RISK BAND (5.6% → 36.0%)</span>')
rep('<span class="stat-label">AUDITED PGIMER MASTER COHORT</span>', '<span class="stat-label">TRANSPLANTS IN THE PGIMER STUDY REGISTRY</span>')
rep('<div class="group-kicker">01 // MULTIMODAL ALLORECOGNITION AXES</div>', '<div class="group-kicker">What the study measured</div>')
rep('<div class="group-kicker">02 // DOCTORAL DISSERTATION OBJECTIVES</div>', '<div class="group-kicker">Evidence behind the tools</div>')
rep('<span class="group-kicker">03 // CLINICAL TRANSLATION</span>', '<span class="group-kicker">Ready to start?</span>')
rep('<h2 class="section-heading-sm">Ready for Patient Evaluation?</h2>', '<h2 class="section-heading-sm">Analyse a donor–recipient pair</h2>')
rep('<p class="section-desc">Launch the interactive clinical risk terminal to calculate predicted 1-year rejection probability and nomogram quintile placement.</p>',
    '<p class="section-desc">Enter the HLA typing of both people to get mismatches and immunogenic eplets, then add donor age, induction and crossmatch values for the 1-year rejection-risk estimate.</p>')
rep('<span>Launch Terminal Dashboard</span>', '<span>Open the calculator</span>')

# ---- risk calculator: titles, groups, captions
rep('<h2 class="card-title">Patient Parameter Instrumentation</h2>', '<h2 class="card-title">Patient details</h2>')
rep('<p class="card-subtitle">Pre-transplant clinical, molecular HLA, and flow crossmatch metrics.</p>',
    '<p class="card-subtitle">Enter the donor, HLA and crossmatch values. The risk estimate updates as you type.</p>')
rep('<strong style="color: #38bdf8; display: block; margin-bottom: 4px;">Model Specification &amp; Simplification Notice:</strong>\n                        This tool uses the 11 most influential predictors from the full 31-covariate locked model (incorporating discrete HLA-A, HLA-B, HLA-DRB1, and HLA-DQB1 mismatches alongside regularized total mismatch burden and flow crossmatch T/B channel shifts); less influential factors (recipient age/sex, FCXM dual-positivity) are held at cohort-average values. Predictions for patients who deviate substantially from cohort averages on these factors may differ from the full model.',
    '<strong style="color: #38bdf8; display: block; margin-bottom: 4px;">About this estimate</strong>\n                        The calculator uses the 11 strongest predictors of the study\'s ElasticNet model (donor age and source, sibling donor, induction, HLA-A/B/DRB1/DQB1 antigen mismatches and their total, and the T- and B-cell flow crossmatch shifts). Recipient age, sex and crossmatch dual-positivity are held at cohort averages, so patients far from the average on those may differ from the full model. Research use only.\n                        <div id="nomogram-fill-note" style="margin-top: 6px; color: #a7f3d0;"></div>')
rep('<div class="group-kicker">01 // CLINICAL &amp; DEMOGRAPHIC COVARIATES (LOCKED)</div>', '<div class="group-kicker">1 · Donor and treatment</div>')
rep('<span class="control-caption">PRIMARY HAZARD (HR: 1.049/YR, COHORT MEAN: 46.4)</span>', '<span class="control-caption">Older donors carry higher risk (about 5% more per year; cohort mean 46 years).</span>')
rep('<option value="0">Living-Related (88.7%)</option>', '<option value="0">Living donor</option>')
rep('<option value="1">Deceased / Cadaveric (11.3%)</option>', '<option value="1">Deceased donor</option>')
rep('<span class="control-caption">ALLOGRAFT SOURCE (β: -0.6943)</span>', '<span class="control-caption">Living or deceased donor.</span>')
rep('<option value="0">Unrelated / Non-Sibling</option>', '<option value="0">No (parent, spouse, other or unrelated)</option>')
rep('<option value="1">Full Sibling (OR: 0.439, Protective)</option>', '<option value="1">Yes, full sibling</option>')
rep('<span class="control-caption">HISTOCOMPATIBILITY (β: -0.8236)</span>', '<span class="control-caption">Full-sibling donors had lower rejection risk in this cohort.</span>')
rep('<option value="1">Standard Induction (Basiliximab / IL-2RA)</option>', '<option value="1">Standard: basiliximab (IL-2 receptor antagonist)</option>')
rep('<option value="0">Intensified Induction (Anti-Thymocyte Globulin / ATG)</option>', '<option value="0">Intensified: anti-thymocyte globulin (ATG)</option>')
rep('<span class="control-caption">BASELINE REGIMEN (β: +0.6993)</span>', '<span class="control-caption">The induction planned or given at transplantation.</span>')
rep('<div class="group-kicker">02 // ALLELE-LEVEL HLA MISMATCH BURDEN (PER-LOCUS &amp; TOTAL)</div>',
    '<div class="group-kicker">2 · HLA antigen mismatches <button type="button" class="ux-link-btn" onclick="switchCalculatorTab(\'eplet\')">Compute these from HLA typing →</button></div>')
rep('<option value="1" selected>1 MM (Mean: 0.93)</option>', '<option value="1" selected>1 mismatch</option>')
rep('<option value="1" selected>1 MM (Mean: 0.98)</option>', '<option value="1" selected>1 mismatch</option>')
rep('<option value="1" selected>1 MM (Mean: 0.83)</option>', '<option value="1" selected>1 mismatch</option>')
rep('<option value="1" selected>1 MM (Mean: 0.79)</option>', '<option value="1" selected>1 mismatch</option>')
rep('<option value="0">0 MM</option>', '<option value="0">0 mismatches</option>', count=4)
rep('<option value="2">2 MM</option>', '<option value="2">2 mismatches</option>', count=4)
rep('<span class="control-caption">LOCUS A (OR: 1.568)</span>', '<span class="control-caption">Antigen-level (first field), 0–2.</span>')
rep('<span class="control-caption">LOCUS B (OR: 1.650)</span>', '<span class="control-caption">Antigen-level (first field), 0–2.</span>')
rep('<span class="control-caption">PRIMARY DRIVER (OR: 2.541)</span>', '<span class="control-caption">Antigen-level (first field), 0–2; the strongest HLA term in the model.</span>')
rep('<span class="control-caption">LOCUS DQ (OR: 1.451)</span>', '<span class="control-caption">Antigen-level (first field), 0–2.</span>')
rep('<label for="total-mm" class="control-label">Total HLA Mismatches (A+B+DR)</label>', '<label for="total-mm" class="control-label">Total mismatches, A + B + DR</label>')
rep('<span class="control-caption">MODELED REGULARIZATION CONSTRAINT (β: -1.6432, MEAN: 3.17)</span>', '<span class="control-caption">Filled in automatically (0–6).</span>')
rep('<label for="extended-total-mm" class="control-label">Extended Total Burden (A+B+DR+DQ)</label>', '<label for="extended-total-mm" class="control-label">Total including DQ, A + B + DR + DQ</label>')
rep('<span class="control-caption">EXTENDED 4-LOCUS TOTAL (FOR REFERENCE)</span>', '<span class="control-caption">For reference only (0–8); not used by the model.</span>')
rep('<div class="group-kicker">03 // PRE-TRANSPLANT FLOW CYTOMETRIC CROSSMATCH (FCXM)</div>', '<div class="group-kicker">3 · Pre-transplant flow crossmatch</div>')
rep('<label for="mcs-t" class="control-label">T-Cell Channel Shift (T-MCS)</label>', '<label for="mcs-t" class="control-label">T-cell median channel shift</label>')
rep('<span class="control-caption">T-CELL HAZARD (OR: 1.425 / SD, MEAN: 19.0)</span>', '<span class="control-caption">From the flow cytometry crossmatch report (cohort mean 19).</span>')
rep('<label for="mcs-b" class="control-label">B-Cell Channel Shift (B-MCS)</label>', '<label for="mcs-b" class="control-label">B-cell median channel shift</label>')
rep('<span class="control-caption">B-CELL HAZARD (OR: 1.116 / SD, MEAN: 71.7)</span>', '<span class="control-caption">From the flow cytometry crossmatch report (cohort mean 72).</span>')
rep('<div class="group-kicker">04 // MOLECULAR EPLET SURVEILLANCE ADVISORY (OBJECTIVE 3)</div>', '<div class="group-kicker">4 · Eplet mismatch (advisory only)</div>')
rep('<p style="font-size: 12.5px; color: #94a3b8; margin-top: -6px; margin-bottom: 14px;">Guides post-transplant Luminex SAB antibody surveillance; qualitative advisory only (does not alter numerical logistic rejection risk).</p>',
    '<p style="font-size: 12.5px; color: #a9b7b6; margin-top: -6px; margin-bottom: 14px;">Filled in from the HLA typing analysis. Used only to add a surveillance note; it does not change the risk percentage (in the study, eplet counts alone did not predict rejection).</p>')
rep('<label for="eplet-class1" class="control-label">Class I Eplet Mismatches</label>', '<label for="eplet-class1" class="control-label">Class I mismatched eplets</label>')
rep('<span class="control-caption">HLA-A/B/C (MEDIAN: 1.0)</span>', '<span class="control-caption">HLA-A, -B, -C.</span>')
rep('<label for="eplet-class2" class="control-label">Class II Eplet Mismatches</label>', '<label for="eplet-class2" class="control-label">Class II mismatched eplets</label>')
rep('<span class="control-caption">HLA-DR/DQ (MEDIAN: 1.0)</span>', '<span class="control-caption">HLA-DR, -DQ (and DP when typed).</span>')
rep('<label for="total-eplets" class="control-label">Total Molecular Load</label>', '<label for="total-eplets" class="control-label">Total mismatched eplets</label>')
rep('<span class="control-caption">CLASS I + II LOAD</span>', '<span class="control-caption">Class I + class II.</span>')
rep('<label for="dominant-eplet" class="control-label">Dominant Epitope Target Specificity</label>', '<label for="dominant-eplet" class="control-label">Dominant target eplet present? (optional)</label>')
rep('<option value="0">Standard / Non-Dominant Repertoire</option>', '<option value="0">None of the frequent PGIMER targets</option>')
rep('<option value="1">Class I Dominant Target (163LG / 65GK Epitope)</option>', '<option value="1">Class I target present (163LG or 65GK)</option>')
rep('<option value="2">Class II Dominant Target (130Q / 86G2 Epitope)</option>', '<option value="2">Class II target present (130Q or 86G2)</option>')
rep('<option value="3">Dual Class High-Risk Epitopes (163LG + 130Q)</option>', '<option value="3">Both classes (163LG and 130Q)</option>')
rep('<span class="control-caption">PGIMER REFERENCE IMMUNOGENIC EPLET REPERTOIRE</span>', '<span class="control-caption">The most frequent antibody targets seen in the PGIMER cohort.</span>')
rep('<span>Compute Patient Risk</span>', '<span>Calculate risk</span>')
rep('Reset Cohort Medians\n', 'Reset to typical values\n')
rep('<h2 class="card-title">Risk Synthesis &amp; Stratification</h2>', '<h2 class="card-title">Predicted rejection risk</h2>')
rep('<p class="card-subtitle">Predicted probabilistic outcome mapped to PGIMER nomogram quintiles.</p>',
    '<p class="card-subtitle">Estimated probability of biopsy-proven rejection within one year, and the risk band it falls into.</p>')
rep('<div class="protocol-header">Clinical Action Protocol (PGIMER Guidelines)</div>', '<div class="protocol-header">Suggested actions for this risk band (PGIMER practice)</div>')
rep('<div class="progression-title">Audited Incremental Gain (Identical N = 443 Cohort)</div>', '<div class="progression-title">How much each information layer added (same 443 patients)</div>')
rep('<div class="bar-meta"><span>Config 1: Clinical Baseline</span><span>AUC: 0.5908</span></div>', '<div class="bar-meta"><span>Clinical data only</span><span>AUC 0.591</span></div>')
rep('<div class="bar-meta"><span>Config 2: Clinical + HLA Mismatches</span><span>AUC: 0.6719 (+0.0811)</span></div>', '<div class="bar-meta"><span>+ HLA mismatches</span><span>AUC 0.672 (+0.081)</span></div>')
rep('<div class="bar-meta"><span style="color: var(--color-liquid-mist);">Config 3: Full Multimodal (+ FCXM)</span><span style="color: var(--color-platinum); font-weight: 500;">AUC: 0.6926 (+0.1018, DeLong p = 0.00074)</span></div>',
    '<div class="bar-meta"><span style="color: var(--color-liquid-mist);">+ flow crossmatch</span><span style="color: var(--color-platinum); font-weight: 500;">AUC 0.693 (+0.102 overall, DeLong p = 0.0007)</span></div>')
rep('<th>Predicted Band</th>', '<th>Predicted risk</th>')
rep('<th>Observed Rate</th>', '<th>Observed rejections</th>')
rep('<th>Relative Risk</th>', '<th>Versus lowest band</th>')

if s != orig:
    io.open(p, 'w', encoding='utf-8').write(s)
print('applied %d replacements' % len(changed))
if missed:
    print('NOT FOUND (%d):' % len(missed))
    for m in missed:
        print('  - ' + m)
    sys.exit(1)
