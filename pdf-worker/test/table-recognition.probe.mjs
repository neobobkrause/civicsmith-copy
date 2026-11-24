/* CPDF-18 — THE GO/NO-GO MEASUREMENT OF A TABLE-RECOGNITION STEP ON THE RUNTIME.
 * EXTRACTION-BREADTH §3.3 item 3 / §7 row 4. A PROBE: not a `.test.mjs`, so no
 * suite runs it (not `npm test`, not the regression workflow's `node --test`
 * globs), and it commits no product code.
 *
 *     node test/table-recognition.probe.mjs [--runs N]      (from pdf-worker/)
 *
 * WHAT IS MEASURED, AND WHY REPRODUCIBILITY ALONE CANNOT BE THE GO.
 * §3.3 asks two questions on CPDF-14's discipline: does the STRUCTURE reproduce
 * across runs on identical bytes (the anchor rule), and what does the step
 * cost. CPDF-14 asked them of a MODEL, where reproducibility is the hard part.
 * The only table step the runtime can run without an account, a credential or a
 * network is a DETERMINISTIC geometric one over pdf.js positions
 * (`table-candidate.mjs`), and for deterministic code "the structure came back
 * the same five times" is an equality that costs nothing to produce — CLAUDE.md's
 * rule, which would make a GO on reproducibility alone a verdict the code wrote
 * for itself. So the verdict is PRE-REGISTERED here, before a run, on three
 * criteria of which only the first is §3.3's own:
 *
 *   (R) REPRODUCIBLE — every page's structure digest identical across N workerd
 *       runs AND equal to the node run (a cross-runtime check is not free:
 *       CPDF-12 found workerd and node emit different deflate for one input);
 *   (A) ACCURATE — every ground-truth table found with EXACT rows x cols and at
 *       least 95% of its cells' text exact at the same (row, col);
 *   (F) NO FALSE TABLES — zero tables reported on the pages whose ground truth
 *       is "no table".
 *   GO iff R and A and F. Anything else is NO-GO, and cost is reported beside it.
 *
 * THE GROUND TRUTH IS HAND-READ, NOT PRODUCED BY THE CODE. Each fixture page was
 * rendered with Ghostscript (an independent renderer sharing no code with pdf.js
 * or this probe) at 110 dpi on 2026-09-18 and read by eye by the CPDF-18 worker;
 * the cell texts below are that reading. It is n=2 real tables and 13 real
 * table-free pages, all from the committed CPDF-20 fixture (public Oakland
 * Legistar attachments, provenance in `bio-plane/test/fixtures/cpdf20/`). A
 * GO at that n would be a GO at n=2 and would be SAID so; a NO-GO needs only one
 * failure, which is why the asymmetry is stated rather than hidden.
 */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "../../bio-plane/test/fixtures/cpdf20");
const RUNS = Number((process.argv.find((a, i) => process.argv[i - 1] === "--runs")) ?? 5);
const sha = (v) => createHash("sha256").update(v).digest("hex");

const GT_TABLES = {
  "legistar-73450.pdf#2": [{
    what: "Table 1: P.R.I.M.E. Alliance Grant Funding — UNRULED, 2 columns",
    cells: [["Grant Funds", "Amount"],
            ["Local Project Manager salary and benefits, Year One (not to exceed)", "$50,000"],
            ["Local Project Manager salary and benefits, Year Two (not to exceed)", "$50,000"],
            ["Total", "$100,000"]] }],
  "legistar-73550.pdf#1": [{
    what: "Table 1 (SOS grant) — RULED, 3 columns, two-line header cells",
    cells: [["GRANTEE", "FY 2025-2026 Amount", "FY 2026-2027 Amount"],
            ["Service Opportunity for Seniors Meals on Wheels", "$150,000", "$150,000"],
            ["TOTAL", "$150,000", "$150,000"]] }],
};
/* Pages whose ground truth is NO TABLE. 73545 p5 is a two-column block of
   signature lines — a FORM layout, judged not a data table; it is named
   because it is the page a geometric step is most likely to call one. */
const GT_NONE = ["legistar-73450.pdf#0", "legistar-73450.pdf#1",
  "legistar-73545.pdf#0", "legistar-73545.pdf#1", "legistar-73545.pdf#2", "legistar-73545.pdf#3",
  "legistar-73545.pdf#4", "legistar-73545.pdf#5", "legistar-73545.pdf#6",
  "legistar-73550.pdf#0", "legistar-73550.pdf#2", "legistar-73618.pdf#0", "legistar-73618.pdf#1"];
const PAGES = [...Object.keys(GT_TABLES), ...GT_NONE];

const n = (s) => s.replace(/\s+/g, " ").trim();
const digest = (tables) => sha(JSON.stringify(tables));

/* ── node arm ── */
if (typeof Math.sumPrecise !== "function") Math.sumPrecise = (v) => { let s = 0; for (const x of v) s += x; return s; };
const { tablesOnPage } = await import("./table-recognition-worker.mjs");
const { CANDIDATE } = await import("./table-candidate.mjs");
const bytesOf = (key) => new Uint8Array(readFileSync(join(FIX, key.split("#")[0])));
const nodeRes = {};
for (const key of PAGES) nodeRes[key] = await tablesOnPage(bytesOf(key), Number(key.split("#")[1]));

/* ── workerd arm ── */
const { Miniflare } = await import("miniflare").catch(() =>
  import(join(HERE, "../../bio-plane/node_modules/miniflare/dist/src/index.js")));
const { build } = await import("esbuild").catch(() =>
  import(join(HERE, "../../bio-plane/node_modules/esbuild/lib/main.js")));
const WORK = mkdtempSync(join(tmpdir(), "cpdf18-tables-"));
const bundle = join(WORK, "tables.bundled.mjs");
await build({ entryPoints: [join(HERE, "table-recognition-worker.mjs")], bundle: true, format: "esm",
  platform: "neutral", external: ["cloudflare:workers", "node:*"], outfile: bundle, logLevel: "silent" });
const mf = new Miniflare({ modules: true, modulesRoot: "/", scriptPath: bundle,
  script: readFileSync(bundle, "utf8"), compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] });

const wd = {};
for (const key of PAGES) {
  wd[key] = { digests: new Set(), wall: [], last: null };
  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now();
    const res = await mf.dispatchFetch(`http://x/tables?page=${key.split("#")[1]}`, { method: "POST", body: bytesOf(key) });
    const j = await res.json();
    wd[key].wall.push(performance.now() - t0);
    if (!j.ok) { wd[key].digests.add(`THREW:${j.message}`); continue; }
    wd[key].digests.add(digest(j.tables));
    wd[key].last = j;
  }
}
await mf.dispose();
rmSync(WORK, { recursive: true, force: true });

/* ── scoring ── */
console.log(`CANDIDATE ${CANDIDATE.name} ${CANDIDATE.version} ${JSON.stringify(CANDIDATE)}`);
console.log(`RUNS ${RUNS} workerd runs per page + 1 node run; ${PAGES.length} pages ` +
  `(${Object.keys(GT_TABLES).length} with a ground-truth table, ${GT_NONE.length} without)\n`);
let R = true, A = true, F = true;
const walls = [];
for (const key of PAGES) {
  const w = wd[key];
  const nd = digest(nodeRes[key].tables);
  const reproducible = w.digests.size === 1 && w.digests.has(nd);
  if (!reproducible) R = false;
  walls.push(...w.wall);
  const got = w.last ? w.last.tables : nodeRes[key].tables;
  const med = [...w.wall].sort((a, b) => a - b)[Math.floor(w.wall.length / 2)];
  console.log(`${key.padEnd(22)} items ${String(nodeRes[key].items).padStart(4)}  workerd digests ${w.digests.size}` +
    `  = node ${w.digests.has(nd) ? "yes" : "NO"}  tables ${got.length}  wall median ${med.toFixed(0)} ms`);
  for (const t of got) console.log(`      found ${t.rows}x${t.cols} at [${t.rect.join(", ")}]  ${JSON.stringify(t.cells).slice(0, 220)}`);
  if (GT_NONE.includes(key) && got.length) { F = false; console.log(`      FALSE TABLE(S): ${got.length} on a page whose ground truth has none`); }
  for (const gt of GT_TABLES[key] || []) {
    const rows = gt.cells.length, cols = gt.cells[0].length;
    const all = gt.cells.flat().map(n);
    let best = null;
    for (const t of got) {
      let exact = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        if (t.cells[r] && t.cells[r][c] != null && n(t.cells[r][c]) === n(gt.cells[r][c])) exact++;
      if (!best || exact > best.exact) best = { t, exact };
    }
    const dims = best ? `${best.t.rows}x${best.t.cols}` : "none";
    const rate = best ? best.exact / all.length : 0;
    const okT = best && best.t.rows === rows && best.t.cols === cols && rate >= 0.95;
    if (!okT) A = false;
    console.log(`      GROUND TRUTH ${rows}x${cols} (${gt.what}) -> best match ${dims}, ` +
      `cells exact ${best ? best.exact : 0}/${all.length} (${(rate * 100).toFixed(1)}%) ${okT ? "PASS" : "FAIL"}`);
  }
}
walls.sort((a, b) => a - b);
console.log(`\nCOST  harness wall per page per run: median ${walls[Math.floor(walls.length / 2)].toFixed(0)} ms, ` +
  `max ${walls[walls.length - 1].toFixed(0)} ms over ${walls.length} calls — WALL in the miniflare harness, ` +
  `whole document parsed per call, NOT a Worker CPU figure (a Worker cannot time itself, D-56)`);
console.log(`\n(R) reproducible across ${RUNS} workerd runs and node: ${R ? "YES" : "NO"}`);
console.log(`(A) every ground-truth table exact in shape and >=95% of cells: ${A ? "YES" : "NO"}`);
console.log(`(F) no false tables on table-free pages: ${F ? "YES" : "NO"}`);
console.log(`\nVERDICT: ${R && A && F ? "GO (at n=2 real tables — say so)" : "NO-GO"}`);
process.exit(0);
