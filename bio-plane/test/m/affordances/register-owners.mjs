/* The owners' declarations this module's tests register with op-grades before any table is read (op-grades R49; K4168,
   K4225, K5159). Every owner that exports a `DECLARED_OPS` is registered, found from `build/modules.json` with no module
   listed by hand, as the plane registers them at start-up, so an op an owner declares (case-inputs' `casedetailsset`,
   case-import's `rerunstart`, contradiction's `contradictionflag`, and every other owner's) is graded and never unseen. Each
   owner's rows are read from the owner (K3268), never listed here. The search is kept here, not in test-support's collector,
   because this module uses nothing outside its own layer order (P4). Import this file before `affordances.mjs`: registration
   is refused once any table has been read, and happens once per process, at this file's evaluation. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerDeclaredOps } from "../../../src/op-grades/index.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const { modules } = JSON.parse(readFileSync(join(ROOT, "build", "modules.json"), "utf8"));

const filesOf = (path) => {
  const abs = join(ROOT, path);
  if (!statSync(abs).isDirectory()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).filter((e) => e.name !== "node_modules")
    .flatMap((e) => (e.isDirectory() ? filesOf(join(path, e.name)) : /\.(mjs|js)$/.test(e.name) ? [join(abs, e.name)] : []));
};

const owners = {};
const duplicates = [];
for (const mod of modules) for (const path of mod.paths ?? []) for (const file of filesOf(path)) {
  if (!/^export const DECLARED_OPS\b/m.test(readFileSync(file, "utf8"))) continue;
  for (const [op, row] of Object.entries((await import(pathToFileURL(file).href)).DECLARED_OPS)) {
    if (op in owners) duplicates.push(`${op} (${owners[op].id}, ${mod.id})`);
    else owners[op] = { id: mod.id, row };
  }
}
if (duplicates.length) throw new Error(`an op declared by two owners: ${duplicates.join("; ")}`);

/** The declarations registered, `{owner: {op: row}}`. */
export const REGISTERED = {};
for (const [op, { id, row }] of Object.entries(owners)) (REGISTERED[id] ??= {})[op] = row;
registerDeclaredOps(REGISTERED);
