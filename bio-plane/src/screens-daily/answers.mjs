/* Ask (registry screen `answers`, Find › Ask; screens-daily R6, R7, R21). While the assistant is reachable for the member
   (interface-shell R20, `view.reachable`), "Ask" sends the question through `op=ask` (agent-worker R54: its answer's
   summary and sentences with their support, the holdings each rests on, the looks, labelled machine work) and "Search
   instead" opens Find. While it is not, the screen is "Find and count": search, and `ruleanswer` "Show how this was
   counted". In both, the question can be kept asking (`standingquestionset`) and stopped (`standingquestionend`). The
   registry names `ask` itself since T47 (interface-shell R28, R38; its own label `act.ask.label.answers`). Every function is self-contained (interface-shell R21 (1)). */

import { frontTitle } from "./front-title.mjs";

export const answers = Object.freeze({
  id: "answers",
  parts: { frontTitle },

  reads: function (view) {
    const ui = view.ui || {};
    const out = {};
    // R6 (K5131): whether the rule services are on, read once; "Show how this was counted" is drawn only while it reads `on`.
    if (!view.reachable) out.rules = { op: "ruleservicesstate", query: {} };
    if (!view.reachable && typeof ui.q === "string" && ui.q.trim()) {
      // R6, R35: the words asked as words (the fields route) and, apart, as passages holding them (retrieval R15, R88: an `OR` across routes is
      // refused `ROUTES_CROSSED`, so each route is its own read); a query in the member's own syntax is sent as written, to `search` alone.
      const w = ui.q.trim().split(/\s+/);
      const plain = w.every(function (x) { return /^[\p{L}\p{N}][\p{L}\p{N}'-]*$/u.test(x) && !/^(AND|OR|NOT|NEAR)$/.test(x); });
      out.search = {
        op: "search", query: { q: plain ? w.join(" ") : ui.q, limit: "50", snippet: "160" },
        empty: function () { return false; },
      };
      if (plain) out.passages = { op: "search", query: { q: w.map(function (x) { return "passage:" + x; }).join(" "), limit: "50", snippet: "160" } };
    }
    return out;
  },

  render: function (cs, view) {
    const ui = view.ui || {};
    const keep = '<div class="mk-acts">' + cs.act("standingquestionset", { label: "act.standingquestionset.label.answers" })
      + (ui.standing ? cs.act("standingquestionend", { label: "act.standingquestionend.label.answers", data: { id: String(ui.standing.id) } }) : "")
      + "</div>"
      + (ui.standing ? '<p class="mk-note">' + cs.w("screen.answers.kept", { cadence: cs.w("screen.answers.cadence.weekly"), date: cs.date(String(ui.standing.ends || ""), { year: true }) }) + "</p>" : "")
      + '<p class="mk-note">' + cs.w("screen.answers.keeping") + "</p>";

    if (view.reachable) {
      // R52, R53: the ask's progress as it is written, and its answer only once the plane's check has passed it. The stream's rows
      // (what is read, that it is being written, that it is being checked) are drawn in a polite live region in the answer's place.
      const st = ui.stream && typeof ui.stream === "object" ? ui.stream : null;
      const titles = ui.titles && typeof ui.titles === "object" ? ui.titles : {};
      let progress = "";
      if (st && st.working) {
        const reads = (Array.isArray(st.reads) ? st.reads : []).filter(function (r) { return r && titles[r]; });
        progress = '<section class="mk-note" role="status" aria-live="polite" data-ask="working" tabindex="0" data-level="2" data-tip="' + cs.w("ai.progress.means") + '"><ul class="mk-list">'
          + reads.map(function (r) { return "<li>" + cs.w("ai.progress.reading.ask", { document: titles[r] }) + "</li>"; }).join("")
          + (st.composing ? "<li>" + cs.w("ai.progress.composing.answer") + "</li>" : "")
          + (st.checking ? "<li>" + cs.w("ai.progress.checking") + "</li>" : "")
          + '</ul><p class="muted">' + cs.w("ai.progress.hold.answer") + "</p></section>";
      } else if (st && st.failed) {
        progress = '<section class="mk-note" role="status" aria-live="polite" data-ask="failed"><p>' + cs.w("ai.progress.check.failed") + "</p><p>" + cs.w("screen.answers.failed.next") + "</p></section>";
      }
      const a = ui.answer && typeof ui.answer === "object" && !(st && (st.working || st.failed)) ? ui.answer : null;
      let drawn = "";
      if (a) {
        const holdings = Array.isArray(a.holdings) ? a.holdings : [];
        const looks = Array.isArray(a.looks) ? a.looks : [];
        const holdingLink = function (i) {
          const h = holdings[i];
          if (!h) return "";
          const addr = String(h.address || "");
          const doc = addr.split("#")[0];
          return cs.ref("document", addr, h.quote ? String(h.quote) : doc, [doc]);
        };
        const supportOf = function (ids) {
          return (Array.isArray(ids) ? ids : []).map(function (id) {
            const m = /^h(\d+)$/.exec(String(id));
            return m ? " " + holdingLink(Number(m[1]) - 1) : "";
          }).join("");
        };
        const summary = a.summary && a.summary.text ? "<p><b>" + cs.esc(String(a.summary.text)) + "</b></p>" : "";
        const sentences = (Array.isArray(a.sentences) ? a.sentences : []).map(function (s) {
          return "<p>" + cs.esc(String(s.text || "")) + supportOf(s.support) + "</p>";
        }).join("");
        const where = holdings.length
          ? '<h3>' + cs.w("screen.answers.holdings") + '</h3><ul class="mk-list">' + holdings.map(function (h, i) { return "<li>" + holdingLink(i) + "</li>"; }).join("") + "</ul>" : "";
        const LEVELS = ["document", "content", "meaning", "internet"];
        const STATES = ["LOOKED_FOUND", "LOOKED_ABSENT", "NOT_LOOKED"];
        const looked = looks.length
          ? '<h3>' + cs.w("screen.answers.looks") + '</h3><ul class="mk-list">' + looks.map(function (l) {
            const level = LEVELS.indexOf(l.level) >= 0 ? cs.w("screen.answers.level." + l.level) : cs.esc(String(l.level || ""));
            const state = STATES.indexOf(l.state) >= 0 ? cs.w("screen.answers.state." + l.state) : cs.w("screen.answers.state.other", { state: String(l.state || "") });
            return "<li><span>" + level + "</span> <span>" + state + "</span></li>";
          }).join("") + "</ul>" : "";
        // R27: what the answer says is not established, each as the sentence it is (the system's own entry for withheld sentences
        // says how many); drawn beneath a heading, only when it holds something.
        const unsure = (Array.isArray(a.not_established) ? a.not_established : []).map(function (e) {
          if (typeof e === "string") return e.trim() ? cs.esc(e) : "";
          if (e && typeof e === "object" && typeof e.text === "string" && e.text.trim()) return cs.esc(e.text);
          if (e && typeof e === "object" && typeof e.withheld === "number" && e.withheld > 0) return e.withheld === 1 ? cs.w("screen.answers.withheld.one") : cs.w("screen.answers.withheld", { n: String(e.withheld) });
          return "";
        }).filter(Boolean);
        const notEstablished = unsure.length ? "<h3>" + cs.w("screen.answers.notestablished") + '</h3><ul class="mk-list">'
          + unsure.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" : "";
        const withheld = Array.isArray(ui.withheld) && ui.withheld.length
          ? '<p class="mk-note">' + (ui.withheld.length === 1 ? cs.w("screen.answers.withheld.one") : cs.w("screen.answers.withheld", { n: String(ui.withheld.length) })) + "</p>" : "";
        const asRead = a.question_as_read ? '<p class="mk-small">' + cs.w("screen.answers.asread", { question: String(a.question_as_read) }) + "</p>" : "";
        const untested = ui.untested ? '<p class="mk-tag" data-untested="true">' + cs.w("ai.label.untested") + "</p>" : "";
        drawn = '<div class="cs-machinework">' + asRead + summary + sentences + notEstablished + where + looked + withheld
          + '<p class="mk-note" tabindex="0" data-level="2" data-tip="' + cs.w("ai.progress.checked.all.means") + '">' + cs.w("ai.progress.checked.all") + "</p>"
          + '<p class="mk-note">' + cs.w("screen.answers.legal") + "</p>" + untested
          + '<span class="by">' + cs.w("screen.answers.machine") + "</span></div>";
      }
      return cs.title(undefined, {}) + '<p class="mk-sub">' + cs.w("screen.answers.sub") + "</p>"
        + cs.field("answers-q", "screen.answers.question", { area: true, rec: true, value: ui.q || "" })
        + '<div class="mk-acts">' + cs.act("ask", { label: "act.ask.label.answers", tone: "primary" })
        + cs.act("search", { label: "act.search.label.answers" }) + "</div>"
        + progress + drawn + keep;
    }

    // Not reachable: "Find and count".
    // The fields route and the passages route are read apart (R6); the documents either holds are drawn once each.
    const f = view.data.search, p = view.data.passages;
    const settled = function (x) { return !!x && x.state !== "loading"; };
    const hitsOf = function (x) { return x && x.state === "ok" && x.value && Array.isArray(x.value.hits) ? x.value.hits : []; };
    let results = "";
    if (f) {
      const seen = {};
      const merged = hitsOf(f).concat(hitsOf(p)).filter(function (h) { const id = String(h.bundle_id); return seen[id] ? false : (seen[id] = true); });
      if (!settled(f) || (p && !settled(p))) results = cs.state(f.state === "loading" ? f : p, null);
      else if (merged.length === 0 && f.state === "failed" && (!p || p.state === "failed")) results = cs.state(f, null);
      else results = cs.state(merged.length ? { state: "ok", value: { hits: merged } } : { state: "empty" }, function (s) {
        return cs.sheet(s.hits.map(function (h) {
          const id = String(h.bundle_id);
          return cs.row(cs.mark("origin", "search"), cs.ref("document", id, h.title || id, []) + (h.snippet ? '<span class="meta">' + cs.esc(String(h.snippet)) + "</span>" : ""), "", "");
        }).join(""));
      }, { empty: "screen.finder.none" });
    }
    const rs = view.data.rules;
    const ruleOn = !!(rs && rs.state === "ok" && rs.value && rs.value.on === true);
    const r = ui.rule && typeof ui.rule === "object" ? ui.rule : null;
    const LABELS = ["legal_information", "procedural_fact", "computed_fact"];
    const rule = !r ? "" : '<div class="mk-note">' + (r.not_held
      ? "<p>" + cs.w("screen.answers.rule.notheld", { reason: String(r.not_held.reason || "") }) + "</p>"
      : "<p>" + cs.w("screen.answers.rule.value", {
        label: LABELS.indexOf(r.label) >= 0 ? cs.w("screen.answers.label." + r.label) : String(r.label || ""),
        value: typeof r.value === "object" ? JSON.stringify(r.value) : String(r.value),
      }) + "</p>" + (r.basis ? "<p>" + cs.w("screen.answers.rule.basis", { basis: typeof r.basis === "object" ? JSON.stringify(r.basis) : String(r.basis) }) + "</p>" : ""))
      + "</div>";
    return cs.title(cs.w("screen.answers.offtitle"), {}) + '<p class="mk-sub">' + cs.w("screen.answers.offsub") + "</p>"
      + '<div class="mk-search">' + cs.field("answers-q", "screen.finder.words", { value: ui.q || "" })
      + '<span class="mk-acts">' + cs.act("search", { label: "act.search.label.finder", tone: "primary" }) + "</span></div>"
      + results
      + (ui.q && ruleOn ? '<div class="mk-acts">' + cs.act("ruleanswer", { label: "act.ruleanswer.label.answers" }) + "</div>" : "")
      + rule + keep;
  },

  acts: [
    // R6: the question through `op=ask`; the answer is a stream whose last event is the answer or the refusal.
    { op: "ask", label: "act.ask.label.answers", rereads: [],
      refusals: {
        AI_LIMIT_REACHED: "ai.refused.limit", AI_LIMIT_UNJUDGED: "ai.refused.limit.unjudged", AI_USE_SWITCHED_OFF: "ai.refused.off",
        AI_KEPT_AWAY: "ai.refused.projectkeptaway", NO_ACCOUNT: "ai.refused.signinnotconnected",
        ASSISTANT_OFF: "screen.answers.refused.off", AI_PART_NOT_DEPLOYED: "screen.answers.refused.notdeployed",
        ANSWER_MALFORMED: "refusal.ANSWER_MALFORMED",
        // R53: not ready: the words, and a door to `connect`.
        ASSISTANT_REMOTE_NOT_READY: function (refusal, cs) {
          return cs.w("refusal.ASSISTANT_REMOTE_NOT_READY") + ' <a class="cs-btn" data-tone="quiet" data-nav href="/app/connect">' + cs.w("screen.connect.name") + "</a>";
        },
      },
      send: function (view, el, cs) {
        const q = String(cs.value("answers-q") || "").trim();
        if (!q) return { refuse: "screen.answers.questionfirst" };
        cs.set("q", q);
        // R52: a new ask clears the last answer and its progress.
        view.ui.stream = null;
        view.ui.answer = null;

      // R52, R53: each stream event as it arrives (interface-shell R78). The reads, that the answer is being written and that it
      // is being checked are drawn as they come; nothing of the answer is drawn before the `answer` event, which follows the
      // plane's check; a stream that ends `refused` (`ASK_CHECK_FAILED`) draws the failed-check sentence and no answer.
        const onEvent = function (event) {
          const ui = view.ui || {};
          const ev = event && typeof event === "object" ? event : {};
          const cur = ui.stream && typeof ui.stream === "object" ? ui.stream : { working: false, reads: [], composing: false, checking: false, failed: false };
          const next = { working: true, reads: cur.reads.slice(), composing: cur.composing, checking: cur.checking, failed: false };
          if (ev.event === "read" && ev.record) {
            const id = String(ev.record);
            if (next.reads.indexOf(id) < 0) next.reads.push(id);
            if (!(ui.titles && ui.titles[id])) {
              // The document is named by its title, read once (R26): the row shows when the title is known.
              cs.call("image", { query: { id: id } }).then(function (a) {
                const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
                const t = view.parts.frontTitle(v);
                if (t) { const titles = Object.assign({}, (view.ui || {}).titles || {}); titles[id] = t; cs.set("titles", titles); }
              }, function () {});
            }
          } else if (ev.event === "composing") next.composing = true;
          else if (ev.event === "checking") next.checking = true;
          else if (ev.event === "answer") {
            next.working = false;
            const a = ev.answer && typeof ev.answer === "object" ? ev.answer : null;
            cs.set("stream", next);
            cs.set("answer", a);
            cs.set("withheld", Array.isArray(ev.withheld) ? ev.withheld : []);
            cs.set("untested", !!ev.untested || !!(a && a.untested));
            return;
          } else if (ev.event === "refused") {
            cs.set("stream", { working: false, reads: next.reads, composing: false, checking: false, failed: ev.code === "ASK_CHECK_FAILED" });
            cs.set("answer", null);
            return;
          }
          cs.set("stream", next);
        };
        return { body: { question: q }, onEvent: onEvent };
      },
      done: function (view, answer, cs) {
        let ev = answer;
        if (typeof ev === "string") {
          const lines = ev.split("\n").filter(function (l) { return l.trim(); });
          try { ev = JSON.parse(lines[lines.length - 1]); } catch (e) { ev = null; }
        }
        if (Array.isArray(ev)) ev = ev[ev.length - 1];
        if (ev && ev.result && !ev.answer) ev = ev.result;
        // R53: a stream that ended in `refused` has no answer; nothing of it is drawn.
        if (ev && ev.event === "refused") {
          cs.set("stream", { working: false, reads: [], composing: false, checking: false, failed: ev.code === "ASK_CHECK_FAILED" });
          cs.set("answer", null);
          return;
        }
        const a = ev && ev.answer && typeof ev.answer === "object" ? ev.answer : null;
        cs.set("stream", null);
        cs.set("answer", a);
        cs.set("withheld", ev && Array.isArray(ev.withheld) ? ev.withheld : []);
        cs.set("untested", !!(ev && ev.untested) || !!(a && a.untested));
      } },
    // "Search instead" (reachable) opens Find with the question's words; "Search" (not reachable) searches here.
    { op: "search", label: "act.search.label.answers", rereads: ["search", "passages"],
      send: function (view, el, cs) {
        const q = String(cs.value("answers-q") || "").trim();
        if (!q) return { refuse: "screen.finder.wordsfirst" };
        cs.set("q", q);
        if (view.reachable) { cs.go("finder", q); return null; }
        // R6, R35: the plain words go to the fields route as they are; the passage route is the screen's other read (`passages`), never joined by `OR`.
        const w = q.split(/\s+/);
        const plain = w.every(function (x) { return /^[\p{L}\p{N}][\p{L}\p{N}'-]*$/u.test(x) && !/^(AND|OR|NOT|NEAR)$/.test(x); });
        return { query: { q: plain ? w.join(" ") : q, limit: "50", snippet: "160" } };
      } },
    // "Show how this was counted": the rule service's answer with its basis and label (answers R7).
    { op: "ruleanswer", label: "act.ruleanswer.label.answers", rereads: [],
      send: function (view, el, cs) {
        const q = String((view.ui || {}).q || "").trim();
        if (!q) return { refuse: "screen.finder.wordsfirst" };
        return { body: { service: "occurrences", args: { q: q } } };
      },
      done: function (view, answer, cs) {
        cs.set("rule", answer && answer.service ? answer : (answer && answer.result) || null);
      } },
    { op: "standingquestionset", label: "act.standingquestionset.label.answers", rereads: [],
      send: function (view, el, cs) {
        const q = String(cs.value("answers-q") || (view.ui || {}).q || "").trim();
        if (!q) return { refuse: "screen.answers.questionfirst" };
        const ends = new Date(cs.now() + 365 * 86400000).toISOString().slice(0, 10);
        return { body: { question: q, query: q, cadence: "weekly", ends: ends } };
      },
      done: function (view, answer, cs) {
        const a = answer && answer.id ? answer : (answer && answer.result) || {};
        if (a.id) cs.set("standing", { id: a.id, ends: a.ends || "" });
      } },
    { op: "standingquestionend", label: "act.standingquestionend.label.answers", rereads: [],
      send: function (view, el) { return el.dataset.id ? { body: { id: el.dataset.id } } : null; },
      done: function (view, answer, cs) { cs.set("standing", null); } },
  ],
});
