/* Stub content types for docprofile's tests (T34-8; N549; R36). This module holds no
 * content type, so its suites register these through the seam (`registerDoctype`), the
 * way `plane` registers `doctypes`' types, and test the pipeline, `readText`, the
 * registry and the shared helpers with them. They are TEST readers: each is written from
 * the fixtures beside it, reads only through this module's exported helpers, and claims
 * nothing about any real kind of document. `doctypes`' own types are a later module's and
 * are never imported here.
 *
 *   stub_meetings  MEMBERSHIP: the meeting rows of `calendarHtml`, CERTAIN on its page
 *                  shape; events, a confirmation and both kinds of connection, the
 *                  minutes' due date from the view's practice (`practiceValue`).
 *   stub_items     MEMBERSHIP: file numbers in the view's `file_numbers` shapes, placed
 *                  only where `ctx.locate` says, a reference read again an occurrence;
 *                  CERTAIN on a masthead (`vocabPatterns` of `report_titles`) at the
 *                  furniture rate, LIKELY on the word ITEMS alone.
 *   stub_fallback  the fallback: detects nothing, reads nothing, reports a substantive
 *                  difference without describing it.
 */
import {
  CONFIDENCE, CONTRACT, entity, readAgain, referential, temporal, diffEntities, event, isMeaningful,
  worstSignificance, vocabPatterns, vocabulary, vocabRegex, IN_PROSE, selfNaming, FURNITURE_RECURS,
  practiceValue, alsoSatisfies,
} from "../registry.mjs";

/** @import { ContentType, Entity, Connection, Registration } from "../registry.mjs" */
/**
 * A stub's reading: the entities it read and its facts, and why it read no reference where it read none.
 * @typedef {{ entities: Entity[], facts: { [fact: string]: number | string[] }, references_why?: string }} StubReading
 */
/* The seam hands a type back the reading its own `parse` made, as a reading of no stated kind (R36): the stub's own. */
const readingOf = /** @param {object | null | undefined} r @returns {StubReading} */ (r) => /** @type {StubReading} */ (r);

const ROW = /<tr><td><a href="MeetingDetail\.aspx\?ID=(\d+)[^"]*">([^<]*?)(?: - ([A-Z]+))?<\/a><\/td><td>([^<]*)<\/td><td>(?:<a href="View\.ashx\?M=A&amp;ID=(\d+)">)?[^<]*(?:<\/a>)?<\/td><td>(?:<a href="View\.ashx\?M=M&amp;ID=(\d+)">)?/g;
const isoOf = /** @param {string} mdy */ (mdy) => { const [m = NaN, d = NaN, y = NaN] = mdy.split("/").map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); };

/** @type {ContentType} */
export const stubMeetings = { // fixtures-own: harness a test reader registered through this module's own registerDoctype seam; no module provides it
  key: "stub_meetings", label: "stub: a list of meetings", version: 1, contract: CONTRACT.MEMBERSHIP,
  detect(ctx) {
    const t = String(ctx.text || "");
    /* The list's own range selector, present whether or not any meeting is listed, so an
       emptied list is still this type and its reading of nothing is a failed reader. */
    return t.includes('id="ctl00_lstYears_Input"')
      ? { match: true, confidence: CONFIDENCE.CERTAIN, signals: ["the meeting list's range selector"] } : { match: false };
  },
  parse(ctx) {
    /** @type {Entity[]} */
    const entities = [];
    for (const m of String(ctx.text || "").matchAll(ROW))
      entities.push(entity(`meeting:${m[1]}`, "meeting", String(m[2]), {
        body: String(m[2]), date: isoOf(String(m[4])), status: m[3] || "scheduled", agenda: m[5] || null, minutes: m[6] || null }));
    return { entities, facts: { meetings: entities.length } };
  },
  assess(ra, rb) {
    const a = readingOf(ra), b = readingOf(rb);
    if (!a.entities.length || !b.entities.length)
      return { meaningful: null, events: [], confirmed: null,
               why: "one side's meetings could not be read: a reading that found nothing is a failed reader" };
    const d = diffEntities(a.entities, b.entities);
    /** @type {object[]} */
    const events = [];
    for (const g of d.gone) events.push(event("delisted", { entity: g.key }));
    for (const n of d.appeared) events.push(event("scheduled", { entity: n.key }));
    for (const x of d.altered) for (const mv of x.moved) {
      if (mv.fact === "status" && mv.now === "CANCELLED") events.push(event("cancelled", { entity: x.entity.key }));
      else if (mv.fact === "body") events.push(event("renamed", { entity: x.entity.key }));
      else if (mv.fact === "agenda") events.push(event("agenda_published", { entity: x.entity.key }));
      else events.push(event("status_changed", { entity: x.entity.key }));
    }
    const intact = d.before_count - d.gone.length - d.altered.length;
    return { meaningful: isMeaningful(events), events,
             confirmed: intact > 0 ? { entries: d.before_count, intact, why: `${intact} meeting(s) say what they said` } : null,
             why: events.length ? `${events.length} change(s) among the meetings` : "the same meetings" };
  },
  connections(ra, rb, ctx) {
    const b = readingOf(rb);
    /** @type {Connection[]} */
    const out = [];
    const due = practiceValue(ctx, "minutes_due_days");
    for (const e of b.entities) {
      out.push(referential(e.key, `body:${e.facts.body}`, "held_by", "the row names the body"));
      if (e.facts.agenda) out.push(referential(`agenda:${e.facts.agenda}`, e.key, "is_the_agenda_for", "the row links it"));
      if (e.facts.minutes) {
        out.push(referential(`minutes:${e.facts.minutes}`, e.key, "is_the_minutes_of", "the row links it"));
        out.push(temporal(e.key, `minutes:${e.facts.minutes}`, "minutes_published_after", { at: String(e.facts.date), why: "linked" }));
      } else if (ctx.now && String(e.facts.date) < String(ctx.now).slice(0, 10)) {
        const by = due ? new Date(Date.parse(String(e.facts.date)) + due.value * 864e5).toISOString().slice(0, 10) : null;
        out.push(temporal(e.key, null, "minutes_not_yet_published", { at: String(e.facts.date), expected_by: by,
          why: due ? `the view's practice gives ${due.value} days (${due.basis})` : "when minutes are due is not known in this view" }));
      } else if (!e.facts.agenda) {
        out.push(temporal(e.key, null, "agenda_not_yet_published", { at: String(e.facts.date), why: "no agenda is linked yet" }));
      }
    }
    return out;
  },
};

/* A masthead names the document on a line of its own, once per page (FURNITURE_RECURS). */
const ITEMS_WORD = /^ITEMS\b/;
/** @type {ContentType} */
export const stubItems = { // fixtures-own: harness a test reader registered through this module's own registerDoctype seam; no module provides it
  key: "stub_items", label: "stub: a list of filed items", version: 1, contract: CONTRACT.MEMBERSHIP,
  detect(ctx) {
    const t = String(ctx.text || "");
    const titles = vocabPatterns(ctx, "report_titles");
    const mast = t.split(/\r?\n/).filter((l) => titles.some((re) => re.test(l.trim()))).length;
    if (mast >= FURNITURE_RECURS) return { match: true, confidence: CONFIDENCE.CERTAIN, signals: [`masthead ×${mast}`] };
    if (selfNaming(t, ITEMS_WORD) > 0) return { match: true, confidence: CONFIDENCE.LIKELY, signals: ["ITEMS"] };
    return { match: false };
  },
  parse(ctx) {
    const text = String(ctx.text || "");
    const given = ctx.locate;
    const locate = typeof given === "function" ? given : () => null;
    /** @type {RegExp[]} */
    const shapes = [];
    for (const e of vocabulary(ctx, "file_numbers")) { const re = vocabRegex("pattern" in e ? e.pattern : null, IN_PROSE, "g"); if (re) shapes.push(re); }
    if (!shapes.length)
      return { entities: [], facts: { also: alsoSatisfies(ctx, "stub_items") },
               references_why: "no active jurisdiction profile describes a file number, so none was read" };
    /** @type {Map<string, Entity>} */
    const byKey = new Map();
    /** @type {RegExpExecArray[]} */
    const hits = [];
    for (const re of shapes) { re.lastIndex = 0; for (const m of text.matchAll(re)) hits.push(m); }
    hits.sort((x, y) => x.index - y.index);
    for (const m of hits) {
      const src = locate(m.index);
      const held = byKey.get(m[0]);
      if (held) readAgain(held, src);
      else byKey.set(m[0], entity(m[0], "item", m[0], { file: m[0] }, src));
    }
    return { entities: [...byKey.values()], facts: { also: alsoSatisfies(ctx, "stub_items") } };
  },
  assess(ra, rb) {
    const a = readingOf(ra), b = readingOf(rb);
    if (!a.entities.length || !b.entities.length)
      return { meaningful: null, events: [], confirmed: null, why: "one side's items could not be read" };
    const d = diffEntities(a.entities, b.entities);
    const events = [...d.gone.map((g) => event("item_pulled", { entity: g.key })),
                    ...d.appeared.map((n) => event("item_added", { entity: n.key }))];
    return { meaningful: isMeaningful(events), significance: worstSignificance(events), events, confirmed: null,
             why: events.length ? "the items moved" : "the same items" };
  },
};

/** @type {ContentType} */
export const stubFallback = { // fixtures-own: harness a test reader registered through this module's own registerDoctype seam; no module provides it
  key: "stub_fallback", label: "stub: a document of no recognised type", version: 1, fallback: true,
  contract: CONTRACT.SUBSTANCE,
  detect() { return { match: false, confidence: CONFIDENCE.NONE }; },
  parse() { return { entities: [], facts: {} }; },
  assess() {
    const events = [event("substance_changed", { why: "the substance changed; its kind is not known" })];
    return { meaningful: isMeaningful(events), events, confirmed: null, why: "the substance changed, not described" };
  },
};

/** Register the three stubs, in the order a composer would: the readers, then the fallback.
 *  @param {(type: ContentType) => Registration} register
 *  @returns {Registration[]} */
export function registerStubs(register) {
  return [stubMeetings, stubItems, stubFallback].map((t) => register(t));
}
