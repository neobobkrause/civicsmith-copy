/* The ooxml module's VBA project read (build/requirements/ooxml.md R32–R33;
 * K1888): an office file's `vbaProject.bin` read as MS-CFB, its `dir` stream
 * and module sources decompressed per MS-OVBA, names matched as olevba
 * matches them, nothing run. Projects are written by ./cfb.mjs and placed in
 * archives by test-support's `makeZip`. olevba (oletools) is the oracle where
 * the host has it; every assertion also stands on its own. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readVbaProject, readContainer, VBA_AUTORUN_NAMES, VBA_SUSPICIOUS_KEYWORDS, MEMBER_MAX, ARCHIVE_TOTAL_MAX,
} from "../../../src/ooxml.mjs";
import { makeZip } from "../../make-zip.mjs";
import { makeCfb, makeVbaProject, ovbaCompress, vbaDir } from "./cfb.mjs";

/** @typedef {import("./cfb.mjs").VbaModuleSpec} VbaModuleSpec */
/** @typedef {import("../../../src/ooxml.mjs").VbaResult} VbaResult */
/** @typedef {{ stream: string, autoRun: string[], suspicious: string[] }} OlevbaModule what the olevba script prints for a module */
/** @import { RecordOverride } from "../../make-zip.mjs" */
/** @typedef {{ local?: RecordOverride, central?: RecordOverride }} EntryOverrides */
/** @typedef {import("./cfb.mjs").CfbTree} CfbTree */
/** @typedef {{ project?: string, codePage?: number, modules?: VbaModuleSpec[], dir?: Uint8Array, streams?: { [name: string]: Uint8Array | undefined }, extra?: CfbTree }} ProjectSpec makeVbaProject's argument */

/** @param {string} s @returns {Uint8Array} */
const latin1 = (s) => Uint8Array.from(s, (/** @type {string} */ c) => c.charCodeAt(0));
const DIR = mkdtempSync(join(tmpdir(), "ooxml-vba-"));
let fileNo = 0;
const HAVE_OLEVBA = (() => { try { return spawnSync("python3", ["-c", "import oletools.olevba"]).status === 0; } catch { return false; } })();

/* olevba over a vbaProject.bin: each module's stream path, and the names its
 * detect_autoexec and detect_suspicious report (plain-string tables only). */
/** @param {Uint8Array} bin @returns {OlevbaModule[]} */
function olevba(bin) {
  const path = join(DIR, `p${fileNo++}.bin`);
  writeFileSync(path, bin);
  const script = `
import sys, json
from oletools import olevba as o
plain_a = {k for ks in o.AUTOEXEC_KEYWORDS.values() for k in ks}
plain_s = {k for ks in o.SUSPICIOUS_KEYWORDS.values() for k in ks}
out = []
for (_, stream, _, code) in o.VBA_Parser(sys.argv[1]).extract_macros():
    a = {k.lower() for k, _ in o.detect_autoexec(code)}
    s = {k.lower() for k, _ in o.detect_suspicious(code)}
    out.append(dict(stream=stream, autoRun=sorted(k for k in plain_a if k.lower() in a and k != 'Auto_Ope'),
                    suspicious=sorted(k for k in plain_s if k.lower() in s)))
print(json.dumps(out))`;
  const r = spawnSync("python3", ["-c", script, path], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  /** @type {OlevbaModule[]} */
  const out = JSON.parse(r.stdout);
  return out;
}

/* An office file carrying the project at `word/vbaProject.bin`. */
/** @param {Uint8Array} bin @param {EntryOverrides} [extra] @returns {Uint8Array} */
const inDocx = (bin, extra = {}) => makeZip([{ name: "word/document.xml", data: "<w/>" }, { name: "word/vbaProject.bin", data: bin, local: extra.local, central: extra.central }]);
/** @param {Uint8Array} z @param {string} [part] @returns {Promise<VbaResult>} */
const read = async (z, part = "word/vbaProject.bin") => readVbaProject(z, readContainer(z), part);
/** @param {ProjectSpec} spec @returns {Uint8Array} */
const project = (spec) => inDocx(makeVbaProject(spec).bytes);

const LONG = Array.from({ length: 300 }, (_, i) => `  v${i} = "line ${i} of a long module"\r\n`).join("");
/** @type {VbaModuleSpec[]} */
const MODULES = [
  { name: "ThisDocument", document: true, cache: new Uint8Array(613).fill(0x41), source: `Attribute VB_Name = "ThisDocument"\r\nPrivate Sub Document_Open()\r\n  Shell "cmd /c x"\r\nEnd Sub\r\n` },
  { name: "Module1", stream: "Module1Stream", cache: new Uint8Array(5000).fill(7), source: `Attribute VB_Name = "Module1"\r\nSub AutoOpen()\r\n  Set o = CREATEOBJECT("WScript.Shell")\r\n  o.Run Chr(99) & Chr(109)\r\n${LONG}End Sub\r\nSub autoopen2()\r\nEnd Sub\r\n` },
  { name: "Plain", source: `Attribute VB_Name = "Plain"\r\nFunction Add(a, b)\r\n  Add = a + b\r\nEnd Function\r\n` },
];

/* ------------------------------------------------------------------ R32 */

test("R32 readVbaProject reads the project, every module in dir's order, and the names in each source", async () => {
  const p = makeVbaProject({ project: "Invoices", modules: MODULES });
  const r = await read(inDocx(p.bytes));
  assert.deepEqual(r, {
    ok: true, part: "word/vbaProject.bin", project: "Invoices",
    modules: [
      { name: "ThisDocument", stream: "ThisDocument", read: true, why: null, autoRun: ["Document_Open"], suspicious: ["Shell"] },
      { name: "Module1", stream: "Module1Stream", read: true, why: null, autoRun: ["AutoOpen"], suspicious: ["Shell", "WScript.Shell", "Run", "CreateObject", "Chr"] },
      { name: "Plain", stream: "Plain", read: true, why: null, autoRun: [], suspicious: [] },
    ],
    autoRun: ["AutoOpen", "Document_Open"],
    suspicious: ["Shell", "WScript.Shell", "Run", "CreateObject", "Chr"],
    undetermined: [],
  });
  // the same project read through a leading "/" and from any member name
  assert.deepEqual(await read(makeZip([{ name: "xl/vbaProject.bin", data: p.bytes }]), "/xl/vbaProject.bin"), { ...r, part: "xl/vbaProject.bin" });
  if (HAVE_OLEVBA) {
    const o = olevba(p.bytes);
    assert.deepEqual(o.map((m) => m.stream), ["VBA/ThisDocument", "VBA/Module1Stream", "VBA/Plain"]);
    r.modules.forEach((m, i) => {
      const om = o[i];
      assert.ok(om);
      assert.deepEqual([...m.autoRun].sort(), om.autoRun, m.name);
      assert.deepEqual([...m.suspicious].sort(), om.suspicious, m.name);
    });
  }
});

test("R32 every MS-CFB and MS-OVBA form a real project takes: mini and regular streams, raw and copy chunks, names and code pages", async () => {
  // a module source over 4,096 bytes (several chunks), incompressible (raw chunks), literal-only, and in the regular FAT
  const noise = Array.from({ length: 9000 }, (_, i) => String.fromCharCode(33 + ((i * 7919 + (i >> 3) * 104729) % 90))).join("");
  const specs = [
    { name: "Big", source: `Sub Workbook_Open()\r\n${LONG}${LONG}${LONG}End Sub\r\n` },
    { name: "Noise", source: `' ${noise}\r\nSub Auto_Close()\r\nKill "x"\r\nEnd Sub\r\n` },
    { name: "Empty", source: "" },
  ];
  const r = await read(project({ modules: specs }));
  assert.ok(r.ok);
  assert.deepEqual(r.modules.map((m) => [m.name, m.read, m.autoRun, m.suspicious]), [
    ["Big", true, ["Workbook_Open"], []], ["Noise", true, ["Auto_Close"], ["Kill"]], ["Empty", true, [], []],
  ]);
  const literal = makeCfb({ VBA: { dir: ovbaCompress(vbaDir({ modules: [{ name: "L", offset: 0 }] }), { literalOnly: true }), L: ovbaCompress(latin1("Sub AutoNew()\r\nEnd Sub"), { literalOnly: true }) } });
  const literalRead = await read(inDocx(literal.bytes));
  assert.ok(literalRead.ok);
  assert.deepEqual(literalRead.autoRun, ["AutoNew"]);
  // a module named only in the code page (no Unicode record), and the project's name in its code page
  const cp = await read(project({ project: "\xc0\xc1", codePage: 1251, modules: [{ name: "M\xc0", unicodeName: false, stream: "S", source: "Sub DocumentOpen()\r\nEnd Sub" }] }));
  assert.ok(cp.ok);
  assert.equal(cp.project, "АБ");
  const cp0 = cp.modules[0];
  assert.ok(cp0);
  assert.deepEqual([cp0.name, cp0.stream, cp0.autoRun], ["MА", "S", ["DocumentOpen"]]);
  // CFB names compare case-blind: "vba", "DIR" and a module stream in other case are found
  const caseBlind = makeCfb({ vba: { DIR: ovbaCompress(vbaDir({ modules: [{ name: "m", stream: "Mod", offset: 0 }] })), MOD: ovbaCompress(latin1("AutoExit")) } });
  const caseBlindRead = await read(inDocx(caseBlind.bytes));
  assert.ok(caseBlindRead.ok);
  assert.deepEqual(caseBlindRead.autoRun, ["AutoExit"]);
  // a project with no modules
  assert.deepEqual(await read(project({ modules: [] })), { ok: true, part: "word/vbaProject.bin", project: "VBAProject", modules: [], autoRun: [], suspicious: [], undetermined: [] });
  if (HAVE_OLEVBA) {
    const bin = makeVbaProject({ modules: specs }).bytes;
    const o = olevba(bin);
    const mine = await read(inDocx(bin));
    assert.ok(mine.ok);
    o.forEach((m, i) => {
      const mm = mine.modules[i];
      assert.ok(mm);
      assert.deepEqual([[...mm.autoRun].sort(), [...mm.suspicious].sort()], [m.autoRun, m.suspicious]);
    });
  }
});

test("R32 a name is found as a whole word, without regard to case, as olevba finds it; lists in table order without repeats", async () => {
  /** @type {[string, string[]][]} */
  const cases = [
    ["Shell x", ["Shell"]], ["SHELL x", ["Shell"]], ["shell(x)", ["Shell"]], ["x=Shell", ["Shell"]],
    ["Shellfish", []], ["MyShell", []], ["_Shell", []], ["Shell_x", []], ["Shell2", []], ["éShell", []], ["Shellé", []],
    ["WScript.Shell", ["Shell", "WScript.Shell"]], ["WScriptXShell", []],
    ["Print #1, x", ["Print #"]], ["Print # 1", []], ["Print #", []],
    ["HKCU\\Environment", ["Environment", "HKCU\\Environment"]],
    ["Lib \"kernel32\"", ["Lib"]], ["Library", []],
    ["chr chr CHR Chr", ["Chr"]], ["ChrW(1) & Chr(2)", ["Chr", "ChrW"]],
    ["URLDownloadToFileA", ["URLDownloadToFileA"]], ["URLDownloadToFile x", ["URLDownloadToFile"]],
    ["Msxml2.XMLHTTP", ["Msxml2.XMLHTTP", "XMLHTTP"]], ["WinHttp.WinHttpRequest.5.1", ["WinHttpRequest"]],
    ["", []],
  ];
  for (const [source, want] of cases) {
    const r = await read(project({ modules: [{ name: "M", source }] }));
    assert.ok(r.ok);
    const m0 = r.modules[0];
    assert.ok(m0);
    assert.deepEqual(m0.suspicious, want, JSON.stringify(source));
    assert.deepEqual(r.suspicious, want);
  }
  const auto = await read(project({ modules: [{ name: "M", source: "Sub workbook_open\r\nSub AUTO_OPEN\r\nSub Auto_Opened\r\nSub XAutoExec\r\nSub AutoExec" }] }));
  assert.ok(auto.ok);
  assert.deepEqual(auto.autoRun, ["AutoExec", "Auto_Open", "Workbook_Open"]);
  // every table name is found in a source that is that name, and only names it contains
  for (const name of [...VBA_AUTORUN_NAMES, ...VBA_SUSPICIOUS_KEYWORDS]) {
    const r = await read(project({ modules: [{ name: "M", source: ` ${name} ` }] }));
    assert.ok(r.ok);
    const hits = name.endsWith("#") ? r.suspicious : [...r.autoRun, ...r.suspicious];
    if (!name.endsWith("#")) assert.ok(hits.includes(name), name);
  }
  if (HAVE_OLEVBA) {
    const bin = makeVbaProject({ modules: cases.map(([source], i) => ({ name: `M${i}`, source })) }).bytes;
    const o = olevba(bin);
    const mine = await read(inDocx(bin));
    assert.ok(mine.ok);
    const beyondOlevba = ["XMLHTTP", "WinHttpRequest", "URLDownloadToFile", "RegWrite"]; // R33's own additions
    o.forEach((m, i) => {
      const mm = mine.modules[i];
      const c = cases[i];
      assert.ok(mm);
      assert.ok(c);
      assert.deepEqual(mm.suspicious.filter((n) => !beyondOlevba.includes(n)).sort(), m.suspicious, c[0]);
    });
  }
});

test("R32 nothing is run, evaluated or compiled, and the p-code is not read", async () => {
  /** @type {string[]} */
  const calls = [];
  const saved = { eval: globalThis.eval, Function: globalThis.Function };
  globalThis.eval = (/** @type {[string]} */ ...a) => { calls.push("eval"); return saved.eval(...a); };
  globalThis.Function = new Proxy(saved.Function, { construct(t, /** @type {string[]} */ a) { calls.push("new Function"); return new t(...a); }, apply(t, s, /** @type {string[]} */ a) { calls.push("Function()"); return t(...a); } });
  const r = await (async () => {
    try {
      // the performance cache (p-code) says AutoOpen and Shell; the source says neither ("VBA stomping")
      const stomped = latin1("Sub AutoOpen()\r\n Shell \"x\"\r\nEnd Sub\r\n".repeat(4));
      return await read(project({ modules: [{ name: "M", cache: stomped, source: "Sub Harmless()\r\nEnd Sub" }, { name: "Js", source: "globalThis.pwned = 1 ' Sub Document_Open" }] }));
    } finally {
      globalThis.eval = saved.eval;
      globalThis.Function = saved.Function;
    }
  })();
  assert.deepEqual(calls, []);
  /** @type {unknown} */
  const pwned = Reflect.get(globalThis, "pwned");
  assert.equal(pwned, undefined);
  assert.ok(r.ok);
  const [m0, m1] = r.modules;
  assert.ok(m0);
  assert.ok(m1);
  assert.deepEqual(m0.autoRun, []);
  assert.deepEqual(m0.suspicious, []);
  assert.deepEqual(m1.autoRun, ["Document_Open"]);
});

test("R32 refusals: readPart's own, cfb_invalid, vba_dir_absent, vba_dir_unreadable", async () => {
  const good = makeVbaProject({ modules: MODULES.slice(2) });
  const z = inDocx(good.bytes);
  /** @param {string} why @param {string} [part] */
  const R = (why, part = "word/vbaProject.bin") => ({ ok: false, why, part });
  // readPart's why: absent, unreadable, over a limit (R31)
  assert.deepEqual(await read(z, "/xl/vbaProject.bin"), R("part_absent", "xl/vbaProject.bin"));
  assert.deepEqual(await read(inDocx(good.bytes, { central: { crc32: 1 } })), R("crc_mismatch"));
  const huge = inDocx(good.bytes, { local: { uncompressedSize: MEMBER_MAX + 1 }, central: { uncompressedSize: MEMBER_MAX + 1 } });
  assert.deepEqual(await read(huge), R("MEMBER_MAX"));
  // cfb_invalid: not a compound file, a bad header, broken chains, a looping directory tree
  for (const bytes of [latin1("not a compound file"), new Uint8Array(4096), good.bytes.subarray(0, 511)]) {
    assert.deepEqual(await read(inDocx(bytes)), R("cfb_invalid"));
  }
  /** @param {number} at @param {number} value @param {number} [width] @returns {Uint8Array} */
  const patch = (at, value, width = 4) => {
    const b = good.bytes.slice();
    const v = new DataView(b.buffer);
    if (width === 2) v.setUint16(at, value, true); else v.setUint32(at, value, true);
    return inDocx(b);
  };
  const dirFat = good.fatOffset + 4 * good.dirSector;
  /** @type {[string, Uint8Array][]} */
  const broken = [
    ["byte order", patch(0x1c, 0xfeff, 2)], ["sector shift", patch(0x1e, 10, 2)], ["mini sector shift", patch(0x20, 7, 2)],
    ["mini cutoff", patch(0x38, 2048)], ["directory past the file", patch(0x30, 9999)], ["FAT sector past the file", patch(0x4c, 9999)],
    ["FAT count", patch(0x2c, 9999)], ["directory chain loops", patch(dirFat, good.dirSector)], ["chain into a free sector", patch(dirFat, 0xffffffff)],
    ["root is not a root", patch(512 * (good.dirSector + 1) + 0x42, 1, 2)],
    ["a stream's chain leaves the mini stream", patch(512 * (good.dirSector + 1) + 128 * 1 + 0x74, 9999)],
    ["the directory tree loops", patch(512 * (good.dirSector + 1) + 128 * 1 + 0x48, 1)],
  ];
  for (const [what, z2] of broken) {
    assert.deepEqual(await read(z2), R("cfb_invalid"), what);
  }
  // vba_dir_absent: no VBA storage, or no dir stream in it (or a dir that is a storage)
  assert.deepEqual(await read(inDocx(makeCfb({ Macros: { dir: ovbaCompress(vbaDir({})) } }).bytes)), R("vba_dir_absent"));
  assert.deepEqual(await read(inDocx(makeCfb({ VBA: { notdir: new Uint8Array(3) } }).bytes)), R("vba_dir_absent"));
  assert.deepEqual(await read(inDocx(makeCfb({ VBA: { dir: { x: new Uint8Array(1) } } }).bytes)), R("vba_dir_absent"));
  assert.deepEqual(await read(inDocx(makeCfb({ VBA: latin1("a stream, not a storage") }).bytes)), R("vba_dir_absent"));
  // vba_dir_unreadable: not a compressed container, a bad chunk, a copy past the chunk, a record past the stream
  /** @param {Uint8Array} bytes @returns {Uint8Array} */
  const dirOf = (bytes) => inDocx(makeCfb({ VBA: { dir: bytes } }).bytes);
  const plainDir = vbaDir({ modules: [{ name: "M", offset: 0 }] });
  /** @type {[string, Uint8Array][]} */
  const unreadable = [
    ["empty", new Uint8Array(0)], ["no signature byte", plainDir], ["chunk signature", Uint8Array.of(1, 0x00, 0x80, 0)],
    ["copy before any byte", Uint8Array.of(1, 0x02, 0xb0, 0x01, 0x00, 0x00)],
    ["copy reaching back too far", Uint8Array.of(1, 0x04, 0xb0, 0x02, 0x41, 0xf0, 0xff)],
    ["raw chunk cut short", Uint8Array.of(1, 0xff, 0x3f, 0x41)],
    ["a record past the stream", ovbaCompress(Uint8Array.of(0x04, 0x00, 0xff, 0x00, 0x00, 0x00, 0x41))],
    ["half a record header", ovbaCompress(Uint8Array.of(0x04, 0x00, 0x01))],
  ];
  for (const [what, bytes] of unreadable) {
    assert.deepEqual(await read(dirOf(bytes)), R("vba_dir_unreadable"), what);
  }
});

test("R32 a module that cannot be read is listed with why, in undetermined, never dropped; the rest are read", async () => {
  const bin = makeVbaProject({
    modules: [
      { name: "Gone", source: "Sub AutoOpen()" },
      { name: "NoStreamName", stream: null, source: "x" },
      { name: "PastEnd", source: "Sub AutoClose()", offset: 9999 },
      { name: "NoOffset", source: "x", offset: null },
      { name: "Garbage", source: "x" },
      { name: "Fine", source: "Sub Workbook_Open()\r\nShell 1" },
    ],
    streams: { Gone: undefined, Garbage: Uint8Array.of(1, 0x00, 0x80, 0xff) },
  }).bytes;
  const r = await read(inDocx(bin));
  assert.equal(r.ok, true);
  /** @param {string} name @param {string | null} stream @param {string} why */
  const unread = (name, stream, why) => ({ name, stream, read: false, why, autoRun: [], suspicious: [] });
  assert.deepEqual(r.modules, [
    unread("Gone", "Gone", "module_stream_absent"),
    unread("NoStreamName", null, "module_stream_absent"),
    unread("PastEnd", "PastEnd", "module_source_undecompressable"),
    unread("NoOffset", "NoOffset", "module_source_undecompressable"),
    unread("Garbage", "Garbage", "module_source_undecompressable"),
    { name: "Fine", stream: "Fine", read: true, why: null, autoRun: ["Workbook_Open"], suspicious: ["Shell"] },
  ]);
  assert.deepEqual(r.undetermined, [
    { module: "Gone", why: "module_stream_absent" }, { module: "NoStreamName", why: "module_stream_absent" },
    { module: "PastEnd", why: "module_source_undecompressable" }, { module: "NoOffset", why: "module_source_undecompressable" },
    { module: "Garbage", why: "module_source_undecompressable" },
  ]);
  assert.deepEqual([r.autoRun, r.suspicious], [["Workbook_Open"], ["Shell"]]);
});

test("R32 never throws, on any argument or any byte of a project", async () => {
  for (const x of [undefined, null, 0, "x", {}, [], Symbol("s"), () => 0]) {
    const r = await readVbaProject(x, x, x);
    assert.equal(r.ok, false); assert.equal(typeof r.why, "string"); assert.equal(typeof r.part, "string");
  }
  const bin = makeVbaProject({ modules: MODULES }).bytes;
  /** @type {(string | null)[]} */
  const unreadWhys = ["module_stream_absent", "module_source_undecompressable"];
  let seed = 32;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
  for (let k = 0; k < 300; k++) {
    const b = bin.slice();
    for (let j = 0; j < 1 + Math.floor(rand() * 6); j++) b[Math.floor(rand() * b.length)] = Math.floor(rand() * 256);
    const r = await read(inDocx(k % 3 ? b : b.subarray(0, Math.floor(rand() * b.length))));
    assert.equal(typeof r.ok, "boolean");
    if (!r.ok) assert.ok(["cfb_invalid", "vba_dir_absent", "vba_dir_unreadable"].includes(r.why), r.why);
    else for (const m of r.modules) assert.ok(m.read ? m.why === null : unreadWhys.includes(m.why));
  }
  // the declared total of the file counts against ARCHIVE_TOTAL_MAX (R31) before anything is read
  const total = makeZip([{ name: "word/vbaProject.bin", data: bin }, { name: "big", data: "x", local: { uncompressedSize: ARCHIVE_TOTAL_MAX }, central: { uncompressedSize: ARCHIVE_TOTAL_MAX } }]);
  assert.deepEqual(await read(total), { ok: false, why: "ARCHIVE_TOTAL_MAX", part: "word/vbaProject.bin" });
});

/* ------------------------------------------------------------------ R33 */

test("R33 VBA_AUTORUN_NAMES and VBA_SUSPICIOUS_KEYWORDS: frozen arrays of strings holding at least the named entries", () => {
  const AUTORUN = ["AutoExec", "AutoOpen", "AutoClose", "AutoNew", "AutoExit", "Auto_Open", "Auto_Close", "Document_Open", "Document_Close", "Document_New", "DocumentOpen", "DocumentBeforeClose", "Document_BeforeClose", "Workbook_Open", "Workbook_Activate", "Workbook_BeforeClose", "Workbook_Close"];
  const SUSPICIOUS = ["Shell", "WScript.Shell", "ShellExecute", "CreateObject", "GetObject", "CallByName", "Environ", "Kill", "FileCopy", "CreateTextFile", "SaveToFile", "URLDownloadToFile", "XMLHTTP", "WinHttpRequest", "Lib", "VirtualAlloc", "RtlMoveMemory", "CreateThread", "PowerShell", "ExecuteExcel4Macro", "MacScript", "RegWrite", "StrReverse", "Chr"];
  /** @type {[readonly string[], string[]][]} */
  const tables = [[VBA_AUTORUN_NAMES, AUTORUN], [VBA_SUSPICIOUS_KEYWORDS, SUSPICIOUS]];
  for (const [table, must] of tables) {
    const names = table; // held before Array.isArray narrows `table` to any[]
    assert.ok(Array.isArray(table) && Object.isFrozen(names));
    assert.ok(names.every((s) => typeof s === "string" && s.length > 0));
    assert.equal(new Set(names).size, names.length);
    for (const name of must) assert.ok(names.includes(name), name);
  }
  // olevba's own plain-string tables, in their order, are the tables' heads
  if (HAVE_OLEVBA) {
    const r = spawnSync("python3", ["-c", `
import json
from oletools import olevba as o
a = [k for ks in o.AUTOEXEC_KEYWORDS.values() for k in ks if k != 'Auto_Ope']
s = []
for ks in o.SUSPICIOUS_KEYWORDS.values():
    s += [k for k in ks if k not in s]
print(json.dumps([a, s]))`], { encoding: "utf8" });
    /** @type {[string[], string[]]} */
    const heads = JSON.parse(r.stdout);
    const [a, s] = heads;
    assert.deepEqual(VBA_AUTORUN_NAMES, a);
    assert.deepEqual(VBA_SUSPICIOUS_KEYWORDS.slice(0, s.length), s);
    assert.deepEqual(VBA_SUSPICIOUS_KEYWORDS.slice(s.length), ["XMLHTTP", "WinHttpRequest", "URLDownloadToFile", "RegWrite"]);
  }
});
