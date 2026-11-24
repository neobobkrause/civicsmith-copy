/* admission: T47-77 (K3043, K3084; credentials R63, R65, R66, R71; op-declarations R58) — an `ai` credential bound to
   a run writes only to that run (R23), a locked session is admitted only to `unlock`, `reauth` and `signout` (R24), and
   an act `REAUTH_ACTS` names is answered credentials' `REAUTH_DUE` outside the password's re-ask window (R25). Both
   codes are credentials' rows, relayed as it gives them. Each test drives admission at its interface, with a negative
   control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, urlOf, presenting, refused, opCalls, doAnswer, hex64, aik, cred, member, founder, arranged,
         REAUTH_DUE_ANSWER } from "./harness.mjs";

const { Credentials } = await import("../../../src/credentials/index.mjs");
const { OPS } = O;
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);

/* ---------------------------------------------------------------------------------------------------------------- */

test("R23: an ai credential whose row carries a run is admitted to a write only when the write names that run — a write naming another run, none, or two that differ is refused AI_BEYOND_TASK_SCOPE (C-29.6) before any store call; its reads are the floor; control: a credential bound to no run writes as before", async () => {
  /* (N1073) the runner's writes are read from op-declarations' declaration of the ai-runs ops, not hand-listed */
  const RUN_WRITES = [...O.AI_RUN_ACTIONS].filter((k) => OPS[k]?.mutating && A.aiReachesAsMember(OPS[k], k));
  assert.ok(RUN_WRITES.length >= 4, "the runner's writes are declared");
  for (const op of RUN_WRITES) assert.ok(OPS[op].mutating && A.aiReachesAsMember(OPS[op], op), `${op}: a write an agent can reach`);
  const runCred = aik(), free = aik();
  const { env } = world({ creds: {
    [runCred]: cred({ tokenId: "run-seg-1", principal: "member:ann", writes: RUN_WRITES, run: "run-1" }),
    [free]: cred({ tokenId: "agent-free", principal: "member:ann", writes: RUN_WRITES }) } });
  for (const op of RUN_WRITES) {
    /* its own run, named in the body (as the runner names it) or the query: admitted */
    for (const named of [{ extraBody: { run: "run-1" } }, { params: { run: "run-1" } }, { extraBody: { run: "run-1" }, params: { run: "run-1" } }])
      assert.equal((await gate(env, { op, token: runCred, ...named })).caller?.cls, "ai", `${op}: ${JSON.stringify(named)}`);
    /* another run, none, two that differ, a run of another type: refused, nothing past the lookup */
    for (const named of [{ extraBody: { run: "run-2" } }, {}, { extraBody: { run: "" } }, { extraBody: { run: null } },
                         { extraBody: { run: "run-1" }, params: { run: "run-2" } }, { extraBody: { run: "run-2" }, params: { run: "run-1" } },
                         { extraBody: { run: ["run-1"] } }, { extraBody: { run: { id: "run-1" } } }, { params: { run: "RUN-1" } }]) {
      env.calls.length = 0;
      const body = refused(await gate(env, { op, token: runCred, ...named }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [runCred]);
      assert.deepEqual([body.op, body.cls, body.tokenId, body.run], [op, "ai", "run-seg-1", "run-1"], JSON.stringify(named));
      assert.equal(opCalls(env).length, 0, `${op}: before any store call`);
    }
    /* control: a credential bound to no run writes whatever run is named, or none */
    for (const named of [{ extraBody: { run: "run-2" } }, {}])
      assert.equal((await gate(env, { op, token: free, ...named })).caller?.cls, "ai", `${op}: unbound`);
  }
  /* a write outside its listed writes is still refused by its declaration, run or not */
  refused(await gate(env, { op: "promote", token: runCred, extraBody: { run: "run-1" } }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6");
  /* reads are the floor: no run asked */
  for (const op of GATED.filter((k) => !OPS[k].mutating && A.aiReachesAsMember(OPS[k], k)).slice(0, 10))
    assert.equal((await gate(env, { op, token: runCred, method: "GET" })).caller?.cls, "ai", op);
  /* at the gate itself, and runsNamed whole */
  const spec = OPS[RUN_WRITES[0]];
  const c = cred({ writes: RUN_WRITES, run: "r" });
  assert.deepEqual(A.aiTaskScope(c, RUN_WRITES[0], spec, { named: ["r"] }), { ok: true, viewer: "member:ann" });
  assert.equal(A.aiTaskScope(c, RUN_WRITES[0], spec).refusal.body.reason, "AI_BEYOND_TASK_SCOPE");
  assert.equal(A.aiTaskScope(c, RUN_WRITES[0], spec, { named: ["r", "s"] }).refusal.body.reason, "AI_BEYOND_TASK_SCOPE");
  assert.deepEqual(A.aiTaskScope(cred({ writes: RUN_WRITES, run: "" }), RUN_WRITES[0], spec), { ok: true, viewer: "member:ann" }, "an empty run binds nothing");
  assert.deepEqual(A.runsNamed({ url: urlOf({ run: "q" }), body: { run: "b" } }), ["b", "q"]);
  assert.deepEqual(A.runsNamed({ body: { run: 5 } }), [5]);
  for (const odd of [undefined, {}, { body: [] }, { body: { run: "" } }, { url: {} }, { url: urlOf({ run: "" }) }])
    assert.deepEqual(A.runsNamed(odd), [], JSON.stringify(odd));
});

/* ---------------------------------------------------------------------------------------------------------------- */

test("R24: a locked session is admitted only to unlock, reauth and signout — every other op, a read and export included, is answered 401 with credentials' sessionLockedRefusal as it gives it (SESSION_LOCKED), before anything else is judged or any op's store call; a locked session reads as no one; control: the same session unlocked is admitted", async () => {
  assert.deepEqual([...A.LOCKED_SESSION_OPS].sort(), ["reauth", "signout", "unlock"]);
  assert.ok(Object.isFrozen(A.LOCKED_SESSION_OPS));
  const locked = { ann: hex64(), founder: hex64() };
  const allCaps = ["contribute", "publish", "create_projects"];
  const lockedRow = (s) => ({ ...s, capabilities: [], administer: false, rootOfTrust: false, locked: true });
  const { env, S } = world({ sessions: { [locked.ann]: lockedRow(member("ann", allCaps)), [locked.founder]: lockedRow(founder(allCaps)) } });
  const given = Credentials.sessionLockedRefusal();
  assert.equal(given.code, "SESSION_LOCKED");
  for (const t of Object.values(locked)) for (const op of GATED.filter((k) => !A.LOCKED_SESSION_OPS.includes(k))) {
    env.calls.length = 0;
    const r = await gate(env, { op, token: t, method: OPS[op].mutating ? "POST" : "GET" });
    const body = refused(r, 401, "SESSION_LOCKED", given.check, [t]);
    assert.deepEqual(body, given, `${op}: relayed as credentials gives it`);
    assert.equal(opCalls(env).length, 0, `${op}: nothing past the session read`);
  }
  /* the three it is admitted to: signout as declared; unlock and reauth as a session's own acts (their specs are
     op-declarations' R57: a copy of the session tables arranged to hold them where they are not yet declared) */
  const own = { classes: ["admin", "member"], mutating: true };
  const tables = arranged((m, a) => { for (const k of A.LOCKED_SESSION_OPS) { m.add(k); a.add(k); } });
  for (const t of Object.values(locked)) for (const op of A.LOCKED_SESSION_OPS) {
    const spec = OPS[op] ?? own;
    const a = await A.admit({ url: urlOf({}), env, op, spec, method: "POST", presented: { cred: null }, doAnswer, credential: presenting(t), tables });
    assert.equal(a.caller?.viaSession, true, `${op}: admitted`);
  }
  /* readerOf: no one */
  for (const t of Object.values(locked))
    assert.deepEqual(await A.readerOf(urlOf({}), env, "bio", undefined, doAnswer, presenting(t)), { viewer: "" });
  /* control: unlocked, the same ops are not answered SESSION_LOCKED, and the reader is the member */
  for (const op of ["index", "promote", "whoami"])
    assert.notEqual((await gate(env, { op, token: S.ann })).refusal?.body.reason, "SESSION_LOCKED", op);
  assert.equal((await gate(env, { op: "index", token: S.ann, method: "GET" })).caller.viewer, "member:ann");
  assert.deepEqual(await A.readerOf(urlOf({}), env, "bio", undefined, doAnswer, presenting(S.ann)), { viewer: "member:ann", cls: "member" });
  /* a session answering `locked` as anything but true is not locked (credentials answers a boolean) */
  const odd = hex64();
  const w = world({ sessions: { [odd]: { ...member("cy", allCaps), locked: "yes" } } });
  assert.ok((await gate(w.env, { op: "index", token: odd, method: "GET" })).caller);
});

test("R24 (credentials R71 (7)): the session read carries background=1 exactly when the door marks the request background, for admit and readerOf alike; the flag is in no other request and names no credential", async () => {
  const { env, S } = world();
  for (const background of [true, false, undefined]) {
    env.calls.length = 0;
    await gate(env, { op: "index", token: S.ann, method: "GET", background });
    await A.readerOf(urlOf({}), env, "bio", undefined, doAnswer, presenting(S.ann), background === undefined ? undefined : { background });
    const reads = env.calls.filter((c) => c.route === "session");
    assert.equal(reads.length, 2);
    for (const c of reads) {
      assert.deepEqual(c.params, background === true ? { background: "1" } : {}, String(background));
      assert.equal(c.href.includes(S.ann), false);
    }
  }
});

/* ---------------------------------------------------------------------------------------------------------------- */

/* op-declarations R58's list, as R62 and R63 shape it (K3143, K3144) admission reads (`A.reauthAsked`), for the ops declared today */
const R58 = { caseratify: null, publishat: null, publishatmove: null, ratify: null, docketpost: null, adminendorse: null,
              adminremove: null, memberset: { field: "role", values: null }, memberadd: { field: "role", values: ["admin"] },
              subscriptionsignin: { field: "step", values: ["start"] }, accountreferenceset: null, groupkeyset: null,
              projectkeyset: null, projectsigninset: null };
const ARG = { memberset: { role: "admin" }, memberadd: { role: "admin" }, subscriptionsignin: { step: "start" } };

test("R25: an act REAUTH_ACTS names, with its argument, is answered 403 with credentials' reauthDue answer (REAUTH_DUE) as it gives it unless that answer is null — refused outside the window, admitted inside it; asked of the store's reauthdue with the session's token in a header, never the address; control: an act not named, or named without its argument, is not asked", async () => {
  const open = hex64(), shut = hex64(), fOpen = hex64(), fShut = hex64();
  const caps = ["contribute", "publish", "create_projects"];
  const later = Date.now() + 5 * 60e3, gone = Date.now() - 1;
  const { env } = world({ sessions: {
    /* (R29) administrators: an administrator's own act is asked the password, a member's is refused first */
    [open]: { ...member("ann", caps), administer: true, reauthUntil: later },
    [shut]: { ...member("ann", caps), administer: true, reauthUntil: null },
    [fOpen]: { ...founder(caps), reauthUntil: later }, [fShut]: { ...founder(caps), reauthUntil: gone } } });
  const declared = Object.keys(R58).filter((k) => OPS[k]);
  assert.ok(declared.length >= 10, declared.join());
  let refusedCount = 0;
  for (const op of declared) for (const [inT, outT] of [[open, shut], [fOpen, fShut]]) {
    const extraBody = ARG[op] ?? {};
    /* inside the window: not REAUTH_DUE */
    const inside = await gate(env, { op, token: inT, extraBody, reauthActs: R58 });
    assert.notEqual(inside.refusal?.body.reason, "REAUTH_DUE", `${op}: inside`);
    /* outside: wherever the session reaches the act, REAUTH_DUE as credentials gives it, nothing of the op asked */
    env.calls.length = 0;
    const outside = await gate(env, { op, token: outT, extraBody, reauthActs: R58 });
    if (inside.caller) {
      assert.deepEqual(refused(outside, 403, "REAUTH_DUE", REAUTH_DUE_ANSWER.check, [outT]), { ...REAUTH_DUE_ANSWER }, op);
      assert.equal(opCalls(env).length, 0, `${op}: nothing of the op`);
      const asked = env.calls.filter((c) => c.route === "reauthdue");
      assert.deepEqual(asked.map((c) => [c.ns, c.href, c.headers["x-bio-session"]]), [["bio", "http://do/reauthdue", outT]]);
      refusedCount++;
    } else assert.equal(outside.refusal?.body.reason, inside.refusal?.body.reason, `${op}: an earlier gate answers first`);
  }
  assert.ok(refusedCount >= 8, String(refusedCount));
  /* order: after R11 (a session lacking the capability is told that first), and only for a session: a binding class
     the act admits is not asked (it has no password to give) */
  const bare = hex64();
  const w = world({ sessions: { [bare]: { ...member("bea", []), reauthUntil: null } } });
  assert.equal((await gate(w.env, { op: "caseratify", token: bare, reauthActs: R58 })).refusal?.body.reason,
               O.NEEDS.caseratify ? "NOT_CAPABLE" : "REAUTH_DUE");
  for (const op of declared) {
    env.calls.length = 0;
    const r = await gate(env, { op, token: env.ADMIN_TOKEN, extraBody: ARG[op] ?? {}, reauthActs: R58 });
    assert.notEqual(r.refusal?.body.reason, "REAUTH_DUE", op);
    assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 0, `${op}: a bearer is not asked`);
  }
  /* controls: an act not named, and a named act without the argument that makes it weighty, are not asked */
  for (const [op, extraBody] of [["promote", {}], ["index", {}], ["memberset", {}], ["memberset", { caps: ["publish"] }],
                                 ["memberadd", { role: "member" }], ["memberadd", {}], ["subscriptionsignin", { step: "finish" }]]) {
    if (!OPS[op]) continue;
    env.calls.length = 0;
    const r = await gate(env, { op, token: fShut, extraBody, reauthActs: R58 });
    assert.notEqual(r.refusal?.body.reason, "REAUTH_DUE", `${op} ${JSON.stringify(extraBody)}`);
    assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 0, `${op}: not asked`);
  }
  /* the argument read from the query when the body has none */
  if (OPS.memberadd) refused(await gate(env, { op: "memberadd", token: fShut, params: { role: "admin" }, reauthActs: R58 }), 403, "REAUTH_DUE", REAUTH_DUE_ANSWER.check);
});

test("R25: the store's reauthdue answered in no form credentials gives is a silence (never the window open, never a refusal about the caller); reauthAsked reads every entry shape and never throws; by default the table is op-declarations' REAUTH_ACTS", async () => {
  const shut = hex64();
  for (const bad of [() => new Response("<html>"), () => new Response(JSON.stringify({ ok: false, correlation: "0123abcd-0123-4567-89ab-0123456789ab" }), { status: 500 }),
                     () => new Response(JSON.stringify({ ok: true, result: {} })), () => new Response(JSON.stringify({ ok: true, result: { due: { ok: false, code: "OTHER" } } })),
                     () => new Response(JSON.stringify({ ok: true, result: { due: "no" } })), () => new Response(JSON.stringify({ ok: false, reason: "unknown op: reauthdue" }), { status: 404 })]) {
    const w = world({ sessions: { [shut]: founder(["contribute", "publish", "create_projects"]) }, answer: (c) => (c.route === "reauthdue" ? bad() : null) });
    const r = await gate(w.env, { op: "caseratify", token: shut, reauthActs: { caseratify: null } });
    assert.equal(r.silent?.op, "reauthdue", JSON.stringify(r).slice(0, 200));
    assert.equal(r.refusal, undefined);
  }
  /* reauthAsked: each shape; unreadable entries ask (the weighty reading); an op not named is never asked */
  const u = urlOf({ role: "admin" });
  const hostile = { get field() { throw new Error("x"); } };
  const acts = { a: null, c: { field: "role", values: null }, d: { field: "role", values: ["admin"] },
                 e: { field: "x", values: [1] }, f: hostile, g: 7, i: { values: ["admin"] } };
  assert.deepEqual(["a", "c", "d", "e", "f", "g", "i", "h"].map((op) => A.reauthAsked(acts, op, { url: urlOf({}), body: { role: "member" } })),
                   [true, true, false, false, true, true, true, false]);
  assert.equal(A.reauthAsked(acts, "d", { url: u }), true, "the query's argument when the body has none");
  assert.equal(A.reauthAsked(acts, "d", { url: u, body: { role: "member" } }), false, "the body's argument first");
  assert.equal(A.reauthAsked(acts, "c", { body: { role: "" } }), false, "an empty argument is none");
  assert.equal(A.reauthAsked(acts, "e", { body: { x: 1 } }), true, "values compared as strings");
  for (const odd of [null, undefined, 5, "x"]) assert.equal(A.reauthAsked(odd, "a", {}), false);
  assert.equal(A.reauthAsked(acts, "__proto__", {}), false);
  assert.equal(A.reauthAsked(acts, "toString", {}), false);
  /* the default table: op-declarations' own when it declares one (its R58), else none is asked */
  const { env } = world({ sessions: { [shut]: { ...founder(["contribute", "publish", "create_projects"]), reauthUntil: null } } });
  const table = O.REAUTH_ACTS;
  if (table && typeof table === "object") {
    assert.ok(Object.isFrozen(table));
    let asked = 0;
    for (const op of Object.keys(table).filter((k) => OPS[k])) {
      const withArg = await gate(env, { op, token: shut, extraBody: ARG[op] ?? {}, params: ARG[op] ?? {} });
      const viaTable = await gate(env, { op, token: shut, extraBody: ARG[op] ?? {}, params: ARG[op] ?? {}, reauthActs: table });
      assert.deepEqual(withArg.refusal?.body.reason, viaTable.refusal?.body.reason, op);
      if (withArg.refusal?.body.reason === "REAUTH_DUE") asked++;
    }
    assert.ok(asked > 0, "the declared table asks");
  } else {
    env.calls.length = 0;
    assert.notEqual((await gate(env, { op: "caseratify", token: shut })).refusal?.body.reason, "REAUTH_DUE");
    assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 0, "no table declared: nothing asked");
  }
});
