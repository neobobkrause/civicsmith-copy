/* case-carriage over the modules it uses, each the real one (record-core, membership, promotion, provenance from
   provenance's fixture; `sources` and `accepted-work` made on the same host), on a real SQLite database (node:sqlite)
   standing in for a Durable Object's storage, never publication's fixture, which is later in the order (seam map
   `build/extraction/publication-split-2.md` §5). Extraction's units are a stand-in answering exactly the shape of its
   `unitsOf` (its R36), which the test sets (`w.units`); the knocks `sources` mints its sources from are pulled through a
   stand-in for the doorbell's one keyed read, `pulledKnocksOf` (its R18; `w.knock`); what case-import registers with
   `accepted-work` is a stand-in each test controls (`w.importer`). The case document is written with case-grammar's
   own line builders, as case-authoring writes it. Every test drives `case-carriage` at its interface.
   (T37; R9–R13) A photo is a capture whose bytes are only in the evidence store: record-core's `evidenceStore` (its R38)
   answers a stand-in keyed by digest (`w.evidence`), and the obscured copy is held in a stand-in bucket (`w.bucket`). The
   photos are PNGs built here (`makePng`) and read back by a decoder written here (`decodePng`), independent of
   `image-cover`, so a test checks each covered and uncovered pixel.
   (T38; R8, K2291 (2)) What an archive holds is read from acquisition's record of its listing (`archive_entries`, its
   R38); `w.listing` writes that record as a stand-in with the read contract's columns, as acquisition writes it when it
   first opens an archive (its own row at index -1, one row per entry). */
import { deflateSync, inflateSync } from "node:zlib";
import { world as provenanceWorld, sha, V, provDoc, infoMd, evidence } from "../provenance/fixture.mjs";
import { sourcesOf } from "../../../src/sources/index.mjs";
import { acceptedWorkOf } from "../../../src/accepted-work/index.mjs";
import { materialsLines, acceptedWorkBlockLines, sourceBlockLines } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { caseCarriageOf } from "../../../src/case-carriage/index.mjs";

export { sha, V, provDoc, infoMd };
export const NOW = "2026-09-28T01:00:00Z";

export function world(extra = {}) {
  const w = provenanceWorld({ now: NOW });
  const { host, record, membership, promotion, st } = w;
  /* sources (layer 3) over a stand-in for the doorbell's `pulledKnocksOf` (its R18; since T42-8, not capture's); its
     clock is the world's, in milliseconds. */
  const knocks = [];
  const src = sourcesOf(host, { record, membership, now: () => Date.parse(w.clock.now),
    doorbell: { pulledKnocksOf: (captureSha) => knocks.filter((k) => k.sha256 === captureSha) } });
  const acceptedWork = acceptedWorkOf(host, { record, promotion });
  const units = new Map(), unitCalls = [];
  const extraction = { unitsOf: (s) => { unitCalls.push(s); return units.has(s) ? { capture_sha: s, ...units.get(s) }
                                                                               : { capture_sha: s, units: [], state: null }; } };
  /* R11: record-core's evidence store over a stand-in keyed by digest (the instance was built without a bucket), and
     the bucket the copy is held in */
  const ev = evidence();
  record.evidenceStore = () => ({ head: (d) => ev.head(String(d)), get: (d) => ev.get(String(d)),
                                  put: (d, b) => ev.put(String(d), b) });
  const bucket = bucketStandIn();
  const cc = caseCarriageOf(host, { record, membership, promotion, sources: src, acceptedWork, extraction,
                                    now: () => w.clock.now, bucket, store: "bio", provenance: w.prov, ...extra });
  let n = 0, r = 0;
  return Object.assign(w, {
    src, acceptedWork, units, unitCalls, cc, evidence: ev, bucket,
    /** (T39; R15) a receipt for `captureSha` through provenance (its R13), `via` default `direct`: a capture this copy
     *  fetched (its R62); `doorbell` a pulled knock; `unpacked` with `locator` a file cut from an archive. */
    receipt(captureSha, via = "direct", locator = null) {
      return w.prov.recordReceipt({ addressNorm: `e.org/r${++r}`, captureSha, retrieved: NOW, via, retrievalLocator: locator });
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    /** A knock pulled into the capture `captureSha` (doorbell R13), and its source minted as `sources` R1 mints it. */
    knock(captureSha, { knockId = `KNOCK-${knocks.length + 1}`, pseudonym = null, received = NOW, viewer = V("olive") } = {}) {
      knocks.push({ knock_id: knockId, sha256: captureSha, bytes: 10, received, pseudonym,
                    knocker_digest: pseudonym ? `d-${pseudonym}` : null });
      const r = src.sourceOf({ captureSha, viewer });
      if (!r.ok) throw new Error(`fixture knock refused: ${JSON.stringify(r)}`);
      return [...st.sql.exec(`SELECT source_id FROM source_knocks WHERE knock_id=?`, knockId)][0].source_id;
    },
    /** A document (an information bundle) whose one capture is `text`, held inline; `files` added beside it, and
     *  `prov` extra fields on its provenance document. (T39) Fetched by this copy (a `direct` receipt, provenance R62)
     *  unless `fetched` is false, so it is carried as captured. */
    doc(id, { text = `the text of ${id}`, files = [], prov = {}, fetched = true } = {}) {
      const path = `snapshots/${id}.txt`;
      const res = promotion.promote({ bundleId: id, base: null, snapKey: `cc${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path, text }, ...files,
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc({ path, text }, prov)] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: sha(text), path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
      if (!res.ok) throw new Error(`fixture doc refused: ${JSON.stringify(res).slice(0, 400)}`);
      if (fetched) w.receipt(sha(text));
      return sha(text);
    },
    /** A member's firsthand observation, through provenance's `testify`: `{id, sha, text}`. */
    observe(author, words = `I saw it, ${author}.`) {
      const r = w.prov.testify({ words, observedAt: "2026-09-27", title: `Observation by ${author}`, author });
      if (!r.ok) throw new Error(`fixture testify refused: ${JSON.stringify(r).slice(0, 400)}`);
      const reg = w.row(`SELECT capture_sha, path FROM register WHERE bundle_id=?`, r.bundle_id);
      return { id: r.bundle_id, sha: reg.capture_sha, text: record.readFile(r.bundle_id, reg.path).text };
    },
    /** case-import's registration with accepted-work, as a stand-in: `state.finding`, `state.openFlags` and (T46; R19)
     *  `state.withdrawals` decide each answer (no withdrawals: an empty history); (T47; R19) `state.flagHistory` the flags'
     *  history (accepted-work R9; none given: the flags open now, as when none was cleared; `null`: none registered);
     *  every read is recorded in the answered list. */
    importer(state) {
      const calls = [];
      const r = acceptedWork.registerAcceptedWork("case-import", {
        finding: (a) => { calls.push(["finding", a]); return state.finding ? state.finding(a) : null; },
        openFlags: (a) => { calls.push(["openFlags", a]); return state.openFlags ? state.openFlags(a) : null; },
        withdrawals: (a) => { calls.push(["withdrawals", a]);
                              return state.withdrawals ? state.withdrawals(a) : { withdrawals: [], cursor: null }; },
        ...(state.flagHistory === null ? {} : { flagHistory: (a) => { calls.push(["flagHistory", a]);
          return state.flagHistory ? state.flagHistory(a) : state.openFlags ? state.openFlags(a) : { flags: [], complete: true }; } }) });
      if (!r.ok) throw new Error(`fixture registration refused: ${JSON.stringify(r)}`);
      return calls;
    },
    /** (T41; D54, K2408) A project bundle, created as promotion creates one (membership R71): `owner` its sole owner,
     *  `visibility` its first setting (none recorded is `hidden`, membership R45). */
    project(id, { owner = "olive", visibility = null } = {}) {
      const md = `---\nid: ${id}\nobject_type: project\n---\n`;
      record.transact(() => record.commit({ bundleId: id, type: "project", title: `Project ${id}`, project: null,
        snapKey: id, kind: "promotion", base: "", author: V(owner), writer: null, operation: null,
        files: [{ path: "bundle.md", text: md, sha256: sha(md), bytes: Buffer.byteLength(md) }],
        state: "active", priorState: null, group: "test-group", created: NOW, lastUpdated: NOW, criticality: null, at: NOW }));
      const made = membership.projectCreated({ projectId: id, ownerId: owner, visibility, by: owner });
      if (!made.ok) throw new Error(`fixture project refused: ${JSON.stringify(made)}`);
      return id;
    },
    /** Fence a bundle inside a project (record-core R34's `project`, which membership R43 fences by). A project id no
     *  project was made under has no participant and no setting, so it is hidden: since D54 (K2408) no viewer but a
     *  machine sees the bundle, the founder's included. */
    fence: (bundleId, projectId) => st.sql.exec(`UPDATE bundles SET project = ? WHERE bundle_id = ?`, projectId, bundleId),
    tables: () => w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).map((r) => r.name),
    /** acquisition's record of an archive's listing (its R38), as a stand-in: `entries` `[{name, kind?, state?, sha256?}]`
     *  in index order (`kind` default `file`, `state` `filed` when a digest is given, else `waiting`), or the names of
     *  `zip`'s entries when `entries` is a ZIP's bytes. */
    listing(archiveSha, entries) {
      const list = Buffer.isBuffer(entries) || entries instanceof Uint8Array ? zipNames(entries).map((name) => ({ name })) : entries;
      st.sql.exec(`CREATE TABLE IF NOT EXISTS archive_entries (archive_sha TEXT NOT NULL, idx INTEGER NOT NULL, name TEXT, kind TEXT,
                   state TEXT NOT NULL, sha256 TEXT, PRIMARY KEY (archive_sha, idx))`);
      st.sql.exec(`INSERT OR IGNORE INTO archive_entries (archive_sha, idx, state) VALUES (?, -1, 'opened')`, archiveSha);
      list.forEach((e, i) => st.sql.exec(`INSERT OR REPLACE INTO archive_entries (archive_sha, idx, name, kind, state, sha256) VALUES (?,?,?,?,?,?)`,
        archiveSha, i, e.name ?? null, e.kind ?? "file", e.state ?? (e.sha256 ? "filed" : "waiting"), e.sha256 ?? null));
    },
    /** A photo: an information bundle whose capture `bytes` is held only in the evidence store, registered at
     *  `snapshots/<name>`, its home's provenance recording `contentType` (none when null). Answers its digest. */
    photo(id, bytes, { name = "photo.png", contentType = "image/png", inEvidence = true } = {}) {
      const b = Buffer.from(bytes), s = sha(b);
      w.doc(id, { text: `the page about ${id}` });
      const path = `snapshots/${name}`;
      st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, ?, 'binary', ?, ?)`,
                  s, id, path, b.length, NOW);
      st.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?, ?, NULL, ?, ?, ?)`, id, path, s, b.length, s);
      const capture = { method: "acquire", grade: "B", sha256: s, encoding: "binary", bytes: b.length,
                        ...(contentType ? { content_type: contentType } : {}) };
      st.sql.exec(`UPDATE files SET content=? WHERE bundle_id=? AND path='data/provenance.json'`,
                  JSON.stringify({ documents: [{ file: path, capture }] }), id);
      if (inEvidence) ev.held.set(s, b);
      return s;
    },
  });
}

/** A document a member supplied: its bytes only in the evidence store, registered on its own bundle as a PDF, its
 *  home's provenance recording its type; `via` the receipt it arrives by (null: none, a capture with no receipt).
 *  Answers its digest. */
export function supplied(w, id, bytes, { via = "doorbell", name = "file.pdf", type = "application/pdf", stated = null } = {}) {
  const b = Buffer.from(bytes), s = sha(b);
  w.doc(id, { text: `the page about ${id}` });
  const path = `snapshots/${name}`;
  w.st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, ?, 'binary', ?, ?)`,
                s, id, path, stated ?? b.length, NOW);
  w.st.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?, ?, NULL, ?, ?, ?)`, id, path, s, b.length, s);
  w.st.sql.exec(`UPDATE files SET content=? WHERE bundle_id=? AND path='data/provenance.json'`,
    JSON.stringify({ documents: [{ file: path, capture: { method: "acquire", sha256: s, encoding: "binary", bytes: b.length, content_type: type } }] }), id);
  w.evidence.held.set(s, b);
  if (via) w.receipt(s, via);
  return s;
}

/** The names of a ZIP's entries, read from its central directory as its end record locates it (so an archive stored
 *  inside it, uncompressed, is not mistaken for its own entries). */
export function zipNames(zip) {
  const z = Buffer.from(zip), out = [];
  const end = z.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let o = z.readUInt32LE(end + 16);
  for (let n = z.readUInt16LE(end + 10); n > 0; n--) {
    const len = z.readUInt16LE(o + 28);
    out.push(z.toString("utf8", o + 46, o + 46 + len));
    o += 46 + len + z.readUInt16LE(o + 30) + z.readUInt16LE(o + 32);
  }
  return out;
}

/** A bucket stand-in: `put(key, bytes, opts)` keeps the bytes and the options; `get(key)` answers them. */
export function bucketStandIn() {
  const held = new Map(), calls = [];
  return {
    held, calls,
    async put(k, bytes, opts = {}) { calls.push(["put", k]); held.set(k, { bytes: Buffer.from(bytes), opts }); return { key: k }; },
    async get(k) { calls.push(["get", k]); const o = held.get(k); return o ? { arrayBuffer: async () => o.bytes, ...o.opts } : null; },
    async head(k) { calls.push(["head", k]); const o = held.get(k); return o ? { size: o.bytes.length } : null; },
  };
}

/* PNG, written and read here (8-bit RGB, not interlaced). */
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type, "latin1"), len = Buffer.alloc(4), c = Buffer.alloc(4);
  len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
};
/** An RGB PNG of `width` x `height` whose pixel (x, y) is `px(x, y)` → [r, g, b] (default a gradient, never black). */
export function makePng(width, height, px = (x, y) => [40 + (x * 7) % 200, 40 + (y * 11) % 200, 120]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) { const [r, g, b] = px(x, y); raw.set([r, g, b], y * (width * 3 + 1) + 1 + x * 3); }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr),
                        chunk("tEXt", Buffer.from("Comment\u0000taken by a member", "latin1")),
                        chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/** Decode an 8-bit, non-interlaced PNG of colour type 0, 2, 4 or 6 (or 3 with its palette): `{width, height, at(x, y)
 *  → [r, g, b], chunks}`. */
export function decodePng(buf) {
  const b = Buffer.from(buf);
  let o = 8, width = 0, height = 0, type = 0, palette = null;
  const idat = [], chunks = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), t = b.toString("latin1", o + 4, o + 8), data = b.subarray(o + 8, o + 8 + len);
    chunks.push(t);
    if (t === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9];
                        if (data[8] !== 8 || data[12] !== 0) throw new Error("decodePng: 8-bit, non-interlaced only"); }
    else if (t === "PLTE") palette = data;
    else if (t === "IDAT") idat.push(data);
    o += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const stride = width * ch, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0, up = y ? out[(y - 1) * stride + i] : 0;
      const c = i >= ch && y ? out[(y - 1) * stride + i - ch] : 0;
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f];
      out[y * stride + i] = (line[i] + pred) & 0xff;
    }
  }
  const at = (x, y) => {
    const i = y * stride + x * ch;
    if (type === 3) return [...palette.subarray(out[i] * 3, out[i] * 3 + 3)];
    return ch >= 3 ? [out[i], out[i + 1], out[i + 2]] : [out[i], out[i], out[i]];
  };
  return { width, height, at, chunks };
}

/** A `/6` case document's text, its blocks written with case-grammar's line builders: `materials` (R12 rows),
 *  `acceptedWork` and `acceptedWorkFlags` (R16), `sources` (R1). */
export function caseText({ caseId = "CASE-2026-0001", edition = 1, format = "bio-case-document/6", materials = [],
                           acceptedWork = null, acceptedWorkFlags = null, sources = null } = {}) {
  return ["---", `format: ${format}`, `case_id: ${caseId}`, `case_edition: ${edition}`,
    ...(sources ? sourceBlockLines(sources) : []),
    ...materialsLines(materials),
    ...(acceptedWork || acceptedWorkFlags ? acceptedWorkBlockLines({ rows: acceptedWork || [], flags: acceptedWorkFlags || [] }) : []),
    "---", "", "## Scope", "", "The question.", ""].join("\n");
}

/** The front matter of `caseText(opts)`, as the commit hands it on. */
export const caseFm = (opts) => parseFrontmatter(caseText(opts)).data;
