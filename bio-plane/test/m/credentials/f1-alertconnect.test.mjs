/* credentials F1 (op-grades R55; N1259-e §1; R84): `alertconnect`, the screens' act that connects the team's outside alert
   service, is declared by this module and served by it. The declaration is the row op-grades grades from (ground
   `credential`, as `keyedserviceset`), and it lets no machine class reach the op; the module refuses a machine author itself
   (`NOT_AN_ADMIN`), writing nothing. The op is driven through the ops map as the door runs it, the administrator from the
   control plane's stamp. The grade is read from op-grades' own registration of this module's rows, never typed as a table. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, credentialsOps, KEYED_SERVICES, KEYED_SERVICE_CHECKS } from "../../../src/credentials/index.mjs";
import { world } from "./fixture.mjs";

const KEY = "cl-SENTINEL-alert-key-77";
let fresh = 0;
const call = (w, fields, by) => credentialsOps(w.c, new URL("http://x/?" + new URLSearchParams({ op: "alertconnect", ...(by ? { by } : {}) })),
  fields, { VERSION: "test-build" }).alertconnect();

test("F1 alertconnect is declared: a mutating administrator's act no machine class reaches, graded ground `credential` by "
   + "op-grades from this row as keyedserviceset is; control: it holds no rung", async () => {
  const row = DECLARED_OPS.alertconnect;
  assert.ok(row, "declared");
  assert.equal(row.mutating, true);
  assert.equal(row.weight, "credential");
  assert.deepEqual(row.machineClasses, []);
  assert.deepEqual(row.classes, ["admin", "member"]);
  assert.equal(row.needs, null);
  assert.deepEqual(row.fields.requires, ["service"]);
  const G = await import(`../../../src/op-grades/index.mjs?f1=${fresh++}`);
  const { registered } = G.registerDeclaredOps({ credentials: DECLARED_OPS });
  assert.ok(registered.includes("alertconnect"));
  assert.equal(G.RUNG_ABSENT.alertconnect.ground, "credential");
  assert.equal(G.RUNG_ABSENT.alertconnect.ground, G.RUNG_ABSENT.keyedserviceset.ground);
  assert.equal(Object.hasOwn(G.RUNGS, "alertconnect"), false);
});

test("F1 alertconnect refuses every caller but an active administrator NOT_AN_ADMIN, a machine credential included, and an "
   + "unknown service UNKNOWN_KEYED_SERVICE, each writing nothing", async () => {
  const w = await world().group("ann");
  const before = w.snapshot();
  for (const by of ["ann", "class:admin", "class:ai", "nobody", null]) {
    const r = await call(w, { service: "courtlistener", key: KEY, on: true }, by);
    assert.equal(r.ok, false, String(by));
    assert.equal(r.code ?? r.reason, "NOT_AN_ADMIN", String(by));
    assert.equal(JSON.stringify(r).includes(KEY), false);
  }
  for (const service of [null, "lexis", "CourtListener"]) {
    const r = await call(w, { service, key: KEY, on: true }, "admin");
    assert.equal(r.code ?? r.reason, "UNKNOWN_KEYED_SERVICE", String(service));
    assert.equal(r.check, KEYED_SERVICE_CHECKS.UNKNOWN_KEYED_SERVICE.check);
  }
  assert.equal(w.snapshot(), before, "no refusal writes");
});

test("F1 alertconnect: an administrator sets the key and switches the service on in one act, the key in no answer; with "
   + "neither field the state is answered and nothing written; a null key removes it and the service is off", async () => {
  const w = await world().group("ann");
  assert.ok(KEYED_SERVICES.includes("courtlistener"));
  const on = await call(w, { service: "courtlistener", key: KEY, on: true }, "admin");
  assert.equal(on.ok, true);
  assert.equal(on.held, true);
  assert.equal(on.on, true);
  assert.equal(JSON.stringify(on).includes(KEY), false);
  assert.deepEqual(await w.c.keyedServiceFor({ service: "courtlistener" }), { ok: true, service: "courtlistener", key: KEY });
  const before = w.snapshot();
  const state = await call(w, { service: "courtlistener" }, "admin");
  assert.equal(state.ok, true);
  assert.equal(state.on, true);
  assert.equal(JSON.stringify(state).includes(KEY), false);
  assert.equal(w.snapshot(), before, "a bare call writes nothing");
  const removed = await call(w, { service: "courtlistener", key: null }, "admin");
  assert.equal(removed.ok, true);
  assert.equal(removed.held, false);
  const listed = w.c.keyedServices().services.find((s) => s.service === "courtlistener");
  assert.equal(listed.on, false);
  /* control: switching alone leaves the key held as it is */
  await call(w, { service: "ca-officers", key: KEY }, "admin");
  const sw = await call(w, { service: "ca-officers", on: true }, "admin");
  assert.equal(sw.held, true);
  assert.equal(sw.on, true);
});

test("F1 credentials declares alertconnect: its requires alone raise no refusal naming a field, a missing service is refused "
   + "naming it, and a field outside accepts is dropped", async () => {
  await declaredOpHolds({
    op: "alertconnect", declaration: DECLARED_OPS.alertconnect,
    call: async (fields) => call(await world().group(), fields, "admin"),
    refusedNaming: (a, field) => field === "service" && !!a && (a.code === "UNKNOWN_KEYED_SERVICE" || a.reason === "UNKNOWN_KEYED_SERVICE"),
    values: { service: "courtlistener", key: KEY, on: true },
    same: (x, y) => !!x && !!y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason),
  });
});
