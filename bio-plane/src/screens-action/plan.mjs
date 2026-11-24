/* The action plan (registry screen `plan`; screens-action R1, R7, R13; K608 (4); v0.2 rules 18, 19). Projects › <project> ›
   Action plan: the plan's matters (its subjects, each with its determination's support and its escalation's stage), its
   options (sorted and picked as rows, interface-shell R19), the standing offers and, while the assistant is reachable,
   the proposals labelled machine work "not yet in the plan" and "Ask the assistant for options" (a planning run, drawn
   running until it ends, R13), its scenarios and their checkpoints, what each started
   option became, and the checks. Every function here is self-contained (interface-shell R21 (1)): it refers only to its
   parameters, the kit `cs` and the language's own globals. The subject is the plan's id. It holds no member-facing English
   (R19): each sentence is a key read through the kit's `cs.w`, and the plan names its project and its questions by their
   titles, each a reference (R18). */

import { readOnly, WRITE_HELP, actName, citeOf } from "./send-steps.mjs";

export const plan = Object.freeze({
  id: "plan",

  // R8 (interface-shell): Projects › <project> › Action plan; the project's title from `list` (the plan read names
  // only the project's id).
  place: function (view) {
    const p = view.data.plan;
    const v = /^PROJ-/.test(String(view.subject || "")) ? { project: String(view.subject) } : p && p.state === "ok" ? p.value : null;
    if (!v || !v.project) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === v.project; });
    return { project: { id: v.project, title: (hit && hit.title) || v.project } };
  },

  reads: function (view) {
    // R25: a project as the subject reads its plans, not one plan
    if (/^PROJ-/.test(String(view.subject || ""))) return {
      plans: { op: "plans", query: { project: view.subject, limit: "200" }, subject: true, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
    };
    const r = {
      plan: { op: "plan", query: { id: view.subject }, subject: true },
      projects: { op: "list", query: { type: "project", limit: "500" } },
    };
    // R1: the assistant's suggestions are read only while it is reachable for this member.
    if (view.reachable) r.proposals = {
      op: "planproposals", query: { plan: view.subject },
      empty: function (v) { return !v || !Array.isArray(v.proposals) || v.proposals.length === 0; },
    };
    return r;
  },

  parts: {
    readOnly: readOnly, actName: actName, citeOf: citeOf,
    // R25: a project's plans: its one live plan opens at once, several or only closed ones are listed (live ones first, newest
    // first, then the closed), none says where one is started. A plan the viewer may not see is not listed.
    projectPlans: function (cs, view) {
      const P = view.parts;
      const projects = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
        ? view.data.projects.value.bundles : [];
      const hit = projects.find(function (b) { return b.bundle_id === view.subject; });
      const ro = P.readOnly(cs, "screen.plan.name");
      return cs.state("plans", function (v) {
        const rows = Array.isArray(v.items) ? v.items : [];
        const byNewest = function (x, y) { return String(y.opened_at || "") < String(x.opened_at || "") ? -1 : String(y.opened_at || "") > String(x.opened_at || "") ? 1 : 0; };
        const live = rows.filter(function (x) { return x.state === "open" || x.state === "paused"; }).sort(byNewest);
        const closed = rows.filter(function (x) { return !(x.state === "open" || x.state === "paused"); }).sort(byNewest);
        const title = cs.title(cs.w("screen.plan.list.title")) + (hit && hit.title ? '<p class="mk-sub">' + cs.esc(hit.title) + "</p>" : "");
        if (!rows.length) return ro + title + '<p class="mk-note">' + cs.w("screen.plan.none") + "</p>";
        if (live.length === 1) {
          // the one live plan opens at once; coming back from it lists the plans instead of opening it again
          const k = "plan-went:" + view.subject;
          if (cs.now() - (Number(cs.kept(k)) || 0) > 30000) {
            cs.keep(k, String(cs.now()));
            cs.later(0, function (kit) { kit.go("plan", live[0].id); });
            return '<p class="cs-state" data-state="loading" role="status"><span class="bar" aria-hidden="true"></span>' + cs.w("state.loading") + "</p>";
          }
        }
        const who = function (by) { return cs.esc(cs.memberName(String(by || "").replace(/^member:/, ""))); };
        return ro + title + (v.truncated ? '<p class="mk-note">' + cs.w("screen.plan.list.more") + "</p>" : "") + cs.sec("screen.plan.list", cs.sheet(live.concat(closed).map(function (x) {
          const st = ["open", "paused", "closed"].includes(x.state) ? x.state : "closed";
          return cs.row("", '<a class="cs-ref" href="/app/plan/' + encodeURIComponent(x.id) + '" data-nav>' + cs.esc(x.title || x.id) + "</a>"
            + '<span class="meta">' + cs.w("screen.plan.state." + st) + (x.opened_at && x.opened_by ? " · " + cs.w("screen.plan.opened", { date: { html: cs.date(x.opened_at) }, name: { html: who(x.opened_by) } }) : "") + "</span>", "", "");
        }).join("")), { help: "screen.plan.list.help" });
      });
    },
    // R18: a matter's own line, named by its title as the record answers it (never an `INQ-…` reference), each a reference
    // the kit links; a determination links its screen.
    matterName: function (cs, s, titles) {
      const sub = s && s.subject ? s.subject : {};
      if (sub.kind === "outcome" && sub.determination)
        return '<a class="cs-ref" href="/app/matter/' + encodeURIComponent(sub.determination + (s.escalation && s.escalation.id ? "~" + s.escalation.id : "")) + '" data-nav>'
          + cs.esc(titles.determination(sub.determination)) + "</a>" + (sub.standard && titles.standard(sub.standard) ? " · " + cs.esc(titles.standard(sub.standard)) : "");
      const t = sub.inquiry ? titles.question(sub.inquiry) : "";
      return t ? cs.ref("question", sub.inquiry, t, [t]) : "";
    },
    // R18: the titles the record answers, by the reference a plan holds: a question's from `projectquestions`, a
    // determination's act from `determinations`; "" where it is not (yet) answered, never the reference itself.
    titlesOf: function (cs, P, qs, ds, ss) {
      const qm = new Map(qs.items.map(function (q) { return [q.inquiry, typeof q.title === "string" ? q.title : ""]; }));
      // fix round 10 (diagnosis 11 §7a): a determination is named by its act (day and office), a standard by its citation, never by id
      const dm = new Map(ds.items.map(function (d) { return [d.id, P.actName(cs, d)]; }));
      const cite = function (id) { return P.citeOf(ss, id); };
      const ofKey = function (k) {
        const m = /^(inquiry|outcome):([^#]+)(?:#(.*))?$/.exec(String(k));
        if (!m) return "";
        if (m[1] === "inquiry") return qm.get(m[2]) || "";
        const t = dm.get(m[2]) || "";
        const c = m[3] ? cite(m[3]) : "";
        return [t, c].filter(Boolean).join(" · ");
      };
      return { question: function (id) { return qm.get(id) || ""; }, determination: function (id) { return dm.get(id) || ""; }, standard: cite, ofKey: ofKey,
        questions: qs, determinations: ds };
    },
    // R18: a list the record answers (`projectquestions`, `determinations`), read page after page by its cursor (at most
    // five), each page once and kept in the page's memory.
    paged: function (cs, view, key, op, query) {
      const items = [];
      let after = null, state = "ok";
      for (let n = 0; n < 5; n++) {
        const st = view.parts.later(cs, view, key + ":" + n, op, after ? Object.assign({}, query, { after: after }) : query, "");
        if (st.state !== "ok") { state = st.state; break; }
        items.push.apply(items, Array.isArray(st.value.items) ? st.value.items : []);
        after = st.value.cursor;
        if (!after) break;
      }
      return { items: items, state: state };
    },
    // R18 (D29): an answer that is `ok` yet carries a refusal (`started: false` with no run already asked,
    // `dispatched: false` or `withheld`) is that refusal; drawn by its words where the code has them, else by the words
    // the answer carries, else "could not be read".
    refused: function (a) {
      return !!a && (a.ok === false || (a.started === false && a.existed !== true) || a.dispatched === false || !!a.withheld);
    },
    refusalWords: function (cs, a) {
      const code = String(a.code || (typeof a.withheld === "string" ? a.withheld : "") || "");
      const key = "refusal." + code;
      if (code && cs.w(key) !== cs.esc(key)) return cs.w(key);
      return typeof a.translation === "string" && a.translation ? cs.esc(a.translation) : cs.w("shell.unread");
    },
    // C53: the reminders the plan read holds for a chosen option, `{date, on}` each, as the record answers them
    heldReminders: function (o) {
      return o && o.disposition === "chosen" && Array.isArray(o.reminders) ? o.reminders.filter(function (r) { return r && r.on; }) : [];
    },
    // C53: an option's regulated dates
    datesOf: function (o) {
      return (Array.isArray(o && o.dates) ? o.dates : []).map(function (d) { return d && d.date ? String(d.date) : ""; }).filter(Boolean);
    },
    // The option's regulated end: the latest of its dates (the order R1 sorts on), or none.
    endOf: function (o) {
      const ds = Array.isArray(o.dates) ? o.dates.map(function (d) { return String(d && d.date || ""); }).filter(Boolean).sort() : [];
      return ds.length ? ds[ds.length - 1] : "";
    },
    // R13: a read the page makes itself, once per query and token, kept in the page's memory (as `screens-inquiry` R8's dock).
    later: function (cs, view, key, op, query, token) {
      const L = view.ui.later || (view.ui.later = {});
      const q = JSON.stringify(query) + "#" + (token || "");
      if (!L[key] || L[key].q !== q) {
        L[key] = { q: q, state: "loading" };
        const settle = function (o) { L[key] = Object.assign({ q: q }, o); cs.set("later", L); };
        cs.call(op, { query: query }).then(function (a) {
          const r = a && a.result !== undefined ? a.result : a;
          if (!r || r.ok === false) {
            const code = String((r && (r.code || r.reason)) || "");
            settle({ state: "failed", refusal: { code: code, words: cs.esc((r && r.translation) || code) } });
          } else settle({ state: "ok", value: r });
        }, function () { settle({ state: "failed", refusal: null }); });
      }
      return L[key];
    },
    // C63: a check drawn by the key of its sentence, with the option or phase it names called by its place in the list; "" where the
    // check's data does not carry what its sentence needs (the plan's own sentence is drawn)
    checkSays: function (cs, P, c, options, scenarios) {
      const at = options.findIndex(function (x) { return x.id === c.option; });
      const opt = at >= 0 ? P.optName(cs, options[at], at) : "";
      const sc = (Array.isArray(scenarios) ? scenarios : []).find(function (x) { return String(x.scenario) === String(c.scenario); });
      const phs = sc && Array.isArray(sc.phases) ? sc.phases : [];
      const pi = phs.findIndex(function (x) { return x.id === c.phase; });
      const ph = pi >= 0 ? P.phName(cs, phs[pi], pi) : "";
      // R56 (walk E K-words): a check that cannot be told for want of a day is worded by its key with the option and phase named, the reason
      // the design's own (`action-plans.time_zone_held_place`), never the plane's English with its ids
      if (c.state === "undetermined") {
        const why = { html: cs.w("action-plans.time_zone_held_place") };
        if (c.check === "date_past" && opt) return cs.w("action-plans.says.whether_regulated_date", { id: { html: opt }, date: { html: cs.date(c.date) }, day_undetermined: why });
        if (c.check === "date_before_phase" && opt && ph) return cs.w("action-plans.says.whether_regulated_date_falls", { oid: { html: opt }, id: { html: ph }, date: { html: cs.date(c.date) }, day_undetermined: why });
        return "";
      }
      // R56: a regulated date that falls before its phase can start: the key when the check carries the day the phase starts; else the plane's own
      // sentence, which states it, with the option and the phase called by name where it wrote their ids
      if (c.check === "date_before_phase" && opt && ph) {
        if (typeof c.start === "string" && c.start) return cs.w("action-plans.says.regulated_date_falls", { oid: { html: opt }, id: { html: ph }, date: { html: cs.date(c.date) }, start: { html: cs.date(c.start) } });
        if (typeof c.says !== "string" || !c.says) return "";
        const esc = function (id) { return String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
        const names = {}; names[String(c.option)] = opt; names[String(c.phase)] = ph;
        const re = new RegExp("(^|[^\\w-])(" + Object.keys(names).map(esc).join("|") + ")(?![\\w-])|\\b(\\d{4}-\\d{2}-\\d{2})\\b", "g");
        return cs.esc(c.says).replace(re, function (m, pre, id, day) { return day ? cs.date(day) : pre + names[id]; });
      }
      if (c.check === "date_past" && opt) {
        const d = (Array.isArray(options[at].dates) ? options[at].dates : []).find(function (x) { return x && x.date === c.date; });
        return d && typeof d.basis === "string" ? cs.w("action-plans.says.regulated_date_passed", { id: { html: opt }, date: { html: cs.date(c.date) }, basis: d.basis }) : "";
      }
      if (c.check === "subjects_not_live" && opt) return cs.w("action-plans.says.matter_serves_longer", { id: { html: opt } });
      if (c.check === "outward_on_hypothesis" && opt) return cs.w("action-plans.says.addresses_someone_outside", { id: { html: opt } });
      if (c.check === "enforces_superseded" && opt) return cs.w("action-plans.says.requirement_seeks_enforced", { id: { html: opt } });
      if (c.check === "no_hostile_branch" && ph) return cs.w("action-plans.says.phase_addresses_someone", { id: { html: ph } });
      return "";
    },
    // R53: an option with no summary is named by its place in the list, a phase with no name by its place in its scenario;
    // never by an id.
    optName: function (cs, o, i) {
      return o && typeof o.summary === "string" && o.summary ? cs.esc(o.summary) : cs.w("screen.plan.option.unnamed", { n: String(i + 1) });
    },
    phName: function (cs, ph, i) {
      return ph && typeof ph.name === "string" && ph.name ? cs.esc(ph.name) : cs.w("screen.plan.phase.unnamed", { n: String(i + 1) });
    },
    // R44: the second and later phases of a scenario's form carry their own ids, the first keeps the plain ones.
    sfx: function (k) { return k ? "-p" + (k + 1) : ""; },
    // R44: one phase of the scenario form: its name, options, start, check-back days, test and where each judgement goes.
    phaseForm: function (cs, view, k, count, items) {
      const sf = view.parts.sfx(k);
      const others = [];
      for (let j = 0; j < count; j++) if (j !== k) others.push({ value: "p" + (j + 1), key: "screen.plan.phase.unnamed", fills: { n: String(j + 1) } });
      const leads = [{ value: "", key: "screen.plan.phase.none" }].concat(others);
      const after = [["", "screen.plan.none.this.one.starts.first"]].concat(others);
      return cs.sec("screen.plan.phase.head", (count > 1 ? "<h3>" + cs.w("screen.plan.phase.unnamed", { n: String(k + 1) }) + "</h3>" : "")
        + cs.field("plan-scen-pname" + sf, "screen.plan.name.of.the.phase")
        + cs.checks("plan-scen-options" + sf, "screen.plan.phase.options", items)
        + cs.choice("plan-scen-start" + sf, "screen.plan.phase.when", [["plan_start", "screen.plan.at.the.start.of.the.plan"],
          ["after", "screen.plan.phase.when.after"], ["met", "screen.plan.when.another.phase.s.checkpoint.is"],
          ["not_met", "screen.plan.when.another.phase.s.checkpoint.is.2"]], { value: "plan_start" })
        + '<p class="mk-small">' + cs.w("screen.plan.each.phase.starts.after.something.else") + " " + cs.w("screen.plan.no.phase.can.start.after.itself") + "</p>"
        + cs.choice("plan-scen-after" + sf, "screen.plan.phase.which", after, { value: "" })
        + cs.field("plan-scen-days" + sf, "screen.plan.check.back.after.days", { type: "number", help: "screen.plan.the.checkpoint.then.waits.for.a" })
        + cs.field("plan-scen-cond" + sf, "screen.plan.what.the.checkpoint.tests", { help: "screen.plan.in.words.up.to.500.characters" })
        + cs.choice("plan-scen-met" + sf, "screen.plan.if.the.checkpoint.is.met.go", leads, { value: "" })
        + cs.choice("plan-scen-not" + sf, "screen.plan.if.it.is.not.met.go", leads, { value: "" }));
    },
    subjectKeys: function (o) {
      return (Array.isArray(o.subjects) ? o.subjects : []).map(function (x) {
        return typeof x === "string" ? x : x && x.kind === "outcome" ? "outcome:" + x.determination + "#" + x.standard : x && x.inquiry ? "inquiry:" + x.inquiry : "";
      }).filter(Boolean);
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    if (/^PROJ-/.test(String(view.subject || ""))) return P.projectPlans(cs, view);
    const CATS = ["mitigation", "legal", "awareness", "journalistic", "grassroots", "other"];
    return cs.state("plan", function (p) {
      const open = p.state !== "closed";
      const subjects = Array.isArray(p.subjects) ? p.subjects : [];
      const options = Array.isArray(p.options) ? p.options : [];
      // R18: the plan's project and its questions, named by their titles as the record answers them, each a reference.
      const lists = p.project ? { questions: P.paged(cs, view, "questions", "projectquestions", { project: p.project, limit: "100" }),
        determinations: P.paged(cs, view, "determinations", "determinations", { project: p.project, live: "true", limit: "100" }) } : null;
      const stdList = p.project ? P.later(cs, view, "standards", "standards", { limit: "200" }, "") : null;
      const stds = stdList && stdList.state === "ok" && stdList.value && Array.isArray(stdList.value.items) ? stdList.value.items : [];
      const titles = P.titlesOf(cs, P, lists ? lists.questions : { items: [] }, lists ? lists.determinations : { items: [] }, stds);
      const projects = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
        ? view.data.projects.value.bundles : [];
      const projectHit = projects.find(function (b) { return b.bundle_id === p.project; });
      // R53: an option is named by its summary, else by its place in the list; never by its id
      const byName = new Map(options.map(function (o, i) { return [o.id, P.optName(cs, o, i)]; }));
      const projectRef = projectHit && projectHit.title ? cs.ref("project", p.project, projectHit.title, [projectHit.title]) : "";
      // the plan's opening: when and by whom
      const opened = p.opened_at && p.opened_by
        ? cs.w("screen.plan.opened", { date: { html: cs.date(p.opened_at) }, name: cs.memberName(String(p.opened_by).replace(/^member:/, "")) }) : "";
      const head = P.readOnly(cs, "screen.plan.name") + cs.title(p.title || p.id)
        + '<p class="mk-sub">' + cs.w("screen.plan.state." + (["open", "paused", "closed"].includes(p.state) ? p.state : "open"))
        + (opened ? " · " + opened : "") + (projectRef ? " · " + projectRef : "") + "</p>"
        + (p.closed ? '<p class="mk-sub">' + cs.w("screen.plan.closedwhy", { reason: p.closed.reason || "" }) + "</p>" : "");

      // R1: the checks strip states each check (its own sentence, as the plan read answers it).
      const checks = Array.isArray(p.checks) ? p.checks : [];
      const strip = checks.length
        ? '<div class="mk-checks2" role="region" aria-label="' + cs.w("screen.plan.checks", { n: String(checks.length) }) + '"><b>'
          + cs.w("screen.plan.checks", { n: String(checks.length) }) + "</b>"
          + checks.map(function (c) {
            // R53: a phase whose judgement leads nowhere says which judgement in words ("met", "not met"), never the raw value
            if (c.check === "unbranched" && Array.isArray(c.outcomes) && c.outcomes.length) {
              const sc = (Array.isArray(p.scenarios) ? p.scenarios : []).find(function (x) { return String(x.scenario) === String(c.scenario); });
              const phs = sc && Array.isArray(sc.phases) ? sc.phases : [];
              const at = phs.findIndex(function (x) { return x.id === c.phase; });
              const nm = at >= 0 ? P.phName(cs, phs[at], at) : cs.w("screen.plan.phase.unnamed", { n: String(Number(String(c.phase).replace(/\D/g, "")) || 1) });
              return c.outcomes.map(function (m) {
                return "<p>" + cs.w("action-plans.says.phase_checkpoint_leads", { id: { html: nm }, miss: cs.w("screen.plan.judged." + (m === "met" ? "met" : "not_met")) }) + "</p>";
              }).join("");
            }
            // C63: the other checks name an option or a phase by its place in the list, never by its id ("opt-1", "p1")
            const said = P.checkSays(cs, P, c, options, p.scenarios);
            return "<p>" + (said || cs.esc(c.says || c.check || "")) + "</p>";
          }).join("") + "</div>"
        : "";

      // R18: a reference is picked from the lists the record answers (the project's questions, the project's determinations
      // with their standards), never typed; what the plan already holds is not offered again.
      const held = new Set(subjects.map(function (s) { return s.key; }));
      const pickable = lists ? lists.questions.items.map(function (q, i) {
        return { value: "inquiry:" + q.inquiry, text: typeof q.title === "string" && q.title ? q.title : null, n: i + 1 };
      }).concat(lists.determinations.items.flatMap(function (d) {
        return (Array.isArray(d.outcomes) ? d.outcomes : []).map(function (o) {
          const named = [P.actName(cs, d), P.citeOf(stds, o.standard)].filter(Boolean).join(" \u00b7 ");
          return { value: "outcome:" + d.id + "#" + o.standard, text: named || null, n: 0 };
        });
      })).filter(function (o) { return !held.has(o.value); }) : [];
      const choices = pickable.map(function (o) {
        return o.text ? { value: o.value, text: o.text } : { value: o.value, key: "screen.plan.matter.n", fills: { n: String(o.n) } };
      });
      const listsState = lists ? ["questions", "determinations"].map(function (k) { return lists[k].state; }) : ["ok"];
      const addMatter = choices.length
        ? cs.choice("plan-subject-id", "screen.plan.subject.id", choices)
          + cs.field("plan-subject-reason", "screen.plan.subject.reason", { help: "screen.plan.subject.reason.help" })
          + '<div class="mk-acts">' + cs.act("plansubjectadd", { label: "act.plansubjectadd.label.plan" }) + "</div>"
        : listsState.includes("failed") ? cs.state({ state: "failed" }) : "";

      // R1, R7: the plan's subjects, called matters.
      const mattersIn =(subjects.length ? cs.sheet(subjects.map(function (s, i) {
        const esc = s.escalation && s.escalation.id
          ? cs.w("screen.plan.escalation", { stage: { html: cs.w("screen.matter.stage." + (Number(s.escalation.stage) >= 1 && Number(s.escalation.stage) <= 7 ? Number(s.escalation.stage) : 1)) } })
          : s.escalation && s.escalation.state === "undetermined" ? cs.w("screen.plan.escalation.undetermined") : "";
        const live = s.liveness && s.liveness.state && s.liveness.state !== "live" ? " · " + cs.w("screen.plan.liveness." + (s.liveness.state === "superseded" ? "superseded" : "closed")) : "";
        const took = view.ui.took || {};
        const take = s.escalation && s.escalation.id && took["escalation_stage:" + s.escalation.id] ? cs.w("screen.plan.tookup")
          : s.escalation && s.escalation.id && s.escalation.state === "open"
          ? cs.act("itemtakeup", { label: "screen.plan.takeup", data: { kind: "escalation_stage", escalation: s.escalation.id, stage: String(s.escalation.stage || "") } }) : "";
        return cs.row("<b>" + cs.w("screen.plan.matter.n", { n: String(i + 1) }) + "</b>", P.matterName(cs, s, titles)
          + '<span class="meta">' + cs.w("screen.plan.support." + (["hypothetical", "established", "short"].includes(s.support) ? s.support : "undetermined"))
          + (s.why ? " · " + cs.esc(s.why) : "") + live + (esc ? " · " + esc : "") + "</span>", take, "");
      }).join("")) : "")
        + (open ? addMatter : "");
      const matters = mattersIn ? cs.sec("screen.plan.matters", mattersIn) : "";

      // R1: the options, sorted by category, regulated end date, matter or disposition, picked as rows.
      const optionRows = cs.rows({
        id: "options", pick: open, items: options,
        cols: ["screen.plan.col.option", "screen.plan.col.category", "screen.plan.col.ends", "screen.plan.col.matter", "screen.plan.col.disposition"],
        key: function (o) { return o.id; },
        name: function (o) { return byName.get(o.id); },
        sortKey: function (o, col) {
          return col === 1 ? String(CATS.indexOf(o.category)) : col === 2 ? (P.endOf(o) || "9999") : col === 3 ? P.subjectKeys(o).map(titles.ofKey).join(" ")
            : col === 4 ? String(o.disposition || "") : String(o.summary || "");
        },
        cells: function (o) {
          const end = P.endOf(o);
          const disp = ["open", "chosen", "declined", "done", "blocked"].includes(o.disposition) ? o.disposition : "open";
          const last = Array.isArray(o.dispositions) && o.dispositions.length ? o.dispositions[o.dispositions.length - 1] : null;
          return [byName.get(o.id),
            cs.w("screen.plan.category." + (CATS.includes(o.category) ? o.category : "other")),
            end ? cs.date(end) : cs.w("screen.plan.noend"),
            cs.esc(P.subjectKeys(o).map(titles.ofKey).filter(Boolean).join(", ")),
            cs.w("screen.plan.disposition." + disp) + (last && last.reason ? " · " + cs.esc(last.reason) : "")
              + (o.action && o.action.id ? " · " + cs.w("screen.plan.started") : "")
              // C53: the reminders the record holds for this option, each by the day it fires
              + P.heldReminders(o).map(function (r) { return " · " + cs.w("screen.reminder.on", { date: { html: cs.date(r.on) } }); }).join("")];
        },
        acts: function (o) {
          if (!open) return "";
          const started = o.action && o.action.id;
          return (started ? '<a class="cs-ref" href="/app/action/' + encodeURIComponent(o.action.id) + '" data-nav>' + cs.w("screen.plan.openaction") + "</a>" : "")
            + (!started && o.disposition !== "chosen" ? cs.act("optiondispose", { label: "screen.plan.choose", data: { option: o.id, disposition: "chosen" } }) : "")
            + (!started && o.disposition !== "declined" ? cs.act("optiondispose", { label: "screen.plan.decline", data: { option: o.id, disposition: "declined" } }) : "")
            // R44 (c): done, blocked, or back to undecided
            + (!started && o.disposition !== "done" ? cs.act("optiondispose", { label: "screen.plan.dispose.done", data: { option: o.id, disposition: "done" } }) : "")
            + (!started && o.disposition !== "blocked" ? cs.act("optiondispose", { label: "screen.plan.dispose.blocked", data: { option: o.id, disposition: "blocked" } }) : "")
            + (!started && o.disposition && o.disposition !== "open" ? cs.act("optiondispose", { label: "screen.plan.dispose.open", data: { option: o.id, disposition: "open" } }) : "")
            // C53: a chosen option with dates that binds it draws "Remind me", which keeps the choice and sets the reminder on the day asked
            + (!started && o.disposition === "chosen" && P.datesOf(o).length ? cs.act("optiondispose", { label: "act.reminderset.label.action", data: { option: o.id, disposition: "chosen", remind: "1" } }) : "")
            + (!started && o.disposition === "chosen" ? cs.act("optionstartpreview", { label: "act.optionstartpreview.label.plan", tone: "primary", data: { option: o.id } }) : "");
        },
        hold: function () {
          // DEC-387 (B424): on the picked rows the acts read "Choose them", "Decline them", "Mark done", "Mark them blocked"
          return cs.act("optiondispose", { label: "screen.plan.dispose.them.choose", data: { disposition: "chosen" } })
            + cs.act("optiondispose", { label: "screen.plan.dispose.them.decline", data: { disposition: "declined" } })
            + cs.act("optiondispose", { label: "screen.plan.dispose.done", data: { disposition: "done" } })
            + cs.act("optiondispose", { label: "screen.plan.dispose.them.blocked", data: { disposition: "blocked" } })
            + cs.act("optiondispose", { label: "screen.plan.dispose.open", data: { disposition: "open" } });
        },
      });
      const subjectChoice = function (id) {
        return cs.choice(id, "screen.plan.option.matter", subjects.map(function (s, i) {
          const t = titles.ofKey(s.key);
          return t ? { value: s.key, text: t } : { value: s.key, key: "screen.plan.matter.n", fills: { n: String(i + 1) } };
        }));
      };
      const catChoice = function (id) {
        return cs.choice(id, "screen.plan.option.category", CATS.map(function (c) { return [c, "screen.plan.option.kind." + c]; }));
      };
      // R44 (a): who it is directed to, the dates that bind it, the tier, the seeking-enforcement mark with the requirement it seeks
      const nDates = Math.max(1, Math.min(20, Number(view.ui.optdates) || 1));
      const dateLines = [];
      for (let i = 0; i < nDates; i++) dateLines.push(cs.field("plan-opt-date-" + i, "screen.plan.option.date", { type: "date" })
        + cs.field("plan-opt-basis-" + i, "screen.plan.because.the.law.order.or.commitment", { help: "screen.plan.one.line.up.to.500.characters" }));
      const enfChoices = [{ value: "", key: "screen.plan.option.enforce.none" }].concat(subjects.filter(function (s) { return s.subject && s.subject.kind === "outcome"; }).map(function (s, i) {
        const t = titles.ofKey(s.key);
        return t ? { value: s.key, text: t } : { value: s.key, key: "screen.plan.matter.n", fills: { n: String(subjects.indexOf(s) + 1) } };
      })).concat(lists ? lists.determinations.items.flatMap(function (d) { return (Array.isArray(d.outcomes) ? d.outcomes : []).map(function (o) { return o.standard; }); })
        .filter(function (x, i, all) { return x && all.indexOf(x) === i; }).filter(function (x) { return P.citeOf(stds, x); }).map(function (x) { return { value: x, text: P.citeOf(stds, x) }; }) : []);
      const addOption = open ? cs.field("plan-opt-summary", "screen.plan.option.summary", { rec: true, max: 200 })
        + (view.reachable ? '<div class="mk-acts">' + cs.act("writinghelp", { data: { field: "summary", id: "plan-opt-summary", forop: "optionadd" } }) + "</div>" : "")
        + catChoice("plan-opt-category") + subjectChoice("plan-opt-matter")
        + cs.field("plan-opt-detail", "screen.plan.option.detail", { area: true, rec: true })
        + (view.reachable ? '<div class="mk-acts">' + cs.act("writinghelp", { data: { field: "detail", id: "plan-opt-detail", forop: "optionadd" } }) + "</div>" : "")
        + cs.choice("plan-opt-adk", "screen.plan.who.it.is.directed.to", [["none", "screen.plan.no.one.in.particular"], ["office", "screen.actionnew.to.named"],
          ["press", "screen.plan.option.directed.press"], ["organisation", "screen.people.add.kind.organization"], ["audience", "screen.plan.an.audience.described.in.words"]], { value: "none" })
        + cs.field("plan-opt-arole", "screen.plan.option.role") + cs.field("plan-opt-abody", "screen.plan.the.body.or.organization")
        + cs.field("plan-opt-adesc", "screen.plan.an.audience.described.in.words", { area: true })
        + cs.sec("screen.plan.dates.that.bind.it", dateLines.join("")
          + cs.choice("plan-opt-datecount", "screen.plan.add.another.date", Array.from({ length: 20 }, function (_, i) { return { value: String(i + 1), text: String(i + 1) }; }), { redraw: "optdates", value: "1" }),
          { help: ["screen.plan.a.date.set.by.law.an", "screen.plan.every.date.says.where.it.comes", "screen.plan.help.adds.a.line.for.one.more"] })
        + cs.choice("plan-opt-tier", "screen.plan.how.careful.to.be.legal.options", [["", "screen.plan.option.tier.none"], ["1", "screen.plan.option.tier.1"], ["2", "screen.plan.option.tier.2"], ["3", "screen.plan.option.tier.3"]], { value: "" })
        + cs.checks("plan-opt-lobbying", "screen.plan.option.enforce", [["lobbying", "screen.plan.this.option.asks.someone.to.enforce"]])
        + cs.choice("plan-opt-enforces", "screen.plan.the.requirement.it.seeks", enfChoices, { value: "" })
        + '<div class="mk-acts">' + cs.act("optionadd", { label: "act.optionadd.label.plan" }) + "</div>" : "";

      // R1 (v0.2 rule 19; DEC-194): the standing offers, then the assistant's suggestions, each labelled and adopted
      // only by the member's own act.
      const offers = (Array.isArray(p.offers) ? p.offers : []).flatMap(function (g) {
        return (g.offers || []).filter(function (o) { return !(o.adopted && o.adopted.length); }).map(function (o) {
          const k = o.kind === "chance_to_fix" ? "plan.offer.chancetofix" : "plan.offer.document";
          const named = titles.ofKey(g.key);
          return cs.row("", "<b>" + cs.w(k) + "</b>" + (named ? " · " + cs.esc(named) : "") + '<span class="meta">' + cs.w(k + ".means")
            + (o.offered_again ? " · " + cs.w("plan.offer.chancetofix.again") : "") + "</span>",
          open ? cs.act("optionadopt", { label: "screen.plan.adopt", data: { subject: g.key || "", offer: o.kind } }) : "", "");
        });
      });
      // R13: "Ask the assistant for options" starts a planning run (`planask`), drawn running and read again on the page's
      // clock until it ends; its proposals then reach the tray, read again, labelled machine work and adopted only by the
      // member's own act.
      const pr = view.data.proposals;
      const asked = view.ui.ask || null;
      let askNote = "", fresh = null;
      if (asked && asked.refused) {
        // R18 (D5, D29): an answer carrying a refusal is drawn as that refusal, never as a run looking for options.
        askNote = '<p class="mk-note" role="alert" data-run="refused">' + asked.refused + "</p>";
      } else if (asked && asked.run) {
        const st = P.later(cs, view, "run", "airun", { run: asked.run }, String(view.ui.seq || 0));
        const session = st.state === "ok" && st.value && st.value.session ? st.value.session : null;
        if (session) view.ui.askStatus = { run: asked.run, status: session.status };
        // R18: "looking for options" is drawn only while `airun` answers the run as running; until it answers, nothing.
        const status = session ? session.status : view.ui.askStatus && view.ui.askStatus.run === asked.run ? view.ui.askStatus.status : null;
        const poll = function () {
          if (st.state !== "loading" && !view.ui.askPolling && (view.ui.askPolls || 0) < 60) {
            view.ui.askPolling = true;
            cs.later(10000, function (k, v) { v.ui.askPolling = false; v.ui.askPolls = (v.ui.askPolls || 0) + 1; k.set("seq", (v.ui.seq || 0) + 1); });
          }
        };
        if (status === "running") {
          askNote = '<p class="mk-note" role="status" data-run="running">' + cs.w(asked.existed ? "screen.plan.ask.already" : "screen.plan.ask.running") + "</p>";
          poll();
        } else if (status) {
          askNote = '<p class="mk-note" role="status" data-run="ended">' + cs.w("screen.plan.ask.ended") + "</p>";
          fresh = P.later(cs, view, "tray", "planproposals", { plan: view.subject }, asked.run);
        } else if (st.state === "failed") poll();
      }
      const trayRows = function (v) {
        const rows = (Array.isArray(v.proposals) ? v.proposals : []).filter(function (x) { return !x.adopted; }).map(function (x) {
          return cs.row("", "<b>" + cs.esc(x.summary || "") + "</b>" + '<span class="meta">' + cs.esc(x.why || "") + (x.label ? " · " + cs.esc(x.label) : "") + "</span>",
            open ? cs.act("optionadopt", { label: "screen.plan.adopt", data: { proposal: x.id } }) : "", "");
        });
        return rows.length ? cs.sheet(rows.join("")) : "";
      };
      const trayList = fresh ? (fresh.state === "ok" ? trayRows(fresh.value) : cs.state(fresh)) : pr && pr.state !== "empty" ? cs.state("proposals", trayRows) : "";
      const trayIn = askNote + trayList + (open ? '<div class="mk-acts">' + cs.act("planask", {}) + "</div>" : "");
      const tray = view.reachable && pr && trayIn ? '<div class="mk-tray" role="region" aria-label="' + cs.w("screen.plan.suggested") + '"><p class="eyebrow">'
        + cs.w("screen.plan.suggested") + "</p>" + trayIn + "</div>" : "";

      // R44 (c): the reminder asked when choosing an option that has dates: which of its dates, and on what day
      const dated = [];
      options.forEach(function (o, i) { (Array.isArray(o.dates) ? o.dates : []).forEach(function (d) { if (d && d.date) dated.push({ value: o.id + "|" + d.date, text: (o.summary ? o.summary : cs.w("screen.plan.option.unnamed", { n: String(i + 1) })) + " · " + cs.date(d.date) }); }); });
      const remind = open && dated.length ? cs.sec("screen.plan.remind.me.as.a.date.comes",
        cs.choice("plan-rem-date", "screen.plan.dispose.date", [{ value: "", text: "" }].concat(dated), { value: "" })
        + cs.field("plan-rem-on", "screen.action.remindon", { type: "date", help: "screen.plan.a.day.before.the.date.in" }),
        { help: ["screen.plan.only.when.you.choose.an.option", "screen.plan.pick.one.of.its.dates.and"] }) : "";
      const optionsIn = (options.length ? optionRows + remind : "") + addOption + (offers.length ? cs.sheet(offers.join("")) : "") + tray;
      const optionsSec = optionsIn ? cs.sec("screen.plan.options", optionsIn) : "";

      // R1: scenarios and their phases; a checkpoint judged by a member; take-up, never assignment (v0.2 rule 18).
      const scenarios = Array.isArray(p.scenarios) ? p.scenarios : [];
      const today = new Date(cs.now()).toISOString().slice(0, 10);
      const nPhases = Math.max(1, Math.min(10, Number(view.ui.scenphases) || 1));
      const chosenItems = options.map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return x.o.disposition === "chosen"; }).map(function (x) {
        return x.o.summary ? { value: x.o.id, text: x.o.summary } : { value: x.o.id, key: "screen.plan.option.unnamed", fills: { n: String(x.i + 1) } };
      });
      const scenIn = scenarios.map(function (s) {
        return "<h3>" + cs.esc(s.name || "") + (s.set_aside ? " · " + cs.w("screen.plan.setaside") : "") + "</h3>"
          + cs.sheet((s.phases || []).map(function (ph, pi) {
            const judged = ph.judgement ? cs.w("screen.plan.judged." + (ph.judgement.judged === "met" ? "met" : "not_met")) + (ph.judgement.note ? " · " + cs.esc(ph.judgement.note) : "") : "";
            const due = ph.checkpoint_due ? cs.due(String(ph.checkpoint_due), "") : "";
            const tookIt = (view.ui.took || {})["checkpoint:" + s.scenario + ":" + ph.id];
            // R53: the Judge control is drawn only once the checkpoint is due (by the page's clock); before, the day it can be judged
            const isDue = !!ph.checkpoint_due && String(ph.checkpoint_due).slice(0, 10) <= today;
            const notDue = ph.checkpoint && !ph.judgement && open && ph.checkpoint_due && !isDue
              ? '<span class="mk-small">' + cs.w("screen.plan.judge.notdue", { date: { html: cs.date(ph.checkpoint_due) } }) + "</span>" : "";
            const takeUp = tookIt ? cs.w("screen.plan.tookup") : cs.act("itemtakeup", { label: "screen.plan.takeup", data: { kind: "checkpoint", scenario: String(s.scenario), phase: ph.id } });
            const form = ph.checkpoint && !ph.judgement && open
              ? (isDue ? cs.choice("plan-judge-" + s.scenario + "-" + ph.id, "screen.plan.judge.outcome", [["met", "screen.plan.judged.met"], ["not_met", "screen.plan.judged.not_met"]])
                + cs.field("plan-judgenote-" + s.scenario + "-" + ph.id, "screen.plan.judge.note")
                + cs.act("checkpointrecord", { label: "screen.plan.judge", data: { scenario: String(s.scenario), phase: ph.id } }) : notDue)
                + takeUp
              : "";
            const names = (ph.options || []).map(function (id) { return byName.get(id); }).filter(Boolean).join(", ");
            return cs.row("<b>" + P.phName(cs, ph, pi) + "</b>", names + (judged ? '<span class="meta">' + judged + "</span>" : ""), due, form);
          }).join(""));
      }).join("") + (open ? cs.field("plan-scen-name", "screen.plan.scenario.name")
        + Array.from({ length: nPhases }, function (_, k) { return P.phaseForm(cs, view, k, nPhases, chosenItems); }).join("")
        + cs.choice("plan-scen-phasecount", "screen.plan.add.another.phase", Array.from({ length: 10 }, function (_, i) { return { value: String(i + 1), text: String(i + 1) }; }), { redraw: "scenphases", value: "1" })
        + '<div class="mk-acts">' + cs.act("scenarioset", { label: "act.scenarioset.label.plan", data: { next: String(scenarios.length + 1) } }) + "</div>" : "");
      const scen = scenIn ? cs.sec("screen.plan.scenarios", scenIn) : "";

      // R1: what each started option became.
      const started = options.filter(function (o) { return o.action && o.action.id; });
      const startedSec = !started.length ? "" : cs.sec("screen.plan.startedsec", cs.sheet(started.map(function (o) {
        return cs.row("", '<a class="cs-ref" href="/app/action/' + encodeURIComponent(o.action.id) + '" data-nav>' + byName.get(o.id) + "</a>",
          '<span class="meta">' + cs.w("screen.plan.actionstate." + (["planned", "active", "awaiting_response", "resolved", "abandoned"].includes(o.action.state) ? o.action.state : "planned")) + "</span>", "");
      }).join("")));

      const close = open ? cs.field("plan-close-note", "plan.close.lessons", { area: true, rec: true })
        + '<div class="mk-acts">' + cs.act("planclose", { label: "screen.plan.close" })
        + (view.reachable ? cs.act("writinghelp", { data: { field: "note", id: "plan-close-note", forop: "planclose" } }) : "") + "</div>" : "";
      // R14: a plan with nothing in it to show draws its one empty state.
      const body = strip + matters + optionsSec + scen + startedSec + close;
      return head + (body || '<p class="cs-state" data-state="empty">' + cs.w("screen.plan.empty") + "</p>");
    });
  },

  acts: [
    {
      // R1, R7: "Add a matter": an inquiry, or a determination's outcome against a standard, with the member's reason.
      op: "plansubjectadd", reasonField: "reason",
      send: function (view, el, cs) {
        // R18: the reference is picked from the record's lists: `inquiry:<question>` or `outcome:<determination>#<standard>`.
        const m = /^(inquiry|outcome):([^#]+)(?:#(.*))?$/.exec(String(cs.value("plan-subject-id") || ""));
        if (!m) return { refuse: "screen.plan.subject.needed" };
        const subject = m[1] === "outcome" ? { kind: "outcome", determination: m[2], standard: m[3] || "" } : { kind: "inquiry", inquiry: m[2] };
        return { body: { plan: view.subject, subject: subject, reason: String(cs.value("plan-subject-reason") || "").trim() } };
      },
    },
    {
      // R1, R44 (a): "Add an option": the line, its kind, its matter and, as the member gives them, who it is directed to, the
      // dates that bind it (each with its basis), the tier, the seeking-enforcement mark with the requirement it seeks.
      op: "optionadd",
      refusals: {
        OPTION_NO_SUMMARY: function (r, cs) { return cs.w("screen.plan.an.option.needs.a.line.saying") + " " + cs.w("screen.plan.write.one.and.add.it.again"); },
        OPTION_NO_SUBJECT: function (r, cs) { return cs.w("screen.plan.choose.at.least.one.matter.the") + " " + cs.w("screen.plan.an.option.cannot.serve.a.matter"); },
        TIER_REFUSED: function (r, cs) { return cs.w("screen.plan.a.tier.belongs.only.on.a") + " " + cs.w("screen.plan.change.the.kind.or.clear.the"); },
        LOBBYING_NO_REQUIREMENT: function (r, cs) { return cs.w("screen.plan.an.option.marked.as.lobbying.must") + " " + cs.w("screen.plan.choose.it.or.clear.the.mark"); },
        DATE_REFUSED: function (r, cs) { return cs.w("screen.plan.a.date.needs.the.law.order") + " " + cs.w("screen.plan.fix.the.date.and.add.again"); },
        // R56 (walk E K4; walk C C-M17): the owner's refusal names the empty part; its `detail` is the member's sentence
        // R59 (DEC-439 K4, C-M17): the empty part is named in the design's words, by the owner's `empty` (its field names)
        ADDRESSEE_INCOMPLETE: function (r, cs) {
          const empty = Array.isArray(r.empty) ? r.empty : [];
          const both = empty.includes("role") && empty.includes("organisation");
          const key = both ? "both" : empty.length === 1 && empty[0] === "role" ? "role" : empty.length === 1 && empty[0] === "organisation" ? "organisation" : "";
          return key ? cs.w("screen.plan.press.empty." + key) : cs.esc(typeof r.detail === "string" && r.detail ? r.detail : r.translation || "");
        },
        ADDRESSEE_REFUSED: function (r, cs) { return cs.w("screen.plan.an.option.can.be.directed.to") + " " + cs.w("screen.plan.change.who.it.is.for"); },
      },
      send: function (view, el, cs) {
        const summary = String(cs.value("plan-opt-summary") || "").trim();
        if (!summary) return { refuse: "screen.plan.option.needed" };
        const detail = String(cs.value("plan-opt-detail") || "").trim();
        const body = { plan: view.subject, summary: summary, category: cs.value("plan-opt-category"), subjects: [cs.value("plan-opt-matter")].filter(Boolean) };
        if (detail) body.detail = detail;
        const text = function (id) { return String(cs.value(id) || "").trim(); };
        const kind = String(cs.value("plan-opt-adk") || "none");
        if (kind === "office") body.addressee = { state: "named", kind: "office", role: text("plan-opt-arole"), body: text("plan-opt-abody") };
        else if (kind === "press" || kind === "organisation") body.addressee = { state: "named", kind: kind, role: text("plan-opt-arole"), organisation: text("plan-opt-abody") };
        else if (kind === "audience") body.addressee = { state: "audience", description: text("plan-opt-adesc") };
        const dates = [];
        for (let i = 0; i < 20; i++) {
          const d = cs.value("plan-opt-date-" + i);
          if (d === null || d === undefined) break;
          const day = String(d).trim(), basis = text("plan-opt-basis-" + i);
          if (day || basis) dates.push({ date: day, basis: basis });
        }
        if (dates.length) body.dates = dates;
        const tier = String(cs.value("plan-opt-tier") || "");
        if (tier) body.tier = Number(tier);
        const lobbying = (cs.value("plan-opt-lobbying") || []).length > 0;
        if (lobbying) body.lobbying = true;
        const enforces = String(cs.value("plan-opt-enforces") || "");
        if (enforces) body.enforces = enforces;
        return { body: body };
      },
    },
    {
      // R13, R15, R18: "Ask the assistant for options" (`act.planask.label.plan`, explained by `act.planask.does`) starts a
      // planning run for this plan, drawn only while the assistant is reachable (`interface-shell` R55 admits this op); it
      // records no option and no proposal of the member's own. `existed` draws the run already asked; an answer that
      // carries a refusal is drawn as that refusal.
      op: "planask",
      send: function (view) { return { body: { plan: view.subject } }; },
      done: function (view, answer, cs) {
        const a = answer || {};
        if (view.parts.refused(a)) { cs.set("ask", { refused: view.parts.refusalWords(cs, a) }); return; }
        if (a.run) { cs.set("askPolls", 0); cs.set("ask", { run: a.run, existed: a.existed === true }); }
      },
      rereads: [],
    },
    {
      // R1: a suggestion or a standing offer becomes an option only by the member's own act.
      op: "optionadopt",
      rereads: ["plan", "proposals"],
      send: function (view, el) {
        const d = el.dataset;
        return d.proposal ? { body: { proposal: d.proposal } } : { body: { plan: view.subject, offer: { subject: d.subject, kind: d.offer } } };
      },
    },
    {
      // R1: "Choose" or "Decline" (the shell asks the reason, required where declining), one option or the picked ones.
      op: "optiondispose",
      rereads: ["plan"],
      refusals: {
        PLAN_NO_REASON: function (r, cs) { return cs.w("screen.plan.declining.an.option.or.marking.it"); },
        REMINDER_REFUSED: function (r, cs) {
          return r && r.disposition ? cs.w("screen.plan.reminders.are.set.only.when.you") + " " + cs.w("screen.plan.choose.it.or.leave.the.reminder")
            : cs.w("screen.plan.a.reminder.names.a.date.the") + " " + cs.w("screen.plan.pick.one.of.its.dates.or");
        },
        NO_SUCH_OPTION: function (r, cs) { return cs.w("screen.plan.pick.at.least.one.option") + " " + cs.w("screen.plan.an.option.that.is.not.in"); },
        PLAN_CLOSED: function (r, cs) { return cs.w("screen.plan.this.plan.is.closed.so.its") + " " + cs.w("screen.plan.ask.an.owner.to.reopen.it"); },
      },
      send: function (view, el, cs, extra) {
        const options = extra && extra.picked && extra.picked.length ? extra.picked : [el.dataset.option].filter(Boolean);
        if (!options.length) return { refuse: "screen.plan.pick.at.least.one.option" };
        const body = { plan: view.subject, options: options, disposition: el.dataset.disposition };
        // R44 (c): a reminder, when one is asked: which date of an option, and on what day
        const at = String(cs.value("plan-rem-date") || ""), on = String(cs.value("plan-rem-on") || "").trim();
        if (el.dataset.remind) {
          // C53: "Remind me" on one chosen option keeps the choice and adds this reminder to the ones the record holds
          const opt = (Array.isArray(view.data.plan && view.data.plan.value && view.data.plan.value.options) ? view.data.plan.value.options : []).find(function (x) { return x.id === options[0]; }) || {};
          const dates = view.parts.datesOf(opt);
          const cut = at.lastIndexOf("|");
          const date = at && at.slice(0, cut) === options[0] ? at.slice(cut + 1) : dates.length === 1 ? dates[0] : "";
          if (!on || !date) return { refuse: "screen.action.remindon.needed" };
          body.reminders = view.parts.heldReminders(opt).map(function (r) { return { option: options[0], date: r.date, on: r.on }; }).filter(function (r) { return !(r.date === date && r.on === on); })
            .concat([{ option: options[0], date: date, on: on }]);
          return { body: body };
        }
        if (at || on) {
          const cut = at.lastIndexOf("|");
          if (at) body.reminders = [{ option: at.slice(0, cut), date: at.slice(cut + 1), on: on }];
          else {
            // C53-min: a day asked and the date list left blank: each option takes the first date it has; an option with none takes no reminder
            const all = Array.isArray(view.data.plan && view.data.plan.value && view.data.plan.value.options) ? view.data.plan.value.options : [];
            const firsts = options.map(function (id) {
              const dates = view.parts.datesOf(all.find(function (x) { return x.id === id; }));
              return dates.length ? { option: id, date: dates[0], on: on } : null;
            }).filter(Boolean);
            body.reminders = firsts.length ? firsts : [{ date: "", on: on }];
          }
        }
        return { body: body };
      },
    },
    {
      // R1: "Lay out a scenario": its name and one phase of the chosen options, from the plan's start, with a checkpoint.
      op: "scenarioset",
      refusals: {
        PHASE_OPTION_NOT_CHOSEN: function (r, cs) { return cs.w("screen.plan.a.phase.can.hold.only.options") + " " + cs.w("screen.plan.choose.the.option.first.or.take"); },
        PHASE_CYCLE: function (r, cs) { return cs.w("screen.plan.following.when.each.phase.starts.leads") + " " + cs.w("screen.plan.no.phase.can.start.after.itself.2"); },
        BRANCH_UNKNOWN: function (r, cs) { return cs.w("screen.plan.a.phase.points.to.a.phase") + " " + cs.w("screen.plan.choose.one.that.is.in.it"); },
        PHASE_MALFORMED: function (r, cs) { return cs.w("screen.plan.a.phase.needs.a.name.the") + " " + cs.w("screen.plan.fill.in.the.one.that.is"); },
      },
      // R44 (b): the scenario's phases, each with its name, chosen options, when it starts (the plan's start, after another
      // phase, when another's checkpoint is met or not met) and which, check-back days, what the checkpoint tests, and where
      // each judgement goes.
      send: function (view, el, cs) {
        const name = String(cs.value("plan-scen-name") || "").trim();
        if (!name) return { refuse: "screen.plan.scenario.needed" };
        const n = Math.max(1, Math.min(10, Number(view.ui.scenphases) || 1));
        const phases = [];
        for (let k = 0; k < n; k++) {
          const sf = k ? "-p" + (k + 1) : "";
          const text = function (id) { return String(cs.value(id + sf) || "").trim(); };
          const options = cs.value("plan-scen-options" + sf) || [];
          const pname = text("plan-scen-pname") || (k === 0 ? name : "");
          if (!pname || !options.length) return { refuse: "screen.plan.scenario.needed" };
          const kind = text("plan-scen-start") || "plan_start", which = text("plan-scen-after");
          const phase = { id: "p" + (k + 1), name: pname, options: options,
            starts: kind === "after" ? { after: which } : kind === "met" || kind === "not_met" ? { branch_of: which, when: kind } : "plan_start" };
          const days = Number(text("plan-scen-days"));
          if (Number.isInteger(days) && days > 0) phase.checkpoint = { after_days: days };
          const cond = text("plan-scen-cond");
          if (cond) phase.condition = cond;
          const met = text("plan-scen-met"), not = text("plan-scen-not");
          if (met || not) phase.branches = Object.assign({}, met ? { met: met } : {}, not ? { not_met: not } : {});
          phases.push(phase);
        }
        return { body: { plan: view.subject, scenario: Number(el.dataset.next) || 1, name: name, phases: phases } };
      },
    },
    {
      op: "checkpointrecord",
      rereads: ["plan"],
      send: function (view, el, cs) {
        const d = el.dataset;
        const note = String(cs.value("plan-judgenote-" + d.scenario + "-" + d.phase) || "").trim();
        const body = { plan: view.subject, scenario: Number(d.scenario), phase: d.phase, judged: cs.value("plan-judge-" + d.scenario + "-" + d.phase) };
        if (note) body.note = note;
        return { body: body };
      },
    },
    {
      // R1: "Start…" opens `start-send` for the option; nothing is read or started here.
      op: "optionstartpreview",
      send: function (view, el, cs) { cs.go("start-send", view.subject + "~" + el.dataset.option); return null; },
    },
    {
      // R1 (v0.2 rule 18): "Take this up" routes the item's to-dos to the member; nobody assigns anybody.
      op: "itemtakeup",
      send: function (view, el) {
        const d = el.dataset;
        const item = d.kind === "checkpoint" ? { kind: "checkpoint", plan: view.subject, scenario: Number(d.scenario), phase: d.phase }
          : { kind: "escalation_stage", escalation: d.escalation, stage: Number(d.stage) };
        return { body: { item: item } };
      },
      // nothing on the plan changes: the screen says the item is the member's from now on.
      rereads: [],
      done: function (view, answer, cs) {
        const it = answer && answer.item ? answer.item : {};
        const took = Object.assign({}, view.ui.took || {});
        took[it.kind === "checkpoint" ? "checkpoint:" + it.scenario + ":" + it.phase : "escalation_stage:" + it.escalation] = true;
        cs.set("took", took);
      },
    },
    {
      // R1: "Close plan…" with a reason (the shell asks it), and the lessons note when written.
      op: "planclose",
      rereads: ["plan"],
      send: function (view, el, cs) {
        const note = String(cs.value("plan-close-note") || "").trim();
        return { body: note ? { plan: view.subject, note: note } : { plan: view.subject } };
      },
    },
    // the assistant's help with one own-words field (drawn only while it is reachable)
    WRITE_HELP,
  ],
});
