/* op-grades — R49, R50 (T51 fix round; K4165, K4168): THE OP DECLARATION, TAKEN FROM ITS OWNER.
 *
 * `registerDeclaredOps(owners)` takes each module's `DECLARED_OPS` (a frozen object from an op's name to its row), as an object
 * from a module id to its rows or a list of `[module id, rows]` pairs, and adds,
 * for every op that has no hand row, the grade the row states to the very tables `./index.mjs` publishes, so `affordances`
 * (R12, R19, R20) and `phoneOf` read it as they read a hand row. An op that has a hand row must agree with its owner's row
 * in weight and description, or the registration is refused naming the op; the hand rows stay until each owner next declares
 * its own (K4168), so a row that agrees changes nothing. A registration is refused whole, and refused when any table was
 * already read: the tables `./index.mjs` exports are guarded (`guard`), and the first read through one closes registration.
 *
 * This file is built by `./index.mjs`, which hands it the raw tables; it imports only `setup-words` (R44), so it closes no
 * cycle (R19, R20). The row's other fields (`classes`, `machineClasses`, `fields`) are `op-declarations`'. */
import { hasWord, word } from "../setup-words/index.mjs";

/**
 * @typedef {Object} DeclaredRow one op's row in its owner's `DECLARED_OPS` (R49); the fields read here, the rest being `op-declarations`'
 * @property {boolean} mutating
 * @property {string} weight
 * @property {string} description
 * @property {string} [refusal]
 * @bound weight: a rung of RUNG_LADDER, a ground of RUNG_ABSENCE_GROUNDS, or "read"; a rung or a ground with mutating true, "read" with mutating false; "irreversible" only for an op a hand row grades irreversible (R54)
 * @bound description: a dotted setup-words key the list holds, or a sentence; never a sentence beginning "capture-directed:" for an op with no hand row
 * @bound refusal: only with the weight "reasoned"; an upper-case code of letters, digits and _
 */
/**
 * @typedef {Object<string, Object<string, DeclaredRow>> | Array<[string, Object<string, DeclaredRow>]>} DeclaredOwners each owner module's id with its `DECLARED_OPS`, as an object or as a list of pairs (R49)
 * @bound an op is declared by one owner only (R50 (a))
 */
/**
 * @typedef {Object} Registration what a registration did (R49)
 * @property {string[]} registered the ops added to the tables, in the order given
 * @property {string[]} agreed the ops that already had a hand row and agree with it, unchanged
 */

const KEY = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;
const CODE = /^[A-Z][A-Z0-9_]+$/;

/* the detail is a token for the developer reading the refusal, never a sentence a member reads */
const fail = (code, op, detail) => Object.assign(new Error(`${code}: ${op}${detail ? ` ${detail}` : ""}`), { code, op });

/**
 * R49, R50: the guard over the published tables and the registration that adds owners' rows to them, built over the raw
 * tables `./index.mjs` hands in. The tables are changed in place by `register` and by nothing else.
 * @param {{ladder: string[], grounds: Object<string, string>, rungs: Object<string, string>, absent: Object<string, {ground: string, is: string}>, nonActs: Object<string, string>, machine: Object<string, string>, refusals: string[]}} tables
 * @returns {{guard: <T extends object>(table: T) => T, register: (owners: DeclaredOwners) => Registration}}
 */
export function createDeclaredOps({ ladder, grounds, rungs, absent, nonActs, machine, refusals }) {
  let read = false;
  let registered = false;

  /**
   * The table, read through a proxy that closes registration at its first read (R50 (c)); writes pass through.
   * @template {object} T
   * @param {T} table
   * @returns {T}
   */
  const guard = (table) => new Proxy(table, {
    get(target, key, receiver) { read = true; return Reflect.get(target, key, receiver); },
    has(target, key) { read = true; return Reflect.has(target, key); },
    ownKeys(target) { read = true; return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { read = true; return Reflect.getOwnPropertyDescriptor(target, key); },
  });

  const has = (table, op) => Object.hasOwn(table, op);

  /* R49: the row's weight, as a kind, or the code that refuses it. */
  const kindOf = (op, r) => {
    if (typeof r.mutating !== "boolean") throw fail("DECLARED_OP_BAD_WEIGHT", op, "mutating=missing");
    const w = r.weight;
    /* R54: an irreversible row is taken only where a hand row holds the op in RUNGS; the agreement check below then
       accepts it when that hand row is irreversible too, and refuses it (DECLARED_OP_DISAGREES) otherwise */
    if (w === "irreversible") {
      if (!has(rungs, op) || !r.mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "weight=irreversible");
      return "rung";
    }
    if (w === "read") {
      if (r.mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "read-but-writes");
      return "read";
    }
    if (typeof w === "string" && ladder.includes(w)) {
      if (!r.mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "rung-on-read");
      return "rung";
    }
    if (typeof w === "string" && Object.hasOwn(grounds, w)) {
      if (!r.mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "ground-on-read");
      return "ground";
    }
    throw fail("DECLARED_OP_BAD_WEIGHT", op, `weight=${typeof w === "string" ? w : typeof w}`);
  };

  /* R49: the row's description as the sentence the tables hold. */
  const sentenceOf = (op, r) => {
    const d = r.description;
    if (typeof d !== "string" || d === "") throw fail("DECLARED_OP_BAD_DESCRIPTION", op, "description=missing");
    let sentence = d;
    if (KEY.test(d)) {
      if (!hasWord(d)) throw fail("DECLARED_OP_BAD_DESCRIPTION", op, `word-lacks=${d}`);
      sentence = word(d);
    }
    return sentence;
  };

  /* R50 (b): the weight a hand row states, or null where it states none. */
  const handWeight = (op) => {
    if (has(rungs, op)) return rungs[op];
    if (has(absent, op)) return absent[op].ground;
    if (has(nonActs, op)) return "read";
    return null;
  };
  const handDescription = (op) => (has(nonActs, op) ? nonActs[op] : has(absent, op) ? absent[op].is : null);

  /**
   * R49, R50, R54: adds each owner's row for an op with no hand row to the tables, and checks a row for an op with one.
   * @param {DeclaredOwners} owners
   * @returns {Registration}
   * @throws {Error} code DECLARED_OPS_LATE when a table was read or a registration already succeeded; DECLARED_OP_DUPLICATE when two owners declare one op; DECLARED_OP_BAD_WEIGHT, DECLARED_OP_BAD_DESCRIPTION or DECLARED_OP_BAD_REFUSAL when a row breaks its bounds; DECLARED_OP_DISAGREES when a row differs from its hand row in weight or description. The error's `op` names the op; a refused call changes no table
   */
  function register(owners) {
    const pairs = Array.isArray(owners) ? owners : Object.entries(owners ?? {});
    /** @type {Array<[string, string, DeclaredRow]>} builds the owner, op and row of every row handed in */
    const entries = pairs.flatMap(([owner, rows]) => Object.entries(rows ?? {}).map(([op, r]) => /** @type {[string, string, DeclaredRow]} builds one owner's row */ ([owner, op, r])));
    if (read || registered) throw fail("DECLARED_OPS_LATE", entries[0]?.[1] ?? "(no op)", "late");

    const seen = new Map();
    for (const [owner, op] of entries) {
      if (seen.has(op)) throw fail("DECLARED_OP_DUPLICATE", op, `declared-by=${seen.get(op)},${owner}`);
      seen.set(op, owner);
    }

    const plan = [];
    const agreed = [];
    for (const [, op, r] of entries) {
      if (r === null || typeof r !== "object") throw fail("DECLARED_OP_BAD_WEIGHT", op, "row=missing");
      const kind = kindOf(op, r);
      const sentence = sentenceOf(op, r);
      if (r.refusal !== undefined && (r.weight !== "reasoned" || typeof r.refusal !== "string" || !CODE.test(r.refusal))) {
        throw fail("DECLARED_OP_BAD_REFUSAL", op, "refusal");
      }
      const handHolds = has(rungs, op) || has(absent, op) || has(nonActs, op) || has(machine, op);
      if (!handHolds) {
        if (sentence.startsWith("capture-directed:")) throw fail("DECLARED_OP_BAD_DESCRIPTION", op, "capture-prefix");
        plan.push({ op, kind, weight: r.weight, sentence, refusal: r.refusal });
        continue;
      }
      const hw = handWeight(op);
      if (hw !== null && hw !== r.weight) throw fail("DECLARED_OP_DISAGREES", op, `weight hand=${hw} owner=${r.weight}`);
      const hd = handDescription(op);
      if (hd !== null && hd !== sentence) throw fail("DECLARED_OP_DISAGREES", op, "description");
      agreed.push(op);
    }

    for (const { op, kind, weight, sentence, refusal } of plan) {
      if (kind === "rung") rungs[op] = weight;
      else if (kind === "ground") absent[op] = { ground: weight, is: sentence };
      nonActs[op] = sentence;
      if (refusal !== undefined && !refusals.includes(refusal)) refusals.push(refusal);
    }
    registered = true;
    return { registered: plan.map((p) => p.op), agreed };
  }

  return { guard, register };
}
