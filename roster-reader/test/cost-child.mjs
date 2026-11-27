/* Run as a child of cost.test.mjs under a 2 MB semi-space and --trace-gc: builds a budget volume's text of the size
 * given, warms both detectors on a small one, then runs each on the large one between BEGIN/END marks (the parent
 * counts the collections between them) and prints each answer and its time on a line `ANSWER <type> <match> <ms>`. */
import { staffRoster, orgChart } from "../index.mjs";
import { FIRST } from "./fixtures.mjs";
import { budgetVolumeText } from "./shape-texts.mjs";
/** @import { DoctypeContext } from "../../docprofile/registry.mjs" */

const text = budgetVolumeText(Number(process.argv[2]));
/** @type {DoctypeContext} */
const small = { text: budgetVolumeText(65536), view: FIRST, locate: () => null };
for (const t of [staffRoster, orgChart]) t.detect(small);
/** @type {DoctypeContext} */
const ctx = { text, view: FIRST, locate: () => null };
for (const t of [staffRoster, orgChart]) {
  console.log(`BEGIN ${t.key}`);
  const t0 = performance.now();
  const r = t.detect(ctx);
  const ms = performance.now() - t0;
  console.log(`END ${t.key}`);
  console.log(`ANSWER ${t.key} ${r.match} ${ms}`);
}
