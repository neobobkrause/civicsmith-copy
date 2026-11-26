/* The op-declaration helper, its collector and the registration call (test-support R15, R16, R17; K4168, K4189, K4240).
 *
 * Test tooling: only tests import it, never product code, because `declaredOpsOf`
 * imports later modules' files by path (P4). It performs no side effect on import. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = /\.(mjs|js)$/;
const EXPORT_LINE = /^export const DECLARED_OPS\b/m;

/**
 * One op's declaration, as this file reads it: the fields it accepts, and those it requires (an entry that is a list
 * is a choice: any one of them).
 * @typedef {Object} OpDeclaration
 * @property {{accepts?: string[], requires?: (string | string[])[]}} [fields]
 */
/** @typedef {{[op: string]: OpDeclaration}} DeclaredOps one module's `DECLARED_OPS` */
/** @typedef {[string, DeclaredOps]} DeclaredPair an owner's module id and its `DECLARED_OPS` */
/** @typedef {(pairs: DeclaredPair[]) => unknown} Registration a registration function; it may answer a promise */
/** @typedef {{[field: string]: unknown}} OpFields the fields one call sends */
/**
 * A `Response` as normalize reads it.
 * @typedef {Object} ResponseLike
 * @property {number} status
 * @property {() => ResponseLike} clone
 * @property {() => Promise<string>} text
 */

/**
 * Whether an answer is a `Response`: it has a `json` method and a numeric `status`.
 * @param {unknown} answer
 * @returns {answer is ResponseLike}
 */
function isResponse(answer) {
  /* A primitive has neither (`json` is no member of String, Number, Boolean, Symbol or BigInt). */
  if (!answer || (typeof answer !== "object" && typeof answer !== "function")) return false;
  /** @type {{json?: unknown, status?: unknown}} every object has these, perhaps undefined */
  const r = answer;
  return typeof r.json === "function" && typeof r.status === "number";
}

/**
 * A `Response` read as `{status, ...body}`; any other answer as it is.
 * @param {unknown} answer
 * @returns {Promise<unknown>}
 */
async function normalize(answer) {
  if (!isResponse(answer)) return answer;
  const text = await answer.clone().text();
  /** @type {unknown} */
  let body;
  try { body = JSON.parse(text); } catch { body = { body: text }; }
  const read = body;
  return { status: answer.status, ...(read && typeof read === "object" ? read : { body: read }) };
}

const escapeRegExp = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The default way to tell a refusal that names a field: the answer's `code` or `detail` has it as a whole word.
 * @param {unknown} answer
 * @param {string} field
 * @returns {boolean}
 */
function defaultRefusedNaming(answer, field) {
  if (!answer || typeof answer !== "object") return false;
  /** @type {{code?: unknown, detail?: unknown}} every object has these, perhaps undefined */
  const a = answer;
  const text = [a.code, a.detail].map((v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  return new RegExp(`(^|[^\\w])${escapeRegExp(field)}($|[^\\w])`).test(text);
}

/**
 * @param {string | string[]} entry
 * @returns {string[]}
 */
const asList = (entry) => (Array.isArray(entry) ? entry : [entry]);

/**
 * @typedef {Object} OpHoldsArgs
 * @property {string} op the op's name
 * @property {OpDeclaration | null} [declaration] one `DECLARED_OPS[op]`
 * @property {(fields: OpFields) => unknown} call runs the op as the door runs it; it may answer a promise
 * @property {(answer: unknown, field: string) => unknown} [refusedNaming] true (or a promise of true) when the answer
 *   is a refusal naming the field; absent is a `code` or `detail` that has it as a whole word
 * @property {OpFields} [values] the value to send for a field; absent is `sample-<field>`
 * @property {string[]} [outside] the fields probed as outside the declaration; absent is `undeclared_field_<op>`
 * @property {(x: unknown, y: unknown) => unknown} [same] whether two answers are the same; absent compares their JSON
 */
/** Holds `declaration` (one `DECLARED_OPS[op]`) true against the op that `call(fields)` runs as the door runs it.
 *  Rejects with an Error naming the op and the field at the first breach.
 * @param {OpHoldsArgs} args
 * @returns {Promise<void>}
 */
export async function declaredOpHolds({ op, declaration, call, refusedNaming = defaultRefusedNaming, values = {}, outside, same }) {
  const accepts = declaration?.fields?.accepts;
  const requires = declaration?.fields?.requires;
  if (!Array.isArray(accepts) || !Array.isArray(requires)) {
    throw new Error(`declared op "${op}": the declaration has no fields.accepts and fields.requires arrays`);
  }
  const sample = (/** @type {string} */ field) => (field in values ? values[field] : `sample-${field}`);
  const run = async (/** @type {OpFields} */ fields) => normalize(await call(fields));
  /**
   * @param {string[]} fields
   * @returns {[string, unknown][]}
   */
  const names = (fields) => fields.map((f) => [f, sample(f)]);
  const refuses = async (/** @type {unknown} */ answer, /** @type {string} */ field) => (await refusedNaming(answer, field)) === true;
  const equal = same ?? ((/** @type {unknown} */ x, /** @type {unknown} */ y) => JSON.stringify(x) === JSON.stringify(y));

  const base = Object.fromEntries(names(requires.map((r) => String(asList(r)[0]))));
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

/**
 * Every source file under a module path: the file itself, or a directory's files read recursively.
 * @param {string} root
 * @param {string} path
 * @returns {string[]}
 */
function filesOf(root, path) {
  const full = join(root, path);
  let st;
  try { st = statSync(full); } catch { return []; }
  if (st.isFile()) return SOURCE.test(path) ? [full] : [];
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(full).sort()) {
    if (name === "node_modules") continue;
    out.push(...filesOf(root, join(path, name)));
  }
  return out;
}

/** Every module's `DECLARED_OPS` found from `build/modules.json` under `root`, as `[owner, DECLARED_OPS]` pairs in
 *  `modules.json` order: the one collector that `declaredOpsOf` and `registerDeclared` both read through.
 * @param {string} root
 * @returns {Promise<DeclaredPair[]>}
 */
async function pairsOf(root) {
  const { modules } = JSON.parse(readFileSync(join(root, "build", "modules.json"), "utf8"));
  /** @type {DeclaredPair[]} */
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

/**
 * @typedef {Object} DeclaredOpsFound
 * @property {DeclaredOps} ops each op's declaration, the first owner's where several declare it
 * @property {{[op: string]: string}} owners each op's first owner
 * @property {{op: string, owners: string[]}[]} duplicates each op more than one module declares, with every owner
 */
/** The declarations of every module, found from `build/modules.json` under `root` with no module listed by hand.
 *  → `{ops, owners, duplicates}`.
 * @param {string} root
 * @returns {Promise<DeclaredOpsFound>}
 */
export async function declaredOpsOf(root) {
  /** @type {DeclaredOps} */
  const ops = {};
  /** @type {{[op: string]: string}} */
  const owners = {};
  /** @type {{[op: string]: string[]}} */
  const who = {};
  for (const [owner, DECLARED_OPS] of await pairsOf(root)) {
    for (const [op, declaration] of Object.entries(DECLARED_OPS)) {
      (who[op] ??= []).push(owner);
      if (!(op in ops)) { ops[op] = declaration; owners[op] = owner; }
    }
  }
  const duplicates = Object.entries(who).filter(([, ids]) => ids.length > 1).map(([op, ids]) => ({ op, owners: ids }));
  return { ops, owners, duplicates };
}

/** The registrations this process has already called (R17): a registration is called once, whichever call names it.
 * @type {WeakSet<Registration>} */
const called = new WeakSet();

/** Calls each registration function given (e.g. a module's `registerDeclaredOps`) once per process with every owner's
 *  declaration as `[owner, DECLARED_OPS]` pairs (the pairs `declaredOpsOf` reads). A registration already called is
 *  skipped; a registration's own refusal propagates and names what it refused. Test tooling: only tests call it.
 * @param {string} root
 * @param {...Registration} registrations
 * @returns {Promise<void>}
 */
export async function registerDeclared(root, ...registrations) {
  const todo = [...new Set(registrations)].filter((registration) => !called.has(registration));
  if (todo.length === 0) return;
  const pairs = await pairsOf(root);
  for (const registration of todo) {
    called.add(registration);
    await registration(pairs);
  }
}
