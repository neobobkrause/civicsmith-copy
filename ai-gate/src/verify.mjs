/* ai-gate — checking a challenge in the container, and a bundle on Civicsmith's side (R59, R60). Never throws. */
import { verifyRunBundle } from "../../bio-plane/src/sshsig.mjs";
import { canonicalJson } from "../../bio-plane/src/record-grammar/index.mjs";
import { BUNDLE_SCHEMA, GATE_PARAMS, deepFreeze, refuse, isObj, isNonBlank, isInstant } from "./params.mjs";
import { parseBundle, checkPayload, payloadFiles, scanForSecrets, sha256Hex, MANIFEST_KEYS } from "./bundle.mjs";

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

/** R60 — a challenge `{challenge_id, nonce, bank_version, selection_seed, issued_at, expires_at}` is well-formed (a
 *  base64url nonce of at least NONCE_BITS_MIN bits, a selection seed), unexpired at `at`, and for the bank version
 *  the container holds. Its item list is then `selectItems` over its `selection_seed` (R6). */
export function verifyChallenge(challenge, { bank_version, at } = {}, params = GATE_PARAMS) {
  const c = challenge;
  if (!isObj(c) || !isNonBlank(c.challenge_id) || !isNonBlank(c.selection_seed) || !isInstant(c.issued_at)
    || !isInstant(c.expires_at) || !isNonBlank(c.bank_version) || typeof c.nonce !== "string" || !B64URL_RE.test(c.nonce))
    return refuse("CHALLENGE_MALFORMED");
  if (Math.floor(c.nonce.length * 6) < params.NONCE_BITS_MIN) return refuse("CHALLENGE_NONCE_SHORT");
  if (c.bank_version !== bank_version) return refuse("CHALLENGE_BANK_VERSION");
  const now = Date.parse(at);
  if (!Number.isFinite(now) || now >= Date.parse(c.expires_at) || now < Date.parse(c.issued_at)) return refuse("CHALLENGE_EXPIRED");
  return Object.freeze({ ok: true, challenge_id: c.challenge_id, selection_seed: c.selection_seed });
}

const td = new TextDecoder();
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sum = (xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a + b, 0));

function usageConsistent(payload) {
  const calls = payload.calls;
  const total = payload.run?.usage_total;
  if (!isObj(total)) return false;
  for (const f of ["input_tokens", "output_tokens"]) {
    const s = sum(calls.map((c) => num(c.usage?.normalised?.[f])));
    if (s !== num(total[f])) return false;
  }
  return calls.every((c) => {
    const t = c.timings ?? {};
    const a = Date.parse(t.sent), b = Date.parse(t.first_byte), z = Date.parse(t.last_byte);
    return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(z) && a <= b && b <= z;
  });
}

/** R59 — `rejected` (unreadable, wrong schema, or its opened payload holds a secret: the caller destroys it and tells
 *  the sender), else `verified` only when every check holds, else `unverified` with the failing checks (never
 *  "failed"). `ctx`: `open(sealed)` → plaintext bytes or null; `issuedNonce(challenge_id)` → `{nonce, provider, plan,
 *  run_public_key, bank_version}` or null; `nonceUsed(challenge_id)` → boolean; `releasedDigests`; `keyShapes`. */
export async function verifyBundle(bundle, ctx = {}) {
  try {
    const parts = parseBundle(bundle);
    if (!parts) return deepFreeze({ status: "rejected", reason: "unreadable" });
    if (parts.schema !== BUNDLE_SCHEMA) return deepFreeze({ status: "rejected", reason: "schema" });
    let manifest;
    try { manifest = JSON.parse(td.decode(parts.manifest)); } catch { return deepFreeze({ status: "rejected", reason: "unreadable" }); }
    if (!isObj(manifest) || manifest.schema !== BUNDLE_SCHEMA) return deepFreeze({ status: "rejected", reason: "schema" });
    const failing = [];
    let payload = null;
    const opened = typeof ctx.open === "function" ? await ctx.open(parts.payload) : null;
    if (!(opened instanceof Uint8Array)) failing.push("payload_opens");
    else {
      try { payload = JSON.parse(td.decode(opened)); } catch { payload = null; failing.push("payload_opens"); }
    }
    if (payload) {
      const scan = scanForSecrets(canonicalJson(payload) + canonicalJson(manifest), ctx.keyShapes ?? [], ctx.exactSecrets ?? []);
      if (!scan.clean) return deepFreeze({ status: "rejected", reason: "secret" });
    }
    const keys = Object.keys(manifest);
    if (keys.some((k) => !MANIFEST_KEYS.includes(k)) || manifest.attestation !== null) failing.push("manifest_shape");
    const issued = isNonBlank(manifest.challenge_id) && typeof ctx.issuedNonce === "function" ? await ctx.issuedNonce(manifest.challenge_id) : null;
    const runKey = issued?.run_public_key;
    const sig = isNonBlank(runKey) ? await verifyRunBundle({ manifestBytes: parts.manifest, payloadSha256: await sha256Hex(parts.payload),
      armored: td.decode(parts.signature), runPublicKey: runKey }) : { ok: false };
    if (!sig.ok || manifest.run_public_key !== runKey) failing.push("signature");
    if (!issued || issued.nonce !== manifest.nonce || issued.provider !== manifest.declared?.provider
      || issued.plan !== manifest.declared?.plan) failing.push("nonce_issued");
    if (typeof ctx.nonceUsed !== "function" || (await ctx.nonceUsed(manifest.challenge_id)) !== false) failing.push("nonce_unused");
    if (!Array.isArray(ctx.releasedDigests) || !ctx.releasedDigests.includes(manifest.image_digest_declared)) failing.push("image_digest");
    if (payload) {
      if (checkPayload(payload) !== null) failing.push("payload_shape");
      else {
        if (canonicalJson(payloadFiles(payload)) !== canonicalJson(manifest.files)) failing.push("payload_hashes");
        const ids = payload.calls.map((c) => c.request_id);
        if (ids.some((x) => !isNonBlank(x)) || new Set(ids).size !== ids.length) failing.push("request_ids_unique");
        if (!usageConsistent(payload)) failing.push("usage_consistent");
        if (payload.calls.some((c) => c.nonce !== manifest.nonce)) failing.push("nonce_in_calls");
      }
    }
    return deepFreeze(failing.length ? { status: "unverified", failing } : { status: "verified", manifest, payload });
  } catch {
    return deepFreeze({ status: "rejected", reason: "unreadable" });
  }
}
