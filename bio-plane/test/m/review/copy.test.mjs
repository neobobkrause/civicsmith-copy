/* review: the copy's answer (R11–R17) and the comment (R18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, P, V, SECRET, NOW } from "./fixture.mjs";
import { REVIEW_COPY_CHECKS, REVIEW_MARKING, REVIEW_LIST_MAX, REVIEW_TEXT_MAX, noReviewCopy,
         caseIdentitySentence, reviewOf } from "../../../src/review/index.mjs";
import { caseInputsOf, statementSha, withheldWriterStated } from "../../../src/case-inputs/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const DEAD = JSON.stringify(noReviewCopy());
const NO_FINDING = localize("review.index.this_draft_names_a_finding", "this draft names a finding its editor cannot read, or one that does not exist.");
const draft = (w, extra = {}, author = "ann") => w.r.act({ act: "draft", author, project: P, statement: "S", ...extra });
const grant = (w, d, n) => w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: `R${n}`, secretSha: SECRET(n) });
const AUTHORED = { scope: "the scope", statement: "the statement", excluded: [{ id: "X", why: "w" }], subjectPosition: "neutral",
                   subjectJustification: "because", biasAcknowledgement: "none known" };

test("R11: the answer's parts", () => {
  const w = standard();
  w.project("PROJ-2026-0003-b", { owners: ["ann"], bar: { capture: "B", connection: "C" } });
  w.publishedCase("CASE-2026-0001", "PROJ-2026-0003-b", 1);
  const d = w.r.act({ act: "draft", author: "ann", project: "PROJ-2026-0003-b", caseId: "CASE-2026-0001", ...AUTHORED,
                      targets: [], roles: {} });
  const c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(Object.keys(c).sort(), ["authored", "case", "choices", "comments", "comments_truncated", "draft", "evaluated",
    "findings", "gates", "grants", "grants_truncated", "kind", "last_change", "list_limit", "marking", "missing",
    "observations", "ok", "project", "published", "reader", "required_strength", "signature", "statement_acknowledgements",
    "statement_by", "statement_by_stated", "title", "updated_at", "updated_by", "zone"].sort());
  assert.deepEqual([c.ok, c.kind, c.marking, c.published, c.signature.signed, c.draft, c.project, c.reader],
    [true, "review-copy", REVIEW_MARKING, false, false, d.draftId, "PROJ-2026-0003-b", "member"]);
  assert.match(REVIEW_MARKING, /NOT A PUBLICATION/);
  assert.match(c.signature.detail, /never signed/);
  assert.deepEqual(c.case, { case_id: "CASE-2026-0001", edition: 2, identity: caseIdentitySentence("CASE-2026-0001", 2, false),
                             newCase: false });
  assert.deepEqual(c.authored, { ...AUTHORED, account: null, whatChanged: null }, "the eight authored fields (R38)");
  assert.deepEqual([c.updated_by, c.updated_at, c.statement_by], ["ann", NOW, "ann"]);
  assert.equal(c.statement_by_stated, "ann wrote the exclusion statement as it now stands");
  /* the grant part: the member door's roster; the recipient's own grant */
  grant(w, d, 1);
  assert.equal(w.r.copy({ draft: d.draftId, viewer: V("ann") }).grants.length, 1);
  const rc = w.r.copy({ secretSha: SECRET(1), bySecret: true });
  assert.deepEqual(Object.keys(rc.grant).sort(), ["grant_id", "issued_at", "issued_by", "recipient", "until", "zone"]);
  assert.equal("grants" in rc, false);
  /* required_strength: the project's bar as op=publish would freeze it (strength's projectBar), read now */
  assert.deepEqual(c.required_strength, w.strength.projectBar("PROJ-2026-0003-b"));
  assert.deepEqual([c.required_strength.declared, c.required_strength.capture, c.required_strength.connection], [true, "B", "C"]);
  /* an undetermined writer, and newCase said back as the gates read it */
  w.st.sql.exec(`UPDATE case_drafts SET statement_by=NULL WHERE draft_id=?`, d.draftId);
  assert.match(w.r.copy({ draft: d.draftId, viewer: V("ann") }).statement_by_stated, /^UNDETERMINED/);
  const n = w.r.act({ act: "draft", author: "ann", project: P, newCase: "false" });
  assert.deepEqual(w.r.copy({ draft: n.draftId, viewer: V("ann") }).case,
    { case_id: null, edition: 1, identity: caseIdentitySentence(null, 1, true), newCase: true });
});

test("R12: each finding is read as the draft's last editor may see it, for both doors", () => {
  const w = standard();
  w.bundle("INQ-2026-0001-a", "inquiry", "---\ntitle: a\n---\nA's text", "concluded");
  w.bundle("INQ-2026-0002-b", "inquiry", null, "open");
  w.project("PROJ-2026-0009-z", { owners: ["quinn"] });          // a bundle ed cannot see
  const roles = { "INQ-2026-0001-a": "load_bearing", "PROJ-2026-0009-z": "supporting", "INQ-2026-0404-none": "supporting" };
  const d = w.r.act({ act: "draft", author: "ed", project: P, statement: "S", roles,
                      targets: "INQ-2026-0001-a, INQ-2026-0002-b,PROJ-2026-0009-z,INQ-2026-0404-none" });
  grant(w, d, 1);
  const want = [
    { target: "INQ-2026-0001-a", present: true, object_type: "inquiry", state: "concluded", role: "load_bearing",
      text: "A's text", statement: "A's text", falsifier: null, title: "INQ-2026-0001-a", concluded: true },
    { target: "INQ-2026-0002-b", present: true, object_type: "inquiry", state: "open", role: null, text: null, statement: null, falsifier: null,
      title: "INQ-2026-0002-b", concluded: false },
    { target: "PROJ-2026-0009-z", present: false, role: "supporting",
      detail: NO_FINDING },
    { target: "INQ-2026-0404-none", present: false, role: "supporting",
      detail: NO_FINDING },
  ];
  /* the recipient, a member who could see z (quinn cannot read P's drafts; an administrator invited to P and z both,
     who has standing in P's drafts and sight of z under D54), and ed */
  w.member("adm2", "admin");
  for (const pid of [P, "PROJ-2026-0009-z"])
    w.st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?,?,?,?,?,?)`, pid, "adm2", "invited", 0, NOW, NOW);
  assert.equal(w.membership.inSight("PROJ-2026-0009-z", V("adm2")), true, "the reader can see z");
  /* R41: a finding with no words is told as not concluded yet (a plain state in `not_concluded`, null when concluded) */
  const asRead = (fs) => fs.map(({ not_concluded: nc, ...f }) => {
    if (f.present) assert.equal(typeof nc, f.concluded ? "object" : "string", f.target);
    return f;
  });
  assert.deepEqual(asRead(w.r.copy({ secretSha: SECRET(1), bySecret: true }).findings), want);
  assert.deepEqual(asRead(w.r.copy({ draft: d.draftId, viewer: V("adm2") }).findings), want, "the reader's own sight does not widen it");
  /* D54: an administrator neither invited nor joined to hidden P has no member door at all */
  assert.equal(JSON.stringify(w.r.copy({ draft: d.draftId, viewer: V("adm") })), DEAD);
  assert.deepEqual(asRead(w.r.copy({ draft: d.draftId, viewer: V("ed") }).findings), want);
  /* the editor changes: the next last editor's sight governs */
  w.st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                 VALUES (?,?,?,?,?,?)`, "PROJ-2026-0009-z", "ann", "joined", 0, NOW, NOW);
  w.r.act({ act: "draft", author: "ann", draft: d.draftId, statement: "S", roles, targets: ["PROJ-2026-0009-z"] });
  assert.equal(w.r.copy({ secretSha: SECRET(1), bySecret: true }).findings[0].present, true);
  /* `target` alone, and no targets */
  const one = w.r.act({ act: "draft", author: "ann", project: P, target: "INQ-2026-0001-a" });
  assert.deepEqual(w.r.copy({ draft: one.draftId, viewer: V("ann") }).findings.map((f) => f.target), ["INQ-2026-0001-a"]);
  const none = w.r.act({ act: "draft", author: "ann", project: P });
  assert.deepEqual(w.r.copy({ draft: none.draftId, viewer: V("ann") }).findings, []);
});

test("R13: missing is the publish gates' own answer, run as the member who would publish, inside a transaction always rolled back", () => {
  const w = standard();
  const d = w.r.act({ act: "draft", author: "ed", project: P, ...AUTHORED, targets: ["INQ-1"],
                      roles: { "INQ-1": "load_bearing" } });
  const before = w.snapshot();
  /* passed */
  let c = w.r.copy({ draft: d.draftId, viewer: V("ed") });
  assert.deepEqual([c.gates, c.missing], ["passed", []]);
  assert.match(c.evaluated, /none refused\. Nothing was published/);
  const call = w.calls.publish.at(-1);
  assert.deepEqual(call, { ...AUTHORED, targets: ["INQ-1"], roles: { "INQ-1": "load_bearing" }, project: P,
                           viewer: V("ann"), author: "ann" },
    "the draft's arguments, as the lowest-id owner when the last editor is not an owner");
  assert.deepEqual(w.snapshot(), before, "nothing persists: the act's write was rolled back");
  /* refused: the first refusal only, without `ok` */
  w.ca.gate = () => ({ ok: false, reason: "NO_TARGET", code: "NO_TARGET", check: "C-x", detail: "d" });
  c = w.r.copy({ draft: d.draftId, viewer: V("ed") });
  assert.deepEqual([c.gates, c.missing], ["refused", [{ reason: "NO_TARGET", code: "NO_TARGET", check: "C-x", detail: "d" }]]);
  assert.match(c.evaluated, /first refusal only.*UNDETERMINED, not absent/);
  /* no answer */
  w.ca.gate = () => undefined;
  c = w.r.copy({ draft: d.draftId, viewer: V("ed") });
  assert.deepEqual([c.gates, c.missing], ["undetermined", []]);
  assert.match(c.evaluated, /UNDETERMINED/);
  assert.deepEqual(w.snapshot(), before);
  /* a failure that is not the rollback is not swallowed, and still leaves nothing */
  w.ca.throws = new Error("boom");
  assert.throws(() => w.r.copy({ draft: d.draftId, viewer: V("ed") }), /boom/);
  assert.deepEqual(w.snapshot(), before);
  w.ca.throws = null; w.ca.gate = () => ({ ok: true });
  /* who publishes: the last editor when an owner; else the lowest-id owner; else (no owner) the editor */
  w.r.act({ act: "draft", author: "bea", draft: d.draftId, statement: "S" });
  w.r.copy({ draft: d.draftId, viewer: V("ed") });
  assert.deepEqual([w.calls.publish.at(-1).author, w.calls.publish.at(-1).viewer], ["bea", V("bea")]);
  w.project("PROJ-2026-0005-o", { owners: ["zed", "bea", "cat"], joined: ["ed"] });
  const o = w.r.act({ act: "draft", author: "ed", project: "PROJ-2026-0005-o" });
  w.r.copy({ draft: o.draftId, viewer: V("ed") });
  assert.equal(w.calls.publish.at(-1).author, "bea", "the lowest id, not the first owner");
  w.project("PROJ-2026-0006-n", { joined: ["ed"] });
  const n = w.r.act({ act: "draft", author: "ed", project: "PROJ-2026-0006-n" });
  w.r.copy({ draft: n.draftId, viewer: V("ed") });
  assert.deepEqual([w.calls.publish.at(-1).author, w.calls.publish.at(-1).project], ["ed", "PROJ-2026-0006-n"]);
  /* the recipient door runs the same gates */
  grant(w, d, 1);
  const before2 = w.calls.publish.length;
  w.r.copy({ secretSha: SECRET(1), bySecret: true });
  assert.equal(w.calls.publish.length, before2 + 1);
});

test("R14: comments and the grant roster are read under a cap; the recipient sees only its own grant; live is judged now", () => {
  const w = standard();
  w.publishedCase("CASE-2026-0001", P, 1);
  const d = draft(w);
  for (let i = 0; i < 4; i++) w.r.comment({ draft: d.draftId, viewer: V("ed"), text: `c${i}` });
  const gs = [1, 2, 3].map((n) => { w.clock.now = `2026-09-28T0${n}:30:00.000Z`; return grant(w, d, n); });
  w.r.act({ act: "revoke", author: "ann", grant: gs[1].grantId });
  let c = w.r.copy({ draft: d.draftId, viewer: V("ann"), limit: "2" });
  assert.deepEqual([c.comments.map((x) => x.text), c.comments_truncated, c.list_limit], [["c0", "c1"], true, 2]);
  assert.deepEqual([c.grants.length, c.grants_truncated], [2, true]);
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual([c.comments.length, c.comments_truncated, c.list_limit, c.grants.length, c.grants_truncated],
    [4, false, REVIEW_LIST_MAX, 3, false]);
  for (const [limit, want] of [[0, REVIEW_LIST_MAX], ["-1", REVIEW_LIST_MAX], ["abc", REVIEW_LIST_MAX], [null, REVIEW_LIST_MAX],
                               [100000, REVIEW_LIST_MAX], [1, 1], ["4", 4]])
    assert.equal(w.r.copy({ draft: d.draftId, viewer: V("ann"), limit }).list_limit, want, String(limit));
  assert.equal(w.r.copy({ draft: d.draftId, viewer: V("ann"), limit: 4 }).comments_truncated, false);
  /* the roster: each marked live against the draft's identity now; a no-case grant states its edition only while live */
  assert.deepEqual(c.grants.map((g) => [g.grant_id, g.live, g.edition]),
    [[gs[0].grantId, true, null], [gs[1].grantId, false, null], [gs[2].grantId, true, null]]);
  w.r.act({ act: "draft", author: "ann", draft: d.draftId, statement: "S", newCase: true, caseId: null });
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(c.grants.map((g) => [g.live, g.edition]), [[true, 1], [false, null], [true, 1]]);
  w.r.act({ act: "draft", author: "ann", draft: d.draftId, statement: "S", caseId: "CASE-2026-0001" });
  w.clock.now = "2026-09-28T04:30:00.000Z"; const named = grant(w, d, 4);
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(c.grants.map((g) => [g.live, g.edition]), [[false, null], [false, null], [false, null], [true, 2]]);
  assert.equal(c.grants[3].grant_id, named.grantId);
  w.publishedCase("CASE-2026-0001", P, 2);
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(c.grants[3].live === false && c.grants[3].edition, 2, "a named case's edition is stated, live or not");
  /* the recipient sees only its own grant */
  w.r.act({ act: "draft", author: "ann", draft: d.draftId, statement: "S", caseId: null, newCase: null });
  const rc = w.r.copy({ secretSha: SECRET(3), bySecret: true });
  assert.deepEqual(rc.grant, { grant_id: gs[2].grantId, recipient: "R3", issued_by: "ann", issued_at: "2026-09-28T03:30:00.000Z",
                          until: null, zone: null });
  assert.equal(JSON.stringify(rc).includes(gs[0].grantId), false, "no other grant is named");
  assert.equal(rc.comments.length, 4, "comments are the draft's, for both doors");
});

test("R15: the acknowledgement list is case-inputs' list (its R2) at this draft's identity, the writer's own rows withheld and counted", () => {
  const w = standard();
  w.publishedCase("CASE-2026-0001", P, 1);
  const d = draft(w, { caseId: "CASE-2026-0001", statement: "the statement" }, "ed");
  w.ca.acks = [{ project: P, statement: "the statement", kind: "participant", by: "ann", at: "2026-09-28T01:00:01.000Z" },
               { project: P, statement: "the statement", kind: "participant", by: "ed", at: "2026-09-28T01:00:02.000Z" },
               { project: P, statement: "the statement", kind: "recipient", by: "RVG-1", recipient: "R", at: "2026-09-28T01:00:03.000Z" }];
  let c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(w.calls.acks.at(-1), { project: P, caseId: "CASE-2026-0001", edition: 2, statement: "the statement",
                                          exceptAuthor: null, writer: { by: "ed" }, draftId: d.draftId });
  const s = c.statement_acknowledgements;
  assert.deepEqual(Object.keys(s).sort(), ["acknowledgements", "acknowledgements_by_statement_writer_not_listed", "act",
    "act_requires", "statement_sha", "truncated", "withheld", "withheld_stated"].sort());
  assert.deepEqual(s.acknowledgements.map((a) => a.by), ["ann", "RVG-1"], "the writer's own row is never listed");
  assert.deepEqual([s.withheld, s.acknowledgements_by_statement_writer_not_listed, s.withheld_stated, s.act],
    [1, 1, "withheld 1 by ed", `op=statementack&draft=${d.draftId}`]);
  /* an undetermined writer withholds every participant row, counted */
  w.st.sql.exec(`UPDATE case_drafts SET statement_by=NULL WHERE draft_id=?`, d.draftId);
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(w.calls.acks.at(-1).writer, { by: null });
  assert.deepEqual([c.statement_acknowledgements.acknowledgements.map((a) => a.kind), c.statement_acknowledgements.withheld,
                    c.statement_acknowledgements.acknowledgements_withheld_writer_undetermined,
                    "acknowledgements_by_statement_writer_not_listed" in c.statement_acknowledgements,
                    c.statement_acknowledgements.withheld_stated], [["recipient"], 2, 2, false, "withheld 2 by UNDETERMINED"]);
  /* nothing withheld: a zero is a count, and the sentence is always said */
  w.ca.acks = [];
  c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual([c.statement_acknowledgements.withheld, c.statement_acknowledgements.withheld_stated], [0, "withheld 0 by UNDETERMINED"]);
  /* a draft naming no case is asked at its internal identity, with the draft */
  const n = draft(w);
  w.r.copy({ draft: n.draftId, viewer: V("ann") });
  assert.deepEqual([w.calls.acks.at(-1).caseId, w.calls.acks.at(-1).edition, w.calls.acks.at(-1).draftId], [null, 1, n.draftId]);
  /* T47 (N908): asked of case-inputs only, never of case-authoring, which no longer holds the list */
  assert.deepEqual(w.calls.acksViaCaseAuthoring, []);
});

test("R15, R28 (T47; N908): on a host that hands it no case-inputs, the list is the host's one case-inputs instance's (its R16, R2), the writer's own row withheld and counted", () => {
  const w = standard();
  const host = { storage: w.st };
  const r = reviewOf(host, { record: w.record, membership: w.membership, strength: w.strength,
                             basisVersions: { testimonyReach: () => ({ self: [], via: [] }) },
                             caseAuthoring: w.caseAuthoring, now: () => NOW,
                             publication: { registerReviewProvider: () => ({ ok: true }) },
                             caseAccount: { registerReviewComments: () => ({ ok: true }) },
                             ratification: { registerApprovalReader: () => ({ ok: true }) } });
  assert.equal(r.caseInputs, caseInputsOf(host), "the one instance for the host");
  const d = r.act({ act: "draft", author: "ed", project: P, statement: "the statement" });
  r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: "The Reporter", secretSha: SECRET(1) });
  /* readings of this draft's statement at its identity (no case, edition 1, through this draft), as case-inputs
     stores them; one of another draft and one of another sentence are not this copy's */
  const ack = (draftId, statement, kind, by, at, recipient = null) => w.st.sql.exec(
    `INSERT INTO statement_acknowledgements (project_id, case_id, edition, statement_sha, draft_id, acknowledger_kind,
     acknowledger, recipient, at, reason) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    P, null, 1, statementSha(statement), draftId, kind, by, recipient, at, `read by ${by}`);
  ack(d.draftId, "the statement", "participant", "ann", "2026-09-28T01:00:01.000Z");
  ack(d.draftId, "the statement", "participant", "ed", "2026-09-28T01:00:02.000Z");
  ack(d.draftId, "the statement", "recipient", "RVG-x", "2026-09-28T01:00:03.000Z", "The Reporter");
  ack("DRAFT-2026-0000", "the statement", "participant", "bea", "2026-09-28T01:00:04.000Z");
  ack(d.draftId, "another statement", "participant", "bea", "2026-09-28T01:00:05.000Z");
  for (const c of [r.copy({ draft: d.draftId, viewer: V("ann") }), r.copy({ secretSha: SECRET(1), bySecret: true })]) {
    const s = c.statement_acknowledgements;
    assert.equal(c.ok, true);
    assert.equal(s.statement_sha, statementSha("the statement"));
    assert.deepEqual(s.acknowledgements.map((a) => [a.kind, a.by, a.reason]),
      [["participant", "ann", "read by ann"], ["recipient", "RVG-x", "read by RVG-x"]]);
    assert.deepEqual([s.withheld, s.acknowledgements_by_statement_writer_not_listed, s.withheld_stated, s.truncated],
      [1, 1, withheldWriterStated(1, "ed"), false]);
    assert.deepEqual([s.act, s.act_requires], [`op=statementack&draft=${d.draftId}`, ["reason"]]);
  }
  /* negative control: case-authoring is never asked for the list */
  assert.deepEqual(w.calls.acksViaCaseAuthoring, []);
});

/* R28's whole claim over one copy: the link is `op=statementack&draft=<id>` and nothing else (no reader, no words),
   and `act_requires` beside it is exactly ["reason"]. Answers the first breach, or null. */
function r28Breach(c, draftId) {
  const s = c.statement_acknowledgements;
  if (typeof s.act !== "string") return "no link";
  const q = new URLSearchParams(s.act);
  if (JSON.stringify([...q.keys()]) !== JSON.stringify(["op", "draft"])) return `the link carries ${[...q.keys()]}`;
  if (q.get("op") !== "statementack" || q.get("draft") !== draftId) return "the link names another act or draft";
  if (!("act_requires" in s)) return "no act_requires";
  if (JSON.stringify(s.act_requires) !== JSON.stringify(["reason"])) return `act_requires ${JSON.stringify(s.act_requires)}`;
  return null;
}

test("R28: the acknowledgement act stays its link, naming nothing of the reader's, with act_requires [reason] beside it, on both doors", () => {
  const w = standard();
  w.publishedCase("CASE-2026-0001", P, 1);
  const d = draft(w, { caseId: "CASE-2026-0001", statement: "the statement" }, "ed");
  grant(w, d, 1);
  w.ca.acks = [{ project: P, statement: "the statement", kind: "participant", by: "ann", at: "2026-09-28T01:00:01.000Z",
                 reason: "I checked every excluded record" }];
  const copies = [["member ann", w.r.copy({ draft: d.draftId, viewer: V("ann") })],
                  ["member ivy", w.r.copy({ draft: d.draftId, viewer: V("ivy") })],
                  ["recipient", w.r.copy({ secretSha: SECRET(1), bySecret: true })],
                  ["recipient naming the draft", w.r.copy({ draft: d.draftId, secretSha: SECRET(1), bySecret: true })]];
  for (const [who, c] of copies) {
    assert.equal(c.ok, true, who);
    assert.equal(r28Breach(c, d.draftId), null, who);
    assert.equal(c.statement_acknowledgements.act, `op=statementack&draft=${d.draftId}`, `${who}: act unchanged`);
    assert.deepEqual(c.statement_acknowledgements.act_requires, ["reason"], who);
  }
  assert.equal(new Set(copies.map(([, c]) => JSON.stringify([c.statement_acknowledgements.act,
    c.statement_acknowledgements.act_requires]))).size, 1, "both doors answer it alike");
  /* each copy is its own: a caller mutating one answer's array does not reach the next */
  copies[0][1].statement_acknowledgements.act_requires.push("x");
  assert.deepEqual(w.r.copy({ draft: d.draftId, viewer: V("ann") }).statement_acknowledgements.act_requires, ["reason"]);
  /* negative controls: a copy without the key, with a reason pre-filled or the reader in the link, or with another
     requirement, is seen */
  const base = copies[0][1];
  const bent = (f) => { const c = structuredClone(base); f(c.statement_acknowledgements); return c; };
  for (const [what, c] of [
    ["no key", bent((s) => { delete s.act_requires; })],
    ["a reason pre-filled", bent((s) => { s.act += "&reason=I%20agree"; })],
    ["the reader in the link", bent((s) => { s.act += "&viewer=member%3Aann"; })],
    ["another draft", bent((s) => { s.act = "op=statementack&draft=DRAFT-2026-0000"; })],
    ["another act", bent((s) => { s.act = `op=reviewcomment&draft=${d.draftId}`; })],
    ["empty requires", bent((s) => { s.act_requires = []; })],
    ["a requirement more", bent((s) => { s.act_requires = ["reason", "viewer"]; })]])
    assert.notEqual(r28Breach(c, d.draftId), null, what);
});

test("R15, R28: each acknowledgement row carries its reason as case-inputs stored it; a row from before DEC-88 carries null, not filled", () => {
  const w = standard();
  const d = draft(w, { statement: "the statement" }, "ed");
  w.ca.acks = [{ project: P, statement: "the statement", kind: "participant", by: "ann", at: "2026-09-28T01:00:01.000Z",
                 reason: "  I read the excluded records  " },
               { project: P, statement: "the statement", kind: "participant", by: "bea", at: "2026-09-28T01:00:02.000Z" },
               { project: P, statement: "the statement", kind: "recipient", by: "RVG-1", recipient: "R",
                 at: "2026-09-28T01:00:03.000Z", reason: "seen from outside" }];
  /* case-inputs' row as it answers it, with R46's author beside it (a reader's name, else the member) */
  const answered = w.ca.acks.map((r) => ({ kind: r.kind, by: r.by, recipient: r.recipient ?? null, at: r.at,
                                           reason: r.reason ?? null,
                                           author: r.kind === "recipient" ? r.recipient : r.by,
                                           author_kind: r.kind === "recipient" ? "recipient" : "member" }));
  for (const c of [w.r.copy({ draft: d.draftId, viewer: V("ann") }),
                   (grant(w, d, 1), w.r.copy({ secretSha: SECRET(1), bySecret: true }))]) {
    const rows = c.statement_acknowledgements.acknowledgements;
    assert.deepEqual(rows, answered, "the rows as case-inputs answers them, byte for byte");
    assert.equal(rows[0].reason, "  I read the excluded records  ", "the words as stored, not trimmed or rewritten");
    assert.equal(rows[1].reason, null, "a row recorded before DEC-88: null, stated");
    assert.ok("reason" in rows[1]);
    /* negative control: a filled-in reason would be seen */
    assert.notDeepEqual(rows.map((r) => (r.reason === null ? "" : r.reason)), answered.map((r) => r.reason));
  }
});

test("R16: every observation the edition would reach, each with whether its author chose a level for this case edition", () => {
  const w = standard();
  w.publishedCase("CASE-2026-0001", P, 1);
  w.bundle("INQ-2026-0001-a"); w.bundle("OBS-2026-0001-o", "observation"); w.project("PROJ-2026-0009-z", { owners: ["quinn"] });
  w.reach.set("INQ-2026-0001-a", ["OBS-2026-0002-v", "OBS-2026-0003-w", "OBS-2026-0002-v"]);
  w.reach.set("OBS-2026-0001-o", ["OBS-2026-0001-o"]);
  w.reach.set("PROJ-2026-0009-z", ["OBS-2026-0009-hidden"]);
  const d = w.r.act({ act: "draft", author: "ann", project: P, caseId: "CASE-2026-0001",
                      targets: ["INQ-2026-0001-a", "OBS-2026-0001-o", "PROJ-2026-0009-z", "INQ-2026-0404"] });
  w.chosen.add("CASE-2026-0001|2|OBS-2026-0003-w");
  const c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.deepEqual(w.calls.reach.at(-1), ["INQ-2026-0001-a", "OBS-2026-0001-o"], "the present findings only");
  assert.deepEqual(c.observations.map((o) => [o.observation, o.chosen]),
    [["OBS-2026-0001-o", false], ["OBS-2026-0002-v", false], ["OBS-2026-0003-w", true]], "each once");
  assert.equal(c.observations[2].stated, "its author has chosen a level for CASE-2026-0001 edition 2");
  assert.match(c.observations[0].stated, /chosen no level for CASE-2026-0001 edition 2; the edition cannot be signed/);
  assert.equal(JSON.stringify(c.observations).includes("\"level\""), false, "never the level itself");
  assert.ok(w.calls.attribution.some(([cid, e, o]) => cid === "CASE-2026-0001" && e === 2 && o === "OBS-2026-0003-w"));
  /* read from case-tensions directly, never through publication (T35-60, N597; publication R61) */
  assert.deepEqual([w.calls.attribution.length, w.calls.attributionViaPublication.length], [3, 0]);
  /* a draft naming no case: each unchosen, saying why, and the attribution is not asked */
  const asked = w.calls.attribution.length;
  const n = w.r.act({ act: "draft", author: "ann", project: P, newCase: true, targets: ["INQ-2026-0001-a"] });
  const cn = w.r.copy({ draft: n.draftId, viewer: V("ann") });
  assert.deepEqual(cn.observations.map((o) => o.chosen), [false, false]);
  for (const o of cn.observations) assert.match(o.stated, /names no case yet, so no level can be chosen/);
  assert.equal(w.calls.attribution.length, asked);
  assert.equal(w.calls.attributionViaPublication.length, 0);
});

test("R16 (T35-60): the attribution in force is case-tensions' attributionInForce, read directly and never through publication", () => {
  const w = standard();
  w.publishedCase("CASE-2026-0001", P, 2);
  w.bundle("OBS-2026-0001-o", "observation");
  w.reach.set("OBS-2026-0001-o", ["OBS-2026-0001-o"]);
  const d = w.r.act({ act: "draft", author: "ann", project: P, caseId: "CASE-2026-0001", targets: ["OBS-2026-0001-o"] });
  w.chosen.add("CASE-2026-0001|3|OBS-2026-0001-o");
  /* both doors */
  grant(w, d, 1);
  for (const c of [w.r.copy({ draft: d.draftId, viewer: V("ann") }), w.r.copy({ secretSha: SECRET(1), bySecret: true })])
    assert.deepEqual(c.observations, [{ observation: "OBS-2026-0001-o", chosen: true,
      stated: "its author has chosen a level for CASE-2026-0001 edition 3" }]);
  assert.deepEqual(w.calls.attribution, [["CASE-2026-0001", 3, "OBS-2026-0001-o"], ["CASE-2026-0001", 3, "OBS-2026-0001-o"]]);
  assert.deepEqual(w.calls.attributionViaPublication, [], "publication is never asked");
  /* what case-tensions answers is what the copy says: withdrawn there, unchosen here */
  w.chosen.clear();
  const c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  assert.equal(c.observations[0].chosen, false);
  assert.match(c.observations[0].stated, /chosen no level for CASE-2026-0001 edition 3/);
  /* negative control: a read through publication would be seen */
  w.r.publication.attributionInForce("CASE-2026-0001", 3, "OBS-2026-0001-o");
  assert.equal(w.calls.attributionViaPublication.length, 1);
});

test("R17: last_change is the newest dated act the answer carries, ordered by instant; whole-second ties are named; what is live is stated", () => {
  const w = standard();
  w.clock.now = "2026-09-28T10:00:00.500Z";
  const d = draft(w, {}, "ed");
  /* the edit alone */
  let lc = w.r.copy({ draft: d.draftId, viewer: V("ann") }).last_change;
  assert.deepEqual([lc.at, lc.by, lc.by_kind, lc.kind, lc.undetermined_within], ["2026-09-28T10:00:00.500Z", "ed", "member", "edit", []]);
  assert.match(lc.stated, /^the newest dated act these bytes carry is an edit of the draft by ed\. /);
  assert.match(lc.stated, /each finding's text, the publish gates' verdict, and the project's declared floors/);
  /* a comment, a grant and a revocation; an acknowledgement stamped to the second, earlier as an instant though later as a string */
  w.clock.now = "2026-09-28T11:00:00.100Z"; const g = grant(w, d, 1);
  w.clock.now = "2026-09-28T11:30:00.000Z"; w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "hi" });
  w.clock.now = "2026-09-28T12:00:00.250Z"; w.r.act({ act: "revoke", author: "bea", grant: g.grantId });
  w.ca.acks = [{ project: P, statement: "S", kind: "recipient", by: "RVG-x", recipient: "Rx", at: "2026-09-28T12:00:00Z" },
               { project: P, statement: "S", kind: "participant", by: "ann", at: "not a date" }];
  lc = w.r.copy({ draft: d.draftId, viewer: V("ann") }).last_change;
  assert.deepEqual([lc.at, lc.by, lc.by_kind, lc.kind], ["2026-09-28T12:00:00.250Z", "bea", "member", "revocation"]);
  assert.deepEqual(lc.undetermined_within, [{ at: "2026-09-28T12:00:00Z", by: "Rx", by_kind: "recipient", kind: "statement acknowledgement" }]);
  assert.match(lc.stated, /Which of a statement acknowledgement by Rx \(2026-09-28T12:00:00Z\) and a revocation by bea \(2026-09-28T12:00:00\.250Z\) came later is undetermined: a statement acknowledgement by Rx was recorded to the second/);
  /* the recipient's copy carries only its own grant: a revocation it does not carry cannot date it */
  w.ca.acks = [];
  w.clock.now = "2026-09-28T13:00:00.000Z"; const g2 = grant(w, d, 2);
  w.clock.now = "2026-09-28T14:00:00.000Z"; w.r.comment({ draft: d.draftId, viewer: V("ivy"), text: "later" });
  lc = w.r.copy({ secretSha: SECRET(2), bySecret: true }).last_change;
  assert.deepEqual([lc.at, lc.by, lc.kind], ["2026-09-28T14:00:00.000Z", "ivy", "comment"]);
  assert.ok(g2.ok);
  /* equal instants keep the first candidate in the answer's order (edit, comment, grant, acknowledgement) */
  const w2 = standard();
  w2.clock.now = "2026-09-28T09:00:00.000Z";
  const e = draft(w2, {}, "ed"); grant(w2, e, 1); w2.r.comment({ draft: e.draftId, viewer: V("ann"), text: "x" });
  lc = w2.r.copy({ draft: e.draftId, viewer: V("ann") }).last_change;
  assert.deepEqual([lc.kind, lc.by, lc.undetermined_within], ["edit", "ed", []], "two millisecond stamps in one second are ordered");
  /* both to the second: said */
  w2.st.sql.exec(`UPDATE case_drafts SET updated_at='2026-09-28T09:00:00Z'`);
  w2.st.sql.exec(`UPDATE review_comments SET at='2026-09-28T09:00:00Z'`);
  lc = w2.r.copy({ draft: e.draftId, viewer: V("ann") }).last_change;
  assert.match(lc.stated, /both were recorded to the second/);
  /* nothing dated at all */
  w2.st.sql.exec(`UPDATE case_drafts SET updated_at='never'`);
  w2.st.sql.exec(`DELETE FROM review_comments`); w2.st.sql.exec(`UPDATE review_grants SET issued_at=''`);
  lc = w2.r.copy({ draft: e.draftId, viewer: V("ann") }).last_change;
  assert.deepEqual([lc.at, lc.by, lc.kind], [null, null, null]);
  assert.match(lc.stated, /^UNDETERMINED: these bytes carry no dated act at all\./);
});

test("R18: a comment through R10's doors, text trimmed of 1 to 4,000 characters, attributed to the grant or the member", () => {
  const w = standard();
  const d = draft(w);
  const g = grant(w, d, 1);
  for (const text of ["", "   ", null, "x".repeat(REVIEW_TEXT_MAX + 1)]) {
    const r = w.r.comment({ draft: d.draftId, viewer: V("ivy"), text });
    assert.deepEqual([r.ok, r.code, r.check, r.translation], [false, "REVIEW_NO_COMMENT_TEXT", "C-87.11",
      REVIEW_COPY_CHECKS.REVIEW_NO_COMMENT_TEXT.translation]);
  }
  assert.equal(w.count("review_comments"), 0);
  /* the doors are asked first: an outsider with no text is the dead answer, not the text refusal */
  for (const r of [w.r.comment({ draft: d.draftId, viewer: V("out"), text: "" }),
                   w.r.comment({ draft: d.draftId, viewer: "class:admin", text: "x" }),
                   w.r.comment({ draft: d.draftId, secretSha: SECRET(9), bySecret: true, text: "x" }),
                   w.r.comment({ draft: "DRAFT-2026-0000", secretSha: SECRET(1), bySecret: true, text: "x" }),
                   w.r.comment({ draft: "DRAFT-2026-9999", viewer: V("ann"), text: "x" })])
    assert.equal(JSON.stringify(r), DEAD);
  const m = w.r.comment({ draft: d.draftId, viewer: V("ivy"), text: `  ${"y".repeat(REVIEW_TEXT_MAX)}  ` });
  assert.deepEqual(m, { ok: true, comment: { comment_id: 1, draft_id: d.draftId, author_kind: "member", author: "ivy",
                                             grant_id: null, text: "y".repeat(REVIEW_TEXT_MAX), at: NOW } });
  const rc = w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "from outside" });
  assert.deepEqual(rc.comment, { comment_id: 2, draft_id: d.draftId, author_kind: "recipient", author: g.grantId,
                                 grant_id: g.grantId, text: "from outside", at: NOW });
  const listed = w.r.copy({ draft: d.draftId, viewer: V("ann") }).comments;
  assert.deepEqual(listed.map((c) => [c.author_kind, c.author, c.recipient]), [["member", "ivy", null], ["recipient", g.grantId, "R1"]]);
  /* a revoked grant comments no more */
  w.r.act({ act: "revoke", author: "ann", grant: g.grantId });
  assert.equal(JSON.stringify(w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "x" })), DEAD);
});

test("R17: on the module's own clock every act it dates is stamped to the millisecond, so its own acts are ranked by instant and never tied within a second", () => {
  const MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const inWindow = (at, from, to) => MS.test(at) && Date.parse(at) >= from && Date.parse(at) <= to;
  /* no clock handed in: the module's default */
  const w = standard({ injectClock: false });
  const from = Date.now();
  const d = draft(w, {}, "ed");
  const e = w.r.act({ act: "draft", author: "ann", draft: d.draftId, statement: "S2" });
  const g = grant(w, d, 1);
  const g2 = grant(w, d, 2);
  const rv = w.r.act({ act: "revoke", author: "bea", grant: g2.grantId });
  const m = w.r.comment({ draft: d.draftId, viewer: V("ivy"), text: "a member's note" });
  const rc = w.r.comment({ secretSha: SECRET(1), bySecret: true, text: "a recipient's note" });
  const to = Date.now();
  assert.ok([d, e, g, g2, rv, m, rc].every((r) => r.ok), "every act landed");
  /* what the answers say */
  for (const [what, at] of [["grant issuedAt", g.issuedAt], ["revokedAt", rv.revokedAt], ["member comment", m.comment.at],
                            ["recipient comment", rc.comment.at]])
    assert.ok(inWindow(at, from, to), `${what}: ${at}`);
  /* what the record holds */
  const dr = w.row(`SELECT created_at, updated_at FROM case_drafts WHERE draft_id=?`, d.draftId);
  const gr = w.rows(`SELECT issued_at, revoked_at FROM review_grants ORDER BY grant_id`);
  const cr = w.rows(`SELECT at FROM review_comments ORDER BY comment_id`);
  for (const at of [dr.created_at, dr.updated_at, ...gr.map((x) => x.issued_at), gr.find((x) => x.revoked_at).revoked_at,
                    ...cr.map((x) => x.at)])
    assert.ok(inWindow(at, from, to), String(at));
  assert.equal(gr.filter((x) => x.revoked_at).length, 1);
  /* what the copy serves, and the date it carries: every candidate ranked, none named undetermined within a second */
  const c = w.r.copy({ draft: d.draftId, viewer: V("ann") });
  for (const at of [c.updated_at, ...c.comments.map((x) => x.at), ...c.grants.flatMap((x) => [x.issued_at, x.revoked_at]).filter(Boolean)])
    assert.ok(inWindow(at, from, to), String(at));
  assert.deepEqual(c.last_change.undetermined_within, [], "the module's own acts are never tied");
  assert.ok(inWindow(c.last_change.at, from, to));
  assert.doesNotMatch(c.last_change.stated, /undetermined:/);
  /* a clock handed in that answers no usable instant falls back to the same millisecond stamp */
  const w2 = standard();
  for (const bad of [undefined, null, "", 0, 1790000000000]) {
    w2.clock.now = bad;
    const t0 = Date.now();
    const x = draft(w2);
    const at = w2.row(`SELECT created_at FROM case_drafts WHERE draft_id=?`, x.draftId).created_at;
    assert.ok(inWindow(at, t0, Date.now()), `${String(bad)} → ${at}`);
  }
});
