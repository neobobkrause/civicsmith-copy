/* screens-entry R4 (and R8–R11): `forgot`, "Forgot your password", in the public frame. Three ways back in: one of the
   member's recovery codes (`recover`, the handle, the code and the new password in the body only, the password typed
   twice alike), an administrator's reset link, and, when no administrator can get in, the hosting account's way in
   members' words (`FORGOT_HELP`, instance-setup R47), drawn for every visitor; the founder's `HOSTING_CONTROL` block
   is setup's only (R6). Every refusal of a code is one sentence. R16: the handle's help is `forgot.handle.help`, never
   a founder hint. R36: the codes' form sits in `front`'s sign-in column, never wider than the sign-in panel.
   Self-contained (interface-shell R21). */

export const forgot = {
  id: "forgot",

  reads() { return {}; },

  render(cs, view) {
    const W = cs.w, S = "screen.forgot.";
    const ui = view.ui || {};
    const out = [cs.title(), `<p class="mk-sub">${W(S + "lede")}</p>`];
    // R36: the codes' form keeps the public column, `front`'s sign-in card (`mk-signin` in `mk-frontgrid`), so at
    // desktop widths its fields are no wider than the sign-in panel's; one column at the phone width (shell.css' 760 px rule)
    const card = ui.done
      // R12: no count at zero: the last code spent has its own sentence
      ? `<p class="cs-row" data-state="done">${ui.done.remaining > 0 ? W(S + "done", { remaining: String(ui.done.remaining) }) : W(S + "done.last")}</p><div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app/front" data-nav>${W("screen.entry.signin")}</a></div>`
      : cs.sec(S + "codes", cs.field("fg-handle", "screen.front.handle", { help: "forgot.handle.help", autocomplete: "username" })
        + cs.field("fg-code", S + "code", { help: S + "code.help", autocomplete: "off" })
        + cs.field("fg-pw", "screen.entry.newpassword", { type: "password", help: "screen.entry.twelve", autocomplete: "new-password" })
        + cs.field("fg-pw2", "screen.entry.again", { type: "password", autocomplete: "new-password" })
        + `<div class="mk-acts">${cs.act("recover", { tone: "primary" })}</div>`);
    // the hosting account's way (R4): FORGOT_HELP's words, carried by key, for every visitor; never HOSTING_CONTROL
    const help = [];
    for (let i = 1; i < 20; i++) { const k = S + "help.s" + i; const t = W(k); if (t === k) break; help.push(`<p class="mk-note">${t}</p>`); }
    const ways = cs.sec(S + "admin", `<p class="mk-note">${W(S + "admin.what")}</p>`) + cs.sec(S + "help.heading", help.join(""));
    out.push(`<div class="mk-frontgrid"><div>${ways}</div><div class="mk-signin">${card}</div></div>`);
    return out.join("");
  },

  acts: [
    // R4, R8: two passwords that differ send nothing; the handle, code and password in the body only
    { op: "recover", rereads: [],
      send(view, el, cs) {
        const handle = String(cs.value("fg-handle") || "").trim();
        const code = String(cs.value("fg-code") || "").trim();
        const password = String(cs.value("fg-pw") || "");
        if (!handle || !code) return { refuse: "screen.forgot.incomplete" };
        if (password !== String(cs.value("fg-pw2") || "")) return { refuse: "screen.entry.differ" };
        if (password.length < 12) return { refuse: "screen.entry.short" };
        return { body: { handle, code, password } };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        cs.set("done", { remaining: a && Number.isFinite(Number(a.remaining)) ? Number(a.remaining) : 0 });
        return { stay: true };
      },
      // one sentence for every arm of a code that did not work (credentials R47, R71 (5)); the code cleared
      refusals: {
        RECOVERY_REFUSED: (r, cs) => { cs.fill("fg-code", ""); return cs.w("refusal.RECOVERY_REFUSED"); },
        PASSWORD_TOO_SHORT: "refusal.PASSWORD_TOO_SHORT",
        SIGN_IN_PAUSED: (r, cs) => {
          // R2: the plane's `stated` (credentials R38) is the bound it is, drawn as the row's `{stated}`, never as a time
          return cs.w("refusal.SIGN_IN_PAUSED", { stated: String((r && r.stated) || "") });
        },
      } },
  ],
};
