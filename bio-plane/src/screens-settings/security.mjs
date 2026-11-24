/* screens-settings R15 (N897 (1); N703, its share; N710; DEC-165, DEC-166, DEC-168, DEC-169): Settings › Security, an
   administrator's screen; any other member is told only that it is administrators'. The level over the period the
   administrator chooses (`securitymap`, credentials R45, read again by "Show the level for a period"), drawn by kind
   against its usual, naming no address, country, role or member; what is built in, said only as `bootstrap`'s
   `part_scanner` and `part_safe_view` answer it (instance-setup R82; setup-page R30's rule); the scanner's queue
   (`scanstatus`); the tools held (`securitytools`) and what happened to them (`securitytoolevents`); and the catalogue
   (`securitytoolcatalogue`), each entry's panel showing what the tool is sent and keeps, asking only what its `config`
   lists by its labels, its credentials in the request's body only and never drawn again, the vendor's keeping of files
   confirmed where it keeps them, "every file" offered only for a tool on the organization's own servers, and the shown
   handling's digest sent (`securitytooladd`, file-safety R28), then tested (`securitytooltest`), saying whether it is
   on or why it stays off. Every refusal is the owner's own words. Every function is self-contained (interface-shell
   R21).
   T50 (R43; U3; DEC-291, DEC-323): the screen leads with how things stand under its mark; the counts fold; the catalogue of
   outside-tool kinds is drawn only inside the fold "Add another checker"; a period is named by its first and last day, both
   included, and may end today (`to` the end of the present hour then). A member who does not administer reads only the
   administrators (`memberlist`) to be told whose screen it is.
   T51 FR-25 (R74, R77; T-14, K4213; DEC-384): a credential field is labelled by `file-scanner.credential.<field>` for the four names the
   catalogue lists (`client_id`, `client_secret`, `api_key`, `api_secret`), the field sent staying the catalogue's own; and a scanner
   that holds no signatures is said so, by the key and words `scanstatus` answers (`no_signatures`), never drawn as "waiting".
   T51 fix round 3 (C83, C84; file-safety R46, R49): the administrator's step is said once, in the reason line's own sentence, and on its own
   only where no reason line is drawn; a button asks the scanner to check for new signatures now (`scanmirror`), draws that a run was started and
   reads the state again, a refusal beside it in file-safety's words. */

export const security = {
  id: "security",

  reads(view) {
    // anyone else is told whose screen it is, by the administrators' handles (the roster a member reads)
    if (!(view.me && view.me.administer === true)) return { roster: { op: "memberlist" } };
    const ui = view.ui || {};
    // the period chosen, else the last seven days
    const to = ui.period ? ui.period.to : new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    const from = ui.period ? ui.period.from : new Date(Date.parse(to) - 7 * 86400000).toISOString();
    return {
      map: { op: "securitymap", query: { from, to } },
      boot: { op: "bootstrap" },
      scan: { op: "scanstatus" },
      tools: { op: "securitytools", empty: (v) => !(v.tools || []).some((t) => t.state !== "removed") },
      events: { op: "securitytoolevents", query: { limit: "50" }, empty: (v) => !(v.events || []).length },
      catalogue: { op: "securitytoolcatalogue", empty: (v) => !(v.offered || []).length },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.security.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const out = [cs.title()];
    const data = view.data || {};
    if (me.administer !== true) {
      // whose screen it is: the administrators' handles, the founder's as hers or `member.founder.unnamed` (R37: every fill filled)
      out.push(cs.state(data.roster, (v) => {
        const admins = (Array.isArray(v.members) ? v.members : []).filter((m) => m.role === "admin" && m.status === "active")
          .map((m) => (m.founder === true || m.member_id === "admin" ? m.handle || T("member.founder.unnamed") : m.handle || cs.memberName(m.member_id)));
        return admins.length ? `<p data-state="admins">${W(S + "admins", { admins: admins.join(", ") })}</p>` : "";
      }));
      return out.join("");
    }
    const ui = view.ui || {};
    const KINDS = ["signin", "credential", "rate", "handover", "through"];

    // how things stand, first (R43 (1)): the mark, then one sentence; the counts fold below it. A period is named by its first and last
    // day, both included (R43 (2)). Counts only: nothing names an address, country, role or member.
    const boot0 = data.boot && data.boot.state === "ok" ? data.boot.value : null;
    out.push(cs.sec(S + "level.heading", cs.state(data.map, (v) => {
      const t = v.totals || {};
      const sum = (k) => (v.buckets || []).reduce((n, b) => n + (Number(b.counts && b.counts[k]) || 0), 0);
      const usual = (k) => (v.buckets || []).reduce((n, b) => n + (Number(b.usual && b.usual[k]) || 0), 0);
      const lvl = ["Ordinary", "Raised", "High"].indexOf(v.level) >= 0 ? v.level.toLowerCase() : "ordinary";
      const last = new Date(Date.parse(v.to) - 1).toISOString();
      const days = W("period.days", { first: D(v.from), last: D(last) });
      const tip = lvl === "ordinary" ? W(S + "risk.means.ordinary") : W(S + "tip." + lvl);
      let h = `<p data-state="level"><span class="cs-risk" data-risk="${lvl}" tabindex="0" data-level="1" data-tip="${tip}">${W(S + "level." + lvl)}</span> ${W(S + "period", { from: D(v.from), to: D(last) })}</p>`;
      if (lvl === "ordinary") h += `<p>${W(S + "ordinary.head")}</p><p>${W(S + "ordinary.line", { period: days })}</p>`;
      else {
        // what happened and that it was refused, from the counts alone: said only where every fill is answered
        const hard = (v.buckets || []).filter((b) => Number(b.counts && b.counts.signin) > Number(b.usual && b.usual.signin));
        h += `<p>${W(S + "summary.signin", { when: D(v.levelAt || (hard[0] && hard[0].start) || v.from) })}</p>`;
        if (hard.length && usual("signin") > 0) h += `<p>${W(S + "summary.detail", { times: Math.max(1, Math.round(sum("signin") / usual("signin"))), from: D(hard[0].start), to: D(last), highfrom: D(v.levelAt || hard[0].start), highto: D(last) })}</p>`;
      }
      // the files are checked, said once and only while the scanner is built in and holds signatures (R15's rule; C83): a scanner with none,
      // one that did not answer and one not bound claim nothing; the scanner's own state is told under the queue (R77)
      const sc0 = data.scan && data.scan.state === "ok" && data.scan.value && data.scan.value.ok !== false ? data.scan.value : null;
      if (boot0 && boot0.part_scanner === true && sc0 && !sc0.no_signatures && Number.isFinite(sc0.signatures_age_ms)) h += `<p data-state="files">${W(S + "files.on")}</p>`;
      const rows = KINDS.filter((k) => sum(k) > 0 || usual(k) > 0);
      const counts = (Number(t.count || 0) > 0 || Number(t.usual || 0) > 0 ? `<p>${W(S + "total", { count: Number(t.count || 0).toLocaleString("en"), usual: Number(t.usual || 0).toLocaleString("en") })}</p>` : "")
        + (rows.length ? `<table class="mk-table"><thead><tr><th>${W(S + "col.kind")}</th><th>${W(S + "col.count")}</th><th>${W(S + "col.usual")}</th></tr></thead><tbody>${rows.map((k) => `<tr><td>${W(S + "kind." + k)}</td><td>${E(sum(k).toLocaleString("en"))}</td><td>${E(usual(k).toLocaleString("en"))}</td></tr>`).join("")}</tbody></table>` : "");
      return h + (counts ? `<details class="mk-details" data-fold="counts"><summary>${W(S + "counts.fold")}</summary>${counts}</details>` : "");
    }) + `${ui.periodBad ? `<details class="mk-details" open data-state="periodbad"><summary>${W(S + "period.bad.summary")}</summary><p>${W(S + "period.bad")}</p></details>` : ""}${cs.field("se-from", S + "from", { type: "date" })}${cs.field("se-to", S + "to", { type: "date" })}${cs.act("securitymap")}`));

    // what is built in, as the plane answers it, and the scanner's queue
    out.push(cs.sec(S + "parts.heading", cs.state(data.boot, (b) => {
      const part = (v, key, name) => (v === true ? W("instance.part." + key + ".present") : v === false ? W("instance.part." + key + ".absent") : W("instance.part.unknown", { part: T(S + "part." + name) }));
      // a scanner that is built in is said once, in the lead (`screen.security.files.on`)
      let h = `${b.part_scanner === true ? "" : `<p data-state="scanner">${part(b.part_scanner, "scanner", "scanner")}</p>`}<p data-state="safeview">${part(b.part_safe_view, "safeview", "safeview")}</p>`;
      if (b.part_scanner === false) h += `<p>${W("instance.scanner.absent.step")}</p>`;
      if (b.part_scanner === true) {
        const sc = data.scan && data.scan.state === "ok" ? data.scan.value : null;
        if (sc && (Number(sc.queued || 0) > 0 || Number(sc.held || 0) > 0)) h += `<p data-state="queue">${W(S + "queue", { queued: Number(sc.queued || 0), held: Number(sc.held || 0) })}</p>`;
        // R77 (file-safety R46): a scanner that holds no signatures, said by the key `scanstatus` answers and its fills, else by the answer's own words
        const ns = sc && sc.no_signatures && typeof sc.no_signatures === "object" ? sc.no_signatures : null;
        if (ns) {
          // the key's word where the list holds it and every fill is answered; else the answer's own words (the shell draws a key the list lacks as the key)
          const said1 = (key, words, fills) => { const t = typeof key === "string" ? String(W(key, fills)) : ""; return t && t !== E(key) && !/\{\w+\}/.test(t) ? t : typeof words === "string" ? E(words) : ""; };
          // the status of the refusal the answer's `reason` holds (C84): the old `REFUSED:<db>:<status>`, or the updater's lines
          // (`MIRROR_REFUSED:exit N: …`) naming an HTTP status as file-safety R46 reads it (never the exit code, a version or a count)
          const reason = String(ns.reason || "");
          const status = /^REFUSED:[^:]*:(\d{3})$/.exec(reason)
            || (/^MIRROR_REFUSED\b/.test(reason) && (() => { const f = /(?:error code|status(?: code)?|http\/?[\d.]*|code)\s*[:=]?\s*([1-5]\d{2})(?!\d)|\(([1-5]\d{2})\)/i.exec(reason.replace(/^MIRROR_REFUSED:exit \d+:/, "")); return f ? [null, f[1] || f[2]] : null; })())
            || null;
          const first = said1(ns.key, ns.words, ns.since ? { date: D(ns.since) } : {});
          const second = typeof ns.reason_key === "string" ? said1(ns.reason_key, ns.reason_words, status ? { status: status[1] } : {}) : "";
          if (first) h += `<p data-state="nosignatures">${first}</p>`;
          // the administrator's step is said once (C83): file-safety's reason lines carry it in their own sentence, so it is drawn on its own
          // only where no reason line is drawn
          if (second) h += `<p data-state="nosignatures-reason">${second}</p>`;
          else h += `<p data-state="nosignatures-next">${W(S + "nosignatures.next")}</p>`;
        }
        // C84: the button that checks for new signatures now (`scanmirror`, file-safety R49), beside the scanner's state, labelled and answered by the
        // design's own rows (DEC-412: `act.scanmirror.label.security`, `screen.security.mirror.started`)
        const mirror = cs.act("scanmirror", { label: "act.scanmirror.label.security" });
        if (mirror) h += `<div data-form="mirror">${mirror}${ui.mirror ? `<p data-state="mirror">${W(S + "mirror.started")}</p>` : ""}</div>`;
      }
      return h;
    })));

    // a tool is named by its provider's display name (vendor and product, from the catalogue), never by its slug; with the catalogue unread, by the column's word
    const cv = data.catalogue && data.catalogue.state === "ok" && data.catalogue.value ? data.catalogue.value : {};
    const known = [].concat(cv.offered || [], cv.held || [], cv.refused || []).filter((x) => x && x.provider_id);
    const toolName = (id) => { const c = known.find((x) => x.provider_id === id); return c && (c.vendor || c.product) ? E([c.vendor, c.product].filter(Boolean).join(" · ")) : W(S + "col.tool"); };
    // the tools held: each row's acts in its panel
    if (!data.tools || data.tools.state !== "empty" || ui.tested) out.push(cs.sec(S + "tools.heading", (ui.tested ? `<p data-shown="tested">${W(ui.tested.on ? S + "tested.on" : S + "tested.off", { detail: ui.tested.detail || "" })}</p>` : "") + cs.state(data.tools, (v) => cs.rows({
      id: "tools", cols: [S + "col.tool", S + "col.state", S + "col.added"], items: (v.tools || []).filter((t) => t.state !== "removed"), key: (t) => t.tool_id, name: (t) => toolName(t.provider_id),
      cells: (t) => [toolName(t.provider_id), W(S + "state." + (["added", "on", "test_failed", "off"].indexOf(t.state) >= 0 ? t.state : "added")) + (t.use === "routine" ? " · " + W(S + "every.on") : ""), E(D(t.added_at))],
      acts: (t) => cs.act("securitytooltest", { data: { tool: t.tool_id } }) + cs.act("securitytoolremove", { data: { tool: t.tool_id } }),
    }), { empty: S + "tools.none" })));

    // what happened to them: a tool is named here as in its row, by its provider's display name; its id carries its provider's slug, so it is never drawn
    const heldTools = data.tools && data.tools.state === "ok" && data.tools.value && Array.isArray(data.tools.value.tools) ? data.tools.value.tools : [];
    const eventTool = (id) => { const t = heldTools.find((x) => x.tool_id === id), c = t && known.find((x) => x.provider_id === t.provider_id); return c && (c.vendor || c.product) ? [c.vendor, c.product].filter(Boolean).join(" · ") : T(S + "col.tool"); };
    if (!data.events || data.events.state !== "empty") out.push(cs.sec(S + "events.heading", cs.state(data.events, (v) => `<ul class="mk-list">${(v.events || []).map((e) => `<li>${W(S + "event." + (["added", "test_passed", "test_failed", "removed", "switched_off"].indexOf(e.event) >= 0 ? e.event : "added"), { tool: eventTool(e.tool_id) })} · ${cs.date(e.at, { year: true })}${e.reason ? ` · <span class="rec">${E(e.reason)}</span>` : ""}</li>`).join("")}</ul>`, { empty: S + "events.none" })));

    // the catalogue: each entry's panel says what the tool is sent and keeps, then asks what its config lists
    if (!data.catalogue || data.catalogue.state !== "empty") out.push(`<details class="mk-details" data-fold="add"><summary>${W(S + "add.fold")}</summary>${cs.sec(S + "catalogue.heading", cs.state(data.catalogue, (v) => cs.rows({
      id: "catalogue", cols: [S + "col.tool", S + "col.does"], items: v.offered || [], key: (t) => t.provider_id, name: (t) => E(t.vendor + " " + t.product),
      cells: (t) => [E(t.vendor + " · " + t.product), (t.kinds || []).map((k) => W(S + "does." + (["scan", "cdr", "sandbox", "url_reputation", "log_sink"].indexOf(k) >= 0 ? k : "scan"))).join(", ")],
      acts: (t) => {
        const add = cs.act("securitytooladd", { data: { provider: t.provider_id } });
        if (!add) return "";
        const h = t.handling || {};
        const p = "sa-" + String(t.provider_id).replace(/[^A-Za-z0-9_-]/g, "_");
        const list = (x) => (Array.isArray(x) ? x.join(", ") : String(x === undefined || x === null ? "" : x));
        let f = `<dl class="mk-dl" data-handling="${E(t.provider_id)}"><dt>${W(S + "h.sends")}</dt><dd>${E(list(h.sends))}</dd><dt>${W(S + "h.never")}</dt><dd>${E(list(h.never_sends))}</dd><dt>${W(S + "h.recipient")}</dt><dd>${E(list(h.recipient))}</dd><dt>${W(S + "h.region")}</dt><dd>${E(list(h.region))}</dd><dt>${W(S + "h.files")}</dt><dd>${E(list(h.file_retention))}</dd><dt>${W(S + "h.results")}</dt><dd>${E(list(h.result_retention))}</dd><dt>${W(S + "h.sharing")}</dt><dd>${W(S + "sharing." + (["none", "vendor_internal_research", "third_parties", "public"].indexOf(h.sample_sharing) >= 0 ? h.sample_sharing : "none"))}</dd></dl>`;
        f += `<div>`;
        if (t.template) f += cs.field(p + "-host", S + "host", { autocomplete: "off" });
        // a field named by the catalogue's own label (record data, a word's fill, so escaped and never read as a key)
        for (const c of Array.isArray(t.config) ? t.config : []) if (c && c.name) f += cs.field(`${p}-c-${c.name}`, c.required ? S + "field" : S + "field.optional", { fills: { label: c.label || c.name }, autocomplete: "off" });
        // R74: the label of a credential field is its word where the design holds one (the four names); any other is its own name
        const credLabel = (k) => { if (["client_id", "client_secret", "api_key", "api_secret"].indexOf(k) < 0) return k; try { return T("file-scanner.credential." + k); } catch (e) { return k; } };
        for (const k of Array.isArray(t.credentials) ? t.credentials : []) f += cs.field(`${p}-k-${k}`, S + "field", { type: "password", fills: { label: credLabel(k) }, autocomplete: "off" });
        if (h.sample_sharing === "vendor_internal_research") f += `<label for="${p}-keep"><input type="checkbox" id="${p}-keep">${W(S + "keep")}</label>`;
        if (h.on_own === true) f += `<label for="${p}-every"><input type="checkbox" id="${p}-every">${W(S + "every")}</label>`;
        return f + add + "</div>";
      },
    }), { empty: S + "catalogue.none" }))}</details>`);
    return out.join("");
  },

  acts: [
    // a read: the level for the period chosen. The last day named is included: `to` is the end of that day, or, when it is today, the end of
    // the present hour, the latest instant credentials R45 admits (R43). A start after the end is refused in place, nothing read.
    { op: "securitymap", rereads: ["map"],
      send(view, el, cs) {
        const from = String(cs.value("se-from") || ""), to = String(cs.value("se-to") || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { cs.set("periodBad", true); return null; }
        if (view.ui && view.ui.periodBad) cs.set("periodBad", false);
        const now = Date.now(), endOfDay = Date.parse(to + "T00:00:00.000Z") + 86400000, endOfHour = (Math.floor(now / 3600000) + 1) * 3600000;
        return { query: { from: from + "T00:00:00.000Z", to: new Date(Math.min(endOfDay, endOfHour)).toISOString() } };
      },
      done(view, answer, cs) { const a = answer && answer.result !== undefined ? answer.result : answer; if (a && a.from && a.to) cs.set("period", { from: a.from, to: a.to }); } },
    // the entry's config by its names, its credentials in the body only, its handling's digest, then tested at once
    { op: "securitytooladd", rereads: ["tools", "events", "scan"],
      // R119: a field the entry needs, left empty, is named before any reason is asked
      ready(view, el, cs) {
        const cat = view.data && view.data.catalogue && view.data.catalogue.value ? view.data.catalogue.value.offered || [] : [];
        const t = cat.find((x) => x.provider_id === el.dataset.provider);
        if (!t) return;
        const p = "sa-" + String(t.provider_id).replace(/[^A-Za-z0-9_-]/g, "_");
        for (const c of Array.isArray(t.config) ? t.config : []) if (c && c.name && c.required && !String(cs.value(p + "-c-" + c.name) || "").trim()) return { refuse: "screen.security.config.missing", fills: { field: c.label || c.name } };
        for (const k of Array.isArray(t.credentials) ? t.credentials : []) if (!String(cs.value(p + "-k-" + k) || "")) return { refuse: "screen.security.config.missing", fills: { field: k } };
        if (t.template && !String(cs.value(p + "-host") || "").trim()) return { refuse: "screen.security.config.missing", fills: { field: "host" } };
      },
      send(view, el, cs) {
        const cat = view.data && view.data.catalogue && view.data.catalogue.value ? view.data.catalogue.value.offered || [] : [];
        const t = cat.find((x) => x.provider_id === el.dataset.provider);
        if (!t) return null;
        const p = "sa-" + String(t.provider_id).replace(/[^A-Za-z0-9_-]/g, "_");
        const config = {}, credentials = {};
        for (const c of Array.isArray(t.config) ? t.config : []) {
          if (!c || !c.name) continue;
          const v = String(cs.value(p + "-c-" + c.name) || "").trim();
          if (v) config[c.name] = v; else if (c.required) return { refuse: "screen.security.config.missing", fills: { field: c.label || c.name } };
        }
        for (const k of Array.isArray(t.credentials) ? t.credentials : []) {
          const v = String(cs.value(p + "-k-" + k) || "");
          if (!v) return { refuse: "screen.security.config.missing", fills: { field: k } };
          credentials[k] = v;
        }
        const h = t.handling || {};
        const own = h.on_own === true;
        const body = { providerId: t.provider_id, config, credentials, handlingDigest: t.handling_digest, confirmRetention: cs.value(p + "-keep") === true, use: own && cs.value(p + "-every") === true ? "routine" : "on_request" };
        if (t.template) { const host = String(cs.value(p + "-host") || "").trim(); if (!host) return { refuse: "screen.security.config.missing", fills: { field: "host" } }; body.template = { host }; }
        return { body };
      },
      // tested at once: whether the tool is on, or why it stays off
      async done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (!a || !a.tool_id) return null;
        const t = await cs.call("securitytooltest", { body: { toolId: a.tool_id } });
        const r = t && t.result !== undefined ? t.result : t;
        cs.set("tested", { on: !!(r && r.ok === true && r.passed === true), detail: r ? r.detail || r.translation || r.reason || "" : "" });
        return null;
      } },
    { op: "securitytooltest", rereads: ["tools", "events"],
      send(view, el) { return { body: { toolId: el.dataset.tool } }; },
      done(view, answer, cs) { const r = answer && answer.result !== undefined ? answer.result : answer; cs.set("tested", { on: !!(r && r.passed === true), detail: r ? r.detail || "" : "" }); } },
    { op: "securitytoolremove", rereads: ["tools", "events"],
      send(view, el) { return { body: { toolId: el.dataset.tool } }; } },
    // C84 (file-safety R49): asks the scanner to start a signature run and answers at once; the state is read again, and a refusal (not an
    // administrator, no scanner, a run asked for under 15 minutes ago) is drawn beside the act in file-safety's own words
    { op: "scanmirror", rereads: ["scan"],
      send(view, el, cs) { cs.set("mirror", null); return { body: {} }; },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        cs.set("mirror", a && a.ok === true && a.state === "started" ? { state: "started" } : null);
      } },
  ],
};
