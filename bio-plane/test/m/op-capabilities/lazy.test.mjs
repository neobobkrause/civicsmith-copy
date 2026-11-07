/* op-capabilities: built on the first call (R3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("R3: the table is built on the first call, never at evaluation — in a fresh process the import freezes no table of a hundred entries or more, the first call builds and freezes one, and every later call answers the same object and builds nothing", () => {
  const url = new URL("../../../src/op-capabilities/index.mjs", import.meta.url).href;
  const script = `
    const freeze = Object.freeze; let big = 0;
    Object.freeze = function (o) { try { if (o && typeof o === "object" && (Array.isArray(o) ? o.length : Object.keys(o).length) >= 100) big++; } catch {} return freeze.call(this, o); };
    const m = await import(${JSON.stringify(url)});
    const atImport = big;
    const first = m.needsRows(), afterFirst = big;
    const second = m.needsRows(), third = m.needsRows(), afterAll = big;
    process.stdout.write(JSON.stringify({ atImport, afterFirst, afterAll, same: first === second && second === third, n: Object.keys(first).length, frozen: Object.isFrozen(first) }));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.atImport, 0, "a large table is frozen when the module is evaluated");
  assert.equal(out.afterFirst, 1, "the first call builds one table");
  assert.equal(out.afterAll, out.afterFirst, "a later call builds again");
  assert.equal(out.same, true);
  assert.equal(out.n, 323 + 2, "the 323 rows of T49's opening and F1's two");
  assert.equal(out.frozen, true);
});

test("R3 (control): needsRows takes no argument and never throws, whatever it is given", () => {
  const script = `const m = await import(${JSON.stringify(new URL("../../../src/op-capabilities/index.mjs", import.meta.url).href)});
    const a = m.needsRows(undefined, null, {}, 42); process.stdout.write(String(a === m.needsRows()));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "true");
});
