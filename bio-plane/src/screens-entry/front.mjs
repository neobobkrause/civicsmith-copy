/* screens-entry R1, R2 (and R8–R11): `front`, "Your group's page", in the public frame at `/` and `/app/front`, drawn
   without a session. The masthead (`groupidentity`: the group's name, its logo when set), its public purpose
   (`groupdescription`'s public parts), what it has published (`publishedlist`), the doorbell and the tour, and members'
   sign-in as a panel: `login` with the handle, the password and the device in the body only, the session handed to the
   shell (`cs.signin`, interface-shell R32); the signed-out, ended and locked states from the record the shell reads
   (`view.session`), the lock's `unlock` and its "Not <handle>?" sign-out (`cs.signout`, interface-shell R47). R16: the
   handle's help is `signin.handle.help`, never a founder hint. R18: a founder signed in with no handle held is taken to
   `setup`, which asks it, before Home. R35: a live session draws the page with "You're signed in as {name}." and "Go to
   Home" in place of the sign-in panel. Every function is self-contained (interface-shell R21). */

export const front = {
  id: "front",

  reads() {
    return {
      identity: { op: "groupidentity" },
      description: { op: "groupdescription", empty: (v) => !(v && v.description) },
      published: { op: "publishedlist", empty: (v) => !(v && Array.isArray(v.cases) && v.cases.some((c) => c && c.withheld !== true)) },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.front.";
    const data = view.data || {};
    const ok = (r) => (r && r.state === "ok" ? r.value : null);
    const id = ok(data.identity) || {};
    // R13: the group's name, or "Your group" while none is set; never its slug
    const named = typeof id.display_name === "string" && id.display_name.trim() ? id.display_name.trim() : "";
    const group = named || { html: W("screen.entry.group") };
    const session = view.session || {};
    const out = [];

    // the masthead (R1, R13): the logo when set (instance-setup R84), served on this origin, else the name's monogram;
    // the name in the design's serif title
    const initials = named.split(/\s+/).filter((x) => /^[\p{L}\p{N}]/u.test(x)).slice(0, 2).map((x) => [...x][0].toUpperCase()).join("");
    const mark = id.logo === true ? `<img class="mk-flogo" src="/app/assets/group-logo" alt="${W("screen.entry.logo", { group })}">`
      : initials ? `<div class="mk-flogo" aria-hidden="true">${E(initials)}</div>` : "";
    out.push(`<header class="mk-fronthead">${mark}<div>`
      + `<h1 class="grp" tabindex="0">${named ? E(named) : group.html}</h1>`
      // a part the group keeps from the public is not drawn (DEC-132): the public answer holds only what is public, and
      // a purpose kept from the public (`description: null`) draws nothing
      + (data.description && data.description.state === "empty" ? "" : cs.state(data.description, (v) => {
        const d = v.description || {};
        return (d.focus ? `<p class="mk-sub">${E(d.focus)}</p>` : "") + (d.purpose ? `<p class="mk-sub">${E(d.purpose)}</p>` : "");
      })) + "</div></header>");

    // the lock (R2): a session record locked on this device draws the lock, and nothing else asks for a password
    if (session.state === "locked") {
      const handle = session.handle || "";
      out.push(cs.sec("screen.front.welcomeback", `<p class="cs-row" data-state="locked">${W("session.locked")}</p>`
        + cs.field("fl-lock", "screen.entry.password", { type: "password", autocomplete: "current-password" })
        + `<div class="mk-acts">${cs.act("unlock", { tone: "primary" })}</div><p>${W(S + "notyou", { handle })} ${String(cs.signout({ label: S + "other" }) || "")}</p>`,
      { fills: { handle } }));
      out.push(`<p class="mk-small">${W("screen.entry.uses", { group })}</p>`);
      return out.join("");
    }

    // R12: nothing published draws no section (a failed read is still drawn as failed)
    const pub = data.published && data.published.state === "empty" ? "" : cs.sec(S + "published", cs.state(data.published, (v) => {
      const bundles = Array.isArray(v.bundles) ? v.bundles : [];
      const cases = (v.cases || []).filter((c) => c && c.withheld !== true);
      // each case edition's title, edition, signing date and signer as answered; the title and signer of its first
      // finding where the case row answers none
      return '<div class="cs-sheet">' + cases.map((c) => {
        const first = bundles.find((b) => b && (c.findings || []).indexOf(b.bundle_id) >= 0) || {};
        const title = c.title || first.title || "";
        const signer = c.signer || c.attestor_member || first.attestor_member || "";
        const when = c.signed_at || c.ratified_at || c.published_at || first.ratified_at || "";
        const meta = W(signer ? S + "edition" : S + "edition.nosigner", { edition: String(c.edition), date: { html: cs.date(when) }, signer });
        return `<div class="cs-row"><a href="/app/published/${encodeURIComponent(c.case_id)}" data-nav>${title ? E(title) : W(S + "untitled")}</a><span class="meta">${meta}</span></div>`;
      }).join("") + "</div>";
    }));
    const door = cs.sec(S + "doorbell", `<p class="mk-note">${W(S + "doorbell.what")}</p><div class="mk-acts"><a class="cs-btn" href="/app/doorbell" data-nav>${W(S + "doorbell.go")}</a></div>`);
    const how = cs.sec(S + "how", `<p class="mk-note">${W(S + "how.what")}</p><div class="mk-acts"><a class="cs-btn" href="/app/tour" data-nav>${W(S + "how.go")}</a></div>`);

    // R35 (DEC-472 (5)): a reader with a live session is not shown the sign-in form or "Not a member yet?": the card
    // says who is signed in and offers the way to Home
    if (session.state === "live") {
      const me = view.me || {};
      const name = String(me.handle || session.handle || me.member || "");
      const card = `<p class="cs-row" data-state="live">${W(S + "signedin", { name })}</p>`
        + `<div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app" data-nav>${W(S + "home")}</a></div>`;
      out.push(`<div class="mk-frontgrid"><div>${pub}${door}${how}</div><div class="mk-signin">${card}</div></div>`);
      out.push(`<p class="mk-small">${W("screen.entry.uses", { group })}</p>`);
      return out.join("");
    }

    // the sign-in panel (R2): the states the record left, the handle, the password and the device
    const said = session.state === "signedout" ? `<p class="cs-row" data-state="signedout">${W("session.signedout")}</p>`
      : session.state === "ended" ? `<p class="cs-row" data-state="ended">${W("session.ended")}</p>` : "";
    const panel = cs.sec(S + "members", said
      + cs.field("fs-handle", S + "handle", { help: "signin.handle.help", autocomplete: "username", value: session.handle || "" })
      + cs.field("fs-pw", "screen.entry.password", { type: "password", autocomplete: "current-password" })
      + cs.checks("fs-device", S + "device", [["own", "session.keep", true], ["shared", "session.shared", false]], { radio: true })
      + `<div class="mk-acts">${cs.act("login", { tone: "primary" })}<a href="/app/forgot" data-nav>${W(S + "forgot")}</a></div>`
      + `<p class="mk-small">${W(S + "notmember")}</p>`);

    // R13: the design's two columns at desktop widths, the sign-in card on the right (one column at the phone width,
    // `shell.css`' 760 px rule)
    out.push(`<div class="mk-frontgrid"><div>${pub}${door}${how}</div><div class="mk-signin">${panel}</div></div>`);
    out.push(`<p class="mk-small">${W("screen.entry.uses", { group })}</p>`);
    return out.join("");
  },

  acts: [
    // the handle, the password and the device in the body only (R2, R8); the session handed to the shell
    { op: "login", rereads: [],
      send(view, el, cs) {
        const handle = String(cs.value("fs-handle") || "").trim();
        const password = String(cs.value("fs-pw") || "");
        if (!handle || !password) return { refuse: "screen.front.incomplete" };
        return { body: { handle, password, device: cs.value("fs-device-1") === true ? "shared" : "own" } };
      },
      async done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const opts = { device: cs.value("fs-device-1") === true ? "shared" : "own", handle: String(cs.value("fs-handle") || "").trim() };
        // R18: the session handed over and whoami read first; a founder holding no handle chooses it on `setup` before
        // Home, anyone else goes on to the page kept to return to, else Home (the record written again, as it was)
        const signed = await cs.signin(a, { ...opts, stay: true });
        const me = cs.me || {};
        if (signed && me.rootOfTrust === true && !me.handle) cs.go("setup");
        else if (signed) await cs.signin(a, opts);
        return { stay: true };
      },
      // a refusal keeps the handle and clears the password (R2)
      refusals: {
        SIGN_IN_REFUSED: (r, cs) => { cs.fill("fs-pw", ""); return cs.w("refusal.SIGN_IN_REFUSED"); },
        SIGN_IN_PAUSED: (r, cs) => {
          cs.fill("fs-pw", "");
          // R2: the plane's `stated` (credentials R38) is the bound it is, drawn as the row's `{stated}`, never as a time
          return cs.w("refusal.SIGN_IN_PAUSED", { stated: String((r && r.stated) || "") });
        },
      } },
    // the lock's password, under the locked session (credentials R65); then the page kept to return to
    { op: "unlock", rereads: [],
      send(view, el, cs) {
        const password = String(cs.value("fl-lock") || "");
        return password ? { body: { password } } : { refuse: "screen.front.nopassword" };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        // a fresh token is handed over as a sign-in is; else the session stays as it was, unlocked, and Home opens
        if (a && a.token) cs.signin(a, { device: "own", handle: (view.session || {}).handle || "" });
        else cs.go("home");
        return { stay: true };
      },
      refusals: { SIGN_IN_REFUSED: (r, cs) => { cs.fill("fl-lock", ""); return cs.w("refusal.SIGN_IN_REFUSED"); } } },
  ],
};
