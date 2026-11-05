/* case-disclosures: the people a case names (Design Requirement 6 as amended, K1483; K1490, K1493, K1494) at this
   module's interface: `peopleNamed` (R24), `peopleJudged` (R25, R26), `tieAttestationJudged` (R27) and the `people:` and
   `member_ties:` blocks (R28). Over the real entities, events, lines, money and people modules on the fixture's host,
   with the test jurisdiction profile active (so an event's day has its zone). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, T0, sha } from "./fixture.mjs";
import { CASE_DISCLOSURE_CHECKS, PERSON_BASES, PERSON_PLACES, TIE_LINE_KINDS, peopleLines, memberTieLines, peopleOf,
         memberTiesOf } from "../../../src/case-disclosures/index.mjs";
import { PEOPLE_KINDS } from "../../../src/lines/index.mjs";
import { tiesConcerningRefusal } from "../people/fixtures.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q";
const PHONE = "510-555-0101", HOME = "12 Quiet Lane";
function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.reason, r.code, r.check, r.translation],
    [code, code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation]);
}

/* A world with the record of people the tests read: pat (two records, P and P2, one person by an identity claim) holds
   the clerk's office through June and signed on 2 March; sam is a private party; acme pays pat; a council body voted. */
function setup() {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
  const mk = (kind, label) => {
    const r = w.entities.createEntity({ kind, label, note: "registered by the test", declaredBy: V("alice") });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.entity_id;
  };
  const P = mk("person", "Pat Example"), P2 = mk("person", "P. Example"), SAM = mk("person", "Sam Private");
  const CLERK = mk("office", "Clerk"), ACME = mk("institution", "Acme Paving"), BODY = mk("body", "The Council");
  assert.equal(w.people.claimIdentity({ a: P, b: P2, kind: "same_as", basis: "testimony", note: "the same person", by: V("alice") }).ok, true);
  const doc = w.doc(DOC);
  w.finding(Q, [{ target: DOC }], { lines: [`subject_entity: ${P2}`] });
  w.finding(Q2, [{ target: DOC }], { lines: [`subject_entity: ${ACME}`] });
  const event = (kind, value, participants) => {
    const r = w.events.createEvent({ kind, attestations: [{ testimony: `I saw the ${kind}.`, ...(value ? { value } : {}) }],
      participants: participants.map(([entityId, role]) => ({ entityId, role, attestation: 0 })), by: V("alice") });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.event_id;
  };
  const SIGNED = event("signing", "2026-03-02", [[P2, "signatory"]]);
  const LATE = event("signing", "2026-09-01", [[P, "signatory"]]);
  const UNDATED = event("statement", null, [[SAM, "speaker"]]);
  const VOTE = event("vote", "2026-03-02", [[BODY, "decider"], [SAM, "present"]]);
  const line = (kind, from, to, valid = {}, extra = {}) => {
    const r = w.lines.recordLine({ kind, from, to, ...extra, valid: { precision: "day", zone: "UTC", from: null, to: null, ...valid },
                                   basis: { statement: `the ${kind} the test states` }, by: V("alice") });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.line_id;
  };
  const HOLDS = line("holds", P, CLERK, { from: "2026-01-01", to: "2026-06-30" }, { capacity: "appointed" });
  const TIE = line("related_to", SAM, P2);
  const INTEREST = line("owns_interest_in", P2, ACME);
  const PART = line("part_of", CLERK, BODY);
  const fact = (from, to, kind = "payment") => {
    const r = w.money.recordFact({ amount: "100.00", as_read: "$100.00", currency: "USD", sign: "+", precision: "exact", kind,
      phase: "actual", stage: "paid", basis: "cash", period: { from: "2026-01-01", to: "2026-12-31", precision: "day", zone: "UTC" },
      from, to, source: { capture_sha: doc, extent: { kind: "pdf-page", page: 0 } }, by: V("alice") });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.fact_id;
  };
  const PAID = fact({ entity: ACME }, { entity: P });
  const WORDS = fact({ entity: ACME }, { as_written: "a contractor named in the margin" });
  /* pat's phone and home address, as a member records them (people R10: never publishable) */
  for (const [kind, value] of [["contact", PHONE], ["address", HOME]])
    w.st.sql.exec(`INSERT INTO person_contacts (fact_id, person, kind, value, valid_json, capture_sha, extent_json, by_actor, at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'member:alice', ?)`, `PFA-2026-${kind}`, P, kind, value,
                  JSON.stringify({ from: null, to: null, precision: "day", zone: "UTC" }), doc, JSON.stringify({ kind: "pdf-page", page: 0 }), T0);
  return { w, P, P2, SAM, CLERK, ACME, BODY, SIGNED, LATE, UNDATED, VOTE, HOLDS, TIE, INTEREST, PART, PAID, WORDS, doc };
}
const PARTS = (x) => [
  { place: "statement", where: "statement 1", people: [x.P] },
  { place: "claim", where: "claim 2", people: [x.P2, x.SAM] },
  { place: "lens", where: "lens 1", people: [] },
  { place: "docket", where: "docket 4", people: [x.ACME, "ENT-2026-0999"] },
  { place: "timeline", where: "timeline they_did 1", event: x.VOTE },
  { place: "timeline", where: "timeline they_did 2", event: x.SIGNED },
  { place: "timeline", where: "timeline they_did 3", event: "EVT-2026-nosuchevent" },
  { place: "money", where: "money 1", fact: x.PAID },
  { place: "money", where: "money 2", fact: x.WORDS },
  { place: "chapter", where: "nowhere" },
];

test("R24: peopleNamed answers every person the case names, each once (one person under two references, joined by people's identity cluster, is one), with every place it is named — a finding's subject, an authored statement or claim, the lens, a docket entry, a timeline item's participants, a cited money fact's parties — and what does not resolve to a person in `unresolved` with where it is; it writes nothing", () => {
  const x = setup();
  const { w } = x;
  const before = w.snapshot();
  const n = w.cd.peopleNamed(w.prepared([Q, Q2]), PARTS(x), V("alice"));
  assert.deepEqual(n.named.map((p) => [p.person, p.members]), [[x.P, [x.P, x.P2]], [x.SAM, [x.SAM]]], "pat once, under its least id");
  assert.deepEqual(n.named[0].places, [
    { place: "subject", where: Q, ref: x.P2 },
    { place: "statement", where: "statement 1", ref: x.P },
    { place: "claim", where: "claim 2", ref: x.P2 },
    { place: "timeline", where: "timeline they_did 2", ref: x.P2, role: "signatory" },
    { place: "money", where: "money 1", ref: x.P, side: "to" }]);
  assert.deepEqual(n.named[1].places, [
    { place: "claim", where: "claim 2", ref: x.SAM },
    { place: "timeline", where: "timeline they_did 1", ref: x.SAM, role: "present" }]);
  assert.deepEqual(n.unresolved.map((u) => [u.place, u.where, u.ref]), [
    ["timeline", "timeline they_did 3", "EVT-2026-nosuchevent"],
    ["money", "money 2", x.WORDS],
    ["chapter", "nowhere", null],
    ["docket", "docket 4", x.ACME],
    ["docket", "docket 4", "ENT-2026-0999"]]);
  assert.match(n.unresolved[3].why, /kind institution, not a person/);
  assert.deepEqual(n.entities, [x.P, x.P2, x.SAM, x.ACME, x.BODY].sort(), "every registered entity named, any kind");
  assert.deepEqual(n.money_parties, [x.P, x.ACME].sort());
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* PERSON_PLACES is the closed list of a part's places */
  assert.deepEqual(PERSON_PLACES, ["statement", "claim", "lens", "docket", "timeline", "money"]);
  /* without the identity claim, two records are two people */
  const y = setup();
  y.w.people.withdrawIdentityClaim({ claimId: y.w.rows(`SELECT claim_id FROM identity_claims`)[0].claim_id, reason: "not the same", by: V("alice") });
  assert.deepEqual(y.w.cd.peopleNamed(y.w.prepared([Q]), PARTS(y), V("alice")).named.map((p) => p.person), [y.P, y.P2, y.SAM]);
  assert.deepEqual(w.cd.peopleNamed([], [], V("alice")), { named: [], unresolved: [], entities: [], money_parties: [] });
});

test("R24 (provider notice inquiry:360, inquiry R87): a finding's subject is the one its question states now — after a member changes it with `setSubject`, peopleNamed lists the new subject at the place `subject` and the old one no longer there; nothing written", () => {
  const x = setup();
  const { w } = x;
  const ch = w.inquiry.setSubject({ target: Q, subject: x.SAM, reason: "the question is about sam", viewer: V("alice"),
                                    author: V("alice"), personWarningSeen: true });
  assert.equal(ch.ok, true, JSON.stringify(ch).slice(0, 400));
  assert.equal(w.inquiry.subjectEntityOf(Q), x.SAM);
  const before = w.snapshot();
  const n = w.cd.peopleNamed(w.prepared([Q]), [], V("alice"));
  assert.deepEqual(n.named.map((p) => [p.person, p.places]), [[x.SAM, [{ place: "subject", where: Q, ref: x.SAM }]]],
    "the new subject named at its question; the old subject (pat) is no longer named by it");
  assert.deepEqual(n.unresolved, []);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* control: taking the subject off leaves the finding naming no one */
  assert.equal(w.inquiry.setSubject({ target: Q, subject: null, reason: "no one in particular", viewer: V("alice"), author: V("alice") }).ok, true);
  assert.deepEqual(w.cd.peopleNamed(w.prepared([Q]), [], V("alice")).named, []);
});

/* R25's whole list for the setup's two people: pat on the post held at the signing, sam as a private party */
const BASES = (x) => [{ person: x.P2, basis: "act_or_position", ref: { line: x.HOLDS, event: x.SIGNED } },
                      { person: x.SAM, basis: "private_party", ref: null, words: "they spoke at the hearing" }];

test("R25 (C-120.14): peopleJudged refuses PERSON_BASIS_UNRECORDED naming each person R24 answered whom the list gives no basis, matched through the identity cluster (a basis under any of a person's ids is theirs); a person listed twice keeps the first entry; with every basis recorded and standing, nothing refuses; it writes nothing", () => {
  const x = setup();
  const { w } = x;
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const before = w.snapshot();
  const none = w.cd.peopleJudged(named, null, V("alice"));
  assert.equal(none.refusals.length, 1);
  refused(none.refusals[0], "PERSON_BASIS_UNRECORDED");
  assert.deepEqual(none.refusals[0].unrecorded.map((u) => u.person), [x.P, x.SAM]);
  assert.match(none.refusals[0].detail, new RegExp(`${x.P}, named in subject ${Q}; statement statement 1`));
  assert.deepEqual(none.rows, []);
  assert.deepEqual(w.cd.peopleJudged(named, [BASES(x)[1]], V("alice")).refusals[0].unrecorded.map((u) => u.person), [x.P]);
  const ok = w.cd.peopleJudged(named, BASES(x), V("alice"));
  assert.deepEqual(ok.refusals, []);
  assert.deepEqual(ok.rows.map((r) => r.person), [x.P, x.SAM], "a basis under P2 is pat's");
  /* listed twice (under either id): the first kept */
  const twice = w.cd.peopleJudged(named, [...BASES(x), { person: x.P, basis: "tie", ref: "LIN-2026-nosuchline" }], V("alice"));
  assert.deepEqual([twice.refusals, twice.rows[0].basis], [[], "act_or_position"]);
  /* a listed person the case does not name is no row and no refusal */
  assert.deepEqual(w.cd.peopleJudged(named, [...BASES(x), { person: x.ACME, basis: "private_party", words: "w" }], V("alice")).rows.length, 2);
  assert.deepEqual(w.snapshot(), before, "nothing written");
});

test("R25 (C-120.15): each basis is checked against the record — act_or_position's holds line (a post this person holds) valid at the date of the cited event (lines' own validity), tie's line of a people kind with the person at one end, interest's line or money fact as people.interestsOf answers it, consent's and prior_publication's capture held and visible, private_party's words — and each that does not stand is PERSON_BASIS_NOT_STANDING naming it, after C-120.14", () => {
  const x = setup();
  const { w } = x;
  /* the income fact pat's interest is read from (people R15) */
  const income = w.money.recordFact({ amount: "50.00", as_read: "$50.00", currency: "USD", sign: "+", precision: "exact", kind: "income",
    phase: "actual", stage: "collected", basis: "cash", period: { from: "2026-01-01", to: "2026-12-31", precision: "day", zone: "UTC" },
    from: { entity: x.ACME }, to: { entity: x.P }, source: { capture_sha: x.doc, extent: { kind: "pdf-page", page: 0 } }, by: V("alice") }).fact_id;
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const judge = (b) => w.cd.peopleJudged(named, [b, BASES(x)[1]], V("alice"));
  const stands = (b) => assert.deepEqual(judge(b).refusals, [], JSON.stringify(b));
  const falls = (b, why) => {
    const r = judge(b).refusals;
    assert.equal(r.length, 1, JSON.stringify(b));
    refused(r[0], "PERSON_BASIS_NOT_STANDING");
    assert.deepEqual(r[0].not_standing.map((s) => [s.person, s.ord, s.basis]), [[x.P, 0, b.basis]]);
    assert.match(r[0].not_standing[0].why, why, JSON.stringify(b));
  };
  const P = x.P2;
  /* act_or_position */
  stands({ person: P, basis: "act_or_position", ref: { line: x.HOLDS, event: x.SIGNED } });
  falls({ person: P, basis: "act_or_position", ref: { line: x.HOLDS, event: x.LATE } }, /was not held on the date of/);
  falls({ person: P, basis: "act_or_position", ref: { line: x.HOLDS, event: x.UNDATED } }, /placed at no date/);
  falls({ person: P, basis: "act_or_position", ref: { line: x.HOLDS, event: "EVT-2026-nosuchevent" } }, /not an event the record holds/);
  falls({ person: P, basis: "act_or_position", ref: { line: x.TIE, event: x.SIGNED } }, /not a post this person holds/);
  falls({ person: P, basis: "act_or_position", ref: { line: "LIN-2026-nosuchline", event: x.SIGNED } }, /not a line the record holds/);
  /* tie: a people kind with the person at either end */
  stands({ person: P, basis: "tie", ref: x.TIE });
  stands({ person: P, basis: "tie", ref: x.INTEREST });
  falls({ person: P, basis: "tie", ref: x.PART }, /not a tie of this person's/);
  falls({ person: P, basis: "tie", ref: x.HOLDS }, /not a tie of this person's/);
  assert.deepEqual(TIE_LINE_KINDS, PEOPLE_KINDS, "lines' people family, its one spelling");
  /* interest: a line or a money fact people.interestsOf answers */
  stands({ person: P, basis: "interest", ref: x.INTEREST });
  stands({ person: P, basis: "interest", ref: income });
  falls({ person: P, basis: "interest", ref: x.TIE }, /not an interest the record holds/);
  falls({ person: P, basis: "interest", ref: x.PAID }, /not an interest the record holds/);
  /* consent and prior publication: a capture held and visible */
  stands({ person: P, basis: "consent", ref: x.doc });
  stands({ person: P, basis: "prior_publication", ref: x.doc.toUpperCase() });
  falls({ person: P, basis: "consent", ref: sha("never captured") }, /not one the record holds/);
  /* private_party: the words say why */
  stands({ person: P, basis: "private_party", words: "they sold the land" });
  falls({ person: P, basis: "private_party" }, /only with the words/);
  /* a withdrawn line holds nothing */
  w.lines.withdrawLine({ lineId: x.TIE, reason: "a misreading", by: V("alice") });
  falls({ person: P, basis: "tie", ref: x.TIE }, /not a line the record holds/);
  /* a capture in a project the viewer may not see is as one not held */
  const H = w.project("Hidden", "bo", []);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, H, DOC);
  falls({ person: P, basis: "consent", ref: x.doc }, /not one the record holds/);
  /* both refusals, in order */
  assert.deepEqual(w.cd.peopleJudged(named, [{ person: P, basis: "private_party" }], V("alice")).refusals.map((r) => r.reason),
    ["PERSON_BASIS_UNRECORDED", "PERSON_BASIS_NOT_STANDING"]);
  assert.deepEqual(PERSON_BASES, ["act_or_position", "tie", "interest", "consent", "prior_publication", "private_party"]);
});

test("R25: peopleBases is a list of {person, basis, ref, words?}: a malformed one is BAD_COMPLETENESS naming the field, alone — a list that is not one, an entry naming no person, a basis outside the list, a ref not of its basis' shape, words not a string, over 2,000 characters, or holding a quote, a backslash or a line break", () => {
  const x = setup();
  const { w } = x;
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const P = x.P;
  for (const [list, field] of [["x", "peopleBases"], [{}, "peopleBases"], [[null], "peopleBases[0]"], [[{ basis: "tie" }], "peopleBases[0]"],
      [[{ person: P, basis: "rumour", ref: "x" }], "peopleBases[0].basis"],
      [[{ person: P, basis: "act_or_position", ref: x.HOLDS }], "peopleBases[0].ref"],
      [[{ person: P, basis: "act_or_position", ref: { line: x.HOLDS } }], "peopleBases[0].ref"],
      [[{ person: P, basis: "tie", ref: x.PAID }], "peopleBases[0].ref"],
      [[{ person: P, basis: "interest", ref: x.SIGNED }], "peopleBases[0].ref"],
      [[{ person: P, basis: "consent", ref: "not a sha" }], "peopleBases[0].ref"],
      [[{ person: P, basis: "private_party", ref: x.TIE, words: "w" }], "peopleBases[0].ref"],
      [[{ person: P, basis: "private_party", words: 7 }], "peopleBases[0].words"],
      [[{ person: P, basis: "private_party", words: 'a "q"' }], "peopleBases[0].words"],
      [[{ person: P, basis: "private_party", words: "a\\b" }], "peopleBases[0].words"],
      [[{ person: P, basis: "private_party", words: "a\nb" }], "peopleBases[0].words"],
      [[{ person: P, basis: "private_party", words: "x".repeat(2001) }], "peopleBases[0].words"],
      [[...BASES(x), "x"], "peopleBases[2]"]]) {
    const j = w.cd.peopleJudged(named, list, V("alice"));
    assert.deepEqual(j.refusals.map((r) => [r.ok, r.reason, r.field]), [[false, "BAD_COMPLETENESS", field]], JSON.stringify(list).slice(0, 80));
    assert.deepEqual(j.rows, []);
  }
  /* at the bound, an apostrophe and blank words are legal; blank is none */
  for (const words of ["x".repeat(2000), "the owner's words"])
    assert.deepEqual(w.cd.peopleJudged(named, [BASES(x)[0], { person: x.SAM, basis: "private_party", words }], V("alice")).refusals, []);
});

test("R25, R28: the rows are the people block's, one per named person whose basis stands — the places named, the basis kind and its citation, the owner's words — never a judgment of the person; a person whose basis does not stand has no row", () => {
  const x = setup();
  const { w } = x;
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const ok = w.cd.peopleJudged(named, [{ ...BASES(x)[0], words: "pat signed the award as clerk" }, BASES(x)[1]], V("alice"));
  assert.deepEqual(ok.rows, [
    { person: x.P, places: `subject ${Q}; statement statement 1; claim claim 2; timeline timeline they_did 2; money money 1`,
      basis: "act_or_position", citation: `line ${x.HOLDS} held at event ${x.SIGNED}`, words: "pat signed the award as clerk" },
    { person: x.SAM, places: "claim claim 2; timeline timeline they_did 1", basis: "private_party", citation: null,
      words: "they spoke at the hearing" }]);
  const cite = (basis, ref) => w.cd.peopleJudged(named, [{ person: x.P, basis, ref }, BASES(x)[1]], V("alice")).rows[0].citation;
  assert.deepEqual([cite("tie", x.INTEREST), cite("interest", x.INTEREST), cite("consent", x.doc), cite("prior_publication", x.doc)],
    [`line ${x.INTEREST}`, `line ${x.INTEREST}`, `capture ${x.doc}`, `capture ${x.doc}`]);
  const part = w.cd.peopleJudged(named, [{ person: x.P, basis: "tie", ref: x.PART }, BASES(x)[1]], V("alice"));
  assert.deepEqual(part.rows.map((r) => r.person), [x.SAM], "pat's basis does not stand: no row");
  for (const r of ok.rows) assert.deepEqual(Object.keys(r), ["person", "places", "basis", "citation", "words"]);
});

test("R26: no row, refusal or block this module writes carries a person's home address or phone number from any field of the record, and the owner's words carrying one are refused BAD_COMPLETENESS naming the field (K1493)", () => {
  const x = setup();
  const { w } = x;
  /* the record holds them, unpublishable */
  const held = w.people.personAt({ entityId: x.P, at: "2026-10-06", viewer: V("alice") });
  assert.deepEqual([...held.facts, ...held.undetermined].filter((f) => f.publishable === false).map((f) => f.value).sort(), [HOME, PHONE].sort());
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const ok = w.cd.peopleJudged(named, BASES(x), V("alice"));
  const ties = w.cd.tieAttestationJudged(["alice"], named, named.money_parties, [{ signer: "alice", at: T0 }], V("alice"));
  const said = JSON.stringify([named, ok, ties, w.cd.peopleJudged(named, [], V("alice"))])
    + peopleLines(ok.rows).join("\n") + memberTieLines(ties.rows).join("\n");
  for (const v of [PHONE, HOME]) assert.equal(said.includes(v), false, `carries ${v}`);
  for (const words of [`call them on ${PHONE}`, `they live at ${HOME.toUpperCase()}`]) {
    const r = w.cd.peopleJudged(named, [BASES(x)[0], { person: x.SAM, basis: "private_party", words }], V("alice"));
    assert.deepEqual(r.refusals.map((y) => [y.reason, y.field]), [["BAD_COMPLETENESS", "peopleBases[1].words"]]);
    assert.equal(JSON.stringify(r).includes(PHONE) || JSON.stringify(r).includes(HOME), false, "the refusal does not repeat it");
    assert.deepEqual(r.rows, []);
  }
  /* negative control: words without them pass */
  assert.deepEqual(w.cd.peopleJudged(named, [BASES(x)[0], { person: x.SAM, basis: "private_party", words: "they live nearby" }], V("alice")).refusals, []);
});

test("R27 (C-120.16): each signer attests to no undeclared tie; a signer without one is TIE_ATTESTATION_MISSING, named to themself only (another signer is counted, never named); each attestation is a member_ties row with its signer and instant; each tie a signer declared to an entity the case names, the money facts' payers and payees included, is a row at the level they chose — at group or project with no handle, at cover or name with their cover or handle — and a tie to an entity the case does not name, or a withdrawn one, is none", () => {
  const x = setup();
  const { w } = x;
  const tie = (by, entity, kind, attribution) => {
    const r = w.people.declareTie({ entity, kind, note: "my own words on the tie", attribution, by: V(by) });
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.tie_id;
  };
  tie("alice", x.ACME, "employer", "group");
  tie("alice", x.BODY, "other", "cover");
  tie("bo", x.P, "relative", "name");
  tie("bo", x.SAM, "business", "project");
  tie("bo", x.CLERK, "other", "name");
  const gone = tie("alice", x.SAM, "business", "name");
  w.people.withdrawTie({ tieId: gone, reason: "it ended", by: V("alice") });
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const before = w.snapshot();
  const miss = w.cd.tieAttestationJudged(["alice", "bo"], named, named.money_parties, [{ signer: "bo", at: T0 }], V("alice"));
  refused(miss.refusals[0], "TIE_ATTESTATION_MISSING");
  assert.deepEqual([miss.refusals[0].missing, miss.refusals[0].others_missing], [["alice"], 0]);
  const toBo = w.cd.tieAttestationJudged(["alice", "bo"], named, named.money_parties, [{ signer: "bo", at: T0 }], V("bo"));
  assert.deepEqual([toBo.refusals[0].missing, toBo.refusals[0].others_missing], [[], 1]);
  assert.equal(JSON.stringify(toBo.refusals).includes("alice"), false, "never named to another");
  const AT = "2026-09-28T01:00:00Z";
  const ok = w.cd.tieAttestationJudged(["member:alice", "bo"], named, named.money_parties,
    [{ signer: "alice", at: AT }, { signer: "member:bo", at: AT }, { signer: "alice", at: "later" }], V("alice"));
  assert.deepEqual(ok.refusals, []);
  assert.deepEqual(ok.undetermined, []);
  assert.deepEqual(ok.rows, [
    { row: "attestation", signer: "alice", at: AT, entity: null, kind: null, level: null, shown: null },
    { row: "tie", signer: null, at: null, entity: x.ACME, kind: "employer", level: "group", shown: null },
    { row: "tie", signer: null, at: null, entity: x.BODY, kind: "other", level: "cover", shown: "Cover alice" },
    { row: "attestation", signer: "bo", at: AT, entity: null, kind: null, level: null, shown: null },
    { row: "tie", signer: null, at: null, entity: x.P, kind: "relative", level: "name", shown: "h_bo" },
    { row: "tie", signer: null, at: null, entity: x.SAM, kind: "business", level: "project", shown: null }]);
  /* the money facts' parties count even when R24's entities do not carry them */
  const acmeOnly = w.cd.tieAttestationJudged(["alice"], { named: [], entities: [] }, [x.ACME], [{ signer: "alice", at: AT }], V("alice"));
  assert.deepEqual(acmeOnly.rows.filter((r) => r.row === "tie").map((r) => r.entity), [x.ACME]);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* malformed lists */
  for (const [args, field] of [[["x", null], "signers"], [[[""], null], "signers"], [[["alice"], "x"], "attested"],
                               [[["alice"], [{}]], "attested[0]"], [[["alice"], [{ signer: "alice", at: 5 }]], "attested[0]"]]) {
    const r = w.cd.tieAttestationJudged(args[0], named, [], args[1], V("alice"));
    assert.deepEqual(r.refusals.map((y) => [y.reason, y.field]), [["BAD_COMPLETENESS", field]]);
  }
  /* a ties read that throws is stated undetermined, never filled */
  const z = world({ deps: { people: { tiesConcerning: () => { throw new Error("down"); } } } });
  assert.deepEqual(z.cd.tieAttestationJudged(["alice"], { entities: ["ENT-2026-0001"] }, [], [{ signer: "alice", at: AT }], V("alice")).undetermined,
    [{ signer: "alice", why: "down" }]);
  /* people's tiesConcerning never refuses (its R20): handed no member it answers an empty list, which is no ties, not an undetermined read */
  const e = world({ deps: { people: { tiesConcerning: (a) => tiesConcerningRefusal({ ...a, member: null }) } } })
    .cd.tieAttestationJudged(["alice"], { entities: ["ENT-2026-0001"] }, [], [{ signer: "alice", at: AT }], V("alice"));
  assert.deepEqual([e.undetermined, e.rows.filter((r) => r.row === "tie")], [[], []]);
});

test("R28: peopleLines and memberTieLines spell the people: and member_ties: blocks flat, and peopleOf and memberTiesOf read them back exactly; a document without them reads as empty lists; a quote, backslash or line break in a value is made safe", () => {
  const x = setup();
  const { w } = x;
  const named = w.cd.peopleNamed(w.prepared([Q]), PARTS(x), V("alice"));
  const people = w.cd.peopleJudged(named, [{ ...BASES(x)[0], words: "pat signed it" }, BASES(x)[1]], V("alice")).rows;
  w.people.declareTie({ entity: x.ACME, kind: "employer", note: "n", attribution: "name", by: V("alice") });
  const ties = w.cd.tieAttestationJudged(["alice"], named, named.money_parties, [{ signer: "alice", at: T0 }], V("alice")).rows;
  const fm = w.fm(["---", ...peopleLines(people), ...memberTieLines(ties), "---", ""].join("\n"));
  assert.deepEqual(peopleOf(fm), people);
  assert.deepEqual(memberTiesOf(fm), ties);
  assert.equal(ties.length, 2);
  assert.deepEqual([peopleOf({}), memberTiesOf(null), peopleOf(w.fm("---\ntitle: x\n---\n"))], [[], [], []]);
  const empty = w.fm(["---", ...peopleLines([]), ...memberTieLines([]), "---", ""].join("\n"));
  assert.deepEqual([peopleOf(empty), memberTiesOf(empty)], [[], []], "empty blocks read back empty");
  const odd = [{ person: "ENT-1", places: 'a "q" b\\c\nd', basis: "private_party", citation: null, words: null }];
  assert.deepEqual(peopleOf(w.fm(["---", ...peopleLines(odd), "---", ""].join("\n"))), [{ ...odd[0], places: "a 'q' b'c d" }]);
  /* only persons R25 passed are written: the block holds no row for a person whose basis does not stand */
  const fallen = w.cd.peopleJudged(named, [{ person: x.P, basis: "tie", ref: x.PART }, BASES(x)[1]], V("alice"));
  assert.deepEqual(peopleOf(w.fm(["---", ...peopleLines(fallen.rows), "---", ""].join("\n"))).map((r) => r.person), [x.SAM]);
});

test("R28 (K1816): this module answers its four block names through case-grammar R21 and keeps no copy — each is case-grammar's own function, from this module's index and from its people.mjs (negative control: another function is not)", async () => {
  const CG = await import("../../../src/case-grammar/index.mjs");
  const own = await import("../../../src/case-disclosures/people.mjs");
  for (const [name, fn] of Object.entries({ peopleLines, memberTieLines, peopleOf, memberTiesOf })) {
    assert.equal(fn, CG[name], name);
    assert.equal(own[name], CG[name], `people.mjs ${name}`);
  }
  assert.notEqual(peopleLines, CG.memberTieLines, "negative control");
});
