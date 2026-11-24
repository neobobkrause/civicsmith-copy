/* screens-investigate R1: a person the record follows (People › Person; registry screen `person`; N719; DEC-142, DEC-170,
 * DEC-181, DEC-233). Reads `people`' `person` (as of the page's own day: the read takes a date, never "now") and
 * `samepersoncandidates`. Each position and fact is a reference to its source passage; a fact is removed for good only by
 * `personexpunge`, behind its consequence statement (op-grades R21), with the Irreversible weight, and at the phone width it
 * is read and not done (interface-shell R11).
 * R50: an office's kept lines each withdrawn with a reason (`linewithdraw`).
 * R32: what the team says about them (other names, declared ties, the documents that may name them), every fact recorded
 * (those valid today, those whose validity is not settled, the withdrawn in a fold), and a sentence in place of an empty
 * graph. R38, R39: "Same person?" in the design's words, its two acts each explained. */

import { PARTS } from "./parts.mjs";
import { GRAPH_SHARED, FORM_SHARED } from "./graphwords.mjs";
import { WHY_KEYS } from "./whywords.mjs";
import { rereading } from "./rereads.mjs";
import { hasWord } from "../setup-words/index.mjs";

/* R41: the subject read is `entity` (`found: false` the absence); `person` and `samepersoncandidates` are read (by `PARTS.later`,
   once the entity says its kind) only for a person or an organization, and again after each act (`view.ui.pn`). */
function reads(view) {
  const id = String(view.subject || "");
  return {
    people: { op: "peopledirectory", query: { limit: "200" } },
    entity: { op: "entity", query: { id }, subject: true, empty: (v) => !v || v.found === false },
    naming: { op: "readingname", query: { entity: id } },
    docs: { op: "heldcaptures", query: { limit: "200", state: "held_and_vouched", fields: "picker" }, empty: (v) => !v || !Array.isArray(v.held) || !v.held.length },
  };
}

function render(cs, view) {
  const S = "screen.person.";
  const P = view.parts;
  const id = String(view.subject || "");
  const ent = view.data.entity && view.data.entity.state === "ok" && view.data.entity.value ? view.data.entity.value.entity : null;
  /* R41: a subject that is neither a person nor an organization (kinds `person`, `institution`, `body`, `movement`) has its own page */
  const other = !!(ent && !["person", "institution", "body", "movement"].includes(ent.kind));
  const at = P.today(cs), nonce = view.ui.pn || 0;
  /* R53, R58: an organization (kinds `institution`, `body`, `movement`) has the person page's shape and its own words; `people` refuses
     an entity that is no person (`NOT_A_PERSON`), which is drawn as no claims and no candidates, never as a failed read */
  const orgPage = !!(ent && ["institution", "body", "movement"].includes(ent.kind));
  const noPerson = (q) => (orgPage && q && q.state === "failed" && q.refusal && q.refusal.code === "NOT_A_PERSON" ? { state: "ok", value: {}, refusal: null } : q);
  const sfx = orgPage ? ".org" : "";
  const pending = view.data.entity && view.data.entity.state !== "ok" ? view.data.entity : { state: "loading", value: null, refusal: null };
  const d = ent && !other ? noPerson(P.later(cs, view, "person", "person", { query: { id, at }, n: nonce })) : pending;
  const p = d && d.state === "ok" ? d.value : null;
  const name = p && Array.isArray(p.names) && p.names.length ? p.names[0].name : (ent && ent.label) || id;
  const out = [cs.title(name, { thing: { kind: "person", facts: p ? (p.names || []).slice(1).map((n) => n.name) : [] } })];
  const org = !!(ent && ent.kind && ent.kind !== "person");
  const who = P.options(view, "people", (v) => v.rows, (r) => ({ value: r.entity, text: r.name || "" }));
  const nameOf = (x) => (who.find((o) => o.value === x) || {}).text || P.plain(cs, "connection.node.unnamed");
  const docTitle = (sha) => {
    const rows = P.docsAll(cs, view).rows;
    const r = rows.find((x) => x && x.capture && x.capture.sha256 === sha);
    return (r && r.title) || "";
  };
  /* each item cited, dated and graded: its passage a reference to the capture, its grade one mark */
  const cite = (c, label) => (c && (c.captureSha || c.capture_sha)
    ? P.refOf(cs, c.captureSha || c.capture_sha, label || docTitle(c.captureSha || c.capture_sha) || cs.w(S + "source"), [c.extent && c.extent.page !== undefined ? cs.w(S + "page", { page: String(Number(c.extent.page) + 1) }) : ""], "capture")
    : cs.mark("gap", "undetermined", { reason: cs.w(S + "nocitation") }));
  const span = (v) => {
    if (!v) return "";
    const from = v.from ? cs.date(typeof v.from === "string" ? v.from : v.from.value || "", { year: true }) : "";
    const to = v.to ? cs.date(typeof v.to === "string" ? v.to : v.to.value || "", { year: true }) : "";
    return from || to ? cs.w(to ? S + "span" : S + "since", { from, to }) : "";
  };
  const gradeOf = (g) => (typeof g === "string" && /^[A-D]$/.test(g) ? cs.grade("capture", g)
    : g && /^[A-D]$/.test(g.assertion || "") ? cs.grade("connection", g.assertion) : cs.mark("gap", "unrated"));
  /* R32 (1), R41: the three parts of what the team says, shared by the pages of every kind */
  const aliasSec = () => {
    const aliases = ((ent && ent.aliases) || []).filter((a) => !a.withdrawn);
    const aliasRow = (a) => cs.row("", `<b>${cs.esc(a.alias)}</b>`,
      `<span class="mk-small">${!a.canonical && !/^(machine|class|agent):/.test(String(a.declared_by || "")) && a.declared_by ? cs.w("entity.alias.by", { who: P.who(cs, a.declared_by), date: cs.date(a.at || "", { year: true }) }) : cs.w("entity.alias.roster")}</span>`
      + (!a.canonical && !/^(machine|class|agent):/.test(String(a.declared_by || "")) && a.declared_by ? cs.act("aliaswithdraw", { label: "act.owed_aliaswithdraw.label.person", data: { alias: a.alias } }) : ""));
    return cs.sec("entity.alias.title", (aliases.length ? cs.sheet(aliases.map(aliasRow).join("")) : "")
      + cs.field("person-alias", org ? "entity.alias.label.org" : "entity.alias.label", { help: "entity.alias.help" })
      + cs.act("entityalias", { label: "entity.alias.add" }));
  };
  const tiesSec = (noneKey) => {
    const rels = ((ent && ent.relations) || []).filter((r) => !r.withdrawn);
    const relRow = (r) => {
      const other = r.direction === "in" ? r.from_entity : r.to_entity;
      const kind = ["member_of", "proxy_for", "overlaps"].includes(r.relation) ? r.relation : "overlaps";
      return cs.row("", `<b>${cs.w("entity.relation." + kind)}</b> · ${P.refOf(cs, other, nameOf(other), [])}`,
        `<span class="mk-small">${cs.w("entity.relation.declared", { who: cs.esc(P.who(cs, r.declared_by)), date: cs.date(r.at || "", { year: true }), where: cs.esc(String(r.citation || "")) })}</span>`
        + (r.justification ? ` <span class="rec">${cs.esc(r.justification)}</span>` : ""));
    };
    return cs.sec("entity.relation.title", (rels.length ? cs.sheet(rels.map(relRow).join("")) : `<p class="cs-state" data-state="empty">${cs.w(noneKey)}</p>`)
      + cs.choice("person-rel-kind", "entity.relation.kind", ["member_of", "proxy_for", "overlaps"].map((k) => [k, "entity.relation." + k]), {})
      + `<p class="mk-small">${cs.w("entity.relation.kind.help")}</p>`
      + cs.choice("person-rel-with", "entity.relation.with", who.filter((o) => o.value !== id), {})
      + cs.field("person-rel-why", "entity.relation.why", { area: true, rec: true })
      + (view.reachable ? cs.act("writinghelp", { label: "act.writinghelp.label.person", data: { field: "justification" } }) : "")
      + cs.field("person-rel-cite", "entity.relation.cite", { help: "entity.relation.cite.help" })
      + cs.act("relationdeclare", { label: "entity.relation.declare" }));
  };
  const namingSec = () => {
    const nm = view.data.naming && view.data.naming.state === "ok" && view.data.naming.value ? view.data.naming.value : null;
    const docs = nm ? (nm.documents || []).filter((x) => x && x.capture_sha) : [];
    if (!docs.length) return "";
    const docRow = (x) => cs.row("", `<b>${P.refOf(cs, x.bundle_id || x.capture_sha, x.label || x.ref || P.plain(cs, S + "source"), [x.matched_alias || ""], x.bundle_id ? "document" : "capture")}</b>`
      + ` <span class="mk-small">${x.page !== undefined && x.page !== null ? cs.w("entity.naming.row", { page: String(x.page), alias: x.matched_alias || "" }) : cs.esc(x.matched_alias || "")}</span>`,
    cs.act("resolve", { label: "entity.naming.match", data: { sha: x.capture_sha, ref: x.ref } })
      + cs.act("resolvetestify", { label: "entity.naming.testify", data: { sha: x.capture_sha, ref: x.ref } }));
    return cs.sec("entity.naming.title", `<p class="mk-small">${cs.w("entity.naming.says")}</p>` + cs.sheet(docs.map(docRow).join(""))
      + cs.field("person-naming-basis", "entity.naming.basis", { area: true, rec: true, help: "entity.naming.basis.help" })
      + (view.reachable ? cs.act("writinghelp", { label: "act.writinghelp.label.person", data: { field: "basis" } }) : ""));
  };
  /* R41: a subject of another kind (an office as a post, an ordinance, a contract, a fund, a source): the subject's own page,
     read from `entity` (aliases, declared ties), `concerns` (the documents that name it) and, for an office, `linesof`; no fact
     is recorded about it and no `person` read is made */
  if (other) {
    const kindKey = (k) => (cs.w("screen.people.today.kind." + k) !== cs.esc("screen.people.today.kind." + k) ? "screen.people.today.kind." + k : "find.row.kind." + k);
    const office = ent.kind === "office";
    const cq = P.later(cs, view, "concerns", "concerns", { query: { id, limit: "200" }, n: nonce });
    const hq = office ? P.later(cs, view, "holders", "linesof", { query: { entity: id, kinds: "holds", direction: "to", limit: "200" }, n: nonce }) : null;
    const docs = cq.state === "ok" && cq.value && Array.isArray(cq.value.documents) ? cq.value.documents : [];
    const named = cq.state === "ok" ? docs.length : 0;
    const note = typeof ent.note === "string" ? ent.note.trim() : "";
    const counted = cq.state !== "ok" ? "" : named
      ? cs.w("screen.people.counts", { list: cs.w("screen.people.count." + (named === 1 ? "document" : "documents"), { n: String(named) }) })
      : cs.w("screen.people.counts.none");
    const o = [cs.title(ent.label || id, { thing: { kind: ent.kind, facts: [] } })];
    o.push(`<p class="mk-sub">${[note ? `<span class="rec">${cs.esc(note)}</span>` : "", cs.w(kindKey(ent.kind)), counted].filter(Boolean).join(" · ")}</p>`);
    if (named) o.push(`<div class="mk-acts">${cs.act("explore", { label: "act.explore.label.person", data: { entity: id } })}</div>`);
    if (!office && (cq.state !== "ok" || docs.length)) o.push(cs.sec(S + "cited", cs.state(cq, (v) => cs.sheet((v.documents || []).map((x) => {
      const place = x.extent && x.extent.page !== undefined ? ` <span class="mk-small">${cs.w(S + "page", { page: String(Number(x.extent.page) + 1) })}</span>` : "";
      return cs.row(cs.grade("subject", x.grade || ""), P.refOf(cs, x.bundle_id || x.capture_sha, docTitle(x.capture_sha) || P.plain(cs, S + "source"), [], x.bundle_id ? "document" : "capture") + place, "");
    }).join("")) + (v.truncated ? `<p class="mk-small">${cs.w("screen.people.more", { n: String((v.documents || []).length) })}</p>` : ""))));
    if (office) o.push(cs.sec(S + "holders", cs.state(hq, (v) => {
      const held = (v.lines || []).filter((l) => l && !l.withdrawn && l.kind === "holds");
      return cs.sheet(held.map((l) => {
        const when = l.valid && l.valid.undetermined ? `${cs.mark("gap", "undetermined")} <span class="mk-small">${P.why(cs, l.valid.why)}</span>` : span(l.valid);
        /* R1 (K5178): a holder whose post states no end is stated current through a day (`linecurrentthrough`, `lines` R21) */
        const open = l.line_id && l.valid && !l.valid.undetermined && (l.valid.to === null || l.valid.to === undefined);
        return cs.row(gradeOf({ assertion: l.assertion }), `${P.refOf(cs, l.from, nameOf(l.from), [l.title || ""])}${when ? " · " + when : ""}`,
          cite(l.basis && l.basis.captureSha ? { captureSha: l.basis.captureSha, extent: l.basis.extent } : null)
          + (open ? cs.act("linecurrentthrough", { label: "act.linecurrentthrough.label.person", data: { line: l.line_id } }) : ""));
      }).join("")) + (v.truncated ? `<p class="mk-small">${cs.w("screen.people.more", { n: String(held.length) })}</p>` : "");
    })));
    /* R1: "who holds it": a holder, her post's dates (the end optional) and what says so, a document or the member's own word (`recordline`, kind `holds`) */
    const srcNow = view.ui["choice:ho-src"] === "own" ? "own" : "doc";
    const CAPACITIES = ["employee", "elected", "appointed", "acting", "interim", "ex_officio", "board_member", "officer_or_director", "partner", "military_service", "volunteer", "contractor", "other"];
    o.push(cs.sec("screen.person.holds.heading", cs.choice("ho-who", "screen.person.holds.holder", [{ value: "", text: "" }].concat(who.filter((x) => x.value !== id)), {})
      + cs.choice("ho-cap", "screen.person.holds.capacity", [{ value: "", text: "" }].concat(CAPACITIES.map((k) => [k, "label.linecapacities." + k])), {})
      + cs.choice("ho-src", S + "keeper.source.label", [["doc", S + "keeper.source.doc"], ["own", S + "keeper.source.own"]], { acts: {}, value: "doc" }) + `<p class="mk-small">${cs.w(S + "keeper.source.help.a")} ${cs.w(S + "keeper.source.help.b")}</p>`
      + (srcNow === "doc" ? P.docChoice(cs, view, "ho-doc", { label: S + "keeper.doc.label", passage: false }) : cs.field("ho-statement", S + "claim.note", { area: true, rec: true }))
      + cs.field("ho-from", S + "keeper.from.label", { type: "date" }) + cs.field("ho-to", S + "keeper.to.label", { type: "date" })
      + cs.act("recordline", { label: "act.recordline.label.office", data: { holds: "1" } })
      + cs.field("ho-through", "screen.person.holds.through", { type: "date" })));
    const says = [aliasSec(), tiesSec(office ? "screen.person.ties.none.office" : "screen.person.ties.none.ordinance")];
    if (!office) says.push(namingSec());
    o.push(cs.sec("entity.says.title.org", says.join(""), { help: "entity.says.help.org" }));
    return o.join("");
  }
  /* R18: "Connections": the graph from this person, as of today, two rings out; a node pressed becomes the centre */
  const centre = String(view.ui.centre || id);
  const gq = P.later(cs, view, "graph", "exploregraph", { body: { centre, at: { value: P.today(cs), precision: "day", zone: "UTC" }, rings: 2 } });
  /* R48, R32 (3): a person with no connections draws the sentence, no graph and no "Explore connections"; the person's own page has no "Open the person" */
  const none = (g) => g && Array.isArray(g.nodes) && !(Array.isArray(g.steps) ? g.steps : []).length && g.nodes.length <= 1;
  if (!(gq.state === "ok" && none(gq.value))) out.push(`<div class="mk-acts">${cs.act("explore", { label: "act.explore.label.person", data: { entity: id } })}</div>`);
  out.push(cs.sec(S + "connections", cs.state(gq, (g) => (none(g)
    ? `<p class="cs-state" data-state="empty">${cs.w("person.graph.none")}</p>`
    : P.graph(cs, g, { idonly: P.idonlyMap(P.unnamedIds(g) ? P.later(cs, view, "idonly", "entityidonly", { query: { ids: P.unnamedIds(g) } }) : null), groupOf: ((groups) => (k) => groups[k] || null)(P.groupsFor(cs, view, g, P.later)), trail: Array.isArray(view.ui.trail) && view.ui.trail.length ? view.ui.trail : [centre], act: "explore", names: { [id]: name },
      words: { cited: S + "g.cited", declared: S + "g.declared", hunch: S + "g.hunch", nosource: S + "g.nosource", attached: "screen.explore.attached" } })))));
  /* R22: a section that holds nothing is not drawn (loading and failed are still drawn) */
  if (!p || (p.posts || []).length) out.push(cs.sec(S + "positions", cs.state(d, (v) => {
    const posts = v.posts || [];
    return cs.sheet(posts.map((x) => cs.row(gradeOf(x.grade),
      `${P.refOf(cs, x.to, x.title || nameOf(x.to), [x.capacity || ""])}${x.capacity ? " · " + cs.esc(x.capacity) : ""} · ${span(x.valid)}`,
      cite(x.citation))).join(""));
  })));
  /* R32 (2): every fact recorded about the person: those valid today, then those whose validity is not stated or settled,
     each marked undetermined with its reason and source, and the withdrawn ones apart in a fold; none dropped */
  const kinds = ["name", "birth", "death", "locality", "address", "contact"];
  const kindWord = (f) => cs.w(S + "kind." + (kinds.includes(f.kind) ? f.kind : "other"));
  const factRow = (f) => cs.row(gradeOf(f.grade), `<b>${kindWord(f)}</b> · ${cs.esc(f.value)}${span(f.valid) ? " · " + span(f.valid) : ""}`, cite(f.citation));
  const standing = p ? (p.facts || []).filter((f) => !f.withdrawn) : [];
  const undet = p ? (p.undetermined || []).filter((f) => f && f.fact_id && !f.withdrawn) : [];
  const have = new Set(standing.map((f) => f.fact_id));
  const undetRows = undet.filter((f) => !have.has(f.fact_id));
  /* people R44: the withdrawn facts are answered apart from `facts` (`withdrawn_facts`) */
  const withdrawn = p ? (p.withdrawn_facts || []).concat(p.facts || [], p.undetermined || []).filter((f) => f && f.fact_id && f.withdrawn) : [];
  const seen = new Set();
  const gone = withdrawn.filter((f) => (seen.has(f.fact_id) ? false : seen.add(f.fact_id)));
  const undetLine = (f) => {
    const c = f.citation || {};
    const sha = c.captureSha || c.capture_sha || "";
    /* R44: the reason is `{key, vars}`, drawn by its word as the owner answered it */
    const reason = P.why(cs, f.undetermined && f.undetermined.why);
    const document = docTitle(sha) || (sha ? P.plain(cs, S + "source") : "");
    return cs.row(gradeOf(f.grade), `<b>${kindWord(f)}</b> · ${cs.esc(f.value)}`,
      `${cs.mark("gap", "undetermined")} <span class="mk-small">${cs.w(S + "facts.undetermined", { reason: { html: reason }, document })}</span> ${cite(c)}`);
  };
  const goneLine = (f) => {
    const w = f.withdrawn || {};
    return cs.row(gradeOf(f.grade), `<b>${kindWord(f)}</b> · ${cs.esc(f.value)}`,
      `<span class="mk-small">${cs.w(S + "facts.withdrawn.by", { name: cs.esc(String(w.handle || w.by_handle || P.who(cs, w.by))), date: cs.date(w.at || "", { year: true }), reason: cs.esc(String(w.reason || "")) })}</span>`);
  };
  const removable = standing.filter((f) => f.fact_id);
  /* R1 (K5148; WALK-FINAL-05 R149): where a fact was removed for good, the marker the dialog promises: when, and by whom by name (never the value) */
  const removedRows = p && Array.isArray(p.removed) ? p.removed.filter((x) => x && typeof x === "object") : [];
  const removedMarks = removedRows.map((x) => `<p class="mk-small" data-removed="${cs.esc(String(x.ground || ""))}">${cs.w(S + "expunge.marker", { date: { html: cs.date(x.at || "", { year: true }) }, member: P.who(cs, x.by) })}</p>`).join("");
  const factsInner = cs.state(d, () => (standing.length ? cs.sheet(standing.map(factRow).join("")) : "") + removedMarks
    + (undetRows.length ? cs.sheet(undetRows.map(undetLine).join("")) : "")
    + (gone.length ? `<details class="mk-details"><summary>${cs.w(S + "facts.withdrawn", { n: String(gone.length) })}</summary>${cs.sheet(gone.map(goneLine).join(""))}</details>` : ""))
    + cs.choice("person-fact-kind", S + "fact.kind", (orgPage ? ["name", "address", "contact"] : kinds).map((k) => [k, S + "kind." + k]), {})
    + (orgPage ? `<p class="mk-small">${cs.w(S + "kind.help.org")}</p>` : "")
    + cs.field("person-fact-value", S + "fact.value", { rec: true })
    + cs.field("person-fact-from", S + "fact.from", { type: "date" })
    + P.docChoice(cs, view, "person-fact-doc", { passage: false, drive: true }) + P.passagePick(cs, view, "person-fact-doc", "person-fact-passage", P.later)
    + cs.act("recordpersonfact", { label: "act.recordpersonfact.label.person" })
    + cs.field("person-follow", S + "follow.address", { help: S + "follow.help" })
    + cs.act("followregister", { label: "act.followregister.label.person" });
  out.push(cs.sec(S + "facts", factsInner));

  /* R50 (DEC-374, C68): "Records its offices keep": which office of this organization keeps the records on a subject, or is
     responsible for it (`recordline`, kind `custodian_of` or `responsible_for`); each statement standing, its source and dates, and
     the form to record one. A records request about the subject is then offered the office (`actions`). Drawn only for an
     organization with an office to name. */
  if (orgPage) {
    const K = S + "keeper.";
    const offQ = P.later(cs, view, "offices", "entitieskind", { query: { kind: "office", limit: "200" } });
    const postQ = P.later(cs, view, "postin", "linesof", { query: { entity: id, kinds: "post_in", direction: "to", limit: "200" }, n: nonce });
    const subQ = P.later(cs, view, "subjects", "peopledirectory", { query: { show: "everything", limit: "200" } });
    const inOrg = new Set((postQ.state === "ok" && postQ.value && Array.isArray(postQ.value.lines) ? postQ.value.lines : []).filter((l) => l && !l.withdrawn).map((l) => l.from));
    const offices = (offQ.state === "ok" && offQ.value && Array.isArray(offQ.value.entities) ? offQ.value.entities : []).filter((e) => e && inOrg.has(e.entity_id) && e.label)
      .map((e) => ({ value: e.entity_id, text: e.label }));
    const subjects = (subQ.state === "ok" && subQ.value && Array.isArray(subQ.value.rows) ? subQ.value.rows : []).filter((r) => r && r.entity && r.name).map((r) => ({ value: r.entity, text: r.name }));
    const subjectName = (x) => (subjects.find((o) => o.value === x) || {}).text || P.plain(cs, "connection.node.unnamed");
    const kept = [];
    let keptPending = false;
    for (const o of offices) {
      const kq = P.later(cs, view, "keeps:" + o.value, "linesof", { query: { entity: o.value, kinds: "custodian_of,responsible_for", direction: "from", limit: "200" }, n: nonce });
      if (kq.state === "loading") keptPending = true;
      if (kq.state === "ok" && kq.value && Array.isArray(kq.value.lines)) for (const l of kq.value.lines) if (l && !l.withdrawn && (l.kind === "custodian_of" || l.kind === "responsible_for")) kept.push({ office: o.text, line: l });
    }
    if (offices.length) {
      const dated = (l) => (span(l.valid) || cs.mark("gap", "undetermined"));
      const srcNow = view.ui["choice:kp-src"] === "own" ? "own" : "doc";
      out.push(cs.sec(K + "heading", `<p>${cs.w(K + "intro.a")} ${cs.w(K + "intro.b")}</p>`
        + (kept.length ? cs.sheet(kept.map((x) => cs.row(gradeOf({ assertion: x.line.assertion }), `${cs.esc(x.office)} ${x.line.kind === "custodian_of" ? cs.w(K + "line", { subject: subjectName(x.line.to) }) : cs.w(K + "line.responsible", { subject: subjectName(x.line.to) })} · ${dated(x.line)}`,
          x.line.line_id ? cs.act("linewithdraw", { label: "act.linewithdraw.label.person", data: { line: x.line.line_id } }) : "",
          cite(x.line.basis && x.line.basis.captureSha ? { captureSha: x.line.basis.captureSha, extent: x.line.basis.extent } : null))).join("")) : "")
        + cs.choice("kp-office", K + "office.label", offices, {}) + `<p class="mk-small">${cs.w(K + "office.help")}</p>`
        + cs.choice("kp-kind", K + "kind.label", [["custodian_of", K + "kind.keeps"], ["responsible_for", K + "kind.responsible"]], {}) + `<p class="mk-small">${cs.w(K + "kind.help.a")} ${cs.w(K + "kind.help.b")}</p>`
        + cs.choice("kp-subject", K + "subject.label", subjects, {}) + `<p class="mk-small">${cs.w(K + "subject.help.a")} ${cs.w(K + "subject.help.b")}</p>`
        + cs.choice("kp-src", K + "source.label", [["doc", K + "source.doc"], ["own", K + "source.own"]], { acts: {}, value: "doc" }) + `<p class="mk-small">${cs.w(K + "source.help.a")} ${cs.w(K + "source.help.b")}</p>`
        + (srcNow === "doc" ? P.docChoice(cs, view, "kp-doc", { label: K + "doc.label", passage: false }) : cs.field("kp-statement", S + "claim.note", { area: true, rec: true }))
        + cs.field("kp-from", K + "from.label", { type: "date" }) + cs.field("kp-to", K + "to.label", { type: "date" })
        + `<p class="mk-small">${cs.w(K + "dates.note.a")} ${cs.w(K + "dates.note.b")}</p>`
        + cs.act("recordline", { label: K + "button" })
        + `<details class="mk-details"><summary>${cs.w(K + "refused.summary")}</summary>`
        + `<p>${cs.w(K + "refused.nobasis.a")} ${cs.w(K + "refused.nobasis.b")}</p><p>${cs.w(K + "refused.self.a")} ${cs.w(K + "refused.self.b")}</p><p>${cs.w(K + "refused.dates.a")} ${cs.w(K + "refused.dates.b")}</p></details>`
        + `<p class="mk-small">${cs.w(K + "withdraw.a")} ${cs.w(K + "withdraw.b")}</p>`));
    }
    void keptPending;
  }
  /* R32 (1): what the team says about them: other names, ties a member declared, and the documents that may name them */
  if (ent) {
    const says = [aliasSec(), tiesSec("entity.relation.none"), namingSec()];
    says.push(`<div class="mk-acts">${cs.act("connect", { label: org ? "entity.connect.org" : "entity.connect" })}</div>`);
    /* C60: what "Connect" found, said: no document names them yet (and why: a document names them once it is matched), else how many, each listed */
    const cn = view.ui.connected;
    if (cn) {
      const heldRows = P.docsAll(cs, view).rows;
      const titleOfBundle = (b) => { const r = heldRows.find((x) => x && x.bundle_id === b); return (r && r.title) || ""; };
      says.push(cn.n
        ? `<p class="mk-small" data-connected="${cs.esc(String(cn.n))}">${cs.w("screen.people.counts", { list: cs.w("screen.people.count." + (cn.n === 1 ? "document" : "documents"), { n: String(cn.n) }) })}</p>`
          + (cn.ends.length ? cs.sheet(cn.ends.map((b) => `<span data-connected-doc="${cs.esc(b)}">${cs.row("", P.refOf(cs, b, titleOfBundle(b) || P.plain(cs, S + "source"), [], "document"), "")}</span>`).join("")) : "")
        : `<p class="mk-small" data-connected="0">${cs.w("screen.people.counts.none")} ${cs.w("entity.naming.says")}</p>`);
    }
    out.push(cs.sec(org ? "entity.says.title.org" : "entity.says.title", says.join(""), { help: org ? "entity.says.help.org" : "entity.says.help" }));
  }

  /* R38, R39: "Same person?": the standing claims as rows, the cluster the claims link (never merged), the candidates (not
     claims), and the two claim acts, each explained where it stands */
  const others = p && p.cluster && Array.isArray(p.cluster.members) ? p.cluster.members.filter((m) => m !== id) : [];
  const claims = p && Array.isArray(p.claims) ? p.claims.filter((c) => c && !c.withdrawn) : [];
  const bases = ["identifier", "corroborated_name", "name", "testimony"];
  const claimRow = (c, i) => {
    const kind = ["same_as", "not_same_as", "unsure"].includes(c.kind) ? c.kind : "unsure";
    const otherId = c.a === id ? c.b : c.a;
    const because = bases.includes(c.basis) ? cs.w(S + "same.because" + sfx, { grade: c.grade || "", basis: { html: cs.w(S + "basis.row." + c.basis) } }) : cs.esc(c.why || "");
    return cs.row(cs.grade("subject", c.grade || ""),
      `<b>${cs.w(orgPage ? S + "claim.kind." + kind + ".org" : "label.identityclaimkinds." + kind)}</b> · ${P.refOf(cs, otherId, nameOf(otherId), [])} · ${because}`
      + ` <span class="mk-small">${cs.w(S + "claim.by", { by: P.who(cs, c.by), date: { html: cs.date(c.at || "") } })}</span>`
      + (c.why && bases.includes(c.basis) ? ` <span class="rec">${cs.esc(c.why)}</span>` : ""),
      `<details class="mk-details" open><summary>${cs.w("act.withdrawidentityclaim.label.person")}</summary><p class="mk-small">${cs.w("act.withdrawidentityclaim.does")}</p>`
        + cs.field("person-wd-reason-" + i, S + "claim.withdraw.reason", { area: true, rec: true })
        + cs.act("withdrawidentityclaim", { label: "act.withdrawidentityclaim.label.person", data: { claim: c.claim_id, field: "person-wd-reason-" + i } }) + "</details>");
  };
  const cand = ent ? noPerson(P.later(cs, view, "cand", "samepersoncandidates", { query: { id }, n: nonce })) : pending;
  const fieldsWord = (c, state) => ["names", "identifiers", "posts", "life"].filter((k) => c.fields && c.fields[k] && c.fields[k].state === state).map((k) => P.plain(cs, S + "field." + k)).join(", ");
  const candList = cand && cand.state === "ok" && cand.value && Array.isArray(cand.value.candidates) ? cand.value.candidates : [];
  const candOptions = candList.map((c) => ({ value: c.entity_id, text: P.plain(cs, S + "claim.candidate", { record: nameOf(c.entity_id), agrees: fieldsWord(c, "agrees"), differs: fieldsWord(c, "differs") }) }));
  const otherOptions = candOptions.length ? candOptions : who.filter((o) => o.value !== id);
  const basisNow = bases.includes(view.ui["choice:person-claim-basis"]) ? view.ui["choice:person-claim-basis"] : "testimony";
  const claimForm = !(cand && cand.state === "loading") && !(cand && cand.state === "failed") && otherOptions.length
    ? `<details class="mk-details" open><summary>${cs.w("act.identityclaim.label.person")}</summary><p class="mk-small">${cs.w("act.identityclaim.does")}</p>`
      + cs.choice("person-claim-other", S + "claim.other", otherOptions, {})
      + cs.choice("person-claim-kind", S + "claim.kind", ["same_as", "not_same_as", "unsure"].map((k) => [k, orgPage ? (k === "unsure" ? S + "claim.kind.unsure.org" : S + "claim." + k + ".org") : S + "claim.kind." + k]), {})
      + cs.choice("person-claim-basis", S + "claim.basis", bases.map((b) => [b, "label.claimbases." + b]), { acts: {}, value: "testimony" })
      + `<p class="mk-small">${cs.w(S + "claim.basis.help")}</p>`
      + (basisNow !== "testimony" ? `<p class="mk-small">${cs.w(S + "claim.evidence")}</p>`
        + P.docChoice(cs, view, "person-claim-doc-a", { label: S + "claim.sha.a", passage: false }) + P.docChoice(cs, view, "person-claim-doc-b", { label: S + "claim.sha.b", passage: false }) : "")
      + cs.field("person-claim-note", S + "claim.note", { area: true, rec: true })
      + cs.act("identityclaim", { label: "act.identityclaim.label.person" })
      + (view.ui.claimEmpty ? `<details class="mk-details" open><summary>${cs.w(S + "claim.empty.summary")}</summary><p>${cs.w(S + "claim.empty")}</p></details>` : "")
      + "</details>" : "";
  out.push(cs.sec(S + "same" + sfx, (others.length ? cs.sheet(others.map((m) => cs.row("", P.refOf(cs, m, nameOf(m), []), `<span class="mk-small">${cs.w(S + "same.claimed" + sfx)}</span>`)).join(""))
      : p && p.cluster && p.cluster.state === "undetermined" ? `${cs.mark("gap", "undetermined")} <span class="mk-small">${P.why(cs, p.cluster.why)}</span>` : "")
    + (claims.length ? cs.sheet(claims.map(claimRow).join("")) : "")
    + cs.state(cand, (v) => ((v.candidates || []).length ? `<p class="mk-small">${cs.w(S + "candidates" + sfx)}</p>` : ""))
    + claimForm, orgPage ? { help: S + "same.holds.org" } : {}));
  /* R1: removing a fact for good: the consequence statement (op-grades R21), filled with the day and the member, the
     law or order that requires it, and the Irreversible act (the shell's dialog; read only at the phone width) */
  if (removable.length) {
    out.push(cs.sec(S + "expunge.head",
      `<div class="cs-dialog" data-consequence="personexpunge"><p class="ends">${cs.w(S + "expunge.statement", { date: cs.date(P.today(cs), { year: true }), member: (view.me && view.me.handle) || "" })}</p>`
      + cs.choice("person-x-fact", S + "expunge.fact", removable.map((f) => ({ value: f.fact_id, text: (f.kind || "") + ": " + (f.value || "") })), {})
      + cs.choice("person-x-ground", S + "expunge.ground", [["court_order", S + "ground.court_order"], ["unlawful", S + "ground.unlawful"], ["confidential", S + "ground.confidential"], ["lawful_demand", S + "ground.lawful_demand"]], {})
      + cs.field("person-x-order", S + "expunge.order", { rec: true, help: S + "expunge.order.help" })
      + cs.act("personexpunge", { label: "act.personexpunge.label.person", tone: "primary" }) + "</div>"));
  }
  return out.join("");
}

const acts = rereading([
  { op: "explore", label: "act.explore.label.person",
    send(view, el, cs) {
      if (el && el.dataset && el.dataset.node) {
        const node = String(el.dataset.node);
        const t = Array.isArray(view.ui.trail) && view.ui.trail.length ? view.ui.trail : [String(view.ui.centre || view.subject || "")];
        const i = t.indexOf(node);
        view.ui.trail = i >= 0 ? t.slice(0, i + 1) : t.concat([node]);
        cs.set("centre", node);
        return null;
      }
      cs.go("explore", String(view.subject || ""));
      return null;
    } },
  { op: "recordpersonfact", label: "act.recordpersonfact.label.person",
    send(view, el, cs) {
      const value = String(cs.value("person-fact-value") || "").trim();
      const citation = view.parts.chosen(cs, "person-fact-doc", "person-fact-passage");
      if (!value || !citation) return { refuse: "screen.person.fact.empty" };
      const from = String(cs.value("person-fact-from") || "").trim();
      return { body: { person: String(view.subject || ""), kind: String(cs.value("person-fact-kind") || "name"), value,
        valid: { from: from || null, to: null }, citation } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  /* R50: an office of the organization keeps the records on a subject (or is responsible for it), from a document or the member's own word */
  { op: "recordline", label: "act.recordline.label.person",
    refusals: {
      NO_BASIS: function (r, cs) { return cs ? cs.w("screen.person.keeper.refused.nobasis.a") + " " + cs.w("screen.person.keeper.refused.nobasis.b") : ""; },
      SELF_LINE: function (r, cs) { return cs ? cs.w("screen.person.keeper.refused.self.a") + " " + cs.w("screen.person.keeper.refused.self.b") : ""; },
      BOUNDS_REVERSED: function (r, cs) { return cs ? cs.w("screen.person.keeper.refused.dates.a") + " " + cs.w("screen.person.keeper.refused.dates.b") : ""; },
    },
    send(view, el, cs) {
      /* "Record who holds it" on an office's page: a `holds` line from the holder to this office (`lines` R1) */
      if (el && el.dataset && el.dataset.holds) {
        const holder = String(cs.value("ho-who") || "").trim();
        const own = view.ui["choice:ho-src"] === "own", statement = String(cs.value("ho-statement") || "").trim();
        const basis = own ? (statement ? { statement } : null) : view.parts.chosen(cs, "ho-doc");
        const capacity = String(cs.value("ho-cap") || "").trim();
        if (!holder || !capacity || !basis) return { refuse: "screen.person.holds.empty" };
        const f = String(cs.value("ho-from") || "").trim(), t = String(cs.value("ho-to") || "").trim();
        return { body: Object.assign({ kind: "holds", from: holder, to: String(view.subject || ""), capacity, basis }, f || t ? { valid: { from: f || null, to: t || null, precision: "day", zone: "UTC" } } : {}) };
      }
      const from = String(cs.value("kp-office") || "").trim(), to = String(cs.value("kp-subject") || "").trim();
      if (!from || !to) return { refuse: "screen.person.keeper.subject.help.a" };
      const own = view.ui["choice:kp-src"] === "own";
      const statement = String(cs.value("kp-statement") || "").trim();
      const basis = own ? (statement ? { statement } : null) : view.parts.chosen(cs, "kp-doc");
      if (!basis) return { refuse: "screen.person.keeper.refused.nobasis.b" };
      const f = String(cs.value("kp-from") || "").trim(), t = String(cs.value("kp-to") || "").trim();
      const kind = String(cs.value("kp-kind") || "custodian_of") === "responsible_for" ? "responsible_for" : "custodian_of";
      return { body: Object.assign({ kind, from, to, basis }, f || t ? { valid: { from: f || null, to: t || null, precision: "day", zone: "UTC" } } : {}) };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  /* R1 (diag2-020305 §5; K5178): "State it current through a day": a holder row's post, stated current through the day, on the holder form's source */
  { op: "linecurrentthrough", label: "act.linecurrentthrough.label.person",
    send(view, el, cs) {
      const lineId = String((el && el.dataset && el.dataset.line) || "").trim();
      const day = String(cs.value("ho-through") || "").trim();
      const own = view.ui["choice:ho-src"] === "own", statement = String(cs.value("ho-statement") || "").trim();
      const basis = own ? (statement ? { statement } : null) : view.parts.chosen(cs, "ho-doc");
      if (!lineId || !day || !basis) return { refuse: "screen.person.holds.empty" };
      return { body: { lineId, day, basis } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  /* R50, B14: a statement recorded by mistake is withdrawn with a reason (the shell asks it, `lines` R8); the lines are read again */
  { op: "linewithdraw", label: "act.linewithdraw.label.person",
    send(view, el) {
      const lineId = String((el && el.dataset && el.dataset.line) || "").trim();
      return lineId ? { body: { lineId } } : null;
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "identityclaim", label: "act.identityclaim.label.person", reasonField: "note",
    send(view, el, cs) {
      const b = String(cs.value("person-claim-other") || "").trim();
      const note = String(cs.value("person-claim-note") || "").trim();
      /* R38: with the other record or the note missing nothing is sent, and the fold says why */
      if (!b || !note) { cs.set("claimEmpty", true); return null; }
      view.ui.claimEmpty = false;
      const basis = String(cs.value("person-claim-basis") || "testimony");
      const body = { a: String(view.subject || ""), b, kind: String(cs.value("person-claim-kind") || "same_as"), basis, note };
      if (basis !== "testimony") {
        const ea = view.parts.chosen(cs, "person-claim-doc-a"), eb = view.parts.chosen(cs, "person-claim-doc-b");
        if (!ea || !eb) return { refuse: "screen.person.claim.evidence" };
        body.evidence = { a: ea, b: eb };
      }
      return { body };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "withdrawidentityclaim", label: "act.withdrawidentityclaim.label.person", reasonField: "reason",
    send(view, el, cs) {
      const claimId = String((el && el.dataset && el.dataset.claim) || "").trim();
      if (!claimId) return null;
      const reason = String(cs.value(String((el.dataset && el.dataset.field) || "")) || "").trim();
      if (!reason) return { refuse: "screen.person.claim.withdraw.reason" };
      return { body: { claimId, reason } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "followregister", label: "act.followregister.label.person",
    send(view, el, cs) {
      const address = String(cs.value("person-follow") || "").trim();
      if (!/^https:\/\//.test(address)) return { refuse: "screen.person.follow.empty" };
      return { body: { address } };
    } },
  { op: "personexpunge", label: "act.personexpunge.label.person", dialog: [{ name: "reason", label: "screen.person.expunge.reason" }],
    send(view, el, cs, extra) {
      const id = String(cs.value("person-x-fact") || "");
      const ground = String(cs.value("person-x-ground") || "");
      const order = String(cs.value("person-x-order") || "").trim();
      const reason = String((extra && extra.fields && extra.fields.reason) || "").trim();
      if (!id || !reason) return { refuse: "screen.person.expunge.empty" };
      if (ground === "court_order" && !order) return { refuse: "screen.person.expunge.noorder" };
      return { body: Object.assign({ id, ground, reason }, ground === "court_order" ? { order } : {}) };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  /* R32 (1): another name, a declared tie, a document matched to them, and a name taken off, each with the owner's arguments */
  { op: "entityalias", label: "entity.alias.add",
    send(view, el, cs) {
      const alias = String(cs.value("person-alias") || "").trim();
      return { body: { entityId: String(view.subject || ""), alias } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "aliaswithdraw", label: "act.owed_aliaswithdraw.label.person",
    send(view, el) {
      const alias = String((el && el.dataset && el.dataset.alias) || "").trim();
      return alias ? { body: { entityId: String(view.subject || ""), alias } } : null;
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "relationdeclare", label: "entity.relation.declare", reasonField: "justification",
    send(view, el, cs) {
      const toEntity = String(cs.value("person-rel-with") || "").trim(), justification = String(cs.value("person-rel-why") || "").trim();
      const citation = String(cs.value("person-rel-cite") || "").trim();
      return { body: { fromEntity: String(view.subject || ""), toEntity, relation: String(cs.value("person-rel-kind") || "member_of"), justification, citation } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "resolve", label: "entity.naming.match",
    send(view, el) {
      const captureSha = String((el && el.dataset && el.dataset.sha) || ""), ref = String((el && el.dataset && el.dataset.ref) || "");
      return captureSha ? { body: { captureSha, ref } } : null;
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "resolvetestify", label: "entity.naming.testify", reasonField: "basis",
    send(view, el, cs) {
      const captureSha = String((el && el.dataset && el.dataset.sha) || ""), ref = String((el && el.dataset && el.dataset.ref) || "");
      const basis = String(cs.value("person-naming-basis") || "").trim();
      if (!captureSha) return null;
      return { body: { captureSha, ref, entityId: String(view.subject || ""), basis } };
    },
    done(view, answer, cs) { cs.set("pn", (view.ui.pn || 0) + 1); } },
  { op: "connect", label: "entity.connect",
    send(view) { return { body: { entityId: String(view.subject || "") } }; },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const ends = [];
      for (const c of r && Array.isArray(r.connections) ? r.connections : []) for (const b of [c.a_bundle_id, c.b_bundle_id]) if (typeof b === "string" && b && !ends.includes(b)) ends.push(b);
      view.ui.connected = r && r.ok !== false ? { n: Number(r.documents) || 0, ends } : null;
      cs.set("pn", (view.ui.pn || 0) + 1);
    } },
  /* the assistant's draft of the words of a tie's why or of the basis, labeled and kept only by the member's own act */
  { op: "writinghelp", label: "act.writinghelp.label.person", reasonField: "told", rereads: [],
    send(view, el, cs) {
      const field = String((el && el.dataset && el.dataset.field) || "");
      const told = String(cs.value(field === "basis" ? "person-naming-basis" : "person-rel-why") || "").trim();
      return { body: { op: field === "basis" ? "resolvetestify" : "relationdeclare", field, told } };
    },
    done(view, answer, cs) {
      const a = answer || {};
      const field = a.field === "basis" ? "person-naming-basis" : "person-rel-why";
      cs.fill(field, String(a.text || ""));
    } },
], ["entity", "naming", "people"]);

const PERSON_KEYS = [
  "screen.person.g.cited", "screen.person.g.declared", "screen.person.g.hunch", "screen.person.g.nosource", "screen.person.connections",
  "screen.person.connections.holds", "screen.person.source", "screen.person.page", "screen.person.nocitation", "screen.person.span",
  "screen.person.since", "screen.person.positions", "screen.person.positions.holds", "screen.person.facts", "screen.person.kind.name",
  "screen.person.kind.birth", "screen.person.kind.death", "screen.person.kind.locality", "screen.person.kind.address", "screen.person.kind.contact",
  "screen.person.kind.other", "screen.person.fact.kind", "screen.person.fact.value", "screen.person.fact.from",
  "screen.person.fact.empty", "screen.person.follow.address", "screen.person.follow.help",
  "screen.person.follow.empty", "screen.person.same", "screen.person.same.holds", "screen.person.same.claimed", "screen.person.candidates",
  "screen.person.field.names", "screen.person.field.identifiers", "screen.person.field.posts", "screen.person.field.life",
  "screen.person.claim.other", "screen.person.claim.kind",
  "screen.person.claim.kind.same_as", "screen.person.claim.kind.not_same_as", "screen.person.claim.kind.unsure", "screen.person.claim.basis", "screen.person.claim.basis.help",
  "screen.person.claim.sha.a", "screen.person.claim.sha.b", "screen.person.claim.note", "screen.person.claim.empty", "screen.person.claim.empty.summary", "screen.person.claim.evidence",
  "screen.person.claim.by", "screen.person.claim.candidate", "screen.person.claim.withdraw.reason", "screen.person.same.because",
  "screen.person.basis.row.identifier", "screen.person.basis.row.corroborated_name", "screen.person.basis.row.name", "screen.person.basis.row.testimony",
  "label.identityclaimkinds.same_as", "label.identityclaimkinds.not_same_as", "label.identityclaimkinds.unsure",
  "label.claimbases.identifier", "label.claimbases.corroborated_name", "label.claimbases.name", "label.claimbases.testimony",
  "screen.person.facts.undetermined", "screen.person.facts.withdrawn", "screen.person.facts.withdrawn.by", "person.graph.none",
  "entity.says.title", "entity.says.title.org", "entity.says.help", "entity.says.help.org", "entity.alias.title", "entity.alias.label", "entity.alias.label.org",
  "entity.alias.help", "entity.alias.add", "entity.alias.by", "entity.alias.roster", "entity.relation.title", "entity.relation.kind", "entity.relation.kind.help",
  "entity.relation.member_of", "entity.relation.proxy_for", "entity.relation.overlaps", "entity.relation.with", "entity.relation.why", "entity.relation.cite",
  "entity.relation.cite.help", "entity.relation.declare", "entity.relation.declared", "entity.relation.none", "entity.naming.title", "entity.naming.says",
  "entity.naming.row", "entity.naming.match", "entity.naming.testify", "entity.naming.basis", "entity.naming.basis.help", "entity.connect", "entity.connect.org",
  "screen.person.expunge.head", "screen.person.expunge.statement", "screen.person.expunge.fact",
  "screen.person.expunge.ground", "screen.person.ground.court_order", "screen.person.ground.unlawful", "screen.person.ground.confidential",
  "screen.person.ground.lawful_demand", "screen.person.expunge.order", "screen.person.expunge.order.help", "screen.person.expunge.reason",
  "screen.person.expunge.empty", "screen.person.expunge.noorder",
  /* R41: the pages of the other kinds */
  "screen.person.cited", "screen.person.holders", ...["employee", "elected", "appointed", "acting", "interim", "ex_officio", "board_member", "officer_or_director", "partner", "military_service", "volunteer", "contractor", "other"].map((k) => "label.linecapacities." + k), "screen.person.ties.none.ordinance", "screen.person.ties.none.office",
  "screen.people.counts", "screen.people.counts.none", "screen.people.count.document", "screen.people.count.documents", "screen.people.more",
  "screen.people.today.kind.office", "screen.people.today.kind.body", "screen.people.today.kind.institution", "screen.people.today.kind.movement",
  "screen.people.today.kind.fund", "screen.people.today.kind.program",
  ...["source", "office", "ordinance", "parcel", "contract", "fund", "program", "place", "proceeding"].map((k) => "find.row.kind." + k),
  "state.undetermined",
  /* R50: Records its offices keep */
  ...["heading", "intro.a", "intro.b", "line", "office.help", "kind.label", "kind.help.a", "kind.help.b", "kind.keeps", "kind.responsible", "subject.help.a", "subject.help.b",
    "subject.label", "source.help.a", "source.help.b", "source.own", "source.doc", "doc.label", "dates.note.a", "dates.note.b", "button", "refused.summary", "refused.nobasis.a",
    "refused.nobasis.b", "refused.self.a", "refused.self.b", "refused.dates.a", "refused.dates.b", "withdraw.a", "withdraw.b",
    "office.label", "source.label", "from.label", "to.label", "line.responsible"].map((k) => "screen.person.keeper." + k),
  /* R53, R58: an organization's page */
  "screen.person.kind.help.org", "screen.person.same.org", "screen.person.same.holds.org", "screen.person.same.claimed.org", "screen.person.same.because.org", "screen.person.candidates.org",
  "screen.person.claim.same_as.org", "screen.person.claim.not_same_as.org", "screen.person.claim.kind.same_as.org", "screen.person.claim.kind.not_same_as.org", "screen.person.claim.kind.unsure.org",
];

/* K5173: the rows UX-DESIGN adopts (HANDOFF B520); listed once the word table holds them, drawn by key from then on */
const NEW_KEYS = ["screen.person.expunge.marker", "screen.person.holds.heading", "screen.person.holds.holder", "screen.person.holds.capacity", "screen.person.holds.empty", "act.recordline.label.office", "screen.person.holds.through", "act.linecurrentthrough.label.person", "act.linecurrentthrough.does"].filter((k) => hasWord(k));

const words = ["screen.person.name", "screen.person.purpose", ...NEW_KEYS,
  ...["explore", "recordpersonfact", "recordline", "linewithdraw", "identityclaim", "withdrawidentityclaim", "followregister", "entityalias", "relationdeclare", "resolve", "resolvetestify", "connect", "writinghelp"]
    .flatMap((op) => ["act." + op + ".label.person", "act." + op + ".does"]),
  "act.owed_aliaswithdraw.label.person", "act.owed_aliaswithdraw.does",
  "act.personexpunge.label.person", "act.personexpunge.does",
  "mark.scale.capture.name", "mark.scale.capture.means", "mark.scale.connection.name", "mark.scale.connection.means",
  "mark.scale.subject.name", "mark.scale.subject.means", "mark.grade.reading",
  "mark.gap.undetermined.name", "mark.gap.undetermined.means", "mark.gap.unrated.name", "mark.gap.unrated.means",
  ...GRAPH_SHARED, ...FORM_SHARED, ...WHY_KEYS,
  "state.empty", "state.loading", "state.failed", ...PERSON_KEYS];

export const PERSON_SCREEN = Object.freeze({ id: "person", ABSENT_CODES: Object.freeze(["NO_ENTITY", "NO_CALC"]), reads, render, acts, words, parts: PARTS });
