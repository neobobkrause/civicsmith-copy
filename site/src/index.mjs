/* civicsmith.org: Civicsmith's own website, a static Worker (site R1–R18). It serves the three generated pages
 * (`pages.mjs`, site/build.mjs; R9, R12) with the four deploy values put in place (R4–R7), and interface-assets' files
 * at their own paths (R8). It holds no accounts, reads no group's record, sends nothing anywhere and stores nothing
 * (R10). Every response carries the same headers (R6, R7, R8); a deploy value that is malformed answers 500, never a
 * page drawn from it. */
import { ASSET_FILES } from "../../bio-plane/src/interface-assets/index.mjs";
import { PAGES, PARTS } from "./pages.mjs";

const ROUTES = { "/": "home", "/start": "start", "/groups": "groups" };
const ICON_PATHS = new Set(["/favicon.svg", "/favicon.ico"]);
const ASSETS = "/app/assets/";
export const CSP = "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/* Each {{slot}} of a generated template, filled with HTML already made safe; a slot left unfilled is a fault. */
function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, n) => {
    if (!(n in values)) throw new Error(`site: slot ${n} has no value`);
    return values[n];
  });
}

/* The page's icon (K3390): the mark, the `i-mark` symbol of interface-assets' icons.svg, drawn in its accent colour on a
   square, served at /favicon.svg (and /favicon.ico, which browsers ask for unprompted). Derived from the served files,
   so the site holds no second copy of the mark (R9). */
function favicon() {
  const mark = /<symbol id="i-mark" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/.exec(ASSET_FILES["icons.svg"].body);
  const accent = /--c-accent:\s*(#[0-9A-Fa-f]{3,8})\s*;/.exec(ASSET_FILES["civicsmith.css"].body);
  if (!mark || !accent) throw new Error("site: icons.svg has no i-mark, or civicsmith.css no --c-accent");
  const [x, y, w, h] = mark[1].split(/\s+/).map(Number), side = Math.max(w, h);
  const box = [x - (side - w) / 2, y - (side - h) / 2, side, side].join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${mark[2].replace(/class="f"/g, `fill="${accent[1]}"`)}</svg>`;
}
export const FAVICON = favicon();

/* After a sentence's slot, the sentence's own full stop is dropped when what fills the slot already ends one (K3390). */
const stopAfter = (t, slot, value) => (/[.!?]$/.test(value.replace(/<[^>]*>/g, "").trim()) ? t.replace(`{{${slot}}}.`, `{{${slot}}}`) : t);

export class ConfigError extends Error {}
const bad = (what) => { throw new ConfigError(`site: ${what}`); };
const unset = (v) => v === undefined || v === null || v === "";
const json = (v, name) => {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return bad(`${name} is not JSON`); }
};
const text = (v, name) => (typeof v === "string" && v.trim() && !/[\u0000-\u001f]/.test(v) ? v : bad(`${name} is not a text`));
const count = (v, name) => (Number.isInteger(v) && v >= 1 ? v : bad(`${name} is not a count`));
function https(v, name, { bare = false } = {}) {
  let u;
  try { u = new URL(text(v, name)); } catch { return bad(`${name} is not an address`); }
  if (u.protocol !== "https:" || u.username || u.password) bad(`${name} is not an https: address`);
  if (bare && (u.search || u.hash || v.includes("?") || v.includes("#"))) bad(`${name} carries a query or fragment`);
  return u;
}

/* The four deploy values (R4–R7), read and checked on every request, with R17's register (withdrawn); nothing about them is kept. */
export function config(env = {}) {
  const c = {};
  c.installer = unset(env.INSTALLER_ADDRESS) ? null : https(env.INSTALLER_ADDRESS, "INSTALLER_ADDRESS", { bare: true }).href;
  if (unset(env.STEWARDS_ADDRESS)) c.stewards = null;
  else if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(env.STEWARDS_ADDRESS)) c.stewards = env.STEWARDS_ADDRESS;
  else bad("STEWARDS_ADDRESS is not an email address");
  const f = unset(env.FEATURED_CASE) ? null : json(env.FEATURED_CASE, "FEATURED_CASE");
  if (f === null) c.featured = null;
  else {
    if (typeof f !== "object" || Array.isArray(f)) bad("FEATURED_CASE is not an edition");
    const at = https(f.address, "FEATURED_CASE.address", { bare: true });
    if (!/^[A-Za-z0-9._-]+$/.test(f.case ?? "")) bad("FEATURED_CASE.case is not a case id");
    c.featured = {
      href: `${at.origin}/app/published/${f.case}`, case: text(f.title, "FEATURED_CASE.title"), edition: count(f.edition, "FEATURED_CASE.edition"),
      group: text(f.group, "FEATURED_CASE.group"), place: text(f.place, "FEATURED_CASE.place"),
      signer: text(f.signer, "FEATURED_CASE.signer"), date: text(f.date, "FEATURED_CASE.date"),
    };
  }
  const g = unset(env.LISTED_GROUPS) ? [] : json(env.LISTED_GROUPS, "LISTED_GROUPS");
  if (!Array.isArray(g)) bad("LISTED_GROUPS is not a list");
  c.groups = g.map((x, i) => {
    const n = `LISTED_GROUPS[${i}]`;
    if (!x || typeof x !== "object") bad(`${n} is not a team`);
    const cases = count(x.cases, `${n}.cases`), editions = count(x.editions ?? cases, `${n}.editions`);
    if (editions < cases) bad(`${n}.editions is fewer than its cases`);
    return {
      name: text(x.name, `${n}.name`), place: text(x.place, `${n}.place`), focus: text(x.focus, `${n}.focus`),
      address: x.address, href: https(x.address, `${n}.address`).href, cases, editions,
      latest: editions > cases ? text(x.latest, `${n}.latest`) : null,
    };
  });
  return c;
}

/* R17: the stewards' withdrawal register (`stewards` R13's `GET /steward/withdrawals`: `{register, sha256}`, the register's
   canonical JSON and its SHA-256), one more plain-text deploy value. Unset, nothing is withdrawn. Present, it must be the
   stewards' answer exactly: an object of those two keys, each entry `{service, item, since}` (with `ref` and `kind` as the
   stewards keep them), no entry twice, and the digest the register's own; anything else is malformed, so the deploy check
   (site/check.mjs) refuses it and a request answers 500, never the listing drawn whole. Answers the addresses whose
   `public_listing` withdrawal stands. */
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function withdrawn(env = {}) {
  if (unset(env.WITHDRAWAL_REGISTER)) return new Set();
  const n = "WITHDRAWAL_REGISTER";
  const v = json(env.WITHDRAWAL_REGISTER, n);
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== "register,sha256") bad(`${n} is not {register, sha256}`);
  if (!Array.isArray(v.register)) bad(`${n}.register is not a list`);
  if (typeof v.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.sha256)) bad(`${n}.sha256 is not a SHA-256 digest`);
  const seen = new Set(), items = new Set();
  v.register.forEach((x, i) => {
    const at = `${n}.register[${i}]`;
    if (!x || typeof x !== "object" || Array.isArray(x)) bad(`${at} is not a withdrawal`);
    if (Object.keys(x).some((k) => !["service", "item", "since", "ref", "kind"].includes(k))) bad(`${at} has a field the register does not`);
    if (typeof x.service !== "string" || !/^[a-z_]{1,64}$/.test(x.service)) bad(`${at}.service is not a service`);
    if (typeof x.item !== "string" || x.item.length < 1 || x.item.length > 512) bad(`${at}.item is not an identifier`);
    if (!Number.isInteger(x.since) || x.since < 0) bad(`${at}.since is not a time`);
    for (const k of ["ref", "kind"]) if (k in x && (typeof x[k] !== "string" || !x[k])) bad(`${at}.${k} is not a text`);
    const key = `${x.service}\u0000${x.item}`;
    if (seen.has(key)) bad(`${at} stands twice`);
    seen.add(key);
    if (x.service === "public_listing") items.add(x.item);
  });
  const digest = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(v.register))));
  if (digest !== v.sha256) bad(`${n}.sha256 is not the register's digest`);
  return items;
}
/* A listed group stands withdrawn when its address, as listed or as the site reads it, is a `public_listing` item. */
const standsWithdrawn = (items, g) => items.has(g.address) || items.has(g.href);

/* The deploy check (R17, K5571 (4)): every deploy value read as a request reads them; throws ConfigError on the first fault. */
export async function check(env = {}) {
  const c = config(env);
  const items = await withdrawn(env);
  return { config: c, withdrawn: items.size, listed: c.groups.filter((g) => !standsWithdrawn(items, g)).length };
}

function casesOf(g) {
  const t = g.editions > g.cases ? (g.cases === 1 ? PARTS.casesOne : PARTS.casesMany) : (g.cases === 1 ? PARTS.caseOne : PARTS.caseMany);
  return fill(t, { cases: String(g.cases), editions: String(g.editions), date: esc(g.latest ?? "") });
}

export function page(name, c) {
  const stewards = c.stewards === null ? PARTS.stewardsUnset : fill(PARTS.stewardsSet, { address: esc(c.stewards) });
  const installer = c.installer === null ? "" : ` href="${esc(c.installer)}"`;
  const featured = c.featured === null ? "" : fill(PARTS.featured, Object.fromEntries(Object.entries(c.featured).map(([k, v]) => [k, esc(v)])));
  if (name === "groups" && !c.groups.length) name = "groupsEmpty";
  const rows = c.groups.map((g) => fill(PARTS.groupRow, { name: esc(g.name), place: esc(g.place), focus: esc(g.focus), href: esc(g.href), cases: casesOf(g) })).join("");
  return fill(stopAfter(PAGES[name], "stewards", stewards), { stewards, installer, featured, rows });
}

function headers(c, type) {
  const h = new Headers({
    "Content-Type": type, "Content-Security-Policy": CSP, "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache",
  });
  if (!c || c.stewards === null) h.set("X-Robots-Tag", "noindex");
  return h;
}

function asset(name) {
  const f = Object.hasOwn(ASSET_FILES, name) ? ASSET_FILES[name] : null;
  if (!f) return null;
  if (f.encoding !== "base64") return { type: f.type, body: f.body };
  const bin = atob(f.body), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: f.type, body: bytes };
}

export default {
  async fetch(request, env) {
    const method = request.method;
    let c = null;
    try {
      c = config(env);
      const items = await withdrawn(env);
      /* R17: a standing withdrawal draws no row and no trace of one; with every row withdrawn, R13's empty state. */
      c.groups = c.groups.filter((g) => !standsWithdrawn(items, g));
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      return new Response(null, { status: 500, headers: headers(null, "text/plain") });
    }
    if (method !== "GET" && method !== "HEAD") {
      const h = headers(c, "text/plain");
      h.set("Allow", "GET, HEAD");
      return new Response(null, { status: 405, headers: h });
    }
    const path = new URL(request.url).pathname;
    let status = 200, type = "text/html; charset=utf-8", body;
    if (Object.hasOwn(ROUTES, path)) body = page(ROUTES[path], c);
    else if (ICON_PATHS.has(path)) { type = "image/svg+xml; charset=utf-8"; body = FAVICON; }
    else if (path.startsWith(ASSETS) && asset(path.slice(ASSETS.length))) {
      const a = asset(path.slice(ASSETS.length));
      type = a.type.startsWith("text/") || a.type === "image/svg+xml" ? `${a.type}; charset=utf-8` : a.type;
      body = a.body;
    } else { status = 404; body = page("notFound", c); }
    return new Response(method === "HEAD" ? null : body, { status, headers: headers(c, type) });
  },
};
