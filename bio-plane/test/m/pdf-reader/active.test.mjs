/* pdf-reader: requirement-named tests for the active-content list
 * (build/requirements/pdf-reader.md R36; K1888, T35-10), at the module's
 * interface. Every fixture is built by hand (R29); objects 1 (catalog), 2
 * (pages), 10-12 (fonts) and 100+2i / 101+2i (page i and its content) come
 * from `doc`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { doc, build, flate } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, ActiveItem, ActiveDetail, LinkRecord } from "../../../src/pdfstructure.mjs" */
/** @import { StreamBody } from "./pdf.mjs" */

/** The reading of a PDF; a thrown failure when the answer is a refusal.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
function readingOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** The `why` of a record's target, "" when its target states none.
 *  @param {LinkRecord} l
 *  @returns {string} */
const whyOf = (l) => (l.partition === "undetermined" ? l.target.why : "");
/** The `name` of a record's target, undefined when its target has none.
 *  @param {LinkRecord} l
 *  @returns {string | null | undefined} */
const targetNameOf = (l) => (l.partition === "intra" || l.partition === "undetermined" ? l.target.name : undefined);

/** @param {string} kind
 *  @param {number} object
 *  @param {number | null} page
 *  @param {string} key
 *  @param {ActiveDetail} [detail]
 *  @returns {ActiveItem} */
const at = (kind, object, page, key, detail = null) => ({ kind, where: { object, page, key }, detail });
/** @param {ActiveDetail} detail
 *  @returns {ActiveItem} */
const unread = (detail) => ({ kind: "unread", where: null, detail });
/** @param {Uint8Array} bytes
 *  @returns {Promise<ActiveItem[]>} */
const activeOf = async (bytes) => readingOf(await extractPdfStructure(bytes)).active;
const ENC = "<< /Filter /Standard /V 1 /R 2 /O (o) /U (u) /P -4 >>";

test("R36: every kind is found where it sits, with its object, page and key, in object-number then key order", async () => {
  const r = readingOf(await extractPdfStructure(doc([{ content: "", extra: "/AA << /O 49 0 R >> /Annots [50 0 R 51 0 R 52 0 R]" }], {
    catalog: "/OpenAction 40 0 R /AA << /WC 41 0 R >> /Names << /JavaScript 42 0 R /EmbeddedFiles 43 0 R >> /AcroForm << /Fields [] /XFA 44 0 R >>",
    objs: {
      40: "<< /S /JavaScript /JS (app.alert(1)) >>",
      41: "<< /S /Launch /F (calc.exe) >>",
      42: "<< /Names [(init) 45 0 R] >>",
      43: "<< /Names [(a.txt) 46 0 R] >>",
      44: { data: "<xdp:xdp/>" },
      45: "<< /S /JavaScript /JS 47 0 R >>",
      46: "<< /Type /Filespec /F (a.txt) /EF << /F 48 0 R >> >>",
      47: { data: "this.exportDataObject({ cName: 'a.txt', nLaunch: 2 });" },
      48: { dict: "/Type /EmbeddedFile", data: "hello" },
      49: "<< /S /JavaScript /JS (1) >>",
      50: "<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /A << /S /Launch /Win << /F (cmd.exe) >> >> >>",
      51: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /Contents (att) /FS 46 0 R >>",
      52: "<< /Type /Annot /Subtype /RichMedia /Rect [0 0 1 1] /RichMediaContent << >> /AA << /PO 49 0 R /PC 49 0 R >> >>",
    },
  })));
  assert.deepEqual(r.active, [
    at("open-action", 1, null, "OpenAction", "JavaScript"),
    at("additional-actions", 1, null, "AA", ["/WC"]),
    at("javascript", 1, null, "JavaScript"),
    at("xfa", 1, null, "XFA"),
    at("javascript", 40, null, "S"),
    at("launch", 41, null, "S", "calc.exe"),
    at("embedded-file", 43, null, "Names", "a.txt"),
    at("javascript", 45, null, "S"),
    at("javascript", 49, null, "S"),
    at("launch", 50, 0, "S", "cmd.exe"),
    at("embedded-file", 51, 0, "FS", "att"),
    at("rich-media", 52, 0, "Subtype"),
    at("additional-actions", 52, 0, "AA", ["/PO", "/PC"]),
    at("additional-actions", 100, 0, "AA", ["/O"]),
  ]);
  // beside images, at the top level: tier 2's replacement of `text` keeps it
  assert.ok(!("active" in r.text));
});

test("R36: names are compared after their #xx escapes are decoded", async () => {
  const active = await activeOf(doc([{ content: "" }], {
    catalog: "/#4F#70enAction [100 0 R /Fit]",
    objs: {
      40: "<< /#53 /J#61vaScript /J#53 (x) >>",
      41: "<< /S /#4caunch >>",
      42: "<< /#41A << /O 40 0 R >> >>",
      43: "<< /#58FA [] >>",
      44: "<< /Subtype /Rich#4Dedia >>",
      45: "<< /Rich#4DediaContent << >> >>",
      46: "<< /Names << /J#61vaScript 40 0 R >> >>",
      47: "<< /Fil#74er /St#61ndard /R 4 >>",
    },
  }));
  assert.deepEqual(active, [
    at("open-action", 1, null, "OpenAction", "destination"),
    at("javascript", 40, null, "S"),
    at("launch", 41, null, "S"),
    at("additional-actions", 42, null, "AA", ["/O"]),
    at("xfa", 43, null, "XFA"),
    at("rich-media", 44, null, "Subtype"),
    at("rich-media", 45, null, "RichMediaContent"),
    at("javascript", 46, null, "JavaScript"),
    at("encryption", 47, null, "Filter", 4),
    unread("encrypted"),
  ]);
});

test("R36: every object R8's read reaches is examined: off the page tree, in an object stream, defined late in the file", async () => {
  const annot = "<< /Type /Annot /Subtype /Link /Rect [0 0 1 1] /A << /S /JavaScript /JS (x) >> >>";
  const action = "<< /S /Launch /F << /Type /Filespec /UF (run.cmd) >> >>";
  const header = `60 0 61 ${annot.length + 1} `;
  /** @type {StreamBody} */
  const objstm = { dict: `/Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode`, data: flate(header + annot + " " + action) };
  const active = await activeOf(doc([{ content: "", extra: "/Annots [60 0 R]" }], {
    objs: { 70: objstm, 80: "<< /S /JavaScript >>" },
    tail: "5 0 obj\n<< /XFA 6 0 R >>\nendobj\n",
  }));
  assert.deepEqual(active, [
    at("xfa", 5, null, "XFA"),               // defined last in the file, listed by its number
    at("javascript", 60, 0, "S"),            // inside the object stream, an annotation of page 0
    at("launch", 61, null, "S", "run.cmd"),  // inside the object stream, reached by nothing
    at("javascript", 80, null, "S"),         // reached by nothing
  ]);
});

test("R36: one item per dictionary per kind; nested direct dictionaries are their own; an embedded file is one item per file", async () => {
  const active = await activeOf(doc([{ content: "" }], {
    catalog: "/OpenAction << /S /JavaScript /JS (a) /Next << /S /JavaScript /JS (b) >> >>",
    objs: {
      40: "<< /JS (a) /S /JavaScript /JavaScript 41 0 R >>",
      41: "<< /Subtype /RichMedia /RichMediaContent << >> /S /Launch /Win << /F (w.exe) >> /S /Launch >>",
    },
  }));
  assert.deepEqual(active, [
    at("open-action", 1, null, "OpenAction", "JavaScript"),
    at("javascript", 1, null, "S"),
    at("javascript", 1, null, "S"),
    at("javascript", 40, null, "JS"),
    at("rich-media", 41, null, "Subtype"),
    at("launch", 41, null, "S", "w.exe"),
  ]);
});

test("R36: embedded-file is each R5 record, intra or undetermined, its detail the record's name", async () => {
  const r = readingOf(await extractPdfStructure(doc([{ content: "", extra: "/Annots [50 0 R 51 0 R 52 0 R]" }], {
    catalog: "/Names << /EmbeddedFiles 43 0 R >>",
    objs: {
      43: "<< /Kids [44 0 R] >>",
      44: "<< /Names [(x.csv) 46 0 R () 47 0 R (z.bin) 99 0 R] >>",
      46: "<< /Type /Filespec /F (x.csv) /EF << /F 48 0 R >> >>",
      47: "<< /Type /Filespec /UF (from-spec.txt) /F (f.txt) >>",
      48: { data: "1,2" },
      50: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /FS 46 0 R >>",
      51: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /Contents (no spec) >>",
      52: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /FS << /Type /Filespec /F (inline.doc) /EF << /F 98 0 R >> >> >>",
    },
  })));
  const files = r.active.filter((a) => a.kind === "embedded-file");
  assert.deepEqual(files, [
    at("embedded-file", 44, null, "Names", "x.csv"),
    at("embedded-file", 44, null, "Names", "from-spec.txt"),
    at("embedded-file", 44, null, "Names", "z.bin"),
    at("embedded-file", 50, 0, "FS", "x.csv"),
    at("embedded-file", 51, 0, "FS", "no spec"),
    at("embedded-file", 52, 0, "FS", "inline.doc"),
  ]);
  const records = r.links.filter((l) => l.partition === "intra" || /^embedded_/.test(whyOf(l)));
  assert.deepEqual(records.map((l) => l.partition), ["intra", "undetermined", "undetermined", "intra", "undetermined", "undetermined"]);
  assert.deepEqual(files.map((f) => f.detail).sort(), records.map(targetNameOf).sort());
  assert.equal(r.active.length, files.length);
});

test("R36: open-action's detail is the action's /S, \"destination\" for a bare destination, else null", async () => {
  /** @param {string} v
   *  @returns {Promise<ActiveItem | undefined>} */
  const detail = async (v) => (await activeOf(doc([{ content: "" }], { catalog: `/OpenAction ${v}`, objs: { 40: "[100 0 R /Fit]" } })))[0];
  assert.deepEqual(await detail("[100 0 R /Fit]"), at("open-action", 1, null, "OpenAction", "destination"));
  assert.deepEqual(await detail("40 0 R"), at("open-action", 1, null, "OpenAction", "destination"));
  assert.deepEqual(await detail("/chapter"), at("open-action", 1, null, "OpenAction", "destination"));
  assert.deepEqual(await detail("(chapter)"), at("open-action", 1, null, "OpenAction", "destination"));
  assert.deepEqual(await detail("<< /S /GoTo /D [100 0 R /Fit] >>"), at("open-action", 1, null, "OpenAction", "GoTo"));
  assert.deepEqual(await detail("<< /Type /Action >>"), at("open-action", 1, null, "OpenAction", null));
  assert.deepEqual(await detail("99 0 R"), at("open-action", 1, null, "OpenAction", null));
  // an /AA that resolves to no dictionary lists no trigger keys
  assert.deepEqual(await activeOf(doc([{ content: "" }], { catalog: "/AA 99 0 R" })), [at("additional-actions", 1, null, "AA", [])]);
});

test("R36: what could not be read is stated: an undecodable object stream, an encrypted document; its unencrypted dictionaries are still examined", async () => {
  /** @type {StreamBody} */
  const bad = { dict: "/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode", data: "junk" };
  assert.deepEqual(await activeOf(doc([{ content: "" }], { objs: { 70: bad, 71: { ...bad } } })), [unread("objstm_undecodable")]);
  const enc = readingOf(await extractPdfStructure(doc([{ content: "BT /F1 10 Tf (x) Tj ET", extra: "/AA << /C 40 0 R >>" }],
    { objs: { 40: "<< /S /Launch /F (x.exe) >>", 70: bad, 90: ENC }, trailer: "trailer\n<< /Root 1 0 R /Encrypt 90 0 R >>\n" })));
  assert.deepEqual(enc.active, [
    at("launch", 40, null, "S", "x.exe"),
    at("encryption", 90, null, "Filter", 2),
    at("additional-actions", 100, 0, "AA", ["/C"]),
    unread("objstm_undecodable"),
    unread("encrypted"),
  ]);
  // R23's own test decides encryption: a /Standard filter without a numeric /R is not the handler
  assert.deepEqual(await activeOf(doc([{ content: "" }], { objs: { 90: "<< /Filter /Standard /R (2) >>" } })), []);
});

test("R36: [] only when nothing was found and nothing went unread; a link, a form, an image or text acts on nothing", async () => {
  assert.deepEqual(await activeOf(doc([{ content: "" }])), []);
  assert.deepEqual(await activeOf(build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] >>" })), []);
  const quiet = readingOf(await extractPdfStructure(doc([{
    content: "BT /F1 10 Tf (Hello) Tj ET q 10 0 0 10 0 0 cm /I Do Q /Fm Do",
    resources: "/Font << /F1 10 0 R >> /XObject << /I 20 0 R /Fm 21 0 R >>",
    extra: "/Annots [30 0 R 31 0 R]",
  }], { objs: {
    20: { dict: "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", data: flate("\x80") },
    21: { dict: "/Type /XObject /Subtype /Form /BBox [0 0 1 1]", data: "" },
    30: "<< /Type /Annot /Subtype /Link /Rect [0 0 1 1] /A << /S /URI /URI (javascript:alert(1)) >> >>",
    31: "<< /Type /Annot /Subtype /Link /Rect [0 0 1 1] /A << /S /GoTo /D [100 0 R /Fit] >> >>",
    40: "<< /Type /Filespec /F (orphan.txt) /EF << /F 41 0 R >> >>",
    41: { dict: "/Type /EmbeddedFile", data: "never attached" },
  } })));
  assert.equal(quiet.text.document, "Hello");
  assert.deepEqual(quiet.active, []);
});

test("R36: read, never executed: a script's text is neither run nor carried, and nothing is fetched or timed", async () => {
  const bytes = doc([{ content: "" }], {
    catalog: "/OpenAction 40 0 R",
    objs: {
      40: "<< /S /JavaScript /JS (globalThis.__pdfR36Ran = true; app.launchURL\\('https://example.org/'\\)) /Next 41 0 R >>",
      41: "<< /S /Launch /F (calc.exe) /NewWindow true >>",
    },
  });
  const saved = { fetch: globalThis.fetch, now: Date.now, perf: performance.now };
  /** @returns {never} */
  const boom = () => { throw new Error("executed or impure"); };
  globalThis.fetch = boom; Date.now = boom; performance.now = boom;
  const active = await (async () => {
    try { return await activeOf(bytes); } finally {
      globalThis.fetch = saved.fetch; Date.now = saved.now; performance.now = saved.perf;
    }
  })();
  /* the script's global, read by its descriptor: none, as its value was undefined */
  assert.equal(Object.getOwnPropertyDescriptor(globalThis, "__pdfR36Ran"), undefined);
  assert.deepEqual(active, [
    at("open-action", 1, null, "OpenAction", "JavaScript"),
    at("javascript", 40, null, "S"),
    at("launch", 41, null, "S", "calc.exe"),
  ]);
  assert.ok(!JSON.stringify(active).includes("__pdfR36Ran"));
});
