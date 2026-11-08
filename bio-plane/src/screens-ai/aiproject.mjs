/* screens-ai (T53; DEC-420, DEC-468; K5459): `aiproject`, "AI for this project". Its subject is the project (`/app/aiproject/<id>`).
   Pure: every read and act is an op, through `interface-shell`'s contract (its R21); every function is self-contained; every
   sentence a word by key (R12).

   R16: opened by a member who is not in the project it draws what `project` draws (`screens-inquiry` R60): a project she sees only to
   exist (its subject read refused `PROJECT_SEEN_NOT_A_PARTICIPANT`) that the directory lists is drawn by its name with "Ask to join"
   (`projectrequest`), or "Join" (`projectjoin`) where she was invited, and nothing else of it; one the directory does not list is
   the unavailable state b with no form; a project the store says is not there is the shell's bare state (`subject: true`, its R61).
   The title is read from the record (its `bundle.md`, else the directory's or the refusal's name), never an id; the accounts line is
   never drawn as failed to her.

   To a participant it draws the project's accounts in their order (`accountsof {owner: project:<id>}`), the project's checks
   (`aichecks {level: project:<id>}`) and its limits (`ailimits`); to an owner of the project, the acts (`aiprojectorder`,
   `aiprojectcheckset`, `aiprojectbudget`), the use by member (`aiusebymember`) and each account's use over time in a drawer read only
   once opened (R15). `docs/requirements-notes/screens-ai.md` names what R7 still waits on. */

export const aiproject = {
  id: "aiproject",

  reads(view) {
    const id = String(view.subject || "");
    const me = view.me && view.me.member;
    const owner = "project:" + id;
    const out = {
      stage: { op: "projectstage", query: { project: id }, subject: true },
      title: { op: "image", query: { id }, empty: () => false },
      participants: { op: "projectparticipants", query: { projectId: id } },
      ...(me && me !== "admin" ? { directory: { op: "projectdirectory", query: {} } } : {}),
      accounts: { op: "accountsof", query: { owner }, empty: () => false },
      checks: { op: "aichecks", query: { level: owner } },
      limits: { op: "ailimits", query: { owner }, empty: () => false },
    };
    // each member's use of what the project pays for: drawn to an owner only; a participant's refusal is never drawn
    out.bymember = { op: "aiusebymember", query: { owner }, empty: () => false };
    const ui = view.ui || {};
    // R15: an account's use over time is read only once its drawer was first opened, and kept for the page after
    for (const k of Object.keys(ui)) if (k.indexOf("aiuse.") === 0) out["use:" + k.slice(6)] = { op: "aiuseovertime", query: { owner }, empty: () => false };
    return out;
  },

  render(cs, view) {
    const id = String(view.subject || "");
    if (!id) return "";
    const W = cs.w, E = cs.esc, S = "screen.aiproject.";
    const d = view.data || {};
    const ui = view.ui || {};
    const okv = (o) => (o && o.state === "ok" && o.value && o.value.ok !== false && o.value.unreadable !== true ? o.value : null);
    const failed = (o) => cs.state({ state: "failed", refusal: o && o.refusal }, () => "");
    const me = view.me || {};

    // R16 (R39 of screens-inquiry): the title from the record, else the directory's or the refusal's name, never an id
    const text = d.title && d.title.state === "ok" && d.title.value ? d.title.value["bundle.md"] : null;
    let title = "";
    if (typeof text === "string") {
      const m = /^title:\s*(.*)$/m.exec(text.split(/\n---\s*\n/)[0] || "");
      title = m ? m[1].trim() : "";
      try { if (title.charAt(0) === "\"") title = JSON.parse(title); } catch (e) { /* the raw value is drawn */ }
    }
    const listed = d.directory && d.directory.state === "ok" && Array.isArray(d.directory.value.projects) ? d.directory.value.projects.find((p) => p && p.id === id) : null;
    const seen = ["stage", "participants"].some((k) => d[k] && d[k].refusal && d[k].refusal.code === "PROJECT_SEEN_NOT_A_PARTICIPANT");
    const named = d.stage && d.stage.refusal && d.stage.refusal.name ? String(d.stage.refusal.name) : "";
    title = title || (listed && (listed.name || listed.title)) || named;
    const out = [`<h1>${E(title)}</h1>`];

    // who she is in it: the roster's row for her (an invited member is a participant to the roster, not to the project's reads)
    const rows = d.participants && d.participants.state === "ok" && Array.isArray(d.participants.value.participants) ? d.participants.value.participants : [];
    const mine = rows.find((r) => r && ((me.handle && r.handle === me.handle) || (r.founder === true && me.member === "admin")));
    const invited = !!(mine && mine.state === "invited");

    // R16: not in the project
    if (seen || invited || (!mine && listed)) {
      if (!invited && !listed) return out.join("") + `<p class="cs-state" data-state="empty" data-unavailable="notyours"><b>${W("shell.unavailable.notyours.title")}</b> ${W("shell.unavailable.notyours.says")}</p>`;
      const req = listed && listed.request && listed.request.state === "open" ? listed.request : null;
      out.push(`<p>${W("screen.project.notjoined")}</p>`
        + (invited ? cs.act("projectjoin", { label: "act.projectjoin.label.project", tone: "primary" })
          : req ? `<p class="mk-note" data-request="asked">${W("projects.request.asked", { date: { html: req.asked ? cs.date(String(req.asked), { year: true }) : "" } })}</p>`
          : cs.act("projectrequest", { label: "act.projectrequest.label.project", tone: "primary" })));
      return out.join("");
    }

    // a participant: the project's own AI. Its owners are told by the roster's `owner`
    const isOwner = !!(mine && (mine.owner === 1 || mine.owner === true));
    out.push(`<p class="mk-small">${W(S + "intro", { project: title })}</p>`);
    if (!isOwner) {
      const owners = rows.filter((r) => r && (r.owner === 1 || r.owner === true)).map((r) => r.handle || cs.memberName(r.handle)).join(", ");
      if (owners) out.push(`<p class="mk-note">${W(S + "member", { owner: owners })}</p>`);
    }

    // the accounts the project uses, in order
    const owner = "project:" + id;
    out.push(cs.sec(S + "order.head", (() => {
      const v = okv(d.accounts);
      if (!v || !Array.isArray(v.accounts)) return d.accounts && d.accounts.state === "loading" ? cs.state(d.accounts, () => "") : failed(d.accounts);
      const acc = v.accounts.slice().sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
      const ids = acc.map((a) => String(a.account_id));
      const list = acc.map((a, i) => {
        const aid = String(a.account_id);
        const up = i > 0 ? ids.slice(0, i - 1).concat([aid, ids[i - 1]], ids.slice(i + 1)) : null;
        const down = i < ids.length - 1 ? ids.slice(0, i).concat([ids[i + 1], aid], ids.slice(i + 2)) : null;
        const key = "aiuse." + aid;
        const opened = Array.isArray(ui[key]) && ui[key].indexOf("open") >= 0;
        const use = d["use:" + aid];
        // R15: the drawer only on an account the viewer owns, that is, to an owner of the paying project
        let drawer = "";
        if (isOwner) {
          drawer = cs.checks("aiuse-" + aid, "ai.usage.bars", [["open", "ai.usage.bars", opened]], { redraw: key });
          if (opened && use) drawer += `<div data-drawer="${E(aid)}">` + (use.state === "loading" ? cs.state(use, () => "")
            : view.parts && typeof view.parts.aiUsageBars === "function" ? view.parts.aiUsageBars(cs, view, { owner, value: use }) : "") + "</div>";
        }
        return `<li data-account="${E(aid)}"><b class="rec">${E([a.provider, a.plan].filter(Boolean).join(" · "))}</b> `
          + (isOwner && up ? cs.act("aiprojectorder", { label: S + "order.up", data: { order: up.join(",") } }) : "")
          + (isOwner && down ? cs.act("aiprojectorder", { label: S + "order.down", data: { order: down.join(",") } }) : "") + drawer + `</li>`;
      }).join("");
      return `<p class="mk-note">${W(S + "order.note")}</p>` + (list ? `<ol class="mk-list" data-list="accounts">${list}</ol>` : "");
    })()));

    // the checks for the work done directly in this project
    out.push(cs.sec(S + "chk.head", (() => {
      const v = okv(d.checks);
      if (!v || !v.ticks) return d.checks && d.checks.state === "loading" ? cs.state(d.checks, () => "") : failed(d.checks);
      const NAME = { P1: "notrain", P2: "noread", P3: "keeps", P4: "where", P5: "onward", P6: "keepaway", P7: "origin" };
      const items = Object.keys(NAME).map((p) => {
        const on = v.ticks[p] === true;
        return `<li data-check="${p}" data-on="${on ? "on" : "off"}"><b>${W("screen.aichecks." + NAME[p] + ".name")}</b> `
          + (isOwner ? cs.act("aiprojectcheckset", { label: on ? "screen.aiproviders.use.switchoff" : "screen.aichecks.projtick", data: { check: p, to: on ? "off" : "on" } }) : "") + `</li>`;
      }).join("");
      return `<p class="mk-small">${W(S + "chk.line", { project: title })}</p><ul class="mk-list" data-list="checks">${items}</ul>`;
    })()));

    // the project's limit, and (to an owner) each member's use of what the project pays for
    out.push(cs.sec(S + "bud.head", (() => {
      const v = okv(d.limits);
      if (!v) return d.limits && d.limits.state === "loading" ? cs.state(d.limits, () => "") : failed(d.limits);
      const lim = (Array.isArray(v.limits) ? v.limits : []).filter((l) => l && l.scope === "overall" && l.unit === "usd" && l.period === "month")[0];
      return (lim ? `<p data-limit="month">$${E(Number(lim.amount || 0).toFixed(2))}</p>` : "")
        + (isOwner ? cs.field("aipj-bud", S + "bud.field", { autocomplete: "off" }) + cs.act("aiprojectbudget", { label: S + "bud.save" }) : "");
    })()));
    if (isOwner) {
      const v = okv(d.bymember);
      if (d.bymember && d.bymember.state === "failed") out.push(failed(d.bymember));
      else if (v && Array.isArray(v.members)) {
        const money = (c) => (c && typeof c === "object" ? "$" + Number(c.reported || c.estimated || 0).toFixed(2) : W("screen.aimine.use.nomoney"));
        const who = (m) => { const r = rows.find((x) => x && x.handle === String(m).replace(/^member:/, "")); return (r && r.handle) || cs.memberName(String(m)); };
        const trs = v.members.map((m) => `<tr data-member="${E(String(m.member))}"><td>${E(who(m.member))}</td><td>${E(money(m.cost))}</td><td>${E(Number(m.calls || 0).toLocaleString("en"))}</td></tr>`).join("");
        out.push(cs.sec("screen.aiproviders.bymember.head", `<p class="mk-note">${W(S + "bymember.note")}</p>`
          + (trs ? `<table class="mk-table" data-table="bymember"><thead><tr><th>${W("screen.aiproviders.bymember.th.member")}</th><th>${W("screen.aiproviders.bud.th.cost")}</th><th>${W("screen.aiproviders.bymember.th.runs")}</th></tr></thead><tbody>${trs}</tbody></table>` : "")));
      }
    }
    return out.join("");
  },

  acts: [
    // R16: as `project` sends them
    { op: "projectrequest", label: "act.projectrequest.label.project", rereads: ["directory"],
      send(view) { return { query: { projectId: String(view.subject || "") } }; } },
    { op: "projectjoin", label: "act.projectjoin.label.project", rereads: "all",
      send(view) { return { query: { projectId: String(view.subject || "") } }; } },
    { op: "aiprojectorder", rereads: ["accounts"],
      send(view, el) { return { body: { project: String(view.subject || ""), accounts: String(el.dataset.order || "").split(",").filter(Boolean) } }; } },
    { op: "aiprojectcheckset", rereads: ["checks"],
      send(view, el) { return { body: { project: String(view.subject || ""), check: el.dataset.check, ticked: el.dataset.to === "on" } }; } },
    { op: "aiprojectbudget", rereads: ["limits"],
      send(view, el, cs) {
        const t = String(cs.value("aipj-bud") || "").replace(/[$,\s]/g, "");
        if (!t) return { refuse: "shell.field.needed", fills: { field: String(cs.w("screen.aiproject.bud.field")).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) } };
        return { body: { project: String(view.subject || ""), owner: "project:" + String(view.subject || ""), scope: "overall", unit: "usd", period: "month", amount: Number(t) } };
      } },
  ],
};
