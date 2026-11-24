/* control-plane: THE INSTANCE'S DOOR (R1–R123). The Worker's HTTP entry — routing and the stamps (the answer's envelope
   and decoration are `answer-envelope`'s, the store's door `store-door`'s, since the split, K1907, K1974) — moved from legacy-index (`index.mjs`) at control-plane's extraction (T12, K3, K93). Who may call an op is
   `admission`'s and what each op is `op-declarations'` (the split, K617, K624 (2)): this door calls admission's gates in
   R28's order and reads op-declarations' tables. An op's own handler is its module's: `makeFetch(hooks)` takes the
   hooks `plane` composes from the arms' owners (`publicOp` for the unauthenticated ops, `gatedOp` for the admitted ones,
   plane R6) and routes to them, so routing is one place (the map's §3). */
/* The shared grammar this door reads (the front matter, the digest, a type's canonical spelling, the two machine-stamp
   prefixes) is record-grammar's. */
import { createSha256, MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
/* C-68.1 (K794, K796, K850): the capability complaint is acquisition's, minted at its one region (`evidenceStorageAbsent`). */
import { evidenceStorageAbsent, ARCHIVE_CHECKS, FOR_MAX } from "../acquisition/index.mjs";
/* K617, K624 (2): who may call an op is `admission`'s — the namespace gates, the credential's resolution, the admission
   in its order, the bearer fences, the reader of a public op's caller and the mint's secrets — called here in R28's
   order; each gate answers `null`, a refusal `{status, body}` this door answers as given, or a silence. */
import { SCRATCH, classify, scopeFor, namespaceGate, confinedNamespaceGate, pinnedNamespaceGate,
         aiCredentialPresented, admit, bearerFence, readerOf, aiCredentialMint, reviewGrantSecret,
         queryGate, callerViewer } from "../admission/index.mjs";
/* T35 (admission R20–R22; F1, F4, N703; K2044): the credential read once from the header or the body, the public ops'
   window and the caller's source and country, and the security tally of every refusal the door gives or relays. (T36;
   K2111) A credential in the address is refused by admission's gate (its R20, C-38.10), the code's one site. */
import { presentedCredential, doorWindowGate, sourceOf, countryOf, securityTally } from "../admission/index.mjs";
import { credentialAddressGate } from "../admission/index.mjs";
/* answer-envelope (its R1–R8; the split, K1907, K1974): the envelope, its decoration, the store's answer read once, the
   internal-error answer, the row readers, the page policy and the composed catalogue the published fences read (R41). */
import { json, doAnswer, storeRefusal, storeSilent, relayAnswer, planeInternalError, replayRow, requiredArgument,
         installationRow, dispatchRow, withPagePolicy, CHECK_FAMILIES } from "../answer-envelope/index.mjs";
/* R57 (T35): the draft asked of agent-worker once every refusal is answered. */
import { draftDue, draftAsk, checkedDraft, untestedOf, TRANSLATION_DRAFT, TRANSLATION_RECORD, STATUS_REPORT_ASSIST,
         TEXT_CHECK, READ_TRANSLATE, DRAFT_OPS } from "./draft.mjs";
/* R58 (T35): the promotions of what an unpack files. */
import { archiveDocuments, promoteArchive } from "./archive.mjs";
/* R130-R132 (fix round 9): the inline gate (a ceiling is a `READ_BOUNDS` row, quoted) and the registered job row (a failed registration is told) */
import { inlineVerdict, readingVerdict, sizeOfDocument } from "./reading-gate.mjs";
import { jobRegistrar } from "./jobs.mjs";
import { jobStateOf } from "./job-state.mjs";
import { PLATFORM_FIGURES } from "../byte-ledger.mjs";
import { acquireReadingOp } from "../extraction/ops.mjs";
/* R124 (fix round 4b; K4493): the alarm's delivery of an owed render is this door's promotion, built by screens-intake's own builder */
import { CAPTURE_SCREEN } from "../screens-intake/capture.mjs";
import { captureOf } from "../capture/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
/* R75, R81, R82 (T46, T47; N897 (1); K3137): the member interface's page and its assets: interface-shell's page over the
   nine screen modules' screens (R81's order), with screens-wizards' guide in the dock (interface-shell R31), and
   interface-assets' files. */
import { appRouteOf, appPage, appAsset, appScript, logoAsked, addressPageOf } from "./app.mjs";
/* R116 (fix round 2; C15): the interface words kept for the release and compressed */
import { interfaceWordsCache } from "./words-cache.mjs";
/* R121 (fix round 4, C5a, P9): the door's clock, in its own isolate */
import { makeClock, clockedEnv, withClock, withServerTiming } from "./phase-clock.mjs";
import { interfacePage, interfaceScript, interfaceScriptHash, pageWork } from "../interface-shell/index.mjs";
import { ASSET_FILES } from "../interface-assets/index.mjs";
import { SCREENS as ENTRY_SCREENS } from "../screens-entry/index.mjs";
import { SCREENS as SETTINGS_SCREENS } from "../screens-settings/index.mjs";
import { SCREENS as INTAKE_SCREENS } from "../screens-intake/index.mjs";
import { SCREENS as DAILY_SCREENS } from "../screens-daily/index.mjs";
import { SCREENS as INQUIRY_SCREENS } from "../screens-inquiry/index.mjs";
import { SCREENS as WIZARDS_SCREENS, GUIDE as WIZARD_GUIDE } from "../screens-wizards/index.mjs";
import { SCREENS as INVESTIGATE_SCREENS } from "../screens-investigate/index.mjs";
import { SCREENS as PUBLISH_SCREENS } from "../screens-publish/index.mjs";
import { SCREENS as ACTION_SCREENS } from "../screens-action/index.mjs";
const APP_SCREENS = Object.freeze([...ENTRY_SCREENS, ...SETTINGS_SCREENS, ...INTAKE_SCREENS, ...DAILY_SCREENS, ...INQUIRY_SCREENS,
  ...WIZARDS_SCREENS, ...INVESTIGATE_SCREENS, ...PUBLISH_SCREENS, ...ACTION_SCREENS]);
const APP_OPTIONS = Object.freeze({ guide: WIZARD_GUIDE });
/* (T47; K3167) a member's own Claude sign-in, its disconnection, the revocation's sign-out, a refused held token and the
   test instance's trace are signin-door's (its R1–R5, were this module's R65, R78, R85–R87): the door routes to them. */
import { subscriptionSignin, subscriptionDisconnect, leaverOf, signoutLeaver, tokenRefusedSeen, signintrace, mintTrace,
         memberRefOf } from "../signin-door/index.mjs";
/* R95 (T48; K3254; walk C2 (a)): whether this is a test instance is `ai-runs`' own fact (its R78, as `bootstrap` answers
   it), asked of the Worker environment alone. */
import { AiRuns } from "../ai-runs/index.mjs";
/* R99 (T49; K3366, K3368; DEC-257, DEC-258): every member-facing sentence is read by key through setup-words. */
import { word, hasWord, localize } from "../setup-words/index.mjs";
import { machineFences, renderPack } from "../skillpack.mjs";
import { liveToken } from "../tokens.mjs";
import { storeStub } from "../store-place.mjs";
import { instanceGroupOp, groupIdentityOp, groupLogoAsset } from "../setup.mjs";
import { inbandQuartet } from "../inband.mjs";   /* REC-148: DEC-31's in-band quartet, one function */
/* R45 (DEC-111, K1170): a registered public read is served by public-read's door read (its R18). */
import { publicReadDoorRead } from "../public-read/door.mjs";
/* R44 (K921): the template grant's one dead answer is filing-templates' (its R8), built from no argument. */
import { noTemplateGrant } from "../filing-templates/index.mjs";
/* R18: the capability vocabulary `op=whoami` publishes is membership's (N13: no longer read through legacy-store). */
import { Membership } from "../membership/index.mjs";
/* What each op is, and the act lists that drive the stamps (R17), are op-declarations'. */
import { OPS, QUERY_AUTHOR_ACTIONS, TEMPLATE_DOOR_ACTIONS, TEMPLATE_DOOR_READS, NETWORK_NOTICES_PUBLIC_READS } from "../op-declarations/index.mjs";
/* R53 (K1674): the stamps T33's ops declare, op → keys (op-declarations R17–R20); R55 (K1863 (7)): the registry's
   aliases, alias → op (its R21). */
import { OP_STAMPS, OP_ALIASES } from "../op-declarations/index.mjs";
/* R136 (store-request R1, R24): the store's request, the lists it reads and the four ops' shaping are store-request's */
import { innerRequest, promotedTypeOf, BODY_STAMPS, ACT_CLOCK_OPS, CASE_IMPORT_ACTIONS } from "../store-request/index.mjs";
import { agentPackOp, airunDispatchOp, draftCheckOp } from "../store-request/door-ops.mjs";
/* R53 (K1601, K1674): an ask's grant reads only its list (credentials R28). */
import { AI_GRANT_OPS } from "../credentials/index.mjs";

const CASE_CHECKER_PUBLIC_READS = Object.freeze(["casechecker", "casefilespec"]);
/* R49 (T51; K4230; case-inputs R24; public-read R18): case-inputs' credential-free public read `casedetailspublic`, registered at
   the plane's start, routed by its own name through public-read's door read exactly as the case-checker reads are */
const CASE_INPUTS_PUBLIC_READS = Object.freeze(["casedetailspublic"]);

/* R50 (wizard-scripts R16; K1364 B4): A REFUSAL ANSWERED TO A MEMBER'S SESSION IS COUNTED, UNATTRIBUTED. Read off the
   answer on its way out (the two levels R22 decorates): its op and its code, and nothing else of the call, reach the
   store's internal route `wizardrefusaltally` (`dispatch.mjs`), which hands them to `wizard-scripts.tallyRefusal`. A
   count that cannot be written, or an answer that cannot be read, changes nothing the caller receives. */
async function tallySessionRefusal(res, session) {
  if (!session || !res) return;
  try {
    if (!/application\/json/i.test(res.headers.get("content-type") || "")) return;
    const body = await res.clone().json();
    const codeOf = (r) => r && typeof r === "object" && !Array.isArray(r) && r.ok === false
      ? (typeof r.reason === "string" ? r.reason : typeof r.code === "string" ? r.code : null) : null;
    const code = codeOf(body) ?? codeOf(body && body.result);
    if (!code) return;
    await doAnswer(session.stub.fetch(new Request("http://do/wizardrefusaltally", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: session.op, code }) })));
  } catch { /* the tally is status, never a gate */ }
}

/* R128 (fix round 8, G116; queue R94): the Queue runs in the object and cannot hand the door a hook, so its answer states what its marks carry (`derivation`: `served`, and for a
   miss the rows read); the door states them: `queue-count;desc=hit|miss`, and `rows-queue;dur=<rows read>` for a miss. The answer is returned as it came. */
async function liftDerivation(res, clock) {
  try {
    if (!res || !/application\/json/i.test(res.headers.get("content-type") || "")) return res;
    const d = (await res.clone().json())?.result?.derivation;
    if (!d || (d.served !== "hit" && d.served !== "miss")) return res;
    clock.state([{ name: "queue-count", desc: d.served }, ...(d.served === "miss" && Number.isFinite(d.rows_read) ? [{ name: "rows-queue", dur: String(Math.round(d.rows_read)) }] : [])]);
  } catch { /* a measure is status, never a gate */ }
  return res;
}

/* R59 (admission R20, R22; F1, N703; K2044): ON THE WAY OUT. A refusal the door gives or relays, at either of the two
   levels R22 decorates, is handed once to admission's `securityTally`, after the answer is composed; a tally that fails
   never changes the answer. (T36; K2111) No answer carries `deprecated`: a credential in the address is refused. */
async function tallyOnTheWayOut(res, seen, req, env) {
  if (!res || !/application\/json/i.test(res.headers.get("content-type") || "")) return res;
  let body;
  try { body = await res.clone().json(); } catch { return res; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res;
  const refusal = body.ok === false ? body : body.result && typeof body.result === "object" && body.result.ok === false ? body.result : null;
  if (refusal) {
    /* admission R22 (ADMISSION #6, K2166): handed the store and the reader, so the count reaches `securitycount` */
    try { await securityTally({ op: seen.op, answer: refusal, presented: { token: seen.credential?.token ?? null, cred: seen.cred }, req,
                                env, doAnswer }); }
    catch { /* the tally is status, never a gate */ }
  }
  return res;
}

/* R59, R28 (admission R20; F1, K2111): A CREDENTIAL IN THE ADDRESS IS REFUSED, by admission's gate (C-38.10, the code's
   one site), which this door runs directly after admission R1 and before any other gate, public op, owner's door or
   store request; its refusal is relayed as given. */
const addressGate = (url) => credentialAddressGate(url);

/* R95 (T48; K3254; walk C2 (a); interface-shell R58): the page's `testInstance` option, `ai-runs.testInstance()` read over
   this request's environment; a read that throws passes `false`. */
function testInstanceOf(env) {
  try { return AiRuns.prototype.testInstance.call({ env: env || {} }) === true; } catch { return false; }
}
/* R75 (fix round 3, C15; interface-shell R1): the page names the release's script by `version`, the plane's own (`env.VERSION`) */
const appOptions = (env) => ({ ...APP_OPTIONS, testInstance: testInstanceOf(env),
  ...(typeof env?.VERSION === "string" && env.VERSION ? { version: env.VERSION } : {}) });

/* R93 (T48; N1015; K3103; agent-worker R87; plane R55): the requests that reach the plane's ask, run, draft or transcribe
   call: the door mints each one's `trace` and member ref (signin-door R3's form) and hands both to that call in process. */
const TRACED_OPS = Object.freeze(["ask", "airundispatch", "pagetranscribe", ...DRAFT_OPS, TEXT_CHECK, READ_TRANSLATE]);
/* R93: the trace, answered in the request's answer (`interface-shell` R39): a JSON object answer gains `trace`. */
async function withTrace(res, trace) {
  if (!res || !trace || !/application\/json/i.test(res.headers.get("content-type") || "")) return res;
  let body;
  try { body = await res.clone().json(); } catch { return res; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify({ ...body, trace }), { status: res.status, headers });
}

/* REC-22: the ONE namespace the public read path answers from. An instance has
   one published record, so op=publishedcase and op=publishedbytes are pinned
   here exactly as op=verify and op=publishedmanifest are — and a probe's
   `scratch` rehearsal, which lives in a different Durable Object under a
   different PUBLISHED prefix, is therefore unreachable from the public surface. */
const PUBLISHED_STORE = "bio";
/* R105 (K3770): the longest an `acquire` is let run at the door. */
const ACQUIRE_BOUND_MS = 25000;
/* R121: the refusals of an `acquire` that say the capture did not complete, whatever their status */
/* R120: a PDF over the inline ceiling (R131, `reading-gate.mjs`: `pdf.request_bytes`), or less than this budget left of the bound, is answered kept and read after */
const READING_BUDGET_MS = 8000;
/* R133 (fix round 9, G128f): the most readings the door makes INLINE in one request. It is no limit on what is followed: a promotion's every other document is
   registered as a job row (R130) and read by the plane's ticks, none dropped. */
const READING_FOLLOWED_MAX = 16;
const DOOR_TIMED_CODES = Object.freeze(["ACQUIRE_TIMED_OUT", "STORE_DID_NOT_ANSWER", "CAPTURE_NOT_KEPT"]);
/* R105, R115 (fix round 2, C12; acquisition R13, R20, R95): WHAT A CALL THE DOOR STOPPED WAITING FOR HAD KEPT, from the stage times the
   object states for it (`stageTimes`): `held` once its stage `receipt` (the capture's record, acquisition R13) has ended, for the
   attestation, the profile and the rest come after it and never undo it (R20); `nothing` while it had not; `undetermined` when the
   object states no stage (a call with no trace, or an object that answers none), where the door claims nothing. */
/* the design's key for each state; the two it was asked for (K4326) are read when the design holds them, never a sentence of this module's */
function detailKey(kept) {
  const key = kept === "nothing" ? "refusal.ACQUIRE_TIMED_OUT" : `refusal.ACQUIRE_TIMED_OUT.${kept}`;
  return kept === "nothing" || hasWord(key) ? key : null;
}
function keptOf(times) {
  const stages = times && typeof times === "object" && times.stages && typeof times.stages === "object" ? times.stages : null;
  if (!stages) return "undetermined";
  return Object.hasOwn(stages, "receipt") && times.running !== "receipt" ? "held" : "nothing";
}
/* R124 (acquisition R110): THE MEMBER A SESSION'S OPENER NAMES, in the viewer's form. A session stores the id the `acquire` was made for (`opened_by: "<id>"`); the
   door stamps `member:<id>` (the founder's is `admin`), and a viewer may carry a project (`member:<id>@<project>`). The store answers `heldat` only for a viewer
   spelling, so a bare id is read as `member:<id>`; the founder's bare `admin` and a spelling that already is a viewer stand as they are. Pure; never throws. */
function openerForms(opened) {
  const base = typeof opened === "string" ? opened.replace(/^(member:[A-Za-z0-9._:-]{1,128}|admin)@[\s\S]+$/, "$1") : "";
  if (!base) return { viewer: "", memberId: "" };
  if (base === "admin") return { viewer: "admin", memberId: "admin" };
  if (base.startsWith("member:")) return { viewer: base, memberId: base.slice("member:".length) };
  return { viewer: `member:${base}`, memberId: base };
}
/* R105 (fix round 6, G2, G3; K4562): THE STORE IS ASKED WHETHER THE CAPTURE IS KEPT, not only this call's stages. A call the door stopped waiting for may
   name a capture the record already holds (the address a member captured before, the page a `continue` finishes): that is kept whatever stage the call
   was in, and "kept nothing" is never said of it. The question is one read of the store as the member may see it, each failing to `false`. */
async function keptInStore(stub, { address, session, viewer }) {
  const ask = async (path) => { const a = await doAnswer(stub.fetch(new Request(`http://do/${path}`))); return a.answered ? a.result : null; };
  try {
    if (typeof session === "string" && session) {
      const ld = await ask(`loadcapturesession?session=${encodeURIComponent(session)}`);
      /* only the session's own opener is told it is kept: another's session id states nothing */
      if (ld && ld.found === true && typeof ld.primarySha === "string" && ld.primarySha && ld.state && openerForms(ld.state.opened_by).viewer === openerForms(viewer).viewer) return true;
    }
    if (typeof address === "string" && address && viewer) {
      const held = await ask(`heldat?address=${encodeURIComponent(address)}&viewer=${encodeURIComponent(viewer)}`);
      if (held && held.ok === true && held.held === true) return true;
    }
  } catch { /* a store that cannot be asked states nothing */ }
  return false;
}

async function fingerprint(v) {
  if (!v) return null;
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* Full 64-hex SHA-256 of a string or a byte view. This is what docprofile's
   `digests()` calls to name each normalised variant (CONSTRUCTS Step 2 / FW-4);
   it hashes the SAME raw bytes for `identity`, which is why identity must equal
   the capture sha and is asserted to. */
async function sha256Hex(v) {
  const b = await crypto.subtle.digest("SHA-256", typeof v === "string" ? new TextEncoder().encode(v) : v);
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* REC-126 / REC-198 — THE REVIEW COPY'S ANSWER SHAPE, ONE FUNCTION FOR EVERY READ OF A DRAFT. The store's
   `#noReviewCopy` is carried at 404 with nothing added, so a caller outside the fence reads the same status and the
   same bytes from the single read (`reviewcopy`) and from the list (`casedrafts`); a store that did not answer is a
   silence, stated as one. */
/* `extra` is put in the answer before the in-band hash is taken, so the hash is over the answer exactly as served. */
/* R20 (T46; N905; public-read R34, R7; v0.2 rule 21): `group`, public-read's `groupFields()` read at this request from the
   `bio` object (plane's `groupFields` on the object), handed to the quartet beside `hash`, which it never enters; null when
   the object offers no such read or it fails, never a guess. */
async function groupOf(stub, project = null) {
  if (!stub || typeof stub.groupFields !== "function") return null;
  try {
    /* R102 (T50; N933; public-read R36): read for the project the draft belongs to, so the quartet's `group` carries that
       project's `matter_stake` beside the team's; a draft in no project reads it as before */
    const g = await (typeof project === "string" && project ? stub.groupFields({ project }) : stub.groupFields());
    return g && typeof g === "object" && !Array.isArray(g) ? g : null;
  } catch { return null; }
}
const INBAND_OVER = "this answer exactly as served, without its `inband` key: parse it, delete `inband`, and "
          + "hash JSON.stringify(rest, null, 1) as UTF-8";
async function reviewAnswer(out, op, extra = {}, group = null, batchGroup = null) {
  if (out.refused) return storeRefusal(out, extra);   /* R23: the store's own refusal, at its status */
  if (!out.answered) return storeSilent(op, out.correlation);
  const r = out.result;
  if (!r?.ok) return json({ ok: false, ...r, ...extra }, r?.reason === "NO_REVIEW_COPY" ? 404 : 400);
  /* R20 (fix round 6, G12c; K4577): a batch of review copies (`drafts`) is a read answer, never the dead answer: each copy it holds is stamped exactly
     as the single read stamps it (the in-band quartet over the copy as served, its group fields read for its own project) */
  if (op === "reviewcopy" && r.kind === "review-copies" && Array.isArray(r.copies)) {
    const copies = [];
    for (const c of r.copies) {
      if (!c || typeof c !== "object" || c.ok !== true) { copies.push(c); continue; }
      const { required_strength: bar, ...copy } = c;
      const served = { ok: true, ...copy, ...extra };
      const { quartet } = await inbandQuartet({ subject: served, over: INBAND_OVER, date: c.last_change?.at ?? null, author: c.updated_by ?? null, bar: bar ?? null,
                                                group: typeof batchGroup === "function" ? await batchGroup(c.project) : null });
      copies.push({ ...served, inband: quartet });
    }
    return json({ ...r, ...extra, copies }, 200);
  }
  if (op === "reviewcopy") {
    /* REC-148 / DEC-31's BOUND RULE (`BIO_Publication_v0_1.md` §6A.3 point 1): the answer carries its
       hash, date, author and both floors IN-BAND, by the SAME function the container manifest is
       hashed with. The hash is over every byte of this answer but `inband` itself, in the form it is
       served; the floors are the project's required strength, the quantity `op=publish` freezes into
       the case document and the container carries as `bar`. The store's `required_strength` is read
       into the floors and not served twice. (Moved here from the review door's inline branch when REC-198
       made this function the one answer shape for every read of a draft.) */
    const { required_strength: bar, ...copy } = r;
    const served = { ok: true, ...copy, ...extra };
    const { quartet } = await inbandQuartet({
      subject: served,
      over: "this answer exactly as served, without its `inband` key: parse it, delete `inband`, and "
          + "hash JSON.stringify(rest, null, 1) as UTF-8",
      /* REC-200 / BOB #32, 2026-09-23 23:08Z: THE DATE IS THE COPY'S LAST CHANGE, not the draft's last
         EDIT — a comment moves these bytes, so it moves the hash, and it must move the date with it. The
         store computes it over the rows it SERVES and says in `last_change.stated` what it cannot see.
         THE AUTHOR DOES NOT MOVE: the ruling is about the date, and a recipient who comments on a copy
         has not authored it; `last_change.by` is who made that change, beside it. */
      date: r.last_change?.at ?? null, author: r.updated_by ?? null, bar: bar ?? null, group });
    return json({ ...served, inband: quartet }, 200);
  }
  return json({ ok: true, ...r, ...extra }, 200);
}

/* R44 (K921; filing-templates R8, R9, R13, R14) — THE TEMPLATE GRANT'S FOUR DOORS, on the review copy's (R20) for its
   reason: the reader a grant exists for holds no credential of this instance. `templateread`, `templatecomments`,
   `templatereview` and `templatecomment` admit two callers and no third:
     - `secret=` — a RECIPIENT. Any presented value takes this door, an empty or malformed one included, so a malformed
       secret travels the path a revoked one does. The value is HASHED HERE and only its digest crosses, stamped
       `secretSha` and `bySecret` as `reviewcopy`'s are; filing-templates asks whether a live grant holds it.
     - otherwise a MEMBER'S SESSION, admitted by `admission`'s `admit` held to a session (no binding class, no agent
       credential), stamped `viewer` and `author` (its positional identity, the form filing-templates asks membership
       of) as every act of the action layer is.
   Every caller the grant does not admit (no secret and no session; a secret no live grant holds, of any kind) receives
   filing-templates' ONE dead answer, `NO_TEMPLATE_GRANT`, at 404 and in the same bytes whoever built it, so a revoked,
   never-issued or malformed secret and a stranger cannot be told apart. A store that did not answer is a silence. The
   inner request carries the caller's own arguments with every stamp and credential removed. */
/* R138 (R136; store-request R23): the request of the secret-presenting doors (`reviewcopy`, `reviewcomment`, `statementack` and the four template
   doors) is `innerRequest`'s too, a presented secret's digest its one stamp. The door sets only the reader's own sight, `reader` (`viewer`, and for
   the template doors `author`), which no declaration stamps for these public ops. `innerRequest` itself removes the grant's `secret` and the
   caller's stamps from address and body (store-request R23, R9). */
async function secretDoorRequest({ op, req, url, credential, reader, narrow = null }) {
  const bySecret = credential.secret !== null;
  const digest = bySecret ? await sha256Hex(credential.secret || "") : null;
  let body;
  if (req.method === "POST") {
    body = await req.clone().text();
    let b;
    try { b = JSON.parse(body || "null"); } catch { b = undefined; }
    if (b && typeof b === "object" && !Array.isArray(b)) {
      /* a recipient's body is the keys the arm takes (`narrow.body`) and nothing else */
      if (narrow) for (const k of Object.keys(b)) if (!narrow.body.includes(k)) delete b[k];
      body = JSON.stringify(b);
    }
  }
  /* R138: a recipient holds a secret and no standing, so the address handed over is the keys the arm takes (`narrow.query`), the draft trimmed;
     a member's is the page's whole, as every other op's */
  let page = url;
  if (narrow) {
    page = new URL(url);
    for (const k of [...page.searchParams.keys()]) if (!narrow.query.includes(k)) page.searchParams.delete(k);
    if (page.searchParams.has("draft")) page.searchParams.set("draft", page.searchParams.get("draft").trim());
  }
  const built = innerRequest({ op, url: page, method: req.method, body, caller: null, bySecret, secretSha: digest });
  const inner = new URL(built.url);
  if (reader) for (const [k, v] of Object.entries(reader)) inner.searchParams.set(k, v);
  return { url: inner.toString(), body: built.body, headers: { ...(built.body !== undefined ? { "content-type": "application/json" } : {}), ...built.headers } };
}

const TEMPLATE_GRANT_DOORS = Object.freeze([...TEMPLATE_DOOR_ACTIONS, ...TEMPLATE_DOOR_READS]);   /* op-declarations R8 */
const deadTemplateGrant = () => json({ ok: false, ...noTemplateGrant() }, 404);
async function templateGrantDoor({ req, url, env, op, spec, presentedAi, stub, credential }) {
  /* R138 (R136): the request is `store-request`'s `innerRequest` from the page's, a presented secret's digest its one stamp (store-request R23);
     only the reader's own `viewer` and `author` are set here, from the session `admit` held to a member */
  let reader = null;
  if (credential.secret === null) {
    const admitted = await admit({ url, env, op, spec: { ...spec, classes: ["admin", "member"], machineClasses: [] },
                                   method: req.method, presented: presentedAi, doAnswer, credential,
                                   background: url.searchParams.get("background") === "1" });
    if (admitted.silent) return storeSilent(admitted.silent.op, admitted.silent.correlation);
    if (admitted.refusal || !admitted.caller.viaSession) return deadTemplateGrant();
    reader = { viewer: admitted.caller.viewer, author: admitted.caller.identity };
  }
  const built = await secretDoorRequest({ op, req, url, credential, reader });
  const body = built.body;
  const inner = built.url;
  const out = await doAnswer(stub.fetch(new Request(inner, body === undefined ? { method: "GET" } : { method: "POST", body, headers: built.headers })));
  if (out.refused) return storeRefusal(out);   /* R23: the store's own refusal, at its status */
  if (!out.answered) return storeSilent(op, out.correlation);
  const r = out.result;
  if (r?.reason === "NO_TEMPLATE_GRANT") return deadTemplateGrant();
  if (!r?.ok) return json({ ok: false, ...r }, r?.reason === "NO_SUCH_TEMPLATE" ? 404 : 400);
  return json({ ok: true, ...r }, 200);
}

/* WHO IS ASKING, FOR A PUBLIC OP THAT ANSWERS WORKING MATERIAL ONLY TO SOME: `admission`'s `readerOf` (its R16), in the
   shape the arms behind plane's hooks read (`{viewer, cls}`, or `{silent: <op>, correlation}`). */
async function caseReader(url, env, storeName, presentedAi, credential = null) {
  /* R83 (T47; K3144): a background request's session read is no activity */
  const r = await readerOf(url, env, storeName, presentedAi, doAnswer, credential,
                           { background: url.searchParams.get("background") === "1" });
  return r.silent ? { silent: r.silent.op, correlation: r.silent.correlation } : r;
}

/* The R2 key for a capture's bytes (I1 §2): content-addressed under the store
   prefix. The ONE place this shape is written, so op=capture and op=pdfstructure
   read the identical object rather than two copies of the key drifting apart. */
const captureKey = (storeName, sha) => `${storeName}/captures/${sha}`;

/* THE CAPABILITY COMPLAINT (C-68.1, D-278). A copy installed with no evidence
 * storage bound cannot serve `capture`, `pdfstructure`, `acquire` or `attest`.
 * ONE row for the four, the op named beside it, minted at acquisition's one
 * region (`evidenceStorageAbsent`, K850) for the same reason `requiredArgument`
 * is minted once: a DEC-49 row holds one `where`. `error` is passed in
 * BYTE-IDENTICAL from each site — the sites said two different sentences before
 * this and still do. Handed to every arm this door routes those ops to (moved
 * from legacy-index at T19, its door share). */
function storageAbsent(op, error) {
  const { status, body } = evidenceStorageAbsent(op, error);
  return json(body, status);
}

/* REC-163 / IC-174 and REC-164: WHICH STORE `op=instancegroup` and `op=groupidentity` read, and WHO ASKS — the
   resolution is the door's, the answer instance-setup's (`instanceGroupOp`, `groupIdentityOp`). Who asks decides which
   projection, never whether: a caller the admission gate would admit (a machine class in its own namespace, a session,
   an agent credential in scope) is answered the store's whole row, provenance included, `caseReader` deciding it; anybody
   else the public projection. The store: the namespace a machine credential is confined to or names (`scopeFor`'s rule,
   so a probe naming nothing still reads `scratch`), and for every other caller `store=scratch` when named and `bio`
   otherwise, the invitation ops' rule. A silence is a silence (REC-52): never "no group is recorded". Moved from
   legacy-index at T19 (its door share). */
async function groupRead(op, url, env, presentedAi, credential, stateTiming = undefined) {
  const held = credential.token;
  const heldCls = held ? await classify(held, env) : null;
  const heldScope = heldCls ? scopeFor(heldCls, url) : null;
  const store = heldScope && !heldScope.error ? heldScope.name
    : (url.searchParams.get("store") === SCRATCH ? SCRATCH : "bio");
  const reader = await caseReader(url, env, store, presentedAi.cred, credential);
  if (reader.silent) return storeSilent(reader.silent, reader.correlation);
  const io = { json, storeSilent, storeRefusal, doAnswer, ...(stateTiming ? { stateTiming } : {}) };
  return op === "instancegroup" ? instanceGroupOp(env, store, reader, io) : groupIdentityOp(env, store, reader, io);
}


/* REC-173 (INVESTIGATIVE-SESSION.md §11 item 5, "A MIGRATION IS A REPLAY, NOT A SURFACING", BOB #30): IS THIS
   CREATION A MIGRATION REPLAY? — and since D-512 (BOB #33's step (2)) IS THIS PROMOTION, of ANY type and ANY revision,
   A REPLAY THE SERVER CAN VERIFY? The same test answers both: nothing below is particular to an inquiry or to a
   creation (`b.bundleId` is the bundle a revision revises too). Condition (2) of the ruling, asked of what the SERVER
   holds and never of what the caller says: the promotion names a capture (`provenanceCapture`, a sha256) that is
     - REGISTERED as the Drive era's provenance — at `DRIVE_PROVENANCE_PATH` — by this creation's own `register`
       list, the one writer of the register (`promote`) and so the earliest act that can register anything against
       a bundle that does not exist yet (the builder's DESIGN GAP, stated in the IC);
     - HELD: its bytes are read back from R2 under the one capture key and must hash to the sha named, so the
       provenance is the bytes already in the record, not a copy the request carries;
     - and its PRESERVED PROMOTION RECORDS name THIS bundle id (`record.target`) and, in THE SAME record, list THIS
       revision's `bundle.md` SHA-256 — computed here from the text being promoted, and the `sha256` the caller
       sent must BE that value, because the store keeps the caller's figure as the bundle's head.
   Null when any of it fails: a promotion that ASSERTED `replay` is then refused REPLAY_UNVERIFIED (C-66.6, D-512), and
   an inquiry creation that asserted nothing is an ORDINARY creation and rule 2 and D-78 apply unchanged, so this
   door cannot be used to skip a run. Condition (1), the ADMIN class, is the caller's to ask before calling this.
   WHAT THIS CANNOT CHECK, stated rather than hidden: the provenance capture is uploaded by the root of trust, whose
   honesty the record does not model (Membership §DEC-2, deferred). */
const DRIVE_PROVENANCE_PATH = "migration/drive-provenance.json";
async function migrationReplayOf(env, storeName, b) {
  const cap = typeof b.provenanceCapture === "string" ? b.provenanceCapture.trim() : "";
  if (!/^[0-9a-f]{64}$/.test(cap)) return null;
  const registered = Array.isArray(b.register)
    && b.register.some((r) => r && r.sha256 === cap && r.path === DRIVE_PROVENANCE_PATH);
  if (!registered) return null;
  const bm = Array.isArray(b.files) ? b.files.find((f) => f && f.path === "bundle.md" && typeof f.text === "string") : null;
  if (!bm) return null;
  const mdSha = createSha256().update(new TextEncoder().encode(bm.text)).hex();
  if (bm.sha256 !== mdSha) return null;
  let held;
  try { held = await env.CAPTURES.get(captureKey(storeName, cap)); } catch { return null; }
  if (!held) return null;
  const bytes = new Uint8Array(await held.arrayBuffer());
  if (createSha256().update(bytes).hex() !== cap) return null;
  let prov;
  try { prov = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
  const records = Array.isArray(prov?.promotions) ? prov.promotions : [];
  const match = records.find((p) => p && p.record && typeof p.record === "object"
    && p.record.target === b.bundleId
    && Array.isArray(p.record.files)
    && p.record.files.some((f) => f && f.name === "bundle.md" && f.sha256 === mdSha));
  if (!match) return null;
  return { capture: cap, promotion: typeof match.key === "string" ? match.key : null, bundleMdSha: mdSha };
}

/* R16 (D-511, D-512): A PROMOTION'S REPLAY, judged from the body as sent. Only the ADMIN class with no session may
   assert one (D-511: every other caller's flag is deleted by the promote block, and it is judged by the fences it tried
   to skip); an admin's assertion, or an admin's inquiry creation, is checked by `migrationReplayOf`. `asserted` with no
   `proven` is refused REPLAY_UNVERIFIED before any handler runs (R28). A body that is not a JSON object asserts nothing:
   the store refuses it in its own words. */
async function replayVerdict(env, storeName, text, viaSession, cls) {
  let b;
  try { b = JSON.parse(text); } catch { return null; }
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const admin = !viaSession && cls === "admin";
  const asserted = admin && !!b.replay;
  const creatingInquiry = b.base === null && !!b.meta && promotedTypeOf(b) === "inquiry";
  const proven = admin && (asserted || creatingInquiry) ? await migrationReplayOf(env, storeName, b) : null;
  return { asserted, proven,
           bundleId: typeof b.bundleId === "string" ? b.bundleId.slice(0, 200) : null,
           provenanceCapture: typeof b.provenanceCapture === "string" ? b.provenanceCapture.slice(0, 64) : null };
}

/* N364 (sources R11): `op=knockerconsent`, a knocker's consent (or its withdrawal) by their knocker secret, with no
   account. Pinned to `bio` (R5), as the knock is. The stamps are the knock's: the connecting address as `source` and the
   instant as `now`, set here and read by `sources` after the body, so a caller's own copies never reach it; only the
   four fields the act takes are passed on. A rate refusal answers as the knock's does (429, with its sentence); every
   other failure is the module's one `SECRET_NOT_RECOGNISED`, relayed whole at one status. */
async function knockerConsent(req, store) {
  if (req.method !== "POST") return json({ ok: false, error: "knockerconsent is a POST" }, 405);
  let b = null;
  try { b = JSON.parse((await req.text()) || "{}"); } catch { b = null; }
  if (!b || typeof b !== "object" || Array.isArray(b)) b = {};
  const source = req.headers.get("cf-connecting-ip") || "unknown";
  const out = await doAnswer(store.fetch(new Request(
    `http://do/knockerconsent?source=${encodeURIComponent(source)}&now=${Date.now()}`,
    { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ knockerSecret: b.knockerSecret, entry: b.entry, audience: b.audience,
                             ...(b.withdraw !== undefined ? { withdraw: b.withdraw } : {}) }) })));
  if (out.refused) return storeRefusal(out);
  if (!out.answered) return storeSilent("knockerconsent", out.correlation);
  const rec = out.result && typeof out.result === "object" ? out.result : {};
  if (rec.ok !== true)
    return json({ ok: false, ...rec }, rec.reason === "RATE_IP" || rec.reason === "RATE_GLOBAL" ? 429 : 403);
  return json({ ...rec, ok: true }, 200);
}

/* R108 (T50; N1195; K3602, K3637 (3); DEC-298 (1); plane R59, agent-worker R113; signin-door R4): THE ASK'S ANSWER PASSES THROUGH
   THE DOOR AS THE PLANE WRITES IT. The response is returned before the stream ends and no chunk is held for a later one:
   each reaches the caller as the plane's body yields it, the status and headers the plane's. What the door must learn
   from the answer (a refused sign-in token, signin-door R4) it learns from the lines as they pass, read beside the
   caller's bytes and never before them: a chunk is enqueued first, then its lines are looked at, and the drop of the
   held sign-in, once, is awaited only when the stream ends, after its last line, so it delays no chunk. A JSON answer
   (a refusal made before any stream, `application/json`) is short and is read whole, as it always was. */
async function watchedAsk(res, { member, store }) {
  const type = res.headers.get("content-type") || "";
  if (!res.body || /application\/json/i.test(type)) {
    let asked = null;
    try { asked = await res.clone().json(); } catch { asked = null; }
    await tokenRefusedSeen({ member, answer: asked, store });
    return res;
  }
  const decoder = new TextDecoder();
  let held = "", chain = Promise.resolve(false);
  /* each parsed line is asked in turn, off the caller's path; once a line has dropped the sign-in, no other is asked */
  const look = (line) => {
    const t = line.trim();
    if (!t) return;
    let answer;
    try { answer = JSON.parse(t); } catch { return; }
    chain = chain.then((done) => done || tokenRefusedSeen({ member, answer, store }).catch(() => false));
  };
  const body = res.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      held += decoder.decode(chunk, { stream: true });
      const lines = held.split("\n");
      held = lines.pop();
      for (const line of lines) look(line);
    },
    async flush() {
      held += decoder.decode();
      look(held);
      await chain;
    },
  }));
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/* R41 (K585 (1), K674 (1); agent-worker R48, N157; T36: N695, K2135): THE PUBLISHED FENCES AND THE RENDERED PACK, served
   by `op=agentpack` alone, from the untargeted `op=affordances` answer (affordances R17's, whose handler answers it):
   `fences`, skills' `machineFences` over `CHECK_FAMILIES`, and `pack`, `renderPack` over that same answer with its
   `fences`, whole with its `version`. A member's agent reads both from there and imports no catalogue. A render that
   throws answers `pack: null` and `pack_absent` (its sentence), never a partial pack, so a reader refuses it. Null for an
   answer that is not `ok: true` with a result. Since T36 the untargeted `op=affordances` answer is the handler's as it
   stands, with neither key. */
async function packOf(res) {
  let body;
  try { body = await res.clone().json(); } catch { return null; }
  if (!body || body.ok !== true || !body.result || typeof body.result !== "object" || Array.isArray(body.result)) return null;
  const fences = machineFences(CHECK_FAMILIES);
  let pack = null, absent = null;
  try { pack = renderPack({ ...body.result, fences }); }
  catch (e) { absent = String((e && e.message) || "the pack could not be rendered").slice(0, 500); }
  return { fences, pack, ...(pack ? {} : { pack_absent: absent }) };
}

/* N336 (installer R20, K649 (6)): THE PLANE'S LIMITS, stated in its code so the bundle a release signs carries them, equal
   to the `limits` of the plane's own configuration (`wrangler.jsonc`), which a test pins. The installer reads them from
   the verified plane bundle and holds no value of its own; the door carries them as `limits` on the function it makes,
   so a bundle of the door cannot leave them out. */
const PLANE_LIMITS = Object.freeze({ subrequests: 10000, cpu_ms: PLATFORM_FIGURES.cpu_ms.value });   /* plane R99: stated once, runtime-limits' figure */
/* The statement a release's verified bundle is read for (installer R20, K723, K724): the tag, then `key=<positive
   integer>` for each key of the limits, keys sorted, single spaces, no quotes or backslashes, so a reader of the bundle's
   text finds it whole. `PLANE_LIMITS` is its parsed form. */
const PLANE_LIMITS_STATEMENT = "bio-plane-limits/1 cpu_ms=300000 subrequests=10000";
/* R1 (fix round 6, G1; K4566): THE PLANE'S CRON, stated in its code beside its limits so the bundle a release signs carries it: the tag, then the one five-field cron
   the watchdog runs on (`bio-plane/wrangler.jsonc` `triggers.crons`, which plane's test pins equal). The installer sets the plane's schedules from this statement
   and holds no value of its own. */
const PLANE_CRONS_STATEMENT = "bio-plane-crons/1 */5 * * * *";

/* R53 (K1601, K1674; credentials R27, R28; agent-worker R54): AN ASK'S GRANT. Its token has a session's shape and is
   no session, so admission answers NOT_AUTHENTICATED; for an op on the grant's list, or one of the ask's own four calls
   (`affordances` untargeted), the door then asks credentials in `bio` whether a live grant admits it (the four, off the
   list, by its first read). Admitted, the caller is `ai`, its viewer the grant's member, its grant stamped `grant`
   (answers' arms, the read log); GRANT_OP_REFUSED is answered; anything else keeps admission's answer. */
/* R41 (T35): `agentpack` is admitted under a grant (op-declarations R30); (T36; K2135) the ask reads the pack there alone
   (agent-worker R48, its `ASK_PLANE_OPS`), so the untargeted `affordances` is no longer one of the ask's own calls. */
const GRANT_OWN_OPS = Object.freeze(["askceiling", "askcheck", "askusage", "agentpack"]);
async function grantAdmit(env, url, op, spec, token) {
  const own = GRANT_OWN_OPS.includes(op);
  if (!own && !AI_GRANT_OPS.includes(op)) return {};
  const out = await doAnswer(storeStub(env, "bio").fetch(new Request("http://do/aigrantadmit", {
    method: "POST", body: JSON.stringify({ token, op: own ? AI_GRANT_OPS[0] : op, write: own ? false : spec.mutating }) })));
  if (!out.answered) return { silent: { op: "aigrantadmit", correlation: out.correlation } };
  const g = out.result || {};
  if (g.ok === true) return { caller: { cls: "ai", viaSession: false, member: null, viewer: null, identity: null, rights: null,
    caps: null, aiCred: { tokenId: "grant", principal: g.viewer, grant: token },
    storeName: url.searchParams.get("store") === SCRATCH ? SCRATCH : "bio" } };
  return g.reason === "GRANT_OP_REFUSED" ? { refusal: { status: 403, body: g } } : {};
}

/* R1–R25: the Worker entry. `hooks.publicOp(ctx)` answers a public op whose handler is a module's, through plane's hooks;
   `hooks.gatedOp(ctx)` an admitted op's handler there, or undefined for the generic forward below. */
/* R36, R23 (K1037): the ops whose refusals state their own HTTP status in `result.status`, which the forward answers. */
const STATED_STATUS_OPS = Object.freeze(["inbox", "inboxpull", "inboxresolve", "heldsetaside", "heldrestore"]);
/* R53 (T36; DEC-172, instance-setup R53) and R63: `assistantset` is retired and `securitycount` store-internal, so a
   request naming either is answered as an op with no spec (R2), whatever any table holds. */
/* R66 (op-declarations R37; instance-setup R67): `translationdraftrecord` is the door's own store-internal call after a
   translation draft, never a caller's. */
/* R56 (T41; DEC-188 (8); credentials R37): `groupswitchset`, and `accountswitchset` with it (op-declarations R41), are
   retired to `accountusesset` (R69), so a request naming either is answered as an op with no spec too. */
const NOT_ROUTED = Object.freeze(["assistantset", "securitycount", "translationdraftrecord", "groupswitchset",
                                  "accountswitchset"]);
/* R61 (N714, N707, N710; DEC-169, DEC-173; file-safety R8, R11, R33): file-safety's four byte answers, relayed as the owner
   answers them, never enveloped; `openwithwarning` takes `warned` from the body (a GET's query `warned`, its JSON, is
   carried there). R62: a member's or an `ai` credential's `op=capture` GET is answered by the first two. */
const BYTE_OPS = Object.freeze(["openoriginal", "openwithwarning", "safeview", "safecopy"]);
/* G42 (K4638): the grain, in bytes, of the record's size an administering member is shown. */
const STATS_GRAIN = 100_000_000;
/* R61, R62: A BYTE ANSWER, AS ITS OWNER GAVE IT. A served file (an answer at 200 or 206 carrying its owner's digest header,
   which no JSON answer carries; a file's own content type may be anything, JSON or text included) is relayed whole
   — its bytes, content type, length and digest header (`x-capture-sha256` for an original, `x-derived-sha256` for a view
   or copy) — with `cache-control: no-store`, and `access-control-allow-origin: *` as `op=capture`'s GET carries it; a JSON
   answer is read through `doAnswer` and enveloped as any answer of the forward (a refusal the owner's, answered as given;
   a silence a silence). Nothing of it is logged, kept or counted here beyond what every answer meets (file-safety R10). */
async function byteAnswer(res, op, extra) {
  const file = res.headers.has("x-capture-sha256") || res.headers.has("x-derived-sha256");
  if ((res.status === 200 || res.status === 206) && file) {
    const headers = new Headers(res.headers);
    headers.set("cache-control", "no-store");
    if (!headers.has("access-control-allow-origin")) headers.set("access-control-allow-origin", "*");
    return new Response(res.body, { status: res.status, headers });
  }
  const out = await doAnswer(Promise.resolve(res));
  if (out.refused) return storeRefusal(out, extra);
  if (!out.answered) return storeSilent(op, out.correlation);
  const { body, status } = out.reply;
  return json({ ...body, ...extra }, status);
}
/* R61: a GET's query `warned` (`{"own_device":true,"no_macros":true}`), read as JSON, else as the text sent, for the body. */
function warnedOf(url) {
  const w = url.searchParams.get("warned");
  if (w === null) return undefined;
  try { return JSON.parse(w); } catch { return w; }
}
/* R123, R131: the size half of "will not fit" is `reading-gate.mjs`'s (a ceiling is a `READ_BOUNDS` row); a document it defers is not read in the request. The
   clock half is the door's, per request. */
/* R125 (fix round 5, E2): what the evidence bucket says of a whole, as a document for the gate (`readingVerdict`): its size and whether it opens as a PDF.
   Null when the bucket holds none (or is not bound): the owner then answers as it always did. */
async function heldWholeFacts(env, storeName, sha) {
  try {
    if (!env?.CAPTURES || typeof env.CAPTURES.head !== "function") return null;
    const key = captureKey(storeName, sha);
    const head = await env.CAPTURES.head(key);
    if (!head || !Number.isFinite(head.size)) return null;
    let pdf = false;
    try {
      const got = await env.CAPTURES.get(key, { range: { offset: 0, length: 5 } });
      pdf = !!got && new TextDecoder().decode(await got.arrayBuffer()) === "%PDF-";
    } catch { pdf = false; }
    return { capture: { bytes: head.size, ...(pdf ? { content_type: "application/pdf" } : {}) } };
  } catch { return null; }
}
/** R124 (fix round 4b, F5; K4492, K4493; acquisition R100, plane R77): THE ALARM'S DELIVERY OF AN OWED RENDER. The plane's alarm runs a
 *  `subresources` entry through acquisition's `owedRun`, which finishes the pending render and hands its answer here as `deliver`:
 *  `deliverOwedRender({ctx, env, storeName, answer, session}) -> {ok: true, bundleId, reading_pending?} | {ok: false, reason}`. (Fix round 6, G2; K4562:
 *  the plane's `fetch` entry, a large capture the member's act left to the alarm, hands its finished document here as well: the same promotion under
 *  the session's project, by its opener, and the same reading follow.)
 *  The rendered document is promoted as the capture screen promotes an acquired one: screens-intake's own `promoteDocument` builds the
 *  bundle (its text, id and register), run in process through the same `promote` step (promotion's `promote`, the route's own), filed
 *  under the project of the shell document (the capture session's primary, as its opener sees it) with the opener as author and
 *  the door's promote stamps; then R123's read of the document, inline when it fits, else written down for the alarm. Nothing is
 *  delivered for a session that is gone or has no opener; a refusal is `{ok: false, reason}` and the render stays owed. */
export async function deliverOwedRender({ ctx, env, storeName = "bio", answer, session } = {}) {
  try {
    const doc = answer && typeof answer === "object" ? answer.document : null;
    const sha = doc && doc.capture && doc.capture.sha256;
    if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return { ok: false, reason: "NO_RENDERED_DOCUMENT" };
    const ld = captureOf(ctx).loadCaptureSession({ session });
    if (!ld || !ld.found) return { ok: false, reason: "NO_SUCH_SESSION" };
    const opened = ld.state && typeof ld.state.opened_by === "string" ? ld.state.opened_by : "";
    if (!opened) return { ok: false, reason: "NO_OPENER" };
    /* the opener in the door's forms (R17): the viewer `member:<id>` or `admin`, her id, her positional identity. Acquisition writes the opener as the bare
       member id and the door stamps the viewer form; both name one member (acquisition R110), so the store is asked in the viewer's form either way. */
    const { viewer, memberId } = openerForms(opened);
    const who = { author: memberId, actorMemberId: memberId, actorIdentity: viewer === "admin" ? "member:admin" : viewer, actorViewer: viewer };
    /* (fix round 6, G2; K4562) a session parked for a fetch the member's act handed to the alarm carries her project and the opener in its state;
       a session parked for a render is filed beside its shell, under the shell's project */
    let project = ld.state && typeof ld.state.project === "string" ? ld.state.project.trim() : "";
    if (!project) {
      try {
        const held = await captureOf(ctx).heldAt({ sha256: ld.primarySha, viewer });
        project = held && held.held === true && held.copy && typeof held.copy.project === "string" ? held.copy.project : "";
      } catch { project = ""; }
    }
    /* R124 (fix round 9, P25; K4855; screens-intake R49): AN OWED FETCH WHOSE `acquire` ANSWERED `existed: true` follows the inline path. The record is asked (`heldat` by
       the digest, as the opener sees it, nothing fetched) for the document that holds the bytes; one that shows is linked, no document is promoted, and the fetch is
       recorded done naming it. Only when none shows is the document promoted; the record's one-home refusal is answered with its holder where it names one. */
    if (answer.existed === true) {
      let linked = null;
      try {
        const held = await captureOf(ctx).heldAt({ sha256: sha, viewer });
        linked = held && held.held === true && held.copy && typeof held.copy.document === "string" && held.copy.document ? held.copy : null;
      } catch { linked = null; }
      if (linked) {
        const filedAt = new Date().toISOString();
        if (ld.state && ld.state.fetch_pending) {
          try {
            const cap = captureOf(ctx);
            if (typeof cap.recordFetchDone === "function")
              await cap.recordFetchDone({ session, document: linked.document, opener: viewer, project: linked.project || project || null, at: filedAt });
          } catch { /* the link stands */ }
        }
        return { ok: true, bundleId: linked.document, existed: true };
      }
    }
    const record = recordOf(ctx), promotion = promotionOf(ctx);
    const cs = { now: () => Date.now(), digest: async (t) => sha256Hex(t), w: (k, v) => word(k, v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([n, x]) => [n, x && typeof x === "object" && "html" in x ? x.html : x])) : v),
      date: (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }); },
      call: async (op, { query = {}, body } = {}) => {
        if (op === "allocid") return { ok: true, ...record.allocId(query.prefix, query.year) };
        if (op === "promote") return promotion.promote({ ...body, ...who });
        return { ok: false, reason: "UNKNOWN_OP" };
      } };
    const address = String(doc.locator || "");
    let title;
    try { title = CAPTURE_SCREEN.parts.titleOf(cs, { reading: answer.reading, doc, address }); } catch { title = address; }
    const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc, title, locator: address, project });
    if (made.refused !== undefined) {
      const refused = made.refused && typeof made.refused === "object" ? made.refused : {};
      const reason = refused.reason || refused.code || "PROMOTE_REFUSED";
      /* R124 (P25): the holder, where the record names it, beside the code; never a bare `PROMOTE_REFUSED` for the one-home rule */
      if (reason !== "CAPTURE_HELD_BY_ANOTHER_BUNDLE") return { ok: false, reason };
      /* R124 (fix round 9, G160; K4980): and the refusal's facts as provenance answered them, beside the code and in `detail` (the form the plane's job row reads, plane R97):
         the digest refused, its `kind` (whole or part) and the holder, null where provenance does not name it to this caller (D-15) */
      const facts = { capture_sha: typeof refused.capture_sha === "string" ? refused.capture_sha : sha, kind: typeof refused.kind === "string" ? refused.kind : null,
                      holder: typeof refused.holder === "string" ? refused.holder : null };
      return { ok: false, reason, ...facts, detail: { ...facts } };
    }
    /* R123: the reading follows the filing */
    let pending = false;
    const filedAt = new Date().toISOString();
    /* (fix round 6, G43; K4651) a reading the promotion left out of the provenance file (`readingDropped`: too large to embed) is followed as one never made */
    if (made.readingDropped === true || !(doc.reading && typeof doc.reading === "object")) {
      let held = null;
      if ((await readingVerdict(doc, { env, storeName })).verdict !== "deferred") {
        try { held = await extractionOf(ctx).readHeld({ sha, storeName, env }); } catch { held = null; }
      }
      if (!(held && (held.read === true || held.why === "READING_HELD")) || held.more === true) {
        /* R130: the row is registered through the checked registrar (a fresh stub on a failure); a delivery that cannot register it says nothing of it, and the filing stands */
        const reg = await jobRegistrar({ stub: storeStub(env, storeName), env, storeName })(sha, "reading");
        pending = reg.ok;
      }
    }
    /* (fix round 6, G2; K4577) a finished fetch is recorded for the notice that tells its opener (capture's `recordFetchDone`; one row a session, never throws);
       a render session records none. A record that cannot be made never undoes the filing. */
    if (ld.state && ld.state.fetch_pending) {
      try {
        const cap = captureOf(ctx);
        if (typeof cap.recordFetchDone === "function")
          await cap.recordFetchDone({ session, document: made.bundleId, opener: viewer, project: project || null, at: filedAt });
      } catch { /* the filing stands */ }
    }
    return { ok: true, bundleId: made.bundleId, ...(pending ? { reading_pending: true } : {}) };
  } catch (e) { return { ok: false, reason: "DELIVERY_FAILED", detail: String((e && e.message) || e).slice(0, 200) }; }
}
/* R123 (fix round 4b, F1, F6; D3): the documents a promotion states in its `data/provenance.json` that carry a capture digest and no
   reading (a reading the screen holds goes in with the promotion, extraction R20), in the order stated, each once; none for a verified
   replay, which re-states the record's own past. */
function unreadDocuments(b) {
  if (!b || typeof b !== "object" || Array.isArray(b) || b.replay) return [];
  const prov = Array.isArray(b.files) ? b.files.find((f) => f && f.path === "data/provenance.json" && typeof f.text === "string") : null;
  if (!prov) return [];
  let docs;
  try { docs = JSON.parse(prov.text).documents; } catch { return []; }
  if (!Array.isArray(docs)) return [];
  const out = [], seenShas = new Set();
  for (const d of docs) {
    const sha = d && d.capture && d.capture.sha256;
    if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha) || seenShas.has(sha)) continue;
    seenShas.add(sha);
    /* R123 (fix round 5, E6): a reading the screen holds that left pages of a scan unread owes the OCR pass besides */
    if (d.reading && typeof d.reading === "object") { if (d.reading.tier3_candidate === true) out.push({ sha, document: d, ocrOnly: true }); continue; }
    out.push({ sha, document: d });
  }
  return out;
}
/* R123 (F6): the capture a pull answers (store-door R18's `sha`, else the doorbell's `capture`), with its document when it answers one */
function pulledEntries(result) {
  const sha = result.sha ?? result.capture?.sha256 ?? result.document?.capture?.sha256;
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return [];
  return [{ sha, document: result.document && typeof result.document === "object" ? result.document : { capture: result.capture ?? { sha256: sha } } }];
}

/* R129 (fix round 8, G106; K4428; R-LOG): ONE LINE WHEN AN `acquire` OR A `captureupload` BEGINS AND ONE WHEN IT ENDS. `request_start` is written before the object is asked, `request_done`
   after: `{event, op, total_ms, stages, door, queued_ms, isolate_ms, object_ms}`, the ages of the isolate and of the object (null until the object states its own, R128), the object
   route's `do-` less its `in-` as `queued_ms`, the door's phases, and the stages the object stated when the answer carried them. Counts and instants only: no credential, member,
   address or name, and nothing of the caller's. */
function requestStart(seen, op) {
  seen.began = true;
  const { isolate_ms, object_ms } = seen.clock.cold();
  console.log(JSON.stringify({ event: "request_start", op, isolate_ms, object_ms }));
}
function requestDone(seen) {
  if (!seen.began) return;
  const { isolate_ms, object_ms } = seen.clock.cold();
  console.log(JSON.stringify({ event: "request_done", op: seen.op, total_ms: Math.round(seen.clock.elapsed()), stages: seen.stages ?? {}, door: seen.clock.door(),
                               queued_ms: seen.clock.queued(seen.op), isolate_ms, object_ms }));
}

export function makeFetch(hooks = {}) {
  /* R25: the door's one outermost catch. */
  /* R50: `seen.session` is set once admission has admitted a member's session, so a refusal answered to it is tallied;
     R51: every HTML answer leaves with the page policy. */
  const planeDoor = async function planeDoor(req, env) {
    const clock = makeClock();
    const seen = { session: null, credential: null, cred: null, op: null, trace: null, scriptHashes: undefined, clock };
    let res;
    /* R121: the object is reached through the clocked environment, so each call to it is timed and the phases of an `acquire` are told */
    try { res = await withClock(clock, () => fetch(req, clockedEnv(env, clock), seen)); } catch (e) { res = planeInternalError(e, req); }
    res = await withTrace(res, seen.trace);
    /* R116, R127 (fix round 8, G114): the words answer is read once, for its key, before the tallies; an answer that is the words holds no refusal, so
       the tallies, which look for one, do not read it again (a refusal this op gives is read and tallied as every answer's is) */
    if (seen.op === "interfacewords") { const kept = await interfaceWordsCache(res, req, env); res = kept.res; seen.table = kept.table; }
    if (seen.op === "queue") res = await liftDerivation(res, clock);
    if (!seen.table) await tallySessionRefusal(res, seen.session);
    if (!seen.table) res = await tallyOnTheWayOut(res, seen, req, env);
    /* R75 (fix round 3, C15): a page of the interface leaves with the policy that names its script by hash, in place of a nonce */
    res = await withPagePolicy(res, { scriptHashes: seen.scriptHashes });
    /* R121: every answer of the door states the time it took; the op is the metric when the table declares it, `page` for a page, else `door` */
    const metric = seen.op !== null && Object.hasOwn(OPS, seen.op) ? seen.op : seen.op !== null ? "unknown"
      : /text\/html/i.test(res?.headers?.get?.("content-type") || "") ? "page" : "door";
    requestDone(seen);
    try { clock.shape(new URL(req.url).searchParams); } catch { /* a shape is status */ }
    return withServerTiming(res, clock.header(metric));
  };
  planeDoor.limits = PLANE_LIMITS;
  planeDoor.limitsStatement = PLANE_LIMITS_STATEMENT;
  planeDoor.cronsStatement = PLANE_CRONS_STATEMENT;
  return planeDoor;
  /* R75: the interface's page, built for this request, and the hash of the script it loads, kept for the page policy on the way out */
  function page(req, env, seen, status = 200) {
    const began = Date.now();
    const options = appOptions(env);
    seen.scriptHashes = [interfaceScriptHash(APP_SCREENS, options)];
    const answer = appPage(req, { interfacePage, screens: APP_SCREENS, options, status });
    /* R126 (G30; K4428, K4609): one line per page naming the work the route did in this isolate, as counts (`pageWork`: scripts composed,
       hashes taken, checks run); `ms` is the isolate's clock, which does not see synchronous work (R-CLOCK) */
    console.log(JSON.stringify({ event: "control-plane.page", ...pageWork(), ms: Date.now() - began }));
    return answer;
  }
  async function fetch(req, env, seen = { session: null }) {
    const url = new URL(req.url);
    /* R59 (admission R20; F1, K2044): the credential this request presents, read once — the `Authorization` header's, else
       a JSON body's `token`, never the address's — and every gate below judges it and no other. */
    let reqBody = null;
    if (req.method === "POST")
      try { reqBody = JSON.parse((await req.clone().text()) || "null"); } catch { reqBody = null; }
    const credential = presentedCredential({ req, url, body: reqBody });
    seen.credential = credential;
    /* R128 (K4822): the one name a module in the Worker states its own measure by, handed to the plane's door context and to instance-setup's `io`; the clock keeps it for `Server-Timing` */
    const stateTiming = (name, ms, desc) => { try { seen.clock?.stateTiming(name, ms, desc); } catch { /* a measure is status, never a gate */ } };
    /* R83 (T47; K3144): the page's mark of a background request, read once */
    const background = url.searchParams.get("background") === "1";
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } });

    /* The API lives under /api so the instance can serve its own interface at
       the root. A bare GET of / with no op parameter is a person in a browser
       and gets the page. The legacy root query API (/?op=...) still answers,
       for the one deployment that predates this, and should be dropped once
       that instance is gone. */
    /* R109 (T51; K3807): no route serves a signing page; `/sign` is an unknown address (R104). */
    /* Which version is this? A plain GET, no token, no op parameter, no JSON
       field to know the name of. `op=bootstrap` has always carried the version
       and always will, but "call bootstrap and read the version field" is not
       something anyone should have to be told, and the question gets asked
       after every update. */
    if (req.method === "GET" && (url.pathname === "/version" || url.pathname === "/version/"))
      return new Response((env.VERSION || "0.0.0") + "\n",
        { headers: { "content-type": "text/plain; charset=utf-8",
                     "access-control-allow-origin": "*" } });
    /* R101 (R085-25; K3510): a browser asks for `/favicon.ico` on its own, with no op and no credential. The plane has no
       icon, so it answers 204 with no body, beside `/version`, before any op is read: never `UNKNOWN_OP`. */
    if (req.method === "GET" && url.pathname === "/favicon.ico")
      return new Response(null, { status: 204 });
    /* R82 (T47; N1002; amends R1, R81): `GET /` with no `op` is a person in a browser, and gets the interface's page
       (`interfacePage`; the page draws `front` or Home, interface-shell R32), under R75's gates and policy, `no-store`.
       No route serves the setup page. The namespace and address gates run first, as on `/app` (admission R1, R20; D-475:
       `/?store=nonsense` is refused by name, and nothing below reaches this route). `/version` addresses no
       namespace and is left ungated. */
    if (req.method === "GET" && !url.pathname.startsWith("/api")
        && (url.pathname === "/" || url.pathname === "") && !url.searchParams.get("op")) {
      const pageNamespace = namespaceGate(url);   /* admission R1 */
      if (pageNamespace) return json(pageNamespace.body, pageNamespace.status);
      const pageAddress = addressGate(url);   /* R59: admission R20, before the page is built */
      if (pageAddress) return json(pageAddress.body, pageAddress.status);
      return page(req, env, seen);
    }

    /* R75 (T46): `GET /app`, `/app/<path>` and `/app/assets/<name>`, through the same namespace and address gates as `/`
       (admission R1, R20), before any `op` exists; no credential is read on either route (`app.mjs`). */
    const appRoute = appRouteOf(req, url);
    if (appRoute) {
      const appNamespace = namespaceGate(url);   /* admission R1 */
      if (appNamespace) return json(appNamespace.body, appNamespace.status);
      const appAddress = addressGate(url);   /* R59: admission R20 */
      if (appAddress) return json(appAddress.body, appAddress.status);
      /* R84 (T47; DEC-205): the group's logo, read from the namespace addressed (`store=scratch` reads scratch) */
      if (appRoute === "asset" && logoAsked(url))
        return groupLogoAsset(env, url.searchParams.get("store") === SCRATCH ? SCRATCH : "bio", { json, storeSilent, storeRefusal, doAnswer });
      /* R75 (fix round 3, C15, P2.4): the shell's script, at its versioned address, `immutable` */
      if (appRoute === "script") return appScript(req, url, { source: interfaceScript(APP_SCREENS, appOptions(env)), version: env.VERSION });
      return appRoute === "page" ? page(req, env, seen) : appAsset(req, url, { assets: ASSET_FILES, version: env.VERSION });
    }

    /* R104 (T50; N1174, B-14; interface-shell R79): an address outside the team's pages that names no op draws the
       interface's public "nothing is here" page, 404, and `/doorbell` and `/tour` the same page at 200, through the same
       namespace and address gates as the other page routes; an `op=` request, a path below `/api/` and a path naming
       an op go on below, and `UNKNOWN_OP` stays JSON for them (R2). */
    const addressPage = addressPageOf(req, url, { opNamed: (name) => Object.hasOwn(OPS, Object.hasOwn(OP_ALIASES, name) ? OP_ALIASES[name] : name) });
    if (addressPage) {
      const pageNamespace = namespaceGate(url);   /* admission R1 */
      if (pageNamespace) return json(pageNamespace.body, pageNamespace.status);
      const pageAddress = addressGate(url);   /* R59: admission R20 */
      if (pageAddress) return json(pageAddress.body, pageAddress.status);
      return page(req, env, seen, addressPage.status);
    }

    const path = url.pathname.replace(/^\/api\/?/, "/");
    let op = url.searchParams.get("op") || path.slice(1) || "selftest";
    const askedOp = op;   /* R50: the op the caller asked, before R36's re-route */
    /* R55 (op-declarations R21): a requirement function's name that aliases an op is that op, before every gate: its
       handler, its stamps and its answer, so the two answer alike. */
    if (Object.hasOwn(OP_ALIASES, op)) op = OP_ALIASES[op];
    seen.op = op;
    let spec = Object.hasOwn(OPS, op) && !NOT_ROUTED.includes(op) ? OPS[op] : undefined;   /* R2: the table's own keys only */
    /* R36 (N364; capture R32, R65): a knock resolved to `pulled` is R65's pull, so it is routed as `op=inboxpull` before
       any gate: every gate, stamp and answer it meets is the pull's, the promotion included, and no pull files a capture
       without its bundle. The body is read from a copy; the other statuses stay `inboxresolve`'s. */
    /* DEC-88 (2), K1037: it is capture R32's resolve all the same, so it takes the resolve's reason, which `op=inboxpull`
       asked directly does not (capture R65): `resolving` marks the re-route, and the forward below tells the store's pull
       route so with a stamp of the door's own, never the caller's. */
    let resolving = false;
    if (op === "inboxresolve" && req.method === "POST") {
      let b = null;
      try { b = JSON.parse(await req.clone().text()); } catch { b = null; }
      if (b && typeof b === "object" && !Array.isArray(b) && b.status === "pulled") {
        op = "inboxpull"; spec = OPS.inboxpull; resolving = true;
      }
    }
    /* DEC-49 REGION is-unknown-op
       D-278 (C-69.1). `error` stays "unknown op" BYTE-IDENTICAL and stays the
       FIRST key after `ok`: a client reads the sentence to tell
       an older plane from a refusal (I3), and R2's test (`test/m/control-plane/
       doors.test.mjs`) holds both at the interface. */
    if (!spec) return json({ ok: false, error: "unknown op", reason: "UNKNOWN_OP", ...dispatchRow("UNKNOWN_OP"),
                             op }, 400);
    /* END DEC-49 REGION is-unknown-op */

    /* R28: admission R1 (a `store=` naming no namespace), before any credential is read; then the presented agent
       credential's row, read ONCE (admission R6) and reused by the admission and the readers below, because the
       confinement is a property of the row; admission R2 (a confined credential held to `scratch`), before R3 (a public
       op pinned to `bio`), so a confined caller reaching a bio-pinned public op is told which fence stopped it. */
    const refused = (r) => json(r.body, r.status);
    const unknownNamespace = namespaceGate(url);
    if (unknownNamespace) return refused(unknownNamespace);
    /* R59, R28 (admission R20; K2111): a credential or secret in the address, refused C-38.10 directly after R1, before
       any credential is judged, any public op runs or any store is asked */
    const inAddress = addressGate(url);
    if (inAddress) return refused(inAddress);
    /* R28 (K1861 (6)): admission's query gate, which never refuses: what an op may take only from the body (a door's key,
       link and cover; the group key) and a public door's `token` leave the URL before anything reads it (R54, R56). */
    queryGate(url, op, credential);
    const presentedAi = await aiCredentialPresented(url, env, doAnswer, { credential, op });
    seen.cred = presentedAi.cred ?? null;
    if (presentedAi.silent) return storeSilent(presentedAi.silent.op, presentedAi.silent.correlation);
    const confinedNamespace = confinedNamespaceGate(url, presentedAi.cred);
    if (confinedNamespace) return refused(confinedNamespace);
    const pinnedNamespace = pinnedNamespaceGate(url, op, spec);
    if (pinnedNamespace) return refused(pinnedNamespace);

    /* Unauthenticated by design. Each one gates itself. */
    if (spec.classes === null) {
      /* R28, R58 (admission R21; F4): the public ops' window first, before the op reads or writes anything; then who is
         calling, as admission knows them (a keyed fingerprint and a country, never the address), the stamps `claim`,
         `login` and `recover` take (credentials R1, R4, R47) and capture's knock its `country` (its R85). */
      const windowed = await doorWindowGate({ req, env, op, spec, doAnswer, credential, background });
      if (windowed.refusal) return refused(windowed.refusal);
      /* (T38; K2326) the window's answer carries the source; when the window was not read, `sourceOf` is asked again
         only where it needs no store (the fingerprint key bound), so a store fault is never asked a second time and the
         source is then `null`, as admission R21 states for a store that cannot be asked */
      const source = windowed.source ?? (typeof env.KNOCK_FINGERPRINT_KEY === "string" && env.KNOCK_FINGERPRINT_KEY
        ? await sourceOf(req, env) : null);
      const country = countryOf(req);
      const doorStamps = new URLSearchParams({ ...(source ? { source } : {}), ...(country ? { country } : {}) }).toString();
      const fp = await fingerprint(env.ADMIN_TOKEN);
      const stub = storeStub(env, "bio");
      /* Claiming and logging in are pinned to `bio` above, because an instance
         has ONE identity and there is nothing to claim in a scratch namespace.
         The INVITATION ops are different: the token IS the authority and it
         exists in exactly one store, so an unauthenticated caller naming a
         store gains nothing they do not already have, and pinning them to `bio`
         made an invitation created in `scratch` unredeemable. `memberadd` in
         `scratch` answered ok and handed over a token that could never work,
         which is a silent dead end and made the scratch namespace useless for
         rehearsing the member surface. Found against the deployed plane while
         closing D-41, not by the suite. */
      const invStub = url.searchParams.get("store") === SCRATCH
        ? storeStub(env, SCRATCH) : stub;
      if (op === "claim") {
        const body = await req.json().catch(() => ({}));
        /* DEC-49 REGION is-bootstrap-claim
           D-278 (C-68.2–.4): installation facts, each `error` byte-identical, and
           no row says more than its sentence did. */
        if (!env.ADMIN_TOKEN) return json({ ok: false, reason: "BOOTSTRAP_CREDENTIAL_UNSET",
          ...installationRow("BOOTSTRAP_CREDENTIAL_UNSET"), error: "instance has no bootstrap credential set" }, 409);
        if (!(await liveToken(env.ADMIN_TOKEN)))
          return json({ ok: false, reason: "BOOTSTRAP_CREDENTIAL_PUBLISHED", ...installationRow("BOOTSTRAP_CREDENTIAL_PUBLISHED"),
            error: "bootstrap credential is a published repository value and can never arm a claim; set a fresh ADMIN_TOKEN in the Cloudflare dashboard" }, 409);
        if (body.bootstrapToken !== env.ADMIN_TOKEN)
          return json({ ok: false, reason: "BOOTSTRAP_CREDENTIAL_MISMATCH", ...installationRow("BOOTSTRAP_CREDENTIAL_MISMATCH"),
            error: "bootstrap credential does not match" }, 403);
        /* END DEC-49 REGION is-bootstrap-claim */
        /* R97 (T49; N1072, K3265; credentials R74, R75): the body's `handle` crosses beside `password`, and no `role` (the
           claim names the founder by `admin`, credentials R67); the answer is relayed with the `handle` it carries */
        return relayAnswer(stub.fetch(new Request(`http://do/claim?fp=${fp}${doorStamps ? `&${doorStamps}` : ""}`, {
          method: "POST", body: JSON.stringify({ handle: body.handle, password: body.password }) })), "claim");
      }
      /* ===== REC-126 / DEC-31 / IC-145: THE REVIEW COPY'S READ AND COMMENT (R20) ====== */
      /* ===== REC-126 / DEC-31 / IC-145: THE REVIEW COPY'S READ AND COMMENT ======

         UNGATED, because the reader it exists for holds no credential of this
         instance. Two doors and nothing else:
           - `secret=` — a RECIPIENT. The value is HASHED HERE and only the
             fingerprint crosses to the store (`aicredentialmint`'s rule: nothing
             past this line has ever held the value). ANY presented value takes
             this door, including an empty or malformed one, so a malformed secret
             travels the same path as a revoked one and meets the same bytes.
           - otherwise the caller's session or credential, resolved by
             `caseReader` exactly as the unsigned case document resolves it, and
             the store asks standing in the producing project.
         Every caller who is neither a live grant's holder nor a member with
         standing receives ONE answer — the store's `#noReviewCopy`, built from no
         argument — at ONE status, so revoked, never-issued, malformed, a draft
         that does not exist and a draft the caller cannot see are the same bytes.
         The inner URL is built from nothing of the caller's but `draft` (and, for
         `statementack`, its subject and the acknowledger's `reason`, below). */
      /* D-150: `statementack` takes these two doors, and a member may name an unsigned case
         document (`case` + `edition`) in place of a draft. */
      if (op === "reviewcopy" || op === "reviewcomment" || op === "statementack") {
        const bySecret = credential.secret !== null;   /* R59 (admission R20): the body's `secret` */
        let reader = null;
        if (!bySecret) {
          const found = await caseReader(url, env, "bio", presentedAi.cred, credential);   /* admission's `readerOf` */
          if (found.silent) return storeSilent(found.silent, found.correlation);
          reader = { viewer: found.viewer };
        }
        const built = await secretDoorRequest({ op, req, url, credential, reader,
          narrow: bySecret ? { query: op === "reviewcopy" ? ["draft", "limit"] : op === "statementack" ? ["draft", "reason"] : ["draft"], body: op === "reviewcomment" ? ["text"] : [] } : null });
        const inner = new URL(built.url);
        const q = inner.searchParams;
        /* R20 (fix round 6, G12c): a member's read of several drafts at once names them in `drafts`; a grant's secret opens one copy, so a holder's read is single */
        if (op === "reviewcopy" && !bySecret && !q.get("drafts")) {
          const listed = reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) && Array.isArray(reqBody.drafts) ? reqBody.drafts.filter((d) => typeof d === "string").join(",") : "";
          if (listed) q.set("drafts", listed);
        }
        /* DEC-88 (case-inputs R1, was case-authoring R19, C-82.8): an acknowledgement carries the acknowledger's own words, on either door, in
           the query as case-inputs' `statementack` arm reads them: the caller's `reason=`, else a POST body's string `reason`, verbatim.
           An absent reason stays absent, refused there. */
        if (op === "statementack" && q.get("reason") === null && reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) && typeof reqBody.reason === "string")
          q.set("reason", reqBody.reason);
        const out = await doAnswer(stub.fetch(inner.toString(),
          built.body === undefined ? undefined : { method: "POST", headers: built.headers, body: built.body }));
        return reviewAnswer(out, op, {}, op === "reviewcopy" && out.answered && out.result?.ok ? await groupOf(stub, out.result.project) : null,
                            op === "reviewcopy" ? (project) => groupOf(stub, project) : null);
      }
      /* The sign-in and the invitation's two steps, relayed to the store's routes (credentials' `login`, membership's
         `invitelook` and `enroll`) and answered through R24's relay (D-679). The invitation ops answer from the store
         the caller names (`invStub` above). Moved from legacy-index at T19 (its door share). */
      /* R83 (T47; K3084; credentials R65, R67): `login` takes the body's `handle`, `password` and `device` alone and
         sends no `role` (the founder signs in by the handle `admin`, credentials R67); nothing else of the body crosses,
         and the password is relayed once and never logged, kept or echoed here (R30). */
      if (op === "login") {
        const b = await req.json().catch(() => null);
        const o = b && typeof b === "object" && !Array.isArray(b) ? b : {};
        return relayAnswer(stub.fetch(new Request(`http://do/login${doorStamps ? `?${doorStamps}` : ""}`, {
          method: "POST", body: JSON.stringify({ handle: o.handle, password: o.password, device: o.device }) })), "login");
      }
      /* R58 (credentials R47; K1888): `recover`, credential-free as `login` is, pinned to `bio`: its `role`, `code` and
         `password` from the body alone, relayed once and never logged, kept or echoed here (R30); `source` and `country`
         the door's. */
      if (op === "recover") {
        const b = await req.json().catch(() => null);
        const o = b && typeof b === "object" && !Array.isArray(b) ? b : {};
        /* (T47; credentials R67, amending its R47) and its `handle`, from the body alone, so a member recovers by handle */
        return relayAnswer(stub.fetch(new Request(`http://do/recover${doorStamps ? `?${doorStamps}` : ""}`, {
          method: "POST", body: JSON.stringify({ role: o.role, handle: o.handle, code: o.code, password: o.password }) })),
          "recover");
      }
      /* R83 (T47; K3084; credentials R69, R71 (6)): the administrator's reset link looked at and used, credential-free as
         `recover` is, pinned to `bio`: the `link` and the new `password` from the body alone, never the address, relayed
         once and never logged, kept or echoed here (R30); `source` and `country` the door's. */
      if (op === "passwordresetlook" || op === "passwordreset") {
        const b = await req.json().catch(() => null);
        const o = b && typeof b === "object" && !Array.isArray(b) ? b : {};
        const pass = op === "passwordreset" ? { link: o.link, password: o.password } : { link: o.link };
        return relayAnswer(stub.fetch(new Request(`http://do/${op}${doorStamps ? `?${doorStamps}` : ""}`, {
          method: "POST", body: JSON.stringify(pass) })), op);
      }
      if (op === "invitelook" || op === "enroll") {
        const body = await req.json().catch(() => ({}));
        return relayAnswer(invStub.fetch(new Request(`http://do/${op}`, {
          method: "POST", body: JSON.stringify(body) })), op);
      }
      /* R84 (T47; DEC-205; instance-setup R85, R86): the languages the group's members use, a public read, answered from
         the store the caller names as the invitation's two steps are; nothing of the caller crosses. */
      if (op === "grouplanguages") return relayAnswer(invStub.fetch(new Request("http://do/grouplanguages", { method: "GET" })), op);
      /* R54 (membership R101, R104; admission R17): the group website's and the join page's calls, answered as the
         invitation's two steps are, from the store the caller names (admission R3 lists them among the public ops that
         address `scratch`: each namespace holds its own key and link). Only the body's key (or link), cover and the
         website's approver cross, nothing of whoever called, and the one-time invitation is relayed once, never kept
         here (R30). */
      if (op === "websiteinvite" || op === "joinlinkinvite") {
        const b = await req.json().catch(() => null);
        const o = b && typeof b === "object" && !Array.isArray(b) ? b : {};
        const pass = op === "websiteinvite" ? { key: o.key, cover: o.cover, approvedBy: o.approvedBy } : { link: o.link, cover: o.cover };
        return relayAnswer(invStub.fetch(new Request(`http://do/${op}`, { method: "POST", body: JSON.stringify(pass) })), op);
      }
      /* R54 (membership R110): the group's self-description, the viewer read as admission's `readerOf` reads who is asking
         (`""` for no one) in the store the caller names, so the public receives only what membership answers the public. */
      if (op === "groupdescription") {
        const reader = await caseReader(url, env, url.searchParams.get("store") === SCRATCH ? SCRATCH : "bio", presentedAi.cred, credential);
        if (reader.silent) return storeSilent(reader.silent, reader.correlation);
        return relayAnswer(invStub.fetch(`http://do/groupdescription?viewer=${encodeURIComponent(reader.viewer)}`), op);
      }
      /* R70 (N797; membership R123; op-declarations R42; admission R3): the handle's check, answered as the invitation's
         two steps are, from the store the caller names: only the body's `invite` and `handle` cross, with `viewer` read
         as `groupdescription`'s is (`""` for no one), so an invitee asks with the invitation and a signed-in member
         without one; nothing else of the caller crosses, and membership's answer is relayed as given (it names no
         member, session or invitation). */
      if (op === "handlecheck") {
        const b = await req.json().catch(() => null);
        const o = b && typeof b === "object" && !Array.isArray(b) ? b : {};
        const store = url.searchParams.get("store") === SCRATCH ? SCRATCH : "bio";
        const reader = await caseReader(url, env, store, presentedAi.cred, credential);
        if (reader.silent) return storeSilent(reader.silent, reader.correlation);
        return relayAnswer(invStub.fetch(new Request(`http://do/handlecheck?viewer=${encodeURIComponent(reader.viewer)}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ invite: o.invite, handle: o.handle }) })), op);
      }
      /* R44 (K921): the template grant's four doors, a recipient's secret or a member's session (above). */
      if (TEMPLATE_GRANT_DOORS.includes(op)) return templateGrantDoor({ req, url, env, op, spec, presentedAi, stub, credential });
      if (op === "instancegroup" || op === "groupidentity") return groupRead(op, url, env, presentedAi, credential, stateTiming);
      if (op === "knockerconsent") return knockerConsent(req, stub);
      /* R45 (DEC-111, K1170; public-read R18, R10): network-notices' public reads, each asked by its own name, served by
         public-read's door read from the published store (`stub`, `bio`; a `store=scratch` was refused above), with no
         credential and none of the caller's stamps; the read is handed only the parameters it declared. Asked as
         `op=publicread&name=<name>`, the same read is the public hook's (plane's, through `publicReadDoorOp`). */
      /* R49 (case-checker R15): case-checker's two public reads, by the same door read; R49 (T51, K4230): case-inputs' one. */
      if (NETWORK_NOTICES_PUBLIC_READS.includes(op) || CASE_CHECKER_PUBLIC_READS.includes(op) || CASE_INPUTS_PUBLIC_READS.includes(op)) {
        /* R17, R45: a public read carries no caller and so no stamp; the caller's copies of the op's declared stamps, of `session`
           and of an ask's `grant` are deleted before the read is asked, as for every other op */
        const clean = new URL(url);
        for (const k of ["grant", "session", ...(OP_STAMPS[op] || [])]) clean.searchParams.delete(k);
        return publicReadDoorRead(op, clean, env, stub, { json, requiredArgument, storeSilent, storeRefusal, doAnswer });
      }
      /* The public ops whose handlers are their modules' (publication, public-read, instance-setup, capture). */
      return hooks.publicOp({ req, url, env, op, stub, invStub, fp, presentedAi, credential, source, country, stateTiming });
    }

    /* R28: admission R5–R11 in their order (`admit`): the binding class, the agent credential, the session (its export
       refusal and session gate), the class or the agent's task scope, the capability, the landing. A refusal is answered
       as the gate gives it; a store that could not be asked is a silence, never a statement about the caller. */
    /* R83 (T47; K3084, K3144; credentials R71 (7); admission R23–R25): a request the page makes on its own timer carries
       `background=1`, handed to admission's session read as `background: true` (no activity), and kept in the query the
       store is asked with; the request's parsed body is handed for the run a write names and the re-ask's argument. */
    let admitted = await admit({ url, env, op, spec, method: req.method, presented: presentedAi, doAnswer, credential,
                                 body: reqBody, background });
    if (admitted.silent) return storeSilent(admitted.silent.op, admitted.silent.correlation);
    if (admitted.refusal?.body?.reason === "NOT_AUTHENTICATED") {   /* R53: an ask's grant */
      const granted = await grantAdmit(env, url, op, spec, credential.token);
      if (granted.silent) return storeSilent(granted.silent.op, granted.silent.correlation);
      if (granted.caller || granted.refusal) admitted = granted;
    }
    if (admitted.refusal) return refused(admitted.refusal);
    const caller = admitted.caller;
    const { cls, viaSession, aiCred, storeName } = caller;
    /* REC-132: the session's two halves, apart: `sessViewer` wherever a VISIBILITY gate is stamped, `sessIdentity`
       wherever the question is WHO; `sessMember` the folded id every author, by and actor stamp carries. */
    const { member: sessMember, viewer: sessViewer, identity: sessIdentity, rights: sessRights, caps: sessCaps } = caller;
    /* R106 (T50; N1186, K3557; admission R30, credentials R79): THE VIEWER OF AN `ai` CALLER is the one admission answers,
       the principal's viewer carrying the project its credential was minted for (the plain principal's viewer when it was
       minted with none), so what the caller reads is what membership R149 admits within that project. Every viewer stamp
       below, the sight ones and the promotions' `actorViewer`, takes it; identity and author stamps keep the principal. */
    const aiViewer = cls === "ai" ? callerViewer(caller, { carry: false }) : null;

    /* D-9. The register audit finishes HERE and not in the Durable Object,
       because classifying a register row needs R2, and the DO neither holds the
       store name nor should guess it: capture keys are `<store>/captures/<sha>`.
       This is the SAME probe the gate already uses on the ratify path, where
       runGate enforces "bytes the register claims must exist" and refuses with
       PLANE_MISSING_BYTES. Making the diagnostic ask the same question as the
       enforcer, rather than inventing a second answer, is the whole point: the
       first version of this audit looked only in `files` and `history`, called
       everything else "dropped", and produced a confident wrong finding that
       the Apps Script migration was unauditable. The bytes were in R2. */
    /* op=whoami. What the caller is and what they may DO, so an interface can
       satisfy section 5's "absent from their interface" without keeping its own
       copy of the capability rules and letting it drift.

       A machine credential holds NO capabilities and the honest answer is null
       rather than an empty list or a full one: there is no member behind a token
       class, so there is nothing to hold them. What bounds a machine caller is
       the op table and the scratch confinement, and reporting it as though
       section 5 applied would be inventing a member who does not exist.

       `vocabulary` is the full set, so an interface can tell "not held" from
       "not a capability at all" without hardcoding the list. */
    if (op === "whoami") {
      return json({ ok: true, result: {
        tokenClass: cls,
        session: viaSession,
        member: viaSession ? sessMember : null,
        handle: viaSession ? (sessRights.handle ?? null) : null,
        administer: viaSession ? !!sessRights.administer : cls === "admin",   /* R18: the root of trust administers */
        rootOfTrust: viaSession ? !!sessRights.rootOfTrust : false,
        capabilities: viaSession ? [...sessCaps].sort() : null,
        vocabulary: Membership.CAPABILITIES,
        /* D-463: WHETHER THIS CREDENTIAL CAN EVER REACH THE RECORD, answered as a value rather than left for a
           caller to infer from the `store` beside it. The two are different facts and an instrument needs both:
           `store` is where THIS call landed, `confinedTo` is where every call it will ever make lands. `null` is
           "not confined", which is the honest answer for a session (a member is not a confined credential) and
           for the four binding classes (an operator sets them in the hosting dashboard, and there is no row to
           carry the property — the probe class's confinement is its CLASS's, read out of `scopeFor`, and is
           reported as `store` on every one of its answers). */
        confinedTo: cls === "ai" && aiCred ? (aiCred.confinedTo ?? null) : null,
        detail: viaSession
          ? "capabilities are set by an administrator and gate what this account may DO, not what it may see"
          : "a machine credential has no member behind it and therefore holds no capabilities; it is bounded "
          + "by the operation table and by namespace confinement instead",
      }, store: storeName, tokenClass: cls }, 200);
    }

    const stub = storeStub(env, storeName);
    /* R130 (fix round 9, G126c; K4811, K4835 (2)): THE JOB ROW, registered through `jobs.mjs`'s registrar and its answer READ. A throw, a silence or a refusal is tried once
       more through a fresh stub; a row that cannot be written is told (`ok: false`), and the caller says no `reading_pending` and states the refusal. */
    const registerJob = jobRegistrar({ stub, env, storeName });
    async function pendSha(sha, kind = "reading", name = null, project = null) { return registerJob(sha, kind, name, project); }
    /* R130: the stated refusal of a reading no row holds: no `reading_pending`, the reason and the member's sentence (a stand-in keyed through `localize`; its row is owed to later-ux.md) */
    const refusedReading = (reg) => ({ reason: "READING_NOT_REGISTERED", registrar: reg && reg.reason ? reg.reason : "PENDING_NOT_KEPT",
      detail: localize("control-plane.reading.not_registered", "the file is kept, but its reading could not be queued, so it is not being read: ask again.") });
    function notRegistered(res, b, reg) {
      const { reading_pending: _p, ...rest } = b;
      const headers = new Headers(res.headers);
      headers.delete("content-length");
      return new Response(JSON.stringify({ ...rest, reading_refused: refusedReading(reg) }), { status: res.status, headers });
    }
    /* R50: from here on, a refusal answered to a member's session is counted (`tallySessionRefusal`, in its namespace). */
    if (viaSession) seen.session = { op: askedOp, stub };

    /* R136 (store-request R1): the store's request is made by `store-request`'s `innerRequest`, below, from the caller admitted and the
       request; this door stamps, strips and carries no credential of its own. `actor` and `stampOf` are the door's reading of who is
       acting, for the arms that follow. */
    const actor = viaSession ? sessViewer : cls === "ai" ? `${MACHINE_CLASS_PREFIX}ai/${aiCred.tokenId}` : `${MACHINE_CLASS_PREFIX}${cls}`;
    const stampOf = { viewer: viaSession ? sessViewer : cls === "ai" ? aiViewer : actor, by: actor };
    /* R28: admission R12 (`bearerFence`), the bearer fences on the §4 governance acts (C-32.17) and the group-identity
       acts (C-64.4), before any handler: how the caller ARRIVED, never which token it held. */
    const fenced = bearerFence(op, caller);
    if (fenced) return refused(fenced);
    /* R16, R28: a promotion's replay is judged here, after the R14 fences and before any handler, from a copy of the
       body (the request's own body stays whole for whoever serves the op). The verdict is the promote block's below. */
    const replay = op === "promote" && req.method === "POST"
      ? await replayVerdict(env, storeName, await req.clone().text(), viaSession, cls) : null;
    /* DEC-49 REGION is-promote-replay-verified */
    if (replay?.asserted && !replay.proven)
      return json({ ok: false, reason: "REPLAY_UNVERIFIED", ...replayRow("REPLAY_UNVERIFIED"), op,
        bundleId: replay.bundleId, provenanceCapture: replay.provenanceCapture,
        detail: `this promotion says it is a replay of the record's own past, and a replay is honoured only when the `
              + `plane can check it: it must name a drive-provenance capture (\`provenanceCapture\`) that this `
              + `promotion registers at ${DRIVE_PROVENANCE_PATH}, whose bytes the record holds, and whose preserved `
              + `promotion records name this record and list this revision's bundle.md SHA-256. One of those did not `
              + `hold. Nothing was written.` }, 403);
    /* END DEC-49 REGION is-promote-replay-verified */
    /* R39 (N408, K621): purge is the only destructive op. It refuses unless the caller names the namespace the request
       resolved to, before the store is called, so a purge never lands somewhere its caller did not name; a probe,
       confined to `scratch`, can confirm only `scratch`. C-61.1 through the one governed helper; `error` byte-identical
       (D-270's pattern), and the helper's `detail` says nothing was changed. */
    if (op === "purge") {
      const confirm = url.searchParams.get("confirm");
      if (confirm !== storeName)
        return json({ ok: false,
                      ...requiredArgument("purge", "confirm", "<store name>",
                                          "purge requires confirm=<store>"),
                      expected: storeName,
                      got: confirm, tokenClass: cls, store: storeName }, 400);
    }
    /* R28: an op whose handler is a module's, reached through plane's hooks, answers here, after the R14 fences and R16;
       undefined falls through to the forward. */
    /* R41 (T35, T36; N695, K1717, K1864, K2135): `op=agentpack` alone serves the fences and the rendered pack: the
       affordances handler is asked untargeted (with no request body: the read takes none) and `packOf` read off its
       answer; a refusal or a silence is answered as that handler gives it. */
    if (op === "agentpack") {
      return agentPackOp({ url, headers: req.headers, stamps: { env, cls, viaSession, sessMember, sessViewer, sessIdentity, sessRights, sessCaps,
        aiCred, aiViewer, storeName, stub, grantMember: aiCred?.grant ? aiCred.principal : undefined },
        gatedOp: hooks.gatedOp });
    }
    /* R58 (K2042 (2)): the promotions after an unpack, Worker-side, one act each, with `op=promote`'s stamps for this
       caller; the archive's project is the request body's `project`, read from a copy before the handler reads the body. */
    const archiveWho = { author: viaSession ? sessMember : `${MACHINE_AUTHOR_PREFIX}${cls}`,
      ...(viaSession ? { actorMemberId: sessMember } : {}),
      actorIdentity: viaSession ? sessIdentity : cls === "ai" ? aiCred.principal : `${MACHINE_CLASS_PREFIX}${cls}`,
      actorViewer: viaSession ? sessViewer : cls === "ai" ? aiViewer : `${MACHINE_CLASS_PREFIX}${cls}`,
      ...(viaSession ? {} : { assistantPrincipal: cls === "ai" ? `${aiCred.principal}/${aiCred.tokenId}` : `${MACHINE_CLASS_PREFIX}${cls}` }) };
    let archiveProject = null, captureStep = null;
    if ((op === "acquire" || op === "unpack") && req.method === "POST")
      try {
        const b = JSON.parse((await req.clone().text()) || "null");
        archiveProject = b && typeof b.project === "string" ? b.project : null;
        captureStep = b && typeof b.step === "string" ? b.step : null;   /* R71: the step a member's fetch is a product of */
        /* R72 (fix round 9, DOCS A1, §6): an uploaded archive is opened by the plane's `unpack` job, which names no project. The archive's members are filed under the
           project of the document that holds the archive (the record, asked by its digest as the administrator sees it, nothing fetched), as a fetched one's are */
        if (op === "unpack" && !archiveProject && b && typeof b.archiveSha === "string" && /^[0-9a-f]{64}$/.test(b.archiveSha)) {
          try {
            const held = await doAnswer(stub.fetch(new Request(`http://do/heldat?sha256=${b.archiveSha}&viewer=${encodeURIComponent("class:admin")}`)));
            const home = held.answered && held.result && held.result.held === true && held.result.copy && typeof held.result.copy.project === "string" ? held.result.copy.project.trim() : "";
            archiveProject = home || null;
            /* the plane's own `unpack` job reaches an uploaded archive before any document holds it: its members would be filed under no project and never move. The archive is
               opened when a document holds it (the job is offered again), not before */
            if (!archiveProject && cls === "daemon" && !viaSession && held.answered && held.result && held.result.held !== true)
              return json({ ok: true, result: { ok: true, complete: false, waiting_on: { code: "ARCHIVE_NOT_FILED" } }, store: storeName, tokenClass: cls }, 200);
          } catch { archiveProject = null; }
        }
      } catch { archiveProject = null; }
    /* (fix round 6, G43; K4651) what an archive's promotion filed without its reading (too large to embed in the provenance file) is followed here, as
       a document stored with none is */
    async function promoteFiled(docs, archiveSha, incomplete = false) {
      const dropped = [];
      const done = await promoteArchive({ stub, doAnswer, docs, project: archiveProject, archiveSha, who: archiveWho, onDropped: (e) => dropped.push(e) });
      /* R134 (fix round 9, G162; K4980): EVERY member it filed is followed, not only those filed without their reading: each one's reading is registered as R130 says
         (a stated one has no row), uploaded and fetched archives alike. The archive's own document is followed only when its reading was dropped. */
      const filed = new Map(docs.map((d) => [d.capture.sha256, d.capture.sha256 === archiveSha ? null : d]));
      const entries = done.promoted.map((p) => ({ sha: p.sha256, document: filed.get(p.sha256) })).filter((e) => e.document);
      for (const d of dropped) if (!entries.some((e) => e.sha === d.sha)) entries.push(d);
      if (entries.length) await followEntries(entries);
      /* R134 (fix round 9, G129e): a member whose put or promotion failed transiently stays owed: the archive's `unpack` job is registered (plane R97, whose retry offers the
         member again, acquisition R38's resume), and the answer says so; a member refused for its own bytes stays named in `not_promoted` and is not retried */
      const owed = done.not_promoted.filter((n) => n.transient === true);
      /* plane R108 (B75 (a)): the `unpack` row is held WITH the archive's project whenever the unpack is not complete, so the job offers the rest under it */
      if ((owed.length || incomplete) && typeof archiveSha === "string") {
        const reg = await pendSha(archiveSha, "unpack", null, archiveProject);
        return { ...done, ...(reg.ok ? { unpack_pending: true } : { unpack_refused: refusedReading(reg) }) };
      }
      return done;
    }
    async function promoteAcquired(res) {
      let b = null;
      try { b = await res.clone().json(); } catch { return res; }
      const docs = archiveDocuments("acquire", b);
      if (!docs.length) return res;
      const done = await promoteFiled(docs, b.document?.capture?.sha256 ?? null, b.unpack?.complete === false);
      return json({ ...b, ...done }, res.status);
    }
    /* R62 (rev. 2 conflict (c); K1888 (3), K1892; DEC-173; BOB's review (8), K2130): A MEMBER'S OPENING OF AN ORIGINAL GOES
       THROUGH `file-safety`. A member's session's or an `ai` credential's GET of a capture's bytes is answered as
       `file-safety.openOriginal({captureSha, viewer})` answers it (its R8), at the store's `openoriginal` route — with
       `warned` in the query, `openwithwarning` with `warned` in its body — never by capture's own read, so no route opens
       a file file-safety would keep to its safe view. Only the digest and the viewer travel; nothing here keeps, logs or
       counts who asked for which file (file-safety R10). The binding classes keep capture's own answer (plane's hook). */
    if (op === "capture" && req.method === "GET" && (viaSession || cls === "ai")) {
      const warned = warnedOf(url);
      const at = new URL(`http://x/${warned === undefined ? "openoriginal" : "openwithwarning"}`);
      at.searchParams.set("capture", (url.searchParams.get("sha256") || "").toLowerCase());
      at.searchParams.set("viewer", viaSession ? sessViewer : aiViewer);
      return byteAnswer(await stub.fetch(new Request(at, warned === undefined ? { method: "GET" }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ warned }) })), op,
        { store: storeName, tokenClass: cls });
    }
    /* R2 (T47; K3167; signin-door R1–R5): the subscription sign-in door is signin-door's. The door hands it the member
       its session names (`by`, never a value the caller sends), the request's parsed body and an ask of the store
       addressed; who reaches each op (a member's own session; `signintrace` an administrator's) is admission's, above.
       Each answer is signin-door's `{status, body}`, sent as JSON (answer-envelope decorates a refusal with its row). */
    const stored = (path, init) => doAnswer(stub.fetch(new Request(`http://do/${path}`, init)));
    if (op === "subscriptionsignin") {
      const signed = await subscriptionSignin({ env, member: stampOf.by, asked: reqBody, store: stored });
      return json(signed.body, signed.status);
    }
    if (op === "signintrace") {
      const traced = await signintrace({ env, store: stored });
      return json(traced.body, traced.status);
    }
    if (op === "subscriptiondisconnect") {
      const out = await subscriptionDisconnect({ env, member: stampOf.by, store: stored });
      if (out.refused) return storeRefusal(out, { store: storeName, tokenClass: cls });
      if (!out.answered) return storeSilent(op, out.correlation);
      return json({ ...out.reply.body, store: storeName, tokenClass: cls }, out.reply.status);
    }
    /* R57 (T46; N917; plane R40, R41; agent-worker R76): `textcheck` has no owner before the draft: the door asks the
       plane's draft door with the body's `text` alone (no told, grant or firsthand, no `checkDraft`), which gates it and
       answers it labelled; nothing is recorded or handed to `filings` here. Only a member's session reaches the op (its
       spec). A conversation that reached the model is counted to the member's day as a draft (ai-use R1). */
    /* (T46) an object that offers no draft door or member-run dispatch is an instance with no assistant bound (plane's
       `AGENT_WORKER_UNBOUND`, as R65's): nothing is sent */
    /* R93 (T48; N1015; K3103): THE TRACE AND THE MEMBER REF of a request that reaches the plane's ask, run, draft or
       transcribe call, minted here for each (a fresh trace; the member ref naming the session's member, signin-door R3's
       form, never a handle or a credential) and handed to that call in process. Neither is taken from the caller: a
       `trace` in the address or the body is read by nothing here. The trace is answered with the request (`withTrace`). */
    const isTraced = viaSession && TRACED_OPS.includes(op);
    const trace = isTraced ? mintTrace() : undefined;
    const memberRef = isTraced ? await memberRefOf(env, stampOf.by) ?? undefined : undefined;
    seen.trace = trace ?? null;
    /* R90 (T48; N670): `readtranslate` is, like `textcheck`, a draft with no owner before it: the door asks the plane's draft
       door with the body's `subject` and `language` alone; the plane reads the subject only as the member may and answers
       the translation labelled (`plane` R50). */
    if (op === TEXT_CHECK || op === READ_TRANSLATE) {
      return draftCheckOp({ op, stub, viaSession, sessMember, session: credential.token, reqBody, trace, memberRef, by: stampOf.by,
                            viewer: sessViewer, store: stored, storeName, cls });
    }
    /* R77, R80 (T46, T47; N919, N955; Bob's K2892, K2947, K2952; K2976, K2999, K3027; ai-runs R18, credentials R63): THE
       MEMBER-RUN DOOR, WITH NO CREDENTIAL FROM THE PAGE. A member's own run, opened on her own sign-in, is dispatched at her
       act by `ai-runs.dispatchMemberRun`, in the store object addressed (plane's `dispatchMemberRun` RPC on the object, as
       its `draft` and `ask` are), with `by` and `viewer` the member her session names (R17), `run` from the body alone. No
       credential is read for it or passed on: a credential presented in a header, body or query reaches nothing here, and
       the segment's credential is minted in the plane (credentials R63, at ai-runs R18's call). Any caller not arriving by
       a session is stamped by R17's machine form and refused by ai-runs itself. Its answers, withholdings and refusals are
       ai-runs', as given. */
    if (op === "airundispatch") {
      return airunDispatchOp({ stub, reqBody, who: viaSession ? sessViewer : actor, at: new Date().toISOString(), trace, memberRef, storeName, cls });
    }
    /* R105 (T50; N1117; K3369, K3627; acquisition R47 `BAD_FOR`, C-139.21; capture R83): A MEMBER'S `for` IS JUDGED FOR
       SIGHT BEFORE ANY FETCH. `acquire`'s `for`, read by acquisition only from a member's session, names by id the question
       the capture is for; acquisition judges its shape (a malformed one is its own `BAD_FOR`), and this door judges whether
       she may see it: the store's `inquirypartition` read is asked as her viewer, and only an answered question is
       accepted. A question she may not see, one that does not exist and a bundle that is no question are one answer, the
       same `BAD_FOR` row acquisition gives (one code, one sentence), nothing fetched, written or filed. A store that does
       not answer is a silence, never a verdict on her `for`. Any other caller's `for` is acquisition's to ignore. */
    if (op === "acquire" && viaSession && req.method === "POST" && reqBody && typeof reqBody === "object" && !Array.isArray(reqBody)
        && typeof reqBody.for === "string" && reqBody.for.trim() && reqBody.for.length <= FOR_MAX) {
      const sight = await doAnswer(stub.fetch(new Request(
        `http://do/inquirypartition?id=${encodeURIComponent(reqBody.for)}&viewer=${encodeURIComponent(sessViewer)}`, { method: "GET" })));
      if (!sight.refused && !sight.answered) return storeSilent(op, sight.correlation);
      if (sight.refused || !sight.result || sight.result.ok !== true) {
        const row = ARCHIVE_CHECKS.BAD_FOR;
        return json({ ok: false, reason: "BAD_FOR", code: "BAD_FOR", check: row.check, translation: row.translation, op,
                      store: storeName, tokenClass: cls }, 400);
      }
    }
    /* R105 (T50; T51: N1234, DEC-329 (5); K3770): THE DOOR ANSWERS `acquire` WITHIN A BOUND, 25 seconds: past it the answer
       is the refusal `ACQUIRE_TIMED_OUT`, its `detail` read by `word("refusal.ACQUIRE_TIMED_OUT")` as R99 reads
       `AGENT_WORKER_UNBOUND`'s (no sentence of this module's), never a silent stop. The handler is not cancelled: a capture it goes on to file stands, and the member's next look finds it. */
    /* R115 (T51; K4222; acquisition R95; K4234 (B13)): the object `acquire` keeps current as its stages run, handed to it through the
       plane's hook. The object is not the door's, so the stages are kept by the object under the request's trace: a session's
       `acquire` is minted one here and handed to the hook as `trace`. A call the door stops waiting for is answered with the stage
       times the object answers for that trace on its store-internal read `acquiretimings`, `{}` when the request has none or the
       object answers none. */
    const timings = op === "acquire" ? {} : null;
    const acquireTrace = op === "acquire" && viaSession ? mintTrace() : undefined;
    const acquireStages = async () => {
      if (!acquireTrace) return {};
      const asked = await doAnswer(stub.fetch(new Request(`http://do/acquiretimings?trace=${encodeURIComponent(acquireTrace)}`)));
      const times = asked.answered ? asked.result?.stageTimes : null;
      return times && typeof times === "object" && !Array.isArray(times) ? times : {};
    };
    /* R121 (fix round 4, C5a; amends R115): the timings of an `acquire` that failed or was stopped: the object's stage record as it states it (R95; its
       `stages` are `{}` when it states none) beside `door`, the three phases as the door's own clock saw them. The clock is the door's, so
       it stands though the object was stopped or restarted and lost its stages. */
    const failedTimings = (stages) => {
      const given = stages && typeof stages === "object" && stages.stages && typeof stages.stages === "object" ? stages.stages : {};
      seen.stages = given;
      return { ...(stages && typeof stages === "object" && !Array.isArray(stages) ? stages : {}), stages: given, door: seen.clock.door() };
    };
    const bounded = (work) => {
      if (op !== "acquire") return work;
      let timer;
      const late = new Promise((resolve) => { timer = setTimeout(() => resolve("late"), hooks.acquireBoundMs ?? ACQUIRE_BOUND_MS); });
      return Promise.race([work, late]).then(async (got) => {
        clearTimeout(timer);
        if (got !== "late") return got;
        /* R105, R115 (fix round 2, C12): what was kept is read off the stages the object states, and the design's sentence ("kept
           nothing") is said only where nothing was */
        const stages = await acquireStages();
        let kept = keptOf(stages);
        /* (fix round 6, G2, G3) a capture the record holds is kept whatever this call's stages say */
        if (kept !== "held" && viaSession && reqBody && typeof reqBody === "object" && !Array.isArray(reqBody)
            && await keptInStore(stub, { address: typeof reqBody.locator === "string" ? reqBody.locator : null,
                                         session: typeof reqBody.continue === "string" ? reqBody.continue : null, viewer: sessViewer })) kept = "held";
        return json({ ok: false, reason: "ACQUIRE_TIMED_OUT", code: "ACQUIRE_TIMED_OUT", op, store: storeName, tokenClass: cls,
                      ...(detailKey(kept) ? { detail: word(detailKey(kept)) } : {}), kept, timings: failedTimings(stages) }, 504);
      }, (e) => { clearTimeout(timer); throw e; });
    };
    /* R120 (fix round 4, C5a/P8; K4434): THE READING THAT WILL NOT FIT THE BOUND FOLLOWS. The handler asks this of the document it has just
       filed, before it reads it: a PDF over 2 MB, or any document once what is left of R105's bound is under the 8 seconds a reading is given,
       is answered when kept with `reading_pending: true` and no reading; the reading follows by `readHeld` and the plane's alarm. */
    /* R125 (fix round 5, E6; K4530): THE OCR PRESS HANDS THE PAGES TO THE LEDGER AND ANSWERS AT ONCE. "Read this document again with OCR"
       (`pdfstructure` with `ocr`) from a member's session, for a copy whose reading (as she sees it: the reading's own redaction) names pages
       a scan left unread, with an OCR member bound, writes the `ocr` entry down (plane R77: a pass reads 24 pages, the ledger goes on by cursor)
       instead of reading 24 pages inside the request. Any other press is the owner's, whose refusals it keeps. */
    if (op === "pdfstructure" && viaSession && url.searchParams.get("ocr") && env.OCR_WORKER) {
      const sha = (url.searchParams.get("sha256") || "").toLowerCase();
      if (/^[0-9a-f]{64}$/.test(sha)) {
        const seenReading = await doAnswer(stub.fetch(new Request(`http://do/reading?sha256=${sha}&viewer=${encodeURIComponent(sessViewer)}`)));
        const rv = seenReading.answered ? seenReading.result : null;
        if (rv && rv.found === true && rv.bundle_id && rv.reading && rv.reading.tier3_candidate === true) {
          const reg = await pendSha(sha, "ocr");   /* R130: the row is held, or the answer says it is not */
          if (!reg.ok) return json({ ok: true, result: { ok: true, sha256: sha, reading_refused: refusedReading(reg) }, store: storeName, tokenClass: cls }, 200);
          return json({ ok: true, result: { ok: true, ocr_pending: true, reading_pending: true, sha256: sha }, store: storeName, tokenClass: cls }, 200);
        }
      }
    }
    /* async since B70 (2): the container gate reads the central directory; plane awaits it (R76) */
    const deferReading = async (document) => op === "acquire" && await readingWontFitHere(document);
    /* R129 (fix round 8, G106): the line that says this request began is out BEFORE the object is asked, for Workers Logs lost the tail of a long firing */
    if (op === "acquire") requestStart(seen, op);
    const armed = hooks.gatedOp ? await bounded(hooks.gatedOp({ req, url, env, op, cls, viaSession, stateTiming, deferReading: op === "acquire" ? deferReading : undefined, sessMember, sessViewer,
      sessIdentity, sessRights, sessCaps, aiCred, aiViewer, storeName, stub, memberRef,   /* R93: the plane's ask and transcribe; R106: the `ai` caller's viewer */
      trace: trace ?? acquireTrace,   /* K4234: `acquire`'s trace, the key its stages are kept under */
      grantMember: aiCred?.grant ? aiCred.principal : undefined, timings })) : undefined;   /* R53 (K1684): an ask's grant's member; R115: `acquire`'s timings */
    if (armed && op === "acquire") {
      seen.clock.begin("promote");
      const promoted = await promoteAcquired(armed);
      seen.clock.end("promote");
      let followed2 = await readHeldAfterAcquire(promoted);
      /* (fix round 6, G14) a reading the acquire made that answers `more` is continued by cursor */
      try {
        const fb = await followed2.clone().json();
        if (fb && fb.ok === true && fb.reading_pending !== true && fb.document?.reading?.more === true) {
          const headers = new Headers(followed2.headers);
          headers.delete("content-length");
          followed2 = new Response(JSON.stringify({ ...fb, reading_pending: true }), { status: followed2.status, headers });
        }
      } catch { /* not a JSON answer */ }
      await pendReading(followed2);
      const res = await doorTimedFailure(followed2);
      if (!captureStep && url.searchParams.get("step") === null) return res;
      let body;
      try { body = await res.clone().json(); } catch { return res; }
      return tieToStep({ body, status: res.status }, captureStep ?? url.searchParams.get("step"));
    }
    /* signin-door R4, R108: an ask answered SIGNIN_TOKEN_REFUSED (plane's ask arm) drops the member's held sign-in; the
       answer is unchanged, and a stream is handed on as the plane writes it (`watchedAsk`) */
    if (armed && op === "ask" && viaSession) return watchedAsk(armed, { member: stampOf.by, store: stored });
    if (armed) return armed;
    /* The forward's answer, read once through `doAnswer`: the store's refusal at its status, a silence a silence. */
    async function forwarded(res) {
      const out = await doAnswer(Promise.resolve(res));
      if (out.refused) return { early: storeRefusal(out, { store: storeName, tokenClass: cls }) };
      if (!out.answered) return { early: storeSilent(op, out.correlation) };
      return { body: out.reply.body, status: out.reply.status };
    }
    /* R117 (fix round 3, C5, C17; K4356, K4358; extraction R80): A HELD CAPTURE GETS ITS READING. `readHeld` is the store-internal
       route `readheldfor` (this door's own map, no spec, so no caller reaches it): extraction's act, which reads a home that has no
       reading once the evidence store holds its bytes whole, and answers `{ok, read, why?}` (`why`: `NO_HOME`, `READING_HELD`,
       `NO_WHOLE_OBJECT`; never shown to a member, K4365). A refusal or a silence of the route is `null`: it never turns a kept
       capture into a failed one, and the answer it follows is relayed as it was. */
    async function readHeld(sha, document = null) {
      if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return null;
      const subject = document && typeof document === "object" ? document : { capture: { sha256: sha } };
      logRead("start", subject, null);   /* R131: before the await */
      try {
        const asked = await doAnswer(stub.fetch(new Request(`http://do/readheldfor?sha=${sha}&store=${encodeURIComponent(storeName)}`)));
        return asked.answered && asked.result && typeof asked.result === "object" && asked.result.ok === true ? asked.result : null;
      } catch { return null; }
      finally { logRead("end", subject, null); }
    }
    /* R125 (fix round 6, G5): whether the record already holds a made reading for the digest, as the member may see it, asked of the store's plain `reading`
       read (nothing is read, and the owner's `readHeld` is not asked); a statement or a failed reading is not a made one, so it stays owed. */
    async function readingHeld(sha) {
      if (!viaSession || typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return false;
      try {
        const a = await doAnswer(stub.fetch(new Request(`http://do/reading?sha256=${sha}&viewer=${encodeURIComponent(sessViewer)}`)));
        const r = a.answered ? a.result : null;
        return !!(r && r.found === true && r.reading && !r.reading.failure);
      } catch { return false; }
    }
    /* R120: a reading deferred (`reading_pending: true`) is registered with the plane's alarm, the store-internal `pendingadd`, which finishes it by
       `readHeld` within a minute (plane R75); a refusal or a silence of the registration changes nothing the caller receives (the screen's
       promotion and the member's next look still find the capture). */
    async function pendReading(res) {
      let b = null;
      try { b = await res.clone().json(); } catch { return res; }
      const sha = shaOf(b);
      if (!b || b.ok !== true || b.reading_pending !== true || typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return res;
      const reg = await pendSha(sha);
      return reg.ok ? res : notRegistered(res, b, reg);
    }
    /* R120, R123, R131: WHETHER A DOCUMENT'S READING WILL NOT FIT WHAT IS LEFT OF THE BOUND, so it follows by the job table: its size or kind over the inline ceiling
       (`reading-gate.mjs`: a PDF `pdf.request_bytes`, any other kind the proposed 3 MiB, a capture held in more than a reading assembles from parts), or less than
       the 8 seconds a reading is given left of R105's 25. A document over its kind's whole-read ceiling is stated from its sizes with no object read, so the clock is
       no reason to leave it (R125, G7; R132). The synchronous form judges by size and kind alone (the hook the plane's `acquire` calls, sync). */
    function readingWontFit(document) {
      const v = inlineVerdict(document);
      if (v.verdict === "stated") return false;
      return v.verdict === "deferred" || (hooks.acquireBoundMs ?? ACQUIRE_BOUND_MS) - seen.clock.elapsed() < READING_BUDGET_MS;
    }
    /* R131 (2): and, for a stored container, the declared unpacked text of its central directory (no inflation; a corrupt or lying directory counts as large) */
    async function readingWontFitHere(document) {
      if (readingWontFit(document)) return true;
      return (await readingVerdict(document, { env, storeName })).verdict === "deferred";
    }
    /* R131 (fix round 9): the door's own inline read is logged BEFORE it is awaited and after: `{event: "extractread", phase, sha, bytes, container, unpacked_estimate}` */
    function logRead(phase, document, verdict) {
      try {
        console.log(JSON.stringify({ event: "extractread", phase, sha: document?.capture?.sha256 ?? null, bytes: sizeOfDocument(document),
          container: verdict?.container === true, unpacked_estimate: Number.isFinite(verdict?.unpacked_estimate) ? verdict.unpacked_estimate : null }));
      } catch { /* a log is status */ }
    }
    /* R123 (fix round 4b, F1, F2, F6; K4487; D3), R130, R133: A READING FOLLOWS EVERY WAY A DOCUMENT ENTERS THE RECORD. Each document the record now stores with no
       reading (`entries`: `{sha, document}`) has its job row registered BEFORE any inline read starts (R130), and is then read here when the gate admits it (R131)
       and it is among the first READING_FOLLOWED_MAX (extraction's `readHeld`; one made whole or already held ends it); otherwise its row stands and the plane's
       ticks read it: none is dropped (R133). Answers `{pending, refused}`: `pending` true when a reading is owed and its row is held (the answer's `reading_pending`);
       `refused` the digests whose owed reading no row holds (the answer states it, R130). A refusal or a silence of the route is owed too, and none of it ever
       changes what the act answered. */
    async function followEntries(entries) {
      let pending = false;
      const refused = [];
      let inline = 0;
      for (const e of entries) {
        if (e.ocrOnly && !env.OCR_WORKER) continue;
        /* R132: a document over its kind's whole-read ceiling is stated from its sizes by the reader: no row is registered for it, and it is never deferred */
        if (!e.ocrOnly && (await readingVerdict(e.document, { env, storeName })).verdict === "stated") { try { await readHeld(e.sha, e.document); } catch { /* the statement is made by the next read */ } continue; }
        const reg = await pendSha(e.sha, e.ocrOnly ? "ocr" : "reading");   /* R130: the row first */
        const owe = () => { if (reg.ok) pending = true; else refused.push(e.sha); };
        if (e.ocrOnly) { owe(); continue; }
        if (inline >= READING_FOLLOWED_MAX || await readingWontFitHere(e.document)) { owe(); continue; }
        inline++;
        const held = await readHeld(e.sha, e.document);
        if (held && (held.read === true || held.why === "READING_HELD")) {
          /* E6: pages of a scan left unread are owed to the OCR pass, which the ledger goes on with by cursor */
          if (held.owed === true) { const ocr = await pendSha(e.sha, "ocr"); if (ocr.ok) pending = true; else refused.push(e.sha); }
          /* (fix round 6, G14; K4578) a reading that answers `more` is continued by cursor by the ledger, for every format */
          if (held.more === true) owe();
          continue;
        }
        owe();
      }
      return { pending, refused };
    }
    /* R130: the promote and the pull answers carry the follow's outcome: `reading_pending` while a row is held for an owed reading, `reading_refused` for one no row holds */
    const followedAnswer = (body, followed) => ({ ...body.result, ...(followed.pending ? { reading_pending: true } : {}),
      ...(followed.refused.length ? { reading_refused: { ...refusedReading({ reason: "PENDING_NOT_KEPT" }), count: followed.refused.length } } : {}) });
    /* R121: an `acquire` the handler answers as a failure of the capture (a 502 or 504, the silence of the object, a capture not kept)
       carries the timings of R121 beside whatever the handler stated; any other answer is the handler's, untouched. */
    async function doorTimedFailure(res) {
      let b = null;
      try { b = await res.clone().json(); } catch { return res; }
      if (!b || typeof b !== "object" || Array.isArray(b)) return res;
      const refusal = b.ok === false ? b : b.result && typeof b.result === "object" && b.result.ok === false ? b.result : null;
      const code = refusal ? refusal.code ?? refusal.reason : null;
      if (!refusal || !(res.status === 502 || res.status === 504 || DOOR_TIMED_CODES.includes(code))) return res;
      if (b.timings && typeof b.timings === "object" && b.timings.door) return res;
      const stated = b.timings && typeof b.timings === "object" && !Array.isArray(b.timings) ? b.timings : await acquireStages();
      const headers = new Headers(res.headers);
      headers.delete("content-length");
      return new Response(JSON.stringify({ ...b, timings: failedTimings(stated) }), { status: res.status, headers });
    }
    /* The digest an answer names: its document's capture, else its own `capture` (a registered upload answers no document). */
    function shaOf(r) { return r?.document?.capture?.sha256 ?? r?.capture?.sha256 ?? null; }
    /* R100 (R085-4; WALK-085 F1; extraction R1, R20), R117: A NEW UPLOAD IS READ AS AN ACQUIRED DOCUMENT IS. When capture answers
       the upload as new (`ok`, not `existed`, a document), the door hands the document to extraction's reading, exactly
       as `op=acquire` does (`acquireReadingOp`), and the answer's document carries `reading` and `text_units`, so the
       promotion the capture screen sends with it stores the reading. A reading that fails is answered as the failed
       reading, relayed as acquire relays it; the upload stands, filed already. A refusal and a silence are relayed unread.
       Bytes already held (`existed: true`, R117): the digest is asked of `readHeld`, so a record whose home holds no reading gets
       one; and when the digest has no home yet (`NO_HOME`: an upload whose first answer was never promoted, so its reading was
       never kept) and the answer carries its document, the door reads the stored bytes as it reads a new upload and answers the
       reading with the document, so the promotion the screen sends keeps it. A reading held (or no whole object to read) leaves
       the answer as it was. */
    async function readUploaded(got) {
      if (got.early) return got;
      const r = got.body && typeof got.body.result === "object" && got.body.result ? got.body.result : null;
      if (!r || r.ok !== true) return got;
      const hasDocument = !!r.document && typeof r.document === "object";
      const sha = shaOf(r);
      const logEnd = (extra) => { try { console.log(JSON.stringify({ event: "upload_read", sha, pending: extra.pending === true, more: extra.more === true,
        ocr_left: extra.ocr_left ?? null, tier3_candidate: extra.tier3_candidate === true })); } catch { /* a log is status */ } };
      /* R123 (F2), R130: a reading owed is written down (the row, its answer read) and the answer says so only if the row is held; the upload stands as it was answered */
      let upfront = null;   /* the up-front registration's answer, so the row is written once */
      const owed = async (extra = {}) => {
        const reg = upfront && upfront.ok ? upfront : await pendSha(sha);
        logEnd({ ...extra, pending: reg.ok });
        return reg.ok ? { body: { ...got.body, result: { ...r, reading_pending: true } }, status: got.status }
                      : { body: { ...got.body, result: { ...r, reading_refused: refusedReading(reg) } }, status: got.status };
      };
      /* R130: capture registers the row inside its filing transaction (capture R109); when it says it could not (no registrar), or the bytes were held before this upload
         (`existed`), the door's own registration stands before any read starts */
      if (r.existed === true || (r.jobs && Array.isArray(r.jobs.not_registered) && r.jobs.not_registered.length)) {
        const reg = upfront = await pendSha(sha);
        if (!reg.ok && await readingWontFitHere(hasDocument ? r.document : { capture: r.capture })) return owed();
      }
      if (r.existed === true) {
        /* R117 (fix round 5, E2): bytes held whose reading will not fit are owed, not read inside the request; (fix round 6, G5) unless the
           record already holds their reading, which is neither read again nor promised again */
        if (await readingWontFitHere(hasDocument ? r.document : { capture: r.capture })) {
          return await readingHeld(sha) ? got : owed();
        }
        const held = await readHeld(sha, hasDocument ? r.document : null);
        if (held && held.read === false && held.why === "NO_WHOLE_OBJECT") return owed();
        /* (fix round 6, G14) a held reading that answers `more` is continued by the ledger */
        if (held && held.more === true) return owed({ more: true });
        if (!held || held.read !== false || held.why !== "NO_HOME" || !hasDocument || r.document.reading) return got;
      } else if (!hasDocument) return got;
      const verdict = await readingVerdict(r.document, { env, storeName });
      if (verdict.verdict === "deferred" || (verdict.verdict !== "stated" && readingWontFit(r.document))) return owed();
      /* R131: the gate admitted it: one inline read, its start written BEFORE the await; it makes no OCR call (extraction's `read` default, R131) */
      logRead("start", r.document, verdict);
      let read;
      try {
        read = await acquireReadingOp({ ok: true, document: r.document }, stub, { json, storeSilent, doAnswer, storeName,
          storeRefusal: (out) => storeRefusal(out, { store: storeName, tokenClass: cls }) });
      } finally { logRead("end", r.document, verdict); }
      if (read.response) return { early: read.response };
      /* (fix round 6, G4, G14; K4577, K4578) a read that failed or went silent after the upload stood is `reading_pending` with the failed call's `diag` (not drawn), and
         a reading that answers `more` is continued by cursor: both are owed to the ledger, and the upload stands as answered */
      const rb = read.body;
      const more = rb.document?.reading?.more === true || rb.more === true;
      const pending = rb.reading_pending === true || more;
      const left = rb.document?.reading?.ocr_left ?? null;
      const tier3 = rb.document?.reading?.tier3_candidate === true;
      let state = { reading_pending: false };
      if (pending) {
        const reg = await pendSha(sha);
        logEnd({ pending: reg.ok, more, ocr_left: left, tier3_candidate: tier3 });
        state = reg.ok ? { reading_pending: true } : { reading_refused: refusedReading(reg) };
      } else logEnd({ pending: false, more, ocr_left: left, tier3_candidate: tier3 });
      const { reading_pending: _omit, ...resultRest } = r;
      return { body: { ...got.body, result: { ...resultRest, document: rb.document, ...(state.reading_pending ? { reading_pending: true } : {}),
                                              ...(state.reading_refused ? { reading_refused: state.reading_refused } : {}),
                                              ...(rb.diag !== undefined ? { diag: rb.diag } : {}) } }, status: got.status };
    }
    /* R117: an `acquire` answered `existed: true` (the record already holds the bytes) is asked of `readHeld` as an upload is; the
       answer is relayed as it was (it carries its own reading already: acquire reads what it files). */
    /* R117 (fix round 4, C5b; extraction R80): a capture of several parts the record cannot say it holds (`existed: null`, acquisition R11:
       the register names no row for the whole) is asked as well, for the record that holds it may hold a reading that failed for want of
       the whole, which `readHeld` replaces once the whole is held. */
    async function readHeldAfterAcquire(res) {
      let b = null;
      try { b = await res.clone().json(); } catch { return res; }
      if (!(b && b.ok === true && (b.existed === true || (b.existed === null && Array.isArray(b.document?.parts))))) return res;
      /* R117 (fix round 5, E2): a held document whose reading will not fit is owed to the ledger, never read inside the request */
      if (await readingWontFitHere(b.document ?? { capture: b.capture })) {
        const sha = shaOf(b);
        if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return res;
        /* (fix round 6, G5) a reading the record already holds is neither promised again nor written down */
        if (await readingHeld(sha)) return res;
        /* the entry itself is written down by `pendReading`, which reads `reading_pending` off this answer */
        const headers = new Headers(res.headers);
        headers.delete("content-length");
        return new Response(JSON.stringify({ ...b, reading_pending: true }), { status: res.status, headers });
      }
      const held = await readHeld(shaOf(b), b.document ?? null);
      /* (fix round 6, G14) a reading that answers `more` is continued by cursor: the answer says it is on its way and `pendReading` writes the row */
      if (held && held.more === true) {
        const headers = new Headers(res.headers);
        headers.delete("content-length");
        return new Response(JSON.stringify({ ...b, reading_pending: true }), { status: res.status, headers });
      }
      return res;
    }
    /* R71 (N820; steps R9): A MEMBER'S CAPTURE MAY CARRY `step`, the step it is a product of. Once the capture has landed
       (its answer `ok`, naming the capture's digest), the door asks the store's internal route `capturestepproduct` to
       tie it there (`steps.recordProduct`), for a step the member may see; a capture by any other caller, or one that did
       not land, ties nothing. The capture's own answer is unchanged but for `step_product`, the tie's answer. */
    async function tieToStep(got, step) {
      if (got.early) return got.early;
      const r = got.body && typeof got.body.result === "object" && got.body.result ? got.body.result : null;
      const sha = r && r.ok === true ? (r.document?.capture?.sha256 ?? r.capture?.sha256 ?? r.sha256 ?? null) : null;
      const named = typeof step === "string" ? step.trim() : "";
      if (!viaSession || !named || typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha))
        return json({ ...got.body, store: storeName, tokenClass: cls }, got.status);
      const tie = await doAnswer(stub.fetch(new Request(
        `http://do/capturestepproduct?viewer=${encodeURIComponent(sessViewer)}&by=${encodeURIComponent(sessIdentity)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step: named, capture: sha }) })));
      const tied = tie.answered ? (tie.reply.body?.result ?? tie.reply.body) : { ok: false, reason: "STORE_DID_NOT_ANSWER" };
      return json({ ...got.body, result: { ...r, step_product: tied }, store: storeName, tokenClass: cls }, got.status);
    }
    /* R57 (K1983): the rendered pack the door holds for this caller, `op=agentpack`'s (R41), sent with a draft that reads
       nothing of the record; null when none renders. */
    async function heldPack(ctx) {
      if (!hooks.gatedOp) return null;
      const u = new URL(url);
      u.searchParams.set("op", "affordances");
      u.searchParams.delete("target");
      try {
        const res = await hooks.gatedOp({ ...ctx, req: new Request(u, { method: "GET" }), url: u, op: "affordances" });
        if (!res) return null;
        return (await packOf(res))?.pack ?? null;
      } catch { return null; }
    }
    /* R125 (fix round 5, E2): "Read it" (`readheld`) on a whole that will not fit is asked of the owner with `defer=1`: after its own gates
       (the home, the sight of it, a reading already held) it answers `READING_PENDING` without reading, and the door writes the entry down.
       The size is the bucket's own (the Worker reads it with no hop). The verdict is the door's word, handed to `store-request` (its R8) as
       `deferred`; `defer` in the caller's address is deleted there. */
    let readHeldSha = null, deferred = false;
    if (op === "readheld") {
      const asked = reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) ? reqBody.sha : null;
      const sha = String(url.searchParams.get("sha") ?? asked ?? "").toLowerCase();
      if (/^[0-9a-f]{64}$/.test(sha)) {
        readHeldSha = sha;
        const facts = await heldWholeFacts(env, storeName, sha);
        deferred = !!(facts && (await readingVerdict({ ...facts, capture: { ...facts.capture, sha256: sha } }, { env, storeName })).verdict === "deferred");
      }
    }
    /* R72 (K2458; capture R86): the upload's bytes are the request's raw body, streamed to capture as `bytes`, never read,
       decoded or kept here. Every other POST's body is read as text for `store-request`. */
    const streamedUpload = op === "captureupload" || op === "captureuploadpart";
    let passBody = req.method === "POST" && !streamedUpload ? await req.text() : undefined;
    let followed = [];   /* R123: the documents a promotion stores with no reading */
    /* PL-11 / IS-5 / D-199; REC-126 / DEC-31; R44: THE VALUES THE DOOR GENERATES, before the request is made. The mint's declaration is judged
       before anything is written (admission R13); a grant's secret is generated here and only its SHA-256 crosses, in the body (store-request R23). */
    let mintPlan = null, grantSecret = null;
    if (op === "aicredentialmint") {
      let asked = {};
      try { asked = passBody ? JSON.parse(passBody) : {}; } catch { asked = {}; }
      mintPlan = await aiCredentialMint(asked, cls);
      if (mintPlan.refusal) return refused(mintPlan.refusal);
    }
    if (op === "reviewgrant" || op === "templatereviewgrant") grantSecret = await reviewGrantSecret();   /* admission R13 */
    /* R136 (store-request R1): THE STORE'S REQUEST. Every stamp set from the caller admitted and none taken from the request, every
       credential in a header, the body's actor written where the owner reads it: `store-request`'s `innerRequest`, handed what the door
       alone knows (R72's length, R16's verdict, R120's deferral, R36's re-route, R17/R58's source and country). */
    const declared = OP_STAMPS[op] || [];
    const contentLength = req.headers.get("content-length");
    const built = innerRequest({ op, url, method: req.method, body: passBody, caller: { ...caller, token: credential.token },
      source: declared.includes("source") ? await sourceOf(req, env) : null,
      country: declared.includes("country") ? countryOf(req) : null,
      userAgent: req.headers.get("User-Agent"), origin: url.origin, length: /^\d+$/.test(contentLength || "") ? Number(contentLength) : null,
      resolving, replay, deferred, secretSha: grantSecret ? grantSecret.secretSha : null,
      mint: mintPlan ? { writes: mintPlan.writes, confinedTo: mintPlan.confinedTo, secretSha: mintPlan.secretSha } : null });
    /* admission R11 (K723): a session creating a project without `create_projects` is refused NOT_CAPABLE (C-38.5) at admission's one site */
    if (built.refusal) return refused(built.refusal);
    const inner = new URL(built.url);
    passBody = built.body;
    /* R59, store-door R9: the session and an ask's grant reach the store in the internal headers `store-request` made, never the address */
    const withGrant = (init) => {
      const headers = { ...(init.headers || {}), ...built.headers };
      return Object.keys(headers).length ? { ...init, headers } : init;
    };
    if (op === "promote" && passBody) {
      try { followed = unreadDocuments(JSON.parse(passBody)); } catch { /* the DO will refuse the malformed body with its own words */ }
    }
    /* R72 (K2458; capture R86): the upload's words (`statement`, `name`, `within`) and a `step` it is a product of travel in the address.
       Capture's answer is relayed as given, and a step named is tied after the capture lands (R71). `declared` is the request's length,
       set by `store-request` (R8). */
    if (op === "captureuploadpart") {
      const part = await stub.fetch(new Request(inner, withGrant({ method: "POST", body: req.body,
        headers: { "content-type": "application/octet-stream",
                   ...(req.headers.get("content-length") ? { "content-length": req.headers.get("content-length") } : {}) },
        ...(req.body ? { duplex: "half" } : {}) })));
      const got = await forwarded(part);
      return got.early ?? json({ ...got.body, store: storeName, tokenClass: cls }, got.status);
    }
    if (op === "captureupload") {
      requestStart(seen, op);   /* R129: before the object is asked */
      const uploaded = await stub.fetch(new Request(inner, withGrant({ method: "POST", body: req.body,
        headers: { "content-type": "application/octet-stream",
                   ...(req.headers.get("content-length") ? { "content-length": req.headers.get("content-length") } : {}) },
        ...(req.body ? { duplex: "half" } : {}) })));
      return tieToStep(await readUploaded(await forwarded(uploaded)), url.searchParams.get("step"));
    }

    /* PL-11 / IS-5 / D-199 — THE MINT, AND IT IS NOT A PLAIN FORWARD FOR ONE
     * REASON: THE VALUE IS GENERATED HERE AND IS RETURNED EXACTLY ONCE.
     *
     * The Durable Object receives the SHA and never the value, so no method
     * behind the store's door can print a credential because none has ever held one — a
     * stronger statement than a rule about not logging it; R30's test
     * (`test/m/control-plane/envelope.test.mjs`) drives the mint and finds the
     * value in its one answer and nowhere else. What is stored is an
     * identity a member chose and a hash that verifies a presentation, and
     * D-199 (4) is explicit that the record names the identity and the
     * principal, NEVER the token's value.
     *
     * THE DECLARATION IS JUDGED BEFORE ANYTHING IS WRITTEN, because a scope the
     * gate would refuse is a sentence that must not enter the record at all
     * (C-29.8 / C-29.9). `who` and `secretSha` are SET rather than merged: a
     * caller who could name either could mint themselves a credential in
     * somebody else's name, or bind a secret they chose. */
    if (op === "aicredentialmint") {
      /* admission R13: judged before the request was made (above); only the SHA-256 and the NORMALISED declaration crossed to the
         store, in the body store-request made (its R23), never the caller's spelling. */
      const mint = mintPlan;
      const secret = mint.secret;
      const minted = await doAnswer(stub.fetch(new Request(inner, { method: "POST", body: passBody })));
      if (minted.refused) return storeRefusal(minted, { op, store: storeName, tokenClass: cls });
      if (!minted.answered) return storeSilent("aicredentialmint", minted.correlation);
      if (!minted.result || minted.result.ok !== true)
        return json({ ok: false, ...(minted.result || {}), op, store: storeName, tokenClass: cls }, 403);
      return json({ ok: true, result: {
        ...minted.result,
        /* THE ONE TIME THIS VALUE EXISTS ANYWHERE A CALLER CAN READ IT. It is
           not recoverable afterwards from this instance by any route, because
           nothing here kept it — losing it means minting another and revoking
           this one, which leaves both acts on the record where they belong. */
        token: secret,
        tokenIsShownOnce: word("credential.token.once"),
      }, store: storeName, tokenClass: cls }, 200);
    }

    /* REC-126 / DEC-31 / IC-145 — THE GRANT'S READ SECRET, GENERATED HERE AND
     * SHOWN EXACTLY ONCE, on `aicredentialmint`'s pattern one block up and for its
     * reason: the Durable Object receives the SHA-256 and never the value, so no
     * method behind the store's door can print it because none has ever held it. The value is
     * a READ credential only (§6A.2): it is not a token, `classify` never admits it,
     * and the only ops that read it are `reviewcopy`, `reviewcomment` and the
     * unsigned half of `casedocument`. 32 random bytes, base64url, behind a version
     * prefix — not an id, and not derivable from one. */
    if (op === "reviewgrant") {
      const { secret } = grantSecret;   /* admission R13, made before the request (above) */
      /* R64 (N761): the digest is in the body store-request made (its R23), never the query */
      const issued = await doAnswer(stub.fetch(new Request(inner, { method: "POST", body: passBody })));
      if (issued.refused) return storeRefusal(issued, { op, store: storeName, tokenClass: cls });
      if (!issued.answered) return storeSilent("reviewgrant", issued.correlation);
      if (!issued.result || issued.result.ok !== true)
        return json({ ok: false, ...(issued.result || {}), op, store: storeName, tokenClass: cls }, 403);
      return json({ ok: true, result: {
        ...issued.result,
        secret,
        secretIsShownOnce: word("screen.review-copy.link.once"),
        read: "a POST to op=reviewcopy with the value above as `secret` in its JSON body, never in the address",
      }, store: storeName, tokenClass: cls }, 200);
    }

    /* R44 (K921; filing-templates R8): THE TEMPLATE GRANT'S SECRET, answered as `reviewgrant` is, one block up and for
       its reason: generated here by admission's `reviewGrantSecret` (its R13), its SHA-256 alone stamped `secretSha` for
       filing-templates, and the value returned once, in this answer. It opens the four grant doors (R44) to one version
       while the grant is live, and nothing else. */
    if (op === "templatereviewgrant") {
      const { secret } = grantSecret;   /* admission R13, made before the request (above) */
      /* R64 (N761): the digest is in the body store-request made (its R23), never the query */
      const issued = await doAnswer(stub.fetch(new Request(inner, { method: "POST", body: passBody })));
      if (issued.refused) return storeRefusal(issued, { op, store: storeName, tokenClass: cls });
      if (!issued.answered) return storeSilent("templatereviewgrant", issued.correlation);
      if (!issued.result || issued.result.ok !== true)
        return json({ ok: false, ...(issued.result || {}), op, store: storeName, tokenClass: cls }, 403);
      return json({ ok: true, result: {
        ...issued.result,
        secret,
        secretIsShownOnce: word("template.review.secret.once"),
        read: "a POST to op=templateread with the value above as `secret` in its JSON body, never in the address",
      }, store: storeName, tokenClass: cls }, 200);
    }

    /* R61: file-safety's byte answers, at the store's route of their own name, relayed as the owner answers them. */
    if (BYTE_OPS.includes(op)) {
      const warned = op === "openwithwarning" && req.method === "GET" ? warnedOf(url) : undefined;
      inner.searchParams.delete("warned");
      const init = warned === undefined ? { method: req.method, body: passBody }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ warned }) };
      return byteAnswer(await stub.fetch(new Request(inner, withGrant(init))), op, { store: storeName, tokenClass: cls });
    }

    /* REC-198: the list of a project's drafts answers in the review copy's OWN shape — through `reviewAnswer`,
       the function `reviewcopy` answers through — so the dead answer a caller outside the fence receives is the
       single read's, status and bytes, and not this handler's generic envelope. */
    if (op === "casedrafts") {
      /* R20 (fix round 6, G12c; K4577): `projects` is a body list or a comma-separated value of the address */
      const listed = reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) && Array.isArray(reqBody.projects) ? reqBody.projects.filter((d) => typeof d === "string").join(",") : "";
      if (listed && !inner.searchParams.get("projects")) inner.searchParams.set("projects", listed);
    }
    if (op === "casedrafts")
      return reviewAnswer(await doAnswer(stub.fetch(new Request(inner, withGrant({ method: "GET" })))), op);

    /* R23 (K421), R30, REC-52: the reply is read through `doAnswer`. The store's own refusal (`BAD_JSON`, an unknown
       route) is relayed at its status; anything that is not JSON carrying a boolean `ok`, or the store's catch, is a
       silence, never relayed (a store's stack included). */
    const out = await doAnswer(stub.fetch(new Request(inner, withGrant({ method: req.method, body: passBody }))));
    if (out.refused) return storeRefusal(out, { store: storeName, tokenClass: cls });
    if (!out.answered) return storeSilent(op, out.correlation);
    const { body, status } = out.reply;
    if (op === "stats" && cls !== "admin" && viaSession && sessRights.administer && body.result
        && typeof body.result.dbBytes === "number")
      return json({ ...body, result: { ...body.result, dbBytes: Math.floor(body.result.dbBytes / STATS_GRAIN) * STATS_GRAIN },
                    store: storeName, tokenClass: cls }, status);
    /* (signin-door R1, R4; credentials R16): a member who is revoked is signed out of their own runner, after the act
       and whatever the runner answers; the act's answer is unchanged. */
    const leaver = leaverOf(op, reqBody, body.result, stampOf.by);
    if (leaver) await signoutLeaver(env, leaver);
    if (op === "readheld" && readHeldSha && body.result && body.result.ok === true && body.result.why === "READING_PENDING") {
      const reg = await pendSha(readHeldSha);   /* R130: `reading_pending` exactly while the row is held */
      return json({ ...body, result: reg.ok ? { ...body.result, reading_pending: true } : { ...body.result, reading_refused: refusedReading(reg) }, store: storeName, tokenClass: cls }, status);
    }
    /* R135 (fix round 9, G135f; plane R97): `op=reading` answers the reading's job state from the job row, beside the stored reading; `owedwork` shows a digest's rows only to a
       viewer who may see the digest (answered as absent otherwise, DEC-36). The owner of a reading is never asked what its state is: the rows are plane's `jobrow` (R107) */
    if ((op === "reading" || op === "owedwork") && body.result && body.result.ok === true) {
      const sha = String(url.searchParams.get("sha256") ?? url.searchParams.get("sha") ?? "").toLowerCase();
      if (/^[0-9a-f]{64}$/.test(sha)) {
        /* plane R107: the job row of each reading kind, whole (a finished or refused row too), asked once per kind */
        const rows = async () => {
          const owed = [];
          for (const kind of ["reading", "ocr"]) {
            const asked = await doAnswer(stub.fetch(new Request(`http://do/jobrow?sha=${sha}&kind=${kind}`)));
            if (asked.answered && asked.result && asked.result.ok === true && asked.result.row && typeof asked.result.row === "object") owed.push(asked.result.row);
          }
          return { owed };
        };
        try {
          if (op === "reading") {
            const seenReading = body.result.found === true;
            const got = seenReading ? await rows() : null;
            return json({ ...body, result: { ...body.result, job: jobStateOf(got ? got.owed : []) }, store: storeName, tokenClass: cls }, status);
          }
          const admin = cls === "admin" || (viaSession && sessRights.administer);
          if (!admin) {
            const sees = await doAnswer(stub.fetch(new Request(`http://do/heldat?sha256=${sha}&viewer=${encodeURIComponent(stampOf.viewer ?? "")}`)));
            const held = sees.answered && sees.result && sees.result.ok === true && sees.result.held === true;
            const read = held ? true : await doAnswer(stub.fetch(new Request(`http://do/reading?sha256=${sha}&viewer=${encodeURIComponent(stampOf.viewer ?? "")}`)))
              .then((a) => a.answered && a.result && a.result.found === true);
            if (!read) return json({ ...body, result: { ...body.result, owed: [], last: [] }, store: storeName, tokenClass: cls }, status);
          }
        } catch { /* a state is status, never a gate: the answer stands as the owner gave it */ }
      }
    }
    /* R123 (fix round 4b; D3): the reading follows the promotion and the pull. The act stands as the store answered it; when a reading is
       owed it is written down and the answer's `result` says `reading_pending`. */
    if (((op === "promote" && followed.length) || op === "inboxpull") && body.result && body.result.ok === true) {
      const followedNow = await followEntries(op === "promote" ? followed : pulledEntries(body.result));
      if (followedNow.pending || followedNow.refused.length)
        return json({ ...body, result: followedAnswer(body, followedNow), store: storeName, tokenClass: cls }, status);
    }
    /* R58 (K2042 (2)): what an `op=unpack` filed is promoted, one act each, and named in the answer */
    if (op === "unpack" && body.result && body.result.ok === true) {
      const docs = archiveDocuments("unpack", body.result);
      if (docs.length || Array.isArray(body.result.documents)) {
        const done = await promoteFiled(docs, body.result.archive?.sha256 ?? null, body.result.complete === false);
        return json({ ...body, result: { ...body.result, ...done }, store: storeName, tokenClass: cls }, status);
      }
    }
    /* R57 (T35; N686, K1837, K1841): past every refusal of the store's door and of the owner, a draft is asked of the
       object (`draft.mjs`, wired by plane as its `draft`), with the pack the door holds (R41) and the request's own words;
       only a member's session reaches these ops (their specs). */
    if (draftDue(op, body) && viaSession && typeof stub.draft === "function") {
      let asked = {};
      try { asked = passBody ? JSON.parse(passBody) : {}; } catch { asked = {}; }
      /* (T46) a status report reads nothing and its task carries no pack */
      const pack = op === STATUS_REPORT_ASSIST ? null : await heldPack({ req, url, env, cls, viaSession, sessMember, sessViewer, sessIdentity, sessRights, sessCaps,
                                    aiCred, storeName, stub });
      const ask = { ...draftAsk(op, asked, { member: sessMember, session: credential.token,
                                       firsthand: body.result.firsthand === true, pack, owner: body.result }), trace, memberRef };   /* R93 */
      const res = await stub.draft(ask);
      let drafted = null;
      try { drafted = await res.json(); } catch { drafted = null; }
      if (!drafted || typeof drafted !== "object") return storeSilent(op);
      /* signin-door R4: a held sign-in Anthropic refused is dropped */
      await tokenRefusedSeen({ member: stampOf.by, answer: drafted, store: stored });
      /* ai-runs R48: whatever the check answers, a conversation that reached the model is counted to the member's day */
      if (drafted.ok === true)
        await doAnswer(stub.fetch(new Request(`http://do/askusage?viewer=${encodeURIComponent(sessViewer)}`, { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "draft", usage: drafted.usage ?? null, calls: drafted.calls }) })));
      /* (T37; N669, K2201; instance-setup R67) a translation is checked by its owner (its placeholders), never here: its
         answered draft is handed to the owner's store-internal `translationdraftrecord`, with the door's stamps, and that
         route's answer is the op's. An ending or a silence is answered as for the other two, and nothing is recorded. */
      if (op === TRANSLATION_DRAFT) {
        if (drafted.ok !== true) {
          const { grant: _g, ...given } = drafted;
          return json({ ...given, ok: false, store: storeName, tokenClass: cls }, res.status >= 400 ? res.status : 502);
        }
        const at = new URL(`http://x/${TRANSLATION_RECORD}`);
        for (const k of ["by", "viewer"]) if (inner.searchParams.has(k)) at.searchParams.set(k, inner.searchParams.get(k));
        /* K2238 (3d): the hand-back's body is instance-setup's — the asked `keys` (or `key`) beside what the owner answered
           and what agent-worker drafted — and it re-runs its refusals before recording anything */
        const handed = { direction: ask.direction, language: ask.language,
                         ...(Array.isArray(asked.keys) ? { keys: asked.keys } : {}), ...(asked.key !== undefined ? { key: asked.key } : {}),
                         words: ask.words, draft: drafted.draft ?? null,
                         ...(Array.isArray(drafted.not_drafted) ? { not_drafted: drafted.not_drafted } : {}) };
        const recorded = await doAnswer(stub.fetch(new Request(at, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(handed) })));
        if (recorded.refused) return storeRefusal(recorded, { store: storeName, tokenClass: cls });
        if (!recorded.answered) return storeSilent(TRANSLATION_RECORD, recorded.correlation);
        /* (T46; N897 (2)) the plane's `untested`, passed beside what the owner recorded */
        const kept = recorded.reply.body;
        const untested = untestedOf(drafted);
        const carried = untested.untested && kept && typeof kept.result === "object" && kept.result
          ? { ...kept, result: { ...kept.result, ...untested } } : kept;
        return json({ ...carried, store: storeName, tokenClass: cls }, recorded.reply.status);
      }
      const shaped = checkedDraft(ask, drafted, res.status, sessViewer);
      /* (T46; N920) the status report keeps the owner's `as_of` beside its plan */
      const asOf = op === STATUS_REPORT_ASSIST && body.result.as_of !== undefined ? { as_of: body.result.as_of } : {};
      return shaped.body.ok === true ? json({ ok: true, result: { ...shaped.body, ...asOf }, store: storeName, tokenClass: cls }, 200)
        : json({ ...shaped.body, store: storeName, tokenClass: cls }, shaped.status);
    }
    /* K383 (doorbell's C-118.2, its R21; T43-8): an inbox read or disposition naming no knock answers 404, as NO_SUCH_BUNDLE does. */
    if ((op === "inboxget" || op === "inboxresolve") && body.result?.ok === false && body.result.reason === "NO_SUCH_KNOCK")
      return json({ ...body, store: storeName, tokenClass: cls }, 404);
    /* R36 (doorbell R13): the pull's refusals carry their status (400, 403, 404, 409, 500, 502, 503), which its answer takes;
       so do the resolve's `RESOLVE_NO_REASON` (doorbell R3, C-118.7) and the held acts' refusals (capture R79, R81: C-118.8,
       C-118.9, the id count, the named ids). A refusal stating no status in that range answers the forward's own. */
    const hinted = body.result?.status;
    if (STATED_STATUS_OPS.includes(op) && body.result?.ok === false && Number.isInteger(hinted) && hinted >= 400 && hinted < 600)
      return json({ ...body, store: storeName, tokenClass: cls }, hinted);
    return json({ ...body, store: storeName, tokenClass: cls }, status);
  }
}
export { ACT_CLOCK_OPS, CASE_IMPORT_ACTIONS, PUBLISHED_STORE, sha256Hex, fingerprint, caseReader, reviewAnswer, captureKey, migrationReplayOf, DRIVE_PROVENANCE_PATH,
         storageAbsent, PLANE_LIMITS, PLANE_LIMITS_STATEMENT, PLANE_CRONS_STATEMENT };
/* K624 (1), (2): admission's namespace names, read through this door by plane's hooks and by the fleet members' pin
   (`members-pin.test.mjs`); the door itself calls admission directly. */
export { SCRATCH, NAMESPACES } from "../admission/index.mjs";
