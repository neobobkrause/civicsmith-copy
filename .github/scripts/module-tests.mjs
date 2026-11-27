// Every module's own tests, read from build/modules.json (P11; K1688).
import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const m = JSON.parse(readFileSync("build/modules.json", "utf8"));
const mods = Array.isArray(m) ? m : m.modules;
/**
 * The test files at a module's test path: the file itself, or a directory's, read recursively.
 * @param {string} p
 * @returns {string[]}
 */
const files = (p) => {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return p.endsWith(".test.mjs") || p.endsWith(".test.js") ? [p] : [];
  return readdirSync(p, { recursive: true }).map(String).filter((f) => /\.test\.m?js$/.test(f) && !f.includes("node_modules")).map((f) => join(p, f));
};
// The platform's SQLite limits in every test process: a bound value or row over 2,098,176 B is refused (test-support; G41, K4666).
const preload = resolve("bio-plane/test/platform-sqlite.mjs");
/** @type {string[]} */
const failed = [];
for (const mod of mods) {
  const list = [...new Set((mod.tests || []).flatMap(files))].sort();
  if (!list.length) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--import", preload, "--test", ...list], { encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = out.match(/^ℹ pass (\d+)/m)?.[1] ?? "?", fail = out.match(/^ℹ fail (\d+)/m)?.[1] ?? "?";
  console.log(`${mod.id}: pass ${pass} fail ${fail} (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (r.status !== 0) { failed.push(mod.id); for (const l of out.split("\n")) if (/^✖ /.test(l)) console.log("  " + l); }
}
console.log(failed.length ? `modules failing: ${failed.join(" ")}` : "every module's tests passed");
process.exit(failed.length ? 1 : 0);
