/* G44 (fix round 6; K4662, K4665, K4655): a large workbook is refused, stated, before it can kill the object, and the
   largest one the add holds survives the workbook's whole lifecycle. Each case goes through `workbooksOps(...)` over the
   fixture's `world()`, the real modules on a real database, in a child process whose old space is capped as the plane's
   object leaves it (the sheet-worker-free stub engine answers every formula cell). Ids: R1 (amended: the order of its
   refusals, WORKBOOK_FILE_TOO_LARGE and WORKBOOK_TOO_LARGE), R2 (a read of a workbook stored over the bound) and R20 (a
   workbook is held whole up to the cells bound, and the largest one survives every act). The child's cap is runtime-
   limits' `capFor` (the one convention); the heavy cases here run alone (R-NOLOAD). */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { world, V, BASIC } from "./fixture.mjs";
import * as S from "./g44-shapes.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { WORKBOOK_FILE_MAX_BYTES, WORKBOOK_CELLS_MAX } from "../../../src/workbooks/index.mjs";
import { capFor } from "../../../src/byte-ledger.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const PRELOAD = join(HERE, "../../platform-sqlite.mjs");
const MB = 1e6;
const MiB = 1048576;

/** One job in a capped child: the lines it printed, as an object; `alive` when it reached its last line. */
async function inChild(t, shape, job, extra = "") {
  const dir = mkdtempSync(join(tmpdir(), "g44-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "book.xlsx");
  if (shape) writeFileSync(file, shape.bytes);
  const cap = capFor((shape ? shape.bytes.length : 20_000) / MiB);
  let stdout = "";
  try {
    ({ stdout } = await run(process.execPath, ["--import", PRELOAD, "--expose-gc", `--max-old-space-size=${cap}`,
      join(HERE, "g44-child.mjs"), shape ? file : "-", job, String(extra)], { maxBuffer: 1 << 28 }));
  } catch (e) { stdout = e.stdout || ""; }
  const out = Object.assign({}, ...stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  out.alive = "endMB" in out;
  out.cap = cap;
  t.diagnostic(`cap ${cap} MB, idle ${out.idleMB?.toFixed(1)}, end ${out.endMB?.toFixed(1)}, alive ${out.alive}`);
  return out;
}
const lifecycleOk = (r, why) => {
  assert.equal(r.alive, true, `${why}: the child must survive`);
  assert.equal(r.add.ok, true, why);
  for (const k of ["read", "lint", "inputs", "recompute"]) assert.equal(r[k].ok, true, `${why}: ${k} ${JSON.stringify(r[k])}`);
  /* explainLint lints the whole workbook before it looks for the finding: a workbook with none answers NO_SUCH_FINDING, having done the work */
  assert.ok(r.explain.ok || r.explain.reason === "NO_SUCH_FINDING", `${why}: explain ${JSON.stringify(r.explain)}`);
};

test("R1 R20 a workbook of one cell more than the bound (250,001 cells, a 7 MB declared text) at the real-shape cap is refused with its cell count and the bound, writes nothing, and the object lives", async (t) => {
  const f = S.exact(WORKBOOK_CELLS_MAX + 1);
  const r = await inChild(t, f, "add");
  assert.equal(r.alive, true, "the child must survive");
  assert.equal(r.add.reason, "WORKBOOK_TOO_LARGE");
  assert.equal(r.add.cells, WORKBOOK_CELLS_MAX + 1);
  assert.equal(r.add.bound_cells, WORKBOOK_CELLS_MAX);
  assert.equal(r.add.condition, "cell_count");
  assert.deepEqual(r.add.limit, { size: WORKBOOK_CELLS_MAX + 1, bound: WORKBOOK_CELLS_MAX, key: "limit.workbook.cells" });
  assert.equal(r.changed, false, "nothing is written");
  assert.equal(r.cells, 0);
});

test("R1 R2 control: a 23,103-cell workbook (1 MiB declared) adds, and readWorkbook, lint, inputsOf, explainLint and recompute answer in the same cap", async (t) => {
  const f = S.constants(7701);
  assert.equal(f.cells, 23103);
  const r = await inChild(t, f, "lifecycle");
  lifecycleOk(r, "23,103 cells");
  assert.equal(r.cells, 23103);
});

test("R1 R2 R20 a workbook of the bound's cells adds and its whole lifecycle answers at the real-shape cap, as constants and as one-character cells", async (t) => {
  const under = S.constants(83333);
  assert.ok(under.cells <= WORKBOOK_CELLS_MAX && under.cells > WORKBOOK_CELLS_MAX - 3);
  const r = await inChild(t, under, "lifecycle");
  lifecycleOk(r, "constants at the bound");
  assert.equal(r.cells, under.cells);
  const exact = S.minimal(WORKBOOK_CELLS_MAX / 8);
  assert.equal(exact.cells, WORKBOOK_CELLS_MAX, "exactly the bound is held");
  lifecycleOk(await inChild(t, exact, "lifecycle"), "minimal cells, exactly the bound");
});

test("R1 R2 R20 formula-heavy workbooks at the bound (two formulas a row, and three long formulas a row) survive every read and the recompute at the real-shape cap", async (t) => {
  for (const [label, f] of [["two formulas a row", S.formulas(83333, { perRow: 2 })], ["three long formulas a row", S.formulas(62500, { perRow: 3, pad: 5 })]]) {
    assert.ok(f.cells <= WORKBOOK_CELLS_MAX && f.cells > WORKBOOK_CELLS_MAX - 3, label);
    const r = await inChild(t, f, "lifecycle");
    lifecycleOk(r, label);
    assert.equal(r.cells, f.cells, label);
  }
});

test("R1 R20 the count bound fires on a workbook of one-character cells that is far under the byte bounds, naming the condition that fired; a workbook of few, large cells under the declared-text bound is held and every read answers", async (t) => {
  const many = S.minimal(WORKBOOK_CELLS_MAX / 8 + 1);
  assert.ok(many.cells > WORKBOOK_CELLS_MAX && many.declared < 8 * MiB);
  const a = await inChild(t, many, "add");
  assert.equal(a.alive, true);
  assert.equal(a.add.reason, "WORKBOOK_TOO_LARGE");
  assert.equal(a.add.condition, "cell_count");
  /* the count is the reader's at the cell it stopped counting: more than the bound, at most the file's */
  assert.ok(a.add.cells > WORKBOOK_CELLS_MAX && a.add.cells <= many.cells, `states ${a.add.cells}`);
  assert.equal(a.add.bound_cells, WORKBOOK_CELLS_MAX);
  assert.equal(a.changed, false);
  const large = S.wide(2300, 9000);
  assert.ok(large.declared < boundOf("office", "text_bytes"), "under the reader's declared-text bound");
  lifecycleOk(await inChild(t, large, "lifecycle"), "2,300 cells of 9,000 characters");
});

test("R1 F1 a file whose text is over the xlsx declared-text row (26.2 MB declared) is refused as WORKBOOK_FILE_TOO_LARGE with the declared size and the bound as MB, never NOT_A_WORKBOOK, and the object lives; a capture stored above the size gate is refused with its size", async (t) => {
  const f = S.constants(180300);
  assert.ok(f.declared > 26_000_000 && f.declared < 26_600_000, `declares ${f.declared}`);
  const r = await inChild(t, f, "add");
  assert.equal(r.alive, true, "the refusal must fit the real-shape cap");
  assert.equal(r.add.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(r.add.size, (f.declared / MB).toFixed(1));
  assert.ok(f.declared > boundOf("xlsx", "declared_text"), "over the xlsx row");
  assert.equal(r.add.bound, (boundOf("xlsx", "declared_text") / MB).toFixed(1));
  assert.equal(r.add.condition, "declared_text");
  assert.equal(r.add.limit.key, "limit.xlsx.declared_text");
  assert.equal(r.changed, false);
  /* in this process: a 41 MB capture that is not a workbook is told "file", from the store's head, before any byte loads */
  const w = world();
  for (const m of ["alice", "bob"]) w.member(m, m === "alice" ? { role: "admin" } : {});
  const P = w.project("Rates", "bob");
  const big = new Uint8Array(41 * MB).fill(7);
  const cap = w.capture(big).capSha;
  const asked = [];
  const bytesOf = w.wb.bytesOf;
  w.wb.bytesOf = async (sha) => { asked.push(sha); return bytesOf.call(w.wb, sha); };
  const before = w.snapshot();
  const good = { captureSha: cap, question: "What does it cost?", period: "FY2025", project: P, by: V("bob") };
  const g = await w.wb.addWorkbook(good);
  assert.equal(g.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(g.size, (big.length / MB).toFixed(1));
  assert.equal(g.bound, (WORKBOOK_FILE_MAX_BYTES / MB).toFixed(1));
  assert.equal(g.size_bytes, big.length);
  assert.equal(g.condition, "stored_size");
  assert.deepEqual(g.limit, { size: big.length, bound: WORKBOOK_FILE_MAX_BYTES, key: "limit.workbook.bytes" });
  assert.ok(g.detail && !/[{}]/.test(g.detail), "its words hold the figures");
  assert.deepEqual(asked, [], "the capture's bytes were not asked for");
  assert.deepEqual(w.snapshot(), before);
});

test("R1 the cheap refusals and a repeat read no cells, and a capture held in parts is gated by its total before its bytes are asked for", async () => {
  const w = world();
  for (const m of ["alice", "bob"]) w.member(m, m === "alice" ? { role: "admin" } : {});
  const P = w.project("Rates", "bob");
  const cap = w.capture(BASIC()).capSha;
  const reads = [];
  const text = xlsxEntry.text;
  xlsxEntry.text = async (...a) => { reads.push(a.length); return text.apply(xlsxEntry, a); };
  try {
    const good = { captureSha: cap, question: "What does it cost?", period: "FY2025", project: P, by: V("bob") };
    for (const [call, code] of [[{ ...good, question: "" }, "NO_QUESTION"], [{ ...good, period: "" }, "NO_PERIOD"], [{ ...good, project: "nope" }, "NO_PROJECT"]])
      assert.equal((await w.wb.addWorkbook(call)).reason, code);
    assert.deepEqual(reads, [], "a refused add reads no cells");
    assert.equal((await w.wb.addWorkbook(good)).already, false);
    assert.equal(reads.length, 1, "the first add reads once");
    assert.equal((await w.wb.addWorkbook(good)).already, true);
    assert.equal(reads.length, 1, "a repeat reads no cells");
    /* the read is given the cap, so the object holds no more than the bound */
    assert.equal(reads[0], 2);
  } finally { xlsxEntry.text = text; }
  /* a capture held in parts is stored only as its parts */
  const asked = [];
  const bytesOf = w.wb.bytesOf;
  w.wb.bytesOf = async (sha) => { asked.push(sha); return bytesOf.call(w.wb, sha); };
  const half = new Uint8Array(11 * 1024 * 1024).fill(1), other = new Uint8Array(11 * 1024 * 1024).fill(2);
  const whole = new Uint8Array(half.length + other.length); whole.set(half); whole.set(other, half.length);
  const held = w.capture(whole, { parts: [half, other] }).capSha;
  const r = await w.wb.addWorkbook({ captureSha: held, question: "q", period: "p", project: P, by: V("bob") });
  assert.equal(r.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(r.size_bytes, whole.length, "gated by the parts' total");
  assert.deepEqual(asked, [], "before its bytes are asked for");
  const small = w.capture(new Uint8Array(3000).fill(3), { parts: [new Uint8Array(1500).fill(3), new Uint8Array(1500).fill(3)] }).capSha;
  const s = await w.wb.addWorkbook({ captureSha: small, question: "q", period: "p", project: P, by: V("bob") });
  assert.notEqual(s.reason, "WORKBOOK_FILE_TOO_LARGE", "under the bound it is read as before");
  assert.deepEqual(asked, [small]);
  /* a capture the store holds nowhere is still not held, even before the other arguments are judged */
  w.ev.m.delete(cap);
  assert.equal((await w.wb.addWorkbook({ captureSha: cap, question: "", period: "", project: "", by: V("bob") })).reason, "CAPTURE_NOT_HELD");
});

test("R2 R1 a workbook stored over the bound by the earlier add is never a crash: every read and act that loads its cells answers WORKBOOK_TOO_LARGE with the stored count, at the real-shape cap", async (t) => {
  const r = await inChild(t, null, "old", WORKBOOK_CELLS_MAX + 5000);
  assert.equal(r.alive, true, "the child must survive");
  assert.equal(r.setup.ok, true);
  for (const k of ["read", "lint", "inputs", "explain", "recompute"]) {
    assert.equal(r[k].reason, "WORKBOOK_TOO_LARGE", k);
    assert.equal(r[k].cells, r.stored, k);
    assert.equal(r[k].bound_cells, WORKBOOK_CELLS_MAX, k);
  }
});
