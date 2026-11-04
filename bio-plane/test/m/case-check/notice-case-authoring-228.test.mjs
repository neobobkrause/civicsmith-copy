/* Notice case-authoring:228 (its R91, changing R10): the refusal for a statement, subject justification, exclusion
   list or bias acknowledgement unchanged from the previous ratified edition names which one in `field`. case-check's R1
   says every refusal is publishCase's or the pre-flight's, unchanged, so checkAndHold must answer that refusal with its
   field, and write nothing. Over the real providers, as real.test.mjs builds them (case-authoring's fixture). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, WHAT_CHANGED } from "../case-authoring/fixture.mjs";
import { caseCheckOf } from "../../../src/case-check/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r";
const ready = (real) => new Proxy(real, { get: (t, p) => (p === "caseRatifyPreflight"
  ? () => ({ ok: true, ready: true, refusals: [] }) : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
const AUTH = { author: "alice", scope: "s", statement: "It does not cover the amendments.", subjectPosition: "not_sought",
               subjectJustification: "A public record.", biasAcknowledgement: "We read the minutes as the account.",
               excluded: [{ description: "the side letter", reason: "not in hand" }], tieAttested: true };
const FRESH = { statement: "Edition two does not cover the appeal.", subjectJustification: "Still a public record, as of now.",
                biasAcknowledgement: "This edition still reads the minutes as the account, and says so again.",
                excluded: [{ description: "the side letter, now requested", reason: "not in hand" }] };

function setup() {
  const w = world({ ratification: ready });
  w.member("alice");
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q, [{ target: DOC }]);
  w.finding(Q2, [{ target: DOC2 }]);
  const P = w.project("Team", "alice", [Q, Q2]);
  const c = caseCheckOf(w.host, { record: w.record, caseAuthoring: w.ca, publication: w.publication,
                                  caseCarriage: w.disclosures.caseCarriage ?? undefined, now: () => w.clock.now });
  const a = { ...AUTH, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, viewer: V("alice") };
  const first = c.checkAndHold(a);
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 400));
  w.ratify({ caseId: first.case, edition: first.edition });
  /* edition two of the same case, over a new member (a finding is a member of one case only) */
  return { w, c, a: { ...a, caseId: first.case, targets: [Q2], roles: { [Q2]: "load_bearing" },
                     whatChanged: WHAT_CHANGED }, first };
}

test("notice case-authoring:228 (R1, case-authoring R91): checkAndHold answers the carried-forward refusal with its field, as publishCase gives it, and writes nothing; with every field fresh, edition two is checked and held (control)", () => {
  const { w, c, a, first } = setup();
  const cases = [
    [{ statement: AUTH.statement }, "COMPLETENESS_CARRIED_FORWARD", "statement"],
    [{ subjectJustification: AUTH.subjectJustification }, "COMPLETENESS_CARRIED_FORWARD", "subject_justification"],
    [{ excluded: AUTH.excluded }, "COMPLETENESS_CARRIED_FORWARD", "excluded"],
    [{ biasAcknowledgement: AUTH.biasAcknowledgement }, "BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", "bias_acknowledgement"],
  ];
  const before = w.snapshot();
  for (const [over, reason, field] of cases) {
    const act = { ...a, ...FRESH, ...over };
    const own = w.ca.publishPreflight(act);
    const r = c.checkAndHold(act);
    assert.deepEqual([r.ok, r.held, r.reason, r.field, r.check, r.prior], [false, false, reason, field, "C-21.1", 1],
                     JSON.stringify(r).slice(0, 300));
    assert.equal(r.first?.field, field, "the pre-flight's first refusal, carried whole");
    assert.deepEqual([r.reason, r.field], [own.first?.reason, own.first?.field], "the provider's own answer, unchanged");
    assert.deepEqual(w.snapshot(), before, `${field}: nothing written`);
  }
  const ok = c.checkAndHold({ ...a, ...FRESH });
  assert.deepEqual([ok.ok, ok.held, ok.case, ok.edition], [true, true, first.case, 2], JSON.stringify(ok).slice(0, 300));
  assert.equal(c.caseCheckOf({ check: ok.check }).state, "held");
});
