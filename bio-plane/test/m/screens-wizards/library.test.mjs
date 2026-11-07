/* Settings › Wizards at the module's interface, over the real served page (R1, R8), answered by the real store through the world's
   door (K5175; `world.mjs`): a Civicsmith wizard, a team's approved copy of it, a newer draft of the copy, a submitted copy, a retired
   one, a copy whose base has changed and a proposal are all made by the acts that make them, and every name, id and count a test
   asserts is read back from the store's own answers. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, has, lacks, open, panelOf, rowOf, said, textOf, squash, SCREENS } from "./kit.mjs";
import { decode } from "../interface-shell/dom.mjs";
import { libraryTeam, refusalOf, copyOf } from "./world.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const opsIn = (n) => [...new Set(acts(n).map((b) => b.attrs["data-act"]))].sort();
const t = (n) => squash(decode(textOf(n)));
const K = (vid) => vid.replace(/[^A-Za-z0-9_-]/g, "_");
const idsOf = (lt) => ({ civ: lt.civ.versions[0].id, copy: lt.copy.version, draft: lt.draft.version, sub: lt.submitted.version, changed: lt.changed.version });
const stepsOf = async (as, vid) => (await as.read("wizardread", { query: { script: vid.slice(0, vid.lastIndexOf("@")), version: vid } })).version.steps;

test("R1 the screen's acts are the registry's six for `wizards`, every one drawn where it applies", async () => {
  const reg = SCREEN_REGISTRY.find((s) => s.id === "wizards");
  assert.deepEqual(SCREENS.map((s) => s.id), ["wizards"]);
  assert.deepEqual(SCREENS[0].acts.map((a) => a.op).sort(), [...reg.acts].sort());
  const lt = await libraryTeam();
  const V = idsOf(lt);
  // the library of wizards in use, then the states a member chooses: together every act is drawn where it applies
  const drawn = new Set();
  const a = await open("wizards", { team: lt, as: lt.mai });
  for (const op of opsIn(a.tree)) drawn.add(op);
  await a.press("wizards", { data: { state: "draft" } });
  await a.press("wizards", { data: { open: V.draft } });
  for (const op of opsIn(a.tree)) drawn.add(op);
  await a.press("wizards", { data: { state: "submitted" } });
  for (const op of opsIn(a.tree)) drawn.add(op);
  const r = await open("wizards", { team: lt, as: lt.rosa });
  for (const op of opsIn(r.tree)) drawn.add(op);
  assert.deepEqual([...drawn].sort(), [...reg.acts].sort());
  // control: a member without `contribute` is offered the reads only (op-declarations NEEDS; interface-shell R12)
  const reader = await open("wizards", { team: lt, as: lt.teo });
  assert.deepEqual(opsIn(reader.tree), ["wizards"]);
});

test("R1 reads wizards, baseupdates and projectlist; each script a row with its name, whose, base, approver and finished count", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.rosa });
  assert.deepEqual(a.p.requests.map((r) => r.op).filter((op) => ["wizards", "baseupdates", "projectlist"].includes(op)), ["wizards", "baseupdates", "projectlist"]);
  // a Civicsmith script's name by its key `wizard.<id>.name`, as the store lists it
  const civ = rowOf(a.tree, V.civ);
  const cv = lt.civ.versions[0];
  assert.ok(t(civ).includes(said(`wizard.${lt.civ.id}.name`)));
  assert.ok(t(civ).includes(said("screen.wizards.whose.civicsmith")));
  assert.ok(t(civ).includes(said("screen.wizards.nobase")));
  assert.ok(t(civ).includes(cv.approved.by.name));
  assert.equal(cv.use.finish, 2, "the two finished walks the world made");
  assert.ok(t(civ).includes(said("screen.wizards.finished", { n: String(cv.use.finish) })));
  // a team's approved copy: as recorded, this team's, what it is based on, its approver
  const copy = rowOf(a.tree, V.copy);
  assert.ok(t(copy).includes(lt.copy.name));
  assert.ok(t(copy).includes(said("screen.wizards.whose.group")));
  assert.ok(t(copy).includes(said("screen.wizards.basedon", { name: said(`wizard.${lt.civ.id}.name`) })));
  assert.ok(t(copy).includes("rosa"));
  // control: a copy nobody has finished shows no count, and one whose base did not change does not say so
  lacks(a, "screen.wizards.finished", { n: "0" });
  assert.ok(!t(copy).includes(said("screen.wizards.basechanged")));
  // the copy whose base the library has since moved on from says so
  assert.ok(t(rowOf(a.tree, V.changed)).includes(said("screen.wizards.basechanged")));
  // a draft is not yet approved
  await a.press("wizards", { data: { state: "draft" } });
  assert.ok(t(rowOf(a.tree, V.draft)).includes(said("screen.wizards.notapproved")));
  // empty: the screen's own sentence, for a state nothing is in
  const e = await open("wizards", { team: lt, as: lt.mai, subject: "withdrawn" });
  has(e, "screen.wizards.empty.withdrawn");
});

test("R1 a Civicsmith script's row offers no write act but the copy (WIZARD_NOT_THE_GROUPS)", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.rosa });
  // the wizards in use are read-only (R16); the acts that write sit in the fold's own table
  assert.deepEqual(opsIn(panelOf(a.tree, V.civ, "library")), ["wizards"]);
  assert.deepEqual(opsIn(panelOf(a.tree, V.civ, "own")), ["wizarddraft"]);
  assert.ok(t(panelOf(a.tree, V.civ, "own")).includes(said("screen.wizards.civicsmith.only")));
  // control: a team's approved script offers its approver's acts too
  assert.deepEqual(opsIn(panelOf(a.tree, V.copy, "own")), ["wizardapprove", "wizarddraft", "wizardretire"]);
  // a draft: withdrawn or submitted by whoever may; the author's own also opens its steps to change them there
  await a.press("wizards", { data: { state: "draft" } });
  assert.deepEqual(opsIn(panelOf(a.tree, V.draft, "own")), ["wizardretire", "wizardsubmit"]);
  const mine = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  assert.deepEqual(opsIn(panelOf(mine.tree, V.draft, "own")), ["wizardretire", "wizards", "wizardsubmit"]);
  const sub = await open("wizards", { team: lt, as: lt.rosa, subject: "submitted" });
  assert.deepEqual(opsIn(panelOf(sub.tree, V.sub, "own")), ["wizardapprove", "wizardretire"]);
});

test("R1 wizards: a state pressed lists it; \"See the whole library\" lists the offered ones again", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.rosa });
  const { sent } = await a.press("wizards", { data: { state: "retired" } });
  assert.deepEqual(sent.map((r) => [r.op, r.query.state]), [["wizards", "retired"], ["wizards", "retired"]], "the act, then R8's read again in that state");
  has(a, "screen.wizards.retired", { reason: lt.retired.reason });
  // open proposals: each with "Draft a wizard from these steps" and, into the member's own draft, adopt
  const b = await open("wizards", { team: lt, as: lt.mai });
  await b.press("wizards", { data: { state: "proposed" } });
  has(b, "screen.wizards.proposal.by", { why: lt.proposal.why });
  const k = lt.proposal.id;
  const p = panelOf(b.tree, k, "ownproposals");
  assert.deepEqual(opsIn(p), ["wizarddraft", "wizardrevise"]);
  const drafted = await b.press("wizarddraft", { data: { from: k }, values: { [`wz-pn-${k}`]: "Search first" } });
  assert.deepEqual(drafted.sent[0].body, { from: k, name: "Search first" });
  const mine = (await lt.mai.read("wizards", { query: { state: "draft" } })).scripts.find((s) => s.name === "Search first");
  assert.ok(mine, "the store holds the draft the proposal became");
  // a proposal is taken once: adopting the other into one of her drafts is the other way
  const c = await open("wizards", { team: lt, as: lt.mai });
  await c.press("wizards", { data: { state: "proposed" } });
  const adopted = await c.press("wizardrevise", { data: { adopt: lt.other.id }, reason: "adopting" });
  const into = adopted.sent[0].body.version;
  assert.ok([V.draft, mine.versions[0].id].includes(into), "into one of her own drafts");
  assert.deepEqual(adopted.sent[0].body, { version: into, adopt: lt.other.id, reason: "adopting" });
  assert.equal((await stepsOf(lt.mai, into)).at(-1).what, "Look first", "the store holds the adopted steps");
});

test("R1 wizarddraft: \"Copy a wizard to change it\" sends the version, the project and the name; the new script shows its base", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.mai });
  const k = K(V.civ);
  const { sent } = await a.press("wizarddraft", { data: { mode: "copy", version: V.civ }, values: { ["wz-cp-" + k]: lt.P1, ["wz-cn-" + k]: "Get a record, our way" } });
  assert.deepEqual(sent[0].body, { copy: V.civ, project: lt.P1, name: "Get a record, our way" });
  assert.ok(a.p.requests.some((r, i) => i > 0 && r.op === "wizards"), "R8: read again");
  // the store holds the draft, based on the original
  const made = (await lt.mai.read("wizards", { query: { state: "draft" } })).scripts.find((s) => s.name === "Get a record, our way");
  assert.equal(made.based_on.version, V.civ);
  // with no name typed, the copy keeps its original's name, never an empty one
  const kept = await a.press("wizarddraft", { data: { mode: "copy", version: V.civ }, values: { ["wz-cp-" + k]: lt.P1, ["wz-cn-" + k]: "" } });
  assert.deepEqual(kept.sent[0].body, { copy: V.civ, project: lt.P1, name: lt.civ.name });
  // control: with no project to choose, nothing is sent and the screen says why
  const n = await open("wizards", { team: lt, as: lt.ivy });
  const r = await n.press("wizarddraft", { data: { mode: "copy", version: V.civ } });
  assert.deepEqual(r.sent, []);
  assert.equal(n.refused.key, "screen.wizards.project.none");
});

test("R1 R3 \"Record a new wizard\" hands over to the guide and sends nothing from the screen", async () => {
  const lt = await libraryTeam();
  const a = await open("wizards", { team: lt, as: lt.mai });
  const r = await a.press("wizarddraft", { data: { mode: "record" }, values: { "wz-project": lt.P1 } });
  assert.deepEqual(r.sent, []);
  // the screen calls `cs.wizard(null, null, {record: {project}})` (the guide's recording, J2 (10))
  const rec = SCREENS[0].acts.find((x) => x.op === "wizarddraft");
  const calls = [];
  const out = rec.send({ ui: {} }, { dataset: { mode: "record" } }, { value: () => lt.P1, wizard: (...x) => calls.push(x) }, {});
  assert.equal(out, null);
  assert.deepEqual(calls, [[null, null, { record: { project: lt.P1 } }]]);
  // control: with no project chosen, the guide is not started
  const none = [];
  assert.deepEqual(rec.send({ ui: {} }, { dataset: { mode: "record" } }, { value: () => "", wizard: (...x) => none.push(x) }, {}), { refuse: "screen.wizards.project.none" });
  assert.deepEqual(none, []);
});

test("R1 \"See its steps\" reads wizardread; the author's draft is reworded, reordered and pruned by wizardrevise", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.mai });
  await a.press("wizards", { data: { open: V.civ } });
  assert.deepEqual(a.p.requests.filter((r) => r.op === "wizardread").map((r) => r.query), [{ script: lt.civ.id, version: V.civ }]);
  // a Civicsmith script's steps by their keys
  assert.ok(t(panelOf(a.tree, V.civ)).includes(said(`wizard.${lt.civ.id}.step1.what`)));
  // the author's draft: reworded, reordered (the first two swapped) and pruned (the last removed)
  await a.press("wizards", { data: { state: "draft" } });
  await a.press("wizards", { data: { open: V.draft } });
  const was = await stepsOf(lt.mai, V.draft);
  assert.ok(was.length >= 3, "a draft with steps to move");
  const k = K(V.draft);
  const { sent, asked } = await a.press("wizardrevise", { data: { mode: "edit", version: V.draft }, reason: "clearer",
    values: { [`wz-w-${k}-0`]: "Search the record", [`wz-p-${k}-0`]: "2", [`wz-p-${k}-1`]: "1", [`wz-x-${k}-${was.length - 1}`]: true } });
  assert.equal(asked, true, "an undetermined act asks a reason (interface-shell R11)");
  const keep = (st, over = {}) => ({ screen: st.screen, act: st.act, what: st.what, why: st.why, ...(st.draft ? { draft: st.draft } : {}), ...(st.via ? { via: st.via } : {}), ...over });
  const want = [keep(was[1]), keep(was[0], { what: "Search the record" }), ...was.slice(2, -1).map((st) => keep(st))];
  assert.deepEqual(sent[0].body, { version: V.draft, reason: "clearer", steps: want });
  // the store holds the revision
  assert.deepEqual((await stepsOf(lt.mai, V.draft)).map((st) => [st.screen, st.act, st.what]), want.map((st) => [st.screen, st.act, st.what]));
  // control: an approved version is not editable, and another author's draft offers no revise
  const live = await open("wizards", { team: lt, as: lt.mai });
  await live.press("wizards", { data: { open: V.copy } });
  assert.ok(!acts(panelOf(live.tree, V.copy, "own")).some((b) => b.attrs["data-act"] === "wizardrevise"));
  const other = await open("wizards", { team: lt, as: lt.rosa, subject: "draft" });
  await other.press("wizards", { data: { open: V.draft } });
  assert.ok(!acts(panelOf(other.tree, V.draft, "own")).some((b) => b.attrs["data-act"] === "wizardrevise"));
});

test("R1 wizardrevise adds a step with the advanced editor's fields; removing every step sends nothing", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  await lt.rosa.act("wizardeditorgrant", { body: { member: "mai" } });
  const a = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  await a.press("wizards", { data: { open: V.draft } });
  const was = await stepsOf(lt.mai, V.draft);
  const k = K(V.draft);
  const { sent } = await a.press("wizardrevise", { data: { mode: "edit", version: V.draft }, reason: "more",
    values: { [`wz-as-${k}`]: "document", [`wz-aa-${k}`]: "cite", [`wz-aw-${k}`]: "Cite it", [`wz-ay-${k}`]: "So it counts" } });
  assert.deepEqual(sent[0].body.steps.at(-1), { screen: "document", act: "cite", what: "Cite it", why: "So it counts" });
  assert.equal(sent[0].body.steps.length, was.length + 1);
  assert.deepEqual((await stepsOf(lt.mai, V.draft)).at(-1).what, "Cite it", "the store holds the added step");
  await a.press("wizards", { data: { open: V.draft } });
  const now = await stepsOf(lt.mai, V.draft);
  const gone = Object.fromEntries(now.map((_, i) => [`wz-x-${k}-${i}`, true]));
  const none = await a.press("wizardrevise", { data: { mode: "edit", version: V.draft }, reason: "none", values: gone });
  assert.deepEqual(none.sent, []);
  assert.equal(a.refused.key, "screen.wizards.edit.nosteps");
});

test("R1 a copy whose base changed shows what changed and brings it across by adopt: {base}", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const upd = (await lt.mai.read("baseupdates")).entries.find((u) => u.copy_version === V.changed);
  assert.ok(upd, "the store lists the copy whose base moved on");
  // approved: a new draft of it is offered instead (wizard-scripts R3's `from`)
  const b = await open("wizards", { team: lt, as: lt.mai });
  const p = panelOf(b.tree, V.changed, "own");
  assert.ok(t(p).includes(said("screen.wizards.changes.copy")) && t(p).includes(said("screen.wizards.changes.base")));
  assert.ok(t(p).includes(upd.steps.copy[0].what.slice(0, 40)));
  assert.ok(!acts(p).some((x) => x.attrs["data-act"] === "wizardrevise"));
  const from = await b.press("wizarddraft", { data: { mode: "from", from: V.changed } });
  assert.deepEqual(from.sent[0].body, { from: V.changed, name: lt.changed.name });
  // a draft copy whose base changed brings the change across by `adopt: {base}`
  const fresh = await lt.mai.act("wizarddraft", { body: { copy: lt.bases.d.versions[0].id, project: lt.P1, name: "Fresh copy" } });
  lt.world.sql.exec("UPDATE wiz_copies SET based_on = ? WHERE script_id = ?", `${lt.bases.d.id}@${lt.bases.d.versions[0].version - 1}`, fresh.script);
  const entry = (await lt.mai.read("baseupdates")).entries.find((u) => u.copy_version === fresh.version);
  assert.ok(entry, "the store lists the draft copy whose base moved on");
  const a = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  const q = panelOf(a.tree, fresh.version, "own");
  assert.ok(t(q).includes(said("screen.wizards.changes.copy")) && t(q).includes(said("screen.wizards.changes.base")));
  const adopt = await a.press("wizardrevise", { data: { mode: "base", version: fresh.version }, reason: "the base changed" });
  assert.deepEqual(adopt.sent[0].body, { version: fresh.version, adopt: { base: entry.base_version }, reason: "the base changed" });
});

test("R1 wizardsubmit, wizardapprove (and widen), wizardretire (a script, or a version withdrawn) send their owner's arguments", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const read = async (script, version) => (await lt.mai.read("wizardread", { query: { script, version } })).version.state;
  // the author submits her draft, then withdraws it; an owner approves a submitted one, and widens an approved one
  const m = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  assert.deepEqual((await m.press("wizardsubmit", { data: { version: V.draft }, reason: "ready" })).sent[0].body, { version: V.draft, reason: "ready" });
  assert.equal(await read(lt.draft.script, V.draft), "submitted", "the store holds it submitted");
  const w = await open("wizards", { team: lt, as: lt.mai, subject: "submitted" });
  assert.deepEqual((await w.press("wizardretire", { data: { version: V.draft }, values: { ["wz-r-" + K(V.draft)]: "not needed" } })).sent[0].body,
    { script: lt.draft.script, version: V.draft, reason: "not needed" });
  assert.equal(await read(lt.draft.script, V.draft), "withdrawn", "the store holds it withdrawn");
  const a = await open("wizards", { team: lt, as: lt.rosa, subject: "submitted" });
  assert.deepEqual((await a.press("wizardapprove", { data: { version: V.sub }, reason: "good" })).sent[0].body, { version: V.sub, reason: "good" });
  assert.equal(await read(lt.submitted.script, V.sub), "approved", "the store holds it approved");
  const b = await open("wizards", { team: lt, as: lt.rosa });
  assert.deepEqual((await b.press("wizardapprove", { data: { version: V.copy, widen: "1" }, reason: "for all" })).sent[0].body, { version: V.copy, widen: true, reason: "for all" });
  const kc = K(V.copy);
  // control: a retirement with no reason sends nothing
  const none = await b.press("wizardretire", { data: { field: "wz-rr-" + kc }, values: { ["wz-rr-" + kc]: " " } });
  assert.deepEqual(none.sent, []);
  assert.deepEqual((await b.press("wizardretire", { data: { field: "wz-rr-" + kc }, values: { ["wz-rr-" + kc]: "replaced" } })).sent[0].body,
    { script: lt.copy.script, reason: "replaced" });
  const retired = (await lt.rosa.read("wizards", { query: { state: "retired" } })).scripts.find((s) => s.id === lt.copy.script);
  assert.equal(retired.retired.reason, "replaced", "the store holds it retired");
});

test("R1 R14 every refusal is drawn beside its act, a check's refusal naming its step; the form keeps what was typed", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  // a step refusal: a draft whose step names an act its screen does not list, as the store refuses its submission (seeded in the row,
  // which the store then reads: no act of the page writes one, wizard-scripts R4)
  const bad = await copyOf(lt, lt.bases.b, { name: "A draft gone wrong" });
  const before = await stepsOf(lt.mai, bad.version);
  const target = before.findIndex((st) => st.act);
  assert.ok(target >= 0);
  lt.world.sql.exec("UPDATE wiz_revisions SET steps = REPLACE(steps, ?, ?) WHERE script_id = ?", `"act":"${before[target].act}"`, '"act":"nosuchact"', bad.script);
  const stepRefusal = await refusalOf(lt, lt.mai, "wizardsubmit", { body: { version: bad.version, reason: "ready" } });
  assert.equal(stepRefusal.result.code, "WIZARD_ACT_UNKNOWN");
  assert.equal(stepRefusal.result.step, target + 1);
  const notTheGroups = await refusalOf(lt, lt.rosa, "wizardretire", { body: { script: lt.civ.id, reason: "replaced" } });
  assert.equal(notTheGroups.result.code, "WIZARD_NOT_THE_GROUPS");
  const a = await open("wizards", { team: lt, as: lt.rosa, subject: "draft", faults: { wizardsubmit: stepRefusal.result, wizardretire: notTheGroups.result } });
  await a.press("wizardsubmit", { data: { version: V.draft }, reason: "ready" });
  // R14: the words are the refusal's key, never the answer's own translation
  assert.ok(hasWord("refusal.WIZARD_ACT_UNKNOWN") && hasWord("refusal.WIZARD_NOT_THE_GROUPS"));
  assert.equal(a.refused.text, said("screen.wizards.refusal.step", { step: String(stepRefusal.result.step), words: said("refusal.WIZARD_ACT_UNKNOWN") }));
  const c = await open("wizards", { team: lt, as: lt.rosa, faults: { wizardretire: notTheGroups.result } });
  const kc = K(V.copy);
  await c.press("wizardretire", { data: { field: "wz-rr-" + kc }, values: { ["wz-rr-" + kc]: "replaced" } });
  assert.equal(c.refused.text, said("refusal.WIZARD_NOT_THE_GROUPS"));
  assert.equal(c.b.doc.getElementById("wz-rr-" + kc).value, "replaced");
});

test("R8 R14 the path Settings › Wizards, the four states of each read, and the list read again after an act", async () => {
  const lt = await libraryTeam();
  const V = idsOf(lt);
  const a = await open("wizards", { team: lt, as: lt.rosa });
  const crumbs = all(a.tree, (e) => e.tag === "nav" && /cs-crumbs/.test(e.attrs.class || ""))[0];
  assert.equal(t(crumbs), said("rail.settings.name") + " › " + said("screen.wizards.name"));
  const pending = await open("wizards", { team: lt, as: lt.rosa, faults: { wizards: "pending" } });
  has(pending, "state.loading");
  const empty = await open("wizards", { team: lt, as: lt.rosa, subject: "withdrawn" });
  has(empty, "screen.wizards.empty.withdrawn");
  const refused = await refusalOf(lt, lt.rosa, "wizards", { query: { state: "nonsense" } });
  assert.equal(refused.result.ok, false);
  const f = await open("wizards", { team: lt, as: lt.rosa, faults: { wizards: refused.result } });
  assert.ok(hasWord("refusal." + refused.result.code));
  assert.ok(f.text.includes(said("refusal." + refused.result.code)), "R14: drawn by its key");
  const s = await open("wizards", { team: lt, as: lt.rosa, faults: { wizards: "none" } });
  lacks(s, "screen.wizards.empty.offered");
  assert.ok(all(s.tree, (e) => e.attrs["data-state"] === "failed").length >= 1);
  // a failed read of baseupdates or projectlist leaves the library drawn
  const g = await open("wizards", { team: lt, as: lt.rosa, faults: { baseupdates: "none", projectlist: "none" } });
  assert.ok(rowOf(g.tree, V.civ));
  // after an act, what it changed is read again
  const m = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  const before = m.p.requests.length;
  await m.press("wizardsubmit", { data: { version: V.draft }, reason: "ready" });
  assert.ok(m.p.requests.slice(before).map((r) => r.op).includes("wizards"));
  // a row's acts sit in its panel (interface-shell R19)
  const sub = acts(a.tree).find((b) => b.attrs["data-act"] === "wizardapprove");
  assert.ok(ancestor(sub, (e) => /cs-panel/.test(e.attrs.class || "")));
});
