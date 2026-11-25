/* The op-declaration helper, its collector and the registration call (test-support R15, R16, R17; K4168, K4189, K4240).
 *
 * Test tooling: only tests import it, never product code, because `declaredOpsOf`
 * imports later modules' files by path (P4). It performs no side effect on import. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

/**
 * @typedef {Object} DeclaredOpHoldsArgs
 * @property {string} op the op's name
 * @property {any} declaration one `DECLARED_OPS[op]`: `{fields: {accepts, requires}}`
 * @property {(fields: Object) => any} call runs the op; a Response is read as `{status, ...body}`
 * @property {(answer: any, field: string) => any} [refusedNaming] whether an answer is a refusal naming the field
 * @property {Object} [values] a sample value per field name
 * @property {string[]} [outside] fields probed as outside the declaration
 * @property {(x: any, y: any) => boolean} [same] answer equality; default JSON equality
 */

/** Holds `declaration` (one `DECLARED_OPS[op]`) true against the op that `call(fields)` runs as the door runs it.
 *  Rejects with an Error naming the op and the field at the first breach.
 *  @param {DeclaredOpHoldsArgs} args the op, its declaration and how to call it
 *  @returns {Promise<void>}
 *  @throws {Error} when the declaration lacks fields.accepts and fields.requires arrays, or at a breach
 */
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

/** The `[owner, file]` pairs to read when the list is `build/modules.json` under `root`: every module's `paths`. */
function filesFromModulesJson(root) {
  const { modules } = JSON.parse(readFileSync(join(root, "build", "modules.json"), "utf8"));
  const out = [];
  for (const mod of modules) for (const path of mod.paths ?? []) for (const file of filesOf(root, path)) out.push([mod.id, file]);
  return out;
}

/** Whether a listed path names `rel` (a path relative to the root, `/`-separated): the file itself, or a folder holding it. */
const pathNames = (path, rel) => (path.endsWith("/") ? rel.startsWith(path) : rel === path);

/** The modules of `process/modules/order.txt` under `root`, in order; refuses an `upTo` the file does not list, naming it. */
function orderUpTo(root, upTo) {
  const order = readFileSync(join(root, "process", "modules", "order.txt"), "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!order.includes(upTo)) throw new Error(`declared ops up to "${upTo}": no module of that name is on process/modules/order.txt`);
  return order;
}

/** The `[owner, file]` pairs to read when the list is bounded (R16's `upTo`): the modules of `process/modules/order.txt`
 *  up to and including `upTo`, each from its entry's `files`. A file belongs to the module whose listed path (in any
 *  entry's `files` or `tests`) is the longest that names it, so a later module's file inside an earlier module's
 *  folder is never read. */
function filesUpTo(root, upTo) {
  const order = orderUpTo(root, upTo);
  const entries = order.map((name) => JSON.parse(readFileSync(join(root, "process", "modules", `${name}.json`), "utf8")));
  const claims = entries.flatMap((e) => [
    ...(e.files ?? []).map((path) => ({ path, owner: e.name, code: true })),
    ...(e.tests ?? []).map((path) => ({ path, owner: e.name, code: false })),
  ]);
  const ownerOf = (rel) => {
    let best = null;
    for (const c of claims) if (pathNames(c.path, rel) && (!best || c.path.length > best.path.length)) best = c;
    return best;
  };
  const out = [];
  const seen = new Set();
  for (const entry of entries.slice(0, order.indexOf(upTo) + 1)) {
    for (const path of entry.files ?? []) {
      for (const file of filesOf(root, path)) {
        const owner = ownerOf(relative(root, file).split(sep).join("/"));
        if (seen.has(file) || !owner || !owner.code || owner.owner !== entry.name) continue;
        seen.add(file);
        out.push([entry.name, file]);
      }
    }
  }
  return out;
}

/** Every module's `DECLARED_OPS` as `[owner, DECLARED_OPS]` pairs in list order: from `build/modules.json` under
 *  `root`, or, given `upTo`, from `process/modules/order.txt` up to that module. The one collector that
 *  `declaredOpsOf` and `registerDeclared` both read through. */
async function pairsOf(root, upTo) {
  const listed = upTo === undefined ? filesFromModulesJson(root) : filesUpTo(root, upTo);
  const pairs = [];
  for (const [owner, file] of listed) {
    if (!EXPORT_LINE.test(readFileSync(file, "utf8"))) continue;
    const { DECLARED_OPS } = await import(pathToFileURL(file).href);
    if (!DECLARED_OPS || typeof DECLARED_OPS !== "object") throw new Error(`${file}: has a DECLARED_OPS export line but exports no object DECLARED_OPS`);
    pairs.push([owner, DECLARED_OPS]);
  }
  return pairs;
}

/**
 * @typedef {Object} DeclaredOps
 * @property {Object} ops the declarations by op name (the first in modules.json order)
 * @property {Object} owners the module id of each op, by op name
 * @property {{op: string, owners: string[]}[]} duplicates every op declared by two or more modules
 */

/** The declarations of every module, found from `build/modules.json` under `root` with no module listed by hand;
 *  or, given `upTo`, of the modules of `process/modules/order.txt` up to and including that one, from each entry's
 *  `files`. → `{ops, owners, duplicates}`.
 *  @param {string} root the repository root
 *  @param {string} [upTo] the last module read, by its name on the order file; absent reads `build/modules.json`
 *  @returns {Promise<DeclaredOps>}
 *  @throws {Error} when a file has the export line but exports no object DECLARED_OPS, or `upTo` is not on the order file
 */
export async function declaredOpsOf(root, upTo) {
  const ops = {}, owners = {}, who = {};
  for (const [owner, DECLARED_OPS] of await pairsOf(root, upTo)) {
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
 *  declaration as `[owner, DECLARED_OPS]` pairs (the pairs `declaredOpsOf` reads). Called as
 *  `registerDeclared(root, upTo, ...registrations)`, with a module's name second, it reads as `declaredOpsOf(root, upTo)`.
 *  A registration already called is skipped; a registration's own refusal propagates and names what it refused, and
 *  the rest of that call's registrations are not called. Test tooling: only tests call it.
 *  @param {string} root the repository root
 *  @param {...(string | ((pairs: any[][]) => any))} rest an optional `upTo` module name, then the registration functions
 *  @returns {Promise<void>}
 *  @throws {Error} when a registration refuses, a file exports no object DECLARED_OPS, or `upTo` is not on the order file
 *  @throws {TypeError} when a registration is not a function
 */
export async function registerDeclared(root, ...rest) {
  const upTo = typeof rest[0] === "string" ? rest.shift() : undefined;
  /** @type {((pairs: any[][]) => any)[]} the registration functions, each checked below */
  const registrations = [];
  for (const registration of rest) {
    if (typeof registration !== "function") throw new TypeError(`registerDeclared: a registration must be a function, not ${typeof registration}`);
    registrations.push(registration);
  }
  if (upTo !== undefined) orderUpTo(root, upTo);
  const todo = [...new Set(registrations)].filter((registration) => !called.has(registration));
  if (todo.length === 0) return;
  const pairs = await pairsOf(root, upTo);
  for (const registration of todo) {
    called.add(registration);
    await registration(pairs);
  }
}
