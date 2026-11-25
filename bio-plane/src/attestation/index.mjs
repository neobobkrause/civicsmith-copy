/* attestation — co-attestation and the instance's own key (requirements: `build/requirements/attestation.md`). It asks
 * the timestamp authorities `signatures` names for a trusted timestamp over a capture's hash, and on request a
 * co-archive of its locator (R1–R3); it answers every attestation the record holds for a capture (R7); and it holds the
 * instance's signing key, which signs this instance's receipt for an archive-sourced capture (R4) and the statements
 * later modules ask it to sign (R5, R6). A timestamp proves that the bytes existed at an instant. It never proves where
 * they came from, and never the credibility of their content.
 *
 * Split from `provenance` with N512 (K617, K1193; T25; `build/plan/draft-T25-splits.md` P-2), with no change of
 * meaning: from its `index.mjs`, `attest` and `attestStatus` with their header, `RECEIPT_KIND`, `STATEMENT_KIND`,
 * `instanceStatement`, `attestationsOf` and the receipt block (`receiptStatement`, the key, `signReceipt`,
 * `instanceSign`, `instanceKeyBound`, `instanceKeys`, `signedReceipts`, the `signingKey` option); C-89 from its
 * `checks.mjs` (now `./checks.mjs`); `receipt_keys` and `signed_receipts` from its `schema.mjs` (now `./schema.mjs`);
 * `attestOp` from its `ops.mjs` (now `./ops.mjs`). Provenance R31–R34, R56, R57, R49 and R39 are R1–R7 and R8 here.
 * The comments moved with the code; where one named a provenance requirement that moved, it names this module's.
 *
 * REACHED as `attestationOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps` and returned to every later caller. At creation it creates its tables and declares them to
 * record-core's purge (`receipt_keys` exempt, `signed_receipts` keyed to no bundle; R10).
 * `deps`:
 *   record, provenance  the modules it uses, `recordOf(host)` and `provenanceOf(host)` unless a test passes its own.
 *   now           the module's clock, an ISO instant (default: the wall clock); a key's `first_used` and a receipt's
 *                 `signed_at` read it.
 *   instanceName  the instance's name in its receipts (R4), default `unnamed`.
 *   signingKey    the instance's receipt-signing key (R4, K59): an Ed25519 private key, PKCS#8, base64; held as a
 *                 secret by the operator and replaceable. Absent or unreadable, no key is bound (R6): `signReceipt`
 *                 and `instanceSign` answer `RECEIPT_NO_KEY`, and `instanceKeyBound` false. */

import { isPublicHttpsLocator, createSha256 } from "../record-grammar/index.mjs";
import { timestampRequest, parseTimestampResponse, TSA_ENDPOINTS, TSA_CONTENT_TYPE, TSA_ACCEPT, ARCHIVE_SAVE_BASE,
         ARCHIVE_SERVICE, archiveLocatorFrom } from "../tsa.mjs";
import { recordOf } from "../record-core/index.mjs";
import { provenanceOf, PROVENANCE_ACT_CHECKS } from "../provenance/index.mjs";
import { ARCHIVE_DEPTH_MAX } from "../ooxml.mjs";
import { ATTEST_CHECKS } from "./checks.mjs";
import { migrateAttestation, ATTESTATION_TABLES, ATTESTATION_EXEMPT } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { ATTEST_CHECKS } from "./checks.mjs";
export { ATTESTATION_SCHEMA, ATTESTATION_TABLES, ATTESTATION_EXEMPT, migrateAttestation } from "./schema.mjs";

/** The module's name, under which it declares its tables to record-core's purge. */
export const ATTESTATION_MODULE = "attestation";

const te = new TextEncoder();
const hexOf = (bytes) => createSha256().update(bytes).hex();
const hexBytes = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const secondOf = (iso) => String(iso).replace(/\.\d+Z$/, "Z");
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(String(s)), (c) => c.charCodeAt(0));
/* A JSON parse that answers null for text that does not parse. */
function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
/* A digest as the register keys it: a `sha256:` prefix and case ignored (provenance R5). */
const bareSha = (v) => (typeof v === "string" ? v.trim().replace(/^sha256:/, "").toLowerCase() : null);

/* A refusal carrying its catalogue row. The code is a literal at each site, so DEC-49's guard reads which code a region
   mints. The receipt's rows are provenance's C-103 (its R58), imported. */
const actRefusal = (code, detail, extra) => {
  const row = PROVENANCE_ACT_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
};

/* Trusted timestamps: why the plane asks for them at all.
 *
 * A trusted timestamp (RFC 3161) is a signature by a third party over a hash and an instant, under a key outside our
 * control, so it proves the capture EXISTED at the claimed instant, which is the part an attacker holding a write
 * token cannot forge.
 *
 * Every attempt is recorded, successes and failures alike, in the shape C-18.1 requires. The doctrine is explicit
 * that a failed attempt is recorded with its reason and never omitted: a provenance register showing no attempt and
 * one showing an attempt that failed are different claims, and collapsing them would let an absence read as a
 * success. */
/** R1–R3 — `attest({sha256, archive, locator}, {head, put, fetch, holds, now})`. `head(sha)` and `put(sha, bytes)`
 *  are the evidence store by digest; `fetch` the network (R8: only the compiled endpoints `signatures` names are
 *  asked); `holds(sha)` asks the record whether a receipt or the register names the hash (provenance's
 *  `registerHolds`, its R5), and answers null when the record could not be asked. Answers `{ok, attempts, archive?,
 *  attestation?, held?, note}` or a refusal (`BAD_SHA`, `CAPTURE_HELD_IN_PARTS`, `NO_SUCH_CAPTURE`). Never throws for
 *  a well-formed call. */
export async function attest(body, { head, put, fetch: fetchFn, holds, now = () => new Date().toISOString() } = {}) {
  const sha = typeof body?.sha256 === "string" ? body.sha256.toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(sha))
    return { ok: false, reason: "BAD_SHA", detail: localize("attestation.index.attest_takes_sha", "attest takes the sha256 of a capture already in the store") };
  /* D-530: A MISS ON THE WHOLE-HASH KEY IS NOT ABSENCE. A document over one part
     is stored ONLY as its parts, each under its own hash, and never under the
     whole's (D-469, D-476), so this head misses for every such capture - and the
     setup surface attests the whole hash straight after acquiring it. The
     refusal it gave, "nothing in this store has that hash; capture the document
     before attesting it", was false for bytes the record holds and sent a member
     to capture them again. So a miss asks the store the whole-document question
     (Intake Doctrine section 8, D-476's `registerholds`), and three answers are
     kept apart:
       - the plane's own ACQUISITION RECEIPT names the hash: the plane hashed
         these bytes as they arrived and keeps them in parts, and no caller can
         write that row. The hash is attested, and the answer says how it is held.
       - only the REGISTER names it: a row `op=promote` wrote from what its caller
         named, without reading R2 (D-45). A timestamp is not rested on that
         alone, and the bytes are not called absent either: CAPTURE_HELD_IN_PARTS.
       - neither, or the store did not answer: NO_SUCH_CAPTURE, saying what was
         asked rather than that nothing anywhere holds the bytes. */
  let held = null;
  if (!(await head(sha))) {
    let holdsAnswer = null;
    try { holdsAnswer = typeof holds === "function" ? await holds(sha) : null; } catch { holdsAnswer = null; }
    if (holdsAnswer && holdsAnswer.acquired === true) {
      held = { form: "parts", on: "acquisition_receipt",
               detail: localize("attestation.index.held_in_parts", "no object is stored under this hash, because the document was captured in parts and only its parts are stored, each under its own hash. Your team's Civicsmith hashed the whole document as it arrived and recorded that receipt, which is what this attestation rests on.") };
    } else {
      /* DEC-49 REGION is-attest-parts */
      if (holdsAnswer && holdsAnswer.registered === true)
        return { ok: false, reason: "CAPTURE_HELD_IN_PARTS", code: "CAPTURE_HELD_IN_PARTS",
          check: ATTEST_CHECKS.CAPTURE_HELD_IN_PARTS.check, translation: ATTEST_CHECKS.CAPTURE_HELD_IN_PARTS.translation,
          sha256: sha,
          detail: localize("attestation.index.register_names_bytes", "the record's register names these bytes, but no object is stored under this hash and your team's Civicsmith holds no receipt of having acquired them, which is the shape of a document kept only in parts. A register row is written from what the promoting caller named, so a timestamp is not rested on it alone. Nothing here says the bytes are missing.") };
      /* END DEC-49 REGION is-attest-parts */
      return { ok: false, reason: "NO_SUCH_CAPTURE",
               detail: holdsAnswer
                 ? localize("attestation.index.no_such_capture", "no object is stored under that hash, the register holds no row for it under a record that exists, and your team's Civicsmith holds no receipt of having acquired it")
                 : localize("attestation.index.no_such_capture_unasked", "no object is stored under that hash, and the store could not be asked whether its register or an acquisition receipt names it, so this is not a finding that the record lacks the bytes") };
    }
  }

  const stamp = () => secondOf(now());
  const attempts = [];
  let token = null, tokenSha = null, service = null;
  for (const endpoint of TSA_ENDPOINTS) {
    const attempted = stamp();
    try {
      const { der } = timestampRequest(sha);
      const res = await fetchFn(endpoint, {
        method: "POST", body: der,
        headers: { "content-type": TSA_CONTENT_TYPE, accept: TSA_ACCEPT },
      });
      if (!res.ok) {
        attempts.push({ service: endpoint, attempted, ok: false, note: `http ${res.status}` });
        continue;
      }
      const parsed = parseTimestampResponse(new Uint8Array(await res.arrayBuffer()), sha);
      if (!parsed.ok) {
        attempts.push({ service: endpoint, attempted, ok: false, note: parsed.reason });
        continue;
      }
      tokenSha = hexBytes(await crypto.subtle.digest("SHA-256", parsed.token));
      await put(tokenSha, parsed.token);
      token = parsed.token; service = endpoint;
      attempts.push({ service: endpoint, attempted, ok: true, kind: "rfc3161",
                      token_sha256: tokenSha, token_bytes: parsed.token.length });
      break;
    } catch (e) {
      attempts.push({ service: endpoint, attempted, ok: false, note: String(e && e.message || e).slice(0, 120) });
    }
  }

  /* The opt-in second path. Off unless the caller asks, because asking a
     public archive to fetch a URL publishes the fact of interest, and that
     is a tactical judgement rather than a default. */
  let archive = null;
  if (body.archive === true) {
    const attempted = stamp();
    const locator = typeof body.locator === "string" ? body.locator : "";
    if (!isPublicHttpsLocator(locator)) {
      attempts.push({ service: ARCHIVE_SERVICE, attempted, ok: false,
                      note: word("attestation.note.public_https_locator") });
    } else {
      try {
        const res = await fetchFn(ARCHIVE_SAVE_BASE + locator, { redirect: "follow" });
        const archived = archiveLocatorFrom(res, locator);
        if (res.ok && archived) {
          archive = { service: ARCHIVE_SERVICE, locator: archived };
          attempts.push({ service: ARCHIVE_SERVICE, attempted, ok: true,
                          kind: "co-archive", archived_locator: archived });
        } else {
          attempts.push({ service: ARCHIVE_SERVICE, attempted, ok: false,
                          note: res.ok ? word("attestation.note.archived_returned_locator") : `http ${res.status}` });
        }
      } catch (e) {
        attempts.push({ service: ARCHIVE_SERVICE, attempted, ok: false,
                        note: String(e && e.message || e).slice(0, 120) });
      }
    }
  }

  return {
    ok: !!token,
    attempts,
    ...(archive ? { archive } : {}),
    ...(token ? {
      attestation: {
        file: `snapshots/timestamp-${tokenSha.slice(0, 12)}.tsr`,
        kind: "rfc3161", service, sha256: tokenSha, bytes: token.length,
        over: sha,
      },
      note: word("attestation.note.trusted_timestamp_capture"),
      ...(held ? { held } : {}),
    } : {
      reason: "NO_ATTESTATION",
      note: word("attestation.note.attempt_recorded_register"),
    }),
  };
}

/** The HTTP status `op=attest` answers each outcome with (the control plane's envelope keeps it). */
export function attestStatus(a) {
  if (a && a.ok) return 200;
  return { BAD_SHA: 400, CAPTURE_HELD_IN_PARTS: 409, NO_SUCH_CAPTURE: 404 }[a && a.reason] ?? 502;
}

/* ======================================================================= *
 * R4, R5: THE INSTANCE KEY'S STATEMENTS. A receipt (R4) is `bio-receipt/1`; a later module's statement (R5) is
 * any other kind, so no statement signed for a later module can be read as a receipt.
 * ======================================================================= */

/** The kind of R4's receipt statement, and the form of every statement kind (R5). */
export const RECEIPT_KIND = "bio-receipt/1";
export const STATEMENT_KIND = /^[a-z][a-z0-9-]*\/[0-9]+$/;

/** R5 — exactly `${kind}\nsha256: ${sha}\n`. Throws when `kind` is the receipt's or not of `STATEMENT_KIND`'s form. */
export function instanceStatement(kind, sha) {
  if (typeof kind !== "string" || !STATEMENT_KIND.test(kind) || kind === RECEIPT_KIND)
    throw new Error(`instanceStatement: kind ${JSON.stringify(kind)} is ${kind === RECEIPT_KIND ? "the receipt's own"
      : "not of the form <name>/<version>"}; a statement for a later module is never a receipt`);
  return `${kind}\nsha256: ${sha}\n`;
}

/** R4 — the exact statement a receipt signs, UTF-8. */
export function receiptStatement({ instance, retrieved, retrievalLocator, captureSha }) {
  return `${RECEIPT_KIND}\ninstance: ${instance}\nfetched: ${retrieved}\nlocator: ${retrievalLocator}\nsha256: ${captureSha}\n`;
}

const noKey = () => actRefusal("RECEIPT_NO_KEY",
  localize("attestation.index.no_key_detail", "your team's Civicsmith holds no receipt-signing key it can read, so nothing is signed. Whoever hosts your team's Civicsmith sets one as a secret; nothing is claimed signed until then"));

/* ======================================================================= *
 * THE MODULE
 * ======================================================================= */

export class Attestation {
  #sql; #record; #provenance; #now; #instanceName; #signingKey;

  constructor({ storage, record, provenance, now, instanceName, signingKey } = {}) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#provenance = provenance;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
    this.#instanceName = typeof instanceName === "string" && instanceName ? instanceName : "unnamed";
    this.#signingKey = typeof signingKey === "string" && signingKey.trim() ? signingKey.trim() : null;
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }

  /** This module's tables (R10), created or brought up to shape. Called by the host at every boot; idempotent. */
  migrate() {
    migrateAttestation(this.#sql);
    return { ok: true };
  }

  /** R7 · K171 (13), K176 — every attestation the record holds for a capture, for `filings`' exhibits (its R9): read
   *  from the document entries of the capture's home (provenance R4) that name it, in the order recorded, each naming
   *  the bundle and the file it is recorded in. Two eras of the same facts are read alike: the daemon's `timestamp
   *  {authority, token_file}` and bare `co_archive` locator (State Rules v1.5 §4.1), and `op=attest`'s answer as the
   *  plane records it, `attestations: [{kind: "rfc3161", service, file, sha256}]` and `co_archive {service, locator}`.
   *  `at` is the instant of the entry's matching attempt, when the entry recorded one. It asks no authority and
   *  verifies no token's signature, and says so. An empty list is the earned "none recorded" only when the home's
   *  register was read; with no home (a capture registered only by its parts has none under the whole's digest) or an
   *  unreadable register the answer is `undetermined`, with why (provenance R37).
   *
   *  N688 · K1852 (1): a file cut out of a captured archive carries the archive's co-attestation unchanged. When an
   *  entry naming the capture states `capture.method: "unpacked"` with a `container` block (provenance R42), the same
   *  read is applied to `container.archive_sha256`, and to that archive's own archive in turn, through at most
   *  `ARCHIVE_DEPTH_MAX` archives (ooxml R30). Each of an archive's attestations is answered as its entry states it,
   *  with `inherited: {from, through}`: `from` the archive whose entry records it, `through` the entry indexes from
   *  that archive down to this capture, outermost first (the shape of provenance R59's `archive.through`). The
   *  capture's own come first and carry no `inherited`. A chain past the bound, an archive whose register cannot be
   *  read, or a container block that names no archive, is stated in `undetermined` beside what was read. */
  attestationsOf(captureSha) {
    const s = bareSha(captureSha);
    if (!s || !/^[0-9a-f]{64}$/.test(s))
      return { ok: false, reason: "BAD_SHA", detail: localize("attestation.index.takes_sha_of_capture", "attestationsOf takes the sha256 of a capture: 64 hex characters") };
    const own = this.#recordedFor(s);
    const out = [...own.attestations];
    const why = own.why ? [own.why] : [];
    let unpacked = false;
    /* Each archive this capture (or an archive above it) was cut out of, nearest first, read as the capture's own
       record is read. `through` is the indexes from the archive just read down to the capture; `depth` the number of
       archives read on this chain so far. */
    const climb = (entries, through, depth) => {
      for (const d of entries) {
        if (d.capture.method !== "unpacked") continue;
        unpacked = true;
        const c = isObj(d.container) ? d.container : null;
        const archive = c ? bareSha(c.archive_sha256) : null;
        const index = c ? c.index : null;
        const named = through.length ? word("attestation.archive_above_through", { through: String(through.join(", ")) }) : "this capture";
        if (!archive || !/^[0-9a-f]{64}$/.test(archive) || !Number.isInteger(index) || index < 0) {
          why.push(word("attestation.record_states_cut", { named: String(named) }));
          continue;
        }
        const path = [index, ...through];
        if (depth >= ARCHIVE_DEPTH_MAX) {
          why.push(localize("attestation.index.nest_deeper", "the archives it was cut out of nest deeper than ARCHIVE_DEPTH_MAX ({max}): the archive {archive} (through entries {path}) was not read, so its attestations are not here", { max: String(ARCHIVE_DEPTH_MAX), archive, path: path.join(", ") }));
          continue;
        }
        const above = this.#recordedFor(archive);
        for (const a of above.attestations) out.push({ ...a, inherited: { from: archive, through: path } });
        if (above.why) why.push(word("attestation.archive_cut_through", { archive: String(archive), path: String(path.join(", ")), why: String(above.why) }));
        climb(above.entries, path, depth + 1);
      }
    };
    climb(own.entries, [], 0);
    const note = word("attestation.note.read_record_holds", { value: unpacked ? word("attestation.capture_cut_captured") : "" });
    return { ok: true, sha256: s, registered: own.registered, attestations: out,
             ...(why.length ? { undetermined: why.join("; ") } : {}), note };
  }

  /* One capture's record, as R7 reads it: whether a register row names it under an existing bundle, the document
     entries of its home's register that name it (each with a `capture` block), the attestations those entries state,
     each naming its bundle and path, and why the answer is undetermined, when it is. Reads only; never throws. */
  #recordedFor(s) {
    const home = this.#provenance.homeOf(s);
    const none = (why) => ({ registered: !!home, entries: [], attestations: [], why });
    if (!home)
      return none(word("attestation.register_row_names"));
    const PATH = "data/provenance.json";
    const f = this.#record.readFile(home.bundleId, PATH);
    if (!f) return none(word("attestation.home_carries", { bundle_id: String(home.bundleId), path: String(PATH) }));
    if (typeof f.text !== "string") return none(word("attestation.home_held_blob", { path: String(PATH) }));
    const reg = safeJson(f.text);
    if (!isObj(reg) || !Array.isArray(reg.documents)) return none(word("attestation.home_cannot_read", { path: String(PATH) }));
    const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const entries = [], out = [];
    for (const d of reg.documents) {
      if (!isObj(d) || !isObj(d.capture) || bareSha(d.capture.sha256) !== s) continue;
      entries.push(d);
      const tries = Array.isArray(d.attestation_attempts) ? d.attestation_attempts.filter(isObj) : [];
      const when = (match) => { const a = tries.find(match); return a && str(a.attempted) ? { at: a.attempted } : {}; };
      const where = { bundle: home.bundleId, path: PATH };
      if (isObj(d.timestamp)) {
        const service = str(d.timestamp.service) || str(d.timestamp.authority);
        out.push({ kind: "rfc3161", ...(service ? { service } : {}),
                   ...(str(d.timestamp.token_file) ? { file: str(d.timestamp.token_file) } : {}),
                   ...(service ? when((a) => a.ok === true && a.service === service && a.kind !== "co-archive") : {}), ...where });
      }
      for (const t of Array.isArray(d.attestations) ? d.attestations : []) {
        if (!isObj(t) || t.kind !== "rfc3161") continue;
        const tokenSha = bareSha(t.sha256);
        out.push({ kind: "rfc3161", ...(str(t.service) ? { service: str(t.service) } : {}),
                   ...(str(t.file) ? { file: str(t.file) } : {}), ...(tokenSha ? { token_sha: tokenSha } : {}),
                   ...when((a) => a.ok === true && tokenSha && bareSha(a.token_sha256) === tokenSha), ...where });
      }
      const co = typeof d.co_archive === "string" ? { locator: str(d.co_archive) }
               : isObj(d.co_archive) ? { service: str(d.co_archive.service), locator: str(d.co_archive.locator) } : null;
      if (co && co.locator)
        out.push({ kind: "co_archive", ...(co.service ? { service: co.service } : {}), locator: co.locator,
                   ...when((a) => a.ok === true && a.kind === "co-archive" && a.archived_locator === co.locator), ...where });
    }
    return { registered: true, entries, attestations: out, why: null };
  }

  /* ===================================================================== *
   * R4 · K59: THE INSTANCE SIGNS ITS OWN RECEIPT FOR AN ARCHIVE-SOURCED CAPTURE (ARCHIVE-FALLBACK §Shape on the
   * capture): that on this date it fetched these bytes from this retrieval locator and they hashed to this value.
   * One key per instance, held as a secret and replaceable by the operator; every public key it signed with is kept,
   * so a receipt signed before a replacement stays verifiable against the key it was signed with.
   * ===================================================================== */

  /** The exact statement a receipt signs, UTF-8 (`receiptStatement`, above). */
  static receiptStatement(fields) { return receiptStatement(fields); }

  /* The bound key, or null when none is bound or the one bound cannot be read (not base64, not an Ed25519 PKCS#8
     key): an unreadable key is no key (R6), so every door that asks answers `RECEIPT_NO_KEY` rather than throwing. */
  async #key() {
    if (!this.#signingKey) return null;
    try {
      const priv = await crypto.subtle.importKey("pkcs8", unb64(this.#signingKey), { name: "Ed25519" }, true, ["sign"]);
      const jwk = await crypto.subtle.exportKey("jwk", priv);
      const pub = Uint8Array.from(atob(jwk.x.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - jwk.x.length % 4) % 4)), (c) => c.charCodeAt(0));
      return { priv, pub: b64(pub), keyId: hexOf(pub) };
    } catch {
      return null;
    }
  }

  /* The instance key's one signing site (R4, R5): signs `statement`, UTF-8, and records the key in `receipt_keys`
     the first time it signs anything; null when no key is bound. */
  async #signWith(statement) {
    const key = await this.#key();
    if (!key) return null;
    const signature = b64(await crypto.subtle.sign({ name: "Ed25519" }, key.priv, te.encode(statement)));
    const at = this.#now();
    this.#sql.exec(`INSERT OR IGNORE INTO receipt_keys (key_id, public_key, first_used) VALUES (?, ?, ?)`,
                   key.keyId, key.pub, at);
    return { signature, key_id: key.keyId, public_key: key.pub, at };
  }

  /** R4 — signs and keeps the receipt for an archive-sourced capture. Answers `{ok, statement, signature, key_id,
   *  public_key}`, or `RECEIPT_NO_KEY` when no key is bound (stated, never a silent skip), or `RECEIPT_MALFORMED`. */
  async signReceipt({ captureSha, retrievalLocator, retrieved } = {}) {
    const s = bareSha(captureSha);
    if (!s || !/^[0-9a-f]{64}$/.test(s) || typeof retrievalLocator !== "string" || !retrievalLocator
        || typeof retrieved !== "string" || !retrieved)
      return actRefusal("RECEIPT_MALFORMED",
        localize("attestation.index.receipt_names", "a receipt names the capture's sha256, the retrieval locator and the instant it was fetched"));
    const statement = receiptStatement({ instance: this.#instanceName, retrieved, retrievalLocator, captureSha: s });
    const signed = await this.#signWith(statement);
    if (!signed) return noKey();
    this.#sql.exec(`INSERT OR REPLACE INTO signed_receipts
                      (capture_sha, retrieval_locator, retrieved, statement, signature, key_id, signed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`, s, retrievalLocator, retrieved, statement, signed.signature,
                   signed.key_id, signed.at);
    return { ok: true, statement, signature: signed.signature, key_id: signed.key_id, public_key: signed.public_key };
  }

  /** R5 · DEC-111: the statement the instance key signs for a later module (`instanceStatement`, above). */
  instanceStatement(kind, sha) { return instanceStatement(kind, sha); }

  /** R5 — signs a statement `instanceStatement` makes with the instance key of R4, recording the key in
   *  `receipt_keys`: `{ok, signature, key_id, public_key}`, or `RECEIPT_NO_KEY` when no key is bound. Any other text
   *  throws, as `instanceStatement` does, before the key is asked: this door never signs a receipt (R4's statement). */
  async instanceSign(statement) {
    const m = typeof statement === "string" ? /^([^\n]*)\nsha256: ([^\n]*)\n$/.exec(statement) : null;
    if (!m || instanceStatement(m[1], m[2]) !== statement)
      throw new Error("instanceSign: the statement is not one instanceStatement makes");
    const signed = await this.#signWith(statement);
    if (!signed) return noKey();
    return { ok: true, signature: signed.signature, key_id: signed.key_id, public_key: signed.public_key };
  }

  /** R6 · N504 — whether an instance key is bound, so that `instanceSign` would sign: `true` or `false`, a key that
   *  cannot be read answering `false`. It signs nothing and writes nothing (`receipt_keys` and every `first_used` stay
   *  as they were), so a later module can ask before its first real statement. Asynchronous, as reading the key is;
   *  never rejects. */
  async instanceKeyBound() {
    try { return !!(await this.#key()); } catch { return false; }
  }

  /** R5 — every key that has signed anything, `[{key_id, public_key, first_used}]` in the order first used; the
   *  private part is never stored, so never answered. */
  instanceKeys() {
    return this.#rows(`SELECT key_id, public_key, first_used FROM receipt_keys ORDER BY first_used, key_id`)
      .map((r) => ({ key_id: r.key_id, public_key: r.public_key, first_used: r.first_used }));
  }

  /** R4 — the receipts signed for a capture, each verified against the public key it was signed with (kept). */
  async signedReceipts(captureSha) {
    const s = bareSha(captureSha) || "";
    const out = [];
    for (const r of this.#rows(`SELECT sr.*, k.public_key FROM signed_receipts sr
                                  LEFT JOIN receipt_keys k ON k.key_id = sr.key_id
                                 WHERE sr.capture_sha = ? ORDER BY sr.retrieved`, s)) {
      let verified = false;
      if (r.public_key) {
        try {
          const pub = await crypto.subtle.importKey("raw", unb64(r.public_key), { name: "Ed25519" }, false, ["verify"]);
          verified = await crypto.subtle.verify({ name: "Ed25519" }, pub, unb64(r.signature), te.encode(r.statement));
        } catch { verified = false; }
      }
      out.push({ capture_sha: r.capture_sha, retrieval_locator: r.retrieval_locator, retrieved: r.retrieved,
                 statement: r.statement, signature: r.signature, key_id: r.key_id, public_key: r.public_key ?? null,
                 verified });
    }
    return out;
  }
}

const instances = new WeakMap();

/** The one attestation instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on the
 *  first call only. At creation it creates its tables and declares them to purge (record-core R21, R46; R10):
 *  `signed_receipts` keyed to no bundle, `receipt_keys` exempt. Provenance is reached first, so the module earlier in
 *  the order declares its own tables first. The declaration's answer is kept as `purgeDeclared`. */
export function attestationOf(host, deps) {
  let a = instances.get(host);
  if (!a) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const provenance = d.provenance || provenanceOf(host, { record });
    a = new Attestation({ ...d, storage: d.storage || host.storage, record, provenance });
    instances.set(host, a);
    a.migrate();
    a.purgeDeclared = record.declarePurge(ATTESTATION_MODULE, ATTESTATION_TABLES.map((t) => ({ ...t, keys: [...t.keys] })),
                                          { exempt: [...ATTESTATION_EXEMPT] });
  }
  return a;
}

export { attestOp } from "./ops.mjs";
