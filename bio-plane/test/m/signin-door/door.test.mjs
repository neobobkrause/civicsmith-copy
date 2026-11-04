/* signin-door R1–R5: the Worker half (`src/signin-door/index.mjs`) driven at its interface, with a stand-in store (the
   caller's `store(path, init)`, answering in `doAnswer`'s shape and recording every request) and a stand-in
   `AGENT_WORKER` binding recording each request it is sent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { subscriptionSignin, subscriptionDisconnect, signoutLeaver, leaverOf, tokenRefusedSeen, signintrace,
         memberRefOf, testInstanceOf, SIGNIN_WORDS, TRACE_HEADER, MEMBER_REF_HEADER } from "../../../src/signin-door/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { issuedTokenMalformed } from "../ai-accounts/fixtures.mjs";
import { world as accountsWorld } from "../ai-accounts/fixture.mjs";
import { refusedAnswer } from "../answer-envelope/fixtures.mjs";

const ANN = "member:ann";
const TEST_ENV = { CIVICSMITH_TEST_INSTANCE: "civ-test", INSTANCE_NAME: "civ-test" };
const PROD_ENV = { INSTANCE_NAME: "oakland" };
const keptAway = { ok: false, reason: "AI_KEPT_AWAY", code: "AI_KEPT_AWAY", detail: "kept away", keep_away: { reason: "a case" } };
const disclosureDue = { ok: false, reason: "DISCLOSURE_DUE", code: "DISCLOSURE_DUE", check: "C-29.40",
                        translation: "Read what connecting means first.", detail: "not yet shown", member: "ann" };
/* F1: ai-accounts' T53 read of a member's own accounts (`accountsOf`, its R2), by its real code over its own test world:
   `with` after her sign-in token is held (`subscriptionTokenHold`, an issued account of the subscription plan), `without`
   when she holds no account. */
async function accountsRead() {
  const w = await accountsWorld().group("ann");
  const without = w.a.accountsOf({ owner: ANN, viewer: ANN });
  const held = await w.a.subscriptionTokenHold({ member: ANN, token: "sk-ant-oat01-" + "s".repeat(40) });
  if (!held.ok) throw new Error(`accountsRead: ${held.reason}`);
  return { with: w.a.accountsOf({ owner: ANN, viewer: ANN }), without, held };
}
const ACCOUNT = await accountsRead();

/* The stand-in store: `routes[name]` is a result (answered), `"refused"`, `"silent"` or a function of the call. */
function storeOf(routes = {}) {
  const calls = [];
  const fn = async (path, init = {}) => {
    const url = new URL(`http://do/${path}`);
    const route = url.pathname.slice(1);
    const call = { route, path, params: Object.fromEntries(url.searchParams), body: init.body ? JSON.parse(init.body) : undefined,
                   headers: init.headers ?? {} };
    calls.push(call);
    let r = routes[route];
    if (typeof r === "function") r = r(call);
    if (r === "silent") return { answered: false, result: undefined };
    if (r === "refused") return refusedAnswer();
    return { answered: true, result: r ?? { ok: true } };
  };
  fn.calls = calls;
  fn.of = (route) => calls.filter((c) => c.route === route);
  return fn;
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function agentWorker(reply = (body) => json(200, body.step === "start" ? { ok: true, address: "https://claude.ai/oauth/x", attempt: "att-1" }
                                                   : { ok: true, member: body.member })) {
  const sent = [];
  return { sent, fetch: async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url: String(url), path: new URL(String(url)).pathname, body, headers: init.headers });
    return reply(body);
  } };
}
function world({ env = PROD_ENV, routes = {}, reply } = {}) {
  const aw = agentWorker(reply);
  const lines = [];
  const store = storeOf({ aikeptaway: { ok: true }, signindisclosuredue: { ok: true },
                          accountsof: ACCOUNT.with, ...routes });
  const e = { ...env, AGENT_WORKER: aw };
  const go = (asked, member = ANN) => subscriptionSignin({ env: e, member, asked, store, log: (l) => lines.push(l) });
  return { aw, lines, store, env: e, go };
}

/* ================================================================ R1 */

test("R1: `start`, `code` and `signout` reach agent-worker's POST /signin as `{member, step, code?}`, `member` the door's stamp and never the caller's, `step` and `code` the body's; the runner's answer is relayed as given, status and body; the code is in that one request's body and in no store request, log line or answer", async () => {
  const CODE = "sentinel-anthropic-code-R1";
  for (const step of ["start", "code", "signout"]) {
    const w = world();
    const r = await w.go({ step, code: CODE, member: "member:forged", by: "member:forged" });
    assert.equal(r.status, 200, step);
    assert.equal(w.aw.sent.length, 1, step);
    assert.equal(w.aw.sent[0].path, "/signin");
    const { member, step: s, code } = w.aw.sent[0].body;
    assert.deepEqual([member, s, code], [ANN, step, step === "code" ? CODE : undefined], step);
    if (step === "start") assert.deepEqual([r.body.address, r.body.attempt], ["https://claude.ai/oauth/x", "att-1"], "relayed");
    else assert.equal(r.body.member, ANN);
    assert.equal(JSON.stringify(r.body).includes(CODE), false, `${step}: no code in the answer`);
    assert.equal(JSON.stringify(w.lines).includes(CODE), false, `${step}: no code in a log line`);
    assert.equal(JSON.stringify(w.store.calls).includes(CODE), false, `${step}: no code in a store request`);
    assert.equal(w.aw.sent[0].url.includes(CODE) || JSON.stringify(w.aw.sent[0].headers).includes(CODE), false);
  }
  /* the runner's refusal, at its status and in its words */
  const w = world({ reply: () => json(409, { ok: false, reason: "NOT_THIS_MEMBER", detail: "another member's sign-in" }) });
  const r = await w.go({ step: "code", code: CODE });
  assert.deepEqual([r.status, r.body.reason, r.body.detail], [409, "NOT_THIS_MEMBER", "another member's sign-in"]);
  assert.deepEqual(w.store.of("subscriptionconnected"), []);
});

test("R1 (ai-accounts R18): a `code` answer carrying `connected: true` for that member and no token is recorded through `subscriptionconnected` with `by` the member, and only then; `connected: false`, another member's, and a `start` record nothing", async () => {
  const w = world({ reply: (b) => json(200, { ok: true, connected: true, member: b.member }) });
  await w.go({ step: "code", code: "c" });
  assert.deepEqual(w.store.of("subscriptionconnected").map((c) => c.params), [{ by: ANN }]);
  for (const answer of [{ ok: true, connected: false, member: ANN }, { ok: true, connected: true, member: "member:bea" }]) {
    const x = world({ reply: () => json(200, answer) });
    await x.go({ step: "code", code: "c" });
    assert.deepEqual(x.store.of("subscriptionconnected"), [], JSON.stringify(answer));
  }
  const s = world({ reply: () => json(200, { ok: true, connected: true }) });
  await s.go({ step: "start" });
  assert.deepEqual(s.store.of("subscriptionconnected"), []);
});

test("R1 (ai-accounts R7; K2200 (9)): while the group keeps its material away, `start` and `code` are refused 403 with ai-accounts' AI_KEPT_AWAY as it answers it, nothing sent; `signout` is always sent; a store that refuses or does not answer the question sends nothing (control: keep-away off, `start` is sent)", async () => {
  for (const step of ["start", "code"]) {
    const w = world({ routes: { aikeptaway: keptAway } });
    const r = await w.go({ step, code: "c" });
    assert.deepEqual([r.status, r.body.ok, r.body.reason, r.body.keep_away.reason], [403, false, "AI_KEPT_AWAY", "a case"], step);
    assert.deepEqual(w.aw.sent, [], `${step}: nothing sent`);
    assert.deepEqual(w.store.of("signindisclosuredue"), [], `${step}: the keep-away refusal comes first`);
  }
  const out = world({ routes: { aikeptaway: keptAway } });
  assert.equal((await out.go({ step: "signout" })).status, 200);
  assert.equal(out.aw.sent.length, 1, "signout always sent");
  for (const r of ["silent", "refused"]) {
    const w = world({ routes: { aikeptaway: r } });
    const a = await w.go({ step: "start" });
    assert.equal(a.body.ok, false, r);
    assert.equal(a.status, r === "silent" ? 502 : 400, r);
    if (r === "silent") assert.equal(a.body.reason, "STORE_DID_NOT_ANSWER");
    assert.deepEqual(w.aw.sent, [], `${r}: nothing sent`);
  }
  const open = world();
  assert.equal((await open.go({ step: "start" })).status, 200);
  assert.equal(open.aw.sent.length, 1);
});

test("R1: with no `AGENT_WORKER` binding the door answers 503 AGENT_WORKER_UNBOUND; a binding that throws or answers no JSON, 502 AGENT_WORKER_SILENT; agent-worker's RUNNER_NOT_CONFIGURED is relayed with its code and status unchanged and the translation read by key `ai.refused.signinabsent` (control: a translation the runner sent is kept)", async () => {
  const w = world();
  delete w.env.AGENT_WORKER;
  const r = await w.go({ step: "signout" });
  assert.deepEqual([r.status, r.body.reason], [503, "AGENT_WORKER_UNBOUND"]);
  for (const reply of [() => { throw new Error("down"); }, () => new Response("<html>"), () => json(200, [1])]) {
    const s = await world({ reply }).go({ step: "signout" });
    assert.deepEqual([s.status, s.body.reason], [502, "AGENT_WORKER_SILENT"]);
  }
  const absent = await world({ reply: () => json(503, { ok: false, reason: "RUNNER_NOT_CONFIGURED", code: "RUNNER_NOT_CONFIGURED", detail: "x" }) })
    .go({ step: "start" });
  assert.deepEqual([absent.status, absent.body.code, absent.body.reason, absent.body.detail, absent.body.translation],
                   [503, "RUNNER_NOT_CONFIGURED", "RUNNER_NOT_CONFIGURED", "x", SIGNIN_WORDS["ai.refused.signinabsent"]]);
  assert.ok(hasWord("ai.refused.signinabsent"), "the translation is held by key");
  assert.equal(SIGNIN_WORDS["ai.refused.signinabsent"], word("ai.refused.signinabsent"));
  const kept = await world({ reply: () => json(503, { ok: false, reason: "RUNNER_NOT_CONFIGURED", translation: "theirs" }) }).go({ step: "start" });
  assert.equal(kept.body.translation, "theirs");
});

test("R1 (ai-accounts R18, R27): `leaverOf` names the member a successful `subscriptiondisconnect` (the caller), `memberset` to revoked and a carried `adminremove` leave; `signoutLeaver` sends `step: \"signout\"` for that member and a runner that cannot be reached throws nothing; acts that did not succeed or did not revoke name nobody", async () => {
  assert.equal(leaverOf("subscriptiondisconnect", {}, { ok: true, disconnected: true }, ANN), ANN);
  assert.equal(leaverOf("memberset", { memberId: "bea", status: "revoked" }, { ok: true, memberId: "bea" }, "admin"), "member:bea");
  assert.equal(leaverOf("adminremove", { memberId: "bea" }, { ok: true, memberId: "bea", removed: true }, "admin"), "member:bea");
  for (const [op, asked, result] of [["subscriptiondisconnect", {}, { ok: false, reason: "NOT_YOUR_ACCOUNT" }],
                                     ["memberset", { memberId: "bea", status: "active" }, { ok: true, memberId: "bea" }],
                                     ["adminremove", { memberId: "bea" }, { ok: false, reason: "VOTES_SHORT" }],
                                     ["adminremove", { memberId: "bea" }, { ok: true, removed: false }],
                                     ["groupnameset", {}, { ok: true }]])
    assert.equal(leaverOf(op, asked, result, ANN), null, op);
  const aw = agentWorker(() => json(200, { ok: true }));
  await signoutLeaver({ AGENT_WORKER: aw }, "member:bea");
  assert.deepEqual([aw.sent[0].path, aw.sent[0].body], ["/signin", { member: "member:bea", step: "signout" }]);
  await signoutLeaver({ AGENT_WORKER: { fetch: async () => { throw new Error("down"); } } }, "member:bea");
  await signoutLeaver({}, "member:bea");
  const none = agentWorker();
  await signoutLeaver({ AGENT_WORKER: none }, null);
  assert.deepEqual(none.sent, []);
});

/* ================================================================ R2 */

test("R2 (ai-accounts R23; K231): `start` is refused DISCLOSURE_DUE as `ai-accounts.disclosureDue` answers it, relayed as given with C-29.40's check and translation, after the keep-away question and before anything is sent; the door adds no row or sentence of its own; with the disclosure recorded the `start` is sent; `code` and `signout` never ask it", async () => {
  const w = world({ routes: { signindisclosuredue: disclosureDue } });
  const r = await w.go({ step: "start" });
  assert.equal(r.status, 409);
  for (const k of Object.keys(disclosureDue)) assert.deepEqual(r.body[k], disclosureDue[k], `relayed ${k}`);
  assert.deepEqual(w.aw.sent, [], "nothing sent");
  assert.deepEqual(w.store.calls.map((c) => c.route).slice(0, 2), ["aikeptaway", "signindisclosuredue"], "after keep-away");
  assert.deepEqual(w.store.of("signindisclosuredue")[0].params, { by: ANN }, "asked for the stamped member");
  for (const bad of ["silent", "refused"]) {
    const x = world({ routes: { signindisclosuredue: bad } });
    assert.equal((await x.go({ step: "start" })).body.ok, false, bad);
    assert.deepEqual(x.aw.sent, [], `${bad}: fail closed`);
  }
  const shown = world();
  assert.equal((await shown.go({ step: "start" })).status, 200);
  assert.equal(shown.aw.sent.length, 1, "control: recorded, sent");
  for (const step of ["code", "signout"]) {
    const x = world({ routes: { signindisclosuredue: disclosureDue } });
    assert.equal((await x.go({ step, code: "c" })).status, 200, step);
    assert.deepEqual(x.store.of("signindisclosuredue"), [], `${step}: never asked`);
  }
});

/* ================================================================ R3 */

test("R3 (N1001; agent-worker R83): each request gets a fresh `trace`, sent with `member_ref` in `x-civicsmith-trace` and `x-civicsmith-member-ref`; `member_ref` is the first 12 hex of sha256(instance name + by), the bare id only on a test instance; one `signin.door` log line per request carries the same trace; `trace` is in every answer, success or refusal", async () => {
  const w = world();
  const a = await w.go({ step: "start" });
  const b = await w.go({ step: "signout" });
  assert.match(a.body.trace, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.body.trace, b.body.trace, "fresh per request");
  const expected = await memberRefOf(PROD_ENV, ANN);
  assert.match(expected, /^[0-9a-f]{12}$/);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`oakland${ANN}`));
  assert.equal(expected, [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12));
  assert.deepEqual([w.aw.sent[0].headers[TRACE_HEADER], w.aw.sent[0].headers[MEMBER_REF_HEADER]], [a.body.trace, expected]);
  assert.deepEqual(w.lines.map((l) => [l.event, l.trace, l.member_ref]), [["signin.door", a.body.trace, expected],
                                                                          ["signin.door", b.body.trace, expected]]);
  assert.equal(JSON.stringify(w.lines).includes(ANN), false, "the bare id in no line off a test instance");
  assert.equal(await memberRefOf(TEST_ENV, ANN), ANN, "the bare id on a test instance");
  /* every path answers a trace and writes one line */
  const paths = [
    [{ routes: { aikeptaway: keptAway } }, { step: "start" }],
    [{ routes: { aikeptaway: "silent" } }, { step: "start" }],
    [{ routes: { signindisclosuredue: disclosureDue } }, { step: "start" }],
    [{ routes: { accountsof: "silent" } }, { step: "state" }],
    [{ routes: {} }, { step: "state" }],
    [{ reply: () => json(409, { ok: false, reason: "BAD_STEP" }) }, { step: "nonsense" }],
    [{ reply: () => { throw new Error("x"); } }, { step: "signout" }],
  ];
  for (const [opts, asked] of paths) {
    const x = world(opts);
    const r = await x.go(asked);
    assert.match(String(r.body.trace), /^[0-9a-f-]{36}$/, JSON.stringify(asked));
    assert.equal(x.lines.length, 1, JSON.stringify(asked));
    assert.equal(x.lines[0].trace, r.body.trace);
  }
  const unbound = world();
  delete unbound.env.AGENT_WORKER;
  assert.ok((await unbound.go({ step: "signout" })).body.trace);
});

/* ================================================================ R4 */

test("R4 (K3060 D10; ai-accounts R19; agent-worker R81): on `code` the door sends `hold: true`; an answer carrying `token` is handed to `subscriptionTokenHold` (the store's `signintokenhold`, `by` the member, `{token, validFor}` in the body) and its result read; `token` and `valid_for` are removed and the answer says `held: true`; a sentinel token is in no answer, log line or request but the hold", async () => {
  const TOKEN = "sentinel-token-R4-abcdefghijklmnopqrstuvwxyz";
  const w = world({ env: TEST_ENV, routes: { signintokenhold: { ok: true, since: "2026-10-14T00:00:00Z" } },
                    reply: (b) => json(200, { ok: true, connected: true, member: b.member, token: TOKEN, valid_for: "1 year" }) });
  const r = await w.go({ step: "code", code: "c", attempt: "att-1" });
  assert.deepEqual(w.aw.sent[0].body, { member: ANN, step: "code", code: "c", hold: true, attempt: "att-1" });
  const holds = w.store.of("signintokenhold");
  assert.equal(holds.length, 1);
  assert.deepEqual([holds[0].params, holds[0].body], [{ by: ANN }, { token: TOKEN, validFor: "1 year" }]);
  assert.deepEqual([r.status, r.body.ok, r.body.held, r.body.since], [200, true, true, "2026-10-14T00:00:00Z"]);
  assert.equal("token" in r.body || "valid_for" in r.body || "fact" in r.body, false);
  assert.deepEqual(w.store.of("subscriptionconnected"), [], "the hold records the fact");
  assert.equal(JSON.stringify(r.body).includes(TOKEN), false, "no answer");
  assert.equal(JSON.stringify(w.lines).includes(TOKEN), false, "no log line");
  for (const c of w.store.calls.filter((c) => c.route !== "signintokenhold"))
    assert.equal(JSON.stringify(c).includes(TOKEN), false, `${c.route}: no other store request (the kept trace included)`);
  assert.equal(JSON.stringify(w.aw.sent).includes(TOKEN), false, "no request to agent-worker");
  assert.equal(w.lines[0].held, true);
  /* the hold refused, or not answered: held false with the fact's code, and still no token */
  const malformed = await issuedTokenMalformed();
  for (const [hold, code] of [[malformed.tooShort, "ISSUED_TOKEN_MALFORMED"], ["silent", "STORE_DID_NOT_ANSWER"]]) {
    const x = world({ routes: { signintokenhold: hold }, reply: (b) => json(200, { ok: true, member: b.member, token: TOKEN, valid_for: "1 year" }) });
    const a = await x.go({ step: "code", code: "c" });
    assert.deepEqual([a.body.held, a.body.fact], [false, { code }], code);
    assert.equal(JSON.stringify([a.body, x.lines]).includes(TOKEN), false);
  }
  /* another member's token is never held */
  const other = world({ reply: () => json(200, { ok: true, member: "member:bea", token: TOKEN }) });
  const o = await other.go({ step: "code", code: "c" });
  assert.deepEqual([o.body.held, o.body.fact, other.store.of("signintokenhold")], [false, { code: "NOT_THIS_MEMBER" }, []]);
  assert.equal(JSON.stringify(o.body).includes(TOKEN), false);
  /* no token on any other step's answer either */
  const leak = world({ reply: () => json(200, { ok: true, token: TOKEN, valid_for: "1 year" }) });
  const l = await leak.go({ step: "start" });
  assert.equal(JSON.stringify(l.body).includes(TOKEN), false);
  /* control: only `code` sends hold; an attempt that is not a short string is not passed */
  const ctl = world();
  await ctl.go({ step: "start" });
  await ctl.go({ step: "code", code: "c", attempt: "x".repeat(201) });
  assert.equal("hold" in ctl.aw.sent[0].body, false);
  assert.equal("attempt" in ctl.aw.sent[1].body, false);
});

test("F1, R4 (ai-accounts R2, R19): `state` is answered from ai-accounts' T53 read `accountsof` (owner `member:<id>`, viewer the stamp), never the retired `accountreference`: a connected subscription reads connected, held, since and its account; nothing sent to the runner; a read that fails is answered as a failure, never as not connected", async () => {
  const w = world();
  const r = await w.go({ step: "state" });
  assert.deepEqual(w.aw.sent, []);
  assert.deepEqual(w.store.of("accountreference"), [], "the retired route is never asked");
  assert.deepEqual(w.store.of("accountsof")[0].params, { owner: ANN, viewer: ANN });
  assert.equal(r.status, 200);
  const sub = ACCOUNT.with.accounts.find((a) => a.means === "issued");
  assert.deepEqual([r.body.ok, r.body.step, r.body.connected, r.body.held, r.body.account_id, r.body.since],
                   [true, "state", true, true, ACCOUNT.held.account_id, sub.set_at]);
  /* control: a member who holds no subscription reads not connected */
  const none = await world({ routes: { accountsof: ACCOUNT.without } }).go({ step: "state" });
  assert.deepEqual([none.status, none.body.connected, none.body.held, none.body.since, none.body.account_id], [200, false, false, null, null]);
  const silent = await world({ routes: { accountsof: "silent" } }).go({ step: "state" });
  assert.deepEqual([silent.status, silent.body.ok, silent.body.reason, "connected" in silent.body], [502, false, "STORE_DID_NOT_ANSWER", false]);
  const refused = await world({ routes: { accountsof: { ok: false, reason: "NOT_YOUR_ACCOUNT" } } }).go({ step: "state" });
  assert.deepEqual([refused.status, refused.body.reason, "connected" in refused.body], [403, "NOT_YOUR_ACCOUNT", false]);
});

test("F1 (ai-accounts R2): a connected subscription sign-in reads its state through ai-accounts' own T53 route map: the door's `state` request, answered by `aiAccountsOps` over the real module, reads connected after the token is held and not connected before; control: the retired `accountreference` is no route there", async () => {
  const w = await accountsWorld().group("ann");
  const routed = [];
  const store = async (path, init = {}) => {
    const url = new URL(`http://do/${path}`);
    const route = url.pathname.slice(1);
    routed.push(route);
    const arm = w.ops(url.searchParams.toString(), init.body ? JSON.parse(init.body) : null)[route];
    if (typeof arm !== "function") return { answered: false };
    return { answered: true, result: await arm() };
  };
  const go = () => subscriptionSignin({ env: { AGENT_WORKER: agentWorker() }, member: ANN, asked: { step: "state" }, store, log: () => {} });
  const before = await go();
  assert.deepEqual([before.status, before.body.connected, before.body.held], [200, false, false]);
  const held = await w.a.subscriptionTokenHold({ member: ANN, token: "sk-ant-oat01-" + "t".repeat(40) });
  assert.equal(held.ok, true);
  const after = await go();
  assert.deepEqual([after.status, after.body.ok, after.body.connected, after.body.held, after.body.account_id],
                   [200, true, true, true, held.account_id]);
  assert.deepEqual([...new Set(routed)], ["accountsof"]);
  assert.equal(typeof w.ops("", null).accountreference, "undefined", "control: ai-accounts serves no accountreference");
});

test("R4 (ai-accounts R18, R19): `subscriptionDisconnect` reaches the store's `subscriptiondisconnect` (ai-accounts drops the token there) with `by` the stamp, then sends `signout` for that member; a runner that cannot be reached changes nothing of the answer; a refused disconnect sends nothing", async () => {
  for (const throws of [false, true]) {
    /* ai-accounts' T53 rewrite retired `subscriptionDisconnect` and publishes no answer for it; the door relays the store's
       answer as given, so the success here is the shape `leaverOf` reads */
    const store = storeOf({ subscriptiondisconnect: { ok: true, disconnected: true } });
    const aw = agentWorker(() => { if (throws) throw new Error("down"); return json(200, { ok: true }); });
    const out = await subscriptionDisconnect({ env: { AGENT_WORKER: aw }, member: ANN, store });
    assert.deepEqual([out.answered, out.result], [true, { ok: true, disconnected: true }]);
    assert.deepEqual(store.of("subscriptiondisconnect")[0].params, { by: ANN });
    assert.deepEqual(aw.sent.map((s) => s.body), [{ member: ANN, step: "signout" }]);
  }
  const store = storeOf({ subscriptiondisconnect: { ok: false, reason: "NOT_YOUR_ACCOUNT" } });
  const aw = agentWorker();
  const out = await subscriptionDisconnect({ env: { AGENT_WORKER: aw }, member: ANN, store });
  assert.equal(out.result.reason, "NOT_YOUR_ACCOUNT");
  assert.deepEqual(aw.sent, [], "control: refused, nothing sent");
});

test("R4 (ai-accounts R19): an ask or draft answered SIGNIN_TOKEN_REFUSED, at the top level or in `result`, calls `subscriptionTokenRefused` for that member (the store's `signintokenrefused`); any other answer calls nothing", async () => {
  for (const answer of [{ ok: false, reason: "SIGNIN_TOKEN_REFUSED" }, { ok: false, code: "SIGNIN_TOKEN_REFUSED" },
                        { ok: true, result: { ok: false, reason: "SIGNIN_TOKEN_REFUSED" } }]) {
    const store = storeOf({ signintokenrefused: { ok: true, dropped: true } });
    assert.equal(await tokenRefusedSeen({ member: ANN, answer, store }), true);
    assert.deepEqual(store.of("signintokenrefused").map((c) => c.params), [{ by: ANN }]);
  }
  for (const answer of [{ ok: false, reason: "NO_ACCOUNT" }, { ok: true, result: { ok: true } }, null, "SIGNIN_TOKEN_REFUSED"]) {
    const store = storeOf();
    assert.equal(await tokenRefusedSeen({ member: ANN, answer, store }), false);
    assert.deepEqual(store.calls, [], JSON.stringify(answer));
  }
  const store = storeOf();
  assert.equal(await tokenRefusedSeen({ member: null, answer: { ok: false, reason: "SIGNIN_TOKEN_REFUSED" }, store }), false);
});

/* ================================================================ R5 */

test("R5 (connect §3): `signintrace` off a test instance answers SIGNINTRACE_NOT_TEST and asks nothing; on one, the store's `signintraceread`; the door keeps its line through `signintracekeep` on a test instance only", async () => {
  for (const env of [PROD_ENV, {}, { CIVICSMITH_TEST_INSTANCE: "a", INSTANCE_NAME: "b" }, { CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "" }]) {
    assert.equal(testInstanceOf(env), false, JSON.stringify(env));
    const store = storeOf();
    const r = await signintrace({ env, store });
    assert.deepEqual([r.status, r.body.ok, r.body.reason], [403, false, "SIGNINTRACE_NOT_TEST"]);
    assert.deepEqual(store.calls, []);
  }
  const lines = [{ event: "signin.door", trace: "t" }];
  const store = storeOf({ signintraceread: { ok: true, max: 200, lines } });
  const r = await signintrace({ env: TEST_ENV, store });
  assert.deepEqual([r.status, r.body.lines], [200, lines]);
  const silent = await signintrace({ env: TEST_ENV, store: storeOf({ signintraceread: "silent" }) });
  assert.deepEqual([silent.status, silent.body.reason], [502, "STORE_DID_NOT_ANSWER"]);
  const t = world({ env: TEST_ENV });
  await t.go({ step: "signout" });
  const kept = t.store.of("signintracekeep");
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].body.line, t.lines[0]);
  const p = world();
  await p.go({ step: "signout" });
  assert.deepEqual(p.store.of("signintracekeep"), [], "control: nothing kept off a test instance");
});
