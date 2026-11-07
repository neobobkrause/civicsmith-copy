/* screens-wizards R1, R8: Settings › Wizards, the group's wizard library and the registry's 6 acts (DEC-121, DEC-158).
   Reads `wizards` (offered by default, or the state the member chooses), `baseupdates` (each copy whose original has a
   newer approved version), `wizardread` (one version's steps, when the member opens them) and `projectlist` (the
   projects a recording or a copy is made in). Each script's version is a row (interface-shell R19) whose panel holds its
   acts; a Civicsmith script offers only the copy (wizard-scripts R9: `WIZARD_NOT_THE_GROUPS`). Every refusal is drawn by
   the shell (interface-shell R13); a check's refusal names its step. Recording a new wizard hands over to the guide in
   the dock (`cs.wizard`, interface-shell R31; R3) and sends nothing from here. The wizards in use and the states to list
   come first; writing, revising, approving and retiring sit in one fold (R16). Choosing a state reads it at once (R15).

   Every function is self-contained (interface-shell R21): it uses only its parameters, `cs` and the language's globals. */

/* The codes of `wizard-scripts`' step checks (its R2, R12): each answer names the step it refuses, drawn "Step <n>: …". */
const STEP_CODES = ["WIZARD_STEP_REFUSED", "WIZARD_NO_STEPS", "WIZARD_SCREEN_UNKNOWN", "WIZARD_ACT_UNKNOWN", "WIZARD_STEP_NO_WHY",
  "WIZARD_DRAFT_REFUSED", "WIZARD_VIA_REFUSED", "WIZARD_STEP_CONCLUDES", "WIZARD_RECORDING_CARRIES_VALUES"];
/* R14: the refusal's words are its key `refusal.<CODE>` (interface-shell R70, R83), the step it names in `{step}`; a code with
   no key is drawn as R83 draws one (the answer's own translation, else `refusal.uncatalogued` and the code) */
function stepRefusal(r, cs) {
  const key = "refusal." + (r && r.code);
  const held = cs.w(key, r || {});
  const words = held !== cs.esc(key) ? held
    : r && typeof r.translation === "string" && r.translation ? cs.esc(r.translation)
      : cs.w("refusal.uncatalogued") + " " + cs.esc((r && r.code) || "");
  return r && r.step !== null && r.step !== undefined && r.step !== ""
    ? cs.w("screen.wizards.refusal.step", { step: String(r.step), words: { html: words } }) : words;
}
const REFUSALS = Object.freeze(Object.fromEntries(STEP_CODES.map((c) => [c, stepRefusal])));

/* The states `wizards` lists (wizard-scripts R10; `WIZARDS_STATES_LISTED` and the default `offered`). */
export const LIBRARY_STATES = Object.freeze(["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"]);

export const library = {
  id: "wizards",

  reads(view) {
    // the state shown: the one chosen on the screen, else the one the address names (the guide opens Drafts after saving a
    // recording, R15), else the offered ones
    const STATES = ["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"], ui = (view && view.ui) || {};
    const shown = STATES.includes(ui.state) ? ui.state : STATES.includes(view && view.subject) ? view.subject : "offered";
    const state = shown !== "offered" ? shown : null;
    const out = {
      list: { op: "wizards", query: state ? { state } : undefined,
        empty: (v) => (v && v.state === "proposed" ? !(v.proposals || []).length : !(v && (v.scripts || []).length)) },
      updates: { op: "baseupdates", empty: (v) => !(v && (v.entries || []).length) },
      projects: { op: "projectlist", empty: (v) => !(v && (v.projects || []).length) },
    };
    // adopting a proposal names one of the member's own drafts (wizard-scripts R4)
    if (state === "proposed") out.drafts = { op: "wizards", query: { state: "draft" }, empty: (v) => !(v && (v.scripts || []).length) };
    return out;
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.wizards.";
    const ui = view.ui || {}, data = view.data || {}, me = view.me || {};
    const STATES = ["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"];
    const state = STATES.includes(ui.state) ? ui.state : STATES.includes(view.subject) ? view.subject : "offered";
    const idOf = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, "_");
    // a word by key, or null when the page holds none (the shell draws an unknown key as the key itself, R5)
    const said = (key, fills) => { const t = W(key, fills); return t === E(key) ? null : t; };
    // a Civicsmith script's name by its key `wizard.<id>.name`, a group's as recorded (R1)
    const nameOf = (s) => (s && s.origin === "civicsmith" && said("wizard." + s.id + ".name")) || E((s && s.name) || "");
    const screenName = (id) => said("screen." + id + ".name") || E(id || "");
    const actName = (screen, op) => (op ? said("act." + op + ".label." + screen) || E(op) : W(S + "steps.noact"));
    const projects = data.projects && data.projects.state === "ok" ? (data.projects.value.projects || []) : [];
    // the project a recording or a copy is made in: the projects the member sees (`projectlist`), as record data
    const projectField = (id) => projects.length
      ? cs.choice(id, S + "project.field", projects.map((p) => ({ value: p.id, text: p.name || p.id })))
      : "";
    const updates = data.updates && data.updates.state === "ok" ? (data.updates.value.entries || []) : [];
    const out = [cs.title(), `<p>${W("screen.wizards.purpose")}</p>`];

    // R15: choosing a state reads it at once, one press; "See the whole library" is the list again. R23: each filter's tip is
    // its own `state.<k>.tip`, in place of the library's (`act.wizards.does`, which stays on the screen's other `wizards` acts)
    const libraryTip = E(W("act.wizards.does"));
    const ownTip = (button, k) => {
      const own = E(W(S + "state." + k + ".tip"));
      return button.includes(libraryTip) ? button.split(libraryTip).join(own)
        : button.replace(/<button /, '<button data-level="2" data-tip="' + own + '" ');
    };
    const choice = STATES.map((k) => {
      const b = cs.act("wizards", { label: k === "offered" ? S + "act.seeall" : S + "state." + k, data: { state: k }, tone: k === state ? "primary" : "quiet" });
      return b ? ownTip(b, k) : "";
    }).join("");
    if (choice) out.push(`<div class="mk-acts" role="group" aria-label="${W(S + "state.field")}">${choice}</div>`);

    // one version's steps, opened from its row (`wizardread`)
    const opened = (vid) => (ui.opened && ui.opened.id === vid ? ui.opened : null);
    const stepsList = (s, o) => cs.state(o.read, (a) => {
      const steps = (a && a.version && a.version.steps) || [];
      const lines = steps.map((st, i) => {
        const n = i + 1;
        const what = (s.origin === "civicsmith" && said("wizard." + s.id + ".step" + n + ".what")) || E(st.what || "");
        const why = (s.origin === "civicsmith" && said("wizard." + s.id + ".step" + n + ".why")) || E(st.why || "");
        const kind = st.draft && typeof st.draft === "object" ? Object.keys(st.draft)[0] : null;
        return `<li><span class="what">${what || W(S + "steps.recorded", { screen: { html: screenName(st.screen) }, act: { html: actName(st.screen, st.act) } })}</span>`
          + (why ? `<span class="why">${W(S + "steps.why", { why: { html: why } })}</span>` : "")
          + `<span class="meta">${W(S + "steps.where", { screen: { html: screenName(st.screen) } })} · ${actName(st.screen, st.act)}`
          + (st.via ? " · " + W(S + "steps.via", { name: { html: said("wizard." + st.via + ".name") || E(st.via) } }) : "")
          + (kind && ["text", "template", "machine"].includes(kind) ? " · " + W(S + "steps.draft." + kind) : "") + "</span></li>";
      });
      return cs.sec(S + "steps.head", `<ol class="mk-list">${lines.join("")}</ol>`);
    });
    // the author's draft, reworded, reordered or pruned in place (`wizardrevise`)
    const editOf = (o) => cs.state(o.read, (a) => {
      const steps = (a && a.version && a.version.steps) || [];
      const save = cs.act("wizardrevise", { label: S + "act.save", data: { mode: "edit", version: o.id } });
      if (!save) return "";
      const k = idOf(o.id);
      return cs.sec(S + "edit.head", steps.map((st, i) => {
        const n = String(i + 1);
        return `<fieldset class="cs-field"><legend>${W(S + "edit.what", { n })}</legend>`
          + cs.field(`wz-w-${k}-${i}`, S + "edit.what", { area: true, value: st.what || "", fills: { n } })
          + cs.field(`wz-y-${k}-${i}`, S + "edit.why", { area: true, value: st.why || "", fills: { n } })
          + cs.field(`wz-p-${k}-${i}`, S + "edit.place", { type: "number", value: n, fills: { n } })
          + `<label><input type="checkbox" id="wz-x-${k}-${i}"> ${W(S + "edit.remove", { n })}</label></fieldset>`;
      }).join("") + `<fieldset class="cs-field"><legend>${W(S + "edit.add")}</legend>`
        + cs.field(`wz-as-${k}`, S + "edit.addscreen") + cs.field(`wz-aa-${k}`, S + "edit.addact")
        + cs.field(`wz-aw-${k}`, S + "edit.addwhat", { area: true }) + cs.field(`wz-ay-${k}`, S + "edit.addwhy", { area: true }) + `</fieldset>` + save);
    });

    // what changed in a copy's original (`baseupdates`; DEC-158 (4)), with the act that brings it across (R1)
    const changes = (s, v) => updates.filter((u) => u.copy === s.id && (u.copy_version === v.id)).map((u) => {
      const list = (steps, base) => `<ol class="mk-list">${(steps || []).map((st, i) => {
        const what = (base && u.base && String(u.base).startsWith("WIZ-") && said("wizard." + u.base + ".step" + (i + 1) + ".what")) || E(st.what || "");
        return `<li>${what} <span class="meta">${screenName(st.screen)} · ${actName(st.screen, st.act)}</span></li>`;
      }).join("")}</ol>`;
      const across = v.state === "draft"
        ? cs.act("wizardrevise", { label: S + "act.adoptbase", data: { mode: "base", version: v.id, base: u.base_version } })
        : `<p>${W(S + "changes.newdraft")}</p>` + cs.act("wizarddraft", { label: S + "act.newdraft", data: { mode: "from", from: v.id, name: s.name || "" } });
      return cs.sec(S + "changes.head", `<p>${W(S + "basechanged")}</p><h3>${W(S + "changes.copy")}</h3>${list(u.steps && u.steps.copy, false)}`
        + `<h3>${W(S + "changes.base")}</h3>${list(u.steps && u.steps.base, true)}${across}`, { fills: { name: { html: said("wizard." + u.base + ".name") || E(u.base_name || "") } } });
    });

    // R1: a version's reading panel: its steps, for whoever may see the wizard
    const readPanel = (s, v) => {
      const p = [cs.act("wizards", { label: S + "act.steps", data: { open: v.id } })];
      if (opened(v.id)) p.push(stepsList(s, opened(v.id)));
      return p.join("");
    };
    // R1, R16: a version's authoring panel: the acts its state and its owner allow; "" when none is drawn
    const authoring = (s, v) => {
      const p = [];
      const k = idOf(v.id);
      const own = v.state === "draft" && v.author && v.author.id && v.author.id === me.member;
      if (own) {
        const open = cs.act("wizards", { label: S + "act.steps", data: { open: v.id } });
        if (open) p.push(open);
        if (opened(v.id)) p.push(editOf(opened(v.id)));
      }
      const reason = (id) => cs.field(id, S + "reason.field", { area: true });
      const live = !s.retired && v.state === "approved";
      if (live) {
        const copy = cs.act("wizarddraft", { label: S + "act.copy", data: { mode: "copy", version: v.id, name: s.name || "" } });
        if (copy) p.push(`<div class="mk-acts"><p>${W(S + "copy.note")}</p>${projectField("wz-cp-" + k)}${cs.field("wz-cn-" + k, S + "name.field", { value: s.name || "" })}${copy}</div>`);
      }
      if (s.origin === "civicsmith") { if (p.length) p.push(`<p class="mk-note">${W(S + "civicsmith.only")}</p>`); return p.join(""); }
      if (v.state === "draft") p.push(cs.act("wizardsubmit", { data: { version: v.id } }));
      if (v.state === "submitted") p.push(cs.act("wizardapprove", { data: { version: v.id } }));
      if (live && !s.widened && s.scope && typeof s.scope === "object") p.push(cs.act("wizardapprove", { label: S + "act.widen", data: { version: v.id, widen: "1" } }));
      const withdraw = v.state === "draft" || v.state === "submitted"
        ? cs.act("wizardretire", { label: S + "act.withdraw", data: { script: s.id, version: v.id, field: "wz-r-" + k } }) : "";
      if (withdraw) p.push(`<div class="mk-acts">${reason("wz-r-" + k)}${withdraw}</div>`);
      const retire = live ? cs.act("wizardretire", { label: S + "act.retire", data: { script: s.id, field: "wz-rr-" + k } }) : "";
      if (retire) p.push(`<div class="mk-acts">${reason("wz-rr-" + k)}${retire}</div>`);
      p.push(...changes(s, v));
      return p.join("");
    };

    // the rows of the listed state: the reading table (own = false), or the authoring table inside the fold (own = true)
    const rowsOf = (v, own) => {
      if (v.state === "proposed") {
        const drafts = data.drafts && data.drafts.state === "ok" ? (data.drafts.value.scripts || []).flatMap((s) => (s.versions || [])
          .filter((x) => x.state === "draft" && x.author && x.author.id === me.member).map((x) => ({ id: x.id, name: s.name }))) : [];
        return cs.rows({
          id: own ? "ownproposals" : "proposals", cols: [S + "col.name", S + "col.base"], items: v.proposals || [], key: (p) => String(p.id),
          name: (p) => String(p.why || p.id).slice(0, 60),
          cells: (p) => [W(S + "proposal.by", { why: p.why || "" }), p.script ? E(p.script) : W(S + "nobase")],
          acts: (p) => {
            if (!own) return "";
            const k = idOf(p.id);
            const from = cs.act("wizarddraft", { label: S + "act.fromproposal", data: { mode: "from", from: p.id, field: "wz-pn-" + k } });
            const adopt = drafts.length ? cs.act("wizardrevise", { label: S + "act.adopt", data: { mode: "adopt", adopt: p.id, field: "wz-pd-" + k } }) : "";
            return (from ? `<div class="mk-acts">${cs.field("wz-pn-" + k, S + "name.field")}${from}</div>` : "")
              + (adopt ? `<div class="mk-acts">${cs.choice(`wz-pd-${k}`, S + "draftfor.field", drafts.map((d) => ({ value: d.id, text: d.name + " · " + d.id })))}${adopt}</div>` : "");
          },
        });
      }
      let items = (v.scripts || []).flatMap((s) => (s.versions || []).map((x) => ({ s, v: x })));
      if (own) {
        const panels = new Map(items.map((it) => [String(it.v.id), authoring(it.s, it.v)]));
        items = items.filter((it) => panels.get(String(it.v.id)));
        return cs.rows({ id: "own", cols: [S + "col.name"], items, key: (it) => String(it.v.id), name: (it) => String(it.s.name || it.s.id),
          cells: (it) => [`<b>${nameOf(it.s)}</b> <span class="meta">${W(S + "version", { n: String(it.v.version) })}</span>`],
          acts: (it) => panels.get(String(it.v.id)) });
      }
      return cs.rows({
        id: "library", cols: [S + "col.name", S + "col.whose", S + "col.base", S + "col.approver", S + "col.finished"], items, key: (it) => String(it.v.id),
        name: (it) => String(it.s.name || it.s.id),
        cells: (it) => {
          const { s, v: x } = it;
          const marks = [s.required ? W(S + "required") : "", x.state !== "approved" && S + "vstate." + x.state ? said(S + "vstate." + x.state) || "" : "",
            s.retired ? W(S + "retired", { reason: s.retired.reason || "" }) : "", x.broken ? W(S + "broken") : "",
            updates.some((u) => u.copy === s.id && u.copy_version === x.id) ? W(S + "basechanged") : ""].filter(Boolean);
          const base = !s.based_on ? W(S + "nobase") : s.based_on.name
            ? W(S + "basedon", { name: { html: (s.based_on.version && said("wizard." + String(s.based_on.version).split("@")[0] + ".name")) || E(s.based_on.name) } })
            : W(S + "basehidden");
          return [
            `<b>${nameOf(s)}</b> <span class="meta">${W(S + "version", { n: String(x.version) })}${marks.length ? " · " + marks.join(" · ") : ""}</span>`,
            W(s.origin === "civicsmith" ? S + "whose.civicsmith" : s.widened ? S + "whose.widened" : S + "whose.group"),
            base,
            x.approved && x.approved.by ? E(x.approved.by.name || x.approved.by.id || "") : W(S + "notapproved"),
            (x.use && x.use.finish > 0) ? W(S + "finished", { n: String(x.use.finish) }) : "",
          ];
        },
        acts: (it) => readPanel(it.s, it.v),
      });
    };

    // the wizards in use, first (R16)
    out.push(cs.sec(S + "showing", cs.state(data.list, (v) => rowsOf(v, false), { empty: S + "empty." + state }), { fills: { state: { html: W(S + "state." + state) } } }));

    // R16: writing, revising, approving and retiring fold together, closed, `own.says` first; R3: a recording is made on the real screens
    const record = cs.act("wizarddraft", { data: { mode: "record" } });
    const own = [];
    if (record) own.push(cs.sec(S + "record.head", `<p>${W(S + "record.intro")}</p>${projectField("wz-project")}${record}`));
    if (data.list && data.list.state === "ok") own.push(rowsOf(data.list.value, true));
    if (own.join("").trim()) out.push(`<details class="mk-details" data-wizards-own><summary>${W(S + "own.fold")}</summary><p class="mk-note">${W(S + "own.says")}</p>${own.join("")}</details>`);
    return out.join("");
  },

  acts: [
    // `wizards`, a read: the list in the state pressed (R15); or one version's steps opened beneath its row (`wizardread`)
    { op: "wizards", rereads: ["list", "drafts"],
      async send(view, el, cs) {
        const ui = view.ui;
        const open = el && el.dataset ? el.dataset.open : null;
        if (open) {
          if (ui.opened && ui.opened.id === open) { cs.set("opened", null); return null; }
          const at = open.lastIndexOf("@");
          cs.set("opened", { id: open, read: { state: "loading", value: null, refusal: null } });
          const a = await cs.call("wizardread", { query: { script: open.slice(0, at), version: open } });
          const read = a && a.ok === false
            ? { state: "failed", value: null, refusal: { code: a.code || null, words: cs.esc(a.translation || a.code || "") } }
            : a && a.result ? { state: "ok", value: a.result, refusal: null }
              : { state: "failed", value: null, refusal: { code: null, words: "" } };
          if (ui.opened && ui.opened.id === open) cs.set("opened", { id: open, read });
          return null;
        }
        // R15: the state is the button pressed; the list is read in it at once
        const chosen = el && el.dataset ? el.dataset.state : null;
        ui.state = ["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"].includes(chosen) ? chosen : "offered";
        ui.opened = null;
        return { query: ui.state === "offered" ? {} : { state: ui.state } };
      } },

    // `wizarddraft`: a recording (R3, handed to the guide), a copy (DEC-158), a draft from a proposal or a new draft of an
    // approved version (wizard-scripts R3). The name the member gives is the act's own words (interface-shell R11).
    { op: "wizarddraft", reasonField: "name", rereads: ["list", "updates", "drafts"], refusals: REFUSALS,
      send(view, el, cs) {
        const d = (el && el.dataset) || {};
        const k = String(d.version || d.from || "").replace(/[^A-Za-z0-9_-]/g, "_");
        if (d.mode === "record") {
          const project = cs.value("wz-project");
          if (!project) return { refuse: "screen.wizards.project.none" };
          if (typeof cs.wizard === "function") cs.wizard(null, null, { record: { project } });
          return null;
        }
        if (d.mode === "copy") {
          const project = cs.value("wz-cp-" + k);
          if (!project) return { refuse: "screen.wizards.project.none" };
          // with no name typed (the act no longer asks a reason, op-grades), the copy keeps its original's name
          const name = String(cs.value("wz-cn-" + k) || "").trim() || String(d.name || "");
          return { body: { copy: d.version, project, name } };
        }
        if (d.mode === "from") {
          const typed = d.field ? String(cs.value(d.field) || "").trim() : "";
          return { body: { from: d.from, name: typed || d.name || "" } };
        }
        return null;
      } },

    // `wizardrevise`: reword, reorder or delete a draft's steps (adding one only with the advanced editor), adopt a
    // proposal, or bring the original's change across (`adopt: {base}`) (wizard-scripts R4)
    { op: "wizardrevise", rereads: ["list", "updates", "drafts"], refusals: REFUSALS,
      send(view, el, cs) {
        const d = (el && el.dataset) || {};
        if (d.mode === "base") return { body: { version: d.version, adopt: { base: d.base } } };
        if (d.mode === "adopt") {
          const into = d.field ? cs.value(d.field) : null;
          return into ? { body: { version: into, adopt: d.adopt } } : { refuse: "screen.wizards.draftfor.none" };
        }
        const o = view.ui.opened;
        if (!o || o.id !== d.version || !o.read || o.read.state !== "ok") return null;
        const k = String(d.version).replace(/[^A-Za-z0-9_-]/g, "_");
        const was = (o.read.value.version && o.read.value.version.steps) || [];
        const kept = [];
        was.forEach((st, i) => {
          if (cs.value(`wz-x-${k}-${i}`) === true) return;
          const place = Number(cs.value(`wz-p-${k}-${i}`));
          const step = { screen: st.screen, act: st.act === undefined ? null : st.act,
            what: String(cs.value(`wz-w-${k}-${i}`) ?? st.what ?? ""), why: String(cs.value(`wz-y-${k}-${i}`) ?? st.why ?? "") };
          if (st.draft !== undefined && st.draft !== null) step.draft = st.draft;
          if (st.via !== undefined && st.via !== null) step.via = st.via;
          kept.push({ step, place: Number.isFinite(place) ? place : i + 1, i });
        });
        const screen = String(cs.value(`wz-as-${k}`) || "").trim();
        if (screen) {
          const act = String(cs.value(`wz-aa-${k}`) || "").trim();
          kept.push({ step: { screen, act: act || null, what: String(cs.value(`wz-aw-${k}`) || ""), why: String(cs.value(`wz-ay-${k}`) || "") },
            place: Number.MAX_SAFE_INTEGER, i: was.length });
        }
        if (!kept.length) return { refuse: "screen.wizards.edit.nosteps" };
        kept.sort((a, b) => a.place - b.place || a.i - b.i);
        return { body: { version: d.version, steps: kept.map((x) => x.step) } };
      },
      done(view, answer, cs) { if (view.ui.opened) cs.set("opened", null); } },

    { op: "wizardsubmit", rereads: ["list"], refusals: REFUSALS,
      send(view, el) { return { body: { version: el.dataset.version } }; } },

    // `wizardapprove`: a project owner approves; "make it group-wide" (`widen`) is an administrator's (wizard-scripts R7)
    { op: "wizardapprove", rereads: ["list"], refusals: REFUSALS,
      send(view, el) { return { body: el.dataset.widen ? { version: el.dataset.version, widen: true } : { version: el.dataset.version } }; } },

    // `wizardretire`: a script, by an approver; a draft or submitted version, by its author; with a reason (wizard-scripts R9)
    { op: "wizardretire", reasonField: "reason", rereads: ["list", "updates"],
      send(view, el, cs) {
        const d = el.dataset;
        const reason = String(cs.value(d.field) || "").trim();
        if (!reason) return { refuse: "screen.wizards.reason.needed" };
        return { body: d.version ? { script: d.script, version: d.version, reason } : { script: d.script, reason } };
      } },
  ],
};
