/* load-check R7: its imports are its modules.json `uses` (op-declarations, runtime-limits, test-support) and never
 * journey-check; control: the copy's bundle (the plane's entry and all it imports) holds nothing of it. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLANE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ROOT = resolve(PLANE, "..");
const MODULES = JSON.parse(readFileSync(join(ROOT, "build/modules.json"), "utf8")).modules;
const SELF = "bio-plane/src/load-check/";

const SPEC = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;
const importsOf = (file) => [...readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(SPEC)].map((m) => m[1] ?? m[2] ?? m[3]);
const ownerOf = (rel) => (rel.startsWith(SELF) ? "load-check"
  : MODULES.find((m) => m.paths.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)))?.id ?? null);
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.m?js$/.test(n) ? [p] : []; });

test("R7 load-check's imports are op-declarations, runtime-limits and test-support only, never journey-check", () => {
  const self = MODULES.find((m) => m.id === "load-check");
  const allowed = new Set(["load-check", ...self.uses]);
  assert.deepEqual([...self.uses].sort(), ["op-declarations", "runtime-limits", "test-support"]);
  const seen = new Set();
  const src = files(join(PLANE, "src/load-check"));
  assert.ok(src.length >= 5);
  for (const f of src) {
    for (const spec of importsOf(f)) {
      if (spec.startsWith("node:")) continue;
      assert.ok(spec.startsWith("."), `${relative(ROOT, f)} imports a package: ${spec}`);
      const rel = relative(ROOT, resolve(dirname(f), spec)).split("\\").join("/");
      const owner = ownerOf(rel);
      assert.notEqual(owner, "journey-check", `${relative(ROOT, f)} imports journey-check`);
      assert.ok(allowed.has(owner), `${relative(ROOT, f)} imports ${rel} (${owner}), not in its uses`);
      seen.add(owner);
    }
  }
  for (const u of self.uses) assert.ok(seen.has(u), `uses ${u} but imports none of it`);
});

test("R7 control: the copy's bundle holds nothing of it, and no product module imports it", () => {
  const entry = JSON.parse(readFileSync(join(PLANE, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "")).main;
  const queue = [join(PLANE, entry)];
  const reached = new Set();
  while (queue.length) {
    const f = queue.pop();
    if (reached.has(f) || !existsSync(f)) continue;
    reached.add(f);
    for (const spec of importsOf(f)) if (spec.startsWith(".")) queue.push(resolve(dirname(f), spec));
  }
  assert.ok(reached.size > 50, `the bundle's graph was walked (${reached.size} files)`);
  const held = [...reached].map((f) => relative(ROOT, f).split("\\").join("/")).filter((r) => r.startsWith(SELF));
  assert.deepEqual(held, []);
  for (const f of files(join(PLANE, "src"))) {
    const rel = relative(ROOT, f).split("\\").join("/");
    if (rel.startsWith(SELF)) continue;
    for (const spec of importsOf(f)) {
      if (!spec.startsWith(".")) continue;
      assert.ok(!relative(ROOT, resolve(dirname(f), spec)).split("\\").join("/").startsWith(SELF), `${rel} imports load-check`);
    }
  }
});
