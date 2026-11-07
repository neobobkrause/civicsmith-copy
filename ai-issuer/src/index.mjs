/* ai-issuer — Civicsmith's one outward-facing service for the AI catalogue and the AI tests
 * (build/requirements/ai-issuer.md). One Worker on Civicsmith's own Cloudflare account (R21):
 *
 *   GET  /ai/index.json, /ai/catalogue/<seq>.json, /ai/advisories/<seq>.json, /ai/seal-key.json   (R1, R2, R8, R20)
 *        served from the documents bucket alone, byte for byte, never through the store, writing nothing
 *   POST /ai/challenge  (R9, R10)     POST /ai/bundle  (R12–R14)     GET /ai/result/<token>  (R25)
 *   POST /ai/health     (R26)         POST /ai/operator/<act>  (R19: every act behind the one operator credential)
 *
 * It signs nothing, opens no sealed payload, holds no private key (R15), stores no team's name unless the team agreed
 * (R14), and keeps nothing of who asked (R2). The store is `IssuerStore` (store.mjs). */
import { canonicalJson } from "../../bio-plane/src/record-grammar/index.mjs";
import { refusal, statusOf } from "./checks.mjs";
import { paramsOf } from "./params.mjs";
import { shaHex, OPERATOR_ACTS } from "./store.mjs";

export { IssuerStore } from "./store.mjs";

const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: true });

/** R22: the store's clock: a handed instant, else `BIO_NOW_MS`, else the wall clock. */
export function nowOf(env, handed) {
  if (Number.isFinite(handed)) return handed;
  const pinned = env && env.BIO_NOW_MS;
  if (typeof pinned === "string" && /^[0-9]{1,15}$/.test(pinned)) return Number(pinned);
  if (Number.isSafeInteger(pinned)) return pinned;
  return Date.now();
}

/** R15: a binding or variable that is, or names, a private or signing key. The Worker refuses to start with one. */
const PRIVATE_TEXT = /PRIVATE KEY|BIOKEY-RAW1|"d"\s*:\s*"/;
const PRIVATE_NAME = /PRIVATE|SIGNING|SECRET_KEY|SEAL_KEY/i;
export function privateKeyHeld(env) {
  for (const [k, v] of Object.entries(env || {})) {
    if (PRIVATE_NAME.test(k)) return k;
    if (typeof v === "string" && PRIVATE_TEXT.test(v)) return k;
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v.d === "string" && typeof v.kty === "string") return k;
  }
  return null;
}

/* ------------------------------------------------------------------ answers */

const json = (body, status = 200) => new Response(te.encode(canonicalJson(body)),
  { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const refuse = (code, fields) => json(refusal(code, fields), statusOf(code));
const empty = (status, headers = {}) => new Response(null, { status, headers });

/* R1: the static documents, by path; `immutable` for numbered ones. */
function documentOf(path) {
  if (path === "/ai/index.json") return { key: "index.json", immutable: false };
  if (path === "/ai/seal-key.json") return { key: "seal-key.json", immutable: false };
  const m = /^\/ai\/(catalogue|advisories)\/([1-9][0-9]{0,14})\.json$/.exec(path);
  return m ? { key: `${m[1]}/${m[2]}.json`, immutable: true } : null;
}

/** R1, R2, R20: a stored document, exactly as stored; nothing about the caller is read or kept. */
async function serveDocument(env, doc, method, p) {
  let obj;
  try { obj = await env.DOCS.get(doc.key); } catch { return refuse("ISSUER_UNAVAILABLE"); }
  if (!obj) return empty(404);
  const body = new Uint8Array(await obj.arrayBuffer());
  return new Response(method === "HEAD" ? null : body, { status: 200, headers: {
    "content-type": "application/json",
    "cache-control": doc.immutable ? "public, max-age=31536000, immutable" : `public, max-age=${p.INDEX_MAX_AGE}`,
  } });
}

/* A body read to at most `max` bytes; null when it is longer. */
async function readCapped(request, max) {
  const stated = Number(request.headers.get("content-length"));
  if (Number.isFinite(stated) && stated > max) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) { try { await reader.cancel(); } catch { /* nothing */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
async function readJson(request, max) {
  const bytes = await readCapped(request, max);
  if (bytes === null) return { field: "size" };
  try { return { value: JSON.parse(td.decode(bytes)) }; } catch { return { field: "json" }; }
}

/* Constant-time comparison of two hex strings of equal length. */
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/** R19: the one operator credential, held only as its SHA-256 (`OPERATOR_CREDENTIAL_SHA256`), presented as a bearer. */
function authorised(request, env) {
  const expected = typeof env.OPERATOR_CREDENTIAL_SHA256 === "string" ? env.OPERATOR_CREDENTIAL_SHA256.trim().toLowerCase() : "";
  const m = /^Bearer ([\x21-\x7e]{16,512})$/.exec(request.headers.get("authorization") || "");
  return /^[0-9a-f]{64}$/.test(expected) && !!m && sameHex(shaHex(m[1]), expected);
}

const store = (env) => env.STORE.get(env.STORE.idFromName("ai-issuer"));
const TOKEN_PATH = /^\/ai\/result\/([A-Za-z0-9_-]{16,128})$/;
const OPERATOR_PATH = /^\/ai\/operator\/([A-Za-z]{1,32})$/;
const ROUTES = { "/ai/challenge": "POST", "/ai/bundle": "POST", "/ai/health": "POST" };

async function handle(request, env, handedNow) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const p = paramsOf(env);
  if (privateKeyHeld(env)) return refuse("ISSUER_UNAVAILABLE");
  const doc = documentOf(path);
  if (doc) {
    if (method !== "GET" && method !== "HEAD") return empty(405, { allow: "GET, HEAD" });
    return serveDocument(env, doc, method, p);
  }
  const token = TOKEN_PATH.exec(path), op = OPERATOR_PATH.exec(path);
  const wanted = ROUTES[path] ?? (token ? "GET" : op ? "POST" : null);
  if (!wanted) return empty(404);
  if (method !== wanted) return empty(405, { allow: wanted });
  const now = nowOf(env, handedNow);
  try {
    if (path === "/ai/challenge") {
      const r = await readJson(request, 16 * 1024);
      if (r.field) return refuse("ISSUER_BAD_REQUEST", { field: r.field });
      const a = await store(env).challenge(r.value, now);
      return a.ok ? json(a) : json(a, statusOf(a.code));
    }
    if (path === "/ai/bundle") {
      const bytes = await readCapped(request, p.BUNDLE_MAX_BYTES);
      if (bytes === null) return json({ ...refusal("BUNDLE_TOO_LARGE"), status: "rejected", reason: "BUNDLE_TOO_LARGE" }, 413);
      const a = await store(env).receiveBundle(bytes, now);
      return json(a, a.status === "rejected" ? 422 : 200);
    }
    if (path === "/ai/health") {
      const r = await readJson(request, p.HEALTH_MAX_BYTES);
      if (r.field) return refuse("ISSUER_BAD_REQUEST", { field: r.field });
      const a = await store(env).health(r.value, now);
      return a.ok ? json({ ok: true }) : json(a, statusOf(a.code));
    }
    if (token) {
      const a = await store(env).resultFor(shaHex(token[1]));
      return a ? json(a) : json({}, 404);
    }
    const act = op[1];
    if (!OPERATOR_ACTS.includes(act)) return empty(404);
    if (!authorised(request, env)) {
      await store(env).refused(act, now);
      return refuse("ISSUER_NOT_AUTHORISED");
    }
    const r = await readJson(request, 16 * 1024 * 1024);
    if (r.field) return refuse("ISSUER_BAD_REQUEST", { field: r.field });
    const a = await store(env).operator(act, r.value, now);
    return a.ok === false ? json(a, statusOf(a.code)) : json(a);
  } catch {
    return refuse("ISSUER_UNAVAILABLE");
  }
}

export default {
  fetch(request, env) { return handle(request, env); },
  /* R18: the daily sweep */
  async scheduled(_event, env) { if (!privateKeyHeld(env)) await store(env).sweep(nowOf(env)); },
};
export { handle };
