/* T33-83 at the module's interface: the five kinds `notice-producers` raises (R1), its one read beside the producers
   (R51) with its items homed, minted, offered, muted, decided and sorted alike (R7, R11, R12, R13, R14, R49), the
   dispositions of the new kinds (R12, R28), and the local day (R21, R22; K1444 (iii)). `notice-producers` is not yet
   merged, so its `noticeItems` is a fake in the shape its R1 publishes (K1563 (1)). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW, iso, byId } from "./world.mjs";
import { Queue, QUEUE_MINT_CHECKS } from "../../../src/queue/index.mjs";
import { classOfKind, QUEUE_OBLIGATION_KINDS, QUEUE_FINDING_KINDS } from "../../../src/queuestate.mjs";
import { noticeProducersOf } from "../../../src/notice-producers/index.mjs";
import { NONE } from "../notice-producers/fixture.mjs";
import { checkResults } from "../people/fixtures.mjs";
import { noticed } from "../money-checks/fixtures.mjs";
import { dutiesForViewer } from "../duties/fixtures.mjs";
import { standingAnswersHeldBack } from "../answers/fixtures.mjs";
import { datedWaitOf } from "../inquiry/fixtures.mjs";

const HOUR = 3600000;
const item = (id, kind, cls, subjects, a, extra = {}) => ({ id, class: cls, kind, subject: { kind: "bundle", id: subjects[0] ?? null },
  summary: kind, detail: null, basis: { source: "notice-producers", detail: "stub" }, age: { state: "determined", since: iso(NOW - HOUR), ms: HOUR },
  assignee: null, assignee_role: null, options: a.optionsOf(subjects), case: a.homesOf(subjects), ...extra });

/* One item of each new kind, the way notice-producers R2–R6 key them; PRJ-A holds DOC-1, INQ-1 rests on DOC-2. */
function noticedWorld({ make = null, facts = {}, extraFakes = {} } = {}) {
  const asked = [];
  const w = world({ notices: { noticeItems: (a) => {
    asked.push(a);
    const items = make ? make(a) : [
      item("FINDING::interest-check-noticed::CHK-1::r1", "interest-check-noticed", "FINDING", ["DOC-1"], a),
      item("FINDING::money-detector-noticed::DET-1::r1", "money-detector-noticed", "FINDING", ["DOC-1"], a),
      item("FINDING::standing-answer::STQ-1::run1", "standing-answer", "FINDING", [], a),
      item("FINDING::temporal-expectation-due::DUT-1::o1", "temporal-expectation-due", "FINDING", ["DOC-1"], a, { due: "2026-09-03" }),
      item("OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31", "inquiry-recheck-due", "OBLIGATION", ["INQ-1"], a, { due: "2026-08-31" }),
    ];
    return { items, facts };
  } }, ...extraFakes });
  w.asked = asked;
  w.member("alice"); w.member("bob");
  w.bundle("DOC-1"); w.bundle("DOC-2");
  w.bundle("PRJ-A", "project"); w.join("PRJ-A", "alice"); w.cite("PRJ-A", "DOC-1");
  w.bundle("INQ-1", "inquiry"); w.leg("INQ-1", "DOC-2");
  return w;
}

test("R1: the five kinds notice-producers raises are classed (the dated wait a to-do, the rest noticed), each with its sentence", () => {
  assert.equal(classOfKind("inquiry-recheck-due"), "OBLIGATION");
  for (const k of ["interest-check-noticed", "money-detector-noticed", "standing-answer", "temporal-expectation-due"])
    assert.equal(classOfKind(k), "FINDING", k);
  assert.match(QUEUE_OBLIGATION_KINDS["inquiry-recheck-due"], /a date you set to look again at a question has come/);
  assert.match(QUEUE_FINDING_KINDS["interest-check-noticed"], /the machine noticed a pattern among people's facts that a check you may see describes; labeled as the machine's, not a judgment of anyone/);
  assert.match(QUEUE_FINDING_KINDS["money-detector-noticed"], /the machine noticed a pattern in the money facts that a detector describes; labeled as the machine's/);
  assert.match(QUEUE_FINDING_KINDS["standing-answer"], /your standing question found something new; labeled as the assistant's/);
  assert.match(QUEUE_FINDING_KINDS["temporal-expectation-due"], /an occurrence of a body's duty you adopted has come due and nothing the record holds shows it met; a question, never a violation/);
  // a near miss of each is no kind at all
  for (const k of ["inquiry-recheck", "interest-check", "money-detector", "standing-answers", "temporal-expectation"])
    assert.equal(classOfKind(k), null, k);
});

test("R51, R7, R12: notice-producers' items are read beside the producers, with this module's homes and options, and published", () => {
  const facts = (target) => ({ ok: true, target, object_type: "information", declared_type: "information", current_state: "collected",
    cites_in: { confirmed: 0, severed: 0 }, cites_out: { confirmed: 0, severed: 0, severed_reinstatable: 0 }, rested_on: { working: 0, frozen: 0, severed: 0 } });
  const w = noticedWorld({ extraFakes: { affordances: { affordanceFacts: (a) => facts(a.target) } } });
  const f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  assert.equal(w.asked.length, 1, "one read per feed");
  const a = w.asked[0];
  assert.deepEqual([a.member, a.viewer, a.now, a.identity], ["alice", "member:alice", NOW, "member:alice"]);
  assert.equal(typeof a.homesOf, "function"); assert.equal(typeof a.optionsOf, "function");
  const it = byId(f);
  assert.deepEqual(Object.keys(it).sort(), ["FINDING::interest-check-noticed::CHK-1::r1", "FINDING::money-detector-noticed::DET-1::r1",
    "FINDING::standing-answer::STQ-1::run1", "FINDING::temporal-expectation-due::DUT-1::o1",
    "OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31"]);
  // homed by R7's walk (the same one the producers get), offered R12's options
  assert.deepEqual(it["FINDING::interest-check-noticed::CHK-1::r1"].case.ancestors.map((x) => x.id), ["PRJ-A"]);
  assert.deepEqual(it["OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31"].case.ancestors, [], "INQ-1 is its own subject, not its home");
  assert.equal(it["FINDING::standing-answer::STQ-1::run1"].case.ungrouped, true);
  assert.ok(it["FINDING::interest-check-noticed::CHK-1::r1"].options.length > 0);
  assert.deepEqual(it["FINDING::interest-check-noticed::CHK-1::r1"].options.map((o) => o.id), a.optionsOf(["DOC-1"]).map((o) => o.id));
  // counted with the rest of the feed, and the answer states what notice-producers said of its read
  assert.deepEqual([f.counts.obligation, f.counts.finding], [1, 4]);
  assert.deepEqual(f.notice_producers.failed, []);
  assert.equal(typeof f.notice_producers.detail, "string");
  // a machine credential reads them too, with no member
  const m = w.q.queueFeed({ member: null, viewer: "class:admin" });
  assert.equal(m.ok, true); assert.equal(w.asked.at(-1).member, null); assert.equal(w.asked.at(-1).identity, null);
});

test("R51: a producer notice-producers names failed contributes no item and the answer states it; its facts are published", () => {
  const w = noticedWorld({ make: () => [], facts: { failed: ["moneyDetectors", 7], interest_checks: { bound: 50, truncated: true } } });
  const f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.equal(f.ok, true);
  assert.deepEqual(f.notice_producers.failed, ["moneyDetectors"]);
  assert.deepEqual(f.notice_producers.interest_checks, { bound: 50, truncated: true });
  assert.equal(f.items.length, 0);
  // a read that breaks its own contract (it throws) is named failed whole and takes nothing else down
  const w2 = world({ notices: { noticeItems: () => { throw new Error("boom"); } } });
  w2.bundle("INF-1"); w2.task("TASK-2026-0001-a", "INF-1");
  const g = w2.q.queueFeed({ member: null, viewer: "class:admin" });
  assert.equal(g.ok, true);
  assert.deepEqual(g.notice_producers.failed, ["noticeItems"]);
  assert.deepEqual(g.items.map((i) => i.id), ["TASK-2026-0001-a"]);
});

test("R51, R11: notice-producers' items are minted like every other: an uncatalogued or misclassed one refuses the feed", () => {
  for (const [kind, cls, code] of [["interest-check", "FINDING", "NO_SUCH_KIND"], ["standing-answer", "CONDITION", "KIND_MISCLASSED"],
                                   ["inquiry-recheck-due", "FINDING", "KIND_MISCLASSED"], ["temporal-expectation-due", "OBLIGATION", "KIND_MISCLASSED"],
                                   ["money-detector-noticed", "NOTICED", "NO_CLASS"]]) {
    const w = noticedWorld({ make: (a) => [item(`X::${kind}`, kind, cls, ["DOC-1"], a)] });
    const f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
    assert.equal(f.ok, false, kind); assert.equal(f.code, code, kind);
    assert.equal(f.check, QUEUE_MINT_CHECKS[code].check); assert.equal(f.id, `X::${kind}`);
  }
});

test("R51, R14, R31, R13: noticed items are muted and decided alike; the dated wait, a to-do, is never muted", () => {
  const w = noticedWorld();
  const mute = (a) => w.q.queueMute({ member: "alice", viewer: "member:alice", ...a });
  // the item form reaches the assistant's answer; the case form the machine's kinds on PRJ-A
  assert.equal(mute({ item: "FINDING::standing-answer::STQ-1::run1" }).ok, true);
  assert.equal(mute({ case: "PRJ-A", kinds: ["money-detector-noticed"] }).ok, true);
  // the wait is refused by kind and by its published id, as a to-do (R19, R26)
  assert.equal(mute({ case: "PRJ-A", kinds: ["inquiry-recheck-due"] }).reason, "KIND_NOT_PERSONAL");
  assert.equal(mute({ item: "OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31" }).reason, "KIND_NOT_PERSONAL");
  // a row that holds its kind anyway suppresses nothing (R31)
  w.run(`INSERT INTO queue_state (member_id, case_id, muted_kinds) VALUES ('alice','INQ-1','inquiry-recheck-due')`);
  let f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.deepEqual(f.mute.suppressed.map((s) => [s.id, s.scope]).sort(), [
    ["FINDING::money-detector-noticed::DET-1::r1", "case"], ["FINDING::standing-answer::STQ-1::run1", "item"]]);
  assert.ok(byId(f)["OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31"]);
  // personal: bob's feed is whole
  assert.equal(w.q.queueFeed({ member: "bob", viewer: "member:bob" }).mute.suppressed.length, 0);
  // a project's decision ages the machine's finding out of that project's list (R13)
  const id = "FINDING::interest-check-noticed::CHK-1::r1";
  assert.equal(w.q.proposeDispose({ project: "PRJ-A", finding: id, kind: "interest-check-noticed", to: "dismissed", reason: "looked",
                                    decidedBy: "alice", viewer: "member:alice", identity: "member:alice" }).ok, true);
  f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.equal(byId(f)[id], undefined);
  assert.ok(f.disposed.findings.some((d) => d.id === id && d.scope === "project" && d.project === "PRJ-A"));
});

test("R12, R28: the new kinds' dispositions: the wait's door is waitlook; the machine's are set aside per project or taken up as a hypothesis; the answer is quieted by its author", () => {
  const w = noticedWorld();
  const it = byId(w.q.queueFeed({ member: "alice", viewer: "member:alice" }));
  const wait = it["OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31"].disposition;
  assert.deepEqual([wait.available, wait.instead, wait.reason], [false, "waitlook", "an_obligation_is_resolved_not_disposed"]);
  assert.match(wait.detail, /op=waitlook/); assert.match(wait.detail, /new date/); assert.doesNotMatch(wait.detail, /taskresolve/);
  for (const k of ["FINDING::interest-check-noticed::CHK-1::r1", "FINDING::money-detector-noticed::DET-1::r1"]) {
    const d = it[k].disposition;
    assert.deepEqual([d.available, d.scope, d.key, d.finding], [true, "project", null, k], k);
    assert.deepEqual(d.projects, ["PRJ-A"]); assert.deepEqual(d.requires, ["project", "finding"]);
    assert.deepEqual(d.acts, ["hypothesishold"]);
  }
  const due = it["FINDING::temporal-expectation-due::DUT-1::o1"].disposition;
  assert.deepEqual([due.available, due.scope, due.acts], [true, "project", undefined], "R12's general project-scoped disposition");
  const ans = it["FINDING::standing-answer::STQ-1::run1"].disposition;
  assert.deepEqual([ans.available, ans.instead, ans.reason], [false, "queuemute", "an_answer_told_to_you_alone_is_quieted"]);
  // with no project home, the machine's finding has no scope (R12), and still names its take-up
  const w2 = noticedWorld({ make: (a) => [item("FINDING::interest-check-noticed::CHK-2::r1", "interest-check-noticed", "FINDING", [], a)] });
  const n = byId(w2.q.queueFeed({ member: "alice", viewer: "member:alice" }))["FINDING::interest-check-noticed::CHK-2::r1"].disposition;
  assert.deepEqual([n.available, n.reason, n.acts], [false, "no_project_scope", ["hypothesishold"]]);
  // the bridge names the wait's door; a noticed finding's key needs the project (R28)
  const b = w.q.proposeDispose({ key: "OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31", to: "dismissed", reason: "x", decidedBy: "alice" });
  assert.deepEqual([b.reason, b.class, b.kind, b.instead], ["CLASS_NOT_DISPOSED", "OBLIGATION", "inquiry-recheck-due", "waitlook"]);
  assert.equal(Queue.doorOf("inquiry-recheck-due"), "waitlook");
  const c = w.q.proposeDispose({ key: "FINDING::standing-answer::STQ-1::run1", to: "dismissed", reason: "x", decidedBy: "alice" });
  assert.equal(c.reason, "NO_PROJECT_SCOPE");
});

test("R1, R51, R11, R12: T36's four kinds (notice-producers R12–R15) reach the feed without NO_SUCH_KIND, with R12's default FINDING disposition", () => {
  const ids = {
    "security-level-high": "FINDING::security-level-high::2026-08-31T22:00:00.000Z",
    "policy-changed-noticed": "FINDING::policy-changed-noticed::W-1::CAP-2",
    "scan-found": "FINDING::scan-found::abc123::NOTE-1",
    "security-tool-off": "FINDING::security-tool-off::TOOL-1::2026-08-31T23:00:00.000Z",
  };
  // the Civicsmith's two carry no bundle; the scan finding is homed by its capture's bundle, the policy by none here
  const subjects = { "security-level-high": [], "policy-changed-noticed": ["DOC-2"], "scan-found": ["DOC-1"], "security-tool-off": [] };
  /* each subject in the shape the merged producer publishes (notice-producers R12–R15: the Civicsmith, no bundle; a scan
     finding's capture home; the policy) */
  const shapes = { "security-level-high": { kind: "civicsmith", id: null }, "policy-changed-noticed": { kind: "standard", id: "DOC-2" },
    "scan-found": { kind: "capture_home", id: "DOC-1", capture: "abc123", note: "NOTE-1" },
    "security-tool-off": { kind: "civicsmith", id: null, tool: "TOOL-1", provider: null } };
  const w = noticedWorld({ make: (a) => Object.entries(ids).map(([k, id]) =>
    item(id, k, "FINDING", subjects[k], a, { subject: shapes[k], recipients: ["alice"] })) });
  const f = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const it = byId(f);
  assert.deepEqual(Object.keys(it).sort(), Object.values(ids).sort());
  assert.equal(f.counts.finding, 4);
  for (const [k, id] of Object.entries(ids)) {
    assert.equal(it[id].class, "FINDING", k); assert.equal(it[id].kind, k);
    const d = it[id].disposition;
    if (k === "scan-found") {
      // a project home: R12's project-scoped disposition, with no per-kind acts
      assert.deepEqual([d.available, d.scope, d.key, d.finding, d.acts], [true, "project", null, id, undefined], k);
      assert.deepEqual(d.projects, ["PRJ-A"]); assert.deepEqual(d.requires, ["project", "finding"]);
    } else {
      assert.deepEqual([d.available, d.reason, d.acts], [false, "no_project_scope", undefined], k);
    }
  }
  // each is quieted by its recipient alone, by the item mute (R19, R20); bob's feed is whole
  for (const id of Object.values(ids))
    assert.equal(w.q.queueMute({ member: "alice", viewer: "member:alice", item: id }).ok, true, id);
  const g = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.equal(g.items.length, 0); assert.equal(g.mute.suppressed.length, 4);
  assert.equal(w.q.queueFeed({ member: "bob", viewer: "member:bob" }).mute.suppressed.length, 0);
  // negative control: a fifth, uncatalogued security kind still refuses the feed by name
  const w2 = noticedWorld({ make: (a) => [item("FINDING::security-level-raised::x", "security-level-raised", "FINDING", [], a)] });
  const r = w2.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.deepEqual([r.ok, r.code], [false, "NO_SUCH_KIND"]);
  // misclassed as a status item, each is refused
  const w3 = noticedWorld({ make: (a) => [item(ids["security-tool-off"], "security-tool-off", "CONDITION", [], a)] });
  assert.equal(w3.q.queueFeed({ member: "alice", viewer: "member:alice" }).code, "KIND_MISCLASSED");
});

test("R49, R22: the due sort reads each item's due as a calendar date, never a UTC midnight; a date that is no day sorts as none", () => {
  const w = noticedWorld({ make: (a) => [
    item("FINDING::temporal-expectation-due::DUT-1::o1", "temporal-expectation-due", "FINDING", [], a, { due: "2026-09-03" }),
    item("OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31", "inquiry-recheck-due", "OBLIGATION", [], a, { due: "2026-08-31" }),
    item("FINDING::temporal-expectation-due::DUT-2::o9", "temporal-expectation-due", "FINDING", [], a, { due: "2026-02-31" }),
    item("FINDING::temporal-expectation-due::DUT-3::o1", "temporal-expectation-due", "FINDING", [], a, { due: "2026-09-01T00:00:00Z" }),
    item("FINDING::standing-answer::STQ-1::run1", "standing-answer", "FINDING", [], a),
  ] });
  const f = w.q.queueFeed({ member: "alice", viewer: "member:alice", sort: "due" });
  assert.equal(f.ok, true); assert.equal(f.sort, "due");
  assert.deepEqual(f.items.map((i) => i.id), [
    "OBLIGATION::inquiry-recheck-due::INQ-1::2026-08-31", "FINDING::temporal-expectation-due::DUT-1::o1",
    // without a calendar day, R6's order among themselves
    "FINDING::standing-answer::STQ-1::run1", "FINDING::temporal-expectation-due::DUT-2::o9", "FINDING::temporal-expectation-due::DUT-3::o1"]);
});

const snoozeWorld = () => { const w = world(); w.member("alice"); w.bundle("INQ-1", "inquiry"); return w; };
const snooze = (w, until) => w.q.queueSnooze({ member: "alice", viewer: "member:alice", case: "INQ-1", until });

test("R21: a calendar date snoozes until the start of that local day in the instance profile's zone; before today there is in the past", () => {
  // NOW is 2026-09-01T00:00Z: 2026-08-31 at 17:00 in the instance's zone (America/Los_Angeles)
  const w = snoozeWorld();
  let r = snooze(w, "2026-09-01");
  assert.equal(r.ok, true); assert.equal(r.until_day, "2026-09-01");
  assert.equal(r.snoozed_until, "2026-09-01T07:00:00.000Z", "the local day's start, never the UTC midnight");
  assert.equal(w.all(`SELECT snoozed_until FROM queue_state WHERE member_id='alice'`)[0].snoozed_until, "2026-09-01T07:00:00.000Z");
  // today, where the group is, is not in the past (the UTC day would call it so); its start has passed, and it says so
  r = snooze(w, "2026-08-31");
  assert.equal(r.ok, true); assert.equal(r.snoozed_until, "2026-08-31T07:00:00.000Z"); assert.match(r.detail, /already lapsed/);
  r = snooze(w, "2026-08-30");
  assert.deepEqual([r.ok, r.reason, r.today], [false, "UNTIL_IN_PAST", "2026-08-31"]);
  // in a zone already on 1 September, 31 August is past
  w.zone = "Pacific/Auckland";
  assert.equal(snooze(w, "2026-08-31").reason, "UNTIL_IN_PAST");
  assert.equal(snooze(w, "2026-09-02").snoozed_until, "2026-09-01T12:00:00.000Z");
  // a date that names no day, or a day-less or month form, is no instant and no calendar date
  for (const u of ["2026-02-31", "2026-13-01", "2026-09", "2026", "09/02/2026", "tomorrow"])
    assert.equal(snooze(w, u).reason, "BAD_UNTIL", u);
  // an instant is unchanged by the zone
  assert.equal(snooze(w, iso(NOW + 5000)).snoozed_until, new Date(NOW + 5000).toISOString());
  assert.equal(snooze(w, iso(NOW - 5000)).reason, "UNTIL_IN_PAST");
});

test("R21: with no time zone held, a date is refused (never read on the UTC day) and an instant still snoozes", () => {
  const w = snoozeWorld();
  w.zone = null;
  const r = snooze(w, "2026-09-05");
  assert.deepEqual([r.ok, r.reason], [false, "BAD_UNTIL"]); assert.match(r.detail, /no time zone is held/);
  assert.equal(w.all(`SELECT count(*) c FROM queue_state`)[0].c, 0, "nothing written");
  assert.equal(snooze(w, iso(NOW + HOUR)).ok, true);
});

test("R22: a date's snooze lapses for the consumer at that local day's start, not the UTC midnight; the feed marks it until then", () => {
  const w = snoozeWorld();
  w.leg("INQ-1", "INF-9"); w.bundle("INF-9"); w.task("TASK-2026-0009-a", "INF-9");
  assert.equal(snooze(w, "2026-09-01").ok, true);
  const c = w.q.renotifyConsumer();
  assert.equal(c.due(NOW), null);
  assert.equal(c.wake(NOW), Date.parse("2026-09-01T07:00:00Z"));
  assert.equal(c.due(NOW + 6 * HOUR), null, "not at the UTC day's turn plus six hours");
  assert.equal(c.due(NOW + 7 * HOUR), NOW + 7 * HOUR);
  const it = byId(w.q.queueFeed({ member: "alice", viewer: "member:alice", nowMs: NOW + 6 * HOUR }))["TASK-2026-0009-a"];
  assert.equal(it.snoozed.until, "2026-09-01T07:00:00.000Z");
  assert.equal(byId(w.q.queueFeed({ member: "alice", viewer: "member:alice", nowMs: NOW + 7 * HOUR }))["TASK-2026-0009-a"].snoozed, undefined);
});

/* notice-producers R16, R17 (K2586): the AI accounts' and the investigation's providers, each answering nothing, so this
   test reads R4's and R6's items alone and every producer is read (none named in `facts.failed`). */
/* notice-producers' own published fixture answers every read it makes empty (its R16's ai-use reads, its R33
   `thresholdsReached` included since layer 11), so this test lays only the providers it means over it (K4990). */

test("R51, R7, R11, R12, R14, R49: the real notice-producers' items (its R4, R6) reach the feed, homed, minted, offered, muted and sorted by due", async () => {
  const asked = {};
  const duties = dutiesForViewer();
  const held = await standingAnswersHeldBack({ member: "alice" });
  const dated = datedWaitOf({ viewer: "member:alice", date: "2026-08-31" });
  const Q = dated.question;
  const run = held.entries[0];
  const w = world({}, { notices: (host, { membership }) => noticeProducersOf(host, { ...NONE, membership,
    people: checkResults,
    moneyChecks: { noticed: () => noticed() },
    duties: { dutiesOf: () => duties.none, occurrencesOf: () => duties.heldOccurrences },
    answers: { standingAnswersFor: (a) => { asked.answers = a; return held; } },
    inquiry: { datedWaits: (a) => { asked.inquiry = a; return dated.answer; } } }) });
  w.member("alice"); w.member("bob");
  w.bundle("DOC-2"); w.bundle(Q, "inquiry"); w.leg(Q, "DOC-2");
  w.bundle("PRJ-A", "project"); w.join("PRJ-A", "alice"); w.cite("PRJ-A", Q);
  const f = w.q.queueFeed({ member: "alice", viewer: "member:alice", sort: "due" });
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 400));
  assert.deepEqual(asked.answers.member, "member:alice"); assert.equal(asked.inquiry.viewer, "member:alice");
  const waitId = `OBLIGATION::inquiry-recheck-due::${Q}::2026-08-31`;
  const ansId = `FINDING::standing-answer::${run.question.id}::${run.run}`;
  assert.deepEqual(f.items.map((i) => i.id), [waitId, ansId]);
  assert.deepEqual(f.notice_producers.failed, []);
  const [wait, ans] = f.items;
  assert.deepEqual(wait.case.ancestors.map((a) => a.id), [Q, "PRJ-A"], "the wait's inquiry and every ancestor R7's walk reaches");
  assert.deepEqual([wait.disposition.instead, ans.disposition.instead], ["waitlook", "queuemute"]);
  assert.ok(wait.options.some((o) => o.id === "waitlook"));
  // the answer is the author's to quiet; the wait is never muted
  assert.equal(w.q.queueMute({ member: "alice", viewer: "member:alice", item: ans.id }).ok, true);
  assert.equal(w.q.queueMute({ member: "alice", viewer: "member:alice", item: wait.id }).reason, "KIND_NOT_PERSONAL");
  const g = w.q.queueFeed({ member: "alice", viewer: "member:alice" });
  assert.deepEqual(g.items.map((i) => i.id), [wait.id]); assert.deepEqual(g.mute.suppressed.map((s) => s.id), [ans.id]);
  // a member with no wait and no question reads none; a machine credential reads none (its R1)
  assert.equal(w.q.queueFeed({ member: null, viewer: "class:admin" }).items.length, 0);
});
