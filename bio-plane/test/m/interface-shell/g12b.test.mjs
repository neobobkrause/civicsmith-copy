/* interface-shell R124, R125 and R122's order (fix round 6, G12b; walkers A and B, diagnosis-R6-speed §2): the frame's reads on every screen. Six of the frame's
   reads are constant for a session and are kept for it in the tab's sessionStorage (R124), drawn from it and asked again once the screen's first reads have
   settled; the guide's marks are asked at the route's start (R125); `bootstrap` is sent after the screen's first read and the marks, never before (R122). Each
   test counts the requests the page sends over a scripted plane, as e12 and p9 do, and was seen failing first. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, pending, silent, ADMIN, MEMBER, STORE_KEY, SESSION, settle } from "./harness.mjs";
import { inWorld, bootAs, doorAs } from "./world.mjs";

const MODS = ["screens-wizards"];
let GUIDE = null;
for (const m of MODS) { const x = await import(`../../../src/${m}/index.mjs`); if (x.GUIDE) GUIDE = x.GUIDE; }

/* the six, as the frame groups them: the team and the level, and the four that decide whether the assistant is reachable (R20) */
const TEAM = ["groupidentity", "infolevel"], REACH_OPS = ["assistantstate", "aipathready"];
const SIX = [...TEAM, ...REACH_OPS];
const KEY = STORE_KEY + ":frame";
/* a working screen with one read of its own (`heldcaptures`: not a frame read), registry id `held`, which the test answers when it likes */
const held = { id: "held", words: [], reads: () => ({ h: { op: "heldcaptures", query: { limit: "5" } } }), acts: [],
  render: (cs, view) => cs.state("h", view, () => '<p id="seen">held</p>') };
/* the plane when the assistant is reachable for the member: on, and her own reference held */
const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
const plane = (more = {}) => ({ whoami: ok({ ...MEMBER, capabilities: ["contribute"] }), heldcaptures: ok({ items: [{ id: "h1" }] }), wizardsat: ok({ scripts: [] }), ...REACH, ...more });
const ops = (p) => p.requests.map((r) => r.op);
const sixOf = (p) => ops(p).filter((o) => SIX.includes(o));
/* a boolean, so a failing assertion never has to print the page's tree */
const dockButton = (p) => !!p.root().querySelector('.cs-mast [data-shell="dock"]');
const deferred = () => { let release; const wait = new Promise((r) => { release = r; }); return { wait, release }; };
/* a first page load of the session: the six answered, so the tab holds them */
/* the team's name and level are the world's: its administrator names the team by the real act, and a later load reads what the world then holds */
const first = async (more = {}, o = {}) => {
  const { world, me } = await inWorld();
  await me.act("groupnameset", { body: { name: "Old Name" } });
  return Object.assign(await bootAs(world, me, { screens: [held], guide: GUIDE, path: "/app/held", plane: plane(more), ...o }), { world, me });
};
/* the next page load in the same tab (its sessionStorage and the device's localStorage carried over) */
const next = async (a, more = {}, o = {}) => Object.assign(await bootAs(a.world, a.me, { screens: [held], guide: GUIDE, path: "/app/held", tabStore: a.store, local: Object.fromEntries(a.local), plane: plane(more), ...o }), { world: a.world, me: a.me });

test("R124 (G12b) a first load of a session asks the six frame reads at once, once each, as always; the tab then keeps them", async () => {
  const p = await first();
  for (const op of SIX) assert.equal(p.byOp(op).length, 1, op);
  const kept = JSON.parse(p.store.get(KEY));
  assert.deepEqual(Object.keys(kept.reads).sort(), [...SIX].sort(), "the six, and nothing else");
  assert.equal(kept.reads.assistantstate.on, true);
});

test("R124 (G12b) the store holds the six reads' answers and no token, no route, no read of a screen (R24): control", async () => {
  /* the world's own answer with one field added that the frame does not use */
  const { world, me } = await inWorld();
  const door = doorAs(world, me).door;
  const p = await bootAs(world, me, { screens: [held], guide: GUIDE, path: "/app/held", plane: plane({ groupidentity: async (req) => { const a = await door(req); a.json.result.secret = "SENTINEL-FIELD"; return a; } }) });
  const raw = p.store.get(KEY);
  assert.ok(!raw.includes(SESSION.t), "no token");
  assert.ok(!raw.includes("SENTINEL-FIELD"), "only what the frame uses of an answer");
  assert.ok(!/\/app|heldcaptures|wizardsat|queue|"held"\s*:\s*"/.test(raw), "no route and no screen's read");
  assert.deepEqual([...p.store.keys()], [KEY], "the one key");
});

/* G81 (fix round 7): of the six, `groupidentity` and `infolevel` are constants of the team; a kept one answered less than a day ago is not asked again
   (fixround7.test.mjs); the other four are asked once on every load. `aged` moves the time the tab holds for the constants back by `ms`. */
const aged = (a, ms) => { const o = JSON.parse(a.store.get(KEY)); for (const n of Object.keys(o.at)) o.at[n] -= ms; return new Map([[KEY, JSON.stringify(o)]]); };
const DAY_AND = 25 * 3600 * 1000;

test("R124 (G12b, G81) a second page load in the session sends none of the six frame reads before the screen's reads have settled, and asks the four that can change once after (the two constants not at all)", async () => {
  const a = await first();
  const slow = deferred();
  const p = await next(a, { heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })) });
  assert.deepEqual(sixOf(p), [], "none of the six before the screen's first reads settle");
  assert.ok(ops(p).includes("heldcaptures"), "the screen's read is out");
  assert.ok(dockButton(p), "the assistant button is drawn from what the tab kept");
  slow.release();
  await settle();
  for (const op of REACH_OPS) assert.equal(p.byOp(op).length, 1, op + ": asked again once");
  for (const op of TEAM) assert.equal(p.byOp(op).length, 0, op + ": kept less than a day, so not asked");
  assert.equal(p.byOp("heldcaptures").length, 1);
  await p.back("/app/held");
  for (const op of REACH_OPS) assert.equal(p.byOp(op).length, 1, op + ": a route in the page asks no more");
});

test("R124 (G12b) a second page load whose reads never settle never asks the six; the kept ones are all it draws", async () => {
  const a = await first();
  const p = await next(a, { heldcaptures: pending });
  await settle();
  assert.deepEqual(sixOf(p), []);
});

test("R124 (G12b, G81) the frame follows an answer that differs from what the tab kept: the assistant goes, the name (kept over a day) changes", async () => {
  const a = await first();
  const renamed = (await a.me.act("groupnameset", { body: { name: "New Name" } })).display_name;
  const slow = deferred();
  const p = await next(a, { heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })), assistantstate: ok({ on: false }) }, { tabStore: aged(a, DAY_AND) });
  assert.ok(dockButton(p), "kept: the button");
  slow.release();
  await settle();
  assert.equal(dockButton(p), false, "answered: it goes");
  assert.equal(p.root().querySelector(".cs-mast .mk-grp").textContent, renamed);
  assert.equal(JSON.parse(p.store.get(KEY)).reads.groupidentity.display_name, renamed, "and the tab keeps the new one");
});

test("R124 (G12b) a kept read the screen itself read in this load is not asked again, and the frame takes the screen's answer", async () => {
  const mine = { id: "held", words: [], reads: () => ({ g: { op: "groupidentity" } }), acts: [], render: (cs, view) => cs.state("g", view, (v) => '<p id="seen">' + cs.esc(v.display_name) + "</p>") };
  const { world, me } = await inWorld();
  await me.act("groupnameset", { body: { name: "Old Name" } });
  const a = await bootAs(world, me, { screens: [mine], guide: GUIDE, path: "/app/held", plane: plane() });
  const renamed = (await me.act("groupnameset", { body: { name: "New Name" } })).display_name;
  const p = await bootAs(world, me, { screens: [mine], guide: GUIDE, path: "/app/held", tabStore: a.store, local: Object.fromEntries(a.local), plane: plane() });
  assert.equal(p.byOp("groupidentity").length, 1, "the screen's one request is the revalidation");
  assert.equal(p.root().querySelector(".cs-mast .mk-grp").textContent, renamed);
  for (const op of REACH_OPS) assert.equal(p.byOp(op).length, 1, op);
  assert.equal(p.byOp("infolevel").length, 0, "the other constant is kept and fresh");
});

test("R125 (G12b) the guide's marks are asked with the screen's first read (within 50 ms, the read still out), once, and the marks draw from that answer", async () => {
  const slow = deferred();
  const p = await first({ heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })), wizardsat: ok({ scripts: [{ id: "walk-1", name: "Walk of the kind", steps: [] }] }) });
  const read = p.byOp("heldcaptures")[0], marks = p.byOp("wizardsat");
  assert.equal(marks.length, 1, "the marks request is out while the screen's read is");
  assert.equal(marks[0].query.screen, "held");
  assert.ok(Math.abs(marks[0].at - read.at) < 50, "within 50 ms of the first screen read");
  slow.release();
  await settle();
  assert.equal(p.byOp("wizardsat").length, 1, "entered asks for the same read and is handed that answer");
  assert.ok(p.root().querySelector("[data-guide-marks]"), "the marks draw from that answer");
});

test("R125 (G12b) the marks answered long before the route settles are still handed to entered (past the load and the 5 seconds); control: a later route asks for its own", async () => {
  const slow = deferred();
  const p = await first({ heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })), wizardsat: ok({ scripts: [{ id: "walk-1", name: "Walk of the kind", steps: [] }] }) });
  await p.clock.tick(8000);
  slow.release();
  await settle();
  assert.equal(p.byOp("wizardsat").length, 1, "one request");
  assert.ok(p.root().querySelector("[data-guide-marks]"), "the marks draw from that answer");
  await p.back("/app/held");
  assert.equal(p.byOp("wizardsat").length, 2, "the new route asks for its own marks");
});

test("R125 (G12b) the marks are not asked for a route the guide draws no marks for: no session, and a guide that does not read wizardsat", async () => {
  const q = await boot({ screens: [held], guide: GUIDE, path: "/app/held", session: null, plane: plane() });
  assert.equal(q.byOp("wizardsat").length, 0, "no session, no request");
  const bare = { ...GUIDE, ops: GUIDE.ops.filter((o) => o !== "wizardsat") };
  const slow = deferred();
  const p = await boot({ screens: [held], guide: bare, path: "/app/held", plane: plane({ heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })) }) });
  assert.equal(p.byOp("wizardsat").length, 0, "a guide that names no wizardsat is not asked ahead of the route's settling");
  slow.release();
  await settle();
  assert.equal(p.byOp("wizardsat").length, 1, "its own `entered` asks as it always did");
});

test("R122 (G12b) bootstrap is sent after the screen's first read and the marks request, never before them; one still out blocks neither the screen nor its marks", async () => {
  const p = await first({ bootstrap: pending, wizardsat: ok({ scripts: [{ id: "walk-1", name: "Walk of the kind", steps: [] }] }) });
  const order = ops(p);
  assert.ok(order.indexOf("bootstrap") > order.indexOf("heldcaptures"), "after the screen's first read: " + order.join(" "));
  assert.ok(order.indexOf("bootstrap") > order.indexOf("wizardsat"), "after the marks request");
  assert.equal(p.byOp("bootstrap").length, 1);
  assert.equal(p.doc.getElementById("seen").textContent, "held", "the screen drew");
  assert.ok(p.root().querySelector("[data-guide-marks]"), "and its marks");
});

test("R124 (G12b) a different member in the same tab sees none of the first member's values; nor does the same member under another session", async () => {
  const a = await first();
  assert.ok(a.store.get(KEY));
  const mine = JSON.parse(a.store.get(KEY));
  for (const [who, rec, member] of [["rosa", { t: "tok-2", e: 0, d: "own", w: "rosa" }, ADMIN], ["mai", { t: "tok-3", e: 0, d: "own", w: "mai" }, MEMBER]]) {
    const b = await boot({ screens: [held], guide: GUIDE, path: "/app/held", tabStore: a.store, session: rec,
      plane: plane({ whoami: ok(member), assistantstate: pending, aipathready: pending, groupidentity: pending, infolevel: pending, heldcaptures: pending }) });
    assert.equal(dockButton(b), false, who + ": no assistant button from the first member's answers");
    for (const op of SIX) assert.equal(b.byOp(op).length, 1, who + ": " + op + " asked, not drawn from the other's");
    assert.equal(b.store.get(KEY) === undefined || JSON.parse(b.store.get(KEY)).who !== mine.who, true, who + ": the other's store is not kept as ours");
  }
});

test("R124 (G12b) storage unavailable renders correctly: a sessionStorage that denies every use, one that holds rubbish, one that holds another's", async () => {
  const a = await first();
  const cases = [["denied", { tabThrows: true }], ["rubbish", { tabStore: new Map([[KEY, "{not json"]]) }], ["not an object", { tabStore: new Map([[KEY, '"x"']]) }],
    ["another's", { tabStore: new Map([[KEY, JSON.stringify({ who: "someone|else", reads: JSON.parse(a.store.get(KEY)).reads })]]) }],
    ["unshaped", { tabStore: new Map([[KEY, JSON.stringify({ who: "x", reads: [1] })]]) }]];
  for (const [name, o] of cases) {
    const p = await boot({ screens: [held], guide: GUIDE, path: "/app/held", plane: plane(), ...o });
    assert.equal(p.doc.getElementById("seen").textContent, "held", name + ": the screen drew");
    for (const op of SIX) assert.equal(p.byOp(op).length, 1, name + ": " + op + " asked as on a first load");
    assert.ok(dockButton(p), name + ": and the frame drew what they answered");
  }
});

test("R124 (G12b) sign-out, a lock and a new sign-in clear what the tab kept", async () => {
  const out = await first();
  assert.ok(out.store.get(KEY));
  await out.click('[data-shell="menu"]');
  await out.click('[data-shell="signout"]');
  assert.equal(out.store.has(KEY), false, "sign-out");
  const idle = await first();
  await idle.clock.tick(31 * 60 * 1000);
  assert.ok(idle.root().querySelector('[data-overlay="lock"]'));
  assert.equal(idle.store.has(KEY), false, "the lock");
  const a = await first();
  const shared = { ...SESSION, d: "shared" };
  const ended = await boot({ screens: [held], guide: GUIDE, path: "/app/held", tabStore: a.store, session: shared, plane: plane({ whoami: ok(MEMBER) }) });
  await ended.clock.tick(16 * 60 * 1000);
  assert.equal(ended.store.has(KEY), false, "an end");
});

test("R124 (G12b) the member's own change of the level is not kept: the next load asks infolevel before the screen settles", async () => {
  const a = await first({ infolevel: ok({ level: "prompt", set_at: "2026-10-01T00:00:00Z", asked_at: null }) });
  await a.click('[data-shell="level"]');
  assert.equal(JSON.parse(a.store.get(KEY)).reads.infolevel, undefined, "dropped when the member changes it");
  const slow = deferred();
  const p = await next(a, { heldcaptures: () => slow.wait.then(() => ok({ items: [{ id: "h1" }] })), infolevel: ok({ level: "pause", set_at: "2026-10-22T00:00:00Z", asked_at: null }) });
  assert.equal(p.byOp("infolevel").length, 1, "asked at once");
  assert.deepEqual(sixOf(p), ["infolevel"], "and only it");
  slow.release();
  await settle();
  for (const op of ["infolevel", ...REACH_OPS]) assert.equal(p.byOp(op).length, 1, op);
  assert.equal(p.byOp("groupidentity").length, 0, "the name is kept and fresh");
});

test("R124 (G12b) a kept read that does not answer when it is asked again keeps what it held, and is not asked again in the page", async () => {
  const a = await first();
  const p = await next(a, { assistantstate: silent });
  assert.ok(dockButton(p), "the kept value stands");
  assert.equal(p.byOp("assistantstate").length, 1);
  await p.back("/app/held");
  assert.equal(p.byOp("assistantstate").length, 1);
});

test("R124 (G12b) control: a page with a screen whose reads fail still asks the six on a first load, together (no wait for another)", async () => {
  const p = await first({ heldcaptures: silent });
  for (const op of SIX) assert.equal(p.byOp(op).length, 1, op);
  const at = SIX.map((o) => p.byOp(o)[0].at);
  assert.ok(Math.max(...at) - Math.min(...at) < 50, "all six out together");
});
