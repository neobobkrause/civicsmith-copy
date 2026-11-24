/* screens-publish: the helpers every screen of this module hands the shell as its `parts` (interface-shell R21, K3002).
 * Each is self-contained: it refers only to its parameters and the language's own globals, so the shell serialises it
 * beside the screen's functions and hands it in as `view.parts`. A screen calls `view.parts.<name>(cs, view, …)`. */

export const PARTS = Object.freeze({
  /* A read that waits on another read's answer (a case's document once the draft names its case): sent once per query
     through `cs.call`, kept in the screen's page memory (`view.ui.later`), and answered in R10's four states, as
     `cs.state` draws them: `{state: "loading" | "empty" | "failed" | "ok", value, refusal}`. `isEmpty(value)` says when a
     value is the empty state. */
  later: function (cs, view, key, op, req, isEmpty) {
    const L = view.ui.later || (view.ui.later = {});
    const q = JSON.stringify(req || {});
    if (!L[key] || L[key].q !== q) {
      L[key] = { q: q, state: "loading", value: null, refusal: null };
      const settle = function (o) { L[key] = Object.assign({ q: q, value: null, refusal: null }, o); cs.set("later", L); };
      cs.call(op, req || {}).then(function (a) {
        const r = a && a.result !== undefined ? a.result : a;
        if (!a || a.ok === false || (r && r.ok === false)) {
          const f = r && r.ok === false ? r : a || {};
          settle({ state: "failed", fields: f, refusal: { code: String(f.code || f.reason || ""), words: view.parts.refusalText(cs, f) || cs.w("shell.unread") } });
        } else if (typeof isEmpty === "function" && isEmpty(r)) settle({ state: "empty", value: r });
        else settle({ state: "ok", value: r });
      }, function () { settle({ state: "failed", refusal: null }); });
    }
    return L[key];
  },

  /* K3171: the parts of the subject the address must carry (`<a>/<b>`), or null when one is absent: the screen then
     sends no subject read and draws interface-shell R35's "Nothing is here" (`nothing`). */
  subject: function (view, n) {
    const s = String(view.subject || "").split("/");
    for (let i = 0; i < n; i++) if (!s[i]) return null;
    return s;
  },
  nothing: function (cs, to) {
    // K3179: the shell's own "Nothing is here" (interface-shell R35), its title over what it says. R21: a public screen
    // (`to` "public") offers the way an outsider can go, the group's public page, never "Go to Home".
    return '<h1 class="t-title">' + cs.w("shell.unavailable.nothing.title") + '</h1><p class="cs-state" data-state="empty" data-unavailable="nothing">'
      + cs.w("shell.unavailable.nothing.says") + "</p>"
      + (to === "public" ? '<p><a class="cs-btn" data-tone="quiet" href="/" data-public-page>' + cs.w("screen.published.grouppage") + "</a></p>"
        : '<p><a class="cs-btn" data-tone="quiet" href="/app" data-nav>' + cs.w("shell.unavailable.home") + "</a></p>");
  },

  /* After an act, the reads that wait on others are read again with the rest (interface-shell R10, this module's R10). */
  forget: function (view) { view.ui.later = {}; },

  /* An answer's own value: the door's `result` when it wraps one, else the answer itself. */
  value: function (answer) { return answer && typeof answer === "object" && answer.result !== undefined ? answer.result : answer; },

  /* R53 (C53; DEC-376): the `references` a project's document holds, each live or severed as `citation` R15 keeps it: `{target, rel, status,
     note}` in the document's order, read from the front matter of `image`'s `bundle.md`. [] when it holds none. */
  references: function (image) {
    const text = image && typeof image === "object" ? image["bundle.md"] : image;
    if (typeof text !== "string") return [];
    const head = text.replace(/^---\s*\n/, "").split(/\n---\s*(\n|$)/)[0];
    const val = function (v) { v = String(v).trim(); try { if (v.startsWith("\"")) v = JSON.parse(v); } catch (e) { /* the raw value */ } return v; };
    const out = [];
    let on = false, cur = null;
    head.split("\n").forEach(function (line) {
      const top = /^(\w+):\s*(.*)$/.exec(line);
      if (top) { on = top[1] === "references" && top[2].trim() === ""; cur = null; return; }
      if (!on) return;
      const item = /^\s+-\s+(\w+):\s*(.*)$/.exec(line);
      if (item) { cur = {}; cur[item[1]] = val(item[2]); out.push(cur); return; }
      const sub = /^\s{4,}(\w+):\s*(.*)$/.exec(line);
      if (sub && cur) cur[sub[1]] = val(sub[2]);
    });
    return out.filter(function (r) { return r && r.target; });
  },

  /* A project's title from its bundle's front matter, as `image` answers it (the path's project step, interface-shell R8). */
  titleOf: function (image, fallback) {
    const text = image && typeof image === "object" ? image["bundle.md"] : image;
    if (typeof text !== "string") return String(fallback || "");
    const head = text.replace(/^---\s*\n/, "").split(/\n---\s*(\n|$)/)[0];
    const m = /^title:\s*(.*)$/m.exec(head) || /^objective:\s*(.*)$/m.exec(head);
    let t = m ? m[1].trim() : "";
    try { if (t.startsWith("\"")) t = JSON.parse(t); } catch (e) { /* the raw value is drawn */ }
    return t || String(fallback || "");
  },

  /* A refusal the plane answered (a read that failed, or one inside a read's value: `blockers`, `first`), in the words the shell
     gives it (interface-shell R13, R61, R83; DEC-342): `refusal.<CODE>` when the list holds it, else the answer's translation
     with its `{name}` placeholders filled from the refusal's own fields (G10), else `refusal.uncatalogued` with the code as the act gave it; never the builder's `detail`. "" when it names no code and
     carries no translation. */
  refusalText: function (cs, f) {
    if (!f || typeof f !== "object") return "";
    const code = String(f.code || f.reason || "");
    if (code) { const held = cs.w("refusal." + code, f); if (held !== "refusal." + code) return held; }
    // G10 (fix round 6): the plane's canned text keeps its `{name}` placeholders (`{document}`, `{photo}`); each is filled from the refusal's own
    // field of that name, and one the refusal does not carry is left out, never drawn raw
    if (typeof f.translation === "string" && f.translation) {
      return cs.esc(f.translation.replace(/\{(\w+)\}/g, function (m, k) { const v = f[k]; return typeof v === "string" || typeof v === "number" ? String(v) : ""; }).replace(/ {2,}/g, " "));
    }
    return code ? cs.w("refusal.uncatalogued") + " <code>" + cs.esc(code) + "</code>" : "";
  },

  /* G60 (fix round 7): the findings a GATE_REFUSED carries (`ratification` R18, R2: `findings`, each `{check, detail, repairs?}`, or
     `says: {key, vars}` where a finding carries its words), one HTML line for each: its text as data, its check as the reference a
     member can quote, what repairs it. A finding with neither text nor check is left out. [] when the refusal carries none. */
  gateLines: function (cs, f) {
    const str = function (v) { return typeof v === "string" && v.trim() ? v.trim() : ""; };
    return (f && Array.isArray(f.findings) ? f.findings : []).map(function (x) {
      if (!x || typeof x !== "object") return "";
      const check = str(x.check), text = x.says && typeof x.says.key === "string" ? cs.w(x.says.key, x.says.vars || {}) : cs.esc(str(x.detail) || str(x.message));
      if (!check && !text) return "";
      const fix = (Array.isArray(x.repairs) ? x.repairs : x.repairs ? [x.repairs] : []).map(function (r) { return str(typeof r === "string" ? r : r && (r.detail || r.says || r.text || r.message)); }).filter(Boolean);
      return '<span data-gate-finding="' + cs.esc(check) + '">' + text + (check ? ' <code class="meta">' + cs.esc(check) + "</code>" : "")
        + fix.map(function (r) { return ' <span class="meta" data-repair>' + cs.esc(r) + "</span>"; }).join("") + "</span>";
    }).filter(Boolean);
  },

  /* What an act said once it was answered, beside the screen's own section: `{key, html, ok}` in `view.ui.said`. */
  said: function (view, key) {
    const s = view.ui.said && view.ui.said[key];
    // R20: the note is the design's `mk-note`; a refusal is drawn as the shell draws one (`cs-gap`, interface-shell R61).
    // K3742: a state drawn in a fold is a block, so it sits in a `div`, never a paragraph.
    const tag = /^<details/.test(s ? s.html : "") ? "div" : "p";
    return s ? (s.ok ? "<" + tag + ' class="mk-note" role="status" data-said="' + key + '">' : "<" + tag + ' class="cs-gap" data-gap="refused" role="alert" data-said="' + key + '">')
      + s.html + "</" + tag + ">" : "";
  },
  /* G54 (3)(c): why an edition has no case file to download, from `publishedcase`'s `case_file` (or `verification.case_file`): the
     state's sentence and the code's, each read by key (a key the word table lacks draws the bare code, never English). "" when the
     answer states none, when it is built, or when the edition has a manifest (unchanged then). */
  casefileSaid: function (cs, e) {
    const v = e && e.verification && typeof e.verification === "object" ? e.verification : {};
    const c = e && e.case_file && typeof e.case_file === "object" ? e.case_file : v.case_file && typeof v.case_file === "object" ? v.case_file : null;
    if (!c || c.state === "built" || /^[0-9a-f]{64}$/.test(String(e.manifest_sha || ""))) return "";
    // `cs.w` answers an escaped word (interface-shell browser `w`): only the bare fallback is escaped here, never a word a second time
    const say = function (key, bare) { const t = cs.w(key); return t === key ? cs.esc(bare) : t; };
    const state = String(c.state || ""), code = String(c.code || "");
    if (!["being_prepared", "retrying", "stopped", "waiting_on_members"].includes(state)) return "";
    return '<span data-casefile="' + cs.esc(state) + '">' + say("screen.published.casefile." + state, state) + "</span>"
      + (code ? ' <span data-casefile-code="' + cs.esc(code) + '">' + say("screen.published.casefile.code." + (/^[A-Z_]+$/.test(code) ? code : "UNKNOWN"), code) + "</span>" : "");
  },
  say: function (cs, view, key, html, ok) {
    const s = view.ui.said || (view.ui.said = {});
    s[key] = { html: html, ok: ok !== false };
    cs.set("said", s);
  },

  /* D29 (K3324 (2)): an answer of `ok: true` that carries a refusal is not success. The refusal it carries (`ok: false`,
     `started: false`, `dispatched: false` or a `withheld` that holds something), else null. */
  carried: function (answer) {
    const r = answer && typeof answer === "object" && answer.result !== undefined ? answer.result : answer;
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const held = r.withheld !== undefined && r.withheld !== null && r.withheld !== false && r.withheld !== 0 && r.withheld !== "";
    return r.ok === false || r.started === false || r.dispatched === false || held ? r : null;
  },
  /* D29: draws the refusal a success-shaped answer carries as the act's refusal beside `key`, in the plane's own words, and
     says it did (true); false when the answer carries none, the act having succeeded. */
  refused: function (cs, view, key, answer) {
    const f = view.parts.carried(answer);
    if (!f) { if (view.ui.said) delete view.ui.said[key]; return false; } // an earlier refusal beside this act is not left standing
    const words = view.parts.refusalText(cs, f);
    view.parts.say(cs, view, key, words || cs.w("state.failed", { reason: String(f.code || f.reason || "") }), false);
    return true;
  },

  /* K3742: a state the design draws "in a fold" is drawn inside a `details` headed by its `.summary` key, open whenever
     it is drawn (a roster row is never folded). */
  fold: function (cs, summaryKey, inner) {
    return '<details class="mk-details" open data-fold="' + cs.esc(summaryKey) + '"><summary>' + cs.w(summaryKey) + "</summary>" + inner + "</details>";
  },

  /* The review copy a ceremony draws from: the one its address names (read as the screen's own), else the newest draft's. */
  copyOf: function (view) {
    const r = view.data.copy || (view.ui.later && view.ui.later.copy);
    return r && r.state === "ok" ? r.value : null;
  },

  /* A kit sentence (`cs.w`, HTML) read back as plain text, for a kit part that escapes the text it is given. */
  plain: function (html) {
    return String(html).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, function (m, e) { return { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]; });
  },

  /* R27, R41 (`review` R35): the team's time zone as the member door's copy answer carries it: its own top-level `zone`, else
     the first roster row's; "" when none is held, never UTC in its place. */
  copyZone: function (copy) {
    const rows = copy && Array.isArray(copy.grants) ? copy.grants : [];
    const own = copy && typeof copy.zone === "string" && copy.zone ? copy.zone : null;
    const held = own || (rows.find(function (g) { return g && typeof g.zone === "string" && g.zone; }) || {}).zone || "";
    return { zone: typeof held === "string" ? held : "" };
  },

  /* R27: the zone drawn as the browser names it: its generic name and its city (a zone with no key of its own). */
  zoneName: function (zone) {
    const city = String(zone).split("/").pop().replace(/_/g, " ");
    let generic = "";
    try {
      const p = new Intl.DateTimeFormat("en-US", { timeZone: String(zone), timeZoneName: "longGeneric" }).formatToParts(new Date())
        .find(function (x) { return x.type === "timeZoneName"; });
      generic = p ? p.value : "";
    } catch (e) { generic = ""; }
    return generic && generic !== city ? generic + ", " + city : city;
  },

  /* R27: the wall-clock time `HH:MM` of `instant` in `zone`; "" when either is unusable. */
  localTime: function (instant, zone) {
    const t = Date.parse(String(instant || ""));
    if (isNaN(t) || !zone) return "";
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: String(zone), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
    } catch (e) { return ""; }
  },

  /* R41 (DEC-299): a wall-clock time `HH:MM` on the 12-hour clock, as `time.clock` writes it (midnight 12:00 AM, noon 12:00 PM);
     "" when it is no time of day. */
  clock: function (cs, hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    if (!m || +m[1] > 23 || +m[2] > 59) return "";
    const h = +m[1];
    return cs.w("time.clock", { hour: String(h % 12 || 12), minute: m[2], ampm: cs.w(h < 12 ? "time.am" : "time.pm") });
  },

  /* R27: the end of a review link as `screen.review-outside.until.zone` says it (date, time and zone in the team's zone);
     "" when the zone or the instant is not held (no UTC is drawn in its place). */
  untilIn: function (cs, view, until, zone) {
    const P = view.parts, day = P.localDay(until, zone), time = P.localTime(until, zone);
    if (!day || !time) return "";
    return cs.w("screen.review-outside.until.zone", { date: { html: cs.date(day) }, time: { html: P.clock(cs, time) }, zone: P.zoneName(zone) });
  },

  /* A date and time the member typed, `YYYY-MM-DD` and `HH:MM`, as `publishat` and `publishatmove` take them; null when
     either is malformed. */
  at: function (date, time) {
    const d = String(date || "").trim(), t = String(time || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}$/.test(t) ? { date: d, time: t } : null;
  },

  /* A section whose heading is explained by several sentences, each its own key, in order (R37, R38, R43). */
  secTips: function (cs, key, inner, helpKeys) { return cs.sec(key, inner, { help: helpKeys }); },

  /* R20: a section that holds nothing is not drawn. */
  sec: function (cs, key, inner, o) { return inner ? cs.sec(key, inner, o) : ""; },

  /* R20: a later read's list, drawn only when it holds something: loading and failed are drawn as they are (interface-shell
     R10); an empty read draws nothing. */
  listed: function (cs, r, draw) { return r && r.state === "empty" ? "" : cs.state(r, draw); },

  /* R18: the end of the local day `date` (`YYYY-MM-DD`) in the IANA zone `zone`, as an instant in the record's stamp form
     (`YYYY-MM-DDTHH:MM:SSZ`, UTC); null when the date is no calendar day or the zone is unknown. */
  endOfDay: function (date, zone) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
    if (!m || !zone) return null;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
    if (new Date(wall).getUTCDate() !== +m[3]) return null;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-US", { timeZone: String(zone), hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric" });
    } catch (e) { return null; }
    const offsetAt = function (ms) {
      const p = {};
      fmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
    };
    let t = wall - offsetAt(wall);
    t = wall - offsetAt(t);
    return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  },

  /* R18: the local day (`YYYY-MM-DD`) in `zone` on which `instant` falls; "" when either is unusable. */
  localDay: function (instant, zone) {
    const t = Date.parse(String(instant || ""));
    if (isNaN(t) || !zone) return "";
    try {
      const p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: String(zone), year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
      return p.year + "-" + p.month + "-" + p.day;
    } catch (e) { return ""; }
  },

  /* R50 (C1; `case-authoring` R78): what the ceremony's requests name: the draft and the project. The findings, the case and the
     authored words are the draft's and are never sent again; only what the member attested in this step is added. */
  caseArgs: function (copy, draft) {
    return { draft: draft, project: copy && copy.project };
  },
  /* R44, R46, R50, R51 (C1, C2, C5, C6; DEC-376, DEC-377): what the member attested in this step, read from its controls when the act
     is pressed: the contradictions ticked, each with her words (`tensionsDisclosed`); the documents listed as self-attested only, each
     with the reason it requires (`selfAttested`); and the declared bias for this edition (`biasAcknowledgement`). `body` holds only what
     was given, so a request names nothing else; `held` is what the controls show again after a redraw. `refuse` is the word key of
     the reason a ticked document lacks. */
  attested: function (view, cs) {
    const ui = view.ui, listOf = function (v) { return Array.isArray(v) ? v : []; };
    const body = {}, held = { disc: [], words: {}, sa: [], why: {}, bias: "" };
    const tens = ui.tensionIds || [], docs = ui.confIds || [];
    listOf(cs.value("ce-disc")).forEach(function (id) {
      const i = tens.indexOf(id), words = i < 0 ? "" : String(cs.value("ce-dw-" + i) || "").trim();
      held.disc.push(id);
      if (words) held.words[id] = words;
    });
    if (held.disc.length) body.tensionsDisclosed = held.disc.map(function (id) { return held.words[id] ? { candidate: id, words: held.words[id] } : { candidate: id }; });
    let refuse = null;
    listOf(cs.value("ce-sa")).forEach(function (sha) {
      const i = docs.indexOf(sha), why = i < 0 ? "" : String(cs.value("ce-sar-" + i) || "").trim();
      held.sa.push(sha);
      held.why[sha] = why;
      if (!why) refuse = "screen.ceremony.conf.refused.noreason1";
    });
    if (held.sa.length) body.selfAttested = held.sa.map(function (sha) { return { capture: sha, reason: held.why[sha] }; });
    const bias = cs.value("ce-bias");
    if (typeof bias === "string" && bias.trim()) { held.bias = bias.trim(); body.biasAcknowledgement = held.bias; }
    return { body: body, held: held, refuse: refuse };
  },

  /* R60, R63 (L14; DEC-384): the heading of a draft is the short `title` `review` answers ("Case X, edition N", `review.title.draft` or
     `review.title.untitled`, already in the design's words), never the identity sentence, which is body text (`review.body.nocase`
     where the draft names no case). null when the copy states none. */
  titleOf2: function (cs, copy, fallback) {
    return copy && typeof copy.title === "string" && copy.title ? copy.title : fallback;
  },
  noCase: function (cs, copy, editions) {
    const c = copy && copy.case ? copy.case : {};
    // R80: a draft the record holds an edition of (prepared or published) is no draft that names no case
    const known = editions && (editions.prepared || editions.published);
    return copy && !c.case_id && !known ? '<p class="mk-sub" data-nocase>' + cs.w("review.body.nocase") + "</p>" : "";
  },

  /* C49 (DEC-394, DEC-395): the project's drafts as `casedrafts` lists them (oldest first), each with the review copy it answers: the one
     the screen shows reuses its own read (`chosenR`), every other draft is read once (`copy:<draft>`, page memory, read again after an
     act). Each entry is `{draft, r}`, `r` in R10's four states. */
  draftCopies: function (cs, view, drafts, chosenId, chosenR) {
    const P = view.parts;
    const shown = function (x) { return x.draft_id === chosenId && chosenR; };
    // G12c (fix round 6): the copies of the other drafts are read in one `reviewcopy` (`drafts`, their ids comma-joined, at most 20 to a
    // read), not one each; a lone other draft is the single read it was
    const rest = drafts.filter(function (x) { return !shown(x); }).map(function (x) { return x.draft_id; });
    const got = {};
    if (rest.length > 1) for (let i = 0; i * 20 < rest.length; i++) {
      const ids = rest.slice(i * 20, i * 20 + 20), b = P.later(cs, view, "copies:" + i, "reviewcopy", { query: { drafts: ids.join(",") } });
      ids.forEach(function (id) { got[id] = P.copyIn(cs, view, b, id); });
    }
    return drafts.map(function (x) {
      return { draft: x, r: shown(x) ? chosenR : got[x.draft_id] || P.later(cs, view, "copy:" + x.draft_id, "reviewcopy", { query: { draft: x.draft_id } }) };
    });
  },

  /* G12c: one draft's copy out of a batch read (`{ok, kind: "review-copies", count, copies: {<id>: the single answer}}`), in R10's four states: the
     batch while it waits or has failed; an id it does not answer, or answers with a refusal, is failed, as the single read of it is. */
  copyIn: function (cs, view, b, id) {
    if (b.state !== "ok") return b;
    const all = b.value && typeof b.value === "object" && b.value.copies && typeof b.value.copies === "object" ? b.value.copies : {};
    const a = all[id];
    if (a && typeof a === "object" && a.ok !== false) return { state: "ok", value: a, refusal: null };
    const f = a && typeof a === "object" ? a : {};
    return { state: "failed", value: null, fields: f, refusal: { code: String(f.code || f.reason || ""), words: view.parts.refusalText(cs, f) || cs.w("shell.unread") } };
  },

  /* C49: the review links still working on a draft's copy: the plane's own `live`, else a grant that is neither stopped nor lapsed. */
  liveGrants: function (cs, copy) {
    return (copy && Array.isArray(copy.grants) ? copy.grants : []).filter(function (g) {
      if (!g || typeof g !== "object") return false;
      if (g.live === true) return true;
      if (g.live === false || g.revoked_at || g.revokedAt) return false;
      return !(typeof g.until === "string" && g.until && Date.parse(g.until) <= cs.now());
    });
  },

  /* C49 (DEC-395): one draft named by its scope and the day it was prepared (`screen.<screen>.drafts.item`, both record data), as plain
     text. The scope is the draft's own (its copy's `authored.scope`); a draft that states none is named as an untitled draft of the
     project, never by an id. */
  draftLine: function (cs, view, screen, e, projectTitle) {
    const P = view.parts, v = e.r.state === "ok" && e.r.value && typeof e.r.value === "object" ? e.r.value : null;
    const said = v && v.authored && typeof v.authored.scope === "string" ? v.authored.scope.trim() : "";
    const when = e.draft.created_at || e.draft.updated_at || "";
    return P.plain(cs.w("screen." + screen + ".drafts.item", { scope: said || P.plain(cs.w("case.draft.untitled", { project: projectTitle })), date: { html: when ? cs.date(when) : "" } }));
  },

  /* C49 (DEC-394): "Which draft": a chooser among the project's drafts, the newest first and marked, the one shown chosen, drawn only
     where there is a choice (two drafts or more) and once every draft's scope is read (a scope is never guessed). The registry's act
     `casedrafts` follows the choice (`pickDraft`). */
  draftChooser: function (cs, view, screen, list, chosenId, projectTitle) {
    const P = view.parts;
    if (list.length < 2) return "";
    const waiting = list.find(function (e) { return e.r.state === "loading"; });
    if (waiting) return cs.state(waiting.r, function () { return ""; });
    const newest = list[list.length - 1].draft.draft_id, acts = {};
    const options = list.slice().reverse().map(function (e) {
      acts[e.draft.draft_id] = "casedrafts";
      return { value: e.draft.draft_id, text: P.draftLine(cs, view, screen, e, projectTitle) + (e.draft.draft_id === newest ? " · " + P.plain(cs.w("screen." + screen + ".drafts.newest")) : "") };
    });
    return '<div data-drafts-chooser>' + cs.choice("drafts-" + screen, "act.casedrafts.label." + screen, options, { value: chosenId, acts: acts })
      + '<p class="mk-small">' + cs.w("screen." + screen + ".drafts.help") + " " + cs.w("screen." + screen + ".drafts.choose") + "</p>" + P.said(view, "casedrafts") + "</div>";
  },

  /* C49: "Which draft" pressed: the draft chosen is opened in the same screen, its address `<project>/<draft>`; the one already shown,
     or one the plane no longer lists, stays. */
  pickDraft: function (view, answer, cs, screen) {
    const P = view.parts;
    if (P.refused(cs, view, "casedrafts", answer)) return { stay: true };
    const r = P.value(answer) || {}, pick = view.ui.pickDraft;
    const here = view.ui.draft ? view.ui.draft.draft_id : view.ui.draftId || "";
    if (!pick || pick === here || !(Array.isArray(r.drafts) && r.drafts.some(function (x) { return x && x.draft_id === pick; }))) { P.forget(view); return { stay: true }; }
    cs.go(screen, String(view.subject || "").split("/")[0] + "/" + pick);
  },

  /* R80 (C48/N6; case-authoring R83, review R19): what the record holds for a draft: "Published: edition n" with the address of that edition
     (the case page's route, written as `hrefOf` writes it: one encoded part), else "Edition n is prepared". Nothing for a draft the record
     says neither of; the case it belongs to is the record's own (`editions.case`) or the draft's. */
  editionsLine: function (cs, view, draft) {
    const ed = draft && draft.editions && typeof draft.editions === "object" ? draft.editions : null;
    if (!ed) return "";
    const id = typeof ed.case === "string" && ed.case ? ed.case : draft.case && draft.case.case_id ? draft.case.case_id : "";
    const pub = ed.published && Number(ed.published.edition) > 0 ? Number(ed.published.edition) : 0;
    if (pub && id) return '<p role="status" data-published="' + pub + '">' + cs.w("screen.ceremony.published.edition", { n: String(pub) }) + ' <a href="/app/published/'
      + encodeURIComponent(id + "/" + pub) + '" data-nav data-published-link>' + cs.w("screen.ceremony.publicpage") + "</a></p>";
    return !pub && Number(ed.prepared) > 0 ? '<p role="status" data-prepared="' + Number(ed.prepared) + '">' + cs.w("screen.ceremony.prepared", { edition: String(Number(ed.prepared)) }) + "</p>" : "";
  },

  /* C49 (R73): under the heading, the draft the page shows named by its scope and the day it was prepared, drawn where the project has two
     drafts or more and once that draft's own copy is read (a scope is never guessed). */
  draftHead: function (cs, view, screen, list, chosenId, projectTitle) {
    const e = list.length > 1 ? list.find(function (x) { return x.draft.draft_id === chosenId; }) : null;
    return e && e.r.state === "ok" ? '<p class="mk-sub" data-draft-head>' + cs.esc(view.parts.draftLine(cs, view, screen, e, projectTitle)) + "</p>" : "";
  },

  /* C49 (DEC-394, DEC-395): beneath the chooser, how many review links are live and how many sit on an earlier draft than the newest, as
     a way to the review copy, where each is stopped. Not drawn where none sits on an earlier draft (no count at zero, R20). */
  liveNote: function (cs, view, screen, list) {
    const P = view.parts;
    if (list.length < 2) return "";
    const newest = list[list.length - 1].draft.draft_id;
    let count = 0, earlier = 0;
    list.forEach(function (e) {
      if (e.r.state !== "ok") return;
      const n = P.liveGrants(cs, e.r.value).length;
      count += n;
      if (e.draft.draft_id !== newest) earlier += n;
    });
    return earlier ? '<p class="mk-small" data-live-links>' + cs.ref("review-copy", String(view.subject || "").split("/")[0],
      P.plain(cs.w("screen." + screen + ".links.live", { count: String(count), earlier: String(earlier) })), []) + "</p>" : "";
  },

  /* R2, R18, R27: what one grant lets its reader do, as the roster says it: until the end day in the team's zone, ended, or until the
     member stops it. `{says, state}`, state `until`, `ended` or `open`. */
  grantLine: function (cs, view, g, edition, held) {
    const P = view.parts;
    const until = typeof g.until === "string" && g.until ? g.until : "";
    const zone = typeof g.zone === "string" && g.zone ? g.zone : held;
    const ended = until && Date.parse(until) <= cs.now();
    const day = until ? P.localDay(until, zone) || until : "";
    const says = !until ? cs.w("screen.review-copy.reads.stop", { edition: edition })
      : ended ? cs.w("screen.review-copy.reads.ended", { edition: edition, until: { html: cs.date(day) } })
        : P.untilIn(cs, view, until, zone) || cs.w("screen.review-copy.reads.until", { until: { html: cs.date(day) } });
    return { says: says, state: ended ? "ended" : until ? "until" : "open" };
  },

  /* C49 (DEC-394): "Every live review link": the links still working on any draft of the project, each with the draft it is on (by its
     scope and date), what it lets the reader do, and "Stop sharing". Drawn where the project has several drafts and some link is live:
     with one draft the roster is the list. */
  liveLinks: function (cs, view, screen, list, projectTitle) {
    const P = view.parts;
    if (list.length < 2) return "";
    const rows = [];
    list.slice().reverse().forEach(function (e) {
      if (e.r.state !== "ok") return;
      const copy = e.r.value, c = copy.case || {}, held = P.copyZone(copy).zone;
      P.liveGrants(cs, copy).forEach(function (g) {
        const line = P.grantLine(cs, view, g, String(c.edition || ""), held);
        rows.push(cs.row("", "<b>" + cs.esc(g.recipient || "") + '</b><span class="meta mk-data">' + cs.esc(P.draftLine(cs, view, screen, e, projectTitle)) + "</span>",
          '<span class="meta">' + line.says + "</span>", cs.act("reviewrevoke", { data: { grant: g.grant_id || g.grantId || "" } })));
      });
    });
    return rows.length ? cs.sec("screen.review-copy.links.heading", cs.sheet(rows.join("")) + '<p class="mk-note">' + cs.w("screen.review-copy.links.note") + "</p>", { help: "screen.review-copy.links.help" }) : "";
  },

  /* the findings a review copy names (a draft that names none cannot be published, R66) */
  findingsOf: function (copy) { return (copy && Array.isArray(copy.findings) ? copy.findings : []).map(function (f) { return f.target; }).filter(Boolean); },

  /* E4 (fix round 5; publication `casedocument`'s `findings`; case-grammar R4, R6): `casedocument` answers `citations` as `{state, rows}`
     (never an array) and the roster the signed document pins as `findings`, `[{target, version_sha, role}]`. `rosterOf` is that roster as
     `[{target, bundleSha}]`, null when the answer states none, an entry with no full SHA-256 left out. */
  rosterOf: function (doc) {
    if (!doc || !Array.isArray(doc.findings)) return null;
    return doc.findings.filter(function (f) { return f && typeof f.target === "string" && f.target && /^[0-9a-f]{64}$/.test(String(f.version_sha || "")); })
      .map(function (f) { return { target: f.target, bundleSha: f.version_sha }; });
  },

  /* What one sitting signs (interface-shell R41; ratification R52; this module's R13): the case statement `casedocument`
     answers, one `bio-ratify <id> <sha>` line per finding the edition pins (the document's own roster, else what `publish`
     answered), and one per piece of evidence the signed document cites (`citations.rows`' `{target, version}`), each once and
     none a finding already. */
  sitting: function (doc, prepared) {
    if (!doc || !doc.sign || typeof doc.sign.statement !== "string") return null;
    const list = [{ kind: "case", id: doc.case_id, edition: doc.edition, sha: doc.doc_sha, text: doc.sign.statement, namespace: doc.sign.namespace || "bio-ratify" }];
    const seen = {};
    const pins = Array.isArray(doc.findings) ? doc.findings.filter(function (f) { return f && typeof f.target === "string" && /^[0-9a-f]{64}$/.test(String(f.version_sha || "")); })
      .map(function (f) { return { target: f.target, bundleSha: f.version_sha }; }) : null;
    const findings = pins || (prepared && Array.isArray(prepared.findings) ? prepared.findings : []);
    findings.forEach(function (f) {
      if (!f || !f.target || !f.bundleSha || seen[f.target]) return;
      seen[f.target] = true;
      list.push({ kind: "finding", id: f.target, sha: f.bundleSha, text: "bio-ratify " + f.target + " " + f.bundleSha + "\n", namespace: "bio-ratify" });
    });
    // G29 (fix round 6; K4609, `case-authoring` R86): a document the case rests on is signed at its head, the `bundle_sha` its row carries
    // (ratification verifies `ratifyStatement(id, head)`, R4/R52); nothing is signed from `version` (a classification word) or `capture`
    (doc.citations && Array.isArray(doc.citations.rows) ? doc.citations.rows : []).forEach(function (c) {
      const id = c && c.target, sha = c && c.bundle_sha;
      if (!id || typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha) || seen[id]) return;
      seen[id] = true;
      list.push({ kind: "evidence", id: id, sha: sha, text: "bio-ratify " + id + " " + sha + "\n", namespace: "bio-ratify" });
    });
    return list;
  },

  /* E4 (fix round 5, C48): the Sign step fails closed. True when the sitting lists fewer findings than the document pins, or none while
     the draft names findings (`named`, their count) or the document pins some: an edition signed with its findings missing publishes an
     incomplete case, and that cannot be taken back. */
  sittingGap: function (doc, list, named) {
    const listed = (list || []).filter(function (x) { return x.kind === "finding"; }).length;
    const pinned = doc && Array.isArray(doc.findings) ? doc.findings.length : 0;
    return listed < pinned || (listed === 0 && named > 0);
  },

  /* C47, G29 (public-read R39; K4609): the documents the edition's document cites that cannot be signed with it, by target, each once: a
     document row (`version` other than `no_bytes`, which is a finding's or question's edge) that carries no `bundle_sha`, such as an edition
     prepared before rows carried it. A finding of the edition is never one. */
  unsignable: function (doc, prepared) {
    const pinned = {}, seen = {}, out = [];
    const roster = doc && Array.isArray(doc.findings) ? doc.findings : prepared && Array.isArray(prepared.findings) ? prepared.findings : [];
    roster.forEach(function (f) { if (f && f.target) pinned[f.target] = true; });
    (doc && doc.citations && Array.isArray(doc.citations.rows) ? doc.citations.rows : []).forEach(function (c) {
      const id = c && c.target;
      if (!id || pinned[id] || seen[id] || c.version === "no_bytes") return;
      seen[id] = true;
      if (!/^[0-9a-f]{64}$/.test(String(c.bundle_sha || ""))) out.push(id);
    });
    return out;
  },

  /* The UTF-8 bytes of a statement the member's key signs (interface-shell R41's `{label, bytes, namespace}`). */
  bytes: function (text) { return new TextEncoder().encode(String(text)); },

  /* R1, R61 (fix round 3, C46; `review` R41): a finding of a draft's copy in its own words: its title, then its statement and what would
     change it; a finding the team has not concluded says so in the plane's own sentence; never the file's text once the answer states
     whether it is concluded, never a heading, a log or an id. `o.text` lets the member's own editor, for an older answer that states no
     `concluded`, fall back on the section's text; the outside reader never draws it (R61). A finding nothing is known of draws what the
     plane says of it (`detail`), else its target. HTML. */
  findingWords: function (cs, f, o) {
    const title = typeof f.title === "string" && f.title.trim() ? "<b>" + cs.esc(f.title.trim()) + "</b> " : "";
    const str = function (v) { return typeof v === "string" && v.trim() ? v.trim() : ""; };
    if (f.concluded === false) return title + '<span class="muted" data-notconcluded>' + (str(f.not_concluded) ? cs.esc(f.not_concluded) : cs.w("review.index.not_concluded_yet")) + "</span>";
    const words = str(f.statement) || (o && o.text && (f.concluded === undefined || f.concluded === null) ? str(f.text) : "");
    if (!words && !title) return '<span class="rec">' + cs.esc(str(f.detail) || str(f.target)) + "</span>";
    const why = str(f.falsifier);
    return title + (words ? '<span class="rec">' + cs.esc(words) + "</span>" : "")
      + (why ? '<span class="meta" data-falsifier>' + cs.w("question.concluded.falsifier", { falsifier: why }) + "</span>" : "");
  },

  /* C51 (R72): an act's progress line removed once the work it spoke of has ended. */
  unsay: function (cs, view, key) {
    if (view.ui.said && view.ui.said[key]) { delete view.ui.said[key]; cs.set("said", view.ui.said); }
  },

  /* R12, R13, R72 (fix round 3, C51): one sitting of the member's key over `list` (interface-shell R41's statements). With no key held in this
     browser and a key file chosen on the Sign step, the file is read by the kit (`cs.keyFile`) and put in the sign dialog's own box, so the
     member types only the passphrase; an unreadable or empty file is refused in the kit's word and nothing is asked of the device; with no
     file chosen the dialog is as it was. `{signed}` is the signer's answer, or `{refuse}` a word key. */
  sitSign: async function (cs, view, list) {
    // R116 (interface-shell): the key file's text is handed to the signer with the statements, which asks only the passphrase
    let keyFile;
    if (view.ui.keyHeld === false) {
      const k = await cs.keyFile("ce-keyfile");
      if (k.ok) keyFile = k;
      else if (k.word !== "shell.keyfile.none") return { refuse: k.word };
    }
    return { signed: await (keyFile ? cs.signer.sign(list, { keyFile: keyFile }) : cs.signer.sign(list)) };
  },

  /* R2, R62 (fix round 3, C94): a comment's or acknowledgement's author: the name an outside reader was given by the grant, as it is;
     a member by handle, never by the member id (interface-shell R111). */
  whoWas: function (cs, name, member) {
    return typeof name === "string" && name.trim() ? name : member ? cs.memberName(member) : "";
  },
});
