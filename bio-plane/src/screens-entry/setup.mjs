/* screens-entry R6 (and R8–R11, R14–R20, R22, R23, R26, R30, R33, R34): `setup`, "Set up your team's Civicsmith", in the setup frame at
   `/app/setup` (the shell forwards `/#boot=` here and hands the one-time password as `view.fragment.boot`, taken from
   the address on load). Drawn as the design draws it (R22, DEC-279): numbered parts that open and close (`.cs-part`),
   each with its name, one line of what it is for and its state; choices (`.cs-choice`) that open only what they need;
   long explanations behind explained terms (`.cs-card`), never in the way.
   Before the claim only part 1, "Make it yours", is open: the one-time password, the handle the founder chooses (R17)
   and her password twice (12 or more); `claim` with the handle, then `login` by the handle the claim answers (never
   `admin`) on an own device and `recoverycodesissue`, the ten codes shown once (R20); the seven parts that follow are
   shown closed beneath it. After the claim the parts are the registry's acts: 2 the team's name and website, 3 its
   place, 4 its offices, 5 the assistant, 6 privacy and the law (the court notice), 7 security tools, 8 a second
   administrator and the hosting account (beside `HOSTING_CONTROL`'s words). Each part after the first carries "Skip
   for now" (R23), which sends nothing and records nothing; "Finished" links `/app`. A part's state is the one its own
   read answers; a read that does not answer leaves it optional, never done. A refused part keeps the step and sends
   nothing more (the shell draws the refusal beside its act and keeps what was typed).
   R18: a founder signed in with no handle held (`whoami`: `rootOfTrust`, `handle: null`) is asked it once
   (`founderhandleset`), or "Later". R19: anyone else signed in sees only that the team is set up, and Home. R20: an
   instance already claimed draws state c, "Already claimed".
   The kit has no control that changes the screen without an op, so the choices and "Skip for now" are the page's own
   radios and checkboxes, watched on the page's clock (`cs.later`) as `join` watches its handle, and the screen redrawn
   when one changes. Self-contained (interface-shell R21). */

/* The page holds each function below as its own text, so no value is declared at this module's scope: R34's fact path and zones
   are written inside each function that uses them (S-1). */

export const setup = {
  id: "setup",

  reads(view) {
    const me = view.me || {};
    // the team's short name (or its name) for the head, public as `groupidentity` is
    if (!me.session) return { boot: { op: "bootstrap" }, identity: { op: "groupidentity" } };
    // R19: a reader who is not the founder reads nothing here; R18: nor does a founder still choosing her handle
    if (me.rootOfTrust !== true || !me.handle) return {};
    return {
      boot: { op: "bootstrap" },
      identity: { op: "groupidentity" },
      // R19: "Show my recovery codes" only before the founder has seen hers
      codes: { op: "recoverycodesstate" },
      profiles: { op: "profiles" },
      // R34: the team's own time zone as it governs (local-facts R21), on the fact's own path
      zone: { op: "factstatus", query: { path: "@team/time_zone" } },
      place: { op: "placewantedstate" },
      offices: { op: "entitieskind", query: { kind: "office", limit: "500" }, empty: (v) => !(v && Array.isArray(v.entities) && v.entities.length) },
      keepaway: { op: "aikeepawaystate" },
      groupkey: { op: "groupkeystate" },
      court: { op: "courtnotice" },
      hosting: { op: "hostingaccess" },
      // R33: the scanner's true state (signatures held or not); drawn only while the scanner part is built in
      scan: { op: "scanstatus" },
      members: { op: "memberlist" },
      catalogue: { op: "securitytoolcatalogue" },
      tools: { op: "securitytools", empty: (v) => !(v && Array.isArray(v.tools) && v.tools.length) },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.setup.";
    // R34: the zones the design names (`label.timezones.<id>`)
    const ZONES = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];
    const ui = view.ui || {};
    const data = view.data || {};
    const ok = (r) => (r && r.state === "ok" ? r.value : null);
    const me = view.me || {};
    const signed = !!me.session;
    const boot = ok(data.boot) || {};
    const fragment = view.fragment || {};
    const id = ok(data.identity) || {};
    const named = typeof id.display_name === "string" && id.display_name.trim() ? id.display_name.trim() : "";
    const home = (key) => `<div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app" data-nav>${W(key)}</a></div>`;
    // an explained term: its words, and the longer explanation behind them (hover, focus or tap)
    const term = (html, tipKey) => `<span class="cs-card" tabindex="0" data-level="1" data-tip="${E(W(tipKey))}">${html}</span>`;
    // a field whose help carries an explanation behind it
    const explained = (field, tipKey) => String(field).replace('class="help"', `class="help cs-card" tabindex="0" data-level="1" data-tip="${E(W(tipKey))}"`);
    // the head: the short name until the team is named, then its name (R22)
    const head = () => `<div class="mk-setuphead"><span class="mk-wordmark">${W("shell.mark")}</span>`
      + (named ? `<span class="grp">${E(named)}</span>` : id.group ? `<span class="muted">${E(id.group)}</span>` : "") + "</div>";
    const hosting = () => {
      const p = [];
      for (let i = 1; i < 20; i++) { const k = "screen.hosting.s" + i; const t = W(k); if (t === k) break; p.push(`<p>${t}</p>`); }
      return `<details class="mk-details" id="hosting-control"><summary>${W("screen.hosting.heading")}</summary>${p.join("")}<p>${W("screen.hosting.guide")}</p></details>`;
    };
    // a choice (`.cs-choice`): radios `<name>-<i>`, each its words and its help (an explanation behind either)
    const pick = (name, legendKey, options, chosen) => `<fieldset class="cs-choice" id="${name}"><legend>${W(legendKey)}</legend>`
      + options.map((x, i) => `<label><input type="radio" name="${name}" id="${name}-${i}" value="${E(x.value)}"${x.value === chosen ? " checked" : ""}>`
        + `<span class="t">${x.tip && !x.helpKey ? term(W(x.key), x.tip) : W(x.key)}</span>`
        + (x.helpKey ? `<span class="help">${x.tip ? term(W(x.helpKey), x.tip) : W(x.helpKey)}</span>` : "") + "</label>").join("") + "</fieldset>";
    // a part (R22): its number (the accepted mark once done), its name, what it is for, its state; open or closed
    const part = (n, key, titleKey, whyKey, state, inner, o = {}) => {
      if (inner === null) return `<div class="cs-part" data-part="${key}" data-state="later"><div class="sum"><span class="n">${n}</span><span class="t">${W(titleKey)}</span><span class="why">${W(whyKey)}</span></div></div>`;
      const skipped = !!(ui.skipped && ui.skipped[key]);
      const open = !skipped && (o.open || ui.at === key);
      return `<details class="cs-part" data-part="${key}" data-state="${state}"${skipped ? ' data-skipped="true"' : ""}${open ? " open" : ""}><summary>`
        + `<span class="n">${n}</span><span class="t">${W(titleKey)}</span><span class="why">${o.why || W(whyKey)}</span>`
        + (skipped
          ? `<span class="cs-due cs-card" tabindex="0" data-level="1" data-skipped-mark="true" data-tip="${E(W(S + "state.skipped.help"))}">${W(S + "state.skipped")}</span>`
          : `<span class="cs-due"${state === "done" ? ' data-due="met"' : ""}>${W(S + "state." + state)}</span>`)
        + `<span class="chev" aria-hidden="true"></span></summary>`
        + `<div class="body">${inner}${o.skip === false ? "" : skip(key)}</div></details>`;
    };
    // R23, R25: "Skip for now" sends nothing and records nothing; the part is shown skipped (its mark reads
    // `screen.setup.state.skipped`, explained by `.skipped.help`) while the page is open
    const skip = (key) => `<div class="mk-acts"><label class="cs-btn" data-tone="quiet" data-skip="${key}" tabindex="0" data-level="2" data-tip="${E(W("setup.skip_does"))}">`
      + `<input type="checkbox" class="sr" id="su-skip-${key}"${ui.skipped && ui.skipped[key] ? " checked" : ""}>${W("setup.skip")}</label></div>`;

    // R26: the file the team puts on its website, drawn from the answer `instance-setup` gives (`domain_claim.well_known`:
    // `{path, body}`, or null) and never built here; the steps that need its path only when it is answered
    const domainFile = () => {
      const claim = id.domain_claim;
      if (!claim || typeof claim !== "object") return "";
      const F = "screen.domainfile.";
      const wk = claim.well_known && typeof claim.well_known === "object" && typeof claim.well_known.path === "string" && claim.well_known.body !== undefined ? claim.well_known : null;
      const segs = wk ? wk.path.split("/").filter(Boolean) : [];
      const name = segs.at(-1) || "", folder = segs.length > 1 ? segs[0] : "";
      const text = wk ? (typeof wk.body === "string" ? wk.body : JSON.stringify(wk.body, null, 2)) + "\n" : "";
      const address = wk && claim.domain ? "https://" + claim.domain + wk.path : "";
      const steps = [["step1"], ["step2", folder && { folder: { html: `<code>${E(folder)}</code>` } }], ["step3"], ["step4", address && { address: { html: `<code>${E(address)}</code>` } }], ["step5"]]
        .filter(([k, fills]) => (k !== "step2" && k !== "step4") || fills);
      const verdict = claim.latest && typeof claim.latest.verdict === "string" ? claim.latest.verdict : "";
      const gap = (kind) => `<div class="cs-gap" data-gap="${kind === "undetermined" ? "undetermined" : "refused"}" data-state="${kind}"><span>${W(F + "refused." + kind)}</span></div>`;
      return (["absent", "mismatched", "undetermined"].includes(verdict) ? gap(verdict) : "")
        + `<details class="mk-details" data-domainfile><summary>${W(F + "summary")}</summary><p class="mk-small">${W(F + "what")}</p>`
        + (wk ? `<div class="cs-sheet"><b class="mk-small">${E(name)}</b><pre class="mk-small" data-domainfile-text>${E(text)}</pre><div class="mk-acts">${String(cs.save(name, text, { label: F + "download" }) || "")}${String(cs.copy(text, { label: "shell.copy" }) || "")}</div></div>` : "")
        + `<p class="mk-small">${W(F + "steps")}</p><ol class="mk-small">${steps.map(([k, fills]) => `<li>${W(F + k, fills || undefined)}</li>`).join("")}</ol>`
        + `<p class="mk-small">${W(F + "daily")}</p>`
        + `<details class="mk-details"><summary>${W(F + "refused.summary")}</summary><div>${["malformed", "absent", "mismatched", "undetermined", "notadmin"].map(gap).join("")}</div></details></details>`;
    };
    // R30: who recorded the hosting account: the setup or the system have their own words; a member is drawn as before
    const recordedBy = (by) => {
      if (typeof by !== "string" || !by) return "member";
      const who = by.replace(/^member:/, "");
      return who === "" || who === "admin" || who === "bootstrap" || who === "setup" ? "setup" : /^(token|class|daemon|system|seed|session|accelerator|sweep)/.test(who) ? "system" : "member";
    };
    const hostingNow = (cur) => {
      const by = recordedBy(cur.recorded_by);
      return by === "member" ? W(S + "hosting.now", { holders: String(cur.holders || "") })
        : `${W("screen.group.hosting.now." + by, { date: { html: cs.date(cur.at) } })} ${E(String(cur.holders || ""))}`;
    };

    const out = [];
    // R15: the lede ("Welcome… First, claim it") follows the claimed state: drawn only while the instance answers that
    // it is not yet claimed and no one here has claimed it
    const unclaimed = !signed && !ui.claimed && !ui.taken && !!ok(data.boot) && boot.claimed !== true;

    // R20 state c: an instance already claimed
    const taken = () => `<h1 class="t-title">${W("setup.claimed.heading")}</h1><p class="mk-sub">${W("setup.claimed.sub")}</p><div class="cs-gap" data-gap="refused" data-state="taken"><span>${W("refusal.ALREADY_CLAIMED")}</span></div>`
      + `<div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app/front" data-nav>${W("screen.entry.signin")}</a></div>`;

    // ---- the claim (R6, R17, R22): before a session exists ----
    if (!signed) {
      if (ui.taken) return taken();
      if (ui.claimed) {
        return cs.title() + `<p class="cs-row" data-state="claimed">${W(S + "claimed.nosignin", { handle: ui.claimed.handle || "" })}</p><div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app/front" data-nav>${W("screen.entry.signin")}</a></div>`;
      }
      if (ok(data.boot) && boot.claimed === true) return taken();
      out.push(head(), cs.title());
      if (unclaimed) out.push(`<p class="mk-sub" data-lede>${W(S + "lede")}</p>`);
      out.push(cs.state(data.boot, (b) => {
        if (b.bootstrapConfigured === false) return `<p class="cs-row" data-state="unarmed">${W(S + "unarmed")}</p>`;
        // the founder's block (R4, R6: HOSTING_CONTROL), before she chooses a password, folded out of the way
        const claim = `<p class="mk-note">${W(S + "claim.intro")}</p>` + hosting()
          + explained(cs.field("su-otp", S + "otp", { help: S + "otp.help", autocomplete: "off", value: typeof fragment.boot === "string" ? fragment.boot : "" }), S + "otp.tip")
          // R17: the handle she chooses, between the one-time password and her own password
          + explained(cs.field("su-handle", S + "handle", { help: S + "handle.help", autocomplete: "username" }), S + "handle.tip")
          + cs.field("su-pw", S + "own", { type: "password", help: S + "own.help", autocomplete: "new-password" })
          + cs.field("su-pw2", "screen.entry.again", { type: "password", help: S + "again.help", autocomplete: "new-password" })
          + `<div class="mk-acts">${cs.act("claim", { tone: "primary", label: S + "claim.button" })}</div>`;
        // only part 1 is open; the seven that follow are shown closed beneath it
        return part(1, "claim", S + "claim", S + "part.claim.why", "needed", claim, { open: true, skip: false })
          + `<p class="mk-note">${W(S + "coming")}</p><div>`
          + [["group", "part.group"], ["places", "places"], ["offices", "offices"], ["assistant", "assistant"], ["court", "court"], ["security", "security"], ["admins", "admins"]]
            .map(([k, t], i) => part(i + 2, k, S + t, S + "part." + k + ".why", "later", null)).join("") + "</div>";
      }));
      return out.join("");
    }

    // ---- R19: a member, or an administrator who is not the founder: their own state, no founder words ----
    if (me.rootOfTrust !== true) {
      return `<h1 class="t-title">${W("setup.member.heading")}</h1><p class="mk-sub">${W("setup.member.sub")}</p>` + home("setup.member.home");
    }

    // ---- R18: the founder of a team claimed before T49 chooses her handle once, or later ----
    if (ui.handleDone) {
      out.push(head(), `<h1 class="t-title">${W("founder.handle.title")}</h1><p class="cs-row" data-state="done">${W("founder.handle.done", { handle: ui.handleDone })}</p>` + home("setup.member.home"));
      return out.join("");
    }
    if (!me.handle) {
      out.push(head(), `<h1 class="t-title">${W("founder.handle.title")}</h1><p class="mk-sub">${W("founder.handle.says")}</p>`
        + explained(cs.field("su-fh", S + "handle", { help: S + "handle.help", autocomplete: "username" }), S + "handle.tip")
        + `<div class="mk-acts">${cs.act("founderhandleset", { tone: "primary", label: "founder.handle.choose" })}<a class="cs-btn" data-tone="quiet" href="/app" data-nav>${W("founder.handle.later")}</a></div>`
        + `<p class="mk-small">${W("founder.handle.later.help")}</p>`);
      return out.join("");
    }

    // ---- signed in, the founder: the parts ----
    const profiles = ok(data.profiles) || {};
    const active = Array.isArray(profiles.profiles) ? profiles.profiles : [];
    const choices = Array.isArray(profiles.choices) ? profiles.choices : [];
    const wanted = (ok(data.place) || {}).name || "";
    const offices = ok(data.offices) && Array.isArray(data.offices.value.entities) ? data.offices.value.entities : [];
    const keep = ok(data.keepaway) || {};
    const gk = ok(data.groupkey) || {};
    const court = ok(data.court) || {};
    const host = ok(data.hosting) || {};
    const tools = ok(data.tools) && Array.isArray(data.tools.value.tools) ? data.tools.value.tools : [];
    const members = ok(data.members) && Array.isArray(data.members.value.members) ? data.members.value.members : null;
    // a tool is named by its provider's display name (vendor and product, from the catalogue read), never by its id
    const cat = ok(data.catalogue) || {};
    const providers = [].concat(cat.offered || [], cat.held || [], cat.refused || []).filter((x) => x && x.provider_id);
    const nameOf = (x) => { const c = x && (x.vendor || x.product ? x : providers.find((k) => k.provider_id === x.provider_id)); return c && (c.vendor || c.product) ? [c.vendor, c.product].filter(Boolean).join(" · ") : ""; };
    // R22: each part's state from its own read; a read that does not answer leaves it optional, never done
    const answered = (r) => !!r && (r.state === "ok" || r.state === "empty");
    const done = (r, test) => (answered(r) && test() ? "done" : "optional");
    const states = {
      group: done(data.identity, () => !!named),
      places: done(data.profiles, () => active.length > 0),
      offices: done(data.offices, () => offices.length > 0),
      assistant: ok(data.keepaway) && keep.on === true ? "off" : "optional",
      court: done(data.court, () => court.choice === "tell" || court.choice === "dont"),
      security: done(data.tools, () => tools.length > 0),
      admins: members ? (members.some((m) => m && m.role === "admin" && m.founder !== true && m.status !== "removed") ? "done" : "optional") : "optional",
    };
    // the choices as the page last drew them, and as the member has changed them since (watched below)
    const chosen = ui.choices || {};
    const shown = {};
    const choice = (name, fallback) => (shown[name] = Object.hasOwn(chosen, name) ? chosen[name] : fallback);

    // the head, the title and what follows the claim
    out.push(head(), cs.title(), `<p class="mk-sub">${W(S + "after")}</p>`);

    // 1 Make it yours: the claim done; the ten codes shown once (R20), or "Show my recovery codes" only while she
    // holds none she has seen (R19)
    const held = ok(data.codes);
    const codes = ui.codes
      ? `<p class="mk-note">${W(S + "codes.intro")}</p><div class="cs-sheet"><p class="mk-small">${W("setup.codes.once")}</p><pre data-codes aria-label="${W("screen.entry.codes.list")}">${ui.codes.map(E).join("\n")}</pre>`
        + `<div class="mk-acts">${String(cs.copy(ui.codes.join("\n"), { label: "setup.codes.copy" }) || "")}${String(cs.save("recovery-codes.txt", ui.codes.join("\n") + "\n", { label: "setup.codes.save" }) || "")}</div></div>`
      : ui.nocodes ? `<p class="cs-row">${W("screen.entry.codes.none")}</p>`
        : held && held.held === false ? `<p class="mk-note">${W(S + "codes.intro")}</p><div class="mk-acts">${cs.act("recoverycodesissue")}</div>` : "";
    // R17: the claim's next step names the team (its name, or "Your team") and the handle she chose
    const claimed = W(S + "claimed", { group: named || { html: W("screen.entry.group") }, handle: me.handle });
    out.push("<div>" + part(1, "claim", S + "claim", S + "part.claim.why", "done", codes || `<p>${claimed}</p>`, { open: !!codes || !!ui.claimedHere, why: `<span data-state="claimed">${claimed}</span>`, skip: false }));

    // 2 Your team: R14, the name first, saying where it shows; the website only if the team has one
    const site = choice("su-site", id.domain || (id.domain_claim && id.domain_claim.domain) ? "yes" : "no");
    out.push(part(2, "group", S + "part.group", S + "part.group.why", states.group,
      explained(cs.field("su-name", S + "name.field", { help: S + "name.help", value: named }), S + "name.tip")
      + `<div class="mk-acts">${cs.act("groupnameset")}</div>`
      + (named ? `<p><span class="cs-due" data-due="met" data-state="named">${W(S + "name.now", { name: named })}</span></p>` : "")
      + pick("su-site", S + "site.q", [{ value: "no", key: S + "site.no" }, { value: "yes", key: S + "site.yes", tip: S + "site.tip" }], site)
      + (site === "yes" ? (id.domain && id.domain_verified_at ? `<p>${W(S + "domain.verified", { domain: id.domain })}</p>` : "")
        + cs.field("su-domain", S + "domain", { help: S + "domain.help", value: id.domain || "" })
        + `<div class="mk-acts">${cs.act("groupdomainset")}</div>` + domainFile() : ""),
      { open: states.group !== "done" }));

    // R34: the team's time zone, a step of part 3. Done once the team itself has stated it (the fact governs by a correction);
    // a zone only a place gives is offered as the choice, not counted as stated. A stated zone is changed under Settings.
    const zoneName = (z) => {
      if (ZONES.includes(z)) return W("label.timezones." + z);
      let generic = "";
      try { const f = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName"); generic = f ? f.value : ""; } catch (e) { generic = ""; }
      const city = String(z).split("/").pop().replace(/_/g, " ");
      return E(generic ? generic + " (" + city + ")" : city);
    };
    const zoneStep = () => `<div data-zone>` + cs.state(data.zone, (z) => {
      const gov = z && z.governs && typeof z.governs.value === "string" ? z.governs : null;
      const stated = !!gov && gov.origin === "corrected";
      const head = `<p class="mk-note"><b>${W(S + "zone")}</b>${stated ? ` <span class="cs-due" data-due="met" data-state="zonedone">${W(S + "state.done")}</span>` : ""}</p><p class="mk-note">${W(S + "zone.help")}</p>`;
      if (stated) return head + `<p data-state="timezone">${W("screen.group.timezone.governs.local", { zone: { html: zoneName(gov.value) } })}</p>`;
      const cur = gov ? gov.value : ZONES[0];
      const options = [...ZONES.map((x) => [x, "label.timezones." + x]), ...(ZONES.includes(cur) ? [] : [{ value: cur, text: String(zoneName(cur)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) }])];
      return head + cs.choice("su-zone", "screen.group.timezone", options, { value: cur })
        + cs.field("su-zone-how", "screen.group.timezone.how", { autocomplete: "off" })
        + cs.field("su-zone-src", "screen.group.timezone.source", { help: "screen.group.timezone.source.help", autocomplete: "off" })
        + `<div class="mk-acts">${cs.act("factconfirm", { label: "act.factconfirm.label.group" })}</div>`;
    }) + "</div>";

    // 3 Where your team works: the place chosen among those Civicsmith knows, or "Somewhere else", which opens the place
    // wanted; then the team's time zone (R34)
    const known = [...active, ...choices.filter((c) => !active.some((a) => a.id === c.id))];
    const place = choice("su-pick", active.length ? String(active[0].id) : known.length ? "" : "other");
    out.push(part(3, "places", S + "places", S + "part.places.why", states.places, cs.state(data.profiles, () =>
      `<p class="mk-note">${W(S + "places.intro")}</p>`
      + (active.length ? `<p class="mk-note">${W(S + "places.chosen", { place: active.map((x) => x.name || x.id).join(", ") })}</p>` : "")
      + cs.choice("su-pick", S + "places.choose", [...known.map((x) => ({ value: String(x.id), text: x.name || x.id })), ["other", S + "place.other"]], { value: place })
      + `<p class="mk-note">${W(S + "places.help")}</p>`
      + (place === "other" ? (wanted ? `<p>${W(S + "place.wanted.now", { name: wanted })}</p>` : "")
        + cs.field("su-place", S + "place.wanted", { help: S + "place.wanted.help", value: wanted }) + `<div class="mk-acts">${cs.act("placewanted")}</div>` : "")
      + `<div class="mk-acts">${cs.act("profilesset")}</div>`) + zoneStep()));

    // 4 The officials you deal with: the place's public offices, or, for a place not yet known, offices added by hand
    const placeName = active.length ? active.map((x) => x.name || x.id).join(", ") : "";
    out.push(part(4, "offices", S + "offices", S + "part.offices.why", states.offices,
      (placeName && place !== "other" ? `<p class="mk-note">${W(S + "offices.what", { place: placeName })}</p><div class="mk-acts">${cs.act("officesseed")}</div>`
        : `<p class="mk-note">${wanted ? W(S + "offices.none", { place: wanted }) : W(S + "places.none")}</p>`)
      + (offices.length ? `<div class="cs-sheet">${offices.map((x) => `<div class="cs-row"><span>${E(x.label || x.name || x.id || "")}</span></div>`).join("")}</div>` : "")
      + (data.offices && data.offices.state === "failed" ? cs.state(data.offices, () => "") : "")
      + (ui.office ? `<p>${W(S + "office.added", { label: ui.office })}</p>` : "")
      + cs.field("su-office", S + "office.field") + cs.field("su-office-note", S + "office.note")
      + `<div class="mk-acts">${cs.act("entitycreate")}</div>`));

    // 5 The AI assistant: keeping AI out hides everything else about it; the team's key only if the team pays
    let ai;
    if (keep.on === true) {
      ai = `<p data-state="keepaway">${W(S + "keepaway.on")} <span class="rec">${E(keep.reason || "")}</span></p><p class="mk-note">${W(S + "ai.off")}</p>`;
    } else {
      const use = choice("su-ai", "yes");
      ai = `<p class="mk-note">${W(S + "assistant.what")}</p>`
        + pick("su-ai", S + "ai.q", [{ value: "yes", key: S + "ai.yes", helpKey: S + "ai.yes.help", tip: S + "leaves.what" }, { value: "no", key: S + "keepaway", helpKey: S + "ai.no.help" }], use);
      if (use === "no") {
        ai += cs.field("su-why", S + "keepaway.why", { area: true, rec: true, help: S + "keepaway.help" })
          + `<div class="mk-acts">${cs.act("aikeepaway", { data: { on: "on" } })}</div>`;
      } else {
        const pays = choice("su-pay", gk.held === true ? "group" : "own");
        ai += pick("su-pay", S + "pay.q", [{ value: "own", key: S + "pay.own", helpKey: S + "assistant.own" }, { value: "group", key: S + "pay.group", helpKey: S + "assistant.paid" }], pays);
        if (pays === "group") {
          ai += (gk.held === true ? `<p data-state="groupkey">${W(S + "key.held", { state: { html: W(gk.on ? S + "key.on" : S + "key.off") } })}</p>` : "")
            + explained(cs.field("su-key" + (ui.keyGen || 0), S + "key", { type: "password", help: S + "key.help", autocomplete: "off" }), S + "key.tip")
            + `<div class="mk-acts">${cs.act("groupkeyset")}${gk.held === true ? cs.act("groupkeyswitch", { label: gk.on ? S + "key.switchoff" : S + "key.switchon", data: { on: gk.on ? "off" : "on" } }) : ""}</div>`
            + `<p class="mk-note">${W(S + "key.told")}</p>`
            + (ui.limit ? `<p>${W(S + "limit.set")}</p>` : "")
            + cs.field("su-limit", S + "limit", { help: S + "limit.help" })
            + `<div class="mk-acts">${cs.act("ailimitset")}</div>`;
        }
      }
    }
    out.push(part(5, "assistant", S + "assistant", S + "part.assistant.why", states.assistant, ai));

    // 6 Privacy and the law: what a court could still see, and whether members are told
    out.push(part(6, "court", S + "court", S + "part.court.why", states.court,
      `<p class="mk-note">${W(S + "people.what")}</p><p class="mk-note">${term(W(S + "court.what"), S + "court.matters")}</p>`
      + (court.choice === "tell" || court.choice === "dont" ? `<p>${W(S + "court.now." + court.choice)}</p>` : "")
      + pick("su-court", S + "court.legend", [{ value: "tell", key: S + "court.tell" }, { value: "dont", key: S + "court.dont" }], court.choice || null)
      + `<div class="mk-acts">${cs.act("courtnoticeset")}</div>`));

    // R33: what is true of the scanner. Signatures held: the checked sentence. None: since when and why, in the words the
    // answer's keys carry (else its own words), never the scanner's code. Unread, unreachable or not answered: nothing is
    // claimed that is not known.
    const scannerState = () => {
      const sc = ok(data.scan);
      if (!sc) return "";
      const ns = sc.no_signatures && typeof sc.no_signatures === "object" ? sc.no_signatures : null;
      if (!ns) return sc.scanner && (sc.scanner.unreachable === true || sc.scanner.bound === false) ? "" : `<p class="mk-note" data-state="scanner">${W(S + "security.scanner")}</p>`;
      // the key's word where the list holds it and every fill is answered; else the answer's own words
      const said1 = (key, words, fills) => { const t = typeof key === "string" ? String(W(key, fills)) : ""; return t && t !== E(key) && !/\{\w+\}/.test(t) ? t : typeof words === "string" ? E(words) : ""; };
      const status = /^REFUSED:[^:]*:(\d{3})$/.exec(String(ns.reason || ""));
      const first = said1(ns.key, ns.words, ns.since ? { date: { html: cs.date(ns.since) } } : {});
      const second = typeof ns.reason_key === "string" ? said1(ns.reason_key, ns.reason_words, status ? { status: status[1] } : {}) : "";
      return (first ? `<p class="mk-note" data-state="nosignatures">${first}</p>` : "") + (second ? `<p class="mk-note" data-state="nosignatures-reason">${second}</p>` : "");
    };

    // 7 Security: each offered tool with the fields its entry names; the scanner's sentence only while one runs
    out.push(part(7, "security", S + "security", S + "part.security.why", states.security,
      (boot.part_scanner === true ? scannerState() : "") + `<p class="mk-note">${W(S + "security.what")}</p>`
      + (ui.tool ? `<p data-state="tool">${W(ui.tool.passed ? S + "security.passed" : S + "security.failed", { tool: ui.tool.name })}</p>` : "")
      + tools.map((t) => nameOf(t)).filter(Boolean).map((n) => `<p>${W(S + "security.held", { tool: n })}</p>`).join("")
      // R12: an empty catalogue draws nothing (a failed read is still drawn as failed)
      + (data.catalogue && data.catalogue.state === "empty" ? "" : cs.state(data.catalogue, (c) => (Array.isArray(c.offered) ? c.offered : []).map((t, i) => {
        const name = nameOf(t);
        const cfg = Array.isArray(t.config) ? t.config : [];
        const creds = Array.isArray(t.credentials) ? t.credentials : [];
        // each of the tool's own fields by the kit's field, its name the entry's (R12)
        return `<fieldset class="mk-checks" id="su-st-${i}"><legend>${E(name)}</legend>`
          + cfg.map((f, k) => cs.field(`su-st-${i}-cfg-${k}`, S + "security.field", { fills: { field: f.label || f.name } })).join("")
          + creds.map((n, k) => cs.field(`su-st-${i}-cred-${k}`, S + "security.field", { type: "password", autocomplete: "off", fills: { field: n } })).join("")
          + `<label><input type="checkbox" id="su-st-${i}-keep"> ${W(S + "security.keep")}</label>`
          + `<div class="mk-acts">${cs.act("securitytooladd", { data: { tool: String(i) }, label: S + "security.add" })}</div></fieldset>`;
      }).join("")))));

    // 8 A second administrator (R23: an invitation with the administrator role, shown once, here only), and who holds
    // the hosting account (HOSTING_CONTROL's words are the claim's, before her password)
    out.push(part(8, "admins", S + "admins", S + "part.admins.why", states.admins,
      `<p class="mk-note">${W(S + "admins.what")}</p>`
      + (ui.invite ? `<div class="cs-row" data-shown="invite"><p>${W(S + "admins.shown", { date: { html: cs.date(ui.invite.expires) } })}</p><p><code>${E(ui.invite.link)}</code></p></div>` : "")
      + cs.field("su-adm-id", S + "admins.id", { help: S + "admins.id.help", autocomplete: "off" })
      + cs.field("su-adm-cover", S + "admins.cover", { autocomplete: "off" })
      + `<div class="mk-acts"><span class="mk-actwrap" data-level="2" data-tip="${E(W("setup.admin.invite_does"))}">${cs.act("memberadd", { tone: "primary", label: "setup.admin.invite" })}</span></div>`
      + (host.current ? `<p>${hostingNow(host.current)}</p>` : "")
      + cs.field("su-holders", S + "hosting.field", { help: S + "hosting.help" }) + cs.field("su-hnote", S + "hosting.note")
      + `<div class="mk-acts">${cs.act("hostingaccessset")}</div>`) + "</div>");

    out.push(cs.sec(S + "finished", `<p class="cs-row" data-state="ready"><b>${W(S + "finished.title")}</b> ${W(S + "finished.what")}</p><div class="mk-acts"><a class="cs-btn" data-tone="primary" href="/app" data-nav>${W(S + "finished.go")}</a></div>`));

    // the choices and "Skip for now" watched on the page's clock: a change redraws the screen, opening only what it needs
    ui.shown = shown;
    if (!ui.watching) {
      ui.watching = true;
      const watch = (c, v) => {
        const u = v.ui || {};
        if (!u.watching) return;
        const radio = (n, values) => { for (let i = 0; i < values.length; i++) if (c.value(n + "-" + i) === true) return values[i]; return null; };
        const now = { "su-site": radio("su-site", ["no", "yes"]), "su-ai": radio("su-ai", ["yes", "no"]), "su-pay": radio("su-pay", ["own", "group"]) };
        const sel = c.value("su-pick");
        if (typeof sel === "string" && sel) now["su-pick"] = sel;
        const owner = { "su-site": "group", "su-ai": "assistant", "su-pay": "assistant", "su-pick": "places" };
        const seen = u.shown || {};
        let moved = null;
        const next = { ...(u.choices || {}) };
        for (const [n, val] of Object.entries(now)) if (val !== null && Object.hasOwn(seen, n) && seen[n] !== val) { next[n] = val; moved = owner[n]; }
        const skipped = { ...(u.skipped || {}) };
        let skips = false;
        for (const k of ["group", "places", "offices", "assistant", "court", "security", "admins"]) {
          const s = c.value("su-skip-" + k);
          if (s === null || s === undefined) continue;
          if (!!s !== !!skipped[k]) { skipped[k] = !!s; skips = true; }
        }
        if (moved) { u.at = moved; u.choices = next; }
        if (skips) u.skipped = skipped;
        if (moved || skips) c.set("choices", u.choices || {});
        c.later(250, watch);
      };
      cs.later(250, watch);
    }
    return out.join("");
  },

  // R8: a password held for the claim's sign-in leaves the page's memory when the founder leaves the screen; the
  // choices are no longer watched
  closed(cs, view) { if (view.ui) { delete view.ui.pending; view.ui.watching = false; } },

  acts: [
    // R6, R8, R17: the one-time password, the handle she chooses and her password in the body only, the password typed
    // twice alike; no handle sends nothing (a claim with none would hold none)
    { op: "claim",
      send(view, el, cs) {
        const bootstrapToken = String(cs.value("su-otp") || "").trim();
        const handle = String(cs.value("su-handle") || "").trim();
        const password = String(cs.value("su-pw") || "");
        if (!bootstrapToken) return { refuse: "screen.setup.nootp" };
        if (!handle) return { refuse: "refusal.NO_HANDLE" };
        if (password !== String(cs.value("su-pw2") || "")) return { refuse: "screen.entry.differ" };
        if (password.length < 12) return { refuse: "screen.entry.short" };
        // held in the page's memory only until the sign-in below, never drawn, stored or put in an address
        view.ui.pending = password;
        return { body: { bootstrapToken, password, handle } };
      },
      // then `login` by the handle the claim answers (R17: never `admin`) on an own device, the session handed to the
      // shell, and the ten codes shown once (R20)
      async done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const password = view.ui.pending;
        delete view.ui.pending;
        const handle = a && typeof a.handle === "string" && a.handle ? a.handle : String(cs.value("su-handle") || "").trim();
        const l = await cs.call("login", { body: { handle, password, device: "own" } });
        const login = l && l.result !== undefined ? l.result : l;
        if (!(login && login.ok !== false && login.token)) { cs.set("claimed", { handle }); return { stay: true }; }
        await cs.signin(login, { device: "own", handle, stay: true });
        view.ui.claimedHere = true;
        const c = await cs.call("recoverycodesissue", { body: {} });
        const codes = c && c.result !== undefined ? c.result : c;
        if (codes && codes.ok !== false && Array.isArray(codes.codes) && codes.codes.length) view.ui.codes = codes.codes.map(String); else view.ui.nocodes = true;
      },
      // R17: a refused handle keeps the handle and clears the passwords; R20: ALREADY_CLAIMED draws state c. Every
      // refusal takes the password out of the page's memory (R8)
      refusals: {
        ALREADY_CLAIMED: (r, cs) => { cs.set("pending", null); cs.set("taken", true); return ""; },
        NO_HANDLE: (r, cs) => { cs.set("pending", null); cs.fill("su-pw", ""); cs.fill("su-pw2", ""); return cs.w("refusal.NO_HANDLE"); },
        BAD_HANDLE: (r, cs) => { cs.set("pending", null); cs.fill("su-pw", ""); cs.fill("su-pw2", ""); return cs.w("refusal.BAD_HANDLE"); },
        HANDLE_TAKEN: (r, cs) => { cs.set("pending", null); cs.fill("su-pw", ""); cs.fill("su-pw2", ""); return cs.w("refusal.HANDLE_TAKEN"); },
        HANDLE_FIXED: (r, cs) => { cs.set("pending", null); cs.fill("su-pw", ""); cs.fill("su-pw2", ""); return cs.w("refusal.HANDLE_FIXED"); },
        PASSWORD_TOO_SHORT: (r, cs) => { cs.set("pending", null); return cs.w("refusal.PASSWORD_TOO_SHORT"); },
      } },
    // R18: the founder's handle, chosen once, in the body only
    { op: "founderhandleset", rereads: [],
      send(view, el, cs) {
        const handle = String(cs.value("su-fh") || "").trim();
        return handle ? { body: { handle } } : { refuse: "refusal.NO_HANDLE" };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        cs.set("handleDone", a && typeof a.handle === "string" && a.handle ? a.handle : String(cs.value("su-fh") || "").trim());
        return { stay: true };
      },
      refusals: { NO_HANDLE: "refusal.NO_HANDLE", BAD_HANDLE: "refusal.BAD_HANDLE", HANDLE_TAKEN: "refusal.HANDLE_TAKEN", HANDLE_FIXED: "refusal.HANDLE_FIXED" } },
    { op: "recoverycodesissue", rereads: [],
      send(view) { view.ui.at = "claim"; return { body: {} }; },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && Array.isArray(a.codes) && a.codes.length) cs.set("codes", a.codes.map(String)); else cs.set("nocodes", true);
        return { stay: true };
      } },
    // each part's act keeps its part open while its answer is drawn (R22)
    { op: "groupnameset", rereads: ["identity"],
      send(view, el, cs) { view.ui.at = "group"; const name = String(cs.value("su-name") || "").trim(); return name ? { body: { name } } : { refuse: "screen.setup.name.empty" }; } },
    // R26: the verifier's refusals in the design's words
    { op: "groupdomainset", rereads: ["identity"],
      send(view, el, cs) { view.ui.at = "group"; const domain = String(cs.value("su-domain") || "").trim(); return domain ? { body: { domain } } : { refuse: "screen.setup.domain.empty" }; },
      refusals: { GROUP_DOMAIN_MALFORMED: "screen.domainfile.refused.malformed", NOT_AN_ADMIN: "screen.domainfile.refused.notadmin" } },
    // the place chosen: one the profiles hold, or none ("Somewhere else")
    { op: "profilesset", rereads: ["profiles", "offices"],
      send(view, el, cs) {
        view.ui.at = "places";
        const id = String(cs.value("su-pick") || (view.ui.shown || {})["su-pick"] || "");
        return { body: { profiles: id && id !== "other" ? [id] : [] } };
      } },
    // R34: the team's own time zone, stated on its own path with how and where it was checked (local-facts R21; the owner
    // refuses a value that is no zone, and a statement without them); the page composes nothing of the fact
    { op: "factconfirm", rereads: ["zone"],
      send(view, el, cs) {
        view.ui.at = "places";
        return { body: { act: "correct", value: String(cs.value("su-zone") || "").trim(), how: String(cs.value("su-zone-how") || "").trim(), source: String(cs.value("su-zone-src") || "").trim(), path: "@team/time_zone" } };
      } },
    { op: "placewanted", rereads: ["place"],
      send(view, el, cs) { view.ui.at = "places"; const name = String(cs.value("su-place") || "").trim(); return name ? { body: { name } } : { refuse: "screen.setup.place.empty" }; } },
    { op: "officesseed", rereads: ["offices"],
      send(view) { view.ui.at = "offices"; return { body: {} }; } },
    { op: "entitycreate", rereads: ["offices"],
      send(view, el, cs) {
        view.ui.at = "offices";
        const label = String(cs.value("su-office") || "").trim();
        const note = String(cs.value("su-office-note") || "").trim();
        // R6: `entities` R1 refuses an office with no note, so one is never sent without it
        if (!label) return { refuse: "screen.setup.office.empty" };
        return note ? { body: { kind: "office", label, note } } : { refuse: "refusal.ENTITY_NO_NOTE" };
      },
      done(view, answer, cs) { view.ui.office = String(cs.value("su-office") || "").trim(); } },
    // on only with a reason in the founder's own words, its field the act's reason (interface-shell R11); then every
    // other element about AI is hidden (R22)
    { op: "aikeepaway", rereads: ["keepaway"], reasonField: "reason",
      send(view, el, cs) {
        view.ui.at = "assistant";
        const reason = String(cs.value("su-why") || "").trim();
        if (reason.length < 1 || reason.length > 2000) return { refuse: "screen.setup.keepaway.noreason" };
        return { body: { on: el.dataset.on !== "off", reason } };
      } },
    // the key in the request's body only, never drawn again (the field drawn anew, empty)
    { op: "groupkeyset", rereads: ["groupkey"],
      send(view, el, cs) { view.ui.at = "assistant"; const key = String(cs.value("su-key" + ((view.ui && view.ui.keyGen) || 0)) || "").trim(); return key ? { body: { key } } : { refuse: "screen.setup.key.nokey" }; },
      done(view) { view.ui.keyGen = ((view.ui && view.ui.keyGen) || 0) + 1; } },
    { op: "groupkeyswitch", rereads: ["groupkey"],
      send(view, el) { view.ui.at = "assistant"; return { body: { on: el.dataset.on === "on" } }; } },
    // each member's daily use of the team's key, in dollars (ai-use R2: owner group, per member, a day)
    { op: "ailimitset", rereads: [],
      send(view, el, cs) {
        view.ui.at = "assistant";
        const amount = Number(String(cs.value("su-limit") || "").replace(/[,\s$]/g, ""));
        if (!(amount > 0)) return { refuse: "screen.setup.limit.bad" };
        return { body: { owner: "group", scope: "per_member", unit: "usd", period: "day", amount } };
      },
      done(view, answer, cs) { cs.set("limit", true); return { stay: true }; } },
    { op: "courtnoticeset", rereads: ["court"],
      send(view, el, cs) {
        view.ui.at = "court";
        const choice = cs.value("su-court-0") === true ? "tell" : cs.value("su-court-1") === true ? "dont" : null;
        return choice ? { body: { choice } } : { refuse: "screen.setup.court.pick" };
      } },
    { op: "hostingaccessset", rereads: ["hosting"],
      send(view, el, cs) {
        view.ui.at = "admins";
        const holders = String(cs.value("su-holders") || "").trim();
        const note = String(cs.value("su-hnote") || "").trim();
        return holders ? { body: { holders, note: note || null } } : { refuse: "screen.setup.hosting.empty" };
      } },
    // R23: a second administrator (membership R13: role admin); the invitation shown once, here only. A plain
    // invitation to a member is not offered in setup.
    { op: "memberadd", rereads: ["members"],
      send(view, el, cs) {
        view.ui.at = "admins";
        const memberId = String(cs.value("su-adm-id") || "").trim(), cover = String(cs.value("su-adm-cover") || "").trim();
        return memberId && cover ? { body: { memberId, cover, role: "admin" } } : { refuse: "screen.setup.admins.incomplete" };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && a.invite) view.ui.invite = { expires: a.expires, link: (view.origin || "") + "/#invite=" + encodeURIComponent(a.invite) };
      } },
    // a tool added with the fields its entry names, then tested (file-safety R28, R29)
    { op: "securitytooladd", rereads: ["tools"],
      send(view, el, cs) {
        view.ui.at = "security";
        const c = (view.data || {}).catalogue;
        const t = c && c.value && Array.isArray(c.value.offered) ? c.value.offered[Number(el.dataset.tool)] : null;
        if (!t) return { refuse: "screen.setup.security.nopick" };
        const i = el.dataset.tool;
        const config = {};
        const cfg = Array.isArray(t.config) ? t.config : [];
        for (let k = 0; k < cfg.length; k++) {
          const v = String(cs.value("su-st-" + i + "-cfg-" + k) || "").trim();
          if (v) config[cfg[k].name] = v;
          else if (cfg[k].required) return { refuse: "screen.setup.security.missing", fills: { field: cfg[k].label || cfg[k].name } };
        }
        const credentials = {};
        const names = Array.isArray(t.credentials) ? t.credentials : [];
        for (let k = 0; k < names.length; k++) {
          const v = String(cs.value("su-st-" + i + "-cred-" + k) || "").trim();
          if (!v) return { refuse: "screen.setup.security.missing", fills: { field: names[k] } };
          credentials[names[k]] = v;
        }
        view.ui.toolName = [t.vendor, t.product].filter(Boolean).join(" · ");
        return { body: { providerId: t.provider_id, config, credentials, handlingDigest: t.handling_digest, confirmRetention: cs.value("su-st-" + i + "-keep") === true, use: "on_request" } };
      },
      async done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const name = view.ui.toolName || "";
        delete view.ui.toolName;
        const r = a && a.tool_id ? await cs.call("securitytooltest", { body: { toolId: a.tool_id } }) : null;
        const res = r && r.result !== undefined ? r.result : r;
        view.ui.tool = { name, passed: !!(res && res.passed === true) };
      } },
  ],
};
