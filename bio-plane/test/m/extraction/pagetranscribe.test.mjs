/* extraction: `op=pagetranscribe` (R71), its transcriber (R72) and its refusal row C-51.7 (R47), at the module's
   interface: `Extraction#registerTranscriber`, `Extraction#pageTranscribe` (the Durable Object half), the route
   `extractionOps(...).pagetranscribe`, and `pageTranscribeOp` / `extractionOp` (the control plane's half), over a stored
   scan and its reading, with scripted fleet members and a scripted pdf entry.

   The test set is handed in as a dependency (N829): the transcriber below is the composition root's stand-in (plane
   R36), whose `deployable()` judges the set and records it is handed by run-rules R19's rule (a set holding at least one
   matter, and a well-formed passed record for the part `transcribe` on that set's id at its current version). run-rules
   sits above this layer, so the rule is restated here, never imported; a one-matter set drives the whole chain to a
   written reading, and Civicsmith's empty set to C-51.7. Each test names the requirement ids it checks in its title. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, member, withEntry, i2, noText, ocrAnswer, pageUnits, payingAccount } from "./fixture.mjs";
import { REEXTRACT_CHECKS, extractionOps } from "../../../src/extraction/index.mjs";
import { pageTranscribeOp, extractionOp, EXTRACTION_OPS } from "../../../src/extraction/ops.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";
import { evidenceAbsent } from "../../../src/capture/ops.mjs";
import { WORD } from "./words.mjs";
import { notAPdf } from "../pdf-reader/fixtures.mjs";
import { keptAwayProject } from "../ai-accounts/fixtures.mjs";

/* ai-accounts' real refusal for a project keeping its material away from the AI (its published fixture, K5044) */
const KEPT_PROJECT = (await keptAwayProject({ project: "PROJ-1", use: "transcribe" })).aiKeptAway;

const SENTINEL = "sk-ant-SENTINEL-KEY-0000";
const ONE_MATTER = { id: "t-set", version: 2, matters: [{ id: "m1" }] };
const EMPTY_SET = { id: "civicsmith", version: 1, matters: [] };
const PASSED = { part: "transcribe", set: "t-set", set_version: 2, false_alarm_rate: 0, passed: true, graded_by: "harness", at: "2026-10-01" };

/* run-rules R19's bar for `transcribe` on `set`, restated (see the header). */
const barHeld = (set, records) => !!set && typeof set.id === "string" && Array.isArray(set.matters) && set.matters.length > 0
  && records.some((r) => r && r.part === "transcribe" && r.passed === true && r.set === set.id && r.set_version === set.version);

/* The composition root's transcriber (plane R36's shape), recording every call. `away` answers keepAway by project. */
function transcriber({ set = ONE_MATTER, records = [PASSED], away = () => null, account = null, limit = null,
                       answer = (pages) => ({ ok: true, engine: "claude-test", version: "2026-01", pages: pages.map((p) => ({ page: p, text: `AI text of page ${p}` })) }) } = {}) {
  const calls = { deployable: 0, keptAway: [], transcription: [], accountFor: [], useCheck: [], transcribe: [] };
  const t = {
    deployable() { calls.deployable++; return barHeld(set, records); },
    keptAway(q) { calls.keptAway.push(q); return away(q); },
    transcription({ member: m, project, at }) {
      calls.transcription.push({ member: m, project, at });
      return { member: m, project, at, act: `transcribe:abc:${at}`,
        accounts: { accountFor: payingAccount({ key: SENTINEL, record: calls.accountFor, answer: account }) },
        useCheck: async (q) => { calls.useCheck.push(q); return limit; },
        transcribe: async (q) => { calls.transcribe.push(q); return answer(q.pages, q); } };
    },
  };
  return { t, calls };
}

/* R73: the stored bytes name the format, so the scripted entry detects its signature as the real one does. */
const pdf = (text, pages) => ({ format: "pdf",
  detect: (b) => (b && new TextDecoder().decode(b.slice(0, 5)) === "%PDF-" ? { format: "pdf", confidence: "certain", signals: [] } : null),
  structure: async (b) => (new TextDecoder().decode(b).startsWith("%PDF")
  ? { ok: true, text: structuredClone(text), pages: pages ?? (text.pages || []).length, notes: [] }
  : await notAPdf()) });

/* A three-page scan: page 0 has a text layer, pages 1 and 2 are pictures. */
const SCAN = i2([{ page: 0, text: "Minutes of the meeting" }, { page: 1, text: "", undetermined: [noText(1)] },
                 { page: 2, text: "", undetermined: [noText(2)] }]);

/* A store holding the scan in bundle `bundleId` (filed in `project`), read once. */
async function held({ bundleId = "B-1", project = null, type = "information", text = SCAN } = {}) {
  const w = fresh();
  bundle(w.s, bundleId, { project, type });
  const d = await hold(w.evidence, "%PDF-1.7 " + Math.random());
  const reading = { content_type: "generic", reader_version: 1, read_from_text: false, found: false, entities: [], facts: {},
                    at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: text.pages.length,
                    container_extent: { container: "pdf", levels: ["images"], images: [] } };
  /* (fix round 9, G126e; R103) the scan as its reading stored it: page 0's text layer is its unit, pages 1 and 2 hold none; the act reads the
     stored units, never the file */
  w.x.writeReading({ bundleId, captureSha: d, reading, textUnits: pageUnits(text) });
  return { w, d };
}
const gets = (w) => w.evidence.calls.filter(([op]) => op === "get").length;
const writes = (w) => JSON.stringify([w.rows(`SELECT * FROM readings`), w.rows(`SELECT * FROM capture_text`), w.rows(`SELECT * FROM reading_history`)]);
const member1 = { cls: "member", session: true, caps: ["contribute"], viewer: "class:admin", by: "member:m1" };

test("R72: registerTranscriber takes one well-formed transcriber, once, whoever registers; a malformed one LISTENER_MALFORMED and a second LISTENER_DECLARED, as membership's listenerRefusal answers them", () => {
  const { x } = fresh();
  const { t } = transcriber();
  for (const [module, bad] of [["plane", null], ["plane", {}], ["plane", { ...t, deployable: 1 }], ["plane", { ...t, keptAway: null }],
                               ["plane", { deployable: t.deployable, keptAway: t.keptAway }], ["", t], [null, t]]) {
    const r = x.registerTranscriber(module, bad);
    assert.deepEqual(r, listenerRefusal(null, module, typeof bad?.transcription === "function" && typeof bad?.deployable === "function"
      && typeof bad?.keptAway === "function" ? bad.transcription : null));
    assert.equal(r.reason, "LISTENER_MALFORMED");
  }
  assert.deepEqual(x.registerTranscriber("plane", t), { ok: true, module: "plane" });
  const again = x.registerTranscriber("other", transcriber().t);
  assert.deepEqual([again.ok, again.reason, again.module], [false, "LISTENER_DECLARED", "plane"]);
  assert.deepEqual(again, listenerRefusal({ module: "plane", t }, "other", transcriber().t.transcription));
  assert.equal(x.registerTranscriber("plane", t).reason, "LISTENER_DECLARED", "a second by the same module too");
});

test("R71 R47 R72: the refusals in order, each by its row, before any byte is read, any account is read or any page rendered; each request fails two at once, so the earlier one is the one answered", async () => {
  const { w, d } = await held({ project: "PROJ-1" });
  bundle(w.s, "PROJ-H", { type: "project" });
  const hidden = await hold(w.evidence, "%PDF hidden");
  w.x.writeReading({ bundleId: "PROJ-H", captureSha: hidden, reading: { entities: [], at: "a" } });
  const off = transcriber({ set: EMPTY_SET });
  const KEPT = KEPT_PROJECT;
  const keptFor = (p) => ({ project }) => (project === p ? KEPT : null);
  const on = transcriber({ away: keptFor("PROJ-1") });
  const ocr = member(() => { throw new Error("never"); });
  const g0 = gets(w);
  /* a store with no transcriber registered; each case below registers its own on a fresh store */
  const none = await w.x.pageTranscribe({ captureSha: d, env: { OCR_WORKER: ocr }, ...member1 });
  assert.deepEqual([none.status, none.body.reason], [501, "TRANSCRIBE_NOT_DEPLOYED"], "no transcriber registered");
  const cases = [
    [off, { cls: "ai", session: false, caps: [] }, 403, "REEXTRACT_AGENT_REFUSED"],          // also not deployable
    [off, { cls: "member", session: true, caps: ["view"] }, 403, "REEXTRACT_NOT_CAPABLE"],    // also not deployable
    [off, { ...member1, captureSha: "9".repeat(64) }, 501, "TRANSCRIBE_NOT_DEPLOYED"],          // also never read
    [on, { ...member1, captureSha: "9".repeat(64) }, 409, "REEXTRACT_NOT_READ"],                // deployable, never read
    [on, { ...member1, captureSha: hidden, viewer: "member:outsider" }, 409, "REEXTRACT_NOT_READ"], // hidden answers alike
  ];
  for (const [tr, args, status, reason] of cases) {
    const v = await held({ project: "PROJ-1" });
    v.w.x.registerTranscriber("plane", tr.t);
    if (args.captureSha === hidden) {
      bundle(v.w.s, "PROJ-H", { type: "project" });
      v.w.x.writeReading({ bundleId: "PROJ-H", captureSha: hidden, reading: { entities: [], at: "a" } });
    }
    const n0 = gets(v.w);
    const r = await v.w.x.pageTranscribe({ captureSha: v.d, env: { OCR_WORKER: ocr }, ...args });
    assert.deepEqual([r.status, r.body.reason, r.body.code], [status, reason, reason], reason);
    assert.equal(r.body.check, REEXTRACT_CHECKS[reason].check);
    assert.equal(r.body.translation, REEXTRACT_CHECKS[reason].translation);
    assert.equal(r.body.op, "pagetranscribe");
    assert.equal(gets(v.w), n0, `${reason}: no byte was read`);
  }
  assert.equal(gets(w), g0);
  assert.equal(ocr.calls.length, 0, "no engine was called");
  for (const tr of [off, on]) {
    assert.deepEqual([tr.calls.transcription, tr.calls.accountFor, tr.calls.transcribe], [[], [], []], "no account was read, nothing sent");
  }
  assert.deepEqual(off.calls.keptAway, [], "C-51.7 comes before the keep-away read");
  /* the keep-away refusal, relayed as given: the capture's own project judges it, whatever project the act names */
  const k = await held({ project: "PROJ-1" });
  const kt = transcriber({ away: keptFor("PROJ-1") });
  k.w.x.registerTranscriber("plane", kt.t);
  const n0 = gets(k.w);
  const away = await k.w.x.pageTranscribe({ captureSha: k.d, project: "PROJ-PAYER", ...member1 });
  /* (T44; N869) relayed as given, with transcribe.refused beside its fields: t44.test.mjs */
  assert.deepEqual(away, { status: 403, body: { ...KEPT, says: WORD("transcribe.refused").replace("{reason}", KEPT.translation) } });
  assert.deepEqual(kt.calls.keptAway, [{ project: "PROJ-1", use: "transcribe" }], "the capture's project, never the payer's");
  assert.equal(gets(k.w), n0, "nothing read");
  assert.deepEqual([kt.calls.transcription, kt.calls.transcribe], [[], []], "nothing rendered or sent");
  /* control: the same request with the limit off goes on to read the bytes */
  const c = await held({ project: "PROJ-1" });
  const ct = transcriber();
  c.w.x.registerTranscriber("plane", ct.t);
  const ok = await withEntry(pdf(SCAN, 3), () => c.w.x.pageTranscribe({ captureSha: c.d, project: "PROJ-PAYER", ...member1 }));
  assert.equal(ok.status, 200);
  assert.deepEqual(ct.calls.keptAway, [{ project: "PROJ-1", use: "transcribe" }]);
  assert.ok(gets(c.w) > 0);
  assert.equal(ct.calls.transcription[0].project, "PROJ-PAYER", "the payer is the act's project, handed to the transcription");
});

test("R71 R72 R47 (C-51.7): not deployable is TRANSCRIBE_NOT_DEPLOYED, 501, its row's words, naming no account: Civicsmith's empty set, another set's record, a failed record, a deployable() that throws or answers a truthy non-true; the one-matter set with its passed record is the control", async () => {
  const variants = [
    ["the empty set", { set: EMPTY_SET }],
    ["no record", { records: [] }],
    ["another version", { records: [{ ...PASSED, set_version: 1 }] }],
    ["failed", { records: [{ ...PASSED, passed: false }] }],
  ];
  for (const [name, opts] of variants) {
    const { w, d } = await held();
    const tr = transcriber(opts);
    w.x.registerTranscriber("plane", tr.t);
    const r = await w.x.pageTranscribe({ captureSha: d, ...member1 });
    assert.deepEqual([r.status, r.body.reason, r.body.check], [501, "TRANSCRIBE_NOT_DEPLOYED", "C-51.7"], name);
    assert.equal(r.body.translation, WORD("transcribe.refused.notdeployed"), "R47 (T43): C-51.7's translation is words.json's, by key");
    assert.doesNotMatch(JSON.stringify(r.body), /SENTINEL|apikey|signin|level/, "it names nothing about any account");
    assert.deepEqual([tr.calls.keptAway, tr.calls.transcription, tr.calls.accountFor], [[], [], []], name);
  }
  for (const odd of [() => { throw new Error("x"); }, () => "true", () => 1]) {
    const { w, d } = await held();
    const tr = transcriber();
    w.x.registerTranscriber("plane", { ...tr.t, deployable: odd });
    const r = await w.x.pageTranscribe({ captureSha: d, ...member1 });
    assert.equal(r.body.reason, "TRANSCRIBE_NOT_DEPLOYED");
  }
  assert.deepEqual(REEXTRACT_CHECKS.TRANSCRIBE_NOT_DEPLOYED.where, "src/extraction/index.mjs pageTranscribe > is-transcribe");
  const { w, d } = await held();
  w.x.registerTranscriber("plane", transcriber().t);
  const ok = await withEntry(pdf(SCAN, 3), () => w.x.pageTranscribe({ captureSha: d, ...member1 }));
  assert.equal(ok.status, 200, "the bar held: no refusal");
});

test("R71 R72 R34 R19 R23 R24 R44 (the whole chain, the bar held on a one-matter set): the AI's pages are written under pixels -> ai_transcription, both uncapped; the prior reading kept; listeners told; reextracted via op=pagetranscribe with ai {engine, version, pages, act}; the key never stored or answered", async () => {
  const { w, d } = await held();
  const tr = transcriber({ answer: (pages) => ({ ok: true, engine: "claude-test", version: "2026-01", pages: [{ page: 1, text: "AI text of page 1" }] }) });
  w.x.registerTranscriber("plane", tr.t);
  w.x.onReading("content", () => ({ staled: 3 }));
  w.x.onReading("observation-log", () => ({ observed: { written: 1 } }));
  const r = await withEntry(pdf(SCAN, 3), () => w.x.pageTranscribe({ captureSha: d, project: null, ...member1 }));
  assert.equal(r.status, 200);
  const x = r.body.transcription;
  assert.deepEqual([x.performed, x.written, x.pages, x.engine, x.version, x.staled, x.observed.written, x.label],
                   [true, true, [1], "claude-test", "2026-01", 3, 1, WORD("transcribe.label")]);
  assert.match(x.act, /^transcribe:abc:/);
  assert.match(x.note, /transcribed by the AI \(claude-test 2026-01\) at a member's request/);
  assert.match(x.note, /page 3 the AI did not transcribe, and it stays unread/);
  assert.ok(x.units && x.units.written === 2, "pages 0 and 1 indexed");
  assert.equal(typeof x.chain, "string");
  /* the asks: tier 4 was asked for the two picture pages, for the acting member */
  assert.deepEqual(tr.calls.transcription.map((c) => [c.member, c.project]), [["member:m1", null]]);
  assert.deepEqual(tr.calls.accountFor.map((q) => q.act.kind), ["transcribe"]);
  assert.deepEqual(tr.calls.transcribe.map((q) => [q.pages, q.capture_sha, q.use]), [[[1, 2], d, "transcribe"]]);
  const stored = JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
  assert.deepEqual([stored.content_type, stored.at, stored.page_count], ["generic", "2026-09-01T00:00:00Z", 3]);
  assert.deepEqual(stored.container_extent, { container: "pdf", levels: ["images"], images: [] });
  assert.deepEqual(Object.keys(stored.reextracted).sort(), ["ai", "at", "by", "calibration", "engine", "pages", "version", "via"]);
  assert.deepEqual([stored.reextracted.via, stored.reextracted.by, stored.reextracted.pages], ["op=pagetranscribe", "member:m1", []]);
  assert.deepEqual({ ...stored.reextracted.ai, act: typeof stored.reextracted.ai.act }, { engine: "claude-test", version: "2026-01", pages: [1], act: "string" });
  const ai = stored.text_source.filter((s) => s.step === "pixels" || s.step === "ai_transcription");
  assert.deepEqual(ai.map((s) => [s.step, s.cap]), [["pixels", null], ["ai_transcription", null]], "R44: uncapped, undetermined");
  assert.equal(ai[1].engine, "claude-test");
  assert.equal(stored.text_tier, 4);
  assert.equal(w.one(`SELECT text FROM capture_text WHERE capture_sha=? AND seq=1`, d).text, "AI text of page 1");
  assert.equal(w.rows(`SELECT * FROM reading_history WHERE capture_sha=?`, d).length, 2, "R23: the prior reading kept");
  assert.equal(w.rows(`SELECT * FROM manifest`).length, 0, "no bundle version is minted");
  assert.equal(w.x.readingFor(d).origin.state, "composed");
  for (const t of ["readings", "reading_history", "capture_text", "reading_text_source", "composed_readings"])
    assert.doesNotMatch(JSON.stringify(w.rows(`SELECT * FROM ${t}`)), /SENTINEL/, t);
  assert.doesNotMatch(JSON.stringify(r), /SENTINEL/);
  /* R20: a promotion re-submitting the acquire-time reading with the same `at` does not undo it */
  w.x.projectPromotion({ bundleId: "B-1", author: "member:m1", files: [{ path: "data/provenance.json", text: JSON.stringify({ documents: [
    { capture: { sha256: d }, reading: { content_type: "generic", entities: [], at: "2026-09-01T00:00:00Z" } }] }) }] });
  assert.equal(JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading).reextracted.via, "op=pagetranscribe");
});

test("R71 R103 (fix round 9, G126b, K4901 (1)): with the OCR member bound, no OCR call is made inside the request: the AI is asked for every page still unread, and a page it leaves is owed to OCR", async () => {
  const { w, d } = await held();
  const tr = transcriber({ answer: () => ({ ok: true, engine: "claude-test", version: "2026-01", pages: [{ page: 1, text: "AI text of page 1" }] }) });
  w.x.registerTranscriber("plane", tr.t);
  const owed = [];
  w.x.registerOwe((e) => { owed.push(e); return { ok: true, existed: false, state: "queued" }; });
  const ocr = member(() => { throw new Error("never asked in the request"); });
  const r = await withEntry(pdf(SCAN, 3), () => w.x.pageTranscribe({ captureSha: d, ...member1, env: { OCR_WORKER: ocr } }));
  assert.equal(ocr.calls.length, 0);
  assert.deepEqual(tr.calls.transcribe.map((q) => q.pages), [[1, 2]]);
  assert.deepEqual([r.body.transcription.written, r.body.transcription.pages, r.body.transcription.ocr], [true, [1], null]);
  assert.deepEqual(owed, [{ kind: "ocr", sha: d, cursor: 2, pages_left: 1 }], "page 2, which the AI left, is owed to OCR");
  assert.deepEqual(r.body.owed, { kind: "ocr", pages_left: 1, registered: true, existed: false });
});

test("R71: with no page filled the answer's transcription is performed false, written false, why tier4Extend's note, and nothing is written: no page left unread, the AI declined", async () => {
  const runs = [
    [i2([{ page: 0, text: "all text" }]), {}, /no page was left that Civicsmith's own text recognition could not read/],
    /* (T43, N853a) an account or limit refusal is answered as that refusal: t43.test.mjs */
    [SCAN, { answer: () => ({ ok: false, reason: "AGENT_WORKER_UNBOUND" }) }, /declined \(AGENT_WORKER_UNBOUND\)/],
  ];
  for (const [text, opts, why] of runs) {
    const { w, d } = await held({ text });
    const tr = transcriber(opts);
    w.x.registerTranscriber("plane", tr.t);
    const before = writes(w);
    const r = await withEntry(pdf(text, 3), () => w.x.pageTranscribe({ captureSha: d, ...member1 }));
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.transcription), ["performed", "written", "why"]);
    assert.deepEqual([r.body.transcription.performed, r.body.transcription.written], [false, false]);
    assert.match(r.body.transcription.why, why);
    assert.equal(writes(w), before, "nothing is written");
  }
});

test("R71 R34 R24: a transcription whose write a listener refuses is rolled back whole and says so, never as the capture having left the caller's sight; with the listener quiet it is written (control)", async () => {
  const { w, d } = await held();
  w.x.registerTranscriber("plane", transcriber().t);
  let refuse = true;
  w.x.onReading("content", () => { if (refuse) throw new Error("refused"); return { staled: 0 }; });
  const before = writes(w);
  const run = () => withEntry(pdf(SCAN, 3), () => w.x.pageTranscribe({ captureSha: d, ...member1 }));
  const x = (await run()).body.transcription;
  assert.deepEqual([x.performed, x.written], [true, false]);
  assert.match(x.why, /rolled back whole, so the text above was read and NOT recorded, and nothing the transcription would have changed/);
  assert.equal(writes(w), before);
  refuse = false;
  const ok = (await run()).body.transcription;
  assert.deepEqual([ok.performed, ok.written, ok.why], [true, true, undefined]);
});

test("R71 R73: past its refusals an absent object is capture's one answer for it, and bytes no entry with pages reads answer performed false naming the format, nothing written; nothing asked of the AI", async () => {
  const { w, d } = await held();
  const tr = transcriber();
  w.x.registerTranscriber("plane", tr.t);
  w.evidence.held.delete(`bio/captures/${d}`);
  assert.deepEqual(await w.x.pageTranscribe({ captureSha: d, ...member1 }), evidenceAbsent(d, "bio", { tokenClass: "member" }));
  const n = await held();
  n.w.x.registerTranscriber("plane", tr.t);
  const notPdf = await hold(n.w.evidence, "not a pdf");
  n.w.x.writeReading({ bundleId: "B-1", captureSha: notPdf, reading: { entities: [], at: "a" } });
  const before = writes(n.w);
  const r = await withEntry(pdf(SCAN), () => n.w.x.pageTranscribe({ captureSha: notPdf, ...member1 }));
  assert.deepEqual([r.status, r.body.ok, r.body.transcription.performed, r.body.transcription.written], [200, true, false, false]);
  assert.equal(r.body.format, "undetermined");
  assert.equal(r.body.transcription.why, WORD("extraction.unread.stored_bytes_read").replace("{fmt}", WORD("extraction.unread.format_group_civicsmith")));
  assert.equal(writes(n.w), before);
  assert.deepEqual(tr.calls.transcribe, []);
});

test("R71: the control plane's half refuses no evidence storage and a malformed digest (as R31) and forwards the stamps and the payer project; the door does not reach it before L11 declares it (not in EXTRACTION_OPS, extractionOp answers null, K2635); the store's route answers pageTranscribe with the stamps", async () => {
  const json = (b, s = 200) => ({ b, s });
  const helpers = { json, storeSilent: (op) => ({ silent: op }), storageAbsent: (op, e) => ({ absent: op, e }),
    requiredArgument: (op, arg, shape) => ({ reason: "REQUIRED_ARGUMENT_MISSING", op, argument: arg, shape }) };
  const noStore = await pageTranscribeOp(new URL("http://p/?sha256=" + "a".repeat(64)), {}, null, helpers);
  assert.equal(noStore.absent, "pagetranscribe");
  const bad = await pageTranscribeOp(new URL("http://p/?sha256=XYZ"), { CAPTURES: { get() {} } }, null, helpers);
  assert.deepEqual([bad.s, bad.b.reason, bad.b.op, bad.b.argument], [400, "REQUIRED_ARGUMENT_MISSING", "pagetranscribe", "sha256"]);
  let asked = null;
  const store = { fetch: async (p) => { asked = new URL(String(p)); return new Response(JSON.stringify({ ok: true, result: { status: 501, body: { reason: "TRANSCRIBE_NOT_DEPLOYED" } } })); } };
  const stamps = { ...helpers, cls: "member", session: true, caps: ["contribute"], viewer: "member:m1", author: "member:m1", storeName: "ns" };
  assert.equal(EXTRACTION_OPS.includes("pagetranscribe"), false);
  let stores = 0;
  assert.equal(await extractionOp("pagetranscribe", new URL("http://p/?sha256=" + "b".repeat(64)), { CAPTURES: { get() {} } }, () => { stores++; return store; }, stamps), null);
  assert.equal(stores, 0);
  const out = await pageTranscribeOp(new URL("http://p/?sha256=" + "B".repeat(64) + "&project=PROJ-2"), { CAPTURES: { get() {} } }, store, stamps);
  assert.deepEqual(out, { b: { reason: "TRANSCRIBE_NOT_DEPLOYED" }, s: 501 });
  assert.equal(asked.pathname, "/pagetranscribe");
  assert.deepEqual(Object.fromEntries(asked.searchParams), { sha256: "b".repeat(64), cls: "member", session: "1", caps: "contribute",
    viewer: "member:m1", author: "member:m1", store: "ns", project: "PROJ-2" });
  const silent = await pageTranscribeOp(new URL("http://p/?sha256=" + "a".repeat(64)), { CAPTURES: { get() {} } }, { fetch: async () => new Response("{}") }, helpers);
  assert.equal(silent.silent, "pagetranscribe");
  /* the store's route, over the forwarded query */
  const { w, d } = await held({ project: null });
  const tr = transcriber();
  w.x.registerTranscriber("plane", tr.t);
  const route = extractionOps(w.x, new URL(`http://x/pagetranscribe?sha256=${d}&cls=member&session=1&caps=contribute&viewer=class:admin&author=member:m9&store=bio&project=PROJ-2`), null, {});
  const r = await withEntry(pdf(SCAN, 3), () => route.pagetranscribe());
  assert.equal(r.body.transcription.written, true);
  assert.deepEqual(tr.calls.transcription.map((c) => [c.member, c.project]), [["member:m9", "PROJ-2"]]);
  const nope = extractionOps(w.x, new URL(`http://x/pagetranscribe?sha256=${d}&cls=member&session=1&caps=view`), null, {});
  assert.equal((await nope.pagetranscribe()).body.reason, "REEXTRACT_NOT_CAPABLE");
});

test("R71 R35 (reading-pipeline R30, K2635): a second transcription asks the AI only for pages still unread and keeps every page already read, the AI's and OCR's (read by the ledger's pass between them); with nothing left it asks no one and writes nothing", async () => {
  const four = i2([{ page: 0, text: "Minutes" }, { page: 1, text: "", undetermined: [noText(1)] },
                   { page: 2, text: "", undetermined: [noText(2)] }, { page: 3, text: "", undetermined: [noText(3)] }]);
  const { w, d } = await held({ text: four });
  /* first: the AI reads page 1 of the three it is asked for */
  const first = transcriber({ answer: () => ({ ok: true, engine: "claude-test", version: "2026-01", pages: [{ page: 1, text: "AI text of page 1" }] }) });
  w.x.registerTranscriber("plane", first.t);
  const a = await withEntry(pdf(four, 4), () => w.x.pageTranscribe({ captureSha: d, ...member1, env: {} }));
  assert.deepEqual([a.body.transcription.written, a.body.transcription.pages, first.calls.transcribe.map((q) => q.pages)], [true, [1], [[1, 2, 3]]]);
  /* the ledger's OCR pass reads page 2 */
  const pass = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: member((b) => ocrAnswer(b.pages.filter((p) => p === 2))) } });
  assert.deepEqual(pass.reextraction && pass.reextraction.pages, [2], JSON.stringify(pass));
  /* second: the AI is asked for page 3 alone; pages 1 (AI) and 2 (OCR) are kept */
  const fresh2 = transcriber({ answer: (pages) => ({ ok: true, engine: "claude-test", version: "2026-02", pages: pages.map((p) => ({ page: p, text: `AI text of page ${p}` })) }) });
  /* the store keeps its first registration (one per storage); the second act runs through it with a new answer */
  first.t.transcription = fresh2.t.transcription;
  const b = await withEntry(pdf(four, 4), () => w.x.pageTranscribe({ captureSha: d, ...member1, env: {} }));
  assert.deepEqual(fresh2.calls.transcribe.map((q) => q.pages), [[3]], "only the page still unread");
  assert.equal(b.body.transcription.written, true);
  const texts = w.rows(`SELECT seq, text FROM capture_text WHERE capture_sha=? ORDER BY seq`, d).map((r) => [r.seq, r.text]);
  assert.deepEqual(texts, [[0, "Minutes"], [1, "AI text of page 1"], [2, "ocr text of page 2"], [3, "AI text of page 3"]], "nothing dropped");
  const chain = JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading).text_source;
  const engines = chain.filter((s) => s.step === "ai_transcription").map((s) => s.version);
  assert.deepEqual([...new Set(engines)].sort(), ["2026-01", "2026-02"], "each kept page stays under the build that read it");
  assert.ok(chain.some((s) => s.step === "ocr"));
  /* third: nothing left unread; no one is asked and nothing is written */
  const before = writes(w);
  const c = await withEntry(pdf(four, 4), () => w.x.pageTranscribe({ captureSha: d, ...member1, env: { OCR_WORKER: member(() => { throw new Error("never"); }) } }));
  assert.deepEqual([c.body.transcription.performed, c.body.transcription.written], [false, false]);
  assert.equal(fresh2.calls.transcribe.length, 1, "the AI is not asked again");
  assert.equal(writes(w), before);
});
