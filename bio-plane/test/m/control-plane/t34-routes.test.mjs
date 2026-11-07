/* control-plane T34 (T34-60, T34-87, T34-90, T34-91, T34-92; K1749, K1755, K1798, K1818, K1821, K1837): the ask's calls
   counted (R53, K1798); membership's T34 ops (R54, R30), tasks' check requests (R55), the group's key (R56) and the two
   drafts with the assistant resolved before them (R57), each routed with the stamps op-declarations declares and none
   taken from the caller (R29); and the door's member-facing words under DEC-149. Driven through `makeFetch(hooks)` for
   every kind of caller with every stamp forged, and through `dispatch` over a record. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, refused, FORGED } from "./harness.mjs";
const D = await import("../../../src/store-door/dispatch.mjs");
const { record } = await import("./record.mjs");
const { credentialsOf, credentialsOps } = await import("../../../src/credentials/index.mjs");
const { membershipOf, membershipOps } = await import("../../../src/membership/index.mjs");
const { instanceSetupOf } = await import("../../../src/setup.mjs");
const { aiUseOf } = await import("../../../src/ai-use/index.mjs");
const { aiAccountsOf } = await import("../../../src/ai-accounts/index.mjs");
const { PLANS: ACCOUNT_PLANS, HOSTS: ACCOUNT_HOSTS } = await import("../ai-accounts/catalogue.mjs");
const { wizardScriptsOf } = await import("../../../src/wizard-scripts/index.mjs");
const CHECKS = await import("../../../src/answer-envelope/checks.mjs");
const { word, hasWord, WORD_ROWS } = await import("../../../src/setup-words/index.mjs");

const { OPS } = O;
/* an owner's ops as op-declarations declares them for it, filtered (K3268: never a hand-typed list of another module's ops) */
const familyOps = (owner, pick) => Object.entries(O.OP_FAMILIES[owner].kinds).filter(([op, kind]) => pick(op, kind)).map(([op]) => op);
const OP_STAMPS = O.OP_STAMPS || {};
const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
const answering = (routes, result) => (c) => (routes.includes(c.route)
  ? new Response(JSON.stringify({ ok: true, result }), { status: 200 }) : null);

test("R53 (K1798; ai-use R1, was ai-runs R48, K2488): the record store's door hands ai-use's ask counter the ask's `calls`, so an ask of N model calls counts N and one stating none counts one; a `calls` that is no positive integer is refused and counts nothing (negative control: the count is read back)", async () => {
  const r = await record();
  const calls = () => r.db.prepare("SELECT COALESCE(SUM(calls), 0) n FROM ai_usage WHERE member IN ('ann', 'member:ann')").get().n;
  const three = await r.go("askusage?viewer=member:ann", "POST", { usage: USE, calls: 3 });
  assert.deepEqual([three.status, three.json.ok, three.json.result.ok], [200, true, true], JSON.stringify(three.json).slice(0, 300));
  assert.equal(calls(), 3);
  const one = await r.go("askusage?viewer=member:ann", "POST", { usage: USE });
  assert.equal(one.json.result.ok, true);
  assert.equal(calls(), 4);
  const bad = await r.go("askusage?viewer=member:ann", "POST", { usage: USE, calls: 0 });
  assert.equal(bad.json.result.ok, false);
  assert.equal(calls(), 4, "a refused count adds nothing");
});

test("R54, R30 (membership R101, R104; admission R17): `websiteinvite` and `joinlinkinvite` are public, and whoever calls — no credential, a member's session, the operator's token — only the body's key (or link), cover and the website's approver reach membership's route, in the store the caller names, with no stamp and nothing from the query; membership's one-time answer is relayed as given (negative control: a key, a link and stamps forged in the query and the body never reach it)", async () => {
  const once = { ok: true, invite: "INV-once", expires: "2026-10-13T00:00:00Z" };
  const { env, S } = world({ answer: answering(["websiteinvite", "joinlinkinvite"], once) });
  for (const op of ["websiteinvite", "joinlinkinvite"]) {
    assert.equal(OPS[op]?.classes, null, `${op} is public`);
    for (const [token, params] of [[undefined, {}], [S.ann, {}], [env.ADMIN_TOKEN, {}], [undefined, { store: "scratch" }]]) {
      env.calls.length = 0;
      const sent = op === "websiteinvite"
        ? { key: "wk-body", cover: "Pat", approvedBy: "front desk", by: FORGED, viewer: FORGED, actorMemberId: FORGED }
        : { link: "jl-body", cover: "Pat", approvedBy: "ignored", by: FORGED, viewer: FORGED };
      const r = await call(env, { op, token, method: "POST", body: sent,
                                  params: { ...params, key: "query-key", link: "query-link", cover: "Q", by: FORGED, viewer: FORGED } });
      assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
      assert.deepEqual(r.json, { ok: true, result: once });
      const inner = opCalls(env).filter((c) => c.route === op);
      assert.equal(inner.length, 1, op);
      assert.deepEqual(inner[0].params, {}, `${op}: nothing from the query`);
      assert.deepEqual(inner[0].body, op === "websiteinvite" ? { key: "wk-body", cover: "Pat", approvedBy: "front desk" }
                                                             : { link: "jl-body", cover: "Pat" });
      assert.equal(inner[0].ns, params.store === "scratch" ? "scratch" : "bio");
    }
  }
  /* a store that does not answer is a silence, never a success (R23, R24) */
  const silent = world({ answer: (c) => (c.route === "websiteinvite" ? new Response("no", { status: 500 }) : null) });
  refused(await call(silent.env, { op: "websiteinvite", method: "POST", body: { key: "k", cover: "c" } }), 502, "STORE_DID_NOT_ANSWER", "C-69.2");
});

test("R54 (membership R110; admission R16): `groupdescription` is public and reaches membership with the viewer admission's `readerOf` reads — `\"\"` for no one, `admin` for the founder, `member:<id>` for a member, `class:<cls>` for a binding class — never the caller's own `viewer` (negative control: a forged viewer is not read)", async () => {
  const { env, S } = world({ answer: answering(["groupdescription"], { description: null }) });
  assert.equal(OPS.groupdescription?.classes, null);
  for (const [token, want, store] of [[undefined, ""], ["not-a-token", ""], [S.founder, "admin"], [S.ann, "member:ann"],
                                      [env.ADMIN_TOKEN, "class:admin"], [env.PROBE_TOKEN, "class:probe", "scratch"], [undefined, "", "scratch"]]) {
    env.calls.length = 0;
    const r = await call(env, { op: "groupdescription", token, params: { viewer: FORGED, ...(store ? { store } : {}) } });
    assert.deepEqual([r.status, r.json.ok, r.json.result], [200, true, { description: null }], String(token));
    const [inner] = opCalls(env).filter((c) => c.route === "groupdescription");
    assert.deepEqual([inner.params, inner.ns], [{ viewer: want }, store ?? "bio"], String(token));
  }
});

test("R54, R29 (op-declarations R22; membership R84): membership's ten administrator acts reach its map with `by` the session's own member — the founder `admin`, a member their id — and a machine credential's `class:<cls>`, which membership refuses NOT_AN_ADMIN; a caller's own `by`, in the query or the body, never reaches it (negative control: the forged value is looked for and absent)", async () => {
  const acts = familyOps("membership", (op, kind) => kind === "roster");
  assert.equal(acts.length, 10, "membership declares ten administrator acts");
  const { env, S } = world();
  let checked = 0;
  for (const op of acts) {
    assert.ok(OPS[op]?.mutating, `${op} has a mutating spec`);
    for (const [token, params, want] of [[S.founder, {}, "admin"], [S.ann, {}, "ann"], [env.ADMIN_TOKEN, {}, "class:admin"],
                                          [env.PROBE_TOKEN, { store: "scratch" }, "class:probe"]]) {
      env.calls.length = 0;
      const r = await call(env, { op, token, method: "POST", params: { ...params, by: FORGED }, body: { by: FORGED, memberId: "m1" } });
      if (r.status !== 200) continue;
      const [inner] = opCalls(env);
      assert.equal(inner.route, op);
      assert.equal(inner.params.by, want, `${op}: ${want}`);
      assert.equal(JSON.stringify(inner.params).includes(FORGED), false, `${op}: the forged by is gone`);
      checked++;
    }
  }
  assert.ok(checked >= acts.length * 3, String(checked));
});

test("R54, R2 (membership R106; op-declarations R6): `checkaddressees` is never served to a caller — every caller, any credential, is answered as an op with no spec (UNKNOWN_OP, C-69.1) and nothing reaches the store — while membership's map still serves it in-process for tasks (negative control: the same caller reaches a declared op)", async () => {
  const { env, S } = world();
  assert.equal(Object.hasOwn(OPS, "checkaddressees"), false);
  for (const token of [undefined, S.founder, S.ann, env.ADMIN_TOKEN]) {
    env.calls.length = 0;
    refused(await call(env, { op: "checkaddressees", token, params: { target: "PRJ-1", label: "law" } }), 400, "UNKNOWN_OP", "C-69.1");
    assert.deepEqual(opCalls(env), []);
  }
  const ok = await call(env, { op: "courtnotice", token: S.ann });
  assert.equal(ok.status, 200);
  const { ctx } = await record();
  const served = membershipOps(membershipOf(ctx), new URL("http://do/checkaddressees?target=PRJ-NONE&label=law"), null, {});
  assert.deepEqual(served.checkaddressees(), []);
});

test("R55 (op-declarations R23; tasks R13–R16): tasks' five check-request ops are routed through tasks' own map in the record store's door, each admitted only from a member's session, with the stamps op-declarations declares set from the session and none taken from the caller (negative control: a machine credential is refused before the store, and a forged stamp is absent)", async () => {
  const URL0 = new URL("http://do/");
  const routes = Object.keys(D.controlPlaneRoutes(null, URL0, null));
  const ops = familyOps("tasks", (op) => op.startsWith("check"));
  assert.equal(ops.length, 5, "tasks declares five check-request ops");
  const { env, S } = world();
  for (const op of ops) {
    assert.ok(routes.includes(op), `${op} is routed`);
    assert.deepEqual(OPS[op]?.machineClasses, [], op);
    const keys = OP_STAMPS[op] || [];
    assert.ok(keys.includes("viewer"), `${op} stamps viewer`);
    if (OPS[op].mutating) assert.ok(keys.includes("by"), `${op} stamps by`);
    env.calls.length = 0;
    const r = await call(env, { op, token: S.ann, method: OPS[op].mutating ? "POST" : "GET",
                                params: { viewer: FORGED, by: FORGED }, body: OPS[op].mutating ? { request: "R1" } : undefined });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
    const [inner] = opCalls(env);
    assert.equal(inner.params.viewer, "member:ann", op);
    if (keys.includes("by")) assert.equal(inner.params.by, "member:ann", op);
    assert.equal(JSON.stringify(inner.params).includes(FORGED), false, op);
    env.calls.length = 0;
    for (const [token, params] of [[env.ADMIN_TOKEN, {}], [env.PROBE_TOKEN, { store: "scratch" }], [env.DAEMON_TOKEN, {}]]) {
      env.calls.length = 0;
      const m = await call(env, { op, token, params, method: OPS[op].mutating ? "POST" : "GET", body: OPS[op].mutating ? {} : undefined });
      refused(m, 403, "CLASS_FORBIDDEN", "C-38.2");
      assert.deepEqual(opCalls(env), [], `${op}: nothing reached the store`);
    }
    /* admission R5 (T36, K2166): the retired shared member key is refused by name, nothing reaching the store */
    env.calls.length = 0;
    const m = await call(env, { op, token: env.MEMBER_TOKEN, method: OPS[op].mutating ? "POST" : "GET", body: OPS[op].mutating ? {} : undefined });
    refused(m, 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
    assert.deepEqual(opCalls(env), [], `${op}: nothing reached the store`);
  }
});

/* op-grades R57 (PR 866) retired the alpha group key's six ops (R56's) with their grade rows; the credential act that stands
   in their place is credentials' `keyedserviceset` (R29 there), the precedent op-grades used. R56's intent is held on it:
   a session's act only, its key from the body reaching the owner, a caller's stamps never, and no answer carrying the key.
   The six retired names are R56's own, asserted as ops with no spec (R2). */
const RETIRED_GROUP_KEY_OPS = ["groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeystate", "groupkeynotice", "groupkeynoticeseen"];

test("R56, R2 (op-grades R57, PR 866): the group key's six retired ops are declared by no registration and answered as ops with no spec (400 UNKNOWN_OP), nothing asked of the store and the key in no answer", async () => {
  const { env, S } = world();
  for (const op of RETIRED_GROUP_KEY_OPS) {
    assert.equal(Object.hasOwn(OPS, op), false, `${op}: no spec`);
    env.calls.length = 0;
    const r = await call(env, { op, token: S.founder, method: "POST", body: { key: "sk-in-the-body" } });
    refused(r, 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(r.text.includes("sk-in-the-body"), false, op);
    assert.deepEqual(opCalls(env), [], `${op}: nothing asked of the store`);
  }
});

test("R56, R30 (credentials R29; admission R19; op-grades R57's precedent): the standing credential act `keyedserviceset` reaches credentials' route from a session only, its key from the body, a caller's `by` and `viewer` never; machine credentials and the retired member key are refused before the store; and through the record store's door no answer or refusal carries the key (negative control: the body's key is passed)", async () => {
  const { env, S } = world();
  const op = "keyedserviceset";
  assert.deepEqual(OPS[op]?.machineClasses, [], op);
  env.calls.length = 0;
  const r = await call(env, { op, token: S.founder, method: "POST", params: { by: FORGED, viewer: FORGED },
                              body: { service: "svc", key: "sk-in-the-body", by: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  const [inner] = opCalls(env);
  assert.equal(inner.route, op);
  assert.equal(JSON.stringify(inner.params).includes(FORGED), false, "no forged stamp in the address");
  assert.equal(JSON.stringify(inner.body).includes(FORGED), false, "no forged stamp in the body");
  assert.equal(inner.body.key, "sk-in-the-body", "the body's key is passed");
  assert.equal(r.text.includes("sk-in-the-body"), false, "the key is in no answer");
  for (const token of [env.ADMIN_TOKEN, env.DAEMON_TOKEN]) {
    env.calls.length = 0;
    const m = await call(env, { op, token, method: "POST", body: {} });
    assert.equal(m.status, 403, `${op}: a machine credential`);
    assert.deepEqual(opCalls(env), []);
  }
  /* admission R5 (T36, K2166): the retired shared member key is refused by name */
  env.calls.length = 0;
  refused(await call(env, { op, token: env.MEMBER_TOKEN, method: "POST", body: {} }), 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
  assert.deepEqual(opCalls(env), []);
  /* through the record store's door over credentials' map, as plane composes it: the key set, refused to a member who is
     no administrator, and read back, never in an answer */
  const { ctx } = await record({ sealSecret: "control-plane-test-seal-secret-0001" });
  await credentialsOf(ctx).claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  const store = { routes: (url, body) => ({ ...credentialsOps(credentialsOf(ctx), url, body, {}), ...D.controlPlaneRoutes(ctx, url, body) }),
                  membership: () => membershipOf(ctx) };
  const go = async (path, method = "GET", body) => {
    const res = await D.dispatch(new Request(`http://do/${path}`, body === undefined ? { method } : { method, body: JSON.stringify(body) }), store);
    return { status: res.status, json: await res.json() };
  };
  const secret = "sk-ant-the-service-key-0123456789";
  const answers = [await go("keyedserviceset?by=admin", "POST", { service: "courtlistener", key: secret }),
                   await go("keyedserviceset?by=member:nobody", "POST", { service: "courtlistener", key: secret }),
                   await go("keyedservices?viewer=admin")];
  assert.deepEqual([answers[0].json.result.ok, answers[1].json.result.ok, Array.isArray(answers[2].json.result.services)], [true, false, true],
                   JSON.stringify(answers.map((a) => a.json)).slice(0, 600));
  for (const a of answers) assert.equal(JSON.stringify(a.json).includes(secret), false);
});

/* (op-grades R57, PR 866; ai-accounts R40, R5, R51) accounts are held through ai-accounts' own T53 acts, the retired group-key and
   account-reference forms gone: a member's own API account or the team's, of the catalogue fixture's plans, its key sealed
   and switched on; a member's recipient notice for the plan's host seen. */
const NOTICE_DUE = "RECIPIENT_NOTICE_DUE";
async function holdAccount(ctx, owner, plan, secret, by) {
  const AA = aiAccountsOf(ctx);
  const set = await AA.accountSet({ owner, provider: ACCOUNT_PLANS.provider, plan, means: "sealed", secret, by });
  assert.equal(set.ok, true, JSON.stringify(set));
  const sw = AA.accountSwitch({ account_id: set.account_id, on: true, by });
  assert.equal(sw.ok, true, JSON.stringify(sw));
}
const ownAccount = async (ctx, member, secret) => {
  await holdAccount(ctx, `member:${member}`, ACCOUNT_PLANS.memberApi, secret, `member:${member}`);
  noticeSeen(ctx, member);
};
const teamAccount = (ctx, secret) => holdAccount(ctx, "group", ACCOUNT_PLANS.teamApi, secret, "admin");
function noticeSeen(ctx, member) {
  const r = aiAccountsOf(ctx).recipientNoticeSeen({ member: `member:${member}`, provider: ACCOUNT_PLANS.provider, host: ACCOUNT_HOSTS.main, by: `member:${member}` });
  assert.equal(r.ok, true, JSON.stringify(r));
}

/* A record with a claimed founder, the members `ann` (an administrator) and `bea` and `cal` (members), and the two drafts'
   handlers replaced by recorders, so what the door hands each is seen whatever its owner answers. */
async function drafts() {
  const r = await record({ sealSecret: "control-plane-test-seal-secret-0002" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  for (const [id, role] of [["ann", "admin"], ["bea", "member"], ["cal", "member"]]) {
    const a = await mb.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    assert.equal(a.ok, true, JSON.stringify(a));
    await mb.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  const seen = [];
  instanceSetupOf(r.ctx).groupDescriptionDraft = (args) => { seen.push(["groupdescriptiondraft", args]); return { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" }; };
  /* (K2574; wizard-scripts R27) the door hands `writinghelp` an account's or a limit's refusal as `assistant.refusal`, and
     the handler answers it among its own; the stand-in answers it first, as the handler does before any draft */
  wizardScriptsOf(r.ctx).writingHelp = (args) => {
    if (args.assistant && args.assistant.refusal) return args.assistant.refusal;
    seen.push(["writinghelp", args]); return { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" };
  };
  const code = (a) => a.json.result.code ?? a.json.result.reason;
  return { r, C, seen, code };
}

test("R57 (instance-setup R55, R65; run-rules R20; ai-use R3; credentials R35, R36; T37: N765, K231): before either draft's handler the door answers, in order, `groupdescriptiondraft`'s NOT_AN_ADMIN, AI_KEPT_AWAY (credentials' one row, in place of ASSISTANT_OFF), NO_ACCOUNT (credentials R35, was AI_NO_ACCOUNT), the paying account's limit (ai-use R3's AI_LIMIT_REACHED, the retired ceilings' place), and credentials' own refusal of the account (the group key's notice unread), each before any handler is asked (negative control: once every one is cleared the handler is reached)", async () => {
  const { r, C, seen, code } = await drafts();
  const gdd = (by) => r.go(`groupdescriptiondraft?by=${by}&viewer=${by}`, "POST", { answers: [{ question: "q", text: "t" }] });
  const help = (by) => r.go(`writinghelp?by=${by}&viewer=${by}`, "POST", { op: "notewrite", field: "text", told: "what I saw" });
  /* NOT_AN_ADMIN first, whatever else holds */
  assert.equal(code(await gdd("member:bea")), "NOT_AN_ADMIN");
  assert.equal(code(await gdd("class:admin")), "NOT_AN_ADMIN");
  assert.equal(code(await gdd("")), "NOT_AN_ADMIN");
  /* the assistant off: the group keeps its material away from every assistant (credentials R51; instance-setup R53 since
     T36, K2162), answered as credentials' `aiKeptAway()` answers it (its R35, the one site; store-door R10, N765), then
     lets it back */
  assert.equal(C.aiKeepAwaySet({ on: true, reason: "kept away while we decide", by: "admin" }).ok, true);
  assert.equal(code(await gdd("member:ann")), "AI_KEPT_AWAY");
  assert.equal(code(await help("member:bea")), "AI_KEPT_AWAY");
  assert.equal(C.aiKeepAwaySet({ on: false, by: "admin" }).ok, true);
  /* no account serves */
  assert.equal(code(await gdd("member:ann")), "NO_ACCOUNT");
  assert.equal(code(await help("member:bea")), "NO_ACCOUNT");
  /* the member's own account, then its own limit */
  await ownAccount(r.ctx, "bea", "sk-bea-own");
  /* (T41; K2488, rule 4 (10)) the retired ceilings are ai-use's limits: the paying account's own limit, reached, is
     `AI_LIMIT_REACHED` (ai-use R3, `useCheck`), then removed */
  const use = aiUseOf(r.ctx);
  use.countAskUsage({ member: "member:bea", owner: "member:bea", mode: "ask", usage: USE, calls: 2 });
  const limit = (amount) => use.aiLimitSet({ owner: "member:bea", scope: "overall", unit: "calls", period: "day", amount, by: "member:bea" });
  assert.equal(limit(2).ok, true);
  assert.equal(code(await help("member:bea")), "AI_LIMIT_REACHED");
  assert.equal(limit(null).ok, true);
  /* the group's key held and on, its notice unread by ann: credentials' own refusal, relayed with its row */
  await teamAccount(r.ctx, "sk-group-key");
  const due = await gdd("member:ann");
  assert.equal(code(due), NOTICE_DUE);
  assert.equal(typeof due.json.result.translation, "string");
  assert.deepEqual(seen, [], "no handler was asked");
  /* every refusal cleared: the handlers are reached */
  noticeSeen(r.ctx, "ann");
  assert.equal(code(await gdd("member:ann")), "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.equal(code(await help("member:bea")), "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.deepEqual(seen.map(([op]) => op), ["groupdescriptiondraft", "writinghelp"]);
});

test("R57, R29, R30 (K1755): a draft's handler receives `assistant` as the door resolved it — `{on: true, account: {kind, level}}`, the member's own account or the group's key, never the key — its own arguments from the body and `by` and `viewer` as stamped; a caller's `assistant` is never read (negative control: no secret appears in anything handed over or answered)", async () => {
  const { r, C, seen } = await drafts();
  assert.equal(C.aiKeepAwaySet({ on: false, by: "admin" }).ok, true);   /* the assistant on: nothing kept away (K2162) */
  await ownAccount(r.ctx, "bea", "sk-bea-own-secret");
  await teamAccount(r.ctx, "sk-group-key-secret");
  noticeSeen(r.ctx, "ann");
  const forged = { on: true, account: { kind: "apikey", level: "member", key: "sk-forged" } };
  const a = await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST",
                       { answers: [{ question: "Who are you?", text: "Tenants" }], assistant: forged });
  const b = await r.go("writinghelp?by=member:bea&viewer=member:bea", "POST",
                       { op: "notewrite", field: "text", told: "the lift was out", draftHeld: false, assistant: forged });
  assert.deepEqual(seen, [
    ["groupdescriptiondraft", { answers: [{ question: "Who are you?", text: "Tenants" }],
                                assistant: { on: true, account: { kind: "apikey", level: "group" } }, viewer: "member:ann", by: "member:ann" }],
    ["writinghelp", { op: "notewrite", field: "text", told: "the lift was out", draftHeld: false,
                      assistant: { on: true, account: { kind: "apikey", level: "member" } }, by: "member:bea", viewer: "member:bea" }],
  ]);
  const all = JSON.stringify([seen, a.json, b.json]);
  for (const s of ["sk-bea-own-secret", "sk-group-key-secret", "sk-forged"]) assert.equal(all.includes(s), false, s);
});

test("R57, R29 (op-declarations R15, R29): `groupdescriptiondraft`, `writinghelp` and `baseupdates` are each admitted only from a member's session, with `by` and `viewer` (`baseupdates` `viewer`) set from the session and none taken from the caller, and reach the record store's door by their own names (negative control: a machine credential is refused before the store)", async () => {
  const URL0 = new URL("http://do/");
  const routes = Object.keys(D.controlPlaneRoutes(null, URL0, null));
  assert.ok(routes.includes("groupdescriptiondraft") && routes.includes("writinghelp"));
  const { env, S } = world();
  for (const op of ["groupdescriptiondraft", "writinghelp", "baseupdates"]) {
    assert.deepEqual(OPS[op]?.machineClasses, [], op);
    const want = op === "baseupdates" ? ["viewer"] : ["by", "viewer"];
    for (const k of want) assert.ok((OP_STAMPS[op] || []).includes(k), `${op} stamps ${k}`);
    env.calls.length = 0;
    const post = op !== "baseupdates";
    const r = await call(env, { op, token: S.ann, method: post ? "POST" : "GET", params: { by: FORGED, viewer: FORGED },
                                body: post ? { assistant: { on: true }, told: "x" } : undefined });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
    const [inner] = opCalls(env);
    assert.equal(inner.route, op);
    for (const k of want) assert.equal(inner.params[k], "member:ann", `${op}: ${k}`);
    assert.equal(JSON.stringify(inner.params).includes(FORGED), false, op);
    for (const token of [env.ADMIN_TOKEN, env.DAEMON_TOKEN]) {
      env.calls.length = 0;
      assert.equal((await call(env, { op, token, method: post ? "POST" : "GET", body: post ? {} : undefined })).status, 403, op);
      assert.deepEqual(opCalls(env), []);
    }
    /* admission R5 (T36, K2166): the retired shared member key is refused by name before the store */
    env.calls.length = 0;
    refused(await call(env, { op, token: env.MEMBER_TOKEN, method: post ? "POST" : "GET", body: post ? {} : undefined }),
            401, "MEMBER_TOKEN_RETIRED", "C-38.11");
    assert.deepEqual(opCalls(env), []);
  }
});

test("R22, R32, R33 (DEC-149, K1821; T34-87): the door's own rows call the group's Civicsmith by name — \"this group's Civicsmith\" in the rows any caller can receive, a caller with no credential included (C-69.1–C-69.4), \"your group's Civicsmith\" in the founder's claim rows (C-68.2–C-68.4), the hold (C-69.5) and the replay (C-66.6) — as do the silence's detail and the three one-time answers; none says this copy, this instance, this plane or the plane (negative control: the old words match the pattern)", async () => {
  const OLD = /this copy|the copy\b|this instance|this plane|the plane\b/i;
  const rows = { ...CHECKS.DISPATCH_CHECKS, ...CHECKS.BOOTSTRAP_CHECKS, ...CHECKS.REPLAY_CHECKS };
  /* each code's sentence is the row `refusal.<code>` of the words list, compared by equality, never held here */
  const byName = ["UNKNOWN_OP", "STORE_DID_NOT_ANSWER", "PLANE_INTERNAL_ERROR", "STORE_INTERNAL_ERROR", "PURGE_HOLD_IN_PLACE",
                  "BOOTSTRAP_CREDENTIAL_UNSET", "BOOTSTRAP_CREDENTIAL_PUBLISHED", "BOOTSTRAP_CREDENTIAL_MISMATCH", "REPLAY_UNVERIFIED"];
  for (const code of byName) {
    assert.ok(hasWord(`refusal.${code}`), code);
    assert.equal(rows[code].translation, word(`refusal.${code}`), code);
    assert.doesNotMatch(rows[code].translation, OLD, code);
    assert.equal(M.dec49Row(code).translation, rows[code].translation, `${code} decorates with its own words`);
  }
  for (const row of Object.values(rows)) assert.doesNotMatch(row.translation, OLD, row.check);
  /* the silence's detail is a row of the words list (a code-written sentence's row), found by its sentence, never held here */
  const silentRow = WORD_ROWS.find((r) => r[1] === M.STORE_SILENT_DETAIL);
  assert.ok(silentRow && hasWord(silentRow[0]), "STORE_SILENT_DETAIL is a row of the words list");
  assert.equal(word(silentRow[0]), M.STORE_SILENT_DETAIL);
  assert.doesNotMatch(M.STORE_SILENT_DETAIL, OLD);
  /* the one-time answers, as a caller receives them */
  const { env, S } = world();
  const mint = await call(env, { op: "aicredentialmint", token: S.ann, method: "POST", body: { writes: [] } });
  const grant = await call(env, { op: "reviewgrant", token: S.founder, method: "POST", body: {} });
  const tgrant = await call(env, { op: "templatereviewgrant", token: S.founder, method: "POST", body: {} });
  for (const [r, key] of [[mint, "tokenIsShownOnce"], [grant, "secretIsShownOnce"], [tgrant, "secretIsShownOnce"]]) {
    assert.equal(r.status, 200, r.text.slice(0, 200));
    /* R99 (T49): the sentence is read by key through setup-words (asserted in t49-door.test.mjs), no English held here */
    assert.equal(typeof r.json.result[key], "string", key);
  }
  for (const old of ["This copy has no operation by that name.", "this instance could not consult its own record",
                     "This is the only time this instance will show this value.", "the plane could not check that"])
    assert.match(old, OLD);
});

test("R21 (N630, K1864 (1)): every JSON answer the door builds is compact, with no indentation or line break, for an answer, a refusal and a relayed store answer alike (negative control: the indented form of the same answer is longer)", async () => {
  const { env, S } = world();
  for (const args of [{ op: "whoami", token: S.ann }, { op: "nosuchop" }, { op: "index", token: S.ann }]) {
    const r = await call(env, args);
    assert.equal(/\n/.test(r.text), false, args.op);
    assert.equal(r.text, JSON.stringify(r.json), args.op);
    assert.ok(JSON.stringify(r.json, null, 1).length > r.text.length);
  }
});

test("R55 (op-declarations R21; K1863 (7)): every alias `OP_ALIASES` declares is routed to the handler of the op it aliases, with that op's stamps, so the two answer alike — the same store route, the same stamped parameters and the same answer for the same caller (negative control: a name that is neither an op nor an alias is unknown)", async () => {
  const aliases = Object.entries(O.OP_ALIASES);
  assert.ok(aliases.length > 20, String(aliases.length));
  assert.ok(Object.isFrozen(O.OP_ALIASES));
  const { env, S } = world();
  let compared = 0;
  for (const [alias, op] of aliases) {
    assert.ok(Object.hasOwn(OPS, op), `${alias} → ${op}: the op is declared`);
    const ask = async (name) => {
      env.calls.length = 0;
      const r = await call(env, { op: name, token: S.ann, method: OPS[op].mutating ? "POST" : "GET",
                                  params: { id: "X-1", viewer: FORGED, by: FORGED }, body: OPS[op].mutating ? { note: "n" } : undefined });
      return { status: r.status, text: r.text, inner: opCalls(env).filter((c) => c.route !== "wizardrefusaltally").map((c) => [c.route, c.params, c.body]) };
    };
    const [a, b] = [await ask(alias), await ask(op)];
    assert.deepEqual(a, b, `${alias} answers as ${op}`);
    if (a.inner.length) compared++;
  }
  assert.ok(compared > 10, String(compared));
  refused(await call(env, { op: "nosuchaliasorop", token: S.ann }), 400, "UNKNOWN_OP", "C-69.1");
});

test("R28, R54, R56 (admission R17, R19; K1861 (6)): admission's query gate runs after R1 and before anything reads the URL — a public door's `token` is never looked up and its key, link and cover never reach the store from the query; and a `store=` naming no namespace is still R1's refusal first (negative control: the session's token on a credential act, `keyedserviceset` since op-grades R57 retired `groupkeyset`, is still read)", async () => {
  const { env, S } = world();
  env.calls.length = 0;
  const d = await call(env, { op: "websiteinvite", token: S.ann, method: "POST", params: { key: "q-key", cover: "q-cover" }, body: {} });
  assert.equal(d.status, 200, d.text.slice(0, 200));
  assert.deepEqual(env.calls.map((c) => c.route), ["websiteinvite"], "no session lookup for a public door's token");
  assert.deepEqual(env.calls[0].body, {});
  env.calls.length = 0;
  const g = await call(env, { op: "keyedserviceset", token: S.founder, method: "POST", body: { service: "svc", key: "b-key" } });
  assert.equal(g.status, 200);
  assert.ok(env.calls.some((c) => c.route === "session"), "the session is read");
  const [inner] = opCalls(env);
  assert.equal(inner.body.key, "b-key");
  refused(await call(env, { op: "keyedserviceset", token: S.founder, method: "POST", params: { store: "nowhere", key: "q" }, body: {} }),
          400, "NAMESPACE_UNKNOWN", "C-78.1");
});
