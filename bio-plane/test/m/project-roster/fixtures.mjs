/* project-roster's published fixtures (fix round 10; R44; K4990, K4993, K4995, K5157): the answers this module's real code gives, made when a
 * test runs and never stored. `queue` (its answered list) and `screens-inquiry` (the requester's page) take the answer from here instead of
 * hand-building project-roster's answer. Each is checked by `fixtures.test.mjs`, which calls it and compares the real answer. */
import { world, V } from "./fixture.mjs";

/* D discoverable, owner ann; the members who ask are outside it. */
async function requestWorld(...askers) {
  const w = await world().group("ann", "bob", ...askers);
  w.project("PROJ-D", "Discoverable D");
  w.m.projectClaimOwner({ projectId: "PROJ-D", memberId: "ann" });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  return w;
}

/** `declinedRequest`: the real `request` of `projectDirectory`'s row for the requester whose request to join PROJ-D the owner declined with
 *  `comment` (null for no word): `{state: "declined", asked, closed, closed_comment}`, `asked` and `closed` instants. */
export async function declinedRequest({ comment = "We are full this season.", member = "cal" } = {}) {
  const w = await requestWorld(member);
  w.r.projectRequest({ projectId: "PROJ-D", comment: null, by: member, viewer: V(member) });
  w.r.projectRequestAnswer({ projectId: "PROJ-D", handle: member, answer: "decline", comment, by: "ann", viewer: V("ann") });
  return w.r.projectDirectory({ viewer: V(member) }).projects.find((p) => p.id === "PROJ-D").request;
}

/** `answeredRequests`: the real `projectRequestsAnswered` answer `{ok, answered, count, limit, truncated}` that owner ann reads after answering
 *  each of `answers` (`[requester, "grant" | "decline", word]`, in the order answered) on PROJ-D. `answered` is newest first, each
 *  `{projectId, name, requester: {member, handle}, answer: "granted" | "declined", comment, closed}`. */
export async function answeredRequests({ answers = [["cal", "decline", "Not yet."], ["dee", "grant", null]] } = {}) {
  const w = await requestWorld(...answers.map(([who]) => who));
  for (const [who] of answers) w.r.projectRequest({ projectId: "PROJ-D", comment: null, by: who, viewer: V(who) });
  for (const [who, how, comment] of answers)
    w.r.projectRequestAnswer({ projectId: "PROJ-D", handle: who, answer: how, comment, by: "ann", viewer: V("ann") });
  return w.r.projectRequestsAnswered({ by: "ann", viewer: V("ann") });
}

/** `answeredRequestsHidden`: the same read for a member who answered and has since been removed from the project (so it is below FULL for her):
 *  `{ok: true, answered: [], count: 0, ...}`, the real answer, a project she cannot see in full naming nothing. */
export async function answeredRequestsHidden() {
  const w = await requestWorld("cal");
  w.owned("PROJ-X", "ann", ["bob"]);
  w.m.projectVisibilitySet({ projectId: "PROJ-X", setting: "discoverable", by: "ann", viewer: V("ann") });
  w.r.projectOwnerAdd({ projectId: "PROJ-X", handle: "bob", by: "ann", viewer: V("ann") });
  w.r.projectRequest({ projectId: "PROJ-X", comment: null, by: "cal", viewer: V("cal") });
  w.r.projectRequestAnswer({ projectId: "PROJ-X", handle: "cal", answer: "decline", comment: null, by: "bob", viewer: V("bob") });
  for (const by of ["ann", "bob"]) w.r.projectOwnerRemove({ projectId: "PROJ-X", handle: "bob", by, reason: "stepping down", viewer: V(by) });
  w.m.projectRemove({ projectId: "PROJ-X", handle: "bob", by: "ann", viewer: V("ann") });
  return w.r.projectRequestsAnswered({ by: "bob", viewer: V("bob") });
}
