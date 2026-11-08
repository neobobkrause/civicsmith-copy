/* screens-publish T53 (JOURNEYS; DEC-461, DEC-472 (8), DEC-496): the public pages' marks, over public-read's real answers. Each case
 * edition here is prepared, signed and published in public-read's own test world and read by its `publishedcase` op when the test
 * runs (never built by hand); a sentence is asserted by its key (R24). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, caseDoc, V, NOW } from "../public-read/fixture.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, gradingFactsLines, passagesLines } from "../../../src/case-grammar/index.mjs";
import { open, main, text, drew, drewIn, word, norm, ok, press, provided, groupName, FINDING, CASE_WITH, F1, C, GRANT_SECRET } from "./fixtures.mjs";

const PUBLIC = { session: null };
const CASE = "CASE-2026-5310", F = "INQ-2026-5310-transfer";
const DOCS = [{ id: "INFO-2026-5310-minutes", title: "Council minutes, 12 March" }, { id: "INFO-2026-5310-letter", title: "The administrator's letter" }];

/* One case edition over F, resting on one passage of each of DOCS, signed and published by public-read's real code; `ungraded` the
   ords its signed document lists as published without a grade, `format` the document's format, `graded` whether its frozen pair is
   stated. Answers `publishedcase` read by the case's id. */
function edition({ ungraded = [0, 1], format = CASE_DOCUMENT_FORMAT, graded = true } = {}) {
  const w = world();
  if (w.p.caseCarriage && typeof w.p.caseCarriage.marksLapsed === "function") w.p.caseCarriage.marksLapsed = () => [];
  w.member("mem-5310", { handle: "olive" });
  const proj = w.project("Minutes", "mem-5310");
  for (const d of DOCS) w.doc(d.id);
  const capOf = (id) => w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, id).capture_sha;
  w.inquiry(F, { question: "Was the transfer authorised?", legs: DOCS.map((d) => ({ target: d.id })) });
  const pin = w.head(F);
  const materials = DOCS.map((d) => ({ ref: d.id, kind: "document", sha: capOf(d.id), text_sha: null, origin: `https://example.org/${d.id}`,
    archived_copy: null, included: true, rests_under: "load_bearing", title: d.title }));
  const grading = DOCS.map((d, o) => ({ finding: F, ord: o, target: d.id, kind: "document", role: "supports", grade: ungraded.includes(o) ? null : "B",
    grade_axis: "capture", grade_source: "recorded", ground: "a fetched copy", target_edition: null, answer: null, origins: [d.id],
    origins_complete: true, captures: [capOf(d.id)], author_key: null }));
  const passages = DOCS.map((d, o) => ({ finding: F, ord: o, content_id: `c-${o}`, capture_sha: capOf(d.id), extent: { kind: "document" }, chain: null, quoted: "noted" }));
  const text = caseDoc(CASE, 1, { format, project: proj, method: { grading: "bio-grading/1", checks: "1.57.0" }, materials,
    attestations: [], roles: [{ target: F, version_sha: pin, role: "load_bearing" }],
    strength: graded ? [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }] : [],
    ...(ungraded.length ? { ungraded: ungraded.map((o) => ({ finding: F, ord: o, content_id: `c-${o}` })) } : {}) });
  const lines = text.split("\n"), close = lines.indexOf("---", 1);
  const doc = [...lines.slice(0, close), ...gradingFactsLines(grading), ...passagesLines(passages), ...lines.slice(close)].join("\n");
  assert.equal(w.p.storeCaseDocument({ case: CASE, edition: 1, text: doc, author: V("mem-5310"), at: NOW }).ok, true);
  const signed = w.signCase(CASE, 1, { project: proj, signer: "mem-5310", roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }] });
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  assert.equal(w.signFinding(F, { signer: "mem-5310" }).ok, true);
  const answer = w.read("publishedcase", { caseId: CASE });
  assert.equal(answer.ok, true, JSON.stringify(answer).slice(0, 300));
  return answer;
}
const page = (answer, boot = PUBLIC) => open(`/app/published/${C}`, { boot, plane: { publishedcase: ok(answer) } });

/* ---------- R84 ---------- */

test("R84 an edition signed with two passages ungraded draws 'Published with 2 passages…' at its top, with the fold 'Which passages' listing exactly them", async () => {
  const answer = edition({ ungraded: [0, 1] });
  assert.equal(answer.ungraded_passages.count, 2, "the provider states two");
  const p = await page(answer);
  const head = main(p).querySelector("[data-ungraded-edition]");
  assert.ok(head && drewIn(head, "screen.published.ungraded", { n: "2" }), "the line, with 2");
  const fold = head.querySelector('details[data-fold="screen.published.ungraded.which"]');
  assert.ok(fold && !fold.open && drewIn(fold.querySelector("summary"), "screen.published.ungraded.which"), "folded under 'Which passages'");
  const rows = fold.querySelectorAll("[data-ungraded-row]").map((li) => norm(li.textContent));
  assert.deepEqual(rows, answer.ungraded_passages.rows.map((r) => norm(word("screen.ceremony.ungraded.row", { passage: r.title, n: "1" }))), "each passage by its document, in finding 1");
  assert.deepEqual(answer.ungraded_passages.rows.map((r) => r.title), DOCS.map((d) => d.title), "exactly the two the document lists");
  const at = (el) => text(p).indexOf(norm(el.textContent));
  assert.ok(at(head) < at(main(p).querySelector("[data-finding]")), "at the top, before the findings");
});

test("R84 one ungraded passage reads 'one passage'", async () => {
  const p = await page(edition({ ungraded: [1] }));
  assert.ok(drewIn(main(p).querySelector("[data-ungraded-edition]"), "screen.published.ungraded.one"));
  assert.equal(main(p).querySelectorAll("[data-ungraded-row]").length, 1);
});

test("R84 control: an all-graded edition and an edition of the earlier format draw no line and no fold", async () => {
  for (const answer of [edition({ ungraded: [] }), edition({ format: CASE_DOCUMENT_FORMAT_V9, ungraded: [0] })]) {
    const p = await page(answer);
    assert.ok(drew(p, "screen.published.howtoread"), "the page is drawn");
    assert.equal(main(p).querySelector("[data-ungraded-edition]"), null);
    assert.ok(!drew(p, "screen.published.ungraded.which"));
  }
});

test.todo("R84 grading a passage after publication changes neither the line nor the fold (the statement is the signed one): no act of public-read's test world grades a passage of a published edition");

/* ---------- R100 ---------- */

test("R100 each evidence row has its name, a link to where it can be read and its short fingerprint; the signature and key the explanation names are drawn", async () => {
  const answer = edition();
  const p = await page(answer);
  const rows = main(p).querySelectorAll("[data-evidence-row]");
  assert.equal(rows.length, answer.materials.materials.length);
  for (const m of answer.materials.materials) {
    const row = rows.find((r) => r.textContent.includes(m.entry.name));
    assert.ok(row, `a row named ${m.entry.name}`);
    const line = row.parentNode;
    const a = line.querySelector("a[data-evidence-link]");
    assert.ok(a && a.getAttribute("href") === m.entry.locator, "its locator is the link to where it can be read");
    assert.ok(line.parentNode.textContent.includes(m.entry.fingerprint.slice(0, 12)), "its short fingerprint");
  }
  const signed = main(p).querySelector("[data-signed]");
  assert.ok(signed && drewIn(signed, "screen.published.verify.detail"), "the explanation, with what it says is shown");
  assert.equal(norm(signed.querySelector("[data-signature]").textContent), norm(answer.document.sig_armored), "the signature as signed");
  assert.ok(signed.querySelector("[data-key]").textContent.includes(answer.document.attestor.key_b64), "the signer's public key");
});

test("R100 control: an edition with no evidence draws no evidence heading, and a finding's own evidence list is unchanged", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(CASE_WITH([FINDING(F1, { basis: [{ target: "INFO-1", role: "supports", served: false, document: { name: "Minutes", place: null } }] })])) } });
  assert.ok(!main(p).querySelectorAll("h2").some((h) => norm(h.textContent) === norm(word("screen.published.evidence"))), "no Evidence heading over nothing");
  assert.equal(main(p).querySelectorAll("[data-evidence-row]").length, 0);
  assert.ok(main(p).querySelector("[data-finding] [data-evidence-names] [data-document]"), "the finding's own list, by its document's name");
  assert.equal(main(p).querySelector("[data-verification]"), null, "no signature stated: no 'shown here' sentence");
});

/* ---------- R101 ---------- */

test("R101 'Check it' with too few characters says how many are needed, and sends nothing; a valid paste checks as before (control)", async () => {
  const p = await page(edition());
  await press(p, "verify", { nth: 1, values: { "pb-sha": "abc123" } });
  assert.ok(drew(p, "screen.published.choose_a_file_or_paste"), "the 64 characters it needs, by its key");
  assert.equal(p.byOp("verify").length, 0, "nothing sent");
  const sha = "a".repeat(64);
  await press(p, "verify", { nth: 1, values: { "pb-sha": sha } });
  assert.equal(p.byOp("verify").at(-1).query.sha256, sha, "a valid paste is sent");
});
test.todo("R101 'Read the case' says it re-read, with the time: no word for the sentence (owed)");
test.todo("R101 'Print the case' says why it cannot print: no word for the sentence, and the kit's print answers no failure (owed)");

/* ---------- R102 ---------- */

test("R102 a case whose evidence no member has graded draws the short line saying what would grade it, and the no-bar paragraph folded", async () => {
  const answer = edition({ ungraded: [0, 1], graded: false });
  const p = await page(answer);
  const card = main(p).querySelector("[data-finding]");
  const line = card.querySelector('[data-ungraded="both"]');
  assert.ok(line && drewIn(line, "screen.published.ungraded.line"), "one short line");
  assert.ok(!drewIn(card, "screen.published.strength.unrated"), "not the two long axis lines");
  const fold = main(p).querySelector('details[data-fold="screen.published.ungraded.more"]');
  assert.ok(fold && !fold.open && drewIn(fold.querySelector("summary"), "screen.published.ungraded.more"), "folded under 'Why no bar is shown'");
  assert.ok(fold.querySelector("[data-bar-none]") && text(p, fold).includes(norm(answer.bar_detail)), "the plane's paragraph, inside the fold");
});

test("R102 control: a case with graded evidence draws no ungraded line", async () => {
  const p = await page(edition({ ungraded: [] }));
  assert.equal(main(p).querySelectorAll("[data-ungraded]").length, 0);
  assert.ok(!drew(p, "screen.published.ungraded.line"));
});

/* ---------- R104 ---------- */

const PAGES = [[`/app/published/${C}`, {}], [`/app/docket-public/${C}`, {}], ["/app/review", { hash: "#grant=" + GRANT_SECRET }]];
const framed = async (p) => {
  const head = main(p).querySelector("[data-pubhead]"), foot = main(p).querySelector("[data-pubfoot]");
  assert.ok(head && norm(head.textContent) === norm(await groupName()), "the group's public name at the head");
  assert.ok(foot && drewIn(foot, "case-grammar.text.made", { product: word("shell.mark") }), "'Made with Civicsmith' at the foot");
  assert.ok(text(p).indexOf(norm(head.textContent)) === 0, "the head first");
};
test("R104 with no session, the published case, its public docket and the outside reader's page draw the group's name at the head and 'Made with Civicsmith' at the foot", async () => {
  for (const [path, boot] of PAGES) await framed(await open(path, { boot: { ...PUBLIC, ...boot } }));
});
test("R104 control: signed in, the three pages are drawn the same", async () => {
  for (const [path, boot] of PAGES) await framed(await open(path, { boot }));
});
test.todo("R104 the browser tab reads '<case title> - <group name>': the tab title is interface-shell's (`page.title.public`, {page} the screen's name)");

/* ---------- R98 ---------- */

test("R98 the outside reader's heading names the team that shared the draft and the case's title (the copy's short title)", async () => {
  const copy = await provided.reviewcopy();
  const title = copy.json.result.title;
  assert.ok(typeof title === "string" && title, "review answers a short title");
  const p = await open("/app/review", { boot: { ...PUBLIC, hash: "#grant=" + GRANT_SECRET }, plane: { reviewcopy: copy } });
  const head = main(p).querySelector("[data-review-head]");
  assert.equal(norm(head.querySelector("h1").textContent), norm(title), "the title");
  assert.ok(drewIn(head.querySelector("[data-shared-by]"), "screen.review-outside.heading", { group: await groupName() }), "the team, in the heading");
});

test("R98 control: a named case is headed by its title as before", async () => {
  const p = await open("/app/review", { boot: { ...PUBLIC, hash: "#grant=" + GRANT_SECRET } });
  assert.ok(main(p).querySelector("h1"));
  assert.ok(drew(p, "screen.review-outside.draft", { case: "The Coliseum lease", edition: "2" }), "the draft's section still names the case");
});

/* ---------- DEC-496 ---------- */

const gloss = (scale, letter, lead) => norm(word("mark.grade.gloss.form", { letter, gloss: (lead ? word("mark.grade.gloss.copy.lead") + " " : "") + word(`mark.grade.gloss.${scale}.${letter.toLowerCase()}`) }));
test("DEC-496 a published finding at copy B and connection C draws each letter's gloss beside its chip, the copy grade led by its own words", async () => {
  const p = await page(edition({ ungraded: [] }));
  const card = main(p).querySelector("[data-finding]");
  for (const [scale, letter, lead] of [["capture", "B", true], ["connection", "C", false]]) {
    const chip = card.querySelector(`.cs-grade[data-scale="${scale}"]`);
    assert.ok(chip, `${scale} chip`);
    const g = chip.nextElementSibling;
    assert.ok(g && g.getAttribute && g.getAttribute("data-gloss") === `${scale}.${letter}`, "the gloss beside the chip");
    assert.equal(norm(g.textContent), gloss(scale, letter, lead));
  }
});
test("DEC-496 control: a letter the word list holds no gloss for (capture D) draws none beside its chip", async () => {
  const p = await page(CASE_WITH([FINDING(F1, { strength: [{ axis: "capture", grade: "D" }, { axis: "connection", grade: "B" }] })]));
  const card = main(p).querySelector("[data-finding]");
  assert.ok(card.querySelector('.cs-grade[data-scale="capture"]'), "the chip is drawn");
  assert.equal(card.querySelector('[data-gloss^="capture."]'), null, "no gloss");
  assert.ok(card.querySelector('[data-gloss="connection.B"]'), "the other letter keeps its gloss");
});
test.todo("DEC-496 review-outside draws the gloss beside each grade chip: review's `reviewcopy` findings carry no grade, so the page draws no chip (owed by review)");
