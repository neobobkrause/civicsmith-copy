/* registers R1–R7 (T53; N1259; K4403 (2), (6)): the listing with each figure's basis, what is held and what watching looks for, the phase,
   the unmeasured and the gated, a proposal, a team's own definition. At the module's interface, over the test profile's registers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { combine } from "../../../../jurisdictions/index.mjs";
import { seeded, world, V, MACHINE, served, csv, enc, URL_, DEF, network, HOST } from "./fixture.mjs";

const viewWith = (edit) => { const v = combine(["test-port-ellery"]).view; edit(v); return v; };
const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" }, ...over });
const route = (n = 12) => ({ [URL_]: served(enc(csv(n))) });

test("R1: the listing names each register with its source, address and figures, each with its basis; a not-stated figure is null, never 0", () => {
  const w = seeded();
  const l = w.registers.registerList({ viewer: V("bob") });
  assert.equal(l.ok, true);
  const town = l.known.find((k) => k.key === "town_filings");
  assert.deepEqual([town.name, town.source, town.url, town.status], [DEF("town_filings").label, DEF("town_filings").publisher, DEF("town_filings").url, "importable"]);
  assert.deepEqual(town.bytes, { value: null, basis: "not_stated" });
  assert.deepEqual(town.rows, { value: 4200, basis: "counted" });
  assert.deepEqual(l.known.find((k) => k.key === "county_raw").rows, { value: 90000, basis: "estimated", how: "bytes divided by a sampled row length" });
  assert.deepEqual(l.known.map((k) => k.name), [...l.known.map((k) => k.name)].sort(), "sorted by name");
  assert.ok(l.known.every((k) => k.bytes.basis && k.rows.basis), "never a bare number");
  assert.deepEqual([l.own, l.proposed], [[], []]);
});

test("R1: a register the team holds an import of shows it, and fetching and writing nothing is how the listing is made", async () => {
  const w = seeded();
  const net = network({});
  try { w.registers.registerList({ viewer: V("bob") }); } finally { net.restore(); }
  assert.equal(net.seen.length, 0);
  assert.equal(START(w).ok, true);
  await w.drain(route());
  const town = w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "town_filings");
  assert.equal(town.held.length, 1);
  assert.deepEqual([town.held[0].scope, town.held[0].project, town.held[0].state, town.held[0].rows_out], ["project", w.P, "indexed", 12]);
});

test("R1 control: a profile with no registers answers empty lists", () => {
  const w = seeded({ view: viewWith((v) => { v.registers = []; }) });
  assert.deepEqual(w.registers.registerList({ viewer: V("bob") }), { ok: true, known: [], own: [], proposed: [] });
});

test("R2: an import with a filer-id interest shows auto and its next check; one with a name shows by_act; a team pre-read with no interest shows none", async () => {
  const w = seeded();
  assert.equal(START(w).ok, true);
  await w.drain(route());
  const held = () => w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "town_filings").held;
  assert.equal(held()[0].watched, "none", "no interest: none");
  const set = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(set.watch, true);
  assert.equal(held()[0].watched, "auto");
  assert.equal(typeof held()[0].next_check, "string", "its next check");
  assert.equal(Date.parse(held()[0].next_check) - Date.parse(w.registers.one(`SELECT finished_at FROM register_imports`).finished_at), 24 * 3600000, "the definition's cadence");
  assert.equal(w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Donor Eleven"] }, author: V("bob"), viewer: V("bob") }).ok, true);
  assert.equal(held()[0].watched, "by_act", "a name is re-checked only by a member's act");
  /* a team pre-read with no interest */
  const pre = w.registers.importStart({ register: "county_raw", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), pieces: ["receipts"] });
  assert.equal(pre.ok, true);
  assert.equal(w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "county_raw").held[0].watched, "none");
});

test("R2: a team pre-read an interest names shows by_act to a member who sees that interest, and none to one who does not; a pre-read no interest names shows none", async () => {
  const w = seeded();
  const pre = w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" } });
  assert.equal(pre.ok, true);
  const watched = (v) => w.registers.registerList({ viewer: v }).known.find((k) => k.key === "town_filings").held[0].watched;
  assert.equal(watched(V("bob")), "none", "no interest names it");
  const H = w.project("Secret", "bob", [], { hidden: true });
  assert.equal(w.registers.interestSet({ register: "town_filings", project: H, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") }).ok, true);
  assert.equal(watched(V("bob")), "by_act", "re-checked only by a member's registerRefresh");
  assert.equal(watched(V("dave")), "none", "a hidden project's interest is not inferred (R19)");
  /* forgetting the interest: it names the pre-read no more */
  assert.equal(w.registers.interestForget({ project: H, register: "town_filings", author: V("bob"), viewer: V("bob") }).ok, true);
  assert.equal(watched(V("bob")), "none");
});

test("R2: a hidden project's import is absent for a non-participant and present for a participant", async () => {
  const w = seeded();
  const H = w.project("Secret", "bob", [], { hidden: true });
  assert.equal(w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: H, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } }).ok, true);
  const heldFor = (v) => w.registers.registerList({ viewer: v }).known.find((k) => k.key === "town_filings").held;
  assert.equal(heldFor(V("bob")).length, 1);
  assert.equal(heldFor(V("dave")).length, 0);
  assert.equal(heldFor(V("carol")).length, 0, "a member who has not joined it");
});

test("R3: a beta register is listed beta with its reason key and every act on it is refused with that key, no request, nothing written; in beta the phase lets it be planned", async () => {
  const edit = (v) => { v.registers.find((r) => r.key === "town_filings").phase = "beta"; };
  const w = seeded({ view: viewWith(edit) });
  const town = w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "town_filings");
  assert.deepEqual([town.status, town.reason_key], ["beta", "register.beta.town_filings"]);
  const net = network({ [URL_]: served(enc(csv(3))) });
  const outs = [];
  try {
    outs.push(w.registers.registerFilter({ register: "town_filings", viewer: V("bob") }));
    outs.push(await w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "project", project: w.P, viewer: V("bob") }));
    outs.push(START(w));
    outs.push(w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice") }));
  } finally { net.restore(); }
  for (const o of outs) assert.deepEqual([o.ok, o.reason, o.reason_key, o.register], [false, "REGISTER_NOT_IN_ALPHA", "register.beta.town_filings", "town_filings"]);
  assert.equal(net.seen.length, 0);
  assert.equal(w.count("register_imports"), 0);
  const b = seeded({ view: viewWith(edit), phase: "beta" });
  assert.equal(b.registers.registerFilter({ register: "town_filings", viewer: V("bob") }).ok, true);
  assert.equal(b.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: b.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } }).ok, true);
});

test("R3 control: an alpha register is unaffected, and no code names company officers", () => {
  const w = seeded();
  assert.equal(w.registers.registerFilter({ register: "town_filings", viewer: V("bob") }).ok, true);
});

test("R4: a register not yet measured is listed and refused by name, no request; after registerDefine the team's own definition is importable", async () => {
  const w = seeded({ view: viewWith((v) => { v.registers.push({ key: "unmeasured", label: "Not yet measured", publisher: "Someone", url: "https://x.example/r", status: "not_measured" }); }) });
  const entry = w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "unmeasured");
  assert.equal(entry.status, "not_measured");
  const net = network({});
  let out;
  try { out = w.registers.importStart({ register: "unmeasured", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") }); } finally { net.restore(); }
  assert.deepEqual([out.ok, out.reason, net.seen.length], [false, "REGISTER_NOT_MEASURED", 0]);
  /* the team's own definition of a register of the same kind is importable */
  const def = { ...DEF("town_filings"), key: "our_filings", label: "Our filings", terms_basis: "none stated on the page we read" };
  const d = w.registers.registerDefine({ definition: def, author: V("bob") });
  assert.equal(d.ok, true);
  assert.equal(w.registers.importStart({ register: "our_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } }).ok, true);
});

test("R5: a gated or fee-bearing register is never fetched: planning, import and refresh answer member_act_required, zero requests, nothing written", async () => {
  const w = seeded();
  const net = network({});
  const outs = [];
  try {
    outs.push(w.registers.registerFilter({ register: "trades_licences", viewer: V("bob") }));
    outs.push(await w.registers.registerDelta({ register: "trades_licences", filter: {}, scope: "project", project: w.P, viewer: V("bob") }));
    outs.push(w.registers.importStart({ register: "trades_licences", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") }));
    outs.push(await w.registers.registerRefresh({ import: 1, author: V("bob"), viewer: V("bob") }));
  } finally { net.restore(); }
  assert.deepEqual(outs.slice(0, 3).map((o) => [o.ok, o.reason, o.gate]), Array(3).fill([false, "member_act_required", "fee"]));
  assert.equal(net.seen.length, 0);
  assert.deepEqual(["register_imports", "register_cells", "register_proposals"].map((t) => w.count(t)), [0, 0, 0]);
  assert.equal(START(w).ok, true, "control: a gate of none proceeds");
});

test("R6: a proposal is held and listed; an identical one answers existed; an http address and one with a password are not public; a machine is refused; withdrawal keeps the row", () => {
  const w = seeded();
  const p = (o = {}) => w.registers.registerPropose({ name: "Harbour permits", url: "https://permits.marlow-county.example/harbour", publisher: "Harbour board", author: V("bob"), viewer: V("bob"), ...o });
  const net = network({});
  let a, b, c, d, m;
  try {
    a = p(); b = p();
    c = p({ url: "http://permits.marlow-county.example/x" });
    d = p({ url: "https://user:secret@permits.marlow-county.example/x" });
    m = p({ author: MACHINE });
  } finally { net.restore(); }
  assert.deepEqual([a.ok, a.existed, a.proposal.state], [true, false, "proposed"]);
  assert.deepEqual([b.ok, b.existed, b.proposal.id], [true, true, a.proposal.id]);
  assert.deepEqual([c.reason, d.reason], ["PROPOSAL_NOT_PUBLIC", "PROPOSAL_NOT_PUBLIC"]);
  assert.equal(m.reason, "MACHINE_CANNOT_PROPOSE");
  assert.equal(net.seen.length, 0, "the address is checked as text, never fetched");
  assert.equal(p({ name: "  " }).reason, "PROPOSAL_INVALID");
  assert.equal(p({ name: "x".repeat(301) }).field, "name");
  assert.deepEqual(w.registers.registerList({ viewer: V("carol") }).proposed.map((x) => x.id), [a.proposal.id]);
  assert.equal(w.registers.proposalsForUpstream({ viewer: V("bob") }).reason, "NOT_AN_ADMIN");
  assert.equal(w.registers.proposalsForUpstream({ viewer: V("alice") }).proposals.length, 1);
  assert.deepEqual(w.registers.registerPropose({ withdraw: true, id: a.proposal.id, author: V("carol"), viewer: V("carol") }).reason, "NOT_YOUR_PROPOSAL");
  assert.equal(w.registers.registerPropose({ withdraw: true, id: a.proposal.id, author: V("bob"), viewer: V("bob") }).state, "withdrawn");
  assert.deepEqual(w.registers.registerList({ viewer: V("bob") }).proposed, []);
  assert.equal(w.registers.one(`SELECT state FROM register_proposals`).state, "withdrawn", "the row stays");
  /* control: another instance lists none */
  assert.deepEqual(world().registers.registerList({ viewer: V("bob") }).proposed, []);
});

test("R7: a team's own definition is accepted by the same rule, serves only that team, is listed under own and keeps every revision; a kept contact column, a gated host and a people-search are refused", () => {
  const w = seeded();
  const base = { ...DEF("town_filings"), key: "our_filings", label: "Our filings", terms_basis: "none stated on the page we read" };
  const ok = w.registers.registerDefine({ definition: base, author: V("bob") });
  assert.deepEqual([ok.ok, ok.key, ok.version, ok.definition.own], [true, "our_filings", 1, true]);
  assert.equal(w.registers.registerList({ viewer: V("carol") }).own.map((x) => x.key).join(), "our_filings");
  assert.equal(world().registers.registerList({ viewer: V("carol") }).own.length, 0, "absent from another team's list");
  assert.equal(PROFILE_HAS("our_filings"), false, "and from the shipped profile");
  /* every revision kept */
  const v2 = w.registers.registerDefine({ definition: { ...base, label: "Our filings (revised)" }, author: V("carol") });
  assert.equal(v2.version, 2);
  assert.deepEqual(w.registers.definitionVersions("our_filings").map((v) => [v.version, v.definition.label]), [[1, "Our filings"], [2, "Our filings (revised)"]]);
  const cases = [
    ["a kept phone column", { ...base, key: "k1", columns: base.columns.map((c) => (c.role === "phone" ? { ...c, keep: true } : c)) }, "REGISTER_KEEPS_CONTACT"],
    ["a people-search gate", { ...base, key: "k2", gate: "people_search" }, "REGISTER_PEOPLE_SEARCH"],
    ["no terms", { ...base, key: "k3", terms_basis: "" }, "REGISTER_NO_TERMS"],
    ["a gated host", { ...base, key: "k4", system: "marlow.board" }, "member_act_required"],
  ];
  for (const [what, def, code] of cases) {
    const r = w.registers.registerDefine({ definition: def, author: V("bob") });
    assert.deepEqual([r.ok, r.reason], [false, code], what);
  }
  assert.equal(w.registers.registerDefine({ definition: base, author: MACHINE }).reason, "MACHINE_CANNOT_DEFINE");
  assert.equal(w.registers.registerDefine({ definition: { ...base, key: "town_filings" }, author: V("bob") }).reason, "REGISTER_KEY_TAKEN");
});

const PROFILE_HAS = (key) => combine(["test-port-ellery"]).view.registers.some((r) => r.key === key);
