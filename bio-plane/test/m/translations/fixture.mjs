/* translations over a Durable Object storage at the plane's shape (K316): `sql.exec` answers a CURSOR, as workerd's does,
   never an array, and refuses a LIKE or GLOB pattern over workerd's 50 bytes (K313), which node:sqlite does not. The
   module runs over the REAL record-core (its schema, settings and table declarations) and the REAL membership and
   ai-accounts of the ai-accounts test world; the other providers it uses are handed in, so each test drives the module
   at its interface. It cannot import `instance-setup`'s fixture (a later module): the parts it needs (`storage`,
   `applyRecordSchema`, `frame`) are copied here. */
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { RECORD_SCHEMA, recordOf } from "../../../src/record-core/index.mjs";
import { translationsOf, translationsOps } from "../../../src/translations/index.mjs";

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

/** One Durable Object storage; `statements` keeps every statement run, for a test to show what an act wrote. */
export function storage(db = new DatabaseSync(":memory:")) {
  const statements = [];
  const sql = {
    exec(q, ...args) {
      statements.push(q);
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  let n = 0;
  return {
    sql, db, statements,
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

/** Boot the module on a fresh storage, as the plane does: record-core is made before the record's schema pass, then the
 *  module is built (it creates and declares its tables). `more` hands in the providers (`membership`, `aiAccounts`,
 *  `jurisdictions`, `record`) and `now`. */
export function boot({ now = null, more = {}, st = null } = {}) {
  const store = st ? storage(st.db) : storage();
  const ctx = { storage: store };
  const record = more.record ?? recordOf(ctx);
  applyRecordSchema(store);
  const m = translationsOf(ctx, { record, ...(now ? { now } : {}), ...more });
  return { m, st: store, ctx, record };
}

/* A `doAnswer`-shaped frame of this module's routes, as the control plane's door (its R25, R26, R35) meets them: an
   absent body is null, a body that is not JSON is 400 `BAD_JSON` before the route runs, an answer is `{ok: true,
   result}`, and a route that throws is 500 `STORE_INTERNAL_ERROR` with a correlation id and no stack. `null` for a route
   that is not this module's. */
export async function frame(m, req) {
  const url = new URL(req.url);
  const op = url.pathname.slice(1);
  if (!Object.hasOwn(translationsOps(m, url, null), op)) return null;
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
    return Response.json({ ok: true, result: await translationsOps(m, url, body)[op]() });
  } catch {
    // fixtures-contract: store-door store-replies
    return Response.json({ ok: false, error: "internal error", reason: "STORE_INTERNAL_ERROR", code: "STORE_INTERNAL_ERROR",
                           correlation: webcrypto.randomUUID() }, { status: 500 });
  }
}

export { translationsOps };
