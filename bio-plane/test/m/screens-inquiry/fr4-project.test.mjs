/* screens-inquiry fix round 3 (T51), the `project` screen, the fourth wave: C35 (R16, R1: "Draw on a question from elsewhere" names each question's
 * project), C63 (R1, R36: "Plan what to do" opens the plan it made, over the op's real answer), C81 (R5: the page at 390 px, measured in Chromium)
 * and K4370 (R1; interface-shell R113: every act declares the reads it changes). On interface-shell's served page over a scripted plane; every
 * expectation is a word read by key (R44), never copied. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ok, refusedIn } from "../interface-shell/harness.mjs";
import { open, storeWorld, WORLD_FOUNDER_HANDLE, main, press, fill, says, word, section, projectWith, SCREENS, P, Q, Q2 } from "./fixtures.mjs";
import { onPhone } from "./phone.mjs";
import { rerunReadAnswer } from "../case-import/fixtures.mjs";

const at = "/app/project/" + P;
const PROJECT = SCREENS.find((s) => s.id === "project");
const options = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => [o.getAttribute("value"), o.textContent]);

/* ------------------------------------------------------------------------------------------------------------------ C35 */

const SAME = "How many days passed between the report and the repair?";
const SEVEN = "Is the city repairing reported potholes within seven days?";
const OWN = { capabilities: ["contribute", "create_projects"] };
/** The world (store-assembly's store with the real door, K5054): `ann` owns the project "Pothole repairs" she started, with a document held in it and two questions drawn into it (`q`, `q2`), by the real acts. */
const worldOf = async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const doc = (await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", project)).bundle;
  const q = (await world.recipes.question(ann, project, { title: SEVEN, text: SEVEN, legs: [{ target: doc, role: "supports" }], draw: true })).id;
  const q2 = (await world.recipes.question(ann, project, { title: "Does closed mean repaired?", text: "Does closed mean repaired?", legs: [{ target: doc, role: "supports" }], draw: true })).id;
  return { world, ann, project, doc, q, q2, at: "/app/project/" + project };
};
/** The page at `path` as `as` reads it, over the world's door (`plane` overrides only the ops it names). */
const pageOf = async (world, as, path, o = {}) => {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path, ...o });
  await p.settle();
  return p;
};
/* `list`'s rows as retrieval R63 answers them: no project on a row */
const row = (id, title) => ({ bundle_id: id, object_type: "inquiry", current_state: "open", title, last_updated: "2026-10-05T09:00:00Z" });

test("R16 R1 C35 'Draw on a question from elsewhere': two questions of two projects with the same title are told apart, each option naming its project (`screen.document.cite.option`); one option per question id; control: a question whose title is its own, and one no project draws on, are the title alone", async () => {
  /* fix round 4 (C14; R16, R1): a project is named where the project is known: a list row's `project`, else, for the questions that share a title, their own `image`'s;
     no `projectquestions` is read for any project but this one's. The two same-titled questions' own documents state their projects. */
  const w = await worldOf();
  const made = (title, project) => w.world.recipes.question(w.ann, project, { title, text: title, draw: Boolean(project) }).then((r) => r.id);
  const bridge = await w.world.recipes.project(w.ann, "Bridge repairs"), culvert = await w.world.recipes.project(w.ann, "Culvert repairs");
  await w.world.recipes.project(w.ann, "Empty one");
  const QA = await made(SAME, bridge), QB = await made(SAME, culvert), QC = await made("A title only one has", culvert), QO = await made("Nobody draws on this", null);
  /* the list is scripted over the real ids: the same question listed twice (a row the world's own `list` never repeats) is the case the option is drawn once for */
  const list = ok({ bundles: [row(w.q, SEVEN), row(w.q2, "Does closed mean repaired?"), row(QA, SAME), row(QB, SAME), row(QA, SAME), row(QC, "A title only one has"), row(QO, "Nobody draws on this")] });
  const p = await pageOf(w.world, w.ann, w.at, { plane: { list } });
  const opts = options(p, "project-draw-question");
  const text = (id) => (opts.find(([v]) => v === id) || [])[1];
  assert.deepEqual(opts.map(([v]) => v), [QA, QB, QC, QO], "one option per question id (QA is listed twice and drawn once), the project's own two left out");
  assert.equal(text(QA), word("screen.document.cite.option", { question: SAME, project: "Bridge repairs" }), "the first, in its project");
  assert.equal(text(QB), word("screen.document.cite.option", { question: SAME, project: "Culvert repairs" }), "the second of the same title, in its own");
  assert.notEqual(text(QA), text(QB), "told apart");
  assert.equal(text(QC), "A title only one has", "control: a title that is its own needs no project to tell it apart");
  assert.equal(text(QO), "Nobody draws on this", "control: no project of hers draws on it, its title alone");
  /* the reads: this project's questions once; no other project's; the image of each question that shares a title and no other */
  assert.deepEqual(p.byOp("projectquestions").map((r) => r.query.project), [w.project], "no other project's questions are read");
  assert.deepEqual(p.byOp("image").map((r) => r.query.id).filter((x) => x === QA || x === QB || x === QC || x === QO).sort(), [QA, QB].sort(), "an image only for the two that share a title");
  /* sending the choice of the second still sends its id and her note, and the real act draws it */
  const d = await pageOf(w.world, w.ann, w.at, { plane: { list } });
  fill(d, { "project-draw-question": QB, "project-draw-note": "the same crews" });
  await press(d, "drawquestion");
  assert.deepEqual([d.byOp("drawquestion")[0].query.project, d.byOp("drawquestion")[0].query.inquiry], [w.project, QB]);
  assert.ok((await w.ann.read("projectquestions", { query: { project: w.project } })).items.some((x) => x.inquiry === QB), "the question is drawn into the project");
});

/* ------------------------------------------------------------------------------------------------------------------ C63 */

/* A stand-in for screens-action's `plan` screen (a later module this one may not import, P4): it only reads the plan
   its address names, which is all these tests ask of it (the plan page opened, and that plan read). */
const PLAN_SCREEN = Object.freeze({ id: "plan", reads: (view) => ({ plan: { op: "plan", query: { id: String(view.subject || "") }, subject: true } }),
  render: () => "", acts: [], words: [] });
const WITH_PLAN_SCREEN = { screens: [...SCREENS, PLAN_SCREEN] };
const plansOf = async (w) => (await w.ann.read("plans", { query: { project: w.project } })).items;

test("R1 R36 C63 'Plan what to do' on the project page opens the plan page it made, over the op's real answer and the real `plan` screen; control: a project that has a plan opens another with the same press, and links its plan by name; a refusal opens none", async () => {
  const w = await worldOf();
  const p = await pageOf(w.world, w.ann, w.at, WITH_PLAN_SCREEN);
  fill(p, { "project-plan": "Ask the committee", "project-plan-about": w.q });
  await press(p, "planopen");
  assert.deepEqual(p.byOp("planopen")[0].body, { project: w.project, title: "Ask the committee", subjects: [{ kind: "inquiry", inquiry: w.q }] });
  const made = await plansOf(w);
  assert.equal(made.length, 1, "the plan was made");
  assert.equal(p.location.pathname, "/app/plan/" + made[0].id, "the plan page opens with the plan as subject");
  assert.equal(p.byOp("plan")[0].query.id, made[0].id, "and it reads that plan");
  /* control: the project has one plan already (`plansFor`'s items): it is linked by name, and the press opens the new one */
  const earlier = (await w.ann.act("planopen", { body: { project: w.project, title: "Earlier plan", subjects: [{ kind: "inquiry", inquiry: w.q2 }] } })).id;
  const third = (await w.world.recipes.question(w.ann, w.project, { title: "Third", text: "Is it so?", draw: true })).id;   /* a matter is in one open plan at a time */
  const held = new Set((await plansOf(w)).map((x) => x.id));
  const had = await pageOf(w.world, w.ann, w.at, WITH_PLAN_SCREEN);
  assert.equal(section(had, "project.work.title").querySelector(`a.cs-ref[href="/app/plan/${earlier}"]`).textContent, "Earlier plan", "the plan she has is a link to it");
  fill(had, { "project-plan": "Ask the committee again", "project-plan-about": third });
  await press(had, "planopen");
  const fresh = (await plansOf(w)).filter((x) => !held.has(x.id));
  assert.equal(fresh.length, 1, "the press made another plan");
  assert.equal(had.location.pathname, "/app/plan/" + fresh[0].id);
  /* control: a refused press stays (the refusal is scripted: no title the page sends is one the owner refuses) */
  const r = await pageOf(w.world, w.ann, w.at, { ...WITH_PLAN_SCREEN, plane: { planopen: refusedIn("PLAN_NO_TITLE", "no") } });
  fill(r, { "project-plan": "x", "project-plan-about": w.q });
  await press(r, "planopen");
  assert.equal(r.location.pathname, w.at);
});

/* ------------------------------------------------------------------------------------------------------------------ C81 */

/* the phone measurement below is drawn over the real world's answers, read once and played back: `onPhone` (phone.mjs) answers the page from a plane table only and takes no world door (it would need `world.route(as)`) */
const LONG = "a-very-long-member-handle-without-any-breaks-at-all";
const TITLE = "A project with a very long title that goes on and on about potholes, repairs and the city of Oakland";
const NOTICE = { notice: "N1", status: "open", revisions: [{ published_at: "2026-10-01T09:00:00Z", json: { wording: "We are looking at pothole repairs " + LONG, since: "2026-09-01", collaborate: true } }],
  level: { level: "Active", as_of: "2026-10-10T00:00:00Z" }, next_monthly: "2026-11-01T00:00:00Z", attestations: [{ json: { cases: [1, 2] } }] };
/** The busy project by real acts: the founder's project with a very long title, four owners (`mai`, `dev` and two with very long handles, each made by every owner's agreement), members (one with a very long handle) and an
 *  invited one, two questions with long titles drawn into it, a vote waiting on the other owners, and two other projects whose questions share a title. Answers `{ path, o }` for `onPhone`:
 *  its plane is the world's own answers to the reads the page makes, as `mai` reads them. */
const busy = async () => {
  const world = await storeWorld();
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  /* a member id is at most 41 characters (C-96.2): the longest the record allows */
  const HANDLE = (n) => LONG.slice(0, 40) + n;
  const handles = ["mai", "dev", HANDLE(1), HANDLE(2), "rosa", "ben", HANDLE(3), "ana"];
  const who = {};
  for (const h of handles) who[h] = await world.signIn(h, OWN);
  const project = await world.recipes.project(founder, TITLE);
  for (const h of handles) await founder.act("projectinvite", { query: { projectId: project, handle: h }, body: {} });
  for (const h of handles.slice(0, 7)) await who[h].act("projectjoin", { query: { projectId: project }, body: {} });
  const owners = [founder];
  for (const h of handles.slice(0, 4)) {
    for (const o of owners) await o.act("projectowneradd", { query: { projectId: project, handle: h }, body: {} }).catch((e) => { if (!/CONSENSUS_REQUIRED/.test(String(e.message))) throw e; });
    owners.push(who[h]);
  }
  await founder.act("projectowneradd", { query: { projectId: project, handle: "ben" }, body: {} }).catch((e) => { if (!/CONSENSUS_REQUIRED/.test(String(e.message))) throw e; });
  const draw = (title, projectId) => world.recipes.question(founder, projectId, { title, text: title, draw: Boolean(projectId) }).then((r) => r.id);
  await draw("Is the city repairing reported potholes within seven days of the report, and recording it?", project);
  await draw("Does closed mean repaired " + LONG, project);
  const bridge = await world.recipes.project(founder, "Bridge repairs"), culvert = await world.recipes.project(founder, "Culvert repairs");
  await world.recipes.project(founder, "Empty one");
  await draw(SAME, bridge); await draw(SAME, culvert); await draw("A title only one has", culvert); await draw("Nobody draws on this", null);
  const mai = who.mai;
  const read = (op, query = {}) => mai.read(op, { query });
  const at = "/app/project/" + project;
  /* every read the project screen makes is the world's own answer (the rerun comparison is case-import's, below) */
  const real = Object.fromEntries(await Promise.all(Object.values(PROJECT.reads({ subject: project, me: { member: "mai", handle: "mai" } })).filter((x) => x.op !== "rerunread" && x.op !== "image")
    .map(async (x) => [x.op, ok(await read(x.op, x.query))])));
  return { path: at, o: { images: { [project]: await read("image", { id: project }) }, plane: {
    ...real,
    projectquestions: async (r) => ok(await read("projectquestions", r.query)),
    inquirystrength: async (r) => ok(await read("inquirystrength", r.query)),
    memberlist: ok(await read("memberlist")),
    projectlist: ok(await read("projectlist", { limit: "200" })),
    notices: ok({ ok: true, notices: [NOTICE] }),
    rerunread: ok(RERUN),
    projectownerarith: ok({ ok: true, table: [1, 2, 3, 4, 5].map((n) => ({ owners: n, votesNeeded: Math.floor(n / 2) + 1, eligibleVoters: n - 1 })),
      live: { owners: 4, votesNeeded: 3, eligibleVoters: 3, possible: true, targetMayVote: false }, projectId: project }) } } };
};
/* case-import's real `rerunread` answer (R31), the strings the comparison draws made long (an input that stretches the layout; fixtures-own: synthetic the lengthened text) */
const REAL_RERUN = (await rerunReadAnswer()).answer;
const [REAL_RUN] = REAL_RERUN.reruns;
const RERUN = { ...REAL_RERUN, reruns: [{ ...REAL_RUN,
  lens_difference: { ...REAL_RUN.lens_difference, only_source: REAL_RUN.lens_difference.only_source.map((x) => ({ ...x, text: x.text + " " + LONG })) },
  findings: REAL_RUN.findings.map((f) => ({ ...f, finding: f.finding + " " + LONG })) }] };
const ACTS = ["act.planopen.label.project", "act.projectowneradd.label.project", "act.projectownerremove.label.project", "act.projectremove.label.project", "act.projectinvite.label.project",
  "act.projectbarset.label.project", "act.promote.label.project", "act.findin.label.project", "act.drawquestion.label.project", "act.heldcaptures.label.project", "act.projectvisibilityset.label.project",
  "screen.project.notice.change", "act.projectleave.label.project"].map((k) => word(k));
/* the shared stylesheet's inline references (`a.cs-ref` in a row's text span) are measured by interface-shell, not here */
const notRef = (s) => !s.startsWith("a.cs-ref");

test("R5 C81 the project page at 390 px: nothing past the screen and every button and summary at least 44 px, with a long title, long member names, many owners, a pending vote, the published notice, the vote to stand down and the rerun's comparison; control: at 1280 px nothing is past the viewport and the controls of the rows not touched keep their place", async () => {
  const { path, o: BUSY } = await busy();
  const phone = async (before) => onPhone({ path, o: BUSY, width: 390, controls: ACTS, before });
  const base = await phone();
  assert.ok(base.mainScroll <= 390, "the main area does not scroll sideways: " + base.mainScroll);
  assert.deepEqual(base.over, [], "nothing runs past the screen");
  assert.deepEqual(base.small.filter(notRef), [], "every button and summary is at least 44 px");
  for (let k = 0; k < ACTS.length; k++) assert.ok(base.boxes[ACTS[k]].length > 0, ACTS[k] + " is drawn and measured");
  for (const k of [1, 2, 3, 5]) for (const b of base.boxes[ACTS[k]]) assert.ok(b.right <= 390 && b.left >= 0 && b.width >= 44 && b.height >= 44, ACTS[k] + " " + JSON.stringify(b));
  /* the vote to stand down, opened in place; the comparison with the original */
  const stand = await phone(async (page) => { await page.click('button[data-handle="mai"][data-act="projectownerremove"]'); });
  assert.ok(stand.mainScroll <= 390 && stand.over.length === 0 && stand.small.filter(notRef).length === 0, "the vote: " + JSON.stringify(stand));
  const cmp = await phone(async (page) => { await page.click('button[data-act="rerunread"]'); });
  assert.ok(cmp.mainScroll <= 390 && cmp.over.length === 0 && cmp.small.filter(notRef).length === 0, "the comparison: " + JSON.stringify(cmp));
  /* control: the desktop page keeps everything inside the viewport, and the controls whose rows were not touched are where they were (their left edge and height) */
  const wide = await onPhone({ path, o: BUSY, width: 1280, controls: [word("act.planopen.label.project"), word("act.projectinvite.label.project"), word("act.projectbarset.label.project")] });
  assert.deepEqual(wide.over, [], "at 1280 nothing is past the viewport");
  assert.deepEqual([wide.boxes[word("act.planopen.label.project")], wide.boxes[word("act.projectinvite.label.project")], wide.boxes[word("act.projectbarset.label.project")]].map((b) => [b[0].left, b[0].height]),
    [[208, 40], [208, 40], [208, 40]], "plan, invite and bar keep their left edge and height");
});

/* ------------------------------------------------------------------------------------------------------------------ K4370 */

test("R1 R113 every act of the project declares the reads it changes (names in the screen's reads, or 'all'); a sample act re-reads exactly those; control: a refused act re-reads nothing", async () => {
  const names = Object.keys(PROJECT.reads({ subject: P, me: { member: "mai", handle: "mai" } }));
  assert.ok(names.includes("bar") && names.includes("participants") && names.includes("directory"));
  for (const a of PROJECT.acts) {
    assert.ok(a.rereads === "all" || (Array.isArray(a.rereads) && a.rereads.every((n) => names.includes(n))), a.op + " declares rereads: " + JSON.stringify(a.rereads));
  }
  const ops = [...new Set(Object.values(PROJECT.reads({ subject: P, me: { member: "mai", handle: "mai" } })).map((s) => s.op))];
  const counts = (p) => Object.fromEntries(ops.map((o) => [o, p.byOp(o).length]));
  /* the real state: ann owns the project; mai joined it, invited by her */
  const w = await worldOf();
  const mai = await w.world.signIn("mai", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: w.project }, body: {} });
  const specs = PROJECT.reads({ subject: w.project, me: { member: "ann", handle: "ann" } });
  const p = await pageOf(w.world, w.ann, w.at);
  const before = counts(p);
  await press(p, "projectbarset", { reason: "the bar" });
  const after = counts(p);
  const grew = ops.filter((o) => after[o] > before[o]);
  assert.deepEqual(grew, [specs.bar.op], "exactly the declared read is repeated");
  assert.equal(p.byOp("projectbarset").length, 1);
  /* control: a refused act re-reads nothing (the bar she saw is stale: mai set one after the page was drawn, so the owner refuses with `BAR_STALE`) */
  const r = await pageOf(w.world, w.ann, w.at);
  await mai.act("projectbarset", { body: { project: w.project, capture: "B", expected: { capture: null, connection: null }, reason: "a bar" } });
  const b0 = counts(r);
  await press(r, "projectbarset", { reason: "the bar" });
  assert.equal(r.byOp("projectbarset").length, 1, "it was sent");
  assert.deepEqual(counts(r), b0, "and nothing was read again");
});

/* ---- C63 on the question page (re-walk B E42, E46 pressed it there) ---- */
test("R2 R36 C63 'Plan what to do' on the question page opens the plan page it made; control: a refused press stays on the question", async () => {
  const w = await worldOf();
  const qat = "/app/question/" + w.q;
  const p = await pageOf(w.world, w.ann, qat, WITH_PLAN_SCREEN);
  fill(p, { "question-plan": "Ask the committee" });
  await press(p, "planopen");
  const made = await plansOf(w);
  assert.equal(made.length, 1, "the plan was made");
  assert.equal(p.location.pathname, "/app/plan/" + made[0].id, "the plan page opens");
  const r = await pageOf(w.world, w.ann, qat, { ...WITH_PLAN_SCREEN, plane: { planopen: refusedIn("PLAN_NO_TITLE", "no") } });
  fill(r, { "question-plan": "x" });
  await press(r, "planopen");
  assert.equal(r.location.pathname, qat, "control: a refused press stays");
});
