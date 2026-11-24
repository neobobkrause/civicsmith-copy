/* GATE: reads newgroup/src/index.mjs newgroup/src/ui.mjs newgroup/src/images.mjs newgroup/src/release.mjs newgroup/src/held.mjs newgroup/src/steps/*.mjs newgroup/src/words.mjs newgroup/scripts/build.mjs newgroup/dist/newgroup.bundled.mjs newgroup/package.json bio-plane/src/sshsig.mjs
 *
 * DIST-13 — THE INSTALLER'S COMMITTED BUNDLE IS FRESH, OR THE GATE SAYS WHICH WAY IT IS NOT.
 *
 * `newgroup/dist/newgroup.bundled.mjs` is what `newgroup/DEPLOY.md`'s manual path pastes into a group's dashboard. It is
 * built from `newgroup/src` by `npm run build` and COMMITTED, and nothing checked that it still equals its source: the
 * 0.72.0-0.78.0 cuts deployed the installer from `src/` through wrangler and never rebuilt it, so the committed bundle
 * embedded 0.71.0 while `src/release.mjs` carried the signed 0.78.0 (found by D-481's worker, 2026-09-24; re-cut at
 * cfe2d0cc). The re-cut then LAGGED DIST-9's installer code the moment DIST-9 landed after it — the second case a
 * version-only check cannot see, which is why this guard compares the WHOLE BUNDLE, FL-9's way (`verifyFresh` for the
 * fleet): the build is re-run from source in memory, with `newgroup/package.json`'s own `build` flags and the same
 * esbuild the lockfiles pin, and byte-compared to the committed artifact.
 *
 * Arms: (A) the bundle embeds the RELEASE_VERSION `src/release.mjs` carries; (B) its RELEASE_PACKED literal (the release's gzip as base64, R33), evaluated
 * and expanded, hashes equal to `src/release.mjs`'s RELEASE_PACKED expanded; (C) the WHOLE bundle is byte-identical to a fresh build of
 * `newgroup/src`. (C) implies (A) and (B); they are kept so a failure NAMES which kind of staleness it is.
 * The fix for any failure is one act: `cd newgroup && npm run build`, and commit the bundle.
 *
 * NEGATIVE CONTROL: RUN 2026-09-24 (DIST #6), declared before arming, each ALONE, the bundle restored by cp and verified
 * by sha256 AND cmp after each: (N1) THE ROW'S OWN — the 0.71.0 bundle restored (`git show f9736f5b:newgroup/dist/…`) ->
 * all three arms fail by name; (N2) THE LAG — the bundle as re-cut at cfe2d0cc (0.78.0, before DIST-9) -> (A) passes only
 * if the version agrees, and (C) fails by name. MEASURED (baseline 4/0): N1 -> 1 passed, 3 failed, (A) "0.71.0" vs "0.79.0",
 * (B) and (C) by name, as declared; N2, run with origin/main's bundle at 58293bf3 (0.79.0, built BEFORE DIST-11's
 * installer change) -> 3 passed, 1 failed, exactly (C), as declared: the version-only check reads that bundle as fresh.
 * Restored by cp, sha256 (b190fe6a…) and cmp.
 */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as esbuild from "esbuild";
import { asciiOptions } from "../../scripts/fleet-bundle.mjs";

const NG = fileURLToPath(new URL("../../../newgroup/", import.meta.url));
const DIST = NG + "dist/newgroup.bundled.mjs";
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  want ${JSON.stringify(want)} got ${JSON.stringify(got)}`}`);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
/* The packed release (newgroup R33: the signed bytes gzipped, as base64) hashed as the bytes it holds once expanded. */
const shaPacked = (s) => createHash("sha256").update(gunzipSync(Buffer.from(s ?? "", "base64"))).digest("hex");
/* The literal `NAME = "…"` or `NAME = '…'` (`NAME="…"` once the whitespace is minified, G39) evaluated, found by scanning its escapes (the esbuild output re-quotes it). */
const literal = (src, name) => {
  const at = src.match(new RegExp("\\b" + name + " ?= ?"));
  if (!at) return null;
  let j = at.index + at[0].length; const q = src[j]; let k = j + 1;
  while (k < src.length) { if (src[k] === "\\") { k += 2; continue; } if (src[k] === q) break; k++; }
  return vm.runInNewContext(src.slice(j, k + 1));
};

console.log("\n--- DIST-13: newgroup's committed bundle equals a fresh build of newgroup/src ---");
const committed = readFileSync(DIST, "utf8");
const releaseSrc = readFileSync(NG + "src/release.mjs", "utf8");
const want = { version: literal(releaseSrc, "RELEASE_VERSION"), source: shaPacked(literal(releaseSrc, "RELEASE_PACKED")) };

/* The build is READ from newgroup/package.json, never restated here: `npm run build` embeds the release and then runs
   `scripts/build.mjs`, which holds the esbuild options (T50, R72: the same bundle as a plain esbuild one, with `setup-words`' rows
   cut to the keys the installer reads). The guard builds with that script's own `bundleText`, so it cannot drift from the build. */
const buildLine = JSON.parse(readFileSync(NG + "package.json", "utf8")).scripts.build;
const { bundleText, bundleOptions } = await import(NG + "scripts/build.mjs");
const options = await bundleOptions();
t("PIN: newgroup's build is the script this guard mirrors (scripts/build.mjs: bundle, esm, neutral, dist/newgroup.bundled.mjs)",
  [/node scripts\/build\.mjs/.test(buildLine), options.bundle, options.format, options.platform, options.outfile],
  [true, true, "esm", "neutral", "dist/newgroup.bundled.mjs"]);
/* G39 (installer R82): the build carries bundler's ASCII recipe, and the committed bundle is pure ASCII (V8 holds a script's source two
   bytes a character once one character is above U+00FF). */
t("PIN: the build carries bundler's ASCII options (R2) and nothing of its own beside them",
  Object.keys(asciiOptions()).map((k) => JSON.stringify(options[k]) === JSON.stringify(asciiOptions()[k])), Object.keys(asciiOptions()).map(() => true));
t("(D) the committed bundle holds no byte over 0x7F", readFileSync(DIST).filter((b) => b > 0x7f).length, 0);

t("(A) the bundle embeds the RELEASE_VERSION src/release.mjs carries",
  literal(committed, "RELEASE_VERSION"), want.version);
t("(B) the bundle's RELEASE_PACKED expands to the release src/release.mjs carries (by sha256)",
  shaPacked(literal(committed, "RELEASE_PACKED")), want.source);

const fresh = await bundleText(esbuild);
/* N1254: the test closes what it opens. esbuild's service is a child process that holds the suite's stdout pipe: left running it
   keeps a reader of that pipe (a runner, `| tail`) waiting for an end that never comes, though the suite itself has finished. */
await esbuild.stop();
t("(C) the WHOLE committed bundle is byte-identical to a fresh build of newgroup/src (catches installer code the bundle lags)",
  { bytes: committed.length, sha256: sha(committed) }, { bytes: fresh.length, sha256: sha(fresh) });

console.log(`\nnewgroup-bundle-fresh: ${pass} passed, ${fail} failed`);
if (fail) console.log("  FIX: cd newgroup && npm run build, then commit newgroup/dist/newgroup.bundled.mjs");
process.exit(fail ? 1 : 0);
