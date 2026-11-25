/* The op-declaration helper, its collector and the registration call (test-support R15, R16, R17; K4168, K4189, K4240).
 *
 * Test tooling: only tests import it, never product code, because `declaredOpsOf`
 * imports later modules' files by path (P4). It performs no side effect on import. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = /\.(mjs|js)$/;
const EXPORT_LINE = /^export const DECLARED_OPS\b/m;

/** A `Response` read as `{status, ...body}`; any other answer as it is. */
async function normalize(answer) {
  if (!answer || typeof answer.json !== "function" || typeof answer.status !== "number") return answer;
  const text = await answer.clone().text();
  let body;
  try { body = JSON.parse(text); } catch { body = { body: text }; }
  return { status: answer.status, ...(body && typeof body === "object" ? body : { body }) };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The default way to tell a refusal that names a field: the answer's `code` or `detail` has it as a whole word. */
function defaultRefusedNaming(answer, field) {
  if (!answer || typeof answer !== "object") return false;
  const text = [answer.code, answer.detail].map((v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  return new RegExp(`(^|[^\\w])${escapeRegExp(field)}($|[^\\w])`).test(text);
}

const asList = (entry) => (Array.isArray(entry) ? entry : [entry]);

/** Holds `declaration` (one `DECLARED_OPS[op]`) true against the op that `call(fields)` runs as the door runs it.
 *  Rejects with an Error naming the op and the field at the first breach. */
export async function declaredOpHolds({ op, declaration, call, refusedNaming = defaultRefusedNaming, values = {}, outside, same }) {
  const accepts = declaration?.fields?.accepts;
  const requires = declaration?.fields?.requires;
  if (!Array.isArray(accepts) || !Array.isArray(requires)) {
    throw new Error(`declared op "${op}": the declaration has no fields.accepts and fields.requires arrays`);
  }
  const sample = (field) => (field in values ? values[field] : `sample-${field}`);
  const run = async (fields) => normalize(await call(fields));
  const names = (fields) => fields.map((f) => [f, sample(f)]);
  const refuses = async (answer, field) => (await refusedNaming(answer, field)) === true;
  const equal = same ?? ((x, y) => JSON.stringify(x) === JSON.stringify(y));

  const base = Object.fromEntries(names(requires.map((r) => asList(r)[0])));
  const declared = [...new Set([...accepts, ...requires.flatMap(asList)])];

  // (a) only the requires satisfied: no refusal names a declared field
  const baseAnswer = await run(base);
  for (const field of declared) {
    if (await refuses(baseAnswer, field)) throw new Error(`declared op "${op}", field "${field}": refused naming it although every required field was given`);
  }

  // (b) without each required entry: a refusal names it
  for (const entry of requires) {
    const alts = asList(entry);
    const fields = Object.fromEntries(Object.entries(base).filter(([k]) => !alts.includes(k)));
    const answer = await run(fields);
    let named = false;
    for (const alt of alts) named = named || await refuses(answer, alt);
    if (!named) throw new Error(`declared op "${op}", field "${alts.join(" | ")}": required, but the op did not refuse a call without it naming it`);
  }

  // (c) a field outside accepts: the op drops it (same answer) or refuses naming it
  const known = new Set(declared);
  const probes = outside ?? [`undeclared_field_${op}`];
  for (const field of probes) {
    if (known.has(field)) throw new Error(`declared op "${op}", field "${field}": probed as outside the declaration but the declaration names it`);
    const answer = await run({ ...base, [field]: sample(field) });
    if (equal(answer, baseAnswer) || await refuses(answer, field)) continue;
    throw new Error(`declared op "${op}", field "${field}": not declared, yet the op neither dropped it nor refused it naming it`);
  }
}

/** Every source file under a module path: the file itself, or a directory's files read recursively. */
function filesOf(root, path) {
  const full = join(root, path);
  let st;
  try { st = statSync(full); } catch { return []; }
  if (st.isFile()) return SOURCE.test(path) ? [full] : [];
  const out = [];
  for (const name of readdirSync(full).sort()) {
    if (name === "node_modules") continue;
    out.push(...filesOf(root, join(path, name)));
  }
  return out;
}

/** Every module's `DECLARED_OPS` found from `build/modules.json` under `root`, as `[owner, DECLARED_OPS]` pairs in
 *  `modules.json` order: the one collector that `declaredOpsOf` and `registerDeclared` both read through. */
async function pairsOf(root) {
  const { modules } = JSON.parse(readFileSync(join(root, "build", "modules.json"), "utf8"));
  const pairs = [];
  for (const mod of modules) {
    for (const path of mod.paths ?? []) {
      for (const file of filesOf(root, path)) {
        if (!EXPORT_LINE.test(readFileSync(file, "utf8"))) continue;
        const { DECLARED_OPS } = await import(pathToFileURL(file).href);
        if (!DECLARED_OPS || typeof DECLARED_OPS !== "object") throw new Error(`${file}: has a DECLARED_OPS export line but exports no object DECLARED_OPS`);
        pairs.push([mod.id, DECLARED_OPS]);
      }
    }
  }
  return pairs;
}

/** The declarations of every module, found from `build/modules.json` under `root` with no module listed by hand.
 *  → `{ops, owners, duplicates}`. */
export async function declaredOpsOf(root) {
  const ops = {}, owners = {}, who = {};
  for (const [owner, DECLARED_OPS] of await pairsOf(root)) {
    for (const [op, declaration] of Object.entries(DECLARED_OPS)) {
      (who[op] ??= []).push(owner);
      if (!(op in ops)) { ops[op] = declaration; owners[op] = owner; }
    }
  }
  const duplicates = Object.entries(who).filter(([, ids]) => ids.length > 1).map(([op, ids]) => ({ op, owners: ids }));
  return { ops, owners, duplicates };
}

/** The registrations this process has already called (R17): a registration is called once, whichever call names it. */
const called = new WeakSet();

/** Calls each registration function given (e.g. a module's `registerDeclaredOps`) once per process with every owner's
 *  declaration as `[owner, DECLARED_OPS]` pairs (the pairs `declaredOpsOf` reads). A registration already called is
 *  skipped; a registration's own refusal propagates and names what it refused. Test tooling: only tests call it. */
export async function registerDeclared(root, ...registrations) {
  const todo = [...new Set(registrations)].filter((registration) => !called.has(registration));
  if (todo.length === 0) return;
  const pairs = await pairsOf(root);
  for (const registration of todo) {
    called.add(registration);
    await registration(pairs);
  }
}
