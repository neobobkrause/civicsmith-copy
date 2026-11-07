/* screens-inquiry fix round 3 (T51), the `project` screen: C94 (R29, R40, R54: members named by handle, never by id), DEC-394 (3a) (R128, to be
 * folded: "The project's documents", read by `heldcaptures`) and C79 (R28: a project opened within the minute says it was started). On
 * interface-shell's served page over a scripted plane; every request is compared with its owner's declaration by the harness's guard (R104).
 * Every expectation is a word read by key (R44), never copied (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { unnamedFounderWorld } from "../store-request/fixtures.mjs";
import { open, main, actsIn, press, says, section, word, day, storeWorld, WORLD_FOUNDER_HANDLE, SCREENS, P } from "./fixtures.mjs";
import { generate as sheetOf } from "../../sheetgen.mjs";
import { generate as imageOf } from "../../imggen.mjs";

const at = "/app/project/" + P;
const PROJECT = SCREENS.find((s) => s.id === "project");

/* ------------------------------------------------------------------------------------------------------------------ C94 */

/* The real state (op-tables, K5054): a project the founder started, hidden at once; rosa invited, joined and made an owner beside her; rosa makes it findable ("ready") and the founder hides it
 * again ("too soon"); ana joined, and the founder's proposal to make her an owner waits on rosa; rosa's stake. The page reads the real answers of project-roster and membership. */
const roster = async () => {
  const world = await storeWorld();
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  const rosa = await world.signIn("rosa", { capabilities: ["contribute", "create_projects"] });
  const ana = await world.signIn("ana", { capabilities: ["contribute"] });
  const project = await world.recipes.project(founder, "Pothole repairs");
  const vis = (as, setting, reason) => as.act("projectvisibilityset", { query: { projectId: project, setting, ...(reason ? { reason } : {}) }, body: {} });
  await vis(founder, "hidden");
  await founder.act("projectinvite", { query: { projectId: project, handle: "rosa" } });
  await rosa.act("projectjoin", { query: { projectId: project } });
  await founder.act("projectowneradd", { query: { projectId: project, handle: "rosa" } });
  await vis(rosa, "discoverable", "ready");
  await vis(founder, "hidden", "too soon");
  await founder.act("projectinvite", { query: { projectId: project, handle: "ana" } });
  await ana.act("projectjoin", { query: { projectId: project } });
  /* the proposal is one vote short of an owner's addition: the act answers `CONSENSUS_REQUIRED` and the vote is kept */
  await founder.act("projectowneradd", { query: { projectId: project, handle: "ana" } }).then(() => assert.fail("the second owner's agreement is owed"), (e) => assert.match(String(e.message), /CONSENSUS_REQUIRED/));
  await rosa.act("projectstakeset", { query: { projectId: project, stake: "Two members live nearby." }, body: {} });
  return { world, founder, rosa, ana, project };
};
const pageOf = async (world, as, path, plane = {}) => { const { door, session } = world.boot(as); const b = await boot({ screens: SCREENS, door, session, path, plane }); await b.settle(); return b; };
const NOHANDLE = /\badmin\b/;

test("R29 R40 R54 C94 the members the project names from the record are drawn by handle, never by id: the participants, the visibility history's setters (the founder by her handle), the stake's, the owners' vote; control: a member who is no owner reads the same names", async () => {
  const { world, rosa, ana, project } = await roster();
  const read = (op) => rosa.read(op, { query: { projectId: project } });
  const history = (await read("projectvisibility")).history, vote = (await read("projectownervotes")).changes[0], stake = await read("projectstake");
  assert.deepEqual(history.map((h) => h.set_by), [WORLD_FOUNDER_HANDLE, WORLD_FOUNDER_HANDLE, "rosa", WORLD_FOUNDER_HANDLE], "the plane names the setters by handle");
  const at = "/app/project/" + project;
  const p = await pageOf(world, rosa, at);
  const members = section(p, "screen.project.members.head");
  assert.ok(members.textContent.includes("rosa") && members.textContent.includes("ana") && members.textContent.includes(WORLD_FOUNDER_HANDLE), "the participants, each by her handle");
  assert.ok(says(members, "project.owners.pending", { who: "ana", by: WORLD_FOUNDER_HANDLE, date: day(vote.proposed_at), agreed: WORLD_FOUNDER_HANDLE, awaiting: "rosa" }),
    "the owners' vote: proposer, agreed and awaiting by handle");
  const vis = main(p).querySelector('details[data-fold="settings"]');
  assert.ok(says(vis, "project.visibility.history", { change: word("project.visibility.discoverable"), who: "rosa", date: day(history[2].at), reason: "ready" }), "an owner by her handle");
  assert.ok(says(vis, "project.visibility.history", { change: word("project.visibility.hidden"), who: WORLD_FOUNDER_HANDLE, date: day(history[3].at), reason: "too soon" }), "the founder's id by her handle");
  assert.ok(says(section(p, "stake.project.title"), "stake.set", { who: "rosa", date: day(stake.set_at) }), "the stake's setter");
  assert.doesNotMatch(main(p).textContent, NOHANDLE, "never an id");
  /* control: a member who is no owner reads the same names (the roster silent is the scripted test's control: the real plane always names its members) */
  const q = await pageOf(world, ana, at);
  const vq = main(q).querySelector('details[data-fold="settings"]');
  assert.ok(says(vq, "project.visibility.history", { change: word("project.visibility.hidden"), who: WORLD_FOUNDER_HANDLE, date: day(history[3].at), reason: "too soon" }), "the founder, by her handle");
  assert.ok(says(section(q, "stake.project.title"), "stake.set", { who: "rosa", date: day(stake.set_at) }), "the stake's setter");
  assert.doesNotMatch(main(q).textContent, NOHANDLE);
});

test("R40 a founder who chose no handle is drawn by member.founder.unnamed, never blank, as the proposer of an owner's addition, as the setter of the visibility and as the stake's setter", async () => {
  /* the real state (`unnamedFounderWorld`: a founder claimed with a password and no handle): mai joined and made an owner beside her; the founder hides the project, sets the stake and proposes ana, who joined, as a
     third owner (one vote short: CONSENSUS_REQUIRED, the vote is kept); the owners' vote, the history and the stake name her by what project-roster gives for a founder with no handle */
  const world = await unnamedFounderWorld();
  const mai = await world.signIn("mai", { capabilities: ["contribute", "create_projects"] });
  const ana = await world.signIn("ana", { capabilities: ["contribute"] });
  const project = await world.recipes.project(world.unnamed, "Unnamed founder's potholes");
  const founder = world.unnamed;
  await founder.act("projectinvite", { query: { projectId: project, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: project } });
  await founder.act("projectowneradd", { query: { projectId: project, handle: "mai" } });
  await founder.act("projectvisibilityset", { query: { projectId: project, setting: "discoverable", reason: "ready" }, body: {} });
  await founder.act("projectstakeset", { query: { projectId: project, stake: "Two members live nearby." }, body: {} });
  await founder.act("projectinvite", { query: { projectId: project, handle: "ana" } });
  await ana.act("projectjoin", { query: { projectId: project } });
  await founder.act("projectowneradd", { query: { projectId: project, handle: "ana" } }).then(() => assert.fail("the second owner's agreement is owed"), (e) => assert.match(String(e.message), /CONSENSUS_REQUIRED/));
  const read = (op) => mai.read(op, { query: { projectId: project } });
  const vote = (await read("projectownervotes")).changes[0], history = (await read("projectvisibility")).history, stake = await read("projectstake");
  const unnamed = word("member.founder.unnamed");
  const p = await pageOf(world, mai, "/app/project/" + project);
  const members = section(p, "screen.project.members.head");
  assert.ok(says(members, "project.owners.pending", { who: "ana", by: unnamed, date: day(vote.proposed_at), agreed: unnamed, awaiting: "mai" }), "the owners' vote: proposer and agreed, the founder unnamed");
  const vis = main(p).querySelector('details[data-fold="settings"]');
  const set = history.find((h) => h.setting === "discoverable");
  assert.ok(says(vis, "project.visibility.history", { change: word("project.visibility.discoverable"), who: unnamed, date: day(set.at), reason: "ready" }), "the visibility history's setter, the founder unnamed");
  assert.ok(says(section(p, "stake.project.title"), "stake.set", { who: unnamed, date: day(stake.set_at) }), "the stake's setter, the founder unnamed");
  assert.doesNotMatch(main(p).textContent, /\badmin\b|\bnull\b/, "never admin, never null");
});

/* ------------------------------------------------------------------------------------------------------------------ DEC-394 (3a) */

const SPREADSHEET = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** The real state: a project of ann's and the documents she holds in it, by real acts: a web page and a spreadsheet and a photo, each read so its format is recorded, and a plain letter
 *  whose format is not determined. Answers the world, ann, the project and the rows `heldcaptures` answers for it. */
const filed = async (titles = ["Street maintenance report 2026", "Pothole work orders, 2025", "Seminary Ave at 60th", "A letter from the city"]) => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const bytes = async (g) => Buffer.from(await g.bytes());
  await world.recipes.page(ann, titles[0], { project });
  await world.recipes.hold(ann, titles[1], await bytes(sheetOf({ kind: "xlsx", seed: "orders", size: { rows: 5, cols: 3 } })), project, { type: SPREADSHEET, read: true });
  await world.recipes.hold(ann, titles[2], await bytes(imageOf({ kind: "png", seed: "photo", size: { lines: 2 } })), project, { type: "image/png", read: true });
  await world.recipes.hold(ann, titles[3], "Dear residents, the street will be repaired.", project);
  const rows = (await ann.read("heldcaptures", { query: { project, state: "held_and_vouched", limit: "200", fields: "picker" } })).held;
  return { world, ann, project, rows };
};

test("R128 'The project's documents': every document filed under the project, each its title as a reference opening the document, its kind where the row states one and its capture date; read by heldcaptures for the project's held and vouched documents", async () => {
  const { world, ann, project, rows: DOCS } = await filed();
  /* the letter's format is whatever the provider records (it named it "undetermined", now "text", attempt 6): the screen has a kind only for these three */
  assert.deepEqual(DOCS.slice(0, 3).map((d) => d.format), ["html", "xlsx", "png"], "the real rows: three formats the screen draws a kind for");
  assert.ok(!["html", "xlsx", "png", "jpeg", "ods", "csv"].includes(DOCS[3].format), "the letter is none of them: " + DOCS[3].format);
  const p = await pageOf(world, ann, "/app/project/" + project);
  const s = section(p, "screen.project.docs.head");
  assert.ok(s, "the section is drawn");
  assert.ok(says(s, "screen.project.docs.about1") && says(s, "screen.project.docs.about2"), "what it lists");
  const rows = s.querySelectorAll(".cs-row");
  assert.equal(rows.length, 4);
  for (const [i, d] of DOCS.entries()) {
    const ref = rows[i].querySelector(`a.cs-ref[href="/app/document/${d.bundle_id}"]`);
    assert.ok(ref && ref.textContent === d.title, d.title + ": its title, opening the document");
  }
  const captured = (d) => word("screen.project.docs.captured") + " " + day(d.source.retrieved);
  assert.ok(rows[0].textContent.includes(word("screen.project.docs.kind.web") + " · " + captured(DOCS[0])), "a web page");
  assert.ok(rows[1].textContent.includes(word("screen.project.docs.kind.sheet") + " · " + captured(DOCS[1])), "a spreadsheet");
  assert.ok(rows[2].textContent.includes(word("screen.project.docs.kind.photo") + " · " + captured(DOCS[2])), "a photo");
  /* a row that states no format or content type draws no kind, never a guess */
  assert.ok(rows[3].textContent.includes(captured(DOCS[3])) && ["web", "sheet", "photo"].every((k) => !rows[3].textContent.includes(word("screen.project.docs.kind." + k))), "no kind stated, none drawn");
  assert.ok(!says(s, "screen.project.docs.none1"), "control: with documents, no 'nothing filed'");
  /* the read: the project's held and vouched documents, bounded */
  const q = p.byOp("heldcaptures").map((r) => r.query).find((x) => x.project === project && x.state === "held_and_vouched");
  assert.ok(q && Number(q.limit) > 0 && Number(q.limit) <= 1000 && q.fields === "picker", "state held_and_vouched, bounded, picker rows (fix round 6, G12a: the full row examines every capture with no recorded format)");
  assert.ok(actsIn(s).includes("heldcaptures"), "and its act");
});

test("R128 with nothing filed the section says so, in the designed two sentences; the act lists the documents again (the read repeated); control: a read that fails is drawn failed, never as none", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const at = "/app/project/" + project;
  const p = await pageOf(world, ann, at);
  const s = section(p, "screen.project.docs.head");
  assert.ok(says(s, "screen.project.docs.none1") && says(s, "screen.project.docs.none2"), "nothing is filed");
  assert.equal(s.querySelectorAll(".cs-row").length, 0);
  const before = p.byOp("heldcaptures").length;
  const b = s.querySelector('button[data-act="heldcaptures"]');
  assert.ok(b && says(b, "act.heldcaptures.label.project"), "the act, by its label for this screen");
  await press(p, "heldcaptures", { within: s });
  assert.ok(p.byOp("heldcaptures").length > before, "pressing it reads the list again");
  const f = await pageOf(world, ann, at, { heldcaptures: refusedIn("NOT_PERMITTED", "no") });
  const fs = section(f, "screen.project.docs.head");
  assert.ok(fs.querySelector('[data-state="failed"]') && !says(fs, "screen.project.docs.none1"), "control: failed is not none");
});

test("R128 a list the plane cuts (`truncated`, `next`) is read to its end, page by page", async () => {
  /* the plane cuts a page at the 200 the screen asks: 201 documents filed make two pages */
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const titles = [];
  for (let i = 1; i <= 201; i++) { const t = "Page " + String(i).padStart(3, "0"); titles.push(t); await world.recipes.hold(ann, t, "Document " + i + " of the city's records.", project); }
  const p = await pageOf(world, ann, "/app/project/" + project);
  const s = section(p, "screen.project.docs.head");
  const listed = s.querySelectorAll("a.cs-ref").map((a) => a.textContent);
  assert.equal(listed.length, 201, "read to its end");
  assert.deepEqual(listed, titles, "every document, once, in the plane's order across the pages");
  const asked = p.byOp("heldcaptures").map((r) => r.query);
  assert.equal(asked.length, 2, "two pages");
  assert.equal(asked[0].after, undefined);
  assert.ok(asked[1].after, "the second page by the cursor the first gave");
  /* control: a list that is not cut asks once */
  const { world: w2, ann: a2, project: p2 } = await filed();
  const one = await pageOf(w2, a2, "/app/project/" + p2);
  assert.ok(one.byOp("heldcaptures").every((r) => r.query.after === undefined));
});

/* ------------------------------------------------------------------------------------------------------------------ C79 */

/** A project started by the real `promote` with no setting chosen (so no history of who can find it, project-roster R28) and, by `created: false`, a record that states no start. Answers its id. */
const started = async (world, as, title, { created = true } = {}) => {
  const iso = new Date(world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const text = ["---", "object_type: project", `title: ${JSON.stringify(title)}`, `objective: ${JSON.stringify(title)}`, "current_state: forming", ...(created ? [`created: "${iso}"`] : []),
    `last_updated: "${iso}"`, "---", "", "## Session Log", ""].join("\n");
  const made = await as.act("promote", { body: { base: null, snapKey: iso.replace(/[-:]/g, "") + "_" + title.length, meta: { object_type: "project", title, current_state: "forming", created: iso, last_updated: iso },
    files: [{ path: "bundle.md", text }], register: [] } });
  return made.bundleId;
};
const DAY = 86400000;

test("R28 C79 a project opened within the minute it was started says it was started: `project.visibility.started` with its setting and the day; control: one started a day ago, with no history, does not", async () => {
  /* the page's clock is the machine's: the world's starts a day behind it, a project is started then, and the world is brought up to the page's time for another */
  const world = await storeWorld({ now: Date.now() - DAY });
  let ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const oldId = await started(world, ann, "Old pothole repairs");
  const oldIso = new Date(world.now()).toISOString();
  await world.tick(DAY);
  ann = await world.signIn("ann");
  const id = await started(world, ann, "Pothole repairs");
  const iso = new Date(world.now()).toISOString();
  assert.equal((await ann.read("projectvisibility", { query: { projectId: id } })).recorded, false, "no history of who can find it yet");
  const p = await pageOf(world, ann, "/app/project/" + id);
  const line = main(p).querySelector('[data-visibility="started"]');
  assert.ok(line, "the sentence is drawn");
  assert.ok(says(line, "project.visibility.started", { setting: word("project.visibility.setting.hidden"), date: day(iso) }), "started hidden, on the day");
  assert.ok(line.closest("details").hasAttribute("open"), "in the foot's fold, open while the project is new so the member sees it");
  const old = await pageOf(world, ann, "/app/project/" + oldId);
  assert.equal(main(old).querySelector('[data-visibility="started"]'), null, "a day later, none");
  assert.ok(!main(old).querySelector('details[data-fold="settings"]').hasAttribute("open"), "and the fold is closed as before");
  /* control: the history's own end (R28) is drawn once and never doubled by the new sentence */
  const hid = await world.recipes.project(ann, "Pothole repairs again");
  await ann.act("projectvisibilityset", { query: { projectId: hid, setting: "hidden", reason: "not yet" }, body: {} });
  const history = (await ann.read("projectvisibility", { query: { projectId: hid } })).history;
  const h = await pageOf(world, ann, "/app/project/" + hid);
  assert.equal(main(h).querySelectorAll('[data-visibility="started"]').length, 1, "once");
  assert.ok(says(main(h).querySelector('[data-visibility="started"]'), "project.visibility.started", { setting: word("project.visibility." + history[0].setting), date: day(history[0].at) }), "the history's end as before");
  /* control: a project whose record states no start says nothing of one */
  const noStart = await started(world, ann, "No start", { created: false });
  const none = await pageOf(world, ann, "/app/project/" + noStart);
  assert.equal(main(none).querySelector('[data-visibility="started"]'), null);
});
