/* actions' T33 entry at its interface (T33-73): R61 the plan id from record-grammar's one id table; R15's calendar
   dates; R9 narrowed (an office by role and body, its entity filled from the bridge, its holder on the action's date);
   R63 (C-8's plane half); R64 held standards; R65 the proceeding; R62 the suggested addressee; R66 and R67 the event
   and trigger sources; R12, R25 and R33 on the office's local day. Entities, lines, events and duties are the real
   modules on the fixture's host; standards is the real module where a test reads an unheld id, and a stand-in in its
   R5/R20 shape where a test needs a held one (its texts need a captured passage this fixture does not lay down). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, actionMd, CP } from "./fixture.mjs";
import * as actions from "../../../src/actions/index.mjs";
import { noSuchStandard } from "../../../src/standards/index.mjs";
import { notAProceeding } from "../../../src/entities/index.mjs";
import * as grammar from "../../../src/action-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b";
const M = V("alice");
const T = { statement: "the town's own staff page names it" };
const doc = (lines) => actionMd("", lines).replace("id: \n", "");
const reasons = (list) => list.map((r) => r.reason);

/* A registered entity (entities R1); a proceeding with its facet (entities R45). */
function ent(w, kind, label, declaredBy = M) {
  const proceeding = kind === "proceeding"
    ? { forum: ent(w, "institution", `${label}, its forum`), kind: "commitment_suit", number: `MC-26-${String(1000 + (ent.n = (ent.n || 0) + 1)).slice(-4)}` }
    : undefined;
  const r = w.a.entities.createEntity({ kind, label, note: `${label}, registered by the test`, declaredBy, proceeding });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.entity_id;
}
const line = (w, kind, from, to, extra = {}) => {
  const r = w.a.lines.recordLine({ kind, from, to, basis: T, by: M, ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.line_id;
};
/* The Town Clerk of the Town of Port Ellery (the fixture's CP), seeded as instance-setup R50 seeds an office: an office
   entity, its body, and a `post_in` line; with a holder for 2026. */
function seeded(w) {
  const office = ent(w, "office", "Town Clerk"), body = ent(w, "body", "Town of Port Ellery");
  line(w, "post_in", office, body, { valid: { from: "2000-01-01", to: "2099-12-31" } });
  const person = ent(w, "person", "A. Holder");
  line(w, "holds", person, office, { capacity: "appointed", valid: { from: "2026-01-01", to: "2026-12-31" } });
  return { office, body, person };
}

test("R61 the plan id is tested by record-grammar's one id table: a counter of four or more digits; every id valid before stays valid", () => {
  const w = world();
  const link = (id, plan) => w.promote(id, actionMd(id, [...CP, "action_kind: other", `plan: ${plan}`, "option: o"]));
  assert.equal(link("ACTN-2026-0011-a", "PLN-2026-0001").ok, true, "four digits, as before");
  assert.equal(link("ACTN-2026-0012-a", "PLN-2026-0001-the-plan").ok, true, "with a slug");
  assert.equal(link("ACTN-2026-0013-a", "PLN-2026-10000").ok, true, "the 10,000th plan of a year");
  for (const bad of ["PLN-26-0001", "PLN-2026-001", "PLAN-2026-0001", "PLN-2026-0001-Slug"])
    assert.equal(link("ACTN-2026-0014-a", bad).reason, "PLAN_LINK_REFUSED", bad);
});

test("R15 BAD_DATE refuses a YYYY-MM-DD that names no calendar day (civil-time R6); a real one lands", () => {
  const w = world();
  w.action(A);
  const c = (at) => w.a.actionCorrespond({ target: A, direction: "sent", at, account: "asked", viewer: M, author: M });
  for (const at of ["2026-02-31", "2026-13-01", "2026-02-29", "2026-9-01"]) assert.equal(c(at).reason, "BAD_DATE", at);
  assert.equal(c("2024-02-29").ok, true, "a leap day");
  assert.equal(c("2026-02-28").ok, true);
  assert.equal(w.fm(A).correspondence.length, 2, "nothing written by a refusal");
});

test("R9 R47 actionCreate fills an office arm's entity id from the one office entity held for its role and body; none or several, written without and said so", () => {
  const w = world();
  const none = w.a.actionCreate({ document: doc([...CP, "action_kind: other"]), viewer: M, author: M });
  assert.deepEqual([none.ok, none.addressee.entity_id, none.addressee.filled], [true, null, "none"]);
  assert.equal(w.fm(none.id).counterparty.entity_id, undefined, "written without one");
  const { office } = seeded(w);
  const c = w.a.actionCreate({ document: doc([...CP, "action_kind: other"]), viewer: M, author: M });
  assert.deepEqual([c.addressee.entity_id, c.addressee.filled], [office, "bridge"]);
  assert.equal(w.fm(c.id).counterparty.entity_id, office, "filled at the write");
  assert.equal(w.fm(c.id).counterparty.role, "Town Clerk", "addressed by role and body");
  /* a stated entity id is the member's, and never replaced */
  const stated = w.a.actionCreate({ document: doc([...CP, `  entity_id: ${office}`, "action_kind: other"]), viewer: M, author: M });
  assert.deepEqual([stated.ok, "addressee" in stated], [true, false]);
  /* two office entities held for the role and body: none is chosen (the twin a machine's, since a member naming a held
     office again is answered the held one, entities R65) */
  const twin = ent(w, "office", "Town Clerk", MACHINE);
  line(w, "post_in", twin, w.a.entities.entitiesByAlias({ alias: "Town of Port Ellery" }).entities[0].entity_id);
  const amb = w.a.actionCreate({ document: doc([...CP, "action_kind: other"]), viewer: M, author: M });
  assert.deepEqual([amb.addressee.entity_id, amb.addressee.filled], [null, "ambiguous"]);
  assert.equal(w.fm(amb.id).counterparty.entity_id, undefined);
});

test("R9 R25 the read shows who held the office on the action's date, labelled so, never as the addressee; the date is the first sent entry's, else the creation's", () => {
  const w = world();
  const { office, person } = seeded(w);
  /* promoted directly, with no entity id: held as written, the bridge read at read time */
  w.action(A);
  let r = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual(r.as_of_date, { date: "2026-09-01", basis: r.as_of_date.basis });
  assert.match(r.as_of_date.basis, /created/);
  assert.deepEqual([r.addressee.role, r.addressee.body, r.addressee.entity_id, r.addressee.filled],
    ["Town Clerk", "Town of Port Ellery", office, "bridge"]);
  assert.deepEqual([r.addressee.holder_on_date.holder, r.addressee.holder_on_date.on, r.addressee.holder_on_date.capacity],
    [person, "2026-09-01", "appointed"]);
  assert.match(r.addressee.holder_on_date.says, /never to them/);
  assert.equal(w.fm(A).counterparty.entity_id, undefined, "the read writes nothing");
  /* a sent entry outside the holder's line: the date moves, and no line covers it */
  w.a.actionCorrespond({ target: A, direction: "sent", at: "2027-02-01", account: "asked", viewer: M, author: M });
  r = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([r.as_of_date.date, r.addressee.holder_on_date.holder, r.addressee.holder_on_date.undetermined,
    r.addressee.holder_on_date.why], ["2027-02-01", null, true, { key: "lines.why.no_line_covers", vars: {} }],
    "lines' reason is passed on by key (lines R11, R24), never as text");
  /* another addressee has none; an earlier name-only one reads as written */
  w.promote(B, actionMd(B, ["counterparty:", "  state: audience", '  description: "readers"', "action_kind: other"]));
  assert.equal(w.a.actionRead({ id: B, viewer: M }).addressee, null);
  const old = "ACTN-2026-0005-o";
  w.promote(old, actionMd(old, ["counterparty:", "  state: named", "  name: City Clerk", "action_kind: other"]), { extra: { replay: true } });
  const o = w.a.actionRead({ id: old, viewer: M }).addressee;
  assert.deepEqual([o.role, o.entity_id, o.filled, o.holder_on_date.holder], ["City Clerk", null, "none", null]);
  /* the decoration answers the same keys */
  assert.equal(w.decorate(A, undefined, M).action.addressee.holder_on_date.on, "2027-02-01");
});

test("R63 (C-8's plane half) a new bare-name counterparty is refused COUNTERPARTY_REFUSED with its findings, through actionCreate, op=actioncreate and op=promote alike; never stored; one already held reads as written", () => {
  const w = world();
  const bare = ["counterparty:", "  state: named", "  name: City Clerk", "action_kind: other"];
  const via = [w.a.actionCreate({ document: doc(bare), viewer: M, author: M }),
    actions.actionsOps(w.a, new URL(`https://x/?viewer=${M}&author=${M}`), { document: doc(bare) }).actioncreate(),
    w.promote(A, actionMd(A, bare))];
  for (const r of via) {
    assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, "COUNTERPARTY_REFUSED", "COUNTERPARTY_REFUSED", "C-101.3"]);
    assert.ok(Array.isArray(r.findings) && r.findings.length, JSON.stringify(r));
    assert.ok(r.translation.length > 20);
  }
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM bundles WHERE object_type='action'`)[0].n, 0, "never stored");
  /* a revision introducing it is refused too; a held one carried forward lands (R9 reads it as written) */
  w.action(B);
  assert.equal(w.promote(B, w.text(B).replace(/counterparty:\n  state: named\n  role: Town Clerk\n  body: Town of Port Ellery/,
    "counterparty:\n  state: named\n  name: City Clerk")).reason, "COUNTERPARTY_REFUSED");
  const old = "ACTN-2026-0005-o";
  assert.equal(w.promote(old, actionMd(old, bare), { extra: { replay: true } }).ok, true);
  assert.equal(w.promote(old, w.text(old).replace("An action.", "Revised.")).ok, true, "a revision of a held bare-name action lands");
  /* negative control: role and body land */
  assert.equal(w.a.actionCreate({ document: doc([...CP, "action_kind: other"]), viewer: M, author: M }).ok, true);
});

const S1 = "STD-2026-0001-records-act", S2 = "STD-2026-0002-old-bylaw";
const standardsStandIn = () => ({
  standardRead: ({ id, viewer }) => ([S1, S2].includes(id) && viewer && viewer !== "nobody" ? { ok: true, id } : noSuchStandard(id)),
  inForceAt: ({ standard, date }) => (standard === S2 && date >= "2026-06-01"
    ? { state: "not_in_force", why: "its period ended 2026-05-31", standard }
    : { state: "in_force", why: "its period covers the date", standard }),
});

test("R64 R18 R25 a governing law may name a held standard the viewer may see; the citation stays the member's; the read answers both with the standard's state on the action's date", () => {
  const w = world({ deps: { standards: standardsStandIn() } });
  w.action(A);
  const L = (laws, x) => w.a.actionLaws({ target: A, laws, viewer: M, author: M, ...x });
  const unseen = L([{ level: "state", citation: "Records Act s.3", standard: "STD-2026-0404-none" }]);
  assert.deepEqual(unseen, { ...noSuchStandard("STD-2026-0404-none"), target: A }, "standards' one answer");
  assert.equal(L([{ level: "state", citation: "x", standard: S1 }], { viewer: "nobody" }).reason, "NO_SUCH_BUNDLE");
  assert.equal(L([{ level: "state", citation: "x", standard: "not an id" }]).reason, "NO_SUCH_STANDARD", "a malformed id");
  assert.equal(w.fm(A).governing_laws, undefined, "nothing written");
  const ok = L([{ level: "state", citation: "Records Act s.3", standard: S1 }, { level: "city", citation: "Bylaw 4", standard: S2 },
                { level: "county", citation: "County Code 9" }]);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const fm = w.fm(A);
  assert.deepEqual(fm.governing_laws.map((l) => [l.citation, l.standard ?? null]),
    [["Records Act s.3", S1], ["Bylaw 4", S2], ["County Code 9", null]], "the member's citation is kept as stated");
  const read = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual(read.law_standards.map((l) => [l.citation, l.standard, l.in_force.state, l.in_force.on]),
    [["Records Act s.3", S1, "in_force", "2026-09-01"], ["Bylaw 4", S2, "not_in_force", "2026-09-01"]]);
  assert.match(read.law_standards[1].in_force.why, /ended/);
  /* the standard's state follows the action's date */
  w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-05-01", account: "asked", viewer: M, author: M });
  assert.equal(w.a.actionRead({ id: A, viewer: M }).law_standards[1].in_force.state, "in_force");
  /* R25: a proposal stored apart (action-records R1) may name one, and the read answers it with it */
  assert.equal(w.a.records.actionLawsPropose({ target: A, laws: [{ level: "state", citation: "Records Act", standard: S1 }],
    proposer: MACHINE, viewer: MACHINE }).ok, true);
  assert.equal(w.a.actionRead({ id: A, viewer: M }).governing_laws_proposals.proposals[0].laws[0].standard, S1);
  assert.equal(w.fm(A).governing_laws.length, 3, "a proposal never sets the list");
});

test("R64 (T47) whether a standard is one the viewer may see is action-records.standardSeen (its R9), asked by actionLaws, by the records law's write and by the read", () => {
  const w = world({ deps: { standards: standardsStandIn() } });
  w.action(A);
  for (const [id, viewer] of [["STD-2026-0404-none", M], [S1, "nobody"], ["not an id", M], ["", M]]) {
    const judged = w.a.records.standardSeen(id, viewer);
    assert.deepEqual(judged, noSuchStandard(id), `${id} for ${viewer}`);
  }
  /* actionLaws answers its refusal, with the target beside it */
  assert.deepEqual(w.a.actionLaws({ target: A, laws: [{ level: "state", citation: "x", standard: "STD-2026-0404-none" }], viewer: M, author: M }),
    { ...w.a.records.standardSeen("STD-2026-0404-none", M), target: A });
  /* the records law's held standard, at the write */
  const rr = (std) => actionMd(B, [...CP, "action_kind: records_request", "law: Records Act s.3", `law_standard: ${std}`]);
  assert.deepEqual(w.promote(B, rr("STD-2026-0404-none")).reason, w.a.records.standardSeen("STD-2026-0404-none", M).reason);
  /* the control: a standard the viewer may see is null there, and lands at both acts */
  assert.equal(w.a.records.standardSeen(S1, M), null);
  assert.equal(w.promote(B, rr(S1)).ok, true);
  assert.equal(w.a.actionLaws({ target: A, laws: [{ level: "state", citation: "x", standard: S1 }], viewer: M, author: M }).ok, true);
  /* the read: a standard the viewer may not see is answered unread */
  const unseen = w.a.actionRead({ id: B, viewer: "nobody" });
  assert.equal(unseen.ok, false, "an action the viewer may not see is not read at all");
  assert.equal(w.a.actionRead({ id: B, viewer: M }).law_standards[0].in_force.state, "in_force");
});

test("R64 R5 a records-request law may name a held standard as `law_standard`: a member's statement, of a stated law, the viewer may see", () => {
  const w = world({ deps: { standards: standardsStandIn() } });
  const md = (lines) => actionMd(A, [...CP, "action_kind: records_request", ...lines]);
  assert.equal(w.promote(A, md(['law: "Records Act s.3"', `law_standard: ${S1}`]), { author: MACHINE }).reason,
    "MACHINE_CANNOT_STATE_RECORDS_LAW", "a machine states neither");
  assert.equal(w.promote(A, md([`law_standard: ${S1}`])).reason, "RECORDS_LAW_REFUSED", "a standard of no stated law");
  assert.equal(w.promote(A, md(['law: "Records Act s.3"', "law_standard: STD-2026-0404-none"])).reason, "NO_SUCH_STANDARD");
  assert.equal(w.record.head(A), null, "nothing was written");
  assert.equal(w.promote(A, md(['law: "Records Act s.3"', `law_standard: ${S1}`])).ok, true);
  const r = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([r.records_law.law, r.law_standards[0].law, r.law_standards[0].standard, r.law_standards[0].in_force.state],
    ["Records Act s.3", "records", S1, "in_force"]);
  assert.equal(w.promote(A, w.text(A).replace(S1, S2), { author: MACHINE }).reason, "MACHINE_CANNOT_STATE_RECORDS_LAW", "nor changes one");
  assert.equal(w.promote(A, w.text(A).replace("An action.", "Revised."), { author: MACHINE }).ok, true, "carried forward");
  /* the real standards module answers an unheld standard through its own refusal */
  const real = world();
  real.action(A);
  const x = real.a.actionLaws({ target: A, laws: [{ level: "state", citation: "y", standard: "STD-2026-0001-x" }], viewer: M, author: M });
  assert.deepEqual([x.reason, x.check], ["NO_SUCH_STANDARD", noSuchStandard("x").check]);
});

test("R65 an action may state its proceeding: set and changed by a member, an entity of kind proceeding; shown with its status on the action's date; a filter of actionsFor", () => {
  const w = world();
  const P = ent(w, "proceeding", "Harbour suit"), office = ent(w, "office", "Clerk of the Court");
  const md = (id, extra) => actionMd(id, [...CP, "action_kind: other", ...extra]);
  assert.equal(w.promote(A, md(A, [`proceeding: ${P}`]), { author: MACHINE }).reason, "MACHINE_CANNOT_SET_PROCEEDING");
  const absent = w.promote(A, md(A, ["proceeding: ENT-2026-0404"]));
  assert.deepEqual([absent.reason, absent.end], ["NO_SUCH_ENTITY", "proceeding"]);
  assert.deepEqual([w.promote(A, md(A, [`proceeding: ${office}`])).reason], ["NOT_A_PROCEEDING"]);
  /* the machine refusal carries its row (C-117.27), minted at the region its `where` names */
  const m = w.promote(A, md(A, [`proceeding: ${P}`]), { author: MACHINE });
  assert.deepEqual([m.reason, m.code, m.check, m.translation], ["MACHINE_CANNOT_SET_PROCEEDING", "MACHINE_CANNOT_SET_PROCEEDING", "C-117.27",
    grammar.ACTION_CATALOGUE_CHECKS.MACHINE_CANNOT_SET_PROCEEDING.translation]);
  assert.equal(grammar.ACTION_CATALOGUE_CHECKS.MACHINE_CANNOT_SET_PROCEEDING.where, "src/actions/index.mjs #heldLinks > is-machine-set-proceeding");
  /* R104 (T48): a non-proceeding answers through `entities.notAProceeding`, its one site and row (t48.test.mjs) */
  const np = w.promote(A, md(A, [`proceeding: ${office}`]));
  assert.deepEqual([np.reason, np.code, np.check], ["NOT_A_PROCEEDING", "NOT_A_PROCEEDING", notAProceeding().check]);
  assert.equal(w.record.head(A), null);
  assert.equal(w.promote(A, md(A, [`proceeding: ${P}`])).ok, true);
  w.action(B);
  const r = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([r.proceeding.entity_id, r.proceeding.on, r.proceeding.status.stage], [P, "2026-09-01", "undetermined"]);
  assert.match(r.proceeding.status.why, /no held event/);
  assert.equal(w.a.actionRead({ id: B, viewer: M }).proceeding, null);
  assert.deepEqual(w.a.actionsFor({ viewer: M, proceeding: P }).items.map((x) => x.id), [A]);
  assert.deepEqual(actions.actionsOps(w.a, new URL(`https://x/?viewer=${M}&proceeding=${P}`), null).actions().items.map((x) => x.id), [A]);
  /* changed and removed only by a member */
  assert.equal(w.promote(A, w.text(A).replace(`proceeding: ${P}\n`, ""), { author: MACHINE }).reason, "MACHINE_CANNOT_SET_PROCEEDING");
  assert.equal(w.promote(A, w.text(A).replace("An action.", "Revised."), { author: MACHINE }).ok, true, "carried forward");
  assert.equal(w.promote(A, w.text(A).replace(`proceeding: ${P}\n`, "")).ok, true, "a member removes it");
});

test("R62 addresseeSuggest answers the offices held as custodian_of or responsible_for a subject, as R9's office arm, with the line and its grades on the date; a suggestion that writes nothing", () => {
  const w = world();
  const { office, body } = seeded(w);
  const contract = ent(w, "contract", "Harbour dredging contract");
  const lid = line(w, "custodian_of", office, contract, { valid: { from: "2020-01-01", to: "2030-12-31" } });
  const loose = ent(w, "office", "Harbour Master");                       /* placed in no body */
  line(w, "responsible_for", loose, contract, { valid: { from: "2020-01-01", to: "2030-12-31" } });
  const before = w.rows(`SELECT COUNT(*) AS n FROM manifest`)[0].n;
  const s = w.a.addresseeSuggest({ subject: contract, viewer: M });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.deepEqual(s.offices.map((o) => o.addressee),
    /* R115 (T53): with the layer that gives the office, null where no layered profile does */
    [{ state: "named", kind: "office", role: "Town Clerk", body: "Town of Port Ellery", entity_id: office, layer: null }]);
  assert.deepEqual([s.offices[0].line.line_id, s.offices[0].line.kind, "assertion" in s.offices[0].line.grades, "ends" in s.offices[0].line.grades],
    [lid, "custodian_of", true, true]);
  assert.deepEqual(s.undetermined.map((u) => [u.office, u.why]), [[loose, word("actions.why.line_date_places")]]);
  assert.match(s.says, /nothing was set/);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM manifest`)[0].n, before, "writes nothing");
  /* on an action's date: a line ending before it is not held */
  const early = ent(w, "contract", "An old contract");
  line(w, "custodian_of", office, early, { valid: { from: "2001-01-01", to: "2005-12-31" } });
  w.action(A);
  const onDate = w.a.addresseeSuggest({ action: A, subject: early, viewer: M });
  assert.deepEqual([onDate.at, onDate.offices.length, onDate.undetermined.length], ["2026-09-01", 0, 0]);
  assert.match(onDate.says, /holds no/);
  /* a record the action rests on, through the entities its captures resolve to at an established grade */
  const s0 = w.doc("INFO-2026-0001-d");
  w.st.sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, established, method, basis, resolved_by, at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`, s0, "INFO-2026-0001-d", "r1", contract, "A", 1, "m", "b", M, "2026-09-01T00:00:00Z");
  assert.deepEqual(w.a.addresseeSuggest({ subject: "INFO-2026-0001-d", viewer: M }).offices.map((o) => o.addressee.entity_id), [office]);
  /* refusals */
  const ns = w.a.addresseeSuggest({ viewer: M });
  assert.deepEqual([ns.code, ns.check, ns.translation], ["NO_SUBJECT", "C-117.26", grammar.ACTION_CATALOGUE_CHECKS.NO_SUBJECT.translation]);
  assert.equal(grammar.ACTION_CATALOGUE_CHECKS.NO_SUBJECT.where, "src/actions/index.mjs addresseeSuggest > is-addressee-subject");
  assert.deepEqual(reasons([w.a.addresseeSuggest({ viewer: M }), w.a.addresseeSuggest({ subject: "ENT-2026-0404", viewer: M }),
    w.a.addresseeSuggest({ subject: "INFO-2026-0404-x", viewer: M }), w.a.addresseeSuggest({ action: "ACTN-2026-0404-x", subject: contract, viewer: M }),
    w.a.addresseeSuggest({ subject: "INFO-2026-0001-d", viewer: "nobody" })]),
    ["NO_SUBJECT", "NO_SUCH_ENTITY", "NO_SUCH_BUNDLE", "NO_SUCH_BUNDLE", "NO_SUCH_BUNDLE"]);
  const op = actions.actionsOps(w.a, new URL(`https://x/?subject=${contract}&viewer=${M}`), null).addresseesuggest();
  assert.equal(op.offices[0].addressee.entity_id, office);
  void body;
});

test("R111 R62 addresseeSuggest given an office entity as the subject answers that office as named, with its body; an office placed in no body is undetermined, never absent", () => {
  const w = world();
  const { office } = seeded(w);
  const named = w.a.addresseeSuggest({ subject: office, viewer: M });
  assert.equal(named.ok, true, JSON.stringify(named));
  assert.deepEqual(named.offices.map((o) => o.addressee),
    /* R115 (T53): with the layer that gives the office, null where no layered profile does (this profile has no layers) */
    [{ state: "named", kind: "office", role: "Town Clerk", body: "Town of Port Ellery", entity_id: office, layer: null }]);
  assert.deepEqual(named.undetermined, []);
  const loose = ent(w, "office", "Harbour Master");
  const u = w.a.addresseeSuggest({ subject: loose, viewer: M });
  assert.deepEqual([u.offices.length, u.undetermined.map((x) => [x.office, x.why])], [0, [[loose, word("actions.why.line_date_places")]]]);
  assert.equal(actions.actionsOps(w.a, new URL(`https://x/?subject=${office}&viewer=${M}`), null).addresseesuggest().offices[0].addressee.entity_id, office);
});

test("R66 the 'what we did' source: the group's correspondence and moves on visible actions touching the set, at their own dates, windowed and bounded; registered once with events", () => {
  const w = world();
  const { office } = seeded(w);
  const P = ent(w, "proceeding", "Harbour suit");
  w.doc("INFO-2026-0001-d");
  w.action(A, [`proceeding: ${P}`, "action_basis:", "  - target: INFO-2026-0001-d", "    kind: rests_on"]);
  w.promote(B, actionMd(B, ["counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery",
    `  entity_id: ${office}`, "action_kind: other"]));
  const c = (t, at, d = "sent") => assert.equal(w.a.actionCorrespond({ target: t, direction: d, at, account: "x", viewer: M, author: M }).ok, true);
  c(A, "2026-09-02"); c(A, "2026-09-10", "no_response"); c(B, "2026-09-05");
  assert.equal(w.a.actionMove({ target: B, to: "active", reason: "sent", viewer: M, author: M }).ok, true);
  const src = (x) => w.a.eventSource({ viewer: M, ...x });
  assert.deepEqual(src({ set: [office] }).map((i) => [i.at, i.kind, i.ref]),
    [["2026-09-05", "correspondence_sent", `${B}#correspondence/0`], ["2026-09-28T12:00:00Z", "move", `${B}#move/0`]]);
  assert.deepEqual(src({ set: [P] }).map((i) => i.ref), [`${A}#correspondence/0`, `${A}#correspondence/1`], "by its proceeding");
  assert.deepEqual(src({ set: ["INFO-2026-0001-d"] }).map((i) => i.kind), ["correspondence_sent", "correspondence_no_response"], "by a leg");
  assert.deepEqual(src({ set: [P, office], from: "2026-09-03", to: "2026-09-27" }).map((i) => i.at), ["2026-09-05", "2026-09-10"], "windowed");
  assert.equal(src({ set: [P, office], limit: 2 }).length, 2, "bounded");
  assert.ok(src({ set: [office] }).every((i) => Object.keys(i).sort().join() === "at,kind,label,ref"));
  assert.deepEqual([src({ set: [office], viewer: "nobody" }), src({ set: [office], viewer: null }), src({ set: [] })], [[], [], []],
    "an invisible action, or no viewer, contributes nothing");
  /* registered once with the real events module: its "what we did" lane names this source; a second is refused */
  const ours = w.a.events.timeline({ set: [office], viewer: M }).ours;
  assert.deepEqual(ours.sources.map((x) => x.source), ["actions"]);
  assert.equal(w.a.events.registerEventSource("actions", () => []).ok, false);
});

test("R67 the trigger source: each sent entry of a records request addressed to the duty's obligor office, with its date; registered once with duties", () => {
  const w = world();
  const { office } = seeded(w);
  const other = ent(w, "office", "Harbour Master");
  const at = (id, kind, eid) => w.promote(id, actionMd(id, ["counterparty:", "  state: named", "  role: Town Clerk",
    "  body: Town of Port Ellery", `  entity_id: ${eid}`, `action_kind: ${kind}`]));
  assert.equal(at(A, "records_request", office).ok, true);
  assert.equal(at(B, "other", office).ok, true);
  void other;
  for (const [t, d] of [[A, "2026-09-02"], [A, "2026-09-20"], [B, "2026-09-03"]])
    assert.equal(w.a.actionCorrespond({ target: t, direction: "sent", at: d, account: "asked", viewer: M, author: M }).ok, true);
  w.a.actionCorrespond({ target: A, direction: "received", at: "2026-09-04", account: "reply", viewer: M, author: M });
  const duty = { duty_id: "DUT-2026-0001", obligor: office, trigger: { kind: "source", source: "actions" } };
  const src = (x) => w.a.triggerSource({ duty, viewer: M, ...x });
  assert.deepEqual(src({}).map((i) => [i.ref, i.date]), [[`${A}#correspondence/0`, "2026-09-02"], [`${A}#correspondence/1`, "2026-09-20"]]);
  assert.deepEqual(src({ from: "2026-09-10", to: "2026-09-30" }).map((i) => i.date), ["2026-09-20"], "windowed");
  assert.deepEqual(src({ duty: { ...duty, trigger: { ...duty.trigger, action_kinds: ["other"] } } }).map((i) => i.ref), [`${B}#correspondence/0`],
    "another kind the trigger names");
  assert.deepEqual(src({ duty: { ...duty, obligor: "ENT-2026-0404" } }), [], "another obligor");
  assert.deepEqual([src({ viewer: "nobody" }), src({ viewer: null })], [[], []], "an action the viewer may not see contributes nothing");
  /* registered once with the real duties module */
  const again = w.a.duties.registerTriggerSource("actions", () => []);
  assert.equal(again.ok, false);
});

test("R33 R25 the mechanical recheck and the lifecycle read on the office's local day: a deadline of today has not passed until the local day ends", () => {
  const w = world();
  const clock = (d) => ["clock:", '  - text: "t"', '    description: "d"', `    date: ${d}`, "    basis: s", "    status: pending"];
  const recheck = { writer: "mechanical", operation: "deadline-recheck" };
  w.action(A, clock("2026-09-28"));
  /* 23:00 on the 28th in Halifax is 02:00 UTC on the 29th: the UTC day would say the 28th has passed */
  w.clock.ms = Date.parse("2026-09-29T02:00:00Z");
  assert.equal(w.promote(A, w.text(A).replace("status: pending", "status: overdue"), { author: MACHINE, extra: recheck }).reason,
    "CLOCK_STATUS_NOT_MECHANICAL");
  w.clock.ms = Date.parse("2026-09-29T03:00:00Z");
  assert.equal(w.promote(A, w.text(A).replace("status: pending", "status: overdue"), { author: MACHINE, extra: recheck }).ok, true,
    "the local day after");
  /* no zone held: no entry has passed, so the machine moves nothing */
  const nz = world({ profiles: null });
  nz.action(B, clock("2020-01-01"));
  assert.equal(nz.promote(B, nz.text(B).replace("status: pending", "status: overdue"), { author: MACHINE, extra: recheck }).reason,
    "CLOCK_STATUS_NOT_MECHANICAL");
  assert.equal(nz.a.actionRead({ id: B, viewer: M }).clock_overdue, null, "R25: undetermined with no zone");
});

test("R51 the audit's arm is handed the zone of the action's office (ctx.zone): a pending entry is past its date only once that local day has ended; with no zone none is", () => {
  const md = actionMd(A, [...CP, "action_kind: other", "clock:", '  - text: "t"', '    description: "d"', "    date: 2026-09-28",
    "    basis: s", "    status: pending"]);
  const pastDue = (w) => w.a.audit({ files: new Map([["bundle.md", md]]) }).some((f) => f.check === "C-11.1" && /past-due/.test(f.message));
  const w = world();
  /* 23:00 on the 28th in Halifax is 02:00 UTC on the 29th: the UTC day would report it past */
  w.clock.ms = Date.parse("2026-09-29T02:00:00Z");
  assert.equal(pastDue(w), false, "the office's local day has not ended");
  w.clock.ms = Date.parse("2026-09-29T03:00:00Z");
  assert.equal(pastDue(w), true, "the local day after");
  const nz = world({ profiles: null });
  nz.clock.ms = Date.parse("2026-12-01T00:00:00Z");
  assert.equal(pastDue(nz), false, "no zone held: no entry is past its date");
});
