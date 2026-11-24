/* screens-investigate R2: exploring connections from a person or organisation (People › Person › Explore connections;
 * registry screen `explore`, its 5 acts; K1469, K1486, K1487). The member ticks the kinds to follow (the composed
 * vocabulary's `connection_kinds`, by their words), an optional end, and the day it is explored as of (never "now");
 * `explore` answers the chains, each drawn hop by hop, every hop a reference with its cited source, the chain's grade its
 * weakest hop's. A step declared and not evidenced is a lead, never a finding. No score, rank or "most connected". */

import { PARTS } from "./parts.mjs";
import { GRAPH_SHARED, FORM_SHARED } from "./graphwords.mjs";
import { WHY_KEYS } from "./whywords.mjs";

const S = "screen.explore.";

function reads() {
  const S = "screen.explore.";
  return {
    vocab: { op: "affordances", query: {}, empty: (v) => !v || !v.vocabularies || !v.vocabularies.connection_kinds
      || !Array.isArray(v.vocabularies.connection_kinds.values) || !v.vocabularies.connection_kinds.values.length },
    people: { op: "peopledirectory", query: { limit: "200" } },
    presets: { op: "explorepreset", body: { preset: "presets" }, empty: (v) => !Array.isArray(v) || !v.length },
    /* R34 (K5148): the viewer's visible documents, for the form that attaches a source to a declared step */
    docs: { op: "heldcaptures", query: { limit: "200", state: "held_and_vouched", fields: "picker" }, empty: (v) => !v || !Array.isArray(v.held) || !v.held.length },
  };
}

function render(cs, view) {
  const S = "screen.explore.";
  const P = view.parts;
  const from = String(view.subject || "");
  const ui = view.ui;
  const out = [cs.title()];
  /* R29: opened with no centre, the screen says where to start and asks the plane nothing (never the plane's refusal) */
  if (!from.trim()) return out.join("") + `<p class="cs-state" data-state="empty">${cs.w(S + "nocentre")}</p>`;
  /* R35: the start is drawn by its name from the people the record follows, never by its id */
  const known = view.parts.options(view, "people", (v) => v.rows, (r) => ({ value: r.entity, text: r.name || "" }));
  const fromName = (known.find((o) => o.value === from) || {}).text || "";
  out.push(`<p class="mk-sub">${cs.w(S + "from")} ${P.refOf(cs, from, fromName || P.plain(cs, "connection.node.unnamed"), [])}</p>`);
  const vocab = view.data.vocab && view.data.vocab.state === "ok" ? view.data.vocab.value : null;
  const groupOf = (k) => P.groupMap(vocab)[k] || null;
  const wordOf = (k) => (vocab && vocab.vocabularies.connection_kinds.words[k] && vocab.vocabularies.connection_kinds.words[k].word) || k;
  const GROUPS = ["pos", "money", "part", "ment", "same", "step_source"];
  /* R24, R27: the design's six groups, the first three ticked; a group sends its kinds by the vocabulary's group for each */
  out.push(cs.sec(S + "follow", cs.state("vocab", view, () => {
    const on = Array.isArray(ui.groups) ? ui.groups : ["pos", "money", "part"];
    return cs.checks("explore-groups", S + "follow.legend", GROUPS.map((g) => [g, "connection.kind." + g + ".name", on.includes(g)]), {});
  }))
    + cs.choice("explore-to", S + "to", [{ value: "", text: cs.w(S + "to.any") }].concat(view.parts.options(view, "people", (v) => v.rows, (r) => ({ value: r.entity, text: r.name || r.entity }))), { value: ui.to || "" })
    + cs.field("explore-at", S + "at", { type: "date", value: ui.at || P.today(cs), help: S + "at.help" })
    + `<div class="mk-acts">${cs.act("explore", { label: "act.explore.label.explore", tone: "primary" })}</div>`
    + cs.state("presets", view, (list) => cs.choice("explore-preset", S + "preset", list.map((x) => ({ value: x.name, text: x.words || x.name })), { value: ui.preset || "" })
      + cs.act("explorepreset", { label: "act.explorepreset.label.explore" })));

  /* R18: the connection graph from the centre (the subject, or the node last pressed), as of the day explored, rings 2 */
  const centre = String(ui.centre || from);
  const at = ui.at || P.today(cs);
  const gk = Array.isArray(ui.graphKinds) ? ui.graphKinds : null;
  const gq = P.later(cs, view, "graph", "exploregraph", { body: Object.assign({ centre, at: { value: at, precision: "day", zone: "UTC" }, rings: 2 }, gk && gk.length ? { kinds: gk } : {}) });
  out.push(cs.sec(S + "graph", cs.state(gq, (g) => P.graph(cs, g, { idonly: P.idonlyMap(P.unnamedIds(g) ? P.later(cs, view, "idonly", "entityidonly", { query: { ids: P.unnamedIds(g) } }) : null), groupOf, trail: Array.isArray(ui.trail) && ui.trail.length ? ui.trail : [centre], act: "explore", names: fromName ? { [from]: fromName } : {}, words: { cited: S + "g.cited", declared: S + "g.declared", hunch: S + "g.hunch", nosource: S + "g.nosource", attached: S + "attached" } }))));

  /* the chains, as the last walk answered them */
  const a = ui.answer;
  if (ui.refusal) out.push(P.said(cs, ui.refusal));
  if (a) {
    const paths = Array.isArray(a.paths) ? a.paths : [];
    /* R43: a hop's ends are named (the people the record follows, else the graph's node labels); an end with no name is
       "an unnamed item", and says how many documents name it only by an identifier (`entityidonly`) */
    const graphNodes = gq.state === "ok" && gq.value && Array.isArray(gq.value.nodes) ? gq.value.nodes : [];
    const nameOfEnd = (id) => String((known.find((o) => o.value === id) || {}).text || (graphNodes.find((n) => n.id === id) || {}).label || "").trim();
    const endIds = [...new Set(paths.flatMap((x) => (x.hops || []).flatMap((h) => [h.from, h.to])).filter((id) => /^ENT-/.test(String(id)) && !nameOfEnd(id)))].slice(0, 500);
    const idonly = P.idonlyMap(endIds.length ? P.later(cs, view, "idonlyChains", "entityidonly", { query: { ids: endIds.join(",") } }) : null);
    const endRef = (id) => ({ html: P.refOf(cs, id, nameOfEnd(id) || P.plain(cs, S + "hop.unnamed"), []) });
    const unnamedEnds = (h) => [h.from, h.to].filter((id) => !nameOfEnd(id)).map((id) => `<span class="mk-small" data-unnamed="${cs.esc(id)}">${cs.w("connection.node.unnamed")}`
      + (idonly[id] ? ` · ${cs.w(S + "unnamed.why", { n: String(idonly[id]) })}` : "") + "</span>").join(" ");
    const hopLine = (h, path) => {
      const ev = Array.isArray(h.evidence) ? h.evidence : [];
      const src = ev.map((e) => {
        const s = String(e.source || "");
        if (e.capture_sha) return P.refOf(cs, e.capture_sha, cs.w(S + "cited"), [e.extent && e.extent.page !== undefined ? cs.w(S + "page", { page: String(Number(e.extent.page) + 1) }) : ""], "capture");
        if (/^capture:/.test(s)) return P.refOf(cs, s.slice(8), cs.w(S + "cited"), [e.extent && e.extent.page !== undefined ? cs.w(S + "page", { page: String(Number(e.extent.page) + 1) }) : ""], "capture");
        if (/^testimony:/.test(s)) return `<span class="mk-small">${cs.w(S + "testimony")}</span>`;
        return s ? `<span class="mk-small">${cs.esc(s)}</span>` : "";
      }).join(" ");
      const mark = (path.marks || []).find((m) => m.hop === h.id);
      const declared = h.label === "declared, not evidenced" || (mark && mark.mark === "declared, not evidenced");
      const hunch = h.label === "hunch" || (mark && mark.mark === "hunch");
      /* R17: a declared step backed by a standing attached source is evidenced at the capture's grade */
      const attached = h.kind === "step_source" || h.backs !== undefined;
      const g = h.grade && /^[A-D]$/.test(h.grade.assertion || "") ? cs.grade("connection", h.grade.assertion) : cs.mark("gap", "unrated");
      return `<li data-hop="${cs.esc(h.id)}">${cs.w(S + "hop", { from: endRef(h.from), to: endRef(h.to) })} <i>${cs.esc(wordOf(h.kind))}</i> ${unnamedEnds(h)} ${g} `
        + (declared ? `<b>${cs.w(S + "declared")}</b> ` + cs.act("stepsource", { label: "act.stepsource.label.explore", data: { relation: h.id } })
          : hunch ? cs.mark("hunch") : src || cs.mark("gap", "undetermined", { reason: cs.w(S + "nosource") }))
        + (attached ? ` <span class="mk-small" data-attached="${cs.esc(h.id)}">${cs.w(S + "attached", { by: P.who(cs, h.attached_by), date: cs.date(h.at || "") })}</span> ` : "")
        + (h.undetermined && h.undetermined.why ? ` ${cs.mark("gap", "undetermined")} <span class="mk-small">${P.why(cs, h.undetermined.why)}</span>` : "") + "</li>";
    };
    const chain = (path, i) => {
      const lead = path.label === "lead";
      const grade = path.grade && /^[A-D]$/.test(path.grade.assertion || "") ? cs.grade("connection", path.grade.assertion) : cs.mark("gap", "unrated");
      const v = ui.verified && ui.verified[i];
      return `<div class="mk-msg" data-chain="${i}">${grade} <span class="mk-small">${cs.w(lead ? S + "lead" : S + "evidenced")}</span>`
        + `<ol class="mk-list">${(path.hops || []).map((h) => hopLine(h, path)).join("")}</ol>`
        + (path.at_date === "undetermined" ? (path.undetermined && path.undetermined.why ? `${cs.mark("gap", "undetermined")} <span class="mk-small">${P.why(cs, path.undetermined.why)}</span>` : cs.mark("gap", "undetermined", { reason: cs.w(S + "atdate") })) : "")
        + `<div class="mk-acts">${cs.act("exploreverify", { label: "act.exploreverify.label.explore", data: { chain: String(i) } })}`
        + `${cs.act("promote", { label: "act.promote.label.explore", data: { chain: String(i) } })}</div>`
        + (v ? `<div class="mk-small" data-verified="${i}"><p>${cs.w(v.matches ? S + "verify.matches" : S + "verify.differs", { why: v.why || "" })}${v.lead ? " " + cs.w(S + "verify.lead") : ""}</p>`
          + `<ul>${(v.hops || []).map((x) => `<li>${cs.w(x.rederived === false ? S + "verify.cited" : x.matches === false ? S + "verify.hop.differs" : S + "verify.hop.holds")}</li>`).join("")}</ul></div>` : "")
        + "</div>";
    };
    out.push(paths.length ? cs.sec(S + "chains", cs.sheet(paths.map(chain).join("")) + `<p class="mk-small">${cs.w(S + "noscore")}</p>`, { fills: { n: String(paths.length) } })
      : `<p>${a.absence && a.absence.meaning ? cs.esc(a.absence.meaning) : cs.w(S + "nochains")}</p>`);
    /* a walk stopped at a bound or its depth says so: what lies beyond is undetermined, never absent (R22 there) */
    if (a.truncated || a.complete === false || a.depth_stopped === true)
      out.push(cs.mark("gap", "undetermined", { reason: a.why || cs.w(S + "stopped", { depth: String(a.depth || "") }) }));
  }
  if (ui.promoted) out.push(`<p class="mk-note">${cs.w(S + "promoted")}</p>`);
  /* R17: "Attach a source to a declared step": the passage that states it, and the member's words on what it shows */
  if (a && (a.paths || []).some((p) => (p.hops || []).some((h) => h.label === "declared, not evidenced" || (p.marks || []).some((m) => m.hop === h.id && m.mark === "declared, not evidenced"))))
    out.push(cs.sec(S + "assert.head", P.docChoice(cs, view, "explore-assert-doc", { passage: false, drive: true, newest: true }) + P.passagePick(cs, view, "explore-assert-doc", "explore-assert-passage", P.later)
      + cs.field("explore-assert-basis", S + "assert.basis", { area: true, rec: true })));
  return out.join("");
}

const acts = [
  { op: "explore", label: "act.explore.label.explore", rereads: [],
    send(view, el, cs) {
      /* R18: a node pressed becomes the centre of the graph, the centres kept as the trail (page memory only) */
      if (el && el.dataset && el.dataset.node) {
        const node = String(el.dataset.node);
        const t = Array.isArray(view.ui.trail) && view.ui.trail.length ? view.ui.trail : [String(view.ui.centre || view.subject || "")];
        const i = t.indexOf(node);
        view.ui.trail = i >= 0 ? t.slice(0, i + 1) : t.concat([node]);
        cs.set("centre", node);
        return null;
      }
      const at = String(cs.value("explore-at") || "").trim();
      const to = String(cs.value("explore-to") || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { refuse: "screen.explore.at.empty" };
      /* R24: each ticked group sends the kinds the vocabulary puts in it; no raw kind is chosen */
      const GROUPS = ["pos", "money", "part", "ment", "same", "step_source"];
      const on = GROUPS.filter((g, i) => cs.value("explore-groups-" + i) === true);
      if (!on.length) return { refuse: "screen.explore.groups.empty" };
      const v = view.data.vocab && view.data.vocab.state === "ok" ? view.data.vocab.value.vocabularies.connection_kinds : null;
      const kinds = v ? v.values.filter((k) => on.includes(v.words && v.words[k] && v.words[k].group)) : [];
      view.ui.groups = on;
      view.ui.graphKinds = kinds;
      view.ui.at = at;
      view.ui.to = to;
      const body = { from: String(view.subject || ""), at: { value: at, precision: "day", zone: "UTC" } };
      if (to) body.to = to;
      if (kinds.length) body.kinds = kinds;
      view.ui.lastWalk = { op: "explore", body };
      return { body };
    },
    done(view, answer, cs) {
    const r = answer && answer.result !== undefined ? answer.result : answer;
    if (r && typeof r.refused === "string") { view.ui.answer = null; cs.set("refusal", { code: r.refused, translation: r.why || null }); return { stay: true }; }
    view.ui.refusal = null; view.ui.verified = {};
    cs.set("answer", r);
    return { stay: true };
  } },
  { op: "explorepreset", label: "act.explorepreset.label.explore", rereads: [],
    send(view, el, cs) {
      const preset = String(cs.value("explore-preset") || "");
      const at = String(cs.value("explore-at") || "").trim();
      const to = String(cs.value("explore-to") || "").trim();
      if (!preset || !/^\d{4}-\d{2}-\d{2}$/.test(at)) return { refuse: "screen.explore.at.empty" };
      view.ui.preset = preset;
      const body = { preset, from: String(view.subject || ""), at: { value: at, precision: "day", zone: "UTC" } };
      if (to) body.to = to;
      if (preset === "overlaps") { body.a = body.from; body.b = to; delete body.from; delete body.to; }
      view.ui.lastWalk = { op: "explorepreset", body };
      return { body };
    },
    done(view, answer, cs) {
    const r = answer && answer.result !== undefined ? answer.result : answer;
    if (r && typeof r.refused === "string") { view.ui.answer = null; cs.set("refusal", { code: r.refused, translation: r.why || null }); return { stay: true }; }
    view.ui.refusal = null; view.ui.verified = {};
    cs.set("answer", r);
    return { stay: true };
  } },
  /* "Check this chain": the drawn path sent as `chain`; `matches`, `lead` and each hop's answer drawn (explore R23) */
  { op: "exploreverify", label: "act.exploreverify.label.explore",
    send(view, el, cs) {
      const i = Number(el.dataset.chain);
      const path = view.ui.answer && view.ui.answer.paths ? view.ui.answer.paths[i] : null;
      if (!path || !(path.hops || []).length) return null;
      const chain = path.hops.map((h) => (h.derived ? { kind: h.kind, from: h.from, to: h.to, as_of: h.derived.as_of, method: h.derived.method, id: h.id }
        : { id: h.id, kind: h.kind, owner: h.owner }));
      cs.call("exploreverify", { body: { chain } }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        const v = Object.assign({}, view.ui.verified || {});
        v[i] = { matches: !!(r && r.matches), lead: !!(r && r.lead), hops: (r && Array.isArray(r.hops)) ? r.hops : [], why: (r && (r.why || r.translation || r.code || r.reason)) || "" };
        cs.set("verified", v);
      });
      return null;
    } },
  /* R17 "Attach a source to a declared step": a passage the member chooses and her words on what it shows (connections R68) */
  { op: "stepsource", label: "act.stepsource.label.explore", reasonField: "basis",
    send(view, el, cs) {
      const relation = String((el && el.dataset && el.dataset.relation) || "");
      const at = view.parts.chosen(cs, "explore-assert-doc", "explore-assert-passage");
      const basis = String(cs.value("explore-assert-basis") || "").trim();
      if (!relation || !at || !basis) return { refuse: "screen.explore.assert.empty" };
      return { body: { relation, captureSha: at.captureSha, extent: at.extent, basis } };
    },
    done(view, answer, cs) {
    const w = view.ui.lastWalk;
    if (!w) return undefined;
    return cs.call(w.op, { body: w.body }).then((a) => {
      const r = a && a.result !== undefined ? a.result : a;
      if (a && a.ok !== false && r && typeof r.refused !== "string") { view.ui.verified = {}; cs.set("answer", r); }
    });
  } },
  /* "Open a question from this chain": a new inquiry whose question names the chain, opened at its screen */
  { op: "promote", label: "act.promote.label.explore",
    send(view, el, cs) {
      const i = Number(el.dataset.chain);
      const path = view.ui.answer && view.ui.answer.paths ? view.ui.answer.paths[i] : null;
      if (!path) return null;
      const steps = (path.hops || []).map((h) => h.from + " → " + h.kind + " → " + h.to).join("; ");
      const title = view.parts.plain(cs, "file.chain.title", { steps }).replace(/\s+/g, " ").slice(0, 120);
      const fail = (a) => { const r = a && a.result !== undefined ? a.result : a; cs.set("refusal", { code: (r && (r.code || r.reason)) || "", translation: (r && r.translation) || null }); };
      const clock = new Date(cs.now());
      cs.call("allocid", { query: { prefix: "INQ", year: String(clock.getUTCFullYear()) } }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        if (!r || !r.id) return fail(a);
        const id = r.id + "-chain";
        const now = clock.toISOString().split(".")[0] + "Z";
        const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(title),
          "current_state: open", "prior_state: null", "created: " + now, "last_updated: " + now,
          "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
          "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
          "surfaced_by: human", "recheck_triggers:", "  - text: " + view.parts.plain(cs, "file.recheck.chain"),
          "    description: " + view.parts.plain(cs, "file.recheck.chain.why"), "---", ""];
        ["## Question", "## What It Rests On", "## Conclusion", "## What Would Falsify This", "## Session Log", "## Review Notes"].forEach((h, k) => {
          lines.push(h, "");
          if (k === 0) lines.push(view.parts.plain(cs, "file.chain.question", { steps }), "");
          if (k === 1) lines.push(view.parts.plain(cs, "file.chain.rests", { at: (view.ui.at) || "", steps }), "");
        });
        const stamp = now.replace(/[-:]/g, "") + "_" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
        return cs.call("promote", { body: { bundleId: id, base: null, snapKey: stamp,
          meta: { object_type: "inquiry", title, current_state: "open", created: now, last_updated: now },
          files: [{ path: "bundle.md", text: lines.join("\n") }] } }).then((p) => {
          const pr = p && p.result !== undefined ? p.result : p;
          if (!p || p.ok === false || !pr || pr.ok === false) return fail(p);
          view.ui.promoted = id;
          cs.go("question", id);
        });
      }, () => fail(null));
      return null;
    } },
];

const EXPLORE_KEYS = [
  "screen.explore.g.cited", "screen.explore.g.declared", "screen.explore.g.hunch", "screen.explore.g.nosource", "screen.explore.from",
  "screen.explore.follow", "screen.explore.follow.holds", "screen.explore.follow.legend", "screen.explore.to", "screen.explore.to.any",
  "screen.explore.at", "screen.explore.at.help", "screen.explore.at.empty", "screen.explore.preset", "screen.explore.chains",
  "screen.explore.chains.holds", "screen.explore.lead", "screen.explore.evidenced", "screen.explore.declared", "screen.explore.cited",
  "screen.explore.page", "screen.explore.nosource", "screen.explore.atdate", "screen.explore.nochains",
  "screen.explore.noscore", "screen.explore.stopped", "screen.explore.verify.matches", "screen.explore.verify.differs", "screen.explore.promoted",
  "screen.explore.assert.head",
  "screen.explore.graph", "screen.explore.graph.holds", "screen.explore.groups.empty", "screen.explore.hop", "screen.explore.hop.unnamed",
  "screen.explore.hunch", "screen.explore.verify.lead", "screen.explore.verify.cited", "screen.explore.verify.hop.holds",
  "screen.explore.verify.hop.differs", "screen.explore.assert.basis", "screen.explore.assert.empty",
];

const words = ["screen.explore.name", "screen.explore.purpose",
  ...["explore", "explorepreset", "exploreverify", "stepsource", "promote"].flatMap((op) => ["act." + op + ".label.explore", "act." + op + ".does"]),
  ...GRAPH_SHARED, ...FORM_SHARED, ...WHY_KEYS,
  "file.chain.title", "file.chain.question", "file.chain.rests", "file.recheck.chain", "file.recheck.chain.why", "screen.explore.nocentre",
  "mark.scale.connection.name", "mark.scale.connection.means", "mark.grade.reading", "mark.hunch.means",
  "mark.gap.undetermined.name", "mark.gap.undetermined.means", "mark.gap.unrated.name", "mark.gap.unrated.means",
  "state.empty", "state.loading", "state.failed", ...EXPLORE_KEYS];

export const EXPLORE_SCREEN = Object.freeze({ id: "explore", reads, render, acts, words, parts: PARTS });
