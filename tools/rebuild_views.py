"""rebuild_views.py — rebuilds index.html views for the "landing page -> dashboard" product structure:
  * landing view: hero with one primary action, two feature cards, how-it-works, KPI tiles, evidence (kept), CTA, footer (kept)
  * sidebar navigation: Dashboard, Risk calculator, HLA & eplets, Back to site
  * dashboard home pane (module cards, recent analyses, recent estimates, reference status)
  * risk-calculator pane: grouped inputs, advanced/eplet section and model notes collapsed, sticky results with
    the "what drives this estimate" panel and collapsible reference tables
The engine pane comes from tools/pane_hla.html (run tools/splice_pane.py afterwards). Idempotent.
Run from the clinical_risk_calculator folder.
"""
import io, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', 'index.html')
s = io.open(p, encoding='utf-8').read()
orig = s

# ---------------------------------------------------------------- keep blocks we do not rewrite
ev_start = s.index('<details class="ux-details landing-evidence"')
ev_end = s.index('</details>', ev_start) + len('</details>')
EVIDENCE = s[ev_start:ev_end]
ft_start = s.index('<footer class="ramrt-footer">')
ft_end = s.index('</footer>', ft_start) + len('</footer>')
FOOTER = s[ft_start:ft_end]

# ---------------------------------------------------------------- navigation
nav_start = s.index('<nav class="nav-links" id="nav-links">')
nav_end = s.index('</nav>', nav_start) + len('</nav>')
NAV = '''<nav class="nav-links" id="nav-links">
            <button type="button" class="nav-link" id="nav-btn-home" onclick="switchView('calculator'); switchCalculatorTab('home'); closeNav();">Dashboard</button>
            <button type="button" class="nav-link" id="nav-btn-calc" onclick="switchView('calculator'); switchCalculatorTab('nomogram'); closeNav();">Risk calculator</button>
            <button type="button" class="nav-link" id="nav-btn-eplet-adv" onclick="switchView('calculator'); switchCalculatorTab('eplet'); closeNav();">HLA &amp; eplets</button>
            <button type="button" class="nav-link nav-link-secondary active" id="nav-btn-landing" onclick="switchView('landing'); closeNav();">← Back to site</button>
        </nav>'''
s = s[:nav_start] + NAV + s[nav_end:]
s = s.replace('''<button type="button" class="btn-aurora btn-sm" onclick="switchView('calculator')" id="nav-launch-btn">''',
              '''<button type="button" class="btn-aurora btn-sm" onclick="switchView('calculator'); switchCalculatorTab('home');" id="nav-launch-btn">''')

# ---------------------------------------------------------------- landing view
lv_start = s.index('<div id="landing-view"')
cv_start = s.index('<div id="calculator-view"')
cmt = s.rfind('<!-- ====', lv_start, cv_start)     # comment block that introduces view 2
lv_end = cmt
LANDING = '''<div id="landing-view" class="view-container active-view">
        <div class="page-wrapper">
            <section class="hero-section lp-hero">
                <div class="section-eyebrow">
                    <span>PGIMER Chandigarh • Department of Immunopathology</span>
                    <span>/</span>
                    <span>Doctoral research tools</span>
                </div>
                <h1 class="hero-title">Donor–recipient immunological assessment, in one place.</h1>
                <p class="hero-subtext">Two calculators from the PGIMER kidney-transplant study: an HLA mismatch and eplet analysis that works straight from donor and recipient typing, and a one-year rejection-risk estimate built on 443 transplant recipients. Everything runs in the browser; no patient data leaves the computer.</p>
                <div class="action-cluster">
                    <button type="button" class="btn-aurora" onclick="switchView('calculator'); switchCalculatorTab('home');">
                        <span>Open dashboard</span><span>↗</span>
                    </button>
                    <button type="button" class="btn-ghost" onclick="scrollToSection('how-it-works')"><span>How it works</span></button>
                </div>
            </section>

            <section class="lp-features" id="features">
                <div class="lp-feature">
                    <div class="lp-feature-icon">⬡</div>
                    <h3>HLA mismatch &amp; eplet analysis</h3>
                    <p>Paste or type both HLA typings and get the full mismatch picture immediately.</p>
                    <ul>
                        <li>Antigen- and allele-level mismatches per locus, with the alleles that differ</li>
                        <li>Eplet mismatch load from the HLAMatchmaker 3.1 tables (class I and II)</li>
                        <li>Immunogenic eplets from the PGIMER IE catalogue, total vs immunogenic load</li>
                        <li>DRB3/4/5 and DQA1 inference, validation of every entry, self-test</li>
                        <li>3D view of the mismatched eplets on the donor molecule</li>
                        <li>Text and CSV export; one click sends the counts to the risk calculator</li>
                    </ul>
                    <button type="button" class="btn-aurora btn-sm" onclick="switchView('calculator'); switchCalculatorTab('eplet');"><span>Open HLA &amp; eplets</span><span>↗</span></button>
                </div>
                <div class="lp-feature">
                    <div class="lp-feature-icon">◔</div>
                    <h3>Rejection risk calculator</h3>
                    <p>Combine donor, HLA and flow-crossmatch values into a calibrated one-year estimate.</p>
                    <ul>
                        <li>Probability of biopsy-proven acute rejection within one year</li>
                        <li>Risk band with the rejection rate actually observed in that band</li>
                        <li>"What drives this estimate": each input's contribution, up or down</li>
                        <li>Suggested actions for the band, following PGIMER practice</li>
                        <li>HLA values filled in directly from the typing analysis</li>
                        <li>Save and reopen estimates from the dashboard</li>
                    </ul>
                    <button type="button" class="btn-aurora btn-sm" onclick="switchView('calculator'); switchCalculatorTab('nomogram');"><span>Open risk calculator</span><span>↗</span></button>
                </div>
            </section>

            <section class="content-section" id="how-it-works">
                <div class="section-header-compact">
                    <div class="group-kicker">How it works</div>
                    <h2 class="section-heading-sm">Three steps from typing to risk estimate</h2>
                </div>
                <div class="ux-steps">
                    <div class="ux-step"><div class="ux-step-num">1</div><div><div class="ux-step-title">Enter donor and recipient HLA typing</div><div class="ux-step-text">Paste alleles or type them by locus; results appear as you type.</div></div></div>
                    <div class="ux-step"><div class="ux-step-num">2</div><div><div class="ux-step-title">Review mismatches and immunogenic eplets</div><div class="ux-step-text">Antigen and allele mismatches, eplet loads and IE-catalogue eplets in one dashboard.</div></div></div>
                    <div class="ux-step"><div class="ux-step-num">3</div><div><div class="ux-step-title">Estimate rejection risk</div><div class="ux-step-text">Send the counts to the risk calculator and add donor age, induction and crossmatch values.</div></div></div>
                </div>
            </section>

            <section class="stats-ribbon">
                <div class="stat-block"><span class="stat-number">0.6926</span><span class="stat-label">Model accuracy, AUC (95% CI 0.63–0.75)</span></div>
                <div class="stat-block"><span class="stat-number">+0.1018</span><span class="stat-label">AUC gained from HLA + crossmatch data (p &lt; 0.001)</span></div>
                <div class="stat-block"><span class="stat-number">6.4×</span><span class="stat-label">Rejection rate, lowest to highest risk band (5.6% → 36.0%)</span></div>
                <div class="stat-block"><span class="stat-number">N = 2,220</span><span class="stat-label">Transplants in the PGIMER study registry</span></div>
            </section>

            ''' + EVIDENCE + '''

            <section class="launch-banner-card">
                <div>
                    <span class="group-kicker">Ready to start?</span>
                    <h2 class="section-heading-sm">Analyse a donor–recipient pair</h2>
                    <p class="section-desc">Enter the HLA typing of both people to get mismatches and immunogenic eplets, then add donor age, induction and crossmatch values for the one-year rejection-risk estimate.</p>
                </div>
                <button type="button" class="btn-aurora" onclick="switchView('calculator'); switchCalculatorTab('home');" style="flex-shrink: 0;">
                    <span>Open dashboard</span><span>↗</span>
                </button>
            </section>
        </div>

        ''' + FOOTER + '''
    </div>

    '''
s = s[:lv_start] + LANDING + s[lv_end:]

# ---------------------------------------------------------------- tab bar: add Dashboard tab (phones only; the sidebar switches modules on desktop)
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
                </section>
            </div><!-- /#pane-home -->

            '''
if 'id="pane-home"' not in s:
    s = s.replace('<!-- TAB PANE 1: QUANTITATIVE RISK NOMOGRAM -->', HOME + '<!-- TAB PANE 1: QUANTITATIVE RISK NOMOGRAM -->', 1)

# ---------------------------------------------------------------- risk-calculator pane
nm_start = s.index('<div id="pane-nomogram" class="calc-tab-pane">')
nm_end = s.index('</div><!-- /#pane-nomogram -->', nm_start) + len('</div><!-- /#pane-nomogram -->')
old = s[nm_start:nm_end]
def grab(start_marker, end_marker):
    a = old.index(start_marker); b = old.index(end_marker, a) + len(end_marker)
    return old[a:b]
G1 = grab('<div class="instrument-group">\n                            <div class="group-kicker">1 · Donor and treatment</div>', '</div>\n                        </div>')
G2 = grab('<div class="instrument-group">\n                            <div class="group-kicker">2 · HLA antigen mismatches', '</div>\n                            </div>\n                        </div>')
G3 = grab('<div class="instrument-group">\n                            <div class="group-kicker">3 · Pre-transplant flow crossmatch</div>', '</div>\n                        </div>')
G4 = grab('<div class="instrument-group">\n                            <div class="group-kicker">4 · Eplet mismatch (advisory only)</div>', '</div>\n                        </div>')
G4 = G4.replace('<div class="group-kicker">4 · Eplet mismatch (advisory only)</div>', '<div class="group-kicker">Eplet mismatch (advisory only)</div>')
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
                        <div>
                            <h2 class="card-title">Patient details</h2>
                            <p class="card-subtitle">The estimate updates as you type.</p>
                        </div>
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
                        <div>
                            <h2 class="card-title">Predicted rejection risk</h2>
                            <p class="card-subtitle">Probability of biopsy-proven rejection within one year, and its risk band.</p>
                        </div>
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
                    <details class="ux-details">
                        <summary>Risk bands observed in the cohort</summary>
                        <div class="ux-details-body">
                    ''' + TABLE + '''
                        </div>
                    </details>
                    <details class="ux-details" open>
                        <summary>Suggested actions for this band <span class="ux-muted">PGIMER practice</span></summary>
                        <div class="ux-details-body">
                    ''' + PROTO + '''
                        </div>
                    </details>
                    <details class="ux-details">
                        <summary>How much each information layer added</summary>
                        <div class="ux-details-body">
                    ''' + PROG + '''
                        </div>
                    </details>
                </section>
            </div>
            </div><!-- /#pane-nomogram -->'''
s = s[:nm_start] + NOMO + s[nm_end:]

# ---------------------------------------------------------------- scripts
if 'dashboard_home.js' not in s:
    s = s.replace('<script src="app.js?', '<script src="dashboard_home.js?v=20260908"></script>\n    <script src="app.js?', 1)

if s != orig:
    io.open(p, 'w', encoding='utf-8').write(s)
print('views rebuilt; pane-home:', s.count('id="pane-home"'), 'landing feature cards:', s.count('class="lp-feature"'), 'drivers panel:', s.count('id="risk-drivers"'))
