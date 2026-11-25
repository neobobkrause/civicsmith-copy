/* lines at its interface: one home per fact at the store's gate (R18), sight and the table classes (R19), and no
   conclusion drawn from lines (R20). */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { world, sha, ANN, MACHINE } from "./fixture.mjs";
import { CONNECTION_KINDS, LINE_KINDS, STRUCTURE_KINDS, CAPACITIES, ROLES } from "../../../src/lines/index.mjs";
import { FORBIDDEN_WORDS } from "../../../src/connection-grammar/index.mjs";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../../src");

test("R18 one home per fact at the store's gate: a line row holds no amount and no HYP- id as an end or a basis; nothing is written past a refusal", () => {
  const w = world();
  const o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const good = { kind: "funds", from_entity: o, to_entity: b, basis_json: JSON.stringify({ statement: "x" }) };
  assert.equal(w.record.storeGate("lines", "lines", good, "insert"), null);
  assert.equal(w.record.storeGate("lines", "lines", { ...good, amount: "1,000,000.00" }, "insert").code, "LINE_HOLDS_NO_AMOUNT");
  assert.equal(w.record.storeGate("lines", "lines", { ...good, currency: "USD" }, "insert").code, "LINE_HOLDS_NO_AMOUNT");
  assert.equal(w.record.storeGate("lines", "lines", { ...good, to_entity: "HYP-2026-0001" }, "insert").code, "LINE_NO_HYPOTHESIS");
  assert.equal(w.record.storeGate("lines", "lines", { ...good, from_entity: "HYP-2026-0004" }, "insert").code, "LINE_NO_HYPOTHESIS");
  assert.equal(w.record.storeGate("lines", "lines", { ...good, basis_json: JSON.stringify({ captureSha: "HYP-2026-0005", extent: { kind: "document" } }) }, "insert").code,
               "LINE_NO_HYPOTHESIS");
  assert.equal(w.record.storeGate("lines", "lines", { ...good, basis_json: JSON.stringify({ rule: "r", source: "HYP-2026-0002" }) }, "insert").code,
               "LINE_NO_HYPOTHESIS");
  const r = w.l.recordLine({ kind: "funds", from: o, to: b, basis: { statement: "HYP-2026-0003" }, by: ANN });
  assert.deepEqual([r.ok, r.reason], [false, "LINE_NO_HYPOTHESIS"], "recordLine asks the gate before it writes");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM lines`).n, 0);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM minted_ids WHERE id LIKE 'LIN-%'`).n, 0, "no id spent");
});

test("R18 holderAt has no second implementation in any module, structure is never written into entities' declared relations, and every bound_cache equals its rebuild", async () => {
  const dirs = readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(SRC, d.name, "index.mjs")));
  const holders = [];
  let imported = 0;
  for (const d of dirs) {
    let m;
    try { m = await import(join(SRC, d.name, "index.mjs")); } catch { continue; }
    imported++;
    for (const [k, v] of Object.entries(m)) {
      if (k === "holderAt") holders.push(d.name);
      if (typeof v === "function" && v.prototype && Object.getOwnPropertyNames(v.prototype).includes("holderAt")) holders.push(`${d.name}.${k}`);
    }
  }
  assert.ok(imported > 40, `the modules' exports were read (${imported})`);
  assert.deepEqual(holders, ["lines.Lines"]);
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const e = w.event("2020-01-01");
  const placed = ["holds", "seat_on"];
  for (const k of STRUCTURE_KINDS.filter((k) => !placed.includes(k)))
    w.say(k, o, b, { valid: { from: { event: e, edge: "start" }, to: "2030-01-01" } });
  assert.equal(STRUCTURE_KINDS.length, 13, "every structure kind is written below");
  w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01" } });
  w.say("seat_on", o, b);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM entity_relations`).n, 0);
  assert.equal(w.ents.readEntity({ entityId: o, viewer: ANN }).entity.relations.length, 0);
  assert.equal(w.move(e, "2019-05-05").ok, true);
  w.l.withdrawLine({ lineId: w.l.linesOf({ entity: o, viewer: ANN }).lines[0].line_id, reason: "dup", by: ANN });
  assert.deepEqual(w.record.rebuildAndCompare("lines", "line_bound_cache"), { same: true });
});

test("R19 sight: the registry is group-wide; a line citing a capture follows that capture's visibility; testimony inside a hidden project is fenced and uncounted; the tables are declared through declareTable, bound_cache derived-rebuildable", () => {
  const w = world();
  const proj = w.project("PROJ-2026-0001", "ann");
  const OUT = "member:outsider";
  const p = w.ent("person", "Ada Example"), q = w.ent("person", "Ben Example"), o = w.ent("office", "Harbour Master");
  const open = w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" } });
  const fencedT = w.l.recordLine({ kind: "holds", from: q, to: o, capacity: "acting", valid: { from: "2022-01-01", to: "2022-12-31" },
                                   basis: { statement: "the clerk told our project", project: proj }, by: ANN }).line_id;
  const s = w.held("INFO-2026-0009", sha("project memo"), { project: proj });
  const fencedC = w.l.recordLine({ kind: "post_in", from: o, to: w.ent("body", "Port Board"), basis: { captureSha: s, extent: { kind: "document" } }, by: ANN }).line_id;
  for (const id of [open, fencedT, fencedC]) assert.equal(w.l.readLine({ lineId: id, viewer: ANN }).found, true, `the participant sees ${id}`);
  assert.equal(w.l.readLine({ lineId: open, viewer: OUT }).found, true, "group-wide");
  assert.equal(w.l.readLine({ lineId: fencedT, viewer: OUT }).found, false, "fenced testimony");
  assert.equal(w.l.readLine({ lineId: fencedC, viewer: OUT }).found, false, "a fenced capture");
  assert.equal(w.l.readLine({ lineId: open, viewer: null }).found, false, "no viewer sees nothing");
  assert.equal(w.l.readLine({ lineId: fencedT, viewer: MACHINE }).found, true);
  /* uncounted: the participant's holderAt sees two lines, the outsider's one */
  assert.equal(w.l.holderAt({ office: o, at: "2022-06-01", viewer: ANN }).holder, null);
  assert.equal(w.l.holderAt({ office: o, at: "2022-06-01", viewer: OUT }).holder, p);
  assert.equal(w.l.linesOf({ entity: o, viewer: OUT }).count, 1);
  assert.equal(w.l.recordLine({ kind: "part_of", from: o, to: p, basis: { statement: "x", project: "PROJ-2026-0404" }, by: ANN }).reason, "NO_BASIS");
  assert.equal(w.l.recordLine({ kind: "part_of", from: o, to: p, basis: { captureSha: s, extent: { kind: "document" } }, by: OUT }).reason,
               "CAPTURE_NOT_HELD", "a capture the author may not see is not held for them");
  const decl = Object.fromEntries(w.record.declaredTables().filter((d) => d.module === "lines").map((d) => [d.name, d]));
  assert.deepEqual(Object.keys(decl).sort(), ["line_bound_cache", "line_current_through", "line_withdrawals", "lines"]);
  assert.deepEqual([decl.lines.sight, decl.lines.derive, decl.lines.export], ["source", "stored", "yes"]);
  assert.deepEqual([decl.line_bound_cache.derive, decl.line_bound_cache.key], ["derived-rebuildable", ["line_id"]]);
});

test("R20 the machine never concludes from lines: no read answers knows, a score, a rank, centrality or 'most connected'; a count of one kind is the only figure; no place is named in behaviour, defaults or outward text", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board"), c = w.ent("proceeding", "Case");
  w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" } });
  w.say("seat_on", o, b);
  w.say("party_to", p, c, { role: "plaintiff" });
  w.say("related_to", p, w.ent("person", "Cy Example"));
  const answers = [
    w.l.linesOf({ entity: p, viewer: ANN }), w.l.structureAt({ entity: o, at: "2022-01-01", viewer: ANN }),
    w.l.holderAt({ office: o, at: "2022-01-01", viewer: ANN }), w.l.partiesOf({ proceeding: c, viewer: ANN }),
    w.l.proceedingLinks({ proceeding: c, viewer: ANN }), w.l.neighbours({ node: p, at: "2022-01-01T00:00:00Z", viewer: ANN }),
    w.l.readLine({ lineId: w.l.linesOf({ entity: p, viewer: ANN }).lines[0].line_id, viewer: ANN }),
  ];
  const BANNED = /knows|score|rank|centrality|most.connected|network|suspicious|conflict|degree|influence/i;
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { assert.doesNotMatch(k, BANNED, `${path}.${k}`); walk(x, `${path}.${k}`); }
    else if (typeof v === "number") assert.ok(/(count|limit|set_size)$/.test(path) || /withdrawn$/.test(path), `${path} is a figure`);
  };
  answers.forEach((a, i) => walk(a, `answer${i}`));
  for (const k of CONNECTION_KINDS) for (const f of FORBIDDEN_WORDS) assert.ok(!k.word.toLowerCase().includes(f), k.word);
  const PLACE = /oakland|alameda|california|port ellery/i;
  const texts = [...CONNECTION_KINDS.map((k) => k.word), ...LINE_KINDS, ...CAPACITIES, ...Object.values(ROLES).flat(),
    w.l.recordLine({ kind: "x" }).detail, w.l.holderAt({ office: b, at: "2022-01-01", viewer: ANN }).detail,
    w.l.recordLine({ kind: "part_of", from: o, to: b, by: ANN }).detail];
  for (const t of texts) assert.doesNotMatch(String(t), PLACE);
  /* the default zone is the active profile's, a fictional one here */
  assert.equal(w.l.readLine({ lineId: w.l.linesOf({ entity: o, viewer: ANN }).lines[0].line_id, viewer: ANN }).line.bounds.given.zone, "America/Halifax");
});
