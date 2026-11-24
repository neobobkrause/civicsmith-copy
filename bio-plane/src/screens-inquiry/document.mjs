/* screens-inquiry R3: the document screen (Projects › <project> › Document; registry screen `document`, its 11 acts).
 *
 * Self-contained functions (interface-shell R21 (1)). The document is the INFO bundle `view.subject` its capture is
 * filed in; its capture's digest is its provenance document's `documents[0].capture.sha256` (never `content_hash`, the
 * dataset digest, capture grammar C-2.7; K3387), its address `source.locator`. What needs the digest
 * or the address (the reading and its passages, the grade note, the versions) is read once the document is read.
 * `release` and `retire` act on a selection (`ratification` takes a handle), so each makes its own selection of this
 * document (`op=select`) and sends itself, drawing its own outcome beside the act. Opening the original goes through
 * `open-file` (`screens-intake`) by the capture's SHA-256, never by the bundle id (R22). `pagetranscribe` is drawn only while the assistant is reachable (interface-shell R20;
 * DEC-190). "Watch for changes" (`monitorset`, `monitoring` R74) and "Check for a new version now" (`monitor`) are two
 * acts (R15). A choice among record data (a question, a page) is `cs.choice` over `{value, text}` options (R8).
 *
 * R32 (T49): the capture's own grade object (its `heldcaptures` row, `provenance.captureGrade`), drawn as one mark, and
 * none at all where no read answers it (never "Unrated" beside a grade note); "Its versions" refused by its words; the
 * address an outside link, unquoted; the title the document's, never the address's last segment (R39); a testimony (a
 * member's firsthand observation, `op=testify`) offers Find in as a link and its words, and neither watching nor checking
 * for a new version; times by `cs.date`. Its reads gain the links the page carries (`links`, capture R57), the links it
 * makes into held documents (`links_to`, connections R24, its own references) and the mention that counts for each name
 * it holds (`on_point`, `connections`, connections R4); its acts gain `adoptversion` and `keepversion` (a newer version's
 * notice, reevaluation R15), `connectionchoose` and `explore`. Every sentence is a word by key (R44).
 * R49 (K3560): "In which question" preselects the question the capture was held for, never the group's first; the
 * document's own project's questions come first (passages section).
 *
 * T51 (R65–R70, R78): the screen follows the drawing's order (passages, Versions, "Your citations, leg by leg", "The record of
 * this copy", Fingerprints, What cites it, the links in five groups, the names with their grade and how they were matched,
 * Themes, Steps, the copy's own acts). R65 reads `bundlehistory` (the release, the log oldest first, the revisions, and two of
 * them side by side from the `image` answer the page already holds: no other read); R66 the fingerprints with Copy (`hashcopy`,
 * nothing sent); R67 the links by their verdict, an outside link opening a warning before its address (the browser acts
 * `linkopen`, `revisioncompare`: done in the page, nothing sent); R68 the names from `resolutions`; R69 one row for each
 * question that rests on the document, asked for a newer copy only when the member asks (`versionnotice`); R78 every page
 * drawn is the record's page + 1, every value sent is the record's own.
 *
 * CR-19 (R81, R82): the second "Read it" tab compares the revision a question cites with the current copy (matched by the leg's
 * `extent_capture` to `bundlehistory`'s `capture_sha`), by the browser act `revisioncompare`; the original-file card draws the
 * file's kind from the reading's format id and its size from `bytes`, and none without `bytes`.
 *
 * T51 fix round 2 (SCREENS-INQUIRY #18): R125 (C31) `cite` sends `{project, role, found}` in the body, the question choice redraws (`ui.citeQuestion`)
 * and the passage a question holds a leg on is marked as cited by it; R123 (C33) a held copy offers no retire, only a door to Held (BOB B26), and
 * `retire`'s `CITED` and `ILLEGAL_TRANSITION` are drawn in their own sentences (the citing questions as references; never the release act's);
 * R55 (C40) `attest` asks the co-archive for a public https address and says which of the two confirmations is missing; R124 (C42) `adoptversion`
 * only where the newer copy was captured and has a reading chain (`moveOffer`); R3 (C95) the cite picker's search box, titles and dates; interface-shell
 * R111 (C94) members by `cs.memberName`; R96 (C17) "Read N of M words"; R126 (`resolvetestify`) and R127 (`contradictionflag`), DEC-394 (3d, 3e);
 * R117 (C41) a refused version names its unplaced legs by their documents' titles.
 *
 * T51 fix round 10 (R139; DEC-439 to DEC-441): `contradictionflag` is answered in the design's words (`screen.document.flag.recorded`, `.already`), the flags raised on the
 * document are listed (`contradictioncandidates` by `bundle`), a typed page a second member checked says who and when (`screen.document.attest.checked`), and "Find the people and
 * offices it names" (`resolve`, entities R11) is carried once the registry admits it (admit.mjs), saying `screen.document.people.none` when it matched none. */

import { checkOutcome } from "../screens-intake/index.mjs";
import { RE_POINTS } from "../interface-shell/index.mjs";
import { admitted } from "./admit.mjs";

/** R3: the reads that need only the document's id; the rest follow from its front matter. */
function reads(view) {
  const id = String(view.subject || "");
  /* interface-shell R113 (fix round 3, C14): a read says which acts change it (`after`), so an act re-reads only what it changes */
  return {
    capture: { op: "image", query: { id }, subject: true, empty: (v) => !v || typeof v !== "object" || !v["bundle.md"],
               after: ["release", "attest", "retire", "monitorset", "monitor"] },
    backlinks: { op: "backlinks", query: { target: id },
                 empty: (v) => !v || !Array.isArray(v.backlinks) || v.backlinks.length === 0, after: ["cite", "adoptversion", "keepversion"] },
    questions: { op: "list", query: { type: "inquiry", limit: "500" } },
  };
}

/** R8's project step: the project the document states, by its id. */
function place(view) {
  const d = view.data && view.data.capture;
  const text = d && d.state === "ok" && d.value && d.value["bundle.md"];
  const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text.split(/\n---\s*\n/)[0] || "") : null;
  if (!m) return {};
  const t = view.ui && view.ui.later && view.ui.later["project:" + m[1]];
  const ft = t && t.state === "ok" && t.value && typeof t.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(t.value["bundle.md"]) : null;
  let title = ft ? ft[1].trim() : "";
  try { if (title.startsWith("\"")) title = JSON.parse(title); } catch { /* raw */ }
  return { project: { id: m[1], title } };
}

/** R3, R5: the capture, its grade and note, its passages (each citable), its unread pages, its versions, what each question that
 *  rests on it asks of a newer copy, the record of this copy, its fingerprints, what cites it, the links it carries, the names
 *  it holds, its themes and steps, and its acts. */
function render(cs, view) {
  const id = String(view.subject || "");
  if (!id) return "";
  const ui = view.ui;
  const d = view.data || {};
  const later = (key, op, query) => {
    const L = ui.later || (ui.later = {});
    const q = JSON.stringify(query);
    if (!L[key] || L[key].q !== q) {
      L[key] = { q, state: "loading" };
      const settle = (o) => { L[key] = Object.assign({ q }, o); cs.set("later", L); };
      cs.call(op, { query }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        if (!a || a.ok === false || (r && r.ok === false))
          {
          const f = r && r.ok === false ? r : a || {};
          const code = String(f.code || f.reason || "");
          /* a refusal is drawn by its words: the plane's own, else the word held for the code, else "could not be read" */
          const held = ["NO_SUCH_DOCUMENT", "NO_BUNDLE", "NO_SHA", "VERSION_NOTICE_NO_INQUIRY", "VERSION_NOTICE_NO_SUBJECT"].includes(code);
          settle({ state: "failed", refusal: { code, words: f.translation ? cs.esc(f.translation) : held ? cs.w("refusal." + code) : code ? cs.esc(code) : cs.w("shell.unread") } });
        }
        else if (r && r.found === false) settle({ state: "empty" });
        else settle({ state: "ok", value: r });
      }, () => settle({ state: "failed", refusal: null }));
    }
    return L[key];
  };
  /* R78: a page the record counts from zero is drawn from one; a run of pages as "7–9", the value sent staying the record's */
  const pg = (p) => (Number.isInteger(p) && p >= 0 ? p + 1 : null);
  /* G38: a page of the reading, for `view.parts.readPages` (the reading is one op, its pages the same op after a cursor) */
  const readOf = (k, q) => later(k, "reading", q);
  const pagesText = (list) => {
    const n = list.slice().sort((a, b) => a - b), runs = [];
    for (const p of n) {
      const last = runs[runs.length - 1];
      if (last && p === last[1] + 1) last[1] = p; else runs.push([p, p]);
    }
    return runs.map(([a, b]) => (a === b ? String(a) : a + "–" + b)).join(", ");
  };
  const own = (key) => (ui.outcome && ui.outcome[key]
    ? `<p class="${ui.outcome[key].ok ? "mk-note" : "mk-msg"}" role="${ui.outcome[key].ok ? "status" : "alert"}" data-outcome="${key}">${ui.outcome[key].html}</p>` : "");
  /* a section that holds nothing is not drawn (R20): a read answered empty, or a body that draws nothing, makes no
     section; a read still pending or failed is drawn as such */
  const secOf = (titleKey, r, inner, opts) => {
    const read = typeof r === "string" ? d[r] : r;
    if (read && read.state === "empty") return "";
    const body = cs.state(read, inner);
    return body ? cs.sec(titleKey, body, opts) : "";
  };
  const doc = d.capture && d.capture.state === "ok" ? view.parts.front(d.capture.value["bundle.md"]) : null;
  if (doc) doc.source = doc.maps.source || {};
  /* R3, R32 (K3387): every capture read is keyed on the capture's own sha, from its provenance document (a testimony's
     too); never `content_hash`, which is the bundle's dataset digest (capture grammar C-2.7) */
  const prov = (() => {
    if (!doc) return null;
    let p = null;
    try { p = JSON.parse(String(d.capture.value["data/provenance.json"] || "")); } catch { p = null; }
    return p;
  })();
  const regDocs = prov && Array.isArray(prov.documents) ? prov.documents.filter((x) => x && typeof x === "object") : [];
  const sha = (() => {
    const s0 = regDocs[0] && regDocs[0].capture ? String(regDocs[0].capture.sha256 || "") : "";
    return /^[0-9a-f]{64}$/.test(s0) ? s0 : "";
  })();
  /* R65, R66: a copy that came as a set of files lists more than one entry of `documents` in its provenance register */
  const isSet = regDocs.length > 1;
  const locator = doc && doc.source ? String(doc.source.locator || "") : "";
  const out = [];
  const T = (k, f) => view.parts.plain(cs, k, f);
  const W = (k, f) => cs.w(k, f);
  /* C81: the shell's phone grid places a row's act by its position (the text beside the first part, the act below it); a row drawn with an empty
     first part leaves no first element, so its act took the text's column and was squeezed to its own width, cut at the screen's edge. A row
     that has an act is given a first part that draws nothing. */
  const rowOf = (a, b, c, meta) => cs.row(a === "" && c ? '<span aria-hidden="true"></span>' : a, b, c, meta);
  /* C94 (interface-shell R111): a member the record names is drawn by her handle (`cs.memberName`, the founder included), an id with no handle known
     by the kit's plain word, never the id; the module's own `who` only where the kit does not hold the function */
  const who = (x) => {
    const id = x && typeof x === "object" ? x : String(x == null ? "" : x).replace(/^(member:|token:)/, "");
    if (id === "") return "";
    return typeof cs.memberName === "function" ? cs.memberName(id) : view.parts.who(cs, x);
  };
  /* R6, R65: a moment with its time of day, through `time.at` ({date} by `cs.date`, {time} through `time.clock`, 12 hours) */
  const at = (iso) => {
    const t = new Date(String(iso || ""));
    if (!iso || isNaN(t.getTime())) return "";
    const h = t.getHours();
    const clock = W("time.clock", { hour: String(h % 12 === 0 ? 12 : h % 12), minute: String(t.getMinutes()).padStart(2, "0"), ampm: { html: W(h < 12 ? "time.am" : "time.pm") } });
    return W("time.at", { date: { html: cs.date(String(iso), { year: true }) }, time: { html: clock } });
  };
  const dayOf = (iso) => (iso ? cs.date(String(iso), { year: true }) : "");
  const undetermined = (raw) => W("state.undetermined", { reason: raw ? { html: `<span class="id">${cs.esc(String(raw))}</span>` } : "" });
  const shortOf = (h) => String(h).slice(0, 8) + "…" + String(h).slice(-4);
  const text = d.capture && d.capture.state === "ok" ? String(d.capture.value["bundle.md"] || "") : "";
  /* a member's firsthand observation (provenance's `op=testify`): her words, never an address to watch */
  const testimony = /Authored through op=testify/.test(text);
  const outside = /^https?:\/\//i.test(locator);
  /* R32, R39: the document's own title, never the address's last segment nor its id */
  const slug = outside ? decodeURIComponent(String(locator.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() || "")) : "";
  /* the head is set below, once the reading is known: the record's one rule for a document's name (R3, C25) */
  out.push(cs.title(T("state.undetermined", { reason: "" }), { thing: "document" }));
  if (!doc) { out.push(cs.state("capture", view, () => "")); return out.join(""); }
  const project = /^PROJ-/.test(String(doc.project || "")) ? String(doc.project) : "";
  const pimg = project ? later("project:" + project, "image", { id: project }) : null;
  /* R54: this copy's grade is `capturegrade`'s own answer for its digest, not the project's list of held captures; the row of
     that list (R49, R61) still says what the capture was held for. R55: the viewer's own held captures say whether this copy
     is hers and not yet vouched for. */
  /* R111 (L1): `heldcaptures` answers `{held: rows}` (capture R77), each row `{bundle_id, capture: {sha256}, captured_for, ...}` */
  const heldRows = (a) => (a && a.state === "ok" && a.value && Array.isArray(a.value.held) ? a.value.held : []);
  const isThis = (r) => !!r && ((r.capture && r.capture.sha256 === sha) || r.bundle_id === id);
  /* R3, R55, R111 (C16, C27, C95): ONE `heldcaptures` read, for this copy's row alone (`bundle_id`, capture R77: a row only for a copy the viewer
     may see, held or vouched, `state` `held_and_vouched`): the row says whether the copy is hers (its `actor`, the capture's) and not yet vouched
     for, and what it was held for (`captured_for`, kept after the copy is vouched). No row, no such data: the page is drawn as for any copy. */
  const meId = view.me && view.me.member ? String(view.me.member) : "";
  const held = sha ? later("held", "heldcaptures", { bundle_id: id, state: "held_and_vouched" }) : null;
  const row = heldRows(held).find(isThis) || null;
  /* R32, 06 §15 (K5157): the address an outside link, unquoted; a testimony's source drawn as its words; an upload (`upload:<64 hex>`, capture R108) says who brought the
     file and when (`document.uploaded.by`, as screens-intake R35 draws it in Held), never its address nor its fingerprint. The uploader is the copy's held row's `actor`. */
  const fromUpload = /^upload:/i.test(locator);
  const stamp = doc.source.retrieved ? String(doc.source.retrieved) : doc.created ? String(doc.created) : "";
  const uploader = row && typeof row.actor === "string" ? row.actor.replace(/^member:/, "") : "";
  out.push(`<p class="mk-sub">${fromUpload
    ? cs.w("document.uploaded.by", { member: cs.memberName(uploader), date: { html: stamp ? cs.date(stamp, { year: true }) : "" } })
    : cs.w("screen.document.captured", {
      date: { html: stamp ? cs.date(stamp, { year: true }) : "" },
      source: outside ? { html: `<a class="cs-btn" data-tone="quiet" href="${cs.esc(locator)}" rel="noopener noreferrer" target="_blank" data-outward="1">${cs.esc(locator)}</a>` }
        : (locator || doc.source.authority || "") })}</p>`);
  /* provenance R80 (K5153; WALK-FINAL-04B R146): the document's standing authority, as the register and the member's decisions state it together
     (`authority`, asked with `later()` as `origins` is): a determined one by its issuer and the dated basis the decision gave, an undetermined one by its basis
     (marked undetermined, and as reviewed where a member decided it so); a read that fails is drawn failed, one that answers nothing draws nothing */
  const au = sha ? later("authority", "authority", { bundleId: id, capture: sha }) : null;
  const auEntry = au && au.state === "ok" && au.value && Array.isArray(au.value.captures)
    ? (au.value.captures.find((c) => c && c.capture_sha === sha) || au.value.captures[0] || null) : null;
  const standing = auEntry && auEntry.authority && typeof auEntry.authority === "object" ? auEntry.authority : null;
  if (au && au.state === "failed") out.push(`<div data-authority="failed">${cs.state(au, () => "")}</div>`);
  else if (standing) {
    const det = standing.authority_state === "determined" && standing.authority;
    out.push(`<p class="mk-small" data-authority="${det ? "determined" : "undetermined"}"${standing.reviewed === true ? " data-reviewed=\"1\"" : ""}>`
      + (det ? `<b class="rec" data-authority-issuer="1">${cs.esc(String(standing.authority))}</b> ` : cs.mark("gap", "undetermined", { reason: "" }) + " ")
      + (standing.basis ? `<span class="meta" data-authority-basis="1">${cs.esc(String(standing.basis))}</span>` : "")
      + (standing.at ? ` <span class="meta">${cs.date(String(standing.at), { year: true })}</span>` : "") + "</p>");
  }
  const gr = sha ? later("grade", "capturegrade", { capture: sha }) : null;
  const gradeObj = gr && gr.state === "ok" && gr.value && gr.value.grade ? gr.value.grade : null;
  const letter = gradeObj && /^[A-D]$/.test(String(gradeObj.grade || "")) ? String(gradeObj.grade) : "";
  /* the capture's actor is a member's stamp (`member:<id>`); a row that names none, or another member's, is not hers (R55); a row of an older
     shape that states no `actor` at all is hers, as the viewer's own list always was */
  const actorId = row && typeof row.actor === "string" ? row.actor.replace(/^member:/, "") : null;
  const hers = !!row && (row.actor === undefined || (actorId !== null && actorId === meId));
  const isHeld = hers && String(row.standing || "collected") !== "verified";
  /* capture R77 (B27): a held row answers `whole` (true, false or null); only `whole: false` (a part of the capture is missing) withholds vouching and the OCR re-read */
  const incomplete = !!row && row.whole === false;
  /* R133 (fix round 10, cause 4; capture R110, R130): a copy that is an archive is stated as one, with the number of members it holds and a door to the archive screen, and is
     offered no read act, before or after any read: its members are read each by itself (the held row's own `archive`, never the archive's reading, which is the bare "not read as
     text" until a ledger's one attempt and then a size sentence it must never draw) */
  const archive = row && row.archive && typeof row.archive === "object" && Number.isInteger(row.archive.entries) && row.archive.entries >= 0 ? row.archive : null;
  const vouched = ui.outcome && ui.outcome.release && ui.outcome.release.ok === true;
  if (isHeld && !vouched && !incomplete) out.push(`<div class="mk-note" data-held="1"><p>${cs.w("document.held.says")}</p>`
    + cs.field("document-release-ack", "screen.document.release.ack", { area: true, rec: true })
    + cs.field("document-release-mitigation", "screen.document.release.mitigation", { area: true, rec: true })
    + cs.act("release", { label: "act.release.label.document", data: { document: id }, tone: "primary" }) + own("release") + "</div>");
  else if (vouched) out.push(`<p class="mk-note" data-vouched="1">${cs.w("document.vouched", { member: who(view.me && (view.me.member || view.me.handle) || ""), date: { html: cs.date(new Date(cs.now()).toISOString(), { year: true }) } })}</p>`);
  /* R113: a copy a member has stopped using says so, whatever page she meets it on; no second retirement is offered */
  const retiredNow = String(doc.current_state || "") === "retired";
  if (retiredNow) out.push(`<p class="mk-note" data-retired="1"><b>${cs.w("state.item.retired.name")}</b> ${cs.w("state.item.retired.means")}</p>`);
  const note = sha ? later("gradenote", "gradenote", { capture: sha }) : { state: "empty" };
  /* R3, R96: the reading is read as soon as the digest is known: its passages, and how complete its text is (full, partial, none or
     unread). A reading never made is unread; one made with no words in it holds none; one with pages it could not make out is partial. */
  const reading = sha ? later("reading", "reading", { sha256: sha }) : { state: "empty" };
  /* R97 (C22), C17: the typings are the document's `transcriptions` (content R57), read for any document with a digest; the typed words are the
     page's words, so a reading that holds none is not drawn as "Nothing here" above them */
  const ty = sha ? later("typed", "transcriptions", { bundleId: id }) : { state: "empty" };
  const typed = ty.state === "ok" && ty.value && Array.isArray(ty.value.transcriptions) ? ty.value.transcriptions.filter((t) => t && t.content_id) : [];
  const rv0 = reading.state === "ok" && reading.value && typeof reading.value === "object" ? reading.value : null;
  const words0 = rv0 && Array.isArray(rv0.text_units) ? rv0.text_units.filter((p) => p && String(p.text || "").trim()) : [];
  /* G14 (R96; extraction): the reading's own account of how complete it is, `completeness: {state, why?, skipped?}` (`whole`, `partial`, `stated`). A reading
     that states itself refused whole (its size or memory reason) names no pages that "have no text": its unread pages are the size's, not pictures of text. */
  const comp = rv0 && rv0.completeness && typeof rv0.completeness === "object" ? rv0.completeness : null;
  const compState = comp && ["whole", "partial", "stated"].includes(comp.state) ? comp.state : "";
  const blind0 = rv0 && compState !== "stated" && Array.isArray(rv0.unread_pages) ? rv0.unread_pages.filter((n) => Number.isInteger(n) && n >= 0) : [];
  /* R96 (fix round 6; G6, G8, G13): what the stored reading states. A reading that found no words and says why it did not (`reading.failure` `final`, with its
     `basis`) is a statement, not "none": it is drawn as that statement and offers no OCR re-read after it; a statement extraction states `repairable` (an old
     "(multipart)" final whose bytes now detect) offers "Read it" instead; a text reading with `more` is being read and is never drawn as complete. */
  const rdObj = rv0 && rv0.reading && typeof rv0.reading === "object" ? rv0.reading : null;
  const cellsHeld = !!rdObj && Array.isArray(rdObj.cells_held) && rdObj.cells_held.some((n) => typeof n === "string" && n !== "");
  const flagOf = (k) => !!rv0 && (rv0[k] === true || (!!rdObj && rdObj[k] === true));
  const failure = rv0 ? String((rdObj && rdObj.failure) || rv0.failure || "") : "";
  const isMore = flagOf("more"), isRepairable = flagOf("repairable");
  /* T51 fix round 10 (BOB B88, R96 fix round 6): a whole reading that found no words, whose reason is not a size, holds its statement (`completeness.why`, else `basis`)
     and is drawn as that statement, never as a bare "Undetermined / Held" */
  const wholeStated = compState === "whole" && !!((comp && typeof comp.why === "string" && comp.why.trim()) || (rdObj && typeof rdObj.basis === "string" && rdObj.basis.trim()));
  const textState = !sha ? "" : reading.state === "empty" ? "unread"
    : rv0 ? (isMore ? "reading" : compState === "stated" && !isRepairable ? "stated"
      : words0.length ? (compState === "partial" ? "cut" : blind0.length ? "partial" : "full")
      : isRepairable ? "repairable" : failure === "final" || wholeStated ? "stated" : compState === "partial" ? "cut" : "none") : "";
  /* G13 (R96): while the text is being read the page asks for it again on the page clock, at most every 10 seconds (as the dock does, R8), keeping what is
     drawn until the new answer arrives; a whole reading is not asked again. */
  if (isMore && sha && !ui.readPoll) {
    ui.readPoll = true;
    cs.later(10000, (k, v) => {
      v.ui.readPoll = false;
      k.call("reading", { query: { sha256: sha } }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        if (r && r.ok !== false && r.found !== false) k.set("later", Object.assign({}, v.ui.later, { reading: { q: JSON.stringify({ sha256: sha }), state: "ok", value: r } }));
      }, () => { /* the next render asks again */ });
    });
  }
  /* R96 (C17; reading-pipeline R35): the reading counts its words, `words_read` of `words_total`; drawn only when it states both */
  const wordsOf = (k) => { const v = rv0 ? (rv0[k] !== undefined ? rv0[k] : rv0.reading && typeof rv0.reading === "object" ? rv0.reading[k] : undefined) : undefined; return Number.isInteger(v) && v >= 0 ? v : null; };
  const wRead = wordsOf("words_read"), wTotal = wordsOf("words_total");
  /* G13 (R96; extraction R90): a text read in pieces states how far, `read_through` of `total` (bytes of text); the words of the first piece are not the capture's */
  const numOf0 = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
  const readThrough = rv0 ? numOf0(rv0.read_through) : null, readTotal = rv0 ? numOf0(rv0.total) : null;
  /* a size as the original-file card draws it (`size.*`) */
  const sizeWord = (n) => (n < 1024 ? T("size.small") : n >= 1073741824 ? T("size.gb", { n: (n / 1073741824).toFixed(1) })
    : n >= 1048576 ? T("size.mb", { n: (n / 1048576).toFixed(1) }) : T("size.kb", { n: String(Math.round(n / 1024)) }));
  /* R96 (fix round 10, causes 1, 2a; K5055): what a stored statement says is decided by the reading's OWN reason and figures (`reason`, `size`, `bound`, `name`/`metric`), never by the
     stored size of the file (`bytes`, the register's, which measures nothing that was refused). A figure is drawn in the unit it measures: bytes as `size.*`, and, where the size and the
     limit would print alike after rounding, as the exact count; a row, column, cell or object count as the exact count (its unit word is the row owed
     `screen.document.reading.unit.<metric>`, drawn when held, else the count alone). */
  const grouped = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const statedOf = (k) => (rdObj && rdObj[k] !== undefined ? rdObj[k] : rv0 ? rv0[k] : undefined);
  const stateReason = typeof statedOf("reason") === "string" ? String(statedOf("reason")) : "";
  const statedFig = (k) => (Number.isFinite(statedOf(k)) && statedOf(k) >= 0 ? Number(statedOf(k)) : null);
  const metricOf = (() => {
    const m = String(statedOf("metric") || statedOf("unit") || "").toLowerCase();
    const nm = String(statedOf("name") || "").toUpperCase();
    const pick = m || (/ROWS/.test(nm) ? "rows" : /COLUMNS/.test(nm) ? "columns" : /CELLS/.test(nm) ? "cells" : /OBJECTS/.test(nm) ? "objects" : "bytes");
    /* DEC-432 (B60): the `_chars` metrics (`text_chars`, `chars`) are the design's one unit `characters` */
    return /bytes?$/.test(pick) ? "bytes" : /(^|_)chars$|^characters$/.test(pick) ? "characters" : pick;
  })();
  const figure = (n, alike) => {
    if (metricOf === "bytes" && !alike) return sizeWord(n);
    const unit = metricOf === "bytes" ? "screen.document.reading.unit.bytes" : "screen.document.reading.unit." + metricOf;
    return heldWord(unit) ? T(unit, { n: grouped(n) }) : grouped(n);
  };
  /* G13: `op=reading` pages the passages (at most 4,096 an answer): `next` is the cursor for the rest, `after` asks for it. The member asks for more
     (`ui.readmore`, the number of pages wanted); each page is its own read, and what is drawn is never stated as the whole while `next` stands. */
  const wantPages = Math.max(1, Number(ui.readmore) || 1);
  const shownPages = view.parts.readPages(readOf, "readafter:", sha, rv0, null, wantPages - 1);
  const allUnits = shownPages.units;
  const pagesPending = shownPages.state === "loading", pagesFailed = shownPages.failed;
  const unitsCut = shownPages.more;
  /* a row of the design (DEC-418) when the words list holds it, else the nearest held row stands in (the row owed is named in the job record) */
  const heldWord = (key) => cs.w(key) !== key;
  /* R3, C25 (screens-intake R54; acquisition R98): ONE rule for a document's name, the one the capture screen follows: its own title (the reading's
     `title` once read, else the title the capture's document states), else its file name (an upload's own, or the name its source states, never
     the file part of an address unless the source states that very name), else its host and the day captured (`document.untitled.web`, never the
     host alone); a record id is never a name (R39) */
  const clean = (t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, 200) : "");
  const reg0 = regDocs[0] || {};
  const statedFile = clean(reg0.capture && reg0.capture.file_name) || clean(reg0.name_stated && reg0.name_stated.text);
  const readTitle = clean(rv0 && (rv0.title || (rv0.reading && typeof rv0.reading === "object" ? rv0.reading.title : "")));
  const frontTitle = clean(doc.title);
  const docTitle = readTitle || clean(reg0.title) || (frontTitle && frontTitle !== id && (frontTitle !== slug || frontTitle === statedFile) ? frontTitle : "");
  const named = docTitle || statedFile;
  /* R130 (fix round 9, G135a, G135e; X10, Ob9, S3; K4831 (3)): a kind no reader opens is named, and nothing is offered that would do nothing. The reading itself
     says it (`reason: UNSUPPORTED_FORMAT` with its `kind`, final: reading-pipeline R54), and that is the whole of the page's knowledge once a reading is held. A copy
     with no reading yet, or one an earlier release stated "not read as text" and `repairable`, is told apart by what the record states of its kind (its profiled
     format, the content type its source declared, the name of its file): a type listed here is one reading-pipeline has no reader for, so "Read it" would only
     state the same sentence. The list is the pipeline's own (its `unreadKindOf`); a kind it adds is drawn by `reading-pipeline.index.unsupported_kind`. */
  /* R131: the closed list of the kinds a unit names (reading-pipeline R47); `content.part_kind.<kind>` is the word of each */
  const PART_KINDS = ["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];
  const UNREAD_KINDS = ["rtf", "email", "legacy_word", "legacy_excel", "legacy_powerpoint", "legacy_office", "tiff", "gif", "webp", "heic", "avif", "bmp", "jp2", "ico"];
  const KIND_OF_TYPE = { "text/rtf": "rtf", "application/rtf": "rtf", "message/rfc822": "email", "application/msword": "legacy_word", "application/vnd.ms-excel": "legacy_excel",
    "application/vnd.ms-powerpoint": "legacy_powerpoint", "image/tiff": "tiff", "image/gif": "gif", "image/webp": "webp", "image/heic": "heic", "image/heif": "heic",
    "image/avif": "avif", "image/bmp": "bmp", "image/x-ms-bmp": "bmp", "image/jp2": "jp2", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico" };
  const KIND_OF_EXT = { rtf: "rtf", eml: "email", msg: "email", doc: "legacy_word", xls: "legacy_excel", ppt: "legacy_powerpoint", tif: "tiff", tiff: "tiff", gif: "gif",
    webp: "webp", heic: "heic", heif: "heic", avif: "avif", bmp: "bmp", jp2: "jp2", ico: "ico" };
  const recordKind = (() => {
    const prof = reg0.profile && typeof reg0.profile === "object" ? reg0.profile : {};
    const fmt = String((prof.format && typeof prof.format === "object" ? prof.format.format : prof.format) || "").toLowerCase();
    const type = String(prof.source_content_type || prof.content_type || "").toLowerCase().split(";")[0].trim();
    const ext = (/\.([a-z0-9]+)$/.exec(String(reg0.file || (reg0.capture && reg0.capture.file_name) || "").toLowerCase()) || [])[1] || "";
    if (KIND_OF_TYPE[type]) return KIND_OF_TYPE[type];
    if (UNREAD_KINDS.includes(fmt)) return fmt;
    return !type || type === "application/octet-stream" ? KIND_OF_EXT[ext] || "" : "";
  })();
  const readerKind = rv0 && (rdObj && rdObj.reason === "UNSUPPORTED_FORMAT" ? rdObj : rv0.reason === "UNSUPPORTED_FORMAT" ? rv0 : null);
  const noReader = readerKind ? String(readerKind.kind || "") || "undetermined" : textState === "unread" || textState === "repairable" ? recordKind : "";
  const basisOf = rdObj && typeof rdObj.basis === "string" ? rdObj.basis.trim() : "";
  /* "RTF is not read yet", "email is not read yet", "legacy Word is not read yet", "(type) is not read yet": the key of the kind when the words list holds it, else the
     sentence the reading itself states (the same words, the plane's), else nothing: never a raw key and never a sentence of this module's own */
  const unreadSaid = (k) => {
    if (k === "undetermined") return basisOf ? cs.esc(basisOf) : "";
    const key = UNREAD_KINDS.includes(k) ? "reading-pipeline.index.unsupported_" + k : "reading-pipeline.index.unsupported_kind";
    return heldWord(key) ? cs.w(key, { kind: k }) : basisOf ? cs.esc(basisOf) : "";
  };
  const unreadNote = noReader && unreadSaid(noReader) ? `<p class="mk-note" data-reading="unsupported" data-unsupported-kind="${cs.esc(noReader)}">${unreadSaid(noReader)}</p>` : "";
  let site = ""; if (outside) { try { site = new URL(locator).hostname; } catch { site = ""; } }
  out[0] = cs.title(named ? named : site ? T("document.untitled.web", { site, date: doc.source.retrieved ? cs.date(String(doc.source.retrieved), { year: true }) : "" }) : T("state.undetermined", { reason: "" }), { thing: "document" });
  /* R66: the head's fingerprint is the first one shortened, with its tip */
  out.push(`<div class="mk-facts"><div><span class="k">${cs.w("screen.document.copy")}</span><span class="v">`
    + (letter ? cs.grade(testimony ? "testimony" : "capture", letter) : "")
    + cs.act("gradenote", { label: "act.gradenote.label.document", data: { capture: sha, letter }, tone: "quiet" }) + "</span></div>"
    + (textState && !archive ? `<div><span class="v"><span data-text-state="${textState}"${["full", "none", "stated", "repairable"].includes(textState) ? "" : ' tabindex="0"'} data-level="1" data-tip="${cs.esc(cs.w("screen.document.text.tip"))}">`
      /* G13: a text still being read says so; the row owed (`screen.document.reading.beingread`) is stood in for by the nearest held row, `state.loading` */
      + (textState === "partial" ? cs.w("screen.document.text.partial", { pages: pagesText(blind0.map((n) => n + 1)) }) : textState === "unread" ? cs.mark("gap", "undetermined") + " " + cs.w("screen.document.text.unread")
        : textState === "cut" ? (comp && comp.why ? cs.esc(String(comp.why)) : cs.mark("gap", "undetermined"))
        : textState === "reading" ? (heldWord("screen.document.reading.progress") && readThrough !== null && readTotal !== null
          ? cs.w("screen.document.reading.progress", { read: sizeWord(readThrough), total: sizeWord(readTotal) })
          : cs.w("state.loading") + (readThrough !== null && readTotal !== null ? " " + sizeWord(readThrough) + " / " + sizeWord(readTotal) : "")) : "") + "</span>"
      + (wRead !== null && wTotal !== null && textState !== "reading" ? ` <span class="mk-small" data-words-read="1">${cs.w("screen.document.text.read", { read: String(wRead), total: String(wTotal) })}</span>` : "") + "</span></div>" : "")
    + (sha ? `<div><span class="k">${cs.w("screen.document.fingerprint")}</span><span class="v"><span class="mk-tag" tabindex="0" data-level="1" data-tip="${cs.esc(cs.w("screen.document.fingerprint.means"))}">${cs.esc(sha.slice(0, 4) + "…" + sha.slice(-4))}</span></span></div>` : "")
    + (sha ? `<div><a class="cs-btn" data-tone="quiet" href="/app/open-file/${cs.esc(sha)}">${cs.w("screen.document.open")}</a></div>` : "") + "</div>");
  /* R133: the archive's own statement: that it is an archive and how many members it holds (`screen.document.archive.says` {n}, the row owed; the Held list's own rows say the same
     in the meantime), and the door to the archive screen (`screen.held.archivefiles`, as the Held list draws it); no read act is drawn for it (below) */
  if (archive) {
    const members = archive.entries;
    const says = heldWord("screen.document.archive.says") ? cs.w("screen.document.archive.says", { n: String(members) })
      : cs.w("screen.held.archive", { parts: { html: cs.w("screen.archive.facts.entries", { entries: String(members) }) } });
    const archiveSha = typeof archive.sha256 === "string" && /^[0-9a-f]{64}$/.test(archive.sha256) ? archive.sha256 : sha;
    out.push(`<div class="mk-note" data-archive="${members}"><p>${says}</p>`
      + (archiveSha ? `<p class="meta">${cs.ref("archive", archiveSha, T("screen.held.archivefiles"), [named])}</p>` : "") + "</div>");
  }
  /* R132 (fix round 9, G136e; S13 (i); K4831 (6) (a)): reading does not wait for the scan, said plainly on the page of a copy that was filed (file-safety's own row: the sentence
     claims nothing of what a scan will find, and does not say that a found threat's text has left search, which waits on the scanner having signatures). A testimony is
     no file and is scanned by no one, so it carries none. */
  if (sha && !testimony && heldWord("file-safety.index.reading_is_not_gated")) out.push(`<p class="mk-small" data-scan-policy="1">${cs.w("file-safety.index.reading_is_not_gated")}</p>`);
  /* G41 (D5; K4636): a sheet whose cells the reading does not list (`cells_held`, the names of the sheets) says what is interpreted: its text is read whole and
     searchable, its cells are made for a range when it is opened or cited. One quiet line, read by key; never while the text is still being read (the sentence
     says the text is whole), and never for a reading that names no held sheet. */
  if (cellsHeld && textState !== "reading") out.push(`<p class="mk-small" data-cells-held="1">${cs.w("screen.document.cells_held")}</p>`);
  /* R134 (fix round 10, cause 37; K5055; reading-pipeline R49): the encoding is named only when it was ASSUMED (`encoding_assumed`: no byte-order mark and no declared charset
     decided it); one a BOM or a declaration decided is said nothing of. The sentence is the row owed `screen.document.encoding.assumed` ({name}); until it is held the name
     alone is drawn, in the data face. */
  {
    const encName = typeof statedOf("encoding") === "string" ? String(statedOf("encoding")).trim() : "";
    if (encName && statedOf("encoding_assumed") === true && textState !== "reading")
      out.push(`<p class="mk-small" data-encoding-assumed="${cs.esc(encName)}">${heldWord("screen.document.encoding.assumed") ? cs.w("screen.document.encoding.assumed", { name: encName }) : `<span class="id">${cs.esc(encName)}</span>`}</p>`);
  }
  /* R135 (fix round 10, cause 38; capture-sources R49): a page captured by rendering says that its copy is the page's first load (not scrolled, banners and dialogs not dismissed,
     frames and shadow content absent), in the words of the statement the capture's gaps hold (`render.undetermined`, `RENDER_COPY_STATEMENT`); a plain capture holds none and draws none */
  {
    const COPY = "capture-sources.render.copy_first_load_not_scrolled";
    const gaps = reg0.render && Array.isArray(reg0.render.undetermined) ? reg0.render.undetermined.filter((g) => typeof g === "string") : [];
    if (heldWord(COPY) && gaps.some((g) => g.trim() === T(COPY).trim())) out.push(`<p class="mk-small" data-render-copy="1">${cs.w(COPY)}</p>`);
  }
  /* R62 (reading-pipeline; DEC-432, B60): what the structure read repaired, as the reading lists it (`recovery_notes`: `xref_reconstructed`, `pdf_truncated`, and `pages_missing` with the
     count `missing` of `of`), each by the design's key `screen.document.recovery.<note>`; a sound file lists none and draws none, and a note this page holds no sentence for is not drawn */
  {
    const notes = Array.isArray(statedOf("recovery_notes")) ? statedOf("recovery_notes") : [];
    for (const n of notes) {
      if (!n || typeof n !== "object" || !["xref_reconstructed", "pdf_truncated", "pages_missing"].includes(n.note)) continue;
      const key = "screen.document.recovery." + n.note;
      if (n.note === "pages_missing" && !(Number.isInteger(n.missing) && Number.isInteger(n.of))) continue;
      out.push(`<p class="mk-small" data-recovery="${n.note}">${cs.w(key, n.note === "pages_missing" ? { missing: String(n.missing), of: String(n.of) } : {})}</p>`);
    }
  }
  /* R136 (fix round 10, cause 38; acquisition R119): the pictures a web capture kept as bytes and never read, with their number and total size (`supporting.pictures_unread`);
     the sentence is the row owed `screen.document.supporting.pictures` ({count}, {size}; `.one` for one); until it is held the figures alone are drawn */
  {
    const supP = reg0.capture && reg0.capture.supporting && typeof reg0.capture.supporting === "object" ? reg0.capture.supporting : reg0.supporting && typeof reg0.supporting === "object" ? reg0.supporting : null;
    const pu = supP && supP.pictures_unread && typeof supP.pictures_unread === "object" ? supP.pictures_unread : null;
    /* DEC-432 (B60): drawn only when the size is known; a count with no size draws nothing, never the sentence with a hole in it */
    if (pu && Number.isInteger(pu.count) && pu.count > 0 && Number.isFinite(pu.bytes) && pu.bytes >= 0) {
      const key = pu.count === 1 && heldWord("screen.document.supporting.pictures.one") ? "screen.document.supporting.pictures.one" : "screen.document.supporting.pictures";
      const size = Number.isFinite(pu.bytes) && pu.bytes >= 0 ? sizeWord(pu.bytes) : "";
      out.push(`<p class="mk-small" data-pictures-unread="${pu.count}">${heldWord(key) ? cs.w(key, { count: String(pu.count), size }) : cs.esc(String(pu.count)) + (size ? " · " + cs.esc(size) : "")}</p>`);
    }
  }
  /* G19 (fix round 6; acquisition), G110b (fix round 9; K4853): the supporting files a web capture kept and skipped (`supporting: {kept, skipped, total, reasons,
     not_walked}` on the register document): "N of M supporting files kept" (`screen.capture.supporting.kept`, the Add screen's own row) and, for each kind of
     reason, one sentence by its key with the count of the codes sharing it (`CAP_REACHED` the cap, `TOO_LARGE` and `BUDGET_EXHAUSTED` too large, any other code
     unavailable). The answer's `detail` (the renderer's or the browser's own words) and the bare `not_walked` code are never drawn: a page that was not walked at all
     says so by the sentence of its code's kind (`screen.document.supporting.notwalked.<kind>`, the row owed, stood in as its key). Nothing is drawn when none was
     skipped and the page was walked. */
  {
    const sup = reg0.capture && reg0.capture.supporting && typeof reg0.capture.supporting === "object" ? reg0.capture.supporting : reg0.supporting && typeof reg0.supporting === "object" ? reg0.supporting : null;
    const kept = sup ? Number(sup.kept) : NaN, skipped = sup ? Number(sup.skipped) : NaN;
    const notWalked = sup && typeof sup.not_walked === "string" ? sup.not_walked : "";
    if (Number.isFinite(kept) && (skipped > 0 || notWalked)) {
      const total = Number.isFinite(Number(sup.total)) ? Number(sup.total) : kept + (Number.isFinite(skipped) ? skipped : 0);
      const why = {};
      for (const r of Array.isArray(sup.reasons) ? sup.reasons : []) {
        if (!r || typeof r !== "object") continue;
        const code = String(r.reason || r.code || ""), n = Number.isFinite(r.count) && r.count > 0 ? r.count : 1;
        const kind = code === "CAP_REACHED" && Number.isFinite(r.limit) ? "cap" : code === "TOO_LARGE" || code === "BUDGET_EXHAUSTED" ? "toolarge" : "unavailable";
        why[kind] = why[kind] || { n: 0, cap: kind === "cap" ? r.limit : 0 };
        why[kind].n += n;
      }
      const lines = ["cap", "toolarge", "unavailable"].filter((k) => why[k])
        .map((k) => `<p class="mk-small muted" data-supporting-why="${k}">${cs.w("screen.capture.supporting." + k, { n: String(why[k].n), cap: String(why[k].cap) })}</p>`).join("");
      const stopped = notWalked ? (/^(TOO_LARGE_TO_PARSE|PRIMARY_TOO_LARGE)$/.test(notWalked) ? "toolarge" : notWalked === "RENDER_PENDING" ? "pending" : "unavailable") : "";
      out.push(`<div class="mk-note" role="status" data-supporting="1">${skipped > 0 ? `<p>${cs.w("screen.capture.supporting.kept", { kept: String(kept), total: String(total) })}</p>` : ""}${lines}`
        + (stopped ? `<p class="mk-small muted" data-supporting-notwalked="${stopped}">${cs.w("screen.document.supporting.notwalked." + stopped)}</p>` : "") + "</div>");
    }
  }
  if (ui.gradenote) {
    const n = ui.gradenote.note;
    /* R35a (fix round 10, cause 35a): a copy with no grade has a heading that says it is not graded (`screen.document.gradenote.head.ungraded`, the row owed; the held
       "not graded yet" of the unrated mark stands in), never "Why {letter}?" filled with the undetermined word and an empty reason */
    const headKey = letter ? "screen.document.gradenote.head" : heldWord("screen.document.gradenote.head.ungraded") ? "screen.document.gradenote.head.ungraded" : "mark.gap.unrated.means";
    out.push(cs.sec(headKey, n
      ? `<p>${cs.esc(typeof n === "string" ? n : (n.says || n.text || n.how || JSON.stringify(n)))}</p>`
      : `<p>${cs.w("screen.document.gradenote.none")}</p>`, letter ? { fills: { letter } } : {}));
  }
  /* a testimony offers Find in as a link (screens-daily R26); any other document as the act */
  if (sha) out.push(testimony ? `<p><a class="cs-btn" data-tone="quiet" href="/app/find-in/${cs.esc(sha)}" data-nav data-findin="link">${cs.w("act.findin.label.document")}</a></p>`
    : cs.act("findin", { label: "act.findin.label.document", data: { capture: sha } }));

  /* passages: the reading's, each citable in a question the member chooses (citation R1's `found`) */
  const qs = d.questions && d.questions.state === "ok" && Array.isArray(d.questions.value.bundles) ? d.questions.value.bundles : [];
  /* R49 (K3560): the question the capture was held for (its held row's `captured_for`, the questions she may see) is
     preselected, else none is; the document's own project's questions come first, then the others she may cite into */
  const pq = project ? later("projectq:" + project, "projectquestions", { project, limit: "100" }) : { state: "empty" };
  const ownQ = new Set(pq.state === "ok" && Array.isArray(pq.value.items) ? pq.value.items.filter((x) => x && x.inquiry).map((x) => String(x.inquiry)) : []);
  const heldFor = row && row.captured_for && Array.isArray(row.captured_for.questions) ? row.captured_for.questions.filter((x) => x && x.question) : [];
  /* R118 (A6, I-11), C16 (P3): a question is named with its project. The document's own project's questions are ONE `projectquestions` read (above);
     a project's questions are never read one project at a time. The project of any other question is the one its list row states (`project`),
     else, only where its title is another candidate's too (the two are told apart by their project, C35), the one its own `image` states: a read for
     each such question, never for each project. A question whose project is not known is named by its title alone. */
  const plist = later("projects", "projectlist", { limit: "200" });
  const projects = plist.state === "ok" && plist.value && Array.isArray(plist.value.projects) ? plist.value.projects.filter((x) => x && x.id) : [];
  const projectName = new Map(projects.map((x) => [String(x.id), String(x.name || x.title || "")]));
  const ownTitle = (() => {
    const t = pimg && pimg.state === "ok" && pimg.value && typeof pimg.value["bundle.md"] === "string" ? view.parts.front(pimg.value["bundle.md"]).title : "";
    return t ? String(t) : (project ? projectName.get(project) || "" : "");
  })();
  const projectOf = new Map();
  if (project && ownTitle) for (const qid of ownQ) projectOf.set(qid, ownTitle);
  const titleCount = new Map();
  for (const q of qs) { const t = String(q.title || q.bundle_id); titleCount.set(t, (titleCount.get(t) || 0) + 1); }
  for (const q of qs) {
    const qid = String(q.bundle_id);
    if (projectOf.has(qid)) continue;
    let pid = /^PROJ-/.test(String(q.project || "")) ? String(q.project) : "";
    if (!pid && titleCount.get(String(q.title || q.bundle_id)) > 1 && pq.state !== "loading" && plist.state !== "loading") {
      const qi = later("qimg:" + qid, "image", { id: qid });
      const qf = qi.state === "ok" && qi.value && typeof qi.value["bundle.md"] === "string" ? view.parts.front(qi.value["bundle.md"]) : null;
      pid = qf && /^PROJ-/.test(String(qf.project || "")) ? String(qf.project) : "";
    }
    if (pid && projectName.get(pid)) projectOf.set(qid, projectName.get(pid));
  }
  const optionOf = (value, title) => (projectOf.get(value) ? { value, key: "screen.document.cite.option", fills: { question: title, project: projectOf.get(value) } } : { value, text: title });
  const askable = qs.map((q) => ({ value: String(q.bundle_id), title: String(q.title || q.bundle_id), created: q.created ? String(q.created) : "" }));
  for (const c of heldFor) if (!askable.some((o) => o.value === String(c.question))) askable.push({ value: String(c.question), title: String(c.title || c.question), created: "" });
  const preset = heldFor.length ? String(heldFor[0].question) : "";
  /* C95 (R3): the picker is narrowed by the text typed in its search box (the title, whatever the case), the question chosen kept though the search
     hides it; each option carries its title and, where the list row states it, its date as data text (`screen.document.cite.option` has no
     date fill, so the date is joined to the title in `cs.date`'s plain form) */
  const needle = String(ui.citeSearch || "").trim().toLowerCase();
  const keepQ = String(ui.citeQuestion || preset || "");
  const plainDate = (iso) => String(iso ? cs.date(String(iso), { year: true }) : "").replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const shownQ = askable.filter((o) => !needle || o.value === keepQ || o.title.toLowerCase().includes(needle));
  /* C95 (R3): the question the page's copy was held for leads the list, then the document's own project's questions, then the rest */
  const rank = (o) => (preset && o.value === preset ? 0 : ownQ.has(o.value) ? 1 : 2);
  const cites = shownQ.slice().sort((a, b) => rank(a) - rank(b))
    .map((o) => optionOf(o.value, o.created && plainDate(o.created) ? o.title + " \u00b7 " + plainDate(o.created) : o.title));
  /* the reading section is built once the revisions it compares are read (R81), in the slot it holds here */
  const readingAt = out.push("") - 1;
  const readingBody = () => secOf("document.read.title", reading, (r) => {
    /* K3387: the document's words are the reading's `text_units` (extraction R36's units, in seq order, withheld as
       the bundle is); a reading answers no other text, and with none the section says it holds nothing */
    if (archive) return originalCard;
    const list = allUnits.filter((p) => p && String(p.text || "").trim());
    /* G6, G8 (R96; DEC-418): a copy the reading states it did not read is drawn as that statement, beside the file's size (the card above), never as
       "Nothing here": by the design's `screen.document.reading.stated` (with the size) or `.reading.repairable` where the words list holds them, else the plane's
       own words (the stand-in; the rows are owed to T52's list). */
    const basisWords = rdObj && typeof rdObj.basis === "string" ? rdObj.basis.trim() : "";
    /* G41 (D3; K4645): a reading stated too large to keep whole carries `too_large: {bytes, key}` beside its `basis` sentence: the size of its largest part and its key */
    const tl = rdObj && rdObj.too_large && typeof rdObj.too_large === "object" ? rdObj.too_large : rv0 && rv0.too_large && typeof rv0.too_large === "object" ? rv0.too_large : null;
    const tooLarge = tl && Number.isFinite(tl.bytes) && tl.bytes >= 0 && typeof tl.key === "string" ? tl : null;
    /* R130 (G135b): a picture the OCR member refused is drawn by the word held for the member's own reason (`ocr_refused[].reason`, as reading-pipeline carries
       `refusal.render.reason`), each reason once, never the size sentence or the generic "declined (PAGE_NOT_RENDERABLE)"; a reason with no held word is not drawn raw */
    const refusedCodes = [...new Set((rdObj && Array.isArray(rdObj.ocr_refused) ? rdObj.ocr_refused : []).map((r) => (r && typeof r.reason === "string" ? r.reason : "")).filter((c) => /^[A-Z][A-Z0-9_]*$/.test(c) && heldWord("refusal." + c)))];
    const refusedSaid = refusedCodes.map((c) => cs.w("refusal." + c)).join(" ");
    /* R96 (fix round 10, causes 1, 2a): the reading's own reason decides the sentence. A size refusal (`TOO_LARGE`) is `screen.document.reading.toolarge` with the reading's own
       size and limit, the stored size of the file never drawn as the refused figure; any other final reading is the word held for its reason (`refusal.<reason>`), else the statement
       the reading states (its `completeness.why`, else its `basis`), and is never worded as a size. */
    const refusedFig = statedFig("size"), boundFig = statedFig("bound");
    const alike = metricOf === "bytes" && refusedFig !== null && boundFig !== null && sizeWord(refusedFig) === sizeWord(boundFig);
    const sizeSaid = stateReason === "TOO_LARGE" && refusedFig !== null
      ? (boundFig !== null && heldWord("screen.document.reading.toolarge") ? cs.w("screen.document.reading.toolarge", { size: figure(refusedFig, alike), limit: figure(boundFig, alike) })
        : heldWord("screen.document.reading.stated") ? cs.w("screen.document.reading.stated", { size: figure(refusedFig, alike) }) : "") : "";
    const reasonSaid = stateReason && stateReason !== "TOO_LARGE" && /^[A-Z][A-Z0-9_]*$/.test(stateReason) && heldWord("refusal." + stateReason) ? cs.w("refusal." + stateReason) : "";
    const statedSaid = textState === "stated" && tooLarge ? cs.w("screen.document.reading.too_large", { size: sizeWord(tooLarge.bytes), key: tooLarge.key })
      : textState === "stated" && sizeSaid ? sizeSaid
      : textState === "stated" && refusedSaid ? refusedSaid
      : textState === "stated" && reasonSaid ? reasonSaid
      : textState === "repairable" && heldWord("screen.document.reading.repairable") ? cs.w("screen.document.reading.repairable")
      : comp && typeof comp.why === "string" && comp.why.trim() ? cs.esc(comp.why.trim()) : basisWords ? cs.esc(basisWords) : undetermined("");
    /* T51 fix round 10 (B88): a whole reading that states its own reason (not a size) draws that statement beside its words, as a stated one does */
    const statedHtml = noReader && unreadNote ? unreadNote : textState === "stated" || textState === "repairable" || (wholeStated && stateReason !== "TOO_LARGE") ? `<p class="mk-note" data-reading="stated">${statedSaid}</p>` : "";
    /* G13 (R96): a text still being read says how far it has come (R90), and what is drawn of it is never stated as the whole: the passages drawn so far
       ("Passages: N of M", the nearest held words; the row owed is `screen.document.reading.firstn`), with the more act the page bar's own control (the
       choice redraws the page and the next page is read: `op=reading` with `after`). Search and Cite cover what is read, which is what is drawn and stored. */
    const progressSaid = isMore ? (heldWord("screen.document.reading.progress") && readThrough !== null && readTotal !== null
      ? cs.w("screen.document.reading.progress", { read: sizeWord(readThrough), total: sizeWord(readTotal) })
      : cs.w("state.loading") + (readThrough !== null && readTotal !== null ? " " + sizeWord(readThrough) + " / " + sizeWord(readTotal) : "")) : "";
    const unitsTotal = rv0 && Number.isInteger(rv0.units_total) && rv0.units_total >= 0 ? rv0.units_total : null;
    const cutSaid = unitsCut || pagesPending ? `${cs.w("screen.document.passages.head")}: ${allUnits.length}${unitsTotal !== null ? " / " + unitsTotal : ""}` : "";
    const moreControl = unitsCut && !pagesPending ? cs.checks("document-read-more", "screen.document.passages.head", [{ value: String(wantPages + 1), key: "document.read.next", on: false }], { radio: true, redraw: "readmore" }) : "";
    /* B38 (DEC-418): while a text is being read, "until the whole file is read, searching and citing cover only what has been read so far" beside the progress; once a
       text read in pieces is whole (`more` false, `total` stated), "read in full" (`screen.document.text.full` stands in until the row is held) */
    const partialSaid = isMore && heldWord("screen.document.reading.partial") ? cs.w("screen.document.reading.partial") : "";
    const doneSaid = !isMore && readTotal !== null && textState === "full" ? (heldWord("screen.document.reading.done") ? cs.w("screen.document.reading.done") : cs.w("screen.document.text.full")) : "";
    const moreNote = progressSaid || partialSaid || doneSaid || cutSaid || pagesFailed ? `<div class="mk-small" data-reading="more">${[progressSaid, partialSaid, doneSaid, cutSaid].filter(Boolean).map((t) => `<p>${t}</p>`).join("")}`
      + (pagesPending ? cs.state({ state: "loading" }, () => "") : "") + (pagesFailed ? cs.state(pagesFailed, () => "") : "") + moreControl + "</div>" : "";
    if (!list.length) return originalCard + moreNote + (typed.length || isMore ? "" : statedHtml || `<p class="cs-state" data-state="empty">${cs.w("state.empty")}</p>`);
    /* nothing is preselected unless the capture was held for a question: then the first choice says to choose one, never a blank
       (R118); a cite with it unchosen is refused in place */
    const pick = askable.length
      ? cs.field("document-cite-search", "shell.search", { typing: (c, v, value) => c.set("citeSearch", String(value || "")) })
        + cs.choice("document-cite-question", "screen.document.cite.question", (preset ? [] : [{ value: "", key: "screen.document.cite.choose" }]).concat(cites), { value: preset, redraw: "citeQuestion" })
        + cs.choice("document-cite-role", "screen.document.cite.role",
            [["supports", "screen.question.supports.head"], ["cuts_against", "screen.question.against.head"]], { value: "supports" })
      : `<p class="mk-small">${cs.w("screen.document.cite.noquestion")}</p>`;
    const pickHelp = askable.length ? `<p class="mk-small">${cs.w("screen.document.cite.question.help")}</p><p class="mk-small">${cs.w("document.read.cite.help")}</p>` : "";
    /* R125 (C31): the question chosen (the choice redraws the page: `ui.citeQuestion`), else the one the copy was held for, else the one the last cite
       went into; a passage is marked as cited by it when it holds a leg on this document at that passage. A leg's part is what `citation` writes from
       `found.extent`, each field `f` as `extent_f` (its R1), so a passage's extent is matched field by field to the leg's. */
    const chosenQ = String(ui.citeQuestion || preset || (ui.citeDone && ui.citeDone.question) || "");
    const chosenImg = chosenQ ? later("qimg:" + chosenQ, "image", { id: chosenQ }) : null;
    const chosenFront = chosenImg && chosenImg.state === "ok" && chosenImg.value && typeof chosenImg.value["bundle.md"] === "string" ? view.parts.front(chosenImg.value["bundle.md"]) : null;
    const extentBag = (e) => {
      const bag = {};
      for (const [k, v] of Object.entries(e && typeof e === "object" ? e : {})) {
        if (v === undefined || v === null) continue;
        bag["extent_" + k] = Array.isArray(v) ? "[" + v.join(", ") + "]" : typeof v === "object" ? JSON.stringify(v) : String(v);
      }
      return bag;
    };
    const legAt = (leg, e) => {
      const bag = extentBag(e);
      const keys = Object.keys(bag).filter((k) => k !== "extent_kind");
      if (!keys.length) return false;
      if (leg.extent_kind !== undefined && leg.extent_kind !== "" && bag.extent_kind !== undefined && String(leg.extent_kind) !== bag.extent_kind) return false;
      return keys.every((k) => String(leg[k] === undefined ? "" : leg[k]) === bag[k]);
    };
    const citedHere = (e) => !!chosenFront && (chosenFront.lists.basis || []).some((l) => l && String(l.target) === id && legAt(l, e));
    /* R131 (fix round 9, G134d): the kind of part a passage came from, in the member's words by key, for a unit that carries one of the closed list; a unit stored
       without a kind (a reading made before the kind existed) draws none and is never given `body` by guess */
    const partKind = (u) => {
      const k = u && typeof u.kind === "string" ? u.kind : "";
      return PART_KINDS.includes(k) && heldWord("content.part_kind." + k) ? `<span class="mk-small" data-part-kind="${k}">${cs.w("content.part_kind." + k)}</span>` : "";
    };
    const citedMark = (e) => {
      if (!citedHere(e)) return "";
      const named = askable.find((o) => o.value === chosenQ);
      const qtitle = chosenFront.title ? String(chosenFront.title) : named ? named.title : "";
      return `<span class="mk-small" data-passage-cited="${cs.esc(chosenQ)}"><b>${W("screen.finder.cite.cited")}</b> ${cs.ref("question", chosenQ, qtitle || T("state.undetermined", { reason: "" }), [qtitle])}</span>`;
    };
    /* C30: what the last cite did, drawn beside the passages: cited, or already resting on a passage of this document (which one, and the
       question to narrow it on). The question's own legs on this document name the passage, at the record's page + 1 (R78). */
    const citeDoneHtml = () => {
      const cd = ui.citeDone && typeof ui.citeDone === "object" ? ui.citeDone : null;
      if (!cd || !cd.question || (!cd.cited.length && !cd.already.length)) return "";
      const qi = later("qimg:" + cd.question, "image", { id: cd.question });
      const qf = qi.state === "ok" && qi.value && typeof qi.value["bundle.md"] === "string" ? view.parts.front(qi.value["bundle.md"]) : null;
      const named = askable.find((o) => o.value === cd.question);
      const qtitle = qf && qf.title ? String(qf.title) : named ? named.title : "";
      const ref = cs.ref("question", cd.question, qtitle || T("state.undetermined", { reason: "" }), [qtitle]);
      if (cd.cited.length) return `<p class="mk-note" data-cite-done="cited" role="status"><b>${W("screen.finder.cite.cited")}</b> ${ref}</p>`;
      const places = (qf ? qf.lists.basis || [] : []).filter((l) => l && String(l.target) === id && l.extent_page !== undefined && l.extent_page !== "")
        .map((l) => pg(Number(l.extent_page))).filter((n) => n !== null);
      return `<p class="mk-note" data-cite-done="already" role="status"><b>${W("screen.finder.a17.left_as_it_was")}</b> ${W("screen.finder.a17.the_question_already_cited_it")}`
        + (places.length ? " · " + places.map((n) => W("screen.document.passage.where", { page: n })).join(", ") : "") + ` · ${ref}</p>`;
    };
    const none = ui.citeNone ? `<details class="mk-details" data-cite="none" open><summary>${cs.w("screen.document.cite.none.summary")}</summary><p class="mk-small">${cs.w("screen.find-in.questionfirst")}</p></details>` : "";
    /* R80, R78: the reading's pages (an extent's page counts from 0, a slide from 1) drawn from one, one at a time, with the kit's
       choice control (interface-shell R90) redrawing in the page: no op, no new read. A text of one page draws no page bar. */
    const numOf = (p) => { const e = p.extent && typeof p.extent === "object" ? p.extent : null;
      if (e && e.kind === "pdf-page" && Number.isInteger(e.page) && e.page >= 0) return e.page + 1;
      if (e && /^slide/.test(String(e.kind || "")) && Number.isInteger(e.slide) && e.slide >= 1) return e.slide;
      return null; };
    const nums = list.map(numOf).filter((n) => n !== null);
    const unreadN = Array.isArray(r.unread_pages) ? r.unread_pages.filter((n) => Number.isInteger(n) && n >= 0).map((n) => n + 1) : [];
    const pdfTotal = nums.length ? Math.max(...nums, ...unreadN) : 0;
    const pagedByNumber = pdfTotal > 1;
    /* R112 (L5): a reading whose passages carry no page is drawn in blocks of a stated size (20 passages), with the same page bar, so a
       captured web page of hundreds of passages is not drawn whole, each with its own Cite control */
    const BLOCK = 20;
    const blocks = pagedByNumber ? 0 : Math.ceil(list.length / BLOCK);
    const blocked = blocks > 1;
    const paged = pagedByNumber || blocked;
    const total = pagedByNumber ? pdfTotal : blocked ? blocks : 0;
    const first = pagedByNumber ? Math.min(...nums) : blocked ? 1 : 0;
    const asked = Number(ui.readpage);
    const cur = paged ? (Number.isInteger(asked) && asked >= 1 && asked <= total ? asked : first) : 0;
    const shown = pagedByNumber ? list.map((p, i) => [p, i]).filter(([p]) => { const n = numOf(p); return n === cur || (n === null && cur === first); })
      : blocked ? list.map((p, i) => [p, i]).slice((cur - 1) * BLOCK, cur * BLOCK) : list.map((p, i) => [p, i]);
    /* R81: the second tab, the comparison with the revision a question cites, is drawn only where that revision is found (citedRev);
       the compare tab shows the comparison in place of the passages and their pages */
    const compareOn = citedRev >= 0 && ui.readtab === "compare";
    const tabs = paged || citedRev >= 0 ? cs.checks("document-read-tab", "document.read.title",
      [{ value: "page", key: "document.read.tab.page", on: !compareOn }].concat(citedRev >= 0 ? [{ value: "compare", key: "document.read.tab.compare", on: compareOn }] : []),
      { radio: true, redraw: "readtab" }) : "";
    if (compareOn) return originalCard + tabs + compareTab();
    const bar = paged ? `<div class="mk-pagebar" data-pagebar="1">` + tabs
      + cs.checks("document-read-page", { key: "document.read.page", fills: { n: String(cur), count: String(total) } },
          (cur > 1 ? [{ value: String(cur - 1), key: "document.read.prev", on: false }] : []).concat(cur < total ? [{ value: String(cur + 1), key: "document.read.next", on: false }] : []),
          { radio: true, redraw: "readpage" }) + "</div>" : tabs;
    return originalCard + (textState === "stated" || (wholeStated && stateReason !== "TOO_LARGE") ? statedHtml : "") + moreNote + `<p class="mk-small">${cs.w("document.read.select")}</p>` + bar + (shown.length ? "" : `<p class="cs-state" data-state="empty">${cs.w("state.empty")}</p>`) + shown.map(([p, i]) => {
      const extent = p.extent && typeof p.extent === "object" ? p.extent : null;
      /* R78: the record's page 0 is drawn "Page 1"; the extent a citation sends keeps the record's own number */
      const page = extent && Number.isInteger(extent.page) ? pg(extent.page) : null;
      return `<blockquote class="mk-passage rec" data-passage="${i}">“${cs.esc(String(p.text).trim())}”`
        + (page !== null ? `<span class="mk-small">${cs.w("screen.document.passage.where", { page })}</span>` : "") + partKind(p) + (citedMark(extent) ? "<br>" + citedMark(extent) : "") + "</blockquote>"
        + (extent && askable.length ? cs.act("cite", { label: "document.read.cite",
            data: { found: JSON.stringify({ capture_sha: sha, extent, kind: "passage" }) } }) : "");
    }).join("") + pick + pickHelp + none + citeDoneHtml() + own("cite");
  }, { help: "document.read.help" });

  /* the pages its reading could not make out (extraction R27), and the two ways to their words */
  let drewTranscribe = false;
  if (reading.state === "ok" && blind0.length) {
    const un = blind0;
    /* R78: drawn from one, the picker's own choices one-based as well (a transcription sends the record's number) */
    if (un.length) out.push(cs.sec("screen.document.unread.head",
      `<p>${cs.w("document.unread.pages", { pages: pagesText(un.map((p) => p + 1)) })}</p>`
      + (view.reachable ? (drewTranscribe = true, cs.act("pagetranscribe", { label: "act.pagetranscribe.label.document", data: { sha } })) : "")
      + cs.choice("document-unread-page", "screen.document.unread.page", un.map((p) => ({ value: String(p + 1), text: String(p + 1) })), { value: String(un[0] + 1) })
      + cs.field("document-unread-words", "screen.document.unread.words", { area: true, rec: true })
      + cs.act("transcribe", { label: "act.transcribe.label.document", data: { document: id } })));
  }
  out.push(own("transcribe") + own("pagetranscribe"));
  /* R96 (C21; DEC-375): a copy whose text is not full can be read again with OCR (`pdfstructure`, `ocr=1`), which looks for the words in the
     page images; a full one offers no such act. The pages with no text are named where the reading names them. */
  /* R3, R96 (C17): picture-ness is the record's own: what the capture's register document states of it (its profiled format, the content type its
     source declared, the name of its file), and only where the record states none, what the reading states. The PDF reader (`pdfstructure`)
     reads PDFs only: a photograph or other picture is never offered it. The re-read the plane has for a picture is the assistant's reading of its
     page (`pagetranscribe`, extraction R71), offered once while the assistant is reachable and not at all when it is not (the page can still be
     typed). */
  /* R130 (G135a): the assistant's reading of a picture's page is for the pictures the plane can open (JPEG and PNG); a GIF, TIFF, WebP, HEIC or BMP is a kind with no
     reader, named above, and is offered no act */
  const PICTURE_FORMAT = /^(jpe?g|png)$/i;
  const isPicture = (() => {
    const prof = reg0.profile && typeof reg0.profile === "object" ? reg0.profile : {};
    const recFormat = String((prof.format && typeof prof.format === "object" ? prof.format.format : prof.format) || "");
    const recType = String(prof.source_content_type || prof.content_type || "");
    const recName = String(reg0.file || (reg0.capture && reg0.capture.file_name) || "");
    if (/^image\//i.test(recType) || PICTURE_FORMAT.test(recFormat) || /\.(jpe?g|png)$/i.test(recName)) return true;
    if (recType || recFormat) return false;
    const rd = rv0 && rv0.reading && typeof rv0.reading === "object" ? rv0.reading : null;
    const ct = String((rd && rd.content_type) || (rv0 && rv0.content_type) || "");
    const fm = String((rv0 && rv0.format) || (rd && rd.text_container) || "");
    return /^image\//i.test(ct) || PICTURE_FORMAT.test(fm);
  })();
  /* R96 (C17): an act that reads the copy again is drawn only for a copy a reading is held for (`rv0`): one with none says it is unread, in the
     facts above, and draws no act that re-reads it */
  /* R129 (N5): a copy stored with no reading says so and offers to read it now (`readheld`); the sentence and the act are drawn together or not at all */
  /* G8 (fix round 6): "Read it" is also drawn for a statement extraction states `repairable` (an old "(multipart)" final whose bytes now detect), beside the statement */
  /* R130: a kind with no reader is named and offered no read act; the sentence stands where the act would */
  if (noReader && textState === "unread" && unreadNote && !archive) out.push(unreadNote);
  if ((textState === "unread" || textState === "repairable") && sha && !noReader && !archive) {
    /* its label, `act.readheld.label.document` ("Read it now"), is a row the design owes (K4269); "Read it" (`document.read.title`) stands in */
    const readNow = cs.act("readheld", { label: textState === "repairable" && heldWord("screen.document.reading.repairable.door") ? "screen.document.reading.repairable.door" : "document.read.title", data: { sha } });
    if (readNow) out.push(`<div class="mk-acts" data-readnow="1">${readNow}${own("readheld")}</div>`);
  }
  /* G6, G13: no OCR re-read after a statement that stands (`stated`), beside one "Read it" repairs, or while the text is still being read; the assistant's
     reading of a picture's page (`pagetranscribe`) stays for a picture whose reading states it did not read it */
  if (rv0 && textState && !["full", "unread", "repairable", "reading", "cut"].includes(textState) && sha && !incomplete && !noReader && !archive) {
    if (isPicture) {
      if (view.reachable && !drewTranscribe) out.push(`<div class="mk-acts">${cs.act("pagetranscribe", { label: "act.pagetranscribe.label.document", data: { sha } })}</div>`);
    } else if (textState !== "stated") {
      const act = cs.act("pdfstructure", { label: "act.pdfstructure.label.document", data: { sha } });
      out.push(textState === "partial" && blind0.length ? cs.sheet(rowOf("", W("screen.document.ocr.says", { pages: pagesText(blind0.map((n) => n + 1)) }), act)) : `<div class="mk-acts">${act}</div>`);
    }
  }
  /* R97 (C22; DEC-375): a page another member typed is confirmed by a second member (`transcriptionattest`); the typist's own page
     offers her no confirmation, since the plane refuses it (content R25). The typings are the document's `transcriptions` (content R57),
     read for any document with a digest: a typed page can make the text whole, and it still waits for its confirmation. */
  if (sha) {
    const meIds = [view.me && view.me.member, view.me && view.me.handle].filter(Boolean).map(String);
    if (typed.length) out.push(`<details class="mk-details" open data-fold="typed"><summary>${W("screen.document.attest.summary")}</summary>` + typed.map((t) => {
      const mine = meIds.includes(String(t.transcriber));
      const ext = t.extent && typeof t.extent === "object" ? t.extent : null;
      const page = ext && Number.isInteger(ext.page) ? pg(ext.page) : null;
      const name = who(t.transcriber);
      /* T51 fix round 10 (B89, R139; C-M2; content R57; DEC-439): an attestation that `counts` is a second member's check of this typing. A typing so checked draws no "Not yet
         checked" (false) but `screen.document.attest.checked` for each such check ({name}, {date}), and a member who has confirmed it is offered no form */
      const counted = (Array.isArray(t.attestations) ? t.attestations : []).filter((a) => a && a.counts);
      const iConfirmed = counted.some((a) => meIds.includes(String(a.attestor)));
      /* C17: the typed words are the page's reading: read from the typing (content R26's `transcription`) and drawn under the page typed */
      const tw = later("typing:" + String(t.content_id), "transcription", { id: String(t.content_id) });
      const words = tw.state === "ok" && tw.value && typeof tw.value.text === "string" && tw.value.text.trim()
        ? `<blockquote class="mk-passage rec" data-typed-text="1">\u201c${cs.esc(tw.value.text.trim())}\u201d</blockquote>` : "";
      return `<div data-typed="${cs.esc(String(t.content_id))}">` + cs.sheet(rowOf("", `<span class="rec">${W("screen.document.attest.row", { page: page !== null ? String(page) : String(t.ref || ""), name, date: { html: dayOf(t.at) } })}</span>`
          + (counted.length ? counted.map((a) => `<br><span class="mk-sub" data-checked-by="1">${W("screen.document.attest.checked", { name: who(a.attestor), date: { html: dayOf(a.at) } })}</span>`).join("")
            : `<br><span class="mk-sub">${W("screen.document.attest.status", { name })}</span>`))) + words
        + (mine || iConfirmed ? "" : cs.field("document-attest-note-" + String(t.content_id), "screen.document.attest.note", { area: true, rec: true, help: "screen.document.attest.note.help" })
          + `<p class="mk-note">${W("screen.document.attest.at")}</p>` + cs.act("transcriptionattest", { label: "act.transcriptionattest.label.document", data: { content: String(t.content_id) } })) + "</div>";
    }).join("") + own("transcriptionattest") + "</details>");
  }
  /* R55: a picture whose text the reading could not make out, and a table read flat, say so */
  if (reading.state === "ok" && reading.value && reading.value.reading) {
    const rd0 = reading.value.reading;
    if (!noReader && rd0.content_type && /^image\//.test(String(rd0.content_type)) && !(Array.isArray(reading.value.text_units) && reading.value.text_units.length))
      out.push(`<details class="mk-details" data-fold="image" open><summary>${cs.w("document.image.unread.summary")}</summary><p class="mk-small">${cs.w("document.image.unread")}</p></details>`);
    if (rd0.tables_flattened === true || rd0.table_flattened === true) out.push(`<p class="mk-note" data-note="table">${cs.w("document.table.flattened")}</p>`);
  }
  if (reading.state === "ok" && reading.value.untested && reading.value.text_provenance && reading.value.text_provenance.transcribed)
    out.push(`<p class="cs-draftlabel" data-label="untested">${cs.w("ai.label.untested")}</p>`);

  /* its versions (provenance's versionchain): a newer version than this copy marked changed; refused by its words
     (R32). Each question that rests on it asks about a newer copy on its own row (R69), never here. */
  const backs = d.backlinks && d.backlinks.state === "ok" && Array.isArray(d.backlinks.value.backlinks) ? d.backlinks.value.backlinks : [];
  const vc = outside && !testimony ? later("versions", "versionchain", { address: locator, ...(sha ? { at: sha } : {}) }) : null;
  if (vc) {
    const vbody = vc.state === "failed" ? `<p class="cs-state" data-state="failed" role="alert">${vc.refusal && vc.refusal.words ? vc.refusal.words : cs.w("state.failed", { reason: "" })}</p>`
      : vc.state === "loading" ? cs.state({ state: "loading" }, () => "") : vc.state === "ok" ? (() => {
        const v = vc.value;
        const list = Array.isArray(v.versions) ? v.versions : [];
        if (list.length < 2) return "";
        const at0 = Number.isInteger(v.at_index) ? v.at_index : list.findIndex((x) => x && (x.capture_sha === sha || x.sha256 === sha));
        const newer = at0 >= 0 && at0 < list.length - 1;
        /* R86 (C32): each other version is a reference opening that version's document; this copy is not, and a version the record holds
           no document for is a date alone */
        return (newer ? `<p class="cs-due" data-changed="true">${cs.w("screen.document.versions.changed")}</p>` : "")
          + cs.sheet(list.map((x, i) => {
            const when = x && x.first_retrieved ? cs.date(String(x.first_retrieved), { year: true }) : "";
            return rowOf("", i !== at0 && x && x.bundle_id && when ? cs.ref("document", String(x.bundle_id), when, []) : when,
              i === at0 ? `<span class="mk-small">${cs.w("screen.document.versions.this")}</span>` : "");
          }).join(""));
      })() : "";
    if (vbody) out.push(cs.sec("screen.document.versions.head", vbody));
  }

  /* R69: "Your citations, leg by leg": one row for each question that rests on this document and the viewer may see. Until the
     member asks, a row says it has not been asked (B314) and no `versionnotice` is sent for it; a notice the sweep raised
     (`reevaluationnotices`) is a read of the record, so its row is drawn asked from the start; a notice a member closed is
     drawn as decided. */
  {
    const askedFor = ui.asked || {};
    const versions = vc && vc.state === "ok" && vc.value && Array.isArray(vc.value.versions) ? vc.value.versions : [];
    const dateOfSha = (s) => { const v = versions.find((x) => x && (x.capture_sha === s || x.sha256 === s)); return v && v.first_retrieved ? String(v.first_retrieved) : ""; };
    const newestOf = (list) => list.filter(Boolean).sort().pop() || "";
    /* R124 (C42; BOB's pending reading, QUESTION J17: kept in this one function so it is easy to change): "Move my citations to this copy" is
       offered only where the newer copy was captured (it is one of `versionchain`'s versions, a capture with a register row, not a change merely
       observed) and has a reading chain (`op=reading` for its digest answers text units). "chain", "nochain" (captured, no text), "nothing"
       (never captured) or "wait" (the reading is not yet read). */
    const moveOffer = (newer) => {
      if (!newer || !versions.some((x) => x && (x.capture_sha === newer || x.sha256 === newer))) return "nothing";
      const rd = later("reading:" + newer, "reading", { sha256: newer });
      if (rd.state === "loading") return "wait";
      /* G38: a long reading is paged (`next`), so the text may begin past the first page: the pages are followed until one holds words, or none is left */
      const words = (us) => us.some((u) => u && String(u.text || "").trim());
      const got = view.parts.readPages(readOf, "readingafter:" + newer + ":", newer, rd.state === "ok" ? rd.value : null, words);
      if (words(got.units)) return "chain";
      return got.state === "loading" ? "wait" : got.state === "failed" ? "unread" : "nochain";
    };
    const seenQ = new Set();
    const rows = [];
    for (const x of backs.filter((b) => b && b.from_type === "inquiry" && b.from)) {
      const qid = String(x.from);
      if (seenQ.has(qid)) continue;
      seenQ.add(qid);
      const qi = later("qimg:" + qid, "image", { id: qid });
      const qf = qi.state === "ok" && qi.value && typeof qi.value["bundle.md"] === "string" ? view.parts.front(qi.value["bundle.md"]) : null;
      const pid = qf && /^PROJ-/.test(String(qf.project || "")) ? String(qf.project) : "";
      const pi = pid ? later("project:" + pid, "image", { id: pid }) : null;
      const ptitle = pi && pi.state === "ok" && pi.value && typeof pi.value["bundle.md"] === "string" ? String(view.parts.front(pi.value["bundle.md"]).title || "") : "";
      /* the place the question rests on: its legs on this document, each at the record's page + 1 (R78) */
      const places = (qf ? qf.lists.basis || [] : []).filter((l) => l && String(l.target) === id && l.extent_page !== undefined && l.extent_page !== "")
        .map((l) => pg(Number(l.extent_page))).filter((n) => n !== null);
      const nt = later("renotices:" + qid, "reevaluationnotices", { holder: qid, state: "all" });
      const list = nt.state === "ok" && nt.value ? (Array.isArray(nt.value.notices) ? nt.value.notices : Array.isArray(nt.value.items) ? nt.value.items : []) : [];
      const mine = list.filter((o) => o && (String(o.target || "") === id || o.capture_sha === sha || o.newer_capture === sha) && (o.notice || o.id));
      const stateOf = (o) => String(o.state || "open");
      const open = mine.filter((o) => stateOf(o) === "open");
      const closed = mine.filter((o) => stateOf(o) === "adopted" || stateOf(o) === "kept")
        .sort((a, b) => String(a.closed_at || "").localeCompare(String(b.closed_at || "")));
      const ans = askedFor[qid] || null;
      const unseen = (inner) => `<span class="mk-small" data-leg-state="asked">${inner}</span>`;
      let acts = "", meta = [];
      /* C36 (fix round 4, aside): a web page has no page; the section it rests on is its paragraph (counted from 0 in the captured file, drawn from
         one), and the words cited are drawn beside, whatever the kind: a row never ends on a separator with nothing after it */
      const legsHere = (qf ? qf.lists.basis || [] : []).filter((l) => l && String(l.target) === id);
      const paras = legsHere.map((l) => (l.extent_para !== undefined && l.extent_para !== "" && Number.isInteger(Number(l.extent_para)) ? Number(l.extent_para) + 1 : null)).filter((n) => n !== null);
      /* G38: the unit a leg cites may sit on a later page of a long reading (`next`): the pages are followed until the unit is found, or none is left; a page
         that cannot be read is said, never taken for the unit's absence */
      let citedFailed = false;
      const cited = [...new Set(legsHere.map((l) => {
        const want = view.parts.legExtent(l);
        if (!Object.keys(want).some((k) => k !== "kind")) return "";
        const got = view.parts.readPages(readOf, "readafter:", sha, rv0, (us) => view.parts.legWords(us, want) !== "");
        if (got.state === "failed") citedFailed = true;
        return view.parts.legWords(got.units, want);
      }).filter(Boolean))].slice(0, 2);
      if (ptitle) meta.push(cs.esc(ptitle));
      if (places.length) meta.push(W("screen.document.place.restson", { page: pagesText(places) }));
      else if (paras.length) meta.push(paras.map((n) => W("screen.question.leg.paragraph", { n: String(n) })).join(", "));
      if (citedFailed) meta.push(cs.state({ state: "failed", refusal: null }, () => ""));
      for (const w of cited) { const t = String(w).replace(/\s+/g, " ").trim(); meta.push(`<span class="rec" data-leg-words="1">\u201c${cs.esc(t.length > 120 ? t.slice(0, 120).replace(/\s+\S*$/, "") + "\u2026" : t)}\u201d</span>`); }
      if (!open.length && closed.length) {
        /* decided: what she chose, who and when, in her own words; nothing more is offered for that capture */
        const c = closed[closed.length - 1];
        const adopted = stateOf(c) === "adopted";
        const fills = { member: who(c.closed_by || ""), date: { html: dayOf(c.closed_at) } };
        const sentence = c.why ? W(adopted ? "screen.document.a34.moved" : "screen.document.a34.kept", { ...fills, why: String(c.why) })
          : W(adopted ? "screen.document.a34.moved.noreason" : "screen.document.a34.kept.noreason", fills);
        meta.push(`<span data-leg-state="decided" data-decided="${cs.esc(stateOf(c))}">` + sentence + "</span>");
      } else if (ans || open.length) {
        const lines = [];
        const legs = ans && ans.state === "ok" ? ans.legs.filter((n) => n && String(n.target) === id) : [];
        const items = legs.length ? legs.map((n) => ({ state: String(n.state || ""), affects: n.affects,
          date: newestOf((Array.isArray(n.candidates) ? n.candidates : []).map((c) => c && c.first_retrieved ? String(c.first_retrieved) : "")
            .concat((Array.isArray(n.chains) ? n.chains : []).map((c) => c && c.newest && c.newest.first_retrieved ? String(c.newest.first_retrieved) : ""))) }))
          : ans && ans.state === "ok" ? [{ state: "chain_unread", affects: null, date: "" }]
          : open.map((o) => ({ state: "newer_capture", affects: o.affects || null, date: dateOfSha(String(o.newer_capture || "")) }));
        if (ans && ans.state === "failed") lines.push(cs.state({ state: "failed", refusal: ans.words ? { words: ans.words } : null }, () => ""));
        for (const it of items) {
          if (it.state === "no_newer_capture") { lines.push(`<span data-leg="none">${W("screen.document.a34.no_newer")}</span>`); continue; }
          if (it.state === "chain_unread" || it.state === "not_asked" || !it.state) {
            /* never "none": the record could not tell, and it does not guess */
            lines.push(`<span data-leg="unread">${cs.mark("gap", "undetermined")} ${W("screen.document.a34.it_does_not_guess")}</span>`);
            continue;
          }
          if (it.date) lines.push(`<span data-leg="newer">${W("screen.document.a34.a_newer_copy_exists_captured_2_october", { date: { html: dayOf(it.date) } })}</span>`);
          if (it.affects === "unaffected" && places.length) lines.push(`<span data-leg="same">${W("screen.document.a34.page_same", { page: pagesText(places) })}</span>`);
          else if (it.affects === "affected" && places.length) lines.push(`<span data-leg="differs">${W("screen.document.a34.page_differs", { page: pagesText(places) })}</span>`);
          else if (it.affects === "unaffected" && paras.length && cs.w("screen.document.a34.para_same") !== "screen.document.a34.para_same") lines.push(`<span data-leg="same">${W("screen.document.a34.para_same", { n: paras.join(", ") })}</span>`);
          else if (it.affects === "affected" && paras.length && cs.w("screen.document.a34.para_differs") !== "screen.document.a34.para_differs") lines.push(`<span data-leg="differs">${W("screen.document.a34.para_differs", { n: paras.join(", ") })}</span>`);
          else if (it.affects === "undetermined") lines.push(`<span data-leg="undetermined">${cs.mark("gap", "undetermined")}</span>`);
        }
        if (lines.length) meta.push(unseen(lines.join(" · ")));
        /* a newer copy is taken up or declined by a notice (reevaluation R15), so each open notice carries its two acts */
        acts = open.map((o) => { const nid = String(o.notice || o.id);
          const offer = moveOffer(String(o.newer_capture || ""));
          return cs.field("document-version-why-" + nid, "shell.reason", { area: true, rec: true, help: "shell.reason.help" })
            + (offer === "chain" ? cs.act("adoptversion", { label: "act.adoptversion.label.document", data: { notice: nid } })
              : offer === "nochain" ? `<p class="mk-small" data-move="nochain">${W("refusal.CONTENT_EXTENT_NO_CHAIN")}</p>` : "")
            + cs.act("keepversion", { label: "act.keepversion.label.document", data: { notice: nid } }); }).join("");
        if (nt.state === "failed") meta.push(cs.state(nt, () => ""));
      } else {
        meta.push(`<span data-leg-state="unchecked">${W("screen.document.a34.not_checked_yet")}</span>`);
        acts = cs.act("versionnotice", { label: "act.versionnotice.label.document", data: { question: qid } });
        if (nt.state === "failed") meta.push(cs.state(nt, () => ""));
      }
      rows.push(`<div data-leg-row="${cs.esc(qid)}">` + rowOf("", cs.ref("question", qid, x.from_title || T("state.undetermined", { reason: "" }), [x.from_title || ""]), "", meta.join(" · ")) + acts + "</div>");
    }
    if (rows.length) out.push(cs.sec("screen.document.a34.your_citations_leg_by_leg",
      `<p class="mk-small muted">${W("screen.document.a34.a_newer_copy_never_moves_a_citation_by_i")} ${W("screen.document.a34.each_reasoning_that_rests_on_this_docume")}</p>`
      + cs.sheet(rows.join("")), { help: "screen.document.a34.one_line_for_each_question_that_rests_on" }));
  }

  /* R65: "The record of this copy" (`bundlehistory`, promotion R58): the release that wrote it, what was done to its standing
     oldest first, and every earlier revision, two of which can be set side by side from the `image` answer already held. */
  const hist = later("history", "bundlehistory", { bundle: id });
  const image = d.capture.value;
  const revs = hist.state === "ok" && hist.value && Array.isArray(hist.value.revisions) ? hist.value.revisions.filter((r) => r && typeof r === "object").slice().sort((a, b) => Number(b.seq) - Number(a.seq)) : [];
  /* a revision's bytes, as the image answer holds them (promotion R58, record-core R15): the newest revision's file is the live
     one; an older revision's is the snapshot the promotion that replaced it archived, `_history/<name>_<snapKey>.<ext>` by the
     key of that replacing revision (the nearest newer one that wrote the file), or the live file when none did */
  const snapPath = (path, key) => { const cut = path.lastIndexOf("/"), dir = cut === -1 ? "" : path.slice(0, cut + 1), name = cut === -1 ? path : path.slice(cut + 1), dot = name.lastIndexOf(".");
    return dot === -1 ? `_history/${dir}${name}_${key}` : `_history/${dir}${name.slice(0, dot)}_${key}${name.slice(dot)}`; };
  const bytesOf = (path, i) => {
    for (let j = i - 1; j >= 0; j--) {
      const files = Array.isArray(revs[j].files) ? revs[j].files : [];
      if (files.some((f) => f && f.path === path)) { const v = image[snapPath(path, String(revs[j].snapKey))]; return typeof v === "string" ? v : null; }
    }
    const v = image[path];
    return typeof v === "string" ? v : null;
  };
  /* the standing, the grade and who vouched, as one revision's own bytes state them; null when the answer holds none */
  const factsOf = (i) => {
    const t = bytesOf("bundle.md", i);
    if (t === null) return null;
    const f = view.parts.front(t);
    const verified = (f.lists.state_history || []).filter((x) => x && x.to_state === "verified");
    let grade = "";
    try { const pj = JSON.parse(String(bytesOf("data/provenance.json", i) || "")); const g = pj && pj.documents && pj.documents[0] && pj.documents[0].capture ? String(pj.documents[0].capture.grade || "") : ""; grade = /^[A-D]$/.test(g) ? g : ""; } catch { grade = ""; }
    return { standing: String(f.current_state || ""), vouched: verified.length ? String(verified[verified.length - 1].author || "") : "", grade };
  };
  const standingWord = (to) => (to === "collected" ? W("screen.document.a27.held_until_vouched_for") : to === "verified" ? W("screen.document.a27.now_used_by_the_team")
    : to === "retired" ? W("state.item.retired.name") : undetermined(to));
  const filesOf = (r) => (Array.isArray(r.files) ? r.files.filter((f) => f && f.path) : []);
  const titleOf = (r) => T("screen.document.revision.title", { n: String(r.seq) });
  /* R65, R81: two revisions side by side, the older on the left (`ia`, `ib` index `revs`): the standing, the grade and who vouched,
     each marked where the two differ, and, for a copy that came as a set of files, the files that changed between them */
  const comparePanel = (ia, ib) => {
    const fa = factsOf(ia), fb = factsOf(ib);
    const edit = (same, left, inner) => (same ? inner : left ? `<del>${inner}</del>` : `<ins>${inner}</ins>`);
    const standingLine = (st) => (st === "collected" ? W("screen.document.a27.standing_held_until_vouched_for") : st === "verified" ? W("screen.document.a27.standing_used_by_the_team")
      : st === "retired" ? W("state.item.retired.name") : undetermined(st));
    const lines = (f, g, left) => (!f ? `<p>${cs.mark("gap", "undetermined")} ${W("screen.document.revision.nobytes")}</p>`
      : `<p>${edit(!g || f.standing === g.standing, left, standingLine(f.standing))}</p>`
      + `<p>${W("screen.document.compare.grade")} ${edit(!g || f.grade === g.grade, left, f.grade ? cs.grade("capture", f.grade) : cs.mark("gap", "undetermined"))}</p>`
      + `<p>${edit(!g || f.vouched === g.vouched, left, f.vouched ? W("screen.document.a27.vouched_for_by_dev.2", { member: who(f.vouched) }) : W("screen.document.a27.vouched_for_by_nobody"))}</p>`);
    const side = (i, f, g, left) => `<div><h3>${cs.esc(titleOf(revs[i]))}</h3><span class="mk-date">${at(revs[i].at)} · ${cs.esc(who(revs[i].author))}</span>${lines(f, g, left)}</div>`;
    /* a set of files: the files that changed between the two, each with its digest on either side */
    let changed = "";
    if (isSet) {
      const fa2 = new Map(filesOf(revs[ia]).map((f) => [String(f.path), String(f.sha256 || "")])), fb2 = new Map(filesOf(revs[ib]).map((f) => [String(f.path), String(f.sha256 || "")]));
      changed = [...new Set([...fa2.keys(), ...fb2.keys()])].filter((p) => fa2.get(p) !== fb2.get(p))
        .map((p) => `<p class="mk-small id" data-file-changed="${cs.esc(p)}">${cs.esc(p)} ${fa2.has(p) ? `<del>${W("screen.document.compare.fingerprint", { digest: shortOf(fa2.get(p)) })}</del>` : ""} ${fb2.has(p) ? `<ins>${W("screen.document.compare.fingerprint", { digest: shortOf(fb2.get(p)) })}</ins>` : ""}</p>`).join("");
    }
    return `<div class="mk-compare" data-compare="revisions">${side(ia, fa, fb, true)}${side(ib, fb, fa, false)}</div>` + changed;
  };
  /* R81 (CR-19; promotion R59): the earlier revision a question that rests on this document cites: its leg's `extent_capture` (the
     capture the leg pins) matched to a revision's `capture_sha`, among the questions the screen already reads (backlinks, each question's
     image). A leg with only a `content_id` is not matched, as no read this screen makes answers it; a capture no revision lists is not
     guessed. -1 when there is none. */
  const citedRev = (() => {
    for (const x of backs.filter((b) => b && b.from_type === "inquiry" && b.from)) {
      const qi = later("qimg:" + String(x.from), "image", { id: String(x.from) });
      const qf = qi.state === "ok" && qi.value && typeof qi.value["bundle.md"] === "string" ? view.parts.front(qi.value["bundle.md"]) : null;
      for (const l of (qf ? qf.lists.basis || [] : [])) {
        if (!l || String(l.target) !== id || !l.extent_capture) continue;
        const i = revs.findIndex((r) => r && r.capture_sha === String(l.extent_capture));
        if (i >= 1) return i;
      }
    }
    return -1;
  })();
  /* R81: the compare tab shows the cited revision beside the current copy; the browser act `revisioncompare` sets the pair (nothing sent) */
  const compareTab = () => {
    const cited = revs[citedRev], current = revs[0];
    const shownNow = ui.revcmp && String(ui.revcmp.a) === String(cited.seq) && String(ui.revcmp.b) === String(current.seq);
    return shownNow ? comparePanel(citedRev, 0)
      : cs.act("revisioncompare", { label: "screen.document.revisions.compare.act", data: { a: String(cited.seq), b: String(current.seq) } });
  };
  /* R82 (CR-19; DEC-368; extraction R77): the original file's card, its kind from the format id the reading names (its `text_container`,
     the same id the capture's format falls back to; a text/plain capture the registry leaves undetermined is `text`; an id with no row is
     `undetermined`) and its size from `bytes`; no size, no card */
  const originalCard = (() => {
    const rv = reading.state === "ok" && reading.value ? reading.value : null;
    if (!rv || !Number.isInteger(rv.bytes)) return "";
    /* R83 (CR-19; K4127): the capture format `extraction` states (R78) names the kind; the reading's own `text_container` only when none is stated */
    const stated = typeof rv.format === "string" ? rv.format.trim() : "";
    const named = stated || (rv.reading && typeof rv.reading.text_container === "string" ? rv.reading.text_container.trim() : "");
    const id0 = named || (/^text\/plain\b/.test(String(rv.content_type || "")) ? "text" : "");
    const kind = view.parts.kinds.includes(id0) ? id0 : "undetermined";
    const size = sizeWord(rv.bytes);
    return `<p class="mk-note" data-card="original">${W("document.read.original.card", { kind: T("document.kind." + kind), size })}</p>`;
  })();
  out[readingAt] = readingBody();

  const recordBody = (h) => {
    if (!h || typeof h !== "object") return "";
    const states = Array.isArray(h.states) ? h.states.filter((s) => s && typeof s === "object") : [];
    const hop = regDocs[0] && Array.isArray(regDocs[0].provenance_chain) ? regDocs[0].provenance_chain[0] : null;
    const rel = hop && typeof hop.who === "string" ? /Civicsmith\/([^\s)]+)/.exec(hop.who) : null;
    const parts = [];
    if (rel) parts.push(cs.sheet(rowOf("", `<b>${W("screen.document.record.release", { version: { html: `<span class="id" data-release="1">${cs.esc(rel[1])}</span>` } })}</b>`, "", W("screen.document.a27.the_release_of_civicsmith_that_wrote_thi"))));
    const first = revs.length ? revs[revs.length - 1] : null;
    const log = [];
    if (first) {
      const f0 = factsOf(revs.length - 1);
      log.push(rowOf("", `<b>${W("screen.document.record.added", { member: who(first.author) })}</b>`, "", [at(first.at), f0 && f0.standing === "collected" ? W("screen.document.a27.held_until_vouched_for") : "",
        /* an upload's address (`upload:<64 hex>`) is its fingerprint's, drawn once in Fingerprints (R26); the row names who added it above */
        locator && !/^upload:/i.test(locator) ? `<span class="id">${cs.esc(locator)}</span>` : ""].filter(Boolean).join(" · ")));
    }
    for (const s of states) {
      const to = String(s.to || "");
      log.push(rowOf("", to === "verified" ? W("screen.document.a27.vouched_for_by_dev", { member: who(s.author) }) : `<b>${cs.esc(who(s.author))}</b>`, "",
        [at(s.at), standingWord(to)].filter(Boolean).join(" · ") + (s.blurb ? ` · <span class="rec">“${cs.esc(String(s.blurb))}”</span>` : "")));
    }
    if (log.length) parts.push(`<p class="mk-note">${W("screen.document.a27.everything_done_to_this_copy_s_standing_")} ${W("screen.document.a27.none_of_it_is_ever_changed_or_removed")}</p>` + cs.sheet(log.join("")));
    if (revs.length > 1) {
      const revRows = revs.map((r, i) => rowOf("", `<b>${cs.esc(titleOf(r))}</b>` + (i === 0 ? ` <span class="mk-small">${W("document.versions.thiscopy")}</span>` : ""), "",
        [dayOf(r.at), cs.esc(who(r.author))].filter(Boolean).join(" · ")
        + (isSet ? filesOf(r).map((f) => ` <span class="id">${cs.esc(String(f.path))} ${cs.esc(shortOf(String(f.sha256 || "")))}</span>`).join("") : "")));
      const opts = revs.map((r) => ({ value: String(r.seq), text: titleOf(r) }));
      const cmp = ui.revcmp && opts.some((o) => o.value === String(ui.revcmp.a)) && opts.some((o) => o.value === String(ui.revcmp.b)) ? ui.revcmp : null;
      let panel = "";
      if (cmp) {
        panel = comparePanel(revs.findIndex((r) => String(r.seq) === String(cmp.a)), revs.findIndex((r) => String(r.seq) === String(cmp.b)));
      }
      parts.push(`<details class="mk-details" data-fold="revisions"${cmp ? " open" : ""}><summary>${W("screen.document.a27.earlier_revisions_of_this_record")} <span class="muted">· ${revs.length}</span></summary>`
        + cs.sheet(revRows.join(""))
        + `<div class="mk-grid2">${cs.choice("document-rev-a", "screen.document.revisions.compare", opts, { value: cmp ? String(cmp.a) : opts[opts.length - 1].value })}`
        + `${cs.choice("document-rev-b", "screen.document.revisions.with", opts, { value: cmp ? String(cmp.b) : opts[0].value })}</div>`
        + cs.act("revisioncompare", { label: "screen.document.revisions.compare.act" }) + panel
        + (isSet ? `<p class="mk-note">${W("screen.document.a27.a_copy_that_came_as_a_set_of_files_such_")}</p>` : "") + "</details>");
    }
    if (h.truncated === true) parts.push(`<p class="mk-note" data-truncated="1">${W("screen.document.revisions.truncated", { n: String(revs.length) })}</p>`);
    return parts.join("");
  };
  if (hist.state !== "empty") {
    const body = cs.state(hist, recordBody);
    if (body) out.push(cs.sec("screen.document.a27.the_record_of_this_copy", body, { help: "screen.document.a27.who_added_this_copy_who_vouched_for_it_a" }));
  }

  /* R66: the fingerprints, each in full with its short form beside its title and a Copy that puts the full value on the clipboard
     (nothing is sent). The second, the current revision's `bundle_sha`, is for a copy that came as a set of files only. */
  if (sha) {
    const setSha = isSet && revs.length && /^[0-9a-f]{64}$/.test(String(revs[0].sha256 || "")) ? String(revs[0].sha256) : "";
    const fp = (value, titleKey, whyKey, tag) => rowOf("", `<b>${W(titleKey)}</b> <span class="id">${cs.esc(shortOf(value))}</span>`, cs.act("hashcopy", { label: "shell.copy", data: { value }, tone: "quiet" }),
      `<span class="id" data-fingerprint="${tag}">${cs.esc(value)}</span> · ${W(whyKey)}`);
    out.push(cs.sec("screen.document.fingerprints.head", cs.sheet(fp(sha, "screen.document.a26.this_copy_s_words_and_file", "screen.document.a26.computed_from_the_exact_bytes_of_this_co", "capture")
      + (setSha ? fp(setSha, "screen.document.a26.this_copy_and_the_files_captured_with_it", "screen.document.a26.computed_from_the_whole_set_so_the_set_c", "set") : ""))
      + (setSha ? `<p class="mk-note">${W("screen.document.fingerprint.setonly")}</p>` : "") + `<p class="mk-small">${W("screen.document.a26.anyone_holding_the_same_bytes_computes_t")}</p>`,
      { help: "screen.document.a26.short_codes_computed_from_the_exact_byte" }));
  }

  /* what cites it (R39: a citer without a title is undetermined, never its id) */
  out.push(secOf("screen.document.backlinks.head", "backlinks", (bk) =>
    (bk.backlinks || []).length ? cs.sheet((bk.backlinks || []).map((x) => rowOf("", cs.ref(x.from_type === "project" ? "project" : x.from_type === "inquiry" ? "question" : "document",
      String(x.from || ""), x.from_title || T("state.undetermined", { reason: "" }), [x.from_title || ""]), "")).join(""))
    + (bk.out_of_view ? `<p class="mk-small">${cs.w("screen.document.backlinks.hidden")}</p>` : "") : ""));

  /* R32, R67: the links this page carries (capture R57's `links`, resolved by capture R27) and those it makes into held documents
     (connections R24's `links_to`, its own references), in five groups, each row with the verdict word its link carries. An outside
     link is not a bare anchor: pressing it opens a warning first, and only "Open it anyway" opens the address. */
  if (sha && !testimony) {
    const lk = later("links", "links", { capture: sha, limit: "200" });
    const linked = (doc.lists.references || []).filter((r) => r && r.rel === "links_to" && r.target);
    /* G17 (fix round 6): the plane pages the links (200 an answer, `truncated`, `next`): what is drawn says it is the first of more, and the more control reads the
       next page (`after`); the tally below counts what is drawn, never the whole page */
    const wantLinks = Math.max(1, Number(ui.linkpages) || 1);
    let allLinks = lk.state === "ok" && Array.isArray(lk.value.links) ? lk.value.links.slice() : [];
    let linkNext = lk.state === "ok" && lk.value.next ? lk.value.next : null, linkPending = false, linkFailed = null;
    for (let i = 1; i < wantLinks && linkNext && !linkFailed; i++) {
      const pgk = later("linksafter:" + String(linkNext), "links", { capture: sha, limit: "200", after: String(linkNext) });
      if (pgk.state === "loading") { linkPending = true; break; }
      if (pgk.state !== "ok" || !pgk.value) { linkFailed = pgk; break; }
      allLinks = allLinks.concat(Array.isArray(pgk.value.links) ? pgk.value.links : []);
      linkNext = pgk.value.next ? pgk.value.next : null;
    }
    const linksCut = lk.state === "ok" && (linkNext !== null || linkPending || (wantLinks === 1 && lk.value.truncated === true) || (!!linkFailed));
    const rows = allLinks.filter((r) => r && r.address && !r.chrome);
    if (lk.state === "failed") out.push(cs.sec("document.links.title", cs.state(lk, () => ""), { help: "document.links.help" }));
    else if (rows.length || linked.length) {
      const g = { inside: [], beside: [], held: [], outside: [], refused: [] };
      for (const r of rows) {
        const part = String(r.resolution || r.partition || "");
        if (part === "anchor") g.inside.push(r);
        else if (part === "intra") g.beside.push(r);
        else if (part === "refused") g.refused.push(r);
        else if (r.target_bundle) g.held.push(r);
        else g.outside.push(r);
      }
      for (const r of linked) if (!g.held.some((o) => String(o.target_bundle) === String(r.target) || (o.address && o.address === r.address)))
        g.held.push({ address: String(r.address || ""), target_bundle: String(r.target), verdict: r.verdict, target_retrieved: r.at, title: r.title });
      const word = (k) => W("screen.document.links.verdict." + k);
      const verdictOf = (r, group) => (group === "inside" ? word("final") : group === "beside" ? word("checked") : group === "refused" ? word("refused")
        : r.verdict === "contemporaneous" ? word("same") : r.verdict === "superseded" ? word("different") : r.verdict === "undetermined" ? word("notestablished")
        : group === "outside" ? word("nocapture") : "");
      const addr = (r) => `<span class="id">${cs.esc(String(r.address) + (r.fragment && !String(r.address).includes("#") ? "#" + r.fragment : ""))}</span>`;
      const meta = (verdict, why) => (verdict ? `<b>${verdict}</b>` : "") + (why ? " · " + why : "");
      const groupOf = (key, list, draw) => (list.length ? `<p class="mk-small"><b>${W("screen.document.links.group." + key, { n: String(list.length) })}</b></p>` + cs.sheet(list.map(draw).join("")) : "");
      const leaving = ui.leaving ? String(ui.leaving) : "";
      const leave = leaving && g.outside.some((r) => String(r.address) === leaving)
        ? `<div class="cs-dialog" role="dialog" data-dialog="leave" aria-label="${W("screen.document.a30.you_are_about_to_leave_the_record")}"><b>${W("screen.document.a30.you_are_about_to_leave_the_record")}</b>`
          + `<div class="ends">${W("screen.document.a30.this_page_carried_this_address_and_the_r")} ${W("screen.document.a30.what_is_at_the_address_now_the_record_do")} ${W("screen.document.a27.opening_it_leaves_the_record_and_nothing")}</div>`
          + `<div class="id">${cs.esc(leaving)}</div><span class="mk-acts">${cs.act("linkopen", { label: "screen.document.a30.open_anyway", data: { address: leaving, step: "open" } })}`
          + `${cs.act("linkopen", { label: "screen.document.a30.stay_in_the_record", data: { step: "stay" }, tone: "quiet" })}</span></div>` : "";
      const total = g.inside.length + g.beside.length + g.held.length + g.outside.length + g.refused.length;
      const tally = g.outside.length === 0 ? W("screen.document.a30.tally.none", { n: String(total) })
        : g.outside.length === 1 ? W("screen.document.a30.tally.one", { n: String(total) })
        : W("screen.document.a30.6_links_on_this_page_4_lead_outside_the_", { n: String(total), outside: String(g.outside.length) });
      out.push(cs.sec("document.links.title",
        `<p class="mk-note" data-tally="1">${tally} ${W("screen.document.links.navleft")}</p>`
        + (linksCut ? `<div class="mk-small" data-cut="links"><p>${W("screen.people.more", { n: String(allLinks.length) })}</p>`
          + (linkPending ? cs.state({ state: "loading" }, () => "") : "") + (linkFailed ? cs.state(linkFailed, () => "") : "")
          + (linkNext && !linkPending ? cs.checks("document-links-more", "shell.more", [{ value: String(wantLinks + 1), key: "shell.more", on: false }], { radio: true, redraw: "linkpages" }) : "") + "</div>" : "")
        + groupOf("inside", g.inside, (r) => rowOf("", addr(r), "", meta(verdictOf(r, "inside"), W("screen.document.a30.a_pointer_into_this_very_copy_settled_wh"))))
        + groupOf("beside", g.beside, (r) => rowOf("", addr(r), "", meta(verdictOf(r, "beside"), W("screen.document.a64.captured_together_with_this_page_and_che"))))
        + groupOf("held", g.held, (r) => rowOf("", cs.ref("document", String(r.target_bundle), String(r.title || r.address || T("state.undetermined", { reason: "" })), []), "",
            meta(verdictOf(r, "held"), (r.verdict === "contemporaneous" ? W("screen.document.a27.the_copy_your_team_holds_is_the_one_this") : "")
              + (r.target_retrieved ? (r.verdict === "contemporaneous" ? " · " : "") + W("document.links.held", { date: { html: dayOf(r.target_retrieved) } }) : ""))))
        + (g.held.length ? `<p class="mk-note">${W("screen.document.a30.the_other_verdicts_a_held_link_can_carry")} ${W("screen.document.a64.not_established_means_the_record_cannot_")}</p>` : "")
        + groupOf("outside", g.outside, (r) => rowOf("", addr(r), /^https?:\/\//i.test(String(r.address)) ? cs.act("linkopen", { label: "act.owed_linkopen.label.document", data: { address: String(r.address), step: "ask" }, tone: "quiet" }) : "",
            meta(verdictOf(r, "outside"), "")))
        + leave
        + groupOf("refused", g.refused, (r) => rowOf("", addr(r), "", meta(verdictOf(r, "refused"), W("screen.document.a30.not_an_address_the_record_will_carry") + " " + W("screen.document.a30.this_is_a_refusal_not_a_gap_in_what_was_")))),
        { help: "document.links.help" }));
    }
  }

  /* R137 (T51 fix round 10; DEC-435, DEC-432 (c); K5195; amends R99, R127): ONE document picker for the two folds that choose another document ("Connections you
     assert", "This contradicts another document"). Every document of the team the member can see, this one excepted, is read by `heldcaptures` (capture R77:
     `held_and_vouched`, the read that groups an archive's files beside it, `files`), 20 a page by its `next`: this document's project's first (`project`), then
     every other document sorted by project, a project-less one last; a read whose rows are all excepted is passed over, so no page is drawn empty. The pages
     are read once each (`later`, shared by both folds). Grouped by project under each project's name (its `image`'s title), this project first; an archive one
     row with its files indented under it; one radio choice kept in page memory (`view.ui[<choice>]`), so a choice made on another page replaces it; typing in
     the find box narrows the pages read so far to documents whose name holds the text (the read takes no name filter). The words `screen.document.pick.*`
     are drawn where the list holds them, else the nearest held row stands in (the rows are owed to the words list). */
  const pickHeld = () => true; /* B68 (K5197): every screen.document.pick.* key is drawn by key; rows.mjs is regenerated after PLANE #63 Wave B */
  const pickRead = (phase, after) => later("pick:" + phase + ":" + (after || ""), "heldcaptures",
    { state: "held_and_vouched", sort: "project", limit: "20", ...(phase === "own" ? { project } : {}), ...(after ? { after } : {}) });
  const pickKeep = (row, phase) => !!row && typeof row.bundle_id === "string" && row.bundle_id !== id
    && (!project || (phase === "own" ? String(row.project || "") === project : String(row.project || "") !== project));
  /* the reads are one stream of rows (this project's, then the rest), cut into pages of 20: page `want` reads until it is full and one row past it is known (the
     stream's end, or a `next` that stands), never further */
  const pickPages = (want) => {
    const rows = [], need = 20 * (want + 1);
    let phase = project ? "own" : "all", after = null, state = "ok", failed = null, end = false, total = null;
    for (let guard = 0; guard < 500; guard++) {
      const r = pickRead(phase, after);
      if (r.state === "loading") { state = "loading"; break; }
      if (r.state === "failed") { state = "failed"; failed = r; break; }
      const v = r.state === "ok" && r.value ? r.value : {};
      rows.push(...(Array.isArray(v.held) ? v.held : []).filter((x) => pickKeep(x, phase)));
      if (phase === "all" || !project) total = Number.isInteger(v.total) && v.total >= 0 ? v.total : null;
      const next = typeof v.next === "string" && v.next ? v.next : null;
      if (!next && phase !== "own") { end = true; break; }
      /* the page is full: a `next` that stands says more follow, unread; past this project's last read, the rest's first read is looked at */
      if (rows.length > need || (rows.length >= need && next)) break;
      if (next) after = next; else { phase = "all"; after = null; }
    }
    const pages = [];
    for (let i = 0; i < rows.length && pages.length <= want; i += 20) pages.push({ rows: rows.slice(i, i + 20), total });
    return { pages, more: rows.length > need || (!end && state === "ok" && rows.length >= need), state, failed };
  };
  const projName = (pid) => {
    const t = later("project:" + pid, "image", { id: pid });
    const ft = t && t.state === "ok" && t.value && typeof t.value["bundle.md"] === "string" ? /^title:\s*(.*)$/m.exec(t.value["bundle.md"]) : null;
    let name = ft ? ft[1].trim() : "";
    try { if (name.startsWith("\"")) name = JSON.parse(name); } catch { /* raw */ }
    return name ? { text: name } : { key: t && t.state === "loading" ? "state.loading" : "shell.unread" };
  };
  /* no document to offer (every read answered, none but this one): neither fold is drawn */
  const offered = pickPages(0).pages.length > 0;
  /* `kind` names the fold's own memory: the choice (`choice`), its page (`pickpage:<kind>`) and its find text (`pickfind:<kind>`) */
  const picker = (kind, choice, labelKey) => {
    const pageKey = "pickpage:" + kind, findKey = "pickfind:" + kind;
    const page = Math.max(0, Number.isInteger(Number(ui[pageKey])) ? Number(ui[pageKey]) : 0);
    const got = pickPages(page);
    const chosen = String(ui[choice] || "");
    const needle = String(ui[findKey] || "").trim();
    const low = needle.toLowerCase();
    const nameOf = (r) => String(r.title || r.bundle_id);
    const fileName = (f) => String(f.name || f.document);
    const has = (t) => !low || t.toLowerCase().includes(low);
    /* narrowing covers every page read so far; without it, the page asked */
    const source = needle ? got.pages.slice(0, page + 1).flatMap((p) => p.rows) : (got.pages[page] ? got.pages[page].rows : []);
    const rows = [];
    for (const r of source) {
      const files = Array.isArray(r.files) ? r.files.filter((f) => f && f.document && String(f.document) !== id) : null;
      if (files) {
        const fs = has(nameOf(r)) ? files : files.filter((f) => has(fileName(f)));
        if (has(nameOf(r)) || fs.length) rows.push({ r, files: fs });
      } else if (has(nameOf(r))) rows.push({ r, files: null });
    }
    const groups = new Map();
    for (const x of rows) {
      const pid = String(x.r.project || "");
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push(x);
    }
    const rank = (p) => (project && p === project ? 0 : p === "" ? 2 : 1);
    const order = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
    const opt = (value, text) => ({ value, text, on: value === chosen });
    let n = 0;
    const groupHtml = order.map((pid) => {
      const legend = pid ? projName(pid) : { key: pickHeld("screen.document.pick.noproject") ? "screen.document.pick.noproject" : "screen.held.noproject" };
      const parts = [];
      let seg = [];
      const flush = () => { if (seg.length) parts.push(cs.checks("document-pick-" + kind + "-" + (n++), legend, seg, { radio: true, redraw: choice })); seg = []; };
      for (const x of groups.get(pid)) {
        if (!x.files) { seg.push(opt(String(x.r.bundle_id), nameOf(x.r))); continue; }
        const count = Number.isInteger(x.r.files_total) ? x.r.files_total : x.files.length;
        const said = pickHeld("screen.document.pick.archive") ? T("screen.document.pick.archive", { n: String(count) }) : T("screen.archive.facts.entries", { entries: String(count) });
        seg.push(opt(String(x.r.bundle_id), nameOf(x.r) + " · " + said));
        flush();
        if (x.files.length) parts.push(`<div data-pick-files="${cs.esc(String(x.r.bundle_id))}" style="margin-left:18px">`
          + cs.checks("document-pick-" + kind + "-" + (n++), { text: nameOf(x.r) }, x.files.map((f) => opt(String(f.document), fileName(f)
            + (pickHeld("screen.document.pick.member") ? " · " + T("screen.document.pick.member", { archive: nameOf(x.r) }) : ""))), { radio: true, redraw: choice }) + "</div>");
      }
      flush();
      return `<div data-pick-group="${cs.esc(pid)}">${parts.join("")}</div>`;
    }).join("");
    const shown = got.pages.slice(0, page + 1).reduce((s, p) => s + p.rows.reduce((t, r) => t + 1 + (Array.isArray(r.files) ? r.files.length : 0), 0), 0);
    const total = got.pages[page] ? got.pages[page].total : null;
    /* R137: while a page is unread, nothing read so far matching the text is not "none found": more follow, and the line says so (never `pick.none`) */
    const unmatched = !!needle && !rows.length && got.state !== "loading";
    const saysMore = got.more && (total === null || unmatched);
    const line = saysMore ? (pickHeld("screen.document.pick.more") ? W("screen.document.pick.more", { count: String(shown) }) : W("screen.people.more", { n: String(shown) }))
      : total !== null ? W("screen.list.showing", { shown: String(shown), total: String(total) }) : "";
    const pager = [...(page > 0 ? [{ value: String(page - 1), key: "document.read.prev", on: false }] : []), ...(got.more ? [{ value: String(page + 1), key: "document.read.next", on: false }] : [])];
    const none = unmatched && !got.more
      ? `<p class="cs-state" data-state="empty" data-pick-none="1">${pickHeld("screen.document.pick.none") ? W("screen.document.pick.none", { text: needle }) : W("state.empty")}</p>` : "";
    return `<div data-picker="${cs.esc(kind)}"${chosen ? ` data-chosen="${cs.esc(chosen)}"` : ""}><p><b>${W(labelKey)}</b></p>`
      + cs.field("document-pick-find-" + kind, pickHeld("screen.document.pick.find") ? "screen.document.pick.find" : "shell.search",
        { value: needle, typing: (c, v, value) => c.set(findKey, String(value || "")), ...(pickHeld("screen.document.pick.find.help") ? { help: "screen.document.pick.find.help" } : {}) })
      + none + groupHtml
      + (got.state === "loading" ? cs.state({ state: "loading" }, () => "") : got.state === "failed" ? cs.state(got.failed, () => "") : "")
      + (line || pager.length ? `<div class="mk-small" data-pick-pages="${cs.esc(kind)}">${line ? `<p${saysMore ? ` data-pick-more="1"` : ""}>${line}</p>` : ""}`
        + (pager.length ? cs.checks("document-pick-page-" + kind, "shell.more", pager, { radio: true, redraw: pageKey }) : "") + "</div>" : "")
      + "</div>";
  };

  /* R32, R68: the names it holds, each with its grade as one mark and how it was matched (`resolutions`, entities R14, R58), the
     mention that counts (`on_point`, connections R4) chosen by the record or by a member; a person she says the record follows.
     R95: each name is a reference opening `person` with the entity id. R85: the mentions the connection row lists (connections R70)
     are offered and the one chosen is sent, never the one already on point. R100: a match she meets can be reported as wrong. */
  if (sha) {
    const rs = later("resolutions", "resolutions", { sha256: sha, limit: "500" });
    const cn = later("connections", "connections", { sha256: sha, limit: "200" });
    const names = rs.state === "ok" && rs.value && Array.isArray(rs.value.names) ? rs.value.names.filter((n) => n && n.entity_id) : [];
    const conns = cn.state === "ok" && cn.value && Array.isArray(cn.value.connections) ? cn.value.connections : [];
    const matches = rs.state === "ok" && rs.value && Array.isArray(rs.value.resolutions) ? rs.value.resolutions.filter((x) => x && x.ref && x.entity_id) : [];
    /* DEC-394 (3d, 3e; R126, R127): two folds beneath the matches. The names the record matched to no subject are those `resolutions` states as
       `unresolved` (entities R11's `unresolved`, `{ref, label, page?}`); the read states none today, so with none the fold is not drawn. */
    const quote = (t) => "\u201c" + String(t) + "\u201d";
    const excerpt = (t) => { const x = String(t).replace(/\s+/g, " ").trim(); return x.length > 90 ? x.slice(0, 89) + "\u2026" : x; };
    const unmatched = rs.state === "ok" && rs.value && Array.isArray(rs.value.unresolved) ? rs.value.unresolved.filter((x) => x && x.ref) : [];
    const testifyHtml = unmatched.length
      ? `<details class="mk-details" data-fold="testify"><summary>${W("screen.document.testify.head")}</summary><p class="mk-note">${W("screen.document.testify.note1")} ${W("screen.document.testify.note2")} ${W("screen.document.testify.note3")}</p>`
        + cs.choice("document-testify-which", "screen.document.testify.which", unmatched.map((x, i) => ({ value: String(i), text: quote(x.label || x.ref) + (pg(Number(x.page)) !== null && x.page !== null && x.page !== undefined && x.page !== "" ? " \u00b7 " + T("screen.document.passage.where", { page: pg(Number(x.page)) }) : "") })), { value: "0" })
        + `<p class="mk-small">${W("screen.document.testify.which.help")}</p>`
        + cs.field("document-testify-who", "screen.document.testify.who", {})
        + cs.field("document-testify-how", "screen.document.testify.how", { area: true, rec: true, help: ["screen.document.testify.how.help", "screen.document.testify.how.help2"] })
        + cs.act("resolvetestify", { label: "act.resolvetestify.label.document", data: { sha } }) + own("resolvetestify") + "</details>" : "";
    /* R127: a passage of this reading beside a passage of another document the member can see; the other document is chosen (the choice redraws the
       page, `ui.flagOther`) and its passages are its own reading's */
    const flagUnits = (us) => us.filter((u) => u && String(u.text || "").trim() && u.extent && typeof u.extent === "object");
    const flagLabel = (u) => quote(excerpt(u.text)) + (u.extent && u.extent.kind === "pdf-page" && Number.isInteger(u.extent.page) ? " \u00b7 " + T("screen.document.passage.where", { page: u.extent.page + 1 }) : "");
    /* G38 (R127): the passages offered are those of every page of a long reading (`next`), this one's and the other's, read once the fold can be drawn
       (another document exists to set it beside, R137's picker offers one); a page still on its way or not readable is said in the fold, never taken for the end of the reading */
    const flagPaged = (first, key, shaOf) => (offered && first ? view.parts.readPages(readOf, key, shaOf, first, null)
      : { units: first && Array.isArray(first.text_units) ? first.text_units : [], state: "ok" });
    const hereRead = flagPaged(rv0, "readafter:", sha);
    const flagHere = flagUnits(hereRead.units);
    const flagPick = String(ui.flagOther || "");
    const flagImg = flagPick ? later("flagimg:" + flagPick, "image", { id: flagPick }) : null;
    let flagSha = "";
    try { const fp = JSON.parse(String(flagImg && flagImg.state === "ok" && flagImg.value ? flagImg.value["data/provenance.json"] || "" : "")); const c0 = fp && fp.documents && fp.documents[0] && fp.documents[0].capture ? String(fp.documents[0].capture.sha256 || "") : ""; flagSha = /^[0-9a-f]{64}$/.test(c0) ? c0 : ""; } catch { flagSha = ""; }
    const thereFirst = flagSha ? later("flagread:" + flagSha, "reading", { sha256: flagSha }) : null;
    const thereRead = thereFirst && thereFirst.state === "ok" ? flagPaged(thereFirst.value, "flagreadafter:" + flagSha + ":", flagSha) : { units: [], state: thereFirst ? thereFirst.state : "ok" };
    const flagThere = flagUnits(thereRead.units);
    const flagState = [hereRead.state, thereRead.state].includes("failed") ? cs.state({ state: "failed", refusal: null }, () => "")
      : [hereRead.state, thereRead.state].includes("loading") ? cs.state({ state: "loading" }, () => "") : "";
    /* R137: the other document is chosen through the one picker (its choice `ui.flagOther`); once chosen, its passages (`screen.document.pick.passage`) */
    const flagHtml = flagHere.length && offered
      /* T51 fix round 10 (B89, C-M12): the fold stays open once the other document is chosen or a passage is picked, and each pick is drawn as the member
         left it (read from the page before it is redrawn), so a redraw keeps it */
      ? `<details class="mk-details" data-fold="contradict"${flagPick || String(cs.value("document-flag-here") || cs.value("document-flag-there") || "") ? " open" : ""}><summary>${W("screen.document.contradict.head")}</summary><p class="mk-note">${W("screen.document.contradict.note1")} ${W("screen.document.contradict.note2")}</p>`
        + cs.choice("document-flag-here", "screen.document.contradict.here", [{ value: "", text: "" }].concat(flagHere.map((u, i) => ({ value: String(i), text: flagLabel(u) }))), { value: String(cs.value("document-flag-here") || "") })
        + `<p class="mk-small">${W("screen.document.contradict.here.help")}</p>`
        + picker("flag", "flagOther", "screen.document.contradict.other")
        + (flagPick ? cs.choice("document-flag-there", pickHeld("screen.document.pick.passage") ? "screen.document.pick.passage" : "screen.document.contradict.other", [{ value: "", text: "" }].concat(flagThere.map((u, i) => ({ value: String(i), text: flagLabel(u) }))), { value: String(cs.value("document-flag-there") || "") }) : "")
        + `<p class="mk-small">${W("screen.document.contradict.other.help")}</p>`
        + flagState + cs.field("document-flag-why", "screen.document.contradict.why", { area: true, rec: true, help: "screen.document.contradict.why.help" })
        + cs.act("contradictionflag", { data: { sha } }) + own("contradictionflag") + "</details>" : "";
    /* R139 (T51 fix round 10; DEC-439; D-M3, C-M7; entities R11): "Find the people and offices it names" (`resolve` over this capture), drawn only where the screen carries
       the act (`view.parts.resolve`: the registry admits it); after it finds no name to match, `screen.document.people.none` stands beside it (its outcome) */
    const resolveHtml = view.parts.resolve ? cs.act("resolve", { label: "act.resolve.label.document", data: { sha }, tone: "quiet" }) + own("resolve") : "";
    const folds = testifyHtml + flagHtml;
    if (rs.state === "failed") out.push(cs.sec("document.names.title", cs.state(rs, () => ""), { help: "document.names.help" }));
    else if (!names.length && resolveHtml) out.push(cs.sec("document.names.title", resolveHtml, { help: "document.names.help" }) + folds);
    else if (!names.length && folds) out.push(folds);
    else if (names.length) {
      const people = names.some((n) => n.kind === "person");
      const labelOf = new Map(names.map((n) => [String(n.entity_id), String(n.label || n.entity_id)]));
      out.push(cs.sec("document.names.title", cs.sheet(names.map((n) => {
        const c = conns.find((x) => x && String(x.entity_id) === String(n.entity_id));
        const mine = c ? (c.a_capture_sha === sha ? "a" : "b") : "";
        const op = c && c.on_point ? c.on_point[mine] : null;
        const other = c ? (mine === "a" ? c.b_capture_sha : c.a_capture_sha) : "";
        const chosen = op && op.chosen_by && op.chosen_by !== "record"
          ? W("document.names.chosen.member", { who: who(op.chosen_by), date: { html: op.at ? cs.date(String(op.at), { year: true }) : "" }, why: String(op.why || "") })
          : W("document.names.chosen.record");
        const page = op && op.occurrence ? pg(Number(op.occurrence.page)) : null;
        const count = Number.isInteger(n.mentions) ? n.mentions : c && Number.isInteger(c.occurrences) ? c.occurrences : null;
        const how = W("screen.document.names.matched." + (["identifier", "reference", "reference_key", "label", "testimony"].includes(n.matched_by) ? n.matched_by : "none"));
        const said0 = page !== null && count !== null ? W("document.names.row", { n: String(count), page: String(page), chosen: { html: chosen } }) : chosen;
        const said = how + " · " + said0;
        const grade = /^[A-D]$/.test(String(n.grade || "")) ? cs.grade("subject", String(n.grade)) : cs.mark("gap", "undetermined");
        const ms = c && Array.isArray(c.mentions) ? c.mentions.filter((m) => m && m.ref) : [];
        const pick = ms.length ? cs.choice("document-mention-" + String(n.entity_id), "act.connectionchoose.label.document", [{ value: "", text: "" }].concat(ms.map((m, i) => {
          const at0 = m.position && Number.isInteger(m.position.page) ? pg(m.position.page) : null;
          return { value: String(i), text: [String(m.ref), at0 !== null ? T("screen.document.passage.where", { page: at0 }) : ""].filter(Boolean).join(" · ") };
        })), { value: "" }) : "";
        return rowOf("", cs.ref("person", String(n.entity_id), String(n.label || n.entity_id), []),
          (c ? pick + cs.act("connectionchoose", { label: "act.connectionchoose.label.document", data: { capture: sha, other: String(other || ""), entity: String(n.entity_id) } }) : "")
          + (n.kind === "person" ? cs.act("identityclaim", { label: "act.identityclaim.label.document", data: { entity: String(n.entity_id) } }) : ""),
          grade + " " + said);
      }).join(""))
        + (cn.state === "failed" ? cs.state(cn, () => "") : "")
        /* G17: a list the plane cut says so (these reads page by `limit` alone, so there is no more act): the names matched, the names found, the connections */
        + ((rs.value.truncated === true || rs.value.names_truncated === true) ? `<p class="mk-small" data-cut="names">${W("screen.people.more", { n: String(names.length) })}</p>` : "")
        + (cn.state === "ok" && cn.value && cn.value.truncated === true ? `<p class="mk-small" data-cut="connections">${W("screen.people.more", { n: String(conns.length) })}</p>` : "")
        + own("connectionchoose")
        + (people ? cs.field("document-claim-person", "screen.document.claim.label", {})
          + cs.choice("document-claim-basis", "screen.document.claim.basis",
              [["name", "screen.document.claim.basis.name"], ["corroborated_name", "screen.document.claim.basis.corroborated"], ["identifier", "screen.document.claim.basis.identifier"]], { value: "name" })
          + cs.field("document-claim-note", "screen.document.claim.note", { area: true, rec: true }) + own("identityclaim") : "")
        + (matches.length ? `<details class="mk-details" data-fold="defect"><summary>${W("screen.document.defect.summary")}</summary><p class="mk-note">${W("screen.document.defect.says")}</p>`
          + cs.choice("document-defect-which", "screen.document.defect.which", [{ value: "", text: "" }].concat(matches.map((x, i) => ({ value: String(i), text: `\u201c${x.ref}\u201d \u00b7 ${labelOf.get(String(x.entity_id)) || x.entity_id}` }))), { value: "" })
          + `<p class="mk-small">${W("screen.document.defect.which.help")}</p>`
          + cs.field("document-defect-why", "screen.document.defect.why", { area: true, rec: true, help: "screen.document.defect.why.help" })
          + `<p class="mk-note">${W("screen.document.defect.at")}</p>` + cs.act("resolutiondefect", { label: "act.resolutiondefect.label.document", data: { sha } }) + own("resolutiondefect") + "</details>" : "")
        + resolveHtml + folds + `<p class="mk-note">${W("screen.document.a31.the_grade_on_each_name_says_how_the_matc")} ${W("screen.document.a31.it_says_nothing_about_how_far_to_trust_t")} ${W("screen.document.a31.a_connection_to_another_document_takes_t")}</p>` + cs.act("explore", { label: "act.explore.label.document", data: { from: id } }), { help: "document.names.help" }));
    }
  }

  /* R138, R139 (K5292, K5303; DEC-440; contradiction R25, R61): "Flags raised on this document", from `contradictioncandidates` with this record (`bundle`): the
     candidates a member flagged (`flagged_by`), each pair named by the two passages' documents, linked to its contradiction, who flagged it and when beneath
     (`screen.contradiction.flagged.by`). Drawn only when a flag exists (R20); a read that fails is drawn failed, never as none. */
  {
    const fl = later("flags", "contradictioncandidates", { bundle: id });
    const flagged = fl.state === "ok" && fl.value && Array.isArray(fl.value.candidates) ? fl.value.candidates.filter((c) => c && c.candidate && c.flagged_by && typeof c.flagged_by === "object") : [];
    /* a passage is named by its document's title (its `image`), or by the question it states, never by an id */
    const sideName = (side) => {
      const src = side && side.source && typeof side.source === "object" ? side.source : {};
      if (src.inquiry) return String(src.title || "") || T("state.undetermined", { reason: "" });
      const im = src.bundle ? later("flagdoc:" + String(src.bundle), "image", { id: String(src.bundle) }) : null;
      const t = im && im.state === "ok" && im.value && typeof im.value["bundle.md"] === "string" ? clean(view.parts.front(im.value["bundle.md"]).title) : "";
      return t || T("state.undetermined", { reason: "" });
    };
    if (fl.state === "failed") out.push(cs.sec("screen.document.flags.head", cs.state(fl, () => "")));
    else if (flagged.length)
      out.push(cs.sec("screen.document.flags.head", `<div data-flags="1">` + cs.sheet(flagged.map((c) => `<div data-flag="${cs.esc(String(c.candidate))}">` + rowOf("",
        cs.ref("contradiction", String(c.candidate), T("screen.document.flags.pair", { a: sideName(c.a), b: sideName(c.b) }), []), "",
        W("screen.contradiction.flagged.by", { member: who(c.flagged_by.member), date: { html: c.flagged_by.at ? dayOf(c.flagged_by.at) : "" } })) + "</div>").join("")) + "</div>"));
  }

  /* R99 (C29; DEC-375): a member asserts a connection between this document and another one the team holds, by hand (`connectionassert`),
     graded D and under her name; the other document is chosen among the documents she can see */
  {
    /* R137: the other document through the one picker (its choice `ui.pickConnect`) */
    if (offered) out.push(cs.sec("screen.document.connect.heading", `<p class="mk-note">${W("screen.document.connect.says")}</p>`
      + picker("connect", "pickConnect", "screen.document.connect.other")
      + `<p class="mk-small">${W("screen.document.connect.other.help")}</p>`
      + cs.field("document-assert-basis", "screen.document.connect.basis", { area: true, rec: true, help: "screen.document.connect.basis.help" })
      + cs.act("connectionassert", { label: "act.connectionassert.label.document", data: { document: id } }) + own("connectionassert")
      + `<p class="mk-note">${W("screen.document.connect.again")}</p>`, { help: "screen.document.connect.help" }));
  }

  /* R56: themes this document or its passages are placed in (never evidence), placements and hunches apart, and the steps it is
     threaded to (`captureprogressions`) */
  if (sha) {
    const tl = later("themes", "themeread", { limit: "200" });
    /* G17: the first 20 themes are drawn (each is a read of its own); the plane's list is longer when it says so, and the more control draws 20 more */
    const allThemes = tl.state === "ok" && tl.value && Array.isArray(tl.value.themes) ? tl.value.themes.filter((t) => t && t.theme_id) : [];
    const themeCap = 20 * Math.max(1, Number(ui.themepages) || 1);
    const themes = allThemes.slice(0, themeCap);
    const themesCut = allThemes.length > themes.length || (tl.state === "ok" && tl.value && tl.value.truncated === true);
    const lines = [];
    /* R78: a placement's page is the record's, drawn from one; none stated, none drawn */
    const pageOf = (v) => (v === null || v === undefined || v === "" || !Number.isInteger(Number(v)) ? null : pg(Number(v)));
    for (const t of themes) {
      const r = later("theme:" + t.theme_id, "themeread", { id: String(t.theme_id), limit: "500" });
      if (r.state !== "ok" || !r.value) continue;
      const mine = (x) => x && (String(x.document || "") === id || String(x.target || "").split(/[#/:?]/)[0] === id);
      for (const m of (Array.isArray(r.value.members) ? r.value.members : []).filter(mine))
        lines.push(`<p class="mk-small" data-theme="${cs.esc(t.theme_id)}"><b>${cs.esc(String(t.name || ""))}</b> ${pageOf(m.page) !== null ? cs.w("screen.document.theme.page", { page: String(pageOf(m.page)), name: who(m.placed_by_handle || ""), date: { html: m.placed_at ? cs.date(String(m.placed_at), { year: true }) : "" }, note: String(m.note || "") })
          : cs.w("screen.document.theme.whole", { kind: T("shell.card.document"), name: who(m.placed_by_handle || ""), date: { html: m.placed_at ? cs.date(String(m.placed_at), { year: true }) : "" } })}`
          + cs.act("themewithdraw", { label: "act.themewithdraw.label.document", data: { theme: String(t.theme_id), target: String(m.target || id) } }) + "</p>");
      for (const h of (Array.isArray(r.value.hunches) ? r.value.hunches : []).filter(mine))
        lines.push(`<p class="mk-small" data-hunch="${cs.esc(t.theme_id)}"><span class="cs-hunch" data-mark="hunch">${cs.w("theme.hunch.mark")}</span> <b>${cs.esc(String(t.name || ""))}</b> ${cs.w("screen.document.theme.proposed", { page: String(pageOf(h.page) === null ? "" : pageOf(h.page)), date: { html: h.proposed_at ? cs.date(String(h.proposed_at), { year: true }) : "" }, note: String(h.proposal_note || "") })}`
          + cs.act("themewithdraw", { label: "act.themewithdraw.label.document", data: { theme: String(t.theme_id), target: String(h.target || id) } }) + "</p>");
    }
    const placeBox = themes.length ? cs.choice("document-theme-which", "theme.section", themes.map((t) => ({ value: String(t.theme_id), text: String(t.name || "") })), {})
      + cs.field("document-theme-note", "theme.place", { rec: true })
      + cs.act("themeplace", { label: "theme.place", data: { target: id } }) + cs.act("themepropose", { label: "theme.propose", data: { target: id } }) : "";
    if (tl.state === "failed") out.push(cs.sec("theme.section", cs.state(tl, () => "")));
    else if (lines.length || placeBox) out.push(cs.sec("theme.section", lines.join("")
      + (themesCut ? `<div class="mk-small" data-cut="themes"><p>${W("screen.people.more", { n: String(themes.length) })}</p>`
        + (allThemes.length > themes.length ? cs.checks("document-themes-more", "shell.more", [{ value: String(Math.max(1, Number(ui.themepages) || 1) + 1), key: "shell.more", on: false }], { radio: true, redraw: "themepages" }) : "") + "</div>" : "")
      + `<p class="mk-small">${W("theme.never.evidence")}</p>` + placeBox));
    const pgr = later("progs", "captureprogressions", { sha256: sha });
    const plist = pgr.state === "ok" && pgr.value ? (Array.isArray(pgr.value.instances) ? pgr.value.instances : Array.isArray(pgr.value.progressions) ? pgr.value.progressions : []) : [];
    if (pgr.state === "failed") out.push(cs.sec("progression.threadedto", cs.state(pgr, () => "")));
    else if (plist.length) {
      /* R84 (C25): a flow the document is threaded under is threaded to another of its steps by `thread` with the flow's key, the entity
         and one placement for the step chosen among the flow's own (`progression`); each flow and entity once */
      const flows = [];
      for (const x of plist) if (x && x.progression_key && x.entity_id && !flows.some((f) => f.key === String(x.progression_key) && f.entity === String(x.entity_id)))
        flows.push({ key: String(x.progression_key), entity: String(x.entity_id), label: String(x.progression_label || x.label || x.progression_key) });
      const threadBox = flows.map((f, i) => {
        const def = later("flow:" + f.key, "progression", { key: f.key });
        const stages = def.state === "ok" && def.value && Array.isArray(def.value.stages) ? def.value.stages.filter((g) => g && g.stage_key) : [];
        return stages.length ? cs.choice("document-thread-stage-" + i, "progression.steps", [{ value: "", text: "" }].concat(stages.map((g) => ({ value: String(g.stage_key), text: String(g.label || g.stage_key) }))), { value: "" })
          + cs.act("thread", { label: "progression.thread.here", data: { progression: f.key, entity: f.entity, n: String(i), sha } }) : "";
      }).join("");
      out.push(cs.sec("progression.threadedto", cs.sheet(plist.map((x) => rowOf("", `<span class="rec">${cs.esc(String(x.progression_label || x.label || x.progression_key || ""))}</span>`, "",
        W("progression.followed", { progression: String(x.progression_label || x.label || x.progression_key || ""), n: String(x.definition_version || x.thread_version || "") }))).join("")) + threadBox + own("thread")));
    }
  }

  /* R55: the copy's other acts sit at the foot: attest with when it is useful, whether its route can be shown (R98), watching and checking
     (R15, R92, R118) and retire folded apart (R113). Watching names its frequency; "Check for a new version now" is drawn only for an address
     that is watched (its `monitoring.enabled`), otherwise the page says it is not and offers "Watch for changes". */
  const watched = !testimony && !!(doc.maps.monitoring && String(doc.maps.monitoring.enabled) === "true");
  /* R98 (K4259; provenance-routes R15): the document's standing route is read (`provenanceroutes` with `bundleId`); the answer of the act she
     pressed, newer than the read, stands over it until the page reads it again */
  const routeRead = later("route", "provenanceroutes", { bundleId: id });
  const routeNow = ui.route && typeof ui.route === "object" ? ui.route : routeRead.state === "ok" && routeRead.value && typeof routeRead.value === "object" ? routeRead.value : null;
  const finding = routeNow && routeNow.route && typeof routeNow.route === "object" ? String(routeNow.route.finding || "") : "";
  out.push(cs.sec("screen.document.copyacts.head",
    cs.act("attest", { label: "document.attest.label", data: { sha } }) + `<p class="mk-small">${cs.w("document.attest.when")}</p>` + own("attest")
    /* the registry's `captureprogressions`: the steps this document is threaded to, asked for again by the member (above, R56, they are
       drawn from the read the page makes when it opens) */
    + (sha ? cs.act("captureprogressions", { label: "act.captureprogressions.label.document", data: { sha }, tone: "quiet" }) : "")
    + cs.sheet(rowOf("", `<span class="rec" data-route="${cs.esc(finding || "unchecked")}">${W(finding === "PRESENT" ? "screen.document.route.shown" : finding === "LOOKED_INDETERMINATE" ? "screen.document.route.notshown" : "screen.document.route.standing")}</span>`
      + `<br><span class="mk-sub">${W("screen.document.route.says")}</span>`, cs.act("provenanceroute", { label: "act.provenanceroute.label.document", data: { document: id } })))
    + (routeRead.state === "failed" && !ui.route ? cs.state(routeRead, () => "") : "")
    + (routeNow && routeNow.appended === false ? `<p class="mk-note" data-route-same="1">${W("screen.document.route.same")}</p>` : "") + own("provenanceroute")
    + (testimony ? "" : (watched ? "" : `<details class="mk-details" data-unwatched="1" open><summary>${W("screen.document.unwatched.head")}</summary><p class="mk-small">${W("screen.document.unwatched")}</p></details>`)
      /* R92, C35: the first frequency is the one shown and the one sent: "Every day" is chosen, with no empty option before it */
      + cs.choice("document-watch-freq", "screen.capture.address.freq", ["daily", "weekly", "monthly", "hourly", "per_meeting"].map((f) => [f, "screen.capture.address.freq." + f]), { value: "daily" })
      + cs.act("monitorset", { label: "act.monitorset.label.document", data: { document: id } }) + own("monitorset")
      + (watched ? cs.act("monitor", { label: "act.monitor.label.document", data: { document: id } }) + own("monitor") : ""))
    /* R123 (C33; BOB B26): a held copy is not retired but set aside, on the Held screen: no retire here, only a door to that screen */
    + (retiredNow ? "" : isHeld && !vouched ? `<p><a class="cs-btn" data-tone="quiet" href="/app/held" data-nav data-held-door="1">${W("screen.held.name")}</a></p>`
      : `<details class="mk-details" data-fold="retire"><summary>${cs.w("document.retire.fold")}</summary><p class="mk-small">${cs.w("document.retire.when")}</p>`
      + cs.act("retire", { label: "document.retire.label", data: { document: id } }) + own("retire") + "</details>")));

  /* R108 (C23; DEC-381): "Where this document came from", after "This copy": the system it came from, declared by a member with her name
     and the date (`declareorigin`, provenance R64). A second declaration is added beside the first and never replaces it: the
     declarations made on this page stay listed in the order they were made. */
  /* the declarations are read (`origins`, provenance R70: oldest first, each `{seq, system, by, at}`); a read that fails is drawn failed */
  const og = later("origins", "origins", { bundleId: id });
  const origins = og.state === "ok" && og.value && Array.isArray(og.value.origins) ? og.value.origins.filter((o) => o && o.system) : [];
  /* R108 (C20): the statement an upload stored (provenance R63: the register document's `origin_statement` `{text, words_of}`, the member's words,
     never evidence of the file's truth) is drawn first, as its fields, each under its word key (the labels the capture screen composed it
     with: how it was got, where and when, what it shows), then who said it and when. A field it holds no words for is not drawn. */
  const statementHtml = (() => {
    const src = (regDocs.find((x) => x.origin_statement && typeof x.origin_statement === "object" && typeof x.origin_statement.text === "string" && x.origin_statement.text.trim()) || {}).origin_statement
      || (prov && prov.origin_statement && typeof prov.origin_statement.text === "string" && prov.origin_statement.text.trim() ? prov.origin_statement : null);
    if (!src) return "";
    const keys = ["screen.capture.file.how", "screen.capture.file.where", "screen.capture.file.what"].map((k) => [k, T(k)]);
    const got = [];
    for (const ln of String(src.text).split(/\r?\n/)) {
      const hit = keys.find(([, lab]) => ln.startsWith(lab + ": "));
      if (hit) got.push({ key: hit[0], value: ln.slice(hit[1].length + 2) });
      else if (got.length) got[got.length - 1].value += "\n" + ln;
    }
    const fields = got.filter((g) => g.value.trim());
    /* a statement in none of the labels' words is drawn as the member wrote it, under no head */
    const body = fields.length ? fields.map((g) => `<p data-statement-field="${g.key}"><b>${W(g.key)}</b> <span class="rec">${cs.esc(g.value.trim())}</span></p>`).join("")
      : `<p class="rec" data-statement-raw="1">${cs.esc(String(src.text).trim())}</p>`;
    const by = src.words_of ? `<p class="mk-small">${W("screen.document.said_by", { member: who(String(src.words_of).replace(/^member:/, "")), date: { html: dayOf(doc.source.retrieved || doc.created) } })}</p>` : "";
    return `<div class="mk-note" data-statement="1">${body}${by}</div>`;
  })();
  out.push(cs.sec("screen.document.origin.head", statementHtml + cs.field("document-origin-system", "screen.document.origin.field", { rec: true, help: "screen.document.origin.eg" })
    + cs.act("declareorigin", { label: "act.owed_declareorigin.label.document", data: { document: id }, tone: "primary" }) + own("declareorigin")
    + `<p class="mk-note">${W("screen.document.origin.second1")} ${W("screen.document.origin.second2")}</p>`
    + (origins.length ? cs.sheet(origins.map((o) => `<div data-origin="${cs.esc(String(o.seq))}">` + rowOf("", `<span class="rec">${cs.esc(String(o.system))}</span>`, "",
        [cs.esc(who(o.by)), o.at ? cs.date(String(o.at), { year: true }) : ""].filter(Boolean).join(" \u00b7 ")) + "</div>").join("")) : "")
    + (og.state === "failed" ? cs.state(og, () => "") : ""), { help: "screen.document.origin.tip" }));
  return out.join("");
}

/** R117 (L9, L20): a refusal whose answer carries `findings[]` is drawn by its first finding, not by the code's generic sentence: the
 *  word held for the finding's code where there is one, else the finding's own words (`translation`, else `detail`) with its check.
 *  A refusal with no finding is the word held for its code, else the plane's words. Self-contained (the page carries it by its text). */
function findingsRefusal(refusal, cs) {
  const r = refusal && typeof refusal === "object" ? refusal : {};
  const f = (Array.isArray(r.findings) ? r.findings : []).find((x) => x && typeof x === "object" && (x.code || x.translation || x.detail));
  if (f) {
    const key = f.code ? "refusal." + f.code : "";
    /* R117 (C41; basis-version-grammar R11): a finding that refuses a version for legs left unplaced carries `legs`, the ids of those legs; each is
       named by its document's title (`legTitles`, read by the act's `failed`), the plain word `shell.card.document` for one with none, drawn once */
    const ids = Array.isArray(f.legs) ? f.legs.map(String).filter(Boolean) : [];
    const titles = r.legTitles && typeof r.legTitles === "object" ? r.legTitles : {};
    const names = ids.map((id) => (titles[id] ? cs.esc(String(titles[id])) : cs.w("shell.card.document")));
    const legs = names.length ? ' <span data-finding-legs="1">' + names.filter((n, i) => names.indexOf(n) === i).join(", ") + "</span>" : "";
    if (key && cs.w(key) !== key) return cs.w(key) + legs;
    return (f.check ? '<span class="id">' + cs.esc(String(f.check)) + "</span> " : "") + cs.esc(String(f.translation || f.detail || "")) + legs;
  }
  const generic = "refusal." + String(r.code || r.reason || "");
  return cs.w(generic) !== generic ? cs.w(generic) : r.translation ? cs.esc(String(r.translation)) : cs.w("shell.unread");
}

/** C41 (R117): before a refused version is drawn, the titles of the documents its first finding's `legs` name are read (`image`), handed to
 *  `findingsRefusal` as `legTitles`. Self-contained. */
async function legTitlesFailed(view, answer, cs) {
  if (!answer || answer.kind !== "refused") return;
  const f = (Array.isArray(answer.fields && answer.fields.findings) ? answer.fields.findings : []).find((x) => x && typeof x === "object" && (x.code || x.translation || x.detail));
  const ids = f && Array.isArray(f.legs) ? f.legs.map(String).filter(Boolean) : [];
  const legTitles = {};
  for (const id of ids) {
    try {
      const a = await cs.call("image", { query: { id } });
      const r = a && a.result !== undefined ? a.result : a;
      const t = r && typeof r["bundle.md"] === "string" ? view.parts.front(r["bundle.md"]).title : "";
      if (t) legTitles[id] = String(t);
    } catch { /* a leg whose document cannot be read is named by the plain word */ }
  }
  answer.fields = Object.assign({}, answer.fields, { legTitles });
}

/** R129 (cite-refusal; citation R21): a cite refused is drawn by its first finding as R117 draws it (the same reading of `findings` as `findingsRefusal`, here whole because a
 *  refusal's function is carried by its own text). citation answers no `repairs` since R21 retired its C-2.8 arm (K5101), so no repair control is drawn (fix round 10, item 35). Self-contained. */
function citeRefusal(refusal, cs) {
  const r = refusal && typeof refusal === "object" ? refusal : {};
  const f = (Array.isArray(r.findings) ? r.findings : []).find((x) => x && typeof x === "object" && (x.code || x.translation || x.detail));
  if (f) {
    const key = f.code ? "refusal." + f.code : "";
    if (key && cs.w(key) !== key) return cs.w(key);
    return (f.check ? '<span class="id">' + cs.esc(String(f.check)) + "</span> " : "") + cs.esc(String(f.translation || f.detail || ""));
  }
  const generic = "refusal." + String(r.code || r.reason || "");
  return cs.w(generic) !== generic ? cs.w(generic) : r.translation ? cs.esc(String(r.translation)) : cs.w("shell.unread");
}

/** R129 (N5; extraction R80 as amended): "Read it now" on a copy stored with no reading (a photo whose promotion was cut short, a record stored unread
 *  before readers were made): `op=readheld` reads the held bytes and keeps the first reading, and the page reads the copy again. It is held apart from `acts`
 *  as `browserActs` is: interface-shell's `checkScreens` admits an act on a screen only when the registry lists it or `RE_POINTS` names it, and until
 *  interface-shell names `readheld` for `document` the screen draws neither the sentence nor the act (and no raw key). Self-contained. */
const readheldActs = Object.freeze(Array.isArray(RE_POINTS.document) && RE_POINTS.document.includes("readheld") ? [
  { op: "readheld", label: "document.read.title", rereads: [],
    send(view, el) { return { body: { sha: String(el.dataset.sha || "") } }; },
    /* the answer is `{ok, read, why}` (extraction R80): a reading made is read again below; `NO_WHOLE_OBJECT` and `NO_HOME` are said; `READING_HELD`
       means a reading is there now and is read again */
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const why = r && r.read === false ? String(r.why || "") : "";
      /* the rows owed (K4269; asked of the design: `screen.document.readnow.refused.NO_HOME` and `.NO_WHOLE_OBJECT`) are stood in for by the nearest rows held:
         a record the team's Civicsmith does not hold or the member cannot see, and a stored copy that cannot be read */
      const key = why === "NO_HOME" ? "refusal.CAPTURE_NOT_HELD" : why === "NO_WHOLE_OBJECT" ? "transcribe.why.evidenceabsent" : "";
      cs.set("outcome", Object.assign({}, view.ui.outcome, { readheld: key ? { ok: false, html: cs.w(key) } : null }));
      cs.set("later", Object.assign({}, view.ui.later, { reading: null }));
    } },
] : []);

/** R139 (T51 fix round 10; DEC-439; D-M3, C-M7; entities R11): "Find the people and offices it names", `resolve` over this copy's capture (`captureSha`). The names the reading holds
 *  are matched to the subjects the record knows; the page then reads its names again, and says `screen.document.people.none` when the answer matched none. Held apart as
 *  `readheldActs` is: carried only once the registry (or `RE_POINTS`) admits it (admit.mjs). Self-contained. */
const resolveActs = Object.freeze(admitted("document", "resolve") ? [
  { op: "resolve", label: "act.resolve.label.document", rereads: [],
    send(view, el) { return { body: { captureSha: String(el.dataset.sha || "") } }; },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const n = r && Array.isArray(r.resolved) ? r.resolved.length : r && Number.isInteger(r.resolved) ? r.resolved : null;
      cs.set("outcome", Object.assign({}, view.ui.outcome, { resolve: n === 0 ? { ok: true, html: cs.w("screen.document.people.none") } : null }));
      cs.set("later", Object.assign({}, view.ui.later, { resolutions: null, connections: null }));
    } },
] : []);

/** R3's, R15's, R32's, R56's and R61's acts. */
const acts = [
  /* R56: a placement in a theme (or a hunch, apart), taken out with a reason */
  ...["themeplace", "themepropose"].map((op) => ({ op, label: "theme." + (op === "themeplace" ? "place" : "propose"), rereads: [],
    send(view, el, cs) {
      const theme = String(cs.value("document-theme-which") || "");
      if (!theme) return { refuse: "screen.document.cite.noquestion" };
      const note = String(cs.value("document-theme-note") || "").trim();
      return { body: { theme, target: String(view.subject || ""), ...(note ? { note } : {}) } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { themes: null })); } })),
  { op: "themewithdraw", label: "act.themewithdraw.label.document", rereads: [], reasonField: "reason",
    send(view, el) { return { body: { theme: String(el.dataset.theme || ""), target: String(el.dataset.target || view.subject || "") } }; },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { themes: null })); } },
  /* the registry's `captureprogressions` (progressions R19): the steps of every flow this capture is threaded to, read again at the member's
     press, and drawn where R56 draws them */
  { op: "captureprogressions", label: "act.captureprogressions.label.document", rereads: [],
    send(view, el) { return { query: { sha256: String(el.dataset.sha || "") } }; },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { progs: null })); } },
  /* R84 (C25): the flow's key, the entity (from `captureprogressions`) and one placement for the step chosen among the flow's own */
  { op: "thread", label: "progression.thread.here", rereads: [],
    send(view, el, cs) {
      const stage = String(cs.value("document-thread-stage-" + String(el.dataset.n || "")) || "");
      if (!stage) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("progression.steps") } } };
      return { body: { progressionKey: String(el.dataset.progression || ""), entityId: String(el.dataset.entity || ""), placements: [{ stage, captureSha: String(el.dataset.sha || "") }] } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { progs: null })); } },
  /* R32, R69: a newer version's notice decided here: adopt it with her reason, or keep the version cited; the rows re-read their
     notices, so a decided row is drawn as decided */
  /* C41 (R35, R50, R117): a basis version the plane refused is drawn by its first finding, as a refused basis is */
  { op: "adoptversion", label: "act.adoptversion.label.document", reasonField: "why", rereads: ["backlinks"], failed: legTitlesFailed, refusals: { BASIS_VERSION_REFUSED: findingsRefusal },
    send(view, el, cs) {
      const notice = String(el.dataset.notice || "");
      const why = String(cs.value("document-version-why-" + notice) || "").trim();
      return { body: { notice, why } };
    },
    done(view, answer, cs) { cs.set("later", Object.fromEntries(Object.entries(view.ui.later || {}).filter(([k]) => !k.startsWith("renotices:")))); } },
  { op: "keepversion", label: "act.keepversion.label.document", rereads: ["backlinks"], failed: legTitlesFailed, refusals: { BASIS_VERSION_REFUSED: findingsRefusal },
    send(view, el, cs) {
      const notice = String(el.dataset.notice || "");
      const why = String(cs.value("document-version-why-" + notice) || "").trim();
      return { body: { notice, ...(why ? { why } : {}) } };
    },
    done(view, answer, cs) { cs.set("later", Object.fromEntries(Object.entries(view.ui.later || {}).filter(([k]) => !k.startsWith("renotices:")))); } },
  /* R69: asked by the member for one question, never on load: whether a newer copy of this document exists (reevaluation R10, R11);
     the answer is kept for that question's row */
  { op: "versionnotice", label: "act.versionnotice.label.document", rereads: [],
    send(view, el) { view.ui.asking = String(el.dataset.question || ""); return { query: { target: String(el.dataset.question || "") } }; },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const q = String((r && r.target) || view.ui.asking || "");
      const next = Object.assign({}, view.ui.asked);
      next[q] = r && r.ok !== false && Array.isArray(r.notices) ? { state: "ok", legs: r.notices } : { state: "failed", words: r && r.translation ? cs.esc(r.translation) : "" };
      cs.set("asked", next);
    } },
  /* R32: the mention that counts for a name, chosen by her (connections R14–R16) */
  /* R85 (C28; B18): the mention she chose among those the connection row lists (connections R70), by its `ref`, and its `occurrence` where
     the reading kept one; the mention already on point is never the default, and none chosen sends nothing */
  { op: "connectionchoose", label: "act.connectionchoose.label.document", rereads: [],
    send(view, el, cs) {
      const ds = el.dataset;
      const L = view.ui.later || {};
      const rows = L.connections && L.connections.state === "ok" && L.connections.value && Array.isArray(L.connections.value.connections) ? L.connections.value.connections : [];
      const c = rows.find((x) => x && String(x.entity_id) === String(ds.entity || ""));
      const ms = c && Array.isArray(c.mentions) ? c.mentions.filter((m) => m && m.ref) : [];
      const at = String(cs.value("document-mention-" + String(ds.entity || "")) || "");
      const m = at !== "" && /^\d+$/.test(at) ? ms[Number(at)] : null;
      if (!m) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("act.connectionchoose.label.document") } } };
      return { body: { capture: ds.capture || "", other: ds.other || "", entity: ds.entity || "", ref: String(m.ref), ...(m.occurrence !== null && m.occurrence !== undefined ? { occurrence: m.occurrence } : {}) } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { connections: null })); } },
  /* R32: the connection graph started from this document (`explore`'s screen, its own reads) */
  { op: "explore", label: "act.explore.label.document", rereads: [],
    send(view, el, cs) { cs.go("explore", String(el.dataset.from || view.subject || "")); return null; } },
  { op: "gradenote", label: "act.gradenote.label.document",
    send(view, el) { return { query: { capture: el.dataset.capture || "" } }; },
    done(view, answer, cs) { cs.set("gradenote", answer && answer.result !== undefined ? answer.result : answer); },
    rereads: [] },
  { op: "findin", label: "act.findin.label.document", rereads: [],
    /* `find-in`'s scope is the route's subject: for a document, its capture's digest (screens-daily) */
    send(view, el, cs) { if (el.dataset.capture) cs.go("find-in", el.dataset.capture); return null; } },
  { op: "cite", label: "act.cite.label.document", rereads: ["backlinks"], refusals: { BASIS_REFUSED: citeRefusal, ACTION_BASIS_REFUSED: findingsRefusal },
    async send(view, el, cs) {
      const question = String(cs.value("document-cite-question") || "").trim();
      /* N2 (R61, R49): with no question chosen nothing is sent, and the sentence is said beside the act pressed (the fold at the foot of the
         reading is kept for the page's reload), never silently */
      if (!question) { cs.set("citeNone", true); return { refuse: "screen.find-in.questionfirst" }; }
      cs.set("citeNone", false);
      const role = cs.value("document-cite-role") === "cuts_against" ? "cuts_against" : "supports";
      view.ui.citing = question;
      /* R125 (C31; citation R20): the citing object, the role and the passage found go in the body, none in the address; `found` as the object it is */
      let found = el.dataset.found || "";
      try { found = JSON.parse(found); } catch { /* sent as the string it is */ }
      return { body: { project: question, role, found } };
    },
    /* C30 (R3, R49): the answer is read, never left silent: what was cited, or that the question already rests on a passage of this document
       (citation answers 200 with `cited: []` and `alreadyCited`); the page then names the passage and links the question, where it is narrowed */
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
      const q = String((r && r.inquiry) || view.ui.citing || "");
      /* the question's bundle is read again, so the passage cited is marked from its legs (R125) */
      if (list(r && r.cited).length) cs.set("later", Object.assign({}, view.ui.later, { ["qimg:" + q]: null }));
      cs.set("citeDone", { question: q, cited: list(r && r.cited), already: list(r && r.alreadyCited) });
    } },
  /* reasoned: the member's own acknowledgment is its reason (interface-shell R11, DEC-88), so no second one is asked */
  { op: "release", label: "act.release.label.document", rereads: ["capture"], reasonField: "acknowledgment",
    send(view, el, cs) {
      const f = { acknowledgment: String(cs.value("document-release-ack") || "").trim(), mitigation: String(cs.value("document-release-mitigation") || "").trim() };
      if (!f.acknowledgment || !f.mitigation) return { refuse: "screen.document.release.empty" };
      const said = (key, a) => {
        const r = a && a.result !== undefined ? a.result : a;
        const ok = !!(a && a.ok !== false && r && r.ok !== false);
        const o = Object.assign({}, view.ui.outcome);
        o[key] = { ok, html: ok ? "" : (r && (r.findings || r.translation) ? view.parts.findingsRefusal(r, cs) : cs.w("state.failed", { reason: (r && (r.code || r.reason)) || "" })) };
        cs.set("outcome", o);
        return ok;
      };
      cs.call("select", { body: { ids: [String(view.subject || "")] } }).then((s) => {
        const sr = s && s.result !== undefined ? s.result : s;
        if (!sr || !sr.handle) return said("release", s);
        return cs.call("release", { query: { handle: sr.handle, acknowledgment: String(f.acknowledgment || ""), mitigation: String(f.mitigation || "") } })
          .then((a) => said("release", a));
      }, () => said("release", null));
      return null;
    } },
  /* R55 (C40; attestation R3): one act obtains the trusted timestamp and the co-archive: the archive is asked (`archive: true` with the address) only
     for the document's own public https address (a hostname with a dot, not a local name or an address of numbers), and for no other; the answer
     says in words which of the two is still missing */
  { op: "attest", label: "act.attest.label.document", rereads: ["capture"],
    refusals: { NO_ATTESTATION: (r, cs) => {
      const k = "refusal.NO_ATTESTATION";
      if (r.archive) return cs.w("filings.archive_trusted_timestamp");
      return cs.w(k) !== k ? cs.w(k) : r.translation ? cs.esc(String(r.translation)) : cs.w("shell.unread");
    } },
    send(view, el, cs) {
      const body = { sha256: el.dataset.sha || "" };
      const md = view.data.capture && view.data.capture.state === "ok" ? String(view.data.capture.value["bundle.md"] || "") : "";
      const loc = md && !/Authored through op=testify/.test(md) ? String(view.parts.front(md).maps.source && view.parts.front(md).maps.source.locator || "") : "";
      let u = null;
      try { u = new URL(loc); } catch { u = null; }
      const host = u ? u.hostname : "";
      if (u && u.protocol === "https:" && host.includes(".") && !/^[\d.]+$/.test(host) && !host.includes(":") && !/(^|\.)(localhost|local|internal|localdomain)$/i.test(host)) { body.archive = true; body.locator = loc; }
      return { body };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const html = r && r.archive ? cs.w("screen.document.attest.done") : cs.w("filings.trusted_timestamp_archive");
      cs.set("outcome", Object.assign({}, view.ui.outcome, { attest: { ok: true, html } }));
    } },
  /* R113 (L11): Confirm, with her reason, selects this copy and then retires it with the handle; the shell draws the plane's refusal beside
     the act and, on success, the page says the copy is retired by key and reads the document again. A reason is the member's: with none
     nothing is sent. A select that fails draws its own refusal and sends no retire. */
  { op: "retire", label: "act.retire.label.document", rereads: ["capture"],
    /* R123 (C33): the plane's two refusals in sentences of their own, never the release act's. `failed` hands the refusal the page's own citers (their
       titles, from `backlinks`) since a refusal's function sees only the refusal and the kit. A sentence is drawn only where a word is held for it
       (`screen.document.retire.refused.cited`, `.illegal`: wanted, not yet held); `ILLEGAL_TRANSITION` otherwise draws nothing, and `CITED` the
       plane's own words with the questions that cite the copy, each a door to its page, where a citation is removed. */
    failed(view, answer) {
      if (!answer || answer.kind !== "refused") return;
      const d = view.data && view.data.backlinks;
      const backs = d && d.state === "ok" && d.value && Array.isArray(d.value.backlinks) ? d.value.backlinks : [];
      answer.fields = Object.assign({}, answer.fields, { pageCiters: backs.filter((b) => b && b.from).map((b) => ({ id: String(b.from), type: String(b.from_type || ""), title: String(b.from_title || "") })) });
    },
    refusals: {
      ILLEGAL_TRANSITION: (r, cs) => { const k = "screen.document.retire.refused.illegal"; return cs.w(k) !== k ? cs.w(k) : ""; },
      CITED: (r, cs) => {
        const page = Array.isArray(r.pageCiters) ? r.pageCiters : [];
        const named = (Array.isArray(r.offenders) ? r.offenders : []).flatMap((o) => (o && Array.isArray(o.citedBy) ? o.citedBy : [])).map(String);
        const ids = named.length ? named.filter((x, i) => named.indexOf(x) === i) : page.filter((c) => c.type === "inquiry").map((c) => c.id);
        const refs = ids.map((id) => {
          const hit = page.find((c) => c.id === id);
          const title = hit && hit.title ? hit.title : cs.w("state.undetermined", { reason: "" });
          const kind = /^INQ-/.test(id) ? "question" : /^PROJ-/.test(id) ? "project" : /^INFO-/.test(id) ? "document" : "record";
          return `<span data-citer="${cs.esc(id)}">${cs.ref(kind, id, hit && hit.title ? hit.title : title, [hit && hit.title ? hit.title : ""])}</span>`;
        }).join(" ");
        const k = "screen.document.retire.refused.cited";
        if (cs.w(k) !== k) { const said = cs.w(k, { questions: { html: refs } }); return said.includes(refs) ? said : said + " " + refs; }
        return (r.translation ? cs.esc(String(r.translation)) + " " : "") + refs;
      } },
    dialog: [{ name: "reason", label: "screen.document.retire.reason" }],
    async send(view, el, cs, extra) {
      const reason = String(((extra && extra.fields) || {}).reason || "").trim();
      if (!reason) return { refuse: "shell.reason.needed" };
      const s = await cs.call("select", { body: { ids: [String(view.subject || "")] } }).catch(() => null);
      const sr = s && s.result !== undefined ? s.result : s;
      if (!sr || !sr.handle) {
        cs.set("outcome", Object.assign({}, view.ui.outcome, { retire: { ok: false, html: sr && (sr.findings || sr.translation) ? view.parts.findingsRefusal(sr, cs) : cs.w("shell.unread") } }));
        return null;
      }
      return { query: { handle: sr.handle, reason } };
    },
    done(view, answer, cs) {
      cs.set("outcome", Object.assign({}, view.ui.outcome, { retire: { ok: true, html: cs.w("state.item.retired.name") + " " + cs.w("state.item.retired.means") } }));
      cs.set("later", Object.assign({}, view.ui.later, { history: null }));
    } },
  /* R15, R92 (C54): watching asked by the member (`monitoring` R74: `enabled` and the frequency she chose, one of its words); with none
     chosen nothing is sent; the page says it is watched only once the plane has answered, and reads the document again */
  { op: "monitorset", label: "act.monitorset.label.document", rereads: ["capture"],
    send(view, el, cs) {
      const frequency = ["daily", "weekly", "monthly", "hourly", "per_meeting"].find((f) => f === cs.value("document-watch-freq"));
      if (!frequency) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.address.freq") } } };
      return { body: { bundleId: String(view.subject || ""), enabled: true, frequency } };
    },
    done(view, answer, cs) { cs.set("outcome", Object.assign({}, view.ui.outcome, { monitorset: { ok: true, html: cs.w("screen.document.monitorset.done") } })); } },
  /* R15, R93 (C55): what the check found, drawn by the one drawing `screens-intake` owns (its R42) from the answer's `status` and note */
  { op: "monitor", label: "act.monitor.label.document", rereads: ["capture"],
    send(view) { return { body: { bundleId: String(view.subject || "") } }; },
    done(view, answer, cs) {
      const c = view.data.capture && view.data.capture.state === "ok" ? view.parts.front(String(view.data.capture.value["bundle.md"] || "")) : null;
      cs.set("outcome", Object.assign({}, view.ui.outcome, { monitor: { ok: true, html: view.parts.checkOutcome(cs, answer && answer.result !== undefined ? answer.result : answer, c && c.title ? String(c.title) : "") } }));
    } },
  { op: "identityclaim", label: "act.identityclaim.label.document", rereads: [], reasonField: "note",
    send(view, el, cs) {
      const b = String(cs.value("document-claim-person") || "").trim();
      const note = String(cs.value("document-claim-note") || "").trim();
      if (!b || !note || !el.dataset.entity) return { refuse: "screen.document.claim.empty" };
      const text = view.data.capture && view.data.capture.state === "ok" ? view.data.capture.value["bundle.md"] : "";
      /* the capture's own sha, from its provenance document (K3387) */
      let prov = null;
      try { prov = JSON.parse(String((view.data.capture && view.data.capture.state === "ok" && view.data.capture.value["data/provenance.json"]) || "")); } catch { prov = null; }
      const capSha = prov && Array.isArray(prov.documents) && prov.documents[0] && prov.documents[0].capture ? String(prov.documents[0].capture.sha256 || "") : "";
      const m = /^[0-9a-f]{64}$/.test(capSha) ? [null, capSha] : null;
      const basis = ["name", "corroborated_name", "identifier"].includes(cs.value("document-claim-basis")) ? cs.value("document-claim-basis") : "name";
      return { body: { a: el.dataset.entity, b, kind: "same_as", basis, evidence: { a: { captureSha: m ? m[1] : "" } }, note } };
    } },
  { op: "transcribe", label: "act.transcribe.label.document", rereads: [], reasonField: "text",
    send(view, el, cs) {
      const text = String(cs.value("document-unread-words") || "");
      /* R78: the picker draws the page from one; the extent sent is the record's own number */
      const page = Number(cs.value("document-unread-page")) - 1;
      if (!text.trim() || !Number.isInteger(page) || page < 0) return { refuse: "screen.document.unread.empty" };
      return { body: { bundleId: String(view.subject || ""), extent: { kind: "pdf-page", page }, text } };
    },
    done(view, answer, cs) {
      cs.set("outcome", Object.assign({}, view.ui.outcome, { transcribe: { ok: true, html: cs.w("screen.document.transcribe.done", { page: String(cs.value("document-unread-page") || "") }) } }));
      cs.set("later", Object.assign({}, view.ui.later, { reading: null }));
    } },
  /* R96 (C21; DEC-375): the copy read again with OCR, for the pages Civicsmith's own reading could not make out (extraction R31–R35). The
     owner's refusals are drawn by the design's words. The reading is read again once it has answered. */
  { op: "pdfstructure", label: "act.pdfstructure.label.document", rereads: [],
    refusals: { REEXTRACT_NOT_CAPABLE: "screen.document.ocr.refused.capable", REEXTRACT_NO_OCR_MEMBER: "screen.document.ocr.refused.member", REEXTRACT_NOT_READ: "screen.document.ocr.refused.unread" },
    send(view, el) { return { query: { sha256: String(el.dataset.sha || ""), ocr: "1" } }; },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { reading: null })); } },
  /* R97 (C22; DEC-375): a second member confirms another member's typing of a page, with her note of what she compared (content R25); the
     typist's own is refused by the plane and offered no confirmation on the page */
  { op: "transcriptionattest", label: "act.transcriptionattest.label.document", rereads: [], reasonField: "note",
    refusals: { TRANSCRIPTION_SELF_ATTEST: "screen.document.attest.refused.self", ATTEST_NO_NOTE: "screen.document.attest.refused.note" },
    send(view, el, cs) {
      const contentId = String(el.dataset.content || "");
      const note = String(cs.value("document-attest-note-" + contentId) || "").trim();
      if (!note) return { refuse: "screen.document.attest.refused.note" };
      return { body: { contentId, note } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { typed: null })); } },
  /* R98 (C24; DEC-375): whether the document's route to the team can be shown, checked and recorded under her name (provenance-routes); the
     answer is read back: shown, not shown, or nothing new since the last check */
  { op: "provenanceroute", label: "act.provenanceroute.label.document", rereads: [],
    refusals: { ROUTE_MARK_NO_SUCH_BUNDLE: "screen.document.route.refused", ROUTE_MARK_NO_BUNDLE: "screen.document.route.refused" },
    /* C32: the arm reads `bundleId` from the query (provenance-routes R9), so it is sent there and in no body */
    send(view) { return { query: { bundleId: String(view.subject || "") } }; },
    done(view, answer, cs) { cs.set("route", answer && answer.result !== undefined ? answer.result : answer); } },
  /* R99 (C29; DEC-375): a connection she asserts by hand between this document and another one (connections R53), with her reason; graded D */
  { op: "connectionassert", label: "act.connectionassert.label.document", rereads: [], reasonField: "basis",
    refusals: { CONNECTION_ASSERT_NO_BASIS: "screen.document.connect.refused.basis", CONNECTION_ASSERT_BASIS_TOO_LONG: "screen.document.connect.refused.basis", NO_SUCH_BUNDLE: "screen.document.connect.refused.other" },
    send(view, el, cs) {
      /* R137: the picker's one radio choice, kept in page memory whatever page is drawn */
      const b = String(view.ui.pickConnect || "");
      const basis = String(cs.value("document-assert-basis") || "").trim();
      if (!b) return { refuse: "screen.document.connect.refused.other" };
      if (!basis) return { refuse: "screen.document.connect.refused.basis" };
      return { body: { a: String(view.subject || ""), b, basis } };
    } },
  /* R100 (C31; DEC-375): a match the record made, reported as wrong with her reason (entities R38); the match itself does not change */
  { op: "resolutiondefect", label: "act.resolutiondefect.label.document", rereads: [], reasonField: "reason",
    refusals: { NO_REASON: "screen.document.defect.refused.why", NO_REF: "screen.document.defect.refused.gone", NO_ENTITY: "screen.document.defect.refused.gone" },
    send(view, el, cs) {
      const L = view.ui.later || {};
      const rows = L.resolutions && L.resolutions.state === "ok" && L.resolutions.value && Array.isArray(L.resolutions.value.resolutions)
        ? L.resolutions.value.resolutions.filter((x) => x && x.ref && x.entity_id) : [];
      const at = String(cs.value("document-defect-which") || "");
      const m = at !== "" && /^\d+$/.test(at) ? rows[Number(at)] : null;
      if (!m) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.document.defect.which") } } };
      const reason = String(cs.value("document-defect-why") || "").trim();
      if (!reason) return { refuse: "screen.document.defect.refused.why" };
      return { body: { captureSha: String(el.dataset.sha || ""), ref: String(m.ref), entityId: String(m.entity_id), reason } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { resolutions: null })); } },
  /* R126 (DEC-394 (3d); entities R12): from her own knowledge, who a name the record matched to no subject is, and how she knows (grade D); her
     words are the reason, so no second one is asked */
  { op: "resolvetestify", label: "act.resolvetestify.label.document", rereads: [], reasonField: "basis",
    refusals: { NO_BASIS: "screen.document.testify.refused" },
    send(view, el, cs) {
      const L = view.ui.later || {};
      const rows = L.resolutions && L.resolutions.state === "ok" && L.resolutions.value && Array.isArray(L.resolutions.value.unresolved)
        ? L.resolutions.value.unresolved.filter((x) => x && x.ref) : [];
      const at = String(cs.value("document-testify-which") || "");
      const m = at !== "" && /^\d+$/.test(at) ? rows[Number(at)] : null;
      if (!m) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.document.testify.which") } } };
      const entityId = String(cs.value("document-testify-who") || "").trim();
      if (!entityId) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.document.testify.who") } } };
      const basis = String(cs.value("document-testify-how") || "").trim();
      if (!basis) return { refuse: "screen.document.testify.refused" };
      return { body: { captureSha: String(el.dataset.sha || ""), ref: String(m.ref), entityId, basis } };
    },
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { resolutions: null })); } },
  /* R127 (DEC-394 (3e); contradiction R61): a passage here set beside a passage of another document as a contradiction her project settles, with her
     reason; nothing is sent without both passages and the reason, each refused by its own refusal's key. The label is the registry's (a one-line
     change if the registry is re-taken). */
  { op: "contradictionflag", label: "act.contradictionflag.label.document", rereads: [], reasonField: "reason",
    send(view, el, cs) {
      const L = view.ui.later || {};
      /* G38: the passages are those the page offered, every page of the reading read so far (the pages are in the page's memory, in order, so an index the
         page drew is the same here) */
      const units = (r, key, sha) => view.parts.readPages((k) => L[k] || { state: "loading" }, key, sha, r && r.state === "ok" ? r.value : null, null).units
        .filter((u) => u && String(u.text || "").trim() && u.extent && typeof u.extent === "object");
      const hereAt = String(cs.value("document-flag-here") || "");
      const here = hereAt !== "" && /^\d+$/.test(hereAt) ? units(L.reading, "readafter:", String(el.dataset.sha || ""))[Number(hereAt)] : null;
      const otherId = String(view.ui.flagOther || "");
      let otherSha = "";
      try { const img = L["flagimg:" + otherId]; const pj = JSON.parse(String(img && img.state === "ok" && img.value ? img.value["data/provenance.json"] || "" : "")); const c0 = pj && pj.documents && pj.documents[0] && pj.documents[0].capture ? String(pj.documents[0].capture.sha256 || "") : ""; otherSha = /^[0-9a-f]{64}$/.test(c0) ? c0 : ""; } catch { otherSha = ""; }
      const thereAt = String(cs.value("document-flag-there") || "");
      const there = otherSha && thereAt !== "" && /^\d+$/.test(thereAt) ? units(L["flagread:" + otherSha], "flagreadafter:" + otherSha + ":", otherSha)[Number(thereAt)] : null;
      if (!here || !there) return { refuse: "refusal.FLAG_NO_PASSAGE" };
      const reason = String(cs.value("document-flag-why") || "").trim();
      if (!reason) return { refuse: "refusal.FLAG_NO_REASON" };
      return { body: { here: { capture: String(el.dataset.sha || ""), extent: here.extent }, other: { capture: otherSha, extent: there.extent }, reason } };
    },
    /* R138, R139 (K5292, K5303; re-walk C, C-M12 new 4; DEC-439, DEC-440): the answer is drawn beside the act in the design's words, never the owner's
       `says`: `screen.document.flag.recorded` for a flag the world recorded (`wrote`), `screen.document.flag.already` for a pair already held (`already`).
       The list of flags raised on the document is read again, so the new flag is in it. */
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const key = r && r.already === true ? "screen.document.flag.already" : r && r.wrote === true ? "screen.document.flag.recorded" : "";
      cs.set("outcome", Object.assign({}, view.ui.outcome, { contradictionflag: key ? { ok: true, html: cs.w(key) } : null }));
      cs.set("later", Object.fromEntries(Object.entries(view.ui.later || {}).filter(([k]) => k !== "flags")));
    } },
  /* R108 (C23; DEC-381): the system this document came from, declared with her name and the date (provenance R64); a second declaration is
     added beside the first and never replaces it, so each answer is kept in the list the page draws */
  { op: "declareorigin", label: "act.owed_declareorigin.label.document", rereads: [],
    refusals: { ORIGIN_NOT_A_MEMBER: (r, cs) => cs.w("screen.document.origin.ref.machine1") + " " + cs.w("screen.document.origin.ref.machine2"),
      ORIGIN_NO_SYSTEM: "screen.document.origin.ref.empty", ORIGIN_NOT_A_DOCUMENT: "screen.document.origin.ref.notdoc" },
    send(view, el, cs) {
      const system = String(cs.value("document-origin-system") || "").trim();
      if (!system) return { refuse: "screen.document.origin.ref.empty" };
      return { body: { bundleId: String(view.subject || ""), system } };
    },
    /* the list is read again, so a declaration made here and one made elsewhere are both in it, in the order they were made */
    done(view, answer, cs) { cs.set("later", Object.assign({}, view.ui.later, { origins: null })); } },
  { op: "pagetranscribe", label: "act.pagetranscribe.label.document", rereads: [],
    send(view, el) {
      const text = view.data.capture && view.data.capture.state === "ok" ? view.data.capture.value["bundle.md"] : "";
      const m = typeof text === "string" ? /^project:\s*(\S+)\s*$/m.exec(text) : null;
      return { query: { sha256: el.dataset.sha || "", ...(m ? { project: m[1] } : {}) } };
    },
    done(view, answer, cs) {
      const t = (answer && (answer.transcription || (answer.result && answer.result.transcription))) || {};
      /* R78: the pages the assistant read, drawn from one */
      const pages = Array.isArray(t.pages) ? t.pages.map((p) => (Number.isInteger(p) ? p + 1 : p)).join(", ") : "";
      cs.set("outcome", Object.assign({}, view.ui.outcome, { pagetranscribe: { ok: true,
        html: cs.w("screen.document.pagetranscribe.done", { pages }) + (t.untested ? " " + cs.w("ai.label.untested") : "") } }));
      cs.set("later", Object.assign({}, view.ui.later, { reading: null }));
    } },
];

/** R65–R67 (T51; interface-shell R100, op-declarations R76): the browser acts `revisioncompare`, `hashcopy` and `linkopen`, done in the
 *  page: each calls its `send` and sends no request. Held apart from `acts`, and handed over as the screen's `browserActs`: interface-shell's `checkScreens` admits a browser
 *  act only once its R100 is merged and `BROWSER_ACTS` names it (op-declarations R76), and until then an act it does not hold
 *  would stop every screen of the module. Once R100 is merged the screen's acts are `[...acts, ...browserActs]` (one line, below);
 *  until then `cs.act` draws none of the three, so no Copy, no compare and no way past an outside link's warning is offered. */
const browserActs = [
  /* R66: a fingerprint's full value put on the clipboard, as `cs.copy` does */
  { op: "hashcopy", label: "shell.copy",
    send(view, el) {
      const value = String(el.dataset.value || "");
      if (/^[0-9a-f]{64}$/.test(value)) { try { const c = window.navigator && window.navigator.clipboard; if (c && c.writeText) c.writeText(value); } catch { /* the clipboard refused: nothing copied */ } }
      return null;
    } },
  /* R65: two revisions of this copy's record set side by side, from the image answer the page holds */
  { op: "revisioncompare", label: "screen.document.revisions.compare.act",
    /* R81: the compare tab's act carries its pair as its own data (the cited revision and the current copy); the fold's act reads its two choices */
    send(view, el, cs) {
      const a = el && el.dataset.a !== undefined ? el.dataset.a : cs.value("document-rev-a");
      const b = el && el.dataset.b !== undefined ? el.dataset.b : cs.value("document-rev-b");
      cs.set("revcmp", { a: String(a || ""), b: String(b || "") }); return null;
    } },
  /* R67: an outside link's warning opens ("ask"), closes ("stay") or lets the address open in a new window ("open"); a script
     scheme is never opened */
  { op: "linkopen", label: "act.owed_linkopen.label.document",
    send(view, el, cs) {
      const step = String(el.dataset.step || "");
      const address = String(el.dataset.address || "");
      if (step === "ask") { if (/^https?:\/\//i.test(address)) cs.set("leaving", address); return null; }
      if (step === "open" && /^https?:\/\//i.test(address)) { try { window.open(address, "_blank", "noopener"); } catch { /* the browser refused: nothing opened */ } }
      cs.set("leaving", null);
      return null;
    } },
];

/** The keys the document screen may draw (R44: keys only). */
const words = Object.freeze([
  "screen.document.name", "screen.document.purpose",
  ...["gradenote", "findin", "cite", "release", "attest", "retire", "monitorset", "monitor", "identityclaim", "transcribe", "pagetranscribe",
    "adoptversion", "keepversion", "versionnotice", "connectionchoose", "explore", "captureprogressions"].map((op) => "act." + op + ".label.document"),
  "act.pagetranscribe.does", "ai.label.untested", "document.unread.pages", "document.read.title", "refusal.CAPTURE_NOT_HELD", "transcribe.why.evidenceabsent",
  /* T50 (R54–R56, R61) */
  "document.held.says", "document.vouched", "document.attest.label", "document.attest.when", "document.retire.fold", "document.retire.when",
  "document.retire.label", "document.image.unread", "document.image.unread.summary", "document.table.flattened", "document.untitled.web",
  "document.read.cite", "screen.document.cite.question.help", "screen.document.cite.none.summary", "screen.find-in.questionfirst",
  "screen.document.said_by", "screen.capture.file.how", "screen.capture.file.where", "screen.capture.file.what", "screen.finder.cite.cited", "screen.finder.a17.left_as_it_was", "screen.finder.a17.the_question_already_cited_it",
  "theme.section", "theme.never.evidence", "theme.place", "theme.propose", "theme.hunch.mark", "screen.document.theme.page",
  "screen.document.theme.whole", "screen.document.theme.proposed", "progression.threadedto", "progression.followed", "progression.thread.here",
  "shell.card.document", "screen.held.name", "screen.document.retire.refused.illegal", "screen.document.retire.refused.cited", "shell.search", "act.resolvetestify.label.document", "act.contradictionflag.label.document", "screen.document.testify.how",
  ...["head", "note1", "note2", "note3", "which", "which.help", "who", "how", "how.help", "how.help2", "refused"].map((k) => "screen.document.testify." + k),
  ...["head", "note1", "note2", "here", "here.help", "other", "other.help", "why", "why.help"].map((k) => "screen.document.contradict." + k),
  /* R139 (DEC-439, DEC-440): the flag's two sentences, the list of flags raised on the document, "Checked by", and the people the document names */
  "screen.document.flag.recorded", "screen.document.flag.already", "screen.document.flags.head", "screen.document.flags.pair", "screen.contradiction.flagged.by",
  "screen.document.attest.checked", "act.resolve.label.document", "screen.document.people.none",
  "refusal.FLAG_NO_PASSAGE", "refusal.FLAG_SAME_DOCUMENT", "refusal.FLAG_NO_REASON", "filings.trusted_timestamp_archive", "filings.archive_trusted_timestamp", "refusal.NO_ATTESTATION", "act.themewithdraw.label.document",
  "mark.scale.capture.name", "mark.scale.capture.means", "mark.scale.testimony.name", "mark.scale.testimony.means", "mark.grade.reading",
  "mark.scale.subject.name", "mark.scale.subject.means", "mark.gap.undetermined.name", "mark.gap.undetermined.means",
  "state.empty", "state.loading", "state.failed", "state.undetermined", "shell.reason", "shell.reason.help", "shell.unread", "shell.copy",
  "member.founder.unnamed", "screen.question.supports.head", "screen.question.against.head",
  "document.links.title", "document.links.help", "document.links.held",
  "document.names.title", "document.names.help", "document.names.row", "document.names.chosen.record", "document.names.chosen.member",
  /* T51 (R65–R69, R78): the record of this copy, the fingerprints, the links in five groups, the names, "Your citations, leg by leg" */
  "time.at", "time.clock", "time.am", "time.pm", "document.versions.thiscopy", "state.item.retired.name",
  "refusal.IMAGE_TOO_LARGE", "refusal.TRUNCATED_IMAGE_DATA", "refusal.UNSUPPORTED_JPEG_PROCESS", "refusal.DECODE_FAILED", "refusal.NO_PAGE_RENDERED",
  "refusal.CONTENT_EXTENT_NO_CHAIN", "refusal.NO_SUCH_BUNDLE", "refusal.NO_SUCH_DOCUMENT", "document.uploaded.by", "refusal.NO_BUNDLE", "refusal.NO_SHA", "refusal.VERSION_NOTICE_NO_INQUIRY", "refusal.VERSION_NOTICE_NO_SUBJECT",
  "act.owed_linkopen.label.document", "act.owed_linkopen.does", "act.owed_revisioncompare.label.document", "act.owed_revisioncompare.does",
  "act.owed_hashcopy.label.document", "act.owed_hashcopy.does", "act.versionnotice.does",
  ...["fingerprints.head", "revision.title", "revisions.compare", "revisions.with", "revisions.compare.act", "fingerprint.setonly",
    "links.group.inside", "links.group.beside", "links.group.held", "links.group.outside", "links.group.refused", "links.verdict.final",
    "links.verdict.checked", "links.verdict.same", "links.verdict.different", "links.verdict.notestablished", "links.verdict.nocapture",
    "links.verdict.refused"].map((k) => "screen.document." + k),
  ...["a26.this_copy_s_words_and_file", "a26.computed_from_the_exact_bytes_of_this_co", "a26.this_copy_and_the_files_captured_with_it",
    "a26.computed_from_the_whole_set_so_the_set_c", "a26.short_codes_computed_from_the_exact_byte", "a26.anyone_holding_the_same_bytes_computes_t",
    "a27.the_record_of_this_copy", "a27.the_release_of_civicsmith_that_wrote_thi", "a27.everything_done_to_this_copy_s_standing_",
    "a27.none_of_it_is_ever_changed_or_removed", "a27.held_until_vouched_for", "a27.vouched_for_by_dev", "a27.now_used_by_the_team",
    "a27.earlier_revisions_of_this_record", "a27.standing_held_until_vouched_for", "a27.vouched_for_by_nobody", "a27.standing_used_by_the_team",
    "a27.vouched_for_by_dev.2", "a27.a_copy_that_came_as_a_set_of_files_such_", "a27.who_added_this_copy_who_vouched_for_it_a",
    "a27.the_copy_your_team_holds_is_the_one_this", "a27.opening_it_leaves_the_record_and_nothing",
    "a30.a_pointer_into_this_very_copy_settled_wh", "a30.the_other_verdicts_a_held_link_can_carry", "a30.you_are_about_to_leave_the_record",
    "a30.this_page_carried_this_address_and_the_r", "a30.what_is_at_the_address_now_the_record_do", "a30.stay_in_the_record", "a30.tally.one", "a30.tally.none", "a30.6_links_on_this_page_4_lead_outside_the_", "a30.open_anyway", "links.navleft",
    "a30.not_an_address_the_record_will_carry", "a30.this_is_a_refusal_not_a_gap_in_what_was_",
    "a31.the_grade_on_each_name_says_how_the_matc", "a31.it_says_nothing_about_how_far_to_trust_t", "a31.a_connection_to_another_document_takes_t",
    "a34.your_citations_leg_by_leg", "a34.a_newer_copy_never_moves_a_citation_by_i", "a34.each_reasoning_that_rests_on_this_docume",
    "a34.a_newer_copy_exists_captured_2_october", "a34.page_same", "a34.page_differs", "a34.no_newer", "a34.moved", "a34.kept", "a34.not_checked_yet", "a34.it_does_not_guess",
    "a34.one_line_for_each_question_that_rests_on", "a64.captured_together_with_this_page_and_che",
    "a64.not_established_means_the_record_cannot_"].map((k) => "screen.document." + k),
  /* FR-28 (R84–R118): the keys the new controls draw */
  "capture.fieldneeded", "shell.reason.needed", "progression.steps", "screen.capture.address.freq", "state.item.retired.means",
  ...["daily", "weekly", "monthly", "hourly", "per_meeting"].map((f) => "screen.capture.address.freq." + f),
  "screen.document.cite.option", "screen.document.cite.choose", "screen.document.unwatched.head", "screen.document.unwatched",
  "screen.people.more", "shell.more", "screen.document.text.full", "screen.document.passages.head",
  "screen.document.text.tip", "screen.document.text.unread", "screen.document.text.read", "screen.document.text.partial", "screen.document.ocr.says", "screen.document.ocr.refused.capable", "screen.document.ocr.refused.member",
  "screen.document.ocr.refused.unread", "act.pdfstructure.label.document", "act.transcriptionattest.label.document", "act.provenanceroute.label.document",
  "act.connectionassert.label.document", "act.resolutiondefect.label.document", "act.owed_declareorigin.label.document",
  ...["summary", "row", "status", "note", "note.help", "at", "refused.self", "refused.note"].map((k) => "screen.document.attest." + k),
  ...["summary", "says", "which", "which.help", "why", "why.help", "at", "refused.why", "refused.gone"].map((k) => "screen.document.defect." + k),
  ...["heading", "help", "says", "other", "other.help", "basis", "basis.help", "again", "refused.basis", "refused.other"].map((k) => "screen.document.connect." + k),
  ...["standing", "says", "shown", "notshown", "same", "refused"].map((k) => "screen.document.route." + k),
  ...["head", "field", "eg", "second1", "second2", "tip", "ref.machine1", "ref.machine2", "ref.empty", "ref.notdoc"].map((k) => "screen.document.origin." + k),
  /* fix round 9 (R130–R132, G110b): the supporting files' rows (screens-intake's), the unsupported kinds' sentences (reading-pipeline's), a part's kind (content's), the scan policy (file-safety's) */
  "screen.capture.supporting.kept", "screen.capture.supporting.cap", "screen.capture.supporting.toolarge", "screen.capture.supporting.unavailable",
  ...["rtf", "email", "legacy_word", "legacy_excel", "legacy_powerpoint", "legacy_office", "tiff", "gif", "webp", "heic", "avif", "bmp", "jp2", "ico", "kind"].map((k) => "reading-pipeline.index.unsupported_" + k),
  ...["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"].map((k) => "content.part_kind." + k),
  "file-safety.index.reading_is_not_gated",
  /* fix round 10 (R133, R135): an archive's own page uses the Held list's rows until `screen.document.archive.says` is held; the first-load statement is capture-sources' own row */
  "screen.held.archive", "screen.held.archivefiles", "screen.archive.facts.entries", "capture-sources.render.copy_first_load_not_scrolled",
  /* fix round 10 (R137): the document picker's held stand-ins until `screen.document.pick.*` are held */
  "screen.list.showing", "screen.held.noproject",
  "document.read.title", "document.read.help", "document.read.tab.page", "document.read.page", "document.read.prev", "document.read.next", "document.read.select", "document.read.cite.help",
  /* T51 (R81, R82, CR-19): the compare tab, the original-file card, its size and kind */
  "document.read.tab.compare", "document.read.original.card", "size.small", "size.kb", "size.mb", "size.gb",
  ...["record.release", "record.added", "revisions.truncated", "revision.nobytes", "compare.grade", "compare.fingerprint", "a34.moved.noreason", "a34.kept.noreason", "place.restson", "names.matched.identifier",
    "names.matched.reference", "names.matched.reference_key", "names.matched.label", "names.matched.testimony", "names.matched.none"].map((k) => "screen.document." + k),
  ...["captured", "copy", "fingerprint", "fingerprint.means", "passages.head", "passage.where", "cite.question", "cite.role",
    "cite.noquestion", "unread.head", "unread.page", "unread.words", "unread.empty", "gradenote.head", "gradenote.none",
    "backlinks.head", "backlinks.hidden", "versions.head", "versions.changed", "versions.this", "claim.label",
    "claim.basis", "claim.basis.name", "claim.basis.corroborated", "claim.basis.identifier", "claim.note", "claim.empty",
    "copyacts.head", "release.ack", "release.mitigation", "release.empty", "retire.reason", "open", "monitor.done",
    "monitorset.done", "attest.done", "transcribe.done", "pagetranscribe.done"].map((k) => "screen.document." + k),
]);

/** The document screen (interface-shell R21). */
export function documentScreen(parts) {
  /* R93: the one drawing of what a check found is `screens-intake`'s (its R42), imported and carried as this screen's part; R117: a refusal's
     first finding is drawn by `findingsRefusal` */
  return Object.freeze({ id: "document", reads, place, render, acts: [...acts, ...browserActs, ...readheldActs, ...resolveActs],
    words: Object.freeze([...words, ...parts.kinds.map((k) => "document.kind." + k),]), parts: Object.freeze({ ...parts, checkOutcome, findingsRefusal, resolve: resolveActs.length > 0 }) });
}
