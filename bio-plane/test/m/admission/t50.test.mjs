/* admission: T50-79 (N1179, N1186; K3747, K3557; credentials R79; membership R84, R149; op-declarations R58, R62) —
   R29 the administrator is asked first, and R30 an AI caller is seen with its project. R31 is words.test.mjs'. Each test
   drives admission at its interface, with a control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, refused, opCalls, member, founder, hex64, aik, cred, doAnswer, presenting, REAUTH_DUE_ANSWER } from "./harness.mjs";
import { projectViewer, viewerPredicate, notAnAdmin } from "../../../src/membership/index.mjs";
import { world as membershipWorld, V } from "../membership/fixture.mjs";

const { OPS, REAUTH_ACTS, GOVERNANCE_ACTIONS, CUSTODIAL_ACTIONS, OP_FAMILIES } = O;
const CAPS = ["contribute", "publish", "create_projects"];
/* the check id is membership's row, read from its own answer */
const NOT_AN_ADMIN_CHECK = notAnAdmin("x", "y").check;
const ARG = { memberset: { role: "admin" }, memberadd: { role: "admin" }, subscriptionsignin: { step: "start" } };

/* the administrator's own acts, read from op-declarations as R29 states them (its governance and custodial acts and its
   kinds admin and roster), then those REAUTH_ACTS names */
function administratorsOwn() {
  const own = new Set([...GOVERNANCE_ACTIONS, ...CUSTODIAL_ACTIONS]);
  for (const f of Object.values(OP_FAMILIES))
    for (const [op, kind] of Object.entries(f.kinds)) if (kind === "admin" || kind === "roster") own.add(op);
  return own;
}

test("R29: an administrator's own act REAUTH_ACTS names, asked by a member session that is not an administrator whose password window is old, is refused 403 NOT_AN_ADMIN (membership's one answer) with the password never asked; by an administrator whose window is old, REAUTH_DUE; the acts are read from the declarations, five today", async () => {
  const old = hex64(), oldAdmin = hex64(), oldFounder = hex64(), open = hex64();
  const { env } = world({ sessions: {
    [old]: { ...member("cal", CAPS), reauthUntil: null },
    [oldAdmin]: { ...member("ada", CAPS), administer: true, reauthUntil: null },
    [oldFounder]: { ...founder(CAPS), reauthUntil: Date.now() - 1 },
    [open]: { ...member("cal", CAPS), reauthUntil: Date.now() + 60e3 } } });
  const own = administratorsOwn();
  const acts = Object.keys(REAUTH_ACTS).filter((op) => OPS[op] && own.has(op)).sort();
  assert.equal(acts.length, 5, "five administrator acts today, read from the declarations");
  for (const op of acts) {
    const extraBody = ARG[op] ?? {};
    /* the member, window old or open: NOT_AN_ADMIN, nothing asked of the store about the password or the op */
    for (const token of [old, open]) {
      env.calls.length = 0;
      const r = await gate(env, { op, token, extraBody });
      const body = refused(r, 403, "NOT_AN_ADMIN", NOT_AN_ADMIN_CHECK, [token]);
      assert.equal(body.by, "cal", `${op}: the member asked`);
      assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 0, `${op}: the password is not asked`);
      assert.equal(opCalls(env).length, 0, `${op}: nothing of the op`);
    }
    /* the administrators, window old: REAUTH_DUE as R25 states; window open (control): admitted */
    for (const token of [oldAdmin, oldFounder]) {
      env.calls.length = 0;
      refused(await gate(env, { op, token, extraBody }), 403, "REAUTH_DUE", REAUTH_DUE_ANSWER.check, [token]);
      assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 1, `${op}: the password is asked once`);
    }
  }
});

test("R29 controls: an act REAUTH_ACTS names that is not an administrator's (caseratify, publishat) still answers REAUTH_DUE to a member whose session is old; an administrator-only act REAUTH_ACTS does not name is unchanged; memberadd with another role is not asked; a bearer is not a session", async () => {
  const old = hex64();
  const { env } = world({ sessions: { [old]: { ...member("cal", CAPS), reauthUntil: null } } });
  const own = administratorsOwn();
  const notOwn = Object.keys(REAUTH_ACTS).filter((op) => OPS[op] && !own.has(op) && OPS[op].mutating);
  assert.ok(notOwn.includes("caseratify") && notOwn.includes("publishat"), notOwn.join());
  for (const op of ["caseratify", "publishat"]) {
    const r = await gate(env, { op, token: old, extraBody: ARG[op] ?? {} });
    assert.equal(r.refusal?.body.reason, "REAUTH_DUE", op);
    assert.notEqual(r.refusal?.body.reason, "NOT_AN_ADMIN", op);
  }
  /* an administrator-only act REAUTH_ACTS does not name: admission adds nothing, the owner's own refusal answers */
  const notNamed = [...own].filter((op) => OPS[op]?.mutating && !Object.hasOwn(REAUTH_ACTS, op) && OPS[op].classes.includes("member"));
  assert.ok(notNamed.length > 5, "there are administrators' acts REAUTH_ACTS does not name");
  for (const op of notNamed) {
    env.calls.length = 0;
    const r = await gate(env, { op, token: old });
    assert.notEqual(r.refusal?.body.reason, "NOT_AN_ADMIN", `${op}: unchanged, the owner answers`);
    assert.notEqual(r.refusal?.body.reason, "REAUTH_DUE", op);
    assert.equal(env.calls.filter((c) => c.route === "reauthdue").length, 0, `${op}: not asked`);
  }
  /* memberadd with a role that does not make the act weighty is not asked, so it is the owner's to refuse */
  const r = await gate(env, { op: "memberadd", token: old, extraBody: { role: "member" } });
  assert.notEqual(r.refusal?.body.reason, "NOT_AN_ADMIN");
  assert.notEqual(r.refusal?.body.reason, "REAUTH_DUE");
  /* a bearer arriving by no session is not asked by R29 either: the fences and class lists answer as before */
  for (const op of ["adminendorse", "groupkeyset"]) {
    const b = await gate(env, { op, token: env.ADMIN_TOKEN, extraBody: ARG[op] ?? {} });
    assert.notEqual(b.refusal?.body.reason, "NOT_AN_ADMIN", op);
  }
  /* the set is read from the declarations: a table handed in that names an administrator's act the declarations do not
     hold in REAUTH_ACTS is covered with no change here (memberremove-style op: any roster/admin-kind op named) */
  const rosterOp = [...own].find((op) => OPS[op]?.mutating && !Object.hasOwn(REAUTH_ACTS, op) && OPS[op].classes.includes("member"));
  const r2 = await gate(env, { op: rosterOp, token: old, reauthActs: { ...REAUTH_ACTS, [rosterOp]: null } });
  assert.equal(r2.refusal?.body.reason, "NOT_AN_ADMIN", `${rosterOp}: named in REAUTH_ACTS, covered`);
});

/* A, B discoverable projects, each with a record of its own; LOOSE belongs to no project. `second` is an active
   administrator in neither (membership R149's own fixture). */
async function twoProjects() {
  const w = await membershipWorld().group("ann", "cal");
  for (const [p, rec] of [["PROJ-A", "REC-A"], ["PROJ-B", "REC-B"]]) {
    w.project(p);
    w.bundle(rec, "information", `record of ${p}`, p);
    w.m.projectClaimOwner({ projectId: p, memberId: "ann" });
    w.m.projectVisibilitySet({ projectId: p, setting: "discoverable", by: "ann", viewer: V("ann") });
  }
  w.bundle("LOOSE");
  return w;
}
const sees = (w, viewer) => {
  const g = viewerPredicate(typeof viewer === "object" ? viewer.stamp : viewer);
  return w.rows(`SELECT b.bundle_id FROM bundles b WHERE ${g.sql} ORDER BY b.bundle_id`, ...g.args).map((r) => r.bundle_id);
};

test("R30: callerViewer and readerOf answer an ai caller the viewer its credential carries with its project (membership.projectViewer), so it sees a record of A and not a record of project B that its member sees; a credential with no project sees both; a session's viewer is as before", async () => {
  const w = await twoProjects();
  const inA = aik(), none = aik(), plainRow = aik();
  const { env, S } = world({ creds: {
    /* what credentials.aiCredentialLook answers for a credential minted in project A (its R79) */
    [inA]: cred({ tokenId: "agent-a", principal: projectViewer("member:ann", "PROJ-A"), project: "PROJ-A" }),
    [none]: cred({ tokenId: "agent-none", principal: "member:ann" }),
    /* a row whose principal came without its project is not read wider than the project it names */
    [plainRow]: cred({ tokenId: "agent-plain", principal: "member:ann", project: "PROJ-A" }) } });
  const viewerOf = async (token, opts) => A.callerViewer((await gate(env, { op: "index", token, method: "GET" })).caller, opts);
  const readerOf = async (token) => (await A.readerOf(new URL("https://plane.example/api"), env, "bio", undefined,
    doAnswer, presenting(token))).viewer;

  for (const token of [inA, plainRow]) {
    const carried = await viewerOf(token);
    assert.equal(carried.stamp, projectViewer("member:ann", "PROJ-A"));
    assert.equal(carried.aiCred.project, "PROJ-A", "the credential still rides beside the viewer");
    assert.equal(await viewerOf(token, { carry: false }), projectViewer("member:ann", "PROJ-A"));
    assert.equal(await readerOf(token), projectViewer("member:ann", "PROJ-A"));
    assert.deepEqual(sees(w, carried), ["PROJ-A", "REC-A"], "a record of A, and not B's that the member sees");
    assert.equal(w.m.inSight("REC-B", carried.stamp), false);
  }
  /* controls: no project, the plain principal's viewer, sees B and the loose record too */
  const plain = await viewerOf(none);
  assert.equal(plain.stamp, "member:ann");
  assert.equal(await readerOf(none), "member:ann");
  assert.ok(sees(w, plain).includes("REC-B") && sees(w, plain).includes("LOOSE"));
  assert.equal(w.m.inSight("REC-B", plain.stamp), true);
  /* controls: a session's viewer is the same as before, whatever the credentials do */
  assert.equal(await viewerOf(S.ann), "member:ann");
  assert.equal(await readerOf(S.ann), "member:ann");
  assert.equal(await viewerOf(S.founder), "admin");
  /* an organisation key (class:ai) with a project is not narrowed (R149 leaves a viewer that names no member alone) */
  assert.equal(A.aiViewerOf({ principal: "class:ai", project: "PROJ-A" }), "class:ai");
  /* the viewer is never re-scoped: a principal already carrying a project keeps it */
  assert.equal(A.aiViewerOf({ principal: projectViewer("member:ann", "PROJ-A"), project: "PROJ-B" }), projectViewer("member:ann", "PROJ-A"));
});
