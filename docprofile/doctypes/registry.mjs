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

/* THE SEAM (T33-12; K1513; T34-8). `registerDoctype` (exported further down) is how a
   composer registers types: a type whose key is already held REPLACES it in its own
   slot, so a re-registration never moves the load-bearing order; a new key is
   appended. `recognise` walks in registration order and BREAKS ON THE FIRST CERTAIN
   detection, so the order a composer registers in is the order that decides (R4).

   A member carrying `fallback: true` (doctypes' generic) is what the registry answers
   when nothing detects -- same mechanism as the conservative handler on the stack
   axis. */
const members = [];
let types = makeRegistry();
const rebuild = () => { types = makeRegistry(); for (const m of members) types.register(m); };

/* THE NO-TYPE ANSWER (K1513 (1)): what `doctypeFor` gives when no registered type
   carries `fallback: true` (none registered, or the fallback replaced by a type that is
   not one). It is not a content type: it detects, reads and judges nothing, so
   `readText` states that it has no reader and `assess` claims nothing about what changed
   (R13). R4's "always returns a type" holds, and R35's no says which no. */
export const NO_TYPE = Object.freeze({
  key: "unregistered", label: localize("docprofile.registry.no_content_type_is_registered", "no content type is registered"), version: 0, fallback: true,
  contract: CONTRACT.SUBSTANCE,
});

/** Register one content type into the seam. A type whose `key` is held already
 *  replaces it in its slot (the order is load-bearing, R4); a new key is appended. A
 *  member with no string `key` or no `detect` function is refused, stated, never
 *  thrown. Returns `{ok:true, key, replaced}` or `{ok:false, why}`. */
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
 *  recogniser that cannot answer is a different fact from one that answered no. */
export function doctypeFor(ctx) {
  const g = walk(ctx);
  let s = g.next();
  while (!s.done) s = g.next();
  return s.value;
}

/** THE LONG TEXT (R39; fix round 7, G88). Over this many characters of `ctx.text`, `doctypeForYielding` gives the thread back
 *  before each type's `detect`: a long text read in pieces is classified whole (a type may rest on any page, so it is never
 *  sampled), and the walk over every registered type is about a second of one synchronous stretch at 12 MB. */
export const CLASSIFY_YIELD_AT_CHARS = 256 * 1024;

/** `doctypeFor`, giving the thread back (R39). The same answer as `doctypeFor`, because it is the same walk: `walk` below
 *  yields a marker before each `detect`, `doctypeFor` drives it straight through and this awaits `yieldNow()` at each marker
 *  once `ctx.text` is longer than `CLASSIFY_YIELD_AT_CHARS`. A `yieldNow` that is not a function is no yield; one that throws
 *  or rejects is ignored (the answer is the same); with none, or on a text that is not long, nothing is awaited. A `detect`
 *  that throws in the main walk rejects the call, as it throws from `doctypeFor`. One `detect` is still one stretch. */
export async function doctypeForYielding(ctx, opts) {
  const yieldNow = opts && typeof opts.yieldNow === "function" ? opts.yieldNow : null;
  const long = !!ctx && typeof ctx.text === "string" && ctx.text.length > CLASSIFY_YIELD_AT_CHARS;
  const g = walk(ctx);
  let s = g.next();
  while (!s.done) {
    if (yieldNow && long) { try { await yieldNow(); } catch { /* no yield; the answer is the same */ } }
    s = g.next();
  }
  return s.value;
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
function bounded(ctx, typeCount) {
  const base = ctx && typeof ctx === "object" ? ctx : {};
  /* A `text` that is an accessor is read by each `detect` as it always was, never once here: such a ctx is wrapped, not copied. */
  const own = Object.getOwnPropertyDescriptor(base, "text");
  const plain = !own || "value" in own;
  const whole = plain && typeof base.text === "string" ? base.text : null;
  const over = whole !== null && whole.length > CLASSIFY_WHOLE_MAX_CHARS;
  const v = over ? classificationView(whole, Array.isArray(base.sheets) ? base.sheets : null) : null;
  const text = v ? v.view : whole;
  const counted = text !== null;
  const work = { chars: 0, limit: counted ? CLASSIFY_WORK_FACTOR * text.length * Math.max(1, typeCount) : Infinity };
  const window = { from: 0, to: counted ? text.length : 0, of: counted ? whole.length : 0 };
  const dctx = plain
    ? { ...base, ...(v ? { text } : {}), window, work }
    : Object.assign(Object.create(base), { window, work });
  const classified_over = v && { chars: v.chars, of: v.of, head_chars: v.head_chars, windows: v.windows, sheet_heads: v.sheet_heads, heads_used: v.heads_used };
  return { dctx, work, classified_over };
}

/* The one walk behind `doctypeFor` and `doctypeForYielding`: the engine's `recognise` (site-profiles, whose exported
   `CONFIDENCE` and `confidenceRank` this spells out, unchanged) and then `alsoWalk`'s asking, each yielding a marker just before
   every `detect` it runs. A throw from a `detect` in the main walk leaves the generator, as it left `recognise`; one in the
   `also` pass is recorded, as `askAll` records it. The members are those registered when the walk starts. */
function* walk(ctx) {
  const all = types.all();
  const { dctx, work, classified_over } = bounded(ctx, all.length);
  const considered = [];
  let best = null, stopped = null;
  for (const m of all) {
    if (work.chars > work.limit) { stopped = m.key; break; }
    yield m;
    const d = m.detect(dctx) || { match: false };
    if (!d.match) continue;
    considered.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
    if (!best || confidenceRank(d.confidence) > confidenceRank(best.confidence)) best = { member: m, ...d };
    if (d.confidence === CONFIDENCE.CERTAIN) break;
  }
  const r = best
    ? { member: best.member, confidence: best.confidence, signals: best.signals || [], considered, matched: true }
    /* The engine's last resort is the LAST member when none is a fallback; here
       an unrecognised document is never read as a type that did not recognise it. */
    : { member: all.find((m) => m.fallback === true) || NO_TYPE, confidence: CONFIDENCE.NONE, signals: [], considered, matched: false };
  const also = yield* alsoWalk(dctx, r, all, work, (key) => { stopped = stopped || key; });
  const out = { type: r.member, confidence: r.confidence, signals: r.signals, considered: r.considered, also };
  if (classified_over) out.classified_over = classified_over;
  out.work = { chars: work.chars, limit: work.limit, stopped_before: stopped };
  /* A "no" says which no (R35): nothing recognised, and so the registered fallback's reading. */
  if (r.member === NO_TYPE)
    out.why = localize("docprofile.registry.no_content_type_is_registered_to_recognise", "no content type is registered to recognise documents, so this one is not read as any type: nothing is read from it and what changes in it is not described");
  else if (!r.matched)
    out.why = localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described");
  /* The budget ran out before every type was asked: stated, never silent (R-SILENT). */
  if (stopped)
    out.why = [out.why, localize("docprofile.registry.the_work_budget_ran_out_before_every_type_was_asked",
      "the types examined {chars} characters of this text, over the {limit} allowed, so the {key} content type and those after it were not asked",
      { chars: String(work.chars), limit: String(work.limit), key: String(stopped) })].filter(Boolean).join("; ");
  return out;
}

/* `also` for the answer `recognise` just gave, asking no type twice (G48; R5). `recognise` asks the members in order and
   stops at the first CERTAIN match, and its `considered` holds, for each member that matched, the very `{key, confidence,
   signals}` entry `alsoFor` builds; so every member up to the winner was already asked, and only those registered AFTER a
   winner that stopped the walk are left to ask. A winner chosen by rank, and no winner, mean every member was asked. The
   result is `alsoFor(ctx, winner.key)`'s, entry for entry and in registration order; `alsoFor` below stays as the independent
   spelling the suite compares it to. The work budget (R40) ends this pass too. */
function* alsoWalk(ctx, r, all, work, stop) {
  const fallback = new Set(all.filter((m) => m.fallback === true).map((m) => m.key));
  const out = r.considered.filter((c) => c.key !== r.member.key && !fallback.has(c.key));
  if (!r.matched || r.confidence !== CONFIDENCE.CERTAIN) return out;
  const after = all.findIndex((m) => m.key === r.member.key) + 1;
  const rest = [];
  for (const m of all.slice(after)) {
    if (m.key === r.member.key || m.fallback === true) continue;
    if (work.chars > work.limit) { stop(m.key); break; }
    yield m;
    let d;
    try { d = m.detect(ctx) || { match: false }; }
    catch (e) { rest.push({ key: m.key, confidence: null, signals: [], error: String((e && e.message) || e) }); continue; }
    if (d.match) rest.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
  }
  return [...out, ...rest];
}

/** Every registered type OTHER than `selfKey` whose own `detect` matches this text.
 *  Exported for the suite and for callers that want the fact without a full profile. */
export function alsoFor(ctx, selfKey) { return askAll(ctx, types.all(), selfKey); }

function askAll(ctx, members, selfKey) {
  const out = [];
  for (const m of members) {
    if (m.key === selfKey || m.fallback === true) continue;
    let d;
    try { d = m.detect(ctx) || { match: false }; }
    catch (e) { out.push({ key: m.key, confidence: null, signals: [], error: String((e && e.message) || e) }); continue; }
    if (d.match) out.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
  }
  return out;
}

export * from "./index.mjs";
