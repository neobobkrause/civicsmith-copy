/* screens-find R4 (Find's acts are the registry's for `finder`, which lists `explore`, "Explore connections") and the Screens page
   `finder` A12: a result `explore` can start from (a document, a person or an organization) offers "Explore connections", which opens
   `explore` with that result as its start and sends nothing itself. Find is booted alone through interface-shell's harness, with every
   word the word list holds, and a scripted plane. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, settle } from "../interface-shell/harness.mjs";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { finder } from "../../../src/screens-daily/finder.mjs";

const WORDS = Object.freeze(WORD_ROWS.map((r) => r[0]));
const main = (p) => p.doc.getElementById("cs-main");
const rowOf = (p, href) => { let r = main(p).querySelector(`a[href="${href}"]`); while (r && !(r.className || "").includes("cs-row")) r = r.parentNode; return r; };
const exploreIn = (el) => el.querySelectorAll('button[data-act="explore"]');
// The screens the rows open, as stand-ins, so each reference is a link and `explore` is a screen to go to.
const STUBS = ["question", "document", "person", "explore"].map((id) => ({ id, reads: () => ({}), acts: [], render: () => "", words: [] }));

const BROWSE = ok({ truncated: false, total: 3, awaiting_review: 0, items: [
  { id: "NOTE-1", kind: "document", title: "Sewer note" },
  { id: "ENT-7", kind: "person", title: "L. Chen" },
  { id: "INQ-2026-0001-sewer", kind: "question", title: "Who pays for the sewer?" },
] });
const browsePlane = { lookedat: ok({ since: "2026-11-01T00:00:00Z" }), themeread: ok({ themes: [] }), browse: BROWSE };
const searchPlane = {
  searchfields: ok({ scopes: ["everything"] }),
  search: ok({ total: 2, limit: 50, offset: 0, hits: [
    { bundle_id: "NOTE-1", object_type: "information", title: "Sewer note", snippet: null },
    { bundle_id: "INQ-2026-0001-sewer", object_type: "inquiry", title: "Who pays for the sewer?", snippet: null },
  ] }),
  meaningrows: ok({ total: 0, rows: [] }),
  subjectsnamed: ok({ count: 1, subjects: [{ entity_id: "ENT-9", label: "Water Board", kind: "organization", documents: 2 }] }),
};
const openFinder = async (path, plane) => {
  const p = await boot({ screens: [{ ...finder, words: WORDS }, ...STUBS], path, plane });
  await settle();
  return p;
};

test("R4 (registry `finder` lists `explore`): Find's acts hold `explore`, labelled by the word list's \"Explore connections\" for Find", () => {
  const a = finder.acts.find((x) => x.op === "explore");
  assert.ok(a, "explore is one of Find's acts");
  assert.equal(a.label, "act.explore.label.finder");
  assert.ok(word("act.explore.label.finder"), "the label is a word of the list");
});

test("R4, Screens finder A12: in the browse, a document and a person each offer Explore connections; a question does not", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  const doc = rowOf(p, "/app/document/NOTE-1"), who = rowOf(p, "/app/person/ENT-7"), q = rowOf(p, "/app/question/INQ-2026-0001-sewer");
  assert.ok(doc && who && q, "the three rows are drawn");
  assert.equal(exploreIn(doc).length, 1);
  assert.equal(exploreIn(doc)[0].textContent.trim(), word("act.explore.label.finder"));
  assert.equal(exploreIn(who).length, 1);
  assert.equal(exploreIn(q).length, 0, "explore starts from no question");
});

test("R4, Screens finder A12: pressing it on a document opens explore from that document and sends nothing", async () => {
  const p = await openFinder("/app/finder", browsePlane);
  const before = p.requests.length;
  await p.click(exploreIn(rowOf(p, "/app/document/NOTE-1"))[0]);
  assert.equal(p.location.pathname, "/app/explore/NOTE-1");
  assert.equal(p.byOp("explore").length, 0, "the act asks the plane nothing");
  assert.equal(p.requests.slice(before).filter((r) => r.op === "explore" || r.op === "exploregraph").length, 0);
});

test("R4, Screens finder A12: with words, a document hit and a subject named each offer it; the subject's opens explore from that subject", async () => {
  const p = await openFinder("/app/finder/sewer", searchPlane);
  assert.equal(exploreIn(rowOf(p, "/app/document/NOTE-1")).length, 1);
  assert.equal(exploreIn(rowOf(p, "/app/question/INQ-2026-0001-sewer")).length, 0, "control: a question hit offers none");
  const subject = rowOf(p, "/app/person/ENT-9");
  assert.equal(exploreIn(subject).length, 1);
  await p.click(exploreIn(subject)[0]);
  assert.equal(p.location.pathname, "/app/explore/ENT-9");
});

test("R4 control: the act with no start named goes nowhere and sends nothing", () => {
  const a = finder.acts.find((x) => x.op === "explore");
  const went = [];
  const out = a.send({ ui: {} }, { dataset: {} }, { go: (...args) => went.push(args) });
  assert.equal(out, null);
  assert.deepEqual(went, []);
});
