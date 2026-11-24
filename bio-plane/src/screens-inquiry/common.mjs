/* screens-inquiry: the readers the screens share, each self-contained (interface-shell R21 (1)) and handed to a screen as
 * its `parts` (interface-shell R21, K3002), so the served page carries each once by its own text and no screen copies
 * it. None draws a word. */

/** A record document's front matter and body, as the record grammar writes it: top-level scalars (a quoted value
 *  JSON-read); a key with no value followed by `  - k: v` items as a list of maps (`references`, `basis`, `grounds`);
 *  one followed by `  k: v` lines as a map (`source`); and, from the body, the `## Question` text and the Session Log's
 *  regroupings (`### Session <at> | Grouped|Restructured | <who>`, with their `Reason:` and `Strength before:` lines). */
export function front(text) {
  const out = { lists: {}, maps: {}, question: "", log: [] };
  if (typeof text !== "string") return out;
  const val = (v) => { v = String(v).trim(); try { if (v.startsWith("\"")) v = JSON.parse(v); } catch { /* raw */ } return v; };
  const head = text.replace(/^---\s*\n/, "").split(/\n---\s*(\n|$)/)[0];
  let key = null, cur = null;
  for (const line of head.split("\n")) {
    const top = /^(\w+):\s*(.*)$/.exec(line);
    if (top) {
      key = top[2].trim() === "" ? top[1] : null;
      cur = null;
      if (!key) out[top[1]] = top[2].trim() === "[]" ? [] : val(top[2]);
      continue;
    }
    if (!key) continue;
    const item = /^\s+-\s+(\w+):\s*(.*)$/.exec(line);
    if (item) {
      cur = {};
      (out.lists[key] || (out.lists[key] = [])).push(cur);
      cur[item[1]] = val(item[2]);
      continue;
    }
    const sub = /^(\s+)(\w+):\s*(.*)$/.exec(line);
    if (sub && cur && sub[1].length >= 4) cur[sub[2]] = val(sub[3]);
    else if (sub) (out.maps[key] || (out.maps[key] = {}))[sub[2]] = val(sub[3]);
  }
  const q = /\n## Question\s*\n+([\s\S]*?)(\n## |$)/.exec(text);
  out.question = q ? q[1].trim() : "";
  const log = /\n## Session Log\s*\n([\s\S]*?)(\n## (?!#)|$)/.exec(text);
  if (log) for (const part of log[1].split(/\n(?=### Session )/)) {
    const h = /^### Session (\S+) \| (Grouped|Restructured) \| (.+)$/m.exec(part);
    if (!h) continue;
    const reason = /^Reason:\s*(.*)$/m.exec(part);
    const before = /^Strength before:\s*(.*?)\.?\s*$/m.exec(part);
    out.log.push({ at: h[1], act: h[2], who: h[3].trim(), reason: reason ? reason[1].trim() : "", before: before ? before[1].trim() : "" });
  }
  return out;
}

/** A read the screen makes as it draws: once per key and query (and `token`, to read again), its outcome kept in the
 *  screen's memory and drawn on arrival. An answer `ok: false` (top level or in `result`) is failed, with its words;
 *  `found: false` is empty. A refusal keeps its answer's fields (a project seen only to exist names its `name` and
 *  `owners`). */
export function later(cs, ui, key, op, query, token) {
  const L = ui.later || (ui.later = {});
  const q = JSON.stringify(query) + "#" + (token || "");
  if (!L[key] || L[key].q !== q) {
    L[key] = { q, state: "loading" };
    const settle = (o) => { L[key] = Object.assign({ q }, o); cs.set("later", L); };
    cs.call(op, { query }).then((a) => {
      const r = a && a.result !== undefined ? a.result : a;
      if (!a || a.ok === false || (r && r.ok === false)) {
        const f = r && r.ok === false ? r : a || {};
        const code = String(f.code || f.reason || "");
        settle({ state: "failed", refusal: { code, words: cs.esc(f.translation || code), fields: f } });
      } else if (r && r.found === false) settle({ state: "empty" });
      else settle({ state: "ok", value: r });
    }, () => settle({ state: "failed", refusal: null }));
  }
  return L[key];
}

/** A word as plain text, for record-data options, a title and a fill (the kit escapes each once more). */
export function plain(cs, key, fills) {
  return String(cs.w(key, fills)).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
}

/** A member as drawn (R40): her handle; the founder with no handle by `member.founder.unnamed`, never `admin`. A screen
    that reads the founder's handle passes it as `founder` (R46): the credential `admin` is then drawn by that handle. */
export function who(cs, x, founder) {
  if (x && typeof x === "object") {
    if (x.handle) return String(x.handle);
    if (x.founder === true) return String(cs.w("member.founder.unnamed")).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    return "";
  }
  const s = String(x == null ? "" : x).replace(/^(member:|token:)/, "");
  if (s === "admin" && founder) return String(founder);
  return s === "admin" ? String(cs.w("member.founder.unnamed")).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])) : s;
}

/** R40 (K5148; WALK-FINAL-03 R24): whether the roster row `x` is the viewer (`view.me`, `whoami`'s answer). project-roster R29 answers a participant by
 *  `handle` (null for a founder who chose none) and marks the founder's row `founder: true`; it carries no `member`, a row that does is matched by it. So
 *  a row is hers when its `member` is hers, when it is the founder's and `whoami` names the member `admin`, or when its handle is hers. Self-contained. */
export function isMe(view, x) {
  const me = view && view.me ? view.me : null;
  if (!me || !x || typeof x !== "object") return false;
  const member = me.member ? String(me.member) : "";
  return (member !== "" && String(x.member || "") === member) || (member === "admin" && x.founder === true) || (!!x.handle && x.handle === me.handle);
}

/** R60: a project she cannot see, drawn as the shell's "unavailable" state b ("You can't open this"), with nothing beneath. */
export function unavailable(cs) {
  return `<p class="cs-state" data-state="empty" data-unavailable="notyours"><b>${cs.w("shell.unavailable.notyours.title")}</b> ${cs.w("shell.unavailable.notyours.says")}</p>`;
}


/** R57: the ending's own words, never its code: `ai.run.ending.<bound>`, `ai.run.ending.unknown` for any other; a run that
 *  completed is `completed` when it left a proposal that waits (`left`), `completed.none` when it left none. */
export function ending(cs, bound, left) {
  const b = String(bound || "");
  if (b === "completed") return cs.w(left === false ? "ai.run.ending.completed.none" : "ai.run.ending.completed");
  const known = ["cancelled", "mode-not-deployed", "fetches", "subsessions", "wallclock", "runtime", "mints", "surfaces", "proposals", "pages", "lease", "nothing-written"];
  return cs.w(known.includes(b) ? "ai.run.ending." + b : "ai.run.ending.unknown");
}

/** R57: the cost line, to the account's owners only (`session.cost` is absent for anyone else, and before anything is
 *  reported): `so far` while it works, `final` once it has ended; money where the account reports it, tokens and calls
 *  otherwise; never a zero for a figure not reported. */
export function costLine(cs, session, ended) {
  const c = session && session.cost;
  if (!c || typeof c !== "object") return "";
  const calls = Number(c.calls);
  const usd = c.cost && Number.isFinite(Number(c.cost.usd)) ? Number(c.cost.usd) : null;
  const tokens = Number(c.tokens);
  const owner = String(c.owner || "");
  let amount;
  if (usd !== null && c.unit !== "tokens") amount = cs.w(calls === 1 ? "ai.run.cost.money.one" : "ai.run.cost.money", { amount: "$" + usd.toFixed(2), calls: String(calls) });
  else if (Number.isFinite(tokens) && tokens > 0) amount = cs.w(calls === 1 ? "ai.run.cost.tokens.one" : "ai.run.cost.tokens", { tokens: String(tokens), calls: String(calls) });
  else return "";
  const account = owner.startsWith("project:") ? cs.w("ai.run.cost.on.project", { project: String(c.project_title || c.project || "") })
    : owner === "group" ? cs.w("ai.run.cost.on.team") : usd !== null && c.unit !== "tokens" ? cs.w("ai.run.cost.on.apikey") : cs.w("ai.run.cost.on.subscription");
  const means = usd === null || c.unit === "tokens" ? " " + cs.w("ai.run.cost.tokens.means") : "";
  return `<p class="mk-small" data-run="cost" data-tip="${cs.esc(cs.w("ai.run.cost.means") + means)}">${cs.w(ended ? "screen.assistant.run.cost.final" : "screen.assistant.run.cost.sofar", { cost: { html: amount }, account: { html: account } })}</p>`;
}

/** R58: a run's steps as its log makes them, each row added as it arrives (a polite live region), from the entries' fields
 *  (`read: {record, n, total, outcome}`, a compose tick's `found`, the check's ticks): no English is parsed. `title(record)`
 *  names a document the member may see; a refused read, or one she may not see, names none. */
export function progress(cs, entries, o) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = [];
  const tick = (key, vars, attrs) => rows.push(`<li${attrs || ""}><span aria-hidden="true">\u2713</span> ${cs.w(key, vars)}</li>`);
  let total = 0, lastRead = false, found = null, checks = [], checked = null, composing = false;
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    if (e.read && typeof e.read === "object") {
      const r = e.read, refused = r.outcome === "refused";
      const named = refused ? "" : (o && o.title ? o.title(String(r.record || "")) : "");
      rows.push(`<li data-step="reading" data-n="${cs.esc(r.n)}" data-outcome="${refused ? "refused" : "answered"}">${cs.w("ai.progress.reading",
        { document: named || cs.w("state.undetermined", { reason: "" }), n: String(r.n), total: String(r.total) })}</li>`);
      total = Number(r.total) || total; lastRead = Number(r.n) === Number(r.total);
    } else if (e.disagree && typeof e.disagree === "object") {
      rows.push(`<li data-step="disagree">${cs.w("ai.reading.levels.disagree", { record: String(e.disagree.record || ""), first: String((e.disagree.levels || [])[0] || ""), second: String((e.disagree.levels || [])[1] || "") })}</li>`);
    } else if (typeof e.found === "number") found = e.found;
    else if (e.check && typeof e.check === "object") checks.push(e.check);
    else if (e.checked && typeof e.checked === "object") checked = e.checked;
    if (e.composing === true) composing = true;
  }
  if (lastRead && total) tick(total === 1 ? "ai.progress.read.one" : "ai.progress.read", { total: String(total) }, ' data-step="read"');
  if (found !== null) tick(found === 0 ? "ai.progress.found.none" : found === 1 ? "ai.progress.found.one" : "ai.progress.found", { count: String(found) }, ' data-step="found"');
  if (composing && !checks.length && !checked) rows.push(`<li data-step="composing">${cs.w("ai.progress.composing")}</li>`);
  if (composing || checks.length || checked) rows.push(`<li data-step="checking">${cs.w("ai.progress.checking")}</li>`);
  for (const c of checks) rows.push(`<li data-step="check" data-found="${c.found === true ? "yes" : "no"}">${cs.w(c.found === true ? "ai.progress.check.ok" : "ai.progress.check.fail", { passage: String(c.passage || "") })}</li>`);
  if (checked) rows.push(`<li data-step="checked">${cs.w("ai.progress.checked", { ok: String(checked.ok), total: String(checked.total) })}</li>`);
  const answered = !!checked || checks.length > 0;
  const none = !!checked && Number(checked.ok) === 0;
  return { html: rows.length ? `<div class="cs-machinework" data-origin="machine" data-progress="1"><ol class="mk-next" aria-live="polite" data-tip="${cs.esc(cs.w("ai.progress.means"))}">${rows.join("")}</ol>`
    + (answered ? "" : `<p class="mk-small" data-hold="1">${cs.w("ai.progress.hold")}</p>`) + "</div>" : "", answered, none };
}

/** R82 (CR-19; DEC-368): the format ids the registry names, each with its `document.kind.<id>` word; any other id draws `document.kind.undetermined`. */
export const KIND_IDS = Object.freeze(["csv", "docx", "html", "jpeg", "odp", "ods", "odt", "pdf", "png", "pptx", "text", "undetermined", "xlsx", "zip"]);

/** C36 (R2, R3, R24, R34): the words of the passage a leg cites, from a reading's text units. `want` is the leg's extent as the record states it
 *  (`{page: "2"}`, `{kind: "doc-para", para: "2"}`: strings); a unit's extent is the extent grammar's (reading-pipeline R15), the fields it does not
 *  narrow to null (`rect`, `run`), and a null field states nothing. A leg draws a unit's words when it names exactly the fields the unit states,
 *  equal; a leg narrower (a rect) or wider (no page) than the unit is not the unit's words, and a leg that names nothing has none. */
export function legWords(units, want) {
  const stated = (e) => Object.entries(e).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]);
  const keys = Object.keys(want || {}).filter((k) => k !== "kind");
  if (!keys.length || !Array.isArray(units)) return "";
  const hit = units.find((u) => {
    if (!u || !u.extent || typeof u.extent !== "object" || !String(u.text || "").trim()) return false;
    const have = stated(u.extent);
    return have.length > 0 && (want.kind === undefined || have.some(([k, v]) => k === "kind" && v === want.kind))
      && have.filter(([k]) => k !== "kind").length === keys.length && have.every(([k, v]) => k === "kind" || want[k] === v);
  });
  return hit ? String(hit.text) : "";
}

/** C36: a leg's extent as the record states it, from its own `extent_*` fields (every one but the capture and how it was cited as) and an
 *  `extent` object when it has one; the leg's fields win. */
export function legExtent(x) {
  const bag = {};
  if (!x) return bag;
  for (const [k, v] of Object.entries(x)) if (k.startsWith("extent_") && k !== "extent_capture" && k !== "extent_cited_as" && v !== undefined && v !== null && v !== "") bag[k.slice(7)] = String(v);
  if (x.extent && typeof x.extent === "object") for (const [k, v] of Object.entries(x.extent)) if (v !== undefined && v !== null && v !== "" && bag[k] === undefined) bag[k] = String(v);
  return bag;
}

/** G38 (R3, R96; extraction's `op=reading` pages by bytes as well as units, so a long reading takes several pages): the units of a reading across its
 *  pages, following `next` from the first page (`first`, an `op=reading` answer's value) until `done(units)` says it has what it needs, `limit` pages have been
 *  followed (none: no limit), or no page remains. `read(key, query)` is the screen's own reader (`later`, or an act's view of the page's memory); each page is the
 *  read `{sha256, after: next}` kept under `key` + the first page's totals + `next`, so a reading that grows while it is being read (its totals change) is read
 *  again and not taken from a page kept while it was shorter, and every consumer of one reading shares its pages. Returns `{units, state, more, failed}`:
 *  `state` `loading` while a page is on its way (the units so far), `failed` when one was refused (`failed` is that read; the units so far), else `ok`; `more`
 *  whether a page remains unread. A cursor that comes round again ends the walk. Self-contained. */
export function readPages(read, key, sha, first, done, limit) {
  const cursorOf = (v) => (v && v.next !== undefined && v.next !== null && v.next !== "" ? String(v.next) : null);
  const version = first ? [first.units_total, first.read_through, first.total].map((v) => (v === undefined || v === null ? "" : String(v))).join("/") : "";
  let units = first && Array.isArray(first.text_units) ? first.text_units.slice() : [];
  let cursor = cursorOf(first), state = "ok", failed = null, n = 0;
  const seen = new Set();
  while (cursor !== null && !(done && done(units)) && !seen.has(cursor) && !(limit !== undefined && limit !== null && n >= limit)) {
    seen.add(cursor);
    n++;
    const r = read(key + version + ":" + cursor, { sha256: sha, after: cursor });
    if (!r || r.state === "loading") { state = "loading"; break; }
    if (r.state !== "ok" || !r.value) { state = "failed"; failed = r; break; }
    units = units.concat(Array.isArray(r.value.text_units) ? r.value.text_units : []);
    cursor = cursorOf(r.value);
  }
  return { units, state, more: cursor !== null, failed };
}

/** G12c (R1, R9; strength R6 as T51 fix round 6 amends it): the strength of many questions in ONE read for each 50 of them (`inquirystrength` with `ids`,
 *  comma-joined, strength's batch), never one read for each question. `read(key, query)` is the screen's own reader (`later`/`ask`); `esc` the kit's.
 *  Returns `of(id)`: that question's read as the single read gives it (`{state, value}`), loading while its batch is, failed with the plane's words when
 *  its entry is a refusal or the batch left it out. The answer holds `results`, one entry for each id asked, keyed by id. */
export function strengths(read, ids, esc) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, i + 50));
  const reads = chunks.map((c) => read("strengths:" + c.join(","), { ids: c.join(",") }));
  return (id) => {
    const i = chunks.findIndex((c) => c.includes(String(id)));
    const r = i < 0 ? null : reads[i];
    if (!r || r.state === "loading") return { state: "loading" };
    if (r.state !== "ok") return r;
    const all = r.value && r.value.results;
    const one = Array.isArray(all) ? all.find((x) => x && String(x.target) === String(id)) : all && typeof all === "object" ? all[String(id)] : undefined;
    if (!one || typeof one !== "object") return { state: "failed", refusal: null };
    if (one.ok === false) return { state: "failed", refusal: { code: String(one.code || one.reason || ""), words: one.translation ? esc(String(one.translation)) : "" } };
    return { state: "ok", value: one };
  };
}

/** The parts every screen of the module carries. */
export const COMMON = Object.freeze({ front, later, plain, who, isMe, unavailable, ending, costLine, progress, legWords, legExtent, readPages, strengths, kinds: KIND_IDS });
