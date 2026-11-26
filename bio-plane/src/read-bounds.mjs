/* The reading ceilings, one table (runtime-limits R29, R30, R31; fix round 9 G124; K4831 (3) (8), K4834, K4835 (1)).
 *
 * Every ceiling a reading module keeps is a row here: `standard` is the figure the standard sets (K4628), `alpha` the
 * figure the alpha keeps (the kind's own figure at the start of fix round 9 where it is lower), `protective` a limit
 * against a file no ordinary program produces. A quoting module writes `export const X_MAX = boundOf(kind, name)` and
 * holds no numeric literal for a ceiling; the sentence a refusal says is the quoting module's (`key` names it). A job
 * adds its own row below, with the three figures. MB and GB count 2^20 and 2^30 bytes (K4840 (1)). Where the
 * requirements give no standard for a heavy kind, the row's standard is K4628's per kind (K4845: documents 100 MB,
 * spreadsheets and images 50 MB; the alpha where it is above), a count or time row's standard is its alpha, and the
 * protective figure is the one R30 names, else the standard. Pure; nothing at load but the frozen table. */

const KiB = 1024, MiB = 1048576, GiB = 1073741824, MB50 = 52428800, MB100 = 104857600;

/**
 * @typedef {{ readonly standard: number, readonly alpha: number, readonly protective: number, readonly key: string }} BoundRow
 * @bound standard, alpha, protective: whole numbers above zero; alpha is never above standard
 * @bound key: the localize key of the member sentence that states a refusal on the row
 */
/** @typedef {{ readonly [name: string]: BoundRow }} KindBounds one kind's rows, by name */
/** @typedef {{ readonly [kind: string]: KindBounds }} BoundTable the rows, by kind and name */
/**
 * @typedef {Object} BoundStatement
 * @property {number} size the size the caller measured
 * @property {number} bound the active figure it was judged against
 * @property {string} key the row's key
 */

/* the light kinds take the standard in Stage 1 (K4834) */
/** @type {readonly string[]} */
const LIGHT_KINDS = Object.freeze(["text", "csv", "tsv", "json", "xml"]);

/** @param {number} standard @param {number} alpha @param {number} protective @param {string} key @returns {BoundRow} */
const row = (standard, alpha, protective, key) => ({ standard, alpha, protective, key });
/* a byte row of a heavy kind: the standard is K4628 per kind (K4845): documents 100 MB, spreadsheets and images 50 MB; where the alpha is above it, the alpha */
/** @param {number} alpha @param {string} key @param {number} perKind @returns {BoundRow} */
const bytes = (alpha, key, perKind) => row(Math.max(alpha, perKind), alpha, Math.max(alpha, perKind), key);
/* a count or size with one figure for all three columns */
/** @param {number} n @param {string} key @returns {BoundRow} */
const same = (n, key) => row(n, n, n, key);
/** @param {string} kind @param {string} name @returns {string} */
const k = (kind, name) => `limit.${kind}.${name}`;

/** @param {string} kind @param {number} alphaBytes @returns {BoundRow} */
const lightBytes = (kind, alphaBytes) => row(MB50, alphaBytes, MB50, k(kind, "bytes"));
/** @param {string} kind @returns {BoundRow} */
const lightRows = (kind) => row(1048576, 1048576, 1048576, k(kind, "rows"));
/** @param {string} kind @param {number} alphaBytes @returns {KindBounds} */
const light = (kind, alphaBytes) => ({ bytes: lightBytes(kind, alphaBytes), rows: lightRows(kind) });

/** @type {BoundTable} */
const TABLE = {
  /* request_bytes: the most of a stored text, office or HTML document (any kind but a PDF) a member's request reads inline; above it the reading is deferred to the ledger, never refused (K4916) */
  text: { bytes: lightBytes("text", 24 * MiB), rows: lightRows("text"), request_bytes: same(3 * MiB, k("text", "request_bytes")) },
  csv: light("csv", 17 * MiB),
  tsv: light("tsv", 24 * MiB),
  json: light("json", 24 * MiB),
  xml: { bytes: lightBytes("xml", 24 * MiB), rows: lightRows("xml"), tag: same(64 * KiB, k("xml", "tag")) },
  archive: {
    uploaded_bytes: row(524288000, 256 * MiB, 524288000, k("archive", "uploaded_bytes")),
    unpacked_bytes: row(2 * GiB, 256 * MiB, 2 * GiB, k("archive", "unpacked_bytes")),
    depth: same(3, k("archive", "depth")),
    ratio: same(1100, k("archive", "ratio")),
    members: same(10000, k("archive", "members")),
    directory: same(16 * MiB, k("archive", "directory")),
    name: same(4096, k("archive", "name")),
    /* a member's bytes: the ooxml reader's own figure (OOXML R30 `MEMBER_MAX`, K4857) */
    member_bytes: row(2 * GiB, 256 * MiB, 2 * GiB, k("archive", "member_bytes")),
  },
  pdf: {
    bytes: bytes(24 * MiB, k("pdf", "bytes"), MB100),
    worker_bytes: bytes(64 * MiB, k("pdf", "worker_bytes"), MB100),
    need_mb: same(100, k("pdf", "need_mb")),
    page_content: same(64 * MiB, k("pdf", "page_content")),
    /* 32 MiB: 16 MiB refused a real govinfo file's 18.55 MiB object stream (K4862) */
    object_stream: same(32 * MiB, k("pdf", "object_stream")),
    cmap: same(MiB, k("pdf", "cmap")),
    embedded_file: same(64 * MiB, k("pdf", "embedded_file")),
    objects: same(2000000, k("pdf", "objects")),
    direct_object: same(4 * MiB, k("pdf", "direct_object")),
    operands: same(65536, k("pdf", "operands")),
    tree_depth: same(256, k("pdf", "tree_depth")),
    bfrange_codes: same(65536, k("pdf", "bfrange_codes")),
    xmp: same(2 * MiB, k("pdf", "xmp")),
    /* the most of a PDF one member request reads; above it the work is owed to the ledger, never refused (K4901) */
    request_bytes: same(2 * MiB, k("pdf", "request_bytes")),
  },
  image: {
    pixels: same(120000000, k("image", "pixels")),
    edge: same(65535, k("image", "edge")),
    chunks: same(65536, k("image", "chunks")),
    row_stride: same(8 * MiB, k("image", "row_stride")),
    cover_bytes: bytes(32 * MiB, k("image", "cover_bytes"), MB50),
    picture_frame: same(4096 * 3072 * 3, k("image", "picture_frame")),
    /* the figures the image jobs already hold (K4858, K4859) */
    working_set: same(61300000, k("image", "working_set")),
    retained_objects: same(250000, k("image", "retained_objects")),
    picture_source: same(603979776, k("image", "picture_source")),
    /* pixels of the rows route: 16384 x 12288, today's photo ceiling (K4862) */
    rows_pixels: same(201326592, k("image", "rows_pixels")),
  },
  ocr: {
    frame_bytes: bytes(61300000, k("ocr", "frame_bytes"), MB50),
    picture_edge: same(4096, k("ocr", "picture_edge")),
  },
  render: {
    safe_view_bytes: same(32 * MiB, k("render", "safe_view_bytes")),
    safe_view_pages: same(500, k("render", "safe_view_pages")),
    /* the serialised-DOM bound capture-sources' `renderBlock` takes as `domBound.bound`: 25 MiB, BOB's protective figure (K4831 (8)) */
    dom_bytes: same(25 * MiB, k("render", "dom_bytes")),
  },
  /* the acquisition module's ceilings (K4882): `MULTIPART_KEEP_MAX` and `PROFILE_TEXT_MAX`, today's figures in all three columns */
  capture: {
    keep_bytes: same(32 * MiB, k("capture", "keep_bytes")),
    profile_text_bytes: same(8 * MiB, k("capture", "profile_text_bytes")),
  },
  document: {
    clean_bytes: bytes(16 * MiB, k("document", "clean_bytes"), MB100),
    /* a part of a document: standard 100 MB, the alpha and the protective figure 32 MiB (K4860) */
    part_bytes: row(MB100, 32 * MiB, 32 * MiB, k("document", "part_bytes")),
  },
  file_safety: {
    grade_read: bytes(20 * MiB, k("file_safety", "grade_read"), MB100),
    /* the declared size of an OpenDocument sheet's content.xml above which no preview is drawn: file-safety's SAFE_VIEW_ODS_DECLARED_MAX, today's figure (K4893) */
    ods_declared: same(8 * MiB, k("file_safety", "ods_declared")),
  },
  /* the content module's ceilings, today's figures (K4916): `held_text_chars` a count of characters, `kind_scan_pages` a count of pages of units */
  content: {
    held_text_chars: same(32 * MiB, k("content", "held_text_chars")),
    kind_scan_pages: same(16, k("content", "kind_scan_pages")),
  },
  /* the calculations module's read ceilings, today's figures (K4922): `TABLE_MAX_BYTES` (20 MiB of canonical CSV) and `TABLE_MAX_CELLS` (a count) */
  table: {
    bytes: same(20 * MiB, k("table", "bytes")),
    cells: same(1000000, k("table", "cells")),
  },
  /* the ceilings the reading modules keep beside acquisition's, today's figures in all three columns (R35; K4958): no bound moves (K1881) */
  provenance: { part_verify_bytes: same(8 * MiB, k("provenance", "part_verify_bytes")) },
  acquisition: {
    odf_digest_bytes: same(8 * MiB, k("acquisition", "odf_digest_bytes")),
    large_fetch_bytes: same(8 * MiB, k("acquisition", "large_fetch_bytes")),
  },
  case: { copy_now_bytes: same(2 * MiB, k("case", "copy_now_bytes")) },
  monitoring: { docket_read_bytes: same(8 * MiB, k("monitoring", "docket_read_bytes")) },
  following: { portal_parse_bytes: same(4 * MiB, k("following", "portal_parse_bytes")) },
  office: {
    entries: same(100000, k("office", "entries")),
    retained_objects: same(250000, k("office", "retained_objects")),
    /* the ooxml reader's text figures: ooxml R6 `MEASURED_OOXML_TEXT_BOUND_BYTES`, R35 `STREAMED_TEXT_BOUND_BYTES` (K4857) */
    text_bytes: row(MB100, 20 * MiB, MB100, k("office", "text_bytes")),
    streamed_text_bytes: row(MB100, 32 * MiB, MB100, k("office", "streamed_text_bytes")),
    /* a count of characters, not bytes (K4858) */
    decoded_chars: same(64 * MiB, k("office", "decoded_chars")),
    /* protective (K4859) */
    structural_part_bytes: same(8 * MiB, k("office", "structural_part_bytes")),
    piece_chars: same(8 * MiB, k("office", "piece_chars")),
  },
  /* the file scanner's ceilings (K4858); `time_ms` is milliseconds, `partitions` and `icons_pe` counts */
  scan: {
    max_bytes: row(524288000, 256 * MiB, 524288000, k("scan", "max_bytes")),
    time_ms: same(900000, k("scan", "time_ms")),
    embedded_pe: same(40 * MiB, k("scan", "embedded_pe")),
    html_normalize: same(40 * MiB, k("scan", "html_normalize")),
    script_normalize: same(20 * MiB, k("scan", "script_normalize")),
    zip_type_rcg: same(MiB, k("scan", "zip_type_rcg")),
    partitions: same(50, k("scan", "partitions")),
    icons_pe: same(100, k("scan", "icons_pe")),
  },
  sheet: {
    columns: same(16384, k("sheet", "columns")),
    cell_chars: same(32767, k("sheet", "cell_chars")),
    cell_kept_chars: same(MiB, k("sheet", "cell_kept_chars")),
    sheets: same(1000, k("sheet", "sheets")),
  },
  xlsx: { declared_text: bytes(32 * MiB, k("xlsx", "declared_text"), MB50) },
  ods: {
    content_xml: bytes(20 * MiB, k("ods", "content_xml"), MB50),
    repeat_units: same(262144, k("ods", "repeat_units")),
  },
  /* the analysis workbook: its add holds up to 250,000 cells once the workbook-add job merges (K4831 (10)); the file 20 MiB;
   * the cells' JSON 64 MiB, a protective figure from the capped-child measure (K4831 (8)) */
  workbook: {
    cells: same(250000, k("workbook", "cells")),
    bytes: bytes(20 * MiB, k("workbook", "bytes"), MB50),
    cells_json_bytes: same(64 * MiB, k("workbook", "cells_json_bytes")),
  },
  sheet_worker: {
    cells: same(250000, k("sheet_worker", "cells")),
    bytes: bytes(9000000, k("sheet_worker", "bytes"), MB50),
    ms: same(120000, k("sheet_worker", "ms")),
  },
};

/** @param {BoundTable} t @returns {BoundTable} */
const deepFreeze = (t) => {
  for (const names of Object.values(t)) { for (const r of Object.values(names)) Object.freeze(r); Object.freeze(names); }
  Object.freeze(t);
  return t;
};

/** @type {BoundTable} */
export const READ_BOUNDS = deepFreeze(TABLE);

/** @param {string} kind @param {string} name @returns {BoundRow} */
const rowOf = (kind, name) => {
  const names = Object.hasOwn(READ_BOUNDS, kind) ? READ_BOUNDS[kind] : undefined;
  const r = names && Object.hasOwn(names, name) ? names[name] : null;
  if (!r) throw new Error(`READ_BOUNDS has no row for kind ${String(kind)}, name ${String(name)}`);
  return r;
};

/* the ACTIVE figure: the alpha, except the light kinds, which take the standard (K4834) */
/**
 * @param {string} kind
 * @param {string} name
 * @returns {number}
 * @throws {Error} naming the kind and the name, when no such row exists
 */
export const boundOf = (kind, name) => {
  const r = rowOf(kind, name);
  return LIGHT_KINDS.includes(kind) ? r.standard : r.alpha;
};

/* the size the caller measured, the figure it was judged against and the member sentence's key */
/**
 * @param {string} kind
 * @param {string} name
 * @param {number} size
 * @returns {BoundStatement}
 * @throws {Error} naming the kind and the name, when no such row exists
 */
export const statement = (kind, name, size) => ({ size, bound: boundOf(kind, name), key: rowOf(kind, name).key });

/* the row that is a document's whole-read ceiling by its kind (K4965): pdf, csv and text each their own `bytes`, any other kind or none the whole-load row `pdf.bytes` */
/**
 * @param {unknown} [kind] a document's kind
 * @returns {[string, string]} the row's kind and name
 */
export const wholeReadRow = (kind) => (kind === "csv" || kind === "text" ? [kind, "bytes"] : ["pdf", "bytes"]);
