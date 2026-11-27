/* doctypes — the regulation reader's sections, definitions and exceptions (R9–R17, R19),
 * at the module's interface (`regulation` from `doctypes/index.mjs`). The real corpus is the
 * codifier captures in ./fixtures/codifier.json (time-law §4–§5: 53 sections of one code,
 * each its own document, and two charter articles holding 30 sections), read as a text
 * producer gives them (./codifier.mjs), and checked against ./fixtures/codifier-answers.json,
 * which comes from the codifier's markup and a reading of the printed text, not from this
 * reader. Every made-up check also runs under Port Alder, a profile that is not the first. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { regulation, DOCTYPES } from "../index.mjs";
import { EVENTS, CONFIDENCE } from "../../site-profiles/index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";
import { combine, list } from "../../jurisdictions/index.mjs";
import { PORT_ALDER, LAKEMONT, view, HELD, PA_BYLAW, PA_CODE, withCodeSections, PA_SECTIONS } from "./fixtures.mjs";
import { servedDocuments, textOf, CODIFIER } from "./codifier.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
/** @import { View } from "../../jurisdictions/index.mjs" */
/** @import { Detection, SuppliedText } from "../../docprofile/doctypes/index.mjs" */
/** @import { Locate } from "../../docprofile/readtext.mjs" */
/** @import { EventHead } from "../../site-profiles/index.mjs" */
/** @import { RegulationReading } from "../regulation.mjs" */
/** @import { Section } from "../sections.mjs" */
/** @import { CodifierAnswers, CodifierCapture, DocumentAnswers, ServedDocument } from "./codifier.mjs" */
/** @import { CodeSectionsByKey } from "./fixtures.mjs" */

/**
 * A captured text of the measured instruments (`fixtures/fw18-doctypes.json`), as much of it as this test reads.
 * @typedef {Object} Fw18Document
 * @property {{ document: string }} text
 */
/**
 * The measured instruments' captures this test reads (`fixtures/fw18-doctypes.json`'s `documents`).
 * @typedef {Object} Fw18Documents
 * @property {Fw18Document} regulation
 * @property {Fw18Document} staff_report
 */
/**
 * A text read as the plane reads it: the flattened text, its locator, and the regulation type's detection and parse.
 * @typedef {Object} ReadText
 * @property {string} text
 * @property {Locate} locate
 * @property {Detection} detect
 * @property {RegulationReading} parsed
 */
/**
 * A served document of the corpus, read: where it came from, the document, the member's answers to it, and its reading.
 * @typedef {ReadText & { capture: CodifierCapture, doc: ServedDocument, want: DocumentAnswers | undefined }} CorpusEntry
 */

/** `x`, which the test has made sure is there; a `TypeError` where it is not, as reading a member of it would have.
 *  @template T
 *  @param {T | null | undefined} x @param {string} what @returns {T} */
const must = (x, what) => {
  if (x === null || x === undefined) throw new TypeError(`no ${what}`);
  return x;
};
/** A text `assert.match` reads: a `TypeError` where it is none, as `assert.match` throws for a value that is not text.
 *  @param {string | null | undefined} x @returns {string} */
const str = (x) => {
  if (typeof x !== "string") throw new TypeError(`not text: ${String(x)}`);
  return x;
};
/** A list of whatever an event's detail holds. @typedef {ReadonlyArray<unknown>} DetailList */
/** Whether a value is a list (`Array.isArray`). @param {unknown} x @returns {x is DetailList} */
const isList = (x) => Array.isArray(x);
/* An event's detail follows its head (site-profiles states only the head, `EventHead`): each member this test reads, as
   the event holds it, or undefined where it holds none. */
/** @param {EventHead} e @returns {unknown} */
const keyOf = (e) => ("key" in e ? e.key : undefined);
/** @param {EventHead} e @returns {unknown} */
const movedOf = (e) => ("moved" in e ? e.moved : undefined);
/** @param {EventHead} e @returns {unknown} */
const wasOf = (e) => ("was" in e ? e.was : undefined);
/** @param {EventHead} e @returns {unknown} */
const nowOf = (e) => ("now" in e ? e.now : undefined);
/** @param {EventHead} e @returns {unknown} */
const whyOf = (e) => ("why" in e ? e.why : undefined);
/** An event's section path, joined with `sep`; a `TypeError` where it has none, as joining a missing path would have.
 *  @param {EventHead} e @param {string} sep @returns {string} */
const sectionOf = (e, sep) => {
  const s = "section" in e ? e.section : undefined;
  if (!isList(s)) throw new TypeError("an event with no section");
  return s.join(sep);
};
/** A passage's section path, joined with `sep`; a `TypeError` where it has none, as joining a missing path would have.
 *  @param {{ readonly section: ReadonlyArray<string> | null }} x @param {string} sep @returns {string} */
const pathOf = (x, sep) => must(x.section, "section").join(sep);

/** The member's answers (this module's own fixture). */
const ANSWERS = /** @type {CodifierAnswers} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/codifier-answers.json", import.meta.url), "utf8"))).documents;
/** The measured instruments (this module's own fixture). */
const FW18 = /** @type {{ documents: Fw18Documents }} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/fw18-doctypes.json", import.meta.url), "utf8"))).documents;
const CODE_VIEW = HELD;
/* The held view with no code's section forms: what a reader knows without them. */
const NO_FORMS = (() => { const v = structuredClone(HELD); for (const c of (v.vocabulary || {}).codes || []) delete c.sections; return v; })();
const PA = view(PORT_ALDER);
const LK = view(LAKEMONT);
/** @param {RegulationReading} p @returns {Section[]} */
const top = (p) => p.sections.filter((s) => s.heading !== null);

/** A capture read as the plane reads text: flattened, located, parsed.
 *  @param {SuppliedText | string} supplied @param {View} v @returns {ReadText} */
function read(supplied, v) {
  const flat = flattenText(supplied);
  const locate = makeLocator(flat.segments);
  return { text: flat.text, locate, detect: regulation.detect({ text: flat.text, view: v }),
           parsed: regulation.parse({ text: flat.text, view: v, locate }) };
}
/** @type {CorpusEntry[]} */
const CORPUS = servedDocuments().map(({ capture, doc }) => ({ capture, doc, want: ANSWERS[doc.Id], ...read(textOf(doc), CODE_VIEW) }));

/* ---------------------------------------------------------------------- R9 */

test("R9 form is instrument or code; a code section is CERTAIN only on a heading of a code the view names, then a title", () => {
  assert.equal(CORPUS.length, 55);
  for (const c of CORPUS) {
    assert.equal(c.parsed.form, "code", c.doc.Title);
    assert.equal(c.detect.match, true, c.doc.Title);
    assert.equal(c.detect.confidence, CONFIDENCE.CERTAIN, c.doc.Title);
    assert.ok(must(c.detect.signals, "signals").some((s) => /section heading/.test(s)), c.doc.Title);
    // the same document under a view naming no section form: not a code section, not a regulation
    const bare = read(textOf(c.doc), NO_FORMS);
    assert.equal(bare.parsed.form === "code", false, `${c.doc.Title}: no form, no code`);
    assert.ok(!(bare.detect.signals || []).some((x) => /section heading/.test(x)), `${c.doc.Title}: no heading without the code's forms`);
  }
  // an instrument stays an instrument, as before
  assert.equal(regulation.parse({ text: PA_BYLAW, view: PA }).form, "instrument");
  assert.equal(regulation.parse({ text: FW18.regulation.text.document, view: CODE_VIEW }).form, "instrument");
  // a heading needs its title, and its stop; a number alone, or a number in prose, is no heading
  for (const t of ["4-12\n(a)\nText.", "4-12 mooring fees are set by order.", "4-12 Mooring fees\n(a)\nText."])
    assert.equal(regulation.detect({ text: t, view: PA }).match, false, t);
  // one cited heading inside another document is not the code: it must open it, or recur
  const cited = "Minutes of the Harbor Commission\nThe Commission discussed:\n4-12 Mooring fees.\nNo action.";
  assert.equal(regulation.detect({ text: cited, view: PA }).match, false);
  assert.equal(regulation.detect({ text: PA_CODE, view: PA }).confidence, CONFIDENCE.CERTAIN);
  assert.equal(regulation.parse({ text: PA_CODE, view: PA }).form, "code");
  // under a profile naming another code's forms, Port Alder's code is not read
  /** @type {CodeSectionsByKey} */
  const lkForms = { lmc: { number: { re: "L\\d{2}\\.\\d{2}" }, separators: ".", markers: ["numeral"] } };
  assert.equal(regulation.detect({ text: PA_CODE, view: view(withCodeSections(LAKEMONT, lkForms)) }).match, false);
  assert.equal(regulation.detect({ text: "L09.01 Parking.\n1.\nNo parking.", view: view(withCodeSections(LAKEMONT, lkForms)) }).confidence, CONFIDENCE.CERTAIN);
  // neither: a stated null
  const none = regulation.parse({ text: "a letter", view: PA });
  assert.equal(none.form, null);
  assert.equal(none.form_why, localize("doctypes.regulation.no_form", "this text carries no enacting formula, no instrument caption under a body, and no section heading of a code the active jurisdiction profiles name, so it is read as neither an instrument nor a code section"));
});

/* --------------------------------------------------------------------- R10 */

test("R10 sections are one entry per section in document order, {path, number, heading, start, end, source}, nested extents", () => {
  for (const c of CORPUS) {
    const s = c.parsed.sections;
    assert.ok(s.length >= 1, c.doc.Title);
    let last = -1;
    for (const e of s) {
      assert.deepEqual(Object.keys(e).sort(), ["end", "heading", "number", "path", "source", "start"], c.doc.Title);
      assert.ok(Array.isArray(e.path) && e.path.length && e.path.every((p) => typeof p === "string" && p.length));
      assert.ok(e.start >= last, `${c.doc.Title}: in document order`);
      assert.ok(e.start < e.end && e.end <= c.text.length);
      last = e.start;
      assert.deepEqual(e.source, c.locate(e.start), "source is what locate says for the section's start");
      assert.equal(must(e.source, "source").kind, "doc-para");
    }
    // a subsection lies inside its parent, and its path extends the parent's
    for (const e of s) if (e.heading === null) {
      const parent = s.find((p) => p.path.length === e.path.length - 1 && p.path.every((x, i) => x === e.path[i]) && p.start <= e.start);
      assert.ok(parent, `${c.doc.Title}: ${e.path.join(".")} has its parent`);
      assert.ok(e.start >= parent.start && e.end <= parent.end, `${c.doc.Title}: ${e.path.join(".")} inside ${parent.path.join(".")}`);
    }
    // the top-level sections tile the text from the first heading to its end
    const t = top(c.parsed);
    for (let i = 1; i < t.length; i++) assert.equal(must(t[i - 1], "section").end, must(t[i], "section").start);
    assert.equal(must(t[t.length - 1], "section").end, c.text.length);
  }
  // the code's parts: title, chapter, section, then the markers
  const s030 = must(CORPUS.find((c) => /^2\.20\.030/.test(c.doc.Title)), "2.20.030").parsed.sections;
  assert.deepEqual(must(s030[0], "section").path, ["2", "20", "030"]);
  assert.ok(s030.some((x) => x.path.join(".") === "2.20.030.F.3.a"));
  // no locator: source is null, never composed
  for (const e of regulation.parse({ text: PA_CODE, view: PA }).sections) assert.equal(e.source, null);
});

/* --------------------------------------------------------------------- R11 */

test("R11 numbers, separators and marker order come from the view; SECTION n. is place-free; nothing divides to no sections, with why", () => {
  // the same code text under two marker orders reads two structures
  const p1 = regulation.parse({ text: PA_CODE, view: PA });
  assert.deepEqual(p1.sections.map((s) => s.path.join("/")), ["4/12", "4/12/a", "4/12/b", "4/12/b/i", "4/12/b/ii"]);
  /** @type {CodeSectionsByKey} */
  const oneLevel = { pac: { ...PA_SECTIONS.pac, markers: ["paren_letter"] } };
  const flatOrder = view(withCodeSections(PORT_ALDER, oneLevel));
  assert.deepEqual(regulation.parse({ text: PA_CODE, view: flatOrder }).sections.map((s) => s.path.join("/")), ["4/12", "4/12/a", "4/12/b"]);
  const noSep = view(withCodeSections(PORT_ALDER, { pac: { ...PA_SECTIONS.pac, separators: "" } }));
  assert.deepEqual(must(regulation.parse({ text: PA_CODE, view: noSep }).sections[0], "section").path, ["4-12"]);
  // the first profile's numbers are not Port Alder's
  assert.equal(regulation.parse({ text: textOf(must(CORPUS[0], "corpus").doc).document, view: PA }).sections.length, 0);
  // an instrument's own SECTION headings, in sequence from 1, under any view
  const inst = "HARBOR COMMISSION\nBYLAW NO. ____ T.B.S.\nNOW, THEREFORE, THE HARBOR COMMISSION DOES ORDAIN AS FOLLOWS:\n"
    + "SECTION 1. Fees. The fees are set.\nSECTION 4. Not next.\nSECTION 2. Effect. This bylaw takes effect at once.";
  for (const v of [PA, LK, view(withCodeSections(PORT_ALDER, { pac: null }))]) {
    const p = regulation.parse({ text: inst, view: v });
    assert.deepEqual(p.sections.map((s) => [s.number, s.heading]), [["1", "Fees"], ["2", "Effect"]]);
    assert.equal(must(p.sections[1], "section").end, inst.length);
  }
  // nothing divides: empty, with why, never one section standing for the whole
  /** @type {[string, View, RegExp | string][]} */
  const undivided = [["DOES ORDAIN that the harbor opens.", PA, /SECTION 1/],
                              [PA_CODE, LK, localize("doctypes.sections.neither_form_no_codes", "this text was read as neither an instrument nor a code section, so it is not divided into sections; and no active jurisdiction profile gives a section-number form for any code")],
                              ["a letter", PA, localize("doctypes.sections.neither_form", "this text was read as neither an instrument nor a code section, so it is not divided into sections")]];
  for (const [t, v, want] of undivided) {
    const p = regulation.parse({ text: t, view: v });
    assert.deepEqual(p.sections, []);
    if (want instanceof RegExp) assert.match(str(p.sections_why), want);
    else assert.equal(p.sections_why, want);
  }
});

/* --------------------------------------------------------------------- R12 */

test("R12 a per-section document gives its one section with exact boundaries; a charter article gives each of its sections", () => {
  let perSection = 0, article = 0;
  for (const c of CORPUS) {
    const t = top(c.parsed);
    const want = must(c.want, "answers").sections;
    assert.deepEqual(t.map((s) => [s.number, s.heading]), want.map((s) => [s.number, s.heading]), c.doc.Title);
    const paras = textOf(c.doc).paragraphs;
    /** @param {number} i @returns {number} */
    const offsetOf = (i) => paras.slice(0, i).reduce((n, p) => n + p.text.length + 1, 0);
    t.forEach((s, i) => {
      assert.equal(s.start, offsetOf(must(want[i], "section").para), `${c.doc.Title} ${s.number}: starts where the codifier's section starts`);
      assert.equal(s.end, i + 1 < want.length ? offsetOf(must(want[i + 1], "section").para) - 0 : c.text.length,
        `${c.doc.Title} ${s.number}: ends where the next starts, or at the document's end`);
    });
    if (/^ARTICLE/.test(c.doc.Title)) article += t.length;
    else { perSection++; assert.equal(t.length, 1); assert.equal(must(t[0], "section").start, 0); assert.equal(must(t[0], "section").end, c.text.length); }
  }
  assert.equal(perSection, 53);
  assert.equal(article, 30);
});

/* --------------------------------------------------------------------- R13 */

test("R13 definitions: each passage in the definitional voice, {term, start, end, source, section}, a term defined twice twice", () => {
  for (const c of CORPUS) {
    const got = c.parsed.definitions;
    assert.deepEqual(got.map((d) => { const sec = d.section; return { term: d.term, section: sec && sec.join(".") }; }), must(c.want, "answers").definitions, c.doc.Title);
    for (const d of got) {
      assert.ok(["end", "section", "source", "start", "term"].every((k) => k in d));
      assert.ok(c.text.slice(d.start, d.end).includes(d.term), `${d.term} is in its own passage`);
      assert.deepEqual(d.source, c.locate(d.start));
    }
  }
  const all = CORPUS.flatMap((c) => c.parsed.definitions.map((d) => d.term));
  assert.equal(all.filter((t) => t === "Covered Unit").length, 2, "defined twice, read twice");
  assert.ok(all.includes("Board") && all.includes("Residential Rent Adjustment Board"), "two terms of one passage");
  // the forms of the voice, under a profile that is not the first
  const t = "4-12 Mooring fees.\n(a)\nAs used in this chapter, \"float\" is a town dock.\n(b)\n\"Vessel\" includes a raft. "
    + "'Season' shall mean April to October.\n\"Season\" means the summer.";
  const p = regulation.parse({ text: t, view: PA });
  assert.deepEqual(p.definitions.map((d) => [d.term, pathOf(d, "/")]),
    [["float", "4/12/a"], ["Vessel", "4/12/b"], ["Season", "4/12/b"], ["Season", "4/12/b"]]);
  // a definition introducing a list runs over the list
  const e = must(CORPUS.find((c) => /^2\.20\.030/.test(c.doc.Title)), "2.20.030");
  const lb = must(e.parsed.definitions.find((d) => d.term === "Local body"), "Local body");
  assert.match(e.text.slice(lb.start, lb.end), /means:\n1\.\n[\s\S]*\n4\.\n/);
});

/* --------------------------------------------------------------------- R14 */

test("R14 exceptions: each passage that excepts, {start, end, source, section, cites}, cites read by the view's forms", () => {
  for (const c of CORPUS) {
    const got = c.parsed.exceptions;
    /** @param {{ readonly start: number, readonly end: number }} x @returns {string} */
    const opens = (x) => c.text.slice(x.start, x.end).split(/\s+/).slice(0, 6).join(" ");
    assert.deepEqual(got.map((x) => { const sec = x.section; return { opens: opens(x), section: sec && sec.join("."), cites: x.cites }; }), must(c.want, "answers").exceptions, c.doc.Title);
    for (const x of got) {
      assert.ok(["cites", "end", "section", "source", "start"].every((k) => k in x));
      assert.match(c.text.slice(x.start, x.end), /except\s+as|notwithstanding|not\s+apply/i);
      assert.deepEqual(x.source, c.locate(x.start));
    }
  }
  assert.equal(CORPUS.reduce((n, c) => n + c.parsed.exceptions.length, 0), 26);
  // the phrases, and cites in the view's own forms only
  const t = "4-12 Mooring fees.\n(a)\nExcept as provided in 4-14, fees apply. Notwithstanding 2.20.030, they are due.\n"
    + "(b)\nThis section does not apply to town vessels. The rules shall not apply in winter.";
  const p = regulation.parse({ text: t, view: PA });
  assert.deepEqual(p.exceptions.map((x) => [pathOf(x, "/"), x.cites]),
    [["4/12/a", ["4-14"]], ["4/12/a", []], ["4/12/b", []], ["4/12/b", []]]);
  assert.deepEqual(regulation.parse({ text: t, view: view(withCodeSections(PORT_ALDER, { pac: null })) }).exceptions.map((x) => x.cites), [[], [], [], []]);
});

/* --------------------------------------------------------------------- R15 */

test("R15 definitions and exceptions are readings, never law relations: nothing records defines or excepts", () => {
  for (const c of CORPUS) {
    const json = JSON.stringify(c.parsed);
    assert.ok(!/"(?:relation|connection)"\s*:\s*"(?:defines|excepts)"/.test(json), c.doc.Title);
    assert.ok(!c.parsed.entities.some((e) => /defin|except/i.test(e.kind)));
  }
  assert.equal(typeof regulation.connections, "undefined", "regulation emits no connections at all");
  for (const t of DOCTYPES) assert.ok(!/defines|excepts/.test(String(t.connections || "")), t.key);
});

/* --------------------------------------------------------------------- R16 */

test("R16 a section whose heading, text, definitions or exceptions moved, or present on one side, gives instrument_changed naming it", () => {
  const c = must(CORPUS.find((x) => /^2\.20\.030/.test(x.doc.Title)), "2.20.030");
  const a = c.parsed;
  /** @param {string} t @returns {RegulationReading} */
  const reread = (t) => regulation.parse({ text: t, view: CODE_VIEW });
  /* `assess` reads no context (its stated type takes two readings): the view the test once handed it is not handed. */
  /** @param {RegulationReading} b @returns {EventHead[]} */
  const evs = (b) => regulation.assess(a, b).events.filter((e) => keyOf(e) === "section");
  assert.deepEqual(evs(reread(c.text)), [], "the same text: nothing about sections");
  // a word of D's text changes
  const t1 = c.text.replace("\"City\" means the city of Oakland.", "\"City\" means the city and its port.");
  const e1 = evs(reread(t1));
  assert.deepEqual(e1.map((e) => [sectionOf(e, "."), movedOf(e)]), [["2.20.030", ["text"]], ["2.20.030.D", ["text"]]]);
  assert.equal(must(e1[0], "event").type, "instrument_changed");
  assert.equal(EVENTS.instrument_changed.significance, /** @copyof site-profiles:SIGNIFICANCE */ "event");
  /** Whether an event's moved list names `what`; a `TypeError` where it has none, as reading a missing list would have.
   *  @param {EventHead} e @param {string} what @returns {boolean} */
  const moved = (e, what) => {
    const m = movedOf(e);
    if (!isList(m)) throw new TypeError("an event with no moved list");
    return m.includes(what);
  };
  // a definition's term changes
  const e2 = evs(reread(c.text.replace("\"On-line\" means", "\"Online\" means")));
  assert.ok(e2.some((e) => sectionOf(e, ".") === "2.20.030.H" && moved(e, "definitions")));
  // an exception added
  const e3 = evs(reread(c.text.replace("\"City\" means the city of Oakland.", "\"City\" means the city of Oakland, except as provided in 2.20.180.")));
  assert.ok(e3.some((e) => sectionOf(e, ".") === "2.20.030.D" && moved(e, "exceptions")));
  // the heading changes
  const e4 = evs(reread(c.text.replace("2.20.030 - Definitions.", "2.20.030 - Terms.")));
  assert.ok(e4.some((e) => sectionOf(e, ".") === "2.20.030" && moved(e, "heading")));
  // a subsection gone, and one new: each named, which side
  const e5 = evs(reread(c.text.replace(/\nJ\.\n[^\n]*/, "")));
  assert.ok(e5.some((e) => sectionOf(e, ".") === "2.20.030.J" && nowOf(e) === null && /not read now/.test(String(whyOf(e)))));
  const e6 = regulation.assess(reread(c.text.replace(/\nJ\.\n[^\n]*/, "")), a).events.filter((e) => keyOf(e) === "section");
  assert.ok(e6.some((e) => sectionOf(e, ".") === "2.20.030.J" && wasOf(e) === null && whyOf(e) === localize("doctypes.regulation.section_added", "section {number} is read now and was not read before", { number: String(nowOf(e)) })));
  for (const e of [...e1, ...e2, ...e3, ...e4, ...e5, ...e6]) assert.equal(e.type, "instrument_changed");
  // no sections on either side: nothing about sections, and why
  const i = regulation.parse({ text: PA_BYLAW.replace("SECTION 1. ", ""), view: PA });
  assert.equal(i.instrument, "bylaw");
  const r = regulation.assess(i, structuredClone(i));
  assert.equal(r.sections_compared, false);
  assert.equal(r.sections_why, localize("doctypes.regulation.sections_none_read", "no section was read from either reading, so nothing is said about sections: {why}", { why: String(i.sections_why) }));
  assert.ok(!r.events.some((e) => keyOf(e) === "section"));
  // the article: one section of thirty changed, one event
  const art = must(CORPUS.find((x) => /ARTICLE II/.test(x.doc.Title)), "ARTICLE II");
  const changed = reread(art.text.replace("Section 209. Quorum.", "Section 209. A quorum."));
  const ae = regulation.assess(art.parsed, changed).events.filter((e) => keyOf(e) === "section");
  assert.deepEqual(ae.map((e) => sectionOf(e, ".")), ["209"]);
  assert.equal(regulation.assess(art.parsed, changed).meaningful, true);
});

/* --------------------------------------------------------------------- R17 */

test("R17 tested on the captured codifier sections and charter articles, with their provenance, every boundary exact", () => {
  assert.equal(CODIFIER.captures.length, 3);
  for (const cap of CODIFIER.captures) {
    assert.match(cap.source, /^https:\/\/api\.municode\.com\/CodesContent\?/, "source URL");
    assert.match(cap.sha256, /^[0-9a-f]{64}$/);
    assert.ok(cap.bytes > 0 && cap.status === 200 && !Number.isNaN(Date.parse(cap.fetched)));
  }
  const codeSections = CORPUS.filter((c) => !/^ARTICLE/.test(c.doc.Title)).length;
  const charterSections = CORPUS.filter((c) => /^ARTICLE/.test(c.doc.Title)).reduce((n, c) => n + top(c.parsed).length, 0);
  assert.ok(codeSections >= 50, `about 50 sections of one code (${codeSections})`);
  assert.ok(charterSections >= 10, `about 10 charter sections (${charterSections})`);
  // every section and subsection boundary, against the codifier's markup as a member reads it
  for (const c of CORPUS) {
    const t = top(c.parsed);
    const got = c.parsed.sections.filter((s) => s.heading === null).map((s) => {
      const h = must([...t].reverse().find((x) => x.start <= s.start), "heading above it");
      return `${h.number}|${s.path.slice(h.path.length).join(".")}`;
    });
    assert.deepEqual(got, must(c.want, "answers").subsections, c.doc.Title);
    for (const s of c.parsed.sections.filter((x) => x.heading === null)) {
      const line = c.text.slice(s.start, c.text.indexOf("\n", s.start) < 0 ? c.text.length : c.text.indexOf("\n", s.start));
      assert.match(line, /^\(?[A-Za-z0-9]{1,4}[.)]$/, `${c.doc.Title}: ${s.number} starts at its own marker`);
    }
  }
  // the two measured instruments
  const A = regulation.parse({ text: FW18.regulation.text.document, view: CODE_VIEW });
  assert.deepEqual(A.sections.map((s) => [s.number, s.heading]), [["1", "Amendment of Oakland Municipal Code"]]);
  assert.equal(must(A.sections[0], "section").start, FW18.regulation.text.document.indexOf("SECTION 1."));
  assert.equal(must(A.sections[0], "section").end, FW18.regulation.text.document.length);
  assert.deepEqual([A.definitions, A.exceptions], [[], []], "the proposed ordinance's text read here defines and excepts nothing");
  const B = regulation.parse({ text: FW18.staff_report.text.document, view: CODE_VIEW });
  assert.equal(B.form, "instrument");
  assert.deepEqual(B.sections, []);
  assert.match(str(B.sections_why), /SECTION 1/);
  assert.deepEqual([B.definitions, B.exceptions], [[], []]);
  // the test profile's code (jurisdictions R22, R57): it names section forms, and its code is read by them
  const tp = must(list().find((x) => x.test), "test profile");
  const combined = combine([tp.id]);
  /* A refused list has no view: reading its vocabulary throws, as it did. */
  if (!combined.ok) throw new TypeError(`the test profile ${tp.id} does not combine`);
  const tv = combined.view;
  const codes = ((tv.vocabulary || {}).codes || []).filter((x) => x.sections);
  assert.ok(codes.length >= 1, `the test profile ${tp.id} names a code with section forms (jurisdictions T33-2)`);
  /* A section of the test profile's code, written in its forms (`<n>-<n>` numbers, `(1)`,
     `(a)`, `(i)` subsections; jurisdictions T33-2), read by them and nothing else. */
  const ellery = ["12-3 Harbour dues.", "(1)", "\"Berth\" means a mooring at a public quay.", "(2)",
    "Dues are payable monthly, except as provided in 12-5.", "(a)", "A fishing vessel pays half.", "(i)",
    "This paragraph does not apply to a vessel over forty feet.", "12-4 Collection.", "The Harbourmaster collects dues."].join("\n");
  const pe = read(ellery, tv);
  assert.equal(pe.parsed.form, "code");
  assert.equal(pe.detect.confidence, CONFIDENCE.CERTAIN);
  assert.deepEqual(pe.parsed.sections.map((x) => x.path.join("-")), ["12-3", "12-3-1", "12-3-2", "12-3-2-a", "12-3-2-a-i", "12-4"]);
  assert.deepEqual(pe.parsed.sections.map((x) => [x.start, x.end]), [[0, ellery.indexOf("12-4")],
    [ellery.indexOf("(1)"), ellery.indexOf("(2)")], [ellery.indexOf("(2)"), ellery.indexOf("12-4")],
    [ellery.indexOf("(a)"), ellery.indexOf("12-4")], [ellery.indexOf("(i)"), ellery.indexOf("12-4")], [ellery.indexOf("12-4"), ellery.length]]);
  assert.deepEqual(pe.parsed.definitions.map((x) => [x.term, pathOf(x, "-")]), [["Berth", "12-3-1"]]);
  assert.deepEqual(pe.parsed.exceptions.map((x) => [pathOf(x, "-"), x.cites]), [["12-3-2", ["12-5"]], ["12-3-2-a-i", []]]);
});

/* --------------------------------------------------------------------- R19 */

test("R19 sections, definitions and exceptions each carry a stated count, and an unplaced passage is listed with section null and why", () => {
  for (const c of [...CORPUS.map((x) => x.parsed), regulation.parse({ text: PA_BYLAW, view: PA }), regulation.parse({ text: "x", view: PA })]) {
    assert.equal(c.counts.sections, c.sections.length);
    assert.equal(c.counts.definitions, c.definitions.length);
    assert.equal(c.counts.exceptions, c.exceptions.length);
    assert.equal(c.counts.definitions_unplaced, c.definitions.filter((d) => d.section === null).length);
    assert.equal(c.counts.exceptions_unplaced, c.exceptions.filter((d) => d.section === null).length);
  }
  // before the first heading: listed, section null, why
  const t = "\"Harbor\" means the town harbor. This chapter does not apply to rivers.\n" + PA_CODE + "\n4-14 Exemptions.\nNone.";
  const p = regulation.parse({ text: t, view: PA });
  assert.equal(p.form, "code");
  const d = must(p.definitions.find((x) => x.term === "Harbor"), "Harbor");
  assert.equal(d.section, null);
  assert.match(str(d.why), /before the first heading/);
  const e = must(p.exceptions.find((x) => x.start === 0 || t.slice(x.start).startsWith("This chapter")), "exception");
  assert.equal(e.section, null);
  assert.match(str(e.why), /before the first heading/);
  assert.equal(p.counts.definitions_unplaced, 1);
  assert.equal(p.counts.exceptions_unplaced, 1);
  // undivided text: every passage listed, none dropped, each saying why
  const u = regulation.parse({ text: "NOW, THEREFORE, THE HARBOR COMMISSION DOES ORDAIN: \"Dock\" means a float. Fees shall not apply to rafts.", view: PA });
  assert.deepEqual(u.sections, []);
  assert.equal(u.definitions.length, 1);
  assert.equal(u.exceptions.length, 1);
  for (const x of [...u.definitions, ...u.exceptions]) { assert.equal(x.section, null); assert.match(str(x.why), /not divided into sections/); }
});
