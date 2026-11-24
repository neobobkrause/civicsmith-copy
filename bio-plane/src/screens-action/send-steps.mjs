/* Prepare, approve and record the sending (screens-action R3, R4, R8, R10; DEC-115; v0.2 rule 19): the steps `start-send`
   and `request` share, as one part and the act specs both screens register. Each function is self-contained (interface-
   shell R21 (1)); the shell serialises it beside each screen that names it. The group's Civicsmith sends nothing: the
   member sends by the office's own means and records it here.

   The step an action has reached is read from `filingsfor` (filings R13): its newest draft not yet sent. A prepared draft's
   text comes from the act that prepared it and, on a load that finds one prepared and not yet approved, from `filingread`
   (filings R59; screens-action R11): the same text, blanks with their sources, unfilled blanks with why, the member's fills,
   the advisory and the offers. It is kept in the screen's page memory (`view.ui.draft`), never in storage; reading
   prepares nothing.

   The matter's stake (R21; N933; `filings` R60 to R62) is drawn on every preparation, above the approval, on both screens:
   "Sent with" (the team's name and its declared statement) and "In this matter" (the stake `filings` shows, its source, or
   none, or that it cannot be read). `start-send` alone asks the question, when `stakeatpreparation` answers `higher_stakes`:
   a prompt that is never a gate, so approving, preparing and recording the sending are drawn whether or not it is answered. */

/** The newest draft not yet recorded sent, and the newest one sent, from `filingsfor`'s answer. */
export function draftsOf(v) {
  const drafts = v && Array.isArray(v.drafts) ? v.drafts.slice() : [];
  drafts.sort(function (a, b) { return String(a.at || "") < String(b.at || "") ? -1 : String(a.at || "") > String(b.at || "") ? 1 : 0; });
  const unsent = drafts.filter(function (d) { return !d.sending; });
  const sent = drafts.filter(function (d) { return d.sending; });
  return { open: unsent.length ? unsent[unsent.length - 1] : null, sent: sent.length ? sent[sent.length - 1] : null };
}

/** The step an action is at: "prepare", "approve", "second" (waiting on a second approval), "send" or "sent". */
export function stepOf(v) {
  const drafts = v && Array.isArray(v.drafts) ? v.drafts.slice() : [];
  drafts.sort(function (a, b) { return String(a.at || "") < String(b.at || "") ? -1 : String(a.at || "") > String(b.at || "") ? 1 : 0; });
  const unsent = drafts.filter(function (x) { return !x.sending; });
  const d = { open: unsent.length ? unsent[unsent.length - 1] : null, sent: drafts.some(function (x) { return x.sending; }) };
  if (d.open && d.open.approval) return d.open.second_needed && !d.open.second_approval ? "second" : "send";
  if (d.open) return "approve";
  if (d.sent) return "sent";
  return "prepare";
}

/** A prepared draft as the screen draws it, from what `communicationprepare`, `filingprepare` or `filingread` answered. */
export function draftOf(a) {
  return { id: a.id || a.filing, text: a.text, blanks: Array.isArray(a.blanks) ? a.blanks : [], unfilled: Array.isArray(a.unfilled) ? a.unfilled : [],
    template: a.template || null, disclosure: a.disclosure || null, advisory: typeof a.advisory === "string" && a.advisory ? a.advisory : null,
    offers: Array.isArray(a.offers) ? a.offers : [],
    // R49 (filings R25): each exhibit's grade against the venue's standard, as the preparing answer carries it
    exhibits: Array.isArray(a.exhibits) ? a.exhibits : [], venueStandard: a.venue_standard && typeof a.venue_standard === "object" ? a.venue_standard : null,
    tier: a.tier === undefined ? null : a.tier };
}

/** R11: reads the prepared draft the action holds, once per filing, through `filingread`; keeps it in the page's memory
 *  as `ui.draft` (and a new text field id, so the redraw draws its text). Answers the read's state while it is not there. */
export function readFiling(cs, view, filing) {
  const ui = view.ui;
  const L = ui.read || (ui.read = {});
  if (!L[filing]) {
    L[filing] = { state: "loading" };
    const settle = function (o) { L[filing] = o; cs.set("read", L); };
    cs.call("filingread", { query: { filing: filing } }).then(function (a) {
      const r = a && a.result !== undefined ? a.result : a;
      if (!r || r.ok === false) {
        const code = String((r && (r.code || r.reason)) || "");
        settle({ state: code === "NO_SUCH_FILING" ? "absent" : "failed", refusal: { code: code, words: cs.esc((r && r.translation) || code) } });
      } else {
        cs.set("draft", view.parts.draftOf(r));
        cs.set("draftN", (view.ui.draftN || 0) + 1);
        settle({ state: "ok" });
      }
    }, function () { settle({ state: "failed", refusal: null }); });
  }
  return L[filing];
}

/** R27: the kit's read-only sentence for a member who may read and not act, the screen's own name its noun (`shell.readonly`,
 *  `interface-shell` R94); "" for a member who may act. */
export function readOnly(cs, noun) {
  return typeof cs.readonly === "function" ? cs.readonly(String(noun).replace(/^screen\.(.+)\.name$/, "shell.readonly.noun.$1")) : "";
}

/** R28: a kind in its words, `screen.action.kind.<kind>` (or `screen.start-send.kind.<kind>` with `lower`), else the profile's
 *  own label from `action_kind_labels`, else "" (a kind with neither is not drawn, and is never worded "Other"). */
export function kindWord(cs, kind, lower, labels) {
  const key = (lower ? "screen.start-send.kind." : "screen.action.kind.") + kind;
  if (cs.w(key) !== cs.esc(key)) return cs.w(key);
  const own = labels && typeof labels[kind] === "string" ? labels[kind].trim() : "";
  return own ? cs.esc(own) : "";
}

/** R28: the kinds the vocabulary offers (`affordances`' `action_kind`, read at each call) as `cs.choice` options: a kind with
 *  words by its key, a profile's own by its label (record data), a kind with neither not at all. */
export function kindsOf(cs, view, lower) {
  const vocab = view.data.vocab;
  const v = vocab && vocab.state === "ok" && vocab.value && vocab.value.vocabularies ? vocab.value.vocabularies : {};
  const labels = v.action_kind_labels && typeof v.action_kind_labels === "object" ? v.action_kind_labels : {};
  return (Array.isArray(v.action_kind) ? v.action_kind : []).map(function (k) {
    const key = (lower ? "screen.start-send.kind." : "screen.action.kind.") + k;
    const own = typeof labels[k] === "string" ? labels[k].trim() : "";
    return cs.w(key) !== cs.esc(key) ? { value: k, key: key } : own ? { value: k, text: own } : null;
  }).filter(Boolean);
}

/** C64-law (`jurisdictions` R95 to R97): the laws a records request can go under, as the profile's `records_laws` lists them, each with its
 *  own first-request window: the `deadlines` rule its `response` names, never a guess. A law with no window of its own carries none. */
export function recordsLawsOf(profiles) {
  const v = profiles && profiles.view ? profiles.view : {};
  const ds = Array.isArray(v.deadlines) ? v.deadlines : [];
  return (Array.isArray(v.records_laws) ? v.records_laws : []).filter(function (l) { return l && typeof l.citation === "string" && l.citation; }).map(function (l) {
    const d = typeof l.response === "string" ? ds.find(function (x) { return x && x.rule === l.response && x.applies_to === "records_request"; }) : null;
    return { citation: l.citation, level: typeof l.level === "string" ? l.level : "", name: typeof l.name === "string" ? l.name : "",
      rule: d ? d.rule : "", amount: d && d.amount ? d.amount : 0, count: d && d.count ? d.count : "", dcitation: d && d.citation ? d.citation : "" };
  });
}

/** C64-law: the records law the action goes under, as a member stated it (`actions` R25's `governing_laws`) and the profile lists it with
 *  its own window (as `recordsLawsOf` reads each); null when none is stated or the stated one is not one the profile lists (an older
 *  action's). Self-contained: it is serialised beside the screen that names it. */
export function chosenLawOf(action, profiles) {
  const gl = action && action.governing_laws && typeof action.governing_laws === "object" ? action.governing_laws : {};
  const stated = gl.state === "stated" && Array.isArray(gl.laws) ? gl.laws : [];
  const v = profiles && profiles.view ? profiles.view : {};
  const ds = Array.isArray(v.deadlines) ? v.deadlines : [];
  const laws = Array.isArray(v.records_laws) ? v.records_laws : [];
  for (const x of stated) {
    const l = laws.find(function (y) { return y && typeof y.citation === "string" && y.citation === (x && x.citation); });
    if (!l) continue;
    const d = typeof l.response === "string" ? ds.find(function (z) { return z && z.rule === l.response && z.applies_to === "records_request"; }) : null;
    return { citation: l.citation, level: typeof l.level === "string" ? l.level : "", name: typeof l.name === "string" ? l.name : "",
      rule: d ? d.rule : "", amount: d && d.amount ? d.amount : 0, count: d && d.count ? d.count : "", dcitation: d && d.citation ? d.citation : "" };
  }
  return null;
}

/** C64-more: an office by its role and body, each once: an office named by its agency alone (role and body the same words) is
 *  drawn once, never "Office, Office". */
export function officeLine(ad) {
  const parts = [ad && ad.role, ad && (ad.body || ad.organisation)].filter(function (x) { return typeof x === "string" && x.trim(); })
    .map(function (x) { return x.trim(); });
  return parts.filter(function (x, i) { return parts.findIndex(function (y) { return y.toLowerCase() === x.toLowerCase(); }) === i; }).join(", ");
}

/** C64-template: whether `templatesforaction` offers a template for the action's kind (a version, and no court petition); a read that did
 *  not answer offers none (never claimed). */
export function templateOffered(view) {
  const t = view.data.templates;
  const v = t && t.state === "ok" && t.value ? t.value : null;
  return !!v && v.court_petition !== true && Array.isArray(v.versions) && v.versions.length > 0;
}

/** R21: "Sent with" and "In this matter", from `stakeatpreparation` (`filings` R62: `group_stake`, `matter_stake`) and the
 *  team's name from `groupidentity`. A stake that cannot be read says so in its fold, open whenever drawn, never none. */
export function stakeLines(cs, view) {
  const idn = view.data.identity;
  const name = idn && idn.state === "ok" && idn.value && typeof idn.value.display_name === "string" ? idn.value.display_name.trim() : "";
  const unreadable = function () {
    return '<details class="mk-details" open><summary>' + cs.w("stake.unreadable.summary") + '</summary><p class="mk-small" data-state="stake">'
      + cs.w("stake.unreadable") + "</p></details>";
  };
  return cs.state("stake", function (s) {
    const group = s.group_stake;
    const told = typeof group === "string" && group !== "undetermined" && group.trim() ? '<span class="rec">' + cs.esc(group.trim()) + "</span>" : "";
    const sent = group === "undetermined" ? (name ? cs.esc(name) + " · " : "") + unreadable() : [name ? cs.esc(name) : "", told].filter(Boolean).join(" · ");
    const m = s.matter_stake;
    let matter;
    if (m === null || m === undefined) matter = cs.w("stake.none");
    else if (typeof m !== "object" || typeof m.stake !== "string" || !m.stake.trim() || m.stake === "undetermined") matter = unreadable();
    else {
      const by = m.set_by ? cs.memberName(String(m.set_by).replace(/^member:/, "")) : "";
      const from = m.source === "action" || m.source === "project" ? m.source : "";
      matter = '<span class="rec">' + cs.esc(m.stake) + "</span>"
        + (from && by && m.set_at ? ' <span class="muted">· ' + cs.w("stake.source." + from, { who: by, date: { html: cs.date(m.set_at) } }) + "</span>" : "");
    }
    return '<dl class="mk-dl">' + (sent ? "<dt>" + cs.w("stake.sentwith") + "</dt><dd>" + sent + "</dd>" : "")
      + "<dt>" + cs.w("stake.inmatter") + "</dt><dd>" + matter + "</dd></dl>";
  });
}

/** R21: on `start-send` alone, the question asked when the action carries higher stakes (`stakeatpreparation`'s
 *  `higher_stakes`): the team's stake in this action, optional, saved by `actionstake` where the shell draws it. Nothing
 *  waits on it. The extra sentence is drawn when the tier is undetermined. */
export function stakeAsk(cs, view) {
  const r = view.data.stake;
  if (!r || r.state !== "ok" || !r.value || r.value.higher_stakes !== true) return "";
  const save = cs.act("actionstake", { label: "stake.action.save" });
  if (!save) return "";
  const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : {};
  const voc = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
  const words = view.parts.kindWord(cs, a.kind || "other", true, voc.action_kind_labels);
  const m = r.value.matter_stake;
  const own = m && typeof m === "object" && m.source === "action" && typeof m.stake === "string" && m.stake !== "undetermined" ? m.stake : "";
  const undetermined = r.value.governing_tier === "undetermined"
    ? '<details class="mk-details" open><summary>' + cs.w("stake.undetermined.summary") + '</summary><p class="mk-small">' + cs.w("stake.ask.undetermined") + "</p></details>" : "";
  return cs.sec("stake.ask.title", undetermined + '<p class="mk-note">' + cs.w("stake.ask.says", { kind: words.charAt(0).toUpperCase() + words.slice(1) }) + "</p>"
    + cs.field("action-stake", "stake.action.label", { rec: true, max: 1000, help: "stake.action.help", value: own })
    + '<div class="mk-acts">' + save + (view.reachable ? cs.act("writinghelp", { data: { field: "stake", id: "action-stake", forop: "actionstake" } }) : "") + "</div>", { help: "stake.ask.help" });
}

/** E9 (K4557; G52, K4686): a member invited to the action's project and not yet joined is told at the start that only members who have
 *  joined can draft, approve, send or keep what speaks for the team, in the design's fold (DEC-417, B477): the summary
 *  `screen.projectact.invited.head`, holding `refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited` and "Join" in place (`projectjoin`, a registry
 *  act of `start-send`, `request` and `action`). A screen that does not draw the act (the dashboard), or a member who may not do it,
 *  is given a reference to the project's page, where Join is drawn. "" for any other state, including one not read (the plane still
 *  refuses what she may not do). The state is her own `participation` on the `projectlist` row of the action's project (`standing`,
 *  project-roster R34), read with the screen's others. */
export function joinFirst(cs, view, project) {
  const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : null;
  const id = project || (a && typeof a.project === "string" ? a.project : "");
  const r = view.data.standing;
  const rows = r && r.state === "ok" && r.value && Array.isArray(r.value.projects) ? r.value.projects : [];
  const hit = id ? rows.find(function (x) { return x && String(x.id) === String(id); }) : null;
  if (!hit || hit.participation !== "invited") return "";
  const l = view.data.projects;
  const titled = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles.find(function (b) { return b.bundle_id === id; }) : null;
  const join = cs.act("projectjoin", { data: { project: id }, tone: "primary" });
  return '<details class="mk-details" data-gap="join"><summary>' + cs.w("screen.projectact.invited.head") + '</summary><div class="cs-reason" role="region"><p class="mk-note" role="alert">'
    + cs.w("refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited") + "</p>"
    + (join ? '<div class="mk-acts">' + join + "</div>" : '<p class="mk-note">' + cs.ref("project", id, (titled && titled.title) || id, []) + "</p>") + "</div></details>";
}

/** R3 (filings R43, R44; fix round 10, diagnosis 11 §2a): the language, and for a public comment the voice, the draft is prepared in, as
 *  the member states them: the language her account holds (`memberlanguage`) among those the team's profiles answer (`grouplanguages`),
 *  else the team's first; never nothing, as without one `filings` reads no list of phrasings and the assertion gate does not run. */
export function languagesOf(view) {
  const mine = view.data.mylang && view.data.mylang.state === "ok" && view.data.mylang.value && typeof view.data.mylang.value.language === "string" ? view.data.mylang.value.language : "";
  const team = view.data.languages && view.data.languages.state === "ok" && view.data.languages.value && Array.isArray(view.data.languages.value.languages)
    ? view.data.languages.value.languages.filter(function (t) { return typeof t === "string" && t; }) : [];
  const tags = mine && team.indexOf(mine) < 0 ? [mine].concat(team) : team;
  return { tags: tags, first: mine || team[0] || "", mine: mine };
}

/** The controls that state those marks: the language (named in the member's own language, never as a tag) and, on a public comment, the
 *  voice (`voice.group`, `voice.self`, each with what it means). "" where there is nothing to state. */
export function marksFields(cs, view) {
  const L = view.parts.languagesOf(view);
  const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : {};
  const nameOf = function (tag) {
    try { const n = new Intl.DisplayNames([L.mine || "en"], { type: "language" }).of(String(tag)); return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(tag); } catch (e) { return String(tag); }
  };
  const lang = L.tags.length ? cs.choice("send-lang", "screen.account.language.field", L.tags.map(function (t) { return { value: t, text: nameOf(t) }; }), { value: L.first }) : "";
  const voice = a.kind === "public_comment"
    ? cs.checks("send-voice", { text: cs.w("voice.group") + " / " + cs.w("voice.self") }, [["group", "voice.group", true], ["self", "voice.self", false]], { radio: true })
      + '<p class="mk-small">' + cs.w("voice.group.means") + " " + cs.w("voice.self.means") + "</p>" : "";
  return lang + voice;
}

/** What those controls state, as the body of `communicationprepare` carries it: `language` (the one chosen, else the member's), and for a
 *  public comment `voice` (`group` unless she chose `self`). */
export function marksBody(cs, view) {
  const L = view.parts.languagesOf(view);
  const out = {};
  const picked = String(cs.value("send-lang") || "");
  const language = L.tags.indexOf(picked) >= 0 ? picked : L.first;
  if (language) out.language = language;
  const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : {};
  if (a.kind === "public_comment") {
    const v = cs.value("send-voice");
    out.voice = Array.isArray(v) && v.indexOf("self") >= 0 ? "self" : "group";
  }
  return out;
}

/** R18 (fix round 10; diagnosis 11 §7a): a determination named by its act, never by an id: the kind of event (where the read carries it; the
 *  list does not), its day and the office (`noOffice` leaves the office out), as plain text the kit escapes; "" where the record gives none of them. */
export function actName(cs, d, noOffice) {
  const act = d && d.act && typeof d.act === "object" ? d.act : {};
  const ev = d && d.event && typeof d.event === "object" ? d.event : null;
  const w = act.when && typeof act.when === "object" ? act.when.value : act.when;
  const day = typeof w === "string" && /^\d{4}-\d{2}-\d{2}/.test(w) ? String(cs.date(w.slice(0, 10))).replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : "";
  const office = act.actor && typeof act.actor === "object" ? [act.actor.role, act.actor.body].filter(function (x) { return typeof x === "string" && x.trim(); }).map(function (x) { return x.trim(); })
    .filter(function (x, i, a) { return a.findIndex(function (y) { return y.toLowerCase() === x.toLowerCase(); }) === i; }).join(", ") : "";
  return [ev && typeof ev.kind === "string" ? ev.kind : "", day, noOffice ? "" : office].filter(Boolean).join(" \u00b7 ");
}

/** R18: a standard named by its citation, as `standards` lists it (`{id, cite}`); "" where the list does not hold it, never the standard's id. */
export function citeOf(items, id) {
  const hit = (Array.isArray(items) ? items : []).find(function (x) { return x && x.id === id; });
  return hit && typeof hit.cite === "string" ? hit.cite.trim() : "";
}

/** The steps drawn: `o.request` adds the period, form and cost limit fields (R8) and the portal's warning and number. */
export function sendSteps(cs, view, filings, o) {
  const P = view.parts;
  const req = !!(o && o.request);
  const d = P.draftsOf(filings);
  const step = P.stepOf(filings);
  const nosend = '<p class="mk-note">' + cs.w("screen.start-send.nosend") + "</p>";
  // R19: a sentence whose particulars (the law's citation, the portal, its button, the department) the record does not
  // give is not drawn, never drawn with a placeholder in it
  const part = function (key) { const s = cs.w(key); return /\{\w+\}/.test(s) ? "" : s; };
  const ui = view.ui;
  const n = String(ui.draftN || 0);
  // E9 (K4557): an invited member is told at the start, and offered none of the steps that speak for the team
  const joinFirst = P.joinFirst ? P.joinFirst(cs, view) : "";
  // R48: on `start-send` alone, the filing kept as the team's template, once approved (the step is second, send or sent)
  const keep = !req && !joinFirst && view.parts.templateKeep ? view.parts.templateKeep(cs, view, d, step) : "";
  // what the approval released, said once it lands (who: the member who pressed it; the day: the page's clock)
  const wasReleased = ui.releasedDone && Array.isArray(ui.releasedDone.items) && ui.releasedDone.items.length && (step === "second" || step === "send" || step === "sent") && view.me && view.me.handle
    ? ui.releasedDone.items.map(function (r) { return '<p class="mk-note">' + cs.w("screen.start-send.release.done", { who: String(view.me.handle), date: { html: cs.date(new Date(cs.now()).toISOString().slice(0, 10)) }, reason: r.reason }) + "</p>"; }).join("") : "";
  if (step === "sent") {
    const s = d.sent.sending;
    // R56 (walk E H2): the sending moves no state; `filingrecordsent` answers the next state a member may choose (`proposed.next_state`, filings
    // R7), said here in the owner's words as the answer gave them, and the way to the action's move follows
    const nx = ui.proposed && ui.proposed.next_state && typeof ui.proposed.next_state === "object" ? ui.proposed.next_state : null;
    const proposal = nx && typeof nx.to === "string" && nx.to && typeof nx.says === "string" && nx.says ? '<p class="mk-note" data-proposed="next-state">' + cs.esc(nx.says) + "</p>" : "";
    return wasReleased + proposal + '<p class="mk-note" role="status">' + cs.w("screen.start-send.sent", { date: { html: cs.date(s.sent_on || s.at) } })
      + (s.reference ? " · " + cs.w("screen.start-send.reference", { reference: s.reference }) : "") + "</p>"
      // R59 (DEC-439 E H2): the sending moves no state; the action's move is on the action page
      + '<p class="mk-note">' + cs.w("screen.start-send.sent.next") + "</p>"
      + '<a class="cs-ref" href="/app/action/' + encodeURIComponent(view.subject) + '" data-nav>' + cs.w("screen.start-send.openaction") + "</a>" + keep + joinFirst;
  }
  if (joinFirst) return joinFirst + nosend;
  if (step === "second") {
    // R3: while a second approval waits, the screen says so and offers no send.
    return wasReleased + '<p class="mk-note" role="status">' + cs.w("screen.start-send.waitsecond") + "</p>"
      + '<div class="mk-acts">' + cs.act("filingsecondapprove", { data: { filing: d.open.filing } }) + "</div>" + nosend + keep;
  }
  if (step === "send") {
    // R3, R4, R8: the outward warning, then the member's record of the sending: the day, how, and the venue's number.
    // C64-law: the city's own words (`howsend.3`: "the city can't send you updates") are not said of a request under the federal law
    const fed = req && P.chosenLawOf ? (P.chosenLawOf(view.data.action && view.data.action.state === "ok" ? view.data.action.value : null,
      view.data.profiles && view.data.profiles.state === "ok" ? view.data.profiles.value : null) || {}).level === "federal" : false;
    const how = req ? [1, 2, 3, 4].filter(function (n) { return !(fed && n === 3); }).map(function (n) { return part("screen.request.howsend." + n); }).filter(Boolean) : [];
    return wasReleased + (how.length ? cs.sec("screen.request.howsend", '<ol class="mk-list"><li>' + how.join("</li><li>") + "</li></ol>") : "")
      + '<div class="cs-dialog" role="group" aria-label="' + cs.w("screen.start-send.outward") + '">' + '<span class="cs-tag-outward">' + cs.w("screen.start-send.outward") + "</span>"
      + '<p class="ends">' + cs.w(req ? "screen.request.outward" : "screen.start-send.outward.says") + "</p>"
      + cs.field("send-at", "screen.start-send.sentat", { type: "date", help: "screen.start-send.sentat.help" })
      + cs.field("send-account", "screen.start-send.how", { help: "screen.start-send.how.help" })
      + cs.field("send-reference", req ? "screen.request.reference" : "screen.start-send.reference.field", { help: req ? "screen.request.reference.help" : null })
      + '<div class="mk-acts">' + cs.act("filingrecordsent", { tone: "primary", label: "screen.start-send.recordsent", data: { filing: d.open.filing } }) + "</div></div>" + nosend + keep;
  }
  // R11: a draft prepared and not yet approved is read again on load; nothing is prepared again by reading.
  let reading = null;
  if (step === "approve" && !(ui.draft && ui.draft.id === d.open.filing)) {
    const r = P.readFiling(cs, view, d.open.filing);
    if (r.state === "absent") reading = cs.state({ state: "empty" }, null, { empty: "shell.unavailable.nothing" });
    else if (r.state !== "ok") reading = cs.state(r);
  }
  // prepare, or approve what was prepared
  const draft = ui.draft && (step === "prepare" || (d.open && ui.draft.id === d.open.filing)) ? ui.draft : null;
  const label = draft ? (draft.disclosure && draft.disclosure.machine ? "screen.start-send.draft.machine" : draft.template ? "screen.start-send.draft.template" : "screen.start-send.draft.own") : null;
  const blanks = draft && Array.isArray(draft.blanks) && draft.blanks.length
    ? '<ul class="mk-list">' + draft.blanks.map(function (b) {
      const own = b.label && typeof b.label === "object" && b.label.kind === "member_fill";
      return "<li>" + (own ? cs.w("screen.start-send.blank.own", { name: b.name || "", value: b.value || "" })
        : cs.w("screen.start-send.blank", { name: b.name || "", value: b.value || "", source: b.source || "" })) + "</li>";
    }).join("") + "</ul>" : "";
  const unfilled = draft && Array.isArray(draft.unfilled) && draft.unfilled.length
    ? '<p class="mk-note">' + cs.w("screen.start-send.unfilled", { names: draft.unfilled.map(function (u) { return u.name; }).join(", ") }) + "</p>"
      + '<ul class="mk-list">' + draft.unfilled.filter(function (u) { return u.why; }).map(function (u) {
        return "<li>" + cs.w("screen.start-send.unfilled.why", { name: u.name || "", why: u.why }) + "</li>";
      }).join("") + "</ul>" : "";
  const advisory = draft && draft.advisory ? '<p class="mk-note">' + cs.w("screen.start-send.advisory", { advisory: draft.advisory }) + "</p>" : "";
  const offers = draft && Array.isArray(draft.offers) && draft.offers.includes("counsel_packet")
    ? '<p class="mk-note">' + cs.w("screen.start-send.offer.counsel_packet") + "</p>" : "";
  const marks = step === "prepare" && P.marksFields ? P.marksFields(cs, view) : "";
  const fills = req && step === "prepare" ? cs.field("req-from", "screen.request.from", { type: "date" }) + cs.field("req-to", "screen.request.to", { type: "date" })
    + cs.choice("req-form", "screen.request.form", [["electronic", "screen.request.form.electronic"], ["spreadsheet", "screen.request.form.spreadsheet"], ["pdf", "screen.request.form.pdf"], ["paper", "screen.request.form.paper"]])
    + cs.field("req-cost", "screen.request.cost", { help: "screen.request.cost.help" }) : "";
  const text = cs.field("send-text-" + n, req ? "screen.request.text" : "screen.start-send.text", {
    area: true, rec: true, value: draft ? draft.text || "" : "", draft: label,
    // C64-template: "drafted from your team's template" only where the kind offers one; else the plain "from your own words" help
    help: req && P.templateOffered && P.templateOffered(view) ? "screen.request.text.help" : "screen.start-send.text.help" });
  // R49 (filings R25): each exhibit's grade against what the venue accepts; a flagged exhibit stops nothing, the approval stays
  const venueWords = function (e) {
    const state = e && e.venue && typeof e.venue === "object" ? e.venue.state : "";
    return state === "accepted" ? cs.w("screen.start-send.exhibits.accepted")
      : state === "contestable" ? cs.w("screen.start-send.exhibits.contestable1") + " " + cs.w("screen.start-send.exhibits.contestable2")
        : state === "below" ? cs.w("screen.start-send.exhibits.below1") + " " + cs.w("screen.start-send.exhibits.below2")
          : cs.w("screen.start-send.exhibits.undetermined");
  };
  const exhibits = draft && Array.isArray(draft.exhibits) && draft.exhibits.length
    ? cs.sec("screen.start-send.exhibits.heading", '<p class="mk-small">' + cs.w("screen.start-send.exhibits.intro1") + " " + cs.w("screen.start-send.exhibits.intro2") + " "
      + cs.w("screen.start-send.exhibits.intro3") + "</p>" + cs.sheet(draft.exhibits.map(function (e) {
        const letter = e.grade && typeof e.grade === "object" ? String(e.grade.grade || "") : "";
        const name = cs.esc(e.locator || e.sha256 || "") + (e.captured_at ? " · " + cs.w("screen.start-send.exhibits.captured", { date: { html: cs.date(e.captured_at) } }) : "");
        return cs.row("", '<span class="mk-data">' + name + "</span>", "", (/^[A-D]$/.test(letter) ? cs.grade("capture", letter) : cs.w("screen.start-send.exhibits.nograde")) + " · " + venueWords(e));
      }).join(""))
      + (draft.venueStandard && draft.venueStandard.state === "undetermined"
        ? '<details class="mk-details"><summary>' + cs.w("screen.start-send.exhibits.refused.summary") + "</summary><p class=\"mk-small\">" + cs.w("screen.start-send.exhibits.refused.body1") + " "
          + cs.w("screen.start-send.exhibits.refused.body2") + " " + cs.w("screen.start-send.exhibits.refused.body3") + "</p></details>" : "")) : "";
  // the writing help on the member's own words (a registry act of `start-send`; "" on a screen that does not list it, and while the assistant is unreachable)
  const help = view.reachable && (step === "prepare" || draft)
    ? cs.act("writinghelp", { data: { field: "text", id: "send-text-" + n, forop: "communicationprepare" } }) : "";
  // R42 (C71): the sentences the approval was refused for, one choice each: rewrite (edit the text above), say it only asks, or treat
  // the act as a breach claim; the field ids follow the record's own sentence numbers
  const pointed = step === "approve" && ui.assertions && ui.assertions.filing === d.open.filing && Array.isArray(ui.assertions.items) && ui.assertions.items.length
    ? ui.assertions.items.map(function (x) {
      return '<div class="cs-field"><p class="mk-data">' + cs.esc(x.text) + "</p>"
        + cs.checks("assert-pick-" + x.index, "phrasing.assertion.pointed", [["rewrite", "assertion.resolve.rewrite"], ["breach_claim", "assertion.resolve.breach_claim"]], { radio: true })
        + cs.field("assert-words-" + x.index, "assertion.resolve.only_asks", { max: 500 }) + "</div>";
    }).join("") : "";
  // R42 (B16 a): a sentence the record contradicts is held until it is rewritten or released with a reason; the release is not an act
  // of its own (the `release` op is ratification's vouching) but an entry the approval carries (`filingapprove`'s `release`, filings
  // R34): each sentence is drawn with its reason and a tick, and the next press of "Approve this text" sends the ticked ones.
  const held = step === "approve" && ui.contradicted && ui.contradicted.filing === d.open.filing && Array.isArray(ui.contradicted.items) && ui.contradicted.items.length
    ? ui.contradicted.items.map(function (x) {
      return cs.sec("screen.start-send.release.head", '<p class="mk-small"><span class="rec">“' + cs.esc(x.text) + "”</span></p>" + '<p class="mk-note">' + cs.w("pointer.record.contradicted") + "</p>"
        + cs.field("release-why-" + x.index, "screen.start-send.release.why", { max: 500, rec: true, help: "screen.start-send.release.why.help" })
        + cs.checks("release-pick-" + x.index, "act.release.label.start-send", [["release", "act.release.label.start-send"]]));
    }).join("") : "";
  const acts = step === "prepare"
    ? cs.act("communicationprepare", {}) + cs.act("filingprepare", {}) + help
    : cs.act("filingapprove", { tone: "primary", data: { filing: d.open.filing } }) + help;
  if (reading) return reading + nosend;
  // R21: the stake, above the approval; the question on `start-send` alone
  const stake = (!req && P.stakeAsk ? P.stakeAsk(cs, view) : "") + P.stakeLines(cs, view);
  return marks + fills + (step === "prepare" || draft ? text : "") + blanks + unfilled + advisory + offers + exhibits + pointed + held
    + (req && part("screen.request.describe") ? '<p class="mk-note">' + part("screen.request.describe") + "</p>" : "") + stake
    + '<div class="mk-acts">' + acts + "</div>" + '<p class="mk-note">' + cs.w("screen.start-send.approvefixes") + "</p>" + nosend;
}

/* The acts, shared by both screens (each registers the ones its registry lists). The action is the screen's subject. */
const keepDraft = function (view, answer, cs) {
  if (answer && answer.id) {
    // the draft first, then a new field id, so the redraw draws the draft's text and not what was typed before
    cs.set("draft", view.parts.draftOf(answer));
    cs.set("draftN", (view.ui.draftN || 0) + 1);
  }
};

export const PREPARE = Object.freeze({
  // R3, R4, R8: what is sent, in the member's own words, with the period, form and cost limit as `fills` on a request.
  op: "communicationprepare",
  send: function (view, el, cs) {
    const text = String(cs.value("send-text-" + (view.ui.draftN || 0)) || "").trim();
    if (!text) return { refuse: "screen.start-send.text.needed" };
    const body = Object.assign({ action: view.subject, purpose: view.ui.purpose || "request", text: text }, view.parts.marksBody ? view.parts.marksBody(cs, view) : {});
    if (view.parts.isRequest && view.parts.isRequest()) {
      const from = String(cs.value("req-from") || ""), to = String(cs.value("req-to") || ""), cost = String(cs.value("req-cost") || "").trim();
      // C64-template: the plane refuses a fill the text has no blank for (`FILL_UNKNOWN_BLANK`), so a box is sent only where her text names
      // its blank (`{{period}}`, `{{form}}`, `{{cost_limit}}`); a plain request names none and sends no fills
      const named = {};
      String(text).replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, function (m, n) { named[n] = true; return m; });
      const fills = {};
      if ((from || to) && named.period) fills.period = from + " – " + to;
      const form = cs.value("req-form");
      if (form && named.form) fills.form = String(form);
      if (cost && named.cost_limit) fills.cost_limit = cost;
      if (Object.keys(fills).length) body.fills = fills;
    }
    return { body: body };
  },
  done: keepDraft,
});

export const PREPARE_FILING = Object.freeze({
  // R3: the filing from the group's template for this kind, or the member's text where she wrote one.
  op: "filingprepare",
  // R41 (C70): the tier refusal draws its words and, beside them, the door to the action's risk (`risk.title`, where a member
  // states the tier); the action is the one the refusal names. No refusal, no door.
  refusals: {
    FILING_TIER_UNDETERMINED: function (refusal, cs) {
      const id = typeof refusal.action === "string" ? refusal.action : "";
      // R56 (walk E K10): the door is its own control after the sentence, never run on from it ("A member states the tier first. Its risk")
      return cs.w("refusal.FILING_TIER_UNDETERMINED")
        + (id ? '<div class="mk-acts"><a class="cs-ref" href="/app/action/' + encodeURIComponent(id) + '" data-nav>' + cs.w("screen.start-send.risk.door") + "</a></div>" : "");
    },
  },
  send: function (view, el, cs) {
    const text = String(cs.value("send-text-" + (view.ui.draftN || 0)) || "").trim();
    return { body: text ? { action: view.subject, text: text } : { action: view.subject } };
  },
  done: keepDraft,
});

export const APPROVE = Object.freeze({
  // R3: terminal: approving fixes the text (the shell's dialog says so, `act.filingapprove.does`).
  // R42 (C71; BOB's B11): refused with the sentences pointed out as saying the body broke a rule (`ASSERTION_UNRESOLVED`), the
  // refusal draws one choice per sentence beside the act: rewrite it (edit the text above), say in her own words that it only
  // asks (`words`), or treat the act as a breach claim. The resend carries `resolutions: [{sentence, resolution, words?}]`, the
  // sentence's exact text; what she answered on an earlier refusal is carried again, as the record lists only what is still open.
  op: "filingapprove",
  refusals: {
    // the choices are drawn by the steps, above the approval, as the page's own fields: the refusal's place beside the act is
    // replaced by the confirmation each press of a terminal act asks first
    ASSERTION_UNRESOLVED: function (refusal, cs) {
      const list = Array.isArray(refusal.sentences) ? refusal.sentences.filter(function (x) { return x && typeof x.text === "string"; }) : [];
      cs.set("assertions", { filing: typeof refusal.filing === "string" ? refusal.filing : "", items: list.map(function (x, i) { return { index: typeof x.index === "number" ? x.index : i, text: x.text }; }) });
      return cs.w("refusal.ASSERTION_UNRESOLVED");
    },
    // B16 (a): the sentences the record contradicts, held until released with a reason (drawn by the steps, above the approval)
    CONTRADICTED_HELD: function (refusal, cs) {
      const list = Array.isArray(refusal.sentences) ? refusal.sentences.filter(function (x) { return x && typeof x.text === "string"; }) : [];
      cs.set("contradicted", { filing: typeof refusal.filing === "string" ? refusal.filing : "", items: list.map(function (x, i) { return { index: typeof x.index === "number" ? x.index : i, text: x.text }; }) });
      return cs.w("refusal.CONTRADICTED_HELD");
    },
  },
  send: function (view, el, cs) {
    const body = { filing: el.dataset.filing };
    const own = view.ui.draft && view.ui.draft.id === el.dataset.filing;
    let edited = "";
    if (own) {
      const t = cs.value("send-text-" + (view.ui.draftN || 0));
      if (typeof t === "string" && t.trim() && t !== view.ui.draft.text) { body.text = t; edited = t; }
    }
    const kept = view.ui.resolved || (view.ui.resolved = {});
    const open = view.ui.assertions && view.ui.assertions.filing === el.dataset.filing && Array.isArray(view.ui.assertions.items) ? view.ui.assertions.items : [];
    open.forEach(function (x) {
      const pick = cs.value("assert-pick-" + x.index);
      const words = String(cs.value("assert-words-" + x.index) || "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (Array.isArray(pick) && pick.includes("breach_claim")) kept[x.text] = { sentence: x.text, resolution: "breach_claim" };
      else if (words) kept[x.text] = { sentence: x.text, resolution: "only_asks", words: words };
    });
    // a resolution binds the exact text: one whose sentence is no longer in the text is not sent
    const now = own ? (edited || view.ui.draft.text || "") : "";
    const resolutions = Object.keys(kept).filter(function (k) { return !now || now.indexOf(k) >= 0; }).map(function (k) { return kept[k]; });
    if (resolutions.length) body.resolutions = resolutions;
    // B16 (a): a sentence ticked for release goes with the approval as `release: [{ord, reason}]` (the sentence's index and a
    // non-blank reason of at most 500 characters); a tick with no reason is refused in place
    const held = view.ui.contradicted && view.ui.contradicted.filing === el.dataset.filing && Array.isArray(view.ui.contradicted.items) ? view.ui.contradicted.items : [];
    const release = [];
    for (const x of held) {
      const pick = cs.value("release-pick-" + x.index);
      if (!(Array.isArray(pick) && pick.includes("release"))) continue;
      const why = String(cs.value("release-why-" + x.index) || "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (!why) return { refuse: "shell.reason.needed" };
      release.push({ ord: x.index, reason: why });
    }
    if (release.length) body.release = release;
    return { body: body };
  },
  done: function (view, answer, cs) {
    view.ui.assertions = null; view.ui.resolved = null; view.ui.contradicted = null;
    const out = answer && Array.isArray(answer.released) ? answer.released.filter(function (r) { return r && typeof r.reason === "string" && r.reason; }) : [];
    cs.set("releasedDone", { items: out });
  },
});

export const STAKE = Object.freeze({
  // R21: "Save this action's stake" (`action-records` R17): what this one action adds to the team's and the project's;
  // empty clears the action's own, and saves nothing where it has none. A prompt, never a gate: no other act waits on it.
  op: "actionstake", label: "stake.action.save",
  refusals: { STAKE_MALFORMED: "refusal.STAKE_MALFORMED.action" },
  send: function (view, el, cs) {
    const told = String(cs.value("action-stake") || "").trim();
    const s = view.data.stake && view.data.stake.state === "ok" ? view.data.stake.value : null;
    const m = s && s.matter_stake;
    const held = !!m && typeof m === "object" && m.source === "action" && typeof m.stake === "string";
    if (!told && !held) return null;
    return { body: { target: view.subject, stake: told || null } };
  },
  rereads: ["stake"],
});

export const JOIN = Object.freeze({
  // G52 (K4686; R3): "Join", the project the member is invited to, in place on `start-send`, `request` and `action` (the design's fold,
  // DEC-417); the screen reads her place again, now joined, and offers the weighty act.
  op: "projectjoin", rereads: ["standing", "projects"],
  send: function (view, el) { return el.dataset.project ? { query: { projectId: el.dataset.project } } : null; },
});

export const SECOND = Object.freeze({
  // R3: by a member other than the first approver (filings refuses `SAME_APPROVER` otherwise).
  op: "filingsecondapprove",
  send: function (view, el) { return { body: { filing: el.dataset.filing } }; },
});

export const TEMPLATE_SAVE = Object.freeze({
  // R48 (C75; DEC-377): keeps the approved filing as the team's template, as a filing or as a brief for counsel (`filings` R32).
  op: "templatesave", rereads: [],
  send: function (view, el, cs) {
    const name = String(cs.value("template-name") || "").trim();
    if (!name || name.length > 200 || /[\r\n]/.test(name)) return { refuse: "refusal.TEMPLATE_NAME_REFUSED" };
    const body = { filing: el.dataset.filing, name: name, use: cs.value("template-use") === "brief" ? "brief" : "file" };
    // C65: the template is kept in the project the action belongs to, a scope its drafting rule accepts for a joined member; the filing's
    // own basis names a project only when it rests on a determination, so a request or a start from a plan would otherwise ask for none
    const a = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value : null;
    if (a && typeof a.project === "string" && a.project) body.project = a.project;
    const notes = String(cs.value("template-notes") || "").trim();
    if (notes) body.notes = notes;
    return { body: body };
  },
});

export const RECORD_SENT = Object.freeze({
  // R3, R4, R8: the member sent it by the office's own means; this records the day, how, and the venue's reference.
  op: "filingrecordsent", outward: true,
  send: function (view, el, cs) {
    const at = String(cs.value("send-at") || "").trim();
    const account = String(cs.value("send-account") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { refuse: "screen.start-send.sentat.needed" };
    if (!account) return { refuse: "screen.start-send.how.needed" };
    const body = { filing: el.dataset.filing, at: at, account: account };
    const ref = String(cs.value("send-reference") || "").trim();
    if (ref) body.reference = ref;
    return { body: body };
  },
  // R56 (walk E H2): what the sending proposes is kept in the page's memory for the step that follows
  done: function (view, answer, cs) {
    const r = answer && answer.result !== undefined ? answer.result : answer;
    if (r && r.proposed && typeof r.proposed === "object") cs.set("proposed", r.proposed);
  },
  refusals: { SENT_REFERENCE_MALFORMED: "screen.request.reference.malformed", SECOND_APPROVAL_NEEDED: "screen.start-send.waitsecond" },
});

/** The assistant's help with one own-words field (`wizard-scripts` R27, DEC-153): drawn only while it is reachable, by the
 *  screen that owns the field (`data-id` the field, `data-field` its name, `data-forop` the act the words are for). Nothing is
 *  kept until the member saves; the draft is labelled machine work and replaces nothing she did not ask to have worded. */
export const WRITE_HELP = Object.freeze({
  op: "writinghelp", rereads: [], reasonField: "told",
  send: function (view, el, cs) {
    view.ui.helpId = el.dataset.id;
    // the owner's declaration (`writinghelp`, wizard-scripts R46) requires `op`, the act the words are for (`data-forop`); a field that
    // names none has nothing to be helped for and sends nothing
    const forop = el.dataset.forop;
    if (!forop) return null;
    return { body: { op: forop, field: el.dataset.field, told: String(cs.value(el.dataset.id) || "").trim() } };
  },
  done: function (view, answer, cs) {
    const a = answer && answer.result !== undefined ? answer.result : answer;
    if (a && typeof a.text === "string" && view.ui.helpId) cs.fill(view.ui.helpId, a.text, { label: "screen.start-send.draft.machine" });
  },
});

/** A read a screen makes itself, once per query and token, kept in the page's memory (`view.ui.later`); answers
 *  `{state: "loading" | "ok" | "failed", value?, refusal?}`. */
export function later(cs, view, key, op, query, token) {
  const L = view.ui.later || (view.ui.later = {});
  const q = JSON.stringify(query) + "#" + (token || "");
  if (!L[key] || L[key].q !== q) {
    L[key] = { q: q, state: "loading" };
    const settle = function (o) { L[key] = Object.assign({ q: q }, o); cs.set("later", L); };
    cs.call(op, { query: query }).then(function (a) {
      const r = a && a.result !== undefined ? a.result : a;
      if (!r || r.ok === false) {
        const code = String((r && (r.code || r.reason)) || "");
        settle({ state: "failed", refusal: { code: code, words: cs.esc((r && r.translation) || code) } });
      } else settle({ state: "ok", value: r });
    }, function () { settle({ state: "failed", refusal: null }); });
  }
  return L[key];
}
