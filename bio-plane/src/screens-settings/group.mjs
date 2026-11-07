/* screens-settings R18 (DEC-201 (8); DEC-205 (1)–(3)): Settings › Your group, the settings chosen at setup, changeable
   here by an administrator: the name (`groupnameset`), the logo (`grouplogoset`, a PNG or JPEG chosen, instance-setup
   R84), the website with the date it was verified (`groupdomainset`), the languages (`grouplanguagesset`, tags among
   those the plane accepts, instance-setup R85), the court notice (`courtnoticeset`), who holds the hosting account
   (`hostingaccessset`) and the group's bar (`strengthbarset`, reasoned). Every member reads it; the acts are drawn only
   to a session that administers (interface-shell R12). Every function is self-contained (interface-shell R21).
   T50: defined terms carry their card where they appear (R44); the team's time zone, named and never coded, with its
   correction (`factconfirm`, R45); a value not set by a member is said as set at setup or by Civicsmith itself, and a saved
   or unchanged name acknowledged (R52).
   T51 FR-25 (R66, R69, R75; C30, C11, T-18; DEC-374, DEC-376, DEC-384): a copy of the team's record, taken by the founder (`export`), and
   the list of copies every administrator reads (`exportlog`); the file the team puts on its website, drawn as `instance-setup` answers it
   (`domain_claim.well_known`, the page building none); and a hosting account recorded at setup or by Civicsmith itself said so, not "by
   set at setup".
   T51 fix round 3 (C85; R66): each count of a copy, in the list and in the sentence for the copy just taken, is drawn with its label, the tables
   after a comma.
   Fix round 6 (G42; K4635, K4638): how full the team's record is, for a session that administers (`stats`, read once; `dbBytes` floored to
   100 MB for an administering member by the door): its size against 10 GB, a warning from 70 %, a second from 90 % saying writes will fail. */

export const group = {
  id: "group",

  reads(view) {
    return {
      // G42 (K4635, K4638): the record's size, read once and only for a session that administers (a member's screen sends no `stats`)
      ...(view && view.me && view.me.administer === true ? { stats: { op: "stats" } } : {}),
      identity: { op: "groupidentity" },
      languages: { op: "grouplanguages" },
      court: { op: "courtnotice" },
      hosting: { op: "hostingaccess" },
      bar: { op: "strengthbarof" },
      // the member's language, in which the languages are named (R31)
      mine: { op: "memberlanguage" },
      // R45: the zone that governs, from the facts of the active profiles; the places, to name each
      facts: { op: "factstatus" },
      // D-B1 (local-facts R21): the team's own zone, read by its path (it is not among the facts listed without one)
      teamzone: { op: "factstatus", query: { path: "@team/time_zone" } },
      profiles: { op: "profiles" },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.group.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const admin = me.administer === true;
    const data = view.data || {};
    const ui = view.ui || {};
    // an administrator's act, drawn only to a session that administers
    const A = (op, o) => (admin ? cs.act(op, o) : "");
    // a language by its name in the member's language, never as a tag (R31)
    const mineLang = data.mine && data.mine.state === "ok" && data.mine.value ? data.mine.value.language || null : null;
    const nameOf = (tag) => {
      try { const n = new Intl.DisplayNames([mineLang || "en"], { type: "language" }).of(String(tag)); return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(tag); } catch (e) { return String(tag); }
    };
    // a recorded actor (R33, R52): a value recorded at setup by the founder's bootstrap is "set at setup"; one set afterwards by a seed or
    // a machine credential is "set by Civicsmith itself"; never a credential's name; a member by their handle
    const originOf = (by) => {
      const id = String(by || "").replace(/^member:/, "");
      if (id === "" || id === "admin" || id === "bootstrap" || id === "setup") return "setup";
      if (/^(token|class|daemon|system|seed|session|accelerator|sweep)/.test(id)) return "system";
      return id;
    };
    const byOf = (by) => { const o = originOf(by); return o === "setup" ? T("settings.set.setup") : o === "system" ? T("settings.set.system") : o; };
    const lineOf = (by) => { const o = originOf(by); return o === "setup" ? `<p class="mk-small" data-state="origin">${W("settings.set.line.setup")}</p>` : o === "system" ? `<p class="mk-small" data-state="origin">${W("settings.set.line.system")}</p>` : ""; };
    const out = [cs.title()];
    if (!admin) out.push(`<p class="mk-note">${W(S + "admins")}</p>`);
    // a section that holds nothing is not drawn (R28)
    const section = (titleKey, inner, help) => { if (inner) out.push(cs.sec(titleKey, inner, help ? { help } : undefined)); };

    // the name and the logo
    section(S + "name.heading", cs.state(data.identity, (v) => {
      let h = v.display_name ? `<p data-state="name">${W(S + "name.now", { name: v.display_name })}</p>` : "";
      // R52: the name saved, or unchanged (in a fold, open whenever drawn); who set the name, where a member did not
      const saved = ui.nameSaved || null;
      if (saved && saved.same) h += `<details class="mk-details" open data-state="namesame"><summary>${W(S + "name.same.summary")}</summary><p>${W(S + "name.same")}</p></details>`;
      else if (saved) h += `<p data-state="namesaved">${W(S + "name.saved", { name: saved.name })}</p>`;
      const hist = Array.isArray(v.display_name_history) ? v.display_name_history : [];
      if (v.display_name && hist.length) h += lineOf(hist[hist.length - 1].set_by);
      if (v.group && v.display_name) h += `<p class="mk-small">${W(S + "name.help", { short: v.group })}</p>`;
      if (v.logo === true) h += `<p data-state="logo">${W(S + "logo.set")}</p>`;
      const nm = A("groupnameset");
      if (nm) h += `${cs.field("gr-name", S + "name.field", { max: 120, value: v.display_name || "", autocomplete: "off" })}${nm}`;
      const lg = A("grouplogoset");
      if (lg) h += `${cs.field("gr-logo", S + "logo.field", { type: "file", help: S + "logo.help", accept: "image/png,image/jpeg" })}${lg}`;
      return h;
    }));

    // the website, with the date it was verified
    section(S + "domain.heading", cs.state(data.identity, (v) => {
      const claim = v.domain_claim || null;
      const latest = claim && claim.latest ? claim.latest : null;
      let h = v.domain && v.domain_verified_at ? `<p data-state="domain">${W(S + "domain.verified", { domain: v.domain, date: D(v.domain_verified_at) })}</p>` : claim ? `<p data-state="domain">${W(S + "domain.unverified", { domain: claim.domain })}</p>` : "";
      // C86: the check's verdict with when it was made and the plane's own words for it (record data; "not found, 404" is its to say)
      if (latest && latest.verdict && latest.verdict !== "verified") {
        const at = latest.checked_at ? D(latest.checked_at) : "";
        const hm = /T(\d{2}:\d{2})/.exec(String(latest.checked_at || ""));
        h += `<p data-state="domainverdict">${W(S + "domain.verdict." + (["absent", "mismatched", "undetermined"].indexOf(latest.verdict) >= 0 ? latest.verdict : "undetermined"))}${at && hm ? ` ${W(S + "domain.checked", { date: at, time: hm[1] })}` : ""}${typeof latest.detail === "string" && latest.detail ? ` <span class="rec">${E(latest.detail)}</span>` : ""}</p>`;
      }
      const dm = A("groupdomainset");
      if (dm) h += `${cs.field("gr-domain", S + "domain.field", { value: claim ? claim.domain : v.domain || "", autocomplete: "off" })}${dm}`;
      // R69 (C11; DEC-374): the file the team puts on its website, as `instance-setup` answers it (`domain_claim.well_known`: `{path, body}`, or
      // null) and never built here; the steps that need its path only when it is answered, and each refusal of the check in its fold
      if (claim) {
        const F = "screen.domainfile.";
        const wk = claim.well_known && typeof claim.well_known === "object" && typeof claim.well_known.path === "string" && claim.well_known.body !== undefined ? claim.well_known : null;
        const segs = wk ? wk.path.split("/").filter(Boolean) : [];
        const fname = segs.length ? segs[segs.length - 1] : "", folder = segs.length > 1 ? segs[0] : "";
        const text = wk ? (typeof wk.body === "string" ? wk.body : JSON.stringify(wk.body, null, 2)) + "\n" : "";
        const address = wk && claim.domain ? "https://" + claim.domain + wk.path : "";
        const steps = [["step1"], ["step2", folder && { folder: { html: `<code>${E(folder)}</code>` } }], ["step3"], ["step4", address && { address: { html: `<code>${E(address)}</code>` } }], ["step5"]]
          .filter(([k, fills]) => (k !== "step2" && k !== "step4") || fills);
        const gap = (kind) => `<div class="cs-gap" data-gap="${kind === "undetermined" ? "undetermined" : "refused"}" data-state="${kind}"><span>${W(F + "refused." + kind)}</span></div>`;
        h += `<details class="mk-details" data-domainfile><summary>${W(F + "summary")}</summary><p class="mk-small">${W(F + "what")}</p>`
          + (wk ? `<div class="cs-sheet"><b class="mk-small">${E(fname)}</b><pre class="mk-small" data-domainfile-text>${E(text)}</pre><div class="mk-acts">${String(cs.save(fname, text, { label: F + "download" }) || "")}${String(cs.copy(text, { label: "shell.copy" }) || "")}</div></div>` : "")
          + `<p class="mk-small">${W(F + "steps")}</p><ol class="mk-small">${steps.map(([k, fills]) => `<li>${W(F + k, fills || undefined)}</li>`).join("")}</ol>`
          + `<p class="mk-small">${W(F + "daily")}</p>`
          + `<details class="mk-details"><summary>${W(F + "refused.summary")}</summary><div>${["malformed", "absent", "mismatched", "undetermined", "notadmin"].map(gap).join("")}</div></details></details>`;
      }
      return h;
    }));

    // the languages members use, chosen by name (R31)
    section(S + "languages.heading", cs.state(data.languages, (v) => {
      const L = Array.isArray(v.languages) ? v.languages : [];
      let h = L.length ? `<p data-state="languages">${W(S + "languages.now", { languages: L.map(nameOf).join(", ") })}</p>` : "";
      const ls = A("grouplanguagesset");
      if (ls) {
        // the languages offered: the common ones and any already set, kept for the act to read (a function holds no shared constant)
        const COMMON = ["en", "es", "zh", "yue", "vi", "tl", "ko", "ja", "fr", "ar", "ru", "pt", "hi", "so", "am", "ti", "fa", "uk", "hy", "km", "th", "ht", "de", "it", "pl", "sw", "mn", "lo"];
        const offered = [...L, ...COMMON.filter((t) => L.indexOf(t) < 0)];
        view.ui.offered = offered;
        h += `<fieldset><legend>${W(S + "languages.field")}</legend><p class="mk-small">${W(S + "languages.help")}</p>${offered.map((t) => `<label for="gr-lang-${E(t)}"><input type="checkbox" id="gr-lang-${E(t)}"${L.indexOf(t) >= 0 ? " checked" : ""}>${E(nameOf(t))}</label>`).join("")}</fieldset>${ls}`;
      }
      return h;
    }));


    // R45 (N1181; DEC-299 (2), DEC-322, DEC-323, DEC-324 (4)): the team's time zone, named and never coded. The zone that governs is read from
    // `factstatus` for each active profile's own `time_zone` fact (not an office's): the latest correction's, else the profile's. A zone is
    // shown by its name: the design's key for the seven it names, else the browser's generic name of the zone and its city.
    const ZONES = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];
    const zoneName = (id) => {
      if (ZONES.indexOf(id) >= 0) return T("label.timezones." + id);
      let generic = "";
      try { const part = new Intl.DateTimeFormat("en", { timeZone: id, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName"); generic = part ? part.value : ""; } catch (e) { generic = ""; }
      const city = String(id).split("/").pop().replace(/_/g, " ");
      return generic ? generic + " (" + city + ")" : city;
    };
    const factsV = data.facts && data.facts.state === "ok" && data.facts.value && Array.isArray(data.facts.value.facts) ? data.facts.value.facts : null;
    const profilesV = data.profiles && data.profiles.state === "ok" && data.profiles.value && Array.isArray(data.profiles.value.profiles) ? data.profiles.value.profiles : [];
    /* a fact's `profile` is a profile or, since the places are layers (T53, R83; `instance-setup` R108), the layer that holds it: either is
       named by the name `profiles` answers for it, never by its id */
    const layersV = data.profiles && data.profiles.state === "ok" && data.profiles.value && Array.isArray(data.profiles.value.layers) ? data.profiles.value.layers : [];
    const profileName = (id) => { const p = profilesV.find((x) => x.id === id) || layersV.find((x) => x.id === id); return p ? p.name || p.id : id; };
    section(S + "timezone", cs.state(data.facts, () => {
      const zf = (factsV || []).filter((f) => f && f.fact && f.fact.fact === "time_zone" && !f.fact.office && f.governs && typeof f.governs.value === "string");
      const distinct = new Set(zf.map((f) => f.governs.value));
      const tzOptions = (cur) => [...ZONES, ...(cur && ZONES.indexOf(cur) < 0 ? [cur] : [])].map((z) => ({ value: z, text: zoneName(z) }));
      // one correction: the zone chosen by name, how and where it was checked (both required by the owner), sent on the team's own path (local-facts R21)
      const form = (i, f, cur) => !admin ? "" : `${cs.choice("gr-tz" + i, S + "timezone", tzOptions(cur), { value: cur || ZONES[0] })}${cs.field("gr-tz-how" + i, S + "timezone.how", { help: S + "timezone.how.help", autocomplete: "off" })}${cs.field("gr-tz-src" + i, S + "timezone.source", { help: S + "timezone.source.help", autocomplete: "off" })}${A("factconfirm", { data: { path: "@team/time_zone", slot: String(i) } })}`;
      // D-B1: a zone the team itself stated governs (R21), whatever the places say; the correction is always made on the team's own path
      const tz = data.teamzone && data.teamzone.state === "ok" && data.teamzone.value && data.teamzone.value.governs && data.teamzone.value.governs.origin === "corrected" && typeof data.teamzone.value.governs.value === "string" ? data.teamzone.value.governs.value : null;
      if (tz) return `<p class="mk-note">${W(S + "timezone.help")}</p>${ui.tzSaved ? `<p data-state="tzsaved">${W(S + "timezone.saved", { zone: ui.tzSaved })}</p>` : ""}<p data-state="timezone">${W(S + "timezone.governs.local", { zone: zoneName(tz) })}</p>${form(0, null, tz)}`;
      let h = `<p class="mk-note">${W(S + "timezone.help")}</p>`;
      if (ui.tzSaved) h += `<p data-state="tzsaved">${W(S + "timezone.saved", { zone: ui.tzSaved })}</p>`;
      if (zf.length === 0) {
        // none held: said in a fold open whenever drawn, the choice below it, and no UTC in its place
        h += `<details class="mk-details" open data-state="tznone"><summary>${W(S + "timezone.none.summary")}</summary><p>${W(S + "timezone.none")}</p></details>`;
        return h + form(0, null, null);
      }
      if (distinct.size > 1) {
        // two places disagree: each place's zone, none named as the team's, and one correction for each place
        const rows = zf.map((f) => `<p data-state="tzplace">${W(S + "timezone.governs.profile", { zone: zoneName(f.governs.value), profile: profileName(f.fact.profile) })}</p>`).join("");
        h += `<details class="mk-details" open data-state="tztwo"><summary>${W(S + "timezone.two.summary")}</summary>${rows}<p>${W(S + "timezone.two")}</p></details>`;
        // one correction, on the team's own path (D-B1): stating the team's zone settles the places' disagreement
        return h + form(0, null, null);
      }
      const f = zf[0], z = zoneName(f.governs.value);
      h += f.governs.origin === "corrected"
        ? `<p data-state="timezone">${W(S + "timezone.governs.local", { zone: z })}</p>`
        : `<p data-state="timezone">${W(S + "timezone.governs.profile", { zone: z, profile: profileName(f.fact.profile) })}</p><p class="mk-small" data-state="origin">${W("settings.set.line.setup")}</p>`;
      return h + form(0, f, f.governs.value);
    }));

    // the court notice
    section(S + "court.heading", cs.state(data.court, (v) => {
      const c = v.choice === "tell" || v.choice === "dont" ? v.choice : null;
      let h = `<p class="mk-note">${W(S + "court.says")}</p><p data-state="court">${W(c === "tell" ? S + "court.tell" : S + "court.dont")}</p>`;
      const ct = A("courtnoticeset");
      if (ct) h += `<fieldset><legend>${W(S + "court.field")}</legend>${["tell", "dont"].map((x) => `<label for="gr-court-${x}"><input type="radio" id="gr-court-${x}" name="gr-court"${(c || "dont") === x ? " checked" : ""}>${W(S + "court.choice." + x)}</label>`).join("")}</fieldset>${ct}`;
      return h;
    }));

    // who holds the hosting account
    section(S + "hosting.heading", cs.state(data.hosting, (v) => {
      const cur = v.current || null;
      // R44: its defined term carries the card on the heading, and the section opens with what it is, said once
      const hs = A("hostingaccessset");
      // a section that holds nothing is not drawn (R28): the sentence that opens it needs something held, or the form
      if (!cur && !hs) return "";
      // R75, C88: recorded by no one (the bootstrap) or by Civicsmith itself has its own words; a member, the founder among them, who may have
      // recorded it again long after setup, is named by memberName on the day recorded: the line never claims "when set up" for a date that is not
      const recBy = cur ? String(cur.recorded_by || "").replace(/^member:/, "") : "";
      const rec = !cur ? "" : recBy === "" || recBy === "bootstrap" || recBy === "setup" ? "setup" : /^(token|class|daemon|system|seed|session|accelerator|sweep)/.test(recBy) ? "system" : "";
      const nowLine = !cur ? "" : rec ? W(S + "hosting.now." + rec, { date: D(cur.at) }) : recBy === "admin" ? W(S + "hosting.now.date", { date: D(cur.at) }) : W(S + "hosting.now", { by: cs.memberName(recBy), date: D(cur.at) });
      let h = `<p class="mk-note">${W(S + "hosting.says")}</p>` + (cur ? `<p data-state="hosting">${nowLine} <span class="rec">${E(cur.holders)}</span>${cur.note ? ` · <span class="rec">${E(cur.note)}</span>` : ""}</p>` : "");
      if (hs) h += `${cs.field("gr-holders", S + "hosting.field", { rec: true, max: 500, value: cur ? cur.holders : "", autocomplete: "off" })}${cs.field("gr-hnote", S + "hosting.note", { rec: true, max: 280, value: cur && cur.note ? cur.note : "", autocomplete: "off" })}${hs}`;
      return h;
    }), "term.hostingaccount.means");

    // the group's bar, reasoned
    section(S + "bar.heading", cs.state(data.bar, (v) => {
      const b = v.bar || null;
      let h = b ? `<p data-state="bar">${W(S + "bar.now", { capture: b.capture || "–", connection: b.connection || "–", date: D(b.at) })}</p>${b.reason ? `<p><span class="rec">${E(b.reason)}</span></p>` : ""}` : "";
      const bs = A("strengthbarset");
      if (bs) {
        const opts = [["", S + "bar.unset"], ...["A", "B", "C", "D"].map((g) => ({ value: g, text: g }))];
        h += `${cs.choice("gr-cap", S + "bar.capture", opts, { value: b && b.capture ? b.capture : "" })}${cs.choice("gr-con", S + "bar.connection", opts, { value: b && b.connection ? b.connection : "" })}${cs.field("gr-why", S + "bar.reason", { area: true, rec: true, max: 2000 })}${bs}`;
      }
      return h;
    }), "term.bar.team.means");

    // R66 (C30; DEC-376; corpus-export R1, R2): a copy of the team's record, taken by the founder (`export`; a session that is not hers is
    // offered no such act and told who can), and the list of the copies taken, which every administrator reads (`exportlog`), newest first
    if (admin) {
      const take = cs.act("export", { tone: "primary" });
      const ex = ui.exports || null;
      const list = ex ? (Array.isArray(ex.exports) ? ex.exports : []) : null;
      const data1 = (x) => `<span class="mk-data">${E(String(x))}</span>`, data2 = (x) => `<span class="mk-data">${x}</span>`;
      const logAct = cs.act("exportlog", { label: S + "export.log.act" });
      let h = `<p class="mk-note">${W(S + "export.says")}</p>`;
      if (take) h += `${cs.field("gr-exnote", S + "export.note.label", { help: S + "export.note.help", rec: true, autocomplete: "off" })}<p class="mk-small">${W(S + "export.note.cut")}</p>${take}<p class="mk-note">${W(S + "export.undone")} ${W(S + "export.undone.why")}</p>`;
      else h += `<p class="mk-note">${W(S + "export.refused.founder")} ${W(S + "export.refused.next")}</p>`;
      // C85: the copy just taken, offered as a file and its counts labelled; it lives in the page's memory for the sitting and is drawn nowhere
      // each count is drawn with its own label, one or many (C85), a zero as any other; the tables follow the sentence after a comma
      const count = (n, one, other) => (Number(n) === 1 ? W(one) : W(other, { n: String(Number(n) || 0) }));
      const copy = ui.copy || null;
      if (copy) {
        const c = copy.counts || {};
        const records = T(Number(c.bundles) === 1 ? "queue.export-performed.records.one" : "queue.export-performed.records.other", { n: String(Number(c.bundles) || 0) });
        const files = T(Number(c.files) === 1 ? "queue.export-performed.files.one" : "queue.export-performed.files.other", { n: String(Number(c.files) || 0) });
        h += `<div class="mk-msg" data-shown="copy"><p>${W("queue.export-performed.summary", { date: D(copy.at), records, files })}, ${count(c.tables, S + "export.count.tables.one", S + "export.count.tables.other")}</p>${cs.save("bio-record-copy-" + String(copy.at).slice(0, 10) + ".json", copy.text, { label: "shell.save" })}</div>`;
      }
      h += logAct;
      if (list) h += cs.sheet(list.map((r) => cs.row("", `${data1(D(r.at))} · ${data2(count(r.bundles, "queue.export-performed.records.one", "queue.export-performed.records.other"))} · ${data2(count(r.files, "queue.export-performed.files.one", "queue.export-performed.files.other"))} · ${data2(count(r.tables, S + "export.count.tables.one", S + "export.count.tables.other"))}`, "", r.note ? `<span class="rec">${E(r.note)}</span>` : "")).join("")) + `<p class="mk-note">${W(S + "export.log.cap")}</p>`;
      section(S + "export.head", h);
    }

    // R79 (G42; K4635, K4638): how full the team's record is. The record is one object of 10 GB (decimal, pinned here), past which every write
    // fails. Drawn for a caller whose `stats` answer carries `dbBytes` (an administrator; to an administering member it is floored to 100 MB
    // by the door): its size in GB and whole percent (floored, so "70%" is never drawn under the first warning's edge), a warning at 70% and
    // over, a second at 90% and over saying writes will fail, each naming the four things that govern a record's realistic size (one key per
    // sentence). A key absent draws nothing; null (the object states no size) is "not stated", never zero.
    if (admin) {
      const LIMIT = 10_000_000_000;
      section("screen.settings.storage.head", cs.state(data.stats, (v) => {
        if (!v || typeof v !== "object" || !("dbBytes" in v)) return "";
        const n = v.dbBytes;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return `<p data-state="storage">${W(S + "storage.unstated")}</p>`;
        const level = n * 10 >= LIMIT * 9 ? 2 : n * 10 >= LIMIT * 7 ? 1 : 0;
        let h = `<p data-state="storage">${W(S + "storage.size", { used: (Math.floor(n / 1e8) / 10).toFixed(1), limit: String(LIMIT / 1e9), percent: String(Math.floor((n * 100) / LIMIT)) })}</p>`;
        if (level) h += `<div class="mk-msg" data-state="storagewarn${level}"><p>${W(S + "storage.warn" + level)}</p><p>${W(S + "storage.factors.lead")}</p><ul class="mk-small">${["plan", "pare", "latency", "limits"].map((k) => `<li>${W(S + "storage.factors." + k)}</li>`).join("")}</ul></div>`;
        return h;
      }));
    }

    // R40 (DEC-231; instance-setup R11, R77): the group's declared stake, in its own words, who set it and when; an administrator edits it
    // (an emptied field clears it) and may ask the assistant for a draft, kept only by their own save
    section("stake.group.title", cs.state(data.identity, (v) => {
      if (!v.declared_stake || !("stake" in v.declared_stake)) return `<p data-state="stake">${W("stake.unreadable")}</p>`;
      const d = v.declared_stake;
      const ui = view.ui || {};
      const who = (by) => cs.memberName(String(by || "").replace(/^member:/, ""));
      const earlier = Array.isArray(v.declared_stake_history) ? Math.max(0, v.declared_stake_history.length - 1) : 0;
      let h = d.stake ? `<p data-state="stake"><span class="rec">${E(d.stake)}</span></p><p class="mk-small">${W("stake.set", { who: who(d.set_by), date: D(d.set_at) })}${earlier ? " · " + W("stake.history", { n: earlier }) : ""}</p>` : `<p data-state="stake">${W("stake.none")}</p>`;
      const save = A("declaredstakeset");
      if (save) {
        const dr = ui.draft && ui.draft.field === "stake" ? ui.draft : null;
        const help = view.reachable ? A("writinghelp", { data: { field: "stake", id: "gr-stake" } }) : "";
        h += `<p class="mk-note">${W("stake.group.help")}</p>${cs.field("gr-stake", "stake.group.label", { rec: true, max: 1000, value: dr ? dr.text : d.stake || "", autocomplete: "off", ...(dr ? { draft: "screen.group-identity.draft.label", draftFills: { handle: dr.askedBy } } : {}) })}${dr && dr.untested ? ` <span class="mk-tag">${W("ai.label.untested")}</span>` : ""}${help}${save}`;
      }
      return h;
    }));
    return out.join("");
  },

  acts: [
    // R52: the name saved is acknowledged, or that it was already the name, so nothing changed
    { op: "groupnameset", rereads: ["identity"],
      ready(view, el, cs) { if (!String(cs.value("gr-name") || "").trim()) return { refuse: "screen.group.name.empty" }; },
      send(view, el, cs) {
        const name = String(cs.value("gr-name") || "").trim();
        if (!name) return { refuse: "screen.group.name.empty" };
        const id = view.data && view.data.identity && view.data.identity.state === "ok" ? view.data.identity.value : null;
        cs.set("nameBefore", id ? id.display_name || "" : "");
        return { body: { name } };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && typeof a.display_name === "string") cs.set("nameSaved", { name: a.display_name, same: a.display_name === ((view.ui && view.ui.nameBefore) || "") });
      } },
    // R45: the time zone corrected, chosen by name, with how and where it was checked, on the fact's own path as `factstatus` lists it
    // (the page composes none, local-facts R6); the owner's refusals are drawn in their words
    { op: "factconfirm", rereads: ["facts", "teamzone"],
      send(view, el, cs) {
        const i = el.dataset.slot || "0";
        const value = String(cs.value("gr-tz" + i) || "").trim();
        const body = { act: "correct", value, how: String(cs.value("gr-tz-how" + i) || "").trim(), source: String(cs.value("gr-tz-src" + i) || "").trim() };
        if (el.dataset.path) body.path = el.dataset.path;
        cs.set("tzValue", value);
        return { body };
      },
      done(view, answer, cs) {
        const id = (view.ui && view.ui.tzValue) || "";
        const named = (z) => { const ZN = { "America/Los_Angeles": 1, "America/Denver": 1, "America/Phoenix": 1, "America/Chicago": 1, "America/New_York": 1, "America/Anchorage": 1, "Pacific/Honolulu": 1 }; if (ZN[z]) return cs.w("label.timezones." + z); let g = ""; try { const p = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName"); g = p ? p.value : ""; } catch (e) { g = ""; } const c = String(z).split("/").pop().replace(/_/g, " "); return g ? g + " (" + c + ")" : c; };
        cs.set("tzSaved", String(named(id)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])));
      } },
    // the image's own bytes as the request's body, a PNG or a JPEG (instance-setup R84)
    { op: "grouplogoset", rereads: ["identity"],
      send(view, el, cs) {
        const f = cs.file("gr-logo");
        if (!f) return { refuse: "screen.group.logo.nofile" };
        if (f.type !== "image/png" && f.type !== "image/jpeg") return { refuse: "screen.group.logo.type" };
        if (f.size > 200 * 1024) return { refuse: "screen.group.logo.size" };
        return { raw: f, rawType: f.type };
      } },
    { op: "groupdomainset", rereads: ["identity"],
      ready(view, el, cs) { if (!String(cs.value("gr-domain") || "").trim()) return { refuse: "screen.group.domain.empty" }; },
      send(view, el, cs) { const domain = String(cs.value("gr-domain") || "").trim(); return domain ? { body: { domain } } : { refuse: "screen.group.domain.empty" }; },
      refusals: { GROUP_DOMAIN_MALFORMED: "screen.domainfile.refused.malformed", NOT_AN_ADMIN: "screen.domainfile.refused.notadmin" } },
    // R66: a copy of the record, with the founder's words for the list; the manifest it answers is the copy itself and is kept nowhere on the page,
    // the list is read again to show it
    { op: "export", rereads: [],
      // her words travel as the query's note, where the owner reads it (corpus-export R6; C85)
      send(view, el, cs) { const note = String(cs.value("gr-exnote") || "").trim(); return { query: note ? { note } : {} }; },
      // the manifest is the copy: offered as a file in this sitting (page memory only), its counts labelled; the list is read again
      async done(view, answer, cs) {
        const copy = answer && typeof answer === "object" && answer.counts && typeof answer.counts === "object" ? { at: String(answer.at || ""), counts: answer.counts, text: JSON.stringify(answer) } : null;
        const r = await cs.call("exportlog", {}); const a = r && r.result !== undefined ? r.result : r;
        if (a && Array.isArray(a.exports)) cs.set("exports", a);
        if (copy) cs.set("copy", copy);
      },
      refusals: { ROOT_OF_TRUST_REQUIRED: (r, cs) => `${cs.w("screen.group.export.refused.founder")} ${cs.w("screen.group.export.refused.next")}` } },
    // the copies taken so far, newest first (corpus-export R2)
    { op: "exportlog", rereads: [],
      send() { return {}; },
      done(view, answer, cs) { const a = answer && answer.result !== undefined ? answer.result : answer; cs.set("exports", a && typeof a === "object" ? a : { exports: [] }); } },
    { op: "grouplanguagesset", rereads: ["languages"],
      send(view, el, cs) {
        const languages = ((view.ui && view.ui.offered) || []).filter((t) => cs.value("gr-lang-" + t) === true);
        return languages.length >= 1 && languages.length <= 20 ? { body: { languages } } : { refuse: "screen.group.languages.count" };
      } },
    { op: "courtnoticeset", rereads: ["court"],
      send(view, el, cs) { return { body: { choice: cs.value("gr-court-tell") === true ? "tell" : "dont" } }; } },
    { op: "hostingaccessset", rereads: ["hosting"],
      ready(view, el, cs) { if (!String(cs.value("gr-holders") || "").trim()) return { refuse: "screen.group.hosting.empty" }; },
      send(view, el, cs) {
        const holders = String(cs.value("gr-holders") || "").trim(), note = String(cs.value("gr-hnote") || "").trim();
        return holders ? { body: note ? { holders, note } : { holders } } : { refuse: "screen.group.hosting.empty" };
      } },
    // R40: an emptied field clears the statement (`null`); the owner judges the text (STAKE_MALFORMED, NOT_AN_ADMIN)
    { op: "declaredstakeset", rereads: ["identity"],
      send(view, el, cs) { const stake = String(cs.value("gr-stake") || "").trim(); return { body: { stake: stake || null } }; },
      done(view, answer, cs) { if (view.ui && view.ui.draft) cs.set("draft", null); } },
    // the assistant's help with the statement (wizard-scripts R27): nothing is kept until the administrator saves; the words it is told
    // are its reason (interface-shell R11's `reasonField`), as `notes` does
    { op: "writinghelp", rereads: [], reasonField: "told",
      send(view, el, cs) {
        const told = String(cs.value(el.dataset.id) || "").trim();
        cs.set("helping", el.dataset.field);
        return { body: { op: "declaredstakeset", field: "stake", told } };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const me = view.me || {};
        const by = a && a.label && a.label.asked_by ? String(a.label.asked_by).replace(/^member:/, "") : me.member;
        if (a && typeof a.text === "string") cs.fill("gr-stake", a.text);
        cs.set("draft", { field: "stake", text: (a && a.text) || "", askedBy: by === me.member && me.handle ? me.handle : cs.memberName(by), untested: !!(a && (a.untested || (a.label && a.label.untested))) });
      } },
    // the bar's reason is the administrator's own words, in its field (interface-shell R11's `reasonField`)
    { op: "strengthbarset", rereads: ["bar"], reasonField: "reason",
      send(view, el, cs) {
        const capture = cs.value("gr-cap") || null, connection = cs.value("gr-con") || null;
        const reason = String(cs.value("gr-why") || "").trim();
        if (!capture && !connection) return { refuse: "screen.group.bar.nograde" };
        if (!reason || reason.length > 2000) return { refuse: "screen.group.bar.noreason" };
        return { body: { capture, connection, reason } };
      } },
  ],
};
