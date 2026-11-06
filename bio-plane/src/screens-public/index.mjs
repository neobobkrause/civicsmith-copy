/* screens-public: the parts the public screens draw for the T53 lines (R84, R100), split by copy from screens-publish
 * (5 Nov 2026). Requirements: `build/requirements/screens-public.md`.
 *
 * The screens themselves (`published`, `docket-public`, `doorbell`, `review-outside`) are screens-publish's, in
 * bio-plane/src/screens-publish/; this module holds the parts they draw for these lines, and each screen lists the part
 * among its own `parts` (interface-shell R21) to draw it. That listing is screens-publish's hook, never edited here.
 *
 * Every function is self-contained (interface-shell R21 (1)): it refers only to its parameters, the kit `cs` (`cs.w`,
 * `cs.esc`) and the language's own globals, so the shell can compose it into the page's one script and the same function
 * runs in node for the tests. Words by key: no member-facing English here. Each part reads `publishedcase`'s answer as
 * public-read states it, answers "" when it has nothing to draw, and never throws on a malformed answer. Pure: nothing
 * here reads or sends a request. */

/** R84 (DEC-461; public-read R46): at the top of the edition and of a signed case, the statement the signed document
 *  carries of the passages it was published without grading: "Published with {n} passages not yet graded by the team."
 *  (`screen.published.ungraded`; one passage `.one`) with a "Which passages" fold (`.which`) listing exactly the rows the
 *  statement lists, each by the title public-read gives it. `e` is `publishedcase`'s answer; its `ungraded_passages` is
 *  `{stated: true, count, rows}` or null (an earlier format, or a withheld edition). "" when it is null, not stated, or
 *  lists none: no line and no fold. The statement is the signed one, so a grade given later changes nothing here. */
export function ungradedStatement(cs, e) {
  const u = e && typeof e === "object" && e.ungraded_passages && typeof e.ungraded_passages === "object" ? e.ungraded_passages : null;
  const rows = u && u.stated === true && Array.isArray(u.rows) ? u.rows.filter(function (r) { return r && typeof r === "object"; }) : [];
  if (!rows.length) return "";
  const esc = function (s) { return typeof cs.esc === "function" ? cs.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  const line = rows.length === 1 ? cs.w("screen.published.ungraded.one") : cs.w("screen.published.ungraded", { n: String(rows.length) });
  const items = rows.map(function (r) {
    const name = typeof r.title === "string" && r.title.trim() ? r.title.trim() : typeof r.content_id === "string" ? r.content_id : "";
    const at = esc(String(r.finding == null ? "" : r.finding)) + ":" + esc(String(r.ord == null ? "" : r.ord));
    return '<li data-ungraded-passage="' + at + '"><span class="rec">' + esc(name) + "</span></li>";
  }).join("");
  return '<div class="mk-note" data-ungraded-statement="' + rows.length + '"><p>' + line + "</p>"
    + '<details data-ungraded-which><summary>' + cs.w("screen.published.ungraded.which") + "</summary><ul>" + items + "</ul></details></div>";
}

/** R100 (public-read R41): the case-level EVIDENCE list, from the entries `publishedcase` states for the edition's
 *  materials (`materials.materials[].entry`, `{name, locator, fingerprint}`). Each row draws the document's name, its
 *  locator, its fingerprint shortened (the first and last eight characters), and where it can be read: the locator as a
 *  link when it is a web address, and the archived copy when the entry states one. An entry stating no name, locator or
 *  fingerprint draws no row. "" when no row is left: no EVIDENCE heading is drawn. */
export function evidenceList(cs, e) {
  const esc = function (s) { return typeof cs.esc === "function" ? cs.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  const m = e && typeof e === "object" && e.materials && typeof e.materials === "object" && Array.isArray(e.materials.materials) ? e.materials.materials : [];
  const str = function (v) { return typeof v === "string" && v.trim() ? v.trim() : ""; };
  const web = function (v) { return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : ""; };
  const rows = m.filter(function (x) { return x && typeof x === "object"; }).map(function (x) {
    const en = x.entry && typeof x.entry === "object" ? x.entry : {};
    const name = str(en.name) || str(x.title), locator = str(en.locator) || str(x.origin);
    const fp = (str(en.fingerprint) || str(x.sha)).toLowerCase();
    const full = /^[0-9a-f]{64}$/.test(fp);
    if (!name && !locator && !full) return "";
    const where = [web(locator), web(str(x.archived_copy))].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return '<li data-evidence-entry="' + (full ? fp : "") + '">'
      + (name ? '<span class="rec" data-evidence-name>' + esc(name) + "</span>" : "")
      + (locator ? ' <span class="meta" data-evidence-locator>' + esc(locator) + "</span>" : "")
      + (full ? ' <span class="id" data-evidence-fingerprint title="' + fp + '">' + fp.slice(0, 8) + "…" + fp.slice(-8) + "</span>" : "")
      + where.map(function (u) { return ' <a href="' + esc(u) + '" rel="noopener noreferrer" data-evidence-where>' + cs.w("screen.published.evidence.open") + "</a>"; }).join("")
      + "</li>";
  }).filter(Boolean);
  if (!rows.length) return "";
  return '<section data-evidence-list><h2 class="mk-h2">' + cs.w("screen.published.evidence") + "</h2><ul>" + rows.join("") + "</ul></section>";
}

/** R100: the sentence that says anyone can check the files "using the signature and the public key shown here"
 *  (`screen.published.verify.detail`) is drawn only with the two it names: the edition's signature (`document.sig_armored`)
 *  and the signer's public key (`document.attestor.key_b64`) as `publishedcase` states them. "" when either is not
 *  stated: then neither the sentence nor half of it is drawn. */
export function signatureShown(cs, e) {
  const esc = function (s) { return typeof cs.esc === "function" ? cs.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  const d = e && typeof e === "object" && e.document && typeof e.document === "object" ? e.document : null;
  const sig = d && typeof d.sig_armored === "string" ? d.sig_armored.trim() : "";
  const by = d && d.attestor && typeof d.attestor === "object" ? d.attestor : {};
  const key = typeof by.key_b64 === "string" ? by.key_b64.trim() : "";
  if (!sig || !key) return "";
  return '<div data-signature-shown><p class="mk-small">' + cs.w("screen.published.verify.detail") + "</p>"
    + '<pre class="mk-small" data-signature>' + esc(sig) + "</pre>"
    + '<p class="mk-small"><code data-public-key>' + esc(key) + "</code></p></div>";
}

/* The keys these parts read, for a screen that lists a part to add to its `words`. */
export const PART_KEYS = Object.freeze({
  ungradedStatement: Object.freeze(["screen.published.ungraded", "screen.published.ungraded.one", "screen.published.ungraded.which"]),
  evidenceList: Object.freeze(["screen.published.evidence", "screen.published.evidence.open"]),
  signatureShown: Object.freeze(["screen.published.verify.detail"]),
});
