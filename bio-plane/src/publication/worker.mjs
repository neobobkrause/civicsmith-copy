/* public-read's Worker half (requirements: `build/requirements/public-read.md` R3, R5, R6, R9, R28; K3): the public read
 * path's control-plane side (`op=publishedcase`, `op=publishedbytes`), its governed refusals (C-68.5, C-98, rows held
 * in `../public-read/checks.mjs`, R17), and the case container's assembly the moment a case edition completes. Moved
 * from `index.mjs` with their comments; it is this module's by `paths` and stays at this path (K697, K702). The store
 * side is `../public-read/index.mjs`.
 *
 * THE PLANE'S HELPERS ARE BOUND, NOT IMPORTED: the control plane (`control-plane`, later in the order) owns `json()`
 * (its DEC-49 decoration), the Durable Object envelope reader (`doAnswer`), the silence refusal (`storeSilent`), the
 * required-argument refusal and the published store's namespace. It binds them once at load (`bindPublishedPlane`),
 * so this file reads every answer the way the rest of the plane does and restates none of it.
 *
 * R9 (was `publication` R48; N339, N349; K421, K444): every relay here answers the store's own refusal
 * (`control-plane` R23: `ok: false` below 500, which `doAnswer` answers `refused`) with the store's status, code and
 * sentence, through the plane's `storeRefusal` when it binds one; only a reply that is no answer is
 * `STORE_DID_NOT_ANSWER`, carrying the correlation id `doAnswer` read from the store's internal error when it gave one
 * (`control-plane` R25). The post-commit report in `assembleCaseContainer` states an exchange inside an act that has
 * committed, and is no relay. */

import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { normalizeType } from "../record-grammar/types.mjs";
import { sectionText } from "../record-grammar/document.mjs";
import { NS_RATIFY, ratifyStatement, caseRatifyStatement } from "../sshsig.mjs";
import { serialiseContainer, containerEntries } from "../container.mjs";
import { buildCaseFile, isCaseFileManifest, caseFilePartLayout, caseFileParts, sha256Hex, inWindow, CASEFILE_CODES, CASEFILE_BLIND_PUT_MAX } from "../public-read/casefile.mjs";
import { inbandQuartet } from "../inband.mjs";
import { caseDocumentStatesMemberBlocks } from "../case-grammar/index.mjs";
import { legReaderOf } from "../public-read/legs.mjs";
import { rowOf } from "../public-read/checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

let PLANE = null;
const PLANE_KEYS = ["json", "doAnswer", "storeSilent", "requiredArgument", "STORE_SILENT_REASON", "STORE_SILENT_DETAIL",
                    "PUBLISHED_STORE"];
/* R9: bound when the plane hands it; absent, a refusal is answered as it answers one (below). */
const PLANE_OPTIONAL = ["storeRefusal"];

/** Binds the control plane's helpers, once, at the control plane's load. A second binding replaces the first (a test
 *  binds its own); one missing a helper throws, loudly, since every public read depends on them. */
export function bindPublishedPlane(helpers) {
  const missing = PLANE_KEYS.filter((k) => !helpers || helpers[k] === undefined);
  if (missing.length) throw new Error(`bindPublishedPlane: missing ${missing.join(", ")}`);
  PLANE = Object.freeze(Object.fromEntries([...PLANE_KEYS, ...PLANE_OPTIONAL]
    .filter((k) => helpers[k] !== undefined).map((k) => [k, helpers[k]])));
  return PLANE;
}
function plane() {
  if (!PLANE) throw new Error("publication/worker.mjs: the control plane has not bound its helpers (bindPublishedPlane)");
  return PLANE;
}

/* R9: the answer to a store reply that was not an answer. The store's own refusal is relayed with its status, code
   and sentence, through the plane's `storeRefusal` when bound, else as the same answer composed here
   (`json(reply.body, reply.status)`, which is what `storeRefusal` answers); anything else is the silence, carrying the
   store's correlation id when `doAnswer` read one. */
function relayUnanswered(out, op) {
  const P = plane();
  if (out && out.refused && out.reply)
    return typeof P.storeRefusal === "function" ? P.storeRefusal(out) : P.json(out.reply.body, out.reply.status);
  return P.storeSilent(op, out ? out.correlation : undefined);
}

/* R9: a relay inside the per-finding renderer, thrown so the whole read answers it (a case rendered from a registry
   never consulted asserts what nobody checked). Carries the unanswered reply, refusal or silence. */
class Unanswered extends Error {
  constructor(op, out) { super(word("publication.super.store_did_answer", { op: String(op) })); this.op = op; this.out = out; }
}

/* R39 (C2): the words of one section of a finding's bytes, its heading removed (`sectionText` keeps the heading, by
   record-grammar R36); null when the section is absent or holds nothing but its heading. */
function sectionWords(text, heading) {
  const s = sectionText(text, heading);
  const words = s === null ? "" : s.slice(heading.length).trim();
  return words || null;
}
const wordsOf = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/* THE PUBLISHED-STORE COMPLAINT (C-68.5, D-549). A copy installed with no store
 * for its published documents cannot hand over a published document's bytes, at
 * `publishedbytes` (a refusal) or at `publishedcase` (a finding's body stated
 * `unavailable`). BOTH OPS ARE PUBLIC, so the reader of this code is most likely a
 * member of the public holding no credential at all, and until D-549 the code
 * reached them bare from two sites with no sentence behind it.
 *
 * ONE CONDITION, AND IT IS DECIDED HERE: no published store is bound. Returns
 * null when one is, so no call site restates the test and none can mint this
 * code for a different fact — `OBJECT_MISSING` (a store bound and no object at
 * that hash) is the other condition and stays its own code at its own site.
 * Minted here rather than at two sites for the reason `storageAbsent` is: a
 * DEC-49 row holds one `where`. */
export function publishedStoreAbsent(env) {
  /* DEC-49 REGION is-published-store-absent
   * THE SPAN C-68.5 names: its one condition and its one mint, the code a STRING LITERAL at its site. */
  if (typeof env.PUBLISHED?.get === "function") return null;
  const row = rowOf("NO_PUBLISHED_STORE");
  return { ok: false, reason: "NO_PUBLISHED_STORE", code: row.code, check: row.check, translation: row.translation };
  /* END DEC-49 REGION is-published-store-absent */
}

/* D-561 (C-98.1): NO PUBLISHED PART ANSWERS TO THAT HASH, at `publishedbytes`. It answered `NOT_FOUND` until
 * D-561, a code the plane also mints for three other conditions, so no row could be written for it without
 * putting this sentence on theirs. `detail` is the site's own sentence, BYTE-IDENTICAL to what it said before:
 * a hash that was never ratified and a hash that never existed stay ONE answer, and the translation keeps that.
 * Returns the refusal OBJECT, as `publishedObjectMissing` does, and its one site wraps it (404): the region then holds
 * the refusal itself, so the verdict reader judges it rather than a `json(` call it cannot see into (N242, N297). */
export function noPublishedPart(sha256) {
  /* DEC-49 REGION is-no-published-part */
  return { ok: false, reason: "NO_PUBLISHED_PART", ...rowOf("NO_PUBLISHED_PART"), sha256,
           detail: localize("public-read.worker.no_published_part_answers_to", "no published part answers to that hash. A hash that was never ratified and a hash that never existed are the same answer here, deliberately.") };
  /* END DEC-49 REGION is-no-published-part */
}

/* D-561 (C-98.2): A PUBLISHED HASH WHOSE BYTES THIS COPY'S STORE DOES NOT HOLD — the store bound and the object
 * absent. ONE condition met at both public ops: `publishedcase` states one finding's body unavailable with it
 * (D-549 left it bare there), and `publishedbytes` refuses with it where it used to answer `NOT_FOUND` with the
 * sentence "no published part answers to that hash" — FALSE of a hash the line above had just verified published.
 * Returns the refusal OBJECT so each site chooses its envelope; `NO_PUBLISHED_STORE` is the other condition and
 * is never this one. */
export function publishedObjectMissing() {
  /* DEC-49 REGION is-published-object-missing
   * THE SPAN C-98.2 names: its one mint, the code a STRING LITERAL at its site, the row's fields beside it. */
  return { ok: false, reason: "OBJECT_MISSING", ...rowOf("OBJECT_MISSING"),
           detail: localize("public-read.worker.that_hash_is_published_and", "that hash is published, and this team's Civicsmith holds no bytes for it in its published store, so they cannot be handed over. The hash is genuine.") };
  /* END DEC-49 REGION is-published-object-missing */
}

/* R28 (K1480, K1493; C-98.11): BYTES A COURT ORDER WITHHOLDS, at `publishedbytes`. The hash is published and its bytes
 * are held (nothing is deleted, `publication` R24); a court order this group complied with keeps them from being served,
 * and the answer says so, naming each order and the docket entry that names it, with HTTP 451 (unavailable for legal
 * reasons). `withheld` maps each withheld hash asked to its orders (`PublicRead.withheldOf`). Returns the refusal OBJECT,
 * as `noPublishedPart` does, and its one site wraps it. */
export function withheldByCourtOrder(sha256, withheld) {
  /* DEC-49 REGION is-withheld-by-court-order */
  return { ok: false, reason: "WITHHELD_BY_COURT_ORDER", ...rowOf("WITHHELD_BY_COURT_ORDER"), sha256,
           withheld,
           detail: localize("public-read.worker.a_court_order_this_team", "a court order this team complied with keeps these contents from being served here. The order and the record entry that names it are public, at the docket address each order gives, and nothing was deleted: the fingerprint still verifies.") };
  /* END DEC-49 REGION is-withheld-by-court-order */
}

/* R28: of `shas`, the ones a court order in force withholds, asked of the store (`op=withheld`): `{answered: true,
   withheld}` with `withheld` an object of hash to orders, empty for none; or the unanswered reply, relayed by the caller. */
async function withheldOf(stub, shas, zip = null) {
  const P = plane();
  const out = await P.doAnswer(stub.fetch(`http://do/withheld?sha256=${shas.map(encodeURIComponent).join(",")}${zip ? `&zip=${encodeURIComponent(zip)}` : ""}`));
  if (!out.answered) return out;
  const w = out.result && out.result.withheld && typeof out.result.withheld === "object" ? out.result.withheld : {};
  return { answered: true, withheld: w };
}

/* The container manifest's own sentences (its `verify` and `layout.note`, and the two in-band `over` descriptions) are
   bytes inside a hash-pinned container, so they stay code, never words (K1333): changing one changes the container's hash. */
const LAYOUT_NOTE = "the zip carries every part at <case>/<finding>/<path> with this manifest at the root. Check each part's sha256 against this list, then check this manifest's own sha256 and each finding's signature over its own bundle_sha. Renderings (REC-22) join parts[] as kind: rendering.";
const VERIFY_TEXT = "tamper-EVIDENT, not tamper-proof: nothing here prevents a modified copy, and everything here makes one detectable by anyone holding it, without the cooperation of this team's Civicsmith. Each finding is signed on its own bytes; there is no case-level strength, because composing several findings' strengths into one letter is a claim the evidence does not support. EACH FINDING'S `edition` IS ITS OWN, on its own version chain, and is NOT this case's edition: since the artifact flip the two are separate numbers, so a member of edition 2 of this case may be at its own edition 1. `version_sha` is the version THIS CASE COMMITTED TO and must equal that finding's `bundle_sha` here; if they differ, this container was assembled over a member the case did not pin and you should not rely on it. `role` is the publisher's authored designation: only `load_bearing` members were held to the `bar` above, and a `supporting` member is part of the published work without being presented as carrying it. Where `bar` is null NO STANDARD WAS RECORDED, which is not a standard of zero — the case claims no cleared bar and says so. `attestor` is who SIGNED, and the signature proves it. `delivered_by` is who DELIVERED that signature to this team's Civicsmith — the authenticated session that performed the act, a member or its founder — and it is this team's Civicsmith's record, not covered by any signature. `undetermined` there means the delivery was not recorded; it never means the signer delivered it.";
const VERIFY_MEMBER_PAIR = " Each finding's `strength` and its own `edition` are stated in the CASE DOCUMENT carried above (`case_strength`, `case_roles`), under the case document's signature: publishing wrote nothing on any finding, so its own signature covers the finding as its project concluded it, and the pair is this case's reading of those bytes.";
const OVER_CONTAINER = "this case edition's container manifest (MANIFEST.json), exactly as served at op=publishedbytes&sha256=<this hash>";
const OVER_CASE_FILE = "this case edition's case file manifest (MANIFEST.json, at the root of every part), exactly as served at op=publishedbytes&sha256=<this hash>";

/* G54 (K4426, K4565, K4566, K4571; R6): THE CASE FILE'S ATTEMPT IS NEVER SILENT. The closed set of codes a failed attempt is
   stated by (the one place that maps a step and a cause to a code, `casefileCodeOf`), the files one edition may hold in
   memory at once (an edition over it is `TOO_LARGE`, stated and not attempted), and the cut an error message is logged and
   stored under. `publishedcase` answers the state and the code only (`../public-read/index.mjs`). */
export { CASEFILE_CODES };
export const CASEFILE_FILES_MAX = 4000;
const ERROR_CUT = 160;
const cut = (v) => String(v ?? "").slice(0, ERROR_CUT);
const errorText = (e) => (e == null ? null : cut(`${(e && e.name) || "Error"}: ${(e && e.message) || e}`));
/* fix round 10 (cause 27a; K5084): the case files whose record wrote `built` with their manifest, so the assembly writes it no second time */
const CASE_FILE_BUILT = new WeakSet();
/* A step and what went wrong at it, to one code of the closed set. */
function casefileCodeOf(step, out, err) {
  if (err) return step === "facts" || step === "record" ? "STORE_SILENT" : step === "bucket_put" || step === "manifest_put" || step === "materials" ? "BUCKET_FAILED" : "UNKNOWN";
  if (out && CASEFILE_CODES.includes(out.code)) return out.code;
  if (out && out.reason === plane().STORE_SILENT_REASON) return "STORE_SILENT";
  if (out && out.reason === "CASE_FILE_NOT_ASSEMBLED") return out.finding != null ? "FINDING_MISSING" : "UNKNOWN";
  if (out && (out.reason === "MANIFEST_NOT_RECORDED" || out.reason === "MANIFEST_EXISTS" || step === "record")) return "NOT_RECORDED";
  return "UNKNOWN";
}
/* The ledger's one writer is `publication`'s (`recordCaseFileAttempt`, reached by the store-internal hop `recordcasefile`);
   a store that does not answer it leaves the edition owed by its own rule, so this never throws. */
async function ledger(stub, body) {
  try {
    const out = await plane().doAnswer(stub.fetch(new Request("http://do/recordcasefile", { method: "POST", body: JSON.stringify(body) })));
    return out.answered ? out.result : null;
  } catch { return null; }
}
/* One structured line per attempt (event `casefile_attempt`): no secret and no text of a document, the error cut. */
function attemptLog(ok, fields) {
  try { (ok ? console.log : console.error)(JSON.stringify({ event: "casefile_attempt", ok, ...fields })); } catch { /* a log that cannot be written changes nothing */ }
}

/** G54 (R6): a failure the caller met BEFORE the assembly was reached (ratification's copy of the findings' or the materials'
 *  bytes threw), recorded as the assembly records its own: `failed` at `step` (default `copy`) with a code of the closed
 *  set (default `BUCKET_FAILED` for a copy, `UNKNOWN` otherwise; any other value is `UNKNOWN`), one `casefile_attempt` error
 *  line, and the edition owed. `absent` is the caller's confirmation that a missing material is gone from the evidence store
 *  (`publication` stops an edition only then). Answers `{ok, state, code, step}`; never throws.
 *  Signature: `recordCaseFileFailure({ stub, cs, via, step = "copy", error = null, code = null, absent = false })`. */
export async function recordCaseFileFailure({ stub, cs, via = null, step = "copy", error = null, code = null, absent = false } = {}) {
  try {
    const at = step === "copy" || step === "facts" || step === "materials" || step === "build" || step === "bucket_put" || step === "quartet"
      || step === "record" || step === "manifest_put" ? step : "copy";
    const c = CASEFILE_CODES.includes(code) ? code : at === "copy" ? "BUCKET_FAILED" : "UNKNOWN";
    const out = await ledger(stub, { caseId: cs.caseId, edition: cs.edition, state: "failed", absent: absent === true,
                                     why: { code: c, step: at, ...(error != null ? { error: errorText(error) } : {}) } });
    attemptLog(false, { case: cs.caseId, edition: cs.edition, via, step: at, code: c, error: errorText(error), recorded: !!(out && out.ok) });
    return { ok: !!(out && out.ok), state: out && out.state ? out.state : null, code: c, step: at };
  } catch { return { ok: false, state: null, code: "UNKNOWN", step: "copy" }; }
}

/** R6 (G54): the case file's assembly, recorded, logged and never thrown. `prior` is what the caller's own copy met,
 *  `{materials_missing, copy_error, absent}`. It records `building` first, then catches every throw and every statement
 *  at its step (`facts`, `materials`, `build`, `bucket_put`, `quartet`, `record`, `manifest_put`; `copy` is the caller's),
 *  records `failed` with a code of `CASEFILE_CODES`, writes one `casefile_attempt` line, and answers the statement. It
 *  records `built` only after the manifest's own bytes are in the bucket, and records no manifest while a material is
 *  missing or the bucket is not bound. Answers what `op=ratify` carries as `container`: the manifest's hash, its parts and
 *  their addresses (plus `case_file: "built"`), or `{ok: false, reason, code, step}`. */
export async function assembleCaseContainer({ env, stub, storeName, cs, via, maxBytes = undefined, prior = null }) {
  let step = "facts";
  const mark = (s) => { step = s; };
  const base = { case: cs && cs.caseId, edition: cs && cs.edition, via };
  try {
    if (prior && prior.copy_error != null) {
      await recordCaseFileFailure({ stub, cs, via, step: "copy", error: prior.copy_error, code: prior.copy_code ?? null, absent: false });
      return { ok: false, reason: "CASE_FILE_NOT_BUILT", code: CASEFILE_CODES.includes(prior.copy_code) ? prior.copy_code : "BUCKET_FAILED", step: "copy" };
    }
    /* G121b: `building` is asked of the store while the assembly reads its facts; every later ledger write waits for it, since a
       `building` after a `failed` or `built` would be the last word. */
    const building = ledger(stub, { caseId: cs.caseId, edition: cs.edition, state: "building" });
    let out = null, err = null;
    try { out = await assembleOnce({ env, stub, storeName, cs, via, maxBytes, mark, prior }); } catch (e) { err = e; }
    await building;
    if (!err && out && out.manifest_sha) {
      /* fix round 10 (cause 27a; K5084): the case file's own record already wrote `built`, in the call that recorded its manifest */
      const done = CASE_FILE_BUILT.has(out) ? { ok: true } : await ledger(stub, { caseId: cs.caseId, edition: cs.edition, state: "built" });
      attemptLog(true, { ...base, step: "manifest_put", code: null, files: out.files ?? null, bytes: out.bytes ?? null, recorded: !!(done && done.ok) });
      return { ...out, case_file: "built" };
    }
    const code = casefileCodeOf(step, out, err);
    const failedStep = out && typeof out.step === "string" ? out.step : step;
    const files = out && Number.isInteger(out.files) ? out.files : null;
    const rec = await ledger(stub, { caseId: cs.caseId, edition: cs.edition, state: "failed", absent: prior && prior.absent === true,
      why: { code, step: failedStep, ...(err ? { error: errorText(err) } : {}), ...(files != null ? { files } : {}) } });
    attemptLog(false, { ...base, step: failedStep, code, error: errorText(err), files, recorded: !!(rec && rec.ok) });
    return out && out.ok === false ? { ...out, code, step: failedStep } : { ok: false, reason: "CASE_FILE_NOT_BUILT", code, step: failedStep };
  } catch (e) {
    attemptLog(false, { ...base, step, code: "UNKNOWN", error: errorText(e), recorded: false });
    return { ok: false, reason: "CASE_FILE_NOT_BUILT", code: "UNKNOWN", step };
  }
}

/* REC-44 / DEC-34: THE CASE CONTAINER, assembled the moment a case edition COMPLETES — every member
   finding ratified at the version the case pinned. D-442 moved it out of the op=ratify block VERBATIM
   so op=caseratify can call it too (see the call sites). `cs` is `#caseEditionState`'s answer. Returns
   what op=ratify always answered as `container`. */
async function assembleOnce({ env, stub, storeName, cs, via, maxBytes = undefined, mark = () => {}, prior = null }) {
  mark("facts");
  /* R6, R23 (DEC-112 (3)): AN EDITION WHOSE SIGNED DOCUMENT IS `/6` IS PACKAGED AS ITS CASE FILE (`case-grammar` R13),
     and a `/7` one, read as `/6` (N538), likewise,
     everything it carries read from the published projection (`casefilefacts`) and the published bucket. An edition
     prepared before T28 (its document is not `/6`, which `publication` R58 now refuses to commit, but an edition committed
     before it may complete after) keeps the container below, unchanged, so nothing already promised changes form. */
  const fOut = await plane().doAnswer(stub.fetch(
    `http://do/casefilefacts?${new URLSearchParams({ caseId: cs.caseId, edition: String(cs.edition) })}`));
  if (!fOut.answered)
    return { ok: false, reason: plane().STORE_SILENT_REASON, op: `${via}/casefilefacts`, detail: plane().STORE_SILENT_DETAIL };
  if (fOut.result && fOut.result.ok) return assembleCaseFile({ env, stub, storeName, cs, via, facts: fOut.result, maxBytes, mark, prior });
        const manifest = {
          /* REC-47 bumps 2 -> 3, and the bump is deliberate rather than
             bookkeeping. The container gains `bias_acknowledgement`, which is a
             DISCLOSURE a reader is entitled to rely on being present: without a
             version move, a /2 container carrying no acknowledgement and a /2
             container that simply predates the field are indistinguishable to a
             stranger holding the zip, and "the record is silent" would read as
             "the group declared nothing". The whole premise of the container is
             that it is readable without our cooperation, so the only place that
             ambiguity could be resolved is the one place the reader cannot
             reach. REC-44 bumped 1 -> 2 for the same class of reason. */
          /* CASE-5 / DEC-72 bumps 3 -> 4, AND THE BUMP IS THE SAME ARGUMENT
             REC-47 MADE, arriving on the fields the artifact flip adds. `/4`
             carries the PIN, the AUTHORED ROLE, each member's OWN edition, whose
             production the case is and the standard it was held to. Without a
             version move a `/3` container carrying no pin and a `/4` container
             whose pin was WITHHELD are indistinguishable to a stranger holding
             the zip, and "the record is silent" would read as "the case froze
             nothing" — which is the one claim this artifact exists to refute.
             The whole premise is that it is readable without our cooperation, so
             the only place that ambiguity could be resolved is the one place the
             reader cannot reach. */
          /* CASE-5b / DEC-72 bumps 4 -> 5, AND THIS BUMP IS LOAD-BEARING IN A WAY
             THE OTHERS WERE NOT. `/4` and every version before it carried the
             case's scope, roster, partition, bias acknowledgement and bar as
             MANIFEST FIELDS — and a stranger could check every one of them,
             because the same facts were inside each member's SIGNED bundle.md.
             That is the property REC-44 bought and it is why the fields could be
             taken on trust here: the manifest was a convenience over material
             the reader could verify.

             CASE-5b removes those facts from member bytes. A `/4`-shaped
             manifest built after this item would carry the same fields with
             NOTHING BEHIND THEM — assertions this instance makes about itself,
             checkable against nothing, which is precisely the ambiguity the
             format comment above says this artifact exists to refute. So `/5`
             carries `case_document`: the bytes, their hash, and the armored
             signature a member made over them, verifiable with ssh-keygen
             against a key the artifact names.

             WITHOUT THE VERSION MOVE a reader could not tell a `/4` container
             whose case facts were member-signed from a `/4` container whose case
             facts were nobody's. That distinction is the entire difference
             between this record and a press release. */
          /* REC-128 bumps 5 -> 6, ON THE ARGUMENT EVERY BUMP ABOVE MADE. `/6`
             carries `delivered_by` beside every `attestor` — on the case document
             and on each finding — naming whose authenticated session CARRIED the
             signature in: a member, or the instance's founder. Without the move a
             `/5` container (which never recorded a deliverer) and a `/6` one whose
             deliverer was not recorded would read alike, and a stranger could not
             tell "nobody said" from "the format had no place to say". EXISTING
             containers are untouched: a manifest is built once, when an edition
             completes, and is served by its own stored hash, so nothing already
             published verifies against anything new. `delivered_by` is THIS
             INSTANCE'S RECORD and not covered by any signature (a member signs
             before anybody delivers), and `verify` below says so in words. */
          format: "bio-case-container/6",
          case: cs.caseId,
          edition: cs.edition,
          group: cs.group ?? null,
          /* THE SIGNED CASE DOCUMENT, WHOLE. The text is carried rather than a
             digest of it for the same reason every member's bundle.md is carried
             rather than named: a stranger must be able to RE-HASH what they hold
             and check the signature over it themselves. A digest alone would let
             them detect a mismatch and never let them read what was signed.

             THE STATEMENT IS PRINTED IN ASCII, which is CASE-5's own correction
             arriving on the new field: `caseRatifyStatement()` returns a
             Uint8Array, and `JSON.stringify` renders one as an object of byte
             indices — so a `/4` container told a stranger to verify over a
             statement printed as numbered integers. Decoded here, at the site,
             rather than by changing what the statement builder returns. */
          case_document: cs.document ? {
            doc_sha: cs.document.doc_sha,
            text: cs.document.text,
            gate_version: cs.document.gate_version,
            ratified_at: cs.document.ratified_at,
            attestor: cs.document.attestor,
            delivered_by: cs.document.delivered_by,
            signature: { namespace: NS_RATIFY,
                         statement: new TextDecoder().decode(
                           caseRatifyStatement(cs.caseId, cs.edition, cs.document.doc_sha)),
                         /* `armored`, the SAME field name every member's
                            signature already uses twelve lines down. A second
                            spelling for one thing in one artifact is how a
                            consumer comes to handle only the half it happened to
                            meet first. */
                         armored: cs.document.sig_armored },
          } : null,
          /* DEC-72 clause 2, INSIDE THE ARTIFACT THAT TRAVELS. Whose production
             this case is, and the standard of evidence it was held to. The
             design doc's own list of what the CASE artifact freezes names the
             bar; before this item it was reachable only by opening a member's
             bundle.md and reading that member's copy, which is one member's
             stamp of a case property. A stranger weighing a case has to be able
             to see what the group required of it and who required it, from the
             bytes in their hand. `bar: null` is the absent-bar posture and never
             a bar of zero, which `verify` below says in words. */
          project: cs.project ?? null,
          bar: cs.bar ?? null,
          /* DEC-44 determination 2: what the case is ABOUT, authored by the
             group. Beside it, what it left OUT. A reader needs both. */
          scope: cs.scope ?? null,
          /* REC-47 / DEC-46 (a): INSIDE THE CONTAINER, which is the copy that
             matters most. DEC-20 makes the bias part of the evidentiary record
             that TRAVELS with publication, and the container is the artifact
             that travels — a stranger holding the zip must be able to read the
             lens this case was made under without coming back to this instance.
             An acknowledgement served only from a live op would be a disclosure
             that stops existing the moment the instance does. */
          bias_acknowledgement: cs.bias_acknowledgement ?? null,
          completeness: cs.completeness ?? null,
          /* REC-58, 2026-08-05: `ratified_at` and NOT `opened`, and the pair is
             a decision rather than an accident of which fields were to hand.
             `cs` is the whole case-edition state and carries both. The instant
             the LAST member signed is what this container can stand behind; the
             instant somebody started work is a fact about the working record,
             and a stranger holding this zip has no way to check it and no stated
             use for it. Named rather than spread, for the reason at the sibling
             pick above: this artifact travels without this instance, so a field
             that leaks into it cannot be withdrawn from the copies. */
          ratified_at: cs.ratified_at,
          /* EVERY MEMBER FINDING, each with its OWN signature, its OWN attestor
             and its OWN frozen PAIR. The signature is per finding because the
             FINDING is the unit of truth: what a member signed is one
             document's bytes, and a case-level signature would be a signature
             over something nobody reviewed. */
          findings: cs.findings.map((f) => ({
            bundle_id: f.bundle_id, title: f.title,
            /* CASE-5, AND THIS ONE LINE WAS A FALSE STATEMENT IN A SIGNED-ADJACENT
               ARTIFACT. It read `edition: cs.edition` — the CASE's number,
               written onto every member as though it were the member's. While
               the two were slaved it happened to be true; the artifact flip makes
               it a claim about a finding that the finding's own published row
               contradicts, and this is the copy that TRAVELS, so a reader has no
               way to check it against anything. It is the member's own edition,
               off the member's own published row, resolved by the pin. */
            edition: f.edition,
            bundle_sha: f.bundle_sha,
            /* THE PIN AND THE DESIGNATION, INSIDE THE CONTAINER. The design's
               sentence: the CASE artifact freezes its members — *"content by
               hash, version, per-member strength pair, role, the bar, the
               exclusions."* The pair and the exclusions were already here (the
               latter inside `completeness.excluded`, which is why it is not
               copied a second time); the version and the role were not.
               `version_sha` is what the case COMMITTED TO and `bundle_sha` is
               what the member SIGNED — equal by construction at assembly, and
               carried as two fields anyway, because a reader checking the freeze
               must be able to see the case's commitment as a separate statement
               from the finding's own hash. `role` is the authored designation
               (clause 4): a stranger holding a SUPPORTING member must be able to
               see it was not presented as carrying the case. */
            version_sha: f.version_sha ?? null,
            role: f.role ?? null,
            ratified_at: f.ratified_at, gate_version: f.gate_version,
            attestor: f.attestor,
            delivered_by: f.delivered_by,
            /* CASE-5 CORRECTS `statement`, AND IT IS THE ONE FIELD IN THIS
               ARTIFACT THAT WAS UNREADABLE BY THE READER IT EXISTS FOR.
               `ratifyStatement()` returns a Uint8Array — it is the message fed
               to the signer — and JSON.stringify turns a Uint8Array into an
               OBJECT KEYED BY BYTE INDEX: {"0":98,"1":105,…}. So the container
               told a stranger to check a signature over a statement it printed
               as 47 numbered integers, and the one thing they had to have in
               ASCII was the one thing they had to decode. Nothing consumed it —
               measured across the interface's screens, the tests of the day and this file — so this
               is a correction and not a withdrawal, and it rides the /4 bump
               with the rest of what the flip adds. Decoded here rather than by
               changing `ratifyStatement`, whose Uint8Array return is exactly
               right for `verifySshsig`'s caller two thousand lines up. */
            signature: { namespace: NS_RATIFY,
                         statement: new TextDecoder().decode(ratifyStatement(f.bundle_id, f.bundle_sha)),
                         armored: f.sig_armored },
            strength: f.strength, required_strength: f.required,
            parts: f.parts.map((p) => `${f.bundle_id}/${p.path}`),
          })),
          /* The parts are NAMESPACED BY FINDING, and that is forced rather than
             chosen: every finding carries a `bundle.md`, so a flat parts[]
             would have two members claiming one path and the archive would say
             two things about one name. */
          parts: cs.findings.flatMap((f) => f.parts.map((p) => ({
            path: `${f.bundle_id}/${p.path}`, finding: f.bundle_id,
            sha256: p.sha256, kind: p.kind, bytes: p.bytes ?? null }))),
          layout: { root: `${cs.caseId}/`, parts_at: "path", manifest_at: "MANIFEST.json",
                    note: LAYOUT_NOTE },
          /* CASE-5: THE INSTRUCTIONS A STRANGER ACTUALLY NEEDS, in the
             artifact rather than in our documentation — which they do not
             have, and which is the whole point of the thing they are
             holding. Three sentences, one per field the flip adds, each of
             them a check the reader can RUN. */
          /* REC-128: the two principals of one ratification, told apart in
             the artifact that travels. */
          /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (c): WHICH SIGNATURE COVERS A MEMBER'S
             FROZEN PAIR now depends on the case document's format, and a stranger must be told
             which one to check — in the artifact, for CASE-5's reason above. */
          verify: VERIFY_TEXT
                + (caseDocumentStatesMemberBlocks(parseFrontmatter(String((cs.document && cs.document.text) || "")).data || {})
                  ? VERIFY_MEMBER_PAIR
                  : ""),
        };
        /* REC-148: THE MANIFEST'S HASH IS TAKEN BY `inbandQuartet` — the one function the review copy's
           in-band quartet uses too (DEC-31's bound rule, `BIO_Publication_v0_1.md` §6A.3 point 1), so the
           two can never be two canonicalisations under one name. The bytes are unchanged: the manifest was
           always hashed over `JSON.stringify(manifest, null, 1)`, which is the function's canonical form. */
        const { bytes: mBytes, quartet: inband } = await inbandQuartet({
          subject: manifest,
          over: OVER_CONTAINER,
          date: cs.ratified_at ?? null,
          author: (cs.document && cs.document.attestor && cs.document.attestor.member) ?? null,
          bar: cs.bar ?? null });
        const mSha = inband.hash.sha256;
        /* REC-53, THE FIRST POST-COMMIT SITE. A silence here made `rec`
           undefined and the fallback minted `reason:"MANIFEST_NOT_RECORDED"` —
           a statement that the published record does NOT hold this case's
           container — and carried it inside an `ok:true` ratification answer.
           Invisible to REC-52's detector B, which reads `json()` arguments, and
           to detector A, which looks for a `.result` spread: this one travels to
           the caller in a LOCAL VARIABLE and is spread twelve lines later.
           The ratification has ALREADY COMMITTED here, so this may not refuse;
           it states the exchange instead. The `MANIFEST_NOT_RECORDED` fallback
           survives for the answered path, where it describes a store that said
           `ok:false` without a reason of its own. */
        mark("record");
        const recOut = await plane().doAnswer(stub.fetch(new Request("http://do/recordcasemanifest", {
          method: "POST", body: JSON.stringify({ caseId: cs.caseId, edition: cs.edition,
                                                 manifest, manifestSha: mSha, bytes: mBytes.length }) })));
        const rec = recOut.result;
        mark("manifest_put");
        if (recOut.answered && rec && rec.ok && typeof env.PUBLISHED?.put === "function") {
          const key = `${storeName}/published/${mSha}`;
          if (!(await env.PUBLISHED.head(key))) await env.PUBLISHED.put(key, mBytes);
        }
        return !recOut.answered
          ? { ok: false, reason: plane().STORE_SILENT_REASON, op: `${via}/recordcasemanifest`,
              detail: plane().STORE_SILENT_DETAIL }
          : rec && rec.ok
            ? { manifest_sha: mSha, parts: manifest.parts.length, findings: manifest.findings.length,
                zip: `op=publishedbytes&sha256=${mSha}&format=zip`, inband }
            : { ok: false, ...(rec || { reason: "MANIFEST_NOT_RECORDED" }) };
}

/* R6, R23, R24 (DEC-112 (2), (3); K1315): THE CASE FILE, assembled once when a `/6` or `/7` case edition completes. Every file
   is put in the published bucket by its hash first, then the manifest is recorded through `publication`'s
   `recordCaseManifest` (its R15), which registers every file it lists in `published_shas` in the same transaction, so
   each is served by hash (R5, R24); the manifest's own bytes go to the bucket once it is recorded, as the container's
   always did. The manifest's hash is the in-band quartet's (R7), the one hasher. Answers what `op=ratify` carries as
   `container`: the manifest's hash, its parts and their addresses, or the statement of what was not built. */
async function assembleCaseFile({ env, storeName, cs, stub, via, facts, maxBytes, mark = () => {}, prior = null }) {
  const key = (sha) => `${storeName}/published/${sha}`;
  const statement = (code, step, extra = {}) => ({ ok: false, reason: "CASE_FILE_NOT_BUILT", code, step, ...extra });
  /* G54 (ii): a missing bucket binding is a stated failure and nothing is recorded; it was skipped in silence, with the
     manifest recorded over files never stored. */
  mark("bucket_put");
  const b = env.PUBLISHED;
  if (!b || typeof b.get !== "function" || typeof b.head !== "function" || typeof b.put !== "function")
    return statement("NO_BUCKET", "bucket_put");
  /* G54: one edition's bytes are held in memory at once; an edition of more files than the bound is stated, not attempted. */
  mark("build");
  const estimate = (facts.materials || []).reduce((n, m) => n + 2 + (m.archives || []).length, 0) + (facts.obscured || []).length
    + (facts.attestations || []).length + (facts.findings || []).length * 4 + (facts.calculations || []).reduce((n, c) => n + 1 + (c.inputs || []).length, 0);
  if (estimate > CASEFILE_FILES_MAX) return statement("TOO_LARGE", "build", { files: estimate });
  /* G121b: a sha read from the bucket at its own key is held there; a file of that hash needs neither a `head` nor a `put`. */
  const held = new Set();
  const read = async (sha) => {
    const o = await b.get(key(sha));
    if (!o) return null;
    held.add(sha);
    return new Uint8Array(await o.arrayBuffer());
  };
  const built = await buildCaseFile({ facts, group: cs.group ?? null, read, ...(maxBytes ? { maxBytes } : {}) });
  if (!built.ok) return built;
  /* G54 (iii): no case file is recorded while a material it lists is missing (an `unheld` entry that names a well-formed sha and has no `why`: a row
     that states no extracted text, or a sha that is no sha, names nothing that could be held; one with a `why` is by design: an original carried as its copy, an archive that holds one). It stays owed, stated and retried. */
  mark("materials");
  const missing = built.unheld.filter((u) => !u.why && !u.unspellable && !u.unregistered && /^[0-9a-fA-F]{64}$/.test(String(u.sha ?? ""))).length + (prior && Array.isArray(prior.materials_missing) ? prior.materials_missing.length : 0);
  if (missing) return statement("MATERIAL_MISSING", "materials", { files: built.files.length, missing });
  /* The manifest's bytes depend on the files' hashes only, so they are made before anything is written and put with the files. */
  mark("quartet");
  const { bytes: mBytes, quartet: inband } = await inbandQuartet({
    subject: built.manifest,
    over: OVER_CASE_FILE,
    date: cs.ratified_at ?? null,
    author: (cs.document && cs.document.attestor && cs.document.attestor.member) ?? null,
    bar: cs.bar ?? null });
  const mSha = inband.hash.sha256;
  /* R44 (G121, G121b): what the case file derives (the document, the signature, the listings, the complete edition) is put, and its
     manifest with it, in one sliding window of 8 over the distinct objects (two paths of one file are one object), each by its
     hash and with no `head` before the put (a file over `CASEFILE_BLIND_PUT_MAX` is asked after first); an object just read from
     the bucket is held already and is not touched. The manifest is recorded once its files are in; a failure of its own put is stated after the record. */
  mark("bucket_put");
  const objects = [...new Map(built.files.filter((f) => !held.has(f.sha256)).map((f) => [f.sha256, f])).values()];
  const writes = [...objects.map((f) => ({ sha: f.sha256, content: f.content, manifest: false })), { sha: mSha, content: mBytes, manifest: true }];
  const done = await inWindow(writes, async (w) => {
    if (w.content.length > CASEFILE_BLIND_PUT_MAX && (await b.head(key(w.sha)))) return;
    await b.put(key(w.sha), w.content);
  });
  const failure = done.findIndex((r, i) => r && r.status === "rejected" && !writes[i].manifest);
  if (failure >= 0) throw done[failure].reason;
  mark("record");
  /* G54: `built` only once the manifest's own bytes are stored */
  const manifestStored = done[writes.length - 1].status === "fulfilled";
  const recOut = await plane().doAnswer(stub.fetch(new Request("http://do/recordcasemanifest", {
    method: "POST", body: JSON.stringify({ caseId: cs.caseId, edition: cs.edition,
                                           manifest: built.manifest, manifestSha: mSha, bytes: mBytes.length,
                                           built: manifestStored }) })));
  const rec = recOut.result;
  if (!recOut.answered)
    return { ok: false, reason: plane().STORE_SILENT_REASON, op: `${via}/recordcasemanifest`, detail: plane().STORE_SILENT_DETAIL };
  if (!(rec && rec.ok)) return { ok: false, ...(rec || { reason: "MANIFEST_NOT_RECORDED" }) };
  /* its own bytes went with the files; a put that failed is stated here, after the record, as it always was: recorded, bytes not stored */
  mark("manifest_put");
  if (done[writes.length - 1].status !== "fulfilled") throw done[writes.length - 1].reason;
  const parts = built.manifest.parts.map((p) => ({ index: p.index, sha256: p.sha256, bytes: p.bytes,
    zip: `op=publishedbytes&sha256=${mSha}&format=zip&part=${p.index}` }));
  const answer = { manifest_sha: mSha, format: built.manifest.format, parts: parts.length, part_addresses: parts,
           files: built.files.length, findings: facts.findings.length, bytes: built.files.reduce((n, f) => n + f.bytes, 0),
           complete_edition: built.files.find((f) => f.kind === "complete_edition")?.sha256 ?? null,
           unheld: built.unheld, zip: parts[0].zip, inband };
  if (manifestStored) CASE_FILE_BUILT.add(answer);
  return answer;
}

/* REC-22 / DEC-34 / R3, R5: the public read path's control-plane side, `op=publishedcase` and `op=publishedbytes`,
   for a caller holding no credential. `stub` is the published store's Durable Object (PUBLISHED_STORE). Answers the
   Response. */
export async function publishedRoutes({ op, url, env, stub }) {
  const P = plane();
  const shaParam = (url.searchParams.get("sha256") || "").toLowerCase();
  const pubKey = (sha) => `${P.PUBLISHED_STORE}/published/${sha}`;
  const pubBytes = async (sha) => {
    if (typeof env.PUBLISHED?.get !== "function") return null;
    const o = await env.PUBLISHED.get(pubKey(sha));
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  };

  if (op === "publishedbytes") {
    if (!/^[0-9a-f]{64}$/.test(shaParam))
      return P.json({ ok: false, ...P.requiredArgument("publishedbytes", "sha256", "<64 lowercase hex>",
        localize("public-read.worker.publishedbytes_requires_sha256_64_lowercase", "publishedbytes requires sha256=<64 lowercase hex>. This surface answers BY HASH and never by path, so there is nothing to walk.")) }, 400);
    /* THE GUARD, and it is the whole op. A sha is served if and only if a
       published_shas row names it. Everything else 404s with the SAME body
       — a hash that was never ratified and a hash that never existed are
       one answer, so the absence of a document cannot be inferred from the
       shape of a refusal.

       It is NOT redundant with the bucket boundary, and
       `convert-publishedcase.test.mjs`' R5 (block 3) arm proves that: a
       working document planted in the PUBLISHED bucket (a plausible installer
       slip that nothing else in the plane would catch) answers exactly as a
       hash that never existed, because this guard is the only thing standing
       between an anonymous caller and the working corpus. */
    /* REC-52, a THIRD site the item did not name and the sweep found.
       `!v` and `!v.published` used to be one test, so a store that never
       answered fell into `notFound()` — and `notFound()` is not a shrug,
       it is a CLAIM: "no published part answers to that hash … a hash
       that was never ratified and a hash that never existed are the same
       answer here, deliberately." That clause is exactly what makes the
       sentence convincing, and it is true only of a real absence. The
       two are now separated: a silence is a silence, and the guard below
       keeps its whole meaning for the answers that reach it. */
    const vOut = await P.doAnswer(stub.fetch(`http://do/verify?sha256=${shaParam}`));
    if (!vOut.answered) return relayUnanswered(vOut, "publishedbytes");
    const v = vOut.result;
    /* D-561: NO_PUBLISHED_PART (C-98.1) from its one governed site; it was `NOT_FOUND`. */
    if (!v || !v.published) return P.json(noPublishedPart(shaParam), 404);
    /* R28: bytes a court order in force withholds are not served, by any route below; the zip's own files are checked
       once its manifest is read. */
    const wOut = await withheldOf(stub, [shaParam]);
    if (!wOut.answered) return relayUnanswered(wOut, "publishedbytes");
    if (wOut.withheld[shaParam]) return P.json(withheldByCourtOrder(shaParam, { [shaParam]: wOut.withheld[shaParam] }), 451);
    /* D-734 (BOB #36, 2026-09-25 11:50Z, D-731 (b); BIO_Publication_v0_1.md §4): A RATIFIED CASE DOCUMENT'S HASH is
       registered when it is signed (kind `case_document`), and its bytes never go to the published bucket — they are
       the signed text itself. So they are read from the store and served only after THIS layer re-hashes them and
       finds exactly the sha asked for: the store's read does not vouch for its bytes. Ahead of the bucket's own checks
       because it needs no bucket; `format=zip` falls through to NOT_A_CONTAINER below, since a case document is a
       part, not a container. Bytes the record cannot produce at that hash are refused BY NAME and never 404'd: the
       hash IS published, and NO_PUBLISHED_PART's sentence would call it never ratified. */
    if (v.matches.some((m) => m.kind === "case_document") && (url.searchParams.get("format") || "") !== "zip") {
      const dOut = await P.doAnswer(stub.fetch(`http://do/publishedcasedoctext?sha256=${shaParam}`));
      if (!dOut.answered) return relayUnanswered(dOut, "publishedbytes");
      const d = dOut.result || {};
      const docBytes = d.found && typeof d.text === "string" ? new TextEncoder().encode(d.text) : null;
      const docSha = docBytes ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", docBytes))]
        .map((x) => x.toString(16).padStart(2, "0")).join("") : null;
      if (docSha !== shaParam) {
        /* DEC-49 REGION is-case-document-unservable */
        return P.json({ ok: false, reason: "CASE_DOCUMENT_UNSERVABLE", ...rowOf("CASE_DOCUMENT_UNSERVABLE"), sha256: shaParam,
          detail: localize("public-read.worker.this_hash_is_a_ratified", "this hash is a ratified case document's and is published, but the record could not produce bytes that hash to it, so nothing is served. Nothing here says the document was never ratified: op=verify still answers for the hash.") }, 500);
        /* END DEC-49 REGION is-case-document-unservable */
      }
      return new Response(docBytes, { status: 200, headers: {
        "content-type": "application/octet-stream", "access-control-allow-origin": "*",
        "x-published-sha256": shaParam, "x-published-kind": "case_document",
        "content-disposition": `attachment; filename="${`${d.case_id}-${d.path}`.replace(/[^\w.\-]/g, "_")}"`,
      } });
    }
    /* D-549: the code, its check and its canned translation come from the ONE governed site;
       `detail` is this site's own sentence, byte-identical to what it said before. */
    const storeAbsent = publishedStoreAbsent(env);
    if (storeAbsent)
      return P.json({ ok: false, ...storeAbsent,
        detail: localize("public-read.worker.this_teams_civicsmith_has_no", "this team's Civicsmith has no published object store configured, so its published bytes are not servable. The hash is genuine and this team's Civicsmith cannot hand over the bytes.") }, 503);

    /* DEC-34, THE CONTAINER. The manifest's own hash IS the container's
       identity — it names and hashes every part — so the zip is addressed
       by that hash like everything else here, and `format=zip` on a hash
       that is not a manifest is refused by NAME rather than quietly
       serving the part instead. */
    const wantZip = (url.searchParams.get("format") || "") === "zip";
    const isManifest = v.matches.some((m) => m.kind === "manifest");
    if (wantZip && !isManifest) {
      /* DEC-49 REGION is-not-a-container
       * D-561 (C-98.3): the code a STRING LITERAL here, its translation from its row. */
      return P.json({ ok: false, reason: "NOT_A_CONTAINER", ...rowOf("NOT_A_CONTAINER"), sha256: shaParam,
        detail: localize("public-read.worker.format_zip_serialises_a_case", "format=zip serialises a case CONTAINER, which is addressed by its MANIFEST's hash. This hash names a part inside a container, not a container.") }, 400);
      /* END DEC-49 REGION is-not-a-container */
    }
    const raw = await pubBytes(shaParam);
    /* D-561: VERIFIED published above and absent from a bound store — OBJECT_MISSING (C-98.2), never the
       "no published part answers" sentence, which is false of this hash. */
    if (!raw) return P.json({ ok: false, ...publishedObjectMissing(), sha256: shaParam }, 404);
    if (!wantZip) {
      const m = v.matches[0] || {};
      return new Response(raw, { status: 200, headers: {
        "content-type": "application/octet-stream", "access-control-allow-origin": "*",
        "x-published-sha256": shaParam, "x-published-kind": m.kind || "",
        /* The PATH is disclosed on the way OUT and is never accepted on the
           way IN: a reader saving the file deserves its name; a caller
           asking by path would be walking the corpus. */
        "content-disposition": `attachment; filename="${(m.path || shaParam).split("/").pop().replace(/[^\w.\-]/g, "_")}"`,
      } });
    }
    let manifest = null;
    try { manifest = JSON.parse(new TextDecoder().decode(raw)); } catch { manifest = null; }
    if (!manifest || typeof manifest !== "object") {
      /* DEC-49 REGION is-manifest-unreadable
       * D-561 (C-98.4): the code a STRING LITERAL here, its translation from its row. */
      return P.json({ ok: false, reason: "MANIFEST_UNREADABLE", ...rowOf("MANIFEST_UNREADABLE"),
                    sha256: shaParam }, 500);
      /* END DEC-49 REGION is-manifest-unreadable */
    }
    /* R5, R6 (DEC-112 (3)): A CASE FILE is served one part at a time, `&part=<n>` (1 by default), each a stored ZIP with
       the manifest at its root; a part the manifest does not list is the required-argument refusal naming the parts it
       does. Its files are read at their hashes: bytes the bucket holds at another hash count as missing (C-98.5). A
       container from before T28 is served as stored. */
    let source = manifest, read = pubBytes, part = null;
    if (isCaseFileManifest(manifest)) {
      const asked = url.searchParams.get("part");
      part = asked == null || asked === "" ? 1 : /^[1-9][0-9]{0,5}$/.test(asked) ? Number(asked) : NaN;
      source = Number.isInteger(part) ? caseFilePartLayout(manifest, part) : null;
      if (!source)
        return P.json({ ok: false, ...P.requiredArgument("publishedbytes", "part", `one of ${caseFileParts(manifest).join(", ")}`,
          localize("public-read.worker.this_case_file_has_parts", "this case file has {count} part(s); ask for one by part=<index>, one of {parts} (1 by default)",
                   { count: String(caseFileParts(manifest).length), parts: caseFileParts(manifest).join(", ") })) }, 400);
      read = async (sha) => { const b = await pubBytes(sha); return b && (await sha256Hex(b)) === sha ? b : null; };
    }
    /* R28: a zip carrying any file a court order withholds is not served: one with a piece missing is never handed over
       (C-98.5's rule), and the withheld files are named with their orders; every other file is still served by hash. */
    const listedShas = [...new Set((Array.isArray(source.parts) ? source.parts : [])
      .map((p) => p && p.sha256).filter((x) => typeof x === "string" && /^[0-9a-f]{64}$/.test(x)))];
    if (listedShas.length) {
      const zOut = await withheldOf(stub, listedShas, shaParam);
      if (!zOut.answered) return relayUnanswered(zOut, "publishedbytes");
      if (Object.keys(zOut.withheld).length) return P.json(withheldByCourtOrder(shaParam, zOut.withheld), 451);
    }
    const built = await containerEntries(source, raw, read);
    /* D-561 (C-98.5–.7): `container.mjs` is pure and reads no catalogue, so each refusal's row is attached here, by
       its code, from this module's rows. D-613: THE STATUS FOLLOWS THE CODE — a part missing and two parts claiming one
       path are conflicts in what is published (409); only a container over the bound is too large (413). Every
       `serialiseContainer` refusal used to answer 413, telling a stranger a request was too large when it named a
       path twice. */
    if (!built.ok) return P.json({ ok: false, ...built, ...rowOf(built.reason) }, 409);
    const zip = serialiseContainer(built.entries);
    if (!zip.ok) return P.json({ ok: false, ...zip, ...rowOf(zip.reason) }, zip.reason === "CONTAINER_TOO_LARGE" ? 413 : 409);
    const zipSha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", zip.bytes))]
      .map((x) => x.toString(16).padStart(2, "0")).join("");
    return new Response(zip.bytes, { status: 200, headers: {
      "content-type": "application/zip", "access-control-allow-origin": "*",
      "x-manifest-sha256": shaParam, "x-container-sha256": zipSha,
      "x-container-parts": String(built.entries.length),
      ...(part != null ? { "x-case-file-part": String(part), "x-case-file-parts": String(caseFileParts(manifest).length) } : {}),
      "content-disposition": `attachment; filename="${String(manifest.case || "case").replace(/[^\w.\-]/g, "_")}`
                           + `-edition-${Number(manifest.edition) || 1}`
                           + `${part != null ? `-part-${part}` : ""}.zip"`,
    } });
  }

  /* ---- op=publishedcase ---- */
  const id = url.searchParams.get("id");
  if (!id && !/^[0-9a-f]{64}$/.test(shaParam))
    return P.json({ ok: false, ...P.requiredArgument("publishedcase", "id or sha256",
      "id=<record id> (optional &edition=N) or sha256=<64 lowercase hex>",
      "publishedcase requires id=<record id> (with an optional "
                + "&edition=N, latest by default) or sha256=<the record sha of an edition>") }, 400);
  const q = new URLSearchParams();
  if (id) q.set("id", id);
  if (url.searchParams.get("edition")) q.set("edition", url.searchParams.get("edition"));
  /* D-309 / IC-74: a finding may serve many cases (DEC-72 clause 6), so a
     finding id alone can be an ambiguous question and the store refuses it
     `FINDING_IN_SEVERAL_CASES` naming every candidate. This forwards the
     reader's ANSWER to that question. It is a resolution aid and never an
     assertion: the store still resolves the case from the RECORD and only
     uses this to pick among memberships the record already holds, so a
     caseId a caller invents reaches nothing. */
  if (url.searchParams.get("caseId")) q.set("caseId", url.searchParams.get("caseId"));
  if (/^[0-9a-f]{64}$/.test(shaParam)) q.set("sha256", shaParam);
  /* REC-52, SITE (b). This read used to be
       `if (!c || !c.ok) return json({ ok: false, ...(c || { reason: "NOT_PUBLISHED" }) }, 404);`
     — the plane MANUFACTURING a substantive claim about the record out
     of a failure to answer. `NOT_PUBLISHED` is the store's own word for
     a real absence, and it carries the store's own sentence with it
     (`../public-read/index.mjs` states it, with C-98.8's row from
     `../public-read/checks.mjs`, and `convert-publishedcase.test.mjs`' R3
     (block 1) arm holds that this route relays them); minting the bare code here
     produced a refusal that LOOKS like that answer and is not one.
     THE STORE'S OWN `NOT_PUBLISHED` IS UNTOUCHED and still reaches the
     caller verbatim on the branch below — the two must not collapse in
     either direction, and both directions have their own arm. */
  const cOut = await P.doAnswer(stub.fetch(`http://do/publishedcase?${q}`));
  if (!cOut.answered) return relayUnanswered(cOut, "publishedcase");
  const c = cOut.result;
  /* MEASURED, not assumed: `Store.publishedCase` returns an object on
     every path — its own `{ok:false, reason:"NOT_PUBLISHED", detail}`
     when nothing answers. So `!c` is a store that answered with nothing
     at all, which is a silence wearing an answer's envelope and gets the
     silence's reply rather than the record's. */
  if (!c) return P.storeSilent("publishedcase");
  if (!c.ok) return P.json({ ok: false, ...c }, 404);

  /* REC-44 / DEC-44: RENDERED PER FINDING, PLURAL. This surface used to
     render one body, one basis and one frozen pair because a case was
     assumed to be one inquiry. A case is a container over one or MORE
     findings, so the body and the basis are rendered for EACH of them and
     the frozen pair travels with the finding it belongs to. There is no
     case-level `strength` anywhere in this answer and there must never be
     one — composing two findings' strengths into one letter is R2's
     forbidden composition arriving at case altitude, which is exactly what
     DEC-44's own negative control exists to catch. */
  /* R41 (1): what the signed case document states of each member's legs, read once from the same bytes the store served
     (`document`), so an entry resting on a captured document names it and the place it cites; null when the document is
     withheld or states none, and every entry then states `document: null`. */
  const signedFm = c.document && typeof c.document.text === "string" ? parseFrontmatter(c.document.text).data || null : null;
  const legReader = signedFm ? legReaderOf(signedFm) : null;
  const renderFinding = async (fnd) => {
    /* D-1: THE BODY COMES FROM THE SAME BYTES AS THE FROZEN STRENGTH. The
       document is fetched from the published bucket by the finding's own
       bundle_sha, so what a reader is shown and what the group signed cannot
       be two different documents — which is precisely the overclaim D-1
       refuses (rendering a frozen strength beside a live working body). An
       unreadable body is STATED as unavailable with its reason; it is never
       substituted from the working corpus, which would be the same overclaim
       by a shorter route. */
    /* R28: a finding whose bytes a court order withholds is not fetched; its body states the withholding and its
       orders, and no basis is read from bytes that are not served. */
    if (fnd.withheld)
      return { ...fnd, object_type: null, basis: [], falsifier: null,
               body: { state: "withheld", from_sha: fnd.bundle_sha, ...fnd.withheld },
               bytes: `op=publishedbytes&sha256=${fnd.bundle_sha}` };
    const md = await pubBytes(fnd.bundle_sha);
    const text = md ? new TextDecoder().decode(md) : null;
    const fm = text ? (parseFrontmatter(text).data || {}) : null;
    /* D-549: WHICH CODE UNDER WHICH CONDITION, when the bytes are unavailable. No published store
       bound -> NO_PUBLISHED_STORE, with its check and canned translation, from its one governed
       site. A store bound and no object at this finding's hash -> OBJECT_MISSING, since D-561 with
       its own check and canned translation (C-98.2) from ITS one governed site, shared with
       publishedbytes. The two never share a site again. Each helper's `ok: false` is dropped here:
       this is one finding's body stated unavailable inside a case that answered, not a refusal. */
    const { ok: _refused, ...whyUnavailable } = text ? {}
      : (publishedStoreAbsent(env) ?? publishedObjectMissing());
    const body = text
      ? { state: "published", from_sha: fnd.bundle_sha,
          question: sectionText(text, "## Question"),
          /* R39 (C2): THE WORDS OF THE CLAIM AND THE FALSIFIER, never a heading: the signed case document's own claim
             and falsifier first, the front matter's authored words next, the section's words last, null when there are
             none. `sectionText` keeps the heading, so the section is read without it. */
          conclusion: wordsOf(fnd.case_words?.claim) ?? wordsOf(fm?.conclusion) ?? sectionWords(text, "## Conclusion"),
          falsifies: wordsOf(fnd.case_words?.falsifier) ?? wordsOf(fm?.falsifier)
                     ?? sectionWords(text, word("conformance.falsify")),
          /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): a member published under rule 12
             carries no `## What This Excludes` in its own bytes — the case states it once, in
             its document — so the section is read from THAT signed document for such a member,
             and from the member's own bytes for a legacy one (rule 12 (e)). `excludes_from`
             says which, so a renderer never has to infer whose words it is printing. */
          excludes: fnd.frozen_from === "case_document"
            ? (typeof fnd.case_excludes === "string" ? fnd.case_excludes : null)
            : sectionText(text, "## What This Excludes"),
          excludes_from: fnd.frozen_from === "case_document" ? "case_document" : "member_bytes",
          /* BOTH, because the document says it in two places and they are not
             the same statement. The FRONTMATTER carries what op=conclude
             authored and what the catalog gates — that is the conclusion of
             record. The SECTION carries the prose beside it, which is where a
             division writes its account and where a person reads. Returning
             only one of them would either drop the gated claim or drop the
             explanation; a renderer needs to know which is which. */
          /* REC-117 / BOB 2026-09-17, AND THIS SURFACE IS THE ONE HE NAMED.
             "a member can override either temporarily or IN THE PUBLISHED
             RECORD" — so the override travels into the signed bytes and is
             rendered from them here, beside the falsifier it stands in for.
             `falsifier_override` is `{by, at}` or NULL and never absent: a
             renderer that had to tell the two cases apart by a missing key
             would be inferring the condition, and the whole of this item is
             that the condition is STATED. A published finding whose
             falsifier is empty and whose override is null is a document
             that predates this item or was never gated — NOT a silent
             override, and a renderer must not print one as the other. */
          authored: { conclusion: typeof fm?.conclusion === "string" ? fm.conclusion : null,
                      falsifier: typeof fm?.falsifier === "string" ? fm.falsifier : null,
                      falsifier_override:
                        (typeof fm?.falsifier_override_by === "string" && fm.falsifier_override_by.trim()
                         && typeof fm?.falsifier_override_at === "string" && fm.falsifier_override_at.trim())
                          ? { by: fm.falsifier_override_by.trim(), at: fm.falsifier_override_at.trim() }
                          : null },
          detail: localize("public-read.worker.authored_is_what_op_conclude", "`authored` is what op=conclude wrote into the frontmatter and what the gate holds the finding to; the section fields are the prose printed beside it in the signed bytes. `falsifier_override`, when it is not null, is the member who recorded that NO falsifier could be stated for this finding, and when they did so.") }
      : { state: "unavailable", from_sha: fnd.bundle_sha, ...whyUnavailable,
          detail: localize("public-read.worker.this_teams_civicsmith_cannot_hand", "this team's Civicsmith cannot hand over the bytes of that edition, so its conclusion is not rendered here. It is NOT read from the working record instead: the frozen strength and the rendered body must come from the same bytes.") };

    /* THE BASIS LEGS, from the signed bytes, each one classified as a leg
       this surface can SERVE or one it can only NAME. `served` is decided
       against the published projection and nothing else, so a leg resting on
       working material is named and never resolved; the cited EDITION's
       frozen pair travels with it (DEC-12: a leg names an edition and does
       not silently follow a newer one). A leg rests on a FINDING, never on a
       case — C-21.2's altitude, which DEC-44 leaves exactly where it was. */
    const legs = Array.isArray(fm?.basis) ? fm.basis.filter((l) => l && typeof l.target === "string") : [];
    let registry = {};
    if (legs.length) {
      const ids = [...new Set(legs.map((l) => l.target))];
      /* REC-52, a FIFTH site and the one that argues hardest for sweeping
         rather than fixing the two the item named. `registry = (rt &&
         rt.registry) || {}` meant a store that never answered produced an
         EMPTY registry, and an empty registry makes every leg resolve to
         `served: false` with the sentence "this leg is NAMED and not
         served: what it rests on is not in the published record". That is
         a substantive claim about the published record — the same defect
         as site (b), reached by a `||` on a different line, and it would
         have been rendered as a finding's own basis on the surface a
         stranger arrives at. An empty registry is now only ever the
         store's own answer. */
      const rtOut = await P.doAnswer(stub.fetch(
        `http://do/publishedtargets?ids=${encodeURIComponent(ids.join(","))}`));
      if (!rtOut.answered) throw new Unanswered("publishedcase/publishedtargets", rtOut);
      const rt = rtOut.result;
      registry = (rt && rt.registry) || {};
    }
    const ofLeg = legReader ? legReader.forFinding(fnd.bundle_id) : null;
    const basis = legs.map((l) => {
      const reg = registry[l.target] || null;
      const named = l.target_edition != null ? String(l.target_edition) : null;
      const cited = reg ? (named ? reg.editions[named] : reg.editions[String(reg.latest)]) : null;
      return {
        target: l.target, role: l.role ?? "supports",
        grade: l.grade ?? null, grade_axis: l.grade_axis ?? null, grade_source: l.grade_source ?? null,
        target_edition: l.target_edition ?? null,
        served: !!cited,
        /* R41 (1): the document this leg rests on, named and placed as the signed case states them, never its bytes; null
           for a leg resting on working material (or on a finding), and where the case states no legs. */
        document: ofLeg ? ofLeg.of(l) : null,
        cited_edition: cited
          ? { edition: cited.edition, title: cited.title, bundle_sha: cited.bundle_sha,
              ratified_at: cited.ratified_at, case_id: cited.case_id ?? null,
              capture: cited.capture, connection: cited.connection,
              /* MK-2 / IC-142: present only where the edition froze one. */
              ...(cited.testimony ? { testimony: cited.testimony } : {}) }
          : null,
        detail: cited
          ? localize("public-read.worker.this_leg_rests_on_a", "this leg rests on a published finding, so it can be served from this surface.")
          : localize("public-read.worker.this_leg_is_named_and", "this leg is NAMED and not served: what it rests on is not in the published record, so this surface can say the finding cites it and can hand over nothing of it."),
      };
    });
    /* R41 (2): "What would change it", the text the finding's published bytes state (R39's `authored.falsifier`), beside the
       case document's own words for it (`case_words`); null when the bytes state none or cannot be read. */
    return { ...fnd, object_type: normalizeType(fm?.object_type) ?? null, body, basis, falsifier: wordsOf(fm?.falsifier),
             bytes: `op=publishedbytes&sha256=${fnd.bundle_sha}` };
  };
  const findings = [];
  try {
    for (const fnd of c.findings || []) findings.push(await renderFinding(fnd));
  } catch (e) {
    /* REC-52: a store silence inside the renderer refuses the WHOLE read
       rather than serving a partially-rendered case, because a case
       rendered from a registry that was never consulted asserts things
       about its own basis that nobody checked. Anything else is re-thrown
       untouched — a real crash must not arrive dressed as a silence. */
    if (e instanceof Unanswered) return relayUnanswered(e.out, e.op);
    throw e;
  }

  return P.json({ ok: true, ...c, findings,
    verification: {
      /* G54: a manifest recorded over bytes never stored (`case_file` is not `built`) is not a download: the addresses are
         given only for a case file that is built, and the state and code say what it is otherwise */
      container: c.manifest_sha && (!c.case_file || c.case_file.state === "built") ? `op=publishedbytes&sha256=${c.manifest_sha}&format=zip` : null,
      manifest: c.manifest_sha && (!c.case_file || c.case_file.state === "built") ? `op=publishedbytes&sha256=${c.manifest_sha}` : null,
      case_file: c.case_file ?? null,
      findings: findings.map((f) => ({ bundle_id: f.bundle_id,
                                       bytes: `op=publishedbytes&sha256=${f.bundle_sha}` })),
      detail: localize("public-read.worker.tamper_evident_not_tamper_proof", "tamper-EVIDENT, not tamper-proof: every part is named by sha256 in the manifest, the manifest answers by its own sha256, and EACH FINDING's signature covers that finding's own record sha. Nothing here prevents a modified copy; everything here makes one detectable by anyone holding it, without the cooperation of this team's Civicsmith."),
    } }, 200);}
