/* The `inbox` screen (Queue › Inbox; R7): the knocks at `/app/inbox`, one knock at `/app/inbox/<knock id>`, whose acts
 * are drawn with it. Self-contained functions over the kit `cs` (see `index.mjs`). */

/* R7: `inbox` (doorbell's list) always; `inboxget` for the knock the address names. */
function inboxReads(view) {
  const id = typeof view.subject === "string" && view.subject ? view.subject : null;
  return { list: { op: "inbox", query: { limit: 200 }, empty: (v) => !v || !Array.isArray(v.inbox) || !v.inbox.length },
           ...(id ? { knock: { op: "inboxget", query: { id } } } : {}) };
}

function renderInbox(cs, view) {
  const L = view.ui || {}, D = view.data || {};
  const id = typeof view.subject === "string" && view.subject ? view.subject : null;
  const said = (k, f) => `<p class="mk-note" role="status">${cs.w(k, f)}</p>`;
  /* R32 (3), R35: a size by `size.mb`, `size.kb` or `size.small`, never a byte count */
  const size = (n) => !Number.isFinite(n) ? "" : n >= 1048576 ? cs.w("size.mb", { n: (n / 1048576).toFixed(1) }) : n >= 1024 ? cs.w("size.kb", { n: String(Math.round(n / 1024)) }) : cs.w("size.small");
  const plain = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  /* R32 (3): a knock is named by what was handed in and when, never by its id */
  const handed = (k) => `${cs.w("screen.inbox.knock", { size: size(k.bytes) })} ${k.received ? cs.date(k.received) : ""}`.trim();
  const all = D.list && D.list.state === "ok" && Array.isArray(D.list.value.inbox) ? D.list.value.inbox : [];
  const same = (k) => k.pseudonym ? all.filter((x) => x.knock_id !== k.knock_id && x.pseudonym === k.pseudonym).length : 0;
  /* R12: a read that follows from another's answer (`sourceof` by a pulled knock's capture digest, then `sourcerung`),
     made once per query and kept in page memory, as screens-inquiry's document reads its own (K3002) */
  const later = (key, op, query) => {
    const M = L.later || (L.later = {});
    const q = JSON.stringify(query);
    if (!M[key] || M[key].q !== q) {
      M[key] = { q, state: "loading" };
      const settle = (o) => { M[key] = Object.assign({ q }, o); cs.set("later", M); };
      cs.call(op, { query }).then((a) => {
        const r = a && a.result !== undefined ? a.result : a;
        if (!a || a.ok === false || (r && r.ok === false)) settle({ state: "failed" });
        else settle({ state: "ok", value: r });
      }, () => settle({ state: "failed" }));
    }
    return M[key];
  };
  const sourceOf = (k) => {
    if (!k || typeof k.capture_sha !== "string" || !k.capture_sha) return null;
    const s = later(`src:${k.capture_sha}`, "sourceof", { capture: k.capture_sha });
    return s.state === "ok" && s.value && typeof s.value.sourceId === "string" ? s.value.sourceId : s.state === "loading" ? undefined : null;
  };
  const rungs = ["unknown", "same", "partly", "group", "public"];
  const NAMED = { unknown: 0, same_knocker: 1, partly_known: 2, known_to_group: 3, publicly_known: 4 };
  /* R12: a pulled knock stands at its source's rung (`sourcerung`); one not yet in the record at "Same knocker" when the
     secret proved it (a pseudonym), else "Unknown" */
  const ladder = (at) => `<div class="cs-ladder" data-ladder="ident" role="list" aria-label="${cs.w("screen.inbox.ladder")}">`
    + rungs.map((r, i) => `<span role="listitem" class="${i <= at ? "on" : ""}"${i === at ? ' aria-current="step"' : ""}>${cs.w(`screen.inbox.ladder.${r}`)}</span>`).join("")
    + `</div><p class="mk-small muted">${cs.w("screen.inbox.ladder.basis")}</p>`;
  /* C28 (R7; doorbell R27): what the sender stated of the file, drawn as stated (never a type check), in the list, the detail and the knocker's
     other material alike; nothing, not an empty label, for a knock stating neither */
  const stated = (k) => [k.file_name, k.media_type].filter((x) => typeof x === "string" && x).map((x) => `<span class="mk-data">${cs.esc(x)}</span>`).join(" · ");
  const statedLine = (k) => (stated(k) ? `<span class="meta">${stated(k)}</span>` : "");
  const facts = (k) => `<span class="meta">${cs.w(`screen.inbox.status.${["new", "pulled", "discarded"].includes(k.status) ? k.status : "new"}`)}</span>`
    + statedLine(k)
    + `<span>${k.note ? cs.w("screen.inbox.note", { note: k.note }) : cs.w("screen.inbox.nonote")}</span>`
    + (same(k) ? `<span class="meta">${cs.w("screen.inbox.same", { count: same(k) })}</span>` : "")
    + (k.status === "discarded" && k.resolve_reason ? `<span class="meta">${cs.w("screen.inbox.resolved", { reason: k.resolve_reason })}</span>` : "");
  /* R10: each knock named is a reference of the kind `knock`, its card what was handed in and when (interface-shell R27) */
  const card = (k) => [size(k.bytes), k.received ? cs.date(k.received) : "", k.note || ""];
  /* G20 (fix round 6; S11): the list asks for 200 knocks; when the doorbell says there are more, the screen says so (the nearest held row, `screen.held.more`,
     stands in; owed: a row for knocks) */
  const more = D.list && D.list.state === "ok" && D.list.value && D.list.value.truncated === true ? said("screen.held.more", { count: String(all.length) }) : "";
  const list = cs.state(D.list, (v) => `<div class="cs-sheet" role="list">${v.inbox.map((k) => `<div class="cs-row" role="listitem"${k.knock_id === id ? ' aria-current="true"' : ""}>`
      + `<span><span style="display:inline-flex;align-items:center;max-width:100%">${cs.ref("knock", k.knock_id, plain(handed(k)), card(k))}</span>${facts(k)}</span></div>`).join("")}</div>`,
    { empty: "screen.inbox.empty" });
  const one = !id ? "" : cs.state(D.knock, (v) => {
    const k = v.item || {};
    const src = sourceOf(k);
    let at = k.pseudonym || k.knocker_digest ? 1 : 0;
    if (src) {
      const r = later(`rung:${src}`, "sourcerung", { source_id: src });
      if (r.state === "ok" && Number.isFinite(NAMED[r.value.rung])) at = NAMED[r.value.rung];
    }
    /* R12: the sources `to` may name: those the group's other pulled knocks read through `sourceof`, the same knocker's
       first, at most 20, this knock's own left out */
    const others = all.filter((x) => x.knock_id !== k.knock_id && typeof x.capture_sha === "string" && x.capture_sha)
      .sort((a, b) => (b.pseudonym && b.pseudonym === k.pseudonym) - (a.pseudonym && a.pseudonym === k.pseudonym) || String(b.received).localeCompare(String(a.received)))
      .slice(0, 20);
    const choices = [];
    if (src) for (const x of others) {
      const sid = sourceOf(x);
      if (sid && sid !== src && !choices.some((c) => c[0] === sid))
        choices.push({ value: sid, text: plain(x.pseudonym && x.pseudonym === k.pseudonym && x.received ? cs.w("screen.inbox.same.date", { date: { html: cs.date(x.received) } }) : handed(x)) });
    }
    const link = src === undefined ? `<p class="mk-small">${cs.w("state.loading")}</p>`
      : !src ? `<p class="mk-small muted">${cs.w("screen.inbox.link.nosource")}</p>`
      : (choices.length ? `<div class="cs-reason">${cs.choice("cx-to", "screen.inbox.link.to", choices, { value: L.to || choices[0].value })}`
          + `${cs.field("cx-evidence", "screen.inbox.link.evidence", { area: true, rec: true, value: L.evidence || "" })}`
          + `${cs.act("sourcelink", { data: { source: src } })}</div>` : `<p class="mk-small muted">${cs.w("screen.inbox.link.none")}</p>`);
    /* R32 (3): a delivery's id (and its source's) appears only on a folded "Reference" line, for support */
    const reference = `<details class="mk-details" data-reference="knock"><summary>${cs.w("reference.label")}</summary><p class="mk-small"><span class="id">${cs.esc(k.knock_id || id)}</span>`
      + `${src ? ` · <span class="id">${cs.esc(src)}</span>` : ""}</p></details>`;
    /* R43 (C17; DEC-375): the other material from the same knocker (`knocksof`, by the pseudonym), listed only where the inbox
       already holds another knock of it; and, for a knock in the record, the door to what is known of its source */
    const alike = L.knocker && L.knocker.pseudonym === k.pseudonym && Array.isArray(L.knocker.knocks) ? L.knocker.knocks.filter((x) => x && x.knock_id !== k.knock_id) : null;
    const knocker = !k.pseudonym || (!same(k) && !(alike && alike.length)) ? ""
      : cs.sec("screen.inbox.knocker.heading", (alike && alike.length
          ? cs.sheet(alike.map((x) => `<div class="cs-row" role="listitem"><span><span style="display:inline-flex;align-items:center;max-width:100%">${cs.ref("knock", x.knock_id, plain(handed(x)), card(x))}</span>${statedLine(x)}</span></div>`).join(""))
            + `<p class="mk-small muted">${cs.w("screen.inbox.knocker.same1")} ${cs.w("screen.inbox.knocker.same2")}</p>` : "")
          + `<div class="mk-acts">${cs.act("knocksof", { data: { pseudonym: k.pseudonym } })}</div>`,
        { help: ["screen.inbox.knocker.help1", "screen.inbox.knocker.help2"] });
    const door = typeof k.capture_sha === "string" && k.capture_sha && src
      ? cs.row(cs.icon("person"), cs.w("screen.inbox.source.line"), cs.ref("source", k.capture_sha, plain(cs.w("screen.about-knocker.name")), [cs.w("screen.inbox.source.line")])) : "";
    /* C28 (R7, R32): the knock's fingerprint, labelled, shown before the member decides what to do with it */
    const print = typeof k.sha256 === "string" && k.sha256 ? `<p class="mk-small"><span class="meta">${cs.w("screen.document.fingerprint")}</span> <span class="mk-data">${cs.esc(k.sha256)}</span></p>` : "";
    /* C28 (doorbell R27, B20): what the sender stated of the file, drawn as stated (never a type check) */
    return `<section class="cs-section mk-sec"><h2>${handed(k)}</h2>${facts(k)}${print}${ladder(at)}`
      + (k.status === "new" ? `<div class="mk-acts">${cs.act("inboxpull", { tone: "primary" })}</div>`
        /* R32 (1): discarding asks why first (`inbox.discard.why`), the words sent as `reason` */
        + cs.field("cx-why", "inbox.discard.why", { area: true, rec: true, value: L.why || "" })
        + `<div class="mk-acts">${cs.act("inboxresolve")}</div>`
        /* C28 (B18): a discarded knock can be put back (`inboxresolve` to `new`, doorbell R3); DEC-398 gave its keys */
        : k.status === "discarded" ? cs.field("cx-back", "shell.reason", { area: true, rec: true, value: L.back || "" }) + `<div class="mk-acts">${cs.act("inboxresolve", { label: "act.inboxresolve.label.inbox.putback", data: { status: "new" } })}</div>` : "")
      + link + (door ? cs.sheet(door) : "") + knocker + reference + "</section>";
  });
  return `<div class="mk-h">${cs.title()}<p class="mk-sub">${cs.w("screen.inbox.sub")}</p></div>`
    + one
    /* R32 (2): bytes the record already holds name the document that holds them when the viewer may see it */
    + (L.pulled === "held" ? said(L.holder && L.holder.id ? "screen.inbox.alreadyheld" : "screen.inbox.alreadyheld.other",
        L.holder && L.holder.id ? { holder: { html: cs.ref("document", L.holder.id, L.holder.title || cs.w("shell.card.document").replace(/<[^>]*>/g, ""), []) } } : undefined)
      : L.pulled ? said(L.pulled === "existed" ? "screen.inbox.existed" : "screen.inbox.pulled") : "")
    + (L.discarded ? said("screen.inbox.discarded") : "")
    + (L.putback ? said("screen.inbox.putback.done") : "")
    + (L.linked ? said("screen.inbox.link.done") : "")
    + list + more;
}

/* R7: "Move into the record" (`inboxpull`): the pull and its promotion are one act at the door (store-door R7). */
function sendPull(view) {
  return { body: { knockId: view.subject } };
}
async function donePull(view, answer, cs) {
  const a = answer || {};
  cs.set("discarded", false);
  /* R32 (2) (doorbell R13): `existed` with a `holder` key is bytes the record held; `holder` null when the viewer may not see it */
  if (a.existed === true && Object.prototype.hasOwnProperty.call(a, "holder")) {
    let title = "";
    if (typeof a.holder === "string" && a.holder) {
      const got = await cs.call("image", { query: { id: a.holder } });
      const r = got && typeof got.result === "object" && got.result ? got.result : got;
      const md = r && typeof r["bundle.md"] === "string" ? r["bundle.md"].split(/\n---\s*\n/)[0] : "";
      const m = /^title:\s*(.*?)\s*$/m.exec(md || "");
      title = m ? m[1].replace(/^["']|["']$/g, "") : "";
    }
    cs.set("holder", { id: typeof a.holder === "string" ? a.holder : null, title });
    cs.set("pulled", "held");
    return;
  }
  cs.set("pulled", a.existed === true ? "existed" : "pulled");
}

/* R7: "Discard with a reason" (`inboxresolve` to `discarded`): a reasoned act, so the shell asks the reason first and
 * sends it as `reason` (setup-page R11's rule); `RESOLVE_NO_REASON` drawn by its words, the knock left as it was. */
function sendDiscard(view, el, cs) {
  /* put back: the shell asks the reason (reasonField) and the knock returns to `new` */
  if (el && el.dataset && el.dataset.status === "new") {
    const back = String(cs.value("cx-back") || "").trim();
    return back ? { body: { knockId: view.subject, status: "new", reason: back } } : { refuse: "refusal.RESOLVE_NO_REASON" };
  }
  const why = String(cs.value("cx-why") || "").trim();
  if (!why) return { refuse: "refusal.RESOLVE_NO_REASON" };
  return { body: { knockId: view.subject, status: "discarded", reason: why } };
}
function doneDiscard(view, answer, cs) {
  if (answer && answer.status === "new") { cs.set("discarded", false); cs.set("pulled", false); cs.set("putback", true); return; }
  cs.set("putback", false);
  cs.set("discarded", true);
  cs.set("pulled", false);
}

/* R43 (C17; doorbell R15): "See this knocker's other material": `knocksof` by the knock's pseudonym; the answer's knocks are kept in
 * page memory and drawn beside the knock, this one left out. */
function sendKnocksOf(view, el, cs) {
  const pseudonym = el && el.dataset ? String(el.dataset.pseudonym || "") : "";
  return pseudonym ? { body: { pseudonym } } : null;
}
function doneKnocksOf(view, answer, cs) {
  const a = answer || {};
  const sent = view.ui && view.ui.knocksFor;
  cs.set("knocker", { pseudonym: typeof a.pseudonym === "string" ? a.pseudonym : sent || "", knocks: Array.isArray(a.knocks) ? a.knocks : [] });
}

/* R7, R12: "Record what is known of the source" (`sourcelink`, sources R6): this knock's source as `sourceof` read it,
 * the source chosen as the same person, and what shows it. No source id is typed. */
function sendSourceLink(view, el, cs) {
  const source = el && el.dataset ? String(el.dataset.source || "") : "";
  const to = String(cs.value("cx-to") || "").trim();
  const evidence = String(cs.value("cx-evidence") || "").trim();
  if (!source) return { refuse: "screen.inbox.link.nosource" };
  const missing = [!to && "screen.inbox.link.to", !evidence && "screen.inbox.link.evidence"].filter(Boolean);
  if (missing.length) return { refuse: "screen.inbox.link.missing", fills: { fields: missing.map((k) => cs.w(k)).join(", ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") } };
  cs.set("to", to);
  return { body: { source, to, evidence } };
}
function doneSourceLink(view, answer, cs) {
  cs.set("linked", true);
  cs.set("later", {});
}

export const INBOX_SCREEN = Object.freeze({
  id: "inbox",
  reads: inboxReads,
  render: renderInbox,
  acts: Object.freeze([
    Object.freeze({ op: "inboxpull", rereads: Object.freeze(["list", "knock"]), label: "act.inboxpull.label.inbox", send: sendPull, done: donePull }),
    Object.freeze({ op: "inboxresolve", rereads: Object.freeze(["list", "knock"]), label: "act.inboxresolve.label.inbox", send: sendDiscard, done: doneDiscard, reasonField: "reason",
                    refusals: Object.freeze({ RESOLVE_NO_REASON: "refusal.RESOLVE_NO_REASON" }) }),
    Object.freeze({ op: "sourcelink", rereads: Object.freeze([]), label: "act.sourcelink.label.inbox", send: sendSourceLink, done: doneSourceLink, reasonField: "evidence" }),
    Object.freeze({ op: "knocksof", rereads: Object.freeze([]), label: "act.knocksof.label.inbox", send: sendKnocksOf, done: doneKnocksOf }),
  ]),
});
