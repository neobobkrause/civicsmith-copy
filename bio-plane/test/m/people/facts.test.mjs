/* people's person facts and their removal at its interface: R9–R12, R33. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, doc, ANN, OUT, BOSS, MACHINE } from "./fixture.mjs";
import { FACT_KINDS, EXPUNGE_GROUNDS, PEOPLE_TABLES } from "../../../src/people/index.mjs";
import { validAt } from "../../../src/civil-time/index.mjs";

const valid = { from: "2020-01-01", to: "2030-12-31", precision: "day", zone: "America/Los_Angeles" };

test("R9 recordPersonFact records one PFA- fact (kind closed: name, birth, death, locality, address, contact; the value as the document states it; a validity; a citation), refusing in order NO_SUCH_ENTITY, NOT_A_PERSON, UNKNOWN_FACT_KIND, NO_VALUE, NO_CITATION, BAD_VALIDITY naming the bound", () => {
  const w = world();
  const p = w.person("Rita Moreno");
  const office = w.entity("office", "Port Warden");
  const c = w.capture("bio");
  const base = { person: p, kind: "locality", value: "  Port Ellery ", valid, citation: doc(c), by: ANN };
  const cases = [
    [{ ...base, person: "ENT-2026-9999", kind: "x" }, "NO_SUCH_ENTITY"], [{ ...base, person: "", kind: "x" }, "NO_SUCH_ENTITY"],
    [{ ...base, person: office, kind: "x" }, "NOT_A_PERSON"],
    [{ ...base, kind: "religion", value: "" }, "UNKNOWN_FACT_KIND"],
    [{ ...base, value: "  ", citation: null }, "NO_VALUE"],
    [{ ...base, citation: null, valid: null }, "NO_CITATION"],
    [{ ...base, citation: { captureSha: "f".repeat(64), extent: { kind: "pdf-page", page: 0 } } }, "NO_CITATION"],
    [{ ...base, valid: { from: "2026-02-31", to: null, precision: "day", zone: "UTC" } }, "BAD_VALIDITY"],
    [{ ...base, valid: { from: null, to: "2026-02-31", precision: "day", zone: "UTC" } }, "BAD_VALIDITY"],
    [{ ...base, valid: null }, "BAD_VALIDITY"],
  ];
  for (const [args, reason] of cases) assert.equal(w.p.recordPersonFact(args).reason, reason, JSON.stringify(args).slice(0, 100));
  assert.equal(w.p.recordPersonFact(cases[7][0]).bound, "from");
  assert.equal(w.p.recordPersonFact(cases[8][0]).bound, "to");
  assert.match(w.p.recordPersonFact({ ...base, kind: "x" }).detail, new RegExp(FACT_KINDS.join(", ")));
  assert.equal(w.p.recordPersonFact({ ...base, by: null }).reason, "NO_BY", "every fact is recorded under its stamped author (N617)");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM person_facts`).n, 0);
  for (const kind of ["name", "birth", "death", "locality"]) {
    const r = w.p.recordPersonFact({ ...base, kind });
    assert.equal(r.ok, true, kind);
    assert.match(r.fact_id, /^PFA-2026-[a-z0-9]{16}$/);
    assert.equal(r.value, "Port Ellery", "the value as the document states it");
    assert.deepEqual(r.valid, valid);
  }
  const open = w.p.recordPersonFact({ ...base, valid: { ...valid, to: null } });
  const read = w.p.personAt({ entityId: p, at: "2024-05-05", viewer: ANN });
  assert.equal(read.facts.length, 4);
  assert.deepEqual(read.undetermined.map((f) => f.fact_id), [open.fact_id], "no end stated: undetermined, never current");
  assert.deepEqual(read.undetermined[0].undetermined.why, validAt({ valid: { ...valid, to: null }, basis: null }, { value: "2024-05-05", precision: "day", zone: valid.zone }).why, "R40: civil-time's reason passed on as it answers");
  for (const f of read.facts) { assert.deepEqual(f.citation, doc(c)); assert.ok("grade" in f); }
});

test("R10 an address or contact is recorded only by a member's act (a machine write is CONTACT_NOT_IMPORTED), held in a table of export class never, answered only to a viewer who may see the citing capture, and always publishable: false", () => {
  const w = world();
  const p = w.person("Tom Hale");
  const open = w.capture("open"), fenced = w.capture("fenced", { fenced: true });
  for (const kind of ["address", "contact"]) {
    const r = w.p.recordPersonFact({ person: p, kind, value: "1 Quay St", valid, citation: doc(open), by: MACHINE });
    assert.equal(r.reason, "CONTACT_NOT_IMPORTED", kind);
  }
  assert.equal(w.p.recordPersonFact({ person: p, kind: "address", value: "1 Quay St", valid, citation: doc(open), by: null }).reason, "CONTACT_NOT_IMPORTED");
  assert.equal(w.p.recordPersonFact({ person: p, kind: "name", value: "Tom Hale", valid, citation: doc(open), by: MACHINE }).ok, true, "a machine may record other facts");
  const a = w.p.recordPersonFact({ person: p, kind: "address", value: "1 Quay St", valid, citation: doc(open), by: ANN });
  const h = w.p.recordPersonFact({ person: p, kind: "contact", value: "+1 555 0101", valid, citation: doc(fenced), by: ANN });
  assert.equal(a.publishable, false);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM person_contacts`).n, 2);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM person_facts WHERE kind IN ('address','contact')`).n, 0);
  const decl = w.record.declaredTables().find((d) => d.name === "person_contacts");
  assert.equal(decl.export, "never");
  const forAnn = w.p.personAt({ entityId: p, at: "2024-01-01", viewer: ANN }).facts.filter((f) => ["address", "contact"].includes(f.kind));
  assert.deepEqual(forAnn.map((f) => f.fact_id).sort(), [a.fact_id, h.fact_id].sort());
  for (const f of forAnn) assert.equal(f.publishable, false);
  const forOut = w.p.personAt({ entityId: p, at: "2024-01-01", viewer: OUT }).facts.filter((f) => ["address", "contact"].includes(f.kind));
  assert.deepEqual(forOut.map((f) => f.fact_id), [a.fact_id], "the fenced capture's contact is not answered");
});

test("R11 a wrong fact is corrected forward: withdrawPersonFact refuses NO_REASON and NO_SUCH_FACT, and NO_BY with no stamp, keeps the fact and marks it withdrawn with who, when and why; a repeat answers already", () => {
  const w = world();
  const p = w.person("Lea Ng");
  const c = w.capture("c");
  const f = w.p.recordPersonFact({ person: p, kind: "birth", value: "1970-01-01", valid, citation: doc(c), by: ANN });
  const k = w.p.recordPersonFact({ person: p, kind: "address", value: "2 Dock Rd", valid, citation: doc(c), by: ANN });
  assert.equal(w.p.withdrawPersonFact({ factId: f.fact_id, reason: "", by: ANN }).reason, "NO_REASON");
  assert.equal(w.p.withdrawPersonFact({ factId: "PFA-2026-none", reason: "x", by: ANN }).reason, "NO_SUCH_FACT");
  for (const by of [null, undefined, " "]) assert.equal(w.p.withdrawPersonFact({ factId: f.fact_id, reason: "x", by }).reason, "NO_BY");
  assert.equal(w.one(`SELECT withdrawn_at FROM person_facts WHERE fact_id=?`, f.fact_id).withdrawn_at, null, "an unstamped withdrawal writes nothing");
  for (const id of [f.fact_id, k.fact_id]) {
    const r = w.p.withdrawPersonFact({ factId: id, reason: "misread the year", by: ANN });
    assert.deepEqual([r.ok, r.withdrawn.by, r.withdrawn.reason], [true, ANN, "misread the year"]);
    assert.equal(w.p.withdrawPersonFact({ factId: id, reason: "again", by: OUT }).already, true);
  }
  assert.equal(w.one(`SELECT value FROM person_facts WHERE fact_id=?`, f.fact_id).value, "1970-01-01", "kept");
  assert.equal(w.p.personAt({ entityId: p, at: "2024-01-01", viewer: ANN }).facts.length, 0, "a withdrawn fact is not current");
});

test("R12 expunge removes the value of a PFA-, IDC-, MTI- or source link and leaves a tombstone {id, ground, at, by}, only on unlawful, confidential, court_order (naming the order) or lawful_demand of a kind the active profiles list; another ground EXPUNGE_GROUND_REFUSED naming the grounds and the correction act; an unlisted kind DEMAND_KIND_UNLISTED; only an administrator; no read answers the removed value", () => {
  const w = world();
  const p = w.person("Ola Berg"), q = w.person("Ola Berg");
  const c = w.capture("c");
  const fact = w.p.recordPersonFact({ person: p, kind: "address", value: "9 Hill Rd", valid, citation: doc(c), by: ANN });
  const claim = w.p.claimIdentity({ a: p, b: q, kind: "same_as", basis: "testimony", note: "n", by: ANN });
  const tie = w.p.declareTie({ entity: p, kind: "relative", note: "my aunt", attribution: "group", by: ANN });
  w.S.add("SRC-2026-0001x");
  w.p.linkSourceToPerson({ source: "SRC-2026-0001x", person: p, evidence: "she said so", sight: ["ann", "boss"], by: ANN });
  w.p.linkSourceToPerson({ source: "SRC-2026-0001x", person: p, evidence: "she said so", sight: ["ann"], by: ANN });
  const ok = { ground: "unlawful", reason: "held unlawfully", by: BOSS };
  assert.equal(w.p.expunge({ ...ok, id: fact.fact_id, by: ANN }).reason, "NOT_AN_ADMIN");
  assert.equal(w.p.expunge({ ...ok, id: fact.fact_id, by: MACHINE }).reason, "NOT_AN_ADMIN");
  const g = w.p.expunge({ ...ok, id: fact.fact_id, ground: "the person asked" });
  assert.equal(g.reason, "EXPUNGE_GROUND_REFUSED");
  for (const gr of EXPUNGE_GROUNDS) assert.ok(g.grounds.includes(gr));
  assert.match(g.detail, /withdraw/);
  assert.equal(w.p.expunge({ ...ok, id: fact.fact_id, ground: "court_order" }).reason, "EXPUNGE_GROUND_REFUSED", "a court order names the order");
  const u = w.p.expunge({ ...ok, id: fact.fact_id, ground: "lawful_demand", demandKind: "official_home_contact" });
  assert.equal(u.reason, "DEMAND_KIND_UNLISTED");
  assert.deepEqual(u.demand_kinds, ["officer_privacy"]);
  assert.equal(w.p.expunge({ ...ok, id: "PFA-2026-none" }).reason, "PERSON_ITEM_NOT_HELD");
  assert.equal(w.p.expunge({ ...ok, id: fact.fact_id, reason: "" }).reason, "NO_REASON");
  const r1 = w.p.expunge({ ...ok, id: fact.fact_id, ground: "lawful_demand", demandKind: "officer_privacy" });
  assert.equal(r1.ok, true);
  assert.deepEqual([r1.tombstone.ground, r1.tombstone.demandKind, r1.tombstone.by], ["lawful_demand", "officer_privacy", "boss"]);
  assert.ok(!JSON.stringify(r1.tombstone).includes("9 Hill Rd"), "the tombstone holds none of the removed content");
  const r2 = w.p.expunge({ ...ok, id: claim.claim_id, ground: "court_order", order: "Order 2026-77" });
  assert.equal(r2.tombstone.order, "Order 2026-77");
  assert.equal(w.p.expunge({ ...ok, id: tie.tie_id, ground: "confidential" }).ok, true);
  const link = w.p.expunge({ ...ok, id: { source: "SRC-2026-0001x", person: p } });
  assert.equal(link.ok, true);
  assert.equal(link.removed, 2, "the link and the version it replaced");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM source_person_link_history`).n, 0, "no replaced version keeps the removed value");
  const t = w.record.tombstones({});
  assert.equal(t.tombstones.length, 5);
  for (const s of t.tombstones) { assert.ok(s.ground && s.at && s.by && s.key); }
  const all = JSON.stringify([w.p.personAt({ entityId: p, at: "2024-01-01", viewer: BOSS }), w.p.identityOf({ entityId: p, viewer: BOSS }),
    w.p.tiesOf({ member: "ann", viewer: ANN }), w.p.sourceLinksOf({ person: p, viewer: ANN })]);
  for (const gone of ["9 Hill Rd", claim.claim_id, tie.tie_id, "SRC-2026-0001x"]) assert.ok(!all.includes(gone), gone);
  assert.deepEqual(w.p.identityOf({ entityId: p, viewer: BOSS }).members, [p]);
  assert.deepEqual(w.record.rebuildAndCompare("people", "identity_cluster"), { same: true });
});

test("R33 every table is declared explicitly through record-core's declareTable with the classes the requirement names: person_facts export yes, its contact table never, identity_claims yes with sight by project, member_ties never (K1490), source_person_links never, the checks and their results admin-only, N617's histories source_person_link_history never and interest_check_gate_history admin-only, the cluster derived-rebuildable; rows naming a bundle are keyed to it", () => {
  const w = world();
  const d = Object.fromEntries(w.record.declaredTables().filter((x) => x.module === "people").map((x) => [x.name, x]));
  const want = { person_facts: "yes", person_contacts: "never", identity_claims: "yes", member_ties: "never",
                 source_person_links: "never", source_person_link_history: "never", interest_checks: "admin-only",
                 interest_check_gates: "admin-only", interest_check_gate_history: "admin-only", interest_check_results: "admin-only" };
  for (const [t, ex] of Object.entries(want)) assert.equal(d[t].export, ex, t);
  assert.equal(d.identity_claims.sight, "bundle");
  assert.deepEqual(d.identity_claims.keys, ["project"]);
  assert.equal(d.identity_cluster.derive, "derived-rebuildable");
  for (const t of ["person_facts", "person_contacts", "identity_claims", "member_ties", "source_person_links", "source_person_link_history"])
    assert.equal(d[t].expunge, "tombstone", t);
  assert.deepEqual(Object.keys(d).sort(), [...PEOPLE_TABLES.map((t) => t.name), "identity_cluster"].sort());
  /* a project's purge clears what is keyed to it and nothing else */
  const p = w.person("Zed"), q = w.person("Zed");
  w.p.claimIdentity({ a: p, b: q, kind: "same_as", basis: "testimony", note: "n", by: ANN, project: w.project() });
  w.p.claimIdentity({ a: p, b: q, kind: "unsure", basis: "testimony", note: "n", by: ANN });
  w.record.purge({ bundleId: w.project() });
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM identity_claims`).n, 1);
});

/* retrieval R73's match: what a find answers, a recording act taking its capture and extent as the citation. */
const found = (c, kind = "person") => ({ kind, words: "Rita Moreno, Port Warden, of Port Ellery", capture_sha: c.captureSha,
                                         extent: { kind: "pdf-page", page: 0 }, origin: "search" });

test("R9 (T35) the citation may be an extent a find answered (retrieval R73's match: its capture_sha and extent), taken exactly as any other extent: the same refusals, the grade of its capture, and the sight of its capture", () => {
  const w = world();
  const p = w.person("Rita Moreno");
  const open = w.capture("roster"), fenced = w.capture("fenced roster", { fenced: true });
  const base = { person: p, kind: "locality", value: "Port Ellery", valid, by: ANN };
  /* found, for each kind a find answers people and offices by */
  const viaFind = w.p.recordPersonFact({ ...base, citation: found(open) });
  const viaDoc = w.p.recordPersonFact({ ...base, citation: doc(open) });
  assert.equal(viaFind.ok, true);
  assert.equal(w.p.recordPersonFact({ ...base, citation: found(open, "office") }).ok, true);
  const read = w.p.personAt({ entityId: p, at: "2024-01-01", viewer: ANN }).facts;
  const a = read.find((f) => f.fact_id === viaFind.fact_id), b = read.find((f) => f.fact_id === viaDoc.fact_id);
  assert.deepEqual(a.citation, doc(open), "held as its capture and extent, nothing of the find kept");
  assert.equal(a.grade, b.grade, "being found changes no grade");
  assert.equal(a.grade, w.prov.captureGrade(open.captureSha).grade, "the grade of its capture");
  assert.ok(!JSON.stringify(w.rows(`SELECT * FROM person_facts WHERE fact_id=?`, viaFind.fact_id)).includes("search"), "the find's words and origin are not stored");
  /* the same refusals as any other extent */
  const gone = { ...found(open), capture_sha: "f".repeat(64) };
  assert.deepEqual([w.p.recordPersonFact({ ...base, citation: gone }).reason, w.p.recordPersonFact({ ...base, citation: { captureSha: "f".repeat(64), extent: found(open).extent } }).reason],
                   ["NO_CITATION", "NO_CITATION"]);
  assert.equal(w.p.recordPersonFact({ ...base, citation: { ...found(open), extent: null } }).reason, "NO_CITATION");
  const badExtent = w.p.recordPersonFact({ ...base, citation: { ...found(open), extent: { kind: "pdf-page", page: -1 } } });
  const badDoc = w.p.recordPersonFact({ ...base, citation: { captureSha: open.captureSha, extent: { kind: "pdf-page", page: -1 } } });
  assert.equal(badExtent.ok, false);
  assert.equal(badExtent.reason, badDoc.reason, "content's extent refusal, as for any other extent");
  assert.equal(w.p.recordPersonFact({ ...base, citation: found(open), valid: null }).reason, "BAD_VALIDITY");
  /* the sight of its capture: a fact found in a fenced document is answered only to who may see that document */
  const hid = w.p.recordPersonFact({ ...base, value: "Marlow", citation: found(fenced) });
  assert.ok(w.p.personAt({ entityId: p, at: "2024-01-01", viewer: ANN }).facts.some((f) => f.fact_id === hid.fact_id));
  assert.ok(!w.p.personAt({ entityId: p, at: "2024-01-01", viewer: OUT }).facts.some((f) => f.fact_id === hid.fact_id));
});

test("R9 (T35) recordPersonFact takes an optional question, an inquiry the record holds and the actor may see, refused QUESTION_NOT_HELD after BAD_VALIDITY (absent and unseen alike); kept beside the fact unchanged and answered with it by every read that answers the fact to a viewer who may see that inquiry, withheld as absent (null) from any other; a fact recorded without one answers question: null", () => {
  const w = world();
  const p = w.person("Sam Ortiz"), twin = w.person("Sam Ortiz");
  const c = w.capture("minutes");
  const q = w.question(), hidden = w.question({ fenced: true });
  const base = { person: p, kind: "birth", value: "1961-03-03", valid, citation: found(c), by: ANN };
  /* refusals: after BAD_VALIDITY, absent and unseen alike, writing nothing */
  assert.equal(w.p.recordPersonFact({ ...base, valid: null, question: "INQ-2026-9999" }).reason, "BAD_VALIDITY");
  const absent = w.p.recordPersonFact({ ...base, question: "INQ-2026-9999" });
  const unseen = w.p.recordPersonFact({ ...base, question: hidden, by: OUT });
  const notInquiry = w.p.recordPersonFact({ ...base, question: c.bundle });
  const project = w.p.recordPersonFact({ ...base, question: w.project() });
  for (const r of [absent, unseen, notInquiry, project, w.p.recordPersonFact({ ...base, question: 7 })]) assert.equal(r.reason, "QUESTION_NOT_HELD");
  assert.equal(absent.detail, unseen.detail, "an absent and an unseen question answer alike");
  assert.equal(w.p.recordPersonFact({ ...base, question: q, by: null }).ok, false, "an unstamped act writes nothing");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM person_facts`).n, 0);
  /* recorded with it, and without one */
  const withQ = w.p.recordPersonFact({ ...base, question: q });
  assert.deepEqual([withQ.ok, withQ.question], [true, q]);
  const fencedQ = w.p.recordPersonFact({ ...base, kind: "locality", value: "Port Ellery", question: hidden });
  assert.equal(fencedQ.question, hidden, "a participant may name the fenced inquiry");
  const contact = w.p.recordPersonFact({ ...base, kind: "address", value: "4 Quay St", question: q });
  const none = w.p.recordPersonFact({ ...base, kind: "name", value: "Sam Ortiz" });
  assert.equal(none.question, null);
  assert.equal(w.p.recordPersonFact({ ...base, kind: "name", value: "S. Ortiz", question: "" }).question, null, "an empty question is none");
  /* every read that answers the fact: personAt, and candidates' life rows */
  const ofAnn = Object.fromEntries(w.p.personAt({ entityId: p, at: "2024-01-01", viewer: ANN }).facts.map((f) => [f.fact_id, f.question]));
  assert.deepEqual([ofAnn[withQ.fact_id], ofAnn[fencedQ.fact_id], ofAnn[contact.fact_id], ofAnn[none.fact_id]], [q, hidden, q, null]);
  const ofOut = Object.fromEntries(w.p.personAt({ entityId: p, at: "2024-01-01", viewer: OUT }).facts.map((f) => [f.fact_id, f.question]));
  assert.deepEqual([ofOut[withQ.fact_id], ofOut[fencedQ.fact_id], ofOut[none.fact_id]], [q, null, null], "withheld as absent from a viewer outside its project");
  assert.ok(!JSON.stringify(w.p.personAt({ entityId: p, at: "2024-01-01", viewer: OUT })).includes(hidden));
  w.p.recordPersonFact({ person: twin, kind: "birth", value: "1961-03-03", valid, citation: doc(c), by: ANN });
  const life = (viewer) => w.p.samePersonCandidates({ entityId: twin, viewer }).candidates[0].fields.life.rows.candidate;
  assert.deepEqual(life(ANN).map((f) => f.question), [q]);
  const w2 = world();
  const p2 = w2.person("Ida Vos"), t2 = w2.person("Ida Vos"), c2 = w2.capture("open"), h2 = w2.question({ fenced: true });
  w2.p.recordPersonFact({ person: p2, kind: "birth", value: "1970-01-01", valid, citation: doc(c2), question: h2, by: ANN });
  w2.p.recordPersonFact({ person: t2, kind: "birth", value: "1970-01-01", valid, citation: doc(c2), by: ANN });
  const lifeOf = (viewer) => w2.p.samePersonCandidates({ entityId: t2, viewer }).candidates[0].fields.life.rows.candidate[0].question;
  assert.deepEqual([lifeOf(ANN), lifeOf(OUT)], [h2, null]);
  /* unchanged by any later act */
  w.p.withdrawPersonFact({ factId: withQ.fact_id, reason: "a later reading", by: OUT });
  w.p.recordPersonFact({ ...base, question: hidden });
  assert.equal(w.one(`SELECT question FROM person_facts WHERE fact_id=?`, withQ.fact_id).question, q);
  /* a store made before the column gains it in place */
  w.st.sql.exec(`ALTER TABLE person_contacts DROP COLUMN question`);
  w.p.migrate();
  assert.equal(w.p.recordPersonFact({ ...base, kind: "contact", value: "+1 555 0102", question: q }).question, q);
});

test("R12 (K5148) the person read answers removed: [{ground, at, by}], one per tombstone of the person's facts, never the value, to every viewer who may read the person; a withdrawn fact is not removed", () => {
  const w = world();
  const p = w.person("Ines Calder"), other = w.person("Ines Calder");
  const c = w.capture("c");
  const name = w.p.recordPersonFact({ person: p, kind: "name", value: "Ines Calder-Voss", valid, citation: doc(c), by: ANN });
  const address = w.p.recordPersonFact({ person: p, kind: "address", value: "4 Quay Lane", valid, citation: doc(c), by: ANN });
  const kept = w.p.recordPersonFact({ person: p, kind: "locality", value: "Port Ellery", valid, citation: doc(c), by: ANN });
  const elsewhere = w.p.recordPersonFact({ person: other, kind: "name", value: "Another Name", valid, citation: doc(c), by: ANN });
  const read = (viewer, e = p) => w.p.personAt({ entityId: e, at: "2024-05-05", viewer });
  assert.deepEqual(read(BOSS).removed, [], "nothing is removed yet");
  assert.equal(w.p.withdrawPersonFact({ factId: kept.fact_id, reason: "wrong", by: ANN }).ok, true);
  assert.deepEqual(read(BOSS).removed, [], "control: a withdrawn fact is kept, not removed");
  const a = w.p.expunge({ id: name.fact_id, ground: "court_order", order: "Order 2026-12", reason: "ordered removed", by: BOSS });
  const b = w.p.expunge({ id: address.fact_id, ground: "unlawful", reason: "held unlawfully", by: BOSS });
  assert.ok(a.ok && b.ok);
  for (const viewer of [ANN, OUT, BOSS]) {
    const removed = read(viewer).removed;
    assert.deepEqual(removed.map((r) => r.ground).sort(), ["court_order", "unlawful"], String(viewer));
    for (const r of removed) { assert.deepEqual(Object.keys(r).sort(), ["at", "by", "ground"]); assert.equal(r.by, "boss"); assert.ok(r.at); }
  }
  assert.deepEqual(read(BOSS).removed.find((r) => r.ground === "court_order").at, a.tombstone.at);
  assert.ok(!JSON.stringify(read(BOSS)).includes("Calder-Voss") && !JSON.stringify(read(BOSS)).includes("4 Quay Lane"), "never the value");
  assert.ok(!JSON.stringify(read(BOSS).removed).includes("Order 2026-12"), "nor the order");
  assert.deepEqual(read(BOSS, other).removed, [], "control: another person's page carries none of this person's");
  assert.equal(elsewhere.ok, true);
  const none = w.p.personAt({ entityId: p, at: "2024-05-05", viewer: null });
  assert.equal(none.ok, false);
  assert.equal(none.removed, undefined, "a viewer who may not read the person gets none");
});

test("R12 (K5148) expunge of an id that answers no person fact, claim, tie or link is refused PERSON_ITEM_NOT_HELD, this module's own code and its own sentence, not plan-work's NO_SUCH_ITEM", async () => {
  const { word } = await import("../../../src/setup-words/index.mjs");
  const w = world();
  const r = w.p.expunge({ id: "PFA-2026-none", ground: "unlawful", reason: "held unlawfully", by: BOSS });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "PERSON_ITEM_NOT_HELD");
  assert.notEqual(r.reason, "NO_SUCH_ITEM");
  assert.ok(typeof r.detail === "string" && r.detail.length > 0);
  assert.notEqual(r.detail, word("refusal.NO_SUCH_ITEM"), "the sentence is this module's, not plan-work's");
  assert.equal(w.p.expunge({ id: { source: "SRC-2026-0001x", person: "ENT-2026-0001" }, ground: "unlawful", reason: "x", by: BOSS }).reason, "PERSON_ITEM_NOT_HELD");
});
