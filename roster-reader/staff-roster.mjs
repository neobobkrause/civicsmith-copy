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
         rosterWordPatterns, selfNamingLines, selfNamingLine, namedAs, eachLine, statedDate, datesIn, isUnitLine, UNIT_WORDS, EMAIL } from "./lines.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/* The fewest lines that carry a name with more beside it for the rows to be the body. MEASURED with the
   first profile's proposed words (test/fixtures.mjs): the rosters carry 18 (the board roster), 32 and 131;
   the look-alikes that stop here carry at most 4 (the two-column directory sheet, FW-18's agenda). Five is
   the staff directory's own floor, kept the same so the two list types cannot drift apart. */
export const ROSTER_FLOOR = 5;
/* The share of a document's lines that carry a name. MEASURED: the rosters sit at 0.71 to 0.90; the
   documents past the floor that only this refuses at 0.23 (the business-resources letter). Several
   look-alikes carry a higher share (the directories, the EIR's commenter tables, the candidate list) and
   are refused by (2) and (3), which is why those rules are decided first. */
export const ROSTER_SHARE = 0.35;
/* `staff_directory`'s own deciding leg: this many distinct addresses at one domain is its shape. */
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
      let title = left, unit;
      if (ts.length) {
        const first = ts[0];
        const before = left.slice(0, first.index).trim();
        title = left.slice(first.index).trim();
        if (before) unit = before;
      }
      return { rows: parts.map((name) => ({ name: name.trim(), title, ...(unit ? { unit } : {}) })), paired: true, named: true };
    }
    if (leadingName(right))
      return { rows: [{ line: t, why: localize("roster-reader.staff-roster.the_line_does_not_divide", "the line does not divide into a post and the names after it: what follows its colon is not names alone") }],
               paired: true, named: true };
  }
  /* A title printed before or after one name: the view's titles, never a guess. */
  const ts = titleSpans(titles, t);
  if (ts.length) {
    const rest = removeSpans(t, ts);
    const lead = ts[0].index === 0, tail = ts[ts.length - 1].index + ts[ts.length - 1].text.length === t.length;
    const contiguous = ts.every((h, i) => i === 0 || t.slice(ts[i - 1].index + ts[i - 1].text.length, h.index).trim() === "");
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
function readRows(raw, ctx, keep = true) {
  const titles = titlePatterns(ctx);
  const selfPatterns = keep ? [] : rosterWordPatterns(ctx);
  const lines = [], rows = [], self = [];
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

function directoryShape(raw) {
  const byDomain = new Map();
  for (const a of new Set((raw.match(EMAIL) || []).map((s) => s.toLowerCase()))) {
    const d = a.split("@")[1];
    byDomain.set(d, (byDomain.get(d) || 0) + 1);
  }
  return Math.max(0, ...byDomain.values());
}

const no = (why) => ({ match: false, confidence: CONFIDENCE.NONE, why });

/** The organisation as the title names it: the heading just before the self-naming line; else the
 *  self-naming line itself, its roster words removed, when what remains names a unit; else the first line
 *  when it is a heading. A heading has no digit and no colon, is not a lone name and prints no staff title. */
export function organisationOf(lines, selfLines, ctx) {
  const titles = titlePatterns(ctx);
  const selfAt = new Set(selfLines.map((x) => x.offset));
  const heading = (x) => x && !/[\d:]/.test(x.text) && !isName(x.text) && !selfAt.has(x.offset) && !titleSpans(titles, x.text).length;
  const at = selfLines.length ? lines.findIndex((x) => x.offset === selfLines[0].offset) : -1;
  if (at > 0 && heading(lines[at - 1])) return { text: withoutContacts(lines[at - 1].text).text, offset: lines[at - 1].offset };
  if (at >= 0) {
    const words = rosterWordPatterns(ctx).map((p) => p.re);
    let rest = lines[at].text;
    for (const re of words) rest = rest.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
    rest = rest.replace(/[\s\-–—:]+$/, "").replace(/\s+/g, " ").trim();
    if (rest.split(" ").length >= 2 && rest.split(" ").some((w) => UNIT_WORDS.has(w.toLowerCase())))
      return { text: rest, offset: lines[at].offset };
  }
  if (heading(lines[0])) return { text: withoutContacts(lines[0].text).text, offset: lines[0].offset };
  return null;
}

/** The document's own stated date: from its first lines, or a line beside its self-naming line. */
export function asOfOf(lines, selfLines) {
  const near = new Set(lines.slice(0, 8));
  for (const s of selfLines) {
    const i = lines.findIndex((x) => x.offset === s.offset);
    for (const j of [i - 1, i, i + 1]) if (lines[j]) near.add(lines[j]);
  }
  return statedDate(lines.filter((x) => near.has(x)));
}

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
    if (self.as.length) {
      signals.push(localize("roster-reader.staff-roster.it_names_itself_a_roster", "it names itself a roster (\"{text}\")", { text: String(self.as[0].text.slice(0, 80)) }));
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    }
    return { match: true, confidence: CONFIDENCE.LIKELY, signals,
             why: localize("roster-reader.staff-roster.no_short_line_names_it_a", "no short line names it a roster with the view's words, so it is read as a roster on its rows alone") };
  },

  /** The rows as the lines state them (R2), each placed where `ctx.locate` says (`doctypes` R7). */
  parse(ctx) {
    const raw = String((ctx && ctx.text) || "");
    const locate = ctx && typeof ctx.locate === "function" ? ctx.locate : () => null;
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
export function rowEntities(parsed) {
  const by = new Map();
  for (const r of (parsed && parsed.rows) || []) {
    const key = r.name ? `name:${r.name}` : `line:${r.line}`;
    const e = by.get(key) || { key, label: r.name || r.line, titles: new Set(), units: new Set() };
    if (r.title) e.titles.add(r.title);
    if (r.unit) e.units.add(r.unit);
    by.set(key, e);
  }
  return [...by.values()].map((e) =>
    entity(e.key, "row", e.label, { title: [...e.titles].sort().join(" | ") || null, unit: [...e.units].sort().join(" | ") || null }));
}

/** Two readings' rows compared (R5): gone `delisted`, added `item_added`, a title or unit moved
 *  `item_changed`, each from the catalogue. Nothing read on either side is a failed reader. */
export function assessRows(before, after, what) {
  if (!before.length || !after.length)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("roster-reader.staff-roster.no_row_could_be_read", "no row could be read from this {what} {v1}, so nothing is claimed about who left or joined", { what: String(what), v1: String(!before.length && !after.length ? "either time" : !before.length ? "the first time" : "this time") }) };
  const d = diffEntities(before, after);
  const events = [];
  for (const e of d.gone) events.push(event("delisted", { key: e.key, label: e.label, why: localize("roster-reader.staff-roster.this_row_is_no_longer", "this row is no longer listed in the {what}", { what: String(what) }) }));
  for (const e of d.appeared) events.push(event("item_added", { key: e.key, label: e.label, why: localize("roster-reader.staff-roster.the_what_now_lists_a", "the {what} now lists a row it did not", { what: String(what) }) }));
  for (const x of d.altered)
    events.push(event("item_changed", { key: x.entity.key, label: x.entity.label, moved: x.moved,
      why: localize("roster-reader.staff-roster.this_rows_map_in_the", "this row's {map} in the {what} now reads otherwise", { map: String(x.moved.map((m) => m.fact).join(" and ")), what: String(what) }) }));
  bySeverity(events);
  const intact = before.filter((e) => after.some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;
  return { meaningful: isMeaningful(events), significance: worstSignificance(events), events,
           confirmed: intact ? { rows: after.length, intact } : null,
           why: events.length ? `${events.length} change(s) to the ${what}'s rows` : localize("roster-reader.staff-roster.the_what_lists_the_same", "the {what} lists the same rows, each saying what it said", { what: String(what) }) };
}
