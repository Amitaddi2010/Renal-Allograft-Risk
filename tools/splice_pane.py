"""splice_pane.py — replaces the HLA engine pane in index.html with tools/pane_hla.html.
Run from the clinical_risk_calculator folder after editing tools/pane_hla.html."""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
p = os.path.join(APP, 'index.html')
s = io.open(p, encoding='utf-8').read()
start = s.index('<!-- TAB PANE 2')
start = s.rfind('\n', 0, start) + 1
end_marker = '</div><!-- /#pane-eplet -->'
end = s.index(end_marker, start) + len(end_marker)
new = io.open(os.path.join(HERE, 'pane_hla.html'), encoding='utf-8').read().rstrip('\n')
s = s[:start] + new + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('pane spliced; pane-eplet count =', s.count('id="pane-eplet"'))
