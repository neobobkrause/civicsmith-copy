/* affordances: the two pure services a caller composes with its own tables, `decorate(act, gate)` (R11, R24) and
   `unaccounted(opTable)` (R12), and that neither writes to what it is handed (R22). */
import test from "node:test";
import assert from "node:assert/strict";
import { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS, decorate, unaccounted, deriveActs } from "../../../src/affordances.mjs";
import { NON_ACTS, RUNGS, RUNG_ABSENT } from "../../../src/op-grades/index.mjs";

const KEYS = ["id", "label", "weight", "needs", "mode", "rung", "rung_absence", "prompt", "phone" /* R36 */];
const gateOf = (needs, modes) => ({ needs: (op) => needs[op], mode: (op) => modes[op] });

test("R11: needs and mode are the gate's answer for the act, rung RUNGS', rung_absence RUNG_ABSENT's ground, and "
   + "weight and prompt the act's — every key present, a missing value a stated null", () => {
  const needs = { conclude: "contribute", cite: "contribute", attest: "attest" };
  const modes = { conclude: "session", cite: "admin-session", attest: "machine" };
  const gate = gateOf(needs, modes);
  for (const a of [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS]) {
    const d = decorate(a, gate);
    assert.deepEqual(Object.keys(d), KEYS, a.id);
    assert.equal(d.id, a.id); assert.equal(d.label, a.label);
    assert.equal(d.weight, a.weight ?? null);
    assert.equal(d.needs, needs[a.id] ?? null);
    assert.equal(d.mode, modes[a.id] ?? null);
    assert.equal(d.rung, Object.hasOwn(RUNGS, a.id) ? RUNGS[a.id] : null);
    assert.equal(d.rung_absence, Object.hasOwn(RUNG_ABSENT, a.id) ? RUNG_ABSENT[a.id].ground : null);
    assert.equal(d.prompt, a.prompt ?? null);
    assert.equal(typeof d.phone, "boolean", a.id);
  }
});

test("R11: with no gate, or a gate answering nothing, needs and mode are null and the keys are still present", () => {
  for (const gate of [null, undefined, {}, gateOf({}, {})]) {
    const d = decorate(ACTS[0], gate);
    assert.deepEqual(Object.keys(d), KEYS);
    assert.equal(d.needs, null); assert.equal(d.mode, null);
  }
});

test("R11: one shape from one function — the same act decorated twice through the same gate is the same object "
   + "shape, whether it came from deriveActs or from the catalogue", () => {
  const gate = gateOf({ cite: "contribute" }, { cite: "session" });
  const derived = deriveActs({ object_type: "inquiry", current_state: "open" }).find((a) => a.id === "cite");
  assert.deepEqual(decorate(derived, gate), decorate(ACTS.find((a) => a.id === "cite"), gate));
});

test("R11 R24: an op named only by prototype keys reads as unclassified, never as a rung", () => {
  const d = decorate({ id: "toString", label: "x" }, null);
  assert.equal(d.rung, null); assert.equal(d.rung_absence, null);
});

test("R12: unpublished lists the gated ops in none of ACTS, CAPTURE_ACTS, PER_ITEM_ACTS or NON_ACTS", () => {
  const table = [{ op: "frobnicate", mutating: false }, { op: "zzz", mutating: false, gated: true },
    { op: "ungated", mutating: false, gated: false }, { op: "conclude", mutating: true }, { op: "attest", mutating: true },
    { op: "taskresolve", mutating: true }, { op: "queue", mutating: false }];
  assert.deepEqual(unaccounted(table).unpublished, ["frobnicate", "zzz"]);
});

test("R12: unranked lists the mutating ops in neither RUNGS nor RUNG_ABSENT, gated or not", () => {
  const table = [{ op: "frobnicate", mutating: true }, { op: "ungated", mutating: true, gated: false },
    { op: "conclude", mutating: true }, { op: "promote", mutating: true, gated: false }, { op: "readonly", mutating: false }];
  assert.deepEqual(unaccounted(table).unranked, ["frobnicate", "ungated"]);
});

test("R12: stale lists the keys of RUNGS and RUNG_ABSENT the table does not carry as mutating, and of NON_ACTS those no row "
   + "carries at all (K4279: a read the table carries ungated is not stale; one it does not carry is)", () => {
  const mutating = new Set(["conclude", "promote"]);
  const table = [...new Set([...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT), ...Object.keys(NON_ACTS), ...ACTS.map((a) => a.id)])]
    .map((op) => ({ op, mutating: mutating.has(op), gated: op !== "queue" }));
  /* T48 (R39): a `caller-owned` absence carried as a gated row is accounted for, though not as mutating */
  const accounted = (op) => RUNG_ABSENT[op]?.ground === "caller-owned" && !Object.hasOwn(RUNGS, op) && op !== "queue";
  const want = [...new Set([...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT)].filter((op) => !mutating.has(op) && !accounted(op)))].sort();
  assert.deepEqual(unaccounted(table).stale, want);
  /* the control: `queue` is a NON_ACT the table carries ungated, so it is not stale; with no row for it, it is */
  assert.ok(!unaccounted(table).stale.includes("queue"));
  assert.ok(unaccounted(table.filter((r) => r.op !== "queue")).stale.includes("queue"));
});

test("R12: all three are empty exactly when the table and the catalogue account for each other", () => {
  const all = new Set([...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT), ...Object.keys(NON_ACTS), ...ACTS.map((a) => a.id)]);
  const table = [...all].map((op) => ({ op, mutating: Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op),
    gated: Object.hasOwn(NON_ACTS, op) || ACTS.some((a) => a.id === op) }));
  assert.deepEqual(unaccounted(table), { unpublished: [], unranked: [], stale: [] });
  for (const drop of ["conclude", "promote", "queue"]) {
    const r = unaccounted(table.filter((x) => x.op !== drop));
    assert.ok(r.stale.includes(drop) || r.unpublished.length || r.unranked.length, drop);
  }
  const r = unaccounted([...table, { op: "brandnew", mutating: true }]);
  assert.deepEqual([r.unpublished, r.unranked], [["brandnew"], ["brandnew"]]);
});

test("R12: a malformed table answers without throwing — rows without an op name are ignored", () => {
  for (const t of [null, undefined, 7, "x", {}, [null, 3, { mutating: true }, { op: 5 }]]) {
    const r = unaccounted(t);
    assert.deepEqual(r.unpublished, []); assert.deepEqual(r.unranked, []);
    assert.ok(Array.isArray(r.stale));
  }
});

test("R22: the pure services write nothing — neither the act, the gate, the table nor the facts is changed", () => {
  const act = structuredClone({ id: "cite", label: "Cite", weight: "report" });
  const before = JSON.stringify(act);
  decorate(act, gateOf({}, {}));
  assert.equal(JSON.stringify(act), before);
  const table = [{ op: "conclude", mutating: true }, { op: "x", mutating: false }];
  const t0 = JSON.stringify(table);
  unaccounted(table);
  assert.equal(JSON.stringify(table), t0);
  const facts = { object_type: "project", current_state: "forming", roster: { owner: true, state: "joined" },
    cites_out: { confirmed: 1, severed: 0, severed_reinstatable: 0 } };
  const f0 = JSON.stringify(facts);
  deriveActs(facts);
  assert.equal(JSON.stringify(facts), f0);
});
