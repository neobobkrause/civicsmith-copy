/* control-plane R135 (fix round 9, G135f, G126; K4831 (5); store-assembly R74, R65): `OP=READING` AND `OWEDWORK` ANSWER FROM THE ONE JOB ROW, THROUGH THE REAL PLANE. The plane
   (`rows-plane.mjs`) under Miniflare, the plane's own ledger and alarm: the founder uploads a PDF over the inline ceiling and files it in a project, so its reading is owed to the job table.
   While the row is queued, and again once the alarm has finished it, `op=reading`'s `job` and `owedwork`'s row for the digest state the same thing (state, counters, cursor,
   last progress, priority): the finished row is still listed by `owedwork`. A member who cannot see the digest reads both as absent (DEC-36). The rows' own fields are
   `store-assembly`'s; this file proves the door answers them. Counts and fields, never a wall time (R-CLOCK). */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { rowsPlane, MB, body, sha as digestOf, pdfOf } from "./rows-plane.mjs";

const textOf = (v) => JSON.stringify(v ?? null).slice(0, 600);
const tag = `r135r${Date.now().toString(36)}`;
const k = rowsPlane({ tag });
after(() => { try { k.mf.dispose(); } catch { /* gone */ } });

const readingOf = async (auth, sha) => body(await k.get(auth, { op: "reading", sha256: sha }));
const rowsOf = async (auth, sha) => (body(await k.get(auth, { op: "owedwork", sha })) || {}).owed || [];
/* what `op=reading`'s `job` states, read off an `owedwork` row the same way */
const sameAs = (job, row) => {
  assert.equal(job.state, row.job_state, "the state");
  for (const c of ["written", "skipped", "owed", "failed"]) assert.equal(job[c], row[c], c);
  assert.deepEqual(job.failed_why, row.failed_why, "failed_why");
  assert.equal(job.last_progress_at, row.last_progress_at, "last_progress_at");
  assert.equal(job.priority, row.priority, "priority");
  if (row.cursor === null) assert.equal(job.cursor, null, "no cursor");
};

let filed = null;
async function fileOne() {
  if (filed) return filed;
  const ann = await k.founder();
  const project = await k.projectOf(ann, `R135 rows ${tag}`);
  const bytes = pdfOf(`The owed reading of the planning minutes ${tag}`, 3 * MB);
  const sha = digestOf(bytes);
  const up = await k.upload(ann, bytes, "minutes.pdf", "application/pdf");
  assert.equal(up.ok, true, textOf(up));
  const made = await CAPTURE_SCREEN.parts.promoteDocument(k.screenCall(ann), { doc: up.document, title: "minutes.pdf", locator: up.document.locator, project });
  assert.equal(made.refused, undefined, textOf(made));
  return (filed = { ann, sha, project });
}

test("R135 (store-assembly R74): while the reading is owed, `op=reading`'s `job` and `owedwork`'s one `reading` row state the same thing; once the alarm finishes it, `owedwork` still lists the row, `finished`, and `op=reading` states that row", { timeout: 600000 }, async () => {
  const { ann, sha } = await fileOne();
  const first = await rowsOf(ann, sha);
  const row0 = first.find((r) => r.kind === "reading");
  assert.ok(row0, "the owed reading's row is listed: " + textOf(first));
  const r0 = await readingOf(ann, sha);
  if (r0.found === true) sameAs(r0.job, (await rowsOf(ann, sha)).find((r) => r.kind === "reading"));
  /* the alarm reads it: the row ends `finished` and is still listed, and the reading states it */
  const ended = await k.until(async () => {
    const row = (await rowsOf(ann, sha)).find((r) => r.kind === "reading");
    return row && row.job_state === "finished" ? row : null;
  }, 300000, 3000);
  assert.ok(ended, "the finished row is listed by `owedwork`: " + textOf(await rowsOf(ann, sha)));
  assert.equal(ended.next_try, null, "a finished row has no next try");
  const r1 = await readingOf(ann, sha);
  assert.equal(r1.found, true, textOf(r1));
  assert.ok(Array.isArray(r1.text_units) && r1.text_units.length > 0, "the stored reading is answered beside the state");
  sameAs(r1.job, ended);
  assert.equal(r1.job.state, "finished");
});

test("R135 (DEC-36): a digest no document holds is absent to a member: `owedwork` answers `owed: []` and `last: []` and `op=reading` states no job; the founder sees its row", { timeout: 600000 }, async () => {
  await fileOne();
  const bea = await k.member("r135-bea");
  /* she uploads a file over the inline ceiling and never files it: its reading is owed (a row stands) but no document of the record holds it */
  const bytes = pdfOf(`The unfiled letter ${tag}`, 3 * MB);
  const sha = digestOf(bytes);
  const up = await k.upload(bea, bytes, "letter.pdf", "application/pdf");
  assert.equal(up.ok, true, textOf(up));
  assert.ok((await rowsOf(await k.founder(), sha)).some((x) => x.kind === "reading"), "control: the founder sees the digest's row");
  const w = body(await k.get(bea, { op: "owedwork", sha })) || {};
  assert.deepEqual([w.owed, w.last], [[], []], "absent to her: " + textOf(w));
  const r = await readingOf(bea, sha);
  assert.notEqual(r && r.found, true, "no reading is hers to see: " + textOf(r));
  assert.ok(!r || !r.job || r.job.state === null, "and no row's state is shown: " + textOf(r && r.job));
});
