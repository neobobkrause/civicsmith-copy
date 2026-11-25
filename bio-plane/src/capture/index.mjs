/* capture — what capture keeps (layer 3): the evidence store by digest, what capture learns about sources and sites
 * (reachability, site assets, links and the host's chrome, capture sessions, the platform's ceiling, the render
 * allowance), the event queue an undetermined capture raises, a member's upload (R86) and the information grammar
 * (`grammar.mjs`, C-2.7). The acquisition act is `acquisition`'s since T18 (K617): `acquire` and
 * `archiveLookup` hand it this module's store (R73). It writes no bundle: no intake path writes live state.
 * Requirements: build/requirements/capture.md (R8, R15, R21–R29, R37–R40, R43–R46, R55, R57–R59, R63, R64, R68, R69, R73–R79, R81–R96). Extracted from `legacy-store` and
 * `legacy-index` in T4 (T4-4); the reasoning the legacy comments carried is kept beside the code it explains.
 *
 * SHAPE (K61). `captureOf(ctx, opts)` answers the one instance for a Durable Object's storage. It reaches
 * record-core by `recordOf(ctx)` on the same `ctx` (the evidence store, `transact`, `declarePurge`, settings) and
 * membership's `viewerPredicate` (R43) for what a viewer may see, credentials' `attestingKeys` (its R11) for R69, and
 * attestation's `attest` (its R1–R3) for R68's late co-attestation, and holds attestation's instance for the storage
 * (`attestationOf(ctx)`), which the acquisition act reaches as `cap.attestation` to sign an archive-sourced receipt
 * (its R4; R73, K1224). It reads provenance's `register` and `captured_locators` only on their stated read contract (provenance R48). It
 * calls no later module: a later module registers a listener (R44, R55; `on`) or a reader (R78's batch examination,
 * R83's questions a document was captured for; `registerReader`). At its first construction for a
 * storage it registers its grammar (R89) and its figures (R75) with record-core.
 *
 * THE DOORBELL (T42, K2607; T43, N849; T44, N870). The doorbell (the knock, its rate and tallies, the inbox, the pull,
 * the knocker secret, the source fingerprint and its key; once this module's R30–R32, R47–R54, R56, R65–R67, R70–R72,
 * R80, R85) is `doorbell`'s; this module's copy of it was deleted in T43 (N849), its rows (R37) and tables with it, and
 * the last held piece, `sourceFingerprint`, in T44 (N870, K2708). This module answers no source fingerprint and creates,
 * declares and reads no table of `doorbell`'s, `knock_key` included (R87).
 *
 * T50 (T50-8). R94 `recordCapturedFor` records the asks `acquire`'s `for` makes (table `captured_for`); R83's reader is
 * handed them as `asks`, so R77 and R79 name the questions through it and this module names none itself. R95
 * `captureGradeOf` reads one capture's grade (`op=capturegrade`). R73 passes `openCaptures` through with this store. Plan
 * rule 6 (N1116): the member-facing sentences are read by key through `words.mjs`; this file holds keys, not English.
 *
 * T51 fix round 2 (the walk's C5, C12, C14, C26). An upload held in parts is kept whole too (R86); `recordLateAttestations` records an
 * attestation that ended after its capture was answered (R68); a page of held rows is read for the whole page at once and `fields:
 * "picker"` is the cheap read for a list to choose among (R77, R88); `heldAt` judges change on the determined substance digest (R96).
 *
 * T51 fix round 7 (the walk's G79, G78, G75, G73). An upload held in parts is answered once its parts are stored: the buffers of its parts are handed to
 * `keepWhole` (no part is read back), and a keep past `MULTIPART_KEEP_MAX` goes to the plane's ledger at once (R103); a draw of held captures asks the
 * evidence store no more for an object this instance has seen held (R77); `heldAt`'s compared copy names its document's `title` (R96).
 *
 * T51 (T51-21). R77's rows also answer `actor`, `retrieved` and `bytes`; R88's `held_and_vouched` lists the viewer's
 * vouched documents beside the held ones (`standing`, `vouched`); R96 `heldAt` (`op=heldat`) says whether the record
 * already holds an address or a digest and whether the source has since changed. The basis sentences of R88's vouched
 * rows and of R96's `changed` are held here as inline builder diagnostics: the screens draw their own keyed words from
 * the answer's `state` (words.json is the design stream's, and WORD_KEYS is its `reads` list for this module). */
import { isPublicHttpsLocator, createSha256, createResumableSha256, isMachineIdentity, parseFrontmatter } from "../record-grammar/index.mjs";
import { normalizeAddress } from "../subresources.mjs";
import { RENDERED_METHOD } from "../render.mjs";
import { CAPTURE_CHECKS } from "./checks.mjs";
import { say } from "./words.mjs";
import { INFORMATION_GRAMMAR } from "./grammar.mjs";
import { evidenceAbsent } from "./ops.mjs";
import { acquire, archiveLookup, profileOf, profileView, governedFetch, governedCall, INSTALLATION_CHECKS,
         firstHopWho, CAPTURE_MAX, keepWhole, keepPast, servedSubstance, PROFILE_TEXT_MAX, MULTIPART_KEEP_MAX, LARGE_FETCH_BYTES, textTypeOf, profilesAsText } from "../acquisition/index.mjs";
/* R111 (fix round 9; G124, G124b): the figures a body is bounded by are quoted, never written here: the capture ceiling is `acquisition`'s `CAPTURE_MAX` (the
   archive row of `READ_BOUNDS`, `runtime-limits`), the platform's request-body ceiling an entry of `PLATFORM_FIGURES`. */
import { statement as boundStatement, boundOf, wholeReadRow } from "../read-bounds.mjs";
import { PLATFORM_FIGURES } from "../byte-ledger.mjs";
import { verifySshsig, NS_RATIFY, captureAccountStatement } from "../sshsig.mjs";
/* R69 (N530, K1336): the account statement is spelled once, by `signatures` (its R41); re-exported so the names this
   module's users import (`affordances`' tests among them) still resolve, with no spelling of capture's own. */
export { CAPTURE_ACCOUNT_TOKEN, captureAccountStatement } from "../sshsig.mjs";
import { ARCHIVE_SERVICE } from "../tsa.mjs";
export { acquireGradeNote, ACQUIRE_GRADE_NOTE } from "../acquisition/index.mjs";
import { ACQUIRE_GRADE_NOTE } from "../acquisition/index.mjs";
import { unpack, archiveList, memberOf, membersOf, openedAmong, notArchivesAmong, acquisitionOf, openCaptures } from "../acquisition/index.mjs";
import { recordOf, PER_ITEM_MAX } from "../record-core/index.mjs";
import { governorOf } from "../host-governor/index.mjs";
/* R86 (T41-8a): `UPLOAD_VIA`, the route an upload's receipt names, provenance's one spelling (its R63). */
import { provenanceOf, DOORBELL_VIA, UPLOAD_VIA } from "../provenance/index.mjs";
import { attest, attestationOf } from "../attestation/index.mjs";
import { viewerPredicate, GATE_MARK, listenerRefusal, membershipOf } from "../membership/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { CAPTURE_SCHEMA, CAPTURE_DERIVED_SCHEMA, CAPTURE_ADDITIVE_COLUMNS, CAPTURE_RESHAPE,
         CAPTURE_PURGED_TABLES, CAPTURE_EXEMPT_TABLES } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";
export { CAPTURE_SCHEMA } from "./schema.mjs";
export { MONITOR_FREQ, INFORMATION_GRAMMAR, checkInformationExtension } from "./grammar.mjs";

/* A whole-second instant, the record's `…:00Z` spelling. */
const stampSecond = (when = Date.now()) => new Date(when).toISOString().replace(/\.\d+Z$/, "Z");
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const HEX64 = /^[0-9a-f]{64}$/;
const te = new TextEncoder();
const hexOf = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/* R69: a member id from a stamp, so `member:x` and `x` name one member. */
const memberIdOf = (who) => (typeof who === "string" ? who.replace(/^member:/, "") : "");

/* R68: the sentence every late attestation carries: what it proves, and what it does not. */
const lateSentence = (at) => say("capture.text.proves_bytes_existed", { at });
/* R68: the raw replay of an archived locator (`/web/<ts>/` becomes `/web/<ts>id_/`): the bytes as the archive holds
   them, without its overlay, which is what a digest can be compared against. Null for a locator not of that shape. */
const rawReplayOf = (archived) => {
  const m = /^(https:\/\/web\.archive\.org\/web\/)(\d{14})(?:[a-z_]*)\/(.+)$/.exec(String(archived || ""));
  return m ? `${m[1]}${m[2]}id_/${m[3]}` : null;
};
/* R68: a co-archive's replay larger than any capture this surface keeps cannot be the capture, so the comparison reads no more than `CAPTURE_MAX` (R111's figure). */
const REPLAY_MAX = CAPTURE_MAX;

/* N380: the tag a throw of R86's `within` is carried out of the transaction under. */
const WITHIN_FAULT = Symbol("within's fault");
/* R87: `declareTables`' answers: declared, and not yet (its tables not all created), each the same on every call. */
const DECLARED = Object.freeze({ ok: true, module: "capture", declared: true });
const NOT_YET_DECLARED = Object.freeze({ ok: true, module: "capture", declared: false });
const NO_DECLARATION_SEAM = Object.freeze({ ok: false, module: "capture", declared: false, reason: "NO_DECLARATION_SEAM" });

/* R76 (K2455): the routes by which a capture is received, never fetched (provenance R51, R63). */
const RECEIVED_VIAS = Object.freeze([DOORBELL_VIA, UPLOAD_VIA]);
/* R86: the parts an upload is held in, `acquisition` R10's form. */
const UPLOAD_PART = 8 * 1024 * 1024;
/* R109 (fix round 9, G152): the `READ_BOUNDS` row that is the whole-read ceiling of an upload's kind, by what its profile states of it: the row the control-plane's
   inline gate judges a stated document by (`wholeRowOf` of its `kindOf`): a PDF `pdf.bytes`, a CSV `csv.bytes`, a text kind `text.bytes`, every other kind the
   whole-load row `pdf.bytes`. */
const TEXT_TYPE = /^(?:text\/|application\/(?:xhtml\+xml|xml|json)|application\/[a-z0-9.+-]*\+xml)/i;
const wholeReadKind = (profile) => {
  const format = String(profile?.format?.format ?? "").toLowerCase(), declared = String(profile?.source_content_type ?? "").toLowerCase();
  if (format === "pdf" || declared.startsWith("application/pdf")) return "pdf";
  if (format === "csv" || declared.startsWith("text/csv")) return "csv";
  if (TEXT_TYPE.test(declared) || ["text", "tsv", "json", "xml", "html"].includes(format)) return "text";
  return undefined;
};
/** R107: the bytes of a file held in parts that are read as its head when judging it as text: 64 KiB, chosen, not measured. */
const UPLOAD_HEAD = 64 * 1024;
/** R107: `bytes` less a UTF-8 code point cut at their end (a lead byte and too few continuation bytes), so a head that ends inside a
 *  character is still valid UTF-8. Bytes that are not UTF-8 are returned as they are, to be refused by the text rule. */
function withoutCutCodePoint(bytes) {
  for (let back = 1; back <= 3 && back <= bytes.length; back++) {
    const b = bytes[bytes.length - back];
    if ((b & 0xc0) === 0x80) continue;
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? bytes.subarray(0, bytes.length - back) : bytes;
  }
  return bytes;
}
/** R94: the longest question id `recordCapturedFor` records, in characters (`acquisition` R47's bound). */
export const CAPTURED_FOR_QUESTION_MAX = 200;
/** R100: the longest project id `recordSeenIn` records, in characters. */
export const SEEN_IN_PROJECT_MAX = 200;
/** R86: the longest statement of origin, and the longest stated file name, in characters. */
export const UPLOAD_STATEMENT_MAX = 2000;
export const UPLOAD_NAME_MAX = 300;
export const UPLOAD_TYPE_MAX = 255;
/** R113 (fix round 9; G127f): the size of every part but the last of a file sent in parts: 16 MiB, three times R2's own minimum for a part (5 MiB) and far under the
 *  request-body ceiling, so a request carries one part and the object holds one part in memory; chosen, not measured. A scaled figure for a test lowers it (`bounds`). */
export const PARTED_PART_BYTES = 16 * 1024 * 1024;
/** R113: how long an upload sent in parts may stay open before it is aborted and holds nothing: 24 hours from its begin; chosen. The platform's own cleanup of an
 *  incomplete multipart upload (seven days) is the backstop under it. */
export const PARTED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
/** R113: the most expired sessions one begin (or `expireUploads`) aborts; the rest wait for the next. */
export const PARTED_SWEEP_MAX = 20;
/** R86: the one sentence `UPLOAD_WITHIN_FAILED` answers, whatever `within` threw or answered (N409's pattern). */
export const UPLOAD_WITHIN_FAILED_DETAIL =
  "the act run with the upload did not complete, so the upload was rolled back and nothing was written";

/* R86: an upload's bytes as a reader of chunks, whatever form the caller holds them in: a `ReadableStream` (the request's
   raw body), bytes (`Uint8Array`, any typed array or `ArrayBuffer`), or an async iterable of byte chunks. `cancel` stops a
   stream R86 refuses part-way (TOO_LARGE). Null for anything else. */
const uploadReader = (bytes) => {
  const asBytes = (b) => (b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b)
    : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null);
  const whole = asBytes(bytes);
  if (whole) { let done = false; return { read: async () => (done ? { done: true } : (done = true, { done: false, value: whole })), cancel: async () => {} }; }
  if (bytes && typeof bytes.getReader === "function") {
    const r = bytes.getReader();
    return { read: async () => { const c = await r.read(); return c.done ? c : { done: false, value: asBytes(c.value) }; },
             cancel: async () => { try { await r.cancel(); } catch { /* already closed */ } } };
  }
  if (bytes && typeof bytes[Symbol.asyncIterator] === "function") {
    const it = bytes[Symbol.asyncIterator]();
    return { read: async () => { const c = await it.next(); return c.done ? { done: true } : { done: false, value: asBytes(c.value) }; },
             cancel: async () => { try { await it.return?.(); } catch { /* already closed */ } } };
  }
  return null;
};

/* ---- D-98 event queue: module scope because they are pure ----
   The F5 bound lives HERE, at the producer boundary, so a subject is inert before it is stored rather than after
   it is read. Single line, length-capped, control characters stripped: newlines go first because a multi-line
   subject is how a plausible-looking instruction gets room to look like a message rather than a label. */
/* R15 (T35; K1940): `archive-unpack` is the continuation of an automatic unpack past one call (`acquisition` R40),
   drained by the daemon as `op=unpack`; its digest is the archive's. `authority-undetermined` is `tasks`' (D-98). */
export const TASK_KINDS = Object.freeze(["authority-undetermined", "archive-unpack"]);
const boundedSubject = (v) =>
  String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);

/* D-104. Closed on purpose: the value of the reachability table is that it tells kinds of not-getting-the-bytes
   apart, and a free string would let a caller collapse that distinction by accident. */
export const SOURCE_OUTCOMES = Object.freeze(["success", "source_refused", "fetch_failed", "governed"]);

/* R8, R43. CHOSEN, not measured (MEASUREMENTS.md). The third constant is the thread's own judgement: with a single
   failure able to age into eligibility, a document that failed once and was never retried becomes eligible after a
   fortnight, which reads OUR MONITORING NEGLECT as the source being unreachable — D-104's mistake one level up. So
   the age arm requires corroboration too. */
export const REACHABILITY_DEFAULTS = Object.freeze({ failures: 3, days: 14, minForAge: 2 });
/* The names of those settings in record-core, and of the walk's stagger (`acquisition` R19). */
export const REACHABILITY_SETTINGS = Object.freeze({ failures: "reachability_consecutive_failures",
                                                     days: "reachability_stale_days", minForAge: "reachability_min_failures_for_age" });
export const SUBRESOURCE_STAGGER_SETTING = "subresource_stagger_ms";

/* R23: a ceiling only ever learned downward would leave an upgraded account at the old caps forever. */
const PROBE_EVERY = 25;

/* N90: the one bound this module's reads publish (R24–R28, R77, R84). CHOSEN, not measured: a page a member reads in one
   answer, never a size the record grows to. Every read over-fetches one row so `truncated` is a fact, not a guess. */
export const READ_LIMIT = Object.freeze({ default: 200, max: 1000 });
const limitOf = (asked) => {
  const n = Math.floor(Number(asked));
  return asked != null && asked !== "" && Number.isFinite(n) && n > 0 ? Math.min(READ_LIMIT.max, n) : READ_LIMIT.default;
};
/* A paged read's `next`: the ordering key of the last row listed, opaque to the caller (base64url of its JSON), read
   back by `keyOf`, which answers null for a cursor this module did not write (the read then refuses BAD_CURSOR). */
const cursorOf = (parts) => btoa(String.fromCharCode(...te.encode(JSON.stringify(parts))))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const keyOf = (cursor, n) => {
  try {
    const bytes = Uint8Array.from(atob(String(cursor).replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
    const k = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(k) && k.length === n && k.every((x) => typeof x === "string") ? k : null;
  } catch { return null; }
};
const badCursor = () => ({ ok: false, reason: "BAD_CURSOR", detail: "`after` is not a cursor this read answered as `next`" });
/* R45 (T36-41, N740): an event's place in the queue's order, `enqueued`, digest, `kind`, tagged so no other read's cursor
   reads as one; `taskCursorPlace` answers null for anything else, and the read then starts at the head. */
const TASK_CURSOR_TAG = "task-event";
const taskCursorOf = (enqueued, captureSha, kind) => cursorOf([TASK_CURSOR_TAG, enqueued, captureSha, kind]);
/* R104: a fetch's place in `fetchesDone`'s order, tagged so no other read's cursor reads as one. */
const FETCH_CURSOR_TAG = "fetch-done";
const taskCursorPlace = (after) => {
  const k = typeof after === "string" && after ? keyOf(after, 4) : null;
  return k && k[0] === TASK_CURSOR_TAG ? { enqueued: k[1], captureSha: k[2], kind: k[3] } : null;
};

/* The events a later module may listen to (R44, R55), and the observation a reuse verdict maps to (the
   observation log's, its Suggestion). */
export const CAPTURE_EVENTS = Object.freeze(["source-outcome", "task", "compute", "observation"]);

/* The readers a later module may register, once at start, each taking one registration whoever makes it: the
   batch-release examination of one document (R78; `ratification` R34) and the questions a document was captured for
   (R83; `capture-requests` R48; T50: handed R94's asks beside). The litigation hold's reader is `doorbell`'s (its R3; T43, N849). */
export const CAPTURE_READERS = Object.freeze(["batch-examination", "captured-for"]);

/* R77, R79 (DEC-141 (1)): the one sentence a row carries when a question the viewer may not see is among those its
   document was captured for, or waits on it. It names no question, no asker and no count. */
export const WITHHELD_QUESTION = say("screen.held.withheld");

/* R79, R81: the longest reason a member may give, in characters. */
export const REASON_MAX = 2000;
/* R79, R81: a reason is a string with something other than white space in it, at most REASON_MAX characters. */
const reasonGiven = (r) => typeof r === "string" && r.trim() !== "" && [...r].length <= REASON_MAX;

/* R77: the directions `heldCaptures` sorts in. */
export const SORT_DIRS = Object.freeze(["asc", "desc"]);
/* R77: the orders `heldCaptures` sorts by. */
export const HELD_SORTS = Object.freeze(["age", "source", "project"]);
/* R88 (N969): the lists `heldCaptures` answers: the held documents (R77), or the ones set aside (R79), which a member
   restores from (R81); T51: `held_and_vouched`, the held ones with the documents a member has vouched for. */
export const HELD_STATES = Object.freeze(["held", "set_aside", "held_and_vouched"]);
/* R77 (T51; C14): the rows `heldCaptures` answers: `full` (R77's fields) or `picker`, the cheap read for a screen that lists documents
   to choose among: the document, its title, its project, its source, when it was collected, its capture's digest and actor, whether the
   evidence store holds it whole, and its standing, and nothing that asks the examination, the questions, the archives or a grade. */
export const HELD_FIELDS = Object.freeze(["full", "picker"]);
/* R77 (DEC-167 (8); K1881, BOB's): the most held files an archive's row carries; the rest are read through
   `acquisition.archiveList`. */
export const HELD_FILES_IN_ROW = 50;
/** R77 (fix round 4; P10): the most documents `bundle_ids` names in one read: the ones a screen draws, whose heavy fields it asks for. */
export const HELD_IDS_MAX = 50;
/** R105 (fix round 6; G2): the most of a source's body a `check` reads, in bytes: 8 MiB, the size past which `acquisition` hands a fetch to
 *  the plane. A larger body is not read: the look says so (`large`) and decides nothing. */
export const HELD_AT_CHECK_MAX = LARGE_FETCH_BYTES;
/** R96: the most captures at one address `heldAt` counts; `truncated` says when more lie past. */
export const HELD_AT_VERSIONS_MAX = 200;
/* R91 (T49; N1080; M-T49-3): the one wait a page of held captures gives its documents' answers, in milliseconds: R78's
   examination of each document the page shows and the archive grouping (DEC-167 (8)) of each row, asked together for
   the whole page. CHOSEN, not measured, like `file-safety`'s `SCAN_WAIT_MS` and `acquisition`'s `REPUTATION_TIMEOUT_MS`
   (both 5 s, the waits on another module's answer); recorded by BOB. An answer not given within it reads undetermined. */
export const HELD_PAGE_WAIT_MS = 5000;
/* R91: how many rows of a page are answered at once. Work is begun only while the page's wait has not run out, so a page
   that cannot be answered in time asks no more of the evidence store than it can wait for. */
const HELD_PAGE_LANES = 8;
/** R77 (fix round 7; G78): the most digests this instance remembers as proven held, for a draw not to ask the evidence store again; CHOSEN, not
 *  measured: a digest is 64 characters, so the set is under half a megabyte; past it the set is emptied and fills again. */
export const HELD_PROVEN_MAX = 5000;
/* R88 (T51): a vouched row is not asked of R78's examination, so its eligibility reads undetermined with this basis. A
   builder's diagnostic: screens draw `standing` and `vouched`, not this sentence. */
const VOUCHED_BASIS = localize("capture.index.vouched_basis", "this document is already vouched for, so whether it could be vouched for in a batch is not asked");
/* R88 (T51): the state a vouched document is at (released through `ratification`). */
const VOUCHED_STATE = "verified";
/* R91: what a wait answers when it ran out first. */
const TOO_LATE = Symbol(say("capture.symbol.page_wait_ran"));
/* R91: the answers of an examination that ran out of time, so a file beside an archive can say so (R77's file keeps its shape
   otherwise); held by identity, never carried into an answer. */
const RAN_OUT = new WeakSet();

/* R77 (T47; N979): the capture the register files under a document (provenance R48's read contract), the one first
   registered, ties by digest. `registered` is compared as an instant (a whole-second and a millisecond spelling of one
   second order alike), never as text. */
const REGISTER_FIRST = `SELECT capture_sha FROM register WHERE bundle_id = ? ORDER BY julianday(registered), registered, capture_sha LIMIT 1`;

const instances = new WeakMap();
/* R58 (N122, K155): for each instance, which of its options a caller supplied, so a later caller's option is judged
   against the right thing: one taken by default is adopted, one a caller gave must be the same. */
const supplied = new WeakMap();

/* Two `env`s are the same when they carry the same bindings, each the same value: the object a module was handed
   need not be the object another was handed for the one Durable Object. */
const sameEnv = (a, b) => {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k]);
};

/** K61, R58: the one Capture for this object's storage. `opts`: `env` (the object's bindings: the evidence bucket
 *  for the evidence store, the renderer, the instance's name; `doorbell` reads it from here, its R25), `governor` (host-governor's, `governorOf(ctx)` by default),
 *  `record` (`recordOf(ctx)`), `provenance` (`provenanceOf(ctx)`), `attestation` (`attestationOf(ctx)`, K1224),
 *  `acquisition` (`acquisitionOf(ctx)`, its archive records, T35) and
 *  `ownHosts` (the group's own hosts, T35, R73; none by default, adopted from the first caller that names them, as
 *  `governor`), and `reputation` (a reader of the reputation tool, acquisition R44) and `fileScanner` (the
 *  `FILE_SCANNER` binding) (T37, R73; each adopted from the first caller that supplies it, a later one ignored, never
 *  compared: a function has no value to compare), and `now` (R90: this module's clock, a function answering epoch
 *  milliseconds, `Date.now` by default; adopted and compared as `env` and `governor` are, a later caller's `now` that is
 *  another function refused). A later call's option is never silently
 *  dropped (N122: a first caller without `env` stripped the plane's renderer from every later one): an `env` or
 *  `governor` the instance took by default is adopted from the first later caller that supplies it, and one that
 *  differs from what an earlier caller supplied throws, naming the option. A test may pass its own. */
export function captureOf(ctx, opts = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let c = instances.get(storage);
  if (!c) {
    const record = opts.record ?? recordOf(ctx), provenance = opts.provenance ?? provenanceOf(ctx);
    c = new Capture(storage, { ...opts, record, provenance,
                               governor: opts.governor ?? governorOf(ctx, { env: opts.env ?? null }),
                               /* attestation's own instance for this host, over the record and provenance capture holds */
                               attestation: opts.attestation ?? attestationOf(ctx, { record, provenance }),
                               /* acquisition's own instance for this host (its archive records, R38–R41; B3, K1953),
                                  made when first reached */
                               acquisition: opts.acquisition ?? null, acquisitionHost: opts.acquisition ? null : ctx });
    instances.set(storage, c);
    supplied.set(c, new Set(["env", "governor", "record", "provenance", "attestation", "acquisition", "ownHosts", "now"]
      .filter((k) => k === "now" ? typeof opts.now === "function" : opts[k] != null)));
    registerGrammar(c.core);
    registerFigures(c);
    return c;
  }
  const given = supplied.get(c);
  const refuse = (name) => {
    throw new Error(`captureOf: a caller supplied a different \`${name}\` for a storage whose capture already holds `
                  + `another one a caller gave; capture refuses it rather than run against either silently (R58)`);
  };
  /* Every option judged before any is adopted, so a refused call changes nothing. */
  if (opts.env != null && given.has("env") && !sameEnv(c.env, opts.env)) refuse("env");
  if (opts.governor != null && given.has("governor") && c.governor !== opts.governor) refuse("governor");
  if (opts.ownHosts != null && given.has("ownHosts") && !Capture.sameHosts(c.ownHosts, opts.ownHosts)) refuse("ownHosts");
  /* R90: the clock is a function, so it is the same only when it is the same function. */
  if (typeof opts.now === "function" && given.has("now") && c.clock !== opts.now) refuse("now");
  /* R58 (T43; N863, K2672): an option is compared only when the caller supplies it, so a call supplying none reaches no
     other module's instance: `acquisition`'s, made when first reached (its tables with it), is read only to compare. */
  for (const [name, held] of [["record", () => c.core], ["provenance", () => c.provenance], ["attestation", () => c.attestation],
                              ["acquisition", () => c.acquisition]])
    if (opts[name] != null && opts[name] !== held()) refuse(name);
  if (opts.env != null && !given.has("env")) { c.env = opts.env; given.add("env"); }
  if (opts.governor != null && !given.has("governor")) { c.governor = opts.governor; given.add("governor"); }
  if (opts.ownHosts != null && !given.has("ownHosts")) { c.ownHosts = Capture.hostsOf(opts.ownHosts); given.add("ownHosts"); }
  if (typeof opts.now === "function" && !given.has("now")) { c.clock = opts.now; c.clockHanded = true; given.add("now"); }
  c.adoptReputation(opts);
  return c;
}

/** R89 (C-2.7; K585 (3)): the information grammar, registered with record-core's seam (its R67) once per storage, when
 *  the instance is first made, so the audit and the gate run it in C-2.7's slot. Another module's grammar may claim the
 *  same slot (record-core R67, K766: their arms then run there in module order), so that is no refusal. A record with
 *  no seam (a test's stand-in) is left alone; a refusal is a defect of the wiring (capture registering twice, or a
 *  malformed entry) and throws, as the purge declaration's does, rather than leave the grammar silently unrun. */
function registerGrammar(record) {
  if (!record || typeof record.registerGrammar !== "function") return;
  const answer = record.registerGrammar("capture", INFORMATION_GRAMMAR);
  if (answer && answer.ok === false)
    throw new Error(`capture: record-core refused the information grammar: ${answer.reason}${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
}

/** R75 (`build/extraction/legacy-store.md` §4.2 (2)): this module's figures for `op=stats` and purge's proof, registered
 *  with record-core's `registerCounts` (its R63) once per storage, when the instance is first made. A record with no
 *  seam (a test's stand-in) is left alone; a refusal (another module reporting one of these figures, or capture
 *  registering twice) is a defect of the wiring and throws, as the grammar's does. */
function registerFigures(c) {
  const record = c.core;
  if (!record || typeof record.registerCounts !== "function") return;
  const answer = record.registerCounts("capture", [...Capture.COUNT_KEYS], (hid) => c.counts(hid));
  if (answer && answer.ok === false)
    throw new Error(`capture: record-core refused its figures: ${answer.reason}${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
}

/* R114 (G180): a row's snapshot taken up by record-grammar's stream, which throws on a state it did not write; that answers null, so the caller
   says the digest is lost (R113's UPLOAD_LOST) rather than hashing on from a wrong state. */
function resumedOf(state) {
  try { return createResumableSha256(state); } catch { return null; }
}

export class Capture {
  #sql; #storage; #listeners = new Map(); #readers = new Map(); #declared = false; #acquisition = null; #acquisitionHost = null;
  #reputationReader = null; #fileScanner = null; #hasWhole = null; #provenHeld = new Set();
  /* R113: the live state of the uploads sent in parts that this instance is receiving: the hasher of the bytes so far, in order, and the part it expects next.
     It is a cache of what the upload's row keeps (`hash_state`, G173): an instance taken out of memory between two parts takes it up again from the row. */
  #parted = new Map();

  constructor(storage, { record, env = {}, governor = null, provenance = null, attestation = null, credentials = null,
                         acquisition = null, acquisitionHost = null, ownHosts = [], reputation = null, fileScanner = null,
                         now = null } = {}) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.core = record;
    this.env = env || {};
    this.governor = governor;
    /* R90 (N983): this module's clock, a function answering epoch milliseconds, `Date.now` by default; `captureOf` adopts a
       later caller's (R58). An act that must be judged at the server's instant (`op=sourcereach`) reads it, never a
       request's. */
    this.clock = typeof now === "function" ? now : Date.now;
    this.clockHanded = typeof now === "function";
    /* R115: the store's environment as the ops map was handed it, the source of `BIO_NOW_MS` when no clock was handed. */
    this.clockEnv = null;
    this.provenance = provenance;
    /* R73 (K1224): attestation's instance, which the acquisition act reaches as `cap.attestation` (its R4's
       `signReceipt`). */
    this.attestation = attestation;
    this.credentials = credentials;
    /* R73 (T35; B3, K1953): acquisition's instance for this storage, which keeps its archive records (`acquisition`
       R38–R41) and which the acquisition act reaches as `cap.acquisition`, as it reaches `cap.attestation`. */
    this.#acquisition = acquisition;
    this.#acquisitionHost = acquisitionHost;
    /* R73 (T35; F16): the group's own hosts (the copy's own and every fleet member's), built by the composition root
       (`plane`), read off this store by `acquisition` R42 and `capture-sources` R55, R65. */
    this.ownHosts = Capture.hostsOf(ownHosts);
    /* R73 (T37): the reputation reader as acquisition (its R44) reads it off the store handed in: a function that calls
       the reader at each call and answers what it answers (a promise, a throw, any value: acquisition judges it), so
       the plane's per-call reader (`plane` R29) reaches every acquisition, never a value read once; null with none
       handed in. A reader handed in as a value (a tool spec, as acquisition R44 also takes it) is answered as it is.
       An own arrow, so it answers the same when read off the store and called detached. */
    this.reputation = () => {
      const reader = this.#reputationReader;
      return typeof reader === "function" ? reader() : reader ?? null;
    };
    this.adoptReputation({ reputation, fileScanner });
  }

  /** R73 (T37; N774, K2155): the reputation reader and the `FILE_SCANNER` binding, each adopted from the first caller
   *  that supplies it; a later one is ignored, never compared (a function has no value to compare) and never refused,
   *  so R58 stays as it is for `env`. */
  adoptReputation({ reputation = null, fileScanner = null } = {}) {
    if (reputation != null && this.#reputationReader == null) this.#reputationReader = reputation;
    if (fileScanner != null && this.#fileScanner == null) this.#fileScanner = fileScanner;
  }

  /** R73: the `FILE_SCANNER` binding handed in, which acquisition (its R44) reaches the scanner through; null with none. */
  get fileScanner() { return this.#fileScanner; }


  /** R73 (T35): acquisition's instance, the one given, else `acquisitionOf` over this host's storage made when first
   *  reached (a record without record-core's table seam, a test's stand-in, reads as none: the archive acts then answer
   *  acquisition's `ARCHIVE_RECORD_UNAVAILABLE`). */
  get acquisition() {
    if (!this.#acquisition && this.#acquisitionHost) {
      const host = this.#acquisitionHost;
      this.#acquisitionHost = null;
      try { this.#acquisition = acquisitionOf(host, { record: this.core, provenance: this.provenance }); }
      catch { this.#acquisition = null; }
    }
    return this.#acquisition;
  }
  set acquisition(a) { this.#acquisition = a; this.#acquisitionHost = null; }

  /* R73: a list of host names, lower-cased, each once; anything else reads as none. */
  static hostsOf(list) {
    return Object.freeze([...new Set((Array.isArray(list) ? list : []).filter((h) => typeof h === "string" && h.trim())
      .map((h) => h.trim().toLowerCase()))]);
  }
  static sameHosts(a, b) {
    const x = Capture.hostsOf(a), y = Capture.hostsOf(b);
    return x.length === y.length && x.every((h) => y.includes(h));
  }

  /* credentials' instance for this storage (R69's attesting keys, its R11), reached when first needed. */
  #credentials() {
    if (!this.credentials) this.credentials = credentialsOf({ storage: this.#storage }, { record: this.core });
    return this.credentials;
  }

  /* membership's instance for this storage (R101's project fence, its `projectAuthority`), reached when first needed. */
  #membership() { return membershipOf({ storage: this.#storage }, { record: this.core }); }

  /* R115 (K5132; R90): this module's clock read once, epoch milliseconds: the function `captureOf` was handed as `now`, else the
     store's environment's `BIO_NOW_MS` (as the ops map was handed it, else as the instance was built), else the wall clock.
     An answer that is not a finite number (a clock at fault, a binding that is no number) reads the next. A duration measured
     for a reply stays on the wall clock. */
  #instant() {
    if (this.clockHanded || this.clock !== Date.now) {
      let t;
      try { t = Number(this.clock()); } catch { t = NaN; }
      if (Number.isFinite(t)) return t;
    }
    for (const env of [this.clockEnv, this.env]) {
      const raw = env ? env.BIO_NOW_MS : undefined;
      if (raw === undefined || raw === null || raw === "") continue;
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
    return Date.now();
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  /* N418 (K650): every write this module makes runs through record-core's `transact` (its R32): one transaction, a
     savepoint inside a caller's, rolled back whole by a throw or an `ok: false` answer, and record-core's `afterCommit`
     (its R66) holds what a listener asks inside it until the outermost commit. Only a Capture built with no record (a
     bare storage) falls back to the storage's own `transactionSync`. `fn` is synchronous. */
  #tx(fn) {
    return this.core && typeof this.core.transact === "function" ? this.core.transact(fn) : this.#storage.transactionSync(fn);
  }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #cols(t) { return this.#rows(`PRAGMA table_info(${t})`).map((r) => r.name); }

  /* ---- boot (layers.md ruling 3) ---- */

  /** This module's tables, at every boot, idempotent: a derived table whose key changed shape is dropped first
   *  (so the CREATE INDEX below never meets the old table, which would throw inside blockConcurrencyWhile and
   *  brick the Durable Object); the additive columns an older store lacks are added; every table and index is
   *  created if absent; the tables are declared to record-core's purge (R87, R74's declarations). */
  migrate() {
    for (const [table, needed] of CAPTURE_RESHAPE) {
      const cols = this.#cols(table);
      if (cols.length && !cols.includes(needed)) this.#sql.exec(`DROP TABLE ${table}`);
    }
    for (const [table, column, decl] of CAPTURE_ADDITIVE_COLUMNS) {
      const have = this.#cols(table);
      if (have.length && !have.includes(column)) this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
    for (const text of [CAPTURE_SCHEMA, CAPTURE_DERIVED_SCHEMA]) {
      const bare = text.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
      for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    }
    this.declareTables();
  }

  /** R87 (K2629; T43, N864, K2680): declares capture's tables to record-core (R74's purge declarations: the purged and
   *  the exempt) once per storage, and only when every one of them exists in the storage, as after `migrate`. Before
   *  that it declares none and answers `NOT_YET_DECLARED`, so a caller that reaches it before capture's migrate (a host
   *  building another module first) declares nothing of capture's uncreated tables. Once declared it answers the same,
   *  `DECLARED`, on this and every later call, never throwing for a table it already holds: a second call, and a second
   *  instance over the same record (record-core holds every one of these tables as `capture`'s), answer it. A record
   *  with no declaration seam answers `NO_DECLARATION_SEAM`, every time. Only a refusal for a table another module
   *  holds, or a malformed declaration, is a wiring fault and throws. */
  declareTables() {
    if (this.#declared) return DECLARED;
    if (!this.core || typeof this.core.declarePurge !== "function") return NO_DECLARATION_SEAM;
    const mine = [...CAPTURE_PURGED_TABLES, ...CAPTURE_EXEMPT_TABLES];
    let present;
    try {
      present = new Set(this.#rows(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (SELECT value FROM json_each(?))`,
                                   JSON.stringify(mine)).map((r) => r.name));
    } catch { present = new Set(); }
    if (!mine.every((t) => present.has(t))) return NOT_YET_DECLARED;
    let held = [];
    try { held = typeof this.core.declaredTables === "function" ? this.core.declaredTables() : []; } catch { held = []; }
    const byCapture = new Set(held.filter((d) => d && d.module === "capture").map((d) => d.name));
    if (!mine.every((t) => byCapture.has(t))) {
      const answer = this.core.declarePurge("capture", CAPTURE_PURGED_TABLES.map((name) => ({ name, keys: [] })),
                                            { exempt: CAPTURE_EXEMPT_TABLES });
      if (answer && answer.ok === false)
        throw new Error(`capture: record-core refused its purge declaration: ${answer.reason} (${answer.table})`);
    }
    this.#declared = true;
    return DECLARED;
  }

  /* ---- listeners (R44, R55) ---- */

  /** A later module registers, once at start, a listener for one of `CAPTURE_EVENTS`. Listeners are called after
   *  this module's own write, in the order they registered (the host registers the modules in their total order),
   *  and a listener's failure never fails the act; its outcome is named. A malformed or second registration is
   *  refused by membership's `listenerRefusal` (its R81, N202: `LISTENER_MALFORMED` and `LISTENER_DECLARED` are
   *  minted at that one site), the slot's `event` beside its fields. */
  on(event, module, fn) {
    if (!CAPTURE_EVENTS.includes(event)) return { ok: false, reason: "UNKNOWN_EVENT", event };
    const list = this.#listeners.get(event) || [];
    const refused = listenerRefusal(list, module, fn, { event });
    if (refused) return refused;
    list.push({ module, fn });
    this.#listeners.set(event, list);
    return { ok: true, event, module };
  }

  async #emit(event, payload) {
    const out = [];
    for (const { module, fn } of this.#listeners.get(event) || []) {
      try { out.push({ module, ok: true, result: await fn(payload) }); }
      catch (e) { out.push({ module, ok: false, error: String(e && e.message || e).slice(0, 200) }); }
    }
    return out;
  }

  /** Hands `payload` to the listeners of `event` (the acquisition act calls it for R55's measurement). */
  emit(event, payload) { return this.#emit(event, payload); }

  /** R78, R83: a later module registers, once at start, the reader of one of `CAPTURE_READERS`. Each slot takes one
   *  registration whoever makes it; a second, or a malformed one, is membership's `listenerRefusal` (its R81). */
  registerReader(slot, module, fn) {
    if (!CAPTURE_READERS.includes(slot)) return { ok: false, reason: "UNKNOWN_READER", slot };
    const refused = listenerRefusal(this.#readers.get(slot) || null, module, fn, { slot });
    if (refused) return refused;
    this.#readers.set(slot, { module, fn });
    return { ok: true, slot, module };
  }

  /* ---- the acquisition act, `acquisition`'s (K617) ---- */

  /** R73: `acquisition`'s `acquire` (its R1–R23) with this module's store handed in; answers `{status, body}`. */
  acquire(body, opts) { return acquire(this, body, opts); }

  /** R106 (fix round 6, G32; `acquisition` R22): the digest of the copy a plain fetch of `body.locator` may be made conditional on: the
   *  newest capture of that address the viewer may see (R96's compared copy) when it came from a plain, direct fetch of that very
   *  address, recorded as fetched and not rendered; else null, and the fetch runs as it always did. A body that asks for more than the
   *  plain document (`render`, `via`, `continue`, `file`, `subresources`, an archive `address`) is never conditional, and neither is an
   *  address that is no public locator or a viewer who sees no copy. A read, never a fetch; never throws. */
  heldCopyToCompare(body, viewer = "") {
    try {
      if (!body || typeof body.locator !== "string" || !isPublicHttpsLocator(body.locator)) return null;
      for (const k of ["render", "via", "continue", "file", "subresources", "address"]) if (body[k]) return null;
      const found = this.#heldAtRead({ address: body.locator, sha256: null, viewer });
      if (!found || found.receipt.via !== "direct" || !found.receipt.plain_address || found.kind !== "plain") return null;
      return found.copy.sha256;
    } catch { return null; }
  }

  /** R73: `acquisition`'s `archiveLookup` (its R3), likewise. */
  archiveLookup(args) { return archiveLookup(this, args); }

  /** R73 (T35; `acquisition` R38): `acquisition`'s `unpack` with this module's store handed in. */
  unpack(args) { return unpack(this, args); }

  /** R73, R77 (T35; `acquisition` R41): `acquisition`'s `archiveList`, likewise. */
  archiveList(args) { return archiveList(this, args); }

  /** R73, R77 (T35; `acquisition` R41): `acquisition`'s `memberOf`, likewise: every archive a capture was filed from or
   *  found in, `[]` for none. */
  memberOf(captureSha) { return memberOf(this, captureSha); }

  /** R73 (T50; N1094; `acquisition` R46): `acquisition`'s `openCaptures` (a member's open captures, `{by, now}`), likewise,
   *  over this module's `liveCaptureSessions` (R46); an `args` with no `now` is read at this module's clock (R90). */
  openCaptures(args) { return openCaptures(this, { ...(args ?? {}), now: args?.now ?? this.#instant() }); }

  #emitSync(event, payload) {
    const out = [];
    for (const { module, fn } of this.#listeners.get(event) || []) {
      try { out.push({ module, ok: true, result: fn(payload) }); }
      catch (e) { out.push({ module, ok: false, error: String(e && e.message || e).slice(0, 200) }); }
    }
    return out;
  }

  /* ---- D-701: what a viewer may see of a capture ---- */

  /** The sight predicate (membership R43) over a column that holds a CAPTURE sha, as a WHERE term. `register`
   *  files a capture in ONE bundle, so the capture is seen exactly when that bundle is. A capture filed in NO
   *  bundle (acquired, never promoted) names no bundle and so discloses none. An absent or unrecognised viewer
   *  sees nothing (fail closed); a machine credential is not filtered. `viewer === undefined` is an internal
   *  caller, not asked. The column must be qualified: a bare name binds inside the subquery and passes all. */
  #captureGate(col, viewer) {
    if (viewer === undefined) return { sql: "1=1", args: [] };
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
      throw new Error(`capture gate needs a qualified column (got ${col})`);
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (gate.scope === "DENY") return { sql: gate.sql, args: [] };
    return { sql: `${GATE_MARK} NOT EXISTS (SELECT 1 FROM register reg JOIN bundles b ON b.bundle_id = reg.bundle_id
                     WHERE reg.capture_sha = ${col} AND NOT (${gate.sql}))`, args: gate.args };
  }

  /* N388: whether a viewer may see one capture, by `#captureGate` over the capture's own digest. */
  #captureSeen(sha, viewer) {
    if (viewer === undefined) return true;
    const gate = this.#captureGate("c.capture_sha", viewer);
    return !!this.#one(`SELECT 1 AS x FROM (SELECT ? AS capture_sha) c WHERE (${gate.sql})`, sha, ...gate.args);
  }

  /* R77: the required-argument refusal for an argument this module reads that names nothing it knows (the control
     plane's C-61 shape, answered from the store as `monitoring`'s store-side refusals are). */
  static #badArgument(op, argument, shape, given) {
    return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, status: 400,
             error: localize("capture.index.argument_must_be_one_of", "{argument} must be one of {shape}; {stringify} is not", { argument: String(argument), shape: String(shape), stringify: String(JSON.stringify(String(given)).slice(0, 80)) }),
             detail: localize("capture.index.op_op_needs_argument_in", "op={op} needs '{argument}' in the shape {shape}, and this request carried none the operation could use. Nothing was read.", { op: String(op), argument: String(argument), shape: String(shape) }) };
  }

  /* R86: the required-argument refusal for an argument given in a shape the act cannot use. */
  static #missingArgument(op, argument, shape, given) {
    return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, status: 400,
             error: localize("capture.index.argument_must_be_shape_stringify", "{argument} must be {shape}; {stringify} is not", { argument: String(argument), shape: String(shape), stringify: String(JSON.stringify(String(given)).slice(0, 80)) }),
             detail: localize("capture.index.op_op_needs_argument_in_2", "op={op} needs '{argument}' in the shape {shape}, and this request carried none the operation could use. Nothing was written.", { op: String(op), argument: String(argument), shape: String(shape) }) };
  }

  /* N380 (R86): the caller's act, called inside the act's own transaction with its own copy of the document. Its
     throw is tagged so a fault of the act's own still throws; an answer that is not synchronous (a promise would outlive
     the transaction, its outcome dropped with it) is tagged likewise. Answers what `within` answered. */
  static #callWithin(within, document) {
    let w;
    try { w = within(structuredClone(document)); } catch { throw { [WITHIN_FAULT]: true }; }
    if (w && typeof w.then === "function") {
      Promise.resolve(w).catch(() => {});
      throw { [WITHIN_FAULT]: true };
    }
    return w;
  }

  /* ==================================================================== *
   * A file a member holds (R86; N821, K2425 (4))
   * ==================================================================== */

  /** R86: a signed-in member brings into the record a file she holds, which no one fetched. Refused in order, each
   *  writing nothing: the member-session fence (`by` absent, not a string, blank, naming no member (`member:` alone)
   *  or a machine identity: `MEMBER_SESSION_REQUIRED`, 403); `UPLOAD_NO_STATEMENT` (C-118.10); a `name` that is not a
   *  string or is over 300 characters (the required-argument refusal naming it); no evidence store (the installation's
   *  storage-absent refusal, `acquisition`'s C-68.1); then `NO_BODY`, `EMPTY` and
   *  `TOO_LARGE` (the stream cancelled) as `acquisition` R10 names them. The parts a refused stream already stored stay
   *  content-addressed and named by no row, receipt or document, as R10's do.
   *
   *  Otherwise, in one act: the bytes are hashed as they arrive and held under their own digest in parts of 8 MiB; one
   *  acquisition receipt is written (`via: "upload"`, address `upload:<sha256>`, with `by` and her statement, which
   *  provenance holds with it, K2449, so a second sighting keeps its own uploader's words); `by` is recorded as the capture's
   *  actor (R69); and the answer carries the provenance document (`#uploadedDocument`), graded received, never fetched
   *  (`provenance` R63). Bytes the record already holds (`provenance.registerHolds` answers them registered or acquired)
   *  answer `existed: true` with no document, the receipt written as a second
   *  sighting, and `within` not called; bytes only a receipt names (the register files them under no document, an interrupted
   *  upload) answer `existed: true` the same way, with the document as a new upload's (T51 fix round 2). `within` (N380's seam, `store-door` R7): called inside the upload's own
   *  transaction after the receipt and the actor; its `{ok: false}` rolls the upload back and is the answer; a throw or a promise rolls it back as
   *  `UPLOAD_WITHIN_FAILED`. It writes no bundle. */
  async uploadCapture(args = {}) {
    const tally = Capture.#tally(args && args.ledger);
    try { return await this.#upload(args ?? {}, tally); } finally { tally.end(); }
  }

  /* R86, R113: the refusals that come before any byte is looked at, in their order: the member-session fence, the statement of origin (C-118.10), the name
     and the declared type. The one place they are made, for the upload in one request and the upload in parts. Null when none applies. */
  static #fence({ by, statement, name, type, op }) {
    if (typeof by !== "string" || !memberIdOf(by).trim() || isMachineIdentity(by))
      return { ok: false, reason: "MEMBER_SESSION_REQUIRED", status: 403,
               detail: localize("capture.index.refusal_member_brings_file", "a file is brought into the record by a signed-in member, whose stamp names them; nothing was written") };
    /* DEC-49 REGION is-upload-stated */
    if (typeof statement !== "string" || !statement.trim() || [...statement].length > UPLOAD_STATEMENT_MAX) {
      const row = CAPTURE_CHECKS.UPLOAD_NO_STATEMENT;
      return { ok: false, reason: "UPLOAD_NO_STATEMENT", code: "UPLOAD_NO_STATEMENT", check: row.check, translation: row.translation,
               status: 400, maxChars: UPLOAD_STATEMENT_MAX };
    }
    /* END DEC-49 REGION is-upload-stated */
    if (name != null && (typeof name !== "string" || [...name].length > UPLOAD_NAME_MAX))
      return Capture.#missingArgument(op, "name", localize("capture.index.shape_string_max", "a string of at most {max} characters", { max: String(UPLOAD_NAME_MAX) }), name);
    /* R92: the media type the member's browser declared, a string of at most 255 characters when given. */
    if (type != null && (typeof type !== "string" || [...type].length > UPLOAD_TYPE_MAX))
      return Capture.#missingArgument(op, "type", localize("capture.index.shape_string_max", "a string of at most {max} characters", { max: String(UPLOAD_TYPE_MAX) }), type);
    return null;
  }

  /* R86: no evidence store is bound (the installation's storage-absent refusal, `acquisition`'s C-68.1). */
  static #storageAbsent() {
    const row = INSTALLATION_CHECKS.EVIDENCE_STORAGE_NOT_CONFIGURED;
    return { ok: false, reason: "EVIDENCE_STORAGE_NOT_CONFIGURED", code: "EVIDENCE_STORAGE_NOT_CONFIGURED", check: row.check,
             translation: row.translation, status: 503,
             detail: localize("capture.index.say_so_the_file_cannot", "{say}, so the file cannot be held under its own digest; nothing was written", { say: String(say("capture.response.group_civicsmith_evidence")) }) };
  }

  /* R111: the byte ledger as one upload counts what it holds (`runtime-limits`' `byteLedger`: `hold(n, tag)`, `release(n, tag)`); no ledger handed, or one that
     cannot count, is no fault of the upload's. `end` releases whatever the call still holds, on every path out of it. */
  static #tally(ledger) {
    const on = !!ledger && typeof ledger.hold === "function" && typeof ledger.release === "function";
    let held = 0;
    const t = {
      hold(n) { if (on && n > 0) { try { ledger.hold(n, "upload"); held += n; } catch { /* a ledger that cannot count */ } } },
      release(n) { if (on && n > 0) { const k = Math.min(n, held); try { ledger.release(k, "upload"); held -= k; } catch { /* a ledger that cannot count */ } } },
      end() { t.release(held); },
    };
    return t;
  }

  /* R109 (fix round 9, G152): the evidence store as `profileOf` meets it for a file the upload holds whole: `get` of the file's digest answers the held bytes (a
     range of them for a ranged read), every other call is the store's own. So the profile of a one-part upload reads the object back from nowhere. */
  static #holding(ev, sha, bytes) {
    const slice = (b) => (b.byteOffset === 0 && b.length === b.buffer.byteLength ? b.buffer : b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
    const get = async (k, o) => {
      if (k !== sha) return ev.get(k, o);
      const b = o && o.range ? bytes.subarray(o.range.offset, o.range.offset + o.range.length) : bytes;
      return { key: k, size: bytes.length, body: b, arrayBuffer: async () => slice(b) };
    };
    return new Proxy(ev, { get(t, p) { if (p === "get") return get; const v = Reflect.get(t, p, t); return typeof v === "function" ? v.bind(t) : v; } });
  }

  /* R111: a ceiling a caller may only LOWER (a scaled figure for a test, K4840): the real figure, or the given one when it is a whole number below it. */
  static #lowered(real, given) { return Number.isSafeInteger(given) && given >= 0 && given < real ? given : real; }

  /* R111: the 413 an over-large body is refused with: its size and the figure it was judged against (`size`, `bound`; `bytes`, `maxBytes` as R86 always
     said them) and the key of the sentence. The capture ceiling is the archive row of `READ_BOUNDS`; the request ceiling is the platform's. */
  static #tooLarge(size, which, bound, keepable = null) {
    const request = which === "request";
    /* R113: a file refused for the request-body ceiling that the capture ceiling still admits is to be sent in parts (`in_parts`), the screen's cue to begin one */
    return { ok: false, reason: "TOO_LARGE", status: 413, bytes: size, maxBytes: bound, size, bound,
             ...(request && Number.isSafeInteger(keepable) ? { in_parts: size <= keepable } : {}),
             key: request ? "capture.index.body_over_request_ceiling" : boundStatement("archive", "uploaded_bytes", size).key,
             detail: request
               ? localize("capture.index.body_over_request_ceiling", "the file is larger than the {bound} bytes one request may carry, so it was refused whole; nothing was written", { bound: String(bound) })
               : localize("capture.index.file_too_large", "the file exceeds what this surface will capture even in parts; nothing was written") };
  }

  async #upload({ bytes, statement, name = null, type = null, by, at = null, within = null, boundMs = null, keepLater = null,
                  registerJob = null, armJobs = null, declared = null, bounds = null } = {}, tally) {
    const startedAt = Date.now();
    const fenced = Capture.#fence({ by, statement, name, type, op: "captureupload" });
    if (fenced) return fenced;
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    if (!ev) return Capture.#storageAbsent();
    const reader = uploadReader(bytes);
    if (!reader) return { ok: false, reason: "NO_BODY", status: 400, detail: localize("capture.index.upload_no_bytes", "the upload carried no bytes; nothing was written") };
    /* R111: a body is bounded before it is held. The two ceilings are quoted (`CAPTURE_MAX`, the request-body entry of `PLATFORM_FIGURES`); the lower is the one
       a member meets, and the one a refusal names. A size declared up front (the request's length) is judged before one byte is read. */
    const capMax = Capture.#lowered(CAPTURE_MAX, bounds && bounds.capture);
    const reqMax = Capture.#lowered(PLATFORM_FIGURES.request_body_max.value, bounds && bounds.request);
    const ceiling = Math.min(capMax, reqMax), ceilingIs = reqMax <= capMax ? "request" : "capture";
    if (Number.isSafeInteger(declared) && declared > ceiling) {
      await reader.cancel();
      return Capture.#tooLarge(declared, ceilingIs, ceiling, capMax);
    }
    /* `acquisition` R10's form: the whole hashed as it arrives by record-grammar's incremental hasher, the bytes held in
       parts of exactly 8 MiB (the last the remainder), each under its own digest; whether each was held before. */
    const whole = createSha256();
    const parts = [];
    let held = [], heldBytes = 0, total = 0;
    /* R107: the first `UPLOAD_HEAD` bytes of the file, kept as they arrive, so a file held in parts is also judged as text from its head. */
    const head = new Uint8Array(UPLOAD_HEAD);
    tally.hold(UPLOAD_HEAD);
    let headLen = 0;
    /* R103 (fix round 7; G79): the buffers of the parts as they are stored, while the file can still be kept whole by this module
       (up to `MULTIPART_KEEP_MAX`), so `keepWhole` puts the whole from them and reads no part back; dropped once the file is larger. */
    let partBytes = [], keptBytes = 0;
    const flush = async (all) => {
      while (heldBytes >= UPLOAD_PART || (all && heldBytes > 0)) {
        const n = Math.min(UPLOAD_PART, heldBytes);
        const buf = new Uint8Array(n);
        tally.hold(n);
        let k = 0;
        while (k < n) {
          const c = held[0], take = Math.min(c.length, n - k);
          buf.set(c.subarray(0, take), k); k += take;
          tally.release(take);
          if (take === c.length) held.shift(); else held[0] = c.subarray(take);
        }
        heldBytes -= n;
        const psha = hexOf(await crypto.subtle.digest("SHA-256", buf));
        if (!(await ev.head(psha))) await ev.put(psha, buf);
        parts.push({ sha256: psha, bytes: n });
        if (partBytes) { partBytes.push(buf); keptBytes += n; } else tally.release(n);
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) throw new Error("not bytes");
        total += value.length;
        if (total > ceiling) {
          await reader.cancel();
          return Capture.#tooLarge(total, ceilingIs, ceiling, capMax);
        }
        whole.update(value);
        if (partBytes && total > MULTIPART_KEEP_MAX) { partBytes = null; tally.release(keptBytes); keptBytes = 0; }
        if (headLen < UPLOAD_HEAD) { const k = Math.min(value.length, UPLOAD_HEAD - headLen); head.set(value.subarray(0, k), headLen); headLen += k; }
        held.push(value); heldBytes += value.length; tally.hold(value.length);
        if (heldBytes >= UPLOAD_PART) await flush(false);
      }
      await flush(true);
    } catch {
      await reader.cancel();
      return { ok: false, reason: "UPLOAD_NOT_STORED", status: 502,
               detail: localize("capture.index.file_bytes_unreadable", "the file's bytes could not be read whole or held under their own digest, so nothing was written") };
    }
    if (total === 0) return { ok: false, reason: "EMPTY", status: 400, detail: localize("capture.index.file_no_bytes", "the file has no bytes; nothing was written") };
    const sha = whole.hex();
    const multipart = parts.length > 1;
    if (!multipart && parts[0].sha256 !== sha)
      return { ok: false, reason: "HASH_DISAGREEMENT", status: 500, detail: "the incremental hash and the block hash of the same bytes differ" };
    /* R86 (T51; `acquisition` R10, C5): a file held in parts is also kept whole under its own digest, as a fetched one is, so its
       reading, its vouch box and OCR find it; where it cannot be kept the upload is refused and nothing is written. R103 (fix round 7;
       G79): the buffers of the parts just stored are handed to `keepWhole`, so no part is read back or hashed again: the whole is put
       once. */
    if (multipart && !(await keepWhole(ev, { sha, parts, total, bytes: partBytes })).ok)
      return { ok: false, reason: "UPLOAD_NOT_STORED", status: 502,
               detail: localize("capture.index.file_bytes_unreadable", "the file's bytes could not be read whole or held under their own digest, so nothing was written") };
    /* a file in one part is judged as text from the buffer just stored, not read back (it is at most one 8 MiB part); the ledger counts it until then */
    const onlyPart = !multipart && partBytes && partBytes.length === 1 ? partBytes[0] : null;
    partBytes = null;
    if (!onlyPart) { tally.release(keptBytes); keptBytes = 0; }
    const { reg, arm } = this.#registrar(registerJob, armJobs);
    /* R103 (fix round 4b, F2; fix round 7, G79): past `MULTIPART_KEEP_MAX` the whole is made from the stored parts by the store itself
       (`putFromParts`). The plane's owed-work ledger keeps it alive after the answer, so the answer is not held for it: the keep is handed
       over at once and the answer says `keep_pending`. R109: with the registrar the handover IS the `keep` row, registered in the filing
       transaction with the parts; else, with the plane's `keepLater`, as before; with neither this call AWAITS the keep within what is left of the door's
       bound, as a promise nothing keeps alive is not a keep; one that has not ended by then is handed over then. The file is filed in its parts either way,
       never refused for it. */
    let keepPending = false, keepRow = false;
    if (multipart && total > MULTIPART_KEEP_MAX) {
      if (reg && typeof ev.putFromParts === "function") { keepPending = true; keepRow = true; }
      else {
        const later = typeof keepLater === "function" ? keepLater : typeof this.keepLater === "function" ? (k) => this.keepLater(k) : null;
        if (later && typeof ev.putFromParts === "function") {
          try { const r = await later({ sha, parts: parts.map((p) => p.sha256) }); keepPending = !!(r && r.ok === true); } catch { keepPending = false; }
        }
        if (!keepPending)
          keepPending = (await keepPast(this, ev, { sha, parts, boundMs: boundMs ?? undefined, elapsedMs: Date.now() - startedAt, keepLater })).keep_pending;
      }
    }
    const pending = keepPending ? { keep_pending: true } : {};
    const judge = async () => {
      let ct = null;
      if (!multipart) {
        try {
          const raw = onlyPart ?? await (async () => { const obj = await ev.get(sha); return obj ? new Uint8Array(await obj.arrayBuffer()) : null; })();
          if (raw && raw.length === total) ct = textTypeOf({ bytes: raw, type, name });
        } catch { ct = null; }
      } else {
        ct = textTypeOf({ bytes: withoutCutCodePoint(head.subarray(0, headLen)), type, name });
      }
      return ct;
    };
    return this.#file({ ev, sha, total, parts, multipart, partsOwed: multipart, keepRow, pending, reg, arm, by, statement, name, type, at, within,
                        judge, firstPart: multipart ? head.subarray(0, headLen) : null,
                        held: onlyPart, settle: () => { tally.release(keptBytes); keptBytes = 0; } });
  }

  /* R109 (fix round 9; G126; K4835 (2)): the work an upload owes is one job row each, written through the registrar, read as `keepLater` is: the store's
     `registerJob` when it is a function, else the call's, else none (the answer then says so). The rows are written inside the filing transaction, and the
     alarm is armed after its commit. */
  #registrar(registerJob, armJobs) {
    const reg = typeof this.registerJob === "function" ? (e) => this.registerJob(e) : typeof registerJob === "function" ? registerJob : null;
    const arm = async () => {
      const f = typeof this.armJobs === "function" ? () => this.armJobs() : typeof armJobs === "function" ? armJobs : null;
      if (reg && f) { try { await f(); } catch { /* an alarm not armed is the backstop's, never the upload's */ } }
    };
    return { reg, arm };
  }

  /* R86, R108, R109: the filing of an upload, whether it came in one request or in parts (R113): the receipt, the capturing member, the job rows and `within`,
     in one transaction, and the answer. `parts` are the stored parts of a file held in parts (none for a file held as one object, a parted upload's
     included); `partsOwed` says the job rows name them; `judge()` answers the content type the bytes are profiled with; `firstPart` is the head `profileOf`
     sniffs; `multipart` says the file is held in parts, as against one object (past `PROFILE_TEXT_MAX` and `ODF_DIGEST_MAX` `profileOf` reads one object by
     ranges of its head and tail, whatever way it came). `held` is the bytes of a file held as one part, which the upload holds already (the profile reads
     them, never the stored object back, R109); `settle` releases them from the byte ledger once the profile is taken. */
  async #file({ ev, sha, total, parts, multipart, partsOwed, keepRow, pending, reg, arm, by, statement, name, type, at, within, judge, firstPart, held = null, settle = null }) {
    /* R109: the rows this upload owes: `reading` always, `unpack` when the profile names `zip` (R110), `keep` when the handover is the row. Called inside the
       filing transaction; a refusal (or a throw) of the registrar rolls the upload back and is answered, never swallowed. */
    const isZip = (profile) => !!(profile && profile.format && profile.format.format === "zip");
    const carrier = `snapshots/upload-${sha}`, partShas = parts.map((p) => p.sha256);
    /* R109 (fix round 9, G152; K4958): an upload stated over the whole-read ceiling of its kind is never read, so it owes no `reading`; the reader states it
       at once from the sizes (`control-plane` R132). The kind's row is the one the inline gate judges by: a PDF `pdf.bytes`, a CSV `csv.bytes`, a text `text.bytes`,
       every other kind the whole-load row `pdf.bytes`. */
    const stated = (profile) => !!profile && total > boundOf(...wholeReadRow(wholeReadKind(profile)));
    const register = (profile) => {
      if (!reg) return { ok: true };
      const entries = [...(stated(profile) ? [] : [{ kind: "reading", sha, carrier, ...(partsOwed && partShas.length ? { parts: partShas } : {}) }]),
                       ...(isZip(profile) ? [{ kind: "unpack", sha, carrier, ...(partsOwed && partShas.length ? { parts: partShas } : {}) }] : []),
                       ...(keepRow ? [{ kind: "keep", sha, carrier, parts: partShas }] : [])];
      for (const e of entries) {
        let r;
        try { r = reg(e); } catch { r = null; }
        if (!(r && r.ok === true))
          return { ok: false, reason: "JOB_NOT_REGISTERED", status: 502, job: { kind: e.kind, reason: String((r && r.reason) || "REGISTRAR_REFUSED").slice(0, 80) },
                   detail: localize("capture.index.job_not_registered", "the work this file owes could not be registered, so nothing was filed") };
      }
      return { ok: true };
    };
    /* R109: with no registrar the answer says which rows it could not register */
    const jobsNote = (profile) => ({
      ...(stated(profile) ? { reading_stated: true } : {}),
      ...(reg ? {} : { jobs: { not_registered: [...(stated(profile) ? [] : [{ kind: "reading", reason: "NO_REGISTRAR" }]), ...(isZip(profile) ? [{ kind: "unpack", reason: "NO_REGISTRAR" }] : [])] } }),
    });
    /* the profile of the bytes: from the bytes the upload holds when it holds them, else as `profileOf` reads the store */
    const profileThe = async (ct) => {
      /* a declared text type over bytes the one rule judged not text (`ct` null) is no declaration of a format: the declaration never contradicts the bytes (R107) */
      const declaredFor = (judged) => (typeof type === "string" && type !== "" && !(judged == null && profilesAsText(type, 0, false)) ? type : null);
      const profile = await profileOf({ ev: held ? Capture.#holding(ev, sha, held) : ev, sha, ct, total, multipart, headers: {}, locator: address, view: profileView(this.core),
                                        retrieved: when, origin: "member", parts: multipart && parts.length ? parts : null, firstPart,
                                        /* R107 (fix round 9, G170): the file's name and the declared type reach the format, as for a fetched file (acquisition R17) */
                                        name: typeof name === "string" && name !== "" ? name : null, declaredType: declaredFor(ct) });
      if (typeof type === "string" && type !== "") { profile.source_content_type = type; profile.declared_by = "uploader"; }
      else if (ct) profile.source_content_type = null;
      return profile;
    };
    let holds = null;
    try { holds = await this.provenance?.registerHolds?.({ sha }); } catch { holds = null; }
    /* The record holds the bytes when its register files them or a receipt names them (provenance R5). Bytes merely in
       the store are not enough: an upload rolled back (by `within`, or a receipt not written) leaves its bytes there,
       content-addressed and named by nothing, and its retry must file them. */
    const registered = !!(holds && holds.registered === true);
    const existed = registered || !!(holds && holds.acquired === true);
    const when = typeof at === "string" && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant());
    const address = `upload:${sha}`;
    const writeReceipt = () => {
      let r;
      try { r = this.provenance?.recordReceipt?.({ address, addressNorm: address, captureSha: sha, retrieved: when,
                                                    via: UPLOAD_VIA, retrievalLocator: null, by, statement }); }
      catch { r = null; }
      return r && r.recorded === true ? r : null;
    };
    const notWritten = { ok: false, reason: "RECEIPT_NOT_WRITTEN", status: 502,
                         detail: localize("capture.index.receipt_not_written", "the acquisition receipt could not be written, so nothing was filed") };
    const receiptOf = (r) => ({ address, via: UPLOAD_VIA, retrieved: when, observation: r.observation ?? null });
    /* a second sighting: the receipt and the rows it owes (one each, by the whole sha, so a second upload leaves the one), in one transaction */
    const sighting = (profile) => this.#tx(() => { const r = writeReceipt(); if (!r) return notWritten; const j = register(profile); return j.ok === false ? j : { ok: true, receipt: r }; });
    if (registered) {
      /* a second sighting of bytes the record holds: the receipt only, no document, no actor, `within` not called. Its kind is asked of the bytes only when the
         file is over the lowest whole-read row, where it may be stated (a smaller one owes its reading whatever it is). */
      const profile = total > boundOf("pdf", "bytes") ? await profileThe(await judge()) : null;
      settle?.();
      const r = sighting(profile);
      if (!r.ok) return r;
      await arm();
      return { ok: true, existed: true, capture: { sha256: sha, bytes: total }, receipt: receiptOf(r.receipt), ...pending, ...jobsNote(profile) };
    }
    const ct = await judge();
    const profile = await profileThe(ct);
    settle?.();
    const document = this.#uploadedDocument({ sha, total, parts, by, at: when, statement, name, profile });
    if (existed) {
      /* R86 (T51 fix round 2; C10): a receipt names the bytes but the register files them under no document (an upload
         interrupted before it was filed): the receipt is written as a second sighting and the document is answered as a new
         upload's, so the screen can file it for the viewer; no actor is recorded and `within` is not called. */
      const r = sighting(profile);
      if (!r.ok) return r;
      await arm();
      return { ok: true, existed: true, capture: { sha256: sha, bytes: total }, receipt: receiptOf(r.receipt), document, ...pending, ...jobsNote(profile) };
    }
    let done;
    try {
      done = this.#tx(() => {
        const r = writeReceipt();
        if (!r) return notWritten;
        this.recordCaptureActor({ captureSha: sha, actor: by, at: when });
        const j = register(profile);
        if (j.ok === false) return j;
        if (typeof within !== "function") return { ok: true, receipt: r };
        const w = Capture.#callWithin(within, document);
        if (w && typeof w === "object" && w.ok === false) return w;
        return { ok: true, receipt: r, within: w ?? null };
      });
    } catch (e) {
      if (e && typeof e === "object" && WITHIN_FAULT in e)
        return { ok: false, reason: "UPLOAD_WITHIN_FAILED", status: 500, detail: UPLOAD_WITHIN_FAILED_DETAIL };
      throw e;
    }
    if (!done.ok) return done;
    await arm();
    return { ok: true, existed: false, capture: { sha256: sha, bytes: total }, receipt: receiptOf(done.receipt), document, ...pending, ...jobsNote(profile),
             ...(typeof within === "function" ? { within: done.within } : {}) };
  }


  /* ==================================================================== *
   * A file sent in parts (R113; G127f; K4838 (6), K4891)
   * ==================================================================== */

  /* R113: the bucket binding when it offers R2's own multipart upload, else null. The parts of a file past the request-body ceiling are written with it
     directly, so the whole is one object under its digest and no part is stored as an object of its own. */
  #partedBucket() {
    const b = this.env && this.env.CAPTURES;
    return b && typeof b.createMultipartUpload === "function" && typeof b.resumeMultipartUpload === "function" ? b : null;
  }

  /* R113: the object key of a digest in the evidence bucket, which record-core fixes (its R38) and the composition root knows: handed by the caller as `key`
     (the function the door hands `op=capture`), else the store's `evidenceKey`, assigned as `keepLater` is. Null when neither is given. */
  #partedKey(key) {
    return typeof key === "function" ? key : typeof this.evidenceKey === "function" ? (d) => this.evidenceKey(d) : null;
  }

  /* R113: the session a member may use: refused when unknown to this instance or another member's (an unseen session and an unknown one read alike), or past
     its expiry (then aborted here, its row removed). Answers `{row}` or `{refusal}`. */
  async #partedRow(upload, by, bucket, key) {
    const fenced = Capture.#fence({ by, statement: "-", name: null, type: null, op: "captureupload" });
    if (fenced) return { refusal: fenced };
    const row = typeof upload === "string" && upload ? this.#one(`SELECT * FROM parted_uploads WHERE upload = ?`, upload) : null;
    if (!row || memberIdOf(row.by) !== memberIdOf(by))
      return { refusal: { ok: false, reason: "UPLOAD_UNKNOWN", status: 404,
                          detail: localize("capture.index.upload_unknown", "your group's Civicsmith holds no upload in parts under that name for you; begin it again") } };
    if (row.expires <= stampSecond(this.#instant())) {
      await this.#partedDrop(row, bucket, key);
      return { refusal: { ok: false, reason: "UPLOAD_EXPIRED", status: 410,
                          detail: localize("capture.index.upload_expired", "this upload was left open too long, so it was aborted and holds nothing; begin it again") } };
    }
    let parts = [];
    try { parts = JSON.parse(row.parts); } catch { parts = []; }
    return { row: { ...row, parts } };
  }

  /* R113 (G173): the live state of an open upload whose `parts` are put: the one this instance holds when it holds the right one, else taken up again from the
     digest kept with the row. Null only when the row's state is missing or does not describe the parts held (an upload begun before the state was kept, or a
     row that was altered): then the digest of the parts so far cannot be told and the caller answers `UPLOAD_LOST`. */
  #liveOf(row) {
    const held = row.parts.length, have = this.#parted.get(row.upload);
    if (have && have.next === held) return have;
    if (held === 0) return have ?? null;
    const hasher = typeof row.hash_state === "string" ? resumedOf(row.hash_state) : null;
    if (!hasher || hasher.length !== row.parts.reduce((n, p) => n + p.bytes, 0)) return null;
    const live = { hasher, next: held, busy: have ? have.busy : false, whole: null };
    this.#parted.set(row.upload, live);
    return live;
  }

  /* R113: abort what a session holds in R2 (when its upload is still open) and remove its row and its live state. True when it is gone; false when the bucket
     would not abort, the row then staying for the next sweep. */
  async #partedDrop(row, bucket, key) {
    if (row.state === "open" && row.r2 && bucket) {
      try { await bucket.resumeMultipartUpload(key ? key(row.sha256) : row.sha256, row.r2).abort(); }
      catch { return false; }
    }
    this.#tx(() => this.#sql.exec(`DELETE FROM parted_uploads WHERE upload = ?`, row.upload));
    this.#parted.delete(row.upload);
    return true;
  }

  /** R113: aborts the sessions of uploads in parts that were left open past their expiry (`PARTED_UPLOAD_TTL_MS` after their begin), at most `PARTED_SWEEP_MAX`
   *  at a time, oldest first; each one's multipart upload is aborted in R2 and its row removed, so an abandoned upload holds nothing. A session whose abort the
   *  bucket refuses is left for the next call. Run at each begin; a caller may run it too. Never throws. */
  async expireUploads({ key = null } = {}) {
    try {
      const bucket = this.#partedBucket(), keyOf = this.#partedKey(key);
      const due = this.#rows(`SELECT * FROM parted_uploads WHERE expires <= ? ORDER BY expires, upload LIMIT ?`, stampSecond(this.#instant()), PARTED_SWEEP_MAX);
      let aborted = 0;
      for (const row of due) if (await this.#partedDrop(row, bucket, keyOf)) aborted++;
      return { ok: true, aborted };
    } catch { return { ok: false, aborted: 0 }; }
  }

  /** R113 (fix round 9; G127f; K4838 (6), K4891): begins an upload of a file past the request-body ceiling, which the browser then sends in parts through the
   *  Worker. `{sha256, bytes, statement, name, type, by}`: the whole file's digest and its size as the member's browser declares them, and what R86 asks of an
   *  upload. Refused as `uploadCapture` refuses before a byte is read (the member-session fence, `UPLOAD_NO_STATEMENT`, `name`, `type`), then a size over the
   *  capture ceiling (`TOO_LARGE`, 413, with `size` and `bound`, judged before any part). Otherwise R2's multipart upload is begun under the object key of
   *  `sha256` and the answer is `{ok: true, upload, sha256, bytes, part_bytes, parts, next: 0, held: false, expires}`: the browser cuts the file into `parts`
   *  parts of `part_bytes` bytes (the last the remainder) and sends them in order. When the evidence store already holds an object of that digest and size
   *  the answer is `held: true` with no parts to send, and the completion files it. A second begin of the same file by the same member abandons the first.
   *  Session state is this module's table `parted_uploads` (it holds no byte); a session left open past `PARTED_UPLOAD_TTL_MS` is aborted. */
  async beginPartedUpload({ sha256 = null, bytes = null, statement, name = null, type = null, by, bounds = null, key = null } = {}) {
    const fenced = Capture.#fence({ by, statement, name, type, op: "captureuploadbegin" });
    if (fenced) return fenced;
    if (typeof sha256 !== "string" || !HEX64.test(sha256))
      return Capture.#missingArgument("captureuploadbegin", "sha256", localize("capture.index.shape_sha256_whole", "64 lowercase hex characters, the digest of the whole file"), sha256);
    if (!Number.isSafeInteger(bytes) || bytes < 1)
      return Capture.#missingArgument("captureuploadbegin", "bytes", localize("capture.index.shape_bytes", "the file's size in bytes, a whole number from 1"), bytes);
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    if (!ev) return Capture.#storageAbsent();
    /* R111: the size is judged before any part is accepted. A whole may be larger than one request may carry, so only the capture ceiling binds it. */
    const capMax = Capture.#lowered(CAPTURE_MAX, bounds && bounds.capture);
    if (bytes > capMax) return Capture.#tooLarge(bytes, "capture", capMax);
    const bucket = this.#partedBucket(), keyOf = this.#partedKey(key);
    if (!bucket || !keyOf)
      return { ok: false, reason: "PARTED_UPLOAD_UNAVAILABLE", status: 503,
               detail: localize("capture.index.parted_unavailable", "your group's Civicsmith cannot take a file in parts (its evidence bucket offers no multipart upload, or its key is not known), so nothing was written") };
    await this.expireUploads({ key });
    /* the same member's earlier session for this file is abandoned: a restarted upload begins clean */
    for (const old of this.#rows(`SELECT * FROM parted_uploads WHERE by = ? AND sha256 = ?`, by, sha256)) await this.#partedDrop(old, bucket, keyOf);
    const reqMax = Capture.#lowered(PLATFORM_FIGURES.request_body_max.value, bounds && bounds.request);
    const partBytes = Math.max(1, Math.min(Capture.#lowered(PARTED_PART_BYTES, bounds && bounds.part), reqMax));
    const count = Math.ceil(bytes / partBytes);
    let held = false;
    try { const h = await ev.head(sha256); held = !!(h && h.size === bytes); } catch { held = false; }
    let r2 = null;
    if (!held) {
      try { r2 = (await bucket.createMultipartUpload(keyOf(sha256))).uploadId; }
      catch {
        return { ok: false, reason: "UPLOAD_NOT_BEGUN", status: 502,
                 detail: localize("capture.index.parted_not_begun", "the evidence store would not begin an upload in parts, so nothing was written") };
      }
    }
    const now = this.#instant(), upload = crypto.randomUUID().replace(/-/g, "");
    const created = stampSecond(now), expires = stampSecond(now + PARTED_UPLOAD_TTL_MS);
    this.#tx(() => this.#sql.exec(
      `INSERT INTO parted_uploads (upload, sha256, bytes, part_bytes, by, statement, name, type, r2, state, parts, hash_state, created, expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
      upload, sha256, bytes, partBytes, by, statement, name ?? null, type ?? null, r2, held ? "completed" : "open", held ? null : createResumableSha256().snapshot(), created, expires));
    if (!held) this.#parted.set(upload, { hasher: createResumableSha256(), next: 0, busy: false, whole: null });
    return { ok: true, upload, sha256, bytes, part_bytes: partBytes, parts: held ? 0 : count, next: 0, held, created, expires };
  }

  /** R113: puts one part of an upload begun with `beginPartedUpload`. `{upload, index, bytes, sha256, by, declared, bounds, ledger}`: `index` counts from 0,
   *  `bytes` the part (a stream, bytes or an async iterable, as R86 takes a file), `sha256` the part's own digest as the browser computed it, checked as the part
   *  arrives. A part is exactly `part_bytes` bytes, the last the remainder, so a length that differs (`declared` is judged before one byte is read) is
   *  `PART_SIZE` and the stream is cancelled. Parts go in order, because the whole file's digest is hashed in order across them: a part past the next one is
   *  `PART_OUT_OF_ORDER` (answering `next`); a part already put, put again, is idempotent, answered `existed: true` and stored once, and one put again with other
   *  bytes is `PART_CONFLICT`. The part is held once in memory (the byte `ledger` counts it) and written to R2's upload before it is recorded. If this instance
   *  has been taken out of memory between parts, the digest of the parts so far is taken up again from the upload's row (G173), so the next part is accepted
   *  whatever the pause; only an upload whose row cannot say that digest is aborted and answered `UPLOAD_LOST`: begin again. */
  async putUploadPart({ upload = null, index = null, bytes, sha256 = null, by, declared = null, ledger = null, key = null } = {}) {
    const tally = Capture.#tally(ledger);
    const reader = uploadReader(bytes);
    /* G176 (K5005): an answer given without keeping the part is given after the body is read and discarded, never more than the part size, so a client still
       sending reads the answer and not a closed connection; a body past the part size is cut there (cancelled), as before. The part size is the row's once the
       row is read, the platform's upper figure before. */
    let drainTo = PARTED_PART_BYTES, drained = 0;
    const stop = async (answer) => {
      if (!reader) return answer;
      try {
        for (;;) {
          if (drained > drainTo) break;
          const { done, value } = await reader.read();
          if (done) return answer;
          drained += value ? value.length : 0;
        }
      } catch { /* a body that cannot be read further is answered all the same */ }
      await reader.cancel();
      return answer;
    };
    try {
      const fenced = Capture.#fence({ by, statement: "-", name: null, type: null, op: "captureuploadpart" });
      if (fenced) return await stop(fenced);
      if (typeof upload !== "string" || !upload) return await stop(Capture.#missingArgument("captureuploadpart", "upload", localize("capture.index.shape_upload_name", "the upload's name, as the begin answered it"), upload));
      if (!Number.isSafeInteger(index) || index < 0)
        return await stop(Capture.#missingArgument("captureuploadpart", "index", localize("capture.index.shape_part_index", "a whole number from 0, the part's place in the file"), index));
      if (typeof sha256 !== "string" || !HEX64.test(sha256))
        return await stop(Capture.#missingArgument("captureuploadpart", "sha256", localize("capture.index.shape_sha256_part", "64 lowercase hex characters, the digest of this part"), sha256));
      const bucket = this.#partedBucket(), keyOf = this.#partedKey(key);
      const got = await this.#partedRow(upload, by, bucket, keyOf);
      if (got.refusal) return await stop(got.refusal);
      const row = got.row, count = Math.ceil(row.bytes / row.part_bytes);
      drainTo = row.part_bytes;
      if (row.state !== "open")
        return await stop({ ok: false, reason: "UPLOAD_NOT_OPEN", status: 409,
                            detail: localize("capture.index.upload_not_open", "this upload has no part left to put; complete it") });
      if (index >= count)
        return await stop(Capture.#missingArgument("captureuploadpart", "index", localize("capture.index.shape_part_index_last", "a whole number from 0 to {last}", { last: String(count - 1) }), index));
      if (index < row.parts.length) {
        if (row.parts[index].sha256 === sha256) return await stop({ ok: true, existed: true, index, next: row.parts.length, parts: count });
        return await stop({ ok: false, reason: "PART_CONFLICT", status: 409, index, next: row.parts.length,
                            detail: localize("capture.index.part_conflict", "that part was already put with other bytes, so this one was refused") });
      }
      if (index > row.parts.length)
        return await stop({ ok: false, reason: "PART_OUT_OF_ORDER", status: 409, index, next: row.parts.length,
                            detail: localize("capture.index.part_out_of_order", "the parts go in order, because the file's digest is taken across them in order; send the part named next") });
      let live = this.#liveOf(row);
      if (row.parts.length > 0 && !live) {
        await this.#partedDrop(row, bucket, keyOf);
        return await stop({ ok: false, reason: "UPLOAD_LOST", status: 409,
                            detail: localize("capture.index.upload_lost", "your group's Civicsmith lost the digest of the parts so far, so the upload was aborted and holds nothing; begin it again") });
      }
      if (!live) { live = { hasher: createResumableSha256(), next: 0, busy: false, whole: null }; this.#parted.set(row.upload, live); }
      if (live.busy)
        return await stop({ ok: false, reason: "PART_IN_PROGRESS", status: 409, index,
                            detail: localize("capture.index.part_in_progress", "a part of this upload is still arriving; send the next one when it is answered") });
      const expected = index === count - 1 ? row.bytes - index * row.part_bytes : row.part_bytes;
      const wrongSize = (size) => ({ ok: false, reason: "PART_SIZE", status: size > expected ? 413 : 400, index, size, bound: expected,
                                     detail: localize("capture.index.part_size", "a part must be exactly {bound} bytes (the last one the rest of the file), and this one is not; nothing was stored", { bound: String(expected) }) });
      if (Number.isSafeInteger(declared) && declared !== expected) return await stop(wrongSize(declared));
      if (!reader) return { ok: false, reason: "NO_BODY", status: 400, detail: localize("capture.index.upload_no_bytes", "the upload carried no bytes; nothing was written") };
      live.busy = true;
      try {
        const buf = new Uint8Array(expected);
        tally.hold(expected);
        let filled = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) throw new Error("not bytes");
            drained += value.length;
            if (filled + value.length > expected) return await stop(wrongSize(filled + value.length));
            buf.set(value, filled); filled += value.length;
          }
        } catch {
          return await stop({ ok: false, reason: "PART_NOT_READ", status: 502, index,
                              detail: localize("capture.index.part_not_read", "the part's bytes could not be read, so nothing was stored; send it again") });
        }
        if (filled !== expected) return wrongSize(filled);
        const partDigest = hexOf(await crypto.subtle.digest("SHA-256", buf));
        if (partDigest !== sha256)
          return { ok: false, reason: "PART_DIGEST_MISMATCH", status: 400, index, expected: sha256, got: partDigest,
                   detail: localize("capture.index.part_digest_mismatch", "the part does not hash to the digest given for it, so nothing was stored; send it again") };
        let etag;
        try { etag = (await bucket.resumeMultipartUpload(keyOf(row.sha256), row.r2).uploadPart(index + 1, buf)).etag ?? null; }
        catch {
          return { ok: false, reason: "PART_NOT_STORED", status: 502, index,
                   detail: localize("capture.index.part_not_stored", "the evidence store would not take the part, so nothing was recorded; send it again") };
        }
        live.hasher.update(buf);
        live.next = index + 1;
        const parts = [...row.parts, { sha256, etag, bytes: expected }];
        /* the part and the digest through it are recorded together (G173): the row never names a part its state does not include */
        this.#tx(() => this.#sql.exec(`UPDATE parted_uploads SET parts = ?, hash_state = ? WHERE upload = ?`, JSON.stringify(parts), live.hasher.snapshot(), row.upload));
        return { ok: true, existed: false, index, next: parts.length, parts: count, bytes: expected };
      } finally { live.busy = false; }
    } finally { tally.end(); }
  }

  /** R113: completes an upload sent in parts. `{upload, parts, by, within, at, registerJob, armJobs}`: `parts` the digests of the parts in order, which must be
   *  the ones put: a part not put is `PARTS_MISSING` (naming them) and any other difference `PARTS_OUT_OF_ORDER`, each refusing with nothing written and the upload
   *  left open. The digest of all the bytes, hashed in order across the parts (never a part's), must be the one declared at the begin, else the upload is aborted,
   *  nothing is held and the answer is `WHOLE_DIGEST_MISMATCH`. Then R2's upload is completed, making one object under the whole's digest, and the file is
   *  filed exactly as `uploadCapture` files one that came in a request (R86, R108, R109): one receipt, the actor, one job row through the registrar and `within`
   *  in one transaction, and the same answer, the document carrying no `parts` (the whole is one object). A retry after a refusal in the filing files the
   *  object already complete. */
  async completePartedUpload({ upload = null, parts = null, by, within = null, at = null, registerJob = null, armJobs = null, key = null } = {}) {
    const fenced = Capture.#fence({ by, statement: "-", name: null, type: null, op: "captureuploadcomplete" });
    if (fenced) return fenced;
    if (typeof upload !== "string" || !upload) return Capture.#missingArgument("captureuploadcomplete", "upload", localize("capture.index.shape_upload_name", "the upload's name, as the begin answered it"), upload);
    const named = Array.isArray(parts) ? parts.map((p) => (p && typeof p === "object" ? p.sha256 : p)) : null;
    if (!named || !named.every((d) => typeof d === "string" && HEX64.test(d)))
      return Capture.#missingArgument("captureuploadcomplete", "parts", localize("capture.index.shape_parts_digests", "the list of the parts' digests, in order, each 64 lowercase hex characters"), parts);
    const bucket = this.#partedBucket(), keyOf = this.#partedKey(key);
    const got = await this.#partedRow(upload, by, bucket, keyOf);
    if (got.refusal) return got.refusal;
    const row = got.row, count = Math.ceil(row.bytes / row.part_bytes);
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    if (!ev) return Capture.#storageAbsent();
    if (row.state === "open") {
      const missing = []; for (let i = 0; i < count; i++) if (!row.parts[i]) missing.push(i);
      if (missing.length)
        return { ok: false, reason: "PARTS_MISSING", status: 409, missing, next: row.parts.length,
                 detail: localize("capture.index.parts_missing", "the upload lacks parts, so it was not completed and nothing was written; send the parts named in missing") };
      const differs = row.parts.findIndex((p, i) => named[i] !== p.sha256);
      if (differs >= 0 || named.length !== row.parts.length)
        return { ok: false, reason: "PARTS_OUT_OF_ORDER", status: 409, index: differs >= 0 ? differs : row.parts.length,
                 detail: localize("capture.index.parts_out_of_order", "the parts named are not the ones put, in the order they were put, so the upload was not completed and nothing was written") };
      const live = this.#liveOf(row);
      if (!live || live.next !== count) {
        await this.#partedDrop(row, bucket, keyOf);
        return { ok: false, reason: "UPLOAD_LOST", status: 409,
                 detail: localize("capture.index.upload_lost", "your group's Civicsmith lost the digest of the parts so far, so the upload was aborted and holds nothing; begin it again") };
      }
      if (live.whole === null) live.whole = live.hasher.hex();
      if (live.whole !== row.sha256) {
        const claimed = row.sha256, got64 = live.whole;
        await this.#partedDrop(row, bucket, keyOf);
        return { ok: false, reason: "WHOLE_DIGEST_MISMATCH", status: 400, expected: claimed, got: got64,
                 detail: localize("capture.index.whole_digest_mismatch", "the parts, taken in order, do not hash to the digest declared for the file, so the upload was aborted and nothing was held") };
      }
      try { await bucket.resumeMultipartUpload(keyOf(row.sha256), row.r2).complete(row.parts.map((p, i) => ({ partNumber: i + 1, etag: p.etag }))); }
      catch {
        await this.#partedDrop(row, bucket, keyOf);
        return { ok: false, reason: "UPLOAD_NOT_COMPLETED", status: 502,
                 detail: localize("capture.index.parted_not_completed", "the evidence store would not complete the upload, so it was aborted and holds nothing; begin it again") };
      }
      this.#tx(() => this.#sql.exec(`UPDATE parted_uploads SET state = 'completed' WHERE upload = ?`, row.upload));
      this.#parted.delete(row.upload);
    }
    /* the object is whole under its digest: file it. Its head is read as a range, which is all the profile asks of a file past one part. */
    let head = null;
    try {
      const o = await ev.get(row.sha256, { range: { offset: 0, length: UPLOAD_HEAD } });
      head = o ? new Uint8Array(await o.arrayBuffer()) : null;
    } catch { head = null; }
    if (!head)
      return { ok: false, reason: "UPLOAD_NOT_STORED", status: 502,
               detail: localize("capture.index.file_bytes_unreadable", "the file's bytes could not be read whole or held under their own digest, so nothing was written") };
    const { reg, arm } = this.#registrar(registerJob, armJobs);
    const judge = async () => textTypeOf({ bytes: withoutCutCodePoint(head), type: row.type, name: row.name });
    const filed = await this.#file({ ev, sha: row.sha256, total: row.bytes, parts: [], multipart: false, partsOwed: false, keepRow: false, pending: {}, reg, arm,
                                     by: row.by, statement: row.statement, name: row.name, type: row.type, at, within, judge, firstPart: head });
    if (filed.ok === true) await this.#partedDrop({ ...row, state: "completed" }, bucket, keyOf);
    return filed;
  }

  /** R113: abandons an upload sent in parts: R2's upload is aborted and the session removed, so it holds nothing. `{upload, by}`. Idempotent: a session this
   *  member does not hold answers `{ok: true, aborted: false}`. A bucket that will not abort answers `UPLOAD_NOT_ABORTED` (502) and the session stays, to be
   *  swept at its expiry. */
  async abortPartedUpload({ upload = null, by, key = null } = {}) {
    const fenced = Capture.#fence({ by, statement: "-", name: null, type: null, op: "captureuploadabort" });
    if (fenced) return fenced;
    if (typeof upload !== "string" || !upload) return Capture.#missingArgument("captureuploadabort", "upload", localize("capture.index.shape_upload_name", "the upload's name, as the begin answered it"), upload);
    const row = typeof upload === "string" && upload ? this.#one(`SELECT * FROM parted_uploads WHERE upload = ?`, upload) : null;
    if (!row || memberIdOf(row.by) !== memberIdOf(by)) return { ok: true, aborted: false };
    if (!(await this.#partedDrop(row, this.#partedBucket(), this.#partedKey(key))))
      return { ok: false, reason: "UPLOAD_NOT_ABORTED", status: 502,
               detail: localize("capture.index.parted_not_aborted", "the evidence store would not abort the upload; it stays open and is aborted at its expiry") };
    return { ok: true, aborted: true };
  }

  /* R86: the provenance document of an upload, built as a pulled knock's is (doorbell R13): received from the member, never
     fetched (provenance R63): no fetched letter, no header, no transport. She is its actor, never its source (`sources`
     R12): the source is the uploader's receipt, naming no member; her words on where it came from, and the name she gave
     it, travel as her statements, never as evidence of their truth. The file is named from the digest. */
  #uploadedDocument({ sha, total, parts, by, at, statement, name, profile }) {
    const file = `snapshots/upload-${sha}`;
    const said = (text) => ({ text, words_of: by, evidence_of_truth: false });
    return {
      file, locator: `upload:${sha}`, retrieved: at,
      profile,
      authority_state: "undetermined",
      authority_basis: say("capture.authority_basis", { at }),
      provenance_chain: [{
        who: firstHopWho(this.env.INSTANCE_NAME, this.env.VERSION),
        asserts: word("capture.upload.asserts", { by: String(by), at: String(at) }),
        evidence: localize("capture.index.upload_receipt_evidence", "the upload's receipt: its digest, taken as the bytes arrived, and its instant"),
        bound: false, via: UPLOAD_VIA,
      }],
      capture: {
        method: "uploaded",
        grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED",
        actor_class: "member", actor: by,
        sha256: sha, encoding: "binary", bytes: total,
      },
      ...(parts.length > 1 ? { parts: parts.map((p, i) => ({ file: `${file}.part${String(i).padStart(3, "0")}`, sha256: p.sha256, bytes: p.bytes })) } : {}),
      source: { kind: "uploader", receipt: { sha256: sha, bytes: total, received: at } },
      origin_statement: said(statement),
      ...(name != null ? { name_stated: said(name) } : {}),
      origin: { kind: "upload" },
      attestation_attempts: [],
    };
  }

  /* ==================================================================== *
   * The capturing member, and late co-attestation (`acquisition` R16's actor, R68, R69)
   * ==================================================================== */

  /** `acquisition` R16, R69: record `actor` as one who captured `captureSha` (a member session's acquire, an upload
   *  (R86), a knock's pull: `doorbell` R13 calls it). Kept once
   *  per pair, at the first instant. */
  recordCaptureActor({ captureSha, actor, at = null } = {}) {
    if (typeof captureSha !== "string" || !HEX64.test(captureSha) || typeof actor !== "string" || !actor) return { recorded: false };
    this.#tx(() => this.#sql.exec(`INSERT OR IGNORE INTO capture_actors (capture_sha, actor, at) VALUES (?, ?, ?)`,
                                  captureSha, actor, at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant())));
    return { recorded: true };
  }

  /** R94 (T50; N1117; `acquisition` R47): that a member captured these bytes for a question, once for each (capture
   *  digest, question, member), at the first instant. The service `acquisition` calls through the store handed in when
   *  `acquire` carries `for`. It decides nothing about the question's existence, sight, title or openness (R83's reader
   *  does); it records the ask. `{recorded: false}`, writing nothing, for a digest that is not 64 lowercase hex, a
   *  `question` that is not a non-blank string of at most 200 characters, or a `by` that is not a member's stamp
   *  (absent, blank, naming no member, or a machine identity). Never throws. */
  recordCapturedFor(args) {
    try {
      const { captureSha, question, by, at = null } = args ?? {};
      if (typeof captureSha !== "string" || !HEX64.test(captureSha)) return { recorded: false };
      if (typeof question !== "string" || !question.trim() || [...question].length > CAPTURED_FOR_QUESTION_MAX) return { recorded: false };
      if (typeof by !== "string" || !memberIdOf(by).trim() || isMachineIdentity(by)) return { recorded: false };
      this.#tx(() => this.#sql.exec(`INSERT OR IGNORE INTO captured_for (capture_sha, question, asker, at) VALUES (?, ?, ?, ?)`,
                                    captureSha, question, memberIdOf(by), at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant())));
      return { recorded: true };
    } catch { return { recorded: false }; }
  }

  /** R104 (fix round 6; G2; K4562): that a large capture fetched in the background was filed, once for each capture session, in the table
   *  `fetch_done`, for `notice-producers` to tell the opener (`fetchesDone`). `{recorded: false}`, writing nothing, for a session or
   *  document that is not a non-blank string, an opener that is not a member's stamp (absent, blank, naming no member, or a machine
   *  identity), a `project` that is neither a string nor null, or a session already recorded. `at` is a whole-second UTC instant,
   *  this instance's clock when absent. Never throws. */
  recordFetchDone(args) {
    try {
      const { session, document, opener, project = null, at = null } = args ?? {};
      const text = (x) => typeof x === "string" && x.trim() !== "" && x.length <= 300;
      if (!text(session) || !text(document)) return { recorded: false };
      if (typeof opener !== "string" || !memberIdOf(opener).trim() || isMachineIdentity(opener)) return { recorded: false };
      if (project !== null && typeof project !== "string") return { recorded: false };
      return this.#tx(() => {
        if (this.#one(`SELECT 1 AS x FROM fetch_done WHERE session = ?`, session)) return { recorded: false };
        this.#sql.exec(`INSERT INTO fetch_done (session, document, opener, project, at) VALUES (?, ?, ?, ?, ?)`,
                       session, document, opener, project || null, at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant()));
        return { recorded: true };
      });
    } catch { return { recorded: false }; }
  }

  /** R104 (G2): the fetches recorded, oldest first by instant then session, at most `limit` (default 200, clamped 1…1000), each
   *  `{session, document, opener, project, at, cursor}`; `after` the `cursor` of a row an earlier read answered (one that is not such a
   *  cursor reads from the head), with `truncated` and `next`. In process, no viewer: `notice-producers` tells `opener` and no one
   *  else. Writes nothing; never throws (a store that cannot be read answers no fetches). */
  fetchesDone({ limit = null, after = null } = {}) {
    const cap = limitOf(limit);
    try {
      const from = after ? keyOf(after, 3) : null;
      const at = from && from[0] === FETCH_CURSOR_TAG ? from : null;
      const found = this.#rows(`SELECT session, document, opener, project, at FROM fetch_done
                                 WHERE ${at ? "(at > ? OR (at = ? AND session > ?))" : "1=1"} ORDER BY at, session LIMIT ?`,
                               ...(at ? [at[1], at[1], at[2]] : []), cap + 1);
      const page = found.slice(0, cap).map((r) => ({ session: r.session, document: r.document, opener: r.opener, project: r.project ?? null,
                                                   at: r.at, cursor: cursorOf([FETCH_CURSOR_TAG, r.at, r.session]) }));
      return { ok: true, fetches: page, limit: cap, truncated: found.length > cap, next: found.length > cap ? page[page.length - 1].cursor : null };
    } catch { return { ok: true, fetches: [], limit: cap, truncated: false, next: null }; }
  }

  /** R100 (T51 fix round 3; C9; Intake Doctrine section 8): that a member filed a held document in a project as a reference,
   *  once for each (capture digest, project), at the first instant, in the table `seen_in`. It makes no second home: the
   *  document keeps the one home `provenance` records (its R2), and `heldCaptures` (R77) lists it beside the project's own.
   *  `{recorded: false}`, writing nothing, for a digest that is not 64 lowercase hex, a `project` that is not a non-blank
   *  string of at most `SEEN_IN_PROJECT_MAX` characters, or a `by` that is not a member's stamp (absent, blank, naming no
   *  member, or a machine identity). It decides nothing about the project's existence or the viewer's sight of it. Never
   *  throws. */
  recordSeenIn(args) {
    try {
      const { captureSha, project, by, at = null } = args ?? {};
      if (typeof captureSha !== "string" || !HEX64.test(captureSha)) return { recorded: false };
      if (typeof project !== "string" || !project.trim() || [...project].length > SEEN_IN_PROJECT_MAX) return { recorded: false };
      if (typeof by !== "string" || !memberIdOf(by).trim() || isMachineIdentity(by)) return { recorded: false };
      this.#tx(() => this.#sql.exec(`INSERT OR IGNORE INTO seen_in (capture_sha, project, by, at) VALUES (?, ?, ?, ?)`,
                                    captureSha, project, memberIdOf(by), at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant())));
      return { recorded: true };
    } catch { return { recorded: false }; }
  }

  /** R101 (T51 fix round 3; C9; K4370; amends R100): a member files a held document in a project, `op=captureseenin`, calling
   *  `recordSeenIn` (R100) for the member. Refused in order, each writing nothing: a `by` that is not a signed-in member's stamp
   *  (`MEMBER_SESSION_REQUIRED`, 403, as R86's fence); a `captureSha` that is not 64 lowercase hex or a `project` that is blank or
   *  over `SEEN_IN_PROJECT_MAX` characters (the required-argument refusal naming it); a digest no capture the viewer may see holds
   *  as a document's capture, which is also the document whose home the member cannot see (`CAPTURE_NOT_HELD`, 404, C-118.11, one
   *  answer for both, naming no holder); a project the member has not joined (membership's `PROJECT_ACT_NOT_A_PARTICIPANT`,
   *  C-56.1, through `projectAuthority`, 403, which an unknown project meets as well). Answers `{ok: true, recorded, home}`: `home`
   *  the project the document is held under (`bundles.project`, as `heldCaptures`' `also_here` names it, null when it has none);
   *  `recorded` false for a repeat, a reference the first press kept at its first instant and member, and for the document's own
   *  home, which lists it already. The instant is this instance's clock, never the request's. The `contribute` capability is the
   *  door's (`op-declarations`), as for every corpus write (membership's `isProjectEditor`). */
  fileSeenIn({ captureSha, project, by, viewer = undefined } = {}) {
    if (typeof by !== "string" || !memberIdOf(by).trim() || isMachineIdentity(by))
      return { ok: false, reason: "MEMBER_SESSION_REQUIRED", status: 403,
               detail: localize("capture.index.seenin_member_act", "filing a document where it is seen is a signed-in member's act, whose stamp names them; nothing was written") };
    if (typeof captureSha !== "string" || !HEX64.test(captureSha))
      return Capture.#missingArgument("captureseenin", "captureSha", "64 lowercase hex characters", captureSha);
    if (typeof project !== "string" || !project.trim() || [...project].length > SEEN_IN_PROJECT_MAX)
      return Capture.#missingArgument("captureseenin", "project", `a string of at most ${SEEN_IN_PROJECT_MAX} characters`, project);
    try {
      const sight = this.#sightOf(viewer);
      const home = this.#one(`SELECT b.project AS project FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id
                               WHERE r.capture_sha = ? AND (${sight.sql}) ORDER BY julianday(r.registered), r.registered, r.bundle_id LIMIT 1`,
                             captureSha, ...sight.args);
      /* DEC-49 REGION is-capture-held */
      if (!home) {
        const row = CAPTURE_CHECKS.CAPTURE_NOT_HELD;
        return { ok: false, reason: "CAPTURE_NOT_HELD", code: "CAPTURE_NOT_HELD", check: row.check, translation: row.translation, status: 404,
                 detail: localize("capture.index.seenin_not_held", "the record holds no such document that you may see; nothing was written") };
      }
      /* END DEC-49 REGION is-capture-held */
      const denied = this.#membership().projectAuthority(project, `member:${memberIdOf(by)}`, "joined", "captureseenin");
      if (denied) return { ...denied, status: 403 };
      const homeProject = home.project || null;
      const listed = homeProject === project || !!this.#one(`SELECT 1 AS x FROM seen_in WHERE capture_sha = ? AND project = ?`, captureSha, project);
      if (listed) return { ok: true, recorded: false, home: homeProject };
      const done = this.recordSeenIn({ captureSha, project, by, at: stampSecond(this.#instant()) });
      if (done.recorded !== true)
        return { ok: false, reason: "SEEN_IN_NOT_RECORDED", status: 502,
                 detail: localize("capture.index.seenin_not_recorded", "the record could not be written, so nothing was filed") };
      return { ok: true, recorded: true, home: homeProject };
    } catch {
      return { ok: false, reason: "SEEN_IN_NOT_RECORDED", status: 502,
               detail: localize("capture.index.seenin_not_recorded", "the record could not be written, so nothing was filed") };
    }
  }

  /** R69 (DEC-81 item 3(c)): a capture's actor appends a signed account of when and how they captured it. Refused
   *  `NOT_THE_CAPTURING_ACTOR` (C-118.5) for anyone this module did not record as capturing it (and for a capture it
   *  recorded no actor for), `ACCOUNT_NO_TEXT` (C-118.6), and `SIG_<reason>` unless `signature` verifies
   *  (`signatures.verifySshsig`, `NS_RATIFY`) over `signatures.captureAccountStatement(captureSha, text)` (its R41) against one of `by`'s
   *  attesting keys (`credentials.attestingKeys`, its R11). Append-only. */
  async recordCaptureAccount({ captureSha, text, signature, by, at = null } = {}) {
    /* R98 (T51; K4206): an absent captureSha names itself; C-118.5 is for a capture no member recorded as theirs */
    if (captureSha == null || (typeof captureSha === "string" && !captureSha.trim()))
      return Capture.#missingArgument("captureaccount", "captureSha", "<64 lowercase hex>", captureSha);
    const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
    const who = memberIdOf(by);
    const actors = HEX64.test(sha) ? this.#rows(`SELECT actor FROM capture_actors WHERE capture_sha = ?`, sha).map((r) => memberIdOf(r.actor)) : [];
    /* DEC-49 REGION is-capturing-actor */
    if (!who || !actors.includes(who)) {
      const row = CAPTURE_CHECKS.NOT_THE_CAPTURING_ACTOR;
      return { ok: false, reason: "NOT_THE_CAPTURING_ACTOR", code: "NOT_THE_CAPTURING_ACTOR", check: row.check,
               translation: row.translation, captureSha: sha || null, status: 403 };
    }
    /* END DEC-49 REGION is-capturing-actor */
    /* DEC-49 REGION is-account-worded */
    if (typeof text !== "string" || !text.trim()) {
      const row = CAPTURE_CHECKS.ACCOUNT_NO_TEXT;
      return { ok: false, reason: "ACCOUNT_NO_TEXT", code: "ACCOUNT_NO_TEXT", check: row.check, translation: row.translation,
               captureSha: sha, status: 400 };
    }
    /* END DEC-49 REGION is-account-worded */
    let keys = [];
    try { keys = (this.#credentials().attestingKeys() || []).filter((k) => memberIdOf(k.member_id) === who).map((k) => k.key_b64); }
    catch { keys = []; }
    const v = await verifySshsig(typeof signature === "string" ? signature : "", captureAccountStatement(sha, text), NS_RATIFY, keys);
    if (!v.ok) {
      const { ok: _ok, reason, ...rest } = v;
      return { ok: false, reason: `SIG_${reason}`, ...rest, captureSha: sha, status: 400,
               detail: localize("capture.index.signature_not_verified", "the signature does not verify over this account's statement against a key of yours that attests, so nothing was written") };
    }
    const when = at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant());
    const seq = this.#tx(() => {
      const n = Number(this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM capture_accounts WHERE capture_sha = ?`, sha).n) + 1;
      this.#sql.exec(`INSERT INTO capture_accounts (capture_sha, seq, by, text, signature, key_b64, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                     sha, n, by, text, signature, v.keyB64, when);
      return n;
    });
    return { ok: true, captureSha: sha, seq, by, at: when, key_b64: v.keyB64 };
  }

  /** R69: every account appended for a capture, in order, with the members recorded as capturing it. Never throws.
   *  N388 (REC-30): an account is its member's own words, which can name a project, so through the op it answers by
   *  the caller's `viewer` (membership R43, through the register's bundle, D-701's gate): a capture filed in a bundle
   *  the viewer may not see answers as one with nothing recorded, so an unseen capture and an unknown one read alike.
   *  No viewer (an in-process caller: `case-disclosures` R3's pre-flight) reads whole; the route never passes none. */
  captureAccountsOf(captureSha, { viewer = undefined } = {}) {
    try {
      const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
      if (!HEX64.test(sha)) return { captureSha: sha || null, actors: [], accounts: [] };
      if (!this.#captureSeen(sha, viewer)) return { captureSha: sha, actors: [], accounts: [] };
      return { captureSha: sha,
               actors: this.#rows(`SELECT actor, at FROM capture_actors WHERE capture_sha = ? ORDER BY at, actor`, sha),
               accounts: this.#rows(`SELECT seq, by, text, signature, key_b64, at FROM capture_accounts WHERE capture_sha = ? ORDER BY seq`, sha) };
    } catch { return { captureSha: null, actors: [], accounts: [] }; }
  }

  /** R68 (DEC-81 item 3(a)): a late co-attestation. N388: any caller the control plane admits may ask, a machine
   *  included, as for `attest`: the timestamp authority and the archive vouch, never the caller (Intake Doctrine §3),
   *  a late attestation proves existence only by its own instant, and `by` records who asked. It asks attestation's
   *  `attest` (its R2, R3) for a fresh timestamp over the digest and, with a public `locator`, a fresh co-archive, both
   *  through the host governor, then fetches the co-archive's raw replay through the governor too and compares its
   *  digest (`matches` true, false or undetermined). Each attempt's outcome is appended, dated, `late: true`, with the
   *  sentence "proves the bytes existed by <at>, not at capture". Refused `BAD_SHA`, and R63's absence when no bytes
   *  are held (a capture held in parts counts when provenance holds its receipt, provenance R5). */
  async reattest({ captureSha, locator = null, by = null } = {}) {
    const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
    if (!HEX64.test(sha)) return { ok: false, reason: "BAD_SHA", status: 400, detail: localize("capture.index.reattest_needs_sha", "reattest takes the sha256 of a capture the record holds") };
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    const p = this.provenance;
    const holds = async (s) => (p && typeof p.registerHolds === "function" ? p.registerHolds({ sha: s }) : null);
    let held = false;
    if (ev) {
      try { held = !!(await ev.head(sha)); } catch { held = false; }
      if (!held) { try { held = (await holds(sha))?.acquired === true; } catch { held = false; } }
    }
    if (!held) { const a = evidenceAbsent(sha, "bio", { status: 404 }); return a.body; }
    const archive = typeof locator === "string" && isPublicHttpsLocator(locator);
    let out;
    try {
      out = await attest({ sha256: sha, archive, locator: archive ? locator : null },
        { head: (s) => ev.head(s), put: (s, b) => ev.put(s, b), fetch: governedCall(this, "reattest"), holds });
    } catch (e) {
      out = { ok: false, attempts: [], reason: "ATTEST_FAILED", note: String(e && e.message || e).slice(0, 200) };
    }
    const attempts = Array.isArray(out && out.attempts) ? out.attempts.filter((a) => a && typeof a === "object") : [];
    if (!attempts.length && out && out.ok === false && out.reason !== "NO_ATTESTATION" && out.reason !== "ATTEST_FAILED")
      return { ...out, status: 409 };
    const outcomes = await this.#lateOutcomes(sha, attempts.length ? attempts
      : [{ service: "attest", ok: false, note: String((out && (out.note || out.reason)) || say("acquisition.string.attempt_reported")) }]);
    this.#appendLate(sha, outcomes, by);
    return { ok: true, captureSha: sha, late_attestations: outcomes, attested: out && out.ok === true,
             ...(out && out.attestation ? { attestation: out.attestation } : {}),
             note: say("capture.note.attempt_recorded_late") };
  }

  /* R68: the late outcomes of attestation attempts, each as `reattest` appends it: `kind` (the timestamp or the co-archive), the
     service, whether it answered, its instant, `late: true` and the sentence of what it proves, a timestamp's token digest and
     size, a co-archive's locator and whether its replay hashes to the capture. */
  async #lateOutcomes(sha, attempts) {
    const now = stampSecond(this.#instant());
    const outcomes = [];
    for (const a of attempts) {
      const at = typeof a.attempted === "string" && ISO_INSTANT.test(a.attempted) ? a.attempted : typeof a.at === "string" && ISO_INSTANT.test(a.at) ? a.at : now;
      const coArchive = a.service === ARCHIVE_SERVICE || a.kind === "co-archive" || a.kind === "co_archive";
      const o = { kind: coArchive ? "co_archive" : "timestamp", service: String(a.service || "attest"), ok: a.ok === true, at,
                  late: true, proves: lateSentence(at),
                  ...(a.kind === "rfc3161" ? { token_sha256: a.token_sha256 ?? null, token_bytes: a.token_bytes ?? null } : {}),
                  ...(a.archived_locator ? { archived_locator: a.archived_locator } : {}),
                  ...(a.note ? { note: String(a.note).slice(0, 200) } : {}) };
      if (coArchive) Object.assign(o, await this.#replayMatches(sha, o.ok ? a.archived_locator : null));
      outcomes.push(o);
    }
    return outcomes;
  }

  /* R68: append outcomes to `late_attestations`, in order after what is there, one transaction. */
  #appendLate(sha, outcomes, by) {
    this.#tx(() => {
      let seq = Number(this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM late_attestations WHERE capture_sha = ?`, sha).n);
      for (const o of outcomes)
        this.#sql.exec(`INSERT INTO late_attestations (capture_sha, seq, kind, service, ok, at, by, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                       sha, ++seq, o.kind, o.service, o.ok ? 1 : 0, o.at, by ?? null, JSON.stringify(o));
    });
  }

  /** R68 (T51; C12; `acquisition` R20): the attempts of an attestation that ended after its capture was answered (the timestamp
   *  and the co-archive `acquire` asked once the document was kept and did not wait for), recorded against the capture when they
   *  end, as late attestations, in the order appended; `by` the member whose capture it was. Answers `{ok: true, recorded}`;
   *  a digest that is not 64 hex, no attempts, or attempts that are not objects record nothing (`recorded: 0`). Never throws:
   *  an unrecorded late attempt leaves the capture as it was answered. */
  async recordLateAttestations({ captureSha, attempts, by = null } = {}) {
    try {
      const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
      const list = Array.isArray(attempts) ? attempts.filter((a) => a && typeof a === "object" && !Array.isArray(a)) : [];
      if (!HEX64.test(sha) || !list.length) return { ok: true, recorded: 0 };
      const outcomes = await this.#lateOutcomes(sha, list);
      this.#appendLate(sha, outcomes, by);
      return { ok: true, recorded: outcomes.length };
    } catch { return { ok: false, recorded: 0 }; }
  }

  /* R68: whether the co-archive's raw replay hashes to the capture digest. Undetermined, with the reason, when there
     is no archived locator, the replay cannot be fetched (the governor holding its host included), or it is too large. */
  async #replayMatches(sha, archived) {
    const replay = rawReplayOf(archived);
    if (!replay) return { matches: "undetermined", match_basis: say(archived ? "capture.match_basis.archived_locator_replay" : "capture.match_basis.co_archive_gave") };
    try {
      const g = await governedFetch(this, replay, "reattest");
      if (g.refusedByGovernor) return { matches: "undetermined", replay, match_basis: say("capture.match_basis.governor_holding_requests", { g: g.reason }) };
      const res = g.res;
      if (!res.ok || !res.body) return { matches: "undetermined", replay, match_basis: say("capture.match_basis.replay_answered", { status: res.status }) };
      const h = createSha256(), reader = res.body.getReader();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > REPLAY_MAX) { try { await reader.cancel(); } catch { /* gone */ } return { matches: "undetermined", replay, match_basis: say("capture.match_basis.replay_larger_group") }; }
        h.update(value);
      }
      const got = h.hex();
      return { matches: got === sha, replay, replay_sha256: got,
               match_basis: say(got === sha ? "capture.match_basis.co_archive_replay" : "capture.match_basis.co_archive_replay_holds") };
    } catch (e) {
      return { matches: "undetermined", replay, match_basis: say("capture.match_basis.replay_fetched", { e: String(e && e.message || e).slice(0, 120) }) };
    }
  }

  /** R68: the late attestations recorded for a capture, in the order appended. Never throws. N388: it takes no viewer:
   *  every field is the attempt's own (service, instant, token digest, archived locator, replay match) and who asked,
   *  and it names no bundle, so REC-30's rule leaves a row about a capture standing for every reader. */
  lateAttestationsOf(captureSha) {
    try {
      const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
      if (!HEX64.test(sha)) return { captureSha: sha || null, late_attestations: [] };
      return { captureSha: sha, late_attestations: this.#rows(`SELECT seq, by, outcome FROM late_attestations WHERE capture_sha = ? ORDER BY seq`, sha)
        .map((r) => ({ seq: r.seq, by: r.by, ...JSON.parse(r.outcome) })) };
    } catch { return { captureSha: null, late_attestations: [] }; }
  }

  /* R76, R95: whether the record holds a capture: its bytes in the evidence store, or provenance's register or receipt
     naming it (provenance R5). */
  async #holds(sha) {
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    let held = false;
    if (ev) { try { held = !!(await ev.head(sha)); } catch { held = false; } }
    if (!held && this.provenance && typeof this.provenance.registerHolds === "function") {
      try { const h = await this.provenance.registerHolds({ sha }); held = h?.registered === true || h?.acquired === true; }
      catch { held = false; }
    }
    return held;
  }

  /** R76 (DEC-95 (1)): the grade note of a capture this record holds (its bytes in the evidence store, or provenance's
   *  register or receipt naming it, provenance R5), so a capture completed with no member present carries it
   *  afterwards: `acquisition`'s `ACQUIRE_GRADE_NOTE`, the words `op=acquire`'s answer carries. By the viewer, as
   *  `captureAccountsOf`: a capture the viewer may not see, or one not held, answers `note: null`. Writes nothing and
   *  never throws. */
  async gradeNoteOf({ captureSha, viewer = undefined } = {}) {
    const sha = typeof captureSha === "string" ? captureSha.toLowerCase() : "";
    const none = { captureSha: sha || null, note: null };
    try {
      if (!HEX64.test(sha) || !this.#captureSeen(sha, viewer)) return none;
      if (!(await this.#holds(sha))) return none;
      /* K2455: a capture whose every receipt is a received route was not fetched, which the acquire note says it was;
         it answers null. Its receipts are read through provenance R60; a capture with none, or a read that fails,
         answers the note as before. */
      let rows = [];
      try { rows = this.provenance?.receiptsOfCapture?.({ captureSha: sha })?.rows ?? []; } catch { rows = []; }
      if (Array.isArray(rows) && rows.length && rows.every((r) => RECEIVED_VIAS.includes(r && r.via))) return none;
      return { captureSha: sha, note: ACQUIRE_GRADE_NOTE };
    } catch { return none; }
  }

  /** R95 (T50; N1124; `provenance` R24–R27): the grade of one capture, read on its own, `{ok: true, captureSha, grade}`:
   *  `grade` is `provenance.captureGrade(captureSha)`'s answer whole (as R77's `capture.grade`), so a page that holds a
   *  document's capture digest asks one read, not the project's list of held captures. By the viewer, as R76: a capture
   *  the viewer may not see, one never held, and one provenance does not answer (it throws, or answers no object) all
   *  answer `grade: null` alike. A `captureSha` that is not 64 lowercase hex is the required-argument refusal naming it.
   *  Writes nothing and never throws. */
  async captureGradeOf({ captureSha, viewer = undefined } = {}) {
    if (typeof captureSha !== "string" || !HEX64.test(captureSha))
      return Capture.#missingArgument("capturegrade", "captureSha", "64 lowercase hex characters", captureSha);
    const none = { ok: true, captureSha, grade: null };
    try {
      if (!this.#captureSeen(captureSha, viewer) || !(await this.#holds(captureSha))) return none;
      const g = typeof this.provenance?.captureGrade === "function" ? this.provenance.captureGrade(captureSha) : null;
      return { ok: true, captureSha, grade: g && typeof g === "object" && typeof g.then !== "function" ? g : null };
    } catch { return none; }
  }

  /* ==================================================================== *
   * Already in the record, and whether the source has since changed (R96; A64, K3807, DEC-330)
   * ==================================================================== */

  /* R96: the required-argument refusal of this read, for an argument given in a shape the read cannot use. */
  static #readArgument(argument, shape, given) {
    return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op: "heldat", argument, shape, status: 400,
             error: localize("capture.index.argument_must_be_shape_stringify_2", "{argument} must be {shape}; {stringify} is not", { argument: String(argument), shape: String(shape), stringify: String(JSON.stringify(String(given)).slice(0, 80)) }),
             detail: `op=heldat needs '${argument}' in the shape ${shape}, and this request carried none the operation could use. Nothing was read.` };
  }

  /* R96: the register document of a capture in its home bundle (`data/provenance.json`, the one the capture's digest names), or
     null when the record holds none. */
  #registerDocOf(bundleId, sha) {
    try {
      const f = this.#one(`SELECT content FROM files WHERE bundle_id = ? AND path = 'data/provenance.json'`, bundleId);
      const docs = f && typeof f.content === "string" ? JSON.parse(f.content).documents : null;
      const d = Array.isArray(docs) ? docs.find((x) => x && typeof x === "object" && x.capture?.sha256 === sha) : null;
      return d && typeof d === "object" ? d : null;
    } catch { return null; }
  }

  /* R96: how a document was captured, from its register document: `rendered`, `plain`, or null when the record cannot say. */
  #captureKindOf(d) {
    if (!d) return null;
    return d.capture?.method === RENDERED_METHOD || d.pair?.primary === "rendered" ? "rendered" : "plain";
  }

  /* R96 (T51; C26): what the copy recorded of its substance, `{digests, handler, handler_version}` from its register document's
     profile (`acquisition` R17), each null where the record names none. */
  #baselineOf(d) {
    const p = d && typeof d.profile === "object" && d.profile ? d.profile : {};
    return { digests: p.digests && typeof p.digests === "object" ? p.digests : null,
             handler: typeof p.handler === "string" ? p.handler : null,
             handler_version: p.handler_version ?? null };
  }

  /** R96 (T51; A64, K3807; DEC-330; `provenance` R17, R18; `acquisition` R11, R22): whether the record already holds an
   *  address or a digest, and whether the source has since changed. Exactly one of `address` (a public locator) and
   *  `sha256`, else the required-argument refusal, nothing read. `{ok: true, held, copy, versions, truncated, changed}`:
   *  `held` as the viewer may see a capture (its receipts and a register row whose home the viewer may see), an unseen
   *  capture reading as an unknown one; `copy` the compared copy (the newest visible capture at the address by last
   *  retrieval; for a digest, that capture); `versions` the distinct captures the viewer sees at that address (at most
   *  200 counted); `changed` `{state, basis, as_of, looked_at?, served_sha256?, earlier_differs}` relative to `copy` alone.
   *  Without `check` it is `undetermined`, decided from the record and never by a fetch. With `check: true`, from a member
   *  session only, one governed request for the copy's address, conditional on the validators of the copy's own fetch,
   *  decides `unchanged` (a 304, or bytes hashing to the copy's digest) or `changed`; nothing is filed, and the one write is
   *  R8's outcome. A refusal, a failure, a governed refusal, or a copy that is no plain fetch reads `undetermined`. Never
   *  throws: a store that cannot be read answers `held: null`. */
  async heldAt({ address = null, sha256 = null, check = false, viewer = undefined, member = null } = {}) {
    const given = (x) => x != null && x !== "";
    if (given(address) === given(sha256))
      return Capture.#readArgument(given(address) ? "sha256" : "address",
        "exactly one of `address` (a public https address) and `sha256` (64 lowercase hex characters)", given(address) ? sha256 : address);
    if (given(address) && (typeof address !== "string" || !isPublicHttpsLocator(address)))
      return Capture.#readArgument("address", "a public https address", address);
    if (given(sha256) && (typeof sha256 !== "string" || !HEX64.test(sha256)))
      return Capture.#readArgument("sha256", "64 lowercase hex characters", sha256);
    const looking = check === true;
    if (looking && (typeof member !== "string" || !memberIdOf(member).trim() || isMachineIdentity(member)))
      return { ok: false, reason: "MEMBER_SESSION_REQUIRED", status: 403,
               detail: localize("capture.index.heldat_member_act", "looking at the source is a signed-in member's act, whose stamp names them; nothing was fetched") };
    const undetermined = (basis, asOf = null, differs = false) =>
      ({ state: "undetermined", basis, as_of: asOf, earlier_differs: differs });
    let found;
    try { found = this.#heldAtRead({ address, sha256, viewer }); }
    catch {
      return { ok: true, held: null, copy: null, versions: null, truncated: false,
               changed: undetermined(localize("capture.index.heldat_record_unreadable", "the record could not be read, so whether it holds this, and whether the source has changed, is not known")) };
    }
    if (!found)
      return { ok: true, held: false, copy: null, versions: 0, truncated: false,
               changed: undetermined(localize("capture.index.heldat_no_copy_seen", "the record holds no copy of this that you may see, so there is nothing to compare")) };
    const { copy, receipt, kind, baseline, versions, truncated, differs } = found;
    const asOf = copy.as_of;
    delete copy.as_of;
    const base = { held: true, copy, versions, truncated };
    if (!looking)
      return { ok: true, ...base, changed: undetermined(
        localize("capture.index.the_record_holds_this_copy", "the record holds this copy as retrieved at {asOf} and has no later look at the source; a copy's age is not a look, so whether the site has changed since is not known from the record alone", { asOf: String(asOf) }), asOf, differs) };
    const no = (basis) => ({ ok: true, ...base, changed: undetermined(basis, asOf, differs) });
    if (!receipt.address) return no(localize("capture.index.heldat_no_address", "this copy has no address to look at"));
    if (receipt.via !== "direct" || kind === null || kind === "rendered" || !receipt.plain_address)
      return no(receipt.via !== "direct" ? localize("capture.index.heldat_not_plain_fetch", "this copy did not come from a plain fetch of the address (it was uploaded, handed over or read from an archive), so a plain look at the site cannot be compared with it")
              : kind === "rendered" ? localize("capture.index.heldat_rendered", "this copy is a rendered capture, which a plain look at the site cannot be compared with")
              : kind === null ? localize("capture.index.heldat_capture_unknown", "the record cannot say how this copy was captured, so a plain look at the site is not compared with it")
              : localize("capture.index.heldat_export", "this copy was not fetched from its own address (an export of it was), so a plain look at the site cannot be compared with it"));
    if (!isPublicHttpsLocator(receipt.address))
      return no(localize("capture.index.heldat_no_public_address", "this copy has no public address to look at"));
    /* One governed request, conditional on the validators of the copy's own filed fetch when it has them; nothing is filed. */
    const validators = this.validatorsOf({ addressNorm: receipt.address_norm, captureSha: copy.sha256 });
    const conditional = validators ? { ...(validators.etag ? { "if-none-match": validators.etag } : {}),
                                       ...(validators.lastModified ? { "if-modified-since": validators.lastModified } : {}) } : null;
    const looked = stampSecond(this.#instant());
    const outcome = async (kindOf, status = null) => {
      try { await this.recordSourceOutcome({ addressNorm: receipt.address_norm, outcome: kindOf, status, at: looked }); } catch { /* an unrecorded outcome is no answer */ }
    };
    let g;
    try { g = await governedFetch(this, receipt.address, "heldat", null, { headers: conditional }); }
    catch { await outcome("fetch_failed"); return no(localize("capture.index.heldat_request_incomplete", "the request for the address did not complete, so the source was not looked at")); }
    if (g.refusedByGovernor) {
      await outcome("governed");
      return no(localize("capture.index.heldat_host_paced", "the host is being given time between requests, so the source was not looked at"));
    }
    const res = g.res;
    const drop = async () => { try { await res.body?.cancel?.(); } catch { /* gone */ } };
    const looks = (state, extra = {}, basis = null) => ({ ok: true, ...base, changed: { state, basis: basis ?? (state === "unchanged"
      ? localize("capture.index.heldat_same_document", "the site still gives the same document as this copy") : localize("capture.index.heldat_changed_document", "the site now gives a different document from this copy")),
      as_of: asOf, looked_at: looked, ...extra, earlier_differs: differs } });
    if (res.status === 304 && conditional) { await drop(); await outcome("success", 304); return looks("unchanged"); }
    if (!res.ok || !res.body) {
      await drop(); await outcome("source_refused", res.status);
      return no(localize("capture.index.the_site_answered_status_so", "the site answered {status}, so it did not give the document to compare", { status: String(res.status) }));
    }
    /* R105 (G2): a source that declares more than the bound is not read; neither is one that goes past it while being read */
    const declared = Number(res.headers.get("content-length"));
    const tooLarge = async () => {
      await drop(); await outcome("success", res.status);
      return { ok: true, ...base, changed: { ...undetermined(localize("capture.index.heldat_over_check_bound", "the document at the address is larger than this look reads, so whether it has changed was not looked at"), asOf, differs),
                                             large: true, looked_at: looked } };
    };
    if (Number.isFinite(declared) && declared > HELD_AT_CHECK_MAX) return tooLarge();
    const h = createSha256(), reader = res.body.getReader();
    let total = 0;
    /* C26: the bytes are kept as they arrive, up to the bound a substance digest is taken within, to be judged by substance */
    const kept = [];
    let keeping = true;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > HELD_AT_CHECK_MAX) { try { await reader.cancel(); } catch { /* gone */ } return tooLarge(); }
        h.update(value);
        if (keeping && total <= PROFILE_TEXT_MAX) kept.push(value); else { keeping = false; kept.length = 0; }
      }
    } catch { await outcome("fetch_failed"); return no(localize("capture.index.heldat_not_whole", "the document did not arrive whole, so the source was not looked at")); }
    await outcome("success", res.status);
    const served = h.hex();
    if (served === copy.sha256) return looks("unchanged");
    /* R96 (C26): the bytes differ, which a page that rebuilds itself on every visit does whether or not its substance changed. Change
       is judged on the determined (substance) digest: both sides must have earned one, over the same member of the package and
       under the same handler; with no determined digest on the copy, or on what the site serves, the answer is that it cannot be
       told, never `changed`. */
    const cannot = (basis) => looks("undetermined", {}, basis);
    const bd = baseline && baseline.digests;
    if (!bd || bd.determined !== true || typeof bd.evidentiary !== "string" || !bd.evidentiary)
      return cannot(localize("capture.index.heldat_baseline_no_digest", "the bytes the site gives differ from this copy's, but this copy recorded no determined digest of its substance, so whether the page itself has changed cannot be told"));
    if (!keeping) return cannot(localize("capture.index.heldat_served_too_large", "the bytes the site gives differ from this copy's, and are larger than this surface takes a digest of the substance within, so whether the page itself has changed cannot be told"));
    const whole = new Uint8Array(total);
    { let at = 0; for (const c of kept) { whole.set(c, at); at += c.length; } }
    const hdrs = {};
    for (const [hk, hv] of res.headers) hdrs[hk.toLowerCase()] = hv;
    const fresh = await servedSubstance({ bytes: whole, headers: hdrs, locator: receipt.address, contentType: res.headers.get("content-type") || null,
                                          view: profileView(this.core).view });
    const sameOver = (bd.over || null) === (fresh.digests.over || null);
    if (!sameOver || fresh.handler !== baseline.handler || String(fresh.handler_version) !== String(baseline.handler_version))
      return cannot(localize("capture.index.heldat_other_handler", "the bytes the site gives differ from this copy's and are read as another kind of page than this copy was, so whether the page itself has changed cannot be told"));
    if (fresh.digests.determined !== true)
      return cannot(localize("capture.index.heldat_served_no_digest", "the bytes the site gives differ from this copy's and earn no determined digest of their substance, so whether the page itself has changed cannot be told"));
    return fresh.digests.evidentiary === bd.evidentiary
      ? looks("unchanged", {}, localize("capture.index.heldat_same_substance", "the site gives different bytes from this copy, but their substance is the same: only what the page rebuilds on every visit differs"))
      : looks("changed", { served_sha256: served }, localize("capture.index.heldat_changed_substance", "the substance of what the site now gives differs from this copy's"));
  }

  /* R96: what the record holds for an address or a digest, as the viewer may see it: the compared copy with its newest
     receipt, how it was captured, the distinct visible captures at its address and whether another of them differs.
     Null when nothing the viewer may see is held. A read that cannot be made throws, and `heldAt` answers it `held: null`. */
  #heldAtRead({ address, sha256, viewer }) {
    const sight = this.#sightOf(viewer);
    const seenAt = (norm) => this.#rows(
      `SELECT cl.capture_sha AS sha, MAX(julianday(cl.last_retrieved)) AS last FROM captured_locators cl
         JOIN register r ON r.capture_sha = cl.capture_sha JOIN bundles b ON b.bundle_id = r.bundle_id
        WHERE cl.address_norm = ? AND (${sight.sql}) GROUP BY cl.capture_sha
        ORDER BY last DESC, cl.capture_sha DESC LIMIT ?`, norm, ...sight.args, HELD_AT_VERSIONS_MAX + 1);
    const addressNorm = address ? normalizeAddress(address) : null;
    let sha, atNorm = addressNorm;
    if (address) {
      const seen = seenAt(addressNorm);
      if (!seen.length) return null;
      sha = seen[0].sha;
    } else {
      const home = this.#one(`SELECT 1 AS x FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id WHERE r.capture_sha = ? AND (${sight.sql})`,
                             sha256, ...sight.args);
      if (!home) return null;
      sha = sha256;
    }
    const receipt = this.#one(
      `SELECT address_norm, address, via, retrieval_locator, last_retrieved FROM captured_locators
        WHERE capture_sha = ? ${address ? "AND address_norm = ?" : ""}
        ORDER BY julianday(last_retrieved) DESC, via, address_norm LIMIT 1`, sha, ...(address ? [addressNorm] : []));
    const home = this.#one(`SELECT r.bundle_id, b.project, b.title FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id WHERE r.capture_sha = ?`, sha);
    const regDoc = this.#registerDocOf(home.bundle_id, sha);
    const first = this.#one(`SELECT first_retrieved AS at FROM captured_locators WHERE capture_sha = ?
                              ORDER BY julianday(first_retrieved), first_retrieved LIMIT 1`, sha)?.at;
    const actor = this.#one(`SELECT actor FROM capture_actors WHERE capture_sha = ? ORDER BY at, actor LIMIT 1`, sha)?.actor;
    let grade = null;
    try {
      const g = typeof this.provenance?.captureGrade === "function" ? this.provenance.captureGrade(sha) : null;
      grade = g && typeof g === "object" && typeof g.then !== "function" ? g : null;
    } catch { grade = null; }
    if (!address && receipt) atNorm = receipt.address_norm;
    /* The address's visible captures: for a digest, those at its own address when that is public, else only itself. */
    let versions, truncated = false, differs = false;
    if (atNorm && (address || isPublicHttpsLocator(receipt.address))) {
      const seen = seenAt(atNorm);
      truncated = seen.length > HELD_AT_VERSIONS_MAX;
      versions = Math.min(seen.length, HELD_AT_VERSIONS_MAX);
      differs = seen.some((x) => x.sha !== sha);
    } else versions = 1;
    const at = (x) => { const t = typeof x === "string" ? Date.parse(x) : NaN; return Number.isFinite(t) ? stampSecond(t) : null; };
    let plain = false;
    if (receipt) {
      try { plain = !receipt.retrieval_locator || normalizeAddress(receipt.retrieval_locator) === receipt.address_norm; } catch { plain = false; }
    }
    return {
      copy: { sha256: sha, document: home.bundle_id, project: home.project || null, title: typeof home.title === "string" && home.title.trim() ? home.title : null, retrieved: at(first),
              actor: typeof actor === "string" && actor ? actor : null, grade, address: receipt ? receipt.address : null,
              as_of: receipt ? at(receipt.last_retrieved) : null },
      receipt: receipt ? { ...receipt, plain_address: plain } : { via: null, plain_address: false },
      kind: this.#captureKindOf(regDoc), baseline: this.#baselineOf(regDoc), versions, truncated, differs,
    };
  }

  /* ==================================================================== *
   * Held captures (R77–R79, R81–R84; DEC-97, DEC-141)
   * ==================================================================== */

  /* R77: the SQL of a document's standing: an Information document at `collected` whose latest held act is not a
     set-aside, seen by the viewer (membership R43 over record-core's `bundles`, R37). */
  static #LATEST_ACT = `COALESCE((SELECT h.act FROM held_acts h WHERE h.bundle_id = b.bundle_id ORDER BY h.seq DESC LIMIT 1), '')`;
  static #NOT_SET_ASIDE = `${Capture.#LATEST_ACT} <> 'set_aside'`;
  /* R88: its latest held act is a set-aside. */
  static #IS_SET_ASIDE = `${Capture.#LATEST_ACT} = 'set_aside'`;
  /* R77: when it was collected: `created` while it has never left `collected` (no prior state), else the instant its
     state last moved, `last_updated` (record-core keeps no other per-state instant). */
  static #SINCE = `CASE WHEN b.prior_state IS NULL THEN b.created ELSE b.last_updated END`;
  /* R77: its source as provenance records it: the earliest acquisition receipt (provenance R48) of a capture the
     document's register rows name. */
  static #SOURCE = (col) => `(SELECT cl.${col} FROM register r JOIN captured_locators cl ON cl.capture_sha = r.capture_sha
                               WHERE r.bundle_id = b.bundle_id ORDER BY cl.first_retrieved, cl.address, cl.via LIMIT 1)`;

  #sightOf(viewer) {
    if (viewer === undefined) return { sql: "1=1", args: [] };
    const g = viewerPredicate(viewer);
    return { sql: g.sql, args: g.args };
  }

  /* R77: the WHERE terms of a held document: an Information document at `collected`, not set aside (R88: set aside, for
     the `set_aside` list), seen by the viewer, and passing the `member` and `project` filters; with their arguments. One
     builder for the list and for asking whether one document (an archive's, R77's grouping) is a row of it. */
  #heldWhere({ viewer, who, project, bundleId = null, aside = false, vouched = false }) {
    const sight = this.#sightOf(viewer);
    const hasProject = project != null && project !== "";
    const hasBundle = bundleId != null && bundleId !== "";
    /* R88 (T51): `held_and_vouched` adds the documents at `verified`, whose held acts are not asked (R79 never sets a
       vouched document aside). */
    const standing = vouched ? `((b.current_state = 'collected' AND ${Capture.#NOT_SET_ASIDE}) OR b.current_state = '${VOUCHED_STATE}')`
                             : `b.current_state = 'collected' AND ${aside ? Capture.#IS_SET_ASIDE : Capture.#NOT_SET_ASIDE}`;
    return {
      sql: `b.object_type = 'information' AND ${standing} AND (${sight.sql})
            AND ${who ? `EXISTS (SELECT 1 FROM register r JOIN capture_actors ca ON ca.capture_sha = r.capture_sha
                                  WHERE r.bundle_id = b.bundle_id
                                    AND (CASE WHEN ca.actor LIKE 'member:%' THEN substr(ca.actor, 8) ELSE ca.actor END) = ?)` : "1=1"}
            AND ${hasProject ? `(b.project = ? OR EXISTS (SELECT 1 FROM register r JOIN seen_in si ON si.capture_sha = r.capture_sha
                                                         WHERE r.bundle_id = b.bundle_id AND si.project = ?))` : "1=1"}
            AND ${hasBundle ? "b.bundle_id = ?" : "1=1"}`,
      args: [...sight.args, ...(who ? [who] : []), ...(hasProject ? [String(project), String(project)] : []), ...(hasBundle ? [String(bundleId)] : [])],
    };
  }

  /** R77 (DEC-97 (1)): the Information documents at `collected` not set aside, as the viewer may see them, at most
   *  `limit` (N90), with `truncated` and `next`. `member` keeps the documents that member captured (`capture_actors`
   *  over the register); `project` that project's (the document's `project`). Each row: the document, its source, its
   *  project, its age since collected, its batch eligibility (R78) and `captured_for`, the questions it was captured for as
   *  R83's reader answers them for the viewer (DEC-141 (1)). Sorted by `age` (the default, oldest first),
   *  `source` or `project`, either way, a row with none last; ties by id. Writes nothing; nothing is notified.
   *
   *  DEC-167 (8) (N688; T35): a document whose capture is a file cut out of an archive (`acquisition.memberOf`) is listed
   *  beside its archive, not as a row of its own, while its archive's document is a row of this list for the viewer:
   *  that row carries `archive` (`acquisition.archiveList`'s summary) and `files`, its held files the viewer may see
   *  passing the same filters, in index order, at most `HELD_FILES_IN_ROW` with `files_total` and `files_truncated`. A
   *  file whose archive is not a row is a row of its own, with `archive: {sha256}`. `limit` counts rows, never files:
   *  the page is read in windows and a file shown beside its archive is skipped, so a page holds `limit` rows.
   *
   *  R91 (T49; N1080): the examination of each document the page shows and the archive grouping of each row are asked
   *  together, once each, under one wait of `HELD_PAGE_WAIT_MS`; an answer not given in time reads undetermined
   *  (`#pageAnswers`). Nothing else in the answer changes.
   *
   *  P10 (fix round 4; K4429): a screen reads the page as `picker` rows, and `bundle_ids` (at most `HELD_IDS_MAX`) for the heavy
   *  fields of the documents it draws; only those rows are answered, the list and its order are the page's, and the
   *  store's reads overlap the examinations and groupings of the same page. */
  async heldCaptures({ member = null, project = null, bundle_id: bundleId = null, bundle_ids: bundleIds = null, sort = null, dir = null, limit = null, after = null,
                       viewer = undefined, now = null, state = null, fields = null } = {}) {
    const by = sort == null || sort === "" ? "age" : sort;
    if (!HELD_SORTS.includes(by)) return Capture.#badArgument("heldcaptures", "sort", HELD_SORTS.join(" | "), by);
    const way = dir == null || dir === "" ? (by === "age" ? "desc" : "asc") : dir;
    if (!SORT_DIRS.includes(way)) return Capture.#badArgument("heldcaptures", "dir", SORT_DIRS.join(" | "), way);
    /* R88: `held` (absent or empty) is R77's list, `set_aside` the documents set aside, by the same sight, filters, sorts,
       bound and fields, each row also carrying its latest set-aside. */
    const list = state == null || state === "" ? "held" : state;
    if (!HELD_STATES.includes(list)) return Capture.#badArgument("heldcaptures", "state", HELD_STATES.join(" | "), list);
    const aside = list === "set_aside", vouched = list === "held_and_vouched";
    /* R77 (T51; C14): `full` (absent or empty) is R77's rows; `picker` the cheap rows; any other is refused as an unknown `state` is. */
    const shape = fields == null || fields === "" ? "full" : fields;
    if (!HELD_FIELDS.includes(shape)) return Capture.#badArgument("heldcaptures", "fields", HELD_FIELDS.join(" | "), shape);
    /* R77 (fix round 4; P10): `bundle_ids` names the documents a screen draws; only they are answered, in the page's order. */
    const picked = Capture.#idsOf(bundleIds);
    if (picked === null) return Capture.#badArgument("heldcaptures", "bundle_ids", localize("capture.index.bundle_ids_shape", "a list of at most {max} document ids", { max: HELD_IDS_MAX }), bundleIds);
    const cap = limitOf(limit);
    const from = after ? keyOf(after, 3) : null;
    if (after && !from) return badCursor();
    /* Age descending is `since` ascending: the longest held first. */
    const k1 = { age: "since", source: "COALESCE(src_address, '')", project: "COALESCE(project, '')" }[by];
    const k0 = by === "age" ? "'0'" : by === "source" ? "CASE WHEN src_address IS NULL THEN '1' ELSE '0' END"
                                                    : "CASE WHEN project IS NULL OR project = '' THEN '1' ELSE '0' END";
    const asc = by === "age" ? way === "desc" : way === "asc";
    const who = typeof member === "string" && member ? memberIdOf(member) : null;
    const where = this.#heldWhere({ viewer, who, project, bundleId, aside, vouched });
    const window = (key, n) => this.#rows(
      `SELECT * FROM (SELECT bundle_id, title, project, since, standing, src_address, src_via, src_retrieved, ${k0} AS k0, ${k1} AS k1 FROM (
         SELECT b.bundle_id, b.title, b.project, b.current_state AS standing, ${Capture.#SINCE} AS since, ${Capture.#SOURCE("address")} AS src_address,
                ${Capture.#SOURCE("via")} AS src_via, ${Capture.#SOURCE("first_retrieved")} AS src_retrieved
           FROM bundles b WHERE ${where.sql}${picked.length ? " AND b.bundle_id IN (SELECT value FROM json_each(?))" : ""})) q
        WHERE ${key ? `(k0 > ? OR (k0 = ? AND (k1 ${asc ? ">" : "<"} ? OR (k1 = ? AND bundle_id > ?))))` : "1=1"}
        ORDER BY k0 ASC, k1 ${asc ? "ASC" : "DESC"}, bundle_id ASC LIMIT ?`,
      ...where.args, ...(picked.length ? [JSON.stringify(picked)] : []), ...(key ? [key[0], key[0], key[1], key[1], key[2]] : []), n);
    /* R77 (DEC-167 (8)): whether a document is a row of this list (the same filters; `bundle_ids` selects what is answered, it does
       not shrink the list, so an archive asked by its id still groups the files beside it), memoised for the page. */
    const isRow = new Map();
    const rowOf = (bundleId) => {
      if (!bundleId) return false;
      if (!isRow.has(bundleId))
        isRow.set(bundleId, !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id = ? AND ${where.sql}`, bundleId, ...where.args));
      return isRow.get(bundleId);
    };
    const kept = [];
    let key = from, more = true;
    while (kept.length <= cap && more) {
      const found = window(key, cap + 1);
      more = found.length > cap;
      if (!found.length) break;
      const last = found[found.length - 1];
      key = [String(last.k0), String(last.k1), last.bundle_id];
      const archives = this.#archivesOfDocuments(found.map((r) => r.bundle_id));
      for (const r of found) {
        const of = archives.get(r.bundle_id) || [];
        /* Beside an archive that is a row: not a row of its own. */
        if (of.some((a) => rowOf(a.bundle))) continue;
        kept.push({ ...r, of_archive: of.length ? of[0].sha256 : null });
        if (kept.length > cap) break;
      }
    }
    const page = kept.slice(0, cap), truncated = kept.length > cap, last = page[page.length - 1];
    const at = now != null && Number.isFinite(Date.parse(now)) ? Date.parse(now) : this.#instant();
    /* R77 (T51; C14): what the page's rows need of the store is read for the whole page at once, never for each row in turn. */
    const facts = this.#pageFacts(page.map((r) => r.bundle_id), { aside, vouched, picker: shape === "picker" });
    /* R77 (T51 fix round 2; C10): whether the evidence store holds an object under each row's fingerprint. */
    /* R77 (T51 fix round 3; C14): the picker row answers it from the size the register recorded and asks the store nothing. */
    /* R91 (fix round 4; P10): the store's reads and the page's examinations and groupings are begun together, and the page waits for both. */
    /* R77 (fix round 5; E13; P10): a full row answers `whole` true, without asking the store, for a capture the register records as held
       in one part (its own whole), and asks the store about the rest (no size recorded, or a capture held in parts, whose whole may be
       owed); with no evidence store it is undetermined, as before. */
    const store = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    const [wholes, answers] = shape === "picker" ? [new Map(), null] : await Promise.all([
      this.#wholeOf(page.map((r) => facts.first.get(r.bundle_id)).filter((reg) => reg && Capture.#keptWholeBySize(reg, facts) !== true).map((reg) => reg.capture_sha)),
      this.#pageAnswers(page, { viewer, rowOf, vouched, facts })]);
    const wholeOf = shape === "picker"
      ? (id) => Capture.#wholeBySize(facts.first.get(id))
      : (id) => {
        const reg = facts.first.get(id);
        if (!reg?.capture_sha) return null;
        return store && Capture.#keptWholeBySize(reg, facts) === true ? true : wholes.get(reg.capture_sha) ?? null;
      };
    /* R77 (T51 fix round 3; C9): a document listed because it was seen in the asked project, not because it lives there. */
    const alsoHere = (r) => (project != null && project !== "" && (r.project || "") !== String(project) ? { also_here: { home: r.project || null } } : {});
    if (shape === "picker") {
      /* R77 (T51 fix round 2): and the three a screen's to-do reads of a row: `source`, `collected_since` and `actor`, as the full row gives them. */
      const rows = page.map((r) => ({ bundle_id: r.bundle_id, title: r.title ?? null, project: r.project || null,
                                      source: r.src_address ? { address: r.src_address, via: r.src_via, retrieved: r.src_retrieved } : null,
                                      collected_since: r.since,
                                      capture: facts.first.has(r.bundle_id) ? { sha256: facts.first.get(r.bundle_id).capture_sha } : null,
                                      actor: this.#captureFacts(facts.first.get(r.bundle_id) ?? null, facts).actor,
                                      format: facts.first.has(r.bundle_id) ? facts.formats.get(facts.first.get(r.bundle_id).capture_sha) ?? null : null,
                                      whole: wholeOf(r.bundle_id),
                                      standing: r.standing === VOUCHED_STATE ? VOUCHED_STATE : "collected", ...alsoHere(r) }));
      return { ok: true, held: rows, state: list, sort: by, dir: way, limit: cap, truncated,
               next: truncated ? cursorOf([String(last.k0), String(last.k1), last.bundle_id]) : null };
    }
    /* R77 (T51 fix round 2; C14): the page's captures are graded in one batch (provenance R71), never one read for each. */
    const grades = this.#gradesOf(page.map((r) => facts.first.get(r.bundle_id)?.capture_sha));
    const gradeOf = (sha) => grades.get(sha) ?? null;
    const rows = [];
    for (const r of page) {
      const since = Date.parse(r.since);
      const asked = this.#questionsOf(r.bundle_id, viewer, { captures: facts.captures.get(r.bundle_id) ?? [], asks: facts.asks.get(r.bundle_id) ?? [] });
      const { eligibility, grouped } = answers.get(r.bundle_id);
      const reg = facts.first.get(r.bundle_id) ?? null;
      rows.push({ bundle_id: r.bundle_id, title: r.title ?? null, project: r.project || null,
                  source: r.src_address ? { address: r.src_address, via: r.src_via, retrieved: r.src_retrieved } : null,
                  collected_since: r.since, age_days: Number.isFinite(since) ? Math.max(0, Math.floor((at - since) / 86400000)) : null,
                  ...eligibility,
                  ...(asked.questions ? { captured_for: Capture.#shown(asked.questions) }
                                      : { captured_for: null, captured_for_basis: asked.basis }),
                  ...(grouped || (r.of_archive ? { archive: { sha256: r.of_archive } } : {})),
                  capture: reg ? { sha256: reg.capture_sha, grade: gradeOf(reg.capture_sha) } : null,
                  ...this.#captureFacts(reg, facts),
                  format: reg ? facts.formats.get(reg.capture_sha) ?? null : null,
                  whole: wholeOf(r.bundle_id),
                  ...alsoHere(r),
                  ...(aside ? { set_aside: facts.setAside.get(r.bundle_id) ?? null } : {}),
                  ...(vouched ? this.#standingOf(r.bundle_id, r.standing, facts.history.get(r.bundle_id) ?? null) : {}) });
    }
    return { ok: true, held: rows, state: list, sort: by, dir: way, limit: cap, truncated,
             next: truncated ? cursorOf([String(last.k0), String(last.k1), last.bundle_id]) : null };
  }

  /* R77 (fix round 4; P10): the document ids `bundle_ids` names, as a list of at most `HELD_IDS_MAX` distinct non-blank strings: absent,
     null, blank or empty names none (`[]`); a comma-separated string (the op's query) is split; anything else is `null`, a refusal. */
  static #idsOf(x) {
    if (x == null || x === "") return [];
    const list = typeof x === "string" ? x.split(",").map((i) => i.trim()).filter(Boolean) : x;
    if (!Array.isArray(list) || list.some((i) => typeof i !== "string" || !i.trim() || i.length > 300)) return null;
    const distinct = [...new Set(list)];
    return distinct.length > HELD_IDS_MAX ? null : distinct;
  }

  /* R77 (T51 fix round 3; C14): whether the copy is held whole, from the size the register recorded when the capture was kept
     (`reg` is the register's first capture of the document): true when that size is one the store keeps whole (up to
     `MULTIPART_KEEP_MAX`, `acquisition` R10), false past it, where the capture is held in its parts alone; null when the register
     records no capture or no size. No read of the evidence store. */
  static #wholeBySize(reg) {
    const size = reg && (typeof reg.bytes === "number" || typeof reg.bytes === "bigint") ? Number(reg.bytes) : NaN;
    return Number.isSafeInteger(size) && size >= 0 ? size <= MULTIPART_KEEP_MAX : null;
  }

  /* R77 (fix round 5; E13; K4530, B20): true when the register recorded a size that fits one part (`UPLOAD_PART`, `acquisition`
     R10's form), for such a capture is its own whole; null when it recorded none or a larger one, a capture held in parts, whose
     whole object may be owed (its `keep` row unrun) or held (`keepPast`, R103), so only the store can say. */
  static #keptWholeBySize(reg, facts = null) {
    if (reg && (reg.whole === true || (facts && facts.parts.has(reg.capture_sha)))) return null;
    const size = reg && (typeof reg.bytes === "number" || typeof reg.bytes === "bigint") ? Number(reg.bytes) : NaN;
    return Number.isSafeInteger(size) && size >= 0 && size <= UPLOAD_PART ? true : null;
  }

  /* R77 (T51 fix round 2; C10): for the page's capture digests, a Map from digest to whether the evidence store holds an
     object under it (`head`): true, or false for a copy held in parts only (past `MULTIPART_KEEP_MAX`, or kept before the
     whole was), which the screens withhold vouch and OCR from; null where it cannot be said (no evidence store, a head that
     fails, or the page's wait (`HELD_PAGE_WAIT_MS`) ran out first). Each distinct digest is asked once, `HELD_PAGE_LANES` at a
     time, and nothing is asked once the wait has run out. Never throws; an empty page asks nothing. */
  async #wholeOf(shas) {
    const out = new Map();
    const distinct = [...new Set(shas.filter((s) => typeof s === "string" && s))];
    if (!distinct.length) return out;
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    for (const s of distinct) out.set(s, null);
    if (!ev || typeof ev.head !== "function") return out;
    /* R77 (fix round 7; G78): an object this instance has seen held is held (a stored object is immutable and never removed), so it is not
       asked again; the register is never the source, and an answer of false or unknown is asked again at every draw. */
    const ask = distinct.filter((s) => { if (this.#provenHeld.has(s)) { out.set(s, true); return false; } return true; });
    if (!ask.length) return out;
    const wait = Capture.#pageWait(HELD_PAGE_WAIT_MS);
    const began = Date.now();
    let heads = 0;
    try {
      let next = 0;
      const lane = async () => {
        while (next < ask.length && !wait.over()) {
          const s = ask[next++];
          heads++;
          const got = await wait.within((async () => { try { return !!(await ev.head(s)); } catch { return null; } })());
          out.set(s, got === TOO_LATE ? null : got);
          if (got === true) {
            if (this.#provenHeld.size >= HELD_PROVEN_MAX) this.#provenHeld.clear();
            this.#provenHeld.add(s);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(HELD_PAGE_LANES, ask.length) }, lane));
    } finally { wait.stop(); }
    /* G78 (rides the deploy): what a draw cost the store, so a slow one can be named: the heads asked and the time they took altogether */
    try { console.log(JSON.stringify({ capture: "heldcaptures", heads, head_ms: Date.now() - began, remembered: distinct.length - ask.length })); } catch { /* a log that cannot be written */ }
    return out;
  }

  /* R77 (T51 fix round 2; C14's bound): the grades of a page's captures, a Map from digest to `provenance.captureGrade`'s
     answer whole, read in ONE batch (`provenance.captureGrades`, its R71), each distinct digest once; a digest nothing answers
     for, or an answer that is no object (a promise, a string), maps to null, as a throw of the whole batch does. A provenance
     that serves no batch is asked one digest at a time, as before. An empty page asks nothing. */
  #gradesOf(shas) {
    const out = new Map();
    const distinct = [...new Set(shas.filter((s) => typeof s === "string" && s))];
    if (!distinct.length) return out;
    const plain = (g) => (g && typeof g === "object" && typeof g.then !== "function" ? g : null);
    try {
      if (typeof this.provenance?.captureGrades === "function") {
        const got = this.provenance.captureGrades(distinct);
        distinct.forEach((s, i) => out.set(s, Array.isArray(got) ? plain(got[i]) : null));
      } else {
        for (const s of distinct) {
          let g = null;
          try { g = typeof this.provenance?.captureGrade === "function" ? plain(this.provenance.captureGrade(s)) : null; } catch { g = null; }
          out.set(s, g);
        }
      }
    } catch { for (const s of distinct) out.set(s, null); }
    return out;
  }

  /* R88 (T51): a row's `standing`, `collected` or `verified`, and for a vouched one `vouched: {by, at}`, the author and
     instant of the release's entry in the document's own `state_history` (promotion R32; `content`, its `bundle.md`): its
     latest move to `verified`. A field the entry does not give, or a history that cannot be read, is null. */
  #standingOf(bundleId, state, content = undefined) {
    if (state !== VOUCHED_STATE) return { standing: "collected" };
    let entry = null;
    try {
      const text = content !== undefined ? content : this.#one(`SELECT content FROM files WHERE bundle_id = ? AND path = 'bundle.md'`, bundleId)?.content;
      const hist = typeof text === "string" ? parseFrontmatter(text).data?.state_history : null;
      if (Array.isArray(hist)) entry = [...hist].reverse().find((e) => e && typeof e === "object" && e.to_state === VOUCHED_STATE) ?? null;
    } catch { entry = null; }
    const given = (x) => (typeof x === "string" && x ? x : null);
    return { standing: VOUCHED_STATE, vouched: { by: given(entry?.author), at: given(entry?.timestamp) } };
  }

  /* R77 (T51; N1235; C14): the capture's own facts a held row answers, `actor` (`acquisition` R16; for an upload R86's `by`),
     `retrieved` (the whole-second UTC instant of the capture's first receipt) and `bytes` (the register's size of the
     whole capture, an archive row's the archive's): each null when the record cannot say. `reg` is the register's first
     capture of the document, `facts` what `#pageFacts` read for the page. */
  #captureFacts(reg, facts) {
    const none = { actor: null, retrieved: null, bytes: null };
    if (!reg || typeof reg.capture_sha !== "string") return none;
    const actor = facts.actor.get(reg.capture_sha);
    const first = facts.retrieved.get(reg.capture_sha);
    const size = reg.bytes;
    const bytes = typeof size === "number" || typeof size === "bigint" ? Number(size) : NaN;
    const at = typeof first === "string" ? Date.parse(first) : NaN;
    return { actor: typeof actor === "string" && actor ? actor : null, retrieved: Number.isFinite(at) ? stampSecond(at) : null,
             bytes: Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null };
  }

  /* R77, R88 (T51; C14): WHAT A PAGE OF ROWS NEEDS OF THE STORE, READ FOR THE WHOLE PAGE AT ONCE (a bounded number of reads
     however many rows the page shows, never one set of reads for each row). For the page's documents `bundleIds`:
       captures  each document's register captures, in digest order, and `first` the one first registered (ties by digest;
                 provenance R48), with the size the register holds;
       actor, retrieved  of each first capture: the member recorded first, the instant of its first receipt;
       asks      the (question, asker) pairs R94 recorded for a document's captures, in question then asker order;
       setAside  (the set-aside list) each document's latest set-aside as R79 recorded it;
       history   (the vouched list) each vouched document's own `bundle.md`, which holds the release's entry;
       formats   the format the document's own register document profiles each capture as, `null` where it names none
                 (`data/provenance.json`, acquisition R17), so that a capture profiled as no archive is not asked of the archive's
                 listing, and a document whose profile cannot be read is;
       opened    the captures acquisition recorded opening as archives.
     `picker` reads only the captures and their actors. Each read that fails reads as nothing known, which the row states as it always has. */
  #pageFacts(bundleIds, { aside = false, vouched = false, picker = false } = {}) {
    const facts = { captures: new Map(), first: new Map(), actor: new Map(), retrieved: new Map(), asks: new Map(),
                    setAside: new Map(), history: new Map(), formats: new Map(), opened: new Set(), parts: new Set(), notArchives: new Set() };
    if (!bundleIds.length) return facts;
    const ids = JSON.stringify(bundleIds);
    const read = (q, ...a) => { try { return this.#rows(q, ...a); } catch { return []; } };
    /* G6 (fix round 6): the capture a row stands for is the document's WHOLE, provenance R72's row (`whole` 1) first, then the
       earliest registered, ties by digest; a store whose register has no `whole` column (a test's stand-in) orders as before. */
    const wholeFirst = this.#registerHasWhole() ? "COALESCE(whole, 0) DESC, " : "";
    const regs = read(`SELECT bundle_id, capture_sha, bytes, rn FROM (
                         SELECT bundle_id, capture_sha, bytes, ROW_NUMBER() OVER (PARTITION BY bundle_id
                                  ORDER BY ${wholeFirst}julianday(registered), registered, capture_sha) AS rn
                           FROM register WHERE bundle_id IN (SELECT value FROM json_each(?))) ORDER BY bundle_id, capture_sha`, ids);
    /* what each document's own register document says: the format each capture is profiled as, and for a capture held in parts
       its whole (G6: a part is never the row's capture; a part is no archive, G12a) */
    const wholeOfPart = new Map();
    for (const r of read(`SELECT bundle_id, content FROM files WHERE path = 'data/provenance.json' AND bundle_id IN (SELECT value FROM json_each(?))`, ids)) {
      let docs = null;
      try { docs = typeof r.content === "string" ? JSON.parse(r.content).documents : null; } catch { docs = null; }
      if (!Array.isArray(docs)) continue;
      for (const d of docs) {
        const sha = d && typeof d === "object" && d.capture ? d.capture.sha256 : null;
        if (typeof sha !== "string") continue;
        if (!facts.formats.has(sha))
          facts.formats.set(sha, d.profile && d.profile.format && typeof d.profile.format.format === "string" ? d.profile.format.format : null);
        if (Array.isArray(d.parts) && d.parts.length) {
          const size = Number.isSafeInteger(d.capture.bytes) ? d.capture.bytes : d.parts.reduce((n, p) => n + (Number.isSafeInteger(p && p.bytes) ? p.bytes : NaN), 0);
          for (const p of d.parts) if (p && typeof p.sha256 === "string" && p.sha256 !== sha) { facts.parts.add(p.sha256); wholeOfPart.set(p.sha256, { sha, bytes: Number.isSafeInteger(size) ? size : null }); }
        }
      }
    }
    for (const r of regs) {
      if (!facts.captures.has(r.bundle_id)) facts.captures.set(r.bundle_id, []);
      facts.captures.get(r.bundle_id).push(r.capture_sha);
      if (Number(r.rn) === 1) {
        const whole = wholeOfPart.get(r.capture_sha);
        facts.first.set(r.bundle_id, whole ? { capture_sha: whole.sha, bytes: whole.bytes, whole: true } : { capture_sha: r.capture_sha, bytes: r.bytes });
      }
    }
    const shas = JSON.stringify([...facts.first.values()].map((r) => r.capture_sha));
    for (const r of read(`SELECT capture_sha, actor FROM (SELECT capture_sha, actor, ROW_NUMBER() OVER (PARTITION BY capture_sha ORDER BY at, actor) AS rn
                             FROM capture_actors WHERE capture_sha IN (SELECT value FROM json_each(?))) WHERE rn = 1`, shas))
      facts.actor.set(r.capture_sha, r.actor);
    if (picker) return facts;
    for (const r of read(`SELECT capture_sha, first_retrieved AS at FROM (SELECT capture_sha, first_retrieved, ROW_NUMBER() OVER (PARTITION BY capture_sha
                             ORDER BY julianday(first_retrieved), first_retrieved) AS rn FROM captured_locators
                            WHERE capture_sha IN (SELECT value FROM json_each(?))) WHERE rn = 1`, shas))
      facts.retrieved.set(r.capture_sha, r.at);
    for (const r of read(`SELECT DISTINCT g.bundle_id AS bundle_id, f.question AS question, f.asker AS asker FROM register g
                            JOIN captured_for f ON f.capture_sha = g.capture_sha WHERE g.bundle_id IN (SELECT value FROM json_each(?))
                           ORDER BY g.bundle_id, f.question, f.asker`, ids)) {
      if (!facts.asks.has(r.bundle_id)) facts.asks.set(r.bundle_id, []);
      facts.asks.get(r.bundle_id).push({ question: r.question, asker: r.asker });
    }
    if (aside)
      for (const r of read(`SELECT bundle_id, reason, author, at FROM held_acts WHERE act = 'set_aside' AND bundle_id IN (SELECT value FROM json_each(?))
                             ORDER BY bundle_id, seq`, ids))
        facts.setAside.set(r.bundle_id, { reason: r.reason, author: r.author, at: r.at });
    if (vouched)
      for (const r of read(`SELECT f.bundle_id AS bundle_id, f.content AS content FROM files f JOIN bundles b ON b.bundle_id = f.bundle_id
                             WHERE f.path = 'bundle.md' AND b.current_state = '${VOUCHED_STATE}' AND f.bundle_id IN (SELECT value FROM json_each(?))`, ids))
        facts.history.set(r.bundle_id, r.content);
    facts.opened = openedAmong(this, regs.map((r) => r.capture_sha));
    /* G12a (fix round 6): the digests acquisition holds as no archive (it remembers what it decided, so it is asked once), so
       the archive grouping asks the store about none of them; acquisition not serving the read, none is known */
    try {
      const none = notArchivesAmong(this, regs.map((r) => r.capture_sha));
      if (none instanceof Set) facts.notArchives = none;
    } catch { /* nothing known: every candidate is asked, as before */ }
    return facts;
  }

  /* G6: whether the register has provenance's `whole` column, read once. */
  #registerHasWhole() {
    if (this.#hasWhole === null) {
      try { this.#hasWhole = this.#cols("register").includes("whole"); } catch { return false; }
    }
    return this.#hasWhole;
  }

  /* R77 (DEC-167 (8)): for each document of a window, the archives its captures were cut out of or found in
     (`acquisition.memberOf` over the captures the register files under it, provenance R48), each with the document its
     archive is filed in (the register's home of the archive's digest), in `memberOf`'s order. Asked once per window, one
     capture at a time; a document with no archive is absent. A `memberOf` that fails reads as no archive: the document
     stands as a row of its own, never hidden. */
  #archivesOfDocuments(bundleIds) {
    const out = new Map();
    if (!bundleIds.length) return out;
    let regs = [];
    try {
      regs = this.#rows(`SELECT capture_sha, bundle_id FROM register WHERE bundle_id IN (SELECT value FROM json_each(?))
                          ORDER BY bundle_id, capture_sha`, JSON.stringify(bundleIds));
    } catch { regs = []; }
    /* C14: one read says which of the captures are in an archive at all; only those are asked `memberOf` */
    const members = membersOf(this, regs.map((r) => r.capture_sha));
    for (const { capture_sha, bundle_id } of regs) {
      if (!members.has(capture_sha)) continue;
      let of;
      try { of = this.memberOf(capture_sha); } catch { of = []; }
      for (const m of of) {
        const archiveSha = m && typeof m.archiveSha === "string" ? m.archiveSha.toLowerCase() : null;
        if (!archiveSha || !HEX64.test(archiveSha) || archiveSha === capture_sha) continue;
        const list = out.get(bundle_id) || [];
        if (list.some((a) => a.sha256 === archiveSha)) continue;
        const home = this.#one(`SELECT bundle_id FROM register WHERE capture_sha = ?`, archiveSha);
        list.push({ sha256: archiveSha, bundle: home ? home.bundle_id : null });
        out.set(bundle_id, list);
      }
    }
    return out;
  }

  /* R91: a page's one wait. `within(p)` answers what `p` answers, or `TOO_LATE` when the wait ran out first; `over()` says
     whether it has (also by the clock, for an examination that blocks the thread so no timer could fire); `stop()`
     clears the timer. */
  static #pageWait(ms) {
    const began = performance.now();
    let timer, ran = false;
    const late = new Promise((resolve) => { timer = setTimeout(() => { ran = true; resolve(TOO_LATE); }, ms); });
    return { over: () => ran || performance.now() - began >= ms, within: (p) => Promise.race([p, late]), stop: () => clearTimeout(timer) };
  }

  /* R91 (T49; N1080): for the documents of one page, R78's examination and the archive grouping (R77, DEC-167 (8)), each
     asked at most once for each document the page shows (a row, or a file beside an archive), all under the page's one
     wait (`HELD_PAGE_WAIT_MS`): the examinations all at once, the archive groupings `HELD_PAGE_LANES` rows at a time.
     Nothing is asked once the wait has run out. An answer
     not given in time is undetermined: a row's or a file's `eligible: null` with its basis; a row whose grouping did not
     answer carries `archive: {sha256, grouping: null}` and `files: null` with `files_basis`, its files neither dropped
     without being named nor counted as listed. A thread-blocking examination cannot be interrupted: the wait then ends
     after the one in progress. Answers a map of the page's rows to `{eligibility, grouped}` (`grouped` null for a document
     that holds no archive). */
  async #pageAnswers(page, { viewer, rowOf, vouched = false, facts }) {
    const answers = new Map();
    if (!page.length) return answers;
    const wait = Capture.#pageWait(HELD_PAGE_WAIT_MS);
    const examined = new Map();
    /* R88 (T51): a vouched document (`held_and_vouched`) is not asked of the examination, and the wait is not spent on it. A page row's
       standing is already read; a file beside an archive, which is no row of the page, is asked. */
    const standing = new Map(page.map((r) => [r.bundle_id, r.standing]));
    const isVouched = (bundleId) => vouched && (standing.has(bundleId) ? standing.get(bundleId)
      : this.#one(`SELECT current_state AS s FROM bundles WHERE bundle_id = ?`, bundleId)?.s) === VOUCHED_STATE;
    const examine = (bundleId) => {
      if (!examined.has(bundleId))
        examined.set(bundleId, isVouched(bundleId) ? { eligible: null, eligibility_basis: VOUCHED_BASIS } : this.#eligibility(bundleId, wait));
      return examined.get(bundleId);
    };
    const answer = async (r) => {
      const shas = facts.captures.get(r.bundle_id) ?? [];
      /* C14: only a capture that may be an archive is asked of the archive's listing: one acquisition recorded opening, or one its
         own document profiles `zip` or does not profile (a document whose profile cannot be read is asked, as it always was). */
      const maybe = shas.filter((x) => !facts.parts.has(x) && !facts.notArchives.has(x)
        && (facts.opened.has(x) || !facts.formats.has(x) || facts.formats.get(x) === null || facts.formats.get(x) === "zip"));
      const progress = { sha: shas[0] ?? null };
      const [eligibility, group] = await Promise.all([
        examine(r.bundle_id),
        maybe.length === 0 ? null : wait.over() ? TOO_LATE : (() => {
          const g = this.#archiveGroup(maybe, r.bundle_id, { viewer, rowOf, progress, wait });
          g.catch(() => {});
          return wait.within(g);
        })(),
      ]);
      if (group === TOO_LATE)
        return { eligibility, grouped: { archive: { sha256: progress.sha, grouping: null }, files: null,
                                         files_basis: say("capture.files_basis") } };
      if (!group) return { eligibility, grouped: null };
      const shown = await Promise.all(group.files.slice(0, HELD_FILES_IN_ROW).map(async (f) => {
        const e = await examine(f.document);
        return { ...f, grade: group.grade, eligible: e.eligible,
                 ...(RAN_OUT.has(e) || e.eligibility_basis === VOUCHED_BASIS ? { eligibility_basis: e.eligibility_basis } : {}),
                 ...(vouched ? this.#standingOf(f.document, isVouched(f.document) ? VOUCHED_STATE : "collected") : {}) };
      }));
      return { eligibility, grouped: { archive: group.archive, files: shown, files_total: group.files.length,
                                       files_truncated: group.files.length > HELD_FILES_IN_ROW } };
    };
    try {
      /* The examinations of the page's rows are all asked at once, so one that never settles holds up no other row. */
      for (const r of page) examine(r.bundle_id);
      let next = 0;
      const lane = async () => { while (next < page.length) { const r = page[next++]; answers.set(r.bundle_id, await answer(r)); } };
      await Promise.all(Array.from({ length: Math.min(HELD_PAGE_LANES, page.length) }, lane));
    } finally { wait.stop(); }
    return answers;
  }

  /* R77 (DEC-167 (8)): an archive's row additions, when one of the row's document's captures (`shas`) is an archive
     `acquisition.archiveList` answers for the viewer (one it opened, or one whose listing reads entries): `archive`, its
     summary, `grade` its grade, and `files`, the held files beside it (filed, or already held and found in it) whose
     documents are rows of this list for the viewer, in index order, each once, `{document, sha256, index, name}`; the
     caller shows at most `HELD_FILES_IN_ROW`, each with its grade and R78's eligibility. Null for a document that holds
     no archive, `TOO_LATE` when the page's wait ran out before it was done. `progress.sha` names the capture being asked. The entries are read through `archiveList`, a page of at
     most 1000 at a time, never by this module's own SQL over acquisition's tables. */
  async #archiveGroup(shas, bundleId, { viewer, rowOf, progress, wait }) {
    for (const sha of shas) {
      if (wait.over()) return TOO_LATE;
      progress.sha = sha;
      let first;
      try { first = await this.archiveList({ archiveSha: sha, viewer, limit: 1 }); } catch { first = null; }
      /* An archive is one acquisition recorded opening (`opened`), or a held one whose listing reads entries; a capture
         whose bytes list as no archive (any other file, which `archiveList` answers as a listing refused whole) is not. */
      if (!first || first.ok !== true || !first.archive || (first.archive.opened !== true && !(Number(first.archive.entries) > 0))) continue;
      const files = [];
      for (const state of ["filed", "already_held"]) {
        let after = null;
        for (;;) {
          if (wait.over()) return TOO_LATE;
          let page;
          try { page = await this.archiveList({ archiveSha: sha, viewer, state, limit: READ_LIMIT.max, after }); } catch { page = null; }
          if (!page || page.ok !== true || !Array.isArray(page.entries)) break;
          for (const e of page.entries) {
            const fileSha = e && typeof e.sha256 === "string" ? e.sha256.toLowerCase() : null;
            if (!fileSha || fileSha === sha) continue;
            const home = this.#one(`SELECT bundle_id FROM register WHERE capture_sha = ?`, fileSha);
            if (!home || home.bundle_id === bundleId || !rowOf(home.bundle_id)) continue;
            files.push({ document: home.bundle_id, sha256: fileSha, index: Number(e.index), name: e.name ?? null });
          }
          if (!page.truncated || !page.next) break;
          after = page.next;
        }
      }
      files.sort((a, b) => a.index - b.index || (a.document < b.document ? -1 : a.document > b.document ? 1 : 0));
      const seen = new Set(), unique = files.filter((f) => (seen.has(f.document) ? false : (seen.add(f.document), true)));
      const sum = first.summary || {};
      return { archive: { sha256: sha, entries: first.archive.entries ?? null, filed: sum.filed ?? null,
                          already_held: sum.already_held ?? null, not_filed: sum.not_filed ?? null, waiting: sum.waiting ?? null },
               grade: first.archive.grade ?? null, files: unique };
    }
    return null;
  }

  /* R78, R91: one document's batch eligibility, by the registered examination (`ratification` R34): `eligible: true`, or
     false with the class it fails first and that class's reason; with none registered, or one that fails, answers
     neither, or does not answer within the page's wait (`wait`), `eligible: null`, stated undetermined with a basis
     saying which. Once the wait has run out the examination is not asked. */
  async #eligibility(bundleId, wait) {
    const reader = this.#readers.get("batch-examination");
    const undetermined = (basis) => ({ eligible: null, eligibility_basis: basis });
    if (!reader) return undetermined(say("capture.undetermined.batch_release_examination"));
    const tooLate = () => {
      const a = undetermined(say("capture.undetermined.examination_did_answer", { module: reader.module }));
      RAN_OUT.add(a);
      return a;
    };
    if (wait.over()) return tooLate();
    let v;
    try {
      const asked = reader.fn(bundleId);
      if (asked && typeof asked.then === "function") {
        Promise.resolve(asked).catch(() => {});
        v = await wait.within(asked);
        if (v === TOO_LATE) return tooLate();
      } else v = asked;
    } catch { v = null; }
    if (v && v.eligible === true) return { eligible: true };
    if (v && v.eligible === false && typeof v.class === "string" && v.class)
      return { eligible: false, class: v.class, reason: typeof v.reason === "string" ? v.reason : null };
    return undetermined(say("capture.undetermined.examination_did_answer_document", { module: reader.module }));
  }

  /* R83 (DEC-141): the questions one document was captured for, read through the registered `captured-for` reader,
     synchronously, for the viewer: `{questions}`, each `{question, asker, title, visible, waiting}` with `title` and
     `asker` forced null when the question is not visible, whatever the reader sent; or `{questions: null, basis}` when
     none is registered or it does not answer. It is handed the document (its bundle id) and `captures`, the digests the
     register files under it (provenance R48), so the reader can match its own rows without a join of its own. Anything
     but `{questions: [...]}` with every entry well formed is no answer, never a partial list (`capture-requests` R48). */
  #questionsOf(bundleId, viewer, pre = null) {
    const reader = this.#readers.get("captured-for");
    if (!reader) return { questions: null, basis: say("capture.basis.reader_questions_document") };
    const silent = { questions: null, basis: say("capture.basis.did_answer_questions", { module: reader.module }) };
    /* C14: a page of rows hands in `pre`, the captures and asks it read for the whole page; one document reads its own. */
    let captures = [];
    if (pre) captures = pre.captures;
    else {
      try { captures = this.#rows(`SELECT capture_sha FROM register WHERE bundle_id = ? ORDER BY capture_sha`, bundleId).map((r) => r.capture_sha); }
      catch { captures = []; }
    }
    /* R83, R94 (T50): the asks `acquire`'s `for` recorded for those captures, handed on for the reader to answer; this
       module names no question from them itself. */
    let asks = [];
    if (pre) asks = pre.asks;
    else {
      try {
        asks = captures.length ? this.#rows(`SELECT DISTINCT question, asker FROM captured_for WHERE capture_sha IN (SELECT value FROM json_each(?))
                                               ORDER BY question, asker`, JSON.stringify(captures)).map((r) => ({ question: r.question, asker: r.asker })) : [];
      } catch { asks = []; }
    }
    let v;
    try { v = reader.fn({ document: bundleId, viewer, captures, asks }); } catch { return silent; }
    if (v && typeof v.then === "function") { Promise.resolve(v).catch(() => {}); return silent; }
    const list = v && typeof v === "object" ? v.questions : null;
    const str = (x) => (typeof x === "string" && x ? x : null);
    if (!Array.isArray(list) || !list.every((q) => q && typeof q === "object" && str(q.question)
                                             && typeof q.visible === "boolean" && typeof q.waiting === "boolean")) return silent;
    const seen = new Set(), questions = [];
    for (const q of list) {
      const asker = q.visible ? str(q.asker) : null;
      const key = JSON.stringify([q.question, asker, q.visible]);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({ question: q.question, asker, title: q.visible ? str(q.title) : null, visible: q.visible, waiting: q.waiting });
    }
    return { questions };
  }

  /* R77, R79 (DEC-141 (1)): what a viewer is shown of a list of questions: each it may see, `{question, title, asker}`, and
     R77's one sentence when any it may not see is among them, else null. A question not seen leaves no id, title, asker
     or count. */
  static #shown(questions) {
    return { questions: questions.filter((q) => q.visible).map((q) => ({ question: q.question, title: q.title, asker: q.asker })),
             withheld: questions.some((q) => !q.visible) ? WITHHELD_QUESTION : null };
  }

  /* R79, R81: the refusals the two held acts share, in order: a member's own act (C-118.8), with a reason (C-118.9),
     over one to PER_ITEM_MAX ids. */
  #heldActRefusal(ids, reason, author) {
    /* DEC-49 REGION is-held-act-by-member */
    /* A machine: record-grammar's whole question, and the bare founder's viewer `admin`, which names no member
       (membership R43; K1032). */
    if (typeof author !== "string" || !author.trim() || isMachineIdentity(author) || author.trim().toLowerCase() === "admin") {
      const row = CAPTURE_CHECKS.MACHINE_CANNOT_SET_ASIDE;
      return { ok: false, reason: "MACHINE_CANNOT_SET_ASIDE", code: "MACHINE_CANNOT_SET_ASIDE", check: row.check,
               translation: row.translation, status: 403 };
    }
    /* END DEC-49 REGION is-held-act-by-member */
    /* DEC-49 REGION is-held-act-reasoned */
    if (!reasonGiven(reason)) {
      const row = CAPTURE_CHECKS.SET_ASIDE_NO_REASON;
      return { ok: false, reason: "SET_ASIDE_NO_REASON", code: "SET_ASIDE_NO_REASON", check: row.check,
               translation: row.translation, status: 400, maxChars: REASON_MAX };
    }
    /* END DEC-49 REGION is-held-act-reasoned */
    if (!Array.isArray(ids) || ids.length === 0)
      return { ok: false, reason: "NO_IDS", status: 400, detail: localize("capture.index.names_no_document", "name at least one document; nothing was written") };
    if (ids.length > PER_ITEM_MAX)
      return { ok: false, reason: "TOO_MANY_IDS", status: 400, max: PER_ITEM_MAX, count: ids.length,
               detail: localize("capture.index.at_most_per_item_max", "at most {PER_ITEM_MAX} documents in one act; the set was refused whole and nothing was written", { PER_ITEM_MAX: String(PER_ITEM_MAX) }) };
    return null;
  }

  /* R79, R81: each id's document as the viewer may see it, with whether it is set aside now; an id absent or unseen
     answers alike (null). */
  #heldStanding(ids, viewer) {
    const sight = this.#sightOf(viewer);
    const out = new Map();
    for (const id of new Set(ids.map((x) => (typeof x === "string" ? x : "")))) {
      out.set(id, id ? this.#one(
        `SELECT b.bundle_id, b.object_type, b.current_state, ${Capture.#NOT_SET_ASIDE} AS standing FROM bundles b
          WHERE b.bundle_id = ? AND (${sight.sql})`, id, ...sight.args) : null);
    }
    return out;
  }

  /* R79, R81, R84: append one act per document, in one transaction, each recorded with the questions `questionsOf(id)`
     names (R79's waiting questions; R81's, those of the set-aside it undoes), one row per (act, question). */
  #appendHeld(ids, act, reason, author, questionsOf = () => []) {
    const at = stampSecond(this.#instant());
    this.#tx(() => {
      for (const id of new Set(ids)) {
        const n = Number(this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM held_acts WHERE bundle_id = ?`, id).n) + 1;
        this.#sql.exec(`INSERT INTO held_acts (bundle_id, seq, act, reason, author, at) VALUES (?, ?, ?, ?, ?, ?)`,
                       id, n, act, reason, author, at);
        for (const q of new Set(questionsOf(id)))
          this.#sql.exec(`INSERT INTO held_act_questions (bundle_id, seq, question) VALUES (?, ?, ?)`, id, n, q);
      }
    });
    return at;
  }

  /** R79 (DEC-97 (2); DEC-141 (1), (2)): set several held documents aside with one reason. Refused whole, never narrowed:
   *  C-118.8, C-118.9, the id count, then any id absent or unseen (one answer), not `information`, not at `collected`, or
   *  already set aside, named. Each document's questions are read through R83's reader once, before anything is
   *  written; every question it answers as waiting on the document, seen by the viewer or not, is recorded with that
   *  document's set-aside (R84), the one reason applying to each. The answer names, per document, `captured_for` as R77
   *  shows it and `waiting`, the waiting questions as the viewer is shown them; with no reader, or one that does not
   *  answer, the set-aside is still made, with no question recorded, and both read null with the sentence why. The
   *  document is unchanged and stays at `collected`; append-only. */
  setAside({ ids, reason, author, viewer = undefined } = {}) {
    const refused = this.#heldActRefusal(ids, reason, author);
    if (refused) return refused;
    const standing = this.#heldStanding(ids, viewer);
    const named = (code, test, detail) => {
      const hit = [...standing].filter(([, r]) => test(r)).map(([id]) => id);
      return hit.length ? { ok: false, reason: code, ids: hit, status: code === "NO_SUCH_DOCUMENT" ? 404 : 409, detail } : null;
    };
    const no = named("NO_SUCH_DOCUMENT", (r) => !r, "no document you may see answers to these ids; nothing was written")
      || named("NOT_INFORMATION", (r) => r.object_type !== "information", "only Information documents are held; nothing was written")
      || named("NOT_COLLECTED", (r) => r.current_state !== "collected", "only documents at collected are held; nothing was written")
      || named("ALREADY_SET_ASIDE", (r) => !r.standing, "these documents are already set aside; nothing was written");
    if (no) return no;
    const asked = new Map([...standing.keys()].map((id) => [id, this.#questionsOf(id, viewer)]));
    const at = this.#appendHeld([...standing.keys()], "set_aside", reason, author,
                                (id) => (asked.get(id).questions || []).filter((q) => q.waiting).map((q) => q.question));
    const documents = [...asked].map(([document, a]) => (a.questions
      ? { document, captured_for: Capture.#shown(a.questions), waiting: Capture.#shown(a.questions.filter((q) => q.waiting)) }
      : { document, captured_for: null, captured_for_basis: a.basis, waiting: null,
          waiting_basis: say("capture.waiting_basis") }));
    return { ok: true, act: "set_aside", ids: [...standing.keys()], reason, author, at, documents };
  }

  /** R81 (DEC-97 (2); DEC-141 (4)): undo a set-aside by a reasoned act, for several documents with one reason. Refused
   *  whole: R79's first three, then any id absent or unseen (one answer), or not set aside now, named. The restore is
   *  appended beside the set-aside, which is never rewritten or removed; a document's latest act decides. It is recorded
   *  with every question that set-aside was recorded with, so it stands in the same history (R84). Any member who may
   *  see the document may restore it: no consent, vote or count is asked (K1618). */
  restoreHeld({ ids, reason, author, viewer = undefined } = {}) {
    const refused = this.#heldActRefusal(ids, reason, author);
    if (refused) return refused;
    const standing = this.#heldStanding(ids, viewer);
    const absent = [...standing].filter(([, r]) => !r).map(([id]) => id);
    if (absent.length) return { ok: false, reason: "NO_SUCH_DOCUMENT", ids: absent, status: 404,
                                detail: "no document you may see answers to these ids; nothing was written" };
    const notAside = [...standing].filter(([, r]) => r.standing).map(([id]) => id);
    if (notAside.length) return { ok: false, reason: "NOT_SET_ASIDE", ids: notAside, status: 409,
                                  detail: localize("capture.index.not_set_aside", "these documents are not set aside; nothing was written") };
    /* The set-aside each restore undoes is the document's latest act (it is set aside now); its questions carry over. */
    const undone = new Map([...standing.keys()].map((id) => [id, this.#rows(
      `SELECT q.question FROM held_act_questions q
        WHERE q.bundle_id = ? AND q.seq = (SELECT MAX(seq) FROM held_acts WHERE bundle_id = ?) ORDER BY q.question`, id, id)
      .map((r) => r.question)]));
    const at = this.#appendHeld([...standing.keys()], "restore", reason, author, (id) => undone.get(id));
    return { ok: true, act: "restore", ids: [...standing.keys()], reason, author, at };
  }

  /** R84 (DEC-141 (3), (4)): the history of the documents R79 recorded `question` as waiting on: every set-aside and
   *  restore recorded with it, oldest first, each `{document, act, reason, author, at}`, and per document of the page
   *  `set_aside`, whether its latest act of all (R81) is a set-aside. An act on a document the viewer may not see
   *  (membership R43) is left out, unannounced and uncounted; the question is taken as given (its caller, `inquiry`,
   *  gates it). At most `limit` acts (N90), with `truncated` and `next`. Writes nothing, notifies nothing and makes no
   *  queue item (DEC-94); never throws: a store that cannot be read answers `ok: false` with no list. */
  heldActsOf({ question, viewer = undefined, limit = null, after = null } = {}) {
    try {
      const cap = limitOf(limit);
      const from = after ? keyOf(after, 3) : null;
      if (after && !from) return badCursor();
      if (typeof question !== "string" || !question)
        return { ok: true, question: typeof question === "string" ? question : null, acts: [], documents: [], limit: cap, truncated: false, next: null };
      const sight = this.#sightOf(viewer);
      const found = this.#rows(
        `SELECT h.bundle_id, h.seq, h.act, h.reason, h.author, h.at FROM held_act_questions q
           JOIN held_acts h ON h.bundle_id = q.bundle_id AND h.seq = q.seq
           JOIN bundles b ON b.bundle_id = h.bundle_id
          WHERE q.question = ? AND (${sight.sql})
            AND ${from ? "(h.at > ? OR (h.at = ? AND (h.bundle_id > ? OR (h.bundle_id = ? AND h.seq > CAST(? AS INTEGER)))))" : "1=1"}
          ORDER BY h.at, h.bundle_id, h.seq LIMIT ?`,
        question, ...sight.args, ...(from ? [from[0], from[0], from[1], from[1], from[2]] : []), cap + 1);
      const page = found.slice(0, cap), truncated = found.length > cap, last = page[page.length - 1];
      const documents = [...new Set(page.map((r) => r.bundle_id))].map((document) => ({ document,
        set_aside: this.#one(`SELECT act FROM held_acts WHERE bundle_id = ? ORDER BY seq DESC LIMIT 1`, document)?.act === "set_aside" }));
      return { ok: true, question,
               acts: page.map((r) => ({ document: r.bundle_id, act: r.act, reason: r.reason, author: r.author, at: r.at })),
               documents, limit: cap, truncated, next: truncated ? cursorOf([last.at, last.bundle_id, String(last.seq)]) : null };
    } catch {
      return { ok: false, reason: "HELD_ACTS_UNREADABLE", question: typeof question === "string" ? question : null, acts: null,
               detail: localize("capture.index.held_acts_unreadable", "the set-asides recorded with this question could not be read") };
    }
  }

  /** R82 (K1036; Intake Doctrine §4, the backlog ceiling): how many Information documents at `collected`, not set aside
   *  (R79, R81) and not released, have a register document whose `origin` names `matched_sweep` equal to `sweep`. The
   *  register document is the bundle's `data/provenance.json` (State Rules §4.1), read on record-core's `files` read
   *  contract (its R37); a released document has left `collected` (`ratification` R24), so the state answers that
   *  clause. The whole store, no viewer: only the daemon's hold reads it (`link-sweep` R8). Writes nothing and never
   *  throws; an unknown sweep, or one that is not a non-empty string, answers 0. K1129: a store that cannot be read
   *  answers null (not known), never 0, so the hold fails closed. A register document held only as a blob
   *  (`files.content` NULL) is not counted. */
  heldCount(args) {
    const sweep = args && typeof args === "object" ? args.sweep : null;
    if (typeof sweep !== "string" || !sweep) return 0;
    try {
      const r = this.#one(
        `SELECT count(*) AS n FROM bundles b
          WHERE b.object_type = 'information' AND b.current_state = 'collected' AND ${Capture.#NOT_SET_ASIDE}
            AND EXISTS (SELECT 1 FROM files f,
                                json_each(CASE WHEN json_valid(f.content) THEN f.content ELSE '{}' END, '$.documents') d
                         WHERE f.bundle_id = b.bundle_id AND f.path = 'data/provenance.json'
                           AND (CASE WHEN d.type = 'object' THEN json_extract(d.value, '$.origin.matched_sweep') END) = ?)`,
        sweep);
      const n = Number(r && r.n);
      return r && Number.isFinite(n) ? n : null;
    } catch { return null; }
  }

  /* ==================================================================== *
   * D-64: the daily render allowance (R39, R40)
   * ==================================================================== */

  /** R39. Admit one render against today's allowance, or say it waits or is deferred. The verdict is the STRING
   *  `state`, never a leading boolean. THE BOUND THIS HOLDS (D-492): at every moment spent + reserved <= allowance,
   *  because a render is admitted only when `spent + reserved + its own reservation` fits, and its reservation is
   *  the maximum the asked environment permits it to cost. Two residues stay named: the reservation binds only a
   *  renderer that honours what it was asked (its elapsed time is its own claim), and the allowance is an ACCOUNT;
   *  the concurrency cap (D-520) is the throttle, decided first and taking nothing from the day. Slots EXPIRE at
   *  admission plus reservation, so a render that never reports cannot hold one for ever. */
  renderAdmit({ allowanceMs, reserveMs = 0, cap = null, at = null } = {}) {
    return this.#tx(() => {
      const now = at || stampSecond(this.#instant());
      const day = now.slice(0, 10);
      const allowance = Number.isFinite(Number(allowanceMs)) ? Math.max(0, Math.floor(Number(allowanceMs))) : 0;
      /* CEILED, never floored: a reservation rounded DOWN is short of the cost it stands for. */
      const reserve = Number.isFinite(Number(reserveMs)) ? Math.max(0, Math.ceil(Number(reserveMs))) : 0;
      const capN = Number.isInteger(Number(cap)) && Number(cap) > 0 ? Number(cap) : null;
      const nowMs = Date.parse(now);
      if (capN !== null) {
        if (Number.isFinite(nowMs)) this.#sql.exec(`DELETE FROM render_slots WHERE expires_ms <= ?`, nowMs);
        const running = this.#one(`SELECT COUNT(*) AS n FROM render_slots`).n;
        if (running >= capN)
          return { state: "waiting", day, cap: capN, running, reserve_ms: reserve,
                   why: say("capture.why.renders_running_group", { running, cap_n: capN }) };
      }
      const cur = this.#one(`SELECT * FROM render_allowance WHERE day = ?`, day);
      const spent = cur ? cur.spent_ms : 0;
      const reserved = cur ? (cur.reserved_ms || 0) : 0;
      const defer = (why) => {
        if (cur) this.#sql.exec(`UPDATE render_allowance SET deferred = deferred + 1, last_at = ? WHERE day = ?`, now, day);
        else this.#sql.exec(`INSERT INTO render_allowance (day, spent_ms, reserved_ms, renders, deferred, last_at) VALUES (?, 0, 0, 0, 1, ?)`, day, now);
        return { state: "deferred", day, spent_ms: spent, reserved_ms: reserved, reserve_ms: reserve,
                 allowance_ms: allowance, deferred: (cur ? cur.deferred : 0) + 1, renders: cur ? cur.renders : 0, why };
      };
      /* A CALLER THAT OFFERS NO RESERVATION IS DEFERRED, NOT ADMITTED: a fence a caller can switch off by omission
         is no fence. */
      if (!(reserve > 0)) return defer("no reservation was offered, and an unreserved admission is the overrun D-492 closed");
      if (spent + reserved + reserve > allowance) return defer(null);
      if (cur) this.#sql.exec(`UPDATE render_allowance SET renders = renders + 1, reserved_ms = reserved_ms + ?, last_at = ? WHERE day = ?`, reserve, now, day);
      else this.#sql.exec(`INSERT INTO render_allowance (day, spent_ms, reserved_ms, renders, deferred, last_at) VALUES (?, 0, ?, 1, 0, ?)`, day, reserve, now);
      const slot = crypto.randomUUID();
      this.#sql.exec(`INSERT INTO render_slots (slot, admitted_at, expires_ms) VALUES (?, ?, ?)`,
                     slot, now, (Number.isFinite(nowMs) ? nowMs : this.#instant()) + reserve);
      return { state: "admitted", day, spent_ms: spent, reserved_ms: reserved + reserve, reserve_ms: reserve,
               allowance_ms: allowance, renders: (cur ? cur.renders : 0) + 1, deferred: cur ? cur.deferred : 0,
               slot, cap: capN };
    });
  }

  /** R40. Frees the slot on every path; adds the REPORTED browser time and releases at most the reservation still
   *  held (never below zero). AN UNREPORTED RENDER STAYS CHARGED: it may have burned any time up to its
   *  reservation, so the reservation is kept for the day, which under-uses the allowance and cannot overrun. */
  renderSpend({ ms, releaseMs = 0, slot = null, at = null } = {}) {
    return this.#tx(() => {
      if (typeof slot === "string" && slot) this.#sql.exec(`DELETE FROM render_slots WHERE slot = ?`, slot);
      const now = at || stampSecond(this.#instant());
      const day = now.slice(0, 10);
      const n = typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? Math.ceil(ms) : null;
      const rel = Number.isFinite(Number(releaseMs)) ? Math.max(0, Math.ceil(Number(releaseMs))) : 0;
      const cur = this.#one(`SELECT * FROM render_allowance WHERE day = ?`, day);
      if (n === null)
        return { day, spent_ms: cur ? cur.spent_ms : 0, reserved_ms: cur ? (cur.reserved_ms || 0) : 0, released_ms: 0,
                 why: say("capture.why.renderer_reported_elapsed") };
      const held = cur ? (cur.reserved_ms || 0) : 0;
      const released = Math.min(held, rel);
      if (cur) this.#sql.exec(`UPDATE render_allowance SET spent_ms = spent_ms + ?, reserved_ms = ?, last_at = ? WHERE day = ?`,
                              n, held - released, now, day);
      else this.#sql.exec(`INSERT INTO render_allowance (day, spent_ms, reserved_ms, renders, deferred, last_at) VALUES (?, ?, 0, 0, 0, ?)`, day, n, now);
      return { day, spent_ms: (cur ? cur.spent_ms : 0) + n, reserved_ms: held - released, released_ms: released };
    });
  }

  /* ==================================================================== *
   * Links (R27) and the host's chrome (R28, R29)
   * ==================================================================== */

  /** R27. File the links a captured document made. Replaces this capture's rows rather than appending: a
   *  capture's own links are a property of its bytes. A link carries `chrome: true` with its `chrome_basis` when
   *  it sat in a chrome region (containment, D-340); whether it IS the site's chrome is decided by recurrence
   *  (R28), re-derived here for this capture in the same write. A row filed again keeps the instant it was FIRST
   *  filed (R57: `first_seen` is a read contract, and a continuation re-files every link of its page). */
  recordLinks({ sourceCapture, sourceBundle = null, capturedAt, links = [] } = {}) {
    return this.#tx(() => {
      if (!sourceCapture) return { recorded: 0 };
      const now = stampSecond(this.#instant());
      /* Filed in place: a row this capture already holds is updated and keeps `first_seen`, a new one takes now, and
         the rows the new set no longer names are removed after. The first of two links with one key is the one kept. */
      const kept = new Set();
      let n = 0;
      for (const l of links) {
        /* address_norm is required; citation_norm falls back to it for a link that names no element. */
        if (!l || !l.address_norm) continue;
        n++;
        const ref = String(l.ref || l.address), citation = l.citation_norm || l.address_norm;
        const key = JSON.stringify([ref, citation]);
        if (kept.has(key)) continue;
        kept.add(key);
        this.#sql.exec(
          `INSERT INTO links (source_bundle, source_capture, link_ref, address, address_norm,
             citation_norm, fragment, partition, origin, chrome, chrome_basis, captured_at, first_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_capture, link_ref, citation_norm) DO UPDATE SET source_bundle = excluded.source_bundle,
             address = excluded.address, address_norm = excluded.address_norm, fragment = excluded.fragment,
             partition = excluded.partition, origin = excluded.origin, chrome = excluded.chrome,
             chrome_basis = excluded.chrome_basis, captured_at = excluded.captured_at`,
          sourceBundle, sourceCapture, ref, l.address || l.address_norm,
          l.address_norm, citation, l.fragment || null,
          l.type || "deferred", l.origin || null, l.chrome ? 1 : 0,
          l.chrome ? (String(l.chrome_basis || "") || null) : null, capturedAt || now, now);
      }
      this.#sql.exec(
        `DELETE FROM links WHERE source_capture = ? AND NOT EXISTS (SELECT 1 FROM json_each(?) k
           WHERE json_extract(k.value, '$[0]') = links.link_ref AND json_extract(k.value, '$[1]') = links.citation_norm)`,
        sourceCapture, `[${[...kept].join(",")}]`);
      const chrome = this.#chromeDeriveCapture(sourceCapture, now);
      return { recorded: n, source_capture: sourceCapture, site_chrome: chrome };
    });
  }

  /** R27, D-701, N90. Everything that points AT an address, matched on the RESOURCE key so the citations of its
   *  sections are found too. Only sources the viewer may see, at most `limit` in (source, citation) order, paged by
   *  `after`; `count` and `elements` are of the rows listed. */
  linksTo({ address_norm, viewer = undefined, limit = null, after = null } = {}) {
    const seen = this.#captureGate("l.source_capture", viewer);
    const cap = limitOf(limit);
    const from = after ? keyOf(after, 3) : ["", "", ""];
    if (!from) return badCursor();
    const found = this.#rows(
      `SELECT l.source_capture, l.source_bundle, l.link_ref, l.partition, l.fragment, l.citation_norm, l.captured_at
         FROM links l WHERE l.address_norm = ? AND (l.source_capture, l.citation_norm, l.link_ref) > (?, ?, ?) AND (${seen.sql})
        ORDER BY l.source_capture, l.citation_norm, l.link_ref LIMIT ?`, address_norm, ...from, ...seen.args, cap + 1);
    const rows = found.slice(0, cap), last = rows[rows.length - 1];
    const truncated = found.length > cap;
    return { address_norm, count: rows.length, sources: rows,
             elements: [...new Set(rows.map((r) => r.fragment).filter(Boolean))], limit: cap, truncated,
             next: truncated ? cursorOf([last.source_capture, last.citation_norm, last.link_ref]) : null };
  }

  /** R27. Resolve a capture's links against the record, with a contemporaneity verdict for each that resolves:
   *  is the capture the record holds of the target the version the source pointed at on the day the source was
   *  captured? Three values, because the question is usually unanswerable and a binary scheme would sort every
   *  unanswerable case into one bucket or the other. The strongest evidence is two captures of the target
   *  BRACKETING the source's retrieval whose bytes hash equal. D-96: the bracket reads DIRECT receipts only.
   *  D-701: a source the viewer may not see answers as a capture the record does not hold, and a target capture
   *  the viewer may not see is filtered out BEFORE the bracket. N90: through the op, at most `limit` links in
   *  (citation, ref) order, paged by `after`, the tally and verdicts being of the links listed; an in-process caller
   *  that passes no `limit` (connections' projection, which must see every link) is answered whole, `limit: null`. */
  resolveLinks({ sourceCapture, at = null, viewer = undefined, limit = null, after = null } = {}) {
    const src = this.#captureGate("l.source_capture", viewer);
    const cap = limit == null ? null : limitOf(limit);
    /* In process with no `limit`, every link: a bound of Infinity, which SQLite spells `LIMIT -1`. */
    const bound = cap ?? Infinity;
    const window = Number.isFinite(bound) ? bound + 1 : -1;
    const from = after ? keyOf(after, 2) : ["", ""];
    if (!from) return badCursor();
    const found = this.#rows(
      `SELECT l.* FROM links l WHERE l.source_capture = ? AND (l.citation_norm, l.link_ref) > (?, ?) AND (${src.sql})
        ORDER BY l.citation_norm, l.link_ref LIMIT ?`, sourceCapture, ...from, ...src.args, window);
    const truncated = found.length > bound;
    const rows = found.slice(0, bound);
    const next = truncated ? cursorOf([rows[rows.length - 1].citation_norm, rows[rows.length - 1].link_ref]) : null;
    if (!rows.length) return { sourceCapture, resolved: 0, links: [], limit: cap, truncated, next };
    /* N133: the source's retrieval instant, spelled whole-second UTC as the receipts are (provenance R48), so the
       bracket is decided in SQL by comparing text. */
    const T = stampSecond(Date.parse(rows[0].captured_at) || Date.parse(at || "") || this.#instant());
    const out = [];
    const tally = { linked: 0, offsite: 0, intra: 0, anchor: 0, refused: 0 };
    const verdicts = { contemporaneous: 0, superseded: 0, undetermined: 0 };
    const tgt = this.#captureGate("cl.capture_sha", viewer);
    for (const r of rows) {
      if (r.partition !== "deferred") {
        tally[r.partition] = (tally[r.partition] || 0) + 1;
        out.push({ ...r, resolution: r.partition, verdict: null });
        continue;
      }
      /* N133: a BOUNDED read per link. The target's direct captures the viewer may see are never read whole: SQL
         answers their count and the at most four captures the verdict turns on, each one row: the first capture
         (by first retrieval) seen more than once across T (`bracket`), the last whose last sighting is at or
         before T (`before`), the first whose first sighting is at or after T (`after`), and the source's own. */
      const found = this.#rows(
        `WITH c AS (SELECT cl.capture_sha, cl.first_retrieved, cl.last_retrieved, cl.observations FROM captured_locators cl
                     WHERE cl.address_norm = ? AND cl.via = 'direct' AND (${tgt.sql}))
         SELECT 'n' AS k, NULL AS capture_sha, NULL AS first_retrieved, NULL AS last_retrieved, COUNT(*) AS observations FROM c
         UNION ALL SELECT * FROM (SELECT 'bracket', * FROM c WHERE first_retrieved <= ? AND last_retrieved >= ? AND observations > 1
                                  ORDER BY first_retrieved, capture_sha LIMIT 1)
         UNION ALL SELECT * FROM (SELECT 'before', * FROM c WHERE last_retrieved <= ? ORDER BY first_retrieved DESC, capture_sha DESC LIMIT 1)
         UNION ALL SELECT * FROM (SELECT 'after', * FROM c WHERE first_retrieved >= ? ORDER BY first_retrieved, capture_sha LIMIT 1)
         UNION ALL SELECT * FROM (SELECT 'self', * FROM c WHERE capture_sha = ? LIMIT 1)`,
        r.address_norm, ...tgt.args, T, T, T, T, sourceCapture);
      const pick1 = (k) => { const x = found.find((f) => f.k === k); return x ? { capture_sha: x.capture_sha,
        first_retrieved: x.first_retrieved, last_retrieved: x.last_retrieved, observations: x.observations } : null; };
      const count = Number((found.find((f) => f.k === "n") || {}).observations || 0);
      if (!count) {
        tally.offsite++;
        out.push({ ...r, resolution: "offsite", verdict: null, basis: say("capture.basis.record_holds_capture") });
        continue;
      }
      tally.linked++;
      const bracket = pick1("bracket"), before = pick1("before"), after = pick1("after");
      /* D-57: A SELF-REFERENCE, AND ONE CAPTURE ON BOTH SIDES, ARE NOT A CHANGE. A page that links to itself finds
         its OWN capture among the target's, retrieved at exactly T, so it is both the last capture at-or-before T
         and the first at-or-after it; stated for what it is (a fourth basis, never a fourth verdict). */
      const selfCap = pick1("self");
      const oneCapture = !!(before && after && before.capture_sha === after.capture_sha);
      let verdict, basis, detail = null, pick = null;
      if (bracket && bracket.capture_sha === sourceCapture) {
        verdict = "contemporaneous"; pick = bracket;
        basis = say("capture.basis.link_points_document");
        detail = `self-reference: ${bracket.capture_sha.slice(0, 12)}, observed ${bracket.observations} times `
               + `between ${bracket.first_retrieved} and ${bracket.last_retrieved}`;
      } else if (bracket) {
        verdict = "contemporaneous"; pick = bracket;
        basis = say("capture.basis.bytes_seen_served");
        detail = `observed ${bracket.observations} times between ${bracket.first_retrieved} and ${bracket.last_retrieved}`;
      } else if (selfCap && oneCapture && before.capture_sha === sourceCapture) {
        verdict = "undetermined"; pick = selfCap;
        basis = say("capture.basis.link_points_document_itself");
        detail = `self-reference: ${selfCap.capture_sha.slice(0, 12)} retrieved ${selfCap.first_retrieved}`;
      } else if (oneCapture) {
        verdict = "undetermined"; pick = before;
        basis = say("capture.basis.record_holds_capture_target");
        detail = `one capture: ${before.capture_sha.slice(0, 12)} retrieved ${before.first_retrieved}`;
      } else if (before && after) {
        verdict = "undetermined"; pick = before;
        basis = say("capture.basis.target_changed_somewhere");
        detail = `bracketing captures differ: ${before.capture_sha.slice(0, 12)} last seen ${before.last_retrieved}, `
               + `${after.capture_sha.slice(0, 12)} first seen ${after.first_retrieved}`;
      } else if (!before && after) {
        verdict = "superseded"; pick = after;
        basis = say("capture.basis.capture_target_postdates");
      } else {
        verdict = "undetermined"; pick = before;
        basis = say("capture.basis.record_captures_target");
      }
      verdicts[verdict]++;
      const reg = pick ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha = ?`, pick.capture_sha) : null;
      out.push({ ...r, resolution: "linked", verdict, basis, detail,
                 target_capture: pick ? pick.capture_sha : null,
                 target_bundle: reg ? reg.bundle_id : null,
                 target_retrieved: pick ? pick.first_retrieved : null,
                 target_last_seen: pick ? pick.last_retrieved : null,
                 target_captures: count });
    }
    return { sourceCapture, resolved: out.length, at: rows[0].captured_at, tally, verdicts, links: out,
      limit: cap, truncated, next,
      note: say("capture.note.undetermined_resting_state") };
  }

  /** R27. Append a verdict, never an update: a verdict that changed is a fact about the record. N90: the history
   *  answered is the newest `limit` verdicts, oldest first, with the `total` and whether it was cut. */
  recordLinkVerdict({ sourceCapture, addressNorm, verdict, basis, targetBundle = null, targetCapture = null, detail = null,
                      at = null, limit = null } = {}) {
    return this.#tx(() => {
      const now = at || stampSecond(this.#instant());
      this.#sql.exec(
        `INSERT INTO link_verdicts (source_capture, address_norm, verdict, basis, target_bundle, target_capture, at, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        sourceCapture, addressNorm, verdict, basis, targetBundle, targetCapture, now, detail);
      const cap = limitOf(limit);
      const total = Number(this.#one(`SELECT COUNT(*) AS n FROM link_verdicts WHERE source_capture = ? AND address_norm = ?`,
                                     sourceCapture, addressNorm).n);
      const found = this.#rows(`SELECT * FROM link_verdicts WHERE source_capture = ? AND address_norm = ? ORDER BY at DESC LIMIT ?`,
                               sourceCapture, addressNorm, cap + 1);
      const history = found.slice(0, cap).reverse();
      return { current: history[history.length - 1] || null, history, changed: total > 1, total, limit: cap,
               truncated: found.length > cap };
    });
  }

  /* ---- R28, R29: the host's chrome, derived per HOST ---- */

  /** The hosts and pages a capture is on record at. DIRECT receipts only: an archive capture's retrieval date is
   *  when WE asked the archive, not when the site served that navigation. */
  #chromePagesOf(sourceCapture) {
    const out = [];
    for (const r of this.#rows(
      `SELECT address_norm, MIN(first_retrieved) AS first_retrieved, MAX(last_retrieved) AS last_retrieved
         FROM captured_locators WHERE capture_sha = ? AND via = 'direct' GROUP BY address_norm`, sourceCapture)) {
      const host = URL.canParse(r.address_norm) ? new URL(r.address_norm).hostname.toLowerCase() : null;
      if (host) out.push({ host, page: r.address_norm, first: r.first_retrieved, last: r.last_retrieved });
    }
    return out;
  }

  /** One capture's contribution: for each host and page it is on record at, the set of contained chrome addresses
   *  it carried, fingerprinted. A capture that carried NO chrome contributes nothing: a page with no <nav> says
   *  nothing about the site's navigation. Then every touched host's classification is judged again (R28). */
  #chromeDeriveCapture(sourceCapture, at) {
    const pages = this.#chromePagesOf(sourceCapture);
    const touched = new Map(), hosts = new Set(pages.map((p) => p.host));
    for (const old of this.#rows(`SELECT host, fingerprint FROM site_chrome_refs WHERE source_capture = ?`, sourceCapture)) {
      touched.set(`${old.host}\u0000${old.fingerprint}`, old); hosts.add(old.host);
    }
    this.#sql.exec(`DELETE FROM site_chrome_refs WHERE source_capture = ?`, sourceCapture);
    /* Anchors excluded: a skip-link points into THIS page, so its address differs page to page. */
    const chromeRows = this.#rows(
      `SELECT DISTINCT address_norm, chrome_basis FROM links WHERE source_capture = ? AND chrome = 1 AND partition <> 'anchor'`,
      sourceCapture);
    const links = [...new Set(chromeRows.map((r) => r.address_norm))].sort();
    const basis = [...new Set(chromeRows.map((r) => r.chrome_basis).filter(Boolean))].sort();
    let observed = 0;
    if (links.length) {
      const fingerprint = Capture.#fingerprintOf(links);
      for (const p of pages) {
        this.#sql.exec(
          `INSERT INTO site_chrome_refs (host, source_capture, page, first_observed, last_observed, fingerprint, basis)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, p.host, sourceCapture, p.page, p.first, p.last, fingerprint,
          `containment: ${basis.length ? basis.join(", ") : "chrome region not recorded"}`);
        this.#sql.exec(
          `INSERT INTO site_chrome (host, fingerprint, links, first_observed, last_observed, captures)
           VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(host, fingerprint) DO NOTHING`,
          p.host, fingerprint, JSON.stringify(links), p.first, p.last);
        touched.set(`${p.host}\u0000${fingerprint}`, { host: p.host, fingerprint });
        observed++;
      }
    }
    for (const { host, fingerprint } of touched.values()) {
      const agg = this.#one(`SELECT MIN(first_observed) AS f, MAX(last_observed) AS l, COUNT(*) AS n
                               FROM site_chrome_refs WHERE host = ? AND fingerprint = ?`, host, fingerprint);
      if (!agg || !agg.n) this.#sql.exec(`DELETE FROM site_chrome WHERE host = ? AND fingerprint = ?`, host, fingerprint);
      else this.#sql.exec(`UPDATE site_chrome SET first_observed = ?, last_observed = ?, captures = ? WHERE host = ? AND fingerprint = ?`,
                          agg.f, agg.l, agg.n, host, fingerprint);
    }
    for (const h of hosts) this.#judgeChrome(h, at);
    return { observed, chrome_links: links.length };
  }

  /* A deterministic digest of the sorted address set (FNV-1a over UTF-16, 64 bits as two halves): the fingerprint
     names a navigation, it is not evidence, so a synchronous digest is enough and keeps the write transactional. */
  static #fingerprintOf(list) {
    const s = list.join("\n");
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  /** R28. A contained address is the site's chrome only when it recurred on TWO OR MORE distinct pages of the host;
   *  contained on one page it reads `undetermined`, never lost. Recorded with its basis and the date judged, and
   *  judged again whenever the host is observed: always reclassifiable, never a deletion of the link. */
  #judgeChrome(host, at) {
    const pagesOf = new Map();
    for (const r of this.#rows(`SELECT page, fingerprint FROM site_chrome_refs WHERE host = ?`, host)) {
      const rec = this.#one(`SELECT links FROM site_chrome WHERE host = ? AND fingerprint = ?`, host, r.fingerprint);
      for (const a of JSON.parse((rec && rec.links) || "[]")) {
        if (!pagesOf.has(a)) pagesOf.set(a, new Set());
        pagesOf.get(a).add(r.page);
      }
    }
    this.#sql.exec(`DELETE FROM link_chrome WHERE host = ?`, host);
    for (const [a, pages] of pagesOf) {
      const n = pages.size;
      this.#sql.exec(`INSERT INTO link_chrome (host, address_norm, state, pages, basis, at) VALUES (?, ?, ?, ?, ?, ?)`,
        host, a, n >= 2 ? "chrome" : "undetermined", n,
        n >= 2 ? localize("capture.index.contained_in_a_chrome_region", "contained in a chrome region and recurred on {n} distinct pages of {host}", { n: String(n), host: String(host) })
               : localize("capture.index.contained_in_a_chrome_region_2", "contained in a chrome region on one page of {host} only: whether it is the site's navigation or that page's own is undetermined until another page of the host carries it", { host: String(host) }), at || stampSecond(this.#instant()));
    }
  }

  /** R28, N90. The standing classification of a host's contained links, with basis and date: at most `limit` in
   *  address order, paged by `after`. */
  chromeOf({ host, limit = null, after = null } = {}) {
    const h = String(host || "").trim().toLowerCase();
    const cap = limitOf(limit);
    const from = after ? keyOf(after, 1) : [""];
    if (!from) return badCursor();
    const found = this.#rows(`SELECT address_norm, state, pages, basis, at FROM link_chrome WHERE host = ? AND address_norm > ?
                                ORDER BY address_norm LIMIT ?`, h, from[0], cap + 1);
    const links = found.slice(0, cap), truncated = found.length > cap;
    return { host: h, links, limit: cap, truncated, next: truncated ? cursorOf([links[links.length - 1].address_norm]) : null };
  }

  /** R29. Regenerate a host's chrome by SCAN, which is what makes it derived: everything recomputed from `links`
   *  and the receipts. Bounded and paged: the first page (no `after`) clears the host's derived rows; each page
   *  re-derives up to `limit` captures in capture-sha order and says whether more remain. */
  deriveSiteChrome({ host, limit = null, after = null } = {}) {
    return this.#tx(() => {
      const h = String(host || "").trim().toLowerCase();
      const asked = Number(limit);
      const cap = Number.isFinite(asked) && asked > 0 ? Math.min(2000, Math.floor(asked)) : 500;
      if (!h) return { host: null, captures: 0, derived: [], limit: cap, truncated: false, next: null };
      const from = String(after || "");
      if (!from) for (const t of ["site_chrome_refs", "site_chrome", "link_chrome"]) this.#sql.exec(`DELETE FROM ${t} WHERE host = ?`, h);
      const found = this.#rows(
        `SELECT DISTINCT capture_sha FROM captured_locators
          WHERE via = 'direct' AND capture_sha > ? AND (substr(address_norm, 1, ?) = ? OR substr(address_norm, 1, ?) = ?)
          ORDER BY capture_sha LIMIT ?`,
        from, `https://${h}/`.length, `https://${h}/`, `http://${h}/`.length, `http://${h}/`, cap + 1);
      const page = found.slice(0, cap);
      const at = stampSecond(this.#instant());
      for (const r of page) this.#chromeDeriveCapture(r.capture_sha, at);
      const truncated = found.length > cap;
      return { host: h, captures: page.length, derived: page.map((r) => r.capture_sha), limit: cap, truncated,
               next: truncated ? page[page.length - 1].capture_sha : null,
               ...(truncated ? { partial: "more captures of this host remain: its chrome is PARTIAL until the page naming `next` is derived" } : {}) };
    });
  }

  /** R29, D-701. THE PER-HOST READ: how a host's navigation changed between captures. Observations (only those the
   *  viewer may see, before anything is ordered, cut or counted) are ordered by when each was first seen; each
   *  adjacent pair is compared. A contained link the earlier carried and the later did not is LOST only when it is
   *  the site's chrome (R28: it recurred on two or more distinct pages among the visible observations); one carried
   *  on one page only is `undetermined`, with its reason, never lost. */
  navChanges({ host, limit = null, viewer = undefined } = {}) {
    const h = String(host || "").trim().toLowerCase();
    const asked = Number(limit);
    const cap = Number.isFinite(asked) && asked > 0 ? Math.min(500, Math.floor(asked)) : 200;
    const seen = this.#captureGate("s.source_capture", viewer);
    const found = this.#rows(
      `SELECT s.source_capture, s.page, s.first_observed, s.last_observed, s.fingerprint, s.basis
         FROM site_chrome_refs s WHERE s.host = ? AND (${seen.sql})
        ORDER BY s.first_observed DESC, s.source_capture DESC LIMIT ?`, h, ...seen.args, cap + 1);
    const seq = found.slice(0, cap).reverse();
    const fps = [...new Set(seq.map((o) => o.fingerprint))];
    const linksOf = new Map(fps.map((f) => [f, JSON.parse(this.#one(`SELECT links FROM site_chrome WHERE host = ? AND fingerprint = ?`, h, f)?.links || "[]")]));
    const records = fps.map((f) => {
      const mine = seq.filter((o) => o.fingerprint === f);
      return { fingerprint: f, links: linksOf.get(f), captures: mine.length,
               first_observed: mine.map((o) => o.first_observed).sort()[0],
               last_observed: mine.map((o) => o.last_observed).sort().pop() };
    });
    const pagesCarrying = (a) => new Set(seq.filter((o) => linksOf.get(o.fingerprint).includes(a)).map((o) => o.page));
    const obs = (o) => ({ source_capture: o.source_capture, page: o.page, first_observed: o.first_observed,
                          last_observed: o.last_observed, fingerprint: o.fingerprint });
    const changes = [], lost = [], undetermined = [];
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (a.fingerprint === b.fingerprint) continue;
      const A = new Set(linksOf.get(a.fingerprint)), B = new Set(linksOf.get(b.fingerprint));
      const gone = [...A].filter((x) => !B.has(x)).sort();
      const came = [...B].filter((x) => !A.has(x)).sort();
      changes.push({ from: obs(a), to: obs(b), lost: gone, gained: came, same_page: a.page === b.page });
      for (const address_norm of gone) {
        const pages = pagesCarrying(address_norm);
        if (pages.size >= 2) {
          const again = seq.filter((o) => o.last_observed > b.first_observed && linksOf.get(o.fingerprint).includes(address_norm))
                           .map((o) => o.last_observed).sort().pop() || null;
          lost.push({ address_norm, recurred_on: pages.size, last_carried: obs(a), first_missing: obs(b),
                      same_page: a.page === b.page, seen_again_at: again });
        } else {
          undetermined.push({ address_norm, recurred_on: pages.size, last_carried: obs(a), first_missing: obs(b),
                              chrome: "undetermined",
                              why: say("capture.why.carried_chrome_region") });
        }
      }
    }
    return { host: h, observations: seq.length, limit: cap, truncated: found.length > cap, records,
             sequence: seq.map((o) => ({ ...obs(o), basis: o.basis })), changes, lost, undetermined,
             note: say(seq.length < 2 ? "capture.note.fewer_two_captures" : "capture.note.link_lost_site")
               + say("capture.note.chrome_containment_chrome") };
  }

  /* ==================================================================== *
   * Capture sessions (R22, R46): a capture that needs another tick
   * ==================================================================== */

  /** SCRATCH, not record. R103 (fix round 4b, F5): a session is the resume state of work still owed (the supporting files or the
   *  render a capture has not finished), so the clock never prunes it: `expires` says only when it stops being live (R46, the
   *  member's "Finish it" window), and the row goes when its work ends, by `dropCaptureSession`. The primary is never stored
   *  here: it is in the store under its own digest. */
  saveCaptureSession({ session, locator, primarySha, primaryFile, base, state, ttlMs = 3600000, at = null } = {}) {
    return this.#tx(() => {
      const now = at ? new Date(at) : new Date(this.#instant());
      const iso = (d) => stampSecond(d.getTime());
      if (!session || !state) return { session: null, saved: false };
      const cur = this.#one(`SELECT ticks FROM capture_sessions WHERE session = ?`, session);
      const body = JSON.stringify(state);
      const expires = iso(new Date(now.getTime() + (Number(ttlMs) || 3600000)));
      if (cur) {
        this.#sql.exec(`UPDATE capture_sessions SET updated = ?, expires = ?, ticks = ticks + 1, state = ? WHERE session = ?`,
                       iso(now), expires, body, session);
        return { session, saved: true, ticks: cur.ticks + 1, bytes: body.length };
      }
      this.#sql.exec(`INSERT INTO capture_sessions (session, locator, primary_sha, primary_file, base, created, updated, expires, ticks, state)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                     session, locator, primarySha, primaryFile, base, iso(now), iso(now), expires, body);
      return { session, saved: true, ticks: 1, bytes: body.length };
    });
  }

  loadCaptureSession({ session, at = null } = {}) {
    return this.#tx(() => {
      const now = at ? new Date(at) : new Date(this.#instant());
      const r = this.#one(`SELECT * FROM capture_sessions WHERE session = ?`, session);
      if (!r) return { session, found: false, note: say("capture.note.capture_session_either") };
      let state = null;
      try { state = JSON.parse(r.state); } catch { return { session, found: false, note: "session state did not parse" }; }
      return { session, found: true, expired: r.expires < stampSecond(now.getTime()), locator: r.locator, primarySha: r.primary_sha,
               primaryFile: r.primary_file, base: r.base, ticks: r.ticks, created: r.created, state };
    });
  }

  dropCaptureSession({ session } = {}) {
    return this.#tx(() => {
      this.#sql.exec(`DELETE FROM capture_sessions WHERE session = ?`, session);
      return { session, dropped: true };
    });
  }

  /** R46: every live session, for `queue`'s partial-capture condition. Writes nothing, never throws. */
  liveCaptureSessions(now) {
    try {
      const at = typeof now === "string" ? now : stampSecond(now != null && Number.isFinite(Number(now)) ? Number(now) : this.#instant());
      return this.#rows(`SELECT * FROM capture_sessions WHERE expires > ? ORDER BY session`, at).map((r) => {
        let state = null; try { state = JSON.parse(r.state); } catch { state = null; }
        return { session: r.session, locator: r.locator, primarySha: r.primary_sha, primaryFile: r.primary_file,
                 base: r.base, created: r.created, updated: r.updated, expires: r.expires, ticks: r.ticks, state };
      });
    } catch { return []; }
  }

  /* ==================================================================== *
   * What a host has served (R24, R25, R26)
   * ==================================================================== */

  /** R24. Assets this host has served, by normalised address. `documents` counts distinct PAGES, a page being the
   *  primary's DOCUMENT ADDRESS in the receipts (CAP-13): a primary sha is a content hash, so one page whose bytes
   *  changed would otherwise read as two documents. A primary with NO receipt cannot say which page it was: it is
   *  counted apart as `documents_undetermined`, never guessed into `documents`. N90: `limit` (the op always passes
   *  one) answers at most that many in address order, paged by `after`, unless `addresses` names the assets asked;
   *  the in-process walk (`acquisition` R19) passes none and reads the host whole. */
  siteAssets({ host, addresses = [], limit = null, after = null } = {}) {
    if (!host) return { host: null, assets: {} };
    const out = {};
    const want = addresses && addresses.length ? [...new Set(addresses.map(String))] : null;
    const cap = limit == null || want ? null : limitOf(limit);
    /* Asked addresses: at most as many as asked. The in-process walk: no bound (Infinity, SQLite's `LIMIT -1`). */
    const bound = cap ?? Infinity;
    const window = want ? want.length : Number.isFinite(bound) ? bound + 1 : -1;
    const from = after && cap !== null ? keyOf(after, 1) : [""];
    if (!from) return badCursor();
    /* The assets asked, or the page of the host's assets: the counts are then read for exactly those addresses. */
    let found;
    if (want) found = this.#rows(`SELECT * FROM site_assets WHERE host = ? AND address_norm IN (SELECT value FROM json_each(?))
                                  ORDER BY address_norm LIMIT ?`, host, JSON.stringify(want), window);
    else found = this.#rows(`SELECT * FROM site_assets WHERE host = ? AND address_norm > ? ORDER BY address_norm LIMIT ?`,
                            host, from[0], window);
    const page = found.slice(0, bound);
    const counts = new Map();
    if (page.length)
      for (const c of this.#rows(
        `SELECT r.address_norm AS address_norm, COUNT(DISTINCT cl.address_norm) AS pages,
                COUNT(DISTINCT CASE WHEN cl.capture_sha IS NULL THEN r.primary_sha END) AS unlocated
           FROM site_asset_refs r LEFT JOIN captured_locators cl ON cl.capture_sha = r.primary_sha
          WHERE r.host = ? AND r.address_norm IN (SELECT value FROM json_each(?)) GROUP BY r.address_norm LIMIT ?`,
        host, JSON.stringify(page.map((r) => r.address_norm)), page.length)) counts.set(c.address_norm, c);
    for (const r of page) {
      const c = counts.get(r.address_norm);
      out[r.address_norm] = { ...r, documents: (c && c.pages) || 0, documents_undetermined: (c && c.unlocated) || 0 };
    }
    return { host, assets: out, count: page.length, limit: cap, truncated: found.length > bound,
             next: found.length > bound ? cursorOf([page[page.length - 1].address_norm]) : null };
  }

  /** R25. File what a capture saw of a host. When an address comes back with different bytes, that is a dated fact
   *  about the site AND it puts every document that REUSED the old bytes into question: the asset moves, the
   *  change is counted, and a dated `posthoc` `changed` verdict is appended for each (CAP-4 item 6a, zero request
   *  cost). A fetched asset's `last_fetched_by` names the capture whose fetch it was; a reuse never moves it
   *  (CAP-14), and a reused part's source is the reusing capture's own record. N90: every change is counted and
   *  every posthoc verdict appended, but the answer lists at most `limit` changes, each naming at most `limit`
   *  reusers, and says when either was cut. */
  recordSiteAssets({ host, primarySha, observations = [], at = null, limit = null } = {}) {
    return this.#tx(() => {
      if (!host || !primarySha) return { host: null, recorded: 0 };
      const now = at || stampSecond(this.#instant());
      const cap = limitOf(limit);
      let truncated = false;
      let added = 0, changedCount = 0;
      const changed = [];
      const fromObs = (o) => (typeof o.reused_from === "string" && HEX64.test(o.reused_from)) ? o.reused_from : null;
      for (const o of observations) {
        if (!o || !o.address_norm || !o.sha256) continue;
        const cur = this.#one(`SELECT * FROM site_assets WHERE host = ? AND address_norm = ?`, host, o.address_norm);
        if (!cur) {
          this.#sql.exec(
            `INSERT INTO site_assets (host, address_norm, address, sha256, content_type, bytes, kind,
               first_seen, last_seen, last_fetched, stable_since, changes, last_fetched_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            host, o.address_norm, o.address || o.address_norm, o.sha256, o.content_type || null,
            o.bytes || 0, o.kind || null, now, now, now, now, o.reused ? fromObs(o) : primarySha);
          added++;
        } else if (!o.reused && cur.sha256 !== o.sha256) {
          /* INSERT OR IGNORE: the key carries the second, so two changes within one second fold into the first. Every
             reuser's verdict is appended in the one statement, whatever the answer below lists. */
          this.#sql.exec(
            `INSERT OR IGNORE INTO reuse_verdicts
               (source_capture, bundle_id, host, address_norm, phase, verdict, reused_sha, observed_sha, basis, at)
             SELECT primary_sha, NULL, ?, ?, 'posthoc', 'changed', ?, ?, ?, ?
               FROM site_asset_refs WHERE host = ? AND address_norm = ? AND reused = 1`,
            host, o.address_norm, cur.sha256, o.sha256,
            localize("capture.index.reuse_posthoc_unverified", "a later direct capture of this host fetched different bytes for this address; this earlier capture reused the old ones, which are now unverified against the source"), now,
            host, o.address_norm);
          this.#sql.exec(
            `UPDATE site_assets SET sha256 = ?, content_type = ?, bytes = ?, last_seen = ?, last_fetched = ?,
               last_fetched_by = ?, stable_since = ?, changes = changes + 1 WHERE host = ? AND address_norm = ?`,
            o.sha256, o.content_type || cur.content_type, o.bytes || 0, now, now, primarySha, now, host, o.address_norm);
          changedCount++;
          if (changed.length < cap) {
            const reusedBy = this.#rows(`SELECT primary_sha FROM site_asset_refs WHERE host = ? AND address_norm = ? AND reused = 1
                                          ORDER BY primary_sha LIMIT ?`, host, o.address_norm, cap + 1);
            const count = Number(this.#one(`SELECT COUNT(*) AS n FROM site_asset_refs WHERE host = ? AND address_norm = ? AND reused = 1`,
                                           host, o.address_norm).n);
            if (reusedBy.length > cap) truncated = true;
            changed.push({ address_norm: o.address_norm, was: cur.sha256, now: o.sha256,
                           reused_by: reusedBy.slice(0, cap).map((a) => a.primary_sha), reused_by_count: count });
          } else truncated = true;
        } else if (!o.reused) {
          this.#sql.exec(`UPDATE site_assets SET last_seen = ?, last_fetched = ?, last_fetched_by = ? WHERE host = ? AND address_norm = ?`,
                         now, now, primarySha, host, o.address_norm);
        } else {
          /* A reuse confirms nothing about the source: last_fetched and last_fetched_by do not move. */
          this.#sql.exec(`UPDATE site_assets SET last_seen = ? WHERE host = ? AND address_norm = ?`, now, host, o.address_norm);
        }
        this.#sql.exec(
          `INSERT INTO site_asset_refs (host, address_norm, primary_sha, at, reused, sha256, reused_from)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(host, address_norm, primary_sha) DO UPDATE SET at = excluded.at,
             reused = excluded.reused, sha256 = excluded.sha256, reused_from = excluded.reused_from`,
          host, o.address_norm, primarySha, now, o.reused ? 1 : 0, o.sha256, o.reused ? fromObs(o) : null);
      }
      return { host, recorded: observations.length, added, changed: changedCount, changes: changed, limit: cap, truncated };
    });
  }

  /** CAP-4: the reused subresource PARTS of a bundle, so ratification can re-fetch each. Scoped to THIS bundle by
   *  the register (provenance R48's read contract). `reused_from` is read from the reusing capture's own ref row;
   *  NULL is stated as `reused_from_state: "undetermined"`, never inferred. */
  reusedParts(bundleId) {
    if (!bundleId) return { bundleId: null, parts: [] };
    const parts = this.#rows(
      `SELECT ar.host AS host, ar.address_norm AS address_norm, ar.primary_sha AS primary_sha,
              ar.sha256 AS reused_sha, ar.reused_from AS reused_from, sa.address AS address, sa.content_type AS content_type
         FROM site_asset_refs ar JOIN register r ON r.capture_sha = ar.primary_sha
         LEFT JOIN site_assets sa ON sa.host = ar.host AND sa.address_norm = ar.address_norm
        WHERE r.bundle_id = ? AND ar.reused = 1 ORDER BY ar.host, ar.address_norm`, bundleId)
      .map((p) => ({ ...p, reused_from_state: p.reused_from ? "recorded" : "undetermined" }));
    return { bundleId, parts, count: parts.length };
  }

  /** R26. Append the outcome of a ratification's re-fetch of the reused parts, dated, never overwritten. The
   *  document-level observation each maps to (OBSERVATION-LOG-DESIGN §4.1 row 3; no new words: confirmed →
   *  PRESENT unchanged, changed → PRESENT changed, unreachable → LOOKED_INDETERMINATE, not_attempted → NO ROW,
   *  because a look not taken is NEVER_LOOKED, the absence of a row) is handed to the `observation` listener;
   *  refusals are collected and reported, never thrown. */
  recordReuseVerdicts({ bundleId = null, verdicts = [], at = null } = {}) {
    return this.#tx(() => {
      const now = at || stampSecond(this.#instant());
      let recorded = 0;
      const refusals = [];
      for (const v of verdicts) {
        if (!v || !v.source_capture || !v.address_norm || !v.verdict) continue;
        this.#sql.exec(
          `INSERT OR IGNORE INTO reuse_verdicts
             (source_capture, bundle_id, host, address_norm, phase, verdict, reused_sha, observed_sha, basis, at)
           VALUES (?, ?, ?, ?, 'ratify', ?, ?, ?, ?, ?)`,
          v.source_capture, bundleId, v.host || "", v.address_norm, v.verdict,
          v.reused_sha || "", v.observed_sha ?? null, v.basis || "", now);
        recorded++;
        const mapped =
          v.verdict === "confirmed" ? { state: "PRESENT", detail: "unchanged", ref: v.reused_sha || null }
        : v.verdict === "changed" ? { state: "PRESENT", detail: "changed", ref: v.observed_sha || v.reused_sha || null }
        : v.verdict === "unreachable" ? { state: "LOOKED_INDETERMINATE", detail: "unreachable", ref: null }
        : null;
        if (mapped)
          for (const o of this.#emitSync("observation", { at: now, row: {
            actorClass: "plane", authorityKind: "ratify", authority: bundleId || v.source_capture,
            level: "document", subjectKind: "address", subject: v.address_norm, state: mapped.state,
            resultKind: mapped.ref ? "capture" : null, resultRef: mapped.ref, detail: mapped.detail } }))
            refusals.push(o.ok ? o.result : { reason: "LISTENER_FAILED", module: o.module, detail: o.error });
      }
      return { ok: true, bundleId, recorded, at: now, observation_refusals: refusals.filter(Boolean) };
    });
  }

  /** R26, N90. The reuse verdicts, newest first, by bundle (ratify) or by source capture (which also surfaces the free
   *  posthoc verdicts), at most `limit`. */
  reuseVerdicts({ bundleId = null, sourceCapture = null, limit = null } = {}) {
    const cols = "source_capture, bundle_id, host, address_norm, phase, verdict, reused_sha, observed_sha, basis, at";
    const cap = limitOf(limit);
    const [key, value] = bundleId ? ["bundle_id", bundleId] : ["source_capture", sourceCapture];
    if (!value) return { verdicts: [] };
    const found = this.#rows(`SELECT ${cols} FROM reuse_verdicts WHERE ${key} = ? ORDER BY at DESC, address_norm LIMIT ?`, value, cap + 1);
    return { ...(bundleId ? { bundleId } : { sourceCapture }), verdicts: found.slice(0, cap), limit: cap, truncated: found.length > cap };
  }

  /** R24. Asset chrome by RECURRENCE across a host's pages (CAP-13: a page is its document address), a ratio, not a
   *  boolean: the threshold is the caller's. Primaries with no page on record enter neither side. N90: at most
   *  `limit` assets, most-recurring first, with the host's `total`; `documents` are the host's, never the page's. */
  siteChrome({ host, threshold = 0.6, limit = null } = {}) {
    if (!host) return { host: null, documents: 0, documents_undetermined: 0, assets: [] };
    const cap = limitOf(limit);
    const d = this.#one(
      `SELECT COUNT(DISTINCT cl.address_norm) AS pages, COUNT(DISTINCT CASE WHEN cl.capture_sha IS NULL THEN r.primary_sha END) AS unlocated
         FROM site_asset_refs r LEFT JOIN captured_locators cl ON cl.capture_sha = r.primary_sha WHERE r.host = ?`, host);
    const documents = (d && d.pages) || 0;
    const undetermined = (d && d.unlocated) || 0;
    const total = Number(this.#one(`SELECT COUNT(DISTINCT address_norm) AS n FROM site_asset_refs WHERE host = ?`, host).n);
    /* Most-recurring first: `share` is `pages / documents` over one host, so ordering by pages IS ordering by share. */
    const found = this.#rows(
      `SELECT r.address_norm AS address_norm, COUNT(DISTINCT cl.address_norm) AS pages,
              COUNT(DISTINCT CASE WHEN cl.capture_sha IS NULL THEN r.primary_sha END) AS unlocated
         FROM site_asset_refs r LEFT JOIN captured_locators cl ON cl.capture_sha = r.primary_sha
        WHERE r.host = ? GROUP BY r.address_norm ORDER BY pages DESC, r.address_norm LIMIT ?`, host, cap + 1);
    const assets = found.slice(0, cap).map((r) => {
      const share = documents ? r.pages / documents : 0;
      return { address_norm: r.address_norm, documents: r.pages, documents_undetermined: r.unlocated || 0, share,
               chrome: documents >= 3 && share >= threshold };
    });
    return { host, documents, documents_undetermined: undetermined, threshold, assets, total, limit: cap, truncated: found.length > cap,
             note: say(documents < 3 ? "capture.note.fewer_three_documents" : "capture.note.chrome_means_address")
               + (undetermined ? say("capture.note.further_capture_host", { undetermined, s: undetermined === 1 ? "" : "s" }) : "") };
  }

  /* ==================================================================== *
   * The platform's ceiling (R23)
   * ==================================================================== */

  /** R23. The ceiling is learned by being refused, never declared; `probeDue` deliberately discards it every so
   *  often and runs to refusal again. */
  captureLimit(runtime = "subrequests") {
    const r = this.#one(`SELECT * FROM capture_limits WHERE runtime = ?`, runtime);
    return r ? { ...r, probeDue: r.since_probe >= PROBE_EVERY, probeEvery: PROBE_EVERY }
             : { runtime, observed: null, probeDue: true, probeEvery: PROBE_EVERY };
  }

  /** R23. A run never refused is NOT evidence about where the ceiling is: it only advances the counter. A ceiling
   *  that MOVED keeps the old value and the date ("51 until Tuesday, now 1000" is the fact worth acting on). */
  recordCaptureLimit({ runtime = "subrequests", observed = null, at = null } = {}) {
    return this.#tx(() => {
      const now = at || stampSecond(this.#instant());
      const cur = this.#one(`SELECT * FROM capture_limits WHERE runtime = ?`, runtime);
      if (observed == null) {
        if (cur) this.#sql.exec(`UPDATE capture_limits SET since_probe = since_probe + 1 WHERE runtime = ?`, runtime);
        return { runtime, observed: cur ? cur.observed : null, recorded: false,
                 note: say("capture.note.run_refused_says") };
      }
      if (!cur) {
        this.#sql.exec(`INSERT INTO capture_limits (runtime, observed, observed_at, first_seen, samples, since_probe) VALUES (?, ?, ?, ?, 1, 0)`,
                       runtime, observed, now, now);
        return { runtime, observed, recorded: true, moved: false, samples: 1 };
      }
      if (cur.observed === observed) {
        this.#sql.exec(`UPDATE capture_limits SET observed_at = ?, samples = samples + 1, since_probe = 0 WHERE runtime = ?`, now, runtime);
        return { runtime, observed, recorded: true, moved: false, samples: cur.samples + 1 };
      }
      this.#sql.exec(`UPDATE capture_limits SET previous = observed, moved_at = ?, observed = ?, observed_at = ?, samples = 1, since_probe = 0
                      WHERE runtime = ?`, now, observed, now, runtime);
      return { runtime, observed, previous: cur.observed, moved: true, moved_at: now, recorded: true, samples: 1 };
    });
  }

  /* ==================================================================== *
   * D-98: the event queue (R15, R45)
   *
   * Bob RULED that an undetermined-authority capture creates a task AUTOMATICALLY AT CAPTURE, through a
   * PRODUCER/CONSUMER QUEUE, and the queue is the safety property. The capture path may only ENQUEUE: it cannot
   * write a task, name an assignee, set a status or forge a history entry, so the blast radius of a leaked
   * capture credential stops at `task_queue`. The consumer (`queue`, K91 (3)) is the sole writer of tasks and
   * drains this through R45.
   * ==================================================================== */

  /** R15. Bounds what it accepts, records no decision, idempotent on (kind, capture_sha); every enqueue (a dedupe
   *  included, since the consumer still owes it a drain) calls the `task` listeners (R44), which arm the drain. */
  async taskEnqueue({ kind = "authority-undetermined", captureSha = null, subject = "", locator = null, at = null } = {}) {
    if (!TASK_KINDS.includes(kind)) return { ok: false, reason: "BAD_KIND", detail: localize("capture.index.kind_must_be_one_of", "kind must be one of: {TASK_KINDS}", { TASK_KINDS: String(TASK_KINDS.join(", ")) }) };
    if (typeof captureSha !== "string" || !HEX64.test(captureSha))
      return { ok: false, reason: "BAD_CAPTURE_SHA", detail: localize("capture.index.sha_identifies_event", "a capture sha256 identifies the event; a record does not exist yet at capture time") };
    const text = boundedSubject(subject) || say("capture.text.capture_whose_authority");
    const loc = typeof locator === "string" && locator.length <= 2000 ? locator : null;
    const now = at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant());
    const existing = this.#tx(() => {
      const held = this.#one(`SELECT capture_sha FROM task_queue WHERE kind=? AND capture_sha=?`, kind, captureSha);
      if (!held)
        this.#sql.exec(`INSERT INTO task_queue (kind, capture_sha, subject, locator, enqueued) VALUES (?,?,?,?,?)`,
                       kind, captureSha, text, loc, now);
      return held;
    });
    const heard = await this.#emit("task", { kind, captureSha, subject: text, locator: loc, enqueued: now, deduped: !!existing });
    const armedAt = heard.map((h) => h.ok && h.result && h.result.armedAt).find((x) => x != null) ?? null;
    return existing ? { ok: true, queued: false, deduped: true, kind, captureSha, armedAt }
                    : { ok: true, queued: true, deduped: false, kind, captureSha, enqueued: now, armedAt };
  }

  /** R45: the queued events, oldest first (by `enqueued`, then digest), at most `limit`; with `kind`, only that kind's,
   *  so each drainer reads its own (T35: `tasks` drains `authority-undetermined`, the daemon `archive-unpack`).
   *  (T36-41, N740) Each event carries `cursor`, its place in that order (`kind` breaks a tie of the same instant and
   *  digest); with `after`, only the events past that place, whether or not its event is still queued, so a drainer that
   *  leaves `limit` events at the head reaches the ones behind them. An `after` that is not such a cursor reads from the head. */
  taskEvents({ limit = 50, kind = null, after = null } = {}) {
    try {
      const n = Math.max(0, Math.min(1000, Math.trunc(Number(limit)) || 0));
      const one = typeof kind === "string" && kind;
      const at = taskCursorPlace(after);
      const where = [one ? "kind = ?" : "1=1",
                     at ? "(enqueued > ? OR (enqueued = ? AND (capture_sha > ? OR (capture_sha = ? AND kind > ?))))" : "1=1"];
      const args = [...(one ? [kind] : []), ...(at ? [at.enqueued, at.enqueued, at.captureSha, at.captureSha, at.kind] : [])];
      return this.#rows(`SELECT kind, capture_sha, subject, locator, enqueued, attempts, last_try FROM task_queue
                          WHERE ${where.join(" AND ")} ORDER BY enqueued, capture_sha, kind LIMIT ?`, ...args, n)
        .map((r) => ({ kind: r.kind, captureSha: r.capture_sha, subject: r.subject, locator: r.locator,
                       enqueued: r.enqueued, attempts: r.attempts, lastTry: r.last_try,
                       cursor: taskCursorOf(r.enqueued, r.capture_sha, r.kind) }));
    } catch { return []; }
  }

  /** R45; with `kind`, that kind's count only. */
  taskEventCount({ kind = null } = {}) {
    try {
      const one = typeof kind === "string" && kind;
      return Number(this.#one(`SELECT COUNT(*) AS n FROM task_queue WHERE ${one ? "kind = ?" : "1=1"}`, ...(one ? [kind] : [])).n);
    } catch { return 0; }
  }

  /** R45 */
  taskEventAttempt({ kind, captureSha, at } = {}) {
    try {
      return this.#tx(() => {
        if (!this.#one(`SELECT 1 AS x FROM task_queue WHERE kind=? AND capture_sha=?`, kind, captureSha)) return { found: false };
        this.#sql.exec(`UPDATE task_queue SET attempts = attempts + 1, last_try = ? WHERE kind=? AND capture_sha=?`,
                       at ?? stampSecond(this.#instant()), kind, captureSha);
        return { found: true };
      });
    } catch { return { found: false }; }
  }

  /** R45 */
  taskEventRemove({ kind, captureSha } = {}) {
    try {
      return this.#tx(() => {
        if (!this.#one(`SELECT 1 AS x FROM task_queue WHERE kind=? AND capture_sha=?`, kind, captureSha)) return { found: false };
        this.#sql.exec(`DELETE FROM task_queue WHERE kind=? AND capture_sha=?`, kind, captureSha);
        return { found: true };
      });
    } catch { return { found: false }; }
  }

  /* ==================================================================== *
   * R73 (`acquisition` R22; N140, K287): the validators a filed direct capture was served with
   * ==================================================================== */

  /** R73 (`acquisition` R22): what the source sent about the bytes of the capture this fetch filed (`ETag`, `Last-Modified`), under the
   *  document address. Written by the acquisition act on every filed direct capture; a later write for the same pair
   *  replaces it. Never throws. */
  recordValidators({ addressNorm, captureSha, etag = null, lastModified = null, at = null } = {}) {
    try {
      if (typeof addressNorm !== "string" || !addressNorm || typeof captureSha !== "string" || !HEX64.test(captureSha))
        return { recorded: false };
      this.#tx(() => this.#sql.exec(`INSERT INTO capture_validators (address_norm, capture_sha, etag, last_modified, at) VALUES (?, ?, ?, ?, ?)
                                     ON CONFLICT(address_norm, capture_sha) DO UPDATE SET etag = excluded.etag,
                                       last_modified = excluded.last_modified, at = excluded.at`,
                                    addressNorm, captureSha, etag || null, lastModified || null, at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant())));
      return { recorded: true };
    } catch { return { recorded: false }; }
  }

  /** R73 (`acquisition` R22): the validators recorded for one capture at one document address, or null when none was sent or none is
   *  recorded. Never throws. */
  validatorsOf({ addressNorm, captureSha } = {}) {
    try {
      const r = this.#one(`SELECT etag, last_modified FROM capture_validators WHERE address_norm = ? AND capture_sha = ?`,
                          addressNorm, captureSha);
      return r && (r.etag || r.last_modified) ? { etag: r.etag || null, lastModified: r.last_modified || null } : null;
    } catch { return null; }
  }

  /* ==================================================================== *
   * D-104: source reachability (R8, R43)
   * ==================================================================== */

  /** R43, R8 (K120 (3)): the three figures as they stand, instance settings in record-core (`getSetting`), a
   *  setting not set answering its default. A value that is not a number at or above its floor is never obeyed. */
  reachabilityThresholds() {
    const get = (name) => { try { return this.core && typeof this.core.getSetting === "function" ? this.core.getSetting(name) : null; } catch { return null; } };
    const pick = (v, dflt, min) => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) && n >= min ? n : dflt; };
    return { failures: pick(get(REACHABILITY_SETTINGS.failures), REACHABILITY_DEFAULTS.failures, 1),
             days: pick(get(REACHABILITY_SETTINGS.days), REACHABILITY_DEFAULTS.days, 0),
             minForAge: pick(get(REACHABILITY_SETTINGS.minForAge), REACHABILITY_DEFAULTS.minForAge, 1) };
  }

  /** `acquisition` R19 (K120 (3)): the subresource stagger, an instance setting in record-core in milliseconds; not set, a jittered
   *  50–250 ms. */
  subresourceStaggerMs() {
    let v = null;
    try { v = this.core && typeof this.core.getSetting === "function" ? this.core.getSetting(SUBRESOURCE_STAGGER_SETTING) : null; } catch { v = null; }
    const n = Number(v);
    return v != null && v !== "" && Number.isFinite(n) && n >= 0 ? n : 50 + Math.floor(Math.random() * 200);
  }

  /** R8. One attempt at one document address. A governed refusal is counted in its own column and never as a
   *  failure: the silence is ours. Every recorded outcome is then handed to the `source-outcome` listeners (R44),
   *  which is how monitoring's alarm is armed on a counted failure. */
  async recordSourceOutcome({ addressNorm = null, outcome = null, status = null, at = null } = {}) {
    if (typeof addressNorm !== "string" || addressNorm === "") return { ok: false, reason: "NO_ADDRESS" };
    if (!SOURCE_OUTCOMES.includes(outcome))
      return { ok: false, reason: "BAD_OUTCOME", detail: localize("capture.index.outcome_must_be_one_of", "outcome must be one of: {SOURCE_OUTCOMES}", { SOURCE_OUTCOMES: String(SOURCE_OUTCOMES.join(", ")) }) };
    const now = at && ISO_INSTANT.test(at) ? at : stampSecond(this.#instant());
    const st = Number.isInteger(status) ? status : null;
    this.#tx(() => {
      this.#sql.exec(`INSERT INTO source_reachability (address_norm, updated_at) VALUES (?, ?) ON CONFLICT(address_norm) DO NOTHING`, addressNorm, now);
      if (outcome === "governed")
        this.#sql.exec(`UPDATE source_reachability SET governed_refusals = governed_refusals + 1, last_outcome = ?, updated_at = ?
                         WHERE address_norm = ?`, outcome, now, addressNorm);
      else if (outcome === "success")
        this.#sql.exec(`UPDATE source_reachability SET attempts = attempts + 1, consecutive_failures = 0, first_failure_since = NULL,
                          last_success = ?, last_outcome = ?, last_status = ?, updated_at = ? WHERE address_norm = ?`,
                       now, outcome, st, now, addressNorm);
      else
        this.#sql.exec(`UPDATE source_reachability SET attempts = attempts + 1, failures_total = failures_total + 1,
                          consecutive_failures = consecutive_failures + 1, first_failure_since = COALESCE(first_failure_since, ?),
                          last_failure = ?, last_outcome = ?, last_status = ?, updated_at = ? WHERE address_norm = ?`,
                       now, now, outcome, st, now, addressNorm);
    });
    await this.#emit("source-outcome", { addressNorm, outcome, status: st, at: now, counted: outcome !== "governed" });
    return { ok: true, counted: outcome !== "governed", ...this.sourceReachability({ addressNorm, now }) };
  }

  /** R8. The reachability of one address and whether the fallback threshold is met, with the facts it is computed
   *  from. Staleness runs from the FIRST failure of the current run, and the age arm needs corroboration. R90 (N983): an
   *  in-plane caller (`monitoring`'s archive tick) may pass its own `now`; with none (the route never passes one, its
   *  answer may gate an archive fallback) it is judged at this module's clock (`captureOf`'s `now`). */
  sourceReachability({ addressNorm = null, now = null } = {}) {
    const row = this.#one(`SELECT * FROM source_reachability WHERE address_norm=?`, addressNorm);
    const TH = this.reachabilityThresholds();
    if (!row)
      return { address_norm: addressNorm, known: false, consecutive_failures: 0, governed_refusals: 0,
               fallback_eligible: false, thresholds: TH, basis: say("capture.basis.attempt_address_ever") };
    const at = now && ISO_INSTANT.test(now) ? now : stampSecond(this.#instant());
    const byCount = row.consecutive_failures >= TH.failures;
    const since = row.first_failure_since ? Date.parse(row.first_failure_since) : null;
    const staleDays = since === null ? 0 : (Date.parse(at) - since) / 86400000;
    const byAge = row.consecutive_failures >= TH.minForAge && staleDays >= TH.days;
    return {
      address_norm: row.address_norm, known: true, consecutive_failures: row.consecutive_failures,
      attempts: row.attempts, failures_total: row.failures_total,
      /* A number excluded from a decision must stay visible or the exclusion cannot be audited. */
      governed_refusals: row.governed_refusals,
      last_success: row.last_success || null, last_failure: row.last_failure || null,
      last_outcome: row.last_outcome || null, last_status: row.last_status === null ? null : row.last_status,
      first_failure_since: row.first_failure_since || null,
      failing_days: since === null ? 0 : Math.floor(staleDays),
      fallback_eligible: byCount || byAge,
      thresholds: TH,
      basis: byCount
        ? say("capture.basis.consecutive_failures_produced", { consecutive_failures: row.consecutive_failures, failures: TH.failures })
        : byAge
          ? say("capture.basis.failing_since_days", { first_failure_since: row.first_failure_since, stale_days: Math.floor(staleDays),
                                                      days: TH.days, min_for_age: TH.minForAge })
          : row.governed_refusals > 0 && row.consecutive_failures === 0
            ? say("capture.basis.eligible_governed_refusal", { governed_refusals: row.governed_refusals })
            : row.consecutive_failures === 1 && staleDays >= TH.days
              ? say("capture.basis.eligible_failing_days", { stale_days: Math.floor(staleDays) })
              : say("capture.basis.eligible_threshold_met"),
    };
  }

  /* ==================================================================== *
   * Its figures (R75)
   * ==================================================================== */

  /** R75: the figures `registerCounts` (record-core R63) asks for, in this order. */
  static COUNT_KEYS = Object.freeze(["taskQueue", "sourceReachability"]);

  /** R75: `taskQueue` (the `task_queue` rows) and `sourceReachability` (the `source_reachability` rows), as the legacy
   *  store's `#counts` took them. Neither table names a bundle, so `hid` (the bundles the caller may not see) leaves
   *  no row out and each figure counts every row. A figure that cannot be read is null, never zero. Synchronous;
   *  writes nothing; never throws. */
  counts(hid = null) {
    const n = (table) => {
      try { const v = Number(this.#one(`SELECT count(*) AS c FROM ${table}`).c); return Number.isFinite(v) ? v : null; }
      catch { return null; }
    };
    return { taskQueue: n("task_queue"), sourceReachability: n("source_reachability") };
  }
}

/** Whether a purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function captureOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return CAPTURE_PURGED_TABLES.includes(name) || CAPTURE_EXEMPT_TABLES.includes(name);
}

/* The Durable Object routes this module answers, as entries of the plane's one route map (plane R5: `routes` spreads
   them in, and control-plane's `dispatch` answers every store request over it). `url` carries the control plane's
   stamps; `body` the parsed body; `h` the handler's in-process parts (R73; K4226), of which `timings` is forwarded to
   `acquire` as its `opts.timings` when given. N90: every read a route answers is bounded here, whatever the caller omits (`limit`
   defaults to READ_LIMIT's), and pages by `after`. */
export function captureOps(c, url, body, env, h = {}) {
  /* R115: the store's environment is the instance clock's source (`BIO_NOW_MS`), so every op this map answers reads it */
  if (env && typeof env === "object") c.clockEnv = env;
  const q = (k) => url.searchParams.get(k);
  const viewerOf = () => (url.searchParams.has("viewer") ? q("viewer") : undefined);
  const page = { limit: q("limit") || READ_LIMIT.default, after: q("after") || null };
  return {
    capturelimit: () => c.captureLimit(q("runtime") || "subrequests"),
    siteassets: () => { const a = body || { host: q("host") }; return c.siteAssets({ after: page.after, ...a, limit: a.limit ?? page.limit }); },
    recordsiteassets: () => c.recordSiteAssets(body || {}),
    reusedparts: () => c.reusedParts(q("id")),
    recordreuseverdicts: () => c.recordReuseVerdicts(body || {}),
    reuseverdicts: () => c.reuseVerdicts({ bundleId: q("bundle"), sourceCapture: q("capture"), limit: page.limit }),
    renderadmit: () => c.renderAdmit(body || {}),
    renderspend: () => c.renderSpend(body || {}),
    recordlinks: () => c.recordLinks(body || {}),
    resolvelinks: () => c.resolveLinks({ sourceCapture: q("capture"), viewer: viewerOf(), ...page }),
    linksto: () => c.linksTo({ address_norm: q("address"), viewer: viewerOf(), ...page }),
    recordlinkverdict: () => c.recordLinkVerdict(body || {}),
    navchanges: () => c.navChanges({ host: q("host"), limit: q("limit"), viewer: viewerOf() }),
    derivesitechrome: () => c.deriveSiteChrome({ host: q("host"), limit: q("limit"), after: q("after") }),
    chromeof: () => c.chromeOf({ host: q("host"), ...page }),
    recordsourceoutcome: () => c.recordSourceOutcome(body || {}),
    /* R90 (N983, K3027): judged at the server's instant, this module's clock: a `now` in the query or body is never read. */
    sourcereach: () => c.sourceReachability({ addressNorm: q("address") }),
    taskenqueue: () => c.taskEnqueue(body || {}),
    savecapturesession: () => c.saveCaptureSession(body || {}),
    loadcapturesession: () => c.loadCaptureSession({ session: q("session") }),
    dropcapturesession: () => c.dropCaptureSession({ session: q("session") }),
    sitechrome: () => c.siteChrome({ host: q("host"), threshold: Number(q("threshold")) || 0.6, limit: page.limit }),
    recordcapturelimit: () => c.recordCaptureLimit(body || {}),
    /* R76, R77, R79, R81: by the caller's stamped viewer; an unstamped call sees nothing. The author is the stamp. */
    gradenote: () => c.gradeNoteOf({ captureSha: q("capture") ?? (body && body.captureSha), viewer: q("viewer") ?? "" }),
    /* R95 (T50): one capture's grade, by the caller's stamped viewer as `gradenote` is. */
    capturegrade: () => c.captureGradeOf({ captureSha: q("capture") ?? (body && body.captureSha), viewer: q("viewer") ?? "" }),
    /* R96 (T51): `check` is the only act that reaches outside, and only from a member session (the stamp `by`). */
    heldat: () => c.heldAt({ address: q("address"), sha256: q("sha256"), check: q("check") === "1" || q("check") === "true",
                              viewer: q("viewer") ?? "", member: q("by") }),
    /* R101 (fix round 3, C9): a mutating member act; `by` and the viewer are the control plane's stamps, never the body's, and the
       instant is this instance's clock. */
    captureseenin: () => c.fileSeenIn({ captureSha: (body && body.captureSha) ?? q("captureSha"), project: (body && body.project) ?? q("project"),
                                        by: q("by"), viewer: q("viewer") ?? "" }),
    heldcaptures: () => c.heldCaptures({ member: q("member"), project: q("project"), bundle_id: q("bundle_id"), bundle_ids: q("bundle_ids"), sort: q("sort"), dir: q("dir"), ...page,
                                         state: q("state"), fields: q("fields"), viewer: q("viewer") ?? "" }),
    heldsetaside: () => c.setAside({ ids: body && body.ids, reason: body && body.reason, author: q("by") ?? q("author"),
                                     viewer: q("viewer") ?? "" }),
    heldrestore: () => c.restoreHeld({ ids: body && body.ids, reason: body && body.reason, author: q("by") ?? q("author"),
                                       viewer: q("viewer") ?? "" }),
    reattest: () => c.reattest({ ...(body || {}), by: q("by") ?? (body && body.by) ?? null }),
    lateattestations: () => c.lateAttestationsOf(q("capture") ?? (body && body.captureSha)),
    /* R98 (K4206): the account's instant is this instance's clock, as `op=sourcereach` takes its own (R90): a body's `at` is
       not read, so a member cannot date an account the signature does not cover. In-process callers may still pass `at`. */
    captureaccount: () => c.recordCaptureAccount({ ...(body || {}), at: undefined, by: q("by") ?? (body && body.by) }),
    /* N388: the accounts answer by the caller's sight; an unstamped call sees nothing (REC-30's fail-closed posture). */
    captureaccounts: () => c.captureAccountsOf(q("capture") ?? (body && body.captureSha), { viewer: q("viewer") ?? "" }),
    /* R113 (fix round 9; G127f): a file past the request-body ceiling sent in parts. `by` is the control plane's stamp, never the body's; `captureuploadpart`'s body is the
       part's raw bytes (as `captureupload`'s is the file's), its fields in the address; the whole's digest, the size and the member's words travel in the begin alone. */
    captureuploadbegin: () => c.beginPartedUpload({ sha256: body && body.sha256, bytes: body && body.bytes, statement: body && body.statement, name: body && body.name,
                                                    type: body && body.type, by: q("by") ?? undefined, bounds: h.bounds ?? null, key: h.key ?? null }),
    captureuploadpart: () => c.putUploadPart({ upload: q("upload"), index: q("index") === null || q("index") === "" ? null : Number(q("index")), sha256: q("sha256"), bytes: body,
                                              by: q("by") ?? undefined, declared: q("declared") ? Number(q("declared")) : null, ledger: h.ledger ?? null, key: h.key ?? null }),
    captureuploadcomplete: () => c.completePartedUpload({ upload: body && body.upload, parts: body && body.parts, by: q("by") ?? undefined, key: h.key ?? null }),
    captureuploadabort: () => c.abortPartedUpload({ upload: (body && body.upload) ?? q("upload"), by: q("by") ?? undefined, key: h.key ?? null }),
    /* K72 (11): the Worker's op forwards here with the control plane's stamps in the query. */
    /* R106 (fix round 6, G32): a fetch of an address the record already holds from a plain fetch is made conditional on that copy (the
       digest handed to `acquisition` as `heldSha`), so an unchanged source is not downloaded again; the caller's sight decides which copy. */
    acquire: () => {
      const heldSha = c.heldCopyToCompare(body || {}, q("viewer") ?? "");
      return c.acquire(body || {}, { cls: q("cls"), member: q("member") === "1", sessMember: q("sessMember") || null,
                                    storeName: q("store") || "bio", ...(heldSha ? { heldSha } : {}), ...(h.timings ? { timings: h.timings } : {}) });
    },
    archivelookup: () => c.archiveLookup({ address: (body && body.address) || q("address") }),
    /* R73 (T35; `acquisition` R38, R41): the archive, through this store; `by`, `cls` and the viewer are the control
       plane's stamps, never the body's, and the body names only the archive. */
    unpack: () => c.unpack({ archiveSha: (body && body.archiveSha) || q("archive"), by: q("by"), cls: q("cls"), member: q("member") === "1" }),
    /* R73 (T50; `acquisition` R46): a member's open captures; `by` is the control plane's stamp, never the body's, and the
       instant is this instance's clock, never the request's. */
    opencaptures: () => c.openCaptures({ by: q("by") }),
    archivelist: () => c.archiveList({ archiveSha: q("archive") ?? (body && body.archiveSha), viewer: q("viewer") ?? "",
                                       state: q("state"), ...page }),
  };
}

/* R97 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  gradenote: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("capture.declared.gradenote", "read: one capture's grade note, the words op=acquire's answer carries, keyed by capture sha, null for a capture the viewer may not see; writes nothing"),
    fields: { accepts: ["capture","captureSha"], requires: [] } },
  archivelist: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("capture.declared.archivelist", "read: a held archive's entries, each one's state and, when not filed, its refusal by name; writes nothing"),
    fields: { accepts: ["archive","archiveSha","state","limit","after"], requires: [["archive","archiveSha"]] } },
  heldcaptures: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("capture.declared.heldcaptures", "read: the collected documents not set aside, awaiting a member's decision, as the viewer may see them; writes nothing"),
    fields: { accepts: ["member","project","bundle_id","bundle_ids","sort","dir","limit","after","state","fields"], requires: [] } },
  heldsetaside: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("capture.declared.heldsetaside", "held-directed: a member sets one or more held documents aside with one reason, keyed by their ids, reached from the held list; the set is refused whole or recorded whole, and nothing is deleted"),
    fields: { accepts: ["ids","reason"], requires: ["ids","reason"] } },
  reattest: { classes: ["admin","member","probe"], mutating: true, weight: "attested", description: localize("capture.declared.reattest", "self-attested-capture-directed: asks a timestamp authority, and for a public locator a fresh co-archive, over a capture held without co-attestation, keyed by capture sha; appends a late attestation stating it proves the bytes existed by now, not at capture; reached from a case's pre-flight"),
    fields: { accepts: ["captureSha","locator"], requires: ["captureSha"] } },
  heldrestore: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("capture.declared.heldrestore", "held-directed: a member restores documents set aside, with one reason, keyed by their ids, reached from the held list; the set-aside stays in the record"),
    fields: { accepts: ["ids","reason"], requires: ["ids","reason"] } },
  /* K4208 (T51 FR-52, wave 3): the census reads the screens send. `heldat` takes exactly one of `address` and `sha256` (R96; the
     refusal names the one it was given, or `address` when neither); `by` and `viewer` are stamps. `check` is accepted, never required. */
  heldat: { classes: ["admin","member","probe"], machineClasses: ["admin","probe"], mutating: false, weight: "read", description: localize("capture.declared.heldat", "read: whether an address is held and where its capture stands (`capture` R96); its one write is the governor's bookkeeping, and no record"),
    fields: { accepts: ["address","sha256","check"], requires: [["address","sha256"]] } },
  /* R95: the digest is `capture` in the query or `captureSha` in the body; a missing one is the required-argument refusal naming `captureSha`. */
  capturegrade: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("capture.declared.capturegrade", "read: one capture's grade, keyed by capture sha (`capture` R95); writes nothing"),
    fields: { accepts: ["capture","captureSha"], requires: [["capture","captureSha"]] } },
  /* R69: an absent or malformed digest answers as an unknown one does, with no accounts (an unseen capture and an unknown one read alike),
     so it is not required: no refusal names it. */
  captureaccounts: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("capture.declared.captureaccounts", "read: one capture's signed accounts from its capturing member, keyed by capture sha; writes nothing"),
    fields: { accepts: ["capture","captureSha"], requires: [] } },
  /* K4206 (T51 FR-52): `acquire` hands its body to acquisition's act, which reads these fields; a call with none of locator,
     continue or address is refused naming the locator (BAD_LOCATOR), an archive call without address naming it (BAD_ADDRESS).
     `matchedSweep` is never read from the body (acquisition R31), so it is not declared. */
  acquire: { classes: ["admin","member","probe","daemon"], mutating: true, weight: "substrate", description: localize("capture.declared.acquire", "substrate: the fetch layer (M2')"),
    fields: { accepts: ["address","at","authority","coArchive","continue","file","for","locator","project","render","request","subresources","via"], requires: [["locator","continue","address"]] } },
  /* R101 (T51 fix round 3; C9): a member files a held document in a project; `by` and `viewer` are stamps, so only the two body
     fields are accepted, and both are required (an absent one is the required-argument refusal naming it). It is a corpus write,
     so it needs `contribute` (op-declarations R80: a mutating op with no hand row names its capability); the project fence is
     membership's `projectAuthority`, asked in `fileSeenIn`. */
  captureseenin: { classes: ["admin","member","probe"], mutating: true, stamps: ["by","viewer"], needs: "contribute", weight: "observational", description: localize("capture.declared.captureseenin", "member-directed: a member records once that she filed a held document in a project; a repeat changes nothing, and no reason is asked (capture R101)"),
    fields: { accepts: ["captureSha","project"], requires: ["captureSha","project"] } },
  /* R113 (fix round 9; G127f; K4891): a file past the request-body ceiling is sent in parts through the Worker: begin (the file's digest and size, and what R86 asks of an
     upload), each part in order (its raw bytes the body, its index and digest in the address), complete (the parts' digests in order) and abort. `by` is a stamp; each
     is a member's own act in her own name (the founder's session too, K5056: the classes `captureupload` admits) and needs `contribute` as `captureupload` does. */
  captureuploadbegin: { classes: ["admin","member"], mutating: true, stamps: ["by"], needs: "contribute", weight: "observational", description: localize("capture.declared.captureuploadbegin", "upload-directed: a member begins sending a file too large for one request in parts, naming its digest, its size and where it came from; nothing is held until its parts arrive (capture R113)"),
    fields: { accepts: ["sha256","bytes","statement","name","type"], requires: ["sha256","bytes","statement"] } },
  captureuploadpart: { classes: ["admin","member"], mutating: true, stamps: ["by"], needs: "contribute", weight: "observational", description: localize("capture.declared.captureuploadpart", "upload-directed: a member sends one part of a file begun in parts, in order, its raw bytes the request's body (capture R113)"),
    fields: { accepts: ["upload","index","sha256"], requires: ["upload","index","sha256"] } },
  captureuploadcomplete: { classes: ["admin","member"], mutating: true, stamps: ["by"], needs: "contribute", weight: "observational", description: localize("capture.declared.captureuploadcomplete", "upload-directed: a member completes a file sent in parts, naming the parts' digests in order; the file is then held under its own digest as an upload is (capture R113)"),
    fields: { accepts: ["upload","parts"], requires: ["upload","parts"] } },
  captureuploadabort: { classes: ["admin","member"], mutating: true, stamps: ["by"], needs: "contribute", weight: "reversible", description: localize("capture.declared.captureuploadabort", "upload-directed: a member abandons a file begun in parts; what was sent is discarded and nothing is held (capture R113)"),
    fields: { accepts: ["upload"], requires: ["upload"] } },
  /* K4206 (T51 FR-52; R98): `text` is read, and an empty one is C-118.6 by its row's words (R69), so it is accepted and not
     required; a missing captureSha names itself (R98), a missing signature is refused naming the signature. The instant is
     the server's (R98), so `at` is not declared. */
  captureaccount: { classes: ["admin","member","probe"], mutating: true, weight: "attested", description: localize("capture.declared.captureaccount", "self-attested-capture-directed: the capturing member appends a signed account of when and how they captured it, keyed by capture sha; refused to anyone else; reached where the case marks the capture self-attested"),
    fields: { accepts: ["captureSha","signature","text"], requires: ["captureSha","signature"] } },
});
