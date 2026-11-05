/* ai-gate — the results bundle: manifest, payload, seal, run signature, name and secret scan (R54–R58).
 *
 * FORMATS (bio-gate-bundle/1), checkable with standard tools:
 *   bundle file   "bio-gate-bundle/1\n" then three parts, each "<label> <byte length>\n<bytes>\n", in order:
 *                 `manifest` (record-grammar canonical JSON, plaintext), `signature` (an armored OpenSSH SSHSIG by the
 *                 run key in namespace `bio-ai-run` over `signatures`' runBundleStatement(manifest bytes, SHA-256 hex
 *                 of the sealed payload) — `ssh-keygen -Y verify -n bio-ai-run` checks it), `payload` (the sealed bytes).
 *   sealed payload "bio-gate-seal/1\n" | ephemeral X25519 public key (32) | AES-GCM IV (12) | AES-256-GCM ciphertext
 *                 of the payload's canonical JSON. The key is HKDF-SHA-256 over the X25519 shared secret with
 *                 salt = ephemeral key ‖ recipient key and info = "bio-gate-seal/1"; the additional data is
 *                 "bio-gate-seal/1\n" ‖ the recipient key id. Only the holder of the recipient's private half opens it.
 * The manifest carries the nonce and the image digest declared, so the run signature covers both.
 * Uses WebCrypto only (Workers, containers and Node alike). No key is held here. */
import { canonicalJson, sha256HexSync } from "../../bio-plane/src/record-grammar/index.mjs";
import { runBundleStatement, NS_AI_RUN } from "../../bio-plane/src/sshsig.mjs";
import { BUNDLE_SCHEMA, SEAL_FORMAT, GATE_PARAMS, deepFreeze, refuse, isObj, isNonBlank } from "./params.mjs";
import { lintFixture } from "./bank.mjs";

const te = new TextEncoder();
const td = new TextDecoder();
const cat = (...ps) => { const o = new Uint8Array(ps.reduce((a, p) => a + p.length, 0)); let i = 0; for (const p of ps) { o.set(p, i); i += p.length; } return o; };
const b64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = async (bytes) => hex(await crypto.subtle.digest("SHA-256", bytes));

/* ------------------------------------------------------------------ R55: the payload */

/** R55 — the payload's members, exactly. */
export const PAYLOAD_MEMBERS = deepFreeze(["calls", "run", "stub_logs", "preliminary"]);
export const CALL_KEYS = deepFreeze(["request", "response", "status", "headers", "timings", "usage", "outcome",
  "error_class", "item_id", "repeat", "nonce", "request_id"]);
export const RUN_KEYS = deepFreeze(["image_digest", "suiteVersions", "adapter_version", "profile_version", "subject",
  "challenge", "estimate", "ceiling", "actual", "started_at", "ended_at", "region", "early_stops", "refused_egress",
  "usage_total"]);

/** R55 — null when `payload` holds exactly the members R55 names and no team text; else the first offence. */
export function checkPayload(payload) {
  if (!isObj(payload)) return "payload";
  const keys = Object.keys(payload);
  const extra = keys.find((k) => !PAYLOAD_MEMBERS.includes(k));
  if (extra) return extra;
  const missing = PAYLOAD_MEMBERS.find((k) => !keys.includes(k));
  if (missing) return missing;
  if (!Array.isArray(payload.calls)) return "calls";
  for (const c of payload.calls) {
    if (!isObj(c)) return "calls";
    const bad = Object.keys(c).find((k) => !CALL_KEYS.includes(k));
    if (bad) return `calls.${bad}`;
    if (!isObj(c.timings)) return "calls.timings";
  }
  if (!isObj(payload.run)) return "run";
  const badRun = Object.keys(payload.run).find((k) => !RUN_KEYS.includes(k));
  if (badRun) return `run.${badRun}`;
  if (!isObj(payload.stub_logs)) return "stub_logs";
  if (!isObj(payload.preliminary) || payload.preliminary.preliminary !== true) return "preliminary";
  if (lintFixture(payload.stub_logs) !== null || lintFixture(payload.calls) !== null) return "team_records";
  return null;
}

/* ------------------------------------------------------------------ R54: the manifest */

export const MANIFEST_KEYS = deepFreeze(["schema", "suiteVersions", "image_digest_declared", "nonce", "challenge_id",
  "declared", "served", "region", "started_at", "ended_at", "tiers", "spend", "scope_declared", "terms_page", "files",
  "run_public_key", "sealed_to", "attestation", "identity_mismatches", "incomplete_reason", "overshoot_bound", "contains"]);
export const MANIFEST_CONTAINS = deepFreeze({
  holds: [...PAYLOAD_MEMBERS],
  never: ["credentials", "resolved_secrets", "team_records", "member_names", "member_addresses", "expected_answers"],
});

/** R54 — the payload's files as the manifest lists them: each member's canonical JSON, its size and SHA-256. */
export function payloadFiles(payload) {
  return PAYLOAD_MEMBERS.map((m) => {
    const bytes = te.encode(canonicalJson(payload[m] ?? null));
    return { name: `${m}.json`, bytes: bytes.length, sha256: sha256HexSync(td.decode(bytes)) };
  });
}

/** R54 — the plaintext manifest as canonical JSON. It carries no grade, no payload member, no secret. */
export function buildManifest(input = {}) {
  if (!isObj(input) || !isObj(input.payload)) return refuse("GATE_MANIFEST_INPUT", { field: "payload" });
  const bad = checkPayload(input.payload);
  if (bad) return refuse("GATE_PAYLOAD_UNFIT", { field: bad });
  if ("grade" in input) return refuse("GATE_MANIFEST_INPUT", { field: "grade" });
  for (const f of ["nonce", "challenge_id", "run_public_key", "sealed_to", "started_at", "ended_at"])
    if (!isNonBlank(input[f])) return refuse("GATE_MANIFEST_INPUT", { field: f });
  for (const f of ["suiteVersions", "declared", "spend"]) if (!isObj(input[f])) return refuse("GATE_MANIFEST_INPUT", { field: f });
  if (!Array.isArray(input.tiers)) return refuse("GATE_MANIFEST_INPUT", { field: "tiers" });
  const m = {
    schema: BUNDLE_SCHEMA, suiteVersions: { ...input.suiteVersions },
    image_digest_declared: input.image_digest_declared ?? null, nonce: input.nonce, challenge_id: input.challenge_id,
    declared: { ...input.declared }, served: isObj(input.served) ? { ...input.served } : null, region: input.region ?? null,
    started_at: input.started_at, ended_at: input.ended_at,
    tiers: input.tiers.map((t) => ({ tier: t.tier, completed: t.completed === true })),
    spend: { estimate: input.spend.estimate ?? null, ceiling: input.spend.ceiling ?? null, actual: input.spend.actual ?? null },
    scope_declared: input.scope_declared ?? null, terms_page: input.terms_page ?? null,
    files: payloadFiles(input.payload), run_public_key: input.run_public_key, sealed_to: input.sealed_to,
    attestation: null, identity_mismatches: Number.isSafeInteger(input.identity_mismatches) ? input.identity_mismatches : 0,
    incomplete_reason: input.incomplete_reason ?? null, overshoot_bound: input.overshoot_bound ?? null,
    contains: structuredClone(MANIFEST_CONTAINS),
  };
  const text = canonicalJson(m);
  return Object.freeze({ ok: true, manifest: deepFreeze(m), bytes: te.encode(text) });
}

/* ------------------------------------------------------------------ R56: seal and sign */

const SEAL_HEAD = te.encode(`${SEAL_FORMAT}\n`);

async function sealKeyMaterial(shared, eph, recipient, keyId) {
  const ikm = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: cat(eph, recipient), info: te.encode(SEAL_FORMAT) },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** R56 — the payload sealed to Civicsmith's published key (`ai-catalogue` R54's seal-key document: `{key_id,
 *  public_key}`, a raw X25519 key in base64), so nobody holding the bundle can open it. */
export async function sealPayload(payload, sealingKey) {
  try {
    const bad = checkPayload(payload);
    if (bad) return refuse("GATE_PAYLOAD_UNFIT", { field: bad });
    if (!isObj(sealingKey) || !isNonBlank(sealingKey.key_id) || !isNonBlank(sealingKey.public_key))
      return refuse("GATE_SEAL_KEY_INVALID");
    const recipient = unb64(sealingKey.public_key);
    if (recipient.length !== 32) return refuse("GATE_SEAL_KEY_INVALID");
    const rkey = await crypto.subtle.importKey("raw", recipient, { name: "X25519" }, false, []);
    const ephPair = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
    const eph = new Uint8Array(await crypto.subtle.exportKey("raw", ephPair.publicKey));
    const shared = await crypto.subtle.deriveBits({ name: "X25519", public: rkey }, ephPair.privateKey, 256);
    const key = await sealKeyMaterial(shared, eph, recipient, sealingKey.key_id);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: cat(SEAL_HEAD, te.encode(sealingKey.key_id)) },
      key, te.encode(canonicalJson(payload))));
    const sealed = cat(SEAL_HEAD, eph, iv, ct);
    return { ok: true, sealed, sha256: await sha256Hex(sealed), sealed_to: sealingKey.key_id };
  } catch {
    return refuse("GATE_SEAL_FAILED");
  }
}

/** R56 — the format's opening step for the holder of the private half (the issuer's): given here so the format is
 *  stated in code once; it needs the private key injected, and nothing in this module holds or calls it. */
export async function openSealed(sealed, { key_id, private_key, public_key }) {
  try {
    if (!(sealed instanceof Uint8Array) || sealed.length < SEAL_HEAD.length + 44) return null;
    if (td.decode(sealed.subarray(0, SEAL_HEAD.length)) !== `${SEAL_FORMAT}\n`) return null;
    let o = SEAL_HEAD.length;
    const eph = sealed.slice(o, o + 32); o += 32;
    const iv = sealed.slice(o, o + 12); o += 12;
    const ekey = await crypto.subtle.importKey("raw", eph, { name: "X25519" }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: "X25519", public: ekey }, private_key, 256);
    const key = await sealKeyMaterial(shared, eph, unb64(public_key), key_id);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: cat(SEAL_HEAD, te.encode(key_id)) },
      key, sealed.subarray(o)));
  } catch {
    return null;
  }
}

const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const wStr = (bytes) => cat(u32(bytes.length), bytes);

/** R56 — the run key's public half as an authorized_keys line. */
export async function runPublicLine(publicKey, comment = "bio-ai-run") {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  return `ssh-ed25519 ${b64(cat(wStr(te.encode("ssh-ed25519")), wStr(raw)))} ${comment}`;
}

/** R56 — sign the canonical manifest and the sealed payload's hash with the run key (an Ed25519 CryptoKeyPair), as
 *  an armored SSHSIG in `bio-ai-run` over `signatures`' runBundleStatement. */
export async function signBundle(manifestBytes, payloadHash, runKey) {
  try {
    if (!(manifestBytes instanceof Uint8Array) || !isNonBlank(payloadHash) || !runKey?.privateKey || !runKey?.publicKey)
      return refuse("GATE_SIGN_INPUT");
    const message = runBundleStatement(manifestBytes, payloadHash);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", runKey.publicKey));
    const pubBlob = cat(wStr(te.encode("ssh-ed25519")), wStr(raw));
    const ns = te.encode(NS_AI_RUN);
    const h = new Uint8Array(await crypto.subtle.digest("SHA-512", message));
    const pre = cat(te.encode("SSHSIG"), wStr(ns), wStr(new Uint8Array(0)), wStr(te.encode("sha512")), wStr(h));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, runKey.privateKey, pre));
    const blob = cat(te.encode("SSHSIG"), u32(1), wStr(pubBlob), wStr(ns), wStr(new Uint8Array(0)), wStr(te.encode("sha512")),
      wStr(cat(wStr(te.encode("ssh-ed25519")), wStr(sig))));
    const body = b64(blob).replace(/(.{70})/g, "$1\n").replace(/\n$/, "");
    return { ok: true, signature: `-----BEGIN SSH SIGNATURE-----\n${body}\n-----END SSH SIGNATURE-----\n` };
  } catch {
    return refuse("GATE_SIGN_FAILED");
  }
}

/* ------------------------------------------------------------------ the file of two parts */

const HEAD = `${BUNDLE_SCHEMA}\n`;
const PART_LABELS = ["manifest", "signature", "payload"];

/** R54, R56 — the bundle file: the plaintext manifest and its signature, then the sealed payload. */
export function encodeBundle({ manifestBytes, signature, sealed }) {
  const parts = [manifestBytes, te.encode(signature), sealed];
  return cat(te.encode(HEAD), ...parts.flatMap((p, i) => [te.encode(`${PART_LABELS[i]} ${p.length}\n`), p, te.encode("\n")]));
}

/** The three parts of a bundle file, or null when it is not one. */
export function parseBundle(bytes) {
  try {
    if (!(bytes instanceof Uint8Array)) return null;
    let o = 0;
    const line = () => { const e = bytes.indexOf(10, o); if (e < 0) throw 0; const s = td.decode(bytes.subarray(o, e)); o = e + 1; return s; };
    const schema = line();
    if (!schema.startsWith("bio-gate-bundle/")) return null;
    const out = { schema };
    for (const label of PART_LABELS) {
      const m = /^([a-z]+) (\d+)$/.exec(line());
      if (!m || m[1] !== label) return null;
      const n = Number(m[2]);
      if (o + n + 1 > bytes.length || bytes[o + n] !== 10) return null;
      out[label] = bytes.slice(o, o + n); o += n + 1;
    }
    if (o !== bytes.length) return null;
    return out;
  } catch {
    return null;
  }
}

/** R57 — the manifest of a bundle, read with no key: it never decrypts. */
export function readManifest(bundleBytes) {
  const p = parseBundle(bundleBytes);
  if (!p) return refuse("GATE_BUNDLE_UNREADABLE");
  try { return deepFreeze({ ok: true, schema: p.schema, manifest: JSON.parse(td.decode(p.manifest)) }); }
  catch { return refuse("GATE_BUNDLE_UNREADABLE"); }
}

/* ------------------------------------------------------------------ R58: name and secret scan */

const NAME_PART = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9.]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";

/** R58 — `<provider>-<model>-<date>-<first NAME_HASH_HEX hex of the bundle's hash>.bundle`. */
export function bundleName({ provider, model, date, sha256 }, params = GATE_PARAMS) {
  if (!/^\d{4}-\d\d-\d\d$/.test(String(date)) || !/^[0-9a-f]{64}$/.test(String(sha256))) return refuse("GATE_NAME_INPUT");
  return `${NAME_PART(provider)}-${NAME_PART(model)}-${date}-${sha256.slice(0, params.NAME_HASH_HEX)}.bundle`;
}
export function checkBundleName(name, params = GATE_PARAMS) {
  return new RegExp(`^[a-z0-9._]+-[a-z0-9._]+-\\d{4}-\\d\\d-\\d\\d-[0-9a-f]{${params.NAME_HASH_HEX}}\\.bundle$`).test(String(name));
}

/* The forms an exact secret is looked for in: as is, percent-encoded, and its base64 at each of the three byte
   alignments (the stable core of the encoding wherever it sits in a longer base64 string), plus base64url. */
function secretForms(secret) {
  const forms = [secret, encodeURIComponent(secret)];
  const bytes = te.encode(secret);
  for (let k = 0; k < 3; k++) {
    const enc = b64(cat(new Uint8Array(k), bytes));
    const start = Math.ceil((k * 4) / 3) + (k ? 1 : 0);
    const end = enc.replace(/=+$/, "").length - ((bytes.length + k) % 3 ? 1 : 0);
    const core = enc.slice(start, end);
    if (core.length >= 8) { forms.push(core); forms.push(core.replace(/\+/g, "-").replace(/\//g, "_")); }
  }
  return [...new Set(forms)];
}

/** R58 — scan a payload (and manifest) for an exact secret, in its plain, base64 and percent-encoded forms, and for
 *  the `key_shapes` of the host profile (regular-expression strings, `ai-catalogue` R53). Answers where, never what. */
export function scanForSecrets(payload, keyShapes = [], exactSecrets = []) {
  let text;
  try { text = typeof payload === "string" ? payload : JSON.stringify(payload); } catch { return refuse("GATE_SCAN_INPUT"); }
  text = String(text ?? "");
  const hits = [];
  for (const [i, s] of (Array.isArray(exactSecrets) ? exactSecrets : []).entries()) {
    if (typeof s !== "string" || s.length < 4) continue;
    for (const f of secretForms(s)) if (text.includes(f)) { hits.push({ kind: "exact", index: i, form: f === s ? "plain" : f === encodeURIComponent(s) ? "percent" : "base64" }); break; }
  }
  for (const [i, shape] of (Array.isArray(keyShapes) ? keyShapes : []).entries()) {
    let re; try { re = new RegExp(shape); } catch { continue; }
    if (re.test(text)) hits.push({ kind: "shape", index: i });
  }
  return deepFreeze({ ok: true, clean: hits.length === 0, hits });
}
