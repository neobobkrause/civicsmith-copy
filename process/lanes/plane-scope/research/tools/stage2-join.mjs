// Stage 2 join: the plane program's import graph (esbuild's own parse) against the layer of each file.
// Run from the repository root: node process/lanes/plane-scope/research/tools/stage2-join.mjs
// Reads: process/modules/*, research/layers/layers.json, the source reached from bio-plane/src/plane/index.mjs.
// Writes: research/stage2/layer-edges.json. Builds in memory only (write: false); changes no product file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "../../../../../bio-plane/node_modules/esbuild/lib/main.js";

const order = readFileSync("process/modules/order.txt", "utf8").trim().split("\n");
const records = order.map((m) => [m, JSON.parse(readFileSync(`process/modules/${m}.json`, "utf8"))]);
const owner = (f) => { let b = null, l = -1; for (const [m, j] of records) for (const p of [...(j.files || []), ...(j.tests || [])]) if ((f === p || (p.endsWith("/") && f.startsWith(p))) && p.length > l) { b = m; l = p.length; } return b; };
const pos = (m) => order.indexOf(m) + 1;

const L = JSON.parse(readFileSync("process/lanes/plane-scope/research/layers/layers.json", "utf8"));
const placement = new Map(L.placements.map((p) => [p.module, p]));
/** The layer of one file: its module's layer, or, for a mixed module, the part that lists the file. */
function layerOf(file) {
  const m = owner(file); if (!m) return { layer: "unowned", module: null };
  const p = placement.get(m);
  if (!p.ambiguous) return { layer: p.layer === "outside" ? `outside/${(p.sublayer || "").replace(/^outside \/ /, "")}` : p.layer, module: m };
  for (const part of p.parts || []) if ((part.files || []).includes(file)) return { layer: part.layer, module: m, mixed: true };
  return { layer: "mixed-unlisted", module: m, mixed: true };
}

const r = await build({ entryPoints: ["bio-plane/src/plane/index.mjs"], bundle: true, format: "esm", platform: "neutral", write: false, metafile: true, external: ["cloudflare:workers", "node:*"], outfile: "out.mjs", logLevel: "silent" });
const inputs = r.metafile.inputs;
const files = Object.keys(inputs);

// wanted stacking, lowest first; a file may import its own rank or lower
const WANTED = ["outside/shared-foundation", "model", "middleware", "control-plane", "launcher", "ui"];
const TODAY = ["outside/shared-foundation", "model", "middleware", "ui", "control-plane", "launcher"];
const rank = (stack, layer) => stack.indexOf(layer);

const edges = [];
for (const f of files) for (const imp of inputs[f].imports || []) {
  if (imp.external || !inputs[imp.path]) continue;
  const a = layerOf(f), b = layerOf(imp.path);
  edges.push({ from: f, to: imp.path, fromModule: a.module, toModule: b.module, fromLayer: a.layer, toLayer: b.layer });
}
const matrix = {};
for (const e of edges) { const k = `${e.fromLayer} -> ${e.toLayer}`; matrix[k] = (matrix[k] || 0) + 1; }
const against = (stack) => edges.filter((e) => { const ra = rank(stack, e.fromLayer), rb = rank(stack, e.toLayer); return ra >= 0 && rb >= 0 && rb > ra; });
const unranked = edges.filter((e) => rank(WANTED, e.fromLayer) < 0 || rank(WANTED, e.toLayer) < 0);
const fileLayers = {}; for (const f of files) { const l = layerOf(f).layer; fileLayers[l] = (fileLayers[l] || 0) + 1; }
const group = (list) => { const g = {}; for (const e of list) { const k = `${e.fromLayer} -> ${e.toLayer}`; (g[k] ??= { count: 0, modulePairs: {}, examples: [] }); g[k].count++; const mp = `${e.fromModule}(${pos(e.fromModule)}) -> ${e.toModule}(${pos(e.toModule)})`; g[k].modulePairs[mp] = (g[k].modulePairs[mp] || 0) + 1; if (g[k].examples.length < 400) g[k].examples.push(`${e.from} -> ${e.to}`); } return g; };

const out = {
  about: "The plane program's import edges (esbuild metafile of bio-plane/src/plane/index.mjs, built in memory) joined to each file's layer (research/layers/layers.json; a mixed module's files take the layer of the part that lists them). An edge is 'against' a stacking when the importing file's layer is lower than the imported file's.",
  files: files.length, edges: edges.length, filesByLayer: fileLayers, edgesByLayerPair: matrix,
  wanted_lowest_first: WANTED, today_lowest_first: TODAY,
  againstWanted: group(against(WANTED)), againstToday: group(against(TODAY)),
  edgesWithAnUnrankedEnd: group(unranked),
};
mkdirSync("process/lanes/plane-scope/research/stage2", { recursive: true });
writeFileSync("process/lanes/plane-scope/research/stage2/layer-edges.json", JSON.stringify(out, null, 1));
const brief = (g) => Object.entries(g).map(([k, v]) => `  ${k}: ${v.count} edges, ${Object.keys(v.modulePairs).length} module pairs`).join("\n");
console.log(`files ${files.length}, edges ${edges.length}`);
console.log("files by layer:", JSON.stringify(fileLayers));
console.log("against the wanted stacking:\n" + (brief(out.againstWanted) || "  none"));
console.log("against today's stacking:\n" + (brief(out.againstToday) || "  none"));
console.log("edges with an end outside the six ranks:\n" + (brief(out.edgesWithAnUnrankedEnd) || "  none"));
