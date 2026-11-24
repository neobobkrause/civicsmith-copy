/* affordances, R12 (K5159): the totality over the owners' op maps holds only if every owner's declared op reaches op-grades, so
   the registration `register-owners.mjs` makes is checked here against every module whose source exports a `DECLARED_OPS`,
   found from `build/modules.json` by its own search, not against a list. */
import "./register-owners.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REGISTERED } from "./register-owners.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const { modules } = JSON.parse(readFileSync(join(ROOT, "build", "modules.json"), "utf8"));

const sourcesOf = (path) => {
  const abs = join(ROOT, path);
  if (!statSync(abs).isDirectory()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).filter((e) => e.name !== "node_modules")
    .flatMap((e) => (e.isDirectory() ? sourcesOf(join(path, e.name)) : /\.(mjs|js)$/.test(e.name) ? [join(abs, e.name)] : []));
};

test("R12: every module that exports a DECLARED_OPS is registered, each with every op it declares and the row as the owner wrote it, so no declared op of any owner goes unseen (K5159)", async () => {
  const owners = {};
  for (const mod of modules) for (const path of mod.paths ?? []) for (const file of sourcesOf(path)) {
    if (!/^export const DECLARED_OPS\b/m.test(readFileSync(file, "utf8"))) continue;
    owners[mod.id] = { ...owners[mod.id], ...(await import(pathToFileURL(file).href)).DECLARED_OPS };
  }
  assert.ok(Object.keys(owners).length > 0, "no owner found");
  assert.deepEqual(Object.keys(REGISTERED).sort(), Object.keys(owners).sort(), "an owner that declares ops is not registered");
  for (const [owner, declared] of Object.entries(owners)) {
    assert.deepEqual(Object.keys(REGISTERED[owner]).sort(), Object.keys(declared).sort(), `${owner}: a declared op is not registered`);
    for (const [op, row] of Object.entries(declared)) assert.equal(REGISTERED[owner][op], row, `${op} (${owner}) is not registered with its owner's row`);
  }
});
