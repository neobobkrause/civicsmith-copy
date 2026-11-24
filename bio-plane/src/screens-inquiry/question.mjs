/* screens-inquiry R2, R12, R23–R27, R31, R34–R36, R38–R41, R44–R47, R71–R74, R78, R87–R89, R91, R101–R104, R110, R114, R116, R117, R120, R121, R139:
 * the question screen (Projects › <project> ›
 * Question; registry screen `question`).
 *
 * Self-contained functions (interface-shell R21 (1)): each refers only to its parameters, `cs` and the language's own
 * globals; the readers they share (`front`, `later`, `plain`, `who`) are the screen's `parts` (common.mjs). The question
 * is the inquiry `view.subject`; its own document (`image`) holds what it cites: its `references[]` (each live or severed,
 * `citation` R15) and its `basis[]` legs (R34: Supports lists every passage it cites, whether or not a reading exists),
 * each leg's `ground` and the `grounds:` block (its partition, `inquiry` R27, R28; R23, R24), and the Session Log's
 * regroupings. Its readings are `basisversions` (R25), the one the project stands on read with `project`.
 *
 * Its states (R41, `Q_ST`): c, nothing cited (the three ways in); b, passages cited and no partition (what each passage
 * carries, no strength drawn); a, the strength against the bar and the read-back; d, a run of hers at work on it; e, a
 * reading the assistant proposed; f, the assistant's limit reached; g, concluded. Every sentence is a word by key (R44).
 *
 * Fix round 3 (T51): a refused basis version names the legs it left unplaced by their documents' titles (C41; R35, R50, R117; basis-version-grammar
 * R11); a leg whose extent states a paragraph draws it, counted from zero in the record and drawn from one (C36; R23, R24, R34, R78); a record that
 * names no opener draws the day it was opened and no undetermined name (C44; R2); a removed citation is counted nowhere: not asked about, not saved
 * in the partition, not read back, not named among the legs the strength leaves out, and the page reads the strength and the partition again after a
 * sever (C38; R2, R23, R24); a member the record names is drawn by her handle, never by her id (C94; R40, R46).
 *
 * T51 fix round 10 (R139; DEC-439 to DEC-441): the leg-grade fold on a cited passage (`leggrade`, citation R24, carried once the registry admits it: admit.mjs), the "Yes,
 * because of" a "No" set aside, "Put it on the other side" beside Reinstate (citation R23), and "A published case carries this question." */

import { admitted } from "./admit.mjs";

/** R2, R25, R26: the reads, each as its owner documents it. */
function reads(view) {
  const id = String(view.subject || "");
  return {
    inquiry: { op: "image", query: { id }, subject: true, empty: (v) => !v || typeof v !== "object" || !v["bundle.md"] },
    strength: { op: "inquirystrength", query: { id } },
    basis: { op: "basisversions", query: { id } },
    hunches: { op: "hypotheses", query: { inquiry: id },
               empty: (v) => !v || !Array.isArray(v.hypotheses) || v.hypotheses.length === 0 },
    waits: { op: "questionwaits", query: { question: id } },
    /* R54: the partition as the inquiry holds it, with the history of its changes (`inquiry` R65) */
    partition: { op: "inquirypartition", query: { id }, empty: () => false },
    /* R110: the imports the team holds, each read for the findings it accepted (`importedcase`) when the page is drawn */
    imports: { op: "importedcases", empty: (v) => !v || !Array.isArray(v.imports) || v.imports.length === 0 },
    relies: { op: "backlinks", query: { target: id },
              empty: (v) => !v || ((!Array.isArray(v.backlinks) || v.backlinks.length === 0) && v.out_of_view !== true) },
  };
}

/** The path's project step: the project the inquiry states, by its title once read (R39: never its id). */
function place(view) {
  const d = view.data && view.data.inquiry;
  const text = d && d.state === "ok" && d.value && d.value["bundle.md"];
  const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text.split(/\n---\s*\n/)[0] || "") : null;
  const home = m ? m[1] : "";
  const pid = view.project || home;
  if (!pid) return {};
  const t = view.ui && view.ui.later && view.ui.later["project:" + pid];
  const ft = t && t.state === "ok" && t.value && typeof t.value["bundle.md"] === "string"
    ? /^title:\s*(.*)$/m.exec(t.value["bundle.md"]) : null;
  let title = ft ? ft[1].trim() : "";
  try { if (title.startsWith("\"")) title = JSON.parse(title); } catch { /* raw */ }
  /* C62: a project whose record states no title is named by the project list, as the render reads it */
  if (!title) {
    const pl = view.ui && view.ui.later && view.ui.later.projects;
    const row = pl && pl.state === "ok" && pl.value && Array.isArray(pl.value.projects) ? pl.value.projects.find((x) => x && String(x.id) === pid) : null;
    if (row && row.name) title = String(row.name);
  }
  return { project: { id: pid, title } };
}

/** R2, R5, R23–R27, R31, R34–R36, R38, R41: the question in its state. */
function render(cs, view) {
  const id = String(view.subject || "");
  if (!id) return "";
  const ui = view.ui;
  const d = view.data || {};
  const P = view.parts;
  const W = (k, f) => cs.w(k, f);
  const T = (k, f) => P.plain(cs, k, f);
  /* C81 (R5): a row always has a first element. At 390 px the shell's stylesheet sets a row in two columns and puts its 3rd child in the second
     column below the text; an empty first argument leaves no first element, so the act (or the meta) landed beside the text and was squeezed
     to 44 px wide and 300 px tall, and the main area ran to 401 px. An empty first cell is an element that draws nothing. */
  const srow = (first, text, act, meta) => cs.row(first || '<span aria-hidden="true"></span>', text, act, meta);
  const later = (key, op, query, token) => P.later(cs, ui, key, op, query, token);
  /* C94 (R40, R46): a member the record names is drawn by her handle (the kit's `cs.memberName`), the founder by hers where the roster names
     one, and by a plain word, never the id, where none is known; `P.who` is the fallback where the kit holds no `memberName` */
  const whoIs = (x, founder) => P.named(cs, x, founder, P.who);
  const doc = d.inquiry && d.inquiry.state === "ok" ? P.front(d.inquiry.value["bundle.md"]) : null;
  /* R91: a question opened from a project acts for that project (the address's second part); the bare address, for its home project */
  const home = doc && /^PROJ-/.test(String(doc.project || "")) ? String(doc.project) : "";
  const project = view.project || home;
  const out = [];
  /* R39: the question's words, else its title; never its id */
  const heading = doc ? (doc.question || doc.title || "") : "";
  out.push(cs.title(heading || T("state.undetermined", { reason: "" }), { thing: "question" }));
  if (!doc) return out.join("");
  const pr = project ? later("project:" + project, "image", { id: project }) : null;
  const projectTitle = (() => {
    const m = pr && pr.state === "ok" && pr.value && typeof pr.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(pr.value["bundle.md"]) : null;
    let t = m ? m[1].trim() : "";
    try { if (t.startsWith("\"")) t = JSON.parse(t); } catch { /* raw */ }
    if (t || !pr || pr.state === "loading") return t;
    /* C44, C62: a project whose record states no title is named by the project list (project-roster R26), read only then */
    const pl = later("projects", "projectlist", { limit: "200" });
    const row = pl.state === "ok" && pl.value && Array.isArray(pl.value.projects) ? pl.value.projects.find((x) => x && String(x.id) === project) : null;
    return row && row.name ? String(row.name) : "";
  })();
  /* C44: when no title can be had, the words the plane gave for it (a refused read's translation) follow "because"; with none, no stub is drawn */
  const projectWhy = pr && pr.state === "failed" && pr.refusal && pr.refusal.fields && pr.refusal.fields.translation ? String(pr.refusal.fields.translation) : "";
  {
    const date = doc.created ? cs.date(String(doc.created), { year: true }) : "";
    /* K3402: who opened it, the author of its first promotion as the record keeps it (the image's `_history`), by
       handle (the founder unnamed by key, R40); undetermined when the record names none */
    /* R46: the founder's handle, from the participants this screen reads (project-roster R29); none while they name none */
    const parts = project ? later("participants", "projectparticipants", { projectId: project }) : null;
    const founder = parts && parts.state === "ok" && Array.isArray(parts.value.participants) ? parts.value.participants.find((x) => x && x.founder === true) : null;
    const founderHandle = founder && founder.handle ? String(founder.handle) : null;
    const opener = (() => {
      const img = d.inquiry.value || {};
      const first = Object.keys(img).filter((k) => /^_history\/promotion_.*\.json$/.test(k)).map((k) => {
        try { return JSON.parse(String(img[k])); } catch { return null; }
      }).filter((h) => h && h.author).sort((a, b) => String(a.created || "").localeCompare(String(b.created || "")))[0];
      return first ? whoIs(first.author, founderHandle) : "";
    })();
    /* C44 (R2): a record that names no opener draws `screen.project.opened.date` (the project beside it as before), never "Opened by" with an
       undetermined name; with no date either there is nothing to say of the opening */
    const head = (withProject) => (opener ? W(withProject ? "screen.question.opened" : "screen.question.opened.noproject", { name: opener, date: { html: date }, project: "" })
      : date ? W("screen.project.opened.date", { date: { html: date } }) + (withProject ? " \u00b7 " : "") : "");
    const loadingProject = !projectTitle && pr && (pr.state === "loading" || (later("projects", "projectlist", { limit: "200" }).state === "loading"));
    if (project && (projectTitle || projectWhy)) out.push(`<p class="mk-sub">${head(true)}${cs.ref("project", project, projectTitle || T("state.undetermined", { reason: projectWhy }), [])}</p>`);
    else if (!(project && loadingProject) && head(false)) out.push(`<p class="mk-sub">${head(false)}</p>`);
  }

  /* R139, R72 (T51 fix round 10; DEC-439; E I2): a question a published case carries says so, beneath its head: `screen.question.carried`, from `publishedfrozen` (the
     cases that pin it, public-read R38; R72 reads it for the section it draws below) or a published case among the citers `backlinks` answers; a question no case
     carries draws none */
  const frozen = later("frozen", "publishedfrozen", { id });
  const carriedBy = (frozen.state === "ok" && frozen.value && Array.isArray(frozen.value.cases) ? frozen.value.cases.length : 0)
    + (d.relies && d.relies.state === "ok" && d.relies.value && Array.isArray(d.relies.value.backlinks)
      ? d.relies.value.backlinks.filter((x) => x && (x.from_type === "published" || (x.from_type === "case" && x.from_state === "published"))).length : 0);
  if (carriedBy > 0) out.push(`<p class="mk-note" data-carried="1">${W("screen.question.carried")}</p>`);

  const stepsAt = out.length;
  out.push("");

  /* R31: "Read in my language", only while the assistant is reachable: its answer drawn in place, labeled, and the
     original back by one press of the same control (nothing saved, nothing read again) */
  if (view.reachable) {
    const tr = ui.translation;
    if (tr && tr.shown) out.push(`<div class="mk-note" data-translation="shown"><p class="rec">${cs.esc(tr.text)}</p>`
      + `<p class="mk-small">${W("translate.label", { language: tr.from || T("state.undetermined", { reason: "" }) })}</p>`
      + `<p class="mk-small">${W("translate.label.help")}</p></div>`);
    out.push(cs.act("readtranslate", { label: tr ? (tr.shown ? "translate.original" : "translate.back") : "act.readtranslate.label.question",
      data: { project }, tone: "quiet" }));
  }

  /* the inquiry's own legs (R34): its basis[] with each one's place (`ord`, inquiry R27's ordinal), and its references */
  const refs = (doc.lists.references || []).filter((r) => r && r.target);
  const refOf = (target) => refs.find((r) => String(r.target) === target) || null;
  const legs = (doc.lists.basis || []).map((l, ord) => Object.assign({ ord }, l)).filter((l) => l && l.target);
  const citedLegs = legs.length ? legs
    : refs.filter((r) => (r.rel || "cites") === "cites").map((r, i) => ({ ord: i, target: r.target, role: "supports", fromRef: true }));
  const supports = citedLegs.filter((l) => (l.role || "supports") === "supports");
  /* R110: a leg on another team's finding names `imported:<import>/<finding>` (inquiry-grammar R11) and a document nobody holds here;
     the findings the team accepted are read from `importedcases` and each import's `importedcase`, by their refs */
  const impRef = (t) => /^imported:([0-9a-f]{64})\/(.+)$/.exec(String(t));
  const impList = d.imports && d.imports.state === "ok" && d.imports.value && Array.isArray(d.imports.value.imports) ? d.imports.value.imports.slice(0, 20) : [];
  const acceptedFindings = [];
  for (const imp of impList) {
    const r = later("imp:" + imp.import, "importedcase", { import: String(imp.import) });
    const e = r.state === "ok" && r.value && r.value.edition ? r.value.edition : null;
    const group = r.state === "ok" && r.value ? String((r.value.group && (r.value.group.name || r.value.group.slug)) || r.value.group || "") : "";
    for (const f of e && Array.isArray(e.findings) ? e.findings : [])
      if (f && f.finding && f.origin && f.origin.acceptance) acceptedFindings.push({ import: String(imp.import), edition: e.edition, finding: String(f.finding), ref: String(f.ref || "imported:" + imp.import + "/" + f.finding), title: String(f.title || ""), group });
  }
  const impTitle = (target) => { const a = acceptedFindings.find((x) => x.ref === String(target)); return a ? a.title : ""; };
  const statusOf = (l) => { const r = refOf(String(l.target)); return r ? String(r.status || "") : (l.status === "severed" ? "severed" : ""); };
  const live = (l) => statusOf(l) !== "severed";
  /* C38 (R2): a removed (severed) citation is counted nowhere: not asked about, not saved in the partition, not read back, and not named
     among the legs the strength leaves out (the targets of the question's own severed legs) */
  const sev = new Set(citedLegs.filter((l) => !live(l)).map((l) => String(l.target)));
  const grounds = doc.lists.grounds || [];
  /* R23 (fix round 10, cause 30b; K5059): a question answered all "No" holds an empty partition (`grounds: []`, no leg names a ground); `inquirypartition` says it was
     answered (`answered`), and the page reads that back (each passage "No, my answer falls") instead of asking again. A read still pending draws nothing to answer. */
  const heldPart = d.partition && d.partition.state === "ok" && d.partition.value && d.partition.value.ok !== false ? d.partition.value : null;
  const heldEmpty = !!heldPart && heldPart.answered === true;
  const partitioned = (grounds.length > 0 && legs.some((l) => l.ground)) || heldEmpty;
  const partPending = !partitioned && !!d.partition && d.partition.state === "loading";

  /* the readings (R25): every one `basisversions` answers, and the one the project stands on (read with `project`) */
  const vs = d.basis && d.basis.state === "ok" && Array.isArray(d.basis.value.versions) ? d.basis.value.versions : [];
  const cur = project ? later("current", "basisversions", { id, project }) : null;
  const current = cur && cur.state === "ok" && cur.value.current ? cur.value.current : null;
  const currentName = current ? String(current.version || "") : "";
  /* C14 (R2, R24): what depends on the reading shown is asked once that reading is settled: `basisversions` has answered and, when the project's
     own reading is asked for, that has answered too, so a reading that changes when the second arrives is not asked about first */
  const readingSettled = !!d.basis && d.basis.state !== "loading" && !(cur && cur.state === "loading");
  const accepted = vs.filter((v) => v && v.state === "accepted");
  const machine = (v) => !!(v && (v.run || /^class:/.test(String(v.author || ""))));
  const picked = ui["choice:question-reading"];
  const shownName = (picked && vs.some((v) => v.name === picked)) ? picked
    : (currentName && vs.some((v) => v.name === currentName)) ? currentName : (accepted[0] ? accepted[0].name : (vs[0] ? vs[0].name : ""));
  const shown = vs.find((v) => v.name === shownName) || null;
  const legTitle = (l) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null;
    const named = l.target_title || l.title || (r && r.target_title);
    if (named) return String(named);
    if (impRef(l.target)) return impTitle(l.target) || T("state.undetermined", { reason: "" });
    /* K3402 (R39): a cited document is named by its own title, read from the record, never its id */
    const im = later("doc:" + l.target, "image", { id: String(l.target) });
    const m = im.state === "ok" && im.value && typeof im.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(im.value["bundle.md"].split(/\n---\s*\n/)[0] || "") : null;
    let t = m ? m[1].trim() : "";
    try { if (t.startsWith("\"")) t = JSON.parse(t); } catch { /* raw */ }
    return t || T("state.undetermined", { reason: "" });
  };
  const legGrade = (l) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null;
    return (r && r.grade) || l.grade || "";
  };
  /* R78: a page the record states counts from zero (a leg's `extent_page`, or its reading's `extent: {page}`) and is drawn from one;
     a leg whose extent states no page draws none */
  const pageOf = (l) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null;
    for (const x of [l, r]) {
      if (!x) continue;
      const p = x.extent_page !== undefined && x.extent_page !== null && x.extent_page !== "" ? Number(x.extent_page)
        : x.extent && typeof x.extent === "object" && x.extent.page !== undefined && x.extent.page !== null ? Number(x.extent.page) : NaN;
      if (Number.isInteger(p) && p >= 0) return p + 1;
    }
    return null;
  };
  /* C36 (R23, R24, R34, R78): a web-page leg's extent states a paragraph (`doc-para`, counted from 0 in the captured file, `content` as
     the extent grammar has it), drawn from one like a page; a leg whose extent states none draws none */
  const paraOf = (l) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null;
    for (const x of [l, r]) {
      if (!x) continue;
      const p = x.extent_para !== undefined && x.extent_para !== null && x.extent_para !== "" ? Number(x.extent_para)
        : x.extent && typeof x.extent === "object" && x.extent.para !== undefined && x.extent.para !== null ? Number(x.extent.para) : NaN;
      if (Number.isInteger(p) && p >= 0) return p + 1;
    }
    return null;
  };
  /* R17b (fix round 10, cause 17b; content's extent grammar): a leg that cites a part of the document outside its body (`doc-part`: a footnote, an endnote, a header, a comment)
     states that part's own reference (`extent_ref`, "footnote 1"), the document's own label for it, drawn as the record states it */
  const docPartRef = (l) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null;
    for (const x of [l, r]) {
      if (!x) continue;
      const kind = x.extent_kind !== undefined && x.extent_kind !== null ? x.extent_kind : x.extent && typeof x.extent === "object" ? x.extent.kind : undefined;
      if (String(kind) !== "doc-part") continue;
      const ref = x.extent_ref !== undefined && x.extent_ref !== null && x.extent_ref !== "" ? x.extent_ref : x.extent && typeof x.extent === "object" ? x.extent.ref : "";
      if (typeof ref === "string" && ref.trim()) return ref.trim();
    }
    return null;
  };
  /* where in the document: its page, else its paragraph, else the part it cites, as the leg's extent states one (HTML-escaped words, for a fill or markup). The sentence that
     places a part is the row owed `screen.question.leg.part` ({ref}); until it is held the reference alone is drawn, as the record states it */
  const whereOf = (l, plain) => {
    const say = plain ? T : W;
    if (pageOf(l) !== null) return say("screen.document.passage.where", { page: String(pageOf(l)) });
    if (paraOf(l) !== null) return say("screen.question.leg.paragraph", { n: String(paraOf(l)) });
    const ref = docPartRef(l);
    if (ref === null) return "";
    return cs.w("screen.question.leg.part") !== "screen.question.leg.part" ? say("screen.question.leg.part", { ref }) : plain ? ref : `<span class="rec" data-part-ref="1">${cs.esc(ref)}</span>`;
  };
  /* C36 (R23, R24, R34): the first words of the passage a leg cites. The leg's own words, else the reading shown's; else the passage of the
     cited capture's reading (`reading`, extraction R27) whose extent the leg states (`parts.legWords`: every `extent_*` field the unit's extent
     carries, equal), the capture being the leg's `extent_capture`, else the one the document's provenance names; none found, none drawn */
  const clip = (t, n) => { const x = String(t || "").replace(/\s+/g, " ").trim(); const m = n || 160; return x.length > m ? x.slice(0, m).replace(/\s+\S*$/, "") + "\u2026" : x; };
  const wordsOf = (l, r) => {
    if (l.words || (r && r.words)) return String(l.words || r.words);
    const target = String(l.target);
    if (impRef(target)) return "";
    let sha = typeof l.extent_capture === "string" && /^[0-9a-f]{64}$/.test(l.extent_capture) ? l.extent_capture : "";
    if (!sha) {
      const im = later("doc:" + target, "image", { id: target });
      try { const pj = JSON.parse(String((im.state === "ok" && im.value && im.value["data/provenance.json"]) || "")); sha = String((pj && pj.documents && pj.documents[0] && pj.documents[0].capture && pj.documents[0].capture.sha256) || ""); } catch { sha = ""; }
    }
    if (!/^[0-9a-f]{64}$/.test(sha)) return "";
    const rd = later("legread:" + sha, "reading", { sha256: sha });
    if (rd.state !== "ok") return "";
    /* the leg's extent as the record states it: its own `extent_*` fields, else the reading shown's leg (flat fields or an `extent` object) */
    const own = P.legExtent(l);
    const want = Object.keys(own).length ? own : P.legExtent(r);
    if (!Object.keys(want).some((k) => k !== "kind")) return "";
    /* G38: the unit the leg cites may sit on a later page of a long reading (`next`): the pages are followed until it is found, or none is left (the words
       are the passage's own, so a page not yet read draws none until it is) */
    const got = P.readPages((k, q) => later(k, "reading", q), "legreadafter:" + sha + ":", sha, rd.value, (us) => P.legWords(us, want) !== "");
    return P.legWords(got.units, want);
  };
  /* C36 (fix round 4, aside): every place that names a passage draws the words it cites as well (R23, R24, R34): the leg's title, its place, and its words */
  const shownLeg = (l) => (shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(l.target)) : null) || null;
  const legWordsShort = (l) => { const w = clip(wordsOf(l, shownLeg(l)), 90); return w ? "\u201c" + w + "\u201d" : ""; };
  const legName = (l) => legTitle(l) + (whereOf(l, true) ? " \u00b7 " + whereOf(l, true) : "");
  /* the lists that say what the answer rests on name each passage by its words too (R24, R34) */
  const legNameWords = (l) => legName(l) + (legWordsShort(l) ? " \u00b7 " + legWordsShort(l) : "");

  /* R116, R120: a leg the strength leaves out is named by its document's title (the reading's, else the record's), never its id;
     a document with no title by the plain word `shell.card.document`; each leg once in a list */
  const titleOf = (target) => {
    const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === String(target)) : null;
    if (r && r.target_title) return String(r.target_title);
    if (impRef(target)) return impTitle(target);
    const im = later("doc:" + target, "image", { id: String(target) });
    const m = im.state === "ok" && im.value && typeof im.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(im.value["bundle.md"].split(/\n---\s*\n/)[0] || "") : null;
    let t = m ? m[1].trim() : "";
    try { if (t.startsWith("\"")) t = JSON.parse(t); } catch { /* raw */ }
    return t;
  };
  const nameLegs = (ids) => [...new Set(ids)].map((t) => titleOf(t) || T("shell.card.document")).join(", ");
  const nlbAll = (x) => (x && Array.isArray(x.not_load_bearing) ? x.not_load_bearing.map((m) => String((m && typeof m === "object" ? m.target_id || m.target : m) || "")).filter(Boolean) : []);
  const nlbIds = (x) => nlbAll(x).filter((i) => !sev.has(i));
  /* the plane's own sentence for an axis, its record ids put back into titles; the sentences that take {legs} are drawn by their keys.
     Plain text, never escaped HTML (T51 fix round 10, D-M1): the mark or the word it goes into escapes it once, so a title with "&" is not "&amp;" */
  const axisReason = (a, x, loud) => {
    if (!x) return "";
    const ids = nlbIds(x), all = nlbAll(x), axisName = T("mark.scale." + a + ".name");
    /* a removed citation the answer's text still holds is a plain word there, never its title or its id */
    const bare = (text) => [...new Set([...all, ...[x.weakest && (x.weakest.target_id || x.weakest.target)].filter(Boolean).map(String)])]
      .reduce((t, i) => t.split(i).join((sev.has(i) ? "" : titleOf(i)) || T("shell.card.document")), String(text || ""));
    if (x.state === "unrated") {
      if (!loud) return "";
      const sets = Array.isArray(x.grounds) ? x.grounds.filter((g) => g && g.ground !== null && g.ground !== undefined) : [];
      if (all.length && !ids.length) return T("strength.arithmetic.unrated_this_inquiry_rests_on_nothing", { axis: axisName });
      if (!ids.length) return Number(x.population) > 0 ? bare(x.detail) : T("strength.arithmetic.unrated_this_inquiry_rests_on_nothing", { axis: axisName });
      return sets.length ? T("strength.arithmetic.unrated_no_leg_on_any_set", { axis: axisName, count: String(sets.length), legs: nameLegs(ids) })
        : T("strength.arithmetic.unrated_no_leg_on_this_axis", { axis: axisName, legs: nameLegs(ids) });
    }
    return bare(all.length ? String(x.detail || "").split(T("strength.arithmetic.present_and_not_yet_load_bearing", { legs: all.join(", ") })).join("").trim() : x.detail);
  };
  /* R51: the three steps under the title, each done, current or still to do from the question's state */
  function stepsHtml(st) {
    return `<ol class="mk-next" data-steps="1">` + ["source", "mark", "conclude"].map((k, i) => `<li data-step="${k}" data-state="${st[i]}"${st[i] === "current" ? ' aria-current="step"' : ""}>${W("question.steps." + k)}</li>`).join("") + "</ol>";
  }
  /* R59: accepting a reading of several separately sufficient parts opens "Before you accept", one tick per part */
  function acceptPart(v, tone, tag) {
    const parts = Array.isArray(v.parts) ? v.parts.map(String) : [];
    const name = String(v.name), ix = String(vs.findIndex((x) => x && x.name === v.name)) + (tag || "");
    if (parts.length < 2) return cs.act("versionaccept", { label: "act.versionaccept.label.question", data: { version: name, idx: ix }, tone });
    return `<fieldset class="cs-field" id="affirm-${ix}" data-affirm="${cs.esc(name)}"><legend>${W("reading.affirm.head")}</legend><p class="mk-small">${W("reading.affirm.says", { n: String(parts.length) })}</p>`
      + parts.map((pt, i) => `<label><input type="checkbox" name="affirm-${ix}" id="affirm-${ix}-${i}" value="${cs.esc(pt)}"> ${W("reading.affirm.part", { part: pt })}</label>`).join("") + "</fieldset>"
      + cs.act("versionaccept", { label: "reading.affirm.accept", data: { version: name, idx: ix }, tone });
  }
  /* R64: "Reject this reading, with a reason" is a fold holding the required reason and the act that sends it */
  function declineFold(v, tag) {
    const name = String(v.name), ix = String(vs.findIndex((x) => x && x.name === v.name)) + (tag || "");
    return `<details class="mk-details" data-reject="${cs.esc(name)}"><summary>${W("screen.question.reject.summary")}</summary>`
      + cs.field("question-reject-" + ix, "screen.question.reject.reason", { area: true, rec: true, help: "screen.question.reject.reason.help" })
      + cs.act("versionreject", { label: "screen.question.reject.go", data: { version: name, idx: ix } }) + "</details>";
  }
  /* R71: she is a participant of the project the question is in (R60: only she may set it aside for it) */
  const partsRead = project ? later("participants", "projectparticipants", { projectId: project }) : null;
  const joined = !!(partsRead && partsRead.state === "ok" && partsRead.value && Array.isArray(partsRead.value.participants)
    && partsRead.value.participants.some((x) => view.parts.isMe(view, x) && x.state === "joined"));
  /* R71: the project's own decision on this question, read from the set-aside list (`queueFeed` with `aside: true`, `queue`
     R61), paged by `after` until found or the last page */
  let decision = null, asideRead = null;
  if (joined) {
    let after = "";
    for (let pg = 0; pg < 100; pg++) {
      asideRead = later("aside:" + pg, "queue", { aside: "true", limit: "500", ...(after ? { after } : {}) }, String(ui.asideSeq || 0));
      if (asideRead.state !== "ok" || !asideRead.value || !Array.isArray(asideRead.value.aside)) break;
      decision = asideRead.value.aside.find((x) => x && x.scope === "project" && String(x.project) === project && String(x.finding) === id) || null;
      if (decision || !(asideRead.value.truncated && asideRead.value.next)) break;
      after = String(asideRead.value.next);
    }
  }
  const projectWord = projectTitle || T("state.undetermined", { reason: "" });
  /* R71: the choice (nothing preselected), her reason (no writing help) and the act, in the fold and in "Change your decision" alike */
  const asideForm = (which, before) => cs.checks("question-aside" + (which === "2" ? "2" : ""), which === "2" ? "screen.question.say003" : "screen.question.say063",
      [["deferred", "screen.question.say004"], ["dismissed", "screen.question.say005"]], { radio: true })
    + cs.field("question-aside" + (which === "2" ? "2" : "") + "-why", "shell.reason", { area: true, help: which === "2" ? "screen.question.say006" : "screen.question.say064" })
    + (before || "") + cs.act("proposedispose", { label: "act.proposedispose.label.question", data: { which }, tone: "primary" });
  /* R71: what this touches, read before she confirms, from what the screen already reads and only what she may see */
  const touches = () => {
    const backs = d.relies && d.relies.state === "ok" && d.relies.value && Array.isArray(d.relies.value.backlinks) ? d.relies.value.backlinks : [];
    const pl = later("qplans", "plans", { subject: id }, String(ui.plans ? ui.plans.length : 0));
    const planList = (pl.state === "ok" && pl.value && Array.isArray(pl.value.plans) ? pl.value.plans : []).concat(Array.isArray(ui.plans) ? ui.plans : []);
    const seenPlans = new Set();
    const rows = [];
    if (currentName) rows.push(srow("", W("screen.question.say065", { project: projectWord }), "", W("screen.question.say066")));
    for (const pn of planList) {
      const pid = String((pn && (pn.id || pn.plan)) || "");
      if (!pid || seenPlans.has(pid)) continue;
      seenPlans.add(pid);
      rows.push(srow("", W("screen.question.say067", { plan: String(pn.title || T("state.undetermined", { reason: "" })) }), "", W("screen.question.say068")));
    }
    if (backs.some((x) => x && x.from_type === "inquiry")) rows.push(srow("", W("screen.question.say069"), "", W("screen.question.say070")));
    for (const x of backs.filter((y) => y && (y.from_type === "published" || (y.from_type === "case" && y.from_state === "published"))))
      rows.push(srow("", W("screen.question.say071", { title: String(x.from_title || T("state.undetermined", { reason: "" })) }), "", W("screen.question.say072")));
    return rows.length ? `<div data-touches="1"><p class="mk-small"><b data-touches-heading="1">${W("screen.question.touches.heading")}</b></p><p class="mk-small"><b>${W("screen.question.tip078")}</b> ${W("screen.question.tip079")}</p>${cs.sheet(rows.join(""))}</div>` : "";
  };
  /* R71: the fold in state a; the refusals the design holds are told before the act */
  const asideFold = () => `<details class="mk-details" data-aside="set"><summary>${W("screen.question.say058", { project: projectWord })}</summary>`
    + `<p class="mk-note">${W("screen.question.say059", { project: projectWord })} ${W("screen.question.say060")} ${W("screen.question.say061")} ${W("screen.question.say062")}</p>`
    + asideForm("1", touches() + `<details class="mk-details" data-aside="cannot"><summary>${W("screen.question.say073")}</summary>`
      + `<p class="cs-gap" data-gap="refused">${W("screen.question.say074", { project: projectWord })}</p><p class="cs-gap" data-gap="refused">${W("screen.question.say075")}</p></details>`) + "</details>";
  /* R71 states k and l: the receipt, and "Change your decision" (the same choice and a reason that replaces the earlier one) */
  const receipt = (() => {
    if (!decision) return "";
    const by = String(decision.decided_by || "").replace(/^member:/, "");
    const mine = by !== "" && (by === String(view.me && view.me.member) || by === String(view.me && view.me.handle));
    const key = decision.state === "dismissed" ? "screen.question.say008" : "screen.question.say000";
    const said = mine ? W(key, { project: projectWord, date: { html: decision.at ? cs.date(String(decision.at), { year: true }) : "" } })
      : W(key + ".bymember", { project: projectWord, member: whoIs(by), date: { html: decision.at ? cs.date(String(decision.at), { year: true }) : "" } });
    return `<div data-aside="${decision.state === "dismissed" ? "dismissed" : "deferred"}">`
      + cs.sheet(srow("", `<b>${said}</b>`, "", `<b>${W("shell.reason.lead")}</b> <span class="rec">“${cs.esc(String(decision.reason || ""))}”</span>`))
      + `<p class="mk-note">${mine ? W("screen.question.say001", { project: projectWord }) + " " : ""}${W("screen.question.say002")}</p>`
      + `<details class="mk-details" data-aside="change"><summary>${W("screen.question.decision.change")}</summary>${asideForm("2")}</details></div>`;
  })();
  const around = [];
  /* R41 state g: concluded; c: nothing cited; d: a run of hers at work; e: the assistant's proposal; f: its limit */
  /* the conclusion is answered only to a read that names the project (`basis-versions` R12, R16): `cur` when there is one */
  const b = cur && cur.state === "ok" && cur.value ? cur.value : (d.basis && d.basis.state === "ok" ? d.basis.value : null);
  const concluded = !!(b && b.conclusion && b.conclusion_stance !== "withdrawn");
  const member = view.me && view.me.member;
  const runs = view.reachable && member ? later("runs", "airuns", { contextType: "inquiry", contextId: id, limit: "50" }, String(ui.seq || 0)) : null;
  /* R45: the answer stands while the runs are read again (a read in flight is not the run's state) */
  if (runs && runs.state === "ok" && Array.isArray(runs.value.runs)) ui.lastRuns = runs.value.runs;
  const runList = runs && runs.state === "ok" && Array.isArray(runs.value.runs) ? runs.value.runs
    : runs && runs.state === "loading" && Array.isArray(ui.lastRuns) ? ui.lastRuns : [];
  const isMine = (s) => !!(s && member && s.principal && typeof s.principal.plane === "string"
    && (s.principal.plane === "member:" + member || s.principal.plane.startsWith("member:" + member + "/")));
  /* a run of hers at work on it (R47): any running run of hers `airuns` shows, whether this page started it, the dock did,
     or it is found on a fresh load; except a run this page saw opened and then withheld, never drawn at work (R33's rule;
     D29) */
  const myRun = runList.find((s) => s && s.status === "running" && isMine(s) && ui.withheld !== s.id) || null;
  /* R45: from her press until the plane has answered, and until that run is read ended, the run is at work */
  const asked = ui.asking ? runList.find((s) => s && s.id === ui.asking) : null;
  const asking = !!ui.asking && !(asked && asked.status !== "running");
  /* her latest run on it (newest first), and R45's ending: drawn when it has ended and nothing else is drawn from it */
  const lastMine = runList.find(isMine) || null;
  const ending = (c) => (c && typeof c === "object" ? String(c.bound || c.kind || "") : String(c || ""));
  /* R57, R58: the run's session (its cost, to the paying account's owners only) and its log (its steps, as they arrive) */
  const watched = myRun || lastMine;
  const sess = watched && watched.id ? later("sess", "airun", { run: String(watched.id) }, String(myRun ? ui.seq || 0 : "")) : null;
  const session = sess && sess.state === "ok" && sess.value && sess.value.session ? sess.value.session : null;
  const log = watched && watched.id && (myRun || asking || lastMine) ? later("log", "airunlog", { run: String(watched.id), limit: "200" }, String(myRun ? ui.seq || 0 : "")) : null;
  const logEntries = log && log.state === "ok" && log.value && Array.isArray(log.value.entries) ? log.value.entries : [];
  const prog = P.progress(cs, logEntries, { title: (record) => { const t = later("doc:" + record, "image", { id: record });
    const m = t.state === "ok" && t.value && typeof t.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(t.value["bundle.md"].split(/\n---\s*\n/)[0] || "") : null;
    let title = m ? m[1].trim() : ""; try { if (title.startsWith("\"")) title = JSON.parse(title); } catch { /* raw */ } return title; } });
  const endedPart = (withAsk) => lastMine && lastMine.status !== "running" && !myRun && !asking
    ? `<div data-run="ended"><p class="mk-note">${W("screen.assistant.run.ended", { why: { html: P.ending(cs, ending(lastMine.condition) || String(lastMine.status || ""), proposals.length > 0) } })}</p>`
      + (ending(lastMine.condition) === "cancelled" || lastMine.status === "cancelled" ? `<p class="mk-small" data-run="stopped">${W("screen.question.stopped.kept")}</p>` : "")
      + P.costLine(cs, session, true) + (withAsk ? askAct : "") + "</div>" : "";
  const pack = view.reachable ? later("pack", "agentpack", {}) : null;
  const packName = pack && pack.state === "ok" && pack.value && ((pack.value.pack && (pack.value.pack.version || pack.value.pack.skillVersion)) || pack.value.version);
  const askAct = view.reachable && packName && member
    ? cs.act("airunopen", { label: "act.airunopen.label.question", data: { pack: String(packName) } }) : "";

  /* R110: "Cite another team's finding": chosen among the findings the team accepted and the question does not yet rest on, with the
     role it plays and an optional note; nothing is drawn when the team holds no import (R20), and a failed read is drawn failed */
  const importCite = () => {
    if (d.imports && d.imports.state === "empty") return "";
    const have = new Set(citedLegs.map((l) => String(l.target)));
    const choices = acceptedFindings.filter((x) => !have.has(x.ref));
    const inner = cs.state("imports", view, () => (!choices.length ? "" : cs.choice("question-imp-finding", "act.owed_citeimported.label.question",
        [{ value: "", text: "" }].concat(choices.map((c) => ({ value: c.import + "|" + c.edition + "|" + c.finding, text: c.title + (c.group ? " · " + c.group : "") }))), {})
      + cs.checks("question-imp-role", { key: "screen.imported.citeimp.role" }, [["supports", "screen.imported.citeimp.role.supports", false], ["cuts_against", "screen.imported.citeimp.role.cuts", false]], { radio: true })
      + cs.field("question-imp-note", "screen.imported.citeimp.note")
      + `<div class="mk-acts">${cs.act("citeimported", { label: "act.owed_citeimported.label.question", tone: "primary" })}</div>`
      + `<p class="mk-small">${W("screen.imported.citeimp.inherit1")} ${W("screen.imported.citeimp.inherit2")}</p>`));
    return inner ? cs.sec("act.owed_citeimported.label.question", inner, { help: "screen.imported.citeimp.tip", id: "cite-imported" }) : "";
  };

  /* what it waits on: a document set aside, with who and why; restore it with a reason, or find another source. inquiry R58 (K5130): the set-aside waits are
     `questionwaits`' `document_waits` (`{document, by, reason, at}`, the document set aside by the stamp `member:<id>`), beside the dated waits (`waits`), and its
     `history` holds every set-aside and restore recorded with the question, in order (`{document, act: set_aside | restore, reason, by, at}`), a restore beside
     the set-aside it undid; both acts stay. A document's name is its title, as its own record states it, never its id (R39) */
  const waitsPart = () => {
    if (d.waits && d.waits.state === "empty") return "";
    const inner = cs.state("waits", view, (v) => {
      const dated = Array.isArray(v) ? v : (v.waits || v.items || []);
      const aside = Array.isArray(v.document_waits) ? v.document_waits : [];
      const history = Array.isArray(v.history) ? v.history.filter((h) => h && h.document) : [];
      const docName = (docId) => {
        const im = docId ? later("wdoc:" + docId, "image", { id: String(docId) }) : null;
        const f = im && im.state === "ok" && im.value && typeof im.value["bundle.md"] === "string" ? view.parts.front(im.value["bundle.md"]) : null;
        return f && f.title ? String(f.title) : T("state.undetermined", { reason: "" });
      };
      const asideRows = aside.map((x, i) => {
        const by = whoIs(x.by || x.setter || "");
        const doc2 = x.document || "";
        /* C81 (R5): the status line is its own element and the acts follow it as a group the stylesheet wraps and stacks at 390 px; they were
           the inline flex line's own items, squeezed to 44 px wide and 300 px tall */
        return `<div data-wait="aside" data-wait-document="${cs.esc(String(doc2))}"><p class="cs-wait">${W("screen.question.waits.setaside", { document: docName(doc2), who: by, reason: x.reason || "" })}`
          + (x.at ? `<span class="mk-small">${W("screen.question.waits.since", { who: by, date: { html: cs.date(String(x.at), { year: false }) } })}</span>` : "")
          + `</p><span class="mk-acts">` + (doc2 ? cs.act("heldrestore", { label: "act.heldrestore.label.question", data: { doc: doc2 } }) : "")
          + cs.act("search", { label: "act.search.label.question", data: { q: heading } }) + "</span></div>";
      }).join("");
      const datedRows = dated.map((x, i) => {
        const by = whoIs(x.setter || x.by || x.handle || "");
        const doc2 = x.document || x.bundle_id || x.capture || "";
        const said = doc2 && x.reason !== undefined
          ? W("screen.question.waits.setaside", { document: x.title || docName(doc2), who: by, reason: x.reason || "" })
          : W("screen.question.waits.item", { text: x.text || x.what || "" });
        return `<div data-wait="${i}"><p class="cs-wait">${said}`
          + (x.date || x.at ? `<span class="mk-small">${W("screen.question.waits.since", { who: by, date: { html: cs.date(String(x.date || x.at), { year: false }) } })}</span>` : "")
          + `</p><span class="mk-acts">` + (doc2 ? cs.act("heldrestore", { label: "act.heldrestore.label.question", data: { doc: doc2 } }) : "")
          + cs.act("search", { label: "act.search.label.question", data: { q: heading } }) + "</span></div>";
      }).join("");
      const log = history.length ? `<div data-wait="history">` + history.map((h) => `<p class="mk-small" data-history-act="${cs.esc(String(h.act || ""))}">`
        + `<b class="rec">${cs.esc(docName(h.document))}</b> · ${h.act === "restore" ? cs.w("act.heldrestore.label.held") : cs.w("screen.held.setaside")} · ${cs.esc(whoIs(h.by || ""))}`
        + (h.at ? " · " + cs.date(String(h.at), { year: false }) : "") + (h.reason ? ` · <span class="rec">“${cs.esc(String(h.reason))}”</span>` : "") + "</p>").join("") + "</div>" : "";
      return asideRows + datedRows + log;
    });
    return inner ? cs.sec("screen.question.waits.head", inner) : "";
  };
  const proposals = view.reachable ? vs.filter((v) => machine(v) && v.state === "suggested" && !v.hidden) : [];
  if (!citedLegs.length && !myRun && !asking && !concluded) {
    /* state c: new and empty, the three ways in (R38: "Capture a document for it" opens `capture` with this question) */
    const rows = [srow("", `<b>${W("question.empty.capture")}</b><br><span class="mk-sub">${W("question.empty.capture.line")}</span>`,
        `<a class="cs-btn" data-tone="primary" href="/app/capture/address/${cs.esc(id)}" data-nav data-adddoc="question">${W("question.adddoc")}</a>`),
      srow("", `<b>${W("question.empty.find")}</b><br><span class="mk-sub">${W("question.empty.find.line")}</span>`,
        cs.act("search", { label: "act.search.label.question", data: { q: heading } }))];
    if (askAct) rows.push(srow("", `<b>${W("question.empty.ask")}</b><br><span class="mk-sub">${W("question.empty.ask.line")}</span>`, askAct));
    /* R45: a run of hers that ended with no proposal is said, above the three ways in (which offer the ask again) */
    out.push(cs.sec("question.empty.heading", endedPart(false) + `<p class="mk-note">${W("question.empty.note")}</p>` + cs.sheet(rows.join("")), { id: "state-c" }));
    /* R50, R51: nothing to conclude on before the first citation, said beneath the three ways; no "Concluding" section */
    out.push(`<p class="mk-note" data-owed="reading">${W("question.empty.conclude.own")}</p>`);
    out.push(importCite());
    /* R2: what a question waits on is drawn before any citation too: a copy set aside for it is restored from here */
    out.push(waitsPart());
    out[stepsAt] = stepsHtml(["current", "todo", "todo"]) + receipt;
    if (ui.said) out.push(ui.said.html);
    out.push(limitPart());
    return out.join("");
  }
  /* state d: a run of hers at work on it, from her press (R45): its ticks once it is read, read again every 10 seconds on
     the page clock (as the dock does, R8), Stop the run once the plane has answered */
  if (myRun || asking) {
    out.push(cs.sec("question.run.heading", `<div class="cs-machinework" data-origin="machine">${cs.mark("origin", "machine")}</div>`
      + (myRun ? `<p data-run="running">${W("screen.assistant.run.running", { ticks: String(myRun.ticks || 1) })}</p>` : "")
      + (myRun ? P.costLine(cs, session, false) : "")
      + prog.html
      + `<p class="mk-note">${W("question.run.leave")}</p>`
      + (myRun ? cs.act("airunclose", { label: "act.airunclose.label.question", data: { run: String(myRun.id || "") } })
        : `<button class="cs-btn" data-tone="quiet" disabled data-pending="airunclose">${W("act.airunclose.label.question")}</button>`), { id: "state-d" }));
    if (myRun && runs && runs.state === "ok" && !ui.polling) {
      ui.polling = true;
      cs.later(10000, (k, v) => { v.ui.polling = false; k.set("seq", (v.ui.seq || 0) + 1); });
    }
  } else if (!concluded) out.push(endedPart(true)); /* R47: above the proposals, whether or not any wait */
  /* state e: a reading the assistant proposed, not yet weighed, only while the assistant is reachable */
  const checkFailed = !myRun && !asking && lastMine && prog.none;
  if (checkFailed) out.push(`<p class="mk-note" data-check="failed">${W("ai.progress.check.failed")}</p>`);
  for (const v of (myRun || asking || checkFailed ? [] : proposals)) {
    const rests = (Array.isArray(v.legs) ? v.legs : []).map((l) => String(l.target_title || l.target_id || "")).filter(Boolean);
    out.push(cs.sec("question.proposal.heading", `<div class="cs-machinework" data-origin="machine">${cs.mark("origin", "machine")}`
      + (v.untested || (b && b.untested) ? `<span class="cs-draftlabel" data-label="untested">${W("ai.label.untested")}</span>` : "")
      + `<p class="rec">${cs.esc(String(v.claim && v.claim.text ? v.claim.text : v.description || v.name))}</p>`
      + (rests.length ? `<p class="mk-small rec">${cs.esc(rests.join(" · "))}</p>` : "") + "</div>"
      + `<p class="mk-small" data-checked="all" data-tip="${cs.esc(W("ai.progress.checked.all.means"))}">${W("ai.progress.checked.all")}</p>`
      + acceptPart(v, "primary") + declineFold(v), { id: "state-e" }));
  }
  /* state f: the assistant's limit, and the other reasons it can't work here (R42) */
  out.push(limitPart());
  function limitPart() {
    const f = ui.limit;
    if (!f) return "";
    return cs.sec("question.empty.ask", `<p class="cs-gap" data-gap="refused" role="alert">${W("ai.refused.limit.overall", { whose: f.whose || "", period: f.period || "", when: f.when || "" })}</p>`
      + `<p class="mk-note">${W("question.limit.note")}</p>`
      + `<details class="mk-details" data-reasons="question"><summary>${W("question.ai.other")}</summary>`
      + (f.reasons || []).map((k) => `<p class="mk-small">${W(k)}</p>`).join("") + `<p class="mk-small">${W("question.ai.whose")}</p></details>`, { id: "state-f" });
  }

  /* state g: concluded (who, when, the reading's words, what would change it, its strength), and its three acts (R62): prepare a
     case from it, plan what to do, withdraw the conclusion */
  if (concluded) {
    const c = b.conclusion;
    const claim = typeof c === "string" ? c : (c.text || (c.claim && c.claim.text) || (typeof c.claim === "string" ? c.claim : "") || "");
    const by = whoIs(c.by || c.author || "");
    const at = c.at ? cs.date(String(c.at), { year: true }) : "";
    const fal = c.falsifier && typeof c.falsifier === "object" ? c.falsifier.text : c.falsifier;
    /* R50: a conclusion on a member's own reading says who wrote it, never marked machine work */
    const cv = vs.find((v) => v && v.name === String(c.version || c.reading || ""));
    const wrote = cv && !machine(cv) && cv.author ? `<br><span class="mk-sub" data-reading="member">${W("question.reading.by.member", { member: whoIs(cv.author) })}</span>` : "";
    out.push(cs.sec("question.concluded.heading", cs.sheet(srow("", `<b>${W("question.concluded.by", { who: by, date: { html: at } })}</b> <span class="rec">“${cs.esc(claim)}”</span>`
        + wrote + (fal ? `<br><span class="mk-sub">${W("question.concluded.falsifier", { falsifier: String(fal) })}</span>` : "")
        + (d.strength && d.strength.state === "ok" ? `<br>${grades(d.strength.value)}` : "")))
      + (project ? cs.act("casedraft", { label: "act.casedraft.label.question", data: { project }, tone: "primary" }) : "")
      + cs.field("question-plan", "screen.question.plan.label", {}) + cs.act("planopen", { label: "act.planopen.label.question", data: { inquiry: id } })
      + cs.act("withdrawconclusion", { label: "act.withdrawconclusion.label.question", data: { inquiry: id } }), { id: "state-g" }));
  }

  /* R104, R62: "Reopen this finding, with a reason": the way to a correction; the reason required; the docket where the next edition is
     started. A finding concluded within a project (its own state still open: the conclusion is a row of the project's) is reopened by
     withdrawing that conclusion (`withdrawconclusion`, with the project); the state move (`reopen`) is for a question whose own state is
     concluded or a disposition. An open, unconcluded question draws neither. */
  {
    const ownState = String(doc.current_state || "");
    const ownMovable = ownState === "concluded" || ownState === "deferred" || ownState === "dismissed";
    const viaWithdraw = !ownMovable && concluded && !!project;
    if (ownMovable || viaWithdraw) {
      const pub = d.relies && d.relies.state === "ok" && d.relies.value && Array.isArray(d.relies.value.backlinks)
        ? d.relies.value.backlinks.find((x) => x && (x.from_type === "published" || (x.from_type === "case" && x.from_state === "published"))) : null;
      out.push(`<details class="mk-details" data-reopen="${viaWithdraw ? "withdraw" : "state"}"><summary>${W("screen.question.reopen.summary")}</summary>`
        + `<p class="mk-small">${W("screen.question.reopen.what")} ${W("screen.question.reopen.case")} ${W("screen.question.reopen.kept")}</p>`
        + cs.field("question-reopen-why", "screen.question.reopen.why", { rec: true, help: "screen.question.reopen.why.help" })
        + cs.act("reopen", { label: "act.reopen.label.question", data: { inquiry: id, route: viaWithdraw ? "withdraw" : "state", project: viaWithdraw ? project : "" } })
        + `<p class="mk-small">${W("screen.question.reopen.next")}${pub ? " " + W("screen.question.reopen.next.link", { link: { html: cs.ref("docket", String(pub.from), T("screen.question.reopen.next.link.text"), [T("shell.card.docket")]) } }) : ""}</p>`
        + `<details class="mk-details"><summary>${W("screen.question.reopen.refused.summary")}</summary><div style="display:grid;gap:6px">`
        + ["noreason", "badreason", "notsetdown"].map((k) => `<p class="cs-gap" data-gap="refused">${W("screen.question.reopen.refused." + k)}</p>`).join("") + "</div></details></details>");
    }
  }

  /* two grades, never one score (R2); a grade's strength sentence is drawn by its words (R34), never raw grade text */
  function axes(s, loud) {
    const axis = (a) => (s[a] && s[a].state === "graded" ? cs.grade(a, s[a].grade)
      : cs.mark("gap", s[a] && s[a].state === "undetermined" ? "undetermined" : "unrated", { reason: axisReason(a, s[a], loud) }));
    const parts = [axis("capture"), axis("connection")];
    if (s.testimony && s.testimony.state === "graded") parts.push(axis("testimony"));
    return parts.join("");
  }
  function grades(s) { return `<span class="cs-strength">${axes(s)}</span>`; }
  const strengthText = (s) => (s && typeof s === "object" ? ["capture", "connection"].map((a) => (s[a] && s[a].grade) || "?").join("/") : String(s || ""));

  /* R23: what each passage carries: one choice per cited passage, the passages that would hold it up, the read-back,
     and "Save the answers"; drawn as state b, and (R24) inside "Change what a passage carries…" */
  const live1 = supports.filter(live);
  /* R139 (T51 fix round 10; DEC-439; C-M5): the "Yes, because of" answers the last save set aside because they named a passage answered "No" (`ui.setAside`, each
     `{yes, no}` by passage number, counted from one as the list draws them): `screen.question.yes.setaside` beneath the passage that said "Yes" and again with the read-back */
  const setAside = Array.isArray(ui.setAside) ? ui.setAside.filter((e) => e && Number.isInteger(e.yes) && Number.isInteger(e.no)) : [];
  const asideLines = (yes) => setAside.filter((e) => e.yes === yes).map((e) => `<p class="mk-small" data-set-aside="${e.no}">${W("screen.question.yes.setaside", { n: String(e.no) })}</p>`).join("");
  const askForm = (regroup) => {
    const asks = live1.map((l, at) => {
      const others = live1.filter((o) => o.ord !== l.ord);
      return `<div class="mk-ev" data-ask="${l.ord}"><span class="rec">${cs.esc(legName(l))}</span>`
        + cs.checks("ask-" + l.ord, "question.ask", [["no", "question.ask.no"], ["yes", "question.ask.yes"]], { radio: true })
        + (others.length ? `<fieldset class="cs-field" id="ask-which-${l.ord}"><legend>${W("question.ask.which")}</legend>`
          + others.map((o, i) => `<label><input type="checkbox" name="ask-which-${l.ord}" id="ask-which-${l.ord}-${i}" value="${o.ord}"> ${cs.esc(legName(o))}</label>`).join("") + "</fieldset>" : "")
        + asideLines(at + 1) + "</div>";
    }).join("");
    /* the read-back as saved now: until the member saves, every passage is one the answer cannot do without */
    const readback = `<div class="cs-sheet" data-readback="ask"><b>${W("question.rests.any")}</b>`
      + live1.map((l) => `<br><span class="mk-small">· ${cs.esc(legName(l))}</span>`).join("") + `<br><span class="mk-small">${W("question.rests.readback")}</span></div>`;
    return `<div class="mk-versions">${asks}</div>` + readback
      + cs.act("inquiryground", { label: "act.inquiryground.label.question", data: { inquiry: id, regroup: regroup ? "1" : "" }, tone: "primary" });
  };
  if (live1.length && partPending) {
    out.push(cs.state(d.partition, () => ""));
  } else if (live1.length && !partitioned) {
    out.push(`<div class="cs-sheet" data-state="ask"><b>${W("question.ask.first.title")}</b><p class="mk-small">${W("question.ask.first.says")}</p></div>`);
    out.push(cs.sec("question.ask.title", askForm(false), { help: "question.ask.help", id: "state-b" }));
  } else if (supports.length) {
    /* state a: the strength against the bar, the weakest part and what would raise it */
    const bar = d.inquiry.state !== "loading" ? later("bar", "strengthbarof", project ? { project } : {}) : { state: "loading" };
    const barOf = bar.state === "ok" && bar.value && bar.value.bar && (bar.value.bar.capture || bar.value.bar.connection)
      && (project ? bar.value.bar.declared !== false : true) ? bar.value.bar : null;
    const rank = { A: 4, B: 3, C: 2, D: 1 };
    out.push(cs.sec("screen.question.strength.head", cs.state("strength", view, (s) => {
      let phrase = W("screen.question.strength.nobar");
      if (barOf) {
        const short = ["capture", "connection"].filter((a) => barOf[a] && !(s[a] && s[a].state === "graded" && rank[s[a].grade] >= rank[barOf[a]]));
        phrase = W("screen.question.strength.against", { capture: barOf.capture || "", connection: barOf.connection || "" })
          + " · " + (short.length ? W("screen.question.strength.short") + " " + short.map((a) => W("mark.scale." + a + ".name")).join(", ")
                                  : W("screen.question.strength.meets"));
      }
      const weak = ["capture", "connection"].map((a) => s[a] && s[a].weakest).filter(Boolean)[0];
      const weakId = weak && typeof weak === "object" ? String(weak.target_id || weak.target || "") : "";
      const weakText = sev.has(weakId) ? "" : weak && typeof weak === "object" ? (weak.title || (weakId ? titleOf(weakId) || T("shell.card.document") : weak.detail) || "") : weak;
      const raise = ["capture", "connection"].map((a) => s[a] && s[a].state === "graded" && axisReason(a, s[a], true)).filter(Boolean)[0];
      /* R89, R116: the legs the reading leaves out, once, by their titles (or, with no titles to name, their count), unless an unrated
         axis's sentence has named them already; and the hunches it left out, each only above zero (R20) */
      const ungradedIds = Array.isArray(s.ungraded) ? s.ungraded.map((m) => String(m && typeof m === "object" ? m.target_id || m.target : m)).filter((i) => !sev.has(i)) : [];
      /* strength R6 (K4259): `ungraded` is the legs inert on every axis, one entry each; a leg graded on one axis is inert on the others and is not left out, so the owner's list stands alone */
      const out1 = Array.isArray(s.ungraded) ? [...new Set(ungradedIds)]
        : [...new Set(["capture", "connection", "testimony"].flatMap((a) => nlbIds(s[a])).concat(ungradedIds))];
      const nOut = Math.max(out1.length, Array.isArray(s.ungraded) ? ungradedIds.length : Number(s.ungraded) || 0);
      const namedAlready = ["capture", "connection", "testimony"].some((a) => s[a] && s[a].state === "unrated" && nlbIds(s[a]).length);
      const nHunch = Number(s.hunches_left_out) || 0;
      return `<div class="mk-strengthbox"><span class="cs-strength">${axes(s, true)}<span class="phrase">${phrase}</span></span>`
        + `<p class="mk-note">${W("screen.question.strength.two")}</p>`
        + (weakText ? `<p>${W("screen.question.strength.weakest", { weakest: String(weakText) })}</p>` : "")
        + (raise ? `<p>${W("screen.question.strength.raise", { raise: String(raise) })}</p>` : "")
        + (nOut > 0 && !namedAlready ? `<p class="mk-small" data-strength="ungraded" data-count="${nOut}">${W("strength.arithmetic.present_and_not_yet_load_bearing", { legs: out1.length ? nameLegs(out1) : String(nOut) })}</p>` : "")
        + (nHunch > 0 ? `<p class="mk-small" data-strength="hunches" data-count="${nHunch}"><b>${nHunch}</b> ${W("strength.hunch_why")}</p>` : "")
        + ["capture", "connection"].filter((a) => s[a] && s[a].state === "undetermined")
            .map((a) => cs.mark("gap", "undetermined", { reason: axisReason(a, s[a], true) })).join("") + "</div>";
    }), { help: "mark.strength.means" }));
  }

  out.push(waitsPart());

  /* the partition as the inquiry holds it (R23, R24): each ground's legs; a leg with no ground is a part of its own */
  const parts = [];
  if (partitioned) {
    const byGround = new Map();
    for (const l of supports.filter(live)) {
      const g = l.ground ? String(l.ground) : "#" + l.ord;
      if (!byGround.has(g)) byGround.set(g, []);
      byGround.get(g).push(l);
    }
    for (const [label, ls] of byGround) parts.push({ label, legs: ls });
  }
  const partOf = (l) => parts.find((p) => p.legs.some((x) => x.ord === l.ord)) || null;

  /* R139 (T51 fix round 10; DEC-439; D-M1, C-M4; citation R24): "What this passage earns", a fold on a cited document passage: how well the copy the team holds shows
     it, up to the most the record allows (the ceiling `earnedbasis` answers for the document, `leg-earning` R1: a letter, offered and no stronger one) and why, sent
     as `leggrade` with the leg's part. Drawn only where the screen carries the act (`view.parts.leggrade`: the registry admits it), for a live document leg that holds no grade
     on another axis and whose ceiling the record states; the read is asked only then. */
  const GRADES = ["A", "B", "C", "D"];
  const earnedRead = view.parts.leggrade ? later("earned", "earnedbasis", { id }) : null;
  const ceilingOf = (target) => {
    const c = earnedRead && earnedRead.state === "ok" && earnedRead.value && earnedRead.value.earned && earnedRead.value.earned.capture ? earnedRead.value.earned.capture[target] : null;
    return c && c.mode === "ceiling" && GRADES.includes(c.grade) ? c.grade : "";
  };
  const gradeFold = (l, target) => {
    if (!earnedRead || !l || l.fromRef || impRef(target) || !live(l)) return "";
    const axis = String(l.grade_axis || "");
    if (legGrade(l) && axis && axis !== "capture") return "";
    const ceiling = ceilingOf(target);
    if (!ceiling) return "";
    const act = cs.act("leggrade", { label: "screen.question.leggrade.act", data: { target, ord: String(l.ord) } });
    if (!act) return "";
    return `<details class="mk-details" data-leggrade="${l.ord}"><summary>${W("screen.question.leggrade.head")}</summary><p class="mk-small">${W("screen.question.leggrade.help", { ceiling })}</p>`
      + cs.checks("question-leggrade-" + l.ord, "", GRADES.slice(GRADES.indexOf(ceiling)).map((g) => ({ value: g, text: g })), { radio: true })
      + cs.field("question-leggrade-why-" + l.ord, "shell.reason", { area: true, rec: true }) + act + "</details>";
  };

  /* Supports (R34): every passage the question cites, from its own legs; R25's chooser; R23's line beneath each; R12 */
  const legRow = (l, role) => {
    const g = legGrade(l);
    const scale = l.grade_axis || l.scale || (role === "cuts_against" && l.testimony ? "testimony" : role === "cuts_against" && /testimony/.test(String(l.grade_axis || "")) ? "testimony" : "capture");
    const target = String(l.target);
    const ref = refOf(target);
    const status = statusOf(l);
    const severed = status === "severed";
    const why = severed ? (() => {
      const m = /(?:^|\|\s*)Severed (\S+): ([^|]*)$/.exec(String((ref && (ref.note || ref.reason)) || "").trim());
      return m ? m[2].trim() : String((ref && ref.reason) || "");
    })() : "";
    const isLive = status === "confirmed" || status === "proposed" || status === "active";
    const part = role === "supports" && partitioned && !severed ? partOf(l) : null;
    const others = part ? part.legs.filter((x) => x.ord !== l.ord).map(legNameWords) : [];
    /* C37 (R2): each part of the row is its own element, set off from the one before it by a break, so none runs into the next */
    const line = part ? `<br><span class="mk-small" data-carries="${others.length ? "holds" : "falls"}">${others.length
      ? W("question.holds", { others: others.join(", ") }) : W("question.falls")}</span>` : "";
    return srow(g ? cs.grade(scale === "testimony" ? "testimony" : "capture", g) : "",
      /* the passage by its own words where the inquiry or the reading shown holds them (K3402) */
      ((() => { const r = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === target) : null;
        const words = clip(wordsOf(l, r)); return words ? `<span class="rec" data-leg-words="1">“${cs.esc(words)}”</span><br>` : ""; })())
      + `<span class="mk-small">${impRef(target) ? `<span class="rec" data-imported="1">${cs.esc(legTitle(l))}</span>` : cs.ref("document", target, legTitle(l), [legTitle(l)])}${whereOf(l) ? " · " + whereOf(l) : ""}`
      + (severed ? ` · <span data-leg="severed">${why ? W("screen.question.leg.severed.why", { why }) : W("screen.question.leg.severed")}</span>` : "") + "</span>" + line + gradeFold(l, target),
      (() => {
        /* R87: "Narrow the question" on a live leg of the reading shown, keyed by that reading's own ordinal for it */
        const rv = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.target_id || x.target) === target) : null;
        const narrowAct = isLive && rv && rv.ord !== undefined && rv.ord !== null && shownName
          ? cs.act("narrow", { label: "act.narrow.label.question", tone: "quiet", data: { ord: String(rv.ord), version: shownName, step: "list" } }) : "";
        /* R110: "Take it back" is offered on a leg on another team's finding only (`sever` takes a document's edge) */
        const imp = impRef(target);
        const first = imp ? cs.act("withdrawimported", { label: "act.owed_withdrawimported.label.question", tone: "quiet", data: { import: imp[1], finding: imp[2] } })
          : isLive ? cs.act("sever", { label: "act.sever.label.question", data: { target } })
          /* R139 (DEC-439; C-M6; citation R23): beside Reinstate, "Put it on the other side": reinstated as cutting against where it supported, as supporting where it cut against */
          : severed ? cs.checks("question-reinstate-side-" + l.ord, "", [["other", "screen.question.reinstate.otherside", false]])
            + `<p class="mk-small">${W("screen.question.reinstate.otherside.help")}</p>` + cs.act("reinstate", { label: "act.reinstate.label.question", data: { target, ord: String(l.ord) } }) : "";
        /* R120 (B411, H1): the group the shell's stylesheet wraps and stacks at 390 px */
        return first || narrowAct ? `<span class="mk-acts">${first}${narrowAct}</span>` : "";
      })());
  };
  const chooser = vs.length ? cs.choice("question-reading", "question.reading.shown",
    /* T51 fix round 10 (D-M6): a reading is named by what it says, its description; the name is the value the chooser sends */
    vs.filter((v) => !v.hidden && v.state !== "rejected").map((v) => ({ value: String(v.name), text: clip(v.description, 120) || String(v.name) })),
    /* the chooser drives only once the project's reading is known, so its default (the reading the project stands on) is not kept from a pending read */
    cur && cur.state === "loading" ? { value: shownName } : { value: shownName, acts: {} }) + `<p class="mk-small">${W("question.reading.shown.help")}</p>` : "";
  let restsBack = "";
  if (partitioned) {
    /* R24: the read-back, the shared origins, who set it and every later change */
    const singles = parts.filter((p) => p.legs.length === 1), many = parts.filter((p) => p.legs.length > 1);
    const ind = !readingSettled ? { state: "loading" } : later("independence", "partitionindependence", shownName ? { id, version: shownName }
      : { id, partition: JSON.stringify(citedLegs.reduce((acc, l) => { const p = partOf(l); const k = p ? p.label : "#" + l.ord; if (!acc.keys.includes(k)) { acc.keys.push(k); acc.list.push([]); } acc.list[acc.keys.indexOf(k)].push(l.ord); return acc; }, { keys: [], list: [] }).list) }, String(ui.legSeq || 0));
    const iv = ind.state === "ok" && ind.value && ind.value.independence ? ind.value.independence : null;
    const nameOfPart = (x) => {
      if (typeof x === "number" && parts[x]) return parts[x].legs.map(legName).join(", ");
      const p = parts.find((q) => q.label === String(x));
      return p ? p.legs.map(legName).join(", ") : String(x);
    };
    const shared = iv && Array.isArray(iv.shared) ? iv.shared.map((s) => {
      const t = Array.isArray(s.through) && s.through.length ? String(s.through[0]) : "";
      const origin = /^undetermined:/.test(t) ? T("state.undetermined", { reason: t.replace(/^undetermined:/, "") }) : t.replace(/^\w+:/, "");
      return `<p class="mk-small" data-origin-shared="${cs.esc(t)}">${W("question.origin.shared", { passages: nameOfPart(s.a) + ", " + nameOfPart(s.b), origin })}</p>`;
    }).join("") : "";
    /* R54: who set it and every later change come from `inquirypartition` (`inquiry` R65); a `strength_after` of null is said as
       not recorded, never computed */
    const pc = d.partition && d.partition.state === "ok" && d.partition.value && d.partition.value.ok !== false ? d.partition.value : null;
    const set = pc && Array.isArray(pc.groups) && pc.groups[0] ? pc.groups[0] : grounds[0] || {};
    const pair = (x) => (x && typeof x === "object" ? strengthText(x).replace(/\?/g, "").replace(/\//g, "/") : "");
    const changes = pc && Array.isArray(pc.changes) ? pc.changes.filter((e) => e && e.act === "restructured")
      : doc.log.filter((e) => e.act === "Restructured");
    const now = pc && pc.strength_now ? pair(pc.strength_now) : d.strength && d.strength.state === "ok" ? strengthText(d.strength.value) : "";
    const strengthOf = (x) => (typeof x === "string" ? x : x && typeof x === "object" ? pair(x) : { html: cs.mark("gap", "undetermined", { reason: "" }) });
    restsBack = cs.sec("question.rests.title",
      (singles.length ? `<p><b>${W("question.rests.any")}</b></p>` + singles.map((p) => `<p class="mk-small">· ${cs.esc(legNameWords(p.legs[0]))}</p>`).join("") : "")
      + many.map((p) => `<p class="mk-small">${W("question.rests.all", { passages: p.legs.map(legNameWords).join(", ") })}</p>`).join("")
      + shared + (iv && iv.complete === false ? `<p class="mk-small" data-complete="false">${cs.mark("gap", "undetermined", { reason: "" })}</p>` : "")
      + (d.partition && d.partition.state === "failed" ? cs.state(d.partition, () => "") : "")
      + (set.asserted_by || set.at ? `<p class="mk-small">${W("question.rests.set", { who: whoIs(set.asserted_by || ""), date: { html: set.at ? cs.date(String(set.at), { year: true }) : "" } })}</p>` : "")
      + changes.map((e, i) => `<p class="mk-small" data-change="${i}">${pc ? W("question.rests.changed", { who: whoIs(e.by || ""), date: { html: cs.date(e.at, { year: true }) }, reason: String(e.reason || ""),
          before: strengthOf(e.strength_before), after: e.strength_after === null || e.strength_after === undefined ? strengthOf(null) : strengthOf(e.strength_after) })
        : W("question.rests.changed", { who: whoIs(e.who), date: { html: cs.date(e.at, { year: true }) },
          reason: e.reason, before: e.before.replace(/capture |connection |testimony /g, ""), after: changes[i + 1] ? changes[i + 1].before.replace(/capture |connection |testimony /g, "") : now })}</p>`).join("")
      /* R139: the answers the last save set aside, named by the passage that said "Yes" */
      + setAside.map((e) => `<p class="mk-small" data-set-aside="${e.no}"><span class="rec">${cs.esc(live1[e.yes - 1] ? legName(live1[e.yes - 1]) : "")}</span> \u00b7 ${W("screen.question.yes.setaside", { n: String(e.no) })}</p>`).join("")
      /* "Change what a passage carries…" reopens R23's questions in place; the save carries her reason (NO_REASON) */
      + `<details class="mk-details" data-regroup="1"><summary>${W("question.rests.change")}</summary>`
      + `<p class="mk-small">${W("question.ask.title")}</p>` + askForm(true) + "</details>");
  }
  const supportsRows = supports.length ? cs.sheet(supports.map((l) => legRow(l, "supports")).join("")) : "";
  /* R87: the parts the record proposes for one cited passage (machine work, a proposal only), and the choice of one with the name
     and reason of the narrower reading it makes */
  const nz = ui.narrowing && ui.narrowing.version === shownName ? ui.narrowing : null;
  const narrowPanel = nz ? (() => {
    const rl = shown && Array.isArray(shown.legs) ? shown.legs.find((x) => String(x.ord) === String(nz.ord)) : null;
    const cands = Array.isArray(nz.candidates) ? nz.candidates : [];
    const head = `<b>${W("act.narrow.label.question")}</b>${rl ? ` <span class="mk-small rec">${cs.esc(legTitle({ target: String(rl.target_id || rl.target) }))}</span>` : ""}`;
    if (nz.state === "loading") return `<div class="cs-sheet" data-narrow="panel">${head}<p class="mk-small">${W("state.loading")}</p></div>`;
    if (nz.state === "failed") return `<div class="cs-sheet" data-narrow="panel">${head}<p class="cs-gap" data-gap="refused" role="alert">${nz.words ? cs.esc(nz.words) : W("state.failed", { reason: "" })}</p></div>`;
    return `<div class="cs-sheet" data-narrow="panel">${head}<div class="cs-machinework" data-origin="machine">${cs.mark("origin", "machine")}`
      + (cands.length ? cs.checks("question-narrow-part", "act.narrow.label.question",
          cands.map((c, i) => ({ value: String(i), text: String(c.label || c.ref || c.content_id || "") + (c.label && c.ref ? " · " + c.ref : "") })), { radio: true })
        : `<p class="mk-small">${nz.absence ? cs.esc(nz.absence) : ""}</p>`) + "</div>"
      + cs.field("question-narrow-name", "screen.question.narrow.name", {})
      + cs.field("question-narrow-description", "screen.question.narrow.description", { area: true, rec: true })
      + cs.act("narrow", { label: "act.narrow.label.question", data: { ord: String(nz.ord), version: String(nz.version), step: "send" } }) + "</div>";
  })() : "";
  out.push(cs.sec("screen.question.supports.head", chooser + supportsRows + narrowPanel
    + `<p class="mk-small">${W("screen.question.cite.from")}</p>`
    + cs.act("cite", { label: "act.cite.label.question", data: { inquiry: id, q: heading }, tone: "primary" })
    /* R38: "Add a document" opens `capture` with this question as its subject */
    + ` <a class="cs-btn" data-tone="quiet" href="/app/capture/address/${cs.esc(id)}" data-nav data-adddoc="question">${W("question.adddoc")}</a>`));
  if (restsBack) out.push(restsBack);
  out.push(importCite());
  const against = citedLegs.filter((l) => l.role === "cuts_against");
  if (against.length) out.push(cs.sec("screen.question.against.head", cs.sheet(against.map((l) => legRow(l, "cuts_against")).join(""))));

  /* hunches: a member's suspicion, labeled, never evidence (mark.hunch). R101: any member who sees the question revises or takes
     one back, each with her reason; every change stays on the record, its history drawn. R88: a hunch is about something (K4203) */
  const hunchKind = Object.hasOwn(ui, "hunchKind") ? ui.hunchKind : "other";
  const hunchDocs = [...new Set(citedLegs.filter(live).filter((l) => !impRef(l.target)).map((l) => String(l.target)))];
  const hunchEnd = (x) => ({ value: x, text: x === id ? (heading || T("state.undetermined", { reason: "" })) : legTitle({ target: x }) });
  const hunchRows = (h) => (h.hypotheses || []).map((x, i) => {
    const hid = String(x.hypothesis_id || ""), who = whoIs(x.held_by || ""), gone = x.status === "withdrawn";
    const hist = (Array.isArray(x.history) ? x.history : []).map((e) => `<p class="mk-small" data-history="${cs.esc(String(e.act || ""))}">${cs.esc(whoIs(e.by || ""))}`
      + (e.at ? " · " + cs.date(String(e.at), { year: true }) : "") + (e.statement ? ` <span class="rec">${cs.esc(String(e.statement))}</span>` : "")
      + (e.reason ? ` · ${W("shell.reason.lead")} <span class="rec">“${cs.esc(String(e.reason))}”</span>` : "") + "</p>").join("");
    const change = gone ? `<p class="mk-small" data-hunch-gone="1">${W("screen.question.hunch.withdraw.note2")}</p>`
      : `<details class="mk-details"><summary>${W("screen.question.hunch.change.summary", { name: who })}</summary><p class="mk-note">${W("screen.question.hunch.change.note")}</p>`
        + cs.field("question-hrev-" + i, "screen.question.hunch.revise.label", { area: true, rec: true, value: String(x.statement || ""), help: "screen.question.hunch.revise.help" })
        + cs.field("question-hrevr-" + i, "screen.question.hunch.revise.reason", { area: true, rec: true })
        + cs.act("hypothesisrevise", { label: "act.hypothesisrevise.label.question", data: { hid, idx: String(i) } })
        + cs.field("question-hwr-" + i, "screen.question.hunch.withdraw.reason", { area: true, rec: true })
        + `<p class="mk-note">${W("screen.question.hunch.withdraw.note")} ${W("screen.question.hunch.withdraw.note2")}</p>`
        + cs.act("hypothesiswithdraw", { label: "screen.question.hunch.withdraw.button", data: { hid, idx: String(i) } })
        + `<details class="mk-details"><summary>${W("screen.question.hunch.refused.summary")}</summary><div class="cs-gap" data-gap="refused"><span>${W("screen.question.hunch.refused.body")} ${W("screen.question.hunch.refused.body2")}</span></div></details></details>`;
    return `<div data-hunch="${cs.esc(hid)}" data-status="${gone ? "withdrawn" : "live"}"><p><span class="cs-hunch" data-mark="hunch">${W("screen.question.hunch.by", { who })}</span> `
      + `<span class="rec">${cs.esc(x.statement || "")}</span></p>${hist}${change}</div>`;
  }).join("");
  out.push(cs.sec("screen.question.hunches.head", (d.hunches && d.hunches.state === "empty" ? "" : cs.state("hunches", view, hunchRows))
    + cs.field("question-hunch", "screen.question.hunch.label", { area: true, rec: true })
    + (view.reachable ? cs.act("writinghelp", { data: { field: "statement", id: "question-hunch", forop: "hypothesishold" } }) : "")
    + cs.choice("question-hunch-kind", "screen.question.hunch.kind",
        [["other", "screen.question.hunch.kind.other"], ["flow", "screen.question.hunch.kind.flow"]], { value: hunchKind, redraw: "hunchKind" })
    + (hunchKind === "flow" ? cs.choice("question-hunch-from", "screen.explore.from", [...hunchDocs, id].map(hunchEnd), {})
      + cs.choice("question-hunch-to", "screen.security.to", [id, ...hunchDocs].map(hunchEnd), {}) : "")
    + cs.act("hypothesishold", { label: "act.hypothesishold.label.question", data: { inquiry: id } }), { help: "mark.hunch.means" }));

  /* R25: the readings, each with its state, its strength (a what-if unless accepted) and its acts */
  const drawable = vs.filter((v) => !machine(v) || view.reachable);
  if (drawable.length) {
    const stateLine = (v) => {
      const m = v.moved || {};
      const by = whoIs(m.by || v.author || ""), at = m.at || v.at ? cs.date(String(m.at || v.at), { year: true }) : "";
      const key = v.state === "accepted" ? "question.reading.accepted" : v.state === "considering" ? "question.reading.weighing" : "question.reading.suggested";
      const said = W(key, { who: by, date: { html: at }, reason: String(m.reason || "") });
      return machine(v) ? cs.mark("origin", "machine") + " " + said : said;
    };
    const rowOf = (v) => {
      const vsr = later("vs:" + v.name, "versionstrength", { id, version: String(v.name), states: v.state === "accepted" ? "accepted" : String(v.state) }, String(ui.legSeq || 0));
      const strength = vsr.state === "ok" && vsr.value && vsr.value.pair
        ? `<span class="mk-small" data-whatif="${v.state === "accepted" ? "no" : "yes"}">${grades(vsr.value.pair)} ${W(v.state === "accepted" ? "question.reading.strength" : "question.reading.whatif")}</span>` : cs.state(vsr, () => "");
      const stands = currentName && v.name === currentName ? ` · <b data-standson="1">${W("question.reading.standson", { project: projectTitle || T("state.undetermined", { reason: "" }) })}</b>` : "";
      const data = { version: String(v.name), grounds: (v.grounds || []).join(",") };
      const acts = [
        v.state !== "accepted" ? acceptPart(v, "") : "",
        v.state === "suggested" || v.state === "rejected" ? cs.act("versionconsider", { label: "act.versionconsider.label.question", data }) : "",
        v.state !== "rejected" ? declineFold(v) : "",
        v.state === "accepted" || v.state === "considering" || v.state === "rejected" ? cs.act("versionrevert", { label: "act.versionrevert.label.question", data }) : "",
        v.state === "accepted" && project && joined && v.name !== currentName ? cs.act("versioncurrent", { label: "act.versioncurrent.label.question", fills: { project: projectTitle }, data: { ...data, project } }) : "",
        !v.hidden ? cs.act("versionhide", { label: "act.versionhide.label.question", data }) : "",
      ].join("");
      return `<div class="mk-ev" data-reading="${cs.esc(v.name)}"><b class="rec">${cs.esc(String(v.name))}</b>`
        + (v.description ? `<span class="mk-small rec">${cs.esc(String(v.description))}</span>` : "")
        + `<span class="mk-small">${stateLine(v)}${stands}</span>${strength}${acts}</div>`;
    };
    /* rejected and hidden readings are counted, and shown on press; a hidden one is never deleted (basis-versions R9) */
    const seen = drawable.filter((v) => !v.hidden && v.state !== "rejected");
    const rest = drawable.filter((v) => v.hidden || v.state === "rejected");
    const rejected = rest.filter((v) => v.state === "rejected").length, hidden = rest.filter((v) => v.hidden).length;
    const more = rest.length ? `<details class="mk-details" data-readings="more"><summary>${W("question.readings.more", { rejected: String(rejected), hidden: String(hidden) })}</summary>`
      + `<div class="mk-versions">${rest.map(rowOf).join("")}</div></details>` : "";
    /* R74: on a reading the assistant composed that is not yet accepted, the bias it was composed under, before the member accepts
       it: what the lens block of its own run (`airun`'s `session.bias`) answers. It shows whether it moved, never counts. */
    const biasFold = (v) => {
      const rr = v.run ? later("run:" + v.run, "airun", { run: String(v.run) }) : null;
      const session = rr && rr.state === "ok" && rr.value && rr.value.session ? rr.value.session : null;
      const bias = session && session.bias && typeof session.bias === "object" ? session.bias : null;
      const gap = (kind, inner) => `<p class="cs-gap" data-gap="${kind === "moved" ? "refused" : "undetermined"}" data-bias="${kind}">${inner}</p>`;
      let lens;
      if (rr && rr.state === "loading") lens = cs.state(rr, () => "");
      else if (rr && rr.state === "failed") lens = cs.state(rr, () => "");
      else if (!bias) lens = gap("undetermined", T("state.undetermined", { reason: "" }));
      else if (bias.moved === true) lens = gap("moved", `<b>${W("screen.question.bias.moved")}</b> ${W("screen.question.say013")}`);
      else if (bias.in_force === false) lens = gap("noneinforce", W("screen.question.say021"));
      else if (bias.moved === false) lens = gap("notmoved", W("screen.question.say017") + " " + W("screen.question.say018"));
      else lens = gap("unknown", W("screen.question.say019") + " " + W("screen.question.say020"));
      const forWhom = session && session.principal && typeof session.principal.plane === "string"
        ? session.principal.plane.replace(/^member:/, "").split("/")[0] : "";
      const at = v.at || (session && session.created) || "";
      const data = { version: String(v.name), grounds: (v.grounds || []).join(",") };
      return `<details class="mk-details" data-bias-fold="${cs.esc(String(v.name))}"><summary>${W("screen.question.say009")}</summary>`
        + `<p class="mk-note">${W("screen.question.say010")} ${W("screen.question.say011")}</p>`
        + `<div class="mk-ev"><b class="rec">${cs.esc(String(v.name))}</b>`
        + (forWhom ? `<span class="mk-small">${cs.mark("origin", "machine")} ${W("screen.question.say012", { member: whoIs(forWhom), date: { html: at ? cs.date(String(at), { year: true }) : "" } })}</span>` : "")
        + lens + `<span class="mk-small muted">${W("screen.question.say014")} ${W("screen.question.say015")}</span>`
        + acceptPart(v, "", "b") + (v.state === "suggested" ? cs.act("versionconsider", { label: "act.versionconsider.label.question", data }) : "") + declineFold(v, "b")
        + "</div></details>";
    };
    /* R73: compare the reading shown with another (`versioncompare`, a read: nothing is written), and where each came from */
    const compareFold = () => {
      const names = new Map(drawable.map((v) => [String(v.name), v]));
      const others = drawable.filter((v) => String(v.name) !== shownName);
      const pick = ui["choice:question-compare"];
      const against = names.has(pick) && pick !== shownName ? String(pick) : "";
      const mkData = (t) => ({ html: `<span class="rec">${cs.esc(String(t))}</span>` });
      const titleOf = (x) => legTitle({ target: String(x && typeof x === "object" ? x.target : x) });
      const refs = (list) => (Array.isArray(list) ? list : []).map((x) => cs.ref("document", String(x && typeof x === "object" ? x.target : x), titleOf(x), [])).join(", ");
      let answer = "";
      if (against) {
        const cr = later("cmp", "versioncompare", { target: id, a: against, b: shownName, ...(project ? { project } : {}) });
        if (cr.state === "loading" || cr.state === "empty") answer = cs.state(cr, () => "");
        else if (cr.state === "failed") {
          const code = cr.refusal && cr.refusal.code;
          const known = ["VERSION_COMPARE_NO_SUCH_VERSION", "VERSION_COMPARE_NO_VERSION", "VERSION_COMPARE_NO_INQUIRY"];
          const miss = cr.refusal && cr.refusal.fields && Array.isArray(cr.refusal.fields.missing) ? String(cr.refusal.fields.missing[0] || "") : against;
          const said = code === "VERSION_COMPARE_NO_SUCH_VERSION" ? W("refusal.VERSION_COMPARE_NO_SUCH_VERSION", { version: miss })
            : code === "VERSION_COMPARE_NO_VERSION" ? W("refusal.VERSION_COMPARE_NO_VERSION") : code === "VERSION_COMPARE_NO_INQUIRY" ? W("refusal.VERSION_COMPARE_NO_INQUIRY") : "";
          answer = known.includes(code) ? `<p class="cs-gap" data-gap="refused" role="alert" data-compare="refused">${said}</p>` : cs.state(cr, () => "");
        } else if (cr.value && cr.value.dimensions && typeof cr.value.dimensions === "object") {
          const r = cr.value, dm = r.dimensions, lg = r.legs || {};
          const leg = (k, labelKey) => `<div class="cs-row" data-legs="${k}">${cs.icon(k === "taken_up" ? "add" : k === "let_go" ? "sever" : "connection")}<span><b>${W(labelKey)}</b> ${Array.isArray(lg[k]) && lg[k].length ? refs(lg[k]) : W("screen.question.compare.none")}</span></div>`;
          const vals = (a, b) => `<span class="mk-small" data-side="was">${W("screen.question.compare.was", { value: { html: a } })}</span> <span class="mk-small" data-side="now">${W("screen.question.compare.now", { value: { html: b } })}</span>`;
          const claimText = (x) => (x && typeof x === "object" ? String(x.text || "") : String(x == null ? "" : x));
          const stateSide = (x, now) => {
            const m = x && x.moved && typeof x.moved === "object" ? x.moved : {};
            const date = { html: m.at ? cs.date(String(m.at), { year: true }) : "" };
            if (x && x.state === "accepted") return W(now && x.current ? "screen.question.say034" : "screen.question.say033", { member: whoIs(m.by || ""), date, project: projectWord });
            const k = x && x.state === "considering" ? "question.reading.weighing" : "question.reading.suggested";
            return W(k, { who: whoIs(m.by || ""), date, reason: String(m.reason || "") });
          };
          const row = (kind, labelKey, inner) => `<div class="cs-row" data-dim="${kind}" data-same="${dm[kind] && dm[kind].same === true ? "yes" : "no"}"><span><b>${W(labelKey)}</b> · ${dm[kind] && dm[kind].same === true ? W("screen.question.word.same") : W("screen.question.word.different")} ${inner}</span></div>`;
          const dimRow = (kind, labelKey, show) => {
            const x = dm[kind];
            if (!x) return "";
            return row(kind, labelKey, x.same === true ? (kind === "origin" && x.a && !machine({ author: x.a.author, run: x.a.run }) ? `<span class="mk-small">${W("screen.question.say035")}</span>` : "")
              : kind === "decision" ? `<span class="mk-small" data-side="was">${stateSide(x.a, false)}</span> <span class="mk-small" data-side="now">${stateSide(x.b, true)}</span>` : vals(show(x.a), show(x.b)));
          };
          const partsOf = (x) => (x && Array.isArray(x.partition) ? x.partition.map((g) => (Array.isArray(g) && Array.isArray(g[1]) ? g[1].map(titleOf).join(", ") : "")).filter(Boolean).join("; ") : "");
          answer = `<p class="mk-small" data-compare="sentence">${W("screen.question.say026", { against: mkData(against), shown: mkData(shownName), n: String(r.differs), total: String(r.of) })}</p>`
            + cs.sheet(leg("taken_up", "screen.question.compare.takenup") + leg("let_go", "screen.question.compare.letgo") + leg("kept", "screen.question.compare.kept"))
            + cs.sheet(dimRow("claim", "screen.question.say027", (x) => `<span class="rec">${cs.esc(claimText(x))}</span>`)
              + dimRow("legs", "screen.question.say028", (x) => `<span class="rec">${(Array.isArray(x) ? x : []).map((y) => cs.esc(titleOf(y))).join(", ")}</span>`)
              + dimRow("relationship", "screen.question.say029", (x) => `<span class="rec">${cs.esc(String((x && x.relationship) || ""))} ${cs.esc(partsOf(x))}</span>`)
              + dimRow("decision", "screen.question.say032", () => "")
              + dimRow("origin", "screen.question.compare.origin", (x) => `<span class="rec">${cs.esc(whoIs((x && x.author) || ""))}</span>`));
        }
      }
      /* the tree: each reading's source (`derived_from`) and origin, the roots first, each child indented under its source */
      const kids = (n) => drawable.filter((c) => c.derived_from && String(c.derived_from) === String(n));
      const roots = drawable.filter((v) => !v.derived_from || !names.has(String(v.derived_from)));
      const targetsOf = (v) => new Set((Array.isArray(v.legs) ? v.legs : []).map((x) => String(x.target_id || x.target || "")));
      const treeRow = (v, depth, seenNames) => {
        const parent = v.derived_from ? names.get(String(v.derived_from)) : null;
        const mine = machine(v);
        let origin;
        if (!parent) origin = mine ? "" : W("screen.question.say037", { member: whoIs(v.author || "") });
        else if (mine) origin = W("screen.question.say040");
        else {
          const pt = targetsOf(parent), ct = targetsOf(v);
          const taken = ct.size < pt.size && [...ct].every((t) => pt.has(t));
          origin = W(taken ? "screen.question.say041" : "screen.question.say038", { member: whoIs(v.author || "") });
        }
        const orphan = v.derived_from && !parent ? ` <span class="rec" data-from="${cs.esc(String(v.derived_from))}">${cs.esc(String(v.derived_from))}</span>` : "";
        const line = `<span class="mk-small" data-tree="${cs.esc(String(v.name))}" data-depth="${depth}" style="margin-left:${18 * depth}px">`
          + `<span class="rec">${cs.esc(String(v.name))}</span>${mine ? " " + cs.mark("origin", "machine") : ""}${origin ? " · " + origin : ""}${orphan}`
          + (String(v.name) === shownName ? ` · <b>${W("screen.question.say039")}</b>` : "") + (v.hidden ? ` · ${W("screen.question.say042")}` : "") + "</span>";
        return line + (seenNames.has(String(v.name)) ? "" : kids(v.name).map((c) => treeRow(c, depth + 1, new Set([...seenNames, String(v.name)]))).join(""));
      };
      return `<details class="mk-details" data-compare-fold="1"><summary>${W("screen.question.say022")}</summary>`
        + cs.choice("question-compare", "screen.question.say023", [{ value: "", text: "" }].concat(others.map((v) => ({ value: String(v.name), text: String(v.name) }))), { acts: {}, value: "" })
        + `<p class="mk-small">${W("screen.question.say024")} ${W("screen.question.say025")}</p>` + answer
        + `<div data-tree-box="1"><b>${W("screen.question.say036")}</b><div class="mk-small" style="display:grid;gap:4px">${roots.map((v) => treeRow(v, 0, new Set())).join("")}</div>`
        + `<p class="mk-small muted">${W("screen.question.say043")} ${W("screen.question.say044")}</p></div></details>`;
    };
    const biasFolds = drawable.filter((v) => machine(v) && !v.hidden && (v.state === "suggested" || v.state === "considering")).map(biasFold).join("");
    out.push(cs.sec("question.readings.title", (seen.length ? `<div class="mk-versions">${seen.map(rowOf).join("")}</div>` : "") + biasFolds
      + (drawable.length >= 2 && shown ? compareFold() : "") + more, { help: "question.readings.help" }));
  }

  /* R26: what relies on this, each a reference; out of view said without saying what or how many */
  if (!(d.relies && d.relies.state === "empty")) {
    const relies = cs.state("relies", view, (r) => {
      const list = Array.isArray(r.backlinks) ? r.backlinks : [];
      const row = (x) => {
        const kind = x.from_type === "project" ? "project" : x.from_type === "inquiry" ? "question" : "document";
        let said;
        if (x.from_type === "project") {
          const pc = later("relies:" + x.from, "basisversions", { id, project: String(x.from) });
          const rd = pc.state === "ok" && pc.value.current ? String(pc.value.current.version || "") : "";
          said = rd ? W("question.relies.project", { reading: rd }) : W("shell.card.project");
        } else said = W("question.relies.cites", { kind: T(x.from_type === "inquiry" ? "shell.card.question" : x.from_type === "case" || x.from_type === "published" ? "shell.card.docket" : "shell.card.document") });
        return srow("", cs.ref(kind, String(x.from || ""), x.from_title || T("state.undetermined", { reason: "" }), [x.from_title || ""]), "", said);
      };
      return (list.length ? cs.sheet(list.map(row).join("")) : "") + (r.out_of_view === true ? `<p class="mk-note" data-outofview="1">${W("question.relies.outofview")}</p>` : "");
    });
    if (relies) around.push(cs.sec("question.relies.title", relies, { help: "question.relies.help" }));
  }

  /* R56: the themes its passages are in, each with how many of the question's passages it holds (the question has no theme
     of its own, `connections` R40); and the act that places a passage in one */
  const passageDocs = [...new Set(citedLegs.filter(live).filter((l) => !impRef(l.target)).map((l) => String(l.target)))];
  if (passageDocs.length) {
    const tl = later("themes", "themeread", { limit: "200" });
    const themes = tl.state === "ok" && tl.value && Array.isArray(tl.value.themes) ? tl.value.themes.filter((t) => t && t.theme_id).slice(0, 20) : [];
    const held = themes.map((t) => { const r = later("theme:" + t.theme_id, "themeread", { id: String(t.theme_id), limit: "500" });
      const ms = r.state === "ok" && r.value && Array.isArray(r.value.members) ? r.value.members : [];
      return { t, n: ms.filter((m) => m && passageDocs.includes(String(m.document || m.target || "").split(/[#/:?]/)[0])).length, state: r.state }; });
    const rows = held.filter((h) => h.n > 0).map((h) => srow("", `<span class="rec">${cs.esc(String(h.t.name || ""))}</span>`, "", String(h.n)));
    const place = themes.length ? cs.choice("question-theme-passage", "theme.question.place", passageDocs.map((x) => ({ value: x, text: legTitle({ target: x }) })), {})
      + cs.choice("question-theme-which", "theme.section", themes.map((t) => ({ value: String(t.theme_id), text: String(t.name || "") })), {})
      + cs.field("question-theme-note", "theme.place", { rec: true, help: "act.themeplace.here.question" })
      + cs.act("themeplace", { label: "theme.question.place", data: { inquiry: id } }) : "";
    if (tl.state === "failed") around.push(cs.sec("theme.question.section", cs.state(tl, () => "")));
    else if (rows.length || place) around.push(cs.sec("theme.question.section", (rows.length ? cs.sheet(rows.join("")) : "") + `<p class="mk-small">${W("theme.never.evidence")}</p>` + place));
  }
  if (around.length) out.push(`<details class="mk-details" data-fold="around"${around.length ? "" : ""}><summary>${W("question.around")}</summary>${around.join("")}</details>`);
  /* R72: what each published case froze for this question, from `publishedfrozen` (public: no credential), beside today's strength;
     a question no case pins (cases [] or NOT_PUBLISHED, which a working question answers) draws no section; a read that fails is drawn failed */
  {
    const fr = frozen;
    const none = fr.state === "empty" || (fr.state === "failed" && fr.refusal && fr.refusal.code === "NOT_PUBLISHED") || (fr.state === "ok" && !(fr.value && Array.isArray(fr.value.cases) && fr.value.cases.length));
    if (fr.state === "failed" && !none) out.push(cs.sec("screen.question.say045", cs.state(fr, () => "")));
    else if (fr.state === "ok" && !none) {
      const rank = { A: 4, B: 3, C: 2, D: 1 };
      const sOf = (x) => (x && typeof x === "object" && x.grade ? { state: "graded", grade: String(x.grade) } : { state: "unrated" });
      const todayS = d.strength && d.strength.state === "ok" && d.strength.value ? d.strength.value : null;
      const entry = (c) => {
        const pc = later("pc:" + c.case_id + ":" + c.edition, "publishedcase", { id: String(c.case_id), edition: String(c.edition) });
        const named = pc.state === "ok" && pc.value && (pc.value.scope || pc.value.title) ? String(pc.value.scope || pc.value.title) : "";
        const ref = cs.ref("published", String(c.case_id), named || T("state.undetermined", { reason: "" }), []);
        const head = `<b>${ref}</b><span class="mk-small" data-published="${cs.esc(String(c.edition))}">${W("screen.question.frozen.published", { date: { html: c.published_at ? cs.date(String(c.published_at), { year: true }) : T("state.undetermined", { reason: "" }) }, n: String(c.edition) })}</span>`;
        if (c.withheld) return `<div class="mk-ev" data-case-edition="${cs.esc(String(c.case_id))}:${cs.esc(String(c.edition))}" data-withheld="1">${head}${cs.mark("gap", "withheld", { reason: "" })}</div>`;
        if (c.pinned === false) return `<div class="mk-ev" data-case-edition="${cs.esc(String(c.case_id))}:${cs.esc(String(c.edition))}" data-pinned="no">${head}<p class="cs-gap" data-gap="refused">${W("screen.question.say056")} ${W("screen.question.say057")}</p></div>`;
        const froze = c.strength && typeof c.strength === "object" ? { capture: sOf(c.strength.capture), connection: sOf(c.strength.connection), ...(c.strength.testimony ? { testimony: sOf(c.strength.testimony) } : {}) } : null;
        const rel = (a) => {
          const f = froze && froze[a] && froze[a].state === "graded" ? rank[froze[a].grade] : null, t = todayS && todayS[a] && todayS[a].state === "graded" ? rank[todayS[a].grade] : null;
          return f === null || t === null ? "unknown" : t === f ? "same" : t > f ? "stronger" : "weaker";
        };
        const relWord = (r) => (r === "same" ? W("screen.question.word.same") : r === "stronger" ? W("screen.question.word.stronger")
          : r === "weaker" ? W("screen.question.word.weaker") : W("screen.question.word.unknown"));
        /* R72 (DEC-366): say054's {source} is the newest document the question cited on that axis after this edition published (its
           citations' dates against `published_at`); with no such read the axis draws `compare.axis`. The capture axis reads each cited
           document's capture date (`source.retrieved`, in the image the screen already reads for the title); the citations carry no
           date for the connection axis, so it draws `compare.axis` until a read gives one. */
        const pubAt = Date.parse(String(c.published_at || ""));
        const newerSource = (a) => {
          if (a !== "capture" || Number.isNaN(pubAt)) return "";
          let best = null;
          for (const t of new Set(citedLegs.filter(live).filter((l) => !impRef(l.target)).map((l) => String(l.target)))) {
            const im = later("doc:" + t, "image", { id: t });
            const head = im.state === "ok" && im.value && typeof im.value["bundle.md"] === "string" ? (im.value["bundle.md"].split(/\n---\s*\n/)[0] || "") : "";
            const m = /^\s+retrieved:\s*"?([^"\n]+?)"?\s*$/m.exec(head);
            const when = m ? Date.parse(m[1]) : NaN;
            if (!Number.isNaN(when) && when > pubAt && (!best || when > best.when)) best = { when, target: t };
          }
          return best ? legTitle({ target: best.target }) : "";
        };
        const axisCard = (a) => {
          const name = `<span class="cs-card" tabindex="0" data-tip="${cs.esc(W(a === "capture" ? "screen.question.compare.captured.explain" : "screen.question.compare.connected.explain"))}">${W("mark.scale." + a + ".name")}</span>`;
          const cited = newerSource(a);
          const said = cited ? W("screen.question.say054", { change: { html: relWord(rel(a)) }, source: cited })
            : W("screen.question.compare.axis", { axis: { html: name }, change: { html: relWord(rel(a)) } });
          return `<span class="mk-small" data-axis="${a}" data-relation="${rel(a)}">${cited ? name + " " : ""}${said}</span>`;
        };
        return `<div class="mk-ev" data-case-edition="${cs.esc(String(c.case_id))}:${cs.esc(String(c.edition))}" data-pinned="${c.pinned === true ? "yes" : "none"}">${head}`
          + (froze ? `<span class="mk-small" data-frozen="1">${W("screen.question.say048")} ${grades(froze)}</span>` : `<p class="mk-small" data-frozen="none">${W("public-read.frozen.strength_detail.none")}</p>`)
          + (todayS && froze ? `<span class="mk-small" data-today="1">${W("screen.question.frozen.today")} <span class="cs-strength">${axes(todayS)}</span></span>` + axisCard("capture") + axisCard("connection") : "")
          + (froze ? `<span class="mk-small muted">${c.strength_from === "member_bytes" ? W("screen.question.say055") : W("screen.question.say050") + " " + W("screen.question.say051")}</span>` : "")
          + (c.pinned === true ? `<span class="mk-small" data-pin="1">${W("screen.question.say052")}</span>` : `<span class="mk-small" data-pin="none">${W("screen.question.frozen.unpinned")}</span>`) + "</div>";
      };
      const nCases = new Set(fr.value.cases.map((c) => String(c.case_id))).size;
      out.push(cs.sec("screen.question.say045", `<p class="mk-note">${nCases === 1 ? W("screen.question.frozen.count.one") : W("screen.question.frozen.count", { n: String(nCases) })} ${W("screen.question.say046")} ${W("screen.question.say047")}</p><div class="mk-versions">${fr.value.cases.map(entry).join("")}</div>`, { help: "screen.question.tip076" }));
    }
  }

  /* R103: what needs a second look, from the reminders the record holds for each document this question cites (`reevaluations` with that
     target), the dependents that are this question; recording that one was looked at closes its cause for her question. A finding with
     no reminder draws none (R20); a read that fails is drawn failed */
  {
    const targets = [...new Set(citedLegs.filter(live).filter((l) => !impRef(l.target)).map((l) => String(l.target)))].slice(0, 20);
    const reads = targets.map((t) => ({ t, r: later("reeval:" + t, "reevaluations", { target: t }, String(ui.reevalSeq || 0)) }));
    const failedRead = reads.find((x) => x.r.state === "failed");
    const openCauses = [], doneCauses = [];
    for (const { t, r } of reads) {
      const v = r.state === "ok" && r.value && typeof r.value === "object" ? r.value : null;
      if (!v) continue;
      for (const o of Array.isArray(v.obligations) ? v.obligations : []) {
        if (!o || o.bundle_id !== id) continue;
        for (const c of Array.isArray(o.causes) ? o.causes : []) openCauses.push({ target: String(o.target || t), cause: c });
        for (const c of Array.isArray(o.closed) ? o.closed : []) doneCauses.push({ target: String(o.target || t), cause: c });
      }
      for (const o of Array.isArray(v.closed) ? v.closed : []) {
        if (!o || o.bundle_id !== id) continue;
        for (const c of Array.isArray(o.causes) ? o.causes : []) doneCauses.push({ target: String(o.target || t), cause: c });
      }
    }
    const docOf = (t) => titleOf(t) || T("shell.card.document");
    if (failedRead && !openCauses.length && !doneCauses.length) out.push(cs.sec("screen.question.reeval.heading", cs.state(failedRead.r, () => ""), { id: "reeval" }));
    else if (openCauses.length || doneCauses.length) {
      const rowsHtml = openCauses.map(({ target, cause }) => `<p data-reeval="open">`
          + (cause.source === "edition" ? `<b>${W("screen.question.reeval.edition", { document: docOf(target) })}</b>` : `<b>${cs.esc(String(cause.detail || cause.source || ""))}</b>`)
          + `<span class="mk-small">${cause.since ? cs.date(String(cause.since), { year: true }) + " · " : ""}${cause.source === "edition" ? W("screen.question.reeval.edition.meta") : ""}</span></p>`).join("")
        + doneCauses.map(({ target, cause }) => `<p data-reeval="done">${W("screen.question.reeval.done", { name: whoIs(cause.closed_by || ""), date: { html: cause.closed_at ? cs.date(String(cause.closed_at), { year: true }) : "" }, note: String(cause.note || "") })}`
          + `<span class="mk-small">${W("screen.question.reeval.done.meta", { what: docOf(target) })}</span></p>`).join("");
      const causes = openCauses.map(({ target, cause }) => ({ target, source: String(cause.source || ""), since: cause.since ? String(cause.since) : "" }));
      const record = causes.length
        ? (causes.length > 1 ? cs.choice("question-reeval-cause", "screen.question.reeval.edition.meta", causes.map((c, i) => ({ value: String(i), text: docOf(c.target) + " · " + c.source })), {}) : "")
          + cs.field("question-reeval-note", "screen.question.reeval.note.label", { area: true, rec: true })
          + cs.act("reevaluationrecord", { label: "act.reevaluationrecord.label.question", data: { causes: JSON.stringify(causes) } }) : "";
      out.push(cs.sec("screen.question.reeval.heading", rowsHtml + record + cs.act("reevaluations", { label: "act.reevaluations.label.question", data: { inquiry: id }, tone: "quiet" })
        + `<details class="mk-details"><summary>${W("screen.question.reeval.refused.summary")}</summary><div class="cs-gap" data-gap="refused"><span>${W("screen.question.reeval.refused.body")} ${W("screen.question.reeval.refused.body2")}</span></div></details>`,
        { id: "reeval", help: ["screen.question.reeval.help", "screen.question.reeval.help2"] }));
    }
  }

  /* Concluding (R35, R41, R50, R51): offered once the question cites a passage, on an accepted reading or one she writes
     herself; open by itself when a reading stands */
  const stands = project ? (current && vs.some((v) => v.name === currentName && v.state === "accepted")) : accepted.length > 0;
  const reading = project ? currentName : (shown && shown.state === "accepted" ? shown.name : (accepted[0] && accepted[0].name) || "");
  const cited = citedLegs.length > 0;
  let concl = "";
  if (b && b.conclusion_stance === "withdrawn") concl += `<p>${W("screen.question.concluded.withdrawn")}</p>`;
  /* the form is drawn once the reads that say which reading stands have answered, so its default is not kept from a pending draw */
  const settled = (!cur || cur.state !== "loading") && !(d.basis && d.basis.state === "loading");
  if (!concluded && cited && settled) {
    /* R50 (fix round 10, cause 30b): her own reading rests on the question's grounds as they stand; the affirmation is asked only for parts that are alternatives (each separately
       sufficient), one tick for each, the ground labels of the live supporting legs as the plane counts them (`basis-versions` R51, R53); necessary passages are no part and ask none */
    const altParts = [...new Set(supports.filter(live).map((l) => String(l.ground || "").trim()).filter(Boolean))];
    const affirmOwn = altParts.length < 2 ? "" : `<fieldset class="cs-field" id="affirm-own" data-affirm="own"><legend>${W("reading.affirm.head")}</legend><p class="mk-small">${W("reading.affirm.says", { n: String(altParts.length) })}</p>`
      + altParts.map((pt, i) => `<label><input type="checkbox" name="affirm-own" id="affirm-own-${i}" value="${cs.esc(pt)}"> ${W("reading.affirm.part", { part: pt })}</label>`).join("") + "</fieldset>";
    const names = [...new Set((reading ? [reading] : []).concat(accepted.map((v) => String(v.name))))];
    concl += `<details class="mk-details" data-conclude="form"${stands ? " open" : ""}><summary>${W("act.conclude.label.question")}</summary>`
      + cs.choice("question-conclude-reading", "question.conclude.reading", names.map((n) => ({ value: n, text: n })).concat([{ value: "", key: "question.conclude.own.choice" }]), { value: stands ? reading : "" })
      + cs.field("question-conclude-own", "question.conclude.own.field", { area: true, rec: true, max: 500, help: "question.conclude.own.help" })
      + (project ? "" : cs.field("question-conclude-claim", "screen.question.conclude.claim", { area: true, rec: true }))
      + cs.field("question-conclude-falsifier", "question.conclude.falsifier", { area: true, rec: true, help: "question.conclude.falsifier.help" })
      + cs.checks("question-conclude-none", "question.conclude.falsifier", [["none", "question.conclude.nofalsifier"]])
      + affirmOwn
      /* R121: her reason is its own required box (what Conclude sends as the reason); Commentary stays an optional note */
      + cs.field("question-conclude-reason", "question.conclude.reason", { area: true, rec: true, help: "question.conclude.reason.help" })
      + cs.field("question-conclude-commentary", "question.conclude.commentary", { area: true, rec: true, help: "question.conclude.commentary.help" })
      + cs.act("conclude", { label: "act.conclude.label.question", data: { inquiry: id } })
      + `<p class="mk-small">${W("screen.question.conclude.who")}</p></details>`;
  }
  /* R27: the case's screens, where a read names the question's case (a citing case) */
  const cases = d.relies && d.relies.state === "ok" && Array.isArray(d.relies.value.backlinks)
    ? d.relies.value.backlinks.filter((x) => x && (x.from_type === "case" || x.from_type === "published")) : [];
  for (const c of cases) concl += `<p class="mk-small" data-case="${cs.esc(c.from)}">`
    + [["case-editor", "case.links.editor"], ["review-copy", "case.links.review"], ["ceremony", "case.links.ceremony"], ["docket", "case.links.docket"]]
      .map(([kind, key]) => cs.ref(kind, String(c.from), T(key), [T("shell.card." + kind)])).join(" · ") + "</p>";
  /* R36: a plan opened from this question links it by name */
  const plans = Array.isArray(ui.plans) ? ui.plans : [];
  for (const p of plans) concl += `<p class="mk-note" data-plan="${cs.esc(p.id)}">${W("question.plan.link", { plan: "" })}${cs.ref("plan", String(p.id), String(p.title || T("state.undetermined", { reason: "" })), [T("question.plan.link.tip")])}</p>`;
  if (concl) out.push(cs.sec("screen.question.concluding.head", concl));

  /* R51: the secondary acts fold under `question.more` (before a conclusion; a concluded question has its own row, R62) */
  const moreInner = cs.act("search", { label: "act.search.label.question", data: { q: heading } })
    + cs.field("question-check", "screen.question.check.label", { help: "screen.question.check.help" })
    + cs.field("question-check-note", "screen.question.check.note", { area: true, rec: true })
    + cs.act("checkrequest", { label: "act.checkrequest.label.question", data: { inquiry: id } })
    + (concluded ? "" : cs.field("question-plan", "screen.question.plan.label", {}) + cs.act("planopen", { label: "act.planopen.label.question", data: { inquiry: id } }))
    /* R71: in state a only (a decided question has the receipt above, a concluded one its own row); a failed read is drawn failed */
    + (joined && !concluded && !decision && asideRead ? (asideRead.state === "failed" ? cs.state(asideRead, () => "") : asideRead.state === "loading" ? "" : asideFold()) : "");
  /* R102: divide this question into two: the reason, a question of her own for each, and where each passage goes (at least one of the two);
     each new question is numbered by the plane's allocator and drawn with its number once made */
  const divideFold = legs.length ? `<details class="mk-details" data-divide="1"><summary>${W("screen.question.divide.summary")}</summary>`
    + `<p class="mk-note">${W("screen.question.divide.note")} ${W("screen.question.divide.note2")} ${W("screen.question.divide.note3")}</p>`
    + cs.field("question-divide-reason", "screen.question.divide.reason", { area: true, rec: true, help: "screen.question.divide.limits" })
    + cs.field("question-divide-q1", "screen.question.divide.q1", { area: true, rec: true, help: "screen.question.divide.limits" })
    + cs.field("question-divide-q2", "screen.question.divide.q2", { area: true, rec: true, help: "screen.question.divide.limits" })
    + legs.map((l) => cs.checks("question-divide-leg-" + l.ord, { key: "screen.question.divide.leg", fills: { passage: legName(l) } },
      [["1", "screen.question.divide.to1"], ["2", "screen.question.divide.to2"]])).join("")
    + `<p class="mk-note">${W("screen.question.divide.numbered")} ${W("screen.question.divide.every")}</p>`
    + cs.act("inquirydivide", { label: "screen.question.divide.button", data: { inquiry: id } })
    + (Array.isArray(ui.divided) && ui.divided.length ? `<div data-divided="1">` + ui.divided.map((c) => `<p data-child="${cs.esc(c.id)}">`
      + cs.ref("question", c.id, c.question, [c.id]) + ` <span class="mk-small rec" data-number="1">${cs.esc(c.id)}</span></p>`).join("") + "</div>" : "")
    + `<details class="mk-details"><summary>${W("screen.question.divide.refused.summary")}</summary><div class="cs-gap" data-gap="refused"><span>${W("screen.question.divide.refused.body")} ${W("screen.question.divide.refused.body2")}</span></div></details></details>` : "";
  out.push(`<details class="mk-details" data-fold="more"><summary>${W("question.more")}</summary>${moreInner}${divideFold}</details>`);

  out[stepsAt] = stepsHtml(concluded ? ["done", "done", "done"] : !cited ? ["current", "todo", "todo"] : stands ? ["done", "done", "current"] : ["done", "current", "todo"]) + receipt;
  return out.join("");
}

/** C94 (R40, R46; interface-shell R111): the name a screen draws for a member the record names. A roster row (an object that carries her
 *  handle, or the founder unnamed) is drawn as `fallback` (common's `who`) draws it; an id, a stamp or a handle goes to the kit's
 *  `cs.memberName`: her handle, the founder with no handle by `member.founder.unnamed`, any other by `shell.card.member`, never the id. An
 *  `admin` the screen knows the founder's handle for is drawn by it. A machine identity (`class:`, `agent:`) and a kit with no `memberName`
 *  are the fallback's. Self-contained (the page carries it by its text); the other screens of this module import it. */
export function named(cs, x, founder, fallback) {
  if (x && typeof x === "object" && (x.handle || x.founder === true)) return fallback(cs, x, founder);
  const raw = x && typeof x === "object" ? (x.member_id ?? x.member ?? x.id ?? x.by ?? "") : x;
  const id = String(raw == null ? "" : raw).replace(/^(member:|token:)/, "").trim();
  if (!id || /^(class|agent|machine):/.test(id) || typeof cs.memberName !== "function") return fallback(cs, x, founder);
  if (id === "admin" && founder) return String(founder);
  return cs.memberName(id);
}

/** C41 (R35, R50, R117): a basis version the plane refused (`BASIS_VERSION_REFUSED`) is drawn by its findings, as `BASIS_REFUSED` is: the first
 *  finding by the word held for its code, else its own translation, else its detail, and the repairs it names; one with no finding is the
 *  code's own sentence. (Fix round 2, C41; basis-version-grammar R11) A finding that refuses a version because supporting legs have no
 *  ground or part carries `legs`, the ids of every such leg: each is named by its document's title (`legNames`, put on the refusal by
 *  `legNamesFailed` before it is drawn), a document with no title by the plain word `shell.card.document`, each name once, and no
 *  sentence is composed. Self-contained (the page carries it by its text). */
function versionRefusal(refusal, cs) {
  const list = refusal && Array.isArray(refusal.findings) ? refusal.findings : [];
  const f = list.find((x) => x && typeof x === "object" && (x.translation || x.detail || x.code));
  if (!f) throw new Error("no finding");
  const key = f.code ? "refusal." + String(f.code) : "";
  const said = key && cs.w(key) !== key ? cs.w(key) : cs.esc(String(f.translation || f.detail || ""));
  const repairs = Array.isArray(f.repairs) ? f.repairs.filter((x) => typeof x === "string" && x.trim()) : [];
  const ids = Array.isArray(f.legs) ? [...new Set(f.legs.map(String).filter(Boolean))] : [];
  const titles = refusal && refusal.legNames && typeof refusal.legNames === "object" ? refusal.legNames : {};
  const names = [...new Set(ids.map((id) => (typeof titles[id] === "string" && titles[id].trim() ? cs.esc(titles[id].trim()) : cs.w("shell.card.document"))))];
  return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + said + "</span>" + repairs.map((x) => ' <span data-repair="1">' + cs.esc(x) + "</span>").join("")
    + (names.length ? ' <span data-legs="1">' + names.join(", ") + "</span>" : "");
}

/** C41 (fix round 2): before a refused basis version is drawn, the legs its first finding names are put into titles: the reading's own
 *  `target_title`, else the title of the document this page already read for the leg, else a read of the document (once each, at most 20).
 *  The shell hands `answer` on to the refusal's words, so the titles travel as `legNames` (id to title, "" when the document states none).
 *  Self-contained (the page carries it by its text). */
async function legNamesFailed(view, answer, cs) {
  const fields = answer && answer.fields && typeof answer.fields === "object" ? answer.fields : null;
  const list = fields && Array.isArray(fields.findings) ? fields.findings : [];
  const f = list.find((x) => x && typeof x === "object" && (x.translation || x.detail || x.code));
  const ids = f && Array.isArray(f.legs) ? [...new Set(f.legs.map(String).filter(Boolean))].slice(0, 20) : [];
  if (!ids.length) return;
  const titleIn = (text) => {
    const m = typeof text === "string" ? /^title:\s*(.*)$/m.exec(text.split(/\n---\s*\n/)[0] || "") : null;
    let t = m ? m[1].trim() : "";
    try { if (t.startsWith("\"")) t = JSON.parse(t); } catch { /* raw */ }
    return t;
  };
  const versions = view.data && view.data.basis && view.data.basis.state === "ok" && view.data.basis.value && Array.isArray(view.data.basis.value.versions) ? view.data.basis.value.versions : [];
  const names = {};
  for (const id of ids) {
    let t = "";
    for (const v of versions) for (const l of Array.isArray(v && v.legs) ? v.legs : []) if (!t && l && String(l.target_id || l.target) === id && l.target_title) t = String(l.target_title);
    const held = view.ui && view.ui.later ? view.ui.later["doc:" + id] : null;
    if (!t && held && held.state === "ok" && held.value) t = titleIn(held.value["bundle.md"]);
    if (!t && !held) {
      const a = await cs.call("image", { query: { id } }).then((x) => x, () => null);
      const r = a && a.result !== undefined ? a.result : a;
      if (r && typeof r === "object") t = titleIn(r["bundle.md"]);
    }
    names[id] = t;
  }
  fields.legNames = names;
}

/** R2's, R12's, R23–R25's, R31's and R41's acts, each answering `{query, body}` for the shell to send, or running its own
 *  calls and drawing its outcome, or opening another screen and sending nothing. */
const acts = [
  /* R71's act. The registry lists `proposedispose` on `question` (`registry.json` at 8c5e692e19), but `wizard-scripts`' generated
 *  `screen-registry.mjs` still holds the older file (its R44, not yet met: T51), so `checkScreens` (interface-shell R21) refuses
 *  this screen until that file is re-taken.
 *  R71: set the question aside for its project, on the project's own decision: `project` (the question's), `finding` (its id), `to`
     `deferred` or `dismissed` and her reason, nothing else (`queue` R27's project arm: never a shared dispose); with no choice, or no
 *  reason, nothing is sent; its refusals are drawn by their `refusal.<CODE>` words. */
  { op: "proposedispose", label: "act.proposedispose.label.question", reasonField: "reason", rereads: [],
    send(view, el, cs) {
      const which = el.dataset.which === "2" ? "2" : "";
      const chosen = (cs.value("question-aside" + which) || [])[0];
      if (chosen !== "deferred" && chosen !== "dismissed") return { refuse: "screen.question.say063" };
      const reason = String(cs.value("question-aside" + which + "-why") || "").trim();
      if (!reason) return { refuse: "screen.question.say075" };
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(String(text).split(/\n---\s*\n/)[0] || "") : null;
      /* R91: the project part of the address, else the question's home project */
      const proj = view.project || (m ? m[1] : "");
      if (!proj) return null;
      return { body: { project: proj, finding: String(view.subject || ""), to: chosen, reason } };
    },
    done(view, answer, cs) { cs.set("asideSeq", (view.ui.asideSeq || 0) + 1); } },
  { op: "cite", label: "act.cite.label.question", rereads: [],
    /* the passage is chosen where passages are: Find in over the question's project, or Find with none */
    send(view, el, cs) {
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text) : null;
      const proj = view.project || (m ? m[1] : "");
      if (proj) cs.go("find-in", proj); else cs.go("finder", el.dataset.q || "");
      return null;
    } },
  /* R110: rest the question on a finding the team accepted from another team's case, at the edition it accepted; whether the finding
     is accepted is the plane's to judge (`IMPORTED_NOT_ACCEPTED`, carried inside `BASIS_REFUSED`), and a leg already held is answered
     `alreadyCited`. With no finding or no role chosen, nothing is sent. */
  { op: "citeimported", label: "act.owed_citeimported.label.question", rereads: ["inquiry", "basis", "strength"], failed: legNamesFailed,
    refusals: { IMPORTED_NOT_ACCEPTED: "refusal.IMPORTED_NOT_ACCEPTED",
      BASIS_VERSION_REFUSED: versionRefusal,
      BASIS_REFUSED: function (refusal, cs) {
        const list = refusal && Array.isArray(refusal.findings) ? refusal.findings : [];
        if (list.some((x) => x && x.code === "IMPORTED_NOT_ACCEPTED")) return cs.w("refusal.IMPORTED_NOT_ACCEPTED");
        const f = list.find((x) => x && typeof x.detail === "string" && x.detail.trim());
        if (!f) throw new Error("no finding");
        return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + cs.esc(f.detail.trim()) + "</span>";
      } },
    send(view, el, cs) {
      const pick = String(cs.value("question-imp-finding") || "").split("|");
      const role = (cs.value("question-imp-role") || [])[0];
      if (pick.length !== 3 || !pick[0] || !pick[2] || !role) return null;
      const note = String(cs.value("question-imp-note") || "").trim();
      return { body: { inquiry: String(view.subject || ""), import: pick[0], finding: pick[2], edition: Number(pick[1]), role, ...(note ? { note } : {}) } };
    } },
  /* R110: take that leg back, with her reason (the shell asks it: the act is Reasoned); the history keeps it */
  { op: "withdrawimported", label: "act.owed_withdrawimported.label.question", rereads: ["inquiry", "basis", "strength"],
    send(view, el) {
      const imp = String(el.dataset.import || ""), finding = String(el.dataset.finding || "");
      if (!imp || !finding) return null;
      return { body: { inquiry: String(view.subject || ""), import: imp, finding } };
    } },
  /* R87: two steps of one act. "Narrow the question" on a cited passage reads `narrowcandidates` (target, the reading shown, the
     reading's ordinal for the leg) and lists the parts the record proposes; choosing one, with a name and a reason, sends `narrow`
     with the part as its `extent`. Listing writes nothing and sends no `narrow`. */
  { op: "narrow", label: "act.narrow.label.question", reasonField: "description", rereads: ["inquiry", "basis", "strength"], failed: legNamesFailed,
    refusals: { BASIS_VERSION_REFUSED: versionRefusal, BASIS_REFUSED: function (refusal, cs) {
      const f = refusal && Array.isArray(refusal.findings) ? refusal.findings.find((x) => x && typeof x.detail === "string" && x.detail.trim()) : null;
      if (!f) throw new Error("no finding");
      return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + cs.esc(f.detail.trim()) + "</span>";
    } },
    send(view, el, cs) {
      const target = String(view.subject || ""), version = String(el.dataset.version || ""), ord = String(el.dataset.ord || "");
      if (el.dataset.step !== "send") {
        const res = (a) => (a && a.result !== undefined ? a.result : a);
        cs.set("narrowing", { ord, version, state: "loading", candidates: [] });
        cs.call("narrowcandidates", { query: { target, version, ord } }).then((a) => {
          const r = res(a);
          if (!a || a.ok === false || !r || r.ok === false) return cs.set("narrowing", { ord, version, state: "failed", words: String((r && r.translation) || (r && (r.code || r.reason)) || "") });
          cs.set("narrowing", { ord, version, state: "ok", candidates: Array.isArray(r.candidates) ? r.candidates : [], absence: r.absence && r.absence.says ? String(r.absence.says) : "" });
        }, () => cs.set("narrowing", { ord, version, state: "failed", words: "" }));
        return null;
      }
      const name = String(cs.value("question-narrow-name") || "").trim();
      const description = String(cs.value("question-narrow-description") || "").trim();
      const st = view.ui.narrowing;
      const pick = (cs.value("question-narrow-part") || [])[0];
      const cand = st && Array.isArray(st.candidates) && pick !== undefined ? st.candidates[Number(pick)] : null;
      if (!cand || !name || !description) return { refuse: "screen.question.narrow.empty" };
      const extent = cand.fields && typeof cand.fields === "object" ? cand.fields : cand.content_id ? { content_id: cand.content_id } : cand.extent;
      return { body: { target, version, ord: Number(ord), name, description, extent } };
    },
    done(view, answer, cs) { cs.set("narrowing", null); } },
  /* R35, R41: the reading she concludes on (the project's CURRENT), what would change it (required, or none stated), and
     her commentary (not evidence); sent by a member, never the assistant */
  { op: "conclude", label: "act.conclude.label.question", reasonField: "reason", rereads: ["inquiry", "basis"], failed: legNamesFailed,
    refusals: { BASIS_VERSION_REFUSED: versionRefusal,
      VERSION_AFFIRMATION_INCOMPLETE: (r, cs) => cs.w("refusal.VERSION_AFFIRMATION_INCOMPLETE",
        { part: String((r && (r.part !== undefined ? r.part : Array.isArray(r.missing) ? r.missing[0] : "")) || "") }),
      BASIS_REFUSED: function (refusal, cs) {
      const f = refusal && Array.isArray(refusal.findings) ? refusal.findings.find((x) => x && typeof x.detail === "string" && x.detail.trim()) : null;
      if (!f) throw new Error("no finding");
      return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + cs.esc(f.detail.trim()) + "</span>";
    } },
    send(view, el, cs) {
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text) : null;
      const version = String(cs.value("question-conclude-reading") || el.dataset.version || "");
      const own = String(cs.value("question-conclude-own") || "").trim();
      const claim = String(cs.value("question-conclude-claim") || "").trim();
      const falsifier = String(cs.value("question-conclude-falsifier") || "").trim();
      const none = (cs.value("question-conclude-none") || []).includes("none");
      const commentary = String(cs.value("question-conclude-commentary") || "").trim();
      const reason = String(cs.value("question-conclude-reason") || "").trim();
      /* R50: no reading chosen is her own: 1 to 500 characters, sent as `reading` in place of `version`; empty refused in place.
         R114, R121: what is drawn is what is sent, so every field the act requires is named when it is missing: the reading, what would
         change it, and her reason (sent as `reason`; Commentary is the optional note beside it) */
      if (!version && !claim && (!own || own.length > 500)) return { refuse: "refusal.BAD_READING" };
      if (!falsifier && !none) return { refuse: "question.conclude.falsifier.help" };
      if (!reason) return { refuse: "question.conclude.reason.needed" };
      const q = { target: String(view.subject || "") };
      const proj = view.project || (m ? m[1] : "");
      if (proj) q.project = proj; else if (claim && !version) q.conclusion = claim;
      if (version) q.version = version; else if (own) q.reading = own;
      /* R50: the parts she ticked ("Before you accept", as R59), sent with her own reading only; a reading she chose was affirmed when it was accepted */
      const aff = cs.value("affirm-own");
      if (!version && own && Array.isArray(aff) && aff.length) q.affirmed = aff.join(",");
      if (falsifier) q.falsifier = falsifier; else q.no_falsifier = "1";
      if (commentary) q.commentary = commentary;
      q.reason = reason;
      return { query: q, raw: "" };
    },
    /* R41 state g: the conclusion is answered to the project-aware read, read again once it is made or withdrawn */
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { current: null })); } },
  /* R62: a concluded question offers a case: the question's project and itself as the one target, no case named; then the
     case editor, where the draft stands */
  { op: "casedraft", label: "act.casedraft.label.question", rereads: ["relies"],
    send(view, el) { return { body: { project: String(el.dataset.project || ""), targets: [String(view.subject || "")] } }; },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (!r || r.ok === false || !r.draftId) return { stay: true };
      cs.go("case-editor", String(r.project || ""));
    } },
  /* R56: a passage placed in a theme, with an optional note; the question has no theme of its own (`connections` R40) */
  { op: "themeplace", label: "theme.question.place", rereads: [],
    send(view, el, cs) {
      const theme = String(cs.value("question-theme-which") || ""), target = String(cs.value("question-theme-passage") || "");
      if (!theme || !target) return { refuse: "screen.question.plan.empty" };
      const note = String(cs.value("question-theme-note") || "").trim();
      return { body: { theme, target, ...(note ? { note } : {}) } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { themes: null })); } },
  { op: "withdrawconclusion", label: "act.withdrawconclusion.label.question", rereads: ["inquiry", "basis"],
    send(view) {
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text) : null;
      const proj = view.project || (m ? m[1] : "");
      return { query: { target: String(view.subject || ""), ...(proj ? { project: proj } : {}) }, raw: "" };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { current: null })); } },
  /* R88 (K4203): a hunch is about something. A suspicion is about the question (the list holding its id); where something went is
     about {from, to}, chosen among the question and the documents it cites (the ends the page offers when the kind is chosen,
     else the first cited document to the question) */
  { op: "hypothesishold", label: "act.hypothesishold.label.question", rereads: ["hunches"],
    send(view, el, cs) {
      const statement = String(cs.value("question-hunch") || "").trim();
      if (!statement) return { refuse: "screen.question.hunch.empty" };
      const id = String(view.subject || "");
      const kind = cs.value("question-hunch-kind") === "flow" ? "flow" : "other";
      if (kind === "other") return { body: { inquiry: id, kind, statement, about: [id] } };
      const doc = view.parts.front(view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "");
      const first = (doc.lists.basis || []).map((l) => (l && l.target ? String(l.target) : "")).find(Boolean) || id;
      const from = String(cs.value("question-hunch-from") || first), to = String(cs.value("question-hunch-to") || id);
      return { body: { inquiry: id, kind, statement, about: { from, to } } };
    } },
  /* R101: a hunch revised (the new words, when she changed them, and her reason) or taken back (her reason); each stays on the record */
  ...["hypothesisrevise", "hypothesiswithdraw"].map((op) => ({ op, label: "act." + op + ".label.question", reasonField: "reason", rereads: ["hunches"],
    send(view, el, cs) {
      const op = el.getAttribute("data-act"), i = String(el.dataset.idx || "0"), hypothesisId = String(el.dataset.hid || "");
      const reason = String(cs.value(op === "hypothesisrevise" ? "question-hrevr-" + i : "question-hwr-" + i) || "").trim();
      if (!hypothesisId || !reason) return { refuse: "screen.question.hunch.refused.body" };
      if (op === "hypothesiswithdraw") return { body: { hypothesisId, reason } };
      const held = view.data.hunches && view.data.hunches.state === "ok" && view.data.hunches.value && Array.isArray(view.data.hunches.value.hypotheses)
        ? view.data.hunches.value.hypotheses.find((h) => h && h.hypothesis_id === hypothesisId) : null;
      const statement = String(cs.value("question-hrev-" + i) || "").trim();
      return { body: { hypothesisId, ...(statement && (!held || statement !== String(held.statement || "").trim()) ? { statement } : {}), reason } };
    } })),
  /* R36: the plan opened is linked by name */
  { op: "planopen", label: "act.planopen.label.question", reasonField: "title", rereads: [],
    send(view, el, cs) {
      const title = String(cs.value("question-plan") || "").trim();
      if (!title) return { refuse: "screen.question.plan.empty" };
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text) : null;
      const proj = view.project || (m ? m[1] : "");
      return { body: { ...(proj ? { project: proj } : {}), title, subjects: [{ kind: "inquiry", inquiry: String(view.subject || "") }] } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (!r || !r.id) return;
      cs.set("plans", (Array.isArray(view.ui.plans) ? view.ui.plans : []).concat([{ id: String(r.id), title: String(r.title || "") }]));
      /* C63 (R2, R36; re-walk B E42, E46): the plan opened is its own page, as the project's press opens it */
      cs.go("plan", String(r.id));
    } },
  { op: "checkrequest", label: "act.checkrequest.label.question", reasonField: "note", rereads: [],
    send(view, el, cs) {
      const label = String(cs.value("question-check") || "").trim();
      const note = String(cs.value("question-check-note") || "").trim();
      if (!label || !note) return { refuse: "screen.question.check.empty" };
      return { body: { target: String(view.subject || ""), label, note } };
    } },
  /* R12: the leg's target selected first, then the act on the question as its citing object, with her reason */
  ...["sever", "reinstate"].map((op) => ({ op, label: "act." + op + ".label.question", rereads: ["inquiry", "basis", "strength", "partition"],
    /* C38: what the strength and the partition say of the question rests on its live legs, so what was read of them is read again */
    done(view, answer, cs) { cs.set("legSeq", (view.ui.legSeq || 0) + 1); },
    async send(view, el, cs) {
      const s = await cs.call("select", { body: { ids: [String(el.dataset.target || "")] } }).then((a) => a, () => null);
      const sr = s && s.result !== undefined ? s.result : s;
      if (!s || s.ok === false || !sr || sr.ok === false || !sr.handle) return { refuse: "screen.question.leg.unselectable" };
      /* R139 (citation R23): a reinstate the member ticked "Put it on the other side" for names the other role than the leg was cited with (each function is served by its
         own text, so the op is read from the pressed control) */
      let role = "";
      if (el.getAttribute("data-act") === "reinstate" && (cs.value("question-reinstate-side-" + String(el.dataset.ord || "")) || []).includes("other")) {
        const doc = view.parts.front(view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "");
        const leg = (doc.lists.basis || []).find((l) => l && String(l.target) === String(el.dataset.target || ""));
        role = leg ? ((leg.role || "supports") === "cuts_against" ? "supports" : "cuts_against") : "";
      }
      return { query: { project: String(view.subject || ""), handle: String(sr.handle), ...(role ? { role } : {}) }, raw: "" };
    } })),
  /* R102: the division of a question into two. Each child's number is minted by the plane's allocator (as "Open a question" mints
     one), its slug cut and trimmed so the id never ends in a hyphen; every passage must go to at least one of the two */
  { op: "inquirydivide", label: "act.inquirydivide.label.question", reasonField: "reason", rereads: ["inquiry", "basis", "strength"],
    refusals: { CHILD_REFUSED: function (refusal, cs) {
      const f = refusal && Array.isArray(refusal.findings) ? refusal.findings.find((x) => x && typeof x.detail === "string" && x.detail.trim()) : null;
      if (!f) throw new Error("no finding");
      return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + cs.esc(f.detail.trim()) + "</span>";
    } },
    async send(view, el, cs) {
      const text = view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "";
      const basis = view.parts.front(text).lists.basis || [];
      const reason = String(cs.value("question-divide-reason") || "").trim();
      const qs = [String(cs.value("question-divide-q1") || "").trim(), String(cs.value("question-divide-q2") || "").trim()];
      const homes = [[], []];
      let orphan = false;
      basis.forEach((l, ord) => {
        if (!l || !l.target) return;
        const on = cs.value("question-divide-leg-" + ord) || [];
        if (on.includes("1")) homes[0].push(ord);
        if (on.includes("2")) homes[1].push(ord);
        if (!on.includes("1") && !on.includes("2")) orphan = true;
      });
      if (!reason || !qs[0] || !qs[1] || orphan || !basis.length) return { refuse: "screen.question.divide.refused.body" };
      const res = (a) => (a && a.result !== undefined ? a.result : a);
      const year = String(new Date(cs.now()).getUTCFullYear());
      const children = [];
      for (let i = 0; i < 2; i++) {
        const r = res(await cs.call("allocid", { query: { prefix: "INQ", year } }).then((x) => x, () => null));
        if (!r || r.ok === false || !r.id) return { refuse: "state.failed", fills: { reason: "" } };
        const slug = qs[i].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 40).replace(/-+$/, "");
        children.push({ id: String(r.id) + "-" + (slug || "part-" + (i + 1)), question: qs[i], legs: homes[i] });
      }
      return { body: { target: String(view.subject || ""), reason, children } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const kids = r && Array.isArray(r.children) ? r.children : [];
      cs.set("divided", kids.map((c) => ({ id: String(c && c.id || ""), question: String(c && c.question || "") })).filter((c) => c.id));
    } },
  /* R103: the reminders are read again at her press; recording that one was looked at names the dependent (this question), the cause
     and her note, and closes that cause for it */
  { op: "reevaluations", label: "act.reevaluations.label.question", rereads: [],
    send(view, el, cs) { cs.set("reevalSeq", (view.ui.reevalSeq || 0) + 1); return null; } },
  { op: "reevaluationrecord", label: "act.reevaluationrecord.label.question", reasonField: "note", rereads: [],
    refusals: { REEVALUATION_NO_SUCH_CAUSE: "screen.question.reeval.refused.body2", REEVALUATION_NOTE_MALFORMED: "screen.question.reeval.refused.body" },
    send(view, el, cs) {
      let list = [];
      try { list = JSON.parse(String(el.dataset.causes || "[]")); } catch { list = []; }
      const note = String(cs.value("question-reeval-note") || "").trim();
      if (!note) return { refuse: "screen.question.reeval.refused.body" };
      const c = list.length > 1 ? list[Number(cs.value("question-reeval-cause"))] || list[0] : list[0];
      if (!c) return null;
      return { body: { dependent: String(view.subject || ""), target: String(c.target), source: String(c.source), ...(c.since ? { since: String(c.since) } : {}), note } };
    },
    done(view, answer, cs) { cs.set("reevalSeq", (view.ui.reevalSeq || 0) + 1); } },
  /* R104, R62: a concluded finding reopened with her reason. A finding concluded within a project is reopened by withdrawing that
     conclusion (`withdrawconclusion` with the project and the reason: the question's own state stays as it is, `basis-versions` R20); one
     whose own state is concluded or a disposition by the state move (`reopen`, from the query). Each failure has its own sentence. */
  { op: "reopen", label: "act.reopen.label.question", reasonField: "reason", rereads: ["inquiry", "basis", "strength"],
    refusals: { NO_REASON: "screen.question.reopen.refused.noreason", BAD_REASON: "screen.question.reopen.refused.badreason", NOT_SET_DOWN: "screen.question.reopen.refused.notsetdown",
      ILLEGAL_TRANSITION: "screen.question.reopen.refused.notsetdown" },
    async send(view, el, cs) {
      const reason = String(cs.value("question-reopen-why") || "").trim();
      if (!reason) return { refuse: "screen.question.reopen.refused.noreason" };
      if (el.dataset.route !== "withdraw") return { query: { target: String(view.subject || ""), reason }, raw: "" };
      const a = await cs.call("withdrawconclusion", { query: { target: String(view.subject || ""), project: String(el.dataset.project || ""), reason }, raw: "" }).then((x) => x, () => null);
      const r = a && a.result !== undefined ? a.result : a;
      if (!a || a.ok === false || !r || r.ok === false) {
        const code = String((r && (r.code || r.reason)) || (a && (a.code || a.reason)) || "");
        const key = { NO_REASON: "screen.question.reopen.refused.noreason", BAD_REASON: "screen.question.reopen.refused.badreason", NOTHING_TO_WITHDRAW: "refusal.NOTHING_TO_WITHDRAW" }[code];
        return { refuse: key || "shell.unread" };
      }
      cs.set("later", Object.assign({}, view.ui.later, { current: null }));
      return null;
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { current: null })); } },
  /* R10: the assistant's help with one own-words field (`wizard-scripts` R27): drawn only while it is reachable; the draft is labelled
     machine work and nothing is kept until she saves */
  { op: "writinghelp", label: "act.writinghelp.label.question", rereads: [], reasonField: "told",
    send(view, el, cs) {
      view.ui.helpId = el.dataset.id;
      return { body: { field: el.dataset.field, told: String(cs.value(el.dataset.id) || "").trim() } };
    },
    done(view, answer, cs) {
      const a = answer && answer.result !== undefined ? answer.result : answer;
      if (a && typeof a.text === "string" && view.ui.helpId) cs.fill(view.ui.helpId, a.text, { label: "screen.start-send.draft.machine" });
    } },
  { op: "heldrestore", label: "act.heldrestore.label.question", rereads: ["waits"],
    send(view, el) { return { body: { ids: [el.dataset.doc || ""] } }; } },
  { op: "search", label: "act.search.label.question", rereads: [],
    send(view, el, cs) { cs.go("finder", el.dataset.q || ""); return null; } },
  /* R23, R24: what each passage carries, as a partition: "No" a part of its own; the passages that hold each other up one
     part together; each part's statement left empty. A restructure carries her reason (the shell's, NO_REASON) */
  { op: "inquiryground", label: "act.inquiryground.label.question", rereads: ["inquiry", "strength", "basis", "partition"], failed: legNamesFailed,
    /* R117: a refusal that carries `findings[]` draws the first finding's own detail; one with none, the code's sentence */
    refusals: { BASIS_VERSION_REFUSED: versionRefusal, BASIS_REFUSED: function (refusal, cs) {
      const f = refusal && Array.isArray(refusal.findings) ? refusal.findings.find((x) => x && typeof x.detail === "string" && x.detail.trim()) : null;
      if (!f) throw new Error("no finding");
      return '<span data-finding="' + cs.esc(String(f.check || "")) + '">' + cs.esc(f.detail.trim()) + "</span>";
    } },
    send(view, el, cs) {
      const P = view.parts;
      const doc = P.front(view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "");
      /* C38: a removed citation is no part of the partition (the question's reference to it is severed) */
      const refs = doc.lists.references || [];
      const gone = (l) => { const r = refs.find((x) => x && String(x.target) === String(l.target)); return r ? r.status === "severed" : l.status === "severed"; };
      const legs = (doc.lists.basis || []).map((l, ord) => Object.assign({ ord }, l))
        .filter((l) => l && l.target && (l.role || "supports") === "supports" && !gone(l));
      /* R23 (fix round 10, cause 30a; DEC-32 clauses 2 and 4): a passage answered "No, my answer falls" is NECESSARY and belongs to no part; a passage answered "Yes, because of
         these others" is, with the others it names, one independently sufficient part together. A passage left unanswered counts as necessary (the default is AND). An answer of
         "No" for every passage sends no ground at all (`grounds: []`); the passages in no part stand beside the grounds as necessary legs (`inquiry` R85). */
      const parent = new Map(legs.map((l) => [l.ord, l.ord]));
      const root = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
      const asserting = new Set();
      /* T51 fix round 10 (B89, C-M5): a passage answered "No" is necessary, so a "Yes, because of X" never joins X to its part: X is left out of the
         union and stays a necessary leg, and the page says so (`screen.question.yes.setaside`, R139). */
      const answeredNo = new Set(legs.filter((l) => (cs.value("ask-" + l.ord) || []).includes("no")).map((l) => l.ord));
      /* R139 (DEC-439; C-M5): each "Yes, because of" that names a passage answered "No" is set aside, and the page says so once the save is answered: the pair by passage
         number, counted from one in the order the list draws them */
      const setAside = [];
      for (const l of legs) {
        const said = cs.value("ask-" + l.ord) || [];
        if (!said.includes("yes")) continue;
        asserting.add(l.ord);
        for (const o of cs.value("ask-which-" + l.ord) || []) {
          const n = Number(o);
          if (!parent.has(n)) continue;
          if (answeredNo.has(n)) setAside.push({ yes: legs.indexOf(l) + 1, no: legs.findIndex((x) => x.ord === n) + 1 });
          else parent.set(root(n), root(l.ord));
        }
      }
      view.ui.pendingAside = setAside;
      const groups = new Map();
      for (const l of legs) { const r = root(l.ord); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(l.ord); }
      const grounds = [...groups.values()].filter((ords) => ords.some((o) => asserting.has(o))).map((ords, i) => ({ ground: "part " + (i + 1), legs: ords }));
      return { body: { target: String(view.subject || ""), grounds } };
    },
    /* R139: what this save set aside is drawn (none, when it set nothing aside) */
    done(view, answer, cs) { cs.set("setAside", Array.isArray(view.ui.pendingAside) ? view.ui.pendingAside : []); } },
  /* R25: the reading acts, each with the version; Stand on with the project; accept with the affirmation of every ground */
  ...["versionaccept", "versionconsider", "versionreject", "versionrevert", "versioncurrent", "versionhide"].map((op) => ({
    op, label: "act." + op + ".label.question", rereads: ["basis", "strength", "inquiry"], failed: legNamesFailed,
    ...(op === "versionreject" ? { reasonField: "reason" } : {}),
    send(view, el, cs) {
      /* each function is served by its own text (interface-shell R21 (1)), so the op is read from the pressed control */
      const op = el.getAttribute("data-act");
      const version = String(el.dataset.version || "");
      const body = { target: String(view.subject || ""), version };
      if (op === "versioncurrent") body.project = String(el.dataset.project || "");
      /* R59: the parts she ticked ("Before you accept"); a reading of one part asks none */
      const ix = String(el.dataset.idx || "");
      if (op === "versionaccept" && cs.value("affirm-" + ix) !== null) body.affirmed = cs.value("affirm-" + ix);
      /* R64: Decline sends the version's reject with her reason, and nothing while the reason is empty */
      if (op === "versionreject") body.reason = String(cs.value("question-reject-" + ix) || "").trim();
      return { body };
    },
    /* VERSION_AFFIRMATION_INCOMPLETE by its words, naming the first part not yet affirmed */
    refusals: { BASIS_VERSION_REFUSED: versionRefusal, VERSION_AFFIRMATION_INCOMPLETE: (r, cs) => cs.w("refusal.VERSION_AFFIRMATION_INCOMPLETE",
      { part: String((r && (r.part !== undefined ? r.part : Array.isArray(r.missing) ? r.missing[0] : "")) || "") }) },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { current: null })); } })),
  /* R31: the question read in her language, drawn in place; nothing saved */
  { op: "readtranslate", label: "act.readtranslate.label.question", rereads: [],
    send(view, el, cs) {
      const tr = view.ui.translation;
      if (tr) { cs.set("translation", Object.assign({}, tr, { shown: !tr.shown })); return null; }
      const subject = { kind: "question", id: String(view.subject || "") };
      if (el.dataset.project) subject.project = String(el.dataset.project);
      return { body: { subject } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (!r || r.ok === false || typeof r.translation !== "string") return { stay: true };
      cs.set("translation", { text: r.translation, from: String(r.from_language || ""), shown: true });
      return { stay: true };
    } },
  /* R41 state c: "Ask the assistant to look" opens a check run on this question (as the dock does, R33); a limit
     refusal draws state f */
  { op: "airunopen", label: "act.airunopen.label.question", rereads: [],
    send(view, el, cs) {
      const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const member = view.me && view.me.member;
      if (!member) return null;
      const res = (a) => (a && a.result !== undefined ? a.result : a);
      const run = "RUN-" + hex(16);
      const bounds = (view.parts.bounds || {}).check || [];
      const pack = el.dataset.pack;
      /* R45: state d is drawn at her press, before the plane answers; a refusal or a withholding replaces it */
      cs.set("said", null);
      cs.set("limit", null);
      cs.set("asking", run);
      const pm = /^project:\s*(\S+)\s*$/m.exec(String((view.data.inquiry && view.data.inquiry.state === "ok" && view.data.inquiry.value["bundle.md"]) || "").split(/\n---\s*\n/)[0] || "");
      cs.call("airunopen", { body: { run, contextType: "inquiry", contextId: String(view.subject || ""), mode: "check",
        principalClaude: "member:" + member, skillVersion: pack, bounds, ...(view.project || pm ? { project: view.project || pm[1] } : {}) } }).then((o) => {
        const r = res(o) || {};
        if (!o || o.ok === false || r.ok === false || r.started === false) {
          const code = String(r.code || r.reason || "");
          cs.set("asking", null);
          if (code === "AI_LIMIT_REACHED") cs.set("limit", { whose: r.whose || "", period: r.period || "", when: r.when || "", reasons: [] });
          else cs.set("said", { html: `<p class="mk-msg" role="alert" data-refusal="airunopen">${r.translation ? cs.esc(r.translation) : cs.w("state.failed", { reason: code })}</p>` });
          return;
        }
        /* D29: a dispatch answered `dispatched: false`, withheld or refused is said by its words, never taken as at work */
        return cs.call("airundispatch", { body: { run } }).then((x) => {
          const xr = res(x) || {};
          if (!x || x.ok === false || xr.ok === false || xr.dispatched === false || xr.withheld || xr.found === false) {
            const c = String(xr.code || xr.reason || xr.withheld || "");
            cs.set("asking", null);
            cs.set("withheld", run);
            const key = xr.withheld && (view.parts.withheld || []).includes(c) ? "dock.withheld." + c : (view.parts.refusals || {})[c];
            cs.set("said", { html: `<p class="mk-msg" role="alert" data-refusal="airundispatch">${key ? cs.w(key) : xr.translation ? cs.esc(xr.translation) : cs.w("dock.withheld.other")}</p>` });
            return;
          }
          cs.set("dispatched", run);
          cs.set("seq", (view.ui.seq || 0) + 1);
        });
      }, () => { cs.set("asking", null); cs.set("said", { html: `<p class="mk-msg" role="alert">${cs.w("state.failed", { reason: "" })}</p>` }); });
      return null;
    } },
  { op: "airunclose", label: "act.airunclose.label.question", rereads: [],
    send(view, el, cs) {
      const id = String(el.dataset.run || "");
      if (!id) return null;
      const end = () => cs.set("seq", (view.ui.seq || 0) + 1);
      cs.call("airunclose", { body: { run: id, bound: "cancelled" } }).then(end, end);
      return null;
    } },
];

/** R139 (T51 fix round 10; DEC-439; citation R24): a member's grade of how well the team's copy shows a cited passage, `leggrade` with the question as its citing object
 *  (`project`), the passage's target and its part (the leg's `content_id` and `extent_*` fields), the letter chosen (none offered above the ceiling) and her reason. Held apart as the
 *  document's `readheldActs` is: the act is carried only once the registry (or `RE_POINTS`) admits it (admit.mjs), so no screen is stopped by an act it does not yet hold. A refusal
 *  (`GRADE_OVER_CEILING`, `NOT_CITED`, `LEG_NOT_GRADABLE`, `LEG_GRADE_OTHER_AXIS`, a machine) is drawn by the owner's own words, and the question reads its legs and strength again. */
const legGradeActs = Object.freeze(admitted("question", "leggrade") ? [
  { op: "leggrade", label: "screen.question.leggrade.act", reasonField: "reason", rereads: ["inquiry", "basis", "strength", "partition"],
    send(view, el, cs) {
      const ord = String(el.dataset.ord || ""), target = String(el.dataset.target || "");
      const grade = String((cs.value("question-leggrade-" + ord) || [])[0] || "");
      if (!/^[A-D]$/.test(grade)) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.question.leggrade.head") } } };
      const reason = String(cs.value("question-leggrade-why-" + ord) || "").trim();
      if (!reason) return { refuse: "shell.reason.needed" };
      const doc = view.parts.front(view.data.inquiry && view.data.inquiry.state === "ok" ? view.data.inquiry.value["bundle.md"] : "");
      const leg = (doc.lists.basis || [])[Number(ord)];
      const part = {};
      for (const k of ["content_id", "extent_kind", "extent_ref", "extent_page", "extent_rect", "extent_sheet", "extent_cell", "extent_slide", "extent_shape", "extent_para", "extent_run",
        "extent_range", "extent_table", "extent_part", "extent_cited_as"]) if (leg && leg[k] !== undefined && leg[k] !== null && String(leg[k]) !== "") part[k] = String(leg[k]);
      return { body: { project: String(view.subject || ""), target, grade, reason, ...part } };
    },
    done(view, answer, cs) { cs.set("legSeq", (view.ui.legSeq || 0) + 1); } },
] : []);

/** The keys the question screen may draw (R44: keys only). */
const words = Object.freeze([
  "screen.question.name", "screen.question.purpose",
  ...["cite", "sever", "reinstate", "narrow", "conclude", "withdrawconclusion", "hypothesishold", "planopen", "checkrequest", "heldrestore", "search",
    "inquiryground", "versionaccept", "versionconsider", "versionreject", "versionrevert", "versioncurrent", "versionhide", "readtranslate", "airunopen", "airunclose", "proposedispose"]
    .map((op) => "act." + op + ".label.question"),
  "mark.scale.capture.name", "mark.scale.capture.means", "mark.scale.connection.name", "mark.scale.connection.means",
  "mark.scale.testimony.name", "mark.scale.testimony.means", "mark.grade.reading", "mark.strength.means", "mark.hunch.means",
  "mark.gap.undetermined.name", "mark.gap.undetermined.means", "mark.gap.unrated.name", "mark.gap.unrated.means",
  "mark.origin.machine.name", "mark.origin.machine.means", "ai.label.untested",
  "state.empty", "state.loading", "state.failed", "state.undetermined", "member.founder.unnamed", "screen.document.passage.where", "act.heldrestore.label.held", "screen.held.setaside",
  ...["opened", "opened.noproject", "strength.head", "strength.two", "strength.weakest", "strength.raise", "strength.against",
    "strength.short", "strength.meets", "strength.nobar", "waits.head", "waits.setaside", "waits.item", "waits.since", "supports.head",
    "against.head", "leg.severed", "leg.severed.why", "leg.unselectable", "hunches.head", "hunch.by", "hunch.label", "hunch.kind",
    "hunch.kind.other", "hunch.kind.flow", "hunch.empty", "concluding.head", "concluded.withdrawn", "conclude.claim", "conclude.who",
    "check.label", "check.help", "check.note", "check.empty", "plan.label", "plan.empty", "cite.from", "narrow.name",
    "narrow.description", "narrow.empty"].map((k) => "screen.question." + k),
  "question.falls", "question.holds", "question.ask.first.title", "question.ask.first.says", "question.ask.title", "question.ask.help",
  "question.ask", "question.ask.no", "question.ask.yes", "question.ask.which", "question.rests.readback", "question.rests.title",
  "question.rests.any", "question.rests.all", "question.origin.shared", "question.rests.set", "question.rests.changed", "question.rests.change",
  "question.reading.shown", "question.reading.shown.help", "question.readings.title", "question.readings.help", "question.reading.accepted",
  "question.reading.weighing", "question.reading.suggested", "question.reading.strength", "question.reading.whatif", "question.reading.standson",
  "question.readings.more", "question.relies.title", "question.relies.help", "question.relies.project", "question.relies.cites",
  "question.relies.outofview", "shell.card.project", "shell.card.question", "shell.card.document", "shell.card.docket",
  "case.links.editor", "case.links.review", "case.links.ceremony", "case.links.docket",
  "screen.question.leg.paragraph", "screen.project.opened.date",
  "shell.card.case-editor", "shell.card.review-copy", "shell.card.ceremony",
  "translate.read", "translate.label", "translate.label.help", "translate.original", "translate.back",
  "question.empty.conclude.own", "question.empty.capture", "question.empty.capture.line", "question.empty.heading", "question.empty.note",
  "question.empty.find", "question.empty.find.line", "question.empty.ask", "question.empty.ask.line", "question.adddoc",
  "question.run.heading", "question.run.leave", "screen.assistant.run.running", "screen.assistant.run.ended", "question.proposal.heading", "ai.refused.limit.overall", "question.limit.note",
  "question.ai.other", "question.ai.whose", "question.concluded.heading", "question.concluded.by", "question.concluded.falsifier",
  "question.conclude.reading", "question.conclude.falsifier", "question.conclude.falsifier.help", "question.conclude.nofalsifier",
  "question.conclude.commentary", "question.conclude.commentary.help", "question.plan.link", "question.plan.link.tip",
  "refusal.VERSION_AFFIRMATION_INCOMPLETE", "dock.withheld.other", "dock.withheld.MEMBER_PRINCIPAL_RUN", "dock.withheld.AGENT_WORKER_UNBOUND",
  "dock.withheld.NAMESPACE_UNDETERMINED", "dock.withheld.CREDENTIAL_RECORD_SILENT",
  /* T50 (R50–R64) */
  "question.steps.source", "question.steps.mark", "question.steps.conclude", "question.more", "question.around",
  "question.conclude.own.choice", "question.conclude.own.field", "question.conclude.own.help", "question.reading.by.member",
  "refusal.BAD_READING", "act.casedraft.label.question", "act.casedraft.does", "screen.question.stopped.kept",
  "screen.question.reject.summary", "screen.question.reject.reason", "screen.question.reject.reason.help", "screen.question.reject.go",
  "reading.affirm.head", "reading.affirm.says", "reading.affirm.part", "reading.affirm.accept",
  "ai.run.ending.completed", "ai.run.ending.completed.none", "ai.run.ending.cancelled", "ai.run.ending.mode-not-deployed", "ai.run.ending.fetches",
  "ai.run.ending.subsessions", "ai.run.ending.wallclock", "ai.run.ending.runtime", "ai.run.ending.mints", "ai.run.ending.surfaces",
  "ai.run.ending.proposals", "ai.run.ending.pages", "ai.run.ending.lease", "ai.run.ending.nothing-written", "ai.run.ending.unknown",
  "screen.assistant.run.cost.sofar", "screen.assistant.run.cost.final", "ai.run.cost.money", "ai.run.cost.money.one", "ai.run.cost.tokens",
  "ai.run.cost.tokens.one", "ai.run.cost.on.subscription", "ai.run.cost.on.apikey", "ai.run.cost.on.team", "ai.run.cost.on.project",
  "ai.run.cost.means", "ai.run.cost.tokens.means", "ai.progress.reading", "ai.progress.read", "ai.progress.read.one", "ai.progress.found",
  "ai.progress.found.one", "ai.progress.found.none", "ai.progress.composing", "ai.progress.checking", "ai.progress.hold", "ai.progress.means",
  "ai.progress.checked.all", "ai.progress.checked.all.means", "ai.progress.check.ok", "ai.progress.check.fail", "ai.progress.checked",
  "ai.progress.check.failed", "ai.reading.levels.disagree", "theme.question.section", "theme.question.place", "theme.section",
  "theme.place", "theme.never.evidence", "act.themeplace.here.question",
  /* T51 (R71–R74, R78) */
  "screen.question.say000", "screen.question.say001", "screen.question.say002", "screen.question.say003", "screen.question.say004", "screen.question.say005", "screen.question.say006", "screen.question.say008", "screen.question.say009", "screen.question.say010", "screen.question.say011", "screen.question.say012", "screen.question.say013", "screen.question.say014", "screen.question.say015", "screen.question.say017", "screen.question.say018", "screen.question.say019", "screen.question.say020", "screen.question.say021", "screen.question.say022", "screen.question.say023", "screen.question.say024", "screen.question.say025", "screen.question.say026", "screen.question.say027", "screen.question.say028", "screen.question.say029", "screen.question.say032", "screen.question.say033", "screen.question.say034", "screen.question.say035", "screen.question.say036", "screen.question.say037", "screen.question.say038", "screen.question.say039", "screen.question.say040", "screen.question.say041", "screen.question.say042", "screen.question.say043", "screen.question.say044", "screen.question.say045", "screen.question.say046", "screen.question.say047", "screen.question.say048", "screen.question.say050", "screen.question.say051", "screen.question.say052", "screen.question.say055", "screen.question.say056", "screen.question.say057", "screen.question.say058", "screen.question.say059", "screen.question.say060", "screen.question.say061", "screen.question.say062", "screen.question.say063", "screen.question.say064", "screen.question.say065", "screen.question.say066", "screen.question.say067", "screen.question.say068", "screen.question.say069", "screen.question.say070", "screen.question.say071", "screen.question.say072", "screen.question.say073", "screen.question.say074", "screen.question.say075",
  "screen.question.say000.bymember", "screen.question.say008.bymember", "screen.question.tip076", "screen.question.tip078", "screen.question.tip079",
  "shell.reason", "shell.reason.lead", "public-read.frozen.strength_detail.none", "mark.gap.withheld.name", "mark.gap.withheld.means",
  "screen.question.compare.captured.explain", "screen.question.compare.connected.explain", "screen.question.decision.change", "screen.question.compare.axis", "screen.question.say054",
  "refusal.VERSION_COMPARE_NO_SUCH_VERSION", "refusal.VERSION_COMPARE_NO_VERSION", "refusal.VERSION_COMPARE_NO_INQUIRY",
  "screen.question.touches.heading", "screen.question.frozen.count", "screen.question.frozen.count.one", "screen.question.frozen.published",
  "screen.question.frozen.today", "screen.question.frozen.unpinned", "screen.question.bias.moved",
  ...["same", "different", "stronger", "weaker", "unknown"].map((k) => "screen.question.word." + k),
  ...["takenup", "letgo", "kept", "none", "was", "now", "origin"].map((k) => "screen.question.compare." + k),
  /* FR-28 (R87–R89, R101–R104, R114, R116, R120, R121) */
  "strength.arithmetic.unrated_no_leg_on_any_set", "strength.arithmetic.unrated_no_leg_on_this_axis", "strength.arithmetic.unrated_this_inquiry_rests_on_nothing",
  "strength.arithmetic.present_and_not_yet_load_bearing", "strength.hunch_why", "screen.explore.from", "screen.security.to",
  "question.conclude.reason", "question.conclude.reason.help", "question.conclude.reason.needed",
  ...["change.summary", "change.note", "revise.label", "revise.help", "revise.reason", "withdraw.reason", "withdraw.note", "withdraw.note2", "withdraw.button",
    "refused.summary", "refused.body", "refused.body2"].map((k) => "screen.question.hunch." + k),
  ...["hypothesisrevise", "hypothesiswithdraw", "reopen", "inquirydivide", "reevaluationrecord", "reevaluations", "writinghelp"].map((op) => "act." + op + ".label.question"),
  ...["summary", "note", "note2", "note3", "reason", "limits", "q1", "q2", "leg", "numbered", "every", "refused.summary", "refused.body", "refused.body2"].map((k) => "screen.question.divide." + k),
  ...["to1", "to2"].map((k) => "screen.question.divide." + k),
  ...["heading", "edition", "edition.meta", "done", "done.meta", "note.label", "refused.summary", "refused.body", "refused.body2", "help", "help2"].map((k) => "screen.question.reeval." + k),
  ...["summary", "what", "case", "kept", "why", "why.help", "next", "next.link", "next.link.text", "refused.summary", "refused.noreason", "refused.badreason", "refused.notsetdown"].map((k) => "screen.question.reopen." + k),
  "act.writinghelp.does",
  /* R139 (DEC-439): the leg-grade fold, the Yes set aside, the other side beside Reinstate, a published case carrying the question */
  "screen.question.leggrade.head", "screen.question.leggrade.help", "screen.question.leggrade.act", "screen.question.yes.setaside", "screen.question.reinstate.otherside",
  "screen.question.reinstate.otherside.help", "screen.question.carried", "capture.fieldneeded", "shell.reason.needed",
  /* T51 CHANGE B22 (R110) */
  "act.owed_citeimported.label.question", "act.owed_withdrawimported.label.question", "refusal.IMPORTED_NOT_ACCEPTED",
  "screen.imported.citeimp.role", "screen.imported.citeimp.role.supports", "screen.imported.citeimp.role.cuts", "screen.imported.citeimp.note",
  "screen.imported.citeimp.inherit1", "screen.imported.citeimp.inherit2", "screen.imported.citeimp.tip",
]);

/** The question screen (interface-shell R21), with the module's shared readers and the dock's bounds as its parts. */
export function questionScreen(parts) {
  return Object.freeze({ id: "question", reads, place, render, acts: [...acts, ...legGradeActs], words, parts: Object.freeze({ ...parts, named, leggrade: legGradeActs.length > 0 }) });
}
