/* legistar-reader: captured Legistar Web API JSON read as content (T33-14; requirements
 * `build/requirements/legistar-reader.md`).
 *
 * A Legistar Web API capture is a publishing system's own structured record: bodies, persons,
 * office records, events, event items, votes and matters, each row carrying the system's own
 * identifiers at both ends. What this module reads from it is therefore a SYSTEM-RULE assertion
 * the machine may write (DEC-52; K1443), dated "as recorded by Legistar" and never as truth: no
 * date, holder, seat or vote is inferred, completed or corrected here (R15), and a row's absence
 * is never read as a seat's or a meeting's absence.
 *
 * It is one content type of `docprofile`'s registry, of the MEMBERSHIP contract (a list whose
 * entries come and go and each of which still says, or no longer says, what it said), registered
 * through the seam the way `doctypes` registers its seven (`registerLegistar(register)`).
 *
 * Every field is read from a closed list per endpoint, so a field this file does not name is never
 * read, and the contact fields (e-mail, phone, fax, street and web addresses of a person or body)
 * are named below only to be refused (R3; K1485 row 9). Every local word (the cancellation,
 * special and concurrent markers a clerk writes into a body's name; which body names are variants
 * of one organisation) comes from the jurisdiction view, never from here (R4, R14). The module is
 * pure: it reads the bytes and locator it is given, and nothing else (R13). */
import {
  CONTRACT, CONFIDENCE, diffEntities, vocabulary, vocabRegex,
  event, isMeaningful, worstSignificance, bySeverity,
} from "../docprofile/registry.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

export const KEY = "legistar_api";
export const BASIS = "as recorded by Legistar";
export const PAGE_SIZE = 1000;
export const PUBLISHED_LABEL = localize("legistar-reader.index.last_publication_an_upper_bound", "last publication, an upper bound");

/* The endpoints read, each with the id field every row of it carries and the row kind it gives. */
export const ENDPOINTS = {
  bodies:        { id: "BodyId",         kind: "body" },
  persons:       { id: "PersonId",       kind: "person" },
  officerecords: { id: "OfficeRecordId", kind: "seat" },
  events:        { id: "EventId",        kind: "event" },
  eventitems:    { id: "EventItemId",    kind: "event_item" },
  votes:         { id: "VoteId",         kind: "vote" },
  matters:       { id: "MatterId",       kind: "matter" },
};

/* The contact fields K1485 bars from any import, named so the test can hold each one; a field of
   another name that names an e-mail, phone, fax, street or web address is refused by CONTACT_NAME.
   Neither is consulted to decide what to READ (that is each endpoint's closed list below); they
   are the second guard, so a future field added to a list by mistake is still dropped. */
export const CONTACT_FIELDS = Object.freeze([
  "PersonEmail", "PersonEmail2", "PersonPhone", "PersonPhone2", "PersonFax", "PersonAddress1",
  "PersonAddress2", "PersonCity1", "PersonCity2", "PersonState1", "PersonState2", "PersonZip1",
  "PersonZip2", "PersonWWW", "OfficeRecordEmail",
]);
const CONTACT_NAME = /e-?mail|phone|fax|address|street|city\d|state\d|zip|www|website/i;
export function isContactField(name) {
  return CONTACT_FIELDS.includes(name) || CONTACT_NAME.test(String(name));
}

/* ------------------------------------------------------------------------- *
 * The address.
 * ------------------------------------------------------------------------- */

const ADDRESS = /^(?:https?:\/\/)?webapi\.legistar\.com\/v1\/([^/?#]+)\/([^?#]*?)\/?(?:\?([^#]*))?(?:#.*)?$/i;

/** What a locator names: `{client, endpoint, record, query}` for a Legistar Web API address of an
 *  endpoint this module reads, `record` the trailing id of a one-record address (`events/9016`),
 *  else `{why}`. The client is read from the address, never matched against a held list (R14). */
export function readAddress(locator) {
  if (typeof locator !== "string" || !locator)
    return { why: "no address was given, so whether this is a Legistar Web API capture cannot be said" };
  const m = ADDRESS.exec(locator.trim());
  if (!m) return { why: "the address is not a Legistar Web API address (webapi.legistar.com/v1/<client>/<endpoint>)" };
  const segs = m[2].split("/").filter(Boolean);
  if (!segs.length) return { why: localize("legistar-reader.index.the_address_names_a_client", "the address names a Legistar client but no endpoint") };
  let record = null;
  const last = segs[segs.length - 1];
  let name = last.toLowerCase();
  if (/^\d+$/.test(last)) {
    if (segs.length < 2) return { why: localize("legistar-reader.index.the_address_names_a_record", "the address names a record id but no endpoint") };
    record = Number(last);
    name = segs[segs.length - 2].toLowerCase();
  }
  if (!Object.hasOwn(ENDPOINTS, name))
    return { why: localize("legistar-reader.index.the_address_names_the_legistar", "the address names the Legistar endpoint \"{name}\", which this reader does not read", { name: String(name) }) };
  return { client: decodeURIComponent(m[1]), endpoint: name, record, query: m[3] ?? null };
}

/* One query parameter's value as written, its name compared after decoding (`%24skip` is `$skip`). */
function queryParam(query, name) {
  if (!query) return null;
  for (const part of query.split("&")) {
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    let dk;
    try { dk = decodeURIComponent(k.replace(/\+/g, " ")); } catch { dk = k; }
    if (dk.toLowerCase() === name) return i < 0 ? "" : part.slice(i + 1);
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * The bytes.
 * ------------------------------------------------------------------------- */

function textOf(ctx) {
  if (typeof ctx?.text === "string") return ctx.text;
  const b = ctx?.bytes;
  if (b instanceof Uint8Array) return new TextDecoder("utf-8").decode(b);
  return null;
}

/* The last bytes decoded, kept so `detect` and `parse` of one capture decode it once. Pure: the
   answer depends only on the text. */
let LAST = { text: null, value: null };
function decode(text) {
  if (LAST.text === text) return LAST.value;
  let value;
  try { value = { json: JSON.parse(text) }; }
  catch (e) { value = { why: localize("legistar-reader.index.the_bytes_are_not_json", "the bytes are not JSON ({String})", { String: String(String((e && e.message) || e)) }) }; }
  LAST = { text, value };
  return value;
}

/** Read a capture into its endpoint and its objects, or say why it is not one: the address must
 *  name an endpoint (R1), the bytes must parse as a JSON array of objects each carrying that
 *  endpoint's id field, or, at a one-record address, as one such object. */
function capture(ctx) {
  const addr = readAddress(ctx?.locator);
  if (addr.why) return addr;
  const text = textOf(ctx);
  if (text === null) return { why: localize("legistar-reader.index.no_text_was_supplied_with", "no text was supplied with the address, so there is nothing to read") };
  const d = decode(text);
  if (d.why) return d;
  const { id } = ENDPOINTS[addr.endpoint];
  let objects;
  if (Array.isArray(d.json)) objects = d.json;
  else if (addr.record !== null && d.json && typeof d.json === "object") objects = [d.json];
  else return { why: addr.record !== null
    ? "the bytes are JSON but not an object or an array of objects"
    : localize("legistar-reader.index.the_bytes_are_json_but", "the bytes are JSON but not an array, as a list of {endpoint} is", { endpoint: String(addr.endpoint) }) };
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (!o || typeof o !== "object" || Array.isArray(o))
      return { why: localize("legistar-reader.index.entry_i_of_the_array", "entry {i} of the array is not an object", { i: String(i) }) };
    if (!Number.isInteger(o[id]))
      return { why: localize("legistar-reader.index.entry_i_carries_no_id", "entry {i} carries no {id}, the id field of every {endpoint} row", { i: String(i), id: String(id), endpoint: String(addr.endpoint) }) };
  }
  if (addr.record !== null && objects.length === 1 && objects[0][id] !== addr.record)
    return { why: localize("legistar-reader.index.the_record_carries_id_v1", "the record carries {id} {v1}, not the {record} its address names", { id: String(id), v1: String(objects[0][id]), record: String(addr.record) }) };
  return { ...addr, objects };
}

/* ------------------------------------------------------------------------- *
 * The view's words (R4, R14).
 * ------------------------------------------------------------------------- */

function markers(ctx) {
  const out = [];
  for (const e of vocabulary(ctx, "meeting_markers")) {
    if (!["cancelled", "special", "concurrent"].includes(e.marker)) continue;
    const re = vocabRegex(e.pattern, null, "g");
    if (re) out.push({ marker: e.marker, re });
  }
  return out;
}
function variants(ctx) {
  const out = [];
  for (const e of vocabulary(ctx, "body_variants")) {
    if (typeof e.organisation !== "string" || !e.organisation) continue;
    const re = vocabRegex(e.pattern);
    if (re) out.push({ organisation: e.organisation, re });
  }
  return out;
}

/** A body's name read against the view: the markers it carries, its base name (the name with the
 *  marked words, and the separators left beside them, removed), its status and kind of meeting, and
 *  the organisation the body-variant map names for it. With no marker or map in the view, the name
 *  is its own base and nothing is marked (a view without the fact means no local recognition). */
export function readBodyName(name, ctx) {
  const words = typeof name === "string" ? name : "";
  const found = new Set();
  let base = words;
  for (const { marker, re } of markers(ctx)) {
    re.lastIndex = 0;
    if (!re.test(words)) continue;
    found.add(marker);
    re.lastIndex = 0;
    base = base.replace(re, " ");
  }
  base = base.replace(/\s+/g, " ").trim().replace(/\s*[-–—,:;]+$/u, "").replace(/^[-–—,:;]+\s*/u, "").trim();
  let organisation = null;
  for (const { organisation: o, re } of variants(ctx)) {
    re.lastIndex = 0;
    if (re.test(words)) { organisation = o; break; }
  }
  return {
    base: found.size ? base : words.replace(/\s+/g, " ").trim(),
    markers: [...found],
    status: found.has("cancelled") ? "cancelled" : null,
    meeting_kind: found.has("special") ? "special" : found.has("concurrent") ? "concurrent" : null,
    organisation,
  };
}

/* ------------------------------------------------------------------------- *
 * Each endpoint's closed list of fields (R4–R10).
 * ------------------------------------------------------------------------- */

const given = (v) => (v === undefined ? null : v);
const DAY = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?)?$/;
/** A date as the source gives it: its day when it is a midnight timestamp (`2024-01-09T00:00:00`), else
 *  the value as written; never shifted to a zone. */
export function dayOf(v) {
  if (typeof v !== "string") return given(v);
  const m = DAY.exec(v.trim());
  return m ? m[1] : v;
}
const STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]00:?00)?$/;
/** A `…UTC` field as the UTC instant its name says it is, though its value carries no `Z` (R8). */
export function utcOf(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = STAMP.exec(v.trim());
  return m ? m[1] + "Z" : v;
}
const flag = (v) => (v === 1 || v === true ? true : v === 0 || v === false ? false : given(v));

const READERS = {
  bodies(o, ctx) {
    const n = readBodyName(o.BodyName, ctx);
    return {
      ids: { BodyId: o.BodyId },
      label: given(o.BodyName),
      facts: { BodyId: o.BodyId, name: given(o.BodyName), type: given(o.BodyTypeName), base: n.base,
               status: n.status, meeting_kind: n.meeting_kind, organisation: n.organisation },
      extra: { markers: n.markers },
    };
  },
  persons(o) {
    const name = given(o.PersonFullName);
    return {
      ids: { PersonId: o.PersonId },
      label: name,
      facts: { PersonId: o.PersonId, name, name_normal: typeof name === "string" ? name.replace(/\s+/g, " ").trim() : name,
               active: flag(o.PersonActiveFlag) },
    };
  },
  officerecords(o, ctx, at) {
    const end = o.OfficeRecordEndDate == null || o.OfficeRecordEndDate === "" ? null : dayOf(o.OfficeRecordEndDate);
    const day = typeof at === "string" && /^\d{4}-\d{2}-\d{2}/.test(at) ? at.slice(0, 10) : null;
    const planned = end === null ? false : day === null || !/^\d{4}-\d{2}-\d{2}$/.test(end) ? null : end > day;
    return {
      ids: { OfficeRecordId: o.OfficeRecordId, PersonId: given(o.OfficeRecordPersonId), BodyId: given(o.OfficeRecordBodyId) },
      label: null,
      facts: { OfficeRecordId: o.OfficeRecordId, PersonId: given(o.OfficeRecordPersonId), BodyId: given(o.OfficeRecordBodyId),
               role: given(o.OfficeRecordMemberType), start: dayOf(given(o.OfficeRecordStartDate)), end },
      extra: { end_planned: planned,
               ...(planned === null ? { end_planned_why: localize("legistar-reader.index.the_captures_own_date_was", "the capture's own date was not given, so whether this end is still to come cannot be said") } : {}) },
    };
  },
  events(o, ctx) {
    const n = readBodyName(o.EventBodyName, ctx);
    return {
      ids: { EventId: o.EventId, BodyId: given(o.EventBodyId) },
      label: given(o.EventBodyName),
      facts: { EventId: o.EventId, BodyId: given(o.EventBodyId), body: given(o.EventBodyName),
               date: typeof o.EventDate === "string" ? o.EventDate.trim().slice(0, 10) : given(o.EventDate),
               time: given(o.EventTime),
               status: n.status, meeting_kind: n.meeting_kind, organisation: n.organisation,
               agenda_status: given(o.EventAgendaStatusName), minutes_status: given(o.EventMinutesStatusName),
               agenda_file: given(o.EventAgendaFile), minutes_file: given(o.EventMinutesFile),
               agenda_last_published: utcOf(o.EventAgendaLastPublishedUTC),
               minutes_last_published: utcOf(o.EventMinutesLastPublishedUTC),
               in_site: given(o.EventInSiteURL) },
      extra: { labels: { agenda_last_published: PUBLISHED_LABEL, minutes_last_published: PUBLISHED_LABEL } },
    };
  },
  eventitems(o) {
    const named = (id, name) => (Number.isInteger(id) ? { PersonId: id } : name == null || name === "" ? null : { name });
    return {
      ids: { EventItemId: o.EventItemId, EventId: given(o.EventItemEventId), MatterId: given(o.EventItemMatterId) },
      label: given(o.EventItemTitle),
      facts: { EventItemId: o.EventItemId, EventId: given(o.EventItemEventId), agenda_number: given(o.EventItemAgendaNumber),
               MatterId: given(o.EventItemMatterId), MatterFile: given(o.EventItemMatterFile), title: given(o.EventItemTitle),
               action: given(o.EventItemActionName), passed: flag(o.EventItemPassedFlag),
               mover: named(o.EventItemMoverId, o.EventItemMover), seconder: named(o.EventItemSeconderId, o.EventItemSeconder) },
    };
  },
  votes(o) {
    return {
      ids: { VoteId: o.VoteId, EventItemId: given(o.VoteEventItemId), PersonId: given(o.VotePersonId) },
      label: null,
      facts: { VoteId: o.VoteId, EventItemId: given(o.VoteEventItemId), PersonId: given(o.VotePersonId),
               value: given(o.VoteValueName), result: given(o.VoteResult) },
    };
  },
  matters(o) {
    return {
      ids: { MatterId: o.MatterId },
      label: given(o.MatterFile),
      facts: { MatterId: o.MatterId, MatterFile: given(o.MatterFile), type: given(o.MatterTypeName),
               status: given(o.MatterStatusName), intro_date: dayOf(given(o.MatterIntroDate)),
               passed_date: dayOf(given(o.MatterPassedDate)), enactment_number: given(o.MatterEnactmentNumber),
               enactment_date: dayOf(given(o.MatterEnactmentDate)) },
    };
  },
};

/* The second guard of R3: a fact (or a part of one) named as a contact field never leaves. */
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) if (!isContactField(k)) out[k] = scrub(x);
  return out;
}

/* ------------------------------------------------------------------------- *
 * Paging (R11).
 * ------------------------------------------------------------------------- */

function pageOf(addr, count) {
  if (addr.record !== null) return null;
  const skipRaw = queryParam(addr.query, "$skip");
  const topRaw = queryParam(addr.query, "$top");
  const skip = skipRaw !== null && /^\d+$/.test(skipRaw) ? Number(skipRaw) : 0;
  const asked = topRaw !== null && /^\d+$/.test(topRaw) ? Number(topRaw) : null;
  const top = asked !== null && asked > 0 && asked < PAGE_SIZE ? asked : PAGE_SIZE;
  return { skip, top, may_continue: count >= top };
}

/** The address of the page after this one: the same address, every other part of its query kept as
 *  written, `$skip` advanced by the page's size (1,000 unless the address asks fewer). `page` is
 *  the parse's own; given and showing a short page, there is no next page and the answer is null. */
export function nextPage(locator, page) {
  const addr = readAddress(locator);
  if (addr.why || addr.record !== null) return null;
  if (page && typeof page === "object" && page.may_continue === false) return null;
  const p = page && typeof page === "object" && Number.isInteger(page.skip) && Number.isInteger(page.top)
    ? page : pageOf(addr, Infinity);
  const next = p.skip + p.top;
  const [head, rest = null] = splitQuery(locator.trim());
  const parts = rest === null || rest === "" ? [] : rest.split("&");
  let set = false;
  const out = parts.map((part) => {
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    let dk;
    try { dk = decodeURIComponent(k); } catch { dk = k; }
    if (dk.toLowerCase() !== "$skip") return part;
    set = true;
    return `${k}=${next}`;
  });
  if (!set) out.push(`$skip=${next}`);
  return `${head}?${out.join("&")}`;
}
function splitQuery(s) {
  const h = s.indexOf("#");
  const t = h < 0 ? s : s.slice(0, h);
  const q = t.indexOf("?");
  return q < 0 ? [t, null] : [t.slice(0, q), t.slice(q + 1)];
}

/** Join the pages of ONE endpoint of one client by row key. A key read twice with the same facts is
 *  one row; with different facts it is reported in `conflicts` and the first reading kept, never
 *  silently overwritten. Pages of another endpoint or client are refused, each named in `refused`. */
export function readPages(parses) {
  const list = Array.isArray(parses) ? parses.filter((p) => p && Array.isArray(p.rows)) : [];
  if (!list.length) return { endpoint: null, client: null, rows: [], conflicts: [], refused: [], pages: 0,
                             complete: false, why: "no page was given" };
  const { endpoint, client } = list[0];
  const rows = [], byKey = new Map(), conflicts = [], refused = [];
  let pages = 0, complete = false;
  for (const p of list) {
    if (p.endpoint !== endpoint || p.client !== client) {
      refused.push({ endpoint: p.endpoint, client: p.client,
                     why: localize("legistar-reader.index.a_page_of_client_endpoint", "a page of {client}/{endpoint} is not a page of {client_2}/{endpoint_2}", { client: String(p.client), endpoint: String(p.endpoint), client_2: String(client), endpoint_2: String(endpoint) }) });
      continue;
    }
    pages++;
    if (!p.page || p.page.may_continue === false) complete = true;
    for (const r of p.rows) {
      const was = byKey.get(r.key);
      if (!was) { byKey.set(r.key, r); rows.push(r); continue; }
      if (JSON.stringify(was.facts) !== JSON.stringify(r.facts))
        conflicts.push({ key: r.key, kept: was.facts, other: r.facts,
                         why: localize("legistar-reader.index.the_same_row_was_read", "the same row was read twice with different facts; the first reading is kept") });
    }
  }
  return { endpoint, client, rows, conflicts, refused, pages, complete,
           ...(complete ? {} : { why: localize("legistar-reader.index.every_page_given_was_full", "every page given was full, so a further page may exist") }) };
}

/* ------------------------------------------------------------------------- *
 * The content type.
 * ------------------------------------------------------------------------- */

/** Read a capture into rows (R2–R10). Throws only when the capture is not one `detect` matches. */
export function parse(ctx) {
  const c = capture(ctx);
  if (c.why) throw new Error(`legistar-reader: ${c.why}`);
  const spec = ENDPOINTS[c.endpoint];
  const read = READERS[c.endpoint];
  const at = typeof ctx?.at === "string" ? ctx.at : null;
  const rows = c.objects.map((o, i) => {
    const r = read(o, ctx, at);
    const id = o[spec.id];
    return {
      kind: spec.kind, key: `legistar:${spec.kind}:${id}`, label: r.label,
      ids: scrub(r.ids), facts: scrub(r.facts), ...scrub(r.extra || {}),
      source: i, assertion: "system", basis: BASIS,
    };
  });
  if (c.endpoint === "persons") sameNames(rows);
  const page = pageOf(c, rows.length);
  if (page) page.next = page.may_continue ? nextPage(ctx.locator, page) : null;
  return {
    endpoint: c.endpoint, client: c.client, rows, page,
    facts: { client: c.client, endpoint: c.endpoint, record: c.record, count: rows.length, at,
             assertion: "system", basis: BASIS },
  };
}

/* R5: two persons whose names fold to one are both read, each naming the other; nothing merges. */
function sameNames(rows) {
  const by = new Map();
  for (const r of rows) {
    const n = r.facts.name_normal;
    if (typeof n !== "string" || !n) continue;
    if (!by.has(n)) by.set(n, []);
    by.get(n).push(r);
  }
  for (const group of by.values()) {
    if (group.length < 2) continue;
    for (const r of group) r.same_name_as = group.filter((x) => x !== r).map((x) => x.ids.PersonId);
  }
}

/** Is this a Legistar Web API capture of an endpoint this reader reads? (R1) */
export function detect(ctx) {
  const c = capture(ctx);
  if (c.why) return { match: false, confidence: CONFIDENCE.NONE, signals: [], why: c.why };
  return { match: true, confidence: CONFIDENCE.CERTAIN,
           signals: [localize("legistar-reader.index.a_legistar_web_api_address", "a Legistar Web API address of {client}/{endpoint}", { client: String(c.client), endpoint: String(c.endpoint) }),
                     `${c.objects.length} ${c.endpoint} row${c.objects.length === 1 ? "" : "s"}, each carrying ${ENDPOINTS[c.endpoint].id}`] };
}

const OUTCOME = { vote: ["value"], event_item: ["passed"] };
const NAMES = { body: ["name"], person: ["name"] };

/** Compare two readings of one address by row key (R12). */
export function assess(before, after) {
  const a = before && Array.isArray(before.rows) ? before.rows : null;
  const b = after && Array.isArray(after.rows) ? after.rows : null;
  if (!a || !b || !a.length || !b.length)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("legistar-reader.index.one_of_the_two_readings", "one of the two readings holds no rows, so an emptied list cannot be told from a failed read and nothing is claimed either way") };
  if (before.endpoint !== after.endpoint || before.client !== after.client)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("legistar-reader.index.the_two_readings_are_of", "the two readings are of different lists ({client}/{endpoint}, {client_2}/{endpoint_2})", { client: String(before.client), endpoint: String(before.endpoint), client_2: String(after.client), endpoint_2: String(after.endpoint) }) };
  const d = diffEntities(a, b);
  const events = [];
  for (const e of d.gone)
    events.push(event("delisted", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_kind_row_legistar_listed", "a {kind} row Legistar listed is no longer listed", { kind: String(e.kind) }) }));
  for (const e of d.appeared)
    events.push(e.kind === "event"
      ? event("scheduled", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_meeting_was_added_to", "a meeting was added to Legistar's list") })
      : event("item_added", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_kind_row_was_added", "a {kind} row was added to Legistar's list", { kind: String(e.kind) }) }));
  for (const alt of d.altered) {
    const r = alt.entity, f = new Map(alt.moved.map((m) => [m.fact, m])), base = { key: r.key, label: r.label ?? null };
    const take = (k) => { const m = f.get(k); f.delete(k); return m; };
    if (r.kind === "event") {
      const st = take("status");
      if (st && st.now === "cancelled")
        events.push(event("cancelled", { ...base, was: st.was, now: st.now, why: localize("legistar-reader.index.a_meeting_is_now_marked", "a meeting is now marked cancelled") }));
      else if (st) f.set("status", st);
      const dt = take("date"), tm = take("time");
      if (dt || tm)
        events.push(event("rescheduled", { ...base, was: { date: alt.was.facts.date, time: alt.was.facts.time },
                      now: { date: r.facts.date, time: r.facts.time }, why: localize("legistar-reader.index.a_meetings_date_or_time", "a meeting's date or time moved") }));
      for (const kind of ["agenda", "minutes"]) {
        const m = take(`${kind}_last_published`);
        if (!m) continue;
        if (m.now == null) { f.set(`${kind}_last_published`, m); continue; }
        events.push(event(`${kind}_published`, { ...base, was: m.was, now: m.now, label_of_time: PUBLISHED_LABEL,
                      why: localize("legistar-reader.index.legistars_kind_for_this_meeting", "Legistar's {kind} for this meeting carries a new last-publication time", { kind: String(kind) }) }));
      }
    }
    for (const k of OUTCOME[r.kind] || []) {
      const m = take(k);
      if (m) events.push(event("outcome_changed", { ...base, fact: k, was: m.was, now: m.now,
                          why: localize("legistar-reader.index.a_recorded_v1_changed", "a recorded {v1} changed", { v1: String(r.kind === "vote" ? "vote" : "outcome") }) }));
    }
    for (const k of NAMES[r.kind] || []) {
      const m = take(k);
      if (m) events.push(event("renamed", { ...base, was: m.was, now: m.now, why: `a ${r.kind}'s name changed` }));
    }
    for (const m of f.values())
      events.push(event("item_changed", { ...base, fact: m.fact, was: m.was, now: m.now,
                    why: `a ${r.kind}'s ${m.fact} changed` }));
  }
  bySeverity(events);
  const changed = new Set([...d.altered.map((x) => x.entity.key)]);
  const intact = a.filter((r) => !changed.has(r.key) && b.some((x) => x.key === r.key)).length;
  return {
    meaningful: isMeaningful(events), significance: worstSignificance(events), events,
    confirmed: intact ? { entries: b.length, intact } : null,
    why: events.length ? localize("legistar-reader.index.intact_of_length_rows_unchanged", "{intact} of {length} rows unchanged; {length_2} change{v1}", { intact: String(intact), length: String(a.length), length_2: String(events.length), v1: String(events.length === 1 ? "" : "s") })
                       : localize("legistar-reader.index.all_length_rows_unchanged", "all {length} rows unchanged", { length: String(b.length) }),
  };
}

export const legistar = Object.freeze({
  key: KEY, label: localize("legistar-reader.index.legistar_web_api_capture", "Legistar Web API capture"), version: 1, contract: CONTRACT.MEMBERSHIP,
  detect, parse, assess,
});

/* Registering twice on one registry registers nothing the second time (as doctypes R2). */
const REGISTERED = new WeakSet();
/** Register this content type through `docprofile`'s registry seam (R1; as `doctypes` does). */
export function registerLegistar(register) {
  if (typeof register !== "function") throw new TypeError("legistar-reader: registerLegistar needs docprofile's register");
  if (REGISTERED.has(register)) return;
  REGISTERED.add(register);
  register(legistar);
}

export default legistar;
