/* plane's migrate-released suite, its child runner (bio-plane/test/system/migrate-released.test.mjs starts up to four, side by side):
     node --import ./bio-plane/test/platform-sqlite.mjs bio-plane/test/m/plane/migrate-released-runner.mjs <input.json> <output.json>
   `input.json` names the committed stores this child boots the current plane on and the fresh reference's shape; the child runs the
   kit's `verifyCurrent` on a copy of each, in turn, and writes every check it recorded to `output.json`, store by store, for the suite to
   print. It asserts nothing itself. A plane's boot is prepared on its process's main thread, so stores in separate processes boot in
   parallel where stores in one process would wait for each other. Not product code. */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slug, storeCopy, verifyCurrent } from "./migrate-released-kit.mjs";

const [input, output] = process.argv.slice(2);
const { fixtures, fresh } = JSON.parse(readFileSync(input, "utf8"));
const FRESH = JSON.parse(readFileSync(fresh, "utf8"));
const seeded = ({ doc, served, group_before, rows }) => ({ DOC: doc, served, groupBefore: group_before, rows });
const out = [];
for (const { label, dir, cap } of fixtures) {
  const checks = [];
  try {
    const persist = await storeCopy(join(dir, "store"), mkdtempSync(join(tmpdir(), `rec143-${slug(label)}-`)));
    await verifyCurrent(label, persist, seeded(cap), (l, got, want) => checks.push([l, got, want]), FRESH);
  } catch (e) { checks.push([`${label}: the store's run ends without throwing`, String((e && e.stack) || e).slice(0, 600), null]); }
  out.push({ label, checks });
}
writeFileSync(output, JSON.stringify(out));
process.exit(0);
