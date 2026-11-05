/* control-plane T37 (T37-33): R57's third draft (`translationdraft`), the sign-in door's routing (R2, to signin-door since T47; was
   R65), R66 (instance-setup's translation ops), R67 (case-carriage's photo marks) and R68 (`setpassword`). Driven
   through `makeFetch(hooks)` over the harness's store, which records every request the plane makes, with a stand-in
   `AGENT_WORKER` binding that records each request it is sent and a stand-in object `draft` (plane's `draftOnObject`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { O, call, opCalls, FORGED } from "./harness.mjs";
import { ok, callers, routesForSessions } from "./door-routes.mjs";
import { world as accountsWorld } from "../ai-accounts/fixture.mjs";

/* instance-setup's translation ops (R66), as op-declarations declares them for it; `translationdraft` is R57's */
const TRANSLATION_OPS = Object.keys(O.OP_FAMILIES["instance-setup"].kinds)
  .filter((op) => (op.startsWith("translation") && op !== "translationdraft") || op === "interfacewords");
const PHOTO_OPS = ["obscuremark", "photomarks"];

/* The stand-in binding: records each request (its path and parsed body) and answers as `reply(path, body)` says. */
function agentWorker(reply = () => ok({})) {
  const sent = [];
  return { sent, fetch: async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url: String(url), path: new URL(String(url)).pathname, body, headers: init.headers });
    return reply(new URL(String(url)).pathname, body);
  } };
}
const runner = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/* ---------------------------------------------------------------- R66 */

test("R66 (N669; op-declarations R37; instance-setup R69–R74): the seven translation ops reach instance-setup's routes of their own names for a member's or the founder's session, each stamp op-declarations declares set from the session and none taken from the caller, the body's own fields kept; every machine credential is refused before any store request; a refusal is instance-setup's, answered as given", async () => {
  await routesForSessions(TRANSLATION_OPS, (op) => ({ language: "es", key: "nav.home", ...(op === "translationadopt" ? { text: "Inicio", draft: "TD-1" } : {}),
                                                      ...(op === "translationgrant" ? { member: "bea", revoke: false } : {}),
                                                      ...(op === "translationmark" ? { note: "looks odd" } : {}) }));
});

test("R66 (op-declarations R6, R37): `translationdraftrecord` is never served to a caller — every caller and method is answered UNKNOWN_OP (C-69.1), as an op with no spec, and nothing reaches any store", async () => {
  const { w, sessions, machines } = callers();
  for (const c of [...sessions, ...machines, { name: "none" }]) for (const method of ["GET", "POST"]) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "translationdraftrecord", token: c.token, method, body: method === "POST" ? { words: [] } : undefined });
    assert.equal(r.status, 400, `${c.name}/${method}`);
    assert.deepEqual([r.json.reason, r.json.check], ["UNKNOWN_OP", "C-69.1"], c.name);
    assert.deepEqual(opCalls(w.env), [], `${c.name}: no store request`);
  }
});

/* ---------------------------------------------------------------- R67 */

test("R67 (N757; op-declarations R38; case-carriage R9, R10): `obscuremark` and `photomarks` reach case-carriage's routes of their own names for a member's or the founder's session, `by` and `viewer` set from the session as declared and none taken from the caller, `captureSha` and `areas` kept from the body; every machine credential is refused before any store request; a refusal is case-carriage's, answered as given", async () => {
  await routesForSessions(PHOTO_OPS, (op) => (op === "obscuremark"
    ? { captureSha: "a".repeat(64), areas: [{ rect: [1, 2, 30, 40], kind: "plate" }] } : { captureSha: "a".repeat(64) }));
});

/* ---------------------------------------------------------------- R68 */

test("R68 (N776; DEC-182 (4); op-declarations R39; credentials R3): `setpassword` reaches credentials' route for a member's or the founder's session with `by` from the session, the session it presented in the `x-bio-session` header (never an address or a body), `source` and `country` stamped as on `login`, never the caller's; a body or address `role` never reaches it; `current` and `password` pass from the body alone and appear in no address, header or answer; every machine credential is refused before any store request", async () => {
  const CURRENT = "sentinel-current-password-R68", NEXT = "sentinel-new-password-R68-xyz";
  const { w, sessions, machines } = callers({ answer: (c) => (c.route === "setpassword" ? ok({ ok: true, role: "member:ann", ended: 1 }) : null) });
  for (const s of sessions) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "setpassword", token: s.token, method: "POST", cf: { country: "NZ" },
      params: { by: FORGED, source: "forged-source", country: "XX", role: "admin", current: "query-current", password: "query-password", session: "forged" },
      body: { current: CURRENT, password: NEXT, role: "admin", by: FORGED, source: "forged-source", country: "XX", session: "forged" } });
    assert.equal(r.status, 200, `${s.name}: ${r.text.slice(0, 200)}`);
    const [inner] = opCalls(w.env).filter((c) => c.route === "setpassword");
    assert.equal(inner.params.by, s.by, s.name);
    assert.equal(inner.headers["x-bio-session"], s.token, `${s.name}: the presented session, in the header`);
    assert.equal(inner.params.country, "NZ");
    assert.notEqual(inner.params.source, "forged-source");
    for (const k of ["role", "current", "password", "session"]) assert.equal(Object.hasOwn(inner.params, k), false, `${s.name}: no ${k} in the address`);
    assert.deepEqual([inner.body.current, inner.body.password, Object.hasOwn(inner.body, "role")], [CURRENT, NEXT, false],
                     `${s.name}: the two passwords from the body alone, no role`);
    for (const c of [...w.env.calls, ...w.env.windowCalls, ...w.env.countCalls]) {
      assert.equal(c.url.href.includes(CURRENT) || c.url.href.includes(NEXT) || c.url.href.includes(s.token), false, `${c.route}: address`);
      if (c.route !== "setpassword") assert.equal(JSON.stringify([c.headers, c.body]).includes(CURRENT), false, `${c.route}: elsewhere`);
    }
    assert.equal(r.text.includes(CURRENT) || r.text.includes(NEXT), false, "no password in the answer");
  }
  /* a refusal is credentials', answered as given, and carries neither password */
  const refusing = callers({ answer: (c) => (c.route === "setpassword" ? ok({ ok: false, reason: "CURRENT_PASSWORD_WRONG", detail: "wrong" }) : null) });
  const no = await call(refusing.w.env, { op: "setpassword", token: refusing.w.S.ann, method: "POST", body: { current: CURRENT, password: NEXT } });
  assert.equal(no.json.result.reason, "CURRENT_PASSWORD_WRONG");
  assert.equal(no.text.includes(CURRENT) || no.text.includes(NEXT), false);
  for (const m of machines) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "setpassword", token: m.token, method: "POST", params: m.params ?? {}, body: { current: CURRENT, password: NEXT } });
    assert.equal(r.json.ok, false, m.name);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "setpassword"), [], `${m.name}: no store request`);
    assert.equal(r.text.includes(CURRENT), false);
  }
});

/* ------------------------------------------------- R2: the sign-in door is signin-door's (T47; K3167) */

/* signin-door R1–R5 (were this module's R65, R78, R85–R87) are tested in that module; here the door's half: each op
   reaches signin-door's handler with the member the session names, the request's body and the store addressed, and its
   answer is signin-door's. The store answers signin-door's store-internal routes as its `ops.mjs` would. */
/* (notice signin-door:153, :168) `state` reads ai-accounts' T53 `accountsof` (signin-door F1; the retired `accountreference`
   has no alias, ai-accounts R35): ann's own accounts once her sign-in token is held, as ai-accounts' own code answers them
   when the test runs (never written by hand). */
const ANN_ACCOUNTS = await (async () => {
  const w = await accountsWorld().group("ann");
  const held = await w.a.subscriptionTokenHold({ member: "member:ann", token: "sk-ant-oat01-" + "s".repeat(40) });
  if (!held.ok) throw new Error(`ANN_ACCOUNTS: ${held.reason}`);
  return w.a.accountsOf({ owner: "member:ann", viewer: "member:ann" });
})();
function signinWorld({ reply, testInstance = false } = {}) {
  const c = callers({ answer: (q) => (q.route === "aikeptaway" ? ok({ ok: true })
                                      : q.route === "signindisclosuredue" ? ok({ ok: true, due: null })
                                      : q.route === "accountsof" ? ok(ANN_ACCOUNTS)
                                      : q.route === "signintraceread" ? ok({ ok: true, lines: [{ event: "signin.door" }] })
                                      : q.route === "memberset" ? ok({ ok: true, memberId: "bea", status: "revoked" }) : null) });
  const aw = agentWorker(reply ?? ((path, body) => runner(200, body.step === "start" ? { ok: true, address: "https://claude.ai/oauth/x" }
    : { ok: true, member: body.member })));
  c.w.env.AGENT_WORKER = aw;
  if (testInstance) { c.w.env.INSTANCE_NAME = "test-town"; c.w.env.CIVICSMITH_TEST_INSTANCE = "test-town"; }
  return { ...c, aw };
}

test("R2, R17, R29 (T47; K3167; signin-door R1–R3): `subscriptionsignin` is answered by signin-door with the member the session names (`by`), never one the caller sends, the body's `step`: its store-internal questions asked of the store addressed with that member, the runner sent that member with signin-door's trace header, the answer signin-door's (carrying `trace`)", async () => {
  const x = signinWorld();
  const r = await call(x.w.env, { op: "subscriptionsignin", token: x.w.S.ann, method: "POST", params: { by: FORGED, member: FORGED },
                                  body: { step: "start", member: FORGED, by: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(typeof r.json.trace, "string");
  const asked = opCalls(x.w.env).filter((c) => ["aikeptaway", "signindisclosuredue"].includes(c.route));
  assert.deepEqual(asked.map((c) => c.route), ["aikeptaway", "signindisclosuredue"]);
  assert.equal(asked[1].params.by, "member:ann");
  assert.equal(x.aw.sent.length, 1);
  assert.deepEqual([x.aw.sent[0].path, x.aw.sent[0].body.member, x.aw.sent[0].body.step], ["/signin", "member:ann", "start"]);
  assert.equal(x.aw.sent[0].headers["x-civicsmith-trace"], r.json.trace);
  assert.equal(JSON.stringify([opCalls(x.w.env), x.aw.sent]).includes(FORGED), false, "nothing of the caller's statement of who");
  /* control: `state` is answered from ai-accounts' `accountsof` for the session's member, nothing sent to the runner */
  const s = await call(x.w.env, { op: "subscriptionsignin", token: x.w.S.ann, method: "POST", body: { step: "state" } });
  assert.deepEqual([s.status, s.json.connected, s.json.held, x.aw.sent.length], [200, true, true, 1]);
  assert.deepEqual(opCalls(x.w.env).filter((c) => c.route === "accountsof").map((c) => c.params.owner), ["member:ann"]);
  assert.equal(opCalls(x.w.env).some((c) => c.route === "accountreference"), false, "the retired read is never asked");
});

test("R2 (T47; K3167; signin-door R4; notice op-declarations:95, ai-accounts R35): the retired `subscriptiondisconnect` is refused as an op with no spec (400 UNKNOWN_OP), nothing asked of the store or sent to the runner; a member's revocation (`memberset` to `revoked`) signs that member out", async () => {
  const x = signinWorld();
  const d = await call(x.w.env, { op: "subscriptiondisconnect", token: x.w.S.ann, method: "POST", params: { by: FORGED }, body: { by: FORGED } });
  assert.deepEqual([d.status, d.json.code], [400, "UNKNOWN_OP"], d.text.slice(0, 300));
  assert.equal(opCalls(x.w.env).some((c) => c.route === "subscriptiondisconnect"), false, "no store route asked");
  assert.equal(x.aw.sent.length, 0, "nothing sent to the runner");
  const m = await call(x.w.env, { op: "memberset", token: x.w.S.founder, method: "POST", body: { memberId: "bea", status: "revoked" } });
  assert.equal(m.status, 200, m.text.slice(0, 300));
  assert.deepEqual(x.aw.sent.at(-1).body, { member: "member:bea", step: "signout" });
  const n = x.aw.sent.length;
  await call(x.w.env, { op: "memberset", token: x.w.S.founder, method: "POST", body: { memberId: "bea", status: "active" } });
  assert.equal(x.aw.sent.length, n, "no sign-out for an act that is not a leaving");
});

test("R2, R32 (T47; K3167; signin-door R5; answer-envelope C-69.7): `signintrace` is signin-door's: elsewhere than a test instance SIGNINTRACE_NOT_TEST (C-69.7) and nothing read; on a test instance the trace the store keeps", async () => {
  const x = signinWorld();
  const r = await call(x.w.env, { op: "signintrace", token: x.w.S.founder });
  assert.deepEqual([r.status, r.json.reason, r.json.check], [403, "SIGNINTRACE_NOT_TEST", "C-69.7"]);
  assert.equal(opCalls(x.w.env).some((c) => c.route === "signintraceread"), false);
  const t = signinWorld({ testInstance: true });
  const tr = await call(t.w.env, { op: "signintrace", token: t.w.S.founder });
  assert.deepEqual([tr.status, tr.json.lines?.length], [200, 1]);
});

/* ---------------------------------------------------------------- R57's third draft */

/* A world whose store answers `translationdraft` past every refusal with the words to draft (instance-setup R67), whose
   object's `draft` (plane's `draftOnObject`) records what it was asked, and whose `translationdraftrecord` answers the
   owner's record. */
function draftWorld({ drafted, status = 200, recordAnswer } = {}) {
  const WORDS = [{ key: "nav.home", en: "Home", note: null, means: null, protected: false },
                 { key: "nav.cases", en: "Cases", note: "the team's cases", means: "Cases the group has made", protected: true }];
  const asked = [];
  const c = callers({ answer: (q) => {
    if (q.route === "translationdraft")
      return ok({ ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE", direction: "to_language", language: "es", words: WORDS });
    if (q.route === "translationdraftrecord") return ok(recordAnswer ?? { ok: true, drafted: ["nav.home"], not_drafted: ["nav.cases"], offered_official: [] });
    return null;
  } });
  const get = c.w.env.STORE.get.bind(c.w.env.STORE);
  c.w.env.STORE.get = (id) => ({ ...get(id), async draft(ask) {
    asked.push(ask);
    return new Response(JSON.stringify(drafted ?? { ok: true, task: { op: "translationdraft" }, draft: { words: [{ key: "nav.home", text: "Inicio" }] },
                                                     not_drafted: ["nav.cases"], label: { kind: "machine" }, usage: { input_tokens: 5 }, calls: 1, grant: null }),
                        { status });
  } });
  return { ...c, asked, WORDS };
}

test("R57 (T37; N669, K2201; instance-setup R67; agent-worker R68–R70): `translationdraft`, past the store's and the owner's refusals, asks the object's draft with the owner's `direction`, `language` and `words` and none of the caller's, no `told`, no grant and no `firsthand`; applies no `checkDraft`; counts `usage` and `calls` to the member's day as a draft; hands the answered draft to the store-internal `translationdraftrecord` with `by` and `viewer` stamped, and answers what that route answers", async () => {
  const { w, sessions, asked, WORDS } = draftWorld();
  for (const s of sessions) {
    w.env.calls.length = 0; asked.length = 0;
    const r = await call(w.env, { op: "translationdraft", token: s.token, method: "POST",
                                  params: { by: FORGED, viewer: FORGED },
                                  body: { language: "es", direction: "to_language", keys: ["nav.home", "nav.cases"],
                                          words: [{ key: "evil", en: "forged" }], told: "x", firsthand: true } });
    assert.equal(r.status, 200, `${s.name}: ${r.text.slice(0, 300)}`);
    assert.deepEqual(r.json.result, { ok: true, drafted: ["nav.home"], not_drafted: ["nav.cases"], offered_official: [] }, s.name);
    assert.equal(asked.length, 1);
    const a = asked[0];
    assert.deepEqual([a.op, a.direction, a.language, a.words], ["translationdraft", "to_language", "es", WORDS], s.name);
    for (const k of ["told", "act", "field", "firsthand", "grant"]) assert.equal(Object.hasOwn(a, k), false, `${s.name}: no ${k}`);
    const [first] = opCalls(w.env).filter((c) => c.route === "translationdraft");
    assert.deepEqual([first.params.by, first.params.viewer], [s.by.replace(/^member:/, ""), s.viewer], `${s.name}: the owner's stamps (by the bare member id, store-request R7)`);
    const usage = opCalls(w.env).filter((c) => c.route === "askusage");
    assert.equal(usage.length, 1);
    assert.deepEqual([usage[0].params.viewer, usage[0].body], [s.viewer, { mode: "draft", usage: { input_tokens: 5 }, calls: 1 }]);
    const rec = opCalls(w.env).filter((c) => c.route === "translationdraftrecord");
    assert.equal(rec.length, 1);
    assert.deepEqual([rec[0].params.by, rec[0].params.viewer], [s.by.replace(/^member:/, ""), s.viewer]);   /* the hand-back carries the owner's stamps (by: the bare member id) */
    assert.deepEqual(rec[0].body.draft, { words: [{ key: "nav.home", text: "Inicio" }] });
    /* K2238 (3d): instance-setup's hand-back body, the caller's asked `keys` beside the owner's words and the draft */
    assert.deepEqual(rec[0].body, { direction: "to_language", language: "es", keys: ["nav.home", "nav.cases"], words: WORDS,
                                    draft: { words: [{ key: "nav.home", text: "Inicio" }] }, not_drafted: ["nav.cases"] });
  }
  /* the owner's answer is the op's, refusal included */
  const refused = draftWorld({ recordAnswer: { ok: false, reason: "TRANSLATION_TEXT_REFUSED", detail: "placeholders" } });
  const rr = await call(refused.w.env, { op: "translationdraft", token: refused.w.S.ann, method: "POST", body: { language: "es", direction: "to_language" } });
  assert.deepEqual([rr.json.result.ok, rr.json.result.reason], [false, "TRANSLATION_TEXT_REFUSED"]);
});

test("R57 (T37): a translation draft that ends without one (an ending agent-worker names, an unbound or silent member) is answered as given, its status kept, and nothing is recorded; the grant is never answered", async () => {
  // fixtures-own: input the endings are the draft the object hands the door; the door must relay each as given, status kept
  for (const [drafted, status, reason] of [[{ ok: false, code: "stopped", detail: "the model stopped", grant: null }, 200, undefined],
                                           [{ ok: false, reason: "AGENT_WORKER_UNBOUND", detail: "none", grant: null }, 503, "AGENT_WORKER_UNBOUND"],
                                           [{ ok: false, reason: "AGENT_WORKER_SILENT", detail: "none", grant: "g-secret" }, 502, "AGENT_WORKER_SILENT"]]) {
    const { w } = draftWorld({ drafted, status });
    const r = await call(w.env, { op: "translationdraft", token: w.S.ann, method: "POST", body: { language: "es", direction: "to_language" } });
    assert.equal(r.status, status >= 400 ? status : 502, r.text);
    assert.equal(r.json.ok, false);
    if (reason) assert.equal(r.json.reason, reason);
    else assert.equal(r.json.code, "stopped");
    assert.equal("grant" in r.json, false);
    assert.equal(r.text.includes("g-secret"), false);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "translationdraftrecord"), [], "nothing recorded");
  }
});
