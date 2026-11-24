/* Find in this (registry screen `find-in`; screens-daily R5, R7, R21; DEC-164, N698, K1468). One control over a document, the
   documents held together, or a project: the member ticks what to find, with an optional name or term and question;
   `findin` answers results by kind, each with its words as written, its passage and "Found by search"; each result offers
   only the recording act of its kind, and finding itself records nothing. The scope is the route's first step: a project's
   id (`PROJ-…`), a held set's handle (`sel-…`), else a document's capture digest; its second, if any, is the question
   chosen (K3372). Every function is self-contained (interface-shell R21 (1)). */
import { frontTitle } from "./front-title.mjs";
import { forms } from "./find-in-forms.mjs";

export const findIn = Object.freeze({
  id: "find-in",
  parts: { frontTitle, forms },

  reads: function (view) {
    const s = String(view.subject || "").split("/")[0];
    const out = {
      // The team's time zone, read by its own path (local-facts R21): the bounds of a person fact are counted in it.
      zone: { op: "factstatus", query: { path: "@team/time_zone" } },
    };
    // R48 (7): the questions a result may be recorded for: the project's own when the scope is a project, else those the member may see.
    if (s.indexOf("PROJ-") === 0) {
      out.projectquestions = { op: "projectquestions", query: { project: s, limit: "200" }, empty: function (v) { return !v || !Array.isArray(v.items) || v.items.length === 0; } };
    } else {
      out.questions = {
        op: "search", query: { q: "type:inquiry", limit: "200" },
        empty: function (v) { return !v || !Array.isArray(v.hits) || v.hits.length === 0; },
      };
      // C35: each question is told by its project's name (a hit names none); the projects are read here and each one's questions in `render`.
      out.projects = { op: "projectlist", empty: function () { return false; } };
    }
    // R26: a project scope is named by the project's title, read from its document.
    if (s.indexOf("PROJ-") === 0) out.project = { op: "image", query: { id: s } };
    // R38 (K3562): a document's scope is its capture's fingerprint, read from its provenance, never its record id.
    if (s && s.indexOf("PROJ-") !== 0 && s.indexOf("sel-") !== 0 && !/^[0-9a-f]{64}$/.test(s)) out.capture = { op: "image", query: { id: s } };
    return out;
  },

  // The path's project step (interface-shell R8) when the scope is a project: by its title, never its address (R26).
  place: function (view) {
    const s = String(view.subject || "").split("/")[0];
    if (s.indexOf("PROJ-") !== 0) return null;
    const r = view.data && view.data.project;
    const title = r && r.state === "ok" ? view.parts.frontTitle(r.value) : null;
    return title ? { project: { id: s, title: title } } : null;
  },

  render: function (cs, view) {
    const ui = view.ui || {};
    const s = String(view.subject || "").split("/")[0];
    // K3372: `/app/find-in/<scope>/<question>` opens with that question chosen (capture's "Cite a passage" opens it so).
    const routed = String(view.subject || "").split("/").slice(1).join("/");
    if (ui.question === undefined && routed) ui.question = routed;
    const form = !s ? "" : s.indexOf("PROJ-") === 0 ? "project" : s.indexOf("sel-") === 0 ? "held" : "document";
    const KINDS = ["people", "money", "dates", "requirements", "events", "term"];
    const PARTS = ["footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];
    const RECORD = { people: "recordpersonfact", money: "recordfact", dates: "recorddatedfact", events: "recorddatedfact", requirements: "standarddeclare", term: "cite" };
    // The forms each recording act asks the member (R47, R48), drawn in place in a disclosure with the act and read by its `send`.
    const recordAct = function (op, ki, ii, it) {
      const f = "fr-" + ki + "-" + ii;
      const button = cs.act(op, { label: "act." + op + ".label.find-in", data: { k: String(ki), i: String(ii), f: f } });
      // R24: "Cite in the question" asks whether the passage supports the question or cuts against it, none preselected.
      if (button && op === "cite") {
        return '<details class="mk-details"><summary>' + cs.w("act.cite.label.find-in") + "</summary>"
          + '<fieldset class="mk-checks" id="' + f + '-role"><legend>' + cs.w("act.cite.label.find-in") + "</legend>"
          + ["supports", "against"].map(function (r) {
            return '<label><input type="radio" name="' + f + '-role" id="' + f + "-role-" + r + '" value="' + r + '"> ' + cs.w("screen.findin.cite." + r) + "</label>";
          }).join("") + "</fieldset>" + button + "</details>";
      }
      if (!button) return button;
      const formHtml = view.parts.forms().draw(cs, view, op, f, it);
      return formHtml ? '<details class="mk-details"><summary>' + cs.w("act." + op + ".label.find-in") + "</summary>" + formHtml + button + "</details>" : button;
    };
    const head = cs.title(undefined, {}) + '<p class="mk-sub">' + cs.w("screen.find-in.sub") + "</p>";
    // R21 (interface-shell R61): opened with no scope, "Nothing is here", with the way back.
    if (!form) {
      return '<h1 class="t-title" tabindex="0">' + cs.w("shell.unavailable.nothing.title") + "</h1>"
        + '<p class="cs-state" data-state="empty">' + cs.w("screen.find-in.scope.none") + "</p>"
        + '<p class="mk-acts"><a class="cs-btn" data-tone="quiet" href="/app" data-nav>' + cs.w("shell.unavailable.home") + "</a></p>";
    }

    // "Look in": the scope, set by where it was opened (not a field: nothing is typed here).
    // R26: the scope by its title, never by its address or digest; a document's title is the answer's, once it has answered.
    const pr = view.data.project;
    const foundScope = ui.found && ui.found.scope && typeof ui.found.scope === "object" ? ui.found.scope : {};
    // R49: the project by its title as the find answers it (retrieval R80), else as its document states it.
    const ptitle = form === "project" ? (typeof foundScope.title === "string" && foundScope.title.trim() ? foundScope.title : pr && pr.state === "ok" ? view.parts.frontTitle(pr.value) : null) : null;
    const dtitle = form === "document" ? (typeof foundScope.title === "string" && foundScope.title.trim() ? foundScope.title : null) : null;
    // The scope's sentence: a project by its title and how many documents it holds (once the answer says), a document by its title.
    const ref = function (kind, title) { return { html: cs.ref(kind, s, title, []) }; };
    const named = form === "project" ? (ptitle && typeof foundScope.captures === "number"
        ? cs.w("screen.find-in.scope.project", { project: ref("project", ptitle), count: String(foundScope.captures) }) : ptitle ? cs.ref("project", s, ptitle, []) : "")
      : form === "held" ? cs.w("screen.find-in.scope.held")
      : dtitle ? cs.w("screen.find-in.scope.this", { document: ref("document", dtitle) }) : cs.w("screen.find-in.scope.document");
    const scope = '<div><p class="mk-note"><b>' + cs.w("screen.find-in.lookin") + "</b> " + named + "</p>"
      + '<p class="mk-small muted">' + cs.w("screen.find-in.lookin.help") + "</p></div>";
    const ticked = ui.kinds && typeof ui.kinds === "object" ? ui.kinds : { people: true, money: true, dates: true, requirements: true };
    const what = '<fieldset class="mk-checks"><legend>' + cs.w("screen.find-in.what") + "</legend>"
      + KINDS.filter(function (k) { return k !== "term"; }).map(function (k) {
        return '<label><input type="checkbox" id="findin-kind-' + k + '"' + (ticked[k] ? " checked" : "") + "> " + cs.w("screen.find-in.kind." + k) + "</label>";
      }).join("") + "</fieldset>";
    // R48 (6): "The name or term" applies when filled and has no tick box.
    const term = cs.field("findin-term", "screen.find-in.term", { value: ui.term || "", help: "screen.find-in.term.help" });
    // R48 (7): "For which question" offers the project's questions (a project's own, else those the member may see), preselecting the one
    // the find was opened with, with no "None yet"; when there are none, `screen.document.cite.noquestion` says to open one first.
    const pq = view.data.projectquestions && view.data.projectquestions.state === "ok" && view.data.projectquestions.value && Array.isArray(view.data.projectquestions.value.items)
      ? view.data.projectquestions.value.items.map(function (x) { return { bundle_id: String(x.inquiry), title: x.title }; }) : null;
    const hits = view.data.questions && view.data.questions.state === "ok" && view.data.questions.value && Array.isArray(view.data.questions.value.hits)
      ? view.data.questions.value.hits : [];
    // C35: whose project each question is in: each project's questions read once (page memory `qs:<id>`); a question no read names stays by its title.
    const ownerOf = {};
    const pl = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.projects) ? view.data.projects.value.projects : [];
    if (!pq) pl.forEach(function (p) {
      const id = String(p.id);
      const m = ui["qs:" + id];
      if (!m) {
        ui["qs:" + id] = { state: "loading", items: [] };
        cs.call("projectquestions", { query: { project: id, limit: "200" } }).then(function (a) {
          const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
          cs.set("qs:" + id, v && v.ok !== false && Array.isArray(v.items) ? { state: "ok", items: v.items.map(function (x) { return String(x.inquiry); }) } : { state: "failed", items: [] });
        }, function () { cs.set("qs:" + id, { state: "failed", items: [] }); });
      } else {
        m.items.forEach(function (q) { ownerOf[q] = String(p.name || id); });
      }
    });
    const seen = {};
    const qs = pq || hits.filter(function (h) { const k = String(h.bundle_id); if (seen[k]) return false; seen[k] = true; return true; });
    // R39 (K3562): the question the route chose stays chosen, though the list of questions does not name it.
    const routedQ = ui.question && !qs.some(function (h) { return String(h.bundle_id) === String(ui.question); }) ? [{ value: String(ui.question), text: String(ui.question) }] : [];
    // None is preselected unless the find was opened with one: the first line only asks to choose (it is not a "None yet" choice).
    const options = (ui.question ? [] : [{ value: "", text: cs.w("findin.question.choose") }]).concat(routedQ, qs.map(function (h) { return { value: String(h.bundle_id), text: String(h.title || h.bundle_id) + (ownerOf[String(h.bundle_id)] ? " · " + ownerOf[String(h.bundle_id)] : "") }; }));
    // G20: the lists are bounded (200); one that stops there says how many it shows (a held row's nearest stand-in: the people list's).
    const pqv = view.data.projectquestions && view.data.projectquestions.state === "ok" ? view.data.projectquestions.value : null;
    const qv = view.data.questions && view.data.questions.state === "ok" ? view.data.questions.value : null;
    const cut = (pqv && pqv.cursor) || (qv && typeof qv.total === "number" && qv.total > hits.length);
    const question = routedQ.length || qs.length
      ? cs.choice("findin-question", "findin.question.choose", options, { value: ui.question || "" }) + '<p class="mk-small muted">' + cs.w("screen.find-in.question.help") + "</p>"
        + (cut ? '<p class="mk-small">' + cs.w("screen.people.more", { n: String(qs.length) }) + "</p>" : "")
      : '<p class="mk-note">' + cs.w("screen.document.cite.noquestion") + "</p>";
    const acts = '<div class="mk-acts">' + cs.act("findin", { label: "act.findin.label.find-in", tone: "primary" })
      + cs.act("standingquestionset", { label: "act.standingquestionset.label.find-in" }) + "</div>"
      + (ui.keeping ? '<p class="mk-note">' + cs.w("screen.find-in.keeping") + "</p>" : "");

    const fm = view.parts.forms();
    const recorded = ui.recorded && typeof ui.recorded === "object" ? ui.recorded : {};
    const found = ui.found && typeof ui.found === "object" ? ui.found : null;
    const results = !found ? "" : (Array.isArray(found.kinds) ? found.kinds : []).map(function (k, ki) {
      const items = Array.isArray(k.items) ? k.items : [];
      const n = typeof k.count === "number" ? k.count : items.length;
      // R21: no count at zero: a kind with none is named alone, and says "Nothing here" (R5).
      const kindName = cs.w("screen.find-in.kind." + (KINDS.indexOf(k.kind) >= 0 ? k.kind : "term"));
      const title = k.kind === "term"
        ? (n ? cs.w("screen.find-in.termsection", { term: found.term || "", n: String(n) }) : cs.w("screen.find-in.quote", { words: found.term || "" }))
        : (n ? cs.w("screen.find-in.section", { kind: { html: kindName }, n: String(n) }) : kindName);
      const notRead = Array.isArray(k.not_read) && k.not_read.length
        ? '<p class="mk-note">' + (k.not_read.length === 1 ? cs.w("screen.find-in.notread.one") : cs.w("screen.find-in.notread", { n: String(k.not_read.length) })) + "</p>" : "";
      const body = !items.length
        ? (k.nothing ? '<p class="mk-note"><b>' + cs.w("screen.find-in.nothing") + "</b></p>" : "") + notRead
        : cs.sheet(items.map(function (it, ii) {
          const extent = it.extent && typeof it.extent === "object" ? it.extent : {};
          const p = extent.passage !== undefined ? extent.passage : extent.paragraph;
          // R26, R49: the result by its document's title and its place in it; a document the answer does not title is not named by its digest.
          const dt = typeof it.title === "string" && it.title.trim() ? it.title : it.document && typeof it.document.title === "string" && it.document.title.trim() ? it.document.title : null;
          // R17a (retrieval-browse R21): a term item lying outside the document's body says which part: its kind, by the held word
          // (`content.part_kind.<kind>`, the nearest row until the design gives its own). `body`, a unit stored without a kind (null) and a kind
          // outside the closed list draw none, and a kind is never guessed.
          const part = typeof it.part === "string" && it.part !== "body" && PARTS.indexOf(it.part) >= 0 && cs.w("content.part_kind." + it.part) !== "content.part_kind." + it.part
            ? ' <span class="mk-small" data-part-kind="' + it.part + '">' + cs.w("content.part_kind." + it.part) + "</span>" : "";
          const where = (dt && it.capture_sha ? cs.ref("document", String(it.capture_sha), dt, []) + " " : "")
            + (p !== undefined ? "<span>" + cs.w("screen.find-in.passage", { n: String(p) }) + "</span>" : "") + part;
          // R48 (8): a match in a sheet says its sheet and row and draws its cells apart; a formula the file never calculated says so;
          // a person named in the passage by a held alias says so.
          // R62: the row is the match's own `row` (retrieval-browse R8), never parsed from its extent; a match answering none (a
          // column result, or a match in a unit's own text) draws the sheet and its cells without a row number.
          const hasRow = typeof it.row === "number" || (typeof it.row === "string" && it.row !== "");
          const sheet = typeof it.sheet === "string" && it.sheet ? '<span class="meta">' + (hasRow ? cs.w("findin.match.sheet", { sheet: it.sheet, row: String(it.row) }) : cs.w("findin.match.sheet.norow", { sheet: it.sheet })) + "</span>"
            + (Array.isArray(it.cells) ? '<span class="meta">' + it.cells.map(function (c) {
              return c && c.value === null && c.cached === null ? '<span class="muted">' + cs.w("findin.cell.uncalculated", { cell: String(c.cell || "") }) + "</span>"
                : "<span>" + cs.esc(String(c && c.value !== undefined && c.value !== null ? c.value : "")) + "</span>";
            }).join(" · ") + (it.cells_truncated === true ? " · " + cs.w("find.browse.more") : "") + "</span>" : "") : "";
          const aliased = it.correspondence === "name_in_passage" ? '<span class="meta">' + cs.w("findin.match.nameinpassage") + "</span>" : "";
          const rec = Array.isArray(it.recorded) && it.recorded.length ? it.recorded[0] : null;
          const op = it.table || it.kind === "table" ? "tabledeclare" : RECORD[k.kind];
          const id = ki + "-" + ii;
          const ack = recorded[id] && typeof recorded[id] === "object" ? recorded[id] : null;
          const count = (Array.isArray(it.recorded) ? it.recorded.length : 0) + (ack ? ack.n : 0);
          // R39, R48 (5): a passage keeps its acts after a fact is recorded from it and says how many facts it has; an already-cited
          // passage says so. Its cite act stays beside who recorded it: it is cited into the question chosen, not recorded again.
          const right = (rec ? cs.mark("origin", "accepted") + " " + cs.w("screen.find-in.recorded", { who: cs.memberName(rec.by || rec.member || rec.who) }) : "")
            + (op ? recordAct(op, ki, ii, it) : "");
          return cs.row(cs.mark("origin", "search"), '<span class="rec">' + cs.w("screen.find-in.quote", { words: String(it.words || it.as_read || "") }) + "</span>"
            + '<span class="meta">' + where + "</span>" + sheet + aliased
            + (ack ? '<span class="meta" role="status">' + ack.html + "</span>" : "")
            + (count ? '<span class="meta">' + (count === 1 ? cs.w("passage.facts.count.one") : cs.w("passage.facts.count", { count: String(count) })) + "</span>" : ""), right, "");
        }).join("")) + notRead;
      // G16 (S5): a kind cut at its bound says so, whichever kind it is; the term's also offers the whole search in Find.
      const more = k.truncated ? '<p class="mk-note">' + cs.w("find.browse.more") + "</p>"
        + (k.kind === "term" ? '<div class="mk-acts">' + cs.act("search", { label: "act.search.label.find-in", data: { term: String(found.term || "") } }) + "</div>" : "") : "";
      return '<section class="cs-section mk-sec"><h2>' + title + "</h2>" + body + more + "</section>";
    }).join("") + (found.term && !found.kinds.some(function (k) { return k.kind === "term" && k.truncated; })
      ? '<div class="mk-acts">' + cs.act("search", { label: "act.search.label.find-in", data: { term: String(found.term) } }) + "</div>" : "");

    // G16 (S5): a find reads at most 200 documents a call; while more of the scope is left it says how many it has searched and continues.
    const total = found && found.scope && typeof found.scope.captures === "number" ? found.scope.captures : null;
    const searched = found && found.next && total !== null ? '<p class="mk-note">' + cs.w("screen.held.archivemore", { shown: String(found.read || 0), total: String(total) }) + '</p><div class="mk-acts">'
      + cs.act("findin", { label: "find.browse.showmore", data: { cont: String(found.next) } }) + "</div>" : "";
    return head + scope + what + term + question + acts + searched + results + '<p class="mk-note">' + cs.w("screen.find-in.note") + "</p>";
  },

  acts: [
    // R5: finding records nothing (`findin` is a read, K1468); the answer is kept in the screen's page memory. R48 (6): a term, when
    // filled, is found too, with no tick box for it.
    { op: "findin", label: "act.findin.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const s = String(view.subject || "").split("/")[0];
        if (!s) return { refuse: "screen.find-in.scope.none" };
        const KINDS = ["people", "money", "dates", "requirements", "events"];
        const on = function (id) { const v = cs.value(id); return v === true || v === "on" || v === "true"; };
        const ticked = {};
        const kinds = KINDS.filter(function (k) { ticked[k] = on("findin-kind-" + k); return ticked[k]; });
        const term = String(cs.value("findin-term") || "").trim();
        if (term) kinds.push("term");
        if (!kinds.length) return { refuse: "screen.find-in.kindsfirst" };
        cs.set("kinds", ticked);
        cs.set("term", term);
        cs.set("question", String(cs.value("findin-question") || ""));
        // R38: a document's scope is its capture's fingerprint, read from its provenance; never its record id.
        const pv = view.data && view.data.capture && view.data.capture.state === "ok" ? view.data.capture.value : null;
        let pj = null;
        try { pj = JSON.parse(String((pv && pv["data/provenance.json"]) || "")); } catch { pj = null; }
        const fd = pj && Array.isArray(pj.documents) && pj.documents[0] && pj.documents[0].capture ? String(pj.documents[0].capture.sha256 || "") : "";
        const cap = /^[0-9a-f]{64}$/.test(fd) ? fd : s;
        const scope = s.indexOf("PROJ-") === 0 ? { project: s } : s.indexOf("sel-") === 0 ? { selection: s } : { capture: cap };
        let body = { scope: scope, kinds: kinds };
        if (kinds.indexOf("term") >= 0) body.term = term;
        // G16: "Show more" continues the same find from the cursor the last answer gave (its scope, kinds and term as first asked).
        const prior = (view.ui || {}).lastFind;
        if (el.dataset.cont && prior) body = Object.assign({}, prior, { cursor: el.dataset.cont });
        else cs.set("lastFind", body);
        cs.set("findCont", !!(el.dataset.cont && prior));
        return { body: body };
      },
      done: function (view, answer, cs) {
        const a = answer && Array.isArray(answer.kinds) ? answer : (answer && answer.result) || {};
        const kinds = Array.isArray(a.kinds) ? a.kinds : [];
        const had = (view.ui || {}).found;
        const read = typeof a.captures_read === "number" ? a.captures_read : 0;
        if ((view.ui || {}).findCont && had && Array.isArray(had.kinds)) {
          // The later pages add to each kind below what is drawn, so the results already drawn keep their places (the recording acts name them).
          const merged = had.kinds.map(function (k, i) {
            const more = kinds.filter(function (x) { return x && x.kind === k.kind; })[0] || {};
            return Object.assign({}, k, { items: (k.items || []).concat(more.items || []), count: (k.items || []).length + (more.items || []).length,
              truncated: !!(k.truncated || more.truncated), nothing: false, not_read: (k.not_read || []).concat(more.not_read || []) });
          });
          cs.set("found", Object.assign({}, had, { kinds: merged, read: (had.read || 0) + read, next: a.next || null }));
          return;
        }
        cs.set("found", { kinds: kinds, term: (view.ui || {}).term || "", scope: a.scope || null, read: read, next: a.next || null });
        cs.set("recorded", {});
      } },
    // Keep finding over the scope as documents arrive (answers R15's `find` form); the member's question, if chosen.
    { op: "standingquestionset", label: "act.standingquestionset.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const s = String(view.subject || "").split("/")[0];
        if (!s) return { refuse: "screen.find-in.scope.none" };
        const KINDS = ["people", "money", "dates", "requirements", "events"];
        const on = function (id) { const v = cs.value(id); return v === true || v === "on" || v === "true"; };
        const kinds = KINDS.filter(function (k) { return on("findin-kind-" + k); });
        const term = String(cs.value("findin-term") || "").trim();
        if (term) kinds.push("term");
        if (!kinds.length) return { refuse: "screen.find-in.kindsfirst" };
        const qid = String(cs.value("findin-question") || "");
        const hits = view.data.questions && view.data.questions.value && Array.isArray(view.data.questions.value.hits) ? view.data.questions.value.hits : [];
        const items = view.data.projectquestions && view.data.projectquestions.value && Array.isArray(view.data.projectquestions.value.items)
          ? view.data.projectquestions.value.items.map(function (x) { return { bundle_id: String(x.inquiry), title: x.title }; }) : [];
        const chosen = hits.concat(items).filter(function (h) { return String(h.bundle_id) === qid; })[0];
        // R38: as findin, the document's capture's fingerprint, never its record id.
        const pv = view.data && view.data.capture && view.data.capture.state === "ok" ? view.data.capture.value : null;
        let pj = null;
        try { pj = JSON.parse(String((pv && pv["data/provenance.json"]) || "")); } catch { pj = null; }
        const fd = pj && Array.isArray(pj.documents) && pj.documents[0] && pj.documents[0].capture ? String(pj.documents[0].capture.sha256 || "") : "";
        const cap = /^[0-9a-f]{64}$/.test(fd) ? fd : s;
        const scope = s.indexOf("PROJ-") === 0 ? { project: s } : s.indexOf("sel-") === 0 ? { selection: s } : { capture: cap };
        const find = { scope: scope, kinds: kinds };
        if (kinds.indexOf("term") >= 0) find.term = term;
        const ends = new Date(cs.now() + 365 * 86400000).toISOString().slice(0, 10);
        return { body: { question: chosen ? String(chosen.title || qid) : (term || kinds.join(", ")), find: find, cadence: "weekly", ends: ends } };
      },
      done: function (view, answer, cs) { cs.set("keeping", true); } },
    // R47, R48: the recording acts, each its form's body from the result's passage (`view.parts.forms`); the result it was drawn on
    // is kept for the acknowledgement `findin.recorded` (R48 (4)), and the passage keeps its acts and counts its facts.
    { op: "recordpersonfact", label: "act.recordpersonfact.label.find-in", rereads: [],
      refusals: { BAD_VALIDITY: "refusal.BAD_VALIDITY" },
      send: function (view, el, cs) {
        const k = ((view.ui || {}).found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        view.ui.pending = { k: el.dataset.k, i: el.dataset.i, op: "recordpersonfact", kind: String(cs.value(el.dataset.f + "-kind") || ""), value: String(cs.value(el.dataset.f + "-value") || it.words || "") };
        return view.parts.forms().body(cs, view, "recordpersonfact", el.dataset.f, it);
      },
      done: function (view, answer, cs) { cs.set("recorded", (function () {
        const p = view.ui.pending || {};
        const all = Object.assign({}, view.ui.recorded || {});
        const a = answer && answer.result && typeof answer.result === "object" ? answer.result : answer || {};
        const id = String(p.k) + "-" + String(p.i);
        const prev = all[id] ? all[id].n : 0;
        const name = String(a.name || a.person_name || "");
        const fact = cs.w("screen.find-in.recorded.fact", { kind: { html: cs.w("screen.person.kind." + (p.kind || "other")) }, name: name, value: p.value || "" });
        const target = a.person || a.entity || "";
        const link = target ? cs.ref("person", String(target), cs.w("screen.person.name"), []) : cs.w("screen.person.name");
        all[id] = { n: prev + 1, html: cs.w("findin.recorded", { fact: { html: fact }, screen: { html: link } }) };
        return all;
      })()); } },
    { op: "recorddatedfact", label: "act.recorddatedfact.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const k = ((view.ui || {}).found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        view.ui.pending = { k: el.dataset.k, i: el.dataset.i, op: "recorddatedfact", value: String(cs.value(el.dataset.f + "-value") || it.date || it.value || "") };
        return view.parts.forms().body(cs, view, "recorddatedfact", el.dataset.f, it);
      },
      done: function (view, answer, cs) { cs.set("recorded", (function () {
        const p = view.ui.pending || {};
        const all = Object.assign({}, view.ui.recorded || {});
        const id = String(p.k) + "-" + String(p.i);
        const prev = all[id] ? all[id].n : 0;
        all[id] = { n: prev + 1, html: cs.w("findin.recorded", { fact: p.value || "", screen: { html: '<a class="cs-ref" data-nav href="/app/timeline">' + cs.w("screen.timeline.name") + "</a>" } }) };
        return all;
      })()); } },
    // The member's own words why the group holds the city to it are the act's reason (interface-shell R11, K3002).
    { op: "standarddeclare", label: "act.standarddeclare.label.find-in", rereads: [], reasonField: "reason",
      send: function (view, el, cs) {
        const k = ((view.ui || {}).found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        view.ui.pending = { k: el.dataset.k, i: el.dataset.i, op: "standarddeclare", value: String(cs.value(el.dataset.f + "-cite") || "") };
        return view.parts.forms().body(cs, view, "standarddeclare", el.dataset.f, it);
      },
      done: function (view, answer, cs) { cs.set("recorded", (function () {
        const p = view.ui.pending || {};
        const all = Object.assign({}, view.ui.recorded || {});
        const a = answer && answer.result && typeof answer.result === "object" ? answer.result : answer || {};
        const id = String(p.k) + "-" + String(p.i);
        const prev = all[id] ? all[id].n : 0;
        const target = a.standard || a.id || "";
        all[id] = { n: prev + 1, html: cs.w("findin.recorded", { fact: p.value || "", screen: { html: target ? cs.ref("standard", String(target), cs.w("screen.standard.name"), []) : cs.w("screen.standard.name") } }) };
        return all;
      })()); } },
    { op: "recordfact", label: "act.recordfact.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const k = ((view.ui || {}).found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        view.ui.pending = { k: el.dataset.k, i: el.dataset.i, op: "recordfact", value: String(cs.value(el.dataset.f + "-amount") || it.amount || "") };
        return view.parts.forms().body(cs, view, "recordfact", el.dataset.f, it);
      },
      done: function (view, answer, cs) { cs.set("recorded", (function () {
        const p = view.ui.pending || {};
        const all = Object.assign({}, view.ui.recorded || {});
        const a = answer && answer.result && typeof answer.result === "object" ? answer.result : answer || {};
        const id = String(p.k) + "-" + String(p.i);
        const prev = all[id] ? all[id].n : 0;
        const target = a.fact || a.id || "";
        all[id] = { n: prev + 1, html: cs.w("findin.recorded", { fact: p.value || "", screen: { html: target ? cs.ref("money", String(target), cs.w("screen.money.name"), []) : cs.w("screen.money.name") } }) };
        return all;
      })()); } },
    { op: "tabledeclare", label: "act.tabledeclare.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const k = ((view.ui || {}).found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        view.ui.pending = { k: el.dataset.k, i: el.dataset.i, op: "tabledeclare", value: String(cs.value(el.dataset.f + "-header") || "") };
        return view.parts.forms().body(cs, view, "tabledeclare", el.dataset.f, it);
      },
      done: function (view, answer, cs) { cs.set("recorded", (function () {
        const p = view.ui.pending || {};
        const all = Object.assign({}, view.ui.recorded || {});
        const id = String(p.k) + "-" + String(p.i);
        const prev = all[id] ? all[id].n : 0;
        all[id] = { n: prev + 1, html: cs.w("findin.recorded", { fact: p.value || "", screen: { html: cs.w("screen.find-in.name") } }) };
        return all;
      })()); } },
    // Cites the passage in the chosen question (citation's `found` form; every argument in the query).
    { op: "cite", label: "act.cite.label.find-in", rereads: [],
      send: function (view, el, cs) {
        const ui = view.ui || {};
        const k = (ui.found || {}).kinds[Number(el.dataset.k)];
        const it = k && k.items[Number(el.dataset.i)];
        if (!it) return null;
        if (!ui.question) return { refuse: "screen.find-in.questionfirst" };
        // R24: refused in place until a role is chosen; the question is the citing object (`citation` R1: a role is a question's),
        // and the one the passage was looked for. "against" is sent as the question's role `cuts_against` (K3550).
        const chosen = cs.value(el.dataset.f + "-role");
        const role = Array.isArray(chosen) && chosen.length === 1 && (chosen[0] === "supports" || chosen[0] === "against")
          ? (chosen[0] === "against" ? "cuts_against" : "supports") : "";
        if (!role) return { refuse: "screen.findin.cite.norole" };
        return { query: { project: ui.question, question: ui.question, found: JSON.stringify(it), role: role }, body: {} };
      } },
    // "See all in Find": the term searched in Find.
    { op: "search", label: "act.search.label.find-in", rereads: [],
      send: function (view, el) { return el.dataset.term ? { query: { q: el.dataset.term } } : null; },
      done: function (view, answer, cs) { cs.go("finder", String((view.ui || {}).term || "")); } },
  ],
});
