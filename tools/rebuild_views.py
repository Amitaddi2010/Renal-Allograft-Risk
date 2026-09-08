"""rebuild_views.py — rebuilds index.html for the two-page product:
  * landing page = a single full-screen hero with the animated 3D DNA helix (dna_hero.js)
  * dashboard = sidebar (Dashboard, Risk calculator, HLA & eplets, Back to site), breadcrumb, live summary strip,
    home pane (module cards, recent items, reference status, study evidence as reference), risk-calculator pane
    (grouped inputs, sticky results with the "what drives this estimate" panel), HLA pane from tools/pane_hla.html
    (run tools/splice_pane.py afterwards). Idempotent. Run from the clinical_risk_calculator folder.
"""
import io, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', 'index.html')
s = io.open(p, encoding='utf-8').read()
orig = s

# ---------------------------------------------------------------- blocks kept from the current file
def block(start_marker, end_marker):
    a = s.find(start_marker)
    if a < 0: return ''
    b = s.index(end_marker, a) + len(end_marker)
    return s[a:b]
EVIDENCE = block('<details class="ux-details landing-evidence"', '</details>')

# ---------------------------------------------------------------- navigation
nav_start = s.index('<nav class="nav-links" id="nav-links">')
nav_end = s.index('</nav>', nav_start) + len('</nav>')
NAV = '''<nav class="nav-links" id="nav-links">
            <button type="button" class="nav-link" id="nav-btn-home" onclick="switchView('calculator'); switchCalculatorTab('home'); closeNav();">Dashboard</button>
            <button type="button" class="nav-link" id="nav-btn-calc" onclick="switchView('calculator'); switchCalculatorTab('nomogram'); closeNav();">Risk calculator</button>
            <button type="button" class="nav-link" id="nav-btn-eplet-adv" onclick="switchView('calculator'); switchCalculatorTab('eplet'); closeNav();">HLA &amp; eplets</button>
            <button type="button" class="nav-link nav-link-secondary" id="nav-btn-landing" onclick="switchView('landing'); closeNav();">← Back to site</button>
        </nav>'''
s = s[:nav_start] + NAV + s[nav_end:]
s = re.sub(r'<button type="button" class="btn-aurora btn-sm" onclick="[^"]*" id="nav-launch-btn">',
           '<button type="button" class="btn-aurora btn-sm" onclick="switchView(\'calculator\'); switchCalculatorTab(\'home\');" id="nav-launch-btn">', s, count=1)

# ---------------------------------------------------------------- landing view: hero only
lv_start = s.index('<div id="landing-view"')
cv_start = s.index('<div id="calculator-view"')
lv_end = s.rfind('<!-- ====', lv_start, cv_start)
LANDING = '''<div id="landing-view" class="view-container active-view">
        <section class="hero-3d" id="hero">
            <canvas id="dna-canvas" class="hero-canvas" aria-hidden="true"></canvas>
            <div class="hero-3d-content">
                <div class="hero-brand"><span class="hero-brand-dot"></span> RAMRT · PGIMER Immunopathology</div>
                <h1 class="hero-3d-title">Donor–recipient immunological assessment.</h1>
                <p class="hero-3d-sub">HLA mismatch and immunogenic eplet analysis straight from typing, and a one-year rejection-risk estimate built on 443 PGIMER transplant recipients. Everything runs in your browser; no patient data leaves the computer.</p>
                <div class="hero-actions">
                    <button type="button" class="btn-aurora btn-lg" onclick="switchView('calculator'); switchCalculatorTab('home');"><span>Open dashboard</span><span>↗</span></button>
                    <button type="button" class="btn-ghost btn-lg hero-ghost" onclick="switchView('calculator'); switchCalculatorTab('eplet'); HLAUI.loadExample();"><span>Try the example pair</span></button>
                </div>
                <div class="hero-meta"><span>HLA mismatch &amp; eplets</span><span class="hero-sep">·</span><span>Rejection risk calculator</span><span class="hero-sep">·</span><span>3D eplet view</span></div>
            </div>
            <div class="hero-foot">Doctoral research tool · Department of Immunopathology, PGIMER Chandigarh · Research use only</div>
        </section>
    </div>

    '''
s = s[:lv_start] + LANDING + s[lv_end:]

# ---------------------------------------------------------------- dashboard: summary strip after the top bar
if 'id="db-summary"' not in s:
    s = s.replace('<!-- Calculator Mode Tab Bar -->', '''<div class="db-summary" id="db-summary">
                <div class="db-sum-item"><span class="db-sum-label">Antigen mismatches (A+B+DR)</span><span class="db-sum-value" id="sum-mm">–</span></div>
                <div class="db-sum-item"><span class="db-sum-label">Mismatched eplets</span><span class="db-sum-value" id="sum-ep">–</span></div>
                <div class="db-sum-item"><span class="db-sum-label">Immunogenic eplets</span><span class="db-sum-value" id="sum-ie">–</span></div>
                <div class="db-sum-item"><span class="db-sum-label">Predicted 1-year risk</span><span class="db-sum-value" id="sum-risk">–</span></div>
                <div class="db-sum-note" id="sum-note">Mismatch and eplet counts appear after an HLA analysis; the risk figure follows the calculator&#39;s current inputs.</div>
            </div>

            <!-- Calculator Mode Tab Bar -->''', 1)

# ---------------------------------------------------------------- tab bar: Dashboard tab (phones)
if 'id="calc-tab-home"' not in s:
    s = s.replace('<div class="calc-tab-bar">',
                  '<div class="calc-tab-bar">\n                <button type="button" class="calc-tab-btn" id="calc-tab-home" onclick="switchCalculatorTab(\'home\')"><span>Dashboard</span></button>', 1)

# ---------------------------------------------------------------- dashboard home pane
HOME = '''<!-- DASHBOARD HOME -->
            <div id="pane-home" class="calc-tab-pane hidden-tab">
                <div class="module-header">
                    <div>
                        <h1 class="module-title">Dashboard</h1>
                        <p class="module-desc">Choose a tool, or reopen a recent analysis. Recent items are kept only in this browser.</p>
                    </div>
                </div>
                <div class="home-grid">
                    <section class="surface-card home-card">
                        <div class="home-card-head"><span class="lp-feature-icon">⬡</span><h2 class="card-title">HLA mismatch &amp; eplet analysis</h2></div>
                        <p class="card-subtitle">Typing → antigen &amp; allele mismatches → eplet load → immunogenic eplets → 3D view.</p>
                        <div class="action-cluster">
                            <button type="button" class="btn-aurora" onclick="switchCalculatorTab('eplet')"><span>Open</span><span>↗</span></button>
                            <button type="button" class="btn-ghost" onclick="switchCalculatorTab('eplet'); HLAUI.loadExample();">Try the example pair</button>
                        </div>
                    </section>
                    <section class="surface-card home-card">
                        <div class="home-card-head"><span class="lp-feature-icon">◔</span><h2 class="card-title">Rejection risk calculator</h2></div>
                        <p class="card-subtitle">Donor, HLA mismatch and crossmatch values → one-year probability, risk band and drivers.</p>
                        <div class="action-cluster">
                            <button type="button" class="btn-aurora" onclick="switchCalculatorTab('nomogram')"><span>Open</span><span>↗</span></button>
                            <button type="button" class="btn-ghost" onclick="switchCalculatorTab('nomogram'); resetDefaults();">Start from typical values</button>
                        </div>
                    </section>
                </div>
                <div class="home-grid">
                    <section class="surface-card">
                        <div class="card-header-bar"><div><h2 class="card-title">Recent HLA analyses</h2><p class="card-subtitle">Saved from the HLA &amp; eplets tool.</p></div></div>
                        <div id="home-recent-hla"></div>
                    </section>
                    <section class="surface-card">
                        <div class="card-header-bar"><div><h2 class="card-title">Recent risk estimates</h2><p class="card-subtitle">Saved from the risk calculator.</p></div></div>
                        <div id="home-recent-risk"></div>
                    </section>
                </div>
                <section class="surface-card">
                    <div class="card-header-bar"><div><h2 class="card-title">Reference data &amp; status</h2><p class="card-subtitle">What the calculators are built on.</p></div></div>
                    <div id="home-status" class="home-status"></div>
                    <p class="hla-ref-info" style="margin-top: 14px;">Doctoral research tool · Candidate Heera Singh · Supervisor Prof. Ranjana Walker Minz · Department of Immunopathology, PGIMER Chandigarh · Research use only.</p>
                </section>
                ''' + EVIDENCE + '''
            </div><!-- /#pane-home -->

            '''
if 'id="pane-home"' not in s:
    s = s.replace('<!-- TAB PANE 1: QUANTITATIVE RISK NOMOGRAM -->', HOME + '<!-- TAB PANE 1: QUANTITATIVE RISK NOMOGRAM -->', 1)
elif EVIDENCE and EVIDENCE not in s.split('id="pane-home"')[1].split('<!-- /#pane-home -->')[0]:
    s = s.replace('            </div><!-- /#pane-home -->', '                ' + EVIDENCE + '\n            </div><!-- /#pane-home -->', 1)

# ---------------------------------------------------------------- risk-calculator pane (first run only; later runs keep it)
if 'id="risk-drivers"' not in s:
    nm_start = s.index('<div id="pane-nomogram" class="calc-tab-pane">')
    nm_end = s.index('</div><!-- /#pane-nomogram -->', nm_start) + len('</div><!-- /#pane-nomogram -->')
    old = s[nm_start:nm_end]
    def grab(start_marker, end_marker):
        a = old.index(start_marker); b = old.index(end_marker, a) + len(end_marker)
        return old[a:b]
    G1 = grab('<div class="instrument-group">\n                            <div class="group-kicker">1 · Donor and treatment</div>', '</div>\n                        </div>')
    G2 = grab('<div class="instrument-group">\n                            <div class="group-kicker">2 · HLA antigen mismatches', '</div>\n                            </div>\n                        </div>')
    G3 = grab('<div class="instrument-group">\n                            <div class="group-kicker">3 · Pre-transplant flow crossmatch</div>', '</div>\n                        </div>')
    G4 = grab('<div class="instrument-group">\n                            <div class="group-kicker">4 · Eplet mismatch (advisory only)</div>', '</div>\n                        </div>').replace('4 · Eplet mismatch (advisory only)', 'Eplet mismatch (advisory only)')
    TABLE = grab('<div class="matrix-container" id="matrix">', '</table>\n                    </div>')
    PROTO = grab('<div class="protocol-panel" id="protocol">', '</ul>\n                    </div>')
    PROG = grab('<div class="progression-panel" id="audit">', '</div>\n                    </div>')
    NOMO = '''<div id="pane-nomogram" class="calc-tab-pane">
                <div class="module-header">
                    <div>
                        <h1 class="module-title">Rejection risk calculator</h1>
                        <p class="module-desc">Estimated one-year probability of biopsy-proven acute rejection from donor, HLA mismatch and flow-crossmatch values, with the risk band observed in the PGIMER cohort.</p>
                    </div>
                    <button type="button" class="btn-ghost btn-sm" onclick="switchCalculatorTab('eplet')">Compute HLA values from typing →</button>
                </div>
                <div class="terminal-grid" id="nomogram">
                    <section class="surface-card">
                    <div class="card-header-bar">
                        <div><h2 class="card-title">Patient details</h2><p class="card-subtitle">The estimate updates as you type.</p></div>
                        <button class="arrow-btn" type="button" onclick="resetDefaults()" title="Reset to typical values">↺</button>
                    </div>
                    <div id="nomogram-fill-note" class="ux-status ux-status-ok" hidden></div>
                    <form id="calculator-form" onsubmit="event.preventDefault(); calculateRisk();">
                        ''' + G1 + '''
                        ''' + G2 + '''
                        ''' + G3 + '''
                        <details class="ux-details">
                            <summary>Advanced: eplet surveillance note <span class="ux-muted">does not change the risk</span></summary>
                            <div class="ux-details-body">
                        ''' + G4 + '''
                            </div>
                        </details>
                        <div class="action-cluster">
                            <button type="button" class="btn-aurora" onclick="calculateRisk()" id="calculate-btn"><span>Calculate risk</span><span>↗</span></button>
                            <button type="button" class="btn-ghost" onclick="saveEstimate()">Save estimate</button>
                            <button type="button" class="btn-ghost" onclick="resetDefaults()" id="reset-btn">Reset to typical values</button>
                        </div>
                        <div id="risk-flash" class="hla-flash" aria-live="polite"></div>
                    </form>
                    <details class="ux-details" style="margin-top: 14px;">
                        <summary>About this model</summary>
                        <div class="ux-details-body">
                            <p class="hla-ref-info">The calculator uses the 11 strongest predictors of the study's ElasticNet model (donor age and source, sibling donor, induction, HLA-A/B/DRB1/DQB1 antigen mismatches and their total, and the T- and B-cell flow crossmatch shifts). Recipient age, sex and crossmatch dual-positivity are held at cohort averages, so patients far from the average on those may differ from the full model. Model developed on 443 PGIMER transplant recipients (83 biopsy-proven rejections), out-of-fold AUC 0.693, Hosmer-Lemeshow p = 0.51. Research use only; not a substitute for clinical judgement.</p>
                        </div>
                    </details>
                </section>
                <section class="surface-card db-sticky">
                    <div class="card-header-bar">
                        <div><h2 class="card-title">Predicted rejection risk</h2><p class="card-subtitle">Probability of biopsy-proven rejection within one year, and its risk band.</p></div>
                        <button class="arrow-btn" type="button" onclick="window.print()" title="Print summary">↗</button>
                    </div>
                    <div class="result-hero">
                        <div class="risk-display-num" id="risk-percent">15.4%</div>
                        <div class="risk-meta-stack">
                            <div class="quintile-indicator" id="quintile-title">Quintile 3 — Moderate Risk</div>
                            <div class="quintile-subtext" id="quintile-subtext">Observed Rejection in Cohort: 20.2% (18/89) [95% CI: 13.2%–29.7%]</div>
                        </div>
                    </div>
                    <div class="protocol-panel" id="drivers-panel">
                        <div class="protocol-header">What drives this estimate</div>
                        <div id="risk-drivers" class="drivers"></div>
                        <p class="hla-ref-info" style="margin: 8px 0 0;">Bars show each input's contribution to the log-odds relative to a typical cohort patient: red raises the risk, green lowers it. The HLA terms should be read together: the model pairs a negative "total mismatches" weight with positive per-locus weights.</p>
                    </div>
                    <details class="ux-details"><summary>Risk bands observed in the cohort</summary><div class="ux-details-body">''' + TABLE + '''</div></details>
                    <details class="ux-details" open><summary>Suggested actions for this band <span class="ux-muted">PGIMER practice</span></summary><div class="ux-details-body">''' + PROTO + '''</div></details>
                    <details class="ux-details"><summary>How much each information layer added</summary><div class="ux-details-body">''' + PROG + '''</div></details>
                </section>
            </div>
            </div><!-- /#pane-nomogram -->'''
    s = s[:nm_start] + NOMO + s[nm_end:]

# ---------------------------------------------------------------- ambient helix behind the dashboard + scripts
if 'id="dna-ambient"' not in s:
    s = s.replace('<canvas id="particle-canvas"></canvas>', '<canvas id="particle-canvas"></canvas>\n    <canvas id="dna-ambient" class="dna-ambient" aria-hidden="true"></canvas>', 1)
if 'dashboard_home.js' not in s:
    s = s.replace('<script src="app.js?', '<script src="dashboard_home.js?v=20260908"></script>\n    <script src="app.js?', 1)
if 'dna_hero.js' not in s:
    s = s.replace('<script src="app.js?', '<script src="dna_hero.js?v=20260908"></script>\n    <script src="app.js?', 1)

if s != orig:
    io.open(p, 'w', encoding='utf-8').write(s)
print('views rebuilt; hero:', s.count('id="dna-canvas"'), 'home pane:', s.count('id="pane-home"'), 'summary strip:', s.count('id="db-summary"'), 'drivers:', s.count('id="risk-drivers"'), 'evidence in home:', 'landing-evidence' in s.split('id="pane-home"')[1] if 'id="pane-home"' in s else False)
