/* The Action dashboard (registry screen `dash-action`; screens-action R30; K3815, N1028, journey 22; DEC-214 (4); DEC-335,
   K3897). The team's whole Action area at `/app/dash-action`, in the drawing's tiers, each only when its read answers (R14): the
   status readings (clocks running, our move, their move), what is the member's in Action ("Needs you"), and every open action
   with whose move it is and its clock as a sentence with its rule and date, never a countdown. It reads ops only: the visible
   actions, `action` and `filingsfor` for each one listed, and the member's `queue`. Whose move it is is read from facts the
   action states and nothing else: their move when the correspondence holds a sent entry, a reply is owed and none has been recorded
   after it and the action is not resolved; our move when a prepared or approved text awaits approval or sending; an action
   that is neither says neither, and "overdue" is never drawn before a member determines it. It holds no member-facing English
   (R19). Every function here is self-contained (interface-shell R21 (1)). */
import { readOnly, kindWord, draftsOf, stepOf, later, officeLine, namedOf, joinFirst } from "./send-steps.mjs";

export const dashAction = Object.freeze({
  id: "dash-action",

  reads: function () {
    return {
      actions: { op: "actions", query: { limit: "200" }, empty: function () { return false; } },
      queue: { op: "queue", empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      profiles: { op: "profiles", empty: function () { return false; } },
      // R30: the plan checkpoints whose day has come and that no member has judged (`action-plans` R17)
      checkpoints: { op: "checkpointsdue", query: { limit: "500" }, empty: function () { return false; } },
      vocab: { op: "affordances", query: {}, empty: function () { return false; } },
      // E9 (K4557): her own place in each action's project: an invited member is not offered the approval
      standing: { op: "projectlist", query: {}, empty: function () { return false; } },
    };
  },

  parts: {
    readOnly: readOnly, kindWord: kindWord, draftsOf: draftsOf, stepOf: stepOf, later: later, officeLine: officeLine, namedOf: namedOf, joinFirst: joinFirst,
    // R30: an action that is not resolved or abandoned is open
    isOpen: function (state) { return state !== "resolved" && state !== "abandoned"; },
    // R30: whose move it is, from facts the action states: "theirs", "ours" or ""
    whose: function (a, step, checkpoint) {
      const corr = Array.isArray(a.correspondence) ? a.correspondence : [];
      const sentOrds = corr.filter(function (c) { return c.direction === "sent"; }).map(function (c) { return Number(c.ord) || 0; });
      const lastSent = sentOrds.length ? Math.max.apply(null, sentOrds) : -1;
      const answered = corr.some(function (c) { return c.direction === "received" && (Number(c.ord) || 0) > lastSent; });
      if (step === "approve" || step === "second" || step === "send" || checkpoint === true) return "ours";
      if (sentOrds.length && a.reply_owed && a.reply_owed.owed === true && !answered && a.current_state !== "resolved") return "theirs";
      return "";
    },
    // R30: the pending clock entry that falls first, else none
    nextClock: function (a) {
      const c = (Array.isArray(a.clock) ? a.clock : []).filter(function (x) { return x && x.date && (x.status === "pending" || x.status === undefined); })
        .sort(function (x, y) { return String(x.date) < String(y.date) ? -1 : 1; });
      return c.length ? c[0] : null;
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const head = P.readOnly(cs, "screen.dash-action.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.dash-action.sub") + "</p>";
    const today = new Date(cs.now()).toISOString().slice(0, 10);
    return head + cs.state("actions", function (list) {
      const rows = (Array.isArray(list.items) ? list.items : []).filter(function (x) { return P.isOpen(x.state); }).slice(0, 40);
      const voc = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      const pf = view.data.profiles && view.data.profiles.state === "ok" && view.data.profiles.value && view.data.profiles.value.view ? view.data.profiles.value.view : {};
      const windows = Array.isArray(pf.deadlines) ? pf.deadlines : [];
      // each action's own reads (R30: a list row holds neither the title, the correspondence nor the clock)
      const full = rows.map(function (x) {
        const a = P.later(cs, view, "a:" + x.id, "action", { id: x.id }, "");
        const f = P.later(cs, view, "f:" + x.id, "filingsfor", { action: x.id }, "");
        return { row: x, a: a, f: f, v: a.state === "ok" ? a.value : null, step: f.state === "ok" ? P.stepOf(f.value) : "" };
      });
      const ready = full.filter(function (x) { return x.v; });
      // a due, unjudged checkpoint on a plan whose started option made the action is that action's "our move"; a plan with no action counts nowhere
      const cp = view.data.checkpoints && view.data.checkpoints.state === "ok" && view.data.checkpoints.value && Array.isArray(view.data.checkpoints.value.items) ? view.data.checkpoints.value.items : [];
      const planIds = cp.map(function (c) { return c && c.plan; }).filter(function (id, i, all) { return id && all.indexOf(id) === i; }).slice(0, 40);
      const checkpointed = new Set();
      planIds.forEach(function (id) {
        const pl = P.later(cs, view, "p:" + id, "plan", { id: id }, "");
        (pl.state === "ok" && pl.value && Array.isArray(pl.value.options) ? pl.value.options : []).forEach(function (o) { if (o && o.action && o.action.id) checkpointed.add(o.action.id); });
      });
      const move = ready.map(function (x) { return Object.assign({ whose: P.whose(x.v, x.step, checkpointed.has(x.row.id)) }, x); });
      const running = move.filter(function (x) { return P.nextClock(x.v); });
      const week = running.filter(function (x) { const d = String(P.nextClock(x.v).date); return d >= today && d <= new Date(cs.now() + 7 * 86400000).toISOString().slice(0, 10); });
      const ours = move.filter(function (x) { return x.whose === "ours"; });
      const theirs = move.filter(function (x) { return x.whose === "theirs"; });
      const noreply = theirs.filter(function (x) { const c = P.nextClock(x.v); return c && String(c.date) < today; });
      // the status readings: each the count of the rows below that hold the fact; none drawn at zero
      const reading = function (key, n, change) { return n ? cs.reading({ label: key, value: String(n), change: change || null }) : ""; };
      const oursDay = ours.map(function (x) { const c = P.nextClock(x.v); return c ? String(c.date) : ""; }).filter(Boolean).sort()[0] || "";
      const tiles = reading("screen.dash-action.tile.clocks", running.length, week.length ? { key: "screen.dash-action.tile.dueweek", fills: { n: String(week.length) } } : null)
        + reading("screen.dash-action.tile.ours", ours.length, oursDay ? { key: "screen.dash-action.tile.dueday", fills: { day: { html: cs.date(oursDay) } } } : null)
        + reading("screen.dash-action.tile.theirs", theirs.length, noreply.length ? { key: "screen.dash-action.tile.noreply", fills: { n: String(noreply.length) } } : null);
      const status = tiles ? '<div class="mk-tiles">' + tiles + "</div>" : "";

      // what is the member's in Action: a prepared text awaiting her approval, and the queue's items of Action's kinds
      const q = view.data.queue && view.data.queue.state === "ok" && view.data.queue.value && Array.isArray(view.data.queue.value.items) ? view.data.queue.value.items : [];
      const KINDS = ["action-clock-overdue", "action-reminder", "request-unsent"];
      const mine = q.filter(function (it) { return it && KINDS.includes(it.kind); });
      const approve = ready.filter(function (x) { return x.step === "approve"; }).map(function (x) {
        const d = P.draftsOf(x.f.value).open;
        // E9 (K4557): the action of a project she is invited to and has not joined is opened (where she is told and can accept), not approved here
        if (P.joinFirst(cs, view, x.v.project)) return cs.row("", cs.esc(x.v.title || x.row.id) + '<span class="meta"><a class="cs-ref" href="/app/action/' + encodeURIComponent(x.row.id) + '" data-nav>' + cs.w("screen.start-send.openaction") + "</a></span>", "", "");
        return cs.row("", cs.esc(x.v.title || x.row.id) + '<span class="meta">' + cs.act("filingapprove", { label: "act.filingapprove.label.dash-action", data: { filing: d ? d.filing : "" } }) + "</span>", "", "");
      });
      const queueRows = mine.map(function (it, i) {
        const has = function (op) { return (Array.isArray(it.options) ? it.options : []).some(function (o) { return o && (o.id || o.op) === op; }) || (it.disposition && it.disposition.op === op); };
        const subject = it.subject && it.subject.id ? String(it.subject.id) : "";
        const entry = it.subject && it.subject.entry !== undefined ? String(it.subject.entry) : "0";
        const remind = has("reminderanswer") ? cs.field("dash-on-" + i, "screen.queue.reminder.on", { type: "date" })
          + cs.act("reminderanswer", { label: "act.reminderanswer.label.dash-action", data: { subject: subject, entry: entry, f: "dash-on-" + i } }) : "";
        return cs.row("", '<a class="cs-ref" href="/app/queue" data-nav>' + cs.esc(it.summary || it.title || it.kind) + "</a>" + (remind ? '<span class="meta">' + remind + "</span>" : ""),
          it.due ? cs.date(it.due) : "", "");
      });
      const needs = approve.length || queueRows.length ? cs.sec("home.needsyou.title", cs.sheet(approve.concat(queueRows).join("")), { help: "screen.dash-action.tip.yours" }) : "";

      // every open action: to whom, whose move, the clock as a sentence with its rule and date, the next step
      const whoOf = function (v) {
        const ad = v.addressee;
        // R65 (T53): an addressee that is no office (an audience the member described, "Public Works Director") is drawn as named
        return cs.esc((ad ? P.officeLine(ad) || ad.description || "" : "") || P.namedOf(v.counterparty));
      };
      const clockOf = function (x) {
        const v = x.v, c = P.nextClock(v);
        if (!c) return "";
        const law = v.governing_laws && Array.isArray(v.governing_laws.laws) && v.governing_laws.laws.length ? v.governing_laws.laws[0] : null;
        const win = law ? windows.find(function (d) { return d.citation === law.citation; }) : null;
        const ad = v.addressee ? P.officeLine(v.addressee) : "";
        const sent = (Array.isArray(v.correspondence) ? v.correspondence : []).find(function (e) { return e.direction === "sent"; });
        if (x.whose === "theirs" && win && win.amount && ad) return cs.w("screen.dash-action.clock.due", { office: ad, date: { html: cs.date(c.date) }, days: String(win.amount), law: law.citation });
        if (sent && c.date) return cs.w("screen.dash-action.clock.sent", { date: { html: cs.date(sent.at) }, due: { html: cs.date(c.date) } });
        return "";
      };
      const nextOf = function (x) {
        if (x.whose === "theirs") return cs.w("screen.dash-action.next.record");
        return "";
      };
      const table = move.length ? cs.sec("screen.dash-action.every.heading", '<table class="mk-table"><thead><tr><th>' + cs.w("screen.dash-action.col.action") + "</th><th>"
        + cs.w("screen.dash-action.col.to") + "</th><th>" + cs.w("screen.dash-action.col.whose") + "</th><th>" + cs.w("screen.dash-action.col.clock") + "</th><th>"
        + cs.w("screen.dash-action.col.next") + "</th></tr></thead><tbody>" + move.map(function (x) {
          const kindName = P.kindWord(cs, x.v.kind || "other", false, voc.action_kind_labels);
          return "<tr><td>" + '<a class="cs-ref" href="/app/action/' + encodeURIComponent(x.row.id) + '" data-nav>' + cs.esc(x.v.title || x.row.id) + "</a>" + (kindName ? " · " + kindName : "") + "</td><td>"
            + whoOf(x.v) + "</td><td>" + (x.whose === "theirs" ? cs.w("screen.dash-action.tile.theirs") : x.whose === "ours" ? cs.w("screen.dash-action.tile.ours") : "")
            + "</td><td>" + clockOf(x) + "</td><td>" + nextOf(x) + "</td></tr>";
        }).join("") + "</tbody></table>", { help: "screen.dash-action.tip.every" }) : "";

      // "Start an action" opens the composer on the project the member chooses
      const projects = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles) ? view.data.projects.value.bundles : [];
      const start = projects.length ? cs.choice("dash-project", "screen.actionnew.name", projects.map(function (b) { return { value: b.bundle_id, text: b.title || b.bundle_id }; }))
        + '<div class="mk-acts">' + cs.act("actioncreate", { tone: "primary" }) + "</div>" : "";
      const body = status + needs + table + start;
      return body;
    });
  },

  acts: [
    {
      // R30: "Start an action": opens the composer on the project chosen; nothing is written here.
      op: "actioncreate", reasonField: "reason",
      send: function (view, el, cs) { const p = cs.value("dash-project"); if (p) cs.go("actionnew", p); return null; },
    },
    {
      // R30: "Remind me again on…": the day the member chooses, on the action the reminder was set for
      op: "reminderanswer",
      send: function (view, el, cs) {
        const on = String(cs.value(el.dataset.f) || "").trim();
        const body = { target: el.dataset.subject, entry: Number(el.dataset.entry || 0) };
        if (on) body.on = on;
        return { body: body };
      },
      rereads: ["queue"],
    },
    {
      // R30: "Approve the text" on a prepared text awaiting the member's approval (terminal: approving fixes the text).
      op: "filingapprove",
      send: function (view, el) { return { body: { filing: el.dataset.filing } }; },
      rereads: ["actions"],
    },
  ],
});
