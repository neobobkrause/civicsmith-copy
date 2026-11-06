/* screens-inquiry fix round 9 (T51), the `document` screen: R130 (G135a, G135e: a kind with no reader is named by its kind and offered no read act; "Read it" only where a read
 * can succeed), R131 (G134d: each passage shows the kind of part it came from), R132 (G136e: the page says reading does not wait for the scan). On interface-shell's served page
 * over a scripted plane whose readings are copied from the shapes the real ops answer: reading-pipeline's `failed(...)` with `reason: UNSUPPORTED_FORMAT` and `kind` (its
 * R54), extraction's units with a `kind` (its R107). Every expectation is a word read by key (R44); the sentences are rows other modules own (`reading-pipeline.index.unsupported_*`,
 * `content.part_kind.*`, `file-safety.index.reading_is_not_gated`), held once setup-words' rows are regenerated: red by name `UNKNOWN_WORD` until then (K4640's pattern). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, boot } from "../interface-shell/harness.mjs";
import { main, actsIn, word, plane, READING, DOCUMENT_MD, SCREENS, D, SHA } from "./fixtures.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
async function openWith(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
/** the document's record with a given profile and file name in its register document */
const docWith = (reg = {}, sha = SHA) => ({ [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: sha, ...(reg.capture || {}) },
  ...Object.fromEntries(Object.entries(reg).filter(([k]) => k !== "capture")) }] }) } });
/* the reading the pipeline stores for a kind it has no reader for (`failed(doc, null, sentence, {failure: "final", reason: "UNSUPPORTED_FORMAT", kind})`), as `op=reading` answers it */
const FIXTURE_BASIS = "the fixture's own statement of the kind";
const unsupported = (kind, o = {}) => ok({ ok: true, found: true, capture_sha: SHA, bundle_id: D, content_type: null, reader_found: false, entity_count: 0, at: "2026-10-22T15:22:10Z",
  reading: { content_type: null, found: false, basis: FIXTURE_BASIS, failure: "final", reason: "UNSUPPORTED_FORMAT", kind, entities: [] }, text_units: [], bytes: 2048, format: "undetermined",
  completeness: { state: "stated", failure: "final", why: FIXTURE_BASIS }, ...o });
const KINDS = ["rtf", "email", "legacy_word", "legacy_excel", "legacy_powerpoint", "legacy_office", "tiff", "gif", "webp", "heic", "avif", "bmp", "jp2", "ico"];
/* other modules' rows, held in variables: the words check judges a literal key against `words.json` alone, and these are code-origin rows (setup-words regenerates them) */
const UNSUPPORTED = "reading-pipeline.index.unsupported_", PART_KIND = "content.part_kind.", SCAN_POLICY = "file-safety.index.reading_is_not_gated";
const READ_ACTS = ["readheld", "pdfstructure", "pagetranscribe", "transcribe"];

test("R130 G135a G135e SCAN A2-A9 DOCS R1-R3: a kind no reader opens is named by its kind's sentence, with no read act and no AI act, though the assistant is reachable", async () => {
  for (const kind of KINDS) {
    const p = await openWith(at, { images: docWith(), plane: { reading: unsupported(kind), ...REACH } });
    const m = main(p);
    const note = m.querySelector('[data-reading="unsupported"]');
    assert.ok(note, `${kind}: the statement is its own element`);
    assert.equal(note.getAttribute("data-unsupported-kind"), kind);
    /* screens-document-beta R61 (DEC-454, DEC-467): a kind the Document page holds its own row for (`screen.document.unsupported.<kind>`, `ico`) draws that row */
    const OWN = "screen.document.unsupported.";
    assert.equal(text(note).trim(), hasWord(OWN + kind) ? word(OWN + kind) : word(UNSUPPORTED + kind), `${kind}: the sentence of its kind`);
    const acts = actsIn(m);
    for (const a of READ_ACTS) assert.ok(!acts.includes(a), `${kind}: no ${a}: ${acts}`);
    assert.ok(!text(m).includes(FIXTURE_BASIS), `${kind}: the key's sentence, not the reading's own words`);
    assert.ok(!m.querySelector('.cs-state[data-state="empty"]'), `${kind}: never 'Nothing here'`);
  }
});

test("R130 G135e a kind the pipeline names that this page does not know is '(type) is not read yet' with the kind; a reading that names no kind draws the reading's own statement; no read act", async () => {
  const p = await openWith(at, { images: docWith(), plane: { reading: unsupported("xyzfile"), ...REACH } });
  assert.equal(text(main(p).querySelector('[data-reading="unsupported"]')).trim(), word(UNSUPPORTED + "kind", { kind: "xyzfile" }));
  assert.ok(!actsIn(main(p)).some((a) => READ_ACTS.includes(a)));
  const none = unsupported("rtf");
  delete none.json.result.reading.kind;
  const q = await openWith(at, { images: docWith(), plane: { reading: none, ...REACH } });
  assert.ok(text(main(q)).includes(FIXTURE_BASIS), "no kind named: the reading's own words stand");
  assert.ok(!actsIn(main(q)).some((a) => READ_ACTS.includes(a)));
});

test("R130 G135e X10 Ob9 a copy with no reading yet whose record states a kind with no reader (its type, its profiled format or its file's name) is named and offered no 'Read it'", async () => {
  const UNREAD = { reading: ok({ ok: true, found: false, capture_sha: SHA, reading: null }), ...REACH };
  const cases = [["a type", { profile: { source_content_type: "application/rtf" } }, "rtf"],
    ["a format", { profile: { format: { format: "tiff" } } }, "tiff"],
    ["a file name", { file: "scan.TIF" }, "tiff"],
    ["octet-stream and a file name", { profile: { source_content_type: "application/octet-stream" }, file: "letter.eml" }, "email"],
    ["a legacy Word type", { profile: { source_content_type: "application/msword" } }, "legacy_word"],
    ["a GIF type", { profile: { source_content_type: "image/gif; charset=binary" } }, "gif"]];
  for (const [name, reg, kind] of cases) {
    const p = await openWith(at, { images: docWith(reg), plane: UNREAD });
    const note = main(p).querySelector('[data-reading="unsupported"]');
    assert.ok(note, `${name}: named`);
    assert.equal(text(note).trim(), word(UNSUPPORTED + kind), name);
    assert.ok(!actsIn(main(p)).some((a) => READ_ACTS.includes(a)), `${name}: no read act: ${actsIn(main(p))}`);
    assert.equal(p.byOp("readheld").length, 0, `${name}: nothing sent`);
  }
});

test("R130 R129 controls: a PDF stored with no reading and a DOCX stored unread still offer 'Read it now' and, pressed, send readheld; a JPEG still offers the assistant's reading of its page", async () => {
  const UNREAD = { reading: ok({ ok: true, found: false, capture_sha: SHA, reading: null }) };
  for (const [name, reg] of [["a PDF", { profile: { format: { format: "pdf" }, source_content_type: "application/pdf" } }],
    ["a DOCX", { profile: { format: { format: "docx" }, source_content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, file: "memo.docx" }],
    ["a document with no type stated", {}]]) {
    const p = await openWith(at, { images: docWith(reg), plane: UNREAD });
    assert.ok(actsIn(main(p)).includes("readheld"), `${name}: Read it now is offered`);
    assert.equal(main(p).querySelector('[data-reading="unsupported"]'), null, `${name}: and no kind is named`);
  }
  const jpeg = docWith({ file: "photo.jpg", profile: { format: { format: "jpeg" }, source_content_type: "image/jpeg" } });
  const picture = READING({ reading: { content_type: "image/jpeg", found: true, text_chars: 0 }, text_units: [], unread_pages: [0] });
  const p = await openWith(at, { images: jpeg, plane: { reading: ok(picture), ...REACH } });
  assert.ok(actsIn(main(p)).includes("pagetranscribe"), "a JPEG whose text the reading could not make out: the assistant's reading of its page");
});

test("R130 G135a a repairable statement of a kind with no reader (an earlier release's 'not read as text' on a GIF) offers no 'Read it'; control: a repairable one on a PDF does", async () => {
  const old = (o = {}) => ok({ ok: true, found: true, capture_sha: SHA, bundle_id: D, reader_found: false, entity_count: 0, repairable: true,
    reading: { content_type: "generic", found: false, basis: FIXTURE_BASIS, failure: "final", entities: [] }, text_units: [], bytes: 4096, format: "undetermined", ...o });
  const gif = await openWith(at, { images: docWith({ profile: { source_content_type: "image/gif" } }), plane: { reading: old(), ...REACH } });
  assert.ok(!actsIn(main(gif)).includes("readheld"), "no Read it for a GIF");
  assert.equal(text(main(gif).querySelector('[data-reading="unsupported"]')).trim(), word(UNSUPPORTED + "gif"));
  const pdf = await openWith(at, { images: docWith({ profile: { format: { format: "pdf" }, source_content_type: "application/pdf" } }), plane: { reading: old() } });
  assert.ok(actsIn(main(pdf)).includes("readheld"), "control: a PDF's repairable statement offers it");
  assert.equal(main(pdf).querySelector('[data-reading="unsupported"]'), null);
});

/* ------------------------------------------------------------------------------------------------------------------ R131 */

const kinded = (units) => ok(READING({ unread_pages: [], text_units: units.map(([kind, textOf], i) => ({ seq: i + 1, extent: { kind: "paragraph", para: i }, reference: "u" + i, truncated: false,
  text: textOf, ...(kind === undefined ? {} : { kind }) })) }));

test("R131 G134d DOCS O4 P3 D1 H6 each passage shows the kind of part it came from, in the member's words by key: every kind of the closed list; a footnote's dollar figure carries 'footnote'", async () => {
  const LIST = ["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];
  const units = LIST.map((k) => [k, k === "footnote" ? "The repair cost $4,200 per crew." : `Words of the ${k} part.`]);
  const p = await openWith(at, { plane: { reading: kinded(units) } });
  const m = main(p);
  const tags = m.querySelectorAll("[data-part-kind]");
  const drawn = Object.fromEntries(tags.map((t) => [t.getAttribute("data-part-kind"), text(t).trim()]));
  assert.deepEqual(Object.keys(drawn).sort(), LIST.slice().sort(), "one tag for each kind of the list (units with no page, drawn in one block)");
  for (const k of LIST) assert.equal(drawn[k], word(PART_KIND + k), k);
  const foot = m.querySelectorAll("blockquote").find((b) => text(b).includes("$4,200"));
  assert.equal(text(foot.querySelector("[data-part-kind]")).trim(), word(PART_KIND + "footnote"), "the footnote's figure sits beside its kind");
});

test("R131 control: a unit stored without a kind (a reading made before the kind existed) draws none, and is never given body by guess; an unknown kind draws none", async () => {
  const p = await openWith(at, { plane: { reading: kinded([[undefined, "An old unit with no kind."], [null, "A unit whose producer named none."], ["haiku", "A kind outside the list."]]) } });
  const m = main(p);
  assert.equal(m.querySelectorAll("[data-part-kind]").length, 0, "no kind is drawn");
  assert.ok(text(m).includes("An old unit with no kind."), "and the words still are");
});

/* ------------------------------------------------------------------------------------------------------------------ R132 */

test("R132 G136e the Document page says plainly that reading does not wait for the scan; the copy is read and its page draws its text whatever a scan has found (SCAN E10: nothing here waits on the scan)", async () => {
  const p = await openWith(at, {});
  const m = main(p);
  const note = m.querySelector("[data-scan-policy]");
  assert.ok(note, "the sentence is drawn");
  assert.equal(text(note).trim(), word(SCAN_POLICY));
  assert.ok(text(m).includes("The Director shall repair each reported pothole"), "the copy is read and its passages drawn");
});

test("R132 controls: no sentence of the page states a scan result the page does not hold (no 'clean', no 'found', no 'has left search'); a testimony, which is no file, carries none", async () => {
  const p = await openWith(at, {});
  const said = text(main(p).querySelector("[data-scan-policy]"));
  assert.ok(!/\b(clean|infected|virus|malware|signature)/i.test(said.replace(word(SCAN_POLICY), "")), "the page adds nothing of its own about a scan");
  const TESTIMONY = DOCUMENT_MD.replace("locator: https://example.org/ai-4-12.pdf", "locator: \"a member's firsthand observation, authored in this record\"").replace("## Summary\n", "## Summary\n\nAuthored through op=testify.\n");
  const t = await openWith(at, { images: { [D]: { "bundle.md": TESTIMONY, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: SHA } }] }) } } });
  assert.equal(main(t).querySelector("[data-scan-policy]"), null, "a testimony has no file to scan");
});
