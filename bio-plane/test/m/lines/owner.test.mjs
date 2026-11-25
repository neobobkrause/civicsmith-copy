/* lines at its interface: the connection owner and its neighbours read (R14), the closed vocabularies (R15), the ops
   map (R16) and the read contract (R17). */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { world, ANN } from "./fixture.mjs";
import { ownerConformance, createRegistry, BOUNDS, defaultRegistry } from "../../../src/connection-grammar/index.mjs";
import { Lines, linesOps, ownerNeighbours, kinds, capacities, roles, CONNECTION_KINDS, LINE_KINDS, CAPACITIES, ROLES } from "../../../src/lines/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AT = "2022-06-15T12:00:00Z";

test("R14 lines registers once as the connection owner `lines`, one evidentiary kind per line kind (holds one per capacity) with the members' words, and its neighbours passes connection-grammar's owner-conformance battery", () => {
  const w = world();
  const owners = w.registry.owners();
  assert.deepEqual(owners.map((o) => o.owner), ["lines"]);
  assert.equal(owners[0].kinds.length, LINE_KINDS.length - 1 + CAPACITIES.length);
  assert.ok(owners[0].kinds.every((k) => k.class === "evidentiary" && k.word.trim()));
  assert.equal(w.registry.kindOf("line:holds:ex_officio").word, "held the post (ex officio)");
  assert.equal(w.registry.kindOf("line:chain"), null, "there is no chain read");
  w.l.migrate();
  assert.equal(w.registry.owners().length, 1, "once");
  /* the battery's fixture */
  const sees = "member:ann", blind = "member:outsider";
  const proj = w.project("PROJ-2026-0001", "ann");
  const o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board"), p = w.ent("person", "Ada Example");
  const inn = w.say("part_of", o, b, { valid: { from: "2010-01-01", to: "2030-12-31" } });
  w.say("reports_to", o, b, { role: "functional", valid: { from: "2000-01-01", to: "2009-12-31" } });
  const outId = w.l.linesOf({ entity: o, kinds: ["reports_to"], viewer: ANN }).lines[0].line_id;
  const und = w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01" } });
  const fenced = w.l.recordLine({ kind: "oversees", from: b, to: o, valid: { from: "2010-01-01", to: "2030-12-31" },
                                  basis: { statement: "said in the project's own meeting", project: proj }, by: ANN }).line_id;
  const r = ownerConformance({ owner: "lines", neighbours: (a) => w.l.neighbours(a), kinds: [...CONNECTION_KINDS],
    fixture: { node: o, at: AT, in: inn, out: outId, undetermined: und, viewers: { sees, blind }, fenced, expected: [inn, und, fenced] } });
  assert.deepEqual(r, { ok: true, failures: [] });
  /* through the registry, both grade axes kept, from either end */
  const viaReg = w.registry.neighbours({ owner: "lines", node: o, kinds: ["line:holds:elected"], at: AT, viewer: sees, scope: null });
  assert.deepEqual(viaReg.items.map((i) => [i.id, i.grade.assertion, i.grade.ends]), [[und, "D", ["D", "D"]]]);
  assert.equal(w.l.neighbours({ node: b, at: AT, viewer: sees, kinds: ["line:part_of"] }).items[0].id, inn, "the other end");
});

test("R14 neighbours pages by connection-grammar's bounds and answers a node over the hub bound as a hub with no items", () => {
  const w = world();
  const b = w.ent("body", "Port Board");
  const ids = [];
  for (let i = 0; i < 7; i++) ids.push(w.say("part_of", w.ent("office", `Desk ${i}`), b, { valid: { from: "2010-01-01", to: "2030-12-31" } }));
  /* small pages */
  const got = [];
  let next = { after: "", size: 3 };
  for (let n = 0; n < 10 && next; n++) {
    const a = w.l.neighbours({ node: b, at: AT, page: next, viewer: ANN });
    assert.ok(a.items.length <= 3);
    got.push(...a.items.map((i) => i.id));
    next = a.next;
  }
  assert.deepEqual(got.sort(), [...ids].sort(), "pages joined are the set");
  /* a hub, measured by direct rows so the test stays quick: the set over BOUNDS.hub */
  const hub = w.ent("body", "Everyone's Board");
  const one = w.one(`SELECT * FROM lines LIMIT 1`);
  for (let i = 0; i <= BOUNDS.hub; i++)
    w.st.sql.exec(`INSERT INTO lines (line_id, kind, from_entity, to_entity, valid_json, basis_form, basis_json, asserted_by, assertion, end_from, end_to, at)
                   VALUES (?, 'part_of', ?, ?, ?, 'testimony', ?, ?, 'D', 'D', 'D', ?)`,
                  `LIN-2026-${String(i).padStart(16, "h")}`, `ENT-2026-${String(50000 + i)}`, hub, one.valid_json, one.basis_json, ANN, one.at);
  const h = w.l.neighbours({ node: hub, at: AT, viewer: ANN });
  assert.deepEqual([h.items.length, h.hub.set_size], [0, BOUNDS.hub + 1]);
  assert.equal(w.l.neighbours({ node: hub, at: AT, viewer: undefined }).refused, "VIEWER_MISSING");
});

test("R15 kinds(), capacities() and roles(kind) answer the closed lists, frozen", () => {
  assert.deepEqual(kinds(), ["part_of", "post_in", "holds", "reports_to", "oversees", "appoints", "seat_on", "funds", "contracts_with",
    "acts_for", "responsible_for", "custodian_of", "successor_of", "belongs_to", "educated_at", "credentialed_by", "owns_interest_in",
    "related_to", "associate_of", "party_to", "appeal_of", "consolidated_with", "remanded_to", "arises_from"]);
  assert.deepEqual(capacities(), ["employee", "elected", "appointed", "acting", "interim", "ex officio", "board member", word("label.linecapacities.officer_or_director"),
    "partner", "military service", "volunteer", "contractor", "other"]);
  assert.deepEqual(roles("reports_to"), ["administrative", "functional", "budgetary"]);
  assert.deepEqual(roles("contracts_with"), ["buyer", "procuringEntity", "supplier", "tenderer", "funder", "enquirer", "payer", "payee",
    "reviewBody", "interestedParty"], "the OCDS party-role codelist, whole");
  assert.deepEqual(roles("party_to"), ["plaintiff", "defendant", "petitioner", "respondent", "appellant", "appellee", "cross_complainant",
    "cross_defendant", "intervenor", "real_party_in_interest", "amicus", "applicant", "protestant", "complainant", "interested_party", "other"]);
  for (const k of kinds()) if (!["reports_to", "contracts_with", "party_to"].includes(k)) assert.deepEqual(roles(k), [], `${k} takes no role`);
  assert.equal(roles("knows"), null);
  for (const l of [kinds(), capacities(), ROLES, CONNECTION_KINDS, ...kinds().map(roles)]) assert.ok(Object.isFrozen(l));
  const w = world();
  assert.equal(w.l.kinds(), kinds());
  assert.equal(w.l.capacities(), capacities());
  assert.equal(w.l.roles("reports_to"), roles("reports_to"));
});

test("R16 linesOps publishes one route arm per act and read, reading parameters from the url and acts from the body, each answering what its service answers", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), c = w.ent("proceeding", "Case one");
  const ops = (q, body) => linesOps(w.l, new URL(`https://plane.example/?${q}`), body);
  assert.deepEqual(Object.keys(ops("")).sort(), ["holderat", "line", "linecurrentthrough", "linerecord", "linesof", "linewithdraw", "partiesof", "proceedinglinks", "structureat"]);
  const rec = ops("", { kind: "holds", from: p, to: o, capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" },
                        basis: { statement: "I saw the oath" }, by: ANN }).linerecord();
  assert.equal(rec.ok, true);
  const pt = ops("", { kind: "party_to", from: p, to: c, role: "plaintiff", basis: { statement: "named in the caption" }, by: ANN }).linerecord();
  const v = `viewer=${encodeURIComponent(ANN)}`;
  assert.deepEqual(ops(`id=${rec.line_id}&${v}`).line(), w.l.readLine({ lineId: rec.line_id, viewer: ANN }));
  assert.deepEqual(ops(`entity=${o}&kinds=holds&${v}`).linesof(), w.l.linesOf({ entity: o, kinds: ["holds"], viewer: ANN }));
  assert.deepEqual(ops(`entity=${o}&at=2022-01-01&${v}`).structureat(), w.l.structureAt({ entity: o, at: "2022-01-01", viewer: ANN }));
  const held = ops(`office=${o}&at=2022-01-01&${v}`).holderat();
  assert.equal(held.holder, p);
  assert.deepEqual(held, w.l.holderAt({ office: o, at: "2022-01-01", viewer: ANN }));
  assert.deepEqual(ops(`proceeding=${c}&${v}`).partiesof(), w.l.partiesOf({ proceeding: c, viewer: ANN }));
  assert.deepEqual(ops(`proceeding=${c}&${v}`).proceedinglinks(), w.l.proceedingLinks({ proceeding: c, viewer: ANN }));
  assert.equal(ops("", { lineId: pt.line_id, reason: "wrong case", by: ANN }).linewithdraw().ok, true);
  const open = ops("", { kind: "holds", from: p, to: o, capacity: "acting", valid: { from: "2025-01-01" }, basis: { statement: "named acting" }, by: ANN }).linerecord();
  assert.equal(ops("", { lineId: open.line_id, day: "2025-06-30", basis: { statement: "the roster says so" }, by: ANN }).linecurrentthrough().ok, true);
  assert.equal(ops("", undefined).linerecord().reason, "UNKNOWN_LINE_KIND", "an absent body is an empty act");
});

test("R17 the table of lines (line_id, kind, from_entity, to_entity, capacity, withdrawal) and its bound_cache (line_id, from_instant, to_instant, precision, zone) are the stated read contract, holding what the reads answer", () => {
  const w = world();
  const cols = (t) => w.rows(`PRAGMA table_info(${t})`).map((c) => c.name);
  for (const c of ["line_id", "kind", "from_entity", "to_entity", "capacity", "withdrawn"]) assert.ok(cols("lines").includes(c), c);
  for (const c of ["line_id", "from_instant", "to_instant", "precision", "zone"]) assert.ok(cols("line_bound_cache").includes(c), c);
  for (const c of ["line_id", "reason", "by_actor", "at"]) assert.ok(cols("line_withdrawals").includes(c), c);
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master");
  const id = w.say("holds", p, o, { capacity: "interim", valid: { from: "2021-02-03", to: "2021-09-30" } });
  const row = w.one(`SELECT l.kind, l.from_entity, l.to_entity, l.capacity, l.withdrawn, c.from_instant, c.to_instant, c.precision, c.zone
                     FROM lines l JOIN line_bound_cache c USING (line_id) WHERE line_id=?`, id);
  assert.deepEqual({ ...row }, { kind: "holds", from_entity: p, to_entity: o, capacity: "interim", withdrawn: 0, from_instant: "2021-02-03",
                                 to_instant: "2021-09-30", precision: "day", zone: "America/Halifax" });
  w.l.withdrawLine({ lineId: id, reason: "wrong person", by: ANN });
  assert.equal(w.one(`SELECT withdrawn FROM lines WHERE line_id=?`, id).withdrawn, 1);
  assert.equal(w.one(`SELECT reason FROM line_withdrawals WHERE line_id=?`, id).reason, "wrong person");
  assert.ok(Lines);
  assert.ok(createRegistry);
});

test("R14 (K1563 (1)) the owner is registered once at load into the default registry; its neighbours takes the host the registry passes through, else the isolate's one instance, else refuses OWNER_HOST_AMBIGUOUS", () => {
  assert.ok(defaultRegistry.owners().some((o) => o.owner === "lines" && o.kinds.length === CONNECTION_KINDS.length));
  const a = world(), b = world();
  const oa = a.ent("office", "Harbour Master"), ba = a.ent("body", "Port Board");
  const id = a.say("part_of", oa, ba, { valid: { from: "2010-01-01", to: "2030-12-31" } });
  const viaHost = defaultRegistry.neighbours({ owner: "lines", host: { storage: a.st }, node: oa, kinds: ["line:part_of"], at: AT, viewer: ANN, scope: null });
  assert.deepEqual(viaHost.items.map((i) => i.id), [id]);
  assert.deepEqual(defaultRegistry.neighbours({ owner: "lines", host: { storage: b.st }, node: oa, at: AT, viewer: ANN, scope: null }).items, []);
  assert.equal(ownerNeighbours({ node: oa, at: AT, viewer: ANN }).refused, "OWNER_HOST_AMBIGUOUS", "several instances and no host");
  assert.equal(ownerNeighbours({ host: { storage: {} }, node: oa, at: AT, viewer: ANN }).refused, "OWNER_HOST_AMBIGUOUS", "a host with no instance");
  /* an isolate with one instance answers without a host */
  const fixture = fileURLToPath(new URL("./fixture.mjs", import.meta.url));
  const src = fileURLToPath(new URL("../../../src/connection-grammar/index.mjs", import.meta.url));
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", `
    const { world, ANN } = await import(${JSON.stringify(fixture)});
    const { defaultRegistry } = await import(${JSON.stringify(src)});
    const w = world(); const o = w.ent("office", "A"), b = w.ent("body", "B");
    const id = w.say("part_of", o, b, { valid: { from: "2010-01-01", to: "2030-12-31" } });
    const r = defaultRegistry.neighbours({ owner: "lines", node: o, at: "${AT}", viewer: ANN, scope: null });
    console.log(JSON.stringify([id, r.items.map((i) => i.id)]));`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const [one, got] = JSON.parse(out.trim().split("\n").pop());
  assert.deepEqual(got, [one]);
});
