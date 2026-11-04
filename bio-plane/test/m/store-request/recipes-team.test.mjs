/* store-request R19 (STORE-REQUEST #7, B18 START): the recipes `unnamedFounderWorld`, `timeline`, `titlelessProject`, `deepChain`, `connectedSignIn`, `investigating` and `mentionedTogether`,
   each over the real store: the state is what the owner answers, each with a control. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld, unnamedFounderWorld } from "./fixtures.mjs";
import { issuedHeld } from "./recipes-team.mjs";

const caps = { capabilities: ["contribute", "create_projects"] };

test("R19 unnamedFounderWorld: the founder holds no handle and a project names her so; control: the default founder has one", async () => {
  const w = await unnamedFounderWorld();
  const pid = await w.recipes.project(w.unnamed, "Unnamed founder project");
  assert.ok((await w.unnamed.read("projectparticipants", { query: { projectId: pid } })).participants.some((p) => p.founder === true && p.handle === null));
  const named = await storeWorld();
  const f = await named.signIn("admin");
  const npid = await named.recipes.project(f, "Named founder project");
  assert.ok((await f.read("projectparticipants", { query: { projectId: npid } })).participants.some((p) => p.founder === true && typeof p.handle === "string"));
});

test("R19 timeline: the world's items carry EDTF, day, minute and second precision, two EDTF items are of undetermined order, and the action advancing the question is in `ours`; control: a set of the question alone has no action", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const P = await w.recipes.project(f, "Timeline project");
  const made = await w.recipes.timeline(f, P);
  const items = made.timeline.world.items;
  const prec = new Set(items.map((i) => i.when.precision));
  assert.ok(["edtf", "day", "minute", "second"].every((p) => prec.has(p)), [...prec].join());
  assert.equal(items.filter((i) => i.order && i.order.undetermined === true && i.when.precision === "edtf").length, 2);
  assert.equal(made.timeline.ours.sources.find((s) => s.source === "actions").items.length, 1);
  const alone = await f.read("timeline", { query: { set: made.events[0] } });
  assert.equal(((alone.ours.sources.find((s) => s.source === "actions") || { items: [] }).items).length, 0);
});

test("R19 titlelessProject: `image` states no title line and `projectlist` names the project from the promotion's meta; control: a recipe project's image states its title", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const id = await w.recipes.titlelessProject(f, "Pothole repairs");
  assert.ok(!/^title:/m.test((await f.read("image", { query: { id } }))["bundle.md"]));
  assert.deepEqual((await f.read("projectlist", { query: { limit: "200" } })).projects.map((p) => p.name), ["Pothole repairs"]);
  const titled = await w.recipes.project(f, "Titled");
  assert.match((await f.read("image", { query: { id: titled } }))["bundle.md"], /^title:/m);
});

test("R19 deepChain: the ninth question's connection axis is undetermined; control: the third's is unrated", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const ids = await w.recipes.deepChain(f, await w.recipes.project(f, "Axes"));
  assert.equal(ids.length, 9);
  assert.equal((await f.read("inquirystrength", { query: { id: ids[8] } })).connection.state, "undetermined");
  assert.equal((await f.read("inquirystrength", { query: { id: ids[2] } })).connection.state, "unrated");
});

test("R19 connectedSignIn: the member's sign-in is connected and her account reference says so; control: before it she is not connected", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann");
  const made = await w.recipes.connectedSignIn(ann);
  assert.deepEqual([made.connected, made.reference], [true, true]);
  const other = await storeWorld({ ai: true });
  const bo = await other.signIn("bo");
  assert.equal(await issuedHeld(bo), false);
});

test("R19 investigating: a project reads forming and, once a question rests on a held document, investigating", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const made = await w.recipes.investigating(f, await w.recipes.project(f, "Stage"));
  assert.deepEqual([made.before, made.after], ["forming", "investigating"]);
});

test("R19 mentionedTogether: `explore` from one agenda has a mentioned_together hop to the other; control: a document naming no entity has none", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const made = await w.recipes.mentionedTogether(f, f, await w.recipes.project(f, "Co-mention"));
  assert.ok(made.explored.paths.some((p) => p.hops.some((h) => h.kind === "mentioned_together" && h.to === made.documents[1])));
  const lone = await w.recipes.hold(f, "Lone", "<html><body><p>Nothing.</p></body></html>", "", { type: "text/html", read: true });
  const away = await f.act("explore", { body: { from: lone.bundle, at: new Date(w.now()).toISOString() } });
  assert.ok(!(away.paths || []).some((p) => p.hops.some((h) => h.kind === "mentioned_together")));
});
