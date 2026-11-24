/* monitoring R78 (T51; K4168, K4189, K4202): each op this module declares in DECLARED_OPS is held true against the op as the
   door runs it (test-support R15): only its requires raise no refusal naming a declared field, a call without each
   required one is refused naming it, and a field outside accepts is dropped or refused naming it. The declarations are
   found by test-support's collector (R16), once each, and carry the shape the owners' registry reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { declaredOpHolds, declaredOpsOf } from "../../declared-ops.mjs";
import { DECLARED_OPS, monitoringOps } from "../../../src/monitoring/index.mjs";
import { world, serve, sha, infoMd, V, DAEMON } from "./fixture.mjs";

const ALICE = V("alice");
const LOC = "https://records.example.org/declared.txt";
const BID = "INFO-2026-0800-declared";
const PUB = "https://publisher.example.org/declared.txt";
const OPS = ["monitor", "monitoring", "monitorpause", "monitorset", "monitorslate", "namedrequestset", "namedrequests"];
/* the same refusal or the same landing, whatever the instant or the revision */
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason) && x.status === y.status;

/* the call as the door runs it: a fresh owner holding a monitored document, the stamps and every field in the address, the
   fields as the body, the arm asked; a tick's `{status, body}` answers its body */
const mk = (op, stamps, unwrap = false) => async (fields) => {
  const w = world();
  w.net.routes[LOC] = serve("declared-v1");
  w.monitored(BID, LOC, "declared-v1", { freq: "daily", enabled: op !== "monitorset" });
  const g = JSON.stringify({ requests: [] });
  if (op === "namedrequestset") w.promote(BID, infoMd(BID, LOC, { enabled: false }), { files: [{ path: "data/gathering.json", text: g, bytes: g.length, sha256: sha(g) }] });
  const q = new URLSearchParams({ ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const r = await monitoringOps(w.m, new URL(`http://do/${op}?${q}`), fields)[op]();
  return unwrap ? r.body : r;
};

const REQUEST = { bundle: BID, target: { text: "the declared request" }, locators: [PUB], authority: "Town Clerk", criticality: "crucial" };

test("R78 monitoring declares monitor: its requires alone raise no refusal naming a field, the missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "monitor", declaration: DECLARED_OPS.monitor, values: { bundleId: BID }, same: sameCode,
    call: mk("monitor", { viewer: DAEMON, actorClass: "machine", actor: DAEMON }, true) });
});

test("R78 monitoring declares monitoring: it requires nothing, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "monitoring", declaration: DECLARED_OPS.monitoring, same: sameCode, call: mk("monitoring", { viewer: ALICE }) });
});

test("R78 monitoring declares monitorpause: its requires alone raise no refusal naming a field, the missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "monitorpause", declaration: DECLARED_OPS.monitorpause, values: { paused: true }, same: sameCode,
    call: mk("monitorpause", { actor: "class:admin" }) });
});

test("R78 monitoring declares monitorset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "monitorset", declaration: DECLARED_OPS.monitorset, values: { bundleId: BID, enabled: true }, same: sameCode,
    call: mk("monitorset", { author: ALICE, viewer: ALICE }) });
});

test("R78 monitoring declares monitorslate: it requires nothing, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "monitorslate", declaration: DECLARED_OPS.monitorslate, same: sameCode, call: mk("monitorslate", { viewer: ALICE }) });
});

test("R78 R75 monitoring declares namedrequestset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "namedrequestset", declaration: DECLARED_OPS.namedrequestset, values: REQUEST, same: sameCode,
    call: mk("namedrequestset", { author: ALICE, viewer: ALICE }) });
});

test("R78 R76 monitoring declares namedrequests: it requires nothing, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "namedrequests", declaration: DECLARED_OPS.namedrequests, same: sameCode, call: mk("namedrequests", { viewer: ALICE }) });
});

test("R78 the declarations are the shape the owners' registry reads, each op declared once, by this module, and the module serves each", async () => {
  assert.deepEqual(Object.keys(DECLARED_OPS).sort(), [...OPS].sort());
  const CLASSES = ["admin", "member", "probe", "daemon"];
  for (const [op, d] of Object.entries(DECLARED_OPS)) {
    assert.ok(d.classes.length > 0 && d.classes.every((c) => CLASSES.includes(c)), op);
    assert.ok(d.machineClasses === undefined || d.machineClasses.every((c) => CLASSES.includes(c)), op);
    assert.equal(typeof d.mutating, "boolean", op);
    assert.ok(d.mutating ? d.weight !== "read" : d.weight === "read", `${op}: a read is weighed "read", an act on the ladder or a ground`);
    assert.ok(typeof d.description === "string" && d.description.length > 20, op);
    assert.ok(Array.isArray(d.fields.accepts) && Array.isArray(d.fields.requires), op);
    for (const r of d.fields.requires) for (const f of [r].flat()) assert.ok(d.fields.accepts.includes(f), `${op}: ${f} is required, so accepted`);
    assert.ok(Object.hasOwn(monitoringOps({}, new URL("http://do/x"), {}), op), `${op} is served by monitoringOps`);
  }
  /* the new acts are a member session's only; a read is the viewer's */
  assert.deepEqual([DECLARED_OPS.namedrequestset.machineClasses, DECLARED_OPS.namedrequestset.mutating, DECLARED_OPS.namedrequestset.weight],
    [[], true, "reversible"]);
  assert.deepEqual([DECLARED_OPS.namedrequestset.classes, DECLARED_OPS.namedrequests.classes, DECLARED_OPS.namedrequests.mutating],
    [["admin", "member"], ["admin", "member", "probe"], false]);
  /* test-support's collector finds them, each op once, with no other module declaring one of them */
  const { ops, owners, duplicates } = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)));
  for (const op of OPS) assert.deepEqual([owners[op], ops[op] === DECLARED_OPS[op] || JSON.stringify(ops[op]) === JSON.stringify(DECLARED_OPS[op])], ["monitoring", true], op);
  assert.deepEqual(duplicates.filter((d) => OPS.includes(d.op)), []);
});
