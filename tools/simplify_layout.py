"""simplify_layout.py — idempotent restructuring of index.html into "landing page -> dashboard with two modules":
  * navigation reduced to Overview, Risk calculator, HLA & eplets;
  * landing page keeps hero, three steps, KPI tiles and the call-to-action; the study-domain cards are removed
    and the evidence table becomes a collapsible reference section;
  * the calculator top bar becomes a breadcrumb ("Dashboard / <module>") and each module gets a header.
Run from the clinical_risk_calculator folder.
"""
import io, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', 'index.html')
s = io.open(p, encoding='utf-8').read()
orig = s
done = []

# 1. navigation
for btn_id in ('nav-btn-evidence', 'nav-btn-domains'):
    s, n = re.subn(r'\s*<button type="button" class="nav-link" id="%s"[^>]*>[^<]*</button>' % btn_id, '', s)
    if n: done.append('removed ' + btn_id)

# 2. landing: drop the domain cards section
s, n = re.subn(r'\s*<!-- Core Pillars / Research Domains -->\s*<section class="content-section" id="domains-section">.*?</section>', '', s, count=1, flags=re.S)
if n: done.append('removed domains-section')

# 3. landing: evidence section becomes a collapsible reference block
if 'id="landing-evidence"' not in s:
    start = s.index('<section class="content-section" id="evidence-section"')
    end = s.index('</section>', start) + len('</section>')
    block = s[start:end]
    s = s[:start] + ('<details class="ux-details landing-evidence" id="landing-evidence">\n'
                     '                <summary>Evidence behind the tools — study results and scientific verdicts <span class="ux-muted">reference</span></summary>\n'
                     '                <div class="ux-details-body">\n' + block + '\n                </div>\n            </details>') + s[end:]
    done.append('wrapped evidence-section in details')
s = s.replace('''onclick="scrollToSection('evidence-section')">
                        <span>See the evidence</span>''',
              '''onclick="document.getElementById('landing-evidence').open = true; scrollToSection('landing-evidence');">
                        <span>See the evidence</span>''')

# 4. calculator top bar -> breadcrumb
old_bar_start = s.index('<div class="dashboard-top-bar">')
old_bar_end = s.index('<!-- Calculator Mode Tab Bar -->', old_bar_start)
new_bar = '''<div class="dashboard-top-bar">
                <nav class="db-crumb" aria-label="Breadcrumb">
                    <button type="button" class="back-link-btn" onclick="switchView('landing')">Overview</button>
                    <span class="db-crumb-sep">/</span>
                    <span class="db-crumb-current">Dashboard</span>
                    <span class="db-crumb-sep">/</span>
                    <span class="db-crumb-current" id="module-crumb">Risk calculator</span>
                </nav>
                <div class="dash-meta-badge">
                    <span class="active-pill"></span>
                    <span>Risk model trained on 443 PGIMER transplant recipients</span>
                </div>
            </div>

            '''
if 'db-crumb' not in s:
    s = s[:old_bar_start] + new_bar + s[old_bar_end:]
    done.append('breadcrumb top bar')

# 5. module header for the risk calculator pane
hdr = '''<div id="pane-nomogram" class="calc-tab-pane">
                <div class="module-header">
                    <div>
                        <h1 class="module-title">Rejection risk calculator</h1>
                        <p class="module-desc">Estimated one-year probability of biopsy-proven acute rejection from donor, HLA mismatch and flow-crossmatch values, with the observed risk band from the PGIMER cohort.</p>
                    </div>
                    <button type="button" class="btn-ghost btn-sm" onclick="switchCalculatorTab('eplet')">Compute HLA values from typing →</button>
                </div>'''
if 'class="module-header"' not in s.split('id="pane-eplet"')[0]:
    s = s.replace('<div id="pane-nomogram" class="calc-tab-pane">', hdr, 1)
    done.append('module header (risk calculator)')

if s != orig:
    io.open(p, 'w', encoding='utf-8').write(s)
print('changes:', done or 'none (already applied)')
