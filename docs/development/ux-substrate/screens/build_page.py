#!/usr/bin/env python3
"""Render ../layouts.html (design phase step 5, DEC-139): the screens, journeys and wizards, walked.
Builds the registry and library first (check_library.py), then inlines the visual language (DEC-138), the icons,
the data and the mockup scripts. Run: python3 docs/development/ux-substrate/screens/build_page.py"""
import json, os, re, subprocess, sys, html
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
VL = os.path.join(HERE, '..', 'visual-language')
if subprocess.call([sys.executable, os.path.join(HERE, 'check_library.py')], stdout=subprocess.DEVNULL): sys.exit('check_library.py failed')
subprocess.check_call([sys.executable, os.path.join(VL, 'build.py')])
P = lambda *f: open(os.path.join(*f)).read()
reg = json.load(open(os.path.join(HERE, 'registry.json')))
lib = json.load(open(os.path.join(HERE, 'library.json')))['scripts']
k = {'declared': 0, 'function': 0, 'owed': 0}
for s in reg['screens']:
    for a in s['acts']: k[a['status']] += 1
rows = ''.join(f"<tr><td>{html.escape(w['name'])}{' · <b>required</b>' if w['required'] else ''}</td><td>{len(w['versions'][0]['steps'])}</td><td>{html.escape(next(s['name'] for s in reg['screens'] if s['id']==w['start']))}</td><td>{', '.join(map(str, w['journeys'])) or '—'}</td></tr>" for w in lib)
summary = (f"<div class='cols2'><div class='cell'><h4>The screen registry</h4><p>{len(reg['screens'])} screens and {sum(len(s['acts']) for s in reg['screens'])} acts: "
  f"{k['declared']} acts the requirements already declare, {k['function']} named in the requirements whose act names the development process declares, "
  f"and {k['owed']} owed by your earlier rulings (who the group is, the website key, members' notes, languages and translations, asking for a check).</p></div>"
  f"<div class='cell'><h4>The wizard library</h4><p>{len(lib)} wizards, {sum(len(w['versions'][0]['steps']) for w in lib)} steps, {sum(w['required'] for w in lib)} required. "
  f"Every step says what to do and why in at most 300 characters, names a real screen and act, and places only labeled drafts. None names a place, a law or a venue.</p></div></div>"
  f"<div class='tw' style='margin-top:12px'><table class='tbl'><thead><tr><th>Wizard</th><th>Steps</th><th>Starts at</th><th>Journeys</th></tr></thead><tbody>{rows}</tbody></table></div>")
js = '\n'.join(P(HERE, f) for f in ('mock-acts.js', 'mock-kit.js', 'mock-screens.js', 'mock-shell.js', 'mock-refs.js', 'mock-journeys.js'))
page = P(HERE, 'page.src.html')
page = page.replace('{{FACES}}', P(VL, 'faces.css').replace('url("fonts/', 'url("visual-language/fonts/')).replace('{{CSS}}', P(VL, 'civicsmith.css'))
page = page.replace('{{SPRITE}}', P(VL, 'icons.svg')).replace('{{REGSUMMARY}}', summary).replace('{{QUESTION}}', P(HERE, 'question.html'))
page = page.replace('{{LIB}}', json.dumps(lib, ensure_ascii=False)).replace('{{REG}}', json.dumps(reg['screens'], ensure_ascii=False)).replace('{{JS}}', js)
import datetime
_commit = subprocess.run(['git', 'rev-parse', '--short=10', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip() or 'unknown'
_decs = [int(n) for f in os.listdir(HERE) if f.endswith('.src.py') for n in re.findall(r'DEC-(\d+)', P(HERE, f))]
version = f"Version: built from tranche {_commit} on {datetime.date.today().isoformat()}, through DEC-{max(_decs)}"
page = page.replace('{{VERSION}}', version)
assert '{{' not in page.replace('${{', '')
assert not re.search(r'viewBox="20 2 60 90"[^>]*>\s*<use href="#i-mark"', page), 'an <svg> using the plumb bob must take viewBox="0 0 60 90"'
open(os.path.join(HERE, '..', 'layouts.html'), 'w').write(page)
print('layouts.html', len(page), 'bytes')
