/* The `leads` screen (Add › Leads; R44; DEC-375 C18), at `/app/leads` and `/app/leads/<a lead's id>`: write down something you were
 * told, record who looked and what they found, and share it with a project (`lead`, `leadread`, `leadlook`, `leadshare`,
 * `writinghelp`). "Lead" is the member's own note here; a contradiction is what the assistant proposes (the two words are not mixed).
 * The list is `leadlist` (`observation-log` R20): the leads this viewer may read, newest first, read again after a lead is written;
 * the screen keeps no list of its own. A lead is opened by its id (`leadread`). Self-contained functions over the kit `cs` (interface-shell R21 (1)). */

/* R44: the projects the member has joined (the share's choices), the team's members (who looked), and, at a lead's address, the lead. */
function leadsReads(view) {
  const id = typeof view.subject === "string" && /^LEAD-[A-Za-z0-9-]+$/.test(view.subject) ? view.subject : "";
  return { list: { op: "leadlist" }, projects: { op: "projectlist" },
           ...(id ? { one: { op: "leadread", query: { id }, subject: true } } : {}) };
}

function renderLeads(cs, view) {
  const U = view.ui || {}, D = view.data || {};
  const id = typeof view.subject === "string" && /^LEAD-[A-Za-z0-9-]+$/.test(view.subject) ? view.subject : "";
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const mine = D.list && D.list.state === "ok" && D.list.value && Array.isArray(D.list.value.leads) ? D.list.value.leads.filter((l) => l && typeof l.lead_id === "string") : [];
  const projects = D.projects && D.projects.state === "ok" && D.projects.value && Array.isArray(D.projects.value.projects) ? D.projects.value.projects : [];
  /* C94 (interface-shell R111): a member is named by the shell's name for her id (her handle; a fallback word where none is known), never the id */
  const handleOf = (m) => { const x = String(m || "").replace(/^member:/, ""); return x ? cs.memberName(x) : ""; };
  const nameOf = (p) => (projects.find((x) => x && x.id === p) || {}).name || "";
  const STATE = { LOOKED_ABSENT: "absent", LOOKED_INDETERMINATE: "unclear", partial: "part", PRESENT: "found" };
  const stateWord = (s) => (STATE[s] ? cs.w("screen.leads.state." + STATE[s]) : cs.w("screen.leads.state.never"));
  /* the lead this page shows: the one its address names, else the one the member opened (kept in page memory) */
  const open = id ? (D.one && D.one.state === "ok" ? D.one.value : null) : U.open || null;
  const help = view.reachable ? `<div class="mk-acts">${cs.act("writinghelp", { label: "act.writinghelp.label.leads" })}</div>` : "";
  const write = cs.sec("screen.leads.write.heading", `<div style="display:grid;gap:14px">`
    + cs.field("ld-words", "screen.leads.write.words", { area: true, rec: true, value: U.words || "",
        ...(U.draft ? { draft: "screen.capture.saw.draft", draftFills: { handle: U.draft.handle } } : {}) })
    + help
    + cs.field("ld-where", "screen.leads.write.where", { value: U.where || "" })
    + `<div class="mk-acts">${cs.act("lead", { tone: "primary" })}</div>`
    + `<p class="mk-note">${cs.w("screen.leads.write.note1")} ${cs.w("screen.leads.write.note2")}</p></div>`);
  const list = !mine.length ? "" : cs.sec("screen.leads.mine.head", cs.sheet(mine.map((l) =>
    cs.row(cs.icon("hint"), `<span class="rec">${cs.esc(l.words)}</span>`, cs.act("leadread", { tone: "quiet", data: { id: l.lead_id } }), stateWord(l.state))).join("")),
    { help: "screen.leads.list.help" });
  let one = "";
  if (open && typeof open.lead_id === "string") {
    const looks = Array.isArray(open.looks) ? open.looks : [];
    const shared = Array.isArray(open.shared_to) ? open.shared_to : [];
    const mineHere = view.me && open.author && String(open.author).replace(/^member:/, "") === String(view.me.member || "");
    const rows = cs.row(cs.icon("hint"), `<span class="rec">${cs.esc(open.words || "")}</span>`, "",
        [mineHere && open.at ? cs.w("screen.leads.written", { date: { html: cs.date(open.at) } }) : "", stateWord(open.state)].filter(Boolean).join(" · "))
      + looks.map((k) => cs.row(cs.icon("search"), cs.w("screen.leads.look.line", { name: { html: `<span class="mk-data">${cs.esc(handleOf(k.looked_by))}</span>` },
          date: { html: k.at ? cs.date(k.at) : "" }, words: { html: `<span class="rec">${cs.esc(k.detail || "")}</span>` } }), "", stateWord(k.state))).join("")
      + shared.map((s) => cs.row(cs.icon("projects"), cs.w("screen.leads.shared.line", { project: { html: `<span class="mk-data">${cs.esc(nameOf(s.project) || "")}</span>` },
          date: { html: s.at ? cs.date(s.at) : "" } }), "", s.reason ? `<span class="rec">${cs.esc(s.reason)}</span>` : "")).join("");
    const kinds = [["none", "screen.leads.look.kind.none"], ["capture", "screen.leads.look.kind.doc"], ["content", "screen.leads.look.kind.passage"]];
    const record = `<div class="cs-sheet" style="padding:10px 14px;display:grid;gap:14px"><b>${cs.w("screen.leads.look.head")}</b>`
      + cs.choice("ld-lks", "screen.leads.look.state", [["LOOKED_ABSENT", "screen.leads.look.opt.absent"], ["LOOKED_INDETERMINATE", "screen.leads.look.opt.unclear"],
          ["partial", "screen.leads.look.opt.part"], ["PRESENT", "screen.leads.look.opt.found"]], { value: "LOOKED_INDETERMINATE" })
      + cs.choice("ld-lkk", "screen.leads.look.kind", kinds, { value: "none" }) + `<p class="mk-small muted">${cs.w("screen.leads.look.kind.help")}</p>`
      + cs.field("ld-lkr", "screen.leads.look.which")
      + cs.field("ld-lkd", "screen.leads.look.detail", { area: true, rec: true })
      + `<div class="mk-acts">${cs.act("leadlook", { tone: "primary", data: { id: open.lead_id } })}</div></div>`;
    const share = `<div class="cs-sheet" style="padding:10px 14px;display:grid;gap:14px"><b>${cs.w("screen.leads.share.head")}</b>`
      + (projects.length ? cs.choice("ld-lsp", "screen.leads.share.project", projects.map((p) => ({ value: p.id, text: String(p.name || p.id) }))) + `<p class="mk-small muted">${cs.w("screen.leads.share.project.help")}</p>` : "")
      + cs.field("ld-lsr", "screen.leads.share.reason", { area: true, rec: true, max: 2000, help: "screen.leads.share.reason.help" })
      + `<div class="mk-acts">${cs.act("leadshare", { tone: "primary", data: { id: open.lead_id } })}</div>`
      + `<p class="mk-note">${cs.w("screen.leads.share.note1")} ${cs.w("screen.leads.share.note2")}</p></div>`;
    one = cs.sec("screen.leads.one.head", `<div style="display:grid;gap:14px">${cs.sheet(rows)}${record}${share}</div>`);
  }
  const failed = (id && D.one && D.one.state === "failed" ? cs.state(D.one, () => "") : "") + (D.list && D.list.state === "failed" ? cs.state(D.list, () => "") : "");
  return `<div class="mk-h">${cs.title()}<p class="mk-sub">${cs.w("screen.leads.intro1")} ${cs.w("screen.leads.intro2")}</p></div>` + write + list + failed + one;
}

/* R44: "Write down the lead" (`lead`): what the member was told or suspects, and where it might be found; their own words, the shell's
 * reason field (`reasonField`). It appears in the list by the shell reading every read again after an act, never from a copy kept here. */
function sendLead(view, el, cs) {
  const words = String(cs.value("ld-words") || "").trim(), where = String(cs.value("ld-where") || "").trim();
  cs.set("words", ""); cs.set("where", "");
  return { body: where ? { words, locator: where } : { words } };
}
function doneLead(view, answer, cs) { cs.set("draft", null); }

/* R44: "Open a lead" (`leadread`): the lead by its id, with every look and where it was shared. */
function sendRead(view, el, cs) { return { query: { id: el && el.dataset ? String(el.dataset.id || "") : "" } }; }
function doneRead(view, answer, cs) { cs.set("open", answer && typeof answer.lead_id === "string" ? answer : null); }

/* R44: "Record the look" (`leadlook`): what the look found (one of the four states), what it found if it found something (a document or a
 * passage the member can read, with which one), and where they looked and what they found (the reason field, `detail`). */
function sendLook(view, el, cs) {
  const state = ["LOOKED_ABSENT", "LOOKED_INDETERMINATE", "partial", "PRESENT"].find((s) => s === cs.value("ld-lks")) || "LOOKED_INDETERMINATE";
  const kind = ["capture", "content"].find((k) => k === cs.value("ld-lkk")) || "";
  const ref = String(cs.value("ld-lkr") || "").trim();
  const body = { lead: el && el.dataset ? String(el.dataset.id || "") : "", state, detail: String(cs.value("ld-lkd") || "").trim() };
  if (kind) { body.resultKind = kind; if (ref) body.resultRef = ref; }
  return { body };
}
/* R44: "Share it with the project" (`leadshare`): one project the member has joined, and why (the reason field). Cannot be taken back. */
function sendShare(view, el, cs) {
  return { body: { lead: el && el.dataset ? String(el.dataset.id || "") : "", project: String(cs.value("ld-lsp") || ""), reason: String(cs.value("ld-lsr") || "").trim() } };
}
/* after a look or a share the lead is read again, so the page shows exactly what the record holds */
async function doneChanged(view, answer, cs) {
  const open = view.ui && view.ui.open, id = (open && open.lead_id) || "";
  if (!id) return;
  const a = await cs.call("leadread", { query: { id } });
  const r = a && a.result && typeof a.result === "object" ? a.result : a;
  if (r && typeof r.lead_id === "string") cs.set("open", r);
}

/* R3, R10's pattern (DEC-153): help wording what the member was told, drawn only while the assistant is reachable; the draft is filled
 * into the words field, labelled, and kept only by the member's own `lead`. */
function sendHelp(view, el, cs) {
  const told = String(cs.value("ld-words") || "").trim();
  if (!told) return { refuse: "screen.capture.help.empty" };
  cs.set("where", cs.value("ld-where") || "");
  return { body: { op: "lead", field: "words", told } };
}
function doneHelp(view, answer, cs) {
  cs.fill("ld-words", String((answer || {}).text || ""));
  cs.set("draft", { handle: (view.me && view.me.handle) || "" });
}

export const LEADS_SCREEN = Object.freeze({
  id: "leads",
  reads: leadsReads,
  render: renderLeads,
  acts: Object.freeze([
    Object.freeze({ op: "lead", rereads: Object.freeze(["list"]), label: "act.lead.label.leads", send: sendLead, done: doneLead, reasonField: "words" }),
    Object.freeze({ op: "leadread", rereads: Object.freeze([]), label: "act.leadread.label.leads", send: sendRead, done: doneRead }),
    Object.freeze({ op: "leadlook", rereads: Object.freeze(["list"]), label: "act.leadlook.label.leads", send: sendLook, done: doneChanged, reasonField: "detail" }),
    Object.freeze({ op: "leadshare", rereads: Object.freeze(["list"]), label: "act.leadshare.label.leads", send: sendShare, done: doneChanged, reasonField: "reason" }),
    Object.freeze({ op: "writinghelp", rereads: Object.freeze([]), label: "act.writinghelp.label.leads", send: sendHelp, done: doneHelp, reasonField: "told" }),
  ]),
});
