/* The `open-file` screen (R5, R6, R9; DEC-168, DEC-173; K1888, K1892), at `/app/open-file/<capture's SHA-256>`.
 * Self-contained functions over the kit `cs` (interface-shell R21 (1)). Nothing here keeps, in the browser or in any
 * request beyond the op's own, which member opened which file (R9): `ui` lives in page memory only, and every request is
 * one of the ops, carrying the capture's digest and nothing of the member's but the session header. */

import { leftOutLine } from "../screens-intake-rounds/index.mjs";

/* R5: the reads for the capture; `scanstatus` is an administrators' read (file-safety R5), read only for a session that
 * administers (K2996 Q7), as an act refused to the session is not drawn (interface-shell R12). */
function openFileReads(view) {
  const sha = typeof view.subject === "string" ? view.subject.toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(sha)) return {};
  const q = { capture: sha };
  return { threat: { op: "threatof", query: q }, state: { op: "originalstate", query: q },
           notes: { op: "verdictnotes", query: q, empty: (v) => !v || !Array.isArray(v.notes) || !v.notes.length },
           findings: { op: "scanfindings", query: { limit: 1000 } },
           /* R36 (U12b): who captured it, to tell a file the viewer added from one the team's Civicsmith fetched */
           accounts: { op: "captureaccounts", query: q },
           ...(view.me && view.me.administer === true ? { status: { op: "scanstatus", query: {} } } : {}) };
}

/* R5: one of the states, drawn from what `threatof` and `originalstate` answer: held (a scan hold), low, or high. */
function renderOpenFile(cs, view) {
  const sha = typeof view.subject === "string" ? view.subject.toLowerCase() : "";
  /* R20: opened bare or at no digest, the shell's own "Nothing is here" (interface-shell R35, R61) with the way back */
  if (!/^[0-9a-f]{64}$/.test(sha)) return `<h1 class="t-title">${cs.w("shell.unavailable.nothing.title")}</h1><p class="cs-state" data-state="empty" data-unavailable="nothing">${cs.w("shell.unavailable.nothing.says")}</p>`
    + `<p><a class="cs-btn" data-tone="quiet" href="/app" data-nav>${cs.w("shell.unavailable.home")}</a></p>`;
  const head = `<div class="mk-h">${cs.title()}</div>`;
  const U = view.ui || {}, D = view.data || {};
  const said = (k, f) => `<p class="mk-note" role="status">${cs.w(k, f)}</p>`;
  /* R6, R39: a refusal beside the act: a code's word by key, the answer's own words as data, or the shell's "could not be read" */
  const refused = U.refused ? `<p class="cs-state" data-state="failed" role="alert">${U.refused.key ? cs.w(U.refused.key) : U.refused.text ? cs.esc(U.refused.text) : cs.w("shell.unread")}</p>` : "";
  /* R36 (DEC-289 (1); file-safety R6): a file the viewer added (her member id is among the capture's actors) and which the
     team's Civicsmith did not fetch; its checks are said in words and the original never opens before a check */
  const actors = D.accounts && D.accounts.state === "ok" && D.accounts.value && Array.isArray(D.accounts.value.actors) ? D.accounts.value.actors : [];
  const addedBy = view.me && view.me.member ? actors.some((x) => x && String(x.actor || "").replace(/^member:/, "") === view.me.member) : false;
  /* R53: a scan note's line by key: its tool and its result are each a word by key, never the note's raw text; a key the
     words do not hold draws the shell's "could not be read". Only a note that has scanned draws its engine, version and date. */
  const noteLine = (n) => {
    const tool = String(n.tool || ""), result = String(n.result || "");
    const known = (key) => cs.w(key) !== key;
    if (!known("screen.open-file.tool." + tool) || !known("screen.open-file.result." + result)) return `<span>${cs.w("shell.unread")}</span>`;
    const scanned = result !== "not_scanned";
    const engine = scanned ? [n.engine, n.engine_version].filter(Boolean).join(" ") : "";
    return `<span>${cs.w("screen.open-file.note.line", { tool: { html: cs.w("screen.open-file.tool." + tool) },
        result: { html: cs.w("screen.open-file.result." + result) } })}</span>`
      + (engine ? `<span class="meta">${cs.esc(engine)}</span>` : "")
      + (scanned && n.scanned_at ? `<span class="meta">${cs.w("screen.open-file.note.at")} ${cs.date(n.scanned_at)}</span>` : "");
  };
  /* a sentence by its own key where the words table holds it, else `alt()`: the nearest held rows stand in until the design's rows reach the table (K4269); the rows
     owed are named in the job record and in `fix-round-10-words.md`. A drawn-screen module holds no English and adds no marker of its own (K4640). */
  const keyedW = (k, f, alt) => { const t = cs.w(k, f); return t === k ? alt() : t; };
  /* R14 (G3): beside a scanner's "Clean" on a file whose inside was not examined, the design's line `screen.open-file.check.inside` ("its inside could not be
     checked"); until its row is held the reasons' own words (the plane's translation of `encrypted`, `unread`, ...) say it, in the "why" line above, and nothing is invented */
  const notesFor = (inside) => cs.state(D.notes, (v) => `<div class="cs-sheet">${v.notes.map((n) => `<div class="cs-row">${noteLine(n)}</div>`).join("")}</div>`
    + (inside && keyedW("screen.open-file.check.inside", {}, () => "") ? `<p class="mk-small" data-unexamined="1">${keyedW("screen.open-file.check.inside", {}, () => "")}</p>` : ""),
    { empty: addedBy ? "screen.open-file.check.notyet" : "screen.open-file.checks.none" });
  const safeDrawn = (s) => {
    if (!s) return "";
    /* R36 (file-safety R45): the safe view of a plain-text file is drawn as text, each line a paragraph that wraps within the
       column; nothing in it is run or followed, the cut said when the file was longer */
    if (s.kind === "text") return said("screen.open-file.safetext") + `<div class="mk-passage" data-safetext="1">`
      + String(s.text ?? "").split(/\r\n|\r|\n/).map((l) => `<p>${cs.esc(l)}</p>`).join("") + "</div>"
      + (s.truncated ? said("screen.open-file.safetext.cut") : "");
    /* R5 (G44; file-safety R11): each sheet's cells as the answer holds them; a sheet that could not be shown says so, a cut sheet says
       which rows are shown and that the original holds the rest, a cut list of sheets says how many are shown; a whole sheet and an answer
       without the new keys (an older record's) draw none of them */
    if (s.kind === "data") {
      const sheets = Array.isArray(s.sheets) ? s.sheets : [];
      return sheets.map((sh) => {
        const r = sh.rows && typeof sh.rows === "object" ? sh.rows : {}, from = r.from ?? 1, to = r.to ?? 0;
        const cut = sh.truncated !== true ? "" : Number.isFinite(sh.total_rows)
          ? said("screen.open-file.safe.cut", { from, to, total: sh.total_rows }) : said("screen.open-file.safe.cut.more", { from, to });
        return `<h3>${cs.w("screen.open-file.safe.sheet", { name: sh.name || "" })}</h3>`
          + (sh.reason ? said("screen.open-file.safe.sheet.unreadable", { name: sh.name || "" })
            : `<table class="mk-table"><thead><tr><th scope="col">${cs.w("screen.open-file.safe.cell")}</th><th scope="col">${cs.w("screen.open-file.safe.value")}</th></tr></thead><tbody>`
              + (Array.isArray(sh.cells) ? sh.cells : []).map((c) => `<tr><td>${cs.esc(c.ref ?? "")}</td><td>${cs.esc(c.value ?? "")}</td></tr>`).join("")
              + "</tbody></table>") + cut;
      }).join("") + (s.sheets_truncated === true ? said("screen.open-file.safe.sheetscut", { shown: sheets.length, total: s.sheets_total ?? sheets.length }) : "");
    }
    /* R77, R81 (A4; file-safety R60): a photograph's safe picture is described by the owner's answer; beside it, what was left out of it, each kind by
       `screen.photo.dropped.<kind>` (screens-intake-rounds' `leftOutLine`), nothing when nothing was left out. The picture itself is drawn once the kit can
       show a byte answer in the page (R77, owed) */
    if (s.kind === "picture") {
      /* the part fills `{what}` with phrases already drawn by `cs.w` (HTML) as a plain string, which the kit would escape again; it is handed a kit that marks
         that fill as HTML (reported to BOB for screens-intake-rounds) */
      const kit = Object.assign(Object.create(cs), { w: (k, v) => cs.w(k, v && typeof v.what === "string" ? { ...v, what: { html: v.what } } : v) });
      const left = view.parts.leftOutLine(kit, s.left_out);
      return said("screen.open-file.safe.ready") + (left ? `<p class="mk-small" data-leftout="1">${left}</p>` : "");
    }
    return said("screen.open-file.safe.ready")
      + (Number.isFinite(s.pages) ? said(s.truncated ? "screen.open-file.safe.truncated" : "screen.open-file.safe.pages", { pages: s.pages, total: s.source_pages ?? s.pages }) : "");
  };
  /* R68 (G7; file-safety R56): the unread picture type is said by the design's `screen.open-file.image.unread`; until its row is held, by the sentence the reading's
     owner holds for the type (`reading-pipeline.index.unsupported_<type>`: "BMP is not read yet.") */
  const imageUnread = (type) => {
    const kind = String(type || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    return keyedW("screen.open-file.image.unread", { type: kind }, () => {
      const own = "reading-pipeline.index.unsupported_" + kind, general = "reading-pipeline.index.unsupported_kind";
      return kind && cs.w(own) !== own ? cs.w(own) : kind && cs.w(general, { kind }) !== general ? cs.w(general, { kind }) : cs.w("shell.unread");
    });
  };
  const body = cs.state(D.threat, (t) => cs.state(D.state, (o) => {
    const held = !!t.scan_hold || o.why === "SCAN_HOLD";
    const kind = held ? "held" : t.threat === "low" ? "low" : "high";
    const listed = (Array.isArray(t.reasons) ? t.reasons : []).filter((r) => r && (r.translation || r.code));
    const yours = kind === "high" && addedBy && listed.some((r) => r.code === "source_not_fetched");
    /* R14 (G3): for a file she added, `yours` says why the file is high (nobody fetched it); every other reason is still said in its own words,
       and none is said as an empty line */
    const reasons = (yours ? listed.filter((r) => r.code !== "source_not_fetched") : listed).map((r) => r.translation || r.code);
    /* R14: a reason that says the file's inside was not examined (an encrypted file or member, a macro container, a format nothing checked, a file
       left unread or unscannable) is said beside the checks, so a scanner's "Clean" is not taken to cover it */
    const unexamined = listed.some((r) => /^(encrypted|format_unchecked|unread|unscannable|active:vba-project)$/.test(String(r.code)));
    /* R68 (G7; file-safety R56): a TIFF, HEIC or BMP is not read, and its structure was not examined */
    const unreadImage = !!(t.image && typeof t.image === "object" && t.image.read === false);
    /* R71 (DEC-439 B531 (2)): for a picture (`threatof`'s `format: "image"`) the high and the held lines speak of the safe copy of the picture, not of a
       picture of each page; the low line and a text file's lines are unchanged */
    const picture = t.format === "image" && kind !== "low";
    let out = `<div class="row"><span class="cs-risk" data-risk="${kind}" tabindex="0">${cs.w(`screen.open-file.risk.${kind}`)}</span>`
      + `<span class="mk-small">${cs.w(yours ? "screen.open-file.high.yours" : `screen.open-file.risk.${kind}.means${picture ? ".picture" : ""}`)}</span></div>`
      + (reasons.length ? `<p class="mk-small">${cs.w("screen.open-file.why", { reasons: reasons.join("; ") })}</p>` : "")
      + (unreadImage ? `<p class="mk-small" data-unread-image="1">${imageUnread(t.image.type)}</p>` : "");
    /* F-B14 (R36): the renderer's reason beside "the reason is stated beside it": the word held for the owner's code, else `refusal.uncatalogued` with the code as given (DEC-342) */
    const reasonBeside = (r) => !r ? "" : cs.w("refusal." + r) !== "refusal." + r ? ` <span data-renderer-reason="${cs.esc(r)}">${cs.w("refusal." + r)}</span>`
      : ` <span data-renderer-reason="${cs.esc(r)}">${cs.w("refusal.uncatalogued")} <code>${cs.esc(r)}</code></span>`;
    /* F-B15 (R36): a file of a kind the owner makes no safe view of (`threatof`'s `format`; file-safety R11's routes and R45's text) says so once, in place of the
       act and of every sentence that sends the member to the safe view; the owner's refusal on a plain-text file that is not UTF-8 stays an answer to the press */
    /* R77 (A4; file-safety R60): a photograph (`image` of a type the owner makes a safe picture of, JPEG or PNG) has a safe view */
    const picturable = t.format === "image" && t.image && typeof t.image === "object" && ["jpeg", "png"].includes(t.image.type);
    const hasSafeView = picturable || !(typeof t.format === "string" && !["pdf", "docx", "pptx", "odt", "odp", "xlsx", "ods", "csv", "text"].includes(t.format));
    const safe = !hasSafeView ? cs.sec("screen.open-file.safe", `<p class="mk-small" data-nosafeview="1">${cs.w("refusal.NO_SAFE_VIEW")}</p>`)
      : cs.sec("screen.open-file.safe", `<p class="mk-small">${cs.w("screen.open-file.safe.about")} `
      + `${cs.mark("origin", "machine")} ${cs.w("screen.open-file.safe.origin")}. ${cs.w("screen.open-file.safe.cite")}</p>`
      + `<div class="mk-acts">${cs.act("safeview", { tone: kind === "low" ? undefined : "primary" })}</div>`
      + (U.safeRefused ? `<p class="cs-state" data-state="failed" role="alert">${U.safeRefused.key ? cs.w(U.safeRefused.key, U.safeRefused.vars) : cs.esc(U.safeRefused.text)}${reasonBeside(U.safeRefused.reason)}</p>` : "") + safeDrawn(U.safe));
    const deep = U.deeper || t.latest_deeper;
    const deeper = cs.sec("screen.open-file.deeper", `<p class="mk-small">${cs.w("screen.open-file.deeper.about")}</p>`
      + (deep && deep.state ? `<p class="mk-small">${cs.w("screen.open-file.deeper.state", { state: cs.w(`screen.open-file.deeper.${deep.state === "done" ? "done"
        : deep.state === "running" ? "running" : "queued"}`) })}</p>` : "")
      + `<div class="mk-acts">${cs.act("deepercheck")}</div>`);
    if (kind === "low") {
      out += `<div class="mk-acts">${cs.act("openoriginal", { tone: "primary" })}</div>` + refused
        + cs.sec("screen.open-file.checks", notesFor(unexamined)) + `<p class="mk-note">${cs.w("screen.open-file.weekly")}</p>`;
    } else if (kind === "high") {
      const warned = o.may_open === true && o.path === "warned";
      out += (o.may_open === true && o.path === "deeper" ? `<div class="mk-acts">${cs.act("openoriginal", { tone: "primary", data: { override: "1" } })}</div>` : "")
        + (yours && hasSafeView ? `<h2>${cs.w("screen.open-file.next.head")}</h2><p class="mk-note">${cs.w("screen.open-file.next.yours")}</p>` : "")
        + safe + deeper + cs.sec("screen.open-file.checks", notesFor(unexamined))
        + (warned ? cs.sec("screen.open-file.warn", `<div class="cs-dialog"><b>${cs.w("screen.open-file.warn.title")}</b>`
          + `<p class="ends">${cs.w("screen.open-file.warn.ends")}</p>`
          + `<fieldset class="mk-checks"><legend>${cs.w("screen.open-file.warn.confirm")}</legend>`
          + `<label><input type="checkbox" id="co-device"> ${cs.w("screen.open-file.warn.device")}</label>`
          + `<label><input type="checkbox" id="co-macros"> ${cs.w("screen.open-file.warn.macros")}</label></fieldset>`
          + `<div class="mk-acts">${cs.act("openwithwarning")}</div></div>`) : "")
        + refused
        + `<p class="mk-small muted">${cs.w("screen.open-file.warn.notoffered")}</p>`
        + (o.may_open !== true && o.why && !yours ? said("screen.open-file.closed", { why: o.why }) : "");
    } else {
      const names = [];
      if (D.findings && D.findings.state === "ok")
        for (const x of (Array.isArray(D.findings.value.findings) ? D.findings.value.findings : []))
          if (x && x.captureSha === sha) for (const n of (Array.isArray(x.findings) ? x.findings : [x.findings])) if (n && !names.includes(String(n))) names.push(String(n));
      out += (names.length ? `<p class="mk-small">${cs.w("screen.open-file.findings", { names: names.join(", ") })}</p>` : "")
        + safe + deeper + refused
        + cs.sec("screen.open-file.risk.held", `<p class="mk-small">${cs.w("screen.open-file.held.about")}</p>`
          + (t.scan_hold ? `<div class="mk-acts">${cs.act("releasescanhold", { tone: "primary" })}</div>` : ""))
        + cs.sec("screen.open-file.checks", notesFor(unexamined));
    }
    /* R39: the original was checked against the record's fingerprint before it was handed over, and the sentence says so */
    if (U.opened) out += said("screen.open-file.digest.checked") + said("screen.open-file.opened");
    if (U.release) out += said(U.release === "released" ? "screen.open-file.release.done" : "screen.open-file.release.pending");
    return out;
  }), {});
  /* R17: the scanners' counts are drawn only when one is above zero (a failed read is still drawn failed) */
  const idle = D.status && D.status.state === "ok" && D.status.value && !(D.status.value.queued > 0 || D.status.value.overdue > 0 || D.status.value.held > 0);
  const status = D.status && !idle && !addedBy ? cs.sec("screen.open-file.status", cs.state(D.status, (s) => `<p class="mk-small">${cs.w("screen.open-file.status.line",
    { parts: [["queued", s.queued], ["overdue", s.overdue], ["held", s.held]].filter(([, n]) => n > 0).map(([k, n]) => cs.w(`screen.open-file.status.${k}`, { count: n })).join(", ") })}</p>`)) : "";
  return head + body + status;
}

/* R39: what one attempt to open the original came to: `cs.download` hashes the bytes in the browser against the capture's
 * fingerprint (`verify`, the screen's subject: the plane answers the capture's bytes with a digest header equal to it, file-safety
 * R8) before any file is made. A match hands the original over and the screen says it was checked. A difference hands nothing over:
 * `refusal.DIGEST_MISMATCH`, or `.unheld` where the team holds no file under that fingerprint (`heldat` by digest, a read), beside
 * the act, which stays usable. Any other refusal is drawn in its own words. Nothing records which member tried (R9). */
async function openedAs(cs, got, sha) {
  const no = got && got.answer && typeof got.answer === "object" ? (got.answer.result && typeof got.answer.result === "object" ? got.answer.result : got.answer) : {};
  if (got && got.ok) { cs.set("refused", null); cs.set("opened", true); return null; }
  cs.set("opened", false);
  if (no.code === "DIGEST_MISMATCH") {
    const h = await cs.call("heldat", { query: { sha256: sha } });
    const r = h && h.result && typeof h.result === "object" ? h.result : h;
    cs.set("refused", { key: r && r.held === false ? "refusal.DIGEST_MISMATCH.unheld" : "refusal.DIGEST_MISMATCH" });
  } else {
    const code = String(no.code || no.reason || "");
    cs.set("refused", code && cs.w("refusal." + code) !== "refusal." + code ? { key: "refusal." + code } : { text: no.translation || "" });
  }
  return null;
}

/* R6, R39: an original's bytes, fetched with the session header, checked against the capture's fingerprint, and handed to the
 * browser as a file (`cs.download`: a `Blob` behind an object address released once the download starts, setup-page R26's form);
 * no link written carries a token. A refusal is drawn beside the act. */
async function sendOpenOriginal(view, el, cs) {
  const sha = String(view.subject || "").toLowerCase();
  const override = el && el.dataset && el.dataset.override === "1";
  return view.parts.openedAs(cs, await cs.download("openoriginal", { query: { capture: sha, ...(override ? { override: "1" } : {}) }, name: sha.slice(0, 12), verify: sha }), sha);
}

/* R5, R6, R39: the warned path (DEC-173): sent only once both confirmations are ticked; nothing keeps that they were. */
async function sendOpenWithWarning(view, el, cs) {
  if (cs.value("co-device") !== true || cs.value("co-macros") !== true) return { refuse: "screen.open-file.warn.both" };
  const sha = String(view.subject || "").toLowerCase();
  return view.parts.openedAs(cs, await cs.download("openwithwarning", { query: { capture: sha }, body: { warned: { own_device: true, no_macros: true } }, name: sha.slice(0, 12), verify: sha }), sha);
}

/* R5: the safe view (`op=safeview`): a spreadsheet's figures drawn as data; a page view handed over as a file, marked a
 * derived copy. */
async function sendSafeView(view, el, cs) {
  const sha = String(view.subject || "").toLowerCase();
  const got = await cs.download("safeview", { query: { capture: sha }, name: `${sha.slice(0, 12)}-safe-view.pdf` });
  /* a spreadsheet's safe view is a JSON answer (file-safety R11), which the download hands back unsaved */
  const j = (got && got.answer) || {};
  const a = j && typeof j === "object" && j.result && typeof j.result === "object" ? j.result : j;
  cs.set("safeRefused", null);
  if (a && a.kind === "data" && a.ok !== false) { cs.set("refused", null); cs.set("safe", a); return null; }
  /* R77, R81 (file-safety R60): a photograph's safe picture is answered by its description (what the file says, what was left out) */
  if (a && a.kind === "picture" && a.ok !== false) { cs.set("refused", null); cs.set("safe", { kind: "picture", left_out: Array.isArray(a.left_out) ? a.left_out : [] }); return null; }
  /* R36 (file-safety R45): a plain-text file's safe view is its own characters, drawn as text */
  if (a && a.kind === "text" && a.ok !== false) { cs.set("refused", null); cs.set("safe", { kind: "text", text: String(a.text ?? ""), truncated: a.truncated === true }); return null; }
  /* R36: the safe view draws its result or its refusal, never nothing: `NO_SAFE_VIEW` by its key, another refusal in its own
     words, an answer with none as the shell's "could not be read" */
  if (!got || !got.ok) {
    cs.set("safe", null);
    const code = a && (a.code || a.reason), words = a && (a.translation || "");
    /* G44 (file-safety R11, R51): a file above what a preview can show says so with its size and the bound in MB (one decimal), never
       an empty table or the generic sentence alone; a refusal without the figures is drawn as before */
    const mb = (n) => (n / 1048576).toFixed(1), sized = a.renderer_reason === "TOO_LARGE" || a.renderer_reason === "PREVIEW_NOT_DRAWN", drawn = sized && Number.isFinite(a.size) && Number.isFinite(a.bound);
    /* F-B14 (R36): the refusal's sentence says the reason is stated beside it, so the renderer's reason (a code of the owner's) goes beside it, drawn by its key;
       the two size reasons are already said by the figures' sentence (or by the translation alone where the owner gave none) */
    const reason = code === "SAFE_VIEW_FAILED" && !sized && typeof a.renderer_reason === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(a.renderer_reason) ? a.renderer_reason : "";
    /* R71 (DEC-439; file-safety K5272): a renderer reason whose row is the whole sentence (a kind it cannot make a view of, a file with no text, a spreadsheet
       with no sheet: file-safety's `renderer_reason`) is drawn by `refusal.<reason>` in place of the owner's translation and with no reason beside it; a screen
       function is self-contained (it runs in the browser), so the three reasons are listed here */
    const whole = code === "SAFE_VIEW_FAILED" && ["NOT_RENDERABLE", "NOT_TEXT", "no_sheets"].includes(a.renderer_reason) && cs.w("refusal." + a.renderer_reason) !== "refusal." + a.renderer_reason;
    cs.set("safeRefused", code === "NO_SAFE_VIEW" ? { key: "refusal.NO_SAFE_VIEW" } : code === "SAFE_VIEW_FAILED" && drawn ? { key: "screen.open-file.safe.notdrawn", vars: { size: mb(a.size), bound: mb(a.bound) } }
      : whole ? { key: "refusal." + a.renderer_reason } : words ? { text: words, reason } : { key: "shell.unread" });
    return null;
  }
  cs.set("refused", null);
  cs.set("safe", { kind: "pdf" });
  return null;
}

/* R5: a deeper check (`op=deepercheck`), any member who may see the file. */
function sendDeeperCheck(view) {
  return { query: { capture: String(view.subject || "").toLowerCase() } };
}
function doneDeeperCheck(view, answer, cs) {
  cs.set("deeper", { state: answer && answer.state });
}

/* R5: a hold released with a reason (`op=releasescanhold`, file-safety R17; the shell's reason field, R11), offered only
 * while file-safety answers the file held. The first reason waits for a second member's. */
function sendReleaseScanHold(view) {
  return { query: { capture: String(view.subject || "").toLowerCase() } };
}
function doneReleaseScanHold(view, answer, cs) {
  cs.set("release", answer && answer.state === "released" ? "released" : "pending");
}

export const OPEN_FILE_SCREEN = Object.freeze({
  id: "open-file",
  reads: openFileReads,
  render: renderOpenFile,
  parts: Object.freeze({ openedAs, leftOutLine }),
  acts: Object.freeze([
    Object.freeze({ op: "openoriginal", rereads: Object.freeze([]), label: "act.openoriginal.label.open-file", send: sendOpenOriginal }),
    Object.freeze({ op: "openwithwarning", rereads: Object.freeze([]), label: "act.openwithwarning.label.open-file", send: sendOpenWithWarning }),
    Object.freeze({ op: "safeview", rereads: Object.freeze([]), label: "act.safeview.label.open-file", send: sendSafeView }),
    Object.freeze({ op: "deepercheck", rereads: Object.freeze(["threat", "state", "notes", "findings"]), label: "act.deepercheck.label.open-file", send: sendDeeperCheck, done: doneDeeperCheck }),
    Object.freeze({ op: "releasescanhold", rereads: Object.freeze(["threat", "state", "notes", "findings", "accounts"]), label: "act.releasescanhold.label.open-file", send: sendReleaseScanHold, done: doneReleaseScanHold }),
  ]),
});
