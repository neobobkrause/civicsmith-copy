/* screens-ai (T53; N1220; DEC-420, DEC-465, DEC-468, DEC-469, DEC-475): `aiproviders`, the team's AI, an administrator's screen.
   Pure: every read and act is an op the plane serves, called through `interface-shell`'s screen contract (its R21) and kit; every
   function is self-contained (R21 (1)) and every sentence a word read by key (R12).

   What it draws today, from the reads the plane serves (`docs/requirements-notes/screens-ai.md` names what waits on others):
   - to a member who does not administer: only that the screen is the administrators', and who they are (R1, R2's control);
   - the card: `assistantreadiness`' state (R1, R11) and the accounts that are on, in order;
   - "In use, in order": each team account (`accountsof {owner: group}`) with its provider and plan, On or Off, Move up and Move down
     (`aiorderset`, an explicit position), Switch off or on (`aiaccountswitch`), Remove (`aiaccountremove`), its unticked-until-set
     share flag (`aioptinset`), and its use over time in a drawer read only once opened (R15, the shared render `aiUsageBars`);
   - "Limits and alerts" (`ailimits`, `aibudgetset`), "Use by member, this month" (`aiusebymember`), the re-test switch (`airetestset`,
     its state read from `ailimits`' history: on until a `retest_off`), the health share (`aihealthset`) and its preview
     (`aihealthpreview`) (R2);
   - the seven checks (`aichecks {level: group}`, `aicheckset`) (R3, in part).
   After an act the screen re-reads what it changes (R13). */

export const aiproviders = {
  id: "aiproviders",

  reads(view) {
    const me = view.me || {};
    const roster = { roster: { op: "memberlist", query: {} } };
    if (me.administer !== true) return roster;
    const out = {
      ...roster,
      ready: { op: "assistantreadiness", query: {} },
      accounts: { op: "accountsof", query: { owner: "group" }, empty: () => false },
      limits: { op: "ailimits", query: { owner: "group" }, empty: () => false },
      bymember: { op: "aiusebymember", query: { owner: "group" }, empty: () => false },
      health: { op: "aihealthpreview", query: {}, empty: () => false },
      checks: { op: "aichecks", query: { level: "group" } },
    };
    // R15: an account's use over time is read only once its drawer was first opened, and kept for the page after (no second read)
    const ui = view.ui || {};
    for (const k of Object.keys(ui)) if (k.indexOf("aiuse.") === 0) out["use:" + k.slice(6)] = { op: "aiuseovertime", query: { owner: "group" }, empty: () => false };
    return out;
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.aiproviders.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const data = view.data || {};
    const ui = view.ui || {};
    const okv = (o) => (o && o.state === "ok" && o.value && o.value.ok !== false && o.value.unreadable !== true ? o.value : null);
    const failed = (o) => cs.state({ state: "failed", refusal: o && o.refusal }, () => "");
    const out = [cs.title(), `<p class="mk-small">${W(S + "intro")}</p>`];
    const roster = okv(data.roster) && Array.isArray(data.roster.value.members) ? data.roster.value.members : [];
    const nameOf = (id) => { const x = String(id == null ? "" : id).replace(/^member:/, ""); const m = roster.find((r) => r.member_id === x); return (m && m.handle) || cs.memberName(x); };

    // R1, R2 (control): a member who does not administer reads only whose screen this is, and who they are
    if (me.administer !== true) {
      out.push(cs.state(data.roster, (v) => {
        const admins = (Array.isArray(v.members) ? v.members : []).filter((m) => m && m.role === "admin" && m.status !== "inactive");
        return admins.length ? `<ul class="mk-list" data-list="admins">${admins.map((m) => `<li class="rec">${E(m.handle || cs.memberName(m.member_id))}</li>`).join("")}</ul>` : "";
      }));
      return out.join("");
    }

    const accts = okv(data.accounts) && Array.isArray(data.accounts.value.accounts) ? data.accounts.value.accounts.slice().sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)) : null;
    const label = (a) => [a.provider, a.plan].filter(Boolean).map(String).join(" · ");

    // the card (R1, R11): the readiness state the owner answers, and the accounts on, in order
    {
      const r = okv(data.ready);
      let h = "";
      if (data.ready && data.ready.state === "failed") h += failed(data.ready);
      else if (r && r.state !== "ready") h += `<p class="mk-msg" data-ready="${E(r.state)}">${W(S + "stands.none")}</p>`;
      else if (r && accts) {
        const on = accts.filter((a) => a.on === true);
        h += `<p data-ready="ready">${on.length ? W(S + "stands.on", { n: String(on.length), order: on.map(label).join(", ") }) : W(S + "stands.none")}</p>`;
      }
      out.push(`<div class="mk-card" data-card="stands">${h}</div>`);
    }

    // "In use, in order" (R1), with each account's drawer of its use over time (R15)
    out.push(cs.sec(S + "use.head", (() => {
      if (!accts) return data.accounts && data.accounts.state === "loading" ? cs.state(data.accounts, () => "") : failed(data.accounts);
      if (!accts.length) return `<p class="mk-note">${W(S + "stands.none")}</p>`;
      const n = accts.length;
      const rows = accts.map((a, i) => {
        const pos = Number(a.position) || i + 1;
        const id = String(a.account_id);
        const opt = a.opt_in && typeof a.opt_in === "object" ? a.opt_in.on === true : false;
        const drawerKey = "aiuse." + id;
        const opened = Object.prototype.hasOwnProperty.call(ui, drawerKey) && Array.isArray(ui[drawerKey]) && ui[drawerKey].indexOf("open") >= 0;
        const use = data["use:" + id];
        let drawer = cs.checks("aiuse-" + id, "ai.usage.bars", [["open", "ai.usage.bars", opened]], { redraw: drawerKey });
        if (opened && use) drawer += `<div data-drawer="${E(id)}">` + (use.state === "loading" ? cs.state(use, () => "")
          : view.parts && typeof view.parts.aiUsageBars === "function" ? view.parts.aiUsageBars(cs, view, { owner: "group", value: use }) : "") + "</div>";
        return `<li data-account="${E(id)}" data-position="${pos}"><b class="rec">${E(label(a))}</b> <span class="mk-small" data-on="${a.on === true ? "on" : "off"}">${W(S + (a.on === true ? "status.on" : "status.off"))}</span>`
          + `<span class="mk-acts">`
          + (pos > 1 ? cs.act("aiorderset", { label: S + "use.up", data: { account: id, position: String(pos - 1) } }) : "")
          + (pos < n ? cs.act("aiorderset", { label: S + "use.down", data: { account: id, position: String(pos + 1) } }) : "")
          + cs.act("aiaccountswitch", { label: S + (a.on === true ? "use.switchoff" : "use.switchon"), data: { account: id, to: a.on === true ? "off" : "on" } })
          + cs.act("aiaccountremove", { label: S + "use.remove", data: { account: id } }) + `</span>`
          + `<p class="mk-small" data-optin="${opt ? "on" : "off"}"><span>${W(S + "optin")}</span> · ${W(S + (opt ? "status.on" : "status.off"))} `
          + cs.act("aioptinset", { label: S + (opt ? "use.switchoff" : "use.switchon"), data: { account: id, to: opt ? "off" : "on" } }) + `</p>`
          + `<p class="mk-note">${W(S + "optin.note")}</p>` + drawer + `</li>`;
      }).join("");
      return `<ol class="mk-list" data-list="accounts">${rows}</ol><p class="mk-note">${W(S + "use.note")}</p>`;
    })()));

    // "Limits and alerts" (R2): each limit held with what it has used, and one form for the monthly limit and its alert
    const dollars = (x) => "$" + Number(x || 0).toFixed(2);
    out.push(cs.sec(S + "bud.head", (() => {
      const v = okv(data.limits);
      if (!v) return data.limits && data.limits.state === "loading" ? cs.state(data.limits, () => "") : failed(data.limits);
      const lim = (Array.isArray(v.limits) ? v.limits : []).filter((l) => l && typeof l.scope === "string" && l.scope.indexOf("retest:") !== 0);
      const show = (l, x) => (l.unit === "usd" ? dollars(x) : Number(x || 0).toLocaleString("en"));
      const rows = lim.map((l) => `<tr data-limit="${E(l.scope)}:${E(l.unit)}:${E(l.period)}"><td>${l.scope === "overall" ? W(S + "bud.all") : E(String(l.scope))}</td><td>${E(show(l, l.amount))}</td><td>${E(show(l, l.used))}</td></tr>`).join("");
      return (rows ? `<table class="mk-table"><thead><tr><th>${W(S + "bud.th.acc")}</th><th>${W(S + "bud.th.bud")}</th><th>${W(S + "bud.th.spent")}</th></tr></thead><tbody>${rows}</tbody></table>` : "")
        + cs.field("aip-bud-amount", S + "bud.amount", { autocomplete: "off" }) + cs.field("aip-bud-alert", S + "bud.alert", { autocomplete: "off" })
        + cs.act("aibudgetset", { label: S + "bud.set" }) + `<p class="mk-note">${W(S + "bud.note")}</p>`;
    })()));

    // "Use by member, this month" (R2): each member by name with cost and runs, the team's own accounts only
    out.push(cs.sec(S + "bymember.head", (() => {
      const v = okv(data.bymember);
      if (!v || !Array.isArray(v.members)) return data.bymember && data.bymember.state === "loading" ? cs.state(data.bymember, () => "") : failed(data.bymember);
      const money = (c) => (c && typeof c === "object" ? dollars(c.reported || c.estimated) : W("screen.aimine.use.nomoney"));
      const rows = v.members.map((m) => `<tr data-member="${E(String(m.member))}"><td>${E(nameOf(m.member))}</td><td>${E(money(m.cost))}</td><td>${E(Number(m.calls || 0).toLocaleString("en"))}</td></tr>`).join("");
      return `<p class="mk-note">${W(S + "bymember.note")}</p>` + (rows ? `<table class="mk-table" data-table="bymember"><thead><tr><th>${W(S + "bymember.th.member")}</th><th>${W(S + "bud.th.cost")}</th><th>${W(S + "bymember.th.runs")}</th></tr></thead><tbody>${rows}</tbody></table>` : "");
    })()));

    // the re-test switch (R2): on until an owner turns it off, its state the latest `retest_on` or `retest_off` in the limits' history
    {
      const v = okv(data.limits);
      if (v) {
        const hist = (Array.isArray(v.history) ? v.history : []).filter((h) => h && (h.change === "retest_on" || h.change === "retest_off"));
        const on = hist.length ? hist[hist.length - 1].change === "retest_on" : true;
        out.push(`<div class="mk-card" data-switch="retest" data-on="${on ? "on" : "off"}"><p><b>${W(S + "retest.switch")}</b> · ${W(S + (on ? "status.on" : "status.off"))} `
          + cs.act("airetestset", { label: S + (on ? "use.switchoff" : "use.switchon"), data: { to: on ? "off" : "on" } }) + `</p><p class="mk-note">${W(S + "retest.note")}</p></div>`);
      }
    }

    // the health share (R2): off until an administrator turns it on, and exactly what would be sent, never content, members or accounts
    {
      const v = okv(data.health);
      if (data.health && data.health.state === "failed") out.push(failed(data.health));
      else if (v) {
        const on = v.on === true;
        const rows = [];
        for (const rep of Array.isArray(v.reports) ? v.reports : []) for (const e of Array.isArray(rep.entries) ? rep.entries : []) {
          const errs = e.errors && typeof e.errors === "object" ? Object.keys(e.errors).sort().map((k) => k + " " + Number(e.errors[k] || 0)).join(", ") : String(Number(e.errors || 0));
          rows.push(`<li data-health="${E(String(e.entry_id))}:${E(String(rep.day))}">${W(S + "health.row", { ai: String(e.entry_id), date: String(rep.day), calls: String(Number(e.calls || 0)), refusals: String(Number(e.refused || 0)), noanswer: String(Number(e.silent || 0)), errors: errs })}</li>`);
        }
        out.push(`<div class="mk-card" data-switch="health" data-on="${on ? "on" : "off"}"><p><b>${W(S + "health.switch")}</b> · ${W(S + (on ? "status.on" : "status.off"))} `
          + cs.act("aihealthset", { label: S + (on ? "use.switchoff" : "use.switchon"), data: { to: on ? "off" : "on" } }) + `</p><p class="mk-note">${W(S + "health.note")}</p>`
          + `<details class="mk-details" data-fold="health-preview"><summary>${W(S + "health.preview")}</summary><ul class="mk-list" data-list="health">${rows.join("")}</ul></details></div>`);
      }
    }

    // the seven checks (R3, in part): each ticked by the team is required for the whole team; unticking records a reason
    out.push(cs.sec(S + "chk.head", (() => {
      const v = okv(data.checks);
      if (!v || !v.ticks) return data.checks && data.checks.state === "loading" ? cs.state(data.checks, () => "") : failed(data.checks);
      const NAME = { P1: "notrain", P2: "noread", P3: "keeps", P4: "where", P5: "onward", P6: "keepaway", P7: "origin" };
      const rows = Object.keys(NAME).map((p) => {
        const on = v.ticks[p] === true;
        return `<li data-check="${p}" data-on="${on ? "on" : "off"}"><b>${W("screen.aichecks." + NAME[p] + ".name")}</b> <span class="mk-small">${W("screen.aichecks." + NAME[p] + ".line")}</span> `
          + `<span class="mk-small">${W(on ? "screen.aichecks.required" : "screen.aichecks.open")}</span> `
          + cs.act("aicheckset", { label: S + (on ? "use.switchoff" : "use.switchon"), data: { check: p, to: on ? "off" : "on" } }) + `</li>`;
      }).join("");
      return `<p class="mk-small">${W(S + "chk.why")}</p><ul class="mk-list" data-list="checks">${rows}</ul><p class="mk-note">${W(S + "chk.note")}</p>`;
    })()));

    return out.join("");
  },

  acts: [
    // R1: an explicit position, never a toggle
    { op: "aiorderset", rereads: ["accounts", "ready"],
      send(view, el) { return { body: { owner: "group", account_id: el.dataset.account, position: Number(el.dataset.position) } }; } },
    { op: "aiaccountswitch", rereads: ["accounts", "ready"],
      send(view, el) { return { body: { account_id: el.dataset.account, on: el.dataset.to === "on" } }; } },
    { op: "aiaccountremove", rereads: ["accounts", "ready"],
      send(view, el) { return { body: { account_id: el.dataset.account } }; } },
    { op: "aioptinset", rereads: ["accounts"],
      send(view, el) { return { body: { account_id: el.dataset.account, on: el.dataset.to === "on" } }; } },
    // R2: the monthly limit (overall, in dollars) and its alert as a percent of it, each the owner's own request; the limit first
    { op: "aibudgetset", rereads: ["limits"],
      async send(view, el, cs) {
        const num = (id) => { const t = String(cs.value(id) || "").replace(/[$,%\s]/g, ""); return t === "" ? null : Number(t); };
        const amount = num("aip-bud-amount"), alert = num("aip-bud-alert");
        const limit = { owner: "group", scope: "overall", unit: "usd", period: "month", amount };
        const threshold = { owner: "group", scope: "overall", unit: "usd", period: "month", kind: "percent", level: alert };
        if (amount === null && alert === null) return { refuse: "shell.field.needed", fills: { field: String(cs.w("screen.aiproviders.bud.amount")).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) } };
        if (amount !== null && alert !== null) {
          const a = await cs.call("aibudgetset", { body: limit }).then((x) => x, () => null);
          const r = a && a.result !== undefined ? a.result : a;
          if (!r || r.ok === false) return { body: limit };
          return { body: threshold };
        }
        return { body: amount !== null ? limit : threshold };
      } },
    { op: "airetestset", rereads: ["limits"],
      send(view, el) { return { body: { owner: "group", on: el.dataset.to === "on" } }; } },
    // R2: sent only on the administrator's own act
    { op: "aihealthset", rereads: ["health"],
      send(view, el) { return { body: { on: el.dataset.to === "on" } }; } },
    { op: "aicheckset", rereads: ["checks"],
      send(view, el) { return { body: { check: el.dataset.check, ticked: el.dataset.to === "on" } }; } },
  ],
};
