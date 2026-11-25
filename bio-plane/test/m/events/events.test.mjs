/* events: events, attestations and the derived when (R6–R10), the listeners (R15, R16), the read contract (R37) and
   the one-home checks (R39), at the interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MEMBER, MACHINE } from "./fixture.mjs";
import { EVENT_KINDS, STATUSES } from "../../../src/events/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { idPattern } from "../../../src/record-grammar/index.mjs";

const doc = { kind: "document" };
const fact = (w, s, value, kind = "meeting") =>
  w.ev.recordDatedFact({ captureSha: s, extent: doc, kind, value, method: "read by a member", by: MEMBER }).dated_fact.dated_fact_id;

test("R6 createEvent refuses in order UNKNOWN_EVENT_KIND, UNKNOWN_STATUS, NO_ATTESTATION, the attestation's, a concerns end's NO_SUCH_ENTITY or NO_SUCH_EVENT, a participant's; else EVT- opaque id, everything in one transaction, EventScheduled by default", () => {
  const w = world();
  const s = w.capture("r6");
  const p = w.entity("Pat");
  const att = [{ captureSha: s, extent: doc }];
  const r = (x) => w.ev.createEvent({ kind: "meeting", attestations: att, by: MEMBER, ...x }).reason;
  assert.deepEqual(EVENT_KINDS, ["meeting", "vote", "adoption", "enactment", "signing", "award", "payment", "transfer", "filing", "order",
    "hearing", "issuance", "publication", "statement", "communication", "appointment", "departure", "inspection", "other",
    "discretion", "waiver", "assessment"]);
  assert.deepEqual(STATUSES, ["EventScheduled", "EventCancelled", "EventPostponed", "EventRescheduled", "EventMovedOnline"]);
  assert.equal(r({ kind: "party", status: "nope", attestations: [] }), "UNKNOWN_EVENT_KIND");
  assert.equal(r({ status: "nope", attestations: [] }), "UNKNOWN_STATUS");
  assert.equal(r({ attestations: [] }), "NO_ATTESTATION");
  assert.equal(r({ attestations: undefined }), "NO_ATTESTATION");
  assert.equal(r({ attestations: [{ captureSha: sha("x"), extent: doc }], concerns: ["ENT-2026-9999"] }), "CAPTURE_NOT_HELD");
  assert.equal(r({ concerns: ["ENT-2026-9999"] }), "NO_SUCH_ENTITY");
  assert.equal(r({ concerns: ["EVT-2026-aaaaaaaaaaaaaaaa"] }), "NO_SUCH_EVENT");
  assert.equal(r({ participants: [{ entityId: p, role: "payer", attestation: 0 }] }), "UNKNOWN_ROLE");
  assert.equal(r({ participants: [{ entityId: p, role: "present" }] }), "NO_ATTESTATION");
  assert.equal(w.rows(`SELECT * FROM events`).length + w.rows(`SELECT * FROM event_attestations`).length, 0, "a refusal writes nothing");
  const e = w.ev.createEvent({ kind: "meeting", attestations: att, concerns: [p], participants: [{ entityId: p, role: "present", attestation: 0 }], by: MEMBER });
  assert.equal(e.ok, true);
  assert.match(e.event_id, idPattern("EVT"), "EVT-<year>-<16-char tail>");
  const v = w.ev.readEvent({ eventId: e.event_id, viewer: MEMBER }).event;
  assert.equal(v.status, "EventScheduled");
  assert.deepEqual(v.concerns, [p]);
  assert.equal(v.participants.length, 1);
  /* one transaction: a failure mid-write (a listener that throws, R15) leaves no event, attestation or participant */
  w.ev.onWhenChanged("lines", () => { throw new Error("boom"); });
  const failed = w.ev.createEvent({ kind: "meeting", attestations: [{ datedFactId: fact(w, s, "2026-01-05") }], participants: [{ entityId: p, role: "present", attestation: 0 }], by: MEMBER });
  assert.equal(failed.ok, false);
  assert.equal(w.rows(`SELECT * FROM events`).length, 1);
  assert.equal(w.rows(`SELECT * FROM event_participants`).length, 1);
});

test("R7 an attestation cites a held dated fact (NO_SUCH_DATED_FACT) or a capture extent (R1's refusals), never copies a date; testimony carries the member's statement (NO_STATEMENT) and is graded D", () => {
  const w = world();
  const s = w.capture("r7");
  const e = w.event({ capture: s }).event_id;
  const at = (a, by = MEMBER) => w.ev.attest({ eventId: e, attestation: a, by });
  assert.equal(at({ datedFactId: "nope" }).reason, "NO_SUCH_DATED_FACT");
  assert.equal(at({ captureSha: "" }).reason, "NO_SHA");
  assert.equal(at({ captureSha: sha("absent"), extent: doc }).reason, "CAPTURE_NOT_HELD");
  assert.equal(at({ captureSha: s }).reason, "NO_EXTENT");
  assert.equal(at({ captureSha: s, extent: { kind: "pdf-page", page: 4 } }).reason, "EXTENT_NOT_IN_CAPTURE");
  assert.equal(at({ testimony: "  " }).reason, "NO_STATEMENT");
  assert.equal(at({ testimony: "I was there" }, MACHINE).reason, "MEMBER_ACT_ONLY");
  assert.equal(at({ value: "2026-01-01" }).reason, "NO_ATTESTATION", "a bare date is no attestation");
  const t = at({ testimony: "I was there on the day", value: "2026-02-02" });
  assert.equal(t.ok, true);
  const f = fact(w, s, "2026-02-03");
  assert.equal(at({ datedFactId: f }).ok, true);
  const v = w.ev.readEvent({ eventId: e, viewer: MEMBER }).event;
  const testimony = v.attestations.find((a) => a.form === "testimony");
  assert.equal(testimony.grade, "D");
  assert.equal(testimony.statement, "I was there on the day");
  const cited = v.attestations.find((a) => a.form === "dated_fact");
  assert.equal(cited.dated_fact_id, f, "it cites the fact by id");
  assert.equal(at({ datedFactId: f }).already, true, "the same attestation again is held once");
});

test("R8 the first dated attestation governs until a member chooses another; refusals NO_SUCH_ATTESTATION, ATTESTATION_UNDATED; each choice kept with who, when and why", () => {
  const w = world();
  const s = w.capture("r8");
  const e = w.ev.createEvent({ kind: "hearing", attestations: [{ captureSha: s, extent: doc }, { datedFactId: fact(w, s, "2026-03-01", "hearing") },
                                                            { datedFactId: fact(w, s, "2026-03-04", "hearing") }], by: MEMBER });
  const [undated, first, second] = e.attestation_ids;
  assert.equal(w.ev.readEvent({ eventId: e.event_id, viewer: MEMBER }).event.governing, first);
  assert.equal(w.ev.chooseGoverning({ eventId: e.event_id, attestationId: 999, by: MEMBER }).reason, "NO_SUCH_ATTESTATION");
  assert.equal(w.ev.chooseGoverning({ eventId: e.event_id, attestationId: undated, by: MEMBER }).reason, "ATTESTATION_UNDATED");
  assert.equal(w.ev.chooseGoverning({ eventId: "EVT-2026-aaaaaaaaaaaaaaaa", attestationId: first, by: MEMBER }).reason, "NO_SUCH_EVENT");
  const c = w.ev.chooseGoverning({ eventId: e.event_id, attestationId: second, reason: "the later notice corrects the first", by: MEMBER });
  assert.equal(c.ok, true);
  assert.equal(c.when.value, "2026-03-04");
  w.ev.chooseGoverning({ eventId: e.event_id, attestationId: first, reason: "back again", by: "member:bob" });
  const v = w.ev.readEvent({ eventId: e.event_id, viewer: MEMBER }).event;
  assert.equal(v.governing, first);
  assert.deepEqual(v.choices.map((x) => [x.attestation_id, x.by, x.reason]),
    [[second, MEMBER, "the later notice corrects the first"], [first, "member:bob", "back again"]], "none is erased");
});

test("R9 when is derived only from the governing attestation and rebuilt in the same transaction; no dated attestation is when null, placed nowhere", () => {
  const w = world();
  const s = w.capture("r9");
  const e = w.ev.createEvent({ kind: "meeting", attestations: [{ captureSha: s, extent: doc }], by: MEMBER }).event_id;
  const v0 = w.ev.readEvent({ eventId: e, viewer: MEMBER }).event;
  assert.equal(v0.when, null);
  assert.deepEqual(v0.why, { key: "events.why.placed_nowhere_attestation", vars: {} });
  assert.equal(w.one(`SELECT value FROM event_when_cache WHERE event_id=?`, e).value, null);
  w.ev.attest({ eventId: e, attestation: { datedFactId: fact(w, s, "2026-05-05T18:30") }, by: MEMBER });
  const row = w.one(`SELECT * FROM event_when_cache WHERE event_id=?`, e);
  assert.deepEqual([row.value, row.precision, row.zone], ["2026-05-05T18:30", "minute", "America/Halifax"]);
  assert.equal(row.start, "2026-05-05T21:30:00Z", "the profile's zone, at minute precision");
  assert.equal(row.end, "2026-05-05T21:31:00Z");
  /* a day is its whole local day, never its midnight */
  const d = w.event({ value: "2026-11-01" }).event_id;
  const dr = w.one(`SELECT start, end FROM event_when_cache WHERE event_id=?`, d);
  assert.deepEqual([dr.start, dr.end], ["2026-11-01T03:00:00Z", "2026-11-02T04:00:00Z"], "the day the clocks change is 25 hours");
  assert.deepEqual(w.record.rebuildAndCompare("events", "event_when_cache"), { same: true });
});

test("R10 a read whose when_cache differs from its rebuild fails closed: when undetermined, why cache stale, never the stale value", () => {
  const w = world();
  const e = w.event({ value: "2026-06-01" }).event_id;
  w.st.sql.exec(`UPDATE event_when_cache SET value='2020-01-01', start='2020-01-01T04:00:00Z' WHERE event_id=?`, e);
  const v = w.ev.readEvent({ eventId: e, viewer: MEMBER }).event;
  assert.equal(v.when, "undetermined");
  assert.deepEqual(v.why, { key: "events.why.cache_stale", vars: {} }, "a key with its fills, never English");
  assert.equal(w.ev.sequence({ a: e, b: w.event({ value: "2027-01-01" }).event_id }).answer, "undetermined");
  w.record.rebuildDerived("events", "event_when_cache");
  assert.equal(w.ev.readEvent({ eventId: e, viewer: MEMBER }).event.when.value, "2026-06-01");
  /* a mark from record-core's convention is read as stale too */
  w.record.transact(() => w.record.markStale("events", "event_when_cache", e));
  assert.equal(w.ev.readEvent({ eventId: e, viewer: MEMBER }).event.when, "undetermined");
});

test("R15 onWhenChanged: registered once, refused through listenerRefusal; run in MODULE_ORDER inside the transaction with {eventId, before, after}; a throw fails the write", () => {
  const w = world();
  const seen = [];
  assert.equal(w.ev.onWhenChanged("money", (x) => seen.push(["money", x])).ok, true);
  assert.equal(w.ev.onWhenChanged("lines", (x) => {
    seen.push(["lines", x]);
    assert.ok(w.one(`SELECT 1 AS x FROM event_when_cache WHERE event_id=? AND value=?`, x.eventId, x.after ? x.after.value : null) || !x.after, "inside the transaction, the cache already moved");
  }).ok, true);
  assert.equal(w.ev.onWhenChanged("lines", () => {}).reason, "LISTENER_DECLARED");
  assert.equal(w.ev.onWhenChanged("", () => {}).reason, "LISTENER_MALFORMED");
  assert.equal(w.ev.onWhenChanged("duties", "no").reason, "LISTENER_MALFORMED");
  const e = w.event({ value: "2026-07-01" }).event_id;
  assert.deepEqual(seen.map((x) => x[0]), ["lines", "money"], "MODULE_ORDER, not registration order");
  assert.equal(seen[0][1].eventId, e);
  assert.equal(seen[0][1].before, null);
  assert.equal(seen[0][1].after.value, "2026-07-01");
  const s = w.capture("r15");
  seen.length = 0;
  const att = w.ev.attest({ eventId: e, attestation: { datedFactId: fact(w, s, "2026-07-02") }, by: MEMBER }).attestation_id;
  assert.equal(seen.length, 0, "a non-governing attestation moves nothing");
  w.ev.chooseGoverning({ eventId: e, attestationId: att, by: MEMBER });
  assert.deepEqual([seen[0][1].before.value, seen[0][1].after.value], ["2026-07-01", "2026-07-02"]);
  const w2 = world();
  w2.ev.onWhenChanged("duties", () => { throw new Error("cannot move my bound"); });
  const e2 = w2.event({ value: "2026-07-01" });
  assert.equal(e2.reason, "LISTENER_FAILED");
  assert.equal(w2.rows(`SELECT * FROM events`).length, 0);
});

test("R16 onEventChanged runs after commit for when_moved and participant_re_resolved, with the event id, what changed and at, the instant of the write that made it, the same for every listener; same registration rules", async () => {
  const w = world();
  const got = [];
  assert.equal(w.ev.onEventChanged("reevaluation", (x) => got.push({ ...x, committed: !!w.one(`SELECT 1 AS x FROM events WHERE event_id=?`, x.eventId) })).ok, true);
  assert.equal(w.ev.onEventChanged("reevaluation", () => {}).reason, "LISTENER_DECLARED");
  const s = w.capture("r16");
  const p = w.entity("Q"), p2 = w.entity("R");
  const e = w.ev.createEvent({ kind: "meeting", attestations: [{ datedFactId: fact(w, s, "2026-08-01") }], participants: [{ entityId: p, role: "present", attestation: 0 }], by: MEMBER });
  assert.equal(got.length, 0, "a new event's first when is not a move");
  const a2 = w.ev.attest({ eventId: e.event_id, attestation: { datedFactId: fact(w, s, "2026-08-02") }, by: MEMBER }).attestation_id;
  w.ev.chooseGoverning({ eventId: e.event_id, attestationId: a2, by: MEMBER });
  assert.equal(got[0].change, "when_moved");
  assert.equal(got[0].eventId, e.event_id);
  assert.deepEqual([got[0].before.value, got[0].after.value], ["2026-08-01", "2026-08-02"]);
  assert.equal(got[0].committed, true, "after commit");
  const pid = w.rows(`SELECT participant_id FROM event_participants`)[0].participant_id;
  w.ev.correctParticipant({ participantId: pid, entityId: p2, reason: "the minutes name R", by: MEMBER });
  assert.equal(got[1].change, "participant_re_resolved");
  assert.deepEqual([got[1].was, got[1].now], [p, p2]);
  /* at: the instant the write stamped on its own rows, the same for every listener told of it */
  const choice = w.rows(`SELECT at FROM event_choices WHERE event_id=? ORDER BY choice_id`, e.event_id).at(-1).at;
  assert.equal(got[0].at, choice, "when_moved carries the instant of the choice that moved it");
  const corrected = w.one(`SELECT at, superseded_at FROM event_participants WHERE participant_id=?`, pid);
  const replacement = w.one(`SELECT at FROM event_participants WHERE superseded_by IS NULL AND entity_id=?`, p2);
  assert.deepEqual([got[1].at, corrected.superseded_at], [replacement.at, replacement.at], "one instant for the whole act");
  assert.match(got[1].at, /^\d{4}-\d{2}-\d{2}T/);
  const w3 = world();
  const seen = { reevaluation: [], monitoring: [] };
  for (const m of Object.keys(seen)) w3.ev.onEventChanged(m, (x) => seen[m].push(x.at));
  const s3 = w3.capture("r16-two");
  const e3 = w3.ev.createEvent({ kind: "meeting", attestations: [{ datedFactId: fact(w3, s3, "2026-08-01") }], by: MEMBER });
  const a3 = w3.ev.attest({ eventId: e3.event_id, attestation: { datedFactId: fact(w3, s3, "2026-08-03") }, by: MEMBER }).attestation_id;
  w3.ev.chooseGoverning({ eventId: e3.event_id, attestationId: a3, by: MEMBER });
  assert.equal(seen.reevaluation.length, 1);
  assert.deepEqual(seen.monitoring, seen.reevaluation, "every listener is told the same instant");
  /* a refused write tells nothing */
  w.ev.onWhenChanged("lines", () => { throw new Error("no"); });
  w.ev.chooseGoverning({ eventId: e.event_id, attestationId: e.attestation_ids[0], by: MEMBER });
  assert.equal(got.length, 2);
});

test("R37 the read contract: events(event_id, kind, status), event_when_cache(event_id, start, end, precision, zone), event_participants(event_id, entity_id, role), event_attestations(event_id, capture_sha: each capture an attestation of the event cites) joinable in a later module's SQL", () => {
  const w = world();
  const p = w.entity("S");
  const e = w.event({ value: "2026-09-09", participants: [{ entityId: p, role: "present", attestation: 0 }] }).event_id;
  const cols = (t) => w.rows(`PRAGMA table_info(${t})`).map((c) => c.name);
  for (const c of ["event_id", "kind", "status"]) assert.ok(cols("events").includes(c));
  for (const c of ["event_id", "start", "end", "precision", "zone"]) assert.ok(cols("event_when_cache").includes(c));
  for (const c of ["event_id", "entity_id", "role"]) assert.ok(cols("event_participants").includes(c));
  const j = w.rows(`SELECT e.kind, e.status, c.start, c.precision, c.zone, p.role FROM events e
                    JOIN event_when_cache c ON c.event_id = e.event_id JOIN event_participants p ON p.event_id = e.event_id WHERE p.entity_id=?`, p);
  assert.deepEqual(j, [{ kind: "meeting", status: "EventScheduled", start: "2026-09-09T03:00:00Z", precision: "day", zone: "America/Halifax", role: "present" }]);
  for (const c of ["event_id", "capture_sha"]) assert.ok(cols("event_attestations").includes(c));
  /* each capture an attestation of the event cites, and no other: a relation's citation is not the event's attestation */
  const s1 = w.capture("r37-a"), s2 = w.capture("r37-b"), s3 = w.capture("r37-rel");
  const two = w.ev.createEvent({ kind: "hearing", attestations: [{ captureSha: s1, extent: doc }, { captureSha: s2, extent: doc }, { testimony: "I saw it" }], by: MEMBER }).event_id;
  w.ev.relate({ from: two, to: e, kind: "answers", attestation: { captureSha: s3, extent: doc }, by: MEMBER });
  const caps = w.rows(`SELECT DISTINCT a.capture_sha FROM event_attestations a JOIN events e ON e.event_id = a.event_id
                       WHERE e.event_id=? AND a.capture_sha IS NOT NULL ORDER BY a.capture_sha`, two).map((r) => r.capture_sha);
  assert.deepEqual(caps, [s1, s2].sort());
});

test("R39 one home per fact at the store's gate: no amount, no payer or payee, no HYP- id in an id field, every when_cache equal to its rebuild", () => {
  const w = world();
  const s = w.capture("r39");
  const p = w.entity("T");
  for (const [table, row, code] of [
    ["events", { event_id: "EVT-2026-aaaaaaaaaaaaaaaa", kind: "payment", status: "EventScheduled", amount: 12 }, "AMOUNT_NOT_HERE"],
    ["event_participants", { event_id: "EVT-2026-aaaaaaaaaaaaaaaa", entity_id: p, role: "payee" }, "UNKNOWN_ROLE"],
    ["event_concerns", { event_id: "EVT-2026-aaaaaaaaaaaaaaaa", end_id: "HYP-2026-0001" }, "HYPOTHESIS_ID"],
    ["event_participants", { event_id: "EVT-2026-aaaaaaaaaaaaaaaa", entity_id: "HYP-2026-0002", role: "actor" }, "HYPOTHESIS_ID"],
  ]) assert.equal(w.record.storeGate("events", table, row, "insert").code, code, `${table} ${code}`);
  assert.equal(w.ev.createEvent({ kind: "payment", attestations: [{ captureSha: s, extent: doc }], concerns: ["HYP-2026-0001"], by: MEMBER }).reason, "HYPOTHESIS_ID");
  assert.equal(w.ev.createEvent({ kind: "payment", attestations: [{ captureSha: s, extent: doc }],
    participants: [{ entityId: "HYP-2026-0003", role: "actor", attestation: 0 }], by: MEMBER }).reason, "HYPOTHESIS_ID");
  assert.equal(w.ev.createEvent({ kind: "payment", amount: 500, attestations: [{ captureSha: s, extent: doc }], by: MEMBER }).ok, true);
  assert.ok(!w.rows(`PRAGMA table_info(events)`).some((c) => /amount/.test(c.name)), "no column holds an amount");
  for (let i = 0; i < 5; i++) w.event({ value: `2026-0${i + 1}-15` });
  assert.deepEqual(w.record.rebuildAndCompare("events", "event_when_cache"), { same: true });
});

test("R6 R7 the one-site answers noSuchEvent and noSuchDatedFact (K1568, K1569): reason and code, the row's translation, the id as asked, one fixed detail; extra adds and never replaces; every act answers through them; never throws", async () => {
  const { noSuchEvent, noSuchDatedFact, EVENT_CHECKS } = await import("../../../src/events/index.mjs");
  for (const [fn, code, idKey] of [[noSuchEvent, "NO_SUCH_EVENT", "event_id"], [noSuchDatedFact, "NO_SUCH_DATED_FACT", "dated_fact_id"]]) {
    const a = fn("X-1");
    assert.deepEqual([a.ok, a.reason, a.code, a[idKey], a.translation], [false, code, code, "X-1", EVENT_CHECKS[code].translation]);
    assert.ok(a.detail && !/oakland|alameda/i.test(a.translation + a.detail));
    const b = fn("X-1", { end: "to", reason: "OTHER", code: "Y", detail: "d", ok: true, [idKey]: "Z" });
    assert.deepEqual({ ...b }, { ...a, end: "to" });
    for (const extra of [null, 7, "s", [1], new Proxy({}, { ownKeys() { throw new Error("hostile"); } })]) assert.equal(fn("X", extra).code, code);
    assert.equal(fn(undefined)[idKey], null);
  }
  const w = world();
  const e = w.event({ value: "2026-01-01" }).event_id;
  const ghost = "EVT-2026-aaaaaaaaaaaaaaaa";
  const answers = [
    w.ev.attest({ eventId: ghost, attestation: { testimony: "t" }, by: MEMBER }),
    w.ev.chooseGoverning({ eventId: ghost, attestationId: 1, by: MEMBER }),
    w.ev.addParticipant({ eventId: ghost, by: MEMBER }),
    w.ev.mergeEvents({ keep: e, absorb: ghost, reason: "r", by: MEMBER }),
    w.ev.splitEvent({ eventId: ghost, attestations: [1], reason: "r", by: MEMBER }),
    w.ev.relate({ from: e, to: ghost, kind: "answers", attestation: { testimony: "t" }, by: MEMBER }),
    w.ev.aliasAct({ actId: "ACT-2026-0001", eventId: ghost, by: MEMBER }),
    w.ev.sequence({ a: e, b: ghost }),
    w.ev.createEvent({ kind: "meeting", attestations: [{ testimony: "t" }], concerns: [ghost], by: MEMBER }),
  ];
  for (const a of answers) assert.deepEqual({ ...a, end: undefined }, { ...noSuchEvent(ghost), end: undefined });
  assert.deepEqual(w.ev.attest({ eventId: e, attestation: { datedFactId: "nope" }, by: MEMBER }), noSuchDatedFact("nope"));
});
