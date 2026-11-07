/* The member's queue (registry screen `queue`; screens-daily R2, R3, R7, R12, R13, R18, R19, R21, R22; DEC-110, DEC-131, DEC-201 (13), DEC-212,
   DEC-226 (1)). Everything waiting on the
   member, drawn by kind (To do, Noticed, Status) and grouped by case, in the sort they chose; each item's acts are its own
   decorated options and the door its disposition names (queue R12, R17, R46), drawn when the op is one of the screen's
   registered acts, and any other option as "Open". The sort is the route's subject (`/app/queue/due`), so a chosen sort
   survives a reload and the browser's history (interface-shell R9). With nothing waiting it says the member is up to date
   (R12). The unsent-request item (`action-producers` R25) draws its own three acts (R13). "Mute a kind" mutes the item's
   kind for its nearest home case (R18). The update to-do has its own section, "Your group's Civicsmith" (R19). The source
   notices of one kind are one item with their count, opening the list of their documents (R22, the `sourceItems` part).
   Every function is self-contained (interface-shell R21 (1)). */
import { sourceItems } from "./source-items.mjs";
import { itemWords } from "./item-words.mjs";
import { queueStates } from "./queue-states.mjs";
import { doors } from "./doors.mjs";
import { todos } from "./todos.mjs";
import { forward } from "./forward.mjs";
import { notices } from "./notices.mjs";
import { routed, ROUTED_REFUSALS } from "./routed.mjs";
import { OPS } from "../op-declarations/index.mjs";

// An act whose op the owners have not yet declared is not registered (screens-action's rule): `taskdecide` is `tasks`' alone.
const OWED = function (spec) { return Object.hasOwn(OPS, spec.op) ? [spec] : []; };

export const queue = Object.freeze({
  id: "queue",
  parts: { sourceItems, itemWords, queueStates, doors, routed, todos, forward, notices },

  // R2: `queue` R49's sorts; any other subject reads the default (by case, then kind). R59, R61: `/app/queue/answered` reads what the
  // member answered and the set-aside findings; R58: `/app/queue/choose` reads the queue as it is, each item with a box. The queue's
  // reads are `refresh: true` (R60, interface-shell R93): the shell reads them again while the screen is on view.
  reads: function (view) {
    const SORTS = ["added", "due", "case", "kind"];
    const sub = String(view.subject || "");
    const none = function (key) { return function (v) { return !v || !Array.isArray(v[key]) || v[key].length === 0; }; };
    if (sub === "answered") {
      return {
        answered: { op: "queue", query: { answered: "true" }, refresh: true, empty: none("answered") },
        aside: { op: "queue", query: { aside: "true", limit: "200" }, refresh: true, empty: none("aside") },
      };
    }
    const sort = SORTS.indexOf(sub) >= 0 ? sub : "";
    return {
      queue: {
        op: "queue", query: sort ? { sort: sort } : {}, refresh: true,
        empty: function (v) { return !v || !Array.isArray(v.items) || v.items.length === 0; },
      },
      // R50 (1): what the member has muted, `queue` R55's list, at the foot.
      muted: { op: "queue", query: { muted: "true" }, empty: none("muted") },
      // R65: the doors to Held captures and the Inbox, on the list only.
      held: view.parts.doors().reads().held,
      inbox: view.parts.doors().reads().inbox,
      // R17 (B21): the photos she captured and has not vouched for are rows of the `held` read above (C14, P2.3).
      // C75: the members a task may be passed to, a choice.
      roster: { op: "memberlist", empty: none("members") },
    };
  },

  render: function (cs, view) {
    const SORTS = ["added", "due", "case", "kind"];
    const CLASS_KIND = { OBLIGATION: "todo", FINDING: "noticed", CONDITION: "status" };
    // The registry's acts (R3, R13), less `projectkeyset`, retired at the door in T53 with no alias (op-declarations R41, ai-accounts R35; F2), under the names options and dispositions carry (OP_ALIASES' targets included);
    // `actionmove` is drawn only on the unsent-request item, by R13's own rule below.
    const REGISTERED = {
      taskresolve: "taskresolve", taskforward: "taskforward", proposedispose: "proposedispose", queuesnooze: "queuesnooze",
      queuemute: "queuemute", adoptversion: "adoptversion", versionadopt: "adoptversion", keepversion: "keepversion",
      versionkeep: "keepversion", reminderanswer: "reminderanswer", promote: "promote",
      exploreapprove: "exploreapprove", signerknown: "signerknown", updatelater: "updatelater", projectjoin: "projectjoin", projectrequestanswer: "projectrequestanswer", filingapprove: "filingapprove",
    };
    const sort = SORTS.indexOf(String(view.subject || "")) >= 0 ? String(view.subject) : "case";
    const ui = view.ui || {};
    const sub = String(view.subject || "");
    const choosing = sub === "choose";
    const choosingNow = function () { return choosing || sub === "answered"; };
    const states = view.parts.queueStates();
    // R58: an outcome is shown only on the choosing route; leaving it drops the outcome, so choosing again starts clean.
    if (!choosing && ui.outcome) ui.outcome = null;
    // The fields an act needs from the member, drawn in place in a disclosure with the act (interface-shell R11's dialog is
    // a terminal or signed act's; these are not), each read by the act's `send` through `cs.value`.
    const FIELDS = {
      taskforward: [["to", "screen.queue.forward.to"]], adoptversion: [["why", "screen.queue.why"]],
      reminderanswer: [["on", "screen.queue.reminder.on"]], promote: [["question", "screen.queue.question"]],
      queuesnooze: [["until", "screen.queue.snooze.until"]],
    };
    // R79 (a): an item's own act (not putting it aside) carries `queue.act.dothis.help`; Open carries `queue.act.open.help`. The help
    // joins the explanation the button already has, never a second one around it.
    const OWN = ["adoptversion", "keepversion", "reminderanswer", "promote", "exploreapprove", "projectjoin", "projectrequestanswer"];
    const helped = function (html, key) {
      if (!html) return html;
      const add = cs.esc('<span class="why">' + cs.w(key) + "</span>");
      const i = html.indexOf(' data-tip="');
      if (i < 0) return html.replace("<button", '<button data-level="2" data-tip="' + add + '"');
      const j = html.indexOf('"', i + 11);
      return html.slice(0, j) + add + html.slice(j);
    };
    const own = function (html) { return helped(html, "queue.act.dothis.help"); };
    const openLink = function (to) {
      return '<a class="cs-btn" data-tone="quiet" data-nav href="' + to + '" data-level="2" data-tip="' + cs.esc(cs.w("queue.act.open.help")) + '">' + cs.w("screen.queue.open") + "</a>";
    };
    let seq = 0;
    const actOf = function (op, data, it) {
      // R42: an owner answers a request to join with Grant or Decline, the answers the item's option carries (queue-producers R42).
      if (op === "projectrequestanswer") {
        const opt = (it && Array.isArray(it.options) ? it.options : []).filter(function (o) { return o && (o.id || o.op) === op; })[0];
        const answers = opt && Array.isArray(opt.answers) && opt.answers.length ? opt.answers
          : [{ answer: "grant", label: "screen.home.request.grant" }, { answer: "decline", label: "screen.home.request.decline" }];
        // R104: a place to add a word (`project-roster` R12: at most 280 characters), read by the act's `send` through `cs.value`.
        // one place for each request, by the project and the requester, so a word written for one is never sent with another
        const f = ("qa-" + data.project + "-" + data.who).replace(/[^A-Za-z0-9_-]/g, "_");
        const buttons = answers.map(function (a) {
          return own(cs.act(op, { label: "screen.home.request." + (String(a.answer) === "decline" ? "decline" : "grant"), data: Object.assign({ answer: String(a.answer), f: f }, data) }));
        }).join("");
        return buttons ? cs.field(f + "-comment", "screen.plan.judge.note", { max: 280 }) + buttons : "";
      }
      // R68: Defer beside Dismiss, each asking the member's reason in place; one act, the button's `data-to` says which.
      if (op === "proposedispose") {
        return cs.act(op, { label: "act.proposedispose.label.queue", data: Object.assign({}, data, { to: "dismissed" }) })
          + cs.act(op, { label: "screen.queue.defer", data: Object.assign({}, data, { to: "deferred" }) });
      }
      // R107: the act that ends the signing-key item is labelled by the item's own word.
      // The producer's item names the member as its subject and carries each listed key on its own option (`queue-producers`
      // R56): one act for each key, sending that key and no other.
      if (op === "signerknown") {
        const keys = (it && Array.isArray(it.options) ? it.options : []).filter(function (o) { return o && (o.id || o.op) === op && typeof o.key === "string" && o.key; });
        return keys.map(function (o) { return own(cs.act(op, { label: "queue.signer-self-registered.known", data: Object.assign({}, data, { key: o.key }) })); }).join("");
      }
      const fields = FIELDS[op];
      if (!fields) return OWN.indexOf(op) >= 0 ? own(cs.act(op, { label: "act." + op + ".label.queue", data: data })) : cs.act(op, { label: "act." + op + ".label.queue", data: data });
      const f = "qa-" + (seq++);
      const button = cs.act(op, { label: "act." + op + ".label.queue", data: Object.assign({}, data, { f: f }) });
      return button ? '<details class="mk-details"><summary>' + cs.w("act." + op + ".label.queue") + "</summary>"
        + fields.map(function (x) { return x[0] === "until" ? states.dayField(cs, f + "-until") : x[0] === "to" ? view.parts.forward().field(cs, view, f + "-to") : cs.field(f + "-" + x[0], x[1], {}); }).join("")
        + (OWN.indexOf(op) >= 0 ? own(button) : button) + "</details>" : "";
    };

    const caseOf = function (it) {
      const c = it.case || {};
      const a = Array.isArray(c.ancestors) ? c.ancestors : [];
      const p = a.filter(function (x) { return x && x.type === "project"; })[0] || a[a.length - 1];
      return c.ungrouped || !p ? null : p;
    };
    // R18: the item's nearest home case, a question or a project (the ancestor of least depth).
    const nearestOf = function (it) {
      const c = it.case || {};
      if (c.ungrouped) return null;
      const a = (Array.isArray(c.ancestors) ? c.ancestors : []).filter(function (x) { return x && x.id && (x.type === "inquiry" || x.type === "project"); });
      a.sort(function (x, y) { return (Number(x.depth) || 0) - (Number(y.depth) || 0); });
      return a[0] || null;
    };
    const today = new Date(cs.now()).toISOString().slice(0, 10);
    const dueOf = function (iso) {
      const day = String(iso).slice(0, 10);
      if (day < today) return cs.due(String(iso), "");
      const soon = new Date(cs.now() + 2 * 86400000).toISOString().slice(0, 10);
      return cs.due(String(iso), day === today || day <= soon ? "near" : "");
    };
    const hintOf = function (it) {
      const h = it.hint && typeof it.hint === "object" ? it.hint : null;
      if (!h) return "";
      const rate = typeof h.false_alarm_rate === "number" ? h.false_alarm_rate : (typeof h.rate === "number" ? h.rate : null);
      // The false-alarm sentence names the rate, how many of the hints looked into were false and why most were (the word's own
      // placeholders); a rate the hint gives without those is not drawn, and no rate recorded says so.
      const known = rate !== null && h.looked !== undefined && h.looked !== null && h.false !== undefined && h.false !== null && typeof h.reason === "string" && h.reason;
      const trust = rate === null ? cs.w("screen.queue.hint.rate.none")
        : known ? cs.w("screen.queue.hint.rate", { rate: String(Math.round(rate <= 1 ? rate * 100 : rate)), false: String(h.false), looked: String(h.looked), reason: h.reason }) : "";
      const dl = '<dl class="mk-dl">'
        + (h.matched ? "<dt>" + cs.w("screen.queue.hint.matched") + "</dt><dd>" + cs.esc(h.matched) + "</dd>" : "")
        + (h.how ? "<dt>" + cs.w("screen.queue.hint.method") + "</dt><dd>" + cs.esc(h.how) + "</dd>" : "")
        + (trust ? "<dt>" + cs.w("screen.queue.hint.trust") + "</dt><dd>" + trust + "</dd>" : "")
        + "<dt>" + cs.w("screen.queue.hint.not") + "</dt><dd>" + (h.not ? cs.esc(h.not) : cs.w("screen.queue.hint.not.text")) + "</dd></dl>";
      return '<details class="mk-hintd"><summary>' + cs.hint() + " " + cs.w("screen.queue.hint.how") + "</summary>" + dl + "</details>";
    };
    // The acts an item offers (R3): its options and its disposition's door, each once, those registered drawn.
    const actsOf = function (it, cas) {
      const ops = [];
      const add = function (op) { const r = REGISTERED[op]; if (r && ops.indexOf(r) < 0) ops.push(r); };
      let other = false;
      (Array.isArray(it.options) ? it.options : []).forEach(function (o) {
        const id = o && (o.id || o.op);
        if (REGISTERED[id]) add(id); else if (id) other = true;
      });
      const d = it.disposition || {};
      // R107 (A-03): the signing key a member registered for herself is answered "I know about this key" (`signerknown`, credentials R83).
      if (it.kind === "signer-self-registered") add("signerknown");
      if (d.available && d.op) add(d.op);
      (Array.isArray(d.acts) ? d.acts : []).forEach(add);
      if (d.instead) add(d.instead);
      if (it.class !== "OBLIGATION") add("queuemute");
      const near = nearestOf(it);
      const data = {
        mutecase: near ? String(near.id) : "",
        item: it.id, cls: it.class || "", kind: it.kind || "",
        subject: it.subject && it.subject.id ? String(it.subject.id) : "",
        who: it.subject && it.subject.requester ? String(it.subject.requester) : (it.fills && it.fills.who ? String(it.fills.who) : ""),
        entry: it.subject && it.subject.entry !== undefined ? String(it.subject.entry) : "",
        day: it.subject && it.subject.day ? String(it.subject.day) : "",
        owner: it.basis && it.basis.owner ? String(it.basis.owner) : "",
        notice: d.notice ? String(d.notice) : "",
        notices: view.parts.notices().of(it),
        finding: d.finding ? String(d.finding) : "",
        project: d.project ? String(d.project) : (Array.isArray(d.projects) && d.projects[0] ? String(d.projects[0]) : (cas ? String(cas.id) : "")),
      };
      // R42: an invitation or a request to join names its project as its subject, not as a case.
      if ((it.kind === "project-invitation" || it.kind === "project-request") && it.subject && it.subject.id) data.project = String(it.subject.id);
      const drawn = ops.map(function (op) { return actOf(op, data, it); }).join("");
      const to = iw.open(it);
      const open = other && to ? openLink(to) : "";
      // R79 (e): the signing key a member registered for herself is withdrawn on Members, which the item opens.
      const members = it.kind === "signer-self-registered" ? '<a class="cs-btn" data-tone="quiet" data-nav href="/app/members">' + cs.w("queue.signer-self-registered.members") + "</a>" : "";
      return drawn + open + members;
    };
    // R13 (DEC-212; `action-producers` R25): the unsent request: "Pick up where you left off" opens the records request at
    // its step (the `request` screen takes the action's id; K3145),
    // "Keep it for later" snoozes its case (`queue` R21), "Drop the request, with a reason" moves the action to `abandoned`.
    const unsentActs = function (it, cas) {
      const id = it.subject && it.subject.id ? String(it.subject.id) : "";
      const pick = id ? '<a class="cs-btn" data-tone="quiet" data-nav href="/app/request/' + encodeURIComponent(id) + '">' + cs.w("screen.queue.unsent.pickup") + "</a>" : "";
      const f = "qa-" + (seq++);
      const snoozeBtn = cas ? cs.act("queuesnooze", { label: "screen.queue.unsent.keep", data: { project: String(cas.id), f: f } }) : "";
      const snooze = snoozeBtn ? '<details class="mk-details"><summary>' + cs.w("screen.queue.unsent.keep") + "</summary>"
        + states.dayField(cs, f + "-until") + snoozeBtn + "</details>" : "";
      const drop = id ? cs.act("actionmove", { label: "screen.queue.unsent.drop", here: "queue", data: { item: it.id, action: id } }) : "";
      return pick + snooze + drop;
    };
    const src = view.parts.sourceItems();
    const iw = view.parts.itemWords();
    const pickBox = function (it) {
      const on = Array.isArray(ui["pick:queue"]) && ui["pick:queue"].indexOf(String(it.id)) >= 0;
      const name = (iw.words(cs, it).summary || "").replace(/<[^>]*>/g, "") || String(it.id);
      return '<input type="checkbox" class="mk-pick" id="queue-pick-' + cs.esc(String(it.id)) + '" data-shell="pick" data-table="queue" data-id="' + cs.esc(String(it.id)) + '"'
        + (on ? " checked" : "") + ' aria-label="' + cs.w("screen.finder.pick", { title: name }) + '">';
    };
    const itemRow = function (it, picking) {
      // R17, C70: a to-do to vouch for the photos she captured, drawn with the list among what is in no case.
      if (it.vouch !== undefined) return it.vouch;
      // R58: the choosing state draws a box on each item and its kind beside the words.
      if (picking && !it.sources) {
        const wd0 = iw.words(cs, it);
        return cs.row(pickBox(it), wd0.summary + '<span class="meta">' + cs.mark("kind", CLASS_KIND[it.class] || "status") + (wd0.detail ? " " + wd0.detail : "") + "</span>", "", "");
      }
      // R22: one kind's source notices as one item with its count; each document with its own options.
      if (it.sources) {
        const g = src.draw(cs, it, function (x) { return actsOf(x, caseOf(x)); });
        return cs.row(cs.mark("kind", CLASS_KIND[it.class] || "noticed"), g.list + '<span class="meta">' + g.detail + "</span>", "", "");
      }
      const cas = caseOf(it);
      // R75: the decisions the record routes to a member: the authority form, an endorsement, an owner vote, an expertise.
      const rt = view.parts.routed().draw(cs, it, { screen: "queue", id: "qr-" + (seq++), ref: iw.subject(cs, it), mark: own, pick: function (id) { return view.parts.forward().field(cs, view, id); } });
      // A decision with no act of this screen (a vote to remove an owner) leads to its subject's screen with "Open".
      if (rt) return cs.row(cs.mark("kind", CLASS_KIND[it.class] || "status"), rt.summary + '<span class="meta">' + rt.detail + "</span>" + '<span class="mk-acts">' + (rt.acts || (iw.open(it) ? openLink(iw.open(it)) : "")) + "</span>", it.due ? dueOf(it.due) : "", "");
      // R28, R31: the subject by its title, the act by its label; a reply owed and not recorded, never "overdue".
      const wd = iw.words(cs, it);
      return cs.row(cs.mark("kind", CLASS_KIND[it.class] || "status"),
        wd.summary + (wd.detail ? '<span class="meta">' + wd.detail + "</span>" : "") + hintOf(it)
          + '<span class="mk-acts">' + (it.kind === "request-unsent" ? unsentActs(it, cas) : actsOf(it, cas)) + "</span>",
        it.due ? (iw.ours(cs, it) || dueOf(it.due)) : "", "");
    };

    // The three-kinds note: once per member, on the device (R2). Decided once per visit and kept in the screen's page
    // memory, so the page's redraws keep it while the member is here.
    if (ui.kindsNote === undefined) {
      let show = false;
      try {
        const store = globalThis.localStorage;
        const k = "bio-queue-kinds-note:" + (view.me && view.me.member ? view.me.member : "");
        if (store && !store.getItem(k)) { store.setItem(k, "shown"); show = true; }
      } catch (e) { show = false; }
      ui.kindsNote = show;
    }
    const note = ui.kindsNote
      ? '<p class="mk-note">' + cs.w("screen.queue.note") + ' <span class="muted">' + cs.w("screen.queue.note.once") + "</span></p>" : "";

    const sorts = '<nav class="mk-sortrow" aria-label="' + cs.w("screen.queue.sort") + '"><span>' + cs.w("screen.queue.sort") + "</span> "
      + SORTS.map(function (s) {
        return s === sort ? '<b aria-current="true">' + cs.w("screen.queue.sort." + s) + "</b>"
          : '<a data-nav href="/app/queue/' + s + '">' + cs.w("screen.queue.sort." + s) + "</a>";
      }).join(" · ") + "</nav>";

    // R19 (DEC-226 (1)): the update to-do, under its own section: the release, its date, the security mark when marked,
    // "See what changes" (opening `updates`) and Not now (`updatelater`).
    const updateSection = function (list) {
      if (!list.length) return "";
      return cs.sec("queue.update.section", cs.sheet(list.map(function (it) {
        const d = it.detail && typeof it.detail === "object" ? it.detail : {};
        const version = String(d.version || it.version || "");
        const security = (d.security !== undefined ? d.security : it.security) === true;
        const mark = security ? '<span class="mk-tag" tabindex="0" data-level="1" data-tip="' + cs.w("updates.ready.security_says") + '">' + cs.w("updates.ready.security") + "</span> " : "";
        const acts = '<a class="cs-btn" data-tone="quiet" data-nav href="/app/updates">' + cs.w("queue.update.see") + "</a>"
          + cs.act("updatelater", { label: "act.owed_updatelater.label.queue", data: { version: version } });
        return cs.row(cs.mark("kind", "todo"), mark + cs.w("queue.update.ready", { version: version, date: { html: cs.date(String(d.date || it.date || "")) } })
          + '<span class="mk-acts">' + acts + "</span>", it.due ? dueOf(it.due) : "", "");
      }).join("")), { help: "queue.update.section_says" });
    };

    // The list, by case: the default view (R2) or the choosing state (R58: a box on each item, the source notices not folded). C70: her
    // photos to vouch for are to-dos of hers among what is in no case: counted with the list, placed in the sort the member chose, and drawn
    // with it, so the list waits for her captures to be read rather than drawing twice.
    const todos = view.parts.todos();
    const vouch = choosingNow() ? [] : todos.items(cs, view, "queue");
    // C70: the vouch rows are a band the shell's number does not know: this screen reports how many it draws (once her captures are read),
    // whatever state it is in, and the masthead and the rail add it to the queue's own count.
    if (!todos.loading(view)) cs.band(choosingNow() ? todos.items(cs, view, "queue").length : vouch.length);
    const listOf = function (picking) {
      if (!picking && todos.loading(view)) return cs.state({ state: "loading" }, null);
      const draw = function (q) {
        const all = Array.isArray(q.items) ? q.items : [];
        const updates = picking ? [] : all.filter(function (it) { return it && it.kind === "update-ready"; });
        const others = picking ? all : all.filter(function (it) { return !(it && it.kind === "update-ready"); });
        // R69: an item of a snoozed case is held back from the list, and the snoozed cases are listed apart with "Bring back".
        const held = picking ? [] : others.filter(function (it) { return it && it.snoozed; });
        const rest = picking ? others : others.filter(function (it) { return !(it && it.snoozed); });
        const items = picking ? rest : todos.merge(src.fold(rest), vouch, sort);
        const groups = [];
        const at = {};
        items.forEach(function (it) {
          const c = caseOf(it.sources ? it.sources[0] : it);
          const key = c ? String(c.id) : "";
          if (!(key in at)) { at[key] = groups.length; groups.push({ c: c, items: [] }); }
          groups[at[key]].items.push(it);
        });
        const n = typeof q.item_count === "number" ? q.item_count + vouch.length : items.length;
        // C73: the line says how the list is sorted: by case it is grouped by case, any other sort is named.
        const how = sort === "case" ? cs.w("screen.queue.grouped") : cs.w("screen.queue.sorted", { sort: { html: cs.w("screen.queue.sort." + sort) } });
        const head = picking ? '<p class="mk-sub">' + cs.w("queue.multi.head") + " " + cs.w("queue.multi.head2") + "</p>"
          : '<p class="mk-sub"><span>' + (n === 1 ? cs.w("screen.queue.count.one") : cs.w("screen.queue.count.many", { n: String(n) }))
          + "</span> · <span>" + how + "</span></p>";
        // R95 (C70): what the number counts, in the words the masthead's explanation holds: the items the list holds by their three kinds, the
        // member's own vouch to-dos among the to-dos. The doors' numbers (held captures, knocks) are told apart, with the doors, above.
        const kindN = function (c) { return all.filter(function (x) { return x && x.class === c; }).length + (c === "OBLIGATION" && !picking ? vouch.length : 0); };
        const says = picking ? "" : '<p class="mk-small">' + cs.w("shell.queue.waiting", { n: String(kindN("OBLIGATION") + kindN("FINDING") + kindN("CONDITION")),
          todo: String(kindN("OBLIGATION")), noticed: String(kindN("FINDING")), status: String(kindN("CONDITION")) }) + "</p>";
        return head + says + updateSection(updates) + states.snoozed(cs, held) + groups.map(function (g) {
          const title = g.c ? cs.ref("project", g.c.id, g.c.title || g.c.id, []) : cs.w("screen.queue.nocase");
          const snooze = g.c && !picking ? '<span class="mk-acts">' + actOf("queuesnooze", { project: String(g.c.id) }) + "</span>" : "";
          return '<section class="cs-section mk-sec"><h2>' + title + "</h2>" + snooze + cs.sheet(g.items.map(function (it) { return itemRow(it, picking); }).join("")) + "</section>";
        }).join("") + (q.truncated ? '<p class="mk-note">' + (function (m) { return m === 1 ? cs.w("screen.queue.more.one") : cs.w("screen.queue.more", { n: String(m) }); })(Math.max(0, n - items.length)) + "</p>" : "");
      };
      const qq = view.data.queue;
      // Nothing waiting but her photos to vouch for: the list holds them alone.
      if (!picking && vouch.length && qq && qq.state === "empty") return draw({ items: [] });
      return cs.state("queue", draw, { empty: "screen.queue.empty" });
    };

    // R50 (1): "Muted", at the foot: each kind muted in a project, and each item muted on its own, with "Turn back on". A row
    // with no instant says `queue.muted.by.undated`, never a blank date. Not drawn when nothing is drawable.
    const mutedPart = (function () {
      const m = view.data.muted;
      if (!m || m.state === "loading" || m.state === "empty") return "";
      if (m.state === "failed") return cs.sec("queue.muted.title", cs.state("muted", null), { help: "queue.muted.help" });
      const rows = (m.value && Array.isArray(m.value.muted) ? m.value.muted : []).map(function (r) {
        if (!r) return "";
        const by = r.at ? cs.w("queue.muted.by", { date: { html: cs.date(String(r.at)) } }) : cs.w("queue.muted.by.undated");
        if (r.kind && r.case && r.case.id) {
          const unmute = cs.act("queuemute", { label: "queue.muted.unmute", here: "queue_kind", data: { unmute: "kind", mutecase: String(r.case.id), kind: String(r.kind) } });
          return cs.row("", cs.w("queue.muted.kind", { kind: { html: cs.w("queue.kind." + String(r.kind)) }, project: { html: cs.ref("project", String(r.case.id), r.case.title || String(r.case.id), []) } })
            + '<span class="meta">' + by + "</span>", unmute, "");
        }
        if (r.item) {
          const unmute = cs.act("queuemute", { label: "queue.muted.unmute", data: { unmute: "item", item: String(r.item) } });
          // R61 (2): the item by its title, else its kind's plain name, never its id; with neither, the shell's unread word.
          const named = typeof r.title === "string" && r.title.trim() ? r.title : r.kind ? { html: cs.w("queue.kind." + String(r.kind)) } : { html: cs.w("shell.unread") };
          return cs.row("", cs.w("queue.muted.item", { item: named }) + '<span class="meta">' + by + "</span>", unmute, "");
        }
        return "";
      }).filter(Boolean);
      return rows.length ? cs.sec("queue.muted.title", cs.sheet(rows.join("")), { help: "queue.muted.help" }) : "";
    })();
    const doneNote = (typeof ui.done === "string" && ui.done
      ? '<p class="mk-note" role="status">' + cs.w("queue.done", { what: { html: cs.w(ui.doneFor && ui.doneFor.op === ui.done ? ui.doneFor.label : "act." + ui.done + ".label.queue") } }) + "</p>" : "")
      + view.parts.routed().shown(cs, ui);

    // R41, R60: with nothing waiting and every feed answered, the sentence, each class "none here", the up-to-date row and the door to
    // Home; with a feed that did not answer, the all-clear is withheld and the failed feed named with "Try again".
    const q = view.data.queue;
    const qv = q && (q.state === "ok" || q.state === "empty") && q.value && typeof q.value === "object" ? q.value : {};
    const again = "/app/queue" + (sub ? "/" + sub : "");
    const failedRow = states.failedFeeds(cs, qv, again);
    const wordsOf = function (it) { const wd = iw.words(cs, it); return wd.summary || cs.esc(String(it.id)); };
    const doorOf = function (it, op) {
      const c = caseOf(it);
      return REGISTERED[op] ? actOf(REGISTERED[op], { item: it.id, project: c ? String(c.id) : "", subject: it.subject && it.subject.id ? String(it.subject.id) : "" }, it)
        : (function () { const to = iw.open(it); return to ? '<a class="cs-btn" data-tone="quiet" data-nav href="' + to + '">' + cs.w("screen.queue.open") + "</a>" : ""; })();
    };
    // R59, R61: what the member answered, and the findings set aside, on the same page; the aside is paged by `after` to its end.
    if (sub === "answered") {
      const first = view.data.aside && view.data.aside.state === "ok" && view.data.aside.value && Array.isArray(view.data.aside.value.aside) ? view.data.aside.value.aside : [];
      const av = view.data.aside && view.data.aside.state === "ok" ? view.data.aside.value : null;
      if (Array.isArray(ui.asideAll) === false && av && av.truncated && av.next && !ui.asideWalking) {
        ui.asideWalking = true;
        const rows = first.slice();
        const walk = function (after) {
          return cs.call("queue", { query: { aside: "true", limit: "200", after: after } }).then(function (a) {
            const v = a && typeof a === "object" ? (a.result && typeof a.result === "object" ? a.result : a) : null;
            if (!v || v.ok === false || !Array.isArray(v.aside)) return rows;
            v.aside.forEach(function (r) { rows.push(r); });
            return v.truncated && v.next ? walk(String(v.next)) : rows;
          }, function () { return rows; });
        };
        walk(String(av.next)).then(function (all) { cs.set("asideAll", all); });
      }
      const drawn = Array.isArray(ui.asideAll) ? ui.asideAll : first;
      return states.answered(cs, view, states.aside(cs, view, drawn));
    }
    // R58: the outcome of a set act (state e), and the choosing state (state d) with its hold strip.
    if (choosing && ui.outcome) return states.outcome(cs, view, ui.outcome, wordsOf, doorOf);
    if (choosing) {
      const picked = Array.isArray(ui["pick:queue"]) ? ui["pick:queue"] : [];
      const have = q && q.state === "ok" && q.value && Array.isArray(q.value.items) ? q.value.items.filter(function (it) { return it && picked.indexOf(String(it.id)) >= 0; }).length : 0;
      return cs.title(undefined, {}) + doneNote + listOf(true) + (have ? states.strip(cs, have, view.parts.forward().field(cs, view, "qm-to")) : "") + '<p class="mk-acts"><a class="cs-btn" data-tone="quiet" data-nav href="/app/queue">' + cs.w("queue.multi.back") + "</a></p>" + mutedPart;
    }
    // R65: the doors to Held captures and the Inbox, on the list and its empty states.
    const doorsHtml = view.parts.doors().draw(cs, view, "queue");
    // R17 (B21, C70): her photos to vouch for are to-dos of hers, in the list, so they are waiting on her.
    if (q && q.state === "empty") {
      if (qv.feeds && qv.all_answered === false) {
        return cs.title(undefined, {}) + doneNote + '<p class="mk-sub">' + cs.w("queue.allclear.withheld") + "</p>" + failedRow + doorsHtml + (vouch.length ? listOf(false) : "") + mutedPart;
      }
      if (vouch.length) return cs.title(undefined, {}) + doneNote + doorsHtml + listOf(false) + mutedPart;
      if (todos.loading(view)) return cs.title(undefined, {}) + doneNote + doorsHtml + listOf(false) + mutedPart;
      return cs.title(undefined, {}) + doneNote + doorsHtml + listOf(false) + (qv.feeds ? states.allClear(cs, qv) : "") + mutedPart;
    }
    return cs.title(undefined, {}) + doneNote + (q && q.state === "ok" ? failedRow + states.entry(cs) : "") + doorsHtml + note + sorts + listOf(false) + mutedPart;
  },

  // R3: each act's body from the item it was drawn on (`el.dataset`, the data `cs.act` was handed).
  acts: [
    { op: "taskresolve", label: "act.taskresolve.label.queue", rereads: ["queue"],
      send: function (view, el, cs, extra) { return el.dataset.multi ? view.parts.queueStates().run("taskresolve", view, el, cs, extra) : { body: { id: el.dataset.item } }; },
      done: function (view, answer, cs) { cs.set("done", "taskresolve"); } },
    { op: "taskforward", label: "act.taskforward.label.queue", rereads: ["queue"],
      send: function (view, el, cs, extra) {
        if (el.dataset.multi) return view.parts.queueStates().run("taskforward", view, el, cs, extra);
        // C75: a member chosen from the group's, never oneself.
        const picked = view.parts.forward().to(cs, view, el.dataset.f + "-to");
        return picked.to ? { body: { id: el.dataset.item, to: picked.to } } : picked;
      },
      done: function (view, answer, cs) { cs.set("done", "taskforward"); } },
    { op: "proposedispose", label: "act.proposedispose.label.queue", rereads: ["queue", "aside"],
      send: function (view, el, cs, extra) {
        if (el.dataset.multi) return view.parts.queueStates().run("proposedispose", view, el, cs, extra);
        // R61: a deferred set-aside finding is dismissed with a reason: an instance row by its key and version, a project row by both.
        // R70: `definitionVersion` is the word `proposedispose` reads; a finding with none sends none.
        // R68: the button says which: Defer puts the finding off (`deferred`), Dismiss sets it aside (`dismissed`).
        const to = el.dataset.to === "deferred" ? "deferred" : "dismissed";
        // A-17 (DEC-299): the confirmation names the act of the button pressed, which the op's one label cannot say.
        view.ui.doneFor = { op: "proposedispose", label: to === "deferred" ? "screen.queue.defer" : "act.proposedispose.label.queue" };
        if (el.dataset.key) return { body: Object.assign({ key: el.dataset.key, to: to }, el.dataset.version === "" ? {} : { definitionVersion: Number(el.dataset.version) }) };
        return { body: { project: el.dataset.project, finding: el.dataset.finding || el.dataset.item, to: to } };
      },
      done: function (view, answer, cs) { cs.set("done", "proposedispose"); } },
    { op: "queuesnooze", label: "act.queuesnooze.label.queue", rereads: ["queue"],
      send: function (view, el, cs, extra) {
        if (el.dataset.multi) return view.parts.queueStates().run("queuesnooze", view, el, cs, extra);
        // R69: "Bring back" clears the snooze of the case (`clear: "1"`, queue R21); R79 (c): a day before tomorrow is not sent.
        if (el.dataset.clear) return { body: { case: el.dataset.project, clear: "1" } };
        const day = view.parts.queueStates().dayOf(cs, el.dataset.f + "-until");
        return day.refuse ? day : { body: { case: el.dataset.project, until: day.until } };
      } },
    // R18 (queue R19, R20): "Mute a kind" mutes the item's kind for its nearest home case; with no case, the item.
    { op: "queuemute", label: "act.queuemute.label.queue", rereads: ["queue", "muted"],
      send: function (view, el) {
        // R50 (1): "Turn back on" sends the same form with `unmute`.
        view.ui.doneFor = { op: "queuemute", label: el.dataset.unmute ? "queue.muted.unmute" : "act.queuemute.label.queue" };   // A-17: the button's own act
        if (el.dataset.unmute === "kind") return { body: { case: el.dataset.mutecase, kinds: [el.dataset.kind], unmute: true } };
        if (el.dataset.unmute === "item") return { body: { item: el.dataset.item, unmute: true } };
        return el.dataset.mutecase && el.dataset.kind ? { body: { case: el.dataset.mutecase, kinds: [el.dataset.kind] } } : { body: { item: el.dataset.item } };
      },
      done: function (view, answer, cs) { cs.set("done", "queuemute"); } },
    // Adopting asks why (reevaluation R15); the member's words are the act's reason (interface-shell R11, K3002).
    { op: "adoptversion", label: "act.adoptversion.label.queue", rereads: ["queue"], reasonField: "why",
      send: function (view, el, cs) {
        const why = String(cs.value(el.dataset.f + "-why") || "").trim();
        return why ? view.parts.notices().send(cs, "adoptversion", el, { why: why }) : { refuse: "screen.queue.fieldfirst" };
      },
      done: function (view, answer, cs) { cs.set("done", "adoptversion"); } },
    { op: "keepversion", label: "act.keepversion.label.queue", rereads: ["queue"],
      send: function (view, el, cs) { return view.parts.notices().send(cs, "keepversion", el, {}); },
      done: function (view, answer, cs) { cs.set("done", "keepversion"); } },
    { op: "reminderanswer", label: "act.reminderanswer.label.queue", rereads: ["queue"],
      send: function (view, el, cs) {
        const on = String(cs.value(el.dataset.f + "-on") || "").trim();
        const body = { target: el.dataset.subject, entry: Number(el.dataset.entry || 0) };
        if (on) body.on = on;
        return { body: body };
      } },
    // A hint becomes a question in its case's project (R3; promotion's inquiry), opened on success.
    { op: "promote", label: "act.promote.label.queue", rereads: ["queue"],
      send: function (view, el, cs) {
        const q = String(cs.value(el.dataset.f + "-question") || "").trim();
        if (!q) return { refuse: "screen.queue.fieldfirst" };
        // `cs.w` answers HTML; the session log is text, so the entities it made are undone.
        const plain = function (t) { return String(t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); };
        const clock = new Date(cs.now());
        const iso = clock.toISOString().replace(/\.\d{3}Z$/, "Z");
        const item = String(el.dataset.item).replace(/[\n\r]/g, " ");
        const project = el.dataset.project || "";
        // R81: `promote` takes the package fields only (`bundleId`, `base`, `snapKey`, `meta`, `files`); the id is the store's own (`allocid`, as the project's page asks it)
        // and the project is the file's own `project` line.
        cs.call("allocid", { query: { prefix: "INQ", year: String(clock.getUTCFullYear()) } }).then(function (a) {
          const r = a && a.result !== undefined ? a.result : a;
          if (!r || !r.id) return null;
          const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/, "");
          const id = r.id + (slug ? "-" + slug : "");
          const heads = ["## Question", plain(cs.w("conformance.rests")), "## Conclusion", plain(cs.w("conformance.falsify")), "## Session Log", "## Review Notes"];
          const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(q), "current_state: open", "prior_state: null",
            "created: " + iso, "last_updated: " + iso].concat(project ? ["project: " + project] : [], ["produced_by:", "  mode: assisted", "  capability_tier: session", "references: []",
            "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "surfaced_by: human", "---", ""]);
          heads.forEach(function (h, i) { lines.push(h, ""); if (i === 0) lines.push(q, ""); if (i === 4) lines.push("### Session " + iso + " | Formation | interactive", "Trigger: " + plain(cs.w("file.trigger.queue", { item: item })), "Changes: created.", ""); });
          const nonce = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
          return cs.call("promote", { body: { bundleId: id, base: null, snapKey: iso.replace(/[-:]/g, "") + "_" + nonce,
            meta: { object_type: "inquiry", title: q, current_state: "open", created: iso, last_updated: iso }, files: [{ path: "bundle.md", text: lines.join("\n") }] } })
            .then(function (p) { if (p && p.ok !== false) cs.go("question", id); });
        }, function () { return null; });
        return null;
      } },
    // R13: the unsent request dropped, with the member's reason (the shell asks it: `actionmove` is reasoned).
    // The store reads the act's fields, the reason too, from the query (`raw: ""` has the shell put the reason there).
    { op: "actionmove", label: "act.actionmove.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.action ? { query: { target: el.dataset.action, to: "abandoned" }, raw: "" } : null; } },
    // R42: "Join" an invitation, and an owner's Grant or Decline of a request to join; the item leaves with the re-read.
    { op: "projectjoin", label: "act.projectjoin.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.project ? { query: { projectId: el.dataset.project } } : null; },
      done: function (view, answer, cs) { cs.set("done", "projectjoin"); } },
    { op: "projectrequestanswer", label: "act.projectrequestanswer.label.queue", rereads: ["queue"],
      send: function (view, el, cs) {
        if (!(el.dataset.project && el.dataset.who && el.dataset.answer)) return null;
        view.ui.doneFor = { op: "projectrequestanswer", label: el.dataset.answer === "decline" ? "screen.home.request.decline" : "screen.home.request.grant" };   // A-17: Grant or Decline, as pressed
        // R104: the member's word, when she wrote one, goes with the answer as `comment`.
        const comment = String(cs.value(el.dataset.f + "-comment") || "").trim();
        return { query: Object.assign({ projectId: el.dataset.project, handle: el.dataset.who, answer: el.dataset.answer }, comment ? { comment: comment } : {}) };
      },
      done: function (view, answer, cs) { cs.set("done", "projectrequestanswer"); } },
    // R19: Not now, for every administrator (instance-setup R90).
    // R107 (credentials R83): "I know about this key" sends the key the item is about; the item leaves with the re-read (queue R55).
    ...OWED({ op: "signerknown", label: "queue.signer-self-registered.known", rereads: ["queue"],
      send: function (view, el) {
        view.ui.doneFor = { op: "signerknown", label: "queue.signer-self-registered.known" };
        return el.dataset.key ? { body: { keyB64: el.dataset.key } } : null;
      },
      done: function (view, answer, cs) { cs.set("done", "signerknown"); } }),
    { op: "updatelater", label: "act.owed_updatelater.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.version ? { body: { version: el.dataset.version } } : null; } },
    { op: "exploreapprove", label: "act.exploreapprove.label.queue", rereads: ["queue"],
      send: function (view, el) { return { body: { owner: el.dataset.owner, day: el.dataset.day } }; } },
    // R17 (B21): vouching for the photos she captured, and approving a letter drafted for the group; each leaves with the next read.
    { op: "release", label: "act.release.label.queue", reasonField: "acknowledgment", rereads: ["held"],
      send: function (view, el, cs) { return view.parts.todos().release(view, el, cs); },
      done: function (view, answer, cs) { cs.set("done", "release"); } },
    { op: "filingapprove", label: "act.filingapprove.label.queue", rereads: ["queue"],
      send: function (view, el, cs) { return view.parts.todos().approve(view, el, cs); },
      done: function (view, answer, cs) { cs.set("done", "filingapprove"); } },
    // R75: the decisions the record routes to a member; each item leaves with the next read.
    { op: "adminendorse", label: "act.adminendorse.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.memberId ? { body: { memberId: el.dataset.memberId } } : null; },
      // R82: the invitation the answer carries is kept and shown once (as Members does), the done note beside it.
      done: function (view, answer, cs) { view.parts.routed().keep(view, answer, cs); cs.set("done", "adminendorse"); } },
    { op: "projectowneradd", label: "act.projectowneradd.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.projectId && el.dataset.handle ? { query: { projectId: el.dataset.projectId, handle: el.dataset.handle } } : null; },
      done: function (view, answer, cs) { cs.set("done", "projectowneradd"); } },
    { op: "expertiseconfirm", label: "act.expertiseconfirm.label.queue", rereads: ["queue"],
      send: function (view, el) { return el.dataset.memberId && el.dataset.label ? { body: { memberId: el.dataset.memberId, label: el.dataset.label } } : null; },
      done: function (view, answer, cs) { cs.set("done", "expertiseconfirm"); } },
    // The authority form: the member's decision with its basis, the basis being the act's reason (`taskdecide` is Reasoned).
    ...OWED({ op: "taskdecide", label: "act.owed_taskdecide.label.queue", reasonField: "basis", rereads: ["queue"], refusals: ROUTED_REFUSALS,
      send: function (view, el, cs) { return view.parts.routed().decide(cs, el); },
      done: function (view, answer, cs) { cs.set("done", "taskdecide"); } }),
  ],
});
