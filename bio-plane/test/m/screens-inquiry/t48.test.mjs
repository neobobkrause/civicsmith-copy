/* screens-inquiry T48 (T48-73): R17 the dock's thirty days and meters, R18 the reference links, R19 the held texts, R20 the
 * common line (every class a served stylesheet defines; no empty section, no zero; a failed read still failed), R21 the
 * subject guard, R22 the original by its SHA-256 (the document's own link tests are in document.test.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ok, refusedIn, silent, ADMIN } from "../interface-shell/harness.mjs";
import { interfacePage } from "../../../src/interface-shell/index.mjs";
import { SCREEN_WORDS } from "../../../src/screens-inquiry/index.mjs";
import { open, storeWorld, WORLD_FOUNDER_HANDLE, main, plane, says, word, SCREENS, P, Q, D, SHA, BASIS, READING, PROJECT_QUESTIONS, DOCUMENT_MD, inquiryMd } from "./fixtures.mjs";

const RUN = "RUN-" + "b".repeat(16);
const text = (el) => el.textContent;
const section = (p, key) => main(p).querySelectorAll("section").find((s) => s.querySelector("h2").textContent === word(key));
const heads = (p) => main(p).querySelectorAll("section").map((s) => s.querySelector("h2").textContent);

/* ---- R17: the dock's bars and meters (screens-settings R26's render, handed in as `view.parts`, a stand-in here) ---- */
function aiUsageBars(cs, view, o) {
  return `<div class="mk-bars" data-owner="${cs.esc(o.owner)}" data-days="${o.value.days.length}" data-meters="${o.value.periods.length}"></div>`;
}
const SERVING = SCREENS.map((s) => (s.id === "assistant" ? { ...s, parts: { aiUsageBars } } : s));
const OWN = { capabilities: ["contribute", "create_projects"] };
const KEY = "sk-ant-api03-" + "7".repeat(40);
/** The real state the dock reads (the world made with `storeWorld({ ai: true })`, K5054): the team's Claude account set and switched on by the administrator's acts, `ann` a member
 *  with a project of her own, a question resting on a held passage and a document held in it; `own` also gives her an account of her own (`accountreferenceset`), `key` a key
 *  for the project (`projectkeyset`, switched on). Answers `{world, admin, ann, project, doc, id}`. */
const worldOf = async ({ own = false, key = false } = {}) => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  await admin.act("reauth", { body: { password: admin.password } });
  await admin.act("groupkeyset", { body: { key: "sk-ant-api03-" + "w".repeat(40) } });
  await admin.act("groupkeyswitch", { body: { on: true } });
  await admin.act("groupkeynoticeseen", { body: {} });
  const ann = await world.signIn("ann", OWN);
  await ann.act("groupkeynoticeseen", { body: {} });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const doc = (await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", project)).bundle;
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: [{ target: doc, role: "supports" }], draw: true })).id;
  if (own) {
    /* what connecting means, read first; her password again; then the key, named as ai-accounts' route reads it */
    const d = await ann.read("disclosureof", { query: { member: "member:" + ann.member } });
    await ann.act("disclosureshown", { body: { member: "member:" + ann.member, version: d.version } });
    await ann.act("reauth", { body: { password: ann.password } });
    await ann.act("accountreferenceset", { body: { member: "member:" + ann.member, kind: "apikey", secret: KEY } });
  }
  if (key) {
    await ann.act("reauth", { body: { password: ann.password } });
    await ann.act("projectkeyset", { body: { project, key: KEY } });
    await ann.act("projectaccountswitch", { body: { project, on: true } });
  }
  return { world, admin, ann, project, doc, id };
};
/** The page of `subject` as `as` reads it over the world's door (`plane` overrides only the ops it names), the dock opened. */
async function dock(w, subject, extra = {}, as = w.ann) {
  const screen = /^PROJ-/.test(subject) ? "project" : /^INFO-/.test(subject) ? "document" : "question";
  const { door, session } = w.world.boot(as);
  const p = await boot({ screens: SERVING, door, session, path: `/app/${screen}/${subject}`, ...(Object.keys(extra).length ? { plane: extra } : {}) });
  await p.settle();
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  return p;
}
const panel = (p) => p.root().querySelector(".cs-dock");
const bars = (p) => panel(p).querySelector(".mk-bars");

test("R17 her own account draws the thirty days and the meters of her account, read for her as its owner", async () => {
  const w = await worldOf({ own: true });
  const p = await dock(w, w.id);
  assert.deepEqual(p.byOp("aiuseovertime").map((r) => r.query.owner), ["member:" + w.ann.member]);
  assert.deepEqual([bars(p).getAttribute("data-owner"), bars(p).getAttribute("data-days"), bars(p).getAttribute("data-meters")], ["member:" + w.ann.member, "30", "1"]);
});

test("R17 a project's account she owns draws its bars; a refusal as a non-owner is refused draws nothing and says nothing of the account's use", async () => {
  const w = await worldOf({ key: true });
  const own = await dock(w, w.doc);
  assert.equal(bars(own).getAttribute("data-owner"), "project:" + w.project);
  /* the real non-owner: dev joined the project (invited by her) and is not its owner, so the plane refuses the use over time */
  const dev = await w.world.signIn("dev", OWN);
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "dev" }, body: {} });
  await dev.act("projectjoin", { query: { projectId: w.project }, body: {} });
  await dev.act("groupkeynoticeseen", { body: {} });
  const other = await dock(w, w.doc, {}, dev);
  assert.ok(!bars(other) && !panel(other).querySelector("[data-state]"), "nothing drawn, no failure");
  assert.doesNotMatch(text(panel(other)), /Only an owner|owner/);
});

test("R17 the group's key draws its bars to an administrator; a member who does not administer reads and draws none", async () => {
  const w = await worldOf();
  const member = await dock(w, w.id);
  assert.ok(says(panel(member), "ai.account.group.inline"));
  assert.equal(member.byOp("aiuseovertime").length, 0, "no read is made for an account she does not own");
  assert.ok(!bars(member));
  const admin = await dock(w, w.id, {}, w.admin);
  assert.deepEqual([admin.byOp("aiuseovertime")[0].query.owner, bars(admin).getAttribute("data-owner")], ["group", "group"]);
});

test("R17 controls: an unreadable answer, and a read that fails, are drawn failed, never as zeros", async () => {
  /* still scripted over a real account (aiuseovertime): needed: an account whose use over time reads unreadable, or fails (no act makes the plane answer either) */
  const w = await worldOf({ own: true });
  const unreadable = await dock(w, w.id, { aiuseovertime: ok({ owner: "member:" + w.ann.member, unreadable: true }) });
  assert.ok(!bars(unreadable) && panel(unreadable).querySelector('[data-state="failed"]'));
  const gone = await dock(w, w.id, { aiuseovertime: silent });
  assert.ok(!bars(gone) && panel(gone).querySelector('[data-state="failed"]'));
});

/* ---- R18: the reference links ---- */
/* the kit stand-in: every kit call answers an empty string but the reference, which records what it was asked and answers
   a link (the shell links a kind it lists and whose screen it registers, interface-shell R16) */
function kit(refs, answer) {
  return new Proxy({}, { get: (_, k) => (k === "call" ? async () => ({ ok: true }) : k === "ref" ? (...a) => { refs.push(a); return answer(...a); }
    : k === "esc" || k === "w" ? (x) => String(x) : k === "sec" ? (t, inner) => inner : k === "sheet" ? (x) => x
    : k === "row" ? (...a) => a.join("") : k === "date" ? () => "" : () => "") });
}
const projectView = (plans) => ({ subject: P, ui: { plans }, data: {}, me: { handle: "mai" }, parts: SCREENS.find((s) => s.id === "project").parts });
const PROJECT = SCREENS.find((s) => s.id === "project");

test("R18 a plan opened in the project is a reference link to the plan screen, with the plan as subject; opening one sends nothing", () => {
  const refs = [];
  const html = PROJECT.render(kit(refs, (kind, id, label) => `<a class="cs-ref" href="/app/${kind}/${id}" data-nav>${label}</a>`),
    projectView([{ id: "PLAN-2026-0003", title: "Pothole options" }]));
  assert.ok(refs.some((r) => r[0] === "plan" && r[1] === "PLAN-2026-0003" && r[2] === "Pothole options"), "the plan by name, with the plan as subject");
  assert.match(html, /<a class="cs-ref" href="\/app\/plan\/PLAN-2026-0003" data-nav>Pothole options<\/a>/);
});

test("R18 R52 controls: a project with no plan still lists the plan kind (with the project as subject); a kind the shell does not link is drawn plain, never as a bare card", async () => {
  const none = [];
  PROJECT.render(kit(none, () => ""), projectView([]));
  assert.ok(none.some((r) => r[0] === "plan" && r[1] === P), "R52 (1): the first plan can be made");
  const unlinked = PROJECT.render(kit([], (kind, id, label) => `<span class="cs-card">${label}</span>`), projectView([{ id: "PLAN-1", title: "Options" }]));
  assert.doesNotMatch(unlinked, /cs-card/);
  assert.match(unlinked, /Options/);
});

/* ---- R19: the held texts, since R44 held nowhere: the module holds no word of its own (words.test.mjs) ---- */
test("R19 the module holds no copy of a words.json word, and none spelled \"labelled\"", () => {
  assert.deepEqual(SCREEN_WORDS, [], "no row of its own (R44)");
  for (const s of SCREENS) for (const k of s.words) assert.equal(typeof k, "string", `${s.id}: ${k} is a key`);
  for (const s of SCREENS) for (const k of s.words) assert.doesNotMatch(word(k, new Proxy({}, { get: () => "x", has: () => true, getOwnPropertyDescriptor: () => ({ value: "x", configurable: true, enumerable: true }) })), /labelled/i, k);
  assert.ok(SCREENS.find((s) => s.id === "document").words.includes("act.pagetranscribe.does"), "the document draws the carried word by its key");
});

/* ---- R20: the common line ---- */
/* projectai draws screens-settings' AI account panel (R14, `view.parts`); its classes are that module's (its R20), so a
   stand-in that draws nothing leaves only this module's own */
function noPanel() { return ""; }
const OWN_ONLY = SCREENS.map((s) => (s.id === "projectai" ? { ...s, parts: { ...s.parts, aiPanel: noPanel } } : s));

test("R20 the module's real screens compose under interface-shell R56: every class they draw is one a served stylesheet defines", () => {
  assert.equal(typeof interfacePage(OWN_ONLY), "string");
  const stray = SCREENS.map((s) => (s.id === "question" ? { ...s, render: function render() { return `<p class="cs-nonesuch">x</p>`; } } : s));
  assert.throws(() => interfacePage(stray), /question.*cs-nonesuch/, "control: an undefined class is refused");
});

test("R20 every labelled field is drawn with cs.field: no screen draws cs-form or a bare label", async () => {
  /* the AI account screen over the real project: her key held and on, as the page's panel reads it */
  const w = await worldOf({ key: true });
  const ai = async () => {
    const { door, session } = w.world.boot(w.ann);
    const p = await boot({ screens: OWN_ONLY, door, session, path: "/app/projectai/" + w.project });
    await p.settle();
    return p;
  };
  for (const [path, real] of [["/app/project/" + P, false], ["/app/question/" + Q, false], ["/app/document/" + D, false], ["/app/projectai/" + w.project, true]]) {
    const m = main(real ? await ai() : await open(path, { boot: { screens: OWN_ONLY } }));
    assert.equal(m.querySelectorAll(".cs-form").length, 0, path);
    for (const l of m.querySelectorAll("label")) assert.ok(String(l.parentElement.getAttribute("class")).split(/\s+/).includes("cs-field"), `${path}: ${l.textContent}`);
  }
  const m = main(await ai());
  const key = m.querySelectorAll("input").find((i) => i.getAttribute("type") === "password");
  assert.ok(key && key.parentElement.querySelector("label") && key.parentElement.querySelector(".help"), "the key field has its label and help");
});

test("R20 over an empty fixture no section is drawn empty and no count is drawn at zero", async () => {
  /* the real state: a project with nothing drawn into it, a question citing nothing, a document held with nothing relying on it */
  const world = await storeWorld({ ai: true });
  const ann = await world.signIn("ann", OWN);
  const pid = await world.recipes.project(ann, "Pothole repairs");
  const held = await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", pid);
  const qid = (await world.recipes.question(ann, pid, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: [], draw: true })).id;
  const pageOf = async (path, screens) => {
    const { door, session } = world.boot(ann);
    const p = await boot({ screens: screens || SCREENS, door, session, path });
    await p.settle();
    return p;
  };
  const project = await pageOf("/app/project/" + pid);
  const question = await pageOf("/app/question/" + qid);
  const document = await pageOf("/app/document/" + held.bundle);
  for (const [p, absent] of [[project, ["screen.project.draw.head"]], [question, ["screen.question.against.head", "screen.question.waits.head"]],
                             [document, ["screen.document.people.head", "screen.document.versions.head", "screen.document.backlinks.head", "screen.document.unread.head"]]]) {
    for (const h of absent) assert.ok(!heads(p).includes(word(h)), `${h} is not drawn`);
    for (const s of main(p).querySelectorAll("section")) assert.ok(text(s).length > text(s.querySelector("h2")).length, `${text(s.querySelector("h2"))} holds something`);
    for (const k of ["screen.project.stage.read", "screen.project.stage.legs", "screen.project.stage.concluded"]) assert.ok(!says(main(p), k, { count: "0" }), `${k} at zero`);
  }
  const w = await worldOf();
  const dockP = await dock(w, w.id);
  assert.ok(!says(panel(dockP), "screen.assistant.use", { used: "$0.00", limit: "$2.00" }), "no use today, no count");
  assert.ok(!panel(dockP).querySelectorAll("section").some((s) => text(s.querySelector("h2")) === word("screen.assistant.productions.head")), "no productions, no section");
});

test("R20 controls: a read that failed is still drawn failed, beside the rest, in a section that is kept", async () => {
  const q = await open("/app/question/" + Q, { plane: { questionwaits: refusedIn("SOME_REFUSAL", "The plane refused this read.") } });
  assert.ok(section(q, "screen.question.waits.head").querySelector('[data-state="failed"]'));
  const d = await open("/app/document/" + D, { plane: { backlinks: refusedIn("SOME_REFUSAL", "The plane refused this read."), versionchain: silent } });
  assert.ok(section(d, "screen.document.backlinks.head").querySelector('[data-state="failed"]'));
  assert.ok(section(d, "screen.document.versions.head").querySelector('[data-state="failed"]'));
});

/* ---- R21: the subject guard ---- */
test("R21 project, question, projectai and document mark their subject read, and drawn bare each draws nothing of its own", () => {
  const SUBJECT = { project: ["stage", "projectstage"], question: ["inquiry", "image"], projectai: ["project", "image"], document: ["capture", "image"] };
  for (const [id, [key, op]] of Object.entries(SUBJECT)) {
    const s = SCREENS.find((x) => x.id === id);
    const r = s.reads({ subject: "X-1" });
    assert.deepEqual([r[key].subject, r[key].op], [true, op], `${id}: ${key} marks the subject`);
    assert.equal(Object.values(r).filter((x) => x.subject === true).length, 1, `${id}: only the subject read is marked`);
    const refs = [];
    assert.equal(s.render(kit(refs, () => ""), { subject: "", ui: {}, data: {}, me: {} }), "", `${id} bare draws no heading, refusal block or form`);
    assert.equal(s.render(kit(refs, () => ""), { subject: undefined, ui: {}, data: {}, me: {} }), "", `${id} with no subject`);
  }
});
