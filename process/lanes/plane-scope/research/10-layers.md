Length: 368 lines. Last section: "What I did not check".

# The five layers: which layer each module's code belongs to

Written 23 Nov 2026 by a research worker for civicsmith plane-scope lane #1. Base: the working tree; outside `process/lanes/` it equals `origin/p4-tranche` at `a26a8da2` [MEASURED: `git diff --stat a26a8da2 HEAD -- . ':(exclude)process/lanes'` prints nothing]. `S` is `node process/lanes/plane-scope/research/layers/signals.mjs`; each [MEASURED] names the mode of `S` that shows it. A path is under `bio-plane/src/` unless it starts with another folder. `layers/layers.json` (`S --write`) holds each module's signals, its cited line in full and an ambiguous module's parts.

## The answer

Asked: place each of the 204 modules in a layer by what its code does, and say where the layer picture does not fit.

- **184 modules take one place and 20 do not.** 132 model, 6 middleware, 19 UI, 27 outside the five, 20 AMBIGUOUS. [MEASURED: `S --layers`, first line `{"outside":27,"model":132,"AMBIGUOUS":20,"middleware":6,"ui":19}`]
- **No module is control plane only and none is launcher only.** `control-plane` (195) is the router and also handles particular ops; `plane` (196) is the Worker and the object's class and also says which handler answers which op; `store-assembly` (174) runs the start in the function that builds the route map. [READ: the lines under "The 20 AMBIGUOUS modules"]
- **14 modules keep tables or rows and also hold a handler that runs outside the object**, reaching the record through the object's `fetch`; 3 middleware modules also keep tables or an op map. The 17 sit at 49 to 173, inside the model's range. [MEASURED: `S --layers`]
- **The UI is 19 modules at 176 to 194 with no table, no SQL and no op map, and it is imported from below the top:** `control-plane` imports 12 of them, and runs one screen's function inside the object. [MEASURED: `S --facts`; READ: `control-plane/index.mjs:797`]
- **In the order today:** by the owner's stacking, `control-plane` (195) and `plane` (196) sit after all 19 UI modules; by either stacking, 11 single-layer model modules (153 to 165) sit after `scheduler` (152, middleware). [MEASURED: `S --order`]

## How the signals were taken

1. **Owned code.** A file's owner is the module whose listed path matches it most specifically across `files` and `tests`; only `files` paths are counted. 1,181 owned code files (`.mjs`, `.js`, `.cjs`) are scanned; 11 generated or vendored ones are not (the paths `process.json`'s language reader leaves out). [MEASURED: `S --facts`, last line: `plane-held code files: 852 of 1181 scanned; not scanned: 11`]
2. **Comments are blanked first.** Each file is parsed with the repository's vendored acorn (`setup-words/vendor/acorn.mjs`); comments become spaces, strings stay (SQL and HTML live in strings). One file did not parse and is counted unblanked: journey-check's `build/plan/walk-T51-final/scripts/02-people.test.mjs`. [MEASURED: `S --facts`, `unparsed:`]
3. **The plane's program.** The files reached from `plane/index.mjs` (`bio-plane/wrangler.jsonc`'s `main`) by static imports and dynamic imports of a literal address: 853. The committed bundle manifest lists 852 first-party inputs, every one in that set; the one more is `screens-action/words-fix-flaws.mjs`, imported at `screens-action/words.mjs:18`. Plane-held files hold no dynamic import of a computed address. Only plane-held code decides a layer. [MEASURED: `S --facts`, lines `bundle manifest ...` and `dynamic imports ...`]
4. **The patterns**, chosen after reading how plane, control-plane, the store-* modules, membership, sources, tasks, interface-shell and screens-entry say each thing. Counts: plane-held hits / modules with one. [MEASURED: `S --patterns`, which prints each pattern whole]

| signal | pattern | hits / modules | use, and how far to trust it |
|---|---|---|---|
| create_table, alter_table | `CREATE [VIRTUAL] TABLE`, `ALTER TABLE` | 627 / 89, 88 / 62 | decides model. `record-core-tables` and `credentials-tables` hold the text only (sql_exec 0) |
| sql_exec | `sql.exec(`, `db.exec(`, `transactionSync(` | 1,640 / 101 | decides model. Written after listing every `.exec(` receiver |
| ops_map | exported `<name>Ops`, not `...DeclaredOps` | 91 / 89 | decides model. The first version also caught two registrars |
| do_answer | `doAnswer(` | 98 / 18 | decides middleware: code outside the object reading the object's answer. Misses a handler that does not use it (`signin-door`, `store-services`' `ask.mjs`: read) |
| names imported | parse tree | see right | decide middleware and control plane. Other modules' op maps: `store-assembly` 84, `store-door` 4, `membership` 1, `credentials` 1. `DECLARED_OPS`: `store-services` 80. Door handlers (`...Op`): `plane` 15, `control-plane` 3, `file-safety` 1, `store-assembly` 1. `SCREENS`: `control-plane` 9 |
| screens_export, asset_bodies | `export const SCREENS`; `type: "text/css"` and the like | 9 / 9, 4 / 1 | decide UI |
| html_tags | `<div`, `<p`, `<a` ... before a space or `>` | 3,894 / 35 | decides UI at 50 or more: 18 modules have 88 to 396, 17 have 1 to 22. Below 50 most hits are placeholders in sentences (`public-read/door.mjs:69` `"<a published case's id>"`) |
| cf_import, platform_class, block_start | `"cloudflare:..."`, `extends DurableObject`, `blockConcurrencyWhile(` | 1 / 1, 1 / 1, 3 / 1 | decide launcher |
| alarm_set | `setAlarm(` | 2 / 1 | decides middleware (`scheduler`) |
| new_response, new_request | `new Response(`, `new Request(` | 54 / 11, 73 / 12 | shown only: `await new Response(out).text()` is a stream read (`formats-xlsx.mjs:739`) |
| do_call | `http://do/`, `http://x/` | 113 / 21 | shown only: also a Request built for a local function (`file-safety/index.mjs:948`) and one object asking another (`ai-runs/index.mjs:2320`) |
| dom, word_calls, env names | `querySelector(` and the like; `word(`, `localize(`, `hasWord(`; `env.NAME` | 188 / 12; 12,827 / 164; 46 modules | shown only. dom first counted any `document.` and hit a record's `document`; env names are bindings and plain settings alike |
| cookie | `cookie`, any case | 4 / 3 | none sets or reads one: a word test (`reading-pipeline/html.mjs:65`, twice), a name in a list (`public-read/reads.mjs:25`), a word row |

## The five layers as rules over the signals

Only the code the plane's program holds is judged. A module claims a layer when a deciding signal is above zero (or at the stated floor).

- **Model.** It creates or alters tables, runs SQL on the object's storage, or exports its own op map: it keeps the record or reads and writes its rows, and answers its own ops with plain values.
- **Middleware.** It carries a request, an answer or a wake between the door and the record without being either: it imports two or more other modules' op maps, declared ops or door handlers (dispatch and assembly); or it reads the object's answer with `doAnswer`, which makes it a handler that reaches the record through the object's `fetch` and not through SQL; or it sets the object's alarm.
- **Control plane.** The router at the instance's address: it imports the screens' `SCREENS` and answers every outside request by method, path and op.
- **Launcher.** What the platform loads, builds or starts: a `cloudflare:` import, a class extending the platform's, or work handed to the platform's start gate; with the Worker's configuration.
- **UI.** What a member's browser draws or runs: it exports `SCREENS`, or holds 50 or more HTML tags, or holds the stylesheet, font and icon bodies.
- **Outside the five.** The plane's program holds none of its code, or it owns another deployable's `wrangler.jsonc`. Sub-classes: fleet-member (a Worker `bio-plane/wrangler.jsonc` binds, and `agent-runner`, which `agent-worker` binds), fleet-library (held only by fleet members' programs), installer, site, other-deployable, tooling, documents, and shared-foundation (rule P).
- **Rule P, for a plane-held module whose code claims no layer** (pure functions, grammar or data; or a reach outside with no table and no op). It is placed by the plane-held files of other modules that import it, each counted as the layer of its module or of its part. Three files that import from 80 or more modules (the next imports from 32) import to assemble and are not counted: `store-assembly/assemble.mjs` (104), `answer-envelope/families.mjs` (87), `store-assembly/declarations.mjs` (82). [MEASURED: `S --fanout`] The module takes the lowest layer among its users, in the owner's order; when its users include the model and at least two other layers it is a shared foundation, outside the five. A user placed by rule P counts as the layer it got; one that is a shared foundation hands on its own users only when there is no other user.
- **AMBIGUOUS.** Its code claims two or more layers. The parts are given by file where the files separate, and by function and line where one file holds both.
- **Reading set the rule aside four times.** `signin-door` (the rule sees its op map only); `roster-reader`, `court-doctypes`, `budget-doctypes` (their one user is the file that registers them).

## Counts

[MEASURED: `S --layers`, second block; lines by `S --sizes`]

| layer | modules | sub-classes | plane-held lines |
|---|---|---|---|
| model | 132 | 77 create tables; 9 run SQL but create none; 2 have an op map and no SQL (`promotion`, `explore`); 43 pure (40 by rule P, 3 by reading); `reading-pipeline` calls fleet members, with no table and no op (rule P) | 306,465 |
| middleware | 6 | `scheduler`, `answer-envelope`, `store-door`, `store-request`; `op-capabilities` and `op-declarations` by rule P | 17,482 |
| control plane | 0 | (one part of `control-plane`) | 2,639 |
| launcher | 0 | (parts of `plane` and `store-assembly`) | 244 |
| UI | 19 | 9 export `SCREENS`, 8 are screen parts, `interface-shell`, `interface-assets` | 40,280 |
| AMBIGUOUS | 20 | 17 middleware + model; `store-assembly` launcher + middleware + model; `control-plane` control plane + middleware; `plane` launcher + middleware | counted in their parts' layers |
| outside | 27 | 6 shared-foundation (`setup-words`, `record-grammar`, `runtime-limits`, `op-grade-tranches`, `op-grades`, `skills`); 6 fleet-member; 4 fleet-library (`agent-harness`, `agent-model`, `agent-steps`, `agent-worker-routes`); 4 installer; `site`; `stewards`; 4 tooling (`test-support`, `bundler`, `release`, `journey-check`); `documents` | 37,032 in the shared foundations |

## The 20 AMBIGUOUS modules

Each entry gives the smaller part and a line read; the other part's signals are in the table. Lines per part: [MEASURED: `S --sizes`].

**Model, with a handler that runs outside the object (middleware): 14.** The handler is handed the door's helpers (`json`, `doAnswer`, a stub) and calls the object.

- 49 `host-governor`: in the class's own file. [READ: `host-governor/index.mjs:429` `export async function governorOpResponse(op, url, store, { json, doAnswer, ...`]
- 51 `provenance`: in the op map's file. [READ: `provenance/ops.mjs:80` `const aOut = await doAnswer(store.fetch("http://do/registeraudit"));`]
- 52 `attestation`: `ops.mjs`, 49 lines. [READ: `attestation/ops.mjs:36` ``const hOut = await doAnswer(store.fetch(`http://x/registerholds?sha256=...`` ]
- 56 `capture`: `ops.mjs`, 314 lines. [READ: `capture/ops.mjs:230` ``const r = await doAnswer(store.fetch(`http://x/acquire?${q}`, ...``]
- 57 `doorbell`: `door.mjs`, 170 lines. [READ: `doorbell/door.mjs:124` ``const out = await doAnswer(store.fetch(new Request(`http://do/knock?source=...``]
- 62 `extraction`: `ops.mjs`, 147 lines. [READ: `extraction/ops.mjs:32` `try { const r = await store.fetch(path, init); ...`]
- 68 `connections`: `ops.mjs`, 42 lines. [READ: `connections/ops.mjs:27` ``const p = await doAnswer(store.fetch(`http://x/projectlinks?capture=${capture}` ``]
- 118 `publication`: `door.mjs`, 122 lines. [READ: `publication/door.mjs:58` ``const fOut = await doAnswer(stub.fetch(`http://do/caseflags?${q}`));``]
- 121 `public-read`: `door.mjs` and `publication/worker.mjs`, 1,257 lines of 4,788. [READ: `public-read/door.mjs:75` ``const out = await doAnswer(stub.fetch(new Request(`http://do/${op}?${q}`)));``]
- 125 `ratification`: `ops.mjs`, `finding.mjs`, `casefile.mjs`, 1,257 lines of 4,111. [READ: `ratification/ops.mjs:115` ``... doAnswer(stub.fetch(`http://do/list?viewer=...`` ]
- 149 `monitoring`: in the class's own file. [READ: `monitoring/index.mjs:3904` `export async function monitorOp(req, store, { json, storeSilent, ... doAnswer,`]
- 156 `affordances`: `door.mjs`, 127 lines; the rest reads other modules' rows (`affordances/facts.mjs:96` `const rows = [...this.sql.exec(`) and holds the table of acts. [READ: `affordances/door.mjs:102` `... doAnswer(stub.fetch("http://do/actionkinds")), ...`]
- 164 `queue`: `door.mjs`, 59 lines. [READ: `queue/door.mjs:43` `const qOut = await doAnswer(store.fetch(inner.toString()));`]
- 166 `instance-setup`: `livefire.mjs`, and in `setup.mjs`, the file of the class and its 24 `CREATE TABLE` statements, the handlers from line 3220. [READ: `setup.mjs:3220` `export async function publicInstanceGroup(env, storeName, projection = "instancegrouppublic", doAnswer) {`]. `setup-fleet.mjs:68` also returns an HTML block (`` return `<div class="${escBlock(cls)}" id="hosting-control">... ``), which the installer imports (`newgroup/src/index.mjs:54`).

**Middleware, with tables of its own (model): 3.**

- 169 `admission`: the gates the door calls are middleware (`index.mjs`, `checks.mjs`, 1,859 lines) [READ: `admission/index.mjs:1336` `const r = await bioStore(env).fetch(new Request("http://do/doorwindow", {`]; `window.mjs` (228 lines) keeps two counter tables and an op map [READ: `admission/window.mjs:53` ``const SCHEMA = `CREATE TABLE IF NOT EXISTS ${DOOR_WINDOW_TABLE} (``].
- 172 `signin-door`: the rule sees only `ops.mjs`'s op map [READ: `signin-door/ops.mjs:43` `export function signinDoorOps(c, url, body, env) {`], five routes on credentials' instance and no table. `index.mjs` (283 lines) is a handler the router calls with its own store function and that sends each step to a fleet member [READ: `signin-door/index.mjs:128` `res = await w.fetch("https://agent-worker/signin", { method: "POST",`; `control-plane/index.mjs:1464` `const signed = await subscriptionSignin({ env, member: stampOf.by, asked: reqBody, store: stored });`]. Placed by reading.
- 173 `store-services`: eight files assemble the owners' declarations and carry the ask to `agent-worker` [READ: `store-assembly/declarations.mjs:191` `export function assembleDeclaredOps(owners = OWNERS, registrars = [...`]; `pending.mjs` and `acquire-timings.mjs` (1,157 lines) keep five tables and two op maps [READ: `store-assembly/pending.mjs:73` ``export const KEEPS_PENDING_DDL = `CREATE TABLE IF NOT EXISTS keeps_pending (``].

**Three layers in one function: 174 `store-assembly`.** In `assembleStore` (`store-assembly/assemble.mjs:220`): launcher [READ: `store-assembly/assemble.mjs:584` `ctx.blockConcurrencyWhile(async () => migrate());`]; middleware [READ: `:777` `...membershipOps(membershipOf(ctx), url, body, env),`, the route map of 84 modules' op maps]; SQL of its own [READ: `:680` ``if (have.length && !have.includes(column)) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);`` on `bundles`, which `record-core/schema.mjs:5` creates]. The files do not separate these.

**Control plane + middleware: 195 `control-plane`.** The router, pages and assets: `index.mjs`, `app.mjs`, `phase-clock.mjs`, `words-cache.mjs` (2,639 lines) [READ: `control-plane/index.mjs:957` `if (req.method === "GET" && (url.pathname === "/version" || url.pathname === "/version/"))`]. Particular ops handled beside it: `archive.mjs`, `draft.mjs`, `jobs.mjs`, `job-state.mjs`, `reading-gate.mjs` (431 lines) [READ: `control-plane/archive.mjs:102` `const out = await doAnswer(stub.fetch(new Request("http://do/promote", { method: "POST",`]. In `index.mjs`, `deliverOwedRender` (line 743) runs in the object on its alarm, on the model's instances [READ: `control-plane/index.mjs:786` `const record = recordOf(ctx), promotion = promotionOf(ctx);`]. The do_answer count (29) does not separate the router's own forward from these; reading did.

**Launcher + middleware: 196 `plane`.** Launcher: `index.mjs`, `store.mjs`, `watchdog.mjs`, `arrival.mjs` (244 lines) and `bio-plane/wrangler.jsonc` [READ: `plane/store.mjs:27` `export class Store extends DurableObject {`]. Middleware: `door.mjs` (132 lines), which handler answers which op and the stamps each is handed; it imports 15 modules' door handlers [READ: `plane/door.mjs:89` `if (op === "ask") return askOp({ req, url, env, viaSession, ...`].

## Where else the picture does not fit

1. **The control plane imports the UI.** `control-plane` imports 12 UI modules: `interface-shell`, `interface-assets`, `screens-capture` and nine `SCREENS` (`control-plane/index.mjs:39`, `:53` to `:62`, `control-plane/app.mjs:21`). No other plane-held module outside the UI imports one; outside the five, `installer` and `site` import `interface-assets` and `journey-check` imports eleven. The UI's own imports from below: `setup-words`, `record-grammar`, `op-grades`, `op-declarations`, `wizard-scripts`. No owned code imports a later module. [MEASURED: `S --facts`, first three blocks and `imports of a later module ...: 0`]
2. **A screen's function runs inside the object.** [READ: `control-plane/index.mjs:797` `const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc, title, locator: address, project });`, in `deliverOwedRender`; `screens-intake/capture.mjs:144` `async function promoteDocument(cs, o) {` writes a bundle's text and sends `allocid` and `promote`]. `screens-capture` (182) is UI by its signals (H100) and is not marked AMBIGUOUS.
3. **The object's class imports the router's module.** [READ: `plane/store.mjs:12` `import { deliverOwedRender } from "../control-plane/index.mjs";`]
4. **The object calls the Worker's own door.** [READ: `store-assembly/pending.mjs:748` `const res = await timed(row).SELF.fetch(new Request("https://self/api/?op=unpack", { method: "POST",`]
5. **Sentences are composed in every layer.** `word()`, `localize()` or `hasWord()` is called 12,827 times in plane-held code, in 164 modules: 128 of the 132 model modules (10,773 calls), 18 AMBIGUOUS (1,433), 5 middleware (34), 5 UI (15), and the shared foundations and two fleet members' plane-held files (572). The word list is 27,061 rows, 19,562 from the design's file and 7,499 written first in code. [MEASURED: `S --facts`, `word_calls ... by layer`; rows counted by loading `setup-words/rows.mjs` and counting `WORD_ROWS` by its sixth field]. So `setup-words` (2) is a shared foundation by rule P and holds the words the UI shows.
6. **HTML is made below the UI in two places.** `case-grammar/complete.mjs` returns the published case's complete edition as one HTML file [READ: `case-grammar/complete.mjs:178` ``const p = (s) => `<p>${esc(s)}</p>`;``, `:226` `export function completeEditionOf(caseFile) {`]: a document, not a screen. `setup-fleet.mjs:68` is above. The other 14 modules have 1 to 4 hits; the first of each, read in `S --facts`, is a placeholder in a sentence, an SQL comment, an Atom feed (`docket/feed.mjs:41`), a script nonce (`answer-envelope/index.mjs:102`), a captured page's doctype (`browserrender.mjs:661`) or a stored page's banner (`subresources.mjs:692`).
7. **The platform is touched below the launcher.** `"cloudflare:workers"` is imported only in `plane/store.mjs`; the alarm is called only in `scheduler` and `plane/store.mjs`; the start gate only in `store-assembly`. But 46 plane-held modules name an env binding, among them 26 model modules (`reading-pipeline`: `PDF_WORKER`, `OCR_WORKER`; `ai-runs`: `AGENT_WORKER`, `STORE`). [MEASURED: `S --facts`, env block and `plane-held code with cf_import ...`]
8. **Deployables share code.** `agent-worker`'s program holds 158 files of 42 plane-layer modules; `newgroup`'s 23 of 7; `ocr-worker`'s 14 of 6. The plane's program holds 4 files of `file-scanner`, 1 of `sheet-worker`, and `image-codecs` and `pdf-pixels` (model by rule P), which lie under `pdf-worker/src/`. [MEASURED: `S --facts`, `files of plane-layer modules held by other deployables' programs`; table]
9. **Rule P is a placement by users, not by what the code does.** It places 49 modules: 41 model, 2 middleware, 6 shared foundations; `layers.json` lists each one's importing layers. Three more had only the registering file as a user and were placed in the model by reading: [READ: `roster-reader/index.mjs:30` `export function registerRosterTypes(register) {`; `store-assembly/wiring.mjs:29` `["roster-reader", registerRosterTypes(register)],`]; `court-doctypes` and `budget-doctypes` likewise (`store-assembly/wiring.mjs:30`, `:31`).

## Other modules the brief named

- `store-door` (171), middleware: it calls the handler the op names [READ: `store-door/dispatch.mjs:413` `const answer = await map[op]();`]. `store-request` (175): `store-request/index.mjs:132` `export function innerRequest(args = {}) {`. `answer-envelope` (170): `answer-envelope/index.mjs:152` `const json = (o, status = 200) =>`.
- `scheduler` (152), middleware: no table, no op; it sets the alarm [READ: `scheduler/index.mjs:741` `await this.#storage.setAlarm(lease);`] and imports from 28 other modules [MEASURED: `S --fanout`].
- `op-declarations` (168) and `op-capabilities` (167), middleware by rule P: `op-declarations`' users are admission's gates, store-request, the router, `plane/door.mjs` and four UI modules, and no model file. `op-grades` (39) and `op-grade-tranches` (38), shared foundation: used by `affordances.mjs` (model part), `store-assembly/wizards.mjs` and `interface-shell`. [MEASURED: `S --importers`]
- `act-help` (155), `wizard-library` (153), `queue-words` (160), `queue-catalogue` (163): pure, model by rule P (users: `affordances`, `wizard-scripts`, `queue-producers`, `queue`). `wizard-library` holds the design's screen registry [READ: `wizard-scripts/screen-registry.mjs:11` `export const SCREEN_REGISTRY = deepFreeze([`], which `interface-shell` imports from `wizard-scripts` (`interface-shell/index.mjs:12`).
- `wizard-scripts` (154), `translations` (165), `credentials` (47), `membership` (43), `queue-producers` (161): model by their table rows; `credentials` keeps the sessions [READ: `credentials/index.mjs:249` ``this.sql.exec(`CREATE TABLE sessions (token_sha TEXT PRIMARY KEY, ...``].
- `interface-assets` (176), UI: `interface-assets/index.mjs:11` `"civicsmith.css": Object.freeze({ type: "text/css", body: ...`; its `generate.mjs` is a build tool. `interface-shell` (177), UI: `interface-shell/index.mjs:590` ``return `<!doctype html>``. Each of the 17 `screens-*` modules is UI: 88 to 396 HTML tags; T, R and O zero.
- `bundler`, `release`, `test-support`, `journey-check`: tooling, with no file in the plane's program (though `journey-check` lies under `bio-plane/src/`). `installer*`, `site`, `stewards`: Workers of their own, each with its `wrangler.jsonc`. `documents`: 4,894 owned files, 4,731 of them `.md`.

## The layers in the current order

[MEASURED: `S --order`] Positions of single-layer modules; "with parts" counts an ambiguous module in each layer it has a part in.

| layer | modules | lowest | highest | with parts |
|---|---|---|---|---|
| model | 132 | 4 | 165 | 150 modules, 4 to 174 |
| middleware | 6 | 152 | 175 | 26 modules, 49 to 196 |
| control plane | 0 | | | 1 module, 195 |
| launcher | 0 | | | 2 modules, 174 and 196 |
| UI | 19 | 176 | 194 | the same |

Outside the five: positions 1 to 3, 9, 10, 12, 34 to 39, 102, 105 to 110 and 197 to 204.

**A lower layer's module after a higher layer's, by the owner's stacking** (model, middleware, control plane, launcher, UI):

- Single-layer modules only: 11, all model after `scheduler` (152): `wizard-library` 153, `wizard-scripts` 154, `act-help` 155, `tasks` 157, `machinery-producers` 158, `action-producers` 159, `queue-words` 160, `queue-producers` 161, `notice-producers` 162, `queue-catalogue` 163, `translations` 165.
- Taking the ambiguous modules by their parts: `control-plane` (195: control plane, middleware) and `plane` (196: launcher, middleware) sit after all 19 UI modules (176 to 194). `control-plane` and `store-request` (175, middleware) sit after `store-assembly` (174), which has a launcher part; `plane`'s middleware part sits after `control-plane`. Model after a middleware part: 113 of the 150 modules with a model part sit after `host-governor` (49), the first module with a middleware part; among them the 11 above and the model parts of `affordances` 156, `queue` 164, `instance-setup` 166, `admission` 169, `signin-door` 172, `store-services` 173 and `store-assembly` 174, which sit after `scheduler`.

**By today's stacking** (model, middleware, UI, control plane, launcher):

- Single-layer modules only: the same 11.
- By parts: the middleware parts of `control-plane` (195) and `plane` (196) sit after the 19 UI modules; all 19 UI modules, `control-plane` and `store-request` sit after `store-assembly` (174) taken as launcher; model after a middleware part as above. `plane` as launcher sits after no higher layer, and `control-plane` as control plane after `store-assembly`'s launcher part only.

## The table

One row per module, in order [MEASURED: `S --table`]: position module|layer|code files, signals|the line read (quoted in `layers.json`; `~` is the module's own folder, `bio-plane/src/<module>`). Layer: `/pure` and `/reach` mark a module placed by rule P or by reading; `out/` is outside the five; `mid+mod` and the like name an ambiguous module's candidates, and its line is its first part's. Code files: scanned files, as `held/scanned` when the plane's program does not hold them all. Signals above zero in plane-held code: T create+alter table, R sql_exec, O ops_map, A do_answer, Q new Response+Request, F network or fleet call, S `SCREENS`, H HTML tags, B DOM, W word calls, K cf import + platform class + start gate + setAlarm, X other modules' op maps + `DECLARED_OPS` + door handlers + `SCREENS` imported, E env names.

```
1 documents|out/documents|0/1|docs/development/ux-substrate/screens/build_words.mjs:17
2 setup-words|out/shared|2/3 H4 W5|~/index.mjs:57
3 record-grammar|out/shared|15 W166|~/frontmatter.mjs:83
4 jurisdiction-profiles|model/pure|2|jurisdictions/profiles/oakland-alameda.mjs:65
5 jurisdictions|model/pure|1 W158|~/index.mjs:277
6 civil-time|model/pure|9 W83|~/days.mjs:16
7 calc-grammar|model/pure|6 W62|~/decimal.mjs:24
8 connection-grammar|model/pure|7 W52|~/index.mjs:16
9 test-support|out/tooling|0/15|bio-plane/test/platform-sqlite.mjs:28
10 runtime-limits|out/shared|5 W1 E3|cpu.mjs:63
11 signatures|model/pure|2/3|sshsig.mjs:119
12 bundler|out/tooling|0/4|bio-plane/scripts/fleet-bundle.mjs:1542
13 court-citations|model/pure|2/4|~/index.mjs:57
14 id-spaces|model/pure|1 W67|idspaces.mjs:164
15 subresources|model/pure|1 H2 W25|subresources.mjs:446
16 ooxml|model/pure|1|ooxml.mjs:123
17 csv-reader|model/pure|1 W15|~/index.mjs:145
18 office-readers|model/pure|5 Q1 W5|docx.mjs:418
19 odf-reader|model/pure|1 W19|odf.mjs:2826
20 pdf-reader|model/pure|1 W1|pdfstructure.mjs:1506
21 format-registry|model/pure|1 H1 W8|formats.mjs:69
22 text-chain|model/pure|1 W75|textchain.mjs:591
23 site-profiles|model/pure|9 W18|~/index.mjs:99
24 docprofile|model/pure|6 W37|~/doctypes/index.mjs:177
25 doctypes|model/pure|12 W135|~/index.mjs:42
26 legistar-reader|model/pure|1 W27|~/index.mjs:66
27 roster-reader|model/pure|7 W70|~/index.mjs:30
28 court-doctypes|model/pure|5 W59|~/index.mjs:23
29 budget-doctypes|model/pure|6 W48|~/index.mjs:272
30 image-codecs|model/pure|6 W109|pdf-worker/src/mq.mjs:61
31 pdf-pixels|model/pure|3/4 W28|pdf-worker/src/pagepixels.mjs:357
32 image-cover|model/pure|5 W75|~/index.mjs:72
33 doc-clean|model/pure|6 W89|~/index.mjs:44
34 pdf-worker|out/fleet|0/2|~/src/index.mjs:362
35 ocr-worker|out/fleet|0/9|~/src/index.mjs:71
36 sheet-worker|out/fleet|1/10 W9|~/src/index.mjs:22
37 file-scanner|out/fleet|4/20 Q1 W118|~/src/worker.mjs:21
38 op-grade-tranches|out/shared|16 W28|op-grades/t33.mjs:22
39 op-grades|out/shared|2 W15|~/index.mjs:105
40 member-roster|model|5/6 T14 R32 O1 W112 E1|~/schema.mjs:10
41 record-core-tables|model|2 T12 W45|record-core/schema.mjs:5
42 record-core|model|1 T3 R42 O1 W57|~/index.mjs:1726
43 membership|model|4 T5 R17 O1 W29 X1 E1|~/schema.mjs:15
44 project-roster|model|3 T6 R13 O1 W59|~/schema.mjs:16
45 ai-accounts|model|3 T12 R32 O1 H1 W76 E1|~/schema.mjs:12
46 credentials-tables|model|2 T14 W37|credentials/schema.mjs:11
47 credentials|model|1 T3 R55 O1 W86 X1 E2|~/index.mjs:249
48 promotion|model|9 O1 W64|~/index.mjs:1278
49 host-governor|AMBIGUOUS mid+mod|2 T1 R10 A1 E1|~/index.mjs:429
50 provenance-register|model|4 T6 R6 W30|provenance/schema.mjs:12
51 provenance|AMBIGUOUS mid+mod|2 R11 O1 A1 W41 E1|~/ops.mjs:80
52 attestation|AMBIGUOUS mid+mod|4 T2 R4 A1 F1 W25 E1|~/ops.mjs:36
53 provenance-routes|model|4 T1 R3 O1 W62|~/schema.mjs:39
54 capture-sources|model|8 T1 R6 O1 F1 H1 B3 W143 E4|~/credentials.mjs:80
55 acquisition|model|6 T3 R11 F8 W173 E4|~/unpack.mjs:229
56 capture|AMBIGUOUS mid+mod|6 T25 R59 O1 A5 Q1 H2 W169 E4|~/ops.mjs:230
57 doorbell|AMBIGUOUS mid+mod|4 T7 R15 O1 A2 Q2 W46 E5|~/door.mjs:124
58 file-safety|model|8 T11 R47 O1 Q6 W75 X1 E2|~/schema.mjs:9
59 sources|model|3 T7 R9 O1 W19|~/schema.mjs:11
60 calibration|model|4 T3 R8 O1 W42|~/schema.mjs:29
61 reading-pipeline|model/reach|4 F2 W135 E2|~/index.mjs:152
62 extraction|AMBIGUOUS mid+mod|9 T15 R62 O1 A1 Q1 W126 E3|~/ops.mjs:32
63 content|model|7 T10 R18 O1 W299|~/schema.mjs:32
64 entities|model|4 T12 R25 O1 W123|~/schema.mjs:11
65 events|model|9 T15 R29 O1 W233|~/schema.mjs:8
66 lines|model|4 T5 R8 O1 W86|~/schema.mjs:4
67 local-facts|model|5 T2 R7 O1 W73|~/schema.mjs:10
68 connections|AMBIGUOUS mid+mod|8 T13 R33 O1 A1 H1 W188 E2|~/ops.mjs:27
69 observation-log|model|4 T4 R7 O1 W202|~/schema.mjs:58
70 law-relations|model|3 T6 R8 W34|~/schema.mjs:13
71 standards|model|5 T17 R25 O1 W202|~/schema.mjs:14
72 progressions|model|3 T11 R16 O1 W75 E1|~/schema.mjs:28
73 money|model|3 T10 R15 O1 B1 W163|~/schema.mjs:15
74 money-checks|model|3 T7 R5 O1 W57|~/schema.mjs:10
75 duties|model|4 T6 R6 O1 W212|~/schema.mjs:8
76 people|model|3 T15 R24 O1 W57|~/schema.mjs:12
77 explore|model|11 O1 W59|~/ops.mjs:11
78 bias|model|3 T6 R13 O1 W56 E2|~/schema.mjs:38
79 query-language|model/pure|1 W39|query.mjs:52
80 retrieval-browse|model|6 R1 W40|~/index.mjs:43
81 retrieval|model|9/10 T7 R40 W34|~/fields.mjs:25
82 calculations|model|6 T18 R39 O1 H1 W211|~/schema.mjs:12
83 workbooks|model|7 T7 R19 O1 W32|~/schema.mjs:10
84 inquiry-grammar|model/pure|3 W280|~/index.mjs:19
85 accepted-work|model/pure|2 W8|~/index.mjs:232
86 leg-earning|model|2 T2 R8 O1 W46|~/schema.mjs:76
87 inquiry|model|7 T10 R34 O1 W132|~/schema.mjs:39
88 hypotheses|model|3 T12 R32 O1 W44|~/index.mjs:204
89 steps|model|3 T16 R31 W47|~/schema.mjs:8
90 citation|model|4 R1 O1 W160|~/recorded.mjs:118
91 basis-version-grammar|model/pure|3 W78|~/checks.mjs:104
92 basis-versions|model|6 T3 R9 O1 H1 W197|~/schema.mjs:13
93 strength|model|7 T3 R8 O1 W182|~/schema.mjs:24
94 contradiction-words|model/pure|2 H1 W45|contradiction.mjs:33
95 contradiction|model|4 T6 R8 O1 B1 W196|~/schema.mjs:17
96 run-rules|model/pure|7 W83|~/checks.mjs:21
97 ai-use|model|3 T9 R18 O1 W84 E1|~/schema.mjs:12
98 ai-runs|model|2 T8 R20 O1 F1 W104 E7|~/schema.mjs:49
99 run-productions|model|4 T7 R17 O1 W80|~/schema.mjs:34
100 capture-requests|model|3 T5 R22 O1 W77 E5|~/schema.mjs:53
101 reading-guides|model|5 T4 R10 O1 W66|~/schema.mjs:11
102 skills|out/shared|2 W230|skillpack.mjs:374
103 question-explorer|model|4 T8 R17 W1|~/schema.mjs:10
104 answers|model|10 T5 R21 O1 W26|~/schema.mjs:8
105 agent-harness|out/fleet-lib|0/2|~/src/harness.mjs:563
106 agent-model|out/fleet-lib|0/4|~/src/apikey.mjs:14
107 agent-runner|out/fleet|0/15|~/src/worker.mjs:90
108 agent-steps|out/fleet-lib|0/10|~/src/index.mjs:4
109 agent-worker-routes|out/fleet-lib|0/8|agent-worker/src/ask.mjs:73
110 agent-worker|out/fleet|0/3|~/src/index.mjs:798
111 intent|model|5 T3 R5 O1 W96|~/schema.mjs:12
112 investigation|model|4 T11 R26 O1 W75|~/schema.mjs:7
113 reevaluation|model|3 T11 R20 O1 W78 E1|~/schema.mjs:19
114 case-grammar|model/pure|20 H22 W50|~/index.mjs:91
115 corpus-export|model|4 T2 R8 O1 W29|~/schema.mjs:10
116 case-carriage|model|3 T11 R25 O1 W51|~/schema.mjs:15
117 case-tensions|model|3 T4 R9 O1 W40|~/schema.mjs:51
118 publication|AMBIGUOUS mid+mod|5 T12 R36 O1 A2 W67|~/door.mjs:58
119 publish-schedule|model|4 T2 R9 O1 W18|~/schema.mjs:21
120 docket|model|4 T4 R11 O1 H3 W41 E1|~/schema.mjs:13
121 public-read|AMBIGUOUS mid+mod|12 R2 O1 A14 Q12 H4 B2 W98 E1|~/door.mjs:75
122 project-stage|model|1 R2 O1 W9|~/index.mjs:115
123 network-notices|model|4 T9 R16 O1 W30 E2|~/schema.mjs:11
124 case-catalogue|model/pure|1 W127|~/checks.mjs:106
125 ratification|AMBIGUOUS mid+mod|9 R4 O1 A14 Q4 F1 W124 E4|~/ops.mjs:115
126 case-checker|model/pure|8/9 W167|~/index.mjs:93
127 case-import|model|4 T21 R25 O1 W66 E1|~/schema.mjs:20
128 case-disclosures|model|6 R2 W229|~/index.mjs:176
129 case-account|model|4 T3 R6 O1 W41|~/schema.mjs:14
130 case-inputs|model|5 T6 R10 O1 H1 W105|~/schema.mjs:18
131 case-document|model/pure|2 W98|case-authoring/document.mjs:72
132 case-authoring|model|2 R2 O1 W115|~/index.mjs:342
133 review|model|3 T6 R12 O1 W70|~/schema.mjs:19
134 case-check|model|3 T1 R4 O1 W6|~/schema.mjs:9
135 conformance|model|3 T14 R18 O1 W99|~/schema.mjs:19
136 consequences|model|4 T7 R12 O1 W172|~/schema.mjs:23
137 action-grammar|model/pure|5 W188|~/checks.mjs:54
138 action-records|model|2 T8 R14 O1 W50 E1|~/schema.mjs:38
139 actions|model|2 T7 R15 O1 W71 E1|~/schema.mjs:38
140 action-holds|model|3 T7 R11 O1 W45 E1|~/schema.mjs:13
141 action-clocks|model|5 T3 R11 O1 W135 E1|~/schema.mjs:12
142 action-replies|model|3 T4 R8 O1 W32 E1|~/schema.mjs:8
143 filing-templates|model|4 T11 R26 O1 W151 E1|~/schema.mjs:18
144 filing-texts|model/pure|2 W29|filings/outward.mjs:20
145 filings|model|4 T12 R15 O1 W434 E1|~/schema.mjs:12
146 escalation|model|5 T7 R4 O1 W168|~/schema.mjs:12
147 action-plans|model|5 T10 R20 O1 W142|~/schema.mjs:14
148 plan-work|model|3 T9 R12 O1 W52|~/schema.mjs:10
149 monitoring|AMBIGUOUS mid+mod|4 T8 R20 O1 A1 Q1 W140 E3|~/index.mjs:3904
150 following|model|6 T14 R32 O1 W108|~/schema.mjs:10
151 link-sweep|model|5 T2 R4 O1 W106|~/schema.mjs:10
152 scheduler|middleware|1 W2 K2 E1|~/index.mjs:741
153 wizard-library|model/pure|4/5 W3|wizard-scripts/screen-registry.mjs:11
154 wizard-scripts|model|6 T12 R22 O1 W108 E1|~/schema.mjs:16
155 act-help|model/pure|1 W5|affordances/act-help.mjs:289
156 affordances|AMBIGUOUS mid+mod|4 R1 O1 A3 W7|~/door.mjs:102
157 tasks|model|3 T7 R17 O1 W38 E2|~/schema.mjs:22
158 machinery-producers|model|1 R1 W62|~/index.mjs:85
159 action-producers|model|2 R1 W45|~/index.mjs:105
160 queue-words|model/pure|1 W4|queue-producers/words.mjs:10
161 queue-producers|model|2 R1 W127|~/index.mjs:166
162 notice-producers|model|2 R1 W65|~/index.mjs:371
163 queue-catalogue|model/pure|1 W10|queuestate.mjs:69
164 queue|AMBIGUOUS mid+mod|4 T4 R8 O1 A1 W99 E1|~/door.mjs:43
165 translations|model|4 T7 R8 O1 W51|~/schema.mjs:21
166 instance-setup|AMBIGUOUS mid+mod|3 T25 R36 O1 A14 Q9 H6 W238 E11|setup.mjs:3220
167 op-capabilities|middleware/pure|1|~/index.mjs:32
168 op-declarations|middleware/pure|10 W6|~/index.mjs:2927
169 admission|AMBIGUOUS mid+mod|3 T2 R6 O1 A5 Q4 W6 E2|~/index.mjs:1336
170 answer-envelope|middleware|3 A2 Q3 H1 W14|~/index.mjs:152
171 store-door|middleware|3 Q6 W10 X4|~/dispatch.mjs:413
172 signin-door|AMBIGUOUS mid+mod|2 O1 F1 W6 E3|~/index.mjs:128
173 store-services|AMBIGUOUS mid+mod|10 T8 R38 O3 Q7 F5 W33 X80 E3|store-assembly/declarations.mjs:191
174 store-assembly|AMBIGUOUS lau+mid+mod|6 T1 R8 Q1 F1 W4 K3 X85 E10|~/assemble.mjs:584
175 store-request|middleware|2 A1 Q2 W2|~/index.mjs:132
176 interface-assets|ui|1/2 H4|~/index.mjs:11
177 interface-shell|ui|2 H294 B167 W2|~/index.mjs:590
178 screens-entry|ui|8 S1 H223|~/index.mjs:59
179 screens-wizards|ui|4 S1 H88|~/index.mjs:32
180 screens-account|ui|6 H242|screens-settings/account.mjs:80
181 screens-settings|ui|14 S1 H396|~/index.mjs:119
182 screens-capture|ui|1 H100 B1|screens-intake/capture.mjs:232
183 screens-intake|ui|8 S1 H216|~/index.mjs:262
184 screens-find|ui|10 H218 B6|screens-daily/answers.mjs:44
185 screens-daily|ui|13 S1 H154 B1|~/index.mjs:243
186 screens-document|ui|3 H206 B1 W7|screens-inquiry/common.mjs:129
187 screens-question|ui|2 H289 B1|screens-inquiry/assistant.mjs:104
188 screens-inquiry|ui|6 S1 H243 B2|~/index.mjs:23
189 screens-people|ui|7 H133 W1|screens-investigate/explore.mjs:32
190 screens-investigate|ui|10 S1 H196 B2 W3|~/index.mjs:35
191 screens-public|ui|7 H169|screens-publish/docket-public.mjs:24
192 screens-publish|ui|8 S1 H272|~/index.mjs:41
193 screens-send|ui|7 H206|screens-action/actionnew.mjs:62
194 screens-action|ui|13 S1 H193 W2|~/index.mjs:106
195 control-plane|AMBIGUOUS door+mid|9/10 A29 Q63 W16 X12 E6|~/index.mjs:957
196 plane|AMBIGUOUS lau+mid|5/6 Q3 K2 X15 E1|~/store.mjs:27
197 release|out/tooling|0/7|bio-plane/scripts/deploy.mjs:190
198 installer-account|out/installer|0/5|newgroup/src/steps/account.mjs:28
199 installer-steps|out/installer|0/14|newgroup/src/steps/bindings.mjs:33
200 installer-pages|out/installer|0/6|newgroup/src/ui.mjs:270
201 installer|out/installer|0/4|newgroup/src/index.mjs:1443
202 site|out/site|0/3|~/src/index.mjs:123
203 stewards|out/own-worker|0/6|~/src/index.mjs:281
204 journey-check|out/tooling|0/174|~/run.mjs:45
```

## What I did not check

- **Which side of the object each line runs on.** "Runs outside the object" rests on `doAnswer` being used and on reading the handlers' signatures and their calls from `plane/door.mjs` and `control-plane/index.mjs`. Nothing was run; a trace of one request per handler under workerd would settle it. [NOT CHECKED]
- **References other than imports** (evidence rule 7: files read at run time, paths held as text, Workers started). The plane's program is the import closure only. Why the manifest lacks `screens-action/words-fix-flaws.mjs` was not looked into. [NOT CHECKED]
- **Code that is not JavaScript, and the 11 generated or vendored files:** `.py`, `.rs`, `.sh`, wasm, `case-checker/program.mjs`, `newgroup/src/release.mjs`, the bundles under `dist/` and `release/`. [NOT CHECKED]
- **Tests.** Only `files` paths were scanned. [NOT CHECKED]
- **Each module whole.** For the 88 single-layer model modules with tables, SQL or an op map and the 19 UI modules I read the cited line and the first hits of each signal, not every file; the counts cover all their plane-held code. For the 20 ambiguous modules and those the brief named I also read the exports and the functions cited. A handler that reaches the object without `doAnswer` in a module I did not read at length would be missed; `plane/door.mjs`'s 15 imports were each checked against the list (`bias`'s `withBiasChecks`, `bias/checks.mjs:325`, is a pure check, not a handler). [NOT CHECKED beyond that]
- **Part sizes where one file holds two parts** (`host-governor`, `provenance`, `monitoring`, `instance-setup`, `store-assembly`, `control-plane`'s `deliverOwedRender`): the lines given are where the functions start; their lengths were not measured. [NOT CHECKED]
- **Whether a word row is member-facing.** word_calls counts calls; which sentences a member sees was not established. [NOT CHECKED]
- **The `uses` lists** in `process/modules/*.json` were not compared with the imports found here. [NOT CHECKED]
- **`documents`** is placed by its file types and its one scanned script; its documents were not read. [NOT CHECKED]
