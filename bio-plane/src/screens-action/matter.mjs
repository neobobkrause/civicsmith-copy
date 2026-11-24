/* One matter (registry screen `matter`; screens-action R6, R7; DEC-89). Projects › <project> › Matter: one government
   act's determination (the standard it is tested against, what it requires and what the act did, its outcome, compliant
   or not, recorded with the same care either way), its consequences (an undetermined measure never read as zero, people
   counted as a class), and its escalation (the seven stages, the proposed next stage and its trigger, what ends it, the
   actions attached, the legal tools a stage makes available listed as facts, never as advice). The subject is the
   determination's id, and `<determination>~<escalation>` once an escalation is opened. Every function here is self-
   contained (interface-shell R21 (1)). */

import { readOnly, later, WRITE_HELP, actName, citeOf } from "./send-steps.mjs";

export const matter = Object.freeze({
  id: "matter",

  place: function (view) {
    const d = view.data.determination;
    const v = d && d.state === "ok" ? d.value : /^PROJ-/.test(String(view.subject || "")) ? { project: String(view.subject) } : null;
    if (!v || !v.project) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === v.project; });
    return { project: { id: v.project, title: (hit && hit.title) || v.project } };
  },

  reads: function (view) {
    const s = String(view.subject || "");
    const det = s.split("~")[0], esc = s.split("~")[1];
    // R45 (b): the matter of a project that holds no determination yet is opened by the project's id; it reads the project's determinations
    if (/^PROJ-/.test(s)) return {
      determinations: { op: "determinations", query: { project: s, live: "true", limit: "200" }, subject: true, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
    };
    const r = {
      determination: { op: "determination", query: { id: det }, subject: true },
      consequences: { op: "consequencesof", query: { determination: det },
        empty: function (v) { return !v || !Array.isArray(v.parts) || v.parts.length === 0; } },
      status: { op: "escalationstatus", query: { determination: det }, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
    };
    if (esc) r.escalation = { op: "escalation", query: { id: esc } };
    return r;
  },

  parts: {
    readOnly: readOnly, actName: actName, citeOf: citeOf,
    // R18 (fix round 10; diagnosis 11 §7a): a standard by its citation, as `standards` lists it; "" while that is not read or does not hold it
    cite: function (cs, view, id) {
      const sl = view.parts.later(cs, view, "standards", "standards", { limit: "200" }, "");
      return view.parts.citeOf(sl.state === "ok" && sl.value && Array.isArray(sl.value.items) ? sl.value.items : [], id);
    },
    det: function (view) { return String(view.subject || "").split("~")[0]; },
    outcome: function (o) { return ["compliant", "noncompliant", "unclear"].includes(o) ? o : "undetermined"; },
    measure: function (cs, p) {
      if (p.state === "undetermined" || p.measure === null || p.measure === undefined) return cs.w("screen.matter.undetermined");
      const m = p.measure;
      if (typeof m !== "object") return cs.esc(String(m));
      return cs.esc([m.amount !== undefined ? m.amount : m.value, m.currency || m.unit].filter(function (x) { return x !== undefined && x !== null && x !== ""; }).join(" "));
    },
    // fix round 10 (diagnosis 11 §6): a part's label is the owner's `{machine_work, says}` (a plain sentence is read as it is); drawn by what it says,
    // never as the object. A causation not established is drawn by the owner's own `why` (record data), so a member sees it before an escalation is refused for it.
    labelOf: function (p) {
      const l = p && p.label;
      return typeof l === "string" ? l : l && typeof l === "object" && typeof l.says === "string" ? l.says : "";
    },
    causeOf: function (p) {
      const c = p && p.causation;
      return c && typeof c === "object" && c.state !== "established" && c.state !== "not_applicable" && typeof c.why === "string" ? c.why : "";
    },
    affected: function (cs, p) {
      const a = p.affected;
      if (!a) return "";
      if (typeof a !== "object") return cs.esc(String(a));
      return cs.esc(a.name || a.description || a.label || "") + (a.kind ? " · " + cs.esc(a.kind) : "");
    },
    // R45 to R51: the pieces the forms are made of, each self-contained
    later: later,
    isProject: function (view) { return /^PROJ-/.test(String(view.subject || "")); },
    esc: function (view) { return String(view.subject || "").split("~")[1] || ""; },
    ids: function (text) { return Array.isArray(text) ? text : String(text || "").split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean); },
    note: function (cs, key) { return '<p class="mk-note">' + cs.w(key) + "</p>"; },
    // R51 (writinghelp): the assistant's help beside a field the design marks `rec`, drawn only while the assistant is reachable
    help: function (cs, view, id, forop, field) {
      return view.reachable ? '<div class="mk-acts">' + cs.act("writinghelp", { data: { field: field, id: id, forop: forop } }) + "</div>" : "";
    },
    // an option the design words by a key the table holds, else the record's own value as data
    opt: function (value, key) { return key ? [value, key] : { value: value, text: value }; },
    // R45: one amount as the owner reads a measure: a value, or a low and a high
    amount: function (unit, text) {
      const t = String(text || "").replace(/[$,]/g, "").trim();
      if (!t) return null;
      const m = t.match(/^(-?[\d.]+)(?:\s*(?:to|-|–)\s*(-?[\d.]+))?$/);
      if (!m) return { unit: unit, value: t };
      return m[2] !== undefined ? { unit: unit, range: { low: m[1], high: m[2] } } : { unit: unit, value: m[1] };
    },
    // R45 to R51: the project, the live determination, its noncompliant standards and parts, and the escalation, as the page read them
    ctx: function (view) {
      const d = view.data.determination && view.data.determination.state === "ok" ? view.data.determination.value : null;
      const c = view.data.consequences && view.data.consequences.state === "ok" ? view.data.consequences.value : null;
      const e = view.data.escalation && view.data.escalation.state === "ok" ? view.data.escalation.value : null;
      const std = d && Array.isArray(d.standards) ? d.standards : [];
      const prop = e && Array.isArray(e.proposed) && e.proposed.length ? e.proposed[0] : null;
      return {
        d: d, e: e, det: String(view.subject || "").split("~")[0], project: d && d.project ? d.project : /^PROJ-/.test(String(view.subject || "")) ? String(view.subject) : "",
        live: !!d && d.live !== false, standards: std, nc: std.filter(function (s) { return s.outcome === "noncompliant"; }),
        parts: c && Array.isArray(c.parts) ? c.parts : [], prop: prop, stage: e ? Number(e.stage) || 1 : 0,
      };
    },
    // the forms the member may open on this page, each one an act of this screen the member may do (R12)
    modes: function (cs, view, k) {
      const out = [];
      const add = function (op) { if (cs.can(op)) out.push([op, "act." + op + ".label.matter"]); };
      if (!k.d && !view.parts.isProject(view)) return out;
      if (view.parts.isProject(view) || k.live) add("determine");
      if (k.live && k.nc.length) add("consequencerecord");
      if (k.live && k.parts.length) { add("consequencerevise"); add("addressedrecord"); }
      if (k.live && k.project) add("successrecord");
      if (k.e && k.e.state === "open") {
        add("escalationattach");
        if (k.prop) add("escalationdecline");
        add("escalationsuspend");
        if (k.stage === 4) add("escalationevaluate");
      }
      if (k.e && k.e.state === "suspended") add("escalationresume");
      return out;
    },
    // R45 (c, d): the determination's own form; revising names what it replaces
    detForm: function (cs, view, k) {
      const P = view.parts;
      const rev = !!k.d && !P.isProject(view);
      const act = rev && k.d.act ? k.d.act : {};
      const actor = act.actor || {};
      const first = rev && k.standards.length ? k.standards[0] : null;
      const row = first && Array.isArray(first.rows) && first.rows.length ? first.rows[0] : {};
      const sl = view.parts.later(cs, view, "standards", "standards", { limit: "200" }, "");
      const items = sl.state === "ok" && sl.value && Array.isArray(sl.value.items) ? sl.value.items : [];
      const stdOpts = k.standards.map(function (s) { return { value: s.standard, text: P.cite(cs, view, s.standard) || s.standard }; }).concat(items.filter(function (it) {
        return !k.standards.some(function (s) { return s.standard === it.id; });
      }).map(function (it) { return { value: it.id, text: it.cite || it.id }; }));
      const std = stdOpts.length ? cs.choice("mt-d-std", "screen.matter.f.rule", stdOpts, { value: first ? first.standard : stdOpts[0].value })
        : cs.field("mt-d-std", "screen.matter.f.rule");
      const found = P.findings(cs, view, k);
      // DEC-387 (B424): a revision names what it replaces; the reason it replaces it is the one the shell asks (`determine` is Reasoned)
      const why = rev ? cs.sec("screen.matter.revise", P.note(cs, "screen.matter.a_new_determination_that_replaces_the_earlier"))
        + cs.sec("screen.matter.replaces", P.note(cs, "screen.matter.the_earlier_determination_stays_readable_with_a") + P.note(cs, "screen.matter.it_is_not_edited")) : "";
      const acts = cs.sec("screen.matter.act", P.note(cs, "screen.matter.whether_the_act_met_the_rule_with")
        + P.eventChoice(cs, view, k, act.event || "")
        + cs.field("mt-d-role", "screen.matter.f.role", { value: actor.role || "" }) + P.bodyChoice(cs, view, actor.body || "")
        + P.passageChoice(cs, view, k));
      const rests = cs.sec("screen.actionnew.rests", found + P.note(cs, "screen.matter.a_determination_rests_on_findings_your_team"));
      const rule = cs.sec("screen.matter.the_rule_it_is_measured_against", std
        + cs.field("mt-d-req", "screen.matter.what_the_rule_requires", { rec: true, area: true, value: row.requires || "" }) + P.help(cs, view, "mt-d-req", "determine", "requires")
        + cs.field("mt-d-did", "screen.matter.f.did", { rec: true, area: true, value: row.did || "" }) + P.help(cs, view, "mt-d-did", "determine", "did")
        + cs.choice("mt-d-rd", "screen.matter.how_the_two_compare", [["aligns", "screen.matter.f.compare.matches"], ["diverges", "screen.matter.f.compare.differs"], ["open", "screen.matter.f.compare.open"]], { value: "diverges" }));
      const verdict = cs.sec("screen.matter.f.determination", cs.checks("mt-d-out", "screen.matter.against_this_rule_the_act_is", [["compliant", "screen.matter.f.outcome.compliant", first && first.outcome === "compliant"],
          ["noncompliant", "screen.matter.f.outcome.noncompliant", first ? first.outcome === "noncompliant" : false], ["unclear", "screen.matter.f.outcome.unclear", first && first.outcome === "unclear"]], { radio: true })
        + P.note(cs, "screen.matter.each_rule_gets_its_own_outcome") + P.note(cs, "screen.matter.they_are_never_combined_into_one_verdict")
        + '<details class="mk-details"><summary>' + cs.w("screen.matter.if_you_choose_unclear") + "</summary>"
        + cs.field("mt-d-q", "screen.matter.the_question_that_would_settle_it", { rec: true }) + P.help(cs, view, "mt-d-q", "determine", "question")
        + P.note(cs, "screen.matter.the_question_is_opened_in_this_project") + "</details>");
      const cause = cs.sec("screen.matter.why_it_happened_optional", cs.field("mt-d-cause", "screen.matter.f.cause", { rec: true, area: true }) + P.help(cs, view, "mt-d-cause", "determine", "cause")
        + P.note(cs, "screen.matter.say_a_cause_only_if_evidence_you") + P.note(cs, "screen.matter.otherwise_leave_it_empty_and_the_determination"));
      return why + acts + rests + rule + verdict + cause + '<div class="mk-acts">' + cs.act("determine", { tone: "primary", label: rev ? "screen.matter.record_the_revised_determination" : "screen.matter.record.this" }) + "</div>"
        + '<p class="mk-small muted">' + cs.w("screen.matter.this_cannot_be_edited_afterward") + " " + cs.w("screen.matter.a_mistake_is_put_right_by_recording") + "</p>";
    },
    // G20 (S11): the project's held documents, read page after page by the read's `next` (at most five pages of 200); `more` is true
    // when the pages read are not all that is held (a cap reached, or a later page that failed), and then the screen says so
    heldDocs: function (cs, view, k) {
      const P = view.parts;
      const rows = [];
      let after = null, state = "ok", more = false;
      for (let n = 0; n < 5; n++) {
        const q = { project: k.project, limit: "200", state: "held_and_vouched" };
        const st = P.later(cs, view, "docs" + (n ? ":" + n : ""), "heldcaptures", after ? Object.assign(q, { after: after }) : q, "");
        if (st.state === "loading") return { rows: rows, state: "loading", more: false };
        if (st.state !== "ok") { if (n) more = true; else state = "failed"; break; }
        const v = st.value;
        if (Array.isArray(v.held)) rows.push.apply(rows, v.held);
        after = v.truncated && v.next ? v.next : null;
        if (!after) { if (v.truncated) more = true; break; }
        if (n === 4) more = true;
      }
      return { rows: rows, state: state, more: more };
    },
    // R56 (walk E C2a (1, 2); re-walk 10 N5): the body the act was by, chosen among every kind `conformance` accepts as an actor (`ACTOR_KINDS`: office,
    // institution, body, movement; the issuer of a standard is usually an institution) the team holds (`entitieskind`, entities R51), the
    // entity id sent as the actor's body (conformance R27 binds a standard to the body entity, never to typed words). The body a recorded
    // determination names is kept as an option when the team's list does not hold it.
    bodyChoice: function (cs, view, current) {
      const P = view.parts;
      const reads = ["office", "institution", "body", "movement"].map(function (kind) { return P.later(cs, view, "entities:" + kind, "entitieskind", { kind: kind, limit: "200" }, ""); });
      if (reads.some(function (r) { return r.state === "loading"; })) return "";
      const failed = reads.find(function (r) { return r.state === "failed"; });
      if (failed) return cs.state(failed);
      const opts = [];
      reads.forEach(function (r) {
        (r.value && Array.isArray(r.value.entities) ? r.value.entities : []).forEach(function (e) {
          if (e && typeof e.entity_id === "string" && e.entity_id && !opts.some(function (o) { return o.value === e.entity_id; })) opts.push({ value: e.entity_id, text: e.label || e.entity_id });
        });
      });
      if (current && !opts.some(function (o) { return o.value === current; })) opts.push({ value: current, text: current });
      // R58 (DEC-438 C2a (a)): the body's help sits beside the choice
      return cs.choice("mt-d-body", "screen.matter.f.body", [{ value: "", text: "" }].concat(opts), { value: current })
        + P.note(cs, "screen.matter.f.body.help") + (opts.length ? "" : '<p class="mk-note">' + cs.w("screen.request.nooffice.admin") + "</p>");
    },
    // R45 (C6): the event the act was part of, chosen among the events the project's document follows (the timeline's own set), never typed
    eventChoice: function (cs, view, k, current) {
      const P = view.parts;
      const doc = P.later(cs, view, "projdoc", "image", { id: k.project }, "");
      const text = doc.state === "ok" && doc.value && typeof doc.value["bundle.md"] === "string" ? doc.value["bundle.md"] : "";
      const set = P.refsOf(text);
      // K4310 (events R53): the timeline answers by the project's captures too, so the event picker needs no set of ids
      const dl = P.heldDocs(cs, view, k);
      const all = dl.rows.map(function (r) { return r && r.capture && r.capture.sha256; }).filter(Boolean);
      // G20: the timeline reads the dated facts of at most 200 captures (events CAPTURES_MAX, a stated bound); more held is said
      const shas = all.slice(0, 200);
      const cut = all.length > shas.length || dl.more ? '<p class="mk-small">' + cs.w("screen.held.more", { count: shas.length }) + "</p>" : "";
      if (dl.state === "loading") return "";
      const q = {};
      if (set.length) q.set = set.join(",");
      if (shas.length) q.captures = shas.join(",");
      const tl = set.length || shas.length ? P.later(cs, view, "events", "timeline", q, "") : { state: "ok", value: {} };
      const w = tl.state === "ok" && tl.value && tl.value.world ? tl.value.world : {};
      const items = (Array.isArray(w.items) ? w.items : []).concat(Array.isArray(w.placed_nowhere) ? w.placed_nowhere : []);
      const opts = items.filter(function (e) { return e && e.event_id; }).map(function (e) {
        const day = e.when && typeof e.when === "object" ? String(e.when.value || "").slice(0, 10) : "";
        return { value: e.event_id, text: [e.kind, day].filter(Boolean).join(" \u00b7 ") || e.event_id };
      });
      if (current && !opts.some(function (o) { return o.value === current; })) opts.push({ value: current, text: P.actName(cs, k.d) || current });
      if (tl.state === "loading" || doc.state === "loading") return "";
      if (tl.state === "failed") return cut + cs.state(tl);
      // R58 (DEC-438 C2a (1)): a project with no dated event says so, and where one is recorded
      return opts.length ? cs.choice("mt-d-event", "screen.matter.the_event_it_was_part_of", [{ value: "", text: "" }].concat(opts), { value: current }) + cut
        : cut + '<p class="mk-small">' + cs.w("screen.matter.the_event_it_was_part_of") + '</p><p class="cs-state" data-state="empty">' + cs.w("screen.matter.event.none") + "</p>";
    },
    // R45 (C6): the passages that show the act, chosen among the project's documents (a passage is a whole document, as `docChoice` offers it)
    passageChoice: function (cs, view, k) {
      const P = view.parts;
      const dl = P.heldDocs(cs, view, k);
      if (dl.state === "loading") return "";
      const opts = dl.rows.filter(function (r) { return r && r.bundle_id; }).map(function (r) { return { value: r.bundle_id, text: r.title || r.bundle_id }; });
      // G20 (S11): what is not drawn is said: the pages read ended before the documents did
      const cut = dl.more ? '<p class="mk-small">' + cs.w("screen.held.more", { count: opts.length }) + "</p>" : "";
      return opts.length ? cs.checks("mt-d-evidence", "screen.matter.the_evidence_that_the_act_happened", opts) + cut
        : '<p class="mk-small">' + cs.w("screen.matter.the_evidence_that_the_act_happened") + '</p><p class="cs-state" data-state="empty">' + cs.w("state.empty") + "</p>";
    },
    // the targets a project's document references, those not severed, in order: its people, organisations and events (the timeline's own set)
    refsOf: function (text) {
      const head = String(text || "").replace(/^---\s*\n/, "").split(/\n---\s*(?:\n|$)/)[0];
      const refs = [];
      let inRefs = false, cur = null;
      head.split("\n").forEach(function (line) {
        if (/^references:\s*$/.test(line)) { inRefs = true; return; }
        if (inRefs && /^\s+-\s*/.test(line)) { cur = {}; refs.push(cur); }
        if (inRefs && /^\s+/.test(line) && cur) {
          const m = /^\s+(?:-\s*)?(\w+):\s*(.*)$/.exec(line);
          if (m) cur[m[1]] = m[2].trim();
          return;
        }
        inRefs = false;
      });
      return refs.filter(function (r) { return /^(ENT|EVT)-/.test(String(r.target || "")) && r.status !== "severed"; }).map(function (r) { return r.target; })
        .filter(function (t, i, a) { return a.indexOf(t) === i; });
    },
    // R45 (C6), R56 (walk C C-M11): the findings it rests on, chosen among those `conformance` accepts, never typed: a finding of a published case
    // (a concluded question that is one is offered by its question's title) and the findings a recorded determination already rests on. A
    // concluded question no published case holds is no finding yet: it is drawn apart, never tickable, so the member is not led to a refusal.
    findings: function (cs, view, k) {
      const P = view.parts;
      const ql = P.later(cs, view, "questions", "projectquestions", { project: k.project, limit: "200" }, "");
      const qs = ql.state === "ok" && ql.value && Array.isArray(ql.value.items) ? ql.value.items : [];
      const list = P.later(cs, view, "published", "publishedlist", {}, "");
      const rows = list.state === "ok" && list.value && Array.isArray(list.value.cases) ? list.value.cases : [];
      const latest = {};
      rows.forEach(function (r) { if (r && r.case_id && !(latest[r.case_id] >= Number(r.edition))) latest[r.case_id] = Number(r.edition); });
      const held = function (id) { return !!(k.d && Array.isArray(k.d.findings) && k.d.findings.some(function (x) { return (x.finding || x.id) === id; })); };
      const published = [];
      Object.keys(latest).slice(0, 12).forEach(function (c) {
        const pc = P.later(cs, view, "case:" + c, "publishedcase", { id: c, edition: String(latest[c]) }, "");
        const fs = pc.state === "ok" && pc.value && Array.isArray(pc.value.findings) ? pc.value.findings : [];
        fs.forEach(function (f) { if (f && f.bundle_id) published.push(f); });
      });
      if (ql.state === "loading" || list.state === "loading") return "";
      const isPublished = function (id) { return published.some(function (f) { return f.bundle_id === id; }); };
      const opts = [];
      const add = function (id, title) { if (id && !opts.some(function (o) { return o.value === id; })) opts.push({ value: id, text: title || id, on: held(id) }); };
      qs.forEach(function (q) { if (q && q.stance === "concluded" && (isPublished(q.inquiry) || held(q.inquiry))) add(q.inquiry, q.title); });
      published.forEach(function (f) { add(f.bundle_id, f.title); });
      (k.d && Array.isArray(k.d.findings) ? k.d.findings : []).forEach(function (x) { add(x.finding || x.id, ""); });
      const notYet = qs.filter(function (q) { return q && q.stance === "concluded" && q.inquiry && !opts.some(function (o) { return o.value === q.inquiry; }); });
      const apart = notYet.length ? '<ul class="mk-list" data-list="concluded-unpublished">' + notYet.map(function (q) {
        return "<li>" + cs.esc(q.title || q.inquiry) + ' <span class="meta">' + cs.w("screen.matter.concluded.unpublished") + "</span></li>";
      }).join("") + "</ul>" : "";
      // R58 (DEC-438 C2a (2)): with no finding to rest on, the determination says so, above its Record button
      return (opts.length ? cs.checks("mt-d-findings", "screen.matter.f.findings", opts)
        : '<p class="mk-small">' + cs.w("screen.matter.f.findings") + '</p><p class="cs-state" data-state="empty">' + cs.w("screen.matter.determine.needscase") + "</p>") + apart;
    },
    // R50: what the breach did, recorded
    consForm: function (cs, view, k) {
      const P = view.parts;
      const ql = P.later(cs, view, "questions", "projectquestions", { project: k.project, limit: "200" }, "");
      const qs = ql.state === "ok" && ql.value && Array.isArray(ql.value.items) ? ql.value.items : [];
      // DEC-387 (B424): the kinds and units by the matter's own keys (`kind.*`, `unit.*`); a named person (`person`) takes a document's
      // passage naming them, which this form has no field for, so it is not offered (REPORT)
      const kinds = [["class", "screen.matter.kind.class"], ["fund", "screen.matter.kind.fund"], ["program", "screen.matter.kind.program"], ["service", "screen.matter.kind.service"],
        ["body", "screen.matter.kind.office"], ["other", "screen.matter.kind.other"]];
      const units = [["money", "screen.matter.unit.money"], ["benefits", "screen.matter.unit.benefits"], ["services", "screen.matter.unit.services"], ["time", "screen.matter.unit.time"], ["count", "screen.matter.unit.count"]];
      return cs.sec("act.consequencerecord.label.matter", P.note(cs, "screen.matter.each_part_says_what_was_done_and")
        + cs.choice("mt-c-std", "screen.matter.the_rule_it_breached", k.nc.map(function (s) { return { value: s.standard, text: P.cite(cs, view, s.standard) || s.standard }; }))
        + cs.choice("mt-c-kind", "screen.matter.who_or_what_was_affected", kinds)
        + cs.field("mt-c-desc", "screen.matter.f.describe", { rec: true }) + P.help(cs, view, "mt-c-desc", "consequencerecord", "affected")
        + cs.choice("mt-c-unit", "screen.matter.what_it_is_measured_in", units)
        + cs.field("mt-c-amt", "screen.matter.amount_or_the_lowest_and_highest_it") + cs.field("mt-c-from", "screen.explore.from", { type: "date" }) + cs.field("mt-c-to", "screen.request.to", { type: "date" })
        + cs.checks("mt-c-basis", "entity.naming.basis", [["computed", "screen.matter.worked_out_from_figures_in_the_record", true], ["assessed", "screen.matter.my_own_assessment_with_my_reason"], ["unknown", "screen.matter.unknown"]], { radio: true })
        + '<details class="mk-details"><summary>' + cs.w("screen.matter.if_you_assess_it_yourself") + "</summary>"
        + cs.field("mt-c-rat", "shell.reason", { rec: true, area: true }) + P.help(cs, view, "mt-c-rat", "consequencerecord", "rationale")
        + P.note(cs, "screen.matter.name_what_the_assessment_rests_on") + P.note(cs, "screen.matter.a_part_you_assess_is_shown_as") + "</details>"
        + cs.choice("mt-c-cause", "screen.matter.the_question_showing_the_harm_follows_from", [{ value: "", text: "" }].concat(qs.map(function (q) { return { value: q.inquiry, text: q.title || q.inquiry }; })))
        + P.note(cs, "screen.matter.without_a_concluded_question_the_part_is") + P.note(cs, "screen.matter.zero_is_recorded_as_no_harm_claimed")
        + '<div class="mk-acts">' + cs.act("consequencerecord", { tone: "primary" }) + "</div>");
    },
    // R50: a recorded part revised, with the reason; what is left empty is kept as it was. It offers the same how-it-is-known controls and the
    // question as the record form (fix round 10, diagnosis 11 §4): a part recorded as not assessed can become assessed from here.
    reviseForm: function (cs, view, k) {
      const P = view.parts;
      const ql = P.later(cs, view, "questions", "projectquestions", { project: k.project, limit: "200" }, "");
      const qs = ql.state === "ok" && ql.value && Array.isArray(ql.value.items) ? ql.value.items : [];
      return cs.sec("act.consequencerevise.label.matter", P.note(cs, "screen.matter.change_what_is_wrong_say_why_then")
        + cs.choice("mt-r-part", "screen.matter.consequences", k.parts.map(function (p) { return { value: p.id, text: p.affected && (p.affected.name || p.affected.description) || p.id }; }))
        + cs.field("mt-r-desc", "screen.matter.who_or_what_was_affected") + cs.field("mt-r-amt", "screen.matter.amount_or_the_lowest_and_highest_it")
        + cs.field("mt-r-from", "screen.explore.from", { type: "date" }) + cs.field("mt-r-to", "screen.request.to", { type: "date" })
        + cs.checks("mt-r-basis", "entity.naming.basis", [["computed", "screen.matter.worked_out_from_figures_in_the_record"], ["assessed", "screen.matter.my_own_assessment_with_my_reason"], ["unknown", "screen.matter.unknown"]], { radio: true })
        + '<details class="mk-details"><summary>' + cs.w("screen.matter.if_you_assess_it_yourself") + "</summary>"
        + cs.field("mt-r-rat", "shell.reason", { rec: true, area: true })
        + P.note(cs, "screen.matter.name_what_the_assessment_rests_on") + P.note(cs, "screen.matter.a_part_you_assess_is_shown_as") + "</details>"
        + cs.choice("mt-r-cause", "screen.matter.the_question_showing_the_harm_follows_from", [{ value: "", text: "" }].concat(qs.map(function (q) { return { value: q.inquiry, text: q.title || q.inquiry }; })))
        + P.note(cs, "screen.matter.without_a_concluded_question_the_part_is")
        + cs.field("mt-r-why", "screen.matter.why_you_are_revising_it", { rec: true }) + P.help(cs, view, "mt-r-why", "consequencerevise", "reason")
        + '<div class="mk-acts">' + cs.act("consequencerevise", {}) + "</div>");
    },
    // R50: whether a part was addressed, with evidence and a reason
    addressedForm: function (cs, view, k) {
      const P = view.parts;
      return cs.sec("act.addressedrecord.label.matter", P.note(cs, "screen.matter.one_part_at_a_time_with_evidence")
        + cs.choice("mt-a-part", "screen.matter.f.part", k.parts.map(function (p) { return { value: p.id, text: p.affected && (p.affected.name || p.affected.description) || p.id }; }))
        + cs.checks("mt-a-state", "screen.matter.f.partwas", [["addressed", "screen.matter.f.addressed", true], ["not_addressed", "screen.matter.f.notaddressed"]], { radio: true })
        + cs.checks("mt-a-words", "screen.matter.in_what_way_addressed_only", [["remedied", "label.harmaddressed.remedied"], ["mitigated", "label.harmaddressed.mitigated"], ["compensated", "label.harmaddressed.compensated"],
          ["acknowledged", "label.harmaddressed.acknowledged"], ["cannot_be_undone", "screen.matter.way.cannot"]])
        + cs.field("mt-a-ev", "screen.published.evidence", { area: true })
        + cs.field("mt-a-why", "shell.reason", { rec: true, area: true }) + P.help(cs, view, "mt-a-why", "addressedrecord", "reason")
        + P.note(cs, "screen.matter.there_is_no_percentage_of_redress") + P.note(cs, "screen.matter.part_of_a_remedy_does_not_end")
        + '<div class="mk-acts">' + cs.act("addressedrecord", { tone: "primary" }) + "</div>");
    },
    // R50: a success recognised
    successForm: function (cs, view, k) {
      const P = view.parts;
      return cs.sec("act.successrecord.label.matter", P.note(cs, "screen.matter.a_change_the_matter_brought_about_in")
        + cs.field("mt-s-st", "screen.case-editor.changed.label", { rec: true, area: true }) + P.help(cs, view, "mt-s-st", "successrecord", "statement")
        + cs.field("mt-s-on", "screen.matter.f.when", { type: "date" }) + cs.field("mt-s-ev", "screen.published.evidence", { area: true })
        + cs.field("mt-s-seq", "screen.matter.the_order_of_events_optional", { rec: true, area: true }) + P.help(cs, view, "mt-s-seq", "successrecord", "sequence")
        + P.note(cs, "screen.matter.the_order_of_events_is_shown_as")
        + '<details class="mk-details"><summary>' + cs.w("screen.matter.if_you_say_why_it_happened") + "</summary>"
        + cs.field("mt-s-cause", "screen.matter.f.cause", { rec: true, area: true }) + P.help(cs, view, "mt-s-cause", "successrecord", "cause")
        + P.note(cs, "screen.matter.your_team_s_own_act_cannot_be") + "</details>"
        + '<div class="mk-acts">' + cs.act("successrecord", { tone: "primary" }) + "</div>");
    },
    // R51: an action attached to the stage the escalation stands at
    attachForm: function (cs, view, k) {
      const P = view.parts;
      const al = P.later(cs, view, "actions", "actions", { determination: k.det, limit: "200" }, "");
      const items = al.state === "ok" && al.value && Array.isArray(al.value.items) ? al.value.items : [];
      const seven = k.stage === 7;
      const purposes = [["official_request", "screen.matter.f.purpose.official"], ["oversight_request", "screen.matter.f.purpose.oversight"], ["audit_request", "screen.matter.f.purpose.audit"],
        ["testimony", "screen.matter.f.purpose.testimony"], ["enforcing_legislation", "screen.matter.f.purpose.legislation"]];
      return cs.sec("act.escalationattach.label.matter", cs.choice("mt-t-act", "home.area.action", items.map(function (a) { return { value: a.id, text: a.title || a.id }; }))
        + cs.field("mt-t-why", "screen.matter.your_reason_for_attaching_it", { rec: true }) + P.help(cs, view, "mt-t-why", "escalationattach", "reason")
        + (seven ? '<details class="mk-details" open><summary>' + cs.w("screen.matter.at_stage_7_political_accountability") + "</summary>"
          + cs.choice("mt-t-purpose", "screen.matter.f.purpose", purposes)
          + cs.checks("mt-t-std", "screen.matter.the_rule_it_seeks_enforced", k.nc.map(function (s) { return { value: s.standard, text: P.cite(cs, view, s.standard) || s.standard, on: true }; })) + "</details>" : "")
        + P.note(cs, "screen.matter.only_a_breach_action_that_rests_on")
        + '<div class="mk-acts">' + cs.act("escalationattach", { tone: "primary" }) + "</div>");
    },
    // R51: hold at the stage proposed, with a reason; a different act from declining to escalate at all
    holdForm: function (cs, view, k) {
      const P = view.parts;
      const to = Number(k.prop.to || k.prop.stage) || 1;
      return cs.sec("act.escalationdecline.label.matter", P.note(cs, "screen.matter.you_can_move_to_it_or_hold")
        + cs.field("mt-h-why", "screen.matter.why_you_are_holding_at_this_stage", { rec: true }) + P.help(cs, view, "mt-h-why", "escalationdecline", "reason")
        + '<div class="mk-acts">' + cs.act("escalationdecline", { data: { to: String(to) } }) + "</div>"
        + P.note(cs, "screen.matter.holding_keeps_the_proposal_in_view_with") + P.note(cs, "screen.matter.the_escalation_stays_open"));
    },
    suspendForm: function (cs, view, k) {
      const P = view.parts;
      return cs.sec("screen.matter.pause", cs.field("mt-p-why", "screen.matter.why_you_are_suspending_it", { rec: true }) + P.help(cs, view, "mt-p-why", "escalationsuspend", "reason")
        + '<div class="mk-acts">' + cs.act("escalationsuspend", {}) + "</div>"
        + P.note(cs, "screen.matter.a_suspended_escalation_proposes_no_stage") + P.note(cs, "screen.matter.it_is_not_ended_and_any_deadline"));
    },
    resumeForm: function (cs, view, k) {
      const P = view.parts;
      return cs.sec("act.escalationresume.label.matter", P.note(cs, "screen.matter.no_stage_is_proposed_while_it_is") + P.note(cs, "screen.matter.nothing_already_recorded_is_lost")
        + cs.field("mt-u-why", "screen.matter.why_you_are_resuming_it_optional", { rec: true }) + P.help(cs, view, "mt-u-why", "escalationresume", "reason")
        + '<div class="mk-acts">' + cs.act("escalationresume", { tone: "primary" }) + "</div>");
    },
    // R51: the government's response, read at the response evaluation stage; the replies are the received entries of the attached actions
    evalForm: function (cs, view, k) {
      const P = view.parts;
      const attached = Array.isArray(k.e.actions) ? k.e.actions : [];
      const opts = [];
      attached.forEach(function (a) {
        const r = P.later(cs, view, "reply:" + a.action, "action", { id: a.action }, "");
        const corr = r.state === "ok" && r.value && Array.isArray(r.value.correspondence) ? r.value.correspondence : [];
        corr.forEach(function (c) { if (c.direction === "received") opts.push({ value: a.action + "|" + c.ord, text: [c.party, c.at].filter(Boolean).join(", ") || a.action }); });
      });
      return cs.sec("act.escalationevaluate.label.matter", cs.choice("mt-e-resp", "screen.matter.the_response_you_are_reading", [["none", "screen.matter.reading.none"]].concat(opts))
        + cs.choice("mt-e-read", "question.conclude.own.field", [["complied", "screen.matter.reading.complied"], ["partial", "screen.matter.reading.partial"], ["denied", "screen.matter.reading.denied"], ["none", "screen.matter.no_response_by_the_deadline"]])
        + cs.field("mt-e-why", "shell.reason", { rec: true }) + P.help(cs, view, "mt-e-why", "escalationevaluate", "reason")
        + P.note(cs, "screen.matter.a_reading_of_complied_does_not_end") + P.note(cs, "screen.matter.it_ends_only_when_compliance_is_restored")
        + '<div class="mk-acts">' + cs.act("escalationevaluate", { tone: "primary" }) + "</div>");
    },
    // R45 (b): no determination yet: the acts that need one, each saying why
    unavailable: function (cs, view) {
      return cs.sec("screen.matter.unavailable", cs.sheet(cs.row("", "<b>" + cs.w("act.escalationopen.label.matter") + "</b>", "", cs.w("screen.matter.needs_a_recorded_determination_that_the_act"))
        + cs.row("", "<b>" + cs.w("screen.matter.saying_what_the_breach_did") + "</b>", "", cs.w("screen.matter.needs_the_same_determination"))
        + cs.row("", "<b>" + cs.w("screen.matter.attaching_an_action_holding_at_a_stage") + "</b>", "", cs.w("screen.matter.needs_an_escalation_which_needs_the_same"))));
    },
    // the chosen form, under the choice of what to do
    doing: function (cs, view, k, first) {
      const P = view.parts;
      const list = P.modes(cs, view, k);
      if (!list.length) return "";
      const has = Object.hasOwn(view.ui, "mode");
      const mode = has ? view.ui.mode : first ? list[0][0] : "";
      const pick = list.length > 1 || !first ? cs.choice("mt-mode", "screen.plan.choose", [{ value: "", text: "" }].concat(list.map(function (m) { return [m[0], m[1]]; })), { redraw: "mode", value: mode }) : "";
      const form = !list.some(function (m) { return m[0] === mode; }) ? ""
        : mode === "determine" ? P.detForm(cs, view, k) : mode === "consequencerecord" ? P.consForm(cs, view, k) : mode === "consequencerevise" ? P.reviseForm(cs, view, k)
        : mode === "addressedrecord" ? P.addressedForm(cs, view, k) : mode === "successrecord" ? P.successForm(cs, view, k) : mode === "escalationattach" ? P.attachForm(cs, view, k)
        : mode === "escalationdecline" ? P.holdForm(cs, view, k) : mode === "escalationsuspend" ? P.suspendForm(cs, view, k) : mode === "escalationresume" ? P.resumeForm(cs, view, k)
        : mode === "escalationevaluate" ? P.evalForm(cs, view, k) : "";
      return pick + form;
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const det = P.det(view);
    // R45 (b): a project's matter with no determination yet
    if (P.isProject(view)) return cs.state("determinations", function (l) {
      const k = P.ctx(view);
      const live = Array.isArray(l.items) ? l.items : [];
      const head = P.readOnly(cs, "screen.matter.name") + cs.title(null) + (live.length ? "" : '<p class="mk-sub">' + cs.w("screen.matter.nodet") + "</p>");
      const links = live.length ? cs.sheet(live.map(function (x) {
        // R56 (walk E C2b): each standard's outcome as the determination states it (`outcomes`, conformance R11), by the standard's citation
        const outs = (Array.isArray(x.outcomes) ? x.outcomes : []).map(function (o) {
          return "<b>" + cs.esc(P.cite(cs, view, o.standard) || o.standard) + "</b> · " + cs.w("screen.matter.outcome." + P.outcome(o.outcome));
        }).join("<br>");
        return cs.row("", '<a class="cs-ref" href="/app/matter/' + encodeURIComponent(x.id) + '" data-nav>' + (cs.esc(P.actName(cs, x)) || cs.w("screen.matter.name")) + "</a>", outs, "");
      }).join("")) : "";
      return head + cs.sec("screen.matter.where_this_matter_stands", (live.length ? "" : P.note(cs, "screen.matter.your_team_has_not_yet_said_whether") + P.note(cs, "screen.matter.what_a_breach_did_and_every_stage"))
        + links + (live.length ? "" : P.unavailable(cs, view)) + P.doing(cs, view, k, true));
    }, { empty: "state.empty" });
    return cs.state("determination", function (d) {
      const act = d.act || {};
      const actor = act.actor ? [act.actor.role, act.actor.body].filter(Boolean).join(", ") : "";
      // R18 (fix round 10; diagnosis 11 §7a): the act is named by the kind of event, its day and the office, never by the event's id
      const named = [P.actName(cs, d, true)].filter(Boolean).map(cs.esc);
      const head = P.readOnly(cs, "screen.matter.name") + cs.title(null) + '<p class="mk-sub">' + named.concat(actor ? [cs.w("screen.matter.by", { actor: actor })] : []).join(" · ") + "</p>";

      // R6: the determination: each standard, what it requires and what the act did, its outcome, either way alike.
      const standards = Array.isArray(d.standards) ? d.standards : [];
      const detSec = !standards.length ? (d.live === false ? '<p class="mk-note">' + cs.w("screen.matter.notlive") + "</p>" : "") : cs.sec("screen.matter.determination", cs.sheet(standards.map(function (s) {
        const rows = Array.isArray(s.rows) ? s.rows : [];
        return cs.row("<b>" + cs.esc(P.cite(cs, view, s.standard)) + "</b>", rows.map(function (r) {
          return cs.w("screen.matter.requires", { requires: r.requires || "" }) + " · " + cs.w("screen.matter.did", { did: r.did || "" });
        }).join("<br>"), cs.w("screen.matter.outcome." + P.outcome(s.outcome)), "");
      }).join(""))
        + '<p class="mk-note">' + cs.w("screen.matter.samecare") + "</p>"
        + (d.live === false ? '<p class="mk-note">' + cs.w("screen.matter.notlive") + "</p>" : ""));

      // R6: the consequences: who or what, the measure and how it is known.
      const cn = view.data.consequences;
      const cons = cn && cn.state === "empty" ? "" : cs.sec("screen.matter.what_the_breach_did", cs.state("consequences", function (c) {
        return cs.sheet(c.parts.map(function (p) {
          return cs.row(P.affected(cs, p), P.measure(cs, p), '<span class="meta">' + cs.w("screen.matter.known." + (["computed", "assessed"].includes(p.state) ? p.state : "undetermined"))
            + (P.labelOf(p) ? " · " + cs.esc(P.labelOf(p)) : "") + (P.causeOf(p) ? " · " + cs.esc(P.causeOf(p)) : "") + "</span>", "");
        }).join(""))
          + '<p class="mk-note">' + cs.w("screen.matter.neverzero") + "</p>";
      }));

      // R6: the escalation.
      const st = view.data.status;
      const status = st && st.state === "ok" ? st.value : null;
      const escs = status && Array.isArray(status.escalations) ? status.escalations : [];
      const live = escs.find(function (e) { return e.state !== "ended"; });
      const e = view.data.escalation;
      let escSec;
      if (e) {
        escSec = cs.state("escalation", function (x) {
          const stage = Number(x.stage) || 1;
          const ladder = '<ol class="cs-ladder" data-ladder="stage">' + [1, 2, 3, 4, 5, 6, 7].map(function (n) {
            return "<li" + (n === stage ? ' aria-current="step"' : "") + ">" + cs.w("screen.matter.stage." + n) + "</li>";
          }).join("") + "</ol>";
          const prop = Array.isArray(x.proposed) && x.proposed.length ? x.proposed[0] : null;
          const proposed = prop ? '<p class="mk-note">' + cs.w("screen.matter.proposed", { stage: { html: cs.w("screen.matter.stage." + (Number(prop.to || prop.stage) || 1)) } })
            + (prop.says ? " · " + cs.esc(prop.says) : "") + "</p>" : "";
          const open = x.state === "open";
          const stopped = x.state === "stopped_pursuing";
          const to = prop ? Number(prop.to || prop.stage) : stage + 1;
          const acts = open ? cs.act("escalationadvance", { label: "screen.matter.advance", fills: { stage: { html: cs.w("screen.matter.stage." + (to >= 1 && to <= 7 ? to : 1)) } }, data: { to: String(to) } })
            + cs.act("escalationend", {}) + cs.act("escalationstoppursuing", {})
            : stopped ? cs.act("escalationreopen", {}) : "";
          const exit = x.exit ? '<ul class="mk-list"><li>' + cs.w("screen.matter.exit.compliance") + " · " + cs.esc(typeof x.exit.compliance === "object" && x.exit.compliance ? x.exit.compliance.says || x.exit.compliance.state || "" : String(x.exit.compliance || ""))
            + "</li><li>" + cs.w("screen.matter.exit.consequences") + " · " + cs.esc(typeof x.exit.consequences === "object" && x.exit.consequences ? x.exit.consequences.says || x.exit.consequences.state || "" : String(x.exit.consequences || "")) + "</li></ul>" : "";
          const actions = Array.isArray(x.actions) && x.actions.length ? cs.sheet(x.actions.map(function (a) {
            return cs.row("", '<a class="cs-ref" href="/app/action/' + encodeURIComponent(a.action) + '" data-nav>' + cs.esc(a.action) + "</a>",
              '<span class="meta">' + cs.w("screen.matter.atstage", { stage: { html: cs.w("screen.matter.stage." + (Number(a.stage) || 1)) } }) + "</span>", "");
          }).join("")) : "";
          // R36: what is available, as `filings` answers it: `{kinds, determinations, says}`, one row per kind (a list of tools is read as before)
          const av = x.available;
          const kinds = Array.isArray(av) ? av : av && typeof av === "object" && Array.isArray(av.kinds) ? av.kinds : [];
          const rows = kinds.map(function (t) {
            return cs.row("", cs.esc(typeof t === "object" ? t.label || t.kind || t.venue || "" : String(t)), "", typeof t === "object" && t.words ? cs.esc(t.words) : "");
          }).join("");
          const says = av && !Array.isArray(av) && typeof av === "object" && !kinds.length && typeof av.says === "string" && av.says ? '<p class="mk-note">' + cs.esc(av.says) + "</p>" : "";
          const avail = av && (rows || says) ? (rows ? '<p class="mk-note">' + cs.w("screen.matter.available") + "</p>" + cs.sheet(rows) : "") + says : "";
          return '<p class="mk-sub">' + cs.w("screen.matter.escstate." + (["open", "suspended", "stopped_pursuing", "ended"].includes(x.state) ? x.state : "open")) + "</p>"
            + ladder + proposed + '<div class="mk-acts">' + acts + "</div>"
            + (exit ? "<h3>" + cs.w("screen.matter.endswhen") + "</h3>" + exit : "")
            + (actions ? "<h3>" + cs.w("screen.matter.actions") + "</h3>" + actions : "") + avail;
        });
      } else {
        escSec = cs.state("status", function () {
          const list = escs.length ? cs.sheet(escs.map(function (x) {
            return cs.row("", '<a class="cs-ref" href="/app/matter/' + encodeURIComponent(det + "~" + x.id) + '" data-nav>' + cs.w("screen.matter.openesc") + "</a>",
              '<span class="meta">' + cs.w("screen.matter.stage." + (Number(x.stage) || 1)) + "</span>", "");
          }).join("")) : "";
          const declined = status && Array.isArray(status.declines) ? status.declines.filter(function (x) { return !x.superseded_by; }) : [];
          return list + (declined.length ? '<p class="mk-note">' + cs.w("screen.matter.declined", { reason: declined[declined.length - 1].reason || "" }) + "</p>" : "")
            // re-walk 10 N8: an escalation is opened, or declined, only on a determination that found an act noncompliant (the row `unavailable` states);
            // a determination of compliant outcomes alone offers neither, and says what they need
            + (live ? "" : P.ctx(view).nc.length ? '<div class="mk-acts">' + cs.act("escalationopen", {}) + cs.act("declinetoescalate", {}) + "</div>" : P.unavailable(cs, view));
        });
      }
      const k = P.ctx(view);
      const doing = P.doing(cs, view, k, false);
      return head + detSec + cons + cs.sec("screen.matter.escalation", escSec) + (doing ? cs.sec("screen.matter.where_this_matter_stands", doing) : "");
    });
  },

  acts: [
    {
      // R6: open an escalation of this determination, with the member's reason (asked by the shell).
      op: "escalationopen",
      send: function (view) { return { body: { determination: view.parts.det(view) } }; },
      done: function (view, answer, cs) { if (answer && answer.id) cs.go("matter", view.parts.det(view) + "~" + answer.id); return { stay: true }; },
    },
    {
      op: "escalationadvance",
      send: function (view, el) { return { body: { id: String(view.subject).split("~")[1], to: Number(el.dataset.to) } }; },
    },
    {
      op: "declinetoescalate",
      send: function (view) { return { body: { determination: view.parts.det(view) } }; },
    },
    {
      // R6: terminal; its dialog states what ending does (`act.escalationend.does`).
      op: "escalationend",
      send: function (view) { return { body: { id: String(view.subject).split("~")[1] } }; },
    },
    {
      op: "escalationstoppursuing",
      send: function (view) { return { body: { id: String(view.subject).split("~")[1] } }; },
    },
    {
      op: "escalationreopen",
      send: function (view) { return { body: { id: String(view.subject).split("~")[1] } }; },
    },

    {
      // R45: record a determination, or (with the one it replaces) revise it; exactly the fields `determine` declares
      op: "determine",
      // R56 (walk E C2a (1)): a standard whose binding on the body is undetermined is the owner's own refusal, drawn in its words with the owner's why
      // (its `detail` names why and that a member settles it in `standards`), the owner's own `detail` (the why); a standard that does not bind keeps the shell's words
      refusals: {
        STANDARD_BINDING_UNDETERMINED: function (r, cs) {
          // the refusal's own `detail` is the member's sentence (conformance localizes it, naming why and that a member settles it in `standards`)
          return cs.esc(typeof r.detail === "string" && r.detail ? r.detail : r.translation || "");
        },
      },
      // R56 (walk E C2b): recording one goes to its page
      done: function (view, answer, cs) { if (answer && typeof answer.id === "string" && answer.id) cs.go("matter", answer.id); return { stay: true }; },
      send: async function (view, el, cs) {
        const P = view.parts, k = P.ctx(view);
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const standard = line(cs.value("mt-d-std"));
        const outcome = (cs.value("mt-d-out") || [])[0] || "";
        // C6: the event, the passages and the findings are chosen; one not chosen is refused in the words of the refusal that names it
        const event = line(cs.value("mt-d-event"));
        const chosen = P.ids(cs.value("mt-d-evidence"));
        const findings = P.ids(cs.value("mt-d-findings"));
        const prior = k.d && k.d.act && Array.isArray(k.d.act.evidence) ? k.d.act.evidence : [];
        if (!event) return { refuse: "refusal.NO_SUCH_EVENT" };
        if (!chosen.length && !prior.length) return { refuse: "refusal.ACT_INCOMPLETE" };
        if (!findings.length) return { refuse: "refusal.NO_FINDINGS" };
        // each chosen document is marked citable as a whole passage; the content ids the plane answers are the act's evidence
        const evidence = [];
        for (const doc of chosen) {
          const a = await cs.call("contentmint", { body: { bundleId: doc, extent: { kind: "document" } } }).then(function (x) { return x; }, function () { return null; });
          const r = a && a.result !== undefined ? a.result : a;
          const id = r && r.ok !== false ? r.content_id || r.id : "";
          if (!id) return { refuse: "refusal.ACT_INCOMPLETE" };
          evidence.push(String(id));
        }
        const body = {
          project: k.project,
          act: { event: event, actor: { role: line(cs.value("mt-d-role")), body: line(cs.value("mt-d-body")) }, evidence: evidence.length ? evidence : prior },
          findings: findings.map(function (f) { return { finding: f }; }),
          standards: [{ standard: standard, outcome: outcome }],
          rows: [{ standard: standard, requires: line(cs.value("mt-d-req")), did: line(cs.value("mt-d-did")), reading: line(cs.value("mt-d-rd")) }],
        };
        const q = line(cs.value("mt-d-q"));
        if (outcome === "unclear" && q) body.questions = [{ question: q }];
        const cause = line(cs.value("mt-d-cause"));
        if (cause) body.cause = { statement: cause, evidence: body.act.evidence };
        if (!P.isProject(view) && k.d) {
          // what replaces it is said in the reason the shell asks (a reasoned act), added to the body as `reason`
          body.supersedes = k.det;
        }
        return { body: body };
      },
    },
    {
      // R50: what the breach did, with how it is known; exactly the fields `consequencerecord` declares
      op: "consequencerecord",
      send: function (view, el, cs) {
        const P = view.parts, k = P.ctx(view);
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const how = (cs.value("mt-c-basis") || [])[0] || "unknown";
        const measure = P.amount(line(cs.value("mt-c-unit")), cs.value("mt-c-amt"));
        const body = {
          determination: k.det, standard: line(cs.value("mt-c-std")),
          affected: { kind: line(cs.value("mt-c-kind")), description: line(cs.value("mt-c-desc")) },
          period: { from: line(cs.value("mt-c-from")), to: line(cs.value("mt-c-to")) },
        };
        if (measure) body.measure = measure;
        body.basis = how === "assessed" ? { rationale: line(cs.value("mt-c-rat")), rests_on: [] } : how === "computed" ? { op: "sum", operands: [] } : { why: "not_assessed" };
        const cause = line(cs.value("mt-c-cause"));
        if (cause) body.causation = cause;
        return { body: body };
      },
    },
    {
      // R50: a recorded part revised, with the reason; only what the member changed is sent
      op: "consequencerevise", reasonField: "reason",
      send: function (view, el, cs) {
        const P = view.parts, k = P.ctx(view);
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const id = line(cs.value("mt-r-part"));
        const part = k.parts.find(function (p) { return p.id === id; }) || {};
        const body = { id: id, reason: line(cs.value("mt-r-why")) };
        const desc = line(cs.value("mt-r-desc"));
        if (desc) body.affected = { kind: (part.affected && part.affected.kind) || "other", description: desc };
        const unit = part.measure && typeof part.measure === "object" && part.measure.unit ? part.measure.unit : "money";
        const measure = P.amount(unit, cs.value("mt-r-amt"));
        if (measure) body.measure = measure;
        const from = line(cs.value("mt-r-from")), to = line(cs.value("mt-r-to"));
        if (from || to) body.period = { from: from, to: to };
        // fix round 10 (diagnosis 11 §4): how it is known and the question, sent when she changes them (the same shapes `consequencerecord` sends)
        const how = (cs.value("mt-r-basis") || [])[0] || "";
        if (how) body.basis = how === "assessed" ? { rationale: line(cs.value("mt-r-rat")), rests_on: [] } : how === "computed" ? { op: "sum", operands: [] } : { why: "not_assessed" };
        const cause = line(cs.value("mt-r-cause"));
        if (cause) body.causation = cause;
        return { body: body };
      },
    },
    {
      // R50: whether a part was addressed, with evidence and the reason; words only for an addressed part
      op: "addressedrecord", reasonField: "reason",
      send: function (view, el, cs) {
        const P = view.parts;
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const state = (cs.value("mt-a-state") || [])[0] || "";
        const body = { id: line(cs.value("mt-a-part")), state: state, evidence: P.ids(cs.value("mt-a-ev")), reason: line(cs.value("mt-a-why")) };
        const words = cs.value("mt-a-words") || [];
        if (state === "addressed" && words.length) body.words = words;
        return { body: body };
      },
    },
    {
      // R50: a success recognised; exactly the fields `successrecord` declares
      op: "successrecord",
      send: function (view, el, cs) {
        const P = view.parts, k = P.ctx(view);
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const evidence = P.ids(cs.value("mt-s-ev"));
        const body = { project: k.project, statement: line(cs.value("mt-s-st")), changed_on: line(cs.value("mt-s-on")), evidence: evidence };
        const seq = line(cs.value("mt-s-seq"));
        if (seq) body.sequence = seq;
        const cause = line(cs.value("mt-s-cause"));
        if (cause) body.cause = { statement: cause, evidence: evidence };
        return { body: body };
      },
    },
    {
      // R51: an action attached to this stage; at the political accountability stage with its purpose and the rules it seeks enforced
      op: "escalationattach", reasonField: "reason",
      send: function (view, el, cs) {
        const line = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
        const body = { id: String(view.subject).split("~")[1], action: line(cs.value("mt-t-act")), reason: line(cs.value("mt-t-why")) };
        const purpose = line(cs.value("mt-t-purpose"));
        if (purpose) body.purpose = purpose;
        const std = cs.value("mt-t-std");
        if (Array.isArray(std) && std.length) body.standards = std;
        return { body: body };
      },
    },
    {
      // R51: hold at the stage proposed, with a reason: the escalation stays open, which declining to escalate never does
      op: "escalationdecline", reasonField: "reason",
      send: function (view, el, cs) {
        return { body: { id: String(view.subject).split("~")[1], to: Number(el.dataset.to), reason: String(cs.value("mt-h-why") || "").trim() } };
      },
    },
    {
      op: "escalationsuspend", reasonField: "reason",
      send: function (view, el, cs) { return { body: { id: String(view.subject).split("~")[1], reason: String(cs.value("mt-p-why") || "").trim() } }; },
    },
    {
      // R51: resume at the same stage; the reason is optional
      op: "escalationresume",
      send: function (view, el, cs) {
        const body = { id: String(view.subject).split("~")[1] };
        const why = String(cs.value("mt-u-why") || "").trim();
        if (why) body.reason = why;
        return { body: body };
      },
    },
    {
      // R51: the government's response, read; a response is named only with a reading other than none
      op: "escalationevaluate", reasonField: "reason",
      send: function (view, el, cs) {
        const reading = String(cs.value("mt-e-read") || "");
        const resp = String(cs.value("mt-e-resp") || "");
        const body = { id: String(view.subject).split("~")[1], reading: reading, reason: String(cs.value("mt-e-why") || "").trim() };
        if (reading !== "none" && resp && resp !== "none") body.response = { action: resp.split("|")[0], ord: Number(resp.split("|")[1]) };
        return { body: body };
      },
    },
    WRITE_HELP,
  ],
});
