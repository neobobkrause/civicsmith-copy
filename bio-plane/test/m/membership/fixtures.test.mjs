/* membership: the published fixtures (fixtures.mjs), each checked against membership's real answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { V } from "./fixture.mjs";
import { projectActRefusals } from "./fixtures.mjs";
import { PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS } from "../../../src/membership/index.mjs";

test("R55: projectActRefusals makes the real projectAuthority refusal for a non-participant, and passes an owner and a joined member", async () => {
  const f = await projectActRefusals();
  const p = f.project;
  const refusal = f.projectAuthority(p, V("dee"), "joined", "promote");
  assert.deepEqual([refusal.ok, refusal.reason, refusal.code, refusal.check, refusal.project, refusal.act, refusal.needs],
    [false, "PROJECT_ACT_NOT_A_PARTICIPANT", "PROJECT_ACT_NOT_A_PARTICIPANT",
     PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_A_PARTICIPANT.check, p, "promote", "joined"]);
  assert.equal(f.projectAuthority(p, V("ann"), "joined", "promote"), null, "the owner is a joined participant");
  assert.equal(f.projectAuthority(p, V("bob"), "joined", "promote"), null, "a joined member");
  assert.equal(f.projectAuthority(p, V("cy"), "joined", "promote").reason, "PROJECT_ACT_NOT_A_PARTICIPANT",
    "an invited member has view rights only");
  assert.equal(f.projectAuthority(p, V("second"), "joined", "promote").reason, "PROJECT_ACT_NOT_A_PARTICIPANT",
    "an administrator directs no project");
  assert.equal(f.projectAuthority(p, null, "joined", "promote"), null, "no identity is not asked");
});

test("R55: projectActRefusals sets the owner and the participants through membership's own acts, so their states are the real ones", async () => {
  const f = await projectActRefusals();
  const m = f.membership;
  assert.equal(m.isProjectOwner(f.project, f.owner), true);
  assert.equal(m.participation(f.project, "bob").state, "joined");
  assert.equal(m.participation(f.project, "cy").state, "invited");
  assert.equal(m.participation(f.project, "dee"), null);
});

test("R47: projectActRefusals makes the real visibilitySettingRefusal, refusing a spelling that is no setting and passing the two settings", async () => {
  const f = await projectActRefusals();
  const bad = f.visibilitySettingRefusal("public");
  assert.deepEqual([bad.ok, bad.reason, bad.code, bad.check],
    [false, "PROJECT_VISIBILITY_UNKNOWN_SETTING", "PROJECT_VISIBILITY_UNKNOWN_SETTING",
     PROJECT_VISIBILITY_CHECKS.PROJECT_VISIBILITY_UNKNOWN_SETTING.check]);
  assert.equal("project" in bad, false, "a creation names no project");
  assert.equal(f.visibilitySettingRefusal("discoverable"), null);
  assert.equal(f.visibilitySettingRefusal("hidden"), null);
});
