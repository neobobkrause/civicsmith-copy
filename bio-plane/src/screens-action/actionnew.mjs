/* Start an action (registry screen `actionnew`; screens-action R24, R28, R35; DEC-330 A68; DEC-335, DEC-336 (9)). Projects ›
   <project> › Start an action: the composer for an action of any kind. The kind is chosen from the vocabulary
   (`affordances`' `action_kind`, each worded twice, R28); a records request has its own steps and is composed on `request`, so
   choosing it draws the door and no composer. Every other kind is composed here: who it goes to (a named office or public
   body, or not determined yet with what is known), what it asks, how carefully to act (the member's own judgment of the
   tier), what it rests on or advances (picked from the project's questions, never typed) and when things are due, each
   date with where it comes from. "Start the action" sends `actioncreate` with the action's document composed as `request`
   composes its own, and the action opens. The subject is the project. It holds no member-facing English (R19). Every
   function here is self-contained (interface-shell R21 (1)). */
import { readOnly, kindWord, kindsOf, officeLine, WRITE_HELP } from "./send-steps.mjs";

export const actionNew = Object.freeze({
  id: "actionnew",

  place: function (view) {
    const id = String(view.subject || "");
    if (!id) return {};
    const l = view.data.projects;
    const rows = l && l.state === "ok" && l.value && Array.isArray(l.value.bundles) ? l.value.bundles : [];
    const hit = rows.find(function (b) { return b.bundle_id === id; });
    return hit ? { project: { id: id, title: hit.title || id } } : {};
  },

  reads: function (view) {
    return {
      // R24: the project's questions are record data, the legs' targets; `subject: true` so a bare screen says "Nothing is here"
      questions: { op: "projectquestions", query: { project: view.subject, limit: "200" }, subject: true, empty: function () { return false; } },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      vocab: { op: "affordances", query: {}, empty: function () { return false; } },
    };
  },

  parts: {
    readOnly: readOnly, kindWord: kindWord, kindsOf: kindsOf, officeLine: officeLine,
    // R24: the offices a suggestion answered, else none
    officesOf: function (view) { return Array.isArray(view.ui.offices) ? view.ui.offices : []; },
    // R24: a leg's two ways of linking, each worded by its key where the design holds one
    legKinds: function (cs, view) {
      const v = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      const KEY = { rests_on: "screen.start-send.rests", advances: "screen.actionnew.rests.advances" };
      return (Array.isArray(v.action_basis_kinds) ? v.action_basis_kinds : []).filter(function (k) { return KEY[k] && cs.w(KEY[k]) !== cs.esc(KEY[k]); })
        .map(function (k) { return [k, KEY[k]]; });
    },
    // R24: the tiers the vocabulary names (1 to 3), the member's own judgment, in the words of R17
    tiers: function (view) {
      const v = view.data.vocab && view.data.vocab.state === "ok" && view.data.vocab.value && view.data.vocab.value.vocabularies ? view.data.vocab.value.vocabularies : {};
      const t = v.risk_tiers && typeof v.risk_tiers === "object" ? v.risk_tiers : {};
      return ["1", "2", "3"].filter(function (k) { return Object.hasOwn(t, k); });
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const project = String(view.subject || "");
    const questions = view.data.questions && view.data.questions.state === "ok" && view.data.questions.value && Array.isArray(view.data.questions.value.items)
      ? view.data.questions.value.items : [];
    const head = P.readOnly(cs, "screen.actionnew.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.actionnew.sub") + "</p>";
    return cs.state("vocab", function () {
      // R28: the kinds are the vocabulary's; the drawing's last, "Another kind", is `other`'s words here
      const kinds = P.kindsOf(cs, view, false).map(function (o) { return o.value === "other" ? { value: "other", key: "screen.actionnew.kind.other" } : o; });
      if (!kinds.length) return head + '<p class="cs-state" data-state="empty">' + cs.w("state.empty") + "</p>";
      const pick = kinds.find(function (o) { return o.value === "request_for_comment"; }) || kinds[0];
      const kindChoice = cs.choice("an-kind", "screen.actionnew.kind", kinds, { acts: {}, value: pick.value });
      const kind = view.ui["choice:an-kind"] || pick.value;
      const door = '<p class="mk-note">' + cs.w("screen.actionnew.records") + '</p><div class="mk-links" data-list="request"><a class="cs-ref" href="/app/request/'
        + encodeURIComponent(project) + '" data-nav data-screen="request">' + cs.w("screen.request.name") + '</a><span class="mk-small" data-purpose="request">'
        + cs.w("screen.request.purpose") + "</span></div>";
      const templates = '<p class="mk-note">' + cs.w("screen.actionnew.templates.after") + " " + cs.w("screen.actionnew.templates.none") + "</p>";
      const intro = head + kindChoice + '<p class="mk-small">' + cs.w("screen.actionnew.kind.help") + "</p>" + door;
      if (kind === "records_request") return intro + templates;

      // who it goes to
      const to = cs.choice("an-to", "screen.actionnew.to", [["named", "screen.actionnew.to.named"], ["undetermined", "screen.actionnew.to.undetermined.label"]], { acts: {}, value: "named" });
      const named = (view.ui["choice:an-to"] || "named") === "named";
      const leg = view.ui["choice:an-leg"] || "";
      const offices = P.officesOf(view);
      const suggest = leg ? cs.act("addresseesuggest", { data: { subject: leg } }) : "";
      const officeChoice = offices.length ? cs.choice("an-office", "screen.actionnew.to.who", [{ value: "", text: "" }].concat(offices.map(function (o, i) {
        const a = o.addressee || {};
        return { value: String(i), text: P.officeLine(a) };
      }))) : "";
      const whoSec = cs.sec("screen.actionnew.to", to + (named
        ? cs.field("an-who", "screen.actionnew.to.who") + officeChoice + (suggest ? '<div class="mk-acts">' + suggest + "</div>" : "")
        : '<p class="mk-small">' + cs.w("screen.actionnew.to.undetermined") + "</p>" + cs.field("an-basis", "screen.actionnew.to.basis", { area: true })
          + '<p class="mk-note">' + cs.w("screen.actionnew.to.unsent") + "</p>"));

      // what it asks
      const helpAsk = view.reachable ? cs.act("writinghelp", { data: { field: "title", id: "an-ask", forop: "actioncreate" } }) : "";
      const asksSec = cs.sec("screen.actionnew.asks", cs.field("an-ask", "screen.actionnew.asks", { rec: true, max: 200 }) + (helpAsk ? '<div class="mk-acts">' + helpAsk + "</div>" : ""));

      // how carefully to act: the tier is the member's own judgment; none is preselected
      const tiers = P.tiers(view);
      const careSec = tiers.length ? cs.sec("screen.actionnew.care", cs.choice("an-tier", "screen.actionnew.care.field",
        [["", "risk.tier.undetermined"]].concat(tiers.map(function (t) { return [t, "risk.tier." + t]; })))
        + '<p class="mk-small">' + cs.w("screen.actionnew.care.help") + "</p>") : "";

      // what it rests on: a question of the project picked, never typed, and what the link does
      const legKinds = P.legKinds(cs, view);
      const legOptions = [{ value: "", text: "" }].concat(questions.map(function (q, i) {
        return typeof q.title === "string" && q.title ? { value: q.inquiry, text: q.title } : { value: q.inquiry, key: "screen.plan.matter.n", fills: { n: String(i + 1) } };
      }));
      const restsSec = questions.length && legKinds.length ? cs.sec("screen.actionnew.rests", cs.choice("an-leg", "screen.actionnew.rests.point", legOptions, { acts: {}, value: "" })
        + cs.choice("an-legk", "screen.actionnew.rests.does", legKinds, kind === "request_for_comment" && legKinds.some(function (k) { return k[0] === "advances"; }) ? { value: "advances" } : {}) + '<p class="mk-note">' + cs.w("screen.actionnew.rests.needed") + "</p>") : "";

      // when things are due: each date says where it comes from
      const dueSec = cs.sec("screen.actionnew.due", cs.field("an-due-text", "screen.actionnew.due.what") + cs.field("an-due-date", "screen.actionnew.due.when", { type: "date" })
        + cs.field("an-due-because", "screen.actionnew.due.because") + '<p class="mk-note">' + cs.w("screen.actionnew.due.note") + "</p>");

      return intro + whoSec + asksSec + careSec + restsSec + dueSec + templates + '<div class="mk-acts">' + cs.act("actioncreate", { tone: "primary" }) + "</div>";
    });
  },

  acts: [
    {
      // R24: "Choose the office": the offices the record holds for what the action rests on, each by its role and who holds it
      // today; a suggestion, it sets nothing.
      op: "addresseesuggest",
      send: function (view, el) { return { query: { subject: el.dataset.subject } }; },
      rereads: [],
      done: function (view, answer, cs) { cs.set("offices", answer && Array.isArray(answer.offices) ? answer.offices : []); },
    },
    {
      // R24: "Start the action": the document composed as `request` composes its own, the author set by the door and never the body.
      op: "actioncreate",
      send: function (view, el, cs) {
        const kind = String(cs.value("an-kind") || "");
        if (!kind || kind === "records_request") return null;
        const q = function (v) { return JSON.stringify(String(v)); };
        const line = function (v) { return String(v || "").replace(/[\r\n]+/g, " ").trim(); };
        const title = line(cs.value("an-ask"));
        // who it goes to: an office the member chose from the suggestions, else what she wrote as a described audience; or not
        // yet determined, with what is known
        const named = (view.ui["choice:an-to"] || "named") === "named";
        let cp;
        if (named) {
          const offices = Array.isArray(view.ui.offices) ? view.ui.offices : [];
          const chosen = cs.value("an-office") !== "" && cs.value("an-office") !== null ? offices[Number(cs.value("an-office"))] : null;
          const who = line(cs.value("an-who"));
          if (chosen && chosen.addressee) {
            const ad = chosen.addressee;
            cp = Object.keys(ad).filter(function (k) { return ad[k] !== null && ad[k] !== undefined; }).map(function (k) { return "  " + k + ": " + q(ad[k]); });
          } else if (who) cp = ["  state: \"audience\"", "  description: " + q(who.slice(0, 500))];
          else return { refuse: "refusal.COUNTERPARTY_REFUSED" };
        } else {
          const basis = line(cs.value("an-basis"));
          if (!basis) return { refuse: "refusal.COUNTERPARTY_REFUSED" };
          cp = ["  state: \"undetermined\"", "  basis: " + q(basis)];
        }
        // what it rests on
        const target = String(cs.value("an-leg") || "");
        const legs = target ? ["  - target: " + q(target), "    kind: " + q(cs.value("an-legk") || "rests_on")] : [];
        // when things are due: a date with no basis is a deadline the record invented
        const dtext = line(cs.value("an-due-text")), ddate = String(cs.value("an-due-date") || "").trim(), dbasis = line(cs.value("an-due-because"));
        const dated = dtext || ddate || dbasis;
        if (dated && (!dtext || !/^\d{4}-\d{2}-\d{2}$/.test(ddate) || !dbasis)) return { refuse: "refusal.CLOCK_REFUSED" };
        // R56 (walk E K-new): no local pre-check of a request for comment's basis; the plane's refusal and its findings are drawn (`refusals` below)
        const clock = dated ? ["  - text: " + q(dtext), "    description: " + q(dtext), "    date: " + ddate, "    basis: " + q(dbasis), "    status: pending"] : [];
        const tier = String(cs.value("an-tier") || "");
        const at = new Date(cs.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
        const lines = ["---", "id: PENDING", "object_type: action"].concat(title ? ["title: " + q(title)] : [])
          .concat(["current_state: planned", 'created: "' + at + '"', 'last_updated: "' + at + '"', "project: " + view.subject, "action_kind: " + q(kind)])
          .concat(["1", "2", "3"].includes(tier) ? ["risk_tier: " + tier] : [])
          .concat(["counterparty:"], cp, clock.length ? ["clock:"].concat(clock) : ["clock: []"], legs.length ? ["action_basis:"].concat(legs) : ["action_basis: []"],
            ["correspondence: []", "---", "", "## Action", "", title, ""]);
        return { body: { document: lines.join("\n") } };
      },
      done: function (view, answer, cs) { if (answer && answer.id) cs.go("action", answer.id); return { stay: true }; },
      // L20 (K4195): a refusal that carries `findings[]` draws each finding's own `detail` after the code's sentence ("an action cannot
      // rest on another action" was drawn for a target that was not a canonical id); one with none draws the code's sentence alone.
      refusals: { ACTION_KIND_UNKNOWN: "refusal.ACTION_KIND_UNKNOWN", COUNTERPARTY_REFUSED: "refusal.COUNTERPARTY_REFUSED", CLOCK_REFUSED: "refusal.CLOCK_REFUSED",
        ACTION_BASIS_REFUSED: function (refusal, cs) {
          const found = refusal && Array.isArray(refusal.findings) ? refusal.findings : [];
          const lines = found.map(function (f) { return f && typeof f.detail === "string" && f.detail.trim() ? "<li>" + cs.esc(f.detail.trim()) + "</li>" : ""; }).join("");
          // re-walk 10 N7: the code's sentence ends "Choose again, or leave it out", which is wrong when the owner's reason is that the action must name something;
          // with the owner's own reasons to draw, they are the answer (the owner's `detail` is the member's sentence), and the code's sentence stays for a refusal with none
          // R59 (DEC-439 N7): the owner's reasons are drawn under the head that says nothing was written
          if (lines) return '<p class="mk-note">' + cs.w("screen.action.basis.refused.head") + '</p><ul class="mk-list" data-findings="refusal">' + lines + "</ul>";
          return cs.w("refusal.ACTION_BASIS_REFUSED");
        } },
    },
    WRITE_HELP,
  ],
});
