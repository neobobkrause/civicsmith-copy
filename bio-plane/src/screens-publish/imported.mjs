/* Another group's case (registry screen `imported`; R7; DEC-96, DEC-112): Projects › Imported › Another group's case,
 * drawn read-only in the imported band. The cases imported, and the one chosen: each finding with whether it recreated
 * here, in part, or not; importing a case, accepting what recreated with a reason, flagging an issue, watching the
 * publisher's docket. Its subject is an import's id (or none, for the list). Every function is self-contained
 * (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";

export const IMPORTED = Object.freeze({
  id: "imported",
  // R25: an import or edition the team does not hold is answered `IMPORT_NO_SUCH_EDITION` (`case-import` R4): "Nothing is here".
  ABSENT_CODES: Object.freeze(["IMPORT_NO_SUCH_EDITION"]),
  parts: PARTS,

  reads: function (view) {
    const r = { cases: { op: "importedcases", empty: function (v) { return !v || !Array.isArray(v.imports) || v.imports.length === 0; } } };
    const s = String(view.subject || "").split("/");
    if (s[0]) r.chosen = { op: "importedcase", query: Object.assign({ import: s[0] }, s[1] ? { edition: s[1] } : {}), subject: true };
    return r;
  },

  render: function (cs, view) {
    const P = view.parts, ui = view.ui;
    const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
    // 10B C6 (R6, R98): a case is named by its `scope` and a finding by its `title`, as case-import R4 answers them, never by an id: an
    // answer that states none is the screen's own name, and a finding with no title is "Finding n"
    const scopeOf = function (x) { return x && typeof x.scope === "string" && x.scope.trim() ? x.scope.trim() : ""; };
    const nameOf = function (f, i) { return f && typeof f.title === "string" && f.title.trim() ? cs.esc(f.title.trim()) : cs.w("screen.published.finding", { n: String(i + 1) }); };
    const out = [cs.title(c ? scopeOf(c) || null : null, { thing: "case" })];
    if (c) {
      const ed = c.edition || {};
      const group = String(c.group && (c.group.name || c.group.slug) || c.group || "");
      const findings = Array.isArray(ed.findings) ? ed.findings : [];
      const resultOf = function (f) { return f.result === "recreated" || f.result === "yes" ? "yes" : f.result === "partial" || f.result === "part" || f.result === "in_part" ? "part" : "no"; };
      const importer = ed.importer && ed.importer.handle ? ed.importer.handle : ed.imported_by ? cs.memberName(ed.imported_by) : ""; // C94: by handle, never the member id
      // R25: the band says whose case it is and how far it recreated here; the line beneath, who brought it in and when.
      // R20: no count at zero, so an edition with no finding listed draws no band.
      if (findings.length) out.push('<p class="mk-note" data-imported-band>' + cs.w("screen.imported.band", { group: group, edition: String(ed.edition || ""),
        recreated: String(findings.filter(function (f) { return resultOf(f) === "yes"; }).length), findings: String(findings.length) }) + "</p>");
      out.push('<p class="mk-sub">' + cs.mark("origin", "elsewhere") + " " + cs.w("screen.imported.from", { group: group,
        edition: String(ed.edition || ""), by: importer, at: { html: ed.imported_at ? cs.date(ed.imported_at) : "" } }) + "</p>");
      out.push(P.sec(cs, "screen.imported.findings", findings.length ? cs.sheet(findings.map(function (f, i) {
        const r = resultOf(f);
        const own = f.origin && f.origin.acceptance ? cs.mark("origin", "accepted") : f.origin && Array.isArray(f.origin.flags) && f.origin.flags.length ? cs.mark("origin", "flagged") : "";
        return cs.row("", '<span class="rec">' + nameOf(f, i) + "</span>",
          '<span class="cs-recreate" data-r="' + r + '">' + cs.w("screen.imported.result." + r) + "</span>", own);
      }).join("")) : ""));

      // R26 (N933; DEC-304 (4); DEC-323): whose stake this states: the source team's identity and declared stake as it
      // stated them when they were read, never this team's; an edition recorded without them says so in its fold, and a
      // stake stated in a form that cannot be read says so in its own, the other fields still drawn.
      const gf = ed.group_fields && typeof ed.group_fields === "object" ? ed.group_fields : null;
      const said = function (v) { return v && typeof v === "object" ? String(v.stake || v.text || "") : v ? String(v) : ""; };
      let stake;
      if (!gf) stake = P.fold(cs, "caseimport.notrecorded.summary", "<p>" + cs.w("case-import.group_fields_none") + "</p>");
      else {
        const matter = gf.matter_stake && typeof gf.matter_stake === "object" ? gf.matter_stake : null;
        const rows = [gf.name, gf.domain, said(gf.stake), gf.detail].filter(function (x) { return x !== null && x !== undefined && x !== ""; }).map(function (x) {
          return cs.row("", '<span class="rec">' + cs.esc(String(x)) + "</span>"); }).join("")
          + (matter ? cs.row("", cs.w("stake.inmatter") + ': <span class="rec">' + (matter.stake === "undetermined" ? cs.w("stake.unreadable") : cs.esc(said(matter))) + "</span>",
            matter.set_by || matter.set_at ? '<span class="meta">' + cs.w("stake.set", { who: matter.set_by ? cs.memberName(matter.set_by) : "", date: { html: matter.set_at ? cs.date(matter.set_at) : "" } }) + "</span>" : "") : "");
        stake = '<p class="mk-note" data-group-fields>' + cs.w("case-import.group_fields_label") + "</p>" + (rows ? cs.sheet(rows) : "")
          + (ed.group_fields_note ? P.fold(cs, "caseimport.unreadable.summary", "<p>" + cs.w("caseimport.stake.unreadable") + "</p>") : "");
      }
      out.push(cs.sec("caseimport.stake.heading", stake));

      out.push(cs.sec("screen.imported.accept", cs.field("im-checked", "screen.imported.checked.label", { area: true })
        + cs.field("im-reason", "screen.imported.reason.label", { area: true })
        + '<div class="mk-acts">' + cs.act("importaccept", { tone: "primary" }) + "</div>" + P.said(view, "importaccept")));
      // R55 (C51; DEC-374): an import some of whose findings the team accepted can have the acceptance withdrawn, with a reason; an
      // import with none accepted offers nothing. Rejecting an import and public acceptance with dependencies are not drawn.
      const accepted = findings.filter(function (f) { return f.origin && f.origin.acceptance; });
      if (accepted.length) out.push(cs.sec("screen.imported.accepted.heading", cs.field("im-withdraw", "screen.imported.withdraw.label", { area: true, help: "screen.imported.withdraw.help" })
        + '<div class="mk-acts">' + cs.act("importacceptwithdraw", { label: "screen.imported.withdraw.button" }) + "</div>" + P.said(view, "importacceptwithdraw")));
      // R58 (C49; DEC-378): "View under another lens": the edition's findings re-weighed under a lens the member chooses (none is
      // chosen for her), the findings that moved and the statement that moved each, and the limit sentence. Nothing is saved or sent.
      const lensKeys = [["as_published", "screen.imported.lens_as_published"], ["removed", "screen.imported.lens_removed"], ["own", "screen.imported.lens_own"]];
      const rg = ui.regrade && ui.regrade.import === c.import ? ui.regrade : null;
      const titleOf = function (id) { const i = findings.findIndex(function (x) { return x.finding === id; }); return i >= 0 ? nameOf(findings[i], i) : cs.w("screen.imported.findings"); };
      const pairOf = function (x) { return x && typeof x === "object" ? [x.capture, x.connection].filter(Boolean).join("/") || JSON.stringify(x) : x ? String(x) : ""; };
      out.push(cs.sec("act.owed_importregrade.label.imported", '<p class="mk-small">' + cs.w("screen.imported.lens_what") + "</p>"
        + cs.checks("im-lens", { key: "act.owed_importregrade.label.imported" }, lensKeys.map(function (k) { return [k[0], k[1], false]; }), { radio: true })
        + '<div class="mk-acts">' + cs.act("importregrade") + "</div>" + P.said(view, "importregrade")
        + (rg ? '<div data-regrade="' + cs.esc(rg.lens) + '"><p class="mk-small">' + cs.w("screen.imported.lens_does") + "</p>"
          + (rg.lens_note ? P.fold(cs, "screen.imported.lens_none_summary", "<p>" + cs.w("screen.imported.lens_none") + "</p>") : "")
          + (rg.lens === "undetermined" ? P.fold(cs, "screen.imported.lens_unreadable_summary", "<p>" + cs.w("screen.imported.lens_unreadable") + "</p>") : "")
          + cs.sheet((Array.isArray(rg.findings) ? rg.findings : []).map(function (f) {
            const why = Array.isArray(f.because) ? f.because : [];
            return cs.row("", '<span class="rec">' + titleOf(f.finding) + "</span>" + '<span class="meta" data-moved="' + (f.moved === true ? "yes" : "no") + '">'
              + (f.moved === true ? cs.w("screen.imported.lens_moved", { published: pairOf(f.published && f.published.pair), regraded: pairOf(f.pair) })
                + why.map(function (b) { return " " + cs.w("screen.imported.lens_because", { statement: b.text || b.statement || "", part: b.touched && b.touched.target ? b.touched.target : "" }); }).join("")
                : f.moved === false ? cs.w("screen.imported.lens_unmoved") : "") + "</span>", "");
          }).join("")) + (rg.limit ? '<p class="mk-note" data-limit>' + cs.esc(rg.limit) + "</p>" : "") + "</div>" : "")));

      // R58: "Re-run this work in your own project": one of the team's projects declared a rerun of this edition (or one started first).
      const plist = P.later(cs, view, "projects", "projectlist", {}, function () { return false; });
      const mine = plist.state === "ok" && Array.isArray(plist.value.projects) ? plist.value.projects : [];
      out.push(cs.sec("act.owed_rerunstart.label.imported", '<p class="mk-small">' + cs.w("screen.imported.rerun_what") + " " + cs.w("screen.imported.rerun_pairing_human") + "</p>"
        + cs.choice("im-rerun", "screen.imported.rerun_project_label", [{ value: "", text: "" }].concat(mine.map(function (x) { return { value: String(x.id), text: String(x.title || x.name || x.id) }; })))
        + '<p class="mk-small">' + cs.w("screen.imported.rerun_start_one") + "</p><p class=\"mk-note\">" + cs.w("screen.imported.rerun_declares", { edition: String(ed.edition || "") }) + " "
        + cs.w("screen.imported.rerun_nothing", { team: group }) + "</p>"
        + '<div class="mk-acts">' + cs.act("rerunstart") + "</div>" + P.said(view, "rerunstart")));

      // R59 (C50; DEC-382): "Rest one of your team's questions on this", on a finding the team accepted only; the plane judges the rest.
      if (accepted.length) {
        const ql = P.later(cs, view, "questions", "list", { query: { type: "inquiry", limit: "500" } }, function () { return false; });
        const qs = ql.state === "ok" && Array.isArray(ql.value.bundles) ? ql.value.bundles : [];
        out.push(cs.sec("screen.imported.citeimp.head", accepted.map(function (f, i) {
          return '<div data-citeimp="' + cs.esc(f.finding) + '"><p><span class="rec">' + nameOf(f, findings.indexOf(f)) + "</span></p>"
            + cs.choice("im-ci-q-" + i, "screen.imported.citeimp.q", [{ value: "", text: "" }].concat(qs.map(function (q) { return { value: String(q.bundle_id), text: String(q.title || q.bundle_id) }; })))
            + cs.checks("im-ci-role-" + i, { key: "screen.imported.citeimp.role" }, [["supports", "screen.imported.citeimp.role.supports", false], ["cuts_against", "screen.imported.citeimp.role.cuts", false]], { radio: true })
            + cs.field("im-ci-note-" + i, "screen.imported.citeimp.note")
            + '<div class="mk-acts">' + cs.act("citeimported", { data: { finding: f.finding, index: String(i) } })
            + (view.reachable ? cs.act("writinghelp", { data: { field: "note", id: "im-ci-note-" + i, forop: "citeimported" } }) : "") + "</div></div>";
        }).join("") + '<p class="mk-small">' + cs.w("screen.imported.citeimp.inherit1") + " " + cs.w("screen.imported.citeimp.inherit2") + "</p>" + P.said(view, "citeimported")));
      }

      out.push(cs.sec("screen.imported.flag", cs.field("im-issue", "screen.imported.issue.label", { area: true }) + '<div class="mk-acts">' + cs.act("importflag") + "</div>" + P.said(view, "importflag")));
      out.push(cs.sec("screen.imported.watch", cs.field("im-publisher", "screen.imported.publisher.label", { type: "url", help: "screen.imported.publisher.help" })
        + '<div class="mk-acts">' + cs.act("importwatch") + "</div>" + P.said(view, "importwatch")));
    } else if (view.subject) out.push(cs.state("chosen", function () { return ""; }));

    // R25: the cases imported, each opening its own page, with who brought it in and how far it recreated; with none
    // imported, the screen's one empty state, which names the first step, is drawn without a section (R20).
    const listed = view.data.cases && view.data.cases.state === "empty";
    const count = function (v) { return typeof v === "number" ? String(v) : "–"; }; // no recreation recorded is not zero
    out.push(listed ? cs.state("cases", function () { return ""; }, { empty: "screen.imported.list.none" }) : cs.sec("screen.imported.list", '<p class="mk-sub">' + cs.w("screen.imported.list.says") + "</p>"
      + cs.state("cases", function (v) {
        return cs.sheet(v.imports.map(function (x) {
          const eds = Array.isArray(x.editions) ? x.editions : [];
          const ed = eds.find(function (e) { return String(e.edition) === String(x.latest_edition); }) || eds[eds.length - 1] || {};
          const who = ed.importer && ed.importer.handle ? ed.importer.handle : ed.imported_by && ed.imported_by !== "admin" ? cs.memberName(ed.imported_by) : "–";
          let says = cs.w("screen.imported.list.row", { group: String(x.group && (x.group.name || x.group.slug) || x.group || ""),
            edition: String(x.latest_edition !== undefined && x.latest_edition !== null ? x.latest_edition : ed.edition || ""), who: who,
            date: { html: ed.imported_at ? cs.date(ed.imported_at) : "" }, recreated: count(ed.recreated), findings: count(ed.findings) });
          if (typeof ed.recreated_in_part === "number" && ed.recreated_in_part > 0) says += " · " + cs.w("screen.imported.list.row.part", { n: String(ed.recreated_in_part) });
          return cs.row(cs.mark("origin", "elsewhere"), '<a class="cs-btn" data-tone="quiet" href="/app/imported/' + encodeURIComponent(x.import) + '" data-nav>'
            + (scopeOf(x) ? cs.esc(scopeOf(x)) : cs.w("screen.imported.name")) + "</a>", '<span class="meta">' + says + "</span>");
        }).join(""));
      }), { help: "screen.imported.list.tip" }));
    out.push(cs.sec("screen.imported.import", cs.field("im-file", "screen.imported.file.label", { type: "file", help: "screen.imported.file.help" })
      + '<div class="mk-acts">' + cs.act("caseimport") + "</div>" + P.said(view, "caseimport")));
    return out.join("");
  },

  acts: [
    {
      // B420 2/3 (interface-shell R20; DEC-387, DEC-382): the assistant's help with one own-words field, drawn only while it is reachable;
      // nothing is kept until the member saves, and the draft fills the field labelled machine work. The owner's declaration
      // (`writinghelp`, wizard-scripts R46) requires `op`, the act the words are for.
      op: "writinghelp", label: "act.writinghelp.label.imported", rereads: [], reasonField: "told",
      send: function (view, el, cs) {
        view.ui.helpId = el.dataset.id;
        const forop = el.dataset.forop;
        if (!forop) return null;
        return { body: { op: forop, field: el.dataset.field, told: String(cs.value(el.dataset.id) || "").trim() } };
      },
      done: function (view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && typeof a.text === "string" && view.ui.helpId) cs.fill(view.ui.helpId, a.text, { label: "screen.start-send.draft.machine" });
      },
    },
    {
      // R7: "Import a case": the case file the member chose, its bytes sent as one part.
      op: "caseimport", label: "act.caseimport.label.imported", rereads: [],
      send: async function (view, el, cs) {
        const f = cs.file("im-file");
        if (!f) return { refuse: "screen.imported.file.needed" };
        const bytes = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        return { body: { parts: [btoa(bin)] } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "caseimport", answer)) return; // D29: no import is opened on a refusal
        const r = view.parts.value(answer) || {};
        if (r.import) cs.go("imported", r.import);
      },
    },
    {
      // R7: "Accept what recreated, with a reason": the findings that recreated, what the member checked, and why.
      op: "importaccept", label: "act.importaccept.label.imported", rereads: ["chosen"], reasonField: "reason",
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        if (!c) return null;
        const ed = c.edition || {};
        const findings = (Array.isArray(ed.findings) ? ed.findings : []).filter(function (f) { return f.result === "recreated" || f.result === "yes"; }).map(function (f) { return f.finding; });
        const checked = String(cs.value("im-checked") || "").trim();
        if (!checked) return { refuse: "screen.imported.checked.needed" };
        return { body: { import: c.import, edition: ed.edition, findings: findings, checked: checked, reason: String(cs.value("im-reason") || "").trim() } };
      },
      done: function (view, answer, cs) { view.parts.refused(cs, view, "importaccept", answer); }, // D29
    },
    {
      // R55: "Withdraw this acceptance, with a reason": nothing is sent without one.
      op: "importacceptwithdraw", label: "act.importacceptwithdraw.label.imported", rereads: ["chosen"], reasonField: "reason",
      refusals: { IMPORT_ACCEPT_NO_REASON: "screen.imported.withdraw.label", IMPORT_NOTHING_ACCEPTED: "screen.imported.withdraw.none.summary" },
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        if (!c) return null;
        const reason = String(cs.value("im-withdraw") || "").trim();
        if (!reason) return { refuse: "screen.imported.withdraw.label" };
        return { body: { import: c.import, edition: (c.edition || {}).edition, reason: reason } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "importacceptwithdraw", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R58: "View under another lens": the edition re-weighed under the lens chosen (a read, nothing saved); none is chosen for her.
      op: "importregrade", label: "act.owed_importregrade.label.imported", rereads: [],
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        const lens = (cs.value("im-lens") || [])[0];
        if (!c || !lens) return null;
        return { body: { import: c.import, edition: (c.edition || {}).edition, lens: lens } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "importregrade", answer)) return { stay: true }; // D29
        const r = view.parts.value(answer) || {};
        cs.set("regrade", Object.assign({}, r, { import: r.import || (view.data.chosen.value || {}).import }));
        return { stay: true };
      },
    },
    {
      // R58: "Re-run this work in your own project": one of the team's projects declared a rerun of this edition.
      op: "rerunstart", label: "act.owed_rerunstart.label.imported", rereads: [],
      refusals: {
        PROJECT_ACT_NOT_THE_OWNER: function (r, cs) { return cs.w("screen.imported.rerun_refused_owner") + " " + cs.w("screen.imported.rerun_refused_owner_next"); },
        RERUN_ALREADY: function (r, cs) { return cs.w("screen.imported.rerun_refused_already") + " " + cs.w("screen.imported.rerun_refused_already_next"); },
      },
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        const project = String(cs.value("im-rerun") || "");
        if (!c || !project) return null;
        return { body: { project: project, import: c.import, edition: (c.edition || {}).edition } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "rerunstart", answer)) return { stay: true }; // D29
        view.parts.say(cs, view, "rerunstart", cs.w("screen.imported.rerun_compare_there"));
        return { stay: true };
      },
    },
    {
      // R59: "Rest one of your team's questions on this": a question of the team rests on a finding the team accepted, at the edition
      // shown; the plane judges whether the finding is accepted (`IMPORTED_NOT_ACCEPTED`), and this page offers it on accepted ones only.
      op: "citeimported", label: "act.owed_citeimported.label.imported", rereads: [],
      refusals: {
        /* citation's real refusal is BASIS_REFUSED, its findings carrying the code (C-21.4); a finding the plane worded otherwise is drawn by its translation */
        BASIS_REFUSED: function (r, cs) {
          const found = (Array.isArray(r.findings) ? r.findings : []).filter(function (f) { return f && typeof f === "object"; });
          if (found.some(function (f) { return f.code === "IMPORTED_NOT_ACCEPTED"; })) return cs.w("screen.imported.citeimp.ref.notaccepted1") + " " + cs.w("screen.imported.citeimp.ref.notaccepted2");
          const said = found.map(function (f) { return String(f.translation || ""); }).filter(Boolean)[0] || String(r.translation || "");
          return said ? cs.esc(said) : cs.w("refusal.uncatalogued") + " <code>" + cs.esc(String(r.code || r.reason || "")) + "</code>";
        },
      },
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        const i = el.dataset.index;
        const inquiry = String(cs.value("im-ci-q-" + i) || ""), role = (cs.value("im-ci-role-" + i) || [])[0];
        if (!c || !inquiry || !role) return null;
        const note = String(cs.value("im-ci-note-" + i) || "").trim();
        return { body: Object.assign({ inquiry: inquiry, import: c.import, finding: el.dataset.finding, edition: (c.edition || {}).edition, role: role }, note ? { note: note } : {}) };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "citeimported", answer)) view.parts.forget(view); return { stay: true }; }, // D29
    },
    {
      // R7: "Flag an issue", kept within the group.
      op: "importflag", label: "act.importflag.label.imported", rereads: ["chosen"],
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        const issue = String(cs.value("im-issue") || "").trim();
        if (!c) return null;
        if (!issue) return { refuse: "screen.imported.issue.needed" };
        return { body: { import: c.import, edition: (c.edition || {}).edition, issue: issue } };
      },
      done: function (view, answer, cs) { view.parts.refused(cs, view, "importflag", answer); }, // D29
    },
    {
      // R7: "Watch the publisher's docket".
      op: "importwatch", label: "act.importwatch.label.imported", rereads: [],
      send: function (view, el, cs) {
        const c = view.data.chosen && view.data.chosen.state === "ok" ? view.data.chosen.value : null;
        const publisher = String(cs.value("im-publisher") || "").trim();
        if (!c) return null;
        if (!/^https:\/\//.test(publisher)) return { refuse: "screen.imported.publisher.needed" };
        return { body: { import: c.import, publisher: publisher } };
      },
      done: function (view, answer, cs) { view.parts.refused(cs, view, "importwatch", answer); }, // D29
    },
  ],
});
