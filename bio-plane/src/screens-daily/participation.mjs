/* The member's own place in each project listed (screens-daily R29; D25; K3369), a screen part (interface-shell R21, K3002)
   handed to Home and Projects as `view.parts.participation`. `participation(cs, view, projects)` answers `{<id>: state}`: a
   project row that answers `participation` (project-roster's `projectlist`, N1118) is taken at its word; any other is read
   once through `projectparticipants` (project-roster R1: every participant's handle and state, to a participant), the
   member's own row there found by her member id or her handle, and the outcome kept in the screen's page memory (`view.ui.mine`), so a
   redraw reads none again. A state still being read, one that failed, and a project the member has no row in, answer no
   state: she is offered nothing on a guess; a row answering `participation: null` is no participant, and no read is made for it (C14). Self-contained: it refers only to its parameters. */

export function participation(cs, view, projects) {
  const ui = view.ui;
  if (!ui.mine || typeof ui.mine !== "object") ui.mine = {};
  // K5148: she is found by her member id, else by her handle when both sides have one; the founder has none, and an empty handle is nobody's.
  const meId = view.me && view.me.member ? String(view.me.member) : "";
  const me = view.me && view.me.handle ? String(view.me.handle) : "";
  const isMe = function (x) { return !!x && ((meId && x.member === meId) || (me && x.handle === me)); };
  const out = {};
  (Array.isArray(projects) ? projects : []).forEach(function (p) {
    if (!p || p.id === undefined || p.id === null) return;
    const id = String(p.id);
    if (typeof p.participation === "string") { out[id] = p.participation; return; }
    // C14: a row that states `participation` as `null` says the viewer is no participant (an administrator seeing a findable project): taken
    // at its word, no state and no read; only a row with no such field (an answer from before `project-roster` R34) is read.
    if (Object.hasOwn(p, "participation")) return;
    const known = ui.mine[id];
    if (known === undefined) {
      ui.mine[id] = { state: "loading" };
      const keep = function (r) {
        const next = Object.assign({}, ui.mine);
        next[id] = r;
        cs.set("mine", next);
      };
      cs.call("projectparticipants", { query: { projectId: id } }).then(function (a) {
        const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
        if (!v || v.ok === false || !Array.isArray(v.participants)) return keep({ state: "failed" });
        const row = v.participants.filter(isMe)[0];
        return keep({ state: "ok", value: row && typeof row.state === "string" ? row.state : "" });
      }, function () { keep({ state: "failed" }); });
    } else if (known.state === "ok" && known.value) out[id] = known.value;
  });
  return out;
}
