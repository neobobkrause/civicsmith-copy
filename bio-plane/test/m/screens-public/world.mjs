/* screens-public: a published case edition as public-read's real code answers it (`publishedcase`), for the parts' tests.
 * Built as public-read's own T53 world builds it (test/m/public-read/t53.test.mjs): a /10 case document over one finding resting
 * on two passages of a captured document and one leg on working material, signed by its owner and read as a stranger reads it.
 * `ungraded` lists the ords published without a grade; `format` the document's format (an earlier one states no statement); `graded` whether the case states its frozen pair.
 * Nothing here is a hand-built answer: every value a test reads comes from `w.read("publishedcase", ...)`. */
import assert from "node:assert/strict";
import { world, caseDoc, V, NOW, sha } from "../public-read/fixture.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, gradingFactsLines, passagesLines, extractedTextOf }
  from "../../../src/case-grammar/index.mjs";

export { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9 };
export const CASE = "CASE-2026-5301", F = "INQ-2026-5301-transfer";
const DOC = "INFO-2026-5301-minutes", WORK = "INFO-2026-5301-working";
const UNITS = [{ seq: 0, extent: { kind: "document" }, ref: "¶1", text: "The minutes say so.", truncated: false }];
export const TITLE = "Council minutes, 12 March";
export const ORIGIN = "https://example.org/m";

/** The `publishedcase` answer for the finding (`id: F`) and for the case (`id: CASE`), with the world. */
export function publishedCase({ format = CASE_DOCUMENT_FORMAT, ungraded = [0, 1], materials: withMaterials = true, graded = true } = {}) {
  const w = world({});
  w.member("mem-4821", { handle: "olive" });
  const proj = w.project("Minutes", "mem-4821");
  w.doc(DOC); w.doc(WORK);
  const capOf = (id) => w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, id).capture_sha;
  const docSha = capOf(DOC);
  w.units.set(docSha, { units: UNITS, state: "whole" });
  w.inquiry(F, { question: "Was the transfer authorised?", legs: [{ target: DOC }, { target: DOC }, { target: WORK }] });
  const pin = w.head(F);
  const materials = withMaterials ? [{ ref: DOC, kind: "document", sha: docSha, text_sha: sha(extractedTextOf(UNITS)), origin: ORIGIN,
    archived_copy: null, included: true, rests_under: "load_bearing", title: TITLE }] : [];
  const leg = (ord, target, kind, grade) => ({ finding: F, ord, target, kind, role: "supports", grade, grade_axis: "capture",
    grade_source: "recorded", ground: "a fetched copy", target_edition: null, answer: null, origins: [target],
    origins_complete: true, captures: kind === "document" ? [docSha] : [], author_key: null });
  const grading = [0, 1, 2].map((o) => leg(o, o < 2 ? DOC : WORK, o < 2 ? "document" : "observation", ungraded.includes(o) ? null : "B"));
  const passages = [
    { finding: F, ord: 0, content_id: "c-0", capture_sha: docSha, extent: { kind: "pdf-page", page: 1 }, chain: null, quoted: "The minutes say so." },
    { finding: F, ord: 1, content_id: "c-1", capture_sha: docSha, extent: { kind: "pdf-page", page: 4 }, chain: null, quoted: "The minutes say so." },
    { finding: F, ord: 2, content_id: "c-2", capture_sha: capOf(WORK), extent: { kind: "document" }, chain: null, quoted: "noted" }];
  const text = caseDoc(CASE, 1, { format, project: proj, method: { grading: "bio-grading/1", checks: "1.57.0" }, materials,
    attestations: [], roles: [{ target: F, version_sha: pin, role: "load_bearing" }],
    strength: graded ? [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }] : [],
    ...(ungraded.length ? { ungraded: ungraded.map((o) => ({ finding: F, ord: o, content_id: `c-${o}` })) } : {}) });
  const lines = text.split("\n"), close = lines.indexOf("---", 1);
  const doc = [...lines.slice(0, close), ...gradingFactsLines(grading), ...passagesLines(passages), ...lines.slice(close)].join("\n");
  const stored = w.p.storeCaseDocument({ case: CASE, edition: 1, text: doc, author: V("mem-4821"), at: NOW });
  assert.equal(stored.ok, true, JSON.stringify(stored).slice(0, 300));
  const signed = w.signCase(CASE, 1, { project: proj, signer: "mem-4821", roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }] });
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 400));
  assert.equal(w.signFinding(F, { signer: "mem-4821" }).ok, true);
  const answer = w.read("publishedcase", { id: F });
  assert.equal(answer.ok, true, JSON.stringify(answer).slice(0, 300));
  const byCase = w.read("publishedcase", { caseId: CASE });
  assert.equal(byCase.ok, true, JSON.stringify(byCase).slice(0, 300));
  return { w, answer, byCase, docSha };
}
