/* screens-settings R4, R5 (and R8, R9, R10): Settings › The assistant, the registry's 7 acts with its two re-points
   (`subscriptionsignin` for the owed sign-in, `subscriptiondisconnect` beside `accountreferenceremove`; interface-shell
   R21). It draws exactly one of four situations: the group keeps its material away from AI; the member's own account
   serves them; the group's key serves them; nothing serves yet. Connecting is offered in DEC-156's order (the
   subscription, only while the sign-in is installed; then an API key; then
   skipping), once the disclosure of what connecting means is read. A key or code is sent in the request's body only,
   and never kept, drawn or sent again (R10). Every function is self-contained (interface-shell R21).
   T47: the sign-in is offered only while `op=bootstrap`'s flat `part_signin` answers `true` (R13, instance-setup R82);
   every sign-in refusal is drawn in words, the shell adding its reference (R24, interface-shell R39); the subscription's
   state is read from the plane (`accountreference`'s `subscription`, credentials R70): since when, until when, refused at
   Anthropic ("connect again"); a failed state read is said, never drawn as not connected.
   T50 (R49, R50, R54): the page the design draws, in every state: one card saying what serves the member, then parts that open
   and close; a sign-in that has expired is said and offered again; a code being exchanged is not sent twice. R41 and R53 (the
   connection check) wait for the remote proof (agent-runner R38) and are not drawn.
   T51 FR-25 (R76; K4203): `accountreferenceset` and `accountreferenceremove` send only the fields `ai-accounts` declares (its R35): the door
   stamps whose reference it is from the session, so the body names no member. */

export const connect = {
  id: "connect",

  reads(view) {
    const me = view.me || {};
    const own = "member:" + me.member;
    return {
      assistant: { op: "assistantstate" },
      keepaway: { op: "aikeepawaystate" },
      groupkey: { op: "groupkeystate" },
      notice: { op: "groupkeynotice" },
      // `disclosureshown` records the door's `by`: `member:<id>`, or `admin` for the founder's session
      disclosure: { op: "disclosureof", query: { member: me.member === "admin" ? "admin" : own } },
      reference: { op: "accountreference" },
      // a mutating op (control-plane R65), so its state is asked in a body
      signin: { op: "subscriptionsignin", body: { step: "state" } },
      boot: { op: "bootstrap" },
      uses: { op: "accountuses", query: { owner: own } },
      limits: { op: "ailimits", query: { owner: own } },
      usage: { op: "aiusage", query: { owner: own } },
      history: { op: "accounthistory", query: { owner: own } },
      over: { op: "aiuseovertime", query: { owner: own } },
      // the member's own use across every payer, with the limits that bind them (ai-use R4; J2's last point)
      mine: { op: "aiusage" },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.connect.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const ui = view.ui || {};
    const data = view.data || {};
    const okv = (o) => (o && o.state === "ok" && o.value && o.value.ok !== false ? o.value : null);
    const outward = (inner) => `<div class="mk-msg"><p class="cs-tag-outward">${W("mark.outward.means")}</p>${inner}</div>`;
    // who did it, by handle: the viewer by their own, the founder by hers or `member.founder.unnamed`, never the id `admin` and never a
    // bare "you" (R37: every fill filled)
    const names = (by) => {
      const id = String(by || "").replace(/^member:/, "");
      if (id === me.member && me.handle) return me.handle;
      return cs.memberName(id);
    };
    const out = [cs.title(), `<p>${W(S + "optional")}</p>`];
    // a part that opens and closes (R49; the design's `.cs-part`): a number, its title, one line of why; anything needed before the first
    // question is marked "Needed first". A part with nothing in it is never drawn (R28).
    let n = 0;
    const part = (title, why, inner, o = {}) => {
      if (!inner) return;
      n += 1;
      out.push(`<details class="cs-part" data-part="${n}"${o.needed ? ' data-state="needed"' : ""}${o.open ? " open" : ""}><summary><span class="n">${n}</span><span class="t">${W(title)}</span>${why ? `<span class="why">${W(why)}</span>` : ""}${o.needed ? `<span class="cs-due">${W("screen.setup.state.needed")}</span>` : ""}<span class="chev" aria-hidden="true"></span></summary><div class="body">${inner}</div></details>`);
    };
    const whoPays = () => out.push(`<details class="mk-details" data-fold="whopays"><summary>${W(S + "whopays.summary")}</summary><p class="mk-note">${W("ai.whopays")}</p></details>`);

    // the situation: exactly one of the drawing's five (R4, R49)
    const ka = okv(data.keepaway), as = okv(data.assistant);
    let kept = null;
    if (ka && ka.on === true) kept = { by: ka.set_by, at: ka.set_at, reason: ka.reason };
    else if (as && as.on === false) kept = { by: as.set_by, at: as.set_at, reason: as.reason };
    else if (ka && ka.on !== false && !as) kept = { by: null, at: null, reason: null };
    if (!kept && !as && !ka) return out.join("") + cs.state(data.assistant, () => "");
    if (kept) {
      // the team keeps its material away from AI: one card, who, when, the reason in the administrator's words, and no act
      out.push(`<div class="mk-msg" data-situation="keptaway"><p>${kept.by ? W(S + "keptaway", { by: names(kept.by), date: D(kept.at) }) : W(S + "keptaway.unread")}${kept.reason ? ` <span class="rec">${E(kept.reason)}</span>` : ""}</p><p>${W(S + "keptaway.ask")}</p></div>`);
      whoPays();
      return out.join("");
    }
    const ref = okv(data.reference), sub = okv(data.signin), gk = okv(data.groupkey);
    // the subscription's state as the plane holds it (credentials R70): the reference's own read, else the sign-in's
    const st = ref && ref.subscription ? ref.subscription : sub || {};
    // neither the reference nor the sign-in's state could be read: whether the member's own account serves them is not
    // known, so no situation is drawn and the failed read is said, never "not connected" (R24)
    if (!ref && !sub) {
      const failed = data.reference && data.reference.state === "failed" && data.signin && data.signin.state === "failed";
      return out.join("") + (failed ? `<p data-state="signinread">${W(S + "signin.statefailed")}</p>` : "") + cs.state(data.reference, () => "");
    }
    // a sign-in Anthropic no longer accepts (R54): past `valid_until`, or refused at Anthropic
    const lapsed = st.valid_until && Date.parse(st.valid_until) <= cs.now() ? st.valid_until : !st.connected && st.refused_at ? st.refused_at : null;
    const expired = !!lapsed;
    const subscribed = st.connected === true && !expired;
    const keyed = !!(ref && ref.held === true);
    const groupServes = !!(gk && gk.on === true);
    const situation = subscribed || keyed ? "own" : expired ? "expired" : groupServes ? "group" : "none";
    const admin = me.administer === true;

    // a member's allowance on the team's key, from the member's own use across every payer (ai-use R4)
    const mine = okv(data.mine);
    const payer = mine && (mine.payers || []).find((p) => p.whose === "group");
    const lim = payer && (payer.limits || []).find((l) => l.scope === "per_member" && l.period === "day");
    const amountOf = (a, u) => (u === "usd" ? "$" + Number(a).toFixed(2) : Number(a).toLocaleString("en"));
    const limitText = (l) => T("screen.panel.amount", { amount: amountOf(l.amount, l.unit), unit: T("screen.panel.unit." + l.unit), period: T("screen.panel.period." + l.period) });
    const answered = (x) => x !== null && x !== undefined && Number.isFinite(Number(x));

    // the card: what serves the member now
    if (situation === "own") {
      const since = subscribed ? st.since : ref && ref.set_at;
      const lead = subscribed ? (st.since ? W(S + "own.subscription", { date: D(st.since) }) : "") : W(S + "own.apikey");
      const until = subscribed && st.valid_until ? W(S + "own.until", { date: D(st.valid_until) }) + `<br>${W(S + "own.until.again")}` : "";
      const when = !subscribed && since ? W(S + "own.since", { date: D(since) }) : "";
      out.push(`<div class="mk-msg" data-situation="own">${lead ? `<p>${lead}${subscribed ? ` <span class="cs-due" data-due="met">${W(S + "connected")}</span>` : ""}</p>` : ""}${when || until ? `<p data-state="since">${when}${when && until ? " " : ""}${until}</p>` : ""}${groupServes ? `<p>${W(S + "own.thengroup")}</p>` : ""}</div>`);
    } else if (situation === "expired") {
      out.push(`<div class="mk-msg" data-situation="expired"><p>${W(S + "expired", { date: D(lapsed) })} <span class="cs-due" data-due="late">${W(S + "expired.state")}</span></p><p>${W(S + "expired.means")}</p><p>${W(S + "expired.next")}</p>${cs.act("subscriptionsignin", { data: { step: "start" } })}</div>`);
    } else if (situation === "group") {
      let allowance = "";
      if (lim && lim.reached) allowance = " " + W(S + "group.allowance.reached", { period: T("screen.panel.period." + lim.period) });
      else if (lim) {
        allowance = " " + W(S + "group.allowance", { limit: limitText(lim) });
        // what they have used of it: only to an owner of the paying account, and only when the read answers it (R50)
        if (admin && lim.period === "day" && answered(lim.used)) allowance += " " + W(S + "group.allowance.used", { used: amountOf(lim.used, lim.unit), when: T("ai.usage.today") });
      }
      let share = "";
      if (lim && answered(lim.used) && answered(lim.amount) && Number(lim.amount) > 0) {
        const pct = Math.min(100, Math.round(100 * Number(lim.used) / Number(lim.amount))), near = pct >= 80;
        const says = W("ai.usage.meter", { label: T(S + "meter.groupshare"), used: amountOf(lim.used, lim.unit), limit: amountOf(lim.amount, lim.unit) });
        share = `<div class="mk-meter"${near ? ' data-near="1"' : ""} data-level="2" data-tip="${W("ai.usage.meter.means")}"><div class="l"><span>${says}</span><span class="pct">${pct}%${near ? " · " + W("ai.usage.meter.near") : ""}</span></div><div class="track" role="img" aria-label="${says}"><i style="width:${pct}%"></i><b style="left:80%"></b></div></div>`;
      }
      out.push(`<div class="mk-msg" data-situation="group"><p>${W(S + "group")}${allowance}</p>${share}</div>`);
    } else out.push(`<div class="mk-msg" data-situation="none"><p>${W(S + "none")}</p></div>`);
    // a read that did not answer is said, never taken as "nothing serves" (interface-shell R10)
    if (!ref) out.push(cs.state(data.reference, () => ""));
    if (!gk) out.push(cs.state(data.groupkey, () => ""));

    const panel = (only, o2) => (view.parts && view.parts.aiPanel ? view.parts.aiPanel(cs, view, { owner: "member:" + me.member, explore: false, perMember: false, names, only, bare: true, ...(o2 || {}) }) : "");

    if (situation === "own") {
      // on her own account: what the assistant may do, a limit if she wants one, her use, and disconnecting
      const uses = okv(data.uses) && okv(data.uses).uses ? okv(data.uses).uses : null;
      const EVERYDAY = ["ask", "draft", "run", "enquire", "read", "transcribe", "account"], UNASKED = ["suggestions", "standing"];
      // one style for every use: the checkbox beside its plain name, explained by what it covers; the design's `checks`
      const box = (u) => `<label><input type="checkbox" id="mu-${u}"${uses && uses[u] ? " checked" : ""}> <b>${W("ai.use." + u + ".name")}</b> · ${W("ai.use." + u + ".means")}</label>`;
      const save = cs.act("accountusesset", { data: { own: "1" } });
      part(S + "part.uses", S + "part.uses.why", uses && save ? `<fieldset class="cs-field" id="mu-every"><legend>${W(S + "uses.everyday")}</legend>${EVERYDAY.map(box).join("")}</fieldset><fieldset class="cs-field" id="mu-unasked"><legend>${W(S + "uses.unasked")}</legend>${UNASKED.map(box).join("")}<p class="mk-note">${W(S + "uses.unasked.help")}</p></fieldset>${save}` : "", { open: true });
      part(S + "part.limit", S + (subscribed ? "part.limit.why.subscription" : "part.limit.why.apikey"), panel("limits", { units: subscribed ? ["tokens", "calls"] : undefined }) + `<p class="mk-note">${W(S + "limit.binds")}</p>`, {});
      // her use is hers alone: never a cost per answer
      part(S + "part.use", S + "part.use.why", panel("usage"), {});
      const dis = (subscribed ? cs.act("subscriptiondisconnect", { label: S + "disconnect.subscription" }) : "") + (keyed ? cs.act("accountreferenceremove") : "");
      part(S + "disconnect.heading", "", dis ? `<p>${W(groupServes ? S + "own.thengroup" : S + "none")}</p>${dis}` : "", {});
    } else {
      // the team's key: the notice to read before the first question, her daily allowance, her use
      const notice = okv(data.notice);
      if (situation === "group") {
        if (notice && notice.due === true) part(S + "notice.heading", S + "part.notice.why", outward(`<p>${W(S + "notice.group")}</p>${cs.act("groupkeynoticeseen")}`), { needed: true, open: true });
        if (lim) {
          let h = `<p>${W(S + "grouplimits", { limit: limitText(lim) })}</p>`;
          // what they have used and the suggestions switch: only to an owner of the paying account, each only when answered (R50)
          if (admin && answered(lim.used)) h += `<p>${W(S + "grouplimits.used", { used: amountOf(lim.used, lim.unit) })}</p>`;
          if (admin && gk && typeof gk.suggestions === "boolean") h += `<p>${W(S + "grouplimits.suggestions", { suggestions: T(gk.suggestions ? "screen.panel.on" : "screen.panel.off") })}</p>`;
          part(S + "part.allowance", S + "part.allowance.why", h, {});
        }
        part(S + "part.use", S + "part.use.why", panel("usage"), {});
      }
      // connecting one's own account (R5), once the disclosure of what it means is read
      const disc = okv(data.disclosure);
      if (disc && disc.shown !== true) part(S + "part.before", S + "part.before.why", outward(`<p>${W(S + "disclosure.own")}</p>${cs.act("disclosureshown", { data: { version: disc.version || "" } })}`) + `<p>${W(S + "disclosure.then")}</p>`, { needed: true, open: true });
      else if (!disc) { const d = cs.state(data.disclosure, () => ""); if (d) out.push(d); }
      const c = disc && disc.shown === true ? (() => {
        let h = "";
        const boot = okv(data.boot);
        // the sign-in's part, read flat (R13; instance-setup R82): `true` installed, `false` not, `null` not read
        const pt = boot ? boot.part_signin : null;
        // R30, R49: one choice first, the subscription preselected (DEC-156's order); only the chosen path's steps are drawn, and "Not now" draws nothing more
        h += cs.choice("mc-way", S + "way.field", [["subscription", S + "way.subscription"], ["apikey", S + "way.apikey"], ["later", S + "way.later"]], { acts: {}, value: "subscription" });
        const way = ui["choice:mc-way"] || "subscription";
        if (way === "subscription") {
          if (pt === true) {
            // the expired card already offers the sign-in page (R54): not offered twice
            let start = situation === "expired" ? "" : cs.act("subscriptionsignin", { data: { step: "start" } });
            let code = cs.act("subscriptionsignin", { label: S + "signin.withcode", data: { step: "code" } });
            // "Open Anthropic's sign-in page" is not pressed again while a start is in flight (R24); a code being exchanged is not sent
            // again, the page saying it is working (R50)
            if (ui.starting) start = start.replace('<button type="button"', '<button type="button" disabled aria-disabled="true"');
            if (ui.exchanging) code = code.replace('<button type="button"', '<button type="button" disabled aria-disabled="true"') + `<span class="mk-small" role="status" data-state="working">${W("shell.working")}</span>`;
            if (start || code) {
              const open = ui.signinAddress ? `<div class="mk-links" data-shown="signin"><a class="cs-ref" href="${E(ui.signinAddress)}" target="_blank" rel="noopener noreferrer">${W(S + "signin.open")}</a></div>` : "";
              h += `<h3>${W(S + "signin.heading")}</h3><ol class="mk-list"><li>${W(S + "signin.step1")}</li><li>${W(S + "signin.step2")}</li><li>${W(S + "signin.step3")}</li><li>${W(S + "signin.step4")}</li></ol>${start}${open}${cs.field("mc-code" + (ui.gen || 0), S + "signin.code", { type: "password", help: S + "signin.whole", autocomplete: "off" })}<p class="mk-note">${W(S + "signin.help")}</p>${code}`;
              // the password asked again (DEC-249; the registry's `reauth`): the shell asks it when an act is answered REAUTH_DUE; here it can be
              // given beforehand. The field is cleared by the shell after the act (interface-shell R21)
              const re = cs.act("reauth");
              if (re) h += `<details class="mk-details"><summary>${W(S + "reauth.summary")}</summary><p>${W("session.reauth")}</p>${cs.field("mc-reauth", "shell.password", { type: "password", autocomplete: "current-password" })}${re}</details>`;
              // what the sign-in can answer instead of connecting, beside the code (R38, DEC-246): each refusal by its key, its reference
              // as the shell draws one (`refusal.reference`, interface-shell R69). The runner's own word and a reference are shown as examples
              h += `<details class="mk-details" data-list="ifnot"><summary>${W("connect.ifnot")}</summary><div>${["refusal.NO_SIGNIN_WAITING", "refusal.SIGNIN_REFUSED", "refusal.SIGNIN_UNAVAILABLE", "refusal.SIGNIN_ADDRESS_UNEXPECTED", "refusal.AGENT_WORKER_UNBOUND", "instance.part.signin.absent"].map((k) => `<p class="mk-msg" data-refusal="${k}">${W(k, k === "refusal.SIGNIN_REFUSED" ? { detail: "invalid_grant" } : {})}</p>`).join("")}<p class="mk-small">${W(S + "refusal.reference", { example: T("refusal.reference", { ref: "7f3a91c2" }) })}</p></div></details>`;
            }
          } else h += `<p data-state="signin">${pt === false ? W("instance.part.signin.absent") : W("instance.part.unknown", { part: T(S + "signin.part") })}</p>`;
        } else if (way === "apikey") {
          const set = cs.act("accountreferenceset", { label: S + "apikey.connect" });
          if (set) h += `<h3>${W(S + "apikey.heading")}</h3>${cs.field("mc-key" + (ui.gen || 0), S + "apikey.field", { type: "password", help: S + "apikey.help", autocomplete: "off" })}${set}`;
        } else h += `<p class="mk-note" data-state="notnow">${W("connect.notnow")}</p>`;
        return h;
      })() : "";
      part(S + "own.heading", "", c ? `<div id="connect-own">${c}</div>` : "", { open: situation !== "group" });
    }
    whoPays();
    return out.join("");
  },

  acts: [
    { op: "groupkeynoticeseen", rereads: ["notice"], outward: true,
      send() { return { body: {} }; } },
    { op: "disclosureshown", rereads: ["disclosure"], outward: true,
      send(view, el) { const me = view.me || {}; return { body: { member: me.member === "admin" ? "admin" : "member:" + me.member, version: el.dataset.version } }; } },
    // the member's own sign-in (DEC-156; control-plane R65): start, then the code. A start in flight disables its button
    // until it answers (R24): set before it is sent, cleared by its answer or by any refusal (each drawn in words, R24)
    { op: "subscriptionsignin", rereads: ["signin", "reference", "uses", "limits", "usage", "history"],
      send(view, el, cs) {
        if (el.dataset.step === "start") { cs.set("starting", true); return { body: { step: "start" } }; }
        // a code being exchanged (up to 60 seconds) is not sent again (R50): the first answer is the outcome drawn
        if (view.ui && view.ui.exchanging) return null;
        const code = String(cs.value("mc-code" + ((view.ui && view.ui.gen) || 0)) || "").trim();
        if (!code) return { refuse: "screen.connect.signin.nocode" };
        cs.set("exchanging", true);
        return { body: { step: "code", code } };
      },
      // Anthropic's page, offered to open in a new browsing context, with no opener and no referrer (J2 (3))
      // the code's field drawn anew, empty (the shell keeps a field's value by its id; R10)
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (view.ui && view.ui.starting) cs.set("starting", false);
        if (view.ui && view.ui.exchanging) cs.set("exchanging", false);
        if (a && a.address) cs.set("signinAddress", a.address); else cs.set("gen", ((view.ui && view.ui.gen) || 0) + 1);
      },
      // every code `/signin` can answer (agent-worker R84's `SIGNIN_CODES`) and the door's own (control-plane R65), each in
      // words: `refusal.<code>` where `words.json` holds it, else this module's meaning; `{detail}` filled where it has one
      refusals: {
        NO_SIGNIN_WAITING: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.NO_SIGNIN_WAITING", r); },
        SIGNIN_REFUSED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.SIGNIN_REFUSED", { detail: r.detail || r.code || "SIGNIN_REFUSED" }); },
        SIGNIN_UNAVAILABLE: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.SIGNIN_UNAVAILABLE", r); },
        SIGNIN_ADDRESS_UNEXPECTED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.SIGNIN_ADDRESS_UNEXPECTED", r); },
        AGENT_WORKER_UNBOUND: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.AGENT_WORKER_UNBOUND", r); },
        DISCLOSURE_DUE: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("refusal.DISCLOSURE_DUE", r); },
        AI_KEPT_AWAY: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.AI_KEPT_AWAY", r); },
        RUNNER_NOT_CONFIGURED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.RUNNER_NOT_CONFIGURED", r); },
        RUNNER_NOT_STARTED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.RUNNER_NOT_STARTED", { detail: r.detail || r.code || "RUNNER_NOT_STARTED" }); },
        RUNNER_SILENT: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.RUNNER_SILENT", r); },
        AGENT_WORKER_SILENT: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.AGENT_WORKER_SILENT", r); },
        ATTEMPT_SUPERSEDED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.ATTEMPT_SUPERSEDED", r); },
        NOT_THIS_MEMBER: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.NOT_THIS_MEMBER", r); },
        BAD_CODE: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.BAD_CODE", r); },
        BAD_BODY: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.BAD_REQUEST", r); },
        BAD_MEMBER: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.BAD_REQUEST", r); },
        BAD_REQUEST: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.BAD_REQUEST", r); },
        BAD_STEP: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.BAD_REQUEST", r); },
        SIGNIN_NOT_HELD: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.SIGNIN_NOT_HELD", r); },
        SIGNIN_TOKEN_REFUSED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.SIGNIN_TOKEN_REFUSED", r); },
        SIGNOUT_FAILED: (r, cs) => { cs.set("starting", false); cs.set("exchanging", false); return cs.w("screen.connect.refused.SIGNOUT_FAILED", r); },
      } },
    // the password given beforehand (DEC-249): checked, nothing else changes; a field left empty sends nothing
    { op: "reauth", rereads: [],
      send(view, el, cs) { const password = String(cs.value("mc-reauth") || ""); return password ? { body: { password } } : { refuse: "session.reauth.head" }; } },
    { op: "accountreferenceset", rereads: ["reference", "uses", "limits", "usage", "history"], outward: true,
      send(view, el, cs) { const secret = String(cs.value("mc-key" + ((view.ui && view.ui.gen) || 0)) || "").trim(); return secret ? { body: { kind: "apikey", secret } } : { refuse: "screen.connect.apikey.nokey" }; },
      done(view, answer, cs) { cs.set("gen", ((view.ui && view.ui.gen) || 0) + 1); } },
    // R49: the uses as checkboxes in one style, saved by one act: the first changed use is this act's request, the others follow it
    { op: "accountusesset", rereads: ["uses", "history"],
      send(view, el, cs) {
        const owner = "member:" + (view.me || {}).member;
        if (el.dataset.own !== "1") return view.parts.aiPanelSend("accountusesset", owner, el, cs);
        const cur = view.data && view.data.uses && view.data.uses.state === "ok" && view.data.uses.value && view.data.uses.value.uses ? view.data.uses.value.uses : {};
        const changed = ["ask", "draft", "run", "enquire", "read", "transcribe", "account", "suggestions", "standing"].filter((u) => (cs.value("mu-" + u) === true) !== !!cur[u]);
        if (!changed.length) return null;
        cs.set("usesRest", changed.slice(1).map((u) => ({ sw: u, on: cs.value("mu-" + u) === true })));
        return { body: { owner, switch: changed[0], on: cs.value("mu-" + changed[0]) === true } };
      },
      async done(view, answer, cs) {
        const rest = (view.ui && view.ui.usesRest) || [];
        for (const r of rest) await cs.call("accountusesset", { body: { owner: "member:" + (view.me || {}).member, switch: r.sw, on: r.on } });
        if (rest.length) cs.set("usesRest", []);
      },
      refusals: { SWITCH_VALUE_INVALID: "ai.refused.switchvalue" } },
    { op: "ailimitset", rereads: ["limits", "over"],
      send(view, el, cs) { return view.parts.aiPanelSend("ailimitset", "member:" + (view.me || {}).member, el, cs); },
      refusals: { AI_LIMIT_INVALID: (r, cs) => cs.w("ai.refused.limitinvalid", { field: String(cs.w("ai.limitfield." + (["owner", "scope", "unit", "period", "amount", "inclusive", "use", "count"].indexOf(r && r.field) >= 0 ? r.field : "amount"))).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) }), LIMIT_UNIT_UNAVAILABLE: "ai.refused.unitunavailable" } },
    { op: "accountreferenceremove", rereads: ["reference", "uses", "limits", "usage", "history"],
      send() { return { body: {} }; } },
    { op: "subscriptiondisconnect", rereads: ["signin", "reference", "uses", "limits", "usage", "history"],
      send() { return { body: {} }; } },
  ],
};
