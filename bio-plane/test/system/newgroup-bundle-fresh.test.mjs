/* installer R86, R82, R33: the installer's bundle is built from the checkout, never committed.
 *
 * `newgroup/dist/` holds no committed file but its `.gitignore`, which ignores everything else there; the bundle
 * `newgroup/dist/newgroup.bundled.mjs` (what `newgroup/DEPLOY.md`'s manual path pastes) is written there by
 * `newgroup/scripts/build.mjs` whenever it is needed. What was once a comparison with a committed copy is now: the build is the
 * script `npm run build` runs; two builds of one checkout give the same bytes; the bundle embeds the release `src/release.mjs`
 * carries (R33's packed form, expanded and hashed); and it holds no byte over 0x7F (R82). `src/release.mjs` stays committed.
 */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import * as esbuild from "esbuild";
import { asciiOptions } from "../../scripts/fleet-bundle.mjs";

const NG = fileURLToPath(new URL("../../../newgroup/", import.meta.url));
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  want ${JSON.stringify(want)} got ${JSON.stringify(got)}`}`);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
/* The packed release (installer R33: the signed bytes gzipped, as base64) hashed as the bytes it holds once expanded. */
const shaPacked = (s) => createHash("sha256").update(gunzipSync(Buffer.from(s ?? "", "base64"))).digest("hex");
/* The literal `NAME = "…"` (`NAME="…"` once minified) evaluated, found by scanning its escapes (the esbuild output re-quotes it). */
const literal = (src, name) => {
  const at = src.match(new RegExp("\\b" + name + " ?= ?"));
  if (!at) return null;
  let j = at.index + at[0].length; const q = src[j]; let k = j + 1;
  while (k < src.length) { if (src[k] === "\\") { k += 2; continue; } if (src[k] === q) break; k++; }
  return vm.runInNewContext(src.slice(j, k + 1));
};

console.log("\n--- installer R86: newgroup/dist/ holds only its .gitignore; the bundle is built from the checkout ---");
t("R86: newgroup/dist/.gitignore ignores everything in the folder but itself",
  readFileSync(NG + "dist/.gitignore", "utf8").split("\n").filter(Boolean), ["*", "!.gitignore"]);
t("R86: the only file committed under newgroup/dist/ is its .gitignore",
  execFileSync("git", ["ls-files", "--", "dist"], { cwd: NG, encoding: "utf8" }).split("\n").filter(Boolean), ["dist/.gitignore"]);

/* The build is READ from newgroup/package.json, never restated here: `npm run build` embeds the release and then runs
   `scripts/build.mjs`, whose `bundleText` is what this builds with. */
const buildLine = JSON.parse(readFileSync(NG + "package.json", "utf8")).scripts.build;
const { bundleText, bundleOptions } = await import(NG + "scripts/build.mjs");
const options = await bundleOptions();
t("R86: the build is scripts/build.mjs, writing dist/newgroup.bundled.mjs (bundle, esm, neutral)",
  [/node scripts\/build\.mjs/.test(buildLine), options.bundle, options.format, options.platform, options.outfile],
  [true, true, "esm", "neutral", "dist/newgroup.bundled.mjs"]);
t("R82: the build carries bundler's ASCII options and nothing of its own beside them",
  Object.keys(asciiOptions()).map((k) => JSON.stringify(options[k]) === JSON.stringify(asciiOptions()[k])), Object.keys(asciiOptions()).map(() => true));

const first = await bundleText(esbuild);
const second = await bundleText(esbuild);
/* N1254: the test closes what it opens (esbuild's service holds the suite's stdout pipe). */
await esbuild.stop();
t("R86: two builds of one checkout give the same bytes", sha(second), sha(first));
t("R82: the built bundle holds no byte over 0x7F", Buffer.from(first, "latin1").filter((b) => b > 0x7f).length, 0);

const releaseSrc = readFileSync(NG + "src/release.mjs", "utf8");
t("R33: the bundle embeds the RELEASE_VERSION src/release.mjs carries", literal(first, "RELEASE_VERSION"), literal(releaseSrc, "RELEASE_VERSION"));
t("R33: the bundle's RELEASE_PACKED expands to the release src/release.mjs carries (by sha256)",
  shaPacked(literal(first, "RELEASE_PACKED")), shaPacked(literal(releaseSrc, "RELEASE_PACKED")));

console.log(`\nnewgroup-bundle-fresh: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
