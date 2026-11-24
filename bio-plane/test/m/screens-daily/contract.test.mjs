/* screens-daily against interface-shell R21's screen contract and R7's common rules, at the module's interface
   (`SCREENS`) and on the real served page (interface-shell's harness). It holds no sentence's English (R34): its words are keys. The registry is read from git at
   6f0d88d8d5, PR #33's head as merged into `tranche/T47` at L11's START (wizard-scripts R35, K3127), so a later edit of the
   working copy does not move it. Since T48 (wizard-scripts R38) it is read at PR #34's merge, 4664e8efd4: `elsewhere` (no acts),
   the queue's `owed:updatelater`, Home's item acts. */
import "../../sandbox.mjs";
import { storeWorld } from "../store-request/fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCREENS } from "../../../src/screens-daily/index.mjs";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { checkScreens, interfacePage, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { nestedTips, accessibleName, controls } from "../interface-shell/harness.mjs";
import { open as openRaw, main, text, ops, refused, textNodes, wordChecker } from "./page.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
// The registry is the design's (shell R73, N1122): read from the working copy, never a commit. An owed act (`owed:<op> K…`) is
// that op once declared (wizard-scripts R13) and is drawn only then (interface-shell R12): until `OPS` holds it, it is left out.
const REGISTRY = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8")).screens
  .map((r) => ({ ...r, acts: r.acts.filter((a) => !String(a.op).startsWith("owed:") || OPS[String(a.op).replace(/^owed:/, "").split(" ")[0]])
    .map((a) => ({ ...a, op: String(a.op).replace(/^owed:/, "").split(" ")[0] })) }));
const byId = Object.fromEntries(SCREENS.map((s) => [s.id, s]));
const SCREEN_IDS = SCREENS.map((s) => s.id);
// The acts a screen draws are the registry's for it (the owner's declaration, N1073: read, never listed here), with a named
// re-point of the shell (interface-shell R21: R29's "Join" on Home and Projects, until the registry lists it there). Since B21
// (DEC-389) Home and the queue draw `release` ("Vouch for photos") and `filingapprove` themselves, where the design draws them.
const EXPECTED = Object.fromEntries(REGISTRY.filter((r) => SCREEN_IDS.includes(r.id)).map((r) => [r.id,
  [...new Set([...r.acts.map((a) => a.op), ...(RE_POINTS[r.id] || [])])]]));

test("R1–R6, R10, R15 (interface-shell R21): SCREENS is the seven registry screens home, elsewhere, projects, queue, finder, find-in, answers, each {id, reads, render, acts, words}", () => {
  assert.deepEqual(SCREENS.map((s) => s.id), ["home", "elsewhere", "projects", "queue", "finder", "find-in", "answers"]);
  for (const s of SCREENS) {
    assert.ok(REGISTRY.some((r) => r.id === s.id), `${s.id} is a registry screen`);
    assert.equal(typeof s.reads, "function");
    assert.equal(typeof s.render, "function");
    assert.ok(Array.isArray(s.acts) && Array.isArray(s.words));
    assert.ok(Object.isFrozen(s));
  }
});

test("R1–R13 (interface-shell R21, R38): each screen's acts are exactly its registered acts, every op in OPS", () => {
  for (const s of SCREENS) {
    const reg = REGISTRY.find((r) => r.id === s.id).acts.map((a) => a.op);
    const mine = s.acts.map((a) => a.op);
    assert.deepEqual([...mine].sort(), [...EXPECTED[s.id]].sort(), s.id);
    for (const op of mine) {
      assert.ok(OPS[op], `${s.id}: ${op} is in OPS`);
      assert.ok(reg.includes(op) || (RE_POINTS[s.id] || []).includes(op), `${s.id}: ${op} is registered, or a named re-point`);
    }
    for (const op of reg) assert.ok(mine.includes(op), `${s.id}: registered ${op} is offered`);
    for (const a of s.acts) {
      assert.equal(typeof a.send, "function", `${s.id}.${a.op} send`);
      if (a.rereads) for (const r of a.rereads) assert.equal(typeof r, "string");
    }
  }
  // R5: finding records nothing (K1468): the find op is a read.
  assert.equal(OPS.findin.mutating, false);
  // R6: the plain-words question is ask, and "Show how this was counted" is ruleanswer, a read of `rule`.
  assert.equal(OP_ALIASES.ruleanswer, "rule");
});

test("R34 (K3366, K3368; interface-shell R5): every word a screen lists is a key of the word list, read through setup-words; the module holds no row of English", () => {
  for (const s of SCREENS) {
    assert.ok(Object.isFrozen(s.words), `${s.id}: its words are frozen`);
    for (const w of s.words) {
      assert.equal(typeof w, "string", `${s.id}: ${String(w)} is a key, not a row`);
      assert.ok(hasWord(w), `${s.id}: ${w} is a word of the list`);
    }
    assert.equal(new Set(s.words).size, s.words.length, `${s.id}: its keys are distinct`);
  }
  // DEC-256's retired rows are read by no screen.
  const all = new Set(SCREENS.flatMap((s) => s.words));
  for (const k of ["screen.home.strip.overdue", "screen.queue.due.overdue"]) assert.ok(!all.has(k), `${k} is retired`);
  // The module exports no sentence: its interface is SCREENS alone.
  return import("../../../src/screens-daily/index.mjs").then((m) => assert.deepEqual(Object.keys(m), ["SCREENS"]));
});

test("R34: every key the module's requirements name is a word of the list and is read by the screen that draws it", () => {
  const read = (id) => new Set(byId[id].words);
  for (const k of ["project.start.title", "project.start.title.help", "project.visibility.title", "project.visibility.start.hidden", "project.visibility.start.discoverable",
    "project.visibility.start.later", "project.start.go", "action.noreply.title", "member.founder.unnamed", "projects.empty.sub", "projects.empty.note", "refusal.ANSWER_MALFORMED"]) assert.ok(hasWord(k), k);
  for (const k of ["project.start.title", "project.start.go", "projects.empty.sub", "projects.empty.note", "member.founder.unnamed"]) assert.ok(read("projects").has(k), `projects reads ${k}`);
  for (const k of ["project.start.title", "project.start.go", "action.noreply.title", "member.founder.unnamed"]) assert.ok(read("home").has(k), `home reads ${k}`);
  for (const k of ["screen.findin.cite.supports", "screen.findin.cite.against", "screen.findin.cite.norole"]) assert.ok(read("find-in").has(k), `find-in reads ${k}`);
  assert.ok(read("answers").has("refusal.ANSWER_MALFORMED"));
  assert.ok(read("queue").has("action.noreply.title"));
});

/* Each screen drawn over the REAL store (store-request's `storeWorld()`, op-tables §5.3): a team with data (its founder, the team named and described, two
   projects, one with a participant and a question, a document held in it, an item in the founder's queue) and an empty one (its founder alone), all by the real
   acts. The reads that fail are the world's door with those ops refused (a store that did not answer). */
const teams = {};
const teamOf = (kind) => (teams[kind] ||= (async () => {
  const w = await storeWorld({ now: Date.now() });
  const rosa = await w.signIn("admin");
  if (kind === "empty") return { w, as: rosa, project: "PROJ-1" };
  const shut = await w.signIn("shut", { capabilities: [] });
  const mai = await w.signIn("mai");
  await rosa.act("groupnameset", { body: { name: "Lakeshore Tenants" } });
  await rosa.act("groupdescriptionset", { body: { kinds: ["community"], focus: "Rents.", purpose: "Rents.", visibility: "members" } });
  const project = await w.recipes.project(rosa, "Pothole repairs");
  await w.recipes.project(rosa, "Library hours");
  await rosa.act("projectinvite", { query: { projectId: project, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: project } });
  await w.recipes.question(rosa, project, { title: "Is it fixed?", text: "Is it fixed?", draw: true });
  await w.recipes.hold(rosa, "Pothole repairs report", "A report on the potholes.", project);
  await w.recipes.queue({ obligations: 1 });
  return { w, as: rosa, shut, project };
})());
/** Opens `path` as the team `kind` sees it ("full", "empty", or "shut": the full team's member who holds no capability); `over` is on top of the world's plane. */
const open = async (path, kind, over = {}) => {
  const t = await teamOf(kind === "shut" ? "full" : kind);
  return openRaw(path, over, t.w.boot(kind === "shut" ? t.shut : t.as));
};
const routesOf = async (kind) => {
  const { project } = await teamOf(kind);
  return { home: "/app", elsewhere: "/app/elsewhere", projects: "/app/projects", queue: "/app/queue", finder: "/app/finder/pothole", "find-in": "/app/find-in/" + project, answers: "/app/answers" };
};
/** The record's own data the full team's screens draw: every string its real `startfrom` carries (the profile's pointers, its scripts), and what the acts above wrote. */
async function dataOf() {
  const { w, as } = await teamOf("full");
  const strings = [];
  (function walk(v) { if (typeof v === "string") strings.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(await as.read("startfrom"));
  const { project } = await teamOf("full");
  return [...strings, "Lakeshore Tenants", "Rents.", "Pothole repairs", "Pothole repairs report", "Library hours", "Is it fixed?", "mai", "M", project, "pothole", "admin", "queue-member", "shut", "## Summary"];
}

test("R1–R10, R15 (interface-shell R21): the shell accepts the seven screens and serves them: each route draws its screen under its path", async () => {
  assert.equal(checkScreens(SCREENS), true);
  // The shell is one external versioned script with its hash (interface-shell R1, R2): no inline script, no nonce.
  const page = interfacePage(SCREENS);
  assert.match(page, /<script src="\/app\/shell-[^"]+\.js" integrity="sha256-[^"]+"><\/script>/);
  assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(page, /nonce/);
  for (const [id, path] of Object.entries(await routesOf("full"))) {
    const p = await open(path, "full");
    assert.ok(main(p).querySelector("nav.cs-crumbs [aria-current]"), `${id} under its path (interface-shell R8)`);
    assert.ok(main(p).querySelector("h1"), `${id} has its heading`);
  }
});

test("R7 (interface-shell R21 (1)): every function is self-contained: the page runs each from its own text, with nothing else in scope", async () => {
  // The page holds each screen's functions by their source (`toSource`), run in the page's scope, where no import of this
  // module exists: a function reaching outside its parameters and `cs` would throw there, and the screen not draw.
  for (const [id, path] of Object.entries(await routesOf("full"))) {
    const p = await open(path, "full");
    assert.ok(text(p).length > 20, `${id} drew from its own source`);
  }
});

test("R7 (interface-shell R5): every text node each screen draws, with data, empty and failed, is a word (filled) or the record's own data", async () => {
  const isWord = wordChecker(await dataOf());
  const FAIL = () => refused("STORE_DID_NOT_ANSWER", null, 502);
  const planes = {
    data: ["full", {}],
    empty: ["empty", {}],
    failed: ["empty", { queue: FAIL(), search: FAIL(), projectdirectory: FAIL(), projectlist: FAIL(), startfrom: FAIL() }],
  };
  for (const [state, [kind, over]] of Object.entries(planes)) for (const [id, path] of Object.entries(await routesOf(kind))) {
    const p = await open(path, kind, over);
    for (const t of textNodes(main(p)).map((n) => n.textContent.trim()).filter((t) => t && !/^[·:,.()›→\s]+$/.test(t)))
      assert.ok(isWord(t), `${id} (${state}) draws "${t}", which is no word`);
  }
});

test("R7 (interface-shell R12, R15, R22): an act the gate refuses is absent, never greyed; no explanation sits inside another; every control has a name and every field a label", async () => {
  for (const [id, path] of Object.entries(await routesOf("full"))) {
    const p = await open(path, "full");
    assert.equal(main(p).querySelectorAll("button[disabled]").length, 0, id);
    assert.deepEqual(nestedTips(main(p)).map((e) => e.outerHTML.slice(0, 80)), [], `${id}: no explanation inside another`);
    for (const c of controls(main(p))) assert.ok(accessibleName(c, p.doc), `${id}: ${c.outerHTML.slice(0, 80)} has a name`);
    const shut = await open(path, "shut");
    for (const op of ops(shut)) assert.ok(!["promote", "proposedispose", "adoptversion", "keepversion", "calculationcreate", "cite", "standarddeclare", "recordfact"].includes(op), `${id}: ${op} needs contribute`);
  }
});

test("R7 (interface-shell R13): each refusal word an act names is a listed word", () => {
  for (const s of SCREENS) {
    const listed = new Set(s.words);
    for (const a of s.acts) for (const [code, key] of Object.entries(a.refusals || {})) assert.ok(typeof key === "function" || listed.has(key), `${s.id}.${a.op}: ${code} → ${key}`);
  }
});

test("R7: after an act the screen re-reads what it changed: an act names only its own screen's reads to re-read, or all of them", () => {
  const readsOf = { home: ["group", "queue", "projects", "doors", "looked", "members", "boot", "places", "languages", "aiuse", "directory", "requests", "held"], elsewhere: ["door"], projects: ["projects", "themes", "directory", "requests"], queue: ["queue", "muted", "held", "inbox", "roster", "answered", "aside"], finder: ["search", "selection", "frontier_document", "frontier_content", "frontier_meaning", "frontier_internet", "lookedat", "themes", "theme", "browse"], "find-in": ["questions"], answers: ["search", "passages", "rules"] };
  for (const s of SCREENS) for (const a of s.acts) for (const r of a.rereads || []) assert.ok(readsOf[s.id].includes(r), `${s.id}.${a.op} rereads ${r}`);
  // R94 (interface-shell R113): the queue's acts each name the reads they change (the item resolved or muted leaves the list, R3), not all.
  for (const a of byId.queue.acts) assert.ok(Array.isArray(a.rereads) && a.rereads.length > 0 && a.rereads.includes(a.op === "release" ? "held" : "queue"), `queue.${a.op} names what it changes`);
  // R17: when the member last looked is read once per visit: no act of Home re-reads it.
  for (const a of byId.home.acts) assert.ok(Array.isArray(a.rereads) && !a.rereads.includes("looked"), `home.${a.op} never re-reads lookedsince`);
});
