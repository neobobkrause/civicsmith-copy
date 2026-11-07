// Copied from control-plane's suite (test/m/control-plane/r135-job-state.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R135 (fix round 9, G135f, G126; K4831 (5); plane R97, R80): `OP=READING` AND `OWEDWORK` ANSWER FROM THE JOB ROW. `jobStateOf(rows)` (`job-state.mjs`) is the reading's job state
   for one digest, from the rows plane lists for it: `state` (`queued`, `fetching`, `reading`, `partial`, `refused`, `finished`, `final`), the counters (`written`, `skipped`, `owed`, `failed`)
   with `failed_why`, the cursor as a position `{at, of}`, `last_progress_at`, `priority`, and the refusal's `verdict` when the state is `refused`; with no row `state: null`, the stored
   reading alone; the `reading` row is preferred to the `ocr` row. Pure, tested on rows; then at the door with a fake store, where a viewer who cannot see the digest reads it as absent
   (DEC-36) and a digest with a reading and no row answers `state: null` (the control). The live row's view (`plane/pending.mjs` `view`) is plane's.

   Red against the tree before round 9's change (`op=reading` answered the stored reading and no `job`; nothing read the job row): every `job` assertion. The null-state control is green
   either way. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jobStateOf, positionOf } from "../../../src/control-plane/job-state.mjs";
import { world, call, opCalls } from "../control-plane/harness.mjs";

const SHA = "c".repeat(64);
const row = (o = {}) => ({ sha: SHA, kind: "reading", state: "owed", job_state: "queued", attempts: 0, written: 0, skipped: 0, owed: 0, failed: 0, failed_why: {}, priority: null, ...o });
const COUNTERS = ["written", "skipped", "owed", "failed"];

/* ---- each state, with its counters ---- */

test("R135: each state of the job row is answered for a row of that state, with its counters: queued, fetching, reading, partial, refused (with its verdict), finished and final", () => {
  const states = ["queued", "fetching", "reading", "partial", "refused", "finished", "final"];
  for (const [i, state] of states.entries()) {
    const counters = { written: 10 + i, skipped: i, owed: 20 + i, failed: 3 + i };
    const j = jobStateOf([row({ job_state: state, ...counters, failed_why: { PAGE_KILLED_READER: 1, transient: 2 } })]);
    assert.equal(j.state, state);
    assert.equal(j.kind, "reading");
    assert.deepEqual(COUNTERS.map((k) => j[k]), COUNTERS.map((k) => counters[k]), `${state}: the counters of the row`);
    assert.deepEqual(j.failed_why, { PAGE_KILLED_READER: 1, transient: 2 }, `${state}: failed_why by cause`);
  }
});

test("R135: a refused row answers its verdict (`size`, `limit`, `bound_key`) and no other state does, a refused row with no verdict none", () => {
  // fixtures-own: input a row field fed through jobStateOf (this module's own function); its `reason` is a sentinel the test asserts is dropped
  const verdict = { ok: false, size: 30000000, limit: 25165824, bound_key: "limit.pdf.bytes", reason: "never carried" };
  const refused = jobStateOf([row({ job_state: "refused", verdict })]);
  assert.equal(refused.state, "refused");
  assert.deepEqual(refused.verdict, { size: 30000000, limit: 25165824, bound_key: "limit.pdf.bytes" }, "the three figures and nothing else of the verdict");
  assert.ok(!("verdict" in jobStateOf([row({ job_state: "reading", verdict })])), "a row being read states no verdict");
  assert.ok(!("verdict" in jobStateOf([row({ job_state: "finished", verdict })])));
  assert.ok(!("verdict" in jobStateOf([row({ job_state: "refused" })])), "a refusal with no verdict stated");
  assert.deepEqual(jobStateOf([row({ job_state: "refused", verdict: { ok: false } })]).verdict, { size: null, limit: null, bound_key: null }, "a verdict short of a figure says null, not a guess");
});

test("R135: the counters are whole non-negative numbers: anything else reads 0, and a row with none reads 0 for each", () => {
  const j = jobStateOf([row({ written: -1, skipped: 1.5, owed: "7", failed: NaN })]);
  assert.deepEqual(COUNTERS.map((k) => j[k]), [0, 0, 0, 0]);
  const bare = jobStateOf([{ kind: "reading", job_state: "reading" }]);
  assert.deepEqual([bare.state, ...COUNTERS.map((k) => bare[k]), bare.failed_why, bare.cursor, bare.last_progress_at, bare.priority], ["reading", 0, 0, 0, 0, {}, null, null, null]);
  assert.deepEqual(jobStateOf([row({ failed_why: [1, 2] })]).failed_why, {}, "a failed_why that is no object is none");
});

/* ---- the cursor as a position, the instant, the priority ---- */

test("R135: the cursor is answered as a position `{at, of}` where the row states the total, `{at}` where it does not, and null with none", () => {
  const at = (cursor, extra = {}) => jobStateOf([row({ job_state: "reading", cursor, ...extra })]).cursor;
  assert.deepEqual(at({ page: 24, pages: 130 }), { at: 24, of: 130 }, "a PDF's page of its pages");
  assert.deepEqual(at({ pages_done: 7, total: 40 }), { at: 7, of: 40 });
  assert.deepEqual(at({ at: 3, of: 9 }), { at: 3, of: 9 });
  assert.deepEqual(at({ next: 2097152, size: 24000000 }), { at: 2097152, of: 24000000 }, "a text's offset of its size");
  assert.deepEqual(at({ offset: 5 }), { at: 5 }, "no total stated");
  assert.deepEqual(at({ page: 0, pages: 0 }), { at: 0 }, "a total of 0 is none");
  assert.deepEqual(at({ page: 4 }, { detail: { cursor: { page: 99, pages: 100 } } }), { at: 4 }, "the row's cursor first");
  assert.deepEqual(at(undefined, { detail: { cursor: { page: 5, pages: 6 } } }), { at: 5, of: 6 }, "else the cursor in its detail");
  assert.equal(at(null), null);
  assert.equal(at("p12"), null, "a cursor that is no object is no position");
  assert.equal(at({ label: "x" }), null);
  assert.equal(at({ page: -1, pages: 3 }), null);
  assert.deepEqual(positionOf({ cursor: { page: 1, pages: 2 } }), { at: 1, of: 2 });
  assert.equal(positionOf(null), null);
});

test("R135: `last_progress_at` is the row's instant or null, and `priority` is `raised` ('Read it') or null", () => {
  assert.equal(jobStateOf([row({ last_progress_at: 1792845527045 })]).last_progress_at, 1792845527045);
  for (const v of [undefined, null, "yesterday", NaN]) assert.equal(jobStateOf([row({ last_progress_at: v })]).last_progress_at, null, String(v));
  assert.equal(jobStateOf([row({ priority: "raised" })]).priority, "raised");
  for (const v of [undefined, null, "high", "RAISED", 1]) assert.equal(jobStateOf([row({ priority: v })]).priority, null, String(v));
});

/* ---- no row, and which row speaks ---- */

test("R135 (control): with no row the state is null and nothing else, whatever the argument is", () => {
  for (const rows of [[], null, undefined, "x", {}, [null], [7], [row({ kind: "keep" })], [row({ kind: "unpack" })], [row({ kind: "subresources" }), row({ kind: "fetch" })]])
    assert.deepEqual(jobStateOf(rows), { state: null }, JSON.stringify(rows));
});

test("R135: the `reading` row is preferred over the `ocr` row whichever is listed first, the `ocr` row speaks when it is the only one, and other kinds are never read", () => {
  const reading = row({ kind: "reading", job_state: "reading", written: 5 }), ocr = row({ kind: "ocr", job_state: "partial", written: 9 });
  for (const rows of [[reading, ocr], [ocr, reading], [row({ kind: "keep", job_state: "queued" }), ocr, reading]]) {
    const j = jobStateOf(rows);
    assert.deepEqual([j.kind, j.state, j.written], ["reading", "reading", 5]);
  }
  const only = jobStateOf([row({ kind: "unpack" }), ocr]);
  assert.deepEqual([only.kind, only.state, only.written], ["ocr", "partial", 9]);
});

test("R135: a row that states no `job_state` is read from its older `state` (`owed` is queued, `final` is final), and a row of neither is queued", () => {
  assert.equal(jobStateOf([{ kind: "reading", state: "owed" }]).state, "queued");
  assert.equal(jobStateOf([{ kind: "reading", state: "final" }]).state, "final");
  assert.equal(jobStateOf([{ kind: "reading", state: "reading" }]).state, "reading");
  assert.equal(jobStateOf([{ kind: "reading" }]).state, "queued");
});

/* ---- at the door ---- */

const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);
const readingAnswer = (found) => ({ ok: true, found, capture_sha: SHA, reading: found ? { found: true, completeness: "partial" } : null });

test("R135: `op=reading` of a digest the viewer sees answers the stored reading beside `job`, from the job row the plane lists, asking the owner of the reading nothing of its state", async () => {
  const rows = [row({ kind: "reading", job_state: "partial", written: 40, owed: 60, failed: 2, failed_why: { transient: 2 }, cursor: { page: 40, pages: 100 }, last_progress_at: 1792845527045, priority: "raised" })];
  const w = world({ answer: (c) => (c.route === "reading" ? ok(readingAnswer(true)) : c.route === "jobrow" ? ok({ ok: true, row: c.params.kind === "reading" ? rows[0] : null }) : null) });
  const r = await call(w.env, { op: "reading", token: w.S.ann, params: { sha256: SHA } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.found, true, "the stored reading is answered as it was");
  assert.deepEqual(r.json.result.job, { state: "partial", kind: "reading", written: 40, skipped: 0, owed: 60, failed: 2, failed_why: { transient: 2 }, cursor: { at: 40, of: 100 },
    last_progress_at: 1792845527045, priority: "raised" });
  const asks = asked(w.env, "jobrow");
  assert.deepEqual(asks.map((a) => a.params.kind), ["reading", "ocr"], "the row of each reading kind is asked once");
  assert.ok(asks.every((a) => a.params.sha === SHA));
  assert.deepEqual(asked(w.env, "readheldfor"), [], "and the owner of the reading is not asked to read or to say its state");
});

test("R135 (control): a digest with a reading and no row answers `state: null` and the reading as before; a digest with no reading asks the rows nothing", async () => {
  const none = world({ answer: (c) => (c.route === "reading" ? ok(readingAnswer(true)) : c.route === "jobrow" ? ok({ ok: true, row: null }) : null) });
  const r = await call(none.env, { op: "reading", token: none.S.ann, params: { sha256: SHA } });
  assert.deepEqual(r.json.result.job, { state: null });
  assert.equal(r.json.result.reading.found, true);
  const absent = world({ answer: (c) => (c.route === "reading" ? ok(readingAnswer(false)) : c.route === "jobrow" ? ok({ ok: true, row: row() }) : null) });
  const a = await call(absent.env, { op: "reading", token: absent.S.ann, params: { sha256: SHA } });
  assert.deepEqual(a.json.result.job, { state: null }, "a digest the viewer sees no reading of shows no job");
  assert.equal(asked(absent.env, "jobrow").length, 0, "the rows are not even asked");
  /* a silent plane never turns a reading into a failure: the state is status, not a gate */
  const silent = world({ answer: (c) => (c.route === "reading" ? ok(readingAnswer(true)) : c.route === "jobrow" ? new Response("x", { status: 500 }) : null) });
  const s = await call(silent.env, { op: "reading", token: silent.S.ann, params: { sha256: SHA } });
  assert.equal(s.status, 200);
  assert.deepEqual(s.json.result.job, { state: null });
  assert.equal(s.json.result.found, true);
});

test("R135: `owedwork` shows a digest's rows to a viewer who can see the digest (a document that holds it, or a reading of it) and answers `owed: []` and `last: []` to one who cannot: absent, DEC-36; the founder sees them", async () => {
  const rows = [row({ kind: "reading", job_state: "reading" })];
  const handler = (held, read) => (c) => (c.route === "owedwork" ? ok({ ok: true, sha: SHA, owed: rows, last: [{ kind: "reading", outcome: "retried" }] })
    : c.route === "heldat" ? ok({ ok: true, held }) : c.route === "reading" ? ok(readingAnswer(read)) : null);
  const sees = world({ answer: handler(true, false) });
  const a = await call(sees.env, { op: "owedwork", token: sees.S.ann, params: { sha: SHA } });
  assert.equal(a.json.result.owed.length, 1, "she sees the row of a digest filed where she may see it");
  const reads = world({ answer: handler(false, true) });
  assert.equal((await call(reads.env, { op: "owedwork", token: reads.S.ann, params: { sha: SHA } })).json.result.owed.length, 1, "or one whose reading she may see");
  const blind = world({ answer: handler(false, false) });
  const b = await call(blind.env, { op: "owedwork", token: blind.S.ann, params: { sha: SHA } });
  assert.deepEqual([b.json.result.owed, b.json.result.last], [[], []], "a digest she cannot see is absent, with no sign that a row exists");
  const founder = world({ answer: handler(false, false) });
  const f = await call(founder.env, { op: "owedwork", token: founder.S.founder, params: { sha: SHA } });
  assert.equal(f.json.result.owed.length, 1, "the administrator sees the rows");
});

/* ---- finished and refused rows, through plane's `jobrow` (R107) ---- */

test("R135 (plane R107): a finished row and a refused row are answered whole by `jobrow` and the door states them: the cursor, the last progress and the refusal's verdict; control: an absent row is `state: null`", async () => {
  const verdict = { ok: false, size: 30000000, limit: 25165824, bound_key: "limit.pdf.bytes" };
  const rowsBy = { finished: row({ job_state: "finished", state: "finished", written: 130, cursor: { page: 130, pages: 130 }, last_progress_at: 1792845527045 }),
                   refused: row({ job_state: "refused", state: "refused", verdict }), none: null };
  for (const [name, expected] of Object.entries({
    finished: { state: "finished", cursor: { at: 130, of: 130 }, last_progress_at: 1792845527045 },
    refused: { state: "refused", verdict: { size: 30000000, limit: 25165824, bound_key: "limit.pdf.bytes" } },
    none: { state: null } })) {
    const w = world({ answer: (c) => (c.route === "reading" ? ok(readingAnswer(true)) : c.route === "jobrow" ? ok({ ok: true, row: c.params.kind === "reading" ? rowsBy[name] : null }) : null) });
    const r = await call(w.env, { op: "reading", token: w.S.ann, params: { sha256: SHA } });
    assert.equal(r.status, 200, r.text);
    for (const [k, v] of Object.entries(expected)) assert.deepEqual(r.json.result.job[k], v, `${name}: ${k}`);
  }
});
