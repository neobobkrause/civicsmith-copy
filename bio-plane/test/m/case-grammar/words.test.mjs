/* case-grammar at its interface: R33 (T51-136; K3803 (3), K3820), the reader's words say "team" from the new case document
   format `/8`, and every earlier format spells and renders as it did. Driven on whole case files built by this module's own
   writers (`./casefile-fixture.mjs`) and on a `/7` case file and its complete edition rendered before R33 changed the words
   (`./complete-v7-golden.json`, never regenerated). The `/8` comparisons are by substitution of "team" for "group", never by
   copying a sentence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { caseFileFixture, editionInput, OBSCURED_LABEL, COPY_CLEANED_LABEL, ACCOUNT } from "./casefile-fixture.mjs";
import { doc, sha, NOW } from "./helpers.mjs";

const V8 = "bio-case-document/8";
const V7 = "bio-case-document/7";
const EARLIER = [7, 6, 5, 4, 3, 2, 1].map((v) => `bio-case-document/${v}`);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sha256 = (t) => createHash("sha256").update(t).digest("hex");
const RICH = { t33: true, photo: true, plainPhoto: true, memberDoc: true, t41: true, grading: "bio-grading/3" };
const render = ({ manifest, files }) => CG.completeEditionOf(editionInput(manifest, files));
/* the edition of a case file whose workbook row was not recomputed, with the case document's own digest (printed in the
   notice, and different between two formats) named, not shown */
const notRecomputed = ({ manifest, files }) => {
  const wb = new Map(files);
  wb.set("case.md", files.get("case.md").replace('recompute: \'"differs"\'', 'recompute: \'"not_recomputed"\''));
  return render({ manifest, files: wb }).replace(sha256(wb.get("case.md")), "<case document sha>");
};
/* "group" made "team" in the reader's words; text a document carries as data (a row's label) is not this module's, so it is
   held aside while the words are substituted */
const DATA = [OBSCURED_LABEL, COPY_CLEANED_LABEL, ...ACCOUNT.map((r) => r.text)].map(esc);
/* the case document's own digest differs between the two (its format line), and is printed in the notice */
const unsha = (html, files) => html.replace(sha256(files.get("case.md")), "<case document sha>");
const plain = (f) => unsha(render(f), f.files);
const teamed = (html) => {
  let h = html;
  DATA.forEach((d, i) => { h = h.split(d).join(`\u0000${i}\u0000`); });
  h = h.replace(/\bgroup\b/g, "team").replace(/\bGroup\b/g, "Team");
  DATA.forEach((d, i) => { h = h.split(`\u0000${i}\u0000`).join(d); });
  return h;
};
const wordsIn = (html) => html.match(/\bgroup\b/gi) ?? [];

test("R33 R35 CASE_DOCUMENT_FORMAT is /10 (R35) and /8 and /7 stay accepted: caseWordsOf answers group for /7 and every earlier accepted format, team for /8 and later, and team for a document stating no readable format", () => {
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED.includes(V8), true);
  assert.equal(CG.CASE_DOCUMENT_FORMAT_V7, V7);
  assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED.includes(V7), true);
  for (const format of EARLIER) assert.equal(CG.caseWordsOf({ format }), "group", format);
  for (const format of [V8, "bio-case-document/9", "bio-case-document/10"]) assert.equal(CG.caseWordsOf({ format }), "team", format);
  for (const odd of [null, undefined, 7, "x", {}, [], { format: null }, { format: "Bio-case-document/7" }, { format: "bio-case-document/7 " },
                     { format: 7 }, { get format() { throw new Error("boom"); } }])
    assert.equal(CG.caseWordsOf(odd), "team", "no readable format");
  /* the choice is the document's own, never the format in force: a /7 document stays group whatever is written today */
  assert.equal(CG.caseWordsOf({ format: V7 }), "group");
  assert.equal(CG.caseWordsOf({ format: CG.CASE_DOCUMENT_FORMAT }), "team");
  /* /8 states exactly what /7 states: every predicate answers the same for both, and for /6 */
  for (const pred of [CG.caseDocumentStatesMemberBlocks, CG.caseDocumentRequiresDisclosures, CG.caseDocumentRequiresV4Disclosures,
                      CG.caseDocumentRequiresTensionSection, CG.caseDocumentRequiresMaterials])
    assert.equal(pred({ format: V8 }), pred({ format: V7 }), pred.name);
});

test("R33 the two sets are frozen in the module: group is exactly today's words, team is the same sentences with team for group, and neither is read from a table", () => {
  assert.equal(Object.isFrozen(CG.WORDS) && Object.isFrozen(CG.WORDS.group) && Object.isFrozen(CG.WORDS.team), true);
  /* the exported constants are the group set, unchanged */
  assert.equal(CG.LENS_KIND_WORDS, CG.WORDS.group.lensKinds);
  assert.equal(CG.LENS_CLOSING_SENTENCES, CG.WORDS.group.lensClosing);
  assert.equal(CG.NOT_RECORDED_STATED, CG.WORDS.group.notRecorded);
  assert.equal(CG.RECOMPUTE_WORDS.not_recomputed, CG.WORDS.group.notRecomputed);
  assert.equal(CG.OBSCURED_WORDS.original, CG.WORDS.group.original);
  /* team is group with team for group, in every sentence, and the identifier-as-word is the only other difference */
  const asTeam = (s) => s.replace(/\bgroup/g, "team").replace(/\bGroup/g, "Team");
  const walk = (g, t, at) => {
    if (typeof g === "string") return assert.equal(t, asTeam(g), at);
    if (typeof g === "function") {
      if (at.endsWith("levelWord")) return;
      const args = [["a", "b"], ["x", "y"]].find((a) => a.length === g.length) ?? ["a", "b"].slice(0, g.length);
      return assert.equal(t(...args), asTeam(g(...args)), at);
    }
    assert.deepEqual(Object.keys(t), Object.keys(g), at);
    for (const k of Object.keys(g)) walk(g[k], t[k], `${at}.${k}`);
  };
  walk(CG.WORDS.group, CG.WORDS.team, "WORDS");
  assert.equal(CG.WORDS.group.levelWord("group"), "group");
  assert.equal(CG.WORDS.team.levelWord("group"), "team");
  for (const level of ["project", "cover", "name"]) assert.equal(CG.WORDS.team.levelWord(level), level);
  /* the first closing sentence of the lens is the same in both */
  assert.equal(CG.WORDS.team.lensClosing[0], CG.WORDS.group.lensClosing[0]);
});

test("R33 R14 a /7 case file stored before this change re-renders to its recorded SHA-256, with Civicsmith and the light-only declaration as before; so does every earlier format's words", () => {
  const GOLDEN = JSON.parse(readFileSync(new URL("./complete-v7-golden.json", import.meta.url), "utf8"));
  assert.equal(GOLDEN.sha256, "1a890aaf04d906d40787ebfb646640e6415db2cd5c49b59f8d795fdad4a1b2d3");
  assert.equal(sha256(GOLDEN.html), GOLDEN.sha256, "the recorded edition is the recorded digest");
  assert.match(GOLDEN.input.files.find((f) => f.path === "case.md").content, /\nformat: bio-case-document\/7\n/);
  const html = CG.completeEditionOf(GOLDEN.input);
  assert.equal(html, GOLDEN.html, "byte for byte");
  assert.equal(sha256(html), GOLDEN.sha256);
  assert.equal(html.includes('<p class="foot">Made with Civicsmith</p>'), true);
  assert.equal(html.includes('<meta name="color-scheme" content="light">'), true);
  assert.equal(html.includes("CivicOS"), false);
  assert.equal(wordsIn(html).length > 10, true, "the group words, many times over");
  assert.equal(/\bteam\b/i.test(html), false, "no team word in a /7 render");
  /* every earlier accepted format keeps the group words */
  for (const format of EARLIER.slice(1)) {
    const input = { ...GOLDEN.input, files: GOLDEN.input.files.map((f) => (f.path === "case.md"
      ? { ...f, content: f.content.replace(/\nformat: bio-case-document\/7\n/, `\nformat: ${format}\n`) } : f)) };
    const out = CG.completeEditionOf(input);
    assert.equal(/\bteam\b/i.test(out), false, format);
    assert.equal(out.includes(esc(CG.WORDS.group.verify("casechecker"))), true, `${format}: the group's words`);
  }
});

test("R33 R14 a /8 case file renders the /7 render with team for group in the reader's sentences, and no other change; a /8 render holds no group in reader text", () => {
  const f7 = caseFileFixture({ ...RICH, format: V7 });
  const f8 = caseFileFixture({ ...RICH, format: V8 });
  for (const [a, b] of [[plain(f7), plain(f8)], [notRecomputed(f7), notRecomputed(f8)]]) {
    assert.equal(a.includes('<meta name="color-scheme" content="light">') && b.includes('<meta name="color-scheme" content="light">'), true);
    assert.equal(b, teamed(a), "the /7 render with team for group, and nothing else");
    assert.notEqual(a, b);
    assert.deepEqual(wordsIn(DATA.reduce((h, d) => h.split(d).join(""), b)), [], "no group in a /8 render's reader text, apart from the text a row carries as its own");
  }
  const a = notRecomputed(f7);
  assert.equal(wordsIn(a).length >= 14, true, "the substitution is not vacuous: many sentences are changed");
  const b = notRecomputed(f8);
  /* identifiers are printed as they are, and a row's own text is the document's, never ours */
  assert.equal(b.includes(esc(OBSCURED_LABEL)) && b.includes(esc(COPY_CLEANED_LABEL)), true, "a row's label word for word");
  assert.equal(b.includes("lakeshore-tenants") && b.includes("riverside-watch"), true, "slugs as they are");
  assert.equal(b.includes("Made with Civicsmith"), true);
  /* the case file is rendered the same twice, and in whatever order its files are handed in */
  const input = editionInput(f8.manifest, f8.files);
  assert.equal(CG.completeEditionOf({ ...input, files: [...input.files].reverse() }), render(f8));
  /* the attestation line that credits a member to a level prints team for level group, and project as it is */
  assert.equal(b.includes(esc("Attested by a member of the team, credited to the team, on 2026-09-30T00:00:00Z.")), true);
  assert.equal(a.includes(esc("Attested by a member of the group, credited to the group, on 2026-09-30T00:00:00Z.")), true);
  const proj = new Map(f8.files);
  proj.set("case.md", f8.files.get("case.md").replace('level: "group"', 'level: "project"'));
  const projHtml = render({ manifest: f8.manifest, files: proj });
  assert.equal(projHtml.includes(esc("Attested by a member of the team, credited to the project, on 2026-09-30T00:00:00Z.")), true);
  /* the title and the notice for a manifest naming no group */
  const none = CG.completeEditionOf({ ...input, group: undefined });
  assert.equal(none.includes("A team · Case") && none.includes(CG.WORDS.team.noticeGroup), true);
});

test("R33 R14 controls: a /7 document's rendering is unchanged after /8 is the format in force (product name, light-only declaration, closing sentences); a /8 body's closing sentences are found too", () => {
  const f7 = caseFileFixture({ ...RICH, format: V7 });
  const h7 = render(f7);
  assert.equal(CG.editionProductOf({ format: V7 }), "Civicsmith", "/7 keeps Civicsmith, not CivicOS");
  assert.equal(CG.editionProductOf({ format: V8 }), "Civicsmith");
  for (const v of [6, 5, 4, 3, 2, 1]) assert.equal(CG.editionProductOf({ format: `bio-case-document/${v}` }), "CivicOS", `/${v}`);
  assert.equal(h7.includes('<p class="foot">Made with Civicsmith</p>'), true);
  assert.equal(h7.includes("CivicOS"), false);
  assert.equal(h7.includes('<meta name="color-scheme" content="light">'), true);
  assert.equal(/prefers-color-scheme/.test(h7), false);
  for (const s of CG.lensClosingSentencesOf({ format: V7 })) assert.equal(h7.includes(esc(s)), true, "a /7 body's closing sentences are found in its print");
  const h8 = render(caseFileFixture({ ...RICH, format: V8 }));
  for (const s of CG.lensClosingSentencesOf({ format: V8 })) assert.equal(h8.includes(esc(s)), true, "and a /8 body's");
  assert.equal(h8.includes(esc(CG.LENS_CLOSING_SENTENCES[1])), false, "the /7 sentence is not in a /8 print");
  assert.deepEqual([...CG.lensClosingSentencesOf({ format: V7 })], [...CG.LENS_CLOSING_SENTENCES]);
  for (const format of EARLIER) assert.deepEqual([...CG.lensClosingSentencesOf({ format })], [...CG.LENS_CLOSING_SENTENCES], format);
  assert.equal(CG.lensClosingSentencesOf({ format: V8 })[0], CG.LENS_CLOSING_SENTENCES[0], "the first sentence is the same in both");
  assert.notEqual(CG.lensClosingSentencesOf({ format: V8 })[1], CG.LENS_CLOSING_SENTENCES[1]);
  for (const odd of [null, undefined, 7, {}, { format: null }, { get format() { throw new Error("boom"); } }])
    assert.deepEqual([...CG.lensClosingSentencesOf(odd)], [...CG.WORDS.team.lensClosing], "no readable format: team");
});

test("R33 R2 the attribution body is spelled in the words of the version it is given: /7 and earlier keep group, /8 and none given say team, identifiers stay", () => {
  const rows = [{ observation: "INFO-2026-0099-o", level: "group", shown: "test-collective", chosen_at_edition: 1 },
                { observation: "INFO-2026-0098-o", level: "project", shown: "Parks", chosen_at_edition: 1 },
                { observation: "INFO-2026-0097-o", level: "cover", shown: "heron", chosen_at_edition: 2 },
                { observation: "INFO-2026-0096-o", level: null, why: "WHY" }];
  const old = CG.attributionBodyLines(rows, V7).join("\n");
  const now = CG.attributionBodyLines(rows, V8).join("\n");
  assert.match(old, /recorded by a member of this group\./);
  assert.match(old, /attributed to the group that publishes this case: test-collective/);
  assert.match(old, /the cover the group knows its author by/);
  /* the same lines with team for group in the words, and the level printed as the identifier it is */
  assert.equal(now, old.replace(/(?<!`)\bgroup\b(?!`)(?!-)/g, "team"));
  assert.match(now, /level `group`, chosen at edition 1\./, "the level is an identifier, in code");
  assert.equal(CG.attributionBodyLines(rows).join("\n"), now, "the format in force when none is given");
  assert.equal(CG.attributionBodyLines(rows, CG.CASE_DOCUMENT_FORMAT).join("\n"), now);
  for (const format of EARLIER) assert.equal(CG.attributionBodyLines(rows, format).join("\n"), old, format);
  assert.equal(now.includes("test-collective"), true, "a printed value is the row's, as it is");
  assert.deepEqual(CG.attributionBodyLines(rows, V8).slice(0, 2), [CG.ATTRIBUTION_PROSE_HEAD, ""]);
  /* a /7 prepared document re-authored later keeps its /7 words, read from its own front matter */
  const draft = doc(V7, CG.attributionFrontmatterLines(rows), CG.attributionBodyLines(rows, V7));
  const drafted = parseFrontmatter(draft).data;
  assert.equal(drafted.format, V7);
  assert.equal(CG.attributionBodyLines(rows, drafted.format).join("\n"), old, "re-authored from its own format");
  assert.equal(draft.includes("a member of this group"), true);
  /* never throws, with any format */
  for (const odd of [null, 7, {}, "x", { toString() { throw new Error("boom"); } }]) assert.doesNotThrow(() => CG.attributionBodyLines(rows, odd));
});

test("R33 R9 the lens section is spelled in the words of the version it is given, the statement-kind words and the second closing sentence; the withheld count and every other line are the same", () => {
  const statements = [{ bundle: "BIAS-2026-0001-p", id: "s1", kind: "scrutiny", subject: "ENT-2026-0001", text: "Vendor filings need a second source.",
                        justification: "Two were corrected.", citations: ["INFO-2026-0003-x", { citation: "SECRET", printed: false }] },
                      { bundle: "BIAS-2026-0001-p", id: "s2", kind: "inference", subject: "ENT-2026-0001", text: "Silence is not consent.",
                        justification: "It has many causes.", citations: [] },
                      { bundle: "BIAS-2026-0001-p", id: "s3", kind: "pattern", subject: "ENT-2026-0002", text: "It defers.", justification: "Seen.", citations: [] }];
  const old = CG.lensSectionLines({ acknowledgement: "Ours.", statements, format: V7 });
  const now = CG.lensSectionLines({ acknowledgement: "Ours.", statements, format: V8 });
  assert.equal(old.join("\n").includes("a source this group checks more closely"), true);
  assert.equal(now.join("\n"), old.join("\n").replace(/\bgroup\b/g, "team"));
  assert.equal(now.join("\n").includes("SECRET"), false, "a withheld citation is counted, never named");
  assert.equal(now.some((l) => /Citations withheld: 1 \(which ones is not stated\)/.test(l)), true);
  assert.deepEqual(now.slice(-4), [CG.WORDS.team.lensClosing[0], "", CG.WORDS.team.lensClosing[1], ""]);
  assert.deepEqual(old.slice(-4), [CG.LENS_CLOSING_SENTENCES[0], "", CG.LENS_CLOSING_SENTENCES[1], ""]);
  assert.deepEqual(CG.lensSectionLines({ acknowledgement: "Ours.", statements }), now, "the format in force when none is given");
  for (const format of EARLIER) assert.deepEqual(CG.lensSectionLines({ acknowledgement: "Ours.", statements, format }), old, format);
  for (const inForce of [false, null]) {
    const a = CG.lensSectionLines({ statements: [], inForce, format: V7 });
    const b = CG.lensSectionLines({ statements: [], inForce, format: V8 });
    assert.deepEqual(b.slice(0, -4), a.slice(0, -4), "the none and undetermined sentences name no group");
  }
  /* the section's body is read back as before: lensOf is the one reading, whatever the words */
  assert.equal(CG.lensOf({ format: V8, ...{ lens_statements: [], lens_citations: [] } }).statements.length, 0);
});

test("R33 R27 R28 a source's not-recorded sentence is spelled in the words of the document's format, and a stored row is compared with the sentence of the version its document states", () => {
  const entry = { kind: "name", recorded: false, how: "self" };
  const old = CG.sourceStatement(entry, V7);
  const now = CG.sourceStatement(entry, V8);
  assert.equal(old, `name: ${CG.NOT_RECORDED_STATED}`);
  assert.equal(old.includes("known to the group, not recorded"), true);
  assert.equal(now, old.replace("group", "team"));
  assert.equal(CG.sourceStatement(entry), now, "the format in force when none is given");
  for (const format of EARLIER) assert.equal(CG.sourceStatement(entry, format), old, format);
  /* an entry with a value, a pseudonym link and a hostile claim are spelled alike in both */
  for (const e of [{ kind: "attribute", attribute: "employer", value: "the water board" }, { kind: "pseudonym_link", to: "SRC-2026-0002" },
                   { kind: "name", value: "Pat", how: "hostile", claim: "claimed by a blog" }])
    assert.equal(CG.sourceStatement(e, V7), CG.sourceStatement(e, V8));
  for (const odd of [null, undefined, {}, { kind: "" }, 7]) assert.equal(CG.sourceStatement(odd, V8), null);
  /* R28: a /7 row signed in the old words still holds, and a /8 row is compared with the team sentence */
  const CAP = sha("the knocked bytes");
  const publishable = () => ({ entries: [{ ...entry, basis: "consent" }], received: NOW });
  const row7 = { capture: CAP, stated: old, basis: "consent" };
  const row8 = { capture: CAP, stated: now, basis: "consent" };
  assert.deepEqual(CG.sourceRowsStanding([row7], publishable, V7), [], "a /7 row with the old words still holds");
  assert.deepEqual(CG.sourceRowsStanding([row8], publishable, V8), []);
  assert.deepEqual(CG.sourceRowsStanding([row8], publishable), [], "the format in force when none is given");
  assert.deepEqual(CG.sourceRowsStanding([row7], publishable, V8), [row7], "a /7 row is not a /8 row");
  assert.deepEqual(CG.sourceRowsStanding([row8], publishable, V7), [row8], "nor a /8 row a /7 row");
  for (const format of EARLIER) assert.deepEqual(CG.sourceRowsStanding([row7], publishable, format), [], format);
  /* the withheld statement names no group: the same under both, and unchanged */
  const withheld = { capture: CAP, stated: CG.unnamedSourceStatement({ capture: CAP, received: NOW }), basis: null };
  for (const format of [V7, V8, undefined]) assert.deepEqual(CG.sourceRowsStanding([withheld], publishable, format), [], String(format));
  assert.deepEqual(CG.sourceRowsStanding([row8], () => { throw new Error("boom"); }, V8), [row8], "fails closed under /8 too");
  assert.deepEqual(CG.sourceRowsStanding([{ ...row8, stated: "name: Pat" }], publishable, V8).length, 1);
});

test("R33 R14 a document with no readable format renders the team words; an unreadable case document says nothing of the case", () => {
  const { manifest, files } = caseFileFixture();
  const bare = CG.completeEditionOf({ ...editionInput(manifest, files), group: undefined,
    files: editionInput(manifest, files).files.map((f) => (f.path === "case.md" ? { ...f, content: "---\ncase_id: CASE-2026-0002\n---\n" } : f)) });
  assert.equal(bare.includes("A team · Case CASE-2026-0002"), true);
  assert.equal(bare.includes(CG.WORDS.team.noticeGroup), true);
  assert.deepEqual(wordsIn(bare), []);
  assert.equal(bare.includes(esc(CG.WORDS.team.verify("casechecker"))), true);
  /* the case file with no case document at all says nothing of the case, and names no group */
  const noDoc = CG.completeEditionOf({ ...editionInput(manifest, files), files: [] });
  assert.match(noDoc, /This case file carries no readable case document/);
  assert.deepEqual(wordsIn(noDoc.replace("lakeshore-tenants", "")), []);
  assert.equal(noDoc.includes("Case CASE-2026-0001"), false);
});
