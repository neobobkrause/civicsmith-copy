#!/usr/bin/env python3
"""Render ../visual-language.html (design phase step 4, DEC-138) from page.src.html, inlining civicsmith.css,
faces.css and icons.svg, with the palette, icon grid and contrast table generated from the sources.
Run: python3 docs/development/ux-substrate/visual-language/build_page.py"""
import json, os, re, subprocess, sys, html
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
subprocess.check_call([sys.executable, os.path.join(HERE, 'build.py')])
from check_contrast import ratio
P = lambda f: open(os.path.join(HERE, f)).read()
pal = json.load(open(os.path.join(HERE, 'palette.json')))

ROLES = [
 ('ground', 'Working ground', 'the paper members work on'), ('ground-2', 'Masthead and band', 'the frame around the work'),
 ('surface', 'Surface', 'lists, panels, cards'), ('sheet', 'Published sheet', 'the published case; fields'),
 ('ink', 'Ink', 'all text that matters'), ('ink-2', 'Soft ink', 'secondary text'), ('muted', 'Muted', 'captions, labels'),
 ('rule', 'Rule', 'hairlines between things'), ('rule-strong', 'Strong rule', 'field edges, outlines'),
 ('accent', 'Verdigris', 'Civicsmith, links, the act you can take'), ('accent-tint', 'Verdigris tint', 'accepted, the wizard'),
 ('signal', 'Rust', 'attention only: overdue, changed, refused, outward'), ('signal-tint', 'Rust tint', 'a review band, a refusal'),
 ('capture', 'Capture', 'how trustworthy our copy is'), ('connection', 'Connection', 'how firmly a link is shown'),
 ('testimony', 'Testimony', "a person's own account"), ('subject', 'Subject match', 'is this document about them'),
 ('stage', 'Project stage', 'the stage ladder'), ('ready', 'Case readiness', 'the readiness ladder'), ('ident', 'Source identity', 'the identity ladder'),
 ('machine', 'Machine work', 'the assistant, hints, drafts'), ('elsewhere', "Another group's", 'imported cases and findings'),
]
sw = ['<div class="sw">']
for k, name, role in ROLES:
    l, d = pal['light'][k], pal['dark'][k]
    sw.append(f'<div><div class="chip"><i style="background:{l}"></i><i style="background:{d}"></i></div><div class="txt"><b>{name}</b><span>{html.escape(role)}</span><span class="id">{l} · {d}</span></div></div>')
sw.append('</div>')

sprite = P('icons.svg')
ids = re.findall(r'<symbol id="i-([a-z]+)"', sprite)
groups = re.findall(r'<!-- (.*?) -->\s*<symbol id="i-([a-z]+)"', sprite)
gstart = {sym: g for g, sym in groups}
NAMES = {'mark':'The plumb bob','capture':'Capture','connection':'Connection','testimony':'Testimony','subject':'Subject; a person','undetermined':'Undetermined','withheld':'Withheld','standard':'A standard (DEC-308)','unrated':'Unrated','nobody':'Nobody looked','refused':'Refused','machine':'Machine work','elsewhere':"Another group's",'accepted':'Accepted','unevaluated':'Not yet evaluated','flagged':'Flagged','todo':'To do','noticed':'Noticed','status':'Status','hint':'Hint','hunch':'Hunch','wizard':'Wizard','outward':'Outward','signed':'Signed','hold':'Held together','changed':'Changed; newer version','clock':'Due date','tension':'In tension','question':'Question','finding':'Finding','case':'Case','plan':'Plan','timeline':'Timeline','money':'Money','queue':'Queue','home':'Home','project':'Project','search':'Search','add':'Add','settings':'Settings','group':'Group; members','close':'Close','next':'Next','back':'Back','camera':'Capture a photo','expand':'Widen','dock':'Dock','document':'A document','due':'A date that falls due; a checkpoint','sever':'A link let go'}
ic = ['<div class="icons">']
for i in ids:
    if i == 'mark': continue
    if i in gstart: ic.append(f'<div class="group">{html.escape(gstart[i])}</div>')
    ic.append(f'<div><svg aria-hidden="true"><use href="#i-{i}"/></svg>{html.escape(NAMES.get(i, i))}</div>')
ic.append('</div>')

rows = []
for kind, need in (('text', 4.5), ('graphic', 3.0)):
    for fg, bg in pal['pairs'][kind]:
        rl, rd = ratio(pal['light'][fg], pal['light'][bg]), ratio(pal['dark'][fg], pal['dark'][bg])
        rows.append(f'<tr><td>{fg} on {bg}</td><td>{"text" if kind=="text" else "lines and marks"} · needs {need:g}</td><td>{rl:.2f} <span class="ok">✓</span></td><td>{rd:.2f} <span class="ok">✓</span></td></tr>')
ct = '<div class="tw" style="margin-top:12px;max-height:420px;overflow:auto"><table class="tbl" style="min-width:560px"><thead><tr><th>Pairing</th><th>Standard</th><th>Light</th><th>Dark</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'

page = P('page.src.html')
page = page.replace('{{FACES}}', P('faces.css').replace('url("fonts/', 'url("visual-language/fonts/')).replace('{{CSS}}', P('civicsmith.css')).replace('{{SPRITE}}', sprite)
page = page.replace('{{SWATCHES}}', '\n'.join(sw)).replace('{{ICONS}}', '\n'.join(ic)).replace('{{CONTRAST}}', ct)
page = re.sub(r'\{i:([a-z]+)\}', lambda m: f'<svg class="i" aria-hidden="true"><use href="#i-{m.group(1)}"/></svg>', page)
assert '{{' not in page and '{i:' not in page
assert not re.search(r'viewBox="20 2 60 90"[^>]*>\s*<use href="#i-mark"', page), 'an <svg> using the plumb bob must take viewBox="0 0 60 90"'
missing = set(re.findall(r'href="#i-([a-z]+)"', page)) - set(ids)
assert not missing, missing
open(os.path.join(HERE, '..', 'visual-language.html'), 'w').write(page)
print('visual-language.html', len(page), 'bytes;', len(ids), 'icons;', len(rows), 'pairs')
