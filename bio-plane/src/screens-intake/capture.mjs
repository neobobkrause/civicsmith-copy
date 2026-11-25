/* The `capture` screen (Add; R1–R3): three tabs, each its own, at `/app/capture/address`, `/app/capture/file` and
 * `/app/capture/saw` (the subject names the tab; none is the address tab). Every function is self-contained (interface-shell
 * R21 (1)): it refers only to its parameters, the kit `cs` and the language's own globals. */

/* R1–R3: nothing is read before an act, but on the address tab (R29, R31, R38): the member's open captures (`opencaptures`,
 * for "Unfinished"), the held and vouched documents (the title of the one that holds a capture's primary, and of the copy an
 * address is already held as, R40) and, when Add is opened
 * from a question, the questions the member may see (`search`, as `find-in` reads them) for "For which question". */
function captureReads(view) {
  /* the tab and the subject as `forOf` reads them: an unknown tab is the address tab */
  const s = String((view && view.subject) || "");
  const at = s.indexOf("/");
  const tab = at < 0 ? s : s.slice(0, at), id = at < 0 ? "" : s.slice(at + 1);
  if (tab === "file" || tab === "saw") return {};
  return { open: { op: "opencaptures", query: {}, empty: (v) => !v || !Array.isArray(v.captures) || !v.captures.length },
           /* C14 (capture R77, R88): the cheap picker read, once for the screen: a title and a digest per document, no examination */
           held: { op: "heldcaptures", query: { limit: 200, state: "held_and_vouched", fields: "picker" } },
           /* R47, R55 (C20; DEC-394 3c): the one read of the capture requests serves the team's requests a source turned away for a
              login and the member's own "requests for later" */
           later: { op: "capturerequests", query: { limit: 50 }, empty: (v) => !v || !Array.isArray(v.requests) || !v.requests.length },
           ...(/^INQ-[A-Za-z0-9-]+$/.test(id) ? { questions: { op: "search", query: { q: "type:inquiry", limit: "200" },
             empty: (v) => !v || !Array.isArray(v.hits) || !v.hits.length },
             /* C35 (R29): a hit names no project; the projects are read here and each one's questions once in `render`, so a question is told by its project */
             projects: { op: "projectlist", empty: () => false } } : {}) };
}

/* R22 (T49; BOB's reading of J2): the subject is the route's `<tab>` or `<tab>/<id>`, the id a project (`PROJ-…`) or a
 * question (`INQ-…`) the capture is made for. Anything else is no subject, and the capture is filed nowhere. */
function forOf(view) {
  const s = String((view && view.subject) || "");
  const at = s.indexOf("/");
  const tab = at < 0 ? s : s.slice(0, at), id = at < 0 ? "" : s.slice(at + 1);
  return { tab: ["address", "file", "saw"].includes(tab) ? tab : "address", id: /^(PROJ|INQ)-[A-Za-z0-9-]+$/.test(id) ? id : "" };
}

/* R22: where the subject files a capture: `{id, title, question}`, the project's id and title and, for a question, the
 * question's title. A project's own id; a question's project, as its bundle states it (`project:` in its front matter; the
 * question is read through `image`). `id` is "" when a question states no project (filed nowhere); null when the
 * question could not be read, so nothing is filed where the member did not mean. A title that cannot be read is the id. */
async function projectOf(cs, id) {
  if (!id) return { id: "", title: "", question: "" };
  const front = async (of) => {
    const a = await cs.call("image", { query: { id: of } });
    const r = a && typeof a.result === "object" && a.result ? a.result : a;
    const md = r && typeof r["bundle.md"] === "string" ? r["bundle.md"] : null;
    return md === null ? null : md.split(/\n---\s*\n/)[0] || "";
  };
  const field = (fm, name) => { const m = new RegExp("^" + name + ":\\s*(.*?)\\s*$", "m").exec(fm); return m ? m[1].replace(/^["']|["']$/g, "") : ""; };
  let project = id, question = "";
  if (!/^PROJ-/.test(id)) {
    const fm = await front(id);
    if (fm === null) return null;
    question = field(fm, "title") || id;
    project = /^PROJ-\S+$/.test(field(fm, "project")) ? field(fm, "project") : "";
    if (!project) return { id: "", title: "", question };
  }
  const pm = await front(project);
  /* G74 (fix round 7; BOB's ruling, following K4557): a member files into a project only when she is in it or invited to it. A project whose
     front matter the read gives is hers; one it refuses is hers only when the project list names her participation in it (`joined`, `leaving`
     or `invited`: an invited member's read is the skeleton only). `member` is that; the title is the project's own name where the read gives
     one, else the list's, and never the id. */
  if (pm !== null) return { id: project, title: field(pm, "title"), question, member: true };
  let row = null, after = "";
  for (let page = 0; page < 20 && !row; page++) {
    const a = await cs.call("projectlist", { query: { limit: 200, ...(after ? { after } : {}) } });
    const v = a && typeof a.result === "object" && a.result ? a.result : a;
    const rows = v && Array.isArray(v.projects) ? v.projects : [];
    row = rows.find((x) => x && x.id === project) || null;
    if (row || !v || v.truncated !== true || typeof v.next !== "string" || !v.next) break;
    after = v.next;
  }
  const mine = !!(row && ["joined", "leaving", "invited"].includes(row.participation));
  return { id: project, title: row && typeof row.name === "string" ? row.name : "", question, member: mine };
}

/* G74 (U463, DEC-425): the words for a project the member may not file into: `refusal.PROMOTE_NOT_A_PARTICIPANT` with `{project}` by name where the
 * name is known and the row exists, else the nearest held row (`project.notmember`). Answers `{key, fills}`. */
function notMemberWords(cs, f) {
  const key = "refusal." + "PROMOTE_NOT_A_PARTICIPANT";
  return f && f.title && cs.w(key) !== key ? { key, fills: { project: f.title } } : { key: "project.notmember", fills: {} };
}

/* G75 (fix round 7): a held row's name where it stored none: the chain a delivery names a document by (R54), from what the row gives: its own
 * title; else its host and the day it was captured (`document.untitled.web`, the day of its source's `retrieved`); with neither, `screen.held.untitled`.
 * Plain text, at most 200 characters; never "Untitled capture" for a row whose host and day are known. */
function heldTitle(cs, r) {
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const own = r && typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim() : "";
  if (own) return own.slice(0, 200);
  const s = r && r.source && typeof r.source === "object" ? r.source : {};
  let host = "";
  try { host = new URL(String(s.address || "")).hostname; } catch (e) { host = ""; }
  const when = Date.parse(String(s.retrieved || ""));
  if (!host || !Number.isFinite(when)) return plain(cs.w("screen.held.untitled")).slice(0, 200);
  return plain(cs.w("document.untitled.web", { site: host, date: { html: cs.date(new Date(when).toISOString().split(".")[0] + "Z") } })).slice(0, 200);
}

/* R54 (C25; amends R33, R50): one rule for a document's name, the same for a web page, a PDF and an upload: its own title (the
 * reading's `title`, else what the answer's document states), else its file name (an upload's own, or the name its source states,
 * `capture.file_name`; never the file part of an address), else its host and the day captured (`document.untitled.web`, never the
 * host alone). With no host either, `screen.held.untitled`. Plain text, at most 200 characters. */
function titleOf(cs, o) {
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

/* R13, DEC-342: a refusal in words, beside the act or the address that met it: `refusal.<CODE>` when the table holds the code,
 * else the answer's own translation, else `refusal.uncatalogued` with the code as given; an answer with a code and neither is
 * the one place a code is drawn. Never the builder's `detail`. "" when the answer states no code and no translation (the caller
 * draws `shell.unread`). The answer's fields fill the word, as plain values only. */
function refusalHtml(cs, r) {
  const a = r && typeof r === "object" ? r : {};
  const code = String(a.code || a.reason || "");
  const fills = {};
  for (const k of Object.keys(a)) if (typeof a[k] === "string" || typeof a[k] === "number") fills[k] = a[k];
  if (code && cs.w("refusal." + code) !== "refusal." + code) return cs.w("refusal." + code, fills);
  if (typeof a.translation === "string" && a.translation) return cs.esc(a.translation);
  return code ? `${cs.w("refusal.uncatalogued")} <code>${cs.esc(code)}</code>` : "";
}

/* R1, R21, R23 (N747): a document the screen promotes as an information bundle at `collected`, the one composition both
 * the address path (R1) and the upload path (R21) use, under an id `allocid` mints: `bundle.md` at `information@2`
 * (naming the project when the capture has one, R22), `data/provenance.json` and its register, and, so that `release` is not
 * refused `ENTRY_REQUIREMENTS` (R23), `data/dataset.json` with the `content_hash` that canonical dataset hashes to
 * (capture grammar C-2.7), beside the capture's own files under `snapshots/`. Answers `{bundleId}`, or `{refused}` with the
 * answer, which `refusalHtml` words (`{}` when it gave none). */
async function promoteDocument(cs, o) {
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

/* G111 (C35): one project's questions, read once (kept in page memory, `qs:<id>`); a read already made or under way is not made again. */
function readProjectQuestions(cs, ui, pid) {
  if (ui["qs:" + pid]) return;
  ui["qs:" + pid] = { state: "loading", items: [] };
  cs.call("projectquestions", { query: { project: pid, limit: "200" } }).then((a) => {
    const v = a && typeof a === "object" && a.result && typeof a.result === "object" ? a.result : a;
    cs.set("qs:" + pid, v && v.ok !== false && Array.isArray(v.items) ? { state: "ok", items: v.items.map((x) => String(x.inquiry)) } : { state: "failed", items: [] });
  }, () => cs.set("qs:" + pid, { state: "failed", items: [] }));
}

/* R1–R3: the page. The tab body carries no class: the design's `st` is its mock's state switch (hidden unless a `main`
 * carries `data-st`), which the served `shell.css` carries and which would hide every tab. `view.subject` the tab (and,
 * after a `/`, the project or question the capture is for, R22); `view.ui` what the acts left (outcomes, a draft);
 * `view.reachable` whether the assistant is reachable for this member (interface-shell R20). */
function renderCapture(cs, view) {
  const at = view.parts.forOf(view), tab = at.tab;
  const U = view.ui || {};
  const said = (k, f) => `<p class="mk-note" role="status">${cs.w(k, f)}</p>`;
  /* C94 (interface-shell R111): a member is named by the handle the shell knows for her id (the founder and a member with no handle by its
     fallback word) and linked by `memberHref`, never by the id; "" for no member */
  /* who asked for a request: the owner's rows state it as `attribution.principals.plane` (capture-requests R10); a row carrying `principal_plane` itself is read the same */
  const planeOf = (r) => (r && (r.principal_plane || (r.attribution && r.attribution.principals && r.attribution.principals.plane))) || "";
  const person = (id) => { const k = String(id || "").replace(/^member:/, ""); return k ? `<a class="cs-ref" href="${cs.esc(cs.memberHref(k))}" data-nav>${cs.esc(cs.memberName(k))}</a>` : ""; };
  /* C29: a name placed before a sentence's own full stop loses its one (a title or file name that ends in a full stop would double it);
     an ellipsis, or a name that ends in several, is left whole */
  const bare = (t) => String(t == null ? "" : t).replace(/(?<![.\u2026])\.$/, "");
  const tabs = [["address", "screen.capture.tab.address"], ["file", "screen.capture.tab.file"], ["saw", "screen.capture.tab.saw"]]
    /* C81: each tab is a 44 px target (the tab and its link fill the same box) */
    .map(([k, w]) => `<span role="tab"${k === tab ? ' aria-selected="true"' : ""} style="display:inline-flex;align-items:center;min-height:44px;box-sizing:border-box"><a href="/app/capture/${k}${at.id ? "/" + encodeURIComponent(at.id) : ""}" data-nav${k === tab ? ' aria-current="page"' : ""} style="display:inline-flex;align-items:center;min-height:44px;box-sizing:border-box">${cs.w(w)}</a></span>`).join("");
  /* R24: the capture's result links the document it made; R22: "Cite a passage" opens `find-in` over it, with the question
     chosen when the capture was made for one. Nothing is linked for a refused promotion or an answer naming no bundle. */
  const plainText = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  /* R49 (C9): a document held under another project's home and filed here as well says so (`screen.capture.address.filedhere`, with the home's
     name); a document filed under the page's project or question says where, as a new capture does. "" where nothing was filed. */
  const filedLine = (g) => g && g.alsoHere && g.alsoHere.home ? cs.w("screen.capture.address.filedhere", { project: g.alsoHere.home })
    : g && g.filed && g.filed.id && g.filed.title ? (g.filed.question ? cs.w("capture.filed.question", { project: g.filed.title, question: g.filed.question }) : cs.w("capture.filed.project", { project: g.filed.title })) : "";
  const made = (g) => g && typeof g.bundleId === "string" && g.bundleId
    ? `<p class="mk-small">${cs.ref("document", g.bundleId, g.existed ? plainText(cs.w("screen.capture.address.existed.open")) : g.title || g.bundleId, [])}`
      + (filedLine(g) ? ` ${filedLine(g)}` : "")
      /* R35: "Cite a passage" opens `find-in` over the document by its capture's fingerprint, never its record id */
      + (/^INQ-/.test(at.id) && typeof g.sha === "string" && g.sha ? ` <a class="cs-btn" data-tone="quiet" href="/app/find-in/${encodeURIComponent(g.sha)}/${encodeURIComponent(at.id)}" data-nav data-level="1" data-tip="${cs.w("capture.cite.tip")}">${cs.w("capture.cite")}</a>` : "")
      + "</p>" : "";
  /* a sentence by its own key where the words table holds it, else `alt()`: the nearest held rows stand in until the design's rows reach the table (K4269); the
     rows owed are named in the job record. A drawn-screen module holds no English and adds no marker of its own (K4640). */
  const keyedW = (k, f, alt) => { const t = cs.w(k, f); return t === k ? alt() : t; };
  /* R57 (fix round 4b, F1; K4487): a capture or upload answered `reading_pending` says the reading follows. The nearest held row stands in
     (`screen.document.text.unread.next`, K4269; its own row is owed, named in the job record). R65 (fix round 9, G135f): once the job row has been read
     for the capture's digest (`job:<sha>`, `watchReading`), the line is the state the row states instead. */
  const pendingLine = (g) => {
    if (!g || !g.readingPending) return "";
    const asked = typeof g.sha === "string" && g.sha ? U["job:" + g.sha] : null;
    if (asked) {
      const line = jobLine(asked);
      if (line) return line;
      /* R65 (fix round 10, G1; K5055): the job row is gone (`job.state` null) once a reading has ended, and the stored reading is what is left to say. A reading that
         holds words, or states itself (a final failure, a refusal, a completeness, its word counts), is drawn as that statement at every tick, never as "unread, check
         again soon"; a reading that states nothing yet, or none, keeps the static line. */
      const stored = view.parts.readingOf(asked, {});
      if (stored.present && (stored.own || stored.failure === "final")) return readDrawn(stored);
    }
    return `<p class="mk-note" role="status" data-reading="pending">${cs.w("screen.document.text.unread.next")}</p>`;
  };
  /* R65 (G135f; K4831 (5); control-plane R135, plane R97): the reading's state as `op=reading` answers it from the job row (never from the reading object):
     queued; being fetched; being read N of M (N the units written, M what the row counts: written, skipped, owed and failed); read in part, searched only so far;
     refused, with the size and the limit; finished, as the stored reading says it. An "about" estimate only once the row holds enough units to measure a rate
     (`estimateOf`), and only where the design's row for it is held: no stand-in invents a promised time. A digest with no row (`state: null`) draws nothing here. */
  const jobLine = (ans) => {
    const job = view.parts.jobStateOf(ans);
    if (!job) return "";
    const mk = (st, html) => `<p class="mk-note" role="status" data-reading="${st}" data-job-state="${job.state}">${html}</p>`;
    if (job.state === "queued") return mk("queued", keyedW("screen.capture.read.queued", {}, () => cs.w("screen.capture.reading.pending")));
    if (job.state === "fetching") return mk("fetching", keyedW("screen.capture.read.fetching", {}, () => `<b>${cs.w("screen.capture.address.working.head")}</b>`));
    if (job.state === "reading") {
      const sofar = job.written !== null && job.total ? keyedW("screen.capture.read.progress", { read: String(job.written), total: String(job.total) },
        () => cs.w("screen.document.reading.progress", { read: String(job.written), total: String(job.total) })) : keyedW("screen.capture.read.reading", {}, () => cs.w("document.readnow.pending"));
      const mins = view.parts.estimateOf(job);
      const about = mins === null ? "" : keyedW("screen.capture.read.about", { minutes: String(mins) }, () => "");
      return mk("reading", sofar + (about ? " " + about : ""));
    }
    if (job.state === "partial") return mk("partial", keyedW("screen.capture.read.partial", {}, () => cs.w("screen.document.reading.partial")));
    if (job.state === "refused") return job.verdict && job.verdict.size !== null && job.verdict.limit !== null
      ? mk("refused", view.parts.readRefusalHtml(cs, { reason: "TOO_LARGE", size: job.verdict.size, bound: job.verdict.limit })) : mk("refused", cs.w("shell.unread"));
    const done = view.parts.readingOf(ans, {});
    return done.present ? readDrawn(done).replace(/^<p /, `<p data-job-state="${job.state}" `) : "";
  };
  /* the text a reading holds, as one line: the reading's count when it states one, else whether every page, or none, has text */
  const readDrawn = (r) => {
    /* G14 (fix round 6; S1, S6): a reading's own completeness, as the Document draws it: never "full" while partial. Whole is as before; partial says so
       (the counts, else the nearest held row, `screen.document.text.unread.next`, which says the rest follows); stated is the reason it was refused whole
       (a refusal's words), else `none`. Owed: screen.document.reading.partial / .stated. */
    const c = r.completeness;
    /* G73 (fix round 7): a stated reading's `why` is the reading's own sentence ("the capture is 41502904 bytes in 5 parts, over ... so it was not read"), as
       the Document screen draws it, escaped and whole; a bare code (`TOO_LARGE`) is a refusal's words (`refusal.<code>`). A sentence is never handed to
       `refusalHtml` as a code: no word is found and the apology is drawn over it. */
    const statedWhy = (why) => { const t = String(why).trim(); return /^[A-Z][A-Z0-9_]*$/.test(t) ? view.parts.refusalHtml(cs, { code: t }) : cs.esc(t); };
    if (c && c.state === "partial") return `<p class="mk-note" role="status" data-reading="partial">${cs.w("screen.document.text.label")}: ${r.wordsRead !== null && r.wordsTotal !== null ? cs.w("screen.document.text.read", { read: String(r.wordsRead), total: String(r.wordsTotal) }) : cs.w("screen.document.text.unread.next")}</p>`;
    /* R64 (G135d): a refusal that names its cause is drawn in its own sentence with its own figures, before any reading of `stated`'s generic reason */
    if (r.refusal) return `<p class="mk-note" role="status" data-reading="refused">${view.parts.readRefusalHtml(cs, r.refusal)}</p>`;
    if (c && c.state === "stated") return `<p class="mk-note" role="status" data-reading="stated">${cs.w("screen.document.text.label")}: ${c.why ? statedWhy(c.why) : cs.w("screen.document.text.none")}</p>`;
    /* R63 (G135c): a reading that holds no words says why it does not: it failed (the nearest held row, `shell.unread`), or it is owed (it follows); the "no page
       has text" of `none` is for a reading that was made, whole, and found none */
    if (!r.words && r.failure === "final") return `<p class="cs-state" data-state="failed" role="status" data-reading="failed">${cs.w("screen.document.text.label")}: ${r.basis ? cs.esc(r.basis) : cs.w("shell.unread")}</p>`;
    if (!r.words && (r.owed || r.failure)) return `<p class="mk-note" role="status" data-reading="pending">${cs.w("screen.document.text.unread.next")}</p>`;
    const state = r.wordsRead !== null && r.wordsTotal !== null ? cs.w("screen.document.text.read", { read: String(r.wordsRead), total: String(r.wordsTotal) })
      : cs.w(r.words ? "screen.document.text.full" : "screen.document.text.none");
    return `<p class="mk-note" role="status" data-reading="read">${cs.w("screen.document.text.label")}: ${state}</p>`;
  };
  /* R2 (C17), R63 (G135c): for an upload filed under no project, what became of the reading: the text it holds (the reading's count when it states one), or
     why it holds none (it failed, it is owed, it was refused with its figures), or that no reading is held and, for a picture, that its words can't be found
     until it is read or typed. */
  const readLine = (u) => {
    if (u && u.readingPending) return pendingLine(u);
    const r = u && u.reading;
    if (!r || !u.filed || u.filed.id) return "";
    if (!r.present) return r.picture ? said("capture.picture.unread") : said("screen.document.text.unread") + said("screen.document.text.unread.next");
    return readDrawn(r);
  };
  /* R21: a refused promotion is drawn on its tab in words (`refusalHtml`), else the shell's own for a failure with none */
  const refusedPromotion = (t) => U.promoteRefused && U.promoteRefused.tab === t
    ? `<p class="cs-state" data-state="failed" role="alert">${U.promoteRefused.html || cs.w("shell.unread")}</p>` : "";
  /* R36 (DEC-292 D14; K3726): Add opened from a question says what it files under, first. The project and question are read
     once and kept in page memory (`filedFor`), as the act that files the capture reads them. */
  let forqNote = "";
  if (at.id) {
    if (!U.forq || U.forq.id !== at.id) {
      U.forq = { id: at.id, state: "loading" };
      view.parts.projectOf(cs, at.id).then((r) => cs.set("forq", { id: at.id, state: "ok", value: r }), () => cs.set("forq", { id: at.id, state: "ok", value: null }));
    }
    const m = U.forq.state === "ok" && U.forq.value && U.forq.value.id && U.forq.value.question && /^INQ-/.test(at.id) && U.forq.value.member !== false && U.forq.value.title ? U.forq.value : null;
    if (m) forqNote = said("screen.capture.forq", { project: m.title, question: `\u201C${m.question}\u201D` });
    /* G74 (fix round 7): Add opened for a project (or a question's project) the member is neither in nor invited to says so first, in the nearest held row's words
       (`project.notmember`; owed: its own row), and offers nothing to file there; the project is never named by its id */
    else if (U.forq.state === "ok" && U.forq.value && U.forq.value.id && U.forq.value.member === false) { const nm = view.parts.notMemberWords(cs, U.forq.value); forqNote = `<p class="cs-state" data-state="failed" role="alert" data-notmember>${cs.w(nm.key, nm.fills)}</p>`; }
  }
  let body = "";
  if (tab === "address") {
    const got = U.captured;
    const freqs = ["daily", "weekly", "monthly", "hourly", "per_meeting"];
    /* R18: one act row; watching and checking join it once the address has a document, with the frequency chosen beside
       them, and no watching section is drawn before anything is captured. R14, R16: two acts, each on that document. */
    const watch = !!got && (cs.can("monitorset") || cs.can("monitor"));
    /* R29 (N1117; DEC-321 (1)): opened from a question, "For which question", preset to it and changeable among the
       questions the member may see (`cs.choice` over record data); the routed one stays chosen though the list omits it */
    const D = view.data || {};
    const seenQ = {};
    const qs = (D.questions && D.questions.state === "ok" && D.questions.value && Array.isArray(D.questions.value.hits) ? D.questions.value.hits : [])
      .filter((h) => { const k = String(h && h.bundle_id); if (seenQ[k]) return false; seenQ[k] = true; return true; });
    /* C35, G111 (fix round 8; K4164, K4814): whose project each question is in. The settle reads only the routed question's own project (at most one
       `projectquestions`); the team's other projects are read afterwards, off the settle path, each once and kept in page memory (`qs:<id>`). A question
       no read names stays by its title. */
    const ownerOf = {};
    const projectsRead = D.projects && D.projects.state === "ok" && D.projects.value && Array.isArray(D.projects.value.projects) ? D.projects.value.projects : [];
    if (/^INQ-/.test(at.id)) {
      const mine = U.forq && U.forq.state === "ok" && U.forq.value && U.forq.value.id ? String(U.forq.value.id) : "";
      if (mine) view.parts.readProjectQuestions(cs, U, mine);
      if (projectsRead.length && !U.qsLater) {
        U.qsLater = true;
        cs.later(500, (k, v) => (v.data && v.data.projects && v.data.projects.state === "ok" && v.data.projects.value && Array.isArray(v.data.projects.value.projects) ? v.data.projects.value.projects : [])
          .forEach((pr) => v.parts.readProjectQuestions(k, v.ui, String(pr.id))));
      }
      projectsRead.forEach((pr) => {
        const pid = String(pr.id), m = U["qs:" + pid];
        if (m) m.items.forEach((q) => { ownerOf[q] = String(pr.name || pid); });
      });
    }
    const told = (id, t) => t + (ownerOf[id] ? " \u00b7 " + ownerOf[id] : "");
    /* C45: a question is named by its title (the one the page read for the routed question, else the search hit's), never by its id;
       one whose title cannot be read is the word for a question */
    const qWord = plainText(cs.w("shell.card.question")).replace(/<[^>]*>/g, "");
    const routedTitle = U.forq && U.forq.state === "ok" && U.forq.value && U.forq.value.question ? U.forq.value.question : "";
    const routed = at.id && /^INQ-/.test(at.id) && !qs.some((h) => String(h.bundle_id) === at.id) ? [{ value: at.id, text: told(at.id, routedTitle || qWord) }] : [];
    const forq = /^INQ-/.test(at.id) ? cs.choice("ci-for", "capture.forquestion", routed.concat(qs.map((h) => ({ value: String(h.bundle_id), text: told(String(h.bundle_id), String(h.title || (String(h.bundle_id) === at.id && routedTitle) || qWord)) }))), { value: at.id })
      + `<p class="mk-small muted">${cs.w("capture.forquestion.help")}</p>`
      /* G20 (fix round 6; S11): the chooser lists at most the 200 the read asked for; when the read says there are more, it says so (the nearest held row,
         `screen.held.more`, stands in; owed: a row for questions) */
      + (D.questions && D.questions.state === "ok" && D.questions.value && (D.questions.value.truncated === true || (typeof D.questions.value.next === "string" && D.questions.value.next)) ? said("screen.held.more", { count: String(qs.length) }) : "") : "";
    /* G2 (fix round 6; DEC-418, U452): a capture being fetched after the answer: `screen.capture.fetch.pending` ({size}, {project}) and `.fetch.why`. Until the
       design's rows reach the table (the close) the nearest held rows stand in (K4269): screen.capture.address.working.head, size.mb and capture.filed.project. */
    const mb = (n) => cs.w("size.mb", { n: (n / 1048576).toFixed(1) });
    const keyed = (k, f, alt) => { const t = cs.w(k, f); return t === k ? alt() : t; };
    const fetchingLine = (b, f, why) => {
      const size = b !== null ? mb(b) : "", project = f && f.id ? f.title : "";
      const stand = () => `<b>${cs.w("screen.capture.address.working.head")}</b>${size ? " " + size : ""}${project ? " \u00b7 " + cs.w("capture.filed.project", { project }) : ""}`;
      /* the row's sentence needs both fills; a capture with no size stated or no project to file under keeps the stand-in, which says neither */
      const head = size && project ? keyed("screen.capture.fetch.pending", { size, project }, stand) : stand();
      const wh = why ? cs.w("screen.capture.fetch.why", { why: String(why) }) : "";
      return `<p class="mk-note" role="status" data-fetching>${head}${wh && wh !== "screen.capture.fetch.why" ? " " + wh : ""}</p>`;
    };
    /* G2 (B31): a session whose owed fetch ended with a stated refusal lists it as `failed`; it is drawn from that reason at once, in the refusal's words */
    /* N1 (fix round 9; K4853, K4855): the failed line names its document, by its address (as the unfinished line does), so it is never a sentence among unrelated presses
       that names nothing; and it is listed for a day (the failure's own instant when the listing states one, else when the fetch began), as the ruling has it */
    const failedLine = (reason, c) => `<p class="cs-state" data-state="failed" role="alert" data-fetch-failed>${c && c.locator ? `<span class="mk-data" data-fetch-address>${cs.esc(String(c.locator))}</span> \u00b7 ` : ""}${view.parts.refusalHtml(cs, { code: String(reason) }) || cs.w("refusal.FETCH_FAILED")}</p>`;
    const staleFailure = (c) => { const fp = c.fetch_pending || {}; const at = Date.parse(String(fp.failed_at || fp.since || c.started || "")); return Number.isFinite(at) && (cs.now ? cs.now() : Date.now()) - at > 86400000; };
    /* G2 (DEC-418): the finished line, `screen.capture.fetch.done` ({document}, {project}). G108 (fix round 8): a capture filed under no project (or under one whose name
       is not known) has nothing to fill {project} with, so it is not drawn with an empty fill: the nearest held row stands in, `screen.capture.address.done` (the
       document, where it waits); the row owed is named in the job record (K4269). */
    const fetchedLine = (g) => {
      /* P25: bytes the team already held are said as R49 says them ("already in the record as <title>", linked), never as a capture this press made */
      if (g.existed) return said("screen.capture.address.existed", { title: bare(g.title) }) + made(g);
      const doc = { html: cs.ref("document", g.bundleId, g.title || g.bundleId, []) };
      const project = g.filed && g.filed.id && g.filed.title ? g.filed.title : "";
      const t = project ? cs.w("screen.capture.fetch.done", { document: doc, project }) : cs.w("screen.capture.address.done", { title: doc });
      return `<p class="mk-note" role="status" data-fetched>${t}</p>`;
    };
    /* G19 (fix round 6; S10), G110 (fix round 8): the supporting files a capture kept and skipped, as the plane counts them (`supporting: {kept, skipped, reasons}`):
       "N of M supporting files kept" (`screen.capture.supporting.kept`) and, for each distinct sentence, why the rest were not: a reason is drawn by its code's key
       (`CAP_REACHED` the cap, `TOO_LARGE` and `BUDGET_EXHAUSTED` too large, any other code unavailable), counts of codes sharing a sentence added, and the answer's
       `detail` (the renderer's or the browser's own words) is never drawn. Nothing is drawn when none was skipped. */
    const supportingLine = (g) => {
      const x = g && g.supporting;
      if (!x || !(x.skipped > 0)) return "";
      const total = x.kept + x.skipped;
      const why = view.parts.supportingReasons(x.reasons);
      const lines = ["cap", "toolarge", "unavailable"].filter((k) => why[k]).map((k) => `<p class="mk-small muted" data-supporting-why="${k}">${cs.w("screen.capture.supporting." + k, { n: String(why[k].n), cap: String(why[k].cap || 0) })}</p>`).join("");
      return `<div role="status" data-supporting><p class="mk-small">${cs.w("screen.capture.supporting.kept", { kept: String(x.kept), total: String(total) })}</p>${lines}</div>`;
    };
    /* R31 (N1094; DEC-240 D3): the member's own unfinished captures, each titled from the held document that holds its
       primary, else the address; drawn only when one is answered (R17), a read that failed drawn failed */
    const O = D.open;
    const heldRows = D.held && D.held.state === "ok" && D.held.value && Array.isArray(D.held.value.held) ? D.held.value.held : [];
    const unfinished = !O || O.state === "empty" ? "" : O.state !== "ok" ? cs.state(O, () => "")
      : (Array.isArray(O.value.captures) ? O.value.captures : []).filter((c) => !(c && U.ended && c.session === U.ended)).map((c) => {
        const row = heldRows.find((r) => r && r.capture && r.capture.sha256 === c.primary_sha);
        const title = (row && row.title) || String(c.locator || "");
        /* G2: a session being fetched (acquisition `fetch_pending`) has nothing to finish; it is said, once (the press's own line says it when this visit began it) */
        if (c.fetch_pending && typeof c.fetch_pending === "object") {
          /* G105 (fix round 8; acquisition R111): the stated refusal is the listing's `fetch_pending.failed` */
          const bad = c.fetch_pending.failed || c.failed;
          if (bad) return staleFailure(c) ? "" : failedLine(bad, c);
          return U.captured && U.captured.fetching && U.captured.fetching.session === c.session ? "" : fetchingLine(Number.isFinite(c.fetch_pending.declared_bytes) ? c.fetch_pending.declared_bytes : null, null, c.fetch_pending.why);
        }
        return `<p class="mk-note" role="status">${cs.w("capture.unfinished", { title, n: c.outstanding, ago: { html: cs.date(c.started) } })} `
          + cs.act("acquire", { label: "capture.finish", data: { session: c.session, locator: String(c.locator || ""), title } }) + "</p>";
      }).join("");
    /* R38 (A64): pressing the capture act asked `heldat` first; an address the record already holds is drawn beside the address
       with nothing captured. The compared copy is named by its title from the vouched list (R40), who captured it by the handle
       `memberlist` gives (a member stamp's id with its `member:` prefix removed) and the day by `cs.date`; no sentence of the
       drawing is invented where the table holds no word (the "captured by" line, "nothing was added", the undetermined row). */
    const A = U.a64;
    let a64 = "";
    if (A && A.looking) a64 = `<p class="cs-state" data-state="loading" role="status">${cs.w("state.loading")}</p>`;
    else if (A && A.failed !== undefined) a64 = `<p class="cs-state" data-state="failed" role="alert">${A.failed || cs.w("shell.unread")}</p>`;
    else if (A) {
      const plain = (t) => String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const copy = A.copy || {};
      const vouched = D.held && D.held.state === "ok" && D.held.value && Array.isArray(D.held.value.held) ? D.held.value.held : [];
      const row = vouched.find((r) => r && r.bundle_id === copy.document);
      /* G75 (fix round 7): the compared copy's name is the row's title, else the chain a delivery names a document by (its host and the day), never "Untitled capture" for a copy whose host and day are known */
      /* G109 (fix round 8): the stored title `heldat` answers for exactly this wins (R54), then the vouched list's row, then the chain */
      const title = view.parts.heldTitle(cs, { ...(row || { source: { address: copy.address || U.address || "", retrieved: copy.retrieved } }), ...(typeof copy.title === "string" && copy.title.trim() ? { title: copy.title } : {}) });
      const who = String(copy.actor || "").replace(/^member:/, "");
      const open = cs.ref("document", copy.document, plain(cs.w("screen.capture.openit")), [plain(cs.w("screen.capture.openit.help"))]);
      const by = who && copy.retrieved ? cs.w("screen.capture.a64.captured_by", { name: { html: person(who) }, date: { html: cs.date(copy.retrieved) } }) : "";
      const said_ = A.state === "unchanged" ? [cs.w("screen.capture.a64.the_site_still_gives_the_same_document"), cs.w("screen.capture.a64.nothing_added")]
        : A.state === "undetermined" ? [cs.w("screen.capture.a64.undetermined")] : [];
      const held = cs.row(cs.icon("accepted"), `${cs.w("screen.capture.a64.already_in_the_record_as")} <span class="rec">${cs.esc(title)}</span>`
        + ([by, ...said_].filter(Boolean).length ? `<span class="meta">${[by, ...said_].filter(Boolean).join(" · ")}</span>` : ""), open);
      const leave = `<a class="cs-btn" data-tone="quiet" href="/app/capture/address${at.id ? "/" + encodeURIComponent(at.id) : ""}" data-nav data-level="1" data-tip="${cs.w("screen.capture.leaveit.help")}">${cs.w("screen.capture.leaveit")}</a>`;
      /* R49 (C9): the copy filed in this project as well says so, where it stays held; a filing the plane refused is drawn in its words */
      /* R38 (fix round 5, E7; K4530): the held copy's reading, when the press asked for it: what it now holds, that it follows, or why it could not be asked */
      const rd = A.reading;
      const readNote = !rd ? "" : rd.refused !== undefined ? `<p class="cs-state" data-state="failed" role="alert">${rd.refused}</p>`
        : rd.pending ? pendingLine({ readingPending: true }) : rd.present ? readDrawn(rd) : `<p class="mk-note" role="status" data-reading="unread">${cs.w("screen.document.text.unread")} ${cs.w("screen.document.text.unread.next")}</p>`;
      const filedNote = (A.alsoHere ? `<p class="mk-note" role="status">${filedLine(A)}</p>` : "") + (A.refused ? `<p class="cs-state" data-state="failed" role="alert">${A.refused}</p>` : "") + readNote;
      a64 = A.state === "unchanged" ? cs.sheet(held) + filedNote
        : cs.sheet(held + (A.state === "changed" ? cs.row(cs.icon("changed"), `<b>${cs.w("screen.capture.a64.the_site_has_changed_since")}</b><span class="meta">${cs.w("screen.capture.a64.your_team_holds_a_capture_from_14_septem", { date: { html: copy.retrieved ? cs.date(copy.retrieved) : "" } })}</span>`)
          + cs.row(cs.icon("clock"), `${cs.w("screen.capture.a64.capturing_it_again_keeps_the_new_copy_be")} ${cs.w("screen.capture.a64.whoever_cited_the_old_one_stays_on_it_un")}`) : ""))
          + filedNote + `<div class="mk-acts">${cs.act("acquire", { label: "screen.capture.a64.capture_the_new_copy", data: { again: "1" } })}${leave}</div>`;
    }
    /* R45 (C19; DEC-375): keep the page as the site sent it or as a visitor saw it (`render: true`); the web-archive capture is
       refused to members, so it is told and offered nothing */
    const keep = cs.checks("ci-render", "screen.watching.sweepdef.match", [["site", "screen.capture.render.keep.site", !U.render], ["visitor", "screen.capture.render.keep.visitor", !!U.render]], { radio: true })
      + `<p class="mk-small muted">${cs.w("screen.capture.render.keep.explain1")} ${cs.w("screen.capture.render.keep.explain2")}</p>`
      + `<details class="mk-details"><summary>${cs.w("screen.capture.archive.summary")}</summary><p class="mk-small">${cs.w("screen.capture.archive.explain1")} ${cs.w("screen.capture.archive.explain2")}</p></details>`;
    /* R50 (A1, A2): the working line from the press until the answer; the result is a status line under the button */
    const working = U.working ? `<p class="mk-note" role="status" data-working><b>${cs.w("screen.capture.address.working.head")}</b> ${cs.w("screen.capture.address.working")}</p>` : "";
    /* G72 (fix round 7): "Finish it" on a capture the plane no longer holds (`NO_SUCH_SESSION`: finished, closed or expired) says so in a status line and the
       Unfinished line leaves; the design's row `refusal.NO_SUCH_SESSION` (DEC-425) is the sentence */
    const closedLine = U.closed ? `<p class="mk-note" role="status" data-closed>${cs.w("refusal.NO_SUCH_SESSION")}</p>` : "";
    /* R31 (fix round 5, E8; K4530): "Finish it" says what the continuation answered: the visitor copy still being made, its supporting files fetched
       with nothing new filed (each in the nearest held row's words, K4269), or the visitor copy filed (a new document, below) */
    const finishLine = (g) => `<p class="mk-note" role="status" data-finish="${g.finish}">${cs.w(g.finish === "pending" ? "acquisition.index.render_pending_note" : "acquisition.note.continuation_files_new")}</p>`;
    const result = (got && got.fetching ? fetchingLine(got.fetching.bytes, got.filed, got.fetching.why) : got ? (got.finish === "pending" || got.finish === "files" ? finishLine(got) : got.archive
        ? said("screen.capture.address.archive", { filed: got.filed })
          + (got.notPromoted ? said("screen.capture.address.notpromoted", { count: got.notPromoted }) : "")
        : (got.fetched ? fetchedLine(got)
          : (got.finish === "done" ? `<p class="mk-note" role="status" data-finish="done">${cs.w("screen.capture.address.done", { title: bare(got.title) })}</p>`
          : said(got.existed ? "screen.capture.address.existed" : "screen.capture.address.done", { title: bare(got.title) })) + made(got)) + supportingLine(got)
          /* a render still being made and an attestation not yet answered, in the plane's own notes; the capture is kept */
          + [got.renderNote ? cs.esc(got.renderNote) : "", got.attestNote ? cs.w("screen.capture.attest.pending") : ""].filter(Boolean).map((n) => `<p class="mk-small muted" role="status">${n}</p>`).join("") + pendingLine(got)) : "")
      + refusedPromotion("address");
    /* R47 (C20; DEC-381): "A source that asked for a login": each request a source turned away for a login, a username and a secret
       field (the secret is typed into a password field, sent once and never drawn back), the login given and the request tried
       again, a retry by itself, the stored logins and their withdrawal. No secret, length or digest is ever drawn. */
    const R = D.later;
    const turned = R && R.state === "ok" && R.value && Array.isArray(R.value.requests) ? R.value.requests.filter((r) => r && r.source_reason === "login" && r.state === "refused") : [];
    const stored = (Array.isArray(U.logins) ? U.logins : []).filter((e) => e && !e.withdrawn_at);
    const credNote = U.credDone
      ? (U.credDone.refused !== undefined ? `<p class="cs-state" data-state="failed" role="alert">${U.credDone.refused}</p>` : "") : "";
    /* R47 (C20; DEC-381): "A source that asked for a login": each request a source turned away for a login, a username and a secret
       field (the secret is typed into a password field, sent once and never drawn back), the login given and the request tried again,
       or a retry by itself. No secret, length or digest is ever drawn. */
    const credSec = !turned.length ? "" : cs.sec("screen.capture.cred.head",
      `<p class="mk-small">${cs.w("screen.capture.cred.why1")} ${cs.w("screen.capture.cred.why2")}</p>`
        + cs.sheet(turned.map((r) => cs.row(cs.icon("refused"), `<b>${cs.w("screen.capture.cred.turned", { source: { html: `<span class="mk-data">${cs.esc(r.host || "")}</span>` } })}</b>`,
          "", (planeOf(r) && r.requested_at ? cs.w("screen.capture.cred.askedby", { name: { html: person(planeOf(r)) }, date: { html: cs.date(r.requested_at) }, count: Number(r.attempts) || 0 })
            : [person(planeOf(r)), r.requested_at ? cs.date(r.requested_at) : ""].filter(Boolean).join(" \u00b7 ")))).join(""))
        + cs.field("cc-user", "screen.capture.cred.user", { autocomplete: "off" })
        + cs.field("cc-secret", "screen.capture.cred.secret", { type: "password", autocomplete: "off", help: ["screen.capture.cred.sealed1", "screen.capture.cred.sealed2"] })
        + turned.map((r) => `<div class="mk-acts">${cs.act("capturecredentialsupply", { tone: "primary", data: { request: r.request, host: r.host } })}${cs.act("capturerequestretry", { label: "screen.capture.cred.retry", data: { request: r.request } })}</div>`).join("")
        + `<p class="mk-small muted">${cs.w("screen.capture.cred.only1")} ${cs.w("screen.capture.cred.only2")}</p>`
        + credNote,
      { help: ["screen.capture.cred.tip1", "screen.capture.cred.tip2"] });
    /* FC-23, C78, C94 (DEC-403; screens-intake R57, proposed): "Logins for sites", the capture screen's own section. "Show the stored logins"
       lists each login's site, what it asks for, who may use it and who gave it and when (the giver by the shell's name and address for
       her, never her id), each with "Withdraw this login", or says none; its explanation sits directly under its own button; "Give a
       login for a site" stores one with no refused request needed (kind, site, secret, who may use it, and the project for "This
       project"). Nothing is listed or said before the button is pressed; no secret, length or digest is ever drawn. */
    const projectForLogin = /^PROJ-/.test(at.id) ? at.id : U.forq && U.forq.state === "ok" && U.forq.value && U.forq.value.id ? U.forq.value.id : "";
    const loginKind = (k) => cs.w("screen.capture.logins.kind." + (["login", "user-agent", "other"].includes(k) ? k : "other"));
    const loginScope = (x) => cs.w("screen.capture.logins.scope." + (["group", "member", "project"].includes(x) ? x : "group"));
    const loginRows = stored.map((e) => cs.row(cs.icon("accepted"),
      `<b class="mk-data">${cs.esc(e.host || "")}</b><span class="meta">${cs.w("screen.capture.logins.row", { kind: { html: loginKind(e.kind) }, scope: { html: loginScope(e.scope) },
        member: { html: person(e.supplied_by) }, date: { html: e.supplied_at ? cs.date(e.supplied_at) : "" } })}</span>`,
      cs.act("capturecredentialwithdraw", { tone: "quiet", data: { credential: e.credential } }))).join("");
    const give = !cs.can("capturecredentialsupply") ? "" : `<details class="mk-details"><summary>${cs.w("screen.capture.logins.give")}</summary>`
      + cs.field("cl-host", "screen.capture.logins.site", { help: "screen.capture.logins.site.help", autocomplete: "off" })
      + cs.choice("cl-kind", "screen.capture.logins.kind", [["login", "screen.capture.logins.kind.login"], ["user-agent", "screen.capture.logins.kind.user-agent"], ["other", "screen.capture.logins.kind.other"]], { value: "login" })
      + cs.choice("cl-scope", "screen.capture.logins.scope", [["group", "screen.capture.logins.scope.group"], ["member", "screen.capture.logins.scope.member"],
          ...(projectForLogin ? [["project", "screen.capture.logins.scope.project"]] : [])], { value: "group", help: "screen.capture.logins.scope.help" })
      + cs.field("cl-name", "screen.capture.logins.name", { autocomplete: "off" })
      + cs.field("cl-secret", "screen.capture.logins.secret", { type: "password", autocomplete: "off", help: ["screen.capture.cred.sealed1", "screen.capture.cred.sealed2"] })
      + `<div class="mk-acts">${cs.act("capturecredentialsupply", { label: "screen.capture.logins.store", tone: "primary", data: { general: "1", project: projectForLogin } })}</div></details>`;
    const loginsSec = !cs.can("capturecredentiallist") && !give ? "" : cs.sec("screen.capture.logins.head",
      `<p class="mk-small">${cs.w("screen.capture.logins.about1")} ${cs.w("screen.capture.logins.about2")} ${cs.w("screen.capture.logins.about3")}</p>`
      + `<div class="mk-acts">${cs.act("capturecredentiallist")}</div>`
      + `<p class="mk-small muted">${cs.w("screen.capture.cred.listnote1")} ${cs.w("screen.capture.cred.listnote2")}</p>`
      + (Array.isArray(U.logins) ? (stored.length ? cs.sheet(loginRows) : `<p class="mk-small" data-state="none">${cs.w("screen.capture.logins.none")}</p>`) : "")
      + give);
    /* R55 (DEC-394 3c): "Your requests for later": the member's own capture requests (`capturerequests`, the one read that also serves
       R47), each with where it stands: waiting to be fetched, captured, or turned away by its source. None to list draws no section. */
    const meId = view.me && view.me.member ? String(view.me.member) : "";
    const mineLater = R && R.state === "ok" && R.value && Array.isArray(R.value.requests) && meId
      ? R.value.requests.filter((r) => r && String(planeOf(r)).replace(/^member:/, "") === meId && ["requested", "draining", "captured", "refused"].includes(r.state)) : [];
    /* N4: once the member has asked for the list, an empty one says so (`screen.capture.later.none`); before the ask, and with none, nothing is drawn */
    const noneLater = cs.w("screen.capture.later.none");
    const laterSec = !mineLater.length && !U.laterAsked ? "" : cs.sec("screen.capture.later.head", `<p class="mk-small">${cs.w("screen.capture.later.about")}</p>`
      + (!mineLater.length ? `<p class="mk-small" data-state="none">${noneLater}</p>` : cs.sheet(mineLater.map((r) => {
        const st = r.state === "captured" ? "captured" : r.state === "refused" ? "turned" : "waiting";
        return cs.row(cs.icon(st === "captured" ? "accepted" : st === "turned" ? "refused" : "clock"), `<b class="mk-data">${cs.esc(r.address || r.host || "")}</b>`, "",
          [cs.w("screen.capture.later." + st), r.requested_at ? cs.date(r.requested_at) : ""].filter(Boolean).join(" \u00b7 "));
      }).join(""))));
    body = cs.field("ci-address", "screen.capture.address.label", { help: "screen.capture.address.help", value: U.address || "" })
      + forq
      + keep
      + (watch && cs.can("monitorset") ? `<p class="mk-small">${cs.w("screen.capture.address.watchabout")}</p>`
        + cs.choice("ci-freq", "screen.capture.address.freq", freqs.map((f) => [f, `screen.capture.address.freq.${f}`]), { value: U.frequency || "weekly" }) : "")
      + `<div class="mk-acts">${cs.act("acquire", { tone: "primary" })}${cs.act("capturerequest")}${watch ? `${cs.act("monitorset")}${cs.act("monitor")}` : ""}</div>`
      + working
      + closedLine
      + result
      + unfinished
      + a64
      + credSec
      + loginsSec
      + laterSec
      + (cs.can("capturerequests") ? `<div class="mk-acts">${cs.act("capturerequests")}</div>` : "")
      + (U.requested ? said(U.requested.drains === false ? "screen.capture.address.requested.waits" : "screen.capture.address.requested",
        { address: U.requested.address }) : "")
      + (U.watching ? said("screen.capture.address.watching", { title: U.watching.title, frequency: cs.w(`screen.capture.address.freq.${U.watching.frequency}`) }) : "")
      + (U.checked ? `<p class="mk-note" role="status">${view.parts.checkOutcome(cs, U.checked.answer, U.checked.title)}</p>` : "")
      + `<p class="mk-note">${cs.w("screen.capture.address.note")}</p>`;
  } else if (tab === "file") {
    const how = [["made", "screen.capture.file.how.made"], ["handed", "screen.capture.file.how.handed"],
                 ["sent", "screen.capture.file.how.sent"], ["downloaded", "screen.capture.file.how.downloaded"]];
    body = cs.field("ci-file", "screen.capture.file.choose", { type: "file", help: "screen.capture.file.choosehelp", capture: "environment",
        accept: "image/*,video/*,audio/*,application/pdf,text/*,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods,.zip" })
      + `<p class="mk-small muted">${cs.w("photo.reminder")}</p>`
      + `<div class="cs-field"><fieldset class="mk-checks"><legend>${cs.w("screen.capture.file.how")}</legend>`
      + how.map(([k, w]) => `<label><input type="radio" id="ci-how-${k}" name="ci-how" value="${k}"> ${cs.w(w)}</label>`).join("")
      + "</fieldset></div>"
      + `<p class="mk-small muted">${cs.w("screen.capture.file.downloaded")} <span style="display:inline-flex;align-items:center;max-width:100%"><a class="cs-ref" href="/app/capture/address${at.id ? "/" + encodeURIComponent(at.id) : ""}" data-nav>${cs.w("screen.capture.file.toaddress")}</a></span></p>`
      + cs.field("ci-where", "screen.capture.file.where", { help: "screen.capture.file.wherehelp", value: U.where || "" })
      + cs.field("ci-what", "screen.capture.file.what", { area: true, rec: true, value: U.what || "" })
      + `<div class="mk-acts">${cs.act("captureupload", { tone: "primary", label: "act.captureupload.label.capture" })}</div>`
      /* capture R113 (fix round 9): a file sent in parts shows where it is: the file being checked (hashed), then part n of m; a refusal that ended it is drawn
         in its words; the nearest held row stands in until the design's (K4269) */
      + (U.parted ? (U.parted.failed ? `<p class="cs-state" data-state="failed" role="alert" data-parted="failed">${U.parted.failed}</p>`
        : `<p class="mk-note" role="status" data-parted="${U.parted.phase}">${U.parted.phase === "hashing"
          ? keyedW("screen.capture.file.parts.hashing", {}, () => cs.w("state.loading"))
          : keyedW("screen.capture.file.parts.sending", { n: String(Math.min(U.parted.total, U.parted.done + 1)), m: String(U.parted.total) },
              () => `${cs.w("state.loading")} ${Math.min(U.parted.total, U.parted.done + 1)} / ${U.parted.total}`)}</p>`) : "")
      + (U.uploaded ? said(U.uploaded.existed ? "screen.capture.file.existed" : "screen.capture.file.done", { name: bare(U.uploaded.name) }) + made(U.uploaded) + readLine(U.uploaded) : "")
      + refusedPromotion("file")
      + `<p class="mk-note">${cs.w("screen.capture.file.note")}</p>`;
  } else {
    const draft = U.draft;
    /* R10 (N987): the draft is filled into the words field it asks for (`cs.fill`, in `doneWritingHelp`), labelled as
       the assistant's, asked by this member; the field keeps its id, and only the member's own `testify` keeps it */
    body = `<p class="mk-note">${cs.w("screen.capture.saw.note")}</p>`
      + cs.field("ci-words", "screen.capture.saw.words", { area: true, rec: true, value: U.words || "",
        ...(draft ? { draft: "screen.capture.saw.draft", draftFills: { handle: draft.handle } } : {}) })
      + (draft && draft.untested ? `<p class="mk-small muted" data-label="untested">${cs.w("ai.label.untested")}</p>` : "")
      + (view.reachable ? `<div class="mk-acts">${cs.act("writinghelp", { label: "act.writinghelp.label.capture" })}</div>`
        + `<p class="mk-small muted">${cs.w("screen.capture.help.only")}</p>` : "")
      + cs.field("ci-where", "screen.capture.saw.where", { value: U.where || "" })
      + cs.field("ci-when", "screen.capture.saw.when", { help: "screen.capture.saw.whenhelp", value: U.when || "" })
      + `<p class="mk-small muted">${cs.w("photo.reminder")}</p>`
      + `<div class="mk-acts">${cs.act("testify", { tone: "primary" })}</div>`
      + (U.testified ? said("screen.capture.saw.done", { id: { html: U.testified.id ? cs.ref("document", U.testified.id, bare(U.testified.text) || plainText(cs.w("shell.card.document")).replace(/<[^>]*>/g, ""), []) : cs.esc(bare(U.testified.text)) } }) : "")
      + `<p class="mk-note">${cs.w("screen.capture.saw.after")}</p>`;
  }
  return `<div class="mk-h">${cs.title()}<p class="mk-sub">${cs.w("screen.capture.sub")}</p></div>`
    + forqNote
    + `<nav class="mk-tabs2" role="tablist" aria-label="${cs.w("screen.capture.tabs")}">${tabs}</nav>`
    /* C91 (R44, R46): the doors to the watched addresses and to leads, for a member or an administrator who may act on the record */
    + (cs.can("capturerequest") ? `<div class="mk-acts"><a class="cs-btn" data-tone="quiet" href="/app/watching" data-nav>${cs.w("screen.watching.name")}</a>`
      + `<a class="cs-btn" data-tone="quiet" href="/app/leads" data-nav>${cs.w("screen.leads.name")}</a></div>` : "")
    + `<div data-tab="${tab}">${body}</div>`;
}

/* R1: `acquire` with the address. Its five refusals each in its own sentence (`refusals`, by key beside the address, R25),
 * any other by shell R13; an empty address is `capture.fieldneeded` with the field's label (R25). R38: the press first asks
 * `heldat` (`check: true`, the member's deliberate act) and goes on to `acquire` only when the answer says the address is not
 * held, or when the member chose "Capture the new copy"; a copy already held is drawn and nothing is sent; a `heldat` refused,
 * unanswered or answering `held: null` is drawn failed beside the address and `acquire` is not sent. */
async function sendAcquire(view, el, cs) {
  /* R31: "Finish it" resumes the session (`continue`, acquisition R12): its primary is not fetched again */
  const session = el && el.dataset ? String(el.dataset.session || "") : "";
  const begin = () => { cs.set("captured", null); cs.set("closed", false); cs.set("working", true); cs.later(90000, (k, v) => { if (v && v.ui && v.ui.working) k.set("working", false); }); };
  if (session) {
    cs.set("address", String(el.dataset.locator || ""));
    cs.set("finishing", { session, title: String(el.dataset.title || "") });
    cs.set("a64", null);
    /* R31 (E8): the earlier capture's result is cleared at the press, so what is drawn next is what this press was answered */
    begin();
    return { body: { continue: session } };
  }
  cs.set("finishing", null);
  const address = String(cs.value("ci-address") || "").trim();
  if (!address) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.address.label") } } };
  cs.set("address", address);
  /* R29 (N1117; acquisition R47): opened from a question, the chosen question rides as `for`; the file tab and a capture
     with no subject send none, and no `capturerequest` is made for it */
  const chosen = view.parts.forOf(view).id;
  const question = /^INQ-/.test(chosen) ? String(cs.value("ci-for") || chosen).trim() : "";
  const body = question ? { locator: address, for: question } : { locator: address };
  /* G2 (fix round 6; K4562): a capture too large for the request is fetched afterwards and filed under the project the page names, so the project rides */
  if (chosen) {
    const f = await view.parts.filedFor(view, cs);
    /* G74 (fix round 7): a project the member is neither in nor invited to takes nothing from her: no look, no fetch, nothing filed */
    if (f && f.id && f.member === false) { const nm = view.parts.notMemberWords(cs, f); return { refuse: nm.key, fills: nm.fills }; }
    if (f && f.id) body.project = f.id;
  }
  /* R45: the page as a visitor saw it is asked for only when that is chosen; the site's own copy sends no `render` */
  const visitor = cs.value("ci-render-1") === true;
  if (visitor) body.render = true;
  cs.set("render", visitor);
  if (el && el.dataset && el.dataset.again === "1") { cs.set("a64", null); begin(); return { body }; }
  cs.set("a64", { looking: true });
  const asked = await cs.call("heldat", { query: { address, check: "true" } });
  const r = asked && asked.result && typeof asked.result === "object" ? asked.result : asked;
  if (!r || r.ok === false || typeof r.held !== "boolean") { cs.set("a64", { failed: r && r.ok === false ? view.parts.refusalHtml(cs, r) : "" }); return null; }
  if (r.held === false) { cs.set("a64", null); begin(); return { body }; }
  const state = r.changed && (r.changed.state === "unchanged" || r.changed.state === "changed") ? r.changed.state : "undetermined";
  const copy = r.copy && typeof r.copy === "object" ? r.copy : {};
  /* R49 (C9): no acquire is sent, so this is the whole of the press: the copy the team holds is filed in the page's project here, by the
     step the done path uses. A site that has changed waits for the member's choice ("Capture the new copy" or "Leave it"): nothing is filed. */
  const more = state === "changed" ? {} : await view.parts.filedHeld(view, cs, copy, String(copy.sha256 || ""));
  /* R38 (fix round 5, E7; K4530): the same press repairs a held copy that has no text: its reading is asked for (the member's own "Read it") */
  const again = state === "changed" ? {} : await view.parts.repairedReading(view, cs, copy);
  cs.set("a64", { state, copy, ...(more.alsoHere ? { filed: more.filed, alsoHere: more.alsoHere } : {}), ...(more.refused ? { refused: more.refused } : {}), ...again });
  return null;
}

/* R38 (fix round 5, E7; K4530; extraction R27, R80): a held copy of the address whose reading holds no text (none, or a failed one) is read now: the press sends
 * `readheld` for the copy's digest, once, and says what the owner answered, the text now held (the reading read again, so the words drawn are those in
 * `text_units`), that the reading follows (`owed`, `reading_pending`), or why it could not be asked, in the nearest held row's words. A copy that holds text, a
 * reading that could not be read and a digest that is not one send nothing. Answers `{}` or `{reading}`: `{read, words, wordsRead, wordsTotal}` (readingOf's),
 * `{pending: true}` or `{refused: html}`. */
async function repairedReading(view, cs, copy) {
  const sha = String((copy && copy.sha256) || "");
  if (!/^[0-9a-f]{64}$/.test(sha)) return {};
  const body = (a) => (a && typeof a.result === "object" && a.result ? a.result : a);
  const seen = body(await cs.call("reading", { query: { sha256: sha } }));
  if (!seen || seen.ok === false || typeof seen.found !== "boolean" || (seen.found && !Array.isArray(seen.text_units))) return {};
  if (seen.text_units && seen.text_units.some((u) => u && String(u.text || "").trim())) return {};
  const asked = body(await cs.call("readheld", { body: { sha } }));
  if (!asked || asked.ok === false) return { reading: { refused: (asked && view.parts.refusalHtml(cs, asked)) || cs.w("shell.unread") } };
  if (asked.reading_pending === true || asked.owed === true) return { reading: { pending: true } };
  if (asked.read === false && (asked.why === "NO_WHOLE_OBJECT" || asked.why === "NO_HOME")) return { reading: { refused: cs.w(asked.why === "NO_HOME" ? "refusal.CAPTURE_NOT_HELD" : "transcribe.why.evidenceabsent") } };
  const now = body(await cs.call("reading", { query: { sha256: sha } }));
  return { reading: view.parts.readingOf(now && now.ok !== false ? now : {}, {}) };
}

/* R50 (C11): a refused or unanswered `acquire` ends the press at once: the working note it raised is cleared, and the refusal the shell
 * draws beside the act is not lost to the redraw that clearing it causes (interface-shell R21). */
function failedAcquire(view, answer, cs) { cs.set("working", false); }

/* R1 (N747; control-plane R58): an answer that carries `promoted` (an archive the door already promoted) is not
 * promoted again; any other new document is promoted here as an information bundle at `collected` (`promoteDocument`,
 * R23's files included), filed under the project the subject names (R22). A refusal of either step is drawn on the tab. */
async function doneAcquire(view, answer, cs) {
  const a = answer || {}, doc = a.document || {};
  /* G72 (fix round 7): "Finish it" answered `NO_SUCH_SESSION` (the plane dropped the session when its work ended): the capture is closed. The press ends, the
     session leaves the Unfinished line at once and the line says so; the act's `rereads` ask `opencaptures` again, which no longer lists it. */
  if (a.ok === false && String(a.reason || a.code || "") === "NO_SUCH_SESSION") {
    const gone = String(a.session || (view.ui && view.ui.finishing && view.ui.finishing.session) || "");
    cs.set("working", false);
    cs.set("finishing", null);
    cs.set("captured", null);
    cs.set("ended", gone);
    cs.set("closed", true);
    return;
  }
  const address = String((view.ui && view.ui.address) || "");
  /* R54: the document is named by its own title, else its file name, else its host and the day (`titleOf`) */
  const fin = view.ui && view.ui.finishing;
  const finished = !!(fin && fin.session);
  const title = finished && fin.title ? fin.title : view.parts.titleOf(cs, { reading: a.reading, doc, address });
  const sha = doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : "";
  /* R57: the answer's own `reading_pending` (a reading that did not fit the door's bound), or the promotion's (the door reads after `promote`) */
  /* G7 (fix round 6): "the reading follows" is drawn only when the answer carries no reading of its own */
  const waiting = a.reading_pending === true && !view.parts.readingOf(a, doc).own;
  /* a render still being made (`render_pending`) and an attestation that had not answered (`attestation_attempts[].pending`) are said
     as they stand: the render in the plane's own note, the attestation by `screen.capture.attest.pending` (R71, D-M6); the capture is kept either way */
  const rp = doc.render_pending && typeof doc.render_pending === "object" ? doc.render_pending : a.render_pending && typeof a.render_pending === "object" ? a.render_pending : null;
  const later = (Array.isArray(doc.attestation_attempts) ? doc.attestation_attempts : []).find((x) => x && x.pending === true);
  /* G19 (fix round 6; S10): the plane's count of the supporting files kept and skipped */
  const supporting = a.supporting && typeof a.supporting === "object" ? a.supporting : doc.supporting && typeof doc.supporting === "object" ? doc.supporting : null;
  const pend = { ...(supporting ? { supporting } : {}), renderNote: rp && typeof rp.note === "string" ? rp.note : "", attestNote: !!later };
  cs.set("working", false);
  cs.set("promoteRefused", null);
  /* R31: a continuation (`continued`) files nothing new: its supporting files join the capture it resumed */
  cs.set("finishing", null);
  /* G2 (fix round 6; K4562; acquisition fetch_pending): a capture too large to wait for answers at once with no document: it is said what and why, `opencaptures`
     is polled, and the finished line draws the document the delivery filed; nothing is promoted here (`promoteDocument` is never sent an empty document) */
  const fp = a.fetch_pending && typeof a.fetch_pending === "object" ? a.fetch_pending : null;
  if (fp && !a.document) {
    const f = await view.parts.filedFor(view, cs);
    const t = view.parts.titleOf(cs, { doc: {}, address });
    cs.set("captured", { title: t, address, bundleId: null, sha: "", filed: f && f.id ? f : null,
                         fetching: { session: String(fp.session || ""), bytes: Number.isFinite(fp.declared_bytes) ? fp.declared_bytes : null, why: typeof fp.why === "string" ? fp.why : "" } });
    view.parts.watchFetch(cs, { session: String(fp.session || ""), address, title: t, filed: f && f.id ? f : null, finish: "", since: Date.parse(String(fp.since || "")) });
    return;
  }
  /* R31 (E8): what a continuation answered: the visitor copy still being made (`render.state`), or its supporting files fetched; either files no new document */
  if (a.continued) {
    const pending = finished && a.render && a.render.state === "pending";
    cs.set("captured", { title, address, bundleId: null, sha, ...pend, ...(finished ? { finish: pending ? "pending" : "files" } : {}) });
    /* G3 (fix round 6): "Finish it" answers at once; the visitor copy is filed afterwards, so the same poll draws the finished line */
    if (pending) view.parts.watchFetch(cs, { session: fin.session, address, title, filed: null, finish: "done" });
    return;
  }
  if (Array.isArray(a.promoted)) {
    cs.set("captured", { archive: true, filed: a.promoted.length, notPromoted: Array.isArray(a.not_promoted) ? a.not_promoted.length : 0, title, address,
                         bundleId: typeof a.bundleId === "string" ? a.bundleId : null });
    return;
  }
  /* R49 (L3; K4194; C9): `existed: true` says the object store held the bytes, not that a document the viewer can see does. The
     record is asked (`heldat`, no `check`: nothing is fetched) for the document that holds the sha as this viewer sees it: one that
     shows is linked and no document is written (the question chosen was sent as `for`, so the plane has recorded the capture as made
     for it, acquisition R47); none that shows is promoted for the viewer below, as a new capture is. */
  if (a.existed === true) {
    const copy = await view.parts.copyOf(cs, sha);
    if (copy) {
      /* R49 (C9; capture R100, R101): a capture from a project's page whose document is held under another project's home is also filed
         in this project, as a reference, and the result says so; the document keeps its home and is linked, and shown once */
      const more = await view.parts.filedHeld(view, cs, copy, sha);
      if (more.refused) cs.set("promoteRefused", { tab: "address", html: more.refused });
      cs.set("captured", { existed: true, title: typeof copy.title === "string" && copy.title.trim() ? copy.title.replace(/\s+/g, " ").trim().slice(0, 200) : title, address, bundleId: copy.document, sha, ...pend, ...(waiting ? { readingPending: true } : {}), ...(more.alsoHere ? { filed: more.filed, alsoHere: more.alsoHere } : {}) });
      if (waiting && sha) view.parts.watchReading(cs, { sha });
      return;
    }
  }
  const filed = await view.parts.filedFor(view, cs);
  if (filed === null) { cs.set("promoteRefused", { tab: "address", html: "" }); return; }
  if (filed.member === false) { cs.set("promoteRefused", { tab: "address", html: (() => { const nm = view.parts.notMemberWords(cs, filed); return cs.w(nm.key, nm.fills); })() }); return; }
  const made = await view.parts.promoteDocument(cs, { doc, title, locator: address, project: filed.id });
  if (made.refused !== undefined) { cs.set("promoteRefused", { tab: "address", html: await view.parts.refusedHtml(view, cs, made.refused) }); return; }
  const follows = waiting || (made.readingPending && !view.parts.readingOf(a, doc).own);
  cs.set("captured", { title, address, bundleId: made.bundleId, filed, sha, ...pend, ...(finished ? { finish: "done" } : {}), ...(follows ? { readingPending: true } : {}) });
  if (follows && sha) view.parts.watchReading(cs, { sha });
}

/* G2, G3 (fix round 6): the working line of a capture finished after the answer. `opencaptures` is asked again by `cs.later` (4 s, then 15 s) while the
 * session is listed; once it has left the list the record is asked for the copy at the address (`heldat`, no `check`: nothing is fetched) and the finished line
 * draws the document the delivery filed (`finish: "done"` for "Finish it", else the capture's own result); a copy not held on three asks in a row is
 * `refusal.FETCH_FAILED` beside the act. The poll ends when the member leaves the screen (the shell cancels the timer) or starts another capture. */
function watchFetch(cs, o, n = 0, missed = 0) {
  cs.later(n < 10 ? 4000 : 15000, async (k, v) => {
    const g = v && v.ui && v.ui.captured;
    if (!g || !(g.fetching ? g.fetching.session === o.session : g.finish === "pending")) return;
    const again = (m) => v.parts.watchFetch(k, o, n + 1, m);
    const body = (x) => (x && typeof x.result === "object" && x.result ? x.result : x);
    const list = body(await k.call("opencaptures", { query: {} }));
    if (!list || list.ok === false || !Array.isArray(list.captures)) return again(missed);
    const mine = list.captures.find((c) => c && c.session === o.session);
    /* B31: the owed fetch ended with a stated refusal and the session was kept with `failed`: said at once, in the refusal's words */
    const bad = mine && ((mine.fetch_pending && mine.fetch_pending.failed) || mine.failed);
    if (bad) {
      k.set("ended", o.session);
      k.set("captured", null);
      const holder = typeof (mine.fetch_pending && mine.fetch_pending.holder) === "string" ? mine.fetch_pending.holder : "";
      const words = holder ? await v.parts.refusedHtml(v, k, { code: String(bad), holder }) : v.parts.refusalHtml(k, { code: String(bad) });
      k.set("promoteRefused", { tab: "address", html: `<span class="mk-data" data-fetch-address>${k.esc(String(o.address || ""))}</span> \u00b7 ${words || k.w("refusal.FETCH_FAILED")}` });
      return;
    }
    if (mine) return again(0);
    /* the copy the record shows at the address (`heldat`, no `check`) */
    const h = body(await k.call("heldat", { query: { address: o.address } }));
    const copy = h && h.ok !== false && h.held === true && h.copy && typeof h.copy.document === "string" ? h.copy : null;
    if (!copy) {
      if (missed + 1 < 3) return again(missed + 1);
      /* the list the screen read before is stale: this session is over, whatever it says */
      k.set("ended", o.session);
      k.set("captured", null);
      k.set("promoteRefused", { tab: "address", html: `<span class="mk-data" data-fetch-address>${k.esc(String(o.address || ""))}</span> \u00b7 ${k.w("refusal.FETCH_FAILED")}` });
      return;
    }
    k.set("ended", o.session);
    /* G109 (fix round 8): the delivered document is named by the title it was stored under (`heldat`'s `copy.title`), else the press's own */
    k.set("captured", { title: typeof copy.title === "string" && copy.title.trim() ? copy.title.replace(/\s+/g, " ").trim().slice(0, 200) : o.title, address: o.address, bundleId: copy.document, sha: String(copy.sha256 || ""), filed: o.filed,
      /* P25 (fix round 9; K4855; R49): a copy the record already held when the fetch began (it was captured before the fetch's own `since`, both the plane's clock) is said as the inline path says an existing
         document: "already in the record", with its title and link; one this fetch delivered is the finished line */
      ...(o.finish ? { finish: o.finish } : Number.isFinite(o.since) && Date.parse(String(copy.retrieved || "")) < o.since ? { fetched: true, existed: true } : { fetched: true }) });
  });
}

/* R65 (G135f; K4831 (5)): the job row of a capture whose reading follows. `op=reading` (a member's read, by digest; control-plane R135) answers the row's state
 * beside the stored reading; it is asked once at once and then on the page's clock while the row is queued, being fetched or being read: every 20 seconds at first,
 * then every 30 (a request every few seconds starves the object's alarm, control-plane's record), at most forty asks, and not at all once another capture or upload
 * has replaced this one on the screen. The answer is kept as `job:<sha>` and `pendingLine` draws it; an answer that states no state (no row for the digest, or one
 * the viewer may not see) is kept, and the line stays the stored reading's. */
function watchReading(cs, o, n = 0) {
  cs.later(n === 0 ? 0 : n < 4 ? 20000 : 30000, async (k, v) => {
    const shown = (v.ui.captured && v.ui.captured.sha === o.sha) || (v.ui.uploaded && v.ui.uploaded.sha === o.sha);
    if (!shown) return;
    const x = await k.call("reading", { query: { sha256: o.sha } });
    const a = x && typeof x.result === "object" && x.result ? x.result : x;
    const again = () => { if (n < 40) v.parts.watchReading(k, o, n + 1); };
    if (!a || a.ok === false) return again();
    k.set("job:" + o.sha, a);
    const st = a.job && typeof a.job.state === "string" ? a.job.state : "";
    if (st === "queued" || st === "fetching" || st === "reading" || (st === "" && n < 3)) again();
  });
}

/* R49 (C9, C10): the document the viewer may see that holds these bytes, asked of the record by the capture's digest (`heldat`, no
 * `check`: nothing is fetched). "" when the record shows none, the digest is not one, or the read is refused. */
async function homeOf(cs, sha) {
  const copy = await copyOf(cs, sha);
  return copy ? copy.document : "";
}

/* R49 (C9): the copy `heldat` answers for the digest (its `document` and `project`), or null when the record shows none. */
async function copyOf(cs, sha) {
  if (typeof sha !== "string" || !sha) return null;
  const held = await cs.call("heldat", { query: { sha256: sha } });
  const h = held && held.result && typeof held.result === "object" ? held.result : held;
  return h && h.ok !== false && h.held === true && h.copy && typeof h.copy.document === "string" ? h.copy : null;
}

/* R49 (C9; capture R100, R101): the one step that files a found document for this page, called from both paths that find one: the done
 * path (`acquire` answered `existed: true`, then `heldat` by digest) and the pre-flight (R38: `heldat` with `check` found the address held,
 * so no acquire is sent). The subject project (R22) files a found document held under another project: `captureseenin` with the capture's
 * digest and that project, the member's own act (the plane stamps her). Nothing is sent with no subject project, for a question that
 * states none or could not be read, for a digest that is not one, or when the document's home is the subject project (it is listed there
 * already). Answers `{}` (nothing filed), `{filed, alsoHere: {home}}` (`home` the home project's name, "" where it has none or the plane
 * names none) or `{refused}` (the plane's refusal in words, `refusalHtml`). */
async function filedHeld(view, cs, copy, sha) {
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return {};
  const filed = await view.parts.filedFor(view, cs);
  if (!filed || !filed.id || copy.project === filed.id) return {};
  const asked = await cs.call("captureseenin", { body: { captureSha: sha, project: filed.id } });
  const a = asked && asked.result && typeof asked.result === "object" ? asked.result : asked;
  if (!a || a.ok !== true) return { refused: view.parts.refusalHtml(cs, a) || cs.w("shell.unread") };
  const homeId = typeof a.home === "string" && a.home ? a.home : typeof copy.project === "string" ? copy.project : "";
  const home = homeId ? await view.parts.projectOf(cs, homeId) : null;
  return { filed, alsoHere: { home: (home && home.title) || "" } };
}

/* R49 (C9): a promotion's refusal in words (`refusalHtml`). Bytes that have another home (`CAPTURE_HELD_BY_ANOTHER_BUNDLE`, provenance
 * R2) name the holder and link it where the plane names it (the holder's title, read from its bundle; `shell.card.document` where it
 * cannot be read), and say so without a name or link where it does not. */
async function refusedHtml(view, cs, r) {
  const html = view.parts.refusalHtml(cs, r);
  const holder = r && typeof r.holder === "string" ? r.holder : "";
  if (!holder || String(r.code || r.reason || "") !== "CAPTURE_HELD_BY_ANOTHER_BUNDLE") return html;
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  let title = "";
  try {
    const got = await cs.call("image", { query: { id: holder } });
    const x = got && typeof got.result === "object" && got.result ? got.result : got;
    const front = x && typeof x["bundle.md"] === "string" ? x["bundle.md"].split(/\n---\s*\n/)[0] : "";
    const m = /^title:\s*(.*?)\s*$/m.exec(front || "");
    title = m ? m[1].replace(/^["']|["']$/g, "") : "";
  } catch (e) { title = ""; }
  return `${html} ${cs.ref("document", holder, title || plain(cs.w("shell.card.document")).replace(/<[^>]*>/g, ""), [])}`;
}

/* R14 (capture-requests R56): "Ask for this later" is the member's own request: `capturerequest` with the address and no
 * `run`. Its answer's `drains: false` is said: the request waits until the group's Civicsmith captures unattended. */
function sendCaptureRequest(view, el, cs) {
  const address = String(cs.value("ci-address") || "").trim();
  if (!address) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.address.label") } } };
  return { body: { address } };
}
function doneCaptureRequest(view, answer, cs) {
  cs.set("requested", { address: String(cs.value("ci-address") || "").trim(), drains: !(answer && answer.drains === false) });
}

/* R22, R36: where the subject files a capture: the project and question the page read once (kept in page memory) when it
 * is read, else read now. Null when the question could not be read. */
async function filedFor(view, cs) {
  const id = view.parts.forOf(view).id, M = view.ui && view.ui.forq;
  if (M && M.id === id && M.state === "ok") return M.value;
  return view.parts.projectOf(cs, id);
}

/* R14, R16: the document the address was captured into: this visit's capture of it (the acquire's bundle), else the held or
 * vouched document whose source is that address (`heldcaptures`, `state: "held_and_vouched"`, R40). Null when none is known: watching asks a captured address. */
async function bundleFor(view, cs, address) {
  const got = view.ui && view.ui.captured;
  if (got && got.address === address && typeof got.bundleId === "string" && got.bundleId) return { bundleId: got.bundleId, title: got.title };
  /* G20 (fix round 6; S11): every held and vouched document is looked at, a page of 1,000 at a time by the read's own `next`, never the first page alone
     (at most 100 pages, 100,000 documents, a bound the read itself would have to exceed) */
  let after = "";
  for (let page = 0; page < 100; page++) {
    const a = await cs.call("heldcaptures", { query: { limit: 1000, state: "held_and_vouched", ...(after ? { after } : {}) } });
    const v = a && a.result && typeof a.result === "object" ? a.result : a;
    const rows = v && Array.isArray(v.held) ? v.held : [];
    const r = rows.find((x) => x && x.source && (x.source.address === address || x.source.locator === address));
    if (r && typeof r.bundle_id === "string") return { bundleId: r.bundle_id, title: r.title || address };
    if (!v || v.truncated !== true || typeof v.next !== "string" || !v.next) return null;
    after = v.next;
  }
  return null;
}

/* R14, R16: "Watch this address": `monitorset` with `enabled: true` and the frequency chosen (a word of `MONITOR_FREQ`).
 * Its refusals (`NOT_MONITORED`, `NO_LOCATOR`, `MONITOR_SET_REFUSED`) are the shell's (R13). */
async function sendMonitorSet(view, el, cs) {
  const address = String(cs.value("ci-address") || "").trim();
  if (!address) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.address.label") } } };
  const freq = ["daily", "weekly", "monthly", "hourly", "per_meeting"].find((f) => f === cs.value("ci-freq")) || "weekly";
  const found = await view.parts.bundleFor(view, cs, address);
  if (!found) return { refuse: "screen.capture.address.watchafter" };
  cs.set("frequency", freq);
  cs.set("target", found);
  return { body: { bundleId: found.bundleId, enabled: true, frequency: freq } };
}
function doneMonitorSet(view, answer, cs) {
  const t = (view.ui && view.ui.target) || {};
  cs.set("watching", { title: t.title || "", frequency: (answer && answer.frequency) || (view.ui && view.ui.frequency) || "weekly" });
  cs.set("checked", null);
}

/* R16: "Check it now": `monitor` alone, on the same document. */
async function sendMonitor(view, el, cs) {
  const address = String(cs.value("ci-address") || "").trim();
  if (!address) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.address.label") } } };
  const found = await view.parts.bundleFor(view, cs, address);
  if (!found) return { refuse: "screen.capture.address.watchafter" };
  cs.set("target", found);
  return { body: { bundleId: found.bundleId } };
}
function doneMonitor(view, answer, cs) {
  cs.set("checked", { title: (view.ui && view.ui.target && view.ui.target.title) || "", answer: answer || {} });
}

/* R42 (C55; K4164: one owner): what a check found, drawn from the answer's `status` (`modified`, `removed`, `unchanged`) and, when
 * it names none, its `note` (`monitoring` R10): four different sentences, never "Checked just now" for every outcome. The one
 * drawing of it: `screens-inquiry` imports `checkOutcome` for the document page and draws nothing of its own. Answers the
 * sentence's HTML. */
function checkOutcome(cs, answer, title) {
  const a = answer && typeof answer === "object" ? answer : {};
  const st = a.status === "modified" || a.status === "removed" || a.status === "unchanged" ? a.status : "unknown";
  const t = String(title || "");
  return cs.w("screen.capture.address.checked." + st, st === "unknown" ? { title: t, note: typeof a.note === "string" ? a.note : "" } : { title: t });
}
/* R67 (fix round 9; K4969): the one classification of a capture's `supporting.reasons`, for every screen that states why supporting files were not kept
   (the Add screen's line, screens-inquiry's Document page): by code, `CAP_REACHED` with a `limit` the cap, `TOO_LARGE` and `BUDGET_EXHAUSTED` too large, any other
   code unavailable; a reason's `count` summed (else 1); a non-object skipped. A kind with no reason is absent. */
function supportingReasons(reasons) {
  const why = {};
  for (const r of Array.isArray(reasons) ? reasons : []) {
    if (!r || typeof r !== "object") continue;
    const code = String(r.reason || r.code || ""), n = Number.isFinite(r.count) && r.count > 0 ? r.count : 1;
    const kind = code === "CAP_REACHED" && Number.isFinite(r.limit) ? "cap" : code === "TOO_LARGE" || code === "BUDGET_EXHAUSTED" ? "toolarge" : "unavailable";
    why[kind] = why[kind] || (kind === "cap" ? { n: 0, cap: r.limit } : { n: 0 });
    why[kind].n += n;
  }
  return why;
}
export { checkOutcome, heldTitle, supportingReasons };

/* R2: the upload. `statement` composed from the three answers in order, each with its label, at most 2,000 characters;
 * nothing is sent while one is empty, and the screen says which. The file's bytes are the raw body (control-plane R72),
 * under the session header. */
async function sendUpload(view, el, cs) {
  const file = cs.file("ci-file");
  const choice = ["made", "handed", "sent", "downloaded"].find((k) => cs.value(`ci-how-${k}`) === true);
  const where = String(cs.value("ci-where") || "").trim(), what = String(cs.value("ci-what") || "").trim();
  if (!file || typeof file.name !== "string") return { refuse: "screen.capture.file.nofile" };
  const missing = [!choice && "screen.capture.file.how", !where && "screen.capture.file.where", !what && "screen.capture.file.what"].filter(Boolean);
  if (missing.length) return { refuse: "screen.capture.file.missing", fills: { fields: { html: missing.map((k) => cs.w(k)).join(", ") } } };
  const statement = [`${cs.w("screen.capture.file.how")}: ${cs.w(`screen.capture.file.how.${choice}`)}`,
                     `${cs.w("screen.capture.file.where")}: ${where}`, `${cs.w("screen.capture.file.what")}: ${what}`]
    .join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  if (Array.from(statement).length > 2000) return { refuse: "screen.capture.file.toolong", fills: { count: Array.from(statement).length } };
  /* G74 (fix round 7): the same for a file: bytes are not sent for a project the member is neither in nor invited to */
  if (view.parts.forOf(view).id) { const f = await view.parts.filedFor(view, cs); if (f && f.id && f.member === false) { const nm = view.parts.notMemberWords(cs, f); return { refuse: nm.key, fills: nm.fills }; } }
  /* R27 (control-plane R100): the file's declared media type rides beside `statement` and `name`; an empty type sends none */
  const query = { statement, name: file.name };
  if (typeof file.type === "string" && file.type) query.type = file.type;
  /* R34: the file's name and declared type are kept as the act is sent; `doneUpload` uses them, never the input read afterwards. The file itself and the
     composed query are kept for a parted upload (R2, fix round 9; capture R113), which is the same upload sent in parts. */
  const sent = { name: file.name, type: typeof file.type === "string" ? file.type : "", file, query };
  cs.set("sent", sent);
  /* capture R113 (fix round 9; G127f; K4891, K4899): a file past the request-body ceiling goes in parts through the Worker. The page decides by size before the first
     request, for a file above `PARTS_FROM` (the platform's edge refuses a body over its cap before the Worker runs, so no cue could come back from it; K4930), and takes the cue from a `TOO_LARGE` that carries `in_parts: true` (`failedUpload`). It sends nothing here: the parted upload is the
     page's own loop, and draws its progress under the act row. `PARTS_FROM` is this act's own threshold, when to send in parts, and not a read ceiling; it sits
     under the edge's 104,857,600 B request-body cap so that no one-request upload ever nears it (BOB, K4930: no row, it stays here). */
  const PARTS_FROM = 64 * 1048576;
  if (file.size > PARTS_FROM) { view.parts.sendInParts(view, cs); return null; }
  return { query, raw: file };
}
/* capture R113 (fix round 9; G127f; K4891, K4899): the act's `failed` hook. A `TOO_LARGE` that carries `in_parts: true` is capture's cue that the file is one the
 * request cannot carry whole: the same upload is begun in parts. Any other refusal is the shell's, drawn beside the act as before. */
function failedUpload(view, answer, cs) {
  const f = answer && answer.fields && typeof answer.fields === "object" ? answer.fields : {};
  if (answer && answer.code === "TOO_LARGE" && f.in_parts === true && view.ui && view.ui.sent && view.ui.sent.file) view.parts.sendInParts(view, cs);
}

/* An incremental SHA-256 (SubtleCrypto cannot hash a stream, and the whole file's digest must be known before its first part is sent, capture R113): `update(bytes)`
 * as many times as there are chunks, then `hex()`. The standard algorithm, 64-byte blocks in 32-bit words; the length is counted in bytes. Self-contained: the page
 * serves each function alone. */
function sha256Hasher() {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64), tail = new Uint8Array(64);
  let fill = 0, count = 0;
  const block = (u, o) => {
    for (let i = 0; i < 16; i++) W[i] = (u[o + 4 * i] << 24) | (u[o + 4 * i + 1] << 16) | (u[o + 4 * i + 2] << 8) | u[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15], y = W[i - 2];
      W[i] = (W[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + W[i - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  };
  const feed = (u) => {
    let i = 0;
    if (fill) { while (fill < 64 && i < u.length) tail[fill++] = u[i++]; if (fill === 64) { block(tail, 0); fill = 0; } }
    for (; i + 64 <= u.length; i += 64) block(u, i);
    while (i < u.length) tail[fill++] = u[i++];
  };
  return {
    update(bytes) { const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); count += u.length; feed(u); },
    hex() {
      const pad = new Uint8Array((fill < 56 ? 56 : 120) - fill + 8), bits = count * 8;
      pad[0] = 0x80;
      const dv = new DataView(pad.buffer);
      dv.setUint32(pad.length - 8, Math.floor(bits / 4294967296));
      dv.setUint32(pad.length - 4, bits >>> 0);
      feed(pad);
      return Array.from(H, (x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
    },
  };
}

/* capture R113 (fix round 9; G127f; K4891, K4899; J47): the upload sent in parts. The page hashes the whole file first (the begin declares its digest, which the
 * completion checks against the hash of all the bytes), asks `captureuploadbegin` (digest, size, and the same `statement`, `name` and `type` the one-request upload
 * carries), then sends the parts in order, each exactly `part_bytes` (the last the remainder) with its own digest in the address, and completes with the parts'
 * digests in order: the answer is `captureupload`'s, handed to `doneUpload`. It draws its progress under the act row (`parted`: hashing, then part n of m).
 * It begins again once on `UPLOAD_LOST` (the object was restarted) or `UPLOAD_EXPIRED`, resumes at the `next` a `PART_OUT_OF_ORDER` names, tries a part again
 * on `PART_IN_PROGRESS` or when no answer came (three times), and aborts what it begun (`captureuploadabort`) when it stops the upload itself. Each part is a step
 * of the page's clock (`cs.later`), so a member who leaves the screen ends the loop: no further request is made, and the server's expiry and its abandoning of
 * a second begin of the same file clean up. A second press replaces this upload (the older loop stops). Nothing of the file is read but through the browser. */
async function sendInParts(view, cs) {
  const sent = view.ui && view.ui.sent;
  if (!sent || !sent.file || !sent.query) return;
  const file = sent.file, query = sent.query;
  const body = (x) => (x && typeof x.result === "object" && x.result ? x.result : x);
  const set = (p) => cs.set("parted", p);
  let k = cs;
  const alive = () => view.ui.sent === sent;
  const step = () => new Promise((resolve) => k.later(0, (kk) => { k = kk; resolve(); }));
  const ended = async (a, upload) => {
    if (upload) { try { await k.call("captureuploadabort", { body: { upload } }); } catch (e) { /* the server expires it */ } }
    set({ failed: (a && view.parts.refusalHtml(cs, a)) || cs.w("shell.unread") });
  };
  const step1 = (n, m, phase) => set({ phase, done: n, total: m });
  set({ phase: "hashing", done: 0, total: file.size });
  const whole = view.parts.sha256Hasher();
  const CHUNK = 4 * 1048576;
  for (let at = 0; at < file.size; at += CHUNK) {
    whole.update(new Uint8Array(await file.slice(at, Math.min(file.size, at + CHUNK)).arrayBuffer()));
    step1(Math.min(file.size, at + CHUNK), file.size, "hashing");
    await step();
    if (!alive()) return;
  }
  const wholeHex = whole.hex();
  let restarts = 0, tries = 0, upload = "", began = null, digests = [], at = 0;
  const begin = async () => {
    const q = { sha256: wholeHex, bytes: file.size, statement: query.statement, name: query.name, ...(query.type ? { type: query.type } : {}) };
    const a = body(await k.call("captureuploadbegin", { body: q }));
    if (!a || a.ok === false) { await ended(a, ""); return false; }
    upload = String(a.upload); began = a; digests = []; at = Number.isInteger(a.next) ? a.next : 0; tries = 0;
    return true;
  };
  if (!(await begin())) return;
  for (let i = 0; i < began.parts; ) {
    if (!alive()) return;
    const lo = i * began.part_bytes, slice = file.slice(lo, Math.min(file.size, lo + began.part_bytes));
    const h = view.parts.sha256Hasher();
    h.update(new Uint8Array(await slice.arrayBuffer()));
    const digest = h.hex();
    if (i < at) { digests[i] = digest; i++; continue; }          /* the server holds it already: only its digest is needed for the completion */
    step1(i, began.parts, "sending");
    await step();
    if (!alive()) return;
    const r = body(await k.call("captureuploadpart", { query: { upload, index: String(i), sha256: digest }, raw: slice }));
    if (r && r.ok !== false) { digests[i] = digest; i++; tries = 0; continue; }
    const code = r && String(r.code || r.reason || "");
    if ((code === "UPLOAD_LOST" || code === "UPLOAD_EXPIRED") && restarts++ < 1) { if (!(await begin())) return; i = 0; digests = []; continue; }
    if (code === "PART_OUT_OF_ORDER" && Number.isInteger(r.next) && r.next >= 0 && r.next < began.parts && tries++ < 3) { at = r.next; i = 0; continue; }
    if ((code === "PART_IN_PROGRESS" || !r) && tries++ < 3) continue;
    return ended(r, upload);
  }
  step1(began.parts, began.parts, "finishing");
  const done = body(await k.call("captureuploadcomplete", { body: { upload, parts: digests } }));
  if (!alive()) return;
  if (!done || done.ok === false) return ended(done, upload);
  set(null);
  await view.parts.doneUpload(view, done, k);
}

/* R21 (D9; capture R86, control-plane R72): an upload's answer is a provenance document; it is promoted as an information
 * bundle at `collected`, as R1 promotes `acquire`'s (`promoteDocument`), filed under the subject's project (R22). "It waits
 * in Held captures" is said only once that promotion answers; a refusal is drawn on the tab. An answer with `existed: true`
 * promotes nothing new. */
async function doneUpload(view, answer, cs) {
  const a = answer || {}, sent = (view.ui && view.ui.sent) || {};
  const name = typeof sent.name === "string" ? sent.name : "";
  cs.set("promoteRefused", null);
  cs.set("uploaded", null);
  const doc = a.document && typeof a.document === "object" ? a.document : null;
  const sha = typeof (a.capture && a.capture.sha256) === "string" ? a.capture.sha256 : doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : "";
  /* R49 (C10): bytes the store holds. The record is asked for the document the viewer sees that holds them: one that shows is linked
     and none is written. None that shows is promoted for the viewer when the answer carries the document to file; without it nothing
     is written (the plane answers `existed` with no document when it has already registered a home). */
  if (a.existed === true) {
    const copy = await view.parts.copyOf(cs, sha);
    if (copy) {
      const more = await view.parts.filedHeld(view, cs, copy, sha);
      if (more.refused) cs.set("promoteRefused", { tab: "file", html: more.refused });
      const owed = a.reading_pending === true && !view.parts.readingOf(a, doc || {}).own;
      cs.set("uploaded", { name, existed: true, bundleId: copy.document, title: name, sha, ...(owed ? { readingPending: true } : {}), ...(more.alsoHere ? { filed: more.filed, alsoHere: more.alsoHere } : {}) });
      if (owed && sha) view.parts.watchReading(cs, { sha });
      return;
    }
    if (!doc) { cs.set("uploaded", { name, existed: true, bundleId: null }); return; }
  }
  const filed = await view.parts.filedFor(view, cs);
  if (filed === null) { cs.set("promoteRefused", { tab: "file", html: "" }); return; }
  if (filed.member === false) { cs.set("promoteRefused", { tab: "file", html: (() => { const nm = view.parts.notMemberWords(cs, filed); return cs.w(nm.key, nm.fills); })() }); return; }
  /* R54: an upload is named by its file's name, or by the reading's title when the answer carries one and the file is a page */
  const isPage = /html/i.test(String(sent.type || "")) || /\.html?$/i.test(name);
  const title = view.parts.titleOf(cs, { reading: isPage ? a.reading : null, doc: {}, address: "", fileName: name || String((doc && doc.name_stated && doc.name_stated.text) || "") });
  const made = await view.parts.promoteDocument(cs, { doc: doc || {}, title, locator: String((doc && doc.locator) || ""), project: filed.id });
  if (made.refused !== undefined) { cs.set("promoteRefused", { tab: "file", html: await view.parts.refusedHtml(view, cs, made.refused) }); return; }
  /* R2 (C17): a project-less upload's result line says whether it was read (a picture, which way to have it read) */
  const reading = { ...view.parts.readingOf(a, doc || {}), picture: view.parts.pictureOf(doc, { type: sent.type, name }) };
  const follows = (a.reading_pending === true || made.readingPending) && !reading.own;
  cs.set("uploaded", { name, existed: false, bundleId: made.bundleId, title, filed, sha, reading, ...(follows ? { readingPending: true } : {}) });
  if (follows && sha) view.parts.watchReading(cs, { sha });
}

/* R2 (C17; control-plane R100, R117), R63, R64 (fix round 9; G135c, G135d): what became of the reading, from the answer: its `reading` (the answer's or its
 * document's) and the `text_units` beside it. `{read: false, present: false}` when the answer carries none. Else `present: true` and `read` only when the reading
 * HOLDS TEXT (`words` units with words in them, never merely a reading object: a failed or owed reading is not "read"), with `wordsRead`/`wordsTotal` (the
 * counts the reading states, else null), its `completeness`, the `failure` class it states (`final`, `transient`, `resource`), `owed: true` when it is owed
 * (`more`, `ocr_left`, `tier3_candidate`, or a failure that is tried again; the answer's own `reading_pending` is the screen's, `readingPending`), and the `refusal` it states of itself with its own figures
 * (`reason` and the `size`, `bound`, `part`, `kind`, `name`, `n` the owner measured) when its failure is final and names a reason. */
function readingOf(a, doc) {
  const r = a && a.reading && typeof a.reading === "object" ? a.reading : doc && doc.reading && typeof doc.reading === "object" ? doc.reading : null;
  if (!r) return { read: false, present: false, own: false };
  const units = Array.isArray(a && a.text_units) ? a.text_units : Array.isArray(doc && doc.text_units) ? doc.text_units : Array.isArray(r.text_units) ? r.text_units : [];
  const n = (k) => (Number.isInteger(r[k]) && r[k] >= 0 ? r[k] : null);
  const cmp = (a && a.completeness) || r.completeness;
  const words = units.filter((u) => u && String(u.text || "").trim()).length;
  const failure = typeof r.failure === "string" && ["final", "transient", "resource"].includes(r.failure) ? r.failure : "";
  const owed = r.more === true || (r.ocr_left !== undefined && r.ocr_left !== null && r.ocr_left !== false) || r.tier3_candidate === true || failure === "transient" || failure === "resource";
  const fig = (k) => (Number.isFinite(r[k]) && r[k] >= 0 ? { [k]: r[k] } : {});
  const txt = (k) => (typeof r[k] === "string" && r[k] ? { [k]: r[k].slice(0, 200) } : {});
  const refusal = failure === "final" && typeof r.reason === "string" && r.reason ? { reason: r.reason, ...fig("size"), ...fig("bound"), ...fig("n"), ...txt("part"), ...txt("kind"), ...txt("name") } : null;
  const cstate = cmp && typeof cmp === "object" && ["partial", "stated"].includes(cmp.state);
  const basis = typeof r.basis === "string" && r.basis.trim() ? { basis: r.basis.replace(/\s+/g, " ").trim().slice(0, 300) } : {};
  return { read: words > 0, present: true, ...basis, own: words > 0 || failure === "final" || !!refusal || !!cstate || n("words_total") !== null, words, wordsRead: n("words_read"), wordsTotal: n("words_total"),
           ...(cmp && typeof cmp === "object" && ["whole", "partial", "stated"].includes(cmp.state) ? { completeness: { state: cmp.state, ...(typeof cmp.why === "string" ? { why: cmp.why } : {}) } } : {}),
           ...(failure ? { failure } : {}), ...(owed ? { owed: true } : {}), ...(refusal ? { refusal } : {}) };
}

/* R63 (G135c; S18 (e)): whether the file is a picture, from the record first (the profile's format, the document's media type, the file's name) and the browser's
 * declared type last: a file whose declared type is empty or wrong is still the picture the record says it is. */
function pictureOf(doc, sent) {
  const p = doc && typeof doc.profile === "object" && doc.profile ? doc.profile : {};
  const fmt = typeof p.format === "string" ? p.format : p.format && typeof p.format === "object" ? String(p.format.format || p.format.name || p.format.id || p.format.kind || "") : "";
  const kinds = /(^|[^a-z])(png|jpe?g|gif|webp|tiff?|heic|heif|bmp|avif|ico|jp2|jpx|svg|image)([^a-z]|$)/i;
  if (kinds.test(fmt)) return true;
  const types = [p.source_content_type, doc && doc.capture && doc.capture.content_type, sent && sent.type].filter((t) => typeof t === "string");
  if (types.some((t) => /^image\//i.test(t))) return true;
  const name = String((sent && sent.name) || (doc && doc.name_stated && doc.name_stated.text) || "");
  return /\.(png|jpe?g|gif|webp|tiff?|heic|heif|bmp|avif|ico|jp2|svg)$/i.test(name);
}

/* R64 (G135d; S-8, CF-10, X28; K4831 (3)): a refusal drawn in its own sentence with its own figures, from what the owner states of it (`reason` and `size`, `bound`,
 * `part`, `kind`, `name`, `n`): `TOO_LARGE {size, bound}`, `STRUCTURE_OVER_BOUND {part, bound}`, `UNSUPPORTED_FORMAT {kind}`, `ENCODING_UNSUPPORTED {name}`,
 * `ENCRYPTED`. A byte figure is drawn in KB, MB or GB (a MB is 2^20 bytes), a count as the number; none is typed here. Each sentence is its own key
 * (`screen.capture.read.refused.<reason>`); until the design's rows reach the table the nearest held rows stand in (K4269) with the same figures. A cause with no
 * sentence is `shell.unread`. */
function readRefusalHtml(cs, f) {
  const keyedW = (k, fl, alt) => { const t = cs.w(k, fl); return t === k ? alt() : t; };
  const bytes = (n) => (!Number.isFinite(n) ? "" : n < 1024 ? cs.w("size.small") : n < 1048576 ? cs.w("size.kb", { n: String(Math.round(n / 1024)) })
    : n >= 1073741824 ? cs.w("size.gb", { n: (n / 1073741824).toFixed(1) }) : cs.w("size.mb", { n: (n / 1048576).toFixed(1) }));
  const reason = String((f && f.reason) || "");
  if (reason === "TOO_LARGE" && Number.isFinite(f.size) && Number.isFinite(f.bound))
    return keyedW("screen.capture.read.refused.TOO_LARGE", { size: bytes(f.size), bound: bytes(f.bound) },
      () => `${cs.w("screen.document.reading.stated", { size: bytes(f.size) })} <span class="mk-data" data-limit>${bytes(f.bound)}</span>`);
  if (reason === "STRUCTURE_OVER_BOUND" && Number.isFinite(f.bound))
    return keyedW("screen.capture.read.refused.STRUCTURE_OVER_BOUND", { part: String(f.part || f.name || ""), bound: String(f.bound) },
      () => `${cs.w("screen.document.reading.stated", { size: String(f.part || f.name || "") })} <span class="mk-data" data-limit>${String(f.bound)}</span>`);
  if (reason === "UNSUPPORTED_FORMAT") {
    /* R36 (fix round 10, G7; walk A7): the sentence the reading's owner holds for the kind (`reading-pipeline.index.unsupported_<kind>`: "GIF is not read yet."), the
       kind named in it; a kind it holds no sentence for is its `unsupported_kind` row with the kind filled; a refusal naming no kind is `shell.unread`. The design's own
       row, when it comes, wins (`screen.capture.read.refused.UNSUPPORTED_FORMAT`). Never the stand-in "picture unread" with the raw kind beside it. */
    const kind = String(f.kind || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    return keyedW("screen.capture.read.refused.UNSUPPORTED_FORMAT", { kind }, () => {
      const own = "reading-pipeline.index.unsupported_" + kind, general = "reading-pipeline.index.unsupported_kind";
      return kind && cs.w(own) !== own ? cs.w(own) : kind && cs.w(general, { kind }) !== general ? cs.w(general, { kind }) : cs.w("shell.unread");
    });
  }
  if (reason === "ENCODING_UNSUPPORTED")
    return keyedW("screen.capture.read.refused.ENCODING_UNSUPPORTED", { name: String(f.name || "") }, () => `${cs.w("shell.unread")}${f.name ? ` <span class="mk-data">${cs.esc(String(f.name))}</span>` : ""}`);
  if (reason === "ENCRYPTED" || reason === "PASSWORD_REQUIRED")
    return keyedW("screen.capture.read.refused.ENCRYPTED", {}, () => cs.w("refusal.ENCRYPTED"));
  return cs.w("shell.unread");
}

/* R65 (G135f): `op=reading`'s answer as the job row states it (control-plane R135, plane R97): `{state, written, skipped, owed, failed, rate, verdict}`, null
 * when it states no state (a digest with no row, or one the viewer may not see: `state: null`). The total is what the row counts (written, skipped, owed and
 * failed), so N of M is the row's, never a guess. */
function jobStateOf(a) {
  /* control-plane R135 (`job-state.mjs`): the job row's state is `job`, beside the stored reading in the same answer; `job.state` null when no row is left */
  const x = a && typeof a === "object" && a.job && typeof a.job === "object" ? a.job : null;
  const state = x && typeof x.state === "string" ? x.state : "";
  if (!["queued", "fetching", "reading", "partial", "refused", "finished", "final"].includes(state)) return null;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
  const written = num(x.written), owed = num(x.owed), skipped = num(x.skipped), failed = num(x.failed);
  const total = written !== null && owed !== null ? written + owed + (skipped || 0) + (failed || 0) : null;
  const v = x.verdict && typeof x.verdict === "object" ? x.verdict : null;
  return { state, written, owed, skipped, failed, total, rate: num(x.rate_per_s), verdict: v ? { size: num(v.size), limit: num(v.limit) } : null };
}

/* R65: the "about" estimate, in minutes, only once the row holds enough units written to measure a rate (ten) and states one; null before, so no time is promised
 * early. */
function estimateOf(job) {
  if (!job || job.written === null || job.written < 10 || !(job.rate > 0) || !(job.owed > 0)) return null;
  return Math.max(1, Math.ceil(job.owed / job.rate / 60));
}

/* R3: what the member saw or heard (`testify`): the words, with where in them, and when as `observedAt`. */
function sendTestify(view, el, cs) {
  const words = String(cs.value("ci-words") || "").trim(), where = String(cs.value("ci-where") || "").trim();
  const when = String(cs.value("ci-when") || "").trim();
  const missing = [!words && "screen.capture.saw.words", !where && "screen.capture.saw.where", !when && "screen.capture.saw.when"].filter(Boolean);
  if (missing.length) return { refuse: "screen.capture.saw.missing", fills: { fields: { html: missing.map((k) => cs.w(k)).join(", ") } } };
  const at = Date.parse(when);
  if (!Number.isFinite(at) || at > (cs.now ? cs.now() : Date.now())) return { refuse: "screen.capture.saw.badwhen" };
  const plain = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return { body: { words: `${words}\n\n${plain(cs.w("screen.capture.saw.wherein", { where }))}`, observedAt: new Date(at).toISOString().split(".")[0] + "Z" } };
}
function doneTestify(view, answer, cs) {
  /* C29: the result links the document made, named by the first of the member's own words (never the record number) */
  const told = String(cs.value("ci-words") || "").replace(/\s+/g, " ").trim();
  cs.set("draft", null);
  /* provenance testify answers `{ok, bundle_id, bundle_sha, capture_sha, …}` (K3171) */
  cs.set("testified", { id: (answer && typeof answer.bundle_id === "string" && answer.bundle_id) || "", text: Array.from(told).length > 80 ? Array.from(told).slice(0, 79).join("") + "\u2026" : told });
}

/* R3, R10: help wording the member's own account (`writinghelp`, DEC-153 (2)), drawn only while the assistant is
 * reachable; told only what the member typed. Its draft is filled into the words field by `cs.fill` (interface-shell
 * R27), labelled "Draft · the assistant's, asked by <handle>", with the test-instance label when the answer carries
 * `untested` (wizard-scripts R34). Nothing is kept until the member's own `testify`. */
function sendWritingHelp(view, el, cs) {
  const told = String(cs.value("ci-words") || "").trim();
  if (!told) return { refuse: "screen.capture.help.empty" };
  cs.set("where", cs.value("ci-where") || "");
  cs.set("when", cs.value("ci-when") || "");
  return { body: { op: "testify", field: "words", told } };
}
function doneWritingHelp(view, answer, cs) {
  const a = answer || {};
  const untested = a.untested === true || (typeof a.untested === "string" && a.untested !== "");
  cs.fill("ci-words", String(a.text || ""));
  cs.set("draft", { handle: (view.me && view.me.handle) || "", untested });
}

/* R47 (C20; DEC-381): "Give a login for this source and try again". The login is a username and a secret typed here, sent once as
 * `secret` ("user:secret", the form `capture-sources` R56 hands to Basic) for the refused request's host, at the team's scope; the
 * secret is read from its field and held nowhere else, never put in the page's state. Its refusals are drawn by the design's words. */
function sendCredentialSupply(view, el, cs) {
  /* FC-23 (DEC-403): "Store this login", from the logins section, needs no refused request: kind, site, secret, who may use it, and the project
     for "This project"; a login's secret is `username:secret`, any other kind's the secret alone */
  if (el && el.dataset && el.dataset.general === "1") {
    const host = String(cs.value("cl-host") || "").trim().toLowerCase();
    const kind = ["login", "user-agent", "other"].find((k) => k === cs.value("cl-kind")) || "login";
    const scope = ["group", "member", "project"].find((k) => k === cs.value("cl-scope")) || "group";
    const name = String(cs.value("cl-name") || "").trim(), secret = String(cs.value("cl-secret") || "");
    const project = String(el.dataset.project || "");
    if (!host) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.logins.site") } } };
    if (kind === "login" && !name) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.logins.name") } } };
    if (!secret) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.logins.secret") } } };
    if (scope === "project" && !project) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.logins.scope") } } };
    cs.set("credDone", null);
    cs.set("credFor", null);
    return { body: { kind, host, secret: kind === "login" ? `${name}:${secret}` : secret, scope, ...(scope === "project" ? { project } : {}) } };
  }
  const user = String(cs.value("cc-user") || "").trim(), secret = String(cs.value("cc-secret") || "");
  const host = el && el.dataset ? String(el.dataset.host || "") : "";
  const request = el && el.dataset ? String(el.dataset.request || "") : "";
  if (!user) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.cred.user") } } };
  if (!secret) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.capture.cred.secret") } } };
  cs.set("credDone", null);
  cs.set("credFor", { request, host });
  return { body: { kind: "login", host, secret: `${user}:${secret}`, scope: "group" } };
}
/* the login stored, the turned-away request goes back in the queue (`capturerequestretry`); a request its source did not turn
   away is refused in words and the login stays stored */
async function doneCredentialSupply(view, answer, cs) {
  const f = (view.ui && view.ui.credFor) || {};
  cs.set("credFor", null);
  /* the secret is typed once: the fields that held it are emptied as the login is stored, whatever it was stored for */
  cs.fill("cl-secret", ""); cs.fill("cl-name", ""); cs.fill("cc-secret", "");
  const a = f.request ? await cs.call("capturerequestretry", { body: { request: f.request } }) : null;
  const r = a && a.result && typeof a.result === "object" ? a.result : a;
  if (r && r.ok === false) { cs.set("credDone", { refused: view.parts.refusalHtml(cs, r) }); return; }
  cs.set("credDone", { retried: f.request });
  const l = await cs.call("capturecredentiallist", { body: {} });
  const v = l && l.result && typeof l.result === "object" ? l.result : l;
  if (v && Array.isArray(v.entries)) cs.set("logins", v.entries);
}
function doneCaptureRequests(view, answer, cs) { cs.set("laterAsked", true); }
function sendCredentialRetry(view, el, cs) {
  cs.set("credDone", null);
  return { body: { request: el && el.dataset ? String(el.dataset.request || "") : "" } };
}
function doneCredentialRetry(view, answer, cs) { cs.set("credDone", { retried: true }); }
function sendCredentialList() { return { body: {} }; }
function doneCredentialList(view, answer, cs) {
  const a = answer || {};
  cs.set("logins", Array.isArray(a.entries) ? a.entries : []);
}
function sendCredentialWithdraw(view, el, cs) {
  return { body: { credential: el && el.dataset ? String(el.dataset.credential || "") : "" } };
}
async function doneCredentialWithdraw(view, answer, cs) {
  const l = await cs.call("capturecredentiallist", { body: {} });
  const v = l && l.result && typeof l.result === "object" ? l.result : l;
  cs.set("logins", v && Array.isArray(v.entries) ? v.entries : []);
}
/* R47: the refusals of the three, by the design's words: a machine, the team's own Civicsmith, a request its source did not turn away */
const CRED_REFUSALS = Object.freeze({
  CAPTURE_CREDENTIAL_NOT_A_MEMBER: function (refusal, cs) { return cs.w("screen.capture.cred.ref.machine1") + " " + cs.w("screen.capture.cred.ref.machine2"); },
  CAPTURE_CREDENTIAL_OWN_HOST: function (refusal, cs) { return cs.w("screen.capture.cred.ref.own1") + " " + cs.w("screen.capture.cred.ref.own2"); },
});


export const CAPTURE_SCREEN = Object.freeze({
  id: "capture",
  reads: captureReads,
  render: renderCapture,
  parts: Object.freeze({ bundleFor, checkOutcome, copyOf, doneUpload, estimateOf, filedFor, filedHeld, forOf, heldTitle, homeOf, jobStateOf, notMemberWords, pictureOf, projectOf, promoteDocument, readProjectQuestions, readRefusalHtml, readingOf, refusalHtml, refusedHtml, repairedReading, sendInParts, sha256Hasher, supportingReasons, titleOf, watchFetch, watchReading }),
  acts: Object.freeze([
    Object.freeze({ op: "acquire", label: "act.acquire.label.capture", send: sendAcquire, done: doneAcquire, failed: failedAcquire, rereads: Object.freeze(["open"]),
                    /* G72: a session the plane no longer holds is the end of that capture, not a failure: `done` draws it (its line is the screen's own, so the note beside the act is empty) */
                    successCodes: Object.freeze(["NO_SUCH_SESSION"]),
                    refusals: Object.freeze({ NO_SUCH_SESSION: function () { return ""; }, /* control-plane R105, R116 (K4326): a timed-out capture says what was kept: held, undetermined, or (nothing) the base words */
                                              ACQUIRE_TIMED_OUT: function (refusal, cs) {
                                                const key = refusal && (refusal.kept === "held" || refusal.kept === "undetermined") ? "refusal.ACQUIRE_TIMED_OUT." + refusal.kept : "refusal.ACQUIRE_TIMED_OUT";
                                                return cs.w(cs.w(key) !== key ? key : "refusal.ACQUIRE_TIMED_OUT");
                                              },
                                              BAD_LOCATOR: "refusal.BAD_LOCATOR", SOURCE_REFUSED: "refusal.SOURCE_REFUSED",
                                              /* R29: `BAD_FOR` (not a question of the project's) beside the field, in the fold the design draws it in, open
                                                 whenever drawn, titled `capture.forquestion.refused.summary`; nothing was captured */
                                              BAD_FOR: function (refusal, cs) { return `<details class="mk-details" open><summary>${cs.w("capture.forquestion.refused.summary")}</summary>${cs.w("refusal.BAD_FOR")}</details>`; },
                                              FETCH_FAILED: "refusal.FETCH_FAILED", EMPTY: "refusal.EMPTY", TOO_LARGE: "refusal.TOO_LARGE" }) }),
    Object.freeze({ op: "capturerequest", label: "act.capturerequest.label.capture", send: sendCaptureRequest, done: doneCaptureRequest, rereads: Object.freeze(["later"]) }),
    Object.freeze({ op: "monitorset", label: "act.monitorset.label.capture", send: sendMonitorSet, done: doneMonitorSet, rereads: Object.freeze([]) }),
    Object.freeze({ op: "monitor", label: "act.monitor.label.capture", send: sendMonitor, done: doneMonitor, rereads: Object.freeze([]) }),
    Object.freeze({ op: "captureupload", label: "act.captureupload.label.capture", send: sendUpload, done: doneUpload, rereads: Object.freeze([]), reasonField: "statement",
                    failed: failedUpload,
                    refusals: Object.freeze({ UPLOAD_NO_STATEMENT: "screen.capture.refusal.UPLOAD_NO_STATEMENT", EMPTY: "screen.capture.refusal.upload.EMPTY",
                                              /* R64 (G135d): the door's 413 carries the file's size and the limit (`size`, `bound`), and is drawn with them in KB, MB or GB; a refusal with neither is the sentence alone;
                                                 one that carries `in_parts: true` is capture's cue (R113), answered by the parted upload beginning, so it says the upload goes on */
                                              TOO_LARGE: function (refusal, cs) {
                                                const f = refusal || {};
                                                if (f.in_parts === true) return cs.w("state.loading");
                                                const base = cs.w("screen.capture.refusal.upload.TOO_LARGE");
                                                if (!Number.isFinite(f.size) || !Number.isFinite(f.bound)) return base;
                                                const sz = (n) => (n < 1024 ? cs.w("size.small") : n < 1048576 ? cs.w("size.kb", { n: String(Math.round(n / 1024)) }) : n >= 1073741824 ? cs.w("size.gb", { n: (n / 1073741824).toFixed(1) }) : cs.w("size.mb", { n: (n / 1048576).toFixed(1) }));
                                                const t = cs.w("screen.capture.refusal.upload.TOO_LARGE.figures", { size: sz(f.size), bound: sz(f.bound) });
                                                return t !== "screen.capture.refusal.upload.TOO_LARGE.figures" ? t : `${base} <span class="mk-data" data-limit>${sz(f.size)} \u00b7 ${sz(f.bound)}</span>`;
                                              },
                                              MEMBER_SESSION_REQUIRED: "screen.capture.refusal.MEMBER_SESSION_REQUIRED" }) }),
    Object.freeze({ op: "capturecredentialsupply", label: "act.owed_capturecredentialsupply.label.capture", send: sendCredentialSupply, done: doneCredentialSupply, rereads: Object.freeze(["later"]), refusals: CRED_REFUSALS }),
    Object.freeze({ op: "capturerequestretry", label: "act.capturerequestretry.label.capture", send: sendCredentialRetry, done: doneCredentialRetry, rereads: Object.freeze(["later"]),
                    refusals: Object.freeze({ CAPTURE_REQUEST_NOT_RETRYABLE: function (refusal, cs) { return cs.w("screen.capture.cred.ref.notretry"); } }) }),
    Object.freeze({ op: "capturerequests", label: "act.capturerequests.label.capture", send: () => ({ query: { limit: 50 } }), done: doneCaptureRequests, rereads: Object.freeze(["later"]) }),
    Object.freeze({ op: "capturecredentiallist", label: "act.owed_capturecredentiallist.label.capture", send: sendCredentialList, done: doneCredentialList, rereads: Object.freeze([]) }),
    Object.freeze({ op: "capturecredentialwithdraw", label: "act.owed_capturecredentialwithdraw.label.capture", send: sendCredentialWithdraw, done: doneCredentialWithdraw, rereads: Object.freeze([]) }),
    Object.freeze({ op: "testify", label: "act.testify.label.capture", send: sendTestify, done: doneTestify, rereads: Object.freeze([]), reasonField: "words" }),
    Object.freeze({ op: "writinghelp", label: "act.writinghelp.label.capture", send: sendWritingHelp, done: doneWritingHelp, rereads: Object.freeze([]), reasonField: "told" }),
  ]),
});
