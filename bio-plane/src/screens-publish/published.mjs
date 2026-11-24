/* A published case (registry screen `published`; R6; DEC-112, DEC-147 (5)), drawn in the public frame with no session
 * (interface-shell R30) at `/app/published/<case>`: the edition's findings, each with its two strengths and whether it
 * meets the project's bar, its timeline, the people it names, its evidence, when it was signed and when published; whose
 * work it is and how to read it; "Check the signature"; "Check a file you hold" (R22). Nothing here needs an account. Every function is
 * self-contained (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";
import { PUBLISHED_PARTS } from "./published-parts.mjs";
import { PUBLISHED_PAGES } from "./published-pages.mjs";

export const PUBLISHED = Object.freeze({
  id: "published",
  parts: Object.freeze({ ...PARTS, ...PUBLISHED_PARTS, ...PUBLISHED_PAGES }),

  reads: function (view) {
    if (!view.parts.subject(view, 1)) return {}; // K3171: no subject in the address, no subject read
    const s = String(view.subject || "").split("/");
    // R37: one finding's page is `publishedcase` asked by the finding's id, which `render` reads once, asynchronously (R36), so that a
    // finding several cases pin can be answered by the cases it names (the shell gives a read's refusal no kit to draw them with).
    const query = { id: s[0], caseId: s[0] };
    if (s[1]) query.edition = s[1];
    return s[2] ? { group: { op: "groupidentity" } } : {
      group: { op: "groupidentity" },
      edition: { op: "publishedcase", query: query, subject: true },
    };
  },

  render: function (cs, view) {
    if (!view.parts.subject(view, 1)) return view.parts.nothing(cs, "public"); // R21: the way an outsider can go, never "Go to Home"
    const P = view.parts, ui = view.ui;
    const g = view.data.group && view.data.group.state === "ok" ? view.data.group.value : null;
    const group = g ? g.display_name || g.group || "" : "";
    const sub = String(view.subject || "").split("/");
    // R37: one finding's own page, from the read asked by its id (public-read R39), at the case and edition the address names
    const L = sub[2] ? P.later(cs, view, "finding", "publishedcase", { query: Object.assign({ id: sub[2], caseId: sub[0] }, sub[1] ? { edition: sub[1] } : {}) }) : null;
    const e = L ? (L.state === "ok" ? L.value : null) : P.answer(view);
    const out = [cs.title(e ? e.scope || e.project_reference || e.caseId || null : null, { thing: "case" })];
    if (L && L.state === "failed" && L.refusal) {
      const code = L.refusal.code, f = L.fields || {};
      // a finding nothing published answers is "Nothing is here"; one several cases pin is answered by the cases it names
      if (code === "NOT_PUBLISHED" || /^NO_SUCH_/.test(code)) return P.nothing(cs, "public");
      if (code === "FINDING_IN_SEVERAL_CASES") {
        const m = Array.isArray(f.memberships) ? f.memberships : [];
        return out.join("") + '<p class="cs-state" data-state="failed" role="alert">' + L.refusal.words + " " + m.map(function (x) {
          return '<a href="' + P.hrefOf(x.case_id, x.edition, f.target || sub[2]) + '" data-nav>' + cs.esc(x.case_id) + "</a>";
        }).join(" · ") + "</p>";
      }
    }
    if (!e) { out.push(L ? cs.state(L, function () { return ""; }) : cs.state("edition", function () { return ""; })); return out.join(""); }
    const caseId = String(e.caseId || sub[0]);

    // R37: one finding's own page; a finding the edition does not hold is "Nothing is here"
    if (sub[2]) {
      const f = (Array.isArray(e.findings) ? e.findings : []).find(function (x) { return String(x.bundle_id || x.id || "") === sub[2]; });
      return f ? P.finding(cs, view, e, caseId, f) : P.nothing(cs, "public");
    }

    // When it was signed and published, and its other editions.
    const editions = Array.isArray(e.editions) ? e.editions : [];
    const dated = '<p class="mk-sub">' + cs.w("screen.published.dated", { edition: String(e.edition || ""),
      signed: { html: e.signed_at ? cs.date(e.signed_at) : "" }, published: { html: e.published_at ? cs.date(e.published_at) : "" } });
    const head = cs.title(e.scope || e.project_reference || e.caseId || null, { thing: "case" }) + dated + "</p>";
    // R39: the print layout, drawn for the printout and put back by `printed`; R38: the reader's own filtered view
    if (ui.print) return P.printLayout(cs, view, e, caseId, head, group);
    if (P.floorOf(view)) return P.filtered(cs, view, e, caseId, head);
    // 10B C5 (R94 k): the case's id and its manifest's hash, as the answer states them, beside the title
    const mani = /^[0-9a-f]{64}$/.test(String(e.manifest_sha || "")) ? String(e.manifest_sha) : "";
    out.push('<p class="mk-small" data-case-head><span class="id" data-case-id>' + cs.esc(caseId) + "</span>"
      + (mani ? ' · <span class="id" data-manifest style="overflow-wrap:anywhere">' + cs.esc(mani) + "</span>" : "") + "</p>");
    // R96 (a): beside the pointer to the next edition, its What-changed as that edition states it; a successor an order withholds is pointed to,
    // with the plane's detail and no statement
    const next = e.successor && typeof e.successor === "object" ? e.successor : null;
    out.push(dated
      + editions.filter(function (x) { return String(x.edition !== undefined ? x.edition : x) !== String(e.edition); }).map(function (x) {
        const n = String(x.edition !== undefined ? x.edition : x);
        const said = next && String(next.edition) === n ? (typeof next.statement === "string" && next.statement.trim() ? next.statement.trim() : next.withheld && typeof next.detail === "string" ? next.detail : "") : "";
        return ' · <a href="/app/published/' + encodeURIComponent(caseId + "/" + n) + '" data-nav>' + cs.w("screen.published.edition", { n: n }) + "</a>"
          + (said ? ' <span class="rec" data-successor="' + cs.esc(n) + '">' + cs.esc(said) + "</span>" : "");
      }).join("") + "</p>");
    if (e.withdrawn) out.push('<p role="status">' + cs.w("screen.published.withdrawn") + "</p>");

    // Whose work it is, and how to read a case.
    out.push('<p class="mk-explain">' + cs.w("screen.published.whose", { group: group }) + " " + cs.w("screen.published.howtoread") + "</p>");

    // The findings: each with its two strengths and whether it meets the project's bar.
    const findings = Array.isArray(e.findings) ? e.findings : [];
    // R37: each finding is the way to its own page; R38 and R39 come after the case's acts
    // 10B C5 (R94 a): a case that declared no bar says so, in the plane's own sentence (`bar_detail`); null here is no standard, not a bar of zero.
    // R81 (D-M6 (c)): a case that declared one says by key what it was held to, in place of the served sentence
    const bare = !e.bar || typeof e.bar !== "object" || e.bar.declared === false || (!e.bar.capture && !e.bar.connection);
    out.push(P.sec(cs, "screen.published.findings", findings.map(function (f, i) { return P.card(cs, view, f, i + 1, e, caseId, { link: true }); }).join("")
      + (findings.length && bare && typeof e.bar_detail === "string" && e.bar_detail.trim() ? '<p class="mk-note" data-bar-none>' + cs.esc(e.bar_detail) + "</p>" : "")
      + (findings.length && !bare ? '<p class="mk-note" data-bar-declared>' + cs.w("screen.published.bar.declared") + "</p>" : "")));

    // Its timeline, the people it names and its evidence, as the edition carries them.
    const timeline = e.method && Array.isArray(e.method.timeline) ? e.method.timeline : Array.isArray(e.timeline) ? e.timeline : [];
    if (timeline.length) out.push(cs.sec("screen.published.timeline", cs.sheet(timeline.map(function (t) {
      return cs.row("", '<span class="rec">' + cs.esc(t.what || t.summary || t.title || "") + "</span>", t.at || t.date ? cs.date(t.at || t.date) : "");
    }).join(""))));
    // R33, R34, R36 (DEC-310 (6), DEC-313): "Corrections and orders", read from the edition's own answer: none, one or several
    // since it was published, each with the newest; a docket that could not be read is never "none" and never a count.
    const co = e.corrections && typeof e.corrections === "object" ? e.corrections : {};
    const kind = co.last && ["edition", "withdrawal", "court-order"].includes(co.last.kind) ? co.last.kind : "";
    const many = typeof co.count === "number" && co.count > 0 && !co.undetermined && !!kind;
    const docket = '<a class="cs-ref" href="/app/docket-public/' + encodeURIComponent(caseId) + '" data-nav data-level="1" data-tip="' + cs.esc("<b>" + cs.w("shell.card.docket") + "</b>") + '" data-docket-public>';
    const sentence = cs.w("screen.published.corrections");
    const linked = sentence.includes("its docket") ? sentence.replace("its docket", docket + "its docket</a>") : docket + sentence + "</a>"; // the words "its docket" are the door
    out.push(cs.sec("screen.published.corrections.heading", (typeof co.count === "number" && co.count === 0 && !co.undetermined ? "<p>" + cs.w("screen.published.corrections.none") + "</p>"
      : many ? "<p>" + cs.w(co.count === 1 ? "screen.published.corrections.some.one" : "screen.published.corrections.some", { count: String(co.count),
        kind: cs.w("screen.published.corrections.kind." + kind), date: { html: co.last.date ? cs.date(co.last.date) : "" } }) + "</p>" : "")
      + "<p>" + linked + "</p>"));
    const people = Array.isArray(e.people) ? e.people : e.lens && Array.isArray(e.lens.people) ? e.lens.people : [];
    out.push(P.sec(cs, "screen.published.people", people.length ? cs.sheet(people.map(function (p) {
      return cs.row("", '<span class="rec">' + cs.esc(p.shown || p.name || p.title || "") + "</span>", p.reason ? '<span class="meta">' + cs.esc(p.reason) + "</span>" : "");
    }).join("")) : ""));
    // R47 (C7; DEC-376): what the case leaves out and who else read that statement, the contradictions the team disclosed, and how the
    // team reads evidence: each drawn from the edition's own answer, and only when the answer holds it (R20).
    const left = e.completeness && typeof e.completeness === "object" ? e.completeness : null;
    if (left && (left.statement || left.statement_by || Array.isArray(left.acknowledgements))) {
      const acks = Array.isArray(left.acknowledgements) ? left.acknowledgements : null;
      out.push(cs.sec("screen.published.what_this_case_leaves_out", (left.statement ? '<p class="rec">' + cs.esc(left.statement) + "</p>" : "")
        + (left.statement_by || left.author ? '<p class="mk-small">' + cs.w("screen.published.written_by_writer_and_published", { writer: left.statement_by || "", publisher: left.author || "",
          date: { html: left.at ? cs.date(left.at) : "" } }) + "</p>" : "")
        + "<h3 class=\"mk-small\"><b>" + cs.w("screen.published.who_else_read_this_statement") + "</b></h3>"
        + (acks && acks.length ? cs.sheet(acks.map(function (a) {
          return cs.row("", '<span class="mk-data">' + cs.esc(a.recipient || a.by || "") + "</span>", "", (a.at ? cs.date(a.at) : "") + (a.reason ? ' · <span class="rec">' + cs.esc(a.reason) + "</span>" : ""));
        }).join("")) : acks ? '<p class="mk-note" data-nobody>' + cs.w("screen.published.no_one_else_on_the") + "</p>"
          : '<p class="mk-note" data-unsaid>' + cs.w("screen.published.this_edition_does_not_say") + "</p>")));
    }
    if (Object.hasOwn(e, "tensions")) {
      const ts = Array.isArray(e.tensions) ? e.tensions : null;
      const idx = function (id) { return findings.findIndex(function (f) { return String(f.bundle_id || f.id || "") === String(id); }); };
      out.push(cs.sec("screen.published.contradictions_the_team_disclosed", ts && ts.length ? '<p>' + cs.w("screen.published.each_one_names_the_finding") + "</p>" + cs.sheet(ts.map(function (t) {
        const n = idx(t.finding), side = function (x) { return x && x.text ? '<span class="mk-data">' + cs.esc(x.text) + "</span>" : ""; };
        return cs.row("", "<b>" + (n >= 0 ? cs.w("screen.published.finding", { n: String(n + 1) }) : cs.esc(t.finding || "")) + "</b> · " + cs.esc(t.state || "")
          + '<span class="meta" data-tension' + (t.highlighted ? ' data-highlighted' : "") + ">"
          + (t.highlighted ? cs.esc(t.sentence || "") + " " + (t.side ? cs.w("screen.published.one_side_side", { side: { html: side(t.side) } }) : "")
            : cs.w("screen.published.one_side_side", { side: { html: side(t.sides && t.sides.a) } }) + " " + cs.w("screen.published.the_other_side_side", { side: { html: side(t.sides && t.sides.b) } })
              + (t.explanation ? ' <span class="rec mk-data">' + cs.esc(t.explanation) + "</span>" : ""))
          + (t.owner_words && t.owner_words.text ? ' <span class="rec">' + cs.esc(t.owner_words.text) + "</span>" : "")
          + (t.acknowledged_by ? " " + cs.w("screen.published.read_by_who_on_date", { who: t.acknowledged_by, date: { html: t.acknowledged_at ? cs.date(t.acknowledged_at) : "" } }) : "") + "</span>", "");
      }).join("")) : ts ? '<p class="mk-note" data-none>' + cs.w("screen.published.the_team_disclosed_no_contradictions") + "</p>"
        : '<p class="mk-note" data-before>' + cs.w("screen.published.this_edition_was_signed_before") + "</p>"));
    }
    // 10B C5 (R94 c): the lens as the signed document prints it (the acknowledgement, each statement with its justification, the closing sentences);
    // an edition that carries only the lens's fingerprint says so
    const lens = e.lens && typeof e.lens === "object" ? e.lens : null;
    const bias = typeof e.bias_acknowledgement === "string" && e.bias_acknowledgement.trim() ? e.bias_acknowledgement : lens && typeof lens.bias_acknowledgement === "string" && lens.bias_acknowledgement.trim() ? lens.bias_acknowledgement : "";
    const stated = lens && Array.isArray(lens.statements) ? lens.statements.filter(function (x) { return x && typeof x.text === "string" && x.text.trim(); }) : [];
    const closing = lens && Array.isArray(lens.closing) ? lens.closing.filter(function (x) { return typeof x === "string" && x.trim(); }) : [];
    const print = !lens && /^[0-9a-f]{64}$/.test(String(e.lens_fingerprint || "")) ? cs.w("screen.published.this_edition_carries_only_the", { fingerprint: String(e.lens_fingerprint) }) : "";
    if (bias || stated.length || closing.length || print) {
      out.push(cs.sec("screen.published.the_lens_this_team_read", '<div data-lens>' + (bias ? '<p class="rec" data-bias>' + cs.esc(bias) + "</p>" : "")
        + (stated.length ? cs.sheet(stated.map(function (x) {
          return cs.row("", '<span class="rec">' + cs.esc(x.text) + "</span>", typeof x.justification === "string" && x.justification.trim() ? '<span class="meta">' + cs.esc(x.justification) + "</span>" : "");
        }).join("")) : "")
        + closing.map(function (c) { return '<p class="mk-small" data-lens-closing>' + cs.esc(c) + "</p>"; }).join("") + (print ? "<p>" + print + "</p>" : "") + "</div>",
      { help: "screen.published.the_lens_this_team_read2" }));
    }

    // R57 (C12; DEC-378): the case's details as its team currently states them, for any reader; a field not stated draws nothing. They are
    // not part of the signed edition. Read from the public `casedetailspublic`.
    const dp = P.later(cs, view, "cdpub", "casedetailspublic", { query: { case: caseId } });
    const dd = dp.state === "ok" && dp.value && dp.value.details && typeof dp.value.details === "object" ? dp.value.details : null;
    if (dd) {
      const rows = [];
      const said = function (f) { return dd[f] && dd[f].stated ? dd[f].value : null; };
      const area = said("area"), contact = said("contact"), related = said("related"), rels = said("relationships");
      if (Array.isArray(area)) rows.push(["screen.case-editor.details.name.area", area.map(function (a) { return cs.esc(a.words); }).join(", ")]);
      if (contact) rows.push(["screen.case-editor.details.name.contact", contact.kind === "doorbell" ? cs.w("screen.case-editor.details.contact.doorbell") : cs.esc(contact.text || "")]);
      if (Array.isArray(related)) rows.push(["screen.case-editor.details.name.related", related.map(function (r) { return cs.esc(r.url || (r.case_ref ? r.case_ref.case : "")) + (r.words ? " · " + cs.esc(r.words) : ""); }).join("; ")]);
      if (rels) rows.push(["screen.case-editor.details.name.relationships", rels.none ? cs.w("screen.case-editor.details.ties.none") : (rels.items || []).map(function (t) { return cs.esc(t.with) + " · " + cs.esc(t.nature); }).join("; ")]);
      if (rows.length) out.push(cs.sec("act.owed_casedetailspublic.label.published", cs.sheet(rows.map(function (r) {
        return cs.row("", "<b>" + cs.w(r[0]) + '</b><span class="meta mk-data" data-detail="' + cs.esc(r[0]) + '">' + r[1] + "</span>", "");
      }).join("")) + '<p class="mk-note">' + cs.w("screen.published.details.pub.current1") + " " + cs.w("screen.published.details.pub.current2") + "</p>"
        + '<div class="mk-acts">' + cs.act("casedetailspublic") + "</div>"));
    }

    const evidence = Array.isArray(e.captures) ? e.captures : Array.isArray(e.materials) ? e.materials : [];
    // R19: each piece of evidence with a full SHA-256 opens its bytes by that hash (`publishedbytes`, no credential); a row
    // with no full hash draws no hash and no link.
    out.push(P.sec(cs, "screen.published.evidence", evidence.length ? cs.sheet(evidence.map(function (x) {
      const sha = String(x.sha256 || x.capture_sha || "").toLowerCase();
      const full = /^[0-9a-f]{64}$/.test(sha);
      const graded = P.gradeMark(cs, x.axis || "capture", x.grade);
      return cs.row("", '<span class="rec">' + cs.esc(x.title || x.label || x.locator || (full ? sha : "")) + "</span>" + (graded ? ' <span data-evidence-grade>' + graded + "</span>" : ""),
        full ? '<span class="id">' + cs.esc(sha.slice(0, 12)) + "</span>" : "",
        full ? cs.act("publishedcase", { label: "screen.published.evidence.open", data: { sha: sha } }) : "");
    }).join("")) : ""));

    out.push('<div class="mk-acts">' + cs.act("verify", { data: { sha: String(e.manifest_sha || "") } }) + cs.act("publishedcase")
      + (/^[0-9a-f]{64}$/.test(String(e.manifest_sha || "")) ? cs.act("publishedcase", { label: "screen.published.download", data: { download: "1", manifest: String(e.manifest_sha) } }) : "")
      + (findings.length ? cs.act("pubprint") : "") + "</div>" + P.said(view, "verify") + P.said(view, "download")
      + (P.casefileSaid(cs, e) ? '<p class="mk-note" role="status" data-casefile-state>' + P.casefileSaid(cs, e) + "</p>" : "")
      // 10B C5 (R95 a), R81 (D-M6 (a)): what the check proves and what it does not, by key, where the answer states a verification
      + (e.verification && typeof e.verification === "object" ? '<p class="mk-small" data-verification>' + cs.w("screen.published.verify.detail") + "</p>" : ""));
    // R38: a minimum strength to read it at, when there is a finding to hold to one
    if (findings.length) out.push(P.minimum(cs, view));

    // R22 (N1094; DEC-240 (P1)): "Check a file you hold": the member of the public pastes the file's SHA-256 (the file itself
    // never reaches the page); `verify` answers whether this case rests on it, as a public op with no credential.
    // R54 (C10; DEC-376): or a file chosen here, whose SHA-256 the page works out itself; the file never leaves the page.
    out.push(cs.sec("published.check.title", cs.field("pb-file", "screen.published.choose_a_file_or_paste", { type: "file", help: "screen.published.the_file_itself_never_leaves" })
      + cs.field("pb-sha", "published.check.field", { rec: true, help: "published.check.field.help" })
      + '<div class="mk-acts">' + cs.act("verify", { label: "published.check.go", data: { check: "1" } }) + "</div>" + P.said(view, "check"), { help: "published.check.help" }));
    return out.join("");
  },

  // R99 (interface-shell): after printing ends, or is cancelled, the page is drawn as it was
  printed: function (cs, view) { view.ui.print = false; cs.set("print", false); },

  acts: [
    {
      // R38 (A77): the browser act "Show only findings this strong": the minimum on each axis the reader chose, kept in page memory
      // only (R11): nothing is sent, stored or put in an address; with no minimum chosen the whole case is drawn.
      op: "pubfloorset", label: "act.owed_pubfloorset.label.published", rereads: [],
      send: function (view, el, cs) {
        const grade = function (id) { const v = String(cs.value(id) || "").toUpperCase(); return /^[A-C]$/.test(v) ? v : ""; };
        const floor = { capture: grade("pb-fl-capture"), connection: grade("pb-fl-connection") };
        cs.set("floor", floor.capture || floor.connection ? floor : null);
        return null;
      },
    },
    {
      // R38 (A77): the browser act "Back to the whole case": the reader's minimum is taken away.
      op: "pubfloorclear", label: "act.owed_pubfloorclear.label.published", rereads: [],
      send: function (view, el, cs) { cs.set("floor", null); return null; },
    },
    {
      // R39 (A79): the browser act "Print the case": the page is drawn in its print layout (every finding open with its sources,
      // the signature line at the foot, the filtered view saying so), then printed; `printed` puts the page back. The key's
      // fingerprint is read from the key `publishedcase` states for the signer. Nothing is sent or stored.
      op: "pubprint", label: "act.owed_pubprint.label.published", rereads: [],
      send: async function (view, el, cs) {
        const P = view.parts, e = P.answer(view), who = e ? P.signerOf(e) : { fingerprint: "", key: "" };
        view.ui.printFacts = { fingerprint: who.fingerprint || (await P.fingerprintOf(who.key)) };
        cs.set("print", true);
        cs.print();
        return null;
      },
    },
    {
      // R6: "Check the signature": the edition's manifest checked against what the group published, without the group.
      op: "verify", label: "act.verify.label.published", rereads: [],
      // R22: the same act also takes the 64-character fingerprint a reader typed ("Check it"); nothing but that hash is sent.
      send: async function (view, el, cs) {
        view.ui.checking = "";
        if (el.dataset.check === "1") {
          let typed = String(cs.value("pb-sha") || "").trim().toLowerCase();
          // R54: a chosen file is fingerprinted in this page; only the hash goes out
          const file = cs.file("pb-file");
          if (file) {
            try { typed = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
            catch (x) { return { refuse: "screen.published.choose_it_again_or_paste" }; }
          }
          if (!/^[0-9a-f]{64}$/.test(typed)) return { refuse: file ? "screen.published.choose_it_again_or_paste" : "screen.published.choose_a_file_or_paste" };
          view.ui.checking = typed;
          return { query: { sha256: typed } };
        }
        if (/^[0-9a-f]{64}$/.test(el.dataset.sha || "")) return { query: { sha256: el.dataset.sha } };
        // G54: an edition with no case file says why, in place of "nothing to check"; nothing is sent
        const why = view.parts.casefileSaid(cs, view.parts.answer(view));
        if (why) { view.parts.say(cs, view, "verify", why, false); return null; }
        return { refuse: "screen.published.verify.none" };
      },
      done: async function (view, answer, cs) {
        const P = view.parts, typed = view.ui.checking || "";
        view.ui.checking = "";
        const key = typed ? "check" : "verify";
        if (P.refused(cs, view, key, answer)) return { stay: true }; // D29
        const r = P.value(answer) || {};
        const published = r.published === true && Array.isArray(r.matches) && r.matches.length > 0;
        if (!typed) { P.say(cs, view, "verify", cs.w(published ? "screen.published.verify.ok" : "screen.published.verify.no"), !!r.published); return { stay: true }; }
        // R22: held by this edition when the hash is published and `publishedcase`, read by that hash, names a finding of the
        // edition on this page. A finding's pinned hash is answered by `publishedcase` itself; a file the findings rest on is
        // not, so the edition's own parts (`files`, each with its finding) name the finding for it.
        const e = view.data.edition && view.data.edition.state === "ok" ? view.data.edition.value : null;
        const findings = e && Array.isArray(e.findings) ? e.findings : [];
        const at = function (id) {
          for (let i = 0; i < findings.length; i++) if (String(findings[i].bundle_id || findings[i].id || "") === String(id)) return i;
          return -1;
        };
        let i = -1;
        if (published && e) {
          // R36: the read by that hash is waited for; one that failed or was not answered is drawn failed, never as "no" or
          // "elsewhere". `NOT_PUBLISHED` is its answer for a file the findings rest on, which the edition's parts then name.
          let c = null;
          try { c = P.value(await cs.call("publishedcase", { query: { sha256: typed } })); } catch (x) { c = null; }
          if (!c || (c.ok === false && String(c.code || c.reason || "") !== "NOT_PUBLISHED")) {
            P.say(cs, view, "check", cs.w("shell.unread"), false);
            return { stay: true };
          }
          if (c && c.ok !== false && String(c.caseId) === String(e.caseId) && String(c.edition) === String(e.edition)) {
            const pinned = (Array.isArray(c.findings) ? c.findings : []).find(function (f) { return String(f.version_sha || "").toLowerCase() === typed; });
            i = at(pinned ? pinned.bundle_id : c.asked);
          }
          if (i < 0 && Array.isArray(e.files)) {
            const part = e.files.find(function (x) { return x && String(x.sha256 || "").toLowerCase() === typed && x.finding; });
            if (part) i = at(part.finding);
          }
        }
        const body = i >= 0 ? findings[i].body || {} : {};
        // A hash the group published that no finding of this edition rests on is "elsewhere"; one it never published is "no".
        P.say(cs, view, "check", i >= 0 ? cs.w("published.check.yes", { n: String(i + 1), finding: P.claimOf(view, findings[i]) || body.question || findings[i].title || "" })
          : cs.w(published ? "published.check.elsewhere" : "published.check.no"), i >= 0);
        return { stay: true };
      },
    },
    {
      // R57: "Details of this work": the team's current statement of them, read again for any reader (public, no credential).
      op: "casedetailspublic", label: "act.owed_casedetailspublic.label.published", rereads: [],
      send: function (view) { return { query: { case: String(view.subject || "").split("/")[0] } }; },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "casedetailspublic", answer)) view.parts.forget(view); return { stay: true }; }, // D29
    },
    {
      // R6: "Read the case": the edition read again, whole. R19: the same op also opens a piece of evidence's bytes by its
      // hash and downloads the complete edition's file (the case file, by the manifest's hash), both through `publishedbytes`,
      // public, with no credential.
      op: "publishedcase", label: "act.publishedcase.label.published", rereads: "all",
      send: async function (view, el, cs) {
        const P = view.parts;
        const s = String(view.subject || "").split("/");
        const query = Object.assign({ id: s[0], caseId: s[0] }, s[1] ? { edition: s[1] } : {});
        const sha = el && el.dataset ? el.dataset.sha : "";
        const download = el && el.dataset && el.dataset.download === "1";
        if (!sha && !download) return { query: query };
        const got = sha ? await cs.download("publishedbytes", { query: { sha256: sha }, name: sha.slice(0, 12) })
          : await cs.download("publishedbytes", { query: { sha256: el.dataset.manifest, format: "zip" }, name: s[0] + (s[1] ? "-edition-" + s[1] : "") + ".zip" });
        const a = got && got.answer && typeof got.answer === "object" ? (got.answer.result && typeof got.answer.result === "object" ? got.answer.result : got.answer) : {};
        const why = a.translation || a.reason || a.code || "";
        P.say(cs, view, "download", got && got.ok ? cs.w("screen.published.download.done") : why ? cs.esc(why) : cs.w("screen.published.download.failed"), !!(got && got.ok));
        return null;
      },
    },
  ],
});
