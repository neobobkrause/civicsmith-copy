/* screens-find R46 and R6: a search's excerpt as people read it. `query-language` marks each match in a snippet between MARK_OPEN
   and MARK_CLOSE (the control characters \u0001 and \u0002, query.mjs); Find's rows (titles, notes and details; what the documents
   say) and Ask's "Find and count" rows draw each marked match as emphasis, a bracket as the plain text it is, and never a mark itself.
   Each screen is booted alone through interface-shell's harness, with every word the word list holds, and a scripted plane. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, settle } from "../interface-shell/harness.mjs";
import { WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { finder } from "../../../src/screens-daily/finder.mjs";
import { answers } from "../../../src/screens-daily/answers.mjs";

const WORDS = Object.freeze(WORD_ROWS.map((r) => r[0]));
const O = "\u0001", C = "\u0002";
const main = (p) => p.doc.getElementById("cs-main");
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
const rowOf = (p, href) => { let r = main(p).querySelector(`a[href="${href}"]`); while (r && !(r.className || "").includes("cs-row")) r = r.parentNode; return r; };
// The screens the rows open, as stand-ins, so a reference is a link to its own kind's screen (R46).
const STUBS = ["question", "document", "project"].map((id) => ({ id, reads: () => ({}), acts: [], render: () => "", words: [] }));
const ems = (el) => el.querySelectorAll("em").map((e) => e.textContent);

const hit = (id, type, title, snippet) => ({ bundle_id: id, object_type: type, title, snippet, document: { bundle_id: id, title } });
const SEARCH = ok({ total: 3, limit: 50, offset: 0, hits: [
  hit("INQ-2026-0001-sewer", "inquiry", "Who pays for the sewer repair?", `Who pays for the ${O}sewer${C} repair, and the ${O}sewer${C} fund?`),
  hit("NOTE-1", "information", "Sewer note", `A [placed nowhere] note on the ${O}sewer${C} and a stray ${O}mark`),
  hit("NOTE-2", "information", "Bare note", null),
] });
const MEANINGROWS = ok({ total: 1, rows: [{ bundle_id: "PKT-1", document: { bundle_id: "PKT-1", title: "Water board packet" },
  snippet: `quorum absent and ${O}sewer${C} pressure`, extent: { passage: 2 } }] });

const openFinder = () => boot({ screens: [{ ...finder, words: WORDS }, ...STUBS], path: "/app/finder/sewer",
  plane: { search: SEARCH, meaningrows: MEANINGROWS, subjectsnamed: ok({ count: 0, subjects: [] }) } });

test("R46: a question's excerpt draws each marked match as emphasis and the rest as plain text, with no mark drawn", async () => {
  const p = await openFinder();
  await settle();
  const q = rowOf(p, "/app/question/INQ-2026-0001-sewer");
  assert.ok(q, "the question's row opens question");
  assert.deepEqual(ems(q), ["sewer", "sewer"]);
  assert.ok(text(q).includes("Who pays for the sewer repair, and the sewer fund?"), "the plain excerpt");
  assert.doesNotMatch(main(p).textContent, /[\u0001\u0002]/, "no mark reaches the page");
});

test("R46: a bracket in the record is plain text, never emphasis; a stray mark is dropped", async () => {
  const p = await openFinder();
  await settle();
  const n = rowOf(p, "/app/document/NOTE-1");
  assert.deepEqual(ems(n), ["sewer"]);
  assert.ok(text(n).includes("A [placed nowhere] note on the sewer and a stray mark"));
});

test("R46: a passage found through `passage:` draws its matched words as emphasis", async () => {
  const p = await openFinder();
  await settle();
  const r = rowOf(p, "/app/document/PKT-1");
  assert.deepEqual(ems(r), ["sewer"]);
  assert.ok(text(r).includes("quorum absent and sewer pressure"));
});

test("R46 control: a hit with no snippet draws its title and no emphasis", async () => {
  const p = await openFinder();
  await settle();
  const b = rowOf(p, "/app/document/NOTE-2");
  assert.ok(b && text(b).includes("Bare note"));
  assert.deepEqual(ems(b), []);
});

test("R6: \"Find and count\" draws a search's marked matches as emphasis, never the marks", async () => {
  const p = await boot({ screens: [{ ...answers, words: WORDS }, ...STUBS], path: "/app/answers", plane: { search: SEARCH } });
  main(p).querySelector("input[type=search], input[type=text]").value = "sewer";
  await p.click(main(p).querySelector('button[data-act="search"]'));
  await settle();
  const n = rowOf(p, "/app/document/NOTE-1");
  assert.ok(n, "the hit is drawn");
  assert.deepEqual(ems(n), ["sewer"]);
  assert.ok(text(n).includes("A [placed nowhere] note on the sewer and a stray mark"));
  assert.doesNotMatch(main(p).textContent, /[\u0001\u0002]/);
});
