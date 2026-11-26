/* odf-reader: active content, R47 (K1888, K1903, K1904), in office-readers
 * R32's shape (amended by K1917: `odf-script`, `launch`), tested through the three entries' structure() and text().
 * R47 is a provided service (T47, N942): `file-safety` reads it from these entries' structure(), so every test here
 * drives the module's public entries, from bytes and from parts()' own output, never an internal function. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { buildZip, members, withCd, contentXml, OVER_BOUND } from "./pkg.mjs";

/** @typedef {import("./pkg.mjs").Flavour} Flavour */
/** @typedef {import("../../../src/odf.mjs").ActiveItem} ActiveItem */
/** @typedef {typeof odtEntry | typeof odsEntry | typeof odpEntry} Entry */

const ENTRIES = { odt: odtEntry, ods: odsEntry, odp: odpEntry };
/** @type {Flavour[]} */
const FLAVOURS = ["odt", "ods", "odp"];
const SCRIPT_NS = 'xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0"';

/** Both projections carry the one list: assert they agree, and return it.
 *  @param {Entry} entry @param {Uint8Array} bytes @returns {Promise<ActiveItem[]>} */
async function activeOf(entry, bytes) {
  const s = await entry.structure(bytes);
  const t = await entry.text(bytes);
  assert.equal(s.ok, true);
  assert.equal(t.ok, true);
  assert.deepEqual(s.active, t.active, "structure() and text() carry the same list");
  return s.active;
}

/** @param {string} event @param {string} [href] */
const listener = (event, href = "vnd.sun.star.script:Standard.Module1.Main?language=Basic&amp;location=document") =>
  `<script:event-listener script:language="ooo:script" script:event-name="${event}" xlink:href="${href}"/>`;
/** content.xml with the script namespace declared and `scripts` ahead of the body.
 *  @param {Flavour} flavour @param {string} scripts @param {string} [body] */
const scripted = (flavour, scripts, body = "") => contentXml(flavour, body)
  .replace("<office:document-content ", `<office:document-content ${SCRIPT_NS} `)
  .replace("<office:font-face-decls>", `<office:scripts><office:event-listeners>${scripts}</office:event-listeners></office:scripts><office:font-face-decls>`);
/** @param {string} inner */
const stylesXml = (inner) => `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ${SCRIPT_NS} xmlns:xlink="http://www.w3.org/1999/xlink"><office:styles>${inner}</office:styles></office:document-styles>`;

test("R47 a file with nothing that can act answers active: [] on every entry, structure() and text() alike", async () => {
  for (const f of FLAVOURS) {
    const plain = buildZip(members(f, { body: f === "ods" ? "" : "<text:p>x</text:p>",
      extra: [{ name: "styles.xml", data: stylesXml("") }, { name: "Pictures/p.png", data: "png" }, { name: "Thumbnails/thumbnail.png", data: "t" }] }));
    assert.deepEqual(await activeOf(ENTRIES[f], plain), []);
    // no styles.xml at all: nothing to read, so nothing unread
    assert.deepEqual(await activeOf(ENTRIES[f], buildZip(members(f))), []);
  }
});

test("R47 Basic libraries, event listeners and embedded objects, one item per finding in central-directory order", async () => {
  for (const f of FLAVOURS) {
    const content = scripted(f, listener("dom:load") + `<script:event-listener script:language="ooo:script" xlink:href="x"/>`,
      f === "odt" ? `<text:p>${listener("dom:click")}</text:p>` : "");
    const extra = [
      { name: "Basic/", data: "" },
      { name: "Basic/script-lc.xml", data: "<library:libraries/>" },
      { name: "Basic/Standard/script-lb.xml", data: "<library:library/>" },
      { name: "Basic/Standard/Module1.xml", data: "Sub Main\n  Shell(\"calc\")\nEnd Sub" },
      { name: "styles.xml", data: stylesXml(listener("dom:mouseover")) },
      { name: "Object 1/", data: "" },
      { name: "Object 1/content.xml", data: "<chart/>" },
      { name: "Object 1/styles.xml", data: "<s/>" },
      { name: "Object 2", data: "OLE compound file" },
      { name: "ObjectReplacements/Object 1", data: "rendering" },
      { name: "ObjectReplacements/Object 2", data: "rendering" },
      { name: "Pictures/p.png", data: "png" },
      { name: "Scripts/", data: "" },
      { name: "Scripts/python/macro.py", data: "import os\nos.system('calc')" },
      { name: "Scripts/beanshell/Lib/m.bsh", data: "exec(\"calc\");" },
    ];
    const list = members(f, { content, extra });
    // the central directory lists styles.xml first after the mimetype, the body later: the list follows the directory
    const names = list.map((m) => m.name);
    const first = ["mimetype", "styles.xml", "Basic/Standard/Module1.xml"];
    const cdOrder = [...first.map((n) => names.indexOf(n)), ...names.flatMap((n, i) => (first.includes(n) ? [] : [i]))];
    const active = await activeOf(ENTRIES[f], buildZip(list, { cdOrder }));
    assert.deepEqual(active, [
      { kind: "odf-basic", part: "styles.xml", event: "dom:mouseover" },
      { kind: "odf-basic", part: "Basic/Standard/Module1.xml" },
      { kind: "odf-basic", part: "content.xml", event: "dom:load" },
      { kind: "odf-basic", part: "content.xml", event: null },
      ...(f === "odt" ? [{ kind: "odf-basic", part: "content.xml", event: "dom:click" }] : []),
      { kind: "odf-basic", part: "Basic/script-lc.xml" },
      { kind: "odf-basic", part: "Basic/Standard/script-lb.xml" },
      { kind: "embedded-file", part: "Object 1/content.xml" },
      { kind: "embedded-file", part: "Object 1/styles.xml" },
      { kind: "embedded-file", part: "Object 2" },
      { kind: "odf-script", part: "Scripts/python/macro.py" },
      { kind: "odf-script", part: "Scripts/beanshell/Lib/m.bsh" },
    ]);
  }
});

test("R47 an event listener is matched by the script namespace under any prefix; a commented one, or one in another namespace, is not", async () => {
  const content = contentXml("odp", `<draw:page><draw:frame><office:event-listeners>`
    + `<s:event-listener s:event-name="dom:click" xlink:href="x"/>`
    + `<presentation:event-listener script:event-name="dom:click" presentation:action="next-page"/>`
    + `<!-- <script:event-listener script:event-name="dom:commented"/> -->`
    + `</office:event-listeners></draw:frame></draw:page>`)
    .replace("<office:document-content ", `<office:document-content xmlns:s="urn:oasis:names:tc:opendocument:xmlns:script:1.0" `);
  assert.deepEqual(await activeOf(odpEntry, buildZip(members("odp", { content }))), [
    { kind: "odf-basic", part: "content.xml", event: "dom:click" },
  ]);
  // with the namespace undeclared, the conventional script: prefix still means it
  const bare = contentXml("odt", `<text:p>${listener("dom:load")}</text:p>`);
  assert.deepEqual(await activeOf(odtEntry, buildZip(members("odt", { content: bare }))), [
    { kind: "odf-basic", part: "content.xml", event: "dom:load" },
  ]);
});

test("R47 a presentation:event-listener is a launch item only when its action is execute, under any prefix bound to the namespace, in content.xml or styles.xml", async () => {
  /** @param {string} prefix @param {string} action @param {string} [event] */
  const pl = (prefix, action, event = "dom:click") => `<${prefix}:event-listener script:event-name="${event}" ${prefix}:action="${action}" xlink:href="file:///bin/sh"/>`;
  const content = contentXml("odp", `<draw:page><draw:frame><office:event-listeners>`
    + pl("presentation", "execute") + pl("presentation", "next-page") + pl("presentation", "show")
    + pl("p", "execute", "dom:mouseover") + `<presentation:event-listener presentation:action="execute"/>`
    + `<!-- ${pl("presentation", "execute", "dom:commented")} -->`
    + listener("dom:dblclick")
    + `</office:event-listeners></draw:frame></draw:page>`)
    .replace("<office:document-content ", `<office:document-content ${SCRIPT_NS} xmlns:p="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" `);
  const styles = stylesXml(pl("presentation", "execute", "dom:focus"));
  for (const f of FLAVOURS) {
    const c = f === "odp" ? content : content.replace("<office:presentation>", `<office:${{ odt: "text", ods: "spreadsheet" }[f]}>`)
      .replace("</office:presentation>", `</office:${{ odt: "text", ods: "spreadsheet" }[f]}>`);
    assert.deepEqual(await activeOf(ENTRIES[f], buildZip(members(f, { content: c, extra: [{ name: "styles.xml", data: styles }] }))), [
      { kind: "launch", part: "content.xml", event: "dom:click" },
      { kind: "launch", part: "content.xml", event: "dom:mouseover" },
      { kind: "launch", part: "content.xml", event: null },
      { kind: "odf-basic", part: "content.xml", event: "dom:dblclick" },
      { kind: "launch", part: "styles.xml", event: "dom:focus" },
    ]);
  }
});

test("R47 an embedded object is a member under an `Object …/` directory or the source an ObjectReplacements/ part names; nothing else", async () => {
  const extra = [
    { name: "Object 3", data: "a member no rendering names" },
    { name: "ObjectReplacements/Absent", data: "names no member" },
    { name: "Objects/x.bin", data: "not an Object directory" },
    { name: "sub/Object 1/content.xml", data: "not at the root" },
    { name: "sub/Basic/m.xml", data: "not the root's Basic/" },
    { name: "Object 9/Basic/m.xml", data: "inside a sub-document" },
    { name: "sub/Scripts/m.py", data: "not the root's Scripts/" },
    { name: "ScriptsX/m.py", data: "not a Scripts directory" },
  ];
  for (const f of FLAVOURS) {
    assert.deepEqual(await activeOf(ENTRIES[f], buildZip(members(f, { extra }))), [
      { kind: "embedded-file", part: "Object 9/Basic/m.xml" },
    ]);
  }
});

test("R47 a part that could not be read for the list is stated as unread; what is named in the central directory is listed whatever bound the text met", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const content = scripted(f, listener("dom:load"));
    const extra = [{ name: "Basic/Standard/Module1.xml", data: "Sub Main\nEnd Sub" }, { name: "styles.xml", data: stylesXml(listener("dom:focus")) },
      { name: "Object 1/content.xml", data: "<x/>" }];
    const base = members(f, { content, extra });
    // content.xml over the size guard: not inflated, so its listeners are unread; the rest still stands
    assert.deepEqual(await activeOf(e, buildZip(withCd(base, "content.xml", { usize: OVER_BOUND }))), [
      { kind: "unread", part: "content.xml", why: "over_size_bound" },
      { kind: "odf-basic", part: "Basic/Standard/Module1.xml" },
      { kind: "odf-basic", part: "styles.xml", event: "dom:focus" },
      { kind: "embedded-file", part: "Object 1/content.xml" },
    ]);
    // content.xml unreadable, styles.xml unreadable, styles.xml over the guard
    assert.deepEqual((await activeOf(e, buildZip(withCd(base, "content.xml", { crc: 1 })))).filter((i) => i.kind === "unread"),
      [{ kind: "unread", part: "content.xml", why: "crc_mismatch" }]);
    assert.deepEqual((await activeOf(e, buildZip(withCd(base, "styles.xml", { crc: 1 })))).filter((i) => i.part === "styles.xml"),
      [{ kind: "unread", part: "styles.xml", why: "crc_mismatch" }]);
    assert.deepEqual((await activeOf(e, buildZip(withCd(base, "styles.xml", { usize: OVER_BOUND })))).filter((i) => i.part === "styles.xml"),
      [{ kind: "unread", part: "styles.xml", why: "over_size_bound" }]);
    // a Basic module is named, never read: one whose bytes are corrupt is listed and never unread
    assert.deepEqual((await activeOf(e, buildZip(withCd(base, "Basic/Standard/Module1.xml", { crc: 1 })))).filter((i) => i.part.startsWith("Basic/")),
      [{ kind: "odf-basic", part: "Basic/Standard/Module1.xml" }]);
  }
});

test("R47 structure() and text() given parts()' own output carry the same list as given the bytes, on every entry", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const content = scripted(f, listener("dom:load"));
    const extra = [{ name: "Basic/Standard/Module1.xml", data: "Sub Main\nEnd Sub" }, { name: "Scripts/python/m.py", data: "x" },
      { name: "styles.xml", data: stylesXml(listener("dom:focus")) }, { name: "Object 1/content.xml", data: "<x/>" }];
    for (const bytes of [buildZip(members(f, { content, extra })),
      buildZip(withCd(members(f, { content, extra }), "content.xml", { usize: OVER_BOUND })), buildZip(members(f))]) {
      const fromBytes = await activeOf(e, bytes);
      const p = await e.parts(bytes);
      assert.equal(p.ok, true);
      const ps = await e.structure(p);
      assert.ok(ps.ok);
      assert.deepEqual(ps.active, fromBytes);
      const pt = await e.text(p);
      assert.ok(pt.ok);
      assert.deepEqual(pt.active, fromBytes);
    }
  }
});

test("R47 read, never run: no listener target is fetched or resolved, and the list survives the repeat bound", async () => {
  const saved = globalThis.fetch;
  /** @type {unknown[][]} */
  const calls = [];
  globalThis.fetch = (...a) => { calls.push(a); throw new Error("network"); };
  try {
    const body = `<table:table table:name="S"><table:table-row><table:table-cell office:value-type="string" table:number-columns-repeated="262145"><text:p>v</text:p></table:table-cell></table:table-row></table:table>`;
    const content = scripted("ods", listener("dom:load", "https://example.org/payload"), body);
    const bytes = buildZip(members("ods", { content, extra: [{ name: "Basic/Standard/Module1.xml", data: "Sub Main\nEnd Sub" }] }));
    const t = await odsEntry.text(bytes);
    assert.ok(t.ok);
    assert.equal(t.undetermined[0]?.why, "over_repeat_bound", "the projection stopped at R45's bound");
    assert.deepEqual(await activeOf(odsEntry, bytes), [
      { kind: "odf-basic", part: "content.xml", event: "dom:load" },
      { kind: "odf-basic", part: "Basic/Standard/Module1.xml" },
    ]);
  } finally { globalThis.fetch = saved; }
  assert.deepEqual(calls, []);
});
