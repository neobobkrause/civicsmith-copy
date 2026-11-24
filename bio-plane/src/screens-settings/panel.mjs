/* screens-settings R9 (DEC-188 (1)): the AI account panel, one render over an `owner`, drawn by `members` for the group's
   key (`owner: "group"`) and by `connect` for the member's own account (`owner: "member:<id>"`); `projectai` (T47) will
   reuse it. It shows what the account pays for (the uses, `ai.use.<u>.name`; exploring, `ai.explore.*`, at group level
   only), its limits as a table with one form, this month's use summed and naming no member (DEC-188 (5)), and the
   changes with who and when (`accounthistory`'s and `ailimits`' history together).

   Each function is self-contained (interface-shell R21: only its parameters, `cs` and the language's globals), handed
   to the two screens as `view.parts` (J2 (1)). The panel reads the screen's reads `uses`, `limits`, `usage` and
   `history`, each over `owner`. */

import { KEYS } from "./keys.mjs";

/** The keys the AI account panel draws (R9, R26, R39): `screens-inquiry`'s `projectai` lists them too, for the words its page carries. */
const USE_KINDS = ["ask", "draft", "run", "standing", "enquire", "read", "transcribe", "account", "explore", "suggestions"];
export const PANEL_KEYS = Object.freeze([...KEYS.filter((k) => k.startsWith("screen.panel.")), ...USE_KINDS.map((u) => `ai.use.${u}.name`),
  "ai.explore.no", "ai.explore.ask", "ai.explore.yes", "ai.refused.limitinvalid", "ai.refused.unitunavailable", "ai.refused.switchvalue",
  ...["bars", "bars.means", "day", "today", "summary", "meter", "meter.means", "meter.near", "nolimit"].map((k) => `ai.usage.${k}`),
  ...["owner", "scope", "unit", "period", "amount", "inclusive", "use", "count"].map((f) => `ai.limitfield.${f}`)]);

/** The panel's HTML. `o`: `{owner, explore, perMember, names}`: whether exploring and a per-member limit apply (group
 *  level), and `names(by)` turning a recorded `by` into the name drawn. A section that holds nothing is not drawn (R28).
 *  `o.only` (`uses`, `limits`, `usage` or `changes`) draws that one section; with `o.bare` its content alone, for a screen that
 *  holds it in a part of its own (R48, R49). `o.units` narrows the units a limit may be set in (a subscription's: tokens or calls, R49). */
export function aiPanel(cs, view, o) {
  const W = cs.w, E = cs.esc, S = "screen.panel.";
  // a word as plain text, for another word's fills (the kit escapes fills, interface-shell R5)
  const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const USES = ["ask", "draft", "run", "standing", "enquire", "read", "transcribe", "account", "suggestions"];
  const p = o.owner === "group" ? "aig" : "aio";
  const name = (by) => (o.names ? o.names(by) : cs.memberName(String(by || "").replace(/^member:/, "")));
  const scopeKey = (s) => s === "overall" ? S + "scope.overall" : s === "per_member" ? S + "scope.per_member" : "ai.use." + s + ".name";
  const scopeName = (s) => T(scopeKey(s));
  const unitName = (u) => T(S + "unit." + u);
  const amountOf = (a, u) => u === "usd" ? "$" + Number(a).toFixed(2) : Number(a).toLocaleString("en");
  const dollars = (d) => "$" + Number(d || 0).toFixed(2);
  const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const data = view.data || {};
  const out = [];
  const section = (titleKey, inner) => {
    const which = titleKey === S + "uses.heading" ? "uses" : titleKey === S + "limits.heading" ? "limits" : titleKey === S + "usage.heading" ? "usage" : "changes";
    if (!inner || (o.only && o.only !== which)) return;
    out.push(o.bare ? inner : cs.sec(titleKey, inner));
  };

  // what the account pays for: each use switched on its own, exploring chosen at group level
  section(S + "uses.heading", cs.state(data.uses, (v) => {
    if (!v.uses) return "";
    const u = v.uses;
    let h = `<ul class="mk-list">${USES.map((k) => `<li><span>${W("ai.use." + k + ".name")}</span> · <span>${W(u[k] ? S + "on" : S + "off")}</span> ${cs.act("accountusesset", { label: u[k] ? S + "switch.off" : S + "switch.on", data: { sw: k, to: u[k] ? "off" : "on" } })}</li>`).join("")}</ul>`;
    if (o.explore) {
      const x = u.explore || "no";
      h += cs.choice(p + "-explore", "ai.use.explore.name", ["no", "ask", "yes"].map((y) => [y, "ai.explore." + y]), { value: x }) + cs.act("accountusesset", { label: S + "explore.save", data: { sw: "explore" } });
    }
    return h + `<p class="mk-note">${W(S + "uses.stops")}</p>`;
  }));

  // its limits, as a table with one form
  section(S + "limits.heading", cs.state(data.limits, (v) => {
    const L = v.limits || [];
    const scopeOf = (l) => l.scope === "overall" || l.scope === "per_member" ? l.scope : l.use || l.scope;
    let h = L.length === 0 ? "" : `<table class="mk-table"><thead><tr><th>${W(S + "col.limit")}</th><th>${W(S + "col.amount")}</th><th>${W(S + "col.counts")}</th><th>${W(S + "col.used")}</th><th>${W(S + "col.acts")}</th></tr></thead><tbody>${L.map((l) => `<tr><td>${E(scopeName(scopeOf(l)))}</td><td>${W(S + "amount", { amount: amountOf(l.amount, l.unit), unit: unitName(l.unit), period: T(S + "period." + l.period) })}</td><td>${l.on_top === true ? W(S + "ontop") : l.on_top === false ? W(S + "within") : ""}</td><td>${l.used === null || l.used === undefined ? "" : E(amountOf(l.used, l.unit))}${l.reached ? " · " + W(S + "reached") : ""}</td><td>${cs.act("ailimitset", { label: S + "limit.remove", data: { remove: "1", scope: scopeOf(l), unit: l.unit, period: l.period } })}</td></tr>`).join("")}</tbody></table>`;
    const set = cs.act("ailimitset", { data: { remove: "" } });
    if (set) {
      const scopes = ["overall", ...USES.filter((k) => k !== "suggestions"), ...(o.explore ? ["explore"] : []), ...(o.perMember ? ["per_member"] : [])];
      h += `<div>${cs.choice(p + "-scope", S + "form.scope", scopes.map((s) => [s, scopeKey(s)]))}${cs.field(p + "-amount", S + "form.amount")}${cs.choice(p + "-unit", S + "form.unit", ["usd", "tokens", "calls"].filter((u) => !o.units || o.units.indexOf(u) >= 0).map((u) => [u, S + "unit." + u]))}${cs.choice(p + "-period", S + "form.period", ["day", "month"].map((x) => [x, S + "period." + x]))}
<fieldset><legend>${W(S + "form.inclusive")}</legend><label for="${p}-within"><input type="radio" id="${p}-within" name="${p}-inclusive" checked>${W(S + "within")}</label><label for="${p}-ontop"><input type="radio" id="${p}-ontop" name="${p}-inclusive">${W(S + "ontop")}</label></fieldset>${set}</div><p class="mk-note">${W(S + "limits.told")}</p>`;
    }
    return h;
  }));

  // this month's use, summed, naming no member; and, over thirty days, bars and a meter against each limit (R26), the part
  // `aiUsageBars` draws over the answer read
  const overTime = (r) => (view.parts && view.parts.aiUsageBars ? view.parts.aiUsageBars(cs, view, { owner: o.owner, value: r }) : "");
  section(S + "usage.heading", cs.state(data.usage, (v) => {
    const U = v.uses || [];
    if (!U.length) return "";
    const unstated = (r) => r.cost_unstated || r.total_cost_usd === null || r.total_cost_usd === undefined;
    const cost = (r) => unstated(r) ? W(S + "notstated") : E("$" + Number(r.total_cost_usd).toFixed(2));
    const sum = (k) => U.reduce((t, r) => t + (Number(r[k]) || 0), 0);
    return `<table class="mk-table"><thead><tr><th>${W(S + "col.month")}</th><th>${W(S + "col.calls")}</th><th>${W(S + "col.tokens")}</th><th>${W(S + "col.dollars")}</th></tr></thead><tbody>${U.map((r) => `<tr><td>${W("ai.use." + r.use + ".name")}</td><td>${E(Number(r.calls || 0).toLocaleString("en"))}</td><td>${E(Number(r.tokens || 0).toLocaleString("en"))}</td><td>${cost(r)}</td></tr>`).join("")}<tr><td>${W(S + "usage.all")}</td><td>${E(sum("calls").toLocaleString("en"))}</td><td>${E(sum("tokens").toLocaleString("en"))}</td><td>${U.some(unstated) ? W(S + "notstated") : E("$" + sum("total_cost_usd").toFixed(2))}</td></tr></tbody></table><p class="mk-note">${W(o.owner === "group" ? S + "usage.group" : S + "usage.own")}</p>`;
  }) + overTime(data.over));

  // the changes, with who and when
  section(S + "changes.heading", cs.state(data.history, (v) => {
    const items = [];
    const KINDS = ["key_set", "signin_set", "removed", "switched", "use_set", "limit_set"];
    for (const c of v.changes || []) items.push({ at: c.at, html: W(S + "change." + (KINDS.includes(c.change) ? c.change : "other"), { who: name(c.by), on: T(c.on ? S + "on" : S + "off"), use: T("ai.use." + (c.switch || "explore") + ".name"), value: c.switch === "explore" ? T("ai.explore." + (c.value || "no")) : T(c.value ? S + "on" : S + "off") }) });
    const lh = data.limits && data.limits.state === "ok" && data.limits.value ? data.limits.value.history || [] : [];
    for (const h of lh) items.push({ at: h.at, html: W(S + "change.limit." + (h.change === "removed" ? "removed" : "set"), { who: name(h.by), scope: scopeName(h.scope), amount: h.amount === null || h.amount === undefined ? "" : amountOf(h.amount, h.unit), unit: unitName(h.unit), period: T(S + "period." + h.period) }) });
    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return items.length === 0 ? "" : `<ul class="mk-list">${items.map((i) => `<li>${i.html} · ${cs.date(i.at, { year: true })}</li>`).join("")}</ul>`;
  }));
  return out.join("");
}

/** R26 (K3293): the thirty days of bars and a meter against each limit, over an `aiuseovertime` answer already read: `value` is
 *  that answer, or the screen's read of it (`view.data.<name>`, `{state, value, refusal}`). Summed over everyone the account
 *  serves, naming no member; a day with no use is a zero bar; an answer that is `unreadable`, refused or not read is drawn
 *  failed, never as zeros. The panel (`aiPanel`) and `screens-inquiry`'s `projectai` draw it as a part. */
export function aiUsageBars(cs, view, o) {
  const W = cs.w, E = cs.esc, S = "screen.panel.";
  const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const scopeName = (s) => T(s === "overall" ? S + "scope.overall" : s === "per_member" ? S + "scope.per_member" : "ai.use." + s + ".name");
  const unitName = (u) => T(S + "unit." + u);
  const dollars = (d) => "$" + Number(d || 0).toFixed(2);
  const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const r0 = o && o.value;
  if (!r0) return "";
  const r = typeof r0 === "object" && ["loading", "failed", "ok", "empty"].indexOf(r0.state) >= 0 ? r0 : { state: "ok", value: r0 };
  const v = r.state === "ok" && r.value && r.value.ok !== false ? r.value : null;
  // an answer that cannot be read, or a refusal, is drawn as failed, never as zeros
  if (!v || v.unreadable === true || !Array.isArray(v.days)) return r.state === "loading" ? cs.state(r, () => "") : cs.state({ state: "failed", refusal: r.refusal }, () => "");
  const days = v.days;
  let h = "";
  if (days.length) {
    const peak = days.reduce((m, x) => Math.max(m, Number(x.dollars) || 0), 0.01);
    const sum = days.reduce((t, x) => t + (Number(x.dollars) || 0), 0), calls = days.reduce((t, x) => t + (Number(x.calls) || 0), 0);
    const top = days.reduce((a, x) => ((Number(x.dollars) || 0) > (Number(a.dollars) || 0) ? x : a), days[0]);
    const last = days.length - 1;
    h += `<div class="mk-bars"><span class="k" tabindex="0" data-level="2" data-tip="${W("ai.usage.bars.means")}">${W("ai.usage.bars")}</span><div class="run">${days.map((x, i) => {
      const tip = W("ai.usage.day", { day: D(x.day), calls: Number(x.calls || 0).toLocaleString("en"), dollars: dollars(x.dollars) }) + (i === last ? " · " + W("ai.usage.today") : "");
      return `<i${i === last ? ' class="now"' : ""} style="height:${Math.max(2, Math.round(44 * (Number(x.dollars) || 0) / peak))}px" tabindex="0" aria-label="${tip}" data-level="2" data-tip="${tip}"></i>`;
    }).join("")}</div><div class="ax"><span>${E(D(days[0].day))}</span><span>${E(D(days[last].day))}, ${W("ai.usage.today")}</span></div><span class="mk-small">${W("ai.usage.summary", { dollars: dollars(sum), calls: calls.toLocaleString("en"), day: D(top.day), daydollars: dollars(top.dollars) })}</span></div>`;
  }
  for (const l of Array.isArray(v.periods) ? v.periods : []) {
    const label = scopeName(l.scope || "overall") + " · " + unitName(l.unit) + " · " + T(S + "period." + l.period);
    const show = (x) => (l.unit === "usd" ? dollars(x) : Number(x || 0).toLocaleString("en") + " " + unitName(l.unit));
    if (l.limit === null || l.limit === undefined) {
      h += `<div class="mk-meter" data-level="2" data-tip="${W("ai.usage.nolimit")}"><div class="l"><span>${E(label)}: <b>${E(show(l.used))}</b> · ${W("ai.usage.nolimit")}</span></div><div class="track" aria-hidden="true"></div></div>`;
      continue;
    }
    const pct = Math.min(100, Math.round(100 * (Number(l.used) || 0) / (Number(l.limit) || 1))), near = pct >= 80;
    const says = W("ai.usage.meter", { label, used: show(l.used), limit: show(l.limit) });
    h += `<div class="mk-meter"${near ? ' data-near="1"' : ""} data-level="2" data-tip="${W("ai.usage.meter.means")}"><div class="l"><span>${says}</span><span class="pct">${pct}%${near ? " · " + W("ai.usage.meter.near") : ""}</span></div><div class="track" role="img" aria-label="${says}"><i style="width:${pct}%"></i><b style="left:80%"></b></div></div>`;
  }
  return h;
}

/** The request one of the panel's acts sends, from the pressed control's data and the form's fields; `{refuse}` (a word
 *  drawn beside the act, nothing sent) when the form cannot make a valid one. */
export function aiPanelSend(op, owner, el, cs) {
  const p = owner === "group" ? "aig" : "aio";
  const ds = (el && el.dataset) || {};
  if (op === "accountusesset") {
    if (ds.sw === "explore") return { body: { owner, switch: "explore", on: cs.value(p + "-explore") || "no" } };
    return { body: { owner, switch: ds.sw, on: ds.to === "on" } };
  }
  if (ds.remove === "1") return { body: { owner, scope: ds.scope, unit: ds.unit, period: ds.period, amount: null } };
  const amount = Number(String(cs.value(p + "-amount") || "").replace(/[,\s$]/g, ""));
  if (!(amount > 0)) return { refuse: "screen.panel.form.noamount" };
  const scope = cs.value(p + "-scope") || "overall";
  const body = { owner, scope, unit: cs.value(p + "-unit") || "tokens", period: cs.value(p + "-period") || "month", amount };
  if (scope !== "overall" && scope !== "per_member") body.inclusive = cs.value(p + "-ontop") !== true;
  return { body };
}

/** R9's refusal of a limit: `ai.refused.limitinvalid` with its field's words (`ai.limitfield.*`). */
export function aiLimitRefused(refusal, cs) {
  const T = (k) => String(cs.w(k)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const f = refusal && ["owner", "scope", "unit", "period", "amount", "inclusive", "use", "count"].includes(refusal.field) ? refusal.field : "amount";
  return cs.w("ai.refused.limitinvalid", { field: T("ai.limitfield." + f) });
}
