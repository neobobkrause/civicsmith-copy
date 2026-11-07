/* interface-shell-t53, attempt 2: the kit parts this module contributes to the page through interface-shell's hook (BOB ruling 7 Nov):
   R138's document picker and R141's machine label, each run in the page the shell composes, over the shell's own test harness.
   fixtures-own: input the documents a stand-in screen hands the picker (the picker's own input shape, `{id, title, date, project,
   project_name, files}`), and the stand-in screens themselves; the AI's display name is the catalogue's own development seed entry (ai-catalogue). */
import "../interface-shell/register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, refused, MEMBER } from "../interface-shell/harness.mjs";
import { interfaceScript } from "../../../src/interface-shell/index.mjs";
import { word, WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { DEVELOPMENT_SEED_PAYLOAD } from "../../../src/ai-catalogue/index.mjs";
import { CONTRIBUTION, MACHINE_KINDS } from "../../../src/interface-shell-t53/index.mjs";

const plainWord = (k, f) => word(k, f);
const textOf = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

/* ---------- R138: the picker ---------- */
const A = [{ id: "INFO-a1", title: "Council minutes", date: "2026-03-02", project: "P-A", project_name: "Parks" },
  { id: "INFO-a2", title: "Budget memo", date: "2026-04-10", project: "P-A", project_name: "Parks" }];
const B = [{ id: "INFO-b1", title: "Zoning letter", date: "2026-05-01", project: "P-B", project_name: "Housing" },
  { id: "INFO-a1", title: "Council minutes", date: "2026-03-02", project: "P-A", project_name: "Parks" },
  { id: "INFO-n1", title: "Loose scan", date: "2026-01-09", project: null }];
/* a screen's functions are serialized by their own text (R21), so the stand-in's are built from source, its options carried as data */
const PICKING = (o = {}) => {
  const opt = JSON.stringify({ project: o.project === undefined ? "P-A" : o.project, single: !!o.single });
  return { id: "home", acts: [],
    reads: new Function("view", `const o = ${opt}; const wide = Array.isArray(view.ui["pick:doc:wide"]) && view.ui["pick:doc:wide"].length > 0;
      return Object.assign({}, o.project === null ? {} : { here: { op: "search", query: { scope: "P-A" } } }, o.project === null || wide ? { others: { op: "search", query: { widen: "1" } } } : {});`),
    render: new Function("cs", "view", `const o = ${opt}; return '<div id="t">' + cs.picker(view, "doc", { project: o.project, here: view.data.here, others: view.data.others, single: o.single })
      + '<p id="chosen">' + cs.esc(view.ui["pick:doc"] || "-") + "</p></div>";`) };
};
const planeOf = (here, others) => ({ search: (req) => (req.query && req.query.widen ? others : here) });
const rows = (p, scope) => p.doc.querySelectorAll('[data-picker="doc"] [data-scope="' + scope + '"] input[type="radio"]');
const labelsOf = (p, scope) => rows(p, scope).map((i) => textOf(i.parentElement));
const control = (p) => p.doc.querySelector('[data-picker="doc"] #doc-wide');

test("R138 the picker opens with the screen's own project's documents, each by title and date, and the control beneath them; pressing the control adds the other projects' documents, each under its project, the first scope's rows not repeated", async () => {
  const p = await boot({ screens: [PICKING()], path: "/app/home", plane: planeOf(ok({ items: A }), ok({ items: B })) });
  assert.deepEqual(rows(p, "here").map((i) => i.value), ["INFO-a1", "INFO-a2"]);
  assert.ok(labelsOf(p, "here")[0].startsWith("Council minutes · "), "title then date");
  assert.equal(rows(p, "others").length, 0, "the second scope is not drawn before the control is pressed");
  assert.equal(p.byOp("search").filter((r) => r.query.widen).length, 0, "nor read");
  assert.ok(control(p), "the control is drawn");
  assert.ok(textOf(control(p)).includes(plainWord("form.choose.widen.documents")));
  await p.choose("#doc-wide-0");
  assert.equal(p.byOp("search").filter((r) => r.query.widen).length, 1, "pressing it reads the second scope once");
  assert.deepEqual(rows(p, "others").map((i) => i.value), ["INFO-b1", "INFO-n1"], "B's and the projectless document, A's not repeated");
  const legends = p.doc.querySelectorAll('[data-scope="others"] legend').map(textOf);
  assert.deepEqual(legends, ["Housing", plainWord("screen.document.pick.noproject")], "each row named by its project's heading; no project says so");
  assert.equal(control(p), null, "once pressed, the control is gone");
});

test("R138 a document chosen from the second scope is the choice, and stays chosen when the list redraws", async () => {
  const p = await boot({ screens: [PICKING()], path: "/app/home", plane: planeOf(ok({ items: A }), ok({ items: B })) });
  await p.choose("#doc-wide-0");
  await p.choose(rows(p, "others")[0]);
  assert.equal(p.doc.getElementById("chosen").textContent, "INFO-b1");
  assert.equal(rows(p, "others")[0].checked, true);
  assert.equal(rows(p, "here").filter((i) => i.checked).length, 0, "only the one chosen");
});

test("R138 typing a name that matches nothing shown draws the none-found sentence, and the control is still offered", async () => {
  const p = await boot({ screens: [PICKING()], path: "/app/home", plane: planeOf(ok({ items: A }), ok({ items: B })) });
  const q = p.doc.getElementById("doc-q");
  assert.ok(q, "the picker's search");
  assert.equal(textOf(p.doc.querySelector('label[for="doc-q"]')), plainWord("screen.document.pick.find"));
  q.value = "zoning";
  p.fire(q, "input");
  await p.clock.tick(600);
  assert.equal(rows(p, "here").length, 0);
  const none = p.doc.querySelector("[data-none]");
  assert.ok(none, "the none-found sentence");
  assert.equal(textOf(none), plainWord("screen.document.pick.none", { text: "zoning" }));
  assert.ok(control(p), "the control is still offered");
  await p.choose("#doc-wide-0");
  assert.deepEqual(rows(p, "others").map((i) => i.value), ["INFO-b1"], "typing narrows the second scope too");
  assert.equal(p.doc.querySelector("[data-none]"), null);
});

test("R138 a screen with no project draws one list, each row under its project, and no control", async () => {
  const p = await boot({ screens: [PICKING({ project: null })], path: "/app/home", plane: planeOf(ok({ items: A }), ok({ items: A.concat(B) })) });
  assert.equal(p.doc.querySelector('[data-scope="here"]'), null);
  assert.deepEqual(rows(p, "others").map((i) => i.value), ["INFO-a1", "INFO-a2", "INFO-b1", "INFO-n1"]);
  assert.deepEqual(p.doc.querySelectorAll('[data-scope="others"] legend').map(textOf), ["Parks", "Housing", plainWord("screen.document.pick.noproject")]);
  assert.equal(control(p), null);
});

test("R138 controls: a member who sees one project's documents only is drawn no control; a failed second scope is drawn failed, never empty, and the first stands", async () => {
  const one = await boot({ screens: [PICKING({ single: true })], path: "/app/home", plane: planeOf(ok({ items: A }), ok({ items: B })) });
  assert.equal(control(one), null);
  assert.equal(rows(one, "here").length, 2);
  const p = await boot({ screens: [PICKING()], path: "/app/home", plane: planeOf(ok({ items: A }), refused("SEARCH_FAILED")) });
  await p.choose("#doc-wide-0");
  const failed = p.doc.querySelector('[data-scope="others"] .cs-state');
  assert.equal(failed && failed.getAttribute("data-state"), "failed");
  assert.equal(rows(p, "here").length, 2, "the first scope stands");
});

test("R138 an archive keeps its files with it, each a document, labelled with its archive; paging's statement holds per scope", async () => {
  const arch = [{ id: "INFO-z", title: "Box 4", project: "P-A", files: [{ id: "INFO-z1", title: "Page one" }, { id: "INFO-z2", title: "Page two" }] }];
  const p = await boot({ screens: [PICKING()], path: "/app/home", plane: planeOf(ok({ items: arch, more: 12 }), ok({ items: B })) });
  assert.deepEqual(rows(p, "here").map((i) => i.value), ["INFO-z1", "INFO-z2"]);
  assert.ok(labelsOf(p, "here")[0].endsWith(plainWord("screen.document.pick.member", { archive: "Box 4" })));
  assert.equal(textOf(p.doc.querySelector('[data-more="here"]')), plainWord("screen.document.pick.more", { count: 12 }));
  assert.equal(p.doc.querySelector('[data-more="others"]'), null);
});

/* ---------- R141: the machine label ---------- */
const AI = DEVELOPMENT_SEED_PAYLOAD.entries[0].display_name;
const LABELS = { id: "home", reads: () => ({}), acts: [],
  render: new Function("cs", `const AI = ${JSON.stringify(AI)}; return '<div id="m"><p id="m1">' + cs.machine("draft.asked", { label: { display_name: AI, provider: "x" }, handle: "mai" }) + "</p>"
    + '<p id="m2">' + cs.machine("proposed", { label: { display_name: AI } }) + "</p>"
    + '<p id="m3">' + cs.machine("draft", { label: { provider: "x" }, account: "Mai's account" }) + "</p></div>";`) };

test("R141 a draft made by an AI named in the result's label data draws the label with that name and the tooltip", async () => {
  const p = await boot({ screens: [LABELS], path: "/app/home" });
  const m1 = p.doc.querySelector("#m1 [data-machine]");
  assert.ok(m1);
  assert.equal(textOf(m1), plainWord("screen.machine.draft.asked.ai", { ai: AI, handle: "mai" }));
  /* an explanation is HTML, held in the attribute as the shell's own are (its words escaped once) */
  const unesc = (h) => h.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  assert.equal(unesc(m1.getAttribute("data-tip")), plainWord("screen.machine.ai.tip"));
  assert.equal(textOf(p.doc.querySelector("#m2 [data-machine]")), plainWord("screen.machine.proposed.ai", { ai: AI }));
  for (const k of MACHINE_KINDS) assert.ok(CONTRIBUTION.data.t53.words["screen.machine." + k + ".ai"], k);
});

test("R141 control: no label holds an account's name; a result whose label data names no AI draws no machine label", async () => {
  const p = await boot({ screens: [LABELS], path: "/app/home" });
  assert.ok(p.doc.querySelector("#m1 [data-machine]"), "the same page draws a label that names its AI");
  assert.equal(p.doc.querySelector("#m3 [data-machine]"), null);
  assert.ok(!textOf(p.doc.getElementById("m")).includes("Mai's account"));
});

test("the contribution reaches the page: its kit parts are in the page's script, and its words are the word table's", () => {
  const script = interfaceScript([LABELS]);
  assert.ok(script.includes('"t53"'));
  const table = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  for (const [k, v] of Object.entries(CONTRIBUTION.data.t53.words)) assert.equal(v, table.get(k), k);
});
