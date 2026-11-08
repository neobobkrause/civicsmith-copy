/* affordances, T34 (T34-75, T34-87, T34-90, T34-91): the ops T34 declares — publishing at a set time, a member's own
   notes, the assistant's two labelled drafts, `baseupdates`, the membership and credentials ops and the aliases —
   held to their owners' op maps and R12's totality, their `phone` flag (R36), the hypotheses' machine refusal (R20)
   and reason code (R19), R44's writing_help_refused, and DEC-149's member voice in the one served sentence it reaches
   here, each at the module's exports and at the owners' interfaces. Their grades are `op-grades`' (its R14–R17), pinned
   in its tests. */
import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../../../src/affordances.mjs";
import * as G from "../../../src/op-grades/index.mjs";
import { ratificationOps } from "../../../src/ratification/index.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { publishScheduleOps } from "../../../src/publish-schedule/index.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { HYPOTHESES_CHECKS } from "../../../src/hypotheses/checks.mjs";
import { DUTIES_CHECKS } from "../../../src/duties/checks.mjs";
import * as hyFix from "../hypotheses/fixture.mjs";

const { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS } = A;
const { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS } = G;
const url = new URL("http://x/");
const keysOf = (f) => Object.keys(f({}, url, {}));
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? ["rung", RUNGS[op]]
  : Object.hasOwn(RUNG_ABSENT, op) ? ["absent", RUNG_ABSENT[op].ground] : null;
const published = (op) => [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op);
const dec = (op) => A.decorate({ id: op, label: "x" }, null);

/* ---- publishing at a set time (op-grades R14) ------------------------------------------------------------------------ */
const SCHEDULE_WRITES = ["publishat", "publishatmove", "publishatcancel"];
test("R1 R12 R36: publishat, publishatmove and publishatcancel — ratification and publish-schedule serve them (and "
   + "caseratify, which signs a cancel back), publication no longer — decorate with phone false, false and true, none "
   + "is an act, and with op-declarations R25's rows nothing is unaccounted", () => {
  assert.ok(keysOf(ratificationOps).includes("publishat"), "ratification serves publishat");
  /* N823 (K2438): publishing at a set time left publication for publish-schedule, which serves the other three now */
  const pub = keysOf(publicationOps), sched = keysOf(publishScheduleOps);
  for (const op of ["publishatmove", "publishatcancel", "publishschedule"]) {
    assert.ok(sched.includes(op), `publish-schedule serves ${op}`);
    assert.ok(!pub.includes(op), `publication no longer serves ${op}`);
  }
  /* op-grades R3's `reversible`: the published act that takes a cancel back is served */
  assert.ok(keysOf(ratificationOps).includes("caseratify"));
  assert.deepEqual(SCHEDULE_WRITES.map((op) => dec(op).phone), [false, false, true]);
  const ALL = [...SCHEDULE_WRITES, "publishschedule"];
  assert.deepEqual(ALL.filter((op) => published(op)), []);
  const table = [...SCHEDULE_WRITES.map((op) => ({ op, mutating: true, gated: true })),
    { op: "publishschedule", mutating: false, gated: true }];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ALL.includes(op)), []);
  assert.deepEqual(ALL.filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  /* K4279 (R12): an owner's declared read carried ungated is not stale; carried by no row it is */
  assert.ok(!A.unaccounted([{ op: "publishschedule", mutating: false, gated: false }]).stale.includes("publishschedule"));
  assert.ok(A.unaccounted([]).stale.includes("publishschedule"));
});

/* ---- a member's own notes (op-grades R15) ---------------------------------------------------------------------------- */
test("R1 R12 R36: notewrite and noteturn — hypotheses' op map holds them and the read notes, each decorates with phone "
   + "true, none is an act — and with the control plane's rows nothing is unaccounted", () => {
  const ops = keysOf(hypothesesOps);
  for (const op of ["notewrite", "noteturn", "notes"]) assert.ok(ops.includes(op), op);
  for (const op of ["notewrite", "noteturn"]) {
    assert.equal(dec(op).phone, true, op);
  }
  assert.deepEqual(["notewrite", "noteturn", "notes"].filter((op) => published(op)), []);
  const table = [{ op: "notewrite", mutating: true, gated: true }, { op: "noteturn", mutating: true, gated: true },
    { op: "notes", mutating: false, gated: true }];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => table.some((t) => t.op === op)), []);
});

test("R20: hypotheses refuses a machine at both note ops by its own code, MACHINE_CANNOT_NOTE, which no ACTS row "
   + "carries, so MACHINE_REFUSALS gains nothing", () => {
  const w = hyFix.world();
  assert.equal(w.h.noteWrite({ text: "a thing I saw", by: "" }).reason, "MACHINE_CANNOT_NOTE");
  const n = w.h.noteWrite({ text: "a thing I saw", by: hyFix.ANN });
  assert.equal(n.ok, true, JSON.stringify(n).slice(0, 300));
  assert.equal(w.h.noteTurn({ note: n.note, into: "question", by: "" }).reason, "MACHINE_CANNOT_NOTE");
  assert.ok(!Object.values(MACHINE_REFUSALS).includes("MACHINE_CANNOT_NOTE"));
});

test("R19: HYPOTHESIS_NO_REASON and DUTY_NO_REASON are each a row of its owner's checks, in the justification family", () => {
  assert.ok(Object.hasOwn(HYPOTHESES_CHECKS, "HYPOTHESIS_NO_REASON"));
  assert.ok(Object.hasOwn(DUTIES_CHECKS, "DUTY_NO_REASON"));
  for (const c of ["HYPOTHESIS_NO_REASON", "DUTY_NO_REASON"]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
});

/* ---- the assistant's two labelled drafts (op-grades R16) and baseupdates (op-grades R11) ---------------------------- */
test("R1 R12: groupdescriptiondraft and writinghelp are no act; with the control plane's rows (gated, not mutating) for "
   + "them and baseupdates nothing is unaccounted, and carried as mutating each would read unranked", () => {
  for (const op of ["groupdescriptiondraft", "writinghelp"]) assert.ok(!published(op), op);
  const OPS = ["groupdescriptiondraft", "writinghelp", "baseupdates"];
  /* K4247 (op-grades R39 as amended): `groupdescriptiondraft` is a read, its NON_ACTS reason its owner's word, and holds no row, so
     every gated op here is a gated read; carried as a write it would read unranked */
  const table = OPS.map((op) => ({ op, mutating: false, gated: true }));
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => OPS.includes(op)), []);
  assert.deepEqual(A.unaccounted([{ op: "groupdescriptiondraft", mutating: true, gated: true }]).unranked, ["groupdescriptiondraft"]);
  assert.deepEqual(A.unaccounted([{ op: "writinghelp", mutating: true, gated: true }]).unranked, ["writinghelp"]);
  assert.ok(A.unaccounted([]).stale.includes("writinghelp"), "carried by no row, it reads stale");
});

/* ---- DEC-149 (T34-87; K1849 (7)) ----------------------------------------------------------------------------------- */
test("R21 R4 (DEC-149): the undetermined ground's sentence, served as vocabularies.rung_absence_grounds, names no "
   + "Civicsmith ('no refusal establishes one'), and no sentence this module serves in the catalogue calls it the plane, this "
   + "instance, this copy or the server; 'server-side' stays", () => {
  const u = G.RUNG_ABSENCE_GROUNDS.undetermined;
  assert.match(u, /^THIS IS A REAL ACT ON THE RECORD AND IT HAS NO RUNG\. No document assigns one and no refusal establishes one, so the honest answer is that it is UNDETERMINED/);
  assert.doesNotMatch(u, /plane/);
  assert.match(G.RUNG_ABSENCE_GROUNDS["caller-owned"], /server-side/);
  /* this module's own served text: `answer_checks` is `answers`' family, carried whole for the pack (K1601), and
     `act_help` the design stream's texts, held verbatim (R48), where "this copy" is a captured document's copy */
  const { answer_checks, act_help, ...own } = A.affordancesAnswer({ kinds: null, gate: null });
  assert.ok(answer_checks && typeof answer_checks === "object");
  assert.equal(act_help, A.ACT_HELP);
  /* R64: an act's label is now the design's `act.<id>.name`, where "this copy" is a captured document's copy, as in R48's texts below;
     the rest of the served answer keeps DEC-149's rule whole */
  const labels = [...own.catalog, ...own.capture_acts, ...own.set_acts].map((a) => a.label);
  const served = JSON.stringify({ ...own, catalog: own.catalog.map((a) => ({ ...a, label: "" })),
    capture_acts: own.capture_acts.map((a) => ({ ...a, label: "" })), set_acts: own.set_acts.map((a) => ({ ...a, label: "" })) });
  const NAMES = /\bthe plane\b|\bthis plane\b|\bthis instance\b|\bthe instance\b|\bthis copy\b|\bserver\b(?!-side)/i;
  assert.equal(NAMES.exec(served), null);
  assert.ok(NAMES.test(served.replace("no refusal establishes", "no refusal in the plane establishes")), "negative control");
  const NAMES_BUT_COPY_LABELS = /\bthe plane\b|\bthis plane\b|\bthis instance\b|\bthe instance\b|\bserver\b(?!-side)/i;
  assert.deepEqual(labels.filter((l) => NAMES_BUT_COPY_LABELS.test(l)), []);
  /* R48's texts name no plane, instance or server either; their "this copy" alone is the design's (a document's copy) */
  const NAMES_BUT_COPY = /\bthe plane\b|\bthis plane\b|\bthis instance\b|\bthe instance\b|\bserver\b(?!-side)/i;
  assert.equal(NAMES_BUT_COPY.exec(JSON.stringify(act_help)), null);
});

/* ---- R44: the no-target answer's writing_help_refused (K1861 (1)) ----------------------------------------------------- */
import { affordancesOp } from "../../../src/affordances.mjs";
test("R44 R17 R21: the door passes the screens route's writing_help_refused into the no-target answer unchanged — the "
   + "same object wizard-scripts answered — and a targeted answer carries no such key", async () => {
  const WHR = { named: Object.freeze(["release", "caseratify", "bootstrap"]), machine_refused: ["publish"],
                irreversible: ["publish", "publishat", "publishatmove"] };
  const routes = { "/actionkinds": { answered: true, result: { kinds: ["other"] } },
    "/affordancescreens": { answered: true, result: { ok: true, screens: [], wizard_scripts: [], writing_help_refused: WHR } },
    "/affordancefacts": { answered: true, result: { ok: true, target: "INQ-1", object_type: "inquiry", current_state: "open" } } };
  const deps = { json: (body, status) => ({ body, status }), doAnswer: async (r) => r,
    storeSilent: () => ({ silent: true }), storeRefusal: (o) => ({ refusal: o }), gate: null,
    viewer: "member:iris", identity: "member:iris", author: "iris", by: "iris", storeName: "bio", cls: "session" };
  const stub = { fetch: (u) => routes[new URL(u).pathname] };
  const r = await affordancesOp(new URL("http://x/api/?op=affordances"), stub, deps);
  assert.equal(r.body.result.writing_help_refused, WHR, "the very object, never a copy");
  const t = await affordancesOp(new URL("http://x/api/?op=affordances&target=INQ-1"), stub, deps);
  assert.ok(!("writing_help_refused" in t.body.result));
  /* the pure composition: absent where none was handed in, never an invented list */
  assert.equal(A.affordancesAnswer({ kinds: null, gate: null }).writing_help_refused, null);
});

/* ---- the ops T34 declares (op-grades R17; K1864) ------------------------------------------------------------------- */
import { membershipOps } from "../../../src/membership/index.mjs";
import { credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { T34_RUNGS, T34_RUNG_ABSENT, T34_NON_ACTS, OP_ALIASES } from "../../../src/op-grades/t34.mjs";
/* Each op op-grades R17 grades is derived from op-grades' own T34 tables (its grade pinned in op-grades' tests): a write is a
   key of its rungs or stated absences, a read a further key of its NON_ACTS; an op with no NON_ACTS row is public (op-declarations
   R22: `classes: null`), graded where it writes. `tasks` and `instance-setup` are later in the order (P4), so their ops are
   not imported; the ops membership and credentials own are those T34's own text names them for ("(membership R98)"), and each
   must be in that owner's map, which is read. */
const T34_WRITES = [...new Set([...Object.keys(T34_RUNGS), ...Object.keys(T34_RUNG_ABSENT)])];
const T34_READS = Object.keys(T34_NON_ACTS).filter((op) => !T34_WRITES.includes(op));
const T34_PUBLIC = T34_WRITES.filter((op) => !Object.hasOwn(T34_NON_ACTS, op));
const ownerOf = (op) => /\((membership|credentials) R\d+/.exec(T34_RUNG_ABSENT[op]?.is ?? "")?.[1] ?? null;
/* op-grades R30 (DEC-188 (8); K2437, K2445): `groupswitchset`, graded `substrate` here since T34, is retired to
   credentials' `accountusesset` (graded in op-grades' t41.mjs): no grade, no reason, and no owner serves it. */
const T34_RETIRED = ["groupswitchset"];
/* (T53; notice credentials:74; K5457, `ai-accounts` R35) the group key's six ops, which T34 graded for credentials and which moved
   to `ai-accounts` in T48, leave the door with no alias (`ai-accounts` R61 declares their replacements): no owner serves them.
   op-grades' T34 table still grades them, which is op-grades' to retire (`op-grades` R57). */
const T34_LEFT_THE_DOOR = ["groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeynoticeseen", "groupkeystate", "groupkeynotice"];
/* ungated plain reads of membership (op-declarations R22; `courtnotice` a plain read, K1883 (1)): graded nowhere, named in no NON_ACTS (R12) */
const UNGATED_READS = ["groupdescription", "courtnotice"];
test("R1 R12: every op T34 declares in op-declarations R22–R24, R26, R28 and R15 that membership and credentials serve "
   + "is in its owner's map, the retired groupswitchset in none, no op is an act — and with their rows nothing is "
   + "unaccounted; an ungated read carried gated is seen", () => {
  const maps = { membership: keysOf(membershipOps), credentials: keysOf(credentialsOps) };
  assert.ok(T34_WRITES.length > 0 && T34_READS.length > 0 && T34_PUBLIC.length > 0);
  const aiAccounts = keysOf(aiAccountsOps);
  for (const op of T34_WRITES) {
    const o = ownerOf(op);
    if (o && !T34_LEFT_THE_DOOR.includes(op)) assert.ok(maps[o].includes(op), `${o} serves ${op}`);
  }
  /* (BOB, 7 Nov; op-grades R57, PR 866) only membership's half: R57 removes the four group-key rows that were T34's only
     writes citing credentials; credentials' op is pinned by the keyedserviceset check below */
  assert.ok(T34_WRITES.some((op) => ownerOf(op) === "membership"));
  for (const op of T34_LEFT_THE_DOOR)
    assert.ok(!maps.credentials.includes(op) && !aiAccounts.includes(op) && !maps.membership.includes(op), `${op} is served by no owner`);
  for (const op of UNGATED_READS) assert.ok(maps.membership.includes(op), `membership serves ${op}`);
  /* (BOB, 7 Nov; op-grades R57) the group key's reads leave op-grades' T34 table, so whether it still grades them is not
     pinned here; the credential key T34 cites "as keyedserviceset" stays credentials' op at its `credential` ground */
  assert.ok(maps.credentials.includes("keyedserviceset"), "credentials serves keyedserviceset");
  assert.equal(G.RUNG_ABSENT.keyedserviceset?.ground, "credential");
  for (const op of T34_RETIRED) {
    assert.ok(!maps.credentials.includes(op), `credentials no longer serves ${op}`);
    /* op-grades' content its own tests do not yet pin (N877; reported to BOB): T34's table names it no longer */
    assert.equal(Object.hasOwn(T34_NON_ACTS, op), false, op);
  }
  const ALL = [...T34_WRITES, ...T34_READS, ...UNGATED_READS];
  assert.deepEqual(ALL.filter((op) => published(op)), []);
  const table = [...T34_WRITES.map((op) => ({ op, mutating: true, gated: !T34_PUBLIC.includes(op) })),
    ...T34_READS.map((op) => ({ op, mutating: false, gated: true })),
    ...UNGATED_READS.map((op) => ({ op, mutating: false, gated: false }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ALL.includes(op)), []);
  /* negative controls */
  for (const op of UNGATED_READS)
    assert.deepEqual(A.unaccounted([{ op, mutating: false, gated: true }]).unpublished, [op], `${op}, carried gated, is seen`);
  for (const op of T34_PUBLIC)
    assert.ok(A.unaccounted([{ op, mutating: true, gated: true }]).unpublished.includes(op), `${op}, carried gated, is seen`);
});

test("R12: with a row for each of op-declarations R21's 27 aliases (K2059: `expunge` dropped, no op since K1901; K2245, "
   + "DEC-182 (2): `claimidentity` dropped, its text withdrawn), carried mutating exactly where its op is graded, nothing "
   + "is unaccounted", () => {
  /* op-grades' content its own tests do not yet pin (N877; reported to BOB): personexpunge, a declared op of its own, is
     no alias's op (K2054, K2059) */
  assert.equal(Object.values(OP_ALIASES).includes("personexpunge"), false);
  const table = Object.entries(OP_ALIASES).map(([a, op]) => ({ op: a, mutating: gradeOf(op) !== null, gated: true }));
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => Object.hasOwn(OP_ALIASES, op)), []);
});
