/* publication — T53: the format in force is case-grammar's `/10` (its R35, PR 202), so R58 refuses only a format earlier
   than `/6`; a `/10` edition's commit freezes, from its signed bytes, the passages published without a grade (R80) and
   the typed passages with their typist and checkers at the credit each chose (R82), and `caseEditionState` answers both
   as frozen (R81, R82). The blocks are written with case-grammar's own line builders and read back with its readers
   (its R36, R37), so nothing here hand-builds another module's answer. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, caseDoc, SIG, NOW } from "./fixture.mjs";
import { CASE_SOURCES_CHECKS } from "../../../src/publication/checks.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001";
const SET_TIME = "2026-09-30T08:00:00.000Z";

function base() {
  const w = world();
  for (const m of ["olive", "bo", "cy"]) w.member(m);
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const roles = [{ target: F, version_sha: w.head(F) }];
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));
  return { w, proj, roles, roster };
}
const passageCols = (w, c = CASE, e = 1) => w.row(
  `SELECT ungraded_passages, ungraded_state, typed_passages, typed_state FROM published_cases WHERE case_id=? AND edition=?`, c, e);
/* publish-schedule R8's registration, played (as t41 plays it): the edition was signed at SET_TIME and its publisher is
   committing it now (publishDue), so it no longer waits and its signing instant is answered. */
const waitingAt = (c, e, at) => ({ isWaiting: () => false, signedAtOf: (cc, ee) => (cc === c && ee === e ? at : null),
                                    signerOf: () => null });

const TWO_UNGRADED = [{ finding: F, ord: 1, content_id: "CNT-a" }, { finding: F, ord: 2, content_id: "CNT-b" }];

/* ---------------------------------------------------------------- R58 */

test("R58 (T53) commitCaseEdition refuses only a format earlier than /6: /8, /9 and /10 (case-grammar R35) sign; /5 is still CASE_FORMAT_SUPERSEDED, nothing committed", () => {
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  for (const format of ["bio-case-document/10", "bio-case-document/9", "bio-case-document/8"]) {
    const { w, proj, roles, roster } = base();
    w.prepare(CASE, 1, { project: proj, roles, format });
    const r = w.signCase(CASE, 1, { project: proj, roster });
    assert.deepEqual([r.ok, r.reason], [true, undefined], `${format} signs: ${JSON.stringify(r.reason)}`);
  }
  const { w, proj, roles, roster } = base();
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/5" });
  const before = w.snapshot();
  const r = w.signCase(CASE, 1, { project: proj, roster });
  assert.deepEqual([r.ok, r.reason, r.check], [false, "CASE_FORMAT_SUPERSEDED", CASE_SOURCES_CHECKS.CASE_FORMAT_SUPERSEDED.check]);
  assert.deepEqual(w.snapshot(), before, "nothing committed");
});

/* ---------------------------------------------------------------- R80 */

test("R80 a /10 edition published at a set time records the two ungraded passages its signed bytes state, read from the bytes and not the record; a retry leaves them unchanged", () => {
  const { w, proj, roles, roster } = base();
  w.p.registerWaitingEditions("publish-schedule", waitingAt(CASE, 1, SET_TIME));
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10", ungraded: TWO_UNGRADED });
  const r = w.signCase(CASE, 1, { project: proj, roster, sig: SIG(1) });
  assert.equal(r.ok, true, JSON.stringify(r.reason));
  assert.equal(w.row(`SELECT signed_at FROM published_cases WHERE case_id=?`, CASE).signed_at, SET_TIME, "published at a set time");
  const cols = passageCols(w);
  assert.equal(cols.ungraded_state, "stated");
  assert.deepEqual(JSON.parse(cols.ungraded_passages), TWO_UNGRADED, "the two rows as signed");
  /* a typed statement the document does not carry is stated as none */
  assert.deepEqual([cols.typed_state, JSON.parse(cols.typed_passages)], ["stated", []]);
  /* the retry of the same signature answers existed and rewrites nothing */
  const again = w.signCase(CASE, 1, { project: proj, roster, sig: SIG(1) });
  assert.deepEqual([again.ok, again.existed], [true, true]);
  assert.deepEqual(passageCols(w), cols);
});

test("R80 controls: a /9 edition holds null with predates; a /10 one stating none holds []; a /10 one whose block is not a list holds null with unreadable", () => {
  {
    const { w, proj, roles, roster } = base();
    w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/9", ungraded: TWO_UNGRADED });
    assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
    assert.deepEqual(passageCols(w), { ungraded_passages: null, ungraded_state: "predates", typed_passages: null,
                                       typed_state: "predates" }, "a /9 document's block is never read");
  }
  {
    const { w, proj, roles, roster } = base();
    w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10" });
    assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
    const c = passageCols(w);
    assert.deepEqual([c.ungraded_state, c.ungraded_passages], ["stated", "[]"]);
  }
  {
    const { w, proj, roles, roster } = base();
    w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10" });
    const doc = w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, CASE, 1);
    const text = doc.text.replace("\n---\n\n## Scope", "\nungraded_passages: 5\n---\n\n## Scope");
    assert.notEqual(text, doc.text);
    w.p.storeCaseDocument({ case: CASE, edition: 1, text, author: "member:olive" });
    assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
    const c = passageCols(w);
    assert.deepEqual([c.ungraded_state, c.ungraded_passages], ["unreadable", null]);
  }
});

/* ---------------------------------------------------------------- R81 */

test("R81 caseEditionState answers ungraded_passages as the edition holds them: the /10 edition's two rows, detail null; a /9 edition predates, rows null, case-grammar's sentence; a pre-T53 /6 edition reads predates", () => {
  const { w, proj, roles, roster } = base();
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10", ungraded: TWO_UNGRADED });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
  assert.deepEqual(w.p.caseEditionState(CASE, 1).ungraded_passages, { state: "stated", rows: TWO_UNGRADED, detail: null });
  w.prepare("CASE-2026-0002", 1, { project: proj, roles, format: "bio-case-document/9" });
  assert.equal(w.signCase("CASE-2026-0002", 1, { project: proj, roster }).ok, true);
  assert.deepEqual(w.p.caseEditionState("CASE-2026-0002", 1).ungraded_passages,
                   { state: "predates", rows: null, detail: CG.UNGRADED_PREDATE_SENTENCE });
  assert.deepEqual(w.p.caseEditionState("CASE-2026-0002", 1).typed_passages,
                   { state: "predates", rows: null, detail: CG.TYPED_PREDATE_SENTENCE });
  /* an edition committed before T53 holds no state; its signed /6 bytes predate the statement */
  w.prepare("CASE-2026-0003", 1, { project: proj, roles });
  w.signLegacy("CASE-2026-0003", 1, { project: proj, roster, sig: SIG(3) });
  assert.equal(passageCols(w, "CASE-2026-0003", 1).ungraded_state, null);
  assert.deepEqual(w.p.caseEditionState("CASE-2026-0003", 1).ungraded_passages,
                   { state: "predates", rows: null, detail: CG.UNGRADED_PREDATE_SENTENCE });
});

test("R81 R82 both statements are null until the edition is ratified (its document signed), as timeline; control: the signed edition answers both", () => {
  const { w, proj, roles, roster } = base();
  w.p.sql.exec(`INSERT INTO published_cases (case_id,edition,opened,criteria) VALUES (?,1,?,'[]')`, "CASE-2026-0009", NOW);
  const u = w.p.caseEditionState("CASE-2026-0009", 1);
  assert.deepEqual([u.ungraded_passages, u.typed_passages], [null, null]);
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10" });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
  const s = w.p.caseEditionState(CASE, 1);
  assert.deepEqual([s.ungraded_passages.state, s.typed_passages.state], ["stated", "stated"]);
});

/* ---------------------------------------------------------------- R82 */

test("R82 a frozen edition names the typist and checkers as of the freeze, at the credit each chose: a later check and a changed credit reach only the next edition; no member id, handle or key is held", () => {
  const { w, proj, roles, roster } = base();
  /* A typed it (credit group), B checked it (credit name). The writer is handed member ids; it writes none (case-grammar R37). */
  const atSigning = [{ finding: F, ord: 1, content_id: "CNT-a", typed_at: "2026-09-20T00:00:00Z", typist_level: "group",
                       typist_shown: "Ann Example", member: "member:ann", key: "KEY-ann",
                       checkers: [{ level: "name", shown: "Bo Example", at: "2026-09-21T00:00:00Z", member: "member:bo" }] }];
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/10", typed: atSigning });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster, sig: SIG(1) }).ok, true);
  const frozen = [{ finding: F, ord: 1, content_id: "CNT-a", checked: true, typed_at: "2026-09-20T00:00:00Z",
                    typist_level: "group", typist_shown: null,
                    checkers: [{ level: "name", shown: "Bo Example", at: "2026-09-21T00:00:00Z" }] }];
  assert.deepEqual(w.p.caseEditionState(CASE, 1).typed_passages, { state: "stated", rows: frozen, detail: null });
  const cols = passageCols(w);
  for (const leak of ["member:", "ann", "KEY-", "Ann Example"])
    assert.ok(!String(cols.typed_passages).includes(leak), `no ${leak} held`);
  /* after signing: C checks it and A changes to `name`; edition 2 states that, edition 1 still reads B only, A at group */
  const later = [{ ...atSigning[0], typist_level: "name",
                   checkers: [...atSigning[0].checkers, { level: "cover", shown: "Cee", at: "2026-10-02T00:00:00Z" }] }];
  w.prepare(CASE, 2, { project: proj, roles, format: "bio-case-document/10", typed: later });
  assert.equal(w.signCase(CASE, 2, { project: proj, roster, sig: SIG(2) }).ok, true);
  assert.deepEqual(w.p.caseEditionState(CASE, 1).typed_passages.rows, frozen, "edition 1 answers as signed");
  const second = w.p.caseEditionState(CASE, 2).typed_passages.rows[0];
  assert.deepEqual([second.typist_level, second.typist_shown, second.checkers.map((c) => c.shown)],
                   ["name", "Ann Example", ["Bo Example", "Cee"]]);
});

test("R82 control: a /9 edition reads typed_passages predates, rows null, case-grammar's sentence", () => {
  const { w, proj, roles, roster } = base();
  w.prepare(CASE, 1, { project: proj, roles, format: "bio-case-document/9" });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster, at: NOW }).ok, true);
  assert.deepEqual(w.p.caseEditionState(CASE, 1).typed_passages,
                   { state: "predates", rows: null, detail: CG.TYPED_PREDATE_SENTENCE });
});
