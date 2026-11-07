/* screens-inquiry R2, R12, R23–R27, R31, R34–R36, R38, R39, R41: the question screen, on interface-shell's served page over
 * a scripted plane. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDeclaredOps as registerOps } from "../../../src/op-declarations/index.mjs";
import { boot, ok, refusedIn } from "../interface-shell/harness.mjs";
import { holdRefusals } from "../hypotheses/fixtures.mjs";
import { open, storeWorld, WORLD_FOUNDER_HANDLE, main, actsIn, button, fill, press, rawKeys, inquiryMd, INQUIRY_REFS, LEGS, BASIS, plane, says, section, lead, word, day, POLICY,
  SCREENS, P, Q, D, ASIDE_TITLE, HUNCH, HUNCH_BY, HUNCHES } from "./fixtures.mjs";

/* K4245 (test-support R17): every owner's declarations registered once, before the first read, by the one registrar */

const at = "/app/question/" + Q;
/* the inquiry with its partition held (state a): the policy a part of its own */
const GROUNDS = [{ ground: "part 1", asserted_by: "member:dev", at: "2026-10-05T09:00:00Z" }];
const grouped = (o = {}) => inquiryMd(P, INQUIRY_REFS, { legs: LEGS.map((l) => (l.target === D ? { ...l, ground: "part 1" } : l)), grounds: GROUNDS, ...o });
const A = { images: { [Q]: { "bundle.md": grouped() } } };
/** A project with `n` held documents and a question in it resting on them (`legs` overrides each leg's keys), drawn into the project: all by real acts over the world.
 *  Answers `{world, ann, project, docs, id, page(opts)}`; `page` boots the question's page over the world (`plane` overrides only the ops it names, as `boot` does). */
const stateWorld = async ({ n = 2, legs = null, role = "supports", world = null, as = "ann", names = null } = {}) => {
  world = world || await storeWorld();
  const ann = await world.signIn(as, { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  const docs = [];
  for (let i = 0; i < n; i++) docs.push((await world.recipes.hold(ann, names ? names[i] : "Passage " + (i + 1), "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const made = docs.map((target, i) => ({ target, role, grade: "B", grade_axis: "capture", grade_source: "capture", ...(legs ? legs[i] : {}) }));
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: made, draw: true })).id;
  const page = async (o = {}, who = ann) => {
    const { door, session } = world.boot(who);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, ...o });
    await p.settle();
    return p;
  };
  return { world, ann, project, docs, id, page };
};
/** the question's leg on `target` severed, by the acts the page makes (a selection, then `sever` with the question as the citing object) */
const severLeg = async (w, target, reason = "the wrong year's orders") => {
  const sel = await w.ann.act("select", { body: { ids: [target] } });
  await w.ann.act("sever", { query: { project: w.id, handle: sel.handle, reason }, body: {} });
};
/** the partition held, by the act the page's "Save the answers" makes (`grounds` are `{ground, legs: [ordinals]}`) */
const ground = (w, grounds, reason = "my reading") => w.ann.act("inquiryground", { body: { target: w.id, grounds, reason } });
/** the team's Claude account, by the administrator's real acts (the world made with `storeWorld({ ai: true })`): her password again, the team's key set and switched on, its notice read */
const aiTeam = async (world) => {
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  await admin.act("reauth", { body: { password: admin.password } });
  await admin.act("groupkeyset", { body: { key: "sk-ant-api03-" + "w".repeat(40) } });
  await admin.act("groupkeyswitch", { body: { on: true } });
  await admin.act("groupkeynoticeseen", { body: {} });
};
/** the member reads the team's notice (`groupkeynoticeseen`), as each member must before the assistant answers her */
const readNotice = (w) => w.ann.act("groupkeynoticeseen", { body: {} });
/** a run of the member's own over the question, opened by her real act (`airunopen`: running, as the page's own press opens one, before anything dispatches it) */
const openRun = async (w, run = "RUN-" + "c".repeat(16)) => {
  await w.ann.act("airunopen", { body: { run, contextType: "inquiry", contextId: w.id, skillVersion: "investigative-session@1", principalAi: `member:${w.ann.member}`, mode: "check" } });
  return run;
};
/** the question's page, as `who` reads it over the world */
const pageOf = async (world, who, id, o = {}) => {
  const { door, session } = world.boot(who);
  const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, ...o });
  await p.settle();
  return p;
};
/** a record's title, as its bundle holds it */
const titleOf = async (as, id) => /^title: "?(.*?)"?$/m.exec((await as.read("image", { query: { id } }))["bundle.md"])[1];

test("R2 reads: the inquiry, its strength, basis versions, hunches, what it waits on and what relies on it", async () => {
  const p = await open(at, A);
  const q = (op) => p.byOp(op)[0].query;
  assert.equal(p.byOp("image").find((r) => r.query.id === Q).query.id, Q);
  assert.equal(q("inquirystrength").id, Q);
  assert.equal(q("basisversions").id, Q);
  assert.ok(p.byOp("basisversions").some((r) => r.query.project === P), "R25: the reading the project stands on, read with project");
  assert.equal(q("hypotheses").inquiry, Q);
  assert.equal(q("questionwaits").question, Q);
  assert.equal(q("backlinks").target, Q);
  assert.deepEqual(q("strengthbarof"), { op: "strengthbarof", project: P });
  assert.ok(p.root().querySelector(".cs-crumbs").textContent.includes("Pothole repairs"));
});

/** A project of `ann`'s whose question rests on a passage held under the title POLICY (its capture graded `capture`) and on a directory whose connection is graded B by resolution, the project's
 *  bar B/B declared by her act, the partition held: state a, by real acts. Answers `{world, ann, project, id, memo, strength, bar}`: the owners' own answers beside it. */
const barredQuestion = async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  const directory = await world.recipes.graded(ann, project);
  const memo = (await world.recipes.hold(ann, POLICY, "The work orders of 2026.", project)).bundle;
  const made = await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", subject: directory.subject, draw: true,
    legs: [{ target: memo, grade: "C", grade_axis: "capture", grade_source: "capture" }, { target: directory.document, grade: "B", grade_axis: "connection", grade_source: "resolution" }] });
  await ann.act("inquiryground", { body: { target: made.id, grounds: [{ ground: "part 1", legs: [0, 1] }], reason: "my reading" } });
  await ann.act("projectbarset", { body: { project, capture: "B", connection: "B", expected: { capture: null, connection: null }, reason: "the council meets on it" } });
  return { world, ann, project, id: made.id, memo, strength: await ann.read("inquirystrength", { query: { id: made.id, project } }),
    bar: (await ann.read("strengthbarof", { query: { project } })).bar };
};

test("R2 state a: its words, two grades and the phrase against the project's bar, weakest part, what would raise it", async () => {
  const w = await barredQuestion();
  const p = await pageOf(w.world, w.ann, w.id);
  const m = main(p);
  assert.equal(m.querySelector("h1").textContent, "Do crews repair each pothole within seven days?");
  assert.equal(m.querySelector('a.cs-ref[href="/app/project/' + w.project + '"]').textContent, "Stormwater");
  const box = m.querySelector(".mk-strengthbox");
  assert.deepEqual(box.querySelectorAll(".cs-grade").map((g) => [g.getAttribute("data-scale"), g.textContent.slice(-1)]), [["capture", w.strength.capture.grade], ["connection", w.strength.connection.grade]],
    "two grades, as the owner answers them, never one score; an ungraded testimony axis is not drawn");
  assert.equal(w.strength.capture.grade, "C", "the passage's capture grade, under the bar's B");
  assert.ok(says(box, "screen.question.strength.against", { capture: w.bar.capture, connection: w.bar.connection }));
  assert.ok(says(box, "screen.question.strength.short") && says(box, "mark.scale.capture.name"), "short of the bar on the capture axis alone");
  assert.ok(!says(box, "screen.question.strength.meets"));
  assert.ok(says(box, "screen.question.strength.weakest", { weakest: POLICY }), "the weakest part, the passage the owner names, by its title");
  assert.equal(w.strength.capture.weakest.target_id, w.memo);
  const raise = box.querySelectorAll("p").find((x) => x.textContent.startsWith(lead("screen.question.strength.raise")));
  assert.ok(raise && raise.textContent.length > lead("screen.question.strength.raise").length, "what would raise it, from the owner's sentence");
  assert.ok(says(box, "screen.question.strength.two"));
  assert.deepEqual(rawKeys(p.root()), []);
});

test("R2 a question with no project is held against the group's bar; one that meets it says so", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  await admin.act("reauth", { body: { password: admin.password } });
  await admin.act("strengthbarset", { body: { capture: "B", reason: "the team's default" } });
  const rests = async (grade) => {
    const doc = (await world.recipes.hold(ann, POLICY + " " + grade, "The work orders of 2026 " + grade + ".", "")).bundle;
    const q = await world.recipes.question(ann, null, { title: "Seven days " + grade, text: "Do crews repair each pothole within seven days?", legs: [{ target: doc, grade, grade_axis: "capture", grade_source: "capture" }] });
    await ann.act("inquiryground", { body: { target: q.id, grounds: [{ ground: "part 1", legs: [0] }], reason: "my reading" } });
    return pageOf(world, ann, q.id);
  };
  const bar = (await ann.read("strengthbarof", { query: {} })).bar;
  const p = await rests("B");
  assert.equal(p.byOp("strengthbarof")[0].query.project, undefined);
  const box = main(p).querySelector(".mk-strengthbox");
  assert.ok(says(box, "screen.question.strength.against", { capture: bar.capture, connection: bar.connection || "" }) && says(box, "screen.question.strength.meets"));
  /* control: the same question resting on a passage graded under the group's bar is short of it */
  const short = main(await rests("C")).querySelector(".mk-strengthbox");
  assert.ok(says(short, "screen.question.strength.short") && !says(short, "screen.question.strength.meets"));
});

test("R2 R34 Supports lists every passage the question cites from its own legs, Cuts against its own; what it waits on, with who and why", async () => {
  const p = await open(at, A);
  const sup = section(p, "screen.question.supports.head"), cut = section(p, "screen.question.against.head");
  assert.ok(sup.querySelector(`a.cs-ref[href="/app/document/${D}"]`) && sup.querySelector('a.cs-ref[href="/app/document/INFO-2026-0005"]'));
  assert.ok(says(sup, "screen.question.leg.severed.why", { why: "the wrong year's orders" }));
  assert.equal(cut.querySelector(".cs-grade").getAttribute("data-scale"), "testimony");
  assert.ok(cut.querySelector('a.cs-ref[href="/app/document/INFO-2026-0006"]'));
  const waits = section(p, "screen.question.waits.head");
  assert.ok(says(waits, "screen.question.waits.setaside", { document: ASIDE_TITLE, who: "ben", reason: "wrong year" }));
  const hunches = section(p, "screen.question.hunches.head");
  assert.ok(says(hunches, "screen.question.hunch.by", { who: HUNCH_BY }) && hunches.textContent.includes(HUNCH.statement), "the live hunch, by who holds it");
  assert.deepEqual(hunches.querySelectorAll("[data-hunch]").map((h) => [h.getAttribute("data-hunch"), h.getAttribute("data-status")]), HUNCHES.hypotheses.map((h) => [h.hypothesis_id, h.status === "withdrawn" ? "withdrawn" : "live"]), "each hunch, the withdrawn one marked so");
});

test("R34 a question with two citations and no reading lists both; the strength sentence is drawn by its words, never raw grade text", async () => {
  const w = await stateWorld({ n: 2 });
  await ground(w, [{ ground: "part 1", legs: [0] }]);
  await severLeg(w, w.docs[1]);
  const p = await w.page();
  const sup = section(p, "screen.question.supports.head");
  assert.deepEqual(sup.querySelectorAll("a.cs-ref").map((a) => a.getAttribute("href")).sort(), w.docs.map((d) => `/app/document/${d}`).sort());
  assert.ok(!/\bB\/C\b|grade:/.test(main(p).querySelector(".mk-strengthbox").textContent.replace(word("screen.question.strength.against", { capture: "B", connection: "B" }), "")));
  /* control: a severed leg is drawn severed (R12) */
  assert.ok(sup.querySelector('[data-leg="severed"]'));
});

test("R23 state b: three cited passages and no partition: the ask first, no strength mark; saving sends the partition the answers give", async () => {
  const w = await stateWorld({ n: 3, legs: [{ grade: "B" }, { grade: "B" }, { grade: "C" }] });
  const p = await w.page();
  const m = main(p);
  assert.ok(says(m, "question.ask.first.title") && says(m, "question.ask.first.says"));
  assert.equal(m.querySelector(".mk-strengthbox"), null, "no strength mark and no strength sentence in state b");
  const ask = section(p, "question.ask.title");
  assert.equal(ask.querySelectorAll('[data-ask]').length, 3, "one question per cited passage");
  for (const fs of ask.querySelectorAll('fieldset[id^="ask-"]:not([id^="ask-which"])')) {
    assert.deepEqual(fs.querySelectorAll('input[type="radio"]').map((i) => i.getAttribute("value")), ["no", "yes"]);
    assert.ok(fs.querySelectorAll("input").every((i) => !i.checked), "none preselected");
  }
  assert.ok(says(ask, "question.ask.which") && says(ask, "question.rests.any") && says(ask, "question.rests.readback"));
  /* the first answered "no" (a passage the answer falls without: necessary, in no ground), the second and third holding each other up (one ground of two) (R23; DEC-32 clauses 2, 4) */
  p.doc.getElementById("ask-0-0").checked = true;
  p.doc.getElementById("ask-1-1").checked = true;
  p.doc.getElementById("ask-which-1-1").checked = true;
  await press(p, "inquiryground", { reason: "my first reading" });
  assert.deepEqual(p.byOp("inquiryground")[0].body.grounds, [{ ground: "part 1", legs: [1, 2] }]);
  assert.equal(p.byOp("inquiryground")[0].body.target, w.id);
  assert.ok(p.byOp("inquiryground")[0].body.grounds.every((g) => !("statement" in g)), "each part's statement left empty");
  /* no drawn word is AND or OR */
  assert.ok(!/\b(AND|OR)\b/.test(m.textContent));
  /* control: a question with a partition draws state a */
  const a = await w.page();
  assert.ok(main(a).querySelector(".mk-strengthbox") && !section(a, "question.ask.title"));
});

test("R24 R54 the read-back: one single part and one two-passage part in both shapes; who set it; each change; a shared origin's line", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  /* two documents of one issuer and a third whose connection grade is earned by resolution (the world's recipes), the question resting on the three */
  const origin = await world.recipes.sharedOrigin(ann, project);
  const directory = await world.recipes.graded(ann, project);
  const cited = [...origin.documents, directory.document];
  const q = await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", subject: directory.subject, draw: true,
    legs: cited.map((target, i) => ({ target, ...(i === 2 ? { grade: "B", grade_axis: "connection", grade_source: "resolution" } : {}) })) });
  await ann.act("inquiryground", { body: { target: q.id, grounds: [{ ground: "part 1", legs: [0] }, { ground: "part 2", legs: [1, 2] }], reason: "my reading" } });
  /* a second member of the project restructures it */
  const mai = await world.signIn("mai", { capabilities: ["contribute"] });
  await ann.act("projectinvite", { query: { projectId: project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: project }, body: {} });
  await mai.act("inquiryground", { body: { target: q.id, grounds: [{ ground: "part 1", legs: [0, 2] }, { ground: "part 2", legs: [1] }], reason: "the audit stands alone" } });
  const p = await pageOf(world, ann, q.id);
  /* what the page rests on, read from the owners' answers */
  const held = await ann.read("inquirypartition", { query: { id: q.id } });
  const read = await ann.read("partitionindependence", { query: p.byOp("partitionindependence")[0].query });
  const title = Object.fromEntries(await Promise.all(cited.map(async (id) => [id, await titleOf(ann, id)])));
  const passages = (part) => part.targets.map((t) => title[t]);
  const single = read.partition.find((x) => x.legs.length === 1), many = read.partition.find((x) => x.legs.length > 1);
  const changed = held.changes.filter((c) => c.act === "restructured");
  const r = section(p, "question.rests.title");
  assert.ok(says(r, "question.rests.any"));
  assert.ok(r.textContent.includes(passages(single)[0]), "the single part, by its title as the reading shown names it");
  assert.ok(says(r, "question.rests.all", { passages: passages(many).join(", ") }));
  const through = read.independence.shared[0], part = (label) => read.partition.find((x) => x.label === label);
  assert.ok(says(r, "question.origin.shared", { passages: passages(part(through.a)).join(", ") + ", " + passages(part(through.b)).join(", "), origin: origin.office }));
  assert.equal(r.querySelector("[data-origin-shared]").getAttribute("data-origin-shared"), through.through[0]);
  assert.ok(r.textContent.includes(lead("question.rests.set")) && r.textContent.includes(held.groups[0].asserted_by));
  assert.equal(changed.length, 1);
  assert.ok(r.querySelector('[data-change="0"]').textContent.includes(changed[0].reason));
  assert.equal(changed[0].strength_before.connection.grade, "B", "the connection axis graded by resolution");
  assert.ok(r.querySelector('[data-change="0"]').textContent.includes(["capture", "connection"].map((axis) => changed[0].strength_before[axis].grade || "").join("/")), "the strength before, as the change records it");
  assert.equal(r.querySelectorAll("[data-change]").length, changed.length, "the first authoring is the setting, not a change");
  /* "Change what a passage carries…" reopens the questions in place; the change is sent with her reason */
  const change = r.querySelector('[data-regroup="1"]');
  assert.ok(says(change.querySelector("summary"), "question.rests.change"));
  assert.equal(change.querySelectorAll("[data-ask]").length, cited.length, "R23's questions, in place");
  p.doc.getElementById("ask-0-0").checked = true;
  await press(p, "inquiryground", { within: section(p, "question.rests.title"), reason: "the audit stands alone after all" });
  assert.equal(p.byOp("inquiryground")[0].body.reason, "the audit stands alone after all", "NO_REASON: a restructure carries her reason");
  /* control: documents of no shared issuer draw no such line */
  const [a, b] = [await world.recipes.page(ann, "Plain count", { project }), await world.recipes.page(ann, "Plain audit", { project })];
  const plain = await world.recipes.question(ann, project, { title: "Plain", legs: [{ target: a.bundle }, { target: b.bundle }], draw: true });
  await ann.act("inquiryground", { body: { target: plain.id, grounds: [{ ground: "part 1", legs: [0] }, { ground: "part 2", legs: [1] }], reason: "my reading" } });
  const n = await pageOf(world, ann, plain.id);
  assert.equal(section(n, "question.rests.title").querySelector("[data-origin-shared]"), null);
});

test("R25 readings: three drawn with their states, one a what-if, stands on the project's CURRENT; each act sends its op with the version", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  /* a question holding readings in every state (the world's recipe): the project stands on the last one accepted */
  const made = await world.recipes.readings(ann, project);
  const { accepted, considering, suggested, rejected } = made.versions;
  const held = await ann.read("basisversions", { query: { id: made.question, project } });
  const moved = (name) => held.versions.find((v) => v.name === name).moved;
  /* N1073: the reading acts as the screen declares them, never hand-listed */
  const VERSION_ACTS = SCREENS.find((s) => s.id === "question").acts.map((a) => a.op).filter((op) => /^version/.test(op));
  assert.equal(VERSION_ACTS.length, 6);
  const p = await pageOf(world, ann, made.question);
  const s = section(p, "question.readings.title");
  const row = (name) => section(p, "question.readings.title").querySelector(`[data-reading="${name}"]`);
  assert.ok(says(row(accepted), "question.reading.accepted", { who: moved(accepted).by, date: day(moved(accepted).at) }));
  assert.ok(says(row(considering), "question.reading.weighing", { who: moved(considering).by, date: day(moved(considering).at), reason: moved(considering).reason }));
  assert.ok(row(suggested).textContent.includes(lead("question.reading.suggested")));
  assert.ok(says(row(held.current.version), "question.reading.standson", { project: "Stormwater" }));
  assert.ok(says(row(held.current.version), "question.reading.strength") && row(held.current.version).querySelector('[data-whatif="no"]'));
  assert.ok(says(row(suggested), "question.reading.whatif") && row(suggested).querySelector('[data-whatif="yes"]'));
  assert.ok(p.byOp("versionstrength").some((r) => r.query.version === suggested && r.query.states === "suggested"), "the what-if names the reading's own state");
  /* rejected and hidden: counted, shown on press (a details) */
  assert.ok(says(s, "question.readings.more", { rejected: "1", hidden: "0" }));
  assert.ok(s.querySelector(`[data-readings="more"] [data-reading="${rejected}"]`));
  /* the chooser: record data, defaulting to the project's CURRENT */
  assert.equal(p.doc.getElementById("question-reading").value, held.current.version);
  /* Stand on: offered only on an accepted reading, not the CURRENT, to a joined member */
  assert.deepEqual(s.querySelectorAll('button[data-act="versioncurrent"]').map((b) => b.closest("[data-reading]").getAttribute("data-reading")), [accepted]);
  await press(p, "versioncurrent", { within: row(accepted) });
  assert.deepEqual([p.byOp("versioncurrent")[0].body.version, p.byOp("versioncurrent")[0].body.project], [accepted, project]);
  /* each act sends its op with the version; Stand on with project; accept affirms every ground */
  await press(p, "versionaccept", { within: row(considering) });
  await press(p, "versionconsider", { within: row(suggested), reason: "worth weighing" });
  /* R64: Reject is a fold holding the required reason; with none it sends nothing */
  await press(p, "versionreject", { within: row(considering) });
  assert.equal(p.byOp("versionreject").length, 0, "no reason, nothing sent");
  fill(p, { [row(considering).querySelector('textarea[id^="question-reject-"]').getAttribute("id")]: "not enough on its own" });
  await press(p, "versionreject", { within: row(considering) });
  await press(p, "versionrevert", { within: row(rejected) });
  await press(p, "versionhide", { within: row(suggested) });
  const sent = { versionaccept: considering, versionconsider: suggested, versionreject: considering, versionrevert: rejected, versionhide: suggested };
  for (const [op, version] of Object.entries(sent)) assert.deepEqual([p.byOp(op)[0].body.version, p.byOp(op)[0].body.target], [version, made.question], op);
  assert.equal(p.byOp("versionreject")[0].body.reason, "not enough on its own");
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R25 controls: a machine-authored reading is drawn only while the assistant is reachable; a refusal is drawn by its words", async () => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  /* a reading suggested by the machine under a run (the world's recipe), the team's Claude account then switched off and on */
  const machine = await world.recipes.machineReading(admin, ann, project);
  await admin.act("groupkeyswitch", { body: { on: false } });
  const off = await pageOf(world, ann, machine.question);
  assert.equal(main(off).querySelector(`[data-reading="${machine.version}"]`), null);
  await admin.act("groupkeyswitch", { body: { on: true } });
  const on = await pageOf(world, ann, machine.question);
  const row = section(on, "question.readings.title").querySelector(`[data-reading="${machine.version}"]`);
  assert.ok(row && row.querySelector('.cs-origin[data-origin="machine"]'));
  /* a refusal by its words: a reading of two parts, once rejected and suggested again, accepted without naming each part */
  const a = await world.recipes.page(ann, "First count", { project }), b = await world.recipes.page(ann, "Second count", { project });
  const q = await world.recipes.question(ann, project, { title: "Two parts", legs: [{ target: a.bundle }, { target: b.bundle }], draw: true });
  await ann.act("inquiryground", { body: { target: q.id, grounds: [{ ground: "part 1", legs: [0] }, { ground: "part 2", legs: [1] }], reason: "my reading" } });
  await ann.act("conclude", { query: { target: q.id, project, reading: "Either count is enough.", falsifier: "The ledger says otherwise.", affirmed: "part 1,part 2" } });
  await ann.act("withdrawconclusion", { query: { target: q.id, project, reason: "to make the reading again" } });
  await ann.act("versionreject", { query: { target: q.id, version: "reading-1", reason: "it overreaches" } });
  await ann.act("versionrevert", { query: { target: q.id, version: "reading-1" } });
  const two = await pageOf(world, ann, q.id);
  const slot = await press(two, "versionaccept", { within: section(two, "question.readings.title").querySelector('[data-reading="reading-1"]') });
  assert.ok(says(slot, "refusal.VERSION_AFFIRMATION_INCOMPLETE", { part: "part 1" }), "VERSION_AFFIRMATION_INCOMPLETE by its words");
});

test("R26 what relies on this: a project with its reading, a question and a published case; out of view says so, and only then", async () => {
  const relies = { ok: true, target: Q, backlinks: [{ from: P, from_type: "project", from_title: "Pothole repairs" },
    { from: "INQ-2026-0020-reopen", from_type: "inquiry", from_title: "Reopened within a month?" },
    { from: "CASE-2026-0001", from_type: "case", from_title: "Street safety, 2026" }], out_of_view: true };
  const p = await open(at, { ...A, plane: { backlinks: ok(relies) } });
  const s = section(p, "question.relies.title");
  assert.ok(says(s, "question.relies.project", { reading: "main" }), "the reading the project stands on");
  assert.ok(s.querySelector(`a.cs-ref[href="/app/question/INQ-2026-0020-reopen"]`));
  assert.ok(says(s, "question.relies.cites", { kind: word("shell.card.question") }));
  assert.ok(s.textContent.includes("Street safety, 2026"));
  assert.ok(says(s, "question.relies.outofview"));
  /* control: with out_of_view absent, the sentence is not drawn; with nothing at all, no section */
  const n = await open(at, { ...A, plane: { backlinks: ok({ ...relies, out_of_view: undefined }) } });
  assert.ok(!says(section(n, "question.relies.title"), "question.relies.outofview"));
  const e = await open(at, A);
  assert.equal(section(e, "question.relies.title"), undefined);
});

test("R27 Concluding links the case's screens where a read names the question's case; control: none named, none linked", async () => {
  const p = await open(at, { ...A, plane: { backlinks: ok({ ok: true, target: Q, backlinks: [{ from: "CASE-2026-0001", from_type: "case", from_title: "Street safety" }] }) } });
  const c = section(p, "screen.question.concluding.head").querySelector('[data-case="CASE-2026-0001"]');
  for (const k of ["case.links.editor", "case.links.review", "case.links.ceremony", "case.links.docket"]) assert.ok(says(c, k), k);
  const n = await open(at, A);
  assert.equal(section(n, "screen.question.concluding.head").querySelector("[data-case]"), null);
});

test("R35 R41 R50 conclude is offered once a passage is cited, on a reading that stands or one she writes; before a citation it is not and what is owed is said", async () => {
  /* nothing cited: no Concluding section, the owed sentence beneath the three ways (R50) */
  const empty = await open(at, { images: { [Q]: { "bundle.md": inquiryMd(P, [], { legs: [] }) } } });
  assert.ok(says(main(empty), "question.empty.conclude.own"));
  assert.ok(!actsIn(main(empty)).includes("conclude") && section(empty, "screen.question.concluding.head") === undefined);
  /* cited, and no reading stands: the form is offered with her own reading as the choice (a reading made and set to be weighed) */
  const w = await stateWorld({ n: 1 });
  await w.ann.act("conclude", { query: { target: w.id, project: w.project, reading: "The count was 412.", falsifier: "The ledger says otherwise." } });
  await w.ann.act("withdrawconclusion", { query: { target: w.id, project: w.project, reason: "to weigh the reading first" } });
  await w.ann.act("versionconsider", { query: { target: w.id, version: "reading-1", reason: "we are weighing it" } });
  const none = await w.page();
  const c = section(none, "screen.question.concluding.head");
  assert.ok(actsIn(c).includes("conclude"));
  assert.equal(none.doc.getElementById("question-conclude-reading").value, "", "no reading stands: her own is the choice");
  /* cited, and a reading stands: accepted again, the project standing on it */
  await w.ann.act("versionaccept", { query: { target: w.id, version: "reading-1" } });
  const current = (await w.ann.read("basisversions", { query: { id: w.id, project: w.project } })).current;
  const p = await w.page();
  const form = section(p, "screen.question.concluding.head").querySelector('[data-conclude="form"]');
  assert.ok(form.hasAttribute("open"), "a reading stands: Conclude opens by itself");
  for (const k of ["question.conclude.reading", "question.conclude.falsifier", "question.conclude.nofalsifier", "question.conclude.commentary"]) assert.ok(says(form, k), k);
  fill(p, { "question-conclude-falsifier": "inspection records showing repair", "question-conclude-reason": "both counts agree", "question-conclude-commentary": "the counts agree" });
  await press(p, "conclude");
  const q = p.byOp("conclude")[0].query;
  assert.deepEqual([q.target, q.project, q.version, q.falsifier, q.commentary, q.reason], [w.id, w.project, current.version, "inspection records showing repair", "the counts agree", "both counts agree"]);
  assert.ok(!("reading" in q), "an accepted reading sends version, never reading");
  for (const r of p.requests) for (const k of ["by", "author", "viewer", "assist", "draft"])
    assert.ok(!(k in (r.query || {})) && !(r.body && typeof r.body === "object" && k in r.body), `${r.op} sends ${k}`);
});

test("R41 conclude's controls: an empty falsifier with the box unticked sends nothing; ticked, it sends no_falsifier", async () => {
  const w = await stateWorld({ n: 1 });
  await w.ann.act("conclude", { query: { target: w.id, project: w.project, reading: "The count was 412.", falsifier: "The ledger says otherwise." } });
  await w.ann.act("withdrawconclusion", { query: { target: w.id, project: w.project, reason: "to conclude it again" } });
  const p = await w.page();
  fill(p, { "question-conclude-falsifier": "", "question-conclude-reason": "why" });
  await press(p, "conclude");
  assert.equal(p.byOp("conclude").length, 0);
  p.doc.getElementById("question-conclude-none-0").checked = true;
  await press(p, "conclude");
  assert.equal(p.byOp("conclude")[0].query.no_falsifier, "1");
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R41 state c, new and empty: nothing cited yet, the three ways in; the capture link carries the question (R38)", async () => {
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 0 });
  const p = await w.page();
  const s = section(p, "question.empty.heading");
  for (const k of ["question.empty.note", "question.empty.capture", "question.empty.find", "question.empty.ask"]) assert.ok(says(s, k), k);
  assert.equal(s.querySelector('[data-adddoc="question"]').getAttribute("href"), "/app/capture/address/" + w.id);
  assert.deepEqual(actsIn(s).sort(), ["airunopen", "search"]);
  /* without the assistant reachable, no "Ask the assistant to look" */
  const bare = await stateWorld({ n: 0 });
  const off = await bare.page();
  assert.deepEqual(actsIn(section(off, "question.empty.heading")), ["search"]);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R41 state d: a run of hers at work, the run's words and Stop the run", async () => {
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 1 });
  await readNotice(w);
  const run = await openRun(w);
  const p = await w.page();
  const s = section(p, "question.run.heading");
  assert.ok(says(s, "question.run.leave"));
  await press(p, "airunclose", { within: s });
  assert.deepEqual(p.byOp("airunclose")[0].body, { run, bound: "cancelled" });
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R41 controls (D29): a run opened and withheld is never drawn at work; the withholding is said by its words", async () => {
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 0 });
  await readNotice(w);
  const p = await w.page();
  await press(p, "airunopen");
  assert.equal(section(p, "question.run.heading"), undefined, "never drawn at work");
  assert.ok(says(main(p).querySelector('[data-refusal="airundispatch"]'), "dock.withheld.AGENT_WORKER_UNBOUND"));
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R41 state e: the assistant's proposal, machine work, accepted or declined with a reason", async () => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  /* a reading suggested by the machine under a run (the world's recipe), as the member reads it */
  const machine = await world.recipes.machineReading(admin, ann, project);
  const proposed = (await ann.read("basisversions", { query: { id: machine.question, project } })).versions.find((v) => v.name === machine.version);
  const p = await pageOf(world, ann, machine.question);
  const s = section(p, "question.proposal.heading");
  assert.ok(s.querySelector('[data-origin="machine"]') && s.textContent.includes(proposed.description));
  /* the passage as the owner names it: basis-versions gives a reading's leg its target id and no title, and the page draws what it is given */
  assert.ok(s.textContent.includes(proposed.legs[0].target_title || proposed.legs[0].target_id));
  assert.ok(says(s.querySelector("details[data-reject] summary"), "screen.question.reject.summary"), "R64: the fold");
  assert.ok(says(s, "ai.progress.checked.all"), "R58: beneath the proposal");
  await press(p, "versionreject", { within: s });
  assert.equal(p.byOp("versionreject").length, 0, "R64: no reason, nothing sent");
  fill(p, { "question-reject-0": "it skips the audit" });
  await press(p, "versionreject", { within: s });
  assert.deepEqual([p.byOp("versionreject")[0].body.version, p.byOp("versionreject")[0].body.reason], [machine.version, "it skips the audit"]);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R41 R42 state f: the limit's words naming no cost, the note, and the other reasons; control: a reachable assistant draws none", async () => {
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 0 });
  await readNotice(w);
  const limit = { status: 200, json: { ok: true, result: { run: "x", started: false, code: "AI_LIMIT_REACHED", whose: "the team's", period: "monthly", when: "on 1 November" } } };
  const p = await w.page({ plane: { airunopen: limit } });
  assert.equal(main(p).querySelector('[data-reasons="question"]'), null, "nothing refused: no reasons drawn");
  await press(p, "airunopen");
  const f = section(p, "question.empty.ask");
  assert.ok(says(f, "ai.refused.limit.overall", { whose: "the team's", period: "monthly", when: "on 1 November" }));
  assert.ok(says(f, "question.limit.note") && says(f, "question.ai.other") && says(f, "question.ai.whose"));
  assert.ok(!/\$\d/.test(f.textContent), "no cost named");
  assert.equal(p.byOp("airundispatch").length, 0, "started: false dispatches nothing");
});

test("R41 state g: concluded, who and when, the reading's words, what would change it, its strength, withdraw and plan", async () => {
  /* a question resting on a passage graded on capture and a directory graded on connection (the two grades the page draws), concluded by her act */
  const w = await barredQuestion();
  const claim = "No: 1 in 10 is not repaired in time.", falsifier = "logs showing repairs dated later";
  await w.ann.act("conclude", { query: { target: w.id, project: w.project, reading: claim, falsifier } });
  const held = (await w.ann.read("basisversions", { query: { id: w.id, project: w.project } })).conclusion;
  assert.equal(held.by.replace(/^member:/, ""), w.ann.member, "who concluded, as the owner records it");
  const p = await pageOf(w.world, w.ann, w.id);
  const g = section(p, "question.concluded.heading");
  assert.ok(g.textContent.includes(lead("question.concluded.by")) && g.textContent.includes(w.ann.member) && g.textContent.includes(day(held.at)));
  assert.ok(g.textContent.includes(claim));
  assert.ok(says(g, "question.concluded.falsifier", { falsifier }));
  assert.equal(g.querySelectorAll(".cs-grade").length, 2, "the question's two grades: " + [w.strength.capture, w.strength.connection].map((x) => x.state).join(", "));
  assert.deepEqual(actsIn(g), ["casedraft", "planopen", "withdrawconclusion"], "R62: in this order");
  assert.ok(!actsIn(main(p)).includes("conclude"), "never a second conclusion");
  await press(p, "withdrawconclusion", { within: g, reason: "new evidence" });
  assert.deepEqual(p.byOp("withdrawconclusion")[0].query, { op: "withdrawconclusion", target: w.id, project: w.project, reason: "new evidence" });
  const after = await w.ann.read("basisversions", { query: { id: w.id, project: w.project } });
  assert.notEqual(after.conclusion_stance, "concluded", "her press withdrew the conclusion in the record");
});

test("R41 state g: concluded over a project is drawn from the read that names the project (basis-versions answers a conclusion only to it)", async () => {
  const concluded = { conclusion: { claim: { text: "No: 1 in 10 is not repaired in time." }, by: "member:dev", at: "2026-10-13T09:00:00Z" }, conclusion_stance: "concluded" };
  const basis = (withdrawn) => (r) => ok(BASIS(r.query.project ? { ...concluded, ...(withdrawn ? { conclusion_stance: "withdrawn" } : {}) } : {}));
  const p = await open(at, { ...A, plane: { basisversions: basis(false) } });
  const g = section(p, "question.concluded.heading");
  assert.ok(g.textContent.includes("No: 1 in 10 is not repaired in time.") && g.textContent.includes("dev"));
  assert.deepEqual(actsIn(g), ["casedraft", "planopen", "withdrawconclusion"]);
  assert.ok(p.byOp("basisversions").some((c) => c.query.project === P), "read with the project");
  /* control: the project's read answers the conclusion withdrawn: state g is not drawn */
  const w = await open(at, { ...A, plane: { basisversions: basis(true) } });
  assert.equal(w.root().querySelector("#state-g"), null);
});

test("R36 C63 after planopen, the question opens its plan page (fix round 3; it no longer stays to link it); control: a refused press opens none", async () => {
  const w = await stateWorld({ n: 1 });
  const p = await w.page();
  assert.equal(main(p).querySelector("[data-plan]"), null);
  fill(p, { "question-plan": "Ask the committee" });
  await press(p, "planopen");
  assert.deepEqual(p.byOp("planopen")[0].body, { project: w.project, title: "Ask the committee", subjects: [{ kind: "inquiry", inquiry: w.id }] });
  assert.match(p.location.pathname, /^\/app\/plan\/PLN-/, "the plan page is opened with the plan as subject");
  const plan = decodeURIComponent(p.location.pathname.slice("/app/plan/".length));
  const held = await w.ann.read("plans", { query: { project: w.project } });
  assert.ok(JSON.stringify(held).includes(plan) && JSON.stringify(held).includes("Ask the committee"), "the plan the page opened is the one the plane holds: " + JSON.stringify(held).slice(0, 300));
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R31 Read in my language sends the question as subject, the answer drawn in place and labeled, the original back by one press", async () => {
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 1 });
  await readNotice(w);
  const tr = ok({ ok: true, translation: "¿Repara la ciudad los baches en siete días?", language: "es", from_language: "English", original: { kind: "question", id: w.id } });
  const p = await w.page({ plane: { readtranslate: tr } });
  await press(p, "readtranslate");
  assert.deepEqual(p.byOp("readtranslate")[0].body, { subject: { kind: "question", id: w.id, project: w.project } });
  const shown = main(p).querySelector('[data-translation="shown"]');
  assert.ok(shown.textContent.includes("¿Repara la ciudad") && says(shown, "translate.label", { language: "English" }) && says(shown, "translate.label.help"));
  assert.ok(says(button(p, "readtranslate"), "translate.original"));
  await press(p, "readtranslate");
  assert.equal(main(p).querySelector('[data-translation="shown"]'), null, "the original back by one press");
  assert.equal(p.byOp("readtranslate").length, 1, "nothing read again, nothing saved");
  /* control: no control while the assistant is not reachable, and none on a passage */
  const bare = await stateWorld({ n: 1 });
  const off = await bare.page();
  assert.ok(!actsIn(main(off)).includes("readtranslate"));
  assert.equal(main(p).querySelectorAll('.cs-row button[data-act="readtranslate"]').length, 0, "no control on a passage");
  /* LANGUAGE_NOT_SET by its words */
  const ns = await w.page({ plane: { readtranslate: refusedIn("LANGUAGE_NOT_SET", "Choose your reading language first.") } });
  assert.ok(says(await press(ns, "readtranslate"), "refusal.LANGUAGE_NOT_SET"), "LANGUAGE_NOT_SET by its words");
});

test("R38 Add a document opens capture with the question as its subject", async () => {
  const p = await open(at, A);
  const a = section(p, "screen.question.supports.head").querySelector('[data-adddoc="question"]');
  assert.equal(a.getAttribute("href"), "/app/capture/address/" + Q);
  assert.ok(says(a, "question.adddoc"));
});

test("R39 no heading is a record id; a question with no words or title draws undetermined", async () => {
  const p = await open(at, A);
  for (const h of main(p).querySelectorAll("h1, h2")) assert.doesNotMatch(h.textContent, /PROJ-|INQ-|INFO-/);
  const bare = await open(at, { images: { [Q]: { "bundle.md": `---\nid: ${Q}\nobject_type: inquiry\n---\n` } } });
  assert.ok(main(bare).querySelector("h1").textContent.startsWith(lead("state.undetermined")));
});

test("R2 the other acts send what their owners take", async () => {
  const w = await stateWorld({ n: 1 });
  const p = await w.page();
  /* R87: Narrow is exercised in fr28-question.test.mjs (it reads the proposed parts first) */
  fill(p, { "question-hunch": "Inspections close them.", "question-hunch-kind": "flow" });
  await press(p, "hypothesishold");
  assert.deepEqual(p.byOp("hypothesishold")[0].body, { inquiry: w.id, kind: "flow", statement: "Inspections close them.", about: { from: w.docs[0], to: w.id } });
  fill(p, { "question-check": "engineering", "question-check-note": "the crew reports" });
  await press(p, "checkrequest");
  assert.deepEqual(p.byOp("checkrequest")[0].body, { target: w.id, label: "engineering", note: "the crew reports" });
  /* a document the member set aside that a question waits on (the world's recipe: a capture request drained, its copy promoted and set aside), in the same project */
  const aside = await w.world.recipes.setAside(w.ann, { project: w.project });
  const r = await w.page({ path: "/app/question/" + aside.question });
  await press(r, "heldrestore", { reason: "it is the right year after all" });
  assert.deepEqual(r.byOp("heldrestore")[0].body, { ids: [aside.document], reason: "it is the right year after all" });
});

test("R2 cite chooses its passage in Find in over the question's project; Find another source searches its words", async () => {
  const p = await open(at, A);
  await press(p, "cite");
  assert.equal(p.location.pathname, "/app/find-in/" + P);
  const s = await open(at, A);
  await press(s, "search", { within: section(s, "screen.question.waits.head") });
  assert.equal(decodeURIComponent(s.location.pathname), "/app/finder/Is the city repairing reported potholes within seven days?");
});

test("R2 controls: a hunch, a check and a narrowing with nothing written are refused by their words; a refused act keeps the form", async () => {
  const p = await open(at, { ...A, plane: { hypothesishold: ok(holdRefusals().HYPOTHESIS_NO_STATEMENT) } });
  assert.ok(says(await press(p, "hypothesishold"), "screen.question.hunch.empty"));
  assert.ok(says(await press(p, "checkrequest"), "screen.question.check.empty"));
  assert.equal(p.byOp("hypothesishold").length + p.byOp("checkrequest").length + p.byOp("narrow").length, 0);
  fill(p, { "question-hunch": "x" });
  const slot = await press(p, "hypothesishold");
  assert.ok(slot.textContent.includes(holdRefusals().HYPOTHESIS_NO_STATEMENT.translation), "the refusal in the words the owner gives it");
  assert.equal(p.doc.getElementById("question-hunch").value, "x");
});

test("R12 sever is drawn on each live leg (confirmed or proposed) and reinstate on each severed one; a severed leg stays in its section", async () => {
  const p = await open(at, A);
  const sup = section(p, "screen.question.supports.head"), cut = section(p, "screen.question.against.head");
  const rowOf = (sec, target) => sec.querySelectorAll(".cs-row").find((r) => r.querySelector(`a.cs-ref[href="/app/document/${target}"]`));
  assert.deepEqual(actsIn(rowOf(sup, D)), ["sever", "narrow"], "a confirmed leg (R87: and Narrow)");
  assert.deepEqual(actsIn(rowOf(sup, "INFO-2026-0005")), ["reinstate"], "a severed leg, still under Supports");
  assert.deepEqual(actsIn(rowOf(cut, "INFO-2026-0006")), ["sever", "narrow"], "a proposed leg");
  /* control: a leg the inquiry holds no reference to is offered neither */
  const bare = await open(at, { images: { [Q]: { "bundle.md": grouped().replace(`  - target: ${D}\n    rel: cites\n    status: confirmed\n`, "") } } });
  assert.deepEqual(actsIn(section(bare, "screen.question.supports.head").querySelectorAll(".cs-row").find((r) => r.querySelector(`a.cs-ref[href="/app/document/${D}"]`))), []);
});

test("R12 sever and reinstate select the leg's target, then act on the question as the citing object, with her reason", async () => {
  const w = await stateWorld({ n: 2 });
  const [live, gone] = w.docs;
  await severLeg(w, gone, "the wrong year's orders");
  const p = await w.page();
  await press(p, "sever", { reason: "it is the 2023 policy", within: section(p, "screen.question.supports.head") });
  /* the page re-reads what her press did: the first leg is severed now, so the leg she reinstates is the one severed before, named by its row */
  const rowOf = (pg, target) => section(pg, "screen.question.supports.head").querySelectorAll(".cs-row").find((r) => r.querySelector(`a.cs-ref[href="/app/document/${target}"]`));
  await press(p, "reinstate", { reason: "the orders were right after all", within: rowOf(p, gone) });
  assert.deepEqual(p.byOp("select").map((r) => r.body), [{ ids: [live] }, { ids: [gone] }]);
  const sv = p.byOp("sever")[0].query, rn = p.byOp("reinstate")[0].query;
  assert.deepEqual([sv.project, sv.reason], [w.id, "it is the 2023 policy"]);
  assert.deepEqual([rn.project, rn.reason], [w.id, "the orders were right after all"]);
  assert.ok(sv.handle && rn.handle && sv.handle !== rn.handle, "each selection is its own handle, the one the selection answered");
  /* the real record now holds what she did: the first leg severed, the second live again */
  const after = await w.page();
  assert.deepEqual(actsIn(rowOf(after, live)), ["reinstate"], "the first leg is severed now");
  assert.ok(actsIn(rowOf(after, gone)).includes("sever") && !actsIn(rowOf(after, gone)).includes("reinstate"), "the second leg is live again");
  /* controls: a selection refused sends no act and says so beside it */
  const s = await w.page({ plane: { select: refusedIn("SCOPE_TOO_LARGE") } });
  const slot = await press(s, "sever", { reason: "why", within: section(s, "screen.question.supports.head") });
  assert.ok(says(slot, "screen.question.leg.unselectable"));
  assert.equal(s.byOp("sever").length, 0);
});

test("R2 R39 (K3402) the question says who opened it, by handle from the record's first promotion; a cited passage is named by its words or its document's title, never its id", async () => {
  const w = await stateWorld({ n: 1, as: "dev", names: ["The 2026 performance report"] });
  /* a later promotion by another member (mai's own reading of the question) must not change who opened it */
  const mai = await w.world.signIn("mai", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: w.project }, body: {} });
  await mai.act("inquiryground", { body: { target: w.id, grounds: [{ ground: "part 1", legs: [0] }] } });
  const p = await w.page();
  const opened = day(new Date(w.world.now()).toISOString());
  const sub = main(p).querySelector(".mk-sub");
  assert.ok(sub.textContent.includes(word("screen.question.opened", { name: "dev", date: opened, project: "" }).trim()), "the opener filled: " + sub.textContent);
  assert.doesNotMatch(main(p).textContent, /\{name\}/);
  assert.ok(main(p).textContent.includes("The 2026 performance report"), "the document's title");
  for (const el of main(p).querySelectorAll("a.cs-ref, .rec, .mk-ev")) assert.doesNotMatch(el.textContent, new RegExp(w.docs[0]), "never the record id");
});
