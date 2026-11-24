/* interface-shell R105 and R106 (T51 fix round; C52, K4164; DEC-374 to DEC-377): a question opened from a project acts for that
   project (the second address part), and the six screens the design adds have their paths and the reference kinds that open them. */
import test from "node:test";
import assert from "node:assert/strict";
import { PATHS, REF_SCREENS, SETTINGS_SCREENS, PROJECT_PART } from "../../../src/interface-shell/index.mjs";
import { ADMIN_SCREENS } from "../../../src/wizard-scripts/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { boot, ok, ADMIN } from "./harness.mjs";
import { OPS, SESSION_OPS } from "../../../src/op-declarations/index.mjs";

/* ---------- R105 ---------- */

/* a stand-in for the question screen (a real registry id): it draws what the shell hands it */
const QUESTION = {
  id: "question", words: [],
  reads() { return {}; },
  render(cs, view) { return `<h1>q</h1><p id="who">${cs.esc(String(view.subject))}|${cs.esc(String(view.project))}</p>`; },
  acts: [],
};
/* a stand-in for a screen whose subject carries slashes of its own (R9: the whole of what follows the id) */
const TIMELINE = {
  id: "timeline", words: [],
  reads() { return {}; },
  render(cs, view) { return `<h1>t</h1><p id="who">${cs.esc(String(view.subject))}|${cs.esc(String(view.project))}</p>`; },
  acts: [],
};
const who = (p) => p.doc.getElementById("who") && p.doc.getElementById("who").textContent;
const nothing = (p) => p.root().querySelector('[data-unavailable="nothing"]');

test("R105 PROJECT_PART lists the question screen and no other", () => {
  assert.deepEqual([...PROJECT_PART], ["question"]);
});

test("R105 /app/question/<question>/<project> gives the screen the project as view.project and the question as its subject; the bare address gives none (control)", async () => {
  const withProject = await boot({ screens: [QUESTION], path: "/app/question/INQ-1/PROJ-B" });
  assert.equal(who(withProject), "INQ-1|PROJ-B");
  const bare = await boot({ screens: [QUESTION], path: "/app/question/INQ-1" });
  assert.equal(who(bare), "INQ-1|null", "the bare address carries no project part: the question's home project");
  const trailing = await boot({ screens: [QUESTION], path: "/app/question/INQ-1/" });
  assert.equal(who(trailing), "INQ-1|null", "a trailing slash is no second part");
});

test("R105 a second part given percent-encoded, or written `<id>/<project>` to a link, draws the same address and the same screen", async () => {
  const encoded = await boot({ screens: [QUESTION], path: "/app/question/INQ-1%2FPROJ-B" });
  assert.equal(who(encoded), "INQ-1|PROJ-B", "an encoded slash is the same two parts");
  const linker = { id: "home", words: [], reads() { return {}; }, acts: [], render(cs) { return cs.ref("question", "INQ-2/PROJ-C", "the question", ["f"]) + cs.ref("question", "INQ-2", "bare", ["f"]); } };
  const p = await boot({ screens: [linker, QUESTION], path: "/app" });
  const links = p.root().querySelectorAll("a.cs-ref");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["/app/question/INQ-2/PROJ-C", "/app/question/INQ-2"], "the project is its own second part of the address");
  await p.click(links[0]);
  assert.equal(p.location.pathname, "/app/question/INQ-2/PROJ-C");
  assert.equal(who(p), "INQ-2|PROJ-C", "following the link gives the screen the project");
  await p.back("/app");
  await p.click(p.root().querySelectorAll("a.cs-ref")[1]);
  assert.equal(who(p), "INQ-2|null", "control: the bare link gives none");
});

test("R105 a malformed second part draws unavailable (Nothing is here) and no screen: empty, with a space, a ?, a # or a backslash, or a third part", async () => {
  for (const path of ["/app/question/INQ-1/%20", "/app/question/INQ-1/a%20b", "/app/question/INQ-1/a%3Fb", "/app/question/INQ-1/a%23b", "/app/question/INQ-1/a%5Cb",
    "/app/question/INQ-1/PROJ-B/extra", "/app/question/INQ-1%2F%2F", "/app/question/%2FPROJ-B", "/app/question/INQ-1/%00"]) {
    const p = await boot({ screens: [QUESTION], path });
    assert.ok(nothing(p), `${path} draws unavailable`);
    assert.equal(who(p), null, `${path} draws no screen`);
  }
});

test("R105 control: another screen's subject keeps the whole of what follows its id, slashes and all, and has no project part", async () => {
  const p = await boot({ screens: [TIMELINE], path: "/app/timeline/PROJ/lens/with space/e%3F" });
  assert.equal(who(p), "PROJ/lens/with space/e?|null");
  const q = await boot({ screens: [TIMELINE], path: "/app/timeline/PROJ/a/b/c" });
  assert.equal(who(q), "PROJ/a/b/c|null", "more than two parts is no malformation outside PROJECT_PART");
});

/* ---------- R106 ---------- */

const NEW = ["bias", "contradiction", "objective", "about-knocker", "leads", "watching"];
/* the drawings' `crumbs` (mock-screens.js SCR.<id>): the rail place, then the screen's own name */
const PLACES = { bias: ["settings"], contradiction: ["projects", "@project"], objective: ["projects", "@project"], "about-knocker": ["queue", "screen.inbox.name"], leads: ["add"], watching: ["add"] };

test("R106 PATHS holds the six screens from the drawings' crumbs, each ending in the screen's own name (a word held), and bias is the last of SETTINGS_SCREENS", () => {
  for (const id of NEW) {
    assert.deepEqual(PATHS[id], [...PLACES[id], `screen.${id}.name`], `${id}'s path`);
    assert.ok(hasWord(`screen.${id}.name`), `screen.${id}.name is a word`);
  }
  assert.equal(SETTINGS_SCREENS[SETTINGS_SCREENS.length - 1], "bias", "the drawing's 'For every member' follows the team's own");
  assert.ok(!ADMIN_SCREENS.includes("bias"), "the lens is read by every member");
  assert.equal(SETTINGS_SCREENS.filter((s) => s === "bias").length, 1);
});

test("R106 REF_SCREENS gains the kinds that open the six screens: a contradiction opens contradiction, a bias-debt item opens bias, a source opens about-knocker; control: an unknown kind opens nothing", () => {
  assert.equal(REF_SCREENS.contradiction, "contradiction");
  assert.equal(REF_SCREENS["bias-debt"], "bias");
  assert.equal(REF_SCREENS.bias, "bias");
  assert.equal(REF_SCREENS.source, "about-knocker");
  assert.equal(REF_SCREENS.objective, "objective");
  assert.equal(REF_SCREENS.leads, "leads");
  assert.equal(REF_SCREENS.watching, "watching");
  assert.equal(REF_SCREENS.nonesuch, undefined);
  assert.equal(REF_SCREENS.theme, "theme", "the kinds already held are unchanged");
});

const KINDS = [["contradiction", "contradiction"], ["bias-debt", "bias"], ["bias", "bias"], ["source", "about-knocker"], ["objective", "objective"], ["leads", "leads"], ["watching", "watching"]];
const LINKER = { id: "home", words: [], reads() { return {}; }, acts: [],
  render(cs) { return [...["contradiction", "bias-debt", "bias", "source", "objective", "leads", "watching", "nonesuch"]].map((k) => cs.ref(k, "X-1", "the " + k, ["a fact"])).join(" "); } };

for (const [kind, screen] of KINDS) {
  test(`R106 a reference of kind ${kind} opens ${screen} where it is registered, and is a card only where it is not; its card holds the item's own facts and no empty heading`, async () => {
    const registered = SCREEN_REGISTRY.some((r) => r.id === screen);
    const target = { id: screen, words: [], reads() { return {}; }, acts: [], render(cs, view) { return `<h1>x</h1><p id="who">${cs.esc(String(view.subject))}</p>`; } };
    const p = await boot({ screens: registered ? [LINKER, target] : [LINKER], path: "/app" });
    const el = p.root().querySelectorAll("a.cs-ref, span.cs-card").find((e) => e.textContent === "the " + kind);
    assert.ok(el, "the reference is drawn");
    const tip = el.getAttribute("data-tip") || "";
    assert.ok(tip.includes("a fact"), "the item's own facts");
    assert.ok(!tip.includes("<b></b>"), "no empty heading for a kind whose card word is not held");
    if (registered) {
      assert.equal(el.getAttribute("href"), `/app/${screen}/X-1`);
      await p.click(el);
      assert.equal(p.location.pathname, `/app/${screen}/X-1`);
      assert.equal(p.doc.getElementById("who").textContent, "X-1", "the screen opens at the item");
    } else {
      /* the registry (wizard-scripts) is generated at an older design commit and does not yet hold the screen (R101's BOB act): no link to a screen that cannot be served */
      assert.equal(el.localName, "span", `${screen} is not yet in SCREEN_REGISTRY: a card only`);
      assert.equal(el.getAttribute("href"), null);
    }
  });
}

test("R106 control: an unknown kind still draws no link", async () => {
  const p = await boot({ screens: [LINKER], path: "/app" });
  const el = p.root().querySelectorAll("a.cs-ref, span.cs-card").find((e) => e.textContent === "the nonesuch");
  assert.ok(el);
  assert.equal(el.localName, "span");
  assert.equal(el.getAttribute("href"), null);
});

for (const id of NEW) {
  test(`R106 ${id}: where it is registered the page draws its path and its crumb; where it is not, /app/${id} is Nothing is here`, async () => {
    const registered = SCREEN_REGISTRY.some((r) => r.id === id);
    const spec = { id, words: [], reads() { return {}; }, acts: [], render(cs) { return "<h1>x</h1>"; },
      place() { return { project: { id: "PROJ-1", title: "Coliseum lease" } }; } };
    const p = await boot({ screens: registered ? [spec] : [], path: `/app/${id}/S-1` });
    if (!registered) {
      assert.ok(nothing(p), "an unregistered screen is Nothing is here (R9)");
      return;
    }
    const crumbs = p.root().querySelector(".cs-crumbs");
    assert.ok(crumbs, "the path is drawn");
    const steps = crumbs.textContent.split("›").map((t) => t.trim());
    const place = PLACES[id][0];
    assert.equal(steps[0], textOf(word(`rail.${place}.name`)), "its rail place first");
    assert.equal(steps[steps.length - 1], textOf(word(`screen.${id}.name`)), "its own name last");
    if (PLACES[id][1] === "@project") assert.equal(steps[1], "Coliseum lease", "a project's step is its title as read");
    if (id === "about-knocker") assert.equal(steps[1], textOf(word("screen.inbox.name")));
    assert.equal(crumbs.querySelector("[aria-current]").textContent, steps[steps.length - 1]);
  });
}
const textOf = (s) => String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();

/* ---------- R110 ---------- */

/* a stand-in for `standard` (a real registry id) whose `place` answers what the test sets (built from source: a screen's function is self-contained) */
const standardWith = (placed, words = []) => ({ id: "standard", words, reads() { return {}; }, acts: [], render() { return "<h1>x</h1>"; }, place: new Function("view", `return ${JSON.stringify(placed)};`) });
const stepsOf = async (placed, words) => {
  const p = await boot({ screens: [standardWith(placed, words)], path: "/app/standard/S-1" });
  return p.root().querySelector(".cs-crumbs").textContent.split("›").map((t) => t.trim());
};

test("R110 place answering {project, last} draws the standard's crumb filled with the name last, the project's title before it; a name that is also a word key is drawn as typed", async () => {
  const project = { id: "PROJ-1", title: "Coliseum lease" };
  const steps = await stepsOf({ project, last: "AB 32 & 5" });
  assert.equal(steps.length, 3);
  assert.equal(steps[1], "Coliseum lease");
  assert.equal(steps[2], word("screen.standard.crumb", { name: "AB 32 & 5" }));
  const typed = await stepsOf({ project, last: "screen.standard.name" });
  assert.equal(typed[2], textOf(word("screen.standard.crumb", { name: "screen.standard.name" })), "data, never read as a key");
});

test("R110 control: a place answering a string, {project} alone or an empty last keeps today's crumb; another screen's path is unchanged", async () => {
  const project = { id: "PROJ-1", title: "Coliseum lease" };
  for (const placed of [{ project }, { project, last: "" }, { project, last: 7 }]) {
    const steps = await stepsOf(placed);
    assert.equal(steps[1], "Coliseum lease");
    assert.equal(steps[2], textOf(word("screen.standard.name")));
  }
  assert.equal((await stepsOf("a string")).pop(), textOf(word("screen.standard.name")));
  const q = await boot({ screens: [{ id: "calculation", words: [], reads() { return {}; }, acts: [], render() { return "<h1>x</h1>"; }, place: () => ({ project: { id: "P", title: "T" }, last: "ignored" }) }], path: "/app/calculation/C-1" });
  assert.equal(q.root().querySelector(".cs-crumbs").textContent.split("›").pop().trim(), textOf(word("screen.calculation.name")));
});

/* ---------- R110: projectKey (B22; screens-publish R68) ---------- */

test("R110 place answering projectKey draws that word in place of the project's title, {name} the title escaped, the last step unchanged", async () => {
  const project = { id: "PROJ-1", title: "Lease <b>&" };
  const steps = await stepsOf({ project, last: "AB 32", projectKey: "crumb.project.unjoined" }, ["crumb.project.unjoined"]);
  assert.equal(steps.length, 3);
  assert.equal(steps[1], textOf(word("crumb.project.unjoined")));
  assert.equal(steps[2], word("screen.standard.crumb", { name: "AB 32" }));
  /* a key whose word holds {name} gets the title, as data */
  const named = await boot({ screens: [standardWith({ project, projectKey: "screen.standard.crumb" }, ["screen.standard.crumb"])], path: "/app/standard/S-1" });
  assert.ok(named.root().querySelector(".cs-crumbs").textContent.split("›")[1].trim().endsWith("Lease <b>&"), "the title, as typed, fills {name}");
  assert.ok(named.root().querySelector(".cs-crumbs").innerHTML.includes("Lease &lt;b&gt;&amp;"), "the title is data, never markup");
});

test("R110 control: a place answering no projectKey, an unknown key or a non-string draws the project's title as before", async () => {
  const project = { id: "PROJ-1", title: "Coliseum lease" };
  for (const projectKey of [undefined, "no.such.word.key", 7, ""]) assert.equal((await stepsOf({ project, last: "AB 32", projectKey }))[1], "Coliseum lease");
});

/* ---------- R12: a read is gated by its classes (B23, K4237) ---------- */

const gateScreen = (id, ops) => ({ id, words: [], reads() { return {}; }, acts: ops.map((op) => ({ op })), render: new Function("cs", `return ${JSON.stringify(ops)}.map(function (o) { return cs.act(o); }).join("");`) });
const drawnOps = async (id, ops, who, path) => {
  const p = await boot({ screens: [gateScreen(id, ops)], path, plane: { whoami: ok(who) } });
  return ops.filter((op) => p.root().querySelector(`button[data-act="${op}"]`));
};

test("R12 a read in no session set whose classes hold the session's class is drawn (selftest, runtime, exportlog, biasmanifest, biasinhale, biasdebt); a public read (bootstrap) too", async () => {
  const reads = { updates: ["selftest", "runtime", "bootstrap"], group: ["exportlog"], bias: ["biasmanifest", "biasinhale", "biasdebt"] };
  const who = { ...ADMIN, capabilities: ["contribute", "administer", "create_projects", "publish"] };
  for (const [id, ops] of Object.entries(reads)) for (const op of ops) assert.equal(SESSION_OPS.member.has(op) || SESSION_OPS.admin.has(op), false, op + " is in no set");
  for (const tokenClass of ["admin", "member"]) for (const [id, ops] of Object.entries(reads)) assert.deepEqual(await drawnOps(id, ops, { ...who, tokenClass }, "/app/" + id), ops, id + " as " + tokenClass);
});

test("R12 control: a mutating op outside the set is not drawn, and a read whose classes exclude the session's class is not drawn", async () => {
  const who = { ...ADMIN, capabilities: ["contribute", "administer", "create_projects", "publish"] };
  assert.equal(OPS.export.mutating, true);
  assert.deepEqual(await drawnOps("group", ["export"], who, "/app/group"), [], "export mutates and no set holds it");
  assert.equal(OPS.selftest.classes.includes("agent"), false);
  assert.deepEqual(await drawnOps("updates", ["selftest"], { ...who, tokenClass: "agent" }, "/app/updates"), [], "a class the read does not list");
});

/* K4259: a kind with no `shell.card.<kind>` word is drawn with the item's facts alone, nothing if it has none, as `theme` is */
const BARE = { id: "home", words: [], reads() { return {}; }, acts: [],
  render(cs) { return [cs.ref("objective", "X-1", "bare", []), cs.ref("objective", "X-1", "bare-null", [null, ""]), cs.ref("published", "X-1", "word", [])].join(" "); } };

test("R106 an objective reference with no facts draws no empty lead and no card; control: published keeps its word", async () => {
  assert.ok(!hasWord("shell.card.objective"), "the kind holds no card word");
  assert.ok(hasWord("shell.card.published"));
  const p = await boot({ screens: [BARE], path: "/app" });
  const find = (t) => p.root().querySelectorAll("a.cs-ref, span.cs-card").find((e) => e.textContent === t);
  for (const t of ["bare", "bare-null"]) {
    const tip = find(t).getAttribute("data-tip");
    assert.ok(!tip || !tip.includes("<b></b>"), "no empty heading");
    assert.ok(!tip || !tip.includes("<b>"), "no lead of any kind: the item has no facts and the kind no word");
  }
  assert.ok((find("word").getAttribute("data-tip") || "").includes(word("shell.card.published")), "published unchanged");
});
