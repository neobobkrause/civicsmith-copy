/* pdf-worker's R43 (fix round 9, G139; K4835 (3)): the `test` script in package.json runs every `*.test.mjs` under
 * `test/` (the codec tests of image-codecs, under `test/codecs/`, included) and no file that is not there. The script's
 * file set is read as the script states it: `*` in a file name expands within its directory, as the shell expands it. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "./make-pdf.mjs";

const { t, finish } = runner("test-script");
const root = fileURLToPath(new URL("..", import.meta.url));

/** The `*.test.mjs` files under `dir`, as paths from the module's folder.
 *  @param {string} dir @returns {string[]} */
const found = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? found(`${dir}/${e.name}`) : /\.test\.mjs$/.test(e.name) ? [`${dir}/${e.name}`] : []);

/** @type {{ scripts: { test: string } }} this module's own package.json */
const pkg = /** @type {{ scripts: { test: string } }} */ (JSON.parse(readFileSync(join(root, "package.json"), "utf8")));
const script = pkg.scripts.test;
const words = script.split(/\s+&&\s+|\s+/).filter((w) => /\.test\.mjs$/.test(w));
/** @param {string} w @returns {string[]} */
const expand = (w) => {
  if (!w.includes("*")) return [w];
  const slash = w.lastIndexOf("/");
  const dir = w.slice(0, slash), re = new RegExp(`^${w.slice(slash + 1).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return readdirSync(join(root, dir)).filter((f) => re.test(f)).map((f) => `${dir}/${f}`);
};
const covered = new Set(words.flatMap(expand));
const onDisk = found("test");

t("R43 the script names test files", words.length > 0 && covered.size > 0, true);
t("R43 every *.test.mjs under test/ is run by npm test", onDisk.filter((f) => !covered.has(f)), []);
t("R43 npm test names no test file that is not there", [...covered].filter((f) => !onDisk.includes(f)), []);
t("R43 the codec tests are among them", onDisk.filter((f) => f.startsWith("test/codecs/")).length > 0 && onDisk.filter((f) => f.startsWith("test/codecs/")).every((f) => covered.has(f)), true);
finish();
