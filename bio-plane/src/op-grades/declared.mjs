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

const KEY = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;
const CODE = /^[A-Z][A-Z0-9_]+$/;

/* the detail is a token for the developer reading the refusal, never a sentence a member reads */
/**
 * @param {string} code
 * @param {string} op
 * @param {string} [detail]
 * @returns {Error & { code: string, op: string }}
 */
const fail = (code, op, detail) => Object.assign(new Error(`${code}: ${op}${detail ? ` ${detail}` : ""}`), { code, op });

/** @typedef {{ ground: string, is: string }} Absence an op stated absent: its ground and what it is (R2) */
/**
 * @typedef {Object} DeclaredRow an owner's row for one op; of it this module reads these four (R49)
 * @property {unknown} [mutating]
 * @property {unknown} [weight]
 * @property {unknown} [description]
 * @property {unknown} [refusal]
 */
/** @typedef {{ readonly [op: string]: DeclaredRow | null }} DeclaredRows one module's `DECLARED_OPS` */
/**
 * @typedef {{ readonly [owner: string]: DeclaredRows | null | undefined } | Array<[string, DeclaredRows | null | undefined]> | null | undefined} DeclaredOwners
 * each owner's rows, by module id or as `[module id, rows]` pairs
 */
/** @typedef {{ registered: string[], agreed: string[] }} Registration the ops added, and the ops a hand row already held */
/**
 * @typedef {Object} DeclaredTables the raw tables `./index.mjs` builds, which a registration writes into
 * @property {readonly string[]} ladder
 * @property {object} grounds
 * @property {{ [op: string]: string }} rungs
 * @property {{ [op: string]: Absence }} absent
 * @property {{ [op: string]: string }} nonActs
 * @property {{ [op: string]: string }} machine
 * @property {string[]} refusals
 */
/** @typedef {[string, string, DeclaredRow | null]} Entry an owner, an op and its row */
/**
 * @param {string} owner
 * @param {string} op
 * @param {DeclaredRow | null} r
 * @returns {Entry}
 */
const entryOf = (owner, op, r) => [owner, op, r];

/**
 * @param {DeclaredTables} tables
 * @returns {{ guard: <T extends object>(table: T) => T, register: (owners: DeclaredOwners) => Registration }}
 */
export function createDeclaredOps({ ladder, grounds, rungs, absent, nonActs, machine, refusals }) {
  let read = false;
  let registered = false;

  /** The table, read through a proxy that closes registration at its first read (R50 (c)); writes pass through. */
  /**
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

  /**
   * @param {object} table
   * @param {string} op
   * @returns {boolean}
   */
  const has = (table, op) => Object.hasOwn(table, op);

  /* R49: the row's weight, as a kind, or the code that refuses it. */
  /**
   * @param {string} op
   * @param {DeclaredRow} r
   * @returns {{ kind: "rung" | "ground" | "read", weight: string }}
   */
  const kindOf = (op, r) => {
    const mutating = r.mutating;
    if (typeof mutating !== "boolean") throw fail("DECLARED_OP_BAD_WEIGHT", op, "mutating=missing");
    const w = r.weight;
    /* R54: an irreversible row is taken only where a hand row holds the op in RUNGS; the agreement check below then
       accepts it when that hand row is irreversible too, and refuses it (DECLARED_OP_DISAGREES) otherwise */
    if (w === "irreversible") {
      if (!has(rungs, op) || !mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "weight=irreversible");
      return { kind: "rung", weight: w };
    }
    if (w === "read") {
      if (mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "read-but-writes");
      return { kind: "read", weight: w };
    }
    if (typeof w === "string" && ladder.includes(w)) {
      if (!mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "rung-on-read");
      return { kind: "rung", weight: w };
    }
    if (typeof w === "string" && Object.hasOwn(grounds, w)) {
      if (!mutating) throw fail("DECLARED_OP_BAD_WEIGHT", op, "ground-on-read");
      return { kind: "ground", weight: w };
    }
    throw fail("DECLARED_OP_BAD_WEIGHT", op, `weight=${typeof w === "string" ? w : typeof w}`);
  };

  /* R49: the row's description as the sentence the tables hold. */
  /**
   * @param {string} op
   * @param {DeclaredRow} r
   * @returns {string}
   */
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

  /* R49: the code its owner refuses the absent reason with, allowed only with the rung `reasoned`, or undefined. */
  /**
   * @param {string} op
   * @param {DeclaredRow} r
   * @returns {string | undefined}
   */
  const refusalOf = (op, r) => {
    const f = r.refusal;
    if (f === undefined) return undefined;
    if (r.weight !== "reasoned" || typeof f !== "string" || !CODE.test(f)) throw fail("DECLARED_OP_BAD_REFUSAL", op, "refusal");
    return f;
  };

  /* R50 (b): the weight a hand row states, or null where it states none. */
  /**
   * @param {string} op
   * @returns {string | null}
   */
  const handWeight = (op) => {
    if (has(rungs, op)) return rungs[op] ?? null;
    if (has(absent, op)) return absent[op]?.ground ?? null;
    if (has(nonActs, op)) return "read";
    return null;
  };
  /**
   * @param {string} op
   * @returns {string | null}
   */
  const handDescription = (op) => (has(nonActs, op) ? nonActs[op] ?? null : has(absent, op) ? absent[op]?.is ?? null : null);

  /**
   * @param {DeclaredOwners} owners
   * @returns {Registration}
   */
  function register(owners) {
    const pairs = Array.isArray(owners) ? owners : Object.entries(owners ?? {});
    const entries = pairs.flatMap(([owner, rows]) => Object.entries(rows ?? {}).map(([op, r]) => entryOf(owner, op, r)));
    if (read || registered) throw fail("DECLARED_OPS_LATE", entries[0]?.[1] ?? "(no op)", "late");

    /** @type {Array<[string, string]>} */
    const noOwners = [];
    /** @type {Map<string, string>} each op, and the owner that declared it */
    const seen = new Map(noOwners);
    for (const [owner, op] of entries) {
      if (seen.has(op)) throw fail("DECLARED_OP_DUPLICATE", op, `declared-by=${seen.get(op)},${owner}`);
      seen.set(op, owner);
    }

    /** @type {Array<{ op: string, kind: "rung" | "ground" | "read", weight: string, sentence: string, refusal: string | undefined }>} */
    const plan = [];
    /** @type {string[]} */
    const agreed = [];
    for (const [, op, r] of entries) {
      if (r === null || typeof r !== "object") throw fail("DECLARED_OP_BAD_WEIGHT", op, "row=missing");
      const { kind, weight } = kindOf(op, r);
      const sentence = sentenceOf(op, r);
      const refusal = refusalOf(op, r);
      const handHolds = has(rungs, op) || has(absent, op) || has(nonActs, op) || has(machine, op);
      if (!handHolds) {
        if (sentence.startsWith("capture-directed:")) throw fail("DECLARED_OP_BAD_DESCRIPTION", op, "capture-prefix");
        plan.push({ op, kind, weight, sentence, refusal });
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
