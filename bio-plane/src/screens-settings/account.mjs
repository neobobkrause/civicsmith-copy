/* screens-settings R3 (and R8, R10): Settings › Your account, the registry's 6 acts. The handle drawn fixed in DEC-197's
   words, with no act that changes it; the member's language; appearance and the explanation level (interface-shell R18,
   R17); the password, typed twice alike before it is sent; expertise; the member's own signing key (its public half, as
   the signing page gives it); links to `connect` and `notes`. Every function is self-contained (interface-shell R21).
   T47: appearance is the kit's own control (`cs.appearance()`, R12); "Sign out on this device" and "Sign out everywhere"
   (`signout`, `signouteverywhere`), each then drawing `front`'s signed-out state (R21); the signing key is made in the
   browser by the kit's signer (`cs.signer`, interface-shell R40) and its public line sent, nothing pasted (R22).
   T50 (R42): the Sounds setting beside Language and Appearance, the kit's `cs.sounds()` (interface-shell R74).
   T51 (R57; DEC-330 C1, A74, A11; DEC-336 (7), (8)): the signing key is made here on the page's terms (the kit's `cs.signer.register`
   with the member's ticks and optional passphrase, deferring the file), and once made says so, with "Save the key file" and "Copy the
   public line" as acts of their own; a key an administrator registered for the member is drawn "registered for you by <who>" (the
   roster, `memberlist`, names who); and a reference to the glossary beside connect, ties and notes. The key file and the passphrase live in
   page memory for the sitting and are never drawn again, stored or sent (R10).
   T51 FR-25 (R67; C81; DEC-376): "Your cover name": the cover the team knows the member by and the handle her work shows, and the choice
   whether the two are published together (`memberpairingset`), read from `memberpairings` and read again after the act.
   T51 fix round 3 (C51; K4398; interface-shell R116): the key section offers "Your key file" beside the key to make: a file chosen is read by the
   kit's `cs.keyFile`, handed to `cs.signer.sign(statements, {keyFile})`, and the key it holds is registered, so no second key is made for one
   member on one device. */

export const account = {
  id: "account",

  reads(view) {
    const me = view.me || {};
    return {
      me: { op: "whoami" },
      language: { op: "memberlanguage" },
      // the languages the group's profiles answer, among which the member's is chosen by name (R31)
      languages: { op: "grouplanguages" },
      expertise: { op: "expertiselist", query: { memberId: me.member } },
      signers: { op: "signerlist" },
      // who registered a key for the member, named by handle (R57; a member's read, `op-declarations`)
      roster: { op: "memberlist" },
      // the pairings the viewer may see: hers, and the published (member-roster R19); R67 reads the stored choice from hers
      pairings: { op: "memberpairings" },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.account.";
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const data = view.data || {};
    const ui = view.ui || {};
    const me = data.me && data.me.state === "ok" && data.me.value ? data.me.value : view.me || {};
    const out = [cs.title()];

    // the handle, fixed (DEC-197): no act changes it, and nothing says "formerly"
    out.push(cs.sec(S + "handle.heading", `<p><b>${E(me.handle || me.member || "")}</b></p><p>${W("handle.fixed")}</p>`));

    // language, appearance and the explanation level. Every language is shown by its name in the member's language and
    // chosen by name, never as a tag (R31)
    const langOf = data.language && data.language.state === "ok" && data.language.value ? data.language.value.language || null : null;
    const nameOf = (tag) => {
      try { const n = new Intl.DisplayNames([langOf || "en"], { type: "language" }).of(String(tag)); return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(tag); } catch (e) { return String(tag); }
    };
    let lang = cs.state(data.language, (v) => {
      let h = `<p data-state="language">${v.language ? W(S + "language.now", { language: nameOf(v.language) }) : W(S + "language.device")}</p>`;
      const set = cs.act("memberlanguageset");
      if (set) {
        const group = data.languages && data.languages.state === "ok" && data.languages.value && Array.isArray(data.languages.value.languages) ? data.languages.value.languages : [];
        const tags = v.language && group.indexOf(v.language) < 0 ? [v.language, ...group] : group;
        h += cs.choice("ma-lang", S + "language.field", [{ value: "", key: S + "language.device" }, ...tags.map((t) => ({ value: String(t), text: nameOf(t) }))], { value: v.language || "" }) + `<p class="mk-small">${W(S + "language.help")}</p>${set}`;
      }
      return h;
    });
    // appearance is kept on the device (interface-shell R18): the kit's own control (R12; interface-shell R27)
    lang += cs.appearance();
    // Sounds (R42; interface-shell R74): the kit's own control, off by default and kept on the device, so nothing is sent for it
    lang += typeof cs.sounds === "function" ? cs.sounds() : "";
    // the explanation level is the shell's (R17): its value, and its act through the shell's own setting
    const lv = cs.level() === "pause" ? "pause" : "prompt";
    lang += cs.choice("ma-level", S + "level.field", ["prompt", "pause"].map((v) => [v, "level." + v + ".name"]), { value: lv }) + cs.act("infolevelset");
    out.push(cs.sec(S + "language.heading", lang));

    // what the member knows
    let ex = cs.state(data.expertise, (v) => {
      const list = (v.expertise || []).filter((e) => e.state !== "withdrawn");
      return list.length === 0 ? "" : `<ul class="mk-list">${list.map((e) => `<li>${W(e.confirmed ? S + "expertise.confirmed" : S + "expertise.declared", { label: e.label })}</li>`).join("")}</ul>`;
    });
    const dec = cs.act("expertisedeclare");
    if (dec) ex += `${cs.field("ma-exp", S + "expertise.field", { help: S + "expertise.help" })}${dec}`;
    out.push(cs.sec(S + "expertise.heading", ex));

    // R67: the cover the team knows her by and the handle her work shows, and whether the two are published together; the stored choice is
    // the one chosen, none else. A member the pairings do not hold (the founder holds no cover) or a read that failed is drawn no choice
    const mineP = data.pairings && data.pairings.state === "ok" && data.pairings.value && Array.isArray(data.pairings.value.pairings)
      ? data.pairings.value.pairings.find((x) => x && x.handle !== null && x.handle === me.handle) || null : null;
    const pairSet = mineP ? cs.act("memberpairingset", { label: S + "pairing.save" }) : "";
    if (pairSet) {
      const pub = mineP.published === true;
      out.push(cs.sec(S + "pairing.head", `<p>${W(S + "pairing.says", { cover: mineP.cover, handle: me.handle })}</p><p>${W(S + "pairing.choose")}</p>${cs.checks("ma-pair", S + "pairing.legend", [["private", S + "pairing.private", !pub], ["public", S + "pairing.public", pub]], { radio: true })}<p class="mk-note">${W(S + "pairing.change")}</p>${pairSet}<p class="mk-note">${W(S + "pairing.undone")}</p>`));
    }

    // the password, typed twice alike (setup-page R3's rule); no field is drawn with what was typed (R10)
    const pw = cs.act("setpassword");
    // the fields drawn anew, empty, after each change (the shell keeps a field's value by its id; R10)
    const g = ui.pwGen || 0;
    if (pw) out.push(cs.sec(S + "password.heading", (ui.passwordChanged ? `<p data-shown="password">${W(S + "password.changed")}</p>` : "") + `${cs.field("ma-cur" + g, S + "password.current", { type: "password", autocomplete: "current-password" })}${cs.field("ma-new" + g, S + "password.new", { type: "password", help: S + "password.help", autocomplete: "new-password" })}${cs.field("ma-again" + g, S + "password.again", { type: "password", autocomplete: "new-password" })}${pw}`));

    // the member's own signing key: its public half, registered or revoked (friction by weight, interface-shell R11). A key an administrator
    // registered for her is drawn as that, with the note that only she can sign with it (R57); one she made herself as before
    const roster = data.roster && data.roster.state === "ok" && data.roster.value && Array.isArray(data.roster.value.members) ? data.roster.value.members : [];
    // who registered it: a member id, `admin` (the founder: her handle, else `member.founder.unnamed`), or `not recorded` (credentials R21)
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const whoOf = (id) => {
      const x = String(id == null ? "" : id).replace(/^member:/, "");
      if (!x || x === "not recorded") return null;
      if (x === "admin") { const f = roster.find((r) => r.founder === true || r.member_id === "admin"); return (f && f.handle) || T("member.founder.unnamed"); }
      const m = roster.find((r) => r.member_id === x);
      return (m && m.handle) || cs.memberName(x);
    };
    /* a member with no key held has nothing to list: the section is not drawn (screens-settings R28: a section that holds nothing is not drawn) */
    const held = cs.state(data.signers, (v) => {
      const mine = (v.signers || []).filter((s) => s.member_id === me.member && s.status === "active");
      return mine.length === 0 ? "" : `<ul class="mk-list">${mine.map((s) => {
        const by = s.origin === "admin" ? whoOf(s.registered_by) : null;
        const tail = "…" + String(s.key_b64).slice(-8);
        const line = by && s.added ? `${W(S + "registered.for.you.by.rosa", { member: by, date: D(s.added) })} ${W(S + "only.you.can.sign.with")}`
          : s.added ? W(S + "key.held", { key: tail, date: D(s.added) }) : W("screen.members.signer.held.nodate", { key: tail });
        return `<li data-key-origin="${s.origin === "admin" ? "admin" : "self"}">${line} ${cs.act("signerrevokeown", { data: { key: s.key_b64 } })}</li>`;
      }).join("")}</ul>`;
    });
    if (held) out.push(cs.sec(S + "key.heading", held));

    // making the key (R57 (1)): kept on this device if ticked, else a key file made under the passphrase typed here (optional)
    const reg = cs.act("signerregisterown");
    // C51: a member who already has a key file (made earlier, here or on another device) chooses it instead of making another: the kit reads it
    // (`cs.keyFile`) and the key it holds is the one registered; with no file chosen the key is made as before
    if (reg) out.push(cs.sec(S + "key.make.heading", `<p class="mk-note">${W(S + "key.help")}</p><label for="ma-keep"><input type="checkbox" id="ma-keep">${W("signing.ceremony.keepkey")}</label>${cs.field("ma-pass", S + "key.passphrase", { type: "password", help: S + "key.passphrase.help", autocomplete: "new-password" })}${cs.field("ma-keyfile", "shell.signer.loadfile", { type: "file", help: "shell.signer.load" })}${reg}`));

    // after it is made (R57 (2)): its tail and day, the public line as data, and two acts of their own; the file lives in page memory only
    const made = ui.made || null;
    if (made) out.push(cs.sec(S + "key.made.heading", `<p data-shown="key">${W(S + "key.held", { key: made.tail, date: D(made.at) })}</p><p class="mk-small"><code>${E(made.line)}</code></p><p>${W(S + "key.save")}</p><p>${made.file ? cs.save("bio-signing-key.txt", made.file, { label: S + "key.savefile" }) : ""}${cs.copy(made.line, { label: S + "key.copyline" })}</p><p class="mk-small">${W(S + "key.lost")}</p>`));

    // signing out: on this device, or everywhere (R21)
    const out1 = cs.act("signout"), out2 = cs.act("signouteverywhere");
    if (out1 || out2) out.push(cs.sec(S + "signout.heading", out1 + out2));

    // elsewhere in the member's settings
    // the glossary is reached from here too (R57 (4)): its name, with its purpose beneath, as the design's link list draws it (R59)
    out.push(cs.sec(S + "elsewhere.heading", `<div class="mk-links"><a class="cs-ref" href="/app/connect">${W("screen.connect.name")}</a><a class="cs-ref" href="/app/ties" data-nav data-screen="ties">${W("screen.ties.name")}</a><a class="cs-ref" href="/app/notes">${W("screen.notes.name")}</a><a class="cs-ref" href="/app/glossary" data-nav data-screen="glossary">${W("screen.glossary.name")}</a><span class="mk-small">${W("screen.glossary.purpose")}</span></div>`));
    return out.join("");
  },

  acts: [
    { op: "memberlanguageset", rereads: ["language"],
      send(view, el, cs) { const t = String(cs.value("ma-lang") || "").trim(); return { body: { language: t || null } }; } },
    // the owed act `owed:infolevelset` (DEC-162), served by instance-setup R79: sent by the shell's own setting, which also
    // keeps the level on the device and redraws the frame (interface-shell R17), so nothing more is sent from here
    { op: "infolevelset", rereads: [],
      send(view, el, cs) { cs.setLevel(cs.value("ma-level") === "pause" ? "pause" : "prompt"); return null; } },
    { op: "expertisedeclare", rereads: ["expertise"],
      send(view, el, cs) { const label = String(cs.value("ma-exp") || "").trim(); return label ? { body: { label } } : { refuse: "screen.account.expertise.nolabel" }; } },
    // sent only when the new password is typed twice alike; neither is kept, drawn again or sent again (R10)
    { op: "setpassword", rereads: [],
      send(view, el, cs) {
        const g = (view.ui && view.ui.pwGen) || 0;
        const password = cs.value("ma-new" + g), again = cs.value("ma-again" + g);
        if (!password || password !== again) return { refuse: "screen.account.password.differ" };
        return { body: { current: String(cs.value("ma-cur" + g) || ""), password: String(password) } };
      },
      done(view, answer, cs) { cs.set("pwGen", ((view.ui && view.ui.pwGen) || 0) + 1); cs.set("passwordChanged", true); } },
    // the key made on this device by the kit's signer (interface-shell R40), its public line `ssh-ed25519 <base64>
    // <label>` sent as credentials R9 takes it; a member who declines sends nothing
    { op: "signerregisterown", rereads: ["signers"],
      async send(view, el, cs) {
        // C51 (interface-shell R116): a key file chosen is handed to the signer as the text the kit read, which asks only its passphrase; the key it
        // holds is the key registered, and nothing is signed for anyone (the one statement shown is the registration itself). An unreadable or empty
        // file is refused in the kit's word; no file chosen is the key made as before.
        const kf = await cs.keyFile("ma-keyfile");
        // the kit's word for a file it could not read; until the list holds it, the sign dialog's own "that isn't a signing key file"
        if (!kf.ok && kf.word !== "shell.keyfile.none") return { refuse: cs.w(kf.word) === kf.word ? "shell.signer.notkey" : kf.word };
        let r;
        if (kf.ok) {
          const plain = (k) => String(cs.w(k)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
          const me = view.me || {};
          r = await cs.signer.sign([{ label: plain("act.signerregisterown.label.account"), bytes: "bio-register-key " + String(me.handle || me.member || "") + "\n", namespace: "bio-register-key" }], { keyFile: kf.text });
        } else {
          const keep = cs.value("ma-keep") === true;
          // the passphrase is typed here (optional): with it, or the empty string, the kit opens no dialog; the file is held for the sitting (R57; interface-shell R97)
          r = await cs.signer.register({ keep, passphrase: String(cs.value("ma-pass") || ""), defer: true });
        }
        if (!r || r.ok === false) return { refuse: "screen.account.key.declined" };
        const parts = String(r.line || "").trim().split(/\s+/);
        if (parts[0] !== "ssh-ed25519" || !/^AAAA[A-Za-z0-9+/=]+$/.test(parts[1] || "")) return { refuse: "screen.account.key.declined" };
        // held until the plane answers (R8); never stored, drawn again or sent (R10)
        view.ui.madePending = { line: parts.join(" "), file: r.kept ? null : typeof r.file === "string" ? r.file : null, tail: "…" + parts[1].slice(-8), at: new Date(typeof cs.now === "function" ? cs.now() : Date.now()).toISOString() };
        const comment = parts.slice(2).join(" ");
        return { body: comment ? { keyB64: parts[1], comment } : { keyB64: parts[1] } };
      },
      done(view, answer, cs) {
        const pending = view.ui && view.ui.madePending;
        cs.set("madePending", null);
        if (pending) cs.set("made", pending);
      } },
    { op: "signerrevokeown", rereads: ["signers"],
      send(view, el) { return { body: { keyB64: el.dataset.key } }; } },
    // then the shell draws `front`'s signed-out state, as the masthead's "Sign out" does (interface-shell R4, R32)
    // whether the cover and the handle are published together: the stored choice is the one drawn chosen, and the answer is read back (R67)
    { op: "memberpairingset", rereads: ["pairings"],
      send(view, el, cs) { return { body: { memberId: String((view.me && view.me.member) || ""), published: cs.value("ma-pair-1") === true } }; } },
    { op: "signout", rereads: [],
      send() { return { body: {} }; },
      done(view, answer, cs) { cs.signedOut(); return { stay: true }; } },
    { op: "signouteverywhere", rereads: [],
      send() { return { body: {} }; },
      done(view, answer, cs) { cs.signedOut(); return { stay: true }; } },
  ],
};
