/* ooxml R35 (fix round 4b, F7; K4487): text over the 20 MiB guard is read in bounded pieces. `textPlan` says how a
 * declared size is read; `readPartPieces` inflates a member in windows and hands it over as text in pieces, with
 * readPart's refusals and its verification, made as the member ends. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  textPlan, readPartPieces, pieceWhy, readPart, readContainer, cutAfterTag, cutBefore, sizeGuard,
  MEASURED_OOXML_TEXT_BOUND_BYTES, STREAMED_TEXT_BOUND_BYTES, MEMBER_MAX, ARCHIVE_TOTAL_MAX,
} from "../../../src/ooxml.mjs";
import { buildZip } from "./zip.mjs";

const MIB = 1024 * 1024;
const BOUND = MEASURED_OOXML_TEXT_BOUND_BYTES;
const CEIL = STREAMED_TEXT_BOUND_BYTES;

/** @typedef {import("../../../src/ooxml.mjs").PiecesRead} PiecesRead */
/** @typedef {import("../../../src/ooxml.mjs").PartRefusal} PartRefusal */
/** @typedef {import("./zip.mjs").ZipMember} ZipMember */

/* node:zlib's raw deflate (no description here), kept to this one line. */
/** @param {string} s @returns {Uint8Array} */
const deflateRaw = (s) => deflateRawSync(Buffer.from(s));

/** A timer's wait of `ms` milliseconds. */
/** @param {number} ms @returns {Promise<void>} */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * All the pieces of member `name`, and the answer.
 * @param {Uint8Array} bytes
 * @param {string} name
 * @param {(buf: string) => number} [cut]
 * @returns {Promise<{ r: PiecesRead, got: string[] }>}
 */
async function pieces(bytes, name, cut = cutAfterTag) {
  const container = readContainer(bytes);
  assert.equal(container.ok, true);
  /** @type {string[]} */
  const got = [];
  const r = await readPartPieces(bytes, container, name, cut, (p) => got.push(p));
  return { r, got };
}

/** `n` characters of markup with a `>` every 40, and a few multi-byte characters. */
/** @param {number} n @returns {string} */
function markup(n) {
  const unit = "<a x=\"é€😀\">abcdefghijklmnopqrstu</a>"; // 31 chars, bytes differ (multi-byte)
  let s = "";
  while (s.length < n) s += unit;
  return s.slice(0, n);
}

test("R35 textPlan: whole at or under the 20 MiB bound, pieces over it up to the ceiling, none over that with the final marker", () => {
  assert.equal(BOUND, 20 * MIB);
  assert.equal(CEIL, 32 * MIB);
  assert.deepEqual(textPlan(0), { read: "whole" });
  assert.deepEqual(textPlan(BOUND), { read: "whole" });
  for (const size of [BOUND + 1, 30 * MIB, CEIL]) {
    assert.deepEqual(textPlan(size), { read: "pieces", piecewise: {
      declared: size, bound: BOUND, boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes",
    } });
  }
  const over = textPlan(CEIL + 1);
  assert.equal(over.read, "none");
  const guard = over.read === "none" ? over.guard : null;
  assert.deepEqual(guard, { ...sizeGuard(CEIL + 1, CEIL), boundName: "STREAMED_TEXT_BOUND_BYTES", final: true });
  assert.deepEqual(guard, { ok: false, text: "undetermined", why: "over_size_bound", size: CEIL + 1, bound: CEIL,
    boundName: "STREAMED_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes", final: true });
  const notNumber = textPlan(NaN);
  assert.equal(notNumber.read, "none");
  const notNumberGuard = notNumber.read === "none" ? notNumber.guard : null;
  assert.deepEqual(notNumberGuard, { ok: false, text: "undetermined", why: "over_size_bound", size: NaN, bound: CEIL,
    boundName: "STREAMED_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes", final: true });
});

test("R35 readPartPieces: a deflated member of 6 MiB comes back in pieces that join to what readPart gives, each cut where cut says", async () => {
  const text = markup(6 * MIB);
  const bytes = buildZip([{ name: "p.xml", data: text }]);
  const { r, got } = await pieces(bytes, "p.xml");
  assert.deepEqual(r, { ok: true, size: new TextEncoder().encode(text).length });
  assert.ok(got.length >= 3, `${got.length} pieces`);
  assert.equal(got.join(""), text);
  for (const p of got.slice(0, -1)) assert.ok(p.endsWith(">"), "a piece ends after a >");
  const whole = await readPart(bytes, readContainer(bytes), "p.xml");
  assert.ok(whole.ok);
  assert.equal(new TextDecoder().decode(whole.bytes), got.join(""));
});

test("R35 readPartPieces: a stored member, a BOM and characters split across windows read as UTF8.decode reads them", async () => {
  const text = "﻿" + markup(3 * MIB);
  for (const method of [0, 8]) {
    const bytes = buildZip([{ name: "p.xml", data: text, method }]);
    const { r, got } = await pieces(bytes, "p.xml");
    assert.equal(r.ok, true, `method ${method}`);
    assert.equal(got.join(""), text.slice(1), `method ${method}: the BOM is dropped as the one-shot decoder drops it`);
  }
});

test("R35 readPartPieces: the member is never held — a 60 MiB member comes in pieces of a few MiB at most", async () => {
  const text = markup(60 * MIB);
  const bytes = buildZip([{ name: "big.xml", data: text }]);
  assert.ok(bytes.length < 4 * MIB, `a highly compressible member: ${bytes.length} bytes`);
  const container = readContainer(bytes);
  let most = 0, total = 0, count = 0;
  const r = await readPartPieces(bytes, container, "big.xml", cutAfterTag, (p) => { most = Math.max(most, p.length); total += p.length; count++; });
  assert.equal(r.ok, true);
  assert.equal(total, text.length);
  assert.ok(most < 4 * MIB, `largest piece ${most}`);
  assert.ok(count > 30, `${count} pieces`);
});

test("R35 readPartPieces: cutBefore ends a piece before the last element start in the buffer", async () => {
  /** @type {(i: number) => string} */
  const row = (i) => `<row r="${i}"><c><v>${"9".repeat(60)}</v></c></row>`;
  let xml = "<s>";
  for (let i = 1; xml.length < 3 * MIB; i++) xml += row(i);
  xml += "</s>";
  const bytes = buildZip([{ name: "s.xml", data: xml }]);
  const { r, got } = await pieces(bytes, "s.xml", cutBefore(/<row\b/g));
  assert.equal(r.ok, true);
  assert.equal(got.join(""), xml);
  for (const p of got.slice(1)) assert.ok(p.startsWith("<row"), "a later piece starts at a row");
  for (const p of got.slice(0, -1)) assert.ok(!p.endsWith("<row"), "no piece ends inside the start of one");
});

test("R35 readPartPieces: the refusals are readPart's, each carrying the name; verification comes as the member ends", async () => {
  const text = markup(2 * MIB);
  /** @type {ZipMember} */
  const member = { name: "p.xml", data: text };
  const good = [member];
  /** @type {[string, Uint8Array][]} */
  const cases = [
    ["crc_mismatch", buildZip([{ ...member, cd: { crc: 0x12345678 } }])],
    ["size_mismatch", buildZip([{ ...member, cd: { usize: text.length - 1000 } }])],
    ["size_mismatch", buildZip([{ ...member, cd: { usize: text.length + 1000 } }])],
    ["member_truncated", buildZip([{ ...member, cd: { csize: 1e8 } }])],
    ["unsupported_compression_method", buildZip([{ ...member, cd: { method: 12 }, local: { method: 12 } }])],
    ["inflate_failed", buildZip([{ ...member, compressed: new Uint8Array(5000).fill(0xff) }])],
  ];
  for (const [why, bytes] of cases) {
    const { r } = await pieces(bytes, "p.xml");
    assert.equal(r.ok, false, why);
    assert.equal(r.why, why);
    assert.equal(r.name, "p.xml");
    const whole = await readPart(bytes, readContainer(bytes), "p.xml");
    assert.equal(whole.ok ? undefined : whole.why, why, `readPart refuses it the same way`);
  }
  const absent = await pieces(buildZip(good), "nope.xml");
  assert.deepEqual(absent.r, { ok: false, why: "part_absent", name: "nope.xml" });
  const bomb = await pieces(buildZip([{ ...member, cd: { usize: MEMBER_MAX + 1 } }]), "p.xml");
  assert.deepEqual(bomb.r, { ok: false, why: "MEMBER_MAX", name: "p.xml", declared: MEMBER_MAX + 1, limit: MEMBER_MAX, final: true });
  const total = await pieces(buildZip([member, { name: "other.xml", data: "x", cd: { usize: ARCHIVE_TOTAL_MAX } }]), "p.xml");
  const totalRead = total.r;
  assert.equal(totalRead.ok ? undefined : totalRead.why, "ARCHIVE_TOTAL_MAX");
});

test("R35 readPartPieces: a member of 9 MiB with no place to end a piece is stated with its size, final", async () => {
  const text = "<a>" + "x".repeat(9 * MIB) + "</a>";
  const bytes = buildZip([{ name: "p.xml", data: text }]);
  const { r } = await pieces(bytes, "p.xml", cutBefore(/<row\b/g));
  assert.deepEqual(r, { ok: false, why: "piece_unbounded", name: "p.xml", size: text.length, final: true });
});

test("R35 readPartPieces: a handler that throws is a stated refusal, not an exception", async () => {
  const bytes = buildZip([{ name: "p.xml", data: markup(3 * MIB) }]);
  const container = readContainer(bytes);
  const r = await readPartPieces(bytes, container, "p.xml", cutAfterTag, () => { throw new Error("no"); });
  assert.deepEqual(r, { ok: false, why: "reader_failed", name: "p.xml" });
  assert.deepEqual(await readPartPieces(bytes, container, "p.xml", cutAfterTag, () => {}), { ok: true, size: new TextEncoder().encode(markup(3 * MIB)).length });
});

test("R35 readPartPieces: bytes the caller passes as an ArrayBuffer or a view read the same", async () => {
  const text = markup(2 * MIB);
  const bytes = buildZip([{ name: "p.xml", data: text }]);
  const container = readContainer(bytes);
  /** @type {string[]} */
  const viaBuffer = [];
  const r = await readPartPieces(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), container, "p.xml", cutAfterTag, (p) => viaBuffer.push(p));
  assert.equal(r.ok, true);
  assert.equal(viaBuffer.join(""), text);
  const raw = deflateRaw(text);
  assert.ok(raw.length > 0);
});

test("R35 pieceWhy: a member with no place to end a piece is over_size_bound with its size and final; any other refusal as it is", () => {
  /** @type {PartRefusal} */
  const unbounded = { ok: false, why: "piece_unbounded", name: "p.xml", size: 99, final: true };
  assert.deepEqual(pieceWhy(unbounded),
    { why: "over_size_bound", detail: "piece_unbounded", size: 99, final: true });
  /** @type {PartRefusal} */
  const crc = { ok: false, why: "crc_mismatch", name: "p.xml" };
  assert.deepEqual(pieceWhy(crc), { why: "crc_mismatch" });
  assert.deepEqual(pieceWhy(undefined), { why: undefined });
});

test("R35 readPartPieces awaits the promise onPiece returns before it makes the next piece, so a reader can yield between pieces (K4858)", async () => {
  const bytes = buildZip([{ name: "p.xml", data: markup(5 * MIB) }]);
  const container = readContainer(bytes);
  /** @type {string[]} */
  const events = [];
  /** @param {string} piece @returns {Promise<number>} */
  const handler = async (piece) => {
    events.push("piece");
    await wait(3);
    events.push("yielded");
    return piece.length;
  };
  const r = await readPartPieces(bytes, container, "p.xml", cutAfterTag, handler);
  assert.equal(r.ok, true);
  assert.ok(events.filter(/** @returns {boolean} */ (e) => e === "piece").length >= 4, events.join());
  // never two pieces without the handler's own yield between them
  for (let i = 0; i < events.length; i += 2) assert.deepEqual(events.slice(i, i + 2), ["piece", "yielded"]);
  // a timer that fires while the handler waits runs between two pieces
  /** @type {string[]} */
  const order = [];
  const timer = setInterval(() => order.push("tick"), 1);
  await readPartPieces(bytes, container, "p.xml", cutAfterTag, async () => { order.push("piece"); await wait(5); });
  clearInterval(timer);
  const firstTwo = order.slice(order.indexOf("piece") + 1, order.indexOf("piece", order.indexOf("piece") + 1));
  assert.ok(firstTwo.includes("tick"), order.join());
  // a handler that returns nothing behaves as before, and a promise that rejects is reader_failed
  /** @type {string[]} */
  const plain = [];
  assert.equal((await readPartPieces(bytes, container, "p.xml", cutAfterTag, (p) => { plain.push(p); })).ok, true);
  assert.equal(plain.join("").length, 5 * MIB);
  const rejected = await readPartPieces(bytes, container, "p.xml", cutAfterTag, () => Promise.reject(new Error("no")));
  assert.deepEqual(rejected, { ok: false, why: "reader_failed", name: "p.xml" });
});
