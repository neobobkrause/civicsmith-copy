/* C-18.8, the enforced release signature (requirement R31; K10, K62, K64). It fails closed: a registry that cannot
 * prove itself is treated as absent, an absent registry with a post-migration release is an error naming the gap, and
 * a release that cannot be checked is never passed.
 *
 * Every SSHSIG and Ed25519 verification here, the registry root's included, goes through `signatures.verifySshsig`;
 * this module holds no second verifier. What stays in the check is what a signature cannot say: which keys the
 * registry holds for a principal at an instant (OpenSSH `allowed_signers`, with its `valid-after`/`valid-before`
 * windows), and the canonical release message (`releaseMessage`, below, the catalogue's until K64). */

import { verifySshsig } from "../sshsig.mjs";
import { canonicalJson, isMachineIdentity, parseFrontmatter } from "../record-grammar/index.mjs";
import { historyWriteOrder } from "./history.mjs";

/** The exact message a release signature covers (design 5.1), canonical JSON so signer and verifier agree byte for byte. */
export function releaseMessage(fields) {
  return canonicalJson({ v: "bio-release/1", bundle: fields.bundle, transition: fields.transition,
    from_state: fields.from_state, to_state: fields.to_state, signer: fields.signer,
    bundle_md_sha256: fields.bundle_md_sha256, registry_sha256: fields.registry_sha256 });
}

/** A pinned root key as an operator pastes it: the full public-key line, or the bare base64 body. */
export function normalizeRootKey(k) {
  const v = String(k || "").trim();
  if (v === "") return v;
  if (/^(ssh-|ecdsa-|sk-)/.test(v)) return v;
  return "ssh-ed25519 " + v.split(/\s+/)[0];
}

const finding = (severity, message, repairs) => ({ check: "C-18.8", severity, message, ...(repairs ? { repairs } : {}) });
/* The release message's bytes, one byte per UTF-16 unit (the signer's encoding, the catalogue's since D2.1). A unit
   above 0xFF has no such byte: it is never masked to its low byte (two texts would then share one signature, N808), and
   a text holding one is not encoded at all (`null`), so what carries it cannot verify. */
const latin1 = (s) => {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 0xff) return null; u[i] = c; }
  return u;
};
const asText = (v) => (typeof v === "string" ? v : new TextDecoder().decode(v));

const SIGNER_TS_RE = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(?:(\d{2}))?)?Z?$/;
/* OpenSSH validity timestamps, YYYYMMDD[HHMM[SS]] with an optional Z, as an ISO instant. */
function signerTimestamp(v) {
  const m = SIGNER_TS_RE.exec(String(v || "").replace(/^"|"$/g, ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}Z` : null;
}

/** The keys (`type base64`) an allowed_signers text admits for `principal` at the ISO instant `at`. Unknown options
 *  are ignored, never refused; a line with too few fields names no key. */
export function signerKeysAt(text, principal, at) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const toks = line.split(/\s+/);
    if (toks.length < 3) continue;
    const principals = toks[0].split(",").filter(Boolean);
    let k = 1;
    const options = {};
    while (k < toks.length && !/^(ssh-|ecdsa-|sk-)/.test(toks[k])) {
      const eq = toks[k].indexOf("=");
      if (eq === -1) options[toks[k].toLowerCase()] = true;
      else options[toks[k].slice(0, eq).toLowerCase()] = toks[k].slice(eq + 1).replace(/^"|"$/g, "");
      k++;
    }
    if (k + 1 >= toks.length || !principals.includes(principal)) continue;
    const after = options["valid-after"] ? signerTimestamp(options["valid-after"]) : null;
    const before = options["valid-before"] ? signerTimestamp(options["valid-before"]) : null;
    if (after && at < after) continue;
    if (before && at >= before) continue;
    out.push(`${toks[k]} ${toks[k + 1]}`);
  }
  return out;
}

/* verifySshsig's reasons, in the words C-18.8's findings have always used. */
const REASON = { MALFORMED: "unparsable", NAMESPACE: "namespace_mismatch", UNKNOWN_KEY: "key_not_registered_for_principal",
                 BAD_SIGNATURE: "bad_signature", CRYPTO_UNAVAILABLE: "crypto_unavailable" };

/** Verify `armored` over `message` for `principal` at `at`, against the keys `signersText` holds for them then. */
async function verifyFor({ armored, message, signersText, namespace, principal, at }) {
  const keys = signerKeysAt(signersText, principal, at);
  if (!keys.length) return { ok: false, reason: "no_valid_key_for_principal" };
  const v = await verifySshsig(armored, message, namespace, keys);
  return v.ok ? { ok: true } : { ok: false, reason: REASON[v.reason] || String(v.reason).toLowerCase() };
}

/** The registry proves itself against the root keys the CALL SITE pins, never keys it carries (design 3.4.5). */
export async function verifyRegistryRoot(reg) {
  if (!reg) return { trusted: false, reason: "registry_absent" };
  const enforce = reg.rootEnforceFrom || null;
  if (!reg.rootSignature) return enforce ? { trusted: false, reason: "root_signature_missing" }
                                         : { trusted: true, reason: "root_not_enforced" };
  const keys = Array.isArray(reg.rootKeys) ? reg.rootKeys : [];
  if (!keys.length) return enforce ? { trusted: false, reason: "no_pinned_root_keys" }
                                   : { trusted: true, reason: "root_not_enforced" };
  const signed = latin1(String(reg.signers ?? ""));
  const r = signed === null ? { ok: false, reason: "not_latin1" }
    : await verifyFor({ armored: reg.rootSignature, message: signed,
    signersText: keys.map((k) => `operator ${normalizeRootKey(k)}`).join("\n"),
    namespace: reg.rootNamespace || "bio-registry", principal: "operator", at: enforce || "9999-12-31T23:59:59Z" });
  if (r.ok) return { trusted: true, reason: "root_verified" };
  return enforce ? { trusted: false, reason: "root_signature_invalid:" + r.reason }
                 : { trusted: true, reason: "root_invalid_but_not_enforced:" + r.reason };
}

/** R31 (T39; N800, N808): what a release signed, the `bundle.md` as it stood after the promotion that recorded the
 *  release `e`: the first manifest entry, in write order (R30), whose `bundle.md` holds `e` in its `state_history`.
 *  After entry j that is the copy the next promotion took into history under its snap key, or the live `bundle.md`
 *  while j is the head. The bytes are returned as the image holds them, for the caller's `sha256` (a text entry is its
 *  UTF-8 encoding, the stored bytes, R5), never decoded and re-encoded. `{bytes, key}`, else `{unreadable}`: a version
 *  that cannot be read before the release is found, or no version holding it, and the release is never passed. */
export function releasedBundleMd(files, e) {
  const raw = files.get("_history/manifest.json");
  if (raw == null) return { unreadable: "the image carries no history manifest, so no promotion that recorded it can be found" };
  let man;
  try { man = JSON.parse(asText(raw)); } catch { return { unreadable: "the history manifest is unreadable" }; }
  const { entries } = historyWriteOrder(man && man.entries);
  for (let j = 0; j < entries.length; j++) {
    const path = j === entries.length - 1 ? "bundle.md"
      : (entries[j + 1].key ? `_history/bundle_${entries[j + 1].key}.md` : null);
    const bytes = path === null ? null : files.get(path);
    if (typeof bytes !== "string" && !(bytes instanceof Uint8Array))
      return { unreadable: `the bundle.md that promotion '${entries[j].key}' left is not held as bytes in the image${path ? ` (${path})` : ""}` };
    const fm = parseFrontmatter(asText(bytes)).data;
    const hist = fm && typeof fm === "object" && Array.isArray(fm.state_history) ? fm.state_history : [];
    if (hist.some((x) => x && x.timestamp === e.timestamp && x.from_state === e.from_state && x.to_state === e.to_state))
      return { bytes, key: entries[j].key };
  }
  return { unreadable: "no promotion in the record's history holds this release in its bundle.md" };
}

/** C-18.8 over one bundle: `{folderName, fm, files (path → text or bytes), releaseRegistry, sha256}` → findings. */
export async function checkReleaseSignature({ folderName, fm, files, releaseRegistry, sha256 }) {
  const findings = [];
  if (!fm || fm.object_type !== "information") return findings;
  const regAny = releaseRegistry || null;
  /* An unreadable registry refuses at EVERY schema: "cannot check" is never "passed". */
  if (regAny && regAny.unavailable) {
    findings.push(finding("error", `the key registry is declared present but unreadable at this call site (${regAny.reason || "no reason given"}); the gate cannot check signatures and will not pass them`,
      ["restore access to the registry record", "do not promote until the registry reads"]));
    return findings;
  }
  const history = Array.isArray(fm.state_history) ? fm.state_history : [];
  const migration = regAny && regAny.migrationInstant ? regAny.migrationInstant : null;
  /* Below information@2 there is nowhere to record a signature: a post-migration release is an error. */
  if (fm.schema !== "information@2") {
    if (!migration) return findings;
    for (const e of history.filter((x) => x && x.from_state === "collected" && x.to_state === "verified"
                                         && x.timestamp && x.timestamp >= migration))
      findings.push(finding("error", `release at ${e.timestamp} is at or after the migration instant ${migration}, but this record is ${fm.schema || "a pre-contract schema"}: the signed release register exists only at information@2, so this ratification cannot carry a signature the gate can check`,
        ["migrate the record to information@2, then sign the transition and add the releases[] entry",
         "or retire it with the reason recorded (verified -> retired, op=retire), if the release cannot be signed",
         "either way the repair is made where the record stands: C-4.2 refuses any transition that is not an edge in this machine"]));
    return findings;
  }
  const releases = history.filter((x) => x && x.from_state === "collected" && x.to_state === "verified");
  /* Pre-migration releases are C-18.7's business; with no registry, nothing is post-migration. */
  const post = releases.filter((x) => migration && x.timestamp >= migration);
  if (!post.length) return findings;
  const reg = regAny;
  const root = await verifyRegistryRoot(reg);
  if (!root.trusted) {
    findings.push(finding("error", `the key registry does not prove itself (${root.reason}); it is treated as absent, so no principal in it resolves`,
      ["restore the registry root signature", "sign the registry with a pinned root key", "clear root.enforce_from only with a recorded reason"]));
    return findings;
  }
  let records = [];
  const prov = files.get("data/provenance.json");
  if (prov) { try { const p = JSON.parse(asText(prov)); records = Array.isArray(p.releases) ? p.releases : []; } catch { /* C-14.3's */ } }
  for (const e of post) {
    const rec = records.find((r) => r && r.transition === e.timestamp);
    if (!rec || !rec.signature_file) {
      findings.push(finding("error", `release at ${e.timestamp} is at or after the migration instant ${migration} and carries no signed release record`,
        ["sign the transition and add the releases[] entry",
         "or retire it with the reason recorded (verified -> retired, op=retire), if the release cannot be signed",
         "either way the repair is made where the record stands: C-4.2 refuses any transition that is not an edge in this machine"]));
      continue;
    }
    const author = String(e.author || "");
    if (String(rec.signer || "") !== author) {
      findings.push(finding("error", `release at ${e.timestamp}: signer '${rec.signer}' does not equal transition author '${author}'`,
        ["record the release under one identity"]));
      continue;
    }
    if (isMachineIdentity(author)) {
      findings.push(finding("error", `release at ${e.timestamp} is authored by '${author}', a surface or AI identity, never a release author`));
      continue;
    }
    const namespace = reg.namespace || "bio-release";
    if (rec.namespace !== namespace) {
      findings.push(finding("error", `release at ${e.timestamp}: namespace '${rec.namespace}' is not the registry namespace '${namespace}'`));
      continue;
    }
    const armored = files.get(String(rec.signature_file));
    if (armored == null) {
      findings.push(finding("error", `release at ${e.timestamp}: signature file '${rec.signature_file}' holds no bytes at the gate`));
      continue;
    }
    if (rec.registry_sha256 && reg.sha256 && rec.registry_sha256 !== reg.sha256)
      findings.push(finding("warn", `release at ${e.timestamp} records registry ${String(rec.registry_sha256).slice(0, 12)}… but the registry in force is ${String(reg.sha256).slice(0, 12)}…; the usual cause is signing against a stale mirror`,
        ["re-verify against the recorded registry version out of the registry record's history"]));
    const released = releasedBundleMd(files, e);
    if (!released.bytes) {
      findings.push(finding("error", `release at ${e.timestamp}: what was signed cannot be read: ${released.unreadable}; the release is not passed`,
        ["export the record with its history (the manifest and each bundle.md copy held as text)"]));
      continue;
    }
    const message = latin1(releaseMessage({ bundle: folderName, transition: e.timestamp, from_state: e.from_state,
      to_state: e.to_state, signer: rec.signer, bundle_md_sha256: await sha256(released.bytes),
      registry_sha256: rec.registry_sha256 || reg.sha256 }));
    if (message === null) {
      findings.push(finding("error", `release at ${e.timestamp}: its release message holds a character the signer's one-byte encoding cannot carry, so no signature over it can be checked`,
        ["record the signer and the transition in Latin-1 characters"]));
      continue;
    }
    const v = await verifyFor({ armored: asText(armored), message, signersText: reg.signers, namespace,
                                principal: rec.signer, at: e.timestamp });
    if (!v.ok)
      findings.push(finding("error", `release at ${e.timestamp} does not verify (${v.reason}) for signer '${rec.signer}'`,
        ["re-sign the transition over the exact released bundle.md", "confirm the signer key is registered and valid at the transition instant"]));
  }
  return findings;
}
