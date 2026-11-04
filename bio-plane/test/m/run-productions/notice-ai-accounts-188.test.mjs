/* run-productions: the provider notice ai-accounts:188 (PR 188, ai-accounts F2). PR 188 changed the door's member arms
   (aiownadd, aiorderset, aimineuse, aimycheckset, aipersonalchoose): a stamped `by` that already reads `member:<id>` is
   the owner as it stands, never `member:member:<id>`. This module uses none of those arms; it reads the material limits
   R24 keeps to, `aiKeepAwayState` (ai-accounts R21) and `projectsKeptAway` (its R22). The limits are set through the
   door's arms `aikeepaway` and `projectaikeepaway`, which PR 188 left as they were. Code confirmed unchanged: a limit
   set at the real door under the stamp the door gives (`member:<id>`) still keeps a document from a run's reading, and
   lifted it lets the reading go. Driven on the real ai-accounts through its own op arms (K4990). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { world, Q, PROJ, DOC, ALICE } from "./fixture.mjs";

const AK = "class:ai/k1";
const TEXT = ["The Board approved ordinance 12 on 3 March 2026, for $4,500.", "Minutes of the Clerk, page two."];
const OCR_B = [{ step: "pixels", extent: { kind: "pages", pages: [0, 1] } },
               { step: "ocr", engine: "tesseract", version: "5.3.4", cap: "B", confidence: { basis: "none" },
                 extent: { kind: "pages", pages: [0, 1] } }];

function setup() {
  const w = world();
  w.inquiry(Q);
  const cap = w.doc(DOC);
  w.ex.readings[cap] = { chain: OCR_B, pageCount: 2 };
  w.units(cap, TEXT);
  w.run("RUN-E", { mode: "extract", principal_plane: AK, mints: 10, pages: 20 });
  /* An active administrator (membership R64), who alone sets the group's limit (ai-accounts R20), and a project owner. */
  w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('keeper', 'the keeper', 'admin', 'active', 't', 't')`);
  w.project(PROJ, ["alice"]);
  w.st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, 'olive', 'joined', 1, 't', 't')`, PROJ);
  w.membership.reindexProjectSight(PROJ);
  /* the door's call: `by` the stamp a session's member arrives as (`member:<id>`, PR 188's premise) */
  const door = (op, by, body) => aiAccountsOps(w.aiAccounts, new URL(`https://plane/?op=${op}&by=${encodeURIComponent(by)}`), body)[op]();
  const read = () => w.p.readPages({ run: "RUN-E", bundleId: DOC, viewer: ALICE, caller: AK });
  return { w, door, read };
}

test("notice ai-accounts:188 (run-productions R24; ai-accounts R21): the group's 'no AI' limit on reading, set at the real door by a member:<id> stamp, keeps the document from the run's reading; lifted, the reading goes", () => {
  const { door, read } = setup();
  assert.equal(read().ok, true, "no limit set");
  const on = door("aikeepaway", "member:keeper", { on: true, uses: ["read"], reason: "records under seal" });
  assert.equal(on.ok, true, JSON.stringify(on).slice(0, 300));
  const r = read();
  assert.deepEqual([r.ok, r.code], [false, "AI_RUN_READ_NO_AI"], JSON.stringify(r).slice(0, 300));
  assert.equal(door("aikeepaway", "member:keeper", { on: false, reason: null }).ok, true);
  assert.equal(read().ok, true, "control: the limit lifted, the document reads");
});

test("notice ai-accounts:188 (run-productions R24; ai-accounts R22): a project's 'no AI' limit on reading, set at the real door by its owner's member:<id> stamp, keeps the project's document from the run's reading; outside the project it reads", () => {
  const { w, door, read } = setup();
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, PROJ, DOC); w.membership.reindexProjectSight(DOC);
  const on = door("projectaikeepaway", "member:olive", { project: PROJ, on: true, uses: ["read"], reason: "sealed records" });
  assert.equal(on.ok, true, JSON.stringify(on).slice(0, 300));
  const r = read();
  assert.deepEqual([r.ok, r.code], [false, "AI_RUN_READ_NO_AI"], JSON.stringify(r).slice(0, 300));
  w.st.sql.exec(`UPDATE bundles SET project=NULL WHERE bundle_id=?`, DOC); w.membership.reindexProjectSight(DOC);
  assert.equal(read().ok, true, "control: the same limit on a document outside the project refuses nothing");
});
