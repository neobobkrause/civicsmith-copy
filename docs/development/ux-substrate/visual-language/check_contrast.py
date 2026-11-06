#!/usr/bin/env python3
"""Check Civicsmith's color tokens against WCAG 2.2 AA (DEC-99, DEC-138).

Reads palette.json beside this file; prints every pair with its ratio and exits 1 if any text
pair is below 4.5:1 or any graphic pair below 3:1, in either theme. Also checks that
civicsmith.css carries exactly the palette's values. Graphic colours are checked against every
plain background in pairs.graphic_backgrounds (W1), and every focus outline keeps a 2px offset (W2). Run: python3 check_contrast.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def lum(hexc):
    h = hexc.lstrip('#')
    def ch(v):
        v = int(v, 16) / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(h[i:i+2]) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

def main():
    pal = json.load(open(os.path.join(HERE, 'palette.json')))
    fails = 0
    out = []
    for theme in ('light', 'dark'):
        t = pal[theme]
        for kind, need in (('text', 4.5), ('graphic', 3.0)):
            pairs = list(pal['pairs'][kind])
            if kind == 'graphic':
                # W1 (1.4.11: 3:1 against each adjacent colour): a graphic colour can sit on any of the plain
                # backgrounds, so each is checked against all of them, not only the background listed.
                for fg in dict.fromkeys(f for f, _ in pal['pairs']['graphic']):
                    for bg in pal['pairs'].get('graphic_backgrounds', []):
                        if [fg, bg] not in pairs: pairs.append([fg, bg])
            for fg, bg in pairs:
                r = ratio(t[fg], t[bg])
                ok = r >= need
                fails += not ok
                out.append(f"{theme:5} {kind:7} {fg:>15} on {bg:<14} {r:5.2f}  {'ok' if ok else 'FAIL (needs %.1f)' % need}")
    css = os.path.join(HERE, 'civicsmith.css')
    if os.path.exists(css):
        src = open(css).read()
        blocks = {'light': re.search(r':root\s*\{(.*?)\}', src, re.S).group(1),
                  'dark': re.search(r':root\[data-theme="dark"\][^{]*\{(.*?)\}', src, re.S).group(1)}
        for theme, body in blocks.items():
            found = dict(re.findall(r'--c-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})', body))
            for k, v in pal[theme].items():
                if found.get(k, '').upper() != v.upper():
                    fails += 1
                    out.append(f"{theme:5} css     --c-{k} is {found.get(k)!r}, palette.json says {v}")
    # W2 (2.4.7, 2.4.11): a focus ring is drawn outside the control (outline-offset of at least 2px), so it always
    # meets the background, never a fill of its own colour (--c-focus equals accent-strong, the primary button's fill).
    comp = os.path.join(HERE, 'components.css')
    if os.path.exists(comp):
        for rule in re.findall(r'[^{}]*:focus-visible[^{]*\{[^}]*\}', open(comp).read()):
            if 'outline:' not in rule: continue
            if re.search(r'outline:\s*none', rule):
                # an outline removed must be replaced by an indicator of its own (a bar, border or shadow)
                if not re.search(r'(background|box-shadow|border)[a-z-]*:', rule):
                    fails += 1
                    out.append(f"focus   a :focus-visible rule removes the outline and draws nothing instead: {rule.strip()[:80]}")
                continue
            m = re.search(r'outline-offset:\s*(\d+)px', rule)
            if not m or int(m.group(1)) < 2:
                fails += 1
                out.append(f"focus   a :focus-visible outline without an offset of 2px or more: {rule.strip()[:80]}")
    print('\n'.join(out))
    print(f"\n{'FAILED: %d' % fails if fails else 'All pairs meet WCAG 2.2 AA in both themes.'}")
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main())
