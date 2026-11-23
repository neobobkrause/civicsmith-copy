/* Brief counsel (registry screen `counsel`; screens-action R34; DEC-340, U366; K3935; `filings` R8, R9, R10). Projects ›
   <project> › Action › Brief counsel: a packet for the team's lawyer about one action, for a claim or for a defense, with the
   member's reason. It names counsel (required at tier 3 or when the tier is undetermined, optional at 1 or 2), draws each
   matter as the packet states it ("not determined" never stops the packet), adds for a defense the challenged statements, the
   pressure received and the defense deadlines, and marks every section "Prepared for review by …. Not legal advice. Not for
   filing." The packet is never offered for publication. The versions assembled for the action are listed from `filingsfor`
   (filings R13), newest first, each read again exactly as it was made (`counselpacketread`) or saved as a file the record
   keeps (`counselpacketexport`, filings R11). The subject is the action. It holds no member-facing English (R19).
   Every function here is self-contained (interface-shell R21 (1)). */
import { readOnly } from "./send-steps.mjs";

/** @import { ScreenDef } from "./send-steps.mjs" */

/** Brief counsel (R34): the packet for the team's lawyer; `counselpacket`; the versions assembled (`filingsfor`), each read
 *  (`counselpacketread`) or saved as a file (`counselpacketexport`).
 *  @type {Readonly<ScreenDef>} */
export const counsel = Object.freeze({
  id: "counsel",

  place: function (view) {
    const rows = view.data.projects && view.data.projects.state === "ok" && view.data.projects.value && Array.isArray(view.data.projects.value.bundles)
      ? view.data.projects.value.bundles : [];
    const id = view.data.action && view.data.action.state === "ok" && view.data.action.value ? view.data.action.value.project : null;
    const hit = id ? rows.find(function (b) { return b.bundle_id === id; }) : null;
    return hit ? { project: { id: id, title: hit.title || id } } : {};
  },

  reads: function (view) {
    return {
      action: { op: "action", query: { id: view.subject }, subject: true },
      projects: { op: "list", query: { type: "project", limit: "500" } },
      // the packets assembled for this action, each version with who assembled it and each time it was saved as a file (filings R13)
      filings: { op: "filingsfor", query: { action: view.subject }, empty: function () { return false; } },
    };
  },

  parts: {
    readOnly: readOnly,
    // R34: counsel is required at tier 3 or undetermined, optional at 1 or 2
    required: function (a) { return !(Number(a.risk_tier) === 1 || Number(a.risk_tier) === 2); },
    // the matters as the packet states them: each fact with whether a determination holds it
    // the packet versions `filingsfor` lists for the action, newest first
    versionsOf: function (f) {
      const list = f && Array.isArray(f.packets) ? f.packets.filter(function (p) { return p && typeof p.packet === "string" && p.packet; }) : [];
      return list.slice().sort(function (a, b) {
        const at = String(b.at || "").localeCompare(String(a.at || ""));
        return at !== 0 ? at : Number(b.version || 0) - Number(a.version || 0);
      });
    },
    // the counsel a version names, as `{name, organisation}`; null where it names none
    counselOf: function (p) {
      const c = p && p.counsel && typeof p.counsel === "object" ? p.counsel : null;
      return c && typeof c.name === "string" && c.name.trim() ? { name: c.name.trim(), organisation: typeof c.organisation === "string" ? c.organisation.trim() : "" } : null;
    },
    mattersOf: function (packet) {
      const s = packet && packet.sections && packet.sections.facts ? packet.sections.facts : null;
      return s && Array.isArray(s.items) ? s.items : [];
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const head = P.readOnly(cs, "screen.counsel.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.counsel.sub") + "</p>";
    const twoHelp = function (k) { return '<p class="mk-small">' + cs.w(k) + "</p>"; };
    // C8 (filings R11, R13): the versions assembled for this action, newest first, each with who assembled it, when and for whom, the
    // reason, whether the record changed since, and each time it was saved as a file; each can be read again exactly as it was made,
    // or saved as a file the record keeps (who, which version, when, for which counsel). A version read is drawn in its place, its
    // sections in a fold; a version saved is handed to the browser by the kit's save control.
    const made = cs.state("filings", function (f) {
      const shown = view.ui.shown || null, saved = view.ui.saved || null;
      const nameOf = function (who) { return cs.memberName(String(who || "").replace(/^member:/, "")); };
      const blocks = P.versionsOf(f).map(function (p) {
        const c = P.counselOf(p);
        const here = function (x) { return x && x.packet === p.packet && Number(x.version) === Number(p.version); };
        const label = cs.esc(p.packet) + " · " + cs.esc(String(p.version));
        // the made line names counsel; a version assembled with none named is drawn by who and when alone, as data
        const by = c ? cs.w(c.organisation ? "screen.counsel.made.by" : "screen.counsel.made.by.noorg", { who: nameOf(p.assembled_by), date: { html: cs.date(p.at) }, counsel: c.name, organization: c.organisation })
          : cs.esc(nameOf(p.assembled_by)) + " · " + cs.date(p.at);
        const reason = typeof p.reason === "string" && p.reason.trim() ? '<p class="mk-small"><span class="rec">“' + cs.esc(p.reason.trim()) + "”</span></p>" : "";
        // what changed since, in the words the record has for it (a superseded determination)
        const causes = p.basis_changed && Array.isArray(p.basis_changed.causes) ? p.basis_changed.causes : [];
        const said = causes.filter(function (x) { return x && x.cause === "determination_superseded" && typeof x.determination === "string"; })
          .map(function (x) { return cs.w("filings.determination_superseded", { determination: x.determination, then: "" }); });
        const changed = said.length ? '<p class="mk-note" data-changed>' + cs.w("screen.counsel.made.changed", { n: String(p.version), what: { html: said.join("; ") } }) + "</p>" : "";
        const exported = (Array.isArray(p.exports) ? p.exports : []).map(function (e) {
          const ec = P.counselOf(e);
          return '<p class="mk-small" data-exported>' + (ec ? cs.w("screen.counsel.made.exported", { who: nameOf(e.exported_by), date: { html: cs.date(e.at) }, counsel: ec.name })
            : cs.esc(nameOf(e.exported_by)) + " · " + cs.date(e.at)) + "</p>";
        }).join("");
        const data = { packet: p.packet, version: String(p.version) };
        const acts = '<div class="mk-acts">' + cs.act("counselpacketread", { data: data }) + cs.act("counselpacketexport", { data: data }) + "</div>";
        // the version as it was made: each section by its own title and marking, as the record states them
        const read = here(shown) && shown.answer ? '<details class="mk-details" open data-read><summary>' + label + "</summary>"
          + Object.keys(shown.answer.sections || {}).map(function (k) {
            const s = shown.answer.sections[k] || {};
            return '<div class="cs-sheet" data-section="' + cs.esc(k) + '"><b class="mk-small">' + cs.esc(s.title || k) + "</b>"
              + (s.marking ? '<p class="mk-small">' + cs.esc(s.marking) + "</p>" : "") + (typeof s.says === "string" && s.says ? '<p class="mk-small">' + cs.esc(s.says) + "</p>" : "")
              + (typeof s.text === "string" && s.text ? '<p class="mk-data">' + cs.esc(s.text) + "</p>" : "") + "</div>";
          }).join("")
          + '<p class="mk-note">' + (c ? cs.w("screen.counsel.sections.marking", { counsel: c.organisation ? c.name + ", " + c.organisation : c.name })
            : cs.esc(typeof shown.answer.marking === "string" ? shown.answer.marking : "")) + "</p></details>" : "";
        const file = here(saved) && typeof saved.text === "string" ? '<div class="mk-acts" role="status" data-saved>' + cs.save(saved.name, saved.text) + "</div>" : "";
        return '<div class="cs-sheet" data-packet-version="' + cs.esc(p.packet + "~" + p.version) + '"><p class="mk-data">' + label + "</p><p class=\"mk-small\">" + by + "</p>"
          + reason + changed + exported + acts + read + file + "</div>";
      }).join("");
      return cs.sec("screen.counsel.made.head", '<p class="mk-small">' + cs.w("screen.counsel.made.lead") + "</p>" + blocks + '<p class="mk-note">' + cs.w("screen.counsel.export.note") + "</p>");
    });
    return head + cs.state("action", function (a) {
      const purpose = view.ui["choice:cp-purpose"] || "claim";
      const defence = purpose === "defence";
      const who = cs.sec("screen.counsel.who.heading", cs.field("cp-name", "screen.counsel.who.name") + cs.field("cp-org", "screen.counsel.who.org")
        + '<p class="mk-note">' + (P.required(a) ? cs.w("screen.counsel.who.required") : cs.w("screen.counsel.who.optional")) + "</p>"
        + cs.choice("cp-purpose", "screen.counsel.purpose.label", [["claim", "screen.counsel.purpose.claim"], ["defence", "screen.counsel.purpose.defense"]], { acts: {}, value: "claim" })
        + twoHelp("screen.counsel.purpose.help1") + twoHelp("screen.counsel.purpose.help2")
        + cs.field("cp-reason", "screen.counsel.reason.label", { rec: true, area: true, max: 2000, help: "screen.counsel.reason.help1" }) + twoHelp("screen.counsel.reason.help2"));
      // a defense names the statements it must answer, as the member made them and where
      const stmts = defence ? cs.sec("screen.counsel.chal.heading", '<p class="mk-small">' + cs.w("screen.counsel.chal.says") + "</p>"
        + cs.field("cp-chal-1", "screen.counsel.chal.text.label", { help: "screen.counsel.chal.text.help1" })) : "";
      const pk = view.ui.packet || null;
      const matters = P.mattersOf(pk);
      const mattersSec = cs.sec("screen.counsel.matters.heading", '<p class="mk-small">' + cs.w("screen.counsel.matters.each") + " " + cs.w("screen.counsel.matters.determined") + " "
        + cs.w("screen.counsel.matters.undetermined") + " " + cs.w("screen.counsel.matters.nothing") + "</p>"
        + (matters.length ? cs.sheet(matters.map(function (m) {
          const said = m.claim && (m.claim.conclusion || m.claim.question) ? m.claim.conclusion || m.claim.question : m.finding || "";
          return cs.row("", cs.esc(said) + '<span class="meta">' + (m.determined === false ? cs.w("screen.counsel.matters.undetermined") : cs.w("screen.counsel.matters.determined")) + "</span>", "", "");
        }).join("")) : "") + '<p class="mk-note">' + cs.w("screen.counsel.matters.other") + "</p>");
      // a defense adds the challenged statements, the pressure received and the defense deadlines, each dated only from a recorded start
      const sec = pk && pk.sections ? pk.sections : {};
      const itemsOf = function (s) { return s && Array.isArray(s.items) ? s.items : []; };
      const added = defence && pk ? cs.sec("screen.counsel.defense.heading", '<p class="mk-small">' + cs.w("screen.counsel.defense.challenged") + "</p>"
        + (itemsOf(sec.challenged).length ? cs.sheet(itemsOf(sec.challenged).map(function (c) {
          return cs.row("", cs.esc(c.statement || "") + '<span class="meta">' + cs.w("screen.counsel.defense.restson", { findings: String((c.findings || []).length), sources: String((c.sources || []).length) }) + "</span>", "", "");
        }).join("")) : "")
        + '<p class="mk-small">' + cs.w("screen.counsel.defense.pressure") + "</p>"
        + (itemsOf(sec.pressure).length ? cs.sheet(itemsOf(sec.pressure).map(function (x) {
          return cs.row("", cs.w("screen.counsel.defense.mark") + (x.at ? " · " + cs.date(x.at) : ""), "", "");
        }).join("")) : "")
        + '<p class="mk-small">' + cs.w("screen.counsel.defense.deadlines") + "</p>"
        + (itemsOf(sec.defence_deadlines).length ? cs.sheet(itemsOf(sec.defence_deadlines).map(function (d) {
          return cs.row("", cs.esc(d.rule || d.name || "") + '<span class="meta">' + (d.date ? cs.date(d.date) : cs.w("screen.counsel.defense.undetermined")) + "</span>", "", "");
        }).join("")) : "")) : "";
      const counselMatter = a.privileged || (pk && pk.privileged) ? cs.sec("screen.counsel.matter.heading", '<p class="mk-note">' + cs.w("screen.counsel.matter.seen") + " " + cs.w("screen.counsel.matter.hold") + "</p>") : "";
      const marked = pk ? cs.sec("screen.counsel.marked.heading", '<p class="mk-small">' + cs.esc(pk.marking && pk.marking.text ? pk.marking.text : typeof pk.marking === "string" ? pk.marking : "") + "</p>"
        + '<p class="mk-note">' + cs.w("screen.counsel.marked.every") + " " + cs.w("screen.counsel.marked.none") + "</p>") : "";
      return who + stmts + '<div class="mk-acts">' + cs.act("counselpacket", { tone: "primary" }) + "</div>" + (pk ? mattersSec + added + counselMatter + marked : "") + made;
    });
  },

  acts: [
    {
      // R34: "Assemble the packet, with a reason": for a claim or a defense; counsel named as the tier needs; the reason is kept
      // with this version; nothing is published or filed.
      op: "counselpacket", reasonField: "reason",
      send: function (view, el, cs) {
        const purpose = cs.value("cp-purpose") === "defence" ? "defence" : "claim";
        const reason = String(cs.value("cp-reason") || "").trim();
        const name = String(cs.value("cp-name") || "").trim(), org = String(cs.value("cp-org") || "").trim();
        const body = { action: view.subject, reason: reason, purpose: purpose };
        if (name || org) body.counsel = { name: name, organisation: org };
        if (purpose === "defence") {
          const said = String(cs.value("cp-chal-1") || "").trim();
          if (said) body.challenged = [{ statement: said }];
        }
        return { body: body };
      },
      // C8: the new version is listed among those assembled
      rereads: ["filings"],
      done: function (view, answer, cs) { if (answer && answer.sections) cs.set("packet", answer); },
    },
    {
      // C8 (filings R11): "Read this version": the version exactly as it was made, drawn in its place; nothing changes
      op: "counselpacketread", rereads: [],
      send: function (view, el) {
        if (!el.dataset.packet) return null;
        view.ui.reading = { packet: el.dataset.packet, version: Number(el.dataset.version) };
        return { query: { id: el.dataset.packet, version: el.dataset.version } };
      },
      done: function (view, answer, cs) {
        const r = answer && answer.result !== undefined ? answer.result : answer;
        if (r && r.ok !== false && view.ui.reading) cs.set("shown", Object.assign({ answer: r }, view.ui.reading));
      },
    },
    {
      // C8 (filings R11, R22): "Save as a file": the version's bytes, marked on every page, handed to the member to save; the record
      // keeps who saved which version, when and for which counsel, so the list is read again
      op: "counselpacketexport", rereads: ["filings"],
      send: function (view, el) {
        if (!el.dataset.packet) return null;
        return { body: { id: el.dataset.packet, version: Number(el.dataset.version) } };
      },
      done: function (view, answer, cs) {
        const r = answer && answer.result !== undefined ? answer.result : answer;
        if (r && r.ok !== false && typeof r.bytes === "string" && r.id)
          cs.set("saved", { packet: r.id, version: Number(r.version), name: r.id + "-" + String(r.version) + ".md", text: r.bytes });
      },
    },
  ],
});
