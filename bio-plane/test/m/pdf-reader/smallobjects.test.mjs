/* pdf-reader: requirement-named tests for the object table of a file of many small objects (build/requirements/pdf-reader.md
 * R37 `objects()`, R30 `openPdf`, R41 the bounded reading; fix round 5, E2; the reading of a large PDF starves the object), at the
 * module's interface.
 *
 * The files are doc-clean R4's worst case, as many small objects as fit in 16 MiB (about 130,000-148,000, smallobjects.mjs):
 * annotations with a rect, a number and a string, and a structure tree of elements that name their parent, page and children.
 * Each is read in a process of its own (memory-child.mjs) with the V8 heap held to the idle process plus 94 MB, so the heap and
 * the 15.6 MiB of the file's bytes beside it are held under 110 MB, the object's 128 less the 20 MB the plane's baseline takes
 * (K4530). A read that needs more dies in the heap, as it does in the object. `doc-clean` R4 measures the same file as a
 * resident set under workerd; `workerd-index.probe.mjs` reads it with `reading-pipeline.read` (a module after this one in the order,
 * so not a test of this module's). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { smallObjectsPdf, TEXT_LINE } from "./smallobjects.mjs";
import { openPdf } from "../../../src/pdfstructure.mjs";
import { doc } from "./pdf.mjs";

/** @import { PdfValue, PdfMap, PdfName, PdfDoc } from "../../../src/pdfstructure.mjs" */
/** @import { SmallObjectsShape } from "./smallobjects.mjs" */

/** A value that is there; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined || v === null) throw new Error(`${what}: none`);
  return v;
}
/** The map of a dictionary value; a thrown failure naming `what` when `v` is not a dictionary.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfMap} */
function dictMap(v, what) {
  if (v === null || typeof v !== "object" || v.t !== "dict") throw new Error(`${what}: not a dictionary`);
  return v.map;
}
/** A name value; a thrown failure naming `what` when `v` is not a name.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfName} */
function nameOf(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "name") throw new Error(`${what}: not a name`);
  return v;
}

/** @param {string} p
 *  @returns {string} */
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const CHILD = here("./memory-child.mjs");
const WORK = mkdtempSync(join(tmpdir(), "pdf-reader-e2-"));
process.on("exit", () => { try { rmSync(WORK, { recursive: true, force: true }); } catch { /* scratch only */ } });
const ROOM = 94;
/** What `objects()` answered for one file: its count of objects and its digest.
 *  @typedef {Object} ShapeAnswer
 *  @property {number} objects
 *  @property {string} digest
 */
/** One answer for each shape.
 *  @typedef {Object} ShapeAnswers
 *  @property {ShapeAnswer} annots
 *  @property {ShapeAnswer} tagged
 */
/* what `objects()` answered for these files before the table was rebuilt (the tranche's reader, digested by memory-child.mjs) */
/** @type {ShapeAnswers} */
const SHAPES = {
  annots: { objects: 130559, digest: "f62c5b9337dc78d39833de9f4024f12441aea8ffda5d16e9d9975c4edbb1f762" },
  tagged: { objects: 147888, digest: "2700c29019d6bfd336d2320eb078e8ccffa6533a68854f334460cdb915dfb236" },
};
const ANSWER = "67babe797dc0135f9c510cbcb00dc98cf13ce6d6a5e49a7c8f8f3e38d2a36f37"; // extractPdfStructure's, either file

/** How a child process ended and what it printed.
 *  @typedef {Object} ChildRun
 *  @property {number | null} code
 *  @property {string | null} signal
 *  @property {string} out
 *  @property {string} err
 */
/** @param {string[]} args
 *  @param {string[]} [nodeArgs]
 *  @returns {Promise<ChildRun>} */
function child(args, nodeArgs = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [...nodeArgs, CHILD, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", /** @param {Buffer} d */ (d) => (out += d));
    p.stderr.on("data", /** @param {Buffer} d */ (d) => (err += d));
    p.on("close", (code, signal) => resolve({ code, signal, out, err }));
  });
}

/** The JSON object a child printed; a thrown failure naming `what` when it printed none.
 *  @param {string} text
 *  @param {string} what
 *  @returns {object} */
function printed(text, what) {
  /** @type {unknown} */
  const v = JSON.parse(text);
  if (typeof v !== "object" || v === null) throw new Error(`${what}: the child printed no object`);
  return v;
}
/** The idle heap a child printed (`idle`); a thrown failure when it printed no number.
 *  @param {string} text
 *  @returns {number} */
function baseHeapMBOf(text) {
  const v = printed(text, "idle");
  const n = "baseHeapMB" in v ? v.baseHeapMB : undefined;
  if (typeof n !== "number") throw new Error("idle: no baseHeapMB");
  return n;
}
/** The count of objects a child printed (`objects`); a thrown failure when it printed no number.
 *  @param {string} text
 *  @returns {number} */
function objectsOf(text) {
  const v = printed(text, "objects");
  const n = "objects" in v ? v.objects : undefined;
  if (typeof n !== "number") throw new Error("objects: no count of objects");
  return n;
}
/** Whether the reading a child made answered ok (`measure`); a thrown failure when it printed no boolean.
 *  @param {string} text
 *  @returns {boolean} */
function okOf(text) {
  const v = printed(text, "measure");
  const ok = "ok" in v ? v.ok : undefined;
  if (typeof ok !== "boolean") throw new Error("measure: no ok");
  return ok;
}
/** The digest a child printed (`digest`); a thrown failure when it printed no string.
 *  @param {string} text
 *  @returns {string} */
function digestOf(text) {
  const v = printed(text, "digest");
  const digest = "digest" in v ? v.digest : undefined;
  if (typeof digest !== "string") throw new Error("digest: no digest");
  return digest;
}

/** What a run in a capped heap gives: the cap, the run, and whether it completed.
 *  @typedef {Object} Capped
 *  @property {number} capMB
 *  @property {ChildRun} m
 *  @property {boolean} ok
 */
/** @param {string} mode
 *  @param {string} file
 *  @returns {Promise<Capped>} */
async function capped(mode, file) {
  const idle = await child(["idle", file], ["--expose-gc"]);
  assert.equal(idle.code, 0, idle.err.slice(0, 300));
  const capMB = Math.ceil(baseHeapMBOf(idle.out)) + ROOM;
  const m = await child([mode, file], ["--expose-gc", `--max-old-space-size=${capMB}`, "--max-semi-space-size=2"]);
  return { capMB, m, ok: m.code === 0 };
}
/** The file of one shape, written to the scratch folder.
 *  @param {SmallObjectsShape} shape
 *  @returns {string} */
function written(shape) {
  const bytes = smallObjectsPdf(shape);
  assert.ok(bytes.length > 15 * 1048576 && bytes.length < 16 * 1048576, `${shape}: ${bytes.length}`);
  const file = join(WORK, `${shape}.pdf`);
  writeFileSync(file, bytes);
  return file;
}
const files = { annots: written("annots"), tagged: written("tagged") };

/** R37 R30: open and objects() of the file in the capped heap, and its answer unchanged.
 *  @param {SmallObjectsShape} shape
 *  @param {string} file
 *  @param {ShapeAnswer} answer
 *  @returns {Promise<void>} */
async function objectsHold(shape, file, answer) {
  const { capMB, m, ok } = await capped("objects", file);
  assert.ok(ok, `open and objects() did not complete in a ${capMB} MB heap beside the file (${m.signal ?? "exit " + m.code}): ${m.err.split("\n").slice(0, 3).join(" | ")}`);
  assert.equal(objectsOf(m.out), answer.objects);
  const d = await child(["objdigest", file]);
  assert.equal(d.code, 0, d.err.slice(0, 300));
  assert.deepEqual(JSON.parse(d.out), answer, `${shape}: objects() is not what it was`);
}
/** R41: the reading of the file in the capped heap, and its answer unchanged.
 *  @param {string} file
 *  @returns {Promise<void>} */
async function readingHolds(file) {
  const { capMB, m, ok } = await capped("measure", file);
  assert.ok(ok, `the reading did not complete in a ${capMB} MB heap beside the file (${m.signal ?? "exit " + m.code}): ${m.err.split("\n").slice(0, 3).join(" | ")}`);
  assert.equal(okOf(m.out), true);
  const d = await child(["digest", file]);
  assert.equal(digestOf(d.out), ANSWER);
}

test("R37 R30: openPdf and objects() of a 16 MiB file of annots small objects hold under 110 MB with the file, and the answer is unchanged", { timeout: 600_000 }, async () => {
  await objectsHold("annots", files.annots, SHAPES.annots);
});

test("R41: the reading of the same annots file (extractPdfStructure) holds under 110 MB with the file, and its answer is unchanged", { timeout: 600_000 }, async () => {
  await readingHolds(files.annots);
});

test("R37 R30: openPdf and objects() of a 16 MiB file of tagged small objects hold under 110 MB with the file, and the answer is unchanged", { timeout: 600_000 }, async () => {
  await objectsHold("tagged", files.tagged, SHAPES.tagged);
});

test("R41: the reading of the same tagged file (extractPdfStructure) holds under 110 MB with the file, and its answer is unchanged", { timeout: 600_000 }, async () => {
  await readingHolds(files.tagged);
});

test("R37: a name that is an Object.prototype key is an ordinary key of a dictionary, and a name value is one shared, unchanging object", async () => {
  const d = await openPdf(doc([{ content: TEXT_LINE }], { catalog: "/Probe 80 0 R",
    objs: { 80: "<< /constructor 1 /__proto__ 2 /toString 3 /hasOwnProperty 4 /Type /Probe /Alt /Probe >>" } }));
  /** @type {PdfDoc} */
  const opened = must(d, "openPdf");
  const map = dictMap(opened.resolve({ t: "ref", n: 80, g: 0 }), "object 80");
  assert.deepEqual(Object.keys(map), ["constructor", "__proto__", "toString", "hasOwnProperty", "Type", "Alt"]);
  /** The dictionary's own entries by key, so an entry named as an Object member is read as the entry. */
  const entries = new Map(Object.entries(map));
  assert.equal(entries.get("constructor"), 1);
  assert.equal(map["__proto__"], 2);
  assert.equal(map.toString, 3);
  assert.equal("valueOf" in map, false, "no inherited key");
  assert.deepEqual(map.Type, { t: "name", v: "Probe" });
  assert.equal(map.Type, map.Alt, "one object for one name");
  const type = nameOf(map.Type, "Type");
  assert.throws(() => { "use strict"; Object.assign(type, { v: "Other" }); }, TypeError);
  const e = must(opened.objects(), "objects()");
  assert.equal(nameOf(dictMap(must(e.objects.find((o) => o.num === 80), "object 80").value, "object 80").Type, "Type").v, "Probe");
});
