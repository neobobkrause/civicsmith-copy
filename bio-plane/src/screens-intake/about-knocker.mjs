/* The `about-knocker` screen (Queue › Inbox › A source; R43; DEC-375 C17), at `/app/about-knocker/<the capture's SHA-256>`: what
 * became known about someone who handed material in and how, who may read it, what they agreed to publish and the consent's
 * withdrawal, and the person they are (`sourcedisclose`, `sourceconsent`, `sourceconsentwithdraw`, `sourcepersonlink`,
 * `writinghelp`). The source is read as the inbox reads it: `sourceof` by the pulled knock's capture digest. Self-contained
 * functions over the kit `cs` (interface-shell R21 (1)). */

/* R43: the source's history (`sourceof`), the team's members (who may be listed to read an entry) and the people the record follows
   (who a source may be said to be). */
function aboutReads(view) {
  const sha = typeof view.subject === "string" && /^[0-9a-f]{64}$/.test(view.subject.toLowerCase()) ? view.subject.toLowerCase() : "";
  if (!sha) return {};
  return { src: { op: "sourceof", query: { capture: sha }, subject: true },
           members: { op: "memberlist" },
           people: { op: "peopledirectory", query: { show: "people" } } };
}

function renderAbout(cs, view) {
  const sha = typeof view.subject === "string" && /^[0-9a-f]{64}$/.test(view.subject.toLowerCase()) ? view.subject.toLowerCase() : "";
  /* opened bare or at no digest: the shell's own "Nothing is here" with the way back */
  if (!sha) return `<h1 class="t-title">${cs.w("shell.unavailable.nothing.title")}</h1><p class="cs-state" data-state="empty" data-unavailable="nothing">${cs.w("shell.unavailable.nothing.says")}</p>`
    + `<p><a class="cs-btn" data-tone="quiet" href="/app" data-nav>${cs.w("shell.unavailable.home")}</a></p>`;
  const U = view.ui || {}, D = view.data || {};
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  /* a read that follows from another's answer (`sourcerung`, `sourcepublishable`), made once per query and kept in page memory */
  const later = (key, op, query) => {
    const M = U.later || (U.later = {});
    const q = JSON.stringify(query);
    if (!M[key] || M[key].q !== q) {
      M[key] = { q, state: "loading" };
      const settle = (o) => { M[key] = Object.assign({ q }, o); cs.set("later", M); };
      cs.call(op, { query }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        if (!a || a.ok === false || (r && r.ok === false)) settle({ state: "failed" });
        else settle({ state: "ok", value: r });
      }, () => settle({ state: "failed" }));
    }
    return M[key];
  };
  const body = cs.state(D.src, (v) => {
    const source = typeof v.sourceId === "string" ? v.sourceId : "";
    const history = Array.isArray(v.history) ? v.history : [];
    const current = history.filter((e) => e && !e.superseded_by);
    const roster = D.members && D.members.state === "ok" && D.members.value && Array.isArray(D.members.value.members) ? D.members.value.members : [];
    const people = D.people && D.people.state === "ok" && D.people.value && Array.isArray(D.people.value.rows) ? D.people.value.rows : [];
    /* the ladder at the source's rung (sourcerung): same knocker when the secret proved it, else unknown */
    const NAMED = { unknown: 0, same_knocker: 1, partly_known: 2, known_to_group: 3, publicly_known: 4 };
    const rungs = ["unknown", "same", "partly", "group", "public"];
    let at = 0;
    if (source) { const r = later(`rung:${source}`, "sourcerung", { source_id: source }); if (r.state === "ok" && r.value && Number.isFinite(NAMED[r.value.rung])) at = NAMED[r.value.rung]; }
    const ladder = `<div class="cs-ladder" data-ladder="ident" role="list" aria-label="${cs.w("screen.inbox.ladder")}">`
      + rungs.map((r, i) => `<span role="listitem" class="${i <= at ? "on" : ""}"${i === at ? ' aria-current="step"' : ""}>${cs.w(`screen.inbox.ladder.${r}`)}</span>`).join("")
      + `</div><p class="mk-small muted">${cs.w("screen.inbox.ladder.basis")}</p>`;
    /* the entries that were consented to for the team (sourcepublishable): "agreed to publish to members only" */
    const pub = source ? later(`pub:${source}`, "sourcepublishable", { source_id: source, audience: "group" }) : null;
    const consented = new Set(pub && pub.state === "ok" && pub.value && Array.isArray(pub.value.entries) ? pub.value.entries.filter((e) => e && e.basis === "consent").map((e) => e.entry) : []);
    const attrWord = (a) => (["occupation", "employer", "role"].includes(a) ? cs.w("screen.about-knocker.attribute." + a) : "");
    const howWord = { self: "screen.about-knocker.how.self", filing: "screen.about-knocker.how.opt.filing", third_party: "screen.about-knocker.how.third", hostile: "screen.about-knocker.how.hostile" };
    const toWord = { member: "screen.about-knocker.audience.member", group: "screen.about-knocker.knownto.group", public: "screen.about-knocker.audience.public" };
    const label = (e) => e.kind === "attribute" ? attrWord(e.attribute) : e.kind === "name" ? cs.w("screen.about-knocker.kind.name") : cs.w("screen.about-knocker.kind.link");
    const known = current.map((e) => {
      if (e.how === "hostile")
        return cs.row(cs.icon("flagged"), cs.w("screen.about-knocker.hostile.claim", { name: { html: `<span class="mk-data">${cs.esc(e.claimed_by || "")}</span>` }, date: { html: e.claimed_at ? cs.date(e.claimed_at) : "" } }), "", cs.w(howWord.hostile));
      const value = typeof e.value === "string" ? `: <span class="mk-data">${cs.esc(e.value)}</span>` : "";
      const meta = [cs.w(howWord[e.how] || howWord.self), cs.w(toWord[e.knownTo] || toWord.group), consented.has(e.entry) ? cs.w("screen.about-knocker.consent.members") : ""].filter(Boolean).join(" · ");
      return cs.row(cs.icon("person"), `<b>${label(e)}${value}</b>${e.recorded === false ? ` · ${cs.w(toWord[e.knownTo] || toWord.group)}, ${cs.w("screen.about-knocker.notrecorded")}` : ""}`, "", meta);
    }).join("");
    /* the form to record one more entry */
    const members = roster.filter((m) => m && m.member_id).map((m) => ({ value: m.member_id, text: String(m.handle || m.member_id) }));
    const hostile = current.filter((e) => e.how === "hostile").map((e) => ({ value: e.entry, text: String(e.claim || e.entry) }));
    const help = view.reachable ? `<div class="mk-acts">${cs.act("writinghelp", { label: "act.writinghelp.label.about-knocker" })}</div>` : "";
    const record = cs.sec("act.sourcedisclose.label.about-knocker", `<div style="display:grid;gap:14px">`
      + cs.choice("ab-kind", "screen.about-knocker.known.head", [["attribute", "screen.about-knocker.kind.attribute"], ["name", "screen.about-knocker.kind.name"]], { value: U.kind || "attribute" })
      + cs.choice("ab-attr", "screen.about-knocker.attribute.label", [["occupation", "screen.about-knocker.attribute.occupation"], ["employer", "screen.about-knocker.attribute.employer"], ["role", "screen.about-knocker.attribute.role"]], { value: U.attr || "occupation" })
      + cs.field("ab-value", "screen.about-knocker.value.label", { rec: true, max: 400, help: "screen.about-knocker.value.help", value: U.value || "" })
      + cs.choice("ab-how", "screen.about-knocker.how.label", [["self", "screen.about-knocker.how.opt.self"], ["filing", "screen.about-knocker.how.opt.filing"], ["third_party", "screen.about-knocker.how.opt.third"], ["hostile", "screen.about-knocker.how.opt.hostile"]], { value: U.how || "self" })
      + cs.field("ab-by", "screen.about-knocker.claimedby.label", { help: ["screen.about-knocker.claimedby.help1", "screen.about-knocker.claimedby.help2"], value: U.by || "" })
      + cs.field("ab-at", "screen.about-knocker.claimedat.label", { help: ["screen.about-knocker.claimedat.help1", "screen.about-knocker.claimedat.help2"], value: U.at || "" })
      + cs.choice("ab-known", "screen.about-knocker.knownto.label", [["member", "screen.about-knocker.audience.member"], ["group", "screen.about-knocker.audience.group"], ["public", "screen.about-knocker.audience.public"]], { value: U.known || "group" })
      + cs.checks("ab-store", "screen.about-knocker.store.legend", [["yes", "screen.about-knocker.store.yes", true], ["no", "screen.about-knocker.store.no", false]], { radio: true })
      + (members.length ? cs.checks("ab-sight", "screen.about-knocker.sight.legend", members) : "")
      + cs.field("ab-evidence", "screen.about-knocker.evidence.label", { area: true, rec: true, help: "screen.about-knocker.evidence.help", value: U.evidence || "" })
      + help
      + (hostile.length ? cs.choice("ab-confirms", "screen.about-knocker.confirms.label", [{ value: "", key: "screen.about-knocker.confirms.none" }, ...hostile]) + `<p class="mk-small muted">${cs.w("screen.about-knocker.confirms.help")}</p>` : "")
      + `<div class="mk-acts">${cs.act("sourcedisclose", { tone: "primary" })}</div>`
      + `<p class="mk-note">${cs.w("screen.about-knocker.read.logged1")} ${cs.w("screen.about-knocker.read.logged2")}</p>`
      + "</div>");
    /* what may be published: consent to one detail for one audience, and its withdrawal */
    const details = current.filter((e) => e.how !== "hostile" && e.kind !== "pseudonym_link")
      .map((e) => ({ value: e.entry, text: plain(`${label(e)}${typeof e.value === "string" ? ": " + e.value : ""}`) }));
    const publish = !details.length ? "" : cs.sec("screen.about-knocker.publish.heading", `<div style="display:grid;gap:14px">`
      + `<p class="mk-small muted">${cs.w("screen.about-knocker.publish.intro1")} ${cs.w("screen.about-knocker.publish.intro2")}</p>`
      + cs.choice("ab-cdetail", "screen.about-knocker.consent.detail", details)
      + cs.choice("ab-caud", "screen.about-knocker.audience.label", [["member", "screen.about-knocker.audience.member"], ["group", "screen.about-knocker.audience.group"], ["public", "screen.about-knocker.audience.public"]], { value: "group" })
      + cs.field("ab-cev", "screen.about-knocker.consent.evidence", { area: true, rec: true, value: U.cevidence || "" })
      + `<div class="mk-acts">${cs.act("sourceconsent", { tone: "primary" })}${cs.act("sourceconsentwithdraw")}</div>`
      + "</div>");
    /* say who this is: a claim, with its evidence, that the source is a person the team follows */
    const persons = people.filter((p) => p && p.entity).map((p) => ({ value: p.entity, text: plain(String(p.name || p.entity) + (p.today ? ", " + p.today : "")) }));
    const person = !persons.length ? "" : cs.sec("screen.about-knocker.person.heading", `<div style="display:grid;gap:14px">`
      + `<p class="mk-small muted">${cs.w("screen.about-knocker.person.intro1")} ${cs.w("screen.about-knocker.person.intro2")}</p>`
      + cs.choice("ab-person", "screen.about-knocker.person.which", persons)
      + cs.field("ab-pev", "screen.about-knocker.evidence.label", { area: true, rec: true, value: U.pevidence || "" })
      + (members.length ? cs.checks("ab-psight", "screen.about-knocker.sight.legend", members) : "")
      + `<div class="mk-acts">${cs.act("sourcepersonlink", { tone: "primary" })}</div>`
      + `<p class="mk-note">${cs.w("screen.about-knocker.person.replace")}</p>`
      + "</div>");
    return ladder + (current.length ? cs.sec("screen.about-knocker.known.head", cs.sheet(known), { help: ["screen.about-knocker.known.help1", "screen.about-knocker.known.help2"] }) : "")
      + record + publish + person;
  });
  return `<div class="mk-h">${cs.title()}<p class="mk-sub">${cs.w("screen.about-knocker.intro1")} ${cs.w("screen.about-knocker.intro2")}</p></div>` + body;
}

/* R43: the source an act is about is the one `sourceof` answered (page memory); never typed */
function sourceIdOf(view) { const d = view.data && view.data.src; return d && d.state === "ok" && d.value && typeof d.value.sourceId === "string" ? d.value.sourceId : ""; }

/* R43: "Record what became known" (`sourcedisclose`): what was revealed (an attribute or a name), how it became known, to whom it is
 * known, whether its value is stored (and, if so, the members who may read it) or only that the team knows it, the hostile claim's
 * maker and date, a hostile claim this one confirms, and the evidence (the shell's reason field, `reasonField`). */
function sendDisclose(view, el, cs) {
  const source = view.parts.sourceIdOf(view);
  const need = (id, key) => !String(cs.value(id) || "").trim() && { refuse: "capture.fieldneeded", fills: { field: { html: cs.w(key) } } };
  const kind = cs.value("ab-kind") === "name" ? "name" : "attribute";
  const how = ["self", "filing", "third_party", "hostile"].find((h) => h === cs.value("ab-how")) || "self";
  const known = ["member", "group", "public"].find((h) => h === cs.value("ab-known")) || "group";
  const store = cs.value("ab-store-0") === true;
  const sight = cs.value("ab-sight");
  const miss = (store && need("ab-value", "screen.about-knocker.value.label")) || (how === "hostile" && need("ab-by", "screen.about-knocker.claimedby.label")) || need("ab-evidence", "screen.about-knocker.evidence.label");
  if (miss) return miss;
  const revealed = kind === "attribute" ? { kind, attribute: ["occupation", "employer", "role"].find((a) => a === cs.value("ab-attr")) || "occupation" } : { kind };
  if (store) revealed.value = String(cs.value("ab-value")).trim();
  const body = { source, revealed, how, knownTo: known, recorded: store, evidence: String(cs.value("ab-evidence")).trim() };
  if (store) body.sight = Array.isArray(sight) ? sight : [];
  if (how === "hostile") { body.claimedBy = String(cs.value("ab-by")).trim(); const at = String(cs.value("ab-at") || "").trim(); if (at) body.claimedAt = at; }
  const confirms = String(cs.value("ab-confirms") || "");
  if (confirms && how !== "hostile") body.confirms = confirms;
  return { body };
}
function doneDisclose(view, answer, cs) { cs.set("later", {}); }

/* R43: "Record their agreement" (`sourceconsent`): one detail for one audience, with the evidence of the agreement; and "Record that they
 * took it back" (`sourceconsentwithdraw`): the same two, binding only later publications. */
function consentBody(view, cs) {
  const entry = String(cs.value("ab-cdetail") || ""), audience = ["member", "group", "public"].find((h) => h === cs.value("ab-caud")) || "group";
  return { source: view.parts.sourceIdOf(view), entry, audience };
}
function sendConsent(view, el, cs) {
  if (!String(cs.value("ab-cev") || "").trim()) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.about-knocker.consent.evidence") } } };
  return { body: { ...view.parts.consentBody(view, cs), evidence: String(cs.value("ab-cev")).trim() } };
}
function doneConsent(view, answer, cs) { cs.set("later", {}); }
function sendWithdraw(view, el, cs) { return { body: view.parts.consentBody(view, cs) }; }
function doneWithdraw(view, answer, cs) { cs.set("later", {}); }

/* R43: "Say this source is that person" (`sourcepersonlink`): a claim with its evidence, the members who may read it listed. Refused
 * `NOT_A_PERSON` for an organization, in the design's words. */
function sendPersonLink(view, el, cs) {
  const person = String(cs.value("ab-person") || "");
  if (!String(cs.value("ab-pev") || "").trim()) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.about-knocker.evidence.label") } } };
  const sight = cs.value("ab-psight");
  return { body: { source: view.parts.sourceIdOf(view), person, evidence: String(cs.value("ab-pev")).trim(), sight: Array.isArray(sight) ? sight : [] } };
}
function doneLink(view, answer, cs) { cs.set("later", {}); }

/* R3's pattern (DEC-153): help wording the member's own evidence, drawn only while the assistant is reachable; the draft is filled into
 * the evidence field and kept only by the member's own act. */
function sendHelp(view, el, cs) {
  const told = String(cs.value("ab-evidence") || "").trim();
  if (!told) return { refuse: "screen.capture.help.empty" };
  return { body: { op: "sourcedisclose", field: "evidence", told } };
}
function doneHelp(view, answer, cs) { cs.fill("ab-evidence", String((answer || {}).text || "")); }

export const ABOUT_KNOCKER_SCREEN = Object.freeze({
  id: "about-knocker",
  reads: aboutReads,
  render: renderAbout,
  parts: Object.freeze({ sourceIdOf, consentBody }),
  acts: Object.freeze([
    Object.freeze({ op: "sourcedisclose", rereads: Object.freeze(["src"]), label: "act.sourcedisclose.label.about-knocker", send: sendDisclose, done: doneDisclose, reasonField: "evidence" }),
    Object.freeze({ op: "sourceconsent", rereads: Object.freeze(["src"]), label: "act.sourceconsent.label.about-knocker", send: sendConsent, done: doneConsent, reasonField: "evidence" }),
    Object.freeze({ op: "sourceconsentwithdraw", rereads: Object.freeze(["src"]), label: "act.sourceconsentwithdraw.label.about-knocker", send: sendWithdraw, done: doneWithdraw }),
    Object.freeze({ op: "sourcepersonlink", rereads: Object.freeze(["src"]), label: "act.sourcepersonlink.label.about-knocker", send: sendPersonLink, done: doneLink, reasonField: "evidence",
                    refusals: Object.freeze({ NOT_A_PERSON: function (refusal, cs) { return cs.w("screen.about-knocker.person.refused.org") + " " + cs.w("screen.about-knocker.person.refused.org.next"); } }) }),
    Object.freeze({ op: "writinghelp", rereads: Object.freeze([]), label: "act.writinghelp.label.about-knocker", send: sendHelp, done: doneHelp, reasonField: "told" }),
  ]),
});
