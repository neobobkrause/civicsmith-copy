/* T50 (T50-51): words by key (R13), the library's tests read keys (R14), a state is listed at once and a saved draft is
   listed (R15), the wizard mark and the Wizards page's fold (R16), a step opens on its own subject (R17). Answered by the real
   store through the world's door (K5175; `world.mjs`). */
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { SCREENS, GUIDE, SCREEN_WORDS } from "../../../src/screens-wizards/index.mjs";
import { standIn, unhtml } from "./standin.mjs";
import { open, all, acts, has, squash, textOf, rowOf } from "./kit.mjs";
import { decode } from "../interface-shell/dom.mjs";
import { libraryTeam, team, authored, withSubjects, refusalOf } from "./world.mjs";

const t = (n) => squash(decode(textOf(n)));
const K = (vid) => vid.replace(/[^A-Za-z0-9_-]/g, "_");
const FINDER = [{ screen: "finder", act: "search", what: "W", why: "Y" }];

/* ---------------- R13 ---------------- */

test("R13 the module holds no English: SCREEN_WORDS is empty and what the library and the guide draw is setup-words' word(key, vars)", async () => {
  assert.deepEqual([...SCREEN_WORDS], []);
  for (const part of [...SCREENS, GUIDE]) for (const x of part.words) assert.equal(typeof x, "string", `${part.id}: a key, not a row`);
  // the library over the store: a sample of its keys, drawn as the list holds them
  const lt = await libraryTeam();
  const a = await open("wizards", { team: lt, as: lt.rosa });
  for (const [key, vars] of [["screen.wizards.purpose"], ["screen.wizards.own.fold"], ["screen.wizards.own.says"], ["screen.wizards.record.head"],
    ["screen.wizards.col.whose"], ["screen.wizards.showing", { state: word("screen.wizards.state.offered") }]]) {
    assert.ok(a.text.includes(squash(word(key, vars))), key);
  }
  // the guide's panel: its running step, its stop, its key
  const w = await authored(lt, { name: "N", steps: FINDER });
  const g = standIn({ team: lt, as: lt.mai, drawn: { finder: ["search"] } });
  await g.start({ script: w.script });
  for (const key of ["screen.guide.finish", "screen.guide.stop", "guide.stopping", "guide.showwhere", "screen.guide.key"]) assert.ok(g.text().includes(unhtml(word(key))), key);
  assert.ok(g.text().includes(unhtml(word("guide.step", { i: "1", n: "1" }))));
  // control: no test holds a sentence's English; a key's text moves with the list (no row of the module's own)
  assert.equal(SCREEN_WORDS.length, 0);
});

test("R13 a check's refusal naming its step keeps its {step} fill and is drawn by its key, never by a stub translation", () => {
  const fn = SCREENS[0].acts.find((x) => x.op === "wizardsubmit").refusals.WIZARD_ACT_UNKNOWN;
  const cs = { w: (k, f = {}) => (hasWord(k) ? word(k, Object.fromEntries(Object.entries(f).map(([a, v]) => [a, v && v.html ? v.html : v]))) : k), esc: (s) => String(s) };
  const held = fn({ code: "WIZARD_ACT_UNKNOWN", translation: "STUB", step: 3 }, cs);
  assert.equal(held, word("screen.wizards.refusal.step", { step: "3", words: word("refusal.WIZARD_ACT_UNKNOWN") }));
  assert.ok(!held.includes("STUB"));
  // a step refusal naming no step is its words alone
  assert.equal(fn({ code: "WIZARD_ACT_UNKNOWN", translation: "STUB" }, cs), word("refusal.WIZARD_ACT_UNKNOWN"));
});

/* ---------------- R14 ---------------- */

test("R14 a refusal of the library is asserted by its key (hasWord) and drawn as word(refusal.<CODE>), never as the answer's own translation", async () => {
  const lt = await libraryTeam();
  for (const code of ["WIZARDS_STATE_REFUSED", "WIZARD_NOT_THE_GROUPS", "WIZARD_ACT_UNKNOWN"]) assert.ok(hasWord("refusal." + code), code);
  const state = await refusalOf(lt, lt.rosa, "wizards", { query: { state: "nonsense" } });
  assert.equal(state.result.code, "WIZARDS_STATE_REFUSED");
  const f = await open("wizards", { team: lt, as: lt.rosa, faults: { wizards: state.result } });
  assert.ok(f.text.includes(squash(word("refusal.WIZARDS_STATE_REFUSED"))));
  const notTheGroups = await refusalOf(lt, lt.rosa, "wizardretire", { body: { script: lt.civ.id, reason: "replaced" } });
  assert.equal(notTheGroups.result.code, "WIZARD_NOT_THE_GROUPS");
  const a = await open("wizards", { team: lt, as: lt.rosa, faults: { wizardretire: notTheGroups.result } });
  const kc = K(lt.copy.version);
  await a.press("wizardretire", { data: { field: "wz-rr-" + kc }, values: { ["wz-rr-" + kc]: "replaced" } });
  assert.equal(a.refused.text, squash(word("refusal.WIZARD_NOT_THE_GROUPS")));
  // control: a step code with no key is drawn as interface-shell R83 says: the answer's own translation, else refusal.uncatalogued and the code
  const fn = SCREENS[0].acts.find((x) => x.op === "wizardsubmit").refusals.WIZARD_ACT_UNKNOWN;
  const bare = { w: (k, f = {}) => (k === "refusal.uncatalogued" ? word(k) : k === "screen.wizards.refusal.step" ? word(k, { step: f.step, words: f.words.html }) : k), esc: (x) => String(x) };
  assert.equal(fn({ code: "WIZARD_ACT_UNKNOWN", translation: "its own words" }, bare), "its own words");
  assert.equal(fn({ code: "WIZARD_ACT_UNKNOWN" }, bare), word("refusal.uncatalogued") + " WIZARD_ACT_UNKNOWN");
});

/* ---------------- R15 ---------------- */

test("R15 choosing a state sends wizards with that state at once, one press, and draws the member's saved draft; See the whole library lists again", async () => {
  const lt = await libraryTeam();
  const a = await open("wizards", { team: lt, as: lt.mai });
  const before = a.p.requests.length;
  const { sent } = await a.press("wizards", { data: { state: "draft" } });
  assert.deepEqual(sent.map((r) => [r.op, r.query.state]), [["wizards", "draft"], ["wizards", "draft"]], "the choice, then the screen's read in that state, no second press");
  assert.ok(a.p.requests.slice(before).every((r) => r.op === "wizards"));
  const draft = lt.draft.version;
  assert.ok(rowOf(a.tree, draft, draft, "library"), "the saved draft is listed");
  assert.equal(all(a.tree, (e) => e.attrs["data-shell"] === "row" && e.attrs["data-id"] === draft && e.attrs["data-table"] === "library").length, 1, "listed once");
  has(a, "screen.wizards.showing", { state: word("screen.wizards.state.draft") });
  // the list again
  const back = await a.press("wizards", { data: { state: "offered" } });
  assert.deepEqual(back.sent.map((r) => r.query.state), [undefined, undefined]);
  // control: a pending read is drawn as pending, never as "No wizards to show here"
  const p = await open("wizards", { team: lt, as: lt.mai, faults: { wizards: "pending" } });
  has(p, "state.loading");
  assert.ok(!p.text.includes(squash(word("screen.wizards.empty"))));
  // control: a refused read is drawn as failed, not as empty
  const refused = await refusalOf(lt, lt.mai, "wizards", { query: { state: "nonsense" } });
  const r = await open("wizards", { team: lt, as: lt.mai, faults: { wizards: refused.result } });
  assert.ok(!r.text.includes(squash(word("screen.wizards.empty"))));
});

test("R15 saving a recording: the guide says the draft was saved, by name, and Drafts lists it once, each recorded step numbered once", async () => {
  const lt = await team();
  const p = await boot({ screens: SCREENS, guide: GUIDE, ...lt.world.boot(lt.mai), path: "/app/wizards" });
  await p.settle(80);
  p.root().querySelector("#wz-project").value = lt.P1;
  await p.click(p.root().querySelector('button[data-act="wizarddraft"][data-mode="record"]'));
  await p.settle(60);
  await p.click(p.root().querySelector('button[data-act="wizards"][data-state="submitted"]'));
  await p.settle(60);
  await p.click(p.root().querySelector('button[data-act="wizards"][data-state="offered"]'));
  await p.settle(60);
  const dock = () => p.root().querySelector(".cs-dock");
  // each recorded step is numbered once: the word carries its number, so the list adds none, neither a number nor a bullet (T51-115)
  assert.ok(dock().querySelector('.mk-list[role="list"]') && !dock().querySelector("ol, ul, li"));
  const items = [...dock().querySelectorAll('.mk-list[role="list"] [role="listitem"]')].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(items.length, 2);
  assert.ok(items[0].startsWith("1. ") && items[1].startsWith("2. "));
  assert.ok(!/^\d+\.\s*\d+\./.test(items[0]));
  dock().querySelector("#wz-rec-name").value = "Check a claim, our way";
  await p.click(dock().querySelector('button[data-act="wizarddraft"]'));
  const send = p.root().querySelector('[data-shell="reason-send"]');
  if (send) { p.root().querySelector("[data-slot] textarea").value = "r"; await p.click(send); }
  await p.settle(160);
  const sent = p.byOp("wizarddraft").at(-1);
  assert.deepEqual(sent.body.recorded, [{ screen: "wizards", act: "wizards" }, { screen: "wizards", act: "wizards" }]);
  // the guide says it was saved, by name
  const text = dock().textContent.replace(/\s+/g, " ");
  assert.ok(text.includes("Check a claim, our way") && text.includes(squash(decode(word("screen.guide.recording.saved")))));
  // and Drafts is open, with the draft the store holds listed once
  assert.equal(p.location.pathname, "/app/wizards/draft");
  const saved = (await lt.mai.read("wizards", { query: { state: "draft" } })).scripts.find((s) => s.name === "Check a claim, our way");
  assert.ok(saved, "the store holds the saved draft");
  const rows = [...p.root().querySelectorAll('#cs-main tr [data-shell="row"][data-table="library"]')].filter((b) => b.getAttribute("data-id") === saved.versions[0].id);
  assert.equal(rows.length, 1);
  assert.ok(p.byOp("wizards").some((r) => r.query && r.query.state === "draft"));
  // control: not recording, nothing is saved and no notice is drawn
  assert.ok(!dock().querySelector('[data-guide-state="recording"]'));
});

/* ---------------- R16 ---------------- */

test("R16 the wizard mark reads wizard.marks.chip (wizard.marks.chip.one for one); on connect no chip is drawn once the member is connected, and every other screen keeps it", async () => {
  const lt = await team();
  const countOn = async (screen) => (await lt.mai.read("wizardsat", { query: { screen } })).scripts.length;
  const chip = (n) => (n === 1 ? word("wizard.marks.chip.one") : word("wizard.marks.chip", { n: String(n) }));
  const nConnect = await countOn("connect");
  assert.ok(nConnect >= 1, "the store offers a wizard on connect");
  const none = standIn({ team: lt, as: lt.mai, reachable: true });
  await none.enter("connect");
  assert.equal(none.marks(), "", "connected: her own subscription or key serves her, so connect draws no chip");
  // control: an unconnected member's connect draws the chip
  const un = standIn({ team: lt, as: lt.mai, reachable: false });
  await un.enter("connect");
  assert.ok(unhtml(un.marks()).includes(unhtml(chip(nConnect))));
  assert.equal((un.marks().match(/cs-wizmark/g) || []).length, 1);
  // control: every other screen stands as R11 says, connected or not; a second script on it reads in the plural
  await authored(lt, { name: "One", steps: FINDER });
  const other = standIn({ team: lt, as: lt.mai, reachable: true });
  await other.enter("finder");
  const nFinder = await countOn("finder");
  assert.ok(unhtml(other.marks()).includes(unhtml(chip(nFinder))));
  await authored(lt, { name: "Two", steps: FINDER });
  const two = standIn({ team: lt, as: lt.mai });
  await two.enter("finder");
  assert.equal(await countOn("finder"), nFinder + 1);
  assert.ok(unhtml(two.marks()).includes(unhtml(chip(nFinder + 1))));
  // the chip's explanation says what a wizard does
  assert.ok(two.marks().includes(`data-tip="${word("screen.guide.marks.means")}"`));
});

test("R16 Wizards draws the wizards in use and the list's states first; writing, revising, approving and retiring fold closed under screen.wizards.own.fold, its first line own.says", async () => {
  const lt = await libraryTeam();
  const a = await open("wizards", { team: lt, as: lt.rosa });
  const fold = all(a.tree, (e) => e.tag === "details" && e.attrs["data-wizards-own"] !== undefined)[0];
  assert.ok(fold, "the fold is drawn");
  assert.equal(fold.attrs.open, undefined, "closed");
  const summary = all(fold, (e) => e.tag === "summary")[0];
  assert.equal(t(summary), squash(word("screen.wizards.own.fold")));
  const first = all(fold, (e) => e.tag === "p")[0];
  assert.equal(t(first), squash(word("screen.wizards.own.says")));
  // the five writing acts are inside it and nowhere else; the reads are outside: each state of the list draws the acts that apply to it
  const inside = new Set(), outside = new Set();
  const note = (o) => {
    const f = all(o.tree, (e) => e.tag === "details" && e.attrs["data-wizards-own"] !== undefined)[0];
    for (const b of acts(o.tree)) {
      let within = false;
      for (let e = b.parent; e; e = e.parent) if (e === f) within = true;
      (within ? inside : outside).add(b.attrs["data-act"]);
    }
  };
  note(a);
  const mine = await open("wizards", { team: lt, as: lt.mai, subject: "draft" });
  await mine.press("wizards", { data: { open: lt.draft.version } });
  note(mine);
  note(await open("wizards", { team: lt, as: lt.rosa, subject: "submitted" }));
  for (const op of ["wizarddraft", "wizardrevise", "wizardsubmit", "wizardapprove", "wizardretire"]) assert.ok(inside.has(op), `${op} in the fold`);
  assert.deepEqual([...outside], ["wizards"]);
  // the wizards in use and the states come first
  const at = (s) => a.html.indexOf(s);
  assert.ok(at('data-state="offered"') < at("data-wizards-own") && at('data-table="library"') < at("data-wizards-own"));
  // no capability gate is drawn for "Record a new wizard": a member holding only `contribute` records
  const m = await open("wizards", { team: lt, as: lt.ivy });
  assert.ok(acts(m.tree).some((b) => b.attrs["data-act"] === "wizarddraft" && b.attrs["data-mode"] === "record"));
});

/* ---------------- R17 ---------------- */

const STEPS = [
  { screen: "timeline", act: null, what: "Open the plan", why: "To see its options" },
  { screen: "finder", act: "search", what: "Search", why: "Maybe it exists" },
  { screen: "timeline", act: null, what: "Back to the plan", why: "Again" }];

test("R17 a step on a screen that works in a project, with none held for the run, asks which one in the dock, as record data, and opens the screen on the one chosen", async () => {
  const lt = await team();
  const w = await authored(lt, { name: "Plan it", steps: STEPS });
  const g = standIn({ team: lt, as: lt.rosa, drawn: { finder: ["search"] }, values: { "wz-subject": lt.P2 } });
  await g.enter("home");
  await g.start({ script: w.script });
  assert.deepEqual(g.nav, [], "the screen is not opened on `Nothing is here`");
  assert.ok(g.text().includes(unhtml(word("wizard.subject.project"))));
  assert.deepEqual(g.requests.filter((r) => r.op === "projectlist").length, 1);
  const html = g.render();
  const mine = (await lt.rosa.read("projectlist")).projects;
  assert.ok(html.includes('id="wz-subject"') && mine.every((x) => html.includes(x.name)), "the member's projects, as data");
  assert.ok(!html.includes('data-guide="next"'), "the choice is made before going on");
  await g.control("subjectgo");
  assert.deepEqual(g.nav, [["timeline", lt.P2]]);
  // the subject chosen is kept for the run: the plan is opened on it again, never asked again
  await g.control("next");
  await g.control("next");
  assert.deepEqual(g.nav.at(-1), ["timeline", lt.P2]);
  assert.equal(g.requests.filter((r) => r.op === "projectlist").length, 1, "asked once");
  // the subject is in the page's memory only
  assert.deepEqual([...g.store.keys()], []);
});

test("R17 with no project to choose it says wizard.subject.none.project in a fold whose summary is wizard.subject.none.summary, open, and offers Next", async () => {
  const lt = await team();
  const w = await authored(lt, { name: "Plan it", steps: STEPS, widen: true });
  const g = standIn({ team: lt, as: lt.ivy, drawn: { finder: ["search"] } });
  await g.start({ script: w.script });
  const html = g.render();
  assert.ok(/<details[^>]* open[ >]/.test(html), "open whenever drawn");
  assert.ok(unhtml(html.match(/<summary>(.*?)<\/summary>/)[1]) === unhtml(word("wizard.subject.none.summary")));
  assert.ok(g.text().includes(unhtml(word("wizard.subject.none.project"))));
  assert.ok(html.includes('data-guide="next"') && !html.includes('id="wz-subject"'));
  assert.deepEqual(g.nav, []);
  await g.control("next");
  assert.deepEqual(g.nav, [["finder", null]], "Next goes on to the next step");
});

test("R17 a step on a screen that needs no subject opens at once; a question or a document is no longer asked, R20 opens the most recent", async () => {
  const lt = await team();
  const subj = await withSubjects(lt, { questions: 1, documents: 1 });
  const doc = await authored(lt, { name: "Look then read", steps: [{ screen: "finder", act: "search", what: "a", why: "b" }, { screen: "document", act: null, what: "c", why: "d" }] });
  const g = standIn({ team: lt, as: lt.mai, drawn: { finder: ["search"] } });
  await g.start({ script: doc.script });
  assert.deepEqual(g.nav, [["finder", null]]);
  assert.deepEqual(g.requests.filter((r) => r.op === "projectlist" || r.op === "list"), []);
  // a document: read (`list` of type `information`), then the most recent opened, no choice drawn
  await g.control("next");
  assert.deepEqual(g.nav.at(-1), ["document", subj.documents[0]]);
  assert.deepEqual(g.requests.filter((r) => r.op === "list").map((r) => r.query), [{ type: "information", limit: "500" }]);
  assert.ok(!g.render().includes('id="wz-subject"'));
  // a question is read the same way (`list` of type `inquiry`)
  const ques = await authored(lt, { name: "Read the question", steps: [{ screen: "question", act: null, what: "a", why: "b" }] });
  const q = standIn({ team: lt, as: lt.mai });
  await q.start({ script: ques.script });
  assert.deepEqual(q.requests.filter((r) => r.op === "list").map((r) => r.query), [{ type: "inquiry", limit: "500" }]);
  assert.deepEqual(q.nav, [["question", subj.questions[0]]]);
  assert.ok(!q.render().includes('id="wz-subject"'), "R20 amends R17: no choice for a question");
  // control: a subject the run already holds for the screen (the member is on it) is not asked
  const plan = await authored(lt, { name: "Plan it", steps: STEPS });
  const h = standIn({ team: lt, as: lt.mai });
  await h.enter("project", lt.P1);
  await h.start({ script: plan.script });
  assert.deepEqual(h.nav, [["timeline", lt.P1]]);
  assert.equal(h.requests.filter((r) => r.op === "projectlist").length, 0);
});
