/* Writes `fixtures/r38-answers.json`: the parse of the policy and the regulation type on every fixture reading, whether
 * or not the type recognises it, and on the three large texts (./r38-texts.mjs), as digests, taken on the tranche tip
 * before R38 held the lines of those parses as offsets (doctypes R38). Run once, on that tip:
 *   node doctypes/test/make-r38-answers.mjs
 * The file is the record the bounded parses must reproduce; it is not regenerated afterwards. */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parsesOf } from "./r38-readings.mjs";
import { fixtureReadings } from "./r37-readings.mjs";
import { KINDS } from "./r38-texts.mjs";
/** @import { Parses } from "./r38-readings.mjs" */

/**
 * What a child of `r38-child.mjs` prints last in its `digest` mode.
 * @typedef {{ digest: string }} ChildDigest
 */

/** @type {{ note: string, taken_at: string, readings: { [id: string]: Parses }, large: { [kind: string]: string } }} */
const out = { note: "the parse of the policy and the regulation type on every fixture reading, and on the large texts, as digests, before R38 (doctypes R38)",
              taken_at: "2026-10-22", readings: {}, large: {} };
for (const r of fixtureReadings()) out.readings[r.id] = parsesOf(r);
const child = fileURLToPath(new URL("./r38-child.mjs", import.meta.url));
for (const kind of KINDS) {
  const r = spawnSync(process.execPath, ["--expose-gc", "--max-old-space-size=4096", child, "digest", kind], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${kind}: ${r.stderr.slice(-300)}`);
  out.large[kind] = /** @type {ChildDigest} decodes what the module's own child printed */ (JSON.parse(String(r.stdout.trim().split("\n").pop()))).digest;
}
fs.writeFileSync(new URL("./fixtures/r38-answers.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out.readings).length} readings, ${Object.keys(out.large).length} large texts`);
