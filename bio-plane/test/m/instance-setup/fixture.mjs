/* instance-setup over a Durable Object storage at the plane's shape (K316): `sql.exec` answers a CURSOR, as workerd's
   does, never an array, and refuses a LIKE or GLOB pattern over workerd's 50 bytes (K313), which node:sqlite does not.
   The module runs over the REAL record-core (its schema, settings, purge declarations and first-boot witness); the
   other providers it uses are stand-ins recording what they are asked, so each test drives the module at its
   interface. */
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { RECORD_SCHEMA, recordOf } from "../../../src/record-core/index.mjs";
import { InstanceSetup, instanceSetupOps } from "../../../src/setup.mjs";
import { AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { registrars } from "../promotion/fixtures.mjs";
import { groupIdentityRegistrar } from "../public-read/fixtures.mjs";
import { linesWorld } from "../lines/fixtures.mjs";

export const WORKERD_PATTERN_CAP = 50;
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

function patternsOf(q, args) {
  const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
  const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
  return [...literal, ...bound];
}

/** One Durable Object storage. `failWrites(pred)` makes a matching write throw, as a store that does not answer. */
export function storage(db = new DatabaseSync(":memory:")) {
  let n = 0;
  let failing = null;
  const statements = [];
  const sql = {
    exec(q, ...args) {
      statements.push(q);
      if (patternsOf(q, args).some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP)) throw new Error("LIKE or GLOB pattern too complex");
      if (failing && failing(q, args)) throw new Error("the store did not answer this write");
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  return {
    sql, db, statements,
    failWrites(pred) { failing = pred; },
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

export const applyRecordSchema = (st) => {
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
};

/* public-read's own answers to a registration (its published fixture). */
const registration = groupIdentityRegistrar();

/* The providers this module uses, as stand-ins that record what they were asked. */
export function providers({ admins = ["admin", "member:ada"] } = {}) {
  const consumers = [];
  const listeners = [];
  const arms = [];
  const starts = [];
  const governed = [];
  const fetched = [];
  const p = {
    consumers, listeners, arms, starts, governed, fetched,
    admins: new Set(admins),
    membership: { isAdministrator: (id) => p.admins.has(id) },
    promotion: registrars().p,
    scheduler: {
      register(module, c) { consumers.push({ module, ...c }); return { ok: true, module, name: c.name, key: c.key }; },
      async arm() { arms.push(Date.now()); return null; },
      async start() { starts.push(consumers.map((c) => c.name)); return null; },
    },
    capture: { on(event, module, fn) { listeners.push({ event, module, fn }); return { ok: true, event, module }; } },
    governorHold: null,
    governor: {
      governorAdmit({ host }) { governed.push(["admit", host]); return p.governorHold ? { admitted: false, reason: p.governorHold } : { admitted: true, wait_ms: 0 }; },
      governorReport({ host, status }) { governed.push(["report", host, status]); return { recorded: true }; },
    },
    /* ai-accounts R21's keep-away state (N996; was credentials R52), as a stand-in coded to its requirement: off before
       any set; a test sets `keepAway` to what the setting answers (`on` true, false, or null when it could not be read). */
    keepAway: { on: false, reason: null, set_by: null, set_at: null },
    /* `credentials` is read for `recoveryCodesState` alone (R66); a test hands its own. */
    credentials: {},
    aiAccounts: {
      aiKeepAwayState: () => ({ ...p.keepAway }),
      /* ai-accounts R7: null while not kept away; otherwise its one AI_KEPT_AWAY refusal, its row as ai-accounts holds it,
         carrying the setting as `keep_away` (the three null when the setting could not be read). */
      aiKeptAway: () => (p.keepAway.on === false ? null : {
        ok: false, reason: "AI_KEPT_AWAY", code: "AI_KEPT_AWAY", check: AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.check,
        translation: AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.translation,
        detail: p.keepAway.on === true ? localize("ai-accounts.index.the_team_keeps_its_material", "the team keeps its material away from every assistant, so no account was read or used. Nothing was sent.")
          : localize("ai-accounts.index.whether_the_team_keeps_its", "whether the team keeps its material away from every assistant could not be read, so no account was read or used. Nothing was sent."),
        keep_away: p.keepAway.on === true ? { reason: p.keepAway.reason, set_by: p.keepAway.set_by, set_at: p.keepAway.set_at }
          : { reason: null, set_by: null, set_at: null } }),
    },
    /* public-read R34's registration door, as a stand-in coded to its requirement: once, a door `identity()`, else
       PROVIDER_MALFORMED; a second PROVIDER_DECLARED; each refusal registering nothing. `identities` holds what was
       registered, for a test to read through. */
    identities: [],
    publicRead: {
      registerGroupIdentity({ identity } = {}) {
        if (typeof identity !== "function") return registration.malformed;
        if (p.identities.length) return registration.declared;
        p.identities.push(identity); return registration.first;
      },
    },
    /* The domain's answer: a function of the URL, or a thrown error. */
    answer: () => new Response("", { status: 404 }),
    fetch: async (url, init) => { fetched.push({ url: String(url), init }); return p.answer(String(url), init); },
  };
  return p;
}

/**
 * Boot the module on a storage, as the plane does: record-core is made (and witnesses the first boot) before the
 * record's schema pass, then the module starts. `st` given boots the SAME database again, as a new Durable Object
 * instance over it (a later boot).
 */
export async function boot({ st = null, env = {}, prov = null, now = null, more = {} } = {}) {
  const store = st ? storage(st.db) : storage();
  const ctx = { storage: store };
  const record = recordOf(ctx);                 // the first-boot witness, before any table is made
  applyRecordSchema(store);                     // the record's schema pass (CREATE IF NOT EXISTS)
  const p = prov || providers();
  const deps = { record, membership: p.membership, credentials: p.credentials, aiAccounts: p.aiAccounts, promotion: p.promotion, scheduler: p.scheduler, capture: p.capture,
                 governor: p.governor, publicRead: p.publicRead, fetch: p.fetch, sleep: async () => {}, ...(now ? { now } : {}), ...more };
  const m = new InstanceSetup(ctx, env, deps);
  const started = await m.start();
  return { m, st: store, ctx, record, prov: p, started, env };
}

/* A `doAnswer` as the control plane's reads it (control-plane R23, R25):
   `ok: true` is an answer; `ok: false` below 500 is the store's own refusal, `refused` with its `reply`; anything else
   is a silence, carrying the correlation id of the store's `STORE_INTERNAL_ERROR` when it gave a well-formed one. */
const CORRELATION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const doAnswer = async (res) => {
  let r = null, out = null;
  try { r = await res; out = await r.json(); } catch { out = null; }
  if (!out || typeof out !== "object" || Array.isArray(out)) return { answered: false, result: undefined };
  const reply = { status: typeof r.status === "number" ? r.status : 200, body: out };
  if (out.ok === true) return { answered: true, result: out.result, reply };
  if (out.ok === false && reply.status < 500) return { answered: false, refused: true, result: undefined, reply };
  const correlation = out.reason === "STORE_INTERNAL_ERROR" && typeof out.correlation === "string"
    && CORRELATION_RE.test(out.correlation) ? out.correlation : undefined;
  return correlation ? { answered: false, result: undefined, correlation } : { answered: false, result: undefined };
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
/* The plane's two answers for a reply that is no answer: `storeSilent` (502, the correlation carried when given, no key
   otherwise) and `storeRefusal` (the store's own envelope at its status). `io` hands both, as control-plane does;
   `ioLegacy` hands no `storeRefusal`, as legacy-index's call sites do today. */
export const io = {
  json,
  storeSilent: (op, correlation = undefined) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op, correlation }, 502),
  storeRefusal: (out, extra = {}) => json({ ...out.reply.body, ...extra }, out.reply.status),
  doAnswer,
};
export const ioLegacy = { json: io.json, storeSilent: io.storeSilent, doAnswer };

/* The frame this module's routes pass on the instance (N348): `control-plane`'s door (its R25, R26, R35), which joins
   `instanceSetupOps` to its one route map. `control-plane` comes after this module in the order, so its tests are the
   ones that drive the real door; this is that door's behaviour as this module's routes meet it: an absent body is
   null, a body that is not JSON is 400 `BAD_JSON` before the route runs, an answer is `{ok: true, result}`, and a route
   that throws is 500 `STORE_INTERNAL_ERROR` with a correlation id and no stack, message or path. `null` for a route
   that is not this module's, so the caller answers it. */
export async function frame(m, req) {
  const url = new URL(req.url);
  const op = url.pathname.slice(1);
  if (!Object.hasOwn(instanceSetupOps(m, url, null), op)) return null;
  let body = null;
  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.trim() !== "") {
      try { body = JSON.parse(raw); }
      // fixtures-contract: store-door store-replies
      catch { return Response.json({ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, { status: 400 }); }
    }
  }
  try {
    const answer = await instanceSetupOps(m, url, body)[op]();
    /* store-door R13 (K2157): a byte answer (R86's `grouplogo`) is a Response, returned as its owner made it */
    if (answer instanceof Response) return answer;
    return Response.json({ ok: true, result: answer });
  }
  catch {
    // fixtures-contract: store-door store-replies
    return Response.json({ ok: false, error: "internal error", reason: "STORE_INTERNAL_ERROR", code: "STORE_INTERNAL_ERROR",
                           correlation: webcrypto.randomUUID() }, { status: 500 });
  }
}

/** A stub whose fetch reaches this module's routes through `frame`, with `extra` answering any other path
 *  (`bootstrap`, `stats`, …). */
export function stubOver(m, extra = {}, { silent = [] } = {}) {
  return {
    async fetch(input, init) {
      const req = input instanceof Request ? input : new Request(input, init);
      const path = new URL(req.url).pathname.slice(1);
      if (silent.includes(path)) return new Response("boom", { status: 500 });
      const mine = await frame(m, req);
      if (mine) return mine;
      if (extra[path]) return Response.json({ ok: true, result: await extra[path](req) });
      return Response.json({ ok: false, error: "unknown op: " + path }, { status: 400 });
    },
  };
}
export const envOver = (stub, more = {}) => ({ STORE: { idFromName: (n) => n, get: () => stub }, ...more });

export { instanceSetupOps };

/* A small test counter in the style every module suite uses: the title names the requirement. */
export const read = async (res) => ({ status: res.status, body: await res.json() });

/* The registry R50–R52 seed into: the REAL `entities` and `lines` over their own published world (lines' `linesWorld`,
   whose `w.ents` and `w.l` are the modules' real code over a real record). `view()` is what the active profiles add to the
   test profile's view, `{identifier_schemes, spaces}`: its schemes replace any of the same name and its forms in a space
   come before the held ones (the first form to match a value names it). `ents`, `idents` and `lines` read what the
   real modules wrote, from their own tables, for a test to inspect; the world's own entities and lines are not among
   them. `captures` are the shas the record holds, for a line's basis to cite. */
export async function registryOver(view, captures = []) {
  const { w } = linesWorld();
  captures.forEach((sha, i) => w.held(`INFO-2026-${String(7000 + i)}`, sha));
  const base = w.ents.view();
  const before = new Set(w.rows(`SELECT entity_id FROM entities`).map((r) => r.entity_id));
  const lineBefore = new Set(w.rows(`SELECT line_id FROM lines`).map((r) => r.line_id));
  w.ents.view = () => {
    const { identifier_schemes: added = [], spaces: more = {} } = view();
    const names = new Set(added.map((x) => x.scheme));
    const spaces = { ...base.spaces };
    for (const [k, v] of Object.entries(more)) spaces[k] = { ...(spaces[k] || {}), ...v, forms: [...(v.forms || []), ...((spaces[k] || {}).forms || [])] };
    return { ...base, identifier_schemes: [...base.identifier_schemes.filter((x) => !names.has(x.scheme)), ...added], spaces, conflicts: [] };
  };
  const json = (t) => { try { return JSON.parse(t); } catch { return t; } };
  Object.defineProperties(w.ents, {
    ents: { get: () => new Map(w.rows(`SELECT * FROM entities ORDER BY entity_id`).filter((r) => !before.has(r.entity_id)).map((r) => [r.entity_id, r])) },
    idents: { get: () => w.rows(`SELECT * FROM entity_identifiers WHERE withdrawn_at IS NULL ORDER BY rowid`)
      .filter((r) => !before.has(r.entity_id)).map((r) => ({ entity_id: r.entity_id, scheme: r.scheme, id: r.id, basis: json(r.basis), by: r.held_by })) },
  });
  Object.defineProperty(w.l, "lines", { get: () => w.rows(`SELECT * FROM lines ORDER BY rowid`)
    .filter((r) => !lineBefore.has(r.line_id)).map((r) => ({ line_id: r.line_id, kind: r.kind, from: r.from_entity, to: r.to_entity, capacity: r.capacity, valid: json(r.valid_json),
                   basis: json(r.basis_json), by: r.asserted_by })) });
  return { entities: w.ents, lines: w.l };
}
