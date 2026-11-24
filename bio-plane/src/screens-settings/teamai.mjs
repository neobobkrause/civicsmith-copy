/* screens-settings R48 (T50; N1158, U6; DEC-284; DEC-188 (1), (7); amends R9, R26): Settings › The team's assistant, the registry's
   6 acts, administrators only. The team's API key (`groupkeyset`, then `groupkeyswitch` on; `groupkeyremove`), what it pays for
   and its limits (the AI account panel over `owner: "group"`, R9), its use summed over members, naming none, and keeping the
   team's material away from AI (`aikeepaway`, on only with a reason, saying first what it does). A card says how the key stands,
   with this month's meter on it (R26); the rest are parts that open and close (`.cs-part`), "Which account pays, and when"
   folded at the foot. These were Members' (R1, R2) until R47. A member who does not administer is told only that the page is
   administrators'. The key is sent in the request's body only and never drawn again (R10). Every function is self-contained
   (interface-shell R21). */

export const teamai = {
  id: "teamai",

  reads(view) {
    // the owners refuse these to a member who does not administer (ai-use R12; credentials R60), so they are not asked
    if (!(view.me && view.me.administer === true)) return {};
    return {
      roster: { op: "memberlist" },
      groupkey: { op: "groupkeystate" },
      keepaway: { op: "aikeepawaystate" },
      uses: { op: "accountuses", query: { owner: "group" } },
      limits: { op: "ailimits", query: { owner: "group" } },
      usage: { op: "aiusage", query: { owner: "group" } },
      history: { op: "accounthistory", query: { owner: "group" } },
      over: { op: "aiuseovertime", query: { owner: "group" } },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.teamai.", M = "screen.members.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const ui = view.ui || {};
    const data = view.data || {};
    const out = [cs.title()];
    // a member never reaches the page: only that it is administrators' (R48)
    if (me.administer !== true) { out.push(`<p data-state="admins">${W(S + "purpose")}</p>`); return out.join(""); }
    out.push(`<p class="mk-small">${W(S + "sub")}</p>`);

    // who did it, by handle: the founder by hers or `member.founder.unnamed`, never the id `admin` (R37: every fill filled)
    const roster = data.roster && data.roster.state === "ok" && data.roster.value && Array.isArray(data.roster.value.members) ? data.roster.value.members : [];
    const founderRow = roster.find((m) => m.member_id === "admin" || m.founder === true) || null;
    const founderName = () => (founderRow && founderRow.handle) || (me.member === "admin" && me.handle ? me.handle : T("member.founder.unnamed"));
    const names = (by) => {
      const id = String(by || "").replace(/^member:/, "");
      if (id === "admin") return founderName();
      const r = roster.find((m) => m.member_id === id);
      return r && r.handle ? r.handle : id === me.member && me.handle ? me.handle : cs.memberName(id);
    };
    const okv = (o) => (o && o.state === "ok" && o.value && o.value.ok !== false ? o.value : null);
    const amountOf = (a, u) => (u === "usd" ? "$" + Number(a).toFixed(2) : Number(a).toLocaleString("en"));
    const limitText = (l) => T("screen.panel.amount", { amount: amountOf(l.amount, l.unit), unit: T("screen.panel.unit." + l.unit), period: T("screen.panel.period." + l.period) });

    // the card: how the key stands, with this month's meter on it (R26)
    const gk = okv(data.groupkey);
    const card = cs.state(data.groupkey, (g) => {
      if (!g.held) return `<p data-state="groupkey">${W(M + "key.none")}</p>`;
      let h = `<p data-state="groupkey">${W(S + "held")}</p><p>${W(S + "setby", { who: names(g.by), date: D(g.set_at) })}</p><p>${W(g.on ? S + "on" : "screen.panel.off")}</p>`;
      const ov = okv(data.over);
      const month = ov && Array.isArray(ov.periods) ? ov.periods.find((p) => (p.scope || "overall") === "overall" && p.period === "month") : null;
      if (month && month.limit !== null && month.limit !== undefined) {
        const show = (x) => (month.unit === "usd" ? "$" + Number(x || 0).toFixed(2) : Number(x || 0).toLocaleString("en"));
        const pct = Math.min(100, Math.round(100 * (Number(month.used) || 0) / (Number(month.limit) || 1))), near = pct >= 80;
        const says = W("ai.usage.meter", { label: T("ai.usage.meter.month_group"), used: show(month.used), limit: show(month.limit) });
        h += `<div class="mk-meter"${near ? ' data-near="1"' : ""} data-level="2" data-tip="${W("ai.usage.meter.means")}"><div class="l"><span>${says}</span><span class="pct">${pct}%${near ? " · " + W("ai.usage.meter.near") : ""}</span></div><div class="track" role="img" aria-label="${says}"><i style="width:${pct}%"></i><b style="left:80%"></b></div></div>`;
      }
      return h;
    });
    out.push(`<div class="mk-msg" data-situation="teamkey">${card}</div>`);

    // a part that opens and closes (the design's `.cs-part`): a number, its title and one line of why; empty parts are not drawn (R28)
    let n = 0;
    const part = (title, why, inner, open) => {
      if (!inner) return;
      n += 1;
      out.push(`<details class="cs-part" data-part="${n}"${open ? " open" : ""}><summary><span class="n">${n}</span><span class="t">${W(title)}</span>${why ? `<span class="why">${why}</span>` : ""}<span class="chev" aria-hidden="true"></span></summary><div class="body">${inner}</div></details>`);
    };
    const panel = (only) => (view.parts && view.parts.aiPanel ? view.parts.aiPanel(cs, view, { owner: "group", explore: true, perMember: true, names, only, bare: true }) : "");

    // what the key pays for: everyday help, and exploring
    const uses = okv(data.uses);
    const EVERYDAY = ["ask", "draft", "run", "enquire", "read", "transcribe", "account"];
    const usesWhy = uses && uses.uses
      ? W(S + "uses.why", { everyday: EVERYDAY.filter((k) => uses.uses[k]).map((k) => T("ai.use." + k + ".inline")).join(", ") || T("screen.panel.off"), explore: T("ai.explore." + (["no", "ask", "yes"].indexOf(uses.uses.explore) >= 0 ? uses.uses.explore : "no")).toLowerCase() })
      : "";
    part("screen.panel.uses.heading", usesWhy, panel("uses"), true);

    // its limits
    const lm = okv(data.limits);
    const L = lm && Array.isArray(lm.limits) ? lm.limits : null;
    const overall = L ? L.find((l) => l.scope === "overall") : null;
    const each = L ? L.find((l) => l.scope === "per_member") : null;
    const limitsWhy = !L ? "" : !overall && !each ? W(S + "limits.none") : W(S + "limits.why", { overall: overall ? limitText(overall) : T(S + "limits.none"), each: each ? limitText(each) : T(S + "limits.none") });
    part("screen.panel.limits.heading", limitsWhy, panel("limits"), false);

    // its use, summed over members, naming none
    part("screen.panel.usage.heading", W(S + "use.why"), panel("usage"), false);

    // keeping the team's material away from AI: on only with a reason, saying first what it does
    part(M + "keepaway.heading", "", cs.state(data.keepaway, (v) => {
      if (v.on !== true && v.on !== false) return `<p data-state="keepaway">${W(M + "keepaway.unread")}</p>`;
      let h = v.on ? `<p data-state="keepaway">${W(M + "keepaway.on", { by: names(v.set_by), date: D(v.set_at) })} <span class="rec">${E(v.reason || "")}</span></p>` : `<p data-state="keepaway">${W(M + "keepaway.off")}</p>`;
      const on = cs.act("aikeepaway", { label: v.on ? M + "keepaway.save" : undefined, data: { on: "on" } });
      if (on) {
        const USES = ["ask", "draft", "run", "standing", "enquire", "read", "transcribe", "account", "explore"];
        const chosen = v.on && Array.isArray(v.uses) && v.uses.length < USES.length ? v.uses : null;
        h += `<div><p>${W("act.aikeepaway.does")}</p><fieldset><legend>${W(M + "keepaway.which")}</legend><label for="mk-all"><input type="radio" id="mk-all" name="mk-scope"${chosen ? "" : " checked"}>${W(M + "keepaway.all")}</label><label for="mk-some"><input type="radio" id="mk-some" name="mk-scope"${chosen ? " checked" : ""}>${W(M + "keepaway.some")}</label></fieldset><fieldset><legend>${W(M + "keepaway.uses")}</legend>${USES.map((u) => `<label for="mk-use-${u}"><input type="checkbox" id="mk-use-${u}"${chosen && chosen.indexOf(u) >= 0 ? " checked" : ""}>${W("ai.use." + u + ".name")}</label>`).join("")}</fieldset>${cs.field("mk-why", M + "keepaway.reason", { area: true, rec: true, max: 2000, value: v.on ? v.reason || "" : "" })}${on}${v.on ? cs.act("aikeepaway", { label: M + "keepaway.turnoff", data: { on: "off" } }) : ""}</div>`;
      }
      return h;
    }), false);

    // the key itself: held and on, never the key; a key typed is sent in the body only, then switched on
    part(S + "key", W(S + "key.why"), cs.state(data.groupkey, (g) => {
      let h = `<p data-state="groupkey">${g.held === undefined ? W(g.on ? M + "key.on" : M + "key.off") : !g.held ? W(M + "key.none") : W(g.on ? M + "key.heldon" : M + "key.heldoff", { by: names(g.by), date: D(g.set_at) })}</p>`;
      const set = cs.act("groupkeyset");
      if (set) h += `${cs.field("mk-key" + (ui.keyGen || 0), g.held ? M + "key.replace" : M + "key.field", { type: "password", autocomplete: "off" })}${set}`;
      if (g.held) h += cs.act("groupkeyswitch", { label: g.on ? M + "key.switchoff" : M + "key.switchon", data: { on: g.on ? "off" : "on" } }) + cs.act("groupkeyremove");
      return h;
    }), false);

    // every change, with who and when
    part("screen.panel.changes.heading", W(S + "changes.why"), panel("changes"), false);

    // which account pays, and when: folded at the foot
    out.push(`<details class="mk-details" data-fold="whopays"><summary>${W("screen.connect.whopays.summary")}</summary><p class="mk-note">${W("ai.whopays")}</p></details>`);
    return out.join("");
  },

  acts: [
    // the key in the request's body only, never drawn again; then switched on, as setup-page R18 does
    { op: "groupkeyset", rereads: ["groupkey", "uses", "history"],
      ready(view, el, cs) { if (!String(cs.value("mk-key" + ((view.ui && view.ui.keyGen) || 0)) || "").trim()) return { refuse: "screen.members.key.nokey" }; },
      send(view, el, cs) { const key = String(cs.value("mk-key" + ((view.ui && view.ui.keyGen) || 0)) || "").trim(); return key ? { body: { key } } : { refuse: "screen.members.key.nokey" }; },
      // the field drawn anew, empty (the shell keeps a field's value by its id, R10); the shell does not await `done`:
      // the switch is sent, then the screen opened again, which reads everything anew
      done(view, answer, cs) { cs.set("keyGen", ((view.ui && view.ui.keyGen) || 0) + 1); cs.call("groupkeyswitch", { body: { on: true } }).then(() => cs.go("teamai", view.subject)); return { stay: true }; } },
    { op: "groupkeyswitch", rereads: ["groupkey", "history"],
      send(view, el) { return { body: { on: el.dataset.on === "on" } }; } },
    { op: "groupkeyremove", rereads: ["groupkey", "uses", "history"],
      send() { return { body: {} }; } },
    { op: "accountusesset", rereads: ["uses", "history"],
      send(view, el, cs) { return view.parts.aiPanelSend("accountusesset", "group", el, cs); },
      refusals: { SWITCH_VALUE_INVALID: "ai.refused.switchvalue" } },
    { op: "ailimitset", rereads: ["limits", "over"],
      send(view, el, cs) { return view.parts.aiPanelSend("ailimitset", "group", el, cs); },
      refusals: { AI_LIMIT_INVALID: (r, cs) => cs.w("ai.refused.limitinvalid", { field: String(cs.w("ai.limitfield." + (["owner", "scope", "unit", "period", "amount", "inclusive", "use", "count"].indexOf(r && r.field) >= 0 ? r.field : "amount"))).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) }), LIMIT_UNIT_UNAVAILABLE: "ai.refused.unitunavailable" } },
    // on only with a reason of 1 to 2,000 characters in the administrator's own words, its field the act's reason
    // (interface-shell R11's `reasonField`; credentials R51); off with the reason for turning it off
    { op: "aikeepaway", rereads: ["keepaway", "history", "uses"], reasonField: "reason",
      send(view, el, cs) {
        const reason = String(cs.value("mk-why") || "").trim();
        if (reason.length < 1 || reason.length > 2000) return { refuse: "screen.members.keepaway.noreason" };
        // turning it off is reasoned too (op-grades), its reason the same field's
        if (el.dataset.on === "off") return { body: { on: false, reason } };
        const USES = ["ask", "draft", "run", "standing", "enquire", "read", "transcribe", "account", "explore"];
        if (cs.value("mk-some") !== true) return { body: { on: true, reason } };
        const uses = USES.filter((u) => cs.value("mk-use-" + u) === true);
        return uses.length ? { body: { on: true, reason, uses } } : { refuse: "screen.members.keepaway.nouses" };
      } },
  ],
};
