// Stage 2, tests half: the dependency graph's module pairs (graph/module-edges.json) joined to each module's layer.
// Run from the repository root: node process/lanes/plane-scope/research/tools/stage2-tests-join.mjs
// Writes research/stage2/test-edges.json. Reads only; changes no product file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "process/lanes/plane-scope/research/";
const G = JSON.parse(readFileSync(R + "graph/module-edges.json", "utf8"));
const L = JSON.parse(readFileSync(R + "layers/layers.json", "utf8"));
const place = new Map(L.placements.map((p) => [p.module, p]));
// One label for each module. A mixed module takes the layer that decides its place in the order:
// control-plane the front door, plane the launcher, the store parts and the two door-side parts middleware,
// the 14 model modules with a door-side handler the model.
const MIXED = { "control-plane": "front door", plane: "launcher", "store-assembly": "middleware", "store-services": "middleware", admission: "middleware", "signin-door": "middleware" };
const label = (m) => { const p = place.get(m); if (p.ambiguous) return MIXED[m] || "model"; if (p.layer === "outside") return (p.sublayer || "").includes("shared-foundation") ? "shared foundation" : "outside"; if (p.layer === "ui") return "UI"; return p.layer; };
const WANTED = ["shared foundation", "model", "middleware", "front door", "launcher", "UI"];
const rank = (l) => WANTED.indexOf(l);
const isImport = (k) => /^(import|export-from|dynamic-import|jsdoc-import|require)$/.test(k);
const sides = { code: {}, tests: {} };
const upwardTests = [];
for (const [f, t, counts] of G.edges) {
  const from = G.modules[f], to = G.modules[t]; if (from === to) continue;
  const a = label(from), b = label(to);
  let imp = [0, 0], other = [0, 0];
  for (let i = 0; i < counts.length; i += 3) { const k = G.kinds[counts[i]]; const tgt = isImport(k) ? imp : other; tgt[0] += counts[i + 1]; tgt[1] += counts[i + 2]; }
  for (const [side, idx] of [["code", 0], ["tests", 1]]) {
    if (!imp[idx] && !other[idx]) continue;
    const key = `${a} -> ${b}`; const s = (sides[side][key] ??= { pairs: 0, pairsWithImport: 0, imports: 0, otherReferences: 0, againstWanted: rank(a) >= 0 && rank(b) >= 0 && rank(b) > rank(a) });
    s.pairs++; if (imp[idx]) s.pairsWithImport++; s.imports += imp[idx]; s.otherReferences += other[idx];
  }
  if ((imp[1] || other[1]) && t > f) upwardTests.push({ from, fromPos: f + 1, to, toPos: t + 1, fromLayer: a, toLayer: b, imports: imp[1], other: other[1] });
}
// tests of the door, the launcher and the UI: which later-or-higher modules do they reach, and how
const focus = (pred) => upwardTests.filter(pred).reduce((o, e) => { const k = `${e.fromLayer} tests -> ${e.to} (${e.toPos}, ${e.toLayer})`; o[k] = (o[k] || { pairs: 0, imports: 0, other: 0 }); o[k].pairs++; o[k].imports += e.imports; o[k].other += e.other; return o; }, {});
const out = {
  about: "Module pairs of graph/module-edges.json by the layer of each end, code side and tests side apart. imports = import, export-from, dynamic-import, jsdoc-import; otherReferences = every other kind in the graph (file reads, folder listings, processes and Workers started, paths held, seen-in-a-run). A mixed module carries one label (see MIXED in the script).",
  wanted_lowest_first: WANTED, bySide: sides,
  testsReachingALaterModule: { pairs: upwardTests.length, byImport: upwardTests.filter((e) => e.imports).length },
  upwardFromTestsOf: { frontDoor: focus((e) => e.from === "control-plane"), launcher: focus((e) => e.from === "plane"), ui: focus((e) => e.fromLayer === "UI"), middleware: focus((e) => e.fromLayer === "middleware") },
};
mkdirSync(R + "stage2", { recursive: true });
writeFileSync(R + "stage2/test-edges.json", JSON.stringify(out, null, 1));
const show = (side) => Object.entries(sides[side]).filter(([, v]) => v.againstWanted).sort((x, y) => y[1].pairs - x[1].pairs).map(([k, v]) => `  ${k}: ${v.pairs} module pairs (${v.pairsWithImport} with an import), ${v.imports} imports, ${v.otherReferences} other references`).join("\n");
console.log("TESTS, against the wanted stacking:\n" + show("tests"));
console.log("CODE (whole repository, not only the plane's program), against the wanted stacking:\n" + show("code"));
console.log("tests reaching a LATER module:", out.testsReachingALaterModule);
for (const [k, v] of Object.entries(out.upwardFromTestsOf)) { console.log(`upward from tests of ${k}:`); for (const [kk, vv] of Object.entries(v)) console.log(`  ${kk}: imports ${vv.imports}, other ${vv.other}`); }
