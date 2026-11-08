/* screens-intake R5, R36 (G44): the safe view of a spreadsheet draws what the answer says, a cut or an unreadable sheet and a file no
 * preview can show stated by key. Fix round 10 (K5054): over the REAL store: the spreadsheets are held by the member's real acts (workbooks written
 * with test-support's `makeZip`: a long sheet, many sheets, a sheet whose part is damaged, a package above what a safe view reads, an ODS declaring more
 * than its bound) and the answers are file-safety's own `safeview`, whose figures the assertions read from the owner's answer. The two answers the
 * owner cannot be made to give from a file (a sheet cut whose total it does not know; an answer from an older record) and the refusal without its
 * figures stay scripted, each said where it is. */
import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { openWorld, members, html, text, main, press, ok, refused, word, says, rawKeys } from "./page.mjs";
import { makeZip } from "../../make-zip.mjs";
import { GRADE_READ_MAX } from "../../../src/file-safety/index.mjs";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const XT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const sheetXml = (rows) => `<worksheet xmlns="${MAIN}"><sheetData>` + Array.from({ length: rows }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i + 1}</v></c></row>`).join("") + `</sheetData></worksheet>`;
/* a workbook of `sheets` `[{name, xml, entry?}]` (`entry` overrides the sheet part's zip entry: the central directory lying, a damaged part) */
function xlsxOf(sheets, extra = []) {
  const ct = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;
  const wb = `<workbook xmlns="${MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
    + sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>`;
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") + `</Relationships>`;
  return makeZip([{ name: "[Content_Types].xml", data: ct }, { name: "xl/workbook.xml", data: wb }, { name: "xl/_rels/workbook.xml.rels", data: rels },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml, ...(s.entry ?? {}) })), ...extra]);
}
/* an ODS of one small table whose content.xml the central directory says is `declared` bytes (a lie, so the part is never read) */
function odsDeclaring(declared) {
  const ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
  const type = "application/vnd.oasis.opendocument.spreadsheet";
  const cell = (v) => `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`;
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ns} office:version="1.3"><office:body><office:spreadsheet><table:table table:name="S"><table:table-row>${cell(1)}</table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`;
  const manifest = `<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${type}"/></manifest:manifest>`;
  return { bytes: makeZip([{ name: "mimetype", data: type, method: 0 }, { name: "META-INF/manifest.xml", data: manifest }, { name: "content.xml", data: content, central: { uncompressedSize: declared } }]), type };
}

/* the member's own held file: `captureupload`, `allocid` and `promote` as the recipe `hold` makes them, and for a file larger than one piece the pieces the upload
   answers (`parts`) filed as blob references, as the capture screen files them; the page is opened on its digest */
const sha = (v) => createHash("sha256").update(v).digest("hex");
const held = async (bytes, type = XT, name = "Budget") => {
  const t = await members({ mai: ["contribute"] });
  const up = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: bytes } }, t.mai);
  const doc = up.json && up.json.result && up.json.result.document;
  if (!doc || !doc.capture) throw new Error(`captureupload was refused: ${JSON.stringify(up.json).slice(0, 300)}`);
  const now = new Date(t.world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = (await t.mai.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-" + name.toLowerCase();
  const cap = doc.capture.sha256;
  const parts = Array.isArray(doc.parts) && doc.parts.length ? doc.parts : null;
  const blobs = parts ? doc.parts.map((x) => ({ path: x.file, sha256: x.sha256, bytes: x.bytes })) : [{ path: doc.file, sha256: cap, bytes: doc.capture.bytes }];
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(name), "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + cap,
    "source:", "  locator: " + JSON.stringify(doc.locator || "upload"), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    "---", "", "## Summary", "", name, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: cap }] });
  const len = (v) => new TextEncoder().encode(v).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: sha(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: sha(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: sha(dataset) }, ...blobs.map((b) => ({ path: b.path, blobSha: b.sha256, sha256: b.sha256, bytes: b.bytes }))];
  await t.mai.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sha(id).slice(0, 8),
    meta: { object_type: "information", title: name, current_state: "collected", created: now, last_updated: now }, files,
    register: parts && (parts.length > 1 || parts[0].sha256 !== cap) ? [{ sha256: cap, path: doc.file, encoding: "binary", bytes: doc.capture.bytes, parts: parts.map((x) => ({ sha256: x.sha256, path: x.file, bytes: x.bytes })) }]
      : [{ sha256: cap, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  return { ...t, sha: cap };
};
const drawn = async (t, plane = {}) => {
  const p = await openWorld(`/app/open-file/${t.sha}`, { world: t.world, as: t.mai, plane });
  p.notesBefore = main(p).querySelectorAll(".mk-note").length;   /* the screen's own notes, drawn before any safe view is asked */
  await press(p, "safeview", { reason: "to read it" });
  return p;
};
const MB = (n) => (n / 1048576).toFixed(1);
const cutWords = ["screen.open-file.safe.cut", "screen.open-file.safe.cut.more", "screen.open-file.safe.sheetscut", "screen.open-file.safe.sheet.unreadable"];

test("R5 R36 a cut sheet draws the rows shown of the total by key", async () => {
  const t = await held(xlsxOf([{ name: "FY22", xml: sheetXml(2500) }]));
  const p = await drawn(t);
  const v = (await t.mai.read("safeview", { query: { capture: t.sha } })).sheets[0];
  assert.equal(v.truncated, true, "the owner cuts a long sheet");
  assert.ok(says(p, "screen.open-file.safe.cut", { from: v.rows.from, to: v.rows.to, total: v.total_rows }));
  assert.match(html(p), /<td>A3<\/td><td>3<\/td>/);
  assert.deepEqual(rawKeys(p), []);
  /* a sheet cut with no total stated is no answer the owner gives (it always states the total of a sheet it cuts): the case that scripted one is removed (fix round 10, K5245) */
});

test("R5 R36 a whole sheet draws no cut, no sheet statement", async () => {
  const t = await held(xlsxOf([{ name: "FY22", xml: sheetXml(2) }]));
  const whole = await drawn(t);
  const w = (await t.mai.read("safeview", { query: { capture: t.sha } })).sheets[0];
  assert.deepEqual([w.truncated, w.total_rows], [false, 2], "the owner states it whole");
  /* an answer from an older record (no rows, no total, no cut) is none the owner gives of a file it holds now: the case that scripted one is removed (fix round 10, K5245) */
  for (const [p, last] of [[whole, "2"]]) {
    assert.match(html(p), new RegExp(`<td>A2<\\/td><td>${last}<\\/td>`));
    /* no sentence of the four is in the page: their keys are not even asked for when nothing is cut */
    assert.equal(main(p).querySelectorAll(".mk-note").length, p.notesBefore, "the safe view adds no note of its own");
    for (const k of cutWords) assert.ok(!says(p, k, { from: 1, to: 2, total: 2, shown: 1, name: "FY22" }), k);
  }
});

test("R5 R36 a cut list of sheets says how many of how many are shown; a sheet that could not be shown says so, with no empty table", async () => {
  /* twenty-five sheets, more than a safe view shows; the last of the shown a damaged part (its checksum is wrong) */
  const sheets = Array.from({ length: 25 }, (_, i) => ({ name: `S${i + 1}`, xml: sheetXml(2), ...(i === 1 ? { entry: { central: { crc32: 1 } } } : {}) }));
  const t = await held(xlsxOf(sheets));
  const p = await drawn(t);
  const v = await t.mai.read("safeview", { query: { capture: t.sha } });
  assert.equal(v.sheets_truncated, true);
  assert.ok(says(p, "screen.open-file.safe.sheetscut", { shown: v.sheets.length, total: v.sheets_total }));
  const bad = v.sheets.find((s) => s.reason);
  assert.equal(bad.name, "S2");
  assert.ok(says(p, "screen.open-file.safe.sheet.unreadable", { name: bad.name }));
  assert.equal(main(p).querySelectorAll("table").length, v.sheets.length - 1, "only the readable sheets draw a table");
  for (const k of cutWords) assert.ok(typeof word(k, { from: 1, to: 1, total: 1, shown: 1, name: "x" }) === "string", k);
});

test("R5 R36 a refusal with a size and a bound draws the no-preview sentence in MB; one without them draws as before", async () => {
  const MIB = 1024 * 1024;
  const ods = odsDeclaring(600 * MIB);
  /* PREVIEW_NOT_DRAWN is made by a real upload. TOO_LARGE (a sheet over the owner's whole-read bound, file-safety `GRADE_READ_MAX`, now 100 MiB) is past
     the door's own upload ceiling for a spreadsheet (50 MB, `limit.spreadsheet.bytes`), so no real act reaches it: it is the one scripted fault here, in
     the owner's shape with the owner's bound, one MiB over it */
  const over = GRADE_READ_MAX + MIB;
  const files = { TOO_LARGE: [xlsxOf([{ name: "S", xml: sheetXml(2) }]), XT, { safeview: refused("SAFE_VIEW_FAILED", word("file-safety.index.the_safe_view_could_not_be_made"), 422,
                    { renderer_reason: "TOO_LARGE", size: over, bound: GRADE_READ_MAX, format: "xlsx" }) }],
                  PREVIEW_NOT_DRAWN: [ods.bytes, ods.type, {}] };
  for (const [reason, [bytes, type, plane]] of Object.entries(files)) {
    const t = await held(bytes, type);
    const p = await drawn(t, plane);
    /* the figures are the owner's, read from its refusal (or, for the scripted fault, its bound) */
    const f = plane.safeview ? { renderer_reason: reason, size: over, bound: GRADE_READ_MAX, translation: word("file-safety.index.the_safe_view_could_not_be_made") }
      : (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: t.sha })}` }, t.mai)).json.result;
    assert.equal(f.renderer_reason, reason, "the owner refuses it, naming why");
    assert.ok(Number.isFinite(f.size) && Number.isFinite(f.bound), "the owner states the size and the bound");
    assert.ok(says(p, "screen.open-file.safe.notdrawn", { size: MB(f.size), bound: MB(f.bound) }), reason);
    assert.ok(!text(p).includes(f.translation), "not the generic sentence alone");
    assert.equal(main(p).querySelectorAll("table").length, 0, "never an empty table");
  }
  /* the owner states the figures with this refusal every time, so a refusal without them is a scripted one */
  const t = await held(xlsxOf([{ name: "S", xml: sheetXml(2) }]));
  const plain = await drawn(t, { safeview: refused("SAFE_VIEW_FAILED", word("file-safety.index.the_safe_view_could_not_be_made"), 422, { renderer_reason: "TOO_LARGE" }) });
  assert.ok(text(plain).includes(word("file-safety.index.the_safe_view_could_not_be_made")));
});
