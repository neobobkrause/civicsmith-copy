/* action-producers' answer to action-clocks' notice 60 (its R27–R29, T53; N1257): `calendarFactsRead` now puts a `layer` on each
   path and lists past-end closure lists apart, in `lists_ending`. R7 asks `local-facts.factsDue({paths})` of the paths it answers
   and keys each item by the fact's path and status, so a layered read raises one item per due path, keyed as before, the
   layer naming no new key. Both reads are the providers' real answers, made by their real code when the test runs, over the
   shipped Oakland profile (three layers: federal, state, city): action-clocks' own test world (`../action-clocks/fixture.mjs`)
   holds an action addressed to a federal office whose clock runs past the federal list's last year (as action-clocks' R27 test
   builds it), and its real `local-facts` answers `factsDue`. Instance clock as each world sets it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as clocksWorld, V, CLK } from "../action-clocks/fixture.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { world } from "./world.mjs";

const A = "ACTN-2026-0001-a";
const M = V("alice");

/* action-clocks' real calendarFactsRead and local-facts' real factsDue, over the shipped profile's layers. */
function providers({ pastEnd }) {
  const v = combine(["oakland-alameda"]).view;
  const fed = v.layers.find((l) => l.level === "federal");
  const o = v.counterparties.find((c) => c.level === "federal");
  const to = ["counterparty:", "  state: named", "  kind: office", `  role: ${JSON.stringify(o.role)}`, `  body: ${JSON.stringify(o.body)}`];
  const cw = clocksWorld({ profiles: ["oakland-alameda"] });
  cw.action(A, [...to, "clock:", ...CLK(pastEnd ? `${fed.holidays_through + 1}-03-01` : "2026-12-01")]);
  const read = cw.c.calendarFactsRead({ viewer: M });
  assert.equal(read.ok, true);
  return { read, fed, factsDue: ({ paths }) => cw.localFacts.factsDue({ paths, viewer: M }) };
}
function producers(p) {
  const w = world({ actionClocks: { calendarFactsRead: () => p.read }, localFacts: { factsDue: p.factsDue } });
  w.member("alice");
  w.bundle(A, "action");
  return w;
}
const facts = (r) => r.items.filter((i) => i.kind === "local-fact-due");

test("R7 (action-clocks:60, its R27): a calendar read whose paths carry layers raises one local-fact-due per due path, keyed <path>::<status> as before, to the action's creator; every layer's paths are asked of factsDue", () => {
  const p = providers({ pastEnd: true });
  const layers = new Set(p.read.paths.map((x) => x.layer).filter(Boolean));
  assert.ok(layers.size >= 2 && layers.has(p.fed.id), `the read is layered: ${[...layers]}`);
  assert.ok(p.read.lists_ending.length > 0, "and lists a list past its end");
  const due = p.factsDue({ paths: p.read.paths.map((x) => x.path) }).due;
  assert.ok(due.length > 0);
  const r = producers(p).read("alice");
  assert.deepEqual(facts(r).map((i) => i.id).sort(),
    due.map((f) => `OBLIGATION::local-fact-due::${f.path}::${f.status}`).sort(), "one item per due fact, keyed by its path");
  for (const it of facts(r)) {
    assert.deepEqual(it.recipients, ["alice"], it.id);
    assert.equal(it.subject.id, A);
    assert.equal(it.options[0].id, "factconfirm");
  }
  /* each layer's paths are asked, the federal one among them */
  const pathsOf = (ly) => p.read.paths.filter((x) => x.layer === ly).map((x) => x.path);
  for (const ly of layers)
    assert.ok(facts(r).some((i) => pathsOf(ly).includes(i.subject.path)), `a path of layer ${ly} raises its item`);
});

test("R7 control (action-clocks:60): a clock inside the lists' years, its read layered too and naming no federal end, raises its items by the same keys", () => {
  const p = providers({ pastEnd: false });
  assert.equal(p.read.lists_ending.some((x) => x.layer === p.fed.id), false);
  assert.ok(p.read.paths.some((x) => x.layer === p.fed.id));
  const due = p.factsDue({ paths: p.read.paths.map((x) => x.path) }).due;
  const r = producers(p).read("alice");
  assert.deepEqual(facts(r).map((i) => i.id).sort(), due.map((f) => `OBLIGATION::local-fact-due::${f.path}::${f.status}`).sort());
  assert.ok(facts(r).length > 0);
});
