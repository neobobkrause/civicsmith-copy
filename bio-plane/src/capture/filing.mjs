/* capture — filing a captured document (R115, R116): the one way a captured document is named, and the one way it is composed into
 * an Information bundle at `collected`. Moved unchanged from the capture screen's file (`screens-intake/capture.mjs`; tranche t2,
 * ARCH's decision "The layers: order and the refactoring plan", step 1), so that the capture screen and the door's delivery of an owed
 * render (control-plane's `deliverOwedRender`) call the same code. Each function imports nothing, reads only what it is handed in `cs`,
 * and holds every helper inside itself, so a page may carry it as source, function by function. It writes only through the `promote`
 * step its caller hands it. */

/**
 * What `titleOf` is handed: the page's own words and clock, or the door's.
 * @typedef {Object} NamingContext
 * @property {(key: string, fills?: any) => string} w a word by key, filled
 * @property {(iso: string) => string} date a whole-second UTC instant written as a date
 * @property {() => number} [now] the clock, epoch milliseconds; `Date.now` when absent
 */
/**
 * What `promoteDocument` is handed: the caller's way of sending an op, its digest and its clock.
 * @typedef {Object} PromotingContext
 * @property {(op: string, req: any) => Promise<any>} call sends an op, `{query}` or `{body}`, and answers its answer
 * @property {(text: string) => Promise<string>} digest the SHA-256 of text's UTF-8, lowercase hex
 * @property {() => number} [now] the clock, epoch milliseconds; `Date.now` when absent
 */
/**
 * What `promoteDocument` answers: `bundleId` and `readingPending`, with `readingDropped: true` when the document was filed without its
 * reading; or `refused`, the refusing answer (`{}` when it gave none).
 * @typedef {Object} Filed
 * @property {string} [bundleId]
 * @property {boolean} [readingPending]
 * @property {boolean} [readingDropped]
 * @property {any} [refused]
 */

/** R115 (the capture screen's R54; C25): one rule for a document's name, the same for a web page, a PDF and an upload: its own title
 *  (the reading's `title`, else what the answer's document states), else its file name (an upload's own, or the name its source
 *  states, `capture.file_name`; never the file part of an address), else its host and the day captured (`document.untitled.web`,
 *  never the host alone). With no host either, `screen.held.untitled`. White space folded; plain text, at most 200 characters.
 *  @param {NamingContext} cs
 *  @param {{reading?: any, doc?: any, address?: string, fileName?: string}} o the reading, the document `acquire` or the upload answered,
 *    the address it was captured from, and an upload's own file name
 *  @returns {string}
 */
export function titleOf(cs, o) {
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const clean = (t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");
  const doc = o.doc && typeof o.doc === "object" ? o.doc : {};
  const own = clean(o.reading && o.reading.title) || clean(doc.title);
  if (own) return own.slice(0, 200);
  /* acquisition answers `file_name` as the last segment of an address when the source states no name: that is the file part of the address, which never names a document (R54).
     The source states a name when the response it kept carries a `content-disposition` (`capture.transport.http_headers`); otherwise a name equal to the address's last segment is the address's */
  let lastSegment = "";
  try { lastSegment = decodeURIComponent(new URL(String(o.address || "")).pathname.split("/").pop() || ""); } catch (e) { lastSegment = ""; }
  const sent = doc.capture && doc.capture.transport && Array.isArray(doc.capture.transport.http_headers) ? doc.capture.transport.http_headers : [];
  const disposed = sent.some((h) => Array.isArray(h) && String(h[0]).toLowerCase() === "content-disposition");
  const stated = clean(doc.capture && doc.capture.file_name);
  const file = clean(o.fileName) || (stated && (disposed || stated !== lastSegment) ? stated : "") || clean(doc.name_stated && doc.name_stated.text);
  if (file) return file.slice(0, 200);
  let host = "";
  try { host = new URL(String(o.address || "")).hostname; } catch (e) { host = ""; }
  if (!host) return plain(cs.w("screen.held.untitled")).slice(0, 200);
  const day = new Date(cs.now ? cs.now() : Date.now()).toISOString().split(".")[0] + "Z";
  return plain(cs.w("document.untitled.web", { site: host, date: { html: cs.date(day) } })).slice(0, 200);
}

/** R116 (the capture screen's R1, R21, R23; N747): a captured document promoted as an information bundle at `collected`, the one
 *  composition the address path, the upload path and the door's delivery of an owed render use, under an id `allocid` mints:
 *  `bundle.md` at `information@2` (naming the project when the capture has one), `data/provenance.json` and its register, and, so
 *  that `release` is not refused `ENTRY_REQUIREMENTS`, `data/dataset.json` with the `content_hash` that canonical dataset hashes to
 *  (capture grammar C-2.7), beside the capture's own files under `snapshots/`. Answers `{bundleId, readingPending}`, or `{refused}`
 *  with the refusing answer (`{}` when it gave none).
 *  @param {PromotingContext} cs
 *  @param {{doc?: any, title?: string, locator?: string, project?: string}} o the provenance document, its name (`titleOf`), its source
 *    locator, and the project it is filed under, when one
 *  @returns {Promise<Filed>}
 */
export async function promoteDocument(cs, o) {
  const doc = o.doc || {}, title = String(o.title || "").slice(0, 200), locator = String(o.locator || ""), project = o.project || "";
  const why = (r) => (r && typeof r === "object" ? r : {});
  const now = new Date(cs.now ? cs.now() : Date.now()).toISOString().split(".")[0] + "Z";
  const minted = await cs.call("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } });
  const mid = minted && (minted.result || minted);
  if (!mid || mid.ok === false || typeof mid.id !== "string") return { refused: why(mid) };
  /* R28: the cut comes first, then a trailing hyphen the cut left is trimmed, so the slug begins and ends with a letter or digit */
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "");
  const id = slug ? `${mid.id}-${slug}` : mid.id;
  const sha = doc.capture && doc.capture.sha256;
  /* UTF-8 length, computed from the code points (REC-178: a file's bytes is its UTF-8 length, never text.length). */
  const len = (s) => { let n = 0; for (const ch of String(s)) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
  /* record-grammar's canonical JSON: keys sorted, no space */
  const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
    : v !== null && typeof v === "object" ? "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}"
    : JSON.stringify(v);
  const bytes = doc.capture && Number.isFinite(doc.capture.bytes) ? doc.capture.bytes : null;
  const dataset = canon({ documents: [{ bytes, locator, sha256: sha || null }] });
  const text = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(title),
    "current_state: collected", "prior_state: null", "created: " + now, "last_updated: " + now,
    "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + await cs.digest(dataset),
    ...(project ? ["project: " + project] : []),
    "source:", "  locator: " + JSON.stringify(locator), "  authority: member-entered", "  retrieved: " + now,
    "monitoring:", "  enabled: false", "  frequency: none", "---", "",
    "## Summary", "", title, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  /* G43 (K4649, K4651): promotion refuses a file over its `INLINE_MAX` (1,048,576 B, `promotion`; no edge to it from here, and this module is served to the
     browser, so the bound is local, with room for the rest of the file; control-plane's suite fails if promotion's moves). A door-read document embeds
     its reading and units whole, so over the bound the file is composed again without them: the document is promoted unread and followed as a deferred
     large file is. `prov.length` first (a code unit is never fewer than one byte), then the UTF-8 length. */
  const PROV_EMBED_MAX = 1048576 - 65536; /* inside the function: the page is served function by function */
  /* G126h (fix round 9; R61; K4835): the door's units are chunked and never cut, and a sheet is not read at the door past its gate (the door gives the first
     look and the job row reads the rest), so the size of the file is the only test of whether a reading that arrives fits */
  let prov = JSON.stringify({ documents: [doc] }, null, 1), readingDropped = false;
  if (prov.length > PROV_EMBED_MAX || len(prov) > PROV_EMBED_MAX) {
    const { reading: _r, text_units: _u, text_units_over_bound: _o, text_units_skipped: _k, ...unread } = doc;
    prov = JSON.stringify({ documents: [unread] }, null, 1);
    readingDropped = true;
  }
  const parts = Array.isArray(doc.parts) && doc.parts.length ? doc.parts : null;
  const atts = Array.isArray(doc.attestations) ? doc.attestations : [];
  const files = [{ path: "bundle.md", text, bytes: len(text), sha256: await cs.digest(text) },
                 { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: await cs.digest(prov) },
                 { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: await cs.digest(dataset) },
                 ...(parts ? parts.map((p) => ({ path: p.file, blobSha: p.sha256, sha256: p.sha256, bytes: p.bytes }))
                   : [{ path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture && doc.capture.bytes }]),
                 ...atts.map((t) => ({ path: t.file, blobSha: t.sha256, sha256: t.sha256, bytes: t.bytes }))];
  /* R21 (G6, fix round 6; G127a, G127c, fix round 9; K4833; section 2c item 4): the register is WHOLES. A multipart document is one row, the capture's own
     digest with its total bytes and its path, carrying `parts: [{sha256, path, bytes}]` in order; a part's digest is never a row of its own, so two
     documents that share a part are two rows, each with the part among its `parts`, and provenance answers `CAPTURE_HELD_BY_ANOTHER_BUNDLE` for a whole
     only. A document of one part (the part is the whole) is one row with no `parts`. */
  const split = parts && parts.length > 1 ? parts : parts && parts.length === 1 && parts[0].sha256 !== sha ? parts : null;
  const register = [...(split ? [{ sha256: sha, path: doc.file, encoding: "binary", bytes: doc.capture && doc.capture.bytes,
                                   parts: split.map((p) => ({ sha256: p.sha256, path: p.file, bytes: p.bytes })) }]
                      : [{ sha256: sha, path: doc.file, encoding: doc.capture && doc.capture.encoding, bytes: doc.capture && doc.capture.bytes }]),
                    ...atts.map((t) => ({ sha256: t.sha256, path: t.file, encoding: "binary", bytes: t.bytes }))];
  const hex = "0123456789abcdef";
  let tail = "";
  for (let i = 0; i < 8; i++) tail += hex[Math.floor(Math.random() * 16)];
  const done = await cs.call("promote", { body: {
    bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + tail,
    meta: { object_type: "information", title, current_state: "collected", created: now, last_updated: now },
    files, register } });
  const p = done && (done.result || done);
  if (!p || p.ok === false) return { refused: why(p) };
  /* R57: the door reads a document stored with no reading after `promote` (control-plane R123); its answer says when that reading follows */
  return { bundleId: p.bundleId || id, readingPending: p.reading_pending === true, ...(readingDropped ? { readingDropped: true } : {}) };
}

