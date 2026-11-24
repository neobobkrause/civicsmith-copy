/* Find (registry screen `finder`; screens-daily R4, R7, R12, R21, R43 to R46, R54 to R57). Search with the member's words; each result
   with its grade and where it matched; hold picked results together (retrieval's selection, a handle that lives while it is used), let
   the set go, open "Find in these" over it, cite the whole held set (R57), see where nobody looked, and count over the held set. The
   words searched are the route's subject (`/app/finder/<words>`) or the member's last search on this page. With words the three routes
   are read apart and counted apart, under a scope, with what the search covered (R56); with none Find is the browse (R44, R54): the
   choices "Show", "Only", "Show as" and "Theme" are choices that redraw and send nothing, and the whole record is one sortable table
   (R55). A search that finds nothing says what search covers and offers "Capture it" (R12). Every function is self-contained
   (interface-shell R21 (1)); the state parts it draws are `view.parts.finderStates`. */
import { finderStates } from "./finder-states.mjs";

export const finder = Object.freeze({
  id: "finder",
  parts: { finderStates },

  reads: function (view) {
    const ui = view.ui || {};
    // The words searched are the member's last search on this page, else the route's subject; a subject opening with `~` is
    // the browse's filters (R44), not words.
    const subject = view.subject ? String(view.subject) : "";
    const q = typeof ui.q === "string" ? ui.q : (subject.charAt(0) === "~" ? "" : subject);
    const out = {};
    if (q.trim()) {
      // R56: the scopes `searchfields` answers (retrieval R87); the three routes are read in the screen (`render`), each apart.
      out.scopes = { op: "searchfields" };
    } else {
      // R44: with no words, the browse; the member's last look (`lookedat`, which moves nothing) is what "new" counts from, and
      // the team's themes fill the Theme choice (R43). The browse itself is called from `render` once `since` is known.
      out.lookedat = { op: "lookedat" };
      out.themes = { op: "themeread", empty: function (v) { return !v || !Array.isArray(v.themes) || v.themes.length === 0; } };
      // R54, R93: the browse is a list that re-reads itself; its choices (page memory, `choice:<id>`) and the member's last look fix its request.
      // A "new" browse waits for that look, and is read in `render` until then.
      const KINDS = ["all", "document", "question", "action", "entity", "plan"];
      const ONLY = ["any", "new_since", "watched", "flagged"];
      const parts = subject.charAt(0) === "~" ? subject.slice(1).split("~") : [];
      const chosen = function (id, list, seed) { const v = ui["choice:" + id]; return list.indexOf(v) >= 0 ? v : seed; };
      const lk = view.data && view.data.lookedat && view.data.lookedat.state === "ok" ? view.data.lookedat.value : null;
      const since = lk && typeof lk.since === "string" ? lk.since : null;
      const asTable = chosen("finder-view", ["list", "table"], "list") === "table";
      const kind = asTable ? "all" : chosen("finder-kind", KINDS, KINDS.indexOf(parts[0]) >= 0 ? parts[0] : "all");
      const only = asTable ? "any" : chosen("finder-state", ONLY, ONLY.indexOf(parts[1]) >= 0 ? parts[1] : "any");
      if (only !== "new_since" || since) {
        const query = { limit: "50" };
        if (!asTable) {
          if (kind !== "all") query.kinds = kind;
          if (only !== "any") query.only = only;
          if (only === "new_since") query.since = since;
        }
        out.browse = { op: "browse", query: query, refresh: true, empty: function () { return false; } };
      }
    }
    if (ui.handle) out.selection = { op: "selection", query: { handle: String(ui.handle) } };
    // R67: "See where nobody looked" reads the frontier at each of its four levels; a level's answer is never "empty" (it states what was looked at).
    if (ui.frontier) {
      ["document", "content", "meaning", "internet"].forEach(function (level) {
        out["frontier_" + level] = { op: "frontier", query: { level: level }, empty: function () { return false; } };
      });
    }
    return out;
  },

  render: function (cs, view) {
    const ui = view.ui || {};
    const subject = view.subject ? String(view.subject) : "";
    const q = typeof ui.q === "string" ? ui.q : (subject.charAt(0) === "~" ? "" : subject);
    const ok = function (r) { return r && r.state === "ok" ? r.value : null; };
    const st = view.parts.finderStates();
    // The screen each kind of thing opens, by what the hit or browse row says it is.
    const SCREEN_OF = { information: "document", document: "document", inquiry: "question", question: "question", project: "project",
      action: "action", action_plan: "plan", plan: "plan", person: "person", organization: "person" };
    const screenOf = function (type, id) {
      const t = SCREEN_OF[String(type || "").toLowerCase()];
      if (t) return t;
      return /^PROJ-/.test(id) ? "project" : /^INQ-/.test(id) ? "question" : "document";
    };
    const head = cs.title(undefined, {}) + '<p class="mk-sub">' + cs.w("screen.finder.sub") + "</p>";
    const browsing = !q.trim();
    // R54: the words field carries the kit's placeholder and its help beneath (the label stays the words), not the placeholder as help.
    // C23: the field takes the page's width with its button below it (a flex row would leave the field its content's width).
    const box = "<div>" + cs.field("finder-q", "screen.finder.words", { value: q, placeholder: "find.query.placeholder", help: "find.query.help" })
      + '<span class="mk-acts">' + cs.act("search", { label: "act.search.label.finder", tone: "primary" }) + "</span></div>";

    // R54: "Show", "Only", "Show as" and "Theme" are choices that redraw and send nothing; their values are page memory (`choice:<id>`);
    // the route's `~kind~only` seeds the first values, so a link to `/app/finder/~document~new_since` still opens that browse.
    const KINDS = ["all", "document", "question", "action", "entity", "plan"];
    const ONLY = ["any", "new_since", "watched", "flagged"];
    const ONLY_KEY = { any: "find.state.any", new_since: "find.state.new", watched: "find.state.watched", flagged: "find.state.secondlook" };
    const parts = subject.charAt(0) === "~" ? subject.slice(1).split("~") : [];
    const chosen = function (id, list, seed) { const v = ui["choice:" + id]; return list.indexOf(v) >= 0 ? v : seed; };
    const lk = view.data.lookedat;
    const since = ok(lk) && typeof ok(lk).since === "string" ? ok(lk).since : null;
    const asTable = chosen("finder-view", ["list", "table"], "list") === "table";
    const kind = asTable ? "all" : chosen("finder-kind", KINDS, KINDS.indexOf(parts[0]) >= 0 ? parts[0] : "all");
    const only = asTable ? "any" : chosen("finder-state", ONLY, ONLY.indexOf(parts[1]) >= 0 ? parts[1] : "any");
    const themes = ok(view.data.themes);
    const themeList = themes && Array.isArray(themes.themes) ? themes.themes : [];
    const themeId = asTable ? "" : String(ui["choice:finder-theme"] || "");
    const onlyList = ONLY.filter(function (o) { return o !== "new_since" || since || o === only; });
    // C23: each help line sits with the control it explains: Show as's, Only's (what "new" counts from, or why there is no "new") and Theme's.
    const note = function (html) { return '<p class="mk-small muted">' + html + "</p>"; };
    const cell = function (control, help) { return help ? "<div>" + control + help + "</div>" : control; };
    const onlyHelp = asTable ? "" : lk && lk.state === "ok" && !since ? note("<b>" + cs.w("find.browse.nosince.summary") + "</b> " + cs.w("find.browse.nosince"))
      : since ? note(cs.w("find.browse.new.means")) : "";
    const filters = !browsing ? "" : '<div class="mk-grid2">'
      + (asTable ? "" : cs.choice("finder-kind", "find.kind.label", KINDS.map(function (k) { return [k, "find.kind." + k]; }), { value: kind, redraw: "choice:finder-kind" })
        + cell(cs.choice("finder-state", "find.state.label", onlyList.map(function (o) { return [o, ONLY_KEY[o]]; }), { value: only, redraw: "choice:finder-state" }), onlyHelp))
      + cell(cs.choice("finder-view", "screen.finder.showas", [["list", "screen.finder.showas.list"], ["table", "screen.finder.showas.table"]], { value: "list", redraw: "choice:finder-view" }), note(cs.w("screen.finder.table.view.help")))
      + (!asTable && themeList.length ? cell(cs.choice("finder-theme", "theme.filter", [["", "theme.filter.any"]].concat(themeList.map(function (t) {
          return { value: String(t.theme_id), text: String(t.name || t.theme_id) };
        })), { value: "", redraw: "choice:finder-theme" }), note(cs.w("theme.filter.help"))) : "")
      + "</div>";

    // R44, R55: the browse's pages, read once per (view, kind, only, since) and kept in the screen's page memory: "Show more" adds the next.
    const key = (asTable ? "table" : kind + "|" + only) + "|" + (only === "new_since" ? since : "");
    const base = function () {
      const query = { limit: "50" };
      if (!asTable) {
        if (kind !== "all") query.kinds = kind;
        if (only !== "any") query.only = only;
        if (only === "new_since" && since) query.since = since;
      }
      return query;
    };
    const getBrowse = function (query, merge) {
      return cs.call("browse", { query: query }).then(function (a) {
        const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
        if (!v || v.ok === false || !Array.isArray(v.items)) return { state: "failed", key: key };
        return { state: "ok", key: key, since: since, base: base(), items: (merge ? merge.items : []).concat(v.items), next: v.truncated && v.next ? String(v.next) : null,
          truncated: !!v.truncated, undetermined: v.undetermined || (merge && merge.undetermined) || null,
          total: merge && typeof merge.total === "number" ? merge.total : (typeof v.total === "number" ? v.total : null),
          awaiting: merge && typeof merge.awaiting === "number" ? merge.awaiting : (typeof v.awaiting_review === "number" ? v.awaiting_review : null) };
      }, function () { return { state: "failed", key: key }; });
    };
    // The first page: the shell's read of `browse` (a list that re-reads itself, R93) when the request was fixed at load, else read here (a
    // "new" browse opened by its link waits for the member's last look, and so does one reached from a search or a theme).
    const feed = view.data.browse;
    let browse = null;
    if (browsing && !themeId && feed && feed.state !== "empty") {
      const v = ok(feed);
      browse = feed.state === "loading" ? { state: "loading", key: key }
        : v && Array.isArray(v.items) ? { state: "ok", key: key, since: since, base: base(), items: v.items.slice(), next: v.truncated && v.next ? String(v.next) : null,
          truncated: !!v.truncated, undetermined: v.undetermined || null, total: typeof v.total === "number" ? v.total : null,
          awaiting: typeof v.awaiting_review === "number" ? v.awaiting_review : null }
        : { state: "failed", key: key };
    } else {
      let page = ui.page1 && typeof ui.page1 === "object" && ui.page1.key === key ? ui.page1 : null;
      if (browsing && !themeId && !page && Object.keys(view.data).length && (only !== "new_since" || (lk && lk.state !== "loading"))) {
        if (only === "new_since" && !since) {
          page = { state: "failed", key: key };
        } else {
          ui.page1 = page = { state: "loading", key: key };
          getBrowse(base(), null).then(function (r) { cs.set("page1", r); });
        }
      }
      browse = page ? Object.assign({}, page) : null;
    }
    // "Show more": the pages after the first, kept by the request they follow.
    const more = ui.more && typeof ui.more === "object" && ui.more.key === key ? ui.more : null;
    if (browse && browse.state === "ok" && more) {
      browse.items = browse.items.concat(more.items);
      browse.next = more.next;
      browse.truncated = more.truncated;
    }
    ui.browse = browse;
    // R43, R54: a theme chosen is read at once, what was placed in it and its hunches apart; kept by the theme chosen.
    let theme = ui.themeRead && ui.themeRead.id === themeId ? ui.themeRead : null;
    if (browsing && themeId && !theme) {
      ui.themeRead = theme = { id: themeId, state: "loading", value: null };
      cs.call("themeread", { query: { id: themeId } }).then(function (a) {
        const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
        cs.set("themeRead", !v || v.ok === false ? { id: themeId, state: "failed", value: null } : { id: themeId, state: "ok", value: v });
      }, function () { cs.set("themeRead", { id: themeId, state: "failed", value: null }); });
    }

    const pickBox = function (id, title) {
      // R92: the kit's pick class, so the phone rule makes the box a 44 px target (06 §19 (d)).
      return '<input type="checkbox" class="mk-pick" id="finder-pick-' + cs.esc(id) + '" aria-label="' + cs.w("screen.finder.pick", { title: title }) + '">';
    };
    const mark = function (it) {
      const bits = [];
      if (it.new === true) bits.push(cs.w("find.row.new"));
      if (it.watched === true) bits.push(cs.w("find.row.watched"));
      if (it.flagged && typeof it.flagged === "object") {
        bits.push(cs.w("find.row.secondlook", { who: String(it.flagged.by || ""), date: { html: cs.date(String(it.flagged.at || "")) }, note: String(it.flagged.note || "") }));
      }
      return bits;
    };
    const kindWord = function (it, sc) {
      return cs.w("find.row.kind." + (it.kind === "organization" || it.kind === "person" ? it.kind : sc === "question" ? "question" : sc === "action" ? "action" : sc === "plan" ? "plan" : "document"));
    };
    let results = "";
    if (browsing && themeId) {
      // R43: with a theme chosen, what was placed in it, then its hunches apart; a hunch is never drawn as membership.
      // R26: each document by its title, never its id. The placement view answers the document's id and no title (`connections` R44), so the
      // titles of the documents it names are asked for once (`search` over `id:` terms, as R89's frontier does), kept in the screen's page
      // memory under the ids asked and drawn on arrival; a document no title is read for is the plain word.
      const docOf = function (p) {
        if (p && typeof p.document === "string" && p.document) return p.document;
        return p && p.target && p.target_kind !== "content" && p.target_kind !== "passage" && !/^CNT-/.test(String(p.target)) ? String(p.target) : "";
      };
      const named = function (p) { return p && typeof p.title === "string" && p.title.trim() ? p.title : ""; };
      const placements = function (v) { return (Array.isArray(v.members) ? v.members : []).concat(Array.isArray(v.hunches) ? v.hunches : []); };
      const titleOf = function (p) {
        const own = named(p);
        if (own) return own;
        const id = docOf(p);
        return id && ui.themeTitles && ui.themeTitles.map[id] ? ui.themeTitles.map[id] : "";
      };
      const row = function (p) {
        const id = String(p.target || "");
        const passage = p.target_kind === "content" || p.target_kind === "passage" || /^CNT-/.test(id);
        return cs.row("", cs.ref(screenOf(p.target_kind, id), id, titleOf(p) || cs.w(passage ? "shell.card.passage" : "shell.card.document"), []), "", "");
      };
      results = cs.state(theme && theme.state === "ok" ? { state: "ok", value: theme.value } : theme && theme.state === "failed" ? { state: "failed", refusal: null } : { state: "loading" }, function (v) {
        const members = Array.isArray(v.members) ? v.members : [];
        const hunches = Array.isArray(v.hunches) ? v.hunches : [];
        const wanted = [];
        placements(v).forEach(function (p) { const id = docOf(p); if (id && !named(p) && wanted.indexOf(id) < 0) wanted.push(id); });
        const key = themeId + "|" + wanted.slice().sort().join(" ");
        if (wanted.length && (!ui.themeTitles || ui.themeTitles.key !== key)) {
          ui.themeTitles = { key: key, map: {} };
          cs.call("search", { query: { q: wanted.map(function (id) { return "id:" + id; }).join(" OR "), limit: String(wanted.length) } }).then(function (a) {
            const b = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
            const map = {};
            (b && b.ok !== false && Array.isArray(b.hits) ? b.hits : []).forEach(function (h) { if (h && h.bundle_id && h.title) map[String(h.bundle_id)] = String(h.title); });
            cs.set("themeTitles", { key: key, map: map });
          }, function () { cs.set("themeTitles", { key: key, map: {} }); });
        }
        return (members.length ? cs.sec("theme.placed", cs.sheet(members.map(row).join(""))) : "")
          + (hunches.length ? cs.sec("theme.hunches", '<p class="mk-small muted">' + cs.w("theme.hunch.note") + "</p>" + cs.sheet(hunches.map(row).join(""))) : "");
      }, { empty: "state.empty" }) || "";
    } else if (browsing) {
      if (!browse || browse.state === "loading") results = cs.state({ state: "loading" }, null);
      else if (browse.state === "failed") results = cs.state({ state: "failed", refusal: null }, null);
      else if (asTable) results = st.table(cs, ui, browse, screenOf, kindWord, pickBox);
      else {
        const items = browse.items || [];
        const unread = browse.undetermined && typeof browse.undetermined === "object";
        // C23: how many the filter holds (`total`, which follows "Show" and "Only"), not the page's rows; none at zero or unanswered.
        const held = typeof browse.total === "number" && browse.total > 0
          ? '<p class="mk-small"><b>' + (browse.total === 1 ? cs.w("screen.finder.table.count.one", { m: String(browse.awaiting || 0) }) : cs.w("screen.finder.table.count.other", { n: String(browse.total), m: String(browse.awaiting || 0) })) + "</b></p>" : "";
        // C23: an empty list under a filter names the filter that found nothing.
        const named = (kind !== "all" ? [cs.w("find.kind." + kind)] : []).concat(only !== "any" ? [cs.w(ONLY_KEY[only])] : []);
        const nothing = named.length ? '<p class="cs-state" data-state="empty">' + named.join(" · ") + ": " + cs.w("state.empty") + "</p>" : cs.state({ state: "empty" }, null);
        results = held + (items.length ? cs.sheet(items.map(function (it) {
          const id = String(it.id);
          const title = String(it.title || "");
          const sc = screenOf(it.kind, id);
          const bits = mark(it);
          const acts = (it.watched === true ? cs.act("watchitem", { label: "find.row.unwatch", data: { item: id, off: "1" } }) : "")
            + (it.flagged ? cs.act("secondlookclear", { label: "act.secondlookclear.label.finder", data: { item: id } }) : "");
          return cs.row(pickBox(id, title), cs.ref(sc, id, title, []) + '<span class="meta"><span>' + kindWord(it, sc) + "</span>"
            + (bits.length ? " · " + bits.join(" · ") : "") + (unread ? ' · <span class="muted">' + cs.w("state.undetermined", { reason: String(browse.undetermined.why || "") }) + "</span>" : "") + "</span>", acts, "");
        }).join("")) : nothing)
          + (browse.truncated && browse.next ? '<p class="mk-note">' + cs.w("find.browse.more") + '</p><span class="mk-acts">'
            + cs.act("search", { label: "find.browse.showmore", data: { more: String(browse.next) } }) + "</span>" : "");
      }
    } else {
      // R56: with words, the three routes read apart (once per words and scope), each counted apart, with what the search covered.
      results = st.routes(cs, view, q, screenOf, pickBox);
    }

    const nobody = (ui.frontier ? st.frontier(cs, view) : "")
      + '<span class="mk-acts">' + cs.act("frontier", { label: "act.frontier.label.finder" }) + "</span>";

    // The hold strip (interface-shell R19's): how many are held together and until when, from `selection`; R45's Watch and
    // Flag for what is picked; R57's cite. Drawn only with results to pick or a set held (R21: no empty hold tray).
    const sel = view.data.selection;
    const hitsOf = st.hits(view);
    const rows = hitsOf.length || (browsing && !themeId && browse && browse.state === "ok" && (browse.items || []).length);
    // R57: the cite state replaces the results while the held set is being cited; the strip stays, so the set can be let go.
    if (ui.cite && ui.handle) results = st.cite(cs, view, sel);
    const strip = !rows && !ui.handle ? "" : '<div class="cs-hold mk-hold">'
      + (ui.handle && sel ? cs.state("selection", function (v) {
        const n = typeof v.n === "number" ? v.n : (v.members || []).length;
        return '<span class="n">' + (n === 1 ? cs.w("screen.finder.held.one") : cs.w("screen.finder.held.many", { n: String(n) })) + "</span>"
          + (function () {
            // The handle lives five minutes past its last use (retrieval R18, R19): the time of day it lapses.
            const t = v.expires ? new Date(v.expires) : null;
            if (!t || isNaN(t.getTime())) return "";
            const hm = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
            return ' · <span class="drift">' + cs.w("screen.finder.until", { time: hm }) + "</span>";
          })();
      }) : "")
      + '<span class="acts">' + (rows ? cs.act("select", { label: "act.select.label.finder" }) : "")
      + (rows ? cs.act("watchitem", { label: "act.owed_watchitem.label.finder" }) : "")
      + (rows ? (function () {
        const button = cs.act("secondlook", { label: "act.owed_secondlook.label.finder" });
        return button ? '<details class="mk-details"><summary>' + cs.w("act.owed_secondlook.label.finder") + "</summary>"
          + cs.field("finder-note", "find.secondlook.note", { help: "find.secondlook.note.help" }) + button + "</details>" : "";
      })() : "")
      + (ui.handle ? cs.act("findin", { label: "act.findin.label.finder", data: { handle: String(ui.handle) } })
        + cs.act("cite", { label: "act.cite.label.finder", data: { handle: String(ui.handle) } })
        + (function () {
          // "Count" asks what is counted and over which period, in place, with the act (read by its `send`).
          const button = cs.act("calculationcreate", { label: "act.calculationcreate.label.finder", data: { handle: String(ui.handle), f: "fc" } });
          return button ? '<details class="mk-details"><summary>' + cs.w("act.calculationcreate.label.finder") + "</summary>"
            + cs.field("fc-question", "screen.finder.count.question", {}) + cs.field("fc-from", "screen.finder.count.from", {})
            + cs.field("fc-to", "screen.finder.count.to", {}) + button + "</details>" : "";
        })()
        + cs.act("selectionrelease", { label: "act.selectionrelease.label.finder", data: { handle: String(ui.handle) } }) : "")
      + "</span></div>";
    const counted = ui.counted ? '<p class="mk-note">' + cs.w("screen.finder.counted", { result: String(ui.counted) }) + "</p>" : "";
    const says = browsing ? '<p class="mk-small muted">' + cs.w("find.browse.says") + "</p>" : "";
    const fresh = browsing && browse && browse.state === "ok" && typeof cs.fresh === "function" ? cs.fresh() : "";

    return head + box + says + filters + fresh + results + strip + counted + (browsing ? "" : st.covered(cs, view, nobody)) + (browsing ? nobody : "");
  },

  acts: [
    { op: "search", label: "act.search.label.finder", rereads: [],
      send: function (view, el, cs) {
        const ui = view.ui || {};
        // G16: "Show more" on one of the three routes of a search asks that route's next page by its own cursor.
        if (el.dataset.route) return view.parts.finderStates().more(view, el.dataset.route, cs);
        // R44: "Show more" asks the browse's next page (`after` its `next`) and adds it below.
        if (el.dataset.more) {
          const b = ui.browse;
          if (!b || b.state !== "ok") return null;
          const query = Object.assign({}, b.base || { limit: "50" }, { after: el.dataset.more });
          return cs.call("browse", { query: query }).then(function (a) {
            const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
            if (v && v.ok !== false && Array.isArray(v.items)) {
              const had = ui.more && ui.more.key === b.key ? ui.more.items : [];
              cs.set("more", { key: b.key, items: had.concat(v.items), next: v.truncated && v.next ? String(v.next) : null, truncated: !!v.truncated });
              return null;
            }
            return { refuse: "state.failed", fills: { reason: "" } };
          });
        }
        // F-B10 (a): "Search" under the partial-match heading asks the same words joined by OR (the F-B9 route that reads both fields and passages).
        if (el.dataset.widen) { cs.set("routes", null); cs.set("q", el.dataset.widen); return null; }
        const q = String(cs.value("finder-q") || "").trim();
        // R44: with no words the browse; leaving the words empty returns to it.
        if (!q) { cs.set("q", ""); return null; }
        // R56: a new search reads its three routes again; nothing is sent by the act itself.
        cs.set("routes", null);
        cs.set("q", q);
        return null;
      } },
    // Holds the picked results together: an enumerated selection over their ids (retrieval R18). The title of each is kept for R57.
    { op: "select", label: "act.select.label.finder", rereads: ["selection"],
      send: function (view, el, cs) {
        const ui = view.ui || {};
        const hits = view.parts.finderStates().hits(view);
        const b = ui.browse;
        const list = hits.length ? hits.map(function (h) { return { id: String(h.bundle_id), title: String(h.title || "") }; })
          : b && b.state === "ok" && Array.isArray(b.items) ? b.items.filter(function (x) { return x.kind === "document"; }).map(function (x) { return { id: String(x.id), title: String(x.title || "") }; }) : [];
        const picked = list.filter(function (h) {
          const v = cs.value("finder-pick-" + h.id);
          return v === true || v === "on" || v === "true";
        });
        if (!picked.length) return { refuse: "screen.finder.pickfirst" };
        const titles = Object.assign({}, ui.titles || {});
        picked.forEach(function (h) { if (h.title) titles[h.id] = h.title; });
        ui.titles = titles;
        const q = typeof ui.q === "string" ? ui.q : (String(view.subject || "").charAt(0) === "~" ? "" : String(view.subject || ""));
        return { query: { kind: "enumerated", q: q }, body: { ids: picked.map(function (h) { return h.id; }) } };
      },
      done: function (view, answer, cs) {
        const a = answer && answer.handle ? answer : (answer && answer.result) || {};
        if (a.handle) cs.set("handle", a.handle);
      } },
    { op: "selectionrelease", label: "act.selectionrelease.label.finder", rereads: [],
      send: function (view, el) { return { query: { handle: el.dataset.handle } }; },
      done: function (view, answer, cs) { cs.set("handle", null); cs.set("cite", false); } },
    // "Find in these" opens `find-in` over the held set; it sends nothing itself (find-in's own act asks).
    { op: "findin", label: "act.findin.label.finder", rereads: [],
      send: function (view, el, cs) {
        if (!el.dataset.handle) return { refuse: "screen.finder.holdfirst" };
        cs.go("find-in", el.dataset.handle);
        return null;
      } },
    // R57: "Cite these together" opens the cite state over the held set; the citing itself is the state's own act.
    { op: "cite", label: "act.cite.label.finder", rereads: ["selection"],
      send: function (view, el, cs) {
        if (!el.dataset.handle) return { refuse: "screen.finder.holdfirst" };
        if (el.dataset.cite) return view.parts.finderStates().citeSend(view, el, cs);
        cs.set("citeDone", null);
        const held = view.data.selection;
        cs.set("citeHeld", held && held.state === "ok" && held.value && Array.isArray(held.value.members) ? held.value.members.map(String) : null);
        cs.set("cite", true);
        return null;
      },
      done: function (view, answer, cs) {
        const a = answer && (answer.cited || answer.alreadyCited) ? answer : (answer && answer.result) || {};
        const chosen = cs.value("finder-cite-role");
        cs.set("citeDone", { role: Array.isArray(chosen) && chosen[0] === "against" ? "cuts_against" : "supports", cited: Array.isArray(a.cited) ? a.cited : [], alreadyCited: Array.isArray(a.alreadyCited) ? a.alreadyCited : [] });
      } },
    { op: "frontier", label: "act.frontier.label.finder", rereads: ["frontier_document", "frontier_content", "frontier_meaning", "frontier_internet"],
      send: function (view, el, cs) { cs.set("frontier", true); return { query: { level: "document" } }; } },
    // "Count": a count over the held set, as a calculation with its method shown (calculations R4).
    { op: "calculationcreate", label: "act.calculationcreate.label.finder", rereads: [],
      send: function (view, el, cs) {
        const f = { question: cs.value("fc-question"), from: cs.value("fc-from"), to: cs.value("fc-to") };
        if (!el.dataset.handle) return { refuse: "screen.finder.holdfirst" };
        return {
          body: {
            question: String(f.question || "").trim(),
            period: { from: String(f.from || "").trim(), to: String(f.to || "").trim() },
            kind: "count",
            inputs: [{ name: "held", set: el.dataset.handle }],
          },
        };
      },
      done: function (view, answer, cs) {
        const a = answer && answer.calc_id ? answer : (answer && answer.result) || {};
        // calculations R4: the value `create` answers is `results.output` (`result_key` is the result's hash, never a key of `results`).
        const out = a.results && typeof a.results === "object" ? a.results.output : undefined;
        const r = out !== null && typeof out === "object" ? (out.value !== undefined ? out.value : out.count) : out;
        cs.set("counted", r !== undefined && r !== null && typeof r !== "object" ? String(r) : String(a.calc_id || ""));
      } },
    // R43: the Theme choice is read where it is chosen (R54: at once, no second press); the act stays registered on Find.
    { op: "themeread", label: "act.themeread.label.finder", rereads: ["themes"],
      send: function (view) { return { query: {} }; } },
    // R45: Watch, for what is picked, one `watchitem` for each picked item in order; one row's "Take off my watch list" is the
    // same act with `on: false`. A refusal stops the rest and is drawn.
    { op: "watchitem", label: "act.owed_watchitem.label.finder", rereads: ["browse"],
      refusals: { MARK_NO_ITEM: "refusal.MARK_NO_ITEM", MARK_NO_SUCH_ITEM: "refusal.MARK_NO_SUCH_ITEM", MACHINE_CANNOT_MARK: "refusal.MACHINE_CANNOT_MARK" },
      send: function (view, el, cs) {
        if (el.dataset.item) return { body: { item: el.dataset.item, on: el.dataset.off ? false : true } };
        const ui = view.ui || {};
        const hits = view.parts.finderStates().hits(view);
        const list = hits.length ? hits.map(function (h) { return String(h.bundle_id); })
          : ui.browse && ui.browse.state === "ok" ? (ui.browse.items || []).map(function (x) { return String(x.id); }) : [];
        const ids = list.filter(function (id) { const v = cs.value("finder-pick-" + id); return v === true || v === "on" || v === "true"; });
        if (!ids.length) return { refuse: "screen.finder.pickfirst" };
        const rest = ids.slice(0, -1);
        const run = function (i) {
          if (i >= rest.length) return Promise.resolve({ body: { item: ids[ids.length - 1], on: true } });
          return cs.call("watchitem", { body: { item: rest[i], on: true } }).then(function (a) {
            const r = a && typeof a === "object" && a.result && typeof a.result === "object" && a.ok !== false ? a.result : a;
            if (r && r.ok === false) return { refuse: "refusal." + String(r.code || r.reason || "MARK_NO_SUCH_ITEM") };
            return run(i + 1);
          });
        };
        return run(0);
      },
      done: function (view, answer, cs) { cs.set("page1", null); cs.set("more", null); } },
    // R45: Flag for a second look…, one note for each picked item (the first refusal stops the rest and is drawn).
    { op: "secondlook", label: "act.owed_secondlook.label.finder", rereads: ["browse"],
      refusals: { MARK_NO_ITEM: "refusal.MARK_NO_ITEM", MARK_NO_SUCH_ITEM: "refusal.MARK_NO_SUCH_ITEM", MACHINE_CANNOT_MARK: "refusal.MACHINE_CANNOT_MARK",
        SECOND_LOOK_NO_NOTE: "refusal.SECOND_LOOK_NO_NOTE", SECOND_LOOK_NOT_OPEN: "refusal.SECOND_LOOK_NOT_OPEN" },
      send: function (view, el, cs) {
        const note = String(cs.value("finder-note") || "").trim();
        if (!note || note.length > 500 || /[\r\n]/.test(note)) return { refuse: "refusal.SECOND_LOOK_NO_NOTE" };
        const ui = view.ui || {};
        const hits = view.parts.finderStates().hits(view);
        const list = hits.length ? hits.map(function (h) { return String(h.bundle_id); })
          : ui.browse && ui.browse.state === "ok" ? (ui.browse.items || []).map(function (x) { return String(x.id); }) : [];
        const ids = list.filter(function (id) { const v = cs.value("finder-pick-" + id); return v === true || v === "on" || v === "true"; });
        if (!ids.length) return { refuse: "screen.finder.pickfirst" };
        const rest = ids.slice(0, -1);
        const run = function (i) {
          if (i >= rest.length) return Promise.resolve({ body: { item: ids[ids.length - 1], note: note } });
          return cs.call("secondlook", { body: { item: rest[i], note: note } }).then(function (a) {
            const r = a && typeof a === "object" && a.result && typeof a.result === "object" && a.ok !== false ? a.result : a;
            if (r && r.ok === false) return { refuse: "refusal." + String(r.code || r.reason || "MARK_NO_SUCH_ITEM") };
            return run(i + 1);
          });
        };
        return run(0);
      },
      done: function (view, answer, cs) { cs.set("page1", null); cs.set("more", null); } },
    // R45: Clear, on a flagged row: any member who may see the item, no reason asked; the row leaves.
    { op: "secondlookclear", label: "act.secondlookclear.label.finder", rereads: ["browse"],
      refusals: { MARK_NO_SUCH_ITEM: "refusal.MARK_NO_SUCH_ITEM", MACHINE_CANNOT_MARK: "refusal.MACHINE_CANNOT_MARK", SECOND_LOOK_NOT_OPEN: "refusal.SECOND_LOOK_NOT_OPEN" },
      send: function (view, el) { return el.dataset.item ? { body: { item: el.dataset.item } } : null; },
      done: function (view, answer, cs) { cs.set("page1", null); cs.set("more", null); } },
  ],
});
