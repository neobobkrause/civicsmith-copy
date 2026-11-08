/* R16: `aiproject` opened by a member who is not in the project draws what `project` draws (screens-inquiry R60), over the world's real
   store: projects started by the real act (`promote`), their visibility, invitations and directory the owners' own. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, aiTeam, said, all, textOf, squash, actOps } from "./kit.mjs";

const h1 = (o) => all(o.tree, (e) => e.tag === "h1").map((e) => squash(textOf(e)));
const sections = (o) => all(o.tree, (e) => e.tag === "section");

test("R16 a findable project, to a member not in it: its name and Ask to join (projectrequest), nothing else of it, and the accounts line never drawn as failed", async () => {
  const t = await aiTeam();
  const id = await t.w.recipes.project(t.founder, "Coliseum lease");
  const a = await open(t, "aiproject", t.dev, { subject: id });
  assert.deepEqual(actOps(a.tree), ["projectrequest"]);
  assert.ok(a.text.includes(said("screen.project.notjoined")));
  assert.ok(h1(a).includes("Coliseum lease"), "its name, read from the record or the directory");
  assert.ok(h1(a).every((x) => !/PROJ-/.test(x)), "never its id");
  assert.equal(sections(a).length, 0, "nothing else of the project");
  assert.equal(all(a.tree, (e) => e.attrs["data-state"] === "failed").length, 0, "no read drawn as failed");
  const sent = (await a.press("projectrequest")).sent.filter((r) => r.op === "projectrequest");
  assert.deepEqual(sent.map((r) => r.query), [{ projectId: id }]);
  const mine = (await t.dev.read("projectdirectory", { query: {} })).projects.find((p) => p.id === id).request;
  assert.equal(mine.state, "open", "the owner keeps her request");
  assert.equal(all(a.tree, (e) => e.attrs["data-request"] === "asked").length, 1, "her open request is said, re-read from the directory");
  assert.deepEqual(actOps(a.tree), [], "and asked once, she is offered no second ask");
});

test("R16 a member invited and not yet joined is offered Join (projectjoin), never a failed read", async () => {
  const t = await aiTeam();
  const id = await t.w.recipes.project(t.founder, "Coliseum lease");
  await t.founder.act("projectinvite", { query: { projectId: id, handle: "dev" }, body: {} });
  const a = await open(t, "aiproject", t.dev, { subject: id });
  assert.deepEqual(actOps(a.tree), ["projectjoin"]);
  assert.equal(all(a.tree, (e) => e.attrs["data-state"] === "failed").length, 0);
  const sent = (await a.press("projectjoin")).sent.filter((r) => r.op === "projectjoin");
  assert.deepEqual(sent.map((r) => r.query), [{ projectId: id }]);
});

test("R16 a hidden project, to a member not in it: the unavailable state b with no form; a bare aiproject draws only the bare state", async () => {
  const t = await aiTeam();
  const id = await t.w.recipes.project(t.founder, "Hidden one", { visibility: null });
  // the store tells an administrator that the project exists and is not hers; it tells a member no such project, the shell's bare state
  const rosa = await open(t, "aiproject", t.rosa, { subject: id });
  assert.deepEqual(actOps(rosa.tree), [], "no form");
  assert.equal(all(rosa.tree, (e) => e.attrs["data-unavailable"] === "notyours").length, 1);
  assert.ok(rosa.text.includes(said("shell.unavailable.notyours.says")));
  assert.equal(sections(rosa).length, 0, "nothing else of the project");
  assert.ok(h1(rosa).every((x) => !/PROJ-/.test(x)));
  const dev = await open(t, "aiproject", t.dev, { subject: id });
  assert.deepEqual(actOps(dev.tree), []);
  assert.equal(sections(dev).length, 0);
  assert.ok(!dev.text.includes("Hidden one"), "nothing of it is told her");
  // bare: no subject
  const bare = await open(t, "aiproject", t.dev);
  assert.deepEqual(actOps(bare.tree), []);
  assert.equal(sections(bare).length, 0);
  assert.equal(all(bare.tree, (e) => ["input", "select", "textarea"].includes(e.tag)).length, 0, "no form");
});

test("R16 control: a participant is drawn the screen whole: its accounts, its checks and its limit, under the project's name", async () => {
  const t = await aiTeam();
  const id = await t.w.recipes.project(t.founder, "Coliseum lease");
  const a = await open(t, "aiproject", t.founder, { subject: id });
  assert.ok(h1(a).includes("Coliseum lease"));
  const heads = sections(a).map((s) => squash(textOf(all(s, (e) => e.tag === "h2")[0] || { children: [] })));
  for (const k of ["order.head", "chk.head", "bud.head"]) assert.ok(heads.includes(said("screen.aiproject." + k)), k);
  assert.ok(!a.text.includes(said("screen.project.notjoined")));
});
