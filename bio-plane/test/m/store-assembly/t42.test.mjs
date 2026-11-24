/* store-assembly's copy of plane's T42 test (K5200 item 99 (1); PLANE #62 J64 B5; T42's composition: plane R35's `caseAccount`, R36, R37, R38, R106; N826, N832, N839; K2611, K2630, K2634, K2635, K2656):
   the transcriber registered with extraction (R57, R58), doorbell composed after capture (R32), case-account built before review (R33) and handed to
   the owner map (R86). Each module's own behaviour is its own tests'; these check the composition through the assembled store's interface:
   construction over a storage, the route map, the transcriber the assembly registers. The Worker's hooks (`publicOp`, `gatedOp`: plane R112, R113, R6) and the
   Worker under Miniflare stay with plane. Each test carries a negative control (K874). */
import "../../../src/store-assembly/register.mjs";   /* R83: the start's registration before any op table is read */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { store, storage, assembleStore, disclosed } from "./fixture.mjs";
import { doorbellOf, doorbellOps } from "../../../src/doorbell/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { caseAccountOf } from "../../../src/case-account/index.mjs";
import { caseAuthoringOf } from "../../../src/case-authoring/index.mjs";
import { reviewOf } from "../../../src/review/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { CIVICSMITH_TEST_SET } from "../../../src/run-rules/index.mjs";
import { assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { transcriberOf, renderPages, TRANSCRIBE_PAGES_MAX, TRANSCRIBE_IMAGE_MAX_BYTES, TRANSCRIBE_LOAD_MAX, PAGES_MAX, OWED } from "../../../src/store-assembly/transcribe.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import * as AGENT_WORKER_OPS from "../../../../agent-worker/src/ops.mjs";
import { renderPageToPixels } from "../../../../pdf-worker/src/pagepixels.mjs";
import { pageRefusal } from "../../../../pdf-worker/test/pdf-pixels-fixtures.mjs";   /* pdf-pixels' published refusals, made by its real renderers */
import { word } from "../../../src/setup-words/index.mjs";

const SENTINEL = "sk-ant-SENTINEL-T42-0000";
const ONE_MATTER = Object.freeze({ id: "t42-set", version: 3, matters: Object.freeze([{ id: "m1" }]) });
const PASSED = { part: "transcribe", set: "t42-set", set_version: 3, false_alarm_rate: 0, passed: true, graded_by: "harness",
                 at: "2026-10-01T00:00:00Z" };
const SCAN = new Uint8Array(readFileSync(fileURLToPath(new URL("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf", import.meta.url))));
const shaOf = (b) => createHash("sha256").update(b).digest("hex");
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const USAGE = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
                total_cost_usd: 0.25 };

/* The evidence bucket (`CAPTURES`), in memory, counting its reads. */
function bucket() {
  const held = new Map(), calls = [];
  const object = (k, b) => ({ key: k, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  return { calls, held,
    async put(k, v) { const b = v instanceof Uint8Array ? v : new TextEncoder().encode(String(v)); held.set(k, b); return { key: k, size: b.length }; },
    async get(k) { calls.push(["get", k]); return held.has(k) ? object(k, held.get(k)) : null; },
    async head(k) { calls.push(["head", k]); return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async delete(k) { held.delete(k); },
    async list() { return { objects: [...held.keys()].map((key) => ({ key })), truncated: false }; } };
}

/* agent-worker's `/transcribe`, scripted: records every request; `answer(body)` is its JSON (or a function throwing). */
function agentWorker(answer = (b) => ({ ok: true, engine: "claude-test", version: null,
  pages: b.pages.map((p) => ({ page: p.page, text: `the AI's words on page ${p.page}` })), not_transcribed: [],
  usage: USAGE, calls: b.pages.length })) {
  const seen = [];
  return { seen, fetch: async (u, init) => { const body = JSON.parse(init.body); seen.push([u, body, init.body]);
    const a = answer(body);
    return typeof a === "string" ? new Response(a, { status: 200 })
      : new Response(JSON.stringify(a), { status: 200, headers: { "content-type": "application/json" } }); } };
}

/* An assembled store built by hand over a fresh storage, so a test may hand the transcriber its set before construction (K61: a
   factory reads its deps on the first call only). `ann` holds an API-key account; the group's keep-away is off. */
async function plane({ testSet = null, worker = null, evidence = bucket(), account = true } = {}) {
  const st = storage();
  const env = { STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t42-test", CAPTURES: evidence,
                ...(worker ? { AGENT_WORKER: worker } : {}) };
  /* R40 (T46): a test's own set is ai-runs', handed through `assistantGateOf` before construction */
  if (testSet) assistantGateOf(st.ctx, { testSet });
  const s = assembleStore(st.ctx, env);
  for (const p of st.blocked) await p;
  const ctx = st.ctx, sql = ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  if (account) {
    await disclosed(ctx);   /* R44 (T47): the disclosure first, as the assembled plane asks */
    const r = await credentialsOf(ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SENTINEL, by: "member:ann" });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const routes = (path, body = null) => s.routes(new URL("http://do" + path), body);
  const call = async (path, body = null) => {
    const op = new URL("http://do" + path).pathname.slice(1);
    return JSON.parse(JSON.stringify(await routes(path, body)[op]() ?? null));
  };
  return { s, ctx, env, evidence, routes, call, rows: (q, ...a) => [...sql.exec(q, ...a)] };
}
const hold = async (evidence, bytes) => { const d = shaOf(bytes); await evidence.put(`bio/captures/${d}`, bytes); return d; };

/* Every module that declared a table to purge, in declaration order (record-core R21), each named once. */
function declarers(ctx) {
  const rc = recordOf(ctx), out = [];
  for (const t of Object.keys(rc.purge().removed)) {
    const m = rc.declarePurge("zz-probe", [t]).declaredBy;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/* ===== R37 ===== */

const DOORBELL_METHODS = { knock: "knock", inboxlist: "inboxList", inboxget: "inboxGet", inboxresolve: "inboxResolve",
  doorbellrefused: "doorbellRefused", doorbelltally: "doorbellTally", inboxpull: "pullKnock", knocksof: "knocksOf",
  pulledknocks: "pulledKnocksOf" };

test("R32 (was plane R37; N826; K2630): doorbell is the plane's one instance per host, built at boot; each of its nine routes in the route map is answered by that instance, never by capture's doorbell copy", async () => {
  const x = await store();
  const d = doorbellOf(x.ctx);
  assert.equal(doorbellOf(x.ctx, { capture: { env: {} } }), d, "one instance per host");
  assert.deepEqual(Object.keys(doorbellOps(d, new URL("http://do/"), null)).sort(), Object.keys(DOORBELL_METHODS).sort());
  const reached = [], copy = [];
  const cap = captureOf(x.ctx);
  for (const [op, m] of Object.entries(DOORBELL_METHODS)) {
    d[m] = () => { reached.push(op); return { ok: true, by: "doorbell" }; };
    if (typeof cap[m] === "function") cap[m] = () => { copy.push(op); return { ok: true, by: "capture" }; };
  }
  for (const op of Object.keys(DOORBELL_METHODS)) {
    const r = await x.routes(`/${op}?id=k&capture=${"a".repeat(64)}`, { knockId: "k", contentText: "x" })[op]();
    assert.deepEqual(r, { ok: true, by: "doorbell" }, op);
  }
  assert.deepEqual(reached, Object.keys(DOORBELL_METHODS));
  assert.deepEqual(copy, [], "capture's copy is never reached through the route map");
  /* negative control: on a storage no plane was built on, doorbell is a different instance */
  assert.notEqual(doorbellOf(storage().ctx), d);
});

test("R32, R3 (was plane R37; K2629): doorbell's tables exist on a fresh store and after a second construction over the same storage; doorbell's declarations are held (capture's first) and file-safety still declares after capture", async () => {
  const x = await store();
  const tables = () => new Set([...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name));
  const { DOORBELL_SCHEMA } = await import("../../../src/doorbell/index.mjs");
  const names = [...DOORBELL_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  assert.ok(names.length >= 1);
  for (const t of names) assert.ok(tables().has(t), t);
  const again = await store({ db: x.db });
  for (const t of names) assert.ok(new Set([...again.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name)).has(t), `${t} again`);
  const order = declarers(x.ctx);
  assert.ok(order.indexOf("capture") >= 0 && order.indexOf("capture") < order.indexOf("file-safety"), order.join(","));
  /* negative control: a bare storage holds none of them */
  const bare = storage();
  for (const t of names) assert.equal([...bare.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE name=?`, t)].length, 0, t);
});

test("R33 (was plane R38; N839; K2608, K2656): case-account is built before review and case-authoring, with ai-runs' instance as its runs; one instance per host serves case-authoring, review and the door; it declares its tables before case-authoring", async () => {
  const x = await store();
  const ca = caseAccountOf(x.ctx);
  assert.equal(ca.runs, aiRunsOf(x.ctx), "the plane's ai-runs, the runs a draft names");
  assert.equal(caseAccountOf(x.ctx, { runs: { runFor: () => null } }), ca, "a later caller's deps change nothing");
  assert.equal(ca.runs, aiRunsOf(x.ctx));
  assert.equal(reviewOf(x.ctx).caseAccount, ca, "review's");
  assert.equal(caseAuthoringOf(x.ctx).account, ca, "case-authoring's");
  const order = declarers(x.ctx);
  /* T47 (N908): case-authoring declares no table since the split; case-inputs, created at its creation (R45), marks it */
  assert.equal(order.includes("case-authoring"), false, order.join(","));
  assert.ok(order.includes("case-account") && order.includes("case-inputs")
            && order.indexOf("case-account") < order.indexOf("case-inputs"), order.join(","));
  /* negative control: another host's case-account is another instance, and holds other runs */
  const bare = storage();
  assert.notEqual(caseAccountOf(bare.ctx, { runs: { runFor: () => null } }), ca);
  assert.notEqual(caseAccountOf(bare.ctx).runs, aiRunsOf(x.ctx));
});

test("R86 (was plane R35; T42; N839; K2656; control-plane R71): the owner map's account ops reach the plane's case-account instance through its `caseAccount` getter, never case-authoring's pass-through", async () => {
  const x = await store();
  const ca = caseAccountOf(x.ctx), cau = caseAuthoringOf(x.ctx);
  const hit = [];
  ca.accountDrafts = (q) => { hit.push(["account", "drafts", q && q.viewer]); return { ok: true, by: "case-account" }; };
  ca.accountPropose = (q) => { hit.push(["account", "propose", q && q.viewer]); return { ok: true, by: "case-account" }; };
  const passThrough = [];
  for (const m of ["accountDrafts", "accountPropose"]) if (typeof cau[m] === "function") cau[m] = () => { passThrough.push(m); return { ok: true, by: "case-authoring" }; };
  const drafts = await x.routes(`/accountdrafts?case=CASE-1&viewer=member:ann`)["accountdrafts"]();
  const propose = await x.routes(`/accountpropose?by=member:ann&viewer=member:ann`, { case: "CASE-1" })["accountpropose"]();
  assert.deepEqual([drafts, propose], [{ ok: true, by: "case-account" }, { ok: true, by: "case-account" }]);
  assert.deepEqual(hit.map((h) => h[1]), ["drafts", "propose"]);
  assert.deepEqual(passThrough, [], "case-authoring's pass-through is never reached");
});

/* ===== R36: the transcriber ===== */

test("R57 (was plane R36) (K2611; extraction R72): at start the plane registers one transcriber with extraction under `plane`; a second registration is refused LISTENER_DECLARED", async () => {
  const x = await store();
  const t = transcriberOf(x.ctx, x.env);
  const again = extractionOf(x.ctx).registerTranscriber("other", t);
  assert.deepEqual([again.ok, again.reason], [false, "LISTENER_DECLARED"], JSON.stringify(again));
  /* negative control: a bare host's extraction holds none, and takes this one */
  const bare = storage();
  assert.deepEqual(extractionOf(bare.ctx).registerTranscriber("plane", transcriberOf(bare.ctx, {})), { ok: true, module: "plane" });
});

test("R57 (was plane R36) (run-rules R19; ai-runs R75): deployable() is run-rules' bar for `transcribe` on ai-runs' records, on Civicsmith's set unless the composition is handed another; a failed record, another set's, and a throw answer false", async () => {
  /* Civicsmith's set holds no matter: false whatever is recorded */
  const civic = await plane();
  assert.equal(aiRunsOf(civic.ctx).testBarRecord({ ...PASSED, set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version }).ok, true);
  assert.equal(transcriberOf(civic.ctx, civic.env).deployable(), false);
  /* a test's one-matter set, handed before construction */
  const x = await plane({ testSet: ONE_MATTER });
  const t = transcriberOf(x.ctx, x.env);
  assert.equal(t.deployable(), false, "no record yet");
  assert.equal(aiRunsOf(x.ctx).testBarRecord({ ...PASSED, passed: false }).ok, true);
  assert.equal(t.deployable(), false, "a failed record");
  assert.equal(aiRunsOf(x.ctx).testBarRecord({ ...PASSED, set_version: 2 }).ok, true);
  assert.equal(t.deployable(), false, "an earlier version's record");
  assert.equal(aiRunsOf(x.ctx).testBarRecord({ ...PASSED, part: "read" }).ok, true);
  assert.equal(t.deployable(), false, "another part's record");
  assert.equal(aiRunsOf(x.ctx).testBarRecord(PASSED).ok, true);
  assert.equal(t.deployable(), true, "a passed record on the set at its version");
  /* a set that throws when read answers false */
  const thrower = await plane({ testSet: { id: "t42-set", version: 3, get matters() { throw new Error("boom"); } } });
  assert.equal(aiRunsOf(thrower.ctx).testBarRecord(PASSED).ok, true);
  assert.equal(transcriberOf(thrower.ctx, thrower.env).deployable(), false);
});

test("R57 (was plane R36) (credentials R57): keptAway({project, use}) is credentials.aiKeptAway relayed as given: the refusal while the group keeps material away, null once it does not", async () => {
  const x = await plane();
  const t = transcriberOf(x.ctx, x.env);
  assert.equal(t.keptAway({ project: null, use: "transcribe" }), null, "keep-away off");
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: true, by: "ada", reason: "not yet" }).ok, true);
  const away = t.keptAway({ project: null, use: "transcribe" });
  assert.equal(away && away.ok, false);
  assert.deepEqual(away, credentialsOf(x.ctx).aiKeptAway({ project: null, use: "transcribe" }), "as given");
});

test("R57 (was plane R36): transcription({member, project, at}) answers the object's own ai-accounts (R53, was credentials) and ai-use's useCheck, the act minted for it (`transcribe:<capture prefix>:<instant>`), and the AI path; with no AGENT_WORKER binding the path answers AGENT_WORKER_UNBOUND and reads nothing", async () => {
  const x = await plane();
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: "PROJ-1", at: "2026-10-11T06:00:00Z" });
  /* (T46; R40, extraction R74) re-pinned: `untested`, the test-instance label, null when the part runs on the bar or not at all */
  assert.deepEqual(Object.keys(tx).sort(), ["accounts", "act", "at", "member", "project", "transcribe", "untested", "useCheck"]);
  assert.equal(tx.untested, null);
  assert.equal(tx.accounts, aiAccountsOf(x.ctx), "R53 (T48): the payer is ai-accounts' instance, never credentials' delegate");
  assert.deepEqual([tx.member, tx.project, tx.at], ["member:ann", "PROJ-1", "2026-10-11T06:00:00Z"]);
  const q = { owner: "member:ann", member: "member:ann", use: "transcribe", at: "2026-10-11T06:00:00Z" };
  assert.deepEqual(tx.useCheck(q), aiUseOf(x.ctx).useCheck(q));
  assert.equal(tx.useCheck({ ...q, owner: "nobody" }).ok, false, "ai-use's own refusal, relayed");
  const d = await hold(x.evidence, SCAN);
  const r = await tx.transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: d, store: "bio", pages: [0], use: "transcribe" });
  // fixtures-run: extraction transcribe-not-sent
  assert.deepEqual(r, { ok: false, reason: "AGENT_WORKER_UNBOUND" });
  assert.equal(x.evidence.calls.length, 0, "nothing read");
  assert.equal(tx.act, "transcribe::2026-10-11T06:00:00Z", "unbound, it does nothing else: no capture reached the act");
  /* once the path is asked for a capture with a binding, the act carries its digest's prefix */
  const y = await plane({ worker: agentWorker() });
  const dy = await hold(y.evidence, SCAN);
  const ty = transcriberOf(y.ctx, y.env).transcription({ member: "member:ann", project: null, at: "2026-10-11T06:00:00Z" });
  await ty.transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: dy, pages: [0] });
  assert.equal(ty.act, `transcribe:${dy.slice(0, 16)}:2026-10-11T06:00:00Z`);
  assert.match(tx.act, /^[A-Za-z0-9._:-]{1,128}$/, "an act's id ai-use counts under");
  /* negative control: another act's transcription mints its own id */
  const other = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-11T06:00:01Z" });
  assert.notEqual(other.act, tx.act);
});

test("R57 R106 transcribe-answer: the answer a user module (extraction's t48) hands for `transcribe` is the real one's: the same keys and values for the same pages", async () => {
  /* extraction's value, as its t48 test builds it for pages `q.pages` (the contract it states: `fixtures-contract: store-assembly transcribe-answer`) */
  const theirs = (q) => ({ ok: true, engine: "claude-test", version: "2026-01", pages: q.pages.map((p) => ({ page: p, text: `AI text of page ${p}` })),
                          asked: q.pages, sent: q.pages, owed: [] });
  const worker = agentWorker((b) => theirs({ pages: b.pages.map((p) => p.page) }));
  const x = await plane({ worker });
  const d = await hold(x.evidence, SCAN);
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-11T06:00:00Z" });
  const account = await credentialsOf(x.ctx).accountFor({ member: "member:ann", act: { kind: "transcribe", member: "member:ann" } });
  const real = await tx.transcribe({ account, capture_sha: d, store: "bio", pages: [0], use: "transcribe" });
  // fixtures-run: extraction transcribe-answer
  // fixtures-run: reading-pipeline transcribe-answer   (text-units.test.mjs:531-542 and transcribe.test.mjs:323-327 hand the same success value, {ok, engine, version, pages, asked, sent, owed}; their refusal `{ok: false, reason}` is agent-worker's relayed shape)
  assert.deepEqual(real, theirs({ pages: [0] }), "the real answer also names the pages asked, sent, unread and owed (transcribe.mjs, R106)");
});

test("R57 (was plane R36) (agent-worker R6, R63, R72; ai-use R1, R11): the AI path renders the asked pages with pdf-pixels (decodeDct) as PNGs, posts {capture_sha, pages, account} in R6's wire shape to /transcribe, the secret only in that body, counts the usage under the act in one transaction, and answers agent-worker's answer", async () => {
  const worker = agentWorker();
  const x = await plane({ worker });
  const d = await hold(x.evidence, SCAN);
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-11T06:00:00Z" });
  const account = await credentialsOf(x.ctx).accountFor({ member: "member:ann", act: { kind: "transcribe", member: "member:ann" } });
  assert.equal(account.ok, true, JSON.stringify(account));
  /* page 1 does not exist in a one-page scan: refused by the renderer, not sent */
  const r = await tx.transcribe({ account, capture_sha: d, store: "bio", pages: [1, 0, 0], use: "transcribe" });
  assert.equal(worker.seen.length, 1);
  const [u, body, raw] = worker.seen[0];
  assert.equal(u, "https://agent-worker/transcribe");
  assert.deepEqual(Object.keys(body).sort(), ["account", "capture_sha", "pages"]);
  assert.equal(body.capture_sha, d);
  assert.deepEqual(body.account, { kind: "apikey", level: "member", secret: SENTINEL, member: "member:ann", suggestions: false });
  assert.deepEqual(body.pages.map((p) => [p.page, p.media_type]), [[0, "image/png"]]);
  const png = Buffer.from(body.pages[0].data, "base64");
  assert.deepEqual([...png.subarray(0, 8)], PNG_SIG);
  const decoded = await renderPageToPixels(SCAN, 0, { decodeDct: true });
  assert.ok(png.equals(Buffer.from(decoded.bytes)), "pdf-pixels' decoded PNG, re-encoded by Civicsmith");
  const passthrough = await renderPageToPixels(SCAN, 0, { decodeDct: false });
  assert.notEqual(passthrough.mediaType, "image/png", "negative control: without decodeDct the publisher's JPEG would be sent");
  assert.ok(raw.includes(SENTINEL));
  /* the answer as given; the secret is in no answer and no row */
  assert.equal(r.ok, true);
  assert.deepEqual(r.pages, [{ page: 0, text: "the AI's words on page 0" }]);
  assert.ok(!JSON.stringify(r).includes(SENTINEL));
  const usage = x.rows(`SELECT * FROM ai_usage WHERE use='transcribe'`);
  assert.equal(usage.length, 1);
  assert.deepEqual([usage[0].owner, usage[0].member, usage[0].mode, usage[0].calls, usage[0].input_tokens], ["member:ann", "ann", "transcribe", 1, 10]);
  for (const t of x.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((t) => t.name))
    assert.ok(!JSON.stringify(x.rows(`SELECT * FROM "${t}"`)).includes(SENTINEL), `the secret stored in ${t}`);
  const actual = aiUseOf(x.ctx).actualOf({ act: tx.act, viewer: "member:ann" });
  assert.deepEqual([actual.found, actual.use, actual.cost && actual.cost.usd], [true, "transcribe", 0.25]);
});

test("R57 (was plane R36): a project's account is counted under `project:<id>` and named in the wire; an ending that carries usage is counted and answered ok:false with its reason; a binding that throws or answers no JSON is AGENT_WORKER_SILENT, nothing counted", async () => {
  const ending = agentWorker(() => ({ ok: false, reason: "MODEL_SILENT", ending: "silent", usage: USAGE, calls: 1 }));
  const x = await plane({ worker: ending });
  const d = await hold(x.evidence, SCAN);
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: "PROJ-9", at: "2026-10-11T06:00:00Z" });
  const r = await tx.transcribe({ account: { ok: true, kind: "apikey", level: "project", project: "PROJ-9", key: SENTINEL }, capture_sha: d, pages: [0] });
  assert.deepEqual([r.ok, r.reason], [false, "MODEL_SILENT"]);
  assert.deepEqual(ending.seen[0][1].account, { kind: "apikey", level: "project", project: "PROJ-9", secret: SENTINEL, member: "member:ann", suggestions: false });
  assert.deepEqual(x.rows(`SELECT owner, use FROM ai_usage`).map((r) => [r.owner, r.use]), [["project:PROJ-9", "transcribe"]]);
  /* a refusal named by `code` only is answered with it as its reason, and with no usage nothing is counted */
  const coded = await plane({ worker: agentWorker(() => ({ ok: false, code: "BAD_PAGES" })) });
  const dc = await hold(coded.evidence, SCAN);
  const rc = await transcriberOf(coded.ctx, coded.env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "group", key: SENTINEL }, capture_sha: dc, pages: [0] });
  assert.deepEqual([rc.ok, rc.reason], [false, "BAD_PAGES"]);
  assert.equal(coded.rows(`SELECT * FROM ai_usage`).length, 0);
  /* silent: a throw, and an answer that is not JSON */
  for (const w of [{ fetch: async () => { throw new Error("down"); } }, agentWorker(() => "not json")]) {
    const y = await plane({ worker: w });
    const dy = await hold(y.evidence, SCAN);
    const ry = await transcriberOf(y.ctx, y.env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" })
      .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: dy, pages: [0] });
    assert.deepEqual(ry, { ok: false, reason: "AGENT_WORKER_SILENT" });
    assert.equal(y.rows(`SELECT * FROM ai_usage`).length, 0);
  }
});

test("R57 (was plane R36) (K2611): the pages are rendered one at a time in ascending order, at most TRANSCRIBE_PAGES_MAX; a page the renderer refuses or throws on, a picture that is not a PNG, or a PNG over TRANSCRIBE_IMAGE_MAX_BYTES is not sent; with none left NO_PAGE_RENDERED and with no bytes EVIDENCE_ABSENT, nothing posted", async () => {
  const asked = [];
  const png = (n) => { const b = new Uint8Array(n); b.set(PNG_SIG); return b; };
  const textLayerRefusal = await pageRefusal("PAGE_HAS_TEXT_LAYER");
  const render = async (bytes, page, opts) => { asked.push([page, opts.decodeDct]);
    if (page === 1) return textLayerRefusal;
    if (page === 2) throw new Error("bad");
    if (page === 3) return { ok: true, mediaType: "image/jpeg", bytes: new Uint8Array(10) };
    if (page === 4) return { ok: true, mediaType: "image/png", bytes: png(TRANSCRIBE_IMAGE_MAX_BYTES + 1) };
    if (page === 5) return { ok: true, mediaType: "image/png", bytes: png(TRANSCRIBE_IMAGE_MAX_BYTES) };
    return { ok: true, mediaType: "image/png", bytes: png(16) }; };
  const out = await renderPages(new Uint8Array(1), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, -1, 1.5], render);
  assert.deepEqual(asked, [0, 1, 2, 3, 4, 5, 6, 7].map((p) => [p, true]), "ascending, each once, at most the cap, decodeDct");
  assert.equal(TRANSCRIBE_PAGES_MAX, 8);
  assert.deepEqual(out.map((p) => p.page), [0, 5, 6, 7]);
  assert.ok(out.every((p) => p.media_type === "image/png" && Buffer.from(p.data, "base64").subarray(0, 8).equals(Buffer.from(PNG_SIG))));
  /* with none left, nothing is posted and no account leaves the object */
  const worker = agentWorker();
  const x = await plane({ worker });
  const d = await hold(x.evidence, SCAN);
  const r = await transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: d, pages: [5, 6] });
  // fixtures-run: extraction transcribe-not-sent
  assert.deepEqual(r, { ok: false, reason: "NO_PAGE_RENDERED", refused: [{ page: 5, reason: "NO_SUCH_PAGE" },
                                                                     { page: 6, reason: "NO_SUCH_PAGE" }],
                        asked: [5, 6], sent: [], owed: [] }, "K2684 (2); T44's `refused`; R106: the pages asked and sent are stated");
  assert.equal(worker.seen.length, 0);
  /* K2684 (2): the capture's bytes absent from the evidence store: EVIDENCE_ABSENT, nothing posted */
  const gone = await transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: "e".repeat(64), pages: [0] });
  // fixtures-run: extraction transcribe-not-sent
  assert.deepEqual(gone, { ok: false, reason: "EVIDENCE_ABSENT" });
  assert.equal(worker.seen.length, 0);
  /* negative control: the same act on the held capture's page 0 is posted */
  await transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: d, pages: [0] });
  assert.equal(worker.seen.length, 1);
});

test("R57 (was plane R36) (agent-worker R72): TRANSCRIBE_PAGES_MAX and TRANSCRIBE_IMAGE_MAX_BYTES equal agent-worker's", () => {
  assert.equal(TRANSCRIBE_PAGES_MAX, AGENT_WORKER_OPS.TRANSCRIBE_PAGES_MAX);
  assert.equal(TRANSCRIBE_IMAGE_MAX_BYTES, AGENT_WORKER_OPS.TRANSCRIBE_IMAGE_MAX_BYTES);
  /* negative control: a figure agent-worker holds that is not these */
  assert.notEqual(TRANSCRIBE_PAGES_MAX, AGENT_WORKER_OPS.TRANSCRIBE_TURNS);
});

/* ===== R36: the door's arm, and the act end to end ===== */

/* A stored reading of the scan, filed in `bundleId`: the bundle row record-core's contract holds, and the reading
   extraction writes (its R34), as a promotion leaves them. */
async function stored(x, bundleId = "B-T42") {
  const d = await hold(x.evidence, SCAN);
  x.ctx.storage.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
                          VALUES (?, 'information', 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1)`, bundleId);
  const w = extractionOf(x.ctx).writeReading({ bundleId, captureSha: d, reading: { content_type: "generic", reader_version: 1,
    read_from_text: false, found: false, entities: [], facts: {}, at: "2026-09-01T00:00:00Z", basis: "b", text_source: null,
    page_count: 1 } });
  assert.notEqual(w && w.ok, false, JSON.stringify(w));
  return d;
}
const stamps = (d) => `/pagetranscribe?sha256=${d}&cls=member&session=1&caps=contribute&viewer=member:ann&author=member:ann&store=bio`;


test("R57 (was plane R36) (N832; D21, D12): end to end on the object, a member's pagetranscribe of a stored scan reaches the registered transcriber: the page is rendered and sent, the AI's words written into the reading under the act, and its usage counted for that act; on Civicsmith's empty set it is refused TRANSCRIBE_NOT_DEPLOYED and nothing is sent", async () => {
  const worker = agentWorker();
  const x = await plane({ testSet: ONE_MATTER, worker });
  assert.equal(aiRunsOf(x.ctx).testBarRecord(PASSED).ok, true);
  const d = await stored(x);
  const r = await x.call(stamps(d));
  assert.equal(r.status, 200, JSON.stringify(r));
  const t = r.body.transcription;
  assert.equal(t.performed, true, JSON.stringify(r.body));
  assert.equal(t.written, true, JSON.stringify(r.body));
  assert.deepEqual(t.pages, [0]);
  assert.equal(t.engine, "claude-test");
  assert.match(t.act, new RegExp(`^transcribe:${d.slice(0, 16)}:`));
  assert.equal(worker.seen.length, 1);
  assert.deepEqual(worker.seen[0][1].pages.map((p) => p.page), [0]);
  const actual = aiUseOf(x.ctx).actualOf({ act: t.act, viewer: "member:ann" });
  assert.deepEqual([actual.found, actual.use, actual.owner], [true, "transcribe", "member:ann"]);
  /* negative control: Civicsmith's set (no matter), the same record and request */
  const off = agentWorker();
  const y = await plane({ worker: off });
  assert.equal(aiRunsOf(y.ctx).testBarRecord(PASSED).ok, true);
  const dy = await stored(y);
  const ry = await y.call(stamps(dy));
  assert.deepEqual([ry.status, ry.body.reason], [501, "TRANSCRIBE_NOT_DEPLOYED"]);
  assert.equal(off.seen.length, 0);
  assert.equal(y.rows(`SELECT * FROM ai_usage`).length, 0);
});

test("R57 (was plane R36): with no AGENT_WORKER bound, the act answers 200 with performed: false and why naming the unbound assistant; nothing is counted or written", async () => {
  const x = await plane({ testSet: ONE_MATTER });
  assert.equal(aiRunsOf(x.ctx).testBarRecord(PASSED).ok, true);
  const d = await stored(x);
  const r = await x.call(stamps(d));
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.transcription.performed, false);
  assert.match(r.body.transcription.why, /AGENT_WORKER_UNBOUND/);
  assert.equal(x.rows(`SELECT * FROM ai_usage`).length, 0);
  /* negative control: with the binding, the same act is performed */
  const y = await plane({ testSet: ONE_MATTER, worker: agentWorker() });
  assert.equal(aiRunsOf(y.ctx).testBarRecord(PASSED).ok, true);
  assert.equal((await y.call(stamps(await stored(y)))).body.transcription.performed, true);
});

test("R58 (was plane R106) G126e: on a 24 MiB PDF and a 300-page scan the press loads no object in the request (no get of the evidence store at all), owes every asked page as a job row, and names the pages asked, sent (none) and owed", async () => {
  const worker = agentWorker();
  const x = await plane({ worker });
  for (const [what, bytes, pages] of [["a 24 MiB PDF", 24 * 1048576, [0, 1, 2]], ["a 300-page scan", 3 * 1048576, Array.from({ length: 300 }, (_, i) => i)]]) {
    const big = new Uint8Array(bytes); big.set(SCAN);
    const d = await hold(x.evidence, big);
    assert.ok(big.length > TRANSCRIBE_LOAD_MAX, `${what} is over the inline ceiling`);
    const gets = x.evidence.calls.filter((c) => c[0] === "get").length;
    const r = await transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", at: "2026-10-24T06:00:00Z" })
      .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: d, pages });
    assert.equal(x.evidence.calls.filter((c) => c[0] === "get").length, gets, `${what}: the object is not loaded in the request`);
    assert.deepEqual([r.ok, r.reason, r.asked, r.sent, r.owed, r.size, r.limit], [false, "NO_PAGE_RENDERED", pages, [], pages, big.length, TRANSCRIBE_LOAD_MAX], what);
    assert.deepEqual(r.refused, pages.map((page) => ({ page, reason: OWED })), `${what}: each page named`);
    const row = pendingOf(x.ctx).jobRow({ sha: d, kind: "ocr" });
    assert.deepEqual([row.state, row.owed, row.detail.pages], ["queued", pages.length, pages], `${what}: what is left is owed as a job row`);
    const said = await x.call(`/owedwork?sha=${d}`);
    assert.deepEqual(said.owed.map((e) => [e.kind, e.state]), [["ocr", "owed"]], `${what}: owedwork lists what is left`);
  }
  assert.equal(worker.seen.length, 0, "nothing posted");
});

test("R58 (was plane R106) (control): a 3-page file under the ceiling is read in the request by ranges as before; the answer names the pages filled; a page asked beyond TRANSCRIBE_PAGES_MAX is named unread and owed, never dropped", async () => {
  const worker = agentWorker();
  const x = await plane({ worker });
  const d = await hold(x.evidence, SCAN);
  const pages = Array.from({ length: TRANSCRIBE_PAGES_MAX + 2 }, (_, i) => i);
  const r = await transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", at: "2026-10-24T06:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL }, capture_sha: d, pages });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.asked, pages);
  assert.deepEqual(r.sent, worker.seen[0][1].pages.map((p) => p.page), "the pages filled are the pages sent, stated");
  const beyond = pages.slice(TRANSCRIBE_PAGES_MAX);
  assert.deepEqual(r.unread.filter((f) => f.reason === PAGES_MAX).map((f) => f.page), beyond, "named unread, never dropped");
  assert.equal(Object.hasOwn(r, "refused"), false, "a posted answer carries no `refused` (T44)");
  assert.deepEqual(r.owed, beyond);
  assert.deepEqual(pendingOf(x.ctx).jobRow({ sha: d, kind: "ocr" }).detail.pages, beyond, "and owed as a job row");
  assert.ok(x.evidence.calls.some((c) => c[0] === "head"), "the size is asked of the store's record, never by loading the object first");
});
