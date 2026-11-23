Length: __N__ lines. Last section: "What I did not check".

# 12. UI knowledge held below the UI, and how the UI talks downward

Worker report for the plane-scope lane, 23 Nov 2026. Base: the working tree, which outside `process/lanes/` equals `origin/p4-tranche` `a26a8da2` ([MEASURED] `git diff --name-only a26a8da2 HEAD -- . ':!process/lanes' | wc -l` → `0`; `git status --short -- . ':!process/lanes' | wc -l` → `0`). "Below" means modules at positions 1–175 of `process/modules/order.txt`; "UI" means 176–194. Module 1 (`documents`) owns `docs/` and `build/`, so it is shown apart where it matters.

## Headline answers

1. **Does any module below 176 import a file of a UI module?** No literal import does. [MEASURED] C2: `edges from pos<=175 to pos>=176: 0` over 4,849 code files (source and tests). Non-literal `import(x)` calls are not resolved; see the last section.
2. **Do modules below 176 hold things that belong to the UI?** Yes. The Part C table has 28 such rows: the screen registry and scripts that name screens, the screens' sentences, per-act drawing rules, a browser-acts table naming screens, two page addresses, button shapes in queue items, an HTML fragment, and the names of the UI modules.
3. **Is `answers` handed a `screens` dependency by store-assembly?** No. [READ] `bio-plane/src/store-assembly/assemble.mjs:349-350`: `answersOf(ctx, { standards, content: contentOf(ctx), events, entities: entitiesOf(ctx), lines, people, duties, calculations, retrieval, credentials: credentialsOf(ctx) });   /* R23: answers is handed no screens registry */`. The registry is handed to `wizard-scripts` (A4).
4. **How many screens does the carried registry hold?** 91, not 71. [MEASURED] C1 → `screens 91 acts 541 owed 121`. The nine screen modules register 78 of them (C8).
5. **How does the UI talk downward?** One function in the browser sends every request to `/api/?op=<name>` on the page's own origin ([READ] `bio-plane/src/interface-shell/browser.mjs:160`: `try { r = await win.fetch("/api/?" + qs.toString(), init); } catch { return { kind: "silent" }; }`). UI code names 560 of the 1,068 declared ops (C8). UI source imports five lower modules in 18 import statements (C3). Screen functions reach the browser as source text composed in the Worker (B3).
6. **Does the UI's page build without the layers below being assembled?** No. [MEASURED] C9: without `store-assembly/register.mjs` loaded, `interfacePage` throws `interface-shell: screen members's act names expertisewithdraw, which OPS does not hold`; with it loaded it returns a page.

## How the measurements were made

The scripts are in `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/w12/` (not in the repository: the brief allows one output file). Each is described so it can be rewritten.

- **Ownership** (`own.mjs`): every `git ls-files` path is given the module whose `files` or `tests` entry in `process/modules/<name>.json` matches it most specifically (an entry ending `/` is a prefix, any other an exact path). Output: `tracked 18447 owned 17961 modules with files 204`.
- **C1**: `node -e 'import("./bio-plane/src/wizard-scripts/screen-registry.mjs").then(m=>console.log("screens",m.SCREEN_REGISTRY.length,"acts",m.SCREEN_REGISTRY.reduce((a,s)=>a+s.acts.length,0),"owed",m.SCREEN_REGISTRY.reduce((a,s)=>a+s.owed.length,0)))'`.
- **C2** (`imports.mjs`, `q1.mjs`): in every owned `.mjs/.js/.cjs/.ts` file, each `import … from "…"`, `export … from "…"`, bare `import "…"` and `import("literal")` with a relative path is resolved (a `?query` dropped) and both ends are given their owners. Output: `code files 4849 edges 27129 relative resolved 18047 bare 9082 unresolved relative 49` (the 49 hold `${…}` or name untracked files).
- **C3** (`q2.mjs`): C2's edges from modules 176–194 to modules ≤175, by kind of the importing file. Cross-check by plain grep: `grep -rn "from ['\"]\.\./" bio-plane/src/screens-*/ bio-plane/src/interface-shell bio-plane/src/interface-assets | grep -v "from ['\"]\.\./screens-\|from ['\"]\.\./interface-"` → 18 lines.
- **C4**: `grep -rnE "from ['\"](\.\./)+(src/)?(interface-shell|interface-assets|screens-[a-z]+)/" bio-plane/src --include=*.mjs | awk -F/ '{print $3}' | sort | uniq -c` → `13 control-plane; 1 interface-shell; 6 screens-inquiry` (same-line `from` only; a cross-check of C2, not a replacement).
- **C5** (`codegrep.mjs <regex> <lo> <hi>`): a regular expression over source files (`files` kind) of modules in a position range, after block and line comments are blanked by a small tokenizer that keeps strings; `rows.mjs`, `case-checker/program.mjs`, the two bundles and `vendor/` are left out. 814 source files are scanned for 1–175.
- **C6** (`wordcalls2.mjs`): on the same comment-stripped source, calls `word(` / `hasWord(` / `localize(` whose first argument is a string literal with a dotted key, grouped by band and by the key's first segment.
- **C7** (`design-refs.mjs`): in code files of modules ≤175, names of files under `docs/development/ux-substrate/` that stand beside a path or read call, with each target's owner.
- **C8** (`uiops2.mjs`): imports `store-assembly/register.mjs`, then the nine `screens-*/index.mjs`, and counts `SCREENS`, their `acts[].op`, the guide's ops and `SHELL_OPS`; adds every `op: "x"` and `call("x"` literal in the text of the nine folders and `interface-shell`; intersects with `OPS`.
- **C9** (`page.mjs [reg]`): imports the nine `SCREENS` and `GUIDE`, calls `interfacePage(screens, {guide, version: "x"})`, with or without first importing `store-assembly/register.mjs`.

## Part A. UI knowledge held below the UI

### A1. Screen registries and screen names

- `bio-plane/src/wizard-scripts/screen-registry.mjs` is owned by `wizard-library` (153), not `wizard-scripts`. [READ] `process/modules/wizard-library.json` lists `"bio-plane/src/wizard-scripts/screen-registry.mjs"` under `files`.
- It holds 91 screens, each `{id, name, purpose, acts, owed}`. [MEASURED] C1. [READ] `screen-registry.mjs:10`: `export const SCREEN_REGISTRY = deepFreeze([`.
- It is generated by `bio-plane/src/wizard-scripts/build-data.mjs` (owner: `wizard-library`), run by hand as a command. [READ] `build-data.mjs:138`: `const from = opt("--from", join(here, "../../test/m/wizard-scripts/source"));` and `:154`: `for (const name of GENERATED) writeFileSync(join(out, name), made.files[name]);`. No workflow, `bio-plane/package.json` or `bio-plane/scripts` file names it: [MEASURED] `grep -rln 'generate.mjs\|build-data\|setup-words/build' .github bio-plane/package.json bio-plane/scripts` → no line.
- Its source is a vendored copy under the module's tests, not the design folder. [READ] line 138 above. Today the two files are the same bytes: [MEASURED] `sha256sum bio-plane/test/m/wizard-scripts/source/registry.json docs/development/ux-substrate/screens/registry.json` → both `77bff6b4…9503ca4`. The carried file matches its source: [MEASURED] `node bio-plane/src/wizard-scripts/build-data.mjs --check` → `screen-registry.mjs, civicsmith-library.mjs and front-doors.mjs match their sources`, exit 0.
- `docs/development/ux-substrate/screens/registry.json` is owned by `documents` (1). [MEASURED] ownership map: `screens/registry.json=documents(1)`. The design file has 91 screens in frames `{"setup":5,"public":5,"working":75,"dock":2,"published":3,"imported":1}` ([MEASURED] `node -e` over the JSON); the carried form drops `frame` and `journeys` ([READ] `wizard-scripts/data.mjs:225`: `out.push({ id: s.id, name: s.name, purpose: s.purpose, acts, owed });`).
- The same generator writes two more files that name screens: `civicsmith-library.mjs` (23 scripts, 145 steps, every step naming a screen, 31 distinct screens) and `front-doors.mjs` (5 doors and a sixth that `opens: "elsewhere"`). [MEASURED] `node -e` over `CIVICSMITH_LIBRARY`, `FRONT_DOORS`, `ELSEWHERE_DOOR` → `library scripts 23 steps 145 steps naming a screen 145 distinct screens 31`, `front doors 5 {"door":"elsewhere","scripts":[],"opens":"elsewhere"}`.
- Who names `SCREEN_REGISTRY` in source files ([MEASURED] `who.mjs 'SCREEN_REGISTRY\b' --code`, source kind): `op-grade-tranches` (1 file, a comment), `wizard-library` (3), `wizard-scripts` (1), `store-assembly` (1), `interface-shell` (1), `screens-document` (1, `screens-inquiry/admit.mjs`), and the two bundles. What each does with it:
  - `wizard-scripts` (154) checks a wizard script's steps against it. [READ] `wizard-scripts/index.mjs:473-474`: `const acts = typeof s.screen === "string" ? reg.screens.get(s.screen) : undefined;` / `if (!acts) refusals.push(finding("WIZARD_SCREEN_UNKNOWN", …`. Its default registration is the registry: [READ] `:970`: `wizardRegister({ screens = SCREEN_REGISTRY, ops = null, …`.
  - `store-assembly` (174) hands it over at start and checks it (A4).
  - `interface-shell` (177) admits a screen and its acts by it. [READ] `interface-shell/index.mjs:238-239`: `const reg = SCREEN_REGISTRY.find((r) => r.id === id);` / `if (!reg) throw new Error(\`interface-shell: screen ${String(id)} is not in SCREEN_REGISTRY\`);`.
  - `screens-document` (186): [READ] `screens-inquiry/admit.mjs:12`: `const row = SCREEN_REGISTRY.find((r) => r && r.id === screen);`.
- `wizard-scripts/admin.mjs` (154) holds one more screen list and an act list. [READ] `admin.mjs:7`: `export const ADMIN_SCREENS = Object.freeze(["updates"]);`; `:12`: `export const ADMIN_ACTS = Object.freeze(new Set([`. Its header says they are "Copied verbatim from `interface-shell`…, which keeps its own until its job deletes them"; the code differs: `interface-shell` now defines none and imports these ([MEASURED] `grep -n 'ADMIN_SCREENS\s*=\|ADMIN_ACTS\s*=' bio-plane/src/interface-shell/*.mjs` → no line; [READ] `interface-shell/index.mjs:12`: `import { SCREEN_REGISTRY, ADMIN_ACTS, ADMIN_SCREENS } from "../wizard-scripts/index.mjs";`).
- Page addresses below 176: two source lines. [MEASURED] C5 with `["'\`/]app(/|["'\`?#])|/app\b` → 8 matches in 6 files; read one by one, two are addresses and six are not (`docProps/app.xml`, a test fixture's `id="app"`, a file name in a sentence). [READ] `public-read/index.mjs:1007`: `return "/app/published/" + encodeURIComponent(\`${id}/${n}\`);`; `case-authoring/index.mjs:1828`: `published: published === null ? null : { edition: published, address: \`/app/published/${id}/${published}\` } };`.
- `dash-*` and other hyphenated screen ids: [MEASURED] C5 over 21 distinctive ids as string literals (`dash-action`, `dash-project`, `open-file`, `find-in`, `review-copy`, `case-editor`, …) → 107 matches; 104 are `wizard-library`'s generated data; the other three are `review/index.mjs:881` (`kind: "review-copy"`, a record kind), `op-declarations/t51.mjs:70` (the browser-acts row below) and `op-declarations/index.mjs:2674` (`"grouprules"`, an op name).
- `op-declarations` (168) holds a table of acts done in the page alone, each naming its screen. [READ] `op-declarations/t51.mjs:67-71`: `const BROWSER_ACT_ROWS = Object.freeze([ ["revisioncompare", "document", "A27"], ["hashcopy", "document", "A26"], …, ["reviewexport", "review-copy", "A81"], ]);`. [MEASURED] 7 rows over screens `document`, `published`, `review-copy`. `interface-shell` reads it ([READ] `interface-shell/index.mjs:185`: `const t = DECLARATIONS.BROWSER_ACTS;`); `act-help` (155) holds the same seven names again ([READ] `affordances/act-help.mjs:235`: `export const BROWSER_ACTS = Object.freeze(["revisioncompare", "hashcopy", "linkopen", "pubfloorset", …`).
- `op-declarations` also sorts ops by whether a screen offers them. [READ] `op-declarations/index.mjs:2660`: `read: Object.freeze({ ground: "A read a screen draws from: no control on a screen offers it as an act.",`. [MEASURED] `ACT_HELP_ABSENT` grounds: `alias:26 read:242 nocontrol:6 unexplained:191`.
- `member-roster` (40) holds the names of 11 of the 19 UI modules, with every other module's. [READ] `member-roster/order.mjs:165-175`: `"interface-assets", "interface-shell", "screens-entry", … "screens-action",`. It is generated from `build/modules.json` ([READ] `order.mjs:1-3`) and becomes the order listeners run in ([READ] `member-roster/index.mjs:143`: `export const MODULE_ORDER = moduleOrderFrom(MODULE_IDS.map((id) => ({ id })));`). [MEASURED] `MODULE_IDS 178`; 26 names of `order.txt` are absent from it.

### A2. Member-facing words

- `setup-words` (2) holds 27,061 rows: 19,562 from the design file and 7,499 written first in code. [MEASURED] `node -e` over `WORD_ROWS` → `rows 27061 design 19562 code 7499`.
- 7,956 rows have keys beginning `screen.` (107 distinct second segments); 7,940 are design rows and 16 are code rows. [MEASURED] same command → `screen.* keys 7956 distinct second segment 107 origin code among screen.* 16`. Other large families: `refusal` 2,610, `act` 1,298, `queue` 592, `installer` 486, `wizard` 359, `shell` 178.
- `rows.mjs` is generated by `setup-words/build.mjs` from `docs/development/ux-substrate/screens/words.json`, which `setup-words` itself owns, plus every `localize(id, en)` call in product source. [READ] `build.mjs:48`: `export const WORDS_PATH = join(ROOT, "docs/development/ux-substrate/screens/words.json");`; `process/modules/setup-words.json` lists that path under `files`.
- To find the `localize` calls the generator lists every tracked product file through `build/modules.json`. [READ] `build.mjs:118`: `const modules = JSON.parse(readFileSync(join(root, "build/modules.json"), "utf8")).modules;` and `:128`: `execFileSync("git", ["ls-files", "-z"], …`. So module 2's generated file is made from the source of later modules. Of the 7,499 code rows, 7,294 come from files of modules ≤175, 0 from UI modules, 205 from modules ≥195 (`control-plane` 11, `journey-check` 53, `stewards` 141). [MEASURED] `words-unreviewed.json` entries (7,499) grouped by the owner of each entry's `file`.
- Which side depends on which, as facts: the table sits at position 2 and imports nothing ([READ] `setup-words.json`: `"uses": []`); 165 of the 175 lower modules call it, and the UI calls it four times.
  - [MEASURED] C6: `calls with a literal key, comments stripped: {"below":{"localize":7978,"word":5229,"hasWord":5},"ui":{"word":4},…}`; `modules <=175 with at least one such call: 165`.
  - The UI's sentences are in it because the design file is its input, not because UI modules call `localize`.
- `screen.*` keys read by lower modules' code ([MEASURED] C6): 48 calls, 44 distinct keys, 14 modules; no `hasWord` among them.

| pos | module | `word` | `localize` |
|---|---|---|---|
| 56 | capture | 1 | 0 |
| 58 | file-safety | 0 | 5 |
| 62 | extraction | 0 | 2 |
| 65 | events | 2 | 0 |
| 73 | money | 2 | 0 |
| 77 | explore | 0 | 1 |
| 121 | public-read | 0 | 13 |
| 126 | case-checker | 3 | 0 |
| 139 | actions | 2 | 0 |
| 145 | filings | 2 | 0 |
| 146 | escalation | 1 | 0 |
| 158 | machinery-producers | 2 | 0 |
| 161 | queue-producers | 2 | 0 |
| 166 | instance-setup | 10 | 0 |

- Counting every `"screen.…"` string literal in code of modules 2–175 (keys held as data as well as in calls): 76 literals, 51 distinct, 17 modules; the three more are `op-grade-tranches` (2), `op-grades` (1) and `agent-runner` (8). [MEASURED] C6.
- Three lower modules write sentences under `screen.` keys in their own code. [READ] `file-safety/screen-words.mjs:9`: `cut: (vars) => localize("screen.open-file.safe.cut", "Showing rows {from} to {to} of {total}. The original file holds the rest.", vars),`; `extraction/screen-words.mjs:7`: `cellsHeld: localize("screen.document.cells_held",`; `public-read/casefile-words.mjs:11` (first of 13).
- Lower modules put these words into what they answer. [READ] `events/index.mjs:1204`: `answer.world = { label: word("screen.timeline.lane.world"), items: b.items.map(draw), …`; `money/index.mjs:1010`: `… label: word("screen.money.proposed") }));`; `actions/index.mjs:1094`: `return refuse("MINUTES_NOT_PUBLIC_COMMENT", word("screen.action.minutes.notpublic"), …`.
- `act.*` keys in such calls below 176: 30 calls in 5 modules (`op-grade-tranches` 3, `op-grades` 9, `wizard-scripts` 8, `act-help` 4, `queue-producers` 6). [MEASURED] C6. `act-help` reads far more by computed key: [MEASURED] `Object.keys(ACT_HELP).length` → `470`; [READ] `affordances/act-help.mjs:286` builds each key as `` `act.${op}.does` ``.
- Two lower modules carry copies of the sentences rather than keys. [READ] `agent-runner/src/says-words.mjs:16`: `"screen.connect.refused.ATTEMPT_SUPERSEDED": "A newer sign-in was started, so this code belongs to an older one. …"` (4 such rows, generated). [READ] `case-checker/program.mjs:3` embeds the whole list: `…// src/setup-words/rows.mjs\nvar WORD_ROWS = (…`.
- `words-reads.json` (`docs/development/ux-substrate/screens/`) is owned by `journey-check` (204). [READ] `process/modules/journey-check.json` lists it under `files`. It is a design-stream list, per module, of the keys that module reads: [MEASURED] `node -e` → `modules object 165 keys`. No source file below 176 reads it: [MEASURED] C5 with `words-reads|ux-substrate` over 1–204 lists, below 176, only `setup-words/build.mjs` (words.json), `skilldoctrine.mjs:1449` (a sentence) and `wizard-library` (source paths recorded in generated data). Tests read it (A6).
- `translations` (165) serves the page its words. [READ] `translations/index.mjs:818`: `interfacewords: () => m.interfaceWords({ language: q("language") ?? (body || {}).language, viewer: q("viewer") }),` and `:26`: `import { WORD_ROWS, WORDS_COMMIT, localize } from "../setup-words/index.mjs";`. The shell asks at load: [READ] `interface-shell/browser.mjs:2777`: `const a = await call("interfacewords", v ? { query: { v } } : {});`.

### A3. Presentation produced below 176

Patterns were chosen after reading how screens draw: a screen's `render(cs, view)` returns an HTML string built from tags with `class="cs-…"`/`"mk-…"` and kit calls ([READ] `screens-entry/forgot.mjs:17`: ``const out = [cs.title(), `<p class="mk-sub">${W(S + "lede")}</p>`];``).

- **HTML tags in code** (C5, 54 tag names, modules 1–175): 133 matches, 18 files, 17 modules. Read one by one: three modules produce markup, one rewrites captured pages, thirteen are false positives (placeholders such as `case=<a published case's id>`, SQL comments inside template strings, parsers, test fixtures). 13 of 17 modules false.
  - `instance-setup` (166) returns an HTML fragment. [READ] `bio-plane/src/setup-fleet.mjs:68`: ``return `<div class="${escBlock(cls)}" id="hosting-control"><p><b>${escBlock(HOSTING_CONTROL.heading)}</b></p>` ``. Its only callers in tracked `.mjs` files outside bundles are its own tests ([MEASURED] `grep -rn hostingControlBlock --include=*.mjs .` minus bundles → `setup.mjs` re-export, `setup-fleet.mjs`, `test/m/instance-setup/page.test.mjs`).
  - `case-grammar` (114) returns a whole HTML document, the published case edition; it is a document a reader keeps, not a screen. [READ] `case-grammar/complete.mjs:546`: `return ["<!doctype html>", '<html lang="en">', "<head>", '<meta charset="utf-8">',`.
  - `docket` (120) returns an Atom feed. [READ] `docket/feed.mjs:38`: ``  `  <title>${esc(`${group} docket: ${pub.case}`)}</title>`,``.
  - `subresources` (15) rewrites a captured page's own HTML ([READ] `subresources.mjs:692`), which is capture work.
- **`class=`, `innerHTML`, `createElement`, `<!doctype`, `text/html`, `style=`** (C5): 35 matches, 17 files, 13 modules; besides the three producers above, all are content-type tests, HTML parsers, an OCR canvas and test fixtures.
- **`draw…` identifiers** (C5): 109 matches in 24 modules; one concerns a screen. [READ] `events/index.mjs:1258`: `#drawn(eventIds, viewer) {`, whose result is spread into each timeline item at `:1203`. The other 23 modules use "draw" for a statistical draw, a random id or a project "drawing on" a question.
- **UI vocabulary** (`card|tip|button|icon|dialog|tab|panel|dashboard|…`, C5, modules 10–175): 202 matches in 28 modules. I read the lines of 14 of the 28 modules (positions 38, 39, 46, 60, 72, 78, 79, 82, 92, 93, 100, 121, 125, 161, 164 hits shown); two are about the UI:
  - `op-grades`/`op-grade-tranches` hold how an act is confirmed. [READ] `op-grades/t35.mjs:133`: `personexpunge: Object.freeze({ friction: "dialog", key: "screen.person.expunge.statement" }),`; [READ] `op-grades/index.mjs:300`: `export const CONSEQUENCE_STATEMENTS = Object.freeze({` ([MEASURED] 10 entries).
  - `public-read` reads a shell word: [READ] `public-read/index.mjs:621`: `} catch { named = word("shell.card.member"); }`.
  - The other 14 modules' 153 matches (readers, court data, `wizard-library`) are [NOT CHECKED].
- **Per-act drawing rules held at 38–39.** [READ] `op-grades/marks.mjs:239`: `export const MARKS = Object.freeze(Object.fromEntries(ROWS.map(([op, weight]) => [op, weight])));` with source `:44`: `` kit: `mock-kit.js WEIGHT at ${MARKS_KIT_COMMIT}`, `` ([MEASURED] 183 entries, values `Reversible,Terminal,Reasoned,Signed,Irreversible`). [READ] `op-grades/index.mjs:1630`: `export function phoneOf(id) {` and `:324`: `export const LARGER_SCREEN_ACTS = Object.freeze([`. `interface-shell` reads all three ([READ] `interface-shell/index.mjs:11`: `import { RUNGS, RUNG_ABSENT, IRREVERSIBLE_WEIGHT, MARKS, phoneOf } from "../op-grades/index.mjs";`).
- **Screen-shaped values in queue items.** [READ] `queue-producers/index.mjs:3171-3173`: `options: [{ id: "projectrequestanswer", label: word("act.projectrequestanswer.label.queue"), weight: "single", answers: [{ answer: "grant", label: word("screen.home.request.grant") }, { answer: "decline", label: word("screen.home.request.decline") }] }],`. [READ] `action-producers/index.mjs:1433`: `screen: { op: "action", id: x.action, step: "send" },`; `notice-producers/index.mjs:900`: `screen: { op: "securitymap", from, to },`. [MEASURED] C5 `\bscreen\s*:` → 26 matches in 6 modules; outside the wizard modules and `store-assembly` these three lines are all.
- **The page's HTML policy sits at 170.** [READ] `answer-envelope/index.mjs:62`: `const NONCE_SLOT = "__CSP_NONCE__";`, the same literal as `interface-shell/index.mjs:44`: `export const NONCE_SLOT = "__CSP_NONCE__";` (two definitions, no import between them).
- **English in answers generally.** The 7,978 `localize` and 5,229 `word` calls below 176 (C6) are sentences that modules put in refusals, details and labels; the count is of calls, and I did not classify which sentences a member sees.

### A4. Dependencies handed in

- `store-assembly` (174) hands `wizard-scripts` (154) the registry, the op table and the administrator lists, once at start. [READ] `store-assembly/wizards.mjs:32-34`: `export const wizardRegistration = ({ door = null } = {}) => ({ screens: SCREEN_REGISTRY, ops: OPS, machineRefused: Object.keys(MACHINE_REFUSALS), machineDrafts: MACHINE_DRAFTS, irreversible: irreversibleActs(), library: CIVICSMITH_LIBRARY, adminActs: [...ADMIN_ACTS], adminScreens: [...ADMIN_SCREENS],`; `assemble.mjs:564`: `wizardScriptsOf(ctx, { env }).wizardRegister(wizardRegistration({ door: {`.
- `store-assembly` also checks the registry against the op table. [READ] `wizards.mjs:43`: `export function screenFailures(screens = SCREEN_REGISTRY, ops = OPS) {`.
- `answers` (104) receives no `screens`. [READ] the call quoted in headline 3. [MEASURED] C5 `screens|registry|SCREEN` over `answers` → 1 match in 10 files, `answers/rules.mjs:113` ("the registry is not reachable here", about entities). Description and code differ in one place: [READ] `store-assembly/wizards.mjs:3` still says "the registry `answers`' explain read is handed", while requirement R23 says "`answers` reads no registry, and the composition root hands it none" (`process/modules/store-assembly.md:51`).
- R23's own wording, for the lane: "The assembly carries **no screens registry of its own**. The one registry is `wizard-scripts`' `SCREEN_REGISTRY`" (`store-assembly.md:51`). The code agrees: [MEASURED] `grep -n screens` over `assemble.mjs`, `register.mjs`, `wiring.mjs`, `owners.mjs`, `index.mjs` → two comment lines.
- `affordances` (156) reads the registered screens from the `wizard-scripts` instance and publishes them. [READ] `affordances/facts.mjs:525-526`: `const w = this.wizardScripts();` / `const screens = w.registeredScreens();`; `:555`: `affordancescreens: () => a.screens({ viewer: q("viewer") }),`; `affordances/door.mjs:61`: `screens: Array.isArray(screens) ? screens : [],` in the catalogue answer. It gets the instance from its own import unless one is handed ([READ] `facts.mjs:47` and `:80`: `this.wizardScripts = of("wizardScripts", wizardScriptsOf);`).
- `skills` (102) is handed the screens in the published pack and fails a build on a script that names an unknown one. [READ] `bio-plane/src/skillpack.mjs:461`: `if (wizardScripts) validateWizardScripts(wizardScripts, p.screens);`.
- `act-help` (155): tied to the UI by words and by the browser-acts list (A1, A2). `queue-words` (160): no tie found. [MEASURED] C5 `\bscreens?\b` over 155–175 lists 11 modules and `queue-words` is not among them; its file is `queue-producers/words.mjs`.
- `op-declarations` (168): the two tables in A1.

### A5. Imports and file reads of UI-owned things by modules ≤175

- Literal imports: none (headline 1). [MEASURED] also `who.mjs` for `(interface-shell|interface-assets|/screens-[a-z]+)/<file>.m?js` in any code file owned ≤175 → one file, `bio-plane/test/m/wizard-scripts/r51.test.mjs`, and the match is in a comment ([READ] `:30-32`: "A test here cannot import it: interface-shell is a later module (architecture check).").
- Run-time or build-time reads of UI modules' files by lower source: none found beyond `setup-words/build.mjs` listing every tracked product file (A2). [MEASURED] the same `who.mjs` run; and C5 for UI module names outside comments in source ≤175 gives only `member-roster/order.mjs` (names), `rows.mjs` and `case-checker/program.mjs` (word notes), `screen-registry.mjs` (two purposes that cite a requirement) and one JSDoc line.
- `interface-assets/index.mjs` (176, 1,159,280 bytes) is written by `interface-assets/generate.mjs`, by hand, from git at a fixed commit, never from the working copy. [READ] `generate.mjs:12-14`: `const COMMIT = "2a64c5ae77";` / `const DIR = "docs/development/ux-substrate/visual-language";` / `const PAGE = "docs/development/ux-substrate/screens/page.src.html";`; `:126`: ``const at = (path) => git(["show", `${COMMIT}:${path}`]);``; `:158`: `writeFileSync(join(HERE, "index.mjs"), out);`. Those source files belong to `documents` (1).
  - It carries 21 files (`civicsmith.css`, `shell.css`, `icons.svg`, 15 faces, 3 licences). [MEASURED] `Object.keys(ASSET_FILES).length` → `21`.
  - The carried stylesheet is not today's design file: [MEASURED] working-tree `civicsmith.css`+`faces.css` (rewritten as the generator does) is 48,448 characters, the carried body 47,320, `equal: false`; `icons.svg` is equal.
  - In this checkout the commit is absent, so the generator and its test cannot read it: [MEASURED] `git cat-file -t 2a64c5ae77` → `fatal: Not a valid object name`; `git rev-parse --is-shallow-repository` → `true`; `node --test bio-plane/test/m/interface-assets/assets.test.mjs` → `tests 22 pass 13 fail 9`.
  - Nothing invokes the generator ([MEASURED] the grep in A1).

### A6. Tests below 176 that need UI things

- No test file owned ≤175 imports a UI module's file. [MEASURED] C2 (0 edges), C4 on `bio-plane/test` (the test folders that import a UI source folder are `control-plane`, `interface-*`, `plane`, `screens-*`).
- No file in a UI module's folder is owned by a module ≤175, and none the other way. [MEASURED] a pass over ownership by folder → 6 groups, all owned by `control-plane` or `plane`.
- Tests ≤175 do read the design folder. [MEASURED] C7:

| design file | owner | named by tests of |
|---|---|---|
| `words.json` | setup-words (2) | 33 modules (51 references) |
| `words-reads.json` | journey-check (204) | 17 modules (18 references) |
| `registry.json` | documents (1) | 3 modules: wizard-library, wizard-scripts, store-assembly |
| `library.json` | documents (1) | 2 modules |
| `mock-acts.js` | journey-check (204) | affordances (`test/m/affordances/t36.test.mjs:423`) and three `test/m/op-declarations/` files owned by store-assembly |
| `mock-kit.js` | journey-check (204) | `test/m/op-grades/t48.test.mjs:228`, `t50.test.mjs:95` (owned by store-assembly) |

  By the evidence rules a file read is a reference, so tests of 17 lower modules refer to a file of module 204. [READ] `bio-plane/test/m/admission/words.test.mjs:11`: `const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8"))`.

## Part B. How the UI talks downward

I read `interface-shell` and three screens parts: `screens-entry` (178; screens with no session, the smallest), `screens-intake` with `screens-capture` (182–183; uploads and long jobs, and the one part whose code the door also runs) and `screens-daily` with `screens-find` (184–185; the working frame's reads, and one of the few with lower imports in source). The rest is covered by C3 and C8.

### B1. How a screen gets data

- A screen is an object `{id, reads, render, acts, words}`. [READ] `screens-entry/index.mjs:59`: `export const SCREENS = [front, tour, forgot, reset, setup, join].map(freeze);`.
- Reads: `reads(view)` answers `{name: {op, query?, body?}}`; the shell sends each. [READ] `screens-entry/front.mjs:15`: `identity: { op: "groupidentity" },`; `interface-shell/browser.mjs:446`: `try { specs = inst.spec.reads ? inst.spec.reads(inst.view) || {} : {}; } catch { specs = {}; }`.
- Acts: `acts: [{op, send, done, refusals}]`; the shell sends on a press. [READ] `browser.mjs:2260`: `let a = await call(d.op, req);`.
- A screen function may ask by name through the kit. [READ] `browser.mjs:591-592`: `async call(op, o = {}) {` / `const a = await call(op, { query: o.query, body: o.body, raw: o.raw, …`.
- All three paths end in one `fetch`. [READ] `browser.mjs:160` (headline 5); the token goes in a header ([READ] `:155`: `if (!pub) init.headers.Authorization = "Bearer " + (own ? req.bearer : S.t);`). No screen calls `fetch` itself: [MEASURED] `grep -rn 'fetch(\|/api/' bio-plane/src/screens-*/ bio-plane/src/interface-shell/ | wc -l` → `3`, all in `browser.mjs` (`:160`, `:1430` a link to `/api/?op=credit`, `:1939` `/version`).
- The door reads the op and relays to the store. [READ] `control-plane/index.mjs:1009`: `let op = url.searchParams.get("op") || path.slice(1) || "selftest";`; `:2051`: `const out = await doAnswer(stub.fetch(new Request(inner, withGrant({ method: req.method, body: passBody }))));`.
- Whole-set counts. [MEASURED] C8: `screens registered by the nine modules: 78`; `distinct act ops (runtime, screens): 412 | guide ops: 12 | SHELL_OPS: 14`; `runtime union: 427 | in OPS: 420 | browser acts: 7 | neither:` (empty); with the literals in source text, `of which keys of OPS: 560 | OPS total 1068`; of the 560, `mutating===false 205 ; mutating true 355 ; public (classes null) 24`.
- Ten ops, both sides. A sample of 10 chosen by me from the three parts to cover a public act, session reads, a raw-body upload, an owner-declared op and an owner-map op; not random. All [READ] (each line printed by `grep -n`).

| op | the UI names it | declared | answered |
|---|---|---|---|
| `login` | `screens-entry/front.mjs:94` | `op-declarations/index.mjs:1480` | `credentials/index.mjs:2159` |
| `recover` | `screens-entry/forgot.mjs:38` | `credentials/index.mjs:2240` | `credentials/index.mjs:2188` |
| `groupidentity` | `screens-entry/front.mjs:15` | `op-declarations/index.mjs:773` | `bio-plane/src/setup.mjs:3089` |
| `bootstrap` | `screens-entry/setup.mjs:31` | `op-declarations/index.mjs:1478` | `credentials/index.mjs:2153` |
| `heldcaptures` | `screens-intake/held.mjs:21` | `op-declarations/index.mjs:1058` | `capture/index.mjs:3843` |
| `captureupload` | `screens-intake/capture.mjs:1425` | `store-assembly/owner-ops.mjs:25` | `store-assembly/owner-ops.mjs:107` |
| `acquire` | `screens-intake/capture.mjs:572` | `op-declarations/index.mjs:971` | `capture/index.mjs:3867` |
| `queue` | `screens-daily/home.mjs:38` | `op-declarations/index.mjs:1184` | `queue/index.mjs:2665` |
| `search` | `screens-daily/answers.mjs:34` | `op-declarations/index.mjs:789` | `retrieval/index.mjs:1843` |
| `ruleservicesstate` | `screens-daily/answers.mjs:27` | `answers/ops.mjs:85` | `answers/ops.mjs:61` |

- The op table the UI checks against is complete only after `store-assembly` has registered the owners' rows. [READ] `store-assembly/register.mjs:6-8`: `import { assembleDeclaredOps } from "./declarations.mjs";` / `assembleDeclaredOps();`. [MEASURED] C8 without that import: `OPS total 1029` and 24 act ops of the screens in neither table; with it: `1068` and none. [MEASURED] C9 (headline 6).

### B2. Direct imports of lower modules by UI code

[MEASURED] C3, source files: `import statements to modules <=175: 18; to other UI modules: 76; to modules >=195: 0`.

| target | pos | statements | names | importing UI modules |
|---|---|---|---|---|
| setup-words | 2 | 8 | `WORD_ROWS`, `word`, `hasWord` | interface-shell, screens-wizards, screens-daily, screens-people, screens-investigate |
| op-declarations | 168 | 6 | `OPS`, `NEEDS`, `SESSION_OPS`, `*` | interface-shell, screens-daily, screens-send, screens-action |
| wizard-scripts | 154 | 2 | `SCREEN_REGISTRY`, `ADMIN_ACTS`, `ADMIN_SCREENS` | interface-shell, screens-document |
| op-grades | 39 | 1 | `RUNGS`, `RUNG_ABSENT`, `IRREVERSIBLE_WEIGHT`, `MARKS`, `phoneOf` | interface-shell |
| record-grammar | 3 | 1 | `sha256HexSync` | interface-shell |

- 8 of the 19 UI modules import a lower module in source; 11 import none (`interface-assets`, `screens-entry`, `screens-account`, `screens-settings`, `screens-capture`, `screens-intake`, `screens-find`, `screens-question`, `screens-inquiry`, `screens-public`, `screens-publish`). [MEASURED] C3 "per UI module (src)".
- What the screens' imports are for: values worked out once when the module loads. [READ] `screens-daily/home.mjs:22`: `const OWED = function (spec) { return Object.hasOwn(OPS, spec.op) ? [spec] : []; };` (an act is carried only if its op is declared); `screens-daily/index.mjs:33`: `const KIND_NAMES = WORD_ROWS.map((r) => r[0]).filter((k) => k.startsWith("queue.kind."));`; `screens-investigate/calculation.mjs:242`: `const NEW_KEYS = [ … ].filter((k) => hasWord(k));`. [MEASURED] the screens' act count moves with the table: 410 distinct act ops without the registration, 412 with it (C8, two runs).
- UI tests import far more. [MEASURED] C3, test files: `import statements to modules <=175: 389`, `distinct target modules: 61` (module and kind); the largest are `setup-words` 84, `store-request` tests 56, `test-support` 48, `op-declarations` 43. The long `uses` lists of the screens modules are their tests' ([READ] `process/modules/screens-inquiry.json` lists 30 `uses`; its source imports no lower module).

### B3. Where UI code runs

- **In the Worker, at load:** the screen modules are imported by the door, so their top-level code (B2) runs there. [READ] `control-plane/index.mjs:54`: `import { SCREENS as ENTRY_SCREENS } from "../screens-entry/index.mjs";` (nine such lines, `:54-62`).
- **In the Worker, at the first page or script request:** `interface-shell` checks the screens and turns them into one script. [READ] `interface-shell/index.mjs:526-532`: `checkScreens(screens);` … `const program = shellProgram.toString();` … ``const source = `(${program})(${toSource(D)}, ${toSource(screens)}, window, ${toSource(guide)}).start();`;``. A function is shipped by its own text: [READ] `:297-298`: `if (typeof v === "function") {` / `const src = v.toString();`. No build step is involved for this; I did not look at how the Worker bundle itself is built.
- **In the browser:** that script, served at a versioned address. [READ] `interface-shell/index.mjs:604`: `<script src="${scriptPath(version)}" integrity="${hash}"></script>`; `control-plane/index.mjs:991`: `if (appRoute === "script") return appScript(req, url, { source: interfaceScript(APP_SCREENS, appOptions(env)), version: env.VERSION });`. [MEASURED] C9: `page bytes 3512 script bytes 5270912`, the script beginning `(function shellProgram(D, SCREENS, win, GUIDE) {`; the embedded word list is about 1,413,373 bytes of it.
- **Because functions travel as text, a screen function cannot use an import.** The contract says so ([READ] `interface-shell/index.mjs:19`: "Every function is self-contained."), and B2's imports are all used at top level. INFERENCE from those two: no lower module's code runs in the browser through a screen. What would settle it: a search of the composed script for the body of a lower module's function.
- **In the Worker again, by the door:** the door calls two functions of the capture screen with a stand-in kit. [READ] `control-plane/index.mjs:39`: `import { CAPTURE_SCREEN } from "../screens-intake/capture.mjs";`; `:796-797`: `try { title = CAPTURE_SCREEN.parts.titleOf(cs, { reading: answer.reading, doc, address }); } catch { title = address; }` / `const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc, title, locator: address, project });`. That function builds the record bundle ([READ] `screens-intake/capture.mjs:144`: `async function promoteDocument(cs, o) {`, then `cs.call("allocid", …)` at `:148`).
- **Assets:** the door serves `interface-assets`' files. [READ] `control-plane/index.mjs:53` imports `ASSET_FILES`; `interface-shell/index.mjs:55`: `return "/app/assets/" + name;`.

### B4. How screens are registered into the page

- Each of nine folders exports `SCREENS` from its `index.mjs`; `screens-wizards` also exports `GUIDE`. [MEASURED] C8 per module: `{"screens-entry":6,"screens-settings":16,"screens-intake":8,"screens-daily":7,"screens-inquiry":8,"screens-wizards":1,"screens-investigate":12,"screens-publish":9,"screens-action":11}`.
- One source file gathers them: the door. [READ] `control-plane/index.mjs:63-65`: `const APP_SCREENS = Object.freeze([...ENTRY_SCREENS, ...SETTINGS_SCREENS, ...INTAKE_SCREENS, ...DAILY_SCREENS, ...INQUIRY_SCREENS, ...WIZARDS_SCREENS, ...INVESTIGATE_SCREENS, ...PUBLISH_SCREENS, ...ACTION_SCREENS]);` / `const APP_OPTIONS = Object.freeze({ guide: WIZARD_GUIDE });`. [MEASURED] C2: among source files, `SCREENS` or `GUIDE` is imported from a `screens-*/index.mjs` by another module only in `control-plane/index.mjs`.
- 13 registry screens have no registered screen: `site, install, update, more, unavailable, registers, aiproviders, aiconnect, aimine, aiproject, aimoments, aitest, airesults`. [MEASURED] C8.
- Other source importers of UI modules, for the lane's map ([MEASURED] C2): `control-plane` (13 statements), `installer` and `site` (`ASSET_FILES`), `journey-check`.

## Part C. Every UI-related coupling found below 176

Direction: **L** = a lower module knows or holds something of the UI; **U** = the UI uses a lower module. Evidence for each row is in the section named.

| # | Dir | Lower module (pos) | Mechanism | Where | Fact |
|---|---|---|---|---|---|
| 1 | L | wizard-library (153) | generated copy of a design file | `wizard-scripts/screen-registry.mjs:10` | Carries the design's registry: 91 screens with names, purposes, acts (A1) |
| 2 | L | wizard-library (153) | generated copy of a design file | `wizard-scripts/civicsmith-library.mjs`, `front-doors.mjs` | 23 scripts whose 145 steps each name a screen; 5 doors and one that opens a screen (A1) |
| 3 | L | wizard-scripts (154) | checks against the registry | `wizard-scripts/index.mjs:473`, `:970` | Refuses a script step that names an unregistered screen; registers the registry by default (A1) |
| 4 | L | wizard-scripts (154) | hand-held list | `wizard-scripts/admin.mjs:7`, `:12` | Holds `ADMIN_SCREENS` and the 45 `ADMIN_ACTS`; the shell imports them (A1) |
| 5 | L | store-assembly (174) | value handed at assembly | `store-assembly/wizards.mjs:32`, `assemble.mjs:564` | Hands the registry and admin lists to `wizard-scripts` at start (A4) |
| 6 | L | store-assembly (174) | check | `store-assembly/wizards.mjs:43` | `screenFailures` checks each registry screen and act against `OPS` (A4) |
| 7 | L | affordances (156) | reads a registered value; answers it | `affordances/facts.mjs:526`, `:555`, `door.mjs:61` | Publishes the registered screens in the `affordances` catalogue (A4) |
| 8 | L | skills (102) | value handed in | `skillpack.mjs:461` | Validates published wizard scripts against the screens it is handed (A4) |
| 9 | L | op-declarations (168) | hand-held table | `op-declarations/t51.mjs:67-71` | 7 browser acts, each naming its screen (A1) |
| 10 | L | op-declarations (168) | hand-held table | `op-declarations/index.mjs:2660` | Sorts 465 ops by whether a screen control offers them (A1) |
| 11 | L | act-help (155) | words by key; hand-held list | `affordances/act-help.mjs:235`, `:286` | 470 act explanations read as `act.<op>.does`; the 7 browser acts listed again (A1, A2) |
| 12 | L | op-grade-tranches (38) | hand copy of the design kit | `op-grades/marks.mjs:239` | `MARKS`: the drawn weight mark of 183 acts, from `mock-kit.js` (A3) |
| 13 | L | op-grades (39) | rule in code | `op-grades/index.mjs:1630`, `:324` | `phoneOf` and `LARGER_SCREEN_ACTS` say which acts are kept off a phone (A3) |
| 14 | L | op-grades (39), op-grade-tranches (38) | hand-held table | `op-grades/index.mjs:300`, `t35.mjs:133` | 10 acts' `{friction: "dialog", key}`, two with `screen.*` keys (A3) |
| 15 | L | setup-words (2) | generated from a design file | `setup-words/rows.mjs`, `build.mjs:48` | Holds 7,956 `screen.*` rows of 27,061 (A2) |
| 16 | L | setup-words (2) | build-time read of all product source | `setup-words/build.mjs:118`, `:128` | Its generator lists every tracked product file; 205 code rows come from modules ≥195, 0 from UI (A2) |
| 17 | L | 14 modules (56–166) | words by key | e.g. `events/index.mjs:1204` | 48 calls read 44 `screen.*` keys and put them in answers and refusals (A2) |
| 18 | L | file-safety (58), extraction (62), public-read (121) | sentences written under UI keys | `file-safety/screen-words.mjs:9` | Write `screen.*` sentences in their own code (20 `localize` calls) (A2) |
| 19 | L | agent-runner (107) | generated copy of sentences | `agent-runner/src/says-words.mjs:16-19` | Carries 4 `screen.connect.refused.*` sentences as text (A2) |
| 20 | L | case-checker (126) | generated copy | `case-checker/program.mjs:3` | Its standalone program embeds the whole word list (A2) |
| 21 | L | public-read (121), case-authoring (132) | address literal | `public-read/index.mjs:1007`, `case-authoring/index.mjs:1828` | Answer `/app/published/…`, a page address (A1) |
| 22 | L | queue-producers (161) | answer shape | `queue-producers/index.mjs:3171-3173` | Queue items carry options with labels and answer buttons worded from `screen.*` (A3) |
| 23 | L | action-producers (159), notice-producers (162) | answer shape | `action-producers/index.mjs:1433`, `notice-producers/index.mjs:900` | Queue items carry a `screen: {op, …}` field (A3) |
| 24 | L | events (65) | answer shape | `events/index.mjs:1203-1204`, `:1258` | The timeline answer carries lane labels and a per-item `#drawn` part (A2, A3) |
| 25 | L | instance-setup (166) | function returning HTML | `bio-plane/src/setup-fleet.mjs:68` | `hostingControlBlock` returns a `<div>`; no caller outside its tests (A3) |
| 26 | L | answer-envelope (170) | duplicated literal; page policy | `answer-envelope/index.mjs:62` | Holds the page's `NONCE_SLOT` literal a second time and the HTML policy (A3) |
| 27 | L | member-roster (40) | generated list of names | `member-roster/order.mjs:165-175` | Holds the names of 11 UI modules in the listener order (A1) |
| 28 | L | tests of 17 modules ≤175; affordances and store-assembly tests | file read in tests | e.g. `test/m/admission/words.test.mjs:11` | Read `words-reads.json`, `mock-acts.js`, `mock-kit.js`, files of module 204 (A6) |
| 29 | U | every op owner; the door | request by op name | `interface-shell/browser.mjs:160` | Every read and act is `/api/?op=…`; 560 of 1,068 ops named (B1) |
| 30 | U | setup-words (2) | static import | `interface-shell/index.mjs:8`, 7 screen files | Word list embedded in the page script; key lists built at load (B2, B3) |
| 31 | U | op-declarations (168) | static import | `interface-shell/index.mjs:9-10`, 4 screen files | `OPS`, `NEEDS`, `SESSION_OPS`, `BROWSER_ACTS` gate what is drawn and carried (B2) |
| 32 | U | store-assembly (174) | load order | `store-assembly/register.mjs:8` | The page cannot be composed until the owners' ops are registered (B1) |
| 33 | U | op-grades (39) | static import | `interface-shell/index.mjs:11` | Weights, marks and the phone flag (B2) |
| 34 | U | wizard-scripts (154) | static import | `interface-shell/index.mjs:12`, `screens-inquiry/admit.mjs:7` | Registry and admin lists (B2) |
| 35 | U | record-grammar (3) | static import | `interface-shell/index.mjs:13` | `sha256HexSync` for the script's hash (B2) |
| 36 | U | translations (165) | request by op name | `interface-shell/browser.mjs:2777` | The page's words in the member's language (A2) |
| 37 | U | 61 lower module/kind targets | test imports | C3 | 389 import statements in UI tests (B2) |
| 38 | U | documents (1) | generated from design files at a past commit | `interface-assets/generate.mjs:12-14` | Stylesheet, icons and faces taken from git at `2a64c5ae77` (A5) |

Rows by direction and mechanism: **L 28** (generated copy 5: rows 1, 2, 15, 19, 20; hand-held table or list 6: 4, 9, 10, 11, 12, 14; words by key or written under UI keys 2: 17, 18; answer shape 3: 22, 23, 24; value handed in or read at run time 3: 5, 7, 8; check or rule in code 3: 3, 6, 13; build-time or test file read 2: 16, 28; other 4: 21 address literal, 25 HTML function, 26 duplicated literal, 27 generated names). **U 10** (static import 5: 30, 31, 33, 34, 35; request by op name 2: 29, 36; load order 1: 32; test imports 1: 37; generated from design files 1: 38).

Above 176, for context and outside the count: the door imports the nine `SCREENS` and composes the page (`control-plane/index.mjs:54-65`, `:991`), and runs two capture-screen functions in the Worker (`:796-797`).

## After a change

Not findings; what the rows above would touch if the layers were reordered. Each is an INFERENCE from the row named.

- Rows 30–35: the shell's imports are of data tables. If the UI were to sit above the door, these five targets would have to stay reachable from the UI's place, or their data be handed to `interfacePage` as an argument.
- Row 32: whatever composes the page would still need the complete op table, which today only exists after `store-assembly` loads.
- Rows 1–8: the registry is read below the UI by four modules. Moving it into the UI would leave those four without it unless it were handed in, as rows 5 and 8 already do.
- Rows 15, 17, 18: moving the screens' sentences out of module 2 would break 48 calls in 14 modules and the three modules that write under `screen.` keys.

## What I did not check

- Non-literal dynamic imports. `import(x)` with a computed path is not resolved by C2. A line scan finds 3 real ones in source ≤175 (`bio-plane/scripts/fleet-bundle.mjs:1487`, `:2062`; `bio-plane/test/declared-ops.mjs:136`) and 114 lines in tests; I did not establish what any of them loads. The graph worker's rigorous pass would.
- Whether the composed script holds any lower module's function body (the INFERENCE in B3).
- Who reads the `screen` field of queue items (row 23). A grep of the UI source for `.screen.op`, `item.screen`, `it.screen` found no reader; I did not trace the queue's own shaping of items.
- 153 of the 202 "UI vocabulary" matches (A3), in 14 modules, mostly readers and generated data.
- Which of the 13,207 `word`/`localize` calls below 176 produce a sentence a member sees on a screen.
- The 49 relative import paths C2 could not resolve, and multi-statement lines the import regular expression may miss; C4 is a partial cross-check only.
- How the Worker bundle is built and whether the screens are in the door's bundle, the store's, or both (the door worker's subject). I saw only that `bio-plane/dist/bio-plane.bundled.mjs` names `SCREEN_REGISTRY` and `interfacePage`.
- Whether `interface-assets/generate.mjs` and its test pass in a full clone; here the commit is absent.
- `node bio-plane/src/setup-words/build.mjs --check` exits 1 here with `words-unreviewed.json is stale or absent`. I did not find out why, nor whether `rows.mjs` is current.
- The other six screens parts' files were not read; they are covered only by the whole-set commands C3 and C8.
- The store side of the door: how `http://do/<op>` reaches each owner's op map. I cited the owner's arm for ten ops and did not trace the route between.
- `process/modules/*.md` requirement texts, beyond store-assembly R18 and R23.
