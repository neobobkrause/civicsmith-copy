/* review: the invariants (R20, R21, R23, R24, R25). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, P, V, SECRET } from "./fixture.mjs";
import { REVIEW_COPY_CHECKS, REVIEW_MARKING, REVIEW_TABLES, REVIEW_LIST_MAX, noReviewCopy, caseIdentitySentence,
         statedEdition, reviewOwns } from "../../../src/review/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import * as recordCore from "../../../src/record-core/index.mjs";
import * as membership from "../../../src/membership/index.mjs";
import * as strength from "../../../src/strength/index.mjs";
import * as basisVersionsChecks from "../../../src/basis-versions/checks.mjs";
import * as publication from "../../../src/publication/index.mjs";
import * as caseAuthoring from "../../../src/case-authoring/index.mjs";
import * as caseInputs from "../../../src/case-inputs/index.mjs";
import { DRAFTS_READ_MAX } from "../../../src/case-inputs/index.mjs";

/** Every act and read, over two drafts (one naming a case), a grant, a revocation, comments and the list. */
function battery(w) {
  const out = [];
  const keep = (r) => { out.push(r); return r; };
  w.publishedCase("CASE-2026-0001", P, 1);
  const a = keep(w.r.act({ act: "draft", author: "ed", project: P, statement: "S", caseId: "CASE-2026-0001", targets: ["INQ-1"] }));
  const b = keep(w.r.act({ act: "draft", author: "ann", project: P, statement: "T", newCase: true }));
  keep(w.r.act({ act: "draft", author: "ann", draft: a.draftId, statement: "S2", caseId: "CASE-2026-0001" }));
  const g = keep(w.r.act({ act: "grant", author: "ann", draft: a.draftId, recipient: "Reporter", secretSha: SECRET(1) }));
  keep(w.r.act({ act: "grant", author: "ann", draft: b.draftId, recipient: "Editor", secretSha: SECRET(2) }));
  keep(w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "a question" }));
  keep(w.r.comment({ draft: b.draftId, viewer: V("ivy"), text: "a note" }));
  keep(w.r.copy({ secretSha: SECRET(1), bySecret: true }));
  keep(w.r.copy({ draft: a.draftId, viewer: V("ann") }));
  keep(w.r.copy({ draft: b.draftId, viewer: V("ann") }));
  keep(w.r.list({ project: P, viewer: V("ann") }));
  keep(w.r.act({ act: "revoke", author: "ann", grant: g.grantId }));
  keep(w.r.copy({ secretSha: SECRET(1), bySecret: true }));
  for (const code of Object.keys(REVIEW_COPY_CHECKS)) keep(drive(w, code, a.draftId));
  return out;
}

/** One refusal per row, driven at the interface. */
function drive(w, code, draftId) {
  switch (code) {
    case "MACHINE_CANNOT_REVIEW": return w.r.act({ act: "draft", author: "class:ai", project: P });
    case "NO_REVIEW_COPY": return w.r.copy({ draft: draftId, viewer: V("out") });
    case "REVIEW_UNKNOWN_ACT": return w.r.act({ act: "publish", author: "ann" });
    case "REVIEW_NOT_PROJECT_OWNER": return w.r.act({ act: "grant", author: "ed", draft: draftId, recipient: "R", secretSha: SECRET(5) });
    case "REVIEW_NO_PROJECT": return w.r.act({ act: "draft", author: "ann" });
    case "REVIEW_DRAFT_CHANGES_PROJECT": return w.r.act({ act: "draft", author: "ann", draft: draftId, project: "PROJ-2026-0002-q" });
    case "REVIEW_NO_SUCH_CASE": return w.r.act({ act: "draft", author: "ann", project: P, caseId: "CASE-2026-0404" });
    case "REVIEW_DRAFT_TOO_LARGE": return w.r.act({ act: "draft", author: "ann", project: P, scope: "x".repeat(70000) });
    case "REVIEW_NO_RECIPIENT": return w.r.act({ act: "grant", author: "ann", draft: draftId, recipient: "" });
    case "REVIEW_NO_SECRET": return w.r.act({ act: "grant", author: "ann", draft: draftId, recipient: "R", secretSha: "x" });
    case "REVIEW_NO_GRANT": return w.r.act({ act: "revoke", author: "ann" });
    case "REVIEW_NO_COMMENT_TEXT": return w.r.comment({ draft: draftId, viewer: V("ann"), text: "" });
    case "REVIEW_BATCH_TOO_LARGE": return w.r.copyMany({ drafts: Array.from({ length: 21 }, (_, i) => `DRAFT-2026-${i}`), viewer: V("ann") });
    case "REVIEW_BAD_UNTIL": return w.r.act({ act: "grant", author: "ann", draft: draftId, recipient: "R", secretSha: SECRET(6), until: "tomorrow" });
    case "APPROVAL_RULE_BAD_APPROVERS": return w.r.approvalRuleSet({ approvers: [], by: "adm" });
    case "CASE_NOT_AN_APPROVER": return w.r.caseApprove({ case: "CASE-2026-0009", edition: 2, docSha: SECRET(7), by: "out" });
    case "APPROVAL_NO_SUCH_DOCUMENT":
      approvable(w);
      return w.r.caseApprove({ case: "CASE-2026-0009", edition: 2, docSha: SECRET(7), by: "ann" });
    case "APPROVAL_REASON_TOO_LONG":
      return w.r.caseApprove({ case: "CASE-2026-0009", edition: 2, docSha: approvable(w), by: "ann", reason: "r".repeat(4001) });
    default: throw new Error(`no driver for ${code}`);
  }
}

/* R30, R31: a rule naming ann, and P's case CASE-2026-0009 with an unsigned document at edition 2; answers its sha. */
function approvable(w) {
  w.publishedCase("CASE-2026-0009", P, 1);
  if (!w.r.approvalRule()) w.r.approvalRuleSet({ approvers: ["ann"], by: "adm" });
  return w.caseDocument("CASE-2026-0009", 2);
}

/* this module's tables, the minter's ledger, and SQLite's own autoincrement counter for review_comments */
const OWN = new Set(["case_drafts", "review_grants", "review_comments", "approval_rules", "case_approvals", "minted_ids",
                     "sqlite_sequence"]);

test("R20: nothing here writes the published projection, a case document or a signature; a copy never leaves the instance", () => {
  const w = standard();
  const others = () => Object.fromEntries(Object.entries(w.snapshot()).filter(([t]) => !OWN.has(t) && t !== "cases" && t !== "published_cases"));
  w.publishedCase("CASE-2026-0001", P, 1);
  approvable(w);                                  // the fixture's case document for R31's refusals, written by the test
  const before = others();
  const pub = () => [w.rows(`SELECT * FROM cases`), w.rows(`SELECT * FROM published_cases`)];
  const pubBefore = JSON.stringify(pub());
  const answers = battery(w);
  assert.deepEqual(others(), before, "no table outside this module's own was written, the dry run's case document included");
  assert.equal(JSON.stringify(pub()), pubBefore);
  assert.ok(w.calls.publish.length >= 3, "the gates were run");
  for (const c of answers.filter((x) => x && x.kind === "review-copy"))
    assert.deepEqual([c.published, c.signature.signed, c.marking], [false, false, REVIEW_MARKING]);
});

test("R21: no secret's value is received or stored, only its fingerprint", () => {
  const w = standard();
  const VALUE = "the-read-secret-value-itself";
  const d = w.r.act({ act: "draft", author: "ann", project: P, statement: "S", secret: VALUE, secretValue: VALUE });
  const g = w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: "R", secretSha: SECRET(1), secret: VALUE });
  assert.equal(g.ok, true);
  /* a grant's secret field is the 64-hex fingerprint the control plane took, never a value */
  assert.equal(w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: "R", secretSha: VALUE }).code, "REVIEW_NO_SECRET");
  w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "hello", secret: VALUE });
  const everything = JSON.stringify(w.snapshot());
  assert.equal(everything.includes(VALUE), false, "the value is stored nowhere");
  assert.equal(w.row(`SELECT secret_sha FROM review_grants WHERE grant_id=?`, g.grantId).secret_sha, SECRET(1));
  assert.deepEqual(w.rows(`PRAGMA table_info(review_grants)`).map((c) => c.name).filter((n) => /secret/.test(n)), ["secret_sha"]);
  for (const r of [g, w.r.copy({ secretSha: SECRET(1), bySecret: true }), w.r.copy({ draft: d.draftId, viewer: V("ann") })])
    assert.equal(JSON.stringify(r).includes(VALUE), false);
});

test("R23, R27, R30, R31: C-87.1–C-87.11 and C-32.16 held here with their ids and translations, T41's C-87.13–C-87.16 and T48's C-87.17 (R34) and G12c's C-87.18 (a batch read over its bound), each refused at its interface; C-87.12 retired, its number held by no row", () => {
  const want = { MACHINE_CANNOT_REVIEW: "C-32.16", NO_REVIEW_COPY: "C-87.1", REVIEW_UNKNOWN_ACT: "C-87.2",
    REVIEW_NOT_PROJECT_OWNER: "C-87.3", REVIEW_NO_PROJECT: "C-87.4", REVIEW_DRAFT_CHANGES_PROJECT: "C-87.5",
    REVIEW_NO_SUCH_CASE: "C-87.6", REVIEW_DRAFT_TOO_LARGE: "C-87.7", REVIEW_NO_RECIPIENT: "C-87.8", REVIEW_NO_SECRET: "C-87.9",
    REVIEW_NO_GRANT: "C-87.10", REVIEW_NO_COMMENT_TEXT: "C-87.11", APPROVAL_RULE_BAD_APPROVERS: "C-87.13",
    CASE_NOT_AN_APPROVER: "C-87.14", APPROVAL_NO_SUCH_DOCUMENT: "C-87.15", APPROVAL_REASON_TOO_LONG: "C-87.16",
    REVIEW_BAD_UNTIL: "C-87.17", REVIEW_BATCH_TOO_LARGE: "C-87.18" };
  assert.deepEqual(Object.fromEntries(Object.entries(REVIEW_COPY_CHECKS).map(([k, v]) => [k, v.check])), want);
  assert.ok(Object.isFrozen(REVIEW_COPY_CHECKS));
  /* R27 (N322): C-87.12 retired into record-core's C-59.6; its number is not reused here */
  assert.equal("MINT_EXHAUSTED" in REVIEW_COPY_CHECKS, false);
  assert.equal(recordCore.RECORD_CORE_CHECKS.MINT_EXHAUSTED.check, "C-59.6", "the one row is record-core's");
  /* moved, never copied: no row of a module this one uses holds C-87.12 or one of this module's numbers, while the
     fence rows C-32.16 was split from by number stand at their own homes (C-32.2 basis-versions', C-32.6 case-authoring's) */
  const rowsOf = (ns) => Object.values(ns).filter((v) => v && typeof v === "object" && !Array.isArray(v))
    .flatMap((fam) => Object.values(fam)).filter((r) => r && typeof r === "object" && typeof r.check === "string");
  const elsewhere = [recordCore, membership, strength, basisVersionsChecks, publication, caseAuthoring, caseInputs]
    .flatMap(rowsOf);
  assert.ok(elsewhere.length > 50, "the homes' rows were read");
  for (const r of [...Object.values(REVIEW_COPY_CHECKS), ...elsewhere]) assert.notEqual(r.check, "C-87.12");
  for (const r of elsewhere)
    assert.ok(!Object.values(want).includes(r.check), `${r.check} is held outside review`);
  const held = new Set(elsewhere.map((r) => r.check));
  for (const c of ["C-32.2", "C-32.6"]) assert.ok(held.has(c), `${c} at its home`);
  const w = standard();
  const d = w.r.act({ act: "draft", author: "ann", project: P, statement: "S" });
  for (const [code, check] of Object.entries(want)) {
    const row = REVIEW_COPY_CHECKS[code];
    assert.match(row.where, /^src\/review\/index\.mjs \S+ > is-[a-z-]+$/, code);
    assert.ok(typeof row.translation === "string" && row.translation.length > 40, code);
    const r = drive(w, code, d.draftId);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, code, code, check, row.translation], code);
    assert.equal(typeof r.detail, "string");
  }
});

test("R24, R30, R31: case_drafts, review_grants and review_comments (and T41's approval_rules and case_approvals) are declared to record-core's purge as whole-store tables", () => {
  const w = standard();
  battery(w);
  assert.deepEqual(REVIEW_TABLES.map((t) => [t.name, t.keys]).sort(),
    [["approval_rules", []], ["case_approvals", []], ["case_drafts", []], ["review_comments", []], ["review_grants", []]]);
  for (const t of REVIEW_TABLES) assert.equal(reviewOwns(t.name) && reviewOwns(t), true);
  assert.equal(reviewOwns("statement_acknowledgements"), false);
  const counts = () => ["case_drafts", "review_grants", "review_comments"].map((t) => w.count(t));
  const before = counts();
  assert.ok(before.every((n) => n > 0));
  const one = w.record.purge({ bundleId: P });
  assert.deepEqual(counts(), before, "a single-bundle purge leaves them");
  for (const t of ["case_drafts", "review_grants", "review_comments"]) assert.equal(one.removed?.[t] ?? one.tables?.[t] ?? 0, 0);
  w.record.purge({});
  assert.deepEqual(counts(), [0, 0, 0], "the whole-store purge clears them");
  assert.ok(w.count("minted_ids") > 0, "the minted ids are never reissued");
});

test("R25: no place is named in this module's behaviour or outward text", () => {
  const w = standard();
  const text = JSON.stringify([battery(w), REVIEW_COPY_CHECKS, REVIEW_MARKING, noReviewCopy(),
    [null, "CASE-2026-0001"].flatMap((c) => [true, false].map((n) => caseIdentitySentence(c, 2, n)))]);
  for (const place of ["Oakland", "Alameda", "California", "Berkeley", "San Francisco", "County of", "City of"])
    assert.equal(text.toLowerCase().includes(place.toLowerCase()), false, place);
});

test("R26: REVIEW_LIST_MAX, statedEdition and caseIdentitySentence are exported and pure; case_drafts is a stated read contract", () => {
  assert.equal(REVIEW_LIST_MAX, 500);
  for (const [ident, newCase, want] of [[{ caseId: "C", edition: 3 }, false, 3], [{ caseId: "C", edition: 3 }, true, 3],
                                        [{ caseId: null, edition: 1 }, true, 1], [{ caseId: null, edition: 1 }, false, null],
                                        [{ caseId: null, edition: 1 }, "yes", 1], [{ caseId: null, edition: 1 }, 0, null]])
    assert.equal(statedEdition(ident, newCase), want);
  const ident = { caseId: "C", edition: 3 };
  statedEdition(ident, true);
  assert.deepEqual(ident, { caseId: "C", edition: 3 }, "pure: nothing it is given changes");
  assert.equal(caseIdentitySentence("C", 3, false), caseIdentitySentence("C", 3, false));
  assert.equal(caseIdentitySentence("C", 3, false), word("review.text.next_edition", { edition: "3", case_id: "C" }));
  /* the read contract: the columns, holding what this module's writes put there */
  const w = standard();
  w.clock.now = "2026-09-28T05:00:00.000Z";
  const d = w.r.act({ act: "draft", author: "ed", project: P, statement: "S", scope: "x" });
  const cols = w.rows(`PRAGMA table_info(case_drafts)`).map((c) => c.name);
  for (const c of ["draft_id", "case_id", "project_id", "params", "statement_by", "created_at"]) assert.ok(cols.includes(c), c);
  const r = w.row(`SELECT draft_id, case_id, project_id, params, statement_by, created_at FROM case_drafts`);
  assert.deepEqual({ ...r, params: JSON.parse(r.params) }, { draft_id: d.draftId, case_id: null, project_id: P,
                        params: { scope: "x", statement: "S" }, statement_by: "ed", created_at: "2026-09-28T05:00:00.000Z" });
});

test("R26: case-inputs' own copy of the bound, DRAFTS_READ_MAX (its R3; case-authoring's before T47), equals REVIEW_LIST_MAX (K242)", () => {
  assert.equal(DRAFTS_READ_MAX, REVIEW_LIST_MAX);
  assert.equal(caseInputs.DRAFTS_READ_MAX, 500);
});

/* DEC-149 (T34-87): words that call the group's Civicsmith a machine ("this instance", "this plane", "the plane", "this
   copy" for the whole Civicsmith). A review copy is still called a copy, which DEC-149 keeps. */
const MACHINE_WORDS = /\b(?:this|the|your|our)\s+(?:group's\s+)?(?:instance|plane|server)s?\b/i;

test("R11 (DEC-149): the marking every copy carries calls the group's Civicsmith no machine word and addresses no reader as the group", () => {
  assert.doesNotMatch(REVIEW_MARKING, MACHINE_WORDS);
  assert.doesNotMatch(REVIEW_MARKING, /your group/i, "a recipient outside the group reads it too");
  assert.match(REVIEW_MARKING, /^REVIEW COPY — NOT A PUBLICATION\. This is a draft of a case, shown to the people it was addressed to without leaving the team that made it\. /);
  /* what every copy carries, on both doors */
  const w = standard();
  const d = w.r.act({ act: "draft", author: "ann", project: P, statement: "S" });
  w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: "R", secretSha: SECRET(1) });
  for (const c of [w.r.copy({ draft: d.draftId, viewer: V("ann") }), w.r.copy({ secretSha: SECRET(1), bySecret: true })])
    assert.equal(c.marking, REVIEW_MARKING);
  /* negative control: the old words are seen */
  assert.match("shown inside this instance to the people", MACHINE_WORDS);
});

test("R3, R23 (DEC-149): C-87.7 REVIEW_DRAFT_TOO_LARGE's translation says \"your group's Civicsmith\", and no member's translation calls it a machine", () => {
  const t = REVIEW_COPY_CHECKS.REVIEW_DRAFT_TOO_LARGE.translation;
  assert.match(t, /^This draft's arguments are larger than your team's Civicsmith will store: the limit is 64 KiB, /);
  const w = standard();
  const r = w.r.act({ act: "draft", author: "ann", project: P, scope: "x".repeat(70000) });
  assert.deepEqual([r.code, r.check, r.translation], ["REVIEW_DRAFT_TOO_LARGE", "C-87.7", t]);
  for (const [code, row] of Object.entries(REVIEW_COPY_CHECKS)) assert.doesNotMatch(row.translation, MACHINE_WORDS, code);
  assert.match("larger than the plane will store", MACHINE_WORDS, "negative control");
});
