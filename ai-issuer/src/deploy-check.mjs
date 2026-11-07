/* ai-issuer — the deploy check (R21, R15). The Worker is bound to Civicsmith's own Cloudflare account only, with
 * exactly its own store and its two buckets: no service, queue, database, AI or other binding, nothing of any team's
 * account, no catalogue key list widened by a variable, and no private or signing key. `scripts/check.mjs` runs it on
 * `wrangler.jsonc` before a deploy; a problem stops the deploy. */
export const CIVICSMITH_ACCOUNT = "20b533579290b9b93168345edd3b7f72";

const ALLOWED_TOP = new Set(["$schema", "name", "account_id", "main", "compatibility_date", "compatibility_flags",
  "durable_objects", "migrations", "r2_buckets", "vars", "triggers", "observability", "workers_dev", "preview_urls"]);
const BINDING_TOP = ["services", "kv_namespaces", "d1_databases", "queues", "ai", "browser", "vectorize", "hyperdrive",
  "analytics_engine_datasets", "send_email", "dispatch_namespaces", "mtls_certificates", "workflows", "containers",
  "secrets_store_secrets", "tail_consumers", "routes", "route", "env"];
const PRIVATE = /PRIVATE|SIGNING|SECRET_KEY|SEAL_KEY|BIOKEY-RAW1/i;

/** A list of problems, empty when the configuration may be deployed. */
export function deployCheck(config) {
  const out = [];
  if (!config || typeof config !== "object") return ["config"];
  if (config.account_id !== CIVICSMITH_ACCOUNT) out.push("account_id");
  if (config.name !== "ai-issuer") out.push("name");
  for (const k of Object.keys(config)) {
    if (BINDING_TOP.includes(k)) out.push(`binding:${k}`);
    else if (!ALLOWED_TOP.has(k)) out.push(`key:${k}`);
  }
  const dos = config.durable_objects?.bindings ?? [];
  if (dos.length !== 1 || dos[0].name !== "STORE" || dos[0].class_name !== "IssuerStore" || dos[0].script_name !== undefined)
    out.push("durable_objects");
  const r2 = config.r2_buckets ?? [];
  if (r2.length !== 2 || !r2.some((b) => b.binding === "DOCS") || !r2.some((b) => b.binding === "BLOBS")
    || r2.some((b) => Object.keys(b).some((k) => !["binding", "bucket_name", "preview_bucket_name"].includes(k))))
    out.push("r2_buckets");
  for (const [k, v] of Object.entries(config.vars ?? {})) {
    if (k === "CATALOGUE_KEYS" || k === "BIO_NOW_MS" || k === "OPERATOR_CREDENTIAL_SHA256") out.push(`var:${k}`);
    if (PRIVATE.test(k) || (typeof v === "string" && /PRIVATE KEY|BIOKEY-RAW1/.test(v))) out.push(`var:${k}`);
  }
  /* any account id written anywhere in the configuration must be Civicsmith's */
  const text = JSON.stringify(config);
  for (const m of text.matchAll(/[0-9a-f]{32}/g)) if (m[0] !== CIVICSMITH_ACCOUNT) out.push(`account:${m[0]}`);
  return [...new Set(out)];
}

/** wrangler.jsonc's text as an object: comments and trailing commas removed, strings kept. */
export function readJsonc(text) {
  let out = "", i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inStr) { out += c; if (c === "\\") { out += n; i += 2; continue; } if (c === "\"") inStr = false; i++; continue; }
    if (c === "\"") { inStr = true; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = text.indexOf("*/", i + 2) + 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
