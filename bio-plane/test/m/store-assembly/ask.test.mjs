/* store-assembly's copy of plane's test. plane B2 (K1674, K1684; control-plane R53; agent-worker R54, R56; credentials R24, R25, R27): `op=ask`'s handler. The
   door's arm admits only a member's own session or a presented grant's member and asks the `bio` object; there the
   member's grant is minted at their act, their own account unsealed for this ask, their suggestions switch read, and
   the question posted to agent-worker's `/ask`, whose answer comes back unchanged. Driven on the assembled store. */
import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { store, deployed, GATE_FLAGS, GATE_SET, disclosed } from "./fixture.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { askOp, assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const SEAL = "a-long-seal-secret-for-the-test-only";
const SESSION = "s".repeat(64);
/* agent-worker R59's answer to a writing-help draft */
const DRAFT = { ok: true, task: { op: "writinghelp", act: "conclude", field: "reason" }, draft: { text: "A worded reason." },
                label: { kind: "machine" }, usage: { input_tokens: 3, output_tokens: 4 }, calls: 1 };

/* An assembled store whose agent-worker records each ask and answers a two-line stream; ann holds a session and an account. */
async function world({ account = true, worker = true } = {}) {
  const asks = [];
  const env = { ACCOUNT_SEAL_SECRET: SEAL };
  if (worker) env.AGENT_WORKER = { fetch: async (u, init) => { asks.push([u, JSON.parse(init.body)]);
    if (u === "https://agent-worker/draft")
      return new Response(JSON.stringify(DRAFT), { status: 200, headers: { "content-type": "application/json" } });
    return new Response('{"event":"step","step":"interpreting"}\n{"event":"answer","ok":true}\n',
                        { status: 200, headers: { "content-type": "application/x-ndjson" } }); } };
  /* R50 (K2853): the doors deployed for this test (their flags on, the bar held on the test's set) */
  const x = await store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });
  await deployed(x.ctx);
  const sql = x.ctx.storage.sql;
  /* the copy's assistant on: keep-away switched off by an administrator (credentials R51; instance-setup R53 derives the
     assistant's state from it, K2162) */
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  const on = credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" });
  assert.equal(on.ok, true, JSON.stringify(on));
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  /* credentials R40 (F13): a session is held only as its token's SHA-256 */
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  if (account) {
    await disclosed(x.ctx);   /* R35 (T47): the disclosure first, as the assembled store asks */
    const r = await credentialsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  return { ...x, asks };
}

test("R49, B2 (K1674): the assembled store's `ask(args)` (`askOnObject`): a member's ask mints their grant, unseals their own account and carries both to agent-worker's /ask, whose stream comes back unchanged", async () => {
  const x = await world();
  const res = await x.s.ask({ member: "member:ann", session: SESSION, question: "Who holds the clerk's office?",
                              conversation: [], store: null });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/x-ndjson");
  assert.equal(await res.text(), '{"event":"step","step":"interpreting"}\n{"event":"answer","ok":true}\n');
  assert.equal(x.asks.length, 1);
  const [u, body] = x.asks[0];
  assert.equal(u, "https://agent-worker/ask");
  assert.deepEqual(Object.keys(body).sort(), ["account", "conversation", "grant", "question"], "no store unless one was named");
  assert.equal(body.question, "Who holds the clerk's office?");
  assert.match(body.grant, /^[0-9a-f]{64}$/, "the grant minted at the member's act");
  assert.deepEqual(body.account, { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: false },
                   "agent-worker R6's shape: credentials R35's account, its `key` carried as `secret`");
  /* the grant is the member's: credentials admits it for an ask read, as that member */
  const admit = await credentialsOf(x.ctx).aiGrantAdmit({ token: body.grant, op: "search", write: false });
  assert.equal(admit.ok, true, JSON.stringify(admit));
  assert.equal(admit.viewer, "member:ann");
});

test("B2 (agent-worker R56): the member's suggestions switch is carried as they set it", async () => {
  const x = await world();
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  await x.s.ask({ member: "member:ann", session: SESSION, question: "q", store: "scratch" });
  assert.equal(x.asks[0][1].account.suggestions, true);
  assert.equal(x.asks[0][1].store, "scratch", "a named store is carried");
});

test("B2 (K1684): a presented grant is carried as given and no grant is minted", async () => {
  const x = await world();
  await x.s.ask({ member: "member:ann", grant: "g".repeat(64), question: "q" });
  assert.equal(x.asks[0][1].grant, "g".repeat(64));
});

test("B2 negative controls: no account, another's session, and no assistant member are each refused in their owner's words, and nothing is asked", async () => {
  const none = await world({ account: false });
  const r1 = await none.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal(r1.ok, false);
  assert.match(JSON.stringify(await r1.json()), /NO_ACCOUNT/);
  const x = await world();
  const r2 = await x.s.ask({ member: "member:ann", session: "t".repeat(64), question: "q" });
  assert.equal(r2.status, 403);
  assert.match(JSON.stringify(await r2.json()), /NOT_YOUR_ACCOUNT/);
  const unbound = await world({ worker: false });
  const r3 = await unbound.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal(r3.status, 503);
  assert.deepEqual(await r3.json(), { ok: false, reason: "AGENT_WORKER_UNBOUND",
    detail: word("refusal.AGENT_WORKER_UNBOUND") }, "DEC-149: the member is told in the group's own words, read by key (R95)");
  assert.equal(none.asks.length + x.asks.length + unbound.asks.length, 0, "nothing reached agent-worker");
});

/* N765 (instance-setup R55, credentials R35; K231, K2200 (3)): the one keep-away refusal, as `credentials.aiKeptAway()`
   mints it and instance-setup's `assistantGate()` answers it, with the administrator's reason, who and when. */
function keptAway(body, label) {
  assert.equal(body.ok, false, label);
  assert.equal(body.reason, "AI_KEPT_AWAY", label);
  assert.equal(body.code, "AI_KEPT_AWAY", label);
  assert.equal(body.check, "C-29.31", label);
  assert.equal(typeof body.translation, "string", label);
  assert.ok(body.translation.length > 0, label);
  assert.equal(body.keep_away.reason, "kept away for the test", label);
  assert.equal(body.keep_away.set_by, "ada", label);
  assert.equal(typeof body.keep_away.set_at, "string", label);
  assert.equal(JSON.stringify(body).includes("ASSISTANT_OFF"), false, `${label}: ASSISTANT_OFF is retired`);
}

test("B7 (K1690, K2162; N765: instance-setup R55, credentials R35, R51): while the group keeps its material away, an ask is refused AI_KEPT_AWAY, carrying the administrator's reason, before any grant is minted or any account read; switched back, it is asked", async () => {
  const x = await world();
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: true, reason: "kept away for the test", by: "ada" }).ok, true);
  const r = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal(r.status, 403);
  const body = await r.json();
  keptAway(body, "ask");
  assert.deepEqual(body, JSON.parse(JSON.stringify(credentialsOf(x.ctx).aiKeptAway())), "credentials' refusal as given");
  assert.equal(x.asks.length, 0, "nothing reached agent-worker");
  assert.equal([...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c, 0, "no grant minted");
  /* negative control: keep-away switched off again, the same ask is asked */
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  assert.equal((await x.s.ask({ member: "member:ann", session: SESSION, question: "q" })).status, 200);
  assert.equal(x.asks.length, 1);
});

test("B2 (control-plane R53; F1, admission R20): the door's arm asks the bio object only for a member's own session or a presented grant's member, reading the credential from the Authorization header, else the body's token, else (T35 only) the query; any other caller is refused", async () => {
  const seen = [];
  const env = { STORE: { idFromName: (n) => n, get: (id) => ({ ask: async (a) => { seen.push([id, a]); return new Response("{}"); } }) } };
  const OTHER = "o".repeat(64);
  const req = (headers = {}, extra = {}) => new Request("http://plane/ask", { method: "POST", headers,
    body: JSON.stringify({ question: "q", conversation: [], ...extra }) });
  const bare = new URL("http://plane/ask");
  /* the header: the session and the grant each read from `Authorization: Bearer` */
  await askOp({ req: req({ authorization: `Bearer ${SESSION}` }), url: bare, env, viaSession: true, sessMember: "ann" });
  assert.deepEqual(seen[0], ["bio", { member: "member:ann", question: "q", conversation: [], store: null, session: SESSION, grant: null }]);
  await askOp({ req: req({ authorization: `bearer ${SESSION}` }), url: bare, env, viaSession: false, grantMember: "member:bob" });
  assert.deepEqual(seen[1][1], { member: "member:bob", question: "q", conversation: [], store: null, session: null, grant: SESSION });
  /* the header wins over a query token beside it, which is not read */
  await askOp({ req: req({ authorization: `Bearer ${SESSION}` }), url: new URL(`http://plane/ask?token=${OTHER}`), env,
                viaSession: true, sessMember: "ann" });
  assert.equal(seen[2][1].session, SESSION);
  /* the body's token, when no header presents one; it wins over the query */
  await askOp({ req: req({}, { token: SESSION }), url: new URL(`http://plane/ask?token=${OTHER}`), env, viaSession: true, sessMember: "ann" });
  assert.equal(seen[3][1].session, SESSION);
  /* the query, for T35's release only (admission R20: admitted and named deprecated by the door) */
  await askOp({ req: req(), url: new URL(`http://plane/ask?token=${SESSION}`), env, viaSession: true, sessMember: "ann" });
  assert.equal(seen[4][1].session, SESSION);
  /* an Authorization header in another form presents nothing */
  await askOp({ req: req({ authorization: `Basic ${SESSION}` }), url: bare, env, viaSession: true, sessMember: "ann" });
  assert.equal(seen[5][1].session, null);
  /* a binding class or an ai credential is no member: refused before anything is read */
  const r = await askOp({ req: req(), url: bare, env, viaSession: false });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).reason, "ASK_NOT_A_MEMBER");
  assert.equal(seen.length, 6);
  const bad = await askOp({ req: new Request("http://plane/ask", { method: "POST", body: "{x" }), url: bare, env, viaSession: true, sessMember: "ann" });
  assert.equal(bad.status, 400);
});

test("B5 (K1685; answers R1, R2): a read under an ask's grant reaching this object is recorded through this object's answers' logRead, which the assembly hands the dispatch frame", async () => {
  const { answersOf } = await import("../../../src/answers/index.mjs");
  const x = await store();
  const a = answersOf(x.ctx), was = a.logRead.bind(a), seen = [];
  a.logRead = (e) => { seen.push([e.grant, e.op, e.viewer]); return was(e); };
  try {
    const grant = "g".repeat(64);
    /* store-door R9 (F1): the grant reaches the object in the door's `x-bio-grant` header, never the address */
    const r = await x.fetch(`/search?q=clerk&viewer=member:ann`, { headers: { "x-bio-grant": grant } });
    assert.equal(r.status, 200);
    assert.deepEqual(seen, [[grant, "search", "member:ann"]], "the read was recorded in this object's read log");
    /* negative control: a read with no grant is recorded nowhere */
    await x.fetch(`/search?q=clerk&viewer=member:ann`);
    assert.equal(seen.length, 1);
  } finally { a.logRead = was; }
});

test("K1806, R49 (agent-worker R6, R54; credentials R35; K1755; T46: N897 (3)): a member with no account of their own is served by the group's API key while it is held and on, carried as level `group` with the group key's own suggestions switch; with it off, or its notice unread, nothing is asked", async () => {
  const x = await world({ account: false });
  const c = credentialsOf(x.ctx);
  const set = await c.groupKeySet({ key: "sk-ant-zz-group", by: "ada" });
  assert.equal(set.ok, true, JSON.stringify(set));
  /* held but off (off by default): no account serves ann, so nothing is minted and nothing asked */
  const off = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.match(JSON.stringify(await off.json()), /NO_ACCOUNT/);
  assert.equal((await c.groupKeySwitch({ on: true, by: "ada" })).ok, true);
  /* on, but ann has not read the notice that her questions go to Anthropic under the group's account (credentials R36) */
  const due = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.match(JSON.stringify(await due.json()), /GROUP_KEY_NOTICE_DUE/);
  assert.equal(x.asks.length, 0, "nothing reached agent-worker");
  assert.equal((await c.groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" })).ok, true);
  assert.equal((await c.accountUsesSet({ owner: "group", switch: "suggestions", on: true, by: "ada" })).ok, true);
  const r = await x.s.ask({ member: "member:ann", session: SESSION, question: "Who holds the clerk's office?" });
  assert.equal(r.status, 200);
  assert.equal(x.asks.length, 1);
  assert.deepEqual(x.asks[0][1].account, { kind: "apikey", level: "group", secret: "sk-ant-zz-group", member: "member:ann", suggestions: true },
                   "R49 (T46): the group's key serves ann's own ask, with the group key's own suggestions switch");
  /* her own reference, once set, serves her first */
  await disclosed(x.ctx);   /* R35 (T47): the disclosure first, as the assembled store asks */
  assert.equal((await c.accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" })).ok, true);
  await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal(x.asks[1][1].account.level, "member");
  assert.equal(x.asks[1][1].account.secret, "sk-ant-zz-ann");
});

/* R17 (N686; K2038, K2041, K2062; control-plane R57, agent-worker R59): the draft's account and grant on the `bio` object,
   asked in control-plane's `draftAsk` shape and answering a Response the door reads as JSON. */
const TASK = { op: "writinghelp", act: "conclude", field: "reason" };
const PACK = { layers: ["writing_help"] };
const ask = (extra = {}) => ({ op: "writinghelp", member: "ann", session: SESSION, told: "what I saw", act: "conclude",
                               field: "reason", firsthand: false, pack: PACK, ...extra });
const draft = async (x, extra = {}) => { const res = await x.s.draft(ask(extra)); return { status: res.status, body: await res.json() }; };

test("R49 (N686; K2062; agent-worker R59): the assembled store's `draft(args)` (`draftOnObject`): a member's draft carries their account in R6's shape and the door's pack to agent-worker's /draft, with no grant while their suggestions switch is off; agent-worker's answer comes back at its status with the switch and an empty read log", async () => {
  const x = await world();
  const r = await draft(x);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ...DRAFT, grant: null, suggestions: false, read: [] });
  assert.equal(x.asks.length, 1);
  const [u, body] = x.asks[0];
  assert.equal(u, "https://agent-worker/draft");
  assert.deepEqual(body, { task: TASK, told: "what I saw", pack: PACK,
    account: { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: false } },
    "no grant, so the door's pack rides with it and the draft works only from what the member told it");
  assert.equal([...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c, 0, "no grant minted");
  /* the group's description: its task names the op alone */
  await draft(x, { op: "groupdescriptiondraft", told: [{ question: "q", text: "t" }], act: null, field: null });
  assert.deepEqual(x.asks[1][1].task, { op: "groupdescriptiondraft" });
});

test("R49 (N686; DEC-153 (2), K1841 (2), K2041): with the member's suggestions on, a grant is minted and sent in place of the pack, and its read log's strings come back; a firsthand field never gets one", async () => {
  const x = await world();
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  /* the assistant member reads through the grant while it drafts, as agent-worker R59's read tool does: a read on this
     object under the grant, in store-door's header, recorded in its read log (answers R1, R2) */
  const fetchDraft = x.env.AGENT_WORKER.fetch;
  x.env.AGENT_WORKER.fetch = async (u, init) => {
    const b = JSON.parse(init.body);
    if (b.grant) await x.fetch(`/search?q=clerk&viewer=member:ann`, { headers: { "x-bio-grant": b.grant } });
    return fetchDraft(u, init);
  };
  const r = await draft(x);
  assert.equal(r.status, 200);
  assert.equal(r.body.suggestions, true);
  assert.match(r.body.grant, /^[0-9a-f]{64}$/);
  assert.equal(x.asks[0][1].grant, r.body.grant, "the grant sent is the one handed back");
  assert.equal(x.asks[0][1].pack, undefined, "with a grant the pack is read under it, not sent");
  assert.deepEqual(r.body.read, [...answersOf(x.ctx).readLog(r.body.grant).index.keys()], "K2041: the strings of the grant's read log");
  assert.ok(r.body.read.length > 0, JSON.stringify(r.body.read));
  const admit = await credentialsOf(x.ctx).aiGrantAdmit({ token: r.body.grant, op: "search", write: false });
  assert.equal(admit.viewer, "member:ann", "the member's own read-only grant");
  /* firsthand: what the member saw is only worded, never read for (DEC-153 (2)) */
  const f = await draft(x, { firsthand: true });
  assert.equal(f.body.grant, null);
  assert.deepEqual(f.body.read, [], "no grant, no read log");
  assert.equal(x.asks[1][1].grant, undefined);
  assert.equal(x.asks[1][1].firsthand, true);
  assert.equal([...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c, 1, "one grant, the first draft's");
});

test("R49 (T37; K2238; agent-worker R68, run-rules R22): a translation draft carries its task {op, direction, language, words}, the account and the door's pack to /draft, and no told, grant or firsthand, even with the member's suggestions on", async () => {
  const x = await world();
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  const words = [{ key: "nav.home", en: "Home", note: "the first screen", means: "where a member starts", protected: false }];
  const TPACK = { layers: ["interface_translation"] };
  for (const direction of ["to_language", "to_english"]) {
    const asked = { op: "translationdraft", member: "ann", session: SESSION, pack: TPACK, direction, language: "es", words };
    const res = await x.s.draft(asked);
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual([r.grant, r.suggestions, r.read], [null, true, []], "no grant, so no read log");
    const [u, body] = x.asks.at(-1);
    assert.equal(u, "https://agent-worker/draft");
    assert.deepEqual(body, { task: { op: "translationdraft", direction, language: "es", words }, pack: TPACK,
      account: { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: true } }, direction);
  }
  assert.equal([...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c, 0, "no grant minted for a translation");
  /* negative control: the same member's writing-help draft, suggestions on, is sent a grant in place of the pack */
  const w = await draft(x);
  assert.match(w.body.grant, /^[0-9a-f]{64}$/);
  assert.equal(x.asks.at(-1)[1].pack, undefined);
});

test("R49 (N686; credentials R35, R37): a member with no account of their own is served by the group's key, carried as level `group` with the group's suggestions switch", async () => {
  const x = await world({ account: false });
  const c = credentialsOf(x.ctx);
  assert.equal((await c.groupKeySet({ key: "sk-ant-zz-group", by: "ada" })).ok, true);
  assert.equal((await c.groupKeySwitch({ on: true, by: "ada" })).ok, true);
  assert.equal((await c.groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" })).ok, true);
  assert.equal((await c.accountUsesSet({ owner: "group", switch: "suggestions", on: true, by: "ada" })).ok, true);
  const r = await draft(x);
  assert.equal(r.status, 200);
  assert.deepEqual(x.asks[0][1].account, { kind: "apikey", level: "group", secret: "sk-ant-zz-group", member: "member:ann", suggestions: true });
  assert.equal(r.body.suggestions, true);
  assert.match(r.body.grant, /^[0-9a-f]{64}$/);
});

test("R49 negative controls (N686; N765): no assistant member, the group keeping its material away (AI_KEPT_AWAY), no account, a session not the member's, and a member that does not answer each end the draft in their owner's words at their status, nothing asked or nothing kept", async () => {
  const unbound = await world({ worker: false });
  const r1 = await draft(unbound);
  assert.deepEqual([r1.status, r1.body.reason], [503, "AGENT_WORKER_UNBOUND"]);
  const off = await world();
  assert.equal(credentialsOf(off.ctx).aiKeepAwaySet({ on: true, reason: "kept away for the test", by: "ada" }).ok, true);
  const r2 = await draft(off);
  assert.equal(r2.status, 403);
  keptAway(r2.body, "draft");   /* N765: AI_KEPT_AWAY, as for an ask (instance-setup R55) */
  assert.deepEqual([r2.body.grant, r2.body.suggestions, r2.body.read], [null, false, []], "before any account or grant");
  const none = await world({ account: false });
  const r3 = await draft(none);
  assert.equal(r3.status, 409);
  assert.match(JSON.stringify(r3.body), /NO_ACCOUNT/);
  const x = await world();
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  const r4 = await draft(x, { session: "t".repeat(64) });
  assert.equal(r4.status, 403, "a grant is minted only under the member's own live session");
  assert.equal(r4.body.grant, null);
  assert.equal(off.asks.length + none.asks.length + x.asks.length, 0, "nothing reached agent-worker");
  const silent = await world();
  silent.env.AGENT_WORKER.fetch = async () => { throw new Error("gone"); };
  const r5 = await silent.s.draft(ask());
  assert.equal(r5.status, 502);
  assert.equal((await r5.json()).reason, "AGENT_WORKER_SILENT");
});
