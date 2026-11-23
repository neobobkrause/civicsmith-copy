/* Preloaded (`node --import`) into `dev-copy.mjs` under test, with `stubfetch.mjs` before it (release R43 to R45): a
 * stand-in for the parts of a Cloudflare account a development copy is put up in and removed from, so no test reaches
 * a real account. Every request is answered here or by `stubfetch.mjs`, which throws on any other host; each is logged
 * to `$BUNDLER_STUB_LOG` as one JSON line, the bearer token only as present or absent.
 *
 * Scenario (the same `$BUNDLER_STUB` file, key `account`):
 *   { scripts: [<name>], buckets: { <name>: [<object key>] }, d1: [{ uuid, name }], containers: [{ id, name }],
 *     sticky: [<name>]   (a resource whose delete answers 200 and is still there on read-back),
 *     planeAdmin: { door: "open" | "closed", recorded?: true }   (what the copy's plane answers: op=bootstrap's
 *       `claimed`, and instancegroupseed's GROUP_ALREADY_RECORDED once a group is recorded) }
 * The account's state lives in this process; a delete removes from it, a create adds to it, and listings read it.
 * The copy's plane is answered at `<name>.<subdomain>.workers.dev`: `GET /version` 200 for a script the account holds,
 * and its operations (`/api/?op=<op>`) logged with their body (the bearer only as present or absent). */
import "./stubfetch.mjs";
import { readFileSync, appendFileSync } from "node:fs";

const S = process.env.BUNDLER_STUB ? JSON.parse(readFileSync(process.env.BUNDLER_STUB, "utf8")) : {};
const A = S.account || {};
A.scripts ||= []; A.buckets ||= {}; A.d1 ||= []; A.containers ||= []; A.sticky ||= [];
const secrets = {};
const log = (entry) => { if (process.env.BUNDLER_STUB_LOG) appendFileSync(process.env.BUNDLER_STUB_LOG, JSON.stringify(entry) + "\n"); };
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const ok = (result) => json(200, { success: true, errors: [], result });
const notFound = () => json(404, { success: false, errors: [{ code: 10007, message: "not found" }] });
const sticky = (name) => A.sticky.includes(name);

const inner = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const method = (init.method || "GET").toUpperCase();
  const headers = /** @type {Record<string, string>} */ (init.headers || {});
  const auth = headers.authorization || headers.Authorization;
  const entry = { method, url: url.href, bearer: typeof auth === "string" && auth.startsWith("Bearer "), devcopy: true };
  const p = url.pathname;
  let m;

  if (url.host.endsWith(".workers.dev")) {
    const name = url.host.split(".")[0];
    if (!A.scripts.includes(name)) { log(entry); return new Response("no such worker", { status: 404 }); }
    if (p === "/version") { log(entry); return new Response(JSON.stringify({ name, version: "1.2.3" }), { status: 200 }); }
    const op = url.searchParams.get("op");
    if (op) {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      log({ ...entry, op, body });
      if (op === "bootstrap") return json(200, { ok: true, claimed: (A.planeAdmin && A.planeAdmin.door) === "closed", bootstrapConfigured: true });
      if (op === "instancegroupseed" && A.planeAdmin && A.planeAdmin.recorded) return json(409, { ok: false, code: "GROUP_ALREADY_RECORDED" });
      return json(200, { ok: true, op });
    }
    log(entry);
    return new Response("ok", { status: 200 });
  }
  if (url.host !== "api.cloudflare.com") return inner(input, init);

  if ((m = p.match(/^\/client\/v4\/accounts\/([^/]+)\/workers\/scripts$/)) && method === "GET") {
    log(entry); return ok(A.scripts.map((id) => ({ id })));
  }
  if ((m = p.match(/\/workers\/scripts\/([^/]+)$/)) && method === "DELETE") {
    log(entry);
    if (!A.scripts.includes(m[1])) return notFound();
    if (!sticky(m[1])) A.scripts = A.scripts.filter((x) => x !== m[1]);
    return ok(null);
  }
  if ((m = p.match(/\/workers\/scripts\/([^/]+)$/)) && method === "PUT") {
    if (!A.scripts.includes(m[1])) A.scripts.push(m[1]);
    return inner(input, init);
  }
  if ((m = p.match(/\/workers\/scripts\/([^/]+)\/secrets$/)) && method === "PUT") {
    const b = JSON.parse(String(init.body));
    log({ ...entry, secret: b.name, type: b.type, text: typeof b.text === "string" && b.text.length > 0 ? "present" : "absent" });
    (secrets[m[1]] ||= {})[b.name] = true;
    return ok({ name: b.name, type: b.type });
  }
  if ((m = p.match(/\/workers\/scripts\/([^/]+)\/subdomain$/)) && method === "POST") {
    log(entry); return ok({ enabled: true });
  }
  if (/\/r2\/buckets$/.test(p)) {
    if (method === "GET") { log(entry); return ok({ buckets: Object.keys(A.buckets).map((name) => ({ name })) }); }
    if (method === "POST") {
      const b = JSON.parse(String(init.body)); log({ ...entry, bucket: b.name });
      if (A.buckets[b.name]) return json(409, { success: false, errors: [{ code: 10004, message: "The bucket you tried to create already exists" }] });
      A.buckets[b.name] = []; return ok({ name: b.name });
    }
  }
  if ((m = p.match(/\/r2\/buckets\/([^/]+)\/objects$/)) && method === "GET") {
    log(entry);
    const keys = A.buckets[decodeURIComponent(m[1])];
    return keys ? ok(keys.map((key) => ({ key }))) : notFound();
  }
  if ((m = p.match(/\/r2\/buckets\/([^/]+)\/objects\/(.+)$/)) && method === "DELETE") {
    log(entry);
    const b = decodeURIComponent(m[1]), key = decodeURIComponent(m[2]);
    if (!A.buckets[b]) return notFound();
    if (!sticky(b)) A.buckets[b] = A.buckets[b].filter((k) => k !== key);
    return ok(null);
  }
  if ((m = p.match(/\/r2\/buckets\/([^/]+)$/)) && method === "DELETE") {
    log(entry);
    const b = decodeURIComponent(m[1]);
    if (!A.buckets[b]) return notFound();
    if (A.buckets[b].length) return json(409, { success: false, errors: [{ code: 10008, message: "The bucket you tried to delete is not empty" }] });
    if (!sticky(b)) delete A.buckets[b];
    return ok(null);
  }
  if (/\/d1\/database$/.test(p) && method === "GET") { log(entry); return ok(A.d1); }
  if ((m = p.match(/\/d1\/database\/([^/]+)$/)) && method === "DELETE") {
    log(entry);
    const d = A.d1.find((x) => x.uuid === m[1]);
    if (!d) return notFound();
    if (!sticky(d.name)) A.d1 = A.d1.filter((x) => x.uuid !== m[1]);
    return ok(null);
  }
  if (/\/containers\/applications$/.test(p) && method === "GET" && S.account) { log(entry); return ok(A.containers); }
  if ((m = p.match(/\/containers\/applications\/([^/]+)$/)) && method === "DELETE") {
    log(entry);
    const c = A.containers.find((x) => x.id === m[1]);
    if (!c) return notFound();
    if (!sticky(c.name)) A.containers = A.containers.filter((x) => x.id !== m[1]);
    return ok(null);
  }
  return inner(input, init);
};
