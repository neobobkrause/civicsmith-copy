/* record-grammar's purity battery (R24): one call of every function the module provides, its answers as one JSON
   string. The purity test runs it in this thread, with the clock, randomness and the network taken away, and in a
   Worker (battery-worker.mjs), and compares the strings. */
import * as RG from "../../../../src/record-grammar/index.mjs";

/** @param {Uint8Array | string} v @returns {Promise<string>} */
const sha = async (v) => RG.createSha256().update(typeof v === "string" ? new TextEncoder().encode(v) : v).hex();

/** Every function's answer to a fixed set of inputs, as one JSON string. @returns {Promise<string>} */
export async function battery() {
  /** @type {unknown[]} */
  const out = [];
  const fm = "---\nid: INFO-2026-0001-a\nlist:\n  - k: v\n    j: 1\n  status: x\n  - bad\n---\nbody";
  out.push(RG.parseFrontmatter(fm), RG.parseFrontmatter("no fence"));
  out.push(RG.canonicalJson({ b: [1, { d: undefined, c: 2 }], a: "x" }));
  for (const w of ["token:x", "Alice", "daemon", "", null]) out.push(RG.isMachineStamp(w), RG.isMachineIdentity(w));
  for (const t of ["problem", "constructor", "information"]) out.push(RG.normalizeType(t));
  for (const u of ["https://example.org", "https://localhost."]) out.push(RG.isPublicHttpsLocator(u));
  out.push(RG.sha256HexSync("abc"), RG.createSha256().update(new Uint8Array(200).fill(7)).hex());
  out.push(Array.from(RG.b64ToBytes("AQID")));
  out.push(RG.BUNDLE_ID_RE.test("PLN-2026-0001-a"), RG.ANN_ID_RE.source, RG.UNREACHABLE_CAPTURE_GRADE);
  out.push(RG.ID_TABLE, String(RG.idPattern("EVT")), RG.isHypothesisId("HYP-2026-10000"));
  out.push(RG.isStepId("STP-2026-a1b2c3d4e5f6g7h8"), RG.isGuideId("GUD-2026-0001"), RG.ACCEPTANCE_FORMS, RG.ACCEPT_MUST_REAUTHOR);
  out.push(RG.isSuccessRecordId("SUC-2026-0001"), RG.STATES.escalation, RG.STATES.action_plan, RG.STATES.success_record);
  out.push(RG.acceptanceRecord({ proposal: "p", form: "edited", by: "alice", at: "2026-10-09T00:00:00Z", kind: "step" }));
  out.push(RG.idDisagrees({ id: "INFO-2026-0001-a" }, "INFO-2026-0001-a"), RG.idDisagrees({ id: " INFO-2026-0001-a" }, "INFO-2026-0001-a"));
  out.push(RG.deriveInquiryTitle("  a   question\nmore"), RG.inquiryQuestionOf("x\n## Question\nq\n## B"),
    RG.vocabFor({ problem: RG.STATES.problem, focus: RG.STATES.focus }, "problem"));
  out.push(RG.sectionText("## A\na\n## B", "## A"), RG.isCaseMemberBytes({ published_strength: [{ axis: "a" }, { axis: "b" }] }));
  for (const w of ["token:x", "alice", "", "plane"]) out.push(RG.proposalLabel(w, "standard"), RG.proposalLabel(w, "bearing"), RG.contentMintState(w));
  /** @type {Map<string, Uint8Array | string>} */
  const files = new Map([["bundle.md", "---\nid: INFO-2026-0001-a\nobject_type: information\n---\n## Summary\n## Odd"],
    ["PROMOTING-x.json", "{}"], ["PENDING_PROMOTION.json", JSON.stringify({ created: "2026-01-01T00:00:00Z" })]]);
  out.push(await RG.checkBundle({ folderName: "INFO-2026-0001-a", files, sha256: sha, nowMs: 1780000000000 }));
  return JSON.stringify(out);
}
