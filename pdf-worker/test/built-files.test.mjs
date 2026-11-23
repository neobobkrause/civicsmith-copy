/* pdf-worker's R45 (ARCH's decision "Committed built files", 22 Nov 2026): `dist/` holds no committed file but a
 * `.gitignore` that ignores everything else in it, and the bundle and its manifest are built there by
 * `scripts/build.mjs` whenever needed. Read from git's own index and by running the build script itself. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runner } from "./make-pdf.mjs";

const { t, finish } = runner("built-files");
const root = fileURLToPath(new URL("..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
/* `git check-ignore -q` exits 0 when the path is ignored, 1 when it is not. */
const ignored = (p) => { try { git("check-ignore", "-q", "--no-index", p); return true; } catch (e) { if (e.status === 1) return false; throw e; } };

console.log("\n--- R45: nothing built is committed ---");
{
  t("R45 the only committed file under dist/ is its .gitignore",
    git("ls-files", "--", "dist").split("\n").filter(Boolean), ["dist/.gitignore"]);
  t("R45 dist/.gitignore ignores the bundle, its manifest and any other file there",
    ["dist/pdf-worker.bundled.mjs", "dist/pdf-worker.bundle.json", "dist/anything-else.js"].map(ignored), [true, true, true]);
  t("R45 dist/.gitignore does not ignore itself", ignored("dist/.gitignore"), false);
}

console.log("\n--- R45: scripts/build.mjs builds the bundle and its manifest in dist/ ---");
{
  const BUNDLE = join(root, "dist/pdf-worker.bundled.mjs"), MANIFEST = join(root, "dist/pdf-worker.bundle.json");
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "pipe" });
  t("R45 the build wrote both files", [existsSync(BUNDLE), existsSync(MANIFEST)], [true, true]);
  const bytes = readFileSync(BUNDLE);
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  t("R45 the manifest describes the bundle built beside it",
    [manifest.member, manifest.artifact, manifest.bytes, manifest.sha256],
    ["pdf-worker", "dist/pdf-worker.bundled.mjs", bytes.length, createHash("sha256").update(bytes).digest("hex")]);
  const built = await import(pathToFileURL(BUNDLE).href);
  t("R45 the built bundle is the worker: it serves the declared surface",
    [typeof built.default?.fetch, built.SURFACE],
    ["function", { structure: { method: "POST", mutating: false }, version: { method: "GET", mutating: false } }]);
}

finish();
