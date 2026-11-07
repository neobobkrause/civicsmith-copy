/* screens-publish: the helpers the `published` screen adds to the module's shared parts (R37–R39; DEC-330 A76, A77, A79).
 * Like `PARTS`, each is self-contained: it refers only to its parameters and the language's own globals, and calls the others
 * through `view.parts`. Pure: nothing here reads or sends a request; the page draws what `publishedcase` answered. */

export const PUBLISHED_PARTS = Object.freeze({
  /* The address of a case, an edition of it, or one finding of an edition, as the `published` screen takes it. */
  hrefOf: function (caseId, edition, finding) {
    const sub = [caseId].concat(edition !== undefined && edition !== null && edition !== "" ? [String(edition)] : [], finding ? [String(finding)] : []).join("/");
    return "/app/published/" + encodeURIComponent(sub);
  },

  /* F1 (R19, R76): the edition's evidence rows, read from the shape `publishedcase` answers (`public-read` R3, R53): its
     `materials` is `{materials: [...], attestations}`, each row with its `entry` `{name, locator, fingerprint}`. A row the case
     carries whole opens by its own SHA-256; a row carried as its copy opens by the copy's (the original is never served); a row
     carried in the signed document only (an extract, `included: false`) opens nothing. An answer stating no materials falls back
     to its `captures:` rows, as before. Each row: `{name, sha, open, grade, axis}`, `sha` the full lowercase fingerprint or "",
     `open` the hash its bytes open by or "". */
  evidenceOf: function (e) {
    const full = function (s) { s = String(s || "").toLowerCase(); return /^[0-9a-f]{64}$/.test(s) ? s : ""; };
    const block = e && e.materials && typeof e.materials === "object" && !Array.isArray(e.materials) ? e.materials.materials : null;
    if (Array.isArray(block) && block.length) {
      return block.filter(function (x) { return x && typeof x === "object"; }).map(function (x) {
        const en = x.entry && typeof x.entry === "object" ? x.entry : {};
        const sha = full(en.fingerprint || x.sha);
        const copy = x.obscured && typeof x.obscured === "object" ? full(x.obscured.copy) : "";
        return { name: String(en.name || x.title || x.origin || x.ref || ""), locator: String(en.locator || x.origin || ""), sha: sha,
                 open: copy || (x.included === true ? sha : ""), grade: null, axis: "capture" };
      });
    }
    const rows = e && Array.isArray(e.captures) ? e.captures : e && Array.isArray(e.materials) ? e.materials : [];
    return rows.filter(function (x) { return x && typeof x === "object"; }).map(function (x) {
      const sha = full(x.sha256 || x.capture_sha);
      return { name: String(x.title || x.label || x.locator || ""), locator: String(x.locator || x.origin || ""), sha: sha, open: sha, grade: x.grade || null, axis: x.axis || x.grade_axis || "capture" };
    });
  },

  /* R100 (public-read R41): one evidence row of the case-level list: the document's name, its locator (a web address is the
     link to where it can be read), its fingerprint (short), and the way to open its bytes where the case publishes them. */
  evidenceRow: function (cs, view, x) {
    const P = view.parts;
    const web = /^https?:\/\/\S+$/i.test(x.locator || "") ? x.locator : "";
    const link = function (t) { return '<a href="' + cs.esc(web) + '" rel="noopener noreferrer" data-evidence-link>' + cs.esc(t) + "</a>"; };
    const name = x.name || x.locator || x.sha;
    const graded = P.gradeMark(cs, x.axis, x.grade);
    const where = web && web !== name ? ' <span class="meta" data-evidence-locator>' + link(web) + "</span>"
      : !web && x.locator && x.locator !== name ? ' <span class="meta" data-evidence-locator>' + cs.esc(x.locator) + "</span>" : "";
    return cs.row("", '<span class="rec" data-evidence-row>' + (web && web === name ? link(name) : cs.esc(name)) + "</span>" + where
      + (graded ? ' <span data-evidence-grade>' + graded + "</span>" : ""),
    x.sha ? '<span class="id">' + cs.esc(x.sha.slice(0, 12)) + "</span>" : "",
    x.open ? cs.act("publishedcase", { label: "screen.published.evidence.open", data: { sha: x.open } }) : "");
  },

  /* R100: the signature and the signer's public key the case document carries (`document.sig_armored`, its `attestor.key_b64`),
     each "" when the answer does not state it. The key is drawn as an OpenSSH line, its type read from its own bytes. */
  signatureOf: function (e) {
    const d = e && e.document && typeof e.document === "object" ? e.document : {};
    const sig = typeof d.sig_armored === "string" && d.sig_armored.trim() ? d.sig_armored.trim() : "";
    const a = d.attestor && typeof d.attestor === "object" ? d.attestor : {};
    const key = typeof a.key_b64 === "string" && /^[A-Za-z0-9+/=]+$/.test(a.key_b64) ? a.key_b64 : "";
    let type = "";
    try {
      const raw = key ? atob(key.slice(0, 64).replace(/=+$/, "").slice(0, 48)) : "";
      const n = raw.length >= 4 ? ((raw.charCodeAt(0) << 24) | (raw.charCodeAt(1) << 16) | (raw.charCodeAt(2) << 8) | raw.charCodeAt(3)) : 0;
      const t = n > 0 && n < 40 ? raw.slice(4, 4 + n) : "";
      type = /^[a-z0-9@.-]+$/.test(t) ? t : "";
    } catch (x) { type = ""; }
    return { signature: sig, key: key ? (type ? type + " " : "") + key : "" };
  },

  /* R84 (public-read R46): the edition's own statement of the passages it was published without grading, read from its signed
     document: the line with how many, and the fold "Which passages" listing each by its document and its finding. An edition of an
     earlier format states none (`ungraded_passages` null), and one with none ungraded lists none: neither draws anything. */
  ungradedHead: function (cs, view, e) {
    const P = view.parts, u = e && e.ungraded_passages && typeof e.ungraded_passages === "object" ? e.ungraded_passages : null;
    const rows = u && u.stated === true && Array.isArray(u.rows) ? u.rows.filter(function (r) { return r && typeof r === "object"; }) : [];
    if (!rows.length) return "";
    const n = rows.length;
    return '<div data-ungraded-edition="' + n + '"><p class="mk-note">' + cs.w(n === 1 ? "screen.published.ungraded.one" : "screen.published.ungraded", { n: String(n) }) + "</p>"
      + '<details class="mk-details" data-fold="screen.published.ungraded.which"><summary>' + cs.w("screen.published.ungraded.which") + '</summary><ul class="mk-list">'
      + rows.map(function (r) {
        return '<li data-ungraded-row="' + cs.esc(String(r.finding || "") + "/" + String(r.ord === undefined || r.ord === null ? "" : r.ord)) + '">'
          + cs.w("screen.ceremony.ungraded.row", { passage: String(r.title || r.content_id || ""), n: String(P.placeOf(e, r.finding)) }) + "</li>";
      }).join("") + "</ul></details></div>";
  },

  /* R104: the public pages' head, the group's public name, and their foot, "Made with Civicsmith". */
  pubHead: function (cs, group) {
    return group ? '<header class="cs-pubhead" data-pubhead><span class="grp">' + cs.esc(group) + "</span></header>" : "";
  },
  pubFoot: function (cs) {
    return '<footer class="cs-pubfoot" data-pubfoot><span class="cs-credit">' + cs.w("case-grammar.text.made", { product: cs.w("shell.mark") }) + "</span></footer>";
  },

  /* The answer the screen draws from, once read: the case's (or the finding's) `publishedcase`. */
  answer: function (view) {
    return view.data.edition && view.data.edition.state === "ok" ? view.data.edition.value : null;
  },

  /* R6, R37 (fix round 2, C2): the words of a claim or a falsifier, never a heading: the first of the candidates that holds words
     once a leading markdown heading line is taken off (a section kept with its heading, "## Conclusion", is no words); "" when none
     does. */
  wordsOf: function () {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      const w = typeof v === "string" ? v.replace(/^\s*#{1,6}[^\n]*(\n|$)/, "").trim() : "";
      if (w) return w;
    }
    return "";
  },
  /* the words of a finding's claim and of its falsifier: the signed document's own (`case_words`), the finding's published bytes' next
     (`body.conclusion`, `body.falsifies`), the authored words last */
  claimOf: function (view, f) {
    const body = f && f.body && typeof f.body === "object" ? f.body : {}, au = body.authored && typeof body.authored === "object" ? body.authored : {};
    const cw = f && f.case_words && typeof f.case_words === "object" ? f.case_words : {};
    return view.parts.wordsOf(cw.claim, body.conclusion, au.conclusion);
  },
  falsifierOf: function (view, f) {
    const body = f && f.body && typeof f.body === "object" ? f.body : {}, au = body.authored && typeof body.authored === "object" ? body.authored : {};
    const cw = f && f.case_words && typeof f.case_words === "object" ? f.case_words : {};
    return view.parts.wordsOf(cw.falsifier, f && f.falsifier, body.falsifies, au.falsifier);
  },

  /* R6, R19, R37 (fix round 3, C47; public-read R41): the document an evidence entry (a leg of the signed bytes) rests on, by the name and
     the place the signed case states: `document: {name, place}`. The place is the passage's own extent; a page of a PDF is drawn as the
     page it is (extents are counted from zero), any other extent is not worded here and a whole document has none. "" for a leg resting on
     working material (`document: null`), which draws nothing of it. */
  docLine: function (cs, leg) {
    const d = leg && leg.document && typeof leg.document === "object" ? leg.document : null;
    if (!d) return "";
    const name = typeof d.name === "string" ? d.name.trim() : "";
    const at = d.place && typeof d.place === "object" ? d.place : null;
    // a PDF's page, or a web page's paragraph (`doc-para`, counted from zero in the captured file), as the signed extent states it
    const page = at && at.kind === "pdf-page" && Number.isInteger(at.page) && at.page >= 0 ? cs.w("screen.document.passage.where", { page: String(at.page + 1) })
      : at && at.kind === "doc-para" && Number.isInteger(at.para) && at.para >= 0 ? cs.w("screen.question.leg.paragraph", { n: String(at.para + 1) }) : "";
    return name || page ? '<span class="rec" data-document>' + cs.esc(name) + "</span>" + (page ? ' <span class="meta" data-place>' + page + "</span>" : "") : "";
  },

  /* A finding's grade on `axis` as a letter (A to D), or "" when its frozen pair does not state one. */
  gradeOf: function (f, axis) {
    const st = f && Array.isArray(f.strength) ? f.strength : [];
    const x = st.find(function (y) { return y && y.axis === axis; });
    const g = x && typeof x.grade === "string" ? x.grade.trim().toUpperCase() : "";
    return /^[A-D]$/.test(g) ? g : "";
  },
  rank: function (letter) { return { A: 4, B: 3, C: 2, D: 1 }[letter] || 0; },

  /* R38: the reader's minimum, `{capture, connection}` each "" or a letter; null when none is set. */
  floorOf: function (view) {
    const fl = view.ui.floor;
    return fl && (fl.capture || fl.connection) ? fl : null;
  },
  /* R38: whether a finding meets the minimum on each axis it is set on; a grade the answer does not state never does. */
  meets: function (view, f) {
    const P = view.parts, fl = P.floorOf(view);
    return !fl || ["capture", "connection"].every(function (a) { return !fl[a] || P.rank(P.gradeOf(f, a)) >= P.rank(fl[a]); });
  },

  /* R80 (C47): a finding's role and its two strengths, joined by the separator only between what is stated (no trailing dot) */
  strengthLine: function (cs, view, stand, f) {
    const P = view.parts;
    // DEC-496: a finding's capture is the team's grade for the copy (DEC-461), so its gloss takes the copy lead
    const grades = [P.gradeMark(cs, "capture", P.gradeOf(f, "capture"), { copy: true }), P.gradeMark(cs, "connection", P.gradeOf(f, "connection"))].filter(Boolean).join(" ");
    return [stand.role === "load_bearing" ? cs.w("case-grammar.load_bearing") : "", grades].filter(Boolean).join(" · ");
  },

  /* R37: a leg of the signed bytes is served (its target a published finding of a case) or only named. */
  legs: function (f) {
    return (f && Array.isArray(f.basis) ? f.basis : []).filter(function (l) { return l && typeof l === "object"; });
  },
  cuts: function (leg) { return leg.role === "cuts_against"; },
  titleOf: function (leg) {
    return leg.served === true && leg.cited_edition && typeof leg.cited_edition.title === "string" ? leg.cited_edition.title : "";
  },

  /* The finding's place in the edition, 1-based; 0 when it is not in it. */
  placeOf: function (e, id) {
    const list = e && Array.isArray(e.findings) ? e.findings : [];
    for (let i = 0; i < list.length; i++) if (String(list[i].bundle_id || list[i].id || "") === String(id)) return i + 1;
    return 0;
  },

  /* A grade as the kit marks it, on the axis the answer names; "" for a grade that is no letter. */
  gradeMark: function (cs, axis, letter, o) {
    const g = typeof letter === "string" ? letter.trim().toUpperCase() : "";
    if (!(/^[A-D]$/.test(g) && typeof axis === "string" && axis)) return "";
    // DEC-496: the letter's word gloss beside the chip (`mark.grade.gloss.<scale>.<letter>`, as `mark.grade.gloss.form`); a letter the
    // word list holds no gloss for draws none (the kit draws a missing key as itself). The team's copy grade leads with its own words.
    const key = "mark.grade.gloss." + axis + "." + g.toLowerCase(), said = cs.w(key);
    const lead = o && o.copy && axis === "capture" ? cs.w("mark.grade.gloss.copy.lead") : "";
    const gloss = said && said !== key ? '<span class="meta" data-gloss="' + cs.esc(axis + "." + g) + '">'
      + cs.w("mark.grade.gloss.form", { letter: g, gloss: { html: (lead && lead !== "mark.grade.gloss.copy.lead" ? lead + " " : "") + said } }) + "</span>" : "";
    return cs.grade(axis, g) + gloss;
  },

  /* R6, R37–R39: one finding as the case page draws it: its place, its conclusion in the author's words, its two strengths
     and whether it meets the project's bar (`standing`, case-grammar R15; nothing is said when the bar was not asked).
     `o.link` makes its name the way to its own page (R37); `o.open` adds the sources it rests on, for the print (R39). */
  card: function (cs, view, f, n, e, caseId, o) {
    const P = view.parts, body = f.body || {}, edition = e && e.edition !== undefined ? e.edition : "";
    const stand = f.standing && typeof f.standing === "object" ? f.standing : {};
    const meets = stand.meets === true ? "yes" : stand.meets === false ? "no" : null;
    const bar = stand.bar && typeof stand.bar === "object" ? stand.bar : {};
    const id = String(f.bundle_id || f.id || n);
    const name = cs.w("screen.published.finding", { n: String(n) });
    const head = '<span class="eyebrow">' + (o && o.link ? '<a href="' + P.hrefOf(caseId, edition, id) + '" data-nav data-finding-page>' + name + "</a>" : name) + "</span>";
    const line = P.strengthLine(cs, view, stand, f)
      + (meets ? " " + cs.w(meets === "yes" ? "screen.published.meets" : "screen.published.below", { capture: String(bar.capture || "–"), connection: String(bar.connection || "–") }) : "");
    // C47: what would change it, and the evidence entries each by its document's name and place, as the signed case states them
    const why = P.falsifierOf(view, f);
    const docs = o && (o.link || o.open) ? P.legs(f).map(function (l) { return P.docLine(cs, l); }).filter(Boolean) : [];
    return '<article class="mk-finding" data-finding="' + cs.esc(id) + '">' + head + '<p class="rec mk-fbody">' + cs.esc(P.claimOf(view, f) || body.question || f.title || "")
      + "</p><p>" + line + "</p>"
      // R81 (D-M6 (b)): an axis the frozen pair does not grade as a letter says so by the design's words, never nothing: "Undetermined" when its
      // state is that, else "Not graded yet"
      + (Array.isArray(f.strength) ? (function () {
        const open = ["capture", "connection"].filter(function (a) { return !P.gradeOf(f, a); });
        const stateOf = function (a) { const x = f.strength.find(function (y) { return y && y.axis === a; }); return x && x.state === "undetermined" ? "undetermined" : "unrated"; };
        // R102: neither axis graded (and neither undetermined) is one short line saying what would grade it
        if (open.length === 2 && open.every(function (a) { return stateOf(a) === "unrated"; })) return '<p class="mk-small" data-ungraded="both">' + cs.w("screen.published.ungraded.line") + "</p>";
        return open.map(function (a) {
          return '<p class="mk-small" data-ungraded="' + a + '"><b>' + cs.w("mark.scale." + a + ".name") + "</b> "
            + cs.w(stateOf(a) === "undetermined" ? "screen.published.strength.undetermined" : "screen.published.strength.unrated") + "</p>";
        }).join("");
      })() : "")
      + (why ? '<p class="mk-small" data-falsifier><b>' + cs.w("screen.published.what.would.overturn.it") + '</b> <span class="rec">' + cs.esc(why) + "</span></p>" : "")
      + (docs.length ? '<p class="mk-small"><b>' + cs.w("screen.published.evidence") + '</b></p><ul class="mk-list" data-evidence-names>'
        + docs.map(function (d) { return "<li>" + d + "</li>"; }).join("") + "</ul>" : "")
      + (o && o.open ? P.sources(cs, view, f) : "") + "</article>";
  },

  /* R39: what a finding rests on, listed for the print: the documents it only names, counted, by what they do to it; and
     the published findings of other teams it leans on, each by the title of the edition it cites. A document the case does
     not publish is not named, and nothing of it is drawn. */
  sources: function (cs, view, f) {
    const P = view.parts, legs = P.legs(f);
    const part = function (cut) {
      const named = legs.filter(function (l) { return l.served !== true && P.cuts(l) === cut; }).length;
      const served = legs.filter(function (l) { return l.served === true && P.cuts(l) === cut && P.titleOf(l); });
      const said = !named ? "" : cut ? cs.w("screen.published.cut.against.by.a.letter")
        : cs.w(named === 1 ? "screen.published.rests.on.the.council.minutes.one" : "screen.published.rests.on.the.council.minutes", { count: String(named) });
      const titles = served.length ? cs.w(cut ? "screen.published.cutagainstby.lead" : "screen.published.restson.lead",
        { items: { html: served.map(function (l) { return '<span class="rec">' + cs.esc(P.titleOf(l)) + "</span>"; }).join(", ") } }) : "";
      return said || titles ? '<p class="mk-small">' + said + (said && titles ? " " : "") + titles + "</p>" : "";
    };
    return part(false) + part(true);
  },

  /* R39: the signer and the key's fingerprint, as `publishedcase` states them: the case document's signer, else the
     finding's attestor; `{member, key}`, either "" when not stated. */
  signerOf: function (e) {
    const first = e && Array.isArray(e.findings) && e.findings[0] ? e.findings[0] : {};
    const by = [e && e.signed_by, e && e.attestor, first.attestor].find(function (a) { return a && typeof a === "object" && (a.member || a.key_b64 || a.fingerprint); }) || {};
    return { member: typeof by.member === "string" ? by.member : "", key: typeof by.key_b64 === "string" ? by.key_b64 : "",
      fingerprint: typeof by.fingerprint === "string" ? by.fingerprint : "" };
  },
  /* R39: a key's fingerprint: the first eight hexadecimal digits of the SHA-256 of its wire bytes, in two groups of four; ""
     when the key is not stated or the browser cannot hash. */
  fingerprintOf: async function (key) {
    if (typeof key !== "string" || !key) return "";
    try {
      const raw = atob(key), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const hex = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      return hex.slice(0, 4) + " " + hex.slice(4, 8);
    } catch (x) { return ""; }
  },
});
