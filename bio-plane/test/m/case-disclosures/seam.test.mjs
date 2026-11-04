/* case-disclosures: the C-120 family in this module's own table (R22), no place named (R21), the seam (R23), and the
   renderers moved byte for byte (K1333): a section rendered from fixed rows hashes to what case-authoring's renderers
   rendered from the same rows before the split. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { list as profiles } from "../../../../jurisdictions/index.mjs";
import { world, storage, V, T0 } from "./fixture.mjs";
import * as CD from "../../../src/case-disclosures/index.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { checkAccountMalformed } from "../case-checker/fixtures.mjs";

const { CASE_DISCLOSURE_CHECKS, caseDisclosuresOf } = CD;
const Q = "INQ-2026-0001-q", DOC = "INFO-2026-0001-a";
const hash = (lines) => createHash("sha256").update(lines.join("\n")).digest("hex");

/* ---------------------------------------------------------------- R22 */

/* The requirements' table, word for word (`build/requirements/case-disclosures.md`, R22), C-120.8 as DEC-149 re-words it
   (T34-87). */
const ROWS = [
  ["TENSION_NOT_DISCLOSED", "C-120.1", "tensionsJudged", word("refusal.TENSION_NOT_DISCLOSED")],
  ["DISCLOSURE_NOT_STANDING", "C-120.2", "tensionsJudged", word("refusal.DISCLOSURE_NOT_STANDING")],
  ["TENSIONS_UNDETERMINED", "C-120.3", "tensionsUndetermined", word("refusal.TENSIONS_UNDETERMINED")],
  ["CO_ATTESTATION_UNACKNOWLEDGED", "C-120.4", "selfAttestedJudged", word("refusal.CO_ATTESTATION_UNACKNOWLEDGED")],
  ["SELF_ATTESTED_NO_REASON", "C-120.5", "selfAttestedJudged", word("refusal.SELF_ATTESTED_NO_REASON")],
  ["SELF_ATTESTATION_NOT_STANDING", "C-120.6", "selfAttestedJudged", localize("case-disclosures.checks.a_document_acknowledged_as_self", "A document acknowledged as self-attested only is either co-attested already or not one this case rests on, so it needs no acknowledgement. Remove it from the list. Nothing was written.")],
  ["UNCLEARED_HUNCH", "C-120.7", "hunchDebt", word("refusal.UNCLEARED_HUNCH")],
  ["RELIED_ON_NOT_PRESENTABLE", "C-120.8", "materialsJudged", word("refusal.RELIED_ON_NOT_PRESENTABLE")],
  ["ACCEPTED_WORK_NOT_IN_FORCE", "C-120.10", "acceptedWorkJudged", word("refusal.ACCEPTED_WORK_NOT_IN_FORCE")],
  ["FLAG_NOT_DISCLOSED", "C-120.11", "flagsJudged", word("refusal.FLAG_NOT_DISCLOSED")],
  ["FLAGS_UNDETERMINED", "C-120.12", "flagsJudged", word("refusal.FLAGS_UNDETERMINED")],
  ["FLAG_DISCLOSURE_NOT_STANDING", "C-120.13", "flagsJudged", word("refusal.FLAG_DISCLOSURE_NOT_STANDING")],
  /* R22's new rows (T33-68), numbered provisionally until their stamp; the translations are drafts */
  ["PERSON_BASIS_UNRECORDED", "C-120.14", "peopleJudged", word("refusal.PERSON_BASIS_UNRECORDED")],
  ["PERSON_BASIS_NOT_STANDING", "C-120.15", "peopleJudged", word("refusal.PERSON_BASIS_NOT_STANDING")],
  ["TIE_ATTESTATION_MISSING", "C-120.16", "tieAttestationJudged", word("refusal.TIE_ATTESTATION_MISSING")],
  /* R22's new rows (T37; N757, K2206), R6's, numbered provisionally until their stamp; the translations are BOB's drafts */
  /* T38 (DEC-183; K2220, K2303): C-120.17 re-worded to `words.json`'s `photo.refused.format`, verbatim */
  ["PHOTO_NOT_COVERABLE", "C-120.17", "materialsJudged", word("photo.refused.format", { photo: "{photo}" })],
  ["PHOTO_MARKS_UNDETERMINED", "C-120.18", "materialsJudged", word("refusal.PHOTO_MARKS_UNDETERMINED")],
  /* T38 (DEC-183 (1); K2220, K2303): R6's PHOTO_UNCHECKED, `photo.refused.unchecked` verbatim, re-worded by DEC-187 (1) (T40) */
  ["PHOTO_UNCHECKED", "C-120.19", "materialsJudged", word("photo.refused.unchecked", { photo: "{photo}" })],
  /* T39 (N806; K2333): R6's member-document rows, numbered provisionally until their stamp; .21 and .22 `words.json`'s
     `document.refused.pending` and `document.refused.clean` verbatim (T41; DEC-188 (7)) */
  ["DOCUMENT_COPY_UNDETERMINED", "C-120.20", "materialsJudged", word("refusal.DOCUMENT_COPY_UNDETERMINED")],
  ["DOCUMENT_COPY_PENDING", "C-120.21", "materialsJudged", word("document.refused.pending", { document: "{document}" })],
  ["DOCUMENT_NOT_CLEANABLE", "C-120.22", "materialsJudged", word("document.refused.clean", { document: "{document}" })],
  /* T41 (N820; D56–D58, D63; K2471): R30's rows, in its order, numbered provisionally until T42's stamp; drafts */
  ["ACCOUNT_SENTENCE_UNSUPPORTED", "C-120.23", "accountJudged", word("refusal.ACCOUNT_SENTENCE_UNSUPPORTED")],
  ["ACCOUNT_FACT_NOT_IN_CITED", "C-120.24", "accountJudged", word("refusal.ACCOUNT_FACT_NOT_IN_CITED")],
  ["ACCOUNT_CONTRADICTED_BY_RECORD", "C-120.25", "accountJudged", word("refusal.ACCOUNT_CONTRADICTED_BY_RECORD")],
  ["ACCOUNT_BIAS_NOT_PRINTED", "C-120.26", "accountJudged", word("refusal.ACCOUNT_BIAS_NOT_PRINTED")],
  ["ACCOUNT_CLAIM_NOT_BIAS", "C-120.27", "accountJudged", word("refusal.ACCOUNT_CLAIM_NOT_BIAS")],
  ["ACCOUNT_FLAG_UNANSWERED", "C-120.28", "accountJudged", word("refusal.ACCOUNT_FLAG_UNANSWERED")],
  ["ACCOUNT_CHECK_UNDETERMINED", "C-120.29", "accountJudged", word("refusal.ACCOUNT_CHECK_UNDETERMINED")],
];

test("R22: C-120.1–C-120.8, C-120.10–C-120.13 and the new rows C-120.14–C-120.16 (R25's PERSON_BASIS_UNRECORDED and PERSON_BASIS_NOT_STANDING, R27's TIE_ATTESTATION_MISSING) C-120.17–C-120.18 (R6's PHOTO_NOT_COVERABLE and PHOTO_MARKS_UNDETERMINED), C-120.19 (R6's PHOTO_UNCHECKED, T38), C-120.20–C-120.22 (R6's DOCUMENT_COPY_UNDETERMINED, DOCUMENT_COPY_PENDING and DOCUMENT_NOT_CLEANABLE, T39) and C-120.23–C-120.29 (R30's ACCOUNT_SENTENCE_UNSUPPORTED, ACCOUNT_FACT_NOT_IN_CITED, ACCOUNT_CONTRADICTED_BY_RECORD, ACCOUNT_BIAS_NOT_PRINTED, ACCOUNT_CLAIM_NOT_BIAS, ACCOUNT_FLAG_UNANSWERED and ACCOUNT_CHECK_UNDETERMINED, T41) are this module's own table (CASE_DISCLOSURE_CHECKS), ids, codes and translations as the requirements state them word for word, each `where` naming this module's raising method; C-120.9 is never used", () => {
  assert.deepEqual(Object.keys(CASE_DISCLOSURE_CHECKS), ROWS.map(([code]) => code));
  assert.ok(Object.isFrozen(CASE_DISCLOSURE_CHECKS));
  const w = world();
  for (const [code, check, method, translation] of ROWS) {
    const row = CASE_DISCLOSURE_CHECKS[code];
    assert.deepEqual([row.check, row.translation], [check, translation], code);
    const [, fn, region] = /^src\/case-disclosures\/index\.mjs (\w+) > ([a-z-]+)$/.exec(row.where) || [];
    assert.equal(fn, method, `${code}: ${row.where}`);
    assert.equal(typeof w.cd[fn], "function", `${code}: ${fn} is a service of this module`);
    assert.match(region, /^is-[a-z-]+$/);
  }
  assert.equal(Object.values(CASE_DISCLOSURE_CHECKS).some((r) => r.check === "C-120.9"), false);
  assert.equal(new Set(Object.values(CASE_DISCLOSURE_CHECKS).map((r) => r.where)).size, ROWS.length, "each site once");
});

test("R22: each row's method raises its code, with the row's check and translation (one negative control per row: the same method, the condition absent, does not)", () => {
  const cand = (id) => ({ candidate: id, a: { text: "a" }, b: { text: "b" }, state: "open" });
  const raised = (r) => (Array.isArray(r) ? r : r ? [r] : []).map((x) => [x.code, x.check, x.translation]);
  const row = (code) => [code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation];
  const prep = [{ id: Q, bundleSha: "s" }];
  /* C-120.1, C-120.2 */
  const t = world({ deps: { contradiction: { unresolvedRecordOn: () => ({ ok: true, candidates: [cand("c1")] }) } } });
  assert.deepEqual(raised(t.cd.tensionsJudged(prep, V("alice"), [{ candidate: "c2" }]).refusals), [row("TENSION_NOT_DISCLOSED"), row("DISCLOSURE_NOT_STANDING")]);
  assert.deepEqual(t.cd.tensionsJudged(prep, V("alice"), [{ candidate: "c1" }]).refusals, []);
  /* C-120.3 */
  assert.deepEqual(raised(t.cd.tensionsUndetermined([{ finding: Q, why: "x" }])), [row("TENSIONS_UNDETERMINED")]);
  /* C-120.4–C-120.6 */
  const f = (capture, co) => [capture, { capture, grade: "B", co_attested: co, timestamp_at: null, co_archive: null }];
  const facts = new Map([f("b1", false), f("b2", true)]);
  const resting = [{ member: Q, capture: "b1" }, { member: Q, capture: "b2" }];
  const roles = [{ target: Q, role: "load_bearing" }];
  assert.deepEqual(raised(t.cd.selfAttestedJudged(resting, facts, roles, [{ capture: "b2", reason: "" }]).refusals),
    [row("CO_ATTESTATION_UNACKNOWLEDGED"), row("SELF_ATTESTED_NO_REASON"), row("SELF_ATTESTATION_NOT_STANDING")]);
  assert.deepEqual(t.cd.selfAttestedJudged(resting, facts, roles, [{ capture: "b1", reason: "r" }]).refusals, []);
  /* C-120.7 */
  const h = (legs) => world({ deps: { inquiry: { basisFor: () => ({ ok: true, legs }) } } }).cd.hunchDebt(prep);
  assert.deepEqual(raised(h([{ ord: 0, target_id: DOC, grade_source: "hunch" }])), [row("UNCLEARED_HUNCH")]);
  assert.equal(h([{ ord: 0, target_id: DOC, grade_source: "capture" }]), null);
  /* C-120.8 */
  const m = world(); m.member("alice"); m.doc(DOC, {}, { indexed: false }); m.finding(Q, [{ target: DOC }]);
  assert.deepEqual(raised(m.cd.materialsJudged(m.prepared([Q]), m.roles([Q]), V("alice")).refusals), [row("RELIED_ON_NOT_PRESENTABLE")]);
  assert.deepEqual(m.cd.materialsJudged(m.prepared([Q]), m.roles([Q], [Q]), V("alice")).refusals, []);
  /* C-120.17, C-120.18, C-120.19 */
  const ph = world(); ph.member("alice"); const pc = ph.doc(DOC); ph.finding(Q, [{ target: DOC }]);
  const judgedPh = (supporting = []) => ph.cd.materialsJudged(ph.prepared([Q]), ph.roles([Q], supporting), V("alice")).refusals;
  ph.marks.photo(pc, { state: "marked", refused: "PNG_INTERLACED" });
  assert.deepEqual(raised(judgedPh()), [row("PHOTO_NOT_COVERABLE")]);
  assert.deepEqual(judgedPh([Q]), []);
  ph.marks.read = () => ({ ok: false, reason: "NO_SUCH_PHOTO" });
  assert.deepEqual(raised(judgedPh()), [row("PHOTO_MARKS_UNDETERMINED")]);
  ph.marks.read = null; ph.marks.photo(pc, { state: "unchecked" });
  assert.deepEqual(raised(judgedPh()), [row("PHOTO_UNCHECKED")]);
  ph.marks.photo(pc, { state: "nothing_to_obscure", copy: "c".repeat(64) });
  assert.deepEqual(judgedPh(), []);
  /* C-120.20, C-120.21, C-120.22 */
  const dc = world(); dc.member("alice"); const dd = dc.doc(DOC); dc.finding(Q, [{ target: DOC }]);
  const judgedDc = (supporting = []) => dc.cd.materialsJudged(dc.prepared([Q]), dc.roles([Q], supporting), V("alice")).refusals;
  dc.marks.document(dd, "undetermined");
  assert.deepEqual(raised(judgedDc()), [row("DOCUMENT_COPY_UNDETERMINED")]);
  dc.marks.document(dd, "pending");
  assert.deepEqual(raised(judgedDc()), [row("DOCUMENT_COPY_PENDING")]);
  assert.deepEqual(judgedDc([Q]), []);
  dc.marks.document(dd, { state: "refused", copy: null, refused: { code: "ENCRYPTED", detail: "d" } });
  assert.deepEqual(raised(judgedDc()), [row("DOCUMENT_NOT_CLEANABLE")]);
  assert.deepEqual(judgedDc([Q]), []);
  dc.marks.document(dd, { state: "copy", copy: "c".repeat(64), refused: null });
  assert.deepEqual(judgedDc(), []);
  /* C-120.10 */
  const a = world({ deps: { caseImport: { acceptanceOf: () => null, importedCase: () => null } } });
  assert.deepEqual(raised(a.cd.acceptedWorkJudged([{ member: Q, leg_of: Q, ord: 0, ref: `imported:${"a".repeat(64)}/INQ-2026-0042-x` }], V("alice")).refusals),
    [row("ACCEPTED_WORK_NOT_IN_FORCE")]);
  assert.deepEqual(a.cd.acceptedWorkJudged([], V("alice")).refusals, []);
  /* C-120.11–C-120.13 */
  const fl = (answer) => world({ deps: { caseImport: { openFlagsOn: () => answer } } }).cd;
  const eds = [{ import: "i", edition: 1, refs: [{ ref: "r", finding: null, member: Q }] }];
  const open = { ok: true, complete: true, flags: [{ flag: "F1", issue: "i" }] };
  assert.deepEqual(raised(fl(open).flagsJudged(eds, [{ flag: "F2" }]).refusals), [row("FLAG_NOT_DISCLOSED"), row("FLAG_DISCLOSURE_NOT_STANDING")]);
  assert.deepEqual(raised(fl({ ok: true, complete: false, flags: [] }).flagsJudged(eds, null).refusals), [row("FLAGS_UNDETERMINED")]);
  assert.deepEqual(fl(open).flagsJudged(eds, [{ flag: "F1" }]).refusals, []);
  /* C-120.14, C-120.15 */
  const P = "ENT-2026-0001", named = { named: [{ person: P, members: [P], places: [{ place: "statement", where: "s1", ref: P }] }] };
  const pj = world().cd;
  assert.deepEqual(raised(pj.peopleJudged(named, []).refusals), [row("PERSON_BASIS_UNRECORDED")]);
  assert.deepEqual(raised(pj.peopleJudged(named, [{ person: P, basis: "private_party", ref: null }]).refusals), [row("PERSON_BASIS_NOT_STANDING")]);
  assert.deepEqual(pj.peopleJudged(named, [{ person: P, basis: "private_party", ref: null, words: "they spoke at the hearing" }]).refusals, []);
  /* C-120.16 */
  assert.deepEqual(raised(pj.tieAttestationJudged(["alice"], { named: [], entities: [] }, [], [], V("alice")).refusals), [row("TIE_ATTESTATION_MISSING")]);
  assert.deepEqual(pj.tieAttestationJudged(["alice"], { named: [], entities: [] }, [], [{ signer: "alice", at: T0 }], V("alice")).refusals, []);
  /* C-120.23–C-120.29: each arm `checkAccount` answers, the unanswered flag, and a check that cannot be run */
  const S = [{ ord: 1, text: "The council met.", cites: ["h1"] }];
  const acct = (departures, flags = null) => world({ deps: { caseChecker: { checkAccount: () => ({ ok: true, departures }) },
    bias: { statementInForce: () => ({ ok: true, in_force: true }) } } }).cd.accountJudged({ account: S, cited: {}, flags });
  for (const code of CD.ACCOUNT_ARMS) {
    assert.deepEqual(raised(acct([{ ord: 1, code }]).refusals), [row(code)], code);
    assert.deepEqual(acct([]).refusals, [], `${code}: none departs`);
  }
  assert.deepEqual(raised(acct([], [{ kind: "account_check", ord: 1, text: "The council met.", cites: ["h1"] }]).refusals), [row("ACCOUNT_FLAG_UNANSWERED")]);
  assert.deepEqual(acct([], [{ kind: "account_check", ord: 1, text: "The council met.", cites: [] }]).refusals, [], "tied to evidence");
  const un = world({ deps: { caseChecker: { checkAccount: () => checkAccountMalformed() } } }).cd;
  assert.deepEqual(raised(un.accountJudged({ account: S, cited: {} }).refusals), [row("ACCOUNT_CHECK_UNDETERMINED")]);
});

/* ---------------------------------------------------------------- R21 */

test("R21: no place is named in this module's behaviour or outward text — its rows, sentences, refusals and every line its renderers write name no place a jurisdiction profile covers (the profiles' `covers`, read through jurisdictions' own `list`, K1545)", () => {
  const places = new Set();
  for (const p of profiles())
    for (const c of p.covers) {
      places.add(c);
      places.add(c.replace(/^(City|Town|County) of /, "").replace(/ (County|City)$/, ""));
    }
  assert.ok(places.size >= 4, "the profiles name places");
  const said = [JSON.stringify(Object.values(CASE_DISCLOSURE_CHECKS)), CD.SELF_ATTESTED_SENTENCE, CD.HIGHLIGHT_SENTENCE,
                CD.NOT_SHOWN_WORDS, CD.TENSIONS_DEPTH_STATED, JSON.stringify(CD.TENSION_TEMPLATES), CD.FLAG_SENTENCE, CD.FLAGS_SAY,
                JSON.stringify([CD.PERSON_BASES, CD.PERSON_PLACES]), CD.peopleLines([{ person: "ENT-1", places: "statement s1", basis: "tie", citation: "line LIN-1", words: null }]).join("\n"),
                CD.memberTieLines([{ row: "tie", signer: null, at: null, entity: "ENT-2", kind: "employer", level: "group", shown: null }]).join("\n"),
                ...Object.values(RENDERED).map(([fn, args]) => CD[fn](...args).join("\n")), ...ROWS_T.map(CD.tensionSentence)];
  /* the refusals' own words, each raised */
  const w = world({ deps: { contradiction: { unresolvedRecordOn: () => { throw new Error("x"); } } } });
  w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC, grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" }]);
  said.push(JSON.stringify(w.cd.hunchDebt(w.prepared([Q]))), JSON.stringify(w.cd.tensionsJudged(w.prepared([Q]), V("alice"), null)),
            JSON.stringify(w.cd.tensionsJudged(w.prepared([Q]), V("alice"), "x")), JSON.stringify(w.cd.methodOf()));
  const P = "ENT-2026-0001", named = { named: [{ person: P, members: [P], places: [{ place: "statement", where: "s1", ref: P }] }], entities: [P] };
  said.push(JSON.stringify(w.cd.peopleJudged(named, [])), JSON.stringify(w.cd.peopleJudged(named, [{ person: P, basis: "tie", ref: "LIN-2026-0009" }])),
            JSON.stringify(w.cd.peopleJudged(named, "x")), JSON.stringify(w.cd.tieAttestationJudged(["alice", "bo"], named, [], [], V("alice"))),
            JSON.stringify(w.cd.peopleNamed(w.prepared([Q]), [{ place: "statement", where: "s1", people: ["nobody"] }, { place: "x" }], V("alice"))));
  const all = said.join("\n");
  for (const p of places) assert.equal(all.includes(p), false, `names ${p}`);
});

/* ---------------------------------------------------------------- R23 */

test("R23: every service is synchronous, and none throws when every module it reads fails — each answers, stating less", () => {
  const boom = () => { throw new Error("down"); };
  const deps = { inquiry: { basisFor: boom }, strength: { gradingFacts: boom }, contradiction: { unresolvedRecordOn: boom },
                 provenance: { captureGrade: boom }, attestation: { attestationsOf: boom },
                 capture: { lateAttestationsOf: boom, captureAccountsOf: boom }, sources: { sourceOf: boom, publishableAt: boom },
                 extraction: { unitsOf: boom }, promotion: { fact: boom },
                 caseImport: { acceptanceOf: boom, openFlagsOn: boom, importedCase: boom },
                 entities: { readEntity: boom }, events: { readEvent: boom }, lines: { readLine: boom, structureAt: boom },
                 money: { readFact: boom }, people: { identityOf: boom, interestsOf: boom, personAt: boom, tiesConcerning: boom },
                 membership: { memberFacts: boom }, caseCarriage: { photoMarks: boom, documentCopy: boom },
                 bias: { statementInForce: boom }, caseChecker: { checkAccount: boom } };
  const w = world({ deps: { ...deps, record: { readFile: boom } } });
  w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const prep = w.prepared([Q]), roles = w.roles([Q]);
  const ref = `imported:${"a".repeat(64)}/INQ-2026-0042-x`;
  const calls = {
    hunchDebt: () => w.cd.hunchDebt(prep),
    tensionsRead: () => w.cd.tensionsRead(prep, V("alice")),
    tensionsJudged: () => w.cd.tensionsJudged(prep, V("alice"), null),
    tensionsUndetermined: () => w.cd.tensionsUndetermined([]),
    restingCaptures: () => w.cd.restingCaptures(prep),
    captureFacts: () => w.cd.captureFacts("e".repeat(64)),
    selfAttestedJudged: () => w.cd.selfAttestedJudged([], new Map(), roles, null),
    materialsJudged: () => w.cd.materialsJudged(prep, roles, V("alice")),
    photosOf: () => w.cd.photosOf([{ ref: DOC, kind: "document", sha: "e".repeat(64), members: [Q] }], roles, V("alice")),
    acceptedWorkJudged: () => w.cd.acceptedWorkJudged([{ member: Q, leg_of: Q, ord: 1, ref }], V("alice")),
    flagsJudged: () => w.cd.flagsJudged([{ import: "i", edition: 1, refs: [{ ref, finding: null, member: Q }] }], null),
    sourcesStated: () => w.cd.sourcesStated(["e".repeat(64)], V("alice")),
    withheldOf: () => w.cd.withheldOf([]),
    findingFacts: () => w.cd.findingFacts([{ id: Q, member: Q }], V("alice")),
    methodOf: () => w.cd.methodOf(),
    peopleNamed: () => w.cd.peopleNamed(prep, [{ place: "statement", where: "s1", people: ["ENT-2026-0001"] },
      { place: "timeline", where: "t1", event: "EVT-2026-0001" }, { place: "money", where: "m1", fact: "MNY-2026-0001" }], V("alice")),
    peopleJudged: () => w.cd.peopleJudged({ named: [{ person: "ENT-2026-0001", members: ["ENT-2026-0001"], places: [] }] },
      [{ person: "ENT-2026-0001", basis: "act_or_position", ref: { line: "LIN-2026-0001", event: "EVT-2026-0001" }, words: "w" }], V("alice")),
    tieAttestationJudged: () => w.cd.tieAttestationJudged(["alice"], { named: [], entities: ["ENT-2026-0001"] }, [], [{ signer: "alice", at: T0 }], V("alice")),
    disclosureBlocks: () => w.cd.disclosureBlocks({ resting: [{ member: Q, capture: "e".repeat(64) }],
      reached: { materials: [{ ref: DOC, kind: "document", sha: "e".repeat(64), held: { text_sha: null }, included: false, rests_under: "supporting" }] },
      author: "alice", at: T0 }),
    accountJudged: () => w.cd.accountJudged({ account: [{ ord: 1, text: "It met.", cites: ["h1"], bias_statement: "S1" }],
      cited: {}, lens: "instance", flags: [{ kind: "account_check", ord: 1, text: "It met.", cites: ["h1"] }], viewer: V("alice") }),
    biasApplicationsOf: () => w.cd.biasApplicationsOf(prep, V("alice")),
    subjectNaming: () => w.cd.subjectNaming({ subject: { entity_id: "ENT-2026-0001", kind: "person", label: "P" }, bases: [], viewer: V("alice") }),
  };
  const services = Object.getOwnPropertyNames(Object.getPrototypeOf(w.cd)).filter((k) => k !== "constructor"
    && typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(w.cd), k).value === "function");
  assert.deepEqual(services.sort(), Object.keys(calls).sort(), "every service is exercised");
  for (const [name, call] of Object.entries(calls)) {
    let out;
    assert.doesNotThrow(() => { out = call(); }, name);
    assert.equal(out instanceof Promise || (out && typeof out.then === "function"), false, `${name} is synchronous`);
  }
  /* what each failed read states */
  assert.equal(calls.tensionsJudged().refusals[0].reason, "TENSIONS_UNDETERMINED");
  assert.equal(calls.acceptedWorkJudged().refusals[0].reason, "ACCEPTED_WORK_NOT_IN_FORCE");
  assert.equal(calls.flagsJudged().refusals[0].reason, "FLAGS_UNDETERMINED");
  assert.equal(calls.hunchDebt().reason, "UNCLEARED_HUNCH");
  assert.match(calls.sourcesStated()[0].stated, /^Withheld: /);
  assert.deepEqual(calls.findingFacts().grading, []);
  assert.equal(calls.disclosureBlocks().group, null);
  assert.equal(calls.materialsJudged().materials[0].included, false, "a file that cannot be read is not held");
  assert.deepEqual(calls.materialsJudged().refusals.map((r) => r.reason), ["PHOTO_MARKS_UNDETERMINED"], "a marks read that fails fails closed");
  assert.deepEqual(calls.photosOf().photos.map((p) => [p.state, p.unread, p.taken_by]), [[null, true, null]], "listed unread, never dropped");
  assert.deepEqual(calls.peopleNamed().named, []);
  assert.deepEqual(calls.peopleNamed().unresolved.map((u) => u.ref), ["EVT-2026-0001", "MNY-2026-0001", "ENT-2026-0001"], "each failed read stated, never dropped");
  assert.equal(calls.peopleJudged().refusals[0].reason, "PERSON_BASIS_NOT_STANDING", "a basis whose read fails does not stand");
  assert.deepEqual(calls.tieAttestationJudged().undetermined.map((u) => u.signer), ["alice"], "a ties read that fails is stated undetermined");
  assert.deepEqual(calls.accountJudged().refusals.map((r) => r.reason), ["ACCOUNT_CHECK_UNDETERMINED", "ACCOUNT_FLAG_UNANSWERED"],
    "a check that cannot be run fails closed; the flags are still judged");
  assert.deepEqual(calls.accountJudged().printed, [], "a lens read that fails prints nothing");
  assert.deepEqual([calls.biasApplicationsOf().refusals, calls.biasApplicationsOf().unread.map((u) => u.finding)], [[], [Q]],
    "a document that cannot be read is stated unread");
});

test("R23: it writes nothing of its own and holds no table — creating it adds no table and declares nothing to purge; every judgment leaves the store as it found it, the one write it reaches (sources' minted id) inside the caller's transaction, which rolls it back", () => {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";")) if (s.trim()) st.db.exec(s);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  const declared = [];
  const watched = new Proxy(record, { get: (o, k) => (k === "declarePurge" ? (...a) => { declared.push(a); return { ok: true }; }
                                                                             : typeof o[k] === "function" ? o[k].bind(o) : o[k]) });
  const tables = () => st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).map((r) => r.name);
  const before = tables();
  const c = caseDisclosuresOf(host, { record: watched });
  assert.deepEqual([tables(), declared], [before, []]);
  assert.equal(caseDisclosuresOf(host), c, "one instance per host");
  assert.equal(caseDisclosuresOf(host, { record: null }), c, "later deps are not read");
  assert.notEqual(caseDisclosuresOf({ storage: storage() }), c, "another host, another instance");
  /* over a real record: every judgment writes nothing; the source read's mint rolls back with the caller */
  const w = world();
  w.member("alice");
  const k = w.doc(DOC); w.knocked(k);
  w.finding(Q, [{ target: DOC, grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" }]);
  const prep = w.prepared([Q]);
  const snap = w.snapshot();
  const reached = w.cd.materialsJudged(prep, w.roles([Q]), V("alice"));
  w.cd.hunchDebt(prep); w.cd.tensionsJudged(prep, V("alice"), null); w.cd.findingFacts(reached.findings, V("alice"));
  const resting = w.cd.restingCaptures(prep);
  const facts = new Map(resting.map((r) => [r.capture, w.cd.captureFacts(r.capture)]));
  w.cd.selfAttestedJudged(resting, facts, w.roles([Q]), null);
  w.cd.acceptedWorkJudged(reached.refs, V("alice")); w.cd.flagsJudged([], null);
  w.cd.disclosureBlocks({ resting, facts, reached, author: "alice", at: T0 });
  assert.deepEqual(w.snapshot(), snap, "the judgments and the blocks write nothing");
  const ROLLBACK = Symbol("rollback");
  try { w.record.transact(() => { assert.equal(w.cd.sourcesStated([k], V("alice")).length, 1); throw ROLLBACK; }); }
  catch (e) { if (e !== ROLLBACK) throw e; }
  assert.deepEqual(w.snapshot(), snap, "the caller's rollback takes the minted source id back");
  /* negative control: outside a rolled-back transaction the read does mint, so the arm above saw a write undone */
  w.cd.sourcesStated([k], V("alice"));
  assert.notDeepEqual(w.snapshot(), snap);
});

/* ---------------------------------------------------------------- the renderers, byte for byte (K1333) */

const side = (text, src, cap = null) => ({ kind: "leg", text, source: src, date: "2026-01-02", doctype: "minutes", capture: cap });
const ROWS_T = [
  { candidate: "c".repeat(64), finding: "INQ-2026-0001-q", state: "explained_not_shown", kind: null, unseen_other_side: false,
    a: side("the page of A", "INFO-2026-0001-a", "a".repeat(64)), b: side("the page's \"other\" B\\x", "INFO-2026-0002-b"),
    explanation: "different years", depth: 1, words: "we read the later page", acknowledged_by: "alice", acknowledged_at: "2026-09-28T01:00:00Z" },
  { candidate: "d".repeat(64), finding: "INQ-2026-0002-q", state: "resolved", kind: "irreconcilable", unseen_other_side: false,
    a: side("one", "INFO-1"), b: side(null, null), explanation: null, depth: 1, words: null, acknowledged_by: "alice", acknowledged_at: "2026-09-28T01:00:00Z" },
  { candidate: "e".repeat(64), finding: "INQ-2026-0001-q", state: "open", kind: null, unseen_other_side: true,
    side: side("the seen side", "INFO-2026-0001-a"), depth: 1, words: null, acknowledged_by: "alice", acknowledged_at: "2026-09-28T01:00:00Z" },
  { candidate: "f".repeat(64), finding: "INQ-2026-0003-q", state: "taken_up", kind: null, unseen_other_side: false,
    a: side("x", "INFO-3"), b: side("y", "INFO-4"), explanation: null, depth: 1, words: "w", acknowledged_by: "bo", acknowledged_at: "t" },
];
const UNREAD = [{ finding: "INQ-2026-0001-q", legs: 2 }];
const acct = (by, sig) => ({ by, at: "2026-09-27T12:00:00Z", text: "I saved it.\nIt was there.", signature: sig });
const CAPTURES = [
  { capture: "a".repeat(64), member: "INQ-2026-0001-q", grade: "B", grade_basis: "measured", grade_why: "fetched directly",
    co_attested: true, timestamp_at: "2026-09-27T00:00:00Z", co_archive: "https://archive.example/x", late: true, self_attested_only: false,
    accounts: [acct("alice", "SIG")] },
  { capture: "a".repeat(64), member: "INQ-2026-0002-q", grade: "B", grade_basis: "measured", grade_why: null, co_attested: true,
    timestamp_at: "2026-09-27T00:00:00Z", co_archive: "https://archive.example/x", late: true, self_attested_only: false, accounts: [] },
  { capture: "b".repeat(64), member: "INQ-2026-0001-q", grade: "B", grade_basis: "measured", grade_why: null, co_attested: false,
    timestamp_at: "2026-09-27T00:00:00Z", co_archive: null, late: false, self_attested_only: true,
    acknowledgement: { reason: "the archive refuses it", acknowledged_by: "alice", at: "2026-09-28T01:00:00Z", sentence: "s" },
    accounts: [acct(null, null), acct("bo", null)] },
  { capture: "9".repeat(64), member: "INQ-2026-0003-q", grade: null, grade_basis: null, grade_why: null, co_attested: false,
    timestamp_at: null, co_archive: "https://archive.example/y", late: false, self_attested_only: false, accounts: [] },
];
const SOURCES = [{ capture: "b".repeat(64), stated: "Withheld: the source has not consented", basis: null },
  { capture: "a".repeat(64), stated: "Pat Q. Example", basis: "consent" }, { capture: "9".repeat(64), stated: "the clerk", basis: "public_elsewhere" },
  { capture: "8".repeat(64), stated: "z", basis: "other_basis" }];
const METHOD = { grading: "bio-grading/1", checks: "1.58.0" };
const att = (by_kind, by, level, at, signature, recorded_in, ref = "INFO-2026-0001-a") => ({ ref, by_kind, by, level, at, signature, recorded_in });
const MATERIALS = {
  rows: [{ ref: "INFO-2026-0001-a", kind: "document", sha: "a".repeat(64), text_sha: "t".repeat(64), origin: "https://example.org/a",
           archived_copy: "https://archive.example/x", included: true, rests_under: "load_bearing" },
         { ref: "INFO-2026-0002-b", kind: "observation", sha: "b".repeat(64), text_sha: null, origin: null, archived_copy: null,
           included: false, rests_under: "supporting" }],
  attestations: [att("member", "alice", "name", "2026-09-27T12:00:00Z", "SIG", null), att("member", null, "group", null, null, null),
                 att("member", null, null, null, null, null), att("member", "Cover bo", "cover", null, null, null),
                 att("co_attestation", "timestamp", null, "2026-09-27T00:00:00Z", null, null), att("co_attestation", "timestamp", null, null, null, null),
                 att("co_attestation", "https://archive.example/x", null, null, null, null),
                 att("project", "PROJ-x", null, null, null, "INFO-2026-0001-a"), att("group", "test-group", null, "2026-09-28T01:00:00Z", "case", null),
                 att("member", null, "project", null, null, null, "INFO-2026-0002-b")],
};
const ACCEPTED = {
  rows: [{ member: "INQ-2026-0001-q", leg_of: "INQ-2026-0001-q", ref: "imported:x/INQ-1", group: "other-group", case: "CASE-1", edition: 2,
           finding: "INQ-1", manifest_sha: "f".repeat(64), pair: { capture: "B", connection: "C" }, result: "recreated_in_part",
           gaps: "page 3", accepted_by: "alice", accepted_at: "2026-09-27T00:00:00Z", reason: "We recreated it." },
         { member: "INQ-2026-0002-q", leg_of: "INQ-2026-0009-q", ref: "imported:x/INQ-2", group: null, case: null, edition: 1,
           finding: "INQ-2", manifest_sha: null, pair: null, result: null, gaps: null, accepted_by: "bo", accepted_at: "t", reason: "r" }],
  flags: [{ ref: "imported:x/INQ-1", edition: 2, flag: "IMPFLAG-1", issue: "page 3 is misread", flagged_at: null, words: "we checked",
            acknowledged_by: "alice", acknowledged_at: "2026-09-28T01:00:00Z" },
          { ref: "imported:x/INQ-1", edition: 2, flag: "IMPFLAG-2", issue: "i", flagged_at: "t", words: null, acknowledged_by: "alice", acknowledged_at: "t" }],
};
/* Each renderer over the fixed rows, and the SHA-256 of its lines joined by newlines as case-authoring's own renderers
   (`document.mjs` at tranche/T29's opening, before the split) produced them from the same rows. */
const RENDERED = {
  "0d699014316555a1948c97c544874e942896cb58a0ad3825ee8d63f29bf23b88": ["tensionFrontmatterLines", [ROWS_T, UNREAD]],
  "147ca17cd4fca35ce473f33b01ba40847056d9a6b19feece651b7e5ba7955745": ["tensionFrontmatterLines", [[], []]],
  "7b4d64ee3bbd113a414cf7a9b7fbbe3b4a871838fcac7aaf624c8a183ce25f39": ["tensionBodyLines", [ROWS_T, UNREAD]],
  "8708f2958a9f13f2c9d49825b7b401a89b8057e9d9a85128bc72612a47a31dfa": ["tensionBodyLines", [[]]],
  "102098b89d550e0f3cb834d0454b871580a4322e828e4a0eabe131e17e38375a": ["captureBodyLines", [CAPTURES, SOURCES]],
  "9ea60ae78ed33be26f86625e3e92f016054fd666703bd1561cd47fc82d17a088": ["captureBodyLines", [[], []]],
  /* re-pinned by DEC-149 (T34-87): the supporting-material sentence names no copy */
  "f933b18ccb8a667748916216e9ddf568d6c992685df268ff5fc77261fd29ac04": ["carriesBodyLines", [METHOD, MATERIALS, "test-group"]],
  "90eb0ce32c1afc3fa9af5d11f4c768f7ff59c62daac0562ff4516428000324cb": ["carriesBodyLines", [null, { rows: [] }, null]],
  /* re-pinned by N535: the first row's reason ends in its own full stop, which is no longer doubled */
  "954d62fb382e1b37cda8ec7896eb2d4594132bfb5a8e52f8b3c82101b7e69521": ["acceptedBodyLines", [ACCEPTED]],
  "0a17b93cc94882a110542f3de61d3794d53878537c5add0859df11d087d2f1bb": ["acceptedBodyLines", [{ rows: ACCEPTED.rows, flags: [] }]],
};
/* N535: the bytes case-authoring's renderer produced before the split, for the two sections that changed. */
/* DEC-149: the bytes carriesBodyLines produced before T34-87, from the same rows. */
const CARRIES_BEFORE_DEC149 = "54051f5fdfe26a6d6017163cb0115033e67c6076a0d9855e96a0c18bbf8b4d6f";
const ACCEPTED_BEFORE_N535 = [["cae5b4d209f44d2e979873dce8237130259883c311b6a38203b077c813fe43a7", ACCEPTED],
  ["006cf3ad0fa6efdccbe67c65678a49d6641fd089009691826d541ae9c016a47b", { rows: ACCEPTED.rows, flags: [] }]];

test("R1, R3, R5, R7, R13, R14 (K1333): the renderers moved byte for byte — each section rendered from fixed rows hashes to what case-authoring's renderers produced from them before the split, and so does each member's tension sentence (negative control: one changed byte in a row changes the hash)", () => {
  for (const [want, [fn, args]] of Object.entries(RENDERED)) assert.equal(hash(CD[fn](...args)), want, fn);
  assert.equal(hash(ROWS_T.map(CD.tensionSentence)), "c198751f9028cc43d48d95bbaf15d69c3b4f153733dd90d9343a2d8c49be71c9");
  const changed = [{ ...ROWS_T[0], words: "we read the later page." }, ...ROWS_T.slice(1)];
  assert.notEqual(hash(CD.tensionBodyLines(changed, UNREAD)), "7b4d64ee3bbd113a414cf7a9b7fbbe3b4a871838fcac7aaf624c8a183ce25f39");
});

test("R13 (N535): acceptedBodyLines changed in one place only — with the doubled full stop after a reason that ends in its own put back, each section is byte for byte what case-authoring's renderer produced before the split", () => {
  for (const [before, accepted] of ACCEPTED_BEFORE_N535) {
    const lines = CD.acceptedBodyLines(accepted);
    const one = lines.filter((l) => l.includes("because: We recreated it. It was"));
    assert.equal(one.length, 1, "the changed sentence, once");
    assert.equal(hash(lines.map((l) => l.replace("because: We recreated it. It was", "because: We recreated it.. It was"))), before);
    assert.notEqual(hash(lines), before, "negative control: the new bytes differ");
  }
});

/* ---------------------------------------------------------------- DEC-149 (T34-87) */

const DEC149_OLD = /\b(this|the) (instance|copy|plane)\b/i;

test("R6, R22 (DEC-149, T34-87): each member-facing string that named the group's Civicsmith \"this copy\" says \"your group's Civicsmith\" or needs no name — C-120.8's translation, RELIED_ON_NOT_PRESENTABLE's detail, and the case document's supporting-material sentence; and none of this module's member-facing text says \"this instance\", \"this copy\", \"this plane\" or \"the plane\" (negative control: the old wording matches)", () => {
  /* C-120.8's translation (checks.mjs) */
  assert.equal(CASE_DISCLOSURE_CHECKS.RELIED_ON_NOT_PRESENTABLE.translation, word("refusal.RELIED_ON_NOT_PRESENTABLE"));
  assert.equal(DEC149_OLD.exec(CASE_DISCLOSURE_CHECKS.RELIED_ON_NOT_PRESENTABLE.translation), null);
  /* RELIED_ON_NOT_PRESENTABLE's detail, raised (index.mjs) */
  const m = world(); m.member("alice"); m.doc(DOC, {}, { indexed: false }); m.finding(Q, [{ target: DOC }]);
  const r = m.cd.materialsJudged(m.prepared([Q]), m.roles([Q]), V("alice")).refusals[0];
  assert.equal(DEC149_OLD.exec(r.detail), null);
  assert.ok(r.detail.includes(r.not_presentable[0].materials[0].sha), "the material is named");
  /* the case document's sentence (document.mjs, carriesBodyLines) */
  const body = CD.carriesBodyLines(METHOD, MATERIALS, "test-group");
  assert.ok(body.includes(word("case-disclosures.document_observation_case")));
  /* the whole member-facing surface: rows, fixed sentences, refusals raised, every renderer's lines */
  const said = [JSON.stringify(Object.values(CASE_DISCLOSURE_CHECKS).map((x) => x.translation)), JSON.stringify(r),
                CD.SELF_ATTESTED_SENTENCE, CD.HIGHLIGHT_SENTENCE, CD.NOT_SHOWN_WORDS, CD.TENSIONS_DEPTH_STATED,
                JSON.stringify(CD.TENSION_TEMPLATES), CD.FLAG_SENTENCE, CD.FLAGS_SAY,
                ...Object.values(RENDERED).map(([fn, args]) => CD[fn](...args).join("\n")), ...ROWS_T.map(CD.tensionSentence)]
    /* a capture's copy is a document's copy, not the group's Civicsmith (DEC-149's exclusion; document.mjs's
       SELF_ATTESTED_SENTENCE), and so are an archived copy and a presentable one */
    .join("\n").replace(/archived copy|presentable copy|the copy has not changed since capture/g, "");
  assert.equal(DEC149_OLD.exec(said), null);
  assert.match("material this copy does not hold whole", DEC149_OLD, "negative control");
});

test("R7 (DEC-149): carriesBodyLines changed in one sentence only — with \"that this copy does not hold whole\" put back, the section is byte for byte what it was before T34-87", () => {
  const lines = CD.carriesBodyLines(METHOD, MATERIALS, "test-group");
  const now = word("case-disclosures.document_observation_case");
  assert.equal(lines.filter((l) => l === now).length, 1, "the changed sentence, once");
  assert.equal(hash(lines.map((l) => (l === now ? l.replace("is not held whole", "this copy does not hold whole") : l))), CARRIES_BEFORE_DEC149);
  assert.notEqual(hash(lines), CARRIES_BEFORE_DEC149, "negative control: the new bytes differ");
});
