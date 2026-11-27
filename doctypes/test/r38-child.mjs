/* R38's measurements, each in a process of its own so its memory is its alone. Run by bounded.test.mjs as
 *   node [--expose-gc --max-old-space-size=N --max-semi-space-size=2] r38-child.mjs <mode> <kind>
 *   base <kind>    the heap with the text of <kind> held (what the caller holds): {baseMB}
 *   parse <kind>   the parse of the type <kind> names over that text, after its detect has recognised it: {ok, digest}
 * <kind> is `policy`, `regulation` or `code`: a text of 13.6 million characters made of the fixtures' own documents
 * repeated, so the types meet their own headers, outlines, tables, definitions and exceptions at that size. */
import { DOCTYPES } from "../index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";
import { largeText, KINDS, TYPE_OF } from "./r38-texts.mjs";
import { HELD } from "./fixtures.mjs";
import { sha, parseWith } from "./r37-readings.mjs";
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */

const [mode, given] = process.argv.slice(2);
const kind = KINDS.find((k) => k === given);
if (!kind) throw new Error(`kind: ${given}`);
/** The heap in use, in MB. @returns {number} */
const mb = () => process.memoryUsage().heapUsed / 1048576;
/** Two full collections, where the process may ask for them. @returns {void} */
const settle = () => { if (global.gc) { global.gc(); global.gc(); } };

const text = largeText(kind);
settle();
if (mode === "base") {
  console.log(JSON.stringify({ baseMB: mb(), chars: text.length }));
} else if (mode === "parse") {
  const type = DOCTYPES.find((t) => t.key === TYPE_OF[kind]);
  if (!type) throw new TypeError("Cannot read properties of undefined (reading 'detect')");
  /** @type {DoctypeContext} */
  const ctx = { view: HELD, text };
  const d = type.detect(ctx);
  if (!d) throw new TypeError(`Cannot read properties of ${d} (reading 'match')`);
  if (!d.match) throw new Error(`${kind}: not recognised as ${type.key}: ${JSON.stringify(d)}`);
  const parsed = parseWith(type, { ...ctx, locate: (/** @type {unknown} */ o) => (typeof o === "number" ? { kind: "doc-para", ref: "test", para: o, run: null } : null), alsoSatisfies: () => [] });
  console.log(JSON.stringify({ ok: true, chars: text.length, digest: sha(parsed) }));
} else if (mode === "digest") {
  /* the same parse with no memory bound, for `make-r38-answers.mjs` */
  const type = DOCTYPES.find((t) => t.key === TYPE_OF[kind]);
  const parsed = parseWith(type, { view: HELD, text, locate: (/** @type {unknown} */ o) => (typeof o === "number" ? { kind: "doc-para", ref: "test", para: o, run: null } : null), alsoSatisfies: () => [] });
  console.log(JSON.stringify({ digest: sha(parsed) }));
}
