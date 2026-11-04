/* screens-inquiry R1, R9–R11, R14, R16, R20, R21, R27–R30, R38–R40, R43, R44, R52–R54, R60, R63, R75–R77, R128: the project screen (Projects › <project>;
 * registry screen `project`).
 *
 * Self-contained functions (interface-shell R21 (1)); the readers they share are the screen's `parts` (common.mjs). The
 * subject read is `projectstage` (R21): it answers a project she cannot see as absent, and one she sees only to exist as
 * `PROJECT_SEEN_NOT_A_PARTICIPANT` with its name and owners, so the not-joined state (R1) and an administrator's rescue
 * (R30, state c) are drawn, never "Nothing is here".
 *
 * The project's questions (R9): `projectquestions`, paged to the end by its `cursor`, each with its `inquirystrength`; a
 * project with none (state b) asks "Your first question" (R43). Its own bar (R10) by `strengthbarof`, set by
 * `projectbarset`. "Open a question" writes the inquiry and draws it into the project (R11); "Draw on a question from
 * elsewhere" chooses among the questions she may see (R16). "This project's work" (R27): its plans (`plans`), and the
 * calculations, standards and timeline its own references name. Who can find it (R28, `projectvisibility`); its members
 * and owners (R29, `projectparticipants`, `projectownervotes`), the founder unnamed by key (R40). Every sentence a key.
 *
 * Fix round 3 (T51): "The project's documents" (R128; DEC-394 (3a)), every document filed under the project, read by `heldcaptures` and listed again by
 * its act; a project with no history of who can find it that was opened within the minute says it was started (C79; R28); a member the reads name is
 * drawn by her handle, never by her id (C94; R29, R40, R54). */

import { named } from "./question.mjs";

/** R1, R9, R27–R30: the reads, each `{op, query}` as its owner documents it. */
function reads(view) {
  const id = String(view.subject || "");
  /* K3379 (D29): the founder (`whoami`'s member `admin`) sees every discoverable project whole, and project-roster
     answers her `projectdirectory` with a refusal inside a 200 (N1129): it is not asked for her, nor before `whoami` */
  const me = view.me && view.me.member;
  const directory = me && me !== "admin" ? { directory: { op: "projectdirectory", query: {} } } : {};
  return {
    stage: { op: "projectstage", query: { project: id }, subject: true },
    project: { op: "image", query: { id }, empty: (v) => !v || typeof v !== "object" || !v["bundle.md"] },
    participants: { op: "projectparticipants", query: { projectId: id } },
    bar: { op: "strengthbarof", query: { project: id } },
    /* an empty first page is drawn by the screen's own state b, or paged on while a cursor follows */
    questions: { op: "projectquestions", query: { project: id, limit: "100" }, empty: () => false },
    others: { op: "list", query: { type: "inquiry", limit: "500" } },
    visibility: { op: "projectvisibility", query: { projectId: id } },
    /* R53: the team's declared stake and the project's own (project-roster R32), each its own state when it cannot be read */
    identity: { op: "groupidentity", query: {} },
    stake: { op: "projectstake", query: { projectId: id } },
    votes: { op: "projectownervotes", query: { projectId: id } },
    plans: { op: "plans", query: { project: id }, empty: (v) => !v || !(Array.isArray(v.plans) ? v.plans : v.items || []).length },
    /* R90: the determinations the project holds, which its Matter row opens; none held is a list of none, not an absence */
    dets: { op: "determinations", query: { project: id, live: "true", limit: "200" }, empty: () => false },
    /* R128 (DEC-394 (3a); capture R77, R88): the documents filed under the project, held and vouched, as picker rows (G12a: title, id, the capture's
       day, and its `format`; the full row's examinations of every capture with no recorded format cost the page seconds), one bounded page at a time;
       none filed is a list of none, not an absence */
    docs: { op: "heldcaptures", query: { project: id, state: "held_and_vouched", limit: "200", fields: "picker" }, empty: () => false },
    /* R107: the project's reruns of imported editions (case-import R31); a project that is no rerun answers none, and no tab is drawn */
    rerun: { op: "rerunread", query: { project: id }, empty: (v) => !v || !Array.isArray(v.reruns) || !v.reruns.length },
    ...directory,
  };
}

/** R117: the words of a refusal's findings (`findings[]`: `{check, code?, detail}`), each by the key of its code or check
 *  (`refusal.<code>`) when the table holds one, else its own detail as the plane states it; "" when it names none, so the
 *  code's own sentence stands. Self-contained (interface-shell R21 (1)). */
function findingWords(cs, list) {
  const out = [];
  for (const f of Array.isArray(list) ? list.slice(0, 5) : []) {
    if (!f || typeof f !== "object") continue;
    let said = "";
    for (const c of [f.code, f.check]) {
      const key = typeof c === "string" && c ? "refusal." + c : "";
      if (key && cs.w(key) !== key) { said = cs.w(key); break; }
    }
    if (!said && (f.detail || f.message)) said = cs.esc(String(f.detail || f.message));
    if (said) out.push(said);
  }
  return out.join(" ");
}

/** The path's project step: the project's title as read (R39: never its id). */
function place(view) {
  const d = view.data && view.data.project;
  const text = d && d.state === "ok" && d.value && d.value["bundle.md"];
  const st = view.data && view.data.stage;
  const named = st && st.refusal && st.refusal.name ? String(st.refusal.name) : "";
  if (typeof text !== "string") return { project: { id: String(view.subject || ""), title: named } };
  const m = /^title:\s*(.*)$/m.exec(text.split(/\n---\s*\n/)[0] || "");
  let title = m ? m[1].trim() : "";
  try { if (title.startsWith("\"")) title = JSON.parse(title); } catch { /* the raw value is drawn */ }
  return { project: { id: String(view.subject || ""), title: title || named } };
}

/** The project in its state: not joined, the rescue, or its work. */
function render(cs, view) {
  const id = String(view.subject || "");
  if (!id) return "";
  const ui = view.ui;
  const d = view.data || {};
  const P = view.parts;
  const W = (k, f) => cs.w(k, f);
  const T = (k, f) => P.plain(cs, k, f);
  const later = (key, op, query, token) => P.later(cs, ui, key, op, query, token);
  /* C94 (R40, R54): a member the reads name is drawn by her handle: a handle the roster holds as it is, any other id or stamp by the kit's
     `cs.memberName` (the founder with no handle known, and any member with none, by a plain word), never the id; `P.who` is the fallback
     where the kit holds no `memberName` */
  const rosterRows = d.participants && d.participants.state === "ok" && d.participants.value && Array.isArray(d.participants.value.participants) ? d.participants.value.participants : [];
  const whoIs = (x, founder) => {
    /* R40: project-roster names an actor by handle, and gives `null` only for the founder who chose none (index.mjs `#handleOf`: the root admin's handle, any other member by her handle or her id), so a null
       (or the empty stand-in for it) is the unnamed founder, drawn by her key, never blank */
    if (x === null || x === "") return P.who(cs, { founder: true });
    const s = typeof x === "string" ? x.replace(/^(member:|token:)/, "") : "";
    const row = s ? rosterRows.find((r) => r && r.handle && r.handle === s) : null;
    return row ? P.who(cs, row, founder) : P.named(cs, x, founder, P.who);
  };
  const doc = d.project && d.project.state === "ok" ? P.front(d.project.value["bundle.md"]) : null;
  /* a project she sees only to exist: its subject read refused PROJECT_SEEN_NOT_A_PARTICIPANT, read once more for the
     refusal's own fields (its `name` and `owners`, project-roster's existence answer) */
  const seenCode = ["stage", "participants", "bar"].some((k) => d[k] && d[k].refusal && d[k].refusal.code === "PROJECT_SEEN_NOT_A_PARTICIPANT");
  const seenRead = seenCode ? later("seen", "projectstage", { project: id }) : null;
  const seen = seenCode ? Object.assign({ code: "PROJECT_SEEN_NOT_A_PARTICIPANT" }, (seenRead.refusal && seenRead.refusal.fields) || {}) : null;
  const listed = d.directory && d.directory.state === "ok" && Array.isArray(d.directory.value.projects)
    ? d.directory.value.projects.find((p) => p && p.id === id) : null;
  /* R39: the title read from the record (or the directory's, or the refusal's name), never its id */
  const title = (doc && doc.title) || (listed && (listed.name || listed.title)) || (seen && seen.name) || "";
  /* C81 (R5): the phone's grid (`:root:root .cs-row`) puts the second and later children in the second column and assumes a first element, so a
     row with nothing to lead it is given an empty one, never "" (which leaves no first element and squeezes its text beside its acts) */
  const lead = "<span aria-hidden=\"true\"></span>";
  const out = [];
  out.push(cs.title(title || T("state.undetermined", { reason: "" }), { thing: "project" }));

  /* R30, state c: an administrator at a hidden project's existence only, whose owners are all inactive */
  if (seen && view.me && view.me.administer === true) {
    const aff = later("rescue", "affordances", { target: id });
    /* R30 (K5148; WALK-FINAL-03b §7): the plane offers the rescue where the act accepts it, as an act of the answer's own `acts`
       (affordances R18); the answer carries no `roster` */
    const rescueOpen = aff.state === "ok" && !!aff.value && Array.isArray(aff.value.acts) && aff.value.acts.some((a) => a && a.id === "projectownerrescue");
    /* R54: the date of the rescue's title is `projectownersgone`'s `since`; none recorded draws the title without one */
    const gone = rescueOpen ? later("gone", "projectownersgone", { projectId: id }) : null;
    if (gone && gone.state === "loading") { out.push(cs.state({ state: "loading" }, () => "")); return out.join(""); }
    if (rescueOpen) {
      const owners = (Array.isArray(seen.owners) ? seen.owners : []).map((o) => whoIs(o)).join(", ");
      const since = gone && gone.state === "ok" && gone.value && gone.value.since ? String(gone.value.since) : "";
      out.push(cs.sec(since ? "project.rescue.title" : "project.rescue.title.nodate", `<p>${W("project.rescue.says", { owners })}</p>`
        + cs.field("project-rescue-why", "shell.reason", { area: true, rec: true, help: "shell.reason.help" })
        + cs.act("projectownerrescue", { label: "act.projectownerrescue.label.project", data: { project: id }, tone: "primary" })
        + `<p class="mk-small">${W("project.rescue.own")}</p>`, { fills: { date: since ? { html: cs.date(since, { year: true }) } : "" }, id: "state-rescue" }));
      return out.join("");
    }
    if (aff.state === "loading") { out.push(cs.state({ state: "loading" }, () => "")); return out.join(""); }
  }

  /* not joined (R1, R60): an invited member joins; a findable project (the directory lists it) shows its name with "Ask to
     join" and her open request; a hidden one is unavailable (state b), with no form */
  const me = view.me && view.me.handle;
  /* R40 (K5148; WALK-FINAL-03 R24): the viewer is found in a roster by `member`, else by handle: a founder who chose no handle has
     `handle: null` in the roster and in `whoami`, and is still the owner whose row reads "founder" */
  const isMe = (x) => P.isMe(view, x);
  /* R1, R60: an invited member who has not joined is a participant to the roster but not to the project's reads: she sees
     the not-joined state, never a failed read */
  const roster = d.participants && d.participants.state === "ok" && Array.isArray(d.participants.value.participants)
    ? d.participants.value.participants.find(isMe) : null;
  const invited = !!(roster && roster.state === "invited");
  const notJoined = !!seen || !!listed || invited;
  if (notJoined) {
    const owners = seen && Array.isArray(seen.owners) && seen.owners.length ? seen.owners.map((o) => whoIs(o)).join(", ") : "";
    if (!invited && !listed) return out.join("") + P.unavailable(cs);
    const req = listed && listed.request && listed.request.state === "open" ? listed.request : null;
    /* R60 (K5157; WALK-FINAL-03b §3; project-roster R44): her latest request when the owners declined it: the day and the owners' word (the
       request's `closed_comment`, record data), drawn above the way to ask again; a granted one is drawn no sentence (she is invited) */
    const declined = listed && listed.request && listed.request.state === "declined" ? listed.request : null;
    out.push(cs.sec("screen.project.members.head",
      `<p>${W("screen.project.notjoined")}</p>${owners ? `<p>${W("screen.project.notjoined.owners", { owners })}</p>` : ""}`
      + (declined && !invited ? `<p class="mk-note" data-request="declined">${declined.closed ? cs.date(String(declined.closed), { year: true }) : ""}`
          + (declined.closed_comment ? ` <span class="rec" data-request="comment">${cs.esc(String(declined.closed_comment))}</span>` : "") + "</p>" : "")
      + (invited ? cs.act("projectjoin", { label: "act.projectjoin.label.project", data: { project: id }, tone: "primary" })
        : req ? `<p class="mk-note" data-request="asked">${W("projects.request.asked", { date: { html: req.asked ? cs.date(String(req.asked), { year: true }) : "" } })}</p>`
            + cs.act("projectrequestwithdraw", { label: "act.projectrequestwithdraw.label.project", data: { project: id } })
          : cs.act("projectrequest", { label: "act.projectrequest.label.project", data: { project: id }, tone: "primary" }))));
    return out.join("");
  }
  if (doc && doc.objective && doc.objective !== title)
    out.push(`<p class="mk-sub"><span class="mk-small">${W("screen.project.objective")}</span> ${cs.esc(doc.objective)}</p>`);
  /* R107: a rerun of another team's edition says so, and offers its "Compare with the original" tab (the comparison itself follows the
     questions); a project that is no rerun draws neither, and a read that failed is drawn failed */
  const rr = d.rerun;
  const reruns = rr && rr.state === "ok" && rr.value && Array.isArray(rr.value.reruns) ? rr.value.reruns.filter((r) => r && typeof r === "object") : [];
  if (rr && rr.state === "failed") out.push(`<div data-rerun="failed">${cs.state(rr, () => "")}</div>`);
  if (reruns.length) out.push(reruns.map((r) => `<p class="mk-sub" data-rerun="head">${W("screen.project.cmp_head", { title: String(r.case || ""), edition: String(r.edition), team: String(r.group || "") })} ${W("screen.project.cmp_unchanged")}</p>`).join("")
    + cs.act("rerunread", { tone: "primary" }));
  const people = d.participants && d.participants.state === "ok" && Array.isArray(d.participants.value.participants)
    ? d.participants.value.participants.filter((x) => x && x.state !== "removed") : [];
  const mine = people.find(isMe) || null;
  const joined = !!(mine && mine.state === "joined");
  const owner = !!(mine && Number(mine.owner) && mine.state === "joined");

  /* the stage (project-stage R2): a count is drawn only above zero (R20) */
  const counts = (q) => {
    const parts = [["read", q.read], ["legs", q.with_legs], ["concluded", q.concluded]].filter(([, n]) => Number(n) > 0)
      .map(([k, n]) => W("screen.project.stage." + k, { count: String(n) }));
    return parts.length ? `<p class="mk-small">${parts.join(" · ")}</p>` : "";
  };
  out.push(cs.sec("screen.project.stage.head", cs.state("stage", view, (s) => {
    const k = ["forming", "investigating", "matured", "closed"].includes(s.stage) ? s.stage : "undetermined";
    const steps = ["forming", "investigating", "matured", "closed"].map((x) =>
      `<span class="${x === k ? "on" : ""}"${x === k ? " aria-current=\"step\"" : ""}>${W("screen.project.stage." + x)}</span>`).join("");
    /* R109: a project closed by its owner reads closed with the reason she recorded */
    const why = k === "closed" && ["resolved", "superseded", "abandoned"].includes(s.closed_reason) ? s.closed_reason : "";
    return `<div class="cs-ladder" data-ladder="stage">${steps}</div>`
      + (why ? `<p class="mk-small"><span data-closed-reason="${why}">${W(why === "superseded" ? "screen.project.closenow.superseded" : "state.item." + why + ".name")}</span></p>` : "")
      + (k === "undetermined" ? cs.mark("gap", "undetermined", { reason: s.detail || "" }) : "") + counts(s.questions || {});
  })));

  /* R10, R52 (2), (3): the project's bar read in words, in the one of its four cases that is true (never as zero); the
     setting is in the foot's fold. "Bar" a card: the project's meaning, the team's when it has none of its own */
  /* R10 (K5157; strength R45): after a `BAR_STALE` refusal the bar now held (its `previous`) is the bar drawn, so the next save names it */
  const barNow = ui.barNow && typeof ui.barNow === "object" ? ui.barNow : null;
  const barRead = barNow || (d.bar && d.bar.state === "ok" && d.bar.value ? (d.bar.value.bar || {}) : null);
  const barDeclared = !!(barRead && barRead.declared === true && (barRead.capture || barRead.connection));
  out.push(cs.sec("screen.project.bar.head", cs.state("bar", view, () => {
    const c = barRead.capture, k = barRead.connection;
    return `<p data-bar="${!barDeclared ? "none" : c && k ? "both" : c ? "source_only" : "connection_only"}">`
      + (!barDeclared ? W("project.bar.none") : c && k ? W("project.bar.both", { source: c, connection: k })
        : c ? W("project.bar.source_only", { source: c }) : W("project.bar.connection_only", { connection: k })) + "</p>";
  }), { help: barDeclared ? "term.bar.project.means" : "term.bar.team.means" }));

  /* R94 (C64; project-stage R4): what each stage needs. An unreached stage draws why it is not reached and what it needs; a reached
     stage draws neither. Drawn only when the stage read answers its `stages` (R20). */
  const sr = d.stage && d.stage.state === "ok" && d.stage.value ? d.stage.value : null;
  const stages = sr && Array.isArray(sr.stages) ? sr.stages : null;
  if (stages) {
    const rows = ["forming", "investigating", "matured", "closed"].map((k) => stages.find((x) => x && x.stage === k)).filter(Boolean).map((x) => {
      const reached = x.reached === true;
      const conds = !reached && x.needs && Array.isArray(x.needs.any_of) ? x.needs.any_of.map((c) => (c && c.condition ? String(c.condition) : "")).filter(Boolean) : [];
      const either = conds.includes("concluded_held_question") && conds.includes("ratified_case_edition");
      const meta = reached ? "" : (x.why ? `<span data-why="1">${cs.esc(String(x.why))}</span>` : "")
        + (either ? ` <span data-need="1">${W("screen.project.either.one.reaches.it.the.project", { held: String(Number((sr.questions || {}).read) || 0) })}</span>` : "");
      return `<div data-stage="${cs.esc(x.stage)}" data-reached="${reached ? "yes" : "no"}"${conds.length ? ` data-needs="${cs.esc(conds.join(" "))}"` : ""}>`
        + cs.row(cs.icon(reached ? "accepted" : "clock"), `<b>${W("screen.project.stage." + x.stage)}</b>`, "", meta) + "</div>";
    }).join("");
    out.push(cs.sec("screen.project.what.each.stage.needs", `<p class="mk-small">${W("screen.project.the.record.decides.the.stage.by")} ${W("screen.project.nothing.here.is.a.button.when")}</p>${cs.sheet(rows)}`,
      { help: ["screen.project.help.for.each.stage.what.it.took", "screen.project.help.counts.come.from.the.record.each"] }));
  }

  /* R109 (C65; DEC-381): "Close this project now", an owner's, after what each stage needs: what is still open, why she is closing it
     (none chosen for her), an optional note, and the act, with the sentence that it closes now and keeps what was open beside her
     reason. A project already closed offers no close. */
  if (owner && sr && sr.stage !== "closed") {
    const open = stages ? stages.find((x) => x && x.reached === false && x.stage !== "closed") : null;
    const q = sr.questions || {};
    out.push(cs.sec("screen.project.closenow.head",
      (open && Number.isFinite(Number(q.read)) ? `<div data-closenow="open">${cs.sheet(cs.row(cs.icon("clock"), W("screen.project.closenow.open",
        { stage: T("screen.project.stage." + open.stage), count: String(Number(q.concluded) || 0), total: String(Number(q.read)) })))}</div>` : "")
      + cs.checks("project-close-why", "screen.project.closenow.why", [["resolved", "state.item.resolved.name"], ["superseded", "screen.project.closenow.superseded"], ["abandoned", "state.item.abandoned.name"]], { radio: true })
      + cs.field("project-close-note", "screen.imported.citeimp.note", { area: true, rec: true })
      + cs.act("projectclose", { tone: "primary" })
      + `<p class="mk-note">${W("screen.project.closenow.note1")} ${W("screen.project.closenow.note2")}</p>`, { help: "screen.project.closenow.tip" }));
  }

  /* R128 (DEC-394 (3a); capture R77, R88): "The project's documents", after the project's acts and before its objective as the drawing has
     it: every document filed under the project, held or vouched for, read by `heldcaptures` (`state` `held_and_vouched`, picker rows, a
     page of 200 at a time, read to its end). Each row is its title, a reference opening the document, and beneath it its kind (web page,
     spreadsheet or photo) where the row states a format or a content type, then `captured` and the day of its capture; a row that states no
     kind draws none, never a guess, and one that states no day draws none. None filed says so in the designed two sentences; a read that
     failed is drawn failed. The act `heldcaptures` lists them again. */
  {
    const dr = d.docs;
    const listed = [];
    let dmore = dr && dr.state === "ok" ? dr.value : null, dpend = !dmore && !!dr && dr.state === "loading", dfail = dr && dr.state === "failed" ? dr : null;
    const dgen = String(ui.dgen || 0);
    for (let i = 0; dmore && i < 20; i++) {
      listed.push(...(Array.isArray(dmore.held) ? dmore.held : []));
      if (!(dmore.truncated && dmore.next)) { dmore = null; break; }
      const nx = later("dpage:" + dgen + ":" + dmore.next, "heldcaptures", { project: id, state: "held_and_vouched", limit: "200", fields: "picker", after: String(dmore.next) });
      if (nx.state === "loading") { dpend = true; dmore = null; } else if (nx.state === "failed") { dfail = nx; dmore = null; } else dmore = nx.value;
    }
    const kindOf = (r) => {
      const f = String(r.format || "").toLowerCase(), ct = String(r.content_type || "").toLowerCase();
      if (f === "html" || /^text\/html|^application\/xhtml/.test(ct)) return "web";
      if (["xlsx", "ods", "csv"].includes(f) || /spreadsheet|ms-excel|^text\/csv|tab-separated/.test(ct)) return "sheet";
      if (["jpeg", "png"].includes(f) || /^image\//.test(ct)) return "photo";
      return "";
    };
    const docRow = (r) => {
      const title = String(r.title || "") || T("state.undetermined", { reason: "" });
      const at = r.retrieved || (r.source && r.source.retrieved) || "";
      const kind = kindOf(r);
      const meta = [kind ? W("screen.project.docs.kind." + kind) : "", at ? W("screen.project.docs.captured") + " " + cs.date(String(at), { year: true }) : ""].filter(Boolean).join(" \u00b7 ");
      return cs.row(cs.icon("capture"), cs.ref("document", String(r.bundle_id || ""), title, [title]), "", meta);
    };
    const rows = listed.filter((r) => r && r.bundle_id);
    const body = dfail ? cs.state(dfail, () => "")
      : `<p class="mk-small">${W("screen.project.docs.about1")} ${W("screen.project.docs.about2")}</p>`
        + (rows.length ? cs.sheet(rows.map(docRow).join("")) : dpend ? cs.state({ state: "loading" }, () => "") : `<p class="mk-note">${W("screen.project.docs.none1")} ${W("screen.project.docs.none2")}</p>`)
        + (dpend && rows.length ? cs.state({ state: "loading" }, () => "") : "");
    if (dr) out.push(cs.sec("screen.project.docs.head", body + `<div class="mk-acts">${cs.act("heldcaptures", { label: "act.heldcaptures.label.project", data: { project: id } })}</div>`, { help: "screen.project.docs.listhelp", id: "docs" }));
  }

  /* R106 (the project's half): the objective has its own page, which the project opens with its id */
  out.push(cs.sec("screen.objective.name", `<p class="mk-small">${W("screen.project.how-far-the-project-has-come-toward-its-objectiv")} `
    + `<a class="cs-btn" data-tone="quiet" href="/app/objective/${cs.esc(id)}" data-nav data-work="objective">${cs.esc(T("screen.objective.name"))}</a>` + "</p>"));

  /* R9: the project's questions, paged to the end; each a reference opening `question`, with its strength */
  const pages = [];
  let more = d.questions && d.questions.state === "ok" ? d.questions.value : null;
  let pending = !more && d.questions && d.questions.state === "loading", failed = null;
  const gen = String(ui.qgen || 0);
  for (let i = 0; more && i < 50; i++) {
    pages.push(...(Array.isArray(more.items) ? more.items : []));
    if (!more.cursor) { more = null; break; }
    const next = later("qpage:" + gen + ":" + more.cursor, "projectquestions", { project: id, after: String(more.cursor), limit: "100" });
    if (next.state === "loading") { pending = true; more = null; }
    else if (next.state === "failed") { failed = next; more = null; }
    else more = next.value;
  }
  const items = pages.filter((x) => x && x.inquiry);
  const firstQuestion = d.questions && d.questions.state === "ok" && !items.length && !pending && !failed;
  const nd = ui.notDrawn;
  /* R117: a refusal that names its findings draws each finding's words (by the key of its check, else its detail), not only the
     code's generic sentence */
  const said = (ui.promoteRefusal ? `<p class="mk-msg" role="alert" data-refusal="promote">${P.findings(cs, ui.promoteRefusal.findings)
      || (ui.promoteRefusal.translation ? cs.esc(ui.promoteRefusal.translation) : W("state.failed", { reason: ui.promoteRefusal.code || "" }))}</p>` : "")
    + (nd ? `<p class="mk-msg" role="alert" data-refusal="drawquestion">${W("screen.project.questions.notdrawn",
        { reason: nd.translation || nd.code || "" })} ${cs.ref("question", nd.id, nd.title || T("state.undetermined", { reason: "" }), [nd.title || ""])}</p>` : "");
  const adddoc = `<a class="cs-btn" data-tone="quiet" href="/app/capture/address/${cs.esc(id)}" data-nav data-adddoc="project">${W("project.adddoc")}</a>`;
  if (firstQuestion) {
    /* R43, state b: "Your first question", before "Open a question", sent as R11's two steps */
    out.push(cs.sec("project.firstquestion", cs.field("project-question", "project.firstquestion", { area: true, rec: true, help: "project.firstquestion.help" })
      + cs.act("promote", { label: "act.promote.label.project", data: { project: id }, tone: "primary" })
      + `<p class="mk-small">${W("act.promote.here.project")}</p>` + said + adddoc, { id: "state-b" }));
  } else {
    /* G12c (R1, R9): the strength of every question in one read (for each 50), never one read for each */
    const strengthOf = P.strengths((k, query) => later(k, "inquirystrength", query), items.map((x) => x.inquiry), cs.esc);
    const qInner = cs.state("questions", view, () => cs.sheet(items.map((x) => {
      const q = String(x.inquiry);
      const t = x.title || T("state.undetermined", { reason: "" });
      const st = strengthOf(q);
      const grades = cs.state(st, (s) => {
        /* C43 (R39, R116): the card names no record id: an unrated axis is told once, by its mark (the question page's compact form,
           which draws no reason on the quiet axis), and an undetermined axis's reason has any record id put back into the plain
           word for a document, as the question page does for a leg with no title */
        const bare = (text) => String(text || "").replace(/\b(?:INQ|INFO|PROJ|EVT|CALC|STD|DET)-\d{4}-\d{4}[\w-]*/g, () => T("shell.card.document"));
        const told = new Set();
        const ax = (a) => {
          if (s[a] && s[a].state === "graded") return cs.grade(a, s[a].grade);
          if (s[a] && s[a].state === "undetermined") { const why = bare(s[a].detail); const first = !told.has(why); told.add(why); return cs.mark("gap", "undetermined", { reason: first ? why : "" }); }
          return cs.mark("gap", "unrated", { reason: "" });
        };
        return `<span class="cs-strength">${ax("capture")}${ax("connection")}</span>`;
      });
      return cs.row(lead, cs.ref("question", q, t, [t]), grades);
    }).join("")) + (pending ? cs.state({ state: "loading" }, () => "") : "") + (failed ? cs.state(failed, () => "") : ""));
    out.push(cs.sec("screen.project.questions.head", qInner
      + cs.field("project-question", "screen.project.question.label", { area: true, rec: true, help: "screen.project.question.help" })
      + cs.act("promote", { label: "act.promote.label.project", data: { project: id }, tone: "primary" })
      + `<p class="mk-small">${W("act.promote.here.project")}</p>` + said
      + cs.act("findin", { label: "act.findin.label.project", data: { project: id } }) + adddoc));
  }

  /* R16: "Draw on a question from elsewhere", record data drawn as data (R8) */
  const drawAct = cs.act("drawquestion", { label: "act.drawquestion.label.project", data: { project: id } });
  if (drawAct) {
    const drawn = new Set(items.map((x) => String(x.inquiry)));
    const drawInner = cs.state("others", view, (v) => {
      /* C35 (R16, R1), C14: one option per question (a row the list repeats is one). A question is named with its project where the project is
         known: the one its list row states (`project`), else, only where its title is another candidate's too (the two are told apart by their
         project), the one its own `image` states: a read for each such question, never one `projectquestions` read for each project she may see
         (`list` rows carry no project; the project's name is `projectlist`'s, project-roster R26). A question whose project is not known is
         named by its title alone. */
      const seen = new Set();
      const rows = (Array.isArray(v.bundles) ? v.bundles : []).filter((q) => q && q.bundle_id && !drawn.has(q.bundle_id) && q.title)
        .filter((q) => (seen.has(String(q.bundle_id)) ? false : (seen.add(String(q.bundle_id)), true)));
      if (!rows.length) return "";
      const projectOf = new Map();
      const pl = later("projects", "projectlist", { limit: "200" });
      const nameOf = new Map((pl.state === "ok" && pl.value && Array.isArray(pl.value.projects) ? pl.value.projects : []).filter((x) => x && x.id && x.name).map((x) => [String(x.id), String(x.name)]));
      const sameTitle = new Map();
      for (const q of rows) sameTitle.set(String(q.title), (sameTitle.get(String(q.title)) || 0) + 1);
      for (const q of rows) {
        let pid = /^PROJ-/.test(String(q.project || "")) ? String(q.project) : "";
        if (!pid && sameTitle.get(String(q.title)) > 1 && pl.state !== "loading") {
          const qi = later("qimg:" + q.bundle_id, "image", { id: String(q.bundle_id) });
          const qf = qi.state === "ok" && qi.value && typeof qi.value["bundle.md"] === "string" ? P.front(qi.value["bundle.md"]) : null;
          pid = qf && /^PROJ-/.test(String(qf.project || "")) ? String(qf.project) : "";
        }
        if (pid && nameOf.has(pid)) projectOf.set(String(q.bundle_id), nameOf.get(pid));
      }
      const opts = rows.map((q) => (projectOf.has(String(q.bundle_id))
        ? { value: String(q.bundle_id), key: "screen.document.cite.option", fills: { question: String(q.title), project: projectOf.get(String(q.bundle_id)) } }
        : { value: String(q.bundle_id), text: String(q.title) }));
      return cs.choice("project-draw-question", "screen.project.draw.choose", opts, { value: opts[0].value })
        + cs.field("project-draw-note", "screen.project.draw.note", { rec: true, help: "screen.project.draw.help" }) + drawAct
        + (ui.drawSaid ? `<p class="mk-note" role="status" data-said="drawquestion">${W(ui.drawSaid)}</p>` : "");
    });
    if (drawInner) out.push(cs.sec("screen.project.draw.head", drawInner));
  }

  /* R27, R36, R52 (1), R63: this project's work, every screen that works within a project as the kit's reference link
     with its card. A kind it has none of is still listed (the first one can be made), with the project as subject; its
     published cases and docket are listed only when it has published one (the ceremony, listed, is what makes one) */
  const planList = d.plans && d.plans.state === "ok" ? (Array.isArray(d.plans.value.plans) ? d.plans.value.plans : d.plans.value.items || []) : [];
  const plans = planList.concat((Array.isArray(ui.plans) ? ui.plans : []).filter((p) => !planList.some((x) => x && (x.id || x.plan) === p.id)));
  const refs = doc ? (doc.lists.references || []).filter((r) => r && r.target && r.status !== "severed") : [];
  const work = [];
  const kindName = (kind) => T("screen." + kind + ".name");
  const own = { plan: [], timeline: [], money: [], calculation: [], proceeding: [], standard: [], request: [], matter: [], action: [],
    "case-editor": [], "review-copy": [], ceremony: [] };
  for (const p of plans) if (p && (p.id || p.plan)) own.plan.push([String(p.id || p.plan), String(p.title || T("state.undetermined", { reason: "" }))]);
  if (refs.some((r) => /^EVT-/.test(String(r.target)))) own.timeline.push([id, kindName("timeline")]);
  for (const r of refs) {
    const t = String(r.target);
    if (/^CALC-/.test(t)) own.calculation.push([t, String(r.title || kindName("calculation"))]);
    else if (/^STD-/.test(t)) own.standard.push([t, String(r.title || kindName("standard"))]);
  }
  /* R90, R115 (K4170, K4259): a Matter row opens the determination the project holds, a Calculation row the calculation it holds. With no
     determination held the Matter row opens `/app/matter/<project>` (the project needs a door to its first determination); with no
     calculation held the kind is listed and opens nothing. The Action row opens the actions dashboard. */
  const dl = d.dets && d.dets.state === "ok" && d.dets.value && Array.isArray(d.dets.value.items) ? d.dets.value.items : [];
  for (const x of dl) if (x && x.id) own.matter.push([String(x.id), String((x.act && (x.act.event || x.act.id)) || kindName("matter"))]);
  for (const kind of Object.keys(own)) {
    if (!own[kind].length) own[kind].push([kind === "action" ? "@dash-action" : kind === "calculation" ? null : id, kindName(kind)]);
    for (const [sid, label] of own[kind]) work.push([kind, sid, label]);
  }
  /* R63: the published cases this project is the publisher of, read from the published editions (a case once however many
     editions it has); a read that fails is drawn failed, never as none */
  const pub = later("published", "publishedlist", {});
  const caseIds = pub.state === "ok" && pub.value && Array.isArray(pub.value.cases)
    ? [...new Set(pub.value.cases.map((c) => c && c.case_id).filter(Boolean).map(String))] : [];
  const ours = [];
  let pubPending = pub.state === "loading";
  for (const cid of caseIds) {
    const latest = Math.max(...pub.value.cases.filter((c) => c && String(c.case_id) === cid).map((c) => Number(c.edition) || 0));
    const one = later("pubcase:" + cid, "publishedcase", { id: cid, edition: String(latest) });
    if (one.state === "loading") pubPending = true;
    else if (one.state === "ok" && one.value && one.value.project === id) ours.push(cid);
  }
  for (const cid of ours) { work.push(["published", cid, kindName("published")]); work.push(["docket", cid, kindName("docket")]); }
  const workRows = work.map(([kind, sid, label]) =>
    cs.row(lead, (() => {
      if (sid === "@dash-action") return `<a class="cs-btn" data-tone="quiet" href="/app/dash-action" data-nav data-work="dash-action">${cs.esc(label)}</a>`;
      const h = String(cs.ref(kind, sid, label, [T("shell.card." + kind)]));
      return /^<a /.test(h) ? h : `<span class="rec">${cs.esc(label)}</span>`;
    })(), ""));
  out.push(cs.sec("project.work.title", cs.sheet(workRows.join(""))
    + (pub.state === "failed" ? cs.state(pub, () => "") : pubPending ? cs.state({ state: "loading" }, () => "") : ""), { help: "project.work.help" }));
  /* the act that opens a plan, for one of the project's questions */
  const choices = items.map((x) => ({ value: String(x.inquiry), text: String(x.title || T("state.undetermined", { reason: "" })) }));
  if (choices.length) out.push(cs.sec("screen.project.plan.head", cs.field("project-plan", "screen.project.plan.label", {})
    + cs.choice("project-plan-about", "screen.project.plan.about", choices, {})
    + cs.act("planopen", { label: "act.planopen.label.project", data: { project: id } })));

  /* R107: "Compare with the original", opened by its tab: the lens difference as two lists above the source's findings, each beside the
     project's paired finding and the two grades; pairing is her statement (rerunpair), withdrawn by the same act */
  if (reruns.length && ui.compare === true) {
    let n = 0;
    const title = (qid) => { const it = items.find((x) => String(x.inquiry) === String(qid)); return it && it.title ? String(it.title) : T("state.undetermined", { reason: "" }); };
    const grade = (pair, a) => { const g = pair && pair[a]; return g && g.state === "graded" && g.grade ? cs.grade(a, g.grade) : cs.mark("gap", g && g.state === "undetermined" ? "undetermined" : "unrated", { reason: (g && g.detail) || "" }); };
    const pairOf = (pair) => `<span class="cs-strength">${grade(pair, "capture")}${grade(pair, "connection")}</span>`;
    const list = (name, head, rows) => `<div data-lens="${name}"><b>${head}</b>${cs.sheet(rows.map((r) => cs.row(cs.icon("flagged"),
      `<span class="mk-data">${cs.esc([r.kind, r.subject].filter(Boolean).join(" \u00b7 "))}</span> <span class="rec">\u201c${cs.esc(r.text || "")}\u201d</span>`)).join(""))}</div>`;
    const pick = [{ value: "", key: "screen.project.cmp_pair_none" }].map((o) => [o.value, o.key]);
    const body = reruns.map((r) => {
      const diff = r.lens_difference && typeof r.lens_difference === "object" ? r.lens_difference : null;
      const lenses = diff ? cs.sec("screen.project.cmp_lens_diff", `<div class="mk-grid2">${list("only_source", W("screen.project.cmp_only_theirs"), Array.isArray(diff.only_source) ? diff.only_source : [])}${list("only_own", W("screen.project.cmp_only_ours"), Array.isArray(diff.only_own) ? diff.only_own : [])}</div>`
          + `<p class="mk-small">${W("screen.project.cmp_both", { count: String(Number(diff.shared) || 0) })}</p>`)
        : `<p class="mk-small" data-lens-note="1">${cs.esc(String(r.lens_difference_stated || ""))}</p>`;
      const rows = (Array.isArray(r.findings) ? r.findings : []).map((f) => {
        const k = n++;
        const pairs = Array.isArray(f.pairings) ? f.pairings : [];
        const agree = !pairs.length ? "" : pairs.some((x) => x.agree === false) ? "false" : pairs.every((x) => x.agree === true) ? "true" : "undetermined";
        const lines = pairs.map((x) => `<span class="meta" data-side="ours">${W("screen.project.cmp_paired", { finding: title(x.own_finding) })} ${pairOf(x.pair)}${x.agree === false ? " " + W("screen.project.cmp_differ") : ""}</span>`).join("");
        const control = pairs.length
          ? pairs.map((x) => cs.act("rerunpair", { label: "screen.project.cmp_withdraw_do", tone: "quiet", data: { source: String(f.ref || ""), own: String(x.own_finding), edition: String(r.edition), withdraw: "yes" } })).join("")
          : cs.choice("project-pair-own-" + k, "screen.project.cmp_pair_label", pick.concat(items.map((x) => ({ value: String(x.inquiry), text: String(x.title || "") }))), {})
            + cs.act("rerunpair", { data: { source: String(f.ref || ""), edition: String(r.edition), n: String(k) } });
        return `<div data-source-finding="${cs.esc(f.finding)}"${agree ? ` data-agree="${agree}"` : ""}>`
          + cs.row(cs.icon("finding"), `<span class="rec">${cs.esc(f.finding)}</span><span class="meta" data-side="theirs">${pairOf(f.source && f.source.pair)}</span>${lines}`
            + (pairs.length ? "" : `<span class="meta">${W("screen.project.cmp_unpaired")}</span>`), "") + `<div class="mk-acts">${control}</div></div>`;
      }).join("");
      return lenses + cs.sec("screen.project.cmp_findings", rows + (rows ? `<p class="mk-small">${W("screen.project.cmp_pair_is")} ${W("screen.project.cmp_pair_strength")} ${W("screen.project.cmp_pair_withdraw")}</p>` : ""));
    }).join("");
    out.push(cs.sec("act.owed_rerunread.label.project", `<div data-rerun="compare"><p class="mk-small">${W("screen.project.cmp_names")} ${W("screen.project.cmp_not_cause")}</p>${body}</div>`));
  }

  /* C79 (R28): a project with no history of who can find it yet, opened within the minute it was started (its record's own `created`
     against the page's clock), says it was started, with the setting it has and the day; the foot's fold that holds the sentence is open
     while it is so new, so the member sees it */
  const vv = d.visibility && d.visibility.state === "ok" && d.visibility.value ? d.visibility.value : null;
  const born = doc && doc.created ? Date.parse(String(doc.created)) : NaN;
  const fresh = !!vv && !(Array.isArray(vv.history) && vv.history.length) && Number.isFinite(born) && Math.abs(cs.now() - born) <= 60000;
  /* R28: who can find it, its history newest first, and an owner's act (drawn in the foot's fold, R52 (2)) */
  const visibilitySec = cs.sec("project.visibility.title", cs.state("visibility", view, (v) => {
    const hist = (Array.isArray(v.history) ? v.history : []).slice();
    const setWord = (s) => T(s === "discoverable" ? "project.visibility.discoverable" : "project.visibility.hidden");
    const byOf = (x) => {
      const m = people.find((p) => p && p.member && p.member === x);
      return m ? whoIs(m) : whoIs(x);
    };
    const lines = hist.slice(1).reverse().map((h) => `<p class="mk-small" data-visibility="change">${W("project.visibility.history",
      { change: setWord(h.setting), who: byOf(h.set_by), date: { html: h.at ? cs.date(String(h.at), { year: true }) : "" }, reason: String(h.reason || "") })}</p>`);
    if (hist.length) lines.push(`<p class="mk-small" data-visibility="started">${W("project.visibility.started",
      { setting: setWord(hist[0].setting), date: { html: hist[0].at ? cs.date(String(hist[0].at), { year: true }) : "" } })}</p>`);
    else if (fresh)
      lines.push(`<p class="mk-small" data-visibility="started">${W("project.visibility.started",
        { setting: T(v.setting === "discoverable" ? "project.visibility.setting.findable" : "project.visibility.setting.hidden"), date: { html: cs.date(String(doc.created), { year: true }) } })}</p>`);
    return `<p data-visibility="${v.setting === "discoverable" ? "discoverable" : "hidden"}">${W(v.setting === "discoverable" ? "project.visibility.discoverable" : "project.visibility.hidden")}</p>`
      + lines.join("")
      + (owner ? cs.field("project-visibility-why", "shell.reason", { area: true, rec: true, help: "shell.reason.help" })
        + cs.act("projectvisibilityset", { label: "act.projectvisibilityset.label.project", data: { to: v.setting === "discoverable" ? "hidden" : "discoverable" } }) : "");
  }));

  /* R153 (T53; replaces R14): one link to the project's AI screen, `aiproject` (screens-ai), by address only; this screen
     reads nothing of the project's account (R1: `projectaccountstate` is retired) and imports nothing of screens-ai's.
     Reached only by a participant: a viewer who has not joined returned above (R60). */
  out.push(`<p class="mk-small" data-aiproject="link"><a class="cs-btn" data-tone="quiet" href="/app/aiproject/${cs.esc(id)}" data-nav>${W("screen.project.account.open")}</a></p>`);

  /* R53: what the team has at stake here: the team's own statement read-only, the project's stake with who set it and when, its
     history, and the participant's (or an administrator's) field; an unreadable stake is said, never none */
  {
    const idv = d.identity && d.identity.state === "ok" && d.identity.value ? d.identity.value : null;
    const groupStake = idv && idv.declared_stake && typeof idv.declared_stake.stake === "string" && idv.declared_stake.stake ? idv.declared_stake.stake : "";
    const st = d.stake;
    const canSet = joined || (view.me && view.me.administer === true);
    const stakeInner = cs.state("stake", view, (v) => {
      if (v.stake === "undetermined" || (v.stake !== null && typeof v.stake !== "string"))
        return `<details class="mk-details" data-stake="unreadable" open><summary>${W("stake.unreadable.summary")}</summary><p class="mk-small">${W("stake.unreadable")}</p></details>`;
      const earlier = Array.isArray(v.history) ? Math.max(0, v.history.length - 1) : 0;
      return (groupStake ? `<p class="mk-small" data-stake="group">${W("stake.project.group", { stake: groupStake })}</p>` : "")
        + (v.stake ? `<p><b>${W("stake.project.label")}</b></p><p class="rec" data-stake="project">${cs.esc(v.stake)}</p>`
          + `<p class="mk-small">${W("stake.set", { who: whoIs(v.set_by || ""), date: { html: v.set_at ? cs.date(String(v.set_at), { year: true }) : "" } })}${earlier ? " · " + W("stake.history", { n: String(earlier) }) : ""}</p>`
          : `<p class="mk-small" data-stake="none">${W("stake.none")}</p>`)
        + (canSet ? (() => {
          /* entry 25: the assistant's help in her own words, kept only by her own save */
          const dr = ui.draft && ui.draft.field === "stake" ? ui.draft : null;
          return cs.field("project-stake", "stake.project.label", { area: true, rec: true, help: "stake.project.help", value: dr ? dr.text : v.stake || "",
              ...(dr ? { draft: "screen.group-identity.draft.label", draftFills: { handle: dr.askedBy } } : {}) })
            + (dr && dr.untested ? ` <span class="mk-tag">${W("ai.label.untested")}</span>` : "")
            + (view.reachable ? cs.act("writinghelp", { data: { field: "stake", id: "project-stake" } }) : "")
            + cs.act("projectstakeset", { label: "stake.project.save", data: { project: id } });
        })() : "");
    });
    if (!(st && st.state === "empty")) out.push(cs.sec("stake.project.title", stakeInner, { id: "stake" }));
  }

  /* R29: members, one row each with role and date (the founder unnamed by key, R40); owners' acts; changes waiting */
  out.push(cs.sec("screen.project.members.head", cs.state("participants", view, () => {
    /* changes waiting on owners (project-roster R30), and an owner who has not agreed agrees by the same act */
    const votes = d.votes && d.votes.state === "ok" && Array.isArray(d.votes.value.changes) ? d.votes.value.changes : [];
    const pend = ui.consensus ? votes.concat([ui.consensus]) : votes;
    const seatedOwners = people.filter((x) => Number(x.owner) && x.state === "joined");
    const agreedOf = (c) => (Array.isArray(c.agreed) ? c.agreed : []).map((a) => String(a && typeof a === "object" ? a.handle || "" : a));
    const rows = people.map((x) => {
      /* R122 (DEC-384 T-06): a removal waiting on this owner */
      const rm = x.handle && Number(x.owner) ? pend.filter((c) => c && c.change === "remove" && String(c.target) === String(x.handle)).pop() || null : null;
      const name = whoIs(x);
      const role = W(Number(x.owner) ? "project.member.owner" : "project.member.member");
      /* R54: an owner's date is `owner_since`, a member's `joined_at`; a null date draws none, never "since null" */
      const since = Number(x.owner) ? x.owner_since || null : x.joined_at || null;
      const date = since ? W(Number(x.owner) ? "project.member.since" : "project.member.joined", { date: { html: cs.date(String(since), { year: true }) } }) : "";
      const self = isMe(x);
      /* R29 (K5157; WALK-FINAL-03 R25): a participant who asked to leave is still a participant until an owner removes her */
      const asked = x.state === "leaving";
      /* R75: "Stand down as owner…" opens the vote in place (state e) and sends nothing */
      const awaitingNames = rm ? (Array.isArray(rm.awaiting) && rm.awaiting.length ? rm.awaiting : seatedOwners.map((o) => o.handle).filter((h) => h !== x.handle && !agreedOf(rm).includes(String(h)))).map((h) => whoIs(h)).join(", ") : "";
      const acts = self && Number(x.owner)
        ? (rm ? `<span class="mk-small" data-standdown="opened">${W("project.owners.standdown.opened", { awaiting: awaitingNames })}</span>`
          /* C90 (R75, R29): the only owner has no vote that could carry: the act is not drawn, and the row says to add another owner first */
          : seatedOwners.length < 2 ? `<span class="mk-small" data-standdown="sole">${W("refusal.LAST_OWNER")}</span>`
          : cs.act("projectownerremove", { label: "act.projectownerremove.label.project", data: { handle: String(x.handle || ""), mode: "open" } }))
        /* R29: an owner removes a joined participant, or one who asked to leave (and makes an owner of a joined one only: a member who asked to leave is not offered the seat) */
        : owner && !self && x.handle && (x.state === "joined" || asked) ? (Number(x.owner) ? (rm && !agreedOf(rm).includes(String(me))
          ? cs.act("projectownerremove", { label: "project.owners.agree.remove", fills: { who: name }, data: { handle: String(x.handle), mode: "open" } }) : "")
            : asked ? "" : cs.act("projectowneradd", { label: "act.projectowneradd.label.project", data: { handle: String(x.handle) } }))
          + cs.field("project-remove-why-" + x.handle, "shell.reason", { help: "shell.reason.help" })
          + cs.act("projectremove", { label: "act.projectremove.label.project", data: { handle: String(x.handle) } }) : "";
      const row = cs.row(lead, `<span class="rec">${cs.esc(name)}</span> · ${role}` + (x.state === "invited" ? " · " + W("screen.project.members.invited", { handle: "" }) : ""), acts ? `<div class="mk-acts">${acts}</div>` : "", date);
      return asked ? `<div data-leaving="asked">${row}</div>` : row;
    }).join("");
    const waiting = pend.map((c) => {
      const fills = { who: whoIs(c.target), by: whoIs(c.proposed_by), date: { html: c.proposed_at ? cs.date(String(c.proposed_at), { year: true }) : "" },
        agreed: (c.agreed || []).map((h) => whoIs(h)).join(", "), awaiting: (c.awaiting || []).map((h) => whoIs(h)).join(", ") };
      const mineToAgree = owner && c.change !== "remove" && (c.awaiting || []).includes(me);
      return `<p class="mk-small" data-pending="${c.change === "remove" ? "remove" : "add"}">${W(c.change === "remove" ? "project.owners.pending.remove" : "project.owners.pending", fills)}</p>`
        + (mineToAgree ? cs.act(c.change === "remove" ? "projectownerremove" : "projectowneradd", { label: c.change === "remove" ? "screen.project.agree.dev.stands.down.as" : "project.owners.agree",
            fills: c.change === "remove" ? { member: fills.who } : { who: fills.who }, data: c.change === "remove" ? { handle: String(c.target || ""), mode: "open" } : { handle: String(c.target || "") } }) : "");
    }).join("");
    const forkAct = cs.act("projectfork", { label: "act.projectfork.label.project", data: { project: id } });
    return (rows ? cs.sheet(rows) : "") + waiting + `<p class="mk-small">${W("project.owners.rule")}</p>`
      + `<p class="mk-small">${W("screen.project.members.who")}</p>`
      + (owner ? cs.field("project-invite", "screen.project.invite.label", {}) + cs.act("projectinvite", { label: "act.projectinvite.label.project", data: { project: id } }) : "")
      /* R29 (K5157): "Join" is also how a request to leave is withdrawn (membership R34); the leave act is drawn to a joined participant only */
      + (mine && (mine.state === "invited" || mine.state === "leaving") ? cs.act("projectjoin", { label: "act.projectjoin.label.project", data: { project: id } }) : "")
      + (joined ? cs.act("projectleave", { label: "act.projectleave.label.project", data: { project: id } }) : "")
      /* R29 (K5157; WALK-FINAL-03b §10): the fork's two fields are drawn with its act: a joined participant who may not start projects is shown none of the three */
      + (joined && forkAct ? cs.field("project-fork-title", "project.start.title", { help: "project.start.title.help" })
        + cs.choice("project-fork-visibility", "project.visibility.title", [["hidden", "project.visibility.start.hidden"], ["discoverable", "project.visibility.start.discoverable"]], { value: "hidden" })
        + forkAct : "");
  })));
  /* R75 (state e): an owner stands down by a vote, in place, before anything is sent. Every heading, row and count is a key
     of the design's, filled from the reads (`projectownerarith`, `projectownervotes`, `projectparticipants`). */
  const standing = owner && typeof ui.standdown === "string" ? ui.standdown : "";
  const leaver = standing ? people.find((x) => x && x.handle === standing && Number(x.owner) && x.state === "joined") : null;
  if (leaver) {
    const arith = later("ownerarith", "projectownerarith", { projectId: id });
    out.push(arith.state !== "ok" ? cs.sec("screen.project.standdown.heading", `<div data-state-e="${arith.state}">${cs.state(arith, () => "")}</div>`) : (() => {
      const live = arith.value && arith.value.live ? arith.value.live : {};
      const table = Array.isArray(arith.value && arith.value.table) ? arith.value.table : [];
      const seated = people.filter((x) => Number(x.owner) && x.state === "joined");
      const n = Number(live.owners) || seated.length;
      const waitingOn = (d.votes && d.votes.state === "ok" && Array.isArray(d.votes.value.changes) ? d.votes.value.changes : [])
        .concat(ui.consensus ? [ui.consensus] : []).filter((c) => c && c.change === "remove" && (!c.target || String(c.target) === standing));
      const change = waitingOn.length ? waitingOn[waitingOn.length - 1] : null;
      const agreed = change && Array.isArray(change.agreed) ? change.agreed.map((a) => String(a && typeof a === "object" ? a.handle || "" : a)) : [];
      const isTarget = me === standing;
      const cast = agreed.includes(String(me));
      const others = seated.filter((x) => x.handle !== standing);
      const holds = [true, others.length > 0, live.possible === true, cast || !isTarget || live.targetMayVote === true];
      const offered = holds.every(Boolean) && !cast;
      const need = Number(live.votesNeeded) || 0;
      const dateOf = (iso) => (iso ? { html: cs.date(String(iso), { year: true }) } : "");
      const bold = (name) => ({ html: `<b>${cs.esc(name)}</b>` });
      /* the cast act: another owner agrees to this one standing down ("Agree: <name> stands down as owner"); the one standing
         down sends her own vote by the act's own label */
      const castAct = cs.act("projectownerremove", isTarget
        ? { label: "act.projectownerremove.label.project", data: { handle: standing, mode: "cast" }, tone: "primary" }
        : { label: "screen.project.agree.dev.stands.down.as", fills: { member: whoIs(leaver) }, data: { handle: standing, mode: "cast" }, tone: "primary" });
      const voters = seated.map((o) => {
        const h = String(o.handle || "");
        const voted = agreed.includes(h);
        const silent = n >= 3 && h === standing;
        const name = whoIs(o);
        const text = voted ? W("screen.project.standdown.agreed", { member: bold(name) }) : silent ? `<b>${cs.esc(name)}</b>`
          : W("screen.project.standdown.notyet", { member: bold(name) });
        /* what a voter's row says beneath it: the departing owner's vote is cast by standing down, on the date the change was
           proposed; an owner who has not voted, that the change waits for her */
        const meta = voted && h === standing && change && change.proposed_at ? W("screen.project.by.standing.down.17.october", { date: dateOf(change.proposed_at) })
          : !voted && !silent ? W("screen.project.the.change.waits.for.ana", { member: name }) : "";
        return `<div data-vote-for="${cs.esc(h)}" data-voted="${voted ? "yes" : "no"}">${cs.row(voted ? "<span>✓</span>" : silent ? lead : cs.icon("clock"), text,
          h === me && offered ? castAct : "", meta)}</div>`;
      }).join("");
      /* "This takes n of m owners' votes", at two owners with the departing owner's own among them; none for a sole owner */
      const takes = live.possible === true && need > 0
        ? `<p>${n === 2 ? W("screen.project.this.takes.2.of.2", { n: String(need), total: String(n), member: whoIs(leaver) }) + " " + W("screen.project.with.two.owners.standing.down")
          : W("screen.project.standdown.takes", { n: String(need), total: String(n) })}</p>` : "";
      const count = change && Number.isFinite(Number(change.have)) ? Number(change.have) : agreed.length;
      const total = change && Number.isFinite(Number(change.need)) && Number(change.need) > 0 ? Number(change.need) : need;
      const arithTable = `<table class="mk-table" data-arith="owners"><thead><tr><th>${W("screen.project.scale.head.owners")}</th><th>${W("screen.project.scale.head.takes")}</th><th>${W("screen.project.scale.head.why")}</th></tr></thead><tbody>${table.map((t) => {
        const k = Number(t.owners);
        const votes = k === 2 ? W("screen.project.2.of.2.the.departing") : k >= 3 ? W("screen.project.scale.takes", { votes: String(t.votesNeeded), owners: String(t.owners) }) : "";
        const why = k === 1 ? W("screen.project.the.last.owner.stays") : k === 2 ? W("screen.project.both.agree.a.resignation.the") : W("screen.project.scale.who", { voters: String(t.eligibleVoters), owners: String(t.owners) });
        return `<tr data-owners="${cs.esc(t.owners)}"${k === n ? " aria-current=\"true\"" : ""}><td>${cs.esc(t.owners)}${k === n ? " " + W("screen.project.scale.now") : ""}</td><td>${votes}</td><td>${why}</td></tr>`;
      }).join("")}</tbody></table>`;
      const check = (i, key, fills, meta, why) => `<div data-check="${i}" data-holds="${holds[i - 1] ? "yes" : "no"}">${cs.row(holds[i - 1] ? "✓" : cs.mark("gap", "refused", { reason: why || "" }),
        W(key, fills), "", holds[i - 1] ? meta : "")}</div>`;
      const first = others[0] || null;
      const reasonOwed = [check(1, "screen.project.ownerstand.you.are.an.owner.of"),
        check(2, "screen.project.ownerstand.an.owner.is.named.dev", { member: first ? whoIs(first) : "" }, "", T("refusal.LAST_OWNER")),
        check(3, "screen.project.ownerstand.standing.down.is.possible.at", {}, n === 2 ? W("screen.project.ownerstand.with.2.owners.an.owner") : "", T("refusal.LAST_OWNER")),
        check(4, "screen.project.ownerstand.this.is.a.vote.you", {}, n === 2 && isTarget ? W("screen.project.ownerstand.at.2.owners.the.departing") : "", T("refusal.TARGET_CANNOT_VOTE")),
        `<div data-check="5" data-holds="no">${cs.row(cs.icon("clock"), W("screen.project.ownerstand.a.reason.in.your.words"), "",
          `${W("screen.project.ownerstand.required")} ${W("screen.project.ownerstand.nothing.is.drafted.or.suggested")}`)}</div>`].join("");
      const waitLine = change ? `<p class="mk-small" data-pending="remove">${W("project.owners.pending.remove", { who: whoIs(standing), by: whoIs(change.proposed_by || ""),
        date: dateOf(change.proposed_at), agreed: agreed.map((h) => whoIs(h)).join(", "),
        awaiting: (Array.isArray(change.awaiting) ? change.awaiting : seated.map((o) => o.handle).filter((h) => h !== standing && !agreed.includes(String(h)))).map((h) => whoIs(h)).join(", ") })}</p>` : "";
      return cs.sec("screen.project.standdown.heading", `<div id="state-e" data-state-e="votes"><p data-standing="down">${W("screen.project.dev.is.standing.down.as", { member: whoIs(leaver) })}</p>${takes}${cs.sheet(voters)}`
          + (count > 0 && total > 0 ? `<p data-agreed="so-far"><b>${W("screen.project.1.of.2.have.agreed", { n: String(count), total: String(total) })}</b></p>` : "") + waitLine
          + (change && change.short === true ? `<p class="cs-gap" data-gap="refused" data-refusal="VOTES_SHORT" role="alert">${W("refusal.VOTES_SHORT")}</p>` : "")
          + `<p class="mk-small">${W("screen.project.how.many.owners.must.agree.explain")} ${W("screen.project.a.count.you.can.check.explain")}</p></div>`)
        + cs.sec("screen.project.how.it.changes.with.the", `${arithTable}<p class="mk-note">${W("screen.project.owners.follow.the.same.rule")} ${W("screen.project.a.project.can.always.be")}</p>`)
        + cs.sec("screen.project.standdown.beforevote", `<div data-state-e="checks">${cs.sheet(reasonOwed)}${cs.field("project-ownerstand-reason", "shell.reason", { area: true, rec: true, help: "screen.project.ownerstand.it.is.kept.with.your" })}`
          + `<p class="mk-note">${W("screen.project.ownerstand.a.project.with.no.owner")} ${W("screen.project.ownerstand.check.that.another.owner.remains")}</p>`
          + `<p class="mk-small">${W("screen.project.ownerstand.help")} ${W("screen.project.ownerstand.help2")}</p></div>`);
    })());
  }

  /* R76, R77: "Telling the network", an owner's section: the entry, the form and its preview, the ceremony, and the notice
     once published, with its level, its next check and "Change it or stop it". Names no member; no word of it is composed from
     the project. A section is drawn for an owner only. */
  if (owner) {
    const nstate = ui.notice && typeof ui.notice === "object" ? ui.notice : null;
    const nr = later("notices", "notices", { project: id });
    const list = nr.state === "ok" && nr.value && Array.isArray(nr.value.notices) ? nr.value.notices : [];
    const last = list.length ? list[list.length - 1] : null;
    const isOpen = !!(last && last.status === "open");
    const revs = last && Array.isArray(last.revisions) ? last.revisions : [];
    const rev = revs.length && revs[revs.length - 1] && typeof revs[revs.length - 1].json === "object" && revs[revs.length - 1].json ? revs[revs.length - 1].json : {};
    const tell = "screen.project.notice.heading";
    /* the five levels as the plane states them, each by its key (a table key is an identifier, never a sentence) */
    const LEVEL = { "Very active": "network-notices.level.very_active", Active: "network-notices.level.active", "Some work": "network-notices.level.some_work",
      Quiet: "network-notices.level.quiet", Dormant: "network-notices.level.dormant" };
    const STATUS = { open: "network-notices.status.open", stopped: "network-notices.status.stopped", closed: "network-notices.status.closed", lapsed: "network-notices.status.lapsed" };
    const dateOf = (iso) => (iso ? { html: cs.date(String(iso), { year: true }) } : "");
    const ack = Array.isArray(ui["pick:notice-ack"]) && ui["pick:notice-ack"].includes("ack");
    const refusal = ui.noticeRefusal && typeof ui.noticeRefusal === "object" ? ui.noticeRefusal : null;
    const parts = [];
    /* the fold "When a notice can't be prepared": the plane's refusal, in plain words (the four the drawing holds by its keys) */
    const foldWords = (r) => {
      const c = String(r.code || "");
      if (c === "NOTICE_ALREADY_OPEN") return `${W("screen.project.notice.this.project.already.has.an")} ${W("screen.project.notice.change.that.one.or.stop")}`;
      if (c === "NOTICE_SINCE_BEFORE_PROJECT") return W("screen.project.notice.the.date.is.before.the", { date: dateOf(r.from) });
      if (c === "NOTICE_NO_GROUP_SLUG" || c === "NOTICE_NO_INSTANCE_KEY") return `${W("screen.project.notice.your.teams.public.address.or")} ${W("screen.project.notice.an.administrator.can.finish.setting")}`;
      if (c === "NOTICE_PROJECT_CLOSED") return `${W("screen.project.notice.this.project.is.closed")} ${W("screen.project.notice.a.closed.project.can.only")}`;
      return W("refusal." + c);
    };
    const fold = refusal ? `<details class="mk-details" data-fold="noticerefusal" open><summary>${W("screen.project.notice.when.a.notice.cant.be")}</summary>`
      + `<p class="cs-gap" data-gap="refused" role="alert" data-refusal="${cs.esc(refusal.code)}">${foldWords(refusal)}</p></details>` : "";
    if (nr.state === "loading" || nr.state === "failed") parts.push(cs.sec(tell, cs.state(nr, () => "")));
    else if (nstate) {
      /* state f: the form (a new notice, or the change of the open one), the public part, and the ceremony once previewed */
      const pre = nstate.mode === "change" ? rev : {};
      if (nstate.mode !== "stop") {
        parts.push(cs.sec(tell, `<p class="mk-note">${W("screen.project.notice.only.an.owner.can.do")} ${W("screen.project.notice.you.sign.it.in.your")} ${W("screen.project.notice.it.names.no.member.only")}</p>`));
        parts.push(cs.sec("screen.project.notice.what.the.notice.says",
          cs.field("project-notice-wording", "screen.project.notice.what.the.team.is.working", { rec: true, help: "screen.project.notice.one.line.up.to.280", value: pre.wording || "" })
          + `<p class="mk-small">${W("screen.project.notice.nothing.is.filled.in.from")}</p>`
          + cs.field("project-notice-body", "screen.project.notice.a.few.words.more.optional", { rec: true, help: "screen.project.notice.one.line.up.to.120", value: pre.body || "" })
          + cs.field("project-notice-matter", "screen.project.notice.the.matter.it.belongs.to", { rec: true, help: "screen.project.notice.one.line.up.to.120.2", value: pre.matter || "" })
          + cs.field("project-notice-since", "screen.project.notice.working.on.it.since", { type: "date", help: "screen.project.notice.a.date.no.earlier.than", value: pre.since || "" })
          + cs.checks("project-notice-collab", "screen.project.notice.legend.welcome", [{ value: "yes", key: "screen.project.notice.we.welcome.others.who.want", on: !!pre.collaborate }])
          + `<p class="mk-small">${W("screen.project.notice.the.notice.then.points.to")}</p>`
          + cs.act("noticeprepare", { label: "act.noticeprepare.label.project", data: { mode: "preview" }, tone: "primary" })
          + cs.act("noticeprepare", { label: "shell.cancel", data: { mode: "close" }, tone: "quiet" })));
      }
      parts.push(fold);
      if (nstate.mode !== "stop") parts.push(cs.sec("screen.project.notice.what.the.public.sees",
        `<p>${W("screen.project.notice.the.wording.the.date.you")}</p><p>${W("screen.project.notice.the.teams.own.civicsmith.then")} ${W("screen.project.notice.work.by.the.assistant.is")}</p>`,
        { help: "screen.project.notice.help" }));
      const pr = nstate.prepared && typeof nstate.prepared === "object" ? nstate.prepared : null;
      if (pr) {
        let rv = {};
        try { rv = JSON.parse(String(pr.revision || "{}")) || {}; } catch { rv = {}; }
        parts.push(cs.sec("screen.project.notice.once.you.preview.it", `<div class="cs-dialog" data-notice="preview">${cs.mark("outward")} ${W("screen.connect.outward")}`
          + `<p class="rec" data-notice="wording">${cs.esc(rv.wording || "")}</p>`
          + (rv.handoff ? `<p class="rec" data-notice="handoff">${cs.esc(rv.handoff)}</p>` : "")
          + `<p class="mk-small">${[rv.since ? W("screen.project.notice.working.on.it.since.3", { date: dateOf(rv.since) }) : "", rv.collaborate === true ? W("network-notices.others_working_welcome") : "",
            STATUS[rv.status] ? W(STATUS[rv.status]) : ""].filter(Boolean).join(" · ")}</p>`
          + `<div class="ends">${W("screen.project.notice.anyone.can.read.this.including")} ${W("screen.project.notice.stopping.the.notice.later.ends")}</div>`
          + (pr.caution === "two_open_without_published_work" ? `<p class="mk-small" data-notice="caution">${cs.mark("gap", "undetermined", { reason: `${W("screen.project.notice.your.team.has.two.other")} ${W("screen.project.notice.you.can.still.publish.readers")}` })}</p>` : "")
          + `<fieldset class="cs-field"><legend>${W("screen.project.notice.legend.sign")}</legend><label><input type="checkbox" id="project-notice-ack" data-shell="pick" data-table="notice-ack" data-id="ack"${ack ? " checked" : ""}> <span>${W("screen.project.notice.i.understand.that.this.is")}</span></label></fieldset>`
          + `<p class="mk-small"><code data-notice="statement">${cs.esc(String(pr.statement || "").trim())}</code></p>`
          + `<p class="mk-small muted">${W("screen.project.notice.your.key.signs.this.exact")} ${W("screen.project.notice.if.anything.changes.you.preview")} ${W("screen.project.notice.a.preview.is.good.for")}</p>`
          + (ack ? cs.act("noticepost", { label: "act.noticepost.label.project", tone: "primary", icon: "signed" }) : "") + "</div>"));
      }
    } else if (isOpen) {
      /* state g: the notice as published, what the team's Civicsmith worked out, and "Change it or stop it" */
      const published = revs.length && revs[0] ? revs[0].published_at : null;
      const lv = last.level && typeof last.level === "object" ? last.level : null;
      const levelKey = lv ? LEVEL[String(lv.level)] || null : null;
      const att = Array.isArray(last.attestations) && last.attestations.length ? last.attestations[last.attestations.length - 1] : null;
      const cases = att && att.json && Array.isArray(att.json.cases) ? att.json.cases.length : 0;
      const missed = Array.isArray(last.missed_monthlies) && last.missed_monthlies.length > 0;
      const rows = cs.row(cs.icon("clock"), `<span class="rec" data-notice="wording">${cs.esc(rev.wording || "")}</span>`, "",
          `${published ? W("state.item.published.name") + " " + cs.date(String(published), { year: true }) : ""}${rev.since ? " · " + W("screen.project.notice.working.on.it.since.3", { date: dateOf(rev.since) }) : ""}${rev.collaborate === true ? " · " + W("network-notices.others_working_welcome") : ""} · ${W(STATUS.open)}`)
        + (lv ? cs.row(lead, `${levelKey ? `<b data-notice="level">${W(levelKey)}</b> · ` : ""}${W("screen.project.notice.as.the.teams.civicsmith.worked", { date: dateOf(lv.as_of) })}`, "",
            `${last.next_monthly ? W("screen.project.notice.the.next.monthly.check.is", { date: dateOf(last.next_monthly) }) : ""}${last.lapse_date ? " " + W("screen.project.notice.a.notice.that.stays.dormant") : ""}`) : "")
        + (cases > 0 ? cs.row(lead, `<b>${W(cases === 1 ? "screen.project.notice.1.case.published.from.this" : "screen.project.notice.cases.published.from.this", { n: String(cases) })}</b>`, "") : "");
      /* a monthly check missed: the last level attested, with its date (a level the list does not hold names none) */
      const missedLine = missed && lv && levelKey && lv.as_of ? `<p class="mk-small" data-notice="missed">${W("screen.project.notice.missed", { level: T(levelKey), date: dateOf(lv.as_of) })}</p>` : "";
      parts.push(cs.sec(tell, `<p><b>${W("screen.project.notice.thenotice")}</b></p><div data-notice="published" data-status="open"${missed ? " data-missed=\"1\"" : ""}>${cs.sheet(rows)}</div>${missedLine}`
        + `<p class="mk-small">${W("network-notices.week_counts_holds")} ${W("network-notices.counted_assistant_work")}</p>`
        + `<p class="mk-note">${W("screen.project.notice.anyone.can.read.this.at")} ${W("screen.project.notice.each.owner.of.the.project")}</p>`, { help: "screen.project.notice.help2" }));
      parts.push(fold);
      parts.push(cs.sec("screen.project.notice.change.it.or.stop.it",
        cs.field("project-notice-handoff", "screen.project.notice.if.you.stop.where.the", { rec: true, help: "screen.project.notice.one.line.up.to.280.2" })
        + `<p class="mk-small">${W("screen.project.notice.it.is.published.with.the")}</p>`
        + cs.act("noticeprepare", { label: "screen.project.notice.change", data: { mode: "change", notice: String(last.notice || "") } })
        + cs.act("noticeprepare", { label: "screen.project.notice.stop", data: { mode: "stop", notice: String(last.notice || "") }, tone: "quiet" })
        + `<p class="mk-note">${W("screen.project.notice.a.change.is.a.new")} ${W("screen.project.notice.a.stop.is.signed.too")} ${W("screen.project.notice.neither.removes.what.was.published")}</p>`));
    } else {
      /* the entry: a new notice is offered only where network-notices R1 allows (a closed project refuses it, in words) */
      const stopped = last && last.status !== "open";
      parts.push(cs.sec(tell, `<p>${W("screen.project.notice.an.owner.can.publish.a")}</p><p>${W("screen.project.notice.it.is.public.and.it")}</p>`
        + (stopped ? `<div data-notice="last" data-status="${cs.esc(String(last.status || ""))}">${cs.sheet(cs.row(lead, `<span class="rec" data-notice="wording">${cs.esc(rev.wording || "")}</span>`, "",
            [revs.length && revs[revs.length - 1].published_at ? cs.date(String(revs[revs.length - 1].published_at), { year: true }) : "",
              STATUS[String(last.status)] ? W(STATUS[String(last.status)]) : "",
              last.status === "lapsed" && last.lapse_date ? W("screen.project.notice.lapsed.on", { date: dateOf(last.lapse_date) }) : ""].filter(Boolean).join(" · ")))}</div>` : "")
        + cs.act("noticeprepare", { label: "screen.project.notice.tell.the.network.we.are", data: { mode: "open" } })));
      parts.push(fold);
    }
    out.push(parts.join(""));
  }
  /* R52 (2): the foot folds the project's settings: the setting of its bar (R10) and who can find it (R28) */
  const letters2 = () => [{ value: "", text: T("screen.project.bar.unset") }].concat(["A", "B", "C", "D"].map((g) => ({ value: g, text: g })));
  const barSet = joined ? cs.state("bar", view, () =>
    cs.choice("project-bar-capture", "mark.scale.capture.name", letters2(), { value: barDeclared && barRead.capture ? barRead.capture : "" })
    + cs.choice("project-bar-connection", "mark.scale.connection.name", letters2(), { value: barDeclared && barRead.connection ? barRead.connection : "" })
    + `<p class="mk-small">${W("screen.project.bar.help")}</p>` + cs.act("projectbarset", { label: "act.projectbarset.label.project", data: { project: id } })) : "";
  out.push(`<details class="mk-details" data-fold="settings"${fresh ? " open" : ""}><summary>${W("project.settings.fold")}</summary>${barSet}${visibilitySec}</details>`);
  return out.join("");
}

/** R1's, R10's, R11's, R16's and R27–R30's acts. `promote` writes its question itself (an id from `allocid`, then the
 *  package, then the draw), so its `send` sends nothing through the shell and draws its own outcome. */
const acts = [
  { op: "promote", label: "act.promote.label.project", rereads: ["questions", "others"],
    send(view, el, cs) {
      const project = String(view.subject || "");
      const question = String(cs.value("project-question") || "").trim();
      if (!question) return { refuse: "screen.project.question.empty" };
      const title = question.replace(/\s+/g, " ").slice(0, 120);
      const res = (a) => (a && a.result !== undefined ? a.result : a);
      const fail = (a) => {
        const r = res(a);
        cs.set("promoteRefusal", { code: (r && (r.code || r.reason)) || (a && (a.code || a.reason)) || "", translation: r && r.translation,
          findings: r && Array.isArray(r.findings) ? r.findings : a && Array.isArray(a.findings) ? a.findings : [] });
      };
      cs.set("promoteRefusal", null);
      cs.set("notDrawn", null);
      const clock = new Date(cs.now());
      const year = String(clock.getUTCFullYear());
      cs.call("allocid", { query: { prefix: "INQ", year } }).then((a) => {
        const r = res(a);
        if (!r || !r.id) return fail(a);
        /* L20: the slug is cut at 40 and then trimmed again, so a cut that falls on a hyphen leaves no trailing one (record-grammar's
           BUNDLE_ID_RE refuses it, and every act resting on the question with it) */
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/, "");
        const id = r.id + (slug ? "-" + slug : "");
        const now = clock.toISOString().split(".")[0] + "Z";
        /* an inquiry document as record-grammar's inquiry grammar asks (HEADINGS.inquiry; first legal state `open`),
           stating its project (promotion R53); the headings are the grammar's, matched exactly: the two the grammar keys
           (`conformance.rests`, `conformance.falsify`, as record-grammar's `HEADINGS.inquiry` reads them) by their words, the
           rest identifiers it spells (this page is served as text, so it cannot import the grammar's list) */
        const heads = ["## Question", view.parts.plain(cs, "conformance.rests"), "## Conclusion", view.parts.plain(cs, "conformance.falsify"), "## Session Log", "## Review Notes"];
        const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(title),
          "current_state: open", "prior_state: null", "created: " + now, "last_updated: " + now, "project: " + project,
          "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
          "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
          "surfaced_by: human", "recheck_triggers:", "  - text: " + JSON.stringify(view.parts.plain(cs, "file.recheck.revisit")),
          "    description: " + JSON.stringify(view.parts.plain(cs, "file.recheck.none")), "---", ""];
        heads.forEach((h, i) => { lines.push(h, ""); if (i === 0) lines.push(question, ""); });
        const text = lines.join("\n");
        const stamp = now.replace(/[-:]/g, "") + "_" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
        return cs.call("promote", { body: { bundleId: id, base: null, snapKey: stamp,
          meta: { object_type: "inquiry", title, current_state: "open", created: now, last_updated: now },
          files: [{ path: "bundle.md", text }] } }).then((p) => {
          const pr = res(p);
          if (!p || p.ok === false || !pr || pr.ok === false) return fail(p);
          /* R11: the project draws on it at once (citation R14); a refusal is said here, the question staying open */
          const notDrawn = (x) => {
            const xr = res(x) || {};
            cs.set("notDrawn", { id, title, code: String(xr.code || xr.reason || (x && (x.code || x.reason)) || ""), translation: xr.translation || "" });
          };
          return cs.call("drawquestion", { query: { project, inquiry: id, note: "" } }).then((x) => {
            const xr = res(x);
            if (!x || x.ok === false || !xr || xr.ok === false) return notDrawn(x);
            cs.go("question", id);
          }, () => notDrawn(null));
        });
      }, () => fail(null));
      return null;
    } },
  { op: "drawquestion", label: "act.drawquestion.label.project", reasonField: "note", rereads: ["questions"],
    send(view, el, cs) {
      const inquiry = String(cs.value("project-draw-question") || "").trim();
      const note = String(cs.value("project-draw-note") || "").trim();
      if (!inquiry || !note) return { refuse: "screen.project.draw.empty" };
      cs.set("drawSaid", null);
      return { query: { project: String(view.subject || ""), inquiry, note }, raw: "" };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      const already = !!(r && Array.isArray(r.alreadyCited) && r.alreadyCited.length && !(Array.isArray(r.cited) && r.cited.length));
      cs.set("qgen", (view.ui.qgen || 0) + 1);
      cs.set("drawSaid", already ? "screen.project.draw.already" : "screen.project.draw.done");
    },
    /* R117: a BASIS_REFUSED that names its findings draws their words, not the generic sentence */
    refusals: { BASIS_REFUSED: (r, cs) => {
      const out = [];
      for (const f of Array.isArray(r.findings) ? r.findings.slice(0, 5) : []) {
        if (!f || typeof f !== "object") continue;
        let said = "";
        for (const c of [f.code, f.check]) { const key = typeof c === "string" && c ? "refusal." + c : ""; if (key && cs.w(key) !== key) { said = cs.w(key); break; } }
        if (!said && (f.detail || f.message)) said = cs.esc(String(f.detail || f.message));
        if (said) out.push(said);
      }
      return out.length ? out.join(" ") : cs.w("refusal.BASIS_REFUSED");
    } } },
  { op: "findin", label: "act.findin.label.project", rereads: [],
    send(view, el, cs) { cs.go("find-in", String(view.subject || "")); return null; } },
  /* R10 (strength R45): the save names the bar the owner saw (`expected`, each axis null for none), so a bar another owner changed since is
     refused `BAR_STALE` with the bar now held, which the page then draws and the next save names */
  { op: "projectbarset", label: "act.projectbarset.label.project", rereads: ["bar"],
    send(view, el, cs) {
      const body = { project: String(view.subject || "") };
      for (const a of ["capture", "connection"]) {
        const g = String(cs.value("project-bar-" + a) || "");
        if (["A", "B", "C", "D"].includes(g)) body[a] = g;
      }
      const seen = view.ui.barNow || (view.data && view.data.bar && view.data.bar.state === "ok" && view.data.bar.value ? view.data.bar.value.bar : null) || {};
      body.expected = { capture: seen.capture || null, connection: seen.connection || null };
      return { body };
    },
    done(view, answer, cs) { cs.set("barNow", null); },
    refusals: { BAR_STALE: (r, cs) => {
      const now = r && r.previous && typeof r.previous === "object" ? r.previous : {};
      cs.set("barNow", { declared: now.declared === true, source: now.source || "project", capture: now.capture || null, connection: now.connection || null });
      return r && r.translation ? cs.esc(String(r.translation)) : cs.w("state.failed", { reason: "BAR_STALE" });
    } } },
  { op: "projectinvite", label: "act.projectinvite.label.project", rereads: ["participants"],
    send(view, el, cs) {
      const handle = String(cs.value("project-invite") || "").trim().replace(/^@/, "");
      if (!handle) return { refuse: "screen.project.invite.empty" };
      return { query: { projectId: String(view.subject || ""), handle } };
    } },
  { op: "projectjoin", label: "act.projectjoin.label.project",
    rereads: ["stage", "participants", "bar", "questions", "visibility", "votes", "plans"],
    send(view) { return { query: { projectId: String(view.subject || "") } }; } },
  { op: "planopen", label: "act.planopen.label.project", reasonField: "title", rereads: ["plans"],
    send(view, el, cs) {
      const title = String(cs.value("project-plan") || "").trim();
      const inquiry = String(cs.value("project-plan-about") || "").trim();
      if (!title || !inquiry) return { refuse: "screen.project.plan.empty" };
      return { body: { project: String(view.subject || ""), title, subjects: [{ kind: "inquiry", inquiry }] } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (!r || !r.id) return;
      cs.set("plans", (Array.isArray(view.ui.plans) ? view.ui.plans : []).concat([{ id: String(r.id), title: String(r.title || "") }]));
      /* C63 (R1, R36): the plan opened is its own page, where the receipt is: the press opens it with the plan as subject */
      cs.go("plan", String(r.id));
    },
    /* R117: the same for an action's basis refused with its findings */
    refusals: { ACTION_BASIS_REFUSED: (r, cs) => {
      const out = [];
      for (const f of Array.isArray(r.findings) ? r.findings.slice(0, 5) : []) {
        if (!f || typeof f !== "object") continue;
        let said = "";
        for (const c of [f.code, f.check]) { const key = typeof c === "string" && c ? "refusal." + c : ""; if (key && cs.w(key) !== key) { said = cs.w(key); break; } }
        if (!said && (f.detail || f.message)) said = cs.esc(String(f.detail || f.message));
        if (said) out.push(said);
      }
      return out.length ? out.join(" ") : cs.w("refusal.ACTION_BASIS_REFUSED");
    } } },
  /* R28: an owner's change of who can find it, with her reason (in the query, where project-roster reads it) */
  { op: "projectvisibilityset", label: "act.projectvisibilityset.label.project", rereads: ["visibility"],
    send(view, el, cs) {
      const reason = String(cs.value("project-visibility-why") || "").trim();
      if (!reason) return { refuse: "shell.reason.needed" };
      return { query: { projectId: String(view.subject || ""), setting: String(el.dataset.to || "hidden"), reason }, raw: "" };
    } },
  /* R29, R75: an owner stands down (or agrees to another's standing down). Pressed on a row it opens the vote in place and
     sends nothing; the vote itself is sent from there with her own reason, written in the field the vote draws (the reason
     field: no writing help). A removal still short is answered `VOTES_SHORT` (its `have` a count, its `deciders` named) or
     `CONSENSUS_REQUIRED` (its `have` and `awaiting` named): the counts are redrawn from the answer, the vote stays open. */
  { op: "projectownerremove", label: "act.projectownerremove.label.project", reasonField: "reason", rereads: ["participants", "votes"],
    send(view, el, cs) {
      const handle = String(el.dataset.handle || "");
      if (String(el.dataset.mode || "") !== "cast") { cs.set("standdown", handle); return null; }
      const reason = String(cs.value("project-ownerstand-reason") || "").trim();
      if (!reason) return { refuse: "shell.reason.needed" };
      return { query: { projectId: String(view.subject || ""), handle, reason }, raw: "" };
    },
    done(view, answer, cs) { cs.set("consensus", null); cs.set("standdown", null); },
    refusals: {
      CONSENSUS_REQUIRED: (r, cs) => {
        const nm = (x) => (x && typeof x === "object" ? (x.handle || (x.founder === true ? cs.w("member.founder.unnamed") : "")) : String(x == null ? "" : x));
        const agreed = (Array.isArray(r && r.have) ? r.have : []).map(nm), awaiting = (Array.isArray(r && r.awaiting) ? r.awaiting : []).map(nm);
        cs.set("consensus", { change: "remove", target: String((r && r.handle) || ""), proposed_by: "", proposed_at: null, agreed, awaiting });
        return cs.w("screen.project.1.of.2.have.agreed", { n: String(agreed.length), total: String(agreed.length + awaiting.length) });
      },
      VOTES_SHORT: (r, cs) => {
        const nm = (x) => (x && typeof x === "object" ? (x.handle || (x.founder === true ? cs.w("member.founder.unnamed") : "")) : String(x == null ? "" : x));
        const agreed = (Array.isArray(r && r.deciders) ? r.deciders : []).map(nm);
        /* the vote is recorded and the removal waits: the counts (`have` of `need`) are redrawn in the vote, and the refusal says so */
        cs.set("consensus", { change: "remove", target: String((r && r.handle) || ""), proposed_by: "", proposed_at: null, agreed, awaiting: null,
          short: true, have: Number(r && r.have) || agreed.length, need: Number(r && r.need) || 0 });
        return cs.w("refusal.VOTES_SHORT");
      },
    } },
  /* R29: make an owner (or agree to it, the same act sent by her); a consensus still owed redraws the pending line */
  { op: "projectowneradd", label: "act.projectowneradd.label.project", rereads: ["participants", "votes"],
    send(view, el) { return { query: { projectId: String(view.subject || ""), handle: String(el.dataset.handle || "") } }; },
    refusals: { CONSENSUS_REQUIRED: (r, cs) => cs.w("project.owners.pending", { who: String((r && r.handle) || ""), by: "", date: "",
      agreed: ((r && r.have) || []).join(", "), awaiting: ((r && r.awaiting) || []).join(", ") }) } },
  /* R29: remove a member, her reason asked and shown, not refused when empty (membership R36) */
  { op: "projectremove", label: "act.projectremove.label.project", rereads: ["participants", "votes"],
    send(view, el, cs) {
      const handle = String(el.dataset.handle || "");
      const comment = String(cs.value("project-remove-why-" + handle) || "").trim();
      return { query: { projectId: String(view.subject || ""), handle, ...(comment ? { comment } : {}) } };
    } },
  { op: "projectleave", label: "act.projectleave.label.project", rereads: "all",
    send(view) { return { query: { projectId: String(view.subject || "") } }; } },
  /* R29: start a project from this one, with its title and who can find it (hidden preselected); the new one opened */
  { op: "projectfork", label: "act.projectfork.label.project", rereads: [],
    send(view, el, cs) {
      const title = String(cs.value("project-fork-title") || "").trim();
      if (!title) return { refuse: "project.start.title.help" };
      const visibility = cs.value("project-fork-visibility") === "discoverable" ? "discoverable" : "hidden";
      return { query: { projectId: String(view.subject || ""), title, visibility } };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (r && r.newId) cs.go("project", String(r.newId));
    } },
  /* R53: the project's stake, as typed; an emptied field clears it (project-roster R31: the exact word `null`) */
  { op: "projectstakeset", label: "stake.project.save", rereads: ["stake"],
    send(view, el, cs) {
      const stake = String(cs.value("project-stake") || "").trim();
      return { query: { projectId: String(view.subject || ""), stake: stake || "null" }, raw: "" };
    },
    /* R53 (K5148; WALK-FINAL-03b §2): the project's own sentence for a malformed stake, not the team's that the bare code names */
    refusals: { STAKE_MALFORMED: "refusal.STAKE_MALFORMED.project", MACHINE_CANNOT_SET_STAKE: "refusal.MACHINE_CANNOT_SET_STAKE" } },
  /* R60: a findable project's "Ask to join", and withdrawing her open request */
  { op: "projectrequest", label: "act.projectrequest.label.project", rereads: ["directory"],
    send(view) { return { query: { projectId: String(view.subject || "") } }; } },
  { op: "projectrequestwithdraw", label: "act.projectrequestwithdraw.label.project", rereads: ["directory"],
    send(view) { return { query: { projectId: String(view.subject || "") } }; } },
  /* R30: an administrator becomes its owner, naming herself, with her reason (in the query) */
  { op: "projectownerrescue", label: "act.projectownerrescue.label.project", reasonField: "reason", rereads: "all",
    send(view, el, cs) {
      const reason = String(cs.value("project-rescue-why") || "").trim();
      return { query: { projectId: String(view.subject || ""), handle: String((view.me && view.me.handle) || ""), reason }, raw: "" };
    } },
  /* R109: an owner closes the project now, with one of three reasons (the act's own `reason`, so the shell asks no second one) and
     an optional note */
  { op: "projectclose", label: "screen.project.closenow.do", reasonField: "reason", rereads: ["stage"],
    send(view, el, cs) {
      const pick = cs.value("project-close-why");
      const reason = Array.isArray(pick) ? String(pick[0] || "") : "";
      if (!["resolved", "superseded", "abandoned"].includes(reason)) return { refuse: "screen.project.closenow.ref.reason" };
      const note = String(cs.value("project-close-note") || "").trim();
      return { body: { project: String(view.subject || ""), reason, ...(note ? { note } : {}) } };
    },
    refusals: { PROJECT_ACT_NOT_THE_OWNER: "screen.project.closenow.ref.owner", CLOSE_BAD_REASON: "screen.project.closenow.ref.reason" } },
  /* R107: the tab opens and closes the comparison, which the page's read of `rerunread` already holds: nothing is sent */
  { op: "rerunread", label: "act.owed_rerunread.label.project", rereads: [],
    send(view, el, cs) { cs.set("compare", view.ui.compare !== true); return null; } },
  /* R107: pairing one of the project's findings with the source's, or withdrawing the pairing; her statement, never a check */
  { op: "rerunpair", label: "act.owed_rerunpair.label.project", rereads: ["rerun"],
    send(view, el, cs) {
      const project = String(view.subject || "");
      const edition = Number(el.dataset.edition);
      const base = { project, source_finding: String(el.dataset.source || ""), ...(Number.isFinite(edition) && el.dataset.edition ? { edition } : {}) };
      if (el.dataset.withdraw === "yes") return { body: { ...base, own_finding: String(el.dataset.own || ""), withdraw: true } };
      const own = String(cs.value("project-pair-own-" + el.dataset.n) || "");
      if (!own) return { refuse: "screen.project.cmp_pair_none" };
      return { body: { ...base, own_finding: own } };
    },
    refusals: {
      PROJECT_ACT_NOT_A_PARTICIPANT: (r, cs) => cs.w("screen.project.cmp_refused_member") + " " + cs.w("screen.project.cmp_refused_member_next"),
      NO_SUCH_OWN_FINDING: (r, cs) => cs.w("screen.project.cmp_refused_own") + " " + cs.w("screen.project.cmp_refused_own_next"),
    } },
  /* R128: "List this project's documents" reads the list again (the same read, `heldcaptures` for the project's held and vouched documents);
     what it answers is drawn by the page's own read, re-read after it */
  { op: "heldcaptures", label: "act.heldcaptures.label.project", rereads: ["docs"],
    send(view) { return { query: { project: String(view.subject || ""), state: "held_and_vouched", limit: "200" } }; },
    done(view, answer, cs) { cs.set("dgen", (view.ui.dgen || 0) + 1); } },
  /* entry 25: the assistant's help with the project's stake, in her own words; nothing is kept until she saves it */
  { op: "writinghelp", label: "act.writinghelp.label.project", rereads: [], reasonField: "told",
    send(view, el, cs) {
      const told = String(cs.value(el.dataset.id) || "").trim();
      return { body: { op: "projectstakeset", field: "stake", told } };
    },
    done(view, answer, cs) {
      const a = answer && answer.result !== undefined ? answer.result : answer;
      const me = view.me || {};
      const by = a && a.label && a.label.asked_by ? String(a.label.asked_by).replace(/^member:/, "") : me.member;
      if (a && typeof a.text === "string") cs.fill("project-stake", a.text);
      cs.set("draft", { field: "stake", text: (a && a.text) || "", askedBy: by === me.member && me.handle ? me.handle : by, untested: !!(a && (a.untested || (a.label && a.label.untested))) });
    } },
  /* R76, R77: "Telling the network". `noticeprepare` composes the next revision and writes nothing; pressed in its `open`,
     `change` and `close` modes it only opens or closes the form (nothing is sent). A new notice, a change (`notice` named) and a
     stop (`final: "stopped"`, with the optional handoff) are previewed alike. What the member types is kept on a refusal;
     no word of the notice is composed from the project. */
  { op: "noticeprepare", label: "act.noticeprepare.label.project", rereads: [],
    send(view, el, cs) {
      const mode = String(el.dataset.mode || "preview");
      const project = String(view.subject || "");
      if (mode === "close") { cs.set("noticeRefusal", null); cs.set("notice", null); return null; }
      if (mode === "open") { cs.set("noticeRefusal", null); cs.set("pick:notice-ack", []); cs.set("notice", { mode: "new", notice: "", prepared: null }); return null; }
      const noticeId = String(el.dataset.notice || (view.ui.notice && view.ui.notice.notice) || "");
      const current = () => {
        const nv = view.ui.later && view.ui.later.notices && view.ui.later.notices.state === "ok" ? view.ui.later.notices.value : null;
        const list = nv && Array.isArray(nv.notices) ? nv.notices : [];
        const n = list.find((x) => x && x.notice === noticeId) || null;
        const revs = n && Array.isArray(n.revisions) ? n.revisions : [];
        return revs.length && revs[revs.length - 1] && revs[revs.length - 1].json ? revs[revs.length - 1].json : {};
      };
      if (mode === "change") { cs.set("noticeRefusal", null); cs.set("pick:notice-ack", []); cs.set("notice", { mode: "change", notice: noticeId, prepared: null }); return null; }
      const line = (s) => !/[\r\n]/.test(s);
      let body;
      if (mode === "stop") {
        const cur = current();
        body = { project, notice: noticeId, final: "stopped", wording: String(cur.wording || ""), since: String(cur.since || ""), collaborate: cur.collaborate === true };
        if (cur.body) body.body = String(cur.body);
        if (cur.matter) body.matter = String(cur.matter);
        const handoff = String(cs.value("project-notice-handoff") || "").trim();
        if (handoff) {
          if (handoff.length > 280 || !line(handoff)) return { refuse: "refusal.NOTICE_WORDING_MALFORMED" };
          body.handoff = handoff;
        }
      } else {
        const wording = String(cs.value("project-notice-wording") || "").trim();
        const more = String(cs.value("project-notice-body") || "").trim();
        const matter = String(cs.value("project-notice-matter") || "").trim();
        const since = String(cs.value("project-notice-since") || "").trim();
        if (!wording || wording.length > 280 || !line(wording) || more.length > 120 || !line(more) || matter.length > 120 || !line(matter)) return { refuse: "refusal.NOTICE_WORDING_MALFORMED" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return { refuse: "refusal.NOTICE_SINCE_MALFORMED" };
        if (since > new Date(cs.now()).toISOString().slice(0, 10)) return { refuse: "refusal.NOTICE_SINCE_IN_FUTURE" };
        const collab = cs.value("project-notice-collab");
        body = { project, wording, since, collaborate: Array.isArray(collab) && collab.includes("yes") };
        if (more) body.body = more;
        if (matter) body.matter = matter;
        if (view.ui.notice && view.ui.notice.mode === "change" && noticeId) body.notice = noticeId;
      }
      cs.set("noticeRefusal", null);
      return { body };
    },
    done(view, answer, cs) {
      const r = answer && answer.result !== undefined ? answer.result : answer;
      if (!r || typeof r.statement !== "string") return;
      const was = view.ui.notice && typeof view.ui.notice === "object" ? view.ui.notice : {};
      const stopping = (() => { try { return JSON.parse(String(r.revision || "{}")).status === "stopped"; } catch { return false; } })();
      cs.set("pick:notice-ack", []);
      cs.set("notice", { mode: stopping ? "stop" : was.mode === "change" ? "change" : "new", notice: String(was.notice || ""),
        prepared: { statement: r.statement, digest: String(r.digest || ""), revision: String(r.revision || ""), caution: r.caution || null, expires: String(r.expires || "") } });
    },
    refusals: {
      NOTICE_ALREADY_OPEN: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_ALREADY_OPEN", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_SINCE_BEFORE_PROJECT: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_SINCE_BEFORE_PROJECT", from: String((r && r.project_created) || "") }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_SINCE_IN_FUTURE: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_SINCE_IN_FUTURE", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_NO_GROUP_SLUG: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_NO_GROUP_SLUG", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_NO_INSTANCE_KEY: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_NO_INSTANCE_KEY", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_PROJECT_CLOSED: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_PROJECT_CLOSED", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_WORDING_MALFORMED: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_WORDING_MALFORMED", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_SINCE_MALFORMED: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_SINCE_MALFORMED", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_NOT_OPEN: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_NOT_OPEN", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_UNCHANGED: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_UNCHANGED", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_SINCE_EARLIER: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_SINCE_EARLIER", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
      NOTICE_NOT_THE_OWNER: (r, cs) => { cs.set("noticeRefusal", { code: "NOTICE_NOT_THE_OWNER", from: "" }); return cs.w("screen.project.notice.when.a.notice.cant.be"); },
    } },
  /* R76 (network-notices R4): the previewed statement signed in the shell signer, in the notice namespace; the digest, the
     signature and the acknowledgement are posted. A declined signing sends nothing; nothing is drawn as published before the
     answer. The signature is the shell signer's alone: no key, passphrase or signature is kept by this screen. */
  { op: "noticepost", label: "act.noticepost.label.project", outward: true, rereads: [],
    send: async (view, el, cs) => {
      const pr = view.ui.notice && view.ui.notice.prepared;
      if (!pr || !pr.statement) return null;
      const ticked = Array.isArray(view.ui["pick:notice-ack"]) && view.ui["pick:notice-ack"].includes("ack");
      if (!ticked) return null;
      const signed = await cs.signer.sign([{ label: String(pr.digest || ""), bytes: new TextEncoder().encode(String(pr.statement)), namespace: "bio-working-on" }]);
      if (!signed || signed.ok !== true || !Array.isArray(signed.signatures) || signed.signatures.length !== 1) return { refuse: "signing.ceremony.declined" };
      return { body: { digest: pr.digest, signature: signed.signatures[0], acknowledged: true } };
    },
    done(view, answer, cs) {
      cs.set("pick:notice-ack", []);
      cs.set("notice", null);
      cs.set("later", Object.assign({}, view.ui.later, { notices: null }));
    },
    /* DEC-366 (4c): on NOTICE_SIGNATURE_REFUSED the offer is a reference to `account`, where `signerregisterown` is the act;
       no act of it is drawn on `project` */
    refusals: {
      NOTICE_SIGNATURE_REFUSED: (r, cs) => `${cs.w("refusal.NOTICE_SIGNATURE_REFUSED")} <a class="cs-ref" href="/app/account" data-nav data-notice="registerkey">${cs.w("act.signerregisterown.label.account")}</a>`,
    } },
];

/** The keys the project screen may draw (R44: keys only). */
const words = Object.freeze([
  "screen.project.name", "screen.project.purpose", "screen.project.account.open",
  ...["promote", "drawquestion", "findin", "projectbarset", "projectinvite", "projectjoin", "planopen", "projectvisibilityset",
    "projectownerremove", "projectowneradd", "projectremove", "projectleave", "projectfork", "projectownerrescue",
    "projectrequest", "projectrequestwithdraw", "noticeprepare", "noticepost"]
    .map((op) => "act." + op + ".label.project"),
  "mark.scale.capture.name", "mark.scale.capture.means", "mark.scale.connection.name", "mark.scale.connection.means",
  "mark.grade.reading", "mark.strength.means", "mark.gap.undetermined.name", "mark.gap.undetermined.means",
  "mark.gap.unrated.name", "mark.gap.unrated.means", "state.empty", "state.loading", "state.failed", "state.undetermined",
  "member.founder.unnamed", "shell.reason", "shell.reason.help", "shell.reason.needed", "file.recheck.revisit", "file.recheck.none",
  "screen.timeline.name", "screen.calculation.name", "screen.standard.name",
  "shell.card.plan", "shell.card.timeline", "shell.card.calculation", "shell.card.standard", "shell.card.money", "shell.card.proceeding",
  "shell.card.request", "shell.card.matter", "shell.card.action", "shell.card.case-editor", "shell.card.review-copy", "shell.card.ceremony",
  "shell.card.published", "shell.card.docket", "screen.money.name", "screen.proceeding.name", "screen.request.name", "screen.matter.name",
  "screen.action.name", "screen.plan.name", "screen.case-editor.name", "screen.review-copy.name", "screen.ceremony.name",
  "screen.published.name", "screen.docket.name", "project.settings.fold", "screen.document.cite.option", "project.bar.both", "project.bar.source_only",
  "project.bar.connection_only", "project.bar.none", "term.bar.project.means", "term.bar.team.means", "act.promote.here.project",
  "stake.project.title", "stake.project.group", "stake.project.label", "stake.project.help", "stake.project.save", "stake.set",
  "stake.history", "stake.none", "stake.unreadable", "stake.unreadable.summary", "projects.request.asked",
  "shell.unavailable.notyours.title", "shell.unavailable.notyours.says",
  "project.work.title", "project.work.help", "project.visibility.title", "project.visibility.hidden", "project.visibility.discoverable",
  "project.visibility.history", "project.visibility.started", "project.visibility.setting.hidden", "project.visibility.setting.findable", "project.visibility.start.hidden", "project.visibility.start.discoverable",
  "project.member.owner", "project.member.member", "project.member.since", "project.member.joined", "project.owners.pending",
  "project.owners.pending.remove", "project.owners.agree", "project.owners.rule", "project.rescue.title", "project.rescue.says",
  "project.rescue.own", "project.rescue.title.nodate", "project.firstquestion", "project.firstquestion.help", "project.adddoc", "project.start.title", "project.start.title.help",
  ...["objective", "stage.head", "stage.forming", "stage.investigating", "stage.matured", "stage.closed", "stage.read", "stage.legs",
    "stage.concluded", "bar.head", "bar.declared", "bar.axisnone", "bar.none", "bar.unset", "bar.help", "questions.head",
    "questions.notdrawn", "draw.head", "draw.choose", "draw.note", "draw.help", "draw.empty", "draw.already", "draw.done",
    "question.label", "question.help", "question.empty", "account.head", "account.project", "account.member", "account.off",
    "account.where", "members.head", "members.invited", "members.who", "invite.label", "invite.empty", "notjoined",
    "notjoined.owners", "plan.label", "plan.about", "plan.empty", "plan.head"].map((k) => "screen.project." + k),
  /* R75, R76, R77 (T51): the stand-down vote, "Telling the network", the published notice and the refusals they draw */
  ...["you.are.an.owner.of", "an.owner.is.named.dev", "standing.down.is.possible.at", "with.2.owners.an.owner", "this.is.a.vote.you",
    "at.2.owners.the.departing", "a.reason.in.your.words", "nothing.is.drafted.or.suggested", "it.is.kept.with.your", "a.project.with.no.owner",
    "check.that.another.owner.remains", "help", "help2"].map((k) => "screen.project.ownerstand." + k),
  "screen.project.2.of.2.the.departing", "screen.project.the.last.owner.stays", "screen.project.both.agree.a.resignation.the",
  "screen.project.how.it.changes.with.the", "screen.project.owners.follow.the.same.rule", "screen.project.a.project.can.always.be",
  "screen.project.how.many.owners.must.agree.explain", "screen.project.a.count.you.can.check.explain", "screen.project.1.of.2.have.agreed", "screen.project.agree.dev.stands.down.as", "screen.project.by.standing.down.17.october",
  "screen.project.the.change.waits.for.ana", "screen.project.this.takes.2.of.2", "screen.project.with.two.owners.standing.down",
  ...["heading", "beforevote", "takes", "agreed", "notyet"].map((k) => "screen.project.standdown." + k),
  ...["owners", "takes", "why"].map((k) => "screen.project.scale.head." + k), "screen.project.scale.now", "screen.project.scale.takes", "screen.project.scale.who",
  "screen.project.dev.is.standing.down.as", "screen.project.ownerstand.required",
  /* FR-28: stage needs (R94), the close (R109), the rerun comparison (R107), the stand-down notice (R122), the objective's link (R106), writing help */
  ...["what.each.stage.needs", "the.record.decides.the.stage.by", "nothing.here.is.a.button.when", "either.one.reaches.it.the.project",
    "help.for.each.stage.what.it.took", "help.counts.come.from.the.record.each", "how-far-the-project-has-come-toward-its-objectiv"].map((k) => "screen.project." + k),
  ...["head", "open", "why", "superseded", "do", "note1", "note2", "ref.owner", "ref.reason", "tip"].map((k) => "screen.project.closenow." + k),
  "state.item.resolved.name", "state.item.abandoned.name", "screen.objective.name", "screen.imported.citeimp.note",
  ...["head", "unchanged", "names", "not_cause", "lens_diff", "only_theirs", "both", "findings", "paired", "differ", "unpaired", "pair_label", "pair_none",
    "pair_is", "pair_strength", "pair_withdraw", "refused_member", "refused_member_next", "refused_own", "refused_own_next"].map((k) => "screen.project.cmp_" + k),
  "act.owed_rerunread.label.project", "act.owed_rerunpair.label.project", "act.writinghelp.label.project", "act.writinghelp.does",
  "project.owners.standdown.opened", "project.owners.agree.remove", "act.heldcaptures.label.project", "act.heldcaptures.does",
  ...["head", "about1", "about2", "none1", "none2", "listhelp", "kind.web", "kind.sheet", "kind.photo", "captured"].map((k) => "screen.project.docs." + k), "screen.group-identity.draft.label", "ai.label.untested",
  "refusal.BASIS_REFUSED", "refusal.ACTION_BASIS_REFUSED", "refusal.PROJECT_ACT_NOT_THE_OWNER", "refusal.CLOSE_BAD_REASON",
  "refusal.STAKE_MALFORMED.project", "refusal.MACHINE_CANNOT_SET_STAKE",
  ...["heading", "legend.welcome", "legend.sign", "thenotice", "change", "stop", "lapsed.on", "missed", "your.team.has.two.other", "tell.the.network.we.are", "an.owner.can.publish.a", "it.is.public.and.it", "only.an.owner.can.do",
    "you.sign.it.in.your", "it.names.no.member.only", "what.the.notice.says", "what.the.team.is.working", "one.line.up.to.280",
    "nothing.is.filled.in.from", "a.few.words.more.optional", "one.line.up.to.120", "the.matter.it.belongs.to", "one.line.up.to.120.2",
    "working.on.it.since", "a.date.no.earlier.than", "we.welcome.others.who.want", "the.notice.then.points.to", "when.a.notice.cant.be",
    "what.the.public.sees", "the.wording.the.date.you", "the.teams.own.civicsmith.then", "work.by.the.assistant.is", "help", "help2",
    "once.you.preview.it", "working.on.it.since.3", "anyone.can.read.this.including", "stopping.the.notice.later.ends",
    "you.can.still.publish.readers", "i.understand.that.this.is", "your.key.signs.this.exact", "if.anything.changes.you.preview",
    "a.preview.is.good.for", "as.the.teams.civicsmith.worked", "the.next.monthly.check.is", "a.notice.that.stays.dormant",
    "1.case.published.from.this", "cases.published.from.this", "anyone.can.read.this.at", "each.owner.of.the.project", "change.it.or.stop.it",
    "if.you.stop.where.the", "one.line.up.to.280.2", "it.is.published.with.the", "a.change.is.a.new", "a.stop.is.signed.too",
    "neither.removes.what.was.published", "this.project.already.has.an", "change.that.one.or.stop", "the.date.is.before.the",
    "your.teams.public.address.or", "an.administrator.can.finish.setting", "this.project.is.closed", "a.closed.project.can.only"].map((k) => "screen.project.notice." + k),
  "screen.connect.outward", "network-notices.others_working_welcome",
  ...["very_active", "active", "some_work", "quiet", "dormant"].map((k) => "network-notices.level." + k), ...["open", "stopped", "closed", "lapsed"].map((k) => "network-notices.status." + k),
  "network-notices.week_counts_holds", "network-notices.counted_assistant_work", "state.item.published.name", "mark.outward.means",
  "mark.gap.refused.name", "mark.gap.refused.means", "shell.icon.clock", "shell.cancel", "signing.ceremony.declined", "act.signerregisterown.label.account", "conformance.rests", "conformance.falsify",
  ...["NOTICE_ALREADY_OPEN", "NOTICE_NOT_OPEN", "NOTICE_NOT_THE_OWNER", "NOTICE_NO_GROUP_SLUG", "NOTICE_NO_INSTANCE_KEY", "NOTICE_PROJECT_CLOSED",
    "NOTICE_SIGNATURE_REFUSED", "NOTICE_SINCE_BEFORE_PROJECT", "NOTICE_SINCE_EARLIER", "NOTICE_SINCE_IN_FUTURE", "NOTICE_SINCE_MALFORMED",
    "NOTICE_STALE", "NOTICE_UNCHANGED", "NOTICE_WARNING_NOT_ACKNOWLEDGED", "NOTICE_WORDING_MALFORMED", "MACHINE_CANNOT_POST_NOTICE",
    "NO_REASON", "ALREADY_VOTED", "LAST_OWNER", "LAST_COMMITTED_OWNER", "TARGET_CANNOT_VOTE", "VOTES_SHORT", "NOT_AN_OWNER", "NOT_THE_OWNER",
    "NO_SUCH_HANDLE", "PROJECT_ACT_NOT_THE_OWNER", "PROJECT_ACT_NOT_A_PARTICIPANT"].map((c) => "refusal." + c),
  ]);

/** The project screen (interface-shell R21), with the module's shared readers as its parts. */
export function projectScreen(parts) {
  return Object.freeze({ id: "project", reads, place, render, acts, words, parts: Object.freeze({ ...parts, findings: findingWords, named }) });
}
