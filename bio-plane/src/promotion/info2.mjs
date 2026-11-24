/* R55 (K773): the information@2 register grammar, C-18.6 and C-18.7, moved here whole from the catalogue in T19 and
 * registered with record-core (its R67) into record-grammar R28's C-18.6/.7 slot, so the gate (R27) and the audit run
 * it in the arm's place and order, as the catalogue's `LEGACY_GRAMMARS` entry did. The catalogue's notes are kept. */

import { b64ToBytes, createSha256 } from "../record-grammar/index.mjs";

/* The catalogue's finding shape, `{check, severity, message, repairable?, repairs?}`. */
const f = (check, severity, message, repairs) => ({ check, severity, message, ...(repairs ? { repairable: true, repairs } : {}) });
const asText = (v) => (typeof v === "string" ? v : new TextDecoder().decode(v));

// ---------------------------------------------------------------------------
// information@2 (M3' member submissions): the register contract extended by
// the schema bump taken once. C-18.1 gains the @2 shapes (mandatory register,
// capture encoding, custody for member-origin documents, attestation_attempts,
// parts, derived, releases); C-18.6 verifies registered capture hashes against
// stored bytes (decode-at-promotion means bytes at rest hash directly; legacy
// base64 decodes first); C-18.7 stages the doctrine 4a release signature
// (detached SSH signature, ssh-keygen -Y, namespace bio-release) as a warning
// until member keys are distributed. Scoped by schema stamp: information@1
// bundles keep the v1 contract per spec Section 8 check versioning.
// ---------------------------------------------------------------------------

const CAPTURE_ENCODINGS = ['utf8', 'base64', 'binary'];
const RAW_SHA_RE = /^[0-9a-f]{64}$/;

/** Stored value to hashable input: base64 decodes to raw bytes; utf8 and
 *  binary hash as stored (ctx.sha256 accepts string or bytes, so the Apps
 *  Script embed, which reads text files as strings, needs no TextEncoder). */
function storedToHashable(v, encoding) {
  if (encoding === 'base64') return b64ToBytes(asText(v));
  return v;
}

export async function checkInfo2Contract(ctx, findings) {
  if (ctx.fm?.object_type !== 'information' || ctx.fm?.schema !== 'information@2') return;
  const raw = ctx.files.get('data/provenance.json');
  if (!raw) {
    return;
  }
  let reg; try { reg = JSON.parse(asText(raw)); } catch { return; } // C-14.3 reports
  const docs = reg && Array.isArray(reg.documents) ? reg.documents : null;
  if (!docs) return; // C-18.1 v1 shape check reports
  // C-18.7 (warn): the staged posture until member keys are distributed.
  const hist = Array.isArray(ctx.fm.state_history) ? ctx.fm.state_history : [];
  const rels = Array.isArray(reg.releases) ? reg.releases : [];
  for (const e of hist) {
    if (!e || e.from_state !== 'collected' || e.to_state !== 'verified') continue;
    const signed = rels.some(r => r && r.transition === e.timestamp && r.signature_file);
    if (!signed) {
      findings.push(f('C-18.7', 'warn', `collected -> verified transition at ${e.timestamp} has no signed release record; the target mechanism is a detached SSH signature over the transition record (ssh-keygen -Y sign, namespace bio-release; doctrine 4a)`,
        ['sign the transition record and add the releases[] entry with signature_file, signer, namespace', 'record the interim member review of the release log in Review Notes']));
    }
  }
  // C-18.6 (error): registered capture hashes verify against stored bytes.
  // 1.11.0 (KICKOFF-P2M6 4a): byte-stored parts stream through the
  // incremental SHA-256 one part at a time, decoded per part for legacy
  // base64, so peak residency is a single part, never the reassembled
  // whole. Text-stored parts keep the join path (Apps Script text reads
  // are strings and hash natively over UTF-8; no TextEncoder dependency).
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]; if (!d || typeof d !== 'object') continue;
    const cap = d.capture && typeof d.capture === 'object' ? d.capture : {};
    if (!RAW_SHA_RE.test(cap.sha256 || '') || !CAPTURE_ENCODINGS.includes(cap.encoding)) continue;
    let hashable = null;
    let actual = null;
    try {
      if (Array.isArray(d.parts) && d.parts.length && d.parts.every(p => p && p.file && ctx.files.has(String(p.file)))) {
        const stored = d.parts.map(p => ctx.files.get(String(p.file)));
        const textStored = v => cap.encoding !== 'base64' && typeof v === 'string';
        if (stored.every(v => textStored(v))) {
          hashable = stored.join('');
        } else if (stored.every(v => !textStored(v))) {
          const h = createSha256();
          for (const v of stored) h.update(cap.encoding === 'base64' ? b64ToBytes(asText(v)) : v);
          actual = h.hex();
        } else {
          throw new Error('parts mix text and binary storage');
        }
      } else if (d.file && ctx.files.has(String(d.file))) {
        hashable = storedToHashable(ctx.files.get(String(d.file)), cap.encoding);
      }
    } catch (err) {
      findings.push(f('C-18.6', 'error', `provenance documents[${i}]: stored content could not be decoded for hash verification (${err && err.message}) (@2)`));
      continue;
    }
    if (actual === null) {
      if (hashable === null) continue;
      actual = await ctx.sha256(hashable);
    }
    if (actual !== cap.sha256) {
      findings.push(f('C-18.6', 'error', `provenance documents[${i}]: stored bytes hash ${actual.slice(0, 12)}… but the register records ${String(cap.sha256).slice(0, 12)}…; silent content mutation fails the gate (@2)`,
        ['restore the capture from history', 'correct the register only if the recorded hash was wrong at intake, with a Session Log entry']));
    }
  }
}

/** R55: the grammar promotion registers, claiming the slot's two ids whole. */
export const INFO2_GRAMMAR = Object.freeze({ ids: Object.freeze(["C-18.6", "C-18.7"]), arm: checkInfo2Contract });
