/* test-support R23 (fix round 9, G123d): `zipChunks64`, the lazy ZIP64 writer, and `zipChunks64Sized`, tested at the
 * interface against the two oracles of R11 (Info-ZIP `unzip -t`, Python's `zipfile`). A host lacking either skips by
 * name. The 500 MiB case streams through and is never held: its memory is measured, not assumed. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createWriteStream, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { zipChunks64, zipChunks64Sized, makeZip } from "../../make-zip.mjs";

/** @param {string} cmd @param {string[]} args @returns {boolean} */
const has = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8" }); return !r.error && r.status === 0; };
const HAS_PYTHON = has("python3", ["-I", "-c", "import zipfile"]);
const HAS_UNZIP = has("unzip", ["-v"]);
const NO_ORACLES = (!HAS_PYTHON || !HAS_UNZIP) && `absent on this host: ${[!HAS_PYTHON && "python3", !HAS_UNZIP && "unzip"].filter(Boolean).join(", ")}`;
const NO_PYTHON = !HAS_PYTHON && "python3 is absent on this host";
const MiB = 1 << 20;

/** @param {AsyncIterable<Uint8Array, void, undefined>} chunks @returns {Promise<string>} */
async function toFile(chunks) {
  const path = join(mkdtempSync(join(tmpdir(), "z64-")), "a.zip");
  const out = createWriteStream(path);
  for await (const c of chunks) if (!out.write(c)) {
    /** @type {Promise<void>} */
    const drained = new Promise((r) => out.once("drain", r));
    await drained;
  }
  /** @type {Promise<void>} */
  const ended = new Promise((r) => out.end(r));
  await ended;
  return path;
}
/** @param {string} path @param {string} code @returns {unknown} the JSON the child prints */
const zipfile = (path, code) => {
  const r = spawnSync("python3", ["-I", "-c", `import sys,zipfile,json,hashlib\nz=zipfile.ZipFile(sys.argv[1])\n${code}`, path], { encoding: "utf8", maxBuffer: 256 * MiB });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
/** @param {Uint8Array} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");

test("R23 a small archive written lazily opens in both oracles: unzip -t exits 0 and zipfile gives back every member byte for byte, whole, streamed, deflated or stored", { skip: NO_ORACLES }, async () => {
  const big = new Uint8Array(300000).map((_, i) => (i * 7) % 251);
  const entries = [
    { name: "whole.txt", data: "hello, archive" },
    { name: "naïve/é.bin", chunks: function* () { for (let i = 0; i < 3; i++) yield big.subarray(i * 100000, (i + 1) * 100000); } },
    { name: "stored.bin", method: 0, chunks: async function* () { yield big.subarray(0, 1000); } },
    { name: "stored-whole.bin", method: 0, data: big.subarray(0, 77) },
    { name: "classic", method: 0, data: "mimetype-like", zip64: false },
    { name: "empty", data: new Uint8Array(0) },
  ];
  const path = await toFile(zipChunks64(entries));
  const u = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
  assert.equal(u.status, 0, u.stdout + u.stderr);
  const got = zipfile(path, "print(json.dumps([[i.filename, i.file_size, hashlib.sha256(z.read(i)).hexdigest()] for i in z.infolist()]))");
  assert.deepEqual(got, [
    ["whole.txt", 14, sha(Buffer.from("hello, archive"))], ["naïve/é.bin", 300000, sha(big)], ["stored.bin", 1000, sha(big.subarray(0, 1000))],
    ["stored-whole.bin", 77, sha(big.subarray(0, 77))], ["classic", 13, sha(Buffer.from("mimetype-like"))], ["empty", 0, sha(new Uint8Array(0))],
  ]);
});

test("R23 the classic member (zip64: false) sits with no extra field, so an ODF mimetype is at offset 38", async () => {
  /** @type {Uint8Array[]} */
  const chunks = [];
  for await (const c of zipChunks64([{ name: "mimetype", method: 0, data: "application/vnd.oasis.opendocument.text", zip64: false }])) chunks.push(c);
  const b = Buffer.concat(chunks);
  assert.equal(b.toString("latin1", 30, 38), "mimetype");
  assert.equal(b.toString("latin1", 38, 38 + 39), "application/vnd.oasis.opendocument.text");
});

test("R23 65,536 members and more are written from a lazy source and read back by zipfile with their count past 16 bits", { skip: NO_PYTHON }, async () => {
  const n = 70000;
  const path = await toFile(zipChunks64((function* () { for (let i = 0; i < n; i++) yield { name: `m/${i}`, data: `x${i}`, method: 0 }; })()));
  const got = zipfile(path, "l=z.infolist(); print(json.dumps([len(l), l[-1].filename, z.read(l[-1]).decode()]))");
  assert.deepEqual(got, [n, `m/${n - 1}`, `x${n - 1}`]);
});

test("R23 a member set whose declared unpacked total passes 2 GB (and one member past 4 GiB) is declared without being built: the central records say it, zipfile lists it", { skip: NO_PYTHON }, async () => {
  const G = 2 ** 30;
  const entries = [
    { name: "a.bin", data: "a", central: { uncompressedSize: 1.5 * G } },
    { name: "b.bin", data: "b", central: { uncompressedSize: 5 * G } },
  ];
  const before = process.memoryUsage();
  const path = await toFile(zipChunks64(entries));
  const after = process.memoryUsage();
  assert.ok(statSync(path).size < 1000, "the archive is a few hundred bytes");
  assert.ok(after.arrayBuffers - before.arrayBuffers < 16 * MiB, "nothing of the declared size was built");
  const got = /** @type {Array<[string, number]>} decodes its own child's output */ (zipfile(path, "print(json.dumps([[i.filename, i.file_size] for i in z.infolist()]))"));
  assert.deepEqual(got, [["a.bin", 1.5 * G], ["b.bin", 5 * G]]);
  assert.ok(got.reduce((s, [, n]) => s + n, 0) > 2 * G);
});

test("R23 the standard's 500 MB (500 MiB) member streams through without being held, and the archive passes zipfile's CRC check", { skip: NO_PYTHON }, async () => {
  const size = 500 * MiB, block = new Uint8Array(MiB).fill(0x41);
  let peak = 0;
  const base = process.memoryUsage().arrayBuffers;
  /** @param {AsyncIterable<Uint8Array, void, undefined>} src */
  async function* watch(src) { for await (const c of src) { peak = Math.max(peak, process.memoryUsage().arrayBuffers - base); yield c; } }
  const path = await toFile(watch(zipChunks64([{ name: "big.bin", chunks: function* () { for (let i = 0; i < size; i += MiB) yield block; } }])));
  assert.ok(peak < 64 * MiB, `held at most ${peak} bytes beyond the start`);
  const got = zipfile(path, "print(json.dumps([z.testzip(), z.infolist()[0].file_size]))");
  assert.deepEqual(got, [null, size]);
});

test("R23 zipChunks64Sized writes exactly the size asked at a bound minus 2, the bound and the bound plus 1 (50 MiB, K4616), and each opens in both oracles", { skip: NO_ORACLES }, async () => {
  const bound = 50 * MiB;
  for (const size of [bound - 2, bound, bound + 1, 2000]) {
    const path = await toFile(zipChunks64Sized([{ name: "doc.xml", chunks: () => (function* () { yield "<doc/>"; })() }], size));
    assert.equal(statSync(path).size, size);
    assert.equal(spawnSync("unzip", ["-t", path]).status, 0, `unzip -t at ${size}`);
    const got = /** @type {string[]} decodes its own child's output */ (zipfile(path, "print(json.dumps([i.filename for i in z.infolist()]))"));
    assert.equal(got[0], "doc.xml");
  }
});

test("R23 a spec it cannot write is refused naming the field; makeZip stays the whole-archive writer", async () => {
  /** @param {AsyncIterable<Uint8Array, void, undefined>} it */
  const drain = async (it) => { for await (const _ of it); };
  await assert.rejects(drain(zipChunks64([{ data: "x" }])), /entries\[0\]\.name/);
  await assert.rejects(drain(zipChunks64([{ name: "a" }])), /entries\[0\]\.data or chunks/);
  await assert.rejects(drain(zipChunks64([{ name: "a", data: "x", method: 12 }])), /entries\[0\]\.method/);
  await assert.rejects(drain(zipChunks64([{ name: "a", data: "x", central: { bogus: 1 } }])), /central\.bogus/);
  await assert.rejects(drain(zipChunks64Sized([{ name: "a", data: "x" }], 10)), /over size 10/);
  assert.ok(makeZip([{ name: "a", data: "x" }]) instanceof Uint8Array);
});
