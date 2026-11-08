/* screens-inquiry FR-28 (B15), the `project` screen: R90 and R115 (the work rows open only what the project holds), R94 (what each
 * unreached stage needs), R109 (Close this project now), R117 and L20 (a refusal names its finding; the question's id), entry 25
 * (writing help, and R10: the screen draws exactly its registry acts). On interface-shell's served page over a scripted plane;
 * every request is compared with its owner's declaration by the harness's guard (R104), so a FieldMismatch fails the test that
 * pressed the act. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, ok, refused, refusedIn } from "../interface-shell/harness.mjs";
import { BUNDLE_ID_RE } from "../../../src/record-grammar/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { open, storeWorld, main, actsIn, button, fill, press, says, section, word, projectWith, SCREENS, P, Q } from "./fixtures.mjs";

/* every owner's declarations, registered once before the first read (test-support R17, K4245) */
/* the weights of the two owners whose acts these tests press (registering every owner's weights is refused today by `accountusesset`'s row, an owner's defect reported to BOB) */


const at = "/app/project/" + P;
const PROJECT = SCREENS.find((s) => s.id === "project");
/* the screens of other modules the work rows open: stand-ins, so the page serves them and a reference to one is a link */
const stub = (id) => ({ id, reads: () => ({}), render: () => "", acts: [], words: [] });
const SERVED = { boot: { screens: [...SCREENS, stub("matter"), stub("calculation"), stub("action")] } };
/** The world (store-assembly's store with the real door, K5054): `ann` owns the project "Pothole repairs" she started, with two questions drawn into it, and `mai` is joined to it (no owner); all by the real acts.
 *  `ai` makes the world the team's Claude account can be set up in (`recipes.assistant`). */
const OWN = { capabilities: ["contribute", "create_projects"] };
const team = async ({ ai = false } = {}) => {
  const world = await storeWorld({ ai });
  const ann = await world.signIn("ann", OWN);
  const mai = await world.signIn("mai", { capabilities: ["contribute"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const doc = (await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", project)).bundle;
  const ids = await world.recipes.questions(ann, project, 2, { legsOf: (i) => (i === 0 ? [{ target: doc, role: "supports" }] : []) });   /* one resting on the document, one not yet */
  await ann.act("projectinvite", { query: { projectId: project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: project }, body: {} });
  return { world, ann, mai, project, doc, ids, at: "/app/project/" + project };
};
/** The page at `path` as `as` reads it, over the world's door (`plane` overrides only the ops it names; `screens` the served screens). */
const pageOf = async (world, as, path, o = {}) => {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path, ...o });
  await p.settle();
  return p;
};
const hrefs = (el) => el.querySelectorAll("a").map((a) => a.getAttribute("href"));
const rowOf = (s, stage) => s.querySelector(`[data-stage="${stage}"]`);
const choose = (p, id, value) => { p.doc.getElementById(id).querySelectorAll("input").find((i) => i.getAttribute("value") === value).checked = true; };

test("R90 R115 the work rows open only what the project holds, but for Matter (B22 entry 5, K4170, K4259): with no determination Matter opens `/app/matter/<project>`, the project's door to its first; no Action or Calculation link carries the project's id; Action opens dash-action; a held determination and a held calculation open themselves", async () => {
  const p = await open(at, SERVED);
  const s = section(p, "project.work.title");
  for (const kind of ["action", "calculation"]) assert.ok(!hrefs(s).some((h) => h.startsWith(`/app/${kind}/`)), `${kind}: no link carries an id the project does not hold`);
  assert.deepEqual(hrefs(s).filter((h) => h.startsWith("/app/matter/")), ["/app/matter/" + P], "Matter is the project's door to its first determination");
  assert.deepEqual(hrefs(s).filter((h) => h.includes("action")), ["/app/dash-action"], "the Action row opens dash-action");
  assert.ok(says(s.querySelector('a[href="/app/dash-action"]'), "screen.action.name"));
  for (const kind of ["matter", "calculation"]) assert.ok(s.textContent.includes(word("screen." + kind + ".name")), `${kind} is still listed, so the first one can be made`);
  /* control: a held determination and a held calculation open themselves */
  const md = projectWith([[Q, "cites", "active"], ["CALC-2026-0002", "cites", "active"]]);
  const dets = ok({ ok: true, items: [{ id: "DET-2026-0001", project: P, act: { id: "ACT-2026-0001", event: "The repair log was closed" } }], cursor: null });
  const held = await open(at, { ...SERVED, images: { [P]: { "bundle.md": md } }, plane: { determinations: dets } });
  assert.equal(held.byOp("determinations")[0].query.project, P, "the determinations the project holds are read for it");
  const h = section(held, "project.work.title");
  assert.equal(h.querySelectorAll('a[href="/app/matter/DET-2026-0001"]').length, 1, "a held determination's row opens it");
  assert.ok(h.querySelector('a[href="/app/matter/DET-2026-0001"]').textContent.includes("The repair log was closed"));
  assert.equal(h.querySelectorAll('a[href="/app/calculation/CALC-2026-0002"]').length, 1, "a held calculation's row opens it");
  assert.ok(!hrefs(h).some((x) => x === "/app/matter/" + P || x === "/app/calculation/" + P || x === "/app/action/" + P), "with a determination held, the project's own id is no door");
});

test("R94 What each stage needs: every unreached stage draws what it needs and why; a reached stage draws neither", async () => {
  /* the real state: a project with two held questions, one resting on a document (project-stage R4's answer, read as its owner reads it) */
  const w = await team();
  const real = await w.ann.read("projectstage", { query: { project: w.project } });
  assert.equal(real.stage, "investigating");
  const p = await pageOf(w.world, w.ann, w.at);
  const s = section(p, "screen.project.what.each.stage.needs");
  assert.ok(says(s, "screen.project.the.record.decides.the.stage.by") && says(s, "screen.project.nothing.here.is.a.button.when"));
  assert.ok(s.querySelector("h2").getAttribute("data-tip").includes(word("screen.project.help.for.each.stage.what.it.took")));
  const matured = rowOf(s, "matured"), closed = rowOf(s, "closed");
  const at3 = (k) => real.stages.find((x) => x.stage === k);
  assert.ok(matured.querySelector("[data-why]").textContent.includes(at3("matured").why), "matured: why, as the record answers it");
  assert.ok(says(matured, "project-stage.project_concluded_none", { read: String(real.questions.read) }), "matured: why, by its word");
  assert.ok(says(matured, "screen.project.either.one.reaches.it.the.project", { held: String(real.questions.read) }), "matured: what it needs, either one");
  assert.equal(matured.getAttribute("data-needs"), at3("matured").needs.any_of.map((c) => c.condition).join(" "));
  assert.equal(matured.getAttribute("data-needs"), "concluded_held_question ratified_case_edition");
  assert.ok(closed.querySelector("[data-why]").textContent.includes(at3("closed").why), "closed: why (needs is null)");
  assert.ok(says(closed, "project-stage.close_owner_recorded"));
  assert.equal(closed.getAttribute("data-needs"), null);
  /* control: a reached stage draws neither its sentence nor a need */
  for (const reached of ["forming", "investigating"]) {
    assert.equal(rowOf(s, reached).getAttribute("data-reached"), "yes");
    assert.equal(rowOf(s, reached).querySelector("[data-why], [data-need]"), null, `${reached}: nothing`);
    assert.ok(!s.textContent.includes(at3(reached).why), `${reached}: its sentence is not drawn`);
  }
  /* "an answer that holds no stages draws no section (R20)" is not tested here: it is a state no read makes; project-stage always answers `stages`, even for a project it could not read
     (bio-plane/src/project-stage/index.mjs:155 and :167 give `stages: this.#stages({ unread })`, :194-200 the rest). */
});

test("R94 a closed project: every need is null and each unreached stage says why; a stage the read could not decide draws its detail, never a need", async () => {
  const w = await team();
  await w.ann.act("projectclose", { query: {}, body: { project: w.project, reason: "resolved" } });
  const real = await w.ann.read("projectstage", { query: { project: w.project } });
  assert.equal(real.stage, "closed");
  assert.equal(real.closed_reason, "resolved");
  const p = await pageOf(w.world, w.ann, w.at);
  const s = section(p, "screen.project.what.each.stage.needs");
  assert.ok(says(rowOf(s, "matured"), "project-stage.project_closed_further"));
  assert.ok(rowOf(s, "matured").querySelector("[data-why]").textContent.includes(real.stages.find((x) => x.stage === "matured").why));
  assert.equal(rowOf(s, "matured").getAttribute("data-needs"), null, "no need is listed once it is closed");
  assert.equal(rowOf(s, "closed").getAttribute("data-reached"), "yes");
  assert.equal(rowOf(s, "closed").querySelector("[data-why]"), null, "the reached close draws no sentence");
});

test("R109 Close this project now: an owner sees what is still open, three reasons with none chosen, an optional note and the act; each reason sends the declared fields; the page then reads closed with the reason", async () => {
  const w = await team();
  const p = await pageOf(w.world, w.ann, w.at);
  const s = section(p, "screen.project.closenow.head");
  assert.ok(s.querySelector("h2").getAttribute("data-tip").includes(word("screen.project.closenow.tip").split("'")[0]));
  assert.ok(says(s.querySelector('[data-closenow="open"]'), "screen.project.closenow.open", { stage: word("screen.project.stage.matured"), count: "0", total: "2" }));
  assert.ok(says(s, "screen.project.closenow.why"));
  const reasons = s.querySelectorAll('#project-close-why input').map((i) => [i.getAttribute("value"), i.parentElement.textContent.trim()]);
  assert.deepEqual(reasons, [["resolved", word("state.item.resolved.name")], ["superseded", word("screen.project.closenow.superseded")], ["abandoned", word("state.item.abandoned.name")]]);
  assert.equal(s.querySelectorAll("#project-close-why input").filter((i) => i.checked).length, 0, "no reason is chosen for her");
  assert.ok(says(button(p, "projectclose", s), "screen.project.closenow.do"));
  assert.ok(says(s, "screen.project.closenow.note1") && says(s, "screen.project.closenow.note2"));
  /* it comes after "What each stage needs" */
  const heads = main(p).querySelectorAll("h2").map((h) => h.textContent);
  assert.ok(heads.indexOf(word("screen.project.what.each.stage.needs")) < heads.indexOf(word("screen.project.closenow.head")));
  /* nothing chosen: nothing sent, the three reasons said */
  assert.ok(says(await press(p, "projectclose"), "screen.project.closenow.ref.reason"));
  assert.equal(p.byOp("projectclose").length, 0);
  /* each of the three reasons sends project, reason (and the note only when she wrote one); a close is final, so each is a project of its own */
  for (const [i, reason] of ["resolved", "superseded", "abandoned"].entries()) {
    const other = await w.world.recipes.project(w.ann, "Another " + reason);
    const q = await pageOf(w.world, w.ann, "/app/project/" + other);
    choose(q, "project-close-why", reason);
    if (i === 1) fill(q, { "project-close-note": "the council took it over" });
    await press(q, "projectclose");
    assert.deepEqual(q.byOp("projectclose").map((r) => r.body), [i === 1 ? { project: other, reason, note: "the council took it over" } : { project: other, reason }], reason);
  }
  /* after the close: stage reads closed with the reason, and the section is gone */
  choose(p, "project-close-why", "superseded");
  await press(p, "projectclose");
  assert.ok(says(main(p).querySelector('[data-ladder="stage"] [aria-current="step"]'), "screen.project.stage.closed"));
  assert.ok(says(main(p).querySelector('[data-closed-reason="superseded"]'), "screen.project.closenow.superseded"));
  assert.equal(section(p, "screen.project.closenow.head"), undefined, "a closed project offers no close");
});

test("R109 controls: a member who is not an owner sees no close; the refusals not an owner and a reason outside the three are drawn by their words", async () => {
  const w = await team();
  const m = await pageOf(w.world, w.mai, w.at);
  assert.equal(section(m, "screen.project.closenow.head"), undefined);
  assert.ok(!actsIn(main(m)).includes("projectclose"));
  /* the refusals are scripted over the owner's page: the page offers an owner no reason the owner refuses */
  for (const [code, key] of [["PROJECT_ACT_NOT_THE_OWNER", "screen.project.closenow.ref.owner"], ["CLOSE_BAD_REASON", "screen.project.closenow.ref.reason"]]) {
    const o = await pageOf(w.world, w.ann, w.at, { plane: { projectclose: refusedIn(code) } });
    choose(o, "project-close-why", "resolved");
    assert.ok(says(await press(o, "projectclose"), key), code);
  }
  assert.ok(hasWord("screen.project.closenow.ref.owner") && hasWord("screen.project.closenow.ref.reason"));
});

test("R109 every key of the close is held (K874): the heading, the open line, the reasons, the act, both notes, both refusals and the tip", () => {
  for (const k of ["head", "open", "why", "superseded", "do", "note1", "note2", "ref.owner", "ref.reason", "tip"]) {
    assert.ok(hasWord("screen.project.closenow." + k), k);
    assert.ok(PROJECT.words.includes("screen.project.closenow." + k), k + " is listed by the screen");
  }
  assert.ok(PROJECT.words.includes("state.item.resolved.name") && PROJECT.words.includes("state.item.abandoned.name"));
});

test("R94 every key of What each stage needs is held and listed (K874)", () => {
  for (const k of ["what.each.stage.needs", "the.record.decides.the.stage.by", "nothing.here.is.a.button.when", "either.one.reaches.it.the.project", "help.for.each.stage.what.it.took", "help.counts.come.from.the.record.each"]) {
    assert.ok(hasWord("screen.project." + k), k);
    assert.ok(PROJECT.words.includes("screen.project." + k), k + " is listed by the screen");
  }
});

test("R11 L20 a question opened from a title whose 40th character falls on a hyphen gets an id BUNDLE_ID_RE accepts; control: a short title is unchanged", async () => {
  const w = await team();
  const title = "a".repeat(39) + " b";
  const p = await pageOf(w.world, w.ann, w.at);
  fill(p, { "project-question": title });
  await press(p, "promote");
  const id = p.byOp("promote")[0].body.bundleId;
  assert.match(id, BUNDLE_ID_RE, "no trailing hyphen after the cut");
  assert.match(id, /^INQ-\d{4}-\d{4}-a{39}$/, "the id the record minted, then the title cut at 39");
  assert.equal(p.byOp("drawquestion")[0].query.inquiry, id, "the project draws the same id");
  assert.ok((await w.ann.read("projectquestions", { query: { project: w.project } })).items.some((x) => x.inquiry === id), "and the question is the project's");
  const short = await pageOf(w.world, w.ann, w.at);
  fill(short, { "project-question": "Did the report count working days?" });
  await press(short, "promote");
  assert.match(short.byOp("promote")[0].body.bundleId, /^INQ-\d{4}-\d{4}-did-the-report-count-working-days$/);
  assert.match(short.byOp("promote")[0].body.bundleId, BUNDLE_ID_RE);
});

test("R117 a refused act whose answer carries findings draws the first finding's words by key, then its detail, and not the code's generic sentence; control: a refusal with no findings draws the generic sentence", async () => {
  const findings = [{ check: "C-2.8", code: "IMPORTED_NOT_ACCEPTED", detail: "the leg names a finding of another team not accepted at that edition" },
    { check: "C-2.8", code: null, detail: "the target is not a canonical id" }];
  const generic = word("refusal.BASIS_REFUSED");
  const draw = async (answer) => {
    const p = await open(at, { plane: { drawquestion: answer } });
    fill(p, { "project-draw-note": "the same crews" });
    return press(p, "drawquestion");
  };
  const slot = await draw(refused("BASIS_REFUSED", "These documents cannot be used here.", 400, { findings }));
  assert.ok(says(slot, "refusal.IMPORTED_NOT_ACCEPTED"), "the first finding, by its key");
  assert.ok(slot.textContent.includes("the target is not a canonical id"), "the next finding's own detail");
  assert.ok(!slot.textContent.includes(generic) && !slot.textContent.includes("These documents cannot be used here."), "not the generic sentence");
  const detail = await draw(refused("BASIS_REFUSED", "These documents cannot be used here.", 400, { findings: [findings[1]] }));
  assert.ok(detail.textContent.includes("the target is not a canonical id") && !detail.textContent.includes(generic));
  const none = await draw(refused("BASIS_REFUSED", "These documents cannot be used here.", 400));
  assert.ok(says(none, "refusal.BASIS_REFUSED"), "no findings: the generic sentence");
  /* "Open a question" refused on an action's basis (`ACTION_BASIS_REFUSED`, with findings) is a state no act makes: the owner raises it only inside `isAction` (actions/index.mjs:1215, :1244, :1251);
     a question whose leg names an action is `BASIS_REFUSED` (inquiry-grammar/grammar.mjs:648). That case is not tested here. */
});

test("R10 entry 25 the project draws exactly its registry acts, writing help under the stake field only while the assistant is reachable", async () => {
  const REGISTRY = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
  const reg = REGISTRY.screens.find((s) => s.id === "project").acts.map((a) => a.op.replace(/^owed:(\S+)( .*)?$/, "$1")).sort();
  assert.deepEqual(PROJECT.acts.map((a) => a.op).sort(), reg, "exactly the registry's acts");
  assert.ok(reg.includes("writinghelp") && reg.includes("rerunread") && reg.includes("rerunpair") && reg.includes("projectclose"));
  /* a page that draws every one it can: an owner, the assistant reachable, a rerun */
  const w = await team({ ai: true });
  await w.ann.act("projectowneradd", { query: { projectId: w.project, handle: "mai" }, body: {} });   /* two owners, so a stand-down is offered */
  const ana = await w.world.signIn("ana", { capabilities: ["contribute"] });   /* and a member who is no owner, so one can be made */
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "ana" }, body: {} });
  await ana.act("projectjoin", { query: { projectId: w.project }, body: {} });
  const RERUN = { ok: true, project: w.project, reruns: [{ rerun: "RERUN-1", project: w.project, import: "IMP-1", group: "west-oakland", case: "port-lease", edition: 1, declared_by: "mai", declared_at: "2026-10-05T09:00:00Z",
    findings: [{ finding: "F1", ref: "imported:IMP-1/F1", role: "supports", source: { pair: null, lens_statements: [] }, paired: false, pairings: [] }], lens_difference: { only_source: [], only_own: [], shared: 0 }, pairing_history: [] }] };
  /* the assistant is not reachable until the team's Claude account is set up (control), then it is, by the administrator's real acts */
  const off = await pageOf(w.world, w.ann, w.at);
  assert.ok(!actsIn(main(off)).includes("writinghelp"));
  await w.world.recipes.assistant(await w.world.signIn("admin"), { readers: [w.ann, w.mai] });
  /* a question of another project of hers, to draw on */
  const elsewhere0 = await w.world.recipes.project(w.ann, "Bridge repairs");
  await w.world.recipes.question(w.ann, elsewhere0, { title: "Bridge", text: "Is the bridge safe?", draw: true });
  const p = await pageOf(w.world, w.ann, w.at, { plane: { rerunread: ok(RERUN) } });
  await press(p, "rerunread");
  const drawn = new Set(actsIn(main(p)));
  const elsewhere = ["projectrequest", "projectrequestwithdraw", "projectjoin", "projectownerrescue", "noticepost"];
  for (const op of reg.filter((o) => !elsewhere.includes(o))) assert.ok(drawn.has(op) || op === "projectfork", `${op} is drawn`);
  /* writing help is the assistant's, under the stake field; it is absent while the assistant is not reachable (control, above) */
  const stake = section(p, "stake.project.title");
  assert.ok(stake.querySelector('button[data-act="writinghelp"]'), "under the field");
  /* it sends the field and what she told it, over the world's own door (no draft is scripted, K5212); her words stay and nothing is saved */
  const h = await pageOf(w.world, w.ann, w.at);
  fill(h, { "project-stake": "we rent" });
  await press(h, "writinghelp");
  assert.deepEqual(h.byOp("writinghelp").map((r) => r.body), [{ op: "projectstakeset", field: "stake", told: "we rent" }]);
  assert.equal(h.doc.getElementById("project-stake").value, "we rent", "her own words stay in the field");
  assert.equal(h.byOp("projectstakeset").length, 0, "nothing is saved");
});

test("R106 the project page opens the objective screen with the project's id; control: a member who has not joined is drawn none", async () => {
  /* the objective screen is another job's file: served here by a stand-in only while SCREENS does not hold it */
  const screens = SCREENS.some((s) => s.id === "objective") ? SCREENS : [...SCREENS, stub("objective")];
  const w = await team();
  const p = await pageOf(w.world, w.ann, w.at, { screens });
  const s = section(p, "screen.objective.name");
  assert.ok(says(s, "screen.project.how-far-the-project-has-come-toward-its-objectiv"));
  const a = s.querySelector("a[data-work='objective']");
  assert.equal(a.getAttribute("href"), "/app/objective/" + w.project);
  assert.ok(says(a, "screen.objective.name"));
  /* the real state: dev is invited to the project and has not joined */
  const dev = await w.world.signIn("dev", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "dev" }, body: {} });
  const invited = await pageOf(w.world, dev, w.at, { screens });
  assert.equal(section(invited, "screen.objective.name"), undefined);
});
