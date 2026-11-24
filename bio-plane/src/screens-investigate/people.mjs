/* screens-investigate R12, R13: the People directory (People; registry screen `people`, its 3 acts; DEC-203). The people
 * and organizations the record follows, never the group's own members (a link to Settings › Members); its rows, counts
 * and order are `people`' `peopledirectory` (its R37), searched by name or office and filtered four ways. "Search" is
 * the registry's `search` act: it reads the directory again with what the member typed and chose. */

import { PARTS } from "./parts.mjs";

const S = "screen.people.";

/** R12: the directory, as the member last searched it (`view.ui.filter`); nothing typed reads the whole of it. */
function reads(view) {
  const S = "screen.people.";
  const f = view.ui.filter || {};
  const query = {};
  for (const k of ["q", "show", "office", "namedIn", "since"]) if (f[k]) query[k] = String(f[k]);
  return { directory: { op: "peopledirectory", query, empty: (v) => !v || !Array.isArray(v.rows) || v.rows.length === 0 } };
}

/** R12, R13: the search and its filters, the counts line, those in the member's projects first, then the rest. */
function render(cs, view) {
  const S = "screen.people.";
  const P = view.parts;
  const f = view.ui.filter || {};
  const d = view.data.directory;
  const out = [cs.title()];
  out.push(`<p class="mk-sub">${cs.w(S + "notmembers")} <a href="/app/members" data-nav>${cs.w(S + "members")}</a></p>`);
  /* R40: the kinds beyond people and organizations the directory can show; R42: with one in view, the add form is the drawing's state g */
  const OTHER_SHOW = { offices: "office", ordinances: "ordinance", contracts: "contract", funds: "fund", sources: "source", everything: "everything" };
  const showNow = String((view.ui.filter || {}).show || "both");
  const otherMode = Object.hasOwn(OTHER_SHOW, showNow);
  const kindWordOf = (k) => (cs.w(S + "today.kind." + k) !== cs.esc(S + "today.kind." + k) ? cs.w(S + "today.kind." + k) : cs.w("find.row.kind." + k));
  const near = view.ui.near && typeof view.ui.near === "object" ? view.ui.near : null;
  /* R42: as a name is typed (the field's `typing` hook, half a second after the last key) the registry is asked what is close to it
     (`entitysimilar`, which writes nothing) */
  const typing = (cs2, view2, value) => {
    const typed = String(value || "").trim();
    if (!typed) { view2.ui.nearKey = ""; if (view2.ui.near) cs2.set("near", null); return; }
    const kind = String(cs2.value("people-other-kind") || "");
    const key = typed + "|" + kind;
    if (key === view2.ui.nearKey) return;
    view2.ui.nearKey = key;
    cs2.call("entitysimilar", { query: Object.assign({ name: typed, limit: "10" }, kind ? { kind } : {}) }).then((a) => {
      const r = a && a.result !== undefined ? a.result : a;
      cs2.set("near", { name: typed, rows: r && r.ok !== false && Array.isArray(r.similar) ? r.similar : [] });
    });
  };
  const nearHtml = near && near.name
    ? `<p class="mk-small">${cs.w(S + "addother.preflight", { name: near.name })}</p>`
      + (near.rows.length ? cs.sheet(near.rows.map((x) => cs.row("", `<b>${cs.ref("person", x.entity_id, x.label || x.entity_id, [x.note || ""])}</b> <span class="mk-small">${kindWordOf(x.kind)} · ${cs.w("people.nearmatch." + (["same", "contains", "spelling"].includes(x.closeness) ? x.closeness : "same"))}</span>`, "")).join("")) : "")
    : "";
  const add = otherMode
    ? cs.field("people-other-name", S + "addother.name", { typing }) + nearHtml
      + cs.choice("people-other-kind", S + "addother.kind", [["person", S + "add.kind.person"], ["institution", S + "add.kind.organization"],
        ...["office", "ordinance", "contract", "fund", "program", "place", "parcel", "source"].map((k) => [k, S + "add.kind." + k])], {})
      + `<p class="mk-small">${cs.w(S + "addother.kind.help")}</p>`
      + cs.field("people-other-aliases", S + "addother.aliases", { area: true, help: S + "addother.aliases.help" })
      + cs.field("people-other-note", S + "addother.note", { area: true, rec: true, help: S + "addother.note.help" })
      + cs.act("entitycreate", { label: "screen.people.add.submit" })
    : cs.field("people-add-name", S + "add.name", {})
      + cs.choice("people-add-kind", S + "add.kind", [["person", S + "add.kind.person"], ["institution", S + "add.kind.organization"]], {})
      + cs.field("people-add-note", S + "add.note", { area: true, rec: true, help: S + "add.note.help" })
      + cs.act("entitycreate", { label: "screen.people.add.submit" });
  /* R13: each row: the kind's mark, the name opening `person`, who they are today, the counts, Explore connections */
  const kindMark = (k) => {
    const org = k !== "person";
    return `<span class="cs-kind" data-kind="${org ? "organisation" : "person"}" tabindex="0" data-level="1" data-tip="${cs.esc(cs.w(org ? S + "kind.organization.means" : S + "kind.person.means"))}">${cs.w(org ? S + "kind.organization" : S + "kind.person")}</span>`;
  };
  /* who they are today: the record's own data as plain text (posts, a member's note), else the screen's words */
  const todayText = (r) => {
    const t = r.today || {};
    if (r.kind === "person") {
      const posts = (t.posts || []).map((p) => [p.title || (p.office && p.office.label) || "", p.body && p.body.label ? p.body.label : ""].filter(Boolean).join(", "));
      return posts.length ? posts.join("; ") : null;
    }
    /* never a record's machine note (K3177, R15): setup's seeding declares as a machine; `today.machine` says so, never the note's text */
    const note = typeof t.note === "string" ? t.note.trim() : "";
    return note && t.machine !== true ? note : null;
  };
  /* R37: a body's kind is drawn beside its name, and what setup seeded on a line of its own (exactly when `today.machine` is true, R15) */
  const kinds = ["office", "body", "institution", "movement", "fund", "program"];
  const kindWord = (r) => {
    const t = r.today || {};
    return r.kind !== "person" && kinds.includes(t.kind || r.kind) ? cs.w(S + "today.kind." + (t.kind || r.kind)) : "";
  };
  const todayHtml = (r) => {
    const text = todayText(r);
    const t = r.today || {};
    const seeded = r.kind !== "person" && t.machine === true;
    const kw = kindWord(r);
    const who = text !== null ? cs.esc(text) : seeded || (kw && r.kind !== "person") ? "" : cs.w(S + "today.none");
    return (kw ? ` <span class="mk-small">${kw}</span>` : "") + (who ? (kw ? " · " : " · ") + who : "")
      + (seeded ? `<br><span class="mk-small" data-seeded="1">${cs.w(S + "today.seeded")}</span>` : "");
  };
  /* R22: no count is drawn at zero: only what the row is named in */
  const counts = (r) => {
    const parts = [];
    /* R37: a row no document names says so, and offers no "Explore connections" */
    if (!r.documents) return cs.w(S + "counts.none");
    if (r.documents) parts.push(cs.w(S + (r.documents === 1 ? "count.document" : "count.documents"), { n: String(r.documents) }));
    if (r.questions) parts.push(cs.w(S + (r.questions === 1 ? "count.question" : "count.questions"), { n: String(r.questions) }));
    if (r.projects) parts.push(cs.w(S + (r.projects === 1 ? "count.project" : "count.projects"), { n: String(r.projects) }));
    return (parts.length ? cs.w(S + "counts", { list: parts.join(", ") }) : "") + (r.newest_added ? (parts.length ? " · " : "") + cs.w(S + "newest", { date: cs.date(r.newest_added) }) : "");
  };
  const line = (r) => cs.row(kindMark(r.kind),
    `<b>${cs.ref("person", r.entity, r.name || r.entity, [todayText(r)])}</b>${todayHtml(r)}<span class="meta">${counts(r)}</span>`,
    r.documents ? cs.act("explore", { label: "act.explore.label.people", data: { entity: r.entity } }) : "");
  const typed = !!(f.q || f.office || (f.namedIn && f.namedIn !== "any") || f.since || (f.show && f.show !== "both"));
  /* R25: nothing followed and nothing searched: the designed empty state alone, no search, filters or counts */
  if (d && d.state === "empty" && !typed) {
    out.push(cs.row("", `<b>${cs.w(S + "none")}</b> ${cs.w(S + "none.how")}`, "") + `<p><a href="/app/capture" data-nav>${cs.w(S + "none.capture")}</a></p>`);
    out.push(cs.sec(S + "add.head", add));
    return out.join("");
  }
  /* the four filters (R12): show; holding an office in (a body the rows name); named in; named recently */
  const bodies = [];
  if (d && d.state === "ok") for (const r of d.value.rows || []) for (const p of (r.today && r.today.posts) || [])
    if (p.body && p.body.entity && !bodies.some((b) => b.value === p.body.entity)) bodies.push({ value: p.body.entity, text: p.body.label || p.body.entity });
  if (f.office && !bodies.some((b) => b.value === f.office)) bodies.push({ value: f.office, text: f.officeText || f.office });
  out.push(`<div class="mk-search">${cs.field("people-q", S + "q", { value: f.q || "" })}${cs.act("search", { label: "act.search.label.people", tone: "primary" })}</div>`
    + `<div class="mk-acts">`
    + cs.choice("people-show", S + "show", [["both", S + "show.both"], ["people", S + "show.people"], ["organisations", S + "show.organizations"],
      ...["offices", "ordinances", "contracts", "funds", "sources"].map((k) => [k, S + "show." + k]), ["everything", S + "show.everything"]], { value: f.show || "both" })
    + cs.choice("people-office", S + "office", [{ value: "", text: cs.w(S + "office.any") }].concat(bodies), { value: f.office || "" })
    + cs.choice("people-named", S + "named", [["any", S + "named.any"], ["mine", S + "named.mine"]], { value: f.namedIn || "any" })
    + cs.choice("people-since", S + "since", [["", S + "since.any"], ["30", S + "since.30"], ["90", S + "since.90"], ["365", S + "since.365"]], { value: f.since || "" })
    + "</div>");
  if (d && d.state === "empty" && otherMode) {
    /* R40: no one of the kind chosen: the note, the filters and the add form stand; no heading, no sentence of ours */
    out.push(`<p class="mk-note">${cs.w(S + "other.note")}</p>`);
    out.push(cs.sec(S + "addother.head", add));
    return out.join("");
  }
  if (d && d.state === "empty") {
    /* R13's second empty state: a search that finds no one */
    out.push(cs.row("", `<b>${cs.w(S + "nomatch", { q: f.q || "" })}</b> ${cs.w(S + "nomatch.how")}`, "")
      + `<p><a href="/app/finder" data-nav>${cs.w(S + "nomatch.find")}</a></p>`);
    out.push(cs.sec(S + "add.head", add));
    return out.join("");
  }
  /* R40: a row of another kind: its mark, the name opening `person`, who or what it is (its note, for an office also who holds it
     today), its kind's word and the documents that name it; no "Explore connections" here (it is on the subject's own page) */
  const lineOther = (r) => {
    const t = r.today || {};
    const note = typeof t.note === "string" && t.note.trim() && t.machine !== true ? cs.esc(t.note.trim()) : "";
    const holders = Array.isArray(r.holders) ? r.holders.slice(0, 5).map((h) => h.label || h.entity).filter(Boolean) : [];
    const heldby = holders.length ? cs.w(S + "today.heldby", { who: holders.join(", ") }) : "";
    const docs = r.documents ? cs.w(S + "counts", { list: cs.w(S + (r.documents === 1 ? "count.document" : "count.documents"), { n: String(r.documents) }) }) : cs.w(S + "counts.none");
    return cs.row(`<span class="cs-kind" data-kind="subject" tabindex="0">${kindWordOf(r.kind)}</span>`,
      `<b>${cs.ref("person", r.entity, r.name || r.entity, [t.note || ""])}</b>${note ? " · " + note : ""}${heldby ? `<br><span class="mk-small">${heldby}</span>` : ""}<span class="meta">${docs}</span>`, "");
  };
  out.push(cs.state("directory", view, (v) => {
    const rows = v.rows || [];
    if (otherMode) {
      return `<p class="mk-note">${cs.w(S + "other.note")}</p>` + (rows.length ? cs.sec(S + "other.heading", cs.sheet(rows.map((r) => (r.kind === "person" || ["institution", "body", "movement"].includes(r.kind) ? line(r) : lineOther(r))).join(""))) : "")
        + (v.truncated ? `<p class="mk-small">${cs.w(S + "more", { n: String(rows.length) })}</p>` : "");
    }
    const mine = rows.filter((r) => r.mine), rest = rows.filter((r) => !r.mine);
    return `<p class="mk-note">${cs.w(S + (v.in_your_projects ? "countline" : "countline.none"), { following: String(v.following || rows.length), mine: String(v.in_your_projects || 0) })}</p>`
      + (mine.length ? cs.sec(S + "yours", cs.sheet(mine.map(line).join(""))) : "")
      + (rest.length ? (mine.length ? cs.sec(S + "others", cs.sheet(rest.map(line).join(""))) : cs.sheet(rest.map(line).join(""))) : "")
      + (v.truncated ? `<p class="mk-small">${cs.w(S + "more", { n: String(rows.length) })}</p>` : "");
  }));
  out.push(cs.sec(S + (otherMode ? "addother.head" : "add.head"), add));
  return out.join("");
}

const acts = [
  /* R12: the search reads the directory again, as the member typed and chose; nothing is written */
  { op: "search", label: "act.search.label.people", rereads: [],
    send(view, el, cs) {
      const office = String(cs.value("people-office") || "");
      const sel = cs.value("people-since");
      const filter = { q: String(cs.value("people-q") || "").trim(), show: String(cs.value("people-show") || "both"),
        office, namedIn: String(cs.value("people-named") || "any"), since: sel ? String(sel) : "" };
      view.ui.filter = filter;
      const query = {};
      for (const k of ["q", "show", "office", "namedIn", "since"]) if (filter[k]) query[k] = filter[k];
      view.ui.searching = true;
      cs.call("peopledirectory", { query }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        const refused = !a || a.ok === false || (r && (r.ok === false || typeof r.refused === "string"));
        view.data.directory = refused
          ? { state: "failed", value: null, refusal: { code: String((r && (r.code || r.reason)) || (a && (a.code || a.reason)) || ""), words: (r && r.translation) || (a && a.translation) || (r && (r.code || r.reason)) ? cs.esc((r && r.translation) || (a && a.translation) || (r && (r.code || r.reason))) : cs.w("shell.noanswer") } }
          : (!r || !Array.isArray(r.rows) || !r.rows.length ? { state: "empty", value: r, refusal: null } : { state: "ok", value: r, refusal: null });
        cs.set("searching", false);
      });
      return null;
    } },
  /* R13: Explore connections from this row (`explore` opens with it as the start) */
  { op: "explore", label: "act.explore.label.people",
    send(view, el, cs) { cs.go("explore", String(el.dataset.entity || "")); return null; } },
  /* R13: Add someone the record follows, with the member's note (its own words serve as the reason, DEC-88) */
  { op: "entitycreate", label: "screen.people.add.submit", reasonField: "note",
    send(view, el, cs) {
      /* R42: the state g form (a kind other than people and organizations in view) sends the kind chosen, the aliases one per line and the
         note; the near-match read was made as the name was typed, and whether to register is hers */
      if (cs.value("people-other-name") !== null) {
        const label = String(cs.value("people-other-name") || "").trim();
        const note = String(cs.value("people-other-note") || "").trim();
        if (!label) return { refuse: "screen.people.add.empty" };
        const aliases = String(cs.value("people-other-aliases") || "").split("\n").map((a) => a.trim()).filter((a, i, all) => a && all.indexOf(a) === i);
        return { body: Object.assign({ kind: String(cs.value("people-other-kind") || "person"), label, note }, aliases.length ? { aliases } : {}) };
      }
      const label = String(cs.value("people-add-name") || "").trim();
      const note = String(cs.value("people-add-note") || "").trim();
      if (!label || !note) return { refuse: "screen.people.add.empty" };
      return { body: { kind: String(cs.value("people-add-kind") || "person"), label, note } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (r && r.entity_id) cs.go("person", r.entity_id);
    } },
];

const PEOPLE_KEYS = [
  "screen.people.notmembers", "screen.people.members", "screen.people.q", "screen.people.show", "screen.people.show.both",
  "screen.people.show.people", "screen.people.show.organizations", "screen.people.office", "screen.people.office.any", "screen.people.named",
  "screen.people.named.any", "screen.people.named.mine", "screen.people.since", "screen.people.since.any", "screen.people.since.30",
  "screen.people.since.90", "screen.people.since.365", "screen.people.countline.none", "screen.people.countline", "screen.people.yours",
  "screen.people.yours.holds", "screen.people.others", "screen.people.others.holds", "screen.people.kind.person", "screen.people.kind.person.means",
  "screen.people.kind.organization", "screen.people.kind.organization.means", "screen.people.today.none", "screen.people.today.seeded",
  "screen.people.today.kind.office", "screen.people.today.kind.body", "screen.people.today.kind.institution", "screen.people.today.kind.movement",
  "screen.people.today.kind.fund", "screen.people.today.kind.program", "screen.people.counts", "screen.people.count.document",
  "screen.people.count.documents", "screen.people.count.question", "screen.people.count.questions", "screen.people.count.project",
  "screen.people.count.projects", "screen.people.newest", "screen.people.more", "screen.people.none", "screen.people.none.how",
  "screen.people.none.capture", "screen.people.nomatch", "screen.people.nomatch.how", "screen.people.nomatch.find", "screen.people.add.head",
  "screen.people.add.name", "screen.people.add.kind", "screen.people.add.kind.person", "screen.people.add.kind.organization",
  "screen.people.add.note", "screen.people.add.note.help", "screen.people.add.empty", "screen.people.counts.none", "screen.people.add.submit",
  /* R40, R42 */
  "screen.people.show.offices", "screen.people.show.ordinances", "screen.people.show.contracts", "screen.people.show.funds", "screen.people.show.sources", "screen.people.add.kind.office", "screen.people.add.kind.ordinance", "screen.people.add.kind.contract", "screen.people.add.kind.fund", "screen.people.add.kind.program", "screen.people.add.kind.place", "screen.people.add.kind.parcel", "screen.people.add.kind.source", "screen.people.show.everything", "screen.people.other.note", "screen.people.other.heading", "screen.people.today.heldby",
  "screen.people.addother.head", "screen.people.addother.name", "screen.people.addother.kind", "screen.people.addother.kind.help",
  "screen.people.addother.aliases", "screen.people.addother.aliases.help", "screen.people.addother.note", "screen.people.addother.note.help",
  "screen.people.addother.preflight", "people.nearmatch.same", "people.nearmatch.contains", "people.nearmatch.spelling",
  ...["source", "office", "ordinance", "parcel", "contract", "fund", "program", "place", "proceeding"].map((k) => "find.row.kind." + k),
];

const words = ["screen.people.name", "screen.people.purpose", "act.search.label.people", "act.search.does",
  "act.explore.label.people", "act.explore.does", "act.entitycreate.does",
  "state.empty", "state.loading", "state.failed", ...PEOPLE_KEYS];

export const PEOPLE_SCREEN = Object.freeze({ id: "people", reads, render, acts, words, parts: PARTS });
