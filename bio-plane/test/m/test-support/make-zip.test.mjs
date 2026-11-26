/* test-support R10–R14: `makeZip`, `zipBomb` and `nestedZip`
 * (bio-plane/test/make-zip.mjs), tested at the interface. Each test names the
 * requirement id it checks in its title.
 *
 * Every archive is read back by readers that share nothing with the writer:
 * Python's `struct` for the bytes each record states, Python's `zipfile` and
 * Info-ZIP's `unzip -t` as the oracles (K1844). A host lacking either oracle
 * skips the checks that need it, by name, rather than passing them. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { makeZip, zipBomb, nestedZip } from "../../make-zip.mjs";
/** @import { ZipEntry, ZipOptions, ByteSource, RecordOverride, DescriptorOverride } from "../../make-zip.mjs" */

const MAKE_ZIP_URL = new URL("../../make-zip.mjs", import.meta.url).href;
/** @param {string} cmd @param {string[]} args @returns {boolean} */
const has = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8" }); return !r.error && r.status === 0; };
const HAS_PYTHON = has("python3", ["-I", "-c", "import zipfile, struct, zlib"]);
const HAS_UNZIP = has("unzip", ["-v"]);
const NO_PYTHON = !HAS_PYTHON && "Python 3's zipfile is absent on this host";
const NO_ORACLES = (!HAS_PYTHON || !HAS_UNZIP) && `absent on this host: ${[!HAS_PYTHON && "python3", !HAS_UNZIP && "unzip"].filter(Boolean).join(", ")}`;

/* The independent reader. `parse` reports every record by the bytes it states:
   each end-record candidate, ZIP64's locator and end record, the central
   directory walked from where the end record (or ZIP64's) says it starts, and
   the local header, data and data descriptor each central record points at,
   with the data inflated by Python's zlib and its CRC-32 by binascii.
   `zipfile` reports what Python's zipfile reads; `tree` recurses into members
   that are archives themselves. */
const PY = String.raw`
import sys, json, struct, zlib, binascii, zipfile, io, warnings, hashlib
warnings.simplefilter("ignore")
mode = sys.argv[1]
b = sys.stdin.buffer.read()
def u(fmt, off): return struct.unpack_from("<" + fmt, b, off)
def extras(raw):
    out, i = [], 0
    while i + 4 <= len(raw):
        hid, n = struct.unpack_from("<HH", raw, i)
        out.append({"id": hid, "hex": raw[i + 4:i + 4 + n].hex()})
        i += 4 + n
    return out
def parse():
    out = {"length": len(b), "eocds": []}
    i = b.rfind(b"PK\x05\x06")
    while i >= 0:
        if i + 22 <= len(b):
            _, disk, cddisk, de, en, cs, co, cl = u("IHHHHIIH", i)
            out["eocds"].append(dict(offset=i, disk=disk, cdDisk=cddisk, diskEntries=de, entries=en, cdSize=cs, cdOffset=co, commentLength=cl, comment=b[i + 22:i + 22 + cl].hex()))
        i = b.rfind(b"PK\x05\x06", 0, i)
    out["eocds"].sort(key=lambda e: e["offset"])
    eocd = [e for e in out["eocds"] if e["offset"] + 22 + e["commentLength"] == len(b)][0]
    cdoff = eocd["cdOffset"]
    lo = eocd["offset"] - 20
    if lo >= 0 and b[lo:lo + 4] == b"PK\x06\x07":
        _, disk, roff, disks = u("IIQI", lo)
        out["locator"] = dict(offset=lo, disk=disk, recordOffset=roff, disks=disks)
        sig, size, vm, vn, d1, d2, de, en, cs, co = u("IQHHIIQQQQ", roff)
        out["zip64Record"] = dict(offset=roff, signature=sig, size=size, versionMadeBy=vm, versionNeeded=vn, disk=d1, cdDisk=d2, diskEntries=de, entries=en, cdSize=cs, cdOffset=co)
        if cdoff == 0xFFFFFFFF: cdoff = co
    cd, o = [], cdoff
    while o + 46 <= len(b) and b[o:o + 4] == b"PK\x01\x02":
        (_, vm, vn, fl, me, tm, dt, crc, cs, us, nl, el, cl, dk, ia, ea, lof) = u("IHHHHHHIIIHHHHHII", o)
        r = dict(offset=o, versionMadeBy=vm, versionNeeded=vn, flags=fl, method=me, dosTime=tm, dosDate=dt, crc32=crc, compressedSize=cs, uncompressedSize=us, name=b[o + 46:o + 46 + nl].hex(), extra=extras(b[o + 46 + nl:o + 46 + nl + el]), commentLength=cl, disk=dk, internal=ia, external=ea, localOffset=lof)
        csz, usz, off = cs, us, lof
        for e in r["extra"]:
            if e["id"] == 1:
                raw, k = bytes.fromhex(e["hex"]), 0
                if us == 0xFFFFFFFF: usz = struct.unpack_from("<Q", raw, k)[0]; k += 8
                if cs == 0xFFFFFFFF: csz = struct.unpack_from("<Q", raw, k)[0]; k += 8
                if lof == 0xFFFFFFFF: off = struct.unpack_from("<Q", raw, k)[0]; k += 8
        r["resolved"] = dict(compressedSize=csz, uncompressedSize=usz, localOffset=off)
        cd.append(r)
        o += 46 + nl + el + cl
    out["cdOffset"], out["cdEnd"], out["central"] = cdoff, o, cd
    locals_ = {}
    for r in cd:
        off, csz = r["resolved"]["localOffset"], r["resolved"]["compressedSize"]
        if str(off) in locals_ or off + 30 > len(b) or b[off:off + 4] != b"PK\x03\x04": continue
        (_, vn, fl, me, tm, dt, crc, cs, us, nl, el) = u("IHHHHHIIIHH", off)
        d0 = off + 30 + nl + el
        data = b[d0:d0 + csz]
        L = dict(offset=off, versionNeeded=vn, flags=fl, method=me, dosTime=tm, dosDate=dt, crc32=crc, compressedSize=cs, uncompressedSize=us, name=b[off + 30:off + 30 + nl].hex(), extra=extras(b[off + 30 + nl:d0]), dataOffset=d0, data=data.hex() if len(data) <= 65536 else None, dataSha256=hashlib.sha256(data).hexdigest())
        plain = None
        if r["method"] == 0: plain = data
        elif r["method"] == 8 and not r["flags"] & 1:
            try: plain = zlib.decompressobj(-15).decompress(data)
            except Exception: plain = None
        if plain is not None:
            L["plainLength"], L["plainCrc32"] = len(plain), binascii.crc32(plain) & 0xFFFFFFFF
            L["plain"] = plain.hex() if len(plain) <= 65536 else None
            L["plainSha256"] = hashlib.sha256(plain).hexdigest()
        end = d0 + csz
        if fl & 8:
            wide = any(e["id"] == 1 for e in L["extra"])
            d = {"offset": end, "signature": None}
            if b[end:end + 4] == b"PK\x07\x08": d["signature"] = 0x08074B50; end += 4
            d["crc32"] = u("I", end)[0]; end += 4
            f = "Q" if wide else "I"
            d["compressedSize"] = u(f, end)[0]; end += struct.calcsize(f)
            d["uncompressedSize"] = u(f, end)[0]; end += struct.calcsize(f)
            L["descriptor"] = d
        L["end"] = end
        locals_[str(off)] = L
    out["locals"] = locals_
    return out
def zf(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    out = []
    for i in z.infolist():
        try: d, err = z.read(i), None
        except Exception as e: d, err = None, type(e).__name__ + ": " + str(e)
        out.append(dict(name=i.filename, flags=i.flag_bits, method=i.compress_type, size=i.file_size, compressedSize=i.compress_size, crc32=i.CRC, headerOffset=i.header_offset, raw=d, error=err))
    return out, z.comment
if mode == "parse":
    print(json.dumps(parse()))
elif mode == "zipfile":
    es, comment = zf(b)
    for e in es: e["data"] = e.pop("raw").hex() if e["raw"] is not None else None
    print(json.dumps({"entries": es, "comment": comment.hex()}))
elif mode == "tree":
    def tree(data):
        es, _ = zf(data)
        return [dict(name=e["name"], method=e["method"], error=e["error"], children=tree(e["raw"]) if e["name"].endswith(".zip") else None, data=None if e["name"].endswith(".zip") or e["raw"] is None else e["raw"].hex()) for e in es]
    print(json.dumps(tree(b)))
`;

/* What the reader prints, the test's own child's output. */
/**
 * @typedef {Object} Extra
 * @property {number} id
 * @property {string} hex
 */
/**
 * @typedef {Object} Eocd
 * @property {number} offset
 * @property {number} disk
 * @property {number} cdDisk
 * @property {number} diskEntries
 * @property {number} entries
 * @property {number} cdSize
 * @property {number} cdOffset
 * @property {number} commentLength
 * @property {string} comment
 */
/**
 * @typedef {Object} Locator
 * @property {number} offset
 * @property {number} disk
 * @property {number} recordOffset
 * @property {number} disks
 */
/**
 * @typedef {Object} Zip64Rec
 * @property {number} offset
 * @property {number} signature
 * @property {number} size
 * @property {number} versionMadeBy
 * @property {number} versionNeeded
 * @property {number} disk
 * @property {number} cdDisk
 * @property {number} diskEntries
 * @property {number} entries
 * @property {number} cdSize
 * @property {number} cdOffset
 */
/**
 * @typedef {Object} Resolved
 * @property {number} compressedSize
 * @property {number} uncompressedSize
 * @property {number} localOffset
 */
/**
 * @typedef {Object} CentralRec
 * @property {number} offset
 * @property {number} versionMadeBy
 * @property {number} versionNeeded
 * @property {number} flags
 * @property {number} method
 * @property {number} dosTime
 * @property {number} dosDate
 * @property {number} crc32
 * @property {number} compressedSize
 * @property {number} uncompressedSize
 * @property {string} name
 * @property {Extra[]} extra
 * @property {number} commentLength
 * @property {number} disk
 * @property {number} internal
 * @property {number} external
 * @property {number} localOffset
 * @property {Resolved} resolved
 */
/**
 * @typedef {Object} DescriptorRec
 * @property {number} offset
 * @property {number | null} signature
 * @property {number} crc32
 * @property {number} compressedSize
 * @property {number} uncompressedSize
 */
/**
 * @typedef {Object} LocalRec
 * @property {number} offset
 * @property {number} versionNeeded
 * @property {number} flags
 * @property {number} method
 * @property {number} dosTime
 * @property {number} dosDate
 * @property {number} crc32
 * @property {number} compressedSize
 * @property {number} uncompressedSize
 * @property {string} name
 * @property {Extra[]} extra
 * @property {number} dataOffset
 * @property {string | null} data
 * @property {string} dataSha256
 * @property {number} [plainLength]
 * @property {number} [plainCrc32]
 * @property {string | null} [plain]
 * @property {string} [plainSha256]
 * @property {DescriptorRec} [descriptor]
 * @property {number} end
 */
/**
 * @typedef {Object} Parsed
 * @property {number} length
 * @property {Eocd[]} eocds
 * @property {Locator} [locator]
 * @property {Zip64Rec} [zip64Record]
 * @property {number} cdOffset
 * @property {number} cdEnd
 * @property {CentralRec[]} central
 * @property {{ [offset: string]: LocalRec }} locals
 */
/**
 * @typedef {Object} ZfEntry
 * @property {string} name
 * @property {number} flags
 * @property {number} method
 * @property {number} size
 * @property {number} compressedSize
 * @property {number} crc32
 * @property {number} headerOffset
 * @property {string | null} error
 * @property {string | null} data
 */
/**
 * @typedef {Object} ZfOut
 * @property {ZfEntry[]} entries
 * @property {string} comment
 */
/**
 * @typedef {Object} TreeNode
 * @property {string} name
 * @property {number} method
 * @property {string | null} error
 * @property {TreeNode[] | null} children
 * @property {string | null} data
 */

/** @param {"parse" | "zipfile" | "tree"} mode @param {Uint8Array} bytes @returns {unknown} the JSON the child prints */
function py(mode, bytes) {
  const r = spawnSync("python3", ["-I", "-c", PY, mode], { input: Buffer.from(bytes), encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  assert.equal(r.status, 0, `python ${mode}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
/** @param {Uint8Array} z @returns {Parsed} */
const parse = (z) => /** @type {Parsed} decodes its own child's output */ (py("parse", z));
/** @param {Uint8Array} z @returns {ZfOut} */
const readZipfile = (z) => /** @type {ZfOut} decodes its own child's output */ (py("zipfile", z));
/** @param {Uint8Array} z @returns {TreeNode[]} */
const tree = (z) => /** @type {TreeNode[]} decodes its own child's output */ (py("tree", z));

const WORK = mkdtempSync(join(tmpdir(), "make-zip-"));
let files = 0;
/** @param {Uint8Array} bytes @returns {{ status: number | null, out: string }} */
function unzipT(bytes) {
  const f = join(WORK, `a${files++}.zip`);
  writeFileSync(f, bytes);
  const r = spawnSync("unzip", ["-t", f], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

/**
 * What a list or a record holds where the test relies on it; reading a member of what is absent throws a TypeError, so
 * does this.
 * @template T
 * @param {T | undefined} v
 * @param {string} what
 * @returns {T}
 */
function present(v, what) {
  if (v === undefined) throw new TypeError(`${what} is absent`);
  return v;
}
/** @param {ByteSource} v @returns {string} */
const hex = (v) => Buffer.from(typeof v === "string" ? new TextEncoder().encode(v) : v).toString("hex");
/** @param {Uint8Array} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");
/** @param {number} v @param {number} width @returns {string} */
const le = (v, width) => { const b = Buffer.alloc(width); b.writeUIntLE(v, 0, Math.min(width, 6)); return b.toString("hex"); };
/** @param {Parsed} p @param {number} i @returns {LocalRec} */
const local = (p, i) => present(p.locals[String(present(p.central[i], `central record ${i}`).resolved.localOffset)], `the local header of entry ${i}`);
/** @param {Parsed} p @param {number} i @returns {CentralRec} */
const centralAt = (p, i) => present(p.central[i], `central record ${i}`);
/** @param {Parsed} p @param {number} i @returns {Eocd} */
const eocdAt = (p, i) => present(p.eocds[i], `end record candidate ${i}`);
/** @param {Parsed} p @param {number} i @returns {DescriptorRec} */
const descriptorOf = (p, i) => present(local(p, i).descriptor, `the data descriptor of entry ${i}`);
/** Byte offsets where `a` and `b` differ (equal lengths). @param {Uint8Array} a @param {Uint8Array} b @returns {number[]} */
function diff(a, b) {
  assert.equal(a.length, b.length, "the override changed no length");
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}
/** Asserts every differing byte lies in [at, at + width). @param {Uint8Array} a @param {Uint8Array} b @param {number} at @param {number} width @param {string} what @returns {void} */
function onlyIn(a, b, at, width, what) {
  const d = diff(a, b);
  assert.ok(d.length > 0, `${what}: the bytes changed`);
  for (const i of d) assert.ok(i >= at && i < at + width, `${what}: byte ${i} changed outside the field at ${at}..${at + width - 1}`);
}

/* Data with every byte value, a long compressible run and a short string. */
const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
const LONG = "the quick brown fox jumps over the lazy dog. ".repeat(400);
const PSEUDO = (() => { const b = new Uint8Array(1 << 20); let x = 12345; for (let i = 0; i < b.length; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; } return b; })();

/* Conforming specs, each with the bytes each entry's data must give back. */
/** @type {ZipEntry[]} */
const MIXED = [
  { name: "a.txt", data: LONG },
  { name: "stored.bin", data: ALL_BYTES, method: 0 },
  { name: "empty.txt", data: "" },
  { name: "empty-stored", data: new Uint8Array(0), method: 0 },
  { name: "naïve/ü-文.txt", data: "ü文" },
  { name: Uint8Array.from(Buffer.from("raw/bytes.bin")), data: ALL_BYTES },
  { name: "dir/", data: "", method: 0 },
];
/** @type {Array<[string, ZipEntry[]]>} */
const CONFORMING = [
  ["mixed", MIXED],
  ["one entry", [{ name: "only.txt", data: "x" }]],
  ["a megabyte, stored and deflated", [{ name: "big.bin", data: PSEUDO }, { name: "big-stored.bin", data: PSEUDO, method: 0 }]],
  ["300 entries", Array.from({ length: 300 }, /** @param {unknown} _ @param {number} i @returns {ZipEntry} */ (_, i) => ({ name: `n/${i}.txt`, data: `entry ${i}`, method: i % 2 ? 0 : 8 }))],
];
/** @param {ByteSource} d @returns {Uint8Array} */
const bytesOf = (d) => (typeof d === "string" ? new TextEncoder().encode(d) : d);
/** @param {ByteSource} n @returns {Uint8Array} */
const nameBytes = (n) => (typeof n === "string" ? new TextEncoder().encode(n) : n);

/* ------------------------------------------------------------------ R10 */

test("R10 a conforming archive is laid out in APPNOTE 6.3's form: each local header and its data in order, then the central directory, then the end record, with true CRC-32 and sizes, bit 11 exactly for a non-ASCII string name, and one fixed MS-DOS time", { skip: NO_PYTHON }, () => {
  /** @type {Array<[string, ZipEntry[]]>} */
  const specs = [...CONFORMING, ["an unknown method written as declared", [{ name: "m12", data: "as given, not compressed", method: 12 }, { name: "m0", data: "z", method: 0 }]], ["no entries", []]];
  for (const [what, entries] of specs) {
    const z = makeZip(entries);
    assert.ok(z instanceof Uint8Array, `${what}: a Uint8Array`);
    const p = parse(z);
    assert.equal(p.eocds.length, 1, `${what}: one end record`);
    const eocd = eocdAt(p, 0);
    assert.equal(eocd.offset + 22, z.length, `${what}: the end record ends the archive, no comment`);
    assert.deepEqual([eocd.disk, eocd.cdDisk, eocd.entries, eocd.diskEntries], [0, 0, entries.length, entries.length], what);
    assert.equal(p.central.length, entries.length, `${what}: one central record per entry`);
    assert.equal(eocd.cdOffset, p.cdOffset);
    assert.equal(eocd.cdSize, p.cdEnd - p.cdOffset, `${what}: the end record states the directory's size`);
    assert.equal(p.cdEnd, eocd.offset, `${what}: the end record follows the directory`);
    let at = 0;
    /** @type {number[] | null} the first entry's, which every other states */
    let time = null;
    entries.forEach((e, i) => {
      const c = centralAt(p, i), l = p.locals[String(c.resolved.localOffset)], data = bytesOf(present(e.data, `${what}: entry ${i}'s data`)), method = e.method ?? 8;
      const w = `${what}, entry ${i}`;
      assert.equal(c.localOffset, at, `${w}: its local header follows the previous entry's data`);
      assert.ok(l, `${w}: a local header where the directory says`);
      assert.equal(l.name, hex(nameBytes(e.name)), `${w}: local name`);
      assert.equal(c.name, hex(nameBytes(e.name)), `${w}: central name`);
      const name = e.name;
      const bit11 = typeof name === "string" && /[^\x00-\x7f]/.test(name) ? 0x0800 : 0;
      assert.equal(l.flags, bit11, `${w}: local flags`);
      assert.equal(c.flags, bit11, `${w}: central flags`);
      assert.equal(l.method, method); assert.equal(c.method, method, w);
      if (method === 12) assert.equal(l.data, hex(data), `${w}: an unknown method's data written as given`);
      else {
        assert.equal(l.plainSha256, sha(data), `${w}: the data gives back the entry's bytes`);
        assert.equal(l.plainLength, data.length);
        if (method === 0) assert.equal(l.dataSha256, sha(data), `${w}: stored as is`);
      }
      const crc = method === 12 ? parseInt(spawnSync("python3", ["-I", "-c", "import sys,binascii;print(binascii.crc32(sys.stdin.buffer.read()))"], { input: Buffer.from(data), encoding: "utf8" }).stdout, 10) : l.plainCrc32;
      for (const r of [l, c]) {
        assert.equal(r.crc32, crc, `${w}: true CRC-32`);
        assert.equal(r.compressedSize, l.end - l.dataOffset, `${w}: true compressed size, the bytes up to the next record`);
        assert.equal(r.uncompressedSize, data.length, `${w}: true uncompressed size`);
        const t = [r.dosDate, r.dosTime];
        assert.deepEqual(t, time ??= t, `${w}: the one fixed time`);
      }
      assert.equal(l.descriptor, undefined, `${w}: no data descriptor`);
      assert.deepEqual(l.extra, [], `${w}: no extra field`);
      at = l.end;
    });
    assert.equal(p.cdOffset, at, `${what}: the directory follows the last entry's data`);
  }
  /* The fixed time is a valid MS-DOS date, and an entry may name its own. */
  const p = parse(makeZip([{ name: "a", data: "a" }, { name: "b", data: "b", dosDate: 0x5947, dosTime: 0x6000 }]));
  assert.deepEqual([centralAt(p, 0).dosDate, centralAt(p, 0).dosTime], [(0 << 9) | (1 << 5) | 1, 0], "1980-01-01 00:00:00");
  assert.deepEqual([centralAt(p, 1).dosDate, centralAt(p, 1).dosTime, local(p, 1).dosDate, local(p, 1).dosTime], [0x5947, 0x6000, 0x5947, 0x6000]);
});

/* ------------------------------------------------------------------ R11 */

test("R11 a conforming archive with at least one entry passes both oracles: unzip -t exits 0, and Python's zipfile lists the entries in order with their names and gives back each entry's data byte for byte", { skip: NO_ORACLES }, () => {
  for (const [what, entries] of CONFORMING) {
    const z = makeZip(entries);
    const u = unzipT(z);
    assert.equal(u.status, 0, `${what}: unzip -t\n${u.out}`);
    const got = readZipfile(z);
    assert.deepEqual(got.entries.map((e) => e.name),
      entries.map(({ name }) => (typeof name === "string" ? name : Buffer.from(name).toString("latin1"))), `${what}: names in order`);
    got.entries.forEach((g, i) => {
      assert.equal(g.error, null, `${what}, entry ${i}: ${g.error}`);
      assert.equal(g.data, hex(bytesOf(present(present(entries[i], `${what}, entry ${i}`).data, `${what}, entry ${i}'s data`))), `${what}, entry ${i}: byte for byte`);
    });
  }
  /* An archive with no entries is conforming (R10) and zipfile reads it;
     Info-ZIP's unzip answers "zipfile is empty" with status 1 for any such
     archive, so R11 covers archives with at least one entry (K1917). */
  assert.deepEqual(readZipfile(makeZip([])).entries, []);
});

/* ------------------------------------------------------------------ R12 */

/**
 * The members of a ZipEntry but its name, for `with1`.
 * @typedef {Object} EntryChange
 * @property {ByteSource | undefined} [data]
 * @property {number | undefined} [method]
 * @property {boolean | undefined} [utf8]
 * @property {RecordOverride | undefined} [local]
 * @property {RecordOverride | undefined} [central]
 * @property {boolean | undefined} [dataDescriptor]
 * @property {DescriptorOverride | undefined} [descriptor]
 * @property {boolean | undefined} [zip64]
 * @property {"traditional" | "strong" | "aes" | "directory" | undefined} [encrypted]
 * @property {number | undefined} [sameDataAs]
 * @property {number | undefined} [dosDate]
 * @property {number | undefined} [dosTime]
 */
/** @type {[ZipEntry, ZipEntry]} */
const BASE = [{ name: "one.txt", data: "first entry ".repeat(20) }, { name: "two.txt", data: "second", method: 0 }];
/** @param {EntryChange} extra @param {ZipOptions} [opts] @returns {Uint8Array} */
const with1 = (extra, opts) => makeZip([BASE[0], { ...BASE[1], ...extra }], opts);
/** @type {Array<["flags" | "method" | "crc32" | "compressedSize" | "uncompressedSize", [number, number]]>} */
const L_FIELD = [["flags", [6, 2]], ["method", [8, 2]], ["crc32", [14, 4]], ["compressedSize", [18, 4]], ["uncompressedSize", [22, 4]]];
/** @type {Array<["flags" | "method" | "crc32" | "compressedSize" | "uncompressedSize" | "localOffset", [number, number]]>} */
const C_FIELD = [["flags", [8, 2]], ["method", [10, 2]], ["crc32", [16, 4]], ["compressedSize", [20, 4]], ["uncompressedSize", [24, 4]], ["localOffset", [42, 4]]];
/** @type {Array<["diskEntries" | "entries" | "cdSize" | "cdOffset", [number, number]]>} */
const E_FIELD = [["diskEntries", [8, 2]], ["entries", [10, 2]], ["cdSize", [12, 4]], ["cdOffset", [16, 4]]];
const VALUES = { flags: 0x0001, method: 14, crc32: 0xdeadbeef, compressedSize: 0x7fff0001, uncompressedSize: 3, localOffset: 0x01020304 };

test("R12 duplicate names: two entries with one name are written as two entries, nothing merged or renamed", { skip: NO_PYTHON }, () => {
  const entries = [{ name: "same.txt", data: "first" }, { name: "same.txt", data: "second", method: 0 }, { name: "other", data: "o" }];
  const z = makeZip(entries);
  const p = parse(z);
  assert.deepEqual(p.central.map((c) => c.name), entries.map((e) => hex(e.name)));
  assert.equal(Object.keys(p.locals).length, 3, "three local headers");
  assert.deepEqual(p.central.map((_, i) => local(p, i).plain), entries.map((e) => hex(e.data)));
  assert.deepEqual(readZipfile(z).entries.map((e) => e.name), ["same.txt", "same.txt", "other"]);
});

test("R12 unsafe and non-UTF-8 names: a name is written verbatim, and utf8:false clears bit 11 over non-ASCII raw bytes (a CP437 name)", { skip: NO_PYTHON }, () => {
  const unsafe = ["../up.txt", "/abs.txt", "C:\\win.txt", "C:/drive.txt", "a\\b\\c.txt", "./x/../../y", "..", "\\\\server\\share"];
  const p = parse(makeZip(unsafe.map((name) => ({ name, data: name }))));
  unsafe.forEach((n, i) => {
    assert.equal(centralAt(p, i).name, hex(n), `central ${n}`);
    assert.equal(local(p, i).name, hex(n), `local ${n}`);
    assert.equal(centralAt(p, i).flags, 0, `${n}: no flag set`);
  });
  const cp437 = Uint8Array.of(0x80, 0x81, 0x82, 0x2e, 0x74, 0x78, 0x74);
  const z = makeZip([{ name: cp437, data: "c", utf8: false }, { name: "é.txt", data: "e", utf8: false }, { name: "é.txt", data: "e" }]);
  const q = parse(z);
  assert.equal(centralAt(q, 0).name, hex(cp437)); assert.equal(local(q, 0).name, hex(cp437));
  assert.equal(centralAt(q, 0).flags & 0x0800, 0); assert.equal(local(q, 0).flags & 0x0800, 0);
  assert.equal(centralAt(q, 1).flags & 0x0800, 0, "utf8:false over a non-ASCII string clears bit 11");
  assert.equal(centralAt(q, 1).name, hex("é.txt"), "and writes the string's bytes");
  assert.equal(centralAt(q, 2).flags & 0x0800, 0x0800, "the same name without utf8:false sets it");
  assert.equal(present(readZipfile(z).entries[0], "entry 0").name, "Çüé.txt", "zipfile reads the raw name as CP437");
});

test("R12 central directory and local header disagree: local:{…} is what that entry's local header states, field by field and together, and its central record keeps the true values", { skip: NO_PYTHON }, () => {
  const base = makeZip(BASE);
  const bp = parse(base);
  const at = local(bp, 1).offset;
  for (const [field, [off, width]] of L_FIELD) {
    const z = with1({ local: { [field]: VALUES[field] } });
    onlyIn(base, z, at + off, width, `local.${field}`);
    const p = parse(z);
    assert.equal(local(p, 1)[field], VALUES[field], `local.${field} is stated`);
    assert.deepEqual(p.central, bp.central, `local.${field}: the central directory keeps the true values`);
  }
  /** @type {RecordOverride} */
  const all = { flags: 0x0801, method: 0, crc32: 1, compressedSize: 2, uncompressedSize: 0xffffffff };
  const p = parse(with1({ local: all }));
  /** @type {Array<"flags" | "method" | "crc32" | "compressedSize" | "uncompressedSize">} */
  const allFields = ["flags", "method", "crc32", "compressedSize", "uncompressedSize"];
  for (const k of allFields) assert.equal(local(p, 1)[k], all[k], `all at once: ${k}`);
  assert.deepEqual(p.central, bp.central);
  /* A name of another length: the local header names it, everything else as R10 wrote it. */
  const n = parse(with1({ local: { name: "../evil.txt" } }));
  assert.equal(local(n, 1).name, hex("../evil.txt"));
  assert.equal(centralAt(n, 1).name, hex("two.txt"), "the central record keeps the true name");
  assert.equal(local(n, 1).data, local(bp, 1).data);
  /** @param {CentralRec} c @returns {CentralRec} */
  const strip = (c) => ({ ...c, offset: 0 });
  assert.deepEqual(n.central.map(strip), bp.central.map(strip), "the directory is otherwise unchanged");
  assert.equal(n.cdOffset, bp.cdOffset + 4, "shifted by the name's extra four bytes only");
});

test("R12 central:{…}, the reverse: the central record states the override, the local header keeps the true values, and a localOffset past the archive's end writes an entry out of range", { skip: NO_PYTHON }, () => {
  const base = makeZip(BASE);
  const bp = parse(base);
  const at = centralAt(bp, 1).offset;
  for (const [field, [off, width]] of C_FIELD) {
    const z = with1({ central: { [field]: VALUES[field] } });
    onlyIn(base, z, at + off, width, `central.${field}`);
    const p = parse(z);
    assert.equal(centralAt(p, 1)[field], VALUES[field], `central.${field} is stated`);
    /** @param {LocalRec} l */
    const header = (l) => Object.fromEntries(Object.entries(l).filter(([k]) => !/^(plain|data$|dataSha256|end$)/.test(k)));
    if (field !== "localOffset") assert.deepEqual(header(local(p, 1)), header(local(bp, 1)), `central.${field}: the local header keeps the true values`);
  }
  const past = with1({ central: { localOffset: base.length + 1000 } });
  const pp = parse(past);
  assert.ok(centralAt(pp, 1).localOffset >= past.length, "the entry points past the archive's end");
  assert.equal(pp.locals[String(centralAt(pp, 1).localOffset)], undefined);
  const n = parse(with1({ central: { name: "renamed.txt" } }));
  assert.equal(centralAt(n, 1).name, hex("renamed.txt"));
  assert.equal(local(n, 1).name, hex("two.txt"), "the local header keeps the true name");
});

test("R12 bit 3: dataDescriptor sets bit 3, writes zero CRC and sizes in the local header and a data descriptor after the data; descriptor:{…} overrides what it states and signature:false omits its signature", { skip: NO_ORACLES }, () => {
  const plain = parse(makeZip(BASE));
  const z = makeZip([{ ...BASE[0], dataDescriptor: true }, { ...BASE[1], dataDescriptor: true }]);
  const p = parse(z);
  for (const i of [0, 1]) {
    const l = local(p, i), c = centralAt(p, i), t = centralAt(plain, i);
    assert.equal(l.flags, 0x0008); assert.equal(c.flags, 0x0008, `entry ${i}: bit 3 in both`);
    assert.deepEqual([l.crc32, l.compressedSize, l.uncompressedSize], [0, 0, 0], `entry ${i}: zero in the local header`);
    assert.deepEqual([c.crc32, c.compressedSize, c.uncompressedSize], [t.crc32, t.compressedSize, t.uncompressedSize], `entry ${i}: true in the directory`);
    assert.deepEqual(l.descriptor, { offset: l.dataOffset + t.compressedSize, signature: 0x08074b50, crc32: t.crc32, compressedSize: t.compressedSize, uncompressedSize: t.uncompressedSize }, `entry ${i}: the descriptor`);
    assert.equal(l.data, local(plain, i).data, `entry ${i}: the same data`);
  }
  assert.equal(unzipT(z).status, 0, "unzip -t reads it");
  assert.deepEqual(readZipfile(z).entries.map((e) => e.data), BASE.map((e) => hex(present(e.data, "the entry's data"))), "zipfile reads it");
  const base = makeZip([BASE[0], { ...BASE[1], dataDescriptor: true }]);
  const desc = descriptorOf(parse(base), 1);
  /** @type {Array<["crc32" | "compressedSize" | "uncompressedSize" | "signature", number, number]>} */
  const descFields = [["crc32", 4, 0x11111111], ["compressedSize", 8, 999], ["uncompressedSize", 12, 0xffffffff], ["signature", 0, 0x12345678]];
  for (const [field, off, v] of descFields) {
    const o = with1({ dataDescriptor: true, descriptor: { [field]: v } });
    onlyIn(base, o, desc.offset + off, 4, `descriptor.${field}`);
    assert.equal(descriptorOf(parse(o), 1)[field], field === "signature" ? null : v, `descriptor.${field} is stated`);
  }
  const n = with1({ dataDescriptor: true, descriptor: { signature: false } });
  const np = parse(n);
  assert.equal(descriptorOf(np, 1).signature, null, "signature:false omits it");
  assert.equal(n.length, base.length - 4);
  assert.deepEqual(descriptorOf(np, 1).crc32, desc.crc32, "and the rest is as before");
  assert.equal(np.cdOffset, descriptorOf(np, 1).offset + 12, "the directory follows the twelve-byte descriptor");
});

test("R12 ZIP64: an entry's zip64 writes its sizes and offset as 0xFFFFFFFF with the true values in a 0x0001 extra field; options.zip64 writes the ZIP64 end record and locator with the end record at its sentinels; zip64Record overrides what that record states", { skip: NO_ORACLES }, () => {
  const plain = parse(makeZip(BASE));
  const z = makeZip(BASE.map((e) => ({ ...e, zip64: true })), { zip64: true });
  const p = parse(z);
  for (const i of [0, 1]) {
    const l = local(p, i), c = centralAt(p, i), t = centralAt(plain, i);
    assert.deepEqual([l.compressedSize, l.uncompressedSize], [0xffffffff, 0xffffffff], `entry ${i}: local sentinels`);
    assert.deepEqual(l.extra, [{ id: 1, hex: le(t.uncompressedSize, 8) + le(t.compressedSize, 8) }], `entry ${i}: local extra`);
    assert.deepEqual([c.compressedSize, c.uncompressedSize, c.localOffset], [0xffffffff, 0xffffffff, 0xffffffff], `entry ${i}: central sentinels`);
    assert.deepEqual(c.extra, [{ id: 1, hex: le(t.uncompressedSize, 8) + le(t.compressedSize, 8) + le(l.offset, 8) }], `entry ${i}: central extra`);
    assert.equal(c.crc32, t.crc32); assert.equal(l.crc32, t.crc32);
    assert.equal(l.plain, local(plain, i).plain);
  }
  const cd = { offset: p.cdOffset, size: p.cdEnd - p.cdOffset };
  assert.deepEqual(p.zip64Record, { offset: p.cdEnd, signature: 0x06064b50, size: 44, versionMadeBy: 45, versionNeeded: 45, disk: 0, cdDisk: 0, diskEntries: 2, entries: 2, cdSize: cd.size, cdOffset: cd.offset });
  assert.deepEqual(p.locator, { offset: p.cdEnd + 56, disk: 0, recordOffset: p.cdEnd, disks: 1 });
  const eocd = eocdAt(p, 0);
  assert.equal(eocd.offset, p.cdEnd + 76);
  assert.deepEqual([eocd.entries, eocd.diskEntries, eocd.cdSize, eocd.cdOffset], [0xffff, 0xffff, 0xffffffff, 0xffffffff], "the end record's sentinels");
  assert.equal(unzipT(z).status, 0, "unzip -t reads it");
  assert.deepEqual(readZipfile(z).entries.map((e) => e.data), BASE.map((e) => hex(present(e.data, "the entry's data"))), "zipfile reads it");
  /* options.zip64 alone leaves the entries as R10 writes them. */
  const only = parse(makeZip(BASE, { zip64: true }));
  assert.deepEqual(only.central, plain.central);
  const base = makeZip(BASE, { zip64: true });
  const rec = present(parse(base).zip64Record, "the ZIP64 end record").offset;
  /** @type {Array<["diskEntries" | "entries" | "cdSize" | "cdOffset", number]>} */
  const recFields = [["diskEntries", 24], ["entries", 32], ["cdSize", 40], ["cdOffset", 48]];
  for (const [field, off] of recFields) {
    const o = makeZip(BASE, { zip64: true, zip64Record: { [field]: 0x123456789 } });
    onlyIn(base, o, rec + off, 8, `zip64Record.${field}`);
    assert.equal(present(parse(o).zip64Record, "the ZIP64 end record")[field], 0x123456789);
  }
});

test("R12 encrypted: traditional sets bit 0, strong bits 0 and 6, aes method 99 with a 0x9901 extra field, directory bit 13; the data is written as given, never encrypted", { skip: NO_PYTHON }, () => {
  const data = "plain bytes, not encrypted";
  /** @type {Array<["traditional" | "strong" | "aes" | "directory", number]>} */
  const want = [["traditional", 0x0001], ["strong", 0x0041], ["aes", 0x0001], ["directory", 0x2000]];
  for (const [kind, flags] of want) {
    const z = makeZip([{ name: "e.bin", data, encrypted: kind }]);
    const p = parse(z), l = local(p, 0), c = centralAt(p, 0);
    assert.equal(l.flags, flags, `${kind}: local flags`); assert.equal(c.flags, flags, `${kind}: central flags`);
    assert.equal(l.data, hex(data), `${kind}: the data as given`);
    assert.equal(c.compressedSize, data.length); assert.equal(c.uncompressedSize, data.length);
    if (kind === "aes") {
      assert.equal(l.method, 99); assert.equal(c.method, 99);
      const ae = "0200" + hex("AE") + "03" + "0800";
      assert.deepEqual(l.extra, [{ id: 0x9901, hex: ae }]); assert.deepEqual(c.extra, [{ id: 0x9901, hex: ae }], "AE-2, strength 3, the declared method");
    } else {
      assert.equal(c.method, 8, `${kind}: the method as declared`);
      assert.deepEqual(c.extra, []);
    }
    assert.equal(present(readZipfile(z).entries[0], "entry 0").flags, flags, `${kind}: zipfile sees the flags`);
  }
});

test("R12 overlap: sameDataAs points an entry's central record at an earlier entry's local header and data, so their byte ranges coincide", { skip: NO_PYTHON }, () => {
  const z = makeZip([BASE[0], BASE[1], { name: "again.txt", sameDataAs: 0 }, { name: "ü", sameDataAs: 1 }]);
  const p = parse(z);
  assert.equal(Object.keys(p.locals).length, 2, "two local headers only");
  /** @type {Array<[number, number]>} */
  const pairs = [[2, 0], [3, 1]];
  /** @type {Array<"method" | "crc32" | "compressedSize" | "uncompressedSize" | "dosDate" | "dosTime" | "extra">} */
  const shared = ["method", "crc32", "compressedSize", "uncompressedSize", "dosDate", "dosTime", "extra"];
  for (const [i, j] of pairs) {
    const c = centralAt(p, i), t = centralAt(p, j);
    assert.equal(c.localOffset, t.localOffset, `entry ${i} points at entry ${j}'s local header`);
    for (const k of shared) assert.deepEqual(c[k], t[k], `entry ${i}: ${k} as entry ${j}`);
  }
  assert.equal(centralAt(p, 2).name, hex("again.txt"));
  assert.equal(centralAt(p, 2).flags, 0);
  assert.equal(centralAt(p, 3).flags, 0x0800, "bit 11 follows the entry's own name");
  assert.equal(p.cdOffset, local(p, 1).end, "no data of their own");
});

test("R12 the end record: eocd:{…} is what it states, field by field; comment is the archive comment as a string or bytes; secondEocd writes a second well-formed candidate inside the comment", { skip: NO_PYTHON }, () => {
  const base = makeZip(BASE);
  const at = eocdAt(parse(base), 0).offset;
  for (const [field, [off, width]] of E_FIELD) {
    const v = width === 2 ? 0x7777 : 0x01020304;
    const z = makeZip(BASE, { eocd: { [field]: v } });
    onlyIn(base, z, at + off, width, `eocd.${field}`);
    assert.equal(eocdAt(parse(z), 0)[field], v);
  }
  for (const comment of ["a comment, ü", Uint8Array.of(0, 1, 2, 0xff)]) {
    const z = makeZip(BASE, { comment });
    const p = parse(z);
    assert.equal(p.eocds.length, 1);
    assert.equal(eocdAt(p, 0).comment, hex(comment));
    assert.equal(eocdAt(p, 0).commentLength, bytesOf(comment).length);
    assert.equal(eocdAt(p, 0).offset, at, "everything before the end record unchanged");
    assert.deepEqual(z.subarray(0, at), base.subarray(0, at));
    if (HAS_PYTHON) assert.equal(readZipfile(z).comment, hex(comment));
  }
  const z = makeZip(BASE, { comment: "c", secondEocd: true });
  const p = parse(z);
  assert.equal(p.eocds.length, 2, "two candidates");
  const outer = eocdAt(p, 0), inner = eocdAt(p, 1);
  assert.equal(outer.offset, at);
  assert.equal(inner.offset + 22 + inner.commentLength, z.length, "the inner candidate ends at the archive's end");
  assert.equal(outer.offset + 22 + outer.commentLength, z.length, "and so does the real one");
  assert.equal(inner.offset, outer.offset + 22 + 1, "inside the comment, after the comment's own text");
  /** @type {Array<"disk" | "cdDisk" | "entries" | "diskEntries" | "cdSize" | "cdOffset">} */
  const stated = ["disk", "cdDisk", "entries", "diskEntries", "cdSize", "cdOffset"];
  for (const k of stated) assert.equal(inner[k], outer[k], `the candidate is well formed: ${k}`);
  assert.equal(inner.commentLength, 0);
});

test("R12 nesting: an entry's data may itself be makeZip's output, read back as an archive inside the archive", { skip: NO_PYTHON }, () => {
  const inner = makeZip([{ name: "deep.txt", data: "deep" }]);
  const z = makeZip([{ name: "inner.zip", data: inner }, { name: "inner-stored.zip", data: inner, method: 0 }]);
  const t = tree(z);
  for (const e of t) assert.deepEqual(e.children, [{ name: "deep.txt", method: 8, error: null, children: null, data: hex("deep") }]);
  assert.equal(local(parse(z), 1).data, hex(inner), "the stored copy is the inner archive byte for byte");
});

/* ------------------------------------------------------------------ R13 */

/** Every shape R12 names, plus R14's, as one list of calls. */
const ALL_FIXTURES = () => [
  makeZip(MIXED),
  makeZip([{ name: "same", data: "a" }, { name: "same", data: "b" }]),
  makeZip([{ name: "../x", data: "x" }, { name: Uint8Array.of(0x80), data: "c", utf8: false }]),
  with1({ local: { name: "n", crc32: 1 } }), with1({ central: { localOffset: 9999, method: 3 } }),
  with1({ dataDescriptor: true, descriptor: { crc32: 2, signature: false } }),
  makeZip(BASE.map((e) => ({ ...e, zip64: true })), { zip64: true, zip64Record: { entries: 9 } }),
  .../** @satisfies {Array<"traditional" | "strong" | "aes" | "directory">} */ (["traditional", "strong", "aes", "directory"]).map((k) => makeZip([{ name: "e", data: "e", encrypted: k }])),
  makeZip([BASE[0], { name: "o", sameDataAs: 0 }]),
  makeZip(BASE, { eocd: { cdOffset: 1 }, comment: "c", secondEocd: true }),
  makeZip([{ name: "n.zip", data: makeZip(BASE) }]),
  zipBomb({ kernel: 1 << 16, entries: 50 }),
  nestedZip({ depth: 3, fanout: 2, leaf: "leaf" }),
];

test("R13 deterministic: the same entries and options give the same bytes on every call", () => {
  const a = ALL_FIXTURES().map(sha), b = ALL_FIXTURES().map(sha);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, "and the fixtures are distinct");
});

test("R13 no clock, no randomness, nothing written to disk: with the clock and every random source made to throw and the file system made to refuse writes, a child gets the same bytes, and its working and temporary directories stay empty; importing the module has no side effect", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cwd-")), tmp = mkdtempSync(join(tmpdir(), "tmp-"));
  const want = ALL_FIXTURES().map(sha);
  const body = `
    const no = (what) => () => { throw new Error("used " + what); };
    Date.now = no("Date.now");
    const RealDate = Date;
    globalThis.Date = new Proxy(RealDate, { construct: no("new Date"), apply: no("Date()") });
    Math.random = no("Math.random");
    globalThis.crypto.getRandomValues = no("crypto.getRandomValues");
    globalThis.crypto.randomUUID = no("crypto.randomUUID");
    performance.now = no("performance.now");
    process.hrtime = Object.assign(no("process.hrtime"), { bigint: no("process.hrtime.bigint") });
    const fs = (await import("node:fs")).default;
    const { syncBuiltinESMExports } = await import("node:module");
    for (const k of ["writeFileSync", "mkdirSync", "mkdtempSync", "appendFileSync", "writeSync", "createWriteStream", "writeFile", "mkdir", "appendFile", "rmSync", "unlinkSync"]) fs[k] = no("fs." + k);
    for (const k of ["writeFile", "mkdir", "appendFile", "rm", "unlink"]) fs.promises[k] = no("fs.promises." + k);
    /* Opening for reading stays, so modules still load; opening to write is refused. */
    const realOpen = fs.openSync;
    fs.openSync = (p, f = "r", ...rest) => { if (f !== "r" && f !== 0) no("fs.openSync for writing")(); return realOpen(p, f, ...rest); };
    syncBuiltinESMExports();
    const { makeZip, zipBomb, nestedZip } = await import(${JSON.stringify(MAKE_ZIP_URL)});
    const { createHash } = await import("node:crypto");
    const sha = (b) => createHash("sha256").update(b).digest("hex");
    const BASE = ${JSON.stringify(BASE)};
    const LONG = ${JSON.stringify(LONG)};
    const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
    const MIXED = [
      { name: "a.txt", data: LONG }, { name: "stored.bin", data: ALL_BYTES, method: 0 }, { name: "empty.txt", data: "" },
      { name: "empty-stored", data: new Uint8Array(0), method: 0 }, { name: "naïve/ü-文.txt", data: "ü文" },
      { name: new TextEncoder().encode("raw/bytes.bin"), data: ALL_BYTES }, { name: "dir/", data: "", method: 0 } ];
    const with1 = (extra, opts) => makeZip([BASE[0], { ...BASE[1], ...extra }], opts);
    const ALL = (${ALL_FIXTURES.toString()})();
    process.stdout.write(JSON.stringify(ALL.map(sha)));
  `;
  /* Node warns on stderr when it cannot read NODE_EXTRA_CA_CERTS, as a uid that is not root cannot read the proxy's bundle; the child is handed none. */
  const { NODE_EXTRA_CA_CERTS: _unread, ...inherited } = process.env;
  const env = { ...inherited, TMPDIR: tmp };
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", body], { cwd, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  assert.deepEqual(JSON.parse(r.stdout), want, "the same bytes with no clock, randomness or disk");
  assert.deepEqual(readdirSync(cwd), [], "nothing in the working directory");
  assert.deepEqual(readdirSync(tmp), [], "nothing in the temporary directory");
  const i = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(MAKE_ZIP_URL)});`], { cwd, env, encoding: "utf8" });
  assert.deepEqual([i.status, i.stdout, i.stderr, readdirSync(cwd), readdirSync(tmp)], [0, "", "", [], []], "importing has no side effect");
});

test("R13 a spec it cannot write throws an Error naming the field: an entry without name or data, a sameDataAs naming no earlier entry, an unknown encrypted value", () => {
  /** @type {Array<[unknown, RegExp]>} the specs it cannot write, each with the field its error names */
  const cases = [
    [[{ data: "x" }], /entries\[0\]\.name/],
    [[{ name: "a" }], /entries\[0\]\.data/],
    [[{ name: "a", data: "x" }, { name: "b" }], /entries\[1\]\.data/],
    [[{ name: 5, data: "x" }], /entries\[0\]\.name/],
    [[{ name: "a", data: 5 }], /entries\[0\]\.data/],
    [[{ name: "a", sameDataAs: 0 }], /entries\[0\]\.sameDataAs/],
    [[{ name: "a", data: "x" }, { name: "b", sameDataAs: 1 }], /entries\[1\]\.sameDataAs/],
    [[{ name: "a", data: "x" }, { name: "b", sameDataAs: 2 }], /entries\[1\]\.sameDataAs/],
    [[{ name: "a", data: "x" }, { name: "b", sameDataAs: -1 }], /entries\[1\]\.sameDataAs/],
    [[{ name: "a", data: "x" }, { name: "b", sameDataAs: 0.5 }], /entries\[1\]\.sameDataAs/],
    [[{ name: "a", data: "x" }, { name: "b", sameDataAs: "0" }], /entries\[1\]\.sameDataAs/],
    [[{ name: "a", data: "x", encrypted: "rot13" }], /entries\[0\]\.encrypted/],
    [[{ name: "a", data: "x", encrypted: true }], /entries\[0\]\.encrypted/],
  ];
  for (const [spec, re] of cases) assert.throws(() => makeZip(spec), (/** @type {unknown} */ e) => e instanceof Error && re.test(e.message), `${JSON.stringify(spec)} → ${re}`);
  /* And every other field it cannot write, by name (J1, reading 8). */
  /** @type {Array<[() => Uint8Array, RegExp]>} */
  const more = [
    [() => makeZip("x"), /entries/],
    [() => makeZip([null]), /entries\[0\]/],
    [() => makeZip([{ name: "a", data: "x", method: 70000 }]), /entries\[0\]\.method/],
    [() => makeZip([{ name: "a", data: "x", local: { bogus: 1 } }]), /entries\[0\]\.local\.bogus/],
    [() => makeZip([{ name: "a", data: "x", local: { crc32: -1 } }]), /entries\[0\]\.local\.crc32/],
    [() => makeZip([{ name: "a", data: "x", central: { localOffset: 2 ** 32 } }]), /entries\[0\]\.central\.localOffset/],
    [() => makeZip([{ name: "a", data: "x", descriptor: { crc32: 1 } }]), /entries\[0\]\.descriptor/],
    [() => makeZip([], { eocd: { entries: 70000 } }), /options\.eocd\.entries/],
    [() => makeZip([], { eocd: { comment: "x" } }), /options\.eocd\.comment/],
    [() => makeZip([], { zip64Record: { entries: 1 } }), /options\.zip64Record/],
    [() => makeZip([], { comment: 5 }), /options\.comment/],
    [() => zipBomb({ kernel: 0, entries: 2 }), /kernel/],
    [() => zipBomb({ kernel: 1, entries: 1.5 }), /entries/],
    [() => nestedZip({ depth: 0, fanout: 1, leaf: "x" }), /depth/],
    [() => nestedZip({ depth: 1, fanout: 0, leaf: "x" }), /fanout/],
    [() => nestedZip({ depth: 1, fanout: 1 }), /leaf/],
  ];
  for (const [f, re] of more) assert.throws(f, (/** @type {unknown} */ e) => e instanceof Error && re.test(e.message), String(re));
});

/* ------------------------------------------------------------------ R14 */

test("R14 zipBomb writes one deflated kernel of zero bytes once and that many central entries all pointing at it, each declaring the kernel's size, so the declared total is kernel × entries while the archive stays near one kernel's compressed size", { skip: NO_PYTHON }, () => {
  /** @type {Array<[number, number]>} */
  const sizes = [[1, 1], [1 << 20, 1], [1 << 20, 400], [10_000_000, 64]];
  for (const [kernel, entries] of sizes) {
    const z = zipBomb({ kernel, entries });
    const p = parse(z);
    const w = `${kernel} × ${entries}`;
    assert.equal(p.central.length, entries, `${w}: the entries`);
    assert.equal(Object.keys(p.locals).length, 1, `${w}: one local header`);
    const l = local(p, 0);
    assert.equal(l.method, 8, `${w}: deflated`);
    assert.equal(l.plainLength, kernel, `${w}: the kernel inflates to its size`);
    const plain = l.plain;
    if (plain !== null) assert.equal(plain, "00".repeat(kernel), `${w}: of zero bytes`);
    for (const c of p.central) {
      assert.equal(c.localOffset, l.offset, `${w}: every entry points at the kernel`);
      assert.equal(c.uncompressedSize, kernel); assert.equal(c.compressedSize, l.compressedSize);
      assert.equal(c.crc32, l.plainCrc32, `${w}: and states its true CRC-32`);
    }
    assert.equal(p.central.reduce((s, c) => s + c.uncompressedSize, 0), kernel * entries, `${w}: the declared total`);
    const overhead = p.cdEnd - p.cdOffset + 22 + (l.dataOffset - l.offset);
    assert.equal(z.length, l.compressedSize + overhead, `${w}: one kernel's compressed bytes plus its headers`);
    assert.deepEqual(zipBomb({ kernel, entries }), z, `${w}: deterministic`);
    const names = Array.from({ length: entries }, (_, i) => `${i}.bin`);
    assert.deepEqual(p.central.map((c) => c.name), names.map((n) => hex(n)), `${w}: one name per entry`);
    assert.deepEqual(z, makeZip(names.map(/** @param {string} name @param {number} i @returns {ZipEntry} */ (name, i) => { if (i) return { name, sameDataAs: 0 }; return { name, data: new Uint8Array(kernel) }; })), `${w}: built on makeZip alone`);
  }
});

test("R14 nestedZip writes an archive depth levels deep, each level fanout entries each the next level's archive, the deepest fanout copies of leaf, stored or deflated", { skip: NO_PYTHON }, () => {
  const leaf = Uint8Array.from(Buffer.from("a leaf, ".repeat(10)));
  /** @type {Array<[number, number]>} */
  const shapes = [[1, 1], [1, 3], [2, 2], [3, 3], [4, 2]];
  for (const [depth, fanout] of shapes) {
    for (const method of [0, 8]) {
      const w = `depth ${depth}, fanout ${fanout}, method ${method}`;
      const z = nestedZip({ depth, fanout, leaf, method });
      let level = tree(z), d = 1;
      /** @type {(nodes: TreeNode[], d: number) => void} */
      const walk = (nodes, d) => {
        assert.equal(nodes.length, fanout, `${w}: level ${d} holds fanout entries`);
        for (const n of nodes) {
          assert.equal(n.error, null);
          if (d < depth) { const children = n.children; assert.ok(children, `${w}: level ${d} entries are archives`); walk(children, d + 1); }
          else { assert.equal(n.children, null); assert.equal(n.data, hex(leaf), `${w}: a leaf`); assert.equal(n.method, method, `${w}: the leaf's method`); }
        }
      };
      walk(level, d);
      assert.deepEqual(nestedZip({ depth, fanout, leaf, method }), z, `${w}: deterministic`);
      let built = makeZip(Array.from({ length: fanout }, /** @param {unknown} _ @param {number} i @returns {ZipEntry} */ (_, i) => ({ name: `leaf-${i}.bin`, data: leaf, method })));
      for (let k = 2; k <= depth; k++) { const inner = built; built = makeZip(Array.from({ length: fanout }, /** @param {unknown} _ @param {number} i @returns {ZipEntry} */ (_, i) => ({ name: `level-${k - 1}-${i}.zip`, data: inner }))); }
      assert.deepEqual(z, built, `${w}: built on makeZip alone`);
    }
  }
  assert.equal(present(tree(nestedZip({ depth: 1, fanout: 2, leaf: "s" }))[0], "the first entry").data, hex("s"), "a string leaf is written as UTF-8 (R10)");
});
