/* ratification's rows at their interface (`./checks.mjs`, re-exported by the module), and the catalogue it re-exports:
   the case-document catalogue C-41 with the case arms of C-2.8, C-3.1 and C-21.1, and C-2.8's case-member arm, are
   `case-catalogue`'s since K1824 (its R1, R2; their pure arms are its tests), and this module re-exports every name and
   registers both (R8, R9). The rows that moved here with their ids, and the five of T34 (R14, R46, R47), are asserted
   word for word. No name is read from the check catalogue (T19 rule 1): the shared grammar is record-grammar's, and
   C-2.8's inquiry arm runs through the grammars registered on a record. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../../../src/ratification/checks.mjs";
import * as M from "../../../src/ratification/index.mjs";
import * as CC from "../../../src/case-catalogue/checks.mjs";
import * as RG from "../../../src/record-grammar/index.mjs";
import { world } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const M1 = "INQ-2026-0001-first";

test("R8, R9 (K1824): every name case-catalogue exports is this module's, the same binding, from its checks and its index, so no importer changes", () => {
  const names = Object.keys(CC);
  for (const n of ["checkCaseDocument", "CASE_DOCUMENT_FAMILY", "CASE_CITATION_VERSIONS", "SEARCHED_SUBJECT_SOURCES",
                   "checkPublishedExtension", "caseEditionClaimed", "isCaseMemberBytes", "completenessFields",
                   "biasAcknowledgementOf", "CASE_MEMBER_ROLES", "SUBJECT_POSITIONS", "caseMemberFindings",
                   "caseMemberImageFindings", "withCaseMemberChecks"])
    assert.ok(names.includes(n), `case-catalogue exports ${n}`);
  for (const n of names) {
    assert.equal(R[n], CC[n], `checks.mjs re-exports ${n}`);
    assert.equal(M[n], CC[n], `index.mjs re-exports ${n}`);
  }
});

test("R14: the inquiry grammar a record runs (C-2.8's inquiry arm) asks no case-member question; this module's registration does", async () => {
  const text = `---\nid: ${M1}\nobject_type: inquiry\ntitle: t\ncurrent_state: concluded\ncreated: 2026-09-01T00:00:00Z\n`
    + `last_updated: 2026-09-01T00:00:00Z\nsurfaced_by: human\nedition: 0\npublished_strength:\n  - axis: capture\n    state: graded\n    grade: A\n`
    + `  - axis: connection\n    state: graded\n    grade: A\n---\n\n# t\n`;
  /* record-grammar's checkBundle with the grammars registered on a record (record-core R67), as promotion's gate runs it */
  const grammars = world().record.grammars();
  assert.ok(grammars.some((g) => g.ids.includes("C-2.8")), "negative control: the record runs a C-2.8 grammar");
  const r = await RG.checkBundle({ folderName: M1, files: new Map([["bundle.md", text]]) }, { grammars });
  assert.ok(r.findings.some((x) => x.check === "C-2.8"), "negative control: C-2.8's inquiry arm was asked of these bytes");
  const caseMember = r.findings.filter((x) => x.check === "C-2.8" && /case member/.test(x.message));
  assert.deepEqual(caseMember, [], "the record's grammar does not ask it");
  assert.ok(R.caseMemberFindings(RG.parseFrontmatter(text).data).some((x) => /integer edition/.test(x.message)));
});


/* Every row family this module exports (an object whose entries carry a `check`), named by export, that holds the code
   or the check id: read over the whole module, so no family's name is assumed. Each row has one home here (T19 rule 1:
   the catalogue's copies go with its tables). */
const familiesHolding = (code, check) => Object.entries(R)
  .filter(([, fam]) => fam && typeof fam === "object" && !Array.isArray(fam)
    && Object.values(fam).some((row) => typeof row?.check === "string"))
  .filter(([, fam]) => Object.hasOwn(fam, code) || Object.values(fam).some((row) => row?.check === check))
  .map(([name]) => name);

test("R14, R46: C-32.12–C-32.15, C-53.10–C-53.12, C-58.1–C-58.11, C-65.1 and C-92.10–C-92.12 held here with their codes, ids and translations, each row in one family of this module", () => {
  const want = {
    RATIFY_MACHINE_FENCE_CHECKS: { MACHINE_CANNOT_RATIFY: "C-32.12", MACHINE_CANNOT_RATIFY_CASE: "C-32.13",
                                   OPERATOR_TOKEN_CANNOT_RATIFY: "C-32.14", OPERATOR_TOKEN_CANNOT_RATIFY_CASE: "C-32.15" },
    RATIFY_TESTIMONY_CHECKS: { TESTIMONY_UNPUBLISHABLE: "C-53.10", TESTIMONY_CITED_UNPUBLISHABLE: "C-53.11",
                               TESTIMONY_CASE_UNPUBLISHABLE: "C-53.12" },
    RATIFY_ATTRIBUTION_CHECKS: { ATTRIBUTION_UNCHOSEN: "C-92.10", ATTRIBUTION_STATEMENT_STALE: "C-92.11",
                                 ATTRIBUTION_UNSTATED: "C-92.12" },
    CASE_CONCLUSION_CHECKS: { CASE_CONCLUSION_MOVED: "C-65.1" },
    RATIFY_SCOPE_CHECKS: { RATIFY_PROJECT_BUNDLE: "C-58.1", RATIFY_FINDING_NOT_IN_A_RATIFIED_CASE: "C-58.2",
                           RATIFY_NOT_EVIDENCE_OF_A_RATIFIED_CASE: "C-58.3", CONTESTED_IN_BATCH: "C-58.4",
                           ANONYMOUS_TESTIMONY_UNCORROBORATED: "C-58.5", SCHEDULE_UNCHECKABLE: "C-58.6",
                           SCHEDULED_SOURCES_CHANGED: "C-58.7", SCHEDULED_TIES_CHANGED: "C-58.8",
                           SCHEDULED_HOLD_CHANGED: "C-58.9", SCHEDULED_CHECK_REFUSED: "C-58.10",
                           APPROVAL_MISSING: "C-58.11" },
  };
  for (const [fam, rows] of Object.entries(want)) {
    assert.deepEqual(Object.fromEntries(Object.entries(R[fam]).map(([k, v]) => [k, v.check])), rows, fam);
    for (const [code, v] of Object.entries(R[fam])) {
      assert.match(v.where, /^src\/ratification\/(ops|index|refusals|release|schedule)\.mjs \w+ > is-[a-z-]+$/, code);
      assert.ok(typeof v.translation === "string" && v.translation.length > 60, code);
      assert.deepEqual(R.rowOf(code), { code, check: v.check, translation: v.translation });
      assert.deepEqual(familiesHolding(code, v.check), [fam], `${code}'s one home`);
    }
  }
  assert.deepEqual(familiesHolding("MACHINE_CANNOT_RELEASE", "C-32.1"), ["RELEASE_CHECKS"],
    "negative control: the walk finds a row this module holds outside the families above");
  assert.throws(() => R.rowOf("NOT_A_CODE"), /DEC-49/);
});

/* R14's two new rows (K1058), stamped by 1.53.0 (PROMOTION #24, T23 layer 2): their translations are R14's, word for word. */
test("R14, R22, R35, R2: C-58.4 CONTESTED_IN_BATCH, C-58.5 ANONYMOUS_TESTIMONY_UNCORROBORATED and C-92.10 ATTRIBUTION_UNCHOSEN carry R14's translations word for word (C-58.5 and C-92.10 as re-worded at T28), minted where R22, R35 and R2 refuse", () => {
  assert.deepEqual(R.rowOf("CONTESTED_IN_BATCH"), { code: "CONTESTED_IN_BATCH", check: "C-58.4",
    translation: word("refusal.CONTESTED_IN_BATCH") });
  assert.deepEqual(R.rowOf("ANONYMOUS_TESTIMONY_UNCORROBORATED"), { code: "ANONYMOUS_TESTIMONY_UNCORROBORATED",
    check: "C-58.5",
    translation: word("refusal.ANONYMOUS_TESTIMONY_UNCORROBORATED") });
  /* T28 (N523): C-92.10 re-worded, word for word R14's */
  assert.deepEqual(R.rowOf("ATTRIBUTION_UNCHOSEN"), { code: "ATTRIBUTION_UNCHOSEN", check: "C-92.10",
    translation: word("refusal.ATTRIBUTION_UNCHOSEN") });
  assert.equal(R.RATIFY_SCOPE_CHECKS.CONTESTED_IN_BATCH.where, "src/ratification/release.mjs release > is-release-contested");
  assert.equal(R.RATIFY_SCOPE_CHECKS.ANONYMOUS_TESTIMONY_UNCORROBORATED.where,
               "src/ratification/refusals.mjs anonymousTestimonyRefusal > is-anonymous-testimony");
});

/* R46 (DEC-147 (3)) and R47 (DEC-149): the translations as the requirements word them, word for word. */
test("R46: C-58.6–C-58.10 carry R46's translations word for word, each minted at its one site", () => {
  const want = {
    SCHEDULE_UNCHECKABLE: ["C-58.6", word("refusal.SCHEDULE_UNCHECKABLE")],
    SCHEDULED_SOURCES_CHANGED: ["C-58.7", word("refusal.SCHEDULED_SOURCES_CHANGED")],
    SCHEDULED_TIES_CHANGED: ["C-58.8", word("refusal.SCHEDULED_TIES_CHANGED")],
    SCHEDULED_HOLD_CHANGED: ["C-58.9", word("refusal.SCHEDULED_HOLD_CHANGED")],
    SCHEDULED_CHECK_REFUSED: ["C-58.10", word("refusal.SCHEDULED_CHECK_REFUSED")],
  };
  for (const [code, [check, translation]] of Object.entries(want))
    assert.deepEqual(R.rowOf(code), { code, check, translation }, code);
  assert.equal(R.RATIFY_SCOPE_CHECKS.SCHEDULE_UNCHECKABLE.where,
               "src/ratification/schedule.mjs scheduleUncheckableRefusal > is-schedule-uncheckable");
});

test("R47: C-32.14's and C-32.15's translations say \"one of the operator's access tokens for your group's Civicsmith\", nothing else changed, and no row of this module calls it this copy, this instance or this plane", () => {
  assert.deepEqual(R.rowOf("OPERATOR_TOKEN_CANNOT_RATIFY"), { code: "OPERATOR_TOKEN_CANNOT_RATIFY", check: "C-32.14",
    translation: word("refusal.OPERATOR_TOKEN_CANNOT_RATIFY") });
  assert.deepEqual(R.rowOf("OPERATOR_TOKEN_CANNOT_RATIFY_CASE"), { code: "OPERATOR_TOKEN_CANNOT_RATIFY_CASE", check: "C-32.15",
    translation: word("refusal.OPERATOR_TOKEN_CANNOT_RATIFY_CASE") });
  const rows = [R.RATIFY_MACHINE_FENCE_CHECKS, R.RATIFY_TESTIMONY_CHECKS, R.RATIFY_ATTRIBUTION_CHECKS,
                R.CASE_CONCLUSION_CHECKS, R.RATIFY_SCOPE_CHECKS, R.RELEASE_CHECKS, R.RATIFY_REGISTRATION_CHECKS]
    .flatMap((f) => Object.values(f).map((r) => r.translation));
  for (const t of rows) assert.doesNotMatch(t, /this (copy|instance|plane)\b|\bthe plane\b/i, t);
});

test("R15: no place is named in this module's rows", () => {
  const said = JSON.stringify([
    R.RATIFY_MACHINE_FENCE_CHECKS, R.RATIFY_TESTIMONY_CHECKS, R.RATIFY_ATTRIBUTION_CHECKS, R.CASE_CONCLUSION_CHECKS,
    R.RATIFY_SCOPE_CHECKS, R.RELEASE_CHECKS, R.RATIFY_REGISTRATION_CHECKS]);
  assert.doesNotMatch(said, /oakland|alameda|california|berkeley/i);
  assert.match("Oakland", /oakland/i, "negative control");
});
