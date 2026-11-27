/* A staff directory: a document whose BODY IS a list of one organisation's people (or
 * offices) with the points at which each can be reached.
 *
 * FW-20, the FOURTH and last class in M0-32's measured order (`MEASUREMENTS.md` M-18;
 * `EXTRACTION-BREADTH-DESIGN.md` §2's table, row 4) — ~395 items (+/-272) scaled to the
 * text-bearing stratum, the smallest class by a wide margin.
 *
 * WHY THIS TYPE WAS NOT WRITTEN BY FW-18, AND WHAT CHANGED. FW-18 measured 0 of 30
 * name-matched directory PDFs decodable at TIER 1 and withheld the type (D-376), calling
 * the class "a tier-3 gap wearing a content-type gap's clothes". FW-20 re-took that
 * census through the plane WITH ITS FLEET BOUND (`docs/development/measurements/M-121.md`;
 * the census script was retired in T18 and is in git history) and the premise did not survive: the undetermined markers
 * on those documents are `no_tounicode` — fonts with no Unicode map — which is TIER 2's
 * case, not a missing text layer, so tier 3 is never asked. With the tier-2 member bound,
 * 56 of 57 name-matched documents read from text. The class was never unreadable to the
 * plane; it was unreadable to the tier-1-only instrument that measured it.
 *
 * MEASURED ON REAL DOCUMENTS, fetched from `cao-94612.s3.amazonaws.com` on 2026-09-23
 * and read through the plane's own `op=acquire` with the committed pdf-worker bundle:
 *
 *   A · documents/Neighborhood-Services-Section-Directory-Rev-06-14-22.pdf — the City's
 *       "Neighborhood Services Staff Beat & Program Directory". 30,870 bytes, 1 page,
 *       2,092 characters at tier 2 (1,303 `no_tounicode` markers at tier 1). Each row is
 *       a coordinator, the police beats assigned to them, an @oaklandca.gov address and
 *       an extension.
 *   B · documents/Neighborhood-Services-Division-Staff-0823.pdf — the same division's
 *       staff sheet, laid out in TWO COLUMNS, so a name and its address sit on different
 *       lines. Its file name matches none of FW-18's name patterns: M0-32 measured that
 *       a name-only census recovers 0% of directories, and this is one it would miss.
 *
 * THE DEFECT THIS TYPE WAS BUILT NOT TO MAKE — the liar's pass. A recogniser that
 * matches "a list of names with phone numbers and addresses" matches a great deal that is
 * not a staff directory, and four real documents from the same bucket spring it:
 *
 *   - the 2018 ELECTION CANDIDATE CONTACT LIST: fifty-odd people, each with a phone and
 *     an address — but at gmail, yahoo, sonic and their own campaign domains. They are
 *     candidates, not one organisation's staff;
 *   - the NCPC ZOOM MEETING DATES: every row names a City coordinator and her
 *     @oaklandca.gov address — ONE domain, the directory's own signature — but every
 *     row is a MEETING, dated. A calendar that names its contacts. This is M0-32's one
 *     defect class, a REFERENCE (to staff) read as MEMBERSHIP (of a directory), and it
 *     is the negative this type is fenced against by name;
 *   - the BUSINESS RECYCLING SERVICE PROVIDER DIRECTORY, which names itself a directory
 *     on its first line and carries the City's own contact address — a directory, of
 *     businesses, that REFERENCES the City's staff;
 *   - the WORKFORCE DEVELOPMENT BOARD roster: a list of people with no contact points.
 *
 * THE PRINCIPLE, and it is three facts rather than a list of spellings:
 *   (1) DENSITY — contact points are the body of the document, not a line in it. At
 *       least DIRECTORY_FLOOR distinct addresses.
 *   (2) ONE ORGANISATION — a staff directory lists the people of ONE body, so their
 *       addresses share that body's domain. The candidate list fails here.
 *   (3) NOT DATED — a directory's entries are people; a schedule's entries are events
 *       that name people. When the document carries dates in the same order of number
 *       as its contact points, the contacts are attributes of dated rows and the
 *       document is a calendar. The NCPC dates fail here.
 * Self-naming (a title line calling the document a directory, staff list, roster or
 * contacts) raises LIKELY to CERTAIN and is never sufficient alone — the recycling
 * directory names itself and is refused by (1).
 *
 * WHAT THIS MATCHER CANNOT SEE, stated because the sentence is load-bearing:
 *   - a directory with NO EMAIL ADDRESSES (phone numbers only, or names and titles only
 *     — the Council's committee roster and the org charts in the same bucket are of this
 *     shape). (2) cannot be established from a phone number, so these are NOT
 *     recognised; they fall to `generic`, which is noisy and honest.
 *   - a directory of OFFICES at one domain is recognised exactly as a directory of
 *     people is. M0-32's class definition ("a roster of people OR OFFICES with contact
 *     points") includes both, so this is the class, not an overreach — but the reader
 *     does not tell them apart.
 *   - an organisation whose staff use personal addresses fails (2).
 *   - it does not pair a name with an address across lines. On a two-column page
 *     (document B) an address's own line may carry two people's text or none; the
 *     entry's `line` fact is that line, verbatim, never a pairing this reader guessed. */
import { CONFIDENCE, CONTRACT, entity, diffEntities, alsoSatisfies } from "../docprofile/doctypes/index.mjs";
import { flatCount, firstLines, counted, spend } from "./windows.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, Detection, Entity, EntityFacts } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { WordVars } from "../bio-plane/src/setup-words/index.mjs" */

/**
 * One distinct address read from a document: case-folded, its domain, and the raw offset of its first sighting.
 * @typedef {Object} SdAddress
 * @property {string} address
 * @property {string} domain
 * @property {number} offset
 */
/**
 * The match the `@` at a place makes: where it starts and ends in the raw text, the address and its domain as written.
 * @typedef {Object} SdEmailHit
 * @property {number} start
 * @property {number} end
 * @property {string} address
 * @property {string} domain
 */
/**
 * The addresses in a document: every distinct one in the order read, the commonest domain and how many sit at it, how far
 * the text was read and whether the bound stopped it.
 * @typedef {Object} SdAddresses
 * @property {SdAddress[]} all
 * @property {string | null} domain
 * @property {number} atDomain
 * @property {number} read
 * @property {boolean} cut
 */
/**
 * The entries verified unchanged between two readings (R16).
 * @typedef {Object} SdConfirmed
 * @property {number} entries
 * @property {number} intact
 */
/**
 * Where the bound on addresses stopped a reading: that it did, the bound, how far the text was read of how much, and why.
 * @typedef {Object} SdEntriesCut
 * @property {true} entries_cut
 * @property {number} entries_limit
 * @property {number} read_to
 * @property {number} chars
 * @property {string} entries_why
 */
/**
 * What `parse` reads from a staff directory: one entry per distinct address, the commonest domain and how many addresses
 * sit at it, where the bound on addresses stopped the reading when it did, and the title line.
 * @typedef {Object} StaffDirectoryReading
 * @property {Entity[]} entities
 * @property {string | null} domain
 * @property {number} entries
 * @property {true} [entries_cut]
 * @property {number} [entries_limit]
 * @property {number} [read_to]
 * @property {number} [chars]
 * @property {string} [entries_why]
 * @property {string | null} title
 * @property {string | null} title_why
 * @property {string[]} also_satisfies
 * @property {string | null} at
 */
/**
 * What `assess` answers for two readings of one directory.
 * @typedef {Object} StaffDirectoryAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {SdConfirmed | null} confirmed
 * @property {string} why
 */
/**
 * The staff directory content type (docprofile's `ContentType`).
 * @typedef {Object} StaffDirectoryType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => StaffDirectoryReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => StaffDirectoryAssessment} assess
 */

/* The smallest number of distinct addresses at one domain that makes contact points the
   BODY of a document rather than a signature block. A staff report names one contact;
   the recycling directory names the City twice. Five is below every real directory
   measured (the smallest, document B, carries 11) and above every reference measured
   except the NCPC schedule, which (3) refuses. */
export const DIRECTORY_FLOOR = 5;
/* The share of a document's distinct addresses that must sit at its commonest domain.
   MEASURED, AND THE FIRST DRAFT WAS WRONG IN THE LIAR'S DIRECTION: at 0.6 the 2018
   candidate contact list PASSED — 19 of its 31 addresses are at gmail.com (61%), so a
   free-mail provider read as "one organisation". The eleven distinct documents this type
   recognises sit at 0.88-1.00 (the lowest is a CRO/NCPC revision whose five non-City addresses are
   community groups'); the candidate list at 0.61. 0.8 is the separation, not a guess.
   RESIDUE, stated: a list of unrelated people who ALL use one mail provider would still
   pass (2). Mail providers are not enumerated — a list of spellings goes stale the day
   a fifth is written — so that case is a named blind spot rather than a hidden one. */
export const ONE_ORGANISATION = 0.8;

/* An address, found by its `@` and not by a search for a start that most of a text cannot give (R40): `local@domain`, the
   local part alnum first and then letters, digits and `._%+-`, after a word boundary, the domain labels and a top-level
   name of two letters or more, then a word boundary. `sdEmailAt` finds the one match an `@` makes (what a global
   pattern of this shape finds, and in work linear in the characters it walks); the sticky pattern reads it once its start
   is known. */
const SD_EMAIL_AT = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})\b/y;
const SD_LOCAL = /[A-Za-z0-9._%+-]/;
const SD_WORD = /[A-Za-z0-9_]/;
const SD_ALNUM = /[A-Za-z0-9]/;
const SD_PHONE = /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])?\b\d{3}[-.]\d{4}\b/g;
/* A DATE, in the forms a published schedule uses: a month named with a day, or a
   three-part numeric date. A bare `08/23` (a revision stamp) is not a date here. */
const SD_DATE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;
const SD_SELF_NAMING = /\b(?:directory|staff|roster|contacts)\b/i;

/* The most distinct addresses read from one document, in the order it lists them (R40; protective, BOB's, K4868): a directory
   of this many people is read to its end, a longer text is read as far as the address after this many, and the answer
   says where it stopped. The memory a reading holds is then a number of addresses and never the text's size. */
export const ENTRIES_MAX = 10_000;
/* The longest `line` an entry carries (R40; protective, BOB's, K4868): a line longer than this is cut to this many characters around the address, and
   the entry says so (`line_cut`), so a text of 16,000 addresses on one line is not 16,000 copies of the line. */
export const LINE_MAX = 600;

/** The match the `@` at `p` makes in `raw`, no earlier than `from`: `{start, end, address, domain}` or null. The start is
 *  the first place in the run of address characters before the `@` that a pattern would start (a letter or digit, after a
 *  word boundary).
 *  @param {string} raw @param {number} p @param {number} from @returns {SdEmailHit | null} */
function sdEmailAt(raw, p, from) {
  let r0 = p;
  /* `String(...)` is what `RegExp.prototype.test` makes of its argument; the indices read are all inside the text. */
  while (r0 > from && SD_LOCAL.test(String(raw[r0 - 1]))) r0--;
  let s = r0;
  for (; s < p; s++) {
    if (!SD_ALNUM.test(String(raw[s]))) continue;
    if (s === 0 || !SD_WORD.test(String(raw[s - 1]))) break;
  }
  if (s >= p) return null;
  SD_EMAIL_AT.lastIndex = s;
  const m = SD_EMAIL_AT.exec(raw);
  if (!m) return null;
  /* The domain is the pattern's one group, which every match of it fills. */
  const domain = m[1];
  if (domain === undefined) throw new TypeError("staff-directory: an address matched without its domain");
  return { start: s, end: s + m[0].length, address: m[0], domain };
}

/** The addresses in a document, by domain. Distinct, case-folded. Read in work linear in the text, as far as the
 *  `ENTRIES_MAX`th distinct address; `read` is how far (the text's end when it is all).
 *  @param {string} raw @returns {SdAddresses} */
function sdAddresses(raw) {
  spend(raw.length);
  /** @type {Map<string, SdAddress>} */
  const all = new Map(/** @type {Array<[string, SdAddress]>} */ ([]));
  let read = raw.length, cut = false;
  for (let from = 0, p = raw.indexOf("@"); p >= 0; p = raw.indexOf("@", from)) {
    const m = sdEmailAt(raw, p, from);
    if (!m) { from = p + 1; continue; }
    from = m.end;
    const a = m.address.toLowerCase().replace(/\.+$/, "");
    if (all.has(a)) continue;
    if (all.size >= ENTRIES_MAX) { read = m.start; cut = true; break; }
    all.set(a, { address: a, domain: m.domain.toLowerCase().replace(/\.+$/, ""), offset: m.start });
  }
  /** @type {Map<string, number>} */
  const byDomain = new Map(/** @type {Array<[string, number]>} */ ([]));
  for (const x of all.values()) byDomain.set(x.domain, (byDomain.get(x.domain) || 0) + 1);
  /** @type {string | null} */
  let domain = null;
  let atDomain = 0;
  for (const [d, n] of byDomain) if (n > atDomain) { domain = d; atDomain = n; }
  return { all: [...all.values()], domain, atDomain, read, cut };
}

/** The title line, if the document names itself as this kind in its first lines. A
    title, not a mention: only the first five non-empty lines are read.
    @param {string} raw @returns {string | null} */
function sdTitleLine(raw) {
  return firstLines(raw, 5).find((l) => SD_SELF_NAMING.test(l)) || null;
}

/** The entries verified unchanged, or null when none was (R16).
 *  @param {StaffDirectoryReading} a @param {StaffDirectoryReading} b @returns {SdConfirmed | null} */
function sdConfirmed(a, b) {
  const intact = (a.entities || []).filter((e) =>
    (b.entities || []).some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;
  return intact ? { entries: (b.entities || []).length, intact } : null;
}

/** Is `x` a reading of this type (what `parse` hands back)? Any reading there is: `assess` reads every member through
 *  `|| []` and so tolerates an object that lacks them, and only a missing reading (null or undefined) is refused, as
 *  reading its `entities` refused it.
 *  @param {object | null | undefined} x @returns {x is StaffDirectoryReading} */
function isStaffDirectoryReading(x) { return x !== null && x !== undefined; }
/** `x` as a reading of this type, or the `TypeError` reading a member of a missing one raised.
 *  @param {object | null | undefined} x @returns {StaffDirectoryReading} */
function sdReading(x) {
  if (!isStaffDirectoryReading(x)) throw new TypeError(`Cannot read properties of ${x} (reading 'entities')`);
  return x;
}

/** @type {StaffDirectoryType} */
const staffDirectory = {
  key: "staff_directory",
  label: "a staff directory",
  version: 1,
  /* A directory is a LIST: what matters is which entries are present and whether each
     still says what it said. Declared on the content type (CONSTRUCTS Step 0 #4). */
  contract: CONTRACT.MEMBERSHIP,

  /** @param {DoctypeContext} ctx @returns {Detection} */
  detect(ctx) {
    const raw = String(ctx.text || "");
    const { all, domain, atDomain, read, cut } = sdAddresses(raw);
    /* (1) DENSITY at (2) ONE ORGANISATION — THE DECIDING LEG. Every match passes
       through it; nothing else can make a directory. */
    if (atDomain < DIRECTORY_FLOOR || atDomain / all.length < ONE_ORGANISATION)
      return { match: false, confidence: CONFIDENCE.NONE };
    /** @type {WordVars} */
    const vars = { count: String(atDomain), domain: String(domain), percent: String(Math.round((atDomain / all.length) * 100)), total: String(all.length) };
    const signals = [cut
      ? localize("doctypes.staff-directory.addresses_cut", "{count} of the first {total} distinct contact addresses are at one organisation's domain ({domain}), {percent}%; the document lists more, and the rest was not read", vars)
      : localize("doctypes.staff-directory.addresses", "{count} distinct contact address(es) at one organisation's domain ({domain}), {percent}% of the {total} in the document", vars)];
    /* The dates and phone numbers are those of the text read: all of it, or as far as the address the bound stopped at. */
    const seen = cut ? raw.slice(0, read) : raw;
    /* (3) NOT DATED. A schedule names its contacts; its rows are events. */
    /* R37: the dates are counted in the flattened text a window at a time, no further than the count that decides. */
    const floor = Math.max(3, atDomain / 2);
    if (flatCount(seen, SD_DATE, Math.ceil(floor)) >= floor) return { match: false, confidence: CONFIDENCE.NONE };
    /* R40: one pass, the distinct numbers kept no further than the bound on addresses. */
    spend(seen.length);
    /** @type {Set<string>} */
    const phoneSet = new Set(/** @type {string[]} */ ([]));
    let morePhones = false;
    for (const p of seen.matchAll(SD_PHONE)) {
      if (phoneSet.size >= ENTRIES_MAX) { morePhones = true; break; }
      phoneSet.add(p[0].replace(/\D/g, ""));
    }
    const phones = phoneSet.size;
    if (phones) signals.push(`${phones}${morePhones ? "+" : ""} distinct phone number(s)`);
    const title = sdTitleLine(raw);
    if (title) {
      signals.push(localize("doctypes.staff-directory.title_line", "it names itself in its title line (\"{title}\")", { title: title.slice(0, 80) }));
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    }
    return { match: true, confidence: CONFIDENCE.LIKELY, signals };
  },

  /** What is in it: one entry per distinct address, keyed by the address.
   *
   *  THE KEY IS THE ADDRESS, NEVER THE NAME. An address is the identifier the document
   *  itself assigns to an entry and is stable across revisions of the sheet; a person's
   *  name is not a source-assigned id (framework §7, and the minutes reader's own rule).
   *  The key is the BARE address, as every other type's key is bare (`26-0910`, never
   *  `legislation:26-0910`): a consumer writes the reference as `kind:key`, and a key
   *  that carried its kind read `contact:contact:<address>` there (N404).
   *
   *  FW-17 / IC-86 — each entry carries WHERE it was read, from `ctx.locate` at the
   *  address's own RAW offset. `rect` is null: tier-1 and tier-2 text carry no geometry.
   *  @param {DoctypeContext} ctx @returns {StaffDirectoryReading} */
  parse(ctx) {
    const raw = String(ctx.text || "");
    const given = ctx.locate;
    /** @type {(offset: number) => ReadingPosition | null} */
    const locate = typeof given === "function" ? given : () => null;
    const { all, domain, atDomain, read, cut } = sdAddresses(raw);
    /** @type {Entity[]} */
    const entities = [];
    /* The line an address stands on, found once for all the addresses on it (they come in the order of the text). */
    let lineAt = -1, lineEnd = -1;
    for (const a of all) {
      if (a.offset > lineEnd || a.offset < lineAt) {
        lineAt = raw.lastIndexOf("\n", a.offset) + 1;
        const nl = raw.indexOf("\n", a.offset);
        lineEnd = nl < 0 ? raw.length : nl;
      }
      /* A line is the entry's own `line`, verbatim; one longer than LINE_MAX is cut to that many characters around the
         address, and says so (R40), so a text of 16,000 addresses on one line is not 16,000 copies of it. */
      const long = lineEnd - lineAt > LINE_MAX;
      const ws = long ? Math.max(lineAt, Math.min(a.offset - LINE_MAX / 2, lineEnd - LINE_MAX)) : lineAt;
      const line = raw.slice(ws, long ? ws + LINE_MAX : lineEnd).replace(/\s+/g, " ").trim();
      const phones = [...new Set(line.match(SD_PHONE) || [])];
      /** @type {EntityFacts} */
      const facts = { address: a.address, organisation: a.domain === domain, line, phone: phones.join(", ") || null };
      if (long) { facts.line_cut = true; facts.line_length = lineEnd - lineAt; }
      entities.push(entity(a.address, "contact", line.slice(0, 160) || a.address, facts, locate(a.offset)));
    }
    const title = sdTitleLine(raw);
    /* Null where the bound did not stop it: spread, null adds nothing. */
    /** @type {SdEntriesCut | null} */
    const stopped = cut ? { entries_cut: true, entries_limit: ENTRIES_MAX, read_to: read, chars: raw.length,
                  entries_why: localize("doctypes.staff-directory.entries_cut", "this document lists more than {limit} distinct addresses: the first {limit} were read, up to character {read} of {total}, and the rest of it was not", { limit: String(ENTRIES_MAX), read: String(read), total: String(raw.length) }) } : null;
    return {
      entities,
      domain,
      entries: atDomain,
      ...stopped,
      title,
      title_why: title ? null : localize("doctypes.staff-directory.no_title", "no line among the first five names this document as a directory, staff list, roster or contacts"),
      also_satisfies: alsoSatisfies(ctx, "staff_directory"),
      at: ctx.at || null,
    };
  },

  /** Given two parses of the same directory's address, who came, who went, and whose
   *  entry now says something else. Graded with the catalogue's list events: an entry
   *  gone is `item_pulled` (the record can no longer say this person is reached here),
   *  an entry added is `item_added`, an entry whose line moved is `item_changed`.
   *  @param {object | null | undefined} before @param {object | null | undefined} after
   *  @returns {StaffDirectoryAssessment} */
  assess(before, after) {
    /* Nothing read on EITHER side is a failed reader (R16, R33), never a directory
       emptied of everyone the other side listed. */
    if (!(sdReading(before).entities || []).length || !(sdReading(after).entities || []).length)
      return { meaningful: null, significance: null, events: [], confirmed: null,
               why: localize("doctypes.staff-directory.unread", "no entry could be read from this directory this time, so nothing is claimed about it either way") };
    const a = sdReading(before), b = sdReading(after);
    const d = diffEntities(a.entities || [], b.entities || []);
    /** @type {EventHead[]} */
    const events = [];
    for (const e of d.gone)
      events.push(event("item_pulled", { key: e.key, label: e.label, why: localize("doctypes.staff-directory.pulled", "this address is no longer listed in the directory") }));
    for (const e of d.appeared)
      events.push(event("item_added", { key: e.key, label: e.label, why: localize("doctypes.staff-directory.added", "the directory now lists an address it did not") }));
    for (const x of d.altered)
      events.push(event("item_changed", { key: x.entity.key, label: x.entity.label, moved: x.moved,
        why: localize("doctypes.staff-directory.altered", "this entry's line in the directory now says something else") }));
    bySeverity(events);
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events,
      confirmed: sdConfirmed(a, b),
      why: events.length ? localize("doctypes.staff-directory.changes", "{count} change(s) to the directory's entries", { count: String(events.length) })
                         : localize("doctypes.staff-directory.unchanged", "the directory lists the same addresses, each saying what it said"),
    };
  },
};
export default counted(staffDirectory);
