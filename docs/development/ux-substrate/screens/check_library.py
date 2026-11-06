#!/usr/bin/env python3
"""Build and check the screen registry and the Civicsmith wizard library (design phase step 5, DEC-139).

Writes registry.json and library.json from registry.src.py and library.src.py, then checks:
  the registry: every act is an op already declared in the requirements (op=...), a requirement function whose op is
    declared by its lowercased name, or an `owed:` act citing the ruling that owes it; anything else fails;
  the library: wizard-scripts R1, R2 and R12 as far as they can be judged without the plane: at least one step; a known
    screen; an act the screen lists, or none; `what` and `why` of 1-300 characters; a draft of one of R2's three kinds;
    no draft placed on an act the machine is refused (affordances R7); `start` is the first step's screen; `required`
    only in the Civicsmith library; a side trip names a script in the library; R12's warnings (one step; duplicates).
Usage: python3 check_library.py [--ref origin/main]   (the git ref whose build/requirements is read)
Exit 1 on any failure.
"""
import json, os, re, subprocess, sys, tarfile, io
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=HERE, text=True).strip()

# affordances R7: the acts whose method refuses a machine by name; a script's draft is never placed on one (R12)
MACHINE_REFUSALS = {'release', 'conclude', 'withdrawconclusion', 'reopen', 'publish', 'inquirydivide', 'inquiryground',
                    'actionmove', 'actioncorrespond', 'actionlaws', 'actionrisktier', 'versionaccept', 'versionreject',
                    'versionconsider', 'versionrevert', 'versionhide', 'versioncurrent', 'contradictionresolve'}
MACHINE_DRAFTS = {'whatchangedpropose', 'escalationreasondraft'}  # wizard-scripts R13
# Served through a door rather than declared as op=… in a requirement, as BOB states in B149 (T46's HANDOFF):
SERVED_BY_DOOR = {'ask': 'the plane\'s ask door, agent-worker R54', 'subscriptionsignin': 'control-plane R65',
                  'infolevelset': 'instance-setup R79 (T46)', 'projectaikeepaway': 'op-declarations R41 (BOB\'s B172: declared and served, T47)',
                  'linewithdraw': 'lines R8 (op linewithdraw, served by the lines module and listed open in op-declarations; its module row has no classes object the check reads)',
                  'standardinforcethroughwithdraw': 'standards R51 (op standardinforcethroughwithdraw, routed by store-request and listed in op-declarations\' standards row, which has no classes object the check reads; DEC-438)',
                  'standardimpose': 'standards R43 (op standardimpose, impositionRecord; listed as standardinforcethroughwithdraw is; DEC-438)',
                  'standardbenchmark': 'standards R43 (op standardbenchmark, benchmarkDeclare; listed as standardinforcethroughwithdraw is; DEC-438)'}

def op_universe(ref):
    try:
        data = subprocess.check_output(['git', 'archive', ref, 'build/requirements'], cwd=ROOT)
    except subprocess.CalledProcessError:
        print(f'note: {ref} is not in this checkout; checking against HEAD instead (fetch it for the intended check)', file=sys.stderr)
        ref = 'HEAD'
        data = subprocess.check_output(['git', 'archive', ref, 'build/requirements'], cwd=ROOT)
    declared, functions = {}, {}
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        for m in t.getmembers():
            if not m.name.endswith('.md'): continue
            mod = os.path.basename(m.name)[:-3]
            txt = t.extractfile(m).read().decode('utf-8', 'replace')
            for o in re.findall(r'op=([a-z]+)', txt): declared.setdefault(o, set()).add(mod)
            for f in re.findall(r'\b([a-z][a-zA-Z0-9]+)\(\{', txt): functions.setdefault(f.lower(), set()).add(mod)
    # An op declared in op-declarations (the plane's one table of ops) counts as declared even where its module's
    # requirements name only the function (intent's setCondition is op objectivecondition; DEC-374, B398 C46).
    try:
        od = subprocess.check_output(['git', 'show', ref + ':bio-plane/src/op-declarations/index.mjs'], cwd=ROOT, stderr=subprocess.DEVNULL).decode('utf-8', 'replace')
        for o in re.findall(r'^  ([a-z]+):\s+\{\s*classes', od, re.M): declared.setdefault(o, set()).add('op-declarations')
    except subprocess.CalledProcessError:
        pass
    return ref, declared, functions

def load(src, name):
    g = {}
    exec(compile(open(os.path.join(HERE, src)).read(), src, 'exec'), g)
    return g[name]

def main():
    ref = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else 'origin/main'
    ref, declared, functions = op_universe(ref)
    # An act served by the open tranche but not yet on the ref (the design stream works ahead of main): the newest
    # origin/tranche/T<n> branch is consulted for acts the ref lacks, and each such act is marked with that branch.
    tranches = subprocess.run(['git', 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/tranche/'],
                              cwd=ROOT, capture_output=True, text=True).stdout.split()
    tranches = sorted((r for r in tranches if re.fullmatch(r'origin/tranche/T\d+', r)), key=lambda r: int(r.rsplit('T', 1)[1]))
    # Process3 keeps one open tranche, branch `tranche` (6 Nov 2026); the numbered tranche/T<n> branches are older.
    if subprocess.run(['git', 'rev-parse', '-q', '--verify', 'refs/remotes/origin/tranche'], cwd=ROOT, capture_output=True).returncode == 0:
        tranches.append('origin/tranche')
    ahead = op_universe(tranches[-1]) if tranches and tranches[-1] != ref else None
    screens, lib = load('registry.src.py', 'S'), load('library.src.py', 'L')
    fails, warns, owed = [], [], {}
    g2 = {}; exec(compile(open(os.path.join(HERE, 'library.src.py')).read(), 'library.src.py', 'exec'), g2)
    byname = {w['name']: w for w in lib}
    doors = []
    for d in g2.get('DOORS', []):
        door, names = d[0], d[1]
        for n in names:
            if n not in byname: fails.append(f'front door {door!r}: no wizard named {n!r}')
            elif byname[n]['required']: fails.append(f'front door {door!r}: {n!r} is required, so not offered (wizard-scripts R23)')
        doors.append({'door': door, 'scripts': [byname[n]['id'] for n in names if n in byname], **({'opens': d[2]} if len(d) > 2 else {})})
    acts_of, kinds = {}, {'declared': 0, 'function': 0, 'owed': 0}
    for s in screens:
        acts_of[s['id']] = {a['op'] for a in s['acts']}
        for a in s['acts']:
            op = a['op']
            if op.startswith('owed:'):
                if not re.search(r'\b(DEC|K)-?\d+', op): fails.append(f"registry {s['id']}: {op} names no ruling")
                kinds['owed'] += 1; owed.setdefault(op, set()).add(s['id']); a['status'] = 'owed'
            elif op in declared: kinds['declared'] += 1; a['status'] = 'declared'; a['modules'] = sorted(declared[op])
            elif op in functions: kinds['function'] += 1; a['status'] = 'function'; a['modules'] = sorted(functions[op])
            elif ahead and (op in ahead[1] or op in ahead[2]):
                kinds['declared'] += 1; a['status'] = 'declared'; a['onTranche'] = ahead[0]
                a['modules'] = sorted(ahead[1].get(op) or ahead[2].get(op))
            elif op in SERVED_BY_DOOR: kinds['declared'] += 1; a['status'] = 'declared'; a['servedBy'] = SERVED_BY_DOOR[op]
            else: fails.append(f"registry {s['id']}: act {op!r} is no op or requirement function at {ref}")
    if len({s['id'] for s in screens}) != len(screens): fails.append('registry: duplicate screen id')
    names = {w['name'] for w in lib}
    seen_lists = {}
    for w in lib:
        steps = w['versions'][0]['steps']
        tag = f"wizard {w['name']!r}"
        if not steps: fails.append(f'{tag}: WIZARD_NO_STEPS'); continue
        if len(steps) == 1: warns.append(f'{tag}: WIZARD_TRIVIAL')
        if w['start'] != steps[0]['screen']: fails.append(f"{tag}: start {w['start']!r} is not its first step's screen")
        if w['required'] and w['origin'] != 'civicsmith': fails.append(f'{tag}: required outside the Civicsmith library')
        if not 1 <= len(w['name']) <= 200: fails.append(f'{tag}: WIZARD_NAME_REFUSED')
        pairs = tuple((st['screen'], st['act']) for st in steps)
        if pairs in seen_lists: warns.append(f"{tag}: WIZARD_DUPLICATE of {seen_lists[pairs]!r}")
        seen_lists[pairs] = w['name']
        for i, st in enumerate(steps, 1):
            at = f'{tag} step {i}'
            if st['screen'] not in acts_of: fails.append(f"{at}: WIZARD_SCREEN_UNKNOWN {st['screen']!r}"); continue
            if st['act'] is not None and st['act'] not in acts_of[st['screen']]: fails.append(f"{at}: WIZARD_ACT_UNKNOWN {st['act']!r} on {st['screen']!r}")
            for k in ('what', 'why'):
                if not 1 <= len(st[k]) <= 300: fails.append(f'{at}: {k} is {len(st[k])} characters (1-300)')
            if not st['why'].strip(): fails.append(f'{at}: WIZARD_STEP_NO_WHY')
            d = st.get('draft')
            if d is not None:
                if len(d) != 1 or next(iter(d)) not in ('text', 'template', 'machine'): fails.append(f'{at}: WIZARD_DRAFT_REFUSED {d}')
                elif 'text' in d and len(d['text']) > 4000: fails.append(f'{at}: draft text over 4,000 characters')
                elif 'machine' in d and d['machine'] not in MACHINE_DRAFTS: fails.append(f'{at}: WIZARD_DRAFT_REFUSED machine {d["machine"]!r}')
                act = (st['act'] or '')
                if act in MACHINE_REFUSALS and not ('machine' in d and d['machine'] in MACHINE_DRAFTS): fails.append(f'{at}: WIZARD_STEP_CONCLUDES on {act!r}')
            if st.get('via') and st['via'] not in names: fails.append(f"{at}: side trip to unknown wizard {st['via']!r}")
            if st['act'] and st['act'].startswith('owed:'): owed.setdefault(st['act'], set()).add('wizard: ' + w['name'])
    json.dump({'_note': 'GENERATED by check_library.py from registry.src.py (DEC-139). The screen registry wizard-scripts R13 registers: '
               'each act is declared (an op), function (a requirement function whose op BOB declares by its lowercased name) or owed (a ruling owes it).',
               'checkedAgainst': ref, 'screens': screens}, open(os.path.join(HERE, 'registry.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump({'_note': 'GENERATED by check_library.py from library.src.py (DEC-139). The Civicsmith wizard library (DEC-121 (9)); '
               'each script in wizard-scripts R1/R2 shape; `via` (a side trip) and `journeys`/`note` are owed additions to R2 and design notes.',
               'approved': 'Bob, 2026-10-06 (DEC-148)', 'scripts': lib, 'doors': doors}, open(os.path.join(HERE, 'library.json'), 'w'), indent=1, ensure_ascii=False)
    print(f"checked against {ref}: {len(screens)} screens, {sum(len(s['acts']) for s in screens)} acts "
          f"({kinds['declared']} declared ops, {kinds['function']} requirement functions, {kinds['owed']} owed); "
          f"{len(lib)} wizards, {sum(len(w['versions'][0]['steps']) for w in lib)} steps, {sum(w['required'] for w in lib)} required")
    for o, where in sorted(owed.items()): print(f'  owed: {o}  ({", ".join(sorted(where))})')
    for x in warns: print('  warning:', x)
    for x in fails: print('  FAIL:', x)
    print('FAILED' if fails else 'All checks pass.')
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main())
