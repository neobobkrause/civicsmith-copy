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
/** @import { ContentType, DoctypeContext, Entity, EntityFacts, EventHead, Recogniser } from "../docprofile/registry.mjs" */

/**
 * A value as the source gives it: what a Legistar capture's JSON holds at a field.
 * @typedef {string | number | boolean | null | GivenList | Facts} Given
 */
/**
 * A list as the source gives it.
 * @typedef {ReadonlyArray<Given>} GivenList
 */
/**
 * Named values as the source gives them, or as a row states them: a source object, a row's ids, facts or extras.
 * @typedef {{ readonly [field: string]: Given }} Facts
 */
/**
 * An endpoint this module reads.
 * @typedef {"bodies" | "persons" | "officerecords" | "events" | "eventitems" | "votes" | "matters"} Endpoint
 */
/**
 * The kind of row an endpoint gives.
 * @typedef {"body" | "person" | "seat" | "event" | "event_item" | "vote" | "matter"} RowKind
 */
/**
 * An endpoint's id field, which every row of it carries, and the kind of row it gives.
 * @typedef {{ readonly id: string, readonly kind: RowKind }} EndpointSpec
 */
/**
 * The endpoints read (R1).
 * @typedef {{ readonly bodies: EndpointSpec, readonly persons: EndpointSpec, readonly officerecords: EndpointSpec, readonly events: EndpointSpec, readonly eventitems: EndpointSpec, readonly votes: EndpointSpec, readonly matters: EndpointSpec }} Endpoints
 */
/**
 * What a Legistar Web API address names (R1, R14): the client as written, the endpoint, the trailing id of a one-record
 * address, and the query as written.
 * @typedef {{ readonly client: string, readonly endpoint: Endpoint, readonly record: number | null, readonly query: string | null }} Address
 */
/**
 * Why something could not be read.
 * @typedef {{ readonly why: string }} Refusal
 */
/**
 * What a content type of this module is handed: `docprofile`'s context, and the capture's bytes where no text is given.
 * @typedef {DoctypeContext & { readonly bytes?: Uint8Array }} LegistarContext
 */
/**
 * A body's name read against the view (R4).
 * @typedef {Object} BodyName
 * @property {string} base
 * @property {string[]} markers
 * @property {"cancelled" | null} status
 * @property {"special" | "concurrent" | null} meeting_kind
 * @property {string | null} organisation
 */
/**
 * A page of an endpoint's list (R11): where it starts, its size, whether a further page may exist, and that page's address.
 * @typedef {Object} Page
 * @property {number} skip
 * @property {number} top
 * @property {boolean} may_continue
 * @property {string | null} [next]
 * @bound top: a whole number, 1 to 1,000
 */
/**
 * The words that label the two last-published facts of an event (R8).
 * @typedef {{ readonly agenda_last_published: string, readonly minutes_last_published: string }} PublishedLabels
 */
/**
 * One row of a capture (R2 to R10): its kind, key, label, the source's identifiers, its facts, the row's index in the
 * capture, the system assertion and its basis; and, as its endpoint gives them, the markers its body's name carried, whether
 * a seat's end is still to come and why that cannot be said, the labels of an event's times, and the persons of the same
 * folded name (R5).
 * @typedef {Object} LegistarRow
 * @property {RowKind} kind
 * @property {string} key
 * @property {Given} label
 * @property {Facts} ids
 * @property {Facts} facts
 * @property {number} source
 * @property {"system"} assertion
 * @property {string} basis
 * @property {ReadonlyArray<string>} [markers]
 * @property {boolean | null} [end_planned]
 * @property {string} [end_planned_why]
 * @property {PublishedLabels} [labels]
 * @property {Array<Given | undefined>} [same_name_as]
 */
/**
 * A capture's own facts (R2): its client, endpoint, record id, row count, date, and the system assertion.
 * @typedef {Object} ReadingFacts
 * @property {string} client
 * @property {Endpoint} endpoint
 * @property {number | null} record
 * @property {number} count
 * @property {string | null} at
 * @property {"system"} assertion
 * @property {string} basis
 */
/**
 * What `parse` gives (R2): the endpoint, client, rows, page and the capture's facts.
 * @typedef {Object} LegistarReading
 * @property {Endpoint} endpoint
 * @property {string} client
 * @property {LegistarRow[]} rows
 * @property {Page | null} page
 * @property {ReadingFacts} facts
 */
/**
 * What `detect` answers (R1): a match, how sure and on what signals; or no match, and why.
 * @typedef {{ match: true, confidence: string, signals: string[] } | { match: false, confidence: string, signals: string[], why: string }} LegistarDetection
 */
/**
 * This content type as both `docprofile`'s seam and a recogniser registry take it (R1).
 * @typedef {ContentType & Recogniser<DoctypeContext>} LegistarType
 */
/**
 * A row key read twice with different facts (R11): the first reading kept, the other, and why.
 * @typedef {{ key: string, kept: Facts, other: Facts, why: string }} PageConflict
 */
/**
 * A page of another list, refused (R11).
 * @typedef {{ endpoint: Endpoint, client: string, why: string }} RefusedPage
 */
/**
 * The pages of one endpoint joined by key (R11).
 * @typedef {Object} JoinedPages
 * @property {Endpoint | null} endpoint
 * @property {string | null} client
 * @property {LegistarRow[]} rows
 * @property {PageConflict[]} conflicts
 * @property {RefusedPage[]} refused
 * @property {number} pages
 * @property {boolean} complete
 * @property {string} [why]
 */
/**
 * How many rows were read unchanged, of how many (R12).
 * @typedef {{ entries: number, intact: number }} Confirmed
 */
/**
 * What `assess` answers (R12): whether anything meaningful changed, the worst grade, the catalogue's events, what was
 * confirmed unchanged, and why.
 * @typedef {Object} LegistarAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {Confirmed | null} confirmed
 * @property {string} why
 */

/** @type {string} */
export const KEY = "legistar_api";
/** @type {string} */
export const BASIS = "as recorded by Legistar";
/** @type {number} */
export const PAGE_SIZE = 1000;
/** @type {string} */
export const PUBLISHED_LABEL = localize("legistar-reader.index.last_publication_an_upper_bound", "last publication, an upper bound");

/* The endpoints read, each with the id field every row of it carries and the row kind it gives. */
/** @type {Endpoints} */
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
/** @type {ReadonlyArray<string>} */
export const CONTACT_FIELDS = Object.freeze([
  "PersonEmail", "PersonEmail2", "PersonPhone", "PersonPhone2", "PersonFax", "PersonAddress1",
  "PersonAddress2", "PersonCity1", "PersonCity2", "PersonState1", "PersonState2", "PersonZip1",
  "PersonZip2", "PersonWWW", "OfficeRecordEmail",
]);
const CONTACT_NAME = /e-?mail|phone|fax|address|street|city\d|state\d|zip|www|website/i;
/** Whether a field's name names a contact field (R3).
 *  @param {string} name
 *  @returns {boolean} */
export function isContactField(name) {
  return CONTACT_FIELDS.includes(name) || CONTACT_NAME.test(String(name));
}

/* ------------------------------------------------------------------------- *
 * The address.
 * ------------------------------------------------------------------------- */

const ADDRESS = /^(?:https?:\/\/)?webapi\.legistar\.com\/v1\/([^/?#]+)\/([^?#]*?)\/?(?:\?([^#]*))?(?:#.*)?$/i;

/** What a locator names: `{client, endpoint, record, query}` for a Legistar Web API address of an
 *  endpoint this module reads, `record` the trailing id of a one-record address (`events/9016`),
 *  else `{why}`. The client is read from the address, never matched against a held list (R14).
 *  @param {string | null | undefined} locator
 *  @returns {Address | Refusal} */
export function readAddress(locator) {
  if (typeof locator !== "string" || !locator)
    return { why: "no address was given, so whether this is a Legistar Web API capture cannot be said" };
  const m = ADDRESS.exec(locator.trim());
  if (!m) return { why: "the address is not a Legistar Web API address (webapi.legistar.com/v1/<client>/<endpoint>)" };
  const segs = (m[2] ?? "").split("/").filter(Boolean);
  if (!segs.length) return { why: localize("legistar-reader.index.the_address_names_a_client", "the address names a Legistar client but no endpoint") };
  /** @type {number | null} */
  let record = null;
  const last = segs[segs.length - 1] ?? "";
  let name = last.toLowerCase();
  if (/^\d+$/.test(last)) {
    if (segs.length < 2) return { why: localize("legistar-reader.index.the_address_names_a_record", "the address names a record id but no endpoint") };
    record = Number(last);
    name = (segs[segs.length - 2] ?? "").toLowerCase();
  }
  const endpoint = name;
  if (!isEndpoint(endpoint))
    return { why: localize("legistar-reader.index.the_address_names_the_legistar", "the address names the Legistar endpoint \"{name}\", which this reader does not read", { name: String(endpoint) }) };
  return { client: decodeURIComponent(m[1] ?? ""), endpoint, record, query: m[3] ?? null };
}
/** @param {string} name @returns {name is Endpoint} */
const isEndpoint = (name) => Object.hasOwn(ENDPOINTS, name);

/* One query parameter's value as written, its name compared after decoding (`%24skip` is `$skip`). */
/** @param {string | null} query @param {string} name @returns {string | null} */
function queryParam(query, name) {
  if (!query) return null;
  for (const part of query.split("&")) {
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    const dk = decodedOr(k.replace(/\+/g, " "), k);
    if (dk.toLowerCase() === name) return i < 0 ? "" : part.slice(i + 1);
  }
  return null;
}

/* A query part as decoded, or the fallback where it is not well formed. */
/** @param {string} text @param {string} fallback @returns {string} */
function decodedOr(text, fallback) {
  try { return decodeURIComponent(text); } catch { return fallback; }
}

/* ------------------------------------------------------------------------- *
 * The bytes.
 * ------------------------------------------------------------------------- */

/** @param {LegistarContext | null | undefined} ctx @returns {string | null} */
function textOf(ctx) {
  const text = ctx?.text;
  if (typeof text === "string") return text;
  const b = ctx?.bytes;
  if (b instanceof Uint8Array) return new TextDecoder("utf-8").decode(b);
  return null;
}

/* The last bytes decoded, kept so `detect` and `parse` of one capture decode it once. Pure: the
   answer depends only on the text. */
/** @type {{ readonly text: string, readonly value: { readonly json: Given } | Refusal } | null} */
let LAST = null;
/** @param {string} text @returns {{ readonly json: Given } | Refusal} */
function decode(text) {
  const last = LAST;
  if (last !== null && last.text === text) return last.value;
  /** @type {{ readonly json: Given } | Refusal} */
  let value;
  try { value = { json: givenOf(JSON.parse(text)) }; }
  catch (e) { value = { why: localize("legistar-reader.index.the_bytes_are_not_json", "the bytes are not JSON ({String})", { String: String(String((e instanceof Error && e.message) || e)) }) }; }
  LAST = { text, value };
  return value;
}

/* The parsed JSON as `Given`, each part checked as it is read: JSON holds nothing else, so the answer is the same value. */
/** @param {unknown} v @returns {Given} */
function givenOf(v) {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (isParsedList(v)) return v.map(givenOf);
  if (isParsedObject(v)) {
    /** @type {{ [field: string]: Given }} */
    const out = {};
    /* each key an own property, as JSON.parse makes it (`__proto__` among them) */
    for (const [k, x] of Object.entries(v)) Object.defineProperty(out, k, { value: givenOf(x), enumerable: true, writable: true, configurable: true });
    return out;
  }
  return null;
}
/**
 * A list as JSON.parse gives it.
 * @typedef {ReadonlyArray<unknown>} ParsedList
 */
/**
 * An object as JSON.parse gives it.
 * @typedef {{ readonly [field: string]: unknown }} ParsedObject
 */
/** @param {unknown} v @returns {v is ParsedList} */
const isParsedList = (v) => Array.isArray(v);
/** @param {unknown} v @returns {v is ParsedObject} */
const isParsedObject = (v) => typeof v === "object" && v !== null;

/** Read a capture into its endpoint and its objects, or say why it is not one: the address must
 *  name an endpoint (R1), the bytes must parse as a JSON array of objects each carrying that
 *  endpoint's id field, or, at a one-record address, as one such object.
 *  @param {LegistarContext | null | undefined} ctx
 *  @returns {(Address & { readonly objects: Facts[] }) | Refusal} */
function capture(ctx) {
  const addr = readAddress(ctx?.locator);
  if ("why" in addr) return addr;
  const text = textOf(ctx);
  if (text === null) return { why: localize("legistar-reader.index.no_text_was_supplied_with", "no text was supplied with the address, so there is nothing to read") };
  const d = decode(text);
  if ("why" in d) return d;
  const { id } = ENDPOINTS[addr.endpoint];
  const record = addr.record;
  const json = d.json;
  /** @type {GivenList} */
  let objects;
  if (isList(json)) objects = json;
  else if (record !== null && json && typeof json === "object") objects = [json];
  else return { why: record !== null
    ? "the bytes are JSON but not an object or an array of objects"
    : localize("legistar-reader.index.the_bytes_are_json_but", "the bytes are JSON but not an array, as a list of {endpoint} is", { endpoint: String(addr.endpoint) }) };
  /** @type {Facts[]} */
  const read = [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (!o || typeof o !== "object" || isList(o))
      return { why: localize("legistar-reader.index.entry_i_of_the_array", "entry {i} of the array is not an object", { i: String(i) }) };
    if (!Number.isInteger(o[id]))
      return { why: localize("legistar-reader.index.entry_i_carries_no_id", "entry {i} carries no {id}, the id field of every {endpoint} row", { i: String(i), id: String(id), endpoint: String(addr.endpoint) }) };
    read.push(o);
  }
  const first = read[0];
  if (record !== null && read.length === 1 && first && first[id] !== record)
    return { why: localize("legistar-reader.index.the_record_carries_id_v1", "the record carries {id} {v1}, not the {record} its address names", { id: String(id), v1: String(first[id]), record: String(record) }) };
  return { ...addr, objects: read };
}
/** @param {Given | undefined} v @returns {v is GivenList} */
const isList = (v) => Array.isArray(v);

/* ------------------------------------------------------------------------- *
 * The view's words (R4, R14).
 * ------------------------------------------------------------------------- */

/** @param {LegistarContext | null | undefined} ctx @returns {Array<{ marker: string, re: RegExp }>} */
function markers(ctx) {
  /** @type {Array<{ marker: string, re: RegExp }>} */
  const out = [];
  for (const e of vocabulary(ctx, "meeting_markers")) {
    if (!("marker" in e)) continue;
    const marker = e.marker;
    if (!["cancelled", "special", "concurrent"].includes(marker)) continue;
    const re = vocabRegex(e.pattern, null, "g");
    if (re) out.push({ marker, re });
  }
  return out;
}
/** @param {LegistarContext | null | undefined} ctx @returns {Array<{ organisation: string, re: RegExp }>} */
function variants(ctx) {
  /** @type {Array<{ organisation: string, re: RegExp }>} */
  const out = [];
  for (const e of vocabulary(ctx, "body_variants")) {
    const named = "organisation" in e ? e : null;
    if (named === null) continue;
    const organisation = named.organisation;
    if (typeof organisation !== "string" || !organisation) continue;
    const re = vocabRegex("pattern" in e ? e.pattern : undefined);
    if (re) out.push({ organisation, re });
  }
  return out;
}

/** A body's name read against the view: the markers it carries, its base name (the name with the
 *  marked words, and the separators left beside them, removed), its status and kind of meeting, and
 *  the organisation the body-variant map names for it. With no marker or map in the view, the name
 *  is its own base and nothing is marked (a view without the fact means no local recognition).
 *  @param {Given | undefined} name
 *  @param {LegistarContext | null | undefined} ctx
 *  @returns {BodyName} */
export function readBodyName(name, ctx) {
  const words = typeof name === "string" ? name : "";
  /** @type {Set<string>} */
  const found = new Set();
  let base = words;
  for (const { marker, re } of markers(ctx)) {
    if (words.search(re) === -1) continue;
    found.add(marker);
    base = base.replace(re, " ");
  }
  base = base.replace(/\s+/g, " ").trim().replace(/\s*[-–—,:;]+$/u, "").replace(/^[-–—,:;]+\s*/u, "").trim();
  /** @type {string | null} */
  let organisation = null;
  for (const { organisation: o, re } of variants(ctx)) {
    if (words.search(re) !== -1) { organisation = o; break; }
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

/** @param {Given | undefined} v @returns {Given} */
const given = (v) => (v === undefined ? null : v);
const DAY = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?)?$/;
/** A date as the source gives it: its day when it is a midnight timestamp (`2024-01-09T00:00:00`), else
 *  the value as written; never shifted to a zone.
 *  @param {Given | undefined} v
 *  @returns {Given} */
export function dayOf(v) {
  if (typeof v !== "string") return given(v);
  const m = DAY.exec(v.trim());
  return m ? (m[1] ?? v) : v;
}
const STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]00:?00)?$/;
/** A `…UTC` field as the UTC instant its name says it is, though its value carries no `Z` (R8).
 *  @param {Given | undefined} v
 *  @returns {string | null} */
export function utcOf(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = STAMP.exec(v.trim());
  return m ? (m[1] ?? "") + "Z" : v;
}
/** @param {Given | undefined} v @returns {Given} */
const flag = (v) => (v === 1 || v === true ? true : v === 0 || v === false ? false : given(v));

/**
 * One source object read by its endpoint's closed list: the source's identifiers, the row's label, its facts and extras.
 * @typedef {{ readonly ids: Facts, readonly label: Given, readonly facts: Facts, readonly extra?: RowExtra }} SourceReading
 */
/**
 * What a row carries beside its facts, as its endpoint gives it (R4 to R8).
 * @typedef {Object} RowExtra
 * @property {ReadonlyArray<string>} [markers]
 * @property {boolean | null} [end_planned]
 * @property {string} [end_planned_why]
 * @property {PublishedLabels} [labels]
 * @property {Array<Given | undefined>} [same_name_as]
 */
/**
 * An endpoint's reader of one source object.
 * @typedef {(o: Facts, ctx: LegistarContext | null | undefined, at: string | null) => SourceReading} SourceReader
 */
/** @type {{ readonly bodies: SourceReader, readonly persons: SourceReader, readonly officerecords: SourceReader, readonly events: SourceReader, readonly eventitems: SourceReader, readonly votes: SourceReader, readonly matters: SourceReader }} */
const READERS = {
  bodies(o, ctx) {
    const n = readBodyName(o.BodyName, ctx);
    return {
      ids: { BodyId: given(o.BodyId) },
      label: given(o.BodyName),
      facts: { BodyId: given(o.BodyId), name: given(o.BodyName), type: given(o.BodyTypeName), base: n.base,
               status: n.status, meeting_kind: n.meeting_kind, organisation: n.organisation },
      extra: { markers: n.markers },
    };
  },
  persons(o) {
    const name = given(o.PersonFullName);
    return {
      ids: { PersonId: given(o.PersonId) },
      label: name,
      facts: { PersonId: given(o.PersonId), name, name_normal: typeof name === "string" ? name.replace(/\s+/g, " ").trim() : name,
               active: flag(o.PersonActiveFlag) },
    };
  },
  officerecords(o, ctx, at) {
    const end = o.OfficeRecordEndDate == null || o.OfficeRecordEndDate === "" ? null : dayOf(o.OfficeRecordEndDate);
    const day = typeof at === "string" && /^\d{4}-\d{2}-\d{2}/.test(at) ? at.slice(0, 10) : null;
    const planned = end === null ? false : day === null || !/^\d{4}-\d{2}-\d{2}$/.test(String(end)) ? null : String(end) > day;
    /** @type {RowExtra} */
    const extra = { end_planned: planned };
    if (planned === null) extra.end_planned_why = localize("legistar-reader.index.the_captures_own_date_was", "the capture's own date was not given, so whether this end is still to come cannot be said");
    return {
      ids: { OfficeRecordId: given(o.OfficeRecordId), PersonId: given(o.OfficeRecordPersonId), BodyId: given(o.OfficeRecordBodyId) },
      label: null,
      facts: { OfficeRecordId: given(o.OfficeRecordId), PersonId: given(o.OfficeRecordPersonId), BodyId: given(o.OfficeRecordBodyId),
               role: given(o.OfficeRecordMemberType), start: dayOf(given(o.OfficeRecordStartDate)), end },
      extra,
    };
  },
  events(o, ctx) {
    const n = readBodyName(o.EventBodyName, ctx);
    const date = o.EventDate;
    return {
      ids: { EventId: given(o.EventId), BodyId: given(o.EventBodyId) },
      label: given(o.EventBodyName),
      facts: { EventId: given(o.EventId), BodyId: given(o.EventBodyId), body: given(o.EventBodyName),
               date: typeof date === "string" ? date.trim().slice(0, 10) : given(date),
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
    /** @param {Given | undefined} id @param {Given | undefined} name @returns {Given} */
    const named = (id, name) => {
      if (typeof id === "number" && Number.isInteger(id)) {
        /** @type {Facts} */
        const person = { PersonId: id };
        return person;
      }
      if (name == null || name === "") return null;
      /** @type {Facts} */
      const written = { name };
      return written;
    };
    return {
      ids: { EventItemId: given(o.EventItemId), EventId: given(o.EventItemEventId), MatterId: given(o.EventItemMatterId) },
      label: given(o.EventItemTitle),
      facts: { EventItemId: given(o.EventItemId), EventId: given(o.EventItemEventId), agenda_number: given(o.EventItemAgendaNumber),
               MatterId: given(o.EventItemMatterId), MatterFile: given(o.EventItemMatterFile), title: given(o.EventItemTitle),
               action: given(o.EventItemActionName), passed: flag(o.EventItemPassedFlag),
               mover: named(o.EventItemMoverId, o.EventItemMover), seconder: named(o.EventItemSeconderId, o.EventItemSeconder) },
    };
  },
  votes(o) {
    return {
      ids: { VoteId: given(o.VoteId), EventItemId: given(o.VoteEventItemId), PersonId: given(o.VotePersonId) },
      label: null,
      facts: { VoteId: given(o.VoteId), EventItemId: given(o.VoteEventItemId), PersonId: given(o.VotePersonId),
               value: given(o.VoteValueName), result: given(o.VoteResult) },
    };
  },
  matters(o) {
    return {
      ids: { MatterId: given(o.MatterId) },
      label: given(o.MatterFile),
      facts: { MatterId: given(o.MatterId), MatterFile: given(o.MatterFile), type: given(o.MatterTypeName),
               status: given(o.MatterStatusName), intro_date: dayOf(given(o.MatterIntroDate)),
               passed_date: dayOf(given(o.MatterPassedDate)), enactment_number: given(o.MatterEnactmentNumber),
               enactment_date: dayOf(given(o.MatterEnactmentDate)) },
    };
  },
};

/* The second guard of R3: a fact (or a part of one) named as a contact field never leaves. A row's extras are this
   module's own words and flags, never a source field. */
/** @param {Given} v @returns {Given} */
function scrub(v) {
  if (isList(v)) return v.map(scrub);
  if (!v || typeof v !== "object") return v;
  return scrubFields(v);
}
/** @param {Facts} v @returns {Facts} */
function scrubFields(v) {
  /** @type {{ [field: string]: Given }} */
  const out = {};
  for (const [k, x] of Object.entries(v)) if (!isContactField(k)) out[k] = scrub(x);
  return out;
}

/* ------------------------------------------------------------------------- *
 * Paging (R11).
 * ------------------------------------------------------------------------- */

/** @param {Address} addr @param {number} count @returns {Page | null} */
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
 *  the parse's own; given and showing a short page, there is no next page and the answer is null.
 *  @param {string | null | undefined} locator
 *  @param {Page | null} [page]
 *  @returns {string | null} */
export function nextPage(locator, page) {
  const addr = readAddress(locator);
  if ("why" in addr || addr.record !== null || typeof locator !== "string") return null;
  if (page && typeof page === "object" && page.may_continue === false) return null;
  const p = page && typeof page === "object" && Number.isInteger(page.skip) && Number.isInteger(page.top)
    ? page : pageOf(addr, Infinity);
  if (!p) return null;
  const next = p.skip + p.top;
  const [head, rest = null] = splitQuery(locator.trim());
  const parts = rest === null || rest === "" ? [] : rest.split("&");
  /** @param {string} part @returns {string | null} the part's name as written, where it names `$skip` */
  const skipName = (part) => {
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    return decodedOr(k, k).toLowerCase() === "$skip" ? k : null;
  };
  const out = parts.map((part) => {
    const k = skipName(part);
    return k === null ? part : `${k}=${next}`;
  });
  if (!parts.some((part) => skipName(part) !== null)) out.push(`$skip=${next}`);
  return `${head}?${out.join("&")}`;
}
/** @param {string} s @returns {[string, string | null]} */
function splitQuery(s) {
  const h = s.indexOf("#");
  const t = h < 0 ? s : s.slice(0, h);
  const q = t.indexOf("?");
  return q < 0 ? [t, null] : [t.slice(0, q), t.slice(q + 1)];
}

/** Join the pages of ONE endpoint of one client by row key. A key read twice with the same facts is
 *  one row; with different facts it is reported in `conflicts` and the first reading kept, never
 *  silently overwritten. Pages of another endpoint or client are refused, each named in `refused`.
 *  @param {Array<LegistarReading | null | undefined> | null | undefined} parses
 *  @returns {JoinedPages} */
export function readPages(parses) {
  const list = Array.isArray(parses) ? parses.filter(isReading) : [];
  const head = list[0];
  if (!head) return { endpoint: null, client: null, rows: [], conflicts: [], refused: [], pages: 0,
                      complete: false, why: "no page was given" };
  const { endpoint, client } = head;
  /** @type {LegistarRow[]} */
  const rows = [];
  const byKey = new Map(/** @type {Array<[string, LegistarRow]>} */ ([]));
  /** @type {PageConflict[]} */
  const conflicts = [];
  /** @type {RefusedPage[]} */
  const refused = [];
  let pages = 0, complete = false;
  for (const p of list) {
    if (p.endpoint !== endpoint || p.client !== client) {
      refused.push({ endpoint: p.endpoint, client: p.client,
                     why: localize("legistar-reader.index.a_page_of_client_endpoint", "a page of {client}/{endpoint} is not a page of {client_2}/{endpoint_2}", { client: String(p.client), endpoint: String(p.endpoint), client_2: String(client), endpoint_2: String(endpoint) }) });
      continue;
    }
    pages++;
    const page = p.page;
    if (!page || page.may_continue === false) complete = true;
    for (const r of p.rows) {
      const was = byKey.get(r.key);
      if (!was) { byKey.set(r.key, r); rows.push(r); continue; }
      if (JSON.stringify(was.facts) !== JSON.stringify(r.facts))
        conflicts.push({ key: r.key, kept: was.facts, other: r.facts,
                         why: localize("legistar-reader.index.the_same_row_was_read", "the same row was read twice with different facts; the first reading is kept") });
    }
  }
  /** @type {JoinedPages} */
  const joined = { endpoint, client, rows, conflicts, refused, pages, complete };
  if (!complete) joined.why = localize("legistar-reader.index.every_page_given_was_full", "every page given was full, so a further page may exist");
  return joined;
}

/* ------------------------------------------------------------------------- *
 * The content type.
 * ------------------------------------------------------------------------- */

/** Read a capture into rows (R2–R10). Throws only when the capture is not one `detect` matches.
 *  @param {LegistarContext | null | undefined} ctx
 *  @returns {LegistarReading}
 *  @throws {Error} when the capture is not one `detect` matches, saying why */
export function parse(ctx) {
  const c = capture(ctx);
  if ("why" in c) throw new Error(`legistar-reader: ${c.why}`);
  const spec = ENDPOINTS[c.endpoint];
  const read = READERS[c.endpoint];
  const atGiven = ctx?.at;
  const at = typeof atGiven === "string" ? atGiven : null;
  const rows = c.objects.map((o, i) => {
    const r = read(o, ctx, at);
    const id = o[spec.id];
    /** @type {LegistarRow} */
    const row = {
      kind: spec.kind, key: `legistar:${spec.kind}:${String(id)}`, label: r.label,
      ids: scrubFields(r.ids), facts: scrubFields(r.facts), ...(r.extra || {}),
      source: i, assertion: "system", basis: BASIS,
    };
    return row;
  });
  if (c.endpoint === "persons") sameNames(rows);
  const page = pageOf(c, rows.length);
  if (page) page.next = page.may_continue ? nextPage(ctx?.locator, page) : null;
  return {
    endpoint: c.endpoint, client: c.client, rows, page,
    facts: { client: c.client, endpoint: c.endpoint, record: c.record, count: rows.length, at,
             assertion: "system", basis: BASIS },
  };
}

/* R5: two persons whose names fold to one are both read, each naming the other; nothing merges. */
/** @param {LegistarRow[]} rows */
function sameNames(rows) {
  const by = new Map(/** @type {Array<[string, LegistarRow[]]>} */ ([]));
  for (const r of rows) {
    const n = r.facts.name_normal;
    if (typeof n !== "string" || !n) continue;
    const group = by.get(n);
    if (group) group.push(r); else by.set(n, [r]);
  }
  for (const group of by.values()) {
    if (group.length < 2) continue;
    for (const r of group) r.same_name_as = group.filter((x) => x !== r).map((x) => x.ids.PersonId);
  }
}

/** Is this a Legistar Web API capture of an endpoint this reader reads? (R1)
 *  @param {LegistarContext | null | undefined} ctx
 *  @returns {LegistarDetection} */
export function detect(ctx) {
  const c = capture(ctx);
  if ("why" in c) return { match: false, confidence: CONFIDENCE.NONE, signals: [], why: c.why };
  return { match: true, confidence: CONFIDENCE.CERTAIN,
           signals: [localize("legistar-reader.index.a_legistar_web_api_address", "a Legistar Web API address of {client}/{endpoint}", { client: String(c.client), endpoint: String(c.endpoint) }),
                     `${c.objects.length} ${c.endpoint} row${c.objects.length === 1 ? "" : "s"}, each carrying ${ENDPOINTS[c.endpoint].id}`] };
}

/** @type {{ readonly [kind: string]: ReadonlyArray<string> }} */
const OUTCOME = { vote: ["value"], event_item: ["passed"] };
/** @type {{ readonly [kind: string]: ReadonlyArray<string> }} */
const NAMES = { body: ["name"], person: ["name"] };

/** A reading `parse` gave, as `assess` and `readPages` take it: one whose `rows` is a list.
 *  @param {object | null | undefined} v
 *  @returns {v is LegistarReading} */
const isReading = (v) => (typeof v === "object" || typeof v === "function") && v !== null && "rows" in v && Array.isArray(v.rows);

/* `docprofile`'s diff reads each row as an entity, its facts compared as text: a row's own facts are handed as that text
   where they are not plain (a mover or seconder), so each moved fact is the one the diff of the rows themselves finds. */
/** @param {LegistarRow} r @returns {Entity} */
function asEntity(r) {
  /** @type {{ [fact: string]: string | number | boolean | null }} */
  const facts = {};
  for (const [k, v] of Object.entries(r.facts)) facts[k] = v !== null && typeof v === "object" ? String(v) : v;
  /** @type {EntityFacts} */
  const stated = facts;
  const label = r.label;
  return { key: r.key, kind: r.kind, label: typeof label === "string" ? label : "", facts: stated };
}

/** Compare two readings of one address by row key (R12).
 *  @param {object | null | undefined} before
 *  @param {object | null | undefined} after
 *  @returns {LegistarAssessment} */
export function assess(before, after) {
  if (!isReading(before) || !isReading(after) || !before.rows.length || !after.rows.length)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("legistar-reader.index.one_of_the_two_readings", "one of the two readings holds no rows, so an emptied list cannot be told from a failed read and nothing is claimed either way") };
  if (before.endpoint !== after.endpoint || before.client !== after.client)
    return { meaningful: null, significance: null, events: [], confirmed: null,
             why: localize("legistar-reader.index.the_two_readings_are_of", "the two readings are of different lists ({client}/{endpoint}, {client_2}/{endpoint_2})", { client: String(before.client), endpoint: String(before.endpoint), client_2: String(after.client), endpoint_2: String(after.endpoint) }) };
  const a = before.rows, b = after.rows;
  /** @type {Map<string, LegistarRow>} */
  const wasRows = new Map(a.map((r) => /** @type {[string, LegistarRow]} */ ([r.key, r])));
  /** @type {Map<string, LegistarRow>} */
  const nowRows = new Map(b.map((r) => /** @type {[string, LegistarRow]} */ ([r.key, r])));
  const d = diffEntities(a.map(asEntity), b.map(asEntity));
  /** @type {EventHead[]} */
  const events = [];
  for (const g of d.gone) {
    const e = wasRows.get(g.key);
    if (!e) continue;
    events.push(event("delisted", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_kind_row_legistar_listed", "a {kind} row Legistar listed is no longer listed", { kind: String(e.kind) }) }));
  }
  for (const n of d.appeared) {
    const e = nowRows.get(n.key);
    if (!e) continue;
    const kind = e.kind;
    events.push(kind === "event"
      ? event("scheduled", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_meeting_was_added_to", "a meeting was added to Legistar's list") })
      : event("item_added", { key: e.key, label: e.label ?? null, why: localize("legistar-reader.index.a_kind_row_was_added", "a {kind} row was added to Legistar's list", { kind: String(kind) }) }));
  }
  for (const altered of d.altered) {
    const r = nowRows.get(altered.entity.key), was = wasRows.get(altered.was.key);
    if (!r || !was) continue;
    /** @type {Map<string, { fact: string, was: Given | undefined, now: Given | undefined }>} */
    const f = new Map(altered.moved.map((m) => /** @type {[string, { fact: string, was: Given | undefined, now: Given | undefined }]} */ ([m.fact, { fact: m.fact, was: was.facts[m.fact], now: r.facts[m.fact] }])));
    const base = { key: r.key, label: r.label ?? null };
    /** @param {string} k */
    const take = (k) => { const m = f.get(k); f.delete(k); return m; };
    if (r.kind === "event") {
      const st = take("status");
      const stNow = st ? st.now : undefined;
      if (st && stNow === "cancelled")
        events.push(event("cancelled", { ...base, was: st.was, now: stNow, why: localize("legistar-reader.index.a_meeting_is_now_marked", "a meeting is now marked cancelled") }));
      else if (st) f.set("status", st);
      const dt = take("date"), tm = take("time");
      if (dt || tm)
        events.push(event("rescheduled", { ...base, was: { date: was.facts.date, time: was.facts.time },
                      now: { date: r.facts.date, time: r.facts.time }, why: localize("legistar-reader.index.a_meetings_date_or_time", "a meeting's date or time moved") }));
      for (const kind of ["agenda", "minutes"]) {
        const m = take(`${kind}_last_published`);
        if (!m) continue;
        const now = m.now;
        if (now == null) { f.set(`${kind}_last_published`, m); continue; }
        events.push(event(`${kind}_published`, { ...base, was: m.was, now, label_of_time: PUBLISHED_LABEL,
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

/** @type {LegistarType} */
const TYPE = {
  key: KEY, label: localize("legistar-reader.index.legistar_web_api_capture", "Legistar Web API capture"), version: 1, contract: CONTRACT.MEMBERSHIP,
  detect, parse, assess,
};
/** @type {Readonly<LegistarType>} */
export const legistar = Object.freeze(TYPE);

/* Registering twice on one registry registers nothing the second time (as doctypes R2). */
/** @type {WeakSet<object>} */
const REGISTERED = new WeakSet();
/** Register this content type through `docprofile`'s registry seam (R1; as `doctypes` does).
 *  @param {((type: LegistarType) => unknown) | null | undefined} register
 *  @returns {void}
 *  @throws {TypeError} when `register` is not a function */
export function registerLegistar(register) {
  if (typeof register !== "function") throw new TypeError("legistar-reader: registerLegistar needs docprofile's register");
  if (REGISTERED.has(register)) return;
  REGISTERED.add(register);
  register(legistar);
}

export default legistar;
