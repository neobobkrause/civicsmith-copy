/* screens-settings R1, R2 (and R8), as R47 leaves them: Settings › Members, the registry's 11 acts. The roster only, each
   row's acts in its panel (interface-shell R19, `cs.rows`); the one-administrator note while not met (setup-page R16's
   meaning); inviting, with the invitation shown once; joining through the team's website. To a member who does not
   administer it is a table of members, what each may do and their expertise (R47). The team's key, its use and keeping
   material away from AI are `teamai`'s (R48). The founder's row is the roster's (R51). A member opened by address
   (`/app/members/<id>`) has their expertise read (`expertiselist`) and their row's panel offers its confirmation. Every
   function is self-contained (interface-shell R21).
   T47: each row's name is the member's reference (R12, `cs.rows`' `name`, interface-shell R27); a row offers "Make a
   reset link" (`passwordresetlink`, the link shown once with the sentence that no email is sent) and "Withdraw
   <handle>'s signing key" (`signerset`) for a lost or stolen device; "More for administrators" links `group`, `places`
   and `recovery` (R23).
   T51 (R55, R56; DEC-330 A72, A74, B5; DEC-332 (3), (4)): to an administrator, a section of the members' signing keys beside the
   roster (`signerlist`): who registered each and when, Withdraw (not on one's own key, which `account` revokes), a withdrawn key's
   line with Reactivate (never for a member who has left), "no signing key yet"; and "Register a key for this member"
   (`signeradd`: a pasted public line, split here into `keyB64` and `comment`). Then what removing an administrator takes
   (`adminarith`: the live count in words, the founder's reconcile fold, the fold of how it changes). A removal under way is not
   drawn (N1248, T52's); R23's withdraw in a row's panel moved to the keys section.
   T51 FR-25 (R63, R64, R71, R72; C79, C80, L30, T-05; DEC-376, DEC-384, DEC-386): a confirmed expertise offers "Withdraw an expertise",
   its own act (`expertisewithdraw`, with the administrator's reason) beside Confirm for a declared one; the signing-key chooser lists the
   founder, once she holds a handle; a member's name opens `/app/members/<handle>` (the address carries the handle, never the id the
   invitation was made under); and ticking "look after the team's Civicsmith" in the invitation draws what it hands over, the invitation
   waiting for the administrator's answer. */

export const members = {
  id: "members",

  reads(view) {
    const admin = !!(view.me && view.me.administer === true);
    const r = {
      roster: { op: "memberlist", empty: (v) => !v.members || v.members.length === 0 },
    };
    if (view.subject) r.expertise = { op: "expertiselist", query: { memberId: view.subject } };
    // the owners refuse these to a member who does not administer (instance-setup R66; credentials R60)
    if (admin) {
      r.recovery = { op: "adminrecoverystep" };
      r.signers = { op: "signerlist" };
      r.arith = { op: "adminarith" };
      // a removal under way (member-roster R75; R56 item 4)
      r.removals = { op: "adminremovalsopen" };
      // the names of the projects the administrator sees in full, for the roster's Projects column (R47; Membership v2 §7.8)
      r.projects = { op: "projectlist" };
    }
    return r;
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.members.";
    const T = (k, f) => String(W(k, f)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const me = view.me || {};
    const ui = view.ui || {};
    const data = view.data || {};
    const admin = me.administer === true;
    const okv = (o) => (o && o.state === "ok" ? o.value : null);
    const roster = okv(data.roster) && Array.isArray(data.roster.value.members) ? data.roster.value.members : [];
    // the founder is named by her handle, else by `member.founder.unnamed`, never by the id `admin` (R35, R51; membership R144, R147): her
    // own session answers her handle in `whoami`; the roster's row for her carries it too
    const founderRow = roster.find((m) => m.member_id === "admin" || m.founder === true) || null;
    const founderHandle = (founderRow && founderRow.handle) || (me.member === "admin" && me.handle ? me.handle : null);
    const founderName = () => founderHandle || T("member.founder.unnamed");
    const vocabulary = Array.isArray(me.vocabulary) && me.vocabulary.length ? me.vocabulary : ["contribute", "publish", "create_projects"];
    const capName = (c) => vocabulary.indexOf(c) >= 0 || c === "administer" ? T(S + "cap." + c) : c;
    const out = [cs.title()];
    // a member opened by address (their handle, R71; or the id an earlier link carried) has their row's panel open (interface-shell R19's
    // `open:<rows>`), once the roster is read
    const isSubject = (m) => view.subject !== undefined && view.subject !== null && (m.handle === view.subject || m.member_id === view.subject);
    if (view.subject && view.ui && !view.ui.subjectOpened && okv(data.roster)) {
      const at = roster.find(isSubject);
      if (at) view.ui["open:roster"] = [...(view.ui["open:roster"] || []), String(at.member_id)];
      view.ui.subjectOpened = true;
    }

    // the roster (R1): handle, cover, role, capabilities, status; no "formerly" (DEC-197). The founder's row is the roster's own
    // (R51; membership R147): drawn from `memberlist`'s row for her, first, and counted once with the rest, so the counts agree with
    // what they name (R29, R35) and the page adds no row of its own
    out.push(cs.state(data.roster, (v) => {
      const list = (Array.isArray(v.members) ? v.members : []).slice().sort((x, y) => (y.founder === true || y.member_id === "admin" ? 1 : 0) - (x.founder === true || x.member_id === "admin" ? 1 : 0));
      const active = list.filter((m) => m.status === "active");
      const rec = okv(data.recovery);
      let h = `<p>${W(S + "count", { members: active.length, administrators: active.filter((m) => m.role === "admin").length })}</p>`;
      if (admin && rec && rec.met === false) {
        const lead = rec.administrators === 1 ? W(S + "recovery.one") : W(S + "recovery.many", { administrators: rec.administrators });
        h += `<div class="mk-msg" data-note="recovery"><p>${lead}${lead ? " " : ""}${W(rec.codes_held ? S + "recovery.codes" : S + "recovery.nocodes", { remaining: rec.remaining })}</p><div class="mk-links">${rec.administrators < 2 ? `<a class="cs-ref" href="#members-invite">${W(S + "recovery.add")}</a>` : ""}${rec.codes_held ? "" : `<a class="cs-ref" href="/app/recovery" data-nav>${W(S + "recovery.issue")}</a>`}</div></div>`;
      }
      const isFounder = (m) => m.founder === true || m.member_id === "admin";
      const expOf = (m) => {
        const ex = okv(data.expertise);
        // the read answers for the member it was asked about: opened by a handle, the owner answers an empty list for that name, which is not this member's (R71)
        return isSubject(m) && ex && ex.memberId === m.member_id ? ex.expertise || [] : m.expertise || [];
      };
      // the member by handle (their reference); the founder by hers, else `member.founder.unnamed` with its explanation, never by her id (R51)
      const nameOf = (m) => (isFounder(m) ? E(founderName()) : m.handle ? cs.ref("member", m.handle, m.handle) : E(T(S + "nohandle")));
      const capsOf = (m) => (m.role === "admin" ? W(S + "cap.all") : E((m.capabilities || []).map(capName).join(", ")));
      const expText = (m) => {
        const e = expOf(m).filter((x) => x.state !== "withdrawn");
        return e.length ? e.map((x) => W(x.confirmed ? S + "expertise.confirmed" : S + "expertise.declared", { label: x.label })).join(" · ") : W(S + "expertise.none");
      };
      // to a member who does not administer: the roster as a table, each column explained, and who changes it (R47)
      if (!admin) {
        const th = (k) => `<th><span class="k" tabindex="0" data-level="1" data-tip="${W("column.members." + k + ".shows")}">${W("column.members." + k + ".name")}</span></th>`;
        return h + `<table class="mk-table" data-list="members"><thead><tr>${th("member")}${th("may-do")}${th("expertise")}</tr></thead><tbody>${active.map((m) => `<tr><td>${nameOf(m)}${isFounder(m) && !founderHandle ? `<span class="mk-small">${W("member.founder.unnamed.help")}</span>` : ""}</td><td>${capsOf(m)}</td><td>${expText(m)}</td></tr>`).join("")}</tbody></table><p class="mk-note">${W(S + "member.note")}</p>`;
      }
      const cols = [S + "col.handle", S + "col.cover", S + "col.role", S + "col.caps", S + "col.status", S + "col.expertise", "screen.projects.name"];
      // the member's projects, as `memberlist` states them for an administrator's roster (membership R18: the projects the administrator sees
      // in full, and a hidden one's owner only): each one the member has joined, by the name `projectlist` gives it, "owner of" or "works on"
      // (the design's member card). A project the administrator can read no name for is not drawn by its id; a failed read is drawn failed.
      const projectsOf = (m) => {
        const mine = (Array.isArray(m.projects) ? m.projects : []).filter((p) => p && p.state === "joined");
        if (!mine.length) return "";
        return cs.state(data.projects, (v) => {
          const named = new Map((Array.isArray(v.projects) ? v.projects : []).map((p) => [p.id, p.name]));
          return mine.filter((p) => typeof named.get(p.project) === "string" && named.get(p.project) !== "")
            .map((p) => W(p.owner === true ? "screen.members.tip.owner" : "screen.members.tip.workson", { project: named.get(p.project) })).join(" · ");
        });
      };
      return h + cs.rows({
        // the member's handle is their reference (R12); one not joined yet has none
        id: "roster", cols, items: list, key: (m) => m.member_id, name: (m) => nameOf(m),
        cells: (m) => [
          nameOf(m) + (isFounder(m) && !founderHandle ? `<span class="mk-small">${W("member.founder.unnamed.help")}</span>` : ""),
          m.cover !== undefined ? E(m.cover) : "",
          W(m.role === "admin" ? S + "role.admin" : S + "role.member"),
          capsOf(m),
          W(S + "status." + (["invited", "proposed", "active", "revoked"].indexOf(m.status) >= 0 ? m.status : "other")) + (m.invitation ? " · " + W(S + "invitation." + m.invitation) : ""),
          expOf(m).filter((e) => e.state !== "withdrawn").map((e) => W(e.confirmed ? S + "expertise.confirmed" : S + "expertise.declared", { label: e.label })).join(" · "),
          projectsOf(m),
        ],
        // each row's acts, in its panel (R2; interface-shell R19)
        acts: (m) => {
          const label = isFounder(m) ? founderName() : m.handle || T(S + "nohandle");
          const id = m.member_id;
          const p = [];
          if (m.role !== "admin" && m.status === "active") {
            const c = cs.act("membercaps", { data: { member: id } });
            if (c) p.push(`<fieldset><legend>${W(S + "caps.legend", { handle: label })}</legend>${vocabulary.map((v) => `<label for="mc-${E(id)}-${v}"><input type="checkbox" id="mc-${E(id)}-${v}"${(m.capabilities || []).indexOf(v) >= 0 ? " checked" : ""}>${E(capName(v))}</label>`).join("")}</fieldset>${c}`);
          }
          if (m.status === "revoked" || (m.status === "active" && m.role !== "admin")) {
            const next = m.status === "active" ? "revoked" : "active";
            const c = cs.act("memberset", { data: { member: id, status: next } });
            if (c) p.push(`<p>${W(S + "status.to." + next, { handle: label })}</p>${c}`);
          }
          if (m.role === "admin" && m.status === "proposed") { const c = cs.act("adminendorse", { data: { member: id } }); if (c) p.push(`<p>${W(S + "endorse.what", { handle: label })}</p>${c}`); }
          // the founder cannot be removed (membership R64): no act is drawn on her row
          // C90: not drawn where the plane cannot carry a removal (two administrators: no majority leaves the one facing it out); the
          // section below says why. A count that was not read hides nothing.
          const liveArith = okv(data.arith) && okv(data.arith).live ? okv(data.arith).live : null;
          if (m.role === "admin" && m.status === "active" && id !== me.member && !isFounder(m) && !(liveArith && liveArith.possible === false)) {
            const c = cs.act("adminremove", { data: { member: id } });
            if (c) p.push(`${cs.field("mr-" + id, S + "remove.reason", { area: true, rec: true, max: 2000 })}${c}`);
          }
          if (m.invitation === "live") p.push(cs.act("invitewithdraw", { data: { member: id } }));
          // a reset link for a member who has joined (credentials R69), shown once; an administrator's act, which the
          // owner refuses anyone else (drawn only to a session that administers, interface-shell R12)
          if (m.handle && m.status === "active" && id !== me.member && !isFounder(m)) {
            // its label is held under the owed act's key in `words.json` (DEC-201 (2))
            const c = cs.act("passwordresetlink", { label: "act.owed_passwordresetlink.label.members", data: { member: id } });
            if (c) p.push(`${ui.reset && ui.reset.member === id ? `<div class="mk-msg" data-shown="reset"><p>${W(S + "reset.shown", { handle: label, expires: D(ui.reset.expires) })}</p><p><code>${E(ui.reset.link)}</code></p><p>${W(S + "reset.noemail")}</p></div>` : ""}${c}`);
          }
          // a declared expertise is confirmed; a confirmed one is withdrawn, the confirmation and the declaration together (R63; DEC-376, DEC-386)
          for (const e of expOf(m)) {
            if (e.state === "declared" && !e.confirmed) p.push(`<p>${W(S + "expertise.declared", { label: e.label })}</p>${cs.act("expertiseconfirm", { data: { member: id, label: e.label } })}`);
            else if (e.confirmed === true && e.state !== "withdrawn") {
              const c = cs.act("expertisewithdraw", { label: "act.owed_expertisewithdraw.label.members", data: { member: id, label: e.label } });
              if (c) p.push(`<p>${W(S + "expertise.confirmed", { label: e.label })}</p>${c}`);
            }
          }
          return p.join("");
        },
      });
    }, { empty: S + "empty" }));

    // more for administrators (R23): the group's other settings
    if (admin) out.push(cs.sec(S + "more.heading", `<div class="mk-links" data-list="more">${["group", "places", "recovery"].map((id) => `<a class="cs-ref" href="/app/${id}" data-nav>${W("screen." + id + ".name")}</a>`).join("")}</div>`));

    // inviting (R2): the short id, the cover and the capabilities ticked; the invitation shown once. The capabilities are the kit's checks, which
    // redraw at once and send nothing (interface-shell R90): ticking "look after the team's Civicsmith" draws what it hands over and the
    // invitation waits for the administrator's answer (R72; DEC-384 T-05)
    const add = cs.act("memberadd");
    // the shell reads the members' handles when a screen first asks for a name it does not hold: ask for the administrators' once the roster is
    // drawn, so a proposal's sentence ("still to endorse: ...") names them by handle when the act is answered (R2; interface-shell R111, R112)
    if (admin) for (const m of roster) if (m.role === "admin" && m.member_id) cs.memberName(String(m.member_id));
    if (add) {
      const shown = (ui.invite ? `<div class="mk-msg" data-shown="invite"><p>${W(S + "invite.shown", { handle: ui.invite.memberId, expires: D(ui.invite.expires) })}</p><p><code>${E(ui.invite.link)}</code></p></div>` : "");
      const caps = [...vocabulary, "administer"];
      let picked = Array.isArray(ui.inviteCaps) ? ui.inviteCaps : ["contribute"];
      // "Go back" is answered here: the grant is unticked and the question forgotten
      if (ui.adminOk === "no") { ui.adminOk = undefined; picked = ui.inviteCaps = picked.filter((c) => c !== "administer"); }
      const grant = picked.indexOf("administer") >= 0;
      if (!grant && ui.adminOk !== undefined) ui.adminOk = undefined;
      const who = String(cs.value("mi-cover") || cs.value("mi-id") || "").trim();
      const asking = grant && who !== "";
      const card = asking ? `<div class="mk-msg" data-confirm="administer"><p>${W(S + "cap.administer.confirm", { who })}</p>${cs.checks("mi-ok", { text: T(S + "cap.administer.confirm.head", { who }) }, [
        { value: "yes", key: S + "cap.administer.confirm.yes", fills: { who }, on: ui.adminOk === "yes" },
        { value: "no", key: S + "cap.administer.confirm.no", on: false },
      ], { radio: true, redraw: "adminOk" })}</div>` : "";
      const boxes = cs.checks("mi-caps", S + "invite.caps", caps.map((v) => ({ value: v, text: capName(v), on: picked.indexOf(v) >= 0 })), { redraw: "inviteCaps" });
      out.push(`<div id="members-invite">${cs.sec(S + "invite.heading", `${shown}${cs.field("mi-id", S + "invite.id", { help: S + "invite.id.help", autocomplete: "off" })}${cs.field("mi-cover", S + "invite.cover", { autocomplete: "off" })}${boxes}${card}${asking && ui.adminOk !== "yes" ? "" : add}<p class="mk-note">${W(S + "invite.noemail")}</p>`)}</div>`);
    }

    // joining through the group's website: a website key, or the reusable join link, each shown once
    const wk = cs.act("websitekeycreate"), jl = cs.act("joinlinkenable");
    if (wk || jl) {
      let shown = "";
      if (ui.websiteKey) shown += `<div class="mk-msg" data-shown="websitekey"><p>${W(S + "website.keyshown")}</p><p><code>${E(ui.websiteKey)}</code></p></div>`;
      if (ui.joinLink) shown += `<div class="mk-msg" data-shown="joinlink"><p>${W(S + "website.linkshown")}</p><p><code>${E(ui.joinLink)}</code></p></div>`;
      out.push(cs.sec(S + "website.heading", `<p>${W(S + "website.what")}</p>${shown}${cs.field("mw-cap", S + "website.cap")}${cs.field("mw-days", S + "website.days")}${wk}${jl}`));
    }

    if (admin) {
      const activeList = (Array.isArray(okv(data.roster) && data.roster.value.members) ? data.roster.value.members : []).slice()
        .sort((x, y) => (y.founder === true || y.member_id === "admin" ? 1 : 0) - (x.founder === true || x.member_id === "admin" ? 1 : 0)).filter((m) => m.status === "active");
      const isF = (m) => m.founder === true || m.member_id === "admin";
      const labelOf = (m) => (isF(m) ? founderName() : m.handle || T(S + "nohandle"));
      // who: a member id, `admin` (the founder), or `not recorded` (credentials R21): named by handle through the roster, else not at all
      const whoOf = (id) => {
        const x = String(id == null ? "" : id).replace(/^member:/, "");
        if (!x || x === "not recorded") return null;
        if (x === "admin") return founderName();
        const m = roster.find((r) => r.member_id === x);
        return (m && m.handle) || cs.memberName(x);
      };
      // R55: the members' signing keys, beside the roster; each member's row, then the key an administrator registers for one
      const rowsOf = (v) => {
        const keys = Array.isArray(v.signers) ? v.signers : [];
        return `<ul class="mk-list" data-list="keys">${activeList.map((m) => {
          const label = labelOf(m);
          const mine = keys.filter((k) => k.member_id === m.member_id);
          const line = (k) => {
            if (k.status === "active") {
              const by = whoOf(k.registered_by), when = k.added ? D(k.added) : null;
              const w1 = by && when ? W(S + "key.registered.by.rosa.3", { member: by, date: when }) : W(S + "key.registered.unrecorded");
              // not on the viewer's own key: she revokes it herself on `account` (DEC-336 (7))
              const out1 = k.member_id === me.member ? "" : cs.act("signerset", { label: S + "signer.withdraw", fills: { handle: label }, data: { key: k.key_b64, status: "revoked" } });
              return `<span data-key-state="active">${w1}</span>${out1}`;
            }
            const by = whoOf(k.status_by), when = k.status_at ? D(k.status_at) : null;
            const w2 = by && when ? W(S + "key.react.key.withdrawn.by.rosa.12", { member: by, date: when }) : W(S + "key.withdrawn.unrecorded");
            // never for a member who has left: credentials R7 refuses it
            const back = k.member_status === "active"
              ? cs.act("signerset", { label: S + "key.react.reactivate.devs.signing.key", fills: { member: label }, data: { key: k.key_b64, status: "active" } }) : "";
            const tip = [S + "key.react.help", S + "key.react.help2", S + "key.react.help3"].map((x) => W(x)).join(" ");
            return `<span data-key-state="withdrawn">${w2} · ${W(S + "key.react.it.does.not.sign")}</span>${back ? `<span class="k" tabindex="0" data-level="1" data-tip="${tip}">${back}</span>` : ""}`;
          };
          return `<li data-member="${E(m.member_id)}"><b>${E(label)}</b> ${mine.length ? mine.map(line).join(" ") : `<span class="mk-small">${W(S + "no.signing.key.yet")}</span>`}</li>`;
        }).join("")}</ul>`;
      };
      // a member to register for: an active member who has a handle (record data), the founder among them once the instance is claimed
      // and she holds one (R64; member-roster R76, credentials R81); a key cannot be registered for a name with no handle (credentials R6)
      const who = activeList.filter((m) => (isF(m) ? !!founderHandle : !!m.handle)).map((m) => ({ value: m.member_id, text: isF(m) ? founderName() : m.handle }));
      const reg = cs.act("signeradd");
      const form = reg && who.length ? `${cs.choice("ms-who", S + "keys.whose", who)}${cs.field("ms-line", S + "keys.public", { help: S + "keys.public.help", autocomplete: "off" })}${reg}<p class="mk-note">${W(S + "the.one.line.the.member")} ${W(S + "it.is.the.public.half")}</p><p class="mk-note">${W(S + "the.record.shows.that.you")} ${W(S + "they.see.it.under.your")}</p>` : "";
      out.push(cs.sec(S + "keys.heading", `<p class="mk-note">${W(S + "a.signing.key.lets.a")} ${W(S + "civicsmith.holds.only.the.public")} ${W(S + "use.this.when.a.member")}</p>${cs.state(data.signers, rowsOf)}<p class="mk-note">${W(S + "key.react.withdraw.a.key.when.a")} ${W(S + "key.react.a.key.a.member.withdrew")}</p>${form}`));

      // R56: what removing an administrator takes, worked out for the number there are; nothing here changes anything
      const arithOf = (v) => {
        const live = v && v.live ? v.live : null;
        if (!live) return "";
        let h = live.possible
          ? `<p data-state="arith">${W(S + "this.takes.3.of.4", { n: live.votesNeeded, total: live.administrators })}</p>`
          : `<p data-state="arith">${live.administrators === 1 ? W(S + "with.1.administrator.no.administrator", { n: live.administrators }) + " " : ""}${W(S + "a.majority.that.leaves.out")} ${W(S + "that.is.the.rule.holding")}</p>`;
        // the founder's reconcile note: only while more administrators are counted than the roster lists (B314's rule: no line claims what the record does not hold)
        const listed = activeList.filter((m) => m.role === "admin").length;
        const diff = live.administrators - listed;
        if (diff > 0) h += `<details class="mk-details" data-fold="reconcile"><summary>${W(S + "founder.if.the.count.is.higher")}</summary><p class="mk-note">${W(S + (diff === 1 ? "founder.the.count.includes.1.administrator" : "founder.the.count.includes.n.administrators"), { n: diff })} ${W(S + "founder.the.founder.holds.the.team")} ${W(S + "founder.they.are.counted.because.the")}</p></details>`;
        // the scale: one row for each count of administrators, the live row marked now (R56 item 3)
        const table = Array.isArray(v.table) ? v.table : [];
        const scale = table.length ? `<table class="mk-table" data-list="scale"><thead><tr><th>${W(S + "scale.head.admins")}</th><th>${W(S + "scale.head.takes")}</th><th>${W(S + "scale.head.who")}</th></tr></thead><tbody>${table.map((t) => {
          const now = t.administrators === live.administrators;
          return `<tr${now ? ' aria-current="true"' : ""}><td>${E(t.administrators)}${now ? " " + W(S + "scale.now") : ""}</td><td>${t.possible ? W(S + "scale.takes", { k: t.votesNeeded, n: t.administrators }) : W(S + "scale.not_removable")}</td><td>${t.possible ? W(S + "scale.who", { v: t.eligibleVoters, n: t.administrators }) : W(S + "scale.no_majority")}</td></tr>`;
        }).join("")}</tbody></table>` : "";
        h += `<details class="mk-details" data-fold="arith"><summary>${W(S + "how.it.changes.with.the")}</summary>${scale}<p class="mk-note">${W(S + "removal.takes.a.majority.of")} ${W(S + "the.one.facing.removal.is")} ${W(S + "a.lone.administrator.can.never")}</p></details>`;
        return h;
      };
      // a removal under way, from the answer alone: who faces it, how many of those who may vote have agreed, and who it waits for (R56 item 4)
      const removalsOf = (v) => (Array.isArray(v.removals) ? v.removals : []).map((r) => {
        const voters = (Array.isArray(r.voters) ? r.voters : []).map((x) => x && x.voter), awaiting = Array.isArray(r.awaiting) ? r.awaiting : [];
        const eligible = voters.length + awaiting.length;
        const nameOf2 = (id) => whoOf(id) || String(id);
        const target = nameOf2(r.target);
        // every administrator named in one list, the one facing removal among them (Intl's conjunction list)
        const everyone = [...voters, ...awaiting, r.target].map(nameOf2);
        const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(everyone);
        // "Agree" is drawn on the viewer's own row only: an administrator who has not voted, on a removal that is not theirs
        const agree = awaiting.indexOf(me.member) >= 0 ? `${cs.field("rm-" + r.target, S + "remove.reason", { area: true, rec: true, max: 2000 })}${cs.act("adminremove", { label: S + "agree.remove.teo.as.administrator", fills: { member: target }, data: { member: r.target } })}` : "";
        // one row for each administrator: who agreed (the day beneath), who has not voted (and that the removal waits for them), the one facing removal
        const rows = voters.map((x, i) => `<li data-voter="${E(String(x))}"><b>${W(S + "removal.agreed", { member: nameOf2(x) })}</b> <span class="mk-small">${E(D(r.voters[i].at))}</span></li>`).join("")
          + awaiting.map((x) => `<li data-awaiting="${E(String(x))}"><b>${W(S + "removal.notyet", { member: nameOf2(x) })}</b> <span class="mk-small">${W(S + "the.removal.waits.for.ana", { member: nameOf2(x) })}</span></li>`).join("")
          + `<li data-faces="${E(String(r.target))}"><b>${W(S + "removal.faces", { member: target })}</b> <span class="mk-small">${W(S + "counted.in.the.4.doesn", { n: eligible + 1 })}</span></li>`;
        return `<div data-removal="${E(String(r.target))}"><h3>${W(S + "removing.teo.as.an.administrator", { member: target })}</h3><p>${W(S + "four.administrators.rosa.dev.ana", { n: eligible + 1, members: list })}</p><h4>${W(S + "removal.heading")}</h4><p>${W(S + "teo.is.counted.but.doesn", { member: target, n: eligible })}</p><ul class="mk-list">${rows}</ul><p>${W(S + "2.of.3.have.agreed", { n: r.have, total: eligible })}</p>${agree}</div>`;
      }).join("");
      out.push(cs.sec(S + "what.removing.an.administrator.takes", `${cs.state(data.arith, arithOf)}${cs.state(data.removals, removalsOf)}<p class="mk-small">${W(S + "nothing.here.changes.anything.explain")}</p>`, { help: S + "the.team.s.own.rule.explain" }));
    }

    return out.join("");
  },

  acts: [
    // C89 (interface-shell R112): beyond the second administrator an invitation is a proposal the plane records and answers `CONSENSUS_REQUIRED`
    // with who must still endorse it; that answer is this act's success, drawn by the shell as done with the members' handles
    { op: "memberadd", rereads: ["roster", "recovery"], successCodes: ["CONSENSUS_REQUIRED"],
      refusals: { CONSENSUS_REQUIRED: function (refusal, cs) { return cs.w("refusal.CONSENSUS_REQUIRED", { awaiting: (Array.isArray(refusal.awaiting) ? refusal.awaiting : []).map(function (x) { return cs.memberName(String(x)); }).join(", ") }); } },
      // R119: an invitation with no short id or no cover is refused before any reason is asked
      ready(view, el, cs) { if (!String(cs.value("mi-id") || "").trim() || !String(cs.value("mi-cover") || "").trim()) return { refuse: "screen.members.invite.incomplete" }; },
      send(view, el, cs) {
        const vocabulary = view.me && Array.isArray(view.me.vocabulary) && view.me.vocabulary.length ? view.me.vocabulary : ["contribute", "publish", "create_projects"];
        const memberId = String(cs.value("mi-id") || "").trim(), cover = String(cs.value("mi-cover") || "").trim();
        if (!memberId || !cover) return { refuse: "screen.members.invite.incomplete" };
        const caps = [...vocabulary, "administer"].filter((v, i) => cs.value("mi-caps-" + i) === true);
        // the grant that includes administering is confirmed first (R72): nothing is sent until the answer is yes
        if (caps.indexOf("administer") >= 0 && !(view.ui && view.ui.adminOk === "yes")) { cs.set("inviteCaps", caps); return null; }
        const body = { memberId, cover, capabilities: caps.filter((v) => v !== "administer") };
        if (caps.indexOf("administer") >= 0) body.role = "admin";
        return { body };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && a.invite) cs.set("invite", { memberId: a.memberId, expires: a.expires, link: (view.origin || "") + "/#invite=" + encodeURIComponent(a.invite) });
        // the next invitation asks again, and its fields are empty: the button stays drawn, so the shell's sentence for the answer stands beside it
        cs.fill("mi-id", ""); cs.fill("mi-cover", "");
        if (view.ui && view.ui.adminOk !== undefined) cs.set("adminOk", undefined);
      } },
    { op: "membercaps", rereads: ["roster"],
      send(view, el, cs) {
        const id = el.dataset.member;
        const vocabulary = view.me && Array.isArray(view.me.vocabulary) && view.me.vocabulary.length ? view.me.vocabulary : ["contribute", "publish", "create_projects"];
        return { body: { memberId: id, capabilities: vocabulary.filter((v) => cs.value("mc-" + id + "-" + v) === true) } };
      } },
    { op: "memberset", rereads: ["roster", "recovery"],
      send(view, el) { return { body: { memberId: el.dataset.member, status: el.dataset.status } }; } },
    // the endorsement that leaves others still to endorse is `CONSENSUS_REQUIRED`, this act's success (interface-shell R112; C89)
    { op: "adminendorse", rereads: ["roster", "recovery"], successCodes: ["CONSENSUS_REQUIRED"],
      refusals: { CONSENSUS_REQUIRED: function (refusal, cs) { return cs.w("refusal.CONSENSUS_REQUIRED", { awaiting: (Array.isArray(refusal.awaiting) ? refusal.awaiting : []).map(function (x) { return cs.memberName(String(x)); }).join(", ") }); } },
      send(view, el) { return { body: { memberId: el.dataset.member } }; },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && a.invite) cs.set("invite", { memberId: a.memberId, expires: a.expires, link: (view.origin || "") + "/#invite=" + encodeURIComponent(a.invite) });
      } },
    // its reason in the administrator's own words, from the row's field (membership R7; interface-shell R11's `reasonField`)
    { op: "adminremove", rereads: ["roster", "recovery"], reasonField: "reason",
      send(view, el, cs) {
        // the reason in the field of the member's row, or of the removal under way (R56 item 4)
        const reason = String(cs.value("mr-" + el.dataset.member) || cs.value("rm-" + el.dataset.member) || "").trim();
        return reason && reason.length <= 2000 ? { body: { memberId: el.dataset.member, reason } } : { refuse: "screen.members.remove.noreason" };
      } },
    { op: "expertiseconfirm", rereads: ["roster", "expertise"],
      send(view, el) { return { body: { memberId: el.dataset.member, label: el.dataset.label } }; } },
    // the confirmed expertise taken back, the confirmation and the declaration together, with the administrator's reason (the shell's, interface-shell R107; R63)
    { op: "expertisewithdraw", rereads: ["roster", "expertise"],
      send(view, el) { return { body: { memberId: el.dataset.member, label: el.dataset.label } }; } },
    // the link the member opens to choose a new password (screens-entry's `reset`), shown once
    { op: "passwordresetlink", rereads: [],
      send(view, el) { return { body: { member: el.dataset.member } }; },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && a.link) cs.set("reset", { member: a.member, expires: a.expiresAt, link: (view.origin || "") + "/app/reset#reset=" + encodeURIComponent(a.link) });
      } },
    // Withdraw (`revoked`) or Reactivate (`active`) a member's key; the button carries which (R55)
    { op: "signerset", rereads: ["signers"],
      send(view, el) { return { body: { keyB64: el.dataset.key, status: el.dataset.status === "active" ? "active" : "revoked" } }; } },
    // the public line the member gave, split: its base64 field and any words after it (R55); a line not of that shape sends nothing
    { op: "signeradd", rereads: ["signers"],
      ready(view, el, cs) {
        const parts = String(cs.value("ms-line") || "").trim().split(/\s+/);
        if (!String(cs.value("ms-who") || "").trim()) return { refuse: "refusal.NO_SUCH_MEMBER" };
        if (parts.length < 2 || !/^[a-z][a-z0-9@.-]*$/.test(parts[0]) || !/^AAAA[A-Za-z0-9+/=]+$/.test(parts[1])) return { refuse: "refusal.BAD_KEY" };
      },
      send(view, el, cs) {
        const memberId = String(cs.value("ms-who") || "").trim();
        const parts = String(cs.value("ms-line") || "").trim().split(/\s+/);
        if (!memberId) return { refuse: "refusal.NO_SUCH_MEMBER" };
        if (parts.length < 2 || !/^[a-z][a-z0-9@.-]*$/.test(parts[0]) || !/^AAAA[A-Za-z0-9+/=]+$/.test(parts[1])) return { refuse: "refusal.BAD_KEY" };
        const comment = parts.slice(2).join(" ");
        return { body: comment ? { memberId, keyB64: parts[1], comment } : { memberId, keyB64: parts[1] } };
      },
      // the public line is not kept in the field once it is registered
      done(view, answer, cs) { cs.fill("ms-line", ""); } },
    { op: "invitewithdraw", rereads: ["roster"],
      send(view, el) { return { body: { memberId: el.dataset.member } }; } },
    { op: "websitekeycreate", rereads: [],
      ready(view, el, cs) { const dailyCap = Number(cs.value("mw-cap")); if (!(Number.isInteger(dailyCap) && dailyCap >= 1)) return { refuse: "screen.members.website.nocap" }; },
      send(view, el, cs) {
        const dailyCap = Number(cs.value("mw-cap"));
        if (!(Number.isInteger(dailyCap) && dailyCap >= 1)) return { refuse: "screen.members.website.nocap" };
        const days = String(cs.value("mw-days") || "").trim();
        return { body: days ? { dailyCap, expiresInDays: Number(days) } : { dailyCap } };
      },
      done(view, answer, cs) { const a = answer && answer.result !== undefined ? answer.result : answer; if (a && a.key) cs.set("websiteKey", a.key); } },
    { op: "joinlinkenable", rereads: [],
      ready(view, el, cs) { const dailyCap = Number(cs.value("mw-cap")); if (!(Number.isInteger(dailyCap) && dailyCap >= 1)) return { refuse: "screen.members.website.nocap" }; },
      send(view, el, cs) {
        const dailyCap = Number(cs.value("mw-cap"));
        if (!(Number.isInteger(dailyCap) && dailyCap >= 1)) return { refuse: "screen.members.website.nocap" };
        const days = String(cs.value("mw-days") || "").trim();
        return { body: days ? { dailyCap, expiresInDays: Number(days) } : { dailyCap } };
      },
      done(view, answer, cs) { const a = answer && answer.result !== undefined ? answer.result : answer; if (a && a.link) cs.set("joinLink", (view.origin || "") + "/#join=" + encodeURIComponent(a.link)); } },
  ],
};
