/* admission: T34's ops (N552, DEC-133; K1749, K1755) — the doors into the group (R17), the administrator's acts that
   reach membership's own refusal (R18), and the group's API key's ops, a session's only (R19). Each spec is
   op-declarations' (its R22, R24); this file holds admission's judgement of them at its interface. (T41, DEC-188 (8))
   `groupswitchset` is retired to `accountusesset` and is no longer among R19's ops (t41.test.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, urlOf, refused, opCalls, hex64, aik, cred } from "./harness.mjs";

const { OPS, SESSION_OPS, NEEDS, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS } = O;
const DOORS = ["joinlinkinvite", "websiteinvite"];
/* (N1073) read from the owners' declarations, never hand-listed: the administrator's acts are membership's session-only
   mutating ops (those carrying a machineClasses list) that every session reaches and that are neither governance nor identity acts, and the group
   key's ops are credentials' `groupkey*` ops that op-declarations declares for a session alone (R24) */
const { membershipOps } = await import("../../../src/membership/index.mjs");
const { credentialsOps } = await import("../../../src/credentials/index.mjs");
const declared = (ops) => Object.keys(ops({}, new URL("http://do/"), {}, {}));
const ADMIN_ACTS = declared(membershipOps).filter((op) => OPS[op]?.mutating && Array.isArray(OPS[op].machineClasses)
  && SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op)
  && !GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op));
const GROUP_KEY_OPS = declared(credentialsOps).filter((op) => /^groupkey/.test(op) && OPS[op]?.classes !== null);
const SECRET = "wk_" + hex64(), LINK = "jl_" + hex64(), COVER = "Rosa from the tenants' union", APIKEY = "sk-ant-api03-" + hex64();

test("R17: websiteinvite and joinlinkinvite are public ops admitted with no credential; a credential or session presented (by header or body) is neither required nor used, nothing about the caller reaches the act, the key, link and cover are read from the body only, the one limit admission adds is R21's per-source window (the daily caps are membership's), and no key, link or invitation appears in a refusal", async () => {
  assert.deepEqual([...A.PUBLIC_DOORS].sort(), DOORS);
  for (const op of DOORS) assert.equal(OPS[op]?.classes, null, `${op} is public (op-declarations R22)`);
  const { env, S, K } = world();
  const callers = [undefined, "", "garbage", env.ADMIN_TOKEN, env.MEMBER_TOKEN, env.PROBE_TOKEN, env.DAEMON_TOKEN,
                   S.founder, S.ann, S.bare, K.ann, K.confined, K.revoked, K.org, aik(), hex64()];
  for (const op of DOORS) for (const token of callers) for (const store of [undefined, "bio", "scratch"]) {
    env.calls.length = 0;
    const r = await gate(env, { op, token, params: { store, key: SECRET, link: LINK, cover: COVER, approvedBy: "Ann" } });
    assert.equal(r.public, true, `${op} admitted with ${token === undefined ? "nothing" : "a credential"}`);
    /* not used: no credential or session is looked up, no confinement is applied, and the caller's token is gone */
    assert.equal(env.calls.length, 0, `${op}: no lookup`);
    assert.equal(r.url.searchParams.has("token"), false);
    assert.equal(r.url.searchParams.get("store"), store ?? null, "the namespace named stays as named (R3), whoever calls");
    /* the body's fields only: none survives in the address */
    const own = op === "websiteinvite" ? ["key", "cover"] : ["link", "cover"];
    assert.deepEqual([...A.BODY_ONLY_FIELDS[op]].sort(), own.sort(), op);
    for (const k of own) assert.equal(r.url.searchParams.has(k), false, `${op}: ${k} not read from the query`);
    assert.equal(JSON.stringify([...r.url.searchParams]).includes(op === "websiteinvite" ? SECRET : LINK), false);
  }
  /* by header and by body too: no lookup, nothing of the caller kept */
  for (const op of DOORS) for (const via of ["header", "body"]) for (const token of [S.ann, K.ann, env.ADMIN_TOKEN]) {
    env.calls.length = 0;
    const r = await gate(env, { op, token, via });
    assert.equal(r.public, true, `${op}/${via}`);
    assert.equal(env.calls.length, 0, `${op}/${via}: no lookup`);
  }
  /* the gates themselves add no limit (the hundredth call is admitted as the first, and nothing is counted by them);
     the one limit is R21's window, which every public op meets alike (window.test.mjs), the doors among them */
  for (let i = 0; i < 100; i++) assert.equal((await gate(env, { op: "websiteinvite", token: K.confined })).public, true);
  assert.equal(env.calls.length, 0);
  for (const op of DOORS) assert.equal(OPS[op].classes, null, `${op} meets R21's window as a public op`);
  /* R1 still applies to every caller; its refusal carries no key, link, cover or credential (R15) */
  for (const op of DOORS) for (const token of [undefined, S.ann, K.ann, env.ADMIN_TOKEN]) {
    const r = await gate(env, { op, token, params: { store: "elsewhere", key: SECRET, link: LINK, cover: COVER } });
    refused(r, 400, "NAMESPACE_UNKNOWN", "C-78.1", [SECRET, LINK, COVER, token]);
  }
  /* queryGate itself: never refuses; leaves the body alone (it has none to see) */
  const u = urlOf({ op: "websiteinvite", token: S.ann, key: SECRET, store: "scratch", x: "1" });
  assert.equal(A.queryGate(u, "websiteinvite"), null);
  assert.deepEqual(Object.fromEntries(u.searchParams), { op: "websiteinvite", store: "scratch", x: "1" });
  /* negative controls: another public op keeps its caller (a confined credential meets R2), and a gated op's URL
     keeps its key, link and cover (only R20's token and secret leave every URL) */
  refused(await gate(env, { op: "invitelook", token: K.confined, params: { store: "bio" } }), 403, "NAMESPACE_CONFINED", "C-78.3");
  for (const op of ["invitelook", "index", "enroll", "groupkeystate"]) {
    const v = urlOf({ token: S.ann, secret: "rv1_x", key: SECRET, link: LINK, cover: COVER });
    A.queryGate(v, op);
    assert.deepEqual(Object.fromEntries(v.searchParams), { key: SECRET, link: LINK, cover: COVER }, op);
  }
});

test("R18: the administrator's acts op-declarations R22 declares are admitted as their specs say and reach membership, whose NOT_AN_ADMIN answers a caller who is not an administrator, a machine credential included; R12's bearer fences do not name them and admission adds no fence", async () => {
  const { env, S, K } = world();
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ tokenId: "wide", writes: ADMIN_ACTS }) } });
  for (const op of ADMIN_ACTS) {
    const spec = OPS[op];
    assert.ok(spec, `${op} declared (op-declarations R22)`);
    assert.equal(GOVERNANCE_ACTIONS.includes(op) || IDENTITY_ACTIONS.includes(op), false, op);
    /* no fence: every caller, a bearer of any class included, passes R12 */
    for (const cls of ["admin", "member", "probe", "daemon", "tomorrow"]) assert.equal(A.bearerFence(op, { cls, viaSession: false }), null);
    /* every session, an administrator's or not, a member without capabilities included, is admitted: whether it is an
       administrator is membership's to answer */
    for (const t of [S.founder, S.ann, S.bare]) {
      env.calls.length = 0;
      const r = await gate(env, { op, token: t });
      assert.ok(r.caller, `${op}: a session reaches membership`);
      assert.equal(r.caller.viaSession, true);
      assert.equal(opCalls(env).length, 0, "admission asks nothing of membership");
    }
    /* each binding class exactly as the spec's machineClasses say: admitted to reach membership's NOT_AN_ADMIN, or
       refused CLASS_FORBIDDEN by the spec (R9), never by a fence of admission's own */
    for (const [cls, t] of [["admin", env.ADMIN_TOKEN], ["probe", env.PROBE_TOKEN], ["daemon", env.DAEMON_TOKEN]]) {
      const r = await gate(env, { op, token: t, params: cls === "probe" ? { store: "scratch" } : {} });
      if (spec.machineClasses.includes(cls)) assert.deepEqual([r.caller?.cls, r.caller?.viaSession], [cls, false], `${op}/${cls}`);
      else assert.equal(refused(r, 403, "CLASS_FORBIDDEN", "C-38.2", [t]).cls, cls, `${op}/${cls}`);
    }
    /* an agent reaches nothing a member reaches only from a session (R10) */
    refused(await gate(w2.env, { op, token: wide }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [wide]);
    refused(A.aiScopeDeclaration([op]), 403, "AI_SCOPE_BEYOND_MEMBER_REACH", "C-29.9");
  }
  /* negative control: a governance act from a bearer still meets R12's fence */
  refused(await gate(env, { op: "adminendorse", token: env.ADMIN_TOKEN }), 403, "OPERATOR_TOKEN_CANNOT_GOVERN", "C-32.17");
});

test("R18 (T49; op-declarations R71, control-plane R97): founderhandleset is the founder's own session's act — read from its spec, only SESSION_OPS.admin holds it: the founder's session is admitted, a member's session (an enrolled administrator's included) is refused 403 SESSION_ROLE_CANNOT_REACH_OP naming the founder, and admission adds no fence of its own", async () => {
  const op = "founderhandleset", spec = OPS[op];
  assert.ok(spec?.mutating, `${op} is declared (op-declarations R71)`);
  assert.deepEqual([SESSION_OPS.admin.has(op), SESSION_OPS.member.has(op)], [true, false]);
  assert.equal(A.bearerFence(op, { cls: "admin", viaSession: false }), null, "no fence of admission's");
  const { env, S } = world();
  assert.ok((await gate(env, { op, token: S.founder })).caller?.viaSession, "the founder's session reaches it");
  for (const t of [S.ann, S.bare]) {
    const body = refused(await gate(env, { op, token: t }), 403, "SESSION_ROLE_CANNOT_REACH_OP", "C-38.7", [t]);
    assert.deepEqual([body.op, body.reachedBy, body.session], [op, "founder", "member"]);
    assert.equal(opCalls(env).length, 0);
  }
});

test("R19: the group key's ops are admitted only from a session — a bearer, a machine credential and an operator token are refused CLASS_FORBIDDEN naming the class, an ai credential is refused before any store call, none is on AI_GRANT_OPS; a member's session reaches credentials, which answers NOT_AN_ADMIN; groupkeyset's key is read from the body only and appears in no refusal", async () => {
  const { AI_GRANT_OPS } = await import("../../../src/credentials/index.mjs");
  const { env, S } = world();
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ tokenId: "wide", writes: GROUP_KEY_OPS }) } });
  for (const op of GROUP_KEY_OPS) {
    const spec = OPS[op];
    assert.ok(spec, `${op} declared (op-declarations R24)`);
    assert.deepEqual([[...spec.classes].sort(), spec.machineClasses], [["admin", "member"], []], op);
    assert.equal(AI_GRANT_OPS.includes(op), false, `${op} is on no ask's grant`);
    assert.equal(NEEDS[op] ?? null, null, op);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), op);
    for (const [cls, t] of [["admin", env.ADMIN_TOKEN], ["probe", env.PROBE_TOKEN], ["daemon", env.DAEMON_TOKEN]]) {
      env.calls.length = 0;
      const body = refused(await gate(env, { op, token: t, params: { key: APIKEY, ...(cls === "probe" ? { store: "scratch" } : {}) } }),
                           403, "CLASS_FORBIDDEN", "C-38.2", [t, APIKEY]);
      assert.deepEqual([body.op, body.cls], [op, cls]);
      assert.equal(env.calls.length, 0, "before any store call");
    }
    w2.env.calls.length = 0;
    refused(await gate(w2.env, { op, token: wide, params: { key: APIKEY } }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [wide, APIKEY]);
    assert.equal(opCalls(w2.env).length, 0, "before any store call");
    refused(A.aiScopeDeclaration([op]), 403, "AI_SCOPE_BEYOND_MEMBER_REACH", "C-29.9");
    /* every session reaches credentials (an administrator's or not: NOT_AN_ADMIN is credentials'); no fence here, except
       the one R29 puts before the password for an act REAUTH_ACTS names (groupkeyset): a member who is not an
       administrator is refused membership's NOT_AN_ADMIN there, the answer credentials would give, asked first */
    for (const t of [S.founder, S.admin, S.ann, S.bare]) {
      const r = await gate(env, { op, token: t, params: { key: APIKEY } });
      if (Object.hasOwn(O.REAUTH_ACTS, op) && ![S.founder, S.admin].includes(t)) {
        assert.equal(r.refusal?.body.reason, "NOT_AN_ADMIN", `${op}: R29 asks the roster first`);
        continue;
      }
      assert.equal(r.caller?.viaSession, true, `${op}: a session is admitted`);
      assert.equal(r.url.searchParams.has("token"), false, "the session's own token travels in the header, never the address");
      assert.equal(r.url.searchParams.has("key"), op !== "groupkeyset", `${op}: only groupkeyset's key is the body's`);
    }
    assert.equal(A.bearerFence(op, { cls: "admin", viaSession: false }), null);
  }
  /* the key in the query is gone before any reader: the call then carries no key and credentials answers NO_SECRET */
  const r = await gate(env, { op: "groupkeyset", token: S.founder, params: { key: APIKEY } });
  assert.equal(JSON.stringify([...r.url.searchParams]).includes(APIKEY), false);
  /* negative control: the same request with no key in its query keeps its URL whole */
  const n = await gate(env, { op: "groupkeyset", token: S.founder, params: { on: "true" } });
  assert.deepEqual(Object.fromEntries(n.url.searchParams), { on: "true" });
});
