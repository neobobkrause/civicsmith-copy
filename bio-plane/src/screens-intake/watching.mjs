/* The `watching` screen (Add › Watched addresses; R46; DEC-375 C56), at `/app/watching`: every address the team watches, pausing and
 * resuming the watching, what is due, and the sweeps (`monitoring`, `monitorpause`, `monitorslate`, `sweeps`). The addresses and the
 * sweeps are read when the screen opens, and again by their acts. Self-contained functions over the kit `cs` (interface-shell R21 (1)). */

/* R46: the watched addresses (`monitoring`, with the pause as it stands), the sweeps (`sweeps`) and the team's members (who paused,
   who ratified). */
function watchingReads() {
  return { list: { op: "monitoring", query: {} }, sweeps: { op: "sweeps", query: {} },
           /* R48 (C56; DEC-382): the named requests, and the projects they and the sweeps are kept in */
           named: { op: "namedrequests", query: {} }, projects: { op: "projectlist" } };
}

function renderWatching(cs, view) {
  const U = view.ui || {}, D = view.data || {};
  /* C94 (interface-shell R111): a member is named by the shell's name for her id (her handle; a fallback word where none is known), never the id */
  const handleOf = (m) => { const x = String(m || "").replace(/^member:/, ""); return x ? cs.memberName(x) : ""; };
  const named = (t) => `<span class="mk-data">${cs.esc(t)}</span>`;
  const freqs = ["hourly", "daily", "weekly", "monthly", "per_meeting"];
  /* the watching: running, or paused by whom and when; a pause or resume for an administrator (anyone else is refused in words) */
  const L = D.list && (D.list.state === "ok" || D.list.state === "empty") ? D.list.value || {} : null;
  const paused = L && L.paused && L.paused.paused === true ? L.paused : null;
  const state = L ? cs.sheet(paused
      ? cs.row(cs.icon("hold"), `<b>${cs.w("screen.watching.paused")}</b> ${cs.w("screen.watching.paused.line", { name: { html: named(handleOf(paused.by)) }, date: { html: paused.at ? cs.date(paused.at) : "" }, time: paused.at ? String(paused.at).slice(11, 16) : "" })} ${cs.w("screen.watching.paused.effect")}`)
      : cs.row(cs.icon("clock"), `<b>${cs.w("screen.watching.running")}</b>`, "", cs.w("screen.watching.running.meta")))
    /* C90: pausing and resuming are the administrator's; a member, whom the plane would refuse, is not offered them */
    + (view.me && view.me.administer === true ? `<div class="mk-acts">${paused ? cs.act("monitorpause", { label: "screen.watching.resume", data: { paused: "false" } }) : cs.act("monitorpause", { label: "screen.watching.pause", data: { paused: "true" } })}</div>` : "") : "";
  const running = state ? cs.sec("screen.watching.running.head", state) : "";
  /* every watched address: how often, when last checked, when next due; the unscheduled and the ended stated, none left out */
  const listed = cs.state(D.list, (v) => {
    const items = Array.isArray(v.items) ? v.items : [];
    if (!items.length) return "";
    const c = v.counts || {};
    const meta = (r) => {
      const f = freqs.includes(r.frequency) ? cs.w("monitor.freq." + r.frequency) : "";
      const last = r.last_checked ? `${cs.w("screen.watching.nr.last")} ${cs.date(r.last_checked)}` : "";
      if (r.state === "due") return [f, last, cs.w("screen.watching.nr.due")].filter(Boolean).join(" · ");
      if (r.state === "scheduled") return [f, last, r.next_at ? `${cs.w("screen.watching.nr.next")} ${cs.date(r.next_at)}` : ""].filter(Boolean).join(" · ");
      if (r.state === "ended") return cs.w("screen.watching.ended", { date: { html: r.until ? cs.date(r.until) : "" }, name: { html: named(handleOf(r.until_set && r.until_set.by)) } });
      return cs.w("screen.watching.unscheduled");
    };
    const rows = items.map((r) => cs.row(cs.icon(r.state === "unscheduled" ? "hint" : "clock"), `<b class="mk-data">${cs.esc(r.address || r.bundle || "")}</b>`, "", meta(r))).join("");
    return `<p class="mk-small muted">${cs.w("screen.watching.counts", { due: c.due || 0, scheduled: c.scheduled || 0, unscheduled: c.unscheduled || 0, ended: c.ended || 0 })}</p>`
      + cs.sheet(rows)
      + (items.some((r) => r.state === "unscheduled") ? `<p class="mk-note">${cs.w("screen.watching.unscheduled.note1")} ${cs.w("screen.watching.unscheduled.note2")}</p>` : "");
  }, { empty: "state.empty" });
  const list = D.list && D.list.state === "empty" || (L && !(Array.isArray(L.items) && L.items.length)) ? ""
    : cs.sec("screen.watching.list.head", listed + `<div class="mk-acts">${cs.act("monitoring")}</div>`, { help: "screen.watching.list.help" });
  /* what is due: the slate, a prompt to run by hand, quoted data */
  const slate = cs.sec("screen.watching.slate.head", `<p class="mk-small muted">${cs.w("screen.watching.slate.intro1")} ${cs.w("screen.watching.slate.intro2")}</p>`
    + (typeof U.slate === "string" && U.slate ? `<pre class="mk-data" style="white-space:pre-wrap;margin:0;font-size:12px">${cs.esc(U.slate)}</pre>` : "")
    + `<div class="mk-acts">${cs.act("monitorslate")}</div>`);
  /* the sweeps: each by its name, ratified by whom and when it next runs, or not ratified and so never run */
  const sweeps = D.sweeps && D.sweeps.state === "ok" && D.sweeps.value && Array.isArray(D.sweeps.value.sweeps) ? D.sweeps.value.sweeps : [];
  const sweepsSec = !sweeps.length ? "" : cs.sec("screen.watching.sweeps.head", cs.sheet(sweeps.map((s) => {
    let title = "";
    try { const d = JSON.parse(s.definition); title = d && typeof d.title === "string" ? d.title : ""; } catch (e) { title = ""; }
    const meta = s.ratified
      ? [cs.w("screen.watching.sweep.ratified", { name: { html: named(handleOf(s.ratified_by)) }, date: { html: s.ratified_at ? cs.date(s.ratified_at) : "" } }),
         s.next ? cs.w("screen.watching.sweep.next", { date: { html: cs.date(s.next) } }) : ""].filter(Boolean).join(" · ")
      : cs.w("screen.watching.sweep.unratified");
    return cs.row(cs.icon(s.ratified ? "clock" : "hold"), `<b class="mk-data">${cs.esc(title || s.sweep || "")}</b>`, "", meta);
  }).join(""))
    + `<div class="mk-acts">${cs.act("sweeps")}</div>`
    + `<p class="mk-note">${cs.w("screen.watching.sweep.note1")} ${cs.w("screen.watching.sweep.note2")}</p>`, { help: "screen.watching.sweep.help" });
  /* R48 (DEC-382): the named requests the team planted, with where, who stands behind the source, how often, when last checked and when
     due; one is retired from its row; a new one is asked for below it (nothing is fetched by asking) */
  const NR = D.named && (D.named.state === "ok" || D.named.state === "empty") ? D.named.value || {} : null;
  const requests = NR && Array.isArray(NR.items) ? NR.items : [];
  const projects = D.projects && D.projects.state === "ok" && D.projects.value && Array.isArray(D.projects.value.projects) ? D.projects.value.projects : [];
  const projectChoice = (id) => (projects.length ? cs.choice(id, "screen.watching.project", projects.map((x) => ({ value: x.id, text: String(x.name || x.id) }))) : "");
  const cadenceOf = (c) => (["hourly", "daily", "weekly", "monthly"].includes(c) ? cs.w("monitor.freq." + c) : "");
  const requestRow = (r) => {
    const text = r.target && typeof r.target.text === "string" ? r.target.text : String(r.request || "");
    const where = Array.isArray(r.locators) && r.locators.length ? r.locators[0] : "";
    const last = r.last_attempt && r.last_attempt.at ? `${cs.w("screen.watching.nr.last")} ${cs.date(r.last_attempt.at)}` : cs.w("screen.watching.nr.never");
    const clock = r.due === true || r.state === "due" ? cs.w("screen.watching.nr.due") : r.next ? `${cs.w("screen.watching.nr.next")} ${cs.date(r.next)}` : "";
    const meta = [cadenceOf(r.cadence), cs.w(r.status === "retired" ? "screen.watching.nr.retired" : "screen.watching.nr.open"), r.status === "retired" ? "" : last, r.status === "retired" ? "" : clock].filter(Boolean).join(" · ");
    return cs.row(cs.icon(r.status === "retired" ? "hold" : "clock"),
      `<b class="mk-data">${cs.esc(text)}</b><span class="meta">${cs.w("screen.watching.nr.where")}: <span class="mk-data">${cs.esc(where)}</span> · ${cs.w("screen.watching.nr.authority")}: <span class="mk-data">${cs.esc(r.authority || "")}</span></span>`,
      r.status === "retired" ? "" : cs.act("namedrequestset", { label: "screen.watching.nr.retire", tone: "quiet", data: { bundle: r.bundle, request: r.request } }), meta);
  };
  const namedSec = !requests.length ? "" : cs.sec("screen.watching.nr.head", cs.sheet(requests.map(requestRow).join(""))
    + `<div class="mk-acts">${cs.act("namedrequests")}</div><p class="mk-note">${cs.w("screen.watching.nr.listnote")}</p>`, { help: "screen.watching.nr.tip" });
  const ask = cs.sec("screen.watching.nr.ask", `<div style="display:grid;gap:14px">` + projectChoice("nr-project")
    + cs.field("nr-target", "screen.watching.nr.f.target", { rec: true, max: 200 })
    + cs.field("nr-desc", "screen.watching.nr.f.desc", { area: true, rec: true })
    + (view.reachable ? `<div class="mk-acts">${cs.act("writinghelp", { label: "act.writinghelp.label.watching" })}</div>` : "")
    + cs.field("nr-loc", "screen.watching.nr.f.loc", { area: true, help: "screen.watching.nr.f.lochelp" })
    + cs.field("nr-auth", "screen.watching.nr.f.auth", { help: "screen.watching.nr.f.authhelp" })
    + cs.choice("nr-matters", "screen.watching.nr.f.matters", [["crucial", "screen.watching.nr.f.crucial"], ["supporting", "screen.watching.nr.f.supporting"]], { value: "crucial" })
    + cs.choice("nr-often", "screen.watching.nr.f.often", [["hourly", "screen.watching.nr.f.c.hour"], ["daily", "screen.watching.nr.f.c.day"], ["weekly", "screen.watching.nr.f.c.week"],
        ["monthly", "screen.watching.nr.f.c.month"], ["none", "screen.watching.nr.f.c.none"]], { value: "weekly" })
    + `<div class="mk-acts">${cs.act("namedrequestset", { label: "screen.watching.nr.ask", tone: "primary" })}</div>`
    + `<p class="mk-note">${cs.w("screen.watching.nr.n1")} ${cs.w("screen.watching.nr.n2")} ${cs.w("screen.watching.nr.n3")}</p></div>`, { help: "screen.watching.nr.asktip" });
  /* a sweep is defined without being started; ratifying it (its project's owner only) or stopping it (any member who may write the project)
     is below, with the scope and budget it would run within */
  const define = cs.sec("screen.watching.sweepdef.head", `<div style="display:grid;gap:14px">` + projectChoice("sw-project")
    + cs.field("sw-title", "screen.watching.sweepdef.title", { rec: true, max: 200 })
    + cs.field("sw-sources", "screen.watching.sweepdef.sources", { area: true, help: "screen.watching.sweepdef.sourceshelp" })
    + cs.field("sw-seeds", "screen.watching.sweepdef.seeds", { area: true })
    + cs.field("sw-match", "screen.watching.sweepdef.match", { area: true, rec: true, help: "screen.watching.sweepdef.matchhelp" })
    + cs.choice("sw-often", "screen.watching.sweepdef.often", [["daily", "screen.watching.nr.f.c.day"], ["weekly", "screen.watching.nr.f.c.week"], ["monthly", "screen.watching.nr.f.c.month"]], { value: "weekly" })
    + cs.field("sw-budget", "screen.watching.sweepdef.budget")
    + `<div class="mk-acts">${cs.act("sweepset", { label: "screen.watching.sweepdef.head", tone: "primary" })}</div>`
    + `<p class="mk-note">${cs.w("screen.watching.sweepdef.n1")} ${cs.w("screen.watching.sweepdef.n2")}</p></div>`, { help: "screen.watching.sweepdef.tip" });
  const me = String((view.me && view.me.handle) || "");
  const ratifySec = !sweeps.length ? "" : cs.sec("screen.watching.sweepdef.rathead", sweeps.map((s) => {
    let d = {};
    try { d = JSON.parse(s.definition) || {}; } catch (e) { d = {}; }
    const hosts = (Array.isArray(d.sources) ? d.sources : []).map((h) => String(h).replace(/^https?:\/\//, "")).join(", ");
    const per = d.budget && Number.isFinite(d.budget.per_run) ? d.budget.per_run : null;
    /* who owns the sweep's project: its participants, read once per project and kept in page memory */
    const M = U.owners || (U.owners = {});
    if (!M[s.bundle]) {
      M[s.bundle] = { state: "loading" };
      cs.call("projectparticipants", { query: { projectId: s.bundle } }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        M[s.bundle] = r && Array.isArray(r.participants) ? { state: "ok", owners: r.participants.filter((x) => x && Number(x.owner) && (x.state === "joined" || x.state === "leaving")).map((x) => String(x.handle || "")) } : { state: "failed" };
        cs.set("owners", M);
      }, () => { M[s.bundle] = { state: "failed" }; cs.set("owners", M); });
    }
    const owners = M[s.bundle].state === "ok" ? M[s.bundle].owners : null;
    const mine = !!owners && owners.includes(me);
    const row = cs.row(cs.icon(s.ratified ? "clock" : "hold"), `<b class="mk-data">${cs.esc(d.title || s.sweep || "")}</b><span class="meta">${cs.w("screen.watching.sweepdef.scope", { hosts: { html: `<span class="mk-data">${cs.esc(hosts)}</span>` }, budget: { html: `<span class="mk-data">${per === null ? "" : (per === 1 ? cs.w("screen.watching.sweep.pages.one") : cs.w("screen.watching.sweep.pages", { count: per }))}</span>` } })}</span>`);
    const acts = s.ratified ? cs.act("sweepratify", { label: "screen.watching.sweepdef.stop", data: { sweep: s.sweep, ratified: "false" } })
      : mine ? cs.act("sweepratify", { label: "screen.watching.sweepdef.ratify", tone: "primary", data: { sweep: s.sweep, ratified: "true" } }) : "";
    const who = !s.ratified && owners && !mine && owners.length ? `<p class="mk-note">${cs.w("screen.watching.sweepdef.ref.owner1")} ${cs.w("screen.watching.sweepdef.ref.owner2", { owners: owners.join(", ") })}</p>` : "";
    return cs.sheet(row) + (s.ratified ? "" : `<p class="mk-note">${cs.w("screen.watching.sweepdef.rat1")} ${cs.w("screen.watching.sweepdef.rat2")}</p>`) + (acts ? `<div class="mk-acts">${acts}</div>` : "") + who;
  }).join("") + `<p class="mk-note">${cs.w("screen.watching.sweepdef.ratnote1")} ${cs.w("screen.watching.sweepdef.ratnote2")}</p>`, { help: "screen.watching.sweepdef.rattip" });
  return `<div class="mk-h">${cs.title()}<p class="mk-sub">${cs.w("screen.watching.intro")}</p></div>` + running + list + slate + sweepsSec + namedSec + ask + define + ratifySec;
}

/* R46: "Pause the watching" / "Resume the watching" (`monitorpause`): the administrator's act; the shell asks its reason. The pause as it
 * stands is read again after, so the page says what the record holds. */
function sendPause(view, el) { return { body: { paused: !!(el && el.dataset && el.dataset.paused === "true") } }; }
/* the two lists asked again by their acts (reads: nothing changes) */
function sendRefresh() { return { query: {} }; }
/* "Read what is due": the slate's prompt, drawn as quoted data to run by hand */
function sendSlate() { return { query: {} }; }
function doneSlate(view, answer, cs) { cs.set("slate", answer && typeof answer.prompt === "string" ? answer.prompt : ""); }

/* R48: "Ask for this to be gathered on a schedule" (`namedrequestset`): the project it is kept in, what to gather (one line of at most 200
 * characters), a description, the places (one public https address on each line, the authoritative publisher first), who stands behind
 * the source, how much it matters and how often to look. A refusal the screen can see is drawn before anything is sent. */
function sendRequestSet(view, el, cs) {
  if (el && el.dataset && el.dataset.request) {
    /* "Retire this request": the request stated whole, its status `retired` */
    const items = view.data && view.data.named && view.data.named.value && Array.isArray(view.data.named.value.items) ? view.data.named.value.items : [];
    const r = items.find((x) => x && x.bundle === el.dataset.bundle && x.request === el.dataset.request);
    if (!r) return null;
    return { body: { bundle: r.bundle, request: r.request, target: r.target, locators: r.locators, authority: r.authority, criticality: r.criticality, ...(r.cadence ? { cadence: r.cadence } : {}), status: "retired" } };
  }
  const text = String(cs.value("nr-target") || "").trim();
  const places = String(cs.value("nr-loc") || "").split("\n").map((x) => x.trim()).filter(Boolean);
  if (!text || text.length > 200) return { refuse: "screen.watching.nr.ref.target" };
  if (!places.length || places.some((x) => !/^https:\/\//.test(x))) return { refuse: "screen.watching.nr.ref.https" };
  const auth = String(cs.value("nr-auth") || "").trim();
  if (!auth) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.watching.nr.f.auth") } } };
  const desc = String(cs.value("nr-desc") || "").trim();
  const cadence = ["hourly", "daily", "weekly", "monthly", "none"].find((c) => c === cs.value("nr-often")) || "none";
  return { body: { bundle: String(cs.value("nr-project") || ""), target: desc ? { text, description: desc } : { text }, locators: places, authority: auth,
                   criticality: cs.value("nr-matters") === "supporting" ? "supporting" : "crucial", cadence } };
}
/* R3's pattern (DEC-153): help wording what the member describes, drawn only while the assistant is reachable; the draft is filled into the
 * description field and kept only by the member's own act. */
function sendHelp(view, el, cs) {
  const told = String(cs.value("nr-desc") || "").trim();
  if (!told) return { refuse: "screen.capture.help.empty" };
  return { body: { op: "namedrequestset", field: "description", told } };
}
function doneHelp(view, answer, cs) { cs.fill("nr-desc", String((answer || {}).text || "")); }

/* R48: "Define a sweep" (`sweepset`): its name, the sites it may visit, the pages it starts from, what to keep, how often and the most it may
 * fetch in one run. Defining starts nothing: it is unratified until its project's owner ratifies it. */
function sendSweepSet(view, el, cs) {
  const lines = (id) => String(cs.value(id) || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const title = String(cs.value("sw-title") || "").trim(), sources = lines("sw-sources"), seeds = lines("sw-seeds"), terms = lines("sw-match");
  const per = Number(String(cs.value("sw-budget") || "").trim());
  if (!title) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.watching.sweepdef.title") } } };
  if (!sources.length || !seeds.length) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w(sources.length ? "screen.watching.sweepdef.seeds" : "screen.watching.sweepdef.sources") } } };
  if (!Number.isInteger(per) || per < 1) return { refuse: "capture.fieldneeded", fills: { field: { html: cs.w("screen.watching.sweepdef.budget") } } };
  return { body: { bundle: String(cs.value("sw-project") || ""), title, sources, seeds, match: { terms },
                   cadence: ["daily", "weekly", "monthly"].find((c) => c === cs.value("sw-often")) || "weekly", budget: { per_run: Math.min(per, 100), backlog: Math.min(per * 10, 1000) } } };
}
/* R48: "Ratify this sweep" / "Stop this sweep" (`sweepratify`): ratifying sends the team's fetches to the named sites, within the scope and
 * budget shown, each filing at `collected`, never higher; only the project's owner is offered it. Refusals in the design's words. */
function sendRatify(view, el) { return { body: { sweep: el && el.dataset ? String(el.dataset.sweep || "") : "", ratified: !!(el && el.dataset && el.dataset.ratified === "true") } }; }

export const WATCHING_SCREEN = Object.freeze({
  id: "watching",
  reads: watchingReads,
  render: renderWatching,
  acts: Object.freeze([
    Object.freeze({ op: "monitoring", rereads: Object.freeze(["list"]), label: "act.monitoring.label.watching", send: sendRefresh }),
    Object.freeze({ op: "monitorpause", rereads: Object.freeze(["list"]), label: "act.monitorpause.label.watching", send: sendPause, reasonField: "reason" }),
    Object.freeze({ op: "monitorslate", rereads: Object.freeze([]), label: "act.monitorslate.label.watching", send: sendSlate, done: doneSlate }),
    Object.freeze({ op: "sweeps", rereads: Object.freeze(["sweeps"]), label: "act.sweeps.label.watching", send: sendRefresh }),
    Object.freeze({ op: "namedrequests", rereads: Object.freeze(["named"]), label: "screen.watching.nr.list", send: sendRefresh }),
    Object.freeze({ op: "namedrequestset", rereads: Object.freeze(["named"]), label: "screen.watching.nr.ask", send: sendRequestSet,
                    refusals: Object.freeze({ MACHINE_CANNOT_SET_REQUEST: function (refusal, cs) { return cs.w("screen.watching.nr.ref.machine1") + " " + cs.w("screen.watching.nr.ref.machine2"); } }) }),
    Object.freeze({ op: "sweepset", rereads: Object.freeze(["sweeps"]), label: "screen.watching.sweepdef.head", send: sendSweepSet,
                    refusals: Object.freeze({ MACHINE_CANNOT_SET_SWEEP: function (refusal, cs) { return cs.w("screen.watching.sweepdef.ref.machine1") + " " + cs.w("screen.watching.sweepdef.ref.machine2"); } }) }),
    Object.freeze({ op: "writinghelp", rereads: Object.freeze([]), label: "act.writinghelp.label.watching", send: sendHelp, done: doneHelp, reasonField: "told" }),
    Object.freeze({ op: "sweepratify", rereads: Object.freeze(["sweeps"]), label: "screen.watching.sweepdef.ratify", send: sendRatify,
                    refusals: Object.freeze({ SWEEP_RATIFY_NOT_AN_OWNER: function (refusal, cs) { return cs.w("screen.watching.sweepdef.ref.owner1") + (refusal.owners ? " " + cs.w("screen.watching.sweepdef.ref.owner2", { owners: Array.isArray(refusal.owners) ? refusal.owners.join(", ") : String(refusal.owners) }) : ""); },
                                                    MACHINE_CANNOT_SET_SWEEP: function (refusal, cs) { return cs.w("screen.watching.sweepdef.ref.machine1") + " " + cs.w("screen.watching.sweepdef.ref.machine2"); } }) }),
  ]),
});
