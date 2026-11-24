/* The case editor (registry screen `case-editor`; R1, R28, R31, R34, R35): Projects › <project> › Case. A project's case
 * drafts, and the one chosen: its readiness ladder, its scope, what it leaves out with each acknowledgement, the people it
 * names with their reasons, what changed since the last edition, and the account. A project with no draft draws a first
 * case (R31): the concluded questions to take in, ticked, then the scope. Its subject is the project, or `<project>/<draft>`
 * for one draft (the newest otherwise). Every function is self-contained (interface-shell R21 (1)): it refers only to its
 * parameters, the kit `cs` and the module's `parts`. */
import { PARTS } from "./parts.mjs";

export const CASE_EDITOR = Object.freeze({
  id: "case-editor",
  parts: PARTS,

  // R1's reads: the project (its title, for the path) and its case drafts; the chosen draft's own reads wait on these.
  reads: function (view) {
    if (!view.parts.subject(view, 1)) return {}; // K3171: no subject in the address, no subject read
    const project = String(view.subject || "").split("/")[0];
    return {
      // The project is the subject (a project with no draft yet is not an unknown subject: R20's one empty state is drawn).
      project: { op: "image", query: { id: project }, subject: true },
      drafts: { op: "casedrafts", query: { project: project },
        empty: function (v) { return !v || !Array.isArray(v.drafts) || v.drafts.length === 0; } },
    };
  },

  place: function (view) {
    const id = String(view.subject || "").split("/")[0];
    const p = view.data.project;
    return { project: { id: id, title: view.parts.titleOf(p && p.state === "ok" ? p.value : null, id) } };
  },

  render: function (cs, view) {
    if (!view.parts.subject(view, 1)) return view.parts.nothing(cs);
    const P = view.parts;
    const parts = String(view.subject || "").split("/");
    const project = parts[0];
    const projectTitle = P.titleOf(view.data.project && view.data.project.state === "ok" ? view.data.project.value : null, project);
    const d = view.data.drafts;
    const settled = !!d && (d.state === "ok" || d.state === "empty");
    const drafts = d && d.state === "ok" && Array.isArray(d.value.drafts) ? d.value.drafts : [];
    const chosen = drafts.find(function (x) { return x.draft_id === parts[1]; }) || drafts[drafts.length - 1] || null;
    view.ui.draft = chosen;
    const out = [];
    const caseOf = chosen && chosen.case ? chosen.case : null;
    // R28: a draft that names no case is titled by its project, never by the derivation prose its identity then holds.
    const named = !!(caseOf && caseOf.case_id && caseOf.identity);
    const edition = caseOf && caseOf.edition !== undefined && caseOf.edition !== null ? String(caseOf.edition) : "";
    // C49: the copy of the chosen draft is read first, so a draft that names no case is headed by its own title (`review` R63), as the review
    // copy and the ceremony head it, not by the project's
    const chosenR = chosen ? P.later(cs, view, "copy", "reviewcopy", { query: { draft: chosen.draft_id } }) : null;
    out.push(cs.title(named ? caseOf.identity + (edition ? " · " + edition : "")
      : chosen ? P.titleOf2(cs, chosenR && chosenR.state === "ok" ? chosenR.value : null, P.plain(cs.w("case.draft.untitled", { project: projectTitle }))) : null, { thing: "case" }));
    out.push('<span id="what-goes-in"></span>');
    if (settled && chosen) out.push(P.editionsLine(cs, view, chosen));
    if (settled) out.push(P.draftHead(cs, view, "case-editor", P.draftCopies(cs, view, drafts, chosen ? chosen.draft_id : "", chosenR), chosen ? chosen.draft_id : "", projectTitle));
    if (!settled) return out.concat([cs.sec("screen.case-editor.drafts", cs.state("drafts", function () { return ""; }))]).join("");

    // R28: who prepared it is the member's handle, never the sign-in name when the handle is known.
    const handleOf = function (x, id) {
      if (x[id + "_handle"]) return String(x[id + "_handle"]);
      return x[id] ? cs.memberName(x[id]) : ""; // R111 (C94): by handle, never the member id
    };

    // The project's drafts: with a choice (two or more) "Which draft" among them, each named by its scope and the day it was prepared, the
    // newest marked, and how many review links are live (C49; DEC-394, DEC-395); with one, its own row opening its editor. With none, the
    // screen's one empty state, which names the first step (R20).
    const list = P.draftCopies(cs, view, drafts, chosen ? chosen.draft_id : "", chosenR);
    out.push(d.state === "empty" ? cs.state("drafts", function () { return ""; }, { empty: "screen.case-editor.nodrafts" }) : cs.sec("screen.case-editor.drafts", drafts.length > 1
      ? P.draftChooser(cs, view, "case-editor", list, chosen.draft_id, projectTitle) + P.liveNote(cs, view, "case-editor", list)
      : cs.sheet(drafts.map(function (x) {
        const c = x.case || {};
        const name = c.case_id && c.identity ? cs.esc(c.identity) : cs.w("case.draft.untitled", { project: projectTitle });
        const link = '<a class="cs-btn" data-tone="quiet" href="/app/case-editor/' + encodeURIComponent(project + "/" + x.draft_id) + '" data-nav'
          + (chosen && x.draft_id === chosen.draft_id ? ' aria-current="true"' : "") + ">" + name + "</a>";
        return cs.row("", link, c.edition ? '<span class="meta">' + cs.w("screen.case-editor.edition", { n: String(c.edition) }) + "</span>" : "",
          cs.w("screen.case-editor.preparedby", { who: x.updated_by ? handleOf(x, "updated_by") : handleOf(x, "created_by") }));
      }).join(""))));

    // R31: a project's first case (state b): the concluded questions to take in, each ticked, then the scope.
    // D-M2 (R81): on a drafted state the act is "Save these details" and a field edited since the last save says so (`typing`: the shell hands
    // the field's value to the screen about half a second after the last key); a first case prepares the draft
    const edited = function (c2) { c2.set("unsaved", true); };
    const scope = function (authored, drafted) {
      const typing = drafted ? { typing: edited } : {};
      return cs.field("ce-scope", "screen.case-editor.scope.label", { area: true, rec: true, value: authored.scope || "", help: "screen.case-editor.scope.help", ...typing })
        + cs.field("ce-statement", "review.statement.title", { area: true, rec: true, value: authored.statement || "", ...typing })
        + '<div class="mk-acts">' + cs.act("writinghelp", { data: { field: "scope" } }) + cs.act("casedraft", drafted ? { tone: "primary", label: "screen.case-editor.save" } : { tone: "primary" }) + "</div>"
        + (drafted && view.ui.unsaved ? '<p class="mk-note" role="status" data-unsaved>' + cs.w("screen.case-editor.unsaved") + "</p>" : "")
        + P.said(view, "help-scope") + P.said(view, "casedraft");
    };
    if (!chosen) {
      const concluded = d.value && Array.isArray(d.value.concluded) ? d.value.concluded : [];
      view.ui.concluded = concluded.map(function (q) { return q.inquiry; });
      out.push(cs.sec("screen.case-editor.whatgoesin", concluded.length
        ? cs.checks("ce-targets", "screen.case-editor.whatgoesin", concluded.map(function (q) {
          return { value: q.inquiry, on: true, text: [q.title || q.inquiry, q.concluded_at ? cs.date(q.concluded_at) : "", Number(q.findings) > 0 ? String(q.findings) : ""].filter(Boolean).join(" · ") };
        }))
        : P.fold(cs, "screen.case-editor.noconcluded.summary", "<p>" + cs.w("screen.case-editor.noconcluded") + "</p>"), { help: "screen.case-editor.whatgoesin.note" }));
      out.push(cs.sec("screen.case-editor.scope", scope({})));
      return out.join("");
    }

    // A new draft, or this one changed: its scope and what it says (`casedraft`, R1), with writing help under the scope.
    const copy = P.later(cs, view, "copy", "reviewcopy", { query: { draft: chosen.draft_id } });
    const authored = copy.state === "ok" && copy.value.authored ? copy.value.authored : {};
    out.push(cs.sec("screen.case-editor.scope", scope(authored, true)));

    // R44 (C2; DEC-376): what a case states about itself, held beside the scope and sent with `casedraft`: each finding's role, and the
    // team's position on putting the case to the people it concerns with its reasoning. Drawn from the copy's own choices, and only
    // once the copy has answered (R20).
    const have = copy.state === "ok" ? copy.value : null;
    const choices = have && have.choices && typeof have.choices === "object" ? have.choices : {};
    const roleList = Array.isArray(choices.roles) ? choices.roles : [];
    const positionList = Array.isArray(choices.subject_positions) ? choices.subject_positions : [];
    const found = have && Array.isArray(have.findings) ? have.findings : [];
    const ROLE = { load_bearing: "screen.case-editor.role.relied", supporting: "screen.case-editor.role.supporting" };
    const POSITION = { sought_and_answered: "screen.case-editor.we_asked_and_they_answered", sought_no_answer: "screen.case-editor.we_asked_and_had_no_answer",
      not_sought: "screen.case-editor.we_chose_not_to_give_notice" };
    const option = function (v, names, on) { return names[v] ? [v, names[v], on] : { value: v, text: v, on: on }; };
    if (found.length && roleList.length) out.push(cs.sec("screen.case-editor.findings_and_their_roles", found.map(function (f, i) {
      return cs.row("", cs.w("screen.published.finding", { n: String(i + 1) }) + " · " + P.findingWords(cs, f, { text: true }), "")
        + cs.checks("ce-role-" + i, { key: "screen.case-editor.finding.role", fills: { n: String(i + 1) } }, roleList.map(function (r) { return option(r, ROLE, f.role === r); }), { radio: true });
    }).join("") + '<p class="mk-small">' + cs.w("screen.case-editor.relied_on_the_case_rests_on") + "</p><p class=\"mk-small\">" + cs.w("screen.case-editor.supporting_it_travels_with_the_case")
      + "</p><p class=\"mk-small\">" + cs.w("screen.case-editor.required_for_every_finding_at_least") + "</p>" + P.said(view, "casedraft"),
    { help: ["screen.case-editor.a_case_is_made_of_findings", "screen.case-editor.you_say_for_each_whether_the"] }));
    if (have && positionList.length) out.push(cs.sec("screen.case-editor.putting_this_case_to_the_people",
      cs.checks("ce-pos", { key: "screen.case-editor.say_where_the_team_stands" }, positionList.map(function (v) { return option(v, POSITION, authored.subjectPosition === v); }), { radio: true })
      + '<p class="mk-small">' + cs.w("screen.case-editor.choosing_not_to_give_notice_is") + "</p>"
      + cs.field("ce-posjust", "screen.case-editor.why_the_team_took_this_position", { area: true, rec: true, value: authored.subjectJustification || "", help: "screen.case-editor.a_position_with_no_reasoning_behind", typing: edited })));

    // The readiness ladder: each rung "not yet checked" until its check answers (R1, R28).
    const check = caseOf && caseOf.case_id ? P.later(cs, view, "check", "casecheck", { query: { case: caseOf.case_id, edition: edition } }) : null;
    // 10B C10: the begun edition has no document until it is prepared (the plane answers NO_CASE_DOCUMENT with a 404): the read is sent for an edition
    // the record says is prepared or published; an older answer that states neither is read as before (R77)
    const eds = chosen.editions && typeof chosen.editions === "object" ? chosen.editions : null;
    const onRecord = !eds || Number(eds.prepared) === Number(edition) || !!(eds.published && Number(eds.published.edition) === Number(edition));
    const doc = caseOf && caseOf.case_id && edition && onRecord ? P.later(cs, view, "document", "casedocument", { query: { case: caseOf.case_id, edition: edition } }) : null;
    const held = check && check.state === "ok" ? check.value.state : null;
    const gates = copy.state === "ok" ? copy.value.gates : null;
    const distributed = (held === "published") || (doc && doc.state === "ok" && !!doc.value.published_at);
    const rungs = [
      ["draft", true],
      ["internal", held === "held" || held === "published" ? true : held === "void" ? false : null],
      // R48 (C8): the external rung is "not yet evaluated" until an evaluation of compliance is read; the publish gates' verdict is
      // drawn as what is missing (R47), never as that rung. R64: "something is missing" only where a check refused (the internal one).
      ["external", gates === "passed" ? true : null],
      ["distributed", distributed ? true : null],
    ];
    // R63 (L14): a draft that names no case says so in a fold, by the sentence `review` states; R47 (C7): the publish gates' first
    // refusal, from the copy, as what is missing
    if (copy.state === "ok" && !(copy.value.case && copy.value.case.case_id) && !(chosen.editions && (chosen.editions.prepared || chosen.editions.published))) out.push(P.fold(cs, "screen.case-editor.nocase.summary", "<p>" + cs.w("review.body.nocase") + "</p>"));
    const miss = copy.state === "ok" && copy.value.gates === "refused" && Array.isArray(copy.value.missing) ? copy.value.missing[0] : null;
    const missing = miss ? '<ul class="mk-list" data-missing><li role="alert">' + (P.refusalText(cs, miss) || cs.esc(String(miss.reason || ""))) + "</li></ul>" : "";
    // R65 (C4): the owner's way to the reader's comments, or that there are none
    const said = copy.state === "ok" && Array.isArray(copy.value.comments) ? copy.value.comments.length : 0;
    const talk = copy.state === "ok" ? '<p data-comments>' + (said ? '<a class="cs-btn" data-tone="quiet" href="/app/review-copy/' + encodeURIComponent(project + "/" + chosen.draft_id) + '" data-nav>' + cs.w("screen.case-editor.comments.go", { n: String(said) }) + "</a>"
      : cs.w("screen.case-editor.comments.none")) + "</p>" : "";
    out.push(cs.sec("screen.case-editor.ladder", '<ol class="cs-ladder" data-ladder="ready" style="list-style-position:inside;padding:0">' + rungs.map(function (r) {
      const said = r[1] === true ? "" : r[1] === false ? cs.w("screen.case-editor.rung.notmet") : cs.w("case.ladder.notyet");
      return '<li data-rung="' + r[0] + '" class="' + (r[1] === true ? "on" : "") + '">' + cs.w("screen.case-editor.rung." + r[0])
        + (said ? ' <span class="meta">' + said + "</span>" : "") + "</li>";
    }).join("") + '</ol><p class="muted" data-ladder-note>' + cs.w("screen.case-editor.tip.distributed") + "</p>" + missing + talk + (check ? cs.state(check, function () { return ""; }) : "")));

    // What it leaves out, with each acknowledgement and its acknowledger's own reason (R1; case-inputs R1), and the fields that add a
    // row (R44): what is left out and why, or the claim that nothing material is. The acknowledgement is drawn once something is left out.
    out.push(P.sec(cs, "screen.case-editor.leavesout", cs.state(copy, function (v) {
      const ex = Array.isArray(v.authored && v.authored.excluded) ? v.authored.excluded : v.authored && v.authored.excluded ? [v.authored.excluded] : [];
      const stated = !!(v.authored && typeof v.authored.statement === "string" && v.authored.statement.trim());
      const acks = v.statement_acknowledgements && Array.isArray(v.statement_acknowledgements.acknowledgements) ? v.statement_acknowledgements.acknowledgements : [];
      return (ex.length ? cs.sheet(ex.map(function (e) {
        return cs.row("", '<span class="rec">' + cs.esc(typeof e === "string" ? e : e.description || e.target || "") + "</span>",
          typeof e === "object" && e.reason ? '<span class="meta">' + cs.esc(e.reason) + "</span>" : "");
      }).join("")) : "")
        + (acks.length ? cs.sheet(acks.map(function (a) {
          return cs.row("", cs.w("screen.case-editor.ack.by", { who: a.by ? cs.memberName(a.by) : a.recipient || "" }), '<span class="rec">' + cs.esc(a.reason || "") + "</span>", a.at ? cs.date(a.at) : "");
        }).join("")) : "")
        + cs.field("ce-exwhat", "screen.case-editor.something_else_it_leaves_out", { help: "screen.case-editor.name_a_document_in_your_record", typing: edited })
        + cs.field("ce-exwhy", "screen.case-editor.why_it_is_left_out", { help: ["screen.case-editor.required_for_each_item", "screen.case-editor.what_is_left_out_and_why"], typing: edited })
        + (ex.length ? "" : cs.checks("ce-exnone", { text: "" }, [["none", "screen.case-editor.this_case_leaves_nothing_material_out", false]])
          + '<p class="mk-small">' + cs.w("screen.case-editor.an_empty_list_is_a_claim") + "</p><p class=\"mk-small\">" + cs.w("screen.case-editor.silence_is_not_say_either_what") + "</p>")
        // D-M5 (2): what is acknowledged is the statement (case-inputs R1, C-82.5), so it is offered whenever the case has one, with or without a list
        // R81 (D-M5): a case that lists nothing it leaves out says so and asks for the confirmation, with its own help for the reason
        + (ex.length || acks.length || stated ? (ex.length ? "" : '<p class="mk-note" data-ack-none>' + cs.w("screen.case-editor.ack.none") + "</p>")
          + cs.field("ce-ackreason", "screen.case-editor.ack.reason", { area: true, help: ex.length ? "screen.case-editor.ack.reason.help" : "screen.case-editor.ack.none.help" })
          + '<div class="mk-acts">' + cs.act("statementack") + "</div>" + P.said(view, "statementack") : "");
    })));

    // R53 (C53; DEC-376): the passages the case cites, each removed or, once removed, reinstated, with a reason the shell asks for (the
    // acts are reasoned); nothing is deleted. Read from the project's own document, which keeps a removed citation.
    const cites = P.references(view.data.project && view.data.project.state === "ok" ? view.data.project.value : null)
      .filter(function (r) { return !r.rel || r.rel === "cites"; });
    // C46: a passage the case cites is named by its title where the draft's copy states one (a finding it names), never by its id
    const citeName = function (t) {
      const x = found.find(function (y) { return y && y.target === t; });
      return x && typeof x.title === "string" && x.title.trim() ? x.title.trim() : t;
    };
    if (cites.length) out.push(cs.sec("screen.case-editor.the_passages_this_case_cites", cs.sheet(cites.map(function (r) {
      const gone = r.status === "severed";
      return cs.row("", '<span class="rec" data-cited="' + cs.esc(r.target) + '" data-status="' + (gone ? "severed" : "live") + '">' + cs.esc(citeName(r.target)) + "</span>"
        + (gone && r.note ? '<span class="meta">' + cs.esc(r.note) + "</span>" : ""), "",
        cs.act(gone ? "reinstate" : "sever", { data: { handle: r.target } }));
    }).join("")) + P.said(view, "citation"), { help: ["screen.case-editor.removing_one_takes_it_out_of", "screen.case-editor.nothing_is_deleted_a_removed_citation"] }));

    // The people it names, each with its reason or that the reason is missing (R1; `attribute`).
    out.push(P.sec(cs, "screen.case-editor.people", cs.state(copy, function (v) {
      const obs = Array.isArray(v.observations) ? v.observations : [];
      if (!obs.length) return "";
      return cs.sheet(obs.map(function (o, i) {
        const why = o.stated ? '<span class="rec">' + cs.esc(typeof o.stated === "string" ? o.stated : o.stated.reason || "") + "</span>"
          : '<span class="muted">' + cs.w("screen.case-editor.people.noreason") + "</span>";
        const level = o.chosen ? cs.w("screen.case-editor.level." + String(o.chosen.level || o.chosen)) : "";
        const fields = cs.choice("ce-level-" + i, "screen.case-editor.level.label", ["name", "cover", "project", "group"].map(function (l) { return [l, "screen.case-editor.level." + l]; }))
          + cs.field("ce-why-" + i, "screen.case-editor.people.reason", { area: true });
        return cs.row("", '<span class="rec">' + cs.esc(o.observation) + "</span>" + (level ? " · " + level : "") + " · " + why, "")
          + '<div class="mk-acts" style="display:block;padding:0 0 12px">' + fields + cs.act("attribute", { data: { observation: o.observation, index: String(i) } }) + "</div>";
      }).join("")) + P.said(view, "attribute");
    })));

    // What changed since the last edition: the member's words, the drafts labeled machine work, writing help (R1).
    // The section is "What changed since Edition {n}": drawn for an edition that has one before it.
    const before = Number(edition) - 1;
    if (caseOf && caseOf.case_id && before >= 1) {
      const changed = P.later(cs, view, "changed", "whatchangeddrafts", { query: { case: caseOf.case_id } },
        function (v) { return !v || !Array.isArray(v.drafts) || v.drafts.length === 0; });
      out.push(cs.sec("screen.case-editor.changed", cs.field("ce-wc", "screen.case-editor.changed.label", { area: true, rec: true, value: authored.whatChanged && typeof authored.whatChanged.text === "string" ? authored.whatChanged.text : "", help: "screen.case-editor.changed.help", typing: edited })
        + '<div class="mk-acts">' + cs.act("writinghelp", { data: { field: "whatchanged" } }) + (view.reachable ? cs.act("whatchangedpropose") : "") + "</div>"
        + P.said(view, "help-whatchanged") + P.said(view, "whatchangedpropose")
        + P.listed(cs, changed, function (v) {
          return cs.sheet(v.drafts.map(function (x) {
            const machine = x.label && (x.label.machine || x.label.kind === "machine" || x.label.by === "machine");
            return cs.row(machine ? cs.mark("origin", "machine") : "", '<span class="rec">' + cs.esc(x.text) + "</span>"
              + (x.untested ? '<span class="mk-note">' + cs.w("ai.label.untested") + "</span>" : ""), "", x.at ? cs.date(x.at) : "");
          }).join(""));
        }), { fills: { n: String(before) } }));
    }

    // R35 (DEC-315): "The account", on a drafted case: the member's own words, the assistant's draft and flags drawn as
    // machine work when it may run, the earlier drafts, and "Prepare the draft", which saves the account.
    if (caseOf && caseOf.case_id) {
      const drawn = P.later(cs, view, "account", "accountdrafts", { query: { case: caseOf.case_id } },
        function (v) { return !v || !Array.isArray(v.drafts) || v.drafts.length === 0; });
      const all = drawn.state === "ok" ? drawn.value.drafts : [];
      const proposed = view.ui.accountDraft || all.filter(function (x) { return x.kind !== "account_check"; }).pop() || null;
      const flags = (view.ui.accountFlags || all.filter(function (x) { return x.kind === "account_check"; }).reduce(function (a, x) { return a.concat(x.flags || []); }, []));
      const mine = Array.isArray(authored.account) ? authored.account.map(function (s) { return typeof s === "string" ? s : s && s.text || ""; }) : [];
      const draftRow = function (x) {
        return cs.row(cs.mark("origin", "machine"), '<span class="rec">' + cs.esc(x.text || "") + "</span>",
          x.framing ? '<span class="meta">' + cs.w("case-account.framing." + x.framing) + "</span>" : "", x.at ? cs.date(x.at) : "");
      };
      out.push(cs.sec("screen.case-editor.account", (view.reachable
        ? cs.choice("ce-framing", "screen.case-editor.account.order", ["time_order", "by_question", "by_rule"].map(function (f) { return [f, "case-account.framing." + f]; }), { value: "time_order" })
          + '<div class="mk-acts">' + cs.act("accountpropose") + "</div>" + P.said(view, "accountpropose")
        : "")
        + (proposed ? cs.sheet(draftRow(proposed)) + '<p class="mk-note">' + cs.w("screen.case-editor.account.use") + "</p><p class=\"muted\">" + cs.w("screen.case-editor.account.notasis") + "</p>" : "")
        + (flags.length ? '<ul class="mk-list" data-account-flags>' + flags.map(function (f) {
          const sentence = f.sentence || mine[Number(f.ord) - 1] || "";
          return "<li>" + cs.w("screen.case-editor.account.flagged", { sentence: sentence }) + '<br><span class="meta">' + cs.esc(f.text || "") + "</span></li>";
        }).join("") + "</ul>" : "")
        + cs.field("ce-account", "screen.case-editor.account", { area: true, rec: true, value: mine.join("\n"), typing: edited })
        + '<div class="mk-acts">' + cs.act("accountdrafts") + cs.act("casedraft", { tone: "primary", data: { account: "1" } }) + "</div>"
        + (view.ui.accountEarlier ? cs.sheet(view.ui.accountEarlier.map(draftRow).join("")) : "")
        + P.said(view, "accountdrafts") + P.said(view, "account"), { help: "screen.case-editor.account.help" }));
      out.push(P.listed(cs, drawn, function () { return ""; }));
    }
    // R57 (C12; DEC-378; K4185): "Details of this work", beside the case and never in its signed bytes; before the case's first save, the
    // note that they open once it is saved. Four details, each not stated until set (no classification row, K4185); none blocks publishing.
    const dTitle = "act.owed_casedetails.label.case-editor";
    if (!(caseOf && caseOf.case_id)) out.push(cs.sec(dTitle, '<p class="mk-note">' + cs.w("screen.case-editor.details.first") + "</p>"));
    else {
      const rd = P.later(cs, view, "details", "casedetails", { query: { case: caseOf.case_id } });
      const bodies = P.later(cs, view, "bodies", "entitieskind", { query: { kind: "body" } }, function (v) { return !v || !Array.isArray(v.entities) || !v.entities.length; });
      out.push(cs.sec(dTitle, cs.state(rd, function (v) {
        const d = v && v.details && typeof v.details === "object" ? v.details : {};
        const val = function (f) { return d[f] && d[f].stated ? d[f].value : null; };
        const area = Array.isArray(val("area")) ? val("area") : [];
        const related = Array.isArray(val("related")) ? val("related") : [];
        const rels = val("relationships");
        const items = rels && Array.isArray(rels.items) ? rels.items : [];
        const contact = val("contact");
        const NOTSTATED = '<span class="muted" data-notstated>' + cs.w("case-inputs.details.not_stated") + "</span>";
        const RELATION = { builds_on: "screen.case-editor.details.rel.builds_on", responds_to: "screen.case-editor.details.rel.responds_to", same_matter: "screen.case-editor.details.rel.same",
          disagrees_with: "screen.case-editor.details.rel.disagrees_with", other: "screen.case-editor.details.rel.other" };
        const takeOut = function (field, i) { return cs.act("casedetailsset", { label: "screen.case-editor.details.takeout", data: { field: field, mode: "remove", index: String(i) } }); };
        const part = function (field, head, body) { return '<div data-detail="' + field + '"><p><b>' + head + "</b> · " + (d[field] && d[field].stated ? '<span class="muted">' + cs.date(d[field].set_at) + "</span>" : NOTSTATED) + "</p>" + body + "</div>"; };
        const bodyList = bodies.state === "ok" ? bodies.value.entities : [];
        return '<p class="mk-note">' + cs.w("screen.case-editor.details.intro1") + " " + cs.w("screen.case-editor.details.intro2") + "</p>"
          + '<p class="mk-note">' + cs.w("screen.case-editor.details.outward1") + " " + cs.w("screen.case-editor.details.outward2") + "</p>"
          + part("area", cs.w("screen.case-editor.details.name.area"), (area.length ? cs.sheet(area.map(function (a, i) {
            return cs.row("", '<span class="mk-data">' + cs.esc(a.words) + "</span>", takeOut("area", i));
          }).join("")) : "")
            + (bodyList.length ? cs.choice("cd-body", "screen.case-editor.details.area.addbody", [{ value: "", text: "" }].concat(bodyList.map(function (b) { return { value: b.entity_id, text: b.label || b.entity_id }; }))) : "")
            + cs.field("cd-words", "screen.case-editor.details.area.words")
            + '<div class="mk-acts">' + cs.act("casedetailsset", { label: "screen.case-editor.details.list.add", data: { field: "area", mode: "add" } }) + "</div>")
          + part("contact", cs.w("screen.case-editor.details.name.contact"), cs.checks("cd-contact", { key: "screen.case-editor.details.contact.legend" }, [
            ["doorbell", "screen.case-editor.details.contact.doorbell", !!contact && contact.kind === "doorbell"], ["text", "screen.case-editor.details.contact.words", !!contact && contact.kind === "text"]], { radio: true })
            + cs.field("cd-contact-text", "screen.case-editor.details.contact.words", { value: contact && contact.kind === "text" ? contact.text : "", help: "screen.case-editor.details.contact.help" })
            + '<p class="mk-note">' + cs.w("screen.case-editor.details.contact.nomember1") + " " + cs.w("screen.case-editor.details.contact.nomember2") + "</p>"
            + '<div class="mk-acts">' + cs.act("casedetailsset", { data: { field: "contact", mode: "save" } }) + "</div>")
          + part("related", cs.w("screen.case-editor.details.name.related"), (related.length ? cs.sheet(related.map(function (r, i) {
            return cs.row("", '<span class="mk-data">' + cs.esc(r.url || (r.case_ref ? r.case_ref.case : "")) + '</span><span class="meta">' + (RELATION[r.relation] ? cs.w(RELATION[r.relation]) : cs.esc(r.relation)) + "</span>", takeOut("related", i));
          }).join("")) : "")
            + cs.field("cd-rel-link", "screen.case-editor.details.rel.link", { help: "screen.case-editor.details.rel.linkhelp" })
            + cs.choice("cd-rel-relation", "screen.case-editor.details.rel.choose", ["builds_on", "responds_to", "same_matter", "disagrees_with", "other"].map(function (k) {
              return RELATION[k] ? [k, RELATION[k]] : { value: k, text: k };
            }))
            + cs.field("cd-rel-words", "screen.case-editor.details.rel.words")
            + '<div class="mk-acts">' + cs.act("casedetailsset", { label: "screen.case-editor.details.list.add", data: { field: "related", mode: "add" } }) + "</div>")
          + part("relationships", cs.w("screen.case-editor.details.name.relationships"), '<p class="mk-small">' + cs.w("screen.case-editor.details.ties.intro") + " " + cs.w("screen.case-editor.details.ties.public") + "</p>"
            + cs.checks("cd-rels", { key: "screen.case-editor.details.ties.legend" }, [
              ["none", "screen.case-editor.details.ties.none", !!rels && rels.none === true], ["some", "screen.case-editor.details.ties.some", items.length > 0]], { radio: true })
            + (items.length ? cs.sheet(items.map(function (t, i) {
              return cs.row("", '<span class="mk-data">' + cs.esc(t.with) + '</span><span class="meta mk-data">' + cs.esc(t.nature) + "</span>", takeOut("relationships", i));
            }).join("")) : "")
            + cs.field("cd-with", "screen.case-editor.details.ties.with") + cs.field("cd-nature", "screen.case-editor.details.ties.how")
            + '<p class="mk-note">' + cs.w("screen.case-editor.details.ties.stake") + "</p>"
            + '<div class="mk-acts">' + cs.act("casedetailsset", { label: "screen.case-editor.details.list.add", data: { field: "relationships", mode: "add" } })
            + cs.act("casedetailsset", { data: { field: "relationships", mode: "save" } }) + cs.act("casedetails") + "</div>")
          + P.said(view, "casedetailsset");
      })));
    }
    // a case edition never authored answers NO_CASE_DOCUMENT (publication R1): that is a draft not yet prepared, not a read that failed
    if (doc && !(doc.state === "failed" && doc.refusal && doc.refusal.code === "NO_CASE_DOCUMENT")) out.push(cs.state(doc, function () { return ""; }));
    return out.join("");
  },

  acts: [
    {
      // C49: "Which draft": the project's drafts read once more, and the editor opened on the one chosen (`pickDraft`).
      op: "casedrafts", label: "act.casedrafts.label.case-editor", rereads: [],
      send: function (view, el, cs) {
        view.ui.pickDraft = String(cs.value("drafts-case-editor") || "");
        return { query: { project: String(view.subject || "").split("/")[0] } };
      },
      done: function (view, answer, cs) { return view.parts.pickDraft(view, answer, cs, "case-editor"); },
    },
    {
      // R1: "Prepare the draft": a new draft of the project, or the chosen one changed, with the member's scope and words.
      // R31: a first case sends the project and the ticked concluded questions as `targets`, with no `caseId` and no
      // `newCase`; none ticked sends nothing and says so in place. R35: from the account's own button it also saves the
      // account, a sentence a line, and names the assistant's draft it began as.
      op: "casedraft", label: "act.casedraft.label.case-editor", rereads: ["drafts"],
      send: function (view, el, cs) {
        const scope = String(cs.value("ce-scope") || "").trim();
        const statement = String(cs.value("ce-statement") || "").trim();
        if (!scope) return { refuse: "screen.case-editor.scope.needed" };
        const body = {};
        const account = view.ui.draft && el && el.dataset && el.dataset.account === "1" ? String(cs.value("ce-account") || "") : "";
        if (view.ui.draft) {
          // R44 (C3): a draft that stands is changed field by field: a Save sends only what it changed, and names no finding, so the
          // draft keeps its own (review R37). What the draft holds is what its copy answered.
          const copy = view.parts.copyOf(view) || {};
          const held = copy.authored || {};
          body.draft = view.ui.draft.draft_id;
          if (scope !== String(held.scope || "")) body.scope = scope;
          if (statement && statement !== String(held.statement || "")) body.statement = statement;
          const pos = (cs.value("ce-pos") || [])[0];
          if (pos && pos !== held.subjectPosition) body.subjectPosition = pos;
          const why = cs.value("ce-posjust");
          if (typeof why === "string" && why.trim() && why.trim() !== String(held.subjectJustification || "")) body.subjectJustification = why.trim();
          // 10A R90 (i): the What-changed words she typed, when they differ from the ones the draft holds (case-authoring reads `whatChanged.text`)
          const wc = String(cs.value("ce-wc") || "").trim();
          if (wc && wc !== String(held.whatChanged && held.whatChanged.text || "").trim()) body.whatChanged = { text: wc };
          const found = Array.isArray(copy.findings) ? copy.findings : [];
          const roles = {};
          found.forEach(function (f, i) { const r = (cs.value("ce-role-" + i) || [])[0]; if (r && f.target) roles[f.target] = r; });
          if (found.some(function (f) { return f.target && roles[f.target] && roles[f.target] !== f.role; })) body.roles = roles;
          const had = Array.isArray(held.excluded) ? held.excluded : [];
          const what = String(cs.value("ce-exwhat") || "").trim(), because = String(cs.value("ce-exwhy") || "").trim();
          const none = (cs.value("ce-exnone") || []).includes("none");
          if (what || because) {
            if (!what || !because) return { refuse: "screen.case-editor.say_what_is_left_out_and" };
            body.excluded = had.map(function (e) { return typeof e === "string" ? { description: e } : e; }).concat([{ description: what, reason: because }]);
          } else if (none && !had.length) body.excluded = [];
        } else {
          body.scope = scope;
          if (statement) body.statement = statement;
          const ticked = cs.value("ce-targets");
          const targets = (Array.isArray(ticked) ? ticked : []).filter(function (id) { return (view.ui.concluded || []).includes(id); });
          if (!targets.length) {
            view.parts.say(cs, view, "casedraft", cs.w("capture.fieldneeded", { field: { html: cs.w("screen.case-editor.whatgoesin") } }), false);
            return null;
          }
          body.project = String(view.subject || "").split("/")[0];
          body.targets = targets;
        }
        if (account.trim()) {
          body.account = account.split("\n").map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return { text: t, cites: [] }; });
          const began = view.ui.accountDraft && view.ui.accountDraft.id;
          if (began) body.accountDraft = began;
        }
        return { body: body };
      },
      // R35 (DEC-326): the account that cannot be read is said in its fold, in the refusal's own words.
      refusals: { BAD_ACCOUNT: function (r, cs) {
        return '<details class="mk-details" open data-fold="screen.case-editor.account.refused.summary"><summary>' + cs.w("screen.case-editor.account.refused.summary")
          + "</summary>" + cs.w("refusal.BAD_ACCOUNT") + "</details>";
      } },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "casedraft", answer)) return; // D29: a refusal inside a success is not success
        view.ui.unsaved = false;
        view.parts.forget(view);
        view.parts.say(cs, view, "casedraft", cs.w("screen.case-editor.prepared"));
      },
    },
    {
      // R1: a draft of "what changed", recorded labeled by who proposed it, while the assistant is reachable.
      op: "whatchangedpropose", label: "act.whatchangedpropose.label.case-editor", rereads: [],
      send: function (view, el, cs) {
        const c = view.ui.draft && view.ui.draft.case;
        const text = String(cs.value("ce-wc") || "").trim();
        if (!c || !c.case_id) return null;
        if (!text) return { refuse: "screen.case-editor.changed.needed" };
        return { query: { case: c.case_id }, body: { text: text } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "whatchangedpropose", answer)) return; // D29
        const r = view.parts.value(answer) || {};
        view.parts.forget(view);
        view.parts.say(cs, view, "whatchangedpropose", cs.w("screen.case-editor.changed.kept") + (r.untested ? " " + cs.w("ai.label.untested") : ""));
      },
    },
    {
      // R1; case-inputs R1: the acknowledgement of what the case leaves out, with the acknowledger's own reason.
      op: "statementack", label: "act.statementack.label.case-editor", rereads: [], reasonField: "reason",
      refusals: { STATEMENT_ACK_NO_REASON: "screen.case-editor.ack.reason.needed" },
      send: function (view, el, cs) {
        if (!view.ui.draft) return null;
        return { query: { draft: view.ui.draft.draft_id }, body: { reason: String(cs.value("ce-ackreason") || "").trim() } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "statementack", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R1: a person the case names, with the reason it must (its consequence in the shell's dialog, op-grades R4).
      op: "attribute", label: "act.attribute.label.case-editor", rereads: [], reasonField: "reason",
      send: function (view, el, cs) {
        // follow-up 54 (review R16): a draft that asked for a new case names no case until it is prepared; then the record states the case and
        // edition it prepared (`editions.case`, `editions.prepared`, case-authoring R83), which the author's choice is for
        const c = view.ui.draft && view.ui.draft.case;
        const ed = view.ui.draft && view.ui.draft.editions;
        const prepared = ed && typeof ed.case === "string" && ed.case && Number(ed.prepared) > 0 ? { case_id: ed.case, edition: Number(ed.prepared) } : null;
        const at = c && c.case_id ? c : prepared;
        if (!at) return { refuse: "screen.case-editor.people.nocase" };
        const i = el.dataset.index;
        return { body: { caseId: at.case_id, edition: Number(at.edition), observation: el.dataset.observation,
          level: String(cs.value("ce-level-" + i) || "name"), reason: String(cs.value("ce-why-" + i) || "").trim() } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "attribute", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R57 (C12): one of a case's four details set, or cleared, from the case editor once the case has an id; the list details
      // (area, related work, relationships) are sent whole with the entry added or taken out. The owner's refusals are drawn in a fold.
      op: "casedetailsset", label: "act.owed_casedetailsset.label.case-editor", rereads: [],
      refusals: {
        NOT_THE_PROJECT_OWNER: function (r, cs) { return cs.w("screen.case-editor.details.refused.owner1"); },
        DETAILS_MALFORMED: function (r, cs) { return cs.w("screen.case-editor.details.refused.malformed1") + " " + cs.w("screen.case-editor.details.refused.malformed2"); },
        NO_SUCH_CASE: function (r, cs) { return cs.w("screen.case-editor.details.refused.nocase1") + " " + cs.w("screen.case-editor.details.refused.nocase2"); },
      },
      send: function (view, el, cs) {
        const c = view.ui.draft && view.ui.draft.case;
        if (!c || !c.case_id) return { refuse: "screen.case-editor.details.refused.nocase1" };
        const L = view.ui.later && view.ui.later.details;
        const now = L && L.state === "ok" && L.value && L.value.details ? L.value.details : {};
        const have = function (f) { return now[f] && now[f].stated && Array.isArray(now[f].value) ? now[f].value : []; };
        const field = el.dataset.field, mode = el.dataset.mode;
        const text = function (id) { return String(cs.value(id) || "").trim(); };
        let value = null;
        if (field === "contact") {
          const kind = (cs.value("cd-contact") || [])[0];
          value = kind === "doorbell" ? { kind: "doorbell" } : kind === "text" ? { kind: "text", text: text("cd-contact-text") } : null;
        } else if (mode === "remove") {
          const list = field === "relationships" ? (now.relationships && now.relationships.value && now.relationships.value.items || []) : have(field);
          const rest = list.filter(function (x, i) { return String(i) !== el.dataset.index; });
          value = field === "relationships" ? (rest.length ? { items: rest } : null) : rest.length ? rest : null;
        } else if (mode === "save" && field === "relationships") {
          const pick = (cs.value("cd-rels") || [])[0];
          const kept = now.relationships && now.relationships.value && now.relationships.value.items || [];
          value = pick === "none" ? { none: true } : pick === "some" && kept.length ? { items: kept } : null;
        } else if (field === "area") {
          const words = text("cd-words"), ent = text("cd-body");
          const label = ent && words ? words : ent ? ((view.ui.later.bodies && view.ui.later.bodies.value && view.ui.later.bodies.value.entities || []).find(function (b) { return b.entity_id === ent; }) || {}).label || ent : words;
          if (!label) return { refuse: "screen.case-editor.details.refused.malformed1" };
          value = have("area").concat([ent ? { entity: ent, words: label } : { words: label }]);
        } else if (field === "related") {
          const link = text("cd-rel-link"), relation = text("cd-rel-relation"), words = text("cd-rel-words");
          if (!link || !relation) return { refuse: "screen.case-editor.details.refused.malformed1" };
          value = have("related").concat([Object.assign({ relation: relation, url: link }, words ? { words: words } : {})]);
        } else if (field === "relationships") {
          const who = text("cd-with"), nature = text("cd-nature");
          if (!who || !nature) return { refuse: "screen.case-editor.details.refused.malformed1" };
          const kept = now.relationships && now.relationships.value && now.relationships.value.items || [];
          value = { items: kept.concat([{ with: who, nature: nature }]) };
        }
        return { body: { case: c.case_id, field: field, value: value } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "casedetailsset", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R57: the details as they stand, and who set each and when, read again.
      op: "casedetails", label: "act.owed_casedetails.label.case-editor", rereads: [],
      send: function (view) { const c = view.ui.draft && view.ui.draft.case; return c && c.case_id ? { query: { case: c.case_id } } : null; },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "casedetails", answer)) view.parts.forget(view); return { stay: true }; }, // D29
    },
    ...["sever", "reinstate"].map(function (op) {
      return {
        // R53 (C53): a citation of the case's own taken out, or put back; the reason is the shell's (the acts are reasoned) and the
        // citation is the project's reference the row names. Nothing is deleted.
        op: op, label: "act." + op + ".label.case-editor", rereads: ["project"],
        send: function (view, el) { return { body: { project: String(view.subject || "").split("/")[0], handle: el.dataset.handle } }; },
        done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "citation", answer)) view.parts.forget(view); }, // D29
      };
    }),
    {
      // R1 (interface-shell R20): help with the scope's or "what changed"'s words, never a reason; drawn as a labeled draft.
      op: "writinghelp", label: "act.writinghelp.label.case-editor", rereads: [],
      send: function (view, el, cs) {
        const field = el.dataset.field === "whatchanged" ? "whatchanged" : "scope";
        const told = String(cs.value(field === "scope" ? "ce-scope" : "ce-wc") || "").trim();
        if (!told) return { refuse: "screen.case-editor.help.needed" };
        view.ui.helpFor = field;
        return { body: { op: field === "scope" ? "casedraft" : "whatchangedpropose", field: field, told: told } };
      },
      done: function (view, answer, cs) {
        const which = view.ui.helpFor || "scope";
        if (view.parts.refused(cs, view, "help-" + which, answer)) return { stay: true }; // D29
        const r = view.parts.value(answer) || {};
        view.parts.say(cs, view, "help-" + which, cs.w("screen.case-editor.help.draft") + ' <span class="rec">' + cs.esc(r.text || "") + "</span>"
          + (r.untested ? " " + cs.w("ai.label.untested.writinghelp") : ""));
        return { stay: true };
      },
    },
    {
      // R35: "Draft the account with the assistant", drawn only when the assistant may run. Its press is assistant work and is held with
      // the assistant (K3717; B13): `accountpropose` stores a draft an AI run made, which a member's press cannot supply, so the screen
      // sends nothing to it. The drafts the plane holds are read from `accountdrafts` and drawn as machine work.
      op: "accountpropose", label: "act.accountpropose.label.case-editor", rereads: [],
      send: function () { return null; },
    },
    {
      // R35: "See its earlier drafts": the case's drafts of its account, each labeled machine work.
      op: "accountdrafts", label: "act.accountdrafts.label.case-editor", rereads: [],
      send: function (view) {
        const c = view.ui.draft && view.ui.draft.case;
        return c && c.case_id ? { query: { case: c.case_id } } : null;
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "accountdrafts", answer)) return { stay: true }; // D29
        const r = view.parts.value(answer) || {};
        view.ui.accountEarlier = (Array.isArray(r.drafts) ? r.drafts : []).filter(function (x) { return x.kind !== "account_check"; });
        return { stay: true };
      },
    },
  ],
});
