/* The codifier captures (fixtures/codifier.json) as the text a reader is given, and the
 * independent answers R17 checks a reading against.
 *
 * TEXT. Each served document is HTML. A text producer gives it as paragraphs: the document's
 * own title first, then one paragraph per HTML paragraph (or table row), tags removed,
 * entities decoded and white space collapsed; I2's `{document, paragraphs}` shape, so a
 * reading can place what it reads (`doc-para`).
 *
 * THE ANSWERS come from the codifier's own markup, never from the reader: a code section's
 * document is one section, its title the heading; a charter article's sections are its
 * paragraphs opening with a bold `Section <n>.`; a subsection is a marker paragraph whose class
 * is `incr<k>` (or `incr_ml<k>`), nested by its indentation `k`. */
import fs from "node:fs";

/**
 * One document as the codifier served it: its id, its title and its HTML.
 * @typedef {Object} ServedDocument
 * @property {string} Id
 * @property {string} Title
 * @property {string} Content
 */
/**
 * One captured response: the address it came from, when, its status, the sha256 and length of the bytes received, and
 * the documents kept from it.
 * @typedef {Object} CodifierCapture
 * @property {string} source
 * @property {string} fetched
 * @property {number} status
 * @property {string} sha256
 * @property {number} bytes
 * @property {ServedDocument[]} docs
 */
/**
 * The codifier captures (`fixtures/codifier.json`, written by `capture-codifier.mjs`).
 * @typedef {Object} CodifierCaptures
 * @property {string} note
 * @property {{ id: number, name: string, banner: string }} job
 * @property {CodifierCapture[]} captures
 */
/**
 * One paragraph of a served document: its text, and the HTML class it was served under ("title" for the title).
 * @typedef {Object} ServedParagraph
 * @property {string} text
 * @property {string} cls
 */
/**
 * The text a reader is given for one served document: I2's paragraph shape.
 * @typedef {Object} ParagraphText
 * @property {string} document
 * @property {{ para: number, text: string }[]} paragraphs
 */
/**
 * A top-level section as the markup gives it: its number, its heading, and the paragraph it opens at.
 * @typedef {Object} MarkupSection
 * @property {string} number
 * @property {string} heading
 * @property {number} para
 */
/**
 * A subsection marker as the markup gives it: its path within its section, its paragraph, and the marker as printed.
 * @typedef {Object} MarkupMarker
 * @property {string[]} path
 * @property {number} para
 * @property {string} printed
 */
/**
 * The answers from one document's markup: its top-level sections, its subsection markers and its paragraphs.
 * @typedef {Object} MarkupAnswers
 * @property {MarkupSection[]} sections
 * @property {MarkupMarker[]} markers
 * @property {ServedParagraph[]} paragraphs
 */
/**
 * A served document with the capture it came from.
 * @typedef {Object} ServedFrom
 * @property {CodifierCapture} capture
 * @property {ServedDocument} doc
 */

/**
 * A definition as a member reads it: the term, and the path of the section holding it joined with ".", or null.
 * @typedef {Object} DefinitionAnswer
 * @property {string} term
 * @property {string | null} section
 */
/**
 * An exception as a member reads it: its first six words, the path of the section holding it joined with ".", or null,
 * and the section numbers it cites.
 * @typedef {Object} ExceptionAnswer
 * @property {string} opens
 * @property {string | null} section
 * @property {string[]} cites
 */
/**
 * What a member reads in one codifier capture (`fixtures/codifier-answers.json`, written by `make-codifier-answers.mjs`).
 * @typedef {Object} DocumentAnswers
 * @property {string} title
 * @property {MarkupSection[]} sections
 * @property {string[]} subsections each `<section number>|<path within the section, joined with ".">`
 * @property {DefinitionAnswer[]} definitions
 * @property {ExceptionAnswer[]} exceptions
 */
/**
 * The member's answers to the codifier captures, by the served document's id.
 * @typedef {Object} CodifierAnswers
 * @property {string} note
 * @property {string[]} reviewed
 * @property {{ [id: string]: DocumentAnswers }} documents
 */

/** The codifier captures (this module's own fixture). */
export const CODIFIER = /** @type {CodifierCaptures} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/codifier.json", import.meta.url), "utf8")));

/** Group `i` of a match, which the pattern always fills; as text, as the old code's use of it converted it.
 *  @param {RegExpExecArray} m @param {number} i @returns {string} */
const group = (m, i) => String(m[i]);

/** @param {string} s @returns {string} */
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (/** @type {string} */ _, /** @type {string} */ n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (/** @type {string} */ _, /** @type {string} */ n) => String.fromCodePoint(parseInt(n, 16)));
/** @param {string} h @returns {string} */
const clean = (h) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** One served document's paragraphs, each with the HTML class it was served under.
 *  @param {ServedDocument} doc
 *  @returns {ServedParagraph[]} */
export function paragraphsOf(doc) {
  /** @type {ServedParagraph[]} */
  const out = [{ text: clean(doc.Title), cls: "title" }];
  const parts = String(doc.Content || "").split(/(?=<p\b|<tr\b)|<\/p>|<\/tr>/i);
  for (const part of parts) {
    const tag = /^<(?:p|tr)\b([^>]*)>/i.exec(part);
    const cls = tag ? /\bclass="([^"]*)"/.exec(group(tag, 1)) : null;
    const text = clean(part);
    if (text) out.push({ text, cls: cls ? group(cls, 1) : "" });
  }
  return out;
}

/** The text a reader is given for one served document: I2's paragraph shape.
 *  @param {ServedDocument} doc
 *  @returns {ParagraphText} */
export function textOf(doc) {
  const ps = paragraphsOf(doc);
  return { document: ps.map((p) => p.text).join("\n"),
           paragraphs: ps.map((p, i) => ({ para: i, text: p.text })) };
}

/** The answers from the markup: the top-level sections (number, title, the paragraph each
 *  opens at) and the subsection markers (each its path within its section), per document.
 *  @param {ServedDocument} doc
 *  @returns {MarkupAnswers}
 *  @throws {TypeError} where a code section's title is not `<number> - <heading>` */
export function answersOf(doc) {
  const ps = paragraphsOf(doc);
  /** @type {MarkupSection[]} */
  const sections = [];
  const article = /^ARTICLE /.test(doc.Title);
  if (!article) {
    const m = /^(\S+) - (.+?)\.?$/.exec(clean(doc.Title));
    if (!m) throw new TypeError(`${doc.Title}: not a code section's title`);
    sections.push({ number: group(m, 1), heading: group(m, 2), para: 0 });
  } else {
    const bold = [...String(doc.Content).matchAll(/<span class="bold">\s*Section (\d+)\.\s*([^<]*?)\.?\s*<\/span>/g)];
    let from = 0;
    for (const b of bold) {
      const i = ps.findIndex((p, k) => k > from && p.text.startsWith(`Section ${group(b, 1)}.`));
      sections.push({ number: group(b, 1), heading: clean(group(b, 2)).replace(/\.$/, ""), para: i });
      from = i;
    }
  }
  /* A subsection's path, as its indentation nests it: a marker is a child of the nearest
     marker above it indented less, within its own section. */
  const starts = sections.map((x) => x.para);
  /** @type {MarkupMarker[]} */
  const markers = [];
  /** @type {{ indent: number, value: string }[]} */
  let stack = [];
  /** The innermost open marker, which the caller has made sure is there. @returns {{ indent: number, value: string }} */
  const innermost = () => {
    const x = stack[stack.length - 1];
    if (x === undefined) throw new TypeError("no open marker");
    return x;
  };
  ps.forEach((p, i) => {
    if (starts.includes(i)) stack = [];
    const m = /\bincr(?:_ml)?(\d+)\b/.exec(p.cls);
    if (!m) return;
    const indent = Number(m[1]);
    while (stack.length && innermost().indent >= indent) stack.pop();
    const value = p.text.replace(/^\(?([A-Za-z0-9]+)[.)]$/, "$1");
    stack.push({ indent, value });
    markers.push({ path: stack.map((x) => x.value), para: i, printed: p.text });
  });
  return { sections, markers, paragraphs: ps };
}

/** Every served document, with where it came from.
 *  @returns {ServedFrom[]} */
export function servedDocuments() {
  /** @type {ServedFrom[]} */
  const out = [];
  for (const c of CODIFIER.captures) for (const d of c.docs) out.push({ capture: c, doc: d });
  return out;
}
