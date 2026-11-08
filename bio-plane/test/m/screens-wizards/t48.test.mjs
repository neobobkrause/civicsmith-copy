/* T48: the guide's line on door-offered scripts (R10), the one chip (R11) and the common line (R12), answered by the real store through
   the world's door (K5175; `world.mjs`): the front doors are the library's own (`startfrom`), the scripts a screen starts are written,
   submitted and approved by the acts that do it. */
import test from "node:test";
import assert from "node:assert/strict";
import { checkClasses } from "../../../src/interface-shell/index.mjs";
import { standIn, said, unhtml } from "./standin.mjs";
import { WELCOME } from "../../../src/screens-wizards/index.mjs";
import { open, lacks, has, SCREENS } from "./kit.mjs";
import { GUIDE } from "../../../src/screens-wizards/index.mjs";
import { team, authored, finished } from "./world.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";

const elsewhere = () => said("wizard.guide.elsewhere", { link: said("wizard.guide.elsewhere_link") });
const idOf = (s) => (typeof s === "object" && s ? s.id : s);
/** The front doors as the store gives them to `as`, and the scripts any door names. */
async function doorsOf(as) {
  const doors = (await as.read("startfrom")).doors;
  return { doors, named: new Set(doors.flatMap((d) => d.scripts.map(idOf))) };
}

test("R10 every step of a script a door names carries the guide's `elsewhere` line; a script no door names carries none", async () => {
  const t = await team();
  const { doors, named } = await doorsOf(t.mai);
  const door = doors.find((d) => d.scripts.length);
  assert.ok(door, "the library has a front door that names a script");
  const GR = idOf(door.scripts[0]);
  const steps = (await t.mai.read("wizardread", { query: { script: GR } })).version.steps;
  const g = standIn({ team: t, as: t.mai, drawn: { finder: ["search"], document: [] } });
  await g.start({ script: GR });
  assert.equal(g.requests.filter((r) => r.op === "startfrom").length, 1, "read once when the run starts");
  for (let i = 0; i < steps.length; i++) {
    assert.ok(g.text().includes(said("guide.step", { i: String(i + 1), n: String(steps.length) })));
    assert.ok(g.text().replace(/\s+([.,])/g, "$1").includes(elsewhere()), `step ${i + 1}`);
    if (i + 1 < steps.length) await g.control("next");
  }
  assert.equal(g.requests.filter((r) => r.op === "startfrom").length, 1);
  // opening the screen sends nothing and keeps the run where it was
  const before = g.requests.length, at = g.view.ui.run.i;
  await g.control("elsewhere");
  assert.deepEqual(g.nav.at(-1), ["elsewhere", null]);
  assert.deepEqual(g.requests.slice(before).map((r) => r.op).filter((op) => op !== "wizardsat"), [], "only the new screen's own marks are read");
  assert.equal(g.view.ui.run.i, at);
  // control: a script no door names (here the welcome)
  assert.ok(!named.has(WELCOME), "the welcome is on no door");
  const w = standIn({ team: t, as: t.mai });
  await w.start({ script: WELCOME });
  assert.ok(!w.text().includes(said("wizard.guide.elsewhere_link")));
});

test("R10 a failed `startfrom` read draws no line and stops nothing", async () => {
  const t = await team();
  const { doors } = await doorsOf(t.mai);
  const GR = idOf(doors.find((d) => d.scripts.length).scripts[0]);
  const g = standIn({ team: t, as: t.mai, faults: { startfrom: null }, drawn: { finder: ["search"] } });
  await g.start({ script: GR });
  assert.ok(!g.text().includes(said("wizard.guide.elsewhere_link")));
  const n = (await t.mai.read("wizardread", { query: { script: GR } })).version.steps.length;
  await g.control("next");
  assert.ok(g.text().includes(said("guide.step", { i: "2", n: String(n) })));
});

/** A group wizard whose steps are all on `members`, one act each; the viewer's gate (`cs.can`) is the shell's side, so an administrator's act is
 *  one the gate lets only an administrator through. */
const onMembers = (t, name, acts) => authored(t, { name, steps: acts.map((a) => ({ screen: "members", act: a, what: "w", why: "y" })) });
/** The acts the store's scripts on `members` use, as `wizardsat` lists them: the ones this test's gate keeps from a member. */
const actsOf = (scripts) => new Set(scripts.flatMap((s) => s.steps.map((st) => st.act).filter(Boolean)));
const canFor = (admin, only) => (op) => admin || !only.has(op);

test("R11 a screen's wizard marks are one chip counting the scripts this viewer can walk; none walkable, no chip", async () => {
  const t = await team();
  await onMembers(t, "Endorse", ["adminendorse"]);
  await onMembers(t, "Endorse and add", ["adminendorse", "memberadd"]);
  const here = (await t.mai.read("wizardsat", { query: { screen: "members" } })).scripts;
  assert.ok(here.length >= 2, "the store offers the two to a member (the gate is the shell's)");
  const only = actsOf(here);
  const m = standIn({ team: t, as: t.mai, kit: { can: canFor(false, only) } });
  await m.enter("members");
  assert.equal(m.marks(), "", "a member whose gate keeps her from every act sees no chip");
  const a = standIn({ team: t, as: t.rosa, kit: { can: canFor(true, only) } });
  await a.enter("members");
  const forAdmin = (await t.rosa.read("wizardsat", { query: { screen: "members" } })).scripts.length;
  assert.ok(unhtml(a.marks()).includes(said("wizard.marks.chip", { n: String(forAdmin) })));
  assert.equal((a.marks().match(/cs-wizmark/g) || []).length, 1, "one chip");
  assert.ok(!a.marks().includes('data-guide="start"'), "the list is beneath the chip until it is pressed");
  // a script one of whose acts is gated is left out; the rest are counted, one reads in the singular
  const free = SCREEN_REGISTRY.find((r) => r.id === "members").acts.find((a) => !only.has(a));
  assert.ok(free, "an act on `members` that no script the store offers there uses");
  await onMembers(t, "Make one", [free]);
  const mixed = standIn({ team: t, as: t.mai, kit: { can: canFor(false, only) } });
  await mixed.enter("members");
  assert.ok(unhtml(mixed.marks()).includes(said("wizard.marks.chip.one")));
});

test("R11 pressing the chip opens each script's name with Start; Recommended replaces Required; the finished count appears only above zero; own drafts count", async () => {
  const t = await team();
  const b1 = await onMembers(t, "Endorse", ["memberadd"]);
  const b2 = await onMembers(t, "Add two", ["memberadd", "membercaps"]);
  await finished(t.mai, b2.script, b2.version, 3);
  const made = await t.mai.act("wizarddraft", { body: { project: t.P1, name: "A draft of mine" } });
  await t.mai.act("wizardrevise", { body: { version: made.version, steps: [{ screen: "members", act: "memberadd", what: "w", why: "y" }], reason: "steps" } });
  const here = (await t.mai.read("wizardsat", { query: { screen: "members" } })).scripts;
  const g = standIn({ team: t, as: t.mai, kit: { can: canFor(true, new Set()) } });
  await g.enter("members");
  assert.ok(unhtml(g.marks()).includes(said("wizard.marks.chip", { n: String(here.length) })), "the draft is counted");
  await g.control("chip");
  const text = unhtml(g.marks());
  for (const s of [b1, b2, { name: "A draft of mine" }]) assert.ok(text.includes(said("screen.guide.mark.start", { name: s.name })));
  assert.equal((g.marks().match(/data-guide="start"/g) || []).length, here.length);
  assert.ok(text.includes(said("screen.guide.mark.finished", { n: "3" })));
  assert.ok(!text.includes(said("screen.guide.mark.finished", { n: "0" })), "a script finished by nobody shows no count");
  await g.control("chip");
  assert.ok(!g.marks().includes('data-guide="start"'), "pressed again, the list closes");
  // the welcome, which the team requires, is Recommended on Home, never "Required"
  const h = standIn({ team: t, as: t.mai });
  await h.enter("home");
  await h.control("chip");
  const ht = unhtml(h.marks());
  assert.ok(ht.includes(said("wizard.mark.recommended")) && !ht.includes("Required"));
});

test("R11 Home's welcome offer keeps its own band, which is not a chip", async () => {
  const t = await team();
  const g = standIn({ team: t, as: t.mai });
  await g.start({ script: WELCOME, joined: true });
  await g.enter("home");
  g.view.ui.marks = { screen: "home", scripts: [] };
  const h = g.marks();
  assert.ok(h.includes("data-guide-offer") && h.includes('data-guide="notnow"'));
});

test("R12 the module\'s real SCREENS and GUIDE compose under interface-shell R56 (every class defined by a served stylesheet); no cs-form, no cs-note, no bare label with help", async () => {
  const t = await team();
  await onMembers(t, "Add", ["memberadd"]);
  for (const [as, subject] of [[t.rosa, null], [t.ivy, "withdrawn"]]) {
    const a = await open("wizards", { team: t, as, subject });
    assert.ok(!/cs-form|cs-note/.test(a.html));
  }
  // interface-shell R56's own check over the module's real screens and guide
  assert.equal(checkClasses(SCREENS, GUIDE, ""), true);
  const g = standIn({ team: t, as: t.mai, drawn: { members: ["memberadd"] }, kit: { can: canFor(true, new Set()) } });
  await g.enter("members");
  await g.control("chip");
  await g.start({ record: { project: t.P1 } });
  const html = [g.marks(), g.render()].join("");
  assert.ok(!/cs-form|cs-note|cs-list|cs-actrow/.test(html));
  const GR = idOf((await doorsOf(t.mai)).doors.find((d) => d.scripts.length).scripts[0]);
  await g.start({ script: GR });
  assert.ok(!/cs-form|cs-note|cs-list|cs-actrow/.test(g.render()));
});

test("R12 over an empty list the library draws no empty section and no zero; a failed read is drawn failed, never as empty", async () => {
  const t = await team();
  const a = await open("wizards", { team: t, as: t.ivy, subject: "withdrawn" });
  has(a, "screen.wizards.empty.withdrawn");
  assert.ok(!/\b0\b/.test(a.text.replace(/[^\n]*Alt\+Shift\+W/, "")), "no zero drawn");
  assert.equal((a.html.match(/<section/g) || []).length, (a.html.match(/<h2/g) || []).length);
  assert.ok(!a.html.includes('id="wz-project"'), "no project chooser with no project");
  // a script finished by nobody shows no count
  const z = await open("wizards", { team: t, as: t.rosa });
  lacks(z, "screen.wizards.finished", { n: "0" });
  // a failed read is drawn failed
  const f = await open("wizards", { team: t, as: t.rosa, faults: { wizards: "none" } });
  assert.ok(f.html.includes('data-state="failed"'));
  lacks(f, "screen.wizards.empty.offered");
});
