/* Content types: WHAT a document is, as distinct from HOW it was built.
 *
 * A separate axis from the stack handler, and the separation is load-bearing. A
 * meeting calendar served by Legistar on ASP.NET and one served by Granicus on
 * something else are the SAME KIND OF THING built two ways: the questions "what
 * counts as a meaningful change here" and "what connections does this imply" have
 * one answer for both, while "which bytes are per-render machinery" has two. The
 * earlier version hung a kind() off the stack handler, which meant every new stack
 * re-answered every content question from scratch.
 *
 * A content type answers four things and nothing else:
 *
 *   detect   is this that kind of document?
 *   parse    what is IN it? entities, with stable keys and their own facts.
 *   assess   given two parses, did anything MEANINGFUL change, and how badly?
 *   connections  what referential and temporal links does this imply?
 *
 * THE STANDING RULE, inherited and it applies harder here than anywhere. A content
 * type that reports change when nothing meaningful happened costs a member some
 * attention. One that stays quiet when something did puts a false reassurance in
 * the record. So an unmeasured content type is NOT written: the generic fallback
 * reports any substantive difference without describing it, which is noisy and
 * honest, and the noise is the signal that the type is worth measuring.
 *
 * The types themselves are `doctypes`' and the other readers' (R36), registered through
 * `./registry.mjs`' seam; this file holds the helpers they share and nothing a place or a
 * type owns.
 */

/* The content-type axis uses the ONE confidence ladder, re-exported here so content
   types can pull it alongside entity/connection. TYPE_CONFIDENCE is gone: it was
   CONFIDENCE duplicated because this axis was split off after the stack axis already
   had a ladder (CONSTRUCTS Step 0 #1). A content type simply never returns `possible`;
   the ladder is still one ladder. */
export { CONFIDENCE } from "../../site-profiles/index.mjs";

/* What WATCHING this kind of document should do, DECLARED by the content type rather
   than derived from the stack handler (CONSTRUCTS Step 0 #4). The kind is the content
   type's business now, and so is the contract that follows from it. `unmonitorable`
   is the shell case, which the stack axis already settles at layer 1 of assess(); a
   content type declares SUBSTANCE (watch its own substance — the normal case) or
   MEMBERSHIP (watch which entries are present and whether each still says what it
   said — a list). */
export const CONTRACT = { SUBSTANCE: "substance", MEMBERSHIP: "membership", UNMONITORABLE: "unmonitorable" };

/* ------------------------------------------------------------------------- *
 * FW-18 — THE TWO THINGS M0-32's CENSUS MEASURED THAT CHANGE HOW A TYPE IS
 * WRITTEN. Both are properties of the corpus, not of any one reader, so the
 * apparatus for them lives here once rather than in each type.
 * ------------------------------------------------------------------------- */

/** Collapse a document's text to ONE LINE of single-spaced words, for matching a
 *  PHRASE.
 *
 *  MEASURED, and it is the reason this exists rather than a convenience. Tier-1
 *  text is not one shape across producers. Legistar's minutes and agendas arrive
 *  as clean lines, so a line-anchored test works on them. The same extractor over
 *  the City of Oakland's own published PDFs breaks words and phrases across line
 *  boundaries wherever the page laid them out that way — a real ordinance read in
 *  this item opens `R\nESOLUTION \nN\nO\n.` from a drop cap, and its enacting
 *  formula `NOW, THEREFORE, THE CITY COUNCIL ... DOES ORDAIN AS\nFOLLOWS` is split
 *  mid-sentence. A phrase test anchored to lines would have found neither, and
 *  would have looked like a document that is not an ordinance rather than like a
 *  matcher that cannot see one.
 *
 *  So: PHRASES are matched over this normalisation, and LINE ANCHORING is kept
 *  only where the principle is genuinely about a line (see `selfNaming`). */
export function flatten(text) {
  return String(text || "").replace(/\s+/g, " ");
}

/** How many times a document NAMES ITSELF as a kind, on a line of its own.
 *
 *  THIS IS M0-32's DEFECT CLASS ANSWERED STRUCTURALLY. All five defects its
 *  recogniser made were ONE shape: a REFERENCE to a kind mistaken for MEMBERSHIP
 *  of it — a staff report that mentions an ordinance is not an ordinance. The
 *  same shape was measured in this item, twice and in both directions, on real
 *  documents:
 *
 *    - a set of Oakland minutes says `On The July 21, 2026 City Council Agenda On
 *      Consent` of nearly every item, and the registered `meeting_agenda` type
 *      read the whole document as an agenda at CERTAIN confidence because of it;
 *    - the same minutes carry two lines that are exactly `Agenda`, which are the
 *      wrapped tails of attachment titles (`Draft July 28, 2026 Cancelled Finance
 *      And Management Committee` / `Agenda`) — a reference that even survives
 *      line anchoring;
 *    - and the agenda of that same meeting says `There Are No Minutes To Be
 *      Approved`, which is a reference to minutes inside an agenda.
 *
 *  WHAT SEPARATES THEM IS NOT THE WORD, IT IS THE RATE. A document's self-naming
 *  sits in its masthead, and a masthead is PAGE FURNITURE: it recurs once per
 *  page. Measured on three real documents — 25 occurrences over 25 pages of one
 *  set of minutes, 37 over 37 pages of another, 33 over 33 pages of the agenda —
 *  against 2 for the reference and 0 the other way. A reference occurs once or
 *  twice wherever the prose happened to need it.
 *
 *  So a type asks for the COUNT and decides what the count entitles it to. That is
 *  a principle (furniture recurs, a mention does not) rather than a list of
 *  spellings, which is what WORKER.md means by inverting instead of lengthening.
 *
 *  WHAT IT CANNOT SEE, stated because the sentence is load-bearing: a genuinely
 *  ONE-PAGE document of any of these kinds names itself ONCE and is
 *  indistinguishable by this test from a one-line reference. Every type here
 *  therefore keeps a path that reaches `likely` on other evidence alone, and none
 *  of them refuses a document for naming itself only once. */
export function selfNaming(text, re) {
  let n = 0;
  for (const line of String(text || "").split(/\r?\n/)) if (re.test(line.trim())) n++;
  return n;
}

/** The threshold `selfNaming` counts against: a masthead is furniture, and
 *  furniture recurs. Three is the smallest count that cannot be one wrapped title
 *  plus one prose mention, which is exactly the pair measured in the minutes
 *  above. Named once so the four types cannot drift apart on it. */
export const FURNITURE_RECURS = 3;

/** WHAT ELSE THIS DOCUMENT IS. M0-32 measured that 52 of 600 sampled documents —
 *  about one in twelve — satisfied MORE THAN ONE class, because Oakland publishes
 *  agenda packets that genuinely contain an agenda, its staff reports and its
 *  draft resolutions. §2's conclusion is that a content type which assumes one
 *  document is one kind will mis-describe one document in twelve.
 *
 *  THE ENGINE CANNOT SAY THIS AND IS NOT BEING CHANGED TO. `makeRegistry`'s
 *  `recognise` stops at the FIRST CERTAIN detection, so its `considered` list is
 *  truncated at whatever won and cannot report a second class. That break is the
 *  stack axis's behaviour too and is not FRAMEWORK's alone to move; the registry
 *  (`doctypes/registry.mjs`) instead asks every type INDEPENDENTLY, as an
 *  ADDITIVE second pass that changes no verdict, and a reader states what else
 *  its own text satisfies as a document FACT so the answer reaches the record
 *  rather than only the profile.
 *
 *  `alsoSatisfies(ctx, self)` returns the keys of the other registered types whose
 *  own `detect` matches this same text, so a reader's facts can carry it. It is
 *  wired by the registry, which is the only place that knows every type; a reader
 *  called directly gets an honest empty list rather than a TypeError. */
export function alsoSatisfies(ctx, selfKey) {
  const f = ctx && typeof ctx.alsoSatisfies === "function" ? ctx.alsoSatisfies : null;
  if (!f) return [];
  try { return f(selfKey) || []; } catch { return []; }
}

import { combine as jurisdictionsCombine, list as jurisdictionsList } from "../../jurisdictions/index.mjs";

/* ------------------------------------------------------------------------- *
 * N3 — LOCAL VOCABULARY COMES FROM THE JURISDICTION VIEW, never from here.
 *
 * `ctx.view` is the combined view of the instance's active jurisdiction profiles
 * (`jurisdictions.combine`, its R13): the profile shape, each fact a
 * `{pattern: {re, flags}, basis, profile}` entry. Everything a content type knows
 * about ONE jurisdiction's clerks, offices, codes and record systems is read from
 * it through the helpers below. What stays in code is what any jurisdiction's
 * documents share: the words of the kind (minutes, agenda, ordain, WHEREAS),
 * the publishing vendor's own page shapes, and the measured structural floors.
 *
 * A VIEW WITHOUT THE FACT MEANS NO LOCAL RECOGNITION — never a default. An absent
 * section supplies nothing (jurisdictions R1, R16), so a type reads fewer references
 * and says so; it never falls back to one place's words.
 *
 * NO VIEW AT ALL is a legacy caller (K39): `legacy-index` does not pass one yet.
 * Until it does (plan entry N21), such a caller reads with `jurisdictions.combine` of
 * every NON-TEST profile `jurisdictions` holds, so the instance keeps recognising the
 * documents it recognised before N3. A caller that wants no local recognition passes
 * an empty view (`combine([]).view`), which is a view.
 *
 * A pattern is used AS ITS PROFILE WROTE IT, anchors and all, wherever it names a
 * whole thing a line may be (furniture, a member's title, a report's title or
 * section); a reader wraps it only where the reader supplies the position (a file
 * number alone on its line, or bounded inside prose; a code's name before the part
 * cited). A pattern that does not compile is skipped, not thrown: `validate` refuses
 * such a profile upstream, and a reader must not fail on one that slipped through.
 * ------------------------------------------------------------------------- */

let LEGACY_VIEW = null;
/** The view a reader uses: the caller's, or for a caller that gives none (K39), the
 *  combination of every non-test held profile, computed once. */
export function readerView(ctx) {
  const v = ctx && ctx.view;
  if (v && typeof v === "object") return v;
  if (LEGACY_VIEW === null) {
    LEGACY_VIEW = {};
    try {
      /* `typeof`, because the UI's flattened copy of this package carries no
         `jurisdictions`, and there the fallback is an empty view, not a crash. */
      if (typeof jurisdictionsCombine === "function" && typeof jurisdictionsList === "function") {
        const r = jurisdictionsCombine(jurisdictionsList().filter((x) => !x.test).map((x) => x.id));
        if (r && r.ok && r.view) LEGACY_VIEW = r.view;
      }
    } catch { LEGACY_VIEW = {}; }
  }
  return LEGACY_VIEW;
}

const VOCAB_REGEX_CACHE = new Map();

/** Compile one profile pattern `{re, flags}`, `wrap` turning its source into the
 *  expression a reader needs (anchored to a line, bounded by words) and `extra`
 *  adding reader-side flags (`g`, `m`). The profile's own flags are kept and only
 *  `i`/`u` are honoured (jurisdictions R2). Returns null when it cannot compile. */
export function vocabRegex(p, wrap, extra) {
  if (!p || typeof p.re !== "string" || !p.re.length) return null;
  const own = String(p.flags || "").replace(/[^iu]/g, "");
  const flags = [...new Set((own + (extra || "")).split(""))].join("");
  const src = typeof wrap === "function" ? wrap(p.re) : p.re;
  const k = src + "\u0000" + flags;
  if (VOCAB_REGEX_CACHE.has(k)) return VOCAB_REGEX_CACHE.get(k);
  let re = null;
  try { re = new RegExp(src, flags); } catch { re = null; }
  VOCAB_REGEX_CACHE.set(k, re);
  return re;
}

/** The entries of one `vocabulary` key in the view, or an empty list. */
export function vocabulary(ctx, key) {
  const v = readerView(ctx).vocabulary;
  const list = v && typeof v === "object" ? v[key] : null;
  return Array.isArray(list) ? list.filter((e) => e && typeof e === "object") : [];
}

/** The compiled patterns of one vocabulary key, each wrapped the same way. */
export function vocabPatterns(ctx, key, wrap, extra) {
  const out = [];
  for (const e of vocabulary(ctx, key)) {
    const re = vocabRegex(e.pattern, wrap, extra);
    if (re) out.push(re);
  }
  return out;
}

/** Wrappers for the positions a reader supplies: a body's name ending a line, or a
 *  reference bounded by non-letters inside prose. */
export const LINE_END = (re) => `(?:${re})\\s*$`;
export const IN_PROSE = (re) => `(?<![A-Za-z0-9])(${re})(?![A-Za-z0-9])`;

/** Does any of these compiled patterns match this string? */
export function anyMatch(patterns, s) {
  for (const re of patterns) { re.lastIndex = 0; if (re.test(s)) return true; }
  return false;
}

/** Every match of several global patterns over one string, merged in reading
 *  order, overlaps dropped (the earlier, then longer, match is kept). `tag` is
 *  carried from the pattern's own entry so a reader knows WHICH fact matched. */
export function allMatches(tagged, s) {
  const hits = [];
  for (const { re, tag } of tagged) {
    if (!re || !re.global) continue;
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) if (m[0].length) hits.push({ m, tag });
  }
  hits.sort((a, b) => a.m.index - b.m.index || b.m[0].length - a.m[0].length);
  const out = [];
  let end = -1;
  for (const h of hits) {
    if (h.m.index < end) continue;
    out.push(h);
    end = h.m.index + h.m[0].length;
  }
  return out;
}

/** A pattern's source as a piece of a larger expression: its own `^`/`$` anchors
 *  removed, since a form written to match a whole value is embedded here in prose. */
function vocabPiece(re) {
  return String(re).replace(/^\^/, "").replace(/(?<!\\)\$$/, "");
}

/** The enactment space's recognisers (jurisdictions R3, `spaces.enactment`): one
 *  per KIND of instrument, matching the kind's words, an optional `No.`, and a
 *  number in one of the space's forms, followed by any series marker the view's
 *  `enactment_markers` hold. `number` is optional when `blankNumber` is set, for a
 *  proposed instrument's own caption (`ORDINANCE NO. ____`). Each result is
 *  `{re, tag: {kind}}` with the number in the named group `num`. */
export function enactmentPatterns(ctx, { blankNumber = false } = {}) {
  const v = readerView(ctx);
  const sp = v.spaces && v.spaces.enactment;
  if (!sp || typeof sp !== "object") return [];
  const formList = (Array.isArray(sp.forms) ? sp.forms : [])
    .filter((f) => f && f.pattern && typeof f.pattern.re === "string" && vocabRegex(f.pattern));
  const forms = formList.map((f) => vocabPiece(f.pattern.re));
  const markers = vocabulary(ctx, "enactment_markers")
    .map((e) => e.pattern && typeof e.pattern.re === "string" ? e.pattern.re : null)
    .filter((s) => s && vocabRegex({ re: s }));
  if (!forms.length && !blankNumber) return [];
  const num = forms.length ? `(?<num>${forms.map((s) => `(?:${s})`).join("|")})` : "(?<num>(?!))";
  const tail = markers.length ? `(?:\\s*(?:${markers.map((s) => `(?:${s})`).join("|")}))?` : "";
  const out = [];
  for (const k of Array.isArray(sp.kinds) ? sp.kinds : []) {
    if (!k || typeof k.kind !== "string" || !k.prefix || typeof k.prefix.re !== "string") continue;
    const body = blankNumber
      /* A caption, not the kind's word in a sentence: after the kind's words comes
         `No.`, the form's blank, or the number itself. */
      ? `(?<![A-Za-z0-9])(?:${vocabPiece(k.prefix.re)})(?=\\s*(?:[Nn][Oo](?![A-Za-z])|_|\\d))\\s*(?:[Nn][Oo]\\.?\\s*)?[_\\s]*${num}?\\s*[_\\s]*${tail}`
      : `(?<![A-Za-z0-9])(?:${vocabPiece(k.prefix.re)})\\s*(?:[Nn][Oo]\\.?\\s*)?${num}(?![0-9])${tail}`;
    /* Case follows the kind's own words: the prefix's flags decide, so a profile
       that wrote its kinds case-insensitively matches a capitalised caption. */
    const re = vocabRegex({ re: body, flags: k.prefix.flags }, null, "g");
    if (re) out.push({ re, tag: { kind: k.kind.toLowerCase(), forms: formList } });
  }
  return out;
}

/** An instrument's number as the space's own form normalises it (jurisdictions R3):
 *  the matched text is cleaned as the form says, matched by the form AS WRITTEN, and
 *  composed from its `normal` parts. A form never changes a digit; a text no form
 *  recognises gives null, and the reference is not read rather than read wrongly. */
export function enactmentNumber(forms, text) {
  if (typeof text !== "string" || !text.trim()) return null;
  for (const f of forms || []) {
    let t = text.trim();
    const c = f.clean || {};
    for (const s of Array.isArray(c.strip) ? c.strip : []) {
      const re = vocabRegex(s, (x) => `^(?:${x})`);
      if (re) t = t.replace(re, "");
    }
    if (c.spaces === "remove") t = t.replace(/\s+/g, "");
    else if (c.spaces === "collapse") t = t.replace(/\s+/g, " ");
    if (c.upper === true) t = t.toUpperCase();
    const re = vocabRegex(f.pattern);
    const m = re && re.exec(t);
    if (!m) continue;
    let out = "";
    for (const part of Array.isArray(f.normal) ? f.normal : []) {
      if (typeof part === "string") { out += part; continue; }
      if (!part || !Number.isInteger(part.group)) continue;
      let g = m[part.group];
      if (g == null) g = typeof part.default === "string" ? part.default : "";
      if (part.unpad) g = g.replace(/^0+(?=.)/, "");
      if (part.upper) g = g.toUpperCase();
      out += g;
    }
    if (out) return out;
  }
  return null;
}

/** The codes of law the view names (jurisdictions R6 `codes`), each as a recogniser
 *  for a citation of one of its parts: the code's name or abbreviation, then the
 *  words any code is cited by (`Section`, `Chapter`), then the part's number in
 *  the named group `sec`. The tag carries the code's own `key` and `label`, which
 *  prefix the reference's key and show it. */
export function codePatterns(ctx) {
  const out = [];
  for (const c of vocabulary(ctx, "codes")) {
    if (typeof c.key !== "string" || !c.key) continue;
    const re = vocabRegex(c.pattern,
      (s) => `(?<![A-Za-z0-9])(?:${vocabPiece(s)})\\s+(?:Section|Chapter|Sec\\.)\\s+(?<sec>\\d[\\d.]*[\\w.]*)`, "g");
    if (re) out.push({ re, tag: { key: c.key, label: typeof c.label === "string" && c.label ? c.label : c.key } });
  }
  return out;
}

/** The view's `practice` value for `name`, or null when no profile supplies it (or
 *  profiles disagreed and it was withheld, jurisdictions R15). `count` is the unit the
 *  profile counts it in (`business`, `calendar`) when it states one, else null: a reader
 *  must never count business days as calendar days (OMC 2.20.160; K1519). */
export function practiceValue(ctx, name) {
  const p = readerView(ctx).practice;
  const v = p && p[name];
  return v && Number.isInteger(v.value) && v.value > 0
    ? { value: v.value, basis: v.basis || null, count: typeof v.count === "string" && v.count ? v.count : null }
    : null;
}

/** An entity a content type found in a document. `key` must be stable across
 *  fetches: a position in a list is not a key, an id in a URL is. `facts` are the
 *  fields whose change might mean something, named so assess() can say WHICH
 *  moved rather than that the entity differs.
 *
 *  FW-17 / IC-86 — `source`: WHERE IN THE DOCUMENT this reference was read, in
 *  IC-1's element-reference union and no other vocabulary
 *  (`pdf-page`/`sheet-cell`/`slide-shape`/`doc-para`; `dom` has no producer and
 *  is not emitted). It is OPTIONAL and `null` is both legal and meaningful.
 *
 *  THE ONLY LEGITIMATE SOURCE OF THIS VALUE IS `ctx.locate(offset)`, which
 *  `readtext.mjs` puts on the reader's context: the reader knows which OFFSET
 *  of the text it read the reference at, and only the producer knows which page
 *  or paragraph of the container that offset is in. A reader that composes a
 *  `source` itself is inventing an address, which is the one thing an address
 *  may never be.
 *
 *  AND A NULL IS NOT A DOCUMENT-GRAIN CLAIM. An absent position means THIS
 *  READING CANNOT SAY WHERE — never "the whole document was meant". Bob's
 *  ruling of 2026-09-14 (5.3) is that a citation naming no part means the whole
 *  document, and that is a MEMBER'S act of citation; it is not a reader's
 *  silence. Collapsing the two would let a reader's shortcoming read as a
 *  member's choice, which is the record claiming more than it holds. */
export function entity(key, kind, label, facts, source) {
  const e = { key: String(key), kind, label, facts: facts || {} };
  /* Carried only when the locator actually answered — an explicit `source: null`
     and an absent `source` mean the same thing and the shape says so once. */
  if (source) e.source = source;
  return e;
}

/** D-454 — A REFERENCE READ AGAIN IS ANOTHER OCCURRENCE, NOT NOTHING. A reader keeps ONE
 *  entity per key (its facts and label come from the first sighting, and `diffEntities`
 *  diffs by key), and until this every later sighting was dropped whole — so a file
 *  number listed on pages 3, 9 and 14 was recorded as read on page 3 alone, and a member
 *  choosing which mention a connection rests on could not choose page 9. `occurrences`
 *  is EVERY place the reference was read, in reading order, the first included; an entry
 *  is null where the locator could not say. It is carried only once a second sighting
 *  exists, so a reference read once has the shape it always had. `source` stays the first
 *  sighting's, unchanged. The same rule as `source` binds each entry: only `ctx.locate`
 *  may produce it. */
export function readAgain(e, source) {
  if (!e) return e;
  if (!Array.isArray(e.occurrences)) e.occurrences = [e.source || null];
  e.occurrences.push(source || null);
  return e;
}

/** Referential and temporal connections are different things and must not be
 *  collapsed into one edge type.
 *
 *  REFERENTIAL says two documents are ABOUT each other: this agenda item cites that
 *  ordinance; these minutes belong to that meeting; this staff member sits in that
 *  department. It is a claim about meaning, it is symmetric in interest if not in
 *  direction, and a reader follows it to understand SCOPE.
 *
 *  TEMPORAL says one thing happened AFTER another and the sequence matters: minutes
 *  were published after the meeting they record; a title changed on a date; an item
 *  was withdrawn before it was heard. It is a claim about a sequence, it is
 *  strictly directional, and a reader follows it to understand a STORY. Its most
 *  valuable form is often an ABSENCE with a due date attached: minutes that have not
 *  appeared three weeks after a meeting are a fact about the body, not a gap in the
 *  record.
 *
 *  People reason about these differently and so do their assistants, so they are
 *  emitted as different kinds and the UI shows them apart. */
export const CONNECTION = { REFERENTIAL: "referential", TEMPORAL: "temporal" };

export function referential(from, to, relation, why) {
  return { connection: CONNECTION.REFERENTIAL, from, to, relation, why };
}
/** `expected_by` turns an absence into a fact with a date on it. */
export function temporal(from, to, relation, { at, expected_by, why } = {}) {
  return { connection: CONNECTION.TEMPORAL, from, to, relation, at: at || null,
           expected_by: expected_by || null, why };
}

/** Diff two entity sets by key, reporting which FACTS moved rather than that the
 *  entity differs. A content type decides what each moved fact means; this only
 *  finds them. */
export function diffEntities(before, after) {
  const b = new Map(before.map((e) => [e.key, e]));
  const a = new Map(after.map((e) => [e.key, e]));
  const gone = [], appeared = [], altered = [];
  for (const [k, was] of b) {
    const now = a.get(k);
    if (!now) { gone.push(was); continue; }
    const moved = [];
    for (const f of new Set([...Object.keys(was.facts), ...Object.keys(now.facts)]))
      if (String(was.facts[f]) !== String(now.facts[f]))
        moved.push({ fact: f, was: was.facts[f], now: now.facts[f] });
    if (moved.length) altered.push({ entity: now, was, moved });
  }
  for (const [k, now] of a) if (!b.has(k)) appeared.push(now);
  return { gone, appeared, altered, before_count: b.size, after_count: a.size };
}
