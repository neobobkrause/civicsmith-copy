/* site-profiles — recognising which host stack served a document, and what follows.
 * (Split from docprofile, K653 BOB-2: the host-stack axis, the shared recogniser
 * registry and ladder, the three digests, fidelity, the profile record and the event
 * catalogue. docprofile keeps the content-type axis, `assess` and `readText`.)
 *
 * WHY THIS PACKAGE EXISTS. Two requirements drive it, both of them Bob's and both
 * about credibility rather than tidiness.
 *
 *   A rendition must be perceived as rendering MEANINGFULLY THE SAME as the
 *   document does on its host, because a member will present portions of it as
 *   evidence, and the system has to be able to say those portions are the same as
 *   the original and be believed.
 *
 *   The system must recognise when something meaningful in the EVIDENTIARY
 *   portions has changed since the last fetch, and equally, must recognise when it
 *   has NOT. Both directions matter. A checker that only ever says "changed"
 *   is as useless as one that only ever says "unchanged".
 *
 * Neither requirement can be met by looking at a document's bytes. Measured on
 * real municipal sources:
 *
 *   oakland.legistar.com (ASP.NET WebForms on IIS): two fetches three seconds
 *   apart differ by 115,980 bytes, 31.4% of the document, every differing byte
 *   inside __VIEWSTATE and __EVENTVALIDATION. Content identical.
 *
 *   oaklandside.org (WordPress behind nginx): two fetches BYTE-IDENTICAL. No
 *   per-render mechanism at all.
 *
 *   oaklandca.opengov.com (client-rendered app): the served HTML is a shell. It
 *   carries no anchors and no evidentiary content whatsoever. Its bytes are
 *   perfectly capturable and perfectly worthless as evidence.
 *
 * One comparison rule cannot serve those three. Before this package, each was
 * handled by another special case bolted onto the capture path, which is how a
 * codebase stops being reasoned about.
 *
 * THE MODEL. A document has three kinds of region, and everything else follows
 * from separating them:
 *
 *   EVIDENTIARY   the substance. What a member would quote, cite, or put in front
 *                 of a council. Change here is meaningful and must be reported.
 *   PRESENTATIONAL  furniture: navigation, headers, footers, related-links rails.
 *                 Real, captured, rendered, and NOT the document's claim about its
 *                 own subject. Change here is recorded and is not a change to the
 *                 evidence.
 *   MECHANICAL    per-render machinery: page state, security tokens, session ids,
 *                 cache stamps, ad and analytics slots. Varies on every fetch by
 *                 design. Never evidence, never a change, and never shown.
 *
 * THREE DIGESTS, not one. This is the core correction over the single "stable
 * digest" that preceded it, which conflated presentational with mechanical and so
 * could not answer the question a member actually asks.
 *
 *   identity     sha256 of the raw bytes. The capture's name. Never changes,
 *                never recomputed, and raw bytes are never rewritten.
 *   rendition    mechanical regions normalised. Answers "would this look the
 *                same?", which is the question the fidelity claim rests on.
 *   evidentiary  presentational AND mechanical regions normalised. Answers "has
 *                the substance changed?", which is the question monitoring asks.
 *
 * THE FAILURE ASYMMETRY, and it governs every default in this package. Reporting
 * a change that did not happen costs a member some attention. Failing to report a
 * change that DID happen puts a false claim in the record and is discovered, if
 * ever, by the party the claim is aimed at. So an unrecognised document gets the
 * conservative handler, where nothing is presumed presentational and almost
 * nothing mechanical, and the system over-reports rather than under-reports.
 * Handlers earn the right to narrow that, per stack, on measurement.
 */

import { makeRegistry, CONFIDENCE } from "./recogniser.mjs";
import { REGION } from "./region.mjs";
import aspnetWebforms from "./handlers/aspnet-webforms.mjs";
import wordpress from "./handlers/wordpress.mjs";
import clientRendered from "./handlers/client-rendered.mjs";
import conservative from "./handlers/conservative.mjs";
import * as ooxml from "../bio-plane/src/ooxml.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/* The module's whole interface is reachable from this file: the ladder and the
   registry (recogniser.mjs), the event catalogue (events.mjs), the regions and the
   four built-in handlers. */
export * from "./recogniser.mjs";
export * from "./events.mjs";
export { REGION, aspnetWebforms, wordpress, clientRendered, conservative };

/** Entity-decode enough to make an href comparable. Deliberately minimal: this is
 *  used to READ keys out of markup, never to rewrite anything the record holds.
 *  One pass, so an escaped entity stays escaped once: `&amp;lt;` reads `&lt;`. */
const ENTITY = { amp: "&", "#39": "'", quot: '"', lt: "<", gt: ">", nbsp: " " };
export function unescapeHtml(s) {
  return String(s).replace(/&(amp|#39|quot|lt|gt|nbsp);/g, (_, e) => ENTITY[e]);
}

const PLACEHOLDER = "\u0000BIO-NORMALISED\u0000";

/** Apply a handler's rule set to a copy of the text, reporting what it touched.
 *  Never mutates anything the record holds: normalisation is always on a copy,
 *  so a misclassification is recoverable and can never destroy evidence. */
export function applyRules(text, rules) {
  let out = String(text);
  const found = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || !Array.isArray(rule.patterns)) continue;
    let count = 0, bytes = 0;
    for (const re of rule.patterns) {
      if (!(re instanceof RegExp)) continue;
      out = out.replace(re, (whole, pre, mid, post) => {
        if (!mid || !mid.length) return whole;
        count++; bytes += mid.length;
        return (pre || "") + PLACEHOLDER + (post || "");
      });
    }
    if (count) found.push({ rule: rule.key, region: rule.region, label: rule.label, count, bytes });
  }
  return { text: out, found, bytes: found.reduce((n, f) => n + f.bytes, 0) };
}

/** Normalise everything OUTSIDE the document's own boundary.
 *
 *  A second rule shape, and the measurements forced it. Legistar carries no
 *  <nav>, no <header> and no <footer> at all: its furniture is ASP.NET control
 *  divs with generated ids, and an earlier rule that guessed at those ids matched
 *  303 bytes on a 369KB page, which is to say it did nothing while appearing to
 *  work. What Legistar DOES carry is one <main role="main">, and that is the
 *  document. So a handler may declare a BOUNDARY instead of listing furniture,
 *  and everything outside it becomes presentational in one stroke.
 *
 *  This is also the more conservative shape. Listing furniture means anything not
 *  listed silently counts as substance; naming the boundary means anything outside
 *  it counts as furniture, and the boundary is a single structural fact that is
 *  either there or not, rather than a growing catalogue of theme-specific guesses.
 *
 *  If the boundary does not match, NOTHING is normalised and the handler falls
 *  back to treating the whole document as substance, because a boundary that
 *  missed must never be read as a document with no content. */
export function applyBoundary(text, boundary) {
  if (!(boundary instanceof RegExp)) return { text, found: [], bytes: 0 };
  const m = boundary.exec(String(text));
  if (!m || !m[1]) return { text, found: [], bytes: 0, missed: true };
  const inner = m[1];
  const outside = String(text).length - inner.length;
  return { text: PLACEHOLDER + inner + PLACEHOLDER,
           found: [{ rule: "outside_the_document", region: REGION.PRESENTATIONAL,
                     label: localize("site-profiles.index.everything_around_the_document_itself", "everything around the document itself, such as navigation and footers"),
                     count: 1, bytes: outside }],
           bytes: outside };
}

/* The encoding the caller knows: an explicit `ctx.charset`, else the `charset` of the content
   type the caller passed or of the response's `content-type` header. */
function declaredCharset(ctx) {
  if (typeof ctx.charset === "string" && ctx.charset) return ctx.charset;
  const ct = String(ctx.content_type || (ctx.headers && ctx.headers["content-type"]) || "");
  const m = /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(ct);
  return m ? m[1] : undefined;
}

/** The three digests for one document, under one handler. */
export async function digests(bytes, handler, ctx) {
  const sha256 = ctx && ctx.sha256;
  /* The one precondition, and the one throw: a digest with no hash function is a
     caller's mistake, not a document's property. */
  if (typeof sha256 !== "function") throw new TypeError("site-profiles: digests() needs ctx.sha256, a hash function");
  const h = handler || {};
  const identity = await sha256(bytes);
  if (!h.textual) return { identity, rendition: identity, evidentiary: identity, applied: [], textual: false };
  /* The one decode (R22, G131g): ooxml's `decodeText`, by the encoding the caller knows (a
     `charset` of the content type) or the document's own declaration or BOM. A declared
     encoding it cannot decode makes the document not textual here: both digests equal the
     identity and the result says why, so nothing is ever compared on replacement characters. */
  const declared = declaredCharset(ctx);
  const dec = ooxml.decodeText(bytes, { declared, name: ctx.name || ctx.locator || declared, kind: "html" });
  if (!dec.ok)
    return { identity, rendition: identity, evidentiary: identity, applied: [], textual: false,
             undecodable: { why: dec.why, name: dec.name },
             why: localize("site-profiles.index.the_document_is_written_in", "the document is written in an encoding this system cannot read, so it is compared byte for byte") };
  const text = dec.text;
  let rules = [];
  try { rules = (typeof h.rules === "function" ? h.rules(ctx) : null) || []; } catch { rules = []; }
  if (!Array.isArray(rules)) rules = [];
  const mech = rules.filter((r) => r && r.region === REGION.MECHANICAL);
  const pres = rules.filter((r) => r && r.region === REGION.PRESENTATIONAL);
  const r1 = applyRules(text, mech);
  /* Mechanical first, always: a security token can sit inside the document's own
     boundary as easily as outside it, and normalising the boundary first would
     hide the token rather than classify it. */
  let boundary = null;
  try { boundary = typeof h.boundary === "function" ? h.boundary(ctx) : null; } catch { boundary = null; }
  const b = applyBoundary(r1.text, boundary);
  /* A DECLARED boundary that missed normalises nothing beyond the mechanical pass:
     the handler said the document is what sits inside that boundary, and when the
     boundary is not there nothing can be called furniture. Falling back to the
     presentational rules would narrow on a guess the handler did not make. Only a
     handler that declares NO boundary uses its presentational rules. */
  const r2 = b.found.length ? b : b.missed ? { text: r1.text, found: [], bytes: 0 } : applyRules(r1.text, pres);
  const enc = new TextEncoder();
  return {
    identity,
    rendition: await sha256(enc.encode(r1.text)),
    evidentiary: await sha256(enc.encode(r2.text)),
    applied: [...r1.found, ...r2.found],
    boundary_missed: !!b.missed,
    mechanical_bytes: r1.bytes, presentational_bytes: r2.bytes,
    textual: true,
    encoding: { name: dec.encoding, assumed: dec.assumed, replaced: dec.replaced,
                replaced_ratio: dec.replaced_ratio, disagree: dec.disagree },
  };
}

/** The layer-3 primitive: has this document changed, and in what sense? NOT a public
 *  entry point — `assess()` is the one entry point for the layered change question
 *  and it CALLS this to settle layers 2 and 3 (CONSTRUCTS Step 0 #2: monitor() was
 *  deleted, compare() demoted to the primitive it always was). It stays exported
 *  only for the pure duplicate-detection caller that wants the L3 answer without the
 *  content-type layers above it, and for the suite that pins its three verdicts.
 *
 *  The answer a member is owed is the `evidentiary` line; everything else is for the
 *  record.
 *
 *  `verdict` is one of:
 *    identical      the source served the same bytes
 *    unchanged      substance and appearance both the same; only machinery moved
 *    restyled       substance the same, appearance differs (furniture moved)
 *    changed        the substance itself differs
 *    undetermined   no handler could speak with enough confidence to say  */
export async function compare(before, after, handler, ctx) {
  const a = await digests(before, handler, ctx);
  const b = await digests(after, handler, ctx);
  const h = handler || {};
  const base = { handler: h.key == null ? null : h.key, confidence: ctx.confidence || CONFIDENCE.NONE,
                 artifacts: [...new Set(a.applied.concat(b.applied).map((x) => x.label))],
                 applied: a.applied, digests: { before: a, after: b } };
  if (a.identity === b.identity)
    return { ...base, verdict: "identical", evidentiary_change: false,
             why: localize("site-profiles.index.the_source_served_exactly_the_same", "the source served exactly the same document") };
  /* Without a confident handler, the narrowing rules are not trusted and the
     honest answer is that the bytes differ and nobody can yet say what that
     means. Silence here is safer than a wrong "unchanged". */
  if (base.confidence !== CONFIDENCE.CERTAIN && !h.conservative)
    return { ...base, verdict: "undetermined", evidentiary_change: null,
             why: localize("site-profiles.index.the_document_differs_and_this_kind", "the document differs and this kind of document is not recognised well enough to say whether the difference matters") };
  if (a.evidentiary !== b.evidentiary)
    return { ...base, verdict: "changed", evidentiary_change: true,
             why: localize("site-profiles.index.the_substance_of_the_document", "the substance of the document differs") };
  if (a.rendition !== b.rendition)
    return { ...base, verdict: "restyled", evidentiary_change: false,
             why: localize("site-profiles.index.the_substance_is_the_same", "the substance is the same; something around it changed, such as navigation or related links") };
  return { ...base, verdict: "unchanged", evidentiary_change: false,
           why: localize("site-profiles.index.the_substance_and_the_appearance", "the substance and the appearance are both the same; only machinery this site rebuilds on every visit differs") };
}

/** Can this capture be shown as a faithful rendition, and if not, what is the
 *  honest claim?
 *
 *  The predecessor to this was all-or-nothing: one missing part refused the whole
 *  render, on the reasoning that a page missing a piece is a different page. That
 *  is right for a stylesheet and wrong for a footer icon, and the requirement is
 *  that the rendition be perceived as MEANINGFULLY the same, which is a claim
 *  about the evidentiary portion and not about every byte of furniture.
 *
 *    faithful      everything render-critical is held
 *    degraded      only non-critical parts are missing; the evidence renders and
 *                  the shortfall is NAMED on screen rather than hidden
 *    insufficient  something render-critical is missing; the render is refused,
 *                  because showing it would misrepresent the source  */
export function fidelity(manifest, handler, ctx) {
  const all = manifest && Array.isArray(manifest.subresources) ? manifest.subresources : [];
  const parts = all.filter((p) => p && typeof p === "object");
  const h = handler || {};
  /* A handler that cannot say is answered in the safe direction: a part is not
     ignorable unless the handler says so, and it is critical unless it says not. */
  const ignorable = (p) => { try { return typeof h.ignorable === "function" && !!h.ignorable(p); } catch { return false; } };
  const critical_ = (p) => { try { return typeof h.renderCritical === "function" ? !!h.renderCritical(p, ctx) : true; } catch { return true; } };
  const missing = parts.filter((p) => !p.ok && !ignorable(p));
  if (!missing.length) return { level: "faithful", missing: [], critical: [] };
  const critical = missing.filter(critical_);
  if (critical.length)
    return { level: "insufficient", missing, critical,
             why: localize("site-profiles.index.a_file_the_page_needs", "a file the page needs in order to look the way the source published it has not been collected") };
  return { level: "degraded", missing, critical: [],
           why: localize("site-profiles.index.everything_the_page_needs_to", "everything the page needs to read correctly is held; some decoration is not") };
}

/* ---- the STACK axis: one registry of the shared shape ----
   The host-stack recognisers live on a `makeRegistry()` instance exactly like the
   content-type axis does, so there is no longer an `identify`-shaped loop written
   twice. The handlers themselves are the recognisers, registered below. */
const stacks = makeRegistry();

/** Add a handler to the stack registry. Ordered most specific first; the conservative
   handler carries `fallback: true` and is only ever reached by falling through. */
export function register(handler) { return stacks.register(handler); }
export function handlers() { return stacks.all(); }

/* The built-in handlers, in priority order: most specific first, and the conservative
   handler last because it never matches and is only ever reached by falling through.
   Adding a stack means adding a file and a line here.

   client_rendered goes FIRST. A shell can also be served by ASP.NET or WordPress,
   and if either of those matched first the document would be profiled as a page
   with content when it has none, which is the one failure that is silent. */
register(clientRendered);
register(aspnetWebforms);
register(wordpress);
register(conservative);

/** Identify the document's host stack. `ctx` carries whatever the caller knows: the
 *  response headers, the locator, the content type, and the decoded text.
 *
 *  A thin wrapper over the shared registry that adds the stack axis's own
 *  extra — the document `kind` its handler reads from the address. Always returns a
 *  handler: an unrecognised document gets the conservative one rather than an error. */
export function identify(ctx) {
  /* A caller that knows nothing still gets an answer: no context is an empty one. */
  if (!ctx || typeof ctx !== "object") ctx = {};
  const r = stacks.recognise(ctx);
  const handler = r.member;
  if (!r.matched)
    return { handler, confidence: CONFIDENCE.NONE, signals: [], considered: r.considered,
             why: localize("site-profiles.index.no_handler_recognised_this_document", "no handler recognised this document, so it is treated conservatively: nothing is assumed to be decoration and any difference is reported") };
  const out = { handler, confidence: r.confidence, signals: r.signals, considered: r.considered };
  /* `kind` is the handler's own classification, given the confidence it matched at; a
     handler that defines none, or answers none, has none. */
  if (typeof handler.kind === "function") {
    const kind = handler.kind(ctx, r.confidence);
    if (kind !== undefined) out.kind = kind;
  }
  /* A shell is a `client_rendered` match at CERTAIN and nothing less (R2, G140): the
     handler's class is `shell`, this answer's `shell` is whether THIS document is one. The
     answer decides how a document is watched and never what is read from it (R21). */
  if (handler.shell && r.confidence === CONFIDENCE.CERTAIN) out.shell = true;
  return out;
}

/** Everything the record should keep about how a document was profiled. Written
 *  onto the capture, because a later session must be able to see WHICH handler
 *  spoke and how sure it was: a verdict whose author is unnamed cannot be
 *  re-evaluated when the author turns out to have been wrong. */
export function profileRecord(id, ctx) {
  const x = id && typeof id === "object" ? id : {};
  const h = x.handler && typeof x.handler === "object" ? x.handler : {};
  return {
    handler: h.key == null ? null : h.key, handler_label: h.label == null ? null : h.label,
    handler_version: h.version == null ? null : h.version,
    confidence: x.confidence == null ? null : x.confidence, signals: x.signals || [],
    document_kind: x.kind || "unknown",
    considered: x.considered || [],
    at: (ctx && ctx.now) || new Date().toISOString().split(".")[0] + "Z",
    note: x.why || null,
  };
}
