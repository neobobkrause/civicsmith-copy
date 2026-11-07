/* screens-public: the parts the public screens draw for R84 and R100, at this module's interface, over `publishedcase` as
 * public-read's real code answers it (`world.mjs`), read through setup-words' real word table (`word` refuses a key the
 * table does not hold). Tests assert keys and read the expected text from the table, never copy a sentence (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import * as PARTS from "../../../src/screens-public/index.mjs";
import { ungradedStatement, evidenceList, signatureShown, PART_KEYS } from "../../../src/screens-public/index.mjs";
import { publishedCase, CASE_DOCUMENT_FORMAT_V9, TITLE, ORIGIN } from "./world.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cs = Object.freeze({ w: word, esc });
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const has = (html, key, vars) => norm(html.replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'")).includes(norm(word(key, vars)));
const count = (html, attr) => (html.match(new RegExp(`${attr}[=>\\s]`, "g")) || []).length;

test("R84: an edition signed with two ungraded passages draws 'Published with 2 passages not yet graded' and a 'Which passages' fold listing exactly them", () => {
  const { answer } = publishedCase({ ungraded: [0, 1] });
  const html = ungradedStatement(cs, answer);
  assert.ok(has(html, "screen.published.ungraded", { n: "2" }), html);
  assert.ok(/<details data-ungraded-which><summary>/.test(html), "a fold");
  assert.ok(has(html, "screen.published.ungraded.which"));
  const listed = [...html.matchAll(/data-ungraded-passage="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(listed, answer.ungraded_passages.rows.map((r) => `${r.finding}:${r.ord}`), "exactly the signed statement's rows, in its order");
  assert.equal(count(html, "data-ungraded-passage"), 2);
  assert.ok(html.includes(esc(TITLE)), "each named by its title");
});

test("R84: one ungraded passage draws the one-passage sentence", () => {
  const html = ungradedStatement(cs, publishedCase({ ungraded: [1] }).answer);
  assert.ok(has(html, "screen.published.ungraded.one"));
  assert.ok(!has(html, "screen.published.ungraded", { n: "1" }));
  assert.equal(count(html, "data-ungraded-passage"), 1);
});

test("R84 control: an all-graded edition and an earlier-format edition draw no line and no fold", () => {
  assert.equal(ungradedStatement(cs, publishedCase({ ungraded: [] }).answer), "");
  const before = publishedCase({ format: CASE_DOCUMENT_FORMAT_V9 }).answer;
  assert.equal(before.ungraded_passages, null, "the earlier format states nothing");
  assert.equal(ungradedStatement(cs, before), "");
  for (const none of [null, undefined, {}, { ungraded_passages: { stated: false, rows: [{}] } }]) assert.equal(ungradedStatement(cs, none), "");
});

test("R100: a published case with evidence: each row has the name, locator, short fingerprint and a link to where it can be read", () => {
  const { answer, docSha } = publishedCase();
  const html = evidenceList(cs, answer);
  assert.ok(has(html, "screen.published.evidence"), "the EVIDENCE heading");
  const entries = answer.materials.materials.map((m) => m.entry);
  assert.equal(count(html, "data-evidence-entry"), entries.length);
  for (const en of entries) {
    assert.ok(html.includes(`data-evidence-name>${esc(en.name)}<`), "the name");
    assert.ok(html.includes(`data-evidence-locator>${esc(en.locator)}<`), "the locator");
    assert.ok(html.includes(`>${en.fingerprint.slice(0, 8)}…${en.fingerprint.slice(-8)}<`), "the short fingerprint");
  }
  assert.equal(entries[0].fingerprint, docSha);
  assert.ok(html.includes(`<a href="${esc(ORIGIN)}"`) && has(html, "screen.published.evidence.open"), "where it can be read");
});

test("R100: the signature and key the sentence says are 'shown here' are drawn with it", () => {
  const { answer } = publishedCase();
  const html = signatureShown(cs, answer);
  assert.ok(has(html, "screen.published.verify.detail"));
  assert.ok(html.includes(`data-signature>${esc(answer.document.sig_armored)}<`), "the signature");
  assert.ok(html.includes(`data-public-key>${esc(answer.document.attestor.key_b64)}<`), "the public key");
});

test("R100 control: a case with no evidence draws no EVIDENCE heading; without the signature or key the sentence is not drawn", () => {
  const { answer } = publishedCase({ materials: false });
  assert.deepEqual(answer.materials.materials, []);
  assert.equal(evidenceList(cs, answer), "");
  const { document, ...unsigned } = answer;
  assert.equal(signatureShown(cs, unsigned), "");
  assert.equal(signatureShown(cs, { ...answer, document: { ...document, attestor: null } }), "");
});

test("the parts are self-contained (interface-shell R21 (1)), never throw on a malformed answer, and every key a part names is a row", () => {
  for (const [name, f] of Object.entries(PARTS)) {
    if (typeof f !== "function") continue;
    const alone = new Function("return (" + f.toString() + ")")();
    for (const bad of [null, undefined, 7, "x", {}, { materials: 3, document: "y", ungraded_passages: [] }]) assert.equal(alone({ w: word }, bad), "", name);
    assert.ok(PART_KEYS[name], `${name} lists its keys`);
  }
  for (const keys of Object.values(PART_KEYS)) for (const k of keys) assert.ok(hasWord(k), k);
});
