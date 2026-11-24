/* admission: the admission, in its order (R8–R12). Carries the converts `adminvote` (the governorconfig sentence),
   `aicredential` (AI_BEYOND_TASK_SCOPE's fields), `project-mint` and `d526-refusal-order` (NOT_CAPABLE for a project's
   creation), `operator-attest`, `risk-tier` and `livefire` (a bearer reaches the op as not a session, its class named). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, refused, opCalls, hex64, aik, cred, member, arranged } from "./harness.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS } = O;
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);
const SESSION_CODES = ["SESSION_ROLE_CANNOT_REACH_OP", "MACHINE_CREDENTIAL_REQUIRED", "SESSION_ROUTE_NOT_RECORDED"];

test("R8: a session reaching a mutating op outside its kind's set is refused 403 by why — SESSION_ROLE_CANNOT_REACH_OP (C-38.7) naming reachedBy, MACHINE_CREDENTIAL_REQUIRED (C-38.3) citing the decision, SESSION_ROUTE_NOT_RECORDED (C-38.8); capture's GET is a read; export is reached by the ADMIN_TOKEN bearer and the founder's session alone, and every other session is refused ROOT_OF_TRUST_REQUIRED (C-38.4)", async () => {
  const { env, S } = world();
  /* the founder's set alone (export apart: its own refusal, below): a member's session is told the founder's session reaches it */
  const onlyAdmin = GATED.filter((k) => OPS[k].mutating && k !== "export" && SESSION_OPS.admin.has(k) && !SESSION_OPS.member.has(k));
  assert.ok(onlyAdmin.includes("governorconfig"));
  for (const op of onlyAdmin) {
    env.calls.length = 0;
    const body = refused(await gate(env, { op, token: S.ann }), 403, "SESSION_ROLE_CANNOT_REACH_OP", "C-38.7", [S.ann]);
    assert.deepEqual([body.reachedBy, body.session, body.op], ["founder", "member", op]);
    assert.equal(opCalls(env).length, 0);
    assert.ok(!SESSION_CODES.includes((await gate(env, { op, token: S.founder })).refusal?.body.reason), `${op}: founder admitted`);
  }
  /* adminvote: governorconfig names the founder's session, and an enrolled administrator's session (a member's) is refused it alike */
  const gc = (await gate(env, { op: "governorconfig", token: S.ann })).refusal.body;
  assert.deepEqual([gc.reachedBy, gc.session, gc.op], ["founder", "member", "governorconfig"]);
  /* the member's set alone: no declared op is there today, so the tables are arranged so (a copy, never the frozen ones) */
  const memberOnly = arranged((m, a) => a.delete("lease"));
  {
    const body = refused(await gate(env, { op: "lease", token: S.founder, tables: memberOnly }), 403, "SESSION_ROLE_CANNOT_REACH_OP", "C-38.7");
    assert.deepEqual([body.reachedBy, body.session], ["member", "admin"]);
    assert.ok(!SESSION_CODES.includes((await gate(env, { op: "lease", token: S.ann, tables: memberOnly })).refusal?.body.reason));
  }
  /* a recorded decision, each cited, to both kinds */
  for (const [op, recorded] of Object.entries(UNATTENDED_BY_DECISION)) for (const t of [S.ann, S.founder]) {
    const body = refused(await gate(env, { op, token: t }), 403, "MACHINE_CREDENTIAL_REQUIRED", "C-38.3");
    assert.equal(body.recorded, recorded);
  }
  /* no decision recorded: purge, which no session set holds, with its decision removed from an arranged copy */
  const undecided = arranged((m, a, d) => { delete d.purge; });
  for (const kind of ["member", "admin"]) {
    const body = refused({ refusal: A.sessionOpGate(kind, "purge", OPS.purge, "POST", undecided) }, 403, "SESSION_ROUTE_NOT_RECORDED", "C-38.8");
    assert.deepEqual([body.recorded, body.op], [undefined, "purge"]);
  }
  refused(await gate(env, { op: "purge", token: S.ann, tables: arranged((m, a, d) => { delete d.purge; }) }), 403, "SESSION_ROUTE_NOT_RECORDED", "C-38.8");
  refused({ refusal: A.sessionOpGate("member", "nosuchverb", { mutating: true }, "POST") }, 403, "SESSION_ROUTE_NOT_RECORDED", "C-38.8");
  /* every mutating gated op, for both kinds: refused exactly when its kind's set lacks it, by the right code */
  for (const op of GATED.filter((k) => OPS[k].mutating && k !== "export")) for (const [kind, t] of [["member", S.ann], ["admin", S.founder]]) {
    const code = (await gate(env, { op, token: t })).refusal?.body.reason;
    const want = SESSION_OPS[kind].has(op) ? null
      : SESSION_OPS[kind === "member" ? "admin" : "member"].has(op) ? "SESSION_ROLE_CANNOT_REACH_OP"
      : UNATTENDED_BY_DECISION[op] ? "MACHINE_CREDENTIAL_REQUIRED" : "SESSION_ROUTE_NOT_RECORDED";
    if (want) assert.equal(code, want, `${op}/${kind}`);
    else assert.ok(!SESSION_CODES.includes(code), `${op}/${kind}`);
  }
  /* every non-mutating op passes this gate */
  for (const op of GATED.filter((k) => !OPS[k].mutating))
    assert.ok(!SESSION_CODES.includes((await gate(env, { op, token: S.ann, method: "GET" })).refusal?.body.reason), op);
  /* capture's GET is a read (the tables arranged so no session set holds capture) */
  const noCapture = arranged((m, a) => { m.delete("capture"); a.delete("capture"); });
  assert.ok((await gate(env, { op: "capture", token: S.ann, method: "GET", tables: noCapture })).caller);
  refused(await gate(env, { op: "capture", token: S.ann, method: "POST", tables: noCapture }), 403, "SESSION_ROUTE_NOT_RECORDED", "C-38.8");
  /* export (R8; Membership v2 §4.6): the root of trust has two forms, the ADMIN_TOKEN holder's bearer and the founder's
     session. Every other session, an enrolled administrator's included, is refused ROOT_OF_TRUST_REQUIRED. */
  assert.ok(SESSION_OPS.admin.has("export") && !SESSION_OPS.member.has("export"));
  for (const t of [S.ann, S.admin, S.bare]) {
    env.calls.length = 0;
    const body = refused(await gate(env, { op: "export", token: t }), 403, "ROOT_OF_TRUST_REQUIRED", "C-38.4", [t]);
    assert.equal(body.op, "export");
    assert.equal(opCalls(env).length, 0);
  }
  for (const t of [S.founder, env.ADMIN_TOKEN]) {
    const got = await gate(env, { op: "export", token: t });
    assert.equal(got.refusal, undefined, "the founder's session and the ADMIN_TOKEN bearer reach export");
    assert.equal(got.caller.cls, "admin");
  }
  assert.equal((await gate(env, { op: "export", token: S.founder })).caller.viaSession, true);
  /* every other credential is refused: the member's key is retired, the probe and daemon bindings are not export's class */
  assert.equal((await gate(env, { op: "export", token: env.MEMBER_TOKEN })).refusal.body.reason, "MEMBER_TOKEN_RETIRED");
  for (const t of [env.PROBE_TOKEN, env.DAEMON_TOKEN])
    assert.equal((await gate(env, { op: "export", token: t })).refusal.body.reason, "CLASS_FORBIDDEN");
});

test("R9: a binding class not in the op's classes is refused 403 CLASS_FORBIDDEN (C-38.2); a caller not arriving by a session is judged by machineClasses where the spec gives it", async () => {
  const { env, S } = world();
  /* the three binding classes (R5, T36: no member binding exists) */
  const bindings = { admin: env.ADMIN_TOKEN, probe: env.PROBE_TOKEN, daemon: env.DAEMON_TOKEN };
  for (const op of GATED) {
    const spec = OPS[op];
    for (const [c, token] of Object.entries(bindings)) {
      const r = await gate(env, { op, token, params: c === "probe" ? { store: "scratch" } : {} });
      const admitted = (Array.isArray(spec.machineClasses) ? spec.machineClasses : spec.classes).includes(c);
      if (admitted) assert.notEqual(r.refusal?.body.reason, "CLASS_FORBIDDEN", `${op}/${c}`);
      else {
        const body = refused(r, 403, "CLASS_FORBIDDEN", "C-38.2", [token]);
        assert.deepEqual([body.op, body.cls], [op, c]);
      }
    }
  }
  /* a session is judged by classes, not machineClasses */
  const mc = GATED.filter((k) => Array.isArray(OPS[k].machineClasses) && OPS[k].classes.includes("member")
                               && !OPS[k].machineClasses.includes("member") && SESSION_OPS.member.has(k));
  assert.ok(mc.includes("memberadd"));
  for (const op of mc) {
    for (const [c, token] of Object.entries(bindings).filter(([c]) => !OPS[op].machineClasses.includes(c)))
      assert.equal((await gate(env, { op, token, params: c === "probe" ? { store: "scratch" } : {} })).refusal?.body.reason, "CLASS_FORBIDDEN", `${op}/${c}`);
    assert.notEqual((await gate(env, { op, token: S.ann })).refusal?.body.reason, "CLASS_FORBIDDEN", op);
  }
  /* a session whose kind the op's classes lack (a read, past R8) */
  for (const op of GATED.filter((k) => !OPS[k].mutating && !OPS[k].classes.includes("member")))
    refused(await gate(env, { op, token: S.ann, method: "GET" }), 403, "CLASS_FORBIDDEN", "C-38.2");
  /* operator-attest, risk-tier, livefire: a bearer the row admits reaches the op as not a session, its class named */
  for (const op of ["ratify", "caseratify", "promote"]) for (const c of ["admin", "probe"]) {
    const r = await gate(env, { op, token: bindings[c], params: c === "probe" ? { store: "scratch" } : {} });
    assert.deepEqual([r.caller.cls, r.caller.viaSession, r.caller.member, r.caller.caps], [c, false, null, null], `${op}/${c}`);
  }
  const lf = await gate(env, { op: "livefire", token: env.PROBE_TOKEN });
  assert.deepEqual([lf.caller.cls, lf.caller.storeName], ["probe", "scratch"]);
});

test("R10: an ai caller is refused AI_CREDENTIAL_REVOKED (C-29.7) when its credential is withdrawn, and AI_BEYOND_TASK_SCOPE (C-29.6) when no member reaches the op or the op is mutating and not among its declared writes", async () => {
  const { env, K } = world();
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ tokenId: "wide", taskScope: "everything", writes: GATED }) } });
  for (const op of GATED) {
    const reach = A.aiReachesAsMember(OPS[op], op);
    if (GOVERNANCE_ACTIONS.includes(op) || IDENTITY_ACTIONS.includes(op)) assert.equal(reach, false, `${op}: D-586`);
    if (!OPS[op].classes.includes("member") || Array.isArray(OPS[op].machineClasses)) assert.equal(reach, false, op);
    for (const [e, token, c] of [[env, K.ann, cred({ tokenId: "agent-ann", writes: [] })], [w2.env, wide, cred({ tokenId: "wide", taskScope: "everything", writes: GATED })]]) {
      e.calls.length = 0;
      const r = await gate(e, { op, token });
      if (!reach || ((OPS[op].mutating || ["sourceof", "sourcerung"].includes(op)) && !c.writes.includes(op))) { /* R26 amends R10: who a source is needs a declared scope too */
        const body = refused(r, 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [token]);
        /* aicredential: the refusal names the op, the class, the credential, its task scope and its declared writes */
        assert.deepEqual([body.op, body.cls, body.tokenId, body.taskScope, body.declared], [op, "ai", c.tokenId, c.taskScope, c.writes]);
        assert.equal(opCalls(e).length, 0);
      } else assert.ok(!String(r.refusal?.body.reason).startsWith("AI_"), `${op}: admitted`);
    }
  }
  assert.equal(A.aiReachesAsMember(undefined, "index"), false);
  assert.equal(A.aiReachesAsMember({ classes: null }, "knock"), false);
  const body = refused(await gate(env, { op: "index", token: K.revoked, method: "GET" }), 403, "AI_CREDENTIAL_REVOKED", "C-29.7", [K.revoked]);
  assert.deepEqual([body.tokenId, body.revokedAt, body.op, body.cls], ["agent-old", "2026-09-01", "index", "ai"]);
  /* negative control: the same op for a live credential; its viewer is its principal */
  assert.equal((await gate(env, { op: "index", token: K.ann, method: "GET" })).caller.cls, "ai");
  assert.deepEqual(A.aiTaskScope(cred({ principal: "member:ann" }), "index", OPS.index), { ok: true, viewer: "member:ann" });
});

test("R11: a session missing the op's capability is refused 403 NOT_CAPABLE (C-38.5) naming needs and held; a binding class holds no capabilities and is bounded by R9 alone; a session creating a project without create_projects is refused the same", async () => {
  const lack = hex64(), some = hex64();
  const { env, S } = world({ sessions: { [lack]: member("bea", []), [some]: member("cy", ["publish", "contribute"]) } });
  const needing = GATED.filter((k) => NEEDS[k] && (SESSION_OPS.member.has(k) || !OPS[k].mutating) && OPS[k].classes.includes("member"));
  assert.ok(needing.length > 5);
  for (const op of needing) {
    env.calls.length = 0;
    const body = refused(await gate(env, { op, token: lack }), 403, "NOT_CAPABLE", "C-38.5", [lack]);
    assert.deepEqual([body.op, body.needs, body.held], [op, NEEDS[op], []]);
    assert.equal(opCalls(env).length, 0);
    assert.notEqual((await gate(env, { op, token: S.ann })).refusal?.body.reason, "NOT_CAPABLE", op);
    const bound = await gate(env, { op, token: env.ADMIN_TOKEN });
    assert.notEqual(bound.refusal?.body.reason, "NOT_CAPABLE", op);
    if (bound.caller) assert.equal(bound.caller.caps, null, "a binding class holds no capabilities");
  }
  const cp = needing.find((k) => NEEDS[k] === "create_projects");
  if (cp) assert.deepEqual(refused(await gate(env, { op: cp, token: some }), 403, "NOT_CAPABLE", "C-38.5").held, ["contribute", "publish"]);
  /* capture's GET is a read here too */
  assert.ok((await gate(env, { op: "capture", token: lack, method: "GET" })).caller);
  refused(await gate(env, { op: "capture", token: lack }), 403, "NOT_CAPABLE", "C-38.5");
  /* project-mint, d526: a creation without create_projects, from the session's own set, whatever NEEDS says of promote */
  const cy = (await gate(env, { op: "promote", token: some })).caller;
  const body = refused({ refusal: A.projectCreationGate(cy.caps) }, 403, "NOT_CAPABLE", "C-38.5");
  assert.deepEqual([body.op, body.needs, body.held], ["promote", "create_projects", ["contribute", "publish"]]);
  assert.equal(body.translation, refused(await gate(env, { op: "promote", token: lack }), 403, "NOT_CAPABLE", "C-38.5").translation,
               "one row, one sentence, for both conditions");
  assert.equal(A.projectCreationGate((await gate(env, { op: "promote", token: S.ann })).caller.caps), null);
});

test("R12: a bearer asking adminendorse, adminremove or membercaps is refused 403 OPERATOR_TOKEN_CANNOT_GOVERN (C-32.17); groupnameset or groupdomainset GROUP_IDENTITY_NEEDS_SESSION (C-64.4); each names the class", async () => {
  const { env, S } = world();
  /* (N1073) the acts are op-declarations' own declaration (GOVERNANCE_ACTIONS, IDENTITY_ACTIONS), read here, not hand-listed */
  for (const op of [...GOVERNANCE_ACTIONS, ...IDENTITY_ACTIONS]) assert.ok(OPS[op]?.mutating, `${op} is a declared write`);
  assert.ok(GOVERNANCE_ACTIONS.length > 0 && IDENTITY_ACTIONS.length > 0);
  const bearers = { admin: env.ADMIN_TOKEN, probe: env.PROBE_TOKEN };
  for (const [op, code, check] of [...GOVERNANCE_ACTIONS.map((o) => [o, "OPERATOR_TOKEN_CANNOT_GOVERN", "C-32.17"]),
                                   ...IDENTITY_ACTIONS.map((o) => [o, "GROUP_IDENTITY_NEEDS_SESSION", "C-64.4"])]) {
    for (const [c, token] of Object.entries(bearers)) {
      const body = refused(await gate(env, { op, token, params: c === "probe" ? { store: "scratch" } : {} }), 403, code, check, [token]);
      assert.deepEqual([body.op, body.tokenClass], [op, c]);
    }
    /* the class is asked of how the caller arrived, never of a list: a class added tomorrow is refused too */
    assert.equal(A.bearerFence(op, { cls: "tomorrow", viaSession: false }).body.reason, code);
    /* negative control: the same act from a signed-in session passes the fence */
    for (const t of [S.founder, S.admin]) assert.ok((await gate(env, { op, token: t })).caller, op);
  }
  for (const op of ["index", "promote", "memberadd"]) assert.equal(A.bearerFence(op, { cls: "admin", viaSession: false }), null);
});

test("R5–R12, R20: the admission runs in one order — R1, R20's address gate, R6's agent lookup, R2, R3, the public ops, then the class with R8's session gate, R7, R10 or R9, R11, R4's scope refusal, then R12 — and stops at the first refusal", async () => {
  const { env, S, K } = world();
  const code = async (req) => (await gate(env, { ...req })).refusal?.body.reason;
  /* R1 before the credential is looked up */
  env.calls.length = 0;
  assert.equal(await code({ op: "index", token: K.confined, params: { store: "nope" } }), "NAMESPACE_UNKNOWN");
  assert.equal(await code({ op: "index", token: K.confined, via: "query", params: { store: "nope" } }), "NAMESPACE_UNKNOWN");
  assert.equal(env.calls.length, 0);
  /* R20 after R1 and before the lookup, the confinement, the pin, the public ops and the admission */
  for (const op of ["index", "knock", "websiteinvite", "adminendorse"])
    assert.equal(await code({ op, token: K.confined, via: "query", params: { store: "bio" } }), "CREDENTIAL_IN_ADDRESS", op);
  assert.equal(env.calls.length, 0);
  /* R2 before R3 (the confined credential set to scratch, the pinned public op refuses), and before admission */
  assert.equal(await code({ op: "knock", token: K.confined }), "NAMESPACE_PINNED");
  assert.equal(await code({ op: "knock", token: K.confined, params: { store: "bio" } }), "NAMESPACE_CONFINED");
  assert.equal(await code({ op: "index", token: K.revoked.replace(/.$/, (c) => (c === "0" ? "1" : "0")), params: {} }), "NOT_AUTHENTICATED");
  /* the public ops before R5–R7: an unknown token does not stop one */
  assert.equal((await gate(env, { op: "knock", token: "garbage" })).public, true);
  /* R8 before R9: a member session asking a founder-only op whose classes also lack member */
  const both = GATED.find((k) => OPS[k].mutating && k !== "export" && SESSION_OPS.admin.has(k) && !SESSION_OPS.member.has(k) && !OPS[k].classes.includes("member"));
  assert.equal(await code({ op: both, token: S.ann }), "SESSION_ROLE_CANNOT_REACH_OP");
  /* export's refusal before R9 and R11 for a session lacking every capability */
  assert.equal(await code({ op: "export", token: S.bare }), "ROOT_OF_TRUST_REQUIRED");
  /* R9 before R4's scope refusal: probe asking an op it lacks, in bio */
  const notProbe = GATED.find((k) => !OPS[k].classes.includes("probe") && OPS[k].classes.includes("member") && OPS[k].classes.includes("admin")
                                    && !Array.isArray(OPS[k].machineClasses));
  assert.equal(await code({ op: notProbe, token: env.PROBE_TOKEN, params: { store: "bio" } }), "CLASS_FORBIDDEN");
  /* R10 before R12: an agent declaring a governance act; R9 before R12: the daemon */
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ writes: [...GOVERNANCE_ACTIONS] }) } });
  assert.equal((await gate(w2.env, { op: "adminendorse", token: wide })).refusal.body.reason, "AI_BEYOND_TASK_SCOPE");
  assert.equal(await code({ op: "adminendorse", token: env.DAEMON_TOKEN }), "CLASS_FORBIDDEN");
  /* R11 before R4 and R12 */
  assert.equal(await code({ op: "promote", token: S.bare }), "NOT_CAPABLE");
  /* R4 before R12 */
  assert.equal(await code({ op: "adminendorse", token: env.PROBE_TOKEN, params: { store: "bio" } }), "SCOPE_REFUSED");
  /* negative controls: each with its first failing condition removed meets the next gate */
  assert.equal(await code({ op: "adminendorse", token: env.PROBE_TOKEN, params: { store: "scratch" } }), "OPERATOR_TOKEN_CANNOT_GOVERN");
  assert.ok((await gate(env, { op: notProbe, token: env.ADMIN_TOKEN, params: { store: "bio" } })).caller);
});
