/* jurisdictions-c R124 (T53; N1257; DEC-458 A2; K5456): a member states a government's fiscal year, with how they checked it,
   as the team's time zone is stated. Driven at the product's interface: `local-facts`' own act (`factConfirm` `correct`, its
   R21/R31) on its real world fixture, over `jurisdictions`' published test forest (R118) and its real `combine`. Nothing here is
   a hand-built answer of another module. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE } from "../local-facts/fixture.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const ids = (list) => list.map((l) => l.id);
/* Bburg's own layer in the forest gives no year: a government for a member to state */
const B = { level: "city", place: "Bburg" };
const Y = { body: "Bburg", start: "04-01", named_by: "start", label: "FY{start}-{end2}" };
const PATH = "team/city:Bburg/fiscal_year";
const HOW = "the city's budget page at its address, read today";

test("R124 a member states a city's fiscal year with how they checked it: it governs for that city and for no other government, with no second member and no basis", () => {
  const w = world({ profiles: ids(FOREST.chain), own: forestCopy(FOREST.chain) });
  const before = w.lf.governingView().view.fiscal_year.map((y) => [y.body, y.start, y.profile]);
  const r = w.act(PATH, "correct", { how: HOW, value: Y, by: V("bob") });
  assert.equal(r.ok, true, JSON.stringify(r));
  const view = w.lf.governingView().view.fiscal_year;
  const mine = view.filter((y) => y.origin === "team");
  assert.equal(mine.length, 1, "one stated year");
  assert.deepEqual([mine[0].body, mine[0].start, mine[0].government], ["Bburg", "04-01", B], "it governs for the named city");
  assert.equal(mine[0].basis, undefined, "R115's basis does not apply");
  assert.equal(mine[0].status, undefined, "R115's status does not apply");
  /* for no other government: every other year the view gave is unchanged */
  assert.deepEqual(view.filter((y) => y.origin !== "team").map((y) => [y.body, y.start, y.profile]), before);
  /* no second member: the one member's statement already governs, and its standing names how and who */
  const s = w.status(PATH);
  assert.deepEqual([s.status, s.layer, s.how, s.latest.by], ["confirmed", "team", HOW, "member:bob"]);
  /* the team layer holds it with its government */
  assert.deepEqual(w.lf.teamLayer({ viewer: V("dan") }).fiscal_year, [{ ...Y, government: B }]);
});

test("R124 refused, writing nothing: a statement without how, and one a machine makes", () => {
  const w = world({ profiles: ids(FOREST.chain), own: forestCopy(FOREST.chain) });
  const n = () => w.rows("SELECT COUNT(*) AS n FROM local_fact_acts")[0].n;
  for (const how of [undefined, ""]) {
    const r = w.act(PATH, "correct", { how, value: Y, by: V("bob") });
    assert.equal(r.ok, false); assert.equal(r.code, "FACT_HOW_REFUSED");
  }
  const m = w.act(PATH, "correct", { how: HOW, value: Y, by: MACHINE });
  assert.equal(m.ok, false); assert.equal(m.code, "MACHINE_CANNOT_CONFIRM");
  assert.equal(n(), 0, "nothing was written");
  assert.equal(w.lf.governingView().view.fiscal_year.some((y) => y.origin === "team"), false);
});

test("R124 control: a stated year beside a layer's equal year is no conflict", () => {
  const forest = forestCopy(FOREST.all.filter((l) => l.id !== "team"));
  const city = forest.find((l) => l.layer && l.layer.level === "city" && l.layer.place === "Bburg");
  assert.ok(city, "the forest has Bburg's layer");
  /* the layer's own year (`*`: every body of the city), equal to the one the member states; */
  /* 07-01, as Bville County's own `*` year above it, so the layers agree among themselves */
  const EQ = { ...Y, start: "07-01" };
  city.fiscal_year = [{ ...EQ, body: "*", status: "researched", basis: "TEST" }];
  const team = { id: "team", name: "The team", covers: ["The team"], test: true, layer: { origin: "team" },
                 fiscal_year: [{ government: B, ...EQ, how: HOW }] };
  const r = combine([...forest, team]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(combine(forest).conflicts, [], "the layers agree among themselves");
  assert.deepEqual(r.conflicts, [], "no conflict");
  assert.equal(r.view.set_aside, undefined, "nothing set aside");
  assert.ok(r.view.fiscal_year.some((y) => y.start === "07-01" && (y.bases || []).some((x) => x.profile === city.id)), "the layer's equal year stands");
});
