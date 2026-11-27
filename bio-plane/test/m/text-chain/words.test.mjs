/* text-chain: the sentences people read are read through the word list (setup-words R11, R14), each by its id.
 * A test names an id and checks what the reader receives, never the sentence's own text (K3810). Requirement
 * ids: R41, R48–R51, R74, R92, R102 (build/requirements/text-chain.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkConfidence, checkAnchor, checkAttestation, mergeTier2Text, CONTENT_EXTENT_KINDS, TIER_RULE,
} from "../../../src/textchain.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/** @import { Refusal, TierMerge } from "../../../src/textchain.mjs" */

const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/;
/** @param {unknown} s @returns {boolean} */
const readable = (s) => typeof s === "string" && s.length > 0 && !PLACEHOLDER.test(s);
const ext = { kind: "document" };
/** A check's answer, which each test here expects to be a refusal. @param {Refusal | null} r @returns {Refusal} */
const refused = (r) => { assert.ok(r, "a refusal"); return r; };
/** A merge's answer, which each test here expects to be a refusal. @param {TierMerge} m @returns {string} its why */
const whyOf = (m) => { assert.ok(m.ok === false); return m.why; };

test("text-chain.textchain.a_region_confidence_is_either: R41 a region's confidence refusal reads as a sentence", () => {
  const r = refused(checkConfidence(undefined));
  assert.equal(r.code, "TEXT_CONFIDENCE_SHAPE");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.a_machine_reading_carries_its_anchor: R48 an absent anchor reads as a sentence", () => {
  const r = refused(checkAnchor(undefined));
  assert.equal(r.code, "TEXT_ANCHOR_MISSING");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.the_anchor_names_no_page: R48 an anchor with no page reads as a sentence", () => {
  const r = refused(checkAnchor({ kind: "pdf-page", page: -1, rect: [0, 0, 1, 1] }));
  assert.equal(r.code, "TEXT_ANCHOR_MISSING");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.the_anchor_names_no_rect: R48 an anchor with no rect reads as a sentence", () => {
  const r = refused(checkAnchor({ kind: "pdf-page", page: 0, rect: [0, 0] }));
  assert.equal(r.code, "TEXT_ANCHOR_MISSING");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.an_attestation_names_no_member: R49 an attestation with no member reads as a sentence", () => {
  const r = refused(checkAttestation({ member: "   ", at: "2026-09-01", extent: ext }));
  assert.equal(r.code, "TEXT_ATTEST_MACHINE");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.an_attestation_carries_the_date: R50 an attestation with no date reads as a sentence", () => {
  const r = refused(checkAttestation({ member: "alice", at: "", extent: ext }));
  assert.equal(r.code, "TEXT_ATTEST_EXTENT");
  assert.ok(readable(r.detail));
});

test("text-chain.textchain.a_page_extent_names_which_page: R51 a page extent with no page reads as a sentence", () => {
  const r = refused(checkAttestation({ member: "alice", at: "2026-09-01", extent: { kind: "page", page: -1 } }));
  assert.equal(r.code, "TEXT_ATTEST_EXTENT");
  assert.ok(readable(r.detail));
});

test("R92: the landed extent phrases are read through the word list's keys, the design's wording", () => {
  /** @type {readonly (readonly ["sheet-cell" | "slide-shape" | "doc-para" | "sheet-range" | "doc-table" | "image", string])[]} */
  const keys = [
    ["sheet-cell", "textchain.text.cell_spreadsheet"],
    ["slide-shape", "textchain.text.shape_deck"],
    ["doc-para", "textchain.text.paragraph_document"],
    ["sheet-range", "textchain.text.range_cells_spreadsheet"],
    ["doc-table", "textchain.text.table_document"],
    ["image", "textchain.text.image_document"],
  ];
  for (const [arm, key] of keys) assert.equal(CONTENT_EXTENT_KINDS[arm].human, word(key), arm);
});

test("R102: TIER_RULE is the word list's tier rule, read by its key", () => {
  assert.equal(TIER_RULE, word("textchain.tier_rule"));
});

test("text-chain.textchain.decoded_glyphs_held: R74 a tier-2 refusal names the glyphs held, through the word list's key", () => {
  const why = whyOf(mergeTier2Text({ document: "held" }, {}));
  assert.equal(why, word("textchain.why.document_tier_reading", { held: "4 decoded glyph(s)" }));
});

test("text-chain.textchain.reported_characters_no_text_read: R74 a counter claiming characters over unreadable text is named", () => {
  const why = whyOf(mergeTier2Text({ counts: { chars: 3 } }, {}));
  assert.ok(why.includes("3 character(s)") && readable(why));
});
