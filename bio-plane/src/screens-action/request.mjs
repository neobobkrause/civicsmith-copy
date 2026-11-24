/* Request records (registry screen `request`; screens-action R4, R7, R8, R10). Projects › <project> › Request records.
   Look first; then, in the flow's order: the office (by its role), what is wanted in plain words, the law it goes under
   (the laws the profile names, each with its window), the text with the period, form and cost limit (R8), approving it,
   and recording the sending with the portal's number. The subject is the project (a new request) or the action (one
   already started), and an action opens at the step it has reached (R10: approved and not sent opens at the send). With no
   office known to hold such records the screen says so and points an administrator to where one is added (R20); on every
   preparation it draws the matter's stake (R21).
   Every function here is self-contained (interface-shell R21 (1)). */
import { languagesOf, marksFields, marksBody, draftsOf, stepOf, sendSteps, draftOf, readFiling, stakeLines, readOnly, officeLine, joinFirst, recordsLawsOf, chosenLawOf, templateOffered, PREPARE, APPROVE, RECORD_SENT, JOIN } from "./send-steps.mjs";

export const request = Object.freeze({
  id: "request",

  // R8 (interface-shell): the path's project step: the subject itself for a new request, else the project the `action` read
  // answers (actions R102), and the project's title from `list`.
  place: function (view) {
    const d = view.data.action;
    const own = d && d.state === "ok" && d.value && typeof d.value.project === "string" ? d.value.project : "";
    const id = own || (/^ACTN-/.test(String(view.subject || "")) ? null : String(view.subject || ""));
    if (!id) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === id; });
    return hit ? { project: { id: id, title: hit.title || id } } : {};
  },

  reads: function (view) {
    const s = String(view.subject || "");
    const r = { projects: { op: "list", query: { type: "project", limit: "500" } } };
    if (/^ACTN-/.test(s)) {
      r.action = { op: "action", query: { id: s }, subject: true };
      r.filings = { op: "filingsfor", query: { action: s }, empty: function () { return false; } };
      r.profiles = { op: "profiles", empty: function () { return false; } };
      // R3 (filings R43, R44): the language the draft is prepared in is the member's, among the team's
      r.mylang = { op: "memberlanguage", empty: function () { return false; } };
      r.languages = { op: "grouplanguages", empty: function () { return false; } };
      // R21: the matter's stake (`filings` R60, R62) and the team's name; the question is `start-send`'s alone
      r.stake = { op: "stakeatpreparation", query: { action: s }, empty: function () { return false; } };
      r.identity = { op: "groupidentity", empty: function () { return false; } };
      // C64-template: whether the kind holds a template decides what the text help says
      r.templates = { op: "templatesforaction", query: { action: s }, empty: function () { return false; } };
      // E9 (K4557): her own place in the action's project (`participation`): an invited member is told at the start, not refused at the end
      r.standing = { op: "projectlist", query: {}, empty: function () { return false; } };
    } else if (s) {
      // R39: `addresseesuggest` resolves an entity or an action's records, never a project: the member says which name the records
      // concern first, from the names the record follows, and the offices are asked after she picks (the act below)
      r.names = { op: "peopledirectory", query: { show: "everything", limit: "200" }, empty: function () { return false; } };
      // R56 (walk E H1): the offices the team has named (`entities` R51, `entitiesOfKind`) are offered again, each as a name the member may pick
      r.teamoffices = { op: "entitieskind", query: { kind: "office", limit: "200" }, empty: function () { return false; } };
      // C64 (DEC-402): the laws an office a member names can go under are the profile's records laws
      r.profiles = { op: "profiles", empty: function () { return false; } };
    }
    return r;
  },

  parts: {
    draftsOf: draftsOf, stepOf: stepOf, sendSteps: sendSteps, draftOf: draftOf, readFiling: readFiling, stakeLines: stakeLines, readOnly: readOnly, officeLine: officeLine, joinFirst: joinFirst,
    chosenLawOf: chosenLawOf, templateOffered: templateOffered, languagesOf: languagesOf, marksFields: marksFields, marksBody: marksBody,
    isRequest: function () { return true; },
    // R20, R39: the offices known: those the member's last "Choose the office" answered, for the name she picked; none are known
    // before she asks (null), and a request opened with no subject at all knows none.
    officesOf: function (view) {
      if (Array.isArray(view.ui.offices)) return view.ui.offices;
      if (!String(view.subject || "")) return [];
      return null;
    },
    // R39: the names the record follows, as `peopledirectory` answers them (`{entity, kind, name}`), each a choice option
    namesOf: function (view) {
      const r = view.data.names;
      const rows = r && r.state === "ok" && r.value && Array.isArray(r.value.rows) ? r.value.rows : [];
      const out = rows.filter(function (x) { return x && typeof x.entity === "string" && typeof x.name === "string" && x.name; })
        .map(function (x) { return { value: x.entity, text: x.name }; });
      // R56 (walk E H1): the team's named offices, each once, by its label
      const o = view.data.teamoffices;
      const offices = o && o.state === "ok" && o.value && Array.isArray(o.value.entities) ? o.value.entities : [];
      offices.forEach(function (x) {
        if (x && typeof x.entity_id === "string" && typeof x.label === "string" && x.label && !out.some(function (y) { return y.value === x.entity_id; })) out.push({ value: x.entity_id, text: x.label });
      });
      return out;
    },
    // R57: the bodies the team holds, each by its name: the rows of the same `peopledirectory` read carry their kind (`{entity, kind, name}`), so the
    // choice of the body that holds an office she names needs no read of its own
    bodiesOf: function (view) {
      const r = view.data.names;
      const rows = r && r.state === "ok" && r.value && Array.isArray(r.value.rows) ? r.value.rows : [];
      return rows.filter(function (x) { return x && x.kind === "body" && typeof x.entity === "string" && typeof x.name === "string" && x.name; })
        .map(function (x) { return { value: x.entity, text: x.name }; });
    },
    // re-walk 10 N3: no body is held only when the directory read was whole: a page that ended at its cap may hold a body beyond it, and the screen says nothing then
    noBody: function (view) {
      const r = view.data.names;
      return !!r && r.state === "ok" && !!r.value && r.value.truncated !== true && view.parts.bodiesOf(view).length === 0;
    },
    // C64, C64-law: the records laws the active profiles name (`jurisdictions` R7), each with its own first-request window (R96)
    recordsLaws: recordsLawsOf,
    // C64: where requests go, as `entities` R63 holds it: `{kind: address|email|portal, value}`, by its form; none when left empty
    contactOf: function (where) {
      const v = String(where || "").trim();
      if (!v) return null;
      if (/^(https?:\/\/|www\.)\S+$/i.test(v)) return { kind: "portal", value: v };
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { kind: "email", value: v };
      return { kind: "address", value: v };
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const s = String(view.subject || "");
    // R29: the door to the composer for any other kind of action, before the office is chosen, in both states
    const other = /^ACTN-/.test(s) ? "" : '<p class="mk-note">' + cs.w("screen.request.other") + '</p><div class="mk-links" data-list="actionnew"><a class="cs-ref" href="/app/actionnew/'
      + encodeURIComponent(String(view.subject || "")) + '" data-nav data-screen="actionnew">' + cs.w("screen.request.other.go") + '</a><span class="mk-small" data-purpose="actionnew">'
      + cs.w("screen.actionnew.name") + " · " + cs.w("screen.actionnew.purpose") + "</span></div>";
    const head = P.readOnly(cs, "screen.request.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.request.lookfirst")
      + ' <a class="cs-ref" href="/app/capture" data-nav>' + cs.w("screen.request.capture") + "</a></p>" + other;
    // C64-law: the help is for the law this action goes under, so its link names the action once there is one
    const help = '<a class="cs-ref" href="/app/help-records' + (/^ACTN-/.test(s) ? "/" + encodeURIComponent(s) : "") + '" data-nav>' + cs.w("screen.help-records.name") + "</a>";
    if (!/^ACTN-/.test(s)) {
      // A new request: which name the records concern (R39), then the office, then what is wanted; starting it opens the request's
      // own address (its step).
      const offices = P.officesOf(view);
      const names = P.namesOf(view);
      const asked = Array.isArray(view.ui.offices);
      const noOffice = function (pointer) {
        // R20: with no office known, the state says so and points an administrator to where one is added; nothing follows it.
        const I = '<svg class="i" aria-hidden="true"><use href="/app/assets/icons.svg#i-group"/></svg>';
        const places = view.me && view.me.administer === true
          ? '<div class="mk-links" data-list="places"><a class="cs-ref" href="/app/places" data-nav data-screen="places">' + I + cs.w("screen.places.name")
            + '</a><span class="mk-small" data-purpose="places">' + cs.w("screen.places.purpose") + "</span></div>" : "";
        // R46: a request that knows no office points to the page where an organization's records lines are kept (`screens-investigate`
        // C68): the name the member picked, where she picked one
        const keeper = pointer ? '<p class="mk-note">' + cs.w("screen.request.nooffice.pointer.a") + " " + cs.w("screen.request.nooffice.pointer.b") + "</p>"
          + '<div class="mk-links" data-list="person"><a class="cs-ref" href="/app/person/' + encodeURIComponent(pointer) + '" data-nav data-screen="person">'
          + cs.w("screen.person.name") + '</a><span class="mk-small" data-purpose="person">' + cs.w("screen.person.purpose") + "</span></div>" : "";
        // C64 (DEC-402): the member may name the office herself: the agency and office, where requests go and the law it goes under
        const pr = view.data.profiles;
        const laws = P.recordsLaws(pr && pr.state === "ok" ? pr.value : null);
        const fold = '<details class="mk-details"><summary>' + cs.w("screen.request.nameoffice.head") + "</summary>"
          + '<p class="mk-note">' + cs.w("screen.request.nameoffice.note") + "</p>"
          + cs.field("req-noff-name", "screen.request.nameoffice.name", { help: "screen.request.nameoffice.name.help" })
          + cs.field("req-noff-role", "screen.request.nameoffice.role", { help: "screen.request.nameoffice.role.help" })
          // R57: the body that holds the office, chosen among the team's bodies (the entity id is what is kept)
          + cs.choice("req-noff-body", "screen.request.office.body", [{ value: "", text: "" }].concat(P.bodiesOf(view)))
          // re-walk 10 N3: a team with no body is told so, in the design's word for nothing held; the door where one is added is the places door below (an administrator's)
          // R59 (DEC-439 N3): a team with no body says so, and where bodies are listed
          + (P.noBody(view) ? '<p class="cs-state" data-state="empty" data-nobody="1">' + cs.w("screen.request.office.nobody") + "</p>" : "")
          // R57: from when to when the body has held it (the person screen's own two days): an office with no day stated is registered but placed on no day
          + cs.field("req-noff-since", "screen.person.keeper.from.label", { type: "date" }) + cs.field("req-noff-until", "screen.person.keeper.to.label", { type: "date" })
          + '<p class="mk-small">' + cs.w("screen.person.keeper.dates.note.a") + " " + cs.w("screen.person.keeper.dates.note.b") + "</p>"
          + (view.ui.bodyrefused ? '<p class="mk-note" role="status">' + view.ui.bodyrefused + "</p>" : "")
          // R59 (DEC-439 R57): an office with no day stated is recorded, and offered as an addressee only once both are stated
          + (view.ui.undated === true ? '<p class="mk-note" role="status" data-undated="1">' + cs.w("screen.request.office.undated") + "</p>" : "")
          + cs.field("req-noff-where", "screen.request.nameoffice.where", { help: "screen.request.nameoffice.where.help" })
          // the note `entities` R1 requires, in her own words (DEC-412)
          + cs.field("req-noff-note", "screen.request.nameoffice.why", { area: true, rec: true, help: "screen.request.nameoffice.why.help" })
          + (laws.length ? cs.choice("req-noff-law", "screen.request.nameoffice.law", laws.map(function (l, i) {
            return { value: String(i), text: [l.name, l.citation].filter(Boolean).join(" · ") };
          })) + '<p class="mk-note">' + cs.w("screen.request.nameoffice.law.help") + "</p>" : "")
          + '<div class="mk-acts">' + cs.act("entitycreate", { label: "act.entitycreate.label.request" }) + "</div>"
          + '<p class="mk-note">' + cs.w("screen.request.nameoffice.use.help") + "</p></details>";
        return '<p class="mk-note" role="status">' + cs.w("screen.request.nooffice") + "</p>"
          + '<p class="mk-note">' + cs.w("screen.request.nooffice.admin") + "</p>" + fold + keeper + places;
      };
      // a request opened with no subject at all, or a record that follows no name, cannot ask: it says no office is known
      if (offices !== null && !offices.length && !asked) return head + noOffice("");
      if (view.data.names && view.data.names.state !== "ok" && view.data.names.state !== "empty") return head + cs.state("names");
      if (view.data.teamoffices && view.data.teamoffices.state !== "ok" && view.data.teamoffices.state !== "empty") return head + cs.state("teamoffices");
      if (!names.length && !asked) return head + noOffice("");
      const subjectPick = cs.choice("req-subject", "screen.request.subject.label", [{ value: "", text: "" }].concat(names), { value: String(view.ui.subject || "") })
        + '<p class="mk-note">' + cs.w("screen.request.subject.help") + "</p>"
        + '<div class="mk-acts">' + cs.act("addresseesuggest", {}) + "</div>";
      // C64: an office she named herself is the one chosen: no name to ask about, and it is drawn marked until an administrator confirms it
      const named = view.ui.named === true && offices !== null && offices.length > 0;
      const askStep = named ? "" : cs.sec("screen.request.step.office", subjectPick);
      if (offices === null) return head + askStep;
      if (!offices.length) return head + askStep + noOffice(String(view.ui.subject || ""));
      const pick = cs.choice("req-office", "screen.request.office", offices.map(function (o, i) {
        const a = o.addressee || {};
        return { value: String(i), text: P.officeLine(a) };
      }), { value: String(view.ui.office || 0) }) + '<p class="mk-note">' + cs.w("screen.request.office.help") + "</p>"
        + (named ? '<p class="mk-small" data-named="1">' + cs.w("screen.request.nameoffice.mark") + "</p>" : "");
      // "Start the request" is drawn once an office is chosen
      const what = view.ui.chosen === true ? cs.sec("screen.request.step.what", cs.field("req-what", "screen.request.what", { help: "screen.request.what.help" })
        + '<div class="mk-acts">' + cs.act("actioncreate", { tone: "primary" }) + "</div>") : "";
      return head + askStep + cs.sec("screen.request.step.office", pick) + what + '<p class="mk-note">' + help + "</p>";
    }
    return head + cs.state("action", function (a) {
      const office = a.addressee ? cs.esc(P.officeLine(a.addressee))
        + (a.addressee.holder_on_date && a.addressee.holder_on_date.holder ? " · " + cs.w("screen.request.holder", { holder: a.addressee.holder_on_date.holder }) : "") : "";
      const sub = '<p class="mk-sub">' + office + "</p>";
      // the laws a member stated, as `action` answers them (`actions` R25: `{state, laws, by, at}`)
      const laws = a.governing_laws && Array.isArray(a.governing_laws.laws) ? a.governing_laws.laws : [];
      const pr = view.data.profiles;
      // C64-law (`jurisdictions` R96): the picker lists the profile's records laws, each with the window its own `response` names (never a
      // guessed one, and never the profile's deadlines); the law carries its own level, asked only for one that states none
      const offered = P.recordsLaws(pr && pr.state === "ok" ? pr.value : null);
      const picker = offered.length
        ? cs.choice("req-law", "screen.request.law", offered.map(function (d, i) {
          return d.amount ? { value: String(i), key: "screen.request.law.option", fills: { citation: d.citation,
            window: { html: cs.w("screen.request.window." + (d.count === "business" ? "business" : "calendar"), { n: String(d.amount) }) } } }
            : { value: String(i), text: d.citation };
        }))
          + (offered.some(function (d) { return !d.level; }) ? cs.choice("req-level", "screen.request.level", ["state", "city", "county", "federal"].map(function (k) { return [k, "screen.request.level." + k]; })) : "")
          + '<div class="mk-acts">' + cs.act("actionlaws", {}) + "</div>" : "";
      const lawSec = cs.sec("screen.request.step.law", (laws.length
        ? cs.sheet(laws.map(function (l) { return cs.row("", cs.esc(l.citation || ""), "", ""); }).join("")) : "")
        + (pr && pr.state === "ok" ? picker : cs.state("profiles"))
        + '<p class="mk-note">' + help + "</p>");
      const send = cs.sec("screen.request.step.text", cs.state("filings", function (f) { return P.sendSteps(cs, view, f, { request: true }); }));
      return sub + lawSec + send;
    });
  },

  acts: [
    {
      // R4: the offices that hold such records, each by its role; a suggestion, chosen by the member.
      op: "addresseesuggest",
      // R39: the subject is the name the member picked, never the project (the plane resolves an entity or an action's records)
      send: function (view, el, cs) {
        const subject = String(cs.value("req-subject") || "");
        // R56 (walk E H1): an empty press is refused in the words of a field left empty, never silent
        if (!subject) return { refuse: "findin.fieldneeded", fills: { field: { html: cs.w("screen.request.subject.label") } } };
        view.ui.subject = subject;
        view.ui.pick = Number(cs.value("req-office")) || 0;
        return { query: { subject: subject } };
      },
      rereads: [],
      // "Choose the office": the offices the record holds for that name, each by its role and who holds it today; what is wanted is
      // asked once there are offices to choose among.
      done: function (view, answer, cs) {
        const offices = answer && Array.isArray(answer.offices) ? answer.offices : [];
        cs.set("offices", offices);
        cs.set("office", 0);
        cs.set("chosen", offices.length > 0);
      },
    },
    {
      // C64 (DEC-402, DEC-412; `entities` R63, R65): "Use this office": the office she names herself, saved for the team marked as named by a
      // member and chosen for this request; her words on why it belongs are the act's reason (`note`). The agency and the office within it are
      // two fields, the agency the addressee's body and the office its role (the agency's name for both when she names no office within it);
      // the entity is labelled by both, and naming the same office again answers the first entry (`existed`), which is chosen.
      op: "entitycreate",
      reasonField: "note",
      send: function (view, el, cs) {
        const agency = String(cs.value("req-noff-name") || "").trim();
        if (!agency) return { refuse: "findin.fieldneeded", fills: { field: { html: cs.w("screen.request.nameoffice.name") } } };
        const within = String(cs.value("req-noff-role") || "").trim();
        const role = within || agency;
        // R57: an office is recorded with the body that holds it; none chosen is refused naming the field
        const holder = String(cs.value("req-noff-body") || "").trim();
        if (!holder) return { refuse: "findin.fieldneeded", fills: { field: { html: cs.w("screen.request.office.body") } } };
        // what she typed, for `done`: the answer's label is the entity's, which a first naming may have written another way
        view.ui.officeForm = { agency: agency, role: role, holder: holder, note: String(cs.value("req-noff-note") || "").trim(),
          since: String(cs.value("req-noff-since") || "").trim() || null, until: String(cs.value("req-noff-until") || "").trim() || null };
        const label = within && within.toLowerCase() !== agency.toLowerCase() ? agency + ", " + within : agency;
        const body = { kind: "office", label: label, note: String(cs.value("req-noff-note") || "").trim() };
        const contact = view.parts.contactOf(cs.value("req-noff-where"));
        if (contact) body.contact = contact;
        const pr = view.data.profiles;
        const laws = view.parts.recordsLaws(pr && pr.state === "ok" ? pr.value : null);
        const law = laws[Number(cs.value("req-noff-law"))];
        if (law) body.law = law.citation;
        return { body: body };
      },
      rereads: [],
      // R57: the office is recorded with its body (a `post_in` line from the office to the body, on her word: her note, between the days she states: a bound left empty is unstated and places the office on no day), unless the record
      // already holds one for it; then what `actions` answers for the office (R111) is what is offered, so it can be chosen in this visit
      done: async function (view, answer, cs) {
        const r = answer && answer.result !== undefined ? answer.result : answer;
        const f = view.ui.officeForm;
        if (!r || typeof r.entity_id !== "string" || !f) return;
        const plain = function (a) { return a && a.result !== undefined ? a.result : a; };
        const held = plain(await cs.call("linesof", { query: { entity: r.entity_id, kinds: "post_in", direction: "from", limit: "20" } }).then(function (x) { return x; }, function () { return null; }));
        const lines = held && Array.isArray(held.lines) ? held.lines.filter(function (l) { return l && !l.withdrawn; }) : null;
        if (lines && !lines.length) {
          const made = plain(await cs.call("recordline", { body: { kind: "post_in", from: r.entity_id, to: f.holder, basis: { statement: f.note || f.agency }, valid: { from: f.since, to: f.until, precision: "day", zone: "UTC" } } }).then(function (x) { return x; }, function () { return null; }));
          if (!made || made.ok === false) {
            cs.set("bodyrefused", cs.esc(String((made && (made.translation || made.code)) || "")));
            return;
          }
        }
        cs.set("bodyrefused", "");
        const asked = plain(await cs.call("addresseesuggest", { query: { subject: r.entity_id } }).then(function (x) { return x; }, function () { return null; }));
        const named = asked && Array.isArray(asked.offices) ? asked.offices.filter(function (o) { return o && o.addressee && o.addressee.entity_id === r.entity_id; }) : [];
        // the owner's answer decides: an office it cannot place on a day (a bound unstated) is registered but not offered, and the screen says why
        cs.set("undated", !named.length);
        if (!named.length) return;
        cs.set("offices", named);
        cs.set("office", 0);
        cs.set("chosen", true);
        cs.set("named", true);
      },
    },
    {
      // R4: "Start the request": what is wanted, in plain words, to the office chosen, under the project.
      op: "actioncreate",
      send: function (view, el, cs) {
        const what = String(cs.value("req-what") || "").trim();
        if (!what) return { refuse: "screen.request.what.needed" };
        const offices = Array.isArray(view.ui.offices) ? view.ui.offices : [];
        const chosen = offices[Number(cs.value("req-office"))];
        if (!chosen || !chosen.addressee) return { refuse: "screen.request.office.needed" };
        const q = function (v) { return JSON.stringify(String(v)); };
        const at = new Date(cs.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
        const ad = chosen.addressee;
        const lines = ["---", "id: PENDING", "object_type: action", "title: " + q(what.replace(/[\r\n]+/g, " ")), "current_state: planned",
          'created: "' + at + '"', 'last_updated: "' + at + '"', "project: " + view.subject, 'action_kind: "records_request"', "counterparty:"]
          .concat(Object.keys(ad).filter(function (k) { return ad[k] !== null && ad[k] !== undefined; }).map(function (k) { return "  " + k + ": " + q(ad[k]); }))
          .concat(["clock: []", "action_basis: []", "correspondence: []", "---", "", "## Action", "", what, ""]);
        return { body: { document: lines.join("\n") } };
      },
      done: function (view, answer, cs) { if (answer && answer.id) cs.go("request", answer.id); return { stay: true }; },
    },
    {
      // R4: the law it goes under, from the profile's laws for a records request.
      op: "actionlaws",
      send: function (view, el, cs) {
        const pr = view.data.profiles;
        const offered = view.parts.recordsLaws(pr && pr.state === "ok" ? pr.value : null);
        const d = offered[Number(cs.value("req-law"))];
        if (!d) return null;
        return { body: { target: view.subject, laws: [{ level: d.level || cs.value("req-level") || "state", citation: d.citation }] } };
      },
      rereads: ["action"],
    },
    Object.assign({}, PREPARE, { rereads: ["filings"] }),
    Object.assign({}, APPROVE, { rereads: ["filings"] }),
    Object.assign({}, RECORD_SENT, { rereads: ["filings", "action"] }),
    JOIN,
  ],
});
