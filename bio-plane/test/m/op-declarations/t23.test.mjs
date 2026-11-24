/* op-declarations R10: the specs of T23's ops (N485: K1025, K1035, K1051; the link sweep, K1094; network-notices: DEC-111,
   K1031, K1100), each compared whole with the stamps its lists name, both session sets and its NEEDS row, in the form of
   R9's tests in `tables.test.mjs`. Each comparison has a negative control: a drifted table is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { REGISTERED } from "./register-owners.mjs";
import { linkSweepOps } from "../../../src/link-sweep/index.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (spec) => ({ ...spec, ...(Array.isArray(spec.classes) ? { classes: [...spec.classes] } : {}),
                           ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
const MEMBER_PROBE = ["admin", "member", "probe"];
const SESSION_ONLY = { classes: ["admin", "member"], machineClasses: [], mutating: false };
const PUBLIC = { classes: null, mutating: false };

/* R10's ops as it lists them: the spec, the op it is declared as (`like`), the lists that name it (so its stamps), and
   its NEEDS row (`undefined`: no row). The reads affordances R32 names in NON_ACTS carry a present null row. */
const R10 = {
  escalationreasondraft: { spec: { classes: MEMBER_PROBE, mutating: false }, like: "escalationstatus", needs: null,
                           lists: ["ACTION_LAYER_READS", "ESCALATION_READS"] },
  whatchangedpropose:    { spec: { classes: MEMBER_PROBE, mutating: true }, like: "templatepropose", needs: "contribute",
                           lists: ["WHAT_CHANGED_PROPOSAL_ACTIONS"] },
  whatchangeddrafts:     { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null, lists: ["WHAT_CHANGED_READS"] },
  sweeps:                { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null,
                           lists: ["ACTION_LAYER_READS", "LINK_SWEEP_READS"] },
  noticeprepare:         { spec: SESSION_ONLY, like: "knocksof", needs: null,
                           lists: ["NETWORK_NOTICES_BY", "NETWORK_NOTICES_READS"] },
  noticepost:            { spec: { ...SESSION_ONLY, mutating: true }, like: "inboxpull", needs: "contribute",
                           lists: ["NETWORK_NOTICES_ACTIONS", "NETWORK_NOTICES_BY"] },
  notices:               { spec: SESSION_ONLY, like: "knocksof", needs: null, lists: ["NETWORK_NOTICES_READS"] },
  activitymethod:        { spec: PUBLIC, like: "publishedmanifest", needs: null, lists: ["NETWORK_NOTICES_PUBLIC_READS"] },
  noticespublic:         { spec: PUBLIC, like: "publishedmanifest", needs: null, lists: ["NETWORK_NOTICES_PUBLIC_READS"] },
  groupkeyspublic:       { spec: PUBLIC, like: "publishedmanifest", needs: null, lists: ["NETWORK_NOTICES_PUBLIC_READS"] },
};
/* R6 over what T23's modules serve beyond R10's list (J1): network-notices R23's read, `notices`' spec, and the public
   door's own `publicread` (public-read R18), `publishedmanifest`'s. Neither is named in affordances' NON_ACTS: no row. */
const R6_T23 = {
  directorysubmission: { spec: SESSION_ONLY, like: "notices", needs: undefined, lists: ["NETWORK_NOTICES_READS"] },
  publicread:          { spec: PUBLIC, like: "publishedmanifest", needs: undefined, lists: [] },
};
const ALL = { ...R10, ...R6_T23 };
const PUBLIC_OPS = Object.keys(ALL).filter((op) => ALL[op].spec.classes === null);
const SESSION_REACHED = Object.keys(ALL).filter((op) => ALL[op].spec.classes !== null);

/* The stamps each list confers at the door (control-plane reads the lists): `viewer` for the action layer's reads, the
   draft's read and the notices' act and reads; `proposedBy` for the draft (case-authoring R39, as `templatepropose`'s
   `proposer`); `by` for the two acts an owner performs on a notice. A public read's list stamps nothing. */
const STAMPS = { ACTION_LAYER_READS: ["viewer"], WHAT_CHANGED_PROPOSAL_ACTIONS: ["proposedBy", "viewer"],
                 WHAT_CHANGED_READS: ["viewer"], NETWORK_NOTICES_ACTIONS: ["viewer"], NETWORK_NOTICES_READS: ["viewer"],
                 NETWORK_NOTICES_BY: ["by"], NETWORK_NOTICES_PUBLIC_READS: [] };
const stampsOf = (op) => [...new Set(listsHolding(op).flatMap((l) => STAMPS[l] ?? []))].sort();
const R10_STAMPS = { escalationreasondraft: ["viewer"], whatchangedpropose: ["proposedBy", "viewer"],
                     whatchangeddrafts: ["viewer"], sweeps: ["viewer"], noticeprepare: ["by", "viewer"],
                     noticepost: ["by", "viewer"], notices: ["viewer"], directorysubmission: ["viewer"],
                     activitymethod: [], noticespublic: [], groupkeyspublic: [], publicread: [] };

test("R10, R2: OPS holds a spec for each op T23 adds — escalationreasondraft as escalationstatus, whatchangedpropose as templatepropose (mutating, any credential) and whatchangeddrafts and sweeps reads (admin, member, probe); noticeprepare and notices reads and noticepost mutating, each admin and member with machineClasses []; the three public reads classes null, not mutating — none naming ai", () => {
  assert.equal(Object.keys(R10).length, 10);
  for (const [op, want] of Object.entries(ALL)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want.spec, op);
    if (want.like) assert.deepEqual(plain(OPS[op]), plain(OPS[want.like]), `${op} as ${want.like}`);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  }
  /* The draft reaches an agent credential by its scope alone: member admitted, no machineClasses, no bearer fence. */
  assert.ok(OPS.whatchangedpropose.classes.includes("member") && !("machineClasses" in OPS.whatchangedpropose)
            && !O.GOVERNANCE_ACTIONS.includes("whatchangedpropose") && !O.IDENTITY_ACTIONS.includes("whatchangedpropose"));
  /* Negative controls: the whole-spec comparison sees a drifted class, fence or mutation. */
  assert.notDeepEqual(plain({ ...OPS.noticepost, machineClasses: ["admin"] }), R10.noticepost.spec);
  assert.notDeepEqual(plain({ ...OPS.whatchangedpropose, mutating: false }), R10.whatchangedpropose.spec);
  assert.notDeepEqual(plain({ ...OPS.activitymethod, classes: ["admin"] }), R10.activitymethod.spec);
});

test("R10, R2: no machine class, agent credential or operator token reaches a notice op — machineClasses [] on each, so every bearer (admin, member, probe, daemon) is refused and only a session's kind is admitted", () => {
  const admitsBearer = (op, cls) => Array.isArray(OPS[op].classes)
    && (Array.isArray(OPS[op].machineClasses) ? OPS[op].machineClasses : OPS[op].classes).includes(cls);
  for (const op of ["noticeprepare", "noticepost", "notices", "directorysubmission"]) {
    assert.deepEqual([...OPS[op].machineClasses], [], op);
    for (const cls of ["admin", "member", "probe", "daemon"]) assert.equal(admitsBearer(op, cls), false, `${op}: ${cls}`);
    /* An agent credential is admitted only to an op a member reaches with no machineClasses (R2): not these. */
    assert.ok("machineClasses" in OPS[op], op);
  }
  /* Negative control: an op without the fence admits a bearer. */
  assert.equal(admitsBearer("whatchangedpropose", "probe"), true);
  assert.equal(admitsBearer("doorbelltally", "admin"), false);
});

test("R10, R3: each session-reached op T23 adds is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session), the public reads in neither (machine); NEEDS is contribute for whatchangedpropose and noticepost, a present null for the reads affordances names, no row for directorysubmission and publicread; none is unattended", () => {
  for (const op of SESSION_REACHED) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
  }
  for (const op of PUBLIC_OPS) {
    assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), `${op} is in a session set`);
    assert.equal(ACT_GATE.mode(op), "machine", op);
  }
  assert.deepEqual(PUBLIC_OPS.sort(), ["activitymethod", "groupkeyspublic", "noticespublic", "publicread"]);
  for (const [op, want] of Object.entries(ALL)) {
    if (want.needs === undefined) assert.ok(!Object.hasOwn(NEEDS, op), `${op} has a NEEDS row`);
    else {
      assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
      assert.equal(NEEDS[op], want.needs, op);
    }
    assert.equal(ACT_GATE.needs(op), want.needs ?? null, op);
    /* contribute exactly for every mutating op a member's session reaches */
    assert.equal(NEEDS[op] === "contribute", OPS[op].mutating && SESSION_OPS.member.has(op), op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  /* Negative control: escalationstatus, whose shape escalationreasondraft takes, has no row, so the row is R10's own. */
  assert.equal(Object.hasOwn(NEEDS, "escalationstatus"), false);
});

test("R10, R4: the act lists name each of T23's ops, so its stamps are named — viewer for escalationreasondraft (escalation's reads), whatchangeddrafts, sweeps (link-sweep's read, among the action layer's reads), notices and directorysubmission; proposedBy and viewer for whatchangedpropose; by and viewer for noticeprepare and noticepost; nothing for the public reads", () => {
  for (const [op, want] of Object.entries(ALL)) {
    assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
    assert.deepEqual(stampsOf(op), R10_STAMPS[op], op);
  }
  /* escalationreasondraft takes escalationstatus' very places. */
  assert.deepEqual(listsHolding("escalationreasondraft"), listsHolding("escalationstatus"));
  /* The draft's proposer is a label, never an author: it is in no author-stamped list, as templatepropose. */
  assert.ok(!O.QUERY_AUTHOR_ACTIONS.includes("whatchangedpropose") && !O.ACTION_LAYER_ACTIONS.includes("whatchangedpropose"));
  assert.deepEqual([...O.WHAT_CHANGED_PROPOSAL_ACTIONS], ["whatchangedpropose"]);
  assert.deepEqual([...O.WHAT_CHANGED_READS], ["whatchangeddrafts"]);
  assert.deepEqual([...O.LINK_SWEEP_READS], ["sweeps"]);
  assert.equal(O.MONITORING_READS, undefined);
  assert.deepEqual([...O.NETWORK_NOTICES_ACTIONS], ["noticepost"]);
  assert.deepEqual([...O.NETWORK_NOTICES_READS], ["noticeprepare", "notices", "directorysubmission"]);
  assert.deepEqual([...O.NETWORK_NOTICES_BY], ["noticeprepare", "noticepost"]);
  assert.deepEqual([...O.NETWORK_NOTICES_PUBLIC_READS], ["activitymethod", "noticespublic", "groupkeyspublic"]);
  /* No public read is stamped: none is in a list that confers a stamp, nor in the plan-run scope. */
  for (const op of PUBLIC_OPS) {
    assert.deepEqual(stampsOf(op), [], op);
    assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
  }
  /* Negative control: an op in no list is stamped nothing; a stamped op moved out of its list loses its stamp. */
  assert.deepEqual(stampsOf("nosuchop"), []);
  assert.deepEqual([...new Set(listsHolding("noticepost").filter((l) => l !== "NETWORK_NOTICES_BY").flatMap((l) => STAMPS[l]))], ["viewer"]);
});

test("R10, R6: every op T23's modules serve has a spec the door answers by name — escalation's escalationreasondraft, case-authoring's two, link-sweep's sweeps, network-notices' four ops and three registered public reads, public-read's own publicread — and no spec without an op", () => {
  /* The names each owner serves (escalation R25, case-authoring R39, link-sweep R9, network-notices' ops map and its
     public reads as its COMPLETE lists them, K1150; public-read's door op). */
  const SERVED = ["escalationreasondraft", "whatchangedpropose", "whatchangeddrafts", "sweeps", "noticeprepare", "noticepost",
                  "notices", "directorysubmission", "activitymethod", "noticespublic", "groupkeyspublic", "publicread"];
  assert.deepEqual([...SERVED].sort(), Object.keys(ALL).sort());
  for (const op of SERVED) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.match(op, /^[a-z]+$/, op);
  }
  /* The superseded public-read names network-notices' early record used (`noticemethod`, `groupkeys`) are no op. */
  for (const op of ["noticemethod", "groupkeys"]) assert.ok(!Object.hasOwn(OPS, op), op);
});

test("R10, R6 (N506, K1207): sweeps is declared for link-sweep's map — every op link-sweep's ops map serves has a spec, the ones its owner declares (R80) held by their declarations, and the one this module declares by hand is sweeps, R10's read; link-sweep's read list names exactly the map's reads (negative control: an op added to the map without a spec is seen)", () => {
  const served = Object.keys(linkSweepOps({}, new URL("https://instance.invalid/")));
  assert.ok(served.includes("sweeps"), "link-sweep's map does not serve sweeps");
  /* the ops link-sweep declares are read from its own declaration (K3268), never a hand list */
  const declared = Object.keys(REGISTERED["link-sweep"] ?? {});
  assert.ok(declared.length > 0, "link-sweep declares no op");
  for (const op of served) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.ok(op === "sweeps" || declared.includes(op), `${op}: neither R10's sweeps nor declared by link-sweep`);
  }
  assert.deepEqual(plain(OPS.sweeps), R10.sweeps.spec);
  for (const op of declared.filter((o) => served.includes(o))) {
    assert.equal(OPS[op].mutating, REGISTERED["link-sweep"][op].mutating, op);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
  }
  assert.deepEqual([...O.LINK_SWEEP_READS].sort(), ["sweeps"]);
  assert.ok(served.filter((op) => !OPS[op].mutating).includes("sweeps"));
  /* Negative control: a map that serves an op with no spec is seen. */
  const unspecified = [...served, "sweepretry"].filter((op) => !Object.hasOwn(OPS, op));
  assert.deepEqual(unspecified, ["sweepretry"]);
});
