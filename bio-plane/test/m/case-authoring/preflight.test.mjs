/* case-authoring (N364): each document's grade and co-attestation and the owner's acknowledgement (R55 (case-disclosures R2, R3)), what may be
   said of a source (R55 (case-disclosures R4)), the `/5` blocks in the document (R14), hunch debt's row (R55 (case-disclosures R16)), the rows C-120.4–C-120.7 (R29: `case-disclosures`' own, re-exported),
   and the ceremony's pre-flight (R34), which carries R32's read as its step three. Over the real provenance, capture and
   sources modules; ratification's pre-flight (its R18) is a stand-in at its ruled interface (K552 (5)) where a test
   must control its answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, T0, sha, WHAT_CHANGED } from "./fixture.mjs";
import { caseAuthoringOps, CASE_DISCLOSURE_CHECKS, SELF_ATTESTED_SENTENCE } from "../../../src/case-authoring/index.mjs";
import * as DISCLOSURES from "../../../src/case-disclosures/index.mjs";
import { caseDocumentBlocks, unnamedSourceStatement, sourceStatement } from "../../../src/publication/index.mjs";
import { ARCHIVE_VIA, ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { readFileSync } from "node:fs";
import { localize, word as listed } from "../../../src/setup-words/index.mjs";
import { preflightRefusal } from "../ratification/fixtures.mjs";
import { wordRx } from "../../word-rx.mjs";
/* words.json's words, read by key (K2220). */
const WORDS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8"));
const word = (key) => WORDS.words.find((x) => x.key === key).en;

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", DOC3 = "INFO-2026-0003-c";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q";
/* A co-attestation as capture R20 and attestation R2–R3 record it at capture. */
const CO_ATTESTED = { attestations: [{ kind: "rfc3161", service: "tsa.example", file: "snapshots/timestamp-abc.tsr",
                                       sha256: "d".repeat(64) }],
                      co_archive: { service: "archive.example", locator: "https://archive.example/web/x" } };
const REASON = "the site refuses the archive's crawler";

const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition);
const bodyOf = (text) => text.slice(text.indexOf("\n---\n", 4) + 5);
function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.reason, r.code, r.check, r.translation],
    [code, code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation]);
}
/* Q rests on a co-attested Grade B document (DOC) and on a Grade B one that is not co-attested (DOC2); Q2 rests on
   DOC2 too. */
function setup(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  const a = w.graded(DOC, CO_ATTESTED), b = w.graded(DOC2);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }]);
  w.finding(Q2, [{ target: DOC2 }]);
  const P = w.project("Team", "alice", [Q, Q2]);
  return { w, P, a, b };
}
const lateRow = (w, capture, seq, o) => w.st.sql.exec(`INSERT INTO late_attestations (capture_sha, seq, kind, service, ok, at,
  by, outcome) VALUES (?, ?, ?, ?, ?, ?, 'alice', ?)`, capture, seq, o.kind, o.service, o.ok ? 1 : 0, o.at,
  JSON.stringify({ late: true, proves: localize("capture.text.proves_bytes_existed", "proves the bytes existed by {at}, not at capture", { at: String(o.at) }), ...o }));

test("R29 (N529): C-120.4–C-120.7, in the family 'a case's disclosures and its pre-flight', moved with their translations to case-disclosures (its R22), re-exported here as that one table, each naming its raising method there", () => {
  assert.equal(CASE_DISCLOSURE_CHECKS, DISCLOSURES.CASE_DISCLOSURE_CHECKS, "the one table, re-exported, never a copy");
  const rows = Object.entries(CASE_DISCLOSURE_CHECKS).slice(3, 7);
  assert.deepEqual(rows.map(([k, v]) => [k, v.check]),
    [["CO_ATTESTATION_UNACKNOWLEDGED", "C-120.4"], ["SELF_ATTESTED_NO_REASON", "C-120.5"],
     ["SELF_ATTESTATION_NOT_STANDING", "C-120.6"], ["UNCLEARED_HUNCH", "C-120.7"]]);
  assert.deepEqual(rows.map(([, v]) => v.translation), [
    localize("refusal.CO_ATTESTATION_UNACKNOWLEDGED", "A load-bearing document has no trusted timestamp and co-archive. Retry them, or acknowledge publishing it as self-attested only, with a reason. Nothing was written."),
    localize("refusal.SELF_ATTESTED_NO_REASON", "Publishing a document as self-attested only says why. Give the reason. Nothing was written."),
    listed("case-disclosures.checks.a_document_acknowledged_as_self"),
    localize("refusal.UNCLEARED_HUNCH", "A finding in this case rests on a hunch. A hunch is temporary declared bias, and it is the one bias that must be cleared before publication: the case must still hold with the hunch removed. Give each leg a grade the record earns, or take the hunch out of the basis, and publish again. Nothing was written.")]);
  assert.deepEqual(rows.map(([, v]) => v.where), [
    "src/case-disclosures/index.mjs selfAttestedJudged > is-co-attestation-acknowledged",
    "src/case-disclosures/index.mjs selfAttestedJudged > is-self-attested-reasoned",
    "src/case-disclosures/index.mjs selfAttestedJudged > is-self-attestation-standing",
    "src/case-disclosures/index.mjs hunchDebt > is-hunch-cleared"], "each names the method that raises it there");
});

test("R29 (N529): C-120.8 and C-120.10–C-120.13 (DEC-112, N522), C-120.14–C-120.16 (the people a case names, T33-68), C-120.17–C-120.18 (a marked photo, T37; N757) R34's C-120.19 (an unchecked photo, T38; DEC-183) and C-120.20–C-120.22 (a member document's publication copy undetermined, pending or not cleanable, T39; N806; numbered provisionally until promotion's stamp) and C-120.23–C-120.29 (the account, T41, R63), in the same family, held with their translations in case-disclosures (its R22; the photo rows words.json's photo.refused.format and photo.refused.unchecked, read by key), each naming its raising method there; C-120.9 is withdrawn and not used", () => {
  const rows = Object.entries(CASE_DISCLOSURE_CHECKS).slice(7, 21);
  /* (T41; K2550) the account's rows follow, C-120.23–C-120.29, case-disclosures' (its R22, R30) */
  assert.deepEqual(Object.entries(CASE_DISCLOSURE_CHECKS).slice(21).map(([k, v]) => [k, v.check, v.where]), [
    ["ACCOUNT_SENTENCE_UNSUPPORTED", "C-120.23", "src/case-disclosures/index.mjs accountJudged > is-account-sentence-supported"],
    ["ACCOUNT_FACT_NOT_IN_CITED", "C-120.24", "src/case-disclosures/index.mjs accountJudged > is-account-fact-cited"],
    ["ACCOUNT_CONTRADICTED_BY_RECORD", "C-120.25", "src/case-disclosures/index.mjs accountJudged > is-account-consistent-with-record"],
    ["ACCOUNT_BIAS_NOT_PRINTED", "C-120.26", "src/case-disclosures/index.mjs accountJudged > is-account-bias-printed"],
    ["ACCOUNT_CLAIM_NOT_BIAS", "C-120.27", "src/case-disclosures/index.mjs accountJudged > is-account-bias-not-a-claim"],
    ["ACCOUNT_FLAG_UNANSWERED", "C-120.28", "src/case-disclosures/index.mjs accountJudged > is-account-flag-answered"],
    ["ACCOUNT_CHECK_UNDETERMINED", "C-120.29", "src/case-disclosures/index.mjs accountJudged > is-account-checked"]]);
  assert.deepEqual(rows.map(([k, v]) => [k, v.check, v.where]), [
    ["RELIED_ON_NOT_PRESENTABLE", "C-120.8", "src/case-disclosures/index.mjs materialsJudged > is-relied-on-presentable"],
    ["ACCEPTED_WORK_NOT_IN_FORCE", "C-120.10", "src/case-disclosures/index.mjs acceptedWorkJudged > is-accepted-work-in-force"],
    ["FLAG_NOT_DISCLOSED", "C-120.11", "src/case-disclosures/index.mjs flagsJudged > is-flag-disclosed"],
    ["FLAGS_UNDETERMINED", "C-120.12", "src/case-disclosures/index.mjs flagsJudged > is-flags-determined"],
    ["FLAG_DISCLOSURE_NOT_STANDING", "C-120.13", "src/case-disclosures/index.mjs flagsJudged > is-flag-disclosure-standing"],
    ["PERSON_BASIS_UNRECORDED", "C-120.14", "src/case-disclosures/index.mjs peopleJudged > is-person-basis-recorded"],
    ["PERSON_BASIS_NOT_STANDING", "C-120.15", "src/case-disclosures/index.mjs peopleJudged > is-person-basis-standing"],
    ["TIE_ATTESTATION_MISSING", "C-120.16", "src/case-disclosures/index.mjs tieAttestationJudged > is-tie-attested"],
    ["PHOTO_NOT_COVERABLE", "C-120.17", "src/case-disclosures/index.mjs materialsJudged > is-photo-coverable"],
    ["PHOTO_MARKS_UNDETERMINED", "C-120.18", "src/case-disclosures/index.mjs materialsJudged > is-photo-marks-determined"],
    ["PHOTO_UNCHECKED", "C-120.19", "src/case-disclosures/index.mjs materialsJudged > is-photo-checked"],
    ["DOCUMENT_COPY_UNDETERMINED", "C-120.20", "src/case-disclosures/index.mjs materialsJudged > is-document-copy-determined"],
    ["DOCUMENT_COPY_PENDING", "C-120.21", "src/case-disclosures/index.mjs materialsJudged > is-document-copy-made"],
    ["DOCUMENT_NOT_CLEANABLE", "C-120.22", "src/case-disclosures/index.mjs materialsJudged > is-document-cleanable"]]);
  assert.deepEqual(rows.map(([, v]) => v.translation), [
    localize("refusal.RELIED_ON_NOT_PRESENTABLE", "A finding this case relies on rests on material your team's Civicsmith does not hold whole, and everything a case relies on travels with it in full. Find a presentable copy, stop relying on the material, or make the finding supporting. Nothing was written."),
    localize("refusal.ACCEPTED_WORK_NOT_IN_FORCE", "A finding in this case rests on another team's finding, and this team's acceptance of that edition is not in force. Accept it again, or take the leg out. Nothing was written."),
    localize("refusal.FLAG_NOT_DISCLOSED", "Another team's work this case rests on carries an open flag, and a case may be published with it only if the flag is disclosed. Each one is named. Disclose it, or clear it first. Nothing was published."),
    localize("refusal.FLAGS_UNDETERMINED", "The flags on another team's work this case rests on could not be read completely, so what must be disclosed is not known. Try again. Nothing was published."),
    localize("refusal.FLAG_DISCLOSURE_NOT_STANDING", "One of the flags disclosed is not open on work this case rests on: it may have been cleared since. Read the list again. Nothing was published."),
    localize("refusal.PERSON_BASIS_UNRECORDED", "This case names a person without a recorded reason for naming them. Give each person named a basis: their act or position, a tie, an interest, their consent, an earlier publication, or why a private person is named. Nothing was written."),
    localize("refusal.PERSON_BASIS_NOT_STANDING", "A reason given for naming a person is not one the record holds, or the position it cites was not held on the date of the act. Read the list again. Nothing was written."),
    localize("refusal.TIE_ATTESTATION_MISSING", "Each member who signs a case first attests that they hold no undeclared tie to anyone or anything the case names, including those paid or paying in its money. Attest, or declare the tie first. Nothing was written."),
    word("photo.refused.format"),
    localize("refusal.PHOTO_MARKS_UNDETERMINED", "A photo this case relies on could not be checked for the people and number plates marked in it, so what the published case would show of it is not known. Try again. Nothing was written."),
    word("photo.refused.unchecked"),
    /* T39 (N806): case-disclosures R22's drafts, word for word, until words.json holds their keys */
    localize("refusal.DOCUMENT_COPY_UNDETERMINED", "A document this case relies on could not be checked for the details a member's file can carry, so what the published case would show of it is not known. Try again. Nothing was written."),
    listed("document.refused.pending", { document: "{document}" }),
    listed("document.refused.clean", { document: "{document}" })]);
});

test("R55 (case-disclosures R16): uncleared hunch debt is UNCLEARED_HUNCH with its row C-120.7, naming every hunch leg, before anything is written; the pre-flight answers it before the first screen", () => {
  const w = world();
  w.member("alice"); w.doc(DOC);
  w.finding(Q, [{ target: DOC, grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice",
                  date: "2026-09-27" }]);
  const P = w.project("Team", "alice", [Q]);
  const before = w.snapshot();
  const r = w.publish(P, "alice", [Q]);
  refused(r, "UNCLEARED_HUNCH");
  assert.deepEqual(r.hunches, [{ target: Q, ord: 0, leg_target: DOC }]);
  assert.deepEqual(w.snapshot(), before);
  const pre = w.ca.publishPreflight({ project: P, targets: [Q], roles: { [Q]: "load_bearing" }, ...AUTH, viewer: V("alice") });
  assert.deepEqual([pre.ready, pre.first], [false, r]);
  assert.deepEqual(w.snapshot(), before);
  /* negative control: cleared, it publishes */
  w.finding(Q, [{ target: DOC }]);
  assert.equal(w.publish(P, "alice", [Q]).ok, true);
});
const AUTH = { author: "alice", scope: "s", statement: "It does not cover the amendments.", subjectPosition: "not_sought",
               subjectJustification: "A public record.", biasAcknowledgement: "We read the minutes as the account.",
               excluded: [], tieAttested: true };

test("R55 (case-disclosures R2): each capture a member rests on is stated with its grade (provenance.captureGrade) and co-attestation (both a timestamp and a co-archive); a load-bearing Grade B capture not co-attested is CO_ATTESTATION_UNACKNOWLEDGED (C-120.4), naming each, and nothing is written", () => {
  const { w, P, a, b } = setup();
  const before = w.snapshot();
  const r = w.publish(P, "alice", [Q]);
  refused(r, "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(r.unacknowledged.map((u) => [u.capture, u.members, u.grade]), [[b, [Q], "B"]]);
  assert.deepEqual(w.snapshot(), before, "no id drawn, nothing written");
  /* acknowledged, it publishes, and every capture is stated */
  const ok = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  const blocks = caseDocumentBlocks(docOf(w, ok).text);
  const byCap = Object.fromEntries(blocks.captures.map((c) => [c.capture, c]));
  assert.deepEqual([byCap[a].member, byCap[a].grade, byCap[a].grade_basis, byCap[a].co_attested, byCap[a].co_archive,
                    byCap[a].late, byCap[a].self_attested_only],
    [Q, "B", w.prov.captureGrade(a).basis, true, "https://archive.example/web/x", false, false]);
  assert.deepEqual([byCap[b].grade, byCap[b].co_attested, byCap[b].timestamp_at, byCap[b].co_archive, byCap[b].self_attested_only],
    ["B", false, null, null, true]);
  /* a supporting member's Grade B capture that is not co-attested needs no acknowledgement */
  const w2 = setup();
  w2.w.graded(DOC3, CO_ATTESTED);
  w2.w.finding("INQ-2026-0003-c", [{ target: DOC3 }]);
  const P2 = w2.w.project("Two", "alice", ["INQ-2026-0003-c", Q2]);
  const sup = w2.w.publish(P2, "alice", ["INQ-2026-0003-c", Q2], { roles: { "INQ-2026-0003-c": "load_bearing", [Q2]: "supporting" } });
  assert.equal(sup.ok, true, JSON.stringify(sup).slice(0, 300));
  const s2 = caseDocumentBlocks(docOf(w2.w, sup).text).captures.find((c) => c.member === Q2);
  assert.deepEqual([s2.co_attested, s2.self_attested_only], [false, false], "stated, not acknowledged");
  /* a capture with no recorded route earns no letter, so none is asked */
  const w3 = world(); w3.member("alice"); w3.doc(DOC); w3.finding(Q, [{ target: DOC }]);
  const n = w3.publish(w3.project("Three", "alice", [Q]), "alice", [Q]);
  assert.equal(n.ok, true);
  assert.deepEqual(caseDocumentBlocks(docOf(w3, n).text).captures.map((c) => [c.grade, c.grade_basis, c.co_attested]),
    [[null, "CAPTURE_ROUTE_UNRECORDED", false]]);
});

test("R55 (case-disclosures R2): the co-attestation recorded at capture is read through attestation.attestationsOf (its R7), from the instance the composition hands in, never provenance: what it answers is what the case states", () => {
  const { w, a, b } = setup();
  const held = w.attestation.attestationsOf(a);
  assert.deepEqual(held.attestations.map((x) => x.kind), ["rfc3161", "co_archive"], "the real module reads DOC's record");
  assert.equal(typeof w.prov.attestationsOf, "undefined", "provenance no longer answers it (N512)");
  /* a stand-in handed in answers none for every capture: DOC is no longer co-attested, so both are named */
  const asked = [];
  const none = { attestationsOf: (s) => { asked.push(s); return { ok: true, sha256: s, registered: true, attestations: [], note: "" }; } };
  const n = setup({ deps: { attestation: none } });
  const r = n.w.publish(n.P, "alice", [Q]);
  refused(r, "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(r.unacknowledged.map((u) => u.capture).sort(), [n.a, n.b].sort());
  assert.deepEqual([...new Set(asked)].sort(), [n.a, n.b].sort(), "each capture asked of the instance handed in");
  /* negative control: one answering DOC's attestations for DOC2 too, and DOC2 needs no acknowledgement */
  const both = { attestationsOf: (s) => ({ ...w.attestation.attestationsOf(a), sha256: s }) };
  const y = setup({ deps: { attestation: both } });
  const ok = y.w.publish(y.P, "alice", [Q]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(caseDocumentBlocks(docOf(y.w, ok).text).captures.map((c) => c.co_attested), [true, true]);
  void b;
});

test("R55 (case-disclosures R2): the grade that needs co-attestation or an acknowledgement is EARNED_CAPTURE_CEILING, provenance R24's one definition (capture R18): the refusal names it, and an archive replay follows BD-18 (provenance R85): a raw replay is ARCHIVE_CAPTURE_GRADE, the ceiling via archive, so not co-attested it is refused like any other; a rewritten replay is REWRITTEN_REPLAY_GRADE, below the ceiling, stated and never asked to be acknowledged", () => {
  assert.equal(EARNED_CAPTURE_CEILING, "B");
  const { w, P, b } = setup();
  const r = w.publish(P, "alice", [Q]);
  refused(r, "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual([r.unacknowledged.map((u) => u.grade), w.prov.captureGrade(b).grade], [[EARNED_CAPTURE_CEILING], EARNED_CAPTURE_CEILING]);
  assert.match(r.detail, new RegExp(`load-bearing Grade ${EARNED_CAPTURE_CEILING} document`));
  /* BD-18: a raw (`id_`) replay of the publisher's bytes is the ceiling, via archive: load-bearing and not co-attested,
     it needs the acknowledgement like any other capture at the ceiling, and nothing is written */
  const w1 = world(); w1.member("alice");
  const raw = w1.graded(DOC3, {}, { receipt: false });
  w1.prov.recordReceipt({ address: `https://example.org/${DOC3}`, addressNorm: `example.org/${DOC3}`, captureSha: raw,
                          retrieved: T0, via: ARCHIVE_VIA,
                          retrievalLocator: `https://web.archive.org/web/20260101000000id_/https://example.org/${DOC3}` });
  const rawGrade = w1.prov.captureGrade(raw);
  assert.deepEqual([rawGrade.grade, rawGrade.via_archive, rawGrade.replay.raw, rawGrade.replay.custodian],
    [ARCHIVE_CAPTURE_GRADE, true, true, "web.archive.org"]);
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING);
  w1.finding(Q, [{ target: DOC3 }]);
  const P1 = w1.project("Raw", "alice", [Q]);
  const r1 = w1.publish(P1, "alice", [Q]);
  refused(r1, "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(r1.unacknowledged.map((u) => [u.capture, u.grade]), [[raw, ARCHIVE_CAPTURE_GRADE]]);
  assert.equal(w1.row(`SELECT COUNT(*) AS n FROM case_documents`).n, 0);
  /* BD-18: a rewritten replay (no raw locator) is reference only, the letter below the ceiling: stated, never asked
     to be acknowledged */
  const w2 = world(); w2.member("alice");
  const c = w2.graded(DOC3, {}, { receipt: false });
  w2.prov.recordReceipt({ address: `https://example.org/${DOC3}`, addressNorm: `example.org/${DOC3}`, captureSha: c,
                          retrieved: T0, via: ARCHIVE_VIA,
                          retrievalLocator: `https://web.archive.org/web/20260101000000/https://example.org/${DOC3}` });
  const rewritten = w2.prov.captureGrade(c);
  assert.deepEqual([rewritten.grade, rewritten.reference_only, rewritten.replay.raw], [REWRITTEN_REPLAY_GRADE, true, false]);
  assert.notEqual(REWRITTEN_REPLAY_GRADE, EARNED_CAPTURE_CEILING);
  w2.finding(Q, [{ target: DOC3 }]);
  const ok = w2.publish(w2.project("Arc", "alice", [Q]), "alice", [Q]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  const row = caseDocumentBlocks(docOf(w2, ok).text).captures.find((x) => x.capture === c);
  assert.deepEqual([row.grade, row.co_attested, row.self_attested_only], [REWRITTEN_REPLAY_GRADE, false, false]);
  /* the document's words name the ceiling from the same definition */
  const acked = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  assert.ok(bodyOf(docOf(w, acked).text).includes(listed("case-disclosures.document.each_document_this_cases_findings",
    { EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING) })));
});

test("R55 (case-disclosures R2): a document leg names its content row's capture, else every capture its target registers; an inquiry leg names none; one level deep", () => {
  const { w, P, a, b } = setup();
  const c = w.graded(DOC3, CO_ATTESTED);
  const cid = sha("a passage of DOC3");
  w.st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, stale)
                 VALUES (?, ?, ?, 'pdf-page', '{}', 'page 1', 'plane', '2026-01-01', 0)`, cid, c, DOC3);
  w.finding("INQ-2026-0004-d", [{ target: DOC3, content_id: cid }, { target: Q }]);
  const P2 = w.project("Two", "alice", ["INQ-2026-0004-d"]);
  const r = w.publish(P2, "alice", ["INQ-2026-0004-d"]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(caseDocumentBlocks(docOf(w, r).text).captures.map((x) => [x.member, x.capture]),
    [["INQ-2026-0004-d", c]], "Q's own documents are Q's to state when Q is published");
  void a; void b; void P;
});

test("R55 (case-disclosures R2): a timestamp or co-archive obtained late (capture.lateAttestationsOf) counts, stated as late; a late co-archive whose replay holds other bytes, or a failed attempt, does not", () => {
  const { w, P, b } = setup();
  lateRow(w, b, 1, { kind: "timestamp", service: "tsa.example", ok: true, at: "2026-09-28T00:00:00Z" });
  lateRow(w, b, 2, { kind: "co_archive", service: "archive.example", ok: true, at: "2026-09-28T00:01:00Z",
                     archived_locator: "https://archive.example/web/late", matches: false });
  const before = w.snapshot();
  refused(w.publish(P, "alice", [Q]), "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(w.snapshot(), before);
  lateRow(w, b, 3, { kind: "co_archive", service: "archive.example", ok: false, at: "2026-09-28T00:02:00Z" });
  refused(w.publish(P, "alice", [Q]), "CO_ATTESTATION_UNACKNOWLEDGED");
  lateRow(w, b, 4, { kind: "co_archive", service: "archive.example", ok: true, at: "2026-09-28T00:03:00Z",
                     archived_locator: "https://archive.example/web/late2", matches: true });
  const ok = w.publish(P, "alice", [Q]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  const row = caseDocumentBlocks(docOf(w, ok).text).captures.find((c) => c.capture === b);
  assert.deepEqual([row.co_attested, row.late, row.timestamp_at, row.co_archive],
    [true, true, "2026-09-28T00:00:00Z", "https://archive.example/web/late2"]);
  assert.match(bodyOf(docOf(w, ok).text), wordRx("case-disclosures.obtained_late_proves"));
});

test("R55 (case-disclosures R2): an empty reason is SELF_ATTESTED_NO_REASON (C-120.5); an entry for a co-attested capture, or one not in the case, is SELF_ATTESTATION_NOT_STANDING (C-120.6); a malformed list is R3's BAD_COMPLETENESS naming the field; each writes nothing", () => {
  const { w, P, a, b } = setup();
  const before = w.snapshot();
  for (const reason of [undefined, "", "   "]) {
    const r = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b, ...(reason === undefined ? {} : { reason }) }] });
    refused(r, "SELF_ATTESTED_NO_REASON");
    assert.deepEqual(r.no_reason, [{ capture: b, ord: 0 }]);
  }
  const co = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b, reason: REASON }, { capture: a, reason: REASON }] });
  refused(co, "SELF_ATTESTATION_NOT_STANDING");
  assert.deepEqual(co.not_standing, [{ capture: a, ord: 1, why: "co_attested" }]);
  const out = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b, reason: REASON }, { capture: "e".repeat(64), reason: REASON }] });
  refused(out, "SELF_ATTESTATION_NOT_STANDING");
  assert.deepEqual(out.not_standing, [{ capture: "e".repeat(64), ord: 1, why: "not_in_case" }]);
  for (const [list, field] of [[{ capture: b }, "selfAttested"], ["x", "selfAttested"], [[b], "selfAttested[0]"],
                               [[{ reason: REASON }], "selfAttested[0]"], [[{ capture: b, reason: 5 }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: 'a "quote"' }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: "x".repeat(2001) }], "selfAttested[0].reason"]]) {
    const r = w.publish(P, "alice", [Q], { selfAttested: list });
    assert.deepEqual([r.reason, r.field], ["BAD_COMPLETENESS", field], JSON.stringify(list).slice(0, 60));
  }
  assert.deepEqual(w.snapshot(), before);
  /* listed twice: acknowledged once, its first reason kept; the case is never refused for want of co-attestation */
  const ok = w.publish(P, "alice", [Q], { selfAttested: [{ capture: b.toUpperCase(), reason: REASON }, { capture: b, reason: "later" }] });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.equal(caseDocumentBlocks(docOf(w, ok).text).captures.find((c) => c.capture === b).acknowledgement.reason, REASON);
});

test("R55 (case-disclosures R3): an acknowledged capture is marked self_attested_only with {reason, acknowledged_by (the author stamp), at} and capture.captureAccountsOf's signed accounts, exact, and its block carries DEC-81 item 3's sentence", async () => {
  const { w, P, b } = setup();
  const text = "I saved it from the council page myself.\nThe archive refused it that day.";
  const signature = "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----";
  w.st.sql.exec(`INSERT INTO capture_accounts (capture_sha, seq, by, text, signature, key_b64, at) VALUES (?, 1, 'alice', ?, ?, 'AAAA', ?)`,
                b, text, signature, "2026-09-27T12:00:00Z");
  const url = new URL(`http://do/publishcase?author=alice&viewer=${encodeURIComponent(V("alice"))}&project=${P}`);
  const r = await caseAuthoringOps(w.ca, url, { ...AUTH, targets: [Q], roles: { [Q]: "load_bearing" }, author: "bo",
                                         selfAttested: [{ capture: b, reason: REASON }] }).publishcase();
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const doc = docOf(w, r).text;
  const row = caseDocumentBlocks(doc).captures.find((c) => c.capture === b);
  assert.deepEqual([row.self_attested_only, row.acknowledgement],
    [true, { reason: REASON, acknowledged_by: "alice", at: w.clock.now, sentence: SELF_ATTESTED_SENTENCE }]);
  assert.deepEqual(row.accounts, [{ by: "alice", at: "2026-09-27T12:00:00Z", text, signature }], "exact bytes");
  assert.equal(SELF_ATTESTED_SENTENCE, listed("case-disclosures.without_attestation_outsider"));
  const body = bodyOf(doc);
  for (const s of [SELF_ATTESTED_SENTENCE, `SELF-ATTESTED ONLY, acknowledged by alice on ${w.clock.now}: ${REASON}`, text, signature])
    assert.ok(body.includes(s), s.slice(0, 40));
  /* the co-attested capture is not marked */
  assert.equal(caseDocumentBlocks(doc).captures.find((c) => c.capture !== b).acknowledgement, undefined);
});

test("R55 (case-disclosures R4): a capture given to the group states only what sources.publishableAt answers for the public, with its basis; with nothing publishable, an unnamed source with the receipt's digest and time; a fetched capture states nothing; no source or entry id is written", () => {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  const k = w.graded(DOC, {}, { receipt: false });
  const f = w.graded(DOC2, CO_ATTESTED);
  w.knocked(k);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }]);
  const P = w.project("Team", "alice", [Q]);
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const src = caseDocumentBlocks(docOf(w, r).text).sources;
  assert.deepEqual(src, [{ capture: k, stated: unnamedSourceStatement({ capture: k, received: T0 }), basis: null }],
    "the fetched capture has no source row");
  assert.ok(!src.some((x) => x.capture === f));
  /* what is written is what publication re-derives at the commit (its R51): the edition signs */
  assert.equal(w.ratify(r).ok, true);
  /* a name disclosed to the group and consented for the public is stated, with its basis; one not consented is not */
  const sourceId = w.sources.sourceOf({ captureSha: k, viewer: V("alice") }).sourceId;
  const name = w.sources.recordDisclosure({ source: sourceId, revealed: { kind: "name", value: "Pat Q. Example" }, how: "self",
                                            knownTo: "group", evidence: "told to alice", sight: ["alice"], by: "alice" });
  const role = w.sources.recordDisclosure({ source: sourceId, revealed: { kind: "attribute", attribute: "role", value: "clerk" },
                                            how: "self", knownTo: "group", evidence: "told to alice", sight: ["alice"], by: "alice" });
  assert.equal(name.ok && role.ok, true, JSON.stringify([name, role]).slice(0, 300));
  assert.equal(w.sources.recordConsent({ source: sourceId, entry: name.entry, audience: "public", evidence: "a signed note",
                                         by: "alice" }).ok, true);
  w.finding(Q2, [{ target: DOC }]);
  const P2 = w.project("Two", "alice", [Q2]);
  const r2 = w.publish(P2, "alice", [Q2]);
  assert.equal(r2.ok, true, JSON.stringify(r2).slice(0, 300));
  const text = docOf(w, r2).text;
  const entry = w.sources.publishableAt({ source: sourceId, audience: "public" }).entries;
  assert.equal(entry.length, 1);
  assert.deepEqual(caseDocumentBlocks(text).sources, [{ capture: k, stated: sourceStatement(entry[0]), basis: "consent" }]);
  assert.match(caseDocumentBlocks(text).sources[0].stated, /Pat Q\. Example/);
  assert.equal(w.ratify(r2).ok, true, "the consented statement holds at the commit");
  for (const leak of [sourceId, name.entry, role.entry, "clerk"]) assert.equal(text.includes(leak), false, `names ${leak}`);
  assert.ok(bodyOf(text).includes(localize("case-disclosures.sources_material_given", "## Sources Of Material Given To The Team")));
});

test("R14: the /5 document states the captures and sources blocks, always, empty included, read back through publication's caseDocumentBlocks", () => {
  const w = world(); w.member("alice");
  w.finding(Q, [{ target: Q2 }], {});
  const n = w.publish(w.project("None", "alice", [Q]), "alice", [Q]);
  assert.equal(n.ok, true, JSON.stringify(n).slice(0, 300));
  const blocks = caseDocumentBlocks(docOf(w, n).text);
  assert.deepEqual([blocks.captures, blocks.sources, blocks.detail], [[], [], null]);
  assert.ok(bodyOf(docOf(w, n).text).includes(listed("case-disclosures.case_findings_rest")));
});

/* ---- R34 ---- */
const ratifyWith = (answer, calls = []) => (real) => new Proxy(real, { get: (t, p) => (p === "caseRatifyPreflight"
  ? (a) => { calls.push(a); return typeof answer === "function" ? answer(a) : answer; }
  : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
const args = (P, targets, over = {}) => ({ ...AUTH, project: P, targets, viewer: V("alice"),
  roles: Object.fromEntries(targets.map((t) => [t, "load_bearing"])), ...over });

test("R34: publishPreflight runs op=publish in a transaction it rolls back, then ratification's pre-flight over the text it would store with the author as signer; ready, first null, and nothing written", () => {
  const calls = [];
  const { w, P, b } = setup({ ratification: ratifyWith({ ok: true, ready: true, refusals: [] }, calls) });
  const before = w.snapshot();
  const a = args(P, [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  const pre = w.ca.publishPreflight(a);
  assert.deepEqual([pre.ok, pre.wrote, pre.ready, pre.first, pre.blockers], [true, false, true, null, []]);
  assert.deepEqual(w.snapshot(), before, "no document, no minted id, no source, nothing");
  assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].signer, calls[0].viewer], ["alice", V("alice")]);
  /* the text is the document op=publish then stores, but for the case id it mints */
  const r = w.ca.publishCase(a);
  const stored = docOf(w, r).text;
  const id = /case_id: (CASE-\S+)/.exec(calls[0].text)[1];
  assert.equal(calls[0].text.split(id).join(r.caseId), stored);
});

test("R34: first is exactly the refusal op=publish would give, and blockers every other refusal reachable independently — each bar shortfall (R6), hunch debt (R55 (case-disclosures R16)), R55 (case-disclosures R2)'s, R55 (case-disclosures R1)'s as R32 reads it — each once", () => {
  const cand = "c".repeat(64);
  const side = (ref, bundle) => ({ kind: "leg", ref, source: { bundle, ref }, capture_sha: null, date: null, doctype: null });
  const contradiction = { unresolvedRecordOn: ({ finding }) => ({ ok: true, truncated: false, candidates: finding === Q
    ? [{ candidate: cand, key: "K1", a: side("page 1", DOC), b: side("page 2", DOC2), state: "open", kind: null, depth: 1 }] : [] }) };
  const w = world({ deps: { contradiction }, ratification: ratifyWith({ ok: true, ready: true, refusals: [] }) });
  for (const m of ["alice"]) w.member(m);
  const b = w.graded(DOC2);
  w.doc(DOC);
  w.finding(Q, [{ target: DOC, grade: "C", grade_axis: "capture", grade_source: "capture" }, { target: DOC2 }]);
  w.finding(Q2, [{ target: DOC, grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" }]);
  const P = w.project("Team", "alice", [Q, Q2], { extra: ["required_strength:", "  capture: B", "  connection: C"] });
  const before = w.snapshot();
  const a = args(P, [Q, Q2]);
  const pre = w.ca.publishPreflight(a);
  const pub = w.ca.publishCase(a);
  assert.deepEqual(pre.first, pub, "exactly op=publish's refusal");
  assert.equal(pub.reason, "BELOW_PROJECT_STRENGTH");
  assert.deepEqual(w.snapshot(), before);
  const kinds = pre.blockers.map((x) => [x.reason, x.target ?? null, x.axis ?? null]);
  assert.deepEqual(kinds, [
    ["BELOW_PROJECT_STRENGTH", Q, "connection"], ["BELOW_PROJECT_STRENGTH", Q2, "capture"], ["BELOW_PROJECT_STRENGTH", Q2, "connection"],
    ["UNCLEARED_HUNCH", null, null], ["CO_ATTESTATION_UNACKNOWLEDGED", null, null], ["TENSION_NOT_DISCLOSED", null, null]]);
  assert.ok(!pre.blockers.some((x) => JSON.stringify(x) === JSON.stringify(pub)), "first is not repeated");
  assert.equal(pre.ready, false);
  assert.equal(pre.steps[7].ratification.reached, false, "ratification's list needs the document, and op=publish refuses first");
  /* negative control: each cause removed, ready */
  const tension = { tensionsDisclosed: [{ candidate: cand }], selfAttested: [{ capture: b, reason: REASON }] };
  w.finding(Q2, [{ target: DOC }]);
  const P2 = w.project("Two", "alice", [Q, Q2]);
  const ready = w.ca.publishPreflight(args(P2, [Q, Q2], tension));
  assert.deepEqual([ready.ready, ready.first, ready.blockers], [true, null, []], JSON.stringify(ready.blockers).slice(0, 300));
});

test("R34: ratification R18's list is folded into blockers; its undetermined answer is itself a blocker; with no pre-flight offered the list is stated as not reached, and ready is false", async () => {
  const { refusal } = await preflightRefusal();
  const one = setup({ ratification: ratifyWith({ ok: true, ready: false, refusals: [refusal] }) });
  const a = (s) => args(s.P, [Q], { selfAttested: [{ capture: s.b, reason: REASON }] });
  const r1 = one.w.ca.publishPreflight(a(one));
  assert.deepEqual([r1.ready, r1.first, r1.blockers, r1.steps[7].ratification], [false, null, [refusal],
    { reached: true, refusals: [refusal] }]);
  const und = { ok: false, reason: "PREFLIGHT_UNDETERMINED", detail: localize("question-explorer.gate_read", "the gate could not be read") };
  const two = setup({ ratification: ratifyWith(und) });
  const r2 = two.w.ca.publishPreflight(a(two));
  assert.deepEqual([r2.ready, r2.blockers], [false, [und]]);
  const three = setup({ ratification: (real) => new Proxy(real, { get: (t, p) => (p === "caseRatifyPreflight" ? undefined
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) }) });
  const r3 = three.w.ca.publishPreflight(a(three));
  assert.deepEqual([r3.ready, r3.first, r3.blockers, r3.steps[7].ratification.reached], [false, null, [], false]);
});

test("R34, R67, R68: steps gives the eight steps' content — what becomes permanent; what this rests on (roles, pairs, bar); what you are leaving out (exclusions, searched section, bias, R32's tensions, R55 (case-disclosures R2)'s self-attested documents, R55 (case-disclosures R4)'s source statements); photos; the edition this creates; the account; approvals; and sign", () => {
  const { w, P, b } = setup({ ratification: ratifyWith({ ok: true, ready: true, refusals: [] }) });
  w.knocked(b);
  const excluded = [{ description: "the side letter", reason: "not in hand" }];
  const pre = w.ca.publishPreflight(args(P, [Q], { excluded, selfAttested: [{ capture: b, reason: REASON }] }));
  assert.deepEqual(pre.steps.map((s) => [s.step, s.name]), [[1, localize("case-authoring.name.becomes_permanent", "what becomes permanent")], [2, localize("case-authoring.name.rests", "what this rests on")],
    [3, localize("case-authoring.name.leaving_out", "what you are leaving out")], [4, "photos"], [5, localize("case-authoring.name.edition_creates", "the edition this creates")], [6, "the account"], [7, "approvals"],
    [8, "sign"]]);
  const [one, two, three, photos, four, account, approvals, five] = pre.steps;
  /* R67: with no account written, the step lists the four statements' rows, each judged (case-disclosures R30) */
  assert.deepEqual(account.sentences.map((x) => [x.kind, x.result]), [["statement", "passed"], ["subject_justification", "passed"],
    ["excluded", "passed"]]);
  /* R68: no rule in force (the default): nothing is required, nothing missing */
  assert.deepEqual([approvals.rule, approvals.required, approvals.missing], [null, [], []]);
  assert.deepEqual([photos.photos, photos.unchecked], [[], 0], "no photo reached: the step is stated, empty");
  assert.match(one.says, /never withdrawn or edited/);
  assert.deepEqual([one.edition, one.pinned], [1, [{ target: Q, bundleSha: w.head(Q) }]]);
  assert.deepEqual([two.roles, two.required.declared, two.pairs[0].target], [[{ target: Q, role: "load_bearing" }], false, Q]);
  assert.deepEqual(three.excluded, [{ target: null, ...excluded[0] }], "as the act normalised it");
  assert.equal(three.searched.summary.subject_source, "case_basis");
  assert.deepEqual([three.bias.acknowledgement, three.bias.manifest.in_force], [AUTH.biasAcknowledgement, false]);
  assert.deepEqual(three.tensions.candidates, w.ca.tensionsToDisclose({ project: P, targets: [Q], viewer: V("alice"), author: "alice" }).candidates);
  assert.deepEqual(three.self_attested, [{ capture: b, member: Q, reason: REASON, sentence: SELF_ATTESTED_SENTENCE }]);
  assert.deepEqual(three.sources, [{ capture: b, stated: unnamedSourceStatement({ capture: b, received: T0 }), basis: null }]);
  assert.deepEqual([four.edition, four.minted, four.members], [1, true, [{ target: Q, edition: 1, crossed: false }]]);
  assert.deepEqual([five.signer, five.ratification], ["alice", { reached: true, refusals: [] }]);
  /* refused first: the parts that need the document say they were not reached, never filled */
  const no = w.ca.publishPreflight(args(P, [Q]));
  assert.equal(no.first.reason, "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.match(no.steps[0].stated, /^not reached: op=publish refuses first \(CO_ATTESTATION_UNACKNOWLEDGED\)/);
  assert.ok(Array.isArray(no.steps[2].tensions.candidates), "R32's read is still carried");
});

test("R34: it raises no re-evaluation for a member's new edition (R15's listeners are never told of an edition a rolled-back run made), and op=publishpreflight takes its stamps from the query after the body", async () => {
  const { w, P, b } = setup({ ratification: ratifyWith({ ok: true, ready: true, refusals: [] }) });
  const sa = { selfAttested: [{ capture: b, reason: REASON }] };
  const a1 = w.publish(P, "alice", [Q], sa); w.ratify(a1);
  assert.equal(w.publication.commitEdition({ bundleId: Q, edition: 1, bundleSha: w.head(Q), title: "q", attestorKey: "k",
    gateVersion: "1.37.0", sigArmored: "s-q-1", shas: [], edges: [], at: "2026-09-28T02:00:00Z" }).ok, true);
  const told = [];
  assert.equal(w.reevaluation.onBasisChanged("monitoring", (e) => { told.push(e); }).ok, true);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }, { target: Q2 }]);
  const fresh = { statement: "A second edition's limits.", subjectJustification: "Fresh.", biasAcknowledgement: "Ours, now.",
                  excluded: [{ description: "x", reason: "y" }], whatChanged: WHAT_CHANGED };
  const before = w.snapshot();
  const pre = w.ca.publishPreflight(args(P, [Q], { caseId: a1.caseId, ...fresh, ...sa }));
  assert.equal(pre.ready, true, JSON.stringify(pre.blockers).slice(0, 300));
  assert.deepEqual(pre.steps[4].members, [{ target: Q, edition: 2, crossed: false }]);
  assert.deepEqual(told, [], "no listener told");
  assert.deepEqual(w.snapshot(), before);
  /* the op: author and viewer stamped from the query; a body's own are overwritten */
  const url = new URL(`http://do/publishpreflight?author=alice&viewer=${encodeURIComponent(V("alice"))}&project=${P}&caseId=${a1.caseId}`);
  const viaOp = await caseAuthoringOps(w.ca, url, { ...AUTH, ...fresh, ...sa, targets: [Q], roles: { [Q]: "load_bearing" },
                                             author: "bo", viewer: V("bo") }).publishpreflight();
  assert.deepEqual([viaOp.ready, viaOp.steps[7].signer], [true, "alice"]);
  const pub = w.publish(P, "alice", [Q], { caseId: a1.caseId, ...fresh, ...sa });
  assert.equal(pub.ok, true);
  assert.deepEqual(told.map((e) => [e.subject, e.source]), [[Q, "edition"]], "op=publish itself still raises");
});

test("R34: against the real ratification R18, its list is read over the text op=publish would store, with the author as signer, and folded into blockers as ratification answers it", () => {
  const { w, P, b } = setup();
  const a = args(P, [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  const before = w.snapshot();
  const pre = w.ca.publishPreflight(a);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  assert.equal(pre.first, null);
  assert.equal(pre.steps[7].ratification.reached, true);
  /* the same answer ratification gives over the document op=publish then stores, but for the minted case id */
  const r = w.ca.publishCase(a);
  const direct = w.ratification.caseRatifyPreflight({ text: docOf(w, r).text, signer: "alice", viewer: V("alice") });
  assert.equal(direct.ok, true, JSON.stringify(direct).slice(0, 300));
  const strip = (x) => JSON.parse(JSON.stringify(x).split(r.caseId).join("CASE"));
  const idOf = (x) => /CASE-\d{4}-\d{4}/.exec(JSON.stringify(x))?.[0];
  const pr = pre.steps[7].ratification.refusals;
  const id = idOf(pr);
  assert.deepEqual(id ? JSON.parse(JSON.stringify(pr).split(id).join("CASE")) : pr, strip(direct.refusals));
  assert.deepEqual(pre.blockers, pr, "ratification's refusals are the blockers here");
  assert.equal(pre.ready, direct.refusals.length === 0);
});

test("R34 (N435): an agent credential's stamp — {stamp, aiCred}, as the door stamps a minted agent's — is carried whole to ratification R18, so its machine fences hold the agent whatever its viewer stamp; the act and every other read are asked as the stamp; op=publishpreflight reads the door's aiCred beside viewer, and one that does not parse still fences", async () => {
  const { w, P, b } = setup();
  /* a member-scoped agent credential alice mints: its viewer stamp is alice's own (membership R28's principal) */
  const mint = w.credentials.aiCredentialMint({ who: "alice", tokenId: "AIC-0001", secretSha: sha("the agent's secret"),
    principalKind: "member", principalMember: "alice", taskScope: "prepare the case", writes: [] });
  assert.equal(mint.ok, true, JSON.stringify(mint).slice(0, 300));
  const aiCred = { tokenId: "AIC-0001", principal: mint.credential.principal };
  const a = args(P, [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  const before = w.snapshot();
  const agent = w.ca.publishPreflight({ ...a, viewer: { stamp: V("alice"), aiCred } });
  const member = w.ca.publishPreflight(a);
  assert.deepEqual(w.snapshot(), before, "nothing written by either");
  /* the act is asked as the stamp: it would publish for both, and their steps read the same document */
  assert.deepEqual([agent.first, member.first, agent.steps[7].ratification.reached, member.steps[7].ratification.reached],
    [null, null, true, true]);
  assert.deepEqual(agent.steps[0].pinned, member.steps[0].pinned);
  assert.deepEqual(agent.steps[2].tensions, member.steps[2].tensions, "R32's read is asked as the stamp");
  /* ratification's fences hold the agent, and only the agent */
  const fenced = ["MACHINE_CANNOT_RATIFY_CASE", "OPERATOR_TOKEN_CANNOT_RATIFY_CASE"];
  const reasons = (r) => r.steps[7].ratification.refusals.map((x) => x.reason);
  assert.deepEqual(reasons(agent).filter((x) => fenced.includes(x)), fenced);
  assert.deepEqual(reasons(member).filter((x) => fenced.includes(x)), [], "negative control: the member's own stamp");
  assert.deepEqual(reasons(agent).filter((x) => !fenced.includes(x)), reasons(member), "everything else alike");
  assert.equal(agent.ready, false);
  for (const code of fenced) assert.ok(agent.blockers.some((x) => x.reason === code), `${code} is a blocker`);
  /* the route: the door's aiCred beside viewer; absent, the stamp alone; unparsable, still an agent's */
  const route = (extra) => caseAuthoringOps(w.ca, new URL(`http://do/publishpreflight?author=alice&viewer=${
    encodeURIComponent(V("alice"))}&project=${P}${extra}`), { ...a, viewer: V("bo"), author: "bo" }).publishpreflight();
  const viaDoor = await route(`&aiCred=${encodeURIComponent(JSON.stringify(aiCred))}`);
  assert.deepEqual(reasons(viaDoor), reasons(agent));
  assert.deepEqual(reasons(await route("")), reasons(member));
  assert.deepEqual(reasons(await route("&aiCred=not-json")).filter((x) => fenced.includes(x)), fenced, "fails closed");
  /* last, since it stores a preparation: exactly as ratification answers that viewer over the text op=publish then stores, but for the minted case id */
  const r = w.ca.publishCase(a);
  const direct = w.ratification.caseRatifyPreflight({ text: docOf(w, r).text, signer: "alice",
                                                      viewer: { stamp: V("alice"), aiCred } });
  const idOf = (x) => /CASE-\d{4}-\d{4}/.exec(JSON.stringify(x))?.[0];
  const norm = (x, id) => (id ? JSON.parse(JSON.stringify(x).split(id).join("CASE")) : x);
  const pr = agent.steps[7].ratification.refusals;
  assert.deepEqual(norm(pr, idOf(pr)), norm(direct.refusals, r.caseId));
});
