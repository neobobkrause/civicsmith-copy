/* Notice case-authoring:456 (its R88, R89, R90; T53; DEC-461): an ungraded passage never refuses preparing or the
   pre-flight (R90), the pre-flight's sign step lists them without changing `ready` or `first` (R88), and the stored
   preparation states exactly them with one fixed sentence (R89). case-check's R1 runs the pre-flight and holds the
   preparation publishCase stores, so through checkAndHold, over the real providers (case-authoring's fixture): a case
   resting on ungraded passages is checked and held (never refused for them), the held check pins the stored bytes that
   state them, and R2 reads it `held`. A grade given after the check moves the finding (R2's `member_moved`); checking
   again makes a new check whose preparation states only the passage still ungraded. Confirmed: no code change. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../case-authoring/fixture.mjs";
import { caseCheckOf } from "../../../src/case-check/index.mjs";
import { ungradedPassagesOf } from "../../../src/case-grammar/index.mjs";
import { UNGRADED_BODY_KEY } from "../../../src/case-disclosures/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const D1 = "INFO-2026-0001-a", D2 = "INFO-2026-0002-b", Q = "INQ-2026-0001-q";
const GRADED = { grade: "B", grade_axis: "capture", grade_source: "capture" };
/* the fixture's member holds no signing key, so ratification's gate reads ready (K552 (5), as real.test.mjs does) */
const ready = (real) => new Proxy(real, { get: (t, p) => (p === "caseRatifyPreflight"
  ? () => ({ ok: true, ready: true, refusals: [] }) : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
const AUTH = { author: "alice", scope: "s", statement: "It does not cover the amendments.", subjectPosition: "not_sought",
               subjectJustification: "A public record.", biasAcknowledgement: "We read the minutes as the account.",
               excluded: [], tieAttested: true };

function setup(graded) {
  const w = world({ ratification: ready });
  w.member("alice");
  w.doc(D1); w.doc(D2);
  const legs = (g) => [D1, D2].map((d) => ({ target: d, ...(g.includes(d) ? GRADED : {}) }));
  w.finding(Q, legs(graded));
  const P = w.project("Team", "alice", [Q]);
  const c = caseCheckOf(w.host, { record: w.record, caseAuthoring: w.ca, publication: w.publication,
                                  caseCarriage: w.disclosures.caseCarriage ?? undefined, now: () => w.clock.now });
  const args = { ...AUTH, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, viewer: V("alice") };
  return { w, c, args, regrade: (g) => w.finding(Q, legs(g)) };
}
const stored = (w, r) => w.row(`SELECT doc_sha, text FROM case_documents WHERE case_id=? AND edition=?`, r.case, r.edition);
const listed = (w, text) => ungradedPassagesOf(w.fm(text)).rows.map((p) => [p.finding, p.ord]);

test("notice case-authoring:456 (R1, R2): a case resting on two ungraded load-bearing passages is checked and held, its pinned preparation states exactly them and the one sentence; a grade after the check voids it member_moved, and checking again holds a new check stating only the one still ungraded", () => {
  const x = setup([]);
  const pre = x.w.ca.publishPreflight(x.args);
  assert.equal(pre.ready, true, JSON.stringify(pre.first).slice(0, 300));
  const r = x.c.checkAndHold(x.args);
  assert.deepEqual([r.ok, r.held], [true, true], JSON.stringify(r).slice(0, 400));
  const doc = stored(x.w, r);
  assert.equal(r.doc_sha, doc.doc_sha, "the check pins the stored preparation");
  assert.deepEqual(listed(x.w, doc.text), [[Q, 0], [Q, 1]], "both ungraded passages are stated");
  assert.equal(doc.text.split(word(UNGRADED_BODY_KEY)).length - 1, 1, "the sentence once");
  assert.equal(x.c.caseCheckOf({ check: r.check }).state, "held");
  /* a grade given after the check moves the finding: the held check is void */
  x.regrade([D1]);
  const st = x.c.caseCheckOf({ check: r.check });
  assert.equal(st.state, "void");
  assert.ok(st.why.includes("member_moved"), JSON.stringify(st.why));
  /* checking again makes a new check over a preparation stating only D2's passage */
  const again = x.c.checkAndHold(x.args);
  assert.deepEqual([again.ok, again.held, again.existed ?? false], [true, true, false], JSON.stringify(again).slice(0, 400));
  assert.notEqual(again.check, r.check);
  assert.deepEqual(listed(x.w, stored(x.w, again).text), [[Q, 1]]);
});

test("notice case-authoring:456 (control): the same case fully graded is checked and held with no ungraded rows and no sentence", () => {
  const x = setup([D1, D2]);
  const r = x.c.checkAndHold(x.args);
  assert.deepEqual([r.ok, r.held], [true, true], JSON.stringify(r).slice(0, 400));
  const doc = stored(x.w, r);
  assert.deepEqual(listed(x.w, doc.text), []);
  assert.ok(!doc.text.includes(word(UNGRADED_BODY_KEY)), "no sentence");
  assert.equal(x.c.caseCheckOf({ check: r.check }).state, "held");
});
