/* The `archive` screen (Add › Held captures › Archive; R15; DEC-167, N688's screen part; K1844, K1940), at
 * `/app/archive/<the archive's SHA-256>`. Self-contained functions over the kit `cs` (interface-shell R21 (1)). */

import { sendRelease, RELEASE_REFUSALS } from "./held.mjs";

/* R15: `archivelist` for the archive (acquisition R41) and `gradenote` (capture R76), by the archive's digest. */
function archiveReads(view) {
  const sha = typeof view.subject === "string" ? view.subject.toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(sha)) return {};
  return { list: { op: "archivelist", query: { archive: sha, limit: 1000 }, subject: true },
           note: { op: "gradenote", query: { capture: sha } } };
}

/* R15: the archive, its grade and summary; an archive that opened as rows (filed ones picked, held for review beside it;
 * already held ones naming the capture they repeat; not filed ones with their reason; folders with their files); one
 * refused whole as its refusal, nothing in it filed. Every name as the archive states it, drawn as data. */
function renderArchive(cs, view) {
  const sha = typeof view.subject === "string" ? view.subject.toLowerCase() : "";
  /* R20: opened bare or at no digest, the shell's own "Nothing is here" (interface-shell R35, R61) with the way back */
  if (!/^[0-9a-f]{64}$/.test(sha)) return `<h1 class="t-title">${cs.w("shell.unavailable.nothing.title")}</h1><p class="cs-state" data-state="empty" data-unavailable="nothing">${cs.w("shell.unavailable.nothing.says")}</p>`
    + `<p><a class="cs-btn" data-tone="quiet" href="/app" data-nav>${cs.w("shell.unavailable.home")}</a></p>`;
  const head = `<div class="mk-h">${cs.title()}</div>`;
  const U = view.ui || {};
  const said = (k, f) => `<p class="mk-note" role="status">${cs.w(k, f)}</p>`;
  const size = (n) => !Number.isFinite(n) ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
  /* the list "Show only those not filed" asked for replaces the whole one until the reads are made again */
  const data = U.only && U.only.state ? U.only : view.data.list;
  const body = cs.state(data, (v) => {
    const a = v.archive || {}, sum = v.summary || {};
    const entries = Array.isArray(v.entries) ? v.entries : [];
    /* the owner answers the grade as its bare letter (acquisition `archivelist`); an object carrying it is read the same */
    const g = a.grade && typeof a.grade === "object" ? a.grade : typeof a.grade === "string" && a.grade ? { grade: a.grade } : null;
    const grade = g && g.grade ? cs.grade("capture", g.grade)
      : `<span class="meta">${cs.w("state.undetermined", { reason: cs.w("screen.archive.ungraded") })}</span>`;
    const note = U.note !== undefined ? U.note : view.data.note && view.data.note.state === "ok" ? view.data.note.value && view.data.note.value.note : null;
    let out = `<div class="row">${grade}${cs.act("gradenote")}<span class="id">${[cs.w("screen.archive.facts", { short: sha.slice(0, 4) + "…" + sha.slice(-4) }),
      ...((a.entries ?? entries.length) > 0 ? [cs.w("screen.archive.facts.entries", { entries: a.entries ?? entries.length })] : []), size(a.bytes)].filter(Boolean).join(" · ")}</span></div>`
      + (U.showNote && note ? `<p class="mk-small">${cs.esc(note)}</p>` : U.showNote ? said("screen.archive.nonote") : "");
    if (a.refused) {
      const why = a.refused.translation || a.refused.code || "";
      return out + `<p>${cs.mark("gap", "refused", { reason: why })}</p>`
        + said("screen.archive.refused.none")
        + (U.listed ? cs.sec("screen.archive.lists", list(entries)) : `<div class="mk-acts">${cs.act("archivelist", { label: "screen.archive.see" })}</div>`);
    }
    /* R17: each count of the summary is drawn only above zero, as its own phrase (`screen.archive.sum.*`); an archive that opened
       with none draws no summary line. (`screen.archive.summary` holds all four counts in one sentence, which R17 forbids
       at zero: J3.) */
    const sumParts = (m) => [["filed", m.filed], ["held", m.already_held], ["notfiled", m.not_filed], ["folders", m.folders]]
      .filter(([, n]) => n > 0).map(([k, n]) => cs.w(`screen.archive.sum.${k}`, { count: n })).join(", ");
    out += (a.opened === false ? said("screen.archive.notopened", { waiting: sum.waiting ?? 0 })
        : sumParts(sum) ? `<p class="mk-note" role="status">${sumParts(sum)}.</p>` : "")
      + (g && g.grade ? `<p class="mk-small">${cs.w("screen.archive.gradeabout", { grade: g.grade })}</p>` : "");
    return out + (entries.length ? cs.sec("screen.archive.files", list(entries)
      + `<p class="mk-small muted">${cs.w("screen.archive.names")}</p>`) : "")
      + (U.only && U.only.state ? said("screen.archive.onlynotfiled") : "")
      + (v.truncated ? `<p class="mk-small">${cs.w("screen.archive.more", { count: entries.length })}</p>` : "");
  }, { empty: "screen.archive.empty" });
  /* the rows: a filed entry the viewer may see (its `bundle`) is picked by that document's id */
  function list(entries) {
    const files = entries.filter((e) => e && e.state === "filed" && typeof e.bundle === "string" && e.bundle);
    const rest = entries.filter((e) => !files.includes(e));
    const inFolder = (f) => entries.filter((e) => e && e.state !== "folder" && typeof e.name === "string" && typeof f.name === "string" && e.name.startsWith(f.name)).length;
    const opens = (e) => typeof e.sha256 === "string" && e.sha256 ? cs.ref("capture", e.sha256, String(e.name ?? ""), []) : `<span class="id">${cs.esc(e.name ?? "")}</span>`;
    const filed = files.length ? cs.rows({
      id: "archive",
      cols: ["screen.archive.col"],
      name: (e) => opens(e),
      items: files,
      key: (e) => e.bundle,
      pick: true,
      /* R15: the hold strip: vouch for or set aside the picked files, or list only those not filed */
      hold: () => cs.act("archivelist", { label: "screen.archive.onlynotfiledact" }) + cs.act("heldsetaside")
        + cs.field("ch-ack", "screen.held.ack", { help: "screen.held.ackhelp", max: 500 })
        + cs.field("ch-mitigation", "screen.held.mitigation", { help: "screen.held.mitigationhelp", max: 500 })
        + cs.act("release", { tone: "primary" }),
      cells: (e) => [`${opens(e)}<span class="meta">${cs.w("screen.archive.filed")}${e.uncompressed !== undefined ? " · " + size(e.uncompressed) : ""}</span>`],
    }) : "";
    const other = rest.map((e) => {
      const name = e.state === "folder" ? `<span class="id">${cs.esc(e.name ?? "")}</span>` : opens(e);
      /* R30 (N1126; acquisition R41): an entry already held names the earlier capture (`held_name`, else its own name) and when it
         was captured (`held_at`), whole; an entry stating either alone draws its state only, never the sentence with a blank */
      const earlier = e.state === "already_held" ? String(e.held_name || e.name || "") : "";
      const what = e.state === "already_held" ? (e.held_at && earlier ? cs.w("screen.archive.alreadyheld", { name: earlier, date: { html: cs.date(e.held_at) } })
          : cs.w("screen.archive.sum.held", { count: 1 }))
        : e.state === "folder" ? cs.w("screen.archive.folder", { count: inFolder(e) })
        : e.state === "link" ? cs.w("screen.archive.link", { target: e.target ?? "" })
        : e.state === "not_filed" ? cs.mark("gap", "refused", { reason: e.translation || e.code || "" })
        : e.state === "filed" ? cs.w("screen.archive.filedunseen")
        : cs.w("screen.archive.waiting");
      return `<div class="cs-row" role="listitem"><span>${name}<span class="meta">${what}</span></span></div>`;
    }).join("");
    return filed + (other ? `<div class="cs-sheet" role="list">${other}</div>` : "");
  }
  return head + body
    + (U.released ? said("screen.held.released", { count: U.released }) : "")
    + (U.setAside ? said("screen.archive.setaside", { count: U.setAside }) : "");
}

/* R15: "Read the grade note": drawn beside the grade. */
function sendGradeNote(view) {
  return { query: { capture: String(view.subject || "").toLowerCase() } };
}
function doneGradeNote(view, answer, cs) {
  cs.set("note", answer && typeof answer.note === "string" ? answer.note : null);
  cs.set("showNote", true);
}

/* R15: "Show only those not filed" (in the hold strip), or, for an archive refused whole, "See what it lists". */
function sendList(view) {
  const refused = view.data && view.data.list && view.data.list.state === "ok" && view.data.list.value && view.data.list.value.archive
    && view.data.list.value.archive.refused;
  return { query: { archive: String(view.subject || "").toLowerCase(), limit: 1000, ...(refused ? {} : { state: "not_filed" }) } };
}
function doneList(view, answer, cs) {
  const refused = view.data && view.data.list && view.data.list.state === "ok" && view.data.list.value && view.data.list.value.archive
    && view.data.list.value.archive.refused;
  if (refused) { cs.set("listed", true); return; }
  cs.set("only", { state: "ok", value: answer || {}, refusal: null });
}

/* R15: one reason for every picked file (`heldsetaside`, capture R79; the shell's reason field, no writing help). */
function sendSetAside(view, el, cs, extra) {
  const ids = (extra && Array.isArray(extra.picked) ? extra.picked : []).filter((x) => typeof x === "string" && x);
  if (!ids.length) return { refuse: "screen.held.none" };
  return { body: { ids } };
}
function doneSetAside(view, answer, cs) {
  cs.set("setAside", answer && Array.isArray(answer.ids) ? answer.ids.length : 0);
  cs.set("released", 0);
  cs.set("only", null);
}
/* R15: vouching is held's (`sendRelease`: an enumerated selection of the picked files, then the release over its
 * handle, with the member's acknowledgment and mitigation). */
function doneArchiveRelease(view, answer, cs) {
  cs.set("released", answer && Array.isArray(answer.released) ? answer.released.length : 0);
  cs.set("setAside", 0);
  cs.set("only", null);
}

export const ARCHIVE_SCREEN = Object.freeze({
  id: "archive",
  reads: archiveReads,
  render: renderArchive,
  acts: Object.freeze([
    Object.freeze({ op: "gradenote", rereads: Object.freeze(["note"]), label: "act.gradenote.label.archive", send: sendGradeNote, done: doneGradeNote }),
    Object.freeze({ op: "archivelist", rereads: Object.freeze(["list"]), label: "act.archivelist.label.archive", send: sendList, done: doneList }),
    Object.freeze({ op: "heldsetaside", rereads: Object.freeze(["list"]), label: "act.heldsetaside.label.archive", send: sendSetAside, done: doneSetAside }),
    Object.freeze({ op: "release", rereads: Object.freeze(["list"]), label: "act.release.label.archive", send: sendRelease, done: doneArchiveRelease, reasonField: "acknowledgment", refusals: RELEASE_REFUSALS }),
  ]),
});
