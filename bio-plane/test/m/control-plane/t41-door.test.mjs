/* T41's door (T41-62): R56's retired switches, R69's account and AI-use ops, R70's handle routes, R71's investigation
   routes and a capture's step, R72's upload, R73's promotion fields, and K2442's roster viewer. Each with a negative
   control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { O, world, call, opCalls, FORGED, aik, cred } from "./harness.mjs";
import { callers, ok, routesForSessions } from "./door-routes.mjs";
import { ownerOps as controlPlaneOwnerOps } from "../../../src/store-assembly/owner-ops.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { T41_RUNGS, T41_RUNG_ABSENT, T41_NON_ACTS } from "../../../src/op-grades/t41.mjs";

const { OPS } = O;
const SHA = "a".repeat(64);

test("R56 (DEC-188 (8); credentials R37): `groupswitchset` and `accountswitchset` are answered as ops with no spec, for every caller and whatever any table holds, and nothing reaches a store (negative control: `accountusesset`, R69, is routed)", async () => {
  const { w, sessions, machines } = callers({ answer: (c) => (c.route === "accountusesset" ? ok({ ok: true }) : null) });
  for (const op of ["groupswitchset", "accountswitchset"])
    for (const c of [...sessions, ...machines, { name: "none" }]) {
      w.env.calls.length = 0;
      const r = await call(w.env, { op, token: c.token, method: "POST", params: c.params ?? {},
                                    body: { switch: "suggestions", on: true } });
      assert.deepEqual([r.status, r.json.ok, r.json.reason, r.json.error], [400, false, "UNKNOWN_OP", "unknown op"], `${op}/${c.name}`);
      assert.deepEqual(opCalls(w.env), [], `${op}/${c.name}: no store request`);
    }
  w.env.calls.length = 0;
  const r = await call(w.env, { op: "accountusesset", token: w.S.ann, method: "POST",
                                body: { owner: "member:ann", switch: "suggestions", on: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(opCalls(w.env).filter((c) => c.route === "accountusesset").length, 1);
});

/* credentials' project-account ops and ai-use's `aiUseOps`, read from their owners' maps: the ops ai-use's map serves and
   those of credentials' that the T41 grades (R69's), a member's session alone reaching them */
const T41_GRADED = new Set([...Object.keys(T41_RUNGS), ...Object.keys(T41_RUNG_ABSENT), ...Object.keys(T41_NON_ACTS)]);
const sessionOnly = (op) => OPS[op]?.machineClasses?.length === 0;
const kindsOf = (...owners) => owners.flatMap((o) => Object.keys(O.OP_FAMILIES[o].kinds));
const R69_OPS = [...Object.keys(aiAccountsOps(null, new URL("http://do/"), null, {})).filter((op) => T41_GRADED.has(op)),
                 ...Object.keys(aiUseOps(null, new URL("http://do/"), null))].filter(sessionOnly);

test("R69 (op-declarations R41; K2373, K2488): credentials' project-account ops and ai-use's `aiUseOps` reach their owners' maps for a member's session only, each declared stamp from the session and none from the caller; every machine credential is refused before any store request", async () => {
  await routesForSessions(R69_OPS, (op) => ({ project: "prj-1", owner: "project:prj-1",
                                              ...(op === "projectkeyset" ? { key: "sk-body-key" } : {}) }));
});

test("R69, R30 (credentials R54): a project key passes from the body alone: one in the address never reaches the store's address or body, the body's reaches the owner, and no answer echoes either (negative control: the body's key is passed)", async () => {
  const { env, S } = world({ answer: (c) => (c.route === "projectkeyset" ? ok({ ok: true, project: "prj-1", account: "api_key" }) : null) });
  const r = await call(env, { op: "projectkeyset", token: S.ann, method: "POST", params: { key: "sk-in-the-address" },
                              body: { project: "prj-1", key: "sk-in-the-body" } });
  assert.equal(r.status, 200, r.text);
  const [inner] = opCalls(env).filter((c) => c.route === "projectkeyset");
  assert.equal(Object.hasOwn(inner.params, "key"), false, "no key in the store's address");
  assert.equal(inner.url.search.includes("sk-in"), false);
  assert.equal(inner.body.key, "sk-in-the-body", "negative control: the body's key reaches the owner");
  assert.equal(r.text.includes("sk-in-the-body") || r.text.includes("sk-in-the-address"), false, "no answer carries the key");
});

test("R69 (K2373): a stamp the caller sends with an AI-use op is not taken: `by` on `ailimitset` and `viewer` on `ailimits` are the session's (negative control: a body's `owner`, which is no stamp, reaches the owner)", async () => {
  const { env, S } = world();
  await call(env, { op: "ailimitset", token: S.ann, method: "POST", params: { by: FORGED, viewer: FORGED },
                    body: { owner: "member:ann", by: FORGED, scope: "all", unit: "calls", period: "day", amount: 3 } });
  const [set] = opCalls(env).filter((c) => c.route === "ailimitset");
  assert.equal(set.params.by, "member:ann");
  assert.equal(Object.hasOwn(set.body, "by"), false, "the body's `by` is deleted");
  assert.equal(set.body.owner, "member:ann", "negative control: a request field is passed");
  env.calls.length = 0;
  await call(env, { op: "ailimits", token: S.ann, params: { viewer: FORGED, owner: "member:ann" } });
  const [read] = opCalls(env).filter((c) => c.route === "ailimits");
  assert.deepEqual([read.params.viewer, read.params.owner], ["member:ann", "member:ann"]);
});

test("R70 (membership R123; admission R3, R16): `handlecheck` is credential-free, relayed to the store the caller names with the body's `invite` and `handle` only and `viewer` as `groupdescription`'s (`\"\"` for no one, the session's for a member), never the caller's own; the answer carries no invitation, session or member id (negative controls: a forged viewer and a body's `member` are not passed)", async () => {
  const answer = { ok: true, handle: "ann-2", state: "free", problems: [], suggestion: null, words: { key: "handle.free", en: "free" } };
  const { env, S } = world({ answer: (c) => (c.route === "handlecheck" ? ok(answer) : null) });
  assert.equal(OPS.handlecheck?.classes, null);
  for (const [token, want, store] of [[undefined, ""], ["not-a-token", ""], [S.ann, "member:ann"], [S.founder, "admin"],
                                      [undefined, "", "scratch"]]) {
    env.calls.length = 0;
    const r = await call(env, { op: "handlecheck", token, method: "POST", params: { viewer: FORGED, ...(store ? { store } : {}) },
                                body: { invite: "inv-secret", handle: "ann-2", member: "mem-forged", viewer: FORGED } });
    assert.deepEqual([r.status, r.json.ok, r.json.result], [200, true, answer], String(token));
    const [inner] = opCalls(env).filter((c) => c.route === "handlecheck");
    assert.deepEqual([inner.ns, inner.params, inner.body], [store ?? "bio", { viewer: want }, { invite: "inv-secret", handle: "ann-2" }]);
    assert.equal(r.text.includes("inv-secret"), false, "the answer carries no invitation");
    if (token) assert.equal(r.text.includes(token), false, "nor a session");
    assert.equal(/mem-forged|"member"/.test(r.text), false, "nor a member id");
  }
});

test("R70 (membership R124; R17, R29): `handlechange` reaches membership's map for a member's session only, `by` the session's own member id and `handle` the body's, a caller's `by` taken from neither place; every machine credential is refused before any store request (negative control: the founder's session stamps `admin`)", async () => {
  const { w, sessions, machines } = callers({ answer: (c) => (c.route === "handlechange" ? ok({ ok: true, handle: "ann-2", formerly: ["ann"] }) : null) });
  for (const [s, want] of [[sessions[1], "ann"], [sessions[0], "admin"]]) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "handlechange", token: s.token, method: "POST", params: { by: FORGED },
                                  body: { handle: "ann-2", by: FORGED } });
    assert.equal(r.status, 200, r.text);
    const [inner] = opCalls(w.env).filter((c) => c.route === "handlechange");
    assert.deepEqual([inner.params.by, inner.body.handle, Object.hasOwn(inner.body, "by")], [want, "ann-2", false]);
    assert.equal(r.text.includes(s.token), false);
  }
  for (const m of machines) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "handlechange", token: m.token, method: "POST", params: m.params ?? {}, body: { handle: "x" } });
    assert.equal(r.json.ok, false, m.name);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "handlechange"), []);
  }
});

/* R43's session ops, each through its owner's map or the door's own (`owner-ops.mjs`), with `by` or `viewer` stamped. */
/* the door's own map (`controlPlaneOwnerOps`) serves steps', investigation's and question-explorer's ops and the owners'
   that export a service and no arm; the owners' own maps serve the rest of R43's declarations (hypotheses' shares,
   inquiry's waits, run-productions', reading-guides'): every op of those families the T41 grades that a session alone reaches */
const DOOR_OPS = Object.keys(controlPlaneOwnerOps(null, new URL("http://do/"), null));
const R71_SESSION_OPS = [...new Set([
  ...DOOR_OPS.filter((op) => kindsOf("steps", "investigation", "question-explorer", "leg-earning", "case-account", "review", "ai-runs", "ai-use").includes(op)),
  ...kindsOf("hypotheses", "inquiry", "run-productions", "reading-guides")])].filter((op) => T41_GRADED.has(op) && sessionOnly(op));

test("R71 (op-declarations R43; N820; K2496, K2498, K2486, K2560, K2569, K2570): each of R43's session ops reaches the store's route of its own name for a member's session only, each declared stamp from the session and none the caller's; every machine credential is refused before any store request; an owner's refusal is answered as given", async () => {
  /* (T46; K3003, K3006) `stepsrunai` and `grouptestset` record their own clock, so a caller's `at` never reaches it (R17; t46-door.test.mjs) */
  await routesForSessions(R71_SESSION_OPS, (op) => ({ project: "prj-1", question: "INQ-1", step: "STP-1", milestone: 1,
                                                      ...(["stepsrunai", "grouptestset"].includes(op) ? {} : { at: "2026-11-02" }) }));
});

test("R71 (K2496): `readpages` is a run's read, its `principal` and `viewer` the caller's as `extractpropose`'s, never the caller's own (negative control: the request's `run` is passed)", async () => {
  const { env, S, A } = world({ writes: ["readpages"] });
  for (const [token, principal, viewer] of [[S.ann, "member:ann", "member:ann"], [A.ann, "member:ann/agent-ann", "member:ann"]]) {
    env.calls.length = 0;
    await call(env, { op: "readpages", token, method: "POST", params: { principal: FORGED, viewer: FORGED },
                      body: { run: "RUN-1", bundleId: "INFO-1", principal: FORGED } });
    const [inner] = opCalls(env).filter((c) => c.route === "readpages");
    assert.ok(inner, token);
    assert.deepEqual([inner.params.principal, inner.params.viewer, inner.body.run], [principal, viewer, "RUN-1"]);
  }
});

test("R71 (K2561): `actionseekspropose` is a proposal any credential may make, `proposer` the caller's label as `actionlawspropose`'s and `viewer` the caller's sight, never the caller's own (negative control: `target` and `seeks` pass)", async () => {
  const { env, S, A } = world({ writes: ["actionseekspropose"] });
  for (const [token, proposer] of [[S.ann, "ann"], [env.ADMIN_TOKEN, "class:admin"], [A.ann, "class:ai/agent-ann"]]) {
    env.calls.length = 0;
    const r = await call(env, { op: "actionseekspropose", token, method: "POST", params: { proposer: FORGED, viewer: FORGED },
                                body: { target: "ACT-1", seeks: ["records"], proposer: FORGED } });
    assert.equal(r.status, 200, r.text);
    const [inner] = opCalls(env).filter((c) => c.route === "actionseekspropose");
    assert.equal(inner.params.proposer, proposer);
    assert.notEqual(inner.params.viewer, FORGED);
    assert.deepEqual([inner.body.target, inner.body.seeks], ["ACT-1", ["records"]]);
  }
});

test("R72 (capture R86; op-declarations R45; K2458): `captureupload` reaches the store's route for a member's session only, the raw request body streamed through unread as the bytes, `by` the session's own member id and never the caller's, the words in the address; every machine credential is refused before any store request (negative control: the bytes arrive as sent)", async () => {
  const landed = { ok: true, document: { capture: { sha256: SHA } } };
  const { w, machines } = callers({ answer: (c) => (c.route === "captureupload" ? ok(landed) : null) });
  const bytes = "%PDF-1.4 not JSON {\u0000";
  const r = await call(w.env, { op: "captureupload", token: w.S.ann, method: "POST",
                                params: { statement: "a neighbour handed it to me", name: "minutes.pdf", by: FORGED },
                                body: bytes });
  assert.equal(r.status, 200, r.text);
  const [inner] = opCalls(w.env).filter((c) => c.route === "captureupload");
  assert.equal(inner.body, bytes, "the bytes as sent");
  assert.deepEqual([inner.params.by, inner.params.statement, inner.params.name], ["ann", "a neighbour handed it to me", "minutes.pdf"]);
  assert.deepEqual(r.json.result, landed);
  assert.equal(opCalls(w.env).some((c) => c.route === "capturestepproduct"), false, "no step named, none tied");
  for (const m of machines) {
    w.env.calls.length = 0;
    const no = await call(w.env, { op: "captureupload", token: m.token, method: "POST", params: { statement: "x", ...(m.params ?? {}) }, body: bytes });
    assert.equal(no.json.ok, false, m.name);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "captureupload"), []);
  }
});

test("R71 (steps R9): a member's capture that names a step is tied to it after it lands, through the store's internal `capturestepproduct` with the member's sight and identity; one that did not land, or names no step, ties nothing (negative controls), and the internal route is no caller's (R2)", async () => {
  let landed = true;
  // fixtures-generic: EMPTY (any refusal of the upload: the door ties a step only to a capture that landed)
  const { env, S } = world({ answer: (c) => c.route === "captureupload" ? ok(landed ? { ok: true, document: { capture: { sha256: SHA } } } : { ok: false, reason: "EMPTY" })
    : c.route === "capturestepproduct" ? ok({ ok: true, step: "STP-1", product: { kind: "capture", id: SHA } }) : null });
  const r = await call(env, { op: "captureupload", token: S.ann, method: "POST", params: { statement: "s", step: "STP-1" }, body: "bytes" });
  const [tie] = opCalls(env).filter((c) => c.route === "capturestepproduct");
  assert.deepEqual([tie.params.viewer, tie.params.by, tie.body], ["member:ann", "member:ann", { step: "STP-1", capture: SHA }]);
  assert.deepEqual(r.json.result.step_product, { ok: true, step: "STP-1", product: { kind: "capture", id: SHA } });
  landed = false;
  env.calls.length = 0;
  await call(env, { op: "captureupload", token: S.ann, method: "POST", params: { statement: "s", step: "STP-1" }, body: "" });
  assert.equal(opCalls(env).some((c) => c.route === "capturestepproduct"), false, "a capture that did not land ties nothing");
  env.calls.length = 0;
  const direct = await call(env, { op: "capturestepproduct", token: S.ann, method: "POST", body: { step: "STP-1", capture: SHA } });
  assert.deepEqual([direct.status, direct.json.reason], [400, "UNKNOWN_OP"]);
  assert.deepEqual(opCalls(env), []);
});

const promoteBody = (extra = {}) => ({ bundleId: "INQ-1", base: "sha-base", files: [], meta: { object_type: "inquiry" }, ...extra });

test("R73 (K2498; inquiry R54, R59): on `op=promote` the door sets `setIn` from the project the request names (its address, else the body's `project`) and `personWarningSeen` only for a member's own session that states it, deleting the caller's own copies first (negative controls: a machine's statement, a non-true value and an unnamed project record nothing)", async () => {
  const { env, S, A } = world({ writes: ["promote"] });
  const sent = async (token, params, body) => {
    env.calls.length = 0;
    await call(env, { op: "promote", token, method: "POST", params, body });
    return opCalls(env).find((c) => c.route === "promote").body;
  };
  let b = await sent(S.ann, { project: "PRJ-1" }, promoteBody({ setIn: "PRJ-FORGED", personWarningSeen: true }));
  assert.deepEqual([b.setIn, b.personWarningSeen], ["PRJ-1", true]);
  b = await sent(S.ann, {}, promoteBody({ project: "PRJ-2" }));
  assert.deepEqual([b.setIn, Object.hasOwn(b, "personWarningSeen")], ["PRJ-2", false]);
  b = await sent(S.ann, {}, promoteBody({ setIn: "PRJ-FORGED", personWarningSeen: "yes" }));
  assert.deepEqual([Object.hasOwn(b, "setIn"), Object.hasOwn(b, "personWarningSeen")], [false, false]);
  for (const token of [env.ADMIN_TOKEN, A.ann]) {
    b = await sent(token, { project: "PRJ-1" }, promoteBody({ personWarningSeen: true }));
    assert.deepEqual([b.setIn, Object.hasOwn(b, "personWarningSeen")], ["PRJ-1", false], "no machine records a member's choice");
  }
});

test("R17, R29 (K2442; membership R18): `op=memberlist` is stamped with the caller's `viewer` beside `administer`, never the caller's own (negative control: a forged viewer is overwritten for every caller)", async () => {
  const { env, S } = world();
  for (const [token, viewer] of [[S.founder, "admin"], [S.ann, "member:ann"], [env.ADMIN_TOKEN, "class:admin"]]) {
    env.calls.length = 0;
    await call(env, { op: "memberlist", token, params: { viewer: FORGED } });
    const [inner] = opCalls(env).filter((c) => c.route === "memberlist");
    assert.equal(inner.params.viewer, viewer);
  }
});

test("R17, R29 (K2442; membership R18, D54): through the door and membership's own map, an administrator neither invited nor joined to a hidden project reads no participant of it but its owners, because the roster is read by her stamped sight (negative control: once invited, the same administrator's roster lists its participants)", async () => {
  const { world: membershipWorld, V } = await import("../membership/fixture.mjs");
  const { membershipOps } = await import("../../../src/membership/index.mjs");
  const m = await membershipWorld().group("ann", "bob", "cal", "second");
  m.project("PROJ-H", "Hidden H");
  m.m.projectClaimOwner({ projectId: "PROJ-H", memberId: "ann" });
  m.m.projectInvite({ projectId: "PROJ-H", handle: "cal", by: "ann", viewer: V("ann") });
  /* `second` administers: its session's rights say so, as membership answers them for an administrator */
  const { member } = await import("./harness.mjs");
  const S2 = "f".repeat(64);
  const { env } = world({ sessions: { [S2]: member("second", [], { administer: true }) } });
  const rosterOf = async (who) => {
    env.calls.length = 0;
    await call(env, { op: "memberlist", token: S2, params: { viewer: FORGED } });
    const [inner] = opCalls(env).filter((c) => c.route === "memberlist");
    const out = membershipOps(m.m, inner.url, null, {}).memberlist();
    return out.members.find((r) => r.member_id === who).projects;
  };
  assert.deepEqual(await rosterOf("cal"), [], "cal's invitation to the hidden project is not listed");
  assert.deepEqual(await rosterOf("ann"), [{ project: "PROJ-H", state: null, owner: true, existence: true }], "only its owner");
  m.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.deepEqual(await rosterOf("cal"), [{ project: "PROJ-H", state: "invited", owner: false }]);
});
