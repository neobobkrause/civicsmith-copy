/* screens-inquiry R5 (with interface-shell R5, R8–R13 and R16 on this module's screens), on the shell's served page: each
 * screen with each of its reads answered pending, refused and not at all draws every read in its own state and no key
 * the page holds no word for; every grade is one mark, the scale's name and the letter; every record item named is a
 * reference; each screen draws only its registry acts, every act its requirements name among them, each an op `OPS`
 * holds, and the shell serves the module's screens (its R21 check). Words by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interfacePage } from "../../../src/interface-shell/index.mjs";
import { OPS, BROWSER_ACTS } from "../../../src/op-declarations/index.mjs";
import { refusedIn, silent, pending, ok, boot } from "../interface-shell/harness.mjs";
import { open, main, rawKeys, plane, word, inquiryMd, INQUIRY_REFS, LEGS, SCREENS, storeWorld, P, Q, D } from "./fixtures.mjs";

const REGISTRY = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const PATHS = { project: "/app/project/" + P, question: "/app/question/" + Q, document: "/app/document/" + D, projectai: "/app/projectai/" + P };
/* the reads each screen draws in one of the four states, by the screen's own read names (N1073: the ops are read from its
   declaration, never hand-listed); the rest feed what is drawn (titles, choices); the document's reading and versions are
   the reads it makes once its digest and address are read */
const DRAWN_READS = { project: ["stage", "bar", "questions", "others", "participants", "visibility"], question: ["strength", "waits", "hunches"],
  document: ["backlinks"], projectai: ["state", "keepaway"] };
const LATER = { project: ["projectaccountstate"], document: ["reading", "versionchain"], projectai: ["accountuses", "ailimits", "aiusage", "accounthistory"] };
const DRAWN = Object.fromEntries(Object.entries(DRAWN_READS).map(([id, names]) => {
  const reads = SCREENS.find((s) => s.id === id).reads({ subject: "X-1" });
  return [id, names.map((n) => reads[n].op).concat(LATER[id] || [])];
}));
/* the question with its partition held (state a), so its strength is drawn */
const GROUPED = { [Q]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs: LEGS.map((l) => (l.target === D ? { ...l, ground: "part 1" } : l)),
  grounds: [{ ground: "part 1", asserted_by: "member:dev", at: "2026-10-05T09:00:00Z" }] }) } };
/* projectai's reads answered as an owner of the project reads them (R14), so every one is drawn: the world's own answers to `mai`, who started the project and holds a key for it (her password
   again, the key set and switched on), read once and played back */
const AI = await (async () => {
  const world = await storeWorld({ ai: true });
  const mai = await world.signIn("mai", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(mai, "Pothole repairs");
  await mai.act("reauth", { body: { password: mai.password } });
  await mai.act("projectkeyset", { body: { project, key: "sk-ant-api03-" + "7".repeat(40) } });
  await mai.act("projectaccountswitch", { body: { project, on: true } });
  const owner = "project:" + project;
  const read = async (op, query) => ok(await mai.read(op, { query }));
  return { projectparticipants: await read("projectparticipants", { projectId: project }), projectaccountstate: await read("projectaccountstate", { project }),
    projectkeynotice: await read("projectkeynotice", { project }), projectaikeepawaystate: await read("projectaikeepawaystate", { project }),
    accountuses: await read("accountuses", { owner }), ailimits: await read("ailimits", { owner }), aiusage: await read("aiusage", { owner }), accounthistory: await read("accounthistory", { owner }) };
})();
/* the project page with a graded question on it: the world's own project is shown with its question unrated, so this one is made by real acts in a world of its own: `ann`'s project with a question
   resting on a staff directory (its connection graded B by resolution) and on a held page (graded on the capture axis) */
const GRADED = await (async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  const names = ["Jane Smith", "Raj Patel", "Maria Lopez", "Tom Chen", "Ana Diaz", "Lee Park"];
  const dir = await world.recipes.hold(ann, "Staff directory", `<html><head><title>Staff Directory</title></head><body><h1>Staff Directory</h1><table>${names.map((n, i) => `<tr><td>${n}</td><td>${n.toLowerCase().replace(" ", ".")}@oaklandca.gov</td><td>510-238-${3000 + i}</td></tr>`).join("")}</table></body></html>`, project, { type: "text/html", read: true });
  const subject = (await ann.act("entitycreate", { body: { kind: "person", label: "Jane Smith", note: "A person the directory lists.", aliases: ["jane.smith@oaklandca.gov"] } })).entity_id;
  await ann.act("resolve", { body: { captureSha: dir.sha } });
  const memo = (await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.", project)).bundle;
  await world.recipes.question(ann, project, { title: "Is the city repairing reported potholes within seven days?", subject, draw: true, legs: [
    { target: dir.bundle, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" },
    { target: memo, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" }] });
  const { door, session } = world.boot(ann);
  return { open: async () => { const b = await boot({ screens: SCREENS, door, session, path: "/app/project/" + project }); await b.settle(); return b; } };
})();
const base = (id) => (id === "projectai" ? AI : {});
const VARIANTS = { refused: refusedIn("SOME_REFUSAL", "The plane refused this read."), silent, pending };
/* the registry acts this module's requirements do not name (reported to BOB, J3): every other act the registry lists for
   its screens is drawn (N1073: the acts are read from the registry, the owner's declaration, never hand-listed) */
const NOT_NAMED = { project: ["owed:projectstakeset K3230"], assistant: ["ask"] };
/* T50: the registry still owes `projectstakeset` (K3230, "owed:"); R53 draws it, re-pointed by interface-shell. Labels the requirements name by key. */
/* fix round 4 (R129): `readheld` on `document` is interface-shell's re-point (R117) until the registry lists it, labelled by the nearest held row until the design writes its own */
const OWED = { project: ["projectstakeset"], document: ["readheld"] };
const LABEL = { readheld: "document.read.title", citeimported: "act.owed_citeimported.label.question", withdrawimported: "act.owed_withdrawimported.label.question", projectstakeset: "stake.project.save", themeplace: { question: "theme.question.place", document: "theme.place" }, themepropose: "theme.propose", thread: "progression.thread.here",
  hashcopy: "shell.copy", revisioncompare: "screen.document.revisions.compare.act", linkopen: "act.owed_linkopen.label.document",
  declareorigin: "act.owed_declareorigin.label.document", projectclose: "screen.project.closenow.do", rerunread: "act.owed_rerunread.label.project", rerunpair: "act.owed_rerunpair.label.project" };
const NAMED = Object.fromEntries(REGISTRY.screens.filter((s) => SCREENS.some((x) => x.id === s.id))
  .map((s) => [s.id, s.acts.map((a) => a.op.replace(/^owed:(hashcopy|linkopen|revisioncompare|declareorigin|projectclose|rerunread|rerunpair|citeimported|withdrawimported) [A-Z]+-?\d+$/, "$1")).filter((op) => !(NOT_NAMED[s.id] || []).includes(op))]));

for (const [id, path] of Object.entries(PATHS)) {
  test(`R5 ${id}: each read pending, refused and unanswered is drawn in its own state, beside the rest, with no key drawn bare (interface-shell R5, R10)`, async () => {
    for (const op of DRAWN[id]) for (const [name, answer] of Object.entries(VARIANTS)) {
      const p = await open(path, { images: id === "question" ? GROUPED : {}, plane: { ...base(id), [op]: answer } });
      const m = main(p);
      assert.ok(m.querySelector("h1"), `${id} with ${op} ${name}: the screen stays`);
      const want = name === "pending" ? "loading" : "failed";
      assert.ok(m.querySelector(`[data-state="${want}"]`), `${id}: ${op} ${name} drawn ${want}`);
      /* the project draws one failed read of its own beside the overridden one (the question `Q2` its record cites, which the world does not hold), so the refusal's words are looked for among its failed states */
      if (name === "refused") assert.ok(m.querySelectorAll('[data-state="failed"]').some((e) => /The plane refused this read|SOME_REFUSAL/.test(e.textContent)), `${id}: ${op} refused, drawn by the refusal's words`);
      assert.deepEqual(rawKeys(p.root()), [], `${id} with ${op} ${name}`);
    }
  });

  if (id !== "projectai") test(`R5 ${id}: every grade is drawn as one mark (the scale's name and the letter), every record item named a reference to its screen`, async () => {
    const p = id === "project" ? await GRADED.open() : await open(path, { images: id === "question" ? GROUPED : {} });
    const m = main(p);
    const grades = m.querySelectorAll(".cs-grade");
    assert.ok(grades.length > 0);
    for (const g of grades) {
      const scale = g.getAttribute("data-scale");
      assert.ok(["capture", "connection", "testimony"].includes(scale));
      assert.match(g.textContent, new RegExp(`^${word("mark.scale." + scale + ".name")}[A-D]$`));
      /* the tip's text up to its first apostrophe, which the attribute carries escaped */
      assert.ok((g.getAttribute("data-tip") || "").includes(word("mark.grade.reading").split("'")[0]), "the grade explains itself");
    }
    const refs = m.querySelectorAll("a.cs-ref").map((a) => a.getAttribute("href"));
    assert.ok(refs.length > 0);
    for (const h of refs) assert.match(h, /^\/app\/(question|document|project|objective|contradiction|open-file|plan|timeline|calculation|standard)\//);
    for (const a of m.querySelectorAll("a.cs-ref")) assert.ok(a.getAttribute("data-tip"), "each reference carries its card");
  });
}

test("R5 the dock in every state of its reads draws no key bare", async () => {
  for (const op of ["accountreference", "aiusage", "agentpack"]) for (const answer of Object.values(VARIANTS)) {
    const p = await open(PATHS.question, { boot: { plane: { ...plane(), assistantstate: ok({ on: true }), accountreference: ok({ held: true }), [op]: answer } } });
    const b = p.root().querySelector('.cs-mast [data-shell="dock"]');
    if (b) { await p.click(b); await p.settle(); }
    assert.deepEqual(rawKeys(p.root()), [], op);
  }
});

test("R5 R14–R16 R25 R28–R33 R37 R41 each screen draws its requirements' acts, each the registry's, labelled by act.<op>.label.<screen>, each an op OPS holds; the shell serves them", () => {
  assert.equal(typeof interfacePage(SCREENS), "string", "interface-shell R21's check passes");
  for (const s of SCREENS) {
    const reg = REGISTRY.screens.find((x) => x.id === s.id);
    assert.ok(reg, `${s.id} is a registry screen`);
    const ops = s.acts.map((a) => a.op);
    assert.deepEqual([...ops].sort(), [...NAMED[s.id], ...(OWED[s.id] || [])].sort(), `${s.id}: exactly the acts its requirements name`);
    for (const op of ops) assert.ok(reg.acts.some((a) => a.op === op || a.op.startsWith(`owed:${op} `)) || (OWED[s.id] || []).includes(op), `${s.id}: ${op} is the registry's`);
    for (const a of s.acts) {
      assert.ok(Object.hasOwn(OPS, a.op) || Object.hasOwn(BROWSER_ACTS, a.op), `${a.op} in OPS or a browser act of op-declarations R76`);
      const named = LABEL[a.op];
      assert.equal(a.label, named ? (typeof named === "string" ? named : named[s.id]) : `act.${a.op}.label.${s.id}`);
      assert.ok(s.words.includes(a.label), `${a.label} listed`);
    }
  }
  assert.deepEqual(SCREENS.map((s) => s.id), ["project", "dash-project", "question", "document", "assistant", "projectai", "objective", "contradiction"]);
});
