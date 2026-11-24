/* Brief counsel (registry screen `counsel`; screens-action R34; DEC-340, U366; K3935; `filings` R8, R9, R10). Projects ›
   <project> › Action › Brief counsel: a packet for the team's lawyer about one action, for a claim or for a defense, with the
   member's reason. It names counsel (required at tier 3 or when the tier is undetermined, optional at 1 or 2), draws each
   matter as the packet states it ("not determined" never stops the packet), adds for a defense the challenged statements, the
   pressure received and the defense deadlines, and marks every section "Prepared for review by …. Not legal advice. Not for
   filing." The packet is never offered for publication. The subject is the action. It holds no member-facing English (R19).
   Every function here is self-contained (interface-shell R21 (1)). */
import { readOnly } from "./send-steps.mjs";

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
    };
  },

  parts: {
    readOnly: readOnly,
    // R34: counsel is required at tier 3 or undetermined, optional at 1 or 2
    required: function (a) { return !(Number(a.risk_tier) === 1 || Number(a.risk_tier) === 2); },
    // the matters as the packet states them: each fact with whether a determination holds it
    mattersOf: function (packet) {
      const s = packet && packet.sections && packet.sections.facts ? packet.sections.facts : null;
      return s && Array.isArray(s.items) ? s.items : [];
    },
  },

  render: function (cs, view) {
    const P = view.parts;
    const head = P.readOnly(cs, "screen.counsel.name") + cs.title(null) + '<p class="mk-sub">' + cs.w("screen.counsel.sub") + "</p>";
    const twoHelp = function (k) { return '<p class="mk-small">' + cs.w(k) + "</p>"; };
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
      return who + stmts + '<div class="mk-acts">' + cs.act("counselpacket", { tone: "primary" }) + "</div>" + (pk ? mattersSec + added + counselMatter + marked : "");
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
      rereads: [],
      done: function (view, answer, cs) { if (answer && answer.sections) cs.set("packet", answer); },
    },
  ],
});
