/* screens-action, provider notice membership:77 (`membership` R154, PR 77): each name moved to `member-roster` is a delegate of the same
   name and shape, and `membershipOps` answers `member-roster`'s ops beside its own. PR 77 changed tests and a mark, no code. This module
   reaches membership through one op, `projectjoin` (R3's join-first rule), and reads the member's place from `project-roster`'s
   `projectlist`; nothing here changes. This confirms it over the REAL `membership` and `project-roster` (`real.mjs`, `roster: true`). */
import test from "node:test";
import assert from "node:assert/strict";
import { text, press, button, last, ok, W } from "./page.mjs";
import { realWorld, realPlane, profilesOf, open, until, V } from "./real.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";

const NOT_JOINED = "refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited";

test("notice membership:77 R3: the op this module sends to membership, projectjoin, is one membershipOps answers; an invited member's Join on `start-send` lands through it and the screen then offers the steps; control: before the join no weighty act is offered", async () => {
  const x = realWorld();
  assert.equal(typeof membershipOps(x.w.membership, new URL("http://do/"), null, {}).projectjoin, "function", "membershipOps answers projectjoin");
  const inv = x.w.membership.projectInvite({ projectId: x.proj, handle: "h_quinn", by: "olive", viewer: V("olive") });
  assert.notEqual(inv && inv.ok, false, JSON.stringify(inv).slice(0, 300));
  const id = x.action({ kind: "records_request", risk_tier: 1, project: x.proj, legs: [], clock: [],
    counterparty: { state: "named", role: "Records Office", body: "Port Ellery", level: "city" }, laws: [{ level: "city", citation: "P.E.B.L. § 4" }] });
  const plane = realPlane(x, V("quinn"), { profiles: profilesOf("oakland-alameda"), peopledirectory: ok({ rows: [], truncated: false }),
    list: ok({ bundles: [{ bundle_id: x.proj, object_type: "project", title: "Parks" }], limit: 500, cursor: null, total: 1 }) }, { roster: true });
  const p = await open(`/app/start-send/${id}`, plane);
  assert.ok(text(p).includes(W(NOT_JOINED)), "told she has not joined");
  assert.ok(!button(p, "communicationprepare"), "control: no prepare before the join");
  await press(p, "projectjoin");
  assert.equal(last(p, "projectjoin").query.projectId, x.proj);
  await until(p, () => !button(p, "projectjoin") && button(p, "communicationprepare"), "the steps once joined");
  assert.equal(x.roster.projectList({ viewer: V("quinn") }).projects.find((r) => r.id === x.proj).participation, "joined", "the real roster holds the join");
});
