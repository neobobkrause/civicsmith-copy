/* odf-reader: the three entries' shared services — detect, parts, the
 * failure passthrough, the media-type constants — and the module-wide
 * invariants (build/requirements/odf-reader.md R1–R5, R31, R38–R41, R43). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../../../src/odf.mjs";
import { CONTAINER_FLAVOURS, sizeGuard } from "../../../src/ooxml.mjs";
import { docParaRef, docTableRef } from "../../../src/docx.mjs";
import { sheetCellRef, usedSheetRange } from "../../../src/formats-xlsx.mjs";
import { slideShapeRef } from "../../../src/pptx.mjs";
import { buildZip, members, pkg, withCd, TYPES, contentXml, enc, prng, sha256Hex, OVER_BOUND, metaXml } from "./pkg.mjs";

const { odtEntry, odsEntry, odpEntry, odfEvidentiaryDigest } = M;
const ENTRIES = { odt: odtEntry, ods: odsEntry, odp: odpEntry };
const FLAVOURS = ["odt", "ods", "odp"];
const ODD = [undefined, null, 0, -1, 1.5, NaN, "", "PK\x03\x04", {}, [], [1, 2, 300], Symbol("s"), () => 0, true, { length: 1e12 }];

/* ------------------------------------------------------------------ R1 */

test("R1 detect(bytes, null): certain for a conforming package of the entry's own flavour, null for every failed condition", () => {
  for (const f of FLAVOURS) {
    const bytes = pkg(f);
    for (const g of FLAVOURS) {
      const d = ENTRIES[g].detect(bytes, null);
      if (g === f) {
        assert.equal(d.format, f);
        assert.equal(d.confidence, "certain");
        assert.ok(Array.isArray(d.signals) && d.signals.length > 0);
      } else assert.equal(d, null, `${g} claimed a ${f} package`);
    }
    // any bytes form
    assert.equal(ENTRIES[f].detect(bytes.buffer.slice(0), null)?.confidence, "certain");
    // a content type passed beside the bytes changes nothing
    assert.equal(ENTRIES[f].detect(bytes, "text/plain")?.confidence, "certain");

    const e = ENTRIES[f];
    const cases = {
      "no ZIP magic": enc("not a zip at all, just text"),
      "no central directory (a 1 KiB head)": bytes.subarray(0, Math.min(bytes.length - 23, 1024)),
      "mimetype not first in the central directory": buildZip(members(f), { cdOrder: [1, 0, 2] }),
      "mimetype first in the directory but not first in the file": buildZip([members(f)[1], members(f)[0], members(f)[2]], { cdOrder: [1, 0, 2] }),
      "mimetype compressed": buildZip(members(f).map((m) => (m.name === "mimetype" ? { ...m, method: 8 } : m))),
      "mimetype with a trailing newline (never trimmed)": pkg(f, { mimetype: TYPES[f] + "\n" }),
      "mimetype with a leading space": pkg(f, { mimetype: " " + TYPES[f] }),
      "mimetype CRC-32 wrong in the directory": buildZip(withCd(members(f), "mimetype", { crc: 12345 })),
      "mimetype length wrong in the directory": buildZip(withCd(members(f), "mimetype", { usize: TYPES[f].length + 1 })),
      "mimetype over ODF_MIMETYPE_MAX_BYTES": pkg(f, { mimetype: TYPES[f] + " ".repeat(200) }),
      "main part absent": pkg(f, { content: false }),
      "no mimetype member": buildZip(members(f).slice(1)),
    };
    for (const [why, b] of Object.entries(cases)) assert.equal(e.detect(b, null), null, `${f}: ${why}`);
    // "likely" is never returned from bytes
    for (const b of Object.values(cases)) assert.notEqual(e.detect(b, TYPES[f])?.confidence, "likely");
  }
});

/* ------------------------------------------------------------------ R2 */

test("R2 detect(null, contentType): likely exactly when the content type is the entry's media type", () => {
  for (const f of FLAVOURS) {
    const d = ENTRIES[f].detect(null, TYPES[f]);
    assert.equal(d.format, f);
    assert.equal(d.confidence, "likely");
    assert.ok(Array.isArray(d.signals) && d.signals.length > 0);
    for (const ct of [null, undefined, "", TYPES[f].toUpperCase(), TYPES[f] + "; charset=binary", ` ${TYPES[f]}`,
      ...FLAVOURS.filter((g) => g !== f).map((g) => TYPES[g]), "application/zip"]) {
      assert.equal(ENTRIES[f].detect(null, ct), null, `${f}: ${JSON.stringify(ct)}`);
    }
  }
});

/* ------------------------------------------------------------------ R3 */

test("R3 parts(): success carries format, container, contentXml, the declared content.xml bytes, the guard and undetermined", async () => {
  for (const f of FLAVOURS) {
    const content = contentXml(f, "<text:p>x</text:p>");
    const p = await ENTRIES[f].parts(pkg(f, { content, meta: metaXml({ "dc:title": "t" }) }));
    assert.equal(p.ok, true);
    assert.equal(p.format, f);
    assert.ok(p.container && p.container.ok, "the container walk is carried");
    assert.equal(p.contentXml, content);
    assert.equal(p.declared.total, enc(content).length);
    assert.equal(p.guard, null);
    assert.deepEqual(p.undetermined, []);

    // over the guard: content.xml's DECLARED size, from the directory, before inflation
    const over = await ENTRIES[f].parts(buildZip(withCd(members(f), "content.xml", { usize: OVER_BOUND })));
    assert.equal(over.ok, true);
    assert.equal(over.contentXml, null);
    assert.equal(over.declared.total, OVER_BOUND);
    assert.deepEqual(over.guard, { ...sizeGuard(OVER_BOUND), final: true });
    assert.equal(over.undetermined.some((u) => u.part === "content.xml"), false, "the guard marker is the statement");

    // an unreadable content.xml: null, and named with its why
    const bad = await ENTRIES[f].parts(buildZip(withCd(members(f), "content.xml", { crc: 1 })));
    assert.equal(bad.ok, true);
    assert.equal(bad.contentXml, null);
    assert.deepEqual(bad.undetermined.filter((u) => u.part === "content.xml"), [{ part: "content.xml", why: "crc_mismatch" }]);
  }
});

test("R3 parts(): each failure is {ok:false, container, why, signals, part, flavourDeclared}", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const other = FLAVOURS.find((g) => g !== f);
    const expect = [
      [enc("plain text"), { why: "not_a_zip", part: null, flavourDeclared: null }],
      [enc("PK\x03\x04 truncated"), { why: "too_short_for_zip", part: null, flavourDeclared: null }],
      [pkg(other), { why: `not_${f}:${other}`, part: null, flavourDeclared: other }],
      [buildZip([{ name: "a.txt", data: "a" }]), { why: `not_${f}:zip`, part: null, flavourDeclared: null }],
      [pkg(f, { content: false }), { why: "declared_main_part_absent", part: "content.xml", flavourDeclared: f }],
      [pkg(f, { manifest: false }), { why: "odf_manifest_absent", part: null, flavourDeclared: f }],
      [pkg(f, { mimetype: TYPES[f] + "\n" }), { why: "odf_mimetype_unrecognized", part: null, flavourDeclared: null }],
      [buildZip(members(f), { cdOrder: [1, 0, 2] }), { why: "odf_mimetype_not_first", part: null, flavourDeclared: null }],
    ];
    for (const [bytes, want] of expect) {
      const p = await e.parts(bytes);
      assert.equal(p.ok, false, want.why);
      assert.equal(p.container, f);
      assert.equal(p.why, want.why);
      assert.equal(p.part, want.part, want.why);
      assert.equal(p.flavourDeclared, want.flavourDeclared, want.why);
      assert.ok(Array.isArray(p.signals), want.why);
    }
  }
});

/* ------------------------------------------------------------------ R4 */

test("R4 detect and parts never throw, on any bytes", async () => {
  const rnd = prng(4);
  const base = pkg("odt", { body: "<text:p>hello</text:p>", meta: metaXml({ "dc:title": "t" }) });
  const inputs = [...ODD];
  for (let n = 0; n <= base.length; n += 3) inputs.push(base.subarray(0, n));
  for (let k = 0; k < 300; k++) {
    const b = base.slice();
    for (let j = 0; j < 1 + Math.floor(rnd() * 8); j++) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
    inputs.push(b);
  }
  for (let k = 0; k < 50; k++) inputs.push(Uint8Array.from({ length: Math.floor(rnd() * 400) }, () => Math.floor(rnd() * 256)));
  for (const e of Object.values(ENTRIES)) {
    for (const x of inputs) {
      assert.doesNotThrow(() => e.detect(x, null));
      assert.doesNotThrow(() => e.detect(null, x));
      const p = await e.parts(x);
      assert.equal(typeof p.ok, "boolean");
      if (!p.ok) assert.equal(typeof p.why, "string");
    }
  }
});

/* ------------------------------------------------------------------ R5 */

test("R5 a failed parts() makes structure() and text() return {ok:false, container, reason, part} for every entry", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const other = FLAVOURS.find((g) => g !== f);
    for (const bytes of [enc("x"), pkg(other), pkg(f, { content: false }), pkg(f, { manifest: false })]) {
      const p = await e.parts(bytes);
      assert.equal(p.ok, false);
      const want = { ok: false, container: f, reason: p.why, part: p.part ?? null };
      assert.deepEqual(await e.structure(bytes), want);
      assert.deepEqual(await e.text(bytes), want);
      assert.deepEqual(await e.structure(p), want, "parts() output passed back");
      assert.deepEqual(await e.text(p), want, "parts() output passed back");
    }
  }
});

/* ------------------------------------------------------------------ R31 */

test("R31 the three media types and ODF_FORMATS are the partMap:\"odf\" rows' own values", () => {
  const rows = CONTAINER_FLAVOURS.filter((r) => r.partMap === "odf");
  assert.deepEqual(rows.map((r) => r.flavour), ["odt", "ods", "odp"]);
  assert.equal(M.ODT_CONTENT_TYPE, rows[0].mimetype);
  assert.equal(M.ODS_CONTENT_TYPE, rows[1].mimetype);
  assert.equal(M.ODP_CONTENT_TYPE, rows[2].mimetype);
  assert.equal(M.ODT_CONTENT_TYPE, "application/vnd.oasis.opendocument.text");
  assert.equal(M.ODS_CONTENT_TYPE, "application/vnd.oasis.opendocument.spreadsheet");
  assert.equal(M.ODP_CONTENT_TYPE, "application/vnd.oasis.opendocument.presentation");
  assert.deepEqual([...M.ODF_FORMATS], ["odt", "ods", "odp"]);
  assert.ok(Object.isFrozen(M.ODF_FORMATS));
  assert.deepEqual([odtEntry.format, odsEntry.format, odpEntry.format], ["odt", "ods", "odp"]);
  for (const [e, ct] of [[odtEntry, M.ODT_CONTENT_TYPE], [odsEntry, M.ODS_CONTENT_TYPE], [odpEntry, M.ODP_CONTENT_TYPE]]) {
    assert.equal(e.detect(null, ct).confidence, "likely");
  }
});

/* ------------------------------------------------------------------ R38 */

test("R38 no service throws on malformed, truncated or hostile bytes; every failure names why", async () => {
  const rnd = prng(38);
  const hostile = [
    "<text:p>&#99999999; &#xFFFFFFFF; &bogus;</text:p>",
    "<text:p>" + "<text:span>".repeat(2000) + "deep</text:p>",
    "</text:p></text:p><text:p><office:annotation><text:p>unclosed",
    "<text:tracked-changes><text:changed-region text:id='c'><text:insertion/></text:changed-region></text:tracked-changes><text:p><text:change-end text:change-id='c'/><text:change-start text:change-id='c'/></text:p>",
    "<table:table><table:table-row table:number-rows-repeated='-5'><table:table-cell table:number-columns-repeated='abc' office:value-type='string'><text:p>x</text:p></table:table-cell></table:table-row></table:table>",
    "<draw:page><draw:g><draw:g></draw:page></draw:g>",
  ];
  const inputs = [...ODD];
  for (const f of FLAVOURS) {
    for (const h of hostile) {
      inputs.push(pkg(f, { body: h, meta: "<not xml", manifestEntries: ["Object 1/content.xml", "missing.bin", { path: "enc.bin", encrypted: true }] }));
      inputs.push(pkg(f, { content: h }));
    }
    const base = pkg(f, { body: hostile[0], meta: metaXml({ "dc:title": "t" }) });
    for (let k = 0; k < 150; k++) {
      const b = base.slice();
      for (let j = 0; j < 1 + Math.floor(rnd() * 6); j++) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
      inputs.push(b);
    }
    for (let n = 0; n <= base.length; n += 11) inputs.push(base.subarray(0, n));
  }
  for (const x of inputs) {
    for (const e of Object.values(ENTRIES)) {
      const s = await e.structure(x);
      const t = await e.text(x);
      for (const r of [s, t]) {
        assert.equal(typeof r?.ok, "boolean");
        if (!r.ok) assert.equal(typeof r.reason, "string");
      }
    }
    const d = await odfEvidentiaryDigest(x, sha256Hex);
    assert.equal(typeof d.determined, "boolean");
    if (!d.determined) assert.equal(typeof d.basis, "string");
  }
  // structure()/text() given something that is neither bytes nor parts()
  for (const e of Object.values(ENTRIES)) {
    for (const x of ODD) {
      const s = await e.structure(x);
      const t = await e.text(x);
      assert.equal(s.ok, false);
      assert.equal(t.ok, false);
      assert.equal(typeof s.reason, "string");
      assert.equal(typeof t.reason, "string");
    }
  }
  // a hasher that throws is still a stated refusal
  const d = await odfEvidentiaryDigest(pkg("ods"), () => { throw new Error("no hasher"); });
  assert.equal(d.determined, false);
  assert.equal(typeof d.basis, "string");
});

/* ------------------------------------------------------------------ R39 */

test("R39 pure: no network, no clock, no randomness; the same bytes give the same answer", async () => {
  const saved = { fetch: globalThis.fetch, now: Date.now, random: Math.random };
  const calls = [];
  globalThis.fetch = (...a) => { calls.push(["fetch", a]); throw new Error("network"); };
  Date.now = () => { calls.push(["Date.now"]); return 0; };
  Math.random = () => { calls.push(["Math.random"]); return 0.5; };
  try {
    for (const f of FLAVOURS) {
      const bytes = pkg(f, {
        body: f === "odt" ? "<text:p>a <text:a xlink:href='https://e.org'>l</text:a></text:p>"
          : f === "ods" ? "<table:table table:name='S'><table:table-row><table:table-cell office:value-type='float' office:value='1' table:formula='of:=1'><text:p>1</text:p></table:table-cell></table:table-row></table:table>"
            : "<draw:page><draw:frame><draw:text-box><text:p>s</text:p></draw:text-box></draw:frame></draw:page>",
        meta: metaXml({ "meta:initial-creator": "A" }),
        manifestEntries: ["Object 1/content.xml", "Pictures/p.png"],
        extra: [{ name: "Object 1/content.xml", data: "<x/>" }, { name: "Pictures/p.png", data: "PNG" }],
      });
      const run = async () => ({
        d: ENTRIES[f].detect(bytes, null), p: await ENTRIES[f].parts(bytes),
        s: await ENTRIES[f].structure(bytes), t: await ENTRIES[f].text(bytes),
        g: await odfEvidentiaryDigest(bytes, sha256Hex),
      });
      const a = await run();
      const b = await run();
      delete a.p.bytes; delete b.p.bytes;
      assert.deepEqual(a, b);
    }
  } finally {
    globalThis.fetch = saved.fetch; Date.now = saved.now; Math.random = saved.random;
  }
  assert.deepEqual(calls, []);
});

/* ------------------------------------------------------------------ R40 */

test("R40 no jurisdiction: nothing the module exports or emits names a place, system or local vocabulary", async () => {
  const strings = [];
  const walk = (v, seen = new Set()) => {
    if (typeof v === "string") strings.push(v);
    else if (v && typeof v === "object" && !seen.has(v) && !(v instanceof Uint8Array)) {
      seen.add(v);
      for (const x of Object.values(v)) walk(x, seen);
    }
  };
  walk({ ...M });
  for (const f of FLAVOURS) {
    for (const bytes of [pkg(f), pkg(f, { content: false }), pkg(f, { meta: metaXml({}) }),
      buildZip(withCd(members(f), "content.xml", { usize: OVER_BOUND }))]) {
      const p = await ENTRIES[f].parts(bytes);
      walk({ d: ENTRIES[f].detect(bytes, null), p: { ...p, container: null, bytes: null },
        s: await ENTRIES[f].structure(bytes), t: await ENTRIES[f].text(bytes),
        g: await odfEvidentiaryDigest(bytes, sha256Hex) });
    }
  }
  const places = /oakland|alameda|california|berkeley|san francisco|county|city of|municipal|legistar|granicus/i;
  for (const s of strings) assert.doesNotMatch(s, places, s);
});

/* ------------------------------------------------------------------ R41 */

test("R41 every \"not read\" is stated with the part and why, R45's over_repeat_bound included; no absence reads as a zero, an empty list or silence", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const unit = { odt: "paragraphs", ods: "sheets", odp: "slides" }[f];
    // over the guard
    const over = buildZip(withCd(members(f), "content.xml", { usize: OVER_BOUND }));
    const so = await e.structure(over);
    const to = await e.text(over);
    assert.deepEqual(so.evidentiary.undetermined.find((u) => u.part === "content.xml"),
      { part: "content.xml", why: "over_size_bound", guard: { ...sizeGuard(OVER_BOUND), final: true } });
    assert.ok(so.notes.some((n) => /size bound/.test(n)));
    assert.equal(to.document, null);
    assert.deepEqual(to.undetermined, [{ ...sizeGuard(OVER_BOUND), final: true }]);
    if (f !== "ods") assert.equal(so[unit], null, "a count never read is null, never 0");
    // unreadable content.xml
    const bad = buildZip(withCd(members(f), "content.xml", { crc: 1 }));
    const sb = await e.structure(bad);
    const tb = await e.text(bad);
    assert.deepEqual(sb.evidentiary.undetermined.find((u) => u.part === "content.xml"), { part: "content.xml", why: "crc_mismatch" });
    assert.ok(sb.notes.some((n) => /unreadable/.test(n)));
    assert.equal(tb.document, null);
    assert.deepEqual(tb.undetermined, f === "ods"
      ? [{ sheet: null, cell: null, reason: "crc_mismatch" }]
      : [{ reason: "main_part_unreadable", part: "content.xml", why: "crc_mismatch" }]);
    if (f === "odt") assert.equal(tb.tables, null);
    if (f === "odp") assert.equal(tb.deckLength, null);
    // repeats past ODF_REPEAT_EXPANSION_MAX (R45): the same shapes, with the repeat marker in the guard's place
    const huge = `<text:p>x<office:annotation><text:p><text:s text:c="2000000000"/></text:p></office:annotation></text:p>`;
    const repeatBody = {
      odt: huge + `<text:p><text:s text:c="2000000000"/></text:p>`,   // structure() reads the comment, text() the paragraph
      ods: `<table:table table:name="S"><table:table-row><table:table-cell office:value-type="string" table:number-columns-repeated="262145"><text:p>v</text:p></table:table-cell></table:table-row></table:table>`,
      odp: `<draw:page><presentation:notes><draw:frame><draw:text-box>${huge}</draw:text-box></draw:frame></presentation:notes></draw:page>`,
    }[f];
    const marker = { text: "undetermined", why: "over_repeat_bound", units: 262145, bound: 262144,
      boundName: "ODF_REPEAT_EXPANSION_MAX", metric: "expanded_repeat_units", final: true };
    const sr = await e.structure(pkg(f, { body: repeatBody }));
    const tr = await e.text(pkg(f, { body: repeatBody }));
    assert.deepEqual(sr.evidentiary.undetermined.find((u) => u.part === "content.xml"),
      { part: "content.xml", why: "over_repeat_bound", guard: marker });
    assert.ok(sr.notes.some((n) => /ODF_REPEAT_EXPANSION_MAX/.test(n)));
    if (f !== "ods") assert.equal(sr[unit], null, "a count never read is null, never 0");
    assert.equal(tr.document, null);
    assert.deepEqual(tr.undetermined, [marker]);
    if (f === "odt") assert.equal(tr.tables, null);
    if (f === "ods") assert.deepEqual([tr.rangeUnits, tr.rangeUnitsSkipped], [null, null]);
    if (f === "odp") assert.equal(tr.deckLength, null);
    // meta.xml absent is said; an empty intra partition is always explained
    const plain = await e.structure(pkg(f));
    assert.ok(plain.evidentiary.undetermined.some((u) => u.part === "meta.xml" && u.why === "part_absent"));
    assert.equal(plain.counts.intra, 0);
    assert.ok(plain.notes.some((n) => /no intra link/.test(n)));
  }
});

/* ------------------------------------------------------------------ R43 */

test("R43 the module owns no check: it exports readers and constants only, and every element reference it emits is office-readers' own", async () => {
  assert.deepEqual(Object.keys(M).sort(), [
    "ODF_EVIDENTIARY_MEASURED", "ODF_EVIDENTIARY_VERSION", "ODF_FORMATS", "ODF_REPEAT_EXPANSION_MAX",
    "ODP_CONTENT_TYPE", "ODP_ROW", "ODS_CONTENT_TYPE", "ODS_ROW", "ODT_CONTENT_TYPE", "ODT_ROW",
    "isOdfTextPart", "odfEvidentiaryDigest", "odpEntry", "odsEntry", "odtEntry", "odtNormalisedContentXml",
  ]);
  const refs = [];
  const walk = (v) => {
    if (v && typeof v === "object") {
      if (typeof v.kind === "string" && typeof v.ref === "string" && /^(doc|sheet|slide)-/.test(v.kind)) refs.push(v);
      for (const x of Object.values(v)) walk(x);
    }
  };
  const odt = pkg("odt", { body: "<text:p>a<text:a xlink:href='#x'>b</text:a></text:p><table:table><table:table-row><table:table-cell/></table:table-row></table:table>" });
  const ods = pkg("ods", { body: "<table:table table:name='S'><table:table-row><table:table-cell office:value-type='string' table:formula='of:=1'><text:p><text:a xlink:href='#y'>c</text:a></text:p></table:table-cell></table:table-row></table:table>" });
  const odp = pkg("odp", { body: "<draw:page><draw:frame><draw:text-box><text:p><text:a xlink:href='#z'>d</text:a></text:p></draw:text-box></draw:frame><presentation:notes><draw:frame><draw:text-box><text:p>n</text:p></draw:text-box></draw:frame></presentation:notes></draw:page>" });
  for (const [e, b] of [[odtEntry, odt], [odsEntry, ods], [odpEntry, odp]]) { walk(await e.structure(b)); walk(await e.text(b)); }
  const rebuilt = (r) => ({
    "doc-para": () => docParaRef(r.para),
    "doc-table": () => docTableRef(r.table),
    "sheet-cell": () => sheetCellRef(r.sheet, r.cell),
    "sheet-range": () => usedSheetRange(r.sheet, 1, 1),
    "slide-shape": () => slideShapeRef(r.slide, r.shape ?? null),
  }[r.kind]());
  assert.deepEqual([...new Set(refs.map((r) => r.kind))].sort(), ["doc-para", "sheet-cell", "sheet-range", "slide-shape"]);
  const tables = (await odtEntry.text(odt)).tables;
  assert.deepEqual(tables.map((t) => t.ref), [docTableRef(0).ref]);
  for (const r of refs) assert.deepEqual(r, rebuilt(r), r.ref);
});
