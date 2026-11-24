/* The group's projects as rows (screens-daily R8, R10; N972; DEC-201 (8)), drawn by Home's "What the group is working on"
   and by the Projects screen. A screen part (interface-shell R21, K3002): self-contained, handed to each screen as
   `view.parts.projectRows` and called from its `render`. Each row is the project as `projectlist` answers it (project-roster
   R26: `{id, name, stage}`), a reference opening `project`, with its question count and its stage on the ladder Forming,
   Investigating, Matured, Closed. A project's count (never drawn at zero, R21) is the row's own `question_count` (project-roster R42;
   fix round 3, C14), so no project is read one by one; a row answering `null` (seen only at existence) is told as not known, never
   as none. Each row opens with the project's icon and its stage boxes sit in the row's second column, so the boxes and the glance
   share one left edge under the name (C23). With `glance` (the Projects screen, R10; DEC-201 (8), DEC-214 (3)) each
   row also draws its owner (project-roster R27: `{member, handle}`, or `null` when its opener is no longer an active
   member), its members (`cs.initials(handles)`), its activity over eight weeks (`cs.activity(weeks, word)`, the word
   chosen here) and its last change, as `projectlist`
   answers them (project-roster R28: `members` `[{member, handle}]`, `activity` eight integers oldest first, `lastChange`
   an instant or null); a row answering none of them draws none. `w` is the screen's own word prefix (`screen.home`,
   `screen.projects`). */

export function projectRows(cs, view, w, glance, join, states) {
  const STAGES = ["forming", "investigating", "matured", "closed"];
  // C14 (P2.2; project-roster R42): the count is the roster row's own `question_count`, so no project is read one by one. A project the
  // viewer sees only at existence answers `null`: that is told as not known, never as zero; a count at zero is not drawn (R21).
  const countOf = function (p) {
    const n = p.question_count;
    if (typeof n !== "number" || !isFinite(n)) return "<span>" + cs.w("screen.matter.unknown") + "</span>";
    if (!n) return "";
    return "<span>" + (n === 1 ? cs.w(w + ".questions.one") : cs.w(w + ".questions.many", { n: String(n) })) + "</span>";
  };
  const ladder = function (state) {
    if (state === null || state === undefined || state === "") {
      return '<span class="cs-ladder" data-ladder="stage" style="grid-column:2/-1">' + cs.w("state.undetermined", { reason: cs.w(w + ".stage.none") }) + "</span>";
    }
    const at = STAGES.indexOf(String(state).toLowerCase());
    // C23: the boxes start in the row's second column, under the name, so they share one left edge whatever the name beside them.
    return '<div class="cs-ladder" data-ladder="stage" style="grid-column:2/-1;max-width:40rem" aria-label="' + cs.w(w + ".stage.means") + '">'
      + STAGES.map(function (s, i) {
        return '<span class="' + (at >= 0 && i <= at ? "on" : "") + '"' + (i === at ? ' aria-current="step"' : "") + ">"
          + cs.w(w + ".stage." + s) + "</span>";
      }).join("") + "</div>";
  };
  // R10: who owns it, who works on it, how busy it has been, when it last changed.
  const glanceOf = function (p) {
    if (!glance) return "";
    // An owner answered with no handle is drawn by its member id; `null` is an opener no longer active (R27).
    const unnamed = function (x) { return !!x && x.founder === true && !x.handle; };
    const plain = function (t) { return String(t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); };
    // R85: a member answered with no handle is named by the roster's handle (`cs.memberName`), else by its plain word; never by her member id.
    const unknown = function (n) { return cs.esc(n) === cs.w("shell.card.member"); };
    const handleOf = function (x) { return x && x.handle ? String(x.handle) : x && !unnamed(x) && x.member ? cs.memberName(x.member) : ""; };
    const who = p.owner ? handleOf(p.owner) : "";
    const owner = !("owner" in p) ? ""
      : '<span class="muted">' + (who ? cs.w(w + ".owner", { handle: "" }) + (unknown(who) ? cs.esc(who) : cs.ref("member", who, who, []))
        : unnamed(p.owner) ? cs.w(w + ".owner", { handle: "" }) + cs.w("member.founder.unnamed") : cs.w(w + ".owner.none")) + "</span>";
    const members = Array.isArray(p.members)
      ? p.members.map(function (m) { return unnamed(m) ? plain(cs.w("member.founder.unnamed")) : handleOf(m); }).filter(Boolean) : null;
    const activity = Array.isArray(p.activity) && p.activity.length === 8 ? p.activity.map(function (n) { return Number(n) || 0; }) : null;
    const last = "lastChange" in p
      ? '<span class="muted">' + (p.lastChange ? cs.w(w + ".lastchange", { date: cs.date(String(p.lastChange)) }) : cs.w(w + ".lastchange.none")) + "</span>"
      : "";
    // The word the bars say (the kit's `shell.glance.*`): busy when the last four weeks hold half as many acts again as the
    // four before, quiet when they hold under half as many (or none), steady otherwise.
    const said = function (v) {
      const older = v[0] + v[1] + v[2] + v[3];
      const newer = v[4] + v[5] + v[6] + v[7];
      if (newer === 0 || newer * 2 < older) return "shell.glance.quiet";
      return newer * 2 >= older * 3 ? "shell.glance.busy" : "shell.glance.steady";
    };
    return owner + (members ? cs.initials(members) : "") + (activity ? cs.activity(activity, said(activity)) : "") + last;
  };
  return function (list) {
    const projects = list && Array.isArray(list.projects) ? list.projects : [];
    return cs.sheet(projects.map(function (p) {
      const id = String(p.id);
      const joinAct = join && states && states[id] === "invited" ? cs.act("projectjoin", { label: join, data: { project: id } }) : "";
      // R72 (C84; project-roster R39): a stranded project, every owner gone, is marked; the row opens the project, where the rescue is.
      const rescue = p.rescue_open === true ? '<span class="meta">' + cs.w("project.rescue.title.nodate") + "</span>" : "";
      return cs.row(cs.icon("project"), cs.ref("project", id, p.name || id, []) + rescue + (function () { const c = countOf(p); return c ? '<span class="meta">' + c + "</span>" : ""; })()
        + (joinAct ? '<span class="meta">' + joinAct + "</span>" : ""), ladder(p.stage), glanceOf(p));
    }).join("")) + (list && list.truncated ? '<p class="mk-note">' + cs.w(w + ".truncated") + "</p>" : "");
  };
}
