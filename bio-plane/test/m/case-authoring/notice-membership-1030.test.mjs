/* case-authoring: notice membership:1030 (land 6316509c05; membership F1, CR2-28, K5563). membership's
   `isAdministrator` now answers a `member:<id>` viewer spelling for the member it names, so the viewer an enrolled
   administrator acts under is an administrator to every reader. This module's owner fence (R2) has no administrator
   arm: an administrator who sees the project, now answered an administrator by her own viewer, is refused
   NOT_THE_PROJECT_OWNER exactly as an ordinary participant is, and one who sees it only at existence is answered
   membership's existence refusal; nothing is written. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";

test("notice membership:1030 (R2): an administrator answered one by her session's viewer (membership F1) gains no arm at the owner fence — unseen she is answered C-70.1's existence refusal, invited she is NOT_THE_PROJECT_OWNER like a participant, and nothing is written", () => {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  w.member("root", { role: "admin" });
  w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  w.join(P, "bo");
  /* the provider's new answer, at its interface: the viewer spelling names the administrator */
  assert.deepEqual([w.membership.isAdministrator(V("root")), w.membership.isAdministrator("root")], [true, true],
    "membership F1: the member:<id> viewer is answered for the member it names");
  const before = w.snapshot();
  const probe = (who) => w.publish(P, who, [Q], { statement: "" });
  assert.equal(probe("root").reason, "PROJECT_SEEN_NOT_A_PARTICIPANT", "unseen, the administrator sees only existence");
  assert.deepEqual(w.snapshot(), before, "the existence refusal writes nothing");
  w.join(P, "root", "invited");
  const invited = w.snapshot();
  const seen = probe("root");
  assert.deepEqual([seen.ok, seen.reason, seen.project], [false, "NOT_THE_PROJECT_OWNER", P],
    "R2: no administrator arm — an administrator who sees the project is no owner");
  assert.equal(seen.detail, probe("bo").detail, "the administrator is refused exactly as a participant who owns nothing");
  /* controls: an ordinary member is no administrator by either spelling, and the owner alone reaches the authored fields */
  assert.deepEqual([w.membership.isAdministrator(V("bo")), w.membership.isAdministrator("member:nobody")], [false, false]);
  assert.equal(probe("bo").reason, "NOT_THE_PROJECT_OWNER");
  assert.equal(probe("alice").reason, "NO_STATEMENT", "only the owner passes R2");
  assert.deepEqual(w.snapshot(), invited, "no refusal writes anything");
});
