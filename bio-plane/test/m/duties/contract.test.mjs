/* duties: the connection owner (R18), the ops map (R19), the read contract (R20) and the invariants (R21–R23). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, fictionalView, E, BOB, CAROL, MACHINE, evt, ZONE, SHA } from "./fixture.mjs";
import { DUTIES_CHECKS, DUTIES_TABLES, CONNECTION_KINDS, MODALITIES, SOURCE_KINDS, TRIGGER_KINDS, BASIS_KINDS, OCCURRENCE_STATES,
         OCCURRENCE_REASONS, DUTIES_REASON_WORDS, dutiesOps } from "../../../src/duties/index.mjs";
import { ownerConformance, derivedId, BOUNDS, defaultRegistry } from "../../../src/connection-grammar/index.mjs";
import { list as profiles, get as profile } from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AT = { value: "2026-03-01", precision: "day", zone: ZONE };
const row = (r, code) => {
  assert.equal(r.ok, false, `${code}: ${JSON.stringify(r).slice(0, 300)}`);
  assert.equal(r.reason, code);
  if (DUTIES_CHECKS[code]) assert.equal(r.check, DUTIES_CHECKS[code].check);
};

/* The owner fixture: at 2026-03-01 the clerk owes A (held then, withdrawn later: in), B (adopted after: out), C (held,
   no end stated: undetermined) and D (inside bob's project: fenced from carol). */
function owners() {
  const w = world();
  const P = w.project("bob");
  const at = (iso, f) => { w.at(iso); return f(); };
  const A = at("2026-01-10T12:00:00.000Z", () => w.declare().duty_id);
  const C = at("2026-01-15T12:00:00.000Z", () => w.declare().duty_id);
  const D = at("2026-01-20T12:00:00.000Z", () => w.declare({ project: P }).duty_id);
  const B = at("2026-04-01T12:00:00.000Z", () => w.declare().duty_id);
  at("2026-06-01T12:00:00.000Z", () => { w.duties.withdraw({ dutyId: A, reason: "repealed", by: BOB }); w.duties.withdraw({ dutyId: D, reason: "repealed", by: BOB }); });
  return { w, A, B, C, D };
}

test("R18 the module registers once as a connection owner, and its neighbours pass connection-grammar's owner-conformance battery", () => {
  const { w, A, B, C, D } = owners();
  const mine = w.registry.owners().find((o) => o.owner === "duties");
  assert.deepEqual(mine.kinds, CONNECTION_KINDS.map((k) => ({ ...k })));
  assert.deepEqual(CONNECTION_KINDS.map((k) => k.word), ["owes", word("duties.word.owed"), word("duties.word.holds_power"), "met by", "used in"]);
  const r = ownerConformance({
    owner: "duties", kinds: CONNECTION_KINDS.map((k) => ({ ...k })), neighbours: (args) => w.duties.neighbours(args),
    fixture: { node: E.clerk, at: AT, in: `${A}:owes`, out: `${B}:owes`, undetermined: `${C}:owes`, fenced: `${D}:owes`,
               expected: [`${A}:owes`, `${C}:owes`, `${D}:owes`], viewers: { sees: BOB, blind: CAROL } },
  });
  assert.deepEqual(r, { ok: true, failures: [] });
  /* through the registry: the obligee end, and "met by", a derived connection with its id */
  const viaReg = w.registry.neighbours({ owner: "duties", node: E.group, kinds: ["owed_to"], at: AT, viewer: BOB, scope: null });
  assert.deepEqual(viaReg.items.map((i) => [i.id, i.from, i.to]), [[`${A}:owed_to`, A, E.group], [`${C}:owed_to`, C, E.group], [`${D}:owed_to`, D, E.group]]);
  assert.equal(w.registry.neighbours({ owner: "duties", node: E.group, kinds: ["owed_to"], at: AT, viewer: CAROL, scope: null }).items.length, 2);
  w.event({ value: { value: "2026-02-02", precision: "day", zone: ZONE }, concerns: [E.clerk] });
  const resp = w.event({ value: { value: "2026-02-05", precision: "day", zone: ZONE }, concerns: [E.group] });
  w.at("2026-02-20T12:00:00.000Z");
  const e = w.declare({ trigger: { kind: "event", event_kind: "communication", entity: E.clerk } }).duty_id;
  const key = w.duties.occurrencesOf({ dutyId: e, asOf: "2026-02-20T12:00:00Z", viewer: BOB }).occurrences[0].key;
  w.duties.matchEvent({ dutyId: e, occurrenceKey: key, eventId: resp, reason: "the reply", by: BOB });
  const met = w.registry.neighbours({ owner: "duties", node: resp, kinds: ["met_by"], at: AT, viewer: BOB, scope: null });
  assert.equal(met.items.length, 1);
  const m = met.items[0];
  assert.equal(m.id, derivedId({ kind: "met_by", from: e, to: resp, as_of: "2026-03-01", method: m.derived.method }));
  assert.equal(w.registry.checkConnection(m).ok, true);
  assert.equal(w.registry.neighbours({ owner: "duties", node: resp, kinds: ["met_by"], at: { ...AT, value: "2026-02-01" }, viewer: BOB, scope: null }).items.length, 0,
    "as of a day before the match, it is not met by the event");
  assert.equal(w.duties.neighbours({ node: E.clerk, at: AT }).refused, "VIEWER_MISSING");
});

test("R18 a node past the hub bound is answered as a hub with no items, never a partial set", () => {
  const w = world();
  for (let i = 0; i <= BOUNDS.hub; i++) w.declare();
  const r = w.registry.neighbours({ owner: "duties", node: E.clerk, kinds: ["owes"], at: { ...AT, value: "2026-03-02" }, viewer: BOB, scope: null });
  assert.deepEqual(r.items, []);
  assert.equal(r.hub.set_size, BOUNDS.hub + 1);
});

test("R18 the read registered at load takes an optional host, else the isolate's one instance, else refuses OWNER_HOST_AMBIGUOUS (K1563 (1))", () => {
  const ask = (extra = {}) => defaultRegistry.neighbours({ owner: "duties", node: E.clerk, kinds: ["owes"], at: { ...AT, value: "2026-03-05" }, viewer: BOB, scope: null, ...extra });
  const one = world({ deps: { registry: defaultRegistry } });
  one.declare();
  assert.equal(ask().items.length, 1, "one instance in the isolate: it answers");
  const two = world({ deps: { registry: defaultRegistry } });
  two.declare();
  two.declare();
  assert.equal(ask().refused, "OWNER_HOST_AMBIGUOUS");
  assert.equal(ask({ host: one.host }).items.length, 1);
  assert.equal(ask({ host: two.host }).items.length, 2);
  assert.equal(ask({ host: {} }).refused, "OWNER_HOST_AMBIGUOUS", "a host with no duties instance");
  assert.equal(defaultRegistry.owners().filter((o) => o.owner === "duties").length, 1, "registered once");
});

test("R19 with no service injected, duties reaches the real modules through their factories on its host (K1563 (1))", () => {
  const none = { entities: undefined, standards: undefined, events: undefined, lines: undefined, money: undefined, provenance: undefined, content: undefined };
  const w = world({ deps: none });
  for (const k of Object.keys(none)) assert.equal(typeof w.duties[k], "object", k);
  assert.equal(w.duties.events.constructor.name, "Events");
  assert.equal(w.duties.money.constructor.name, "Money");
  const req = w.event({ value: { value: "2026-02-02", precision: "day", zone: ZONE }, concerns: [E.clerk] });
  const a = w.declare({ trigger: { kind: "event", event_kind: "communication", entity: E.clerk } });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const o = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: "2026-03-02T12:00:00Z", viewer: BOB }).occurrences;
  assert.deepEqual(o.map((x) => [x.trigger.ref, x.due.date.value, x.state]), [[req, "2026-02-12", "overdue"]]);
});

test("R19 dutiesOps publishes one route arm per act and read, with the control plane's stamps from the query, never the body", () => {
  const w = world();
  const ops = w.ops("by=member:bob&viewer=member:bob", {});
  assert.deepEqual(Object.keys(ops).sort(), ["duty", "dutyadopt", "dutydeclare", "dutiesof", "dutymatch", "dutyoccurrences", "dutypropose", "dutyrevise",
    "dutysetagainst", "dutytransition", "dutytransitions", "dutywithdraw", "powersof", "poweruses", "uselink", "useunlink", "reviewpropose",
    "dutyfromresponse", "dutiesarising"].sort());
  const body = { ...w.fields(), clause: "s1", by: "member:mallory" };
  const d = w.ops("by=member:bob&viewer=member:bob", body).dutydeclare();
  assert.equal(d.ok, true);
  assert.equal(d.adopted_by, BOB, "the stamp, not the body's by");
  row(w.ops(`by=${MACHINE}&viewer=${MACHINE}`, body).dutydeclare(), "DUTY_MEMBER_ACT_ONLY");
  assert.equal(w.ops(`id=${d.duty_id}&viewer=member:bob`).duty().duty.duty_id, d.duty_id);
  assert.equal(w.ops(`entity=${E.clerk}&viewer=member:bob`).dutiesof().count, 1);
  const occ = w.ops(`id=${d.duty_id}&as_of=2026-03-02T12:00:00Z&from=2026-01-01&to=2026-03-01&viewer=member:bob`).dutyoccurrences();
  assert.equal(occ.occurrences.length, 1);
  const key = occ.occurrences[0].key;
  assert.equal(w.ops("by=member:bob&viewer=member:bob", { dutyId: d.duty_id, occurrenceKey: key, state: "overdue", asOf: "2026-03-02T12:00:00Z",
    cause: "no reply" }).dutytransition().ok, true);
  assert.equal(w.ops(`id=${d.duty_id}&viewer=member:bob`).dutytransitions().count, 1);
  assert.equal(w.ops(`office=${E.clerk}&viewer=member:bob`).powersof().ok, true);
  assert.equal(w.ops(`id=${d.duty_id}&viewer=member:bob`).dutysetagainst().reason, "NOT_A_SET_AGAINST");
  const p = w.ops(`by=${MACHINE}&viewer=${MACHINE}`, { ...w.fields() }).dutypropose();
  assert.equal(p.label.machine_work, true);
  assert.equal(w.ops("by=member:bob&viewer=member:bob", { proposalId: p.proposal_id, clause: "s1" }).dutyadopt().ok, true);
  assert.equal(w.ops("by=member:bob&viewer=member:bob", { dutyId: d.duty_id, reason: "r", performance: { act: "x" } }).dutyrevise().version, 2);
  assert.equal(w.ops("by=member:bob&viewer=member:bob", { dutyId: d.duty_id, occurrenceKey: "OCC-x", eventId: evt("x"), reason: "r" }).dutymatch().reason,
    "NO_SUCH_EVENT");
  assert.equal(w.ops("by=member:bob&viewer=member:bob", { dutyId: d.duty_id, reason: "gone" }).dutywithdraw().ok, true);
});

test("R20 the duties and transitions tables are a stated read contract; every write stays this module's", () => {
  const w = world();
  w.declare();
  const cols = (t) => w.sqlRows(`PRAGMA table_info(${t})`).map((c) => c.name);
  for (const c of ["duty_id", "modality", "obligor", "obligee", "arising_in", "version", "withdrawn_at", "withdrawn_by", "withdraw_reason"]) assert.ok(cols("duties").includes(c), c);
  for (const c of ["duty_id", "occurrence_key", "state", "as_of", "at", "cause", "evidence_json", "by_member"]) assert.ok(cols("duty_transitions").includes(c), c);
  /* a later module joins them in its own SQL: obligor:, owed_to: */
  assert.deepEqual(w.sqlRows(`SELECT duty_id, modality, obligor, obligee, version FROM duties WHERE obligor=?`, E.clerk),
    [{ duty_id: "DUT-2026-0001", modality: "duty", obligor: E.clerk, obligee: E.group, version: 1 }]);
  /* arising_in (K1563): the capture the duty's source item rests on, else null; it follows a revision */
  const sha = w.passage("audit-report").capSha;
  const a = w.declare({ arising_in: sha });
  const p = w.declare({ arising_in: E.case });
  const col = (id) => w.sqlRows(`SELECT arising_in FROM duties WHERE duty_id=?`, id)[0].arising_in;
  assert.deepEqual([col("DUT-2026-0001"), col(a.duty_id), col(p.duty_id)], [null, sha, null]);
  w.duties.revise({ dutyId: p.duty_id, arising_in: sha, reason: "it arises in the audit's capture", by: BOB });
  assert.equal(col(p.duty_id), sha);
  /* a write through the store gate by another module is refused */
  assert.equal(w.record.storeGate("money", "duties", { duty_id: "x" }, "insert").reason, "STORE_GATE_MALFORMED");
});

test("R21 one home per fact at the store's gate: no amount, no HYP- id, no stored due date, no rewritten transition", () => {
  const w = world();
  const before = w.sqlRows(`SELECT COUNT(*) AS n FROM duty_versions`)[0].n;
  row(w.declare({ performance: { act: "respond, as HYP-2026-0003 supposes" } }), "HOLDS_HYPOTHESIS");
  row(w.declare({ time: { basis: "commitment", date: "2026-04-01", due: "2026-04-01" } }), "HOLDS_DUE_DATE");
  row(w.declare({ performance: { act: "pay", amount: "12.00" } }), "HOLDS_AMOUNT");
  row(w.duties.propose({ ...w.fields({ performance: { act: "see HYP-2026-0009" } }), by: MACHINE }), "HOLDS_HYPOTHESIS");
  assert.equal(w.sqlRows(`SELECT COUNT(*) AS n FROM duty_versions`)[0].n, before);
  assert.equal(w.sqlRows(`SELECT COUNT(*) AS n FROM duty_proposals`)[0].n, 0);
  /* the controls */
  assert.equal(w.declare({ performance: { act: "respond, as HYP 2026 supposes" } }).ok, true);
  assert.equal(w.declare({ time: { basis: "commitment", date: "2026-04-01" } }).ok, true);
  /* the gates are registered, once per table */
  for (const t of DUTIES_TABLES) assert.equal(w.record.registerStoreGate("duties", t.name, () => null).reason, "STORE_GATE_DECLARED", t.name);
  for (const t of ["duty_transitions", "duty_versions", "duty_matches"]) row(w.record.storeGate("duties", t, { table: t }, "update"), "APPEND_ONLY");
  /* no due date in any table */
  for (const t of DUTIES_TABLES) assert.ok(!w.sqlRows(`PRAGMA table_info(${t.name})`).some((c) => /due/.test(c.name)), t.name);
});

test("R22 sight: a duty inside a hidden project stays fenced and uncounted; the tables are declared through record-core.declareTable", () => {
  const w = world();
  const P = w.project("bob");
  const open = w.declare();
  const fenced = w.declare({ project: P });
  assert.equal(w.duties.readDuty({ dutyId: fenced.duty_id, viewer: BOB }).found, true);
  assert.deepEqual(w.duties.readDuty({ dutyId: fenced.duty_id, viewer: CAROL }), { ok: true, found: false, duty_id: fenced.duty_id });
  assert.equal(w.duties.readDuty({ dutyId: open.duty_id, viewer: CAROL }).found, true);
  assert.equal(w.duties.readDuty({ dutyId: open.duty_id }).found, false, "an absent viewer sees nothing");
  assert.equal(w.duties.dutiesOf({ entity: E.clerk, viewer: CAROL }).count, 1, "not counted for carol");
  assert.equal(w.duties.dutiesOf({ entity: E.clerk, viewer: BOB }).count, 2);
  row(w.duties.occurrencesOf({ dutyId: fenced.duty_id, asOf: "2026-03-02T12:00:00Z", viewer: CAROL }), "NO_SUCH_DUTY");
  w.duties.recordTransitions({ asOf: "2026-03-02T12:00:00Z" });
  assert.equal(w.duties.transitionsOf({ viewer: BOB }).count, 2);
  assert.equal(w.duties.transitionsOf({ viewer: CAROL }).count, 1);
  /* a duty arising in a capture follows that capture's bundle */
  const declared = w.record.declaredTables().filter((d) => d.module === "duties");
  assert.deepEqual(declared.map((d) => d.name), DUTIES_TABLES.map((t) => t.name));
  for (const d of declared) assert.deepEqual([d.purge, d.expunge, d.derive], ["clear", "none", "stored"]);
  assert.deepEqual(declared.map((d) => d.sight), DUTIES_TABLES.map(() => "source"));
  /* transitions are never purged but with their duty: a bundle's purge leaves them, the whole-store purge takes both */
  w.record.purge({ bundleId: P });
  assert.equal(w.sqlRows(`SELECT COUNT(*) AS n FROM duty_transitions`)[0].n, 2);
  w.record.purge({});
  for (const t of DUTIES_TABLES) assert.equal(w.sqlRows(`SELECT COUNT(*) AS n FROM ${t.name}`)[0].n, 0, t.name);
});

test("R23 the group's own checkpoints are never occurrences of a body's duty; no place is named; rules and vocabularies are the profile's", () => {
  const w = world();
  w.duties.registerTriggerSource("actions", () => [{ ref: "ACT-2026-0001-req", date: "2026-02-02" },
                                                    { ref: "PLN-2026-0001-step", date: "2026-02-03", group_checkpoint: true }]);
  const a = w.declare({ trigger: { kind: "source", source: "actions" } });
  const occ = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: "2026-03-02T12:00:00Z", viewer: BOB }).occurrences;
  assert.deepEqual(occ.map((o) => o.trigger.ref), ["ACT-2026-0001-req"]);
  /* no place in any vocabulary, translation or default: every name a held real profile covers is absent */
  /* (T48) with R33's reason codes and their words */
  const words = JSON.stringify({ DUTIES_CHECKS, CONNECTION_KINDS, MODALITIES, SOURCE_KINDS, TRIGGER_KINDS, BASIS_KINDS, OCCURRENCE_STATES,
                                 OCCURRENCE_REASONS, DUTIES_REASON_WORDS }).toLowerCase();
  const real = profiles().filter((p) => !p.test).map((p) => profile(p.id));
  assert.ok(real.length >= 1);
  for (const p of real) for (const c of [p.name, ...p.covers]) for (const part of String(c).toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 4))
    assert.ok(!words.includes(part), part);
  /* with no profile, nothing is assumed: the rule is undetermined and no response status is accepted */
  const bare = world({ view: {} });
  const b = bare.declare();
  const o = bare.duties.occurrencesOf({ dutyId: b.duty_id, asOf: "2026-03-02T12:00:00Z", viewer: BOB }).occurrences[0];
  assert.equal(o.state, "undetermined");
  assert.match(o.why, /hold no rule records_response/);
  /* a different fictional profile's rule moves the due date: it is data, not code */
  const other = world({ view: fictionalView({ deadlines: fictionalView().deadlines.map((d) => ({ ...d, amount: 5 })) }) });
  const c = other.declare();
  assert.equal(other.duties.occurrencesOf({ dutyId: c.duty_id, asOf: "2026-03-02T12:00:00Z", viewer: BOB }).occurrences[0].due.date.value, "2026-02-09", "02-07 is a Saturday: rolled");
});
