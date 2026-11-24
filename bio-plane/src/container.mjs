/* DEC-34's remaining half: the published case CONTAINER, serialised.
 *
 * REC-14 built the MANIFEST (`bio-case-container/1`) and put a `layout` block in
 * it "so REC-22 has a shape to build against rather than one to invent". This
 * module is the other end of that sentence: it reads the layout and writes the
 * zip. The manifest told us how; nothing here decides anything the manifest did
 * not already say.
 *
 * WHY STORE MODE (compression method 0) AND NOT DEFLATE. Three reasons, in
 * order of weight:
 *
 *   1. DETERMINISM IS THE PRODUCT. The container is served BY HASH, so two
 *      calls must produce byte-identical bytes or the hash a reader checks is
 *      not the hash they get. `CompressionStream("deflate-raw")` gives no
 *      guarantee of a stable encoding across runtime versions -- the output is
 *      valid, not fixed -- so compressing would make the container's identity
 *      depend on the workerd build that served it. Stored entries have exactly
 *      one encoding of a given byte string.
 *   2. THE PARTS ARE ALREADY COMPRESSED. A published case's bulk is captured
 *      PDFs and images; deflating them buys single-digit percentages.
 *   3. NO DEPENDENCY, and the same finding class that let ooxml.mjs read
 *      containers with zero dependencies (MEASUREMENTS 2026-08-03).
 *
 * The CRC-32 comes from `ooxml.mjs` -- the plane's one implementation, already
 * measured against real containers -- so what this module WRITES and what
 * `readContainer`/`readPart` READ agree by construction rather than by
 * agreement. That is also the strongest assertion of public-read's R6 tests
 * (`worker.test.mjs`, `convert-publishedcase.test.mjs` block 4): the zip is read
 * back through the plane's own reader, which verifies every member's length AND
 * its CRC against the central directory before handing the bytes over.
 *
 * TAMPER-EVIDENT, NEVER TAMPER-PROOF (DEC-34, and the record must never claim
 * otherwise): nothing here encrypts, locks or write-protects anything. What
 * protects the container is that MANIFEST.json names every part by sha256, the
 * manifest itself answers by its own sha256 at op=publishedbytes, and the
 * signature covers the bundle sha. A modified copy is not prevented; it is
 * DETECTABLE by anyone holding it, without this instance's cooperation.
 */

import { crc32 } from "./ooxml.mjs";
import { localize } from "./setup-words/index.mjs";

/* The bound is on the SERIALISED container, and it is a refusal rather than a
   truncation: a container that came back short would be a container whose
   manifest does not describe it, which is the one thing this artifact may never
   be. 64 MiB is a CHOSEN constant and not a measurement -- it is the point at
   which buffering the whole archive in a Worker's memory stops being obviously
   safe -- and a case that exceeds it is STATED as too large with its own size,
   never silently reduced. */
export const CONTAINER_MAX_BYTES = 64 * 1024 * 1024;

const enc = new TextEncoder();

/* A ZIP entry's date/time is fixed at the epoch of the DOS timestamp
   (1980-01-01T00:00:00), never `new Date()`. A serving clock in the bytes would
   change the container's hash on every request, which would defeat serving it
   by hash -- the same reason nothing else in this file reads a clock. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1980-01-01

function u16(v) { return [v & 0xff, (v >>> 8) & 0xff]; }
function u32(v) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

/** Where each part lands inside the archive, read from the manifest's own
 *  `layout` block. `root` is the directory the parts sit under and `manifest_at`
 *  is relative to the archive root, which is what "the zip carries every part at
 *  its own path with this manifest at the root" says. A manifest that carries no
 *  layout gets the format's default rather than an invention, and the default is
 *  the one REC-14 wrote. */
export function layoutOf(manifest) {
  const l = (manifest && typeof manifest.layout === "object" && manifest.layout) || {};
  /* public-read R6: a case file's part carries its files at their paths under the part's own root (`root: ""`, its
     `caseFilePartLayout`); a container's manifest names its root, or gets the format's default. */
  const root = typeof l.root === "string" ? l.root : `${manifest?.case || "case"}/`;
  return {
    root: root === "" || root.endsWith("/") ? root : root + "/",
    manifestAt: typeof l.manifest_at === "string" && l.manifest_at ? l.manifest_at : "MANIFEST.json",
    partsAt: typeof l.parts_at === "string" ? l.parts_at : "path",
  };
}

/** Serialise a container.
 *
 *  `entries` is `[{ name, bytes }]` in the order they should appear. The caller
 *  supplies the order deliberately: this function does not sort, because "which
 *  order" is part of what makes the bytes reproducible and the ONE place that
 *  decides it should be the ONE place that knows the manifest.
 *
 *  Returns `{ ok: true, bytes }`, or `{ ok: false, reason, ... }` with a NAMED
 *  reason -- `CONTAINER_TOO_LARGE` for a container over the bound (D-561: it was
 *  `TOO_LARGE`, a code the plane mints for other conditions too), `DUPLICATE_PATH` for
 *  two parts claiming one path (which would make the archive say two things
 *  about one name and let a reader resolve it either way). Never throws on bad
 *  input, never returns a partial archive presented as whole.
 */
export function serialiseContainer(entries, { maxBytes = CONTAINER_MAX_BYTES } = {}) {
  const seen = new Set();
  let total = 0;
  for (const e of entries) {
    if (seen.has(e.name)) {
      /* DEC-49 REGION is-duplicate-path
       * D-561 (C-98.6): the code a STRING LITERAL; its translation is attached by the control plane's
       * `json()` (`dec49Attach`, by code), since this module is pure and reads no catalogue. */
      return { ok: false, reason: "DUPLICATE_PATH", path: e.name,
               detail: localize("public-read.container.two_parts_in_this_container", "two parts in this container claim one path, so an archive of it would say two things about one name. Each part is still answerable individually by hash.") };
      /* END DEC-49 REGION is-duplicate-path */
    }
    seen.add(e.name);
    total += e.bytes.length + enc.encode(e.name).length * 2 + 76; // payload + both headers
  }
  if (total > maxBytes) {
    /* DEC-49 REGION is-container-too-large
     * D-561 (C-98.7): `CONTAINER_TOO_LARGE`, renamed from `TOO_LARGE` — that code is minted elsewhere
     * in the plane for other conditions, so a row under it would put this sentence on theirs. */
    return { ok: false, reason: "CONTAINER_TOO_LARGE", bytes: total, maxBytes,
             detail: localize("public-read.container.this_container_is_larger_than", "this container is larger than the plane will serialise in one response. Its parts remain individually answerable by hash at op=publishedbytes, which is the same material by the same mechanism.") };
    /* END DEC-49 REGION is-container-too-large */
  }

  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const size = e.bytes.length;
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,      // PK\x03\x04
      ...u16(20),                   // version needed (2.0, store)
      ...u16(0x0800),               // general purpose: UTF-8 names, no data descriptor
      ...u16(0),                    // method 0, stored
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, e.bytes);
    central.push(new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,      // PK\x01\x02
      ...u16(20), ...u16(20),
      ...u16(0x0800), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ]));
    offset += local.length + nameBytes.length + size;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) { chunks.push(c); cdSize += c.length; }
  chunks.push(new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,        // PK\x05\x06
    ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(cdSize), ...u32(cdStart),
    ...u16(0),
  ]));

  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return { ok: true, bytes: out };
}

/** The entry list for a manifest, in the order the container is written:
 *  MANIFEST.json FIRST (a reader who streams the archive meets the description
 *  of it before any described part), then the parts in the manifest's own
 *  `parts[]` order, which is the order they were hashed at ratification.
 *
 *  `read(sha)` hands back the bytes for a part, or null when the object is
 *  missing -- a container that cannot be assembled whole is refused with
 *  `PART_MISSING` naming the part, never returned with a hole in it. */
export async function containerEntries(manifest, manifestBytes, read) {
  const layout = layoutOf(manifest);
  const entries = [{ name: layout.manifestAt, bytes: manifestBytes }];
  for (const part of Array.isArray(manifest?.parts) ? manifest.parts : []) {
    if (!part || typeof part.path !== "string" || typeof part.sha256 !== "string") continue;
    if (part.path === layout.manifestAt) continue;   // the manifest is written once, at the root
    const bytes = await read(part.sha256);
    if (!bytes) {
      /* DEC-49 REGION is-part-missing
       * D-561 (C-98.5): the code a STRING LITERAL; translated by the control plane's `json()` by code. */
      return { ok: false, reason: "PART_MISSING", path: part.path, sha256: part.sha256,
               detail: localize("public-read.container.a_part_named_in_the_manifest", "a part named in the manifest is not in the published object store, so this container cannot be assembled whole. Its other parts are still answerable individually by hash.") };
      /* END DEC-49 REGION is-part-missing */
    }
    entries.push({ name: layout.root + part.path, bytes });
  }
  return { ok: true, entries, layout };
}
