/* R37's measurements, each in a process of its own so its memory is its alone. Run by bounded.test.mjs as
 *   node [--expose-gc --max-old-space-size=N --max-semi-space-size=2] r37-child.mjs <mode> [file]
 *   base       the heap before any work, with the synthetic text held (what the caller holds): {baseMB}
 *   types      every type's detect, and the parse of those that read a text line by line, over the synthetic text
 *   answer     docprofile's readText over a PDF's reading, every type registered: its answer as textAnswerOf gives it
 *   dump       a PDF's reading (pdf-reader) written to <out>.json for `readbase` and `read`
 *   readbase   the heap with a dumped reading held: {baseMB}
 *   read       docprofile's readText over a dumped reading, every type registered */
import { readFileSync, writeFileSync } from "node:fs";
import { DOCTYPES, registerDoctypes } from "../index.mjs";
import { readText } from "../../docprofile/readtext.mjs";
import { registerDoctype } from "../../docprofile/doctypes/registry.mjs";
import { textAnswerOf, parseWith } from "./r37-readings.mjs";
/** @import { PartialView, SuppliedText } from "../../docprofile/doctypes/index.mjs" */

/**
 * A PDF's reading as `dump` writes it and `readbase` and `read` read it back: the module's own file.
 * @typedef {SuppliedText} DumpedReading
 */

const [mode, file, out] = process.argv.slice(2);
/** A path this program was handed; Node's own refusal where none was.
 *  @param {string | undefined} p @returns {string} @throws {TypeError} where none was handed */
const pathOf = (p) => {
  if (p === undefined) throw new TypeError('The "path" argument must be of type string or an instance of Buffer or URL. Received undefined');
  return p;
};
/** The heap in use, in MB. @returns {number} */
const mb = () => process.memoryUsage().heapUsed / 1048576;
/** Two full collections, where the process may ask for them. @returns {void} */
const settle = () => { if (global.gc) { global.gc(); global.gc(); } };

/* About 14 million characters of budget-book lines with the phrases the types look for scattered through them. */
/** @returns {string} */
function synthetic() {
  /** @type {string[]} */
  const block = [];
  for (let i = 0; i < 400; i++) {
    block.push(`Appropriations for program ${i} of the fiscal year are set out in the table below  1,234  5,678  9,012`);
    if (i % 40 === 0) block.push("Subject: a matter before the body", "Recommendation: that the body receive the report");
    if (i % 57 === 0) block.push("WHEREAS the Council finds that the matter is within its power;");
    if (i % 90 === 0) block.push("Page " + i, "   ", "A motion was made by A, seconded by B, that this matter be Accepted. The motion carried by the following vote:");
  }
  const unit = block.join("\n") + "\n";
  /** @type {string[]} */
  const parts = [];
  let n = 0;
  while (n < 14_000_000) { parts.push(unit); n += unit.length; }
  return parts.join("");
}

if (mode === "base") {
  const text = synthetic();
  settle();
  console.log(JSON.stringify({ baseMB: mb(), chars: text.length }));
} else if (mode === "types") {
  const text = synthetic();
  settle();
  /** @type {PartialView} */
  const view = {};
  for (const t of DOCTYPES) {
    t.detect({ text, view });
    if (["meeting_minutes", "meeting_agenda", "staff_report", "staff_directory"].includes(t.key)) parseWith(t, { text, view, locate: () => null, alsoSatisfies: () => [] });
  }
  console.log(JSON.stringify({ ok: true, chars: text.length }));
} else if (mode === "answer") {
  const { extractPdfStructure } = await import("../../bio-plane/src/pdfstructure.mjs");
  const r = await extractPdfStructure(new Uint8Array(readFileSync(pathOf(file))));
  registerDoctypes(registerDoctype);
  console.log(JSON.stringify(textAnswerOf(readText("text" in r ? r.text : undefined))));
} else if (mode === "dump") {
  const { extractPdfStructure } = await import("../../bio-plane/src/pdfstructure.mjs");
  const r = await extractPdfStructure(new Uint8Array(readFileSync(pathOf(file))));
  if (!r.ok) throw new TypeError("Cannot read properties of undefined (reading 'document')");
  writeFileSync(pathOf(out), JSON.stringify({ document: r.text.document, pages: r.text.pages.map((p) => ({ page: p.page, text: p.text })),
                                      counts: r.text.counts, undetermined: r.text.undetermined }));
} else if (mode === "readbase" || mode === "read") {
  const supplied = /** @type {DumpedReading} decodes the reading this program dumped */ (JSON.parse(readFileSync(pathOf(file), "utf8")));
  registerDoctypes(registerDoctype);
  settle();
  if (mode === "readbase") console.log(JSON.stringify({ baseMB: mb() }));
  else console.log(JSON.stringify(textAnswerOf(readText(supplied))));
}
