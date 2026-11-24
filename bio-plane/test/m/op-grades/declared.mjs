/* op-grades' tests: the ops and codes of other modules, read from this module's own requirements or its own tables, never
   typed here (K3268, BOB K4069, K4076). This module uses nothing (P4): `op-declarations` merges after it, so no test imports
   a declaration of another module; what a requirement of this module states, in backticks or as plain words, is the
   contract, and the tables are the data under test. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

/* ---- this module's own requirements ------------------------------------------------------------------------------- */
const REQ_LINES = readFileSync(new URL("../../../../build/requirements/op-grades.md", import.meta.url), "utf8").split("\n");

/** Requirement R<n> as written: its line and its sub-bullets, to the next requirement or heading. */
export const reqText = (n) => {
  const from = REQ_LINES.findIndex((line) => line.startsWith(`- **R${n}**`));
  if (from < 0) throw new Error(`op-grades requirements: no R${n}`);
  let to = from + 1;
  while (to < REQ_LINES.length && !/^(- \*\*R\d+\*\*|#|\*\*[A-Z])/.test(REQ_LINES[to])) to++;
  return REQ_LINES.slice(from, to).join("\n");
};

/** The text between the first `from` and the next `to` (the end of the text when `to` is absent), `from` excluded. */
export const between = (text, from, to) => {
  const a = text.indexOf(from);
  if (a < 0) throw new Error(`no "${from}" in the requirement`);
  const rest = text.slice(a + from.length);
  const b = to === undefined ? -1 : rest.indexOf(to);
  return b < 0 ? rest : rest.slice(0, b);
};

const outsideParens = (text) => {
  let flat = "", depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (!depth) flat += ch;
  }
  return flat;
};

/** The ops a requirement text names in backticks outside parentheses (lower-case identifiers; codes and arms are other
    shapes), in order. */
export const ticked = (text) => [...outsideParens(text).matchAll(/`([a-z][a-z0-9]*)`/g)].map((m) => m[1]);

/** Every op a text names in backticks, parentheses included. */
export const tickedAll = (text) => [...text.matchAll(/`([a-z][a-z0-9]*)`/g)].map((m) => m[1]);

/** The codes a requirement text names in backticks (UPPER_CASE), in order. */
export const tickedCodes = (text) => [...text.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]);

/** The ops a requirement states as plain words (R1's first sentences: "reversible actionlaws, cite, ..., and (N364) x"):
    outside parentheses, each comma-, semicolon- or "and"-separated item that is a single lower-case word. */
export const worded = (text) => outsideParens(text).split(/[,;.]|\band\b/).map((item) => item.trim())
  .filter((item) => /^[a-z][a-z0-9]*$/.test(item));

/** The refusal codes named, in backticks, on the lines of the requirements that say they join `JUSTIFICATION_REFUSALS`
    (`own` are this module's exports, which are no codes). */
export const joinedCodes = (own) => [...new Set(REQ_LINES.filter((line) => line.includes("JUSTIFICATION_REFUSALS"))
  .flatMap(tickedCodes)
  .filter((c) => !Object.hasOwn(own, c) && !c.startsWith("MACHINE_CANNOT_") && c !== "ACTS" && !c.endsWith("_PATH")))];

/** R1's exclusions as a rule over a code, not a list of codes: a refusal that asks an object, an identifier, a choice, a
    form or a member (or is a machine's), and never the member's own account. */
export const asksNotTheAccount = (code) => /^(NO_(TARGET|IDS?|KIND|CITATION|BODY|TITLE|CANDIDATE|COUNSEL)|NO_SUCH_|NOT_(A_|AN_)|MACHINE_CANNOT_|ALREADY_|KNOCK_EMPTY|BAD_)|_(NO_LABEL|NO_STATEMENT|TOO_LONG|NOT_FOUND|NOT_IN_PLACE|NOT_OPEN|NOT_PAUSED|LINKED|MISMATCH|INVALID|UNCHANGED|TEXT_REFUSED|NAME_REFUSED|STEP_REFUSED|SCOPE_REFUSED|WHY_REFUSED|ENTRY_INVALID|KIND_UNKNOWN|SIGNATURE_REFUSED|ACT_REFUSED|VALUE_REFUSED)$/.test(code);

/* ---- this module's own tables ------------------------------------------------------------------------------------- */
/** The ops of a NON_ACTS table whose reason is a read's ("read: …"), in table order. */
export const readRows = (table) => Object.keys(table).filter((op) => table[op].startsWith("read: "));

/** The sentence an owner declared for `op` as `localize("<module>.declared.<op>", ...)`, read from the word table
 *  (`setup-words`, which this module uses) by its id, never copied here (P7, K3810). The id is composed, not typed: the
 *  words check judges a literal key against the design's list, and these ids are code-held until the design takes them. */
export const declaredSentence = (module, op) => word(`${module}.declared.${op}`);

/** The sentence an owner declared for `op` as its design key `act.<op>.does` (K4168: the owner's declaration is the truth, so
 *  a hand row holds this sentence and the test reads it from the word table, never from a copy). The id is composed. */
export const doesSentence = (op) => (hasWord(`act.${op}.does`) ? word(`act.${op}.does`) : null);

/* ---- the owners' declarations (R49, R50) ------------------------------------------------------------------------- */
/** Every module's `DECLARED_OPS`, found from `build/modules.json` with no module listed by hand, as `{ops, owners}` (an op's
 *  row, and the module that declares it); a module declaring an op twice is `duplicates`. This is the same search as
 *  test-support's `declaredOpsOf` (R16), kept here because this module uses nothing but `setup-words` (P4): only a test reads
 *  other modules' files, by path, and only to hand their rows to `registerDeclaredOps`. */
export async function collectDeclaredOps(root) {
  const { modules } = JSON.parse(readFileSync(join(root, "build", "modules.json"), "utf8"));
  const ops = {}, owners = {}, who = {};
  const filesOf = (path) => {
    const abs = join(root, path);
    if (!statSync(abs).isDirectory()) return [abs];
    return readdirSync(abs, { withFileTypes: true }).filter((e) => e.name !== "node_modules").flatMap((e) => (e.isDirectory() ? filesOf(join(path, e.name)) : /\.(mjs|js)$/.test(e.name) ? [join(abs, e.name)] : []));
  };
  for (const mod of modules) for (const path of mod.paths ?? []) for (const file of filesOf(path)) {
    if (!/^export const DECLARED_OPS\b/m.test(readFileSync(file, "utf8"))) continue;
    for (const [op, row] of Object.entries((await import(pathToFileURL(file).href)).DECLARED_OPS)) {
      (who[op] ??= []).push(mod.id);
      if (!(op in ops)) { ops[op] = row; owners[op] = mod.id; }
    }
  }
  return { ops, owners, duplicates: Object.entries(who).filter(([, ids]) => ids.length > 1).map(([op, ids]) => ({ op, owners: ids })) };
}

/* ---- the registered instance (R42, R46; B27) --------------------------------------------------------------------------- */
let registeredN = 0;
/** A fresh instance of this module with every owner's `DECLARED_OPS` registered (R49, R50), so the rungless acts are the acts
 *  no owner grades either: a grade an owner declares is read from the registered tables, never typed here. */
export async function registeredOpGrades() {
  const { ops, owners, duplicates } = await collectDeclaredOps(new URL("../../../../", import.meta.url).pathname);
  if (duplicates.length) throw new Error(`an op declared twice: ${JSON.stringify(duplicates)}`);
  const byOwner = {};
  for (const [op, row] of Object.entries(ops)) (byOwner[owners[op]] ??= {})[op] = row;
  const m = await import(`../../../src/op-grades/index.mjs?registered=${registeredN++}`);
  m.registerDeclaredOps(byOwner);
  return m;
}

/** op-declarations' alias table (R17, B27), read by path as the other modules' rows are: a test reads it, the module imports nothing. */
export async function declaredAliases() {
  const path = join(new URL("../../../../", import.meta.url).pathname, "bio-plane", "src", "op-declarations", "index.mjs");
  return (await import(pathToFileURL(path).href)).OP_ALIASES;
}

/** The ops of a NON_ACTS table that their owner declares a read (`weight: "read"`), in table order, each with its owner. A read
 *  its owner words without the "read: " lead holds the owner's sentence (K4168), so it is found by the declaration, not the lead. */
export async function ownerReads(table) {
  const { ops, owners } = await collectDeclaredOps(new URL("../../../../", import.meta.url).pathname);
  return Object.keys(table).filter((op) => ops[op]?.weight === "read").map((op) => ({ op, owner: owners[op], sentence: ops[op].description }));
}
