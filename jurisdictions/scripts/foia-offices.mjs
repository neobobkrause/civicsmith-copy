#!/usr/bin/env node
/* jurisdictions R119, R120 (T53; N1256; DEC-401): the makers' script that rebuilds the federal layer's records offices from
 * the government's own list, the FOIA.gov agency component list (api.foia.gov's `agency_components`, with each component's
 * parent agency). Run by Civicsmith's makers before a release, never by a team's copy and never by the module (R17: the
 * module holds no network): it reads the list with the key the government's service requires, from the environment
 * variable FOIA_GOV_API_KEY, a makers' secret that is never printed, never written and never in the repository; it writes
 * the layer's data file (`profiles/layers/us-federal-offices.mjs`) and a diff against the previous snapshot (offices added,
 * removed, renamed, contacts changed), which a person reads before the release ships.
 *
 *   FOIA_GOV_API_KEY=… node jurisdictions/scripts/foia-offices.mjs --as-of YYYY-MM-DD [--out <data file>] [--diff <diff file>]
 *
 * Each office is one R24 counterparty with R119's fields only: `role` the component's name, `body` its parent agency,
 * `level: federal`, `elected: false`, `contacts` the means it publishes for sending a request (its web form or portal
 * address, its e-mail addresses, its mail address, in that order), `source` the list's address and `basis` the dated read.
 * A component the list marks unpublished (`status: false`) is not an office of the list. A field the list states beyond
 * these is not copied (R119: added only by a requirement change). The data file keys each office by the list's own
 * component id, so a later snapshot tells a renamed office from a removed and an added one. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const KEY_VARIABLE = "FOIA_GOV_API_KEY";
export const LIST_ADDRESS = "https://api.foia.gov/api/agency_components";
const FIELDS = "title,email,submission_address,submission_web,agency,status";
const FIRST_PAGE = `${LIST_ADDRESS}?include=agency&fields%5Bagency%5D=name&fields%5Bagency_component%5D=${FIELDS}&page%5Blimit%5D=50`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(HERE, "..", "profiles", "layers", "us-federal-offices.mjs");
const MAX_PAGES = 200;

const line = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** The mail address the list states, on one line: its address lines, then locality, area and postal code. */
export function mailLine(a) {
  if (!a || typeof a !== "object") return "";
  const place = [line(a.locality), [line(a.administrative_area), line(a.postal_code)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line(a.address_line1), line(a.address_line2), line(a.address_line3), place].filter(Boolean).join(", ");
}

/** R119: the offices of the list's pages (JSON:API documents, `included` holding the parent agencies), as
 *  `[{key, entry}]` sorted by body then role then key. Pure. */
export function officesFrom(pages, { basis }) {
  const agencies = new Map();
  const comps = [];
  for (const doc of pages) {
    for (const x of (doc && doc.included) || []) if (x && x.type === "agency") agencies.set(x.id, x.attributes || {});
    for (const x of (doc && doc.data) || []) if (x && x.type === "agency_component") comps.push(x);
  }
  const out = [];
  const seen = new Set();
  for (const c of comps) {
    const a = c.attributes || {};
    if (a.status !== true || seen.has(c.id)) continue;
    seen.add(c.id);
    const rel = c.relationships && c.relationships.agency && c.relationships.agency.data;
    const agency = rel ? agencies.get(rel.id) : null;
    const role = line(a.title), body = line(agency && agency.name);
    if (!role || !body) throw new Error(`component ${c.id}: the list gives no ${role ? "parent agency" : "name"}`);
    const contacts = [];
    const web = a.submission_web && line(a.submission_web.uri);
    if (web) contacts.push({ how: "web", value: web });
    for (const e of Array.isArray(a.email) ? a.email : []) if (line(e) && !contacts.some((k) => k.how === "email" && k.value === line(e))) contacts.push({ how: "email", value: line(e) });
    const mail = mailLine(a.submission_address);
    if (mail) contacts.push({ how: "mail", value: mail });
    const entry = { role, body, level: "federal", elected: false, ...(contacts.length ? { contacts } : {}), source: LIST_ADDRESS, basis };
    out.push({ key: c.id, entry });
  }
  return out.sort((x, y) => (x.entry.body < y.entry.body ? -1 : x.entry.body > y.entry.body ? 1
    : x.entry.role < y.entry.role ? -1 : x.entry.role > y.entry.role ? 1 : x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}

/** R120: what changed between two snapshots, by the list's component id: `{added, removed, renamed, contacts}`, each a
 *  list of `{key, role, body}` (renamed with `from`, contacts with `from` and `to`). Pure. */
export function officesDiff(prev, next) {
  const before = new Map((prev || []).map((o) => [o.key, o.entry]));
  const after = new Map((next || []).map((o) => [o.key, o.entry]));
  const d = { added: [], removed: [], renamed: [], contacts: [] };
  const id = (key, e) => ({ key, role: e.role, body: e.body });
  for (const [k, e] of after) {
    const b = before.get(k);
    if (!b) { d.added.push(id(k, e)); continue; }
    if (b.role !== e.role || b.body !== e.body) d.renamed.push({ ...id(k, e), from: { role: b.role, body: b.body } });
    if (JSON.stringify(b.contacts || []) !== JSON.stringify(e.contacts || [])) d.contacts.push({ ...id(k, e), from: b.contacts || [], to: e.contacts || [] });
  }
  for (const [k, b] of before) if (!after.has(k)) d.removed.push(id(k, b));
  return d;
}

/** R120: the diff as the text a person reads before the release ships. */
export function diffText(d, { as_of, previous_as_of }) {
  const name = (o) => `${o.role} (${o.body})`;
  const out = [`FOIA offices: the list read ${as_of}, against the snapshot of ${previous_as_of || "none (the first snapshot)"}`,
    `added ${d.added.length}, removed ${d.removed.length}, renamed ${d.renamed.length}, contacts changed ${d.contacts.length}`, ""];
  const section = (title, rows, fn) => { out.push(`## ${title} (${rows.length})`); for (const r of rows) out.push(`- ${fn(r)}`); out.push(""); };
  section("Added", d.added, name);
  section("Removed", d.removed, name);
  section("Renamed", d.renamed, (r) => `${name(r.from)} -> ${name(r)}`);
  section("Contacts changed", d.contacts, (r) => `${name(r)}: ${r.from.map((c) => `${c.how} ${c.value}`).join("; ") || "none"} -> ${r.to.map((c) => `${c.how} ${c.value}`).join("; ") || "none"}`);
  return out.join("\n");
}

/** The layer's data file: plain data, as every profile file is. */
export function dataFileText({ as_of, offices }) {
  return `/* The federal layer's records offices (jurisdictions R119, R120): a dated snapshot of the government's own list, the FOIA.gov
 * agency component list (${LIST_ADDRESS}), read ${as_of}. Written by jurisdictions/scripts/foia-offices.mjs, run by Civicsmith's
 * makers before a release; never edited by hand and never fetched by a team's copy. Each office is keyed by the list's own
 * component id. Plain data. */
export default ${JSON.stringify({ as_of, source: LIST_ADDRESS, offices }, null, 2)};
`;
}

/** Reads every page of the list, following `links.next`, with the key appended to each request and never shown. */
export async function readList(key, fetchFn) {
  const pages = [];
  let url = FIRST_PAGE;
  while (url && pages.length < MAX_PAGES) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetchFn(`${url}${sep}api_key=${encodeURIComponent(key)}`);
    if (!res || !res.ok) throw new Error(`the list answered ${res ? res.status : "nothing"} for page ${pages.length + 1}`);
    const doc = await res.json();
    pages.push(doc);
    url = doc && doc.links && doc.links.next ? (typeof doc.links.next === "string" ? doc.links.next : doc.links.next.href) : null;
  }
  if (url) throw new Error(`the list has more than ${MAX_PAGES} pages`);
  return pages;
}

async function previousOf(file) {
  if (!fs.existsSync(file)) return { as_of: null, offices: [] };
  const m = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return { as_of: m.default.as_of || null, offices: m.default.offices || [] };
}

/** The script: `argv` its arguments, `env` the environment, `fetchFn` the network. Answers `{code, out, err}`; prints nothing
 *  itself, so a caller (and a test) sees every line it would show. The key's value is in no line it answers. */
export async function main(argv, env, fetchFn) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) return { code: 2, out: "", err: `unknown argument: ${a}` };
    args[a.slice(2)] = argv[i + 1];
    i++;
  }
  const key = env && typeof env[KEY_VARIABLE] === "string" ? env[KEY_VARIABLE].trim() : "";
  if (!key) return { code: 2, out: "", err: `missing key: set ${KEY_VARIABLE} to the makers' api.data.gov key for the FOIA.gov list; nothing was read or written` };
  const as_of = args["as-of"];
  if (!isDate(as_of)) return { code: 2, out: "", err: "--as-of is the date the list is read, YYYY-MM-DD" };
  const out = args.out ? path.resolve(args.out) : DATA_FILE;
  const diffFile = args.diff ? path.resolve(args.diff) : null;
  const hide = (s) => String(s).split(key).join("[key]");
  try {
    const pages = await readList(key, fetchFn);
    const offices = officesFrom(pages, { basis: `${as_of} foia-gov-components` });
    if (!offices.length) return { code: 1, out: "", err: "the list named no office; nothing was written" };
    const prev = await previousOf(out);
    const d = officesDiff(prev.offices, offices);
    const text = diffText(d, { as_of, previous_as_of: prev.as_of });
    fs.writeFileSync(out, dataFileText({ as_of, offices }));
    if (diffFile) fs.writeFileSync(diffFile, `${text}\n`);
    return { code: 0, out: `${offices.length} offices written to ${out}${diffFile ? `; the diff to ${diffFile}` : ""}\n${text.split("\n")[1]}`, err: "" };
  } catch (e) {
    return { code: 1, out: "", err: hide(e && e.message ? e.message : e) };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await main(process.argv.slice(2), process.env, globalThis.fetch);
  if (r.out) process.stdout.write(`${r.out}\n`);
  if (r.err) process.stderr.write(`${r.err}\n`);
  process.exitCode = r.code;
}
