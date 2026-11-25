/* case-authoring (T23; DEC-111, K1031, K1119): the project reference a case carries (R41), and what the pre-flight's
   first step says of it (R42). network-notices is the real module; `w.notices` sets what its `noticeReferenceOf` (its
   R19) answers for a project where a test needs an answer the real module would need a signed notice for. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, AUTHORED } from "./fixture.mjs";
import { NOTICE_SEALS_SENTENCE } from "../../../src/case-authoring/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { workingOnLines, workingOnOf } from "../../../src/case-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
const NOTICE = "WON-2026-0412";

function setup() {
  const w = world();
  w.member("alice"); w.member("bo");
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  return { w, P };
}
const docText = (w, r) => w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
const head = (text) => text.slice(0, text.indexOf("\n---\n", 4));

test("R41: publishCase writes working_on as noticeReferenceOf(project) answers it, through case-grammar's workingOnLines, directly after case_project, asked of the publishing project", () => {
  for (const ref of [NOTICE, "WON-2026-0412-team-notice"]) {
    const { w, P } = setup();
    const asked = [];
    const real = w.ca.networkNotices.noticeReferenceOf;
    w.ca.networkNotices.noticeReferenceOf = (p) => { asked.push(p); return real(p); };
    w.notices.set(P, ref);
    const r = w.publish(P, "alice", [Q]);
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    const text = docText(w, r);
    assert.equal(workingOnOf(parseFrontmatter(text).data), ref);
    const lines = head(text).split("\n");
    assert.deepEqual([lines[lines.indexOf(`case_project: ${P}`) + 1]], workingOnLines(ref));
    assert.equal(lines.filter((l) => l.startsWith("working_on:")).length, 1, "one line");
    assert.ok(asked.length >= 1 && asked.every((p) => p === P), "asked of the publishing project only");
    /* the answer's document is the stored one */
    assert.equal(r.caseDocument.bytes, new TextEncoder().encode(text).length);
  }
});

test("R41: over the real network-notices, reached on the same host with no dependency given: no notice writes no working_on; an open notice, then the same notice once stopped (the most recent), is written as noticeReferenceOf answers", () => {
  const w = world({ deps: { networkNotices: undefined } });
  w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  assert.equal(w.ca.networkNotices, w.networkNotices, "the one instance on this host");
  const none = w.publish(P, "alice", [Q], { newCase: true });
  assert.equal(none.ok, true, JSON.stringify(none).slice(0, 300));
  assert.equal(head(docText(w, none)).includes("working_on"), false);
  /* a notice row as network-notices R5 stores it (its own table, written here as the fixture writes other tables) */
  w.st.sql.exec(`INSERT INTO nn_notices (notice_id, project, opened_at) VALUES (?, ?, ?)`, NOTICE, P, "2026-09-27T00:00:00Z");
  assert.equal(w.networkNotices.noticeReferenceOf(P), NOTICE);
  w.finding("INQ-2026-0002-q", [{ target: DOC }]);
  const open = w.publish(P, "alice", ["INQ-2026-0002-q"], { newCase: true });
  assert.equal(open.ok, true, JSON.stringify(open).slice(0, 300));
  assert.deepEqual(head(docText(w, open)).split("\n").filter((l) => l.startsWith("working_on:")), workingOnLines(NOTICE));
  assert.equal(workingOnOf(parseFrontmatter(docText(w, open)).data), NOTICE);
  /* the pre-flight's step one, over the same answer (R42) */
  w.finding("INQ-2026-0003-q", [{ target: DOC }]);
  const pre = w.ca.publishPreflight({ ...AUTHORED, project: P, targets: ["INQ-2026-0003-q"], roles: { "INQ-2026-0003-q": "load_bearing" },
                                      newCase: true, viewer: V("alice"), author: "alice" });
  assert.deepEqual([pre.steps[0].working_on, pre.steps[0].says.includes(NOTICE_SEALS_SENTENCE)], [NOTICE, true]);
});

test("R41: no working_on when noticeReferenceOf answers null (or undefined); any other answer is written as handed, through workingOnLines, never corrected or dropped, for ratification R38 to refuse; the document is otherwise byte-identical", () => {
  const texts = [];
  for (const ref of [null, undefined, NOTICE, "won-2026-0412", "WON-2026-41", "", 7, "WON-2026-0412\ncase_id: X"]) {
    const { w, P } = setup();
    if (ref !== undefined) w.notices.set(P, ref);
    const r = w.publish(P, "alice", [Q]);
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    const text = docText(w, r);
    const lines = head(text).split("\n");
    const written = lines.filter((l) => l.startsWith("working_on:"));
    assert.deepEqual(written, workingOnLines(ref), `ref ${JSON.stringify(ref)}`);
    assert.equal(written.length, ref == null ? 0 : 1);
    assert.equal(parseFrontmatter(text).data.case_id, r.caseId, "a line break in the answer begins no key");
    /* the case id and the project id are minted per world: compare the rest */
    texts.push(text.replaceAll(r.caseId, "CASE").replaceAll(P, "PROJ").replace(`${written[0]}\n`, ""));
  }
  assert.equal(new Set(texts).size, 1, "only the one line differs");
});

test("R42: the pre-flight's \"what becomes permanent\" step says, when the project has a notice, that publishing opens its sealed weeks — and says nothing of it without one; it writes nothing", () => {
  const { w, P } = setup();
  const args = { ...AUTHORED, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, viewer: V("alice"), author: "alice" };
  const without = w.ca.publishPreflight(args);
  assert.equal(without.steps[0].name, word("case-authoring.name.becomes_permanent"));
  assert.equal(without.steps[0].says.includes(NOTICE_SEALS_SENTENCE), false);
  assert.equal(without.steps[0].working_on, null);
  w.notices.set(P, NOTICE);
  const before = w.snapshot();
  const withNotice = w.ca.publishPreflight(args);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  assert.ok(withNotice.steps[0].says.endsWith(` ${NOTICE_SEALS_SENTENCE}`));
  assert.match(NOTICE_SEALS_SENTENCE, /sealed weeks/);
  assert.equal(withNotice.steps[0].working_on, NOTICE);
  /* stated even when op=publish refuses first, as long as the act's authority lets the project through */
  const refusing = w.ca.publishPreflight({ ...args, statement: "" });
  assert.equal(refusing.first.reason, "NO_STATEMENT");
  assert.ok(refusing.steps[0].says.includes(NOTICE_SEALS_SENTENCE));
  /* negative control: a caller the authority fences refuse learns nothing of the project's notice, whether it cannot
     see the project or sees it and does not own it */
  const unseen = w.ca.publishPreflight({ ...args, viewer: V("bo"), author: "bo" });
  assert.equal(unseen.first.reason, "NO_SUCH_PROJECT");
  assert.deepEqual([unseen.steps[0].says.includes(NOTICE_SEALS_SENTENCE), unseen.steps[0].working_on], [false, null]);
  w.join(P, "bo");
  const outsider = w.ca.publishPreflight({ ...args, viewer: V("bo"), author: "bo" });
  assert.equal(outsider.first.reason, "NOT_THE_PROJECT_OWNER");
  assert.deepEqual([outsider.steps[0].says.includes(NOTICE_SEALS_SENTENCE), outsider.steps[0].working_on], [false, null]);
});
