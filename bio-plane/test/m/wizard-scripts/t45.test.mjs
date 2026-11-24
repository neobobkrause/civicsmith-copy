/* wizard-scripts at T45 (N858, N887; Actions D8, D25, D26; v0.2 rules 11, 19; K2781 (6)): R22's `@records-request`,
   resolved by handle and withheld while no template of that handle is offered; R13's labelled machine drafts, placeable
   once declared. Every test drives the module at its interface, over the carried library and registry where R22 names
   them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, profiles, step, V, SCREENS, OPS, MACHINE_REFUSED, MACHINE_DRAFTS, seeded, draft, RECORDS_REQUEST_NAME } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const F = V("frank"), E = V("erin");
const GET = wz.CIVICSMITH_LIBRARY.find((e) => e.name === word("wizard.WIZ-cb0ad18a17a04233.name"));
/* every op the carried registry names, owed ones included, so R12 judges "Get a record" by its template alone */
const ALL_OPS = [...new Set(wz.SCREEN_REGISTRY.flatMap((s) => [...s.acts, ...s.owed.map((o) => o.op)]))];
const codes = (r) => r.refusals.map((x) => [x.code, x.step]);

/* A world over the carried library and registry; `profiles` the jurisdictions reader filing-templates reads. */
function real(opts) {
  const w = world({ register: false, ...opts });
  w.member("frank");
  w.member("erin", { role: "admin" });
  const r = w.wz.wizardRegister({ ops: ALL_OPS });
  assert.equal(r.ok, true, JSON.stringify(r));
  return w;
}
/* Where "Get a record" is offered to `viewer`: each read R11 answers through, and the op table's wizardcheck of its steps. */
function seen(w, viewer = F) {
  const at = w.wz.wizardsAt({ screen: "finder", viewer }).scripts.some((s) => s.id === GET.id);
  const reg = w.wz.wizardRegistry({ viewer }).screens.find((s) => s.id === "finder").scripts.some((s) => s.id === GET.id);
  const start = w.wz.startFrom({ viewer }).scripts.some((s) => s.id === GET.id);
  const listed = w.wz.wizards({ viewer: E }).scripts.some((s) => s.id === GET.id);
  const read = w.wz.wizardRead({ script: GET.id, viewer });
  return { at, reg, start, listed, offered: read.ok && read.offered, check: codes(w.wz.wizardCheck({ steps: GET.steps, viewer })) };
}
const ON = { at: true, reg: true, start: true, listed: true, offered: true, check: [] };

test("R22 (T45; N858, D8, v0.2 rule 11) with a test profile offering \"Records request\", \"Get a record\" is in wizardsAt(\"finder\"), the registry form, startFrom and the offered reads, its @records-request resolved by handle (filing-templates R26); control: without it, withheld from each, R12 refusing its template step WIZARD_DRAFT_REFUSED, and R14 still passes since the script is not required", () => {
  const step6 = GET.steps.findIndex((s) => s.draft && s.draft.template !== undefined) + 1;
  assert.deepEqual(GET.steps[step6 - 1].draft, { template: "@records-request" }, "the library data: the step names the template by handle");
  /* offered: the profile's records request attributed and named "Records request" (handle records-request) */
  const w = real();
  assert.deepEqual(w.filingTemplates.offeredVersion({ name: "@records-request", viewer: F }).ok, true, "the fixture's premise");
  assert.deepEqual(seen(w), ON);
  /* withheld: the template with no sources and no professional review (filing-templates R15 offers none) */
  const x = real({ templates: "unreviewed" });
  assert.equal(x.filingTemplates.offeredVersion({ name: "@records-request", viewer: F }).ok, false, "the control's premise");
  assert.deepEqual(seen(x), { at: false, reg: false, start: false, listed: false, offered: false, check: [["WIZARD_DRAFT_REFUSED", step6]] });
  /* withheld also where the profile's template is offered but named otherwise: the handle is the template's own name's */
  const y = real({ recordsRequest: null });
  assert.equal(y.filingTemplates.offeredVersion({ template: "TPL-test-records-request", viewer: F }).ok, true);
  assert.deepEqual(seen(y).at, false, "offered under another handle only");
  /* R14: the script is not required, so its withheld template blocks no release */
  assert.equal(GET.required, false);
  assert.ok(!wz.requiredFailures({ ops: ALL_OPS, screens: wz.SCREEN_REGISTRY, library: wz.CIVICSMITH_LIBRARY }).some((f) => f.id === GET.id));
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, library: [GET] }), []);
  /* the script is still readable, never broken, and the library data unchanged */
  const r = x.wz.wizardRead({ script: GET.id, viewer: F });
  assert.deepEqual([r.ok, r.version.state, r.offered], [true, "approved", false]);
  assert.deepEqual(r.version.steps, GET.steps.map((s) => ({ ...s })));
});

test("R22 (T45; K1883, K2781 (6)) \"Get a record\" is offered once a template of the handle records-request is, with no new registration and the library data unchanged, and withheld again when it is no longer offered", () => {
  const state = { reviewed: false };
  const on = profiles(), off = profiles({ reviewed: false });
  const w = real({ jurisdictions: { get: (id) => (state.reviewed ? on : off).get(id) } });
  const sha = wz.stepsSha(GET.steps);
  assert.equal(seen(w).at, false, "none offered: withheld");
  state.reviewed = true;
  assert.deepEqual(seen(w), ON, "a named writer and a professional review exist: offered");
  state.reviewed = false;
  assert.equal(seen(w).at, false, "withheld again");
  assert.equal(wz.stepsSha(wz.CIVICSMITH_LIBRARY.find((e) => e.id === GET.id).steps), sha);
  assert.equal(RECORDS_REQUEST_NAME, "Records request");
});

test("R22 (T45; v0.2 rule 11) \"Get a record\" places its template only at communicationprepare, after the step that creates the action (actioncreate), so the template is offered only after the act is chosen", () => {
  const acts = GET.steps.map((s) => s.act);
  const placed = GET.steps.flatMap((s, i) => (s.draft && s.draft.template !== undefined ? [i] : []));
  assert.deepEqual(placed.map((i) => acts[i]), ["communicationprepare"]);
  assert.ok(acts.indexOf("actioncreate") >= 0 && acts.indexOf("actioncreate") < placed[0], "the act is chosen first");
  assert.equal(acts.indexOf("actioncreate") + 1, 4, "step 4, as R22 names it");
});

test("R13 (T45; Actions D25, D26; v0.2 rule 19) a labelled machine draft registered in machineDrafts is placeable by a step ({machine: <op>}) once op-declarations declares its op, with no change here; while the op table does not hold it, the step is refused WIZARD_DRAFT_REFUSED and a library script carrying it is withheld; an op declared but not registered as a draft is refused", () => {
  const DRAFT = "infractiondraft";   /* the documentation of an infraction (agent-worker R76's task), as T45's owners name it */
  const SC = [...SCREENS, { id: "communicate", acts: ["communicationprepare"] }];
  const lib = [{ id: "WIZ-2026-9101", name: "Document it", required: false, version: 1, approved: { by: "BOB", at: "2026-10-12" },
                 steps: [step("communicate", "communicationprepare", { draft: { machine: DRAFT } }), step("case-home", "casenote")] }];
  const reg = (ops, drafts = [...MACHINE_DRAFTS, DRAFT]) => ({ screens: SC, ops, machineRefused: MACHINE_REFUSED, machineDrafts: drafts, library: lib });
  const steps = lib[0].steps;
  const undeclared = [...OPS, "communicationprepare"], declared = [...undeclared, DRAFT];
  /* the pure check */
  assert.deepEqual(codes(wz.checkScript(steps, reg(undeclared))), [["WIZARD_DRAFT_REFUSED", 1]], "registered, not declared");
  assert.deepEqual(codes(wz.checkScript(steps, reg(declared))), [], "declared: placeable");
  assert.deepEqual(codes(wz.checkScript(steps, reg(declared, MACHINE_DRAFTS))), [["WIZARD_DRAFT_REFUSED", 1]], "declared, not a registered draft");
  assert.deepEqual(codes(wz.checkScript(steps, { ...reg(declared), ops: null })), [], "no op table: the registered list alone");
  /* the earlier drafts, each declared, are unchanged */
  for (const d of MACHINE_DRAFTS)
    assert.deepEqual(codes(wz.checkScript([step("communicate", "communicationprepare", { draft: { machine: d } }), steps[1]], reg(declared))), [], d);
  /* at registration: a library script carrying it is withheld until declared (K1883), and a group's script submits once it is */
  for (const [ops, offered] of [[undeclared, false], [declared, true]]) {
    const w = seeded({ register: false });
    assert.equal(w.wz.wizardRegister(reg(ops)).ok, true);
    assert.equal(w.wz.wizardsAt({ screen: "communicate", viewer: F }).scripts.some((s) => s.id === lib[0].id), offered, `library, declared ${offered}`);
    const d = draft(w, { name: "Ours", steps });
    const s = w.wz.wizardSubmit({ version: d.version, author: F, viewer: F });
    assert.deepEqual([s.ok, s.code ?? null, s.step ?? null], offered ? [true, null, null] : [false, "WIZARD_DRAFT_REFUSED", 1], `group, declared ${offered}`);
  }
  /* op=wizardcheck answers the same against the registration */
  const w = seeded({ register: false });
  w.wz.wizardRegister(reg(declared));
  assert.deepEqual(codes(w.wz.wizardCheck({ steps, viewer: "class:ai" })), []);
});
