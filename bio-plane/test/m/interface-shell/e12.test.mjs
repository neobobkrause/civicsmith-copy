/* interface-shell R123 (fix round 5, E12; PERFORMANCE P9): one request per `(op, query)` per load. The real screens of the nine modules are loaded
   through the harness over the fixtures' plane and every request the page sends is counted; a read identical to one in flight or answered in this
   load is shared, never sent again. Each test was seen failing first. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, settle } from "./harness.mjs";
import { inWorld, bootAs, doorAs, obligations } from "./world.mjs";

const MODS = ["screens-settings", "screens-intake", "screens-daily", "screens-inquiry", "screens-entry", "screens-wizards", "screens-investigate", "screens-publish", "screens-action"];
const REAL = []; let GUIDE = null;
for (const m of MODS) { const x = await import(`../../../src/${m}/index.mjs`); REAL.push(...x.SCREENS); if (x.GUIDE) GUIDE = x.GUIDE; }
/* every request as `op query body`, the marks the shell adds (`op`, `background`) left out */
const sigs = (p) => p.requests.map((r) => r.op + " " + JSON.stringify(Object.fromEntries(Object.entries(r.query).filter(([k]) => k !== "op" && k !== "background"))) + (r.body === undefined ? "" : " " + JSON.stringify(r.body)));
const repeats = (p) => { const n = new Map(); for (const s of sigs(p)) n.set(s, (n.get(s) || 0) + 1); return [...n].filter(([, c]) => c > 1).map(([s, c]) => s + " x" + c); };

/* the world answers the frame's reads (`whoami`, `groupidentity`, `queue`, `assistantstate`, `aipathready`) for an administrator who holds a project */
const loaded = async (path, options = {}) => {
  const { world, me } = await inWorld();
  const project = await world.recipes.project(me, "Stormwater");
  return { world, me, project, p: await bootAs(world, me, { ...options, path: path.replace("{project}", project) }) };
};

for (const [name, path] of [["Home", "/app"], ["Queue", "/app/queue"], ["Project", "/app/project/{project}"], ["Held", "/app/held"]]) {
  test(`R123 (E12) loading ${name} through the real screens sends each (op, query) at most once`, async () => {
    const { p } = await loaded(path, { screens: REAL, guide: GUIDE });
    assert.deepEqual(repeats(p), [], `${name} repeats`);
  });
}

for (const [name, path] of [["Home", "/app"], ["Queue", "/app/queue"]]) {
  test(`R7 R123 (E12, K4530) ${name} reads the whole open queue, so the frame sends no count read of its own and the masthead draws the list's number`, async () => {
    const { world, me } = await inWorld();
    const items = await obligations(world, me, 3);
    const p = await bootAs(world, me, { screens: REAL, guide: GUIDE, path });
    assert.equal(p.byOp("queue").filter((r) => r.query.count).length, 0, "no count read");
    const n = p.root().querySelector(".cs-rail a .count");
    assert.equal(n && n.textContent, String(items.length), "the sum of the list's kinds, as the queue lists them, not a count");
  });
}

test("R7 R123 (E12) control: Project (no open list) asks the frame's one count read", async () => {
  const { p } = await loaded("/app/project/{project}", { screens: REAL, guide: GUIDE });
  assert.equal(p.byOp("queue").filter((r) => r.query.count).length, 1);
});

/* a screen of the registry id `home` that reads what the frame also reads, and an act that re-reads it; its functions are self-contained (R21), the reads
   carried into them as data. The act resolves the task `id` (a real one the world holds) */
const stand = (reads, draws = true, id = "x") => ({ id: "home", words: [], reads: new Function("view", `return ${JSON.stringify(reads)};`),
  acts: [{ op: "taskresolve", send: new Function("view", "el", "cs", "extra", `return { body: { id: ${JSON.stringify(id)} } };`), rereads: Object.keys(reads) }],
  render: new Function("cs", "view", draws
    ? 'return cs.state("identity", view, function (v) { return \'<p id="seen">\' + cs.esc(v.display_name) + "</p>"; }) + cs.act("taskresolve", { label: "act.taskresolve.label.home" });'
    : 'return "<p>x</p>";') });
const reading = { identity: { op: "groupidentity" } };
/* the team's name, set by the administrator's real act; answers the name the world then holds */
const named = async (me, name) => (await me.act("groupnameset", { body: { name } })).display_name;

test("R123 (E12) a screen's read identical to the frame's, still in flight, is the frame's one request, and the screen draws its answer", async () => {
  const { world, me } = await inWorld();
  const name = await named(me, "River Town");
  const door = doorAs(world, me).door;
  let release, asked = 0;
  /* only the delay is the test's: the answer, once released, is the door's */
  const slow = (req) => { asked++; return new Promise((r) => { release = () => r(door(req)); }); };
  const p = await bootAs(world, me, { screens: [stand(reading)], plane: { groupidentity: slow } });
  assert.equal(asked, 1, "one request out for the two readers");
  release();
  await settle();
  assert.equal(p.byOp("groupidentity").length, 1);
  assert.equal(p.doc.getElementById("seen").textContent, name, "the screen drew the shared answer");
});

test("R123 (E12) a read the frame already had answered in this load is not sent again by the screen", async () => {
  /* the frame's answer is back before the screen reads: the screen's `groupidentity` is not sent */
  const { world, me } = await inWorld();
  const name = await named(me, "River Town");
  const p = await bootAs(world, me, { screens: [stand(reading)] });
  assert.equal(p.byOp("groupidentity").length, 1);
  assert.equal(p.doc.getElementById("seen").textContent, name);
});

test("R123 (E12) control: an act's declared re-reads still re-read", async () => {
  const { world, me } = await inWorld();
  const [task] = await obligations(world, me, 1);
  const first = await named(me, "Name 1");
  const p = await bootAs(world, me, { screens: [stand(reading, true, task.id)] });
  assert.equal(p.byOp("groupidentity").length, 1);
  assert.equal(p.doc.getElementById("seen").textContent, first);
  const second = await named(me, "Name 2");
  await p.click('button[data-act="taskresolve"]');
  assert.equal(p.byOp("groupidentity").length, 2, "the act's re-read asks again");
  assert.equal(p.doc.getElementById("seen").textContent, second, "and draws the new answer");
});

test("R123 (E12) control: reads that differ in a parameter are each sent, an identical one inside the screen once", async () => {
  const two = { a: { op: "queue", query: { muted: "true" } }, b: { op: "queue", query: { aside: "true" } }, c: { op: "queue", query: { muted: "true" } } };
  const p = await boot({ screens: [stand(two, false)] });
  const q = p.byOp("queue").map((r) => Object.keys(r.query).filter((k) => k !== "op" && k !== "background").join());
  assert.deepEqual(q.sort(), ["aside", "count", "muted"], "the frame's count, aside and muted once each; the third (muted) shared");
});

test("R123 (E12) control: a read that is no read (an act's op) is never shared, and a member without the frame's session reads nothing twice", async () => {
  const { world, me } = await inWorld({ handle: "mai", admin: false, capabilities: ["contribute", "create_projects"] });
  const [task] = await obligations(world, me, 1);
  const p = await bootAs(world, me, { screens: [stand(reading, true, task.id)] });
  await p.click('button[data-act="taskresolve"]');
  await p.click('button[data-act="taskresolve"]');
  assert.equal(p.byOp("taskresolve").length, 2, "each press is its own request");
});

test("R123 (E12) control: a visit to the screen again, and a refresh of a read, ask again; the frame's one answer is not asked again by a revisit", async () => {
  const { world, me } = await inWorld();
  const p = await bootAs(world, me, { screens: [stand(reading)] });
  assert.equal(p.byOp("groupidentity").length, 1);
  await p.back("/app");
  assert.equal(p.byOp("groupidentity").length, 2, "the new route asks for its own");
});

test("R123 (E12) two readers of one request are each handed their own copy: a screen that changes its answer changes nobody else's", async () => {
  const same = { a: { op: "queue", query: { limit: "50" } }, c: { op: "queue", query: { limit: "50" } } };
  const draws = new Function("cs", "view", 'var a = view.data.a, c = view.data.c; if (a.state === "ok" && c.state === "ok" && !view.ui.m) { view.ui.m = 1; a.value.items.push({ id: "mut" }); } return \'<p id="n">\' + (c.state === "ok" ? c.value.items.length : "-") + "</p>";');
  const { world, me } = await inWorld();
  await obligations(world, me, 1);
  const p = await bootAs(world, me, { screens: [{ ...stand(same, false), render: draws }] });
  assert.equal(p.byOp("queue").filter((r) => r.query.limit).length, 1, "one request");
  assert.equal(p.doc.getElementById("n").textContent, "1");
});
