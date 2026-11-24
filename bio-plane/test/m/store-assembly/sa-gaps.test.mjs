/* store-assembly R33, R52, R58, R63: the requirements whose plane tests ran under workerd (and so stay with plane), tested here
   on the assembled store in plain node, at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { storage, store, assembleStore } from "./fixture.mjs";
import { memoryBucket } from "./world.mjs";
import { ownerGettersOf } from "../../../src/store-assembly/owners.mjs";
import { wireAccount, tokenRefusal, SIGNIN_TOKEN_REFUSED } from "../../../src/store-assembly/ask.mjs";
import { transcriberOf, TRANSCRIBE_LOAD_MAX, TRANSCRIBE_PAGES_MAX, PAGES_MAX, OWED } from "../../../src/store-assembly/transcribe.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import { acquireTimingsOf } from "../../../src/store-assembly/acquire-timings.mjs";
import { caseAccountOf } from "../../../src/case-account/index.mjs";
import { reviewOf } from "../../../src/review/index.mjs";
import { caseAuthoringOf } from "../../../src/case-authoring/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const SCAN = new Uint8Array(readFileSync(here("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf")));
const shaOf = (b) => createHash("sha256").update(b).digest("hex");

/* ---- R33 ---- */

test("R33: case-account is one instance per host, built with ai-runs' instance as its runs, and the one case-authoring, review and the door's owner map reach", async () => {
  const { ctx, env } = await store();
  const one = caseAccountOf(ctx);
  assert.equal(ownerGettersOf(ctx, env).caseAccount(), one, "the door's getter");
  assert.equal(caseAuthoringOf(ctx).account, one, "case-authoring's");
  assert.equal(reviewOf(ctx).caseAccount, one, "review's");
  assert.equal(one.runs, aiRunsOf(ctx, env), "its runs are ai-runs' one instance on this host");
});

/* ---- R52 ---- */

test("R52: a sign-in account carries its held token as `secret` in agent-worker R6's shape; an answer refusing that token has credentials drop it, once", () => {
  const dropped = [];
  const accounts = { accountReferenceState: () => ({ ok: true, subscription: { uses: { suggestions: true } } }), groupKeySwitches: () => ({}),
                     subscriptionTokenRefused: (a) => { dropped.push(a); return { ok: true }; } };
  const ref = { kind: "signin", level: "member", key: "held-signin-token", member: "member:ann" };
  const { account, suggestions } = wireAccount(accounts, ref, "member:ann");
  assert.deepEqual(account, { kind: "signin", level: "member", secret: "held-signin-token", member: "member:ann", suggestions: true });
  assert.equal(suggestions, true);
  const heard = tokenRefusal(accounts, ref);
  assert.equal(heard({ ok: false, code: SIGNIN_TOKEN_REFUSED }), true);
  assert.equal(heard({ ok: false, reason: SIGNIN_TOKEN_REFUSED }), false, "once");
  assert.deepEqual(dropped, [{ member: "member:ann" }]);
  /* controls: an API key's secret is its key, and its refusal drops nothing; an answer refusing nothing drops nothing */
  const key = wireAccount(accounts, { kind: "apikey", level: "member", key: "sk-ant-key", member: "member:ann" }, "member:ann").account;
  assert.equal(key.secret, "sk-ant-key");
  assert.equal(tokenRefusal(accounts, { kind: "apikey", member: "member:ann" })({ code: SIGNIN_TOKEN_REFUSED }), false);
  assert.equal(tokenRefusal(accounts, ref)({ ok: false, code: "BAD_PAGES" }), false);
  assert.equal(dropped.length, 1);
});

/* ---- R58 ---- */

/* agent-worker's `/transcribe` binding, recording every request (an env binding the test hands in, R94) */
function binding() {
  const seen = [];
  return { seen, fetch: async (u, init) => { const body = JSON.parse(init.body); seen.push(body);
    return new Response(JSON.stringify({ ok: true, engine: "claude-test", version: null, pages: body.pages.map((p) => ({ page: p.page, text: "words" })) }),
      { status: 200, headers: { "content-type": "application/json" } }); } };
}
async function transcriberWith(bytes) {
  const evidence = memoryBucket(), worker = binding();
  const env = { STORE: { idFromName: (n) => n }, CAPTURES: evidence, AGENT_WORKER: worker };
  const x = await store({ env });
  const sha = shaOf(bytes);
  await evidence.put(`bio/captures/${sha}`, bytes);
  const tx = transcriberOf(x.ctx, env).transcription({ member: "member:ann", at: "2026-10-11T06:00:00Z" });
  const account = { ok: true, kind: "apikey", level: "member", key: "sk-ant-R58" };
  return { ...x, worker, sha, ask: (pages) => tx.transcribe({ account, capture_sha: sha, pages }) };
}

test("R58: a capture over the inline ceiling is not loaded into the request: every asked page is named owed and kept as a job row, nothing posted", async () => {
  const big = new Uint8Array(TRANSCRIBE_LOAD_MAX + 1024);
  big.set(new TextEncoder().encode("%PDF-1.7\n"));
  const t = await transcriberWith(big);
  const r = await t.ask([0, 1, 2]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "NO_PAGE_RENDERED");
  assert.deepEqual(r.asked, [0, 1, 2]);
  assert.deepEqual(r.sent, []);
  assert.equal(r.size, big.length);
  assert.equal(r.limit, TRANSCRIBE_LOAD_MAX);
  assert.deepEqual(r.refused, [0, 1, 2].map((page) => ({ page, reason: OWED })));
  assert.deepEqual(r.owed, [0, 1, 2]);
  assert.equal(t.worker.seen.length, 0, "nothing posted");
  const row = pendingOf(t.ctx).jobRow({ sha: t.sha, kind: "ocr" });
  assert.ok(row, "the pages are owed as a job row");
  assert.deepEqual(row.detail.pages, [0, 1, 2]);
  assert.equal(row.owed, 3);
});

test("R58: a capture within the ceiling is read in the request by ranges; asked pages beyond TRANSCRIBE_PAGES_MAX are named unread and owed, never dropped", async () => {
  const t = await transcriberWith(SCAN);
  const asked = [...Array(TRANSCRIBE_PAGES_MAX + 2).keys()];
  const r = await t.ask(asked);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(t.worker.seen.length, 1, "posted once");
  assert.deepEqual(r.asked, asked);
  assert.ok(r.sent.includes(0), "the scan's page is read in the request");
  const beyond = asked.slice(TRANSCRIBE_PAGES_MAX);
  for (const page of beyond) assert.ok(r.unread.some((u) => u.page === page && u.reason === PAGES_MAX), `page ${page} named unread`);
  /* every asked page that was not sent is stated, none dropped */
  for (const page of asked) assert.ok(r.sent.includes(page) || r.unread.some((u) => u.page === page), `page ${page} stated`);
  assert.deepEqual(r.owed, beyond);
  assert.deepEqual(pendingOf(t.ctx).jobRow({ sha: t.sha, kind: "ocr" }).detail.pages, beyond);
  /* control: a capture the evidence store does not hold answers EVIDENCE_ABSENT, nothing posted */
  const none = await transcriberWith(new Uint8Array([1, 2, 3]));
  await none.env.CAPTURES.delete(`bio/captures/${none.sha}`);
  assert.equal((await none.ask([0])).reason, "EVIDENCE_ABSENT");
  assert.equal(none.worker.seen.length, 0);
});

/* ---- R63 ---- */

test("R63: acquiretimings answers `restarted: true` beside the stage times when the record survived an object restart over the same storage; a record of the running instance answers none", async () => {
  const db = new DatabaseSync(":memory:"), env = { STORE: { idFromName: (n) => n } };
  const a = storage(db);
  const first = assembleStore(a.ctx, env);
  for (const p of a.blocked) await p;
  /* the acquisition times its stages on the object the door's trace keys */
  const t = acquireTimingsOf(a.ctx).open("trace-r63");
  t.fetchStartedAt = 10;
  t.fetchMs = 25;
  const live = await (await first.dispatch(new Request("http://do/acquiretimings?trace=trace-r63"))).json();
  assert.equal(live.ok, true);
  assert.ok(live.result.stageTimes, "the running instance's stages");
  assert.equal(live.result.restarted, undefined, "control: the running instance's record says no restart");
  /* the object restarted: a new instance over the same storage */
  const b = storage(db);
  const second = assembleStore(b.ctx, env);
  for (const p of b.blocked) await p;
  const after = await (await second.dispatch(new Request("http://do/acquiretimings?trace=trace-r63"))).json();
  assert.equal(after.result.restarted, true);
  assert.deepEqual(after.result.stageTimes, live.result.stageTimes, "the stages that ran, as recorded");
  /* control: a trace never opened answers no stages and no restart */
  const none = await (await second.dispatch(new Request("http://do/acquiretimings?trace=never"))).json();
  assert.deepEqual(none.result, { ok: true, stageTimes: null });
});
