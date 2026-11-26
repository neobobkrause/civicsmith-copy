// @ts-check
/* connection-grammar: the owner registry (R2–R5, B §(b) option (ii)). Every owner of a kind of relationship, at any
   layer, registers its kinds with the members' words and its `neighbours` read, so `explore` walks one registry. The
   registry is in memory and holds no relationship (R16); its `neighbours` passes one read to one owner and judges the
   answer, and walks nothing. */
import { CLASSES, connectionErrors } from './shape.mjs';
import { answerFailures, isRead, isRefusal, keepsContract } from './reads.mjs';
import { localize } from '../setup-words/index.mjs';
import { isObj, isList, text } from './raw.mjs';
/** @import { RawFields } from './raw.mjs' */
/** @import { KindEntry, KindSpec, OwnerListing, FieldError, Refusal, PassedRefusal, ReadFailure, NeighboursAnswer, NeighboursCall, Registry } from './shape.mjs' */
/** @import { NeighboursRead } from './reads.mjs' */

/** Words no kind may carry: none offers a measure of how connected a node is, or suspicion (R3, R17; K1486). */
export const FORBIDDEN_WORDS = Object.freeze(['knows', 'network', 'conflict', 'suspicious', 'most connected', 'centrality', 'score']);

/**
 * A refusal: which kind of no, and why (R18).
 * @param {string} refused
 * @param {string} why
 * @returns {Refusal}
 */
const refuse = (refused, why) => ({ refused, why });

/**
 * The reason a thrown value gives: its message, else the value as text.
 * @param {unknown} e
 * @returns {string}
 */
const thrownText = (e) => {
  const message = e !== null && typeof e === 'object' && 'message' in e ? e.message : undefined;
  return String(message ?? e);
};

/**
 * A fresh registry: registering in one never changes another (R5).
 * @returns {Registry}
 */
export function createRegistry() {
  /** @type {[string, {owner: string, kinds: Readonly<KindSpec>[], neighbours: NeighboursRead}][]} */
  const noOwners = [];
  const byOwner = new Map(noOwners);
  /** @type {[string, KindEntry][]} */
  const noKinds = [];
  const byKind = new Map(noKinds);

  /**
   * The registered entry for a kind, or null for one no owner holds (R4). Never throws.
   * @param {unknown} kind
   * @returns {KindEntry | null}
   */
  const kindOf = (kind) => {
    const e = typeof kind === 'string' ? byKind.get(kind) : undefined;
    return e ? { owner: e.owner, word: e.word, class: e.class } : null;
  };

  /**
   * Registers an owner once, or refuses with nothing registered (R2, R3). It reads `{owner, kinds, neighbours}`,
   * `kinds` a list of `{kind, word, class}`; anything else is refused, never thrown.
   * @param {unknown} arg
   * @returns {{ok: boolean, owner: string} | Refusal}
   */
  function registerOwner(arg) {
    const owner = isObj(arg) ? text(arg.owner) : null;
    const kinds = isObj(arg) ? arg.kinds : undefined;
    const neighbours = isObj(arg) ? arg.neighbours : undefined;
    if (owner === null) return refuse('OWNER_MISSING', 'an owner is named by a non-empty string');
    if (byOwner.has(owner)) return refuse('OWNER_DUPLICATE', `${owner} is already registered`);
    if (!isRead(neighbours)) return refuse('NEIGHBOURS_MISSING', `${owner} registers no neighbours read`);
    if (!isList(kinds) || kinds.length === 0) return refuse('KINDS_MISSING', `${owner} registers no kind`);
    /** @type {Readonly<KindSpec>[]} */
    const held = [];
    /** @type {Set<string>} */
    const mine = new Set();
    for (const k of kinds) {
      const kind = isObj(k) ? text(k.kind) : null;
      if (!isObj(k) || kind === null) return refuse('KIND_MISSING', `a kind of ${owner} is not named`);
      const other = byKind.get(kind);
      if (other) return refuse('KIND_TAKEN', `kind ${kind} is held by ${other.owner}`);
      if (mine.has(kind)) return refuse('KIND_TAKEN', `kind ${kind} is listed twice by ${owner}`);
      mine.add(kind);
      const named = k.class;
      const cls = typeof named === 'string' && CLASSES.includes(named) ? named : null;
      if (cls === null) return refuse('CLASS_UNKNOWN', `kind ${kind}'s class ${String(named).slice(0, 40)} is not one of ${CLASSES.join(', ')}`);
      const word = text(k.word);
      if (word === null) return refuse('WORD_MISSING', `kind ${kind} has no members' word`);
      const lower = word.toLowerCase();
      const bad = FORBIDDEN_WORDS.find((w) => lower.includes(w));
      if (bad) return refuse('WORD_FORBIDDEN', `kind ${kind}'s word "${word}" says "${bad}", which no kind's word may say`);
      held.push(Object.freeze({ kind, word, class: cls }));
    }
    const entry = { owner, kinds: held, neighbours };
    byOwner.set(owner, entry);
    for (const k of entry.kinds) byKind.set(k.kind, { owner, word: k.word, class: k.class });
    return { ok: true, owner };
  }

  /**
   * Every registered owner and its kinds, in registration order (R4).
   * @returns {OwnerListing[]}
   */
  const owners = () => [...byOwner.values()].map((e) => ({ owner: e.owner, kinds: e.kinds.map((k) => ({ kind: k.kind, word: k.word, class: k.class })) }));

  /**
   * Checks one connection against the shape and this registry (R1). Never throws.
   * @param {unknown} c
   * @returns {{errors: FieldError[], ok: boolean} | {errors?: undefined, ok: boolean}}
   */
  function checkConnection(c) {
    /** @type {FieldError[]} */
    let errors;
    try { errors = connectionErrors(c, kindOf); } catch (e) { errors = [{ field: 'connection', why: `unreadable: ${thrownText(e)}` }]; }
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  /**
   * One owner's read, its arguments passed unchanged, its answer judged at the interface (R6–R8). A missing viewer
   * is refused before any owner is called; an answer that breaks the contract is refused whole, never trimmed.
   * @param {NeighboursCall} arg
   * @returns {Refusal | PassedRefusal | (Refusal & {failures: ReadFailure[]}) | NeighboursAnswer}
   */
  function neighbours(arg) {
    /** @type {unknown} */
    const given = arg;
    /** @type {RawFields} */
    const a = isObj(given) ? given : {};
    const viewer = a.viewer, owner = a.owner;
    if (viewer === undefined || viewer === null || viewer === '') {
      return refuse('VIEWER_MISSING', localize('connection-grammar.registry.viewer_missing', 'a read names the member reading; an absent viewer is neither an administrator nor the public'));
    }
    const e = typeof owner === 'string' ? byOwner.get(owner) : undefined;
    if (!e) return refuse('OWNER_UNKNOWN', `${String(owner).slice(0, 60)} is not a registered owner`);
    /** @type {RawFields} */
    const args = { ...a };
    delete args.owner;
    /** @type {unknown} */
    let got;
    try { got = e.neighbours(args); } catch (err) {
      return refuse('OWNER_FAILED', `${e.owner}'s read threw: ${thrownText(err).slice(0, 200)}`);
    }
    const answer = got;
    if (isRefusal(answer)) return answer;
    const ctx = { owner: e.owner, ownKinds: e.kinds.map((k) => k.kind), kinds: a.kinds, node: a.node, at: a.at, scope: a.scope, kindOf };
    const failures = answerFailures(answer, ctx);
    if (keepsContract(answer, failures)) return answer;
    const first = failures[0];
    return { refused: 'OWNER_NONCONFORMING', why: localize('connection-grammar.registry.owner_s_answer_breaks_the', '{owner}\'s answer breaks the neighbours contract: {check}: {why}', { owner: String(e.owner), check: String(first?.check), why: String(first?.why) }), failures };
  }

  /** @type {Registry} */
  const registry = { registerOwner, owners, kindOf, checkConnection, neighbours };
  Object.freeze(registry);
  return registry;
}
