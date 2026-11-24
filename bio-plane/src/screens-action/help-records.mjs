/* How a records request works (registry screen `help-records`; screens-action R9, R22; DEC-209 (5)), reached from `request`:
   what the office must do, the faster request where the group's places hold one (`profiles`' `view`), what a public
   portal shows, and what the group's Civicsmith does with the due date; its sources listed. No place is named in this
   screen's words (interface-shell R23): the laws and their windows are the profile's own, drawn as the record's data.
   R22: the sentences that state the law's duties are filled from the view's `records_help` block (`jurisdictions` R93);
   a sentence one of whose fills the block does not answer is not drawn, and a view with no block says so.
   Every function here is self-contained (interface-shell R21 (1)). */

import { chosenLawOf } from "./send-steps.mjs";

export const helpRecords = Object.freeze({
  id: "help-records",

  // C64-law: opened for an action (`/app/help-records/<action>`, from `request`), the help is for the law that action goes under
  reads: function (view) {
    const r = { profiles: { op: "profiles", empty: function () { return false; } } };
    if (/^ACTN-/.test(String(view.subject || ""))) r.action = { op: "action", query: { id: String(view.subject) }, empty: function () { return false; } };
    return r;
  },

  parts: { chosenLawOf: chosenLawOf },

  render: function (cs, view) {
    // R14: a section that holds nothing is not drawn: no law the profile names, no "faster" and no "sources".
    const held = function (p) {
      const v = p && p.view ? p.view : {};
      return (Array.isArray(v.deadlines) ? v.deadlines : []).filter(function (d) { return d && d.applies_to === "records_request" && d.citation; });
    };
    const pr = view.data.profiles;
    const none = pr && pr.state === "ok" && !held(pr.value).length;
    // R9, R19: what the office must do, each sentence by its key with the particulars the profile names (the response
    // period and its citation); a sentence whose particulars the profile does not name is not drawn, never drawn short.
    // R22: the view's `records_help` block (`jurisdictions` R93); every fill answered, or the sentence is not drawn (K3369)
    const block = pr && pr.state === "ok" && pr.value && pr.value.view && pr.value.view.records_help && typeof pr.value.view.records_help === "object"
      && !Array.isArray(pr.value.view.records_help) ? pr.value.view.records_help : null;
    const text = function (v) { return typeof v === "string" && v.trim() ? v.trim() : null; };
    const count = function (v) { return Number.isFinite(Number(v)) && v !== null && v !== "" ? String(v) : null; };
    const cite = function (k) {
      const c = block && block.citations ? block.citations[k] : null;
      return text(c) || (c && typeof c === "object" ? text(c.citation) || text(c.text) : null);
    };
    const place = pr && pr.state === "ok" && pr.value && pr.value.view ? text(pr.value.view.name) : null;
    const portalOf = block && block.portal && typeof block.portal === "object" ? block.portal : null;
    const fast = block && block.faster && typeof block.faster === "object" ? block.faster : null;
    const reasons = block && Array.isArray(block.extension_reasons) ? block.extension_reasons.map(function (r) { return text(r && r.reason); }).filter(Boolean) : [];
    // a sentence by key with the fills the block answers; "" where one is left unanswered
    const said = function (key, fills) {
      const live = {};
      for (const k of Object.keys(fills)) if (fills[k] !== null && fills[k] !== undefined && fills[k] !== "") live[k] = fills[k];
      const out = cs.w(key, live);
      return /\{\w+\}/.test(out) ? "" : out;
    };
    // R9: the first sentence's days and citation come from the response period the view names; the block gives its own
    const response = pr && pr.state === "ok" ? held(pr.value).find(function (d) { return d.rule === "records_response" && d.amount; }) : null;
    // C64-law: the law this request goes under, when the help is opened for an action that states one the profile lists. The place's
    // `records_help` block is that place's law: it is drawn only when its `law` is the chosen law; for any other chosen law the help
    // says what the law's own first-request window states (days, citation), with no other law's text and nothing of "the city".
    const act = view.data.action;
    const chosen = pr && pr.state === "ok" && act && act.state === "ok" ? view.parts.chosenLawOf(act.value, pr.value) : null;
    const fold = function (x) { return String(x || "").trim().toLowerCase().replace(/\s+/g, " "); };
    if (chosen && !(block && fold(block.law) === fold(chosen.name))) {
      const first = chosen.amount && chosen.dcitation
        ? said("screen.help-records.must.1", { days: String(chosen.amount), cite: chosen.dcitation }) : "";
      const mustOwn = first ? cs.sec("screen.help-records.must", '<ul class="mk-list"><li>' + first + "</li></ul>"
        + '<p class="mk-small">' + cs.w("screen.request.window." + (chosen.count === "business" ? "business" : "calendar"), { n: String(chosen.amount) }) + "</p>") : "";
      const cites = [chosen.citation, chosen.dcitation].filter(Boolean);
      const own = cs.sec("screen.help-records.does", '<p class="mk-note">' + cs.w("screen.help-records.does.text") + "</p>");
      const src = cites.length ? cs.sec("screen.help-records.sources", '<p class="mk-note">' + cs.esc(cites.join("; ")) + "</p>") : "";
      return cs.title(null) + mustOwn + own + src;
    }
    const fills = { days: (block && count(block.days)) || (response ? String(response.amount) : null), cite: (block && cite("answer")) || (response ? response.citation : null) };
    const lines = {
      1: fills,
      2: { reasons: reasons.join(", "), extra: block ? count(block.extra_days) : null, cite: cite("extend") },
      3: { cite: cite("assist") },
      4: { cite: cite("segregate"), cite2: cite("refuse_in_writing") },
      5: { cite: cite("electronic") },
      6: { cite: cite("cost"), cite2: cite("cost_electronic"), cite3: cite("inspect_photograph") },
      7: { cite: cite("purpose") },
    };
    const musts = [1, 2, 3, 4, 5, 6, 7].map(function (n) {
      // only the first sentence's particulars may come from the response period; the others come from the block alone
      const said1 = n === 1 || block ? said("screen.help-records.must." + n, lines[n]) : "";
      return said1 ? "<li>" + said1 + "</li>" : "";
    }).filter(Boolean);
    const must = musts.length ? cs.sec("screen.help-records.must", '<ul class="mk-list">' + musts.join("") + "</ul>") : "";
    const sub = block && said("screen.help-records.sub", { law: text(block.law), place: place })
      ? '<p class="mk-sub">' + said("screen.help-records.sub", { law: text(block.law), place: place }) + "</p>" : "";
    const notheld = pr && pr.state === "ok" && !block ? '<p class="mk-note" role="status">' + cs.w("screen.help-records.notheld") + "</p>" : "";
    const fasterWhat = fast ? said("screen.help-records.faster.what", { place: place, ordinance: text(fast.ordinance), request: text(fast.request), window: text(fast.window), cite: text(fast.citation) }) : "";
    const portalWhere = portalOf ? said("screen.help-records.portal.where", { place: place, portal: text(portalOf.name) }) : "";
    const faster = none && !fasterWhat ? "" : cs.sec("screen.help-records.faster", (none ? "" : cs.state("profiles", function (p) {
      const ds = held(p);
      const days = function (d) { return (Number(d.amount) || 0) * (d.count === "business" ? 1.4 : 1); };
      const fastest = ds.slice().sort(function (a, b) { return days(a) - days(b); })[0];
      return cs.sheet(ds.map(function (d) {
        return cs.row("", cs.esc(d.citation) + " · " + cs.w("screen.request.window." + (d.count === "business" ? "business" : "calendar"), { n: String(d.amount) }),
          ds.length > 1 && d === fastest ? '<span class="meta">' + cs.w("screen.help-records.thefaster") + "</span>" : "", "");
      }).join("")) + (ds.length > 1 ? '<p class="mk-note">' + cs.w("screen.help-records.faster.when") + "</p>" : "");
    })) + (fasterWhat ? '<p class="mk-note">' + fasterWhat + "</p>" : ""));
    const portal = cs.sec("screen.help-records.portal", (portalWhere ? '<p class="mk-note">' + portalWhere + "</p>" : "") + '<ul class="mk-list">' + [1, 2, 3].map(function (n) {
      return "<li>" + cs.w("screen.help-records.portal." + n) + "</li>";
    }).join("") + "</ul>");
    const does = cs.sec("screen.help-records.does", '<p class="mk-note">' + cs.w("screen.help-records.does.text") + "</p>");
    // R22: the sources are the citations the view names (the laws' and the block's, each once) and the portal's address, as data
    const sources = none && !block ? "" : cs.sec("screen.help-records.sources", cs.state("profiles", function (p) {
      const own = block ? Object.keys(block.citations && typeof block.citations === "object" ? block.citations : {}).map(cite)
        .concat(Array.isArray(block.extension_reasons) ? block.extension_reasons.map(function (r) { return text(r && r.citation); }) : [], fast ? [text(fast.citation)] : []) : [];
      const cites = held(p).flatMap(function (d) { return [d.citation].concat(d.extension && d.extension.citation ? [d.extension.citation] : []); })
        .concat(own, portalOf ? [text(portalOf.url)] : []).filter(Boolean);
      return cites.length ? '<p class="mk-note">' + cs.esc(cites.filter(function (c, i) { return cites.indexOf(c) === i; }).join("; ")) + "</p>" : "";
    }));
    return cs.title(null) + sub + notheld + must + faster + portal + does + sources;
  },

  acts: [],
});
