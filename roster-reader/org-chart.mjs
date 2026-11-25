/* `org_chart` (R3, R4, R5): a document naming an organisation's units and posts in chart form.
 *
 * MEASURED ON REAL DOCUMENTS from the same bucket, read through the plane (`test/fixtures/`): the police
 * department's chart of March 2021 (units only, one box to a line or two), its Bureau of Services chart of
 * September 2018 (units with a post under each), the City Administrator's chart of October 2021 (posts with
 * their holders, several boxes to a line), and the Public Works chart of September 2021 (a staffing chart:
 * hundreds of posts with their holders, vacancies named). Fenced against the rosters, the directories and
 * their look-alikes, and FW-18's substance documents.
 *
 * WHAT TEXT CARRIES OF A CHART, AND WHAT IT DOES NOT. A chart is boxes joined by lines. Text extraction
 * carries the boxes' LABELS, in an order the page layout decides, and nothing of the lines: which box sits
 * under which is a drawing, and no reading of the text can recover it. So this type reads the units and
 * posts as labels, a name beside a post only where one line holds exactly the post and one name, and a
 * reporting pair ONLY where the words of the document state it ("X reports to Y"); `pairs_why` says so
 * every time. Reading a hierarchy from the order of labels would be the guess R10 forbids.
 *
 * THE PRINCIPLE: (1) BOXES ARE THE BODY — at least CHART_FLOOR lines are box labels (a unit: a kind-of-unit
 * word ends or opens the line; a post: one of the view's staff titles; or a holder's name alone), at least
 * CHART_MIN_LABELS of them name a unit or a post, and box labels are at least CHART_SHARE of the lines;
 * (2) BOX LABELS ARE SHORT — the median line is at most CHART_SHORT words; (3) a document that names itself,
 * with the view's `roster_words`, only as a roster is not a chart, and one that names itself a chart is
 * raised from LIKELY to CERTAIN; self-naming is never sufficient alone.
 *
 * WHAT IT CANNOT SEE: a chart whose boxes are an image (one measured chart has no text layer; it is not
 * read here, and nothing is said about it beyond that no text was read); a chart whose labels are mostly
 * prose (the community-safety chart, which falls to `generic`); and, without the view's staff titles, the
 * posts, so a staffing chart that prints holders under titles is a LIKELY roster as much as a chart. */
import { CONFIDENCE, CONTRACT, entity, alsoSatisfies } from "../docprofile/registry.mjs";
import { isName, leadingName, withoutContacts, titlePatterns, titleSpans, removeSpans, rosterWordPatterns, selfNamingLines,
         namedAs, eachLine, selfNamingLine, isUnitLine, UNIT_WORDS, wordCount } from "./lines.mjs";
import { asOfOf, organisationOf, assessRows } from "./staff-roster.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/* MEASURED with the first profile's proposed words: the charts carry 23 to 756 box lines (units, posts and
   holders alone), of which 4 to 218 name a unit or a post; the look-alikes past the floor are refused by
   the share. A list of names alone is not a chart, so at least CHART_MIN_LABELS lines must label a box. */
export const CHART_FLOOR = 8;
export const CHART_MIN_LABELS = 3;
/* MEASURED: the charts at 0.49 to 0.84 of their lines; the highest look-alike 0.30 (the dated meeting
   schedule, whose rows name a coordinator and a beat). */
export const CHART_SHARE = 0.4;
/* MEASURED: the charts' median line is 2 to 4 words; no look-alike that reaches this rule. */
export const CHART_SHORT = 5;

const REPORTS = /^(.+?)\s+(?:reports|report|reporting)\s+(?:directly\s+)?to\s+(?:the\s+)?(.+?)[.;]?$/i;

/* `keep` false (`detect`) holds no line, unit or post: the counts, the numbers of the lines that label a box, a
   histogram of the lines' word counts and the self-naming lines are all it keeps, so the reading of a 20 MB
   text holds one line at a time (R3). */
function readBoxes(raw, ctx, keep = true) {
  const titles = titlePatterns(ctx);
  const selfPatterns = keep ? [] : rosterWordPatterns(ctx);
  const lines = [], units = [], posts = [], pairs = [], self = [];
  const unitLines = new Set(), postLines = new Set(), wordHist = new Map();
  let count = 0, named = 0;
  eachLine(raw, (x) => {
    const at = count++;
    if (keep) lines.push(x);
    else {
      const w = wordCount(x.text);
      wordHist.set(w, (wordHist.get(w) || 0) + 1);
      const s = selfNamingLine(x, selfPatterns);
      if (s) self.push(s);
    }
    const { text } = withoutContacts(x.text);
    if (!text) return;
    const rep = keep ? REPORTS.exec(text) : null;
    if (rep) pairs.push({ from: rep[1].trim(), to: rep[2].trim(), offset: x.offset, line: text });
    const ts = titleSpans(titles, text);
    if (ts.length) {
      const rest = removeSpans(text, ts);
      if (ts.length === 1 && isName(rest)) {
        postLines.add(at);
        if (keep) posts.push({ label: ts[0].text.trim(), name: rest, offset: x.offset });
        return;
      }
      postLines.add(at);
      if (keep) for (const h of ts) posts.push({ label: h.text.trim(), offset: x.offset + h.index });
    } else if (isName(text)) { named++; return; }
    /* A unit's label ends in its kind ("Records Division"); a line that opens with a name and ends
       otherwise is a row ("<name> District 1"), never a unit's box. */
    const last = text.slice(text.lastIndexOf(" ") + 1).replace(/[^\p{L}]/gu, "").toLowerCase();
    if (isUnitLine(text) && (UNIT_WORDS.has(last) || !leadingName(text.replace(/^\d{1,3}[.)]?\s+/, "")))) {
      unitLines.add(at);
      if (keep) units.push({ label: text, offset: x.offset });
    }
  });
  return { lines, count, units, posts, pairs, named, unitLines, postLines, wordHist, self };
}

/** The lower middle of the numbers, given as a map from each number to how often it occurs. */
function medianOf(hist, total) {
  if (!total) return 0;
  const want = Math.floor((total - 1) / 2);
  let seen = 0;
  for (const v of [...hist.keys()].sort((a, b) => a - b)) { seen += hist.get(v); if (seen > want) return v; }
  return 0;
}

const no = (why) => ({ match: false, confidence: CONFIDENCE.NONE, why });

export default {
  key: "org_chart",
  label: "an organisation chart",
  version: 1,
  /* A chart is watched as a list of its boxes: which units and posts are present, and who is named. */
  contract: CONTRACT.MEMBERSHIP,

  detect(ctx) {
    const raw = String((ctx && ctx.text) || "");
    const { count, unitLines: unitSet, postLines: postSet, named, wordHist, self: selfLines } = readBoxes(raw, ctx, false);
    if (!count) return no(localize("roster-reader.org-chart.no_text_was_read_so", "no text was read, so there are no boxes to recognise"));
    const unitLines = unitSet.size;
    const postLines = new Set([...postSet].filter((i) => !unitSet.has(i)));
    const labelled = unitLines + postLines.size;
    const boxes = labelled + named;
    if (labelled < CHART_MIN_LABELS || boxes < CHART_FLOOR)
      return no(localize("roster-reader.org-chart.labelled_line_s_name_a", "{labelled} line(s) name a unit or a post and {named} a holder alone, below the floor ({min_labels} labelled, {floor} boxes): this document does not lay out an organisation's boxes", { labelled: String(labelled), named: String(named), min_labels: String(CHART_MIN_LABELS), floor: String(CHART_FLOOR) }));
    const share = boxes / count;
    if (share < CHART_SHARE)
      return no(localize("roster-reader.org-chart.boxes_of_length_lines_are", "{boxes} of {length} lines are box labels ({round}%), below {round_2}%: units and posts are mentioned here, not charted", { boxes: String(boxes), length: String(count), round: String(Math.round(share * 100)), round_2: String(Math.round(CHART_SHARE * 100)) }));
    const mid = medianOf(wordHist, count);
    if (mid > CHART_SHORT)
      return no(localize("roster-reader.org-chart.its_median_line_is_mid", "its median line is {mid} words, longer than a box label ({CHART_SHORT}): this is running text", { mid: String(mid), CHART_SHORT: String(CHART_SHORT) }));
    const self = namedAs(selfLines, "chart");
    if (self.only_other)
      return no(localize("roster-reader.org-chart.it_names_itself_with_the_views", "it names itself, with the view's words, as a roster and not as a chart"));
    const signals = [`${unitLines} unit line(s), ${postLines.size} post line(s), ${named} holder line(s)`,
                     localize("roster-reader.org-chart.round_of_its_lines_are", "{round}% of its lines are box labels; its median line is {mid} word(s)", { round: String(Math.round(share * 100)), mid: String(mid) })];
    if (self.as.length) {
      signals.push(localize("roster-reader.org-chart.it_names_itself_a_chart", "it names itself a chart (\"{text}\")", { text: String(self.as[0].text.slice(0, 80)) }));
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    }
    return { match: true, confidence: CONFIDENCE.LIKELY, signals,
             why: localize("roster-reader.org-chart.no_short_line_names_it_a", "no short line names it a chart with the view's words, so it is read as a chart on its boxes alone") };
  },

  parse(ctx) {
    const raw = String((ctx && ctx.text) || "");
    const locate = ctx && typeof ctx.locate === "function" ? ctx.locate : () => null;
    const { lines, units, posts, pairs } = readBoxes(raw, ctx);
    const self = selfNamingLines(lines, rosterWordPatterns(ctx));
    const asOf = asOfOf(lines, self);
    const org = organisationOf(lines, self, ctx);
    const place = ({ offset, ...r }) => ({ ...r, source: locate(offset) || null });
    return {
      units: units.map(place),
      posts: posts.map(place),
      reports_to: pairs.map(({ line, ...p }) => place(p)),
      pairs_why: pairs.length
        ? localize("roster-reader.org-chart.reporting_relation_s_stated_in_words", "{count} reporting relation(s) stated in words; the chart's boxes and connecting lines are a drawing that text does not carry, so no other pair is read", { count: String(pairs.length) })
        : localize("roster-reader.org-chart.no_reporting_relation_is_stated", "no reporting relation is stated in words; the chart's boxes and connecting lines are a drawing that text does not carry, so no other pair is read"),
      counts: { units: units.length, posts: posts.length, named_posts: posts.filter((p) => p.name).length, reports_to: pairs.length },
      as_of: asOf ? { text: asOf.text, date: asOf.date, precision: asOf.precision, source: locate(asOf.offset) || null } : null,
      as_of_why: asOf ? (asOf.why || null) : localize("roster-reader.org-chart.no_line_among_the_documents_first", "no line among the document's first eight, or beside its self-naming line, states a date"),
      organisation: org ? { text: org.text, source: locate(org.offset) || null } : null,
      organisation_why: org ? null : localize("roster-reader.org-chart.neither_its_first_line_nor", "neither its first line nor the line before its self-naming line is a heading that names an organisation"),
      also_satisfies: alsoSatisfies(ctx, "org_chart"),
      at: (ctx && ctx.at) || null,
    };
  },

  /** Two readings compared by box (R5): a unit or post gone `delisted`, added `item_added`, the name
   *  beside a post moved `item_changed`. */
  assess(a, b) {
    return assessRows(boxEntities(a), boxEntities(b), "chart");
  },
};

function boxEntities(parsed) {
  const by = new Map();
  for (const u of (parsed && parsed.units) || []) if (!by.has(`unit:${u.label}`)) by.set(`unit:${u.label}`, { label: u.label, names: new Set() });
  for (const p of (parsed && parsed.posts) || []) {
    const k = `post:${p.label}`;
    const e = by.get(k) || { label: p.label, names: new Set() };
    if (p.name) e.names.add(p.name);
    by.set(k, e);
  }
  return [...by].map(([k, e]) => entity(k, "box", e.label, k.startsWith("post:") ? { holders: [...e.names].sort().join(" | ") || null } : {}));
}
