/* text-chain: requirement-named tests for the coordinate space a rect is stated in (D-670, N98;
 * build/requirements/text-chain.md R87-R89). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECT_USER_SPACE, rectSpace, readingSource, readingSourceJson, readingOccurrenceKey, readingSourceFromColumns,
  readingPositionInExtent, extentCovers, gradeCeiling,
} from "../../../src/textchain.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";

const pdf = (x = {}) => ({ kind: "pdf-page", ref: "p. 1", page: 0, ...x });
const UNREADABLE = ["", "  ", 3, 0, false, true, {}, [], ["image-px"]];

test("R87: rectSpace reads absent/null as user space, a non-empty string as itself, anything else as unreadable", () => {
  assert.equal(RECT_USER_SPACE, "user");
  for (const h of [{}, { space: undefined }, { space: null }, pdf(), null, undefined, 5, "x"]) assert.equal(rectSpace(h), "user", JSON.stringify(h));
  for (const s of ["user", "image-px", "x"]) assert.equal(rectSpace({ space: s }), s);
  for (const s of UNREADABLE) assert.equal(rectSpace({ space: s }), null, JSON.stringify(s));
});

test("R87: readingSource carries a non-user space beside a valid rect, never beside a page alone, and 'user' is the unstated spelling", () => {
  const rect = [1, 2, 3, 4];
  assert.deepEqual(readingSource(pdf({ rect, space: "image-px" })), { kind: "pdf-page", ref: "p. 1", page: 0, rect, space: "image-px" });
  /* Key-ordered: space last, whatever the caller's order. */
  assert.deepEqual(Object.keys(readingSource({ space: "image-px", rect, ...pdf() })), ["kind", "ref", "page", "rect", "space"]);
  /* User space, stated or not, is the pre-D-670 shape byte for byte. */
  for (const x of [{}, { space: null }, { space: "user" }]) {
    assert.deepEqual(readingSource(pdf({ rect, ...x })), { kind: "pdf-page", ref: "p. 1", page: 0, rect });
    assert.equal(readingSourceJson(pdf({ rect, ...x })), '{"page":0,"rect":[1,2,3,4]}');
  }
  /* No rect, or a malformed one: no space either (a page index has none). */
  for (const r of [undefined, [1, 2, 3], [1, 2, 3, NaN]])
    assert.deepEqual(readingSource(pdf({ rect: r, space: "image-px" })), { kind: "pdf-page", ref: "p. 1", page: 0, rect: null });
  /* An unreadable space drops the rect: the page is still true, the rect cannot be placed. */
  for (const space of UNREADABLE)
    assert.deepEqual(readingSource(pdf({ rect, space })), { kind: "pdf-page", ref: "p. 1", page: 0, rect: null }, JSON.stringify(space));
  /* Truncated to 40 characters. */
  assert.equal(readingSource(pdf({ rect, space: "s".repeat(90) })).space, "s".repeat(40));
  /* Other arms carry no space. */
  assert.deepEqual(readingSource({ kind: "doc-para", ref: "¶", para: 1, space: "image-px" }), { kind: "doc-para", ref: "¶", para: 1, run: null });
});

test("R87: the space rides readingSourceJson, readingOccurrenceKey and readingSourceFromColumns", () => {
  const px = pdf({ rect: [1, 2, 3, 4], space: "image-px" });
  const user = pdf({ rect: [1, 2, 3, 4] });
  assert.equal(readingSourceJson(px), '{"page":0,"rect":[1,2,3,4],"space":"image-px"}');
  assert.equal(readingOccurrenceKey(px), 'pdf-page:{"page":0,"rect":[1,2,3,4],"space":"image-px"}');
  assert.notEqual(readingOccurrenceKey(px), readingOccurrenceKey(user), "two spaces are two places");
  assert.equal(readingOccurrenceKey(user), readingOccurrenceKey({ ...user, space: "user" }));
  for (const s of [px, user]) {
    const n = readingSource(s);
    assert.deepEqual(readingSourceFromColumns(n.kind, readingSourceJson(n), n.ref), n);
  }
});

test("R88: a region extent covers a target only when both rects are in the same readable space", () => {
  const region = (x = {}) => ({ kind: "region", source: { kind: "pdf-page", ref: "p", page: 0, rect: [0, 0, 1700, 2200], ...x } });
  const leg = (x = {}) => ({ page: 0, rect: [100, 150, 500, 190], ...x });
  const pairs = [
    [{}, {}, true], [{ space: "user" }, {}, true], [{}, { space: "user" }, true], [{ space: null }, { space: "user" }, true],
    [{ space: "image-px" }, { space: "image-px" }, true],
    [{ space: "image-px" }, {}, false], [{}, { space: "image-px" }, false], [{ space: "image-px" }, { space: "user" }, false],
    [{ space: "image-px" }, { space: "other-px" }, false],
  ];
  for (const [a, b, want] of pairs) assert.equal(extentCovers(region(a), leg(b)), want, JSON.stringify([a, b]));
  for (const s of UNREADABLE) {
    assert.equal(extentCovers(region({ space: s }), leg({ space: s })), false, JSON.stringify(s));
    assert.equal(extentCovers(region({ space: s }), leg()), false);
    assert.equal(extentCovers(region(), leg({ space: s })), false);
  }
  /* Page and document extents carry no rect and are unchanged by a target's space. */
  assert.equal(extentCovers({ kind: "page", page: 0 }, leg({ space: "image-px" })), true);
  assert.equal(extentCovers({ kind: "document" }, leg({ space: 3 })), true);
  /* gradeCeiling follows: an attestation over a pixel region grants nothing to a user-space leg. */
  const att = { member: "member:ruth", at: "2026-09-25", extent: region({ space: "image-px" }) };
  assert.equal(gradeCeiling([{ step: "layer" }], leg(), [att]).determinant, "derivation");
  assert.equal(gradeCeiling([{ step: "layer" }], leg({ space: "image-px" }), [att]).ceiling, EARNED_CAPTURE_CEILING);
});

test("R89: a pdf-page reading with a rect is inside a rect extent only in the same readable space", () => {
  const read = (x = {}) => pdf({ rect: [100, 150, 500, 190], ...x });
  const ext = (x = {}) => ({ page: 0, rect: [0, 0, 1700, 2200], ...x });
  const pairs = [
    [{}, {}, true], [{ space: "user" }, {}, true], [{}, { space: "user" }, true],
    [{ space: "image-px" }, { space: "image-px" }, true],
    [{ space: "image-px" }, {}, false], [{}, { space: "image-px" }, false], [{ space: "a" }, { space: "b" }, false],
  ];
  for (const [p, e, want] of pairs) assert.equal(readingPositionInExtent(read(p), "pdf-page", ext(e)), want, JSON.stringify([p, e]));
  for (const s of UNREADABLE) {
    assert.equal(readingPositionInExtent(read(), "pdf-page", ext({ space: s })), false, JSON.stringify(s));
    /* An unreadable space on the reading drops its rect, and a rectless reading is not inside a rect. */
    assert.equal(readingPositionInExtent(read({ space: s }), "pdf-page", ext({ space: s })), false);
  }
  /* A whole-page extent holds any reading on its page, whatever its rect's space; so does a document extent. */
  assert.equal(readingPositionInExtent(read({ space: "image-px" }), "pdf-page", { page: 0 }), true);
  assert.equal(readingPositionInExtent(read({ space: "image-px" }), "pdf-page", { page: 0, space: "image-px" }), true);
  assert.equal(readingPositionInExtent(read({ space: "image-px" }), "document", null), true);
});
