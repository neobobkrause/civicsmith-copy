/* screens-ai (T53; DEC-420, DEC-465, DEC-468, DEC-471; K5459): `aimine`, "Your AI", every member's own screen. Pure: every read and
   act is an op, through `interface-shell`'s contract (its R21); every function is self-contained; every sentence a word by key (R12).

   What it draws today, from the reads the plane serves: what serves her now (the team's accounts that are on, then her own, in
   order); her own accounts (`accountsof {owner: member:<me>}`) in order with Move up and Move down (`aiorderset`, `owner: "member"`),
   each with its share flag (`aioptinset`, off to begin with) unless it is a personal subscription, which says it is only ever on her
   own list; her own checks (`aichecks {level: member:<me>}`, `aimycheckset`); who sees her use; and each of her own accounts' use over
   time in a drawer read only once opened (R15). Another member's account is never read or drawn. What R6 still waits on (the team's
   locks and the sources of each check in force) is named in `docs/requirements-notes/screens-ai.md`. */

export const aimine = {
  id: "aimine",

  reads(view) {
    const me = view.me && view.me.member;
    if (!me) return {};
    const owner = "member:" + me;
    const out = {
      team: { op: "accountsof", query: { owner: "group" }, empty: () => false },
      own: { op: "accountsof", query: { owner }, empty: () => false },
      checks: { op: "aichecks", query: { level: owner } },
    };
    // R15: one read of her own accounts' use over time, made only once a drawer was first opened, and kept for the page after
    const ui = view.ui || {};
    for (const k of Object.keys(ui)) if (k.indexOf("aiuse.") === 0) out["use:" + k.slice(6)] = { op: "aiuseovertime", query: { owner }, empty: () => false };
    return out;
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.aimine.";
    const d = view.data || {};
    const ui = view.ui || {};
    const me = view.me && view.me.member;
    const owner = "member:" + me;
    const okv = (o) => (o && o.state === "ok" && o.value && o.value.ok !== false && o.value.unreadable !== true ? o.value : null);
    const failed = (o) => cs.state({ state: "failed", refusal: o && o.refusal }, () => "");
    const ordered = (v) => (v && Array.isArray(v.accounts) ? v.accounts.slice().sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)) : null);
    const label = (a) => [a.provider, a.plan].filter(Boolean).map(String).join(" · ");
    const out = [cs.title(), `<p class="mk-small">${W(S + "intro")}</p>`];

    const team = ordered(okv(d.team));
    const own = ordered(okv(d.own));

    // what serves her now: the team's accounts that are on, then her own, in the order work goes to them
    out.push(cs.sec(S + "now.head", (() => {
      if (!team && !own) return failed(d.team && d.team.state === "failed" ? d.team : d.own);
      const line = (k, list) => (list && list.length ? `<p data-serves="${k === "now.team" ? "team" : "own"}"><b>${W(S + k)}</b> ${list.map((a) => `<span class="rec">${E(label(a))}</span>`).join(", ")}</p>` : "");
      return line("now.team", (team || []).filter((a) => a.on === true)) + line("now.own", (own || []).filter((a) => a.on === true)) + `<p class="mk-note">${W(S + "now.note")}</p>`;
    })()));

    // her own accounts, in order, each with its share flag (a personal subscription carries none) and its drawer of use
    out.push(cs.sec(S + "own.head", (() => {
      if (!own) return d.own && d.own.state === "loading" ? cs.state(d.own, () => "") : failed(d.own);
      const n = own.length;
      const items = own.map((a, i) => {
        const id = String(a.account_id);
        const pos = Number(a.position) || i + 1;
        const personal = a.personal === true;
        const opt = a.opt_in && typeof a.opt_in === "object" ? a.opt_in.on === true : false;
        const key = "aiuse." + id;
        const opened = Array.isArray(ui[key]) && ui[key].indexOf("open") >= 0;
        const use = d["use:" + id];
        let drawer = cs.checks("aiuse-" + id, "ai.usage.bars", [["open", "ai.usage.bars", opened]], { redraw: key });
        if (opened && use) drawer += `<div data-drawer="${E(id)}">` + (use.state === "loading" ? cs.state(use, () => "")
          : view.parts && typeof view.parts.aiUsageBars === "function" ? view.parts.aiUsageBars(cs, view, { owner, value: use }) : "") + "</div>";
        return `<li data-account="${E(id)}" data-personal="${personal ? "1" : "0"}"><b class="rec">${E(label(a))}</b> `
          + (pos > 1 ? cs.act("aiorderset", { label: "screen.aiproviders.use.up", data: { account: id, position: String(pos - 1) } }) : "")
          + (pos < n ? cs.act("aiorderset", { label: "screen.aiproviders.use.down", data: { account: id, position: String(pos + 1) } }) : "")
          + (personal ? `<p class="mk-note">${W(S + "subscription.ownlist")}</p>`
            : `<p class="mk-small" data-optin="${opt ? "on" : "off"}">${W(S + "optin")} · ${W("screen.aiproviders.status." + (opt ? "on" : "off"))} `
              + cs.act("aioptinset", { label: "screen.aiproviders.use." + (opt ? "switchoff" : "switchon"), data: { account: id, to: opt ? "off" : "on" } }) + `</p>`)
          + drawer + `</li>`;
      }).join("");
      return items ? `<ol class="mk-list" data-list="own">${items}</ol>` : "";
    })()));

    // her own checks: each she may require for her own work
    out.push(cs.sec(S + "chk.head", (() => {
      const v = okv(d.checks);
      if (!v || !v.ticks) return d.checks && d.checks.state === "loading" ? cs.state(d.checks, () => "") : failed(d.checks);
      const NAME = { P1: "notrain", P2: "noread", P3: "keeps", P4: "where", P5: "onward", P6: "keepaway", P7: "origin" };
      const items = Object.keys(NAME).map((p) => {
        const on = v.ticks[p] === true;
        return `<li data-check="${p}" data-on="${on ? "on" : "off"}"><b>${W("screen.aichecks." + NAME[p] + ".name")}</b> `
          + cs.act("aimycheckset", { label: on ? "screen.aiproviders.use.switchoff" : "screen.aichecks.mytick", data: { check: p, to: on ? "off" : "on" } }) + `</li>`;
      }).join("");
      return `<p class="mk-small">${W(S + "chk.rule")}</p><ul class="mk-list" data-list="checks">${items}</ul><p class="mk-note">${W(S + "chk.proj")}</p>`;
    })()));

    // who sees her use
    out.push(`<p class="mk-note" data-note="seenby">${W(S + "seenby")}</p>`);
    return out.join("");
  },

  acts: [
    { op: "aiorderset", rereads: ["own", "team"],
      send(view, el) { return { body: { owner: "member", account_id: el.dataset.account, position: Number(el.dataset.position) } }; } },
    { op: "aioptinset", rereads: ["own"],
      send(view, el) { return { body: { account_id: el.dataset.account, on: el.dataset.to === "on" } }; } },
    { op: "aimycheckset", rereads: ["checks"],
      send(view, el) { return { body: { check: el.dataset.check, ticked: el.dataset.to === "on" } }; } },
  ],
};
