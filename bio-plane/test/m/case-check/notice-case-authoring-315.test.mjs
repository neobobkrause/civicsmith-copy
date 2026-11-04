/* Notice case-authoring:315 (its F2; case-grammar R36, R37): publishCase now writes a `/10` document's
   `ungraded_passages:` and `typed_passages:` blocks, reading `CaseAuthoring.content`. case-check's R1 records the check
   over the preparation publishCase stores and answers that preparation as `caseDocument`, so through checkAndHold, over
   the real providers (case-authoring's fixture), the held check pins the stored bytes that carry the blocks, names them
   in its `caseDocument`, and the real ratification gate (op=caseratify's pre-flight) finds no C-41.18 or C-41.19 in them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../case-authoring/fixture.mjs";
import { caseCheckOf } from "../../../src/case-check/index.mjs";
import { ungradedPassagesOf, typedPassagesOf, passagesOf } from "../../../src/case-grammar/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
/* checkAndHold's pre-flight asks ratification's gate as signing would, and the fixture's member holds no signing key, so
   the act runs over a gate that reads ready (K552 (5), as real.test.mjs does); the gate is then run real over the bytes. */
const ready = (real) => new Proxy(real, { get: (t, p) => (p === "caseRatifyPreflight"
  ? () => ({ ok: true, ready: true, refusals: [] }) : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
const AUTH = { author: "alice", scope: "s", statement: "It does not cover the amendments.", subjectPosition: "not_sought",
               subjectJustification: "A public record.", biasAcknowledgement: "We read the minutes as the account.",
               excluded: [], tieAttested: true };

test("notice case-authoring:315 (R1): the check held through checkAndHold pins and answers the /10 preparation that states its ungraded and typed passages, and the real ratification gate finds no C-41.18 or C-41.19 in it", () => {
  const w = world({ ratification: ready });
  w.member("alice");
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const c = caseCheckOf(w.host, { record: w.record, caseAuthoring: w.ca, publication: w.publication,
                                  caseCarriage: w.disclosures.caseCarriage ?? undefined, now: () => w.clock.now });
  const r = c.checkAndHold({ ...AUTH, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, viewer: V("alice") });
  assert.deepEqual([r.ok, r.held], [true, true], JSON.stringify(r).slice(0, 400));
  const stored = w.row(`SELECT doc_sha, text FROM case_documents WHERE case_id=? AND edition=?`, r.case, r.edition);
  assert.equal(r.doc_sha, stored.doc_sha, "the check pins the stored preparation");
  assert.deepEqual([r.caseDocument?.case_id, r.caseDocument?.edition, r.caseDocument?.doc_sha, r.caseDocument?.bytes],
                   [r.case, r.edition, stored.doc_sha, Buffer.byteLength(stored.text)],
                   "the answered document is publishCase's own, naming the stored bytes (case-authoring R15)");
  const fm = w.fm(stored.text);
  const passages = Object.values(passagesOf(fm) || {}).flat();
  assert.ok(passages.length >= 1, "the member relies on a passage");
  const u = ungradedPassagesOf(fm);
  assert.equal(u.state, "stated");
  assert.deepEqual(u.rows.map((x) => x.content_id).sort(), passages.map((p) => p.content_id).sort(),
                   "the passage no one graded is listed");
  assert.equal(typedPassagesOf(fm).state, "stated", "the typed block is stated (no member typed this passage)");
  const g = w.ratification.caseRatifyPreflight({ text: stored.text, signer: "alice", viewer: "member:alice" });
  const checks = (g.refusals || []).flatMap((x) => [x.check, ...((x.findings || x.body?.findings || []).map((f) => f.check))]);
  assert.ok(!checks.includes("C-41.18") && !checks.includes("C-41.19"), `the gate's checks: ${JSON.stringify(checks)}`);
  assert.equal(c.caseCheckOf({ check: r.check }).state, "held");
  /* control: the same bytes with the ungraded block taken out are refused C-41.18 by the same gate */
  const lines = stored.text.split("\n"), at = lines.findIndex((l) => l.startsWith("ungraded_passages:"));
  assert.ok(at >= 0);
  let end = at + 1; while (end < lines.length && /^\s/.test(lines[end])) end++;
  const stripped = [...lines.slice(0, at), ...lines.slice(end)].join("\n");
  const g2 = w.ratification.caseRatifyPreflight({ text: stripped, signer: "alice", viewer: "member:alice" });
  assert.ok((g2.refusals || []).flatMap((x) => [x.check, ...((x.findings || x.body?.findings || []).map((f) => f.check))])
    .includes("C-41.18"));
});
