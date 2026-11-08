/* screens-entry R3: `tour`, "How we work, step by step", in the public frame. Six steps, each its own address
   (`/app/tour`, `/app/tour/2` … `/app/tour/6`), so Back and Next are links the shell routes in the page: no account is
   asked, no op is read or sent, and nothing is stored. "Stop here" returns to `front`, or to Home for a
   signed-in member (R35); the fifth step links the doorbell. Self-contained (interface-shell R21). */

export const tour = {
  id: "tour",

  reads() { return {}; },

  render(cs, view) {
    const W = cs.w, S = "screen.tour.";
    const total = 6;
    const n = Math.min(total, Math.max(1, Math.floor(Number(view.subject) || 1)));
    const at = (k) => (k === 1 ? "/app/tour" : "/app/tour/" + k);
    const nav = (n > 1 ? `<a class="cs-btn" href="${at(n - 1)}" data-nav>${W(S + "back")}</a>` : "")
      + (n < total ? `<a class="cs-btn" data-tone="primary" href="${at(n + 1)}" data-nav>${W(S + "next")}</a>` : "")
      // R35 (DEC-472 (5)): a signed-in member who stops or ends the tour goes to Home, not to the sign-in form
      + `<a class="cs-btn" data-tone="quiet" href="${(view.session || {}).state === "live" ? "/app" : "/app/front"}" data-nav>${W(n === total ? S + "end" : S + "stop")}</a>`;
    return cs.title()
      + `<div class="cs-wizard" data-step="${n}"><span class="step">${W(S + "step", { n: String(n), total: String(total) })}</span>`
      + `<h2 class="what">${W(S + "step" + n + ".title")}</h2><p>${W(S + "step" + n + ".body")}</p><div class="nav">${nav}</div></div>`
      + (n === 5 ? `<div class="mk-acts"><a class="cs-btn" href="/app/doorbell" data-nav>${W(S + "doorbell")}</a></div>` : "")
      + `<p class="mk-small">${W(S + "nothing")}</p>`;
  },

  acts: [],
};
