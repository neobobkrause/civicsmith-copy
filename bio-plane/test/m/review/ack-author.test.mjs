/* review R46 (T53; JOURNEYS R-98, owner half): a reader grant's acknowledgement keeps the reader's name (the grant's
   recipient) as its author, distinct from a member's. The acknowledgement is case-inputs' act (its R1), made here by its
   real code over the real publication, whose review provider this module fills (publication R23); the copy reads it back
   through case-inputs' one list (R15, its R2). Nothing of another module's answer is built by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, V, SECRET, NOW, P } from "./fixture.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { publishScheduleOf } from "../../../src/publish-schedule/index.mjs";
import { reviewOf } from "../../../src/review/index.mjs";
import { caseInputsOf } from "../../../src/case-inputs/index.mjs";

const READER = "Lee Outsider";

function world() {
  const st = storage();
  const host = { storage: st };
  for (const t of RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
    if (t.trim()) st.db.exec(t);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const publication = publicationOf(host, { record, membership, now: () => NOW });
  const publishSchedule = publishScheduleOf(host, { record, membership, publication, now: () => NOW });
  const strength = strengthOf(host, { record, membership, inquiry: {}, versions: {}, producingGroup: () => "grp" });
  const caseInputs = caseInputsOf(host, { record, membership, publication, publishSchedule });
  const r = reviewOf(host, { record, membership, strength, publication, caseInputs, now: () => NOW,
                             basisVersions: { testimonyReach: () => ({ self: [], via: [] }) },
                             caseAuthoring: { publishCase: () => ({ ok: true }), draftEditions: () => ({ prepared: null, published: null }) },
                             caseAccount: { registerReviewComments: () => ({ ok: true }) },
                             ratification: { registerApprovalReader: () => ({ ok: true }) } });
  for (const m of ["ann", "ed"])
    st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                 VALUES (?,?,?,?,?,?,?,?)`, m, `Cover ${m}`, `h_${m}`, "member", "active", '["contribute"]', NOW, NOW);
  st.sql.exec(`INSERT INTO bundles (bundle_id,object_type,group_id,title,current_state,created,last_updated,bundle_sha)
               VALUES (?,?,?,?,?,?,?,?)`, P, "project", "g", P, "forming", NOW, NOW, "sha-p");
  st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, owner_order, created, updated)
               VALUES (?,?,?,?,?,?,?)`, P, "ann", "joined", 1, 1, NOW, NOW);
  st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
               VALUES (?,?,?,?,?,?)`, P, "ed", "joined", 0, NOW, NOW);
  return { st, r, caseInputs, rows: (q, ...a) => st.sql.exec(q, ...a).toArray() };
}

test("R46: a reader grant's acknowledgement names the reader as its author; a member's names the member", () => {
  const w = world();
  const d = w.r.act({ act: "draft", author: "ed", project: P, statement: "the statement" });
  assert.equal(d.ok, true, JSON.stringify(d));
  const g = w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: READER, secretSha: SECRET(1) });
  assert.equal(g.ok, true, JSON.stringify(g));
  const byReader = w.caseInputs.acknowledgeStatement({ secretSha: SECRET(1), bySecret: true, draft: d.draftId, reason: "I read it." });
  const byMember = w.caseInputs.acknowledgeStatement({ viewer: V("ann"), draft: d.draftId, reason: "So did I." });
  assert.equal(byReader.ok, true, JSON.stringify(byReader));
  assert.equal(byMember.ok, true, JSON.stringify(byMember));
  /* the stored rows, as case-inputs keeps them */
  assert.deepEqual(w.rows(`SELECT acknowledger_kind AS kind, recipient FROM statement_acknowledgements ORDER BY ack_id`),
                   [{ kind: "recipient", recipient: READER }, { kind: "participant", recipient: null }]);
  /* the copy's list, at both doors: each acknowledgement's author is the reader's name or the member's id */
  for (const c of [w.r.copy({ draft: d.draftId, viewer: V("ann") }), w.r.copy({ secretSha: SECRET(1), bySecret: true })]) {
    assert.equal(c.ok, true);
    assert.deepEqual(c.statement_acknowledgements.acknowledgements.map((a) => [a.kind, a.author, a.author_kind]),
                     [["recipient", READER, "recipient"], ["participant", "ann", "member"]]);
  }
});

test("R46 control: a reader's author is never the grant id case-inputs keys the row by", () => {
  const w = world();
  const d = w.r.act({ act: "draft", author: "ed", project: P, statement: "the statement" });
  const g = w.r.act({ act: "grant", author: "ann", draft: d.draftId, recipient: READER, secretSha: SECRET(1) });
  w.caseInputs.acknowledgeStatement({ secretSha: SECRET(1), bySecret: true, draft: d.draftId, reason: "I read it." });
  const [a] = w.r.copy({ draft: d.draftId, viewer: V("ann") }).statement_acknowledgements.acknowledgements;
  assert.notEqual(a.author, g.grantId ?? g.grant?.grant_id);
  assert.equal(a.author, READER);
});
