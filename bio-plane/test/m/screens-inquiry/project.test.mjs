/* screens-inquiry R1, R8–R11, R14, R16, R27–R30, R36, R38–R40, R43: the project screen, on interface-shell's served page
 * over a scripted plane. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, MEMBER, ADMIN, boot } from "../interface-shell/harness.mjs";
import { NEEDS } from "../../../src/op-declarations/index.mjs";
import { unnamedFounderWorld } from "../store-request/fixtures.mjs";
import { open, main, actsIn, button, fill, press, rawKeys, plane, says, section, lead, word, projectWith, storeWorld, WORLD_FOUNDER_HANDLE, SCREENS, P, Q, Q2 } from "./fixtures.mjs";

/* every owner's declarations, registered once before the first read (test-support R17, K4245): the project's acts name ops its owners declare */


const PROJECT = SCREENS.find((s) => s.id === "project");
/* a day as `cs.date` draws it (`date.daymonthyear`, `date.month.*`, DEC-333), read through the same words, never copied */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const day = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return word("date.daymonthyear", { day: String(d), month: word("date.month." + MONTHS[m - 1]), year: String(y) }); };
const at = () => "/app/project/" + P;
const options = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => [o.getAttribute("value"), o.textContent]);

/* the world (store-request's `storeWorld`): a member `ann` who makes projects, a page booted over its real door (op-tables, K5054) */
const MAKER = { capabilities: ["contribute", "create_projects"] };
const pageOf = async (world, as, path, plane = {}, screens = SCREENS) => { const { door, session } = world.boot(as); const b = await boot({ screens, door, session, path, plane }); await b.settle(); return b; };
const worldWith = async (title = "Pothole repairs") => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", MAKER);
  const project = await world.recipes.project(ann, title);
  return { world, ann, project, at: "/app/project/" + project };
};

test("R1 R9 R28 R29 reads: its stage (the subject), the project, participants, bar, questions, the questions she may see, account, directory, visibility, votes and plans", async () => {
  const p = await open(at());
  const q = (op) => p.byOp(op)[0] && p.byOp(op)[0].query;
  assert.equal(q("image").id, P);
  assert.equal(q("projectstage").project, P);
  assert.equal(q("projectparticipants").projectId, P);
  assert.equal(q("strengthbarof").project, P);
  assert.deepEqual([q("projectquestions").project, q("projectquestions").limit, q("projectquestions").after], [P, "100", undefined]);
  assert.deepEqual([q("list").type, q("list").limit], ["inquiry", "500"]);
  assert.equal(p.byOp("projectaccountstate").length, 0, "R1 (T53): nothing of what pays for the assistant is read");
  assert.equal(q("projectvisibility").projectId, P);
  assert.equal(q("projectownervotes").projectId, P);
  assert.equal(q("plans").project, P);
  assert.ok(p.root().querySelector(".cs-crumbs").textContent.includes("Pothole repairs"));
});

test("R1 the project drawn: title, objective, stage, its questions with their strength, account, members, and the acts a joined member is offered", async () => {
  /* the real state: `ann` started "Pothole repairs"; `mai` joined; a question resting on a staff directory (its connection graded by resolution) and on a held page (graded on the capture axis), and one
     resting on a held page with no grade, are drawn into it; the page is mai's */
  const world = await storeWorld();
  const ann = await world.signIn("ann", MAKER);
  const mai = await world.signIn("mai", { capabilities: ["contribute"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  await ann.act("projectinvite", { query: { projectId: project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: project }, body: {} });
  const names = ["Jane Smith", "Raj Patel", "Maria Lopez", "Tom Chen", "Ana Diaz", "Lee Park"];
  const dir = await world.recipes.hold(ann, "Staff directory", `<html><head><title>Staff Directory</title></head><body><h1>Staff Directory</h1><table>${names.map((n, i) => `<tr><td>${n}</td><td>${n.toLowerCase().replace(" ", ".")}@oaklandca.gov</td><td>510-238-${3000 + i}</td></tr>`).join("")}</table></body></html>`, project, { type: "text/html", read: true });
  const subject = (await ann.act("entitycreate", { body: { kind: "person", label: "Jane Smith", note: "A person the directory lists.", aliases: ["jane.smith@oaklandca.gov"] } })).entity_id;
  await ann.act("resolve", { body: { captureSha: dir.sha } });
  const memo = (await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", project)).bundle;
  const graded = (await world.recipes.question(ann, project, { title: "Is the city repairing reported potholes within seven days?", subject, draw: true, legs: [
    { target: dir.bundle, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" },
    { target: memo, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" }] })).id;
  const bare = (await world.recipes.question(ann, project, { title: "Does closed mean repaired?", draw: true, legs: [{ target: memo, role: "supports" }] })).id;
  /* a question of the project not yet drawn into it: the member may draw it */
  await world.recipes.question(ann, project, { title: "Who signed the order?", legs: [{ target: memo, role: "supports" }] });
  const real = await mai.read("inquirystrength", { query: { id: graded } });
  const p = await pageOf(world, mai, "/app/project/" + project);
  const m = main(p);
  assert.equal(m.querySelector("h1").textContent, "Pothole repairs");
  const objective = /^objective: "(.*)"$/m.exec((await mai.read("image", { query: { id: project } }))["bundle.md"])[1];
  assert.ok(m.textContent.includes(objective), "the objective, read from the record");
  assert.ok(says(m.querySelector('[data-ladder="stage"] [aria-current="step"]'), "screen.project.stage.investigating"));
  const rows = section(p, "screen.project.questions.head").querySelectorAll(".cs-row");
  const rowOf = (q) => rows.find((r) => r.querySelector(`a[href$="${q}"]`));
  assert.deepEqual(rowOf(graded).querySelectorAll(".cs-grade").map((g) => g.textContent.slice(-1)), [real.capture.grade, real.connection.grade]);
  assert.equal(rowOf(bare).querySelectorAll('.cs-gap[data-gap="unrated"]').length, 2);
  assert.ok(!says(m, "screen.project.account.member") && says(m.querySelector(`a[href="/app/aiproject/${project}"]`), "screen.project.account.open"), "R1, R153 (T53): nothing of what pays; the link to the project's AI screen");
  /* changed in fix round 3 (DEC-394 (3a), R128): the registry lists `heldcaptures` on the project, drawn as "List this project's documents" */
  assert.deepEqual(actsIn(m).sort(), ["drawquestion", "findin", "heldcaptures", "planopen", "projectbarset", "projectleave", "projectstakeset", "promote"]);
  assert.ok(!actsIn(m).includes("strengthbarset"), "the group's bar is never set from a project (R10)");
  await p.settle();
  assert.equal(p.byOp("inquirystrength").length, 1, "the questions' strength read once, in one read, not at every redraw");
  assert.deepEqual(rawKeys(p.root()), []);
});

test("R9 the project's questions are projectquestions' items, each a reference opening question with its strength, paged to the end by the cursor", async () => {
  const pages = { "": { ok: true, project: P, items: [{ inquiry: Q, title: "Seven days?" }], cursor: Q },
                  [Q]: { ok: true, project: P, items: [], cursor: "INQ-2026-0005-x" },
                  "INQ-2026-0005-x": { ok: true, project: P, items: [{ inquiry: Q2, title: "Closed?" }], cursor: null } };
  const p = await open(at(), { plane: { projectquestions: (r) => ok(pages[r.query.after || ""]) } });
  const refs = section(p, "screen.project.questions.head").querySelectorAll('a.cs-ref[href^="/app/question/"]');
  assert.deepEqual(refs.map((a) => [a.getAttribute("href"), a.textContent]), [["/app/question/" + Q, "Seven days?"], ["/app/question/" + Q2, "Closed?"]]);
  assert.deepEqual(p.byOp("projectquestions").map((r) => r.query.after), [undefined, Q, "INQ-2026-0005-x"]);
  /* control: a later page refused is drawn failed beside what was read, never as the end */
  const broke = await open(at(), { plane: { projectquestions: (r) => (r.query.after ? refusedIn("SOME_REFUSAL", "Could not read.") : ok(pages[""])) } });
  const s = section(broke, "screen.project.questions.head");
  assert.equal(s.querySelectorAll('a.cs-ref[href^="/app/question/"]').length, 1);
  assert.ok(s.querySelector('[data-state="failed"]'));
});

test("R43 a new project's first question: state b asks it, opens it and lists it; control: a project with questions draws no state b", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const p = await pageOf(world, ann, path);
  const b = section(p, "project.firstquestion");
  assert.ok(says(b, "project.firstquestion.help"));
  assert.ok(button(p, "promote", b), "Open a question, after the first question's words");
  fill(p, { "project-question": "How many closed late?" });
  await press(p, "promote");
  assert.equal(p.byOp("drawquestion")[0].query.project, project);
  assert.match(p.location.pathname, /^\/app\/question\/INQ-\d{4}-\d{4}-how-many-closed-late$/);
  const drawn = p.location.pathname.split("/").pop();
  const again = await pageOf(world, ann, path);
  assert.equal(section(again, "project.firstquestion"), undefined);
  assert.ok(section(again, "screen.project.questions.head").querySelector(`a[href="/app/question/${drawn}"]`), "listed");
});

test("R10 R52 the project's own bar as strengthbarof answers it, read in words in the one of four cases that is true; no bar as absent, never as zero", async () => {
  const bar = (b) => ok({ ok: true, project: P, bar: b });
  const said = async (b) => section(await open(at(), { plane: { strengthbarof: bar(b) } }), "screen.project.bar.head");
  const both = await said({ declared: true, source: "project", capture: "B", connection: "C" });
  assert.ok(says(both, "project.bar.both", { source: "B", connection: "C" }));
  const one = await said({ declared: true, source: "project", capture: "B", connection: null });
  assert.ok(says(one, "project.bar.source_only", { source: "B" }));
  const other = await said({ declared: true, source: "project", capture: null, connection: "A" });
  assert.ok(says(other, "project.bar.connection_only", { connection: "A" }));
  const none = await said({ declared: false, source: "none", capture: null, connection: null });
  assert.ok(says(none, "project.bar.none"));
  assert.equal(none.querySelectorAll(".cs-grade").length, 0, "no bar is never drawn as a grade");
  for (const s of [both, one, other, none]) assert.equal(s.querySelectorAll("[data-bar]").length, 1, "the one that is true, not the other three side by side");
  assert.ok(!says(both, "project.bar.others.summary"));
});

test("R10 R16 Set this project's bar sends projectbarset with both axes, either or neither, and her reason; never strengthbarset", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const p = await pageOf(world, ann, path);
  const barNow = async () => { const b = (await ann.read("strengthbarof", { query: { project } })).bar; return { capture: b.capture || null, connection: b.connection || null }; };
  const before = await barNow();
  assert.ok(says(button(p, "projectbarset"), "act.projectbarset.label.project"), "by its registry label");
  fill(p, { "project-bar-capture": "A", "project-bar-connection": "C" });
  await press(p, "projectbarset", { reason: "the council meets on it" });
  const set = await barNow();
  assert.deepEqual(set, { capture: "A", connection: "C" }, "and it reached the store");
  fill(p, { "project-bar-capture": "", "project-bar-connection": "" });
  await press(p, "projectbarset", { reason: "we withdraw it" });
  /* the real bar is what the owner saw: undeclared at first, then the one she set */
  assert.deepEqual(p.byOp("projectbarset").map((r) => r.body), [{ project, capture: "A", connection: "C", expected: before, reason: "the council meets on it" },
    { project, expected: set, reason: "we withdraw it" }], "R10: the save names the bar the owner saw (strength R45)");
  assert.equal(p.byOp("strengthbarset").length, 0);
  /* control: a member not joined (invited) is offered no bar act */
  const ben = await world.signIn("ben", MAKER);
  await ann.act("projectinvite", { query: { projectId: project, handle: "ben" }, body: {} });
  const invited = await pageOf(world, ben, path);
  assert.ok(!actsIn(main(invited)).includes("projectbarset"));
});

test("R11 Open a question writes the inquiry, then draws it into the project (drawquestion), then opens it", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const p = await pageOf(world, ann, path);
  fill(p, { "project-question": "Did the 2026 report count working days?" });
  await press(p, "promote");
  const prom = p.byOp("promote")[0], draw = p.byOp("drawquestion")[0];
  const id = prom.body.bundleId;
  assert.match(id, /^INQ-\d{4}-\d{4}-did-the-2026-report-count-working-days$/);
  assert.deepEqual(Object.keys(prom.body.files[0]).sort(), ["path", "text"]);
  const text = prom.body.files[0].text;
  assert.match(text, new RegExp(`^project: ${project}$`, "m"));
  assert.ok(text.includes(JSON.stringify(word("file.recheck.revisit"))), "its recheck trigger is the keyed word (R44)");
  assert.deepEqual([draw.query.project, draw.query.inquiry, draw.query.note], [project, id, ""]);
  assert.ok(p.requests.indexOf(draw) > p.requests.indexOf(prom), "after the write");
  assert.equal(p.location.pathname, "/app/question/" + id);
});

test("R11 controls: an empty question sends nothing; a refused draw is said beside the act, the question open on its own screen", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const p = await pageOf(world, ann, path);
  assert.ok(says(await press(p, "promote"), "screen.project.question.empty"));
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0);
  /* a draw the project refuses for a question it once removed: the page's own new question is never one, so the refusal alone is scripted (`refusedIn`) */
  const d = await pageOf(world, ann, path, { drawquestion: refusedIn("SEVERED_EDGE", "The project once removed this question; reinstate it instead.") });
  fill(d, { "project-question": "Who inspects?" });
  await press(d, "promote");
  assert.equal(d.location.pathname, path, "the project screen stays");
  const said = main(d).querySelector('[data-refusal="drawquestion"]');
  assert.ok(says(said, "screen.project.questions.notdrawn", { reason: "The project once removed this question; reinstate it instead." }));
  assert.match(said.querySelector("a.cs-ref").getAttribute("href"), /^\/app\/question\/INQ-\d{4}-\d{4}-who-inspects$/);
});

test("R16 R8 Draw on a question from elsewhere: a choice among the questions she may see, as record data, sending drawquestion with her note", async () => {
  const { world, ann, project, at: path } = await worldWith();
  /* the questions she may see: one the project drew and removed (severed), and one of another project; a question the project holds is not offered */
  await world.recipes.question(ann, project, { title: "Seven days?", text: "Seven days?", draw: true });
  const gone = await world.recipes.question(ann, project, { title: "Severed", text: "Severed", draw: true });
  const sel = await ann.act("select", { body: { ids: [gone.id] } });
  await ann.act("sever", { query: { project, handle: sel.handle, reason: "the wrong year" }, body: {} });
  const elsewhere = await world.recipes.project(ann, "Another project");
  const other = await world.recipes.question(ann, elsewhere, { title: "Another project's", text: "Another project's" });
  const p = await pageOf(world, ann, path);
  assert.deepEqual(options(p, "project-draw-question"), [
    [gone.id, word("screen.document.cite.option", { question: "Severed", project: "Pothole repairs" })],
    [other.id, word("screen.document.cite.option", { question: "Another project's", project: "Another project" })]], "each named with its project, as the real list states it");
  fill(p, { "project-draw-question": other.id, "project-draw-note": "the same crews" });
  await press(p, "drawquestion");
  const q = p.byOp("drawquestion")[0].query;
  assert.deepEqual([q.project, q.inquiry, q.note], [project, other.id, "the same crews"]);
  assert.ok(says(main(p).querySelector('[data-said="drawquestion"]'), "screen.project.draw.done"));
  /* already drawn: the page's choice still offers it, drawn behind its back by another act, so the real answer is "already" */
  const third = await world.recipes.question(ann, elsewhere, { title: "Third", text: "Third?" });
  const a = await pageOf(world, ann, path);
  await ann.act("drawquestion", { query: { project, inquiry: third.id, note: "first" } });
  fill(a, { "project-draw-question": third.id, "project-draw-note": "why not" });
  await press(a, "drawquestion");
  assert.ok(says(main(a).querySelector('[data-said="drawquestion"]'), "screen.project.draw.already"));
  /* controls: no note, nothing sent; a title shaped like a word key is drawn as itself */
  const n = await pageOf(world, ann, path);
  fill(n, { "project-draw-note": "" });
  assert.ok(says(await press(n, "drawquestion"), "screen.project.draw.empty"));
  assert.equal(n.byOp("drawquestion").length, 0);
  const keyed = await world.recipes.question(ann, elsewhere, { title: "act.promote.does", text: "act.promote.does" });
  const k = await pageOf(world, ann, path);
  assert.ok(options(k, "project-draw-question").some(([v, t]) => v === keyed.id && t === word("screen.document.cite.option", { question: "act.promote.does", project: "Another project" })));
});

test("R27 R36 This project's work: its plans by name and the calculations, standards and timeline it names; control: no plan, no plan listed", async () => {
  const md = projectWith([[Q, "cites", "active"], ["CALC-2026-0002", "cites", "active"], ["STD-2026-0001", "cites", "active"], ["EVT-2026-0009", "cites", "active"]]);
  const p = await open(at(), { images: { [P]: { "bundle.md": md } }, plane: { plans: ok({ ok: true, plans: [{ id: "PLAN-2026-0003", title: "Pothole options" }] }) } });
  const s = section(p, "project.work.title");
  assert.ok(says(s.closest ? s : s, "screen.timeline.name"));
  const kinds = s.querySelectorAll("a.cs-ref, .cs-card, .rec").map((a) => a.textContent);
  assert.ok(kinds.includes("Pothole options"), "the plan by name");
  assert.ok(s.textContent.includes(word("screen.calculation.name")) && s.textContent.includes(word("screen.standard.name")));
  assert.ok(s.querySelector("h2").getAttribute("data-tip").includes(word("project.work.help")));
  /* R52 (1): a kind it has none of is still listed, so the first one can be made (R27's "not listed" is retired) */
  const none = await open(at());
  assert.ok(section(none, "project.work.title").textContent.includes(word("screen.plan.name")), "no plan: the plan kind is still listed");
  /* R36 (fix round 2, C63): a plan opened here opens its page, where the receipt is; the plan is listed by name when she returns */
  // fixtures-contract: screens-action plan-screen-shape
  const stubPlan = { id: "plan", reads: () => ({}), render: () => "", acts: [], words: [] };
  const { world, ann, project, at: path } = await worldWith();
  const asked = await world.recipes.question(ann, project, { title: "Seven days", text: "Seven days?", draw: true });
  const o = await pageOf(world, ann, path, {}, [...SCREENS, stubPlan]);
  fill(o, { "project-plan": "Ask the committee", "project-plan-about": asked.id });
  await press(o, "planopen");
  assert.deepEqual(o.byOp("planopen")[0].body, { project, title: "Ask the committee", subjects: [{ kind: "inquiry", inquiry: asked.id }] });
  assert.match(o.location.pathname, /^\/app\/plan\/PLN-\d{4}-\d{4}/);
});

test("R28 who can find it: the setting, its history newest first ending with how it started, and an owner's reasoned change", async () => {
  const { world, ann, project, at: path } = await worldWith();
  /* hidden, then findable again with her reason: the history is two changes after how it started */
  await ann.act("projectvisibilityset", { query: { projectId: project, setting: "hidden", reason: "kept while the draft is rough" }, body: {} });
  world.tick(60_000);
  await ann.act("projectvisibilityset", { query: { projectId: project, setting: "discoverable", reason: "the team should know" }, body: {} });
  const held = await ann.read("projectvisibility", { query: { projectId: project } });
  const change = held.history.find((h) => h.reason === "the team should know"), started = held.history[held.history.length - 1];
  const p = await pageOf(world, ann, path);
  const s = section(p, "project.visibility.title");
  assert.ok(says(s, "project.visibility.discoverable"));
  assert.ok(says(s.querySelector('[data-visibility="change"]'), "project.visibility.history",
    { change: word("project.visibility.discoverable"), who: "ann", date: day(change.at), reason: "the team should know" }));
  assert.ok(says(s.querySelector('[data-visibility="started"]'), "project.visibility.started", { setting: word("project.visibility." + started.setting), date: day(started.at) }));
  fill(p, { "project-visibility-why": "a counsel matter now" });
  await press(p, "projectvisibilityset");
  assert.deepEqual([p.byOp("projectvisibilityset")[0].query.projectId, p.byOp("projectvisibilityset")[0].query.setting, p.byOp("projectvisibilityset")[0].query.reason],
    [project, "hidden", "a counsel matter now"]);
  assert.equal((await ann.read("projectvisibility", { query: { projectId: project } })).setting, "hidden", "and it reached the store");
  /* refusals by their words: a project kept for counsel is the store's to refuse, scripted by its code alone */
  const r = await pageOf(world, ann, path, { projectvisibilityset: refusedIn("PROJECT_SCOPE_KEEPS_HIDDEN", "A project kept for counsel stays hidden.") });
  fill(r, { "project-visibility-why": "x" });
  assert.ok((await press(r, "projectvisibilityset")).textContent.length > 0);
  /* control: a member who is not an owner does not see the act */
  const ben = await world.signIn("ben", MAKER);
  await ann.act("projectinvite", { query: { projectId: project, handle: "ben" }, body: {} });
  await ben.act("projectjoin", { query: { projectId: project }, body: {} });
  const m = await pageOf(world, ben, path);
  assert.ok(!actsIn(section(m, "project.visibility.title")).includes("projectvisibilityset"));
});

/* a project the founder makes, with `mai` (an owner since the founder made her one) and `ana` (joined, not an owner), each by her real acts */
const crew = async (extra = []) => {
  const world = await storeWorld();
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  const who = {};
  for (const h of ["mai", "ana", ...extra]) who[h] = await world.signIn(h, MAKER);
  const project = await world.recipes.project(founder, "Founder's potholes");
  for (const h of ["mai", "ana"]) {
    await founder.act("projectinvite", { query: { projectId: project, handle: h }, body: {} });
    await who[h].act("projectjoin", { query: { projectId: project }, body: {} });
  }
  await founder.act("projectowneradd", { query: { projectId: project, handle: "mai" }, body: {} });
  return { world, founder, ...who, project, at: "/app/project/" + project };
};

test("R29 R40 R54 members: one row each with role, the founder unnamed by key, never admin; an owner's acts on each row", async () => {
  const { world, founder, mai, project, at: path } = await crew();
  const roster = (await mai.read("projectparticipants", { query: { projectId: project } })).participants;
  const since = roster.find((x) => x.handle === "mai").owner_since, joined = roster.find((x) => x.handle === "ana").joined_at;
  const p = await pageOf(world, mai, path);
  const s = section(p, "screen.project.members.head");
  const rows = s.querySelectorAll(".cs-row");
  assert.ok(rows[0].textContent.includes(WORLD_FOUNDER_HANDLE) && says(rows[0], "project.member.owner"), "the founder, by the handle she chose, an owner");
  /* R40: a founder who chose no handle is unnamed by key (a world claimed with none, store-request's `unnamedFounderWorld`); the world's founder above has one */
  const nw = await unnamedFounderWorld();
  const nmai = await nw.signIn("mai", MAKER);
  const nproject = await nw.recipes.project(nw.unnamed, "Unnamed founder's potholes");
  await nw.unnamed.act("projectinvite", { query: { projectId: nproject, handle: "mai" }, body: {} });
  await nmai.act("projectjoin", { query: { projectId: nproject }, body: {} });
  const unnamed = await pageOf(nw, nmai, "/app/project/" + nproject);
  const bare = section(unnamed, "screen.project.members.head").querySelectorAll(".cs-row")[0];
  assert.ok(says(bare, "member.founder.unnamed") && says(bare, "project.member.owner"));
  assert.ok(!/\badmin\b/.test(s.textContent), "never admin");
  assert.ok(says(rows[1], "project.member.since", { date: day(since) }));
  assert.ok(says(rows[2], "project.member.joined", { date: day(joined) }) && says(rows[2], "project.member.member"));
  assert.deepEqual(actsIn(rows[1]), ["projectownerremove"], "her own row: stand down");
  assert.deepEqual(actsIn(rows[2]).sort(), ["projectowneradd", "projectremove"], "a member's row, to an owner");
  assert.ok(says(s, "project.owners.rule"));
  /* K4199 (interface-shell R107): the shell opens its reason box before "Make an owner"; she gives the reason as a member does */
  await press(p, "projectowneradd", { within: rows[2], reason: "she has done the work" });
  assert.deepEqual([p.byOp("projectowneradd")[0].query.projectId, p.byOp("projectowneradd")[0].query.handle], [project, "ana"]);
  assert.equal(p.byOp("projectowneradd")[0].body.reason, "she has done the work", "and the shell sends it with the act");
  await press(p, "projectremove", { within: section(p, "screen.project.members.head").querySelectorAll(".cs-row")[2] });
  assert.equal(p.byOp("projectremove")[0].query.handle, "ana");
  assert.ok(!("comment" in p.byOp("projectremove")[0].query), "an empty reason is not refused, and none is sent");
  /* R75: "Stand down as owner…" opens the vote in place and sends nothing (the vote itself is t51-project.test.mjs's) */
  await press(p, "projectownerremove", { within: section(p, "screen.project.members.head").querySelectorAll(".cs-row")[1] });
  assert.equal(p.byOp("projectownerremove").length, 0, "opened, not sent");
  /* control: with a handle, the handle */
  assert.ok(rows[1].textContent.includes("mai"));
  /* R54: a null date draws no date, never "since null": a member invited and not yet joined has none (the store's own); an owner whose date was never recorded
     has none, a state no act makes (project-roster stamps every owner, so the case is not tested here) */
  await world.signIn("ben", MAKER);
  await founder.act("projectinvite", { query: { projectId: project, handle: "ben" }, body: {} });
  const real = await pageOf(world, mai, path);
  assert.ok(!/null|undefined/.test(section(real, "screen.project.members.head").textContent), "no date is said");
});

test("R29 three owners with one change agreed by one draw waiting for the other two; an owner who has not agreed agrees by the same act", async () => {
  const { world, founder, mai, ana, project, at: path } = await crew();
  /* three owners: an addition beyond the second waits for every owner (CONSENSUS_REQUIRED records the proposer's vote), so the founder proposes rosa and mai agrees;
     then the founder proposes ana, agreed by her alone, waiting on mai and rosa */
  const rosa = await world.signIn("rosa", MAKER);
  await founder.act("projectinvite", { query: { projectId: project, handle: "rosa" }, body: {} });
  await rosa.act("projectjoin", { query: { projectId: project }, body: {} });
  const vote = (as, handle) => as.act("projectowneradd", { query: { projectId: project, handle }, body: {} }).catch((e) => { if (!/CONSENSUS_REQUIRED/.test(String(e.message))) throw e; });
  await vote(founder, "rosa");
  await vote(mai, "rosa");
  await vote(founder, "ana");
  const votes = await mai.read("projectownervotes", { query: { projectId: project } });
  const pending = votes.changes.find((c) => c.change === "add" && c.target === "ana");
  assert.ok(pending, "one change is pending in the store");
  assert.deepEqual([...pending.awaiting].sort(), ["mai", "rosa"]);
  const p = await pageOf(world, mai, path);
  const s = section(p, "screen.project.members.head");
  assert.ok(says(s.querySelector('[data-pending="add"]'), "project.owners.pending", { who: "ana", by: pending.proposed_by, date: day(pending.proposed_at), agreed: pending.agreed.join(", "), awaiting: pending.awaiting.join(", ") }));
  const agree = s.querySelectorAll('button[data-act="projectowneradd"]').find((b) => says(b, "project.owners.agree", { who: "ana" }));
  assert.ok(agree, "she agrees by the same act");
  /* control: a non-owner sees no owner act */
  const m = await pageOf(world, ana, path);
  const acts = actsIn(section(m, "screen.project.members.head"));
  for (const op of ["projectowneradd", "projectownerremove", "projectremove", "projectinvite"]) assert.ok(!acts.includes(op), op);
});

test("R29 beneath the rows: invite (an owner), leave, and start a project from this one, hidden preselected, opening the new one", async () => {
  const { world, mai, project, at: path } = await crew();
  await world.signIn("ben", MAKER);
  const p = await pageOf(world, mai, path);
  fill(p, { "project-invite": "@ben" });
  await press(p, "projectinvite");
  assert.deepEqual([p.byOp("projectinvite")[0].query.projectId, p.byOp("projectinvite")[0].query.handle], [project, "ben"]);
  assert.equal(p.doc.getElementById("project-fork-visibility").value, "hidden");
  fill(p, { "project-fork-title": "Pothole repairs, 2027" });
  await press(p, "projectfork");
  assert.deepEqual([p.byOp("projectfork")[0].query.projectId, p.byOp("projectfork")[0].query.title, p.byOp("projectfork")[0].query.visibility], [project, "Pothole repairs, 2027", "hidden"]);
  assert.match(p.location.pathname, /^\/app\/project\/PROJ-\d{4}-\d{4}/);
  assert.notEqual(p.location.pathname, path, "the new one opened");
  /* leaving ends her part in the project, so the page that leaves is a fresh one, after the other acts */
  const l = await pageOf(world, mai, path);
  await press(l, "projectleave");
  assert.equal(l.byOp("projectleave")[0].query.projectId, project);
  assert.ok(!(await mai.read("projectparticipants", { query: { projectId: project } })).participants.some((x) => x.handle === "mai" && x.state === "joined"), "and it reached the store");
});

test("R30 R54 state c: an administrator at a hidden project's existence, its owners inactive: the rescue and nothing else; the title carries the date they stopped; controls: a refusal by its words, a project whose owners are active offers none", async () => {
  /* the real state: a member makes a hidden project, the founder revokes her (`memberset`), so every owner is inactive; an enrolled administrator sees it at its existence only */
  const world = await storeWorld();
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  const rosa = await world.signIn("rosa", { admin: true });
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const cal = await world.signIn("cal", { capabilities: ["contribute", "create_projects"] });
  const strand = async (owner, title) => {
    const id = await world.recipes.project(owner, title);
    await owner.act("projectvisibilityset", { query: { projectId: id, setting: "hidden", reason: "kept to its owner" }, body: {} });
    return id;
  };
  const project = await strand(ann, "Stormwater"), second = await strand(cal, "Culverts");
  await founder.act("memberset", { body: { memberId: "ann", status: "revoked" } });
  await founder.act("memberset", { body: { memberId: "cal", status: "revoked" } });
  const since = (await rosa.read("projectownersgone", { query: { projectId: project } })).since;
  assert.ok(since, "the plane states when the last owner stopped being active");
  const page = async (as, path, plane = {}) => { const { door, session } = world.boot(as); const b = await boot({ screens: SCREENS, door, session, path, plane }); await b.settle(); return b; };
  const p = await page(rosa, "/app/project/" + project);
  const s = section(p, "project.rescue.title", { date: day(since) });
  assert.ok(s, "the title carries the date the last owner stopped being active (`projectownersgone`'s since)");
  assert.ok(says(s, "project.rescue.says", { owners: "ann" }) && says(s, "project.rescue.own"));
  assert.deepEqual(actsIn(main(p)), ["projectownerrescue"], "nothing else of the project");
  assert.equal(p.byOp("projectownersgone")[0].query.projectId, project);
  fill(p, { "project-rescue-why": "its work must go on" });
  await press(p, "projectownerrescue");
  const q = p.byOp("projectownerrescue")[0].query;
  assert.deepEqual([q.projectId, q.handle, q.reason], [project, "rosa", "its work must go on"]);
  assert.ok((await rosa.read("projectparticipants", { query: { projectId: project } })).participants.some((x) => x.handle === "rosa" && x.owner), "and it reached the store: she is an owner");
  /* control: a refusal of the act (a project kept for its owner alone is never taken over) is drawn by its words */
  const k = await page(rosa, "/app/project/" + second, { projectownerrescue: refusedIn("PROJECT_SCOPE_OWN", "A project kept for one member alone is never taken over.") });
  fill(k, { "project-rescue-why": "x" });
  assert.ok((await press(k, "projectownerrescue")).textContent.length > 0, "the refusal is drawn beside the act");
  /* control: a project whose owners are still active is offered no rescue */
  const bob = await world.signIn("bob", { capabilities: ["contribute", "create_projects"] });
  const busy = await world.recipes.project(bob, "Active");
  await bob.act("projectvisibilityset", { query: { projectId: busy, setting: "hidden", reason: "kept to its owner" }, body: {} });
  const r = await page(rosa, "/app/project/" + busy);
  assert.deepEqual(actsIn(main(r)), [], "no rescue is drawn for a project whose owners are active: " + actsIn(main(r)).join(","));
});

test("R1 R60 a member who has not joined: a findable project shows its name with Ask to join; a hidden one is unavailable, with no form", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const ben = await world.signIn("ben", MAKER);
  const findable = await pageOf(world, ben, path);
  assert.deepEqual(actsIn(main(findable)), ["projectrequest"]);
  assert.ok(says(main(findable), "screen.project.notjoined"));
  assert.equal(main(findable).querySelector("h1").textContent, "Pothole repairs", "R39: its name, never its id");
  await press(findable, "projectrequest");
  assert.equal(findable.byOp("projectrequest")[0].query.projectId, project);
  /* her open request is said, with Withdraw */
  const mine = (await ben.read("projectdirectory", { query: {} })).projects.find((x) => x.id === project).request;
  assert.equal(mine.state, "open");
  const asked = await pageOf(world, ben, path);
  assert.deepEqual(actsIn(main(asked)), ["projectrequestwithdraw"]);
  assert.ok(says(main(asked), "projects.request.asked", { date: day(mine.asked) }));
  await press(asked, "projectrequestwithdraw");
  assert.equal(asked.byOp("projectrequestwithdraw")[0].query.projectId, project);
  /* a hidden project she is not in: unavailable (state b), nothing else of it. The store answers a member "no such project" (a hidden one is never told apart
     from one that is not there); it is an administrator it tells that the project exists and is not hers (`PROJECT_SEEN_NOT_A_PARTICIPANT`) */
  await ann.act("projectvisibilityset", { query: { projectId: project, setting: "hidden", reason: "kept to its owner" }, body: {} });
  const rosa = await world.signIn("rosa", { admin: true });
  const hidden = await pageOf(world, rosa, path);
  assert.deepEqual(actsIn(main(hidden)), [], "no form");
  assert.ok(says(main(hidden), "shell.unavailable.notyours.says"));
  assert.equal(main(hidden).querySelectorAll("section").length, 0, "nothing else of the project");
  /* control: a participant is drawn the screen whole */
  const whole = await pageOf(world, ann, path);
  assert.ok(section(whole, "screen.project.stage.head"));
});

test("R1 R37 a member invited and not yet joined sees the not-joined state with Join, never a failed read; after joining, the page reads as a participant's", async () => {
  const { world, ann, project, at: path } = await worldWith();
  const ben = await world.signIn("ben", MAKER);
  await ann.act("projectinvite", { query: { projectId: project, handle: "ben" }, body: {} });
  const p = await pageOf(world, ben, path);
  const m = main(p);
  assert.deepEqual(actsIn(m), ["projectjoin"]);
  assert.ok(says(m, "screen.project.notjoined"));
  assert.equal(m.querySelector('[data-state="failed"]'), null, "no failed read drawn");
  assert.equal(m.querySelector("h1").textContent, "Pothole repairs");
  assert.equal(main(p).querySelector('[data-aiproject="link"]'), null, "R153: no link to the project's AI screen before she joins");
  await press(p, "projectjoin");
  assert.equal(p.byOp("projectjoin")[0].query.projectId, project);
  assert.ok(main(p).querySelector(`a[href="/app/aiproject/${project}"]`), "R153: the link, once she has joined");
  assert.ok(actsIn(main(p)).includes("projectleave") && !actsIn(main(p)).includes("projectjoin"), "now a participant's page");
  /* control: a joined member's page is not the not-joined state */
  const j = await pageOf(world, ann, path);
  assert.ok(!says(main(j), "screen.project.notjoined"));
});

test("R38 Add a document opens capture with the project as its subject", async () => {
  const p = await open(at());
  const a = main(p).querySelector('[data-adddoc="project"]');
  assert.equal(a.getAttribute("href"), "/app/capture/address/" + P);
  assert.ok(says(a, "project.adddoc"));
});

test("R39 no heading is a record id; a project with no title draws undetermined", async () => {
  const p = await open(at());
  for (const h of main(p).querySelectorAll("h1, h2")) assert.doesNotMatch(h.textContent, /PROJ-|INQ-|INFO-/);
  const bare = await open(at(), { images: { [P]: { "bundle.md": `---\nid: ${P}\nobject_type: project\n---\n` } } });
  assert.ok(main(bare).querySelector("h1").textContent.startsWith(lead("state.undetermined")));
});

test("R153 the project draws one link to its AI screen, aiproject, by address and the key's word; no read or act of R14's former list is sent", async () => {
  const p = await open(at());
  const links = main(p).querySelectorAll('a[href^="/app/aiproject/"]');
  assert.equal(links.length, 1, "one link");
  assert.equal(links[0].getAttribute("href"), "/app/aiproject/" + P);
  assert.ok(says(links[0], "screen.project.account.open"));
  assert.equal(p.root().querySelectorAll('a[href^="/app/projectai/"]').length, 0, "the old address is drawn nowhere");
  const FORMER = ["projectaccountstate", "accountuses", "ailimits", "aiusage", "accounthistory", "projectaikeepawaystate", "projectkeyset", "projectsigninset",
    "projectaccountswitch", "projectaccountremove", "projectkeynoticeseen", "accountusesset", "ailimitset", "projectaikeepaway"];
  for (const op of FORMER) assert.equal(p.byOp(op).length, 0, `${op} is not sent`);
});

test("R1 controls: no handle and no plan title or question are refused by their words, nothing sent", async () => {
  const { world, ann, project, at: path } = await worldWith();
  await world.recipes.question(ann, project, { title: "Seven days", text: "Seven days?", draw: true });
  const p = await pageOf(world, ann, path);
  fill(p, { "project-invite": "", "project-plan": "" });
  assert.ok(says(await press(p, "projectinvite"), "screen.project.invite.empty"));
  await press(p, "planopen");
  assert.equal(p.byOp("projectinvite").length + p.byOp("planopen").length, 0);
});

test("R1 an act the session may not do is absent, never greyed (interface-shell R12)", async () => {
  const p = await open(at(), { boot: { plane: { ...plane(), whoami: ok({ ...MEMBER, capabilities: [] }) } } });
  const drawn = actsIn(main(p));
  const needing = PROJECT.acts.map((a) => a.op).filter((op) => NEEDS[op]);
  assert.ok(needing.length > 0);
  for (const op of needing) assert.ok(!drawn.includes(op), `${op} needs ${NEEDS[op]}: absent`);
  assert.ok(!main(p).querySelector("button[disabled]"), "never greyed");
});

test("R1 (K3379, D29) the founder's project page sends no projectdirectory; control: a member's does", async () => {
  const { world, ann, at: path } = await worldWith();
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  /* her own project: she is a participant, so what pays for the assistant is read as for any participant */
  const mine = "/app/project/" + await world.recipes.project(founder, "Founder's potholes");
  const seen = await pageOf(world, founder, mine);
  assert.equal(seen.byOp("projectdirectory").length, 0);
  assert.ok(!main(seen).querySelector('[data-state="failed"]'), "never drawn as a failure");
  assert.equal(main(seen).querySelector("h1").textContent, "Founder's potholes", "and the project is drawn whole");
  const member = await pageOf(world, ann, path);
  assert.equal(member.byOp("projectdirectory").length, 1);
});
