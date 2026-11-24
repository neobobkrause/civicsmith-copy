/* Start and send (registry screen `start-send`; screens-action R2, R3, R7; DEC-115; v0.2 rules 1–3, 19). Projects ›
   <project> › Action plan › Start and send. Step 1 (subject `<plan>~<option>`): what starting does, first, with every
   refusal it would meet, each resolved in place; nothing runs before the member's confirm. Step 2 (subject the action
   started): prepare what is sent, approve it, give the second approval where the project asks one, and record the
   sending. Every function here is self-contained (interface-shell R21 (1)). */
import { OPS } from "../op-declarations/index.mjs";
import { later, actName, citeOf, languagesOf, marksFields, marksBody, draftsOf, stepOf, sendSteps, draftOf, readFiling, stakeLines, stakeAsk, readOnly, kindWord, kindsOf, officeLine, joinFirst, PREPARE, PREPARE_FILING, APPROVE, STAKE, SECOND, RECORD_SENT, TEMPLATE_SAVE, JOIN, WRITE_HELP } from "./send-steps.mjs";

// R21: `actionstake` is an owed act (`interface-shell` R73): it is registered once `op-declarations` declares it, and the
// shell draws it as it draws every act (R12).
const OWED = function (spec) { return Object.hasOwn(OPS, spec.op) ? [spec] : []; };

export const startSend = Object.freeze({
  id: "start-send",

  place: function (view) {
    // step 1 reads the plan, step 2 the action; both name their project, whose title `list` answers (C62)
    const p = String(view.subject || "").indexOf("~") < 0 ? view.data.action : view.data.plan;
    const v = p && p.state === "ok" ? p.value : null;
    if (!v || !v.project) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === v.project; });
    return { project: { id: v.project, title: (hit && hit.title) || v.project } };
  },

  reads: function (view) {
    const s = String(view.subject || "");
    const at = s.indexOf("~");
    if (at < 0) return {
      action: { op: "action", query: { id: s }, subject: true },
      filings: { op: "filingsfor", query: { action: s }, empty: function () { return false; } },
      // R21: the matter's stake and whether the question is asked (`filings` R60 to R62), and the team's name
      stake: { op: "stakeatpreparation", query: { action: s }, empty: function () { return false; } },
      identity: { op: "groupidentity", empty: function () { return false; } },
      vocab: { op: "affordances", query: {}, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      // R3 (filings R43, R44): the language the draft is prepared in is the member's, among the team's
      mylang: { op: "memberlanguage", empty: function () { return false; } },
      languages: { op: "grouplanguages", empty: function () { return false; } },
      // E9 (K4557): her own place in the action's project (`participation`): an invited member is told at the start, not refused at the end
      standing: { op: "projectlist", query: {}, empty: function () { return false; } },
    };
    const plan = s.slice(0, at), option = s.slice(at + 1);
    const body = { plan: plan, option: option, kind: view.ui.kind || "records_request", breach: view.ui.breach === true };
    if (view.ui.override) body.premise_override = { reason: view.ui.override };
    return {
      plan: { op: "plan", query: { id: plan }, subject: true },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      preview: { op: "optionstartpreview", body: body },
      // R47: the members the team's contact is chosen from (`memberlist`); a roster that cannot be read offers no one
      roster: { op: "memberlist", empty: function () { return false; } },
      vocab: { op: "affordances", query: {}, empty: function () { return false; } },
    };
  },

  parts: {
    draftsOf: draftsOf, stepOf: stepOf, sendSteps: sendSteps, draftOf: draftOf, readFiling: readFiling,
    languagesOf: languagesOf, marksFields: marksFields, marksBody: marksBody, later: later, actName: actName, citeOf: citeOf,
    // R18 (fix round 10; diagnosis 11 §7a): what an option rests on, named as the record names it: a question by its title, a determination by its act
    // (day and office), a standard by its citation; "" while the record has not answered, never the id
    subjectName: function (cs, view, sub) {
      const P = view.parts;
      const pl = view.data.plan && view.data.plan.state === "ok" ? view.data.plan.value : null;
      const project = pl && typeof pl.project === "string" ? pl.project : "";
      if (!project || !sub) return "";
      const items = function (st) { return st.state === "ok" && st.value && Array.isArray(st.value.items) ? st.value.items : []; };
      if (sub.kind === "outcome" && sub.determination) {
        const d = items(P.later(cs, view, "determinations", "determinations", { project: project, live: "true", limit: "200" }, "")).find(function (x) { return x.id === sub.determination; });
        const c = sub.standard ? P.citeOf(items(P.later(cs, view, "standards", "standards", { limit: "200" }, "")), sub.standard) : "";
        return [d ? P.actName(cs, d) : "", c].filter(Boolean).join(" \u00b7 ");
      }
      const q = sub.inquiry ? items(P.later(cs, view, "questions", "projectquestions", { project: project, limit: "200" }, "")).find(function (x) { return x.inquiry === sub.inquiry; }) : null;
      return q && typeof q.title === "string" ? q.title : "";
    },
    stakeLines: stakeLines, stakeAsk: stakeAsk,
    // R48: the approved filing kept as the team's template, from the approval on (the step is second, send or sent). A filing
    // that needs counsel first (a tier of 3, read from the draft, the action or the stake read) is offered only as a brief.
    templateKeep: function (cs, view, d, step) {
      if (step !== "second" && step !== "send" && step !== "sent") return "";
      const held = d.open || d.sent;
      const save = held && held.filing ? cs.act("templatesave", { data: { filing: held.filing } }) : "";
      if (!save) return "";
      const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : {};
      const st = view.data.stake && view.data.stake.state === "ok" && view.data.stake.value ? view.data.stake.value : {};
      const counsel = held.tier === 3 || a.risk_tier === 3 || st.governing_tier === 3;
      const uses = (counsel ? [] : [["file", "screen.start-send.template.use.filing"]]).concat([["brief", "screen.start-send.template.use.brief"]]);
      const help = view.reachable ? cs.act("writinghelp", { data: { field: "notes", id: "template-notes", forop: "templatesave" } }) : "";
      return cs.sec("screen.start-send.template.heading", '<p class="mk-note">' + cs.w("screen.start-send.template.note1") + " " + cs.w("screen.start-send.template.note2") + " "
        + cs.w("screen.start-send.template.note3") + "</p>"
        + cs.field("template-name", "screen.start-send.template.name.label", { max: 200, help: ["screen.start-send.template.name.help1", "screen.start-send.template.name.help2"] })
        + cs.choice("template-use", "screen.start-send.template.use.label", uses, { value: counsel ? "brief" : "file" })
        + '<p class="mk-small">' + cs.w("screen.start-send.template.use.help2") + "</p>"
        + cs.field("template-notes", "screen.start-send.template.notes.label", { area: true, rec: true, help: "screen.start-send.template.notes.help" })
        + '<div class="mk-acts">' + save + help + "</div>");
    },
    isRequest: function () { return false; },
    readOnly: readOnly, kindWord: kindWord, kindsOf: kindsOf, officeLine: officeLine, joinFirst: joinFirst,
    // R2: the preview's answer drawn: the kind, the office by its role, what it rests on, the clock, the breach, and the
    // refusal it would meet, first.
    preview: function (cs, view, pv) {
      const a = pv && pv.action ? pv.action : {};
      const ad = a.addressee;
      const to = !ad ? cs.w("screen.start-send.noaddressee")
        : ad.state === "audience" ? cs.esc(ad.description || "")
          : cs.esc(view.parts.officeLine(ad)) + " · " + cs.w("screen.start-send.byrole");
      const legs = (Array.isArray(a.legs) ? a.legs : []).flatMap(function (l) { return l.subjects || []; });
      const rests = legs.length ? legs.map(function (s) {
        const name = view.parts.subjectName(cs, view, s.subject);
        return (name ? cs.esc(name) + " · " : "") + cs.w("screen.plan.support." + (["hypothetical", "established", "short"].includes(s.support) ? s.support : "undetermined"));
      }).join("<br>") : cs.w("screen.start-send.restsnothing");
      const clock = Array.isArray(a.clock) && a.clock.length ? a.clock.map(function (c) {
        return cs.date(c.date) + " · " + cs.esc(c.basis || "");
      }).join("<br>") : cs.w("screen.start-send.noclock");
      // R28: the kind in lower case by its key, a profile's own by its label (DEC-342: a refusal is read by `refusal.<CODE>`, else
      // the answer's own translation, else the shell's uncatalogued path; its builder's `detail` is never drawn)
      const voc = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      const kindName = view.parts.kindWord(cs, a.kind || "other", true, voc.action_kind_labels);
      const rf = pv && pv.refusal ? pv.refusal : null;
      const code = rf ? String(rf.code || rf.reason || "") : "";
      const refusalWords = !rf ? "" : code && cs.w("refusal." + code) !== cs.esc("refusal." + code) ? cs.w("refusal." + code)
        : typeof rf.translation === "string" && rf.translation ? cs.esc(rf.translation) : cs.w("refusal.uncatalogued") + (code ? " <code>" + cs.esc(code) + "</code>" : "");
      const refused = rf ? '<div class="cs-gap" data-gap="refused" role="alert"><b>' + cs.w("screen.start-send.wouldrefuse") + "</b><p>"
        + refusalWords + "</p><p>" + cs.w("screen.start-send.resolve") + "</p></div>" : "";
      return refused + '<dl class="mk-dl"><dt>' + cs.w("screen.start-send.kind") + "</dt><dd>" + kindName
        + "</dd><dt>" + cs.w("screen.start-send.to") + "</dt><dd>" + to
        + "</dd><dt>" + cs.w("screen.start-send.rests") + "</dt><dd>" + rests
        + "</dd><dt>" + cs.w("screen.start-send.clock") + "</dt><dd>" + clock
        + "</dd><dt>" + cs.w("screen.start-send.breach") + "</dt><dd>" + cs.w(a.breach ? "screen.start-send.breach.yes" : "screen.start-send.breach.no")
        + (a.premise_override ? " · " + cs.w("screen.start-send.override.stated") : "") + "</dd></dl>";
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const s = String(view.subject || "");
    if (s.indexOf("~") < 0) {
      // Step 2: the action started.
      return cs.state("action", function (a) {
        return P.readOnly(cs, "screen.start-send.name") + cs.title(null)
          + '<p class="mk-sub">' + cs.w("screen.start-send.titlestarted") + " · " + cs.esc(a.addressee ? P.officeLine(a.addressee) : "") + "</p>"
          + cs.sec("screen.start-send.step2", cs.state("filings", function (f) { return P.sendSteps(cs, view, f, {}); }));
      });
    }
    const option = s.slice(s.indexOf("~") + 1);
    return cs.state("plan", function (p) {
      const o = (p.options || []).find(function (x) { return x.id === option; });
      if (!o) return '<p class="cs-state" data-state="empty">' + cs.w("state.empty") + "</p>";
      const head = P.readOnly(cs, "screen.start-send.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.start-send.title", { option: o.summary || o.id }) + "</p>"
        + '<p class="mk-sub">' + cs.w("screen.start-send.nothingruns") + "</p>";
      if (o.action && o.action.id)
        return head + '<p class="mk-note">' + cs.w("screen.start-send.alreadystarted") + "</p>"
          + '<a class="cs-ref" href="/app/start-send/' + encodeURIComponent(o.action.id) + '" data-nav>' + cs.w("screen.start-send.tostep2") + "</a>";
      const pv = view.ui.preview || null;
      const shown = pv ? P.preview(cs, view, pv) : cs.state("preview", function (v) { return P.preview(cs, view, v); });
      const kinds = P.kindsOf(cs, view, true);
      // R47: the team's contact for the action, optional: no one first, then the active members the roster lists by handle
      const roster = view.data.roster && view.data.roster.state === "ok" && view.data.roster.value && Array.isArray(view.data.roster.value.members) ? view.data.roster.value.members : [];
      const contacts = [{ value: "", key: "screen.start-send.contact.none" }].concat(roster.filter(function (m) {
        return m && m.status === "active" && typeof m.member_id === "string" && typeof m.handle === "string" && m.handle.trim();
      }).map(function (m) { return { value: m.member_id, text: m.handle }; }));
      const form = cs.choice("start-kind", "screen.start-send.kind", kinds, { value: view.ui.kind || "records_request" })
        + cs.choice("start-contact", "screen.start-send.contact.label", contacts, { value: view.ui.contact || "" })
        + '<p class="mk-small">' + cs.w("screen.start-send.contact.help1") + " " + cs.w("screen.start-send.contact.help2") + " " + cs.w("screen.start-send.contact.help3") + "</p>"
        + cs.checks("start-breach", "screen.start-send.breach", [["yes", "screen.start-send.breach.tick", view.ui.breach === true]])
        + cs.field("start-override", "screen.start-send.override", { help: "screen.start-send.override.help", value: view.ui.override || "" })
        + '<div class="mk-acts">' + cs.act("optionstartpreview", { data: { option: option } })
        + cs.act("optionstart", { tone: "primary", data: { option: option } }) + "</div>";
      return head + cs.sec("screen.start-send.step1", shown + form);
    });
  },

  acts: [
    {
      // R2: what starting does, asked again with the kind, the breach and the reason the member set; writes nothing.
      op: "optionstartpreview",
      send: function (view, el, cs) {
        const s = String(view.subject);
        const kind = cs.value("start-kind") || "records_request";
        const breach = (cs.value("start-breach") || []).includes("yes");
        const override = String(cs.value("start-override") || "").trim();
        const body = { plan: s.slice(0, s.indexOf("~")), option: el.dataset.option, kind: kind, breach: breach };
        if (override) body.premise_override = { reason: override };
        view.ui.kind = kind; view.ui.breach = breach; view.ui.override = override;
        return { body: body };
      },
      rereads: [],
      done: function (view, answer, cs) { cs.set("preview", answer); },
    },
    {
      // R2: "Start the action" on the member's confirm (the shell asks her reason, sent as `why_first` where the option
      // goes out before its matter is documented); a refusal stays beside it, resolved in place.
      op: "optionstart",
      send: function (view, el, cs, extra) {
        const s = String(view.subject);
        const override = String(cs.value("start-override") || "").trim();
        const body = { plan: s.slice(0, s.indexOf("~")), option: el.dataset.option, kind: cs.value("start-kind") || "records_request",
          breach: (cs.value("start-breach") || []).includes("yes") };
        if (override) body.premise_override = { reason: override };
        if (extra && typeof extra.reason === "string" && extra.reason.trim()) body.why_first = extra.reason.trim().slice(0, 500);
        // R47: the team's contact, where one was chosen; the choice is kept while a refusal is resolved
        const contact = String(cs.value("start-contact") || "");
        if (contact) body.contact = contact;
        view.ui.contact = contact;
        return { body: body };
      },
      refusals: {
        // R47: the contact is not a member of the team (the design's words under "When the contact is not a member")
        CONTACT_NOT_A_MEMBER: function (refusal, cs) {
          return cs.w("screen.start-send.contact.refused.body1") + " " + cs.w("screen.start-send.contact.refused.body2");
        },
        // L20 (K4195): the code's words, then each finding's own detail as the record answers it (escaped record data)
        ACTION_BASIS_REFUSED: function (refusal, cs) {
          const found = Array.isArray(refusal.findings) ? refusal.findings.filter(function (f) { return f && typeof f.detail === "string" && f.detail.trim(); }) : [];
          // re-walk 10 N7: the owner's reasons are the answer when it gives them; the code's sentence (which ends "or leave it out") stays for a refusal with none
          if (found.length) return '<ul class="mk-list">' + found.map(function (f) { return "<li>" + cs.esc(f.detail) + "</li>"; }).join("") + "</ul>";
          return cs.w("refusal.ACTION_BASIS_REFUSED");
        },
      },
      done: function (view, answer, cs) { if (answer && answer.action) cs.go("start-send", answer.action); return { stay: true }; },
    },
    Object.assign({}, PREPARE, { rereads: ["filings"] }),
    Object.assign({}, PREPARE_FILING, { rereads: ["filings"] }),
    ...OWED(STAKE),
    Object.assign({}, APPROVE, { rereads: ["filings"] }),
    Object.assign({}, SECOND, { rereads: ["filings"] }),
    Object.assign({}, RECORD_SENT, { rereads: ["filings", "action"] }),
    TEMPLATE_SAVE,
    JOIN,
    WRITE_HELP,
  ],
});
