/* The group's home (R1, R8, R9, R11, R17, R23, R25, R28–R31) on the real served page (interface-shell's harness) over the REAL store
   (store-request's `storeWorld()`, op-tables §5.3): the team, its members, projects, questions, invitations, requests and to-dos are made by the
   real acts, and every answer the page reads is the real store's, except where a test's point is an answer no act can make (each such place is
   named where it stands). What it reads, what it draws in each state, and the acts it offers run through the shell's kit, gate and re-reads.
   Every sentence is asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { hex, instant } from "../store-request/door.mjs";
import { counted } from "../interface-shell/harness.mjs";
import { open as openRaw, ok, refused, text, ops, button, press, beside, last, main, screen, settle, word, hasWord, dmy, inOrder, withScreens, SCREENS } from "./page.mjs";

const timeout = { timeout: 300000 };
/** The page at `path`, signed in as `as` over the world `w` (the world's door answers every op the plane table does not). */
const open = (w, as, path, plane = {}, o = {}) => openRaw(path, plane, { ...w.boot(as), ...o });
/** The world's own answer to a request, changed by `change` (the real answer with one field taken away or a row left out: for a test whose point is a
 *  shape the real answer has but this page must also read without). */
const through = (w, as, change) => counted(async (req) => {
  const a = await w.door(req, as);
  const result = a && a.json && a.json.result !== undefined ? a.json.result : null;
  if (result) change(result);
  return a;
});
const day = (iso) => String(iso).slice(0, 10);
/** An instant `n` days past the later of the world's clock and the wall clock (the store judges a grant's end by the wall's), in the record's stamp form. */
const ahead = (w, n) => new Date(Math.max(Date.now(), w.now()) + n * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");

/** A team: its founder, `rosa` (an administrator), `mai` (may start projects), named, by the real acts. `now: Date.now()` so the world's clock is the page's. */
async function team({ name = "Lakeshore Tenants", env = {}, ago = 0 } = {}) {
  const w = await storeWorld({ now: Date.now() - ago, env });
  const rosa = await w.signIn("rosa", { admin: true });
  const mai = await w.signIn("mai", { capabilities: ["contribute", "create_projects"] });
  if (name) await rosa.act("groupnameset", { body: { name } });
  return { w, rosa, mai };
}
/** A project with `n` questions drawn into it, by the real acts. Answers its id. */
async function projectWith(w, as, title, n) {
  const id = await w.recipes.project(as, title);
  if (n) await w.recipes.questions(as, id, n);
  return id;
}
const rowOf = (p, who) => main(p).querySelectorAll(".cs-row").find((r) => text(p, r).includes(who));

// A busy group's queue, as the plane answers it (R17): to-dos of kinds no act of the door raises by itself (a release notice stored by the
// updater, an action reminder, a reply clock, a monitored source that changed), so this one answer is the test's own. Every other read is the world's.
const QITEMS = [
  { id: "TSK-1", class: "OBLIGATION", kind: "check", summary: "Vouch for 3 photos", due: "2026-10-12", assignee: "rosa", assignee_role: "member",
    options: [], disposition: { instead: "taskresolve" }, subject: { kind: "bundle", id: "INF-7" } },
  { id: "OBLIGATION::update-ready::0.84.0", class: "OBLIGATION", kind: "update-ready", assignee: "rosa", assignee_role: "admin",
    detail: { version: "0.84.0", date: "2026-10-13", security: true }, options: [{ id: "updatelater" }] },
  { id: "TSK-2", class: "OBLIGATION", kind: "action-reminder", summary: "Send the follow-up letter", assignee: "unassigned", assignee_role: "admin", subject: { kind: "action", id: "ACT-1" } },
  { id: "CONDITION::b", class: "CONDITION", kind: "reply", summary: "A reply is due", subject: { kind: "action", id: "ACT-2" } },
  { id: "FINDING::source-modified::1", class: "FINDING", kind: "source-modified", title: "Lease amendment", summary: "B-1 changed (404)", subject: { kind: "bundle", id: "INF-1" } },
  { id: "FINDING::source-modified::2", class: "FINDING", kind: "source-modified", title: null, summary: "B-2 changed", subject: { kind: "bundle", id: "INF-2" } },
];
const BUSY_QUEUE = { queue: ok({ items: QITEMS, item_count: 6 }) };
const sections = (p) => main(p).querySelectorAll("section").map((x) => (x.querySelector("h2") ? x.querySelector("h2").textContent : x.getAttribute("data-front")));

/** A busy group over the real store: named; an administrator (rosa), members mai and dev, one invited; a place and two languages chosen; a monthly
 *  limit on the AI; three projects ("Pothole repairs" and "Odd" before the administrator's last look at Home, "The Coliseum lease" after), with
 *  1, 0 and 3 questions drawn. */
async function busy() {
  const { w, rosa, mai } = await team({ env: { VERSION: "0.83.0" } });
  const founder = await w.signIn("founder");
  await w.signIn("dev");
  await rosa.act("memberadd", { body: { memberId: "kay", cover: "a neighbour" } });
  await founder.act("grouplanguagesset", { body: { languages: ["en", "es"] } });
  await rosa.act("profilesset", { body: { profiles: ["oakland-alameda"] } });
  // (a limit in tokens: ai-use T53 refuses one in dollars on a team whose plan reports no money, as this world's is; LIMIT_UNIT_UNAVAILABLE)
  await rosa.act("ailimitset", { body: { owner: "group", scope: "overall", unit: "tokens", period: "month", amount: 60000 } });
  await projectWith(w, rosa, "Pothole repairs", 1);
  await projectWith(w, rosa, "Odd", 0);
  w.tick(Math.max(0, Date.now() - w.now()) + 2000);   // (the look is stamped by the world's clock, a project's change by the wall's: the world's is put past it, so the look follows every change made so far)
  await rosa.read("lookedsince");           // her look at Home: what changes after it is "since you last looked"
  w.tick(3_600_000);                        // (an hour on, her session has locked: she signs in again)
  const [rosa2, mai2] = [await w.signIn("rosa"), await w.signIn("mai")];
  const coliseum = await projectWith(w, rosa2, "The Coliseum lease", 3);
  return { w, rosa: rosa2, mai: mai2, founder, coliseum };
}

test("R17: Home reads the queue, projectlist, startfrom, lookedsince and groupidentity; to an administrator also memberlist, bootstrap, profiles, grouplanguages and aiuseovertime (group)", timeout, async () => {
  const { w, rosa, mai } = await team();
  const p = await open(w, mai, "/app");
  for (const op of ["queue", "projectlist", "startfrom", "lookedsince", "groupidentity"]) assert.ok(p.byOp(op).length >= 1, op);
  assert.equal(p.byOp("lookedsince").length, 1, "read once per visit");
  assert.equal(p.byOp("search").length, 0, "R8: no search over type:project");
  assert.equal(p.byOp("projectdirectory").length, 0, "R17 amends R1: no list of projects to join");
  for (const op of ["memberlist", "profiles", "grouplanguages", "aiuseovertime"]) assert.equal(p.byOp(op).length, 0, `control: ${op} is an administrator's`);
  const a = await open(w, rosa, "/app");
  for (const op of ["memberlist", "profiles", "grouplanguages"]) assert.equal(a.byOp(op).length, 1, op);
  assert.equal(a.byOp("bootstrap").length, 1, "R122: the Administration reading's bootstrap is answered from the page's one answer: one request");
  assert.equal(p.byOp("bootstrap").length, 1, "and one for a member's page");
  assert.equal(a.byOp("queue").filter((r) => r.query.count !== "true" && r.query.count !== "1").length, 1, "C14: one list read of the queue (the frame's own is the count)");
  assert.equal(a.byOp("aiuseovertime")[0].query.owner, "group");
});

test("R17, R28, R31: a busy home draws, in order, the strip, Needs you, Needs the group, each area at a glance, the projects, Since you last looked and What happened?", timeout, async () => {
  const { w, rosa } = await busy();
  const projects = (await rosa.read("projectlist")).projects;
  const changed = projects.find((x) => x.name === "The Coliseum lease").lastChange;
  // The month's use: no act of the door spends (a call to Claude is made by a run), so the real answer's use is 0 and a reading at zero
  // is not drawn (R17): the answer for a month with some use is the real one with that figure.
  const spent = through(w, rosa, (r) => { for (const period of r.periods) period.used = 31400; });
  const p = await open(w, rosa, "/app", { ...BUSY_QUEUE, aiuseovertime: spent }, { screens: withScreens("document") });
  await settle();
  assert.deepEqual(sections(p), [word("screen.home.needsyou"), word("screen.home.needsgroup"), word("screen.home.areas"), word("screen.home.projects"),
    word("screen.home.since"), word("door.front.head")]);
  const strip = main(p).querySelector(".mk-strip");
  const order = main(p).querySelectorAll(".mk-strip, h1, section");
  assert.ok(strip && order[0] === strip, "the strip comes first, above the heading and every block");
  // R31: the strip counts no item as overdue.
  assert.deepEqual(strip.querySelectorAll("a").map((a) => text(p, a)), [`2 ${word("screen.home.strip.you")}`, `4 ${word("screen.home.strip.group")}`]);
  const you = main(p).querySelectorAll("section")[0];
  // R28: a to-do on a document names the document, a reference (here untitled: it carries none), and its act by the act's label.
  assert.ok(you.querySelector('a.cs-ref[href="/app/document/INF-7"]'), "its subject is a reference to the document");
  assert.ok(you.querySelector('button[data-act="taskresolve"]').textContent.startsWith(word("act.taskresolve.label.home")), "its act is named by the act's label");
  // R19: the update to-do on Needs you, with its security mark, and "See what changes" opening `updates`.
  assert.ok(text(p, you).includes(word("home.update.ready", { version: "0.84.0", security: word("home.update.security") })));
  assert.ok(you.querySelector('a[href="/app/updates"]'));
  // Needs the group: whose move it is.
  const group = main(p).querySelectorAll("section")[1];
  assert.ok(inOrder(text(p, group), [word("screen.home.move.admin")]));
  assert.ok(text(p, group).includes(word("screen.home.move.anyone")));
  // R22: the two source notices are one item with their count, in members' words.
  assert.ok(text(p, group).includes(word("queue.source-modified.many", { n: "2" })));
  assert.doesNotMatch(text(p), /B-1|404/);
  // The four areas, each named as its reference; Since you last looked holds the project changed since then.
  const areas = main(p).querySelectorAll(".mk-ablock").map((b) => b.getAttribute("data-area"));
  assert.deepEqual(areas, ["investigation", "action", "members", "administration"]);
  // founder, rosa (administrators), mai, dev are the active members; kay is invited
  assert.equal(text(p, main(p).querySelector('[data-area="members"]')).replace(word("screen.home.area.members"), "").trim(),
    `4 ${word("screen.home.rd.members")}2 ${word("screen.home.rd.admins")}1 ${word("screen.home.rd.invited")}`);
  const version = (await rosa.read("bootstrap")).version, place = (await rosa.read("profiles")).profiles[0].name;
  const periods = (await rosa.read("aiuseovertime", { query: { owner: "group" } })).periods;
  assert.equal(periods.length, 1, "the one limit the administrator set");
  assert.ok(inOrder(text(p, main(p).querySelector('[data-area="administration"]')), [`${version} ${word("screen.home.rd.release")}`,
    word("screen.home.line.places", { places: place }), word("screen.home.line.languages", { languages: "English, español" })]));
  assert.ok(text(p, main(p).querySelector('[data-area="investigation"]')).includes(`3 ${word("screen.home.rd.projects")}4 ${word("screen.home.rd.questions")}`));
  const since = main(p).querySelectorAll("section")[4];
  assert.ok(inOrder(text(p, since), ["The Coliseum lease", word("screen.home.since.changed", { date: dmy(day(changed)) })]));
  assert.ok(!text(p, since).includes("Pothole repairs"), "changed before the last look: not drawn");
  assert.ok(!text(p, since).includes("Odd"), "nor the other project changed before it");
});

test("R17: controls: a reading at zero is not drawn, and an empty block is not drawn; a failed read is drawn failed in its block", timeout, async () => {
  const { w, rosa } = await team();
  await projectWith(w, rosa, "Pothole repairs", 0);
  const quiet = await open(w, rosa, "/app");
  await settle();
  assert.ok(!main(quiet).querySelector(".mk-strip"), "no strip with nothing to count");
  assert.ok(!text(quiet).includes(word("screen.home.needsyou")) && !text(quiet).includes(word("screen.home.needsgroup")));
  assert.doesNotMatch(text(quiet), /\b0 (questions?|need|to do)/);
  assert.ok(!main(quiet).querySelector('[data-area="action"]'), "an area with nothing to show is left out");
  // The failed reads are the point: the store answering nothing is not a state the world makes by an act.
  const failed = await open(w, rosa, "/app", { queue: refused("STORE_DID_NOT_ANSWER", null, 502), projectlist: refused("STORE_DID_NOT_ANSWER", null, 502), lookedsince: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelectorAll('[data-state="failed"]').length >= 3, "the queue, the projects and lookedsince each drawn failed");
  assert.ok(text(failed).includes(word("screen.home.needsyou")));
  assert.ok(text(failed).includes(word("screen.home.since")));
});

test("R17, R11: a new member's first visit (lookedsince answers null) draws no Needs you and no Since you last looked", timeout, async () => {
  const { w, rosa } = await team();
  await projectWith(w, rosa, "Pothole repairs", 1);
  const p = await open(w, rosa, "/app", BUSY_QUEUE);   // she has never looked at Home: the world's lookedsince answers null
  await settle();
  assert.equal((await rosa.read("lookedsince")).since !== null, true, "control: the page's visit recorded her look");
  assert.ok(!text(p).includes(word("screen.home.needsyou")) && !text(p).includes(word("screen.home.since")));
  assert.ok(text(p).includes(word("screen.home.needsgroup")), "the group's items are still drawn");
});

test("R23: the heading is the group's name, or \"Your group\" while none is set, never the slug", timeout, async () => {
  const { w, rosa } = await team({ name: null });
  const unnamed = await open(w, rosa, "/app");
  assert.equal(main(unnamed).querySelector("h1").textContent, word("shell.group.unnamed"));
  const slug = (await rosa.read("groupidentity")).group;
  assert.doesNotMatch(text(unnamed), new RegExp(slug));
  await rosa.act("groupnameset", { body: { name: "Lakeshore Tenants" } });
  const p = await open(w, rosa, "/app");
  assert.equal(main(p).querySelector("h1").textContent, "Lakeshore Tenants");
  // The group's description is drawn under its name (R1: from `groupidentity`). The real `groupidentity` answers none (its public projection holds
  // the name, the domain and the stake; the description is `groupdescription`'s), so the answer that carries one is the test's own: reported.
  const real = await rosa.read("groupidentity");
  const described = await open(w, rosa, "/app", { groupidentity: ok({ ...real, description: "Rents and leases on city land." }) });
  assert.match(text(described), /Rents and leases on city land\./);
});

test("R40, R17, R23, R11: an unnamed new team's home is headed \"Your team\", leads with \"Name your team\" as its primary button and draws the other steps in order, then What happened?, nothing else", timeout, async () => {
  const fresh = async () => { const w = await storeWorld({ now: Date.now() }); return { w, founder: await w.signIn("founder") }; };
  const { w, founder } = await fresh();
  const p = await open(w, founder, "/app");
  await settle();
  assert.deepEqual(sections(p), [word("home.ready.title"), word("door.front.head")]);
  assert.equal(main(p).querySelector("h1").textContent, word("shell.group.unnamed"));
  const steps = main(p).querySelectorAll("ol.mk-next li");
  assert.equal(steps.length, 4);
  const link = (li) => li.querySelector("a");
  assert.deepEqual([0, 1, 2].map((i) => [link(steps[i]).textContent, link(steps[i]).getAttribute("href"), link(steps[i]).getAttribute("data-tone")]),
    [[word("home.first.name"), "/app/group", "primary"], [word("screen.home.invite"), "/app/members", "quiet"], [word("screen.home.saywho"), "/app/group-identity", "quiet"]]);
  assert.equal(text(p, steps[1]).includes(word("screen.home.first.invite")), true);
  assert.equal(text(p, steps[2]).includes(word("screen.home.first.identity")), true);
  assert.equal(text(p, steps[3]), word("screen.home.first.project"));
  assert.equal(steps[3].querySelectorAll("a, button").length, 0, "the last step has no button of its own: the doors are its act");
  assert.ok(!main(p).querySelector(".mk-ablocks, .mk-strip"));
  // Controls: a named team draws no "Name your team" and the first of the rest is primary; a team with a project, or a second
  // active member, is not new.
  await founder.act("groupnameset", { body: { name: "Lakeshore Tenants" } });
  const named = await open(w, founder, "/app");
  await settle();
  assert.ok(!text(named).includes(word("home.first.name")));
  assert.equal(main(named).querySelector("ol.mk-next a").getAttribute("data-tone"), "primary");
  assert.equal(main(named).querySelector("ol.mk-next a").getAttribute("href"), "/app/members");
  const notNew = async (w2, as, plane = {}) => !main(await open(w2, as, "/app", plane)).querySelector("ol.mk-next");
  const withProject = await fresh();
  await withProject.w.recipes.project(withProject.founder, "Pothole repairs");
  assert.ok(await notNew(withProject.w, withProject.founder));
  const second = await fresh();
  await second.w.signIn("rosa", { admin: true });
  assert.ok(await notNew(second.w, second.founder));
  // The founder holds every capability, so a team of one whose member may not start projects is not a state an act makes: the member's session is the test's own.
  const lone = await fresh();
  const whoami = await lone.founder.read("whoami");
  assert.ok(await notNew(lone.w, lone.founder, { whoami: ok({ ...whoami, administer: false, capabilities: ["contribute"] }) }));
  assert.ok(await notNew(lone.w, lone.founder, { projectlist: refused("STORE_DID_NOT_ANSWER", null, 502) }));
});

test("R1, R8: each project the member sees is a reference opening project, with its stage ladder Forming, Investigating, Matured, Closed", timeout, async () => {
  const { w, rosa } = await team();
  const coliseum = await projectWith(w, rosa, "The Coliseum lease", 0);
  const pothole = await projectWith(w, rosa, "Pothole repairs", 0);
  await rosa.act("projectclose", { query: { project: pothole }, body: { reason: "resolved" } });
  const p = await open(w, rosa, "/app");
  const card = main(p).querySelectorAll(".cs-card, a.cs-ref").find((a) => a.textContent === "The Coliseum lease");
  assert.ok(card);
  const withProject = await open(w, rosa, "/app", {}, { screens: [...SCREENS, { id: "project", reads: () => ({}), acts: [], render: () => "" }] });
  const ref = main(withProject).querySelectorAll("a.cs-ref").find((a) => a.textContent === "The Coliseum lease");
  assert.equal(ref.getAttribute("href"), "/app/project/" + coliseum);
  const on = (l) => l.children.map((s) => s.getAttribute("class") === "on");
  const ladderOf = (page, name) => main(page).querySelectorAll(".cs-row").find((r) => text(page, r).includes(name)).querySelector(".cs-ladder");
  assert.equal(main(p).querySelectorAll(".cs-ladder").length, 2);
  assert.deepEqual(on(ladderOf(p, "The Coliseum lease")), [true, false, false, false]);
  assert.deepEqual(on(ladderOf(p, "Pothole repairs")), [true, true, true, true], "a closed project has every step on");
  assert.equal(ladderOf(p, "Pothole repairs").querySelector("[aria-current]").textContent, word("screen.home.stage.closed"));
  // The roster's stage is the project document's RECORDED state (project-roster R26), and the store writes only forming and closed there
  // (PROJECT_STAGE_COMPUTED: investigating and matured are derived, never recorded), so the two middle steps and a stage no step names cannot be
  // made by an act: the world's own list, with those two rows' stage the only thing the test sets (reported).
  const odd = await open(w, rosa, "/app", { projectlist: through(w, rosa, (r) => {
    r.projects.find((x) => x.id === coliseum).stage = "investigating";
    r.projects.find((x) => x.id === pothole).stage = "paused";
  }) });
  assert.equal(main(odd).querySelectorAll(".cs-ladder").length, 2);
  assert.deepEqual(on(ladderOf(odd, "The Coliseum lease")), [true, true, false, false]);
  assert.deepEqual(on(ladderOf(odd, "Pothole repairs")), [false, false, false, false], "an unknown stage draws no step on");
  assert.equal(ladderOf(odd, "The Coliseum lease").querySelector("[aria-current]").textContent, word("screen.home.stage.investigating"));
  assert.deepEqual(ladderOf(odd, "The Coliseum lease").children.map((s) => s.textContent), ["forming", "investigating", "matured", "closed"].map((s) => word(`screen.home.stage.${s}`)));
});

test("R8, R21, R25 (fix round 3, C14): each project's question count is its roster row's own, drawn with the project, picking the singular or plural key; a count at zero is not drawn; none is read project by project", timeout, async () => {
  const { w, rosa } = await team();
  await projectWith(w, rosa, "The Coliseum lease", 3);
  await projectWith(w, rosa, "Pothole repairs", 1);
  await projectWith(w, rosa, "Odd", 0);
  const p = await open(w, rosa, "/app");
  await settle();
  assert.equal(p.byOp("projectquestions").length, 0, "no per-project read (project-roster R42)");
  assert.ok(text(p).includes("The Coliseum lease" + word("screen.home.questions.many", { n: "3" })));
  assert.ok(text(p).includes("Pothole repairs" + word("screen.home.questions.one")), "R25: one question, the singular key");
  assert.ok(!text(p).includes(word("screen.home.questions.many", { n: "0" })));
});

test("R8: a project whose stage is null is drawn undetermined; a list answered truncated says more projects exist", timeout, async () => {
  const { w, rosa } = await team();
  await projectWith(w, rosa, "Unstaged", 0);
  // A project the store records no state for, and a list cut at its limit (200 projects), are not made by an act at a cost a test can bear
  // (every project is recorded forming): the world's own list, with that row's stage taken away and the list said cut, is the test's own (reported).
  const p = await open(w, rosa, "/app", { projectlist: through(w, rosa, (r) => { r.truncated = true; r.projects[0].stage = null; }) });
  await settle();
  assert.ok(text(p).includes("Unstaged" + word("state.undetermined", { reason: word("screen.home.stage.none") })));
  assert.equal(main(p).querySelectorAll(".cs-ladder [aria-current]").length, 0);
  assert.ok(text(p).includes(word("screen.home.truncated")));
  assert.ok(!text(await open(w, rosa, "/app")).includes(word("screen.home.truncated")), "control: not truncated, not said");
});

test("R1, R17 (interface-shell R10): Home's reads drawn loading, failed or with data; an empty read draws no block", timeout, async () => {
  const pend = { pending: true };
  const loading = await openRaw("/app", { groupidentity: pend, queue: pend, projectlist: pend, startfrom: pend, lookedsince: pend });
  assert.ok(main(loading).querySelectorAll('[data-state="loading"]').length >= 2);
  const { w, rosa } = await team();
  const empty = await open(w, rosa, "/app");
  for (const k of ["screen.home.needsyou", "screen.home.projects"]) assert.ok(!sections(empty).includes(word(k)), k);
  await projectWith(w, rosa, "Pothole repairs", 0);
  const failed = await open(w, rosa, "/app", { projectlist: refused("STORE_DID_NOT_ANSWER", "the store did not answer", 502) });
  assert.ok(main(failed).querySelectorAll('[data-state="failed"]').length >= 1);
  assert.ok(!text(failed).includes(word("projects.empty.sub")), "a failed read is never drawn as empty");
});

test("R17: an item's own acts on Home send their bodies and re-read the queue, never lookedsince", timeout, async () => {
  const { w, rosa, mai } = await team();
  const project = await w.recipes.project(rosa, "The Coliseum lease");
  const doc = await w.recipes.hold(rosa, "Lease amendment", "The lease was amended in March.", project);
  await rosa.act("projectinvite", { query: { projectId: project, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: project } });
  await rosa.act("checkrequest", { body: { target: doc.bundle, member: "mai", note: "Vouch for 3 photos" } });
  const task = (await mai.read("queue")).items.find((i) => i.kind === "check-requested");
  assert.ok(task, "the check asked of her is in her queue");
  await mai.read("lookedsince");   // she has looked before: a first visit draws no Needs you (R11)
  const p = await open(w, mai, "/app");
  await settle();
  await press(p, "taskresolve");
  assert.deepEqual(last(p, "taskresolve").body, { id: task.id });
  assert.equal(p.byOp("lookedsince").length, 1, "the look is read once per visit");
  assert.ok(p.byOp("queue").length >= 2, "the queue re-read");
  assert.ok(!(await mai.read("queue")).items.some((i) => i.id === task.id), "the real to-do is resolved");
});

test("R1, R25, R30: \"Start a project\" sends promote with the member's title as a new forming project, written as its title, and opens project on success", timeout, async () => {
  const { w, mai } = await team();
  const p = await open(w, mai, "/app");
  assert.ok(button(p, "promote").textContent.startsWith(word("project.start.go")), "the form's own act: its label, then the weight the shell draws");
  await press(p, "promote", { values: { "home-visibility-hidden": true, "home-title": "  Park bond oversight " } });
  const r = last(p, "promote");
  assert.equal(r.method, "POST");
  assert.equal(r.headers.Authorization, `Bearer ${mai.token}`);
  const body = r.body;
  assert.equal(body.base, null);
  assert.deepEqual([body.meta.object_type, body.meta.title, body.meta.current_state], ["project", "Park bond oversight", "forming"]);
  assert.match(body.snapKey, /^\d{8}T\d{6}Z_[0-9a-f]{8}$/);
  assert.equal(body.files[0].path, "bundle.md");
  // R25: the document names the title (every screen reads it), beside the objective.
  assert.match(body.files[0].text, /^---\nobject_type: project\ntitle: "Park bond oversight"\nobjective: "Park bond oversight"\ncurrent_state: forming\n/);
  assert.ok(body.files[0].text.includes(`Trigger: ${word("file.trigger.home")}\n`), "the session log's trigger is the keyed word, as text");
  assert.doesNotMatch(body.files[0].text, /^id:/m, "no id is sent: the project's id is minted (promotion R19)");
  assert.equal("owner" in body || "author" in body, false, "the owner is the door's stamp, never the page's");
  const made = (await mai.read("projectlist")).projects.find((x) => x.name === "Park bond oversight");
  assert.ok(made, "the real project is made, its owner the member");
  assert.equal(p.location.pathname, "/app/project/" + made.id);
  // A title with a quote or newline stays one YAML string.
  const q = await open(w, mai, "/app");
  await press(q, "promote", { values: { "home-visibility-hidden": true, "home-title": 'A "quoted"\ntitle' } });
  assert.match(last(q, "promote").body.files[0].text, /\ntitle: "A \\"quoted\\"\\ntitle"\n/);
});

test("R30, R80: the form asks the title and who can find it; neither choice is preselected; none chosen sends nothing and says so; choosing findable sends discoverable", timeout, async () => {
  const { w, mai } = await team();
  const dev = await w.signIn("dev");
  const p = await open(w, mai, "/app");
  const start = main(p).querySelector('details[data-start="project"]');
  const sel = start.querySelector("#home-visibility");
  assert.ok(start.querySelector("label[for=home-title]").textContent.includes(word("project.start.title")));
  assert.ok(start.textContent.includes(word("project.start.title.help")) && start.textContent.includes(word("project.visibility.start.later")));
  assert.deepEqual(sel.querySelectorAll("input[type=radio]").map((o) => o.parentNode.textContent.trim()), [word("project.visibility.start.hidden"), word("project.visibility.start.discoverable")]);
  assert.equal(sel.querySelectorAll("input[type=radio]").filter((o) => o.checked).length, 0, "R80: nothing is chosen for the member");
  const refusedBtn = await press(p, "promote", { values: { "home-title": "Parks" } });
  assert.equal(p.byOp("promote").length, 0, "R80: Start with neither chosen sends nothing");
  assert.ok(beside(p, refusedBtn).includes(word("project.visibility.start.required")), "R80: refused in place with the required key");
  const q = await open(w, mai, "/app");
  await press(q, "promote", { values: { "home-title": "Parks", "home-visibility-discoverable": true } });
  assert.equal(last(q, "promote").body.visibility, "discoverable");
  assert.ok((await dev.read("projectdirectory")).projects.some((x) => x.name === "Parks"), "the real project is findable");
  const h = await open(w, mai, "/app");
  await press(h, "promote", { values: { "home-title": "Parks, hidden", "home-visibility-hidden": true } });
  assert.equal(last(h, "promote").body.visibility, "hidden", "control: hidden, once chosen, is sent");
  assert.ok(!(await dev.read("projectdirectory")).projects.some((x) => x.name === "Parks, hidden"), "and the real project is not findable");
  // NAME_TAKEN is the real store's answer to a second project by the same name; PROJECT_VISIBILITY_NO_OWNER is the answer to a creation by a
  // machine credential, which a member's session never makes, so its refusal is the test's own.
  const taken = await open(w, mai, "/app");
  const b = await press(taken, "promote", { values: { "home-visibility-hidden": true, "home-title": "Parks" } });
  assert.equal(beside(taken, b).replace(/\s+/g, " "), word("refusal.NAME_TAKEN"), "NAME_TAKEN");
  const t = await open(w, mai, "/app", { promote: refused("PROJECT_VISIBILITY_NO_OWNER", null, 409) });
  const c = await press(t, "promote", { values: { "home-visibility-hidden": true, "home-title": "Parks" } });
  assert.equal(beside(t, c).replace(/\s+/g, " "), word("refusal.PROJECT_VISIBILITY_NO_OWNER"), "PROJECT_VISIBILITY_NO_OWNER");
});

test("R1, R25: control: with no title nothing is sent and the member is told in the screen's words; a refusal is drawn beside the act", timeout, async () => {
  const { w, rosa, mai } = await team();
  await w.recipes.project(rosa, "Parks");
  const p = await open(w, mai, "/app");
  const b = await press(p, "promote", { values: { "home-title": "   " } });
  assert.equal(p.byOp("promote").length, 0);
  assert.equal(beside(p, b), word("screen.home.title.needed"));
  const t = await open(w, mai, "/app");
  const c = await press(t, "promote", { values: { "home-visibility-hidden": true, "home-title": "Parks" } });
  assert.equal(beside(t, c), word("refusal.NAME_TAKEN"));
  assert.equal(t.doc.getElementById("home-title").value, "Parks", "the form keeps what the member typed (interface-shell R13)");
  assert.equal(t.location.pathname, "/app");
});

test("R1 (interface-shell R12): \"Start a project\" is drawn only to a session that may contribute", timeout, async () => {
  const { w } = await team();
  const zed = await w.signIn("zed", { capabilities: [] });
  const p = await open(w, zed, "/app");
  assert.ok(!ops(p).includes("promote"));
  assert.ok(!text(p).includes(word("act.promote.label.home")), "nor its disclosure");
  assert.ok(screen("home"));
});


// The front doors as startfrom answers them (wizard-scripts R23, R33, R37): the world's own answer offers every door's scripts, so every door is drawn,
// the sixth last. A door `startfrom` leaves out (no script offered it), and a team offered no script at all, are answers no act of the door makes (the
// scripts are the library's, offered to every member who may see them); `DOORS` is that answer, the test's own, where a test needs it (reported):
// "Follow the money" not offered, so `money` names only "Pull the file"; `person` and `read` left out (no script offered); the sixth door last.
const DOORS = ok({ ok: true,
  scripts: [
    { id: "WIZ-cb0ad18a17a04233", version: 2, name: "Pull the file", start: "request" },
    { id: "WIZ-33b5887790b7561b", version: 1, name: "Trace the deed", start: "finder" },
  ],
  doors: [
    { door: "problem", scripts: ["WIZ-33b5887790b7561b", "WIZ-cb0ad18a17a04233"] },
    { door: "money", scripts: ["WIZ-cb0ad18a17a04233"] },
    { door: "tip", scripts: [] },
    { door: "elsewhere", scripts: [], opens: "elsewhere" },
  ] });
const doorOf = (p, door) => main(p).querySelector(`[data-door="${door}"]`);
const doorOps = (p, door) => doorOf(p, door).querySelectorAll("button[data-script]").map((b) => [b.dataset.script, b.dataset.version]);
/** What the world's `startfrom` answers a member: its doors with a script, and its scripts by id. */
const startOf = async (as) => { const r = await as.read("startfrom"); return { doors: r.doors, byId: new Map(r.scripts.map((s) => [s.id, s])) }; };

test("R9, R14, R40: \"What happened?\" draws each door startfrom answers as a button, the sixth door last; a door left out is not drawn", timeout, async () => {
  const { w, mai } = await team();
  const { doors } = await startOf(mai);
  const p = await open(w, mai, "/app");
  assert.equal(p.byOp("startfrom").length, 1);
  const sec = main(p).querySelector('[data-front="doors"]');
  assert.ok(text(p, sec).startsWith(word("door.front.head") + word("door.front.intro")));
  assert.deepEqual(main(p).querySelectorAll(".mk-door").map((d) => d.getAttribute("data-door")), doors.map((d) => d.door), "each door the world answers, the sixth last");
  assert.equal(doors.at(-1).door, "elsewhere");
  // R25: each card's title (the button) and its description are two elements.
  const card = doorOf(p, "problem");
  assert.ok(card.querySelector("button").textContent.startsWith(word("door.front.problem.name")));
  assert.equal(card.querySelectorAll("span").at(-1).textContent, word("door.front.problem.hint"));
  assert.deepEqual(doorOf(p, "elsewhere").querySelectorAll("b, span").map((c) => c.textContent), [word("door.front.elsewhere.name"), word("door.front.elsewhere.hint")]);
  // R40: no free-text box beside the doors, and no separate "Start from…" button.
  assert.ok(!p.doc.getElementById("home-words"));
  assert.ok(!main(p).querySelectorAll("button[data-act=startfrom]").some((b) => b.textContent.startsWith(word("act.startfrom.label.home"))));
  // A door the answer leaves out is not drawn (the answer is `DOORS`: person, read and, with no script, tip are not drawn).
  const left = await open(w, mai, "/app", { startfrom: DOORS });
  assert.deepEqual(main(left).querySelectorAll(".mk-door").map((d) => d.getAttribute("data-door")), ["problem", "money", "elsewhere"], "person, read and tip (no script) are not drawn");
});

test("R40: pressing a door sends startfrom for it and opens its offer in place; no script name is drawn before that", timeout, async () => {
  const { w, mai } = await team();
  const { doors, byId } = await startOf(mai);
  const p = await open(w, mai, "/app");
  assert.equal(main(p).querySelectorAll("button[data-script]").length, 0, "no script name before a press");
  for (const s of byId.values()) assert.ok(!text(p).includes(s.name), `no script name before a press: ${s.name}`);
  await press(p, "startfrom", { nth: 0 });
  // R81: the door is page memory; `startfrom` takes no `door` (the guard, over the owner's declaration), so the press sends it bare.
  assert.ok(p.byOp("startfrom").length >= 2 && p.byOp("startfrom").every((r) => r.query.door === undefined), "startfrom is sent on the press with no door field");
  const first = doors[0];
  assert.deepEqual(doorOps(p, first.door).map(([id]) => id), first.scripts);
  assert.equal(doorOps(p, first.door).length, first.scripts.length);
  const second = doors[2];
  assert.deepEqual(doorOps(p, second.door), [], "only the pressed door is open");
  // Control: the money door names only what startfrom names.
  await p.click(doorOf(p, "money").querySelector("button"));
  await settle();
  assert.deepEqual(doorOps(p, "money").map(([id]) => id), doors.find((d) => d.door === "money").scripts);
});

test("R14, R16: with no script offered, the sixth door alone is drawn, so the section is always drawn; its press opens elsewhere, starts no script and sends nothing", timeout, async () => {
  const { w, mai } = await team();
  // A team offered no script at all is an answer no act of the door makes (the library's scripts are offered to every member): the world's own answer
  // with its scripts taken away, and every door but the sixth (which the store answers to every viewer, and whose `opens` is its own) with them (reported).
  const p = await open(w, mai, "/app", { startfrom: through(w, mai, (r) => { r.scripts = []; r.doors = r.doors.filter((d) => d.door === "elsewhere"); }) }, { guide: GUIDE });
  assert.deepEqual(main(p).querySelectorAll(".mk-door").map((d) => d.getAttribute("data-door")), ["elsewhere"]);
  assert.ok(main(p).querySelector('[data-front="doors"]'));
  const door = doorOf(p, "elsewhere");
  assert.equal(door.getAttribute("href"), "/app/elsewhere");
  const acts = () => p.requests.filter((r) => r.method === "POST").length;
  const before = acts();
  await p.click(door);
  await settle();
  assert.equal(p.location.pathname, "/app/elsewhere");
  assert.equal(acts(), before, "no act is sent");
  assert.equal(p.byOp("wizardprogress").length, 0);
  assert.equal(p.doc.getElementById("started"), null, "no script started");
});

test("R9: startfrom failed is drawn failed in its block; startfrom is a drawn act once it answers doors with scripts", timeout, async () => {
  const { w, mai } = await team();
  const failed = await open(w, mai, "/app", { startfrom: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelector('[data-front="doors"] [data-state="failed"]'));
  const p = await open(w, mai, "/app");
  assert.ok(ops(p).includes("startfrom"));
});

// A guide standing in for screens-wizards' runner (interface-shell R31): it draws in the dock which script it was started on.
const GUIDE = {
  words: [],
  acts: [],
  render(cs, view) { return view.ui.running ? '<p id="started">' + cs.esc(view.ui.running + "@" + view.ui.version) + "</p>" : ""; },
  start(cs, view, o) { view.ui.running = o.script; view.ui.version = o.version; },
};

test("R9: a door's script starts in the wizard runner (cs.wizard) at its version, and sends nothing", timeout, async () => {
  const { w, mai } = await team();
  const { doors } = await startOf(mai);
  const p = await open(w, mai, "/app", {}, { guide: GUIDE });
  await press(p, "startfrom", { nth: doors.findIndex((d) => d.door === "money") });
  const before = p.requests.filter((r) => r.query.op !== "bootstrap").length;
  const script = main(p).querySelector('[data-door="money"] button[data-script]');
  assert.equal(script.dataset.script, doors.find((d) => d.door === "money").scripts[0]);
  await p.click(script);
  await settle();
  assert.equal(p.doc.getElementById("started").textContent, `${script.dataset.script}@${script.dataset.version}`, "the runner holds that script at that version");
  assert.equal(p.requests.filter((r) => r.query.op !== "bootstrap").length, before, "starting a script sends no op");
});

test("R9, R23, R40: beside the doors, the blank start, \"Start a project\" opening its title field on press; no free-text box and no matching work", timeout, async () => {
  const { w, mai } = await team();
  const p = await open(w, mai, "/app");
  assert.ok(text(p).includes(word("door.front.blank")));
  const start = main(p).querySelector('details[data-start="project"]');
  assert.equal(text(p, start.querySelector("summary")), word("act.promote.label.home"), "the act's own words");
  assert.equal(start.getAttribute("open"), null, "never an always-open field");
  assert.ok(start.querySelector("#home-title") && start.querySelector('button[data-act="promote"]'));
  assert.ok(!p.doc.getElementById("home-words"), "no free-text box");
  assert.equal(p.byOp("search").length, 0, "no matching work is searched");
  assert.ok(start.querySelector('button[data-act="promote"]').getAttribute("data-tip").includes(String(word("act.promote.here.home")).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;")), "the act explains itself by its Home key");
});

/** A team in which mai is in "The Coliseum lease" and invited to each of `titles`, by the real acts (rosa invites; the invitation reaches mai's queue as
 *  the real to-do), and in which she has looked at Home before (a first visit draws no Needs you, R11). */
async function invitedTeam(titles = ["Library hours", "Park lights"]) {
  const { w, rosa, mai } = await team();
  const coliseum = await w.recipes.project(rosa, "The Coliseum lease");
  await rosa.act("projectinvite", { query: { projectId: coliseum, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: coliseum } });
  const invited = [];
  for (const title of titles) {
    const id = await w.recipes.project(rosa, title);
    await rosa.act("projectinvite", { query: { projectId: id, handle: "mai" } });
    invited.push(id);
  }
  await mai.read("lookedsince");
  return { w, rosa, mai, coliseum, invited };
}
/** The queue as the world answers it, the invitations to projects left out (a queue that does not hold them: the reading of a project's participants is
 *  then the only way the page can know she is invited). */
const withoutInvitations = (w, as) => through(w, as, (r) => { if (Array.isArray(r.items)) r.items = r.items.filter((i) => i.kind !== "project-invitation"); });
/** The projects as the world answers them, each row without the member's participation (project-roster N1118), as an older roster answered. */
const withoutParticipation = (w, as) => through(w, as, (r) => { for (const p of r.projects || []) delete p.participation; });

test("R29: a project the member is invited to is hers to do on Home, with Join (projectjoin), as the project's participants answer her place; a joined project offers none", timeout, async () => {
  // A project row that answers the member's participation itself (N1118) is taken at its word, and read no further.
  const told = await invitedTeam(["Library hours"]);
  const [library] = told.invited;
  const t = await open(told.w, told.mai, "/app", { queue: withoutInvitations(told.w, told.mai) }, { screens: withScreens("project") });
  await settle();
  assert.ok(t.byOp("projectparticipants").length === 0 && main(t).querySelector('button[data-act="projectjoin"]'));
  // A roster that does not state it: the member's own row in each project's participants is read.
  const { w, mai, coliseum, invited } = await invitedTeam(["Library hours"]);
  const plane = { projectlist: withoutParticipation(w, mai), queue: withoutInvitations(w, mai) };
  const p = await open(w, mai, "/app", plane, { screens: withScreens("project") });
  await settle();
  const you = main(p).querySelectorAll("section")[0];
  assert.equal(you.querySelector("h2").textContent, word("screen.home.needsyou"));
  const join = you.querySelector('button[data-act="projectjoin"]');
  assert.ok(join && join.textContent.startsWith(word("act.projectjoin.label.home")));
  assert.ok(you.querySelector(`a.cs-ref[href="/app/project/${invited[0]}"]`), "the project is a reference");
  assert.equal(main(p).querySelectorAll('button[data-act="projectjoin"]').length, 1, "control: the joined project offers none");
  assert.deepEqual(p.byOp("projectparticipants").map((r) => r.query.projectId).sort(), [coliseum, invited[0]].sort(), "each project's participants read once");
  await press(p, "projectjoin");
  assert.equal(last(p, "projectjoin").query.projectId, invited[0]);
  assert.ok(p.byOp("projectlist").length >= 2, "the projects are read again");
  assert.equal(p.byOp("lookedsince").length, 1);
  assert.equal((await mai.read("projectlist")).projects.find((x) => x.id === invited[0]).participation, "joined", "she joined");
  // Controls: a read that failed, or one holding no row of hers, offers nothing on a guess.
  const c = await invitedTeam(["Library hours"]);
  const failed = await open(c.w, c.mai, "/app", { projectlist: withoutParticipation(c.w, c.mai), queue: withoutInvitations(c.w, c.mai),
    projectparticipants: refused("STORE_DID_NOT_ANSWER", null, 502) });
  await settle();
  assert.equal(main(failed).querySelectorAll('button[data-act="projectjoin"]').length, 0);
  const none = await open(c.w, c.mai, "/app", { projectlist: withoutParticipation(c.w, c.mai), queue: withoutInvitations(c.w, c.mai),
    projectparticipants: through(c.w, c.mai, (r) => { r.participants = (r.participants || []).filter((x) => x.handle !== "mai"); }) });
  await settle();
  assert.equal(main(none).querySelectorAll('button[data-act="projectjoin"]').length, 0);
});

test("R28: a to-do names its subject by its title, a reference, and its act by the act's label; a subject with no title draws the untitled word", timeout, async () => {
  const items = [
    { id: "TSK-1", class: "OBLIGATION", kind: "check", summary: "https://example.org/permit.pdf", assignee: "mai", assignee_role: "member", options: [],
      disposition: { instead: "taskresolve" }, subject: { kind: "bundle", id: "INF-7", title: "Permit application" } },
    { id: "TSK-2", class: "OBLIGATION", kind: "check", summary: "INF-9", assignee: "mai", assignee_role: "member", options: [],
      disposition: { instead: "taskresolve" }, subject: { kind: "bundle", id: "INF-9" }, age: { since: "2026-10-03T00:00:00Z" } },
  ];
  const { w, mai } = await team();
  await mai.read("lookedsince");
  const p = await open(w, mai, "/app", { queue: ok({ items, item_count: 2 }) }, { screens: withScreens("document") });
  const you = main(p).querySelectorAll("section")[0];
  const [titled, bare] = you.querySelectorAll(".cs-row");
  assert.ok(titled.querySelector('a.cs-ref[href="/app/document/INF-7"]').textContent === "Permit application", "the title, a reference to the document");
  assert.ok(titled.querySelector('button[data-act="taskresolve"]').textContent.startsWith(word("act.taskresolve.label.home")));
  assert.doesNotMatch(text(p, titled), /https?:/, "never a bare address");
  assert.equal(bare.querySelector("a.cs-ref").textContent, word("queue.source.untitled", { date: dmy("2026-10-03") }), "control: no title, the untitled word");
  assert.doesNotMatch(text(p, bare), /INF-9/);
});

test("R31: a reply owed by another side whose date has passed is drawn \"no reply recorded\", never \"overdue\"; the strip counts no item as overdue", timeout, async () => {
  const items = [{ id: "CONDITION::c", class: "CONDITION", kind: "action-clock-overdue.theirs", assignee: "unassigned", assignee_role: "member",
    fills: { office: "Public Works", what: "send the records", date: "2026-10-02" }, due: "2026-10-02", subject: { kind: "action", id: "ACT-5" } },
  { id: "TSK-3", class: "OBLIGATION", kind: "check", summary: "Late to-do", due: "2026-10-01", assignee: "mai", assignee_role: "member", options: [], disposition: { instead: "taskresolve" } }];
  const { w, mai } = await team();
  await mai.read("lookedsince");
  const p = await open(w, mai, "/app", { queue: ok({ items, item_count: 2 }) });
  await settle();
  assert.ok(text(p).includes(word("action.noreply.title", { date: dmy("2026-10-02") })));
  assert.doesNotMatch(text(p), /overdue/i, "control: no drawn text contains it");
  assert.doesNotMatch(main(p).querySelector(".mk-strip").textContent, /overdue/i);
  assert.ok(text(p).includes(dmy("2026-10-01")), "a passed date of the group's own is drawn with its date and no word");
});

test("R34: every key Home reads is a word of the list, and what it draws for a sample of its keys equals word(key, vars)", timeout, async () => {
  for (const k of screen("home").words) assert.ok(hasWord(k), k);
  assert.ok(!screen("home").words.includes("screen.home.strip.overdue"), "DEC-256's retired row is not read");
  const { w, rosa } = await team();
  await projectWith(w, rosa, "Pothole repairs", 1);
  await rosa.read("lookedsince");
  const p = await open(w, rosa, "/app", BUSY_QUEUE);
  await settle();
  for (const k of ["screen.home.needsyou", "screen.home.areas", "door.front.head", "door.front.intro", "door.front.elsewhere.name", "door.front.elsewhere.hint"])
    assert.ok(text(p).includes(word(k)), k);
});

// C74, C96 (fix round 2): an invitation is drawn once, its Join says which project, and a row's Open opens its subject.
test("R29, C74: a project the member is invited to is one row on Home though the queue holds its invitation too; an invitation the list does not know is drawn from the queue", timeout, async () => {
  const { w, mai, invited } = await invitedTeam();
  assert.ok((await mai.read("queue")).items.filter((i) => i.kind === "project-invitation").length === 2, "the real queue holds both invitations too");
  const p = await open(w, mai, "/app", {}, { screens: withScreens("project") });
  await settle();
  const joins = main(p).querySelectorAll('button[data-act="projectjoin"]');
  assert.equal(joins.length, 2, "each invited project once, not twice");
  assert.deepEqual(joins.map((b) => b.dataset.project).sort(), [...invited].sort());
  assert.ok(!text(p).includes(word("queue.project-invitation.detail")) || main(p).querySelectorAll("section")[0].querySelectorAll(".cs-row").length === 2, "one row for each project in Needs you");
  assert.equal(main(p).querySelectorAll("section").filter((s) => s.querySelector("h2") && s.querySelector("h2").textContent === word("screen.home.needsgroup")).length, 0, "and none under Needs the group");
  // Control: the project is not in the list the member is invited to, so the queue's own invitation is the one drawn.
  const one = await invitedTeam(["Park lights"]);
  const joined = through(one.w, one.mai, (r) => { r.projects = (r.projects || []).filter((x) => x.participation === "joined"); });
  const only = await open(one.w, one.mai, "/app", { projectlist: joined }, { screens: withScreens("project") });
  await settle();
  assert.equal(main(only).querySelectorAll('button[data-act="projectjoin"]').length, 1);
  assert.equal(main(only).querySelector('button[data-act="projectjoin"]').dataset.project, one.invited[0]);
});

test("R29, C96: two invitations draw two distinct labels, each naming its project", timeout, async () => {
  const { w, mai } = await invitedTeam();
  const p = await open(w, mai, "/app", {}, { screens: withScreens("project") });
  await settle();
  const labels = main(p).querySelectorAll('button[data-act="projectjoin"]').map((b) => b.getAttribute("aria-label"));
  assert.equal(labels.length, 2);
  assert.equal(new Set(labels).size, 2, "distinct");
  assert.ok(labels.some((l) => l.includes("Library hours")) && labels.some((l) => l.includes("Park lights")));
  assert.ok(labels.every((l) => l.startsWith(word("act.projectjoin.label.home"))), "the label's own word leads");
  // Control: a joined project offers none; the queue's invitation for a project with a name is told apart the same way.
  const empty = through(w, mai, (r) => { r.projects = []; });
  const item = await open(w, mai, "/app", { projectlist: empty }, { screens: withScreens("project") });
  await settle();
  const two = main(item).querySelectorAll('button[data-act="projectjoin"]').map((b) => b.getAttribute("aria-label"));
  assert.equal(two.length, 2);
  assert.equal(new Set(two).size, 2);
});

test("R17, C74: a row's Open opens its subject's screen; a subject that opens nothing draws no Open, not a link to the queue", timeout, async () => {
  const items = [
    { id: "CONDITION::a", class: "CONDITION", kind: "reply", summary: "A reply is due", subject: { kind: "action", id: "ACT-2" } },
    { id: "CONDITION::b", class: "CONDITION", kind: "request-awaiting", summary: "A request is awaited", subject: { kind: "capture_request", id: "CR-1" } },
  ];
  const { w, mai } = await team();
  const p = await open(w, mai, "/app", { queue: ok({ items, item_count: 2 }) }, { screens: withScreens("action") });
  await settle();
  const rowOf2 = (needle) => main(p).querySelectorAll(".cs-row").find((r) => text(p, r).includes(needle));
  const opens = (r) => r.querySelectorAll("a[data-nav]").filter((a) => a.textContent === word("screen.home.open")).map((a) => a.getAttribute("href"));
  assert.deepEqual(opens(rowOf2("A reply is due")), ["/app/action/ACT-2"], "its subject's screen");
  assert.deepEqual(opens(rowOf2("A request is awaited")), [], "no Open to the queue");
});

// R64: Home's remaining readings, over the real store: documents held, people the record follows, actions with clocks running, members' expertise and
// the security level are all made by the real acts, and so are the cases published in editions (`recipes.published`, the real ceremony) and the drafts of a
// case shared for review with a link a recipient holds (`casedraft`, `reviewgrant`, and the recipient's own `reviewcomment` under the grant's secret): `cases`.
// One of the door's answers is the real one only through a stand-in for the door's stamp, because the world's door and the Worker's part on it (reported):
// `reviewcopy` of a member's session is stamped with her viewer by the
// Worker's door while the world's door stamps none (store-request/door.mjs `publicAnswer`), so the store is asked as the Worker's door asks it for her.
const EDITION_CASES = (cases) => ok({ bundles: [], cases });
const copyOf = (w, as) => counted(async (req) => {
  const got = await w.send({ url: `http://do/reviewcopy?draft=${encodeURIComponent(req.query.draft)}&viewer=${encodeURIComponent("member:" + as.handle)}`, headers: {}, method: "GET" });
  return ok((await got.json()).result);
});
const editions = (w, as, over = {}) => ({ reviewcopy: copyOf(w, as), ...over });

/** Two cases of `project` published by the real ceremony, the first in two editions (a reopened and re-concluded finding, its second edition saying what changed), the
 *  second in one, the second published last; and three drafts of them shared for review: one of the first (a live grant and, beyond it, a later one withdrawn), one of the
 *  second (a live grant and a recipient's comment under it) and one of no case yet (a new one). `as` owns the project. Answers the cases' ids, the names Home draws for them
 *  (each edition's scope), the instants they were published, the drafts, every grant, and the end of each live grant. */
async function cases(w, as, project) {
  const first = await w.recipes.finding(as, project, { title: "The Coliseum rent" });
  await w.recipes.published(as, { ...first, publish: { ...first.publish, body: { ...first.publish.body, scope: "The Coliseum lease, as first read" } } });
  const one = (await as.read("publishedlist")).cases[0].case_id;
  await as.act("reopen", { query: { target: first.id, reason: "The lease was amended." } });
  await as.act("conclude", { query: { target: first.id, reading: "The rent rose in 2026, and again in 2027.", falsifier: "The ledger shows no second rise." } });
  await w.tick(120_000);
  await w.recipes.published(as, { ...first, publish: { ...first.publish, body: { ...first.publish.body, caseId: one, scope: "The Coliseum lease",
    whatChanged: { text: "The lease was amended and the rent rose again." }, statement: "This case does not cover rent paid after the amendment's date.",
    subjectJustification: "The question still concerns only the city's own lease.", biasAcknowledgement: "We still favour a rent the city can bear.",
    excluded: [{ description: "Rent paid by the sub-tenants.", reason: "The city keeps no record of it." }] } } });
  const second = await w.recipes.finding(as, project, { title: "Pothole repairs", reading: "Reported potholes are repaired within seven days." });
  await w.recipes.published(as, { ...second, publish: { ...second.publish, body: { ...second.publish.body, scope: "Pothole repairs" } } });
  const listed = (await as.read("publishedlist")).cases;
  const other = listed.find((c) => c.case_id !== one).case_id;
  const at = (id, edition) => listed.find((c) => c.case_id === id && c.edition === edition).published_at;
  const draft = async (body) => (await as.act("casedraft", { body: { project, ...body } })).draftId;
  const grant = async (d, days) => { const until = ahead(w, days); return { until, ...(await as.act("reviewgrant", { body: { draft: d, recipient: "A neighbour", until } })) }; };
  const [d1, d2, d3] = [await draft({ caseId: one }), await draft({ caseId: other }), await draft({ newCase: true, targets: [first.id] })];
  const live1 = await grant(d1, 10), late1 = await grant(d1, 20), live2 = await grant(d2, 12), live3 = await grant(d3, 14);
  await as.act("reviewrevoke", { body: { grant: late1.grantId } });
  await w.door({ url: `/api/?op=reviewcomment&draft=${d2}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: live2.secret, text: "Please check the date." }) } }, null);
  return { one, other, names: ["The Coliseum lease", "Pothole repairs"], at: [at(one, 2), at(other, 1)], drafts: [d1, d2, d3],
           grants: [live1.grantId, late1.grantId, live2.grantId, live3.grantId], until: [live1.until, live2.until, live3.until] };
}

/** A group at the full stretch of Home's readings: documents held, three people the record follows, an action with three clocks running (one the group's
 *  own, two owed by a body), members with expertise (one confirmed, one declared, one declared by a member since revoked), and a security level raised
 *  by failed sign-ins in an hour that is past, and two cases published with drafts shared for review (`cases`). Answers the administrator's fresh session (an hour on,
 *  the earlier ones have locked), the documents held before the cases (`held`) and `cases`' answer (`published`). */
async function stretch() {
  const { w, rosa, mai } = await team({ ago: 2 * 3_600_000 });   // two hours back: the sign-ins fail then, and the clock is brought up to the page's after them
  const founder = await w.signIn("founder");
  const dev = await w.signIn("dev");
  const coliseum = await projectWith(w, rosa, "The Coliseum lease", 0);
  await projectWith(w, rosa, "Pothole repairs", 0);
  for (const name of ["Lease", "Minutes", "Budget"]) await w.recipes.hold(rosa, name, `${name} of the Coliseum.`, coliseum);
  const held = (await rosa.read("browse", { query: { kinds: "document", limit: "1" } })).total;
  const published = await cases(w, rosa, coliseum);   // (the world's clock is still two hours behind the wall's, as a record's stamps need: made before it is brought up)
  for (const label of ["Jo Adams", "Mia Chen", "Sam Ortiz"]) await rosa.act("entitycreate", { body: { kind: "person", label, note: `${label} is named in the lease.` } });
  const id = (await rosa.read("allocid", { query: { prefix: "ACT", year: instant(w).slice(0, 4) } })).id, at = instant(w);
  const clock = [["a", "2026-10-23", "group"], ["b", "2026-10-14", "body"], ["c", "2026-10-20", "body"]];
  const md = ["---", `id: ${id}`, "object_type: action", `title: ${id}`, "current_state: planned", `created: "${at}"`, `last_updated: "${at}"`, "action_kind: records_request", "risk_tier: 1",
    "counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery", "clock:",
    ...clock.flatMap(([t, date, owed]) => [`  - text: ${t}`, `    description: ${t} window`, `    date: ${date}`, `    owed_by: ${owed}`, "    basis: statute", "    status: pending"]), "---", "", "An action.", ""].join("\n");
  await rosa.act("promote", { body: { bundleId: id, base: null, snapKey: at.replace(/[-:]/g, "") + "_" + hex(id).slice(0, 8),
    meta: { object_type: "action", title: id, current_state: "planned", created: at, last_updated: at }, files: [{ path: "bundle.md", text: md }], register: [] } });
  await rosa.act("expertisedeclare", { body: { memberId: "rosa", label: "CPA" } });
  await founder.act("expertiseconfirm", { body: { memberId: "rosa", label: "CPA" } });
  await mai.act("expertisedeclare", { body: { memberId: "mai", label: "reporter" } });
  await dev.act("expertisedeclare", { body: { memberId: "dev", label: "nurse" } });
  await founder.act("memberset", { body: { memberId: "dev", status: "revoked" } });
  for (let i = 0; i < 12; i++)
    await w.door({ url: "/api/?op=login", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: "mai", password: "not-her-password", device: "own" }) } });
  w.tick(Math.max(0, Date.now() - w.now()));   // the failed sign-ins are in an hour that is past: the level is Raised, not High (a spike going on)
  return { w, rosa: await w.signIn("rosa"), mai: await w.signIn("mai"), coliseum, held, published };
}

test("R64: a home whose fixtures answer each read draws each reading with the read's figure, in its area", timeout, async () => {
  const { w, rosa, held, published } = await stretch();
  const p = await open(w, rosa, "/app", editions(w, rosa));
  await settle();
  const area = (k) => text(p, main(p).querySelector(`[data-area="${k}"]`));
  const inv = area("investigation");
  const docs = (await rosa.read("browse", { query: { kinds: "document", limit: "1" } })).total;
  const following = (await rosa.read("peopledirectory", { query: { show: "people", limit: "1" } })).following;
  assert.equal(held, 3);
  assert.equal(docs, held + 2, "the three documents held, and the one each of the two findings published rests on");
  assert.equal(following, 3);
  assert.ok(inv.includes(`${docs} ${word("screen.home.rd.documents")}`), "documents: browse's total");
  assert.ok(inv.includes(`${following} ${word("screen.home.rd.followed.other")}`), "people followed: peopledirectory's following");
  assert.ok(inv.includes(`2 ${word("screen.home.rd.cases")}`), "cases: the distinct case ids");
  assert.deepEqual(p.byOp("browse").map((r) => [r.query.kinds, r.query.limit]), [["document", "1"]], "documents: browse over documents, one row");
  assert.deepEqual([p.byOp("peopledirectory")[0].query.show, p.byOp("peopledirectory")[0].query.limit], ["people", "1"]);
  const act = area("action");
  assert.ok(act.includes(`3 ${word("screen.home.rd.clocks")}`), "clocks: the total");
  assert.ok(act.includes(word("screen.home.area.ourmove", { n: "1", date: dmy("2026-10-23") })) && act.includes(word("screen.home.area.theirmove", { n: "2", date: dmy("2026-10-14") })), "our move by the group, theirs by a body, each with its count and earliest date");
  const members = area("members");
  assert.ok(members.includes(word("screen.home.area.expertise", { people: "" }).trim().replace(/\s+$/, "")), "expertise line");
  const person = (member, label, standing) => word("screen.home.area.expertise.person", { member, label, standing: word(`screen.home.area.expertise.${standing}`) });
  assert.ok(members.includes(person("rosa", "CPA", "confirmed")) && members.includes(person("mai", "reporter", "declared")));
  assert.ok(!members.includes("nurse"), "control: a member no longer active has no expertise on hand");
  const adm = area("administration");
  const level = (await rosa.read("securitymap", { query: { from: new Date(Date.now() - 86400000).toISOString(), to: new Date().toISOString() } })).level;
  // (the level is credentials' own judgment of the failed sign-ins (its R45): the screen draws the word for whatever it answers)
  assert.ok(["Raised", "High"].includes(level), "the failed sign-ins of an hour past raise the level: " + level);
  assert.ok(adm.includes(`${word("screen.home.rd.level." + level.toLowerCase())} ${word("screen.home.rd.security")}`), "security level, over the last 24 hours");
  const q = p.byOp("securitymap")[0].query;
  assert.equal(Date.parse(q.to) - Date.parse(q.from), 86400000);
});

test("R64: edition lines: a case with a draft shared until a date says so, with the recipients' comments to answer; a draft of no case and a lapsed grant say nothing; the latest edition alone is its plain line", timeout, async () => {
  const { w, rosa, coliseum, published: k } = await stretch();
  const p = await open(w, rosa, "/app", editions(w, rosa));
  await settle();
  const inv = text(p, main(p).querySelector('[data-area="investigation"]'));
  assert.ok(inv.includes(word("screen.home.area.edition", { n: "2", case: k.names[0], date: dmy(day(k.at[0])), until: dmy(day(k.until[0])) })), "no comment: the sentence that says none is to answer");
  assert.ok(inv.includes(word("screen.home.area.edition.comments.one", { n: "1", case: k.names[1], date: dmy(day(k.at[1])), until: dmy(day(k.until[1])) })), "one recipient commented");
  assert.deepEqual(p.byOp("casedrafts").map((r) => r.query.projects), [coliseum], "one read, for the project whose row says a draft is shared (project-roster R42)");
  assert.deepEqual(p.byOp("reviewcopy").map((r) => r.query.draft).sort(), [k.drafts[0], k.drafts[1]].sort(), "a draft of no case reads no grant");
  assert.equal(p.byOp("publishedcase").filter((r) => r.query.id === k.one)[0].query.edition, "2", "the latest edition");
  // No draft shared (every grant withdrawn, the lapsed one already): the latest edition, alone.
  for (const g of k.grants) await rosa.act("reviewrevoke", { body: { grant: g } });
  const bare = await open(w, rosa, "/app", editions(w, rosa));
  await settle();
  assert.ok(text(bare, main(bare).querySelector('[data-area="investigation"]')).includes(word("screen.home.area.edition.published", { n: "1", case: k.names[1], date: dmy(day(k.at[1])) })), "the latest edition, no draft");
  // A draft on a case with no edition yet: the published list is empty (the test's own: a draft names an existing case, so no act leaves its case unpublished), the
  // drafts are the world's, shared again by a grant of each of two, and the comment a recipient made is the second's.
  const draftOnly = async (draft) => {
    const until = ahead(w, 20);
    await rosa.act("reviewgrant", { body: { draft, recipient: "A reader", until } });
    const page = await open(w, rosa, "/app", editions(w, rosa, { publishedlist: EDITION_CASES([]) }));
    await settle();
    return { until, page, inv: text(page, main(page).querySelector('[data-area="investigation"]')) };
  };
  const only = await draftOnly(k.drafts[0]);
  assert.ok(only.inv.includes(word("screen.home.area.edition.draftonly", { case: k.one, until: dmy(day(only.until)) })), "a draft on a case with no edition yet");
  const grants = (await w.send({ url: `http://do/reviewcopy?draft=${k.drafts[0]}&viewer=member:rosa`, headers: {}, method: "GET" }).then((r) => r.json())).result.grants;
  for (const g of grants.filter((x) => x.live)) await rosa.act("reviewrevoke", { body: { grant: g.grant_id } });
  const one = await draftOnly(k.drafts[1]);
  assert.ok(one.inv.includes(word("screen.home.area.edition.draftonly.comments.one", { case: k.other, until: dmy(day(one.until)) })), "one comment on a draft with no edition yet");
});

test("R64: controls: a member who is not an administrator sends no securitymap and draws no security level; a read that fails draws its reading failed", timeout, async () => {
  const { w, rosa, mai } = await stretch();
  const m = await open(w, mai, "/app", editions(w, mai));
  await settle();
  assert.equal(m.byOp("securitymap").length, 0);
  assert.ok(!text(m).includes(word("screen.home.rd.security")));
  for (const [op, area] of [["browse", "investigation"], ["peopledirectory", "investigation"], ["publishedlist", "investigation"], ["clocksrunning", "action"], ["securitymap", "administration"]]) {
    const f = await open(w, rosa, "/app", editions(w, rosa, { [op]: refused("STORE_DID_NOT_ANSWER", null, 502) }));
    await settle();
    assert.ok(main(f).querySelector(`[data-area="${area}"] [data-state="failed"]`), `${op} failed is drawn failed in ${area}`);
  }
  // A group that holds no document, follows no one, has published nothing and runs no clock: the readings at zero are not drawn.
  const calm = await team();
  await projectWith(calm.w, calm.rosa, "Pothole repairs", 0);
  const quiet = await open(calm.w, calm.rosa, "/app");
  await settle();
  const t = text(quiet, main(quiet).querySelector('[data-area="investigation"]'));
  assert.ok(!t.includes(word("screen.home.rd.documents")) && !t.includes(word("screen.home.rd.cases")) && !t.includes(word("screen.home.rd.followed.other")), "no reading at zero");
  const a = text(quiet, main(quiet).querySelector('[data-area="action"]'));
  assert.ok(!a.includes(word("screen.home.rd.clocks")) && !a.includes(word("home.move.theirs")), "no clock reading at zero");
});
