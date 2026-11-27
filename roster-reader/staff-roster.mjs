/* `staff_roster` (R1, R2, R4, R5): a document whose body is a list of one organisation's people or posts,
 * with names and titles but no contact points — the shape `staff_directory` cannot see (its header names
 * the board roster and the committee roster as documents it does not recognise).
 *
 * MEASURED ON REAL DOCUMENTS, fetched from the bucket the staff directory was measured on
 * (`cao-94612.s3.amazonaws.com`, 2026-10-05) and read through the plane (`test/fixtures/capture.mjs`,
 * `test/fixtures/roster-documents.json`):
 *   - the Workforce Development Board roster (`WDB-Roster-10-15-2018.pdf`): a numbered row per member,
 *     name beside an organisation and a term. It never names itself a roster in its text;
 *   - the Council's committee roster (`2025-Committee-Membership-Staff-Roster-1.10.25.pdf`): per
 *     committee a `Chair: <name>` line, members' names alone, and `<post>: <name>` lines for the assigned
 *     staff; it names itself "ROSTER AND ASSIGNED STAFF";
 *   - the Reimagining Public Safety advisory board rosters (`RPS-Advisory-Board-Members_rev.pdf`): a
 *     numbered row per member, name beside a council district.
 * Fenced against, by name (R9): the staff directory's four look-alikes (the candidate contact list, the
 * dated meeting schedule, the business recycling directory; the board roster is the positive here), its
 * four directories, a FEIR chapter that names itself "Roster of Commenters", a blank event sign-in sheet
 * that names itself "EVENT PARTICIPANT ROSTER", and the substance documents FW-18 measured.
 *
 * THE PRINCIPLE, four facts, then a raise:
 *   (1) ROWS ARE THE BODY — at least ROSTER_FLOOR lines carry a name with something more on the line (a
 *       title, a unit, an organisation), and lines that carry a name are at least ROSTER_SHARE of the
 *       document's lines. Prose that mentions people fails the share; a sign-in form has no names.
 *   (2) NO CONTACT POINTS AS ITS BODY — a document whose rows carry addresses or phone numbers is a
 *       directory or a contact list: at least DIRECTORY_FLOOR addresses at one domain is
 *       `staff_directory`'s shape, and contact points on half the rows is a contact list. Not matched.
 *   (3) NOT DATED — the dated-rows rule of `staff_directory`, applied here: dates as many as half the
 *       rows make the rows events that name people, not people.
 *   (4) NOT A CHART — posts or units printed on lines of their own, as many as the rows, are a chart's
 *       boxes; and a document that names itself, with the view's words, only as a chart is not a roster.
 *   Self-naming (a short line the view's `roster_words` match as a roster) raises LIKELY to CERTAIN and is
 *   never sufficient alone: the FEIR chapter and the sign-in sheet both name themselves a roster.
 *
 * WHAT IT CANNOT SEE: a roster of names printed in capitals, or in a script without case; a roster whose
 * rows were laid out as a table the text read column by column (the names in one run, the titles in
 * another); and which of two capitalised phrases on one line is the person (so it does not divide such a
 * line: the row is kept whole as `line`, never paired by guess, R2). */
import { CONFIDENCE, CONTRACT, entity, diffEntities, alsoSatisfies,
         event, worstSignificance, isMeaningful, bySeverity } from "../docprofile/registry.mjs";
import { hasNameSpan, isName, leadingName, withoutContacts, titlePatterns, titleSpans, removeSpans,
         rosterWordPatterns, selfNamingLines, selfNamingLine, namedAs, eachLine, statedDate, datesIn, isUnitLine, UNIT_WORDS, EMAIL,
         isObj, isList, strField } from "./lines.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/** @import { DoctypeContext, Entity, EntityFacts } from "../docprofile/registry.mjs" */
/** @import { MovedFact } from "../docprofile/registry.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { Line, SelfLine, StatedDate, Fields } from "./lines.mjs" */
/**
 * A type's verdict on one document (R1, R3, R11): matched with its confidence and signals (and why, when it is not
 * CERTAIN), or not matched with why.
 * @typedef {{ match: true, confidence: string, signals: string[], why?: string } | { match: false, confidence: string, why: string }} Detection
 * @bound confidence: one of `docprofile`'s `CONFIDENCE`; CERTAIN only with a self-naming line as well as the body's own evidence; NONE whenever match is false
 */
/**
 * The document's own stated date (R2), as its line states it, placed where the document says.
 * @typedef {Object} AsOf
 * @property {string} text
 * @property {string|null} date
 * @property {"day" | "month" | null} precision
 * @property {ReadingPosition | null} source
 */
/**
 * The organisation as the document's title line names it (R2).
 * @typedef {Object} NamedOrganisation
 * @property {string} text
 * @property {ReadingPosition | null} source
 */
/**
 * One row as its line states it, before it is placed: a name with its title and unit, or the line kept whole with why.
 * @typedef {Object} LineRow
 * @property {string} [name]
 * @property {string} [title]
 * @property {string} [unit]
 * @property {string} [line]
 * @property {string} [why]
 */
/**
 * One roster row as its line states it (R2): a name with its title and unit, or, where the line does not divide
 * into a name and a title, the line kept whole with why. No contact point is carried (R4).
 * @typedef {Object} RosterRow
 * @property {string} [name]
 * @property {string} [title]
 * @property {string} [unit]
 * @property {string} [line]
 * @property {string} [why]
 * @property {ReadingPosition | null} source
 * @bound a row carries `name` or `line`, never both
 */
/**
 * `staff_roster`'s reading (R2).
 * @typedef {Object} RosterReading
 * @property {RosterRow[]} rows
 * @property {{rows: number, divided: number, whole: number}} counts
 * @property {AsOf|null} as_of
 * @property {string|null} as_of_why
 * @property {NamedOrganisation|null} organisation
 * @property {string|null} organisation_why
 * @property {string[]} also_satisfies
 * @property {string|null} at
 */
/**
 * One graded event of the catalogue about one row or box (R5): its type and the catalogue's significance first, then the
 * row's key and label, the facts that moved (for `item_changed`), and why.
 * @typedef {Object} RowEvent
 * @property {string} type
 * @property {string} significance
 * @property {string} key
 * @property {string} label
 * @property {MovedFact[]} [moved]
 * @property {string} why
 */
/**
 * Two readings compared (R5): the catalogue's events `delisted`, `item_added` and `item_changed`, or, where either
 * side read no row, nothing claimed, with why (R11).
 * @typedef {Object} Assessment
 * @property {boolean|null} meaningful
 * @property {string|null} significance
 * @property {RowEvent[]} events
 * @property {{rows: number, intact: number}|null} confirmed
 * @property {string} why
 */
/**
 * A reading compared by `assessRows`: `docprofile`'s entity, keyed by a row's name or line (or a chart's box).
 * @typedef {Entity} RowEntity
 */
/**
 * The `staff_roster` content type (R1, R2, R4, R5), for `docprofile`'s registry.
 * @typedef {Object} RosterType
 * @property {string} key `staff_roster`
 * @property {string} label
 * @property {number} version
 * @property {string} contract `docprofile`'s `CONTRACT.MEMBERSHIP`
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => RosterReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => Assessment} assess compares the readings' rows only
 * @property {false} [fallback] never the registry's fallback
 * @property {undefined} [connections] states no connections
 * @bound detect: allocates at most 32 bytes per byte of text, and holds one line at a time
 */
/**
 * What one line gives a roster: its rows, and whether it carries a name with more beside it.
 * @typedef {Object} LineReading
 * @property {LineRow[]} rows
 * @property {boolean} paired
 * @property {boolean} named
 */

/* The fewest lines that carry a name with more beside it for the rows to be the body. MEASURED with the
   first profile's proposed words (test/fixtures.mjs): the rosters carry 18 (the board roster), 32 and 131;
   the look-alikes that stop here carry at most 4 (the two-column directory sheet, FW-18's agenda). Five is
   the staff directory's own floor, kept the same so the two list types cannot drift apart. */
/** @type {number} */
export const ROSTER_FLOOR = 5;
/* The share of a document's lines that carry a name. MEASURED: the rosters sit at 0.71 to 0.90; the
   documents past the floor that only this refuses at 0.23 (the business-resources letter). Several
   look-alikes carry a higher share (the directories, the EIR's commenter tables, the candidate list) and
   are refused by (2) and (3), which is why those rules are decided first. */
/** @type {number} */
export const ROSTER_SHARE = 0.35;
/* `staff_directory`'s own deciding leg: this many distinct addresses at one domain is its shape. */
/** @type {number} */
export const DIRECTORY_FLOOR = 5;

const ROW_NUMBER = /^(?:\d{1,3}[.)]?|[ivx]{1,5}[.)])\s+/i;
/* TITLE-CASE PROSE. Legistar agendas print their item titles with Every Word Capitalised, so a line of
   prose opens with two capitalised words as a row does ("Contract Agreement For James Beere As ...").
   What a row never carries is a CAPITALISED FUNCTION WORD after its first word: an organisation's name
   writes "of" and "and" in lower case, a sentence in title case does not. Measured on FW-18's agenda: 21
   of its 22 lines that opened with a name-shaped span carry one; no row of the three rosters does. */
const TITLE_CASE_PROSE = /\s(?:The|To|For|As|On|In|And|Of|With|By|That|This|Is|Are|Be|Will|Shall|From|At|Or|An|A|Its|Their|Into|Upon|Per)\b(?![-'.])/;
const SPLIT_NAMES = /\s*(?:,|&|\/|\band\b|;)\s*/;

/** One line as a roster reads it: rows (possibly several, for `Chair: A & B`), and whether the line
 *  carries a name with more beside it (the floor's unit). Lines carrying no name give no row. */
/** @param {string} lineText @param {ReadonlyArray<RegExp>} titles @param {import("./lines.mjs").Contactless} [bare]
 *  @returns {LineReading} */
export function readLine(lineText, titles, bare = withoutContacts(lineText)) {
  const { text } = bare;
  const t = text.replace(ROW_NUMBER, "").trim();
  if (!t) return { rows: [], paired: false, named: false };
  if (TITLE_CASE_PROSE.test(t)) return { rows: [], paired: false, named: false };
  /* `<post>: <name>[, <name>]` — the post as stated; a staff title inside it is the title and what
     precedes the title is the unit ("Public Works Chair: Zac Unger"). */
  const colon = t.indexOf(":");
  if (colon > 0) {
    const left = t.slice(0, colon).trim();
    const right = t.slice(colon + 1).trim();
    const parts = right ? right.split(SPLIT_NAMES).filter(Boolean) : [];
    if (left && parts.length && parts.every(isName)) {
      const ts = titleSpans(titles, left);
      let title = left;
      /** @type {string | undefined} */
      let unit;
      const first = ts[0];
      if (first) {
        const before = left.slice(0, first.index).trim();
        title = left.slice(first.index).trim();
        if (before) unit = before;
      }
      const unitOf = unit;
      return { rows: parts.map((name) => {
        /** @type {LineRow} */
        const row = { name: name.trim(), title };
        if (unitOf) row.unit = unitOf;
        return row;
      }), paired: true, named: true };
    }
    if (leadingName(right))
      return { rows: [{ line: t, why: localize("roster-reader.staff-roster.the_line_does_not_divide", "the line does not divide into a post and the names after it: what follows its colon is not names alone") }],
               paired: true, named: true };
  }
  /* A title printed before or after one name: the view's titles, never a guess. */
  const ts = titleSpans(titles, t);
  const head = ts[0], last = ts[ts.length - 1];
  if (head && last) {
    const rest = removeSpans(t, ts);
    const lead = head.index === 0, tail = last.index + last.text.length === t.length;
    const contiguous = ts.every((h, i) => { const prev = ts[i - 1]; return i === 0 || !prev || t.slice(prev.index + prev.text.length, h.index).trim() === ""; });
    if (isName(rest) && contiguous && (lead || tail))
      return { rows: [{ name: rest, title: ts.map((h) => h.text).join(" ").trim() }], paired: true, named: true };
    if (hasNameSpan(rest))
      return { rows: [{ line: t, why: localize("roster-reader.staff-roster.the_line_prints_staff", "the line prints staff titles and names that do not divide into one name beside its title, so it is not paired by guess") }],
               paired: true, named: true };
    /* A post with no name on its line ("Electrician Leader") is a box, not a row. */
    return { rows: [], paired: false, named: false };
  }
  if (!ts.length && isName(t)) return { rows: [{ name: t }], paired: false, named: true };
  /* A heading that ends in a kind of unit ("Oakland Workforce Development Board") names the
     organisation or one of its parts, not a person. */
  if (UNIT_WORDS.has(t.slice(t.lastIndexOf(" ") + 1).replace(/[^\p{L}]/gu, "").toLowerCase()))
    return { rows: [], paired: false, named: false };
  if (leadingName(t))
    return { rows: [{ line: t, why: localize("roster-reader.staff-roster.the_line_opens_with_a", "the line opens with a name but what follows it is not one of the view's staff titles, so where the name ends is not divided by guess") }],
             paired: true, named: true };
  return { rows: [], paired: false, named: hasNameSpan(t) };
}

/** The rows of a text, each with the offset of its line, and the counts the floor reads. With `keep` false
 *  (`detect`), no line and no row is held: the counts and the document's self-naming lines are all it keeps, so
 *  the reading of a 20 MB text holds one line at a time (R1). */
/** @param {string} raw @param {DoctypeContext | null | undefined} ctx @param {boolean} [keep] */
function readRows(raw, ctx, keep = true) {
  const titles = titlePatterns(ctx);
  const selfPatterns = keep ? [] : rosterWordPatterns(ctx);
  /** @type {Line[]} */
  const lines = [];
  /** @type {Array<LineRow & { offset: number }>} */
  const rows = [];
  /** @type {SelfLine[]} */
  const self = [];
  let count = 0, paired = 0, named = 0, contactLines = 0, boxes = 0;
  eachLine(raw, (x) => {
    count++;
    if (keep) lines.push(x);
    else { const s = selfNamingLine(x, selfPatterns); if (s) self.push(s); }
    const bare = withoutContacts(x.text);
    if (bare.removed) contactLines++;
    const r = readLine(x.text, titles, bare);
    if (r.paired) paired++;
    if (r.named) named++;
    /* A line that is a post or a unit with no name on it: a chart's box, not a roster's row. */
    else if (titleSpans(titles, bare.text).length || isUnitLine(bare.text)) boxes++;
    if (keep) for (const row of r.rows) rows.push({ ...row, offset: x.offset });
  });
  return { lines, count, rows, self, paired, named, contactLines, boxes };
}

/** @param {string} raw @returns {number} */
function directoryShape(raw) {
  const byDomain = new Map(/** @type {Array<[string, number]>} */ ([]));
  for (const a of new Set((raw.match(EMAIL) || []).map((s) => s.toLowerCase()))) {
    const d = a.split("@")[1] ?? "";
    byDomain.set(d, (byDomain.get(d) || 0) + 1);
  }
  return Math.max(0, ...byDomain.values());
}

const no = /** @param {string} why @returns {Detection} */ (why) => ({ match: false, confidence: CONFIDENCE.NONE, why });

/** The organisation as the title names it: the heading just before the self-naming line; else the
 *  self-naming line itself, its roster words removed, when what remains names a unit; else the first line
 *  when it is a heading. A heading has no digit and no colon, is not a lone name and prints no staff title. */
/** @param {ReadonlyArray<Line>} lines @param {ReadonlyArray<SelfLine>} selfLines @param {DoctypeContext | null | undefined} ctx
 *  @returns {Line | null} */
export function organisationOf(lines, selfLines, ctx) {
  const titles = titlePatterns(ctx);
  const selfAt = new Set(selfLines.map((x) => x.offset));
  const heading = (/** @type {Line | undefined} */ x) => !!x && !/[\d:]/.test(x.text) && !isName(x.text) && !selfAt.has(x.offset) && !titleSpans(titles, x.text).length;
  const firstSelf = selfLines[0];
  const at = firstSelf ? lines.findIndex((x) => x.offset === firstSelf.offset) : -1;
  const prev = at > 0 ? lines[at - 1] : undefined;
  if (prev && heading(prev)) return { text: withoutContacts(prev.text).text, offset: prev.offset };
  const cur = at >= 0 ? lines[at] : undefined;
  if (cur) {
    const words = rosterWordPatterns(ctx).map((p) => p.re);
    let rest = cur.text;
    for (const re of words) rest = rest.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
    rest = rest.replace(/[\s\-–—:]+$/, "").replace(/\s+/g, " ").trim();
    if (rest.split(" ").length >= 2 && rest.split(" ").some((w) => UNIT_WORDS.has(w.toLowerCase())))
      return { text: rest, offset: cur.offset };
  }
  const top = lines[0];
  if (top && heading(top)) return { text: withoutContacts(top.text).text, offset: top.offset };
  return null;
}

/** The document's own stated date: from its first lines, or a line beside its self-naming line. */
/** @param {ReadonlyArray<Line>} lines @param {ReadonlyArray<SelfLine>} selfLines @returns {StatedDate | null} */
export function asOfOf(lines, selfLines) {
  const near = new Set(lines.slice(0, 8));
  for (const s of selfLines) {
    const i = lines.findIndex((x) => x.offset === s.offset);
    for (const j of [i - 1, i, i + 1]) { const y = lines[j]; if (y) near.add(y); }
  }
  return statedDate(lines.filter((x) => near.has(x)));
}

/** @type {RosterType} */
export default {
  key: "staff_roster",
  label: localize("roster-reader.staff-roster.a_staff_or_membership", "a staff or membership roster"),
  version: 1,
  /* A roster is a LIST: which rows are present and whether each still says what it said. */
  contract: CONTRACT.MEMBERSHIP,

  detect(ctx) {
    const raw = String((ctx && ctx.text) || "");
    const { count, self: selfLines, paired, named, contactLines, boxes } = readRows(raw, ctx, false);
    if (!count) return no(localize("roster-reader.staff-roster.no_text_was_read_so", "no text was read, so there are no rows to recognise"));
    /* (1) ROWS ARE THE BODY: the floor. */
    if (paired < ROSTER_FLOOR)
      return no(localize("roster-reader.staff-roster.paired_line_s_carry_a", "{paired} line(s) carry a name with more beside it, below the floor of {ROSTER_FLOOR}: the rows are not the body of this document", { paired: String(paired), ROSTER_FLOOR: String(ROSTER_FLOOR) }));
    /* (2) NO CONTACT POINTS AS ITS BODY, decided before the share so a directory is refused as one. */
    const atDomain = directoryShape(raw);
    if (atDomain >= DIRECTORY_FLOOR)
      return no(localize("roster-reader.staff-roster.atdomain_distinct_addresses_at_one", "{atDomain} distinct addresses at one domain: this is a staff directory's shape, which staff_directory reads", { atDomain: String(atDomain) }));
    if (contactLines >= Math.max(3, paired / 2))
      return no(localize("roster-reader.staff-roster.contactlines_line_s_carry_a", "{contactLines} line(s) carry a contact point beside {paired} row(s): a directory or contact list, not a roster", { contactLines: String(contactLines), paired: String(paired) }));
    /* (3) NOT DATED. */
    const dates = datesIn(raw);
    if (dates >= Math.max(3, paired / 2))
      return no(localize("roster-reader.staff-roster.dates_date_s_beside_paired", "{dates} date(s) beside {paired} row(s): the rows are dated events that name people, not a roster", { dates: String(dates), paired: String(paired) }));
    /* (1) ROWS ARE THE BODY: the share, and posts printed apart from names are a chart's boxes. */
    const share = named / count;
    if (share < ROSTER_SHARE)
      return no(localize("roster-reader.staff-roster.named_of_length_lines_carry", "{named} of {length} lines carry a name ({round}%), below {round_2}%: names are mentioned in this document, not listed", { named: String(named), length: String(count), round: String(Math.round(share * 100)), round_2: String(Math.round(ROSTER_SHARE * 100)) }));
    if (boxes >= paired)
      return no(localize("roster-reader.staff-roster.boxes_line_s_print_a", "{boxes} line(s) print a post or unit with no name beside it, against {paired} row(s): posts laid out apart from their holders are a chart's boxes, not a roster's rows", { boxes: String(boxes), paired: String(paired) }));
    const self = namedAs(selfLines, "roster");
    if (self.only_other)
      return no(localize("roster-reader.staff-roster.it_names_itself_with_the_views", "it names itself, with the view's words, as a chart and not as a roster"));
    const signals = [localize("roster-reader.staff-roster.paired_line_s_carry_a_2", "{paired} line(s) carry a name with a title, unit or organisation beside it", { paired: String(paired) }),
                     localize("roster-reader.staff-roster.named_of_length_lines_carry_2", "{named} of {length} lines carry a name ({round}%)", { named: String(named), length: String(count), round: String(Math.round(share * 100)) })];
    const firstAs = self.as[0];
    if (firstAs) {
      signals.push(localize("roster-reader.staff-roster.it_names_itself_a_roster", "it names itself a roster (\"{text}\")", { text: String(firstAs.text.slice(0, 80)) }));
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    }
    return { match: true, confidence: CONFIDENCE.LIKELY, signals,
             why: localize("roster-reader.staff-roster.no_short_line_names_it_a", "no short line names it a roster with the view's words, so it is read as a roster on its rows alone") };
  },

  /** The rows as the lines state them (R2), each placed where `ctx.locate` says (`doctypes` R7). */
  parse(ctx) {
    const raw = String((ctx && ctx.text) || "");
    const given = ctx ? ctx.locate : undefined;
    /** @type {(offset: number) => ReadingPosition | null} */
    const locate = typeof given === "function" ? given : () => null;
    const { lines, rows } = readRows(raw, ctx);
    const self = selfNamingLines(lines, rosterWordPatterns(ctx));
    const asOf = asOfOf(lines, self);
    const org = organisationOf(lines, self, ctx);
    const out = rows.map(({ offset, ...r }) => {
      const src = locate(offset);
      return src ? { ...r, source: src } : { ...r, source: null };
    });
    return {
      rows: out,
      counts: { rows: out.length, divided: out.filter((r) => r.name).length, whole: out.filter((r) => r.line).length },
      as_of: asOf ? { text: asOf.text, date: asOf.date, precision: asOf.precision, source: locate(asOf.offset) || null } : null,
      as_of_why: asOf ? (asOf.why || null) : localize("roster-reader.staff-roster.no_line_among_the_documents_first", "no line among the document's first eight, or beside its self-naming line, states a date"),
      organisation: org ? { text: org.text, source: locate(org.offset) || null } : null,
      organisation_why: org ? null : localize("roster-reader.staff-roster.neither_its_first_line_nor", "neither its first line nor the line before its self-naming line is a heading that names an organisation"),
      also_satisfies: alsoSatisfies(ctx, "staff_roster"),
      at: (ctx && ctx.at) || null,
    };
  },

  assess(a, b) {
    return assessRows(rowEntities(a), rowEntities(b), "roster");
  },
};

/** A reading's rows as entities keyed by name (R5): one per name, its titles and units the facts. A
 *  row kept whole is keyed by its line. */
/** @param {object | null | undefined} parsed a reading `parse` handed back, given again
 *  @returns {RowEntity[]} */
export function rowEntities(parsed) {
  /** @typedef {{ key: string, label: string, titles: Set<string>, units: Set<string> }} Gathered */
  const by = new Map(/** @type {Array<[string, Gathered]>} */ ([]));
  const rows = isObj(parsed) ? parsed.rows : undefined;
  for (const r of isList(rows) ? rows : []) {
    /** @type {Fields} */
    const f = isObj(r) ? r : {};
    const name = strField(f, "name"), line = strField(f, "line"), title = strField(f, "title"), unit = strField(f, "unit");
    const key = name ? `name:${name}` : `line:${line}`;
    const e = by.get(key) || { key, label: name || String(line), titles: new Set(/** @type {string[]} */ ([])), units: new Set(/** @type {string[]} */ ([])) };
    if (title) e.titles.add(title);
    if (unit) e.units.add(unit);
    by.set(key, e);
  }
  return [...by.values()].map((e) => {
    /** @type {EntityFacts} */
    const facts = { title: [...e.titles].sort().join(" | ") || null, unit: [...e.units].sort().join(" | ") || null };
    return entity(e.key, "row", e.label, facts);
  });
}

/** Two readings' rows compared (R5): gone `delisted`, added `item_added`, a title or unit moved
 *  `item_changed`, each from the catalogue. Nothing read on either side is a failed reader.
 * @param {RowEntity[]} before
 * @param {RowEntity[]} after
 * @param {string} what the document's kind in words, "roster" or "chart"
 * @returns {Assessment}
 */
export function assessRows(before, after, what) {
  if (!before.length || !after.length)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("roster-reader.staff-roster.no_row_could_be_read", "no row could be read from this {what} {v1}, so nothing is claimed about who left or joined", { what: String(what), v1: String(!before.length && !after.length ? "either time" : !before.length ? "the first time" : "this time") }) };
  const d = diffEntities(before, after);
  /* Each event is the catalogue's (`event` refuses a type it does not hold), its type and significance first. */
  /** @type {RowEvent[]} */
  const events = [];
  for (const e of d.gone) {
    const h = event("delisted");
    events.push({ type: h.type, significance: h.significance, key: e.key, label: e.label, why: localize("roster-reader.staff-roster.this_row_is_no_longer", "this row is no longer listed in the {what}", { what: String(what) }) });
  }
  for (const e of d.appeared) {
    const h = event("item_added");
    events.push({ type: h.type, significance: h.significance, key: e.key, label: e.label, why: localize("roster-reader.staff-roster.the_what_now_lists_a", "the {what} now lists a row it did not", { what: String(what) }) });
  }
  for (const x of d.altered) {
    const h = event("item_changed");
    events.push({ type: h.type, significance: h.significance, key: x.entity.key, label: x.entity.label, moved: x.moved,
      why: localize("roster-reader.staff-roster.this_rows_map_in_the", "this row's {map} in the {what} now reads otherwise", { map: String(x.moved.map((m) => m.fact).join(" and ")), what: String(what) }) });
  }
  bySeverity(events);
  const intact = before.filter((e) => after.some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;
  return { meaningful: isMeaningful(events), significance: worstSignificance(events), events,
           confirmed: intact ? { rows: after.length, intact } : null,
           why: events.length ? `${events.length} change(s) to the ${what}'s rows` : localize("roster-reader.staff-roster.the_what_lists_the_same", "the {what} lists the same rows, each saying what it said", { what: String(what) }) };
}
