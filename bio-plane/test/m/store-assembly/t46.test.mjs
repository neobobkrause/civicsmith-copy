/* store-assembly's copy of plane's T46 test (K5200 item 99 (1); PLANE #62 J64 B5; T46-62; N897 (2), (3), N886, N920, N935; K2816, K2940, K2946, K2950, K2960):
   the ask and draft doors and the transcriber gated by `ai-runs.partAdmitted` (R50), the test-instance label on their outputs, the status
   report's draft; the serving account's suggestions switch (R49) and a sign-in's held token on the wire and dropped when refused (R52);
   agent-worker's HTTP status relayed by the transcriber (R57); case-account's and local-facts' ops maps spread (R34); the route map re-pinned
   to T46's ops (R6). Each test drives the assembled store at its interface (construction over a storage, the ask and draft the Store's RPC
   methods call, the door, the transcriber it registers) and carries a negative control (K874). What is the Durable Object class's stays with
   `plane`: the Store booted on workerd over a store holding notes (plane R42) and its RPC methods `dispatchMemberRun` and `groupFields`
   (plane R114). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { store, deployed, GATE_FLAGS, GATE_SET, GATE_PARTS, disclosed } from "./fixture.mjs";
import { MODULE_MAPS, ownMaps, servedThroughDoor } from "./maps.mjs";
import { assistantGateOf, draftOnObject, DRAFT_KIND_OF } from "../../../src/store-assembly/ask.mjs";
import { transcriberOf } from "../../../src/store-assembly/transcribe.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { caseAccountOf, caseAccountOps } from "../../../src/case-account/index.mjs";
import { localFactsOf, localFactsOps } from "../../../src/local-facts/index.mjs";
import { untestedLabel, partRefusal } from "../../../src/run-rules/index.mjs";

const SESSION = "s".repeat(64);
const SEAL = "a-long-seal-secret-for-the-t46-test";
/* R47: a sentinel held token, to be found in the binding's request and nowhere else */
const SIGNIN_TOKEN = "sk-ant-oat01-SENTINEL-held-token-t47";
const TEST_COPY = { CIVICSMITH_TEST_INSTANCE: "t46-copy", INSTANCE_NAME: "t46-copy" };
const DRAFT_ANSWER = { ok: true, draft: { text: "t" }, label: { kind: "machine" } };

/* ann and an administrator, ann's live session, the group's keep-away off; `account`: ann's API-key reference
   (`apikey`), her sign-in alone (`signin`), or none. agent-worker records every post. The gate deps (`gate`) are handed
   before construction (K61), the bar recorded for `parts` on the gate's set. */
async function doors({ gate = null, parts = [], env: extra = {}, account = "apikey", worker = null } = {}) {
  const asks = [];
  const env = { ACCOUNT_SEAL_SECRET: SEAL, ...extra, AGENT_WORKER: worker || { fetch: async (u, init) => {
    asks.push([u, JSON.parse(init.body)]);
    if (u === "https://agent-worker/draft") {
      const b = JSON.parse(init.body);
      return new Response(JSON.stringify({ ...DRAFT_ANSWER, ...(b.untested ? { untested: b.untested } : {}) }),
                          { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response('{"event":"answer","ok":true}\n', { status: 200, headers: { "content-type": "application/x-ndjson" } }); } } };
  const x = await store({ env, before: gate ? (ctx) => assistantGateOf(ctx, gate) : null });
  if (parts.length) await deployed(x.ctx, parts);
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  const c = credentialsOf(x.ctx);
  if (account === "apikey") {
    await disclosed(x.ctx);   /* R44 (T47): the disclosure first, as the assembled plane asks */
    assert.equal((await c.accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" })).ok, true);
  }
  /* R47 (T47; credentials R70): a sign-in serves only while its token is held */
  if (account === "signin") assert.equal((await c.subscriptionTokenHold({ member: "member:ann", token: SIGNIN_TOKEN })).ok, true);
  const grants = () => [...sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c;
  const ask = async () => { const r = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" }); return { status: r.status, r }; };
  const draft = async (a) => { const r = await x.s.draft({ member: "ann", session: SESSION, pack: { layers: [] }, ...a }); return { status: r.status, body: await r.json() }; };
  return { ...x, asks, grants, ask, draft };
}
const WRITING = { op: "writinghelp", told: "t", act: "conclude", field: "reason" };
const ITEMS = [{ kind: "action", says: "the request was sent" }];

/* ===== R40 (T46): partAdmitted, the test-instance exception and its label ===== */

test("R50 (was plane R40; T46; N897 (2); run-rules R29, R30; ai-runs R78; agent-worker R79): on Civicsmith's empty set with no test instance, an ask and a writing-help draft are refused AI_PART_NOT_DEPLOYED as run-rules' partRefusal answers it, nothing posted; control: with CIVICSMITH_TEST_INSTANCE equal to INSTANCE_NAME the same posts are made, the ask's request carrying the label and the draft's answer carrying it beside grant, suggestions and read", async () => {
  /* the flags on, no bar anywhere (Civicsmith's set holds no matter), INSTANCE_NAME set but no test instance */
  const off = await doors({ gate: { flags: GATE_FLAGS }, env: { INSTANCE_NAME: "t46-copy" } });
  const a = await off.ask();
  assert.equal(a.status, 403);
  assert.deepEqual(await a.r.json(), partRefusal("ask"), "relayed unchanged");
  const d = await off.draft(WRITING);
  assert.equal(d.status, 403);
  const { grant, suggestions, read, ...given } = d.body;
  assert.deepEqual(given, partRefusal("draft:own_words"));
  assert.deepEqual([grant, suggestions, read, d.body.untested], [null, false, [], undefined]);
  assert.equal(off.asks.length, 0, "nothing posted to the binding");
  assert.equal(off.grants(), 0, "no grant minted");
  /* a value the deployer did not set as the instance's own name is no test instance */
  const other = await doors({ gate: { flags: GATE_FLAGS }, env: { CIVICSMITH_TEST_INSTANCE: "elsewhere", INSTANCE_NAME: "t46-copy" } });
  assert.equal((await other.ask()).status, 403);
  assert.equal(other.asks.length, 0);
  /* control: the test instance */
  const on = await doors({ gate: { flags: GATE_FLAGS }, env: TEST_COPY });
  const ok = await on.ask();
  assert.equal(ok.status, 200);
  assert.equal(on.asks.length, 1);
  assert.deepEqual(on.asks[0][1].untested, untestedLabel("ask"), "the ask's request carries the label (agent-worker R79)");
  const dr = await on.draft(WRITING);
  assert.equal(dr.status, 200, JSON.stringify(dr.body));
  assert.deepEqual(dr.body.untested, untestedLabel("draft:own_words"), "the draft's answer carries the label");
  assert.deepEqual(Object.keys(dr.body).filter((k) => ["grant", "suggestions", "read", "untested"].includes(k)).sort(),
                   ["grant", "read", "suggestions", "untested"]);
  assert.deepEqual(on.asks[1][1].untested, untestedLabel("draft:own_words"), "and is sent with the draft");
});

test("R50 (was plane R40; T46; run-rules R29): admitted by the bar, neither the ask nor the draft carries a label, on a test instance or not; the exception never lifts a flag: with the flag off a test instance is refused AI_RUN_MODE_NOT_DEPLOYED", async () => {
  for (const env of [{}, TEST_COPY]) {
    const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS, env });
    assert.equal((await w.ask()).status, 200);
    assert.equal(w.asks[0][1].untested, undefined, "the bar held: no label");
    const d = await w.draft(WRITING);
    assert.equal(d.status, 200);
    assert.equal(d.body.untested, undefined);
    assert.equal(w.asks[1][1].untested, undefined);
  }
  const flagOff = await doors({ gate: { flags: { ...GATE_FLAGS, ask: false } }, env: TEST_COPY });
  const r = await flagOff.ask();
  assert.equal(r.status, 403);
  assert.equal((await r.r.json()).code, "AI_RUN_MODE_NOT_DEPLOYED");
  assert.equal(flagOff.asks.length, 0);
});

test("R50, R57 (was plane R40, R36; T46; extraction R74): the transcriber's deployable() is partAdmitted(\"transcribe\").admitted and its transcription() answers `untested`, the label, when the part runs on the test instance; off it, not deployable and no label", async () => {
  const on = await doors({ env: TEST_COPY });
  const t = transcriberOf(on.ctx, on.env);
  assert.equal(t.deployable(), true);
  assert.equal(t.deployable(), aiRunsOf(on.ctx).partAdmitted("transcribe").admitted);
  assert.deepEqual(t.transcription({ member: "member:ann", at: "2026-10-12T00:00:00Z" }).untested, untestedLabel("transcribe"));
  /* negative control: no test instance, Civicsmith's empty set */
  const off = await doors({ env: { INSTANCE_NAME: "t46-copy" } });
  const u = transcriberOf(off.ctx, off.env);
  assert.equal(u.deployable(), false);
  assert.equal(u.transcription({ member: "member:ann", at: "2026-10-12T00:00:00Z" }).untested, null);
});

/* ===== R40 (T46; N920): the status report's draft ===== */

/* The object's draft path asked as control-plane's door asks it, with `read` answering the plan as the member reads it,
   and every collaborator the gate must not reach before its time spied in order. */
async function statusReport(w, { plan = "PLAN-2026-0007-harbour", project = "PROJ-2026-0007-harbour", keptAway = null, read = null } = {}) {
  const order = [];
  /* R53 (T48): the keep-away read is ai-accounts' */
  const c = aiAccountsOf(w.ctx), a = answersOf(w.ctx);
  const ka = c.aiKeptAway.bind(c), acc = a.askAccount.bind(a);
  /* the group's own keep-away (instance-setup's `assistantGate`, asked with no project) is answered as it stands */
  c.aiKeptAway = (q) => { if (q === undefined) return ka(); order.push(["aiKeptAway", q]); return keptAway ?? ka(q); };
  a.askAccount = async (q) => { order.push(["askAccount", q.kind]); return acc(q); };
  try {
    const res = await draftOnObject(w.ctx, w.env, { op: "statusreportdraft", member: "ann", session: SESSION, plan, items: ITEMS },
      { read: read || ((op, p) => (op === "plan" ? { ok: true, id: p.id, project, viewer: p.viewer } : null)) });
    return { status: res.status, body: await res.json(), order };
  } finally { c.aiKeptAway = ka; a.askAccount = acc; }
}

test("R50 (was plane R40; T46; N920; study-T46-assistant §2): a status-report draft for a plan whose project is kept away from drafts is refused as credentials.aiKeptAway answers it, asked with the plan's project and use `draft`, before any account is read, nothing posted and no grant; control: not kept away, it is posted as {task: {op, plan, items}, account}, with no told and no grant", async () => {
  const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS });
  assert.equal((await credentialsOf(w.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" })).ok, true);
  const AWAY = { ok: false, reason: "PROJECT_AI_KEPT_AWAY", code: "PROJECT_AI_KEPT_AWAY", detail: "kept away for the test" };
  const r = await statusReport(w, { keptAway: AWAY });
  assert.equal(r.status, 403);
  assert.deepEqual([r.body.reason, r.body.grant, r.body.read], ["PROJECT_AI_KEPT_AWAY", null, []]);
  assert.deepEqual(r.order, [["aiKeptAway", { project: "PROJ-2026-0007-harbour", use: "draft" }]], "kept away before any account is read");
  assert.equal(w.asks.length, 0);
  assert.equal(w.grants(), 0);
  /* control */
  const ok = await statusReport(w);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  /* the plan's keep-away first, then the account (credentials' own cascade reads its keep-away again inside it) */
  assert.deepEqual(ok.order.slice(0, 2).map(([k]) => k), ["aiKeptAway", "askAccount"]);
  assert.equal(ok.order[1][1], "draft", "the account judged for a draft");
  assert.deepEqual([ok.body.grant, ok.body.read], [null, []], "it reads nothing of the record, whatever the switch");
  const [u, body] = w.asks.at(-1);
  assert.equal(u, "https://agent-worker/draft");
  assert.deepEqual(body.task, { op: "statusreportdraft", plan: "PLAN-2026-0007-harbour", items: ITEMS });
  assert.equal(body.told, undefined);
  assert.equal(body.grant, undefined);
  assert.equal(body.account.level, "member");
  assert.equal(w.grants(), 0);
});

test("R50 (was plane R40; T46; N920): a status-report draft is refused AI_PART_NOT_DEPLOYED while partAdmitted(\"draft:statusreport\") does not admit it, before the plan, the keep-away or any account is read; a plan the member cannot read ends it with that read's refusal, and a task naming no plan or items is BAD_TASK, each before any account is read", async () => {
  const bar = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS.filter((p) => p !== "draft:statusreport") });
  let reads = 0;
  const g = await statusReport(bar, { read: () => { reads++; return { ok: true, project: null }; } });
  assert.equal(g.status, 403);
  const { grant: _g, suggestions: _s, read: _r, ...given } = g.body;
  assert.deepEqual(given, partRefusal("draft:statusreport"));
  assert.deepEqual([g.order, reads], [[], 0]);
  /* the real route map's read, through the object's own draft RPC: no such plan */
  const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS });
  const a = answersOf(w.ctx), acc = a.askAccount.bind(a);
  let accounts = 0;
  a.askAccount = async (q) => { accounts++; return acc(q); };
  const none = await w.draft({ op: "statusreportdraft", plan: "PLAN-2026-0009-none", items: ITEMS });
  assert.equal(none.status, 409);
  assert.equal(none.body.ok, false);
  assert.match(JSON.stringify(none.body), /NO_SUCH_PLAN/);
  for (const t of [{ op: "statusreportdraft", plan: null, items: ITEMS }, { op: "statusreportdraft", plan: "PLAN-1", items: null }]) {
    const b = await w.draft(t);
    assert.deepEqual([b.status, b.body.reason], [400, "BAD_TASK"]);
  }
  assert.equal(accounts, 0, "no account read");
  assert.equal(w.asks.length, 0, "nothing posted");
  assert.equal(DRAFT_KIND_OF.statusreportdraft, "statusreport");
  /* control: a plan read that answers it is posted */
  a.askAccount = acc;
  assert.equal((await statusReport(w)).status, 200);
});

/* ===== R33 (T46; N897 (3); M-T46-6, K2946), R47 (T47; K3084; K3060 D10): the serving account's switch, and a
   sign-in's held token on the wire ===== */

test("R49, R52 (was plane R33, R47; T47; K3084; credentials R55, R70; agent-worker R6, R82): a member served by her own sign-in is sent as {kind: signin, level: member, secret, member, suggestions}, `secret` the token credentials holds for her, on the ask and the draft path alike, the token reaching only the binding's request; its suggestions the sign-in's own switch, with it on a draft gets a grant; control: off, false; an API-key reference's switch and key are read as before", async () => {
  const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS, account: "signin" });
  const c = credentialsOf(w.ctx);
  assert.equal((await c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" })).ok, true);
  assert.equal(c.accountReferenceState({ member: "member:ann", viewer: "member:ann" }).subscription.uses.suggestions, true);
  const asked = await w.ask();
  assert.equal(asked.status, 200);
  const answered = [await asked.r.text()];
  const SIGNIN = { kind: "signin", level: "member", secret: SIGNIN_TOKEN, member: "member:ann", suggestions: true };
  assert.deepEqual(w.asks[0][1].account, SIGNIN);
  const d = await w.draft(WRITING);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  answered.push(JSON.stringify(d.body));
  assert.deepEqual(w.asks[1][1].account, SIGNIN, "the draft path sends the held token too");
  assert.equal(d.body.suggestions, true);
  assert.match(d.body.grant, /^[0-9a-f]{64}$/);
  /* control: the sign-in's switch off */
  assert.equal((await c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: false, by: "member:ann" })).ok, true);
  answered.push(await (await w.ask()).r.text());
  assert.deepEqual(w.asks[2][1].account, { ...SIGNIN, suggestions: false });
  /* the token reached the binding's requests, and no answer, account state or change row */
  answered.push(JSON.stringify(c.accountReferenceState({ member: "member:ann", viewer: "member:ann" })));
  answered.push(JSON.stringify([...w.ctx.storage.sql.exec(`SELECT * FROM account_changes`)]));
  for (const a of answered) assert.equal(a.includes(SIGNIN_TOKEN), false, a);
  /* an API-key reference: its own switch, its key carried as `secret` */
  const k = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS });
  assert.equal((await credentialsOf(k.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" })).ok, true);
  await k.ask();
  assert.deepEqual(k.asks[0][1].account, { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: true });
});

/* agent-worker answering every post with Anthropic's refusal of the sign-in's token: the ask as its NDJSON stream's
   `refused` event (agent-worker R6's `/ask`), the draft and the transcription as JSON. */
const REFUSED = { ok: false, reason: "SIGNIN_TOKEN_REFUSED", code: "SIGNIN_TOKEN_REFUSED", detail: "Anthropic refused the sign-in" };
const refusing = () => ({ asks: [], async fetch(u, init) {
  this.asks.push([u, JSON.parse(init.body)]);
  if (u === "https://agent-worker/ask")
    return new Response(`{"event":"thinking"}\n${JSON.stringify({ event: "refused", ...REFUSED })}\n`, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  return new Response(JSON.stringify(REFUSED), { status: 401, headers: { "content-type": "application/json" } }); } });
const held = (x) => credentialsOf(x.ctx).accountReferenceState({ member: "member:ann", viewer: "member:ann" }).subscription.held;

test("R52 (was plane R47; T47; K3084; credentials R70): an answer SIGNIN_TOKEN_REFUSED to an ask, a draft or a transcription served by a sign-in has credentials drop the held token (subscriptionTokenRefused): the answer is relayed unchanged, and her next act finds no sign-in; control: the same refusal to an API-key reference drops nothing", async () => {
  for (const path of ["ask", "draft", "transcribe"]) {
    const bw = refusing();
    const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS, account: "signin", worker: bw });
    assert.equal(held(w), true, `${path}: held before`);
    if (path === "ask") {
      const r = await w.ask();
      const text = await r.r.text();
      assert.match(text, /"event":"refused".*SIGNIN_TOKEN_REFUSED/, "the stream relayed as it came");
    } else if (path === "draft") {
      const d = await w.draft(WRITING);
      assert.deepEqual([d.status, d.body.code], [401, "SIGNIN_TOKEN_REFUSED"]);
    } else {
      const account = await credentialsOf(w.ctx).accountFor({ member: "member:ann", act: { kind: "transcribe", member: "member:ann" } });
      assert.equal(account.kind, "signin", JSON.stringify(account));
      const got = await transcriberOf(w.ctx, w.env).transcription({ member: "member:ann", at: "2026-10-14T00:00:00Z" })
        .transcribe({ account, capture_sha: "0".repeat(64), pages: [0] });
      assert.equal(got.reason, "EVIDENCE_ABSENT", "no capture held: nothing posted, nothing dropped");
      assert.equal(held(w), true);
      const t = await scanned(bw, { account: "signin" });
      /* extraction answers it as the AI's refusal, by its code (its R75's relay of a status applies to agent-worker's own) */
      assert.match(t.text, /SIGNIN_TOKEN_REFUSED/, t.text);
      assert.equal(bw.asks.at(-1)[1].account.secret, SIGNIN_TOKEN, "the transcription carried the held token");
      assert.equal(held(t.x), false, "transcribe: dropped");
      continue;
    }
    assert.equal(bw.asks.at(-1)[1].account.secret, SIGNIN_TOKEN);
    assert.equal(held(w), false, `${path}: dropped`);
    const next = await credentialsOf(w.ctx).accountFor({ member: "member:ann", act: { kind: "ask", member: "member:ann" } });
    assert.notEqual(next.kind, "signin", `${path}: ${JSON.stringify(next)}`);
  }
  /* control: an API-key reference answered the same refusal keeps everything */
  const kw = refusing();
  const k = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS, worker: kw });
  const kc = credentialsOf(k.ctx), was = kc.subscriptionTokenRefused.bind(kc);
  let called = 0;
  kc.subscriptionTokenRefused = (q) => { called++; return was(q); };
  await (await k.ask()).r.text();
  await k.draft(WRITING);
  assert.equal(kw.asks.length, 2);
  assert.equal(called, 0, "no sign-in served: nothing to drop");
  assert.equal((await kc.accountFor({ member: "member:ann", act: { kind: "ask", member: "member:ann" } })).kind, "apikey");
});

/* ===== R36 (T46; N886; extraction R75): agent-worker's HTTP status relayed ===== */

const ONE_MATTER = Object.freeze({ id: "t46-set", version: 1, matters: Object.freeze([{ id: "m1" }]) });
const SCAN = new Uint8Array(readFileSync(fileURLToPath(new URL("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf", import.meta.url))));
const shaOf = (b) => createHash("sha256").update(b).digest("hex");
function bucket() {
  const held = new Map();
  const object = (k, b) => ({ key: k, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  return { async put(k, v) { held.set(k, v); return { key: k, size: v.length }; },
           async get(k) { return held.has(k) ? object(k, held.get(k)) : null; },
           async head(k) { return held.has(k) ? { key: k, size: held.get(k).length } : null; },
           async delete(k) { held.delete(k); }, async list() { return { objects: [...held.keys()].map((key) => ({ key })), truncated: false }; } };
}
/* agent-worker's `/transcribe` answering `answer` at `status`. */
const worker = (status, answer) => ({ seen: 0, async fetch() { this.seen++;
  return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } }); } });
/* A stored scan's reading, filed in a bundle, as a promotion leaves them; the transcriber admitted on a one-matter set. */
async function scanned(w, { account = "apikey" } = {}) {
  const x = await doors({ gate: { testSet: ONE_MATTER }, env: { CAPTURES: bucket() }, worker: w, account });
  assert.equal(aiRunsOf(x.ctx).testBarRecord({ part: "transcribe", set: "t46-set", set_version: 1, false_alarm_rate: 0, passed: true,
                                                graded_by: "harness", at: "2026-10-01T00:00:00Z" }).ok, true);
  const d = shaOf(SCAN);
  await x.env.CAPTURES.put(`bio/captures/${d}`, SCAN);
  x.ctx.storage.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
                          VALUES ('B-T46', 'information', 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1)`);
  extractionOf(x.ctx).writeReading({ bundleId: "B-T46", captureSha: d, reading: { content_type: "generic", reader_version: 1,
    read_from_text: false, found: false, entities: [], facts: {}, at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: 1 } });
  const res = await x.fetch(`/pagetranscribe?sha256=${d}&cls=member&session=1&caps=contribute&viewer=member:ann&author=member:ann&store=bio`,
                            { method: "POST", body: "{}" });
  return { x, status: res.status, text: await res.text() };
}

test("R57 (was plane R36; T46; N886; K2940; extraction R75; agent-worker R72): a refusal agent-worker answers after the post is relayed with its own HTTP status: a stub answering 400 BAD_PAGES is answered 400 with that code, and 409 NO_ACCOUNT 409; control: an answer of 200 is performed", async () => {
  const bad = worker(400, { ok: false, code: "BAD_PAGES", detail: "no page" });
  /* the store's door answers the owner's answer in its envelope, `{ok, result: {status, body}}`, the status the Worker's
     door gives the member */
  const r = await scanned(bad);
  assert.equal(bad.seen, 1, "posted");
  const rb = JSON.parse(r.text).result;
  assert.deepEqual([rb.status, rb.body.code], [400, "BAD_PAGES"], r.text);
  const none = worker(409, { ok: false, code: "NO_ACCOUNT", detail: "none" });
  const n = JSON.parse((await scanned(none)).text).result;
  assert.deepEqual([n.status, n.body.code], [409, "NO_ACCOUNT"]);
  /* the AI path itself answers the status beside the code */
  const p = await transcriberOf(r.x.ctx, r.x.env).transcription({ member: "member:ann", at: "2026-10-12T00:00:00Z" })
    .transcribe({ account: { ok: true, kind: "apikey", level: "member", key: "sk" }, capture_sha: shaOf(SCAN), pages: [0] });
  assert.deepEqual([p.ok, p.reason, p.status], [false, "BAD_PAGES", 400]);
  /* control */
  const fine = worker(200, { ok: true, engine: "claude-test", version: null, pages: [{ page: 0, text: "words" }], not_transcribed: [] });
  const ok = JSON.parse((await scanned(fine)).text).result;
  assert.equal(ok.status, 200, JSON.stringify(ok));
  assert.equal(ok.body.transcription.performed, true, JSON.stringify(ok));
});

/* ===== R39 (T46; N935) and R5 (T46): the route map ===== */

const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

test("R34 (was plane R39; T46; N935; case-account R15, local-facts R15): case-account's and local-facts' own ops maps are spread whole into the route map at their places, so advocacycheck, advocacychecks and grouprules each answer through the door what the owner's own map answers called directly; the plane names no entry of either", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(u, null));
  const own = { "case-account": caseAccountOps(caseAccountOf(x.ctx), u, null), "local-facts": localFactsOps(localFactsOf(x.ctx), u, null) };
  assert.deepEqual(Object.keys(own["case-account"]).sort(), ["advocacycheck", "advocacychecks"]);
  assert.ok(Object.keys(own["local-facts"]).includes("grouprules"));
  for (const [mod, map] of Object.entries(own)) {
    const entry = ownMaps(x.ctx, u, null).find(([m]) => m === mod);
    assert.deepEqual(Object.keys(entry[1]), Object.keys(map), `${mod}: the map at its place is the owner's own, nothing added`);
    for (const op of Object.keys(map)) assert.ok(keys.includes(op), `${mod}: the route map lacks ${op}`);
  }
  for (const [mod, path] of [["case-account", "advocacychecks?project=PROJ-2026-none&viewer=member:nobody"],
                             ["case-account", "advocacycheck?project=PROJ-2026-none&viewer=member:nobody&by=member:nobody"],
                             ["local-facts", "grouprules?viewer=member:nobody"]]) {
    const op = path.split("?")[0], url = new URL(`http://do/${path}`);
    const res = await x.fetch(`/${path}`, { method: "POST", body: "{}" });
    const ops = mod === "case-account" ? caseAccountOps(caseAccountOf(twin.ctx), url, {}) : localFactsOps(localFactsOf(twin.ctx), url, {});
    const direct = await ops[op]();
    assert.equal(res.status, 200, op);
    assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct }))), op);
  }
  /* negative control: an op neither map holds is no route */
  assert.equal(keys.includes("advocacyzz"), false);
});

/* T46's new ops are served by these owners' maps (op-declarations R50, R51): the ops are read from the owners' own maps
   (K3268), never listed here. */
const T46_OWNERS = ["escalation", "plan-work", "action-clocks", "instance-setup", "membership"];

test("R6 (was plane R5; T46): the route map is re-pinned to T46's new ops: each is in the map of the module that serves it, in the route map, and answers through control-plane's door what that map answers called directly; `textcheck` is the draft door's (R41); an op no map serves is no route", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(u, null));
  const { served, failed } = await servedThroughDoor(x, twin, T46_OWNERS);
  assert.deepEqual(failed, []);
  for (const op of ["escalationstoppursuing", "escalationreopen"]) assert.ok(served.some(([o]) => o === op), `${op} is escalation's`);
  assert.equal(DRAFT_KIND_OF.textcheck, "textcheck");
  assert.equal(keys.includes("zzprobe46"), false);
});
