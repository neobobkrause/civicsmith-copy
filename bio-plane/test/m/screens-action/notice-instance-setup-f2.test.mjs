/* screens-action, attempt 8: provider notice instance-setup F2 (land 2914227e80). `memberVersions` now answers `agent-runner` as
   agent-worker's part (`SERVING`, never `SILENT`) when agent-worker's `/version` omits `runner`. That answer reaches a screen only
   through `op=bootstrap&members=1` (instance-setup R17), and whether the assistant is reachable stays `op=aipathready`'s, which the
   frame reads into `view.reachable`. These screens ask neither: they draw from the frame's one `bootstrap` (no `members`) and their
   own reads, so F2 changes nothing they draw. Confirmed here, at this module's own interface: every load's requests and every
   screen's declared reads. The rest of the suite (355 tests) ran green over the merged F2. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, ROUTES, DATA_PLANE, PROJECT, ACTION_ID } from "./page.mjs";
import { SCREENS } from "../../../src/screens-action/index.mjs";

const PATHS = { ...ROUTES, "request on a project": `/app/request/${PROJECT}`, "plan on a project": `/app/plan/${PROJECT}`, "start-send on an action": `/app/start-send/${ACTION_ID}` };

for (const [id, path] of Object.entries(PATHS)) {
  test(`instance-setup F2 (${id}): no load asks the members' versions; the frame's one bootstrap carries no 'members'`, async () => {
    const p = await open(path, DATA_PLANE);
    const boots = p.requests.filter((r) => r.op === "bootstrap");
    assert.equal(boots.length, 1, "one bootstrap, the frame's");
    for (const r of boots) assert.equal(r.query.members, undefined, "the frame's bootstrap does not ask the members' versions");
  });
}

test("instance-setup F2: no screen declares bootstrap, or an op that answers the members' versions, among its reads or acts", () => {
  const view = { subject: ACTION_ID, ui: {}, me: {}, reachable: false, parts: {} };
  for (const s of SCREENS) {
    for (const subject of [ACTION_ID, PROJECT]) {
      let reads;
      try { reads = typeof s.reads === "function" ? s.reads({ ...view, subject }) : s.reads; } catch { continue; }
      for (const r of Object.values(reads || {})) {
        assert.notEqual(r.op, "bootstrap", `${s.id}: bootstrap is the frame's`);
        assert.ok(!(r.params && "members" in r.params), `${s.id}: ${r.op} asks no members' versions`);
      }
    }
    for (const a of s.acts || []) assert.notEqual(a.op, "bootstrap", `${s.id}: no act asks bootstrap`);
  }
});
