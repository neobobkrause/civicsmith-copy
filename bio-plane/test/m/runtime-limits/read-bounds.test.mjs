/* runtime-limits: the reading ceilings' one table (R29, R30, R31; fix round 9 G124; K4831 (3) (8), K4834, K4835 (1), K4840 (1)).
 * The table's shape and every row's invariants are pinned; the figures of R30 are pinned row by row, and a later job's added
 * row changes none of these expectations (a row is checked by its invariants, never by counting the table). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { READ_BOUNDS, boundOf, statement, wholeReadRow } from "../../../src/read-bounds.mjs";
/** @import { BoundRow } from "../../../src/read-bounds.mjs" */

const MiB = 1048576, GiB = 1073741824, MB50 = 52428800;
const LIGHT = ["text", "csv", "tsv", "json", "xml"];
/** @param {string} kind @param {string} name @param {BoundRow} row @returns {[string, string, BoundRow]} */
const triple = (kind, name, row) => [kind, name, row];
/** @returns {[string, string, BoundRow][]} */
const rows = () => Object.entries(READ_BOUNDS).flatMap(([kind, names]) => Object.entries(names).map(([name, row]) => triple(kind, name, row)));
/** The table, each kind's rows and each row are frozen (a row holds only numbers and text). */
const deepFrozen = () => Object.isFrozen(READ_BOUNDS)
  && Object.values(READ_BOUNDS).every((names) => Object.isFrozen(names) && Object.values(names).every((row) => Object.isFrozen(row)));
/** The row at kind and name; a missing one fails the test there.
 *  @param {string} kind @param {string} name @returns {BoundRow} */
const at = (kind, name) => {
  const row = READ_BOUNDS[kind]?.[name];
  assert.ok(row, `${kind}/${name}`);
  return row;
};

test("R29: READ_BOUNDS is a deeply frozen map kind -> name -> {standard, alpha, protective, key}", () => {
  assert.ok(deepFrozen());
  assert.ok(rows().length > 0);
  for (const [kind, name, row] of rows()) {
    const where = `${kind}/${name}`;
    assert.deepEqual(Object.keys(row).sort(), ["alpha", "key", "protective", "standard"], where);
    /** @type {[string, number][]} */
    const figures = [["standard", row.standard], ["alpha", row.alpha], ["protective", row.protective]];
    for (const [f, n] of figures) assert.ok(Number.isSafeInteger(n) && n > 0, `${where} ${f}`);
    assert.ok(row.alpha <= row.standard, `${where}: alpha is never above standard`);
    assert.ok(typeof row.key === "string" && row.key.length > 0, `${where} key`);
  }
});

test("R29: every pair a requirement file quotes with boundOf has a row (the 19 of fix round 9, and the pdf names quoted in prose)", () => {
  /** @type {[string, string][]} */
  const pairs = [["archive", "depth"], ["archive", "members"], ["document", "clean_bytes"], ["file_safety", "grade_read"], ["image", "chunks"], ["image", "cover_bytes"],
    ["image", "edge"], ["image", "picture_frame"], ["image", "pixels"], ["image", "row_stride"], ["ocr", "frame_bytes"], ["office", "entries"], ["pdf", "bfrange_codes"],
    ["pdf", "need_mb"], ["pdf", "page_content"], ["pdf", "worker_bytes"], ["render", "safe_view_bytes"], ["render", "safe_view_pages"], ["xml", "tag"],
    ["pdf", "object_stream"], ["pdf", "cmap"], ["pdf", "embedded_file"]];
  for (const [k, n] of pairs) at(k, n);
});

test("R29: no module's table is copied by hand: the frozen table cannot be edited by a caller", () => {
  assert.throws(() => { "use strict"; READ_BOUNDS.pdf.page_content.alpha = 1; }, TypeError);
  assert.throws(() => { "use strict"; READ_BOUNDS.pdf.extra = {}; }, TypeError);
  assert.throws(() => { "use strict"; READ_BOUNDS.newkind = {}; }, TypeError);
});

test("R30: the light kinds hold the standard 50 MB (52,428,800 bytes) and 1,048,576 rows", () => {
  for (const kind of ["text", "csv", "tsv", "json"]) {
    assert.equal(at(kind, "bytes").standard, 52428800, kind);
    assert.equal(at(kind, "rows").standard, 1048576, kind);
  }
  assert.equal(at("xml", "bytes").standard, 52428800);
  assert.equal(at("xml", "rows").standard, 1048576);
});

test("R30: archives hold 500 MB uploaded and 2 GB unpacked at the standard, 256 MiB each at the alpha, depth 3, ratio 1,100, 10,000 members", () => {
  assert.equal(at("archive", "uploaded_bytes").standard, 524288000);
  assert.equal(at("archive", "unpacked_bytes").standard, 2 * GiB);
  assert.equal(at("archive", "uploaded_bytes").alpha, 256 * MiB);
  assert.equal(at("archive", "unpacked_bytes").alpha, 256 * MiB);
  assert.equal(at("archive", "depth").alpha, 3);
  assert.equal(at("archive", "ratio").alpha, 1100);
  assert.equal(at("archive", "members").alpha, 10000);
  assert.equal(boundOf("archive", "uploaded_bytes"), 256 * MiB);
});

test("R30: the alpha figures of the heavy kinds the plan names", () => {
  assert.equal(boundOf("pdf", "bytes"), 24 * MiB);
  assert.equal(boundOf("xlsx", "declared_text"), 32 * MiB);
  assert.equal(boundOf("ods", "content_xml"), 20 * MiB);
  assert.equal(boundOf("ods", "repeat_units"), 262144);
  assert.equal(boundOf("workbook", "cells"), 250000);
  assert.equal(boundOf("sheet_worker", "cells"), 250000);
  assert.equal(boundOf("sheet_worker", "bytes"), 9000000);
  assert.equal(boundOf("sheet_worker", "ms"), 120000);
  assert.equal(boundOf("office", "retained_objects"), 250000);
  assert.equal(at("workbook", "cells").standard, 250000);
});

test("R30: the protective figures, each as proposed", () => {
  /** @type {{ [kind: string]: { [name: string]: number } }} */
  const want = {
    sheet: { columns: 16384, cell_chars: 32767, cell_kept_chars: MiB, sheets: 1000 },
    archive: { members: 10000, depth: 3, ratio: 1100, directory: 16 * MiB, name: 4096 },
    pdf: { page_content: 64 * MiB, object_stream: 32 * MiB, cmap: MiB, embedded_file: 64 * MiB, objects: 2000000, direct_object: 4 * MiB, operands: 65536, tree_depth: 256, bfrange_codes: 65536 },
    image: { edge: 65535, chunks: 65536, row_stride: 8 * MiB, pixels: 120000000 },
    xml: { tag: 64 * 1024 },
    office: { entries: 100000, retained_objects: 250000 },
  };
  for (const [kind, names] of Object.entries(want)) for (const [name, f] of Object.entries(names)) assert.equal(at(kind, name).protective, f, `${kind}/${name}`);
});

test("R31: boundOf answers the alpha, except the light kinds, which answer the standard", () => {
  for (const [kind, name, row] of rows()) assert.equal(boundOf(kind, name), LIGHT.includes(kind) ? row.standard : row.alpha, `${kind}/${name}`);
  assert.equal(boundOf("csv", "bytes"), 52428800);
  assert.equal(boundOf("csv", "rows"), 1048576);
  assert.equal(boundOf("image", "pixels"), 120000000);
});

test("R31: statement answers {size, bound, key} with the size the caller measured and the row's key", () => {
  const s = statement("pdf", "bytes", 24 * MiB + 1);
  assert.deepEqual(s, { size: 24 * MiB + 1, bound: 24 * MiB, key: at("pdf", "bytes").key });
  assert.deepEqual(Object.keys(s), ["size", "bound", "key"]);
  assert.equal(statement("csv", "rows", 1048577).bound, 1048576);
  assert.equal(statement("image", "pixels", 0).size, 0);
});

test("R31: boundOf and statement throw an Error naming the kind and the name when no such row exists, and never otherwise", () => {
  /** @param {unknown} kind @param {unknown} name @returns {(e: unknown) => boolean} names both */
  const naming = (kind, name) => (e) => e instanceof Error && e.message.includes(String(kind)) && e.message.includes(String(name));
  for (const [kind, name] of [["pdf", "nope"], ["nope", "bytes"], ["pdf", "__proto__"], ["pdf", "constructor"], ["pdf", "toString"]]) {
    assert.throws(() => boundOf(kind, name), naming(kind, name), `${kind}/${name}`);
    assert.throws(() => statement(kind, name, 1), naming(kind, name));
  }
  /* a kind or name that is not text at all: the same Error, naming what was passed */
  assert.throws(() => boundOf(undefined, undefined), naming(undefined, undefined));
  assert.throws(() => statement(undefined, undefined, 1), naming(undefined, undefined));
  assert.throws(() => boundOf(3, {}), naming(3, {}));
  assert.throws(() => statement(3, {}, 1), naming(3, {}));
  for (const [kind, name] of rows()) assert.doesNotThrow(() => statement(kind, name, -1 === 0 ? 0 : 5));
});

test("R30 (K4845): the heavy kinds' standards are K4628's per kind: documents 100 MB, spreadsheets and images 50 MB, the alpha where it is above", () => {
  /** @param {string} k @param {string} n */
  const std = (k, n) => at(k, n).standard;
  /** @type {[string, string][]} */
  const documents = [["pdf", "bytes"], ["pdf", "worker_bytes"], ["document", "clean_bytes"], ["file_safety", "grade_read"]];
  /** @type {[string, string][]} */
  const sheetsAndImages = [["xlsx", "declared_text"], ["ods", "content_xml"], ["sheet_worker", "bytes"], ["image", "cover_bytes"]];
  for (const [k, n] of documents) assert.equal(std(k, n), 104857600, `${k}/${n}`);
  for (const [k, n] of sheetsAndImages) assert.equal(std(k, n), 52428800, `${k}/${n}`);
  assert.equal(std("ocr", "frame_bytes"), 61300000);
  assert.equal(boundOf("pdf", "bytes"), 24 * MiB);
});

/* the rows the quoting jobs of batch B reported (K4857, K4858, K4859, K4860; R30: a quoting job's row, added by this module, K4842 (1)) */
/** @type {[string, string, number, number, number][]} */
const ADDED = [
  ["office", "text_bytes", 104857600, 20 * MiB, 104857600],
  ["office", "streamed_text_bytes", 104857600, 32 * MiB, 104857600],
  ["archive", "member_bytes", 2 * GiB, 256 * MiB, 2 * GiB],
  ["office", "decoded_chars", 67108864, 67108864, 67108864],
  ["image", "working_set", 61300000, 61300000, 61300000],
  ["image", "retained_objects", 250000, 250000, 250000],
  ["scan", "max_bytes", 524288000, 268435456, 524288000],
  ["scan", "time_ms", 900000, 900000, 900000],
  ["scan", "embedded_pe", 41943040, 41943040, 41943040],
  ["scan", "html_normalize", 41943040, 41943040, 41943040],
  ["scan", "script_normalize", 20971520, 20971520, 20971520],
  ["scan", "zip_type_rcg", 1048576, 1048576, 1048576],
  ["scan", "partitions", 50, 50, 50],
  ["scan", "icons_pe", 100, 100, 100],
  ["office", "structural_part_bytes", 8388608, 8388608, 8388608],
  ["office", "piece_chars", 8388608, 8388608, 8388608],
  ["image", "picture_source", 603979776, 603979776, 603979776],
  ["ocr", "picture_edge", 4096, 4096, 4096],
  ["document", "part_bytes", 104857600, 33554432, 33554432],
  ["image", "rows_pixels", 201326592, 201326592, 201326592],
  ["pdf", "object_stream", 33554432, 33554432, 33554432],
  ["pdf", "xmp", 2097152, 2097152, 2097152],
];

test("R30: the rows quoting jobs reported (19, then K4862's 22) hold exactly the figures BOB gave, and boundOf and statement answer them (R31)", () => {
  assert.equal(ADDED.length, 22);
  for (const [kind, name, standard, alpha, protective] of ADDED) {
    const row = at(kind, name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard, alpha, protective }, `${kind}/${name}`);
    assert.equal(row.key, `limit.${kind}.${name}`);
    assert.equal(boundOf(kind, name), alpha, `${kind}/${name} answers the alpha`);
    assert.deepEqual(statement(kind, name, alpha + 1), { size: alpha + 1, bound: alpha, key: `limit.${kind}.${name}` });
  }
});

/* the three rows acquisition quotes (K4882; K4842 (1)): today's figure in all three columns, so no member-facing bound moves (K1881) */
/** @type {[string, string, number][]} */
const ACQUISITION_ROWS = [
  ["capture", "keep_bytes", 33554432],
  ["capture", "profile_text_bytes", 8388608],
  ["render", "dom_bytes", 26214400],
];

test("R30: the rows acquisition quotes (capture keep_bytes 32 MiB, profile_text_bytes 8 MiB; render dom_bytes 25 MiB) hold one figure in all three columns, and boundOf and statement answer them (R31)", () => {
  for (const [kind, name, n] of ACQUISITION_ROWS) {
    const row = at(kind, name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n }, `${kind}/${name}`);
    assert.equal(row.key, `limit.${kind}.${name}`);
    assert.equal(boundOf(kind, name), n, `${kind}/${name} answers the figure`);
    assert.deepEqual(statement(kind, name, n + 1), { size: n + 1, bound: n, key: `limit.${kind}.${name}` });
  }
});

/* the row file-safety quotes (K4893; K4842 (1)): today's figure in all three columns, so no member-facing bound moves (K1881) */
test("R30: the row file-safety quotes (file_safety ods_declared, 8 MiB) holds one figure in all three columns, and boundOf and statement answer it (R31)", () => {
  const n = 8 * MiB, row = at("file_safety", "ods_declared");
  assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n });
  assert.equal(row.key, "limit.file_safety.ods_declared");
  assert.equal(boundOf("file_safety", "ods_declared"), n);
  assert.deepEqual(statement("file_safety", "ods_declared", n + 1), { size: n + 1, bound: n, key: "limit.file_safety.ods_declared" });
  assert.equal(at("file_safety", "grade_read").alpha, 20 * MiB);
});

/* the row extraction keeps and control-plane quotes (K4901; K4842 (1)): today's figure in all three columns, so no member-facing bound moves (K1881) */
test("R30: the row extraction and control-plane quote (pdf request_bytes, 2 MiB) holds one figure in all three columns, and boundOf and statement answer it (R31)", () => {
  const n = 2 * MiB, row = at("pdf", "request_bytes");
  assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n });
  assert.equal(row.key, "limit.pdf.request_bytes");
  assert.equal(boundOf("pdf", "request_bytes"), n);
  assert.deepEqual(statement("pdf", "request_bytes", n + 1), { size: n + 1, bound: n, key: "limit.pdf.request_bytes" });
  assert.equal(at("pdf", "bytes").alpha, 24 * MiB);
});

/* the rows control-plane and content quote (K4916; K4842 (1)): today's figures in all three columns, so no member-facing bound moves (K1881) */
test("R30: the rows control-plane and content quote (text request_bytes 3 MiB, content held_text_chars 32 Mi, content kind_scan_pages 16) hold one figure in all three columns, and boundOf and statement answer them (R31)", () => {
  /** @type {[string, string, number][]} */
  const quoted = [["text", "request_bytes", 3 * MiB], ["content", "held_text_chars", 32 * MiB], ["content", "kind_scan_pages", 16]];
  for (const [kind, name, n] of quoted) {
    const row = at(kind, name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n }, `${kind}/${name}`);
    assert.equal(row.key, `limit.${kind}.${name}`);
    assert.equal(boundOf(kind, name), n, `${kind}/${name} answers the figure`);
    assert.deepEqual(statement(kind, name, n + 1), { size: n + 1, bound: n, key: `limit.${kind}.${name}` });
  }
  /* text is a light kind (R31): it answers the standard, which here equals the alpha; its other rows are unmoved */
  assert.equal(boundOf("text", "bytes"), 52428800);
  assert.equal(at("text", "bytes").alpha, 24 * MiB);
});

/* the rows calculations quotes (K4922; K4842 (1)): today's figures in all three columns, so no member-facing bound moves (K1881) */
test("R30: the rows calculations quotes (table bytes 20 MiB, table cells 1,000,000) hold one figure in all three columns, and boundOf and statement answer them (R31)", () => {
  /** @type {[string, number][]} */
  const quoted = [["bytes", 20 * MiB], ["cells", 1000000]];
  for (const [name, n] of quoted) {
    const row = at("table", name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n }, `table/${name}`);
    assert.equal(row.key, `limit.table.${name}`);
    assert.equal(boundOf("table", name), n, `table/${name} answers the figure`);
    assert.deepEqual(statement("table", name, n + 1), { size: n + 1, bound: n, key: `limit.table.${name}` });
  }
  assert.deepEqual(Object.keys(READ_BOUNDS.table ?? {}), ["bytes", "cells"]);
});

/* the rows workbooks quotes (K4936; K4831 (8) (10), K4845) */
test("R30: the workbook rows (cells 250,000 in all columns, file bytes 20 MiB alpha and 50 MB elsewhere, cells JSON 64 MiB in all columns) are answered by boundOf and statement (R31)", () => {
  /** @type {{ [name: string]: { standard: number, alpha: number, protective: number } }} */
  const want = {
    cells: { standard: 250000, alpha: 250000, protective: 250000 },
    bytes: { standard: MB50, alpha: 20 * MiB, protective: MB50 },
    cells_json_bytes: { standard: 64 * MiB, alpha: 64 * MiB, protective: 64 * MiB },
  };
  for (const [name, cols] of Object.entries(want)) {
    const row = at("workbook", name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, cols, `workbook/${name}`);
    assert.equal(row.key, `limit.workbook.${name}`);
    assert.equal(boundOf("workbook", name), cols.alpha, `workbook/${name} answers its active figure`);
    assert.deepEqual(statement("workbook", name, cols.alpha + 1), { size: cols.alpha + 1, bound: cols.alpha, key: `limit.workbook.${name}` });
  }
  assert.deepEqual(Object.keys(READ_BOUNDS.workbook ?? {}), ["cells", "bytes", "cells_json_bytes"]);
});

/* the six rows provenance, acquisition, case-authoring, case-carriage, monitoring and following quote (K4958; R35): today's figures in all three columns, so no bound moves (K1881) */
test("R35: the six rows (provenance part_verify_bytes 8 MiB, acquisition odf_digest_bytes 8 MiB, acquisition large_fetch_bytes 8 MiB, case copy_now_bytes 2 MiB, monitoring docket_read_bytes 8 MiB, following portal_parse_bytes 4 MiB) hold one figure in all three columns, and boundOf and statement answer them (R31)", () => {
  /** @type {[string, string, number][]} */
  const want = [["provenance", "part_verify_bytes", 8 * MiB], ["acquisition", "odf_digest_bytes", 8 * MiB], ["acquisition", "large_fetch_bytes", 8 * MiB],
    ["case", "copy_now_bytes", 2 * MiB], ["monitoring", "docket_read_bytes", 8 * MiB], ["following", "portal_parse_bytes", 4 * MiB]];
  for (const [kind, name, n] of want) {
    const row = at(kind, name);
    assert.deepEqual({ standard: row.standard, alpha: row.alpha, protective: row.protective }, { standard: n, alpha: n, protective: n }, `${kind}/${name}`);
    assert.equal(row.key, `limit.${kind}.${name}`);
    assert.equal(boundOf(kind, name), n, `${kind}/${name} answers the figure`);
    assert.deepEqual(statement(kind, name, n + 1), { size: n + 1, bound: n, key: `limit.${kind}.${name}` });
  }
});

/* the one declaration of the whole-read row by a document's kind (K4965; R36) */
test("R36: wholeReadRow(kind) gives pdf, csv and text their own bytes row, every other kind or none the whole-load row pdf.bytes, and boundOf of the row is its active figure", () => {
  /** @type {[unknown, [string, string]][]} */
  const want = [["pdf", ["pdf", "bytes"]], ["csv", ["csv", "bytes"]], ["text", ["text", "bytes"]],
    ["docx", ["pdf", "bytes"]], ["json", ["pdf", "bytes"]], ["PDF", ["pdf", "bytes"]], ["", ["pdf", "bytes"]], ["constructor", ["pdf", "bytes"]],
    [null, ["pdf", "bytes"]], [undefined, ["pdf", "bytes"]], [42, ["pdf", "bytes"]]];
  for (const [kind, row] of want) {
    assert.deepEqual(wholeReadRow(kind), row, `kind ${String(kind)}`);
    assert.equal(boundOf(...wholeReadRow(kind)), boundOf(row[0], row[1]), `kind ${String(kind)} bound`);
  }
  assert.deepEqual(wholeReadRow(), ["pdf", "bytes"]);
  assert.equal(boundOf(...wholeReadRow("pdf")), at("pdf", "bytes").alpha);
  assert.equal(boundOf(...wholeReadRow("csv")), at("csv", "bytes").standard);
  assert.equal(boundOf(...wholeReadRow("text")), at("text", "bytes").standard);
});
