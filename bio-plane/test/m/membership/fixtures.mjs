/* membership's published fixtures (fix round 10): what a user module's test takes in place of membership's answers or
   membership itself. Each is made by membership's real code when the test runs, over `world()`, and is never stored. */
import { world, V } from "./fixture.mjs";

const must = (answer, what) => {
  if (!answer.ok) throw new Error(`${what}: refused: ${JSON.stringify(answer)}`);
  return answer;
};

/** R47, R55 (PROJECT_ACT_NOT_A_PARTICIPANT, PROJECT_VISIBILITY_UNKNOWN_SETTING): the real membership, with a project, its
 *  owner and its participants set through membership's own acts (a creation naming an owner, an invitation, a join), and
 *  the two refusals as it answers them. `ann` owns `PRJ-1`; `bob` is invited and has joined; `cy` is invited and has not
 *  joined; `dee` is neither; `second` is an administrator, who directs no project. `membership` is the whole real instance,
 *  for a user that needs more than the two answers. */
export async function projectActRefusals() {
  const w = world();
  const { m } = w;
  await w.group("ann", "bob", "cy", "dee");
  const project = w.project("PRJ-1", "Ward roads");
  must(m.projectCreated({ projectId: project, ownerId: "ann", visibility: "discoverable", by: "ann" }), "projectCreated");
  must(m.projectInvite({ projectId: project, handle: "bob", by: "ann" }), "invite bob");
  must(m.projectJoin({ projectId: project, by: "bob" }), "join bob");
  must(m.projectInvite({ projectId: project, handle: "cy", by: "ann" }), "invite cy");
  return {
    membership: m,
    project,
    owner: "ann",
    joined: ["bob"],
    invited: ["cy"],
    /** R55: membership's `projectAuthority(p, identity, need, act)`, as the real instance answers it. */
    projectAuthority: (p, identity, need, act) => m.projectAuthority(p, identity, need, act),
    /** R47: membership's `visibilitySettingRefusal(v)` at a creation, where there is no project yet. */
    visibilitySettingRefusal: (v) => m.visibilitySettingRefusal(v, null),
    /** Identities named the way a caller names them, for a test to pass in: `V("bob")` is `member:bob`. */
    identity: V,
  };
}
