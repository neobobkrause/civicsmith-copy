/* screens-settings R20 (K3060 D4; DEC-202 (3); setup-page R16, R29 moved): Settings › Recovery codes, each member's own.
   How many of the member's own one-time codes are left and when they were issued (`recoverycodesstate`, credentials
   R46); "Get new recovery codes" (`recoverycodesissue`) shows the ten codes once, saying first that issuing again spends
   every earlier one; to an administrator, the one-administrator step's note while it is not met (`adminrecoverystep`,
   instance-setup R66), a read that did not answer never drawn as not met. The codes are held only in the page's memory
   while shown, never stored, drawn again after leaving or sent anywhere (R10). T50 (R42): above the act, that the codes were
   shown once, to the member alone (`screen.recovery.onlyyou`). Every function is self-contained
   (interface-shell R21). */

export const recovery = {
  id: "recovery",

  reads(view) {
    const r = { codes: { op: "recoverycodesstate" } };
    // the owner refuses the step to a member who does not administer (instance-setup R66)
    if (view.me && view.me.administer === true) r.step = { op: "adminrecoverystep" };
    return r;
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.recovery.";
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const ui = view.ui || {};
    const data = view.data || {};
    const out = [cs.title()];

    // the one-administrator step, while not met (instance-setup R66)
    const st = data.step && data.step.state === "ok" ? data.step.value : null;
    if (st && st.met === false) {
      const lead = st.administrators === 1 ? W("screen.members.recovery.one") : W("screen.members.recovery.many", { administrators: st.administrators });
      out.push(`<div class="mk-msg" data-note="step">${lead ? `<p>${lead}</p>` : ""}${st.administrators < 2 ? `<div class="mk-links"><a class="cs-ref" href="/app/members#members-invite" data-nav>${W("screen.members.recovery.add")}</a></div>` : ""}</div>`);
    }

    // the member's own codes: how many are left, and when issued
    out.push(cs.sec(S + "held.heading", cs.state(data.codes, (v) => `<p data-state="codes">${v.held && v.remaining > 0 ? W(S + "held", { remaining: v.remaining, total: Number.isInteger(v.total) ? v.total : 10, date: D(v.issuedAt) }) : v.held ? W(S + "spent", { date: D(v.issuedAt) }) : W(S + "none")}</p>`)));

    // new codes, shown once; issuing again spends the earlier ones
    const issue = cs.act("recoverycodesissue");
    if (issue) {
      const shown = Array.isArray(ui.codes) && ui.codes.length
        ? `<div class="mk-msg" data-shown="codes"><p>${W(S + "shown")}</p><ol class="mk-list">${ui.codes.map((c) => `<li><code>${E(c)}</code></li>`).join("")}</ol></div>` : "";
      out.push(cs.sec(S + "issue.heading", `<p>${W(S + "onlyyou")}</p><p>${W(S + "spends")}</p>${shown}${issue}`));
    }
    return out.join("");
  },

  acts: [
    { op: "recoverycodesissue", rereads: ["codes", "step"],
      send() { return { body: {} }; },
      done(view, answer, cs) { const a = answer && answer.result !== undefined ? answer.result : answer; cs.set("codes", a && Array.isArray(a.codes) ? a.codes : null); } },
  ],

  // the codes leave the page's memory when the member leaves the screen (interface-shell R21's `closed`)
  closed(cs, view) { if (view.ui && view.ui.codes) view.ui.codes = null; },
};
