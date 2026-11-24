/* store-assembly R90–R94 (K5046 (d), (g); K5052 (7); `op-tables.md` §5.2): THE WORLD. `storeWorld()` answers the real store,
   `assembleStore` over a real SQL database (`node:sqlite` behind `sql.exec` answering a cursor, as workerd's does) as the
   Durable Object's storage, migrated and with `instance-setup` started. Every module is the real one; only the platform is
   answered, by doubles of it and of nothing else:
     `cloudflare:workers`  a stand-in `DurableObject`, for a test that also loads plane's class (the assembly imports none);
     `ctx`                 `storage.sql`, `transactionSync` (a savepoint, rolled back and rethrown when the callback throws),
                           the alarm calls, `id`, `blockConcurrencyWhile` (the blocked work recorded and awaited) and `waitUntil`;
     `env`                 `STORE` answering `idFromName`, `CAPTURES` an in-memory bucket with R2's surface, `BIO_NOW_MS` the
                           pinned clock, and any other binding the test hands in (`AGENT_WORKER` unbound unless handed, R49);
     the network           `globalThis.fetch` refusing every outbound address as an unreachable network does (a TypeError),
                           until a test scripts an answer for it (`world.script`), the script reaching its own world alone (R94).
   BUILT ONCE FOR A FILE, COPIED FOR A TEST (R91; K5046 (g), K5052 (7)): the first world of each kind (claimed, unclaimed) a file
   asks for builds that kind's base; every world, the first included, is a fresh `assembleStore` over its own copy of its base's
   database (`serialize`, then `deserialize` into a new database) and its own copy of the base's bucket, so no database, `ctx`,
   module instance or row is shared between two worlds. The file prints once `storeWorld: base <ms> ms, copy <ms> ms`.
   The door between a page and the store, the sign-ins and the recipes are `store-request`'s, over this world (its R16 to R19). */
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "cloudflare:workers")
      return { url: "data:text/javascript,export class DurableObject{constructor(c,e){this.ctx=c;this.env=e}};export const env={};",
               shortCircuit: true };
    return next(spec, ctx);
  },
});

const { assembleStore } = await import("../../../src/store-assembly/index.mjs");
const { schedulerOf } = await import("../../../src/scheduler/index.mjs");

/** R93: the instant a world's clock is pinned at unless the test names another: 2026-10-01T12:00:00Z. */
export const WORLD_NOW = Date.parse("2026-10-01T12:00:00Z");
/** R92: the founder's password a claimed world is claimed with (a claimed world's `password`). */
export const WORLD_PASSWORD = "world-founder-passphrase";
/** R92: the handle the founder of a claimed world chose at the claim. */
export const WORLD_FOUNDER_HANDLE = "founder";
/** K5149: the slug the installer binds as `INSTANCE_NAME`, read by instance-setup's first boot (its R2): the producing team every world
 *  records, so a bare world's promote that names its team is not refused `GROUP_UNDETERMINED`. */
export const WORLD_INSTANCE_NAME = "town";

/* ---- the platform: a Durable Object storage over node:sqlite ---- */

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() { const rest = c.toArray(); if (rest.length !== 1) throw new Error(`expected one row, got ${rest.length}`); return rest[0]; },
  };
  return c;
}

/* R90: `ctx` over `db`, as the runtime hands a Durable Object its state */
function contextOver(db) {
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
    get databaseSize() { return 0; },
  };
  let alarm = null, n = 0;
  const blocked = [];
  const ctx = {
    storage: {
      sql,
      transactionSync: (fn) => {   /* as workerd's: a savepoint, rolled back and rethrown when the callback throws; nests */
        const sp = `sp${n++}`;
        db.exec(`SAVEPOINT ${sp}`);
        try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
        catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
      },
      getAlarm: async () => alarm, setAlarm: async (t) => { alarm = +t; }, deleteAlarm: async () => { alarm = null; },
    },
    id: { equals: () => false, toString: () => "world", name: undefined },
    /* as the runtime's: the callback starts at once (its synchronous part runs inside the caller), its promise is awaited */
    blockConcurrencyWhile(fn) { let p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); } blocked.push(p); return p; },
    waitUntil(p) { blocked.push(Promise.resolve(p).catch(() => {})); },
  };
  return { ctx, blocked };
}

/* ---- the platform: an R2 bucket in memory (the surface the evidence store and capture use) ---- */

const toBytes = async (v) => {
  if (v === null || v === undefined) return new Uint8Array(0);
  if (typeof v === "string") return new TextEncoder().encode(v);
  if (v instanceof Uint8Array) return new Uint8Array(v);
  if (v instanceof ArrayBuffer) return new Uint8Array(v.slice(0));
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
  if (typeof v.getReader === "function" || typeof v.arrayBuffer === "function") return new Uint8Array(await new Response(v).arrayBuffer());
  throw new TypeError("bucket: a value R2 does not take");
};
function objectOf(key, held, range = null) {
  const whole = held.bytes, bytes = range ? whole.subarray(range.offset, range.offset + range.length) : whole;
  const meta = { key, size: whole.length, etag: held.etag, httpEtag: `"${held.etag}"`, uploaded: held.uploaded,
                 httpMetadata: held.httpMetadata, customMetadata: held.customMetadata, ...(range ? { range } : {}) };
  return { ...meta,
    get body() { return new Response(bytes.slice()).body; },
    async arrayBuffer() { return bytes.slice().buffer; }, async bytes() { return bytes.slice(); },
    async text() { return new TextDecoder().decode(bytes); }, async json() { return JSON.parse(new TextDecoder().decode(bytes)); } };
}
function headOf(key, held) {
  const { body: _b, arrayBuffer: _a, bytes: _y, text: _t, json: _j, ...meta } = objectOf(key, held);
  return meta;
}
function rangeOf(size, r) {
  if (!r) return null;
  if (r.suffix != null) { const offset = Math.max(0, size - r.suffix); return { offset, length: size - offset }; }
  const offset = Math.min(r.offset ?? 0, size);
  return { offset, length: Math.min(size - offset, r.length ?? size - offset) };
}
/** R90: an in-memory bucket over `objects` (key → held object), with R2's `head`, `get` (`range`), `put`, `delete`, `list` and
 *  multipart upload. */
export function memoryBucket(objects = new Map()) {
  let etags = 0;
  const uploads = new Map();
  const hold = (bytes, opts = {}) => ({ bytes, etag: `w${++etags}`, uploaded: new Date(), httpMetadata: opts.httpMetadata ?? {},
                                        customMetadata: opts.customMetadata ?? {} });
  const upload = (key, uploadId) => ({
    key, uploadId,
    async uploadPart(n, value) {
      const u = uploads.get(uploadId);
      if (!u) throw new Error("bucket: the multipart upload is over");
      u.parts.set(n, await toBytes(value));
      return { partNumber: n, etag: `p${n}` };
    },
    async complete(list) {
      const u = uploads.get(uploadId);
      if (!u) throw new Error("bucket: the multipart upload is over");
      const ordered = list.map((p) => u.parts.get(p.partNumber));
      if (ordered.some((b) => !b)) throw new Error("bucket: a part named was never uploaded");
      const whole = new Uint8Array(ordered.reduce((s, b) => s + b.length, 0));
      let at = 0;
      for (const b of ordered) { whole.set(b, at); at += b.length; }
      uploads.delete(uploadId);
      objects.set(key, hold(whole, u.opts));
      return headOf(key, objects.get(key));
    },
    async abort() { uploads.delete(uploadId); },
  });
  return {
    objects,
    async head(key) { const h = objects.get(key); return h ? headOf(key, h) : null; },
    async get(key, opts = {}) {
      const h = objects.get(key);
      if (!h) return null;
      return objectOf(key, h, rangeOf(h.bytes.length, opts && opts.range));
    },
    async put(key, value, opts = {}) { objects.set(key, hold(await toBytes(value), opts)); return headOf(key, objects.get(key)); },
    async delete(keys) { for (const k of [].concat(keys)) objects.delete(k); },
    async list({ prefix = "", limit = 1000, cursor: after = null } = {}) {
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = after ? keys.findIndex((k) => k > after) : 0;
      const page = from < 0 ? [] : keys.slice(from, from + limit);
      const truncated = from >= 0 && from + limit < keys.length;
      return { objects: page.map((k) => headOf(k, objects.get(k))), truncated, ...(truncated ? { cursor: page[page.length - 1] } : {}),
               delimitedPrefixes: [] };
    },
    async createMultipartUpload(key, opts = {}) {
      const uploadId = `u${uploads.size + 1}-${++etags}`;
      uploads.set(uploadId, { key, parts: new Map(), opts });
      return upload(key, uploadId);
    },
    resumeMultipartUpload(key, uploadId) { return upload(key, uploadId); },
  };
}
const copyObjects = (objects) => new Map([...objects].map(([k, h]) => [k, { ...h, bytes: h.bytes.slice() }]));

/* ---- the platform: the network ---- */

/* R94: every outbound address refused as an unreachable network refuses it, until a live world scripts an answer for it. A script is its
   world's own (K5200; SCREENS-ENTRY #13 J15): a call made in a world's context (`world.send`, `claim`, `tick`, `within`: the store's own work,
   and what it starts, carries the context) is answered by that world's scripts, the latest first; a call made outside any (a test calling a
   module on a world's instance, or `fetch` itself) by the latest world made's, so no script of one world, or of an earlier test, answers
   another's. The file is one process (node's runner gives each test file its own). */
const IN_WORLD = new AsyncLocalStorage();
let LATEST = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async function worldFetch(input, init) {
  const req = input instanceof Request ? input : new Request(input, init);
  const scripts = (IN_WORLD.getStore() ?? LATEST)?.scripts ?? [];
  for (let i = scripts.length - 1; i >= 0; i--) {
    const { match, answer } = scripts[i];
    const hit = typeof match === "function" ? match(req) : match instanceof RegExp ? match.test(req.url) : req.url.startsWith(String(match));
    if (hit) return answer(req);
  }
  throw new TypeError(`fetch failed: the world's network reaches no address (${new URL(req.url).host})`);
};
/** The node fetch the world replaced, for a test's own use outside the world. */
export const unworldedFetch = realFetch;

/* ---- the world ---- */

async function settle(blocked) {
  for (let i = 0; i < blocked.length; i++) await blocked[i];
}

/* R1, R90: a fresh assembled store over `db` with `env`; the blocked work (migration, starts) awaited */
async function assembled(db, env, opts = {}) {
  const { ctx, blocked } = contextOver(db);
  const store = assembleStore(ctx, env, opts);
  await settle(blocked);
  return { ctx, store, blocked };
}

/* R92: a request to the store's own route, as the store's door is asked in process */
const storeRequest = ({ url, body = null, headers = {}, method = null }) => {
  const h = new Headers(headers);
  const m = method || (body === null || body === undefined ? "GET" : "POST");
  const b = body === null || body === undefined || m === "GET" ? undefined
    : typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer || typeof body.getReader === "function" ? body
    : JSON.stringify(body);
  if (b !== undefined && typeof body === "object" && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) && typeof body.getReader !== "function"
      && !h.has("content-type")) h.set("content-type", "application/json");
  return new Request(url, { method: m, headers: h, ...(b !== undefined ? { body: b, duplex: "half" } : {}) });
};
const answerOf = async (res) => {
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, text }; }
};

/* R92: the founder claimed through the store's own `claim` route (the bootstrap credential is the Worker's, not the world's) */
async function claimOver(store, { password, handle = null } = {}) {
  const res = await store.dispatch(storeRequest({ url: "http://x/claim", body: { password, ...(handle ? { handle } : {}) } }));
  const a = await answerOf(res);
  const result = a.json && a.json.ok === true && a.json.result && typeof a.json.result === "object" ? a.json.result : a.json;
  if (!result || result.ok !== true) throw new Error(`storeWorld: the claim was refused: ${JSON.stringify(a.json ?? a.text)}`);
  return result;
}

const BASES = new Map();   /* one base for each kind: claimed or not, and the installer's name for the instance (null: none bound) */
let printed = false;
const ms = (t0) => Math.round(performance.now() - t0);

/* R91: the base of a kind, built once for the file: the migrated store (and its claim), serialised */
function baseOf(claimed, instanceName) {
  const kind = `${claimed ? "claimed" : "unclaimed"}|${instanceName}`;
  if (!BASES.has(kind)) BASES.set(kind, (async () => {
    const t0 = performance.now();
    const db = new DatabaseSync(":memory:");
    const objects = new Map();
    const env = { STORE: { idFromName: (n) => n }, CAPTURES: memoryBucket(objects), ...(instanceName === null ? {} : { INSTANCE_NAME: instanceName }), BIO_NOW_MS: WORLD_NOW };
    const { store } = await assembled(db, env);
    let founder = null;
    if (claimed) founder = await claimOver(store, { password: WORLD_PASSWORD, handle: WORLD_FOUNDER_HANDLE });
    const bytes = db.serialize();
    db.close();
    return { bytes, objects, founder, ms: ms(t0) };
  })());
  return BASES.get(kind);
}

/** R90–R94: `storeWorld({claimed?, now?, env?, instanceName?, deliver?, releaseKeys?})` answers a world over its own copy of its kind's base:
 *  `{store, ctx, sql, env, db, claimed, password, founder, now(), claim({password, handle?}), send(request), tick(ms), script(match, answer), within(fn)}`.
 *  `claimed: false` gives an unclaimed instance (for the screens that claim it); otherwise the founder (`admin`) is claimed with
 *  `WORLD_PASSWORD` and handle `WORLD_FOUNDER_HANDLE`. `now` pins `env.BIO_NOW_MS` (default `WORLD_NOW`); `env` adds bindings.
 *  `instanceName` is the slug the installer binds as `INSTANCE_NAME` for the first boot (default `WORLD_INSTANCE_NAME`); `null` binds none, as
 *  an older installation's first boot had, so instance-setup records no producing team. `deliver` is `control-plane`'s owed-render delivery,
 *  handed to `assembleStore` as the Durable Object class hands it (R1); none, a row that needs it stays owed (R67). `releaseKeys` is the list of
 *  release keys instance-setup verifies a release notice against, a test's own keys instead of the product's (a test signs with the private half). */
export async function storeWorld({ claimed = true, now = WORLD_NOW, env: extra = {}, instanceName = WORLD_INSTANCE_NAME, deliver = null, releaseKeys = null } = {}) {
  const base = await baseOf(claimed !== false, instanceName);
  const t0 = performance.now();
  const db = new DatabaseSync(":memory:");
  db.deserialize(base.bytes);
  const env = { STORE: { idFromName: (n) => n }, CAPTURES: memoryBucket(copyObjects(base.objects)), ...(instanceName === null ? {} : { INSTANCE_NAME: instanceName }), ...extra, BIO_NOW_MS: now };
  const { ctx, store } = await assembled(db, env, { deliver, ...(releaseKeys ? { releaseKeys } : {}) });
  const copyMs = ms(t0);
  if (!printed) { printed = true; console.log(`storeWorld: base ${base.ms} ms, copy ${copyMs} ms`); }
  const scope = { scripts: [] };   /* R94: this world's network scripts */
  const within = (fn) => IN_WORLD.run(scope, fn);
  let password = claimed !== false ? WORLD_PASSWORD : null, founder = base.founder;
  const world = {
    store, ctx, env, db, sql: ctx.storage.sql, timing: { base: base.ms, copy: copyMs },
    get claimed() { return password !== null; },
    get password() { return password; },
    get founder() { return founder; },
    /** R93: the pinned instant */
    now: () => env.BIO_NOW_MS,
    /** R92: the founder made through the store's own `claim` route; the world then holds the password */
    async claim({ password: p, handle = null } = {}) {
      const r = await within(() => claimOver(store, { password: p, handle }));
      password = p; founder = r;
      return r;
    },
    /** R92: a store request `{url, body, headers, method?}` (as `store-request`'s `innerRequest` makes it) passed to the
     *  assembled store's `dispatch`, answering the store's own Response */
    send(request) { return within(() => store.dispatch(storeRequest(request))); },
    /** R93: the pinned clock moved on by `ms` and the scheduler's firing run at the new instant, its answer answered */
    async tick(by = 0) {
      if (!Number.isFinite(by) || by < 0) throw new Error("storeWorld: tick takes milliseconds, zero or more");
      env.BIO_NOW_MS = env.BIO_NOW_MS + by;
      return within(() => schedulerOf(ctx, env).onAlarm(env.BIO_NOW_MS));
    },
    /** R94: the network's answer for requests `match` names (a URL prefix, a RegExp or a predicate of the Request), this world's alone */
    script(match, answer) { scope.scripts.push({ match, answer }); return world; },
    /** R94: `fn` run in this world's context, so a call it makes to the network (or a module's on this world's instance) is answered by this world's scripts */
    within,
  };
  LATEST = scope;   /* a call outside any world's context reaches the latest world's network */
  return world;
}
