/* control-plane's test harness: the module loaded under plain node, a fake `env` whose `STORE` is shaped like a Durable
   Object namespace and records every inner request, and a driver that calls `makeFetch(hooks)`'s `fetch` and reads the
   answer. Plane's `src/plane/store.mjs` (the class some suites construct) imports `cloudflare:workers`, which plain
   node cannot resolve, so the one specifier is answered here by an in-thread resolve hook with a stand-in
   `DurableObject` class; nothing else is stubbed and no shared helper is touched. Every test drives the module at its
   interface. */
import "./register-declared.mjs";
import { registerHooks } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "cloudflare:workers")
      return { url: "data:text/javascript,export class DurableObject{constructor(c,e){this.ctx=c;this.env=e}};export const env={};",
               shortCircuit: true };
    return next(spec, ctx);
  },
});

/* The door's own names, with the envelope's beside them (answer-envelope, since the split, K1974), as the suites read both. */
export const M = { ...(await import("../../../src/answer-envelope/index.mjs")), ...(await import("../../../src/control-plane/index.mjs")) };
export const O = await import("../../../src/op-declarations/index.mjs");
export const { makeFetch } = M;
export const { OPS, SESSION_OPS, NEEDS } = O;

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
export const hex64 = () => randomBytes(32).toString("hex");
export const aik = () => `aik-${hex64()}`;

/* The stamp fields R17 names: the query ones and the body ones. */
export const QUERY_STAMPS = ["viewer", "identity", "author", "by", "actor", "who", "origin", "administer"];
export const BODY_STAMPS = ["actorIdentity", "actorViewer", "actorMemberId", "ownerMemberId", "assistantPrincipal",
                            "migrationReplay"];
export const FORGED = "member:forged-by-caller";

const ok = (result, status = 200) => new Response(JSON.stringify({ ok: true, result }), { status });

/** A fake env. `sessions` maps a 64-hex session token to its session row; `creds` maps an `aik-` value to its credential
 *  row (looked up by SHA-256, as the module asks). `answer(call)` may return a Response to override any route. */
export function makeEnv({ sessions = {}, creds = {}, answer = null, omit = [], group = null } = {}) {
  const calls = [];
  /* every `get()` of the namespace: the id it was given and its options (G83: a location hint is the second argument) */
  const gets = [];
  /* admission R21: the public ops' window, asked of bio's store before the op; kept apart from the op's own calls */
  const windowCalls = [];
  /* admission R22 (K2166): the security tally's counts, written through the store's internal `securitycount` after a
     refusal is composed; kept apart from the op's own calls, as the window's are */
  const countCalls = [];
  const bySha = new Map(Object.entries(creds).map(([v, c]) => [sha(v), c]));
  const env = {
    ADMIN_TOKEN: hex64(), MEMBER_TOKEN: hex64(), PROBE_TOKEN: hex64(), DAEMON_TOKEN: hex64(), VERSION: "9.8.7",
    calls, windowCalls, countCalls, gets,
    STORE: {
      idFromName(n) { return n; },
      get(id, opts) {
        gets.push({ id, opts, at: new Error().stack });
        return {
          async fetch(input, init) {
            const req = input instanceof Request ? input : new Request(String(input), init);
            const u = new URL(req.url);
            const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
            let body = null;
            try { body = text ? JSON.parse(text) : null; } catch { body = text; }
            const route = u.pathname.slice(1);
            const call = { ns: id, route, url: u, params: Object.fromEntries(u.searchParams), body, method: req.method,
                           headers: Object.fromEntries(req.headers) };
            if (route === "securitycount") { countCalls.push(call); return ok({ ok: true, counted: true }); }
            if (route === "doorwindow") { windowCalls.push(call); if (answer) { const r = await answer(call); if (r) return r; } return ok({ source: "src-test" }); }
            calls.push(call);
            if (answer) { const r = await answer(call); if (r) return r; }
            /* admission R6, R20 (K2038): a lookup's credential travels in a header, as store-door R9 hands it on */
            if (route === "session") return ok({ session: sessions[req.headers.get("x-bio-session") ?? u.searchParams.get("t")] ?? null });
            if (route === "aicredentiallook") {
              const c = bySha.get(req.headers.get("x-bio-credential-sha") ?? u.searchParams.get("sha"));
              return ok(c ? { found: true, credential: c } : { found: false });
            }
            if (route === "groupidentitypublic" || route === "instancegrouppublic")
              return ok(group ?? { slug: null });
            if (route === "claim") return ok({ ok: true, claimed: true });
            /* (T47; admission R25, credentials R71 (2)) the re-ask window, open by default: a test that wants it shut
               answers `reauthdue` itself */
            if (route === "reauthdue") return ok({ due: null });
            return ok({ ok: true, echo: route });
          },
        };
      },
    },
  };
  for (const k of omit) delete env[k];
  return env;
}

/* Callers. */
export const founder = (caps = []) => ({ role: "admin", capabilities: caps, administer: true, rootOfTrust: true, handle: "founder" });
export const member = (id, caps = [], extra = {}) => ({ role: `member:${id}`, capabilities: caps, administer: false,
                                                        rootOfTrust: false, handle: id, ...extra });
export const cred = (extra = {}) => ({ tokenId: "agent-1", principal: "member:ann", writes: [], revoked: false,
                                       confinedTo: null, taskScope: "t", ...extra });

/** Drive the Worker entry. Returns status, headers, raw text and parsed JSON (null if not JSON). The credential is sent as
 *  R59 (admission R20) has it, in an `Authorization: Bearer` header; `tokenIn: "query"` sends it in the address instead
 *  (T35's deprecated form), `tokenIn: "body"` as a JSON body's `token`. */
export async function call(env, { op, token, params = {}, method = "GET", body, path = "/api", headers = {},
                                  hooks, tokenIn = "header", secretIn = "body", cf = null } = {}) {
  const u = new URL(`https://plane.example${path}`);
  if (op !== undefined) u.searchParams.set("op", op);
  if (token !== undefined && tokenIn === "query") u.searchParams.set("token", token);
  if (token !== undefined && tokenIn === "header") headers = { authorization: `Bearer ${token}`, ...headers };
  if (token !== undefined && tokenIn === "body") body = { ...(body && typeof body === "object" ? body : {}), token };
  /* R59 (R20, R44; admission R20): a review or template grant's secret goes in the JSON body of a POST, unless the address
     form (T35's deprecated one) is asked for with `secretIn: "query"` */
  if (Object.hasOwn(params, "secret") && secretIn === "body") {
    const { secret, ...rest } = params;
    params = rest;
    method = "POST";
    body = { ...(body && typeof body === "object" ? body : {}), secret };
  }
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const fetch = makeFetch(hooks ?? defaultHooks());
  const request = new Request(u, init);
  /* Cloudflare's `request.cf` (its `country`), as the platform sets it */
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  const res = await fetch(request, env);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, headers: res.headers, text, json };
}

/* Hooks that record what reached them: every public op is answered by `publicOp` (ok, naming the op), and `gatedOp`
   declines so the generic forward runs. */
export function defaultHooks(log = []) {
  return {
    log,
    async publicOp(ctx) { log.push({ kind: "public", op: ctx.op }); return M.json({ ok: true, publicOp: ctx.op }); },
    async gatedOp(ctx) { log.push({ kind: "gated", op: ctx.op, cls: ctx.cls }); return undefined; },
    /* instance-setup's public read, as plane's hooks hand it over: the store's projection, opened through doAnswer */
    async publicInstanceGroup(env, storeName, projection) {
      log.push({ kind: "group", ns: storeName, projection });
      return M.doAnswer(env.STORE.get(env.STORE.idFromName(storeName)).fetch(`http://do/${projection}`));
    },
  };
}

/** The inner requests that are not the credential lookups (session, aicredentiallook) or admission's re-ask read (reauthdue). */
export const opCalls = (env) => env.calls.filter((c) => c.route !== "session" && c.route !== "aicredentiallook"
                                                   && c.route !== "reauthdue");

/** A standard world: every kind of caller. */
export function world(opts = {}) {
  const allCaps = opts.caps ?? ["contribute", "publish", "create_projects"];
  const S = { founder: hex64(), ann: hex64(), bare: hex64() };
  const A = { ann: aik(), revoked: aik(), confined: aik(), org: aik() };
  const sessions = {
    [S.founder]: founder(allCaps),
    [S.ann]: member("ann", allCaps),
    [S.bare]: member("bea", []),
    ...(opts.sessions || {}),
  };
  const creds = {
    [A.ann]: cred({ tokenId: "agent-ann", principal: "member:ann", writes: opts.writes ?? [] }),
    [A.revoked]: cred({ tokenId: "agent-old", revoked: true, revokedAt: "2026-09-01", revokedBy: "ann" }),
    [A.confined]: cred({ tokenId: "agent-sandbox", confinedTo: "scratch" }),
    [A.org]: cred({ tokenId: "agent-org", principal: "class:ai" }),
    ...(opts.creds || {}),
  };
  const env = makeEnv({ sessions, creds, answer: opts.answer, omit: opts.omit, group: opts.group });
  return { env, S, A };
}

/** A refusal as the module answers one: status, `ok:false`, the code as `reason` and `code`, its C-number, a sentence. */
export function refused(r, status, code, check) {
  assert.equal(r.status, status, `${code}: ${r.text.slice(0, 300)}`);
  assert.equal(r.json?.ok, false);
  assert.equal(r.json.reason, code);
  assert.equal(r.json.code, code);
  assert.equal(r.json.check, check);
  assert.equal(typeof r.json.translation, "string");
  assert.ok(r.json.translation.length > 0);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
}
