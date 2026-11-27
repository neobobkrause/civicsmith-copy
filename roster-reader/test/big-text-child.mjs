/* Run as a child of big-text.test.mjs under a small heap: builds the text of a large budget volume (about 20 MB,
 * 160,000 lines, no roster in it), holds it, and runs both detectors on it as docprofile's `doctypeFor` does.
 * An out-of-memory abort is the failure; the answers are printed as JSON. */
import { staffRoster, orgChart } from "../index.mjs";
import { FIRST } from "./fixtures.mjs";
/** @import { DoctypeContext } from "../../docprofile/registry.mjs" */

const BLOCKS = 4000, PER = 40;
/** @type {string[]} */
const block = [];
for (let n = 0; n < PER; n++) {
  block.push(n === 0 ? "Section 4.2 Appropriations by Fund and Department for the Fiscal Year"
    : n === 1 ? "Police Department   Public Works   General Purpose Fund   1,204"
    : n === 2 ? "Alameda County Superior Court   Oakland Unified School District"
    : `${n}  Personnel services, contract services and supplies for the fiscal year are budgeted at ${n * 7919 % 99991},${100 + n} dollars; see schedule ${n} of this volume for the detail of each line item.`);
}
const text = (block.join("\n") + "\n").repeat(BLOCKS);
const LINES = BLOCKS * PER;
/** @type {DoctypeContext} */
const ctx = { text, view: FIRST, locate: () => null };
/** @type {boolean[]} */
const answers = [];
for (const t of [staffRoster, orgChart]) answers.push(t.detect(ctx).match);
console.log(JSON.stringify({ chars: text.length, lines: LINES, answers }));
