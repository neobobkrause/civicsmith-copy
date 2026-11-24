/* The litigation hold and its notice (registry screens `hold` and `holdnotice`; screens-action R32, R33; DEC-340, U366; K3935;
   `action-holds` R2, R3, R5, R6, R11, R12, R19; `filings` R47). `hold`: where any member who can see the action or the case
   places a hold, with a reason, from a reply marked as a legal threat, a docket mark, pressure recorded outside any action or a
   counsel matter; it reads what still wants a hold (`holdsdue`) and the counsel matters (`projectlist`), and records pressure that
   arrived outside any action. `holdnotice`: prepares the plain-words notice and records that the member sent it by her own hand;
   the screen sends nothing and records no recipient, no read and no compliance. A hold is released here: the places that hold
   one are read from `holdsplaced` (every place a hold was stated, with its latest statement), and what a release would restart is read first
   (`actionholdpreview`); no approval is asked. It holds no member-facing English (R19). Every function here is self-contained
   (interface-shell R21 (1)). */
import { readOnly, WRITE_HELP } from "./send-steps.mjs";

export const hold = Object.freeze({
  id: "hold",

  place: function (view) {
    const rows = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
      ? view.data.projects.value.bundles : [];
    const id = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value.project : null;
    const hit = id ? rows.find(function (b) { return b.bundle_id === id; }) : null;
    return hit ? { project: { id: id, title: hit.title || id } } : {};
  },

  reads: function (view) {
    const r = {
      due: { op: "holdsdue", query: { limit: "500" }, empty: function () { return false; } },
      roster: { op: "projectlist", query: {}, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
    };
    // R32 (action-holds R22): the places that hold a hold are those `holdsplaced` states `in_place` (`holdsdue` lists only what has none)
    r.held = { op: "holdsplaced", query: { limit: "500" } };
    // R32: what releasing the place chosen would restart, read before the release is asked (action-holds R6): the placing body, `from` included
    const at = view.ui && view.ui.releaseFor ? view.parts.placeIn(view.ui.releaseFor) : null;
    if (at && (at.target || at.project)) {
      const q = at.target ? { target: at.target, ord: String(at.ord) } : { project: at.project };
      if (at.from) q.from = JSON.stringify(at.from);
      r.preview = { op: "actionholdpreview", query: q };
    }
    if (/^ACTN-/.test(String(view.subject || ""))) r.action = { op: "action", query: { id: view.subject } };
    return r;
  },

  parts: {
    readOnly: readOnly,
    // R32: the place a row of `holdsdue` asks a hold at: an entry of an action, or the project of a docket mark or a pressure record
    placeOf: function (m) {
      const ar = m && m.arrived ? m.arrived : {};
      if (ar.action) return { target: ar.action, ord: Number(ar.ord) };
      if (ar.docket_entry) return { project: m.project, from: { docket_entry: ar.docket_entry } };
      if (ar.pressure) return { project: m.project, from: { pressure: ar.pressure } };
      return null;
    },
    // R32: a place held in the page, as the choice carries it
    placeIn: function (v) { try { const p = JSON.parse(String(v || "")); return p && typeof p === "object" ? p : null; } catch (e) { return null; } },
    // R32 (action-holds R22): each place a row of `holdsplaced` states `in_place` is released as it was placed: the place (`{target, ord}` or
    // `{project}`) with each distinct `from` it was placed from, one choice each
    heldPlacesOf: function (m) {
      if (!m || m.hold !== "in_place" || !m.place) return [];
      const place = m.place.target ? { target: m.place.target, ord: Number(m.place.ord) } : m.place.project ? { project: m.place.project } : null;
      if (!place) return [];
      const froms = [], seen = {};
      (Array.isArray(m.from) ? m.from : []).forEach(function (f) { const k = JSON.stringify(f); if (f && !seen[k]) { seen[k] = true; froms.push(f); } });
      return froms.length ? froms.map(function (f) { return Object.assign({}, place, { from: f }); }) : [place];
    },
    // C94 (R56): the member who marked it, by her handle
    who: function (cs, by) { const b = by && typeof by === "object" ? by.handle || by.member : by; const id = String(b || "").replace(/^member:/, ""); return id ? cs.memberName(id) : ""; },
  },

  render: function (cs, view) {
    const P = view.parts;
    const head = P.readOnly(cs, "screen.hold.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.hold.sub1") + " " + cs.w("screen.hold.sub2") + "</p>";
    const twoTips = function (titleKey, inner, k1, k2) {
      return '<section class="cs-section"><h2 tabindex="0" data-level="2" data-tip="' + cs.esc(cs.w(k1) + " " + cs.w(k2)) + '">' + cs.w(titleKey) + "</h2>" + inner + "</section>";
    };
    return head + cs.state("due", function (d) {
      const rows = Array.isArray(d.items) ? d.items : [];
      const projects = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
        ? view.data.projects.value.bundles : [];
      const roster = view.data.roster && view.data.roster.state === "ok" && view.data.roster.value && Array.isArray(view.data.roster.value.projects) ? view.data.roster.value.projects : [];
      const counsel = roster.filter(function (p) { return p.scope === "counsel_matter"; });
      // where the pressure arrived: a reply, a docket entry, pressure recorded outside any action, and the counsel matters
      const line = function (m) {
        const ar = m.arrived || {};
        const first = ar.action ? cs.w("screen.hold.reply") : ar.docket_entry ? cs.w("screen.hold.marked", { member: P.who(cs, m.marked_by) }) : cs.w("screen.hold.outside");
        return cs.row("", first + (m.note ? " · " + cs.esc(m.note) : "") + '<span class="meta">' + (m.marked_at ? cs.date(m.marked_at) + " · " : "")
          + (ar.action ? cs.w("screen.hold.marked", { member: P.who(cs, m.marked_by) }) + " · " : "") + cs.w("screen.hold.nohold") + "</span>", "", "");
      };
      const counselLine = function (p) {
        return cs.row("", cs.esc(p.name || p.id) + '<span class="meta">' + cs.w("screen.hold.counsel.row") + "</span>", "", "");
      };
      const whereList = rows.map(line).concat(counsel.map(counselLine)).join("");
      const whereSec = whereList ? twoTips("screen.hold.where.heading", cs.sheet(whereList), "screen.hold.where.tip1", "screen.hold.where.tip2") : "";

      // place the hold: the place chosen, the reason in the member's own words, other projects it may reach
      const subject = String(view.subject || "");
      const options = rows.filter(function (m) { return P.placeOf(m); }).map(function (m) {
        // fix round 10 (diagnosis 11 §16): each place is named by its mark's note and day, so two marks of one day read apart
        const day = m.marked_at ? String(cs.date(m.marked_at)).replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : "";
        return { value: JSON.stringify(P.placeOf(m)), text: [typeof m.note === "string" ? m.note.trim() : "", day].filter(Boolean).join(" \u00b7 "), m: m };
      }).concat(counsel.map(function (p) { return { value: JSON.stringify({ project: p.id }), text: p.name || p.id }; }));
      const pre = options.find(function (o) { const ar = o.m && o.m.arrived ? o.m.arrived : {}; return subject && (ar.action === subject || ar.docket_entry === subject); });
      const others = projects.map(function (b) { return { value: b.bundle_id, text: b.title || b.bundle_id, on: false }; });
      const helpOf = function (k) { return '<p class="mk-small">' + cs.w(k) + "</p>"; };
      const place = options.length ? cs.sec("screen.hold.for.label", cs.choice("hold-for", "screen.hold.for.label", options, { value: pre ? pre.value : options[0].value })
        + helpOf("screen.hold.for.help1") + helpOf("screen.hold.for.help2")
        + cs.field("hold-reason", "screen.hold.reason.label", { rec: true, max: 500, help: "screen.hold.reason.help1" }) + helpOf("screen.hold.reason.help2")
        + (others.length ? cs.checks("hold-projects", "screen.hold.projects.label", others) + helpOf("screen.hold.projects.help1") + helpOf("screen.hold.projects.help2") : "")
        + '<p class="mk-note">' + cs.w("screen.hold.who") + " " + cs.w("screen.hold.who.own") + "</p>"
        + '<div class="mk-acts">' + cs.act("actionhold", { tone: "primary" }) + "</div>") : "";

      // tell members what to keep: the notice is prepared on its own screen
      const notice = options.length ? cs.sec("screen.hold.tell.heading", '<p class="mk-note">' + cs.w("screen.hold.tell.inside") + " " + cs.w("screen.hold.tell.outside") + "</p>"
        + '<a class="cs-ref" href="/app/holdnotice/' + encodeURIComponent(pre ? pre.value : options[0].value) + '" data-nav>' + cs.w("screen.hold.notice.link") + "</a>") : "";

      // pressure that arrived outside any action: evidence wherever it arrives, creating no action
      const helpPress = view.reachable ? cs.act("writinghelp", { data: { field: "pressure", id: "hold-press", forop: "pressurerecord" } }) : "";
      const projectChoice = projects.length ? cs.choice("hold-press-project", "screen.hold.for.label", projects.map(function (b) { return { value: b.bundle_id, text: b.title || b.bundle_id }; })) : "";
      const press = projects.length ? cs.sec("screen.hold.press.heading", projectChoice
        + cs.choice("hold-press-kind", "screen.action.pressure.kind", ["legal", "retaliation", "discrediting", "other"].map(function (k) { return [k, "screen.action.pressure." + k]; }))
        + cs.field("hold-press", "screen.hold.press.label", { rec: true, max: 500, help: "screen.hold.press.help1" }) + helpOf("screen.hold.press.help2")
        + '<div class="mk-acts">' + cs.act("pressurerecord", {}) + helpPress + "</div>") : "";

      // releasing a hold: the place, the member's reason; what will start being deleted again is said first (R6). The places are those that
      // hold a hold now (`holdsplaced`'s `in_place`), the counsel matters, and what still wants a hold (to state that none is needed)
      const heldRows = view.data.held && view.data.held.state === "ok" && view.data.held.value && Array.isArray(view.data.held.value.items) ? view.data.held.value.items : [];
      const dayOf = function (at) { return at ? String(cs.date(at)).replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : ""; };
      const kept = [];
      const offer = function (o) { if (!kept.some(function (k) { return k.value === o.value; })) kept.push(o); };
      heldRows.forEach(function (m) {
        P.heldPlacesOf(m).forEach(function (at) {
          offer({ value: JSON.stringify(at), text: [typeof m.reason === "string" ? m.reason.trim() : "", dayOf(m.at), cs.w("screen.action.held")].filter(Boolean).join(" \u00b7 ") });
        });
      });
      options.forEach(function (o) { offer({ value: o.value, text: o.text }); });
      const chosen = view.ui && view.ui.releaseFor && kept.some(function (k) { return k.value === view.ui.releaseFor; }) ? view.ui.releaseFor : "";
      const titleOf = function (id) { const b = projects.find(function (x) { return x.bundle_id === id; }); return b ? b.title || id : id; };
      const prev = view.data.preview;
      const restarts = chosen && prev && prev.state === "ok" && prev.value && Array.isArray(prev.value.restarts) ? prev.value.restarts : [];
      const preview = chosen && prev && prev.state !== "ok" ? cs.state("preview")
        : chosen && prev ? '<p class="mk-note">' + cs.w("consequence.actionholdrelease") + "</p>"
          + (restarts.length ? '<ul class="mk-list">' + restarts.map(function (id) { return "<li>" + cs.esc(titleOf(id)) + "</li>"; }).join("") + "</ul>" : "") : "";
      const release = cs.sec("screen.hold.release", '<p class="mk-note">' + cs.w("screen.hold.release.form") + "</p>"
        + (kept.length ? cs.choice("hold-release-for", "screen.hold.for.label", [{ value: "", text: "" }].concat(kept), { redraw: "releaseFor", value: chosen }) + preview
          + cs.field("hold-release-why", "screen.hold.release.reason", { rec: true, max: 500, help: "screen.hold.release.reason.help" })
          + '<div class="mk-acts">' + cs.act("actionholdrelease", {}) + "</div>" : ""));
      return whereSec + place + notice + press + release;
    });
  },

  acts: [
    {
      // R32: "Place the hold, with a reason": at the place chosen, in the member's own words; any member who can see it, no approval.
      op: "actionhold", reasonField: "reason",
      send: function (view, el, cs) {
        let place = null;
        try { place = JSON.parse(String(cs.value("hold-for") || "")); } catch (e) { place = null; }
        if (!place) return null;
        const body = Object.assign({}, place, { hold: "in_place", reason: String(cs.value("hold-reason") || "").trim() });
        const more = cs.value("hold-projects");
        if (Array.isArray(more) && more.length) body.projects = more;
        return { body: body };
      },
      rereads: ["due", "held"],
    },
    {
      // R32: pressure that arrived outside any action, in a project the member sees, kept as her account; creates no action.
      op: "pressurerecord",
      send: function (view, el, cs) {
        const account = String(cs.value("hold-press") || "").trim();
        const project = cs.value("hold-press-project");
        if (!account || !project) return null;
        const at = new Date(cs.now()).toISOString().slice(0, 10);
        return { body: { project: project, pressure: { kind: cs.value("hold-press-kind") || "other", note: account.slice(0, 500) }, account: account, at: at } };
      },
      rereads: ["due"],
    },
    {
      // R32: "Release the hold, with a reason": at the place chosen; any member who can see it, no approval.
      op: "actionholdrelease", reasonField: "reason",
      send: function (view, el, cs) {
        // R32: only a place chosen (and so previewed) is released
        const place = view.parts.placeIn(cs.value("hold-release-for"));
        const reason = String(cs.value("hold-release-why") || "").trim();
        return place ? { body: Object.assign({}, place, { reason: reason }) } : null;
      },
      rereads: ["due", "held"],
    },
    WRITE_HELP,
  ],
});

export const holdNotice = Object.freeze({
  id: "holdnotice",

  place: function (view) {
    const rows = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
      ? view.data.projects.value.bundles : [];
    let place = null;
    try { place = JSON.parse(decodeURIComponent(String(view.subject || ""))); } catch (e) { place = null; }
    const hit = place && place.project ? rows.find(function (b) { return b.bundle_id === place.project; }) : null;
    return hit ? { project: { id: place.project, title: hit.title || place.project } } : {};
  },

  reads: function (view) {
    return { projects: { op: "list", query: { type: "project", limit: "500" } } };
  },

  parts: {
    readOnly: readOnly,
    // the place the screen's subject names: the same shape `hold` placed the hold at
    placeOf: function (view) {
      try { const p = JSON.parse(String(view.subject || "")); return p && typeof p === "object" ? p : null; } catch (e) { return null; }
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const place = P.placeOf(view);
    const head = P.readOnly(cs, "screen.holdnotice.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.holdnotice.sub1") + " " + cs.w("screen.holdnotice.sub2") + "</p>";
    if (!place) return head + '<p class="cs-state" data-state="empty">' + cs.w("shell.unavailable.nothing") + "</p>";
    // a project list that failed to read is drawn as failed (the path's project step names it)
    const listed = view.data.projects && view.data.projects.state === "failed" ? cs.state("projects") : "";
    const twoHelp = function (k) { return '<p class="mk-small">' + cs.w(k) + "</p>"; };
    const prepared = view.ui.notice || null;
    const helpSent = view.reachable ? cs.act("writinghelp", { data: { field: "account", id: "hold-account", forop: "holdnoticesent" } }) : "";
    const refused = view.ui.released === true ? '<p class="mk-note" role="status">' + cs.w("screen.holdnotice.released") + "</p>" : "";
    const notice = cs.sec("screen.holdnotice.label", cs.field("hold-notice", "screen.holdnotice.label", { area: true, rec: true, value: prepared ? prepared.text || "" : "",
      draft: prepared ? "screen.start-send.draft.template" : null, help: "screen.holdnotice.help1" }) + twoHelp("screen.holdnotice.help2") + refused
      + '<div class="mk-acts">' + cs.act("holdnoticeprepare", {}) + "</div>" + '<p class="mk-note">' + cs.w("screen.holdnotice.released") + "</p>");
    const sentSec = cs.sec("screen.holdnotice.sent.heading", '<p class="mk-note">' + cs.w("screen.holdnotice.sent.how") + " " + cs.w("screen.holdnotice.sent.none") + "</p>"
      + '<div class="cs-dialog" role="group" aria-label="' + cs.w("screen.holdnotice.sent.heading") + '"><span class="cs-tag-outward">' + cs.w("screen.start-send.outward") + "</span>"
      + '<p class="ends">' + cs.w("screen.holdnotice.outward.1") + " " + cs.w("screen.holdnotice.outward.2") + "</p>"
      + cs.field("hold-sent-at", "screen.start-send.sentat", { type: "date" })
      + cs.choice("hold-sent-how", "screen.start-send.how", ["email", "message", "person", "other"].map(function (k) { return [k, "screen.holdnotice.how." + k]; }))
      + cs.field("hold-account", "screen.holdnotice.account.label", { area: true, rec: true, help: "screen.holdnotice.account.help" })
      + '<div class="mk-acts">' + cs.act("holdnoticesent", { tone: "primary" }) + helpSent + "</div></div>");
    const not = cs.sec("screen.holdnotice.not.heading", '<p class="mk-note">' + cs.w("screen.holdnotice.not.records") + " " + cs.w("screen.holdnotice.not.nomember") + "</p>");
    return head + listed + notice + sentSec + not;
  },

  acts: [
    {
      // R33: "Prepare the notice": the text assembled from the record for a hold in place, editable; a released hold prepares none.
      op: "holdnoticeprepare",
      send: function (view) {
        let place = null;
        try { place = JSON.parse(String(view.subject || "")); } catch (e) { place = null; }
        return place ? { body: { place: place } } : null;
      },
      rereads: [],
      done: function (view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && typeof a.text === "string") { cs.set("notice", { text: a.text }); cs.fill("hold-notice", a.text, { label: "screen.start-send.draft.template" }); }
      },
    },
    {
      // R33: "Record that I sent it": the day, how it was sent and a copy or the member's account; no recipient, no read, no
      // compliance of any member is sent or recorded.
      op: "holdnoticesent", outward: true,
      send: function (view, el, cs) {
        let place = null;
        try { place = JSON.parse(String(view.subject || "")); } catch (e) { place = null; }
        const at = String(cs.value("hold-sent-at") || "").trim();
        const account = String(cs.value("hold-account") || "").trim();
        if (!place || !/^\d{4}-\d{2}-\d{2}$/.test(at) || !account) return null;
        return { body: { place: place, at: at, medium: String(cs.value("hold-sent-how") || "email"), account: account } };
      },
      rereads: [],
    },
    WRITE_HELP,
  ],
});
