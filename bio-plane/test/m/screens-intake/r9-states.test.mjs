/* screens-intake fix round 9 (SCREENS-INTAKE #23): R63 (G135c; SCAN E9: what became of an upload's reading, never "Text: None: no page has text" for a failed or owed
 * one), R64 (G135d; SHEET C05, X05: a refusal names its own cause and its figures) and R65 (G135f: the states of a read drawn from the job row, as `op=reading`
 * answers it). Every test enters by pressing the act over the real served page; a sentence is asserted by its key (R26) and a figure by the size word it is drawn in.
 *
 * The sentences these requirements add are the design's rows, owed to `later-ux.md` (K4269): until they reach the table the nearest held rows stand in, and a test
 * asserts the stand-in's key (`screen.document.text.unread.next`, `shell.unread`, `screen.document.reading.progress`, ...) and the figures, not a new English
 * sentence. R-SEAM: `op=reading`'s job-row answer (control-plane R135, job 38) and plane's `jobrow` (R107, job 37) are unmerged; the answer is the shape
 * R135 states (`state`, `written`, `skipped`, `owed`, `failed`, `rate_per_s`, `verdict`), made by the test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, text, fill, press, idle, ok, refused, says, word, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

/* Over the REAL store (fix round 10, K5054): the member is signed in by the real acts, the file is stored by the owner's own `captureupload` and filed by the page's own
 * `allocid` and `promote`. What the world cannot make is the door's FOLLOW-ON READING of an upload (store-request door.mjs: "no reading followed after a promotion or an
 * upload") and the job row `op=reading` answers (control-plane registers it): so an upload's `reading` (and `reading_pending`) and the job row are the test's script, laid over the
 * owner's own answer for the very bytes (the file is really stored first, so the page's promotion is the record's own). */
const MB = 1048576;
const mb = (n) => word("size.mb", { n: (n / MB).toFixed(1) });
const FILE = (name = "scan.pdf", type = "application/pdf", content = "x") => new File([content], name, { type });
const filled = (file) => ({ "ci-file": file, "ci-how-made": true, "ci-where": "City hall", "ci-what": "The packet." });
/* the owner's own answer to the upload of this file, made by the door as the page's press would make it */
async function stored(t, file) {
  const door = t.world.boot(t.mai).door;
  const r = await door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: "The packet.", name: file.name, ...(file.type ? { type: file.type } : {}) })}`,
    init: { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: new Uint8Array(await file.arrayBuffer()) } });
  if (!r.json || !r.json.result || r.json.result.ok !== true) throw new Error(`the owner refused the upload: ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json.result;
}
const open = async (plane = {}) => { const t = await members({ mai: ["contribute"] }); const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai, plane, screens: [...SCREENS, DOCUMENT_STUB] }); return { t, p }; };
/* `more` is what the door adds to the owner's answer (the reading it followed with); `doc` fields laid on its document */
const upload = (more = {}, doc = {}) => ({ more, doc });
const drawn = async (shape, file = FILE(), plane = {}) => {
  const t = await members({ mai: ["contribute"] });
  /* no shape: the owner's own answer, unchanged (the page's press stores the file) */
  const scripted = shape ? { captureupload: await (async () => { const real = await stored(t, file); return ok({ ...real, ...shape.more, document: { ...real.document, ...shape.doc } }); })() } : {};
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai, plane: { ...scripted, ...plane }, screens: [...SCREENS, DOCUMENT_STUB] });
  fill(p, filled(file));
  await press(p, "captureupload");
  p.world = t;
  return p;
};
const none = (p) => says(p, "screen.document.text.none");
const marks = (p, k) => main(p).querySelectorAll(`[data-reading="${k}"]`).length;

/* ---- R63 ---- */

test("R63 (SCAN E9) a project-less upload whose reading failed says it could not be read, never 'Text: None: no page has text'", async () => {
  const p = await drawn(upload({ reading: { content_type: null, found: false, failure: "final", basis: "x" } }));
  assert.ok(!none(p), "red before: the failed reading was drawn as 'Text: None: no page has text'");
  assert.equal(marks(p, "failed"), 1);
  assert.ok(text(p).includes("x"), "the reading's own account of why it holds no text");
  const bare = await drawn(upload({ reading: { found: false, failure: "final" } }));
  assert.equal(marks(bare, "failed"), 1);
  assert.ok(says(bare, "shell.unread"), "a failed reading that states no account says it could not be read");
  assert.ok(!none(bare));
});

test("R63 (SCAN E9) an owed scan (pages the OCR has not reached) says its reading follows, never 'no page has text'", async () => {
  const p = await drawn(upload({ reading: { found: true, tier3_candidate: true, ocr_left: { cursor: 24, pages: 6 }, failure: "transient" } }));
  assert.ok(!none(p), "red before: an owed reading was drawn as 'Text: None'");
  assert.equal(marks(p, "pending"), 1);
  assert.ok(says(p, "screen.document.text.unread.next"));
});

test("R63 a reading refused with its limit says that, with its figures, and a reading that holds words says it was read", async () => {
  const refused = await drawn(upload({ reading: { failure: "final", reason: "TOO_LARGE", size: 18069786, bound: 16 * MB } }));
  assert.ok(!none(refused));
  assert.equal(marks(refused, "refused"), 1);
  const read = await drawn(upload({ reading: { found: true, words_read: 3, words_total: 3 }, text_units: [{ extent: "x", text: "a b c" }] }));
  assert.equal(marks(read, "read"), 1);
  assert.ok(says(read, "screen.document.text.read", { read: "3", total: "3" }));
  assert.ok(!none(read));
});

test("R63 `readingOf` marks read only for a reading that holds text, not for any reading object", () => {
  const { readingOf } = CAPTURE_SCREEN.parts;
  assert.equal(readingOf({}, {}).present, false);
  assert.equal(readingOf({ reading: { failure: "final" } }, {}).read, false, "a failed reading is not read");
  assert.equal(readingOf({ reading: { tier3_candidate: true } }, {}).read, false, "an owed one is not read");
  assert.equal(readingOf({ reading: { found: true }, text_units: [{ text: "   " }] }, {}).read, false, "units with no words are not text");
  assert.equal(readingOf({ reading: { found: true }, text_units: [{ text: "words" }] }, {}).read, true);
});

test("R63 control: a picture with no reading keeps R2's unread line; the picture flag is the record's, not the browser's declared type alone", async () => {
  const a = await drawn(null, FILE("photo.jpg", "image/jpeg"));
  assert.ok(says(a, "capture.picture.unread"), "control: a picture declared by the browser");
  /* a browser that declares nothing: the profile (the record's format) and the file's name say it is a picture */
  const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
  const b = await drawn(null, FILE("photo", "", PNG));
  assert.ok(says(b, "capture.picture.unread"), "the record's profile says a picture");
  const c = await drawn(null, FILE("page-3.TIFF", ""));
  assert.ok(says(c, "capture.picture.unread"), "the file's name says a picture");
  const d = await drawn(null, FILE("notes.txt", "text/plain", "alpha beta gamma\n"));
  assert.ok(!says(d, "capture.picture.unread") && says(d, "screen.document.text.unread"), "control: a text file that is not a picture says unread");
});

/* ---- R64 ---- */

test("R64 (SHEET C05, X05) a size refusal draws the file's size and the limit, each in MB, and never 'multipart'", async () => {
  for (const [size, bound] of [[18069786, 16 * MB], [33 * MB, 32 * MB]]) {
    const p = await drawn(upload({ reading: { failure: "final", reason: "TOO_LARGE", size, bound } }));
    const t = text(p);
    assert.ok(t.includes(mb(size)), `the size ${mb(size)}`);
    assert.ok(t.includes(mb(bound)), `the limit ${mb(bound)}`);
    assert.ok(!/multipart/i.test(t));
    assert.ok(!none(p));
  }
});

test("R64 each refusal is its own sentence with its own figures: STRUCTURE_OVER_BOUND, UNSUPPORTED_FORMAT, ENCODING_UNSUPPORTED, ENCRYPTED, TOO_LARGE", async () => {
  const cases = [{ reason: "TOO_LARGE", size: 40 * MB, bound: 32 * MB }, { reason: "STRUCTURE_OVER_BOUND", part: "xl/worksheets/sheet1.xml", bound: 250000 },
                 { reason: "UNSUPPORTED_FORMAT", kind: "rtf" }, { reason: "ENCODING_UNSUPPORTED", name: "shift_jis" }, { reason: "ENCRYPTED" }];
  const seen = new Set();
  for (const c of cases) {
    const p = await drawn(upload({ reading: { failure: "final", ...c } }));
    const line = main(p).querySelector('[data-reading="refused"]');
    assert.ok(line, c.reason);
    seen.add(line.textContent);
    for (const k of ["part", "name"]) if (c[k]) assert.ok(line.textContent.includes(c[k]), `${c.reason} names its ${k}`);
    /* R36 (fix round 10): the kind is named by the sentence the reading's owner holds for it, not beside the stand-in as a raw span */
    if (c.kind) assert.ok(line.textContent.includes(word(`reading-pipeline.index.unsupported_${c.kind}`)), "UNSUPPORTED_FORMAT: the owner's sentence for the kind");
    if (c.reason === "STRUCTURE_OVER_BOUND") assert.ok(line.textContent.includes(String(c.bound)), "the bound is the count");
  }
  assert.equal(seen.size, cases.length, "five causes, five sentences");
  /* control: a cause with no sentence of its own is the nearest 'could not be read', not another cause's figures */
  // fixtures-generic: SOMETHING_ELSE
  const p = await drawn(upload({ reading: { failure: "final", reason: "SOMETHING_ELSE" } }));
  assert.equal(marks(p, "refused"), 1);
  assert.ok(says(p, "shell.unread"));
  assert.ok(!/MB/.test(main(p).querySelector('[data-reading="refused"]').textContent));
});

test("R64 the door's 413 for an upload carries its figure and is drawn with it; a refusal with no figures keeps its sentence", async () => {
  /* the owner's 413 for a file over its bound (a 300 MB file is not one the test makes): the refusal, with its figures, is the scripted answer */
  const { p: withFigures } = await open({ captureupload: refused("TOO_LARGE", undefined, 413, { size: 300 * MB, bound: 256 * MB }) });
  fill(withFigures, filled(FILE()));
  const r = await press(withFigures, "captureupload");
  assert.ok(r.slot().textContent.includes(mb(300 * MB)) && r.slot().textContent.includes(mb(256 * MB)), "size and limit in the sentence beside the act");
  const { p: bare } = await open({ captureupload: refused("TOO_LARGE", undefined, 413) });
  fill(bare, filled(FILE()));
  const q = await press(bare, "captureupload");
  assert.ok(q.slot().textContent.includes(word("screen.capture.refusal.upload.TOO_LARGE")), "control: no figures, the old sentence");
  assert.ok(!/MB/.test(q.slot().textContent.replace(word("screen.capture.refusal.upload.TOO_LARGE"), "")));
});

/* ---- R65 ---- */

/* `op=reading` answers the stored reading beside `job`, the job row's state (control-plane R135, `job-state.mjs`: `state`, the counters, `failed_why`, the cursor, `verdict`); a
   test names the row's fields and the stored reading's flat, and they are put where the owner puts them */
const JOB_FIELDS = ["state", "written", "skipped", "owed", "failed", "failed_why", "cursor", "last_progress_at", "priority", "verdict", "rate_per_s"];
/* the job row of the capture whose digest the owner holds (known once the file is stored): a row is made for it when asked */
const row = (more) => (sha) => ok({ ok: true, found: true, capture_sha: sha,
  ...Object.fromEntries(Object.entries(more).filter(([k]) => !JOB_FIELDS.includes(k))),
  job: Object.fromEntries(Object.entries(more).filter(([k]) => JOB_FIELDS.includes(k))) });
const stateOf = (cur) => () => (typeof cur.answer === "function" ? cur.answer(cur.sha) : cur.answer);
async function pending(cur, more = {}) {
  const t = await members({ mai: ["contribute"] });
  const file = FILE();
  const real = await stored(t, file);
  cur.sha = real.capture.sha256;
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai, screens: [...SCREENS, DOCUMENT_STUB],
    plane: { captureupload: ok({ ...real, reading_pending: true, ...more }), reading: stateOf(cur) } });
  fill(p, filled(file));
  await press(p, "captureupload");
  await p.clock.tick(1);
  await idle(p);
  return p;
}
const jobMark = (p) => { const e = main(p).querySelector("[data-job-state]"); return e ? e.getAttribute("data-job-state") : null; };

test("R65 each state of a read is drawn from the job row: queued, being fetched, being read N of M, read in part, refused with its limit, finished", async () => {
  const cur = { answer: row({ state: "queued", written: 0, skipped: 0, owed: 30, failed: 0 }) };
  const p = await pending(cur);
  assert.equal(p.byOp("reading").length, 1, "the row is asked for the capture's digest at once");
  assert.equal(p.byOp("reading")[0].query.sha256, cur.sha);
  assert.equal(jobMark(p), "queued");
  /* the queued state by its own row (R78, DEC-454), now in the word table, not the stand-in */
  assert.ok(says(p, "screen.capture.read.queued") && !says(p, "screen.capture.reading.pending"));
  const step = async (answer) => { cur.answer = answer; await p.clock.tick(20000); await idle(p); };
  await step(row({ state: "fetching", written: 0, owed: 0, skipped: 0, failed: 0 }));
  assert.equal(jobMark(p), "fetching");
  await step(row({ state: "reading", written: 12, skipped: 0, owed: 18, failed: 0 }));
  assert.equal(jobMark(p), "reading");
  assert.ok(says(p, "screen.document.reading.progress", { read: "12", total: "30" }), "N of M from the row's counts");
  await step(row({ state: "partial", written: 24, skipped: 6, owed: 0, failed: 0 }));
  assert.equal(jobMark(p), "partial");
  assert.ok(says(p, "screen.document.reading.partial"), "searched only so far");
  const refused = await pending({ answer: row({ state: "refused", written: 0, owed: 0, skipped: 0, failed: 0, verdict: { ok: false, size: 30 * MB, limit: 24 * MB, bound_key: "pdf.bytes" } }) });
  assert.equal(jobMark(refused), "refused");
  assert.ok(text(refused).includes(mb(30 * MB)) && text(refused).includes(mb(24 * MB)), "the size and the limit");
  const done = await pending({ answer: row({ state: "finished", written: 30, owed: 0, skipped: 0, failed: 0, reading: { found: true, words_read: 90, words_total: 90 }, text_units: [{ extent: "p1", text: "words here" }] }) });
  assert.equal(jobMark(done), "finished");
  assert.ok(says(done, "screen.document.text.read", { read: "90", total: "90" }), "finished: the stored reading");
});

test("R65 the row is asked again while it is queued, fetched or read, every twenty seconds at first, and not again once it has finished", async () => {
  const cur = { answer: row({ state: "reading", written: 3, owed: 27, skipped: 0, failed: 0 }) };
  const p = await pending(cur);
  const n0 = p.byOp("reading").length;
  await p.clock.tick(19000); await idle(p);
  assert.equal(p.byOp("reading").length, n0, "not sooner than twenty seconds (a request every few seconds starves the object's alarm)");
  await p.clock.tick(1000); await idle(p);
  assert.equal(p.byOp("reading").length, n0 + 1);
  cur.answer = row({ state: "finished", written: 30, owed: 0, skipped: 0, failed: 0 });
  await p.clock.tick(20000); await idle(p);
  const n1 = p.byOp("reading").length;
  await p.clock.tick(120000); await idle(p);
  assert.equal(p.byOp("reading").length, n1, "a finished row is not asked again");
});

test("R65 an 'about' estimate only once the row holds enough units to measure a rate, none before", () => {
  const { estimateOf, jobStateOf } = CAPTURE_SCREEN.parts;
  const job = (w, rate, owed = 300) => jobStateOf({ job: { state: "reading", written: w, owed, skipped: 0, failed: 0, rate_per_s: rate } });
  assert.equal(estimateOf(job(3, 2)), null, "three units: no rate to measure");
  assert.equal(estimateOf(job(12, 0)), null, "no rate stated");
  assert.equal(estimateOf(job(12, 0.5, 0)), null, "nothing owed");
  assert.equal(estimateOf(job(12, 0.5, 300)), 10, "300 units at half a unit a second: ten minutes");
  assert.equal(estimateOf(null), null);
});

test("R65 control: a digest with no row (or one the viewer may not see) draws no state, and the stored reading's line is as before", async () => {
  const cur = { answer: row({ state: null }) };
  const p = await pending(cur);
  assert.equal(jobMark(p), null);
  assert.ok(says(p, "screen.document.text.unread.next"), "the static line, as before");
  const absent = await pending({ answer: ok({ ok: true, found: false }) });
  assert.equal(jobMark(absent), null);
  assert.ok(says(absent, "screen.document.text.unread.next"));
  /* a read that failed keeps the line too, and the screen asks again later */
  const failed = await pending({ answer: { status: 500, json: { ok: false } } });
  assert.equal(jobMark(failed), null);
  assert.ok(says(failed, "screen.document.text.unread.next"));
});
