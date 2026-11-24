/* The review copy (registry screen `review-copy`; R2; DEC-100): Projects › <project> › Review copy. The draft's named
 * outside readers, each with what they may read and until when; sharing with a new reader, whose link is shown once and
 * kept nowhere; stopping a share; the readers' comments and the member's replies. Its subject is the project, or
 * `<project>/<draft>` for one draft (the newest otherwise). C49: a chooser among the project's drafts, and every live review link on any
 * draft, each stoppable here. Every function is self-contained (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";
import { REVIEW_COPY_FILE } from "./review-copy-file.mjs";

export const REVIEW_COPY = Object.freeze({
  id: "review-copy",
  parts: Object.freeze({ ...PARTS, ...REVIEW_COPY_FILE }),

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
    const want = String(view.subject || "").split("/")[1];
    const d = view.data.drafts;
    const drafts = d && d.state === "ok" && Array.isArray(d.value.drafts) ? d.value.drafts : [];
    const chosen = drafts.find(function (x) { return x.draft_id === want; }) || drafts[drafts.length - 1] || null;
    view.ui.draft = chosen;
    const c = chosen && chosen.case ? chosen.case : {};
    const copy = chosen ? P.later(cs, view, "copy", "reviewcopy", { query: { draft: chosen.draft_id } }) : null;
    const held = copy && copy.state === "ok" ? copy.value : null;
    // R60, R63: the heading is the title `review` answers; the identity sentence is body text, drawn where no case is named
    const out = [cs.title(P.titleOf2(cs, held, c.identity ? P.plain(cs.w("screen.review-copy.heading", { case: c.identity, edition: String(c.edition || "") })) : null), { thing: "case" })];
    if (!chosen) {
      // R64 (I-29): beside "There is no draft to share yet", the door that makes one: the case editor
      out.push(cs.state("drafts", function () { return ""; }, { empty: "screen.review-copy.nodraft" }));
      if (d && d.state === "empty") out.push('<p><a class="cs-btn" data-tone="quiet" data-nodraft-go href="/app/case-editor/' + encodeURIComponent(String(view.subject || "").split("/")[0]) + '" data-nav>' + cs.w("screen.review-copy.nodraft.go") + "</a></p>");
      return out.join("");
    }
    out.push(P.editionsLine(cs, view, chosen));
    out.push(P.noCase(cs, held, chosen.editions));
    // C49 (DEC-394, DEC-395): "Which draft", among the project's drafts; every other draft's copy is read once for its scope and links
    const projectTitle = P.titleOf(view.data.project && view.data.project.state === "ok" ? view.data.project.value : null, String(view.subject || "").split("/")[0]);
    const list = P.draftCopies(cs, view, drafts, chosen.draft_id, copy);
    out.push(P.draftHead(cs, view, "review-copy", list, chosen.draft_id, projectTitle), P.draftChooser(cs, view, "review-copy", list, chosen.draft_id, projectTitle));

    // The named readers: each a row with what they may read and until when, and "Stop sharing" (R2, R18).
    out.push(P.sec(cs, "screen.review-copy.readers", cs.state(copy, function (v) {
      const grants = (Array.isArray(v.grants) ? v.grants : []).filter(function (g) { return !g.revoked_at && !g.revokedAt; });
      if (!grants.length) return "";
      // R18, R27: the end is drawn in the team's zone, as the copy answer carries it on each row (`review` R35).
      const held = P.copyZone(v).zone;
      return cs.sheet(grants.map(function (g) {
        const id = g.grant_id || g.grantId || "";
        const line = P.grantLine(cs, view, g, String(c.edition || ""), held);
        return cs.row("", "<b>" + cs.esc(g.recipient || "") + "</b>", '<span class="meta" data-grant-until="' + line.state + '">' + line.says + "</span>",
          cs.act("reviewrevoke", { data: { grant: id } }));
      }).join(""));
    })) + P.said(view, "reviewrevoke"));

    // Sharing with a named reader: a name, a role and an end date; the secret shown once as the reader's link (R2).
    // C66 (fix round 2): the boxes are drawn with their button; a member who may not share is shown none of them (and only the file)
    const grant = cs.act("reviewgrant", { tone: "primary" }), file = view.ui.export ? "" : cs.act("reviewexport", { data: { step: "open" } });
    out.push(grant ? cs.sec("screen.review-copy.share", cs.field("rc-name", "screen.review-copy.name.label", { rec: true })
      + cs.field("rc-role", "screen.review-copy.role.label", { rec: true, help: "screen.review-copy.role.help" })
      + cs.field("rc-until", "screen.review-copy.until.label", { type: "date", help: "screen.review-copy.until.help" })
      + '<div class="mk-acts">' + grant + file + "</div>" + P.said(view, "reviewgrant")
      + (view.ui.link ? '<div class="cs-sheet" data-reader-link><span class="id">' + cs.esc(view.ui.link.href) + "</span><p>"
        + cs.w("screen.review-copy.link.for", { who: view.ui.link.who }) + " <b>" + cs.w("screen.review-copy.noemail") + "</b></p><p class=\"muted\">"
        + cs.w("screen.review-copy.link.once") + "</p></div>" : ""))
      : file ? '<div class="mk-acts">' + file + "</div>" : "");

    // C49 (DEC-394): every live review link on any draft of the project, each with the draft it is on and "Stop sharing"
    out.push(P.liveLinks(cs, view, "review-copy", list, projectTitle));

    // R40 (A81): "Save as a file": the warning, what the file carries, the one box, and the file handed over to save
    if (view.ui.export) {
      const done = view.ui.exported || null;
      const row = function (text) { return cs.row("", text, ""); };
      out.push(cs.sec("screen.review_copy.save.this.copy.as.a", '<div class="cs-gap" data-gap="refused" data-recall><span><b>' + cs.w("screen.review_copy.a.file.can.t.be") + "</b> "
        + cs.w("screen.review_copy.once.it.leaves.your.device") + " " + cs.w("screen.review_copy.stopping.the.sharing.of.a") + " " + cs.w("screen.review_copy.if.what.you.need.is") + "</span></div>"));
      out.push(cs.sec("screen.review_copy.what.the.file.carries", cs.sheet(row("<b>" + cs.w("screen.review_copy.carries.fingerprint") + "</b> " + cs.w("screen.review_copy.a.code.that.names.exactly")) + row(cs.w("screen.review_copy.the.date.this.copy.last"))
        + row("<b>" + cs.w("screen.review_copy.carries.author") + "</b>") + row(cs.w("screen.review_copy.the.minimum.strengths.it.was"))) + '<p class="mk-note">' + cs.w("screen.review_copy.the.file.does.not.say") + " " + cs.w("screen.review_copy.its.fingerprint.covers.them.so") + "</p>"));
      out.push(cs.choice("rc-export-ack", "screen.review_copy.before.you.save.it", [{ value: "", text: "–" }, { value: "yes", key: "screen.review_copy.i.understand.that.this.file" }],
        { acts: { yes: "reviewexport" }, act: { tone: "primary", label: "screen.review_copy.save.file", data: { step: "save" } } }));
      out.push(P.said(view, "reviewexport"));
      // R81 (D-M4): the file is made and waits for the second press: the page says so beside the button that hands it over
      if (done && done.name) out.push('<p class="mk-note" role="status" data-export-says>' + cs.w("screen.review_copy.save.ready") + '</p><div class="mk-acts" data-export-ready>' + cs.save(done.name, done.text) + "</div>");
      if (done && done.unstamped) out.push(P.fold(cs, "screen.review_copy.when.the.copy.can.t", "<p>" + cs.w("screen.review_copy.this.copy.could.not.be") + " " + cs.w("screen.review_copy.no.file.was.made") + "</p>"));
      if (done && done.declined) out.push(P.fold(cs, "screen.review_copy.when.this.browser.doesn.t", "<p>" + cs.w("screen.review_copy.this.browser.did.not.accept") + " " + cs.w("screen.review_copy.nothing.left.this.page") + "</p>"));
    }

    // The readers' comments, each answered by "Reply" (R2). R62 (L19): they come from the copy answer itself, so a draft that names
    // no case still draws them; R65 (G6): an acknowledgement is drawn by key, naming the reader by what the grant states, never an id.
    const comments = held && Array.isArray(held.comments) ? held.comments : [];
    const acks = held && held.statement_acknowledgements && Array.isArray(held.statement_acknowledgements.acknowledgements) ? held.statement_acknowledgements.acknowledgements : [];
    out.push(P.sec(cs, "screen.review-copy.comments", (comments.length ? cs.sheet(comments.map(function (x, i) {
      const reader = x.author_kind === "recipient" || x.reviewer_kind === "recipient";
      // C94: an outside reader is named as the grant names them; a member by handle, never by the member id
      const who = reader ? x.recipient || x.author || x.reviewer || "" : cs.memberName(x.author || x.reviewer || "");
      // C81: the reply box and its button sit under the comment, the whole width of the row, not squeezed into its end
      return cs.row("", '<span class="rec">' + cs.esc(x.text) + "</span>",
        '<span class="meta">' + cs.w(reader ? "screen.review-copy.from.reader" : "screen.review-copy.from.member", { who: who })
        + (x.at ? " · " + cs.date(x.at) : "") + "</span>")
        + (reader ? '<div class="mk-acts" style="display:block;padding:0 0 12px">' + cs.field("rc-reply-" + i, "screen.review-copy.reply.label", { area: true })
          + cs.act("reviewcomment", { data: { index: String(i) } }) + "</div>" : "");
    }).join("")) : "")
      + (acks.length ? '<ul class="mk-list" data-acked>' + acks.map(function (a) {
        return "<li>" + cs.w("screen.review-copy.acked", { who: a.recipient || (a.by ? cs.memberName(a.by) : ""), date: { html: a.at ? cs.date(a.at) : "" } }) + "</li>"; }).join("") + "</ul>" : "")
      + P.said(view, "reviewcomment")));
    return out.join("");
  },

  // R2, R11: the reader's link is page memory only, gone when the member leaves the screen.
  closed: function (cs, view) { view.ui.link = null; view.ui.export = false; view.ui.exported = null; },

  acts: [
    {
      // C49: "Which draft": the project's drafts read once more, and the screen opened on the one chosen (`pickDraft`).
      op: "casedrafts", label: "act.casedrafts.label.review-copy", rereads: [],
      send: function (view, el, cs) {
        view.ui.pickDraft = String(cs.value("drafts-review-copy") || "");
        return { query: { project: String(view.subject || "").split("/")[0] } };
      },
      done: function (view, answer, cs) { return view.parts.pickDraft(view, answer, cs, "review-copy"); },
    },
    {
      // R2: a named reader, their role and an end date; the answer's secret drawn once as the reader's link, never kept.
      op: "reviewgrant", label: "act.reviewgrant.label.review-copy", rereads: [], outward: true,
      refusals: { REVIEW_BAD_UNTIL: "screen.review-copy.until.bad" },
      send: async function (view, el, cs) {
        const P = view.parts;
        const name = String(cs.value("rc-name") || "").trim();
        const role = String(cs.value("rc-role") || "").trim();
        const day = String(cs.value("rc-until") || "").trim();
        if (!name || !role || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { refuse: "screen.review-copy.reader.needed" };
        if (!view.ui.draft) return null;
        // The copy read is still on its way: the press says so beside the button (A N-1). A read that failed says its own refusal beside
        // the share; the press is never dropped in silence.
        const held = view.ui.later && view.ui.later.copy;
        if (!held || held.state === "loading") return { refuse: "state.loading" };
        if (held.state !== "ok" || !held.value) { P.say(cs, view, "reviewgrant", (held.refusal && held.refusal.words) || cs.w("shell.unread"), false); return null; }
        const copy = held.value;
        // R18, R27, R41: the end of the chosen day in the team's zone, as an instant in the record's stamp form; the zone is the
        // member door's copy answer's own, at its top level whether or not the draft has a grant (`review` R35); with none held
        // the share is refused in its fold and nothing is sent.
        const zone = P.copyZone(copy).zone;
        if (!zone) {
          const key = view.me && view.me.administer === true ? "screen.review-copy.until.nozone" : "screen.review-copy.until.nozone.member";
          P.say(cs, view, "reviewgrant", P.fold(cs, "screen.review-copy.until.nozone.summary", "<p>" + cs.w(key) + "</p>"), false);
          return null;
        }
        const until = P.endOfDay(day, zone);
        if (!until) return { refuse: "screen.review-copy.reader.needed" };
        view.ui.pendingWho = name;
        return { body: { draft: view.ui.draft.draft_id, recipient: name + " · " + role, until: until } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "reviewgrant", answer)) return; // D29: a refusal inside a success shows no link
        const r = view.parts.value(answer) || {};
        view.ui.link = r.secret ? { href: view.origin + "/app/review#grant=" + r.secret, who: view.ui.pendingWho || r.recipient || "" } : null;
        view.ui.pendingWho = null;
        view.parts.forget(view);
      },
    },
    {
      // R40 (A81): the browser act "Save as a file": it opens the saving (the warning, what the file carries, the one box); once the
      // box is ticked, the same act reads the copy once, makes one stamped file in the page and hands it over to save. Nothing is
      // written to the plane, stored or put in an address; the file carries no grant secret, reader's name or comment.
      op: "reviewexport", label: "act.owed_reviewexport.label.review-copy", rereads: [],
      send: async function (view, el, cs) {
        const P = view.parts;
        if (el.dataset.step !== "save") { cs.set("export", true); return null; }
        if (cs.value("rc-export-ack") !== "yes" || !view.ui.draft) return null;
        const answer = await cs.call("reviewcopy", { query: { draft: view.ui.draft.draft_id } });
        if (!answer || P.carried(answer)) { P.refused(cs, view, "reviewexport", answer || { ok: false }); return null; }
        const copy = P.value(answer), stamp = P.stampOf(copy);
        if (view.ui.said) delete view.ui.said.reviewexport;
        if (!stamp) view.ui.exported = { unstamped: true };
        else if (typeof Blob !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") view.ui.exported = { declined: true };
        else view.ui.exported = { name: P.fileName(copy, stamp), text: P.stampedFile(cs, copy, stamp) };
        cs.set("export", true);
        return null;
      },
    },
    {
      // R2: "Stop sharing" one reader.
      op: "reviewrevoke", label: "act.reviewrevoke.label.review-copy", rereads: [],
      send: function (view, el) { return el.dataset.grant ? { body: { grant: el.dataset.grant } } : null; },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "reviewrevoke", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R2: "Reply" to a reader's comment.
      op: "reviewcomment", label: "act.reviewcomment.label.review-copy", rereads: [],
      send: function (view, el, cs) {
        const text = String(cs.value("rc-reply-" + el.dataset.index) || "").trim();
        if (!text) return { refuse: "screen.review-copy.reply.needed" };
        return view.ui.draft ? { query: { draft: view.ui.draft.draft_id }, body: { text: text } } : null;
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "reviewcomment", answer)) view.parts.forget(view); }, // D29
    },
  ],
});
