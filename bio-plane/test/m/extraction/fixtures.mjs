/* extraction's published fixtures (K4990, K4993, K4995, K5044; fix round 10, the fixture round): the answers extraction gives its users, made by extraction's
   own code when a test runs and never stored. A user's test takes the answer from here and does not write it by hand. Each is called by a test of
   extraction's own, `fixtures.test.mjs`, which checks the real answer. Each runs this module's real code over `fresh()` (its real record-core and membership
   over a real SQLite database) with a scripted evidence bucket, and the real reader (reading-pipeline's) where a read is made. */
import { fresh, bundle, bucket, doc, sha, member, ocrAnswer, homesOver, hold, i2, noText, pageUnits, pressThenPass } from "./fixture.mjs";

const lines = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/** A text of `n` lines (about 99 bytes each) ending in a mark, so a read of it goes on in pieces of 4,096 units. */
const textOf = (n) => lines(n, (i) => `line ${String(i).padStart(6, "0")} ${"council-minutes ".repeat(5)}`.padEnd(99, ".")).concat(["ENDMARKER"]).join("\n");

/* A store holding the bytes in its bucket, the register naming the bundle `INFO-1` the capture's home (the register is provenance's real instance over its
   own fixture), the bundle's provenance document naming the capture. `ct`, `format` and `fromText` are the capture's profile. */
async function held(bytes, { ct = "text/plain", format = "undetermined", fromText = true, reader = null, env = {}, whole = true } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, env, reader, provenance: homesOver(rows) });
  bundle(w.s, "INFO-1");
  const u8 = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const d = sha(u8);
  rows.set(d, { bundleId: "INFO-1", path: "f", encoding: "binary", bytes: u8.length });
  const document = doc({ digest: d, bytes: u8.length, ct, format, fromText });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  if (whole) await evidence.put(`bio/captures/${d}`, u8);
  return { w, d, rows, evidence, document };
}

/** `extractionNotice`: a real extraction's reading notice and index notice, as its R24 and R62 state them. `onReading(module, fn)` and `onIndexed(module, fn)`
 *  are the real registrations (one listener a module; a second by the same module is `LISTENER_DECLARED`, a malformed one `LISTENER_MALFORMED`); each
 *  registration that was accepted is kept in `listeners` / `indexListeners`, and `fire(e)` / `fireIndexed(e)` run those in registration order, answering each
 *  `{module, answer}`. `readingOf`, `unitsOf` and `capturesReadFor` are the real reads over the instance's (empty) store; `extraction` is the instance. */
export function extractionNotice() {
  const w = fresh();
  const listeners = [], indexListeners = [];
  const taking = (list, register) => (module, fn) => {
    const answer = register(module, fn);
    if (answer && answer.ok === true) list.push({ module, fn });
    return answer;
  };
  return {
    extraction: w.x, world: w, listeners, indexListeners,
    onReading: taking(listeners, (module, fn) => w.x.onReading(module, fn)),
    onIndexed: taking(indexListeners, (module, fn) => w.x.onIndexed(module, fn)),
    fire: (e) => listeners.map((l) => ({ module: l.module, answer: l.fn(e) })),
    fireIndexed: (e) => indexListeners.map((l) => ({ module: l.module, answer: l.fn(e) })),
    readingOf: (s) => w.x.readingOf(s), unitsOf: (s, o) => w.x.unitsOf(s, o), capturesReadFor: (b) => w.x.capturesReadFor(b),
  };
}

/** `progressOf`: the real `progressOf(shas)` (R108) over a store holding three captures read by the real reader: `scan` (a 30-page scan, 24 of its pages read
 *  by a scripted OCR member, 6 owed: `partial`), `text` (a short text read to its end: `whole`) and `big` (a text read through its first piece, more to
 *  follow: `partial` with R90's figures); `unknown` is a digest nothing holds (`none`). `answer` is the answer for all four, as the module gives it. */
export async function progressOf() {
  const { generate } = await import("../../pdfgen.mjs");
  // fixtures-contract: store-assembly job-registrar
  const { jobRegistrarStub } = await import("../../job-registrar-stub.mjs");
  const g = generate({ kind: "pdf", seed: "progress", fonts: ["type0"], size: { pages: 30, lines: 1 }, kinds: ["scan"] });
  const scan = await held(await g.bytes(), { ct: "application/pdf", format: "pdf", fromText: false });
  const jobs = jobRegistrarStub();
  const ocr = member((body) => ocrAnswer((Array.isArray(body.pages) ? body.pages : []).slice(0, 24), { text: (p) => `ocr words of page ${p}` }));
  await scan.w.x.readHeld({ sha: scan.d, kind: "reading", env: { OCR_WORKER: ocr }, registerJob: jobs.registerJob, armJobs: jobs.armJobs });
  const text = await held(textOf(20));
  await text.w.x.readHeld({ sha: text.d, kind: "reading" });
  const big = await held(textOf(32_000));
  await big.w.x.readHeld({ sha: big.d, kind: "reading" });
  const unknown = "4".repeat(64);
  const stores = { [scan.d]: scan.w.x, [text.d]: text.w.x, [big.d]: big.w.x };
  return {
    shas: { scan: scan.d, text: text.d, big: big.d, unknown },
    /* each digest is asked of the instance that holds it: one store a capture, as the three were made */
    progressOf: (list) => Object.assign({}, ...list.map((s) => (stores[s] || scan.w.x).progressOf([s]))),
    answer: Object.assign({}, scan.w.x.progressOf([scan.d]), text.w.x.progressOf([text.d]), big.w.x.progressOf([big.d]), scan.w.x.progressOf([unknown])),
  };
}

/** `readHeldAnswer`: the real answers of `readHeld({sha, ...})` (R80, R82, R90), the ledger's tick, over fixture captures. Each is a function of its own:
 *  - `noHome()` a digest the register names no home of: `{ok: true, read: false, why: "NO_HOME"}`;
 *  - `read()` a short text read to its end in one tick: `{ok: true, read: true, bundle_id, found}`;
 *  - `piece()` the first tick of a text that goes on: `more: true` with `detail: {read_through, total}`; `pieces(n)` the ticks of a text of `n` pieces, the
 *    last answering as `read()` does (`n` from 2 to 5, so that every piece is 4,096 units);
 *  - `noWholeObject()` a home the register names whose object the evidence store does not hold whole (nor in parts): `{ok: true, read: false, why: "NO_WHOLE_OBJECT"}`;
 *  - `held()` a reading already held: `{ok: true, read: false, why: "READING_HELD", counters: {written, skipped}}`;
 *  - `final(why)` a read ended, stated: `{ok: true, read: false, final: true, why}`. `why` `CURSOR_MISMATCH`: a read in pieces whose reader refuses the cursor (a
 *    refused `NOT_PIECEWISE` is stated partial once and answers `READING_HELD`, not final); `NO_PROGRESS`: an OCR tick whose member answered its pages with
 *    no glyph (R101), which ends the entry on that tick, owing nothing;
 *  - `failed()` the second tick of a text read in pieces, the evidence store failing (`head`, `get` and `put` reject `STORE_FAILED`): `{ok: true, read: false,
 *    owed: true, why: "TRANSIENT", detail: {read_through, total, reason}}`, the cursor kept, nothing indexed, the entry owed and tried again (R101);
 *  - `killed()` an OCR tick whose member died on a page: the answer carries `killed: [page]`;
 *  the paged and killed paths, each made by the real `readHeld` over a held capture and answering the figures the ledger reads (K5139):
 *  - `windowed()` `{answer, cursor, units}`: the first tick of a text read in windows. `answer` is `more: true` with `detail: {read_through, total}` and no cursor
 *    (the cursor is the index state's, not the answer's); `cursor` is the one the state holds for the next window (what `killedCursor` names); `units` is
 *    `unitsOf`'s answer, whose `read_through` and `total` state the same figures while more follows;
 *  - `scanOwed()` `{answer, counters}`: the tick of a scan that leaves pages for OCR: `owed: true` with its `registration`; `counters` are the capture's
 *    `{written, skipped, owed, failed}` as `unitsOf` states them;
 *  - `killedWindow()` `{first, cursor, answer}`: the window at `cursor` killed its reader (the ledger hands it back as `killedCursor`): `answer` steps past it,
 *    `more: true` with a `stated` window `{at, why: "UNIT_KILLED_READER"}` beside it;
 *  - `finished()` `{answer, counters}`: the read of a text in pieces ended and read again: `READING_HELD` with `counters {written, skipped}`; `counters` are
 *    `unitsOf`'s `{written, skipped, owed, failed}`, `owed` and `failed` zero. */
export const readHeldAnswer = {
  async noHome() { const { w } = await held("a text no register names"); return w.x.readHeld({ sha: "a".repeat(64) }); },
  async read() { const h = await held(textOf(20)); return h.w.x.readHeld({ sha: h.d, kind: "reading" }); },
  async piece() { const h = await held(textOf(9000)); return h.w.x.readHeld({ sha: h.d, kind: "reading" }); },
  async pieces(n) {
    if (!(Number.isInteger(n) && n >= 2 && n <= 5)) throw new Error("readHeldAnswer.pieces: n is from 2 to 5");
    const h = await held(textOf((n - 1) * 4096 + 1000));
    const answers = [];
    do answers.push(await h.w.x.readHeld({ sha: h.d, kind: "reading" })); while (answers.at(-1).more === true && answers.length < n + 2);
    if (answers.length !== n) throw new Error(`readHeldAnswer.pieces: ${answers.length} pieces for ${n}`);
    return answers;
  },
  async noWholeObject() { const h = await held(textOf(20), { whole: false }); return h.w.x.readHeld({ sha: h.d, kind: "reading" }); },
  async held() { const h = await held(textOf(20)); await h.w.x.readHeld({ sha: h.d, kind: "reading" }); return h.w.x.readHeld({ sha: h.d, kind: "reading" }); },
  async final(why = "CURSOR_MISMATCH") {
    if (why === "NO_PROGRESS") {
      /* a scan whose OCR member answers every page it is asked with words that hold no glyph: the pass reads nothing, the entry ends (R101) */
      const { generate } = await import("../../pdfgen.mjs");
      const g = generate({ kind: "pdf", seed: "no-progress", fonts: ["type0"], size: { pages: 3, lines: 1 }, kinds: ["scan"] });
      const h = await held(await g.bytes(), { ct: "application/pdf", format: "pdf", fromText: false });
      const blank = member((body) => ocrAnswer(body.pages, { text: () => "   " }));
      await h.w.x.readHeld({ sha: h.d, kind: "reading", env: {} });
      return h.w.x.readHeld({ sha: h.d, kind: "ocr", env: { OCR_WORKER: blank } });
    }
    if (why !== "CURSOR_MISMATCH") throw new Error(`readHeldAnswer.final: no such reason ${why}`);
    const h = await held(textOf(9000));
    await h.w.x.readHeld({ sha: h.d, kind: "reading" });
    h.w.x.read = async () => ({ refused: { code: why, why: "the held bytes are not the ones this cursor was made from" } });
    return h.w.x.readHeld({ sha: h.d, kind: "reading" });
  },
  async failed() {
    const h = await held(textOf(9000));
    await h.w.x.readHeld({ sha: h.d, kind: "reading" });
    const fails = async () => { throw new Error("STORE_FAILED"); };
    Object.assign(h.evidence, { head: fails, get: fails, put: fails });
    return h.w.x.readHeld({ sha: h.d, kind: "reading" });
  },
  async killed() {
    const { generate } = await import("../../pdfgen.mjs");
    const g = generate({ kind: "pdf", seed: "killed", fonts: ["type0"], size: { pages: 4, lines: 1 }, kinds: ["scan"] });
    const h = await held(await g.bytes(), { ct: "application/pdf", format: "pdf", fromText: false });
    const dies = member((body) => { if ((body.pages || []).includes(1)) throw new Error("the member's isolate was reset"); return ocrAnswer(body.pages, { text: (p) => `ocr ${p}` }); });
    await h.w.x.readHeld({ sha: h.d, kind: "reading", env: {} });
    return h.w.x.readHeld({ sha: h.d, kind: "ocr", env: { OCR_WORKER: dies } });
  },
  async windowed() {
    const h = await held(textOf(9000));
    const answer = await h.w.x.readHeld({ sha: h.d, kind: "reading" });
    return { answer, cursor: stateOf(h).cursor, units: h.w.x.unitsOf(h.d) };
  },
  async scanOwed() {
    const { generate } = await import("../../pdfgen.mjs");
    const { jobRegistrarStub } = await import("../../job-registrar-stub.mjs");
    const g = generate({ kind: "pdf", seed: "scan-owed", fonts: ["type0"], size: { pages: 30, lines: 1 }, kinds: ["scan"] });
    const h = await held(await g.bytes(), { ct: "application/pdf", format: "pdf", fromText: false });
    const jobs = jobRegistrarStub();
    const ocr = member((body) => ocrAnswer((Array.isArray(body.pages) ? body.pages : []).slice(0, 24), { text: (p) => `ocr words of page ${p}` }));
    const answer = await h.w.x.readHeld({ sha: h.d, kind: "reading", env: { OCR_WORKER: ocr }, registerJob: jobs.registerJob, armJobs: jobs.armJobs });
    return { answer, counters: h.w.x.unitsOf(h.d).counters };
  },
  async killedWindow() {
    const h = await held(textOf(9000));
    const first = await h.w.x.readHeld({ sha: h.d, kind: "reading" });
    const cursor = stateOf(h).cursor;
    return { first, cursor, answer: await h.w.x.readHeld({ sha: h.d, kind: "reading", killedCursor: cursor }) };
  },
  async finished() {
    const h = await held(textOf(4096 + 1000));
    let more;
    do more = (await h.w.x.readHeld({ sha: h.d, kind: "reading" })).more === true; while (more);
    return { answer: await h.w.x.readHeld({ sha: h.d, kind: "reading" }), counters: h.w.x.unitsOf(h.d).counters };
  },
};
/* the index state of a held capture's text, as the ledger's next window reads it */
const stateOf = (h) => h.w.rows(`SELECT cursor, read_through, total, more FROM capture_text_state WHERE capture_sha=?`, h.d)[0];

/** `transcribeRefusal`: the whole real refusal of `op=pagetranscribe` when the transcriber is not deployable (R47's C-51.7): `{status: 501, body: {ok: false,
 *  reason: "TRANSCRIBE_NOT_DEPLOYED", code, check: "C-51.7", translation, op}}`, with its check, made by `pageTranscribe` over a stored scan and a registered
 *  transcriber whose `deployable()` answers false. */
export async function transcribeRefusal() {
  const h = await held("%PDF-1.7 a scan " + Math.random(), { ct: "application/pdf", format: "pdf", fromText: false });
  h.w.x.writeReading({ bundleId: "INFO-1", captureSha: h.d, reading: { content_type: "generic", reader_version: 1, found: false, entities: [], facts: {},
    at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: 1 }, textUnits: [] });
  h.w.x.registerTranscriber("plane", { deployable: () => false, keptAway: () => null, transcription: () => { throw new Error("not deployed: no account is read"); } });
  return h.w.x.pageTranscribe({ captureSha: h.d, cls: "member", session: true, caps: ["contribute"], viewer: "class:admin", by: "member:m1", env: {} });
}

/** `unheldStructure`: the real answer of `pdfStructure({sha})` for a digest the evidence store does not hold (R31, capture's `evidenceAbsent`): `{status: 404,
 *  body: {ok: false, reason: "EVIDENCE_NOT_HELD", ...}}`. */
export async function unheldStructure({ sha: digest = "e".repeat(64), cls = "member", storeName = "bio" } = {}) {
  const { w } = await held("a held text");
  return w.x.pdfStructure({ sha: digest, cls, storeName });
}


/** `reextraction`: a successful re-extraction of a scanned PDF's unread page by `op=pdfstructure&ocr=1` (R34, R103): `{press, pass}`. `press` is the op's own answer
 *  (`pdfStructure`): it makes no OCR call and owes the page (`reextraction.performed: false`, `owed: true`, the candidate page `[1]`); `pass` is the ledger's pass
 *  that the press's job asks for (`readHeld({kind: "ocr"})`), whose `reextraction` is the performed one (`performed: true`, `written: true`, `pages: [1]`). Both are
 *  made by this module's real code over a stored two-page reading (page 1 has no text) and a scripted OCR member that reads page 1. */
export async function reextraction() {
  const text = i2([{ page: 0, text: "Text" }, { page: 1, text: "", undetermined: [noText(1)] }]);
  const w = fresh();
  bundle(w.s, "B-1");
  const d = await hold(w.evidence, "%PDF-1.7 " + Math.random());
  w.x.writeReading({ bundleId: "B-1", captureSha: d, reading: { content_type: "generic", reader_version: 1, read_from_text: false, found: false, entities: [], facts: {},
    at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: 2, container_extent: { container: "pdf", levels: ["images"], images: [] }, tier3_candidate: true },
    textUnits: pageUnits(text) });
  const { press, pass } = await pressThenPass(w, d, { OCR_WORKER: member(() => ocrAnswer([1])) });
  return { press, pass };
}
