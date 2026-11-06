/* screens-publish: the states of the `published` screen beyond the case page itself (R37–R39; DEC-330 A76, A77, A79; DEC-335,
 * DEC-336 (4), DEC-338): one finding's own page, "Read it at a minimum strength" and the filtered view it makes, and the
 * print layout. Each is a part the screen calls through `view.parts`, self-contained like `PARTS`. A sentence is read by key;
 * the drawing's words that hold a sample fact, or no key yet, are not drawn in English here (R37–R40, Suggestions 7, 8). */

export const PUBLISHED_PAGES = Object.freeze({
  /* R38: "Read it at a minimum strength": a minimum on each axis the case states its strengths on, and the browser act that
     shows only the findings at or above it. */
  minimum: function (cs, view) {
    const grades = [{ value: "", key: "screen.published.min.none" }, { value: "C", key: "screen.published.min.c" }, { value: "B", key: "screen.published.min.b" }, { value: "A", key: "screen.published.min.a" }];
    const fl = view.ui.floor || {};
    return view.parts.secTips(cs, "screen.published.read.it.at.a.minimum",
      '<p class="mk-note">' + cs.w("screen.published.choose.the.weakest.strength.you") + " " + cs.w("screen.published.the.page.then.shows.only") + "</p>"
      + cs.choice("pb-fl-capture", "screen.published.how.well.the.documents.are", grades, { value: fl.capture || "" })
      + cs.choice("pb-fl-connection", "screen.published.how.firmly.they.are.linked", grades, { value: fl.connection || "" })
      + '<div class="mk-acts">' + cs.act("pubfloorset") + "</div>",
      ["screen.published.a.way.to.read.the.explain", "screen.published.it.changes.only.what.you.explain"]);
  },

  /* R38: the notice that the view is the reader's own, which minimums she asked for, how many findings are shown of how many,
     and that the team's signature covers the whole case. No count is drawn when every finding is shown or none is. */
  notice: function (cs, view, shown, total) {
    const fl = view.ui.floor || {}, hidden = total - shown;
    const asked = cs.w("screen.published.you.asked.for.findings.held", { capture: fl.capture || "–", connection: fl.connection || "–" });
    const count = shown > 0 && hidden > 0 ? cs.w(hidden === 1 ? "screen.published.this.is.part.of.the" : "screen.published.this.is.part.of.the.many",
      { n: String(shown), total: String(total), hidden: String(hidden) }) : "";
    return '<div class="cs-gap" data-gap="undetermined" role="status" data-filtered><span><b>' + cs.w("screen.published.a.filtered.view.you.constructed") + "</b> "
      + asked + (count ? " " + count : "") + " " + cs.w("screen.published.the.team.s.signature.covers") + "</span></div>";
  },

  /* R38: the filtered view (the drawing's state e): the notice, the way back and the print, then only the findings at or above
     the minimum, each as the case page draws one; with none, the note in the fold the drawing gives it. */
  filtered: function (cs, view, e, caseId, head) {
    const P = view.parts, list = Array.isArray(e.findings) ? e.findings : [];
    const kept = [];
    list.forEach(function (f, i) { if (P.meets(view, f)) kept.push(P.card(cs, view, f, i + 1, e, caseId, { link: true })); });
    return head + P.notice(cs, view, kept.length, list.length)
      + '<div class="mk-acts">' + cs.act("pubfloorclear", { tone: "primary" }) + cs.act("pubprint") + "</div>"
      + kept.join("")
      + (kept.length ? "" : P.fold(cs, "screen.published.when.no.finding.meets.the", '<p class="mk-note">' + cs.w("screen.published.no.finding.in.this.case") + " "
        + cs.w("screen.published.lower.the.minimum.or.go") + "</p>"));
  },

  /* R39: the print layout (the drawing's state g): the case's head, the whole case or the filtered view saying so, every finding
     open with its sources listed, and the signature line at the foot. Nothing here is a control: the page prints what is drawn. */
  printLayout: function (cs, view, e, caseId, head, group) {
    const P = view.parts, list = Array.isArray(e.findings) ? e.findings : [], filtered = !!P.floorOf(view);
    const shown = list.map(function (f, i) { return { f: f, n: i + 1 }; }).filter(function (x) { return P.meets(view, x.f); });
    const cards = shown.map(function (x) { return P.card(cs, view, x.f, x.n, e, caseId, { open: true }); }).join("");
    // the sources the case publishes, by their fingerprints and grades where the edition states them; else how many it names only
    const named = {};
    list.forEach(function (f) { P.legs(f).forEach(function (l) { if (l.served !== true && l.target) named[l.target] = true; }); });
    // F1: the rows as `publishedcase` answers them (`materials.materials`), else its `captures:` rows
    const rows = P.evidenceOf(e).filter(function (x) { return x.sha; }).map(function (x) {
      return cs.row("", '<span class="rec">' + cs.esc(x.name) + "</span>", '<span class="id">' + cs.esc(x.sha.slice(0, 12)) + "</span>"
        + (x.grade ? " " + P.gradeMark(cs, x.axis, x.grade) : ""));
    }).join("");
    const nameless = Object.keys(named).length;
    const sources = rows ? P.sec(cs, "screen.published.evidence", cs.sheet(rows))
      : nameless ? '<p class="mk-note">' + cs.w("screen.published.sources.nonepublished", { count: String(nameless) }) + "</p>" : "";
    // the foot: who signed for the team and when, the key's fingerprint, the address to check it at, a line to sign by hand
    const who = P.signerOf(e), print = view.ui.printFacts || {};
    const fingerprint = who.fingerprint || print.fingerprint || "";
    const signed = who.member && fingerprint && e.signed_at && group
      ? '<p>' + cs.w("screen.published.signed.for.lakeshore.tenants.by", { team: group, member: who.member, date: { html: cs.date(e.signed_at) }, fingerprint: fingerprint }) + "</p>" : "";
    const foot = '<div class="mk-small" data-print-foot style="border-top:1px solid currentColor;padding-top:8px">' + signed
      + "<p>" + cs.w("screen.published.check.the.signature.at.the") + "</p>"
      + (filtered ? "<p>" + cs.w("screen.published.a.print.made.from.a") + "</p>" + (list.length - shown.length > 0 ? "<p>" + cs.w("screen.published.this.is.part.of.the" + (list.length - shown.length === 1 ? "" : ".many"),
        { n: String(shown.length), total: String(list.length), hidden: String(list.length - shown.length) }) + "</p>" : "")
        : "<p>" + cs.w("screen.published.printed.in.full.no.minimum") + "</p>") + "</div>";
    return head + '<div class="cs-sheet" data-print-layout="' + (filtered ? "filtered" : "full") + '" style="padding:16px 18px;display:grid;gap:12px">'
      + cards + sources + foot + "</div>";
  },

  /* R37: one finding's own page (the drawing's state f), from the finding the answer was asked for. */
  finding: function (cs, view, e, caseId, f) {
    const P = view.parts, body = f.body || {}, n = P.placeOf(e, f.bundle_id);
    const edition = e.edition !== undefined ? e.edition : "";
    const head = cs.title(P.plain(cs.w("screen.published.finding", { n: String(n) })))
      + '<p class="mk-sub">' + cs.esc(e.scope || e.project_reference || caseId) + " · " + cs.w("screen.published.edition", { n: String(edition) })
      + ' · <a href="' + P.hrefOf(caseId, edition) + '" data-nav data-whole-case>' + cs.w("screen.published.back.to.the.whole.case") + "</a></p>";
    const stand = f.standing && typeof f.standing === "object" ? f.standing : {};
    const meets = stand.meets === true ? "yes" : stand.meets === false ? "no" : null, bar = stand.bar && typeof stand.bar === "object" ? stand.bar : {};
    const strengths = P.strengthLine(cs, view, stand, f)
      + (meets ? " " + cs.w(meets === "yes" ? "screen.published.meets" : "screen.published.below", { capture: String(bar.capture || "–"), connection: String(bar.connection || "–") }) : "");
    if (body.state === "unavailable" || body.state === "withheld") {
      // the finding's identity and strengths, never an empty page; the reason as the plane gave it, in its words (DEC-342), and a
      // court order's orders as the answer states them
      const why = cs.w(body.state === "unavailable" ? "screen.published.finding.unreadable" : "screen.published.finding.withheld");
      const orders = body.state === "withheld" && body.orders !== undefined ? body.orders : f.withheld && f.withheld.orders;
      const listed = Array.isArray(orders) ? orders.map(function (o) { return '<p class="rec">' + cs.esc(typeof o === "string" ? o : o && (o.summary || o.entry || o.order) || "") + "</p>"; }).join("") : "";
      return head + '<article class="mk-finding" data-finding="' + cs.esc(f.bundle_id) + '" data-body="' + cs.esc(body.state) + '"><p>' + strengths + "</p>"
        + (why ? '<p class="cs-state" data-state="failed" role="alert">' + why + "</p>" : "") + listed + "</article>";
    }
    let out = head + '<article class="mk-finding" data-finding="' + cs.esc(f.bundle_id) + '"><p class="rec mk-fbody">' + cs.esc(P.claimOf(view, f))
      + "</p><p>" + strengths + "</p></article>";

    // "What would overturn it": the falsifier as signed, and, when the member chose to publish without one, who and when
    const au = body.authored && typeof body.authored === "object" ? body.authored : {};
    const ov = au.falsifier_override && typeof au.falsifier_override === "object" ? au.falsifier_override : null;
    const said = P.falsifierOf(view, f), falsifier = said ? '<p class="rec">' + cs.esc(said) + "</p>" : "";
    const over = ov ? P.fold(cs, "screen.published.falsifier.override.summary", '<div class="cs-gap" data-gap="undetermined"><span>'
      + cs.w("screen.published.falsifier.override", { member: ov.by || "", date: { html: ov.at ? cs.date(ov.at) : "" } }) + "</span></div>"
      + '<p class="mk-note">' + cs.w("screen.published.falsifier.override.explain") + "</p>") : "";
    out += P.sec(cs, "screen.published.what.would.overturn.it", falsifier + over);

    // "What it rests on": one row for each leg of the signed bytes, in order, by what the answer states of it
    const legs = P.legs(f);
    out += P.secTips(cs, "screen.published.what.it.rests.on", cs.sheet(legs.map(function (l, i) {
      const grade = P.gradeMark(cs, l.grade_axis, l.grade);
      const title = P.titleOf(l);
      let what;
      if (l.served === true) {
        const cited = l.cited_edition && typeof l.cited_edition === "object" ? l.cited_edition : {};
        what = '<span class="meta">' + cs.w("screen.published.named.only.its.documents.are") + "</span>"
          + (title ? " " + (cited.case_id ? cs.ref("published", cited.case_id, title, [cited.edition !== undefined ? cs.w("screen.published.edition", { n: String(cited.edition) }) : "", cited.ratified_at ? cs.date(cited.ratified_at) : ""]) : '<span class="rec">' + cs.esc(title) + "</span>") : "");
      } else {
        what = '<span class="cs-card" tabindex="0" data-level="1" data-tip="' + cs.esc("<b>" + cs.w("screen.published.leg.namedonly") + "</b>" + cs.w("screen.published.leg.namedonly.explain"))
          + '">' + cs.w("screen.published.leg.namedonly") + "</span>";
      }
      const doc = P.docLine(cs, l); // C47: the document the leg rests on, by name and place
      return cs.row("", "<b>" + cs.w("screen.published.leg", { n: String(i + 1) }) + "</b> · " + cs.w(P.cuts(l) ? "screen.published.leg.cuts" : "screen.published.leg.supports") + " " + what + (doc ? " " + doc : ""), grade);
    }).join("")), ["screen.published.each.leg.is.one.thing.explain", "screen.published.a.leg.the.team.holds.explain", "screen.published.leg.grade.explain"]);

    // "What rests on what": the chain from the documents up to the finding, a line for each leg
    const graph = (Array.isArray(f.names) ? f.names : []).length || (Array.isArray(f.serves) ? f.serves : []).length || legs.length;
    const unresolved = Array.isArray(f.unresolved) ? f.unresolved : [];
    out += graph || unresolved.length ? P.secTips(cs, "screen.published.what.rests.on.what", '<p class="mk-note">' + cs.w("screen.published.read.each.line.from.the") + "</p>" + cs.sheet(legs.map(function (l, i) {
      const fills = { leg: String(i + 1), n: String(n) };
      const key = P.cuts(l) ? "screen.published.holds.leg.3.which.cuts" : l.served === true ? "screen.published.is.leg.4.which.supports" : "screen.published.holds.leg.2.which.supports";
      const title = P.titleOf(l);
      return cs.row("", "<b>" + (l.served === true ? (title ? cs.esc(title) : "") : cs.w("screen.published.leg.namedonly")) + '</b><span class="meta">' + cs.w(key, fills) + "</span>", "");
    }).join("") + unresolved.map(function () { return cs.row("", cs.mark("gap", "undetermined"), ""); }).join("")), ["screen.published.the.chain.from.the.documents.explain"]) : "";

    // "Whether the question was divided": only when the finding answers one part of a question the team divided
    const dv = f.division && typeof f.division === "object" && f.division.parent ? f.division : null;
    if (dv) {
      const q = dv.parent && typeof dv.parent === "object" ? dv.parent.question || dv.parent.title || dv.parent.text || "" : "";
      const sibs = Array.isArray(dv.siblings) ? dv.siblings : [];
      const named = sibs.map(function (x) { return typeof x === "string" ? x : x && typeof x === "object" ? x.question || x.title || x.text || "" : ""; });
      out += P.secTips(cs, "screen.published.whether.the.question.was.divided", "<p>" + cs.w("screen.published.finding.1.answers.one.part", { n: String(n) })
        + (q ? " " + cs.w("screen.published.the.question.it.came.from", { question: q }) : "") + (sibs.length ? " " + cs.w("screen.published.the.other.part.is.named") : "") + "</p>"
        + (named.some(Boolean) ? cs.sheet(named.filter(Boolean).map(function (t) { return cs.row("", '<span class="rec">' + cs.esc(t) + "</span>", ""); }).join("")) : ""),
      ["screen.published.a.reader.who.sees.one.explain"]);
    }
    return out;
  },
});
