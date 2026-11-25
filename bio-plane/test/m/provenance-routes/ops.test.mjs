/* provenance-routes: the route ops map the composition root spreads (R9), driven over the real modules with the query
   the control plane stamps. Moved from `test/m/provenance/ops.test.mjs`:154 by N512 (provenance R53's three route
   arms), its assertions unchanged. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { provenanceRouteOps } from "../../../src/provenance-routes/ops.mjs";
import { provenanceRouteOps as reexported } from "../../../src/provenance-routes/index.mjs";

const ops = (w, query = "", body = null) => provenanceRouteOps(w.routes, new URL(`http://do/?${query}`), body);
const qs = (o) => new URLSearchParams(o).toString();

test("R9: three route arms, each a function of no arguments, keyed by op name; building the map runs nothing", () => {
  assert.equal(reexported, provenanceRouteOps, "the module's index exports the one map");
  const w = world();
  w.promoteInfo("INFO-2026-0001-c", { captures: [w.cap("c")] });
  const map = ops(w);
  assert.deepEqual(Object.keys(map).sort(), ["provenancechain", "provenanceroute", "provenanceroutes"]);
  for (const [k, f] of Object.entries(map)) assert.deepEqual([typeof f, f.length], ["function", 0], k);
  const before = w.snapshot();
  ops(w, qs({ bundleId: "INFO-2026-0001-c", apply: "1", author: V("ruth"), viewer: V("ruth") }));
  assert.deepEqual(w.snapshot(), before);
});

test("R9: provenancechain, provenanceroute and provenanceroutes take the bundle, viewer and author from the query; apply only when it is 1", () => {
  const w = world();
  const c = w.cap("c");
  w.promoteInfo("INFO-2026-0001-c", { captures: [c] });
  const stamped = { bundleId: "INFO-2026-0001-c", viewer: V("ruth"), author: V("ruth") };
  for (const apply of [null, "true", "yes", "0", ""]) {
    const r = ops(w, qs({ ...stamped, ...(apply === null ? {} : { apply }) })).provenancechain();
    assert.deepEqual([r.ok, r.applied, r.changed], [true, false, 1], `apply=${apply}`);
  }
  const reg0 = w.record.readFile("INFO-2026-0001-c", "data/provenance.json").sha256;
  const applied = ops(w, qs({ ...stamped, apply: "1" })).provenancechain();
  assert.deepEqual([applied.ok, applied.applied], [true, true], JSON.stringify(applied));
  assert.notEqual(w.record.readFile("INFO-2026-0001-c", "data/provenance.json").sha256, reg0, "the chain was written");
  assert.equal(ops(w, qs({ bundleId: "INFO-2026-0001-c", viewer: V("ruth") })).provenancechain().reason, "NO_AUTHOR",
               "the author is the query's stamp");
  /* The body's identity is never read: an author or viewer in the body reaches nothing. */
  assert.equal(ops(w, qs({ bundleId: "INFO-2026-0001-c", viewer: V("ruth") }), { author: V("ruth"), bundleId: "x" }).provenancechain().reason,
               "NO_AUTHOR");
  assert.equal(ops(w, qs({ bundleId: "INFO-2026-0001-c", author: V("ruth") }), { viewer: V("ruth") }).provenancechain().reason,
               "NO_SUCH_BUNDLE", "no viewer stamped sees nothing");
  /* The route act and the roster. */
  const m = ops(w, qs(stamped)).provenanceroute();
  assert.deepEqual([m.ok, m.route.finding, m.route.by], [true, "PRESENT", V("ruth")]);
  assert.equal(ops(w, qs({ bundleId: "INFO-2026-0001-c", viewer: V("ruth") })).provenanceroute().reason, "ROUTE_MARK_NO_AUTHOR");
  assert.equal(ops(w, qs({ bundleId: "INFO-2026-0001-c", author: V("ruth"), viewer: "stranger" })).provenanceroute().reason,
               "ROUTE_MARK_NO_SUCH_BUNDLE");
  assert.equal(ops(w, qs({ author: V("ruth"), viewer: V("ruth") }), { bundleId: "INFO-2026-0001-c" }).provenanceroute().reason,
               "ROUTE_MARK_NO_BUNDLE", "the bundle is the query's, never the body's");
  const roster = ops(w, qs({ viewer: V("x"), limit: "5", after: "" })).provenanceroutes();
  assert.deepEqual(roster, w.routes.provenanceRoutesMarked({ after: "", limit: "5", viewer: V("x") }));
  assert.deepEqual([roster.cause, roster.limit], ["none_standing", 5]);
  assert.equal(ops(w).provenanceroutes().cause, "no_documents_visible", "no viewer stamped sees nothing");
  /* Each arm answers exactly what its service answers for the same parameters. */
  assert.deepEqual(ops(w, qs(stamped)).provenancechain(),
                   w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-c", apply: false, viewer: V("ruth"), author: V("ruth") }));
});
