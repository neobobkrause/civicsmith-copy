/* pdf-worker's R45: `dist/` holds no committed file but a `.gitignore` that ignores everything else in it; the bundle and
 * its manifest are built there by `scripts/build.mjs` whenever needed, and this module's tests that read a bundle build
 * it first (`subject.mjs`). */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "./make-pdf.mjs";

const { t, finish } = runner("built-files");
const root = fileURLToPath(new URL("..", import.meta.url));

/** git, run in this module's folder, its output as text.
 *  @param {string[]} args @returns {string} */
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

/** The `.gitignore`'s rules: its lines that are neither blank nor a comment.
 *  @type {string[]} */
const rules = readFileSync(join(root, "dist/.gitignore"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
t("R45 dist/.gitignore ignores everything in dist/ but itself", rules, ["*", "!.gitignore"]);
t("R45 dist/ holds no committed file but its .gitignore", git(["ls-files", "--", "dist"]).split("\n").filter(Boolean), ["dist/.gitignore"]);

execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { cwd: root, stdio: "ignore" });
const bundle = readFileSync(join(root, "dist/pdf-worker.bundled.mjs"));
/** @type {{ artifact: string, sha256: string, bytes: number }} the manifest `scripts/build.mjs` writes, as far as read here */
const manifest = /** @type {{ artifact: string, sha256: string, bytes: number }} */ (JSON.parse(readFileSync(join(root, "dist/pdf-worker.bundle.json"), "utf8")));
t("R45 scripts/build.mjs builds the bundle in dist/ and its manifest states it",
  { artifact: manifest.artifact, sha256: manifest.sha256, bytes: manifest.bytes },
  { artifact: "dist/pdf-worker.bundled.mjs", sha256: createHash("sha256").update(bundle).digest("hex"), bytes: bundle.length });
t("R45 the built bundle and manifest are ignored, never committed",
  git(["check-ignore", "--", "dist/pdf-worker.bundled.mjs", "dist/pdf-worker.bundle.json"]).split("\n").filter(Boolean),
  ["dist/pdf-worker.bundled.mjs", "dist/pdf-worker.bundle.json"]);
finish();
