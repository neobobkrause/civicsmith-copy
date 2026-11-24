/* One action (registry screen `action`; screens-action R5, R7, R10, R12; DEC-113; v0.2 rules 6, 15). Projects › <project> ›
   Action: headed by its title (a null drawn absent), what it is, to whom, when and by whom it was sent, its clock entries
   with their due dates and state, its replies, its scope, its hold and pressure (the marks `pressurefor` answers); "Waiting on <office>'s reply" while one is owed. A passed date is drawn as
   canon's question ("no reply recorded by <date>"), never "overdue" until a member determines it (`action-producers` R1).
   An action holding an approved, unsent text offers to pick up where it was left (R10). It draws "The law it goes under"
   (R16) and "Its risk" (R17), each apart from its proposals, and offers to open a question from the action (R23): at once
   where a reply's date has passed with none recorded, behind a fold on any other. The subject is the action's id. It holds
   no member-facing English (R19). Every function here is self-contained (interface-shell R21 (1)). */
import { OPS } from "../op-declarations/index.mjs";
import { draftsOf, stepOf, readOnly, kindWord, later, officeLine, chosenLawOf, joinFirst, JOIN, WRITE_HELP } from "./send-steps.mjs";

// R23: `actioninquiry` is an owed act (`interface-shell` R73): it is registered once `op-declarations` declares it, and the
// shell draws it as it draws every act (R12).
const OWED = function (spec) { return Object.hasOwn(OPS, spec.op) ? [spec] : []; };

export const action = Object.freeze({
  id: "action",

  // R8 (interface-shell), R12: the path's project step, from the project the `action` read answers (its R102) and the
  // project's title from `list`.
  place: function (view) {
    const d = view.data.action;
    const id = d && d.state === "ok" && d.value && typeof d.value.project === "string" ? d.value.project : "";
    if (!id) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === id; });
    return hit ? { project: { id: id, title: hit.title || id } } : {};
  },

  reads: function (view) {
    return {
      action: { op: "action", query: { id: view.subject }, subject: true },
      filings: { op: "filingsfor", query: { action: view.subject }, empty: function () { return false; } },
      // R12, R31 (3): the action's pressure marks and records, each with where it arrived, who made it and its hold, and the
      // profile's fact on a legal mark (action-holds R16, R18)
      pressure: { op: "pressurefor", query: { action: view.subject },
        empty: function (v) { return !v || !Array.isArray(v.items) || v.items.length === 0; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      // E9 (K4557): her own place in the action's project (`participation`): an invited member is told at the start, not refused at the end
      standing: { op: "projectlist", query: {}, empty: function () { return false; } },
      // R16: the laws the group's places name, from which a law is chosen or proposed.
      profiles: { op: "profiles", empty: function () { return false; } },
      // R28: a kind the profile defines is worded by its own label; R31 (2): the templates the action's kind holds
      vocab: { op: "affordances", query: {}, empty: function () { return false; } },
      templates: { op: "templatesforaction", query: { action: view.subject }, empty: function () { return false; } },
      // C53 (action-clocks R26): the reminders the record holds for this action, read on load and again after each reminder set,
      // never kept in page memory (so a reload draws them)
      reminders: { op: "remindersfor", query: { action: view.subject }, after: ["reminderset"], empty: function () { return false; } },
    };
  },

  parts: {
    draftsOf: draftsOf, stepOf: stepOf, readOnly: readOnly, kindWord: kindWord, officeLine: officeLine, chosenLawOf: chosenLawOf,
    later: later, joinFirst: joinFirst,
    // R16: the laws the profile names for this kind of action (each citation once), with the window the profile gives. C64-law: for a
    // records request they are the profile's records laws, each with the window its own `response` names (`jurisdictions` R96), never
    // the deadlines (a deadline is a rule, an appeal's window is not a law a request goes under).
    lawsOf: function (profiles, kind) {
      const v = profiles && profiles.view ? profiles.view : {};
      if ((kind === "records_request" || kind === "cpra_request") && Array.isArray(v.records_laws) && v.records_laws.length) {
        const ds = Array.isArray(v.deadlines) ? v.deadlines : [];
        return v.records_laws.filter(function (l) { return l && typeof l.citation === "string" && l.citation; }).map(function (l) {
          const d = typeof l.response === "string" ? ds.find(function (x) { return x && x.rule === l.response && x.applies_to === "records_request"; }) : null;
          return { citation: l.citation, level: typeof l.level === "string" ? l.level : "", name: typeof l.name === "string" ? l.name : "",
            amount: d && d.amount ? d.amount : 0, count: d && d.count ? d.count : "" };
        });
      }
      const seen = new Set();
      return (Array.isArray(v.deadlines) ? v.deadlines : []).filter(function (d) {
        if (!d || !d.citation || d.applies_to !== kind || seen.has(d.citation)) return false;
        seen.add(d.citation);
        return true;
      });
    },
    // C64-law (`jurisdictions` R97): a clock entry whose text is one of the profile's rules is worded by that rule's own label ("answer to a
    // first request"), never by the rule's code; a rule with no label is worded by the entry's own description; an entry that is not one of
    // the rules' (a member's own) is drawn as written.
    clockWords: function (cs, c, deadlines) {
      const text = typeof c.text === "string" ? c.text.trim() : "";
      const desc = typeof c.description === "string" ? c.description.trim() : "";
      const d = text ? deadlines.find(function (x) { return x && x.rule === text; }) : null;
      if (d && typeof d.label === "string" && d.label.trim()) return cs.esc(d.label.trim());
      if (d || /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(text)) return cs.esc(desc);
      return cs.esc(text || desc);
    },
    // C94 (R56): a member is named by her handle, never by her id; an agent (`agent:…`) is not a member and is named as the plane names it
    who: function (cs, by) { const id = String(by || "").replace(/^member:/, ""); return id && !/^agent:/.test(id) ? cs.memberName(id) : id; },
    // R38: a word the design holds (`cs.w` answers the escaped key for one it does not); a field or option with none is not drawn
    // and is reported to BOB as a missing key (K3366), never worded here.
    has: function (cs, key) { return cs.w(key) !== cs.esc(key); },
    // R38: the vocabulary's reply stages (received ones) and outcomes, each as a choice option: the design's words by the key family
    // `screen.action.reply.stage.<token>` / `.outcome.<token>` where one holds them, else the vocabulary's own token as record data;
    // the family's `none` ("Not stated", "Not decided") is the empty choice, which sends nothing (B16).
    replyChoices: function (cs, view, which) {
      const v = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      const fam = "screen.action.reply." + which + ".";
      const list = which === "stage" ? (v.correspondence_stages && Array.isArray(v.correspondence_stages.received) ? v.correspondence_stages.received : [])
        : (Array.isArray(v.correspondence_outcomes) ? v.correspondence_outcomes : []);
      return [{ value: "", key: fam + "none" }].concat(list.filter(function (t) { return typeof t === "string" && t && t !== "none"; }).map(function (t) {
        return cs.w(fam + t) !== cs.esc(fam + t) ? { value: t, key: fam + t } : { value: t, text: t };
      }));
    },
    // R38 (B16 b): how a reply came, by the design's tokens (`actions` R13 takes free text of at most 500 characters)
    mediums: function () { return ["email", "letter", "portal", "person", "other"]; },
    // R38: the earlier entries a reply may follow (`follows`) or a quote answer or revise: each by its place in the correspondence
    // (the ordinal `actions` declares), a sent entry as the request sent on its day, a received one as its kind of reply on its day
    // (an entry with no kind has no word to be offered under).
    entriesOf: function (cs, corr) {
      return corr.map(function (c, i) {
        const ord = typeof c.ord === "number" ? c.ord : i;
        const fam = c.direction === "sent" ? "screen.action.sent.stage." : "screen.action.reply.stage.";
        const kind = typeof c.stage === "string" && cs.w(fam + c.stage) !== cs.esc(fam + c.stage) ? String(cs.w(fam + c.stage)).toLowerCase() : "";
        return { ord: ord, c: c, kind: kind };
      });
    },
    // C66: the reply as recorded, line by line, each by the design's label for it; a part the entry does not carry is not drawn. The
    // member's words and the office's are record data (escaped), the kind and the decision by the design's key where it holds one.
    shownBack: function (cs, c) {
      const has = function (v) { return typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null; };
      const line = function (labelKey, value) { return '<span class="meta" data-recorded="' + labelKey.split(".").pop() + '">' + cs.w(labelKey) + ": " + value + "</span>"; };
      const word = function (fam, token) { return cs.w(fam + token) !== cs.esc(fam + token) ? cs.w(fam + token) : cs.esc(token); };
      const out = [];
      if (has(c.account)) out.push(line("screen.action.reply.account", cs.esc(c.account)));
      if (has(c.stage)) out.push(line("screen.action.what.kind.of.reply", word("screen.action.reply.stage.", c.stage)));
      if (has(c.outcome)) out.push(line("screen.action.what.the.office.decided", word("screen.action.reply.outcome.", c.outcome)));
      if (has(c.exemptions)) out.push(line("screen.action.the.exemptions.the.office.cites", cs.esc(c.exemptions)));
      if (has(c.due_by)) out.push(line("screen.action.the.office.says.it.will.answer", cs.date(c.due_by) + (has(c.due_cite) ? " · " + cs.esc(c.due_cite) : "")));
      if (has(c.quote_amount)) out.push(line("screen.action.the.amount.quoted", cs.esc(String(c.quote_amount)) + (has(c.quote_currency) ? " " + cs.esc(c.quote_currency) : "")
        + (has(c.quote_basis) ? " · " + cs.esc(c.quote_basis) : "")));
      return out.join("");
    },
    // The states an action may move to from where it stands (actions' state edges).
    moves: function (from) {
      return { planned: ["active", "abandoned"], active: ["awaiting_response", "resolved", "abandoned"],
        awaiting_response: ["active", "resolved", "abandoned"] }[from] || [];
    },
    today: function (cs) { return new Date(cs.now()).toISOString().slice(0, 10); },
    // R12: the pressure marks past the first page, read by `after` until no cursor follows (at most 20 pages), kept in the
    // page's memory; answers the marks so far and the state of the page it stopped at.
    pressurePages: function (cs, view, first) {
      const L = view.ui.pages || (view.ui.pages = {});
      const items = [];
      let cursor = first, state = "ok", n = 0;
      while (cursor && n < 20) {
        const k = String(cursor);
        if (!L[k]) {
          L[k] = { state: "loading" };
          const settle = function (o) { L[k] = o; cs.set("pages", L); };
          cs.call("pressurefor", { query: { action: view.subject, after: k } }).then(function (a) {
            const r = a && a.result !== undefined ? a.result : a;
            if (!r || r.ok === false) {
              const code = String((r && (r.code || r.reason)) || "");
              settle({ state: "failed", refusal: { code: code, words: cs.esc((r && r.translation) || code) } });
            } else settle({ state: "ok", items: Array.isArray(r.items) ? r.items : [], cursor: r.truncated && r.cursor ? r.cursor : null });
          }, function () { settle({ state: "failed", refusal: null }); });
        }
        if (L[k].state !== "ok") { state = L[k].state; break; }
        items.push.apply(items, L[k].items);
        cursor = L[k].cursor;
        n++;
      }
      return { items: items, state: state, page: state === "ok" ? null : L[String(cursor)] };
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const STATES = ["planned", "active", "awaiting_response", "resolved", "abandoned"];
    // R31: a section whose tooltip is two sentences, each its own key (`<section>.tip1`, `.tip2`)
    const tips = function (titleKey, inner, k1, k2) {
      const tip = cs.esc(cs.w(k1) + " " + cs.w(k2));
      return '<section class="cs-section"><h2 tabindex="0" data-level="2" data-tip="' + tip + '">' + cs.w(titleKey) + "</h2>" + inner + "</section>";
    };
    const aLink = function (screen, id, key) { return '<a class="cs-ref" href="/app/' + screen + "/" + encodeURIComponent(id) + '" data-nav>' + cs.w(key) + "</a>"; };
    // a reference to another screen as its card: its name and its purpose (R37, R40, R43)
    const door = function (screen, id) {
      return '<div class="mk-links" data-list="' + screen + '"><a class="cs-ref" href="/app/' + screen + "/" + encodeURIComponent(id) + '" data-nav data-screen="' + screen + '">'
        + cs.w("screen." + screen + ".name") + '</a><span class="mk-small" data-purpose="' + screen + '">' + cs.w("screen." + screen + ".purpose") + "</span></div>";
    };
    return cs.state("action", function (a) {
      const office = a.addressee ? P.officeLine(a.addressee) : "";
      const holder = a.addressee && a.addressee.holder_on_date && a.addressee.holder_on_date.holder ? a.addressee.holder_on_date.holder : "";
      const corr = Array.isArray(a.correspondence) ? a.correspondence : [];
      const sent = corr.filter(function (c) { return c.direction === "sent"; });
      const first = sent.length ? sent[0] : null;
      const state = STATES.includes(a.current_state) ? a.current_state : "planned";
      const voc = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      // R28: the kind in its words, a profile's own kind by its label, never "Other"
      const kindName = P.kindWord(cs, typeof a.kind === "string" && a.kind ? a.kind : "other", false, voc.action_kind_labels);
      const sub = [kindName, office ? cs.w("screen.action.to", { office: office }) : "", holder ? cs.w("screen.request.holder", { holder: holder }) : "",
        first ? cs.w("screen.action.sentby", { date: { html: cs.date(first.at) }, who: P.who(cs, first.author) }) : "",
        cs.w("screen.plan.actionstate." + state)].filter(Boolean).join(" · ");
      // R59 (DEC-439 K12): a resolved action says how it was resolved, in the outcome's own sentence
      const RESOLVED = ["complied", "denied", "escalated", "withdrawn", "completed"];
      const said = state === "resolved" && RESOLVED.includes(a.resolution) ? '<p class="mk-note">' + cs.w("screen.action.resolution.said." + a.resolution) + "</p>" : "";
      const head = P.readOnly(cs, "screen.action.name") + cs.title(typeof a.title === "string" && a.title ? a.title : null) + '<p class="mk-sub">' + sub + "</p>" + said
        + (a.confidential ? '<p class="mk-note">' + cs.w("screen.action.confidential") + "</p>" : "");

      // R10: an approved text not yet sent opens its send step.
      const f = view.data.filings;
      const step = f && f.state === "ok" ? P.stepOf(f.value) : null;
      // E9 (K4557): an invited member is told here, in place of the doors to the send steps, that only members who have joined can use
      // them, with the way to accept; the doors themselves are drawn to a joined member alone
      const joinFirst = P.joinFirst(cs, view, a.project);
      const pickup = !joinFirst && (step === "send" || step === "second")
        ? '<div class="cs-reason" role="region"><p>' + cs.w("screen.action.unsent") + '</p><a class="cs-ref" href="/app/'
          + (a.kind === "records_request" ? "request/" : "start-send/") + encodeURIComponent(view.subject) + '" data-nav>' + cs.w("screen.action.pickup") + "</a></div>" : "";

      // R5: "Waiting on <office>'s reply" while one is owed; each due date with `mark.due`, a passed one as canon's
      // question, never "overdue" until a member determines it.
      // R43: an action not yet sent (no sent entry, no sending recorded) draws the door to the send steps, where its text is
      // prepared; a sent one does not
      const unsent = !sent.length && step !== "sent";
      const toSend = unsent && !joinFirst ? door("start-send", view.subject) : "";
      // R43, R48 (C65): once the filing's sending is recorded the way to keep it as the team's template is reachable from the action: the
      // control is on `start-send`'s step for a sent filing (the registry lists `templatesave` on that screen alone), which this opens
      const keepDoor = step === "sent" && !joinFirst && cs.can("templatesave") ? '<p class="mk-note">' + aLink("start-send", view.subject, "screen.start-send.template.heading") + "</p>" : "";
      // R56 (walk E K12): "Waiting on" only while the action is neither resolved nor abandoned; the plane's `owed` stays true after
      const owed = a.reply_owed && a.reply_owed.owed && state !== "resolved" && state !== "abandoned";
      const wait = owed ? '<p class="cs-wait" role="status">' + cs.w("screen.action.waiting", { office: office || cs.w("screen.action.theoffice") }) + "</p>" : "";
      const today = P.today(cs);
      const clock = Array.isArray(a.clock) ? a.clock : [];
      const pfv = view.data.profiles && view.data.profiles.state === "ok" && view.data.profiles.value && view.data.profiles.value.view ? view.data.profiles.value.view : {};
      const deadlines = Array.isArray(pfv.deadlines) ? pfv.deadlines : [];
      const rem = view.data.reminders;
      const remHeld = rem && rem.state === "ok" && rem.value && Array.isArray(rem.value.reminders) ? rem.value.reminders : [];
      const clocks = !clock.length ? "" : cs.sec("screen.action.dates", (rem && rem.state === "failed" ? cs.state(rem) : "") + cs.sheet(clock.map(function (c, i) {
        const st = ["pending", "met", "overdue", "waived"].includes(c.status) ? c.status : "pending";
        const passed = st === "pending" && c.date && String(c.date) < today;
        const says = passed ? cs.w("screen.action.noreplyby", { date: { html: cs.date(c.date) } }) : cs.w("screen.action.clock." + st);
        const due = c.date ? '<a href="/app/due-date/' + encodeURIComponent(view.subject + "~" + i) + '" data-nav>' + cs.due(String(c.date), st === "met" ? "met" : passed ? "passed" : "") + "</a>" : "";
        const remind = c.date && st === "pending" && cs.can("actioncorrespond")
          ? cs.field("remind-" + i, "screen.action.remindon", { type: "date" }) + cs.act("reminderset", { data: { entry: String(i) } }) : "";
        // R52, C53: the reminders the record holds for this entry (`remindersfor`, action-clocks R26), each by its day, by key; one already
        // answered is not announced
        const set = remHeld.filter(function (r) { return r && r.entry === i && r.on && r.state !== "answered"; }).map(function (r) {
          return ' · <span data-reminder="' + i + '">' + cs.w("screen.reminder.on", { date: { html: cs.date(r.on) } }) + "</span>";
        }).join("");
        return cs.row(due, P.clockWords(cs, c, deadlines) + '<span class="meta">' + says + (c.basis ? " · " + cs.esc(c.basis) : "") + set + "</span>", "", remind);
      }).join("")));
      // R37: a sent action with no clock entry has no due date to open: the door to the deadline page is drawn for it, which holds
      // the proposal and "Confirm this due date"
      const dueDoor = first && !clock.length ? door("due-date", view.subject) : "";

      // R23, R26: "Open a question from this" (`actioninquiry`): the member writes the question, one line; the action is where it
      // comes from, not evidence in it. In the drawing's state b (a reply's date passed with none recorded) the act sits in the
      // sentence block with its form; on any other action it is asked for, behind a fold. On success the page stays and says
      // where the question is open, with a reference to it.
      const lapsed = clock.filter(function (c) { return c.date && (["pending", undefined].includes(c.status)) && String(c.date) < today; })
        .map(function (c) { return String(c.date); }).sort();
      const ask = cs.act("actioninquiry", { label: "action.noreply.question", tone: "primary" });
      const helpAsk = view.reachable ? cs.act("writinghelp", { data: { field: "question", id: "action-question", forop: "actioninquiry" } }) : "";
      const projects = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
        ? view.data.projects.value.bundles : [];
      const ownProject = projects.find(function (b) { return b.bundle_id === a.project; });
      const asked = view.ui.asked || null;
      const receipt = asked && asked.inquiry
        ? cs.row("", cs.w("screen.action.ask.done", { project: ownProject && ownProject.title ? ownProject.title : "" }),
          aLink("question", asked.inquiry, "screen.action.openquestion")) : "";
      const askForm = '<p class="mk-small">' + cs.w("action.noreply.question.help") + "</p>"
        + cs.field("action-question", "action.noreply.question.label", { max: 500, rec: true, help: "action.noreply.question.field.help" })
        + '<div class="mk-acts">' + ask + helpAsk + "</div>";
      const question = !ask ? "" : lapsed.length
        ? '<div class="cs-reason" role="region"><p class="cs-wait" role="status"><b>' + cs.w("action.noreply.title", { date: { html: cs.date(lapsed[0]) } }) + "</b></p>"
          + '<p class="mk-small">' + cs.w("action.noreply.says") + "</p>" + cs.sec("screen.action.ask.heading", askForm) + receipt + "</div>"
        : '<details class="mk-details"' + (asked ? " open" : "") + "><summary>" + cs.w("action.noreply.question") + "</summary>" + cs.sec("screen.action.ask.heading", askForm) + receipt + "</details>";

      // R5: the replies, each received one markable as pressure (once).
      const entries = Array.isArray(a.entries) ? a.entries : [];
      const received = corr.filter(function (c) { return c.direction !== "sent"; });
      const helpReply = view.reachable ? cs.act("writinghelp", { data: { field: "account", id: "reply-account", forop: "actioncorrespond" } }) : "";
      // R38: the full reply form (DEC-376, C66): a reply or none, the day, who it came from, what it is recorded from, the kind of
      // reply, what the office decided and the exemptions it cites, the date it says it will answer by and the law that comes
      // from, and a quoted fee. Each field and option reads the design's key; one the design holds no key for is not drawn (R19).
      const laws = a.governing_laws && Array.isArray(a.governing_laws.laws) ? a.governing_laws.laws : [];
      const stageOpts = P.replyChoices(cs, view, "stage"), outcomeOpts = P.replyChoices(cs, view, "outcome");
      // R38 (B15 (1)): the reply's document is picked from the project's held captures (`heldcaptures`, capture R77, scoped by
      // `project`): each by its title and the day it was collected, the digest its capture is filed under as the value
      const held = a.project && cs.can("actioncorrespond") ? P.later(cs, view, "held", "heldcaptures", { project: a.project, limit: "500" }, "") : null;
      const heldRows = held && held.state === "ok" && held.value && Array.isArray(held.value.held) ? held.value.held : [];
      const docOpts = heldRows.filter(function (r) { return r && r.capture && typeof r.capture.sha256 === "string" && r.capture.sha256; }).map(function (r) {
        return { value: r.capture.sha256, key: "screen.docket.capture.option", fills: { title: r.title || r.bundle_id || "", date: { html: r.collected_since ? cs.date(r.collected_since) : "" } } };
      });
      const earlier = P.entriesOf(cs, corr);
      const pre = [{ value: "", key: "screen.action.reply.follows.none" }];
      const followsOpts = pre.concat(earlier.filter(function (x) { return x.c.direction === "sent" || x.kind; }).map(function (x) {
        // a sent entry is "the request" unless its stage is another kind of sending (a fee-waiver request, an appeal, a court filing)
        return x.c.direction === "sent" && (!x.kind || x.c.stage === "request") ? { value: String(x.ord), key: "screen.action.reply.follows.request", fills: { date: { html: cs.date(x.c.at) } } }
          : { value: String(x.ord), key: "screen.action.reply.follows.reply", fills: { kind: { html: x.kind }, date: { html: cs.date(x.c.at) } } };
      }));
      const answersOpts = [{ value: "", text: "" }].concat(earlier.filter(function (x) { return x.c.direction === "sent"; }).map(function (x) {
        return { value: String(x.ord), key: "screen.action.reply.follows.request", fills: { date: { html: cs.date(x.c.at) } } };
      }));
      const revisesOpts = [{ value: "", text: "" }].concat(earlier.filter(function (x) { return x.c.direction !== "sent" && x.c.quote_amount !== undefined && x.c.quote_amount !== null && x.c.quote_amount !== ""; }).map(function (x) {
        return { value: String(x.ord), text: String(x.c.quote_amount) + (x.c.quote_currency ? " " + String(x.c.quote_currency) : "") };
      }));
      // C64-law: "The city's portal" is not said of a reply to a request under the federal law; the vocabulary's own token stands in for it
      const fedLaw = (P.chosenLawOf(a, view.data.profiles && view.data.profiles.state === "ok" ? view.data.profiles.value : null) || {}).level === "federal";
      const mediumOpts = [{ value: "", text: "" }].concat(P.mediums().map(function (t) { return t === "portal" && fedLaw ? { value: t, text: t } : { value: t, key: "screen.action.reply.medium." + t }; }));
      const fold = function (summaryKey, inner) { return '<details class="mk-details"><summary>' + cs.w(summaryKey) + "</summary>" + inner + "</details>"; };
      const noteOf = function (key) { return '<p class="mk-small">' + cs.w(key) + "</p>"; };
      // the kit's choice draws no help of its own: a choice's help sentences follow it as notes
      const pick = function (id, labelKey, options, o) {
        const help = o && o.help ? [].concat(o.help) : [];
        return cs.choice(id, labelKey, options, o && o.value !== undefined ? { value: o.value } : {}) + help.map(noteOf).join("");
      };
      const replyForm = pick("reply-dir", "screen.action.what.came.back", [["received", "screen.action.a.reply.came"], ["no_response", "screen.action.no.reply.came.by.the.date"]],
        { value: "received", help: ["screen.action.record.a.silence.with.its.date", "screen.action.it.is.not.the.same.as"] })
        + cs.field("reply-at", "screen.action.the.day.it.came.or.the", { type: "date", help: "screen.action.a.real.calendar.day" })
        + pick("reply-medium", "screen.action.how.it.came", mediumOpts)
        + cs.field("reply-party", "screen.action.who.it.came.from", { help: "screen.action.the.office.or.person.who.answered" })
        + pick("reply-held", "screen.action.what.you.record.it.from", [["account", "screen.action.your.account.of.it"], ["document", "screen.action.the.reply.itself.a.document.you"]],
          { value: "account", help: ["screen.action.either.the.reply.itself.or.your", "screen.action.a.silence.has.neither.because.there"] })
        + cs.field("reply-account", "screen.action.your.account.of.the.reply", { area: true, rec: true, help: "screen.action.in.your.own.words.up.to" })
        + (docOpts.length ? pick("reply-doc", "screen.action.the.document.that.holds.the.reply", [{ value: "", text: "" }].concat(docOpts),
          { help: ["screen.action.only.when.you.record.the.reply", "screen.action.add.the.document.first.under.add"] })
          : held && held.state === "failed" ? cs.state(held) : noteOf("screen.action.add.the.document.first.under.add"))
        + fold("screen.action.where.this.reply.stands.in.the", noteOf("screen.action.say.what.kind.of.reply.it") + noteOf("screen.action.the.request.s.timeline.then.follows")
          + pick("reply-stage", "screen.action.what.kind.of.reply", stageOpts, { help: ["screen.action.a.sending.has.its.own.kinds", "screen.action.a.silence.has.no.kind"] })
          + pick("reply-follows", "screen.action.it.follows", followsOpts, { help: ["screen.action.the.earlier.entry.this.answers.so", "screen.action.an.appeal.must.follow.the.decision"] })
          + pick("reply-outcome", "screen.action.what.the.office.decided", outcomeOpts, { help: ["screen.action.only.on.a.reply", "screen.action.a.denial.a.decision.on.a"] })
          + cs.field("reply-exemptions", "screen.action.the.exemptions.the.office.cites", { rec: true, help: "screen.action.the.exemptions.or.reasons.for.withholding" })
          + cs.field("reply-dueby", "screen.action.the.office.says.it.will.answer", { type: "date", help: ["screen.action.a.date.the.office.itself.stated", "screen.action.civicsmith.works.out.no.date.for", "screen.action.give.the.law.with.it"] })
          + (laws.length ? pick("reply-duecite", "screen.action.the.law.that.date.comes.from", [{ value: "", text: "" }].concat(laws.map(function (l) { return { value: String(l.citation || ""), text: String(l.citation || "") }; })),
            { help: "screen.action.only.a.law.this.action.goes" }) : ""))
        + fold("screen.action.if.the.reply.quotes.a.fee", noteOf("screen.action.a.fee.quote.is.kept.as")
          + cs.field("reply-fee", "screen.action.the.amount.quoted", { help: "screen.action.put.a.waiver.in.as.a" })
          + pick("reply-fee-cur", "screen.action.currency", [{ value: "USD", key: "screen.action.reply.currency.usd" }])
          + cs.field("reply-fee-basis", "screen.action.what.the.fee.is.for", { help: "screen.action.optional.in.the.office.s.words" })
          + pick("reply-fee-answers", "screen.action.it.answers.this.sending", answersOpts, { help: "screen.action.the.earlier.sending.the.quote.responds" })
          + (revisesOpts.length > 1 ? pick("reply-fee-revises", "screen.action.it.revises.this.quote", revisesOpts, { help: "screen.action.only.when.the.office.changes.a" }) : ""));
      // R55 (actions R108): on a public comment, the reply can carry the minutes' passage: the meeting, its day, the document that holds
      // the minutes (a held capture, as above) and the passage as the minutes write it. The words are located in the document's reading
      // (`reading`, read once a document is chosen) and the passage sent is the extent of the unit that holds them; any other kind draws
      // no fold.
      const pickedDoc = view.ui.minutesDoc && docOpts.some(function (o) { return o.value === view.ui.minutesDoc; }) ? view.ui.minutesDoc : "";
      const minRead = pickedDoc ? P.later(cs, view, "minread", "reading", { sha256: pickedDoc }, "") : null;
      const minutesFold = a.kind === "public_comment" && cs.can("actioncorrespond")
        ? fold("screen.action.minutes.heading", noteOf("screen.action.minutes.says") + '<p class="eyebrow">' + cs.w("screen.action.minutes.legend") + "</p>"
          + cs.field("minutes-meeting", "screen.action.minutes.meeting.label", { help: "screen.action.minutes.meeting.help1" })
          + cs.field("minutes-date", "screen.action.minutes.date.label", { type: "date", help: "screen.action.minutes.date.help1" })
          + cs.choice("minutes-doc", "screen.action.minutes.doc.label", [{ value: "", text: "" }].concat(docOpts), { redraw: "minutesDoc" }) + noteOf("screen.action.minutes.doc.help1")
          + (minRead && minRead.state === "failed" ? cs.state(minRead) : "")
          + cs.field("minutes-passage", "screen.action.minutes.passage.label", { area: true, rec: true, help: "screen.action.minutes.passage.help1" })
          + '<div class="mk-acts">' + cs.act("actioncorrespond", { label: "screen.action.minutes.record", tone: "primary" }) + "</div>") : "";
      // fix round 10 (diagnosis 11 §17): a reply's mark is read from `pressurefor`, from either source (the document's entry or `actionpressure`'s
      // own record), so a reply marked is shown marked and not offered again
      const pv = view.data.pressure && view.data.pressure.state === "ok" ? view.data.pressure.value : null;
      const pvMore = pv && pv.truncated && pv.cursor ? P.pressurePages(cs, view, pv.cursor) : { items: [], state: "ok" };
      const pvItems = pv ? (Array.isArray(pv.items) ? pv.items : []).concat(pvMore.items) : [];
      const markOf = function (ord) {
        return pvItems.find(function (m) { return m && m.arrived && m.arrived.action === view.subject && Number(m.arrived.ord) === Number(ord); }) || null;
      };
      const replies = cs.sec("screen.action.replies", (received.length ? cs.sheet(received.map(function (c) {
        const e = entries.find(function (x) { return x.ord === c.ord; }) || {};
        const stored = markOf(c.ord);
        const kindOf = stored && typeof stored.kind === "string" ? stored.kind : e.pressure ? e.pressure.kind : "";
        const pr = stored || e.pressure ? cs.w("screen.action.pressure." + (["legal", "retaliation", "discrediting"].includes(kindOf) ? kindOf : "other")) : "";
        const mark = !stored && !e.pressure && c.direction === "received"
          ? cs.choice("pressure-kind-" + c.ord, "screen.action.pressure.kind", ["legal", "retaliation", "discrediting", "other"].map(function (k) { return [k, "screen.action.pressure." + k]; }))
            + cs.field("pressure-note-" + c.ord, "screen.action.pressure.note") + cs.act("actionpressure", { data: { ord: String(c.ord) } }) : "";
        return cs.row(cs.date(c.at), cs.w(c.direction === "no_response" ? "screen.action.noresponse" : "screen.action.received")
          + (c.party ? " · " + cs.esc(c.party) : "") + (c.medium ? " · " + cs.esc(c.medium) : "") + (pr ? '<span class="meta">' + pr + "</span>" : "")
          // C66: what was recorded with the reply, shown back as the record holds it: the words, the kind, the decision, the exemptions
          // cited, the date the office said it would answer by, and a quoted fee
          + P.shownBack(cs, c)
          // R55: a recorded entry's minutes, said once beside it with the meeting and its day
          + (e.minutes && e.minutes.meeting ? '<span class="meta" data-minutes="' + c.ord + '">' + cs.w("screen.action.minutes.says") + " · " + cs.esc(e.minutes.meeting)
            + (e.minutes.date ? " · " + cs.date(e.minutes.date) : "") + "</span>" : ""), "", mark);
      }).join("")) : "")
        // R27: the form belongs to the act: a member who may not record a reply is shown no field of it
        + (cs.can("actioncorrespond") ? replyForm + minutesFold + '<div class="mk-acts">' + cs.act("actioncorrespond", { tone: "primary" }) + helpReply + "</div>" : ""));

      // R12, R31 (3): the pressure marks and records on this action, each with where it arrived, who made it and whether a hold
      // is placed (a legal one as `screen.action.legalmark`), paged by `after`; none drawn at zero; the profile's fact on a legal
      // threat once, with its source, and the doors to `hold` and `grouprules`.
      const pr = view.data.pressure;
      const ownMark = function (m) { return !(m.arrived && m.arrived.action && m.arrived.action !== view.subject); };
      const marks = function (items) {
        return cs.sheet(items.map(function (m) {
          const at = m.arrived && m.arrived.action ? cs.w("screen.action.pressuremark.reply", { ord: String(m.arrived.ord) }) : cs.w("screen.action.pressuremark.record");
          const who = P.who(cs, m.by);
          const legal = m.kind === "legal";
          const hold = !legal ? "" : m.hold === "in_place" ? cs.w("screen.action.held") : m.hold === "released" ? "" : cs.w("screen.action.holdnone");
          return cs.row(cs.date(m.at), (legal ? cs.w("screen.action.legalmark", { member: who })
            : cs.w("screen.action.pressure." + (["retaliation", "discrediting"].includes(m.kind) ? m.kind : "other"))) + (m.note ? " · " + cs.esc(m.note) : "")
            + '<span class="meta">' + at + (!legal && who ? " · " + cs.w("screen.action.pressuremark.by", { who: who }) : "") + (hold ? " · " + hold : "") + "</span>", "", "");
        }).join(""));
      };
      let pressureSec = "";
      if (pr && pr.state === "ok") {
        const first = (pr.value.items || []).filter(ownMark);
        const more = pr.value.truncated && pr.value.cursor ? P.pressurePages(cs, view, pr.value.cursor) : { items: [], state: "ok" };
        const all = first.concat(more.items.filter(ownMark));
        const facts = Array.isArray(pr.value.facts) ? pr.value.facts : null;
        const hasLegal = all.some(function (m) { return m.kind === "legal"; });
        const factRows = !hasLegal ? "" : facts === null ? cs.state({ state: "failed" })
          : facts.length ? cs.sheet(facts.map(function (x) {
            return cs.row("", cs.esc(x.statement || "") + '<span class="meta">' + cs.w("screen.action.profilefact.from") + (x.citation ? " · " + cs.esc(x.citation) : "") + "</span>", "", "");
          }).join("")) + '<p class="mk-note">' + cs.w("screen.action.profilefact.shown") + " " + cs.w("guide.procedure.legalinfo") + "</p>" : "";
        const doors = hasLegal ? '<p class="mk-note">' + aLink("hold", view.subject, "screen.action.hold.link") + " · " + aLink("grouprules", "", "screen.action.rule.link") + "</p>" : "";
        pressureSec = all.length ? cs.sec("screen.action.pressuremarks", marks(all) + (more.state !== "ok" ? cs.state(more.page) : "") + factRows + doors) : "";
      } else if (pr && pr.state === "failed") pressureSec = cs.sec("screen.action.pressuremarks", cs.state("pressure"));

      // R31 (2): templates, drawn only because the action exists: each offered one with who approved it and when, each not offered
      // by its handle with what it lacks, a court petition with none; "Prepare the text" opens `request`.
      const tm = view.data.templates;
      let templatesSec = "";
      if (tm && tm.state === "ok" && tm.value) {
        const t = tm.value;
        const offered = Array.isArray(t.versions) ? t.versions : [];
        const not = Array.isArray(t.not_offered) ? t.not_offered : [];
        const rows = t.court_petition ? "" : offered.map(function (v) {
          const by = typeof v.approved_by === "string" && v.approved_by ? P.who(cs, v.approved_by) : "";
          return cs.row("", cs.esc(v.name || v.template || ""), v.approved_at && by
            ? '<span class="meta">' + cs.w("screen.action.templates.approved", { member: by, date: { html: cs.date(v.approved_at) } }) + "</span>" : "", "");
        }).concat(not.map(function (n) {
          return cs.row("", cs.esc(n.handle || n.name || "") + '<span class="meta">' + cs.w("screen.action.templates.notyet") + "</span>", "", "");
        })).join("");
        const prepare = a.kind === "records_request" ? '<p class="mk-note">' + aLink("request", view.subject, "act.communicationprepare.label.request") + "</p>" : "";
        const lead = t.court_petition ? '<p class="mk-small">' + cs.w("screen.action.templates.nocourt") + "</p>" : '<p class="mk-small">' + cs.w("screen.action.templates.offered") + "</p>";
        templatesSec = rows || t.court_petition ? tips("screen.action.templates.heading", lead + (rows ? cs.sheet(rows) : "")
          + (not.length ? '<p class="mk-note">' + cs.w("screen.action.templates.own") + " " + cs.w("screen.action.templates.never") + "</p>" : "") + prepare,
        "screen.action.templates.tip1", "screen.action.templates.tip2") : "";
      }

      // R31 (1): the procedure guide: each route with what to expect and its source, in the profile's order, the group's approved
      // guides after, each marked with who approved it; legal information, not legal advice. C66: a kind that holds none says so (the
      // matter's `screen.matter.routes.none` stands in until the design writes this screen's own row).
      const gd = P.later(cs, view, "guides", "procedureguides", { kind: a.kind || "other" }, String(view.ui.guideN || 0));
      const guides = gd.state === "ok" && gd.value && Array.isArray(gd.value.guides) ? gd.value.guides : [];
      const guideRows = guides.map(function (g) {
        const from = g.origin === "group"
          ? cs.w("screen.action.templates.approved", { member: P.who(cs, g.approved_by), date: { html: g.approved_at ? cs.date(g.approved_at) : "" } }) : cs.w("screen.action.profilefact.from");
        return (Array.isArray(g.items) ? g.items : []).map(function (it) {
          return cs.row("", cs.esc(it.route || "") + '<span class="meta">' + (it.expect ? cs.w("screen.action.guide.expect", { expectation: it.expect }) + " · " : "") + (it.citation ? cs.w("screen.action.guide.source", { citation: it.citation }) + " · " : "") + from + "</span>", "", "");
        }).join("");
      }).join("");
      const teamGuides = guides.filter(function (g) { return g.origin === "group"; }).length;
      // R27: a read-only member sees no act of the screen, the routes themselves still read; the act is a member's who may act
      const guideAct = cs.can("actioncorrespond") ? cs.act("procedureguides", {}) : "";
      const guideSec = gd.state === "failed" ? tips("screen.action.guide.heading", cs.state({ state: "failed", refusal: gd.refusal }), "screen.action.guide.tip1", "screen.action.guide.tip2")
        : guideRows || guideAct ? tips("screen.action.guide.heading", '<p class="mk-small">' + cs.w("screen.action.profilefact.from") + " · " + cs.w("screen.action.guide.order") + " · " + cs.w("guide.procedure.legalinfo") + "</p>"
          + (guideRows ? cs.sheet(guideRows) : gd.state === "ok" ? '<p class="cs-state" data-state="empty">' + cs.w("screen.matter.routes.none") + "</p>" : "") + '<p class="mk-note">' + cs.w("screen.action.guide.sourced") + " " + cs.w("screen.action.guide.team") + " " + (teamGuides ? "" : cs.w("screen.action.guide.teamnone")) + "</p>"
          + (guideAct ? '<div class="mk-acts">' + guideAct + "</div>" : ""), "screen.action.guide.tip1", "screen.action.guide.tip2") : "";

      // R16: the law it goes under: the laws a member stated (each by level and citation, with the window the group's places
      // give it), who stated them and when, or that none is; a change by choosing among the laws the places name; the
      // proposals apart, each marked not the law; and another law proposed.
      const pf = view.data.profiles;
      const offered = P.lawsOf(pf && pf.state === "ok" ? pf.value : null, a.kind);
      const gl = a.governing_laws && typeof a.governing_laws === "object" && !Array.isArray(a.governing_laws) ? a.governing_laws : {};
      const stated = Array.isArray(gl.laws) ? gl.laws : [];
      const LEVELS = ["state", "city", "county", "federal"];
      const lawLine = function (l) {
        const d = offered.find(function (x) { return x.citation === l.citation; });
        return (LEVELS.includes(l.level) ? cs.w("screen.request.level." + l.level) + " · " : "") + cs.esc(l.citation || "")
          + (d && d.amount ? " · " + cs.w("screen.request.window." + (d.count === "business" ? "business" : "calendar"), { n: String(d.amount) }) : "");
      };
      const levels = function (id) { return cs.choice(id, "screen.request.level", LEVELS.map(function (k) { return [k, "screen.request.level." + k]; })); };
      const optionsOf = function (list) {
        return list.map(function (d) { return { value: d.citation, text: d.citation }; });
      };
      const lawsStated = gl.state === "stated" && stated.length
        ? cs.sheet(stated.map(function (l) { return cs.row("", lawLine(l), "", ""); }).join(""))
          + (gl.by && gl.at ? '<p class="mk-note">' + cs.w("law.stated", { who: P.who(cs, gl.by), date: { html: cs.date(gl.at) } }) + "</p>" : "")
        : '<p class="mk-note">' + cs.w("law.undetermined") + "</p>";
      const lawProposals = a.governing_laws_proposals && Array.isArray(a.governing_laws_proposals.proposals) ? a.governing_laws_proposals.proposals : [];
      const lawProposed = lawProposals.length
        ? '<p class="eyebrow">' + cs.w("law.proposed") + "</p>" + cs.sheet(lawProposals.map(function (x) {
          return cs.row("", (Array.isArray(x.laws) ? x.laws : []).map(lawLine).join("<br>"),
            '<span class="meta">' + (x.machine_work ? cs.mark("origin", "machine") + " · " : "") + cs.w("law.proposal.not", { who: P.who(cs, x.by), date: { html: cs.date(x.at) } }) + "</span>", "");
        }).join("")) : "";
      // R54: "Change the law…" and "Propose another law…" share one list of laws, drawn once with both acts under it; with no laws
      // offered neither act is drawn (E3, DEC-384)
      // R59 (DEC-439 E H1b): with no law the places list for this kind, the member names the law: its level and its citation
      const lawChoose = offered.length
        ? cs.choice("law-pick", "law.pick", optionsOf(offered)) + (offered.some(function (d) { return !d.level; }) ? levels("law-level") : "")
          + '<div class="mk-acts">' + cs.act("actionlaws", { label: "law.change" }) + cs.act("actionlawspropose", { label: "law.propose" }) + "</div>"
        : '<p class="mk-note">' + cs.w("screen.action.law.none") + "</p>"
          + cs.choice("law-level", "screen.action.law.level", LEVELS.map(function (k) { return [k, "screen.request.level." + k]; }))
          + cs.field("law-cite", "screen.action.law.citation")
          + '<div class="mk-acts">' + cs.act("actionlawspropose", { label: "law.propose" }) + "</div>";
      const lawSec = cs.sec("law.title", lawsStated + lawProposed + lawChoose, { help: "law.help" });

      // R17: its risk: the tier in its own words, the latest revision, a revision with a reason, and the proposals apart.
      const tier = [1, 2, 3].includes(Number(a.risk_tier)) ? Number(a.risk_tier) : "undetermined";
      const hist = a.risk_tier_history && Array.isArray(a.risk_tier_history.revisions) ? a.risk_tier_history.revisions.filter(function (r) { return r && r.readable; }) : [];
      const tierWords = function (t) { return cs.w("risk.tier." + ([1, 2, 3].includes(Number(t)) ? Number(t) : "undetermined")); };
      const latest = hist.length ? hist[hist.length - 1] : null;
      const riskPs = a.risk_tier_proposals && Array.isArray(a.risk_tier_proposals.proposals) ? a.risk_tier_proposals.proposals : [];
      // a machine proposal is drawn only while the assistant is reachable; a member's whether or not
      const shownPs = riskPs.filter(function (x) { return !x.machine_work || view.reachable; });
      const riskProposed = shownPs.length
        ? '<p class="eyebrow">' + cs.w("risk.proposed") + "</p>" + cs.sheet(shownPs.map(function (x) {
          return cs.row("", cs.w("risk.proposal", { who: P.who(cs, x.by), tier: String(x.tier), words: tierWords(x.tier) }),
            '<span class="meta">' + (x.machine_work ? cs.mark("origin", "machine") + " · " : "") + cs.w("risk.proposal.not") + "</span>", "");
        }).join("")) : "";
      const riskSec = cs.sec("risk.title",
        '<p class="mk-note">' + (tier === "undetermined" ? cs.w("risk.tier.undetermined") : cs.w("risk.tier", { tier: String(tier) }) + " · " + tierWords(tier)) + "</p>"
        + (latest ? '<p class="mk-note">' + cs.w("risk.set", { who: P.who(cs, latest.by), date: { html: cs.date(latest.at) }, reason: latest.reason, prior: tierWords(latest.prior) }) + "</p>" : "")
        + riskProposed
        + cs.choice("risk-tier", "risk.title", [1, 2, 3].map(function (t) { return [String(t), "risk.tier." + t]; }))
        + '<div class="mk-acts">' + cs.act("actionrisktier", { label: "risk.revise" }) + "</div>", { help: "risk.help" });

      // R5: move and scope (R32: the hold is placed on `hold`, not here).
      const moves = P.moves(state);
      const move = moves.length ? cs.choice("move-to", "screen.action.move.to", moves.map(function (m) { return [m, "screen.plan.actionstate." + m]; }))
        + cs.choice("move-resolution", "screen.action.move.resolution", ["complied", "denied", "escalated", "withdrawn", "completed"].map(function (r) { return [r, "screen.action.resolution." + r]; }))
        + cs.act("actionmove", {}) : "";
      const scope = '<p class="mk-note">' + cs.w(a.confidential ? "screen.action.scope.confidential" : "screen.action.scope.open") + "</p>"
        + cs.act("actionscope", { data: { to: a.confidential ? "false" : "true" } });
      const manage = cs.sec("screen.action.manage", '<div class="mk-acts">' + move + "</div>" + scope);
      // R40: the counsel packet's screen is opened from the action
      return head + (unsent || step === "send" || step === "second" || step === "sent" ? joinFirst : "") + pickup + toSend + wait + dueDoor + question + clocks + replies + pressureSec + lawSec + guideSec + templatesSec + keepDoor + riskSec + door("counsel", view.subject) + manage;
    });
  },

  acts: [
    {
      // R5, R38: "Record a reply": a reply or none; the day, who it came from, the member's account, the kind of reply, what the
      // office decided, the exemptions, the date it says it will answer by and the law, and a quoted fee, as `actions` declares
      // them (`actioncorrespond`). A silence takes its day alone.
      op: "actioncorrespond",
      send: function (view, el, cs) {
        const val = function (id) { return String(cs.value(id) || "").trim(); };
        const at = val("reply-at");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { refuse: "screen.action.reply.at.needed" };
        const dir = val("reply-dir") === "no_response" ? "no_response" : "received";
        const q = { target: view.subject, direction: dir, at: at };
        // a silence takes its day alone from the member; `actions` records it as a named account (DEC-13: it requires an account
        // or a capture, and a silence has no bytes), so the account is the design's own sentence for it, read by key
        if (dir === "no_response") { q.account = String(cs.w("screen.action.no.reply.came.by.the.date")); return { query: q, raw: "" }; }
        // "never both": the reply itself (a document the project holds) or the member's own account of it
        const fromDoc = val("reply-held") === "document";
        const doc = val("reply-doc"), account = val("reply-account");
        if (fromDoc) { if (!doc) return { refuse: "screen.action.a.reply.needs.either.the.document" }; q.artifact_sha = doc; }
        else { if (!account) return { refuse: "screen.action.reply.account.needed" }; q.account = account; }
        const put = function (name, id) { const v = val(id); if (v) q[name] = v; };
        put("medium", "reply-medium"); put("party", "reply-party"); put("stage", "reply-stage"); put("follows", "reply-follows"); put("outcome", "reply-outcome");
        put("exemptions", "reply-exemptions"); put("due_cite", "reply-duecite");
        const dueBy = val("reply-dueby");
        if (dueBy) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dueBy)) return { refuse: "screen.action.reply.at.needed" }; q.due_by = dueBy; }
        const fee = val("reply-fee");
        if (fee) { q.quote_amount = fee; put("quote_currency", "reply-fee-cur"); put("quote_basis", "reply-fee-basis"); put("quote_answers", "reply-fee-answers"); put("quote_revises", "reply-fee-revises"); }
        // R55: the minutes' passage, on a public comment's reply: all four parts or none; the words are found in the chosen document's
        // reading and the unit's extent is the passage (actions R108); a silence carries none
        const a = view.data.action && view.data.action.state === "ok" ? view.data.action.value : {};
        const parts = { "minutes-meeting": "screen.action.minutes.meeting.label", "minutes-date": "screen.action.minutes.date.label",
          "minutes-doc": "screen.action.minutes.doc.label", "minutes-passage": "screen.action.minutes.passage.label" };
        if (a.kind === "public_comment" && Object.keys(parts).some(function (id) { return val(id); })) {
          const need = Object.keys(parts).find(function (id) { return !val(id); });
          if (need) return { refuse: "findin.fieldneeded", fills: { field: { html: cs.w(parts[need]) } } };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(val("minutes-date"))) return { refuse: "screen.action.reply.at.needed" };
          const flat = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
          const words = flat(val("minutes-passage"));
          const read = view.ui.later && view.ui.later.minread;
          const units = read && read.state === "ok" && read.value && Array.isArray(read.value.text_units) ? read.value.text_units : [];
          const unit = units.find(function (u) { return u && u.extent && typeof u.extent === "object" && flat(u.text || "").includes(words); });
          if (!unit) return { refuse: "ai.progress.check.fail", fills: { passage: words } };
          q.minutes = JSON.stringify({ meeting: val("minutes-meeting"), date: val("minutes-date"), passage: { captureSha: val("minutes-doc"), extent: unit.extent } });
        }
        return { query: q, raw: "" };
      },
    },
    {
      // R5: a received reply marked as pressure directed at the group, once.
      op: "actionpressure",
      rereads: ["action", "pressure"],
      send: function (view, el, cs) {
        const ord = el.dataset.ord;
        const note = String(cs.value("pressure-note-" + ord) || "").trim();
        if (!note) return { refuse: "screen.action.pressure.needed" };
        return { body: { target: view.subject, ord: Number(ord), pressure: { kind: cs.value("pressure-kind-" + ord), note: note } } };
      },
    },
    {
      // R5: "Move the action", with the member's reason (asked by the shell, sent in the query actions reads).
      op: "actionmove",
      rereads: ["action"],
      send: function (view, el, cs) {
        const to = cs.value("move-to");
        if (!to) return null;
        const q = { target: view.subject, to: to };
        if (to === "resolved") q.resolution = cs.value("move-resolution");
        return { query: q, raw: "" };
      },
    },
    {
      // R5: "Remind me" on a dated entry, on the day the member chooses.
      op: "reminderset",
      send: function (view, el, cs) {
        const on = String(cs.value("remind-" + el.dataset.entry) || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { refuse: "screen.action.remindon.needed" };
        return { body: { target: view.subject, entry: Number(el.dataset.entry), on: on } };
      },
      // C53: the entry shows the reminder as the record holds it: the `reminders` read names this act in its `after`
      rereads: [],
    },
    {
      // R16: "Change the law…": the law chosen among those the group's places name replaces the action's list (the act logs
      // what it replaced); its level is the one a stated law of the same citation holds, else the one chosen.
      op: "actionlaws",
      send: function (view, el, cs) {
        const pf = view.data.profiles;
        const a = view.data.action && view.data.action.state === "ok" ? view.data.action.value : {};
        const offered = view.parts.lawsOf(pf && pf.state === "ok" ? pf.value : null, a.kind);
        const c = offered.find(function (d) { return d.citation === cs.value("law-pick"); });
        if (!c) return null;
        const held = a.governing_laws && Array.isArray(a.governing_laws.laws) ? a.governing_laws.laws.find(function (l) { return l.citation === c.citation; }) : null;
        return { body: { target: view.subject, laws: [{ level: held ? held.level : c.level || cs.value("law-level") || "state", citation: c.citation }] } };
      },
      rereads: ["action"],
    },
    {
      // R16: "Propose another law…": a proposal beside the list, which it never changes.
      op: "actionlawspropose",
      send: function (view, el, cs) {
        const pf = view.data.profiles;
        const a = view.data.action && view.data.action.state === "ok" ? view.data.action.value : {};
        const offered = view.parts.lawsOf(pf && pf.state === "ok" ? pf.value : null, a.kind);
        // R59: with no law the places list, the law is the one the member names (its level and citation)
        if (!offered.length) {
          const named = String(cs.value("law-cite") || "").trim();
          return named ? { body: { target: view.subject, laws: [{ level: cs.value("law-level") || "state", citation: named }] } } : null;
        }
        const c = offered.find(function (d) { return d.citation === cs.value("law-pick"); });
        if (!c) return null;
        return { body: { target: view.subject, laws: [{ level: c.level || cs.value("law-level") || "state", citation: c.citation }] } };
      },
      rereads: ["action"],
    },
    {
      // R17: "Revise, with a reason…": the tier a member sets, with the reason the shell asks and sends.
      op: "actionrisktier",
      send: function (view, el, cs) {
        const t = Number(cs.value("risk-tier"));
        return [1, 2, 3].includes(t) ? { body: { target: view.subject, tier: t } } : null;
      },
      rereads: ["action"],
    },
    ...OWED({
      // R23: "Open a question from this": the question the member wrote, with the action as its reference; the new question
      // opens in the action's project, and this page is unchanged.
      op: "actioninquiry", label: "action.noreply.question",
      send: function (view, el, cs) {
        const question = String(cs.value("action-question") || "").trim();
        if (!question) return { refuse: "refusal.ACTION_INQUIRY_NO_QUESTION" };
        return { body: { action: view.subject, question: question } };
      },
      rereads: [],
      done: function (view, answer, cs) { if (answer && answer.inquiry) cs.set("asked", { inquiry: answer.inquiry }); return { stay: true }; },
    }),
    {
      // R31 (1): "Show the routes": the procedure guides for this kind of action, read again by the page's own read; legal
      // information, not advice. Nothing is written.
      op: "procedureguides",
      send: function (view, el, cs) { cs.set("guideN", (view.ui.guideN || 0) + 1); return null; },
    },
    JOIN,
    WRITE_HELP,
    {
      // R5 (v0.2 rule 15): confidential or not, with a reason; a published case keeps what it said.
      op: "actionscope",
      send: function (view, el) { return { body: { target: view.subject, confidential: el.dataset.to === "true" } }; },
      rereads: ["action"],
    },
  ],
});
