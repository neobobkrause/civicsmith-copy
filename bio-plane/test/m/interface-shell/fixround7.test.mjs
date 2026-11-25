/* interface-shell, fix round 7 (T51; plan fix-round-7-T51.md): G77 (a radio group that steps, R80 R90 R109) and G81 (the frame's two constants, R124).
   Each test was seen failing first. The browser's radio-group semantics live in the harness (`fire` unchecks a chosen radio's siblings of its name;
   `choose` is a click that fires nothing on a box already checked). */
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./harness.mjs";

/* the Document screen's "By page" control, as `screens-inquiry` draws it: [Previous?, Next?] in one radio group, a redraw choice `readpage`.
   A screen's functions are self-contained (R21), so the two screens below are written out: pages 1 to 8, and pages 4 to 8 (the first with text is 4) */
const STEPPER = {
  id: "home", words: [], reads: () => ({}), acts: [],
  render(cs, view) {
    const total = 8, first = 1, asked = Number(view.ui.readpage), cur = Number.isInteger(asked) && asked >= first && asked <= total ? asked : first;
    return '<h1>x</h1><p id="at">' + cur + "</p>" + cs.checks("pager", { text: "Page " + cur + " of " + total },
      (cur > first ? [{ value: String(cur - 1), text: "Previous page", on: false }] : []).concat(cur < total ? [{ value: String(cur + 1), text: "Next page", on: false }] : []),
      { radio: true, redraw: "readpage" });
  },
};
const STEPPER_FROM_4 = { ...STEPPER, render(cs, view) {
  const total = 8, first = 4, asked = Number(view.ui.readpage), cur = Number.isInteger(asked) && asked >= first && asked <= total ? asked : first;
  return '<h1>x</h1><p id="at">' + cur + "</p>" + cs.checks("pager", { text: "Page " + cur + " of " + total },
    (cur > first ? [{ value: String(cur - 1), text: "Previous page", on: false }] : []).concat(cur < total ? [{ value: String(cur + 1), text: "Next page", on: false }] : []),
    { radio: true, redraw: "readpage" });
} };
const boxes = (p) => p.doc.getElementById("pager").querySelectorAll("input");
const boxOf = (p, text) => boxes(p).find((b) => b.parentElement.textContent.includes(text));
const at = (p) => Number(p.doc.getElementById("at").textContent);

for (const [name, screen, start] of [["pages 1 to 8", STEPPER, 1], ["the first page with text is 4", STEPPER_FROM_4, 4]]) {
  test(`G77 R80 R90 R109 "Next page" pressed again and again steps the page each time, and a redraw leaves no box of the group checked (${name})`, async () => {
    const p = await boot({ screens: [screen] });
    assert.equal(at(p), start);
    for (let n = 1; n <= 4; n++) {
      await p.choose(boxOf(p, "Next page"));
      assert.equal(at(p), start + n, "after press " + n);
      assert.deepEqual(boxes(p).filter((b) => b.checked).length, 0, "no box of the group is checked after the redraw");
    }
    await p.choose(boxOf(p, "Previous page"));
    assert.equal(at(p), start + 3, "Previous steps back one");
    await p.choose(boxOf(p, "Next page"));
    assert.equal(at(p), start + 4);
  });
}

test("G77 R109 control: a plain checkbox group (no redraw) still keeps what the member ticked across a redraw", async () => {
  const BOXES = { id: "home", words: [], reads: () => ({}), acts: [],
    render: (cs) => '<h1>x</h1><button type="button" id="again" data-shell="theme" data-theme-to="light">go</button>' + cs.checks("tick", { text: "Pick" }, [{ value: "a", text: "A", on: false }, { value: "b", text: "B", on: false }]) };
  const p = await boot({ screens: [BOXES] });
  const a = p.doc.getElementById("tick").querySelectorAll("input")[0];
  a.checked = true;
  await p.click("#again");
  assert.equal(p.doc.getElementById("tick").querySelectorAll("input")[0].checked, true, "ticked stays ticked");
  assert.equal(p.doc.getElementById("tick").querySelectorAll("input")[1].checked, false);
});

test("G77 harness: `fire` unchecks the same-named radios of a chosen one (the browser's group), and `choose` on a box already checked fires no change", async () => {
  const p = await boot({ screens: [STEPPER] });
  await p.choose(boxOf(p, "Next page"));
  const [one, two] = boxes(p);
  one.checked = true; two.checked = false;
  p.fire(two, "change");
  assert.equal(one.checked, false, "the sibling is unchecked");
  assert.equal(two.checked, true);
  const seen = at(p);
  await p.choose(two);
  assert.equal(at(p), seen, "a box already checked changes nothing");
});

/* L (platform check): real Chromium on the served shell. Radio-group semantics (a checked radio fires no `change`; the others of its name uncheck) are the
   browser's own, which the stand-in only models. The group is the Document screen's, pressed with the real mouse, five times, on 8 pages. */
import { inChromium } from "./chromium.mjs";
test("G77 L (real Chromium): pressing \"Next page\" with the mouse steps the page every time, for five presses, and no box is left checked after a redraw", async () => {
  const REAL = { id: "home", words: [], reads: () => ({}), acts: [],
    render: new Function("cs", "view", `
      const total = 8, first = 1, asked = Number(view.ui.readpage), cur = Number.isInteger(asked) && asked >= first && asked <= total ? asked : first;
      return '<h1>x</h1><p id="at">' + cur + "</p>" + cs.checks("pager", { text: "Page " + cur + " of " + total },
        (cur > first ? [{ value: String(cur - 1), text: "Previous page", on: false }] : []).concat(cur < total ? [{ value: String(cur + 1), text: "Next page", on: false }] : []),
        { radio: true, redraw: "readpage" });
    `) };
  const seen = await inChromium([REAL], { width: 1280, path: "/app/home", ready: "#at" }, async (page) => {
    const out = [];
    for (let n = 1; n <= 5; n++) {
      await page.click("text=Next page");
      await page.waitForTimeout(150);
      out.push({ at: Number(await page.textContent("#at")), checked: await page.locator("#pager input:checked").count() });
    }
    return out;
  });
  assert.deepEqual(seen.map((s) => s.at), [2, 3, 4, 5, 6], "each press steps one page");
  assert.deepEqual(seen.map((s) => s.checked), [0, 0, 0, 0, 0], "no box of the group is left checked after the redraw");
});

/* ---- G81 (R124): a second page load in the tab asks only the four reads that can change under the member ---- */
import { ok, STORE_KEY, MEMBER, settle } from "./harness.mjs";
import { inWorld, bootAs } from "./world.mjs";

const KEY = STORE_KEY + ":frame";
const TEAM = ["groupidentity", "infolevel"], REACH = ["assistantstate", "accountreference", "subscriptionsignin", "groupkeystate"];
const HELD = { id: "held", words: [], reads: () => ({ h: { op: "heldcaptures", query: { limit: "5" } } }), acts: [],
  render: (cs, view) => cs.state("h", view, () => '<p id="seen">held</p>') };
const plane = (more = {}) => ({ whoami: ok({ ...MEMBER, capabilities: ["contribute"] }), heldcaptures: ok({ items: [{ id: "h1" }] }), wizardsat: ok({ scripts: [] }), assistantstate: ok({ on: true }), accountreference: ok({ held: true }), ...more });
/* the team's name and level are the world's: its administrator names the team by the real act, and a later load reads what the world then holds */
const load = async (o = {}) => {
  const { world, me } = await inWorld();
  await me.act("groupnameset", { body: { name: "River Town" } });
  return Object.assign(await bootAs(world, me, { screens: [HELD], path: "/app/held", plane: plane(), ...o }), { world, me });
};
const again = async (a, more = {}, o = {}) => Object.assign(await bootAs(a.world, a.me, { screens: [HELD], path: "/app/held", tabStore: a.store, local: Object.fromEntries(a.local), plane: plane(more), ...o }), { world: a.world, me: a.me });
const dock = (p) => !!p.root().querySelector('.cs-mast [data-shell="dock"]');
/* the stored answer's time moved back by `ms`, as a load some time earlier would have left it */
const aged = (a, ms) => { const o = JSON.parse(a.store.get(KEY)); for (const n of Object.keys(o.at)) o.at[n] -= ms; return new Map([[KEY, JSON.stringify(o)]]); };

test("G81 R124 a second load in the tab issues no `groupidentity` and no `infolevel` read at all, before or after the screen settles; the first load issues both", async () => {
  const a = await load();
  for (const op of TEAM) assert.equal(a.byOp(op).length, 1, "the first load asks " + op);
  const p = await again(a);
  await settle();
  for (const op of TEAM) assert.equal(p.byOp(op).length, 0, op + ": kept and fresh, so not asked");
  assert.equal(p.root().querySelector(".cs-mast .mk-grp").textContent, "River Town", "the name is drawn from what the tab kept");
  await p.back("/app/held");
  for (const op of TEAM) assert.equal(p.byOp(op).length, 0, op + ": nor on a route in the page");
});

test("G81 R124 control: the store keeps when each constant was answered, and no other time", async () => {
  const a = await load();
  const o = JSON.parse(a.store.get(KEY));
  assert.deepEqual(Object.keys(o.at).sort(), [...TEAM].sort());
  for (const n of TEAM) assert.ok(Number.isFinite(o.at[n]) && Math.abs(o.at[n] - Date.now()) < 60 * 1000, n + " carries the time it was answered");
});

for (const [name, age] of [["a day old", 24 * 3600 * 1000 + 1000], ["two days old", 48 * 3600 * 1000]]) {
  test(`G81 R124 a constant kept ${name} is asked again once, and the frame follows a changed answer`, async () => {
    const a = await load();
    const renamed = (await a.me.act("groupnameset", { body: { name: "New Name" } })).display_name;
    const p = await again(a, {}, { tabStore: aged(a, age) });
    await settle();
    for (const op of TEAM) assert.equal(p.byOp(op).length, 1, op + ": asked once after the screen settles");
    assert.equal(p.root().querySelector(".cs-mast .mk-grp").textContent, renamed);
    assert.equal(JSON.parse(p.store.get(KEY)).reads.groupidentity.display_name, renamed);
  });
}

test("G81 R124 a constant kept under a day is not asked; one kept with no time, a time that is no number, or a time in the future is asked again (control)", async () => {
  const a = await load();
  const young = await again(a, {}, { tabStore: aged(a, 23 * 3600 * 1000) });
  await settle();
  for (const op of TEAM) assert.equal(young.byOp(op).length, 0, op + ": 23 hours old is fresh");
  for (const [what, edit] of [["no time", (o) => { delete o.at; }], ["not a number", (o) => { o.at = { groupidentity: "yesterday", infolevel: null }; }], ["the future", (o) => { for (const n of Object.keys(o.at)) o.at[n] += 3600 * 1000; }]]) {
    const o = JSON.parse(a.store.get(KEY));
    edit(o);
    const p = await again(a, {}, { tabStore: new Map([[KEY, JSON.stringify(o)]]) });
    await settle();
    for (const op of TEAM) assert.equal(p.byOp(op).length, 1, what + ": " + op + " asked once");
  }
});

test("G81 R124 the member's own change of the level makes the next load ask it again, though it was kept less than a day ago", async () => {
  const a = await load({ plane: plane({ infolevel: ok({ level: "prompt", set_at: "2026-10-01T00:00:00Z", asked_at: null }) }) });
  await a.click('[data-shell="level"]');
  const o = JSON.parse(a.store.get(KEY));
  assert.equal(o.reads.infolevel, undefined, "dropped");
  assert.equal(o.at.infolevel, undefined, "and its time with it");
  const p = await again(a, { infolevel: ok({ level: "pause", set_at: "2026-10-22T00:00:00Z", asked_at: null }) });
  assert.equal(p.byOp("infolevel").length, 1, "asked at once");
  assert.equal(p.byOp("groupidentity").length, 0, "the other constant is still kept");
});

/* the four that stay: each is asked once on the second load, and another actor's change is drawn (a characterization: green before the change and after) */
const CASES = [
  ["assistantstate", { assistantstate: ok({ on: true }), accountreference: ok({ held: true }) }, { assistantstate: ok({ on: false }) }, "the assistant turned off"],
  ["accountreference", { assistantstate: ok({ on: true }), accountreference: ok({ held: true }) }, { accountreference: ok({ held: false }) }, "the member's own reference gone"],
  ["subscriptionsignin", { assistantstate: ok({ on: true }), accountreference: ok({ held: false }), subscriptionsignin: ok({ connected: true }) }, { subscriptionsignin: ok({ connected: false }) }, "a subscription lapsed"],
  ["groupkeystate", { assistantstate: ok({ on: true }), accountreference: ok({ held: false }), groupkeystate: ok({ on: true, held: true }) }, { groupkeystate: ok({ on: false }) }, "the group key turned off"],
];
for (const [op, first, change, what] of CASES) {
  test(`G81 R124 CHARACTERIZATION ${op}: asked once on the next load and never kept past it, so ${what} is drawn`, async () => {
    const a = await load({ plane: plane(first) });
    assert.ok(dock(a), "the first load: reachable");
    const after = { ...first, ...change };
    const p = await again(a, after);
    await settle();
    assert.equal(p.byOp(op).length, 1, op + " is asked once on the second load");
    assert.equal(dock(p), false, what + ": the assistant is no longer offered");
    const q = await again(p, after);
    await settle();
    assert.equal(q.byOp(op).length, 1, "and once on a third: never taken from the store alone");
  });
}
