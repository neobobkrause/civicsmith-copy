/* affordances: the shares of three old suites (T18's converts, `build/jobs/T17/legacy-tests.md`), driven in-process at
   this module's interface (`affordanceFacts`, `deriveActs`, `decorate`) over the owning modules' own fixtures, with the
   acts performed at their own modules' interfaces so each offer is held to the refusal it fronts (R18).

   - `conclude-project-arm` (R14, R15, R23, R18): on a question concluded with no project, `conclude` is offered to an
     owner and to a joined non-owner of a project that live-cites it, and withheld from a member only invited there, from
     the owner of a project that severed or never cited it, from an administrator who joined nothing and from a machine;
     on an open question to every person. Over basis-versions' fixture (real record, membership, promotion, connections,
     basis-versions); the providers it does not build are stand-ins answering that nothing rests on the question and no
     case pins it.
   - `caseproduction` §3a (R8, R10, R14, R15, R18; DEC-69): `publish` is offered exactly where case-authoring's
     `publishCase` does not refuse the caller on position (NOT_THE_PROJECT_OWNER), a machine is withheld it by the machine
     rule, and a withheld caller's acts carry no narration of the position.
   - `publish` (R14, R8, R18): `case_member` measured after a real publication — `publish` withheld and refused
     ALREADY_A_CASE_MEMBER, `reopen` offered and accepted.
   The last two over case-authoring's fixture (real record, membership, promotion, connections, inquiry, basis-versions,
   publication, ratification, contradiction, case-authoring), with `case_member` asked of the case-tensions instance
   publication builds on the same host (N597). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as bvFix from "../basis-versions/fixture.mjs";
import * as caFix from "../case-authoring/fixture.mjs";
import { affordancesOf, deriveActs, decorate, SELF_ATTESTED_PROMPT } from "../../../src/affordances.mjs";
import { MACHINE_REFUSALS } from "../../../src/op-grades/index.mjs";
import { caseTensionsOf } from "../../../src/case-tensions/index.mjs";

const NOTHING_RESTS = { confirmed: [], frozen: [], severed: [] };
const ids = (f) => deriveActs(f).map((a) => a.id);

/* ============================================================ conclude-project-arm's share */
const DOC = "INFO-2026-9142-ledger", Q = "INQ-2026-9142-concluded-elsewhere", OPENQ = "INQ-2026-9142-still-open";
const READING = "the-ledger", CLAIM = "the ledger shows the transfer followed the adopted process";
const T = "2026-09-27T00:00:00Z";
const { V } = bvFix;

function concludedElsewhere() {
  const w = bvFix.world();
  w.doc(DOC);
  for (const m of ["iris", "jonah", "vera", "olga"]) w.member(m);
  w.member("omar", { role: "admin" });
  const reading = (id) => bvFix.block(bvFix.merge(bvFix.version(READING, [DOC], { state: "accepted", claim: CLAIM,
    state_by: "member:iris", state_at: T, state_reason: "" }), { basis: [{ target: DOC, role: "supports" }], refs: [DOC] }));
  for (const id of [Q, OPENQ]) assert.equal(w.inquiry(id, reading(id)).ok, true, id);
  /* P, iris's, cites both questions: jonah joins, vera is only invited. S, olga's, SEVERED its edge to Q; O, olga's,
     cites only the document. omar is an administrator who joined none: hidden, each project is his at EXISTENCE only (D54). */
  const P = w.project("Oversight", "iris", [Q, OPENQ]);
  const S = w.project("Severed", "olga", [], { severed: [Q] });
  const O = w.project("Elsewhere", "olga", []);
  assert.equal(w.membership.projectInvite({ projectId: P, handle: "h_jonah", by: "iris", viewer: V("iris") }).ok, true);
  assert.equal(w.membership.projectJoin({ projectId: P, by: "jonah", viewer: V("jonah") }).ok, true);
  assert.equal(w.membership.projectInvite({ projectId: P, handle: "h_vera", by: "iris", viewer: V("iris") }).ok, true);
  assert.equal(w.bv.versionCurrent({ target: Q, version: READING, project: P, author: V("iris"), viewer: V("iris"),
                                     identity: V("iris"), reason: "we stand on the ledger" }).ok, true);
  const np = w.bv.conclude({ target: Q, conclusion: "The ledger answers the question.", falsifier: "a later ledger entry",
                             version: READING, author: V("vera"), viewer: V("vera"), identity: V("vera") });
  assert.deepEqual([np.ok, np.relationship], [true, "no_project"], JSON.stringify(np).slice(0, 300));
  const a = affordancesOf(w.host, {
    record: w.record, membership: w.membership, connections: w.k, basisVersions: w.bv, sql: w.st.sql,
    inquiry: { restsOnLive: () => NOTHING_RESTS },
    citation: { retiredNotCitable: () => false },
    caseTensions: { caseRelation: () => ({ member: false }) },
    ratification: { caseConclusionFor: () => ({ state: "none" }), editionsRecordingConclusion: () => ({ same: [] }) },
  });
  /* the stamps the control plane sends for a session member, and for a machine credential (`token:` author, `class:` by) */
  const as = (m, target = Q) => a.affordanceFacts({ target, viewer: V(m), identity: V(m), author: V(m), by: m });
  const machine = (target = Q) => a.affordanceFacts({ target, viewer: "admin", identity: "class:member",
                                                      author: "token:member", by: "class:member" });
  return { w, a, P, S, O, as, machine };
}

test("R14 R15 R23 R8: on a question concluded with no project, conclude is offered to an owner and to a joined "
   + "non-owner of a project that live-cites it, and to nobody else — not the member only invited, the owner of a "
   + "project that severed or never cited it, an administrator who joined nothing, or a machine", () => {
  const { w, as, machine } = concludedElsewhere();
  assert.equal(w.row(`SELECT current_state FROM bundles WHERE bundle_id=?`, Q).current_state, "concluded", "the fixture is real");
  const want = { iris: true, jonah: true, vera: false, olga: false, omar: false };
  for (const [m, offered] of Object.entries(want)) {
    const f = as(m);
    assert.equal(f.ok, true, `${m}: ${JSON.stringify(f).slice(0, 200)}`);
    assert.equal(f.concludes_for_project, offered, `${m}: concludes_for_project`);
    assert.equal(ids(f).includes("conclude"), offered, `${m}: conclude offered`);
  }
  const m = machine();
  assert.deepEqual([m.ok, m.concludes_for_project, m.actor_is_machine], [true, null, true]);
  assert.equal(ids(m).includes("conclude"), false, "a machine is withheld conclude");
  /* the offer is conclude's own entry, decorated as everywhere else */
  const d = decorate(deriveActs(as("iris")).find((x) => x.id === "conclude"), { needs: () => "contribute", mode: () => "session" });
  assert.deepEqual([d.weight, d.rung, d.mode, d.prompt], ["single", "reasoned", "session", null]);
});

test("R15 R23 (D54): concludes_for_project is asked of who the caller is, over the projects the viewer can see — an "
   + "administrator's viewer, the founder's included, neither invited nor joined to a hidden project sees it only at "
   + "EXISTENCE and so lends no sight of it; the same project set discoverable, or the administrator invited, is seen whole", () => {
  const { w, a, P } = concludedElsewhere();
  const f = (viewer, identity) => a.affordanceFacts({ target: Q, viewer, identity }).concludes_for_project;
  const sight = (viewer) => w.membership.sight(P, viewer);
  /* P is hidden (no setting): the founder and omar, an administrator who joined nothing, see it at EXISTENCE only */
  assert.deepEqual([sight("admin"), sight(V("omar"))], ["existence", "existence"]);
  assert.equal(f("admin", V("jonah")), false, "the founder's sight of a hidden project lends jonah none");
  assert.equal(f(V("omar"), V("jonah")), false, "nor an administrator's");
  assert.equal(f(V("jonah"), V("jonah")), true, "jonah's own sight: joined");
  assert.equal(f("admin", V("omar")), false, "the administrator's own identity joined nothing");
  assert.equal(f("admin", V("vera")), false);
  assert.equal(f(V("iris"), null), true, "identity absent: the viewer's own member");
  /* negative control (K874): the owner sets P discoverable, and an administrator's viewer is at FULL again */
  assert.equal(w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "iris", viewer: V("iris") }).ok, true);
  assert.deepEqual([sight("admin"), sight(V("omar"))], ["full", "full"]);
  assert.equal(f("admin", V("jonah")), true, "an administrator's sight of a discoverable project, asked as jonah");
  assert.equal(f(V("omar"), V("jonah")), true);
  assert.equal(f("admin", V("omar")), false, "still: the administrator's own identity joined nothing");
});

test("R15 R23 (D54): an administrator invited to a hidden project sees it whole, so its sight serves the caller's "
   + "identity there; one not invited does not", () => {
  const { w, a, P } = concludedElsewhere();
  const f = (viewer, identity) => a.affordanceFacts({ target: Q, viewer, identity }).concludes_for_project;
  assert.equal(w.membership.sight(P, V("omar")), "existence");
  assert.equal(f(V("omar"), V("jonah")), false);
  assert.equal(w.membership.projectInvite({ projectId: P, handle: "h_omar", by: "iris", viewer: V("iris") }).ok, true);
  assert.equal(w.membership.sight(P, V("omar")), "full");
  assert.equal(f(V("omar"), V("jonah")), true, "the invited administrator's sight, asked as jonah");
  assert.equal(f(V("omar"), V("omar")), false, "invited is not joined: omar concludes for no project");
});

test("R14 R8: on an open question conclude is offered to every person, and withheld from a machine", () => {
  const { as, machine } = concludedElsewhere();
  for (const m of ["iris", "jonah", "vera", "olga", "omar"]) assert.equal(ids(as(m, OPENQ)).includes("conclude"), true, m);
  assert.equal(ids(machine(OPENQ)).includes("conclude"), false);
});

test("R18: the offer and the act agree — each member offered conclude concludes for the citing project, and each "
   + "member withheld it is refused whichever project they name", () => {
  const { w, P, S, O, as } = concludedElsewhere();
  const conclude = (m, project) => w.bv.conclude({ target: Q, project, falsifier: "a council minute", author: V(m),
                                                   viewer: V(m), identity: V(m) });
  /* withheld first, so no conclusion moves the record before they are asked */
  for (const [m, projects] of [["vera", [P]], ["olga", [S, O]], ["omar", [P, S, O]]]) {
    assert.equal(ids(as(m)).includes("conclude"), false, m);
    for (const p of projects) assert.notEqual(conclude(m, p).ok, true, `${m} for ${p}`);
  }
  for (const m of ["jonah", "iris"]) {
    assert.equal(ids(as(m)).includes("conclude"), true, m);
    const r = conclude(m, P);
    assert.deepEqual([r.ok, r.relationship, r.project], [true, "project", P], `${m}: ${JSON.stringify(r).slice(0, 300)}`);
  }
});

/* ============================================================ caseproduction §3a's and publish's shares */
const CDOC = "INFO-2026-0001-a", F = "INQ-2026-0001-q";
function publishable() {
  const w = caFix.world();
  for (const m of ["alice", "ruth"]) w.member(m);
  w.member("omar", { role: "admin" });
  w.doc(CDOC);
  w.finding(F, [{ target: CDOC }]);
  const P = w.project("Team", "alice", [F]);
  w.join(P, "ruth");
  const a = affordancesOf(w.host, {
    record: w.record, membership: w.membership, connections: w.connections, inquiry: w.inquiry, sql: w.st.sql,
    caseTensions: caseTensionsOf(w.host), basisVersions: w.basisVersions, ratification: w.ratification,
    contradiction: w.contradiction, citation: { retiredNotCitable: () => false },
  });
  const as = (m) => a.affordanceFacts({ target: F, viewer: caFix.V(m), identity: caFix.V(m), author: caFix.V(m), by: m });
  const machine = () => a.affordanceFacts({ target: F, viewer: "admin", identity: "class:member", author: "token:member",
                                            by: "class:member" });
  return { w, P, as, machine };
}
const GATE = { needs: () => "publish", mode: () => "session" };

/* The refusals publishCase gives on the caller's position: not an owner (case-authoring), and, before it, sight of a
   hidden project at EXISTENCE only (membership R44, R77; D54). */
const POSITION = ["NOT_THE_PROJECT_OWNER", "PROJECT_SEEN_NOT_A_PARTICIPANT"];

test("R8 R10 R14 R15 R18 (D54): publish is offered exactly where publishCase does not refuse the caller on position — the "
   + "owner offered, a joined participant and an administrator owning nothing withheld — and the table is not uniform; "
   + "the administrator, neither invited nor joined, is refused at the hidden project's EXISTENCE, and once the project "
   + "is discoverable, as no owner", () => {
  const { w, P, as } = publishable();
  /* the position half of the refusal alone: a ceremony with no statement, so an owner passes the authority fences and
     stops at NO_STATEMENT, and nothing is written */
  const probe = (m) => w.publish(P, m, [F], { statement: "" }).reason;
  const table = () => ["alice", "ruth", "omar"].map((m) => {
    const f = as(m);
    return { m, owner: f.project_owner, offered: ids(f).includes("publish"), reason: probe(m) };
  });
  const check = (rows, omarReason) => {
    assert.deepEqual(rows.map((r) => [r.m, r.owner, r.offered]), [["alice", true, true], ["ruth", false, false], ["omar", false, false]]);
    for (const r of rows) assert.equal(r.offered, !POSITION.includes(r.reason), `${r.m}: ${r.reason}`);
    assert.deepEqual(rows.map((r) => r.reason), ["NO_STATEMENT", "NOT_THE_PROJECT_OWNER", omarReason],
      "the one caller past the position fence is stopped by the ceremony, by name");
  };
  let before = w.snapshot();
  check(table(), "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* negative control (K874): discoverable, the administrator sees the project whole, and is refused as no owner */
  assert.equal(w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "alice", viewer: caFix.V("alice") }).ok, true);
  assert.equal(w.membership.sight(P, caFix.V("omar")), "full");
  before = w.snapshot();
  check(table(), "NOT_THE_PROJECT_OWNER");
  assert.deepEqual(w.snapshot(), before, "nothing written");
});

test("R10 R20: a machine is withheld publish by the machine rule — its position fact is null and narrows nothing — and "
   + "publishCase refuses it the code MACHINE_REFUSALS names", () => {
  const { w, P, machine } = publishable();
  const f = machine();
  assert.deepEqual([f.ok, f.project_owner, f.actor_is_machine], [true, null, true]);
  assert.equal(ids(f).includes("publish"), false);
  assert.equal(ids({ ...f, actor_is_machine: false }).includes("publish"), true, "withheld by the machine rule, not by position");
  assert.equal(w.publish(P, "alice", [F], { author: caFix.MACHINE }).reason, MACHINE_REFUSALS.publish);
});

test("R5 R21 (DEC-69): a withheld caller's acts carry no publish entry and no narration of the position; the owner's "
   + "publish carries only R28's self-attested prompt, and no re-confirmation", () => {
  const { as } = publishable();
  const ruth = deriveActs(as("ruth")).map((x) => decorate(x, GATE));
  assert.equal(ruth.some((x) => x.id === "publish"), false);
  assert.equal(/owner|confirm|are you sure|NOT_THE_PROJECT_OWNER|project_owner/i.test(JSON.stringify(ruth)), false);
  const pub = deriveActs(as("alice")).map((x) => decorate(x, GATE)).find((x) => x.id === "publish");
  assert.ok(pub, "the owner is offered publish");
  assert.equal(pub.prompt, SELF_ATTESTED_PROMPT);
  assert.equal("confirm" in pub, false);
  assert.equal(/owner|confirm/i.test(JSON.stringify(pub)), false);
});

test("R14 R8 R18: case_member is measured after a real publication — publish is withheld and refused "
   + "ALREADY_A_CASE_MEMBER, reopen is offered and accepted", () => {
  const { w, P, as } = publishable();
  const before = as("alice");
  assert.deepEqual([before.case_member, ids(before).includes("publish"), ids(before).includes("reopen")], [false, true, false]);
  const r = w.publish(P, "alice", [F]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  w.ratify(r);
  const after = as("alice");
  assert.equal(after.case_member, true);
  assert.equal(ids(after).includes("publish"), false);
  assert.equal(w.publish(P, "alice", [F], { scope: "A second scope.", statement: "A second statement." }).reason,
               "ALREADY_A_CASE_MEMBER");
  assert.equal(ids(after).includes("reopen"), true);
  const re = w.promotion.reopen({ target: F, reason: "a new memo arrived", viewer: caFix.V("alice"), author: caFix.V("alice") });
  assert.equal(re.ok, true, JSON.stringify(re).slice(0, 300));
});
