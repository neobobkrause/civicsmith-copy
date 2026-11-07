/* screens-inquiry fix round 6 (T51), G38 (the screen's half): extraction bounds an `op=reading` page by bytes as well as by units, so a long reading takes several
 * pages (`next`, then `after`). The Document screen's reads that use units (the words a question's leg cites, the passages a contradiction flag is set beside, whether
 * a newer copy has a text to move citations to) and the Question screen's (the words a leg cites) follow `next` to what each needs and never miss a unit past the first
 * page (R3, R96, R2, R34). On interface-shell's served page over a scripted plane that answers a reading in the shape the real op does (`text_units`, `next`,
 * `units_total`; the real plane's pages are read in `fr6-seam.test.mjs`); every expectation is a word read by key (R44). Controls: a one-page reading makes one read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, boot } from "../interface-shell/harness.mjs";
import { main, actsIn, fill, press, says, plane, storeWorld, provenanceOf, inquiryMd, INQUIRY_REFS, SCREENS, P, Q, D, SHA, NEWER } from "./fixtures.mjs";

process.env.TZ = "UTC";
const docAt = "/app/document/" + D;
const questionAt = "/app/question/" + Q;
const text = (el) => String(el && el.textContent || "");
async function openWith(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
async function choose(p, id, value) {
  const el = p.doc.getElementById(id);
  el.value = value;
  p.fire(el, "change");
  await p.settle();
}

/* a reading of three pages, two pdf pages of text on each, as `op=reading` answers it past its byte bound: the first page holds `next`, the last none */
const unit = (page, words) => ({ seq: page + 1, extent: { kind: "pdf-page", page }, reference: "u" + page, truncated: false, text: words });
const WORDS = (page) => `Words of page ${page + 1} of the long volume.`;
const CITED_WORDS = "The cited passage sits on the sixth page of the volume.";
const FLAG_WORDS = "The flagged passage sits on the fifth page of the volume.";
const pages = (sha, text = (p) => (p === 5 ? CITED_WORDS : p === 4 ? FLAG_WORDS : WORDS(p))) => {
  const all = [0, 1, 2, 3, 4, 5].map((n) => unit(n, text(n)));
  return [all.slice(0, 2), all.slice(2, 4), all.slice(4, 6)].map((units, i, a) => ({ ok: true, found: true, capture_sha: sha, bundle_id: D, content_type: "application/pdf", reader_found: true,
    reading: { content_type: "application/pdf", found: true, page_count: 6 }, text_units: units, unread_pages: [], units_total: 6, ...(i < a.length - 1 ? { next: "c" + (i + 1) } : {}) }));
};
/** The plane's `reading`: the page `after` names (none: the first) of the document `sha` is the reading of. */
const readingOf = (byCapture) => (r) => {
  const list = byCapture[r.query.sha256];
  if (!list) return ok({ ok: true, found: false });
  const i = r.query.after === undefined ? 0 : Number(String(r.query.after).slice(1));
  return ok(list[i]);
};
/* no reading shown, so a leg's words are the passage's own, read from the cited document's reading (the reading shown would state them itself) */
const noReadings = ok({ ok: true, inquiry: Q, versions: [] });
const readsOf = (p, sha) => p.byOp("reading").filter((r) => r.query.sha256 === sha);
/* the question rests on the document at page index 5 (drawn "Page 6") */
const legAt = (page) => [{ target: D, role: "supports", grade: "B", extent_kind: "pdf-page", extent_page: page }];
const withLeg = (page) => ({ images: { [Q]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs: legAt(page) }) } } });

test("R3 R96 G38 the words a question's leg cites on the third page of a long reading are drawn on the document page (its 'Your citations, leg by leg' row); control: a cited unit on the first page makes one read, and a unit the reading does not hold ends at the last page", async () => {
  const list = pages(SHA);
  const p = await openWith(docAt, { ...withLeg(5), plane: { reading: readingOf({ [SHA]: list }) } });
  const row = main(p).querySelector(`[data-leg-row="${Q}"]`);
  assert.ok(row && text(row).includes(CITED_WORDS), "the unit on page 3 is drawn as cited: " + text(row).slice(0, 300));
  assert.deepEqual(readsOf(p, SHA).map((r) => r.query.after), [undefined, "c1", "c2"], "the pages are read in order by the cursor, each once");
  /* control: the cited unit is on the first page: no further page is read */
  const first = await openWith(docAt, { ...withLeg(0), plane: { reading: readingOf({ [SHA]: list }) } });
  assert.ok(text(main(first).querySelector(`[data-leg-row="${Q}"]`)).includes(WORDS(0)));
  assert.equal(readsOf(first, SHA).length, 1, "a unit the first page holds makes one read");
  /* control: a unit the reading does not hold: every page is read, once, and no words are invented */
  const none = await openWith(docAt, { ...withLeg(40), plane: { reading: readingOf({ [SHA]: list }) } });
  assert.ok(!main(none).querySelector(`[data-leg-row="${Q}"] [data-leg-words]`), "no words for a passage the reading lacks");
  assert.equal(readsOf(none, SHA).length, 3, "the walk ends at the last page");
  /* control: a reading of one page makes one read */
  const one = await openWith(docAt, { ...withLeg(0), plane: { reading: readingOf({ [SHA]: [{ ...list[0], next: undefined }] }) } });
  assert.equal(readsOf(one, SHA).length, 1, "a one-page reading makes one read");
});

test("R2 R34 R96 G38 the words a leg cites on the third page of a long reading are drawn on the question page", async () => {
  const list = pages(SHA);
  const p = await openWith(questionAt, { images: { [Q]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs: legAt(5) }) } }, plane: { reading: readingOf({ [SHA]: list }), basisversions: noReadings } });
  const rows = main(p).querySelectorAll("[data-leg-words]");
  assert.ok(rows.some((r) => text(r).includes(CITED_WORDS)), "the unit on page 3 is drawn as the passage the leg cites");
  assert.deepEqual(readsOf(p, SHA).map((r) => r.query.after), [undefined, "c1", "c2"], "read to the page that holds it, each page once");
  const first = await openWith(questionAt, { images: { [Q]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs: legAt(1) }) } }, plane: { reading: readingOf({ [SHA]: list }), basisversions: noReadings } });
  assert.equal(readsOf(first, SHA).length, 1, "control: a unit on the first page makes one read");
});

/* a contradiction flag: a passage of this reading beside a passage of another document, each chosen among the passages the readings hold */
const OTHER = "INFO-2026-0011", OTHER_SHA = "5".repeat(64);
/** choose the other document in the shared picker (R137, now screens-document-beta R70) (one radio of the fold `kind`, not one of its page controls) */
async function pickDoc(p, kind, value) {
  /* R70, R71 (screens-document-beta): the shared picker is read once opened; a document of another project is offered once its control is pressed */
  const offeredNow = () => main(p).querySelectorAll(`[data-picker="${kind}"] input`).some((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value);
  for (const box of [`document-pick-open-${kind}-0`, `${kind}-wide-0`]) if (!offeredNow() && p.doc.getElementById(box)) await p.choose("#" + box);
  const picker = main(p).querySelector(`[data-picker="${kind}"]`);
  const r = picker && picker.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value && !i.closest("[data-pick-pages]"));
  assert.ok(r, `${value} is offered in the ${kind} picker`);
  r.checked = true; p.fire(r, "change"); await p.settle();
}
/** `heldcaptures` as the plane answers it: the picker's read (sorted by project, R137) the rows given, any other read the fixture's own answer */
const pickHeld = (base, rows) => (r) => (r.query.sort === "project" ? ok({ ok: true, held: rows, truncated: false, next: null }) : (typeof base.heldcaptures === "function" ? base.heldcaptures(r) : base.heldcaptures));
const OTHER_ROW = { bundle_id: OTHER, title: "Rent notice, October 2026", project: P, collected_since: "2026-10-02T09:00:00Z", capture: { sha256: OTHER_SHA }, actor: "member:dev", whole: true, standing: "collected" };
/* contradiction's own answer to a flag: a member's real flag, set over two pages held in a world, played back where the page sends hers (the passages it names are the world's, the page sends its own) */
const FLAG_ANSWER = await (async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const a = await world.recipes.page(ann, "Lease amendment, March 2024", { paragraphs: ["The rent adjustment takes effect on November 1, 2026."], project });
  const b = await world.recipes.page(ann, "Rent notice, September 2026", { paragraphs: ["The adjusted rent is due beginning December 1, 2026."], project });
  const unit = async (h) => (await ann.read("reading", { query: { sha256: h.sha } })).text_units[0].extent;
  return ann.act("contradictionflag", { body: { here: { capture: a.sha, extent: await unit(a) }, other: { capture: b.sha, extent: await unit(b) }, reason: "One says one thing, the other another." } });
})();
const FLAG_PLANE = (extra = {}) => {
  const base = plane();
  const own = pages(SHA), other = pages(OTHER_SHA, (n) => `Other document, page ${n + 1}.`);
  return { list: (r) => (r.query.type === "information" ? ok({ bundles: [{ bundle_id: D, object_type: "information", title: "This one" }, { bundle_id: OTHER, object_type: "information", title: "Rent notice, October 2026" }] }) : ok({ bundles: [] })),
    image: (r) => (r.query.id === OTHER ? ok({ "bundle.md": ["---", `id: ${OTHER}`, "object_type: information", "title: \"Rent notice, October 2026\"", "---", "", ""].join("\n"), "data/provenance.json": provenanceOf(OTHER_SHA) }) : base.image(r)),
    heldcaptures: pickHeld(base, [OTHER_ROW]), reading: readingOf({ [SHA]: own, [OTHER_SHA]: other }), contradictionflag: ok(FLAG_ANSWER), ...extra };
};
const optionsOf = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => ({ value: o.getAttribute("value"), text: o.textContent }));

test("R127 G38 a contradiction flag can be set on a passage of the third page of either reading: both pickers list every page's passages, and the act sends the extent the chosen one states", async () => {
  const p = await openWith(docAt, { plane: FLAG_PLANE() });
  await pickDoc(p, "flag", OTHER);
  const here = optionsOf(p, "document-flag-here"), there = optionsOf(p, "document-flag-there");
  assert.equal(here.length, 1 + 6, "this reading's six passages, from all three pages, after the empty choice");
  assert.ok(here.some((o) => o.text.includes(FLAG_WORDS.slice(0, 40))), "the passage on page 3 is offered: " + JSON.stringify(here.map((o) => o.text.slice(0, 30))));
  assert.equal(there.length, 1 + 6, "the other document's six passages");
  fill(p, { "document-flag-here": String(here.findIndex((o) => o.text.includes(FLAG_WORDS.slice(0, 40))) - 1), "document-flag-there": "5", "document-flag-why": "One says one thing, the other another." });
  await press(p, "contradictionflag");
  const sent = p.byOp("contradictionflag");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { here: { capture: SHA, extent: { kind: "pdf-page", page: 4 } }, other: { capture: OTHER_SHA, extent: { kind: "pdf-page", page: 5 } }, reason: "One says one thing, the other another." },
    "the extents of the passages chosen on page 3 of each reading");
  assert.deepEqual(readsOf(p, SHA).map((r) => r.query.after), [undefined, "c1", "c2"], "each page of this reading once");
  assert.deepEqual(readsOf(p, OTHER_SHA).map((r) => r.query.after), [undefined, "c1", "c2"], "and of the other");
  /* control: a one-page reading offers its passages and makes one read of each */
  const one = pages(SHA)[0], oneOther = pages(OTHER_SHA)[0];
  const q = await openWith(docAt, { plane: FLAG_PLANE({ reading: readingOf({ [SHA]: [{ ...one, next: undefined }], [OTHER_SHA]: [{ ...oneOther, next: undefined }] }) }) });
  await pickDoc(q, "flag", OTHER);
  assert.equal(optionsOf(q, "document-flag-here").length, 1 + 2);
  assert.equal(readsOf(q, SHA).length, 1, "a one-page reading makes one read");
  assert.equal(readsOf(q, OTHER_SHA).length, 1);
  /* control: no other document, no fold, and the pages are not read for it */
  const alone = await openWith(docAt, { plane: FLAG_PLANE({ heldcaptures: pickHeld(plane(), []) }) });
  /* R71 (screens-document-beta): the picker is read once opened; finding nothing to offer, the fold is withdrawn */
  await alone.choose("#document-pick-open-flag-0");
  assert.ok(!main(alone).querySelector('[data-fold="contradict"]'), "no fold");
  assert.equal(readsOf(alone, SHA).length, 1, "no fold is drawn, so no further page is read for it");
});

const NOTICE = (newer = NEWER) => (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ notice: "REN-1", id: "REN-1", holder: Q, target: D, state: "open", capture_sha: SHA, newer_capture: newer, affects: "unaffected" }] : [] });
const CHAIN = (shas) => ok({ ok: true, at_index: 0, versions: shas.map((s, i) => ({ capture_sha: s, first_retrieved: `2026-10-0${i + 2}T09:00:00Z` })) });
const legRow = (p) => main(p).querySelector(`[data-leg-row="${Q}"]`);

test("R124 R69 G38 a newer copy whose text begins on its second page still offers Move my citations (its first page holds no words); control: a copy with no words on any page offers none and says what is missing", async () => {
  const blankFirst = pages(NEWER, (n) => (n < 2 ? "   " : WORDS(n)));
  const p = await openWith(docAt, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA, NEWER]), reading: readingOf({ [SHA]: pages(SHA), [NEWER]: blankFirst }) } });
  assert.deepEqual(actsIn(legRow(p)).sort(), ["adoptversion", "keepversion"], "the words are on the second page: a chain");
  assert.deepEqual(readsOf(p, NEWER).map((r) => r.query.after), [undefined, "c1"], "read to the page that holds words, no further");
  const blankAll = pages(NEWER, () => "   ");
  const q = await openWith(docAt, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA, NEWER]), reading: readingOf({ [SHA]: pages(SHA), [NEWER]: blankAll }) } });
  assert.deepEqual(actsIn(legRow(q)), ["keepversion"], "no words on any page: no move");
  assert.ok(says(legRow(q), "refusal.CONTENT_EXTENT_NO_CHAIN"), "and it says what is missing");
  assert.equal(readsOf(q, NEWER).length, 3, "every page was read before it said so");
  const first = await openWith(docAt, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA, NEWER]), reading: readingOf({ [SHA]: pages(SHA), [NEWER]: pages(NEWER) }) } });
  assert.equal(readsOf(first, NEWER).length, 1, "control: words on the first page make one read");
});

test("R96 G13 G38 a page kept while the text was still being read is read again once the reading has grown: the words a leg cites, written after the first look, are drawn after the page clock's next read", async () => {
  let grown = false;
  const all = [0, 1, 2, 3, 4, 5].map((n) => unit(n, n === 5 ? CITED_WORDS : WORDS(n)));
  const reading = (r) => {
    const base = { ok: true, found: true, capture_sha: SHA, bundle_id: D, content_type: "application/pdf", reader_found: true, reading: { content_type: "application/pdf", found: true }, unread_pages: [], total: 100 };
    if (r.query.after === undefined) return ok({ ...base, text_units: all.slice(0, 2), next: "c1", units_total: grown ? 6 : 4, ...(grown ? {} : { more: true }), read_through: grown ? 100 : 50 });
    return ok({ ...base, text_units: grown ? all.slice(2, 6) : all.slice(2, 4), units_total: grown ? 6 : 4 });
  };
  const p = await openWith(docAt, { ...withLeg(5), plane: { reading } });
  assert.ok(!main(p).querySelector(`[data-leg-row="${Q}"] [data-leg-words]`), "the passage is not in the text read so far");
  grown = true;
  await p.clock.tick(10000);
  await p.settle();
  const row = main(p).querySelector(`[data-leg-row="${Q}"]`);
  assert.ok(text(row).includes(CITED_WORDS), "and is drawn once the text has grown: " + text(row).slice(0, 200));
  assert.equal(readsOf(p, SHA).filter((r) => r.query.after === "c1").length, 2, "the second page was read again, not taken from the short one");
});
