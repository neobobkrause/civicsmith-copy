/* case-checker: the standalone program (R13, R16) and its committed build (`program.mjs`, a generated artifact, manifest
   §14), run as a person runs it: one file copied to an empty directory outside the repository, started by Node. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as CC from "../../../src/case-checker/index.mjs";
import { buildProgram, programModule, programWords } from "../../../src/case-checker/build-program.mjs";
import { WORD_ROWS } from "../../../src/setup-words/rows.mjs";
import { runInNewContext } from "node:vm";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { unresolvableSpecifiers } from "../../../scripts/fleet-bundle.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { like, caseFile, keyFor, A, MINUTES, MINUTES_BYTES } from "./fixture.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const P = CC.caseCheckerProgramText();

test("R13: the build gives the same bytes every time, and the committed program.mjs is that build (regenerate: node bio-plane/src/case-checker/build-program.mjs)", async () => {
  const one = await buildProgram();
  const two = await buildProgram();
  assert.equal(one.text, two.text);
  assert.equal(P.sha256, one.sha256, "program.mjs is stale: run node bio-plane/src/case-checker/build-program.mjs");
  assert.ok(P.text === one.text);
  assert.equal(P.body_sha256, one.body_sha256);
  assert.equal(programModule(one), programModule(two));
});

/* The word rows a program text carries: its bundled `setup-words/rows.mjs`, evaluated apart from the rest of it. */
const rowsCarried = (text) => {
  const from = text.indexOf("var WORD_ROWS = ");
  const to = text.indexOf("\n]);\n", from);
  assert.ok(from >= 0 && to > from, "the program carries a word table");
  return Array.from(runInNewContext(`(${text.slice(from + "var WORD_ROWS = ".length, to + 3)})`.replace(/;\)$/, ")")), (r) => [...r]);
};

test("R26: the program carries as data only the word rows its own code reads, R26's refusal keys among them, each as the table holds it", async () => {
  const built = await buildProgram();
  const carried = rowsCarried(built.text);
  assert.deepEqual(carried.map((r) => r[0]), built.words);
  for (const k of CC.STANDARDS_USE_KEYS) assert.ok(built.words.includes(k), `${k}: R26's row is carried`);
  const table = new Map(WORD_ROWS.map((r) => [r[0], r]));
  for (const r of carried) { const row = table.get(r[0]); assert.ok(row, `${r[0]}: a row of the table`); assert.deepEqual(r, [...row], `${r[0]}: carried as the table holds it`); }
  /* bound: the table's order is kept, and far fewer rows than the whole table are carried */
  const order = WORD_ROWS.map((r) => r[0]).filter((k) => built.words.includes(k));
  assert.deepEqual(built.words, order);
  assert.equal(built.words_total, WORD_ROWS.length);
  assert.ok(built.words.length < WORD_ROWS.length / 4, `${built.words.length} of ${WORD_ROWS.length} rows`);
  /* the committed program carries the same rows */
  assert.deepEqual(rowsCarried(P.text).map((r) => r[0]), built.words);
});

test("R26 (error): a word call whose key has no literal prefix makes the build fail and name the call, never carry a program that might lack a row", async () => {
  const probe = { metafile: { inputs: { "src/setup-words/rows.mjs": {}, "test/m/case-checker/word-unbounded.mjs": {} } } };
  await assert.rejects(programWords(probe), (e) => /cannot be bounded/.test(e.message) && /word-unbounded\.mjs:7/.test(e.message));
  /* control: the same read in the program's entry (R26's `says.key`) is allowed, and R26's keys are carried */
  const entry = { metafile: { inputs: { "src/setup-words/rows.mjs": {}, "src/case-checker/main.mjs": {} } } };
  const w = await programWords(entry);
  for (const k of CC.STANDARDS_USE_KEYS) assert.ok(w.keys.includes(k), k);
});

test("R13: the program file carries its own SHA-256: its first line names the SHA-256 of everything after it, and the served SHA-256 is the whole file's", () => {
  const nl = P.text.indexOf("\n");
  const first = P.text.slice(0, nl);
  const body = P.text.slice(nl + 1);
  assert.match(first, new RegExp(`SHA-256 of everything after this line: ${sha(body)}$`));
  assert.equal(P.body_sha256, sha(body));
  assert.equal(P.sha256, sha(P.text));
  const served = CC.caseCheckerProgram();
  assert.equal(served.program, P.text);
  assert.equal(served.sha256, sha(P.text));
  assert.equal(served.bytes, Buffer.byteLength(P.text));
});

test("R13: nothing to install and no network: the program imports only Node's own built-ins, and none that reaches the network", () => {
  assert.deepEqual(unresolvableSpecifiers(P.text, ["node:fs/promises", "node:path", "node:url"]), []);
  const dynamic = [...P.text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(dynamic)].sort(), ["node:fs/promises", "node:path", "node:url"]);
  for (const net of ["fetch(", "XMLHttpRequest", "WebSocket", "node:http", "node:https", "node:net", "node:dns"])
    assert.equal(P.text.includes(net), false, net);
});

test("R13 R16 R20 R22: run offline from an empty directory, the program prints each finding's result first and then the same answer checkCaseFile gives on the same parts, byte-identical", async () => {
  const dir = mkdtempSync(join(tmpdir(), "case-checker-"));
  try {
    writeFileSync(join(dir, "case-checker.mjs"), P.text);
    /* R20 in the program: the calculation is recomputed by the bundled evaluator, offline */
    const cf = caseFile({ parts: 2, withImported: true, withCalculation: true, edit: (b) => b.delete(CG.caseFilePath("document", MINUTES)) });
    cf.parts.forEach((p, i) => writeFileSync(join(dir, `part${i + 1}.zip`), p));
    writeFileSync(join(dir, "minutes.pdf"), MINUTES_BYTES);
    writeFileSync(join(dir, "keys.txt"), `# the group's published keys\n${["group", "alice", "bob"].map((k) => keyFor(k).line).join("\n")}\n`);
    const run = (...args) => execFileSync(process.execPath, ["case-checker.mjs", ...args], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH } });
    for (const [args, call] of [
      [["part1.zip", "part2.zip"], { parts: cf.parts }],
      [["part1.zip", "part2.zip", "--document", "minutes.pdf", "--keys", "keys.txt"],
       { parts: cf.parts, documents: [Buffer.from(MINUTES_BYTES)], keys: ["group", "alice", "bob"].map((k) => keyFor(k).line) }]]) {
      const out = run(...args);
      const expected = await CC.checkCaseFile(call);
      const lines = out.split("\n");
      expected.findings.forEach((f, i) => assert.equal(lines[i], `${f.finding}: ${CC.RESULT_WORDS[f.result]}`));
      const json = out.slice(out.indexOf("{"));
      assert.equal(canonicalJson(JSON.parse(json)), canonicalJson(expected));
    }
    /* R22 in the program: a /2 case file carrying a criteria file, judged offline by the bundled R21 */
    const v2 = caseFile({ criteria: [{ standard: "STD-2026-0001-x", portion: null, designation: "x", edition: "1", issuer: "x", citation: "x",
      access: "paywalled", body: null, binds: false, passages: [], label: "Benchmark · not binding", access_words: word("label.standardaccess.paywalled") }] });
    writeFileSync(join(dir, "v2.zip"), v2.parts[0]);
    const v2out = JSON.parse(run("v2.zip").replace(/^[^{]*/s, ""));
    assert.equal(v2out.format, "bio-case-file/2");
    assert.equal(canonicalJson(v2out), canonicalJson(await CC.checkCaseFile({ parts: v2.parts })));
    assert.deepEqual(v2out.standards_use.unjudged.map((u) => [u.standard, u.check]), [["STD-2026-0001-x", "COPYRIGHTED_TEXT_CARRIED"]]);
    assert.match(P.text.split("\n")[0], /^\/\/ Civicsmith case checker \(bio-case-file\/1, bio-case-file\/2, bio-case-file\/3, bio-case-file\/4\)\./);
    assert.equal(run("part1.zip", "part2.zip").split("\n")[0], `${A}: ${word("screen.imported.result.part")}`);
    assert.equal(JSON.parse(run("part1.zip", "part2.zip").replace(/^[^{]*/s, "")).calculations[0].result, "agrees");
    /* a file it cannot read: exit status 2, saying so */
    assert.throws(() => run("nope.zip"), (e) => e.status === 2 && like("case-checker.text.read", { path: "nope.zip" }).test(e.stdout.trimEnd()));
    assert.throws(() => run(), (e) => e.status === 2 && /usage:/.test(e.stdout));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R13: runProgram, the program's own entry, answers what it prints and its status", async () => {
  const cf = caseFile();
  const files = new Map([["a.zip", cf.parts[0]]]);
  const out = await CC.runProgram(["a.zip"], async (p) => { if (!files.has(p)) throw new Error("no such file"); return files.get(p); });
  assert.equal(out.status, 0);
  assert.equal(out.text.split("\n")[0], `${A}: ${word("screen.imported.result.yes")}`);
  assert.equal((await CC.runProgram([], async () => null)).status, 2);
  assert.equal((await CC.runProgram(["--help"], async () => null)).status, 0);
});

/* R25: a fresh process measures the module's import as bundler R31 measures a global scope (`measureStart`: a fresh import,
 * timed), with every JSON.parse of the program's data counted, then reads the program by each way in: the parse count
 * shows when the program was built from its data. */
function measuredReads(read) {
  const here = new URL("../../../", import.meta.url);
  const script = `
    const parse = JSON.parse; let parses = 0;
    JSON.parse = function (t, ...a) { if (typeof t === "string" && t.startsWith('{"sha256":') && t.length > 100000) parses++; return parse.call(this, t, ...a); };
    const { measureStart } = await import(${JSON.stringify(new URL("scripts/fleet-bundle.mjs", here).href)});
    const member = (outfile) => ({ name: "case-checker", abs: ${JSON.stringify(fileURLToPath(here))}, bundle: { outfile } });
    const index = await measureStart(member("src/case-checker/index.mjs"));
    const data = await measureStart(member("src/case-checker/program.mjs"));
    const m = await import(${JSON.stringify(new URL("src/case-checker/index.mjs", here).href)});
    const atImport = parses;
    const t1 = performance.now();
    const first = (${read})(m);
    const firstMs = performance.now() - t1, afterFirst = parses;
    const second = (${read})(m);
    const same = m.caseCheckerProgramText() === m.caseCheckerProgramText();
    m.caseCheckerProgram(); m.caseCheckerPublicReads().casechecker.read({});
    JSON.parse = parse;
    process.stdout.write(JSON.stringify({ index, data, atImport, afterFirst, afterAll: parses, firstMs, first, second, same }));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("R25: importing the module builds no text of the program; it is read once, on the first read of the program (caseCheckerProgramText, caseCheckerProgram or the casechecker read), and reused after", async () => {
  const built = await buildProgram();
  const ways = {
    caseCheckerProgramText: "(m) => m.caseCheckerProgramText().text",
    caseCheckerProgram: "(m) => m.caseCheckerProgram().program",
    casechecker: "(m) => m.caseCheckerPublicReads().casechecker.read({}).program",
  };
  for (const [way, read] of Object.entries(ways)) {
    const r = measuredReads(read);
    assert.equal(r.index.measured, true, r.index.reason);
    assert.equal(r.data.measured, true, r.data.reason);
    assert.equal(r.atImport, 0, `${way}: nothing of the program is built when the module is evaluated`);
    assert.equal(r.afterFirst, 1, `${way}: the first read reads the program, once`);
    /* the program read equals the built file, byte for byte */
    assert.ok(Buffer.from(r.first, "utf8").equals(Buffer.from(built.text, "utf8")), way);
    /* control: a second read, by any way in, reads nothing again, and answers the same */
    assert.equal(r.afterAll, 1, `${way}: no later read reads the program again`);
    assert.equal(r.second, r.first, way);
    assert.equal(r.same, true, way);
    console.log(`R25 ${way}: module import ${r.index.ms.toFixed(1)} ms (its program data ${r.data.ms.toFixed(1)} ms), first program read ${r.firstMs.toFixed(1)} ms`);
  }
  /* R13's bytes and SHA-256 unchanged, and R15 answers the same bytes */
  const p = CC.caseCheckerProgramText();
  assert.equal(p.sha256, sha(built.text));
  assert.equal(p.body_sha256, built.body_sha256);
  assert.ok(Object.isFrozen(p));
  assert.equal(CC.caseCheckerPublicReads().casechecker.read({}).program, built.text);
  /* the generated module exports the program only as data behind a function: no program text is an export's value */
  const G = await import("../../../src/case-checker/program.mjs");
  assert.deepEqual(Object.keys(G), ["programData"]);
  assert.equal(typeof G.programData, "function");
  for (const k of ["PROGRAM", "PROGRAM_SHA256", "PROGRAM_BODY_SHA256"]) assert.equal(k in CC, false, k);
});
