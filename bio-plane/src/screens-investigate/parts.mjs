/* screens-investigate: the small readers every screen of the module shares, handed to each screen as `view.parts`
 * (interface-shell R21, K3002: each part self-contained, serialised by the shell beside the screen's functions). Each
 * takes what it needs as parameters, never another part, so its text alone is its whole meaning. */

export const PARTS = Object.freeze({
  /** A refusal drawn in words beside what it answers (interface-shell R13): its translation, else the code. */
  said(cs, f) {
    const words = f && f.translation ? cs.esc(f.translation) : cs.w("state.failed", { reason: f && f.code ? f.code : { html: cs.w("shell.noanswer") } });
    return `<p class="cs-gap" data-gap="refused" role="alert" data-refusal="${cs.esc((f && f.code) || "")}">${words}</p>`;
  },
  /** A read made as the screen draws, once per key: its outcome, in R10's four states, kept in the screen's memory
   *  (`view.ui.later`) and drawn on arrival. A refusal (the plane's `ok: false` or explore's `refused`) is `failed`. */
  later(cs, view, key, op, o) {
    const L = view.ui.later || (view.ui.later = {});
    const q = JSON.stringify(o || {});
    if (!L[key] || L[key].q !== q) {
      L[key] = { q, state: "loading", value: null, refusal: null };
      const settle = (x) => { L[key] = Object.assign({ q }, x); cs.set("later", L); };
      cs.call(op, o || {}).then((a) => {
        const r = a && typeof a === "object" && a.result !== undefined ? a.result : a;
        const bad = !a || a.ok === false || (r && typeof r === "object" && (r.ok === false || typeof r.refused === "string"));
        if (bad) {
          const f = !a ? {} : a.ok === false ? a : r;
          const code = String(f.code || f.reason || f.refused || "");
          const t = f.translation || f.why || null;
          settle({ state: "failed", value: null, refusal: { code, words: t ? cs.esc(t) : code ? cs.esc(code) : cs.w("shell.noanswer") } });
        } else settle({ state: "ok", value: r, refusal: null });
      }, () => settle({ state: "failed", value: null, refusal: { code: "", words: cs.w("shell.noanswer") } }));
    }
    return L[key];
  },
  /** R55: whom a reply is owed by, from whatever keys a counterparty holds: an addressee's own role and body or name, a described
   *  audience's description; one not yet determined names nobody ("": no sentence is drawn). */
  counterparty(c) {
    if (!c || typeof c !== "object" || c.state === "undetermined") return "";
    const text = (v) => (typeof v === "string" ? v.trim() : "");
    if (c.state === "audience") return text(c.description);
    const named = [text(c.role), text(c.body)].filter(Boolean).join(", ");
    return named || text(c.name) || text(c.label) || text(c.office) || text(c.description);
  },
  /** A word as plain text for a record or a request body, not for the page: `cs.w` escapes it as HTML, this undoes that. */
  plain(cs, key, fills) {
    return cs.w(key, fills).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" }[e]));
  },
  /** B14 (K4259): a section that is itself the read of a registry act the design draws as a section, not a button (`instance`,
   *  `progression`): the section carries the act in `data-act`, as the design's `sec(…, {act})` does. Answers HTML. */
  actSec(html, op) {
    return String(html).replace(/^<section class="cs-section"/, '<section class="cs-section" data-act="' + String(op).replace(/[^a-z]/g, "") + '"');
  },
  /** R44: an undetermined answer's reason, `{key, vars}`, drawn through its word (`vars` that are themselves reasons likewise,
   *  an owner's as that owner answered it); a reason that is no held key (a bare string, a key the page does not carry) is
   *  `state.undetermined` over the module's own plain reason, never English of ours and never the key's name. Answers HTML. */
  why(cs, w) {
    const held = (k) => typeof k === "string" && cs.w(k) !== cs.esc(k);
    const draw = (x) => {
      if (!(x !== null && typeof x === "object" && !Array.isArray(x) && held(x.key))) return cs.w("state.undetermined", { reason: { html: cs.w("people.why.owner_settle_validity") } });
      const vars = {};
      for (const [n, v] of Object.entries(x.vars && typeof x.vars === "object" ? x.vars : {})) vars[n] = v !== null && typeof v === "object" && typeof v.key === "string" ? { html: draw(v) } : v;
      return cs.w(x.key, vars);
    };
    return draw(w);
  },
  /** The page clock's calendar day, `YYYY-MM-DD` (the shell's `cs.now()`, the harness's fake clock in tests). */
  today(cs) {
    return new Date(cs.now()).toISOString().slice(0, 10);
  },
  /** R52, G20 (K4571): the documents `heldcaptures` answers for a picker, read on past the page the screen first asks. The first page is the
   *  screen's own read (`view.data.docs`); while it says `truncated` with a `next`, the following page is read by that cursor (1000 rows,
   *  `extra` being the screen's own filter, e.g. `{project}`), twice at most, each kept in `view.ui.later` and drawn on arrival. Answers
   *  `{ rows, more }`: every row read so far, and whether documents remain unread (the bound kept, or a page that did not answer). */
  docsAll(cs, view, extra) {
    const d = view.data && view.data.docs;
    const first = d && d.state === "ok" && d.value && Array.isArray(d.value.held) ? d.value : null;
    if (!first) return { rows: [], more: false };
    const use = extra || view.ui.docsExtra || {};
    view.ui.docsExtra = use;
    const L = view.ui.later || (view.ui.later = {});
    const rows = first.held.slice();
    let cur = first, k = 1, waiting = false;
    while (cur.truncated && typeof cur.next === "string" && cur.next && k < 3) {
      const key = "docs:" + k;
      const query = Object.assign({}, use, { state: "held_and_vouched", fields: "picker", limit: "1000", after: cur.next });
      const q = JSON.stringify(query);
      if (!L[key] || L[key].q !== q) {
        L[key] = { q, state: "loading", value: null };
        const settle = (x) => { L[key] = Object.assign({ q }, x); cs.set("later", L); };
        cs.call("heldcaptures", { query }).then((a) => {
          const r = a && typeof a === "object" && a.result !== undefined ? a.result : a;
          const good = a && a.ok !== false && r && typeof r === "object" && r.ok !== false && Array.isArray(r.held);
          settle(good ? { state: "ok", value: r } : { state: "failed", value: null });
        }, () => settle({ state: "failed", value: null }));
      }
      const x = L[key];
      if (x.state !== "ok") { waiting = x.state === "loading"; break; }
      for (const r of x.value.held) rows.push(r);
      cur = x.value;
      k++;
    }
    return { rows, more: !waiting && !!cur.truncated };
  },
  /** R34, R52, C95: "Which document": a choice among the documents `heldcaptures` answers (`view.data.docs`, the picker read, capture R77),
   *  by title and the date it was collected, each value the capture's digest (`capture.sha256`), never typed. The documents of `o.project`
   *  (the project the screen is about, when it has one) come first, the owner's order within each group; a search box (drawn when there
   *  are two or more documents) narrows the choice by title on the page, reading nothing more. With none, the choice's empty state is
   *  drawn and nothing is sent. The passage on the document is the whole document until the page lets a member select its words. The
   *  digests shown are kept in `view.ui["docshown:" + id]` for the passage picker of the same choice. */
  docChoice(cs, view, id, o) {
    const d = view.data && view.data.docs;
    o = o || {};
    if (d && d.state === "failed") return cs.state("docs", view, () => "");
    const plain = (t) => String(t).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" }[e]));
    const all = this.docsAll(cs, view, o.query);
    const held = all.rows.filter((r) => r && r.capture && typeof r.capture.sha256 === "string" && r.capture.sha256);
    /* R34 (K5148): `newest` lists the documents newest first (a screen with no project of its own, Explore); a stable sort keeps the owner's order within a day */
    const rows = o.newest ? held.map((r, i) => [r, i]).sort((a, b) => String(b[0].collected_since || "").localeCompare(String(a[0].collected_since || "")) || a[1] - b[1]).map((x) => x[0]) : held;
    const here = typeof o.project === "string" ? o.project : "";
    const ordered = here ? rows.filter((r) => r.project === here).concat(rows.filter((r) => r.project !== here)) : rows;
    const titleOf = (r) => (typeof r.title === "string" && r.title ? r.title : plain(cs.w("screen.held.untitled")));
    const asked = String((view.ui && view.ui["docq:" + id]) || "").trim();
    const shown = asked ? ordered.filter((r) => titleOf(r).toLowerCase().includes(asked.toLowerCase())) : ordered;
    const options = shown.map((r) => {
      const day = typeof r.collected_since === "string" && r.collected_since ? plain(cs.date(r.collected_since, { year: true })) : "";
      return { value: r.capture.sha256, text: day ? titleOf(r) + " · " + day : titleOf(r) };
    });
    if (view.ui) view.ui["docshown:" + id] = shown.map((r) => r.capture.sha256);
    const labelled = (sentence) => `<div class="cs-field" data-empty="${cs.esc(id)}"><p class="mk-small"><b>${cs.w(o.label || "form.choose.document")}</b></p><p class="cs-state" data-state="empty">${sentence}</p></div>`;
    if (d && d.state !== "loading" && !rows.length) return labelled(cs.w("state.empty"));
    const search = rows.length > 1
      ? cs.field(id + "-q", "form.choose.search", { value: asked, typing: (cs2, view2, value) => { cs2.set("docq:" + id, String(value || "").trim()); } }) : "";
    if (d && d.state !== "loading" && !options.length) return search + labelled(cs.w("form.choose.search.none"));
    return search + cs.choice(id, o.label || "form.choose.document", options, o.drive ? { acts: {} } : {}) + `<p class="mk-small">${cs.w(o.help || "form.choose.document.help")}</p>`
      + (all.more ? `<p class="mk-small" data-docs-more>${cs.w("screen.people.more", { n: String(all.rows.length) })}</p>` : "")
      + (o.passage === false ? "" : `<p class="mk-small">${cs.w("form.choose.passage")}</p>`);
  },
  /** R8, R34 (K5148; WALK-FINAL-08 D3): the passages a standard rests on (`texts`, each `{content_id}`) as the options of a choice, each by its
   *  words (the reading of its capture, from `content` and `reading`, read once each by `later`), else its document's title, never its content
   *  id; the value of an option is the content id the plane takes as the passage that says so. Options only: no blank one. */
  textOptions(cs, view, texts) {
    const held = this.docsAll(cs, view).rows;
    const same = (a, b) => JSON.stringify(Object.keys(a || {}).sort().map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b || {}).sort().map((k) => [k, b[k]]));
    return (Array.isArray(texts) ? texts : []).filter((x) => x && x.content_id).map((x) => {
      const cq = this.later(cs, view, "content:" + x.content_id, "content", { query: { id: x.content_id } });
      const c = cq.state === "ok" && cq.value && typeof cq.value.capture_sha === "string" ? cq.value : null;
      const rd = c ? this.later(cs, view, "reading:" + c.capture_sha, "reading", { query: { sha256: c.capture_sha } }) : null;
      const units = rd && rd.state === "ok" && rd.value && Array.isArray(rd.value.text_units) ? rd.value.text_units.filter((u) => u && String(u.text || "").trim()) : [];
      const hit = c && c.extent && c.extent.kind !== "document" ? units.filter((u) => same(u.extent, c.extent)) : units.slice(0, 1);
      const words = hit.map((u) => String(u.text).trim()).join(" ").slice(0, 160);
      const row = c ? held.find((r) => r && r.capture && r.capture.sha256 === c.capture_sha) : null;
      return { value: x.content_id, text: words || (row && row.title) || this.plain(cs, "screen.person.source") };
    });
  },
  /** R23, R34, C59: a choice with nothing to choose from (none held), drawn under its own label in a slot of its own, so the empty state is never taken for
   *  the sentence of the control before it. Answers HTML. */
  emptyChoice(cs, id, labelKey) {
    return `<div class="cs-field" data-empty="${cs.esc(id)}"><p class="mk-small"><b>${cs.w(labelKey)}</b></p><p class="cs-state" data-state="empty">${cs.w("state.empty")}</p></div>`;
  },
  /** R34, C59: the passage the member chose: the chosen document's digest and, when she selected words in `wordsId`'s picker, the extent of
   *  the first unit selected (a unit's extent is `content`'s own), else the whole document; null with no document chosen. */
  chosen(cs, id, wordsId) {
    const s = String(cs.value(id) || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(s)) return null;
    let extent = { kind: "document" };
    const sel = wordsId ? cs.value(wordsId + "-" + s.slice(0, 12)) : null;
    if (sel && typeof sel === "object" && Array.isArray(sel.extents) && sel.extents.length) {
      try { const e = JSON.parse(sel.extents[0]); if (e && typeof e === "object" && typeof e.kind === "string") extent = e; } catch { /* the whole document */ }
    }
    return { captureSha: s, extent };
  },
  /** R34, C59, N3: "Choose the passage on the document": its heading always drawn, then the words of the chosen document (`docChoice` with `drive`,
   *  so the choice is kept in `view.ui["choice:" + docId]`; the first document until she chooses), from that document's reading (`reading`'s
   *  `text_units`, in order, at most 500 drawn), for her to select; a unit's extent travels as its JSON, and each document's words are their own
   *  selection (`wordsId` + the first 12 of its digest, as `chosen` reads it). A document with no reading, or whose reading cannot be read, says
   *  why the words are not there (`retrieval.notread.not_extracted`, the design's own sentence for a capture nothing has read), never
   *  "Nothing here" and never "Could not read this". `later` is `PARTS.later`. With no document held, nothing (the document choice says so). */
  passagePick(cs, view, docId, wordsId, later) {
    const rows = this.docsAll(cs, view).rows;
    const shown = view.ui && view.ui["docshown:" + docId];
    const shas = Array.isArray(shown) ? shown : rows.map((r) => r && r.capture && r.capture.sha256).filter((x) => typeof x === "string" && x);
    if (!shas.length) return "";
    const made = view.ui["choice:" + docId];
    const sha = shas.includes(made) ? made : shas[0];
    const rd = later(cs, view, "words:" + sha, "reading", { query: { sha256: sha } });
    const units = rd.state === "ok" ? (Array.isArray(rd.value && rd.value.text_units) ? rd.value.text_units : []).filter((u) => u && String(u.text || "").trim()).slice(0, 500)
      .map((u) => ({ extent: JSON.stringify(u.extent && typeof u.extent === "object" ? u.extent : { kind: "document" }), text: String(u.text) })) : [];
    const body = rd.state === "loading" ? cs.state(rd, () => "")
      : units.length ? cs.words(wordsId + "-" + sha.slice(0, 12), { units })
      : `<p class="cs-state" data-state="empty" data-why="noreading">${cs.w("retrieval.notread.not_extracted")}</p>`;
    return `<p class="mk-small" data-passage="${cs.esc(wordsId)}"><b>${cs.w("form.choose.passage")}</b></p>` + body;
  },
  /** R111, C94: who a stamp names, by handle: a member's id (`member:<id>` or the bare id) through the kit's `memberName`, the founder included and a
   *  member with no handle the kit's word, never the id; a class or machine (`class:legal_lookup`) is no member and keeps its own name. Text. */
  who(cs, by) {
    const s = String(by == null ? "" : by).trim();
    if (!s) return "";
    if (/^(class|machine|agent):/.test(s)) return s.replace(/^(class|machine|agent):/, "");
    return cs.memberName(s.replace(/^member:/, ""));
  },
  /** A record id drawn as a reference to its screen (interface-shell R16): a person or organisation the record follows
   *  opens `person`, a document, capture, question or project its own; anything else carries its card only. */
  refOf(cs, id, label, facts, kind) {
    const s = String(id || "");
    const k = kind || (/^ENT-/.test(s) ? "person" : /^[0-9a-f]{64}$/.test(s) ? "capture" : /^(INFO|INF)-/.test(s) ? "document"
      : /^INQ-/.test(s) ? "question" : /^PROJ-/.test(s) ? "project" : "record");
    return cs.ref(k, s, label || s, facts || []);
  },
  /** A record document's front matter: its top-level scalars, and its `references` as `{target, rel, status}`. */
  front(text) {
    const out = { refs: [] };
    if (typeof text !== "string") return out;
    const head = text.replace(/^---\s*\n/, "").split(/\n---\s*(\n|$)/)[0];
    let inRefs = false, cur = null;
    for (const line of head.split("\n")) {
      if (/^references:\s*$/.test(line)) { inRefs = true; continue; }
      if (inRefs && /^\s+-\s*/.test(line)) { cur = {}; out.refs.push(cur); }
      if (inRefs && /^\s+/.test(line) && cur) {
        const m = /^\s+(?:-\s*)?(\w+):\s*(.*)$/.exec(line);
        if (m) cur[m[1]] = m[2].trim();
        continue;
      }
      inRefs = false;
      const m = /^(\w+):\s*(.*)$/.exec(line);
      if (m) {
        let v = m[2].trim();
        try { if (v.startsWith("\"")) v = JSON.parse(v); } catch { /* the raw value is kept */ }
        out[m[1]] = v;
      }
    }
    return out;
  },
  /** An event's date, as precise as its source states it: a day, a month marked "month known", "on or before"; else undetermined
   *  with `why` (the record's own reason) or the keyed "the source states no date". */
  when(cs, w, why) {
    if (!w) return cs.mark("gap", "undetermined", { reason: why || cs.w("screen.timeline.undated") });
    if (w.precision === "edtf") {
      const m = /^(\d{4})-(\d{2})$/.exec(String(w.value || ""));
      const names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return cs.w("screen.timeline.month", { month: cs.w("date.month." + names[Number(m[2]) - 1]), year: m[1] });
    }
    if (w.precision === "upper_bound") return cs.w("screen.timeline.onorbefore", { date: cs.date(w.end || w.value || "") });
    return cs.date(w.value || w.start || "") || cs.esc(String(w.value || ""));
  },
  /** R18: the connection graph, drawn from `exploregraph`'s answer `g` ({centre, nodes, steps, stopped}) as the design's SVG
   *  (lines in their class's mark, a grade chip on each, the stops dashed) and beneath it the same things as a list: each
   *  node a reference with its kind's word and a control to make it the centre, each step with its word, grade and
   *  citation. `o`: `{names, groupOf(kind), trail, act}`; `act` names the op a node's control sends (or null: a plain link
   *  to Explore). No score, rank or "most connected" is drawn (K1486). */
  graph(cs, g, o) {
    /* a read that answered nothing is a read that failed, never an empty graph (R18) */
    if (!g || !Array.isArray(g.nodes)) return `<p class="cs-state" data-state="failed" role="alert">${cs.w("state.failed", { reason: { html: cs.w("shell.noanswer") } })}</p>`;
    const W = 860, H = 660, CX = 430, CY = 322, R1 = 160, R2 = 300;
    const names = (o && o.names) || {};
    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    const steps = Array.isArray(g.steps) ? g.steps : [];
    const centre = g.centre;
    const stops = (Array.isArray(g.stopped) ? g.stopped : []).concat((Array.isArray(g.at_depth) ? g.at_depth : []).map((n) => ({ node: n, why: "ring" })));
    const limit = new Set(stops.map((s) => s.node));
    const hidden = (st) => st.class === "declared" || st.class === "hunch" || st.label === "declared, not evidenced" || st.label === "hunch";
    /* R27: a step a member backed with a passage is drawn in its own class (`affordances` R60 answers its group `step_source`;
       the kind itself is enough where the vocabulary has not been read) */
    const classOf = (st) => (hidden(st) ? "lead" : st.kind === "step_source" ? "step_source" : (o && o.groupOf && o.groupOf(st.kind)) || "ment");
    const adj = (id) => steps.filter((s) => s.from === id || s.to === id).map((s) => (s.from === id ? s.to : s.from));
    const ring1 = nodes.filter((n) => n.ring === 1).map((n) => n.id);
    const pos = {}; pos[centre] = [CX, CY];
    ring1.forEach((id, i) => { const t = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, ring1.length); pos[id] = [CX + R1 * Math.cos(t) * 1.5, CY + R1 * Math.sin(t) * 0.9]; });
    ring1.forEach((p, i) => {
      const t = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, ring1.length);
      const kids = adj(p).filter((x) => x !== centre && !ring1.includes(x) && !pos[x] && nodes.some((n) => n.id === x));
      kids.forEach((id, j) => { const a = t + (j - (kids.length - 1) / 2) * 0.55; pos[id] = [CX + R2 * Math.cos(a) * 1.25, CY + R2 * Math.sin(a) * 0.93]; });
    });
    nodes.forEach((n, i) => { if (!pos[n.id]) pos[n.id] = [60 + (i % 10) * 80, H - 30]; });
    /* R35: an ENT- node's kind word is its `entity_kind` (explore R25); a document and a payment keep their own */
    const KIND_OF = { person: "person", office: "office", body: "org", institution: "org", movement: "org", program: "org", fund: "fund" };
    const thingOf = (id) => {
      if (/^(INFO|INF)-/.test(id)) return "doc";
      if (/^MNY-/.test(id)) return "pay";
      if (!/^ENT-/.test(id)) return null;
      const n = nodes.find((x) => x.id === id);
      return KIND_OF[n && n.entity_kind] || "entity";
    };
    /* R35: a node is drawn by its `label`; `null` means the record holds no name for it: never its id */
    const unnamed = cs.w("connection.node.unnamed");
    const label = (id) => {
      const n = nodes.find((x) => x.id === id);
      const l = n && typeof n.label === "string" && n.label.trim() ? n.label : names[id];
      return l || unnamed.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" }[e]));
    };
    const isUnnamed = (id) => { const n = nodes.find((x) => x.id === id); return !(n && typeof n.label === "string" && n.label.trim()) && !names[id]; };
    /* a card says what the thing is: a money trail and a payment, which the kit holds no kind word for, carry their kind as their fact (DEC-160) */
    const plainOf = (t) => t.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" }[e]));
    const tipOf = (id) => cs.w("connection.node.unnamed.tip", { kind: cs.w("connection.thing." + (thingOf(id) || "entity")) });
    const shape = (t, r) => (t === "person" ? `<circle r="${r}"/>` : t === "doc" ? `<path d="M${-r} ${-r * 0.85} h${r * 1.45} l${r * 0.55} ${r * 0.55} v${r * 1.15} h${-2 * r} z"/>`
      : t === "pay" ? `<path d="M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 z"/>` : `<rect x="${-r}" y="${-r * 0.78}" width="${2 * r}" height="${1.56 * r}" rx="3"/>`);
    const pairCount = {}, pairSeen = {};
    const drawn = steps.filter((s) => pos[s.from] && pos[s.to]);
    drawn.forEach((s) => { const k = [s.from, s.to].sort().join("|"); pairCount[k] = (pairCount[k] || 0) + 1; });
    const ringOf = (id) => (id === centre ? 0 : ring1.includes(id) ? 1 : 2);
    const edgeSvg = drawn.map((s) => {
      const [ax, ay] = pos[s.from], [bx, by] = pos[s.to];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const k = [s.from, s.to].sort().join("|"); const idx = pairSeen[k] = (pairSeen[k] || 0) + 1;
      const off = (idx - 1 - (pairCount[k] - 1) / 2) * 26; const side = off === 0 ? (ny < 0 ? 1 : -1) : Math.sign(off);
      const ra = (s.from === centre ? 30 : 22) + 3, rb = (s.to === centre ? 30 : 22) + 3;
      const x1 = ax + ux * ra + nx * off, y1 = ay + uy * ra + ny * off, x2 = bx - ux * rb + nx * off, y2 = by - uy * rb + ny * off;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const f = ringOf(s.from) < ringOf(s.to) ? (uy < -0.6 ? 0.5 : 0.66) : ringOf(s.from) > ringOf(s.to) ? (uy > 0.6 ? 0.5 : 0.34) : 0.5;
      const px = x1 + (x2 - x1) * f, py = y1 + (y2 - y1) * f, ldy = ny * side * 14, ldx = nx * side * 14;
      const vert = Math.abs(nx) > 0.6, anchor = vert ? (ldx > 0 ? "start" : "end") : "middle";
      const lx = px + ldx * (vert ? 1.15 : 1), ly = py + (vert ? 4 : ldy + (ldy > 0 ? 7 : 0));
      const line = `x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"`;
      const c = classOf(s);
      const letter = s.grade && /^[A-D]$/.test(s.grade.assertion || "") ? s.grade.assertion : "";
      const tip = `<b>${cs.w("connection.kind." + c + ".name")}</b>: ${cs.esc(s.word || s.kind)}${letter ? " · " + cs.esc(letter) : ""}`;
      return `<g class="edge" tabindex="0" data-tip="${cs.esc(tip)}"><line class="hit" ${line}/><line class="e e-${c}" ${line}/>${c === "money" ? `<line class="e e-money-in" ${line}/>` : ""}`
        + `<text class="w${c === "lead" ? " lead" : ""}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${cs.esc(s.word || s.kind)}${c === "same" ? " =" : ""}</text>`
        + (letter ? `<g class="gchip${c === "same" ? " subject" : ""}" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><rect x="-9" y="-8" width="18" height="16" rx="2"/><text text-anchor="middle" y="4">${cs.esc(letter)}</text></g>` : "") + "</g>";
    }).join("");
    const nodeSvg = nodes.map((n) => {
      const [x, y] = pos[n.id]; const c = n.id === centre, r = c ? 30 : 22, t = thingOf(n.id), lim = limit.has(n.id) && !c;
      const nm = label(n.id); const short = nm.length > 26 ? nm.slice(0, 25) + "…" : nm;
      return `<g class="node${c ? " center" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" data-node="${cs.esc(n.id)}"${isUnnamed(n.id) ? ` data-tip="${cs.esc(tipOf(n.id))}"` : ""}>${shape(t, r)}${lim ? `<circle class="lim" r="${r + 7}"/>` : ""}`
        + `<text class="n" y="${r + 16}" text-anchor="middle">${cs.esc(short)}</text>${lim ? `<text class="lim" y="${r + 30}" text-anchor="middle">${cs.w("connection.graph.limit")}</text>` : ""}</g>`;
    }).join("");
    /* the same things as a list: references, the controls, the limits and each step's citation */
    const press = (id) => (o && o.act ? cs.act(o.act, { label: "connection.graph.click", data: { node: id } })
      : `<a class="cs-btn" data-tone="quiet" data-nav href="/app/explore/${encodeURIComponent(id)}">${cs.w("connection.graph.click")}</a>`);
    const list = nodes.map((n) => {
      const t = thingOf(n.id);
      return cs.row("", `<b>${cs.ref(/^ENT-/.test(n.id) ? "person" : /^(INFO|INF)-/.test(n.id) ? "document" : "record", n.id, label(n.id), isUnnamed(n.id) ? [tipOf(n.id).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" }[e]))]
        : /^MSR-/.test(n.id) ? [plainOf(cs.w("screen.money.name"))] : /^MNY-/.test(n.id) ? [plainOf(cs.w("connection.thing.pay"))] : [])}</b>${t ? ` <span class="mk-small"${isUnnamed(n.id) ? ` data-tip="${cs.esc(tipOf(n.id))}"` : ""}>${cs.w("connection.thing." + t)}</span>` : ""}`
        + (o && o.idonly && o.idonly[n.id] && isUnnamed(n.id) ? `<br><span class="mk-small" data-why="${cs.esc(n.id)}">${cs.w("screen.explore.unnamed.why", { n: String(o.idonly[n.id]) })}</span>` : "")
        + (limit.has(n.id) && n.id !== centre ? ` <span class="mk-small" data-limit="${cs.esc(n.id)}"><b>${cs.w("connection.graph.limit")}</b> · ${cs.w("connection.graph.limit.means")}</span>` : ""),
        n.id === centre ? `<span class="mk-small">${cs.w("connection.graph.center.means")}</span>` : press(n.id));
    }).join("");
    const stepList = drawn.map((s) => {
      const c = classOf(s);
      /* R61 (4): evidence is a capture (`capture_sha`, or a source spelt `capture:<64 hex>`) drawn as a reference to the document, as Explore's chains draw it (`explore.mjs`), never its fingerprint */
      const ev = (Array.isArray(s.evidence) ? s.evidence : []).map((e) => {
        const spelt = /^capture:([0-9a-f]{64})$/.exec(String(e.source || ""));
        if (/^testimony:/.test(String(e.source || ""))) return `<span class="mk-small">${cs.w("screen.explore.testimony")}</span>`;
        return e.capture_sha || spelt ? cs.ref("capture", e.capture_sha || spelt[1], cs.w(o.words.cited), []) : e.source ? cs.esc(String(e.source)) : "";
      }).filter(Boolean).join(" ");
      const letter = s.grade && /^[A-D]$/.test(s.grade.assertion || "") ? cs.grade("connection", s.grade.assertion) : "";
      /* R35, R17: a step a member backed with a passage shows who attached it and when beside its citation, */
      const by = s.kind === "step_source" && s.attached_by
        ? ` <span class="mk-small" data-attached="${cs.esc(s.id)}">${cs.w(o.words.attached, { by: cs.memberName(String(s.attached_by).replace(/^member:/, "")), date: cs.date(s.at || "") })}</span>` : "";
      return cs.row(letter, `<b>${cs.esc(label(s.from))}</b> → <i>${cs.esc(s.word || s.kind)}</i> → <b>${cs.esc(label(s.to))}</b>`
        + (c === "lead" ? ` <b>${cs.w(s.label === "hunch" || s.class === "hunch" ? o.words.hunch : o.words.declared)}</b>` : ""),
        (ev ? ev : c === "lead" ? "" : cs.mark("gap", "undetermined", { reason: cs.w(o.words.nosource) })) + by);
    }).join("");
    const trail = (o && Array.isArray(o.trail) ? o.trail : [centre]);
    const trailHtml = `<div class="mk-trail"><span class="k" data-tip="${cs.esc(cs.w("connection.graph.trail.means"))}">${cs.w("connection.graph.trail.label")}</span>`
      + trail.map((id, i) => (i === trail.length - 1 ? `<b class="mk-trailbtn now">${cs.esc(label(id))}</b>` : (o && o.act ? cs.act(o.act, { label: "connection.graph.trail.label", data: { node: id } }) : ""))).join("") + "</div>";
    const legendKinds = ["pos", "part", "money", "ment", "same", "step_source", "lead"];
    const legend = `<div class="mk-glegend">${legendKinds.map((k) => `<span class="li" data-tip="${cs.esc(cs.w("connection.kind." + k + ".means"))}"><svg viewBox="0 0 36 12" aria-hidden="true"><line class="e e-${k}" x1="1" y1="6" x2="35" y2="6"/>${k === "money" ? '<line class="e e-money-in" x1="1" y1="6" x2="35" y2="6"/>' : ""}</svg>${cs.w("connection.kind." + k + ".name")}</span>`).join("")}`
      + `<span class="li" data-tip="${cs.esc(cs.w("connection.graph.grade.means"))}">${cs.w("connection.graph.legend.grade")}</span></div>`;
    return `<div class="mk-graph" data-centre="${cs.esc(centre)}">${trailHtml}<div class="gwrap"><svg class="g" viewBox="0 0 ${W} ${H}" role="group" aria-label="${cs.esc(label(centre))}">${edgeSvg}${nodeSvg}</svg></div>${legend}`
      + (stops.length ? `<p class="mk-small">${cs.w("connection.graph.limit.means")}</p>` : "") + cs.sheet(list) + (stepList ? cs.sheet(stepList) : "") + "</div>";
  },
  /** R43: the entity ids of the unnamed `ENT-` nodes of a graph answer, comma-separated, at most 500 (what one `entityidonly` takes); "" for none. */
  unnamedIds(g) {
    const ids = (g && Array.isArray(g.nodes) ? g.nodes : []).filter((n) => n && /^ENT-/.test(String(n.id)) && !(typeof n.label === "string" && n.label.trim())).map((n) => n.id);
    return [...new Set(ids)].slice(0, 500).join(",");
  },
  /** R43: `{entity id: n}` from an `entityidonly` outcome (`later`'s object), only the counts above 0; a read not yet answered or failed gives none. */
  idonlyMap(io) {
    const out = {};
    const rows = io && io.state === "ok" && io.value && Array.isArray(io.value.entities) ? io.value.entities : [];
    for (const r of rows) if (r && typeof r.entity_id === "string" && Number(r.documents) > 0) out[r.entity_id] = Number(r.documents);
    return out;
  },
  /** C14, R18: the groups of the kinds a graph's steps carry, read from `affordances` (`later`, one read) only when the graph has a step to colour; a graph of
   *  no step draws none and reads nothing. Answers `{kind: group}`. */
  groupsFor(cs, view, g, later) {
    if (!(g && Array.isArray(g.steps) && g.steps.length)) return {};
    const v = later(cs, view, "vocab", "affordances", { query: {} });
    const ck = v.state === "ok" && v.value && v.value.vocabularies && v.value.vocabularies.connection_kinds;
    const m = {};
    if (ck && Array.isArray(ck.values)) for (const k of ck.values) m[k] = (ck.words && ck.words[k] && ck.words[k].group) || (ck.groups && ck.groups[k]) || null;
    return m;
  },
  /** R24, R27: the group a connection kind belongs to (`pos`, `part`, `money`, `ment`, `same`, `step_source`), from the vocabulary `affordances` answers. */
  groupMap(v) {
    const ck = v && v.vocabularies && v.vocabularies.connection_kinds;
    const m = {};
    if (ck && Array.isArray(ck.values)) for (const k of ck.values) m[k] = (ck.words && ck.words[k] && ck.words[k].group) || (ck.groups && ck.groups[k]) || null;
    return m;
  },

  /** R34, C95: the questions a choice offers, from the read `view.data[name]` (`list` of inquiries): the questions the project cites first, then the
   *  rest in the owner's order; `value` is the first cited one that the read holds (the question the page was opened for: a list never starts on
   *  an arbitrary question), none when the project cites none (then `value` is undefined and no option is drawn chosen). `{options, value}`. */
  asked(view, name, cited) {
    const d = view.data && view.data[name];
    const rows = d && d.state === "ok" && d.value && Array.isArray(d.value.bundles) ? d.value.bundles : [];
    const mine = (Array.isArray(cited) ? cited : []).filter((x) => typeof x === "string" && x);
    const all = rows.filter((b) => b && b.bundle_id).map((b) => ({ value: b.bundle_id, text: b.title || b.bundle_id }));
    const options = all.filter((o) => mine.includes(o.value)).concat(all.filter((o) => !mine.includes(o.value)));
    const pre = options.find((o) => mine.includes(o.value));
    return { options, value: pre ? pre.value : undefined };
  },

  /** R23: the options of a choice among record data, from a read the screen made (`view.data[name]`): the rows `pick(v)`
   *  lists, each `{value, text}` by `map(row)`; none while the read has not answered (the choice is then empty). */
  options(view, name, pick, map) {
    const d = view.data && view.data[name];
    const rows = d && d.state === "ok" && d.value ? pick(d.value) : [];
    return (Array.isArray(rows) ? rows : []).map(map).filter((o) => o && o.value);
  },
});
