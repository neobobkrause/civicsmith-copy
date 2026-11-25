/* affordances, T33 (T33-85): R39 (the new closed vocabularies with the members' words), every op T33's new modules
   publish and the ops T33 adds to earlier modules, held to their owners' op maps with R12's totality holding over them
   (their grades are `op-grades`' R13, pinned in its tests), and R41 (a refusal explained from its translation and a dry
   run), each at the module's exports. Each reasoned op's backing (R19) is driven at its owner's interface in
   t33-backing.test.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../../../src/affordances.mjs";
import * as G from "../../../src/op-grades/index.mjs";
import { T33_NON_ACTS } from "../../../src/op-grades/t33.mjs";
import { composedVocabularies, plainWord } from "../../../src/affordances/words.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { affordancesOf } from "../../../src/affordances/facts.mjs";
import { owners, kindOf } from "../../../src/connection-grammar/index.mjs";
import * as events from "../../../src/events/index.mjs";
import * as lines from "../../../src/lines/index.mjs";
import * as money from "../../../src/money/index.mjs";
import * as people from "../../../src/people/index.mjs";
import { moneyChecksOps } from "../../../src/money-checks/index.mjs";
import { dutiesOps } from "../../../src/duties/index.mjs";
import { exploreOps } from "../../../src/explore/ops.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { calculationsOps } from "../../../src/calculations/index.mjs";
import { workbooksOps } from "../../../src/workbooks/ops.mjs";
import { answersOps } from "../../../src/answers/ops.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { credentialsOps } from "../../../src/credentials/index.mjs";
import { sourcesOps } from "../../../src/sources/index.mjs";
import { entitiesOps } from "../../../src/entities/index.mjs";
import { inquiryOps } from "../../../src/inquiry/index.mjs";
import { corpusExportOps } from "../../../src/corpus-export/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { world as eventsWorld } from "../events/fixture.mjs";

const { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS } = A;
const { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS } = G;
const url = new URL("http://x/");
const keysOf = (f) => Object.keys(f({}, url, {}, {}));
const isMutating = (op) => Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op);

/* ---- op-grades R13: each owner's T33 ops, writes with the grade its R3's rule gives them, reads apart ------------------
   The whole op map of each new module; of an earlier module, the ops T33 adds to it (K1549, K1550, K1571, K1572, K1601,
   K1604, K1609, K1640, K1657, K1658). A grade is the rung, or the ground of a stated absence. */
const T33 = {
  events: { map: events.eventsOps, writes: {
      datedfact: "observational", editacts: "observational", readoptin: "substrate", eventcreate: "undetermined",
      eventattest: "undetermined", eventgovern: "reversible", participantadd: "undetermined", participantcorrect: "reasoned",
      eventmerge: "reasoned", eventsplit: "reasoned", eventrelate: "reversible", eventrelationwithdraw: "reasoned",
      actalias: "undetermined", eventimport: "substrate", registerimport: "substrate" } },
  lines: { map: lines.linesOps, writes: { linerecord: "reversible", linewithdraw: "reasoned", linecurrentthrough: "undetermined" } },
  money: { map: money.moneyOps, writes: { moneyrecord: "reversible", moneywithdraw: "reasoned", moneysetcreate: "undetermined",
      moneysetinclude: "reasoned", moneysetexclude: "reasoned", moneysetpropose: "undetermined", moneyfundtype: "undetermined" } },
  "money-checks": { map: moneyChecksOps, writes: { moneycheckparam: "undetermined", moneydetectordefine: "undetermined",
      moneydetectorswitch: "reversible", moneydetectorsrun: "substrate", moneydetectorgate: "substrate" } },
  duties: { map: dutiesOps, writes: { dutypropose: "undetermined", dutyadopt: "reversible", dutydeclare: "reversible",
      dutyrevise: "reasoned", dutywithdraw: "reasoned", dutymatch: "reasoned", dutytransition: "reasoned" } },
  people: { map: people.peopleOps, writes: { identityclaim: "reasoned", identitywithdraw: "reasoned", personfact: "reversible",
      personfactwithdraw: "reasoned", personexpunge: "reasoned", membertie: "reasoned", membertiewithdraw: "reasoned",
      sourcepersonlink: "reasoned", interestcheckdefine: "undetermined", interestcheckswitch: "reversible",
      interestcheckgate: "substrate" } },
  explore: { map: exploreOps, writes: {} },
  hypotheses: { map: hypothesesOps, writes: { hypothesishold: "reversible", hypothesisrevise: "reasoned",
      hypothesiswithdraw: "reasoned", /* op-grades R15 (T34-75) */ notewrite: "caller-owned", noteturn: "caller-owned" } },
  calculations: { map: calculationsOps, writes: { tabledeclare: "undetermined", bindingadopt: "undetermined",
      moneyingest: "reasoned", calculationcreate: "undetermined", calculationaccept: "undetermined",
      calculationdraw: "undetermined", recordset: "observational", patterngate: "substrate", patternswitch: "reversible" } },
  workbooks: { map: workbooksOps, writes: { workbookadd: "undetermined", workbookbind: "reversible", workbookunbind: "reasoned",
      workbookrecompute: "observational", workbooklintexplain: "reasoned", workbookmethodnote: "reasoned",
      workbooksecondcheck: "undetermined" } },
  answers: { map: answersOps, writes: { answercheck: "observational", ruleservicesswitch: "substrate",
      standingset: "caller-owned", standingend: "caller-owned", standingaiswitch: "substrate" } },
  following: { map: followingOps, writes: { followbody: "reversible", unfollow: "reversible", followregister: "reversible",
      followpersonquery: "reversible", followportal: "reversible", permeetingbody: "reversible", refreshregister: "substrate" } },
  standards: { map: standardsOps, part: true, writes: { lawrelate: "reasoned", lawwithdraw: "reasoned",
      lawpropose: "undetermined", courtlink: "reasoned", courttreat: "reasoned" } },
  credentials: { map: credentialsOps, part: true, writes: { accountreferenceset: "credential",
      accountreferenceremove: "credential", aigrantmint: "credential",
      keyedserviceset: "credential", keyedserviceswitch: "substrate" } },
  sources: { map: sourcesOps, part: true, writes: { sourcekeyed: "undetermined" } },
  entities: { map: entitiesOps, part: true, writes: { entityidentify: "reasoned" } },
  inquiry: { map: inquiryOps, part: true, writes: { waitlook: "caller-owned" } },
  "corpus-export": { map: corpusExportOps, part: true, writes: { exportrender: "substrate" } },
  actions: { map: actionsOps, part: true, writes: {} },
  "action-clocks": { map: actionClocksOps, part: true, writes: { clockadopt: "undetermined" } },
  "ai-runs": { map: aiRunsOps, part: true, writes: { airunverify: "reasoned" } } };
/* The ops T33's requirements name whose owners serve them in process but whose route arm is the wiring jobs' (op-declarations
   R17, K1601; instance-setup R50, R53): graded now so the table is total when they are routed. */
const UNROUTED = { clockpropose: "reversible", capturerequestplatformmark: "reversible",
  capturerequestplatformunmark: "reversible", officesseed: "substrate",
  /* B3 (K1689): the ops op-declarations declares beside them */
  seatsseed: "substrate", disclosureshown: "caller-owned", ask: "caller-owned", askusage: "observational" };
/* op-grades R25 (DEC-172 (5); T36-34): `assistantset`, graded `substrate` here since T33, is retired: it leaves RUNG_ABSENT
   and NON_ACTS, so R12 reads no stale row for it. (op-grades R30; DEC-188 (8); K2437, K2514) So are credentials'
   `accountswitchset` (to `accountusesset`) and ai-runs' `aiceilingset` and `aicopyceilingset` (to ai-use's `ailimitset`),
   each graded in op-grades' t41.mjs under the op that replaces it. */
const RETIRED = ["assistantset", "accountswitchset", "aiceilingset", "aicopyceilingset"];
/* A write op-declarations gives no NEEDS row (UNATTENDED_BY_DECISION): ranked, never named in NON_ACTS (R12). */
const UNGATED_WRITES = ["askusage"];
/* op-grades R3's `reversible`: the published act of the owner that takes each result back. */
const TAKEN_BACK_BY = {
  eventgovern: "eventgovern", eventrelate: "eventrelationwithdraw", linerecord: "linewithdraw", moneyrecord: "moneywithdraw",
  moneydetectorswitch: "moneydetectorswitch", dutyadopt: "dutywithdraw", dutydeclare: "dutywithdraw",
  personfact: "personfactwithdraw", interestcheckswitch: "interestcheckswitch", hypothesishold: "hypothesiswithdraw",
  patternswitch: "patternswitch", workbookbind: "workbookunbind", followbody: "unfollow", followregister: "unfollow",
  followpersonquery: "unfollow", followportal: "unfollow", unfollow: "followbody", permeetingbody: "permeetingbody",
};
const ALL_WRITES = { ...Object.assign({}, ...Object.values(T33).map((m) => m.writes)), ...UNROUTED };
const published = () => new Set([...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].map((a) => a.id));

/* K2049 (B4): the ops each of T33's new modules adds in T35, graded by op-grades in its `t35.mjs` (its R22, K2043) and held
   to their owners there; pinned here so the maps stay closed. */
const T35_ADDS = { events: ["discretionrecord", "assessmentrecord", "usewithdraw", "usesof"],
  duties: ["poweruses", "uselink", "useunlink", "reviewpropose"], hypotheses: ["noterevise", "notedelete"],
  calculations: ["usesfreeze", "applicationrecipes"] };
/* K2120, K2121 (T36): calculations' spot-check visit and its read (its R38, R39; K2092), graded by op-grades R23 in its
   `t36.mjs`; pinned here so the map stays closed (the grades, the visit `reasoned` and the read none, are op-grades' tests'). */
const T36_ADDS = { calculations: { spotcheckvisit: "reasoned", spotcheck: null } };
/* T41 (op-declarations R43, K2486; hypotheses R17–R20): the ops hypotheses adds, graded by op-grades R30 in its `t41.mjs`;
   pinned here so the map stays closed (the grades are op-grades' tests'). */
const T41_ADDS = { hypotheses: { hypothesistakeup: "reversible", hypothesissetaside: "reasoned", noteshare: "reversible",
  noteunshare: "reversible", shares: null } };
/* T45 (op-grades R32; K2817, K2822, K2874): the ops duties (its R30, R31), answers (its R34) and following (its R22–R25)
   add, graded by op-grades in its T45 table; pinned here so each map stays closed (the grades are op-grades' tests'). */
const T45_ADDS = { duties: ["dutyfromresponse", "dutiesarising"], answers: ["standingendset"],
  following: ["followend", "watchlink", "watchanswer", "watchquestions"] };

/* T47 (K3104, K3112): people's directory read (its R37, DEC-203), graded by op-grades (T47-48) as a read; pinned here so
   people's map stays closed. */
const T47_ADDS = { people: ["peopledirectory"] };
/* T48 (op-grades R38; `following` R30, N882): following's read of a proceeding's dates, graded by op-grades as a read; pinned here
   so following's map stays closed. */
const T48_ADDS = { following: ["proceedingdates"] };
/* T50 (`following` R32–R34, N1092, DEC-238 S23; K3630): the member marks `watchitem`, `secondlook` and `secondlookclear`, graded by op-grades
   in T50 (T50-18); pinned here so following's map stays closed (the grades are op-grades' tests'). */
const T50_ADDS = { following: ["watchitem", "secondlook", "secondlookclear"] };

/* The reads are not listed: an owner's reads are the ops of its own op map that no rung or absence grades and that no later
   tranche's list above adds as a write; of an earlier module's map (`part`), only those op-grades' T33 table names (T33_NON_ACTS),
   since the rest of that map is other tranches' (a new op of a whole module's map is seen at once; a write is stated above with its grade). */
const LATER_ADDS = new Set([...Object.values(T35_ADDS).flat(), ...Object.values(T36_ADDS).flatMap((o) => Object.keys(o)),
  ...Object.values(T41_ADDS).flatMap((o) => Object.keys(o)), ...Object.values(T45_ADDS).flat(), ...Object.values(T47_ADDS).flat(),
  ...Object.values(T48_ADDS).flat(), ...Object.values(T50_ADDS).flat()]);
for (const m of Object.values(T33))
  m.reads = keysOf(m.map).filter((op) => !isMutating(op) && !LATER_ADDS.has(op) && (!m.part || Object.hasOwn(T33_NON_ACTS, op)));
/* The reads T33 grades whose owners are not among the maps above (capture-requests, instance-setup, standards' layer 9, ai-use's
   usage read, K1689, K2514): the reads of op-grades' T33 table that no listed owner's map serves. */
const UNROUTED_READS = Object.keys(T33_NON_ACTS).filter((op) => !isMutating(op)
  && !Object.values(T33).some((m) => m.reads.includes(op)));
const ALL_READS = [...Object.values(T33).flatMap((m) => m.reads), ...UNROUTED_READS];

test("R12: each new module's op map holds exactly the ops graded for it — T33's, and the ops T35, T36, T41, T45, T47, T48 and T50 add — "
   + "each earlier module's map holds the ops T33 adds to it, and no owner serves a retired op", () => {
  for (const [name, m] of Object.entries(T33)) {
    const keys = keysOf(m.map);
    const mine = [...Object.keys(m.writes), ...m.reads, ...(T35_ADDS[name] ?? []), ...Object.keys(T36_ADDS[name] ?? {}),
      ...Object.keys(T41_ADDS[name] ?? {}), ...(T45_ADDS[name] ?? []), ...(T47_ADDS[name] ?? []), ...(T48_ADDS[name] ?? []),
      ...(T50_ADDS[name] ?? [])];
    assert.deepEqual(Object.keys(m.writes).filter((op) => !isMutating(op)), [], `${name}: a write is graded`);
    if (m.part) assert.deepEqual(mine.filter((op) => !keys.includes(op)), [], name);
    else assert.deepEqual([...keys].sort(), [...mine].sort(), name);
  }
  /* R12: each op a later tranche adds is accounted for — named in NON_ACTS (op-grades' tables carry each; N891: which
     table, and its words, are op-grades' tests') */
  for (const op of [...Object.values(T35_ADDS).flat(), ...Object.values(T36_ADDS).flatMap((ops) => Object.keys(ops)),
                    ...Object.values(T41_ADDS).flatMap((ops) => Object.keys(ops)), ...Object.values(T45_ADDS).flat(),
                    ...Object.values(T47_ADDS).flat(), ...Object.values(T48_ADDS).flat(), ...Object.values(T50_ADDS).flat()])
    assert.ok(Object.hasOwn(NON_ACTS, op) && !published().has(op), op);
  /* retired: served by no owner's map (op-grades' tests hold them graded and named nowhere) */
  for (const op of RETIRED) assert.ok(!keysOf(credentialsOps).includes(op) && !keysOf(aiRunsOps).includes(op), op);
});

test("R19: each `reversible` T33 op is taken back by a published act of its own owner — an op its owner's map serves", () => {
  const ownerOf = (op) => Object.values(T33).find((m) => Object.hasOwn(m.writes, op));
  for (const [op, by] of Object.entries(TAKEN_BACK_BY))
    assert.ok(keysOf(ownerOf(op).map).includes(by), `${op}: ${by} is its owner's op`);
});

/* R52 (T46): `clockadopt`, graded in T33, is offered on an action since T46, so it is the one T33 op that is an act. */
const T33_ACTS_SINCE = ["clockadopt"];
test("R1 R20 R52: no T33 op is an act but clockadopt (R52), and MACHINE_REFUSALS holds only ACTS", () => {
  const t33 = [...Object.keys(ALL_WRITES), ...ALL_READS];
  assert.deepEqual(t33.filter((op) => published().has(op)), T33_ACTS_SINCE);
  assert.deepEqual(Object.keys(MACHINE_REFUSALS).filter((op) => !ACTS.some((a) => a.id === op)), []);
});

test("R12 R24: with the control plane's rows for them (op-declarations R17–R20: every write mutating with a NEEDS "
   + "row, every read a NEEDS row of null) nothing is unaccounted; carried by no row each reads stale; one left out is seen", () => {
  const table = [...Object.keys(ALL_WRITES).map((op) => ({ op, mutating: true, gated: !UNGATED_WRITES.includes(op) })),
    ...ALL_READS.map((op) => ({ op, mutating: false, gated: true }))];
  const all = new Set(table.map((t) => t.op));
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => all.has(op)), []);
  assert.deepEqual([...all].filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  /* K4279 (R12): an owner-declared read the table carries ungated is not stale; a read no row carries is */
  for (const op of ALL_READS) assert.ok(!A.unaccounted([{ op, mutating: false, gated: false }]).stale.includes(op), op);
  for (const op of ALL_READS) assert.ok(A.unaccounted([]).stale.includes(op), op);
  const left = A.unaccounted([...table, { op: "moneyunnamed", mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [["moneyunnamed"], ["moneyunnamed"]]);
  for (const op of Object.keys(ALL_WRITES)) {
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.equal((d.rung === null) !== (d.rung_absence === null), true, `R24: ${op}`);
  }
});

test("R12: the whole catalogue stays consistent with T33's ops in it", () => {
  const ops = new Set([...Object.keys(NON_ACTS), ...ACTS.map((a) => a.id), ...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT)]);
  const table = [...ops].map((op) => ({ op, mutating: Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op),
    gated: Object.hasOwn(NON_ACTS, op) || ACTS.some((a) => a.id === op) }));
  assert.deepEqual(A.unaccounted(table), { unpublished: [], unranked: [], stale: [] });
});

/* ---- R39 ---------------------------------------------------------------------------------------------------------- */
const R39_KEYS = ["event_kinds", "dated_fact_kinds", "event_statuses", "participant_roles", "event_relation_kinds",
  "line_kinds", "line_capacities", "line_roles", "money_kinds", "money_phases", "money_stages", "money_bases",
  "money_precisions", "connection_kinds", "identity_claim_kinds"];
const EVENTS_KEYS = R39_KEYS.filter((k) => /^(event|dated|participant)/.test(k));
const FORBIDDEN = /knows|network|conflict|suspicious|most connected|ledger|diverted|misused/i;
/* R62 (K3366; DEC-253): the design's word for a value is read by key, `label.<set>.<value>` with a value's spaces written `_` */
const labelKey = (set, value) => `label.${set}.${String(value).replace(/ /g, "_")}`;

test("R39: a vocabulary whose owner is not composed answers absent, never empty — events' five before events registers "
   + "with connection-grammar, present after", () => {
  const composed = new Set(owners().map((o) => o.owner));
  assert.equal(composed.has("events"), false, "the instrument starts before events is composed");
  const before = A.vocabulariesFor(null);
  for (const k of EVENTS_KEYS) assert.equal(Object.hasOwn(before, k), false, k);
  for (const k of R39_KEYS.filter((k) => !EVENTS_KEYS.includes(k))) assert.ok(Object.hasOwn(before, k), k);
  eventsWorld().ev.start();
  const after = A.vocabulariesFor(null);
  for (const k of R39_KEYS) assert.ok(Object.hasOwn(after, k), k);
  assert.deepEqual(Object.keys(after).filter((k) => !Object.hasOwn(A.VOCABULARIES, k)).sort(), [...R39_KEYS].sort());
});

test("R39 R4: each vocabulary's values are the very objects its owner answers — the same reference, never a copy — and "
   + "every value carries its word", () => {
  eventsWorld().ev.start();
  const v = A.vocabulariesFor(null);
  const same = [["event_kinds", events.EVENT_KINDS], ["dated_fact_kinds", events.DATED_KINDS], ["event_statuses", events.STATUSES],
    ["participant_roles", events.ROLES], ["event_relation_kinds", events.RELATION_KINDS], ["line_kinds", lines.kinds()],
    ["line_capacities", lines.capacities()], ["money_kinds", money.kinds()], ["money_phases", money.phases()],
    ["money_stages", money.stages()], ["money_bases", money.bases()], ["money_precisions", money.precisions()],
    ["identity_claim_kinds", people.CLAIM_KINDS]];
  assert.deepEqual(same.filter(([k, o]) => v[k].values !== o).map(([k]) => k), []);
  for (const [k, o] of same) {
    assert.deepEqual(Object.keys(v[k].words), [...o], k);
    for (const w of Object.values(v[k].words)) {
      assert.ok(typeof w.word === "string" && w.word.length > 0, k);
      assert.ok(!FORBIDDEN.test(w.word), `${k}: ${w.word}`);
    }
  }
  /* line_roles: each kind's own array from roles(kind), and only kinds that take roles */
  const withRoles = lines.kinds().filter((k) => lines.roles(k).length);
  assert.deepEqual(Object.keys(v.line_roles.values), withRoles);
  for (const k of withRoles) {
    assert.equal(v.line_roles.values[k], lines.roles(k), k);
    assert.deepEqual(Object.keys(v.line_roles.words[k]), [...lines.roles(k)], k);
  }
  /* connection_kinds (N695, K1864): every kind connection-grammar's owners() lists, carried once: `values` the kind
     names in owners()' order, `words` each kind's registered word, class and owner, and nothing else beside them */
  const listed = owners().flatMap((o) => o.kinds.map((k) => [k.kind, { word: k.word, class: k.class, owner: o.owner }]));
  assert.deepEqual(Object.keys(v.connection_kinds), ["values", "words"]);
  assert.deepEqual(v.connection_kinds.values, listed.map(([k]) => k));
  assert.ok(v.connection_kinds.values.every((k) => typeof k === "string"), "the values are kind names, not registry entries");
  assert.equal(new Set(v.connection_kinds.values).size, v.connection_kinds.values.length, "each kind once");
  /* R59 adds each kind's design `group`, checked for totality in t48.test.mjs; R62 reads a kind's word by the design's key where the list
     holds one (a line kind `label.linekinds.*`, a post held `label.connectionkinds.holds` with its capacity, any other
     `label.connectionkinds.*`), else the owner's registered word */
  const designWord = (kind) => {
    const held = /^line:holds:(.+)$/.exec(kind);
    if (held) return hasWord(labelKey("linecapacities", held[1])) && hasWord("label.connectionkinds.holds")
      ? word("label.connectionkinds.holds", { capacity: word(labelKey("linecapacities", held[1])) }) : null;
    const line = /^line:(.+)$/.exec(kind);
    const key = line ? labelKey("linekinds", line[1]) : labelKey("connectionkinds", kind);
    return hasWord(key) ? word(key) : null;
  };
  assert.deepEqual(v.connection_kinds.words, Object.fromEntries(listed.map(([k, e]) =>
    [k, { ...e, word: designWord(k) ?? e.word, group: v.connection_kinds.words[k].group }])));
  /* the design keys a word for these, and it is read by key, not the owner's (control: a registered word that differs is not answered) */
  const keyedKinds = listed.filter(([k]) => designWord(k) !== null);
  assert.ok(keyedKinds.length >= 19, "the design keys the connection kinds it names (DEC-253)");
  assert.equal(v.connection_kinds.words.member_of.word, word("label.connectionkinds.member_of"));
  assert.deepEqual(Object.keys(v.connection_kinds.words), v.connection_kinds.values);
});

test("R39 R62 R63: each word is the design's, read by key through setup-words (DEC-253), else the owner's registered word where it holds "
   + "one, else one plain word marked provisional; every key it reads is a word", (t) => {
  eventsWorld().ev.start();
  const v = A.vocabulariesFor(null);
  const expect = (k, value, registeredKind, set) => {
    const reg = registeredKind ? kindOf(registeredKind) : null;
    const key = set ? labelKey(set, value) : null;
    const want = key && hasWord(key) ? { word: word(key) } : reg ? { word: reg.word }
      : { word: plainWord(value), provisional: true };
    assert.deepEqual(v[k].words[value], want, `${k}.${value}`);
    return key;
  };
  for (const r of events.ROLES) expect("participant_roles", r, `event_${r}`);
  for (const r of events.RELATION_KINDS) expect("event_relation_kinds", r, `event_${r}`);
  for (const k of events.EVENT_KINDS) expect("event_kinds", k, null);
  for (const k of events.DATED_KINDS) expect("dated_fact_kinds", k, null);
  for (const k of events.STATUSES) expect("event_statuses", k, null);
  const read = [];
  for (const k of lines.kinds()) {
    read.push(expect("line_kinds", k, kindOf(`line:${k}`) ? `line:${k}` : null, "linekinds"));
    for (const r of lines.roles(k)) {
      const key = labelKey(`lineroles.${k}`, r);
      assert.deepEqual(v.line_roles.words[k][r], hasWord(key) ? { word: word(key) } : { word: plainWord(r), provisional: true }, `${k}.${r}`);
      read.push(key);
    }
  }
  for (const k of lines.capacities()) read.push(expect("line_capacities", k, null, "linecapacities"));
  for (const k of people.CLAIM_KINDS) read.push(expect("identity_claim_kinds", k, k, "identityclaimkinds"));
  for (const k of money.phases()) read.push(expect("money_phases", k, null, "moneyphases"));
  for (const k of money.stages()) read.push(expect("money_stages", k, null, "moneystages"));
  for (const k of money.kinds()) read.push(expect("money_kinds", k, null, "moneykinds"));
  for (const k of money.bases()) read.push(expect("money_bases", k, null, "moneybases"));
  for (const k of money.precisions()) read.push(expect("money_precisions", k, null, "moneyprecisions"));
  /* every value of the closed vocabularies the owners answer is keyed in the list: no provisional word remains for them */
  for (const key of read) assert.ok(hasWord(key), `${key} is a word`);
  for (const k of ["line_kinds", "line_capacities", "money_kinds", "money_phases", "money_stages", "money_bases", "money_precisions",
                   "identity_claim_kinds"])
    assert.deepEqual(Object.values(v[k].words).filter((w) => w.provisional), [], `${k} has no provisional word`);
  /* the plain word, worked: a status loses `Event`, joined words are spaced */
  assert.equal(plainWord("EventMovedOnline"), "moved online");
  assert.equal(plainWord("stated_cause"), "stated cause");
  assert.equal(plainWord("procuringEntity"), "procuring entity");
  /* a value the list keys is answered by its word, not provisional; a value it does not key stays provisional (the events' own) */
  assert.equal(v.money_stages.words.encumbered.word, word("label.moneystages.encumbered"));
  assert.equal(v.line_kinds.words.holds.provisional, undefined, "holds is keyed by the design");
  assert.equal(v.line_kinds.words.holds.word, word("label.linekinds.holds"));
  assert.equal(v.identity_claim_kinds.words.same_as.word, word("label.identityclaimkinds.same_as"));
  assert.ok(events.EVENT_KINDS.every((k) => v.event_kinds.words[k].provisional === true), "the design keys none of the events' kinds yet");
  /* R63's control: the provisional words are named in the report, never drawn silently */
  const provisional = Object.entries(v).flatMap(([set, voc]) => (set === "line_roles" ? [] : Object.entries(voc.words ?? {}))
    .filter(([, w]) => w && w.provisional === true).map(([value]) => `${set}.${value}`));
  t.diagnostic(`R63: ${provisional.length} provisional words (no design key, no owner word): ${provisional.join(", ")}`);
  assert.ok(provisional.length > 0, "the instrument sees provisional words");
});

test("R63: a connection kind's word is the design's key first (label.linekinds.*, label.connectionkinds.holds with its capacity, any other "
   + "label.connectionkinds.*), else the owner's registered word, never English held here; a kind with no design key draws its owner's word", () => {
  eventsWorld().ev.start();
  const v = A.vocabulariesFor(null).connection_kinds;
  const keyed = (k, vars) => (hasWord(k) ? word(k, vars) : null);
  let byKey = 0, byOwner = 0;
  for (const kind of v.values) {
    const owner = v.words[kind];
    const held = /^line:holds:(.+)$/.exec(kind);
    const line = /^line:(.+)$/.exec(kind);
    let design = null;
    if (held) {
      const capacity = keyed(`label.linecapacities.${held[1].replace(/ /g, "_")}`);
      design = capacity !== null ? keyed("label.connectionkinds.holds", { capacity }) : null;
    } else if (line) design = keyed(`label.linekinds.${line[1].replace(/ /g, "_")}`);
    else design = keyed(`label.connectionkinds.${kind.replace(/ /g, "_")}`);
    const reg = kindOf(kind);
    const want = design ?? (reg && typeof reg.word === "string" && reg.word ? reg.word : null);
    assert.ok(want !== null, `${kind}: a design key or an owner's word`);
    assert.equal(owner.word, want, kind);
    if (design !== null) byKey++; else byOwner++;
  }
  assert.ok(byKey > 0 && byOwner > 0, "both the keyed words and the owners' own are exercised");
  /* control: a kind the design keys draws its word, not the owner's, when they differ */
  assert.equal(v.words.proxy_for.word, word("label.connectionkinds.proxy_for"));
});

test("R39 R26: vocabulariesFor keeps every fixed vocabulary the same object and adds only R39's", () => {
  const v = A.vocabulariesFor(["x"]);
  for (const k of Object.keys(A.VOCABULARIES)) if (k !== "action_kind") assert.equal(v[k], A.VOCABULARIES[k], k);
  assert.deepEqual(Object.keys(composedVocabularies()).filter((k) => !R39_KEYS.includes(k)), []);
});

/* ---- R41 ---------------------------------------------------------------------------------------------------------- */
const GATE = { needs: (id) => (id === "conclude" ? "contribute" : null), mode: () => "session" };
const ROWS = { NO_CONCLUSION: { check: "C-25.3", translation: "A conclusion says what was concluded." } };
const rowOf = (c) => ROWS[c] ?? null;
const inquiryFacts = { ok: true, target: "INQ-1", object_type: "inquiry", declared_type: "inquiry", current_state: "open",
  case_member: false, project_owner: true, basis_legs: 1, rested_on: { working: 0 }, basis_version_states: [],
  basis_versions: 0, contradiction_inquiry: false, actor_is_machine: false };

test("R41: a refusal is explained from its catalogue row as its owner holds it, beside the op's rung, absence, prompt and "
   + "weight; with a target, the acts R17 would answer now (a dry run), and none performed", () => {
  const e = A.explainRefusal({ op: "conclude", code: "NO_CONCLUSION", facts: inquiryFacts, gate: GATE, rowOf });
  assert.deepEqual(Object.keys(e).sort(),
    ["acts", "check", "code", "detail", "op", "prompt", "rung", "rung_absence", "translation", "weight"]);
  assert.equal(e.translation, ROWS.NO_CONCLUSION.translation);
  assert.equal(e.check, "C-25.3");
  assert.equal(e.detail, null);
  const d = A.decorate(ACTS.find((a) => a.id === "conclude"), GATE);
  assert.deepEqual([e.rung, e.rung_absence, e.prompt, e.weight], [d.rung, d.rung_absence, d.prompt, d.weight]);
  assert.deepEqual(e.acts, A.deriveActs(inquiryFacts).map((a) => A.decorate(a, GATE)));
  assert.ok(e.acts.some((a) => a.id === "conclude") && e.acts.every((a) => typeof a.rung === "string" || a.rung_absence));
  /* a write that is no act still answers its grade (op-grades R13's) */
  const w = A.explainRefusal({ op: "linewithdraw", code: "NO_REASON", gate: GATE, rowOf });
  assert.deepEqual([w.rung, w.weight, w.acts], ["reasoned", null, null]);
});

test("R41: a code no catalogue row holds answers translation null with the one sentence that it is not catalogued; "
   + "a target the caller may not see answers no acts; malformed input never throws", () => {
  const e = A.explainRefusal({ op: "conclude", code: "SOMETHING_NEW", gate: GATE, rowOf });
  assert.deepEqual([e.translation, e.check, e.detail], [null, null, word("refusal.uncatalogued")]);
  assert.deepEqual(A.explainRefusal({ op: "conclude", code: "NO_CONCLUSION" }).translation, null, "no lookup handed in");
  assert.deepEqual(A.explainRefusal({ op: "conclude", code: "X", facts: { ok: false, reason: "NO_SUCH_BUNDLE" } }).acts, []);
  for (const bad of [undefined, null, {}, { op: 7, code: {} }, { rowOf: () => { throw new Error("x"); }, code: "NO_CONCLUSION" },
    { facts: { ok: true, object_type: null }, op: "x" }, { gate: { needs: () => { throw new Error("g"); } }, op: "conclude" }])
    assert.doesNotThrow(() => A.explainRefusal(bad));
  /* R64: the sentence is the key `refusal.uncatalogued`, read through `word`; the module no longer composes it (NOT_CATALOGUED is gone) */
  assert.equal(A.NOT_CATALOGUED, undefined);
  assert.equal(hasWord("refusal.uncatalogued"), true);
});

test("R41 R22: the instance's explainRefusal asks the target's facts as the acts would and writes nothing", () => {
  const host = {};
  const a = affordancesOf(host);
  const asked = [];
  a.affordanceFacts = (q) => { asked.push(q); return inquiryFacts; };
  const q = { target: "INQ-1", viewer: "member:ann", identity: "member:ann", author: "member:ann", by: "member:ann" };
  const e = a.explainRefusal({ op: "conclude", code: "NO_CONCLUSION", ...q, gate: GATE, rowOf });
  assert.deepEqual(asked, [q]);
  assert.deepEqual(e.acts, A.deriveActs(inquiryFacts).map((x) => A.decorate(x, GATE)));
  assert.equal(a.explainRefusal({ op: "conclude", code: "NO_CONCLUSION", gate: GATE, rowOf }).acts, null);
  a.affordanceFacts = () => { throw new Error("store"); };
  assert.deepEqual(a.explainRefusal({ op: "conclude", code: "NO_CONCLUSION", target: "INQ-1" }).acts, []);
});
