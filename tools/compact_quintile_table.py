"""compact_quintile_table.py — one-off, idempotent: merges the 'Wilson 95% CI' column of the risk-band
table on the risk calculator into the 'Observed rejections' column so the table fits inside its card
without horizontal scrolling. Run from the clinical_risk_calculator folder."""
import io, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', 'index.html')
s = io.open(p, encoding='utf-8').read()
m = re.search(r'<table class="table-matrix quintile-table">(.*?)</table>', s, re.S)
assert m, 'quintile table not found'
tbl = m.group(0)
ths = re.findall(r'<th>(.*?)</th>', tbl, re.S)
if len(ths) == 5:
    old_head = re.search(r'<thead>.*?</thead>', tbl, re.S).group(0)
    new_head = old_head.replace('<th>' + ths[2] + '</th>', '<th>' + ths[2] + ' (95% CI)</th>', 1)
    new_head = re.sub(r'\s*<th>' + re.escape(ths[3]) + '</th>', '', new_head, count=1)
    tbl2 = tbl.replace(old_head, new_head)
    def fix(row):
        r = row.group(0)
        tds = re.findall(r'<td>(.*?)</td>', r, re.S)
        if len(tds) != 5:
            return r
        i = r.find('<td>' + tds[2] + '</td>')
        j = r.find('<td>' + tds[3] + '</td>', i)
        merged = '<td>' + tds[2] + '<br><small class="ux-muted">' + tds[3] + '</small></td>'
        return r[:i] + merged + r[j + len('<td>' + tds[3] + '</td>'):]
    tbl2, n = re.subn(r'<tr id="row-q\d"[^>]*>.*?</tr>', fix, tbl2, flags=re.S)
    s = s.replace(tbl, tbl2)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('quintile table compacted: header 5 -> 4 columns, rows merged:', n)
else:
    print('already compact (%d header columns); nothing changed' % len(ths))
