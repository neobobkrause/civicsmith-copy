/* What the installer finds in a Cloudflare account, and the names a copy's parts carry there (R62–R65, R69, R70).
 *
 * A COPY IS NAMED BY ITS SLUG (R64): the plane is the Worker `<slug>`, its evidence buckets are `bio-captures-<slug>` and
 * `bio-published-<slug>`, each fleet member is the Worker `<member>-<slug>` and each container application carries the slug
 * too, so two copies in one account share nothing. A copy installed before this under the fixed names (`bio-captures`,
 * `bio-published`, `pdf-worker`, …) keeps them; it is told apart by its plane's own `CAPTURES` binding. The installer keeps
 * nothing between requests (R27): everything here is read from the account, once, as it is asked.
 *
 * Every function takes `api(path, init)`, the Cloudflare call already bound to the run's permission and account path
 * prefix (`/accounts/<id>`), so this file holds no token and no address of its own. */

import { patiently } from "./api.mjs";
/** @import { Api, Names, OnWait, ApproveAgain } from './api.mjs' */

/**
 * @typedef {Object} Plane a Worker that holds the record store (the class `Store`)
 * @property {string} slug
 * @property {string} scheme "slug" or "legacy"
 * @property {any[]} bindings its bindings, as bindingsOf answers them
 * @property {boolean} finished
 */
/**
 * @typedef {Object} Inventory what the account holds (R3)
 * @property {Map<string, any>} scripts the Workers by name
 * @property {string[]} buckets the bucket names
 * @property {Plane[]} planes
 * @property {{legacy: string[], slugged: Map<string, string[]>}} orphans the buckets and members no plane of that copy holds
 */
/**
 * @typedef {Object} Copy one copy in the account
 * @property {string} slug
 * @property {string} scheme "slug" or "legacy"
 * @property {boolean} [finished]
 * @property {boolean} [plane] whether a plane holds it
 */
/**
 * @typedef {Object} Resource a thing one copy holds, as it is deleted
 * @property {string} kind "app", "worker" or "bucket"
 * @property {string} name
 * @property {string} [id] an application's id
 */

/** @type {string} */
export const SLUG_SCHEME = "slug";
/** @type {string} */
export const LEGACY_SCHEME = "legacy";
/** @type {Readonly<{captures: string, published: string}>} */
export const LEGACY_BUCKETS = Object.freeze({ captures: "bio-captures", published: "bio-published" });

/* R69 (K3747): the mark the installer writes LAST. A copy that carries it was finished; a copy under per-slug names that does
   not was begun by this installer and not finished. It is a secret binding (an update keeps secrets), its value the
   release the install completed. */
/** @type {string} */
export const MARK = "INSTALL_COMPLETE";

/* R69 (F9): the lock one run holds on the account while it works, a throwaway Worker whose only content is when it was last
   touched. A lock not touched for LOCK_LIVE_MS belongs to a run that died. */
/** The lock Worker's name. */
export const LOCK_SCRIPT = "bio-install-lock";
/** @type {number} milliseconds */
export const LOCK_LIVE_MS = 3 * 60 * 1000;

/**
 * The names a copy's parts carry in the account (R2). Pure.
 * @param {string} slug
 * @param {string} [scheme] SLUG_SCHEME (the default) or LEGACY_SCHEME
 * @returns {Names}
 */
export function namesFor(slug, scheme = SLUG_SCHEME) {
  const legacy = scheme === LEGACY_SCHEME;
  return Object.freeze({
    slug, scheme,
    captures: legacy ? LEGACY_BUCKETS.captures : `bio-captures-${slug}`,
    published: legacy ? LEGACY_BUCKETS.published : `bio-published-${slug}`,
    /* A fleet member's Worker. */
    member: (m) => (legacy ? m : `${m}-${slug}`),
    /* A container application: a member with one class is named by the member, with several by member and class. */
    app: (m, cls, multi) => (legacy ? (multi ? `${m}-${cls.toLowerCase()}` : m) : (multi ? `${m}-${cls.toLowerCase()}-${slug}` : `${m}-${slug}`)),
    role: (r) => (r === "captures" ? (legacy ? LEGACY_BUCKETS.captures : `bio-captures-${slug}`) : (legacy ? LEGACY_BUCKETS.published : `bio-published-${slug}`)),
  });
}

/**
 * Which naming a plane's bindings show: its `CAPTURES` bucket. null when they name neither.
 * @param {any[]|null|undefined} bindings
 * @param {string} slug
 * @returns {string|null} SLUG_SCHEME, LEGACY_SCHEME or null
 */
export function schemeOf(bindings, slug) {
  const b = (bindings || []).find((x) => x && x.name === "CAPTURES" && x.type === "r2_bucket");
  if (!b) return null;
  if (b.bucket_name === LEGACY_BUCKETS.captures) return LEGACY_SCHEME;
  if (b.bucket_name === `bio-captures-${slug}`) return SLUG_SCHEME;
  return null;
}

const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * The scripts the account holds, by name, with their migration tag where the platform states one.
 * @param {Api} api
 * @returns {Promise<Map<string, any>>}
 */
export async function listScripts(api) {
  return new Map(arr(await api("/workers/scripts")).filter((s) => s && typeof s.id === "string").map((s) => [s.id, s]));
}
/**
 * The names of the account's buckets.
 * @param {Api} api
 * @returns {Promise<string[]>}
 */
export async function listBuckets(api) {
  const r = await api("/r2/buckets");
  return arr(r && !Array.isArray(r) ? r.buckets : r).map((b) => b && b.name).filter((n) => typeof n === "string");
}
/**
 * The account's Durable Object namespaces.
 * @param {Api} api
 * @returns {Promise<any[]>}
 */
export async function listNamespaces(api) {
  return arr(await api("/workers/durable_objects/namespaces?per_page=1000"));
}
/**
 * The account's container applications.
 * @param {Api} api
 * @returns {Promise<any[]>}
 */
export async function listApps(api) { return arr(await api("/containers/applications")); }

/* The bindings a script holds, as {name, type, ...}: names and types (a secret's value is never readable). null when the
   settings cannot be read or state none: unknown, never "none". */
/**
 * @param {Api} api
 * @param {string} name the script's name
 * @returns {Promise<any[]|null>} each `{name, type, ...}`
 */
export async function bindingsOf(api, name) {
  try {
    const s = await api(`/workers/scripts/${name}/settings`);
    return s && Array.isArray(s.bindings) ? s.bindings.filter((b) => b && typeof b.name === "string") : null;
  } catch { return null; }
}

/* R62, R69: every copy the account holds, and every part of one that stands alone.
     planes    [{slug, scheme, finished, bindings}]   each Worker that holds the record store (the class `Store`)
     orphans   {legacy: [names], slugged: Map(slug -> [names])}   buckets and members no plane of that copy holds
   `memberNames` are the fleet members' own names (instance-setup's table and what the release names). A lookup that fails
   throws: an absence not established is not established. */
/**
 * @param {Api} api
 * @param {string[]} memberNames
 * @returns {Promise<Inventory>}
 * @throws {Error} when a lookup fails, or a plane's settings cannot be read
 */
export async function inventory(api, memberNames) {
  const [scripts, buckets, spaces] = await Promise.all([listScripts(api), listBuckets(api), listNamespaces(api)]);
  const planeNames = [...new Set(spaces.filter((n) => n && n.class === "Store" && typeof n.script === "string").map((n) => n.script))];
  const planes = [];
  for (const slug of planeNames) {
    const bindings = await bindingsOf(api, slug);
    if (bindings === null) throw new Error(`the settings of ${slug} could not be read`);
    const scheme = schemeOf(bindings, slug) ?? SLUG_SCHEME;
    planes.push({ slug, scheme, bindings, finished: scheme === LEGACY_SCHEME || bindings.some((b) => b.name === MARK) });
  }
  const held = new Set(planes.flatMap((p) => [namesFor(p.slug, p.scheme).captures, namesFor(p.slug, p.scheme).published]));
  const legacy = [];
  const slugged = new Map();
  const add = (slug, what) => slugged.set(slug, [...(slugged.get(slug) || []), what]);
  const legacyOwned = planes.some((p) => p.scheme === LEGACY_SCHEME);
  for (const b of buckets) {
    if (held.has(b)) continue;
    if (b === LEGACY_BUCKETS.captures || b === LEGACY_BUCKETS.published) { if (!legacyOwned) legacy.push(b); continue; }
    const m = /^bio-(?:captures|published)-(.+)$/.exec(b);
    if (m) add(m[1], b);
  }
  for (const m of memberNames) {
    if (scripts.has(m) && !legacyOwned) legacy.push(m);
    for (const w of scripts.keys()) {
      if (!w.startsWith(m + "-")) continue;
      const slug = w.slice(m.length + 1);
      if (slug.length >= 3 && !scripts.has(slug)) add(slug, w);
    }
  }
  return { scripts, buckets, planes, orphans: { legacy, slugged } };
}

/**
 * R70 (F7): a free name beside the one that was taken: the first `<slug>-<n>` not taken and valid, else null.
 * @param {string} slug
 * @param {Set<string>} taken
 * @param {(name: string) => boolean} validate
 * @returns {any} the name (a string), or null
 * @bound n is a whole number from 2 to 99; the name is at most 40 characters
 */
export function freeName(slug, taken, validate) {
  for (let n = 2; n < 100; n++) {
    const tail = `-${n}`;
    const c = slug.slice(0, 40 - tail.length).replace(/-+$/, "") + tail;
    if (!taken.has(c) && validate(c)) return c;
  }
  return null;
}

/* ------------------------------------------------------------------ R63: what is already here */

/* The facts a copy's own worker answers to the installer's one request (`op=bootstrap`, no credential). Each is stated or
   not; a fact not stated carries why. The wire names are flat scalars (membership R132's pre-auth rule). */
/** @type {Readonly<Record<string, string>>} the fact's name to its wire name */
export const FACT_KEYS = Object.freeze({ team: "team_name", installed: "installed_at", used: "last_used_at", release: "version",
  projects: "count_projects", documents: "count_documents", published: "count_published", members: "count_members" });

/* A rate limit or a server error is waited out (R1's back-off, a minute at most, drawn through `onWait`); no answer at all is not
   waited on, since an address that is not there is the usual state of a copy that was removed. It never throws. */
/**
 * @param {string|null} address the copy's address
 * @param {OnWait|null} [onWait]
 * @returns {Promise<any>} for each fact of FACT_KEYS, `{known: true, value}`, or `{known: false, why}` with `why`
 *   "silent" or "older"
 * @bound a fact is known when it is a non-empty string or a whole number of 0 or more
 */
export async function readCopyFacts(address, onWait = null) {
  let reply = null;
  if (address) {
    try {
      const j = await patiently(async () => {
        let r;
        try { r = await fetch(`${address}/api/?op=bootstrap`); } catch { return null; }
        if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status,
          retryAfter: Number(r.headers.get("retry-after")) || undefined });
        return r.ok ? await r.json().catch(() => null) : null;
      }, { onWait, minutes: 1 });
      if (j && typeof j === "object") reply = j;
    } catch { reply = null; }
  }
  const facts = {};
  for (const [name, wire] of Object.entries(FACT_KEYS)) {
    const v = reply ? reply[wire] : undefined;
    const ok = typeof v === "string" ? v.length > 0 : Number.isInteger(v) && v >= 0;
    facts[name] = ok ? { known: true, value: v }
      : { known: false, why: reply === null ? "silent" : (reply.version === undefined || name === "release" ? "silent" : "older") };
  }
  return facts;
}

/* The installer's own counts from Cloudflare's API for one copy: its Workers, its container applications, the objects in
   its two buckets. A count that cannot be read is null. */
/**
 * @param {Api} api
 * @param {Copy} copy
 * @param {string[]} memberNames
 * @param {Map<string, any>} scripts the account's scripts (listScripts)
 * @param {any[]} spaces the account's namespaces (listNamespaces)
 * @param {any[]} apps the account's container applications (listApps)
 * @returns {Promise<{workers: number, containers: number, captured: number|null, published: number|null}>}
 */
export async function countsViaApi(api, copy, memberNames, scripts, spaces, apps) {
  const n = namesFor(copy.slug, copy.scheme);
  const workers = [copy.slug, ...memberNames.map((m) => n.member(m))].filter((w) => scripts.has(w));
  const mine = new Set(spaces.filter((s) => workers.includes(s.script)).map((s) => s.id));
  const containers = apps.filter((a) => a && a.durable_objects && mine.has(a.durable_objects.namespace_id)).length;
  const objects = async (bucket) => {
    try { const u = await api(`/r2/buckets/${bucket}/usage`); return Number.isInteger(u?.objectCount) ? u.objectCount : null; }
    catch { return null; }
  };
  return { workers: workers.length, containers, captured: await objects(n.captures), published: await objects(n.published) };
}

/* ------------------------------------------------------------------ R65: removal */

/* Everything one copy holds in the account, as a list of {kind, name} in the order they are deleted: container
   applications (they hold the Durable Object classes), fleet members, the plane (each with its Durable Objects), then
   the two buckets (emptied first). */
/**
 * @param {Api} api
 * @param {Copy} copy
 * @param {string[]} memberNames
 * @returns {Promise<any[]>} each a Resource
 */
export async function resourcesOf(api, copy, memberNames) {
  const n = namesFor(copy.slug, copy.scheme);
  const [scripts, spaces, apps, buckets] = await Promise.all([listScripts(api), listNamespaces(api), listApps(api), listBuckets(api)]);
  const workers = [...memberNames.map((m) => n.member(m)), copy.slug].filter((w) => scripts.has(w));
  const mine = new Set(spaces.filter((s) => workers.includes(s.script)).map((s) => s.id));
  const out = [];
  for (const a of apps) if (a && a.durable_objects && mine.has(a.durable_objects.namespace_id)) out.push({ kind: "app", name: a.name, id: a.id });
  for (const w of workers) out.push({ kind: "worker", name: w });
  for (const b of [n.captures, n.published]) if (buckets.includes(b)) out.push({ kind: "bucket", name: b });
  return out;
}

async function emptyBucket(api, bucket) {
  for (let round = 0; round < 1000; round++) {
    const page = await api(`/r2/buckets/${bucket}/objects?per_page=1000`);
    const keys = arr(page).map((o) => o && (o.key ?? o.name)).filter((k) => typeof k === "string");
    if (!keys.length) return;
    for (const k of keys) await api(`/r2/buckets/${bucket}/objects/${encodeURIComponent(k)}`, { method: "DELETE" });
  }
}

/* Deletes `resources` in order. `done(resource)` is told after each. Throws {remaining, cause} at the first refusal,
   `remaining` being the names not yet deleted. */
/**
 * @param {Api} api
 * @param {Resource[]} resources
 * @param {(resource: Resource) => any} [done]
 * @returns {Promise<void>}
 * @throws {ApproveAgain} on a 401, unchanged
 * @throws {Error} at the first refusal, carrying `remaining`, `cause` and `status`
 */
export async function deleteResources(api, resources, done) {
  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    try {
      if (r.kind === "app") await api(`/containers/applications/${r.id}`, { method: "DELETE" });
      else if (r.kind === "worker") await api(`/workers/scripts/${r.name}?force=true`, { method: "DELETE" });
      else { await emptyBucket(api, r.name); await api(`/r2/buckets/${r.name}`, { method: "DELETE" }); }
    } catch (cause) {
      if (cause && cause.approveAgain) throw cause;
      throw Object.assign(new Error(cause.message), { remaining: resources.slice(i).map((x) => x.name), cause, status: cause.status });
    }
    if (done) await done(r);
  }
}

/* ------------------------------------------------------------------ R69 (F9): one run at a time */

/* Takes the account's lock for this run, or answers that another run holds it (touched within LOCK_LIVE_MS). `lock` is
   `{id, again}`: the run's own id, and the id of the run this one continues, when the founder was asked to approve again
   (R71, F6): a revoked permission cannot drop its lock, and the continuing run must not be stopped by it. */
/**
 * @param {Api} api
 * @param {{id: string, again?: string|null}} lock
 * @param {number} [now] milliseconds since the epoch
 * @returns {Promise<boolean>} true when this run now holds the lock
 */
export async function takeLock(api, lock, now = Date.now()) {
  const held = await bindingsOf(api, LOCK_SCRIPT);
  if (held) {
    const at = Number((held.find((b) => b.name === "T") || {}).text);
    const owner = (held.find((b) => b.name === "ID") || {}).text;
    if (Number.isFinite(at) && now - at < LOCK_LIVE_MS && !(lock.again && owner === lock.again)) return false;
  }
  await touchLock(api, lock.id, now);
  return true;
}
/**
 * Rewrites the lock with this run's id and the time.
 * @param {Api} api
 * @param {string} id the run's id
 * @param {number} [now] milliseconds since the epoch
 * @returns {Promise<any>}
 */
export async function touchLock(api, id, now = Date.now()) {
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.mjs", compatibility_date: "2026-07-01",
    bindings: [{ type: "plain_text", name: "T", text: String(now) }, { type: "plain_text", name: "ID", text: String(id) }] })], { type: "application/json" }));
  fd.append("index.mjs", new Blob(['export default { fetch() { return new Response("bio install lock"); } };'],
    { type: "application/javascript+module" }), "index.mjs");
  return api(`/workers/scripts/${LOCK_SCRIPT}`, { method: "PUT", body: fd });
}
/**
 * Deletes the lock; never throws.
 * @param {Api} api
 * @returns {Promise<void>}
 */
export async function dropLock(api) {
  try { await api(`/workers/scripts/${LOCK_SCRIPT}?force=true`, { method: "DELETE" }); } catch { /* it goes stale by itself */ }
}

/* R62, R65: every copy the inventory shows, a plane and what it holds, or what is left of one that has no plane (a copy under
   its slug's names, or one under the fixed names, whose short name is then "bio-captures": no plane names it). */
/** @type {string} */
export const LEGACY_ORPHAN = "bio-captures";
/**
 * @param {Inventory} inv
 * @returns {Copy[]}
 */
export function allCopies(inv) {
  const out = inv.planes.map((p) => ({ slug: p.slug, scheme: p.scheme, finished: p.finished, plane: true }));
  for (const slug of inv.orphans.slugged.keys()) if (!inv.planes.some((p) => p.slug === slug)) out.push({ slug, scheme: SLUG_SCHEME, finished: false, plane: false });
  if (inv.orphans.legacy.length && !inv.planes.some((p) => p.scheme === LEGACY_SCHEME)) out.push({ slug: LEGACY_ORPHAN, scheme: LEGACY_SCHEME, finished: false, plane: false });
  return out;
}
