/* The words rule for this module's own sentences (setup-words R13, R14; K874): every sentence a member reads is
   read through `localize` under its id, and each id is named by a test that reaches the sentence. Each test
   compares with `localize` at the same id and English, so the list, once regenerated, answers the same text. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as dp from "../registry.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { PORT_ALDER, view, calendarHtml } from "./fixtures.mjs";

const { assess, readText, flattenText, doctypeFor, registerDoctype } = dp;

const enc = /** @param {string} s */ (s) => new TextEncoder().encode(s);
const sha256 = /** @param {Uint8Array} b */ async (b) => createHash("sha256").update(b).digest("hex");
const PA = view(PORT_ALDER);
const ROW = ["1", "Harbor Commission", "3/3/2026"];
const CAL = calendarHtml([ROW]);
/* `confirmation` is stated as `object | null`, so its `why` is read only where the object carries one. */
const whyOf = /** @param {object | null | undefined} o @returns {unknown} */ (o) => (o && "why" in o ? o.why : undefined);
const calCtx = { sha256, locator: "https://r.test/Calendar.aspx", now: "2026-03-20T12:00:00Z", view: PA };
const likelyStack = /** @param {string} s */ (s) => `<html><body><main><p>${s}</p><a href="/x">x</a></main></body></html>`;

test("words R12 the byte layers' verdict sentences are read by id: identical, unchanged, restyled", async () => {
  const same = await assess(enc("<p>one</p>"), enc("<p>one</p>"), { sha256 });
  assert.equal(same.verdict, "identical");
  assert.equal(whyOf(same.confirmation), localize("docprofile.pipeline.the_source_served_exactly_the", "the source served exactly the bytes the record holds"));
  assert.equal(same.why, localize("docprofile.pipeline.the_source_is_still_serving", "the source is still serving exactly what the record holds"));

  const mech = await assess(enc(calendarHtml([ROW], { state: "a" })), enc(calendarHtml([ROW], { state: "b" })), calCtx);
  assert.equal(mech.verdict, "unchanged");
  assert.equal(whyOf(mech.confirmation), localize("docprofile.pipeline.the_substance_is_the_same", "the substance is the same; only machinery this site rebuilds on every visit differs"));
  assert.equal(mech.why, localize("docprofile.pipeline.the_document_is_unchanged_only", "the document is unchanged; only machinery this site rebuilds differs"));

  const styled = await assess(enc(CAL.replace("site header", "new header")), enc(CAL), calCtx);
  assert.equal(styled.verdict, "restyled");
  assert.equal(whyOf(styled.confirmation), localize("docprofile.pipeline.the_document_itself_is_unchanged_surroundings", "the document itself is unchanged; the site around it changed"));
  assert.equal(styled.why, localize("docprofile.pipeline.the_document_itself_is_unchanged_navigation", "the document itself is unchanged; something around it moved, such as navigation"));
});

test("words R12 the undetermined sentence and its trail note are read by id", async () => {
  const u = await assess(enc(likelyStack("a")), enc(likelyStack("b")), { sha256, headers: { "x-powered-by": "ASP.NET" } });
  assert.equal(u.verdict, "undetermined");
  assert.equal(u.trail.at(-1)?.said, localize("docprofile.pipeline.cannot_say_the_stack_is_not", "cannot say: the stack is not recognised confidently enough"));
  assert.equal(u.why, localize("docprofile.pipeline.the_document_differs_and_this", "the document differs and this kind of document is not recognised well enough to say whether the difference matters"));
});

test("words R35 a comparison that could not run says so in the trail, by id", async () => {
  const nohash = await assess(enc("<p>a</p>"), enc("<p>b</p>"), {});
  assert.equal(nohash.verdict, "undetermined");
  assert.equal(nohash.trail.at(-1)?.said, localize("docprofile.pipeline.the_two_captures_could_not_be_compared", "the two captures could not be compared"));
  assert.equal(nohash.why, localize("docprofile.pipeline.the_two_captures_could_not", "the two captures could not be compared ({String}), so nothing is claimed",
    { String: localize("docprofile.pipeline.no_hash_function_was_given", "no hash function was given") }));
});

test("words R4 a document no registered type recognises is stated by id, read as the registered fallback", () => {
  assert.equal(registerDoctype({ key: "words_probe_fallback", label: "probe", version: 1, fallback: true,
    parse: () => ({}), detect: () => ({ match: false }) }).ok, true);
  const r = doctypeFor({ text: "a letter about nothing in particular" });
  assert.equal(r.type.key, "words_probe_fallback");
  assert.equal(r.why, localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described"));
});

test("words R21 R22 R23 a reading's position sentences are read by id, one per producer shape", () => {
  assert.equal(flattenText("a bare string").position_why,
    localize("docprofile.readtext.the_text_arrived_as_a", "the text arrived as a bare string, which carries no container structure, so where in the document a reference was read cannot be said"));
  const pages = [{ page: 1, text: "one" }];
  assert.equal(flattenText({ document: "other", pages }).position_why,
    localize("docprofile.readtext.this_producers_document_text_is_not_its_pages", "this producer's document text is not its pages joined, so the page a reference was read on cannot be established from it and is not guessed"));
  const paragraphs = [{ para: 1, text: "one" }];
  assert.equal(flattenText({ document: "other", paragraphs }).position_why,
    localize("docprofile.readtext.this_producers_document_text_is_not_its_paragraphs", "this producer's document text is not its paragraphs joined, so the paragraph a reference was read in cannot be established from it and is not guessed"));
  assert.equal(flattenText({ document: "one" }).position_why,
    localize("docprofile.readtext.this_producer_emitted_document_text", "this producer emitted document text with no itemised pages or paragraphs beside it, so where in the document a reference was read cannot be said"));
});

test("words R18 a reading refused for want of text says why by id", () => {
  const none = readText("", { view: PA });
  assert.equal(none.determined, false);
  assert.equal(none.why, localize("docprofile.readtext.no_text_was_supplied_so_no", "no text was supplied, so no reading was attempted"));
});

test("words R4 R35 a content-type decision that throws is stated by id, and the verdict is never guessed", async () => {
  // a registered type whose detect throws ends the content-type axis (doctypeFor does not catch it, pipeline does)
  assert.equal(registerDoctype({ key: "words_probe_throws", label: "probe", version: 1, parse: () => ({}),
    detect: () => { throw new Error("detect broke"); } }).ok, true);
  const c = await assess(enc("<p>one</p>"), enc("<p>two</p>"), { sha256 });
  assert.equal(c.meaningful, null);
  assert.equal(c.trail.at(-1)?.said, localize("docprofile.pipeline.no_content_type_could_be_decided", "no content type could be decided"));
  assert.equal(c.why, localize("docprofile.pipeline.the_substance_differs_and_which", "the substance differs, and which kind of document this is could not be decided ({String}), so what changed is not described", { String: "detect broke" }));
});
