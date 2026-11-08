/* acquisition — THE ACQUISITION ACT (R1–R47, R95–R98, R110–R112, its archives R38–R41, R45 and R48 in `unpack.mjs`; `build/requirements/acquisition.md`), split from `capture` (K617, K649 (1))
 * by copy of `capture/acquire.mjs` (K624 (1)), whose Rs it implements with their meaning unchanged: capture R1–R7, R9–R14,
 * R16–R20, R33–R36, R41, R42 and R60–R62 are this module's R1–R23 and R25–R28. It is reached in process (K72 (11)):
 * `capture`'s `acquire` and `archiveLookup` hand their own store in as `cap`, and the capture-request drain calls it
 * through its trusted arm (K58). It fetches, hashes and stores the bytes as they arrive, records the fetch as a receipt,
 * profiles what it is, captures a page's supporting files, requests co-attestation, and ANSWERS the provenance document a
 * caller promotes. It writes no bundle (R25) and it does not READ the document (R8): the reading is `extraction`'s.
 *
 * What `capture` keeps about sources and sites (reachability, site assets, links, sessions, the platform's ceiling, the
 * render allowance, the event queue, the validators) is reached ONLY through the store handed in; this module is earlier
 * in the order than `capture` and imports none of it.
 *
 * T35 (N688, F16, K1888): an archive this act captures is opened in the same call (R40; `unpack.mjs`, R38–R41), no fetch
 * goes to one of the group's own hosts (R42), and the co-archive is asked as the group or the member chooses (R20, R43).
 *
 * T50 (N1117, N1094): a member's `for` is recorded with the capture (R47), the member who parks a session is recorded with it
 * and listed by `openCaptures` (R19, R46), and every member-facing sentence is read by key from setup-words (plan rule 6).
 *
 * T51 fix round 2 (the walk's C5, C12, C13, C25): a capture held in parts is also kept whole under its own digest (`keepWhole`, R10),
 * co-attestation is waited for only briefly and recorded when it ends (R20), the render is a continuation the member finishes
 * (R5, R6, R12), and the document records the file name its source gave it (R16).
 *
 * T51 fix round 3 (the re-walk's C5, C12, C13, C25): a capture of several parts is kept whole from the parts held in memory,
 * once, with no read-back (R96); the trusted timestamp is waited for no set time (R20); the render arm asks the governor with
 * a peek and the fetch books the visit once (R97); the document carries its own title (R98, `title.mjs`).
 *
 * T51 fix round 5 (the second re-walk's E1, E5, E8, E10): a capture held in parts is profiled from the first KiB of its first part (R101);
 * `textTypeOf` is the one rule for reading a member's file as text (R102); `read` is split into download, hash and store (R103); a
 * visitor copy a member's "Finish it" finishes stays owed until its document is filed (R104).
 *
 * T51 fix round 6 (the third re-walk's G2, G3, G12a): a member's large or slow web capture is parked and owed to the plane's alarm, not read in the
 * request (`owedFetch`, R105); "Finish it" renders nowhere in the request (R106); a capture decided to be no archive is not decided again (R107).
 * Fix round 6 (G27, G32): a render that returns after its request has ended is kept in the evidence store at once and its reply dropped (`keepReply`, R5);
 * a caller in process hands the held capture's digest as `opts.heldSha` and the fetch is conditional for a member too (R22).
 *
 * T51 fix round 8 (the fourth walk's G103, G104, G105, G107): a member's open captures are matched by the member, in the door's form or her bare id, and a fetch made and not
 * yet delivered is still listed (`openCaptures`, R110); a delivery refused for a code no later try changes ends in words (`DELIVERY_FINAL`, R111); the render's keep of the
 * bodies its page loaded is inside the render's share of the bar (R112).
 *
 * Every refusal is an answer `{status, body}`, never a throw. The comments carried from the legacy handler keep the
 * reasoning beside the code it explains. */
import { isPublicHttpsLocator, createSha256, EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE, ISO_TS_RE, isMachineIdentity } from "../record-grammar/index.mjs";
import { civicsmithUserAgent, firstHopWho, CAPTURE_REQUEST_ARM_CHECKS, DRIVE_CAPTURE_CHECKS, RENDER_CAPTURE_CHECKS, INSTALLATION_CHECKS,
         SWEEP_SCOPE_CHECKS, CAPTURE_KEEP_CHECKS } from "./checks.mjs";
import { captureSubresources, normalizeAddress, normalizeCitation } from "../subresources.mjs";
import { detectFormat, formatNameFor } from "../formats.mjs";
import { challengeOf, recogniseChallenge, personRefusal, personChecksFor } from "./challenge.mjs";
import { odfEvidentiaryDigest, ODF_FORMATS } from "../odf.mjs";
import { identify, doctypeFor, profileRecord, digests, CONFIDENCE } from "../../../docprofile/registry.mjs";
import { combine } from "../../../jurisdictions/index.mjs";
import { readDriveAddress, driveHop, callerSuppliedHopFacts } from "../drive.mjs";
import { selectCapture } from "../cdx.mjs";
import { WAYBACK_MEMENTO, mementoEndpoints, acceptDatetime, parseTimeMap, timeMapCandidates, readMementoAnswer, mementoRow,
         mementoHop } from "../capture-sources/memento.mjs";
import { RENDER_DEFAULTS, RENDERED_METHOD, completenessReading, keepRenderBodies, renderAllowanceMs, renderConcurrencyCap,
         renderReserveMs, renderBlock, renderedAuthority, rendererFor, renderLocaleFor } from "../render.mjs";
import { governedFetch as hostGovernedFetch, retryAfterMs } from "../host-governor/index.mjs";
import { ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE, rawReplayOf } from "../provenance/index.mjs";
import { attest } from "../attestation/index.mjs";
import { decodeText } from "../ooxml.mjs";
import { isOwnHost } from "../capture-sources/own-hosts.mjs";
import { ARCHIVE_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { unpack, coArchiveStateOf, ledgerOf } from "./unpack.mjs";
import { titleOfBytes, cleanedTitle, decodeAs, charsetOf } from "./title.mjs";
import * as pdfReader from "../pdfstructure.mjs";
import { baseViewer, viewerMember } from "../member-roster/index.mjs";
import { boundOf, statement } from "../read-bounds.mjs";

/* R24, R29, R33: the one user agent, the one first hop's `who`, and this module's rows, for every module that sends,
   writes or judges them. The pre-rename aliases are gone (R34, N539). */
export { CIVICSMITH_CONTACT_URL, civicsmithUserAgent, firstHopWho, CAPTURE_REQUEST_ARM_CHECKS,
         DRIVE_CAPTURE_CHECKS, RENDER_CAPTURE_CHECKS, INSTALLATION_CHECKS, SWEEP_SCOPE_CHECKS, ACQUISITION_CHECKS } from "./checks.mjs";
/* R36, R37 (T33-21, K1449): the keyed-service fetch path and its first client. */
export { limitsByKind } from "./limits.mjs";
export { fileMember, memberRow, MEMBER_KIND, CONTAINER_KINDS } from "./member.mjs";
export { streamRegister, probeRegister, sourceChanged, REGISTER_STREAM_MAX, REGISTER_SEGMENT_MAX, REGISTER_PURPOSE, REGISTER_HOPS_MAX } from "./register.mjs";
export { keyedFetch, keyedCapture, keyedServiceUsage, citationLookup, KEYED_PURPOSES, POLL_SHARE_DEFAULT, KEYED_SERVICE_HOSTS, CITATION_LOOKUP_URL, CITATION_TEXT_MAX, CITATION_LOOKUP_LABEL } from "./keyed.mjs";
/* R38–R41, R43 (T35-21, N688, K1888): archives opened on capture, the read behind the archive screen, and the group's
   co-archive setting; the instance holding this module's tables is `acquisitionOf`'s. */
export { ARCHIVE_CHECKS } from "./checks.mjs";
/* R113 (fix round 9, G127d): a capture's bytes by its whole digest, the parts hidden. */
export { readRange, wholeShaOf } from "./range.mjs";
import { rangeReaderOf } from "./range.mjs";
export { unpack, archiveList, memberOf, membersOf, openedAmong, notArchivesAmong, acquisitionOf, Acquisition, coArchiveStateOf, ACQUISITION_TABLES, CO_ARCHIVE_SETTING,
         UNPACK_CALL_ENTRIES, UNPACK_CALL_BYTES, UNPACK_DAILY_BYTES, UNPACK_DAILY_ENTRIES, UNPACK_LIMITS,
         ARCHIVE_CHECK_READS } from "./unpack.mjs";


const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const stampSecond = (when = Date.now()) => new Date(when).toISOString().replace(/\.\d+Z$/, "Z");
/* K5132's rule for the capture sessions this act reads and saves (K5205): a handed instant (milliseconds) answers first, then the store's
   environment (`BIO_NOW_MS`), else the wall clock. Capture's sessions expire and list on the instant they are given. */
const instantOf = (cap, at = null) => {
  const handed = at ?? (cap && cap.env ? cap.env.BIO_NOW_MS : undefined);
  return handed !== undefined && handed !== null && handed !== "" && Number.isFinite(Number(handed)) ? Number(handed) : Date.now();
};

/* Full 64-hex SHA-256 of a string or a byte view: what docprofile's `digests()` calls to name each normalised
   variant, over the SAME raw bytes for `identity`, which must equal the capture sha. */
export async function sha256Hex(v) {
  return hex(await crypto.subtle.digest("SHA-256", typeof v === "string" ? new TextEncoder().encode(v) : v));
}

/* The row readers of the refusal families capture's arms answer with (C-48 the Drive arm, C-83 the render arm). The
   code is a STRING LITERAL at each site so the DEC-49 guard can compare it; a code with no sentence throws. N228:
   `driveRow` is no longer exported: monitoring answers its tick's C-48.8 and C-48.9 from `DRIVE_CAPTURE_CHECKS`
   itself, so no module reads capture's. */
const driveRow = (code) => {
  const row = DRIVE_CAPTURE_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`driveRow: ${code} has no DRIVE_CAPTURE_CHECKS row with a canned translation (DEC-49).`);
  return { code, check: row.check, translation: row.translation };
};
const renderRow = (code) => {
  const row = RENDER_CAPTURE_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`renderRow: ${code} has no RENDER_CAPTURE_CHECKS row with a canned translation (DEC-49).`);
  return { code, check: row.check, translation: row.translation };
};

/* N80 (K225 (4)): the answer's `note`, which this module composes itself (moved from `affordances.mjs`, REC-48 /
   DEC-39). It is the RECEIPT a caller who has just received bytes reads beside the capture's own `grade`, saying
   in one line what the capture is worth; it is NOT the attest fence (`ATTEST_FENCE`, read by a member DECIDING
   whether to co-attest), and neither replaces the other. Both letters are COMPOSED from the enforced ceiling and
   the letter one rank above it in the same grade array, never typed, so a change of doctrine moves the sentence
   with it. It REFUSES TO COMPOSE a sentence it cannot make true: with no letter above the ceiling it throws at
   load, which stops the plane, rather than shipping "Grade null needs a chain-of-custody web archive". */
export const acquireGradeNote = (ceiling, unreachable) => {
  if (!ceiling || !unreachable)
    throw new Error("op=acquire's note states what this surface earns AND the grade above it; "
                  + "with no grade above the ceiling the sentence cannot be composed truthfully");
  return word("acquisition.text.grade_bytes_fetched", { ceiling, unreachable });
};
export const ACQUIRE_GRADE_NOTE = acquireGradeNote(EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE);

/** R9, R24. The plane's identity to a source, in one place because it was in three and they had drifted. BIO does
 *  not disguise its requests; a bare token matches no browser and no known-good crawler pattern, and a great many WAF
 *  rulesets refuse exactly that shape. The STRING is composed by this module's `civicsmithUserAgent` (R24) so the drain's
 *  conduct check reads the bytes that will be sent. A DELEGATED member-browser agent is returned verbatim: it reaches
 *  here only from the capture-request arm, read from a row the conduct check already judged (PL-4, BOB-3). */
export function userAgent(env, purpose = "acquire", delegated = null) {
  if (typeof delegated === "string" && delegated.trim() !== "") return delegated.trim();
  return civicsmithUserAgent((env && env.VERSION) || "0.0.0", (env && env.INSTANCE_NAME) || "unnamed", purpose);
}

/* Whether a primary is read back as TEXT for the recognisers and FW-4's digests: single-part, bounded, and a textual
   declared type. One rule, read by acquire when it records a capture and by op=monitor when it compares one (D-60). */
export const PROFILE_TEXT_MAX = boundOf("capture", "profile_text_bytes");
/* R17, R101: the bytes of a capture's head its format is judged from when the capture is held in parts: the first KiB of the first part. */
export const FORMAT_HEAD = 1024;
/* D-351: the bound on reading an OpenDocument capture back whole for its container digest. Chosen, not measured. */
export const ODF_DIGEST_MAX = boundOf("acquisition", "odf_digest_bytes");   // R122: quoted from READ_BOUNDS
export function profilesAsText(ct, total, multipart) {
  return !multipart && total <= PROFILE_TEXT_MAX
    && /^(?:text\/|application\/(?:xhtml\+xml|xml|json)|application\/[a-z0-9.+-]*\+xml)/i.test(ct || "");
}

/** R102 (fix round 5, E5): THE ONE RULE for reading a file a member brought in as text, shared by the upload and the knock's pull.
 *  `textTypeOf({bytes, type, name})` answers the text content type the bytes are to be profiled and read as, else null: the
 *  declared `type` when it is a text type (`profilesAsText`), or, when none is declared, the type a `.txt`, `.md`, `.csv`, `.tsv` or `.tab` name
 *  stands for (csv-reader's delimited names); and only for bytes that are text, valid UTF-8 with no NUL, within what a profile reads as text (`PROFILE_TEXT_MAX`).
 *  A declared type that is not text is never overridden by a name. Pure; never throws. */
const NAME_TEXT_TYPES = Object.freeze({ txt: "text/plain", md: "text/markdown", csv: "text/csv", tsv: "text/tab-separated-values", tab: "text/tab-separated-values" });
export function textTypeOf({ bytes = null, type = null, name = null } = {}) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length > PROFILE_TEXT_MAX) return null;
    const named = typeof type !== "string" || type === "" ? /\.(txt|md|csv|tsv|tab)$/i.exec(typeof name === "string" ? name : "") : null;
    const readAs = named ? NAME_TEXT_TYPES[named[1].toLowerCase()] : type;
    if (typeof readAs !== "string" || readAs === "" || !profilesAsText(readAs, bytes.length, false)) return null;
    /* R120: the one decode; UTF-16 carries NULs by its nature, any other NUL is a binary file; replacement over 0.5 % is not text */
    const d = decodeText(bytes, { declared: charsetOf(readAs) ?? undefined, kind: /html|xml/i.test(readAs) ? (/html/i.test(readAs) ? "html" : "xml") : undefined, name: charsetOf(readAs) ?? undefined });
    if (!d.ok || d.replaced_ratio > 0.005) return null;
    if (bytes.includes(0) && !(d.encoding.startsWith("utf-16") && (bytes.length >= 16 || d.assumed === false))) return null;
    return readAs;
  } catch { return null; }
}

/** R17's `digests`: THE ONE FUNCTION that decides whether a document's normalised digests can be trusted to assert
 *  sameness, and computes them when they can (FW-4; op=monitor asks the same question, D-60). `determined` only
 *  under a CERTAIN textual handler whose read-back bytes hash to `sha`; D-351's container arm for an OpenDocument
 *  package whose content.xml can speak for the substance. Null digests otherwise, never invented. */
export async function substanceDigests(profileBytes, stackId, profCtx, sha, multipart, containerBytes = null) {
  const digestCertain = !!profileBytes && stackId.handler.textual === true && stackId.confidence === CONFIDENCE.CERTAIN;
  if (!digestCertain && !profileBytes && containerBytes && !multipart) {
    let od;
    try { od = await odfEvidentiaryDigest(containerBytes, sha256Hex); }
    catch (e) { od = { determined: false, flavour: "unread",
      basis: word("acquisition.basis.container_digest_taken", { e: String(e && e.message || e).slice(0, 90) }) }; }
    if (od.determined) {
      if (await sha256Hex(containerBytes) !== sha)
        return { determined: false, rendition: null, evidentiary: null,
          basis: word("acquisition.basis.container_bytes_read") };
      return { determined: true, rendition: null, evidentiary: od.evidentiary, over: od.over, container: od.flavour,
               boundary_missed: false, basis: od.basis };
    }
    if (od.flavour) return { determined: false, rendition: null, evidentiary: null, container: od.flavour, basis: od.basis };
  }
  if (!digestCertain)
    return { determined: false, rendition: null, evidentiary: null,
      basis: profileBytes
        ? word("acquisition.basis.stack_identified_certainty", { key: stackId.handler.key, confidence: stackId.confidence })
        : word("acquisition.basis.document_read_text", { large: multipart ? "multipart" : word("acquisition.basis.non_textual_too") }) };
  const dg = await digests(profileBytes, stackId.handler, { ...profCtx, sha256: sha256Hex });
  if (dg.identity !== sha)
    return { determined: false, rendition: null, evidentiary: null,
      basis: word("acquisition.basis.primary_bytes_read") };
  return { determined: true, rendition: dg.rendition, evidentiary: dg.evidentiary, boundary_missed: !!dg.boundary_missed,
           basis: word("acquisition.basis.normalized_under_certain", { key: stackId.handler.key, version: stackId.handler.version }) };
}

/** R16 (T51; the walk's C25): the file name the source gives a document, for naming it when it has no title of its own: the
 *  `Content-Disposition` header's (RFC 6266; the extended `filename*` of RFC 5987 before the plain `filename`), else the last
 *  segment of the document's own address when that names a file (it ends in a dot and an extension). Decoded, a path taken
 *  off it, white space trimmed, at most 200 characters; null when the source gives none, never made up from the host or the date.
 *  Pure; never throws. */
export const FILE_NAME_MAX = 200;
export function fileNameOf(headers, address) {
  const clean = (v) => {
    if (typeof v !== "string") return null;
    const last = v.replace(/\\/g, "/").split("/").pop().replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return last && last.length <= FILE_NAME_MAX && last !== "." && last !== ".." ? last : null;
  };
  const decode = (v) => { try { return decodeURIComponent(v); } catch { return null; } };
  try {
    const cd = headers && typeof headers.get === "function" ? headers.get("content-disposition") : null;
    if (typeof cd === "string") {
      const ext = /filename\*\s*=\s*([^;]*)/i.exec(cd);
      if (ext) {
        const m = /^\s*([A-Za-z0-9._-]+)'[^']*'(.*)$/.exec(ext[1].trim());
        const got = m ? (/^utf-?8$/i.test(m[1]) ? decode(m[2]) : null) : null;
        const c = clean(got); if (c) return c;
      }
      const plain = /(?:^|;)\s*filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]*)/i.exec(cd);
      if (plain) { const c = clean(plain[2] !== undefined ? plain[2].replace(/\\(.)/g, "$1") : plain[1].trim()); if (c) return c; }
    }
    if (typeof address === "string") {
      const seg = new URL(address).pathname.split("/").pop();
      const c = clean(decode(seg));
      if (c && /\.[A-Za-z0-9]{1,8}$/.test(c)) return c;
    }
  } catch { /* the source gave no name */ }
  return null;
}

/** R17 (T51; the walk's C26): the digests of bytes this instance did not store, as `profileOf` would record them for a capture of
 *  those bytes: the stack identified from the headers, the address and the content type, then `substanceDigests`, the one
 *  function that decides whether a digest can be trusted to assert sameness. For a reader (`capture` R96's look at a site)
 *  that compares the substance of what a site serves now with the digests a held copy recorded. Answers
 *  `{sha256, handler, handler_version, digests}`, `digests` as R17 states them (`determined` only under a certain stack whose
 *  normalised bytes hash to the capture's identity). The bytes are bounded as R17's are (`PROFILE_TEXT_MAX`, `ODF_DIGEST_MAX`);
 *  past them the digests are undetermined. Never throws. */
export async function servedSubstance({ bytes, headers = {}, locator = null, contentType = null, view = undefined } = {}) {
  const undetermined = (basis, sha = null) => ({ sha256: sha, handler: null, handler_version: null,
    digests: { determined: false, rendition: null, evidentiary: null, basis } });
  try {
    if (!(bytes instanceof Uint8Array)) return undetermined(word("acquisition.basis.document_read_text", { large: "non-textual" }));
    const sha = await sha256Hex(bytes);
    const asText = profilesAsText(contentType, bytes.length, false);
    const profCtx = { headers, locator, content_type: contentType || null,
                      text: asText ? (decodeAs(bytes, contentType).text ?? "") : "", ...(view ? { view } : {}) };
    const stackId = identify(profCtx);
    const digests = await substanceDigests(asText ? bytes : null, stackId, profCtx, sha, false,
                                           asText || bytes.length > ODF_DIGEST_MAX ? null : bytes);
    return { sha256: sha, handler: stackId.handler.key, handler_version: stackId.handler.version, digests };
  } catch (e) { return undetermined(String(e && e.message || e).slice(0, 120)); }
}

/** R17: the combined view of the instance's active jurisdiction profiles (record-core's `jurisdiction_profiles`,
 *  jurisdictions.combine). An instance that has never set the setting passes no view, which is docprofile's own
 *  legacy fallback (its R6, K39), so an instance keeps recognising what it recognised; a setting that does not
 *  combine passes no view either, and says so in `basis`. */
export function profileView(core) {
  const ids = core && typeof core.getSetting === "function" ? core.getSetting("jurisdiction_profiles") : null;
  if (!Array.isArray(ids)) return { view: undefined, ids: null, basis: word("acquisition.basis.active_jurisdiction_profiles") };
  const c = combine(ids);
  return c.ok ? { view: c.view, ids, basis: word("acquisition.basis.combined_view", { profile: ids.length ? ids.join(", ") : "no profile" }) }
              : { view: undefined, ids, basis: word("acquisition.basis.active_profiles_did", { code: (c.errors || []).map((e) => e.code).join(", ") }) };
}

/* The locale a render asks for (R7): capture-sources' `renderLocaleFor` over R17's view (K119), the default only as
   its own fallback. */
const renderLocale = (view) => renderLocaleFor(view);

/* R9, R28: every outbound fetch through the host governor (host-governor R15–R17), under the agent this module
   composes. The governor is reached in process (K72 (2)). `headers` are R22's conditional request headers;
   `credential` is R23's (capture-sources R56's entry), sent by `scopedFetch` to its own host only. */
export async function governedFetch(cap, target, purpose, delegated = null, { headers = null, credential = null, manual = false } = {}) {
  const g = cap.governor;
  const doFetch = headers || credential ? scopedFetch(target, { headers, credential, env: cap.env, purpose, follow: !manual }) : (u, i) => fetch(u, i);
  /* `manual`: the redirect is the answer, not followed (R32 reads a TimeGate's redirect and a memento's own status; R31
     judges each hop of a sweep against its scope). */
  return hostGovernedFetch(target, { userAgent: userAgent(cap.env, purpose, delegated),
    fetch: manual ? (u, i) => doFetch(u, { ...i, redirect: "manual" }) : doFetch,
    governor: g ? { admit: (q) => g.governorAdmit(q), report: (q) => g.governorReport(q) } : null });
}

/* R23: the kinds of credential a member may supply (capture-sources R55), and how each rides a request. */
const CREDENTIAL_KINDS = Object.freeze(["login", "user-agent", "other"]);
const REDIRECT_MAX = 20;
const base64Of = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
/* A supplied agent is a DELEGATED one, so it is sent through R9's one function, which returns it verbatim. */
function withCredential(headers, credential, env, purpose) {
  if (credential.kind === "user-agent") return { ...headers, "user-agent": userAgent(env, purpose, credential.secret) };
  if (credential.kind === "login") return { ...headers, authorization: `Basic ${base64Of(credential.secret)}` };
  return { ...headers, authorization: credential.secret };
}

/* R22, R23: the fetch the governor calls, adding R22's conditional headers and, on the address's OWN host only,
   R23's credential. With a credential, redirects are followed BY HAND so that a hop to another host is fetched
   without it (capture-sources R56's caller obligation): the runtime's own following would carry the header on. A
   redirect this call follows by hand is held to R28's fence: a hop to an address that is not a public locator (or one
   that does not parse) is not followed, and the redirect itself is the answer, so the source is refused by name. */
function scopedFetch(target, { headers, credential, env, purpose, follow = true }) {
  let home = null;
  try { home = new URL(target).hostname.toLowerCase(); } catch { home = null; }
  return async (u, init = {}) => {
    const plain = { ...(init.headers || {}), ...(headers || {}) };
    if (!credential) return fetch(u, { ...init, headers: plain });
    let url = String(u);
    for (let hop = 0; ; hop++) {
      let host = null;
      try { host = new URL(url).hostname.toLowerCase(); } catch { host = null; }
      const res = await fetch(url, { ...init, redirect: "manual", headers: host && host === home ? withCredential(plain, credential, env, purpose) : plain });
      const loc = res.status >= 300 && res.status < 400 && res.status !== 304 ? res.headers.get("location") : null;
      if (!loc || hop >= REDIRECT_MAX || !follow) return res;
      let next = null;
      try { next = new URL(loc, url).href; } catch { next = null; }
      if (!next || !isPublicHttpsLocator(next)) return res;
      try { await res.body?.cancel?.(); } catch { /* the hop's body is not read */ }
      url = next;
    }
  };
}

/* R95 (T51; K4194): THE MILLISECONDS EACH STAGE OF `acquire` TOOK, by name, on every answer. The caller may hand in its own
   `opts.timings` object, which `acquire` keeps current as the stages run, so a caller that stops waiting (the door's bound,
   control-plane R105) reads what had run and what was running when it stopped, through `stageTimes`. Stages never nest;
   `receipt`, `fetch`, `read` and the others add up over the hops or parts that repeat them. */
const clockNow = () => performance.now();
function openTimings(given) {
  const t = given && typeof given === "object" && !Array.isArray(given) ? given : {};
  t.start = clockNow(); t.end = null; t.stages = {}; t.running = null; t.split = null;
  return t;
}
function stageBegin(t, name) { stageEnd(t); t.running = { name, since: clockNow() }; }
function stageEnd(t, at = clockNow()) {
  if (!t.running) return;
  t.stages[t.running.name] = (t.stages[t.running.name] || 0) + (at - t.running.since);
  t.running = null;
}
async function timed(t, name, work) {
  stageBegin(t, name);
  try { return await work(); } finally { stageEnd(t); }
}
/* R103 (fix round 5, E10): inside `read`, the milliseconds the source's download (`download`), the hash (`hash`) and the store's
   writes (`store`) took; each is measured where it runs and never nests with another. */
function splitOpen(t) { t.split = { download: 0, hash: 0, store: 0 }; }
async function splitTimed(t, part, work) {
  const since = clockNow();
  try { return await work(); } finally { if (t.split) t.split[part] += clockNow() - since; }
}
/** R95: `{total_ms, stages: {<stage>: ms}}` of an `acquire`, read at any moment: whole milliseconds, every stage floored and
 *  the total ceiled, so the stages sum to no more than the whole; a stage still running names itself as `running`. R103: once the
 *  body is being read, `read_split` states, within `read`, the milliseconds of `download`, `hash` and `store`. */
export function stageTimes(t, at = undefined) {
  if (!t || typeof t !== "object" || !t.stages) return { total_ms: 0, stages: {} };
  const now = at ?? clockNow(), stages = {};
  for (const [k, v] of Object.entries(t.stages)) stages[k] = Math.floor(v);
  if (t.running) stages[t.running.name] = Math.floor((t.stages[t.running.name] || 0) + (now - t.running.since));
  const split = t.split ? { download: Math.floor(t.split.download), hash: Math.floor(t.split.hash), store: Math.floor(t.split.store) } : null;
  return { total_ms: Math.ceil((t.end ?? now) - t.start), stages, ...(split ? { read_split: split } : {}), ...(t.running ? { running: t.running.name } : {}) };
}

/* R47: the longest `for` (a question's id) a member may name. */
export const FOR_MAX = 200;

/* T53-526 (format-registry R38, R39, R35): what `detectFormat` answers is read by its KIND, never by the one word `undetermined`. `refused` is a
   type this copy does not keep (R139) and is never a detection; `unlisted` is held and named (R138), and `unlisted` with `named: null` names nothing;
   `text` is valid text with no other leading structure, a text capture. An answer is a DETECTION OF THE BYTES (and so stands over a declared type)
   when it is neither `undetermined`, a refusal, an unnamed `unlisted`, nor the bare `text` fallback. */
const isRefusedKind = (d) => !!d && d.format === "refused";
const isNamedKind = (d) => !!d && d.format !== "undetermined" && d.format !== "refused" && !(d.format === "unlisted" && (d.named === null || d.named === undefined));
const isSignature = (d) => isNamedKind(d) && d.format !== "text";

/* R139 (T53; N1266, RF11): the head of a body that is read to recognise a refused kind before anything is stored: the longest signature a
   refused kind has in its head (an ISO's, at 37 KiB) is within it. */
export const REFUSE_HEAD_BYTES = 40960;
/* R139: the member words for a refused kind: its plain name and the reason it is not kept, `file.kind.*` and `file.refused.reason.*`, never a
   type name built from an extension. */
export function refusedFacts(d) {
  const n = formatNameFor(d);
  let reason = null;
  try { reason = n.reason_key ? word(n.reason_key) : null; } catch { reason = null; }
  const kind = n.text || word("file.kind.other");
  return { kind: n.name, kind_key: n.kind_key, kind_text: kind, reason_key: n.reason_key ?? null, reason_text: reason,
           detail: localize("acquisition.index.file_type_refused", "A {kind} is not kept{reason}. Nothing was saved.", { kind: String(kind), reason: reason ? `: ${reason}` : "" }) };
}
/* R138 (T53; N1266, RF10): a file `format-registry` answers `unlisted` is filed whole and its reading is stated "held, not read: {name}"; the
   owed reading is the job table's `held-unread` verdict, re-run when the roster gains the type (reading-pipeline, GAP-1.4). */
export function heldUnreadOf(d) {
  const n = formatNameFor(d);
  const name = n.text || word("file.kind.other");
  return { state: "held-unread", named: d.named ?? null, kind_key: n.kind_key,
           text: localize("acquisition.profile.held_not_read", "held, not read: {name}", { name: String(name) }) };
}

/* R10: the most this surface will take from one source, in parts or not; exported once, so every other reader of the
   limit imports it (K231; N825, K2453). */
export const CAPTURE_MAX = boundOf("archive", "uploaded_bytes");   // R114: quoted from READ_BOUNDS

/* R10, R11, R96 (T51; the walk's C5): a capture held in several parts is also kept WHOLE, under the whole document's own
   fingerprint, up to this many bytes, so every reader that asks the evidence store for a capture by its digest (the reading,
   OCR, the vouch box, `op=capture`) finds it as it finds a single part. The parts' bytes are held in memory while they stay
   under it, and the whole is put once when the body ends, with no part read back. Past it the capture is held in its parts
   alone, as before (provenance R7 reads such a capture by its parts), until the object store offers a way to make the whole
   from parts without reading them (R96's past-memory arm). CHOSEN, not measured: four parts, the most the object holds in
   memory beside the whole it assembles; recorded by BOB. */
export const MULTIPART_KEEP_MAX = boundOf("capture", "keep_bytes");
/* R96 (fix round 4, C5c): the door's bound for an `acquire` (control-plane R105: 25 s) and what `acquire` leaves of it for the rest of the call
   after awaiting a keep. CHOSEN, not measured; the plane may hand its own as `opts.boundMs`. */
const ACQUIRE_BOUND_MS = 25000;
const KEEP_RESERVE_MS = 5000;

/* R96: the keeps under way, by the whole's digest, so a second press of the same capture while the first is under way waits
   for it and finds the object kept, never writing it twice. */
const KEEPING = new Map();

/* R100 (fix round 4b, F5, F11): OWED CAPTURE WORK IS NEVER DROPPED. A web capture's outstanding supporting files and its pending
   render are parked as a capture session (capture R22), which capture prunes an hour after its last save; the session is
   therefore parked for `OWED_SESSION_TTL_MS` when the plane's owed-work ledger can take the entry, and the entry is registered
   with the hook the plane hands in at composition, read as `opts.owedLater` else the store's `owedLater` (as `keepLater` is):
   an async `owedLater(entry) -> {ok: true}` that never throws. Acquisition cannot import the plane (it is earlier in the
   order); with no hook handed in the session expires as before and a member's "Finish it" is the only way on. */
export const OWED_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/* R116 (fix round 9, G126; K4835 (2); 2c item 1): THE JOB TABLE IS WRITTEN THROUGH THE REGISTRAR. Work this module owes (`keep`, `fetch`, `subresources`,
   `unpack`) is one job row, registered by `registerJob(entry) -> {ok, existed, state}` (synchronous, never throws), read as `keepLater` is: the store handed
   in's, else `opts.registerJob`, else none; acquisition imports nothing of a later module. A registrar that answers `{ok: false}` is stated in the answer
   (`jobs`), never swallowed; with no registrar the older hooks (`owedLater`, `keepLater`) serve as before and a piece of work owed to no one is stated too. */
const registrarOf = (cap, opts) => (cap && typeof cap.registerJob === "function" ? (e) => cap.registerJob(e)
  : opts && typeof opts.registerJob === "function" ? opts.registerJob : null);
/* what a call could not register, for the answer: `[{kind, reason}]`, one per kind */
const noteJob = (opts, kind, reason) => { const n = opts && opts.jobNotes; if (Array.isArray(n) && !n.some((x) => x.kind === kind)) n.push({ kind, reason: String(reason).slice(0, 80) }); };
/* R116 (fix round 9, G175; K5005): a row the registrar accepts is followed, once it is written, by the plane's `armJobs` (the store handed in's, else `opts.armJobs`), as capture
   and extraction arm theirs, so owed work is due at once and not at an alarm set for later. An alarm not armed is the backstop's, never a failed capture. */
const armerOf = (cap, opts) => (cap && typeof cap.armJobs === "function" ? () => cap.armJobs() : opts && typeof opts.armJobs === "function" ? opts.armJobs : null);
const armAfter = async (cap, opts) => { const f = armerOf(cap, opts); if (f) { try { await f(); } catch { /* the next alarm arms it */ } } };
const oweOf = (cap, opts) => {
  const reg = registrarOf(cap, opts);
  if (reg) return async (entry) => {
    let r;
    try { r = reg(entry); } catch (e) { r = { ok: false, reason: "REGISTRAR_THREW" }; }
    if (r && r.ok === true) { await armAfter(cap, opts); return true; }
    noteJob(opts, entry && entry.kind, (r && r.reason) || "REGISTRAR_REFUSED");
    return false;
  };
  const f = opts && typeof opts.owedLater === "function" ? opts.owedLater : cap && typeof cap.owedLater === "function" ? (e) => cap.owedLater(e) : null;
  if (!f) return null;
  return async (entry) => { try { const r = await f(entry); return !!(r && r.ok === true); } catch { return false; } };
};
/* R116: the `keep` hand-off, `keepLater({sha, parts}) -> {ok}`: the registrar's row of kind `keep` keyed by the whole's digest, else the older hook */
const keepLaterOf = (cap, opts) => {
  const reg = registrarOf(cap, opts);
  if (reg) return async (k) => { let r; try { r = reg({ kind: "keep", sha: k.sha, parts: k.parts }); } catch { r = { ok: false, reason: "REGISTRAR_THREW" }; }
    if (!(r && r.ok === true)) noteJob(opts, "keep", (r && r.reason) || "REGISTRAR_REFUSED"); else await armAfter(cap, opts); return { ok: !!(r && r.ok === true) }; };
  return opts && typeof opts.keepLater === "function" ? opts.keepLater : undefined;
};

/* R105 (fix round 6, G2; K4562): A LARGE WEB CAPTURE IS OWED WORK, NOT THE MEMBER'S WAIT. The door answers in 25 s and a source's
   download runs at the source's speed (a 15.9 MB file took 23 s), so a capture whose body is large, or slow, is not read in the
   request: it is parked as a capture session, registered in the plane's ledger as `{kind: "fetch", session}`, and answered at once
   `fetch_pending`; the alarm's `owedFetch` makes the capture with no bound but the alarm's own and hands the document to `deliver`.
   `LARGE_FETCH_BYTES` is the most a request reads (a declared length over it is parked before one byte is read; with no length, the
   body read past it is parked); `FETCH_WAIT_MS` the longest a request reads a body (~10 s, as `RENDER_WAIT_MS` bounds the render).
   CHOSEN by the plan (K4562), not measured. */
export const LARGE_FETCH_BYTES = boundOf("acquisition", "large_fetch_bytes");   // R122: quoted from READ_BOUNDS
export const FETCH_WAIT_MS = 10000;
/* the digest a parked fetch's session names as its primary: there is none yet, and the column is not null */
const NO_PRIMARY = "0".repeat(64);
/* the `Content-Length` a response declares, whole bytes, else null (absent, malformed, or not a number) */
const declaredLength = (headers) => {
  const v = headers && typeof headers.get === "function" ? headers.get("content-length") : null;
  return typeof v === "string" && /^\d{1,15}$/.test(v.trim()) ? Number(v.trim()) : null;
};

/** R96 (C5 e; record-core R87, K4363): a capture too large for memory is made whole by the store itself, from the parts it
 *  holds: `ev.putFromParts(digest, partDigests)` writes one object under the digest by the store's own multipart upload,
 *  streaming each stored part in turn, so this module reads no part back and holds no more than the part being written. It is
 *  asked after the answer, outside the door's bound, once for a digest (a second press while the first is under way shares it),
 *  and its refusal or failure never fails the capture, whose parts stay held and named. A store that offers no such call
 *  (feature-detected) leaves the capture in its parts alone, as before. Answers the promise of `{ok, kept}`, or null when the
 *  store offers no call. Never rejects. */
function keepFromParts(ev, { sha, parts }) {
  if (!ev || typeof ev.putFromParts !== "function") return null;
  const going = KEEPING.get(sha);
  if (going) return going;
  const mine = (async () => {
    try {
      const r = await ev.putFromParts(sha, parts.map((p) => p.sha256));
      return r && r.ok === true ? { ok: true, kept: true } : { ok: false, why: String(r && (r.reason || r.detail) || "refused").slice(0, 120) };
    } catch (e) { return { ok: false, why: String(e && e.message || e).slice(0, 120) }; }
  })().finally(() => { if (KEEPING.get(sha) === mine) KEEPING.delete(sha); });
  KEEPING.set(sha, mine);
  return mine;
}

/** R96 (fix round 4, C5c; fix round 4b, F2; R100): the keep of a capture past what memory holds, as `acquire` makes it and as
 *  `capture`'s upload makes it: the store makes the whole from the parts it holds (`putFromParts`, record-core R87), this call
 *  AWAITS it within what is left of the door's bound (`boundMs` less the 5 s reserved for the rest of the call, less
 *  `elapsedMs`), and a keep that has not ended by then is handed to `keepLater({sha, parts: [digest, ...]})` (the plane's
 *  owed-work ledger, finished by its alarm): no keep relies on a promise nothing keeps alive after the answer. `parts` are the
 *  part digests in order, or `{sha256}` objects. Answers `{started, kept, keep_pending}`: `started` false when the store offers
 *  no such call (the capture stays in its parts); `kept` true when the whole was put in time; `keep_pending` true when the
 *  ledger took it. Never throws. */
export async function keepPast(cap, ev, { sha, parts, boundMs = ACQUIRE_BOUND_MS, elapsedMs = 0, keepLater = null, defer = false } = {}) {
  const digests = (Array.isArray(parts) ? parts : []).map((p) => (typeof p === "string" ? p : p && p.sha256));
  if (!digests.length || !ev || typeof ev.putFromParts !== "function") return { started: false, kept: false, keep_pending: false };
  /* R96, R100 (fix round 7, G79): `defer` hands the keep to the ledger AT ONCE: the answer does not wait for it and this call does not start it, the plane's
     alarm makes the whole (the ledger keeps it alive, so the reason holds). A ledger that is not handed in, or refuses the entry, leaves the keep
     to be made here and awaited within the bound, as without `defer`. */
  const laterOf = typeof keepLater === "function" ? keepLater : cap && typeof cap.keepLater === "function" ? (k) => cap.keepLater(k) : null;
  if (defer && laterOf) {
    try { const r = await laterOf({ sha, parts: digests }); if (r && r.ok === true) return { started: true, kept: false, keep_pending: true }; }
    catch { /* a ledger that threw took nothing: the keep is made here */ }
  }
  const making = keepFromParts(ev, { sha, parts: digests.map((d) => ({ sha256: d })) });
  const left = Math.max(0, boundMs - KEEP_RESERVE_MS - elapsedMs);
  const got = await within(making, left);
  if (got.done && got.value && got.value.ok) return { started: true, kept: true, keep_pending: false };
  /* BOB #244 (K4433): the plane's hand-off is `keepLater({sha, parts}) -> {ok: true}`, read as the caller's, else the store's;
     with none handed the capture stays in its parts, as without a plane. */
  const later = laterOf;
  let pending = false;
  if (later) { try { const r = await later({ sha, parts: digests }); pending = !!(r && r.ok === true); } catch { pending = false; } }
  return { started: true, kept: false, keep_pending: pending };
}

/** R10, R96 (C5): keep a multipart capture whole. With `bytes`, the parts' buffers the stream already holds (one for each
 *  part, in order), the whole is assembled from them and put once under its digest with its checksum: no part is read back
 *  from the store and no part is hashed again; the store verifies the whole by the checksum it is handed, and each buffer is
 *  released as it is copied. Without them (a caller that holds none: `capture`'s upload of a file the member sent) the parts
 *  just stored are read back one at a time, each held, each its stated size and digest, assembled and hashed against the
 *  digest given; with `compose: true` the store is asked to make the whole from its parts first (see below). Answers `{ok: true, kept}` (`kept` false for one part or past `MULTIPART_KEEP_MAX`, where nothing is done)
 *  or `{ok: false, why}`, a sentence for the member: a part gone, a part that is not what was stored, bytes that do not add
 *  up to the digest, or a store that will not take the whole. Never throws. */
export async function keepWhole(ev, { sha, parts, total, bytes = null, compose = false, whole: given = null, ledger = null }) {
  if (!Array.isArray(parts) || parts.length < 2 || total > MULTIPART_KEEP_MAX) return { ok: true, kept: false };
  const fail = (why) => ({ ok: false, why });
  const held = Array.isArray(bytes) && bytes.length === parts.length && bytes.every((b) => b instanceof Uint8Array) ? bytes : null;
  const work = async () => {
    try {
      if (await ev.head(sha)) return { ok: true, kept: true };
      /* R96 (fix round 7, G79): a caller that holds no buffers (`capture`'s upload) may ask `compose`: the store then makes the whole from the parts it holds
         (`putFromParts`, record-core R87), and this module reads no part back, hashes nothing again and puts no whole; the store verifies the whole against
         its digest. A store that offers none, or refuses, is read back, as without `compose`. */
      if (!held && compose === true && typeof ev.putFromParts === "function") {
        let r = null;
        try { r = await ev.putFromParts(sha, parts.map((p) => p.sha256)); } catch { r = null; }
        if (r && r.ok === true) return { ok: true, kept: true };
        /* a store that would not compose it (no multipart upload offered, a refusal) leaves the parts to be read back below, which says which part is wrong if one is */
      }
      /* R115: the whole was received into one buffer; it is put as it is, no second copy */
      if (given instanceof Uint8Array && given.length === total) { await ev.put(sha, given); return { ok: true, kept: true }; }
      const counted = !held && ledger && typeof ledger.hold === "function" ? ledger : null;
      if (counted) counted.hold(total, "kept");
      try {
      const whole = new Uint8Array(total);
      let at = 0;
      for (const [i, p] of parts.entries()) {
        let b;
        if (held) { b = held[i]; held[i] = null; }
        else {
          const o = await ev.get(p.sha256);
          if (!o) return fail(localize("acquisition.index.keep_part_missing", "part {n} of {parts} was not there when it was read back", { n: String(i + 1), parts: String(parts.length) }));
          b = new Uint8Array(await o.arrayBuffer());
          if (counted) counted.hold(b.length, "part");
        }
        if (b.length !== p.bytes || at + b.length > total || (!held && hex(await crypto.subtle.digest("SHA-256", b)) !== p.sha256))
          return fail(localize("acquisition.index.keep_part_differs", "part {n} of {parts} is not what was stored", { n: String(i + 1), parts: String(parts.length) }));
        whole.set(b, at); at += b.length;
        if (counted && !held) counted.release(b.length, "part");
      }
      if (at !== total || (!held && hex(await crypto.subtle.digest("SHA-256", whole)) !== sha))
        return fail(localize("acquisition.index.keep_parts_do_not_add_up", "the parts do not add up to the document that arrived"));
      await ev.put(sha, whole);
      return { ok: true, kept: true };
      } finally { if (counted) counted.release(total, "kept"); }
    } catch (e) {
      return fail(localize("acquisition.index.keep_store_refused", "the store would not take it ({detail})", { detail: String(e && e.message || e).slice(0, 120) }));
    }
  };
  const going = KEEPING.get(sha);
  if (going) {
    const r = await going;
    try { if (r.ok && await ev.head(sha)) return r; } catch { /* kept by the other press in another store, or not at all: keep it here */ }
  }
  const mine = work().finally(() => { if (KEEPING.get(sha) === mine) KEEPING.delete(sha); });
  KEEPING.set(sha, mine);
  return mine;
}
/* R10 (C5): the refusal when a multipart capture cannot be kept whole; nothing is filed and the parts already stored are named by no
   document, as TOO_LARGE's are. */
const notKept = (parts, why) => { const row = CAPTURE_KEEP_CHECKS.CAPTURE_NOT_KEPT; return { ok: false, reason: "CAPTURE_NOT_KEPT", code: "CAPTURE_NOT_KEPT",
  check: row.check, translation: row.translation,
  detail: localize("acquisition.index.capture_not_kept", "the document arrived in {parts} parts, but your team's Civicsmith could not keep it whole under its own fingerprint ({why}), so nothing was filed; capture it again", { parts: String(parts), why: String(why) }) }; };

/* R20, R5 (T51; the walk's C12, C13): the longest `acquire` waits, inside the door's bound, for the render (3.3 to 17.5 s), which
   comes after the bytes are kept. Past its wait it goes on by itself and the document is answered kept, the render pending,
   to be finished by the member's `continue` (R12's "Finish it"). A caller may hand its own wait as `opts.renderWaitMs`. The
   capture-request arm, which runs under no door's bound, waits for it. CHOSEN, not measured: together with the fetch and the
   read it fits the door's 25 s with room; recorded by BOB. The co-attestation (timestamp and co-archive; measured 9.6 to
   21.5 s a page) is waited for no set time (R20, fix round 3, C12): see `acquireRun`. */
export const RENDER_WAIT_MS = 10000;
/* R5 (fix round 7, G79): THE RENDER WAITS WHAT IS LEFT OF THE BAR, not a fixed 10 s on top of a fetch that has used some of it. A member's capture
   is to be answered inside `ACQUIRE_BAR_MS` (15 s, the walk's bar) less `PROMOTE_RESERVE_MS`, the room the caller's promotion of the document needs after
   the answer (1.3 to 3.4 s in the walk: dena, acadia). CHOSEN, not measured here; recorded by BOB. A render that is not back by then is the page filed as
   served and the render pending, which the member finishes (R12) or the alarm does (R100). A caller may hand its own as `opts.acquireBarMs` and
   `opts.promoteReserveMs`. */
export const ACQUIRE_BAR_MS = 15000;
export const PROMOTE_RESERVE_MS = 3500;
/* R5, R112 (fix round 8, G107): THE RENDER'S KEEP IS PART OF ITS SHARE OF THE BAR. After the renderer returns, the bodies its page loaded are kept in the evidence store
   (a trip each for `head` and `put`, eight at a time) before the receipt and the profile can follow; the keep is awaited only as long as the bar leaves less the room
   those stages need, `KEEP_FOLLOWING_MS` (a profile reads the page back, a receipt is written: a trip or two). Bodies the keep has not reached in it leave the render
   pending (R5), the keep going on from the record. A caller may hand its own as `opts.postKeepMs`. CHOSEN, not measured (the live copy's trip is ~0.27 s); recorded by BOB. */
export const KEEP_FOLLOWING_MS = 1000;
/* R118 (G137c): a `transient` render failure is tried up to this many times, waiting these milliseconds before the second and the third. CHOSEN, not measured; recorded by BOB. */
export const RENDER_TRIES = 3;
export const RENDER_BACKOFF_MS = Object.freeze([1000, 3000]);
/** R112: the milliseconds the keep of the bodies a render loaded is awaited, `elapsedMs` into the call: what the bar leaves for the render (`renderWaitFor`) less the room the
 *  stages after the keep need, `followingMs` else `KEEP_FOLLOWING_MS` at most a quarter of the share (so a smaller bar is a proportionally smaller room); 0 with nothing left,
 *  never negative. Pure; never throws. */
export function keepWaitFor(elapsedMs, { barMs = ACQUIRE_BAR_MS, reserveMs = PROMOTE_RESERVE_MS, followingMs = undefined } = {}) {
  const bar = Number.isFinite(barMs) ? barMs : ACQUIRE_BAR_MS, room = Number.isFinite(reserveMs) ? reserveMs : PROMOTE_RESERVE_MS;
  const following = Number.isFinite(followingMs) ? followingMs : Math.min(KEEP_FOLLOWING_MS, Math.floor(Math.max(0, bar - room) / 4));
  return Math.max(0, renderWaitFor(elapsedMs, { barMs: bar, reserveMs: room }) - following);
}
/** R5 (G79): the milliseconds the render is waited, `elapsedMs` into the call: `RENDER_WAIT_MS` at most, less what the bar leaves after the room for
 *  promotion; 0 with nothing left, never negative; an elapsed time that is not a number leaves the full wait. Pure; never throws. */
export function renderWaitFor(elapsedMs, { barMs = ACQUIRE_BAR_MS, reserveMs = PROMOTE_RESERVE_MS } = {}) {
  if (!Number.isFinite(elapsedMs)) return RENDER_WAIT_MS;
  const bar = Number.isFinite(barMs) ? barMs : ACQUIRE_BAR_MS, room = Number.isFinite(reserveMs) ? reserveMs : PROMOTE_RESERVE_MS;
  return Math.max(0, Math.min(RENDER_WAIT_MS, Math.floor(bar - room - elapsedMs)));
}
/** R118: the size of the page a render answered against the render-DOM bound (`READ_BOUNDS`, `render.dom_bytes`), as capture-sources' `renderBlock`
 *  takes it; null (no judgement) when the page is not text or the row is not in the table. Never throws. */
function domBoundOf(a) {
  try {
    if (!a || typeof a.html !== "string") return null;
    return { size: new TextEncoder().encode(a.html).length, bound: boundOf("render", "dom_bytes") };
  } catch { return null; }
}
const LATE = Symbol("late");
/** `{done: true, value}` when `p` settled within `ms`, else `{done: false}`; no wait at all for a non-finite `ms`. */
async function within(p, ms) {
  if (!Number.isFinite(ms)) return { done: true, value: await p };
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(LATE), Math.max(0, ms)); });
  try { const v = await Promise.race([p, late]); return v === LATE ? { done: false } : { done: true, value: v }; }
  finally { clearTimeout(timer); }
}
/* R5 (C13): the renders still running, by the capture session that will finish them. A render the object lost (restarted)
   has no entry, and is rendered again when the member finishes the capture. */
const PENDING_RENDERS = new Map();
const PENDING_RENDER_TTL_MS = 3600000;

/** R31: whether `address` is in a sweep's scope, as link-sweep R1 defines it: its normalised form equals a prefix, or
 *  continues one at a `/`. */
function inSweepScope(address, scope) {
  if (typeof address !== "string" || !Array.isArray(scope)) return false;
  const a = normalizeAddress(address);
  return scope.some((p) => {
    if (typeof p !== "string" || !p) return false;
    const n = normalizeAddress(p);
    return a === n || (a.startsWith(n) && (n.endsWith("/") || a[n.length] === "/"));
  });
}

/** R3's fence, in ONE place so the lookup and the capture cannot disagree about when the fallback may fire. */
async function archiveEligibility(cap, address) {
  const reach = cap.sourceReachability({ addressNorm: normalizeAddress(address) });
  if (!reach.fallback_eligible)
    return { ok: false, status: 409, payload: { ok: false, reason: "NOT_ELIGIBLE",
      detail: localize("acquisition.index.archive_org_is_a_backup", "archive.org is a backup source and this document has not been unreachable long enough to justify one"),
      reachability: reach } };
  /* THEIR figure, ours to obey conservatively (ARCHIVE-FALLBACK.md): set on first contact, a third-party number,
     never presented as measured (K72 (12)). */
  try { await cap.governor?.governorConfig({ host: "web.archive.org", appetite_per_min: 24 }); }
  catch { /* the default appetite already governs */ }
  return { ok: true, reach };
}

/* R32 (N492, K1032): the archive is a Memento descriptor (capture-sources R37), so any compliant archive can serve the
   lookup; the Internet Archive is the one this instance asks. */
const ARCHIVE = WAYBACK_MEMENTO;
/* How many of a TimeMap's mementos are fetched, newest first, before the lookup gives up, and how many redirects one
   memento fetch follows (a raw memento at an inexact instant redirects to the exact one). Each fetch is one request
   at the archive's 24 a minute. Chosen, not measured. */
const MEMENTO_TRIES = 4;
const MEMENTO_HOPS = 5;

/** R35: the instant a caller asks the archive about. Absent, the lookup asks for now, as before (`{ok, at: null}`); an
 *  instant (record-grammar's `ISO_TS_RE`, to the second, a real moment) is `{ok, at, ms, timestamp}`; anything else is
 *  `MEMENTO_BAD_ASKED_DATE`, refused before anything is fetched. */
function askedInstant(at) {
  if (at === undefined || at === null) return { ok: true, at: null, ms: null };
  const ms = typeof at === "string" && ISO_TS_RE.test(at) ? Date.parse(at) : NaN;
  if (!Number.isFinite(ms) || new Date(ms).toISOString().replace(/\.\d+Z$/, "Z") !== at)
    return { ok: false, status: 400, payload: { ok: false, reason: "MEMENTO_BAD_ASKED_DATE", at: typeof at === "string" ? at.slice(0, 40) : null,
      detail: "`at` names the moment asked about as an instant to the second, YYYY-MM-DDTHH:MM:SSZ; nothing was fetched" } };
  return { ok: true, at, ms, timestamp: at.replace(/[-:TZ]/g, "") };
}

/** R35: what a lookup for a past instant states beside the memento it chose, so a memento from another moment is never
 *  presented as the page at `at`: the instant asked for, the memento's own datetime, and how far apart they are. */
function askedReading(asked, chosen) {
  if (!asked || !asked.at) return null;
  const apart = Math.round(Math.abs(Date.parse(chosen.archived_at) - asked.ms) / 1000);
  return { asked_at: asked.at, memento_datetime: chosen.archived_at, apart_seconds: apart,
           asked_note: apart === 0 ? word("acquisition.asked_note.memento_instant_asked", { archived_at: chosen.archived_at })
             : word("acquisition.asked_note.memento_seconds_instant", { archived_at: chosen.archived_at, apart,
                 after: Date.parse(chosen.archived_at) < asked.ms ? "before" : "after", at: asked.at }) };
}

/* A body not read is released, never awaited: a cancellation the source does not acknowledge must not hold the act. */
const cancelBody = (res) => { try { res?.body?.cancel?.()?.catch?.(() => {}); } catch { /* the source may already be gone */ } };
const hostOf = (u) => { try { return new URL(u).host; } catch { return String(u); } };

/* The bytes of a response hashed as they arrive and kept nowhere (the lookup decides, it does not file):
   `{sha, bytes}`, `{oversize}` past `max`, or `{failed}` when the stream breaks (an answer, never a throw). */
async function hashBody(res, max = CAPTURE_MAX) {
  const h = createSha256();
  let bytes = 0;
  const reader = res && res.body && res.body.getReader ? res.body.getReader() : null;
  try {
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > max) { try { await reader.cancel(); } catch { /* gone */ } return { oversize: true, bytes }; }
      h.update(value);
    }
  } catch (e) { return { failed: String(e && e.message || e), bytes }; }
  return { sha: h.hex(), bytes };
}
/* A memento whose body broke off while it was read: the archive could not be read, not a memento of anything. */
const archiveBroke = (detail) => ({ ok: false, status: 502, payload: { ok: false, reason: "ARCHIVE_UNREACHABLE",
  detail: localize("acquisition.index.the_mementos_body_broke_off", "the memento's body broke off while it was read ({detail})", { detail: String(detail) }) } });

/* SHA-256 of no bytes: the digest an empty memento's row is made over (`mementoRow` reads its `bytes: 0` as the
   empty-body digest, R29's own refusal). */
const EMPTY_SHA256 = createSha256().hex();

/** R32: whether the first bytes of a memento's body have arrived, read WITHOUT consuming them, so the capture streams,
 *  hashes and stores the very bytes the choice is made over. `{empty: true}` when the body ends with no byte (it is
 *  released); otherwise `{res}`, a response that yields the bytes read ahead and then the rest; `{failed}` when the
 *  stream breaks. A body that is not a stream is handed on as it came, for the capture to name. */
async function peekBody(res) {
  const reader = res && res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) return { res };
  const ahead = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { empty: true };
      if (value && value.length) { ahead.push(value); return { res: replayed(res, ahead, reader) }; }
    }
  } catch (e) { return { failed: String(e && e.message || e) }; }
}
function replayed(res, ahead, reader) {
  const read = async () => (ahead.length ? { done: false, value: ahead.shift() } : reader.read());
  const cancel = async (why) => { ahead.length = 0; try { await reader.cancel(why); } catch { /* the source may already be gone */ } };
  return { status: res.status, ok: res.ok, url: res.url, headers: res.headers, body: { getReader: () => ({ read, cancel }), cancel } };
}

/** R3, R32, R35: find a memento of `address` the way RFC 7089 offers one, every request through the host governor. The
 *  TimeGate is asked first, with `Accept-Datetime` at the instant asked about, `asked.ms` (R35), else now (the fallback
 *  fires because the document cannot be reached NOW, so the newest memento is the answer to the question asked); when
 *  it gives no usable memento, the TimeMap is read and its candidates are fetched nearest the instant asked about
 *  first, else newest first. Each memento is fetched in its raw form (the descriptor's `raw`, else
 *  as given), redirects being answers, never followed silently. A memento that is not a 200 is hashed and kept as a
 *  row `selectCapture` refuses by its own words. A 200 is handed to the caller's `take({res, answer, locator})`,
 *  which reads as much of its body as the choice needs: `{row}` when `selectCapture` refuses the memento over the
 *  bytes received (an empty body, N510), and the lookup goes on to the next candidate as for any refused row; `{fail}`
 *  to end the lookup with that answer; anything else is the memento taken, answered with its answer and the rows
 *  refused before it, so the caller hashes (and, capturing, stores) the very bytes the choice is made over
 *  (`chooseMemento`). Every refusal is an answer `{ok: false, status, payload}`. */
async function mementoLookup(cap, address, { indexPurpose = "archive-lookup", fetchPurpose = "archive-lookup", asked = null, take } = {}) {
  const ends = mementoEndpoints(ARCHIVE, address);
  if (!ends) return { ok: false, status: 400, payload: { ok: false, reason: "BAD_ADDRESS", detail: localize("acquisition.index.the_archive_has_no_endpoint", "the archive has no endpoint for this address") } };
  const considered = [], rows = [], tried = new Set();
  const call = async (url, purpose, headers = null) => {
    let g;
    try { g = await governedFetch(cap, url, purpose, null, { headers, manual: true }); }
    catch (e) { return { fail: { ok: false, status: 502, payload: { ok: false, reason: "ARCHIVE_UNREACHABLE", detail: String(e && e.message || e) } } }; }
    if (g.refusedByGovernor)
      return { fail: { ok: false, status: 429, payload: { ok: false, reason: "HOST_COOLING_OFF",
        detail: localize("acquisition.index.the_governor_is_holding_requests", "the governor is holding requests to {hostOf} ({reason})", { hostOf: String(hostOf(url)), reason: String(g.reason) }), retry_in_ms: g.retry_in_ms || 0 } } };
    return { res: g.res };
  };
  const archiveRefused = (res, what) => ({ ok: false, status: 502, payload: { ok: false, reason: "ARCHIVE_REFUSED", status: res.status,
    detail: res.status === 429 ? localize("acquisition.index.the_archive_is_rate_limiting", "the archive is rate-limiting us; the governor will hold this host")
                               : localize("acquisition.index.the_archives_what_answered_status", "the archive's {what} answered {status}", { what: String(what), status: String(res.status) }), considered } });
  /* One memento, raw, its redirects followed by hand within the archive's public addresses. */
  const tryMemento = async (uri) => {
    let url = typeof ARCHIVE.raw === "function" ? ARCHIVE.raw(uri) : uri;
    if (tried.has(url)) return { next: true };
    tried.add(url);
    for (let hop = 0; ; hop++) {
      if (!isPublicHttpsLocator(url)) { considered.push({ uri: url, refused: word("acquisition.refused.public_https_address"), reason: "BAD_LOCATOR" }); return { next: true }; }
      const c = await call(url, fetchPurpose);
      if (c.fail) return c;
      const res = c.res;
      const ans = readMementoAnswer({ url, status: res.status, headers: res.headers });
      /* The archive itself refusing (no Memento-Datetime), as against a memento OF a refusal, which is a row. */
      if (!ans.ok && (res.status === 429 || res.status >= 500)) { cancelBody(res); return { fail: archiveRefused(res, "memento") }; }
      if (ans.ok && ans.kind === "redirect" && hop < MEMENTO_HOPS) { cancelBody(res); url = ans.location; continue; }
      if (!ans.ok || ans.kind !== "memento") {
        cancelBody(res);
        considered.push({ uri: url, reason: ans.ok ? "MEMENTO_NOT_NEGOTIATED" : ans.reason,
                          refused: ans.ok ? word("acquisition.refused.archive_redirecting_hops", { memento_hops: MEMENTO_HOPS }) : ans.detail });
        return { next: true };
      }
      if (ans.status === 200) {
        const t = await take({ res, answer: ans, locator: url });
        if (t.fail) return { fail: t.fail };
        if (!t.row) return { ...t, ok: true, answer: ans, locator: url, rows, considered };
        /* N510: refused over the bytes received; an older candidate may still stand in for the document. */
        rows.push(t.row);
        return { next: true };
      }
      /* A memento of a redirect or an error: a true fact about that fetch, not a copy of the document (capture-sources
         R29), refused by selectCapture's own words over a row of the bytes received. */
      const h = await hashBody(res);
      if (h.failed) return { fail: archiveBroke(h.failed) };
      rows.push(mementoRow(ans, h.oversize ? { sha256: null } : { sha256: h.sha, bytes: h.bytes }) || { timestamp: ans.timestamp });
      return { next: true };
    }
  };
  /* The TimeGate. */
  const tg = await call(ends.timegate, indexPurpose, { "accept-datetime": acceptDatetime(asked && asked.at ? asked.ms : instantOf(cap)) });
  if (tg.fail) return tg.fail;
  if (tg.res.status === 429 || tg.res.status >= 500) { cancelBody(tg.res); return archiveRefused(tg.res, "TimeGate"); }
  const ga = readMementoAnswer({ url: ends.timegate, status: tg.res.status, headers: tg.res.headers });
  cancelBody(tg.res);
  if (ga.ok) {
    const m = await tryMemento(ga.kind === "redirect" ? ga.location : ga.memento_uri);
    if (!m.next) return m.fail || m;
  } else if (tg.res.status === 404) considered.push({ uri: ends.timegate, refused: word("acquisition.refused.timegate_holds_memento") });
  else considered.push({ uri: ends.timegate, reason: ga.reason, refused: ga.detail });
  /* The TimeMap. */
  const tm = await call(ends.timemap, indexPurpose);
  if (tm.fail) return tm.fail;
  /* A 404, or an empty TimeMap, is the archive saying it holds no memento of the address: nothing to try. */
  if (!tm.res.ok && tm.res.status !== 404) { cancelBody(tm.res); return archiveRefused(tm.res, "TimeMap"); }
  const mapText = tm.res.status === 404 ? (cancelBody(tm.res), "") : await tm.res.text();
  const map = mapText.trim() ? parseTimeMap(mapText) : { ok: true, mementos: [], refused: [] };
  if (!map.ok) return { ok: false, status: 502, payload: { ok: false, reason: map.reason, detail: map.detail, considered, address } };
  const cands = timeMapCandidates(map);
  considered.push(...cands.considered);
  /* R35: nearest the instant asked about first, the earlier of two equally near first; each still chosen by
     selectCapture over the bytes received. With no instant, the TimeMap's own order, newest first. */
  const near = (m) => Math.abs(Date.parse(m.archived_at) - asked.ms);
  const ordered = !cands.ok ? [] : asked && asked.at
    ? [...cands.candidates].sort((a, b) => near(a) - near(b) || (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
    : cands.candidates;
  for (const cand of ordered.slice(0, MEMENTO_TRIES)) {
    const m = await tryMemento(cand.uri);
    if (!m.next) return m.fail || m;
  }
  return nothingUsable(selectCapture(rows), considered, address);
}

/* No memento may stand in for the document. The first Memento refusal met is answered by name when no memento was
   even read as one; otherwise selectCapture's own refusal, with every memento it considered and why. */
function nothingUsable(sel, considered, address) {
  const named = sel.considered.length ? null : considered.find((c) => c.reason);
  return { ok: false, status: named ? 502 : 404, payload: { ok: false, reason: named ? named.reason : sel.reason,
    detail: named ? named.refused : sel.detail, considered: [...sel.considered, ...considered], address } };
}

/** R32: the choice over the bytes received. The memento's row is `mementoRow` over this call's digest of them, the
 *  choice `selectCapture`'s (R29–R31 as written, an empty body refused by its own reason), the hop `mementoHop`'s,
 *  every fact from what the archive answered and the bytes received, never from a caller (D-112). */
function chooseMemento(m, sha, bytes, address, asked = null) {
  const sel = selectCapture([mementoRow(m.answer, { sha256: sha, bytes }), ...m.rows]);
  if (!sel.ok) return nothingUsable(sel, m.considered, address);
  /* R35: the hop states the instant asked about beside the memento's own datetime */
  const reading = askedReading(asked, sel.chosen);
  return { ok: true, chosen: sel.chosen, rejected: [...sel.rejected, ...m.considered], usable_count: sel.usable_count, reading,
           hop: { ...mementoHop(sel.chosen, m.locator, { archive: ARCHIVE, answer: m.answer }), ...(reading || {}) } };
}

/** R3, R32, R35: `archiveLookup({address, at})` decides and reports what the archive arm would do, without capturing:
 *  the chosen memento's bytes are fetched and hashed, and kept nowhere. With `at`, the memento is sought for that
 *  instant and the answer states it beside the memento's own datetime. */
export async function archiveLookup(cap, { address, at } = {}) {
  if (typeof address !== "string" || !isPublicHttpsLocator(address))
    return { status: 400, body: { ok: false, reason: "BAD_ADDRESS", detail: localize("acquisition.index.the_document_address_must_be", "the document address must be https on a public host") } };
  const asked = askedInstant(at);
  if (!asked.ok) return { status: asked.status, body: asked.payload };
  const el = await archiveEligibility(cap, address);
  if (!el.ok) return { status: el.status, body: el.payload };
  /* Each 200 memento is hashed whole; one selectCapture refuses over its bytes (N510: an empty one) is passed over. */
  const m = await mementoLookup(cap, address, { asked, take: async ({ res, answer, locator }) => {
    const h = await hashBody(res);
    if (h.failed) return { fail: archiveBroke(h.failed) };
    if (h.oversize)
      return { fail: { ok: false, status: 413, payload: { ok: false, reason: "TOO_LARGE", bytes: h.bytes, maxBytes: CAPTURE_MAX, ...statement("archive", "uploaded_bytes", h.bytes),
        retrieval_locator: locator, detail: localize("acquisition.index.the_memento_exceeds_what_this", "the memento exceeds what this surface will capture even in parts") } } };
    const row = mementoRow(answer, { sha256: h.sha, bytes: h.bytes });
    return selectCapture([row]).ok ? { sha: h.sha, bytes: h.bytes } : { row };
  } });
  if (!m.ok) return { status: m.status, body: m.payload };
  const c = chooseMemento(m, m.sha, m.bytes, address, asked);
  if (!c.ok) return { status: c.status, body: c.payload };
  return { status: 200, body: {
    ok: true, address, eligible_because: el.reach.basis, chosen: c.chosen, ...(c.reading || {}),
    /* Every memento considered and why it was not used: "nothing suitable" alone is unauditable. */
    rejected: c.rejected, usable_count: c.usable_count, retrieval_locator: m.locator, provenance_hop: c.hop,
    capture_with: { op: "acquire", via: "archive.org", address, ...(asked.at ? { at: asked.at } : {}) },
    note: "this op decides and reports; op=acquire with via=archive.org decides AGAIN and captures, "
        + "because the hop that reaches the record must be built by the same call that fetched the memento" } };
}

/* R28: an outbound request that is not a plain GET of a document (the timestamp authorities' POSTs, the co-archive)
   still asks the host governor for admission and reports its outcome, under this instance's agent. */
export function governedCall(cap, purpose) {
  const g = cap.governor;
  return async (u, init = {}) => {
    let host = null;
    try { host = new URL(String(u)).host; } catch { host = null; }
    if (host && g) {
      let a = null;
      try { a = await g.governorAdmit({ host }); } catch { a = null; }
      if (a && a.admitted === false) throw new Error(`the per-host governor is holding requests to ${host} (${a.reason || "governed"})`);
      if (a && a.wait_ms > 0) await new Promise((r) => setTimeout(r, a.wait_ms));
    }
    const res = await fetch(u, { ...init, headers: { ...(init.headers || {}), "user-agent": userAgent(cap.env, purpose) } });
    if (host && g) { try { await g.governorReport({ host, status: res.status, retry_after_ms: retryAfterMs(res.headers.get("retry-after")) }); } catch { /* not a failed call */ } }
    return res;
  };
}

/** R20 (K60, K72 (10); K1888): co-attestation at every capture, through `attestation`'s `attest` (its R1–R3): a trusted
 *  timestamp over the capture digest and, wherever the source permits and R43 asks it (`coArchive.on`), a co-archive of
 *  the locator at capture time. Every attempt and its outcome is recorded; a failure is an attempt, never a failed
 *  capture. The archive arm's locator is itself an archive replay, so no co-archive is asked of it. A co-archive R43
 *  does not ask for is recorded as not asked, with who decided (`group` or `member`), never as a failed attempt.
 *  `holds` asks `provenance`'s register (its R5) through the store handed in. */
async function coAttest(cap, { sha, locator, via, ev, coArchive = { on: true, by: "group" } }) {
  const p = cap.provenance;
  /* The register's shape (C-18.1): each attempt `{service, attempted, ok}`, `attempted` whether the service was
     asked, `ok` whether it answered; attestation's instant and words are kept beside them. */
  const recorded = (a) => ({ ...a, service: String(a.service || a.kind || "attest"), attempted: true, ok: a.ok === true,
                             ...(typeof a.attempted === "string" ? { at: a.attempted } : {}) });
  const notAsked = (why) => [{ service: "attest", attempted: false, ok: false, at: stampSecond(instantOf(cap)), note: why }];
  /* R20, R43: the C-18.1 shape (`service`, `attempted`, `ok`) with `attempted: false`, so it reads as no attempt */
  const coNotAsked = via !== "archive.org" && !coArchive.on
    ? [{ service: "co_archive", kind: "co_archive", attempted: false, ok: false, asked: false, by: coArchive.by,
         note: coArchive.by === "member" ? word("acquisition.note.capturing_member_chose")
                                         : word("acquisition.note.group_setting_asks") }] : [];
  try {
    const out = await attest({ sha256: sha, archive: via !== "archive.org" && coArchive.on, locator },
      { head: (s) => ev.head(s), put: (s, b) => ev.put(s, b), fetch: governedCall(cap, "attest"),
        holds: async (s) => (p && typeof p.registerHolds === "function" ? p.registerHolds({ sha: s }) : null) });
    const attempts = Array.isArray(out && out.attempts) ? out.attempts.filter((a) => a && typeof a === "object") : [];
    return [...(attempts.length ? attempts.map(recorded)
      : notAsked(String((out && (out.reason || out.note || out.detail)) || word("acquisition.string.attempt_reported")))), ...coNotAsked];
  } catch (e) {
    return [...notAsked(String(e && e.message || e).slice(0, 200)), ...coNotAsked];
  }
}

/** R29, C-68.1 (D-278, K794, K850): THE CAPABILITY COMPLAINT, minted at this one region for every raiser: `acquire` on a
 *  copy installed with no evidence storage bound, and control-plane's door (`storageAbsent`), which hands it to the arms
 *  it routes `capture`, `pdfstructure`, `acquire` and `attest` to. Answers `{status: 503, body}`; `op` and `error` are
 *  the caller's, passed in byte-identical from each site. Each caller's body is the one it has always answered: the
 *  door's carries `code` (`{ok, reason, code, check, translation, error, op}`), and `acquire`'s, asked with
 *  `{code: false}`, does not (`{ok, reason, check, translation, op, error}`). The row is read from `INSTALLATION_CHECKS`,
 *  never copied. Pure; never throws. */
export function evidenceStorageAbsent(op, error, { code = true } = {}) {
  const row = INSTALLATION_CHECKS.EVIDENCE_STORAGE_NOT_CONFIGURED;
  /* DEC-49 REGION is-storage-absent */
  return { status: 503, body: code
    ? { ok: false, reason: "EVIDENCE_STORAGE_NOT_CONFIGURED", code: "EVIDENCE_STORAGE_NOT_CONFIGURED", check: row.check,
        translation: row.translation, error, op }
    : { ok: false, reason: "EVIDENCE_STORAGE_NOT_CONFIGURED", check: row.check, translation: row.translation, op, error } };
  /* END DEC-49 REGION is-storage-absent */
}

/* R42 (F16, K1881): the group's own hosts this act refuses, handed in by its caller (`opts.ownHosts`, else the store's
   `ownHosts`), capture-sources' one rule (its R65) deciding each. With none given, nothing is refused on this ground. */
const ownHostsOf = (cap, given) => (Array.isArray(given) ? given : cap && Array.isArray(cap.ownHosts) ? cap.ownHosts : null);
export { personChecksFor };
const hostnameOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };
const onOwnHost = (u, ownHosts) => !!ownHosts && isOwnHost(hostnameOf(u), ownHosts);
/* R42, C-139.18: the refusal, naming the host; nothing was fetched or filed. */
function ownHostRefused(locator, extra = {}) {
  const row = ARCHIVE_CHECKS.OWN_HOST_REFUSED;
  return { ok: false, reason: "OWN_HOST_REFUSED", code: "OWN_HOST_REFUSED", check: row.check, translation: row.translation,
           host: hostnameOf(locator), locator, ...extra,
           detail: localize("acquisition.index.hostnameof_is_one_of_your", "{hostnameOf} is one of your team's own hosts; nothing was fetched or filed", { hostnameOf: String(hostnameOf(locator)) }) };
}

/** R1–R23, R31, R32, R35, R40, R42–R44. The one act that fetches and files. `opts`: `cls` (the control plane's caller class), `member`
 *  (whether the caller is a member session), `sessMember` (that member), `storeName`, `ownHosts` (R42), `reputation` (a spec, null or a reader) and
 *  `fileScanner` (R44), and — only from the in-process drain, never from a request — `captureRequest` (the draining
 *  row's address, purpose, agent, render flag and the member's co-archive choice, K58). Answers `{status, body}`. */
export async function acquire(cap, body0, opts = {}) {
  const t = openTimings(opts && opts.timings);
  let out;
  try { out = await acquireRun(cap, body0, opts || {}, t); }
  catch (e) {
    /* R95 (fix round 4, C5a): a throw is an answer too, with the times the stages had when it was thrown: the stage it cut is `running`. */
    /* R95 (fix round 9, G177): the cut and the close are ONE clock reading, so the answer's stages are the object's, exactly */
    const at = clockNow();
    const cut = stageTimes(t, at);
    stageEnd(t, at); t.end = at;
    return { status: 500, body: { ok: false, reason: "ACQUIRE_FAILED", op: "acquire", timings: cut,
      detail: localize("acquisition.index.acquire_failed", "the capture stopped on an error ({detail}); nothing is known to have been filed", { detail: String(e && e.message || e).slice(0, 200) }) } };
  }
  finally { const at = clockNow(); stageEnd(t, at); t.end = t.end ?? at; }
  /* R95: on every outcome, a refusal included, the answer carries the times of the stages that ran. */
  return out && out.body && typeof out.body === "object" && !Array.isArray(out.body)
    ? { ...out, body: { ...out.body, timings: stageTimes(t) } } : out;
}
async function acquireRun(cap, body0, opts0, t) {
  const opts = { ...opts0, jobNotes: [] };
  const { cls = null, member = false, sessMember = null, storeName = "bio", captureRequest = null, ownHosts = null,
          reputation: reputationTool = undefined, fileScanner = null, renderWaitMs = undefined,
          renderResume = null, heldSha: givenHeldSha = null, acquireBarMs = undefined, promoteReserveMs = undefined } = opts || {};
  const body = body0 && typeof body0 === "object" ? { ...body0 } : {};
  const answer = (status, b) => ({ status, body: b });
  const op = "acquire";
  const own = ownHostsOf(cap, ownHosts);
  const ev = cap.core && typeof cap.core.evidenceStore === "function" ? cap.core.evidenceStore() : null;
  /* C-68.1 (K794, K850): raised through this module's one raiser, its body as it has always been (no `code`). */
  if (!ev) return evidenceStorageAbsent(op, word("capture.response.group_civicsmith_evidence"), { code: false });
  /* R1, K58: THE CAPTURE-REQUEST ARM IS IN PROCESS ONLY. From outside, `via: "capture-request"` is refused
     C-28.13 whatever the caller: the AI does not capture, it REQUESTS, and the daemon captures. */
  if (!captureRequest && body.via === "capture-request") {
    /* DEC-49 REGION is-capture-request-arm */
    const row = CAPTURE_REQUEST_ARM_CHECKS.CAPTURE_NOT_DRAINING;
    return answer(403, { ok: false, reason: "CAPTURE_NOT_DRAINING", code: "CAPTURE_NOT_DRAINING",
      check: row.check, translation: row.translation, cls, request: body.request ?? null, op,
      detail: localize("acquisition.index.your_teams_civicsmith_fetches_a", "your team's Civicsmith fetches a requested document only from inside its own drain, and a request cannot reach that arm from outside. The AI does not capture: it REQUESTS, and the daemon captures with provenance preserved (DEC-47's structural gate, DEC-60). Write a request and let the drain make it.") });
    /* END DEC-49 REGION is-capture-request-arm */
  }
  /* R1, REC-33: the daemon class reaches acquire through the archive fallback and the capture-request drain. Direct
     acquisition is a member's or an operator's act. */
  if (cls === "daemon" && body.via !== "archive.org" && !captureRequest)
    return answer(403, { ok: false, reason: "NOT_PERMITTED", op, cls,
      detail: localize("acquisition.index.the_daemon_class_reaches_op", "the daemon class reaches op=acquire through the archive fallback (via: \"archive.org\") and through the capture-request drain (via: \"capture-request\"). Direct acquisition is a member's or an operator's act, and the unattended credential is scoped to the verbs the unattended paths need.") });
  /* R47 (N1117; T50): `for`, read only from a member session (as R43's `coArchive` is), names the question the member is
     capturing for. Absent or null records nothing; anything but a non-blank string of at most 200 characters is refused
     before any fetch, nothing written or filed. From any other caller the key is ignored, so the answer is the one
     without it. */
  const askingMember = member && typeof sessMember === "string" && sessMember ? sessMember : null;
  let askedFor = null;
  if (askingMember && body.for !== undefined && body.for !== null) {
    /* DEC-49 REGION is-for */
    if (typeof body.for !== "string" || !body.for.trim() || body.for.length > FOR_MAX) {
      const row = ARCHIVE_CHECKS.BAD_FOR;
      return answer(400, { ok: false, reason: "BAD_FOR", code: "BAD_FOR", check: row.check, translation: row.translation, op,
        detail: "`for` names the question this capture is for by its id: a string of 1 to 200 characters; nothing was fetched or filed" });
    }
    /* END DEC-49 REGION is-for */
    askedFor = body.for;
  }
  /* R3, R32, D-112: the archive arm names the DOCUMENT and lets the plane find the memento, inside the same call that
     files the bytes, so the eligibility fence cannot be walked around and the hop is built from what the archive
     answered this call. A monitoring path: admin, probe and daemon only. */
  let archiveHopRecorded = null, archiveAddress = null, archiveAsked = null, archiveAt = null;
  if (body.via === "archive.org") {
    if (cls !== "admin" && cls !== "probe" && cls !== "daemon")
      return answer(403, { ok: false, reason: "NOT_PERMITTED", op, via: "archive.org",
        detail: localize("acquisition.index.the_archive_fallback_is_a", "the archive fallback is a monitoring path: it runs under an operator or daemon credential, never a member's. Capture the document directly, or ask an administrator to run the fallback.") });
    const addr = body.address;
    if (typeof addr !== "string" || !isPublicHttpsLocator(addr))
      return answer(400, { ok: false, reason: "BAD_ADDRESS",
        detail: localize("acquisition.index.an_archive_sourced_capture_names", "an archive-sourced capture names the document address, not a replay locator") });
    /* R35: the instant asked about, refused before anything is fetched when it is not one */
    archiveAt = askedInstant(body.at);
    if (!archiveAt.ok) return answer(archiveAt.status, archiveAt.payload);
    const el = await archiveEligibility(cap, addr);
    if (!el.ok) return answer(el.status, el.payload);
    archiveAsked = addr;
    /* R2: the retrieval locator is the memento this call finds, never a caller's. */
    delete body.locator;
  }
  /* K58: EVERYTHING THAT DECIDES WHAT LEAVES THIS INSTANCE COMES FROM THE ROW the drain's conduct check judged: the
     address, the purpose, the agent, and whether to render. */
  let crPurpose = null, crAgent = null, crOrigin = null, crHeldSha = null, crCredential = null, sweepScope = null;
  if (captureRequest) {
    body.locator = captureRequest.locator;
    crPurpose = captureRequest.purpose || null;
    crAgent = captureRequest.agent || null;
    if (captureRequest.render === true) body.render = true; else delete body.render;
    /* R21 (capture-requests R38): the sweep the drain's row names, never a body's `matchedSweep`. */
    const o = captureRequest.origin;
    if (o && typeof o === "object" && o.matched_sweep != null && o.matched_sweep !== "")
      crOrigin = { kind: "sweep", matched_sweep: o.matched_sweep, deeming_actor: o.deeming_actor ?? null };
    /* R31 (K1126): a SWEEP origin is one the in-process caller declares `kind: "sweep"` (link-sweep R5's shape), and
       it carries its scope on this arm, never a body; the drain's R38 origin (no `kind`) is not one. Refused before
       anything is fetched. */
    if (crOrigin && o.kind === "sweep") {
      const sc = captureRequest.scope;
      /* DEC-49 REGION is-sweep-scope */
      if (!Array.isArray(sc) || !sc.length || !sc.every((p) => typeof p === "string" && p !== "")) {
        const row = SWEEP_SCOPE_CHECKS.SWEEP_SCOPE_MISSING;
        return answer(400, { ok: false, reason: "SWEEP_SCOPE_MISSING", code: "SWEEP_SCOPE_MISSING", check: row.check,
          translation: row.translation, op, matched_sweep: crOrigin.matched_sweep,
          detail: localize("acquisition.index.a_sweep_origin_acquire_names", "a sweep-origin acquire names the in-scope prefixes it may reach (link-sweep R1's `sources`); this one named none, so nothing was fetched") });
      }
      /* END DEC-49 REGION is-sweep-scope */
      sweepScope = sc;
    }
    /* R22 (capture-requests R39): the capture the record holds of this address; anything but 64 hex is ignored. */
    if (typeof captureRequest.heldSha === "string" && /^[0-9a-f]{64}$/.test(captureRequest.heldSha)) crHeldSha = captureRequest.heldSha;
    /* R23 (capture-requests R41): the one credential admitted for this request's scope (capture-sources R56). */
    const cr = captureRequest.credential;
    if (cr && typeof cr === "object" && CREDENTIAL_KINDS.includes(cr.kind) && typeof cr.secret === "string" && cr.secret !== "")
      crCredential = cr;
  }
  /* R22 (fix round 6, G32): the held capture's digest, handed in by an in-process caller (never read from a body), makes a member's fetch of
     an address the record already holds conditional too: the source that says nothing changed is not read. Anything but 64 hex is ignored. */
  if (!crHeldSha && typeof givenHeldSha === "string" && /^[0-9a-f]{64}$/.test(givenHeldSha)) crHeldSha = givenHeldSha;
  /* R4, CAP-8 — THE GOOGLE DRIVE HOST STACK (Bob, 2026-09-14: keep the link, export an OpenDocument version). The
     recognition, the composition and the fetch all happen inside the ONE call that files the bytes. */
  let driveCapture = null, driveHopRecorded = null;
  /* DEC-49 REGION is-drive-capture */
  {
    /* D-112 FIRST, before the address is even looked at: a caller inventing an export format for a document on any
       host is performing the same act. */
    const supplied = callerSuppliedHopFacts(body);
    if (supplied.length)
      return answer(400, { ok: false, reason: "DRIVE_HOP_FACT_SUPPLIED", ...driveRow("DRIVE_HOP_FACT_SUPPLIED"), op, supplied,
        detail: localize("acquisition.index.this_request_carried_map_the", "this request carried {map}. The export address, the export format and the producer are DERIVED by your team's Civicsmith from the file id and the kind in the address, at the moment it performs the fetch, and are never read from a request. A provenance hop a caller can hand us is a provenance hop a caller can invent (D-112), and the whole value of a disclosed chain is that the disclosure is ours. Send the Drive link alone.", { map: String(supplied.map((k) => `\`${k}\``).join(", ")) }) });
    const drive = readDriveAddress(body.locator);
    if (drive) {
      /* NAMED, NEVER SILENTLY SKIPPED: a silent fall-through would file the application shell as the document. */
      if (drive.shape === "folder")
        return answer(422, { ok: false, reason: "DRIVE_FOLDER_NOT_A_DOCUMENT", ...driveRow("DRIVE_FOLDER_NOT_A_DOCUMENT"), op,
          drive: { host: drive.host, shape: drive.shape, harvestable: false }, locator: drive.address, detail: drive.why });
      if (drive.shape === "file")
        return answer(422, { ok: false, reason: "DRIVE_KIND_UNDETERMINED", ...driveRow("DRIVE_KIND_UNDETERMINED"), op,
          drive: { host: drive.host, shape: drive.shape, harvestable: false, ...(drive.fileId ? { file_id: drive.fileId } : {}) },
          locator: drive.address, detail: drive.why });
      if (drive.shape === "unknown")
        return answer(422, { ok: false, reason: "DRIVE_SHAPE_UNRECOGNISED", ...driveRow("DRIVE_SHAPE_UNRECOGNISED"), op,
          drive: { host: drive.host, shape: drive.shape, harvestable: false }, locator: drive.address, detail: drive.why });
      /* `published` is recognised IN ORDER TO BE LEFT ALONE: publish-to-web already serves an honest document. */
      if (drive.harvestable) { driveCapture = drive; body.locator = drive.exportAddress; }
    }
  }
  /* END DEC-49 REGION is-drive-capture */

  /* R12: A CONTINUATION RESUMES THE SESSION'S OWN PRIMARY and never fetches it again. A session that cannot be read
     is named and the capture proceeds as an ordinary one. */
  let session = null, sessionSkip = null;
  if (body.continue && !body.render) {
    const ld = cap.loadCaptureSession({ session: String(body.continue) });
    if (ld && ld.found) session = ld;
    else sessionSkip = { reason: "NO_SUCH_SESSION", detail: ld && ld.note };
  }

  /* one code per condition (K231; fix round 5): a continuation naming a session that is gone (finished, closed, expired) with no address of its
     own to capture instead is NO_SUCH_SESSION, never BAD_LOCATOR. */
  if (sessionSkip && (typeof body.locator !== "string" || !body.locator))
    return answer(404, { ok: false, reason: "NO_SUCH_SESSION", op, session: String(body.continue).slice(0, 80),
      detail: localize("acquisition.index.no_such_session", "no capture session of that name is held: it was finished, closed or has expired; nothing was fetched") });
  let locator = session ? session.locator : body.locator;
  if (!(archiveAsked && !session) && (typeof locator !== "string" || !isPublicHttpsLocator(locator)))
    return answer(400, { ok: false, reason: "BAD_LOCATOR",
      detail: localize("acquisition.index.a_locator_must_be_https", "a locator must be https on a public host: no bare IP address, no localhost, no credentials in the address") });
  /* DEC-49 REGION is-own-host
     R42 (F16): no fetch goes to one of the group's own hosts, the render arm's included; refused before any request. */
  if (!archiveAsked && !session && onOwnHost(locator, own)) return answer(403, { ...ownHostRefused(locator), op });
  /* END DEC-49 REGION is-own-host */
  /* R105: a capture parked as an owed fetch has nothing for a member to finish: the answer is the state it is in. */
  if (session && session.state && session.state.fetch_pending)
    return answer(200, { ok: true, fetch_pending: { session: session.session, ...session.state.fetch_pending }, store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE });
  /* R104: a visitor copy already finished and owed to the record: a second "Finish it" has nothing left to do and touches nothing, so the
     session stays until `owedRun` has seen the copy filed or delivered it. */
  if (session && session.state && session.state.render_done)
    return answer(200, { ok: true, existed: true,
      continued: { session: session.session, primary: { sha256: session.primarySha, file: session.primaryFile, locator: session.locator },
                   note: word("acquisition.note.continuation_files_new") },
      render: { state: "owed", session: session.session }, store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE });
  if (session && session.state && session.state.render_pending) return finishRender(cap, { session, opts, t, inRequest: true });
  if (session) return continueCapture(cap, { body, session, cls, storeName, ev, own, t, owe: oweOf(cap, opts) });

  /* R46 (K4853): a new press of an address whose parked fetch ended in a stated refusal replaces that session: its refusal is no longer listed */
  if (askingMember && typeof cap.liveCaptureSessions === "function") {
    try {
      for (const x of cap.liveCaptureSessions(instantOf(cap)) || [])
        if (x && x.locator === locator && x.state && x.state.fetch_pending && x.state.fetch_pending.failed && x.state.opened_by === askingMember)
          cap.dropCaptureSession({ session: x.session });
    } catch { /* a session that cannot be dropped stays listed until its day passes */ }
  }
  /* R15, D-97: authority is THREE-VALUED and undetermined is a task, not a blocker. */
  const authorityAsserted = typeof body.authority === "string" && body.authority.trim() ? body.authority.trim() : null;
  const retrieved = stampSecond(instantOf(cap));
  const pv = profileView(cap.core);

  /* R5, D-64 — THE RENDER ARM, ADMISSION. Every way a render cannot happen is decided HERE, before the shell is
     fetched, so the shell can never be filed as the content by falling through. `render: false` is the plain
     capture, as an absent key is. */
  const renderAsked = Object.prototype.hasOwnProperty.call(body, "render") && body.render !== false;
  let renderer = null, renderReserved = 0, renderSlot = null;
  /* DEC-49 REGION is-render-admit */
  if (renderAsked && renderResume) renderer = rendererFor(cap.env);   // R5 (C13): the render being finished was admitted, and paid for, when it began
  if (renderAsked && !renderResume) {
    if (body.render !== true)
      return answer(400, { ok: false, reason: "RENDER_FLAG_MALFORMED", ...renderRow("RENDER_FLAG_MALFORMED"),
        op, detail: localize("acquisition.index.render_stringify_is_not_a", "render={stringify} is not a value this op reads. Send render: true for the page as a visitor saw it, or false (or nothing) for the served bytes.", { stringify: String(JSON.stringify(body.render).slice(0, 40)) }) });
    const conflict = body.via === "archive.org" ? word("acquisition.text.via_archive_org")
                   : driveCapture ? word("acquisition.text.google_drive_export")
                   : body.continue ? `continue: <session> ${word("acquisition.text.capture_already_filed")}` : null;
    if (conflict)
      return answer(400, { ok: false, reason: "RENDER_ARM_CONFLICT", ...renderRow("RENDER_ARM_CONFLICT"),
        op, conflict, detail: localize("acquisition.index.render_true_cannot_be_combined", "render: true cannot be combined with {conflict}.", { conflict: String(conflict) }) });
    renderer = rendererFor(cap.env);
    if (typeof renderer.render !== "function")
      return answer(501, { ok: false, reason: "RENDER_NO_RENDERER", ...renderRow("RENDER_NO_RENDERER"),
        op, renderer: renderer.kind,
        detail: renderer.kind === "browser-binding-without-driver"
          ? localize("acquisition.index.browser_is_bound_to_something", "BROWSER is bound to something this plane cannot speak to: it is not a Fetcher, so there is no endpoint to open a devtools session on. Nothing was fetched.")
          : localize("acquisition.index.no_renderer_is_bound_to", "no renderer is bound to this instance (no RENDERER service binding and no BROWSER binding). Nothing was fetched.") });
    /* THROUGH THE HOST GOVERNOR: the render is a second load of the page. R97: this admission is only ASKED (host-governor R29's
       peek, which writes nothing); the fetch the visit then makes books the governor once, so one visit is one grant. */
    let rHost = null;
    try { rHost = new URL(locator).host; } catch { rHost = null; }
    if (rHost && cap.governor) {
      let g = null;
      try { g = await cap.governor.governorAdmit({ host: rHost, peek: true }); } catch { g = null; }
      if (g && g.admitted === false)
        return answer(429, { ok: false, reason: "RENDER_HOST_COOLING_OFF", ...renderRow("RENDER_HOST_COOLING_OFF"),
          op, host: rHost, retry_in_ms: g.retry_in_ms || 0,
          detail: localize("acquisition.index.the_per_host_governor_is", "the per-host governor is holding requests to {rHost} ({v1}).", { rHost: String(rHost), v1: String(g.reason || "governed") }) });
    }
    /* D-492: the admission RESERVES this render's maximum cost, read ONCE so the release names the same figure. */
    renderReserved = renderReserveMs(RENDER_DEFAULTS);
    let adm = null;
    try { adm = cap.renderAdmit({ allowanceMs: renderAllowanceMs(cap.env), reserveMs: renderReserved,
                                  cap: renderConcurrencyCap(cap.env), at: retrieved }); } catch { adm = null; }
    /* D-520: OVER THE CONCURRENCY CAP THE RENDER WAITS; nothing was reserved or counted. */
    if (adm && adm.state === "waiting")
      return answer(429, { ok: false, reason: "RENDER_AT_CAPACITY", ...renderRow("RENDER_AT_CAPACITY"),
        op, render: { state: "waiting", content: "undetermined", running: adm.running, cap: adm.cap },
        detail: localize("acquisition.index.running_renders_are_running_in", "{running} renders are running in your team's Civicsmith, which runs at most {cap} at once; this render is waiting and nothing was fetched.", { running: String(adm.running), cap: String(adm.cap) }) });
    if (adm && adm.state === "admitted") renderSlot = adm.slot || null;
    if (!adm || adm.state !== "admitted")
      return answer(429, { ok: false, reason: "RENDER_DEFERRED", ...renderRow("RENDER_DEFERRED"),
        op, render: { state: "deferred", content: "undetermined", allowance: adm || null },
        detail: adm ? localize("acquisition.index.todays_render_allowance_allowance_ms", "today's render allowance ({allowance_ms} ms, day {day}) is committed ({spent_ms} ms spent, {reserved_ms} ms reserved by renders in flight), and this render reserves {reserve_ms} ms; it is recorded as deferred ({deferred} today).", { allowance_ms: String(adm.allowance_ms), day: String(adm.day), spent_ms: String(adm.spent_ms), reserved_ms: String(adm.reserved_ms), reserve_ms: String(adm.reserve_ms), deferred: String(adm.deferred) })
                    : localize("acquisition.index.the_render_allowance_could_not", "the render allowance could not be read, so the render is deferred rather than run unmetered.") });
  }
  /* END DEC-49 REGION is-render-admit */

  /* R44: the document's public address asked of the scanner before any fetch of it, on every arm that fetches one (a
     continuation fetches none and has returned above): the archive arm's `address`, the Drive link as given, else the
     locator. */
  const reputation = await timed(t, "reputation", () => addressReputation(archiveAsked || (driveCapture ? driveCapture.address : locator),
    reputationToolOf(cap, reputationTool), fileScannerOf(cap, fileScanner), instantOf(cap)));

  /* R3, R32: the memento, found through the archive's TimeGate or TimeMap; its raw bytes are answered unread, so the
     bytes this call files are the bytes the choice is made over (`chooseMemento`, below). */
  let archiveMemento = null;
  if (archiveAsked) {
    /* N510: the body's first bytes are read ahead, unconsumed; a memento with none is refused by selectCapture's own
       words over its row and the lookup goes on to the next candidate, so nothing of it reaches the store. */
    const m = await timed(t, "archive", () => mementoLookup(cap, archiveAsked, { fetchPurpose: "acquire", asked: archiveAt, take: async ({ res, answer }) => {
      const p = await peekBody(res);
      if (p.failed) return { fail: archiveBroke(p.failed) };
      /* its row's digest is the empty-body digest, which selectCapture refuses by R29's own reason */
      return p.empty ? { row: mementoRow(answer, { sha256: EMPTY_SHA256, bytes: 0 }) } : { res: p.res };
    } }));
    if (!m.ok) return answer(m.status, m.payload);
    archiveMemento = m; locator = m.locator; archiveAddress = m.answer.original;
  }

  /* capture R8, D-104 / D-96: every way this fetch can end is recorded against the DOCUMENT address (the CDX original, the
     Drive link, else the locator), and a governed refusal is never a failure of the source. */
  const via = body.via === "archive.org" ? "archive.org" : "direct";
  const documentAddress = via === "archive.org" && archiveAddress ? archiveAddress : (driveCapture ? driveCapture.address : locator);
  const addressIsDerived = (via === "archive.org" && !!archiveAddress) || !!driveCapture;
  const addrNorm = normalizeAddress(documentAddress);
  const noteOutcome = async (outcome, status) => {
    try { await cap.recordSourceOutcome({ addressNorm: addrNorm, outcome, status: status ?? null, at: retrieved }); }
    catch { /* an unrecorded outcome must not turn a fetch into an error */ }
  };
  /* R22: conditional against the validators the held capture's own fetch was served with at this address. A render
     fetches its shell unconditionally: the capture it files is the rendered document, not the shell. */
  const validators = crHeldSha && !renderAsked ? cap.validatorsOf({ addressNorm: addrNorm, captureSha: crHeldSha }) : null;
  const conditional = validators ? { ...(validators.etag ? { "if-none-match": validators.etag } : {}),
                                     ...(validators.lastModified ? { "if-modified-since": validators.lastModified } : {}) } : null;
  let res = archiveMemento ? archiveMemento.res : null, resolvedUrl = null, governedRetryMs = null;
  if (!res) try {
    /* R31, R42: a sweep's redirects, and every redirect when the group's own hosts are named, are followed BY HAND,
       one governed fetch per hop, each target judged (against the scope, against the group's own hosts) before
       anything is fetched at it; the credential (R23) still goes to its own host only. */
    let url = locator;
    const home = hostOf(locator);
    const byHand = !!sweepScope || !!own;
    for (let hop = 0; ; hop++) {
      const g = await timed(t, "fetch", () => governedFetch(cap, url, crPurpose || "acquire", crAgent, { headers: conditional,
        credential: byHand && hostOf(url) !== home ? null : crCredential, manual: byHand }));
      if (g.refusedByGovernor) {
        await noteOutcome("governed", null);
        return answer(429, { ok: false, reason: "HOST_COOLING_OFF",
          detail: localize("acquisition.index.the_per_host_governor_is_2", "the per-host governor is holding requests to this host ({reason}); retry in about {ceil}s", { reason: String(g.reason), ceil: String(Math.ceil((g.retry_in_ms || 0) / 1000)) }),
          retry_in_ms: g.retry_in_ms || 0, locator });
      }
      res = g.res;
      governedRetryMs = Number.isFinite(g.retry_in_ms) ? g.retry_in_ms : null;   // host-governor R30: the cool-off the refusal recorded
      if (!byHand) break;
      const loc = res.status >= 300 && res.status < 400 && res.status !== 304 ? res.headers.get("location") : null;
      if (!loc || hop >= REDIRECT_MAX) break;
      let next = null;
      try { next = new URL(loc, url).href; } catch { next = null; }
      /* DEC-49 REGION is-own-host
         R42: a redirect to one of the group's own hosts is not followed; the acquire answers the same refusal. */
      if (next && onOwnHost(next, own)) {
        cancelBody(res);
        return answer(403, { ...ownHostRefused(next, { redirected_from: url, status: res.status }), op });
      }
      /* END DEC-49 REGION is-own-host */
      /* DEC-49 REGION is-sweep-redirect */
      if (sweepScope && (!next || !inSweepScope(next, sweepScope))) {
        cancelBody(res);
        const row = SWEEP_SCOPE_CHECKS.SWEEP_REDIRECT_OUT_OF_SCOPE;
        return answer(422, { ok: false, reason: "SWEEP_REDIRECT_OUT_OF_SCOPE", code: "SWEEP_REDIRECT_OUT_OF_SCOPE", check: row.check,
          translation: row.translation, op, target: next || loc, locator, redirected_from: url, status: res.status,
          matched_sweep: crOrigin.matched_sweep,
          detail: localize("acquisition.index.url_redirected_status_to_v1", "{url} redirected ({status}) to {v1}, which is outside the sweep's scope; the redirect was not followed, nothing at its target was fetched, and nothing was filed", { url: String(url), status: String(res.status), v1: String(next || loc) }) });
      }
      /* END DEC-49 REGION is-sweep-redirect */
      /* In scope but not a public locator: R28's fence; the redirect itself is the answer (SOURCE_REFUSED). */
      if (!isPublicHttpsLocator(next)) break;
      cancelBody(res);
      url = next;
      resolvedUrl = next;
    }
  } catch (e) {
    await noteOutcome("fetch_failed", null);
    /* R23: a thrown fetch's message can carry what rode the request, so none is carried when a credential did. */
    return answer(502, { ok: false, reason: "FETCH_FAILED", locator,
      detail: crCredential ? localize("acquisition.index.the_fetch_did_not_complete", "the fetch did not complete; its error is not carried because a supplied credential rode it")
                           : String(e && e.message || e) });
  }
  /* The address the bytes came from: the last hop this call followed, else the runtime's post-redirect URL. */
  resolvedUrl = resolvedUrl || res.url || null;
  /* R22: the source says the held capture is still what it serves. It ASSERTS the bytes and does not serve them, so
     nothing is filed and no receipt is written; the attempt is a success of the source (capture R8). */
  if (conditional && res.status === 304) {
    await noteOutcome("success", 304);
    try { await res.body?.cancel?.(); } catch { /* nothing to read */ }
    return answer(200, { ok: true, existed: true, unchanged: true, capture: { sha256: crHeldSha },
      basis: word("acquisition.basis.source_answered_modified", { cr_held_sha: crHeldSha.slice(0, 12), conditional: Object.keys(conditional).join(", ") }),
      store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE });
  }
  /* DEC-49 REGION is-drive-export — there is NO FALLBACK: a 403, a 404 or an HTML answer ends the capture with the
     failure named; nothing reaches back for the application page. */
  const driveFacts = driveCapture ? { host: driveCapture.host, shape: driveCapture.shape, kind: driveCapture.kind,
                                      file_id: driveCapture.fileId, export_format: driveCapture.format } : null;
  if (driveCapture && !res.ok) {
    await noteOutcome("source_refused", res.status);
    return answer(502, { ok: false, reason: "DRIVE_EXPORT_UNREACHABLE", ...driveRow("DRIVE_EXPORT_UNREACHABLE"), op,
      status: res.status, locator: driveCapture.address, export_address: driveCapture.exportAddress, drive: driveFacts,
      detail: localize("acquisition.index.google_answered_status_at_the", "Google answered {status} at the OpenDocument export address {exportAddress}, which your team's Civicsmith composed from the {kind} id in {address}. Nothing was captured, and the application page at the document's own address was NOT captured in its place — a fallback to the shell would record a success holding no document. A 404 usually means the id is wrong; a 403 usually means the file is not shared with anyone who has the link.", { status: String(res.status), exportAddress: String(driveCapture.exportAddress), kind: String(driveCapture.kind), address: String(driveCapture.address) }) });
  }
  if (driveCapture) {
    const ect = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ect === "text/html" || ect === "application/xhtml+xml") {
      await noteOutcome("source_refused", res.status);
      try { await res.body?.cancel?.(); } catch { /* the source may already be gone */ }
      return answer(502, { ok: false, reason: "DRIVE_EXPORT_IS_THE_SHELL", ...driveRow("DRIVE_EXPORT_IS_THE_SHELL"), op,
        status: res.status, locator: driveCapture.address, export_address: driveCapture.exportAddress,
        declared_content_type: ect, refused_on: word("monitoring.declared_content_type"), drive: driveFacts,
        detail: localize("acquisition.index.the_opendocument_export_address_answered", "the OpenDocument export address answered with `{ect}`, which is the Google Drive APPLICATION — a client-rendered shell whose bytes carry no document (framework Part I §6's UNWATCHABLE case, D-64/D-55). It is refused by name and it is not parsed: the shell is never filed as the document. Google serves it here when the file is not shared with anyone who has the link.", { ect: String(ect) }) });
    }
  }
  /* END DEC-49 REGION is-drive-export */
  /* DEC-49 REGION is-challenge-page
     R140 (T53; K5574, K3656): a challenge or CAPTCHA page in place of the document is recognised from what the fetch received, never filed as the document
     and never worked around; the refusal is counted for the host. A header the service sets to say it challenged settles it; an error answer that is
     a bot-protection page is read for the page's own text, a bounded prefix of it. */
  const challengeRefusal = async (chal, status) => answer(403, { ...personRefusal(cap, { address: resolvedUrl || locator, status, chal }), op, locator });
  if (!driveCapture) {
    const chal = await recogniseChallenge(res);
    if (chal) {
      await noteOutcome("source_refused", res.status);
      try { await res.body?.cancel?.(); } catch { /* the source may already be gone */ }
      return await challengeRefusal(chal, res.status);
    }
  }
  /* END DEC-49 REGION is-challenge-page */
  if (!res.ok) {
    await noteOutcome("source_refused", res.status);
    /* R9 (fix round 4, N-slow-refuse): a source that says wait is relayed at once, with how long it said (`Retry-After`) */
    const asked = res.status === 429 ? retryAfterMs(res.headers.get("retry-after")) : null;
    const waitMs = Math.max(Number.isFinite(asked) ? asked : 0, governedRetryMs || 0);
    return answer(502, { ok: false, reason: "SOURCE_REFUSED", status: res.status, locator, ...(waitMs > 0 ? { retry_in_ms: waitMs } : {}) });
  }
  /* R32: on the archive arm the success is the memento's, recorded once it is chosen (below), never for one refused. */
  if (!archiveMemento) await noteOutcome("success", res.status);

  /* R105 (fix round 6, G2): THE LARGE OR SLOW BODY IS OWED, NOT READ HERE. Only a member's own web capture is parked (the capture-request
     arm runs under no door's bound, the archive arm and the render arm read what they must to decide, and a call the alarm makes for a parked
     fetch reads it whole), and only when the plane's ledger can take the entry. `parkFetch` answers the parked capture, or null when it could
     not park (the ledger refuses, the session cannot be saved): the body is then read here, as it always was. */
  const fetchOwe = oweOf(cap, opts);
  let mayPark = !!fetchOwe && !!askingMember && !captureRequest && !archiveMemento && !renderAsked && opts.inlineFetch !== true;
  const parkFetch = async ({ declared, why }) => {
    try {
      const live = typeof cap.liveCaptureSessions === "function" ? cap.liveCaptureSessions(instantOf(cap)) : [];
      const twin = Array.isArray(live) ? live.find((x) => x && x.locator === documentAddress && x.state && x.state.fetch_pending && x.state.opened_by === askingMember) : null;
      const fp = twin ? { session: twin.session, ...twin.state.fetch_pending }
        : { session: `fp_${(await sha256Hex(`${documentAddress}\n${askingMember}`)).slice(0, 16)}_${Date.now().toString(36)}`, since: stampSecond(instantOf(cap)), declared_bytes: declared, why };
      if (!twin) {
        const carried = {};
        for (const k of ["locator", "subresources", "authority", "file", "coArchive", "for", "project"]) if (body0 && body0[k] !== undefined) carried[k] = body0[k];
        const project = typeof body0?.project === "string" && body0.project.length <= 200 ? body0.project : null;
        const saved = cap.saveCaptureSession({ session: fp.session, locator: documentAddress, primarySha: NO_PRIMARY, primaryFile: "snapshots/pending-fetch", base: documentAddress,
          state: { queue: [{ fetch: true }], opened_by: askingMember, ...(project ? { project } : {}), cls, store: storeName,
                   fetch_pending: { since: fp.since, declared_bytes: fp.declared_bytes, why: fp.why }, body: carried },
          ttlMs: OWED_SESSION_TTL_MS, at: instantOf(cap) });
        if (!(saved && saved.saved !== false) || !(await fetchOwe({ kind: "fetch", session: fp.session }))) {
          try { cap.dropCaptureSession({ session: fp.session }); } catch { /* harmless */ }
          return null;
        }
      }
      return answer(200, { ok: true, fetch_pending: fp, store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE });
    } catch { return null; }
  };
  const declared = declaredLength(res.headers);
  if (mayPark && declared !== null && declared > CAPTURE_MAX) {
    cancelBody(res);
    return answer(413, { ok: false, reason: "TOO_LARGE", bytes: declared, maxBytes: CAPTURE_MAX, ...statement("archive", "uploaded_bytes", declared),
                         detail: localize("acquisition.index.the_document_exceeds_what_this", "the document exceeds what this surface will capture even in parts") });
  }
  if (mayPark && declared !== null && declared > LARGE_FETCH_BYTES) {
    const parked = await parkFetch({ declared, why: "LARGE_DECLARED" });
    if (parked) { cancelBody(res); return parked; }
    mayPark = false;
  }

  /* R10. Streamed in parts of 8 MiB, so peak residency is one part. The incremental hasher is RECORD-GRAMMAR'S, the
     one C-18.6 verifies parts with, so a disagreement between two implementations cannot look like tampering. */
  const PART = 8 * 1024 * 1024;
  const MAX = CAPTURE_MAX;
  const whole = createSha256();
  const parts = [];
  /* D-469: whether the store held each part BEFORE this call wrote it (asked after the put, it finds this call's
     own write). */
  const partHeldBefore = [];
  let total = 0, held = [], heldBytes = 0, oversize = false;
  /* R96: each part's bytes are kept in memory while the capture stays within `MULTIPART_KEEP_MAX`, so the whole is put once when
     the stream ends with no part read back; past it they are let go and the capture is held in its parts alone. */
  let keptParts = [], keptSize = 0, firstHead = null;
  /* R115 (fix round 9, G124b): THE WHOLE IS NEVER HELD TWICE. A body whose declared length is a multipart capture within `MULTIPART_KEEP_MAX` is
     received straight into ONE buffer of that length (`keptWhole`), each part copied in as it is stored and its own buffer let go, so the
     call holds the kept bytes once plus the one part being read, and the whole is put from that buffer with no second copy made. Every byte
     held is counted by the byte ledger (`opts.ledger`, runtime-limits). A body that declares no length, or overruns the one it declared, holds no
     bytes once a second part shows it is several: the parts are already stored, and the whole is made from them (read back one part at a time into the one buffer of the whole), never joined from held parts. */
  const ledger = opts && opts.ledger && typeof opts.ledger.hold === "function" ? opts.ledger : { hold() {}, release() {} };
  let keptWhole = declared !== null && declared > PART && declared <= MULTIPART_KEEP_MAX && !renderAsked ? new Uint8Array(declared) : null;
  let keptHeld = 0;   // the bytes held under the ledger's tag "kept": the one buffer of the whole, or the parts held singly
  if (keptWhole) { ledger.hold(keptWhole.length, "kept"); keptHeld = keptWhole.length; }
  const dropKept = () => { if (keptHeld) ledger.release(keptHeld, "kept"); keptHeld = 0; keptWhole = null; keptParts = null; };
  /* R10: a part is exactly 8 MiB (the last one the remainder), whatever sizes the stream's chunks arrive in. */
  const part = async (buf, inPlace = false) => {
    const psha = await splitTimed(t, "hash", async () => hex(await crypto.subtle.digest("SHA-256", buf)));
    const heldBefore = await splitTimed(t, "store", async () => {
      const had = !!(await ev.head(psha));
      if (!had) await ev.put(psha, buf);
      return had;
    });
    if (!parts.length) firstHead = buf.slice(0, FORMAT_HEAD);   // R17's format and ZIP magic are read from it, so the first part is not read back
    parts.push({ sha256: psha, bytes: buf.length });
    partHeldBefore.push(heldBefore);
    if (keptParts) {
      if (keptWhole && keptSize + buf.length <= keptWhole.length) {
        if (!inPlace) keptWhole.set(buf, keptSize);
        keptParts.push(keptWhole.subarray(keptSize, keptSize + buf.length)); keptSize += buf.length;
      } else if (!keptWhole && !keptParts.length && keptSize + buf.length <= MULTIPART_KEEP_MAX) {
        keptSize += buf.length; keptParts.push(buf); ledger.hold(buf.length, "kept"); keptHeld += buf.length;   // the first part of a body with no length declared, held singly: a capture of one part needs it for its title
      } else {
        dropKept();   // R115: a second part of a body not received into one buffer, an overrun of the declared length, or a body past what is held: no bytes are held, the whole is made from the stored parts
      }
    }
    if (!inPlace) ledger.release(buf.length, "part");
  };
  const flush = async (all = true) => {
    while (heldBytes >= PART || (all && heldBytes > 0)) {
      const n = Math.min(PART, heldBytes);
      /* R115: a part of a capture received into `keptWhole` is assembled in its place there, not in a buffer of its own beside it */
      const inPlace = !!keptWhole && !!keptParts && keptSize + n <= keptWhole.length;
      const buf = inPlace ? keptWhole.subarray(keptSize, keptSize + n) : new Uint8Array(n);
      if (!inPlace) ledger.hold(n, "part");
      let at = 0;
      while (at < n) {
        const c = held[0], take = Math.min(c.length, n - at);
        buf.set(c.subarray(0, take), at); at += take;
        if (take === c.length) { held.shift(); ledger.release(c.length, "chunk"); } else { held[0] = c.subarray(take); ledger.release(take, "chunk"); }
      }
      heldBytes -= n;
      await part(buf, inPlace);
    }
  };
  /* CAP-8: the first KiB of a DRIVE export, kept so the shell can be recognised from the BYTES. */
  const driveHead = driveCapture ? new Uint8Array(1024) : null;
  let driveHeadBytes = 0;
  /* DEC-49 REGION is-refused-kind
     R139 (T53; N1266, RF11; CC6): the head of the body is read for a REFUSED kind (a program, an installer, a script meant to run, a disk image, a RAR)
     and for a challenge page served as a success, before anything is stored: the stream is cancelled and nothing is filed or recorded. The head is
     the first `REFUSE_HEAD_BYTES`, or the whole body when it is shorter. */
  const sniffHead = new Uint8Array(REFUSE_HEAD_BYTES);
  let sniffBytes = 0, sniffed = false;
  const sniffRefusal = async () => {
    sniffed = true;
    const head = sniffHead.subarray(0, sniffBytes);
    const d = detectFormat(head, null, fetchedName(documentAddress));
    if (isRefusedKind(d)) {
      try { await reader.cancel(); } catch { /* the source may already be gone */ }
      const f = refusedFacts(d);
      const row = ARCHIVE_CHECKS.FILE_TYPE_REFUSED;
      return answer(415, { ok: false, reason: "FILE_TYPE_REFUSED", code: "FILE_TYPE_REFUSED", check: row.check, translation: row.translation, op, locator,
        refused: { format: d.format, kind: d.kind ?? null, reason: d.reason ?? null, signals: d.signals ?? [] }, kind: f.kind, kind_text: f.kind_text, reason_text: f.reason_text, detail: f.detail });
    }
    const chal = driveCapture ? null : challengeOf({ status: res.status, headers: res.headers, bytes: head, total: declared ?? (sniffBytes < sniffHead.length ? sniffBytes : null) });
    if (chal) { try { await reader.cancel(); } catch { /* the source may already be gone */ } return await challengeRefusal(chal, res.status); }
    return null;
  };
  /* END DEC-49 REGION is-refused-kind */
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) return answer(502, { ok: false, reason: "NO_BODY", locator });
  stageBegin(t, "read");
  splitOpen(t);
  const readStart = clockNow();
  for (;;) {
    /* R10: a body that breaks off mid-stream is a fetch that did not complete, answered by name, never a throw; the
       parts already stored are content-addressed and named by no document, as TOO_LARGE's are. */
    let chunk;
    try { chunk = await splitTimed(t, "download", () => reader.read()); }
    catch (e) {
      if (archiveMemento) return answer(502, archiveBroke(String(e && e.message || e)).payload);
      await noteOutcome("fetch_failed", null);
      return answer(502, { ok: false, reason: "FETCH_FAILED", locator,
        detail: crCredential ? localize("acquisition.index.the_body_broke_off_credential", "the body broke off while it was read; its error is not carried because a supplied credential rode it")
                             : localize("acquisition.index.the_body_broke_off_while", "the body broke off while it was read ({String})", { String: String(String(e && e.message || e)) }) });
    }
    const { done, value } = chunk;
    if (done) break;
    total += value.length;
    if (total > MAX) { oversize = true; break; }
    /* R105: with no length declared, a body read past `LARGE_FETCH_BYTES`, or any body read for longer than `FETCH_WAIT_MS`, is parked: the
       reader is cancelled (the parts stored so far are content-addressed and found again by the owed read) and the capture is owed. */
    if (mayPark && ((declared === null && total > LARGE_FETCH_BYTES) || clockNow() - readStart > (opts.fetchWaitMs ?? FETCH_WAIT_MS))) {
      const parked = await parkFetch({ declared, why: declared === null && total > LARGE_FETCH_BYTES ? "LARGE_BODY" : "SLOW_BODY" });
      if (parked) { try { reader.cancel()?.catch?.(() => {}); } catch { /* the source may already be gone */ } return parked; }
      mayPark = false;
    }
    await splitTimed(t, "hash", async () => whole.update(value));
    if (driveHead && driveHeadBytes < driveHead.length) {
      const take = Math.min(value.length, driveHead.length - driveHeadBytes);
      driveHead.set(value.subarray(0, take), driveHeadBytes);
      driveHeadBytes += take;
    }
    held.push(value); heldBytes += value.length; ledger.hold(value.length, "chunk");
    if (sniffBytes < sniffHead.length) {
      const take = Math.min(value.length, sniffHead.length - sniffBytes);
      sniffHead.set(value.subarray(0, take), sniffBytes);
      sniffBytes += take;
      if (sniffBytes === sniffHead.length && !sniffed) { const early = await sniffRefusal(); if (early) return early; }
    }
    if (heldBytes >= PART) await flush(false);
  }
  if (!sniffed && !oversize) { const early = await sniffRefusal(); if (early) return early; }
  /* DEC-49 REGION is-drive-bytes — C-48.7: Google said it was a document and it was a web page. Detection is
     bytes-first and certain; a non-HTML export of another flavour is FILED with the disagreement on the hop. */
  if (driveCapture && driveHeadBytes > 0) {
    const sniff = detectFormat(driveHead.subarray(0, driveHeadBytes), null);
    const declared = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (sniff.format === "html") {
      try { await reader.cancel(); } catch { /* the source may already be gone */ }
      await noteOutcome("source_refused", res.status);
      return answer(502, { ok: false, reason: "DRIVE_EXPORT_BYTES_ARE_THE_SHELL", ...driveRow("DRIVE_EXPORT_BYTES_ARE_THE_SHELL"), op,
        status: res.status, locator: driveCapture.address, export_address: driveCapture.exportAddress,
        declared_content_type: declared || null, refused_on: "the bytes", detected: sniff, drive: driveFacts,
        detail: localize("acquisition.index.the_opendocument_export_address_served", "the OpenDocument export address served bytes that are HTML — {signals} — while declaring `{v1}`. That is the Google Drive APPLICATION, not the document, and the declared type did not say so. Detection here is bytes-first and certain, which is the whole reason this arm exists beside the one that reads the header. Nothing was filed, and the shell is never filed as the document.", { signals: String(sniff.signals.join("; ")), v1: String(declared || "(no content type)") }) });
    }
  }
  /* END DEC-49 REGION is-drive-bytes */
  if (oversize) {
    try { await reader.cancel(); } catch { /* the source may already be gone */ }
    return answer(413, { ok: false, reason: "TOO_LARGE", bytes: total, maxBytes: MAX, ...statement("archive", "uploaded_bytes", total),
                         detail: localize("acquisition.index.the_document_exceeds_what_this", "the document exceeds what this surface will capture even in parts") });
  }
  await flush();
  stageEnd(t);
  let sha = whole.hex();
  /* R32: the memento is chosen over the bytes just received (an empty one was passed over before any byte was stored, N510). */
  if (archiveMemento) {
    const c = chooseMemento(archiveMemento, sha, total, archiveAsked, archiveAt);
    if (!c.ok) return answer(c.status, c.payload);
    archiveHopRecorded = c.hop;
    await noteOutcome("success", res.status);
  }
  if (total === 0) return answer(502, { ok: false, reason: "EMPTY", locator });

  /* R11. One part: whether that object was held before this call wrote it. Several: the whole is never stored under
     its own hash, so the REGISTER is asked (provenance R5) and a miss is stated, never scored false (D-476). */
  let existed = false, existedUndetermined = null;
  const multipart = parts.length > 1;
  if (!multipart) {
    if (parts[0].sha256 !== sha)
      return answer(500, { ok: false, reason: "HASH_DISAGREEMENT", detail: localize("acquisition.index.the_incremental_hash_and_the", "the incremental hash and the block hash of the same bytes differ") });
    existed = partHeldBefore[0];
  } else {
    let reg = null;
    try { reg = cap.provenance && typeof cap.provenance.registerHolds === "function" ? await cap.provenance.registerHolds({ sha }) : null; }
    catch { reg = null; }
    const heldParts = partHeldBefore.filter(Boolean).length;
    if (reg && reg.registered === true) existed = true;
    else {
      existed = null;
      existedUndetermined = word(reg ? "acquisition.text.document_captured_parts" : "acquisition.text.document_captured_parts_store",
        { parts: parts.length, held_parts: heldParts });
    }
  }

  let ct = (res.headers.get("content-type") || "").split(";")[0].trim();
  /* R14. Every header the source sent, in order, duplicates kept: a header nobody thought to name is exactly the
     one a later question needs. `resolvedUrl` is the post-redirect URL; the runtime does not expose the hop chain or the
     peer address, and the record says so rather than leaving a field a reader would misread. */
  const responseHeaders = [];
  for (const [k, v] of res.headers) responseHeaders.push([k, v]);
  const transport = { requested: locator, resolved: resolvedUrl || locator, redirected: !!(resolvedUrl && resolvedUrl !== locator),
    status: res.status, http_headers: responseHeaders, peer_address: null,
    peer_address_unavailable: localize("acquisition.index.the_workers_runtime_does_not", "the Workers runtime does not expose the peer address of an outbound fetch") };
  const name = (body.file || locator.split("/").pop() || "capture").replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "capture";

  /* R6, D-64 — THE RENDER ARM, THE PAIR. From here on `sha`, `total` and `ct` name the RENDERED document, the
     bundle's primary; the shell survives as `shell` and `render.of`. */
  let renderRecorded = null, shellRecorded = null, renderedAuth = null, renderDeferred = null, renderedBytes = null, keptNow = null;
  if (renderAsked) {
    const pageUrl = resolvedUrl || locator;
    let answerR = null, rbytes = null, rb = null;
    /* DEC-49 REGION is-render-result */
    if (multipart || detectFormat(null, ct || null).format !== "html") {
      /* D-492: NO RENDERER WAS ASKED, so the reservation is released WITHOUT CHARGE. */
      try { cap.renderSpend({ ms: 0, releaseMs: renderReserved, slot: renderSlot, at: retrieved }); }
      catch { /* an unreleased reservation under-uses the allowance; it never fails the refusal */ }
      return answer(422, { ok: false, reason: "RENDER_NOT_A_PAGE", ...renderRow("RENDER_NOT_A_PAGE"),
        op, content_type: ct || null, bytes: total, multipart,
        detail: localize("acquisition.index.the_served_bytes_are_v1", "the served bytes are {v1}, not an HTML page; nothing was filed.", { v1: String(multipart ? localize("acquisition.index.too_large_to_be_a", "too large to be a single page") : `\`${ct || "(no content type)"}\``) }) });
    }
    /* R5 (T51; C13): THE RENDER IS A CONTINUATION OF THE FILED CAPTURE. It starts here and its cost is reported when it returns,
       whenever that is; this call waits for it only up to `RENDER_WAIT_MS` (the capture-request arm, under no door's bound,
       waits for it). Past the wait the served page is filed as it is, the render pending in a capture session the member
       finishes (`continue`, R12), which completes the pair with the render once it has returned. A call that finishes a
       render (`renderResume`) already holds its answer. */
    if (renderResume) answerR = renderResume.answer;
    else {
      /* R7: the locale R17's view names, the default only as capture-sources' own fallback. */
      /* R42: the render is handed the group's own hosts, which its driver never lets a page reach (capture-sources R64). */
      /* R118 (G137c, X23): a failed render is charged the time it really took (its own `elapsed_ms`, else the wall this call measured), every
         attempt added, and is retried by its class: `transient` (a session refused, three a second, the open bound) up to `RENDER_TRIES`
         times with back-off, `permanent` once and final. The reservation is released once, with the sum. */
      const run = (async () => {
        let a, spent = 0;
        for (let attempt = 1; ; attempt++) {
          const began = clockNow();
          try { a = await renderer.render({ url: pageUrl, ...RENDER_DEFAULTS, locale: renderLocale(pv.view), ...(own ? { own_hosts: own } : {}) }); }
          catch (e) { a = { ok: false, error: String(e && e.message || e), failure_class: "transient" }; }
          spent += a && Number.isFinite(a.elapsed_ms) ? a.elapsed_ms : Math.max(0, Math.round(clockNow() - began));
          if (!(a && a.ok === false && a.failure_class === "transient") || attempt >= RENDER_TRIES) break;
          const back = Array.isArray(opts.renderBackoffMs) ? opts.renderBackoffMs[attempt - 1] ?? 0 : RENDER_BACKOFF_MS[attempt - 1] ?? 0;
          if (back > 0) await new Promise((r) => setTimeout(r, back));
        }
        try { cap.renderSpend({ ms: spent, releaseMs: renderReserved, slot: renderSlot, at: retrieved }); }
        catch { /* an unrecorded spend under-counts the allowance; it never fails the render */ }
        return a;
      })();
      const got = await timed(t, "render", () => within(run, captureRequest ? Infinity
        : (renderWaitMs ?? renderWaitFor(clockNow() - t.start, { barMs: acquireBarMs, reserveMs: promoteReserveMs }))));
      if (got.done) {
        answerR = got.value;
        /* R112 (G107): the page and the bodies it loaded are kept in the record now, within what the bar leaves; past it the render is left pending, the keep going on.
           Not bounded where no door's bound runs (the capture-request arm) or where the caller named its own wait (`renderWaitMs`); a render begun afresh is final. */
        if (!captureRequest && renderWaitMs === undefined && !opts.renderFinal && answerR && answerR.ok === true && answerR.kept !== true
            && typeof answerR.html === "string" && answerR.html.length > 0) {
          const left = keepWaitFor(clockNow() - t.start, { barMs: acquireBarMs, reserveMs: promoteReserveMs, followingMs: opts.postKeepMs });
          const keeping = keepReply(ev, answerR);
          const kept1 = await timed(t, "render", () => within(keeping, left));
          if (kept1.done) { if (kept1.value && kept1.value.kept === true) keptNow = kept1.value; }
          else renderDeferred = { run: keeping, pageUrl };
        }
      }
      else if (opts.renderFinal) answerR = { ok: false, error: localize("acquisition.index.render_did_not_return", "the page as a visitor saw it did not come back in time") };   // R99: a render begun afresh is final
      else renderDeferred = { run: run.then((a) => keepReply(ev, a)), pageUrl };   // R5 (G27): the reply is kept in the record when it returns, not held
    }
    if (!renderDeferred) {
    stageBegin(t, "render");
    const asked = { ...RENDER_DEFAULTS, locale: renderLocale(pv.view) };
    /* R5 (G27): a render that returned after its request had ended was kept in the record at once (`keepReply`); its page is read back, its
       bodies are the digests it recorded, and it is filed as a render waited for is. */
    const kept = answerR && answerR.kept === true ? answerR : keptNow;
    if (kept && answerR.kept === true) answerR = await replyOfKept(ev, kept);   // R112: a keep made in this call leaves the page in memory, not read back
    rb = renderBlock(answerR, { pageUrl, shellSha: sha, asked, at: retrieved, domBound: domBoundOf(answerR) });
    if (rb.ok) rbytes = new TextEncoder().encode(answerR.html);
    if (!rb.ok || rbytes.length > MAX) {
      /* R100 (fix round 7, G72): why a render fails is named on the log, one structured line with the problem (the renderer's own words, never the page) and the
         milliseconds the render stage had run; the ledger row keeps it as the entry's `detail` (`owedRun`) */
      try { console.log(JSON.stringify({ event: "render_failed", problem: String(rb.ok ? "RENDERED_DOCUMENT_OVER_BOUND" : rb.problem).slice(0, 200),
                                         ms: stageTimes(t).stages.render ?? 0, ...(Number.isFinite(answerR && answerR.elapsed_ms) ? { renderer_ms: answerR.elapsed_ms } : {}) })); }
      catch { /* a line that cannot be written never changes the answer */ }
      return answer(502, { ok: false, reason: "RENDER_FAILED", ...renderRow("RENDER_FAILED"), op, shell_sha256: sha, filed: false,
        failure_class: rb.ok ? "permanent" : rb.failure_class === "transient" ? "transient" : "permanent",
        detail: rb.ok ? localize("acquisition.index.the_rendered_document_is_length", "the rendered document is {length} bytes, over this surface's {MAX}.", { length: String(rbytes.length), MAX: String(MAX) }) : rb.problem });
    }
    /* END DEC-49 REGION is-render-result */
    /* D-529: every subresource the render LOADED is hashed BY THE PLANE over bytes it KEEPS. */
    const renderDigests = kept ? kept.digests : await keepRenderBodies(answerR, { sha256: sha256Hex,
      put: async (s, b) => { if (!(await ev.head(s))) await ev.put(s, b); } });
    rb = renderBlock(answerR, { pageUrl, shellSha: sha, asked, at: retrieved, digests: renderDigests });
    const rsha = kept ? kept.rsha : await sha256Hex(rbytes);
    const renderedExisted = kept ? kept.existed : !!(await ev.head(rsha));
    if (!renderedExisted && !kept) await ev.put(rsha, rbytes);
    renderedBytes = rbytes;
    stageEnd(t);
    shellRecorded = { file: `snapshots/${name}.shell.html`, sha256: sha, bytes: total,
                      method: localize("acquisition.index.bio_plane_acquire_hashed_at_receipt", "bio-plane acquire, https fetch, hashed at receipt"), ...(ct ? { content_type: ct } : {}), transport };
    renderRecorded = rb.render;
    renderedAuth = renderedAuthority({ asserted: authorityAsserted, render: renderRecorded, at: retrieved });
    /* The render's own navigation, reported to the governor like any load. */
    if (typeof renderRecorded.status === "number" && cap.governor) {
      try { await cap.governor.governorReport({ host: new URL(pageUrl).host, status: renderRecorded.status, retry_after_ms: null }); }
      catch { /* an unrecorded outcome is not a failed render */ }
    }
    sha = rsha; total = rbytes.length; ct = "text/html"; existed = renderedExisted;
    }
  }

  /* R98 (T51; C25): the document's own title, read from the bytes this call holds: the rendered document when the capture is a
     render, else the single part of a page; none for a capture of several parts (past what a title is read from) or one that is
     not HTML. A fact read from the bytes, not a reading (R8): nothing is invented from a file name, a heading elsewhere or the host. */
  const titleBytes = renderRecorded ? renderedBytes : !multipart && keptParts && keptParts.length === 1 ? keptParts[0] : null;
  /* T53-526: a page the source serves as HTML whose bytes read as well-formed XML (a fragment, XHTML) is still a page whose title is read; the answer's
     KIND decides, never the one word `html` */
  const titleKind = titleBytes ? detectFormat(titleBytes, ct || null) : null;
  const htmlTitle = titleKind && (titleKind.format === "html" || (titleKind.format === "xml" && /html/i.test(ct || "")))
    ? titleOfBytes(titleBytes, renderRecorded ? null : res.headers.get("content-type")) : null;
  /* R98 (fix round 4, C25; pdf-reader R40): a PDF's title is `pdfTitle`'s (its Info `Title`, else its XMP `dc:title`), read from the bytes this
     call holds without reading any page, cleaned as a page's is; a PDF with neither, or one past what is held in memory, answers null. */
  let pdfTitled = null;
  if (!renderRecorded && keptParts && keptParts.length && typeof pdfReader.pdfTitle === "function") {
    /* R115: the title is read where the whole is held in ONE buffer (a single part, or the buffer a declared length was received into); a capture
       of several parts received otherwise is not joined in memory to read it, and answers null here, to be named by its reading (R98). */
    const whole0 = keptParts.length === 1 ? keptParts[0] : keptWhole && keptSize <= keptWhole.length && keptSize === total ? keptWhole.subarray(0, keptSize) : null;
    if (whole0 && detectFormat(whole0.subarray(0, 1024), ct || null).format === "pdf") {
      try { pdfTitled = cleanedTitle(await pdfReader.pdfTitle(whole0)); } catch { pdfTitled = null; }
    }
  }
  const title = htmlTitle ?? pdfTitled;
  /* R96: the first bytes of the first part, held in memory, are what R17's profile reads for the ZIP magic, so it is not read back. */
  const firstPart = multipart ? firstHead : null;

  /* R10, R96 (T51; C5): a capture held in parts is kept whole too, under its own fingerprint, put once from the parts held in
     memory (stage `keep`, apart from `read`), or refused in words with nothing filed. */
  if (multipart && !renderRecorded && total <= MULTIPART_KEEP_MAX) {
    const inOne = !!keptWhole && keptSize === total && keptWhole.length >= total;   // a body shorter than its declared length fills the front of the buffer
    /* R115: the one buffer it was received into, else nothing held: they are read back one at a time into the one buffer of the whole */
    const kept = await timed(t, "keep", () => keepWhole(ev, { sha, parts, total, bytes: inOne ? keptParts : null, whole: inOne ? keptWhole.subarray(0, total) : null, ledger }));
    if (!kept.ok) return answer(502, notKept(parts.length, kept.why));
  }

  /* R115: the bytes held for the keep and the title are let go once the keep is done (the call goes on holding nothing of the capture's body) */
  dropKept();

  /* R13, D-58: the acquisition receipt, UNCONDITIONALLY, for every filed capture: under the DOCUMENT address (the
     CDX original, the Drive link as given, or for a direct fetch the address it resolved to), `via`, and the
     retrieval locator. A failed receipt write does not fail the capture. */
  stageBegin(t, "receipt");
  try {
    await cap.provenance?.recordReceipt?.({ address: addressIsDerived ? documentAddress : (resolvedUrl || locator),
      addressNorm: addressIsDerived ? addrNorm : normalizeAddress(resolvedUrl || locator), captureSha: sha, retrieved,
      via, retrievalLocator: locator, reputation });
  } catch { /* an unfiled receipt is not a failed capture */ }
  stageEnd(t);
  /* R16, capture R69: the member this capture's document names as its actor is recorded as one who captured these bytes. */
  const actor = member && typeof sessMember === "string" && sessMember ? sessMember : null;
  if (actor) {
    try { cap.recordCaptureActor({ captureSha: sha, actor, at: retrieved }); }
    catch { /* an unrecorded actor costs that member their account (capture R69), never this capture */ }
  }
  /* R47 (N1117; capture R94): a member's `for`, recorded once the capture is filed or found already held, through the store
     handed in: the digest, the question, the member, the instant. A failed or absent record never fails the capture. */
  let forRecorded = null;
  if (askedFor !== null) {
    let rec = false;
    try {
      const r = typeof cap.recordCapturedFor === "function" ? await cap.recordCapturedFor({ captureSha: sha, question: askedFor, by: askingMember, at: retrieved }) : null;
      rec = !!(r && r.recorded === true);
    } catch { rec = false; }
    forRecorded = { question: askedFor, recorded: rec };
  }
  /* R22: what the source said about these bytes, kept for a later conditional fetch of the same document. */
  if (via === "direct" && !renderRecorded) {
    try { cap.recordValidators({ addressNorm: addrNorm, captureSha: sha, etag: res.headers.get("etag"),
                                 lastModified: res.headers.get("last-modified"), at: retrieved }); }
    catch { /* an unrecorded validator costs a later request its condition, never this capture */ }
  }
  /* attestation R4 (K59): an archive-sourced capture's receipt is signed with the instance's own key, by the
     attestation instance the composition hands in (`cap.attestation`). A signing that cannot be made (no key bound,
     or no instance) is stated on the answer, never a failed capture. */
  let receiptSignature = null;
  if (via === "archive.org") {
    try { receiptSignature = await cap.attestation?.signReceipt?.({ captureSha: sha, retrievalLocator: locator, retrieved }) ?? null; }
    catch (e) { receiptSignature = { ok: false, reason: "RECEIPT_NOT_SIGNED", detail: String(e && e.message || e).slice(0, 200) }; }
  }

  /* R15, D-98: an undetermined capture enqueues ONE event; that is the entire extent of what the capture path may do
     about it. The subject is the DOCUMENT for a Drive export, else the locator. */
  if (renderedAuth ? renderedAuth.authority_state === "undetermined" : !authorityAsserted) {
    try { await cap.taskEnqueue({ kind: "authority-undetermined", captureSha: sha,
                                  subject: driveCapture ? documentAddress : locator, locator, ...(title ? { title } : {}), at: retrieved }); }
    catch { /* an unqueued task is not a failed capture; C-18.9 still refuses it at or past verified */ }
  }

  /* R19: supporting files, on request. A page whose render is still pending is walked when the render is finished, over the
     rendered document. */
  let subs = null, subsSkipped = sessionSkip, sessionId = null;
  if (renderDeferred && body.subresources === true && !subsSkipped)
    subsSkipped = { reason: "RENDER_PENDING", detail: localize("acquisition.index.render_pending_files", "the page as a visitor saw it is still being made, and its supporting files are captured with it when you finish this capture") };
  if (body.subresources === true && !subsSkipped) {
    const w = await timed(t, "subresources", () => walkSubresources(cap, { ev, sha, total, multipart, ct, name, locator, base: resolvedUrl || locator,
                                             retrieved, resume: null, sessionId: null, own, openedBy: actor, owe: oweOf(cap, opts) }));
    subs = w.subs; subsSkipped = w.skipped; sessionId = w.sessionId;
  } else if (!subsSkipped && !renderDeferred && !multipart && detectFormat(null, ct || null).format === "html") {
    /* R123: the page's own links are filed whether or not supporting files are asked; nothing is fetched for them */
    await timed(t, "subresources", () => walkSubresources(cap, { ev, sha, total, multipart, ct, name, locator, base: resolvedUrl || locator,
                                                          retrieved, resume: null, sessionId: null, linksOnly: true }));
  }

  /* R108 (G19): what of the supporting files was kept, stated in the capture's facts and in the answer */
  const supporting = supportingOf({ subs, render: renderRecorded, notWalked: body.subresources === true ? subsSkipped : null });
  /* R5 (T51; C13): the render still running is parked as a capture session, which the member finishes (`continue`, R12); the
     run is kept beside it so finishing it waits for the very render begun here. */
  let renderPending = null;
  if (renderDeferred) {
    const sid = `rs_${sha.slice(0, 16)}_${Date.now().toString(36)}`;
    const carried = {};
    for (const k of ["subresources", "authority", "file", "coArchive"]) if (body[k] !== undefined) carried[k] = body[k];
    let owedRow = false;
    try {
      const owe = oweOf(cap, opts);
      const saved = cap.saveCaptureSession({ session: sid, locator, primarySha: sha, primaryFile: `snapshots/${name}`, base: renderDeferred.pageUrl,
        state: { queue: [{ render: true }], ...(actor ? { opened_by: actor } : {}), render_pending: { since: retrieved, body: carried } },
        ...(owe ? { ttlMs: OWED_SESSION_TTL_MS } : {}), at: instantOf(cap) });
      /* R100: the render still to be finished is owed work too */
      if (owe && saved) owedRow = await owe({ kind: "subresources", sha, session: sid });
    } catch { /* the render still returns; the member captures again */ }
    /* R117: the row is the render's home; when the run returns its kept reply is written to the session the row names, so an object that restarts after it still finds it */
    renderDeferred.run.then((a) => persistRender(cap, sid, a, owedRow)).catch(() => {});
    PENDING_RENDERS.set(sid, { run: renderDeferred.run, since: instantOf(cap) });
    const forget = setTimeout(() => PENDING_RENDERS.delete(sid), PENDING_RENDER_TTL_MS);
    if (forget && typeof forget.unref === "function") forget.unref();
    renderPending = { session: sid, since: retrieved,
      note: localize("acquisition.index.render_pending_note", "this is the page as it was served; the page as a visitor saw it is still being made, and is filed as a second document when this capture is finished") };
  }

  /* R17, CONSTRUCTS Step 1 (FW-3): THE PROFILE, docprofile read and never copied, over the bytes the record holds. */
  const profHeaders = {};
  for (const [hk, hv] of res.headers) profHeaders[hk.toLowerCase()] = hv;
  /* N615 (K1683, K1773): `doctypeFor` is handed the capture's origin. Every arm of this act is a fetch the copy makes,
     a member session's request included, so it is always `"fetch"`; `"member"` is only for bytes a member supplied by
     their own act outside the copy (an upload), which a caller of `profileOf` states. So a content type
     read only from a member's own capture (court-doctypes R2) never matches a fetch. */
  stageBegin(t, "profile");
  const profile = await profileOf({ ev, sha, ct, total, multipart, headers: profHeaders, locator: documentAddress, view: pv,
                                    retrieved, origin: "fetch", name: fetchedName(documentAddress), declaredType: ct, parts: renderRecorded ? null : parts, firstPart });
  /* R4, CAP-8: Google's hop, built from what this call established. Its confirmation is the FORMAT registry's own
     detection over the stored export's BYTES, whole (an OpenDocument package is recognised by its central directory,
     which lies past the first KiB `profile.format` reads for any export of real size): a detection that fell back to
     Google's declared type is Google's label, never a confirmation, so the hop then says the bytes were not sniffed. */
  if (driveCapture) {
    let detected = null;
    if (!multipart && total > 0 && total <= ODF_DIGEST_MAX) {
      try {
        const o = await ev.get(sha);
        if (o) { const d = detectFormat(new Uint8Array(await o.arrayBuffer()), null); if (isNamedKind(d)) detected = d; }
      } catch { detected = null; }
    }
    driveHopRecorded = driveHop(driveCapture, { retrieved, resolved: resolvedUrl, detected });
  }
  stageEnd(t);

  /* R20, R43 (K60, K1888): co-attestation at every capture; the co-archive as the group's setting asks, unless the member
     chose for this capture (the body's `coArchive` from a member session, or the request's on the capture-request arm). */
  const memberChoice = captureRequest ? captureRequest.coArchive
    : (member && typeof sessMember === "string" && sessMember ? body.coArchive : undefined);
  const coArchive = typeof memberChoice === "boolean" ? { on: memberChoice, by: "member" } : { on: coArchiveStateOf(cap.core).on, by: "group" };
  /* R20 (T51; C12, fix round 3 P4a): the attestation is requested now that the document is kept and NO SET TIME IS WAITED for it:
     the answer returns with the attempt pending unless it has already ended, and the attempt is recorded against the capture
     when it ends (`recordLateAttestations`, capture R68), never failing or undoing it. The capture-request arm, which runs
     under no door's bound, waits for the attempt to end, so the document it files records it. */
  const attestAsked = coAttest(cap, { sha, locator: documentAddress, via, ev, coArchive });
  const attested = await timed(t, "attest", () => within(attestAsked, captureRequest ? Infinity : 0));
  let attestations;
  if (attested.done) attestations = attested.value;
  else {
    const asking = stampSecond(instantOf(cap));
    attestations = [{ service: "attest", attempted: true, ok: false, pending: true, at: asking,
      note: localize("acquisition.index.attestation_pending", "the timestamp and the co-archive were asked for after the document was kept, and had not answered when this capture was answered; their outcome is recorded when they do") }];
    attestAsked.then(async (attempts) => {
      try { if (typeof cap.recordLateAttestations === "function") await cap.recordLateAttestations({ captureSha: sha, attempts, by: actor }); }
      catch { /* an unrecorded late attempt leaves this one pending; the capture stands */ }
    }).catch(() => {});
  }

  /* F1 (BD-18): the archive arm's replay read as raw or rewritten from the locator this call fetched, never a body. */
  const archiveRaw = via === "archive.org" ? rawReplayOf(locator) : null;
  const document = {
    file: `snapshots/${name}`, locator, retrieved,
    title,
    profile,
    /* R15, D-97: authority mirrors verdict / basis / at: the STATE always, the basis dated in both cases. */
    ...(renderedAuth ? renderedAuth : {
      ...(authorityAsserted ? { authority: authorityAsserted } : {}),
      authority_state: authorityAsserted ? "determined" : "undetermined",
      authority_basis: authorityAsserted
        ? word("acquisition.authority_basis.asserted_capturing_intake", { caller: member ? "member" : "caller", retrieved })
        : word("acquisition.authority_basis.assertion_supplied_mechanical", { retrieved }),
    }),
    /* R16: ordered hops from us back to the origin; a direct fetch is ONE hop, which grades it above an archive-
       sourced capture (grade tracks directness, never technique). A render whose wait timed out is NEVER presented
       as the whole page (D-499), the qualification derived by `completenessReading`, never retyped. `who` names
       Civicsmith (DEC-124), spelled by R33's `firstHopWho`; a document filed before T31 keeps the `who` it was written with: this act rewrites none. */
    provenance_chain: [{
      who: firstHopWho((cap.env || {}).INSTANCE_NAME, (cap.env || {}).VERSION),
      asserts: renderRecorded
        ? localize("acquisition.index.these_bytes_are_the_document", "these bytes are the document a {v1} render produced from {locator} at {retrieved}; the shell it was rendered from was served for {locator_2} and is held beside it (render.of){v2}", { v1: String(renderRecorded.engine || "renderer (engine not reported)"), locator: String(locator), retrieved: String(retrieved), locator_2: String(locator), v2: completenessReading(renderRecorded) ? localize("acquisition.index.the_whole_page_qualifier", "; {reading}, so they are not asserted to be the whole page", { reading: String(completenessReading(renderRecorded)) }) : "" })
        : localize("acquisition.index.these_bytes_were_served_for", "these bytes were served for {locator} at {retrieved}", { locator: String(locator), retrieved: String(retrieved) }),
      evidence: renderRecorded
        ? localize("acquisition.index.first_party_https_fetch_of_the", "first-party https fetch of the shell, hashed at receipt; the rendered document hashed at receipt from the renderer; render.* records the environment")
        : localize("acquisition.index.first_party_https_fetch_transport", "first-party https fetch, hashed at receipt, transport record on this document"),
      bound: false, via,
    }, ...(archiveHopRecorded ? [archiveHopRecorded] : []), ...(driveHopRecorded ? [driveHopRecorded] : [])],
    capture: {
      method: renderRecorded ? RENDERED_METHOD : multipart
        ? localize("acquisition.index.bio_plane_acquire_https_fetch", "bio-plane acquire, https fetch, streamed in {length} parts, hashed at receipt", { length: String(parts.length) })
        : localize("acquisition.index.bio_plane_acquire_hashed_at_receipt", "bio-plane acquire, https fetch, hashed at receipt"),
      /* R18 (D-698) · F1, BD-18: provenance's rule, each letter read from its one definition, never typed here. On the
         archive arm the replay fetched decides it (provenance R85's `rawReplayOf` over the retrieval locator): a raw
         replay (`id_`, the publisher's response unmodified) is ARCHIVE_CAPTURE_GRADE "via archive", its snapshot its
         fetch date and the archive its custodian; a rewritten replay is REWRITTEN_REPLAY_GRADE, reference only. */
      grade: via === "archive.org" ? (archiveRaw ? ARCHIVE_CAPTURE_GRADE : REWRITTEN_REPLAY_GRADE) : EARNED_CAPTURE_CEILING,
      ...(via === "archive.org" ? { authority: word("acquisition.authority.internet_archive"), via_archive: true,
                                    ...(archiveRaw ? { custodian: archiveRaw.custodian, fetched_at: archiveRaw.snapshot_at }
                                                   : { reference_only: true }) } : {}),
      actor_class: member ? "member" : (cls === "probe" ? "session" : "daemon"),
      /* R16 (N364): which member captured it, the member stamp of a member session, else null (capture R69 reads it). */
      actor,
      sha256: sha, encoding: "binary", bytes: total,
      ...(ct ? { content_type: ct } : {}),
      /* R16 (T51; C25): the file name the source gave the document, when it gave one, so a document with no title of its own is named by it */
      ...(fileNameOf(res.headers, resolvedUrl || locator) ? { file_name: fileNameOf(res.headers, resolvedUrl || locator) } : {}),
      ...(renderRecorded ? {} : { transport }),
      ...(supporting ? { supporting } : {}),
      /* R23: that a supplied credential rode the fetch, whose and at which scope, never its secret. */
      ...(crCredential ? { credentialed: { credential: crCredential.credential ?? null, kind: crCredential.kind,
                                           supplied_by: crCredential.supplied_by ?? null, scope: crCredential.scope ?? null,
                                           project: crCredential.project ?? null },
                           reproducible_by_public: false } : {}),
    },
    ...(renderRecorded ? {
      pair: { primary: "rendered", rendered: { file: `snapshots/${name}`, sha256: sha },
              shell: { file: shellRecorded.file, sha256: shellRecorded.sha256 } },
      render: renderRecorded, shell: shellRecorded,
    } : {}),
    ...(multipart ? { parts: parts.map((p, i) => ({ file: `snapshots/${name}.part${String(i).padStart(3, "0")}`, sha256: p.sha256, bytes: p.bytes })) } : {}),
    /* Derived artifacts are named on the SAME register document, never as documents of their own (C-18.3). */
    ...(subs ? { renditions: subs.renditions } : {}),
    /* R21: on the capture-request arm the origin is the drain's row's, never the body's. */
    /* R31 (K1126): only link-sweep and capture-requests' sweep arm set a sweep origin; a body's `matchedSweep` is ignored. */
    origin: captureRequest ? (crOrigin || { kind: "named_request" }) : { kind: "named_request" },
    attestation_attempts: attestations,
    ...(renderPending ? { render_pending: renderPending } : {}),
  };
  /* R40 (K1852 (2)): an archive opens on capture, in the same call, `by` its caller and within every budget; the files it
     files are answered beside the document for the caller to promote after it. A refusal is stated there and never
     fails the capture. */
  let unpacked = null;
  if (profile && profile.format && profile.format.format === "zip") {
    /* R116: the open of an archive is one job row, registered with the archive's whole digest BEFORE the answer (an `acquire` of a continuation returned long before) */
    { const owe = oweOf(cap, opts); if (owe) await owe({ kind: "unpack", sha }); else noteJob(opts, "unpack", "NO_REGISTRAR"); }
    try {
      unpacked = await timed(t, "unpack", () => unpack(cap, { archiveSha: sha, by: actor, cls, member }, { automatic: true,
        ...(registrarOf(cap, opts) ? { registerJob: registrarOf(cap, opts) } : {}), ...(armerOf(cap, opts) ? { armJobs: armerOf(cap, opts) } : {}),
        parts: parts.map((p) => ({ sha256: p.sha256, bytes: p.bytes })), origin: document.origin,
        ...(oweOf(cap, opts) ? { owedLater: oweOf(cap, opts) } : {}),
        address: addressIsDerived ? documentAddress : (resolvedUrl || locator),
        addressNorm: addressIsDerived ? addrNorm : normalizeAddress(resolvedUrl || locator) }));
    } catch (e) {
      const row = ARCHIVE_CHECKS.ARCHIVE_UNREADABLE;
      unpacked = { ok: false, reason: "ARCHIVE_UNREADABLE", code: "ARCHIVE_UNREADABLE", check: row.check, translation: row.translation,
                   why: "source_unreadable", detail: String(e && e.message || e).slice(0, 200) };
    }
  }
  /* R96 (C5 e; fix round 4, C5c): past what memory holds, the whole is made from the stored parts by the store itself, and this
     call AWAITS it within what is left of the door's bound (stage `keep`): a promise nothing keeps alive after the answer is not a keep.
     One that has not ended by then is registered as pending with the store handed in (`keepLater`, the plane's `keeps_pending`,
     finished by its alarm) and the answer says `keep_pending`: the capture is kept in its parts and the whole follows. */
  let keepPending = false;
  if (multipart && !renderRecorded && total > MULTIPART_KEEP_MAX && ev && typeof ev.putFromParts === "function") {
    const elapsedMs = clockNow() - t.start;
    const k = await timed(t, "keep", () => keepPast(cap, ev, { sha, parts, boundMs: opts.boundMs ?? ACQUIRE_BOUND_MS, elapsedMs, keepLater: keepLaterOf(cap, opts) }));
    keepPending = k.keep_pending;
    if (!k.keep_pending && !registrarOf(cap, opts) && !(typeof opts.keepLater === "function" || typeof cap.keepLater === "function") && !(await ev.head(sha).catch(() => null))) noteJob(opts, "keep", "NO_REGISTRAR");
  }
  return answer(200, {
    ok: true, existed,
    ...(existedUndetermined ? { existed_undetermined: existedUndetermined } : {}),
    /* R22: the bytes are the capture the record already holds. */
    ...(crHeldSha && sha === crHeldSha ? { held: true } : {}),
    document,
    ...(forRecorded ? { for: forRecorded } : {}),
    ...(multipart ? { parts: parts.length } : {}),
    ...(keepPending ? { keep_pending: true } : {}),
    ...(renderPending ? { render: { state: "pending", session: renderPending.session } } : {}),
    ...snapshotOf(subs, sessionId, name, shellRecorded),
    ...(subsSkipped ? { subresources_skipped: subsSkipped } : {}),
    ...(supporting ? { supporting } : {}),
    ...(receiptSignature ? { receipt_signature: receiptSignature } : {}),
    ...(unpacked ? { unpack: unpacked } : {}),
    /* R116: work this call owed and could not register, stated */
    ...(opts.jobNotes.length ? { jobs: { not_registered: opts.jobNotes } } : {}),
    /* R44: what the scanner said of the address, stated to the caller as the receipt records it */
    reputation,
    store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE,
  });
}

/* R117 (fix round 9, G126g): A PENDING RENDER SURVIVES A RESTART. What the run of a render this call did not wait for answers (`keepReply`'s small `{kept, rsha, existed,
   digests, reply}`, or a failed render's `{ok: false, error, failure_class}`) is written into the capture session the render's job row names (`render_pending.answer`)
   when it returns, so `finishRender` of an object that was restarted between the render's start and its delivery finds it and finishes it from the record, with no
   second render, reservation or charge. A reply over `RENDER_ANSWER_MAX` bytes of JSON is not written (the render is then begun afresh, R99), and a session that is gone
   or no longer pending is not written back. Never throws. */
export const RENDER_ANSWER_MAX = 2 * 1024 * 1024;
function persistRender(cap, sid, a, owed) {
  try {
    if (!a || typeof a !== "object" || !(a.kept === true || a.ok === false)) return;
    const answer = a.kept === true ? a : { ok: false, error: String(a.error || "").slice(0, 500), ...(typeof a.failure_class === "string" ? { failure_class: a.failure_class } : {}),
                                           ...(Number.isFinite(a.elapsed_ms) ? { elapsed_ms: a.elapsed_ms } : {}) };
    if (JSON.stringify(answer).length > RENDER_ANSWER_MAX) return;
    const ld = cap.loadCaptureSession({ session: sid });
    const st = ld && ld.found && ld.state && typeof ld.state === "object" ? ld.state : null;
    if (!st || !st.render_pending || st.render_pending.answer) return;
    cap.saveCaptureSession({ session: sid, locator: ld.locator, primarySha: ld.primarySha, primaryFile: ld.primaryFile, base: ld.base,
      state: { ...st, render_pending: { ...st.render_pending, answer } }, ...(owed ? { ttlMs: OWED_SESSION_TTL_MS } : {}), at: instantOf(cap) });
  } catch { /* the render is begun afresh when it is finished */ }
}

/** R5, R12 (fix round 6, G27): A RENDER THAT RETURNS AFTER ITS REQUEST HAS ENDED IS KEPT IN THE RECORD, NOT IN MEMORY. The renderer's reply is the
 *  page and every body the page loaded (up to `SUBRESOURCE_BUDGET`, 64 MiB, sent as base64 text): held by the pending render until the member's
 *  "Finish it" or the alarm takes it, an hour at most, it was the whole of the object's 128 MB. When the run returns, its page and each body are
 *  put in the evidence store as the filing would put them (content-addressed, named by no document until one is filed), and what is held in their
 *  place is `{kept: true, rsha, existed, digests, reply}`: the reply without its page or bodies, the page's digest, whether the record held the
 *  page already, and the bodies' digests. `replyOfKept` reads the page back when the render is filed. A failed or empty render is small and is
 *  passed on as it came; a record that will not take a piece leaves the reply as it came too, held as before, so no render is lost. Never throws. */
async function keepReply(ev, a) {
  try {
    if (!a || a.ok !== true || typeof a.html !== "string" || a.html.length === 0) return a;
    let refused = false;
    const put = async (s, b) => { try { if (!(await ev.head(s))) await ev.put(s, b); } catch (e) { refused = true; throw e; } };
    const digests = await keepRenderBodies(a, { sha256: sha256Hex, put });
    const page = new TextEncoder().encode(a.html);
    if (refused || page.length > CAPTURE_MAX) return a;
    const rsha = await sha256Hex(page);
    const existed = !!(await ev.head(rsha));
    if (!existed) await ev.put(rsha, page);
    const { html, requests, ...rest } = a;
    const bare = Array.isArray(requests) ? requests.map((r) => { if (!r || typeof r !== "object") return r; const { body_base64, body_text, ...meta } = r; return meta; }) : requests;
    return { kept: true, rsha, existed, digests, reply: { ...rest, ...(bare === undefined ? {} : { requests: bare }) } };
  } catch { return a; }
}
/** R5 (G27): the renderer's reply of a render `keepReply` kept, its page read back from the record; a page that cannot be read back is a failed
 *  render, in words. Never throws. */
async function replyOfKept(ev, kept) {
  try {
    const o = await ev.get(kept.rsha);
    if (o) return { ...kept.reply, html: new TextDecoder("utf-8").decode(new Uint8Array(await o.arrayBuffer())) };
  } catch { /* said below */ }
  return { ok: false, error: localize("acquisition.index.render_page_not_read_back", "the page as a visitor saw it was made but could not be read back from the record") };
}

/* R44 (N714, N710; K1929 (2), K1939 (DEC-168 S12, S13), K1946 T2; T37, N774, K2155): THE ADDRESS'S REPUTATION, ASKED
   BEFORE THE FETCH. The tool and the `FILE_SCANNER` binding come from the caller (`opts`, else the store handed in, as
   R42's list does; the binding also from its `env`), never from a body. The tool is a `url_reputation` spec
   (file-scanner R21), null, or a READER: a function answering either, or a promise of either, called once for this
   acquisition (so the tool is read at each one, never once at start, `plane` R29) and awaited within the same bound as
   the lookup. A reader that throws, rejects, outlasts the bound or answers anything but a spec or null is no answer,
   `TOOL_UNREADABLE`. The scanner is asked `POST /provider/reputation` (its R25) with the address and the spec only. Its
   answer never refuses, changes or grades the fetch: it is recorded on the receipt and stated in the answer. No answer is
   recorded as such, never as `listed: false`. The reader and the lookup together are bounded, so they never delay the
   fetch past `REPUTATION_TIMEOUT_MS` (chosen, not measured); never throws. */
export const REPUTATION_TIMEOUT_MS = 5000;
const REPUTATION_URL = "https://file-scanner/provider/reputation";
const reputationToolOf = (cap, given) => (given !== undefined ? given : cap && cap.reputation !== undefined ? cap.reputation : null);
const fileScannerOf = (cap, given) => given || (cap && cap.fileScanner) || (cap && cap.env && cap.env.FILE_SCANNER) || null;
/* A spec as a reader may answer it: an object (the scanner judges its fields, R21); anything else is unreadable. */
const isToolSpec = (t) => !!t && typeof t === "object" && !Array.isArray(t) && typeof t.then !== "function";
async function addressReputation(address, given, scanner, at = Date.now()) {
  const toolIdOf = (t) => (t && typeof t === "object" && typeof t.tool_id === "string" ? t.tool_id : null);
  const unanswered = (code, t = null) => ({ tool: toolIdOf(t), listed: null, categories: [], checked_at: stampSecond(at), unanswered: code });
  /* One bound over the reader and the lookup; whatever arrives after it is not read. */
  const LATE = Symbol("late");
  let timer = null;
  const late = new Promise((r) => { timer = setTimeout(() => r(LATE), REPUTATION_TIMEOUT_MS); });
  const within = (p) => { Promise.resolve(p).catch(() => { /* an answer arriving after the bound is not read */ }); return Promise.race([p, late]); };
  try {
    let tool = given;
    if (typeof given === "function") {
      try { tool = await within((async () => given())()); } catch { return unanswered("TOOL_UNREADABLE"); }
      if (tool === LATE || (tool !== null && !isToolSpec(tool))) return unanswered("TOOL_UNREADABLE");
    }
    if (tool === null || tool === undefined) return unanswered("NO_TOOL");
    if (!scanner || typeof scanner.fetch !== "function") return unanswered("SCANNER_UNREACHABLE", tool);
    let out;
    try {
      out = await within((async () => {
        const res = await scanner.fetch(REPUTATION_URL, { method: "POST", headers: { "content-type": "application/json" },
                                                          body: JSON.stringify({ address, tool }) });
        return res.json();
      })());
    } catch { return unanswered("SCANNER_UNREACHABLE", tool); }
    if (out && out !== LATE && out.ok === true)
      return { tool: toolIdOf(tool), listed: out.listed === true, categories: Array.isArray(out.categories) ? out.categories.filter((c) => typeof c === "string") : [], checked_at: stampSecond(at) };
    if (out && out !== LATE && out.ok === false && typeof out.code === "string" && out.code) return unanswered(out.code, tool);
    return unanswered("SCANNER_UNREACHABLE", tool);
  } finally { clearTimeout(timer); }
}

/** R17 (G170): the name a fetched address ends in, its last path segment decoded, else null. */
function fetchedName(address) {
  try {
    const seg = new URL(String(address)).pathname.split("/").pop();
    return seg ? decodeURIComponent(seg) : null;
  } catch { return null; }
}

/** R17: the profile of a capture the store holds under `sha`: docprofile's `identify` over the headers, the document
 *  address, the content type and (single-part, textual, within bound) the stored bytes read back; `doctypeFor` under
 *  `view` (`profileView`); `profileRecord`; the normalisation rules and boundary; `format` from the bytes (the first
 *  KiB read back when not already read), else the declared type with the absence stated; and `digests`. Every
 *  unreadable byte is stated, never a failed capture. The acquisition act and the knock's pull (capture R65) call it.
 *  `origin` (N615, K1683, K1773), `"member"` for bytes a member supplied by their own act (an upload) or
 *  `"fetch"` for a fetch the copy made, reaches `doctypeFor` as `ctx.origin`; absent, none is stated and a type that
 *  needs a member's own capture does not match. `firstPart` (R96), the first bytes of the first part when the caller holds them, is
 *  what the ZIP magic is read from, so a capture of several parts reads none back for it. */
export async function profileOf({ ev, sha, ct = null, total = 0, multipart = false, headers = {}, locator = null, view, retrieved,
                                  origin = null, parts = null, firstPart = null, unread = null, name = null, declaredType = null }) {
  /* R17 (G170): the file's name and the type its sender declared go to `detectFormat` beside the bytes (format-registry R31's name pass) */
  const fileName = typeof name === "string" && name ? name : null;
  const sourceCt = ct;
  let declared0 = (typeof declaredType === "string" && declaredType ? declaredType : null) || ct || null;
  const pv = view || { view: undefined, ids: null };
  let profileText = "", profileBytes = null, textEncoding = null;
  if (profilesAsText(ct, total, multipart)) {
    try {
      const pobj = await ev.get(sha);
      if (pobj) {
        profileBytes = new Uint8Array(await pobj.arrayBuffer());
        /* R17 (G174; K5001): on a fetch as on an upload (capture R107), a declared text type over bytes the one rule (`textTypeOf`, R102) judges not text
           contradicts the bytes: it decides neither the format nor the text content type. The source's own statement stays recorded as `source_content_type`. */
        if (origin === "fetch" && textTypeOf({ bytes: profileBytes, type: ct }) === null) {
          profileBytes = null; ct = null; headers = { ...headers }; delete headers["content-type"];
          if (declared0 && profilesAsText(declared0, 0, false)) declared0 = null;
        }
      }
      if (pobj && profileBytes) {
        /* R120: one decode for an upload, a fetch and a part; a text it cannot decode is stated, never replacement characters with no failure */
        const d = decodeAs(profileBytes, (headers && typeof headers["content-type"] === "string" && headers["content-type"]) || ct, { kind: /html/i.test(ct || "") ? "html" : /xml/i.test(ct || "") ? "xml" : undefined });
        if (d.ok) { profileText = d.text; textEncoding = { encoding: d.encoding, assumed: d.assumed, replaced: d.replaced, replaced_ratio: d.replaced_ratio }; }
        else { profileBytes = null; textEncoding = { failure: "ENCODING_UNSUPPORTED", name: d.name ?? null }; }
      }
    } catch { /* an unreadable primary is not a failed capture */ }
  }
  /* COFF-1, R17 (K659): magic bytes first, from the stored bytes read back WHOLE up to ODF_DIGEST_MAX when not already
     read, so an office package (whose central directory lies at its end) is judged from its bytes, and the same bytes
     serve its container digest below; the declared type only for a multipart, oversized or unreadable primary, with
     the absence stated. */
  let formatBytes = profileBytes, readWhole = null;
  if (!formatBytes && !multipart && total > 0 && total <= ODF_DIGEST_MAX) {
    try { const fobj = await ev.get(sha); if (fobj) formatBytes = readWhole = new Uint8Array(await fobj.arrayBuffer()); }
    catch { /* detection falls back to the declared content type */ }
  }
  const profCtx = { headers, locator, content_type: ct || null, text: profileText };
  const stackId = identify(profCtx);
  const docType = doctypeFor({ ...profCtx, handler: stackId.handler, kind: stackId.kind, ...(pv.view ? { view: pv.view } : {}),
                               ...(origin ? { origin } : {}) });
  const profile = {
    ...profileRecord(stackId, { now: retrieved }),
    content_type: docType.type.key, content_type_label: docType.type.label, content_type_version: docType.type.version,
    content_type_confidence: docType.confidence, content_type_signals: docType.signals, contract: docType.type.contract || null,
    normalised: (typeof stackId.handler.rules === "function" ? stackId.handler.rules(profCtx) : []).map((r) => ({ region: r.region, label: r.label })),
    boundary: !!(typeof stackId.handler.boundary === "function" && stackId.handler.boundary(profCtx)),
    source_content_type: sourceCt || null,
    profiled_from_text: !!profileText,
    ...(textEncoding ? { text_encoding: textEncoding } : {}),
    /* R17 (N3, N10): which jurisdiction view the content type was judged under. */
    jurisdiction_view: pv.ids,
    format: detectFormat(formatBytes, declared0, fileName),
  };
  /* R101 (fix round 9, G130c; amends R17): a capture held in several parts, or whole past the bytes read back, is judged from RANGE READS of its head and of its
     tail, never from a 1 KiB prefix alone: `format-registry.detectFormat` over a range source reads the head for the signatures (an image before a PDF or a web
     page) and, for a container, the end record and the central directory, so an office or OpenDocument file of any size is its own format and a plain ZIP is
     `zip` only from the bytes (a declared type never makes one). The reads are `readRangeOf`'s, the one reader behind `readRange` (R113); the caller's `firstPart`
     serves a read inside it. Bytes of no known format keep the declared type with the absence stated, else `undetermined`; a part that is not there, or a store
     that cannot read, is stated and `unread.reason` is set (the profile is never failed). */
  if (!formatBytes && total > 0 && (multipart || total > ODF_DIGEST_MAX || (Array.isArray(parts) && parts.length))) {
    let held = firstPart instanceof Uint8Array && firstPart.length ? firstPart : null;
    const reader = rangeReaderOf(ev, sha, Array.isArray(parts) && parts.length ? parts : null);
    const src = { size: total, readRange: async (o, n) => {
      if (held && o + n <= held.length) return held.subarray(o, o + n);   // a read inside the head already held is not asked of the store again
      const r = await reader(o, n);
      if (r instanceof Uint8Array && o === 0 && r.length > (held ? held.length : 0)) held = r;
      if (r instanceof Uint8Array) return r;
      if (unread && r && r.reason && r.reason !== "NOT_HELD") unread.reason = String(r.reason).slice(0, 120);
      return new Uint8Array(0);
    } };
    let byBytes = null;
    try { byBytes = await detectFormat(src, null, fileName); } catch { byBytes = null; }
    /* a bare `text` from the bytes says only that they are valid text, so a declared type that names a format stands over it, as it does for a buffer read whole */
    if (isSignature(byBytes) || (isNamedKind(byBytes) && !declared0)) profile.format = byBytes;
    else {
      /* no signature in the bytes: the declared type, as before, from the head that was read (a ZIP is never made by a declared type) */
      let declared = null;
      try { const head = await src.readRange(0, FORMAT_HEAD); declared = detectFormat(head.length ? head : null, declared0, fileName); } catch { declared = null; }
      profile.format = declared && declared.format === "zip"
        ? { format: "undetermined", confidence: "none",
            signals: [...(declared.signals || []), localize("acquisition.index.the_stored_bytes_were_not", "the stored bytes were not read as a ZIP archive, so the declared type does not make one")] }
        : declared || profile.format;
    }
  }
  /* R138: an unlisted type is held and named, its reading owed */
  if (profile.format && profile.format.format === "unlisted") profile.held_unread = heldUnreadOf(profile.format);
  let containerBytes = null;
  const odfFmt = profile.format && ODF_FORMATS.includes(profile.format.format);
  if (!profileBytes && !multipart && odfFmt && total > 0 && total <= ODF_DIGEST_MAX) containerBytes = readWhole;
  profile.digests = await substanceDigests(profileBytes, stackId, profCtx, sha, multipart, containerBytes);
  return profile;
}

/** R108 (fix round 6, G19; K4571 S10): WHAT OF A PAGE'S SUPPORTING FILES WAS KEPT, STATED. `supporting: {kept, skipped, total, reasons}` from the
 *  records this module already holds: the walk's (`subs.subresources`, each `{ok, reason, cap | budgetBytes}`) and the render's (`render.subresources`,
 *  each a loaded file whose digest is `undetermined` with a `digest_reason` when its bytes were not kept). `reasons` is `[{reason, count, limit?,
 *  detail?}]`, one for each distinct reason a file was not kept, most first; `limit` is the cap's or the budget's figure; `detail` the renderer's own
 *  words. A walk that was asked for and not made (`notWalked`: the page over 8 MiB or in parts, the primary unreadable, the session gone, the render
 *  still pending) adds `not_walked` with its reason. Absent (null) when no walk or render was asked for or recorded, and for a page that has no
 *  supporting files to speak of (`NOT_HTML`). Pure; never throws. */
export function supportingOf({ subs = null, render = null, notWalked = null } = {}) {
  try {
    let kept = 0, total = 0, pictures = 0, pictureBytes = 0;
    const why = new Map();
    /* R119 (G138, S15): a picture kept as bytes is never read; the count and size are stated so the document says "N pictures kept, not read" */
    const picture = (r, type, ct) => {
      if (!(/^image$/i.test(String(type || "")) || /^image\//i.test(String(ct || "")))) return;
      if (!Number.isFinite(r && r.bytes)) return;
      pictures++; pictureBytes += r.bytes;
    };
    const note = (reason, extra = {}) => { const g = why.get(reason) || { reason, count: 0, ...extra }; g.count++; why.set(reason, g); };
    if (subs && Array.isArray(subs.subresources))
      for (const r of subs.subresources) {
        total++;
        if (r && r.ok) { kept++; picture(r, r.kind, r.content_type); continue; }
        const limit = r && Number.isFinite(r.cap) ? r.cap : r && Number.isFinite(r.budgetBytes) ? r.budgetBytes : undefined;
        note(String(r && r.reason || "NOT_KEPT"), limit !== undefined ? { limit } : {});
      }
    if (render && Array.isArray(render.subresources))
      for (const r of render.subresources) {
        total++;
        if (r && r.sha256 && r.sha256 !== "undetermined") { kept++; picture(r, r.type, null); continue; }
        note("BODY_NOT_KEPT", typeof (r && r.digest_reason) === "string" ? { detail: r.digest_reason } : {});
      }
    const stopped = notWalked && notWalked.reason && notWalked.reason !== "NOT_HTML" ? String(notWalked.reason) : null;
    if (!total && !stopped) return null;
    return { kept, skipped: total - kept, total,
             reasons: [...why.values()].sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : 1)),
             ...(stopped ? { not_walked: stopped } : {}),
             ...(pictures ? { pictures_unread: { count: pictures, bytes: pictureBytes } } : {}) };
  } catch { return null; }
}

/* The answer's `subresources`, `snapshot` and `files` (R19). */
function snapshotOf(subs, sessionId, name, shellRecorded) {
  if (!subs) return shellRecorded ? { files: { [shellRecorded.file]: shellRecorded.sha256 } } : {};
  return {
    subresources: subs.subresources,
    snapshot: {
      manifest_file: "data/snapshot-manifest.json", manifest_sha256: subs.manifestSha,
      render_file: `snapshots/${name}.render.html`, render_sha256: subs.companionSha,
      discovered: subs.discovered, attempted: subs.attempted, truncated: subs.truncated,
      fetched: subs.manifest.counts.fetched, failed: subs.manifest.counts.failed, refused: subs.manifest.counts.refused,
      scripts_held_unreferenced: subs.manifest.counts.scripts_held_unreferenced,
      complete: subs.manifest.complete, outstanding: subs.manifest.outstanding, platform: subs.manifest.platform,
      reuse: subs.manifest.reuse, part_fetch_spread: subs.manifest.part_fetch_spread, compute: subs.manifest.compute,
      ...(subs.resumeState ? { continuation: {
        session: sessionId, outstanding: subs.manifest.outstanding, ticks: subs.session ? subs.session.ticks : 1,
        how: localize("acquisition.index.call_op_acquire_again_with", "call op=acquire again with {how} to pick up the outstanding parts; the primary is already complete and is never re-fetched", { how: '{continue: "<session>"}' }) } } : {}),
      ...(subs.siteRecord ? { site: subs.siteRecord } : {}),
      ...(subs.limitRecord ? { limit_recorded: subs.limitRecord } : {}),
    },
    files: { [`snapshots/${name}.render.html`]: subs.companionSha, "data/snapshot-manifest.json": subs.manifestSha,
             ...(shellRecorded ? { [shellRecorded.file]: shellRecorded.sha256 } : {}) },
  };
}

/** The page's links, handed to the store under the capture they were read from (capture R27). */
function fileLinks(cap, { sha, retrieved, links }) {
  if (!links || !links.length) return;
  cap.recordLinks({ sourceCapture: sha, capturedAt: retrieved,
    links: links.filter((l) => l.address).map((l) => ({
      ref: l.ref, address: l.address, address_norm: normalizeAddress(l.address),
      citation_norm: l.citation || normalizeCitation(l.address), fragment: l.fragment || null,
      type: l.type, origin: l.origin, chrome: l.chrome === true, chrome_basis: l.chrome_basis || null })) });
}

/** R19: the walk of a page's supporting files, over the primary READ BACK from the store (the parser sees the bytes
 *  the record holds, never a copy in flight beside them). Every bookkeeping write after it is stated or ignored,
 *  never a failed capture. */
async function walkSubresources(cap, { ev, sha, total, multipart, ct, name, locator, base, retrieved, resume, sessionId, own = null, openedBy = null, owe = null, linksOnly = false }) {
  const SUB_PARSE_MAX = 8 * 1024 * 1024;
  if (multipart || total > SUB_PARSE_MAX)
    return { subs: null, skipped: { reason: "TOO_LARGE_TO_PARSE", detail:
      localize("acquisition.index.subresource_capture_reads_the_primary", "subresource capture reads the primary back into memory to parse it, so it is bounded to {SUB_PARSE_MAX} bytes; this document is {total}", { SUB_PARSE_MAX: String(SUB_PARSE_MAX), total: String(total) }) } };
  if (detectFormat(null, ct || null).format !== "html")
    return { subs: null, skipped: { reason: "NOT_HTML", content_type: ct || null, detail:
      "only an HTML page has subresources; the capture is unaffected and complete" } };
  let obj = null;
  try { obj = await ev.get(sha); } catch { obj = null; }
  if (!obj) return { subs: null, skipped: { reason: "PRIMARY_UNREADABLE", detail: localize("acquisition.index.the_primary_capture_did_not", "the primary capture did not read back") } };
  const primaryBytes = new Uint8Array(await obj.arrayBuffer());
  /* R123: the page's links alone. The same parse and classification as the walk, with a fanout of none, so no reference is
     fetched and nothing is stored (the companion is not kept); the links are filed as the walk files them. */
  if (linksOnly) {
    try {
      const only = await captureSubresources({
        cap: 0, html: (decodeAs(primaryBytes, ct, { kind: "html" }).text ?? ""), base, primarySha: sha, primaryFile: `snapshots/${name}`,
        isPublic: isPublicHttpsLocator, sha256: sha256Hex,
        put: async () => ({ existed: true }),
        fetchOne: async () => { throw new Error("links alone fetch nothing"); },
      });
      fileLinks(cap, { sha, retrieved, links: only.links });
    } catch { /* an unfiled link is not a failed capture */ }
    return { subs: null, skipped: null, sessionId: null };
  }
  /* capture R23: the platform's ceiling as last OBSERVED, discarded every so often (probeDue) to run to refusal again. */
  let limit = null;
  try { limit = cap.captureLimit("subrequests"); } catch { limit = null; }
  const useCeiling = limit && limit.observed && !limit.probeDue ? limit.observed : null;
  /* What this host has served before: a furniture asset seen SERVED within the freshness window on at least two
     distinct PAGES is reused at zero fetch cost, and every reuse is recorded as one. */
  let baseHost = null;
  try { baseHost = new URL(base).hostname.toLowerCase(); } catch { baseHost = null; }
  let siteKnown = {};
  if (baseHost) { try { siteKnown = cap.siteAssets({ host: baseHost }).assets || {}; } catch { siteKnown = {}; } }
  const env = cap.env || {};
  const subs = await captureSubresources({
    platformCeiling: useCeiling, resume,
    siteLookup: baseHost ? async (norm) => siteKnown[norm] || null : null,
    readBack: async (sh) => { const o = await ev.get(sh); return o ? new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(await o.arrayBuffer())) : null; },
    html: (decodeAs(primaryBytes, ct, { kind: "html" }).text ?? ""),
    base, primarySha: sha, primaryFile: `snapshots/${name}`,
    isPublic: isPublicHttpsLocator, sha256: sha256Hex,
    put: async (s, b) => { if (await ev.head(s)) return { existed: true }; await ev.put(s, b); return { existed: false }; },
    fetchOne: async (u) => {
      /* D-95, the subresource case: a PERSON'S browser bursts a page's assets, so they ride the primary's admission,
         take a small jittered stagger, and REPORT every outcome; a host cooling off stops the rest. */
      let subHost = null;
      try { subHost = new URL(u).host; } catch { /* refused below by the fetch itself */ }
      /* R42: a supporting file on one of the group's own hosts is that file's outcome; the capture goes on. */
      if (onOwnHost(u, own)) return { ok: false, status: 0, reason: "OWN_HOST_REFUSED" };
      if (subHost && cap.governor) {
        try { if (await cap.governor.isHeld(subHost, instantOf(cap))) return { ok: false, status: 0, reason: "HOST_COOLING_OFF" }; }
        catch { /* an unreadable governor never blocks */ }
      }
      const stagger = cap.subresourceStaggerMs();
      if (stagger) await new Promise((s) => setTimeout(s, stagger));
      /* R42: with the group's own hosts named, a redirect is followed by hand and never to one of them. */
      let r = await fetch(u, { redirect: own ? "manual" : "follow", headers: { "user-agent": userAgent(env, "acquire") } });
      for (let hop = 0, at = u; own && r.status >= 300 && r.status < 400 && hop < REDIRECT_MAX; hop++) {
        let next = null;
        try { next = new URL(r.headers.get("location") || "", at).href; } catch { next = null; }
        if (!next || !isPublicHttpsLocator(next)) break;
        cancelBody(r);
        if (onOwnHost(next, own)) return { ok: false, status: 0, reason: "OWN_HOST_REFUSED" };
        at = next;
        r = await fetch(next, { redirect: "manual", headers: { "user-agent": userAgent(env, "acquire") } });
      }
      if (subHost && cap.governor) {
        try { await cap.governor.governorReport({ host: subHost, status: r.status, retry_after_ms: retryAfterMs(r.headers.get("retry-after")) }); }
        catch { /* an unrecorded outcome is not a failed fetch */ }
      }
      if (!r.ok) return { ok: false, status: r.status, reason: "SOURCE_REFUSED" };
      return { ok: true, status: r.status, bytes: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get("content-type") || "" };
    },
  });
  /* Report what the run learned, INCLUDING learning nothing. */
  try { subs.limitRecord = cap.recordCaptureLimit({ runtime: "subrequests", observed: subs.manifest.platform.observed_ceiling }); }
  catch { /* not a capture failure */ }
  /* Park what is left, or clear the session when nothing is: a finished capture leaves no row saying otherwise. */
  let sid = sessionId;
  if (subs.resumeState) {
    sid = sid || `cs_${sha.slice(0, 16)}_${Date.now().toString(36)}`;
    /* R19, R46 (T50): the member whose member session's `acquire` parked this session is recorded with it, in its state
       under `opened_by`; a session parked by any other caller records none. */
    const state = typeof openedBy === "string" && openedBy ? { ...subs.resumeState, opened_by: openedBy } : subs.resumeState;
    try { subs.session = cap.saveCaptureSession({ session: sid, locator, primarySha: sha, primaryFile: `snapshots/${name}`, base, state,
                                                  ...(owe ? { ttlMs: OWED_SESSION_TTL_MS } : {}), at: instantOf(cap) }); }
    catch { /* the caller starts over; the capture did not fail */ }
    /* R100: what is outstanding is owed work, finished by the plane's alarm and never ended by the session's hour */
    if (owe && subs.session) await owe({ kind: "subresources", sha, session: sid });
  } else if (sid) {
    try { cap.dropCaptureSession({ session: sid }); } catch { /* harmless */ }
  }
  /* capture R55 (K98, K99): the compute measurement is handed to the listeners (instance-setup's); this module writes no
     runtime observation itself, and `snapshot.compute` is unchanged. */
  try {
    await cap.emit("compute", { metric: "capture_work_bytes", value: subs.manifest.compute.work_bytes,
      detail: localize("acquisition.index.work_calls_compute_calls_over", "{work_calls} compute calls over {work_bytes} bytes; {fetched} fetched, {discovered} discovered", { work_calls: String(subs.manifest.compute.work_calls), work_bytes: String(subs.manifest.compute.work_bytes), fetched: String(subs.manifest.counts.fetched), discovered: String(subs.manifest.discovered) }) });
  } catch { /* an unfiled measurement is not a failed capture */ }
  /* The links, anchors included (an in-page anchor is an element reference into this document). */
  try { fileLinks(cap, { sha, retrieved, links: subs.links }); }
  catch { /* an unfiled link is not a failed capture */ }
  /* The change case matters most: different bytes at a known address put every earlier reuse into question. */
  if (baseHost && subs.siteObservations && subs.siteObservations.length) {
    try { subs.siteRecord = cap.recordSiteAssets({ host: baseHost, primarySha: sha, observations: subs.siteObservations }); }
    catch { /* likewise */ }
  }
  return { subs, skipped: null, sessionId: sid };
}

/** R5, R6, R12 (T51; C13): finish a capture whose render was still pending when it was filed. The render begun by the first call
 *  is waited for (up to `RENDER_WAIT_MS` or the caller's `renderWaitMs`): still running, the capture is answered as it is, the
 *  session kept; returned, the capture is run again with the render's own answer, which files the pair (the rendered document
 *  the primary, the page as it was served beside it) without a second render, a second reservation or a second charge. A render
 *  the object lost is rendered again, admitted and paid for as any render. The session is dropped once the pair is answered or
 *  the render has failed (`RENDER_FAILED`, the page filed first standing). */
async function finishRender(cap, { session, opts, t, inRequest = false }) {
  const { cls = null, storeName = "bio", renderWaitMs = undefined } = opts || {};
  const rp = session.state.render_pending;
  const held = PENDING_RENDERS.get(session.session);
  /* R117: the answer the run wrote into the session's row when it returned, found by an object that restarted since */
  const persisted = !held && rp && rp.answer && typeof rp.answer === "object" ? rp.answer : null;
  const pendingAnswer = () => ({ status: 200, body: { ok: true, existed: true,
    continued: { session: session.session, primary: { sha256: session.primarySha, file: session.primaryFile, locator: session.locator },
                 note: word("acquisition.note.continuation_files_new") },
    render: { state: "pending", session: session.session }, store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE } });
  /* R106 (fix round 6, G3): A MEMBER'S "FINISH IT" RENDERS NOTHING IN THE REQUEST. With the plane's ledger handed in, the press looks at the run
     it holds with no wait: one that has returned is finished below (the document is answered, as before); any other case (a run still
     going, one the object lost when it restarted, one begun by a request that has ended) registers the session's owed row again, due now,
     and answers at once that the render is pending. The alarm's `owedRun` finishes it (the render, however long it takes, is its work, not
     the door's 25 s) and delivers the document. With no ledger handed in, or one that refuses the entry, nothing else could finish it,
     and the press waits and renders as it always did. */
  let rearmed = false;
  if (inRequest) {
    const owe = oweOf(cap, opts);
    if (owe) {
      const settled = held ? await timed(t, "render", () => within(held.run, 0)) : persisted ? { done: true, value: persisted } : { done: false };
      if (!settled.done) {
        rearmed = await owe({ kind: "subresources", sha: session.primarySha, session: session.session });
        if (rearmed) return pendingAnswer();
      }
    }
  }
  /* R99 (fix round 4, C13b): a held run is trusted only as long as a live render can take (the renderer's own bound, reserved at
     admission, plus the wait): one not settled after that was begun by a request that has ended, and is lost. */
  const staleMs = opts && Number.isFinite(opts.renderStaleMs) ? opts.renderStaleMs : renderReserveMs(RENDER_DEFAULTS) + RENDER_WAIT_MS;
  const stale = !!held && instantOf(cap) - held.since >= staleMs;
  let resume = null, lost = !held && !persisted;
  if (held || persisted) {
    const got = held ? await timed(t, "render", () => within(held.run, stale ? 0 : (renderWaitMs ?? RENDER_WAIT_MS))) : { done: true, value: persisted };
    if (got.done) {
      resume = { answer: got.value };
      /* G27: a render kept in the record whose page the record no longer holds (another store's, or purged) is lost like one the object lost */
      if (got.value && got.value.kept === true) {
        let there = false;
        try { const ev = cap.core && typeof cap.core.evidenceStore === "function" ? cap.core.evidenceStore() : null; there = !!(ev && await ev.head(got.value.rsha)); } catch { there = false; }
        if (!there) { resume = null; lost = true; PENDING_RENDERS.delete(session.session); }
      }
    }
    else if (!stale) return pendingAnswer();
    else { lost = true; PENDING_RENDERS.delete(session.session); }
  }
  /* A render begun afresh is waited for to the renderer's own bound and is final: it files the pair, or is refused in words and the session closes. */
  const out = await acquireRun(cap, { ...(rp && rp.body && typeof rp.body === "object" ? rp.body : {}), locator: session.locator, render: true },
                               { ...opts, renderResume: resume, ...(lost ? { renderFinal: true, renderWaitMs: renderReserveMs(RENDER_DEFAULTS) + 2000 } : {}) }, t);
  if (out.status === 200 || (out.body && out.body.reason === "RENDER_FAILED")) {
    /* R100: the alarm's own run keeps the session until the rendered document is delivered (`owedRun`) */
    if (!(opts && opts.keepSession)) {
      /* R104 (fix round 5, E8): a member's call that completes the render answers the document, and that answer is the only thing that
         carries it to the record; when the caller never files it (the door's bound passed, the tab closed) the copy would be lost. With the
         plane's ledger handed in, the session stays, owing the finished document, until `owedRun` has seen it filed or delivered it. */
      const owing = out.status === 200 && out.body && out.body.document && oweOf(cap, opts);
      let kept = false;
      if (owing) {
        try {
          const state = { queue: [], ...(session.state && typeof session.state.opened_by === "string" ? { opened_by: session.state.opened_by } : {}),
                          render_done: { sha256: out.body.document.capture.sha256, since: stampSecond(instantOf(cap)), document: out.body.document } };
          const saved = cap.saveCaptureSession({ session: session.session, locator: session.locator, primarySha: session.primarySha,
            primaryFile: session.primaryFile, base: session.base, state, ttlMs: OWED_SESSION_TTL_MS, at: instantOf(cap) });
          kept = !!(saved && saved.saved !== false);
        } catch { kept = false; }
      }
      if (!kept) { try { cap.dropCaptureSession({ session: session.session }); } catch { /* harmless */ } }
    }
    PENDING_RENDERS.delete(session.session);
  }
  return out;
}

/** R12: a continuation resumes the session's outstanding supporting files against the session's OWN primary, read
 *  back from the store by its digest; the primary is not fetched again, and nothing new is filed about it, so the
 *  answer carries no document: the first tick answered it. */
async function continueCapture(cap, { body, session, cls, storeName, ev, own = null, t, owe = null }) {
  const name = String(session.primaryFile || "snapshots/capture").replace(/^snapshots\//, "");
  let obj = null;
  try { obj = await ev.head(session.primarySha); } catch { obj = null; }
  const size = obj && Number.isFinite(Number(obj.size)) ? Number(obj.size) : 0;
  const w = await timed(t, "subresources", () => walkSubresources(cap, { ev, sha: session.primarySha, total: size, multipart: false, ct: "text/html",
    name, locator: session.locator, base: session.base, retrieved: stampSecond(instantOf(cap)), resume: session.state, sessionId: session.session, own,
    /* R19: a session parked again keeps the member who began it, whoever continues it */
    openedBy: session.state && typeof session.state.opened_by === "string" ? session.state.opened_by : null, owe }));
  return { status: 200, body: {
    ok: true, existed: true,
    continued: { session: session.session, primary: { sha256: session.primarySha, file: session.primaryFile, locator: session.locator },
                 note: word("acquisition.note.continuation_files_new") },
    ...snapshotOf(w.subs, w.sessionId, name, null),
    ...(w.skipped ? { subresources_skipped: w.skipped } : {}),
    ...(supportingOf({ subs: w.subs, notWalked: w.skipped }) ? { supporting: supportingOf({ subs: w.subs, notWalked: w.skipped }) } : {}),
    store: storeName, tokenClass: cls, note: ACQUIRE_GRADE_NOTE } };
}

/** R100 (fix round 4b, F5; plane R77): the plane's alarm runs a `subresources` entry of its owed-work ledger,
 *  `owedRun(store, {kind: "subresources", session}, opts)`: the capture session's outstanding supporting files are fetched as a
 *  member's `continue` fetches them (R12, past R1's gate: the entry is the capture's own continuation, begun by a caller R1
 *  admitted), and a pending render is finished (afresh when the object lost the run, R99) and its document handed to
 *  `opts.deliver({answer, session})`, the plane's promotion of it beside its shell, because no file of the record is written
 *  here (R25); with no `deliver` a pending render is not begun and the session stays for the member's "Finish it". Answers
 *  `{ok: true, done, outstanding?, reason?, final?}`: `done` ends the entry (also for a session that is gone, `reason`
 *  `NO_SUCH_SESSION`, there being nothing left to do); `done: false` is more to do, run again after the ledger's back-off;
 *  `final: true` with a `reason` ends it with a stated reason (`RENDER_FAILED`, `NOT_A_PAGE`). A throw is `{ok: false, reason}`:
 *  the entry stays. The session is dropped when its work is done. */
export async function owedRun(cap, entry, opts = {}) {
  try {
    if (!entry || entry.kind !== "subresources" || typeof entry.session !== "string" || !entry.session)
      return { ok: false, reason: "OWED_MALFORMED" };
    const ld = cap.loadCaptureSession({ session: entry.session });
    if (!ld || !ld.found) return { ok: true, done: true, reason: "NO_SUCH_SESSION" };
    const ev = cap.core && typeof cap.core.evidenceStore === "function" ? cap.core.evidenceStore() : null;
    if (!ev) return { ok: false, reason: "EVIDENCE_STORAGE_NOT_CONFIGURED" };
    const t = openTimings(opts && opts.timings);
    const run = { ...(opts || {}), cls: null, member: false, sessMember: null };
    try {
      /* R104: a visitor copy a member's call finished and answered. Filed (the register holds its digest) it is done; else it is delivered
         as a finished render is, and the session goes once it is. */
      if (ld.state && ld.state.render_done && typeof ld.state.render_done === "object") {
        const done = ld.state.render_done;
        let filed = false;
        try { const h = await cap.provenance?.registerHolds?.({ sha: done.sha256 }); filed = !!(h && h.registered === true); } catch { filed = false; }
        if (!filed) {
          if (typeof opts.deliver !== "function") return { ok: true, done: false, outstanding: 1, reason: "DELIVERY_NOT_HANDED" };
          const given = await opts.deliver({ answer: { ok: true, document: done.document }, session: entry.session });
          if (!(given && given.ok === true)) {
            /* R111 (G105): a refusal no later try changes ends the copy's entry, stated; any other goes again */
            const why = refusalOf(given);
            if (DELIVERY_FINAL.includes(why)) { try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ } return withFacts({ ok: true, done: true, final: true, reason: why }, given); }
            return { ok: true, done: false, outstanding: 1, reason: why };
          }
        }
        try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ }
        return { ok: true, done: true };
      }
      if (ld.state && ld.state.render_pending) {
        if (typeof opts.deliver !== "function") return { ok: true, done: false, outstanding: 1, reason: "DELIVERY_NOT_HANDED" };
        const out = await finishRender(cap, { session: ld, opts: { ...run, keepSession: true }, t });
        const b = out && out.body ? out.body : {};
        if (b.ok === false) {
          /* R118: a render that failed for a cause that may pass (`transient`, after its tries in the call) goes again with the ledger's back-off; a permanent one is final */
          if (b.reason === "RENDER_FAILED" && b.failure_class === "transient")
            return { ok: true, done: false, outstanding: 1, reason: "RENDER_FAILED", ...(typeof b.detail === "string" && b.detail ? { detail: b.detail.slice(0, 200) } : {}) };
          const stated = b.reason === "RENDER_FAILED" || b.reason === "RENDER_NOT_A_PAGE";
          if (stated) { try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ } }
          /* R100 (fix round 7, G72): the entry ends with the reason AND the detail the refusal carried (the render's problem, cut to a bound; the renderer's words, no page) */
          const detail = typeof b.detail === "string" && b.detail ? b.detail.slice(0, 200) : undefined;
          return stated ? { ok: true, done: true, final: true, reason: b.reason, ...(detail ? { detail } : {}) } : { ok: true, done: false, outstanding: 1, reason: b.reason || "RENDER_NOT_FINISHED" };
        }
        if (!b.document) return { ok: true, done: false, outstanding: 1, reason: "RENDER_PENDING" };
        const given = await opts.deliver({ answer: b, session: entry.session });
        if (!(given && given.ok === true)) {
          /* R111 (G105): as for a finished copy above */
          const why = refusalOf(given);
          if (DELIVERY_FINAL.includes(why)) { try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ } return withFacts({ ok: true, done: true, final: true, reason: why }, given); }
          return { ok: true, done: false, outstanding: 1, reason: why };
        }
        try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ }
        return { ok: true, done: true };
      }
      const out = await continueCapture(cap, { body: {}, session: ld, cls: null, storeName: opts.storeName || "bio", ev, own: ownHostsOf(cap, opts.ownHosts), t,
                                               owe: async () => true });
      const b = out && out.body ? out.body : {};
      if (b.subresources_skipped) {
        const why = String(b.subresources_skipped.reason || "SKIPPED");
        if (why === "PRIMARY_UNREADABLE") return { ok: true, done: false, reason: why };
        try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ }
        return { ok: true, done: true, final: true, reason: why };
      }
      const left = b.snapshot && Number.isFinite(b.snapshot.outstanding) ? b.snapshot.outstanding : 0;
      if (left > 0) return { ok: true, done: false, outstanding: left };
      /* capture keeps a session until it is dropped (K4489): the end of the work is a drop, whoever ended it */
      try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ }
      return { ok: true, done: true };
    } finally { stageEnd(t); }
  } catch (e) { return { ok: false, reason: "OWED_RUN_FAILED", detail: String(e && e.message || e).slice(0, 200) }; }
}

/** R105 (fix round 6, G2; K4562; plane R77's `fetch` kind): the plane's alarm runs a `fetch` entry of its owed-work ledger,
 *  `owedFetch(cap, {kind: "fetch", session}, opts)`: the capture the member asked for, parked because its body was large or slow,
 *  is made now, as the member's own `acquire` would have made it (their stamps and the body they sent are the session's), read whole
 *  with no bound but the alarm's, and its document is handed to `opts.deliver({answer: {ok, existed, document}, session})`, the
 *  plane's promotion of it under the project the session names (no file of the record is written here, R25); with no `deliver` nothing
 *  is fetched. A document made but not delivered is kept in the session (`fetch_done`) and delivered by the next run, never fetched
 *  twice. When the delivery is accepted the session is dropped (what the delivery records, `capture`'s `recordFetchDone`, is the
 *  caller's: it reads the session in `deliver`, before this drop). Answers `{ok: true, done}` (`done` ends the entry; a session that is gone is `done` with `reason` `NO_SUCH_SESSION`), `{ok: true, done: false,
 *  outstanding: 1, reason}` for a try that goes again after the ledger's back-off (a source that was busy or broke off, a delivery
 *  refused), `{ok: true, done: true, final: true, reason}` for a refusal no later try changes (the source refused it, it is over what
 *  this surface captures): the session then stays, stating `fetch_pending.failed`, for the member to read. A throw is `{ok: false,
 *  reason}`: the entry stays. */
/* R111 (fix round 8, G105): THE REFUSALS OF A DELIVERY NO LATER TRY CHANGES. The delivery (control-plane's `deliverOwedRender`) answers `{ok: false, reason}` with the
   code of the record's refusal. These end the entry final and are stated (the session's `fetch_pending.failed`, the ledger row's `why`): the bytes are held under a
   document the member cannot see (`CAPTURE_HELD_BY_ANOTHER_BUNDLE`, provenance R2), the document is over what a promotion takes (`OVERSIZE_INLINE`, `TOO_LARGE`) or
   the member is no participant of the project it is filed under (`PROMOTE_NOT_A_PARTICIPANT`). Any other refusal, an unnamed one included, is tried again with the
   ledger's back-off. The set is BOB's to amend (a requirement, R111); CHOSEN from the refusals the record's promotion answers, not measured. */
export const DELIVERY_FINAL = Object.freeze(["CAPTURE_HELD_BY_ANOTHER_BUNDLE", "OVERSIZE_INLINE", "TOO_LARGE", "PROMOTE_NOT_A_PARTICIPANT"]);
/* R111: the code a refused delivery carried (`reason`, else `code`), at most 80 characters; "DELIVERY_REFUSED" when it named none. Pure; never throws. */
const refusalOf = (given) => {
  const c = given && typeof given === "object" ? given.reason ?? given.code : null;
  return typeof c === "string" && c !== "" ? c.slice(0, 80) : "DELIVERY_REFUSED";
};
/* R116 (G160): the facts a refusal carried (`kind`, `capture_sha`, `holder`), as the refusing module gave them: from its `detail` when that is a plain object, else from its top level
   (provenance's own shape). `{}` when it named none, and then no `detail` is added. Pure; never throws. */
const refusalFacts = (given) => {
  const out = {};
  if (!given || typeof given !== "object") return out;
  const src = given.detail && typeof given.detail === "object" && !Array.isArray(given.detail) ? given.detail : given;
  for (const k of ["kind", "capture_sha", "holder"]) if (k in src) out[k] = src[k];
  return out;
};
const withFacts = (answer, given) => { const f = refusalFacts(given); return Object.keys(f).length ? { ...answer, detail: f } : answer; };
const FETCH_RETRY = Object.freeze(["HOST_COOLING_OFF", "FETCH_FAILED", "ACQUIRE_FAILED", "CAPTURE_NOT_KEPT", "ARCHIVE_UNREACHABLE", "EVIDENCE_STORAGE_NOT_CONFIGURED"]);
export async function owedFetch(cap, entry, opts = {}) {
  try {
    if (!entry || entry.kind !== "fetch" || typeof entry.session !== "string" || !entry.session) return { ok: false, reason: "OWED_MALFORMED" };
    const ld = cap.loadCaptureSession({ session: entry.session });
    if (!ld || !ld.found) return { ok: true, done: true, reason: "NO_SUCH_SESSION" };
    const st = ld.state && typeof ld.state === "object" ? ld.state : {};
    if (typeof opts.deliver !== "function") return { ok: true, done: false, outstanding: 1, reason: "DELIVERY_NOT_HANDED" };
    const opener = typeof st.opened_by === "string" ? st.opened_by : "";
    const final = (reason, given = null) => withFacts({ ok: true, done: true, final: true, reason }, given);
    if (!opener) return final("NO_OPENER");
    let made = st.fetch_done && typeof st.fetch_done === "object" ? st.fetch_done : null;
    if (!made) {
      if (!st.fetch_pending || st.fetch_pending.failed) return final(String(st.fetch_pending && st.fetch_pending.failed || "NOT_PENDING"));
      const storeName = typeof st.store === "string" && st.store ? st.store : opts.storeName || "bio";
      const out = await acquire(cap, st.body && typeof st.body === "object" ? { ...st.body } : { locator: ld.locator },
        { ...opts, cls: typeof st.cls === "string" ? st.cls : "member", member: true, sessMember: opener, storeName, inlineFetch: true });
      const b = out && out.body ? out.body : {};
      if (!(out.status === 200 && b.ok === true && b.document)) {
        const reason = String(b.reason || `STATUS_${out.status}`).slice(0, 80);
        /* a source that was busy, a body that broke off, a store that was not there: tried again; any other refusal is the answer */
        if (FETCH_RETRY.includes(reason) || (reason === "SOURCE_REFUSED" && (b.status === 429 || b.status >= 500)))
          return { ok: true, done: false, outstanding: 1, reason };
        try {
          cap.saveCaptureSession({ session: entry.session, locator: ld.locator, primarySha: ld.primarySha, primaryFile: ld.primaryFile, base: ld.base,
            state: { ...st, fetch_pending: { ...st.fetch_pending, failed: reason, failed_at: stampSecond(instantOf(cap)) } }, ttlMs: OWED_SESSION_TTL_MS, at: instantOf(cap) });
        } catch { /* the entry still ends, stated */ }
        return final(reason);
      }
      made = { sha256: b.document.capture.sha256, since: stampSecond(instantOf(cap)), answer: { ok: true, existed: b.existed, document: b.document } };
      try {
        cap.saveCaptureSession({ session: entry.session, locator: ld.locator, primarySha: b.document.capture.sha256, primaryFile: b.document.file, base: ld.base,
          state: { queue: [], opened_by: opener, ...(typeof st.project === "string" ? { project: st.project } : {}), cls: st.cls, store: storeName,
                   /* B33: the delivery reads `fetch_pending` to know this was a parked fetch (control-plane records the member's fetch-done by it); saving replaces the state whole, so it is kept */
                   ...(st.fetch_pending && typeof st.fetch_pending === "object" ? { fetch_pending: { since: st.fetch_pending.since, declared_bytes: st.fetch_pending.declared_bytes, why: st.fetch_pending.why } } : {}),
                   fetch_done: made },
          ttlMs: OWED_SESSION_TTL_MS, at: instantOf(cap) });
      } catch { /* delivered below; a failed delivery then fetches again */ }
    }
    const given = await opts.deliver({ answer: made.answer, session: entry.session });
    if (!(given && given.ok === true)) {
      /* R111 (G105): a refusal no later try changes (the bytes are held under a document the member cannot see, a size over the bound) ends the entry final with its
         code, which the session states for the member to read (`fetch_pending.failed`); it is saved in the shape of a fetch that ended before it was made (the queue
         owes the fetch, no `fetch_done`), so it is listed as ended and never as delivering. Any other refusal is tried again with the ledger's back-off, its reason kept. */
      const why = refusalOf(given);
      if (DELIVERY_FINAL.includes(why)) {
        try {
          cap.saveCaptureSession({ session: entry.session, locator: ld.locator, primarySha: ld.primarySha, primaryFile: ld.primaryFile, base: ld.base,
            state: { queue: [{ fetch: true }], opened_by: opener, ...(typeof st.project === "string" ? { project: st.project } : {}), cls: st.cls, store: st.store,
                     fetch_pending: { ...(st.fetch_pending && typeof st.fetch_pending === "object" ? st.fetch_pending : {}), failed: why, failed_at: stampSecond(instantOf(cap)) } },
            ttlMs: OWED_SESSION_TTL_MS, at: instantOf(cap) });
        } catch { /* the entry still ends, stated */ }
        return final(why, given);
      }
      return { ok: true, done: false, outstanding: 1, reason: why };
    }
    try { cap.dropCaptureSession({ session: entry.session }); } catch { /* harmless */ }
    return { ok: true, done: true };
  } catch (e) { return { ok: false, reason: "OWED_FETCH_FAILED", detail: String(e && e.message || e).slice(0, 200) }; }
}

/* R46 (T50; N1094; DEC-240 (D3); K3317): A MEMBER'S OPEN CAPTURES, for Add's "Unfinished". */
export const OPEN_CAPTURES_MAX = 50;
/* R46 (fix round 9, re-walk 8 A, N1; K4853): a session whose fetch ended with a stated refusal is listed for one day after the failure; the session record itself keeps its TTL (the ledger). */
export const FAILED_LISTED_MS = 24 * 60 * 60 * 1000;

/** R46: `openCaptures(store, {by, now}) → {ok: true, captures, truncated}` lists, newest started first, at most
 *  `OPEN_CAPTURES_MAX`, each capture session (capture R22) that has not expired at `now` and was begun by `by`:
 *  `{session, locator, primary_sha, started, updated, expires, outstanding}`. A session is begun by the member whose member
 *  session called `acquire` when R19 parked it (`state.opened_by`; R110: matched with `by` as the member, the viewer's form `member:<id>` and the bare id
 *  naming one, and a fetch made and not yet delivered listed with `fetch_pending.delivering`); one parked by any other caller, or before this
 *  requirement, has no member and is listed for no one, and one whose state cannot be read is not listed. A `by` that is
 *  absent, not a string, blank or a machine identity answers `captures: []`. It lists nothing of another member's, writes
 *  nothing and never throws; a store that cannot answer gives `captures: []`. */
/* R110 (fix round 8, G103): THE MEMBER A SPELLING NAMES, for matching a session's opener with the viewer who asks. The door stamps every declared `by` with the
   viewer's form (`member:<id>`; the founder's is `admin`), while a session stores the id the `acquire` was made for (`opened_by: "<id>"`); both name one member, so
   each is read through member-roster's one viewer predicate (`viewerMember`, the carried project dropped by `baseViewer`) and compared as the member. A spelling it
   does not read as a viewer (the bare id; the founder's bare `admin`) is the member as it stands. Pure; never throws. */
const memberOfSpelling = (v) => {
  if (typeof v !== "string") return null;
  const base = baseViewer(v);
  return viewerMember(base) ?? base;
};

export function openCaptures(store, { by = null, now = undefined } = {}) {
  const none = { ok: true, captures: [], truncated: false };
  try {
    if (typeof by !== "string" || !by.trim() || isMachineIdentity(by) || !store || typeof store.liveCaptureSessions !== "function") return none;
    const nowMs = typeof now === "string" && ISO_TS_RE.test(now) ? Date.parse(now) : Number.isFinite(Number(now)) && now !== null && now !== undefined ? Number(now) : instantOf(store);
    const live = store.liveCaptureSessions(nowMs);
    if (!Array.isArray(live)) return none;
    const mine = [];
    const asking = memberOfSpelling(by);
    for (const s of live) {
      const st = s && s.state;
      if (!st || typeof st !== "object" || typeof st.opened_by !== "string" || memberOfSpelling(st.opened_by) !== asking) continue;
      const queued = Array.isArray(st.queue) ? st.queue.length : 0;
      /* R110 (G104): a fetch the alarm has made and not yet delivered (queue empty, `fetch_done` present) is still owed: listed, as `fetch_pending` marked
         `delivering`, until the delivery drops the session */
      const delivering = queued < 1 && !!st.fetch_done && typeof st.fetch_done === "object";
      const outstanding = delivering ? 1 : queued;
      const expires = Date.parse(s.expires);
      /* a refused fetch is listed for a day after it failed (its own stamp, else the session's last save) */
      if (st.fetch_pending && st.fetch_pending.failed) {
        const failedAt = Date.parse(st.fetch_pending.failed_at ?? s.updated);
        if (Number.isFinite(failedAt) && nowMs - failedAt > FAILED_LISTED_MS) continue;
      }
      if (outstanding < 1 || !(Number.isFinite(expires) && expires > nowMs) || typeof s.session !== "string") continue;
      /* R105: a capture parked as an owed fetch is listed as such (`fetch_pending`: when it began, its declared size, why it is owed, and
         `failed` once the owed fetch ended with a stated refusal), and has no primary yet: its screen words it, and offers no "Finish it" */
      const pending = st.fetch_pending && typeof st.fetch_pending === "object" ? st.fetch_pending
        : delivering ? { since: st.fetch_done.since ?? null, declared_bytes: null, why: null } : null;
      const fetching = pending ? { fetch_pending: delivering ? { ...pending, delivering: true } : pending } : null;
      mine.push({ session: s.session, locator: s.locator ?? null, primary_sha: fetching ? null : s.primarySha ?? null, started: s.created ?? null,
                  updated: s.updated ?? null, expires: s.expires, outstanding, ...(fetching || {}) });
    }
    mine.sort((a, b) => (Date.parse(b.started) || 0) - (Date.parse(a.started) || 0) || (a.session < b.session ? -1 : a.session > b.session ? 1 : 0));
    return { ok: true, captures: mine.slice(0, OPEN_CAPTURES_MAX), truncated: mine.length > OPEN_CAPTURES_MAX };
  } catch { return none; }
}
