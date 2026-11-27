/* The CONTENT-TYPE axis: a second registry of the SAME shape as the stack axis.
 *
 * Both axes are `makeRegistry()` instances of the one recogniser engine (site-profiles'
 * recogniser.mjs), which is the whole claim of framework §4: a third axis is a third
 * `makeRegistry()`, not a third loop.
 *
 * THIS MODULE HOLDS NO CONTENT TYPE (R36; T34-8, N549). The registry starts EMPTY and
 * holds only what a composer registers through the seam below: `plane` wires
 * `doctypes`' `registerDoctypes(registerDoctype)` and the other readers' registrations,
 * `generic` (the fallback) last. The seven copies this module kept, and their
 * registration by default (K1513 (3)), were deleted once `plane` registered `doctypes`'
 * types (T33-90). Which types exist, what each one reads and the measurements each was
 * written from are `doctypes`' (its R1) and the other readers'; this file is the seam,
 * the order and the `also` pass.
 *
 * The rule the deleted types were written under holds for whatever is registered here:
 * a content type invented from what a document probably looks like is a type that
 * reassures people about things it has not understood. With no type recognising a
 * document, the registered fallback reports change without describing it, which is
 * noisy and honest; with no fallback registered at all, NO_TYPE below says so. */
import { makeRegistry, CONFIDENCE, confidenceRank } from "../../site-profiles/index.mjs";
import { CONTRACT } from "./index.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { classificationView, CLASSIFY_WHOLE_MAX_CHARS } from "../classify-view.mjs";

/** @import { ContentType, DoctypeContext, Detection, ClassifyWork, SuppliedSheet } from "./index.mjs" */
/** @import { ClassifiedOver, ClassificationView } from "../classify-view.mjs" */

/**
 * The answer that names no type (NO_TYPE): it detects, reads and judges nothing.
 * @typedef {{ readonly key: string, readonly label: string, readonly version: number, readonly fallback: true, readonly contract: string, readonly detect?: undefined, readonly parse?: undefined, readonly assess?: undefined, readonly connections?: undefined }} NoType
 */
/**
 * The type an answer names (R4): a registered content type, or NO_TYPE when no fallback is registered.
 * @typedef {ContentType | NoType} AnsweredType
 */
/**
 * A registered type that matched in the walk: its key, confidence and signals.
 * @typedef {Object} ConsideredType
 * @property {string} key
 * @property {string | undefined} confidence
 * @property {string[]} signals
 */
/**
 * A type whose `detect` threw in the `also` pass (R5): its key, no confidence, and the error's message.
 * @typedef {Object} ErredType
 * @property {string} key
 * @property {null} confidence
 * @property {string[]} signals
 * @property {string} error
 */
/**
 * Another type this document also satisfies (R5), or one whose `detect` threw there.
 * @typedef {ConsideredType | ErredType} AlsoEntry
 */
/**
 * What one classification's detects examined (R40), and the first type the budget stopped before, if any.
 * @typedef {Object} WorkSpent
 * @property {number} chars
 * @property {number} limit
 * @property {string | null} stopped_before
 */
/**
 * What `doctypeFor` answers (R4, R5, R35, R39, R40).
 * @typedef {Object} DoctypeAnswer
 * @property {AnsweredType} type
 * @property {string | undefined} confidence
 * @property {string[]} signals
 * @property {ConsideredType[]} considered
 * @property {AlsoEntry[]} also
 * @property {ClassifiedOver} [classified_over]
 * @property {WorkSpent} work
 * @property {string} [why]
 */
/**
 * The registry's answer before the `also` pass: the member, how sure, on what, what matched, and whether one did.
 * @typedef {Object} Recognised
 * @property {AnsweredType} member
 * @property {string | undefined} confidence
 * @property {string[]} signals
 * @property {ConsideredType[]} considered
 * @property {boolean} matched
 */
/**
 * What `registerDoctype` answers: the key registered and whether it replaced one, or why the type was refused.
 * @typedef {{ ok: true, key: string, replaced: boolean } | { ok: false, why: string }} Registration
 */
/**
 * `doctypeForYielding`'s options: the function it awaits to give the thread back.
 * @typedef {Object} YieldOptions
 * @property {(() => unknown) | null} [yieldNow]
 */

/* What a thrown error says: an Error's message, else the thrown value as text. */
const said = /** @param {unknown} e @returns {string} */ (e) => String((e instanceof Error && e.message) || e);

/* THE SEAM (T33-12; K1513; T34-8). `registerDoctype` (exported further down) is how a
   composer registers types: a type whose key is already held REPLACES it in its own
   slot, so a re-registration never moves the load-bearing order; a new key is
   appended. `recognise` walks in registration order and BREAKS ON THE FIRST CERTAIN
   detection, so the order a composer registers in is the order that decides (R4).

   A member carrying `fallback: true` (doctypes' generic) is what the registry answers
   when nothing detects -- same mechanism as the conservative handler on the stack
   axis. */
/** @type {ContentType[]} */
const members = [];
let types = makeRegistry();
const rebuild = () => { types = makeRegistry(); for (const m of members) types.register(m); };

/* THE NO-TYPE ANSWER (K1513 (1)): what `doctypeFor` gives when no registered type
   carries `fallback: true` (none registered, or the fallback replaced by a type that is
   not one). It is not a content type: it detects, reads and judges nothing, so
   `readText` states that it has no reader and `assess` claims nothing about what changed
   (R13). R4's "always returns a type" holds, and R35's no says which no. */
/** @type {NoType} */
const noType = {
  key: "unregistered", label: localize("docprofile.registry.no_content_type_is_registered", "no content type is registered"), version: 0, fallback: true,
  contract: CONTRACT.SUBSTANCE,
};
Object.freeze(noType);
export const NO_TYPE = noType;

/** Register one content type into the seam. A type whose `key` is held already
 *  replaces it in its slot (the order is load-bearing, R4); a new key is appended. A
 *  member with no string `key` or no `detect` function is refused, stated, never
 *  thrown. Returns `{ok:true, key, replaced}` or `{ok:false, why}`.
 *  @param {ContentType | null | undefined} type
 *  @returns {Registration} */
export function registerDoctype(type) {
  if (!type || typeof type !== "object" || typeof type.key !== "string" || !type.key)
    return { ok: false, why: "a content type is registered by its key, and this one carries no key" };
  if (typeof type.detect !== "function")
    return { ok: false, why: localize("docprofile.registry.the_key_content_type_has", "the {key} content type has no detect function, so it could never recognise a document", { key: String(type.key) }) };
  const i = members.findIndex((m) => m.key === type.key);
  if (i >= 0) members[i] = type; else members.push(type);
  rebuild();
  return { ok: true, key: type.key, replaced: i >= 0 };
}

/** The registered types, in registration order.
 *  @returns {ContentType[]} */
export function doctypes() { return types.all(); }

/** Identify what KIND of content this is, independently of the stack that served it.
 *  A thin wrapper over the shared registry; always returns something.
 *
 *  FW-18 / M0-32 — `also`: WHAT ELSE THIS DOCUMENT IS. The census measured that 52 of
 *  600 sampled documents (about one in twelve) satisfy MORE THAN ONE class, so a
 *  content type that assumes one document is one kind mis-describes one document in
 *  twelve. The engine cannot say so: `recognise` stops at the first CERTAIN detection,
 *  so its `considered` list is truncated at whatever won and a second class is
 *  invisible. That break is the STACK axis's behaviour too and is not this axis's to
 *  move, so the multi-class fact is produced here instead, by asking every registered
 *  type independently.
 *
 *  IT CHANGES NO VERDICT. `type`, `confidence`, `signals` and `considered` are exactly
 *  what they were; `also` is a new field beside them, and the plane's profile stamp
 *  reads named fields rather than the whole object, so nothing downstream moves. A
 *  reader is handed the same list through `ctx.alsoSatisfies` so it can state the fact
 *  in the reading's own facts, which is the surface a member actually sees.
 *
 *  A type whose `detect` THROWS is reported as such rather than silently dropped: a
 *  recogniser that cannot answer is a different fact from one that answered no.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {DoctypeAnswer} */
export function doctypeFor(ctx) {
  const g = walk(ctx);
  for (;;) {
    const s = g.next();
    if (s.done) return s.value;
  }
}

/** THE LONG TEXT (R39; fix round 7, G88). Over this many characters of `ctx.text`, `doctypeForYielding` gives the thread back
 *  before each type's `detect`: a long text read in pieces is classified whole (a type may rest on any page, so it is never
 *  sampled), and the walk over every registered type is about a second of one synchronous stretch at 12 MB. */
export const CLASSIFY_YIELD_AT_CHARS = 256 * 1024;

/** `doctypeFor`, giving the thread back (R39). The same answer as `doctypeFor`, because it is the same walk: `walk` below
 *  yields a marker before each `detect`, `doctypeFor` drives it straight through and this awaits `yieldNow()` at each marker
 *  once `ctx.text` is longer than `CLASSIFY_YIELD_AT_CHARS`. A `yieldNow` that is not a function is no yield; one that throws
 *  or rejects is ignored (the answer is the same); with none, or on a text that is not long, nothing is awaited. A `detect`
 *  that throws in the main walk rejects the call, as it throws from `doctypeFor`. One `detect` is still one stretch.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {YieldOptions | null} [opts]
 *  @returns {Promise<DoctypeAnswer>} */
export async function doctypeForYielding(ctx, opts) {
  const given = opts ? opts.yieldNow : undefined;
  const yieldNow = typeof given === "function" ? given : null;
  const text = ctx ? ctx.text : undefined;
  const long = !!ctx && typeof text === "string" && text.length > CLASSIFY_YIELD_AT_CHARS;
  const g = walk(ctx);
  for (;;) {
    const s = g.next();
    if (s.done) return s.value;
    if (yieldNow && long) { try { await yieldNow(); } catch { /* no yield; the answer is the same */ } }
  }
}

/** THE WORK BUDGET (R40; fix round 9, G140, G133f; K4876). Every `detect` of one classification shares `ctx.work`, an object
 *  `{chars, limit}`: `limit` is this many times the characters of the text the types are asked about (the view, R39), for each
 *  registered type, and a `detect` adds to `chars` the characters it examines (a pass of a pattern over a window counts that
 *  window). Each type is charged its window, so an ordinary text asks every type; a classification whose detects have examined
 *  more than `limit` (one type's runaway) asks no further type, and its answer says which it stopped before. */
export const CLASSIFY_WORK_FACTOR = 4;

/* What the types are handed: the text bounded to the view above CLASSIFY_WHOLE_MAX_CHARS, for a text of any kind (R39: head and
   sample; `ctx.sheets`, when it is the supplied sheets, gives the sheets' heads), `window` saying which part of the text that is
   (`{from, to, of}`: the characters of `ctx.text` it holds and how many the whole text has), and the shared `work`. A text at or
   under the bound is handed whole and unchanged, the same string, copied nowhere. */
/** @param {DoctypeContext | null | undefined} ctx @param {number} typeCount
 *  @returns {{ dctx: DoctypeContext, work: ClassifyWork, classified_over: ClassifiedOver | null }} */
function bounded(ctx, typeCount) {
  const base = ctx && typeof ctx === "object" ? ctx : {};
  /* A `text` that is an accessor is read by each `detect` as it always was, never once here: such a ctx is wrapped, not copied. */
  const own = Object.getOwnPropertyDescriptor(base, "text");
  const plain = !own || "value" in own;
  const given = plain ? base.text : undefined;
  const whole = typeof given === "string" ? given : null;
  const over = whole !== null && whole.length > CLASSIFY_WHOLE_MAX_CHARS;
  const v = over ? viewOf(whole, base.sheets) : null;
  const text = v ? v.view : whole;
  const counted = text !== null;
  const work = { chars: 0, limit: counted ? CLASSIFY_WORK_FACTOR * text.length * Math.max(1, typeCount) : Infinity };
  const window = { from: 0, to: counted ? text.length : 0, of: whole !== null ? whole.length : 0 };
  const dctx = plain
    ? { ...base, ...(v ? { text } : {}), window, work }
    : Object.assign(Object.create(base), { window, work });
  const classified_over = v && { chars: v.chars, of: v.of, head_chars: v.head_chars, windows: v.windows, sheet_heads: v.sheet_heads, heads_used: v.heads_used };
  return { dctx, work, classified_over };
}

/* The view of a text over the bound, the sheets' heads among it where `sheets` is the supplied sheets. */
const viewOf = /** @param {string} text @param {Array<SuppliedSheet> | undefined} sheets @returns {ClassificationView} */
  (text, sheets) => classificationView(text, Array.isArray(sheets) ? sheets : null);

/* The one walk behind `doctypeFor` and `doctypeForYielding`: the engine's `recognise` (site-profiles, whose exported
   `CONFIDENCE` and `confidenceRank` this spells out, unchanged) and then `alsoWalk`'s asking, each yielding a marker just before
   every `detect` it runs. A throw from a `detect` in the main walk leaves the generator, as it left `recognise`; one in the
   `also` pass is recorded, as `askAll` records it. The members are those registered when the walk starts. */
/** @param {DoctypeContext | null | undefined} ctx @returns {Generator<ContentType, DoctypeAnswer, void>} */
function* walk(ctx) {
  /** @type {ContentType[]} */
  const all = types.all();
  const { dctx, work, classified_over } = bounded(ctx, all.length);
  /** @type {ConsideredType[]} */
  const considered = [];
  /** @type {(Detection & { member: ContentType }) | null} */
  let best = null;
  /** @type {string[]} */
  const noSignals = [];
  /** @type {string | null} */
  let stopped = null;
  for (const m of all) {
    if (work.chars > work.limit) { stopped = m.key; break; }
    yield m;
    const d = m.detect(dctx) || { match: false };
    if (!d.match) continue;
    considered.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
    const held = best;
    if (!held || confidenceRank(d.confidence) > confidenceRank(held.confidence)) best = { member: m, ...d };
    if (d.confidence === CONFIDENCE.CERTAIN) break;
  }
  const won = best;
  /** @type {Recognised} */
  const r = won
    ? { member: won.member, confidence: won.confidence, signals: won.signals || [], considered, matched: true }
    /* The engine's last resort is the LAST member when none is a fallback; here
       an unrecognised document is never read as a type that did not recognise it. */
    : { member: all.find((m) => m.fallback === true) || NO_TYPE, confidence: CONFIDENCE.NONE, signals: noSignals, considered, matched: false };
  const also = yield* alsoWalk(dctx, r, all, work, (key) => { stopped = stopped || key; });
  const stoppedBefore = stopped;
  const spent = { chars: work.chars, limit: work.limit, stopped_before: stoppedBefore };
  /** @type {DoctypeAnswer} */
  let out;
  if (classified_over) out = { type: r.member, confidence: r.confidence, signals: r.signals, considered: r.considered, also, classified_over, work: spent };
  else out = { type: r.member, confidence: r.confidence, signals: r.signals, considered: r.considered, also, work: spent };
  /* A "no" says which no (R35): nothing recognised, and so the registered fallback's reading. */
  if (r.member === NO_TYPE)
    out.why = localize("docprofile.registry.no_content_type_is_registered_to_recognise", "no content type is registered to recognise documents, so this one is not read as any type: nothing is read from it and what changes in it is not described");
  else if (!r.matched)
    out.why = localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described");
  /* The budget ran out before every type was asked: stated, never silent (R-SILENT). */
  if (stoppedBefore)
    out.why = [out.why, localize("docprofile.registry.the_work_budget_ran_out_before_every_type_was_asked",
      "the types examined {chars} characters of this text, over the {limit} allowed, so the {key} content type and those after it were not asked",
      { chars: String(work.chars), limit: String(work.limit), key: String(stoppedBefore) })].filter(Boolean).join("; ");
  return out;
}

/* `also` for the answer `recognise` just gave, asking no type twice (G48; R5). `recognise` asks the members in order and
   stops at the first CERTAIN match, and its `considered` holds, for each member that matched, the very `{key, confidence,
   signals}` entry `alsoFor` builds; so every member up to the winner was already asked, and only those registered AFTER a
   winner that stopped the walk are left to ask. A winner chosen by rank, and no winner, mean every member was asked. The
   result is `alsoFor(ctx, winner.key)`'s, entry for entry and in registration order; `alsoFor` below stays as the independent
   spelling the suite compares it to. The work budget (R40) ends this pass too. */
/** @param {DoctypeContext} ctx @param {Recognised} r @param {ContentType[]} all @param {ClassifyWork} work
 *  @param {(key: string) => void} stop @returns {Generator<ContentType, AlsoEntry[], void>} */
function* alsoWalk(ctx, r, all, work, stop) {
  const fallback = new Set(all.filter((m) => m.fallback === true).map((m) => m.key));
  const out = r.considered.filter((c) => c.key !== r.member.key && !fallback.has(c.key));
  if (!r.matched || r.confidence !== CONFIDENCE.CERTAIN) return out;
  const after = all.findIndex((m) => m.key === r.member.key) + 1;
  /** @type {AlsoEntry[]} */
  const rest = [];
  for (const m of all.slice(after)) {
    if (m.key === r.member.key || m.fallback === true) continue;
    if (work.chars > work.limit) { stop(m.key); break; }
    yield m;
    /** @type {Detection} */
    let d;
    try { d = m.detect(ctx) || { match: false }; }
    catch (e) { rest.push({ key: m.key, confidence: null, signals: [], error: said(e) }); continue; }
    if (d.match) rest.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
  }
  return [...out, ...rest];
}

/** Every registered type OTHER than `selfKey` whose own `detect` matches this text.
 *  Exported for the suite and for callers that want the fact without a full profile.
 *  @param {DoctypeContext} ctx
 *  @param {string | null} [selfKey]
 *  @returns {AlsoEntry[]} */
export function alsoFor(ctx, selfKey) { return askAll(ctx, types.all(), selfKey); }

/** @param {DoctypeContext} ctx @param {ContentType[]} members @param {string | null | undefined} selfKey
 *  @returns {AlsoEntry[]} */
function askAll(ctx, members, selfKey) {
  /** @type {AlsoEntry[]} */
  const out = [];
  for (const m of members) {
    if (m.key === selfKey || m.fallback === true) continue;
    /** @type {Detection} */
    let d;
    try { d = m.detect(ctx) || { match: false }; }
    catch (e) { out.push({ key: m.key, confidence: null, signals: [], error: said(e) }); continue; }
    if (d.match) out.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
  }
  return out;
}

export * from "./index.mjs";
