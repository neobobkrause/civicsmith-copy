/* D-536 — A READING CARRIES ITS OWN PROVENANCE, AND A RE-READ IS COMPARED WITH THE ONE BEFORE IT.
 *
 * BOB #33 RULED 2026-09-24 21:25Z, folded into `BIO_Content_Framework_v0_10.md` Part II §16
 * ("Reading provenance"): a reading carries its TIER, its PRODUCING MEMBER, the PAGES TRANSCRIBED and
 * a SHA-256 OF THE EXACT TEXT IT CLASSIFIED; a re-read is compared with the earlier one and a
 * disagreement is ATTRIBUTED ("tier 2 on pdf-worker returned different text for pages 3-4"); both
 * readings are kept and neither overwrites; a reading from before this landed reads provenance
 * UNDETERMINED, never inferred.
 *
 * THE MEASURED FAILURE IT MOVES (M-143): the same 332 documents escalated to the plane in two walks of
 * one sample and the classes of several moved, because tiers 2 and 3 did not return the same text
 * twice — and nothing in the record could say WHICH tier's text had changed, because a reading stated
 * only a document-level `text_tier` and the store replaced one reading with the next.
 *
 * TWO FUNCTIONS, both pure, so the acquire path, the read path's re-extraction and the store all use
 * ONE rule:
 *
 *   `readingProvenance`  — composed where the text is final, over the SAME flatten the content-type
 *                          reader classifies (`docprofile/readtext.mjs`'s `flattenText`), so the digest
 *                          is of the exact text classified and not of a second spelling of it.
 *   `compareProvenance`  — the attribution, run by the store when a reading of a capture arrives and an
 *                          earlier one is held.
 *
 * WHERE THE PER-PAGE TIER COMES FROM, IN ORDER, AND WHY THE CHAIN IS FIRST. §16 rules that THE CHAIN IS
 * THE AUTHORITY for a per-page question (D-284): each derivation step names the pages it covers. So a
 * page's tier is read off the chain when there is one — an `ai_transcription` step covering the page is tier 4
 * (R29: the AI's reading, naming its model), a `pixels` step covering the page is tier 3 (no tier-3 route is not an
 * engine over pixels), otherwise the covering `layer` step's own `tier`. Only when
 * no chain speaks for the page does the page's own `tier` stamp (the tier-2 merge's) answer, and only
 * after that the document's tier. A page nothing speaks for reads tier NULL, and says so. */

import { flattenText } from "../../../docprofile/readtext.mjs";
import { word, localize } from "../setup-words/index.mjs";

export const PROVENANCE_SCHEME = "reading-provenance/1";

/* WHICH MEMBER PRODUCES EACH TIER, as the plane wires it (§16's three-tier table). A table and not a
   guess: tier 2 is reached only through the `PDF_WORKER` binding and tier 3 only through `OCR_WORKER`,
   and tier 1 runs inside the plane. A tier this table does not name reads member NULL: tier 4 (R29), the AI's
   reading, is reached through no member of the fleet, and is named by its model (`engine`) instead. */
export const TIER_MEMBERS = Object.freeze({ 1: "plane", 2: "pdf-worker", 3: "ocr-worker" });

/* A whole book's text is hashed in slices through an incremental SHA-256, so the hash never holds a second copy of it
   (an encode of 13.6 million characters is 27-40 MB); the digest is the same as `crypto.subtle`'s over the UTF-8 of `s`. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
/* G82 (fix round 7): the object's one thread is given back between the slices of a big digest, so a cheap read waits for a slice, not for
   the book. A real macrotask turn (a timer), not a resolved promise, which gives nothing back. */
export const yieldNow = () => new Promise((r) => setTimeout(r, 0));
function sha256Core() {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64), block = new Uint8Array(64);
  let fill = 0, total = 0;
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const compress = (b) => {
    for (let i = 0; i < 16; i++) w[i] = (b[4 * i] << 24) | (b[4 * i + 1] << 16) | (b[4 * i + 2] << 8) | b[4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b2, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b2; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  };
  const feed = (bytes) => {
    total += bytes.length;
    let i = 0;
    if (fill) {
      while (i < bytes.length && fill < 64) block[fill++] = bytes[i++];
      if (fill === 64) { compress(block); fill = 0; }
    }
    for (; i + 64 <= bytes.length; i += 64) compress(bytes.subarray(i, i + 64));
    while (i < bytes.length) block[fill++] = bytes[i++];
  };
  const end = () => {
    block[fill++] = 0x80;
    if (fill > 56) { block.fill(0, fill); compress(block); fill = 0; }
    block.fill(0, fill);
    const bits = total * 8;
    new DataView(block.buffer).setUint32(56, Math.floor(bits / 2 ** 32));
    new DataView(block.buffer).setUint32(60, bits >>> 0);
    compress(block);
    return [...h].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  };
  return { feed, end };
}
function sha256Stream(chunks) {
  const core = sha256Core();
  for (const c of chunks) core.feed(c);
  return core.end();
}
async function sha256StreamYielding(chunks) {
  const core = sha256Core();
  for (const c of chunks) { core.feed(c); await yieldNow(); }
  return core.end();
}
const SLICE = 256 * 1024;
function* utf8Slices(s) {
  const enc = new TextEncoder();
  for (let at = 0; at < s.length;) {
    let end = Math.min(s.length, at + SLICE);
    /* never cut a surrogate pair */
    if (end < s.length && (s.charCodeAt(end - 1) & 0xfc00) === 0xd800) end++;
    yield enc.encode(s.slice(at, end));
    at = end;
  }
}
export async function sha256Hex(s, yielding = false) {
  if (s.length > 4 * 1024 * 1024) return yielding ? sha256StreamYielding(utf8Slices(s)) : sha256Stream(utf8Slices(s));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const sha256HexStreamed = (s) => sha256Stream(utf8Slices(s));

/* A step's pages, or "all" for an unscoped step (mergedChain's own shape: a derivation step of a MIXED
   document carries `extent: {kind:"pages", pages}`; one of an unmixed document carries none). */
function stepPages(s) {
  const e = s && s.extent;
  if (e && e.kind === "pages" && Array.isArray(e.pages)) return new Set(e.pages.filter(Number.isInteger));
  return "all";
}
const covers = (pages, p) => pages === "all" || pages.has(p);

/* D-635: the part a step belongs to. `mergedChain` stamps `extent.part` when two parts share a page;
   otherwise the parts partition the pages and a part is named by its page list. */
function partOf(s) {
  const e = s && s.extent;
  if (e && Number.isInteger(e.part)) return `#${e.part}`;
  return e && Array.isArray(e.pages) ? e.pages.join(",") : "all";
}

/* The chain's answers for one page, one per PART that covers it, in chain order: `[{tier, engine}]`, empty
   when no step speaks for it. Within a part the steps are a sequence, so a `pixels` step outranks the
   `layer` step before it. D-635 (BOB #35, 06:25Z): a page whose folio decoded is listed in the layer part
   AND the engine's part, because its text is the folio followed by the transcription. It then has TWO
   producers, and both are named. Before D-635 the parts partitioned the pages, and this answered one. */
function chainTiersOf(chain, page) {
  if (!Array.isArray(chain)) return [];
  const byPart = new Map();
  for (let i = 0; i < chain.length; i++) {
    const s = chain[i];
    if (!s || typeof s !== "object") continue;
    const pages = stepPages(s);
    if (!covers(pages, page)) continue;
    const key = partOf(s);
    const had = byPart.get(key) || { layer: null, pixels: null, ai: null };
    if (s.step === "ai_transcription") {
      /* R29 (T41; text-chain R104): the AI read these pixels. Its kind is tier 4 (`STEP_KINDS`), above the OCR
         engine's rung, and its engine is the model the step names. It outranks the `pixels` step before it, which
         would otherwise read as tier 3's. */
      had.ai = { tier: 4, engine: typeof s.engine === "string" && s.engine
        ? `${s.engine}${s.version ? ` ${s.version}` : ""}` : null };
    } else if (s.step === "pixels") {
      /* The engine is the `ocr` step that READ these pixels — the next step in the same part. */
      const next = chain[i + 1];
      had.pixels = { tier: 3, engine: next && next.step === "ocr" && typeof next.engine === "string"
        ? `${next.engine}${next.version ? ` ${next.version}` : ""}` : null };
    } else if (s.step === "layer") {
      had.layer = { tier: Number.isInteger(s.tier) ? s.tier : null, engine: null };
    }
    byPart.set(key, had);
  }
  return [...byPart.values()].map((h) => h.ai || h.pixels || h.layer).filter(Boolean);
}
/* The chain's answer for one page: `{tier, engine}` or null when no step speaks for it. A page with two
   producers (D-635) answers the LAST, the tier its text was last extended by; `chainTiersOf` names both. */
function chainTierOf(chain, page) {
  const all = chainTiersOf(chain, page);
  return all.length ? all[all.length - 1] : null;
}

/**
 * The provenance of ONE reading.
 *
 * @param {object} a
 * @param {object|string|null} a.text   the I2 text the content-type reader was handed (or null: none)
 * @param {Array|null}         a.chain  the reading's `text_source` chain
 * @param {number|null}        a.tier   the reading's document-level `text_tier`
 * @param {string|null}        a.container  the format key
 * @param {string|null}        a.planeVersion  the plane's VERSION binding, which names tier 1's producer
 * @param {string|null}        a.member  the producer to name when the text is on NO tier of the ladder —
 *                                       an HTML page's text, read at intake in the plane
 * @param {boolean}            a.yielding  a big text's digest gives the turn back between its slices (G82: a read in pieces); false keeps
 *                                         it one stretch and the caller's memory as R36 holds it
 */
export async function readingProvenance({ text = null, chain = null, tier = null, container = null,
                                          planeVersion = null, member: offLadder = null, textFrom = null, yielding = false } = {}) {
  const out = { scheme: PROVENANCE_SCHEME, text_tier: Number.isInteger(tier) ? tier : null,
                container: typeof container === "string" ? container : null,
                text_sha256: null, text_chars: 0, text_from: null,
                producers: [], pages: null, pages_why: null };
  if (text == null) {
    out.why = word("reading-pipeline.why.text_surface_answered");
    out.pages_why = out.why;
    return out;
  }
  const flat = flattenText(text);
  /* `textFrom`: the text was handed without its joined `document` (the reading's memory), which is the pages' own join. */
  out.text_from = textFrom && flat.source === "pages" ? textFrom : flat.source;
  out.text_chars = flat.text.length;
  /* AN EMPTY TEXT IS NOT DIGESTED. Two empty strings agree on nothing (`CLAUDE.md` §5), so a digest of
     one would let two readings that read NOTHING compare as agreeing. */
  out.text_sha256 = flat.text.length ? await sha256Hex(flat.text, yielding) : null;
  /* R18: null for empty text says why, as it does for absent text. */
  if (!flat.text.length) out.why = word("reading-pipeline.why.text_document_yielded");
  const byKey = new Map();
  const credit = (t, engine, page, fallback = null) => {
    const member = t == null ? fallback : (TIER_MEMBERS[t] ?? null);
    const key = `${t}|${member}|${engine || ""}`;
    if (!byKey.has(key))
      byKey.set(key, { tier: t, member,
                       ...(member === "plane" && planeVersion ? { version: String(planeVersion) } : {}),
                       ...(engine ? { engine } : {}), pages: page == null ? null : [] });
    if (page != null) byKey.get(key).pages.push(page);
  };
  const pages = (text && typeof text === "object" && Array.isArray(text.pages)) ? text.pages : null;
  if (pages && pages.some((p) => p && Number.isInteger(p.page))) {
    out.pages = [];
    for (const p of pages) {
      if (!p || !Number.isInteger(p.page)) continue;
      const fromChain = chainTierOf(chain, p.page);
      const t = fromChain && fromChain.tier != null ? fromChain.tier
        : Number.isInteger(p.tier) ? p.tier
        : out.text_tier;
      const pt = typeof p.text === "string" ? p.text : "";
      /* D-635: every producer of a page listed in two parts, in chain order. `tier` and `member` stay the
         last one's, so a page with one producer reads exactly as before; `producers` is added only when
         there are two or more. */
      const several = chainTiersOf(chain, p.page).filter((c) => c.tier != null);
      const entry = { page: p.page, tier: t, member: t == null ? null : (TIER_MEMBERS[t] ?? null),
                      chars: pt.length, text_sha256: pt.length ? await sha256Hex(pt, yielding) : null };
      if (several.length > 1)
        entry.producers = several.map((c) => ({ tier: c.tier, member: TIER_MEMBERS[c.tier] ?? null }));
      out.pages.push(entry);
      /* THE PAGES TRANSCRIBED are the pages that carry text; a page read to nothing is listed on
         `pages` with its tier and no digest, and is not credited to a producer as transcribed. */
      if (pt.length) {
        if (several.length > 1) for (const c of several) credit(c.tier, c.engine, p.page);
        else credit(t, fromChain && fromChain.engine, p.page);
      }
    }
  } else {
    /* NO PAGE GRAIN — an office container, a bare string. The whole text is one producer's, and which
       part of it changed on a re-read is not said, rather than guessed. */
    out.pages_why = word("reading-pipeline.text_carries_per");
    const c = chainTierOf(chain, -1);
    if (flat.text.length) credit(c && c.tier != null ? c.tier : out.text_tier, c && c.engine, null,
           typeof offLadder === "string" && offLadder ? offLadder : null);
  }
  out.producers = [...byKey.values()];
  return out;
}

/* "page 3", "pages 3-4", "pages 1, 3-4" — 1-based, as a reader counts, from I2's 0-based indices. */
export function describePages(list) {
  const ps = [...new Set(list.filter(Number.isInteger))].sort((a, b) => a - b).map((p) => p + 1);
  if (!ps.length) return "no page";
  const runs = [];
  for (const p of ps) {
    const r = runs[runs.length - 1];
    if (r && p === r[1] + 1) r[1] = p; else runs.push([p, p]);
  }
  return `${ps.length === 1 ? "page" : "pages"} ${runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ")}`;
}

const who = (t, m) => (t == null ? word("reading-pipeline.undetermined_tier") : `tier ${t} on ${m || "an unnamed member"}`);
/* D-635: a page with two producers is named by both, so a changed page is never attributed to one of them. */
const whoOf = (p) => (Array.isArray(p.producers) && p.producers.length > 1
  ? p.producers.map((q) => who(q.tier, q.member)).join(" and ") : who(p.tier, p.member));
const isProv = (p) => !!(p && typeof p === "object" && p.scheme === PROVENANCE_SCHEME);

/**
 * Compare a re-read with the reading before it and ATTRIBUTE any difference.
 *
 * Returns `{state, says, changed?}` where `state` is one of
 *   `agrees`        — the same text was classified (by digest);
 *   `differs`       — it was not, and `changed[]` says which pages, by which producer before and now;
 *   `undetermined`  — one side carries no provenance (a reading from before D-536), so which tier's text
 *                     changed CANNOT be said, and is not inferred from `text_tier` or from the chain;
 *   `no_text`       — neither reading classified any text, so there is nothing to compare.
 */
export function compareProvenance(prior, next) {
  if (!isProv(prior) || !isProv(next)) {
    const which = !isProv(prior) && !isProv(next) ? word("reading-pipeline.reading_carries") :
      !isProv(prior) ? word("reading-pipeline.earlier_reading_carries") : word("reading-pipeline.this_reading_carries");
    return { state: "undetermined",
             says: localize("reading-pipeline.readingprov.which_no_reading_provenance_it", "{which} no reading provenance (it was written before D-536, or by a caller that did not carry it), so whether the text changed, and which tier's, is UNDETERMINED — it is not inferred from the document-level tier or from the chain", { which: String(which) }) };
  }
  if (prior.text_sha256 == null && next.text_sha256 == null)
    return { state: "no_text", says: word("reading-pipeline.says.reading_classified_text") };
  if (prior.text_sha256 === next.text_sha256)
    return { state: "agrees", says: word("reading-pipeline.says.read_classified_text") };
  if (!Array.isArray(prior.pages) || !Array.isArray(next.pages)) {
    const pp = (prior.producers || []).map((p) => who(p.tier, p.member)).join(" and ") || who(prior.text_tier, null);
    const np = (next.producers || []).map((p) => who(p.tier, p.member)).join(" and ") || who(next.text_tier, null);
    return { state: "differs", changed: [],
             says: word("reading-pipeline.says.read_classified_different", { pp: String(pp), np: String(np) }) };
  }
  const before = new Map(prior.pages.map((p) => [p.page, p]));
  const after = new Map(next.pages.map((p) => [p.page, p]));
  const all = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);
  const groups = new Map();
  for (const pg of all) {
    const a = before.get(pg) || null, b = after.get(pg) || null;
    if (a && b && a.text_sha256 === b.text_sha256) continue;
    const key = `${a ? whoOf(a) : "-"}|${b ? whoOf(b) : "-"}`;
    const side = (x) => ({ tier: x.tier, member: x.member,
                           ...(Array.isArray(x.producers) && x.producers.length > 1 ? { producers: x.producers } : {}) });
    if (!groups.has(key))
      groups.set(key, { before: a ? side(a) : null, now: b ? side(b) : null, pages: [] });
    groups.get(key).pages.push(pg);
  }
  const changed = [...groups.values()];
  if (!changed.length)
    return { state: "differs", changed,
             says: word("reading-pipeline.says.read_classified_different_text") };
  const says = changed.map((g) => {
    const pgs = describePages(g.pages);
    if (!g.before) return word("reading-pipeline.returned_earlier_reading", { now: String(whoOf(g.now)), pgs: String(pgs) });
    if (!g.now) return word("reading-pipeline.earlier_reading_reading", { pgs: String(pgs), before: String(whoOf(g.before)) });
    if (whoOf(g.before) === whoOf(g.now))
      return word("reading-pipeline.returned_different_text", { now: String(whoOf(g.now)), pgs: String(pgs) });
    return word("reading-pipeline.read_text_differs", { pgs: String(pgs), pages: String(g.pages.length === 1 ? "was" : "were"), before: String(whoOf(g.before)), now: String(whoOf(g.now)) });
  }).join("; ");
  return { state: "differs", changed, says };
}
