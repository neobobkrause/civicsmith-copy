/* pdf-reader: requirement-named tests for the memory a very large page takes (R41, R22: "1,000 light pages and one 40 MiB page"
 * under a 128 MB heap; the page bound is 64 MiB), at the module's interface, in a process of its own whose V8 heap is held to
 * 128 MB, the object's. The content is text-dense: every line is its own `BT ... Tj ET`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { deflateSync } from "node:zlib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { doc } from "./pdf.mjs";
/** @import { BigPageMessage } from "./memory-child.mjs" */

const CHILD = fileURLToPath(new URL("./memory-child.mjs", import.meta.url));
const SENTENCE = "the council adopted the budget for the year";
const LINE = `BT /F1 12 Tf 40 700 Td (${SENTENCE}) Tj ET\n`;

/** How a child process ended and what it printed.
 *  @typedef {Object} ChildRun
 *  @property {number | null} code
 *  @property {string | null} signal
 *  @property {string} out
 *  @property {string} err
 */
/** @param {string} file
 *  @param {number} heapMB
 *  @returns {Promise<ChildRun>} */
function child(file, heapMB) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--expose-gc", `--max-old-space-size=${heapMB}`, CHILD, "bigpage", file, SENTENCE], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", /** @param {Buffer} d */ (d) => (out += d));
    p.stderr.on("data", /** @param {Buffer} d */ (d) => (err += d));
    p.on("close", (code, signal) => resolve({ code, signal, out, err }));
  });
}

/** A list a child printed, its entries not yet looked at.
 *  @typedef {(object | string | number | boolean | null)[]} PrintedList */
/** Whether `v` is a list.
 *  @param {unknown} v
 *  @returns {v is PrintedList} */
const isList = (v) => Array.isArray(v);
/** A list of strings a child printed; a thrown failure naming `what` when it is not one.
 *  @param {unknown} v
 *  @param {string} what
 *  @returns {string[]} */
function stringsOf(v, what) {
  if (!isList(v)) throw new Error(`${what}: not a list`);
  return v.map((x, i) => {
    if (typeof x !== "string") throw new Error(`${what}[${i}]: not a string`);
    return x;
  });
}
/** What the child's `bigpage` printed; a thrown failure naming the member it lacks.
 *  @param {string} text
 *  @returns {BigPageMessage} */
function bigPageOf(text) {
  /** @type {unknown} */
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) throw new Error("bigpage: the child printed no object");
  /** @type {object} */
  const v = parsed;
  const ok = "ok" in v ? v.ok : undefined, pages = "pages" in v ? v.pages : undefined, first = "first" in v ? v.first : undefined,
    last = "last" in v ? v.last : undefined, said = "said" in v ? v.said : undefined;
  if (typeof ok !== "boolean") throw new Error("bigpage: ok: not a boolean");
  if (typeof pages !== "number") throw new Error("bigpage: pages: not a number");
  if (typeof first !== "string") throw new Error("bigpage: first: not a string");
  if (typeof last !== "string") throw new Error("bigpage: last: not a string");
  if (typeof said !== "number") throw new Error("bigpage: said: not a number");
  return { ok, pages, first, last, said, marked: stringsOf("marked" in v ? v.marked : undefined, "bigpage: marked"),
    notes: stringsOf("notes" in v ? v.notes : undefined, "bigpage: notes") };
}

/** What `readPage` gives: the lines the big page has and the child's run.
 *  @typedef {Object} PageRead
 *  @property {number} lines
 *  @property {ChildRun} r
 */
/** @param {number} mb
 *  @param {number} heapMB
 *  @returns {Promise<PageRead>} */
async function readPage(mb, heapMB) {
  const lines = Math.ceil((mb * 1048576) / LINE.length);
  const z = new Uint8Array(deflateSync(Buffer.from(LINE.repeat(lines), "latin1"), { level: 6 }));
  const dir = mkdtempSync(join(tmpdir(), "pdf-bigpage-"));
  try {
    const file = join(dir, "page.pdf");
    writeFileSync(file, doc([{ content: "BT /F1 12 Tf 40 700 Td (first page) Tj ET" }, { content: { dict: "/Filter /FlateDecode", data: z } }, { content: "BT /F1 12 Tf 40 700 Td (last page) Tj ET" }]));
    const r = await child(file, heapMB);
    return { lines, r };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** R41, R22: one page of `mb` MiB of text read whole in a 128 MB heap, and what it says.
 *  @param {number} mb
 *  @returns {Promise<void>} */
async function readsBigPage(mb) {
  const { lines, r } = await readPage(mb, 128);
  assert.equal(r.code, 0, `the reading did not complete in a 128 MB heap: ${r.err.split("\n").find((l) => /FATAL|heap/.test(l)) ?? r.signal}`);
  const m = bigPageOf(r.out);
  assert.equal(m.ok, true);
  assert.equal(m.pages, 3);
  assert.equal(m.first, "first page");
  assert.equal(m.last, "last page");
  assert.equal(m.said, lines, "every line of the page is in its text");
  assert.deepEqual(m.marked, [], "nothing on the pages is stated unread");
}

test("R41, R22: one 40 MiB page of text among light ones is read whole in a 128 MB heap, and says what it says", async () => {
  await readsBigPage(40);
});
test("R41, R22: one 60 MiB page of text among light ones is read whole in a 128 MB heap, and says what it says", async () => {
  await readsBigPage(60);
});
