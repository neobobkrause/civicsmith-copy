import json, html, re
S = "/tmp/claude-0/-home-user-bio/c4522ba1-57f2-5222-b1d8-fe77a0d83037/scratchpad/"
d = json.load(open(S + "ux-substrate.json"))
e = lambda s: html.escape(str(s or ""), quote=True)
C = {c["id"]: c for c in d["constructs"]}

LAYERS = {2: "Record and authority", 3: "Intake and provenance", 4: "Content", 5: "Meaning, bias and retrieval",
          6: "Inquiry and the assistant", 7: "Understanding", 8: "Publication", 9: "Action", 10: "Operations",
          11: "Interface and distribution"}
MAT = {"built": ("built", "Built"), "built, gaps": ("gaps", "Built, with gaps"),
       "specified, not built": ("spec", "Specified, not built"), "beyond MVP": ("beyond", "Beyond MVP")}

def mid(i): return re.sub(r"[^A-Za-z0-9]", "_", i)
def mlabel(s): return str(s).replace('"', "'").replace("(", "").replace(")", "")

# ---- whole map (mermaid, grouped by layer) ----
lines = ["flowchart LR"]
for L in sorted(LAYERS):
    members = [c for c in d["constructs"] if c["layer"] == L]
    if not members: continue
    lines.append(f'  subgraph L{L}["{L} · {LAYERS[L]}"]')
    for c in members:
        short = c["name"].split(" (")[0]
        lines.append(f'    {mid(c["id"])}["{mlabel(short)}"]:::{MAT.get(c["maturity"], ("gaps",))[0]}')
    lines.append("  end")
for r in d["relationships"]:
    if r["from"] in C and r["to"] in C:
        lines.append(f'  {mid(r["from"])} -- "{mlabel(r["verb"])}" --> {mid(r["to"])}')
lines += ["  classDef built fill:#dcefe4,stroke:#2f7a52,color:#13301f",
          "  classDef gaps fill:#f6ead0,stroke:#a8741a,color:#3a2806",
          "  classDef spec fill:#eceef1,stroke:#6b7280,stroke-dasharray:4 3,color:#262b33",
          "  classDef beyond fill:#ebe4f5,stroke:#6d4fa3,color:#2a1b45"]
whole_map = "\n".join(lines)

spine = """flowchart LR
  doc["Document and its captures"] --> read["Reading"] --> pas["Passage"]
  pas --> leg["Support (leg)"]
  leg --> q["Question (inquiry)"]
  q --> bv["Account of support (basis version)"]
  bv --> prj["Project concludes it"]
  prj --> fnd["Finding"]
  fnd --> cs["Case and edition"]
  cs --> pub["Published"]
  pub --> det["Determination against a standard"]
  det --> act["Action or filing"]
  act --> mon["Watch: deadlines and response"]
  st["Standard"] --> det
  str["Strength and the bar"] -.->|grades| q
  bias["Declared bias and hunch debt"] -.->|weighs| str
  obs["Looks: who looked, what was found"] -.->|frontier| q
  ai["Assistant run"] -.->|finds and checks; never concludes| leg
  mon -.->|notices| qu["Queue: everything waiting on a member"]
  q -.->|items| qu
"""

def chips(states):
    return '<ol class="states">' + "".join(
        f'<li><span class="st">{e(s["name"])}</span><span class="sm">{e(s.get("meaning"))}</span></li>' for s in states) + "</ol>"

def card(c):
    m, ml = MAT.get(c["maturity"], ("gaps", c["maturity"]))
    acts = "".join(
        f'<tr><td>{e(a["name"])}{(" <code>op=" + e(a["op"]) + "</code>") if a.get("op") else ""}'
        f'{("<div class=note>" + e(a["note"]) + "</div>") if a.get("note") else ""}</td>'
        f'<td>{e(a.get("who"))}</td><td class=src>{e(a.get("src"))}</td></tr>' for a in c.get("acts", []))
    trans = "".join(
        f'<tr><td><span class="st">{e(t["from"])}</span> → <span class="st">{e(t["to"])}</span></td><td>{e(t["act"])}</td>'
        f'<td>{e(t.get("who"))}</td><td class=src>{e(t.get("src"))}</td></tr>' for t in c.get("transitions", []))
    rels = [r for r in d["relationships"] if c["id"] in (r["from"], r["to"])]
    rel = "".join(
        f'<li>{e(C.get(r["from"], {"name": r["from"]})["name"])} <b>{e(r["verb"])}</b> {e(C.get(r["to"], {"name": r["to"]})["name"])}'
        f' <span class=card>{e(r.get("cardinality"))}</span>{(" · " + e(r["note"])) if r.get("note") else ""}</li>' for r in rels)
    kf = ", ".join(e(k) for k in c.get("keyFields", []))
    return f'''<details class="con" id="c-{e(c["id"])}">
<summary><span class="cname">{e(c["name"])}</span><span class="pill {m}">{ml}</span>
<span class="cdef">{e(c["plainDefinition"])}</span></summary>
<div class="cbody">
<p class="meta">Module <code>{e(c["module"])}</code> · Sources: <span class=src>{e(c.get("src"))}</span></p>
{("<p><b>What a member sees:</b> " + kf + "</p>") if kf else ""}
{("<p><b>Shown as:</b> " + e(c["shownAs"]) + "</p>") if c.get("shownAs") else ""}
<h4>Lifecycle</h4>{chips(c.get("states", []))}
{("<div class=tw><table><thead><tr><th>Move</th><th>Act</th><th>Who</th><th>Source</th></tr></thead><tbody>" + trans + "</tbody></table></div>") if trans else ""}
{("<h4>Acts</h4><div class=tw><table><thead><tr><th>Act</th><th>Who may</th><th>Source</th></tr></thead><tbody>" + acts + "</tbody></table></div>") if acts else ""}
{("<h4>Relationships</h4><ul class=rels>" + rel + "</ul>") if rel else ""}
</div></details>'''

cat = ""
for L in sorted(LAYERS):
    cs = [c for c in d["constructs"] if c["layer"] == L]
    if not cs: continue
    cat += f'<section class="layer"><h3><span class="ln">{L}</span>{e(LAYERS[L])}</h3>' + "".join(card(c) for c in cs) + "</section>"

journeys = ""
for j in d["journeys"]:
    steps = "".join(
        f'<li><div class="who">{e(s["actor"])}</div><div class="what">{e(s["act"])}</div>'
        f'<div class="res"><a href="#c-{e(s.get("construct"))}">{e(C.get(s.get("construct"), {"name": s.get("construct")})["name"])}</a> → {e(s.get("result"))}</div>'
        f'<div class="src">{e(s.get("src"))}</div></li>' for s in j["steps"])
    journeys += f'<article class="journey"><h3>{e(j["name"])}</h3><ol class="steps">{steps}</ol></article>'

roles = "".join(
    f'<tr><th scope=row>{e(r["name"])}</th><td><ul>{"".join("<li>"+e(x)+"</li>" for x in r.get("can", []))}</ul></td>'
    f'<td><ul>{"".join("<li>"+e(x)+"</li>" for x in r.get("cannot", []))}</ul></td><td class=src>{e(r.get("src"))}</td></tr>'
    for r in d["roles"])
prims = "".join(
    f'<div class="prim"><h4>{e(p["name"])}</h4><p>{e(p["meaning"])}</p><p class="where"><b>Where:</b> {e(p.get("where"))}</p><p class=src>{e(p.get("src"))}</p></div>'
    for p in d["displayPrimitives"])
flux = "".join(f'<tr><td>{e(f["what"])}</td><td>{e(f.get("why"))}</td><td class=src>{e(f.get("ids"))}</td></tr>' for f in d["inFlux"])
legacy = "".join(f"<li>{e(x)}</li>" for x in d["legacyUiDivergence"])

REC = {
 "'Rung ladder' names two different things": ("Keep <b>rung</b> for the weight of an act (reversible, reasoned, terminal, attested, irreversible), as affordances and Interaction Constructs use it, since that is what a member sees on every button. Call the sequence release → stand behind → ground → conclude → accept → ratify → publish the <b>path to publication</b>, and I correct System Design and Publication to match.", True),
 "'Finding' is overloaded": ("Keep <b>finding</b> for a concluded question (Case Making, DEC-72). Show the queue's FINDING class to members as <b>Noticed</b>, for something the record noticed that nobody has judged. The code name can stay; only the member-facing word changes.", True),
 "Capture grade A": ("Not a contradiction: Grade A is the web-archive (WACZ) capture, and no route builds one yet. Keep A in the doctrine, and show it in the UX as the ceiling a group can reach, never as a grade awarded today. No decision needed unless you want WACZ capture scheduled.", False),
 "Legacy 'focus/problem' and case-as-phase": ("Old canon text beside its DEC-72 amendment. Mine to tidy: I mark the superseded paragraph in Case Making so the redesign does not read it as current.", False),
 "Layer-9 status marks": ("Bookkeeping, mine: the six Action-layer modules were built in T8, but their requirement files still say every id is unmet. T11's jobs confirm each against its tests and strike the marks.", False),
}
qs = ""
for x in d["contradictions"]:
    rec, bobs = REC.get(x["what"], ("", False))
    qs += f'''<article class="q {"bob" if bobs else "mine"}"><div class="qh"><h3>{e(x["what"])}</h3><span class="pill {"askb" if bobs else "done"}">{"For Bob" if bobs else "BOB handles"}</span></div>
<dl><dt>Canon says</dt><dd>{e(x["canon"])}</dd><dt>Requirements say</dt><dd>{e(x["requirements"])}</dd></dl>
<p class="rec"><b>{"Recommendation" if bobs else "What happens"}:</b> {rec}</p><p class=src>{e(x.get("src"))}</p></article>'''
qs += '''<article class="q bob"><div class="qh"><h3>A project's own lifecycle</h3><span class="pill askb">For Bob</span></div>
<dl><dt>Canon says</dt><dd>State Rules §4.3: a project moves forming → investigating → matured → closed, with work-product readiness.</dd><dt>Requirements say</dt><dd>No module states it. A project today is joined, owned and holds questions; it has no stage a member can see.</dd></dl>
<p class="rec"><b>Recommendation:</b> Bring the four stages into the project's requirements in T12, as a derived display (computed from the questions it holds and what it has published), not a switch someone flips. The redesign will want a project's stage on its home screen.</p><p class=src>State Rules §4.3; membership (projects)</p></article>'''

counts = {k: sum(1 for c in d["constructs"] if c["maturity"] == k) for k in MAT}

page = f'''<title>CivicOS UX Substrate</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a working atlas. A top index, then one long page of sections; the constructs fold open where detail is needed. */
:root {{
  --bg:#f3f5f4; --panel:#ffffff; --ink:#18212b; --muted:#566271; --rule:#d5dbe0; --accent:#1d5b8a; --accent-2:#e3edf5;
  --built:#2f7a52; --built-bg:#dcefe4; --gaps:#9a6a14; --gaps-bg:#f6ead0; --spec:#5f6772; --spec-bg:#eceef1; --beyond:#6d4fa3; --beyond-bg:#ebe4f5;
  --bob:#9b3b24; --bob-bg:#f7e4dd;
  --f-display:"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif; --f-body:"Public Sans", "Segoe UI", system-ui, sans-serif; --f-mono:"IBM Plex Mono", ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#121820; --panel:#19212b; --ink:#e4e9ee; --muted:#9aa6b3; --rule:#2c3643; --accent:#7fb3dc; --accent-2:#1f2d3b;
  --built:#7cc79e; --built-bg:#183326; --gaps:#e0b25c; --gaps-bg:#3a2d12; --spec:#a9b1bb; --spec-bg:#262d36; --beyond:#b9a1e6; --beyond-bg:#2b2240;
  --bob:#f09a82; --bob-bg:#3d2019; color-scheme:dark }} }}
:root[data-theme="dark"] {{
  --bg:#121820; --panel:#19212b; --ink:#e4e9ee; --muted:#9aa6b3; --rule:#2c3643; --accent:#7fb3dc; --accent-2:#1f2d3b;
  --built:#7cc79e; --built-bg:#183326; --gaps:#e0b25c; --gaps-bg:#3a2d12; --spec:#a9b1bb; --spec-bg:#262d36; --beyond:#b9a1e6; --beyond-bg:#2b2240;
  --bob:#f09a82; --bob-bg:#3d2019; color-scheme:dark }}
body {{ background:var(--bg); color:var(--ink); font:15px/1.55 var(--f-body); }}
.wrap {{ max-width:1180px; margin:0 auto; padding-inline:20px; padding-block:28px 64px; }}
h1,h2,h3 {{ font-family:var(--f-display); text-wrap:balance; line-height:1.15; }}
h1 {{ font-size:clamp(28px,4vw,42px); margin:0 0 6px; font-weight:700; letter-spacing:-.01em }}
h2 {{ font-size:24px; margin:48px 0 8px; font-weight:700; border-top:2px solid var(--ink); padding-top:14px }}
h3 {{ font-size:18px; margin:0 0 8px; font-weight:600 }}
h4 {{ font:600 12px/1.3 var(--f-body); text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:16px 0 6px }}
p {{ max-width:72ch }}
.lede {{ font-size:17px; color:var(--muted); max-width:72ch }}
code {{ font:13px var(--f-mono) }}
.src {{ font:12px/1.4 var(--f-mono); color:var(--muted) }}
nav.idx {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:5; background:var(--bg); border-bottom:1px solid var(--rule); padding:10px 0; display:flex; flex-wrap:wrap; gap:6px 16px; font-weight:600; font-size:14px }}
nav.idx a {{ color:var(--accent); text-decoration:none }} nav.idx a:hover, nav.idx a:focus-visible {{ text-decoration:underline }}
.stats {{ display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 }}
.pill {{ display:inline-block; font:600 11px/1 var(--f-body); letter-spacing:.06em; text-transform:uppercase; padding:5px 8px; border-radius:3px; white-space:nowrap }}
.pill.built {{ background:var(--built-bg); color:var(--built) }} .pill.gaps {{ background:var(--gaps-bg); color:var(--gaps) }}
.pill.spec {{ background:var(--spec-bg); color:var(--spec); outline:1px dashed var(--spec) }} .pill.beyond {{ background:var(--beyond-bg); color:var(--beyond) }}
.pill.askb {{ background:var(--bob-bg); color:var(--bob) }} .pill.done {{ background:var(--spec-bg); color:var(--spec) }}
.diagram {{ background:var(--panel); border:1px solid var(--rule); padding:16px; overflow-x:auto; margin:12px 0 }}
.diagram pre {{ margin:0; min-width:720px }}
.layer {{ margin-top:22px }}
.layer h3 {{ display:flex; align-items:baseline; gap:10px }} .ln {{ font:500 13px var(--f-mono); color:var(--accent); border:1px solid var(--accent); padding:1px 6px; border-radius:3px }}
details.con {{ background:var(--panel); border:1px solid var(--rule); border-radius:4px; margin:8px 0 }}
details.con > summary {{ cursor:pointer; padding:12px 14px; display:grid; grid-template-columns:1fr auto; gap:4px 12px; list-style:none }}
details.con > summary::-webkit-details-marker {{ display:none }}
details.con > summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px }}
.cname {{ font-weight:600; font-size:16px }} .cdef {{ grid-column:1/-1; color:var(--muted); font-size:14px }}
details.con[open] > summary {{ border-bottom:1px solid var(--rule) }}
.cbody {{ padding:4px 14px 16px; min-width:0 }} .meta {{ font-size:13px; color:var(--muted) }}
ol.states {{ list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:6px }}
ol.states li {{ display:flex; flex-direction:column; border:1px solid var(--rule); border-radius:3px; padding:6px 9px; max-width:260px; background:var(--bg) }}
ol.states li + li::before {{ content:"→"; color:var(--muted); font-size:12px }}
.st {{ font:500 13px var(--f-mono); color:var(--accent) }} .sm {{ font-size:12.5px; color:var(--muted) }}
.tw {{ overflow-x:auto; margin-top:8px }}
table {{ border-collapse:collapse; width:100%; font-size:13.5px }} th, td {{ text-align:left; vertical-align:top; padding:7px 8px; border-bottom:1px solid var(--rule) }}
thead th {{ font:600 11px var(--f-body); text-transform:uppercase; letter-spacing:.07em; color:var(--muted) }}
td ul, th ul {{ margin:0; padding-left:18px }} .note {{ font-size:12.5px; color:var(--muted) }}
ul.rels {{ margin:0; padding-left:18px; font-size:14px }} .card {{ font:12px var(--f-mono); color:var(--muted) }}
.journeys {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr)); gap:18px }}
.journey {{ background:var(--panel); border:1px solid var(--rule); border-radius:4px; padding:16px; min-width:0 }}
ol.steps {{ margin:0; padding-left:26px; display:grid; gap:10px }} ol.steps li::marker {{ font:600 13px var(--f-mono); color:var(--accent) }}
.who {{ font:600 12px var(--f-body); text-transform:uppercase; letter-spacing:.06em; color:var(--muted) }}
.what {{ font-weight:600 }} .res {{ font-size:14px }} .res a {{ color:var(--accent) }}
.prims {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr)); gap:12px }}
.prim {{ border-top:3px solid var(--accent); background:var(--panel); padding:12px 14px; min-width:0 }} .prim h4 {{ color:var(--ink); text-transform:none; letter-spacing:0; font-size:15px; margin:0 0 4px }} .prim p {{ margin:4px 0; font-size:14px }}
.where {{ color:var(--muted) }}
.qs {{ display:grid; gap:14px }}
.q {{ background:var(--panel); border:1px solid var(--rule); border-left:4px solid var(--spec); padding:14px 16px; border-radius:3px }} .q.bob {{ border-left-color:var(--bob) }}
.qh {{ display:flex; justify-content:space-between; gap:12px; align-items:baseline; flex-wrap:wrap }}
dl {{ display:grid; grid-template-columns:max-content 1fr; gap:4px 14px; margin:8px 0; font-size:14px }} dt {{ font-weight:600; color:var(--muted) }} dd {{ margin:0 }}
.rec {{ background:var(--accent-2); padding:10px 12px; border-radius:3px; font-size:14.5px; max-width:none }}
.legend {{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; font-size:13px; color:var(--muted) }}
@media (max-width:560px) {{ dl {{ grid-template-columns:1fr }} details.con > summary {{ grid-template-columns:1fr }} }}
@media (prefers-reduced-motion:reduce) {{ * {{ scroll-behavior:auto }} }}
</style>
<div class="wrap">
<header>
<p class="src">CivicOS · believeinoakland/bio · tranche/T10 @ {e(d["meta"]["commit"])} · {e(d["meta"]["written"])}</p>
<h1>The UX substrate</h1>
<p class="lede">What a member of a CivicOS group sees and works with, as the approved requirements define it: {len(d["constructs"])} constructs, how they relate, how each one moves through its life, who may act on it, and the paths through the work. The redesign builds on this. Where the old interface differs, the requirements win.</p>
<div class="stats">
<span class="pill built">{counts["built"]} built</span><span class="pill gaps">{counts["built, gaps"]} built, with gaps</span><span class="pill spec">{counts["specified, not built"]} specified, not built</span>
<span class="pill askb">3 questions for Bob</span></div>
</header>
<nav class="idx" aria-label="Sections"><a href="#spine">The spine</a><a href="#map">Full map</a><a href="#constructs">Constructs</a><a href="#journeys">Paths</a><a href="#roles">Who may act</a><a href="#display">Display primitives</a><a href="#flux">In flux</a><a href="#questions">Questions</a><a href="#legacy">Old interface</a></nav>

<h2 id="spine">The spine</h2>
<p>The one path everything else hangs off: material enters with its provenance, is read, and is cited by a question. A project concludes the question on one account of its support, and the finding is published. The group then acts on it and watches for the response. Dotted lines are the things that weigh, grade or feed that path.</p>
<div class="diagram"><pre class="mermaid">{e(spine)}</pre></div>

<h2 id="map">Full construct map</h2>
<p>Every construct, grouped by the architecture layer that owns it, with every relationship the requirements state. Each box is coloured by maturity.</p>
<p class="legend"><span class="pill built">Built</span><span class="pill gaps">Built, with gaps</span><span class="pill spec">Specified, not built</span> Scroll sideways inside the frame.</p>
<div class="diagram"><pre class="mermaid">{e(whole_map)}</pre></div>

<h2 id="constructs">Constructs</h2>
<p>Open any construct for its lifecycle, the acts on it and who may take them, and what it relates to. Every line cites the requirement or design section it comes from.</p>
{cat}

<h2 id="journeys">Paths through the work</h2>
<p>The main sequences a group follows, step by step, with the construct each step touches.</p>
<div class="journeys">{journeys}</div>

<h2 id="roles">Who may act</h2>
<div class="tw"><table><thead><tr><th>Role</th><th>Can</th><th>Cannot</th><th>Source</th></tr></thead><tbody>{roles}</tbody></table></div>

<h2 id="display">Display primitives</h2>
<p>The small set of ways the product shows certainty, absence, weight and restriction. Each should look the same everywhere it appears.</p>
<div class="prims">{prims}</div>

<h2 id="flux">In flux</h2>
<p>What could still change what a member sees: requirements not yet met in code, entries planned for T11 and later, and work beyond the MVP.</p>
<div class="tw"><table><thead><tr><th>What</th><th>Why</th><th>Ids</th></tr></thead><tbody>{flux}</tbody></table></div>

<h2 id="questions">Where the design documents and the requirements disagree</h2>
<p>Three need your decision because they change what members read. The rest are mine to settle and are listed so the redesign knows about them.</p>
<div class="qs">{qs}</div>

<h2 id="legacy">How the old interface differs</h2>
<ul>{legacy}</ul>
<p class="src">Sources read: {e(", ".join(d["sources"]) if isinstance(d["sources"], list) else d["sources"])}</p>
</div>'''
open(S + "ux-substrate.html", "w").write(page)
print(len(page))
