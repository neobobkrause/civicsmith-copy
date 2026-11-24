/* Projects (registry screen `projects`; screens-daily R10, R7, R20, R21, R23; DEC-201 (8), DEC-214 (3)). Every project the member sees, as
   `projectlist` answers it (project-roster R26, R28), each a reference opening `project` with its question count
   (`projectquestions`, paged), its stage on the ladder, its members (`cs.initials`), its activity over eight weeks
   (`cs.activity`) and its last change, `truncated` said; "Start a project", its title field opened on press (R23); and the imported cases (R20). Every function is self-contained
   (interface-shell R21 (1)). */
import { projectRows } from "./project-rows.mjs";
import { startProject } from "./start-project.mjs";
import { participation } from "./participation.mjs";

export const projects = Object.freeze({
  id: "projects",
  parts: { projectRows, startProject, participation },

  reads: function (view) {
    const list = function (key) { return function (v) { return !v || !Array.isArray(v[key]) || v[key].length === 0; }; };
    const caps = view.me && Array.isArray(view.me.capabilities) ? view.me.capabilities : [];
    const starts = !!view.me && (view.me.administer === true || caps.indexOf("create_projects") >= 0);
    const out = {
      projects: { op: "projectlist", empty: list("projects") },
      // R43: the themes the team has declared; R42: the findable projects and the member's own requests.
      themes: { op: "themeread", empty: list("themes") },
      directory: { op: "projectdirectory", empty: list("projects") },
      requests: { op: "projectrequests", empty: list("requests") },
    };
    // R42: whom to ask, for a member who may not start projects.
    if (view.me && view.me.member && !starts) out.members = { op: "memberlist", empty: list("members") };
    return out;
  },

  render: function (cs, view) {
    const me = view.me || {};
    const starts = me.administer === true || (Array.isArray(me.capabilities) && me.capabilities.indexOf("create_projects") >= 0);
    const ok = function (r) { return r && r.state === "ok" ? r.value : null; };
    // R23, R30: the definition once, under the heading; "Start a project" opens its form on press (the title, who can find it).
    // R42: a member who may not start projects is told whom to ask, in its place.
    const roster = ok(view.data.members) && Array.isArray(ok(view.data.members).members) ? ok(view.data.members).members : [];
    const admins = roster.filter(function (x) { return x && x.status === "active" && x.role === "admin"; }).map(function (x) {
      return x.handle ? cs.esc(String(x.handle)) : cs.w("member.founder.unnamed");
    }).join(", ");
    const start = starts ? view.parts.startProject().form(cs, "projects", "act.promote.label.projects", cs.act("promote", { label: "project.start.go", tone: "primary" }))
      : '<p class="mk-note">' + cs.w("screen.projects.nocreate", { admins: { html: admins } }) + "</p>";
    // R43, R66: the Themes section, under the list: each theme its name, a reference opening `theme`, nothing else on the row; and
    // "Every theme", the door to `theme`, drawn also when none is declared yet.
    const tv = ok(view.data.themes);
    const themeList = tv && Array.isArray(tv.themes) ? tv.themes : [];
    const themes = cs.sec("theme.section", (themeList.length ? '<p class="mk-small muted">' + cs.w("theme.never.evidence") + "</p>"
      + cs.sheet(themeList.map(function (t) { return cs.row("", cs.ref("theme", String(t.theme_id), String(t.name || t.theme_id), []), "", ""); }).join("")) : "")
      + '<p class="mk-acts"><a class="cs-ref" data-nav href="/app/theme">' + cs.w("theme.every") + "</a></p>", { help: "theme.across" });
    // R42: the findable projects (not the member's own), each with "Ask to join", and the request she has open with "Withdraw".
    const dv = ok(view.data.directory);
    const rv = ok(view.data.requests);
    const mineOpen = {};
    (rv && Array.isArray(rv.requests) ? rv.requests : []).forEach(function (r) { if (r && r.state === "open") mineOpen[String(r.project)] = r; });
    const findable = dv && Array.isArray(dv.projects) ? dv.projects.filter(function (p) { return p && p.id; }) : [];
    const findableHtml = findable.length ? cs.sec("projects.findable.head", cs.sheet(findable.map(function (p) {
      const id = String(p.id);
      const open = mineOpen[id] || (p.request && p.request.state === "open" ? { asked: p.request.asked } : null);
      return cs.row("", cs.ref("project", id, p.name || id, []) + '<span class="meta">'
        + (open ? cs.w("projects.request.asked", { date: { html: cs.date(String(open.asked || "")) } }) : cs.w("projects.findable.meta")) + "</span>"
        + '<span class="meta">' + (open ? cs.act("projectrequestwithdraw", { label: "act.projectrequestwithdraw.label.projects", data: { project: id } })
          : cs.act("projectrequest", { label: "act.projectrequest.label.projects", data: { project: id } })) + "</span>", "", "");
    }).join("")), { help: "projects.findable.says" }) : "";
    // R20 (DEC-228 (4)): the imported cases, a reference opening `imported`.
    const imported = '<p class="mk-acts"><a class="cs-ref" data-nav href="/app/imported">' + cs.w("screen.imported.name") + "</a></p>";
    const pr = view.data.projects;
    // R33 (DEC-245): with no project, its designed empty state, then the act. The first question is the project page's.
    if (pr && pr.state === "empty") {
      return cs.title(undefined, {}) + '<p class="cs-state" data-state="empty">' + cs.w("projects.empty.sub") + "</p>"
        + (starts ? '<p class="mk-note">' + cs.w("projects.empty.note") + "</p>" : "") + start + findableHtml + themes + imported;
    }
    // R29 (D25): a project the member is invited to is set apart, with "Join"; the rest are the member's own.
    const all = pr && pr.state === "ok" && pr.value && Array.isArray(pr.value.projects) ? pr.value.projects : [];
    const place = view.parts.participation(cs, view, all);
    // R63 (DEC-340, U366): the list is narrowed in the page, by the words in a project's name (case-folded, every word present)
    // and by `mine` (project-roster R38); nothing is sent and nothing in any project changes.
    const ui = view.ui || {};
    // The words typed are page memory like a choice (`choice:<id>`), handed over by the kit's typed-input hook, so the list narrows
    // as it is typed (DEC-359: a field of the kit, no act and no registry row).
    if (typeof ui["choice:projects-search"] !== "string") ui["choice:projects-search"] = "";
    const typed = ui["choice:projects-search"];
    const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
    const filter = ["in", "own"].indexOf(ui["choice:projects-filter"]) >= 0 ? ui["choice:projects-filter"] : "all";
    const narrowed = function (p) {
      if (!p) return false;
      const name = String(p.name || p.id || "").toLowerCase();
      if (!words.every(function (w) { return name.indexOf(w) >= 0; })) return false;
      const m = p.mine && typeof p.mine === "object" ? p.mine : {};
      return filter === "in" ? m.in === true : filter === "own" ? m.owner === true : true;
    };
    const finding = all.length
      ? '<div class="mk-acts" style="align-items:flex-end">' + cs.field("projects-search", "screen.projects.search.label", { value: typed, help: "screen.projects.search.help",
          typing: function (cs, view, value) { cs.set("choice:projects-search", String(value)); } })
        + cs.choice("projects-filter", "screen.projects.filter.label", [["all", "screen.projects.filter.all"], ["in", "screen.projects.filter.in"], ["own", "screen.projects.filter.own"]], { value: "all", acts: {} })
        + '<p class="mk-small muted">' + cs.w("screen.projects.filter.help") + "</p>"
        + "</div>" : "";
    const invitedList = all.filter(function (p) { return narrowed(p) && place[String(p.id)] === "invited"; });
    const rows = view.parts.projectRows(cs, view, "screen.projects", true);
    const rowsJoin = view.parts.projectRows(cs, view, "screen.projects", true, "act.projectjoin.label.projects", place);
    const invited = invitedList.length
      ? cs.sec("projects.invited.head", rowsJoin({ projects: invitedList }), { help: "projects.invited.says" }) : "";
    return cs.title(undefined, {}) + '<p class="mk-sub">' + cs.w("screen.projects.sub") + "</p>" + finding + invited
      + cs.state("projects", function (v) {
        const rest = (v.projects || []).filter(function (p) { return narrowed(p) && !(p && place[String(p.id)] === "invited"); });
        if (!rest.length && !invitedList.length) return '<p class="cs-state" data-state="empty">' + cs.w("projects.empty.sub") + "</p>";
        return rest.length || !invitedList.length ? rows(Object.assign({}, v, { projects: rest })) : "";
      }, { empty: "projects.empty.sub" }) + findableHtml + start + themes + imported;
  },

  acts: [
    {
      // "Start a project": as Home's (R1, R25, R30), its title the member's, opening `project` on success.
      op: "promote",
      label: "act.promote.label.projects",
      send: function (view, el, cs) {
        const made = view.parts.startProject().body(cs, view, "projects", "file.trigger.projects");
        return made.body ? { body: made.body } : { refuse: made.refuse || "screen.projects.title.needed" };
      },
      done: function (view, answer, cs) {
        const id = answer && (answer.bundleId || (answer.result && answer.result.bundleId));
        if (id) cs.go("project", id);
      },
    },
    // R29: "Join", a project the member is invited to; the list is read again, her place in it now joined.
    { op: "projectjoin", label: "act.projectjoin.label.projects", rereads: ["projects"],
      send: function (view, el) { return el.dataset.project ? { query: { projectId: el.dataset.project } } : null; } },
    // R42: ask to join a findable project, and withdraw the request.
    { op: "projectrequest", label: "act.projectrequest.label.projects", rereads: ["directory", "requests"],
      send: function (view, el) { return el.dataset.project ? { query: { projectId: el.dataset.project } } : null; } },
    { op: "projectrequestwithdraw", label: "act.projectrequestwithdraw.label.projects", rereads: ["directory", "requests"],
      send: function (view, el) { return el.dataset.project ? { query: { projectId: el.dataset.project } } : null; } },
    // R43: the themes are read by `themeread` (a read; drawn above), registered on Projects for the Themes section.
    { op: "themeread", label: "theme.section", rereads: ["themes"],
      send: function (view) { return { query: {} }; } },
  ],
});
