/* plane R1 (the Store hands the composition's job table to its readers), the provider's run of notice-producers R29's seam (fix round 10; K5198): the rows `READING_ROWS` of
   `notice-producers/reading-ended-seam.test.mjs` are stated as data, exactly as the real job table answers them, and this test runs the contract against the REAL table: the
   `Store` constructed over a database (the plane's fixture), four readings registered with the member (or none) and the bound a refusal names, ended by the object's own alarm
   with the reader's published answers, and `readingsEnded` read whole and by its cursor. Each shape the seam relies on is checked on what the table answers: refused, finished,
   final, final with no opener, and the paged form `<ended_at>\u0001<sha>\u0001<kind>`. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store } from "./fixture.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { bucketStandIn } from "../case-carriage/fixture.mjs";
import { readHeldAnswer } from "../extraction/fixtures.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const KEYS = ["sha", "kind", "state", "why", "written", "skipped", "owed", "failed", "ended_at", "member"];

async function ended() {
  const x = await store({ env: { CAPTURES: bucketStandIn() } });
  /* the reader's answers are extraction's published fixture (`readHeldAnswer`, made by its real `readHeld`): a read to its end, and a read in pieces the reader
     refuses to go on with (`final`, its reason is the published `why`). Both final rows, the one a member opened and the one none did, take the published final answer. */
  const answers = { finished: await readHeldAnswer.read(), final: await readHeldAnswer.final(), unopened: await readHeldAnswer.final("NO_PROGRESS") };
  const answerFinal = answers.final, answerUnopened = answers.unopened;
  // fixtures-own: harness a router of the reader's asks by digest, answering extraction's published answers (`readHeldAnswer`): which digest is read to its end, which is refused the cursor and which makes no progress is the test's own registration, the answers are the owner's
  extractionOf(x.ctx).readHeld = async (a) => (a.sha === sha("finished") ? answers.finished : a.sha === sha("unopened") ? answers.unopened : answers.final);
  const jobs = pendingOf(x.ctx);
  jobs.registerJob({ kind: "reading", sha: sha("refused"), member: "member:m1", verdict: { ok: false, bound_key: "pdf.bytes" } });
  jobs.registerJob({ kind: "reading", sha: sha("finished"), member: "member:m1" });
  jobs.registerJob({ kind: "reading", sha: sha("final"), member: "member:m2" });
  jobs.registerJob({ kind: "reading", sha: sha("unopened") });
  for (let i = 0, at = Date.now() + 1000; i < 4; i++, at += 1000) await x.s.onAlarm(at);
  return { x, jobs, answerFinal, answerUnopened };
}

// fixtures-run: notice-producers reading-ended
test("R1 (notice-producers R29, the reading-ended seam): the real job table answers the ended rows in the contract's shapes: refused, finished, final, final with no opener", async () => {
  const { jobs, answerFinal, answerUnopened } = await ended();
  const all = jobs.readingsEnded({});
  assert.equal(all.ok, true);
  assert.equal(all.next, null, "a page that is not full has no cursor");
  assert.equal(all.rows.length, 4);
  for (const r of all.rows) {
    assert.deepEqual(Object.keys(r).sort(), [...KEYS].sort(), "the contract's key set, nothing more");
    assert.equal(r.kind, "reading");
    assert.ok(Number.isFinite(r.ended_at), "ended_at is epoch milliseconds");
    for (const k of ["written", "skipped", "owed", "failed"]) assert.ok(Number.isInteger(r[k]) && r[k] >= 0, k);
  }
  const by = (name) => { const r = all.rows.find((x) => x.sha === sha(name)); assert.ok(r, `a row for ${name}`); return r; };
  assert.deepEqual([by("refused").state, by("refused").why, by("refused").member], ["refused", "pdf.bytes", "member:m1"], "a refusal's why is its bound key");
  assert.deepEqual([by("finished").state, by("finished").why, by("finished").member], ["finished", null, "member:m1"]);
  assert.deepEqual([by("final").state, by("final").why, by("final").member], ["final", answerFinal.why, "member:m2"], "a final row's why is the reader's reason");
  assert.deepEqual([by("unopened").state, by("unopened").why, by("unopened").member], ["final", answerUnopened.why, null], "a row no member opened names no one");
  assert.deepEqual(all.rows.map((r) => r.ended_at), [...all.rows.map((r) => r.ended_at)].sort((a, b) => a - b), "in the table's order: by when it ended");
});

test("R1 (notice-producers R29, the reading-ended seam): the cursor is `<ended_at>\\u0001<sha>\\u0001<kind>` of the last row of a full page, and the next page begins after it; a read", async () => {
  const { jobs } = await ended();
  const whole = jobs.readingsEnded({}).rows;
  const before = JSON.stringify(whole);
  const p1 = jobs.readingsEnded({ limit: 2 });
  const last = p1.rows[1];
  assert.equal(p1.rows.length, 2);
  assert.equal(p1.next, `${last.ended_at}\u0001${last.sha}\u0001${last.kind}`);
  const p2 = jobs.readingsEnded({ after: p1.next, limit: 2 });
  assert.deepEqual([...p1.rows, ...p2.rows], whole, "the pages joined are the whole, none twice");
  assert.equal(p2.next, whole.length === 4 ? `${whole[3].ended_at}\u0001${whole[3].sha}\u0001${whole[3].kind}` : null, "a full last page still offers its cursor; the page after it is empty");
  assert.deepEqual(jobs.readingsEnded({ after: p2.next, limit: 2 }), { ok: true, rows: [], next: null });
  assert.equal(JSON.stringify(jobs.readingsEnded({}).rows), before, "reading writes nothing");
});
