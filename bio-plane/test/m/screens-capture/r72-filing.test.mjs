/* screens-capture R72 (tranche t2; ARCH's decision "The layers: order and the refactoring plan", step 1): the Add screen names and
 * promotes a captured document with `capture`'s `titleOf` and `promoteDocument` (bio-plane/src/capture/filing.mjs, capture R115,
 * R116), handed to the screen's `parts` as before, and keeps no copy of either. What the screen names and promotes is unchanged:
 * R1, R21, R22, R28, R33 and R54 are checked here through `parts`, and through the parts' own text as the page carries them. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { titleOf, promoteDocument } from "../../../src/capture/filing.mjs";

const NOW = Date.parse("2026-11-25T10:20:30Z");
/* the page's kit as far as naming and promotion read it: a word is its key and its fills, a date is the instant as given */
const kit = (answers = {}) => {
  const calls = [];
  return {
    calls,
    now: () => NOW,
    w: (key, fills) => (fills ? `${key} ${JSON.stringify(fills)}` : key),
    date: (iso) => iso,
    digest: async (text) => createHash("sha256").update(String(text), "utf8").digest("hex"),
    call: async (op, req) => { calls.push({ op, req }); const a = answers[op]; return typeof a === "function" ? a(req) : a; },
  };
};
/* a part as the served page holds it (interface-shell R21): evaluated from its own text, with nothing else in scope */
const served = (fn) => new Function(`return (${String(fn)});`)();

test("R72: the screen's parts.titleOf and parts.promoteDocument are capture's functions; the screen's file holds no copy of either", () => {
  assert.equal(CAPTURE_SCREEN.parts.titleOf, titleOf);
  assert.equal(CAPTURE_SCREEN.parts.promoteDocument, promoteDocument);
  const source = readFileSync(new URL("../../../src/screens-intake/capture.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /function\s+titleOf\s*\(/);
  assert.doesNotMatch(source, /function\s+promoteDocument\s*\(/);
});

test("R72 (R33, R54): parts.titleOf names a document by its own title, else its file name, else its host and the day, else untitled; the same from the served text", () => {
  for (const name of [CAPTURE_SCREEN.parts.titleOf, served(CAPTURE_SCREEN.parts.titleOf)]) {
    const cs = kit();
    assert.equal(name(cs, { reading: { title: "  Housing   notice 2026-118 " }, doc: { title: "other" }, address: "https://city.example/n.pdf" }), "Housing notice 2026-118");
    assert.equal(name(cs, { reading: null, doc: { title: "From the document" }, address: "https://city.example/n.pdf" }), "From the document");
    assert.equal(name(cs, { reading: null, doc: {}, address: "", fileName: "minutes.docx" }), "minutes.docx");
    /* the file part of an address never names a document: a stated name equal to the last segment, with no content-disposition, is the address's */
    assert.equal(name(cs, { doc: { capture: { file_name: "n.pdf" } }, address: "https://city.example/n.pdf" }),
      'document.untitled.web {"site":"city.example","date":{"html":"2026-11-25T10:20:30Z"}}');
    assert.equal(name(cs, { doc: { capture: { file_name: "n.pdf", transport: { http_headers: [["Content-Disposition", "attachment"]] } } }, address: "https://city.example/n.pdf" }), "n.pdf");
    assert.equal(name(cs, { doc: {}, address: "" }), "screen.held.untitled");
    /* bound: at most 200 characters */
    assert.equal(name(cs, { reading: { title: "x".repeat(300) } }).length, 200);
  }
});

test("R72 (R1, R21, R22, R28): parts.promoteDocument promotes at `collected` under the minted id with a canonical slug, filed under the project; the same from the served text", async () => {
  for (const promote of [CAPTURE_SCREEN.parts.promoteDocument, served(CAPTURE_SCREEN.parts.promoteDocument)]) {
    const cs = kit({ allocid: { result: { id: "INFO-2026-0007" } }, promote: (req) => ({ result: { bundleId: req.body.bundleId, reading_pending: true } }) });
    const doc = { file: "snapshots/a.pdf", locator: "https://city.example/a.pdf", capture: { sha256: "a".repeat(64), bytes: 12, encoding: "binary" } };
    /* a 40-character cut that ends at a hyphen is trimmed (R28) */
    const title = "abcdefghij abcdefghij abcdefghij abcdef ghij";
    const made = await promote(cs, { doc, title, locator: doc.locator, project: "PROJ-7" });
    assert.deepEqual(made, { bundleId: "INFO-2026-0007-abcdefghij-abcdefghij-abcdefghij-abcdef", readingPending: true });
    assert.deepEqual(cs.calls.map((c) => c.op), ["allocid", "promote"]);
    assert.deepEqual(cs.calls[0].req, { query: { prefix: "INFO", year: "2026" } });
    const body = cs.calls[1].req.body;
    assert.equal(body.meta.current_state, "collected");
    const md = body.files.find((f) => f.path === "bundle.md").text;
    assert.match(md, /^schema: information@2$/m);
    assert.match(md, /^project: PROJ-7$/m);
    assert.deepEqual(body.files.map((f) => f.path), ["bundle.md", "data/provenance.json", "data/dataset.json", "snapshots/a.pdf"]);
    assert.deepEqual(body.register, [{ sha256: "a".repeat(64), path: "snapshots/a.pdf", encoding: "binary", bytes: 12 }]);
    /* control: no project, no project line */
    const plain = kit({ allocid: { result: { id: "INFO-2026-0008" } }, promote: { result: { bundleId: "INFO-2026-0008-x" } } });
    assert.deepEqual(await promote(plain, { doc, title: "x", locator: doc.locator }), { bundleId: "INFO-2026-0008-x", readingPending: false });
    assert.doesNotMatch(plain.calls[1].req.body.files[0].text, /^project:/m);
  }
});

test("R72 (R21): a refused mint or a refused promotion answers `refused` with the refusing answer, and a refused mint sends no promote", async () => {
  const promote = CAPTURE_SCREEN.parts.promoteDocument;
  const noMint = kit({ allocid: { result: { ok: false, code: "ID_SPACE_FULL" } } });
  assert.deepEqual(await promote(noMint, { doc: {}, title: "t" }), { refused: { ok: false, code: "ID_SPACE_FULL" } });
  assert.deepEqual(noMint.calls.map((c) => c.op), ["allocid"]);
  const silent = kit({ allocid: undefined });
  assert.deepEqual(await promote(silent, { doc: {}, title: "t" }), { refused: {} });
  const refused = kit({ allocid: { result: { id: "INFO-2026-0009" } }, promote: { result: { ok: false, code: "CAPTURE_HELD_BY_ANOTHER_BUNDLE", holder: "INFO-2026-0001" } } });
  assert.deepEqual(await promote(refused, { doc: { capture: { sha256: "b".repeat(64) } }, title: "t" }),
    { refused: { ok: false, code: "CAPTURE_HELD_BY_ANOTHER_BUNDLE", holder: "INFO-2026-0001" } });
});
