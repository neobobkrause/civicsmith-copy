/* screens-intake R48 (T51 fix round; DEC-382 C56): the watching screen's named requests and sweeps. Each act sends the fields its owner
 * declares; a ratify is offered to the sweep's project owner only; the ratify sentence is read by key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, main, btn, fill, press, refused, word, says, saysIn, rawKeys } from "./page.mjs";

/* The scene is the real store's: mai makes two projects (so she owns both) and invites rosa and dev to the first (they join); the named requests and the sweeps are
   written by the members' own acts, `namedrequestset` and `sweepset` (ratified by `sweepratify`), and read back as their owners answer them. */
const CAN = ["contribute", "create_projects"];
const TARGET = { text: "The 2026 street maintenance report", description: "d" };
const LOCATORS = ["https://oaklandca.gov/resources/report"];
const request = (project, more = {}) => ({ bundle: project, target: TARGET, locators: LOCATORS, authority: "Public Works Department", criticality: "crucial", cadence: "weekly", reason: "The team needs it.", ...more });
const sweep = (project, more = {}) => ({ bundle: project, title: "Planning commission staff reports", sources: ["https://oaklandca.gov/pc"], seeds: ["https://oaklandca.gov/pc"],
  match: { terms: ["agenda"] }, cadence: "weekly", budget: { per_run: 100, backlog: 900 }, reason: "The commission's reports.", ...more });
async function team() {
  const t = await members({ mai: CAN, rosa: ["contribute"], dev: ["contribute"] });
  const project = await t.world.recipes.project(t.mai, "The Coliseum lease");
  const other = await t.world.recipes.project(t.mai, "Pothole repairs");
  for (const who of [t.rosa, t.dev]) { await t.mai.act("projectinvite", { query: { projectId: project, handle: who.handle } }); await who.act("projectjoin", { query: { projectId: project } }); }
  return { ...t, project, other };
}
/* press the act whose button carries a given label (an act may be drawn several times, a row's and the form's) */
async function pressLabel(p, op, labelKey, reason) {
  const b = main(p).querySelectorAll(`button[data-act="${op}"]`).find((x) => x.textContent.includes(word(labelKey)));
  if (!b) throw new Error(`no ${op} labelled ${labelKey}`);
  const ai = b.getAttribute("data-ai");
  await p.click(b);
  const slot = main(p).querySelector(`[data-slot="${ai}"]`);
  if (reason !== undefined && slot && slot.querySelector("textarea")) { slot.querySelector("textarea").value = reason; await p.click(slot.querySelector('[data-shell="reason-send"]')); }
  for (let i = 0; i < 12; i++) { await p.settle(20); await new Promise((r) => setTimeout(r, 2)); }
  return { slot: () => main(p).querySelector(`[data-slot="${ai}"]`) };
}
const open = (t, plane = {}, as = t.mai) => openWorld("/app/watching", { world: t.world, as, plane });
const ratified = async (t, title = "Planning commission staff reports") => {
  const made = await t.mai.act("sweepset", { body: sweep(t.project, { title }) });
  await t.mai.act("sweepratify", { body: { sweep: made.sweep, ratified: true, reason: "Ready." } });
  return made.sweep;
};

test("R48 the named requests: where, who stands behind the source, how often, open or retired, never checked or last checked, due now; an empty list is not drawn", async () => {
  const t = await team();
  await t.mai.act("namedrequestset", { body: request(t.project) });
  const p = await open(t);
  const tx = text(p);
  assert.ok(says(p, "screen.watching.nr.head"));
  assert.ok(tx.includes("The 2026 street maintenance report") && tx.includes("https://oaklandca.gov/resources/report") && tx.includes("Public Works Department"));
  assert.ok(tx.includes(word("monitor.freq.weekly")) && tx.includes(word("screen.watching.nr.open")) && tx.includes(word("screen.watching.nr.never")) && tx.includes(word("screen.watching.nr.due")));
  assert.deepEqual(rawKeys(p), []);
  const u = await team();
  const q = await open(u);
  assert.ok(!says(q, "screen.watching.nr.head"), "the empty list is not drawn");
  assert.ok(says(q, "screen.watching.nr.ask"), "but the way to ask for one is");
});

test("R48 asking for something to be gathered sends the fields namedrequestset declares; nothing is fetched by asking", async () => {
  const t = await team();
  const p = await open(t);
  fill(p, { "nr-project": t.other, "nr-target": "Agenda packets", "nr-desc": "Every packet.", "nr-loc": "https://oaklandca.gov/clerk\nhttps://example.org/mirror", "nr-auth": "City Clerk", "nr-matters": "supporting", "nr-often": "daily" });
  await pressLabel(p, "namedrequestset", "screen.watching.nr.ask", "Agenda packets.");
  assert.deepEqual(p.byOp("namedrequestset").map((r) => { const { reason, ...b } = r.body; return b; }), [{ bundle: t.other, target: { text: "Agenda packets", description: "Every packet." }, locators: ["https://oaklandca.gov/clerk", "https://example.org/mirror"], authority: "City Clerk", criticality: "supporting", cadence: "daily" }]);
  assert.equal(p.byOp("acquire").length + p.byOp("monitor").length, 0);
  const kept = (await t.mai.read("namedrequests")).items;
  assert.deepEqual(kept.map((r) => [r.bundle, r.target.text, r.authority, r.criticality, r.cadence, r.status]), [[t.other, "Agenda packets", "City Clerk", "supporting", "daily", "open"]], "the owner holds what the page sent");
});

test("R48 control: a place that does not start with https://, or no target, is refused before anything is sent, in the design's words", async () => {
  const t = await team();
  const p = await open(t);
  fill(p, { "nr-target": "x", "nr-loc": "http://plain.example/a", "nr-auth": "A" });
  const r = await pressLabel(p, "namedrequestset", "screen.watching.nr.ask", "x");
  assert.ok(saysIn(r.slot(), "screen.watching.nr.ref.https"));
  fill(p, { "nr-target": "", "nr-loc": "https://ok.example/a" });
  const s = await pressLabel(p, "namedrequestset", "screen.watching.nr.ask", "x");
  assert.ok(saysIn(s.slot(), "screen.watching.nr.ref.target"));
  assert.equal(p.byOp("namedrequestset").length, 0);
  assert.deepEqual((await t.mai.read("namedrequests")).items, [], "nothing was planted");
  /* a machine is refused a request only for a machine caller, which a member's page is not: the owner's refusal is a fault, the one scripted answer */
  const m = await open(t, { namedrequestset: refused("MACHINE_CANNOT_SET_REQUEST", "builder detail") });
  fill(m, { "nr-target": "x", "nr-loc": "https://a.example/a", "nr-auth": "A" });
  const u = await pressLabel(m, "namedrequestset", "screen.watching.nr.ask", "x");
  assert.ok(saysIn(u.slot(), "screen.watching.nr.ref.machine1") && saysIn(u.slot(), "screen.watching.nr.ref.machine2"));
});

test("R48 retiring a request sends it whole with status retired; a retired one offers no retire", async () => {
  const t = await team();
  const open1 = await t.mai.act("namedrequestset", { body: request(t.project) });
  const gone = await t.mai.act("namedrequestset", { body: request(t.project, { target: { text: "The 2025 report", description: "d" }, locators: ["https://oaklandca.gov/resources/report25"] }) });
  await t.mai.act("namedrequestset", { body: request(t.project, { request: gone.request, target: { text: "The 2025 report", description: "d" }, locators: ["https://oaklandca.gov/resources/report25"], status: "retired", reason: "Not needed." }) });
  const p = await open(t);
  const retire = main(p).querySelectorAll('button[data-act="namedrequestset"]').filter((b) => b.textContent.includes(word("screen.watching.nr.retire")));
  assert.equal(retire.length, 1, "only the open request");
  await pressLabel(p, "namedrequestset", "screen.watching.nr.retire", "No longer needed.");
  const { reason, ...b } = p.byOp("namedrequestset")[0].body;
  assert.deepEqual(b, { bundle: t.project, request: open1.request, target: TARGET, locators: LOCATORS, authority: "Public Works Department", criticality: "crucial", cadence: "weekly", status: "retired" });
  assert.deepEqual((await t.mai.read("namedrequests")).items.map((r) => r.status), ["retired", "retired"], "the owner retired it");
});

test("R48 defining a sweep sends the fields sweepset declares and starts nothing", async () => {
  const t = await team();
  const p = await open(t);
  fill(p, { "sw-project": t.project, "sw-title": "Council agendas", "sw-sources": "https://oaklandca.gov/council", "sw-seeds": "https://oaklandca.gov/council/agendas", "sw-match": "agenda\nstaff report", "sw-often": "weekly", "sw-budget": "50" });
  await press(p, "sweepset", { reason: "Council agendas" });
  const { reason, ...b } = p.byOp("sweepset")[0].body;
  assert.deepEqual(b, { bundle: t.project, title: "Council agendas", sources: ["https://oaklandca.gov/council"], seeds: ["https://oaklandca.gov/council/agendas"], match: { terms: ["agenda", "staff report"] }, cadence: "weekly", budget: { per_run: 50, backlog: 500 } });
  assert.ok(says(p, "screen.watching.sweepdef.n1") && says(p, "screen.watching.sweepdef.n2"));
  assert.equal(p.byOp("sweepratify").length, 0);
  const held = (await t.mai.read("sweeps")).sweeps;
  assert.deepEqual(held.map((x) => [x.bundle, x.ratified, x.runs.length]), [[t.project, false, 0]], "the owner holds one sweep, not ratified, never run");
  const u = await team();
  const q = await open(u);
  fill(q, { "sw-title": "", "sw-budget": "50" });
  assert.ok(saysIn((await press(q, "sweepset", { reason: "x" })).slot(), "capture.fieldneeded", { field: word("screen.watching.sweepdef.title") }));
});

test("R48 ratifying: the project's owner is offered Ratify, with the scope and budget shown and the ratify sentence by key; a non-owner is offered none and told who to ask", async () => {
  const t = await team();
  const made = await t.mai.act("sweepset", { body: sweep(t.project) });
  const owner = await open(t);
  const ratify = btn(owner, "sweepratify");
  assert.ok(ratify && ratify.textContent.includes(word("screen.watching.sweepdef.ratify")), "the owner is offered it");
  assert.ok(text(owner).includes("oaklandca.gov/pc") && text(owner).includes(word("screen.watching.sweep.pages", { count: 100 })), "the scope and budget shown");
  assert.ok(says(owner, "screen.watching.sweepdef.rat1") && says(owner, "screen.watching.sweepdef.rat2"));
  await press(owner, "sweepratify", { reason: "Ready." });
  assert.deepEqual(owner.byOp("sweepratify").map((r) => ({ sweep: r.body.sweep, ratified: r.body.ratified })), [{ sweep: made.sweep, ratified: true }]);
  assert.equal((await t.mai.read("sweeps")).sweeps[0].ratified, true, "the owner holds the ratification");
  /* control: a member who is not an owner sees no ratify, and is told who to ask */
  const u = await team();
  await u.mai.act("sweepset", { body: sweep(u.project) });
  const other = await open(u, {}, u.rosa);
  assert.equal(btn(other, "sweepratify"), null);
  assert.ok(says(other, "screen.watching.sweepdef.ref.owner1"));
  assert.ok(text(other).includes("mai"));
});

test("R48 stopping a ratified sweep is offered, and sends ratified false; a refusal for a non-owner is drawn by its words", async () => {
  const t = await team();
  await ratified(t);
  const p = await open(t);
  assert.ok(btn(p, "sweepratify").textContent.includes(word("screen.watching.sweepdef.stop")));
  await press(p, "sweepratify", { reason: "Pause breadth." });
  assert.equal(p.byOp("sweepratify")[0].body.ratified, false);
  assert.equal((await t.mai.read("sweeps")).sweeps[0].ratified, false, "the owner holds the stop");
  /* the page offers the stop to an owner; that she has since stopped being one is no state a page opened as one can be put in, so the owner's refusal is the one scripted fault */
  const u = await team();
  await ratified(u);
  const q = await open(u, { sweepratify: refused("SWEEP_RATIFY_NOT_AN_OWNER", "builder detail") });
  const r = await press(q, "sweepratify", { reason: "r" });
  assert.ok(saysIn(r.slot(), "screen.watching.sweepdef.ref.owner1"));
  assert.ok(!r.slot().textContent.includes("builder detail"));
});
