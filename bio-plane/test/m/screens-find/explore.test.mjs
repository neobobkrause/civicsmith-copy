/* screens-find R108 (Screens `finder` A12; the registry's `explore` act on `finder`): "Explore connections" is offered on each Find
   result `explore` can start from (a browse row that is a document, person or organization; a document hit in "In titles, notes and
   details"; each "Subjects named" row), opens `explore` from that item and sends nothing; questions, actions and plans carry none.
   Find is booted alone through interface-shell's harness, with every word the word list holds, and a scripted plane. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, settle } from "../interface-shell/harness.mjs";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { finder } from "../../../src/screens-daily/finder.mjs";

const WORDS = Object.freeze(WORD_ROWS.map((r) => r[0]));
const main = (p) => p.doc.getElementById("cs-main");
const rowOf = (p, href) => { let r = main(p).querySelector(`a[href="${href}"]`); while (r && !(r.className || "").includes("cs-row")) r = r.parentNode; return r; };
// What the press sent: every request after it but the shell's own word read for the screen it opened (interface-shell's, not the act's).
const sentAfter = (p, before) => p.requests.slice(before).filter((r) => r.op !== "interfacewords");
const exploreIn = (el) => el.querySelectorAll('button[data-act="explore"]');
// The screens the rows open, as stand-ins, so each reference is a link and `explore` is a screen to go to.
const STUBS = ["question", "document", "person", "action", "plan", "explore"].map((id) => ({ id, reads: () => ({}), acts: [], render: () => "", words: [] }));

const BROWSE = ok({ truncated: false, total: 6, awaiting_review: 0, items: [
  { id: "NOTE-1", kind: "document", title: "Sewer note" },
  { id: "ENT-7", kind: "person", title: "L. Chen" },
  { id: "ENT-8", kind: "organization", title: "Water Board" },
  { id: "INQ-2026-0001-sewer", kind: "question", title: "Who pays for the sewer?" },
  { id: "ACT-3", kind: "action", title: "Ask the clerk for the ledger" },
  { id: "PLAN-4", kind: "plan", title: "Sewer fund plan" },
] });
const browsePlane = { lookedat: ok({ since: "2026-11-01T00:00:00Z" }), themeread: ok({ themes: [] }), browse: BROWSE };
const searchPlane = {
  searchfields: ok({ scopes: ["everything"] }),
  search: ok({ total: 3, limit: 50, offset: 0, hits: [
    { bundle_id: "NOTE-1", object_type: "information", title: "Sewer note", snippet: null },
    { bundle_id: "INQ-2026-0001-sewer", object_type: "inquiry", title: "Who pays for the sewer?", snippet: null },
    { bundle_id: "ACT-3", object_type: "action", title: "Ask the clerk for the ledger", snippet: null },
  ] }),
  meaningrows: ok({ total: 0, rows: [] }),
  subjectsnamed: ok({ count: 1, subjects: [{ entity_id: "ENT-9", label: "Water Board", kind: "organization", documents: 2 }] }),
};
const openFinder = async (path, plane) => {
  const p = await boot({ screens: [{ ...finder, words: WORDS }, ...STUBS], path, plane });
  await settle();
  return p;
};

test("R108: Find's acts hold `explore`, labelled by the word list's \"Explore connections\" for Find", () => {
  const a = finder.acts.find((x) => x.op === "explore");
  assert.ok(a, "explore is one of Find's acts");
  assert.equal(a.label, "act.explore.label.finder");
  assert.ok(word("act.explore.label.finder"), "the label is a word of the list");
});

test("R108: in the browse, a document, a person and an organization each offer Explore connections once", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  for (const href of ["/app/document/NOTE-1", "/app/person/ENT-7", "/app/person/ENT-8"]) {
    const row = rowOf(p, href);
    assert.ok(row, href + " is drawn");
    assert.equal(exploreIn(row).length, 1, href + " offers it");
    assert.equal(exploreIn(row)[0].textContent.trim(), word("act.explore.label.finder"));
  }
});

test("R108 control: in the browse, a question, an action and a plan carry none", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  for (const href of ["/app/question/INQ-2026-0001-sewer", "/app/action/ACT-3", "/app/plan/PLAN-4"]) {
    const row = rowOf(p, href);
    assert.ok(row, href + " is drawn");
    assert.equal(exploreIn(row).length, 0, href + " offers none");
  }
});

test("R108: pressing it on a browse document opens explore from that document and sends nothing", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  const before = p.requests.length;
  await p.click(exploreIn(rowOf(p, "/app/document/NOTE-1"))[0]);
  assert.equal(p.location.pathname, "/app/explore/NOTE-1");
  assert.deepEqual(sentAfter(p, before), [], "the act asks the plane nothing");
});

test("R108: pressing it on a browse organization opens explore from that organization", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  await p.click(exploreIn(rowOf(p, "/app/person/ENT-8"))[0]);
  assert.equal(p.location.pathname, "/app/explore/ENT-8");
});

test("R108: with words, a document hit and a subject named each offer it; a question or action hit offers none", async () => {
  const p = await openFinder("/app/finder/sewer", searchPlane);
  assert.equal(exploreIn(rowOf(p, "/app/document/NOTE-1")).length, 1);
  assert.equal(exploreIn(rowOf(p, "/app/question/INQ-2026-0001-sewer")).length, 0, "control: a question hit offers none");
  assert.equal(exploreIn(rowOf(p, "/app/action/ACT-3")).length, 0, "control: an action hit offers none");
  assert.equal(exploreIn(rowOf(p, "/app/person/ENT-9")).length, 1);
});

test("R108: with words, pressing it on a subject named opens explore from that subject and sends nothing", async () => {
  const p = await openFinder("/app/finder/sewer", searchPlane);
  const before = p.requests.length;
  await p.click(exploreIn(rowOf(p, "/app/person/ENT-9"))[0]);
  assert.equal(p.location.pathname, "/app/explore/ENT-9");
  assert.deepEqual(sentAfter(p, before), [], "the act asks the plane nothing");
});

test("R108 control: the act with no start named goes nowhere and sends nothing", () => {
  const a = finder.acts.find((x) => x.op === "explore");
  const went = [];
  const out = a.send({ ui: {} }, { dataset: {} }, { go: (...args) => went.push(args) });
  assert.equal(out, null);
  assert.deepEqual(went, []);
});
