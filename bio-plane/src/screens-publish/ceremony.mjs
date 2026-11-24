/* The publication ceremony (registry screen `ceremony`; R3–R5, R12–R15; DEC-147, DEC-180, DEC-183, DEC-207, DEC-208,
 * DEC-210; N683, N757, N788): Projects › <project> › Publish. Its steps in order, the current one marked; the checks
 * against the bar and what will be disclosed; the Photos step; the Ties step that prepares the edition; then the Sign
 * step inside the ceremony: when it becomes public, one sitting of the member's own key over every statement listed, and
 * the edition signed and waiting or published. Its subject is `<project>/<draft>`, or the project alone (R32): the newest
 * draft, else nothing ready to publish. Every function is self-contained (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";

/* G60 (fix round 7): the signing-time refusal GATE_REFUSED carries the case gate's findings (`ratification` R2: `findings`, each
 * `{check, detail, repairs?}`, or `says: {key, vars}` where a finding carries its words); the refusal's sentence is followed by one
 * line for each, its text as data, its check as the reference a member can quote, and what repairs it. A finding with neither text
 * nor check is not drawn. Self-contained (interface-shell R21 (1)); `caseratify` and `publishat` take it alike. */
const GATE_REFUSED = function (r, cs) {
  const str = function (v) { return typeof v === "string" && v.trim() ? v.trim() : ""; };
  const lines = (Array.isArray(r.findings) ? r.findings : []).map(function (f) {
    if (!f || typeof f !== "object") return "";
    const check = str(f.check), text = f.says && typeof f.says.key === "string" ? cs.w(f.says.key, f.says.vars || {}) : cs.esc(str(f.detail) || str(f.message));
    if (!check && !text) return "";
    const fix = (Array.isArray(f.repairs) ? f.repairs : f.repairs ? [f.repairs] : []).map(function (x) { return str(typeof x === "string" ? x : x && (x.detail || x.says || x.text || x.message)); }).filter(Boolean);
    return '<br><span data-gate-finding="' + cs.esc(check) + '">' + text + (check ? ' <code class="meta">' + cs.esc(check) + "</code>" : "")
      + fix.map(function (x) { return ' <span class="meta" data-repair>' + cs.esc(x) + "</span>"; }).join("") + "</span>";
  }).filter(Boolean);
  return cs.w("refusal.GATE_REFUSED") + (lines.length ? "<br><b>" + cs.w("ceremony.gate.heading") + "</b>" + lines.join("") : "");
};

export const CEREMONY = Object.freeze({
  id: "ceremony",
  parts: PARTS,

  reads: function (view) {
    if (!view.parts.subject(view, 1)) return {}; // K3171: no subject in the address, no subject read
    const s = String(view.subject || "").split("/");
    // R32: with no draft in the address the project's drafts are read first; none, and the ceremony's own reads are not sent.
    if (!s[1]) return {
      project: { op: "image", query: { id: s[0] } },
      drafts: { op: "casedrafts", query: { project: s[0] }, empty: function (v) { return !v || !Array.isArray(v.drafts) || v.drafts.length === 0; } },
      group: { op: "groupidentity" },
    };
    return {
      project: { op: "image", query: { id: s[0] } },
      copy: { op: "reviewcopy", query: { draft: s[1] || "" }, subject: true },
      // C49: the project's drafts, for "Which draft" and the live review links on any of them
      drafts: { op: "casedrafts", query: { project: s[0] }, empty: function (v) { return !v || !Array.isArray(v.drafts) || v.drafts.length === 0; } },
      group: { op: "groupidentity" },
    };
  },

  place: function (view) {
    const id = String(view.subject || "").split("/")[0];
    const p = view.data.project;
    // R68 (H2; DEC-384): a project whose title the viewer cannot read is named `crumb.project.unjoined`, never by its id
    const title = view.parts.titleOf(p && p.state === "ok" ? p.value : null, "");
    return title ? { project: { id: id, title: title } } : { project: { id: id, title: id }, projectKey: "crumb.project.unjoined" };
  },

  render: function (cs, view) {
    if (!view.parts.subject(view, 1)) return view.parts.nothing(cs);
    const P = view.parts, ui = view.ui;
    const s = String(view.subject || "").split("/");
    let draft = s[1] || "";
    let copyR = view.data.copy;
    const pv = view.data.project && view.data.project.state === "ok" ? view.data.project.value : null;
    const projectTitle = P.titleOf(pv, s[0]);
    const g = view.data.group && view.data.group.state === "ok" ? view.data.group.value : null;
    const groupName = g ? g.display_name || g.group || "" : "";
    if (!draft) {
      // R32: a project with no draft has nothing ready to publish, and says so with the one door that leads to it; a read
      // that failed is drawn failed, never as nothing ready.
      const d = view.data.drafts;
      if (!d || d.state !== "ok" && d.state !== "empty") return cs.title(null) + cs.state("drafts", function () { return ""; });
      if (d.state === "empty") return cs.title(null) + '<p class="cs-state" data-state="empty" data-nothing-ready>' + cs.w("screen.ceremony.nothing") + "</p>"
        + "<p>" + cs.ref("case-editor", s[0], P.plain(cs.w("case.links.editor")), []) + "</p>";
      draft = d.value.drafts[d.value.drafts.length - 1].draft_id;
      copyR = P.later(cs, view, "copy", "reviewcopy", { query: { draft: draft } });
    }
    ui.draftId = draft;
    const copy = copyR && copyR.state === "ok" ? copyR.value : null;
    const c = copy && copy.case ? copy.case : {};
    const out = [cs.title(P.titleOf2(cs, copy, c.identity ? P.plain(cs.w("screen.ceremony.heading", { case: c.identity, edition: String(c.edition || "") })) : null), { thing: "case" })];
    // C49 (DEC-394, DEC-395): "Which draft" among the project's drafts, and how many review links are live on any of them; a list that
    // could not be read is drawn failed, never as one draft, and the ceremony goes on without it
    const dR = view.data.drafts;
    const all = dR && dR.state === "ok" && Array.isArray(dR.value.drafts) ? dR.value.drafts : [];
    const list = P.draftCopies(cs, view, all, draft, copyR);
    out.push(P.draftHead(cs, view, "ceremony", list, draft, projectTitle));
    out.push(dR && dR.state !== "ok" && dR.state !== "empty" ? cs.state(dR, function () { return ""; })
      : P.draftChooser(cs, view, "ceremony", list, draft, projectTitle) + P.liveNote(cs, view, "ceremony", list));
    if (!copy) { out.push(cs.state(copyR, function () { return ""; })); return out.join(""); }
    // R50: the requests name the draft and the project, and add only what the member attested in this step (`P.attested`)
    const args = Object.assign(P.caseArgs(copy, draft), ui.attestedBody || {});
    const mine = ui.attested || { disc: [], words: {}, sa: [], why: {}, bias: "" };

    // R3's reads: the checks against the bar, what will be disclosed, and an edition waiting to publish.
    // G62 (B46): once the member has attested the ties and the edition is prepared (this page's own `publish`, or the draft's record),
    // the pre-flight carries `tieAttested: true` as `caseratify` will, so the signing check is reached and the time offered
    const mineEd = all.find(function (x) { return x && x.draft_id === draft; });
    const tied = !!ui.prepared || !!(mineEd && mineEd.editions && Number(mineEd.editions.prepared) > 0);
    const pre = P.later(cs, view, "preflight", "publishpreflight", { body: tied ? Object.assign({}, args, { tieAttested: true }) : args });
    const ten = P.later(cs, view, "tensions", "publishtensions", { body: { project: args.project, draft: draft } });
    const found = P.findingsOf(copy);
    // C46: a finding is named by its title, where the draft's copy states one, never by its id
    const nameOf = function (t) {
      const x = (Array.isArray(copy.findings) ? copy.findings : []).find(function (y) { return y && y.target === t; });
      return x && typeof x.title === "string" && x.title.trim() ? x.title.trim() : t;
    };
    const steps = pre.state === "ok" && Array.isArray(pre.value.steps) ? pre.value.steps : [];
    const stepWith = function (k) { return steps.find(function (x) { return x && typeof x === "object" && k in x; }) || null; };
    // R70, R71 (fix round 3, C48, C50; case-authoring R83, review R19): what this draft has prepared and published is read from the record:
    // the pre-flight's `editions`, else the draft's own in `casedrafts`; `{prepared, published: {edition, address}}`, so a reloaded page states
    // it again. An older answer that states neither is read as before: the case's public editions (`publishedcase`) and the unsigned
    // document of the edition the draft stands at (`casedocument`).
    const mineDraft = all.find(function (x) { return x && x.draft_id === draft; }) || null;
    const objOf = function (v) { return v && typeof v === "object" && !Array.isArray(v) ? v : null; };
    const recd = pre.state === "ok" && objOf(pre.value.editions) ? pre.value.editions : mineDraft && objOf(mineDraft.editions) ? mineDraft.editions : null;
    out.push(P.noCase(cs, copy, recd)); // R80: not said of a draft the record holds an edition of
    const recPub = recd && objOf(recd.published) && Number(recd.published.edition) > 0 ? recd.published : null;
    // R80: the case the record says the preparation belongs to (`editions.case`, case-authoring R83), else the copy's, else the pre-flight's pinned step
    const recCase = recd && typeof recd.case === "string" ? recd.case : "";
    const caseFor = c.case_id || recCase || (objOf(stepWith("pinned")) ? String(stepWith("pinned").case || "") : "");
    const waitPre = !recd && pre.state === "loading"; // the record is asked for the edition once the pre-flight has said what it holds
    const pubR = !recd && !waitPre && c.case_id ? P.later(cs, view, "published", "publishedcase", { query: { caseId: c.case_id } }) : null;
    const pubOk = pubR && pubR.state === "ok" && pubR.value && typeof pubR.value === "object" ? pubR.value : null;
    const pubList = pubOk ? (Array.isArray(pubOk.editions) ? pubOk.editions : []).map(function (e) { return Number(e && typeof e === "object" ? e.edition : e); }).filter(function (n) { return n > 0; }) : [];
    const pubLatest = recd ? (recPub ? Number(recPub.edition) : 0) : pubList.length ? Math.max.apply(null, pubList) : 0;
    const pubGone = pubR && pubR.state === "failed" && !(pubR.refusal && /^(NOT_PUBLISHED|NO_PUBLISHED_EDITION|NO_SUCH_)/.test(String(pubR.refusal.code || "")));
    const ownPublished = pubLatest > 0 && (recd ? (Number(c.edition) > 0 ? pubLatest >= Number(c.edition) : !(Number(recd.prepared) > 0)) : Number(c.edition) > 0 && pubList.indexOf(Number(c.edition)) >= 0);
    // R70: a prepared edition is kept across a reload: the record holds the unsigned document of the edition this draft stands at
    // (`casedocument`; a case edition never authored answers NO_CASE_DOCUMENT), pinned as the draft's findings
    let prepared = ui.prepared || null;
    const preparedNo = recd ? (Number(recd.prepared) > 0 ? String(Number(recd.prepared)) : "") : c.edition ? String(c.edition) : "";
    const wanted = !prepared && !waitPre && caseFor && preparedNo && !ownPublished ? { case: caseFor, edition: preparedNo } : null;
    const recR = wanted ? P.later(cs, view, "document", "casedocument", { query: wanted }) : null;
    const rec = recR && recR.state === "ok" && recR.value && recR.value.ok !== false ? recR.value : null;
    if (rec && rec.sign && typeof rec.sign.statement === "string" && !rec.signature && !rec.published_at) {
      // E4 (fix round 5, C48): after a reload the findings the edition pins are the signed document's own roster (`casedocument`'s
      // `findings`), never the citations (`{state, rows}`: the project's edges); the Sign step refuses when it cannot read them
      prepared = { caseId: rec.case_id || caseFor, edition: rec.edition || preparedNo, docSha: rec.doc_sha || null, findings: P.rosterOf(rec) || [] };
    }
    if (prepared && !ui.prepared) ui.prepared = prepared; // the acts of the Sign step read it from page memory
    const caseId = prepared ? prepared.caseId : caseFor;
    const sched = caseId ? P.later(cs, view, "schedule", "publishschedule", { query: { case: caseId } },
      function (v) { return !v || !Array.isArray(v.editions) || v.editions.length === 0; }) : null;
    const photoStep = stepWith("photos");
    const photos = photoStep && Array.isArray(photoStep.photos) ? photoStep.photos : [];
    const signStep = stepWith("publish_at") || stepWith("signer") || {};
    const waiting = sched && sched.state === "ok" ? sched.value.editions.find(function (e) {
      return e.state === "waiting" && (!prepared || String(e.edition) === String(prepared.edition));
    }) : null;
    const published = ui.signed && ui.signed.now ? ui.signed : sched && sched.state === "ok" ? sched.value.editions.find(function (e) {
      return e.state === "published" && prepared && String(e.edition) === String(prepared.edition);
    }) : null;

    // R71: an edition already public is named with its link (the address the record gives); the draft that is itself published offers
    // nothing to prepare
    if (pubLatest > 0) {
      // R80 (K4450): the address is written as the case page's route is (`hrefOf`: one encoded part), never the record's own `address`
      const addr = "/app/published/" + encodeURIComponent((recCase || caseId) + "/" + pubLatest);
      out.push('<p role="status" data-published="' + pubLatest + '">' + cs.w("screen.ceremony.published.edition", { n: String(pubLatest) }) + "</p>"
        + '<a href="' + cs.esc(addr) + '" data-nav data-published-link>' + cs.w("screen.ceremony.publicpage") + "</a>");
      if (ownPublished) return out.join("");
    } else if (pubGone) out.push(cs.state(pubR, function () { return ""; }));

    // R3: the steps in order, the current one marked.
    const NAMES = ["what", "strength", "leavesout", "people", "photos", "disclosures", "bias", "preview", "ties", "sign"];
    const unchecked = photoStep ? Number(photoStep.unchecked || 0) : 0;
    const current = published || waiting || (ui.signed && ui.signed.at) ? NAMES.length : prepared ? 9 : unchecked > 0 ? 4 : 8;
    out.push('<ol class="mk-steps" data-steps="ceremony">' + NAMES.map(function (n, i) {
      return "<li" + (i < current ? ' class="done"' : "") + (i === current ? ' aria-current="step"' : "") + ' data-step="' + n + '">' + cs.w("screen.ceremony.step." + n) + "</li>";
    }).join("") + "</ol>");

    // R3: each finding against the bar and every refusal that holds before signing; "Check again". R28: what stops the
    // signing is listed under its heading, each gate in plain words on its own line, never a check's code or its developer text.
    out.push(cs.sec("screen.ceremony.checks", cs.state(pre, function (v) {
      const what = stepWith("pinned");
      const pinned = what && Array.isArray(what.pinned) ? what.pinned : [];
      const foundAll = (v.first ? [v.first] : []).concat(Array.isArray(v.blockers) ? v.blockers : []);
      const seen = {};
      const lines = [];
      foundAll.forEach(function (b) {
        const code = String(b && (b.code || b.reason) || "");
        if (code === "PUBLISH_NO_FINDING" || code === "NO_TARGET" || (code && seen[code])) return;
        seen[code] = true;
        // G60: a case gate that refused lists the findings it found, one line each, not its sentence alone
        const gated = code === "GATE_REFUSED" ? P.gateLines(cs, b) : [];
        if (gated.length) { gated.forEach(function (l) { lines.push(l); }); return; }
        const says = b && b.says && typeof b.says.key === "string" ? cs.w(b.says.key, b.says.vars || {}) : P.refusalText(cs, b);
        lines.push(cs.w("ceremony.gate.other", { what: { html: says.replace(/[.\s]+$/, "") } }));
      });
      // R66 (L16; DEC-384): a draft that names no finding is refused `PUBLISH_NO_FINDING`; the gate says so and offers the door that
      // adds one (the case editor, at "What goes in")
      const nofinding = !found.length || foundAll.some(function (b) { return b && (b.code || b.reason) === "PUBLISH_NO_FINDING"; });
      if (nofinding) lines.unshift(cs.w("ceremony.gate.notargets") + ' <a class="cs-btn" data-tone="quiet" data-addfinding href="/app/case-editor/' + encodeURIComponent(s[0] + "/" + draft) + '#what-goes-in" data-nav>'
        + cs.w("screen.ceremony.gate.addfinding") + "</a>");
      return (pinned.length ? cs.sheet(pinned.map(function (f) { return cs.row("", cs.ref("question", f.target, nameOf(f.target), []), ""); }).join("")) : "")
        + (prepared ? "" : v.ready && !lines.length ? '<p data-ready="yes">' + cs.w("screen.ceremony.ready") + "</p>"
          : lines.length ? '<p data-ready="no"><b>' + cs.w("ceremony.gate.heading") + '</b></p><ul class="mk-list" data-blockers>' + lines.map(function (l) { return '<li role="alert">' + l + "</li>"; }).join("") + "</ul>"
            : '<p data-ready="no">' + cs.w("screen.ceremony.notready") + "</p>");
    }) + '<div class="mk-acts">' + cs.act("publishpreflight") + "</div>"
    // D-M5 (1): a refused confirmation of the ties is said here as well, with the stops it is about, not only at the foot of the page
    + P.said(view, "stops")));

    // R57 (C12; DEC-378): the four details of this work, stated or not stated, never blocking the signing; read once the case has an id.
    if (c.case_id) {
      const dd = P.later(cs, view, "cdetails", "casedetails", { query: { case: c.case_id } });
      const d = dd.state === "ok" && dd.value && dd.value.details && typeof dd.value.details === "object" ? dd.value.details : null;
      if (d) out.push(cs.sec("act.owed_casedetails.label.case-editor", cs.sheet([["area", "screen.case-editor.details.name.area"], ["contact", "screen.case-editor.details.name.contact"],
        ["related", "screen.case-editor.details.name.related"], ["relationships", "screen.case-editor.details.name.relationships"]].map(function (f) {
        const x = d[f[0]] || {};
        return cs.row("", '<span data-detail="' + f[0] + '">' + cs.w(f[1]) + "</span>", x.stated ? '<span class="muted" data-stated>' + cs.w("screen.case-editor.details.stated") + (x.set_at ? " · " + cs.date(x.set_at) : "") + "</span>"
          : '<span class="muted" data-notstated>' + cs.w("case-inputs.details.not_stated") + "</span>");
      }).join("")) + '<p class="mk-note">' + cs.w("screen.ceremony.details.ceremony.notstated1") + " " + cs.w("screen.ceremony.details.ceremony.notstated2") + "</p>"
        + '<div class="mk-acts">' + cs.act("casedetails") + "</div>"));
    }

    // R3: what will be disclosed with the case; "See everything that will be disclosed". Not drawn when nothing is to be
    // disclosed, and no count is drawn at zero (R20). R46 (C5; DEC-377): each candidate has a tick and an optional field for the
    // owner's words; `publishpreflight` and `publish` send the ticked ones as `tensionsDisclosed`.
    ui.tensionIds = [];
    out.push(P.sec(cs, "screen.ceremony.disclosed", cs.state(ten, function (v) {
      const all = ui.allTensions || null;
      const list = all && Array.isArray(all.candidates) ? all.candidates : Array.isArray(v.candidates) ? v.candidates.slice(0, 5) : [];
      const n = typeof v.count === "number" ? v.count : list.length;
      if (!n && !list.length) return "";
      const named = list.filter(function (t) { return t && typeof t.candidate === "string" && t.candidate; });
      ui.tensionIds = named.map(function (t) { return t.candidate; });
      return '<p>' + cs.w("screen.ceremony.disclosed.count", { n: String(n) }) + "</p>"
        + (list.length ? cs.sheet(list.map(function (t) {
          return cs.row("", '<span class="rec">' + cs.esc(t.says || t.summary || t.description || t.candidate || "") + "</span>", "");
        }).join("")) : "") + '<p class="muted">' + cs.w("screen.ceremony.timeline.frozen") + "</p>"
        + (named.length ? '<p class="mk-small">' + cs.w("screen.ceremony.disc.intro1") + " " + cs.w("screen.ceremony.disc.intro2") + "</p>"
          + cs.checks("ce-disc", "screen.ceremony.disc.list.legend", named.map(function (t) {
            return { value: t.candidate, text: t.says || t.summary || t.description || t.candidate, on: mine.disc.includes(t.candidate) };
          }))
          + named.map(function (t, i) {
            return cs.field("ce-dw-" + i, "screen.ceremony.disc.words.label", { rec: true, value: mine.words[t.candidate] || "", help: ["screen.ceremony.disc.words.help1", "screen.ceremony.disc.words.help2"] });
          }).join("") : "")
        + '<div class="mk-acts">' + cs.act("publishtensions") + "</div>";
    })));

    // R51 (C6; DEC-377): "Documents without a second confirmation", from the pre-flight: ask for the confirmation again (`reattest`),
    // list the document as self-attested only with a required reason (`selfAttested`, sent with the pre-flight and `publish`), or the
    // capturing member's own signed account (`captureaccount`).
    // Each entry is `{capture, by, findings, timestamp_at, co_archive, missing, late, timestamp_late, late_words}` (case-authoring R82,
    // case-disclosures R2): the capture, the member who captured it (null when none), the findings resting on it, which of the two proofs
    // (`timestamp`, `co_archive`) it still lacks, and the plane's own sentence when its timestamp was made late (null when it was not).
    const unconfRows = (pre.state === "ok" ? ((stepWith("not_co_attested") || {}).not_co_attested || []) : []).map(function (x) {
      return typeof x === "string" ? { capture: x, by: null, findings: [] } : x && typeof x === "object" ? x : null;
    }).filter(function (x) { return x && typeof x.capture === "string" && x.capture; });
    const unconfirmed = unconfRows.map(function (x) { return x.capture; });
    const unconfBy = function (x) { return typeof x.by === "string" && x.by ? cs.memberName(x.by) : ""; };
    // R51 (fix round 3, C40): the proof still absent, not the fixed sentence for both; an older entry that states none keeps it
    const proofLine = function (x) {
      const miss = Array.isArray(x.missing) ? x.missing : null;
      const key = !miss || (miss.indexOf("timestamp") >= 0 && miss.indexOf("co_archive") >= 0) ? "screen.ceremony.conf.row.meta"
        : !miss.length ? "screen.ceremony.conf.row.done" : miss.indexOf("co_archive") >= 0 ? "screen.ceremony.conf.row.missing.co_archive" : "screen.ceremony.conf.row.missing.timestamp";
      return '<span class="meta" data-proof="' + (miss ? miss.join(" ") : "") + '">' + cs.w(key) + "</span>"
        + (typeof x.late_words === "string" && x.late_words ? ' <span class="meta" data-late>' + x.late_words + "</span>" : "");
    };
    const already = pre.state === "ok" ? ((stepWith("not_co_attested") || {}).self_attested || []) : [];
    ui.confIds = unconfirmed;
    if (unconfirmed.length) {
      const was = {};
      already.forEach(function (a) { if (a && a.capture) was[a.capture] = a.reason || ""; });
      const sa = ui.attested ? mine.sa : Object.keys(was);
      out.push(cs.sec("screen.ceremony.conf.heading", '<p class="mk-note">' + cs.w("screen.ceremony.conf.intro1") + "</p>"
        + cs.sheet(unconfRows.map(function (x) {
          const sha = x.capture, by = unconfBy(x);
          return cs.row("", '<span class="id" data-unconfirmed="' + cs.esc(sha) + '">' + cs.esc(String(sha).slice(0, 12)) + "</span>"
            + (by ? ' <span class="meta" data-capturer="' + cs.esc(sha) + '">' + cs.esc(by) + "</span>" : "")
            + proofLine(x)
            // C40: "has neither" is said only of a document that lacks both proofs (an older entry that states none is read as lacking both)
            + (Array.isArray(x.findings) && (!Array.isArray(x.missing) || (x.missing.indexOf("timestamp") >= 0 && x.missing.indexOf("co_archive") >= 0)) ? x.findings.filter(function (f) { return typeof f === "string" && f; }).map(function (f) {
              return '<p class="mk-small" data-rests="' + cs.esc(sha) + '">' + cs.w("screen.ceremony.conf.intro2", { finding: nameOf(f) }) + "</p>";
            }).join("") : ""),
            cs.act("reattest", { data: { capture: sha } }));
        }).join("")) + '<p class="mk-note">' + cs.w("screen.ceremony.conf.retry.note") + "</p>"
        + cs.checks("ce-sa", "screen.ceremony.conf.self.legend", unconfirmed.map(function (sha) { return { value: sha, key: "screen.ceremony.conf.self.tick", fills: { document: String(sha).slice(0, 12) }, on: sa.includes(sha) }; }))
        + unconfirmed.map(function (sha, i) {
          return cs.field("ce-sar-" + i, "screen.ceremony.conf.reason.label", { rec: true, value: ui.attested ? mine.why[sha] || "" : was[sha] || "",
            help: ["screen.ceremony.conf.reason.help1", "screen.ceremony.conf.reason.help2"] });
        }).join("") + '<p class="mk-note">' + cs.w("screen.ceremony.conf.self.note") + "</p>"
        + unconfirmed.map(function (sha, i) {
          const mineAcct = P.later(cs, view, "acct:" + sha, "captureaccounts", { query: { capture: sha } });
          const actors = mineAcct.state === "ok" && mineAcct.value && Array.isArray(mineAcct.value.actors) ? mineAcct.value.actors : [];
          const me = view.me || {};
          // only the member who captured it adds an account of the capture
          if (!actors.some(function (a) { return a && me.member && String(a.actor) === String(me.member); })) return "";
          return cs.field("ce-cap-" + i, "screen.ceremony.conf.account.label", { area: true, rec: true, fills: { name: me.handle || me.member || "" },
            help: ["screen.ceremony.conf.account.help1", "screen.ceremony.conf.account.help2"] })
            + '<div class="mk-acts">' + cs.act("captureaccount", { data: { capture: sha, index: String(i) } }) + "</div>";
        }).join("") + P.said(view, "reattest") + P.said(view, "captureaccount")));
    }

    // R44 (C2; DEC-376): the declared bias for this edition, the member's own words, fixed into the edition when she signs; sent with the
    // pre-flight and `publish` as `biasAcknowledgement`. Never blocks publishing.
    const heldBias = ui.attested ? mine.bias : (copy.authored && typeof copy.authored.biasAcknowledgement === "string" ? copy.authored.biasAcknowledgement : "");
    out.push(cs.sec("screen.ceremony.step.bias", '<p class="mk-small">' + cs.w("screen.ceremony.the_teams_own_statement_of") + " " + cs.w("screen.ceremony.every_published_case_carries_it") + "</p>"
      + '<p class="mk-small">' + cs.w("screen.ceremony.this_is_the_lens_in", { project: projectTitle }) + " " + cs.w("screen.ceremony.it_is_fixed_into_the") + "</p>"
      + cs.field("ce-bias", "screen.case-editor.what_this_bias_means_for_this", { area: true, rec: true, value: heldBias, help: ["screen.case-editor.say_what_the_teams_declared_bias", "screen.case-editor.write_it_fresh_each_time_the"] })
      + '<p class="mk-note">' + cs.w("screen.ceremony.declared_bias_never_blocks_publishing") + " " + cs.w("screen.ceremony.if_your_team_declared_none") + "</p>",
    { help: "screen.ceremony.what_the_case_tells_its" }));

    // R4: the Photos step.
    out.push(P.sec(cs, "screen.ceremony.photos", !photos.length ? "" : '<p>' + cs.w("screen.ceremony.photos.copy") + "</p><p>" + cs.w("screen.ceremony.photos.gate") + "</p>"
      + (photos.map(function (ph, i) {
        const sha = ph.sha || ph.capture || "";
        const marks = P.later(cs, view, "marks:" + sha, "photomarks", { query: { capture: sha } });
        // The sentence of facts: with the local day the photo was taken when the Photos step answers one (`photosOf`'s `dated`,
        // case-disclosures R33), else without it.
        const when = typeof ph.dated === "string" ? ph.dated : "";
        const relied = (ph.relied_on_by || []).map(function (r) { return nameOf(r && (r.target || r.member) || ""); }).filter(Boolean).join(", ");
        const facts = when ? cs.w("screen.ceremony.photo.facts.dated", { by: ph.taken_by || "", date: { html: cs.date(when) }, findings: relied })
          : cs.w("screen.ceremony.photo.facts", { by: ph.taken_by || "", findings: relied });
        return '<div class="cs-sheet" data-photo="' + cs.esc(sha) + '"><p><b>' + cs.w("screen.ceremony.photo.name", { n: String(i + 1) }) + "</b> "
          + '<span class="id">' + cs.esc(String(sha).slice(0, 12)) + "</span>" + (facts ? " · " + facts : "") + "</p>"
          + (ph.refused || ph.words === "photo.refused.format" ? '<p role="alert">' + cs.w("screen.ceremony.photo.format") + "</p>" : "")
          + cs.state(marks, function (m) {
            return '<p data-photo-state="' + cs.esc(m.state || "") + '">' + cs.w("screen.ceremony.photo.state." + (m.state === "marked" ? "marked" : m.state === "nothing_to_obscure" ? "nothing" : "unchecked")) + "</p>"
              + (m.marks || []).map(function (x) {
                const areas = (x.areas || []).map(function (a) { return cs.w("screen.ceremony.area." + (a.kind === "plate" ? "plate" : a.kind === "staff" ? "staff" : "person")); }).join(", ");
                return cs.row("", cs.w(x.withdrawn ? "screen.ceremony.mark.withdrawn" : "screen.ceremony.mark.standing", { n: String(x.mark), areas: { html: areas || cs.w("screen.ceremony.area.none") } })
                  + (x.withdrawn ? ' <span class="rec">' + cs.esc(x.withdrawn.reason || "") + "</span>" : ""), "",
                  x.withdrawn ? "" : cs.field("ce-wd-" + i + "-" + x.mark, "screen.ceremony.withdraw.reason", { area: true })
                    + cs.act("obscuremarkwithdraw", { data: { capture: sha, mark: String(x.mark), field: "ce-wd-" + i + "-" + x.mark } }));
              }).join("");
          })
          // R4 (K3147, K3150): the member draws the areas on the photo itself (interface-shell R49's `cs.image`, `cs.areas`,
          // the original read as `open-file` reads it), then names what they cover.
          + cs.areas(cs.image("openoriginal", { capture: sha }, { alt: { key: "screen.ceremony.photo.name", fills: { n: String(i + 1) } } }),
            { id: "ce-areas-" + i, areas: [], label: "screen.ceremony.areas.label" })
          + '<fieldset class="cs-field"><legend>' + cs.w("screen.ceremony.areas.legend") + "</legend>"
          + cs.choice("ce-kind-" + i, "screen.ceremony.area.kind", [["person", "screen.ceremony.area.person"], ["plate", "screen.ceremony.area.plate"], ["staff", "screen.ceremony.area.staff"]])

          + cs.field("ce-staff-" + i, "screen.ceremony.area.reason", { area: true, help: "screen.ceremony.area.reason.help" }) + "</fieldset>"
          + '<div class="mk-acts">' + cs.act("obscuremark", { data: { capture: sha, index: String(i) } })
          + cs.act("obscuremark", { label: "screen.ceremony.photo.nothing", data: { capture: sha, index: String(i), nothing: "1" } }) + "</div></div>";
      }).join("") + P.said(view, "obscure"))));

    // R5: the Ties step: the member's own confirmation of no undeclared tie, sent with `publish` as `tieAttested`.
    out.push(cs.sec("screen.ceremony.ties", cs.checks("ce-tie", "screen.ceremony.ties.legend", [["yes", "screen.ceremony.ties.confirm", false]])
      + '<div class="mk-acts">' + cs.act("publish", { tone: "primary", here: "ceremony" }) + "</div><p class=\"muted\">" + cs.w("screen.ceremony.ties.part") + "</p>"
      + P.said(view, "publish") + (prepared ? '<p class="mk-note" role="status">' + cs.w("screen.ceremony.prepared", { edition: String(prepared.edition) }) + "</p>" : "")));

    // R42 (N880; DEC-340; case-authoring R34, R77; case-inputs R8, R19): beside "When it becomes public", the open requests for
    // comment and the minutes beside the team's public comment, each drawn once from the sign step, by the keys its rows carry
    // and the dates in the design's words; no reason asked, no gate, nothing sent. A section that holds nothing is not drawn (R20).
    if (!published && !waiting && !(ui.signed && ui.signed.at)) {
      const asked = signStep.open_requests;
      const rows = Array.isArray(asked) ? asked : asked && Array.isArray(asked.lines) ? asked.lines : [];
      const day = function (d) { return { html: d ? cs.date(d) : "" }; };
      if (rows.length) out.push(cs.sec("screen.ceremony.openrequests.heading", cs.sheet(rows.map(function (r) {
        const key = String(r && r.key || "");
        if (key.indexOf("signing.openrequest.") !== 0) return "";
        const a = r.answers && typeof r.answers === "object" ? r.answers : {};
        return cs.row("", cs.w(key, { whom: r.whom || "", asked_at: day(r.asked_at), window_closes: day(r.window_closes),
          answered: String(a.answered === undefined ? "" : a.answered), claims: String(a.claims === undefined ? "" : a.claims) }), "",
        r.quotable === false ? cs.w("signing.openrequest.noquote", { whom: r.whom || "" }) : "");
      }).join("")), { help: "screen.ceremony.openrequests.says" }));
      else if (asked && !Array.isArray(asked) && asked.undetermined) out.push(cs.sec("screen.ceremony.openrequests.heading", '<p class="mk-note" data-open-unread>' + cs.w("signing.openrequest.unread") + "</p>"));
      const mins = signStep.minutes;
      if (Array.isArray(mins) && mins.length) out.push(cs.sec("screen.ceremony.minutes.heading", mins.map(function (r) {
        return '<p class="mk-note">' + cs.w("signing.minutes.line", { meeting: r.meeting || "", date: day(r.date) }) + '</p><div class="mk-grid2"><div><b>' + cs.w("signing.minutes.left")
          + '</b><p class="rec">' + cs.esc(r.minutes || "") + "</p></div><div><b>" + cs.w("signing.minutes.right") + '</b><p class="rec">' + cs.esc(r.filed || "")
          + '</p></div></div><p class="mk-note">' + cs.w(r.same === true ? "signing.minutes.same" : "signing.minutes.differs") + "</p>";
      }).join(""), { help: "screen.ceremony.minutes.says" }));
      else if (mins && !Array.isArray(mins) && mins.undetermined && !(asked && !Array.isArray(asked) && asked.read === false && !asked.undetermined)) out.push(cs.sec("screen.ceremony.minutes.heading", '<p class="mk-note" data-minutes-unread>' + cs.w("signing.minutes.unread") + "</p>", { help: "screen.ceremony.minutes.says" }));
    }

    // R12–R15: the Sign step, offered only once `publish` has answered (R5's control); at the phone width it says where
    // signing finishes (R15; DEC-181), the kit drawing a signed act there as what it does, never sent.
    const phone = /data-phone-act/.test(cs.act("caseratify"));
    if ((prepared || phone) && !published && !waiting && !(ui.signed && ui.signed.at)) {
      const doc = prepared && !phone ? P.later(cs, view, "document", "casedocument", { query: { case: prepared.caseId, edition: String(prepared.edition) } }) : null;
      const pa = signStep && signStep.publish_at && typeof signStep.publish_at === "object" ? signStep.publish_at : null;
      const zone = pa ? pa.zone || pa.time_zone || "" : "";
      // G11 (fix round 6): a publishing time is offered only where the op offers it (`publish_at.offered`, with the zone it is counted in);
      // only "Sign and publish now" is drawn otherwise
      const timed = pre.state === "ok" && !!pa && pa.offered !== false && !!zone;
      const untimed = pre.state === "ok" && !timed;
      // G62 (fix round 7): three answers offer no time and are told apart: no zone held (`offered: false`, the offer's own `reason`); no
      // offer because the signing check was not reached or did not say (`publish_at: null`, `ratification.reached`, which
      // case-authoring's `publish_at_stated` words); an offer that names no zone. Stand-ins until the design words the third (row owed:
      // `screen.ceremony.when.nozonestated`): the op's own held sentence for the check that did not say.
      const rat = signStep && signStep.ratification && typeof signStep.ratification === "object" ? signStep.ratification : null;
      const why = !pa ? (rat && rat.reached === false ? "notreached" : "unanswered") : pa.offered === false ? "nozone" : "nozonestated";
      const noTime = why === "nozone" ? P.refusalText(cs, { code: typeof pa.reason === "string" && pa.reason ? pa.reason : "PUBLISH_AT_NO_ZONE" })
        : cs.w(why === "notreached" ? "case-authoring.publish_at_not_reached_sentence" : "case-authoring.publish_at_unanswered_sentence");
      // R70: preparing publishes nothing; the Sign step is the one that says publishing makes the edition permanent
      let sign = '<p class="mk-sub">' + cs.w("screen.ceremony.permanent") + "</p>"
        + '<p class="mk-explain">' + cs.w("signing.ceremony.who", { signer: (view.me && view.me.handle) || "", project: projectTitle, group: groupName }) + "</p>";
      if (phone) sign += '<p role="status" data-phone>' + cs.w("signing.ceremony.phone", { project: projectTitle }) + "</p>";
      else {
        sign += (timed ? '<fieldset class="cs-field"><legend>' + cs.w("screen.ceremony.when") + "</legend>"
          + '<p class="help">' + cs.w("screen.ceremony.when.help", { zone: zone }) + "</p>"
          + cs.field("ce-date", "screen.ceremony.when.date", { type: "date" }) + cs.field("ce-time", "screen.ceremony.when.time", { type: "time" }) + "</fieldset>"
          : untimed ? '<p class="mk-note" role="status" data-publish-at-none="' + why + '"' + (pa && typeof pa.source === "string" ? ' data-source="' + cs.esc(pa.source) + '"' : "") + (pa && typeof pa.why === "string" ? ' data-why="' + cs.esc(pa.why) + '"' : "") + ">" + noTime + "</p>" : "")
          + cs.state(doc, function (d) {
            const list = P.sitting(d, prepared) || [];
            // E4 (fix round 5, C48): said before the press as well: the page could not read what the edition pins
            const gap = P.sittingGap(d, list, found.length);
            // C47: what the signature covers is counted; a document the case rests on that is not published with it is said, not
            // counted as nothing (public-read R39)
            const evidence = list.filter(function (x) { return x.kind === "evidence"; }).length, named = P.unsignable(d, prepared).length, nameList = P.unsignable(d, prepared);
            return '<details data-statements><summary>' + cs.w("screen.ceremony.signs.exactly") + "</summary><ul class=\"mk-list\">"
              + list.map(function (x) {
                return '<li data-statement="' + x.kind + '"><span class="id">' + cs.esc(x.text.trim()) + "</span> · " + cs.w("screen.ceremony.signs." + x.kind, { id: x.id, edition: String(x.edition === undefined ? "" : x.edition), case: x.id }) + "</li>";
              }).join("") + "</ul></details>" + (gap ? '<p role="alert" data-roster-unread>' + cs.w("screen.ceremony.sign.nodoc") + "</p>" : "") + "<p>" + (evidence > 0 ? cs.w("screen.ceremony.signs.count", { n: String(list.length),
                findings: String(list.filter(function (x) { return x.kind === "finding"; }).length), evidence: String(evidence) })
                : cs.w("screen.ceremony.signs.count.findings", { n: String(list.length), findings: String(list.filter(function (x) { return x.kind === "finding"; }).length) })) + "</p>"
              + (named === 1 ? '<p class="mk-note" data-unpublished="1">' + cs.w("screen.published.rests.on.the.council.minutes.one") + "</p>"
                : named > 1 ? '<p class="mk-note" data-unpublished="' + named + '">' + cs.w("screen.published.rests.on.the.council.minutes", { count: String(named) }) + "</p>" : "")
              // G29: the documents that cannot be signed with the edition are named; the sentence is the nearest held row (row owed)
              + (named ? '<ul class="mk-list" data-unsignable>' + nameList.map(function (t) { return '<li><span class="id">' + cs.esc(t) + "</span></li>"; }).join("") + "</ul>" : "");
          })
          // R72 (fix round 3, C51): with no signing key in this browser, the key file the member made earlier is chosen here and loaded for
          // the sitting (`cs.keyFile`); a device that holds a key is not asked for one
          + (ui.keyHeld === false ? cs.field("ce-keyfile", "shell.signer.loadfile", { type: "file", help: "shell.signer.load",
            typing: function (cs2) { cs2.keyFile("ce-keyfile").then(function (k) { cs2.set("keyFileChosen", !!k.ok); }); } }) : "")
          // R12 (K3147, K3150): one button that follows the choice of when (interface-shell R49's `cs.choice` with `acts`).
          + '<div class="mk-acts">' + (timed ? cs.choice("ce-when", "screen.ceremony.when", [["now", "screen.ceremony.when.now"], ["at", "screen.ceremony.when.at"]],
            { acts: { now: "caseratify", at: "publishat" }, act: { tone: "primary", icon: "signed" } }) : cs.act("caseratify", { tone: "primary", icon: "signed" })) + "</div>"
          + '<p class="muted">' + cs.w("screen.ceremony.device.next") + "</p>";
      }
      // R45 (C4): the making of a signing key is offered as soon as the step is drawn when this browser holds none
      if (ui.keyHeld === undefined && !ui.keyAsked) { ui.keyAsked = true; cs.signer.held().then(function (h) { cs.set("keyHeld", !!(h && h.held)); }, function () { cs.set("keyHeld", true); }); }
      if (ui.nokey || (ui.keyHeld === false && !ui.keyFileChosen)) sign += '<div class="cs-dialog" data-nokey><p>' + cs.w("signing.ceremony.nokey") + "</p>"
        + cs.checks("ce-keep", "screen.ceremony.keep.legend", [["keep", "signing.ceremony.keepkey", false]])
        + '<div class="mk-acts">' + cs.act("signerregisterown", { tone: "primary" }) + "</div>" + P.said(view, "register") + "</div>";
      if (ui.notowner) sign += '<div class="cs-dialog" data-notowner><p>' + cs.w("signing.ceremony.notowner", { project: projectTitle, owners: ui.notowner.owners || "" }) + "</p>"
        + '<div class="mk-acts">' + cs.act("signrequest") + "</div>" + P.said(view, "signrequest") + "</div>";
      out.push(cs.sec("screen.ceremony.sign", sign + P.said(view, "sign")));
    }

    // R14: signed and waiting, with "Move the time" and "Cancel publishing"; or signed and published, with its page.
    if (waiting || (ui.signed && ui.signed.at)) {
      const w = waiting || {};
      const at = w.at || ui.signed.at || {};
      out.push(cs.sec("screen.ceremony.signed", '<p role="status" data-signed="at">' + cs.w("signing.ceremony.signedat", {
        edition: String(w.edition || (prepared && prepared.edition) || ""), date: { html: at.date ? cs.date(at.date) : "" }, time: { html: P.clock(cs, at.time) }, zone: at.zone || "" }) + "</p>"
        + cs.field("ce-move-date", "screen.ceremony.when.date", { type: "date" }) + cs.field("ce-move-time", "screen.ceremony.when.time", { type: "time" })
        + '<div class="mk-acts">' + cs.act("publishatmove", { data: { case: String(w.case || caseId || ""), edition: String(w.edition || (prepared && prepared.edition) || "") } })
        + cs.act("publishatcancel", { data: { case: String(w.case || caseId || ""), edition: String(w.edition || (prepared && prepared.edition) || "") } }) + "</div>"
        + P.said(view, "moved")));
    } else if (published) {
      out.push(cs.sec("screen.ceremony.signed", '<p role="status" data-signed="now">' + cs.w("signing.ceremony.signednow", { edition: String(published.edition || "") }) + "</p>"
        + '<a href="/app/published/' + encodeURIComponent(String(published.case || caseId || "")) + '" data-nav>' + cs.w("screen.ceremony.publicpage") + "</a>"));
    }
    if (sched && sched.state !== "ok" && sched.state !== "empty") out.push(cs.state(sched, function () { return ""; }));
    return out.join("");
  },

  acts: [
    {
      // C49: "Which draft": the project's drafts read once more, and the ceremony opened on the one chosen (`pickDraft`).
      op: "casedrafts", label: "act.casedrafts.label.ceremony", rereads: [],
      send: function (view, el, cs) {
        view.ui.pickDraft = String(cs.value("drafts-ceremony") || "");
        return { query: { project: String(view.subject || "").split("/")[0] } };
      },
      done: function (view, answer, cs) { return view.parts.pickDraft(view, answer, cs, "ceremony"); },
    },
    {
      // R3: "Check again": the checks read once more.
      op: "publishpreflight", label: "act.publishpreflight.label.ceremony", rereads: [],
      send: function (view, el, cs) {
        const copy = view.parts.copyOf(view);
        if (!copy) return null;
        const at = view.parts.attested(view, cs);
        if (at.refuse) return { refuse: at.refuse };
        view.ui.attested = at.held; view.ui.attestedBody = at.body;
        return { body: Object.assign(view.parts.caseArgs(copy, view.ui.draftId || ""), at.body, view.ui.prepared ? { tieAttested: true } : {}) };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "publishpreflight", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R3: "See everything that will be disclosed".
      op: "publishtensions", label: "act.publishtensions.label.ceremony", rereads: [],
      send: function (view) {
        const copy = view.parts.copyOf(view);
        if (!copy) return null;
        return { body: { project: copy.project, draft: view.ui.draftId || "" } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "publishtensions", answer)) return { stay: true }; // D29
        view.ui.allTensions = view.parts.value(answer);
        return { stay: true };
      },
    },
    {
      // R57: "See the details of this work": the four details, read again; the ceremony only lists them.
      op: "casedetails", label: "act.owed_casedetails.label.ceremony", rereads: [],
      send: function (view) { const copy = view.parts.copyOf(view); const c = copy && copy.case; return c && c.case_id ? { query: { case: c.case_id } } : null; },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "casedetails", answer)) view.parts.forget(view); return { stay: true }; }, // D29
    },
    {
      // R51 (C6; DEC-377): "Ask for the confirmation again": a document held without a second confirmation is timestamped and archived
      // once more; the answer shows only that it existed by then.
      op: "reattest", label: "act.reattest.label.ceremony", rereads: [],
      send: function (view, el) { return { body: { captureSha: el.dataset.capture } }; },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "reattest", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R51 (C6): the capturing member's own signed account of the capture (`bio-capture-account`, signed in `bio-ratify`), through
      // the signer the way the sign step signs.
      op: "captureaccount", label: "act.captureaccount.label.ceremony", rereads: [],
      send: async function (view, el, cs) {
        const sha = el.dataset.capture, text = String(cs.value("ce-cap-" + el.dataset.index) || "").trim();
        if (!text) return { refuse: "refusal.ACCOUNT_NO_TEXT" };
        const signed = await cs.signer.sign([{ label: "capture " + sha, bytes: view.parts.bytes("bio-capture-account " + sha + "\n" + text), namespace: "bio-ratify" }]);
        if (!signed || signed.ok !== true || !Array.isArray(signed.signatures) || signed.signatures.length !== 1) return { refuse: "signing.ceremony.declined" };
        return { body: { captureSha: sha, text: text, signature: signed.signatures[0] } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "captureaccount", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R4: the areas the member marks on a photo (a person not part of a finding, a number plate, city staff at work
      // with a reason), or "nothing to obscure" (`areas: []`).
      op: "obscuremark", label: "act.obscuremark.label.ceremony", rereads: [],
      send: function (view, el, cs) {
        const i = el.dataset.index;
        if (el.dataset.nothing === "1") return { query: { capture: el.dataset.capture }, body: { areas: [] } };
        const kind = String(cs.value("ce-kind-" + i) || "person");
        const reason = String(cs.value("ce-staff-" + i) || "").trim();
        if (kind === "staff" && !reason) return { refuse: "screen.ceremony.area.reason.needed" };
        const named = function (rect) { const a = { rect: rect, kind: kind }; if (kind === "staff") a.reason = reason; return a; };
        // interface-shell R49: the rectangles drawn on the photo, `[{left, top, width, height}]` in its pixels, each named by
        // the kind chosen, sent as case-carriage's `{rect: [x0, y0, x1, y1], kind, reason?}`.
        const drawnAreas = cs.value("ce-areas-" + i);
        const list = (Array.isArray(drawnAreas) ? drawnAreas : []).filter(function (r) { return r && r.width >= 1 && r.height >= 1; });
        if (!list.length) return { refuse: "screen.ceremony.areas.needed" };
        return { query: { capture: el.dataset.capture }, body: { areas: list.map(function (r) {
          return named([Math.round(r.left), Math.round(r.top), Math.round(r.left + r.width), Math.round(r.top + r.height)]); }) } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "obscure", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R4: a mark withdrawn with a reason, never erased.
      op: "obscuremarkwithdraw", label: "act.obscuremarkwithdraw.label.ceremony", rereads: [], reasonField: "reason",
      send: function (view, el, cs) {
        return { query: { capture: el.dataset.capture }, body: { mark: Number(el.dataset.mark), reason: String(cs.value(el.dataset.field) || "").trim() } };
      },
      done: function (view, answer, cs) { if (!view.parts.refused(cs, view, "obscure", answer)) view.parts.forget(view); }, // D29
    },
    {
      // R5: the Ties step's confirmation prepares the edition for signing: `publish` with `tieAttested: true`.
      op: "publish", label: "act.publish.label.ceremony", rereads: ["copy", "drafts"],
      // D-M5 (1): a refusal in form leaves the stops to be read again too, as a refusal inside a success does (`done`)
      failed: function (view, answer, cs) {
        const f = answer && answer.fields && typeof answer.fields === "object" ? answer.fields : { code: answer && answer.code };
        view.parts.say(cs, view, "stops", view.parts.refusalText(cs, f) || cs.w("shell.noanswer"), false);
        view.parts.forget(view);
        cs.set("later", view.ui.later);
      },
      send: function (view, el, cs) {
        const copy = view.parts.copyOf(view);
        if (!copy) return null;
        view.parts.unsay(cs, view, "stops");
        const tick = cs.value("ce-tie");
        if (!(Array.isArray(tick) ? tick.includes("yes") : tick === true)) return { refuse: "screen.ceremony.ties.needed" };
        const at = view.parts.attested(view, cs);
        if (at.refuse) return { refuse: at.refuse };
        view.ui.attested = at.held; view.ui.attestedBody = at.body;
        return { body: Object.assign(view.parts.caseArgs(copy, view.ui.draftId || ""), at.body, { tieAttested: true }) };
      },
      done: function (view, answer, cs) {
        // D29: nothing is prepared on a refusal; D-M5 (1): the stops are read again, so the list at the top is the one the plane now holds
        if (view.parts.refused(cs, view, "publish", answer)) {
          view.parts.say(cs, view, "stops", view.parts.refusalText(cs, view.parts.carried(answer)), false);
          view.parts.forget(view);
          return;
        }
        const r = view.parts.value(answer) || {};
        view.ui.prepared = { caseId: r.caseId, edition: r.edition, docSha: r.caseDocument ? r.caseDocument.doc_sha : null,
          findings: (Array.isArray(r.findings) ? r.findings : r.target ? [{ target: r.target, bundleSha: r.bundleSha }] : [])
            .map(function (f) { return { target: f.target, bundleSha: f.bundleSha }; }) };
        view.ui.nokey = false; view.ui.notowner = null;
        view.parts.forget(view);
      },
    },
    {
      // R12, R13: "Sign and publish now": one sitting over every statement listed, sent as one `caseratify`.
      op: "caseratify", label: "act.caseratify.label.ceremony", rereads: ["copy", "drafts"],
      refusals: {
        NO_ATTESTING_KEY: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        NO_SIGNERS: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        SIG_UNKNOWN_KEY: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        CASE_SIGNER_NOT_AN_OWNER: function (r, cs) {
          cs.set("notowner", { owners: Array.isArray(r.owners) ? r.owners.join(", ") : String(r.owners || "") });
          return cs.w("screen.ceremony.refused.notowner");
        },
        GATE_REFUSED: GATE_REFUSED, // G60
      },
      send: async function (view, el, cs) {
        const P = view.parts, pr = view.ui.prepared;
        if (!pr) return null;
        const a = await cs.call("casedocument", { query: { case: pr.caseId, edition: String(pr.edition) } });
        const doc = P.value(a);
        const list = doc && doc.ok !== false ? P.sitting(doc, pr) : null;
        if (!list) return { refuse: "screen.ceremony.sign.nodoc" };
        // E4 (fix round 5, C48): fail closed: a sitting that lists fewer findings than the draft names or the document pins signs nothing
        if (P.sittingGap(doc, list, P.findingsOf(P.copyOf(view)).length)) return { refuse: "screen.ceremony.sign.nodoc" };
        const sat = await P.sitSign(cs, view, list.map(function (x) { return { label: x.kind + " " + x.id + ": ", bytes: P.bytes(x.text), namespace: x.namespace }; }));
        if (sat.refuse) return { refuse: sat.refuse };
        const signed = sat.signed;
        if (!signed || signed.ok !== true || !Array.isArray(signed.signatures) || signed.signatures.length !== list.length) return { refuse: "signing.ceremony.declined" };
        return { body: { caseId: pr.caseId, edition: Number(pr.edition), expectedSha: doc.doc_sha, sig: signed.signatures[0],
          members: list.slice(1).map(function (x, i) { return { id: x.id, sha: x.sha, signature: signed.signatures[i + 1] }; }) } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "sign", answer)) return; // D29: nothing is drawn signed on a refusal
        const r = view.parts.value(answer) || {};
        view.ui.signed = { now: true, case: r.caseId, edition: r.edition, sitting: Array.isArray(r.sitting) ? r.sitting : [] };
        view.parts.forget(view);
      },
    },
    {
      // R12, R13: "Sign now and publish at <time>": the same sitting, the edition held until then.
      op: "publishat", label: "act.publishat.label.ceremony", rereads: ["copy", "drafts"],
      refusals: {
        NO_ATTESTING_KEY: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        NO_SIGNERS: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        SIG_UNKNOWN_KEY: function (r, cs) { cs.set("nokey", true); return cs.w("screen.ceremony.refused.nokey"); },
        CASE_SIGNER_NOT_AN_OWNER: function (r, cs) {
          cs.set("notowner", { owners: Array.isArray(r.owners) ? r.owners.join(", ") : String(r.owners || "") });
          return cs.w("screen.ceremony.refused.notowner");
        },
        GATE_REFUSED: GATE_REFUSED, // G60
      },
      send: async function (view, el, cs) {
        const P = view.parts, pr = view.ui.prepared;
        if (!pr) return null;
        const at = P.at(cs.value("ce-date"), cs.value("ce-time"));
        if (!at) return { refuse: "screen.ceremony.when.needed" };
        const a = await cs.call("casedocument", { query: { case: pr.caseId, edition: String(pr.edition) } });
        const doc = P.value(a);
        const list = doc && doc.ok !== false ? P.sitting(doc, pr) : null;
        if (!list) return { refuse: "screen.ceremony.sign.nodoc" };
        // E4 (fix round 5, C48): fail closed: a sitting that lists fewer findings than the draft names or the document pins signs nothing
        if (P.sittingGap(doc, list, P.findingsOf(P.copyOf(view)).length)) return { refuse: "screen.ceremony.sign.nodoc" };
        const sat = await P.sitSign(cs, view, list.map(function (x) { return { label: x.kind + " " + x.id + ": ", bytes: P.bytes(x.text), namespace: x.namespace }; }));
        if (sat.refuse) return { refuse: sat.refuse };
        const signed = sat.signed;
        if (!signed || signed.ok !== true || !Array.isArray(signed.signatures) || signed.signatures.length !== list.length) return { refuse: "signing.ceremony.declined" };
        return { body: { caseId: pr.caseId, edition: Number(pr.edition), expectedSha: doc.doc_sha, sig: signed.signatures[0], at: at,
          members: list.slice(1).map(function (x, i) { return { id: x.id, sha: x.sha, signature: signed.signatures[i + 1] }; }) } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "sign", answer)) return; // D29
        const r = view.parts.value(answer) || {};
        view.ui.signed = { at: r.at || {}, case: r.case, edition: r.edition };
        view.parts.forget(view);
      },
    },
    {
      // R15: no signing key in this browser: one made on this device by the signer kit, kept only when the member ticks.
      op: "signerregisterown", label: "act.signerregisterown.label.ceremony", rereads: [],
      send: async function (view, el, cs) {
        const tick = cs.value("ce-keep");
        const keep = Array.isArray(tick) ? tick.includes("keep") : tick === true;
        // R72 (fix round 3, C51): the member is told the key is being made and registered, until the work ends
        view.parts.say(cs, view, "register", cs.w("screen.ceremony.registering"));
        // R72 (fix round 2, C51): the key this browser already holds for the member (kept, or loaded for this sitting) is the one
        // registered; a new one is made only when none is held
        const had = await cs.signer.held();
        if (had && had.held === true && typeof had.keyB64 === "string") return { body: { keyB64: had.keyB64 } };
        const k = await cs.signer.register({ keep: keep });
        if (!k || k.ok !== true || typeof k.keyB64 !== "string") { view.parts.unsay(cs, view, "register"); return { refuse: "signing.ceremony.declined" }; }
        return { body: { keyB64: k.keyB64 } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "sign", answer)) { view.parts.unsay(cs, view, "register"); return; } // D29
        view.ui.nokey = false; view.ui.keyHeld = true;
        view.parts.say(cs, view, "sign", cs.w("screen.ceremony.registered"));
      },
    },
    {
      // R15: a member who is not an owner asks the owners to sign (tasks R19).
      op: "signrequest", label: "act.signrequest.label.ceremony", rereads: [],
      send: function (view) { const pr = view.ui.prepared; return pr ? { body: { case: pr.caseId, edition: Number(pr.edition) } } : null; },
      done: function (view, answer, cs) {
        if (!view.parts.refused(cs, view, "signrequest", answer)) view.parts.say(cs, view, "signrequest", cs.w("screen.ceremony.asked")); // D29
        return { stay: true };
      },
    },
    {
      // R14: "Move the time".
      op: "publishatmove", label: "act.publishatmove.label.ceremony", rereads: ["copy", "drafts"],
      send: function (view, el, cs) {
        const at = view.parts.at(cs.value("ce-move-date"), cs.value("ce-move-time"));
        if (!at) return { refuse: "screen.ceremony.when.needed" };
        return { body: { case: el.dataset.case, edition: Number(el.dataset.edition), at: at } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "moved", answer)) return; // D29
        view.ui.signed = null;
        view.parts.forget(view);
      },
    },
    {
      // R14: "Cancel publishing".
      op: "publishatcancel", label: "act.publishatcancel.label.ceremony", rereads: ["copy", "drafts"],
      send: function (view, el) { return { body: { case: el.dataset.case, edition: Number(el.dataset.edition) } }; },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "moved", answer)) return; // D29
        view.ui.signed = null;
        view.ui.prepared = null;
        view.parts.forget(view);
      },
    },
  ],
});
