/* The case's docket (registry screen `docket`; R8, R16; DEC-116, DEC-100): Projects › <project> › Docket. The case's
 * entries (editions, corrections, withdrawals, court orders), each drafted or posted; filing an entry with the member's
 * reason for the record or public choice; posting a drafted entry signed with the member's own key, through the signer
 * kit, within its prepared statement's hour. Its subject is `<project>/<case>`. Every function is self-contained
 * (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";

export const DOCKET = Object.freeze({
  id: "docket",
  parts: PARTS,

  reads: function (view) {
    if (!view.parts.subject(view, 2)) return {}; // K3171: no subject in the address, no subject read
    const s = String(view.subject || "").split("/");
    return {
      project: { op: "image", query: { id: s[0] } },
      // The case is the subject; a case with no entry yet is not an unknown subject, so the read carries no `empty`.
      docket: { op: "docket", query: { case: s[1] || "" }, subject: true },
      // R8 (B420 2): the documents the team has captured, for the file form's "The document it rests on"
      captures: { op: "heldcaptures", query: { project: s[0], limit: "200", state: "held_and_vouched" } },
    };
  },

  place: function (view) {
    const id = String(view.subject || "").split("/")[0];
    const p = view.data.project;
    return { project: { id: id, title: view.parts.titleOf(p && p.state === "ok" ? p.value : null, id) } };
  },

  render: function (cs, view) {
    if (!view.parts.subject(view, 2)) return view.parts.nothing(cs);
    const P = view.parts;
    const caseId = String(view.subject || "").split("/")[1] || "";
    const out = [cs.title(null), '<p class="mk-sub">' + cs.w("screen.docket.sub", { case: caseId }) + "</p>"];
    // R20: with no entry, the screen's one empty state, which names the first step, is drawn without a section.
    const dk = view.data.docket && view.data.docket.state === "ok" ? view.data.docket.value : null;
    const none = !!dk && (!Array.isArray(dk.entries) || dk.entries.length === 0);
    out.push(none ? '<p class="cs-state" data-state="empty">' + cs.w("screen.docket.none") + "</p>" : cs.sec("screen.docket.entries", cs.state("docket", function (v) {
      return cs.sheet(v.entries.map(function (e) {
        const posted = e.shelf !== "record" || e.state === "posted" || e.published_at;
        const said = e.summary || e.reason || e.kind || "";
        let prep = "";
        if (!posted && e.proposed && e.proposed !== "record" && e.state !== "taken-back") {
          const pr = P.later(cs, view, "prepare:" + e.entry, "docketprepare", { query: { case: caseId, entry: String(e.entry), kind: e.kind } });
          prep = cs.state(pr, function (x) { return x.warning ? '<p class="mk-note">' + cs.esc(x.warning) + "</p>" : ""; })
            + cs.act("docketpost", { data: { entry: String(e.entry), kind: String(e.kind || "") } });
        }
        // C81: the preparation and "Post it, signed" sit under the entry, the whole width of the row, not squeezed into its end
        return cs.row("", "<b>" + cs.w("screen.docket.kind." + (["edition", "correction", "withdrawal", "court-order", "response", "statement", "reaction", "outcome"].includes(e.kind) ? e.kind : "other")) + "</b> · "
          + '<span class="rec">' + cs.esc(said) + "</span>",
          '<span class="meta">' + cs.w(posted ? "screen.docket.posted" : "screen.docket.drafted") + (e.filed_at || e.published_at ? " · " + cs.date(e.published_at || e.filed_at) : "") + "</span>")
          + (prep ? '<div class="mk-acts" style="display:block;padding:0 0 12px">' + prep + "</div>" : "");
      }).join(""));
    })));
    // R8 (B420 2; DEC-387): the file form drawn whole, in the order `docketfile` asks it: kind, the edition it answers (one per
    // ratified edition, the latest first and chosen), the captured document it rests on with the door to capture it first,
    // from whom, what it says (a writing field), where it goes, and the member's reason.
    const pubC = P.later(cs, view, "published", "publishedcase", { query: { id: caseId, caseId: caseId } });
    const pv = pubC.state === "ok" && pubC.value ? pubC.value : {};
    const eds = (Array.isArray(pv.edition_index) ? pv.edition_index : Array.isArray(pv.editions) ? pv.editions : [])
      .map(function (e) { return e && typeof e === "object" ? e : { edition: e }; }).filter(function (e) { return Number(e.edition) > 0; });
    eds.sort(function (a, b) { return Number(b.edition) - Number(a.edition); });
    const edOptions = eds.map(function (e) {
      const day = e.published_at || e.ratified_at || e.signed_at;
      return { value: String(e.edition), text: P.plain(cs.w("screen.docket.edition.option", { n: String(e.edition), date: { html: day ? cs.date(day) : "" } })) };
    });
    let caps = view.data.captures && view.data.captures.state === "ok" && view.data.captures.value && Array.isArray(view.data.captures.value.held) ? view.data.captures.value.held : [];
    // G20 (fix round 6; S11): the picker reaches every held document: while a page says it is `truncated` the next is read from its `next`
    // (`after`), up to 25 pages; past that, or on a page that cannot be read, the picker says how many it lists and no more is claimed
    let capNote = "", page = view.data.captures && view.data.captures.state === "ok" ? view.data.captures.value : null;
    for (let i = 0; page && page.truncated && page.next && i < 24; i++) {
      const nr = P.later(cs, view, "caps:" + i, "heldcaptures", { query: { project: String(view.subject || "").split("/")[0], limit: "200", state: "held_and_vouched", after: String(page.next) } });
      if (nr.state === "loading") { caps = []; capNote = cs.state(nr, function () { return ""; }); page = null; break; }
      if (nr.state !== "ok" || !nr.value || !Array.isArray(nr.value.held)) { caps = []; capNote = cs.state(nr, function () { return ""; }); page = null; break; }
      caps = caps.concat(nr.value.held);
      page = nr.value;
    }
    if (page && page.truncated) capNote = '<p class="mk-note" data-captures-more>' + cs.w("screen.people.more", { n: String(caps.length) }) + "</p>"; // stand-in: the nearest held row; the row owed is `screen.docket.capture.more`
    const capOptions = caps.filter(function (r) { return r && r.capture && r.capture.sha256; }).map(function (r) {
      return { value: String(r.capture.sha256).replace(/^sha256:/, ""), text: P.plain(cs.w("screen.docket.capture.option", { title: r.title || "", date: { html: cs.date(String(r.since || r.src_retrieved || "")) } })) };
    });
    out.push(cs.sec("screen.docket.file", cs.choice("dk-kind", "screen.docket.kind.label", [["response", "screen.docket.kind.response"], ["statement", "screen.docket.kind.statement"],
      ["reaction", "screen.docket.kind.reaction"], ["outcome", "screen.docket.kind.outcome"]])
      + (edOptions.length ? cs.choice("dk-edition", "screen.docket.edition.label", edOptions, { value: edOptions[0].value, help: "screen.docket.edition.help" }) : "")
      + (capOptions.length ? cs.choice("dk-capture", "screen.docket.capture.label", capOptions, { value: capOptions[0].value, help: "screen.docket.capture.help" }) : "")
      + capNote
      + '<p class="mk-small">' + cs.ref("capture", "", P.plain(cs.w("screen.docket.capture.add")), []) + "</p>"
      + cs.field("dk-from", "screen.docket.from.label", { rec: true, help: "screen.docket.from.help" })
      + cs.field("dk-summary", "screen.docket.summary.label", { area: true, rec: true })
      + cs.choice("dk-proposed", "screen.docket.proposed.label", [["record", "screen.docket.proposed.record"], ["public", "screen.docket.proposed.public"], ["both", "screen.docket.proposed.both"]])
      + cs.field("dk-reason", "screen.docket.reason.label", { area: true, help: "screen.docket.reason.help" })
      + '<div class="mk-acts">' + cs.act("docketfile")
      + (view.reachable ? cs.act("writinghelp", { data: { field: "summary", id: "dk-summary", forop: "docketfile" } }) : "") + "</div>" + P.said(view, "docketfile")));
    out.push('<p class="muted">' + cs.w("screen.docket.order") + "</p>" + P.said(view, "docketpost"));

    // R52 (C9; DEC-374): "Start the next edition": a published case is never changed; the next edition is a new draft that begins
    // from the findings chosen and says what it covers. The findings are those the case's published edition states.
    const pub = pubC;
    const held = pub.state === "ok" && Array.isArray(pub.value.findings) ? pub.value.findings.filter(function (f) { return f && (f.bundle_id || f.id); }) : [];
    if (held.length) {
      view.ui.nextFindings = held.map(function (f) { return String(f.bundle_id || f.id); });
      out.push(P.secTips(cs, "screen.docket.next.heading", '<p class="mk-note">' + cs.w("screen.docket.next.what") + "</p>"
        + cs.checks("dk-next-findings", "screen.docket.next.findings", held.map(function (f) {
          const b = f.body || {};
          return { value: String(f.bundle_id || f.id), on: false, text: String(b.conclusion || b.question || f.title || f.bundle_id || f.id) };
        }))
        + cs.field("dk-next-scope", "screen.docket.next.scope", { area: true, rec: true, help: "screen.docket.next.scope.help" })
        + '<div class="mk-acts">' + cs.act("casedraft", { tone: "primary" }) + "</div>" + P.said(view, "casedraft"), []));
    }

    // R43 (N858 D10; DEC-340; docket R30; action-holds R19): "Pressure marked on this case", after the record: each entry that
    // carries a mark with its date, who made it, the note, and "No hold is placed for it yet" when `holdsdue` lists it; the
    // counsel sentence and the way to the hold. A viewer not seeing the project in full is answered no entries with marks, so none is drawn.
    const marked = dk && Array.isArray(dk.entries) ? dk.entries.filter(function (e) { return e && e.pressure && typeof e.pressure === "object"; }) : [];
    if (marked.length) {
      const due = P.later(cs, view, "holdsdue", "holdsdue", {});
      const listed = due.state === "ok" && due.value && Array.isArray(due.value.items) ? due.value.items : [];
      const lacks = function (e) { return listed.some(function (x) { return x && x.arrived && String(x.arrived.docket_entry) === String(e.entry); }); };
      out.push(P.secTips(cs, "screen.docket.pressure.heading", cs.sheet(marked.map(function (e) {
        const m = e.pressure, who = m.by && m.by.handle ? String(m.by.handle) : m.by && m.by.member ? cs.memberName(m.by.member) : ""; // C94: a handle, never the member id
        const kind = ["legal", "retaliation", "discrediting", "other"].includes(m.kind) ? m.kind : "other";
        const said = !who ? "" : kind === "legal" ? cs.w("screen.docket.pressure.mark", { member: who })
          : cs.w("screen.action.pressure." + kind) + " · " + cs.w("screen.action.pressuremark.by", { who: who });
        return cs.row("", "<b>" + (m.at ? cs.date(m.at) : "") + "</b>" + (said ? " · " + said : ""),
          '<span class="meta">' + (m.note ? '<span class="rec">' + cs.esc(m.note) + "</span>" : "") + (lacks(e) ? (m.note ? " · " : "") + cs.w("screen.hold.nohold") : "") + "</span>");
      }).join("")) + '<p class="mk-note">' + cs.w("screen.docket.pressure.counsel") + "</p>"
        + '<div class="mk-acts">' + marked.map(function (e) { return cs.ref("hold", e.entry, P.plain(cs.w("screen.action.hold.link")), []); }).join(" ") + "</div>",
      ["screen.docket.pressure.tip1", "screen.docket.pressure.tip2"]));
    }
    return out.join("");
  },

  acts: [
    {
      // R52 (C9; DEC-374; `review` R39): "Start the next edition": `casedraft` with the published case's `caseId`, the findings chosen and
      // the scope; the case editor then opens on the new draft. With no finding chosen, or no scope, nothing is sent and it says so.
      op: "casedraft", label: "act.casedraft.label.docket", rereads: [],
      refusals: { REVIEW_NO_SUCH_CASE: "screen.docket.next.refused.nocase" },
      send: function (view, el, cs) {
        const P = view.parts;
        const caseId = String(view.subject || "").split("/")[1] || "";
        const ticked = cs.value("dk-next-findings");
        const targets = (Array.isArray(ticked) ? ticked : []).filter(function (id) { return (view.ui.nextFindings || []).includes(id); });
        const scope = String(cs.value("dk-next-scope") || "").trim();
        const refuse = function (key) { P.say(cs, view, "casedraft", P.fold(cs, "screen.docket.next.refused.summary", "<p>" + cs.w(key) + "</p>"), false); return null; };
        if (!targets.length) return refuse("screen.docket.next.refused.nofinding");
        if (!scope) return refuse("screen.docket.next.refused.noscope");
        return { body: { project: String(view.subject || "").split("/")[0], caseId: caseId, targets: targets, scope: scope } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "casedraft", answer)) return;
        const r = view.parts.value(answer) || {};
        view.parts.forget(view);
        cs.go("case-editor", String(view.subject || "").split("/")[0] + (r.draftId ? "/" + r.draftId : ""));
      },
    },
    {
      // R8 (B17; interface-shell R20; DEC-387): the assistant's help with "What it says", drawn only while it is reachable and never under
      // the reason; told only what the member typed, and its words fill the field labelled machine work. The owner's declaration
      // (`writinghelp`, wizard-scripts R46) requires `op`, the act the words are for.
      op: "writinghelp", label: "act.writinghelp.label.docket", rereads: [], reasonField: "told",
      send: function (view, el, cs) {
        view.ui.helpId = el.dataset.id;
        const told = String(cs.value(el.dataset.id) || "").trim();
        if (!el.dataset.forop || !told) return null;
        return { body: { op: el.dataset.forop, field: el.dataset.field, told: told } };
      },
      done: function (view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        if (a && typeof a.text === "string" && view.ui.helpId) cs.fill(view.ui.helpId, a.text, { label: "screen.start-send.draft.machine" });
      },
    },
    {
      // R8: "File a docket entry", with the member's reason for the record or public choice.
      op: "docketfile", label: "act.docketfile.label.docket", rereads: ["docket"], reasonField: "reason",
      send: function (view, el, cs) {
        const caseId = String(view.subject || "").split("/")[1] || "";
        const summary = String(cs.value("dk-summary") || "").trim();
        const from = String(cs.value("dk-from") || "").trim();
        const edition = Number(cs.value("dk-edition")), capture = String(cs.value("dk-capture") || "");
        if (!summary || !from || !(edition > 0) || !capture) return { refuse: "screen.docket.file.needed" };
        return { body: { case: caseId, edition: edition, capture: capture, kind: String(cs.value("dk-kind") || "response"), from: { kind: "other", name: from }, summary: summary,
          proposed: String(cs.value("dk-proposed") || "record"), reason: String(cs.value("dk-reason") || "").trim() } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "docketfile", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R8, R16: "Post it, signed": the prepared `docketStatement` (namespace `bio-docket`), prepared again once its hour has
      // passed, signed through the signer kit, and posted with its digest; declined, nothing is sent.
      op: "docketpost", label: "act.docketpost.label.docket", rereads: ["docket"],
      send: async function (view, el, cs) {
        const P = view.parts;
        const caseId = String(view.subject || "").split("/")[1] || "";
        const L = view.ui.later || {};
        let pr = L["prepare:" + el.dataset.entry] && L["prepare:" + el.dataset.entry].state === "ok" ? L["prepare:" + el.dataset.entry].value : null;
        if (!pr || !pr.statement || (pr.expires && Date.parse(pr.expires) <= cs.now())) {
          pr = P.value(await cs.call("docketprepare", { query: { case: caseId, entry: el.dataset.entry, kind: el.dataset.kind } }));
          if (!pr || pr.ok === false || typeof pr.statement !== "string") return { refuse: "screen.docket.prepare.failed" };
        }
        const signed = await cs.signer.sign([{ label: "docket " + caseId, bytes: P.bytes(pr.statement), namespace: "bio-docket" }]);
        if (!signed || signed.ok !== true || !Array.isArray(signed.signatures) || signed.signatures.length !== 1) return { refuse: "signing.ceremony.declined" };
        return { body: { digest: pr.digest, signature: signed.signatures[0], acknowledged: true } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "docketpost", answer)) return; // D29: not posted on a refusal
        view.parts.forget(view);
        view.parts.say(cs, view, "docketpost", cs.w("screen.docket.posted.said"));
      },
    },
  ],
});
